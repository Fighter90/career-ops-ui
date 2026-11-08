"""Small HTTP facade over fleet commands, suitable for an AgentCore image.

Only start this behind AgentCore's authenticated invocation boundary, or on
loopback for qualification. It is not an independently authenticated web API.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import tempfile
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from fleet.config import load
from fleet.hosts import probe
from fleet.placement import TERMINAL
from steer.util import atomic_write_json, flock_exclusive
from steer.config_loader import agent_settings


def read_exact(stream, length):
    value = stream.read(length)
    if len(value) != length:
        raise ValueError("incomplete request body")
    return value


def read_chunked(stream):
    parts = []
    while True:
        line = stream.readline()
        size = line.removesuffix(b"\r\n").split(b";", 1)[0]
        if not line.endswith(b"\r\n") or not re.fullmatch(rb"[0-9a-fA-F]+", size):
            raise ValueError("invalid chunk size")
        length = int(size, 16)
        if length == 0:
            while True:
                trailer = stream.readline()
                if trailer == b"\r\n":
                    return b"".join(parts)
                if not trailer.endswith(b"\r\n") or b":" not in trailer:
                    raise ValueError("invalid chunk trailer")
        parts.append(read_exact(stream, length))
        if read_exact(stream, 2) != b"\r\n":
            raise ValueError("invalid chunk terminator")


class Guest:
    def __init__(self, config_path):
        self.config_path = Path(config_path).resolve()
        config = load(self.config_path)
        if len(config["hosts"]) != 1 or config["hosts"][0]["transport"] != "local":
            raise ValueError("AgentCore guest requires one local host binding")
        self.state = Path(config["state_path"]).parent
        self.state.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.porch = str(Path(__file__).resolve().parents[2] / "porch")
        self.boot_id = str(uuid.uuid4())
        self.timeout = config["hosts"][0]["request_timeout_seconds"]

    def health(self):
        observation = probe()
        # Login, staging and dependency installation precede the first agent run.
        # The provisioning caller owns this marker and removes it after bootstrap.
        busy = (self.state / "bootstrap-active").exists() or any(
            status not in TERMINAL for status in observation["runs"].values())
        return {"status": "HealthyBusy" if busy else "Healthy"}

    def bind(self, session_id):
        if not isinstance(session_id, str) or not 33 <= len(session_id) <= 256 or not re.fullmatch(r"[A-Za-z0-9_-]+", session_id):
            raise ValueError("session_id must match the AgentCore session identifier")
        identity = self.state / "agentcore-session.json"
        with flock_exclusive(self.state / "agentcore-session.lock"):
            if identity.exists():
                if json.loads(identity.read_text())["session_id"] != session_id:
                    raise ValueError("environment belongs to a different session")
            else:
                atomic_write_json(identity, {"session_id": session_id})

    def subscription_ready(self, binary="codex"):
        result = subprocess.run([binary, "login", "status"], text=True, capture_output=True, timeout=self.timeout)
        return result.returncode == 0 and "Logged in using ChatGPT" in result.stdout + result.stderr

    def command(self, arguments, content=None):
        value = subprocess.run([self.porch, "fleet", "--config", str(self.config_path), *arguments],
                               input=content, text=True, capture_output=True, timeout=self.timeout)
        # Native stderr is intentionally not returned: control status/events
        # supply structured evidence; callers receive a content-free failure tag.
        result = {"exit_code": value.returncode, "stdout": value.stdout,
                  "stderr_present": bool(value.stderr)}
        if value.returncode:
            result["error"] = "porch_command_failed"
            # Only forward our CLI's structured error, never arbitrary native
            # stderr or progress lines.
            for line in reversed(value.stderr.splitlines()):
                try:
                    error = json.loads(line)
                except ValueError:
                    continue
                if isinstance(error, dict) and isinstance(error.get("error"), str):
                    result["error"] = error["error"]
                    break
        return result

    def invoke(self, envelope):
        if not isinstance(envelope, dict) or envelope.get("protocol") != 1:
            raise ValueError("unsupported guest protocol")
        session_id = envelope.get("session_id")
        self.bind(session_id)
        operation = envelope.get("operation")
        if operation == "ready":
            return {"protocol": 1, "session_id": session_id, "boot_id": self.boot_id,
                    "runner_ready": True, "subscription_ready": self.subscription_ready()}
        if envelope.get("boot_id") != self.boot_id:
            raise ValueError("guest boot changed; reconcile instead of replaying work")
        body = envelope.get("body")
        if not isinstance(body, dict):
            raise ValueError("body must be an object")
        identity = body.get("request_id")
        if not isinstance(identity, str) or not identity:
            raise ValueError("request_id is required")
        if operation == "launch":
            result = self.launch(identity, body)
        elif operation == "reconcile":
            result = self.command(["reconcile", identity])
        elif operation == "control":
            command = body.get("command")
            if command not in {"status", "events", "wait", "steer", "cancel"}:
                raise ValueError("unsupported delegate control")
            options = body.get("options", [])
            if not isinstance(options, list) or any(not isinstance(v, str) for v in options):
                raise ValueError("control options must be strings")
            guidance = body.get("guidance")
            if guidance is not None and (command != "steer" or not isinstance(guidance, str)):
                raise ValueError("guidance is valid only for steer")
            result = self.command(["control", identity, command, *options], guidance)
        else:
            raise ValueError("unsupported guest operation")
        return {"protocol": 1, "session_id": session_id, "boot_id": self.boot_id, **result}

    def launch(self, identity, body):
        for field in ("agent", "workspace", "prompt"):
            if not isinstance(body.get(field), str) or not body[field].strip():
                raise ValueError(f"launch requires {field}")
        _, backend, _, binary = agent_settings(body["agent"])
        if backend != "codex-cli":
            raise ValueError("this environment profile currently supports Codex only")
        if not self.subscription_ready(binary):
            raise ValueError("native Codex subscription authentication is unavailable; no task launched")
        # Prompt bytes stay out of argv and are removed after transport acceptance.
        with tempfile.TemporaryDirectory(prefix="launch-", dir=self.state) as directory:
            prompt = Path(directory) / "prompt.txt"
            prompt.write_text(body["prompt"], encoding="utf-8")
            prompt.chmod(0o600)
            return self.command(["launch", "--request-id", identity, "--agent", body["agent"],
                                 "--workspace", body["workspace"], "--prompt-file", str(prompt)])


def handler(guest):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # No task bodies, URLs or credentials in HTTP access logs.

        def reply(self, status, value):
            raw = json.dumps(value, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            if self.path != "/ping":
                self.reply(404, {"error": "unknown_path"})
                return
            try:
                self.reply(200, guest.health())
            except Exception:
                self.reply(503, {"error": "registry_observation_unavailable"})

        def do_POST(self):
            if self.path != "/invocations":
                self.reply(404, {"error": "unknown_path"})
                return
            try:
                transfer = self.headers.get("Transfer-Encoding")
                if transfer:
                    if transfer.lower().strip() != "chunked" or self.headers.get("Content-Length") is not None:
                        raise ValueError("unsupported request framing")
                    raw = read_chunked(self.rfile)
                else:
                    length = self.headers.get("Content-Length", "")
                    if not length.isascii() or not length.isdecimal():
                        raise ValueError("invalid content length")
                    raw = read_exact(self.rfile, int(length))
                envelope = json.loads(raw)
                self.reply(200, guest.invoke(envelope))
            except (ValueError, KeyError, TypeError) as error:
                self.reply(400, {"error": str(error)})
            except subprocess.TimeoutExpired:
                self.reply(200, {"error": "command_outcome_unknown", "boot_id": guest.boot_id,
                                 "note": "reconcile the same request; do not launch a replacement"})
            except Exception:
                self.reply(500, {"error": "guest_operation_failed"})
    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=os.environ.get("PORCH_FLEET_CONFIG"), required=False)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    if not args.config:
        parser.error("--config or PORCH_FLEET_CONFIG is required")
    guest = Guest(args.config)
    ThreadingHTTPServer((args.bind, args.port), handler(guest)).serve_forever()
