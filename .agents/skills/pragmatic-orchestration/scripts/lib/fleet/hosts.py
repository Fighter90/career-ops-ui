"""Existing-host access. SSH argv is quoted once for the remote POSIX shell."""
from __future__ import annotations

import json
import os
import platform
import shlex
import shutil
import subprocess
import time
from pathlib import Path

from steer.registry import Registry


def probe():
    registry = Registry()
    runs = {}
    requests = []
    # Read metadata only, never native auth files, prompts, or process command lines.
    if registry.runs_dir.exists():
        for path in registry.runs_dir.iterdir():
            if path.is_symlink() or not path.is_dir():
                continue
            meta = registry.load_meta(path.name)
            status = meta["status"]
            if status in {"completed", "failed", "cancelled"} and meta.get("cleanup_status", "completed") != "completed":
                status = "cleanup_" + meta["cleanup_status"]
            runs[path.name] = status
            if isinstance(meta.get("fleet_request"), dict):
                requests.append({**meta["fleet_request"], "run_id": path.name, "cwd": meta["cwd"]})
    memory = None
    if platform.system() == "Linux":
        fields = dict(line.split(":", 1) for line in Path("/proc/meminfo").read_text().splitlines())
        memory = int(fields["MemAvailable"].split()[0]) // 1024
    return {"available": True, "observed_at": time.time(), "platform": platform.system(), "architecture": platform.machine(),
            "cpu_count": os.cpu_count(), "load_average": list(os.getloadavg()),
            "available_memory_mb": memory, "free_disk_bytes": shutil.disk_usage(Path.cwd()).free,
            "runs": runs, "fleet_requests": requests}


def execute(host, arguments, *, content=None, cwd=None):
    argv = [host["porch"], *arguments]
    if host["transport"] == "ssh":
        command = shlex.join(argv)
        if cwd:
            command = "cd -- " + shlex.quote(cwd) + " && " + command
        argv = ["ssh", "-o", "BatchMode=yes", "--", host["address"], command]
        cwd = None
    return subprocess.run(argv, cwd=cwd, input=content, text=True, capture_output=True,
                          timeout=host["request_timeout_seconds"])


def inspect(host):
    try:
        result = execute(host, ["fleet", "probe"])
        if result.returncode:
            return {"available": False, "reason": "probe_failed", "exit_code": result.returncode}
        value = json.loads(result.stdout)
        if value.get("available") is not True or not isinstance(value.get("runs"), dict):
            raise ValueError("invalid probe response")
        if any(not isinstance(k, str) or not isinstance(v, str) for k, v in value["runs"].items()):
            raise ValueError("invalid run states")
        memory = value.get("available_memory_mb")
        if memory is not None and (type(memory) is not int or memory < 0):
            raise ValueError("invalid available memory")
        return value
    except (OSError, subprocess.TimeoutExpired, ValueError, TypeError, AttributeError):
        return {"available": False, "reason": "probe_unavailable"}
