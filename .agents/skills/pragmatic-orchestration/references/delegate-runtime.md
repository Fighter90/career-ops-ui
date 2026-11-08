# Delegate runtime reference

Read only the section needed for the current operation. The parent workflow and
supervision policy live in [delegate.md](delegate.md).

- [Group waiting](#bounded-and-group-waiting)
- [Harness wait loop](#keeping-the-parent-active)
- [Durable Codex follow-ups](#durable-codex-follow-ups)
- [Event pages](#bounded-event-observation)
- [Exit codes and permission failures](#wait-and-watch-exits)
- [Steering and backend timing](#steering-modes)
- [Mailbox states](#mailbox-lifecycle)
- [Retry safety](#retry-safe-steering)
- [Registry and artifacts](#registry-and-artifacts)
- [Backend delivery matrix](#backend-delivery-matrix)

## Detached process lifetime

`--detach` uses the default steerable path, creates the registry entry required
for reattachment, prints the run id on stdout, and returns immediately. The
supervisor becomes its own session leader; caller `SIGINT`/`SIGHUP` cannot reach
it. Supervisor stdio is stored in a private `supervisor.log`, but `wait` is the
authoritative result interface. `--detach` and `--one-shot` are mutually exclusive.

## Bounded and group waiting

```bash
"$PORCH" delegate wait "$RUN_ID" --timeout 300 --json
"$PORCH" delegate wait-any "$RUN_A" "$RUN_B" --timeout 300
```

`--timeout` is an observation deadline in seconds (finite, >= 0); `0` takes a
snapshot. Omitting it preserves unbounded waiting. Exit 124 with `timed_out: true`
means work is still active; it neither cancels nor restarts any worker. `wait`
without `--json` reports a timeout on stderr; `--quiet` suppresses the payload.

`wait-any` always emits JSON with `ready` run ids and `runs` snapshots. Exit 0
means at least one target is terminal, including failures; inspect each run's
`status`, `exit_code`, and `error`. Every supplied id must exist. Timeout snapshots
and group results include at most five recent normalized events per run and a
`next_cursor` for later `events` reads. This is a recent-activity sample, not a
lossless delivery queue; retain your existing cursor when unread history matters.
Every `runs` entry includes `agent_id`, `model`, `started_at`, `finished_at`, and
`elapsed_seconds`: elapsed wall time since launch for active runs, fixed total
time for terminal runs. Missing or invalid timestamps produce `null`, not a
fabricated duration. `ready` explicitly names terminal pending targets, including
failures and cancellation; it is not a claim that they succeeded.

Collect complete final answers separately with `wait RUN_ID`. Keep all ids from
this caller's session group in subsequent calls, including collected runs:

```bash
# A has been collected; return on B while still reporting both statuses/times.
"$PORCH" delegate wait-any "$RUN_A" "$RUN_B" --acknowledged "$RUN_A" --timeout 900
```

Repeat `--acknowledged` for each collected terminal id. Acknowledged runs remain
in `runs` but cannot trigger `ready`; active, unknown, or out-of-group ids cannot
be acknowledged. Stop waiting when all are collected. The caller owns the exact
group membership; the CLI does not infer it from unrelated runs in the global
registry or the same working directory.

Launch independent tasks with separate `--detach` commands from their exact
working roots. Parallel writers need separate user-authorized workspaces; do not
create workspaces implicitly. Save ids and per-run event cursors across caller
handoffs. Bounded waiting enables supervision but does not schedule it.

## Keeping the parent active

Follow the [supervision and waiting policy](delegate.md#keeping-the-parent-active)
when selecting observation deadlines. Keep the wait attached to the parent turn.
In Codex, if `exec_command` returns a `session_id`, call `write_stdin` with empty
input on that session until it exits. If `functions.exec` yields a running cell,
resume it with `functions.wait` first, then inspect the returned command result
for a shell session id. Other harnesses use their equivalent process-wait tool.
Tool waits of at most 60 seconds resume the same CLI process; they do not create
new supervision checkpoints or require restarting the Porch wait.

For groups, call `wait-any` with all session ids, including acknowledged results.
When it returns ready ids, collect each complete answer with `wait`, inspect its
outcome, and add `--acknowledged` for collected terminal runs on the next call.
Stop when all are collected. Reconcile observation errors and active runs before
choosing another action; see [exit codes](#wait-and-watch-exits).

## Durable Codex follow-ups

```bash
RUN_ID=$("$PORCH" delegate -a codex --persist-session --detach --name implement-task "Implement the task")
# Supervise until terminal using delegate.md, then collect the result:
"$PORCH" delegate wait "$RUN_ID"
# After successful completion, review the code and deviation journal, then send only the follow-up:
NEXT_ID=$("$PORCH" delegate -a codex --continue-run "$RUN_ID" --detach --name fix-reviewed-edge-case "Fix the reviewed edge case; keep the original constraints and journal path")
# Supervise the successor in the same way, then collect:
"$PORCH" delegate wait "$NEXT_ID"
```

Persistence is opt-in, steerable Codex only. `--continue-run` implies persistence,
uses native `thread/resume`, and creates a new run linked by `continued_from`;
it does not reopen or change the old terminal run. Use `steer` for active work,
`--continue-run` for the latest successfully completed durable turn. The exact
agent profile, resolved model, effort, binary, and working root must match.
Native conversation history persists in Codex storage beyond supervisor exit;
private registry metadata holds its handle. Do not delete either while expecting
to continue. If registry recovery lost session coordination state, continuation
fails explicitly: reconstructing a latest-run claim could permit duplicate work.
Conversation continuation does not restart terminated shell tools.

One session admits only one continuation at a time. After a continuation claims
the session, its predecessor cannot be reused: continue the latest successor.
If it failed, was cancelled, or vanished mid-delivery, inspect its result and task
effects first. For a terminal durable run with confirmed backend cleanup, opt into
recovery explicitly and provide a new remaining-work instruction:

```bash
NEXT_ID=$("$PORCH" delegate -a codex --continue-run "$RUN_ID" --recover-session --detach --name recover-task "Inspect the changes and results already produced, then finish the remaining work without repeating completed steps")
"$PORCH" delegate wait "$NEXT_ID"
```

`--recover-session` permits failed/cancelled runs and completed runs with a
nonzero exit code. It requires `cleanup_status: completed`, the latest-run claim,
the original profile/model/effort/binary/CWD, and exclusive session access.
Active or stale runs and missing/failed/pending cleanup are rejected: reconcile
the old writer before recovery. The old prompt and queued steers are never
redelivered; only the new instruction is sent to the resumed native thread.
The successor records `recover_session: true`; the old outcome stays unchanged.

A failed native resume never starts a fresh session. Its successor retains the
existing handle so, after inspecting the failure, recovery can target that latest
failed run. Ordinary `--continue-run` still rejects unsuccessful outcomes.
Other providers and ordinary ephemeral Codex runs have no terminal-run resume.
If native history is unavailable, a new worker remains a deliberate parent
decision after reconciling prior effects, with an explicit remaining-work prompt.

## Bounded event observation

`events` always returns one JSON object and never blocks:

```bash
"$PORCH" delegate events run_<id> --max-events 50
"$PORCH" delegate events run_<id> --cursor 1290 --max-events 50
```

Without `--cursor`, it returns the latest page and positions `next_cursor` at
the current end. With `--cursor`, it returns later events in order. The cursor
counts complete normalized records; an incomplete concurrently written final
line is not consumed. Consecutive answer or thinking deltas are coalesced, each
event body is capped, and backend `raw` payloads are omitted so the response is
bounded by `--max-events`. A successful observation exits 0 even if the run
itself failed; terminal status and the run exit code are fields in the JSON.

## Wait and watch exits

| Exit | Meaning |
|---|---|
| `0` | Completed |
| `124` | `wait --timeout` observation expired; worker remains active |
| `130` | Worker cancelled or observer interrupted |
| `70` | Supervisor died without finishing |
| `74` | Completed without answer text |
| other non-zero | Agent/backend failure |

`wait-any` uses observation exits: 0 for any terminal target, 124 for timeout,
130 for interrupted observation, and non-zero errors for invalid/unreadable ids.
Worker exit codes remain in its JSON.

For a known terminal run, `wait --json` also returns a structured result when
the final text is missing: `final_available: false`, `final_text: null`, and
`final_path: null`. Its nonzero exit still reports the failure; do not treat
parseable JSON as success. A held control lock on a dead run does not prevent
`wait-any` from observing other targets or returning at its deadline.

OpenCode permission requests are explicit blockers. This headless adapter cannot
answer an interactive `permission.asked`; it fails the run with
`permission_required`, including the request id, permission, paths, and command,
so `wait-any` returns control to the parent. It does not grant additional access.
Review the partial work and requested action before choosing an authorized
recovery. A queued `auto` steer cannot resolve a permission request. Do not
diagnose a hung test from heartbeat-only output: inspect tool events and errors.
OpenCode tool events expose the tool name, input command, and state
through `events`. Active calls remain in `status --json` under
`state.active_tools` and in each wait snapshot's `active_tools`, even after later
heartbeats; this is observed tool state, not proof that an OS command is executing
(a permission request can block it first). Long SSE frames are preserved before
public output is bounded.

## Steering modes

| Mode | Use when | Consequence |
|---|---|---|
| `auto` | Normal clarification, added constraint, or preferred direction | Safest native behavior available on the backend |
| `queue` | Current work may finish before guidance is applied | May affect only the next safe boundary; Grok uses a real next-turn FIFO entry |
| `interrupt` | Current direction is wrong and partial work should be abandoned | May cancel the active turn/tool flow; backend-specific handover rules apply |

For Grok, `auto`/`queue` is the productive default for additive guidance. Use `interrupt` only to replace direction because each later interrupt supersedes the prompt currently running, including an earlier steer.

### Claude interruption and replacement

Claude uses `cancel_and_send`: Porch sends a native interrupt control request,
waits for its matching success response and the previous turn's result (in either
order), then sends the replacement instruction into the same process/session.
An early request waits for that turn's native `system/init`, rather than relying
on user-message replay as evidence the turn started. This avoids the early-ack
race documented in [Claude Code issue 98713](https://github.com/anthropics/claude-code/issues/98713).
The protocol follows the [official SDK implementation](https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/query.py).

An interrupt acknowledgement alone does not prove the turn or tool has stopped.
If no turn result arrives, Porch retains the pending handover and sends no new
instruction. Inspect events or cancel explicitly. An error result for the
interrupted turn is not the final result of the replacement task. Partial answer
text is cleared at handover; a duplicate result UUID cannot complete the new turn.

Overlapping handovers and interrupting a run that already received queued input
are explicitly refused before new input is sent. Wait for the current handover
before another steer. Porch does not erase accepted queued instructions. If the
native interrupt receipt unexpectedly reports queued work, the handover stays
unresolved with an error event; inspect or explicitly cancel the native session.
Normal `auto`/`queue` behavior is unchanged.

Verified on Claude Code 2.1.302 with native subscription authentication: interrupt
a foreground shell, send a replacement instruction, retain the native session and
finish successfully. The shell's delayed side effect remained absent after its
original deadline. Interruption is not rollback: completed side effects remain.
This live-turn capability does not add completed-run or process-restart continuation
for Claude.

### What Grok actually does with a steer

Verified against grok 1.0.0 over real ACP runs:

- `auto`/`queue` never lands inside the running turn. The prompt enters the session FIFO and Grok answers it in a **new turn** with the full session history. If the running turn is mid-generation, it finishes first (`end_turn`) and the steer runs afterwards. If the running turn is blocked waiting on a tool — a long shell command, a background command poll — Grok itself promotes the queued prompt and cancels the running turn with `cancelTrigger=send_now`, so guidance can land within seconds.
- Because of that promotion, the **original task prompt can end as `cancelled`/`superseded` in `auto` mode too**, with no client interrupt involved. That is normal Grok behavior, not a failed run: the steer turn continues the remaining work in the same session.
- `interrupt` cancels the running turn immediately (`cancelTrigger=send_now`) and the steer prompt takes over.
- In both modes every message the agent produces after the steer is attributed to the steer's `promptId`, and the final answer is assembled from the steer turn onward. Expect the final answer to read as the continuation, not as the original plan.

Practical consequences for the calling agent:

- Steering a Grok run that is only thinking or streaming text has **delayed effect**: nothing changes until the current turn ends. Do not send the same guidance again; check `status --json` for the steer's `prompt_id` and its lifecycle instead.
- Steering a Grok run that is executing long tool calls has near-immediate effect.
- Make guidance self-contained. The steer runs as its own turn, so state it as an instruction that stands on its own ("from now on … ; continue the remaining steps"), not as a fragment that only makes sense inline.
- Verify semantics through task artifacts, never through the steer status alone.

### What Devin actually does with a steer

Verified against devin 3000.10.27 over real ACP runs:

- `auto`/`queue` are `same_turn`: a second `session/prompt` merges into the running turn instead of entering a next-turn queue, so guidance can take effect without waiting for `end_turn`.
- `interrupt` is `cancel_and_send`: `session/cancel` resolves in-flight prompts with stopReason `cancelled`; the session stays usable and the steer prompt takes over.
- The ack ladder is the shared one — `request_sent` → `completed`/`cancelled`/`failed` by the request's own stopReason; it is never `applied`.

## Mailbox lifecycle

| `mailbox_status` | Meaning |
|---|---|
| `accepted` | Persisted locally, not dispatched |
| `delivering` | Supervisor is calling the backend adapter |
| `request_sent` | Written to transport; no application evidence yet |
| `queued` | Accepted by backend but not observed running |
| `awaiting_queue_resolution` | Grok follower cancellation awaits authoritative queue evidence |
| `merged` | Grok combined this guidance into another running prompt |
| `running` | Correlated with an active prompt/turn; does not prove semantic effect |
| `completed` | Steer prompt ended normally; verify task artifacts/result |
| `incomplete` | Steer stopped at an output/token limit |
| `applied` | Backend directly acknowledged replay/injection; still verify task effects |
| `cancelled` | Steer started but was cancelled |
| `superseded` | A later Grok `sendNow` prompt replaced it — a client `interrupt`, or Grok's own promotion of a queued steer over a turn blocked in a tool wait |
| `dropped` | A never-running Grok prompt was absent from later merge evidence |
| `abandoned` | Overall run ended before steer reached a protocol terminal state |
| `failed` / `rejected` | Steer did not complete normally; inspect backend evidence |

Never interpret `accepted`, `request_sent`, `queued`, or `running` as proof that guidance changed files or the final answer. `completed` proves prompt lifecycle completion, not semantic compliance.

## Retry-safe steering

```bash
"$PORCH" delegate steer run_<id> \
  --client-id requirement-cache-backend-v1 \
  --mode auto \
  --prompt-file steer.md
```

Retry a stable `client_id` only with identical content, mode, and kind. Any mismatch is an idempotency conflict. For an active run, a retry with identical content returns the existing message; a new instruction needs a new client id. A closed mailbox rejects new messages. Reconcile the run outcome first: use `--continue-run` for the latest successful durable Codex run, or add `--recover-session` after inspecting a failed/cancelled durable run and confirming cleanup. Deliberately start a new run for remaining work when continuation is unavailable; never silently replay the original task. Client ids are SHA-256-mapped for paths; the original value remains in JSON.

Do not put secrets in tasks or steering guidance unless persistence in private raw/audit artifacts is intentional. Large task and guidance bodies travel through files or mailbox JSON, not large argv/env values.

## Registry and artifacts

The registry defaults below the user cache. Registry/run directories are `0700`, state files are `0600`, and symlink run directories are rejected. An active supervisor validates and can safely reconstruct missing or malformed owned registry metadata; unsafe ownership/symlink failures remain degraded instead of being overwritten.

Steerable runs always retain the private service registry and protocol artifacts required for steer/status/cancel, even when `PORCH_SAVE_OUTPUTS=0` disables ordinary archival. Terminal transition serializes with enqueue so no accepted/delivering mailbox entry remains without a terminal outcome.

## Backend delivery matrix

| Backend | `auto` / `queue` | `interrupt` |
|---|---|---|
| Claude Code | `queue_next_turn` through stream-json user replay | Rejected; no downgrade |
| Codex CLI | `same_turn` through `turn/steer` and expected turn id | Abort active turn, wait for its completion acknowledgement, then start a prompt |
| OpenCode 2 | `auto`: step injection; `queue`: next turn, via authenticated loopback HTTP/SSE | Interrupt, verify idle, then prompt |
| Grok Build | `queue_next_turn` through concurrent ACP prompt FIFO | Cancel-and-send using `sendNow` and its own prompt id |
| Devin CLI | `same_turn` through concurrent ACP `session/prompt` merge | Cancel-and-send through `session/cancel` (stopReason `cancelled`) |

OpenCode replacement requires both a successful interrupt and confirmation of idle
through `/api/session/active`. An unsuccessful or unresolved stop fails the run and
sends no replacement. Completion is reconciled against the durable inbox, active
sessions and message history so an earlier execution cannot finish a later prompt.

OpenCode's server is loopback-only with redirect revalidation and per-run Basic auth; the password is never logged or stored. Claude's authoritative `result` completes the adapter even while stdin remains open; user replay proves transport acknowledgement, not semantic compliance. Codex interrupt uses a bounded local protocol handshake, not a run deadline.

Porch asks OpenCode for its database path and coordinates server startup across its
own processes per database directory, then releases the lock as soon as the server
is ready. Sessions execute in parallel. If another startup holds the lock for
more than two minutes, the waiting run fails with an explicit timeout.
Unrelated OpenCode clients do not participate in this lock; concurrent first-time
database migration by those clients is outside this guarantee. Forced termination
of Porch or failure to stop its server can also release the lock before the server
exits. A disconnected
event stream fails the run explicitly instead of claiming completion from partial output.

Grok attribution uses prompt ids and queue snapshots. Combined followers move through `awaiting_queue_resolution` to `merged` or `dropped`; stop reasons map to `completed`, `incomplete`, `rejected`, `cancelled`, `superseded`, or `failed`. The adapter never claims `applied` because transport events cannot prove semantic compliance. Only agent message chunks contribute to final text; thoughts and replayed user messages do not. The final answer covers the lineage from the current final prompt to the end of the prompt order, so `auto`/`queue` steer turns are included and an `interrupt` still discards the superseded prefix.
