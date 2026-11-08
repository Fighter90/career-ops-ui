# Existing-host placement (experimental)

This first implementation adds one coordinator around existing `porch delegate`.
It supports local and POSIX SSH hosts, durable weighted reservations, detached
launch, routed controls, and lost-launch-receipt reconciliation. It does **not**
yet provision AgentCore or other cloud environments, transfer repositories, set up
native subscription authentication. Claude live interruption is supported by its
delegate adapter; see `delegate-runtime.md`. Backend
capabilities remain those of the ordinary delegate adapter.

## One coordinator

Run all fleet commands on one machine (normally the existing VM), using the same
private configuration and SQLite path on its local filesystem. Chats connect to
that machine using their existing authenticated transport. Do not create a
separate coordinator database per desktop app, share SQLite over a network mount,
or run a second coordinator when the first is unavailable.

The same Porch version must be installed on participating hosts. Use an absolute
path to each host's resolved Porch executable. Existing SSH configuration supplies connection
and authentication; no keys are copied. Windows workers are not qualified here.

Configuration is opt-in via `PORCH_FLEET_CONFIG` or `fleet --config /absolute/file`.
Start from `fleet.example.json` in the skill root, replacing its placeholders.
Nothing discovers or enrolls hosts automatically. No production capacity defaults
are installed. Configure capacity and optional memory threshold from agreed host
policy and measurements. A unit is an explicit allocation weight, not a CPU or
memory forecast. Unmanaged Porch runs each occupy one unit; non-Porch work is only
visible through telemetry. Heavy jobs must still use their host's existing admission
helper. Placement does not enforce process resource limits.

Hosts are considered in configuration order. Set `automatic: false` on the Mac:
it can then be selected only with `--host mac`. Agent profiles and workspaces must
be explicitly configured on each host. Workspaces are pre-created, isolated task
checkouts; use a unique canonical absolute path for each. No sync, clone, image,
credential copy or shared writing checkout is implied by a launch.

## Usage

```bash
# Host-local telemetry; no model calls and no fleet configuration required.
"$PORCH" fleet probe

# Run these on the single coordinator, with PORCH_FLEET_CONFIG configured.
"$PORCH" fleet status
"$PORCH" fleet plan --agent codex --workspace feature-a
"$PORCH" fleet launch --request-id task-unique-id --agent codex \
  --workspace feature-a --prompt-file /absolute/task.txt
"$PORCH" fleet control task-unique-id status --json
"$PORCH" fleet control task-unique-id events --max-events 50
printf '%s' 'Prefer the smaller change' | "$PORCH" fleet control task-unique-id steer --mode auto
"$PORCH" fleet control task-unique-id wait --timeout 20 --json
"$PORCH" fleet control task-unique-id cancel
"$PORCH" fleet reconcile task-unique-id
```

Use a fresh request id for a new task; reuse the exact id, task and selection
arguments after a lost response. Retrying a known request returns its original
allocation, even if it has completed. Changed content under the same id is refused.
The request is reserved before launch I/O. An unconfirmed response retains the
reservation as `unknown`, not failed or free. `reconcile` can recover the run id
from the host registry using request id, task fingerprint and workspace evidence.
An absent run is not proof that no process started. If no matching receipt exists,
the allocation stays unknown and needs operator investigation; no automatic replay
or time-based release exists. Multiple matching receipts are reported explicitly.

Known terminal run observations free allocations during subsequent launch selection.
New supervisor runs also report `cleanup_status`. A terminal task with pending
or failed adapter cleanup is observed as `cleanup_pending`/`cleanup_failed`, so
it does not free its allocation. Cleanup errors remain in run metadata/audit.
This receipt covers adapter process-group cleanup, not escaped detached jobs or
destruction of an environment; those require their own execution/provider boundary.
Status displays recorded allocations alongside fresh host observations; use
`reconcile` to update an individual record. Missing/unreadable registry data cannot
release a reservation. A host returning no probe is unavailable, not idle.

Controls route to the original host connection and preserve Porch's exit codes.
Changing that host's transport/address/Porch path makes existing controls fail
explicitly until the original binding is restored. Keep its registry location
unchanged too. Guidance travels through stdin. `--prompt-file` is not forwarded,
because a coordinator-local filename is not a worker-local file. A mailbox receipt
is not proof that a steer was applied: inspect the regular delegate status/events.

`request_timeout_seconds` is a transport wait configured per host, not an agent
runtime limit. For a `wait` call use a shorter timeout than that transport wait.
Loss of a client or transport does not cancel the detached worker.

## Evidence and remaining boundaries

Offline tests use real SQLite, concurrent clients, the public CLI and the real
Porch supervisor with fake agents. They cover duplicate dispatch, lost receipt,
unknown capacity, weighted accounting, workspace reservation and explicit-only
Mac selection. Run `uv run --no-project scripts/tests/fleet_test.py -v` from the
skill directory. No native model is contacted.

The fleet probe reports OS/architecture, load, free disk, registry states and Linux
available memory. macOS available memory is currently `null`, not invented. These
are observations, not subscription readiness or a full resource prediction. A
session-start hook can request status later; no hook is installed by this feature.

A fresh probe cannot atomically reserve work launched outside this coordinator.
Route participating new tasks through the same coordinator and retain host-level
resource admission. Independent writers bypassing Porch are outside its reservation
contract. Unknown launches intentionally remain visible until reconciled.
