"""Launcher provenance: never infer the caller from the worker's profile."""
from hashlib import sha256
from typing import Mapping

BACKEND_LAUNCHERS = {
    "codex-cli": "codex", "claude-code": "claude", "opencode": "opencode",
    "grok-build": "grok", "devin-cli": "devin",
}
KNOWN_LAUNCHERS = frozenset({*BACKEND_LAUNCHERS.values(), "gemini", "cursor", "terminal", "unknown"})


def launcher_metadata(env: Mapping[str, str]) -> dict:
    explicit = env.get("PORCH_LAUNCHER", "").strip().lower()
    if explicit:
        if explicit not in KNOWN_LAUNCHERS:
            raise ValueError("PORCH_LAUNCHER must be one of: " + ", ".join(sorted(KNOWN_LAUNCHERS)))
        return _with_instance({"launcher": explicit, "launcher_source": "explicit"}, env)
    candidates = set()
    if env.get("CODEX_THREAD_ID"):
        candidates.add("codex")
    if env.get("CLAUDECODE") == "1" or env.get("CLAUDE_CODE_SESSION_ID"):
        candidates.add("claude")
    # Nested external harnesses can retain both sets of markers. Do not guess.
    if len(candidates) == 1:
        return _with_instance({"launcher": candidates.pop(), "launcher_source": "environment"}, env)
    return {"launcher": "unknown", "launcher_source": "ambiguous" if candidates else "unavailable"}


def _with_instance(metadata: dict, env: Mapping[str, str]) -> dict:
    launcher = metadata["launcher"]
    parent_run = env.get("PORCH_LAUNCHER_RUN_ID", "")
    if parent_run and launcher in BACKEND_LAUNCHERS.values():
        metadata["launcher_instance"] = f"run:{parent_run}"
        return metadata
    session = (env.get("CODEX_THREAD_ID", "") if launcher == "codex" else
               env.get("CLAUDE_CODE_SESSION_ID", "") if launcher == "claude" else "")
    if session:
        # Keep the session identifier out of registry files and launch URLs.
        digest = sha256(f"porch-launcher:{launcher}:{session}".encode()).hexdigest()
        metadata["launcher_instance"] = f"{launcher}:{digest[:32]}"
    return metadata
