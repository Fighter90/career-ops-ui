#!/bin/bash
# Per-run artifact layout for pragmatic-orchestration.
#
# Layout:
#   $PORCH_RUN_DIR/
#     meta.json
#     raw/<key>.jsonl          # backend raw stdout (structured when available)
#     normalized/<key>.jsonl   # normalized semantic events
#     final/<key>.txt          # final text answer per invocation
#     final.txt                # primary final answer (single-agent or combined)
#
# Keys identify the *invocation*, not only the agent id:
#   - ask / delegate: plain agent id (e.g. "grok") — one shot per agent
#   - code review (basic/specialists): "agent.role" (e.g. "codex.security")
#   - multi-stage discovery (super/ultra): explicit fan-out keys of the form
#     "<stage>.<index>.<agent>.<role>" passed via --artifact-key
#   - judge attempts: "judge.primary.<agent>" / "judge.fallback.<agent>"
# Fan-out layers always pass an explicit key. discovery-pass / judge-runner
# never rely on an ambient inherited PORCH_ARTIFACT_KEY alone — if called
# without --artifact-key they choose an invocation-unique default.
# backend_run uses PORCH_ARTIFACT_KEY when set, else agent id.
#
# Env:
#   PORCH_OUTPUT_DIR  — parent for auto run dirs (default: ${TMPDIR}/pragmatic-orchestration-outputs)
#   PORCH_RUN_DIR     — if set, use this directory (created if missing)
#   PORCH_SAVE_OUTPUTS — set 0 to disable (no-op helpers)
#   PORCH_ARTIFACT_KEY — per-invocation key set by fan-out callers (see backend_run.sh)

artifacts_init_run() {
    local mode="${1:-unknown}"
    if [[ "${PORCH_SAVE_OUTPUTS:-1}" == "0" ]]; then
        PORCH_RUN_DIR=""
        export PORCH_RUN_DIR
        return 0
    fi
    if [[ -z "${PORCH_RUN_DIR:-}" ]]; then
        local parent="${PORCH_OUTPUT_DIR:-${TMPDIR:-/tmp}/pragmatic-orchestration-outputs}"
        mkdir -p "$parent"
        # Human-readable run dir (run-ask-amber-otter-4f21): the path is quoted
        # back to the caller in progress output and referenced later by hand, so
        # word pairs beat mktemp's random suffix. mkdir (not mktemp) is the
        # collision check — it fails if the name is taken, and we retry.
        PORCH_RUN_DIR=""
        local _lib_dir _candidate _try
        _lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        for _try in 1 2 3; do
            _candidate="$(python3 "$_lib_dir/human_id.py" "${parent%/}/run-${mode}-" 2>/dev/null)" || _candidate=""
            [[ -n "$_candidate" ]] || break
            if mkdir -m 700 "$_candidate" 2>/dev/null; then
                PORCH_RUN_DIR="$_candidate"
                break
            fi
        done
        if [[ -z "$PORCH_RUN_DIR" ]]; then
            # Word list unavailable or three collisions in a row — never fail a
            # review over a directory name.
            PORCH_RUN_DIR="$(mktemp -d "${parent%/}/run-${mode}.XXXXXX")"
        fi
    else
        mkdir -p "$PORCH_RUN_DIR"
    fi
    mkdir -p "$PORCH_RUN_DIR/raw" "$PORCH_RUN_DIR/normalized" "$PORCH_RUN_DIR/final"
    export PORCH_RUN_DIR
    python3 -c '
import json, os, time
path = os.path.join(os.environ["PORCH_RUN_DIR"], "meta.json")
meta = {
    "mode": os.environ.get("PORCH_MODE", ""),
    "cwd": os.getcwd(),
    "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "pid": os.getpid(),
}
with open(path, "w") as f:
    json.dump(meta, f, indent=2)
    f.write("\n")
' 2>/dev/null || true
    if declare -F progress_info >/dev/null 2>&1; then
        progress_info "artifacts" "run_dir=$PORCH_RUN_DIR"
    fi
}

artifacts_paths_for() {
    # Sets: ART_RAW ART_NORM ART_FINAL for invocation key $1
    # Key is agent id, agent.role, or a fan-out key (stage.index.agent.role / judge.*).
    local key="$1"
    local safe
    safe="$(printf '%s' "$key" | LC_ALL=C tr -c 'A-Za-z0-9._-' '_')"
    if [[ -z "${PORCH_RUN_DIR:-}" || "${PORCH_SAVE_OUTPUTS:-1}" == "0" ]]; then
        ART_RAW=""
        ART_NORM=""
        ART_FINAL=""
        return 0
    fi
    mkdir -p "$PORCH_RUN_DIR/raw" "$PORCH_RUN_DIR/normalized" "$PORCH_RUN_DIR/final"
    ART_RAW="$PORCH_RUN_DIR/raw/${safe}.jsonl"
    ART_NORM="$PORCH_RUN_DIR/normalized/${safe}.jsonl"
    ART_FINAL="$PORCH_RUN_DIR/final/${safe}.txt"
}

artifacts_write_final() {
    local key="$1"
    local text_file="$2"
    artifacts_paths_for "$key"
    if [[ -n "$ART_FINAL" && -f "$text_file" ]]; then
        cp "$text_file" "$ART_FINAL"
        # Primary final.txt = last successful single-agent answer, or first write
        if [[ ! -f "$PORCH_RUN_DIR/final.txt" ]]; then
            cp "$text_file" "$PORCH_RUN_DIR/final.txt"
        else
            # For multi-agent, overwrite with combined marker only if single-agent mode
            if [[ "${PORCH_SINGLE_AGENT:-}" == "1" ]]; then
                cp "$text_file" "$PORCH_RUN_DIR/final.txt"
            fi
        fi
    fi
}

artifacts_set_primary_final() {
    local text_file="$1"
    [[ -n "${PORCH_RUN_DIR:-}" && -f "$text_file" ]] || return 0
    cp "$text_file" "$PORCH_RUN_DIR/final.txt"
}
