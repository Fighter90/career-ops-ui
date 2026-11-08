#!/usr/bin/env python3
"""Opt-in integration tests against a real OpenCode 2 CLI and local model stub.

Set PORCH_REAL_OPENCODE_BIN to the CLI executable. The test uses isolated XDG
paths and a loopback-only, deterministic OpenAI-compatible provider; it does
not read the user's provider credentials or call a paid model.
"""
from __future__ import annotations
import json
import os
from concurrent.futures import ThreadPoolExecutor
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parent.parent
SKILL = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS / "lib"))
from steer.adapters.opencode import OpenCodeAdapter

BINARY = os.environ.get("PORCH_REAL_OPENCODE_BIN")
SYSTEM_PATH = os.environ.get("PATH", "/usr/bin:/bin")


@unittest.skipUnless(BINARY, "set PORCH_REAL_OPENCODE_BIN to an OpenCode 2 binary")
class RealOpenCodeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="porch-real-opencode-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ("data", "config", "cache", "project", "artifacts"):
            (self.root / name).mkdir()
        self.started = threading.Event()
        self.lock = threading.Lock()
        self.calls = 0
        owner = self
        class Provider(BaseHTTPRequestHandler):
            def log_message(self, *_args):
                pass
            def do_POST(self):
                self.rfile.read(int(self.headers.get("Content-Length", 0)))
                with owner.lock:
                    owner.calls += 1
                    number = owner.calls
                if number == 1:
                    owner.started.set()
                    time.sleep(1.5)
                try:
                    self.send_response(200)
                    self.send_header("Content-Type", "text/event-stream")
                    self.end_headers()
                    for delta, finish in (({"role": "assistant", "content": f"ANSWER_{number}"}, None), ({}, "stop")):
                        chunk = {"id": f"fixture-{number}", "object": "chat.completion.chunk",
                                 "created": int(time.time()), "model": "fixture", "choices": [
                                     {"index": 0, "delta": delta, "finish_reason": finish}]}
                        self.wfile.write(("data: " + json.dumps(chunk) + "\n\n").encode())
                        self.wfile.flush()
                    self.wfile.write(b"data: [DONE]\n\n")
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    pass
        self.provider = ThreadingHTTPServer(("127.0.0.1", 0), Provider)
        threading.Thread(target=self.provider.serve_forever, daemon=True).start()
        self.addCleanup(self.provider.server_close)
        self.addCleanup(self.provider.shutdown)
        config = {"providers": {"test": {"package": "@opencode/ai/providers/openai-compatible",
                  "settings": {"baseURL": f"http://127.0.0.1:{self.provider.server_port}/v1", "apiKey": "fixture"},
                  "models": {"fixture": {"name": "Fixture", "limit": {"context": 8192, "output": 1024}}}}}}
        self.env = {"PATH": SYSTEM_PATH, "HOME": str(self.root), "XDG_DATA_HOME": str(self.root / "data"),
                    "XDG_CONFIG_HOME": str(self.root / "config"), "XDG_CACHE_HOME": str(self.root / "cache"),
                    "OPENCODE_DISABLE_MODELS_FETCH": "1", "OPENCODE_CONFIG_CONTENT": json.dumps(config)}

    def test_steering_and_history(self):
        for mode in ("auto", "queue", "interrupt"):
            with self.subTest(mode=mode), patch.dict(os.environ, self.env, clear=True):
                self.started.clear()
                with self.lock:
                    self.calls = 0
                adapter = OpenCodeAdapter(binary=BINARY, model="test/fixture", cwd=str(self.root / "project"),
                                          artifacts_dir=str(self.root / "artifacts"), agent_id=mode)
                try:
                    adapter.start("First instruction")
                    self.assertTrue(self.started.wait(20), "model request did not start")
                    result = adapter.steer("Second instruction", mode, "second")
                    self.assertTrue(result.ok, result.error)
                    deadline = time.monotonic() + 45
                    while not adapter.is_done() and time.monotonic() < deadline:
                        list(adapter.poll_events())
                        time.sleep(.05)
                    list(adapter.poll_events())
                    self.assertTrue(adapter.is_done(), "OpenCode did not complete")
                    self.assertEqual(adapter.exit_code(), 0, adapter._error)
                    self.assertIn("ANSWER_", adapter.final_text())
                    self.assertGreaterEqual(self.calls, 2)
                    if mode == "interrupt":
                        self.assertEqual(adapter.final_text().count("ANSWER_"), 1)
                    from sessions import Store, opencode_iter_sessions, opencode_iter_fragments
                    db = self.root / "data" / "opencode" / "opencode.db"
                    store = Store("opencode", "db", db, "sqlite")
                    ref = next(r for r in opencode_iter_sessions(store) if r.session_id == adapter.session_id)
                    fragments = list(opencode_iter_fragments(store, ref, 0, {}))
                    self.assertTrue(any(f["kind"] == "assistant" and "ANSWER_" in f.get("text", "") for f in fragments))
                finally:
                    adapter.close()
                    self.assertIsNotNone(adapter.proc.poll(), "private OpenCode server was not reaped")

    def test_one_shot_review_preserves_provider_config(self):
        env = {**self.env, "PORCH_CONFIG": str(SKILL / "config.example.json"),
               "PORCH_BIN_OPENCODE": BINARY, "OPENCODE_MODEL": "test/fixture", "OPENCODE_EFFORT": "none",
               "PORCH_RUN_DIR": str(self.root / "artifacts"), "PORCH_SAVE_OUTPUTS": "0"}
        result = subprocess.run([str(SCRIPTS / "lib/backend_run.sh"), "--mode", "review", "--agent-id", "opencode", "--raw", "Review this"],
                                cwd=self.root / "project", env=env, text=True, capture_output=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("ANSWER_", result.stdout)

    def test_concurrent_private_servers_share_database(self):
        # Exercise both first-use migration and an already-initialized database.
        with patch.dict(os.environ, self.env, clear=True):
            for round_no in range(2):
                with self.subTest(round=round_no):
                    barrier = threading.Barrier(4)
                    def run_one(index):
                        artifacts = self.root / "artifacts" / f"{round_no}-{index}"
                        artifacts.mkdir()
                        adapter = OpenCodeAdapter(binary=BINARY, model="test/fixture",
                            cwd=str(self.root / "project"), artifacts_dir=str(artifacts), agent_id=str(index))
                        try:
                            barrier.wait(timeout=15)
                            adapter.start(f"Concurrent task {round_no}-{index}")
                            deadline = time.monotonic() + 80
                            while not adapter.is_done() and time.monotonic() < deadline:
                                list(adapter.poll_events())
                                time.sleep(.05)
                            list(adapter.poll_events())
                            if not adapter.is_done() or adapter.exit_code() != 0:
                                raise AssertionError(f"session {index} failed: {adapter._error}")
                            if "ANSWER_" not in adapter.final_text():
                                raise AssertionError(f"session {index} returned no answer")
                            return adapter.session_id
                        except Exception as exc:
                            raw = artifacts / "raw" / f"{index}.jsonl"
                            detail = raw.read_text(encoding="utf-8")[-10000:] if raw.exists() else "no server log"
                            raise AssertionError(f"session {index}: {exc}\n{detail}") from exc
                        finally:
                            adapter.close()
                            if adapter.proc and adapter.proc.poll() is None:
                                raise AssertionError("private server was not reaped")
                    with ThreadPoolExecutor(max_workers=4) as executor:
                        ids = list(executor.map(run_one, range(4)))
                    self.assertEqual(len(set(ids)), 4)

    def test_concurrent_one_shot_and_steerable_share_database(self):
        with patch.dict(os.environ, self.env, clear=True):
            barrier = threading.Barrier(4)
            def run_one(index):
                barrier.wait(timeout=15)
                artifacts = self.root / "artifacts" / f"mixed-{index}"
                artifacts.mkdir()
                if index % 2:
                    env = {**self.env, "PORCH_CONFIG": str(SKILL / "config.example.json"),
                           "PORCH_BIN_OPENCODE": BINARY, "OPENCODE_MODEL": "test/fixture",
                           "OPENCODE_EFFORT": "none", "PORCH_RUN_DIR": str(artifacts)}
                    result = subprocess.run([str(SCRIPTS / "lib/backend_run.sh"), "--mode", "review",
                        "--agent-id", "opencode", "--raw", "Review this"], cwd=self.root / "project",
                        env=env, text=True, capture_output=True, timeout=90)
                    if result.returncode != 0 or "ANSWER_" not in result.stdout:
                        raise AssertionError(f"one-shot {index} failed: {result.stderr}")
                    return
                adapter = OpenCodeAdapter(binary=BINARY, model="test/fixture", cwd=str(self.root / "project"),
                                          artifacts_dir=str(artifacts), agent_id=str(index))
                try:
                    adapter.start("Concurrent task")
                    deadline = time.monotonic() + 80
                    while not adapter.is_done() and time.monotonic() < deadline:
                        list(adapter.poll_events())
                        time.sleep(.05)
                    if not adapter.is_done() or adapter.exit_code() != 0 or "ANSWER_" not in adapter.final_text():
                        raise AssertionError(f"steerable {index} failed: {adapter._error}")
                finally:
                    adapter.close()
            with ThreadPoolExecutor(max_workers=4) as executor:
                list(executor.map(run_one, range(4)))

    def test_concurrent_porch_processes_share_database(self):
        for round_no in range(2):
            with self.subTest(round=round_no):
                barrier = threading.Barrier(4)
                def run_one(index):
                    env = {**self.env, "PORCH_CONFIG": str(SKILL / "config.example.json"),
                           "PORCH_BIN_OPENCODE": BINARY, "OPENCODE_MODEL": "test/fixture",
                           "OPENCODE_EFFORT": "none", "PORCH_SAVE_OUTPUTS": "0",
                           "PORCH_STEER_DIR": str(self.root / "registry")}
                    argv = [str(SCRIPTS / "porch"), "delegate", "-a", "opencode"]
                    if index % 2:
                        argv.append("--one-shot")
                    argv.append(f"Concurrent task {round_no}-{index}")
                    barrier.wait(timeout=15)
                    result = subprocess.run(argv, cwd=self.root / "project", env=env,
                        text=True, capture_output=True, timeout=100)
                    if result.returncode != 0 or "ANSWER_" not in result.stdout:
                        raise AssertionError(f"process {index} failed ({result.returncode}): {result.stderr}")
                with ThreadPoolExecutor(max_workers=4) as executor:
                    list(executor.map(run_one, range(4)))


if __name__ == "__main__":
    unittest.main()
