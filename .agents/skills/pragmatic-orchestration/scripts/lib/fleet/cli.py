"""Coordinator CLI. Run every fleet command on ONE configured coordinator."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import subprocess
import sys
from pathlib import Path
from steer.registry import RegistryError

from .config import load
from .hosts import execute, inspect, probe
from .placement import choose
from .store import Store


def parser():
    p = argparse.ArgumentParser(prog="porch fleet", description=__doc__)
    p.add_argument("--config", default=os.environ.get("PORCH_FLEET_CONFIG"))
    commands = p.add_subparsers(dest="command", required=True)
    commands.add_parser("probe", help="local host observation, no configuration or model call")
    commands.add_parser("worker-launch", help="internal worker entrypoint used by the coordinator")
    commands.add_parser("status", help="observe configured hosts and durable reservations")
    sub = commands.add_parser("reconcile", help="recover a lost launch receipt from host registry evidence")
    sub.add_argument("request_id")
    for command in ("plan", "launch"):
        sub = commands.add_parser(command)
        sub.add_argument("--agent", required=True)
        sub.add_argument("--workspace", required=True)
        sub.add_argument("--host", help="explicit host override; otherwise configured order")
        sub.add_argument("--units", type=int, default=1, help="task allocation weight, default 1")
        if command == "launch":
            sub.add_argument("--request-id", required=True, help="stable caller-generated id; reuse on retry")
            sub.add_argument("--prompt-file", required=True)
    sub = commands.add_parser("control", help="route existing delegate controls to the selected host")
    sub.add_argument("request_id")
    sub.add_argument("operation", choices=("status", "events", "wait", "steer", "cancel"))
    sub.add_argument("arguments", nargs=argparse.REMAINDER)
    return p


def public(row):
    return {k: v for k, v in row.items() if k not in {"fingerprint", "binding"}}


def launch(config, store, args, request):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", args.request_id):
        raise ValueError("request id must contain letters, digits, underscore or hyphen")
    prompt = Path(args.prompt_file).read_text(encoding="utf-8")
    if not prompt.strip():
        raise ValueError("task prompt is empty")
    fingerprint = hashlib.sha256(json.dumps([request, prompt], sort_keys=True).encode()).hexdigest()
    old = store.get(args.request_id)
    if old:
        if old["fingerprint"] != fingerprint:
            raise ValueError("request id already belongs to a different task")
        return {"request": public(old), "replayed": True, "note": "original allocation; no new launch"}
    observations = {h["id"]: inspect(h) for h in config["hosts"]}
    allocation, created = store.claim(args.request_id, fingerprint, config["hosts"], observations, request)
    if not created:
        return {"request": public(allocation), "replayed": True}
    host = next(h for h in config["hosts"] if h["id"] == allocation["host"])
    try:
        result = execute(host, ["fleet", "worker-launch"], content=json.dumps({
            "agent": request["agent"], "id": args.request_id, "fingerprint": fingerprint,
            "prompt": prompt, "cwd": host["workspaces"][request["workspace"]]}))
        run_id = result.stdout.strip()
        if result.returncode or not re.fullmatch(r"[A-Za-z0-9_-]+", run_id):
            return {"request": public(allocation), "error": "launch_unconfirmed",
                    "note": "reservation retained; inspect host runs before any new launch"}
    except (OSError, subprocess.TimeoutExpired):
        return {"request": public(allocation), "error": "launch_unconfirmed",
                "note": "reservation retained; inspect host runs before any new launch"}
    return {"request": public(store.launched(args.request_id, run_id))}


def run(args):
    if args.command == "probe":
        return probe()
    if args.command == "worker-launch":
        request = json.load(sys.stdin)
        if not isinstance(request, dict) or any(not isinstance(request.get(k), str) or not request[k]
                                               for k in ("agent", "id", "fingerprint", "prompt", "cwd")):
            raise ValueError("worker launch requires agent, id, fingerprint, prompt and cwd strings")
        if not Path(request["cwd"]).is_absolute() or not Path(request["cwd"]).is_dir():
            raise ValueError("worker launch requires an existing absolute workspace")
        if not re.fullmatch(r"[0-9a-f]{64}", request["fingerprint"]):
            raise ValueError("invalid request fingerprint")
        env = dict(os.environ, PORCH_FLEET_REQUEST_ID=request["id"],
                   PORCH_FLEET_FINGERPRINT=request["fingerprint"], PORCH_FLEET_WORKSPACE=request["cwd"])
        porch = str(Path(__file__).resolve().parents[2] / "porch")
        result = subprocess.run([porch, "delegate", "-a", request["agent"], "--detach",
                                 "--name", "fleet-" + request["id"]],
                                input=request["prompt"], cwd=request["cwd"], env=env,
                                text=True, capture_output=True)
        sys.stdout.write(result.stdout)
        sys.stderr.write(result.stderr)
        return result.returncode
    if not args.config:
        raise ValueError("set PORCH_FLEET_CONFIG or pass --config; run on the single coordinator")
    config = load(args.config)
    store = Store(config["state_path"])
    try:
        if args.command in {"control", "reconcile"}:
            allocation = store.get(args.request_id)
            if not allocation:
                raise ValueError("unknown request")
            host = next((h for h in config["hosts"] if h["id"] == allocation["host"]), None)
            if host is None:
                raise ValueError("allocated host is missing from configuration")
            binding = {key: host.get(key) for key in ("transport", "porch", "address")}
            if json.dumps(binding, sort_keys=True) != allocation["binding"]:
                raise ValueError("host binding changed; restore the original connection before controlling this run")
            if args.command == "reconcile":
                return {"request": public(store.reconcile(args.request_id, inspect(host)))}
            if not allocation["run_id"]:
                raise ValueError("request has no confirmed run; use fleet reconcile")
            # Read guidance locally and send via stdin; remote paths are never assumed local.
            arguments = args.arguments
            if any(a == "--registry-root" or a.startswith("--registry-root=") for a in arguments):
                raise ValueError("fleet controls use the host's original registry")
            if any(a == "--prompt-file" or a.startswith("--prompt-file=") for a in arguments):
                raise ValueError("pipe guidance to fleet control steer; local files are not remote paths")
            content = None
            if args.operation == "steer":
                content = sys.stdin.read() if not sys.stdin.isatty() else None
            result = execute(host, ["delegate", args.operation, allocation["run_id"], *arguments], content=content)
            sys.stdout.write(result.stdout)
            sys.stderr.write(result.stderr)
            return result.returncode
        observations = None
        if args.command in {"status", "plan"}:
            observations = {h["id"]: inspect(h) for h in config["hosts"]}
        if args.command == "status":
            return {"hosts": observations, "requests": [public(r) for r in store.rows()]}
        request = {"agent": args.agent, "workspace": args.workspace, "host": args.host, "units": args.units}
        if args.units <= 0:
            raise ValueError("units must be positive")
        if args.host and args.host not in {h["id"] for h in config["hosts"]}:
            raise ValueError("unknown host")
        if args.command == "plan":
            host, reasons = choose(config["hosts"], observations, store.rows(), request)
            return {"host": host, "excluded": reasons, "advisory_only": True}
        return launch(config, store, args, request)
    finally:
        store.close()


def main(argv=None):
    try:
        value = run(parser().parse_args(argv))
        if isinstance(value, int):
            return value
        print(json.dumps(value, ensure_ascii=False, indent=2))
        return 2 if "error" in value else 0
    except (OSError, ValueError, RegistryError, sqlite3.Error, subprocess.TimeoutExpired) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 2
