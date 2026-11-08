"""Single-coordinator durable claims. No time-based automatic claim expiry."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .placement import TERMINAL, choose


class Store:
    def __init__(self, path):
        path = Path(path)
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, timeout=30, isolation_level=None)
        path.chmod(0o600)
        self.db.execute("""CREATE TABLE IF NOT EXISTS requests (
            id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, host TEXT NOT NULL,
            units INTEGER NOT NULL, state TEXT NOT NULL, run_id TEXT,
            workspace_path TEXT NOT NULL, binding TEXT NOT NULL)""")
        self.db.row_factory = sqlite3.Row

    def close(self):
        self.db.close()

    @contextmanager
    def transaction(self):
        self.db.execute("BEGIN IMMEDIATE")
        try:
            yield
            self.db.execute("COMMIT")
        except BaseException:
            self.db.execute("ROLLBACK")
            raise

    def rows(self):
        return [dict(row) for row in self.db.execute("SELECT * FROM requests ORDER BY rowid")]

    def get(self, identity):
        row = self.db.execute("SELECT * FROM requests WHERE id = ?", (identity,)).fetchone()
        return dict(row) if row else None

    def claim(self, identity, fingerprint, hosts, observations, request):
        with self.transaction():
            old = self.get(identity)
            if old:
                if old["fingerprint"] != fingerprint:
                    raise ValueError("request id already belongs to a different task")
                return old, False
            # Only a positively observed terminal run releases an allocation.
            for allocation in self.rows():
                obs = observations.get(allocation["host"], {})
                state = obs.get("runs", {}).get(allocation["run_id"])
                if obs.get("available") and state in TERMINAL:
                    self.db.execute("UPDATE requests SET state = ? WHERE id = ?", (state, allocation["id"]))
            host, reasons = choose(hosts, observations, self.rows(), request)
            if host is None:
                raise ValueError("no eligible capacity: " + json.dumps(reasons, sort_keys=True))
            # Persist uncertainty BEFORE any launch I/O. A crashed caller never retries it.
            selected = next(h for h in hosts if h["id"] == host)
            binding = {key: selected.get(key) for key in ("transport", "porch", "address")}
            self.db.execute("INSERT INTO requests VALUES (?, ?, ?, ?, 'unknown', NULL, ?, ?)",
                            (identity, fingerprint, host, request["units"],
                             selected["workspaces"][request["workspace"]], json.dumps(binding, sort_keys=True)))
            return self.get(identity), True

    def launched(self, identity, run_id):
        self.db.execute("UPDATE requests SET state = 'running', run_id = ? WHERE id = ?",
                        (run_id, identity))
        return self.get(identity)

    def reconcile(self, identity, observation):
        with self.transaction():
            row = self.get(identity)
            if row is None:
                raise ValueError("unknown request")
            if not observation.get("available"):
                return row
            matches = [r for r in observation.get("fleet_requests", [])
                       if r.get("id") == identity and r.get("fingerprint") == row["fingerprint"]
                       and r.get("workspace_path") == row["workspace_path"]]
            if len(matches) > 1:
                raise ValueError("multiple runs claim this request; inspect host before proceeding")
            if not row["run_id"] and matches:
                self.launched(identity, matches[0]["run_id"])
                row = self.get(identity)
            state = observation.get("runs", {}).get(row["run_id"])
            if state in TERMINAL:
                self.db.execute("UPDATE requests SET state = ? WHERE id = ?", (state, identity))
            return self.get(identity)
