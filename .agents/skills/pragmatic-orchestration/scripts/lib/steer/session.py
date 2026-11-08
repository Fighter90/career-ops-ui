"""Opt-in Codex conversation continuation, serialized across linked runs.

A failed/uncertain turn is never replayed. Explicit recovery sends a new prompt
after cleanup. The handle and latest-run claim are written before contacting the
provider, so even a failed resume leaves an inspectable, recoverable claimant.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

from .registry import Registry, RegistryError
from .util import atomic_write_json, read_json, open_lock_fd, lock_exclusive


class SessionLease:
    def __init__(self, registry: Registry, run_id: str, source: str = "", *, recover_session: bool = False):
        self.registry = registry
        self.run_id = run_id
        self.source = source
        self.recover_session = recover_session
        self.handle: Dict[str, Any] = {}
        self._fd = None

    def acquire(self) -> None:
        if self.recover_session and not self.source:
            raise RegistryError("--recover-session requires --continue-run")
        current = self.registry.load_meta(self.run_id)
        anchor = self.run_id
        if self.source:
            previous = self.registry.load_meta(self.source)
            if self.recover_session:
                if previous.get("status") not in ("completed", "failed", "cancelled"):
                    raise RegistryError("recovery requires a terminal run; use steer/cancel for active work")
                if previous.get("cleanup_status") != "completed":
                    raise RegistryError("recovery requires completed backend cleanup; inspect and reconcile the old writer first")
            elif previous.get("status") != "completed" or previous.get("exit_code") != 0:
                raise RegistryError("continue requires a successful completed run; previous outcome may be unknown; inspect task effects, then use --recover-session with a new remaining-work instruction")
            handle = previous.get("session_handle")
            if not isinstance(handle, dict) or handle.get("backend") != "codex-cli" or not handle.get("thread_id"):
                raise RegistryError("run has no durable Codex session; start with --persist-session")
            self.handle = dict(handle)
            anchor = handle.get("anchor_run_id")
            if not isinstance(anchor, str) or not anchor:
                raise RegistryError("invalid session anchor")
            self.registry.load_meta(anchor)  # validates existence and ownership
            for field in ("agent_id", "backend", "model", "effort", "backend_binary"):
                if previous.get(field) != current.get(field):
                    raise RegistryError(f"continue requires unchanged {field}")
            if Path(previous["cwd"]).resolve() != Path(current["cwd"]).resolve():
                raise RegistryError("continue requires the original working directory")
        anchor_dir = self.registry.run_path(anchor)
        lock_path = anchor_dir / "control" / "session.lock"
        self._fd = open_lock_fd(lock_path)
        try:
            lock_exclusive(self._fd, blocking=False)
            state_path = anchor_dir / "session.json"
            if self.source:
                if not state_path.is_file():
                    raise RegistryError("session coordination state is missing; cannot safely continue after registry loss")
                state = read_json(state_path)
                if not isinstance(state, dict) or state.get("latest_run_id") != self.source:
                    raise RegistryError(f"source is not the latest session run; inspect successor {state.get('latest_run_id') if isinstance(state, dict) else 'unknown'} before continuing")
            self.handle.update(backend="codex-cli", anchor_run_id=anchor)
            if self.source:
                # Save before claiming: a crash or native resume failure must not
                # strand the latest claimant without its existing thread handle.
                self.registry.update_meta(self.run_id, session_handle=dict(self.handle))
            atomic_write_json(state_path, {"latest_run_id": self.run_id})
        except BlockingIOError as e:
            self.close()
            raise RegistryError("session is already in use; no instruction was sent") from e
        except Exception:
            self.close()
            raise

    def close(self) -> None:
        if self._fd is not None:
            os.close(self._fd)
            self._fd = None
