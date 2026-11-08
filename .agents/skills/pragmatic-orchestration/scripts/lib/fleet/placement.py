"""Pure placement: unknown observations are never spare capacity."""
from __future__ import annotations

TERMINAL = frozenset({"completed", "failed", "cancelled"})


def choose(hosts, observations, allocations, request):
    reasons = {}
    for host in hosts:
        name = host["id"]
        if request.get("host") and request["host"] != name:
            continue
        if not request.get("host") and not host.get("automatic", True):
            reasons[name] = "explicit_selection_only"
            continue
        observation = observations.get(name, {})
        reason = ""
        if not observation.get("available"):
            reason = "observation_unavailable"
        elif request["agent"] not in host["agents"]:
            reason = "agent_not_configured"
        elif request["workspace"] not in host["workspaces"]:
            reason = "workspace_not_configured"
        else:
            # A known run counts once; unacknowledged launches still reserve units.
            runs = observation["runs"]
            active = {r for r, status in runs.items() if status not in TERMINAL}
            claimed = [a for a in allocations if a["host"] == name and a["state"] not in TERMINAL
                       and runs.get(a.get("run_id")) not in TERMINAL]
            accounted = {a.get("run_id") for a in claimed}
            used = sum(a["units"] for a in claimed) + len(active - accounted)
            workspace = host["workspaces"][request["workspace"]]
            if any(a.get("workspace_path") == workspace for a in claimed):
                reason = "workspace_reserved"
            elif used + request["units"] > host["capacity"]:
                reason = "capacity_reserved"
            elif host.get("min_available_memory_mb") is not None and (
                observation.get("available_memory_mb") is None or
                observation["available_memory_mb"] < host["min_available_memory_mb"]
            ):
                reason = "memory_unavailable"
            else:
                return name, reasons
        reasons[name] = reason
    return None, reasons
