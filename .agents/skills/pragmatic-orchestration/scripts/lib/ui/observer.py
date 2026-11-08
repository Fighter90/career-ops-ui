"""Projection of existing runs. No mailbox, provider, process, or registry writes."""
from pathlib import Path
import re

from steer.registry import Registry, TERMINAL_STATUSES
from .artifacts import ObservationError, read_events, read_final

RUN_FIELDS = ("run_id", "agent_id", "backend", "model", "effort", "cwd", "status",
              "effective_status", "started_at", "updated_at", "finished_at",
              "exit_code", "error", "unreadable", "continued_from", "launcher",
              "launcher_source", "launcher_instance", "turn_count", "native_session_id")


class Observer:
    def __init__(self, registry: Registry):
        self.registry = registry

    def runs(self):
        records = self.registry.list_runs()
        # started_at has one-second precision; preserve the actual launch order
        # when the same agent creates several runs within that second.
        records.sort(key=lambda m: (str(m.get("started_at") or ""),
                                    str(m.get("created_at_ns") or "")), reverse=True)
        # Keep active and problematic runs visible even with extensive history.
        records.sort(key=lambda m: m.get("status") in TERMINAL_STATUSES)
        return {"runs": [{k: m[k] for k in RUN_FIELDS if k in m} for m in records[:1000]],
                "total": len(records), "registry": str(self.registry.root)}

    def meta(self, run_id):
        # Unlike Registry.run_path, an observer must not create a missing root.
        if not self.registry.runs_dir.is_dir():
            raise ObservationError("Registry is not available")
        return self.registry.load_meta(run_id)

    def artifact_paths(self, run_id, kind):
        meta = self.meta(run_id)
        agent = str(meta.get("agent_id") or "")
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", agent):
            raise ObservationError("Invalid artifact agent id")
        base = Path(str(meta.get("artifacts_dir") or ""))
        if not base.is_absolute() or base.is_symlink():
            raise ObservationError("Artifact directory must be an absolute, non-symlink path")
        if kind == "events":
            return [base / "normalized" / f"{agent}.jsonl"]
        return [self.registry.run_path(run_id) / "final.txt", base / "final.txt",
                base / "final" / f"{agent}.txt"]

    def events(self, run_id, cursor):
        return read_events(self.artifact_paths(run_id, "events")[0], cursor)

    def final(self, run_id):
        return read_final(self.artifact_paths(run_id, "final"))
