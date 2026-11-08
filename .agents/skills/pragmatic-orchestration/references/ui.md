# Optional run observer

Use this when the user wants a graphical view of existing Porch delegates and
their live output. Resolve and verify `PORCH` as specified in SKILL.md first.
For requests such as "show my subagents" or "покажи субагентов", open the focused
view immediately. If the agent already has a current run id, pass it explicitly.

```bash
"$PORCH" ui --desktop
"$PORCH" ui --desktop --mine
"$PORCH" ui --desktop --mine --focus-run "$RUN_ID"
"$PORCH" ui
"$PORCH" ui --registry-root /absolute/path/to/registry
```

`--desktop` opens the Porch desktop window. Without it, the command prints a local URL and never
opens a browser. It runs until the window closes or the observer receives Ctrl+C;
workers are unaffected. Use the same `PORCH_STEER_DIR` as the workers when set.
Do not launch a new delegate just to populate the UI.
`--mine` detects the calling agent and, when available, its current session. It
starts on **Active**, selects the newest matching run, and keeps its other active
runs in the list. `--focus-run` selects that exact existing run, including a
finished run; with `--mine` it must belong to this caller/session. If an older
record cannot be attributed to this session, use `--focus-run RUN_ID` by itself
to open that run. Do not silently show another session's runs as "mine".

The frontend is optional. If it has not been built, the command returns setup
instructions. One-time setup uses the UI sibling belonging to this skill:

```bash
PORCH_UI_DIR="$(cd "$(dirname "$PORCH")/../ui" && pwd)"
pnpm --dir "$PORCH_UI_DIR" install --frozen-lockfile
pnpm --dir "$PORCH_UI_DIR" build
"$PORCH" ui --desktop
```

Requires Python 3.11+, Node 22.12+ and pnpm 11.21. Headless orchestration does not
require frontend dependencies. See [UI README](../ui/README.md) for verification,
platform scope, and limits.

The optional view is read-only: search/filter registered delegate runs, inspect
live normalized output, view saved final answers, and save output. Launch, steer,
cancel, and durable continuation remain CLI operations. It does not discover
review fan-out, one-shot runs, other hosts, or provider-internal children without
registry records. Closing/reopening is safe: the existing registry and artifacts
remain authoritative. A stale process and a disconnected UI are separate states.

Filters in the sidebar combine lifecycle, launcher, executor profile, project,
and free text. Three searchable dropdowns take their options from the loaded
registry snapshot; **Clear filters** resets all filters. Runs are grouped by the
recorded caller. Older runs and ambiguous launch environments show **Unknown
launcher**. New runs can set `PORCH_LAUNCHER` explicitly (see the UI README).
**Errors** is a diagnostic filter for failed/stale/unreadable/unknown states; it
never signals an approval request. The header supports system, light, and dark
themes.
The run list shows the number of Porch turns when recorded: the initial request
plus follow-up requests accepted by the executor. This is not a count of internal
model or tool steps. Run information exposes the executor's native session ID
when its protocol provides one; older runs may have neither field. The caller's
native session ID remains private and is used only to scope `--mine`.
