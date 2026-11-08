#!/usr/bin/env python3
"""Run an OpenCode 2 one-shot against a private, coordinated server."""
from __future__ import annotations
import os
import re
import signal
import subprocess
import sys

from steer.adapters.opencode import OpenCodeAdapter
from steer.util import detached_popen_kwargs, kill_process_group, resolve_argv


class Interrupted(Exception):
    def __init__(self, signum: int):
        self.signum = signum


def main() -> int:
    if len(sys.argv) < 5:
        print("opencode_run: expected temporary directory, artifact key, binary, and run arguments", file=sys.stderr)
        return 2
    temp_dir, key, binary, *args = sys.argv[1:]
    if not args or args[0] != "run" or "--standalone" not in args:
        print("opencode_run: expected OpenCode 2 run --standalone", file=sys.stderr)
        return 2
    args.remove("--standalone")
    key = re.sub(r"[^A-Za-z0-9._-]", "_", key) or "opencode"
    saved = os.environ.get("PORCH_RUN_DIR") if os.environ.get("PORCH_SAVE_OUTPUTS", "1") != "0" else None
    artifacts = saved or temp_dir
    adapter = OpenCodeAdapter(binary=binary, model="", cwd=os.getcwd(), artifacts_dir=artifacts,
                              agent_id=f"{key}.server")
    client = None
    previous = {}
    def interrupt(signum, _frame):
        raise Interrupted(signum)
    for name in ("SIGTERM", "SIGHUP", "SIGINT", "SIGBREAK"):
        sig = getattr(signal, name, None)
        if sig is not None and sig not in previous:
            previous[sig] = signal.signal(sig, interrupt)
    try:
        adapter._start_server()
        args.extend(["--server", adapter.base_url])
        client = subprocess.Popen(resolve_argv([binary, *args], cwd=os.getcwd()),
                                  env=adapter._child_env(), **detached_popen_kwargs())
        return client.wait()
    except Interrupted as exc:
        return 128 + exc.signum
    except Exception as exc:
        print(f"opencode_run: {exc}", file=sys.stderr)
        return 1
    finally:
        if client is not None:
            if client.poll() is None:
                kill_process_group(client.pid, timeout=3.0, process=client)
            client.wait()
        adapter.close()
        for sig, handler in previous.items():
            signal.signal(sig, handler)


if __name__ == "__main__":
    sys.exit(main())
