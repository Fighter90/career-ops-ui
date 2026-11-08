"""Explicit, private fleet configuration; no inferred hosts or capacity defaults."""
import json
import re
import posixpath
from pathlib import Path


def load(path):
    config = json.loads(Path(path).expanduser().read_text())
    if not isinstance(config, dict) or config.get("version") != 1:
        raise ValueError("fleet config requires version 1")
    if not isinstance(config.get("state_path"), str) or not Path(config["state_path"]).is_absolute():
        raise ValueError("state_path must be an absolute coordinator-local path")
    hosts = config.get("hosts")
    if not isinstance(hosts, list) or not hosts:
        raise ValueError("configure at least one host")
    ids = set()
    endpoints = set()
    for host in hosts:
        if not isinstance(host, dict):
            raise ValueError("each host must be an object")
        name = host.get("id", "")
        if not isinstance(name, str) or not re.fullmatch(r"[a-zA-Z0-9_-]+", name) or name in ids:
            raise ValueError("host ids must be unique letters/digits/underscores/hyphens")
        ids.add(name)
        if type(host.get("automatic", True)) is not bool:
            raise ValueError("automatic must be true or false")
        if host.get("transport") not in {"local", "ssh"}:
            raise ValueError("only existing local/ssh hosts are implemented")
        if not isinstance(host.get("porch"), str) or not host["porch"].startswith("/"):
            raise ValueError("each host requires an absolute porch path")
        if host["transport"] == "ssh" and (not isinstance(host.get("address"), str) or
                not re.fullmatch(r"[a-zA-Z0-9_.@:-]+", host["address"]) or host["address"].startswith("-")):
            raise ValueError("ssh host requires a configured address/alias")
        endpoint = (host["transport"], host.get("address") if host["transport"] == "ssh" else None)
        if endpoint in endpoints:
            raise ValueError("each physical host must have one fleet entry")
        endpoints.add(endpoint)
        for field in ("capacity", "request_timeout_seconds"):
            if type(host.get(field)) is not int or host[field] <= 0:
                raise ValueError(f"{field} must be an explicitly configured positive integer")
        if not isinstance(host.get("agents"), list) or not host["agents"] or any(
                not isinstance(a, str) or not re.fullmatch(r"[a-zA-Z0-9_.-]+", a) for a in host["agents"]):
            raise ValueError("host requires exact agent profile names")
        if not isinstance(host.get("workspaces"), dict) or any(
                not isinstance(p, str) or not p.startswith("/") for p in host["workspaces"].values()):
            raise ValueError("workspaces must map names to absolute prepared directories")
        for key, path in host["workspaces"].items():
            host["workspaces"][key] = posixpath.normpath(path)
        if len(set(host["workspaces"].values())) != len(host["workspaces"]):
            raise ValueError("workspace names must refer to distinct canonical paths")
        memory = host.get("min_available_memory_mb")
        if memory is not None and (type(memory) is not int or memory < 0):
            raise ValueError("min_available_memory_mb must be nonnegative")
    return config
