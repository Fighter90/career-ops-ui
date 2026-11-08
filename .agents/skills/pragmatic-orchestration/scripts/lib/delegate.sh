#!/bin/bash
#
# delegate — full-YOLO single-agent task execution in the caller's CWD.
# Invoked by: scripts/porch delegate -a <exact-agent-id> ...
#             scripts/porch delegate --one-shot -a <id> ...
#             scripts/porch delegate steer|status|cancel|events ...
#
# No sandbox, no approval prompts, no extra confirmation flag.
# Exact agent id only — no globs, no defaults.
#
set -euo pipefail

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$LIB_DIR/common.sh"
# shellcheck source=config.sh
source "$LIB_DIR/config.sh"
# shellcheck source=progress.sh
source "$LIB_DIR/progress.sh"
# shellcheck source=artifacts.sh
source "$LIB_DIR/artifacts.sh"

STEER_PY="$LIB_DIR/steer"
export PYTHONPATH="${LIB_DIR}${PYTHONPATH:+:$PYTHONPATH}"

# Control subcommands. A case is required rather than a run-id-shaped test:
# `list` takes no run id. There is no ambiguity with a start invocation —
# starting always requires -a <agent-id>, so an agent id never lands here.
case "${1:-}" in
    steer|status|cancel|wait|wait-any|watch|events|list)
        sub="$1"
        shift
        exec python3 -m steer.control "$sub" "$@"
        ;;
esac

AGENT_ID=""
PROMPT=""
PROMPT_FILE=""
PROMPT_SOURCE=""  # positional | file | stdin
STEERABLE=1
LAUNCH_MODE="default"
DETACH=0
PERSIST_SESSION=0
CONTINUE_RUN=""
RECOVER_SESSION=0
RUN_NAME=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -a|--agent|--agents)
            shift
            if [[ -z "${1:-}" ]]; then
                echo "Error: -a requires an exact agent id" >&2
                exit $EXIT_USAGE
            fi
            # Reject globs and commas — exact id only
            if [[ "$1" == *'*'* || "$1" == *'?'* || "$1" == *','* || "$1" == *'['* ]]; then
                echo "Error: delegate requires an exact agent id (no globs/lists). Got: $1" >&2
                exit $EXIT_USAGE
            fi
            if [[ -n "$AGENT_ID" ]]; then
                echo "Error: delegate accepts exactly one -a <agent-id>" >&2
                exit $EXIT_USAGE
            fi
            AGENT_ID="$1"
            shift
            ;;
        --steerable)
            if [[ "$LAUNCH_MODE" == "one-shot" ]]; then
                echo "Error: --steerable and --one-shot are mutually exclusive" >&2
                exit $EXIT_USAGE
            fi
            STEERABLE=1
            LAUNCH_MODE="steerable"
            shift
            ;;
        --one-shot)
            if [[ "$LAUNCH_MODE" == "steerable" ]]; then
                echo "Error: --steerable and --one-shot are mutually exclusive" >&2
                exit $EXIT_USAGE
            fi
            STEERABLE=0
            LAUNCH_MODE="one-shot"
            shift
            ;;
        --persist-session)
            PERSIST_SESSION=1
            shift
            ;;
        --continue-run)
            shift
            [[ -n "${1:-}" ]] || { echo "Error: --continue-run requires RUN_ID" >&2; exit $EXIT_USAGE; }
            CONTINUE_RUN="$1"
            PERSIST_SESSION=1
            shift
            ;;
        --recover-session)
            RECOVER_SESSION=1
            shift
            ;;
        --detach)
            DETACH=1
            shift
            ;;
        --prompt-file)
            [[ $# -ge 2 && -n "$2" ]] || { echo "Error: --prompt-file requires a path" >&2; exit $EXIT_USAGE; }
            PROMPT_FILE="$2"; PROMPT_SOURCE="file"; shift 2
            ;;
        --name)
            shift
            [[ -n "${1:-}" ]] || { echo "Error: --name requires a slug" >&2; exit $EXIT_USAGE; }
            RUN_NAME="$1"
            shift
            ;;
        -h|--help)
            cat <<'EOF'
Usage:
  porch delegate -a <exact-agent-id> [--name <slug>] ["task"]
  porch delegate -a <exact-agent-id> --one-shot ["task"]
  porch delegate -a <exact-agent-id> --detach ["task"]
  porch delegate -a <codex-profile> --persist-session [--detach] "task"
  porch delegate -a <codex-profile> --continue-run RUN_ID [--detach] "follow-up"
  porch delegate steer RUN_ID [--mode auto|queue|interrupt] [--prompt-file FILE] "guidance"
  porch delegate status RUN_ID [--json]
  porch delegate cancel RUN_ID
  porch delegate wait RUN_ID [--timeout SEC] [--json] [--quiet]
  porch delegate wait-any RUN_ID [RUN_ID ...] [--acknowledged RUN_ID] [--timeout SEC]
  porch delegate watch RUN_ID [--heartbeat SEC] [--json]
  porch delegate events RUN_ID [--cursor N] [--max-events N]
  porch delegate list [--active|--all] [--reap] [--json]

Full-YOLO delegation to exactly one agent in the current working directory.
No sandbox, no approval prompts. Gemini is not supported (review-only).

Delegate starts a long-lived steerable supervisor by default, with a filesystem
mailbox for steer / status / cancel. --one-shot selects the legacy direct run.

--detach keeps the default steerable mode, prints run_id on stdout, and returns immediately.
The supervisor becomes its own session leader, so the run survives the caller
exiting. Collect the answer later with `delegate wait RUN_ID`.

wait prints the full final answer. --timeout SEC bounds observation only (exit
124 while still active); 0 is a snapshot. Without --timeout wait remains unbounded.
wait-any emits JSON with ready run ids, all supplied statuses and elapsed seconds,
and up to five recent events per run. Keep the whole session group in the call;
repeat --acknowledged RUN_ID for collected terminal runs to retain their status
without waking again. Group membership is supplied explicitly by the caller.
It exits 0 when any target is terminal (inspect each run's exit_code), or 124 at
its observation deadline. Collect finals with wait; acknowledge consumed ids
before waiting again. Neither observer cancels workers.

--persist-session opts into durable Codex context. --continue-run RUN_ID sends
only a new instruction in that session, as a new linked run. It requires the
latest successful run, the same CWD/profile/model/effort/binary, and exclusive
session access. Failed or unknown outcomes are never replayed automatically.
After inspecting effects, add --recover-session to continue a failed/cancelled
durable run with a new instruction. Backend cleanup must be completed first.
Exit: 0 completed, 130 cancelled, 70 supervisor died, 74 completed but no
answer text, otherwise the agent's own failure code.

watch streams lifecycle changes and heartbeats, not tool/file/text progress,
and exits with the same codes. Use wait to print the final answer.
events returns one bounded JSON page of normalized progress and exits. Pass its
next_cursor back as --cursor to retrieve only later events.
list finds runs again when the run id was lost.

Options:
  -a, --agent <id>       Exact agent id from config.json (required for start)
  --name <slug>          Semantic run id suffix → run_<agent>-<slug>; derive a
                         short kebab-case slug from the task (steerable only)
  --steerable            Explicit alias for the default steerable session
  --one-shot             Direct non-steerable run
  --detach               Start the steerable session detached; print run_id and exit
  --persist-session      Preserve native Codex conversation after completion
  --continue-run RUN_ID   Continue the latest successful durable Codex run
  --recover-session      Allow --continue-run after failure/cancellation; inspect effects first
  --prompt-file <path>   Task / guidance from file
  -h, --help
EOF
            exit $EXIT_OK
            ;;
        --) shift; PROMPT="${1:-}"; PROMPT_SOURCE="positional"; break ;;
        -*) echo "Error: unknown flag: $1" >&2; exit $EXIT_USAGE ;;
        *)  PROMPT="$1"; PROMPT_SOURCE="positional"; shift; break ;;
    esac
done

if [[ -z "$AGENT_ID" ]]; then
    echo "Error: delegate requires -a <exact-agent-id> (no default agent)" >&2
    exit $EXIT_USAGE
fi

# A detached run requires the steerable registry and cannot use the direct
# one-shot path.
if [[ "$DETACH" -eq 1 && "$STEERABLE" -ne 1 ]]; then
    echo "Error: --detach and --one-shot are mutually exclusive" >&2
    exit $EXIT_USAGE
fi

# --name only exists to shape the steerable run id; a one-shot run has none.
if [[ -n "$RUN_NAME" && "$STEERABLE" -ne 1 ]]; then
    echo "Error: --name requires the default steerable mode (no run id with --one-shot)" >&2
    exit $EXIT_USAGE
fi

# Normalize every task source into one private temp file exactly once. This
# supports regular files, FIFOs, and pseudo-files such as /dev/stdin without a
# second read/cp (macOS fcopyfile rejects copying /dev/fd-backed stdin). It also
# preserves trailing newlines and keeps large bodies out of argv and env.
_del_prompt_tmp="$(mktemp "${TMPDIR:-/tmp}/porch-delegate-task.XXXXXX")"
chmod 600 "$_del_prompt_tmp"
cleanup_delegate_prompt() { rm -f "$_del_prompt_tmp"; }
trap cleanup_delegate_prompt EXIT

if [[ -n "$PROMPT_FILE" ]]; then
    [[ "$PROMPT_SOURCE" != "positional" ]] || { echo "Error: cannot combine --prompt-file with a positional prompt" >&2; exit $EXIT_USAGE; }
    [[ -r "$PROMPT_FILE" ]] || { echo "Error: prompt source not readable: $PROMPT_FILE" >&2; exit $EXIT_USAGE; }
    if ! cat < "$PROMPT_FILE" > "$_del_prompt_tmp"; then
        echo "Error: failed to read prompt source: $PROMPT_FILE" >&2
        exit $EXIT_USAGE
    fi
elif [[ "$PROMPT_SOURCE" == "positional" ]]; then
    printf '%s' "$PROMPT" > "$_del_prompt_tmp"
elif [[ ! -t 0 ]]; then
    cat > "$_del_prompt_tmp"
fi

if [[ ! -s "$_del_prompt_tmp" ]] || ! LC_ALL=C grep -q '[^[:space:]]' "$_del_prompt_tmp"; then
    echo "Error: no task prompt provided" >&2
    exit $EXIT_USAGE
fi

config_validate || exit $EXIT_CONFIG_ERROR

# Exact id must exist
if ! BACKEND="$(config_get_field "$AGENT_ID" backend 2>/dev/null)"; then
    echo "Error: unknown agent id: $AGENT_ID" >&2
    exit $EXIT_CONFIG_ERROR
fi

# Reject review-only agents before creating artifacts or entering the Python
# supervisor. backend_run.sh repeats this as defense in depth for direct calls.
SUPPORTS_DELEGATE="$(config_get_field "$AGENT_ID" supports_delegate 2>/dev/null || true)"
if [[ "$BACKEND" == "gemini-cli" || "$SUPPORTS_DELEGATE" == "false" || "$SUPPORTS_DELEGATE" == "0" ]]; then
    echo "Error: agent '$AGENT_ID' is review-only (supports_delegate=false)" >&2
    exit $EXIT_CONFIG_ERROR
fi

if [[ "$RECOVER_SESSION" -eq 1 && -z "$CONTINUE_RUN" ]]; then
    echo "Error: --recover-session requires --continue-run" >&2
    exit $EXIT_USAGE
fi

if [[ "$PERSIST_SESSION" -eq 1 && ( "$STEERABLE" -ne 1 || "$BACKEND" != "codex-cli" ) ]]; then
    echo "Error: --persist-session / --continue-run require steerable Codex" >&2
    exit $EXIT_USAGE
fi

export PORCH_MODE="delegate"
export PORCH_SINGLE_AGENT=1
artifacts_init_run "delegate"
if [[ "$STEERABLE" -eq 1 ]]; then
    progress_stage "delegate" "agent=$AGENT_ID cwd=$(pwd) steerable=1"
else
    progress_stage "delegate" "agent=$AGENT_ID cwd=$(pwd) one_shot=1"
fi

# Delegate sends the task as-is (no porch review principles wrap that forbids writes)
export PORCH_RAW_PROMPT=1

if [[ "$STEERABLE" -eq 1 ]]; then
    # Large prompts reach the supervisor through the normalized file only.
    # Protocol artifacts: use PORCH_RUN_DIR only when ordinary archival is on.
    # With PORCH_SAVE_OUTPUTS=0, artifacts_init_run clears RUN_DIR — never fall
    # back to project cwd (".") because that would write ./raw ./final.txt into the
    # user's tree. Empty artifacts-dir tells the supervisor to place protocol
    # artifacts under the private 0700 registry run dir (meta records the path).
    ART=""
    if [[ "${PORCH_SAVE_OUTPUTS:-1}" != "0" && -n "${PORCH_RUN_DIR:-}" ]]; then
        ART="$PORCH_RUN_DIR"
    fi
    REG_ARGS=()
    if [[ "$PERSIST_SESSION" -eq 1 ]]; then
        REG_ARGS+=(--persist-session)
    fi
    if [[ -n "$RUN_NAME" ]]; then
        REG_ARGS+=(--run-name "$RUN_NAME")
    fi
    if [[ -n "$CONTINUE_RUN" ]]; then
        REG_ARGS+=(--continue-run "$CONTINUE_RUN")
    fi
    if [[ "$RECOVER_SESSION" -eq 1 ]]; then
        REG_ARGS+=(--recover-session)
    fi
    if [[ -n "${PORCH_STEER_DIR:-}" ]]; then
        REG_ARGS+=(--registry-root "$PORCH_STEER_DIR")
    fi
    if [[ "$DETACH" -eq 1 ]]; then
        # Detached: stdio goes to a private log the supervisor relocates under
        # its own run dir once the run id exists. The answer is never read from
        # this log — run_dir/final.txt stays authoritative and `wait` serves it.
        _det_log="$(mktemp "${TMPDIR:-/tmp}/porch-detach.XXXXXX")"
        _det_idf="$(mktemp "${TMPDIR:-/tmp}/porch-detach-id.XXXXXX")"
        chmod 600 "$_det_log" "$_det_idf"
        _det_log_kept=0
        cleanup_detach() {
            [[ "$_det_log_kept" -eq 1 ]] || rm -f "$_det_log"
            rm -f "$_det_idf"
            cleanup_delegate_prompt
        }
        trap cleanup_detach EXIT

        python3 -m steer.supervisor \
            --agent-id "$AGENT_ID" \
            --task-file "$_del_prompt_tmp" \
            --cwd "$(pwd)" \
            --artifacts-dir "$ART" \
            --log-file "$_det_log" \
            --run-id-file "$_det_idf" \
            --detach-setsid \
            "${REG_ARGS[@]+"${REG_ARGS[@]}"}" \
            </dev/null >>"$_det_log" 2>&1 &
        _det_pid=$!
        disown "$_det_pid" 2>/dev/null || true

        # Block until the run id lands in the handshake file. This is
        # synchronisation, not polish: the supervisor reads the task file before
        # create_run, and our EXIT trap deletes that file the moment this script
        # returns. The log cannot serve as the handshake — the supervisor moves
        # it under the run dir as soon as the run id exists.
        _det_run_id=""
        while [[ -z "$_det_run_id" ]]; do
            _det_run_id="$(head -1 "$_det_idf" 2>/dev/null | tr -d '[:space:]' || true)"
            [[ -n "$_det_run_id" ]] && break
            if ! kill -0 "$_det_pid" 2>/dev/null; then
                # The supervisor may have finished a fast run and moved its log
                # already; only a genuinely absent id is a startup failure.
                _det_run_id="$(head -1 "$_det_idf" 2>/dev/null | tr -d '[:space:]' || true)"
                [[ -n "$_det_run_id" ]] && break
                echo "Error: detached supervisor exited before reporting a run id" >&2
                _det_log_kept=1
                tail -n 40 "$_det_log" >&2 2>/dev/null || true
                rm -f "$_det_log"
                exit $EXIT_GENERIC
            fi
            sleep 0.1
        done
        # The supervisor owns the log from here (it relocates it under the run
        # dir); never delete it on the way out.
        _det_log_kept=1

        progress_stage "delegate" "detached run_id=$_det_run_id"
        echo "run_id=$_det_run_id" >&2
        # stdout carries the run id alone so `RUN_ID=$(… --detach …)` works.
        echo "$_det_run_id"
        exit $EXIT_OK
    fi

    # Run supervisor in-process (foreground); prints run_id early on stderr
    # and final answer on stdout when complete.
    python3 -m steer.supervisor \
        --agent-id "$AGENT_ID" \
        --task-file "$_del_prompt_tmp" \
        --cwd "$(pwd)" \
        --artifacts-dir "$ART" \
        "${REG_ARGS[@]+"${REG_ARGS[@]}"}"
    exit $?
fi

# Always use the normalized file so backend_run never re-reads /dev/stdin,
# treats content as positional input, or places a large task in argv/env.
"$LIB_DIR/backend_run.sh" --mode delegate --agent-id "$AGENT_ID" --raw --prompt-file "$_del_prompt_tmp"
exit $?
