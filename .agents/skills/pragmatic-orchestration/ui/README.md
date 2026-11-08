# Porch UI

An optional, read-only window over existing Porch delegate runs. Open it after
agents have started; close it whenever you like. Workers and their registry are
independent of the window and HTTP observer.

## Setup and launch

Requires Python 3.11+, Node 22.12+ (Node 24 recommended), and pnpm 11.21.
From this directory, install and build once:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

`pnpm start` runs this checkout's `porch ui --desktop`. After the build:

```sh
porch ui --desktop          # Porch window; observer exits when the window closes
porch ui --desktop --mine   # current agent session's active runs; newest selected
porch ui --desktop --mine --focus-run RUN_ID  # select this session's exact run
porch ui --desktop --focus-run RUN_ID         # select a known older run directly
porch ui                    # prints a URL; open it yourself in a browser
porch ui --port 8765        # fixed loopback port; fails if occupied
porch ui --registry-root /absolute/path/to/registry
```

On a laptop with an external monitor, the desktop window opens centered on the
built-in display. The desktop acceptance test verifies that placement on macOS.
On macOS, first launch prepares a cached, locally signed Porch.app with Porch's
name and icon. It requires the standard `sips`, `iconutil`, and `codesign` tools.

Use the `porch` executable belonging to **this checkout/installed skill**, not an
older copy elsewhere on PATH. The source entrypoint is `../scripts/porch` relative
to this directory. Native Windows can use `../scripts/porch.cmd ui --desktop`.
`PORCH_STEER_DIR` selects the registry exactly as it does for the delegate CLI.
The observer needs no config, credentials, or new worker launch. Vite dotenv
loading is disabled.

Node packages and the UI build are optional: normal headless Porch use requires
neither. A missing build produces setup instructions; it never automatically
downloads dependencies. This is a source distribution, not a signed desktop
installer. Desktop acceptance was verified on macOS; other platforms need their
own native verification.

## Working with runs

- Select a run to follow its text, reasoning, tool events, and steer lifecycle.
  Reasoning/tool details are collapsed until opened. They show recorded output,
  not an inference about hidden work.
- Scroll up to pause auto-follow while ingestion continues. **Jump to latest**
  resumes it. **Final answer** shows the saved artifact separately from streamed
  text. Output is text; HTML, scripts, and external resources are never executed.
- Search names, agents, models, or paths. The **Launched by**, **Executor**, and
  **Project** dropdowns search their available values and combine with lifecycle
  filters. **Clear filters** resets the entire view. Runs are grouped by recorded
  launcher; `Unknown launcher` means the old record has no provenance or the
  launch environment was ambiguous. **Executor** is the Porch agent profile,
  independent of the caller.
- Rows show Porch turn count when available: the initial request plus follow-up
  requests accepted by the executor. This does not count internal model steps.
  **Run information** shows the executor's native session ID when the backend
  reports it, and search accepts that ID. Older records may omit both fields.
- When an agent opens `--mine`, the view selects its launcher and current session,
  shows active runs, and selects the newest one. `--focus-run RUN_ID` selects a
  known run even if it has finished. If the session is unavailable, the view
  states that it is showing all runs by that launcher. An unknown launcher fails
  explicitly. Use the plain UI to inspect older runs that lack provenance.
- **Errors** lists failed runs, stopped supervisors, unreadable records, and
  unknown status. It is a diagnostic filter, not a request for user approval.
  A dead supervisor is labelled **Supervisor stopped** and never counted active.
  Silence does not establish that an agent is idle.
- Theme follows the operating system by default. Choose **Light** or **Dark**
  from the header to override it; the non-sensitive preference survives observer
  restarts and changing loopback ports.
- **Save output** exports a normalized journal snapshot without raw provider
  payloads, or the saved final text. Electron asks where to save it.
- Lost connectivity retains output and retries. Restarting the observer process
  itself creates a new token: open its new launch URL.

## Scope and limits

Discovery covers the chosen registry's steerable `delegate` runs, including
detached and completed runs. It does not discover `review` fan-out, `--one-shot`
runs, remote registries, or provider-internal children absent from the registry.
Titles come from semantic run IDs; no task/parent relationship is invented.
Continue using the CLI for launch, steer, and cancellation.

The view polls selected output every second and discovery every two seconds
(five seconds when hidden). Sequential requests use bounded byte pages and faster
catch-up. The initial view starts near the last 128 KiB, aligned to a complete
event; **Load from start** is explicit. At most 500 display groups and one million
text characters stay visible; omissions are labelled and complete export remains
available. Individual lines over 8 MiB fail explicitly in display and export;
inspect those artifacts on disk. Final previews are capped at 2 MiB, with a label
and full-text download. Discovery displays at most 1,000 records, prioritizing
nonterminal runs, and labels the limit. Filter counts refer to this loaded snapshot.

The server binds only `127.0.0.1`, requires an ephemeral token for artifacts,
checks Host/Origin, offers no CORS or mutation routes. Electron is sandboxed with
no Node/preload API. Closing it stops only its observer, without supervisor signals.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
python3 ../scripts/tests/ui_test.py -v
pnpm test:desktop
```

Desktop acceptance opens isolated Electron windows against temporary registry
fixtures. It tests actual journal appends, reconnects, selection, filters,
launcher grouping, combined searchable filters, keyboard navigation, light/dark/system
themes, follow/scroll pause, narrow layout, and close/reopen without worker
mutation.
Screenshots go to ignored `test-results/`. No provider calls or user browser
automation are used. On Linux use `xvfb-run -a pnpm test:desktop`.

## Launcher provenance

New runs record the **caller** separately from the executor. Porch recognizes
`CODEX_THREAD_ID` and Claude Code's `CLAUDECODE=1` or
`CLAUDE_CODE_SESSION_ID` environment marker. For wrappers or other agent hosts,
set `PORCH_LAUNCHER=codex|claude|opencode|grok|devin|gemini|cursor|terminal|unknown`
before starting Porch. This is a label, not proof of identity. When multiple
markers conflict Porch records `unknown`; it does not guess. A Porch worker
launching a nested Porch worker marks that child's launcher as its own backend.
For Codex/Claude, Porch stores only a hash of the caller's session identifier.
Nested Porch runs use their parent run id as the session scope. Raw **caller**
session ids are not placed in run metadata or launch URLs. The executor's native
session ID is stored separately when its protocol provides one. Existing runs lack this scope,
so `--mine` cannot claim them as part of the current session.
Existing run records remain `Unknown launcher` because they cannot be
retrospectively attributed reliably. The observer never changes run records.
