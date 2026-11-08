"""Seed isolated desktop acceptance fixtures through the real registry API."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "lib"))
from steer.registry import Registry
from steer.launcher import launcher_metadata

root = Path(sys.argv[1])
worker_pid = int(sys.argv[2])
reg = Registry(root / "registry")
records = [
    ("codex", "codex-cli", "gpt-test", "inspect-streaming", "running"),
    ("claude", "claude-code", "claude-test", "review-event-contract", "completed"),
    ("grok", "grok-build", "grok-test", "check-reconnection", "failed"),
    ("codex", "codex-cli", "gpt-test", "old-supervisor", "running"),
    ("claude", "claude-code", "claude-test", "other-session-worker", "running"),
    ("grok", "grok-build", "grok-test", "latest-session-worker", "running"),
]
for index, (agent, backend, model, name, status) in enumerate(records):
    if index in (0, 2, 4, 5):
        launch = launcher_metadata({"PORCH_LAUNCHER": "claude",
                                    "CLAUDE_CODE_SESSION_ID": "fixture-current" if index in (0, 5) else "fixture-other"})
    elif index == 1:
        launch = launcher_metadata({"PORCH_LAUNCHER": "codex",
                                    "CODEX_THREAD_ID": "fixture-codex"})
    else:
        launch = {}
    artifacts = root / name
    normalized = artifacts / "normalized"
    normalized.mkdir(parents=True)
    rid = reg.create_run(agent_id=agent, backend=backend, model=model,
                         cwd="/projects/another/porch" if index == 1 else "/projects/porch", artifacts_dir=str(artifacts),
                         run_name=name, extra={"effort": "high", "created_at_ns": f"{1_000_000_000_000_000_000 + index}", **launch})
    reg.update_meta(rid, status=status, pid=0 if index == 3 else worker_pid,
                    error="Fixture: provider disconnected" if index == 2 else None,
                    **({"turn_count": 4, "native_session_id": "thread-fixture-codex"} if index == 0 else {}),
                    **({"turn_count": 1, "native_session_id": "session-fixture-claude"} if index == 1 else {}))
    events = [
        {"type": "run_started", "data": "Connected to the existing run.", "ts": "2026-09-23T09:30:00Z"},
        {"type": "thinking_delta", "data": "Check the cursor contract before changing the transport. Reads should remain independent of the worker lifecycle."},
        {"type": "tool_started", "tool_name": "read_file", "data": "scripts/lib/steer/registry.py"},
        {"type": "tool_completed", "tool_name": "read_file", "data": "Registry stores lifecycle independently from output artifacts."},
        {"type": "answer_delta", "data": "The observer can attach to runs that are already in progress.\n\nI’m checking three boundaries:\n  1. Complete events arrive without losing text.\n  2. Closing this window leaves the worker alive.\n  3. Reopening restores output from the journal.\n\nThe runtime remains the source of truth."},
    ]
    (normalized / f"{agent}.jsonl").write_text("".join(json.dumps(e) + "\n" for e in events))
    if index == 1:
        (artifacts / "final.txt").write_text("The event contract is consistent.\n\nVerified cursor continuation, partial writes, and read-only discovery.")

print(json.dumps({"run_id": "run_codex-inspect-streaming", "journal": str(root / "inspect-streaming" / "normalized" / "codex.jsonl")}))
