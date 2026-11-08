# VCS observation

Use VCS evidence when it helps assess direction, scope drift, or repeated rework.
Observe from the worker's exact assigned root. Compare against the pre-launch
state and known task ownership; a shared-root diff does not identify its author.
Inspect relevant non-secret paths rather than dumping every file. Partial edits
can change while being read and are not proof of completion or correctness.

For Git, useful read-only views include:

```bash
git --no-optional-locks status --short
git --no-pager diff --no-ext-diff --no-textconv -- path/to/relevant-file
git --no-pager diff --cached --no-ext-diff --no-textconv -- path/to/relevant-file
```

These show unstaged and staged changes separately. They omit untracked file
contents and committed changes. Read relevant new files separately; if commits
were made, compare with the recorded launch commit as needed. Existing dirty
changes also belong to that baseline, not automatically to the worker.

If `jj --ignore-working-copy root` succeeds, use JJ for change history and load
`working-with-jj` when available. Do not initialize JJ just for observation. If
an existing JJ repository cannot be read, report that problem rather than treating
it as Git-only. The following forms were checked against JJ 0.44.0 CLI help:

```bash
jj --ignore-working-copy --at-op=@ --no-pager log -r @ --no-graph
jj --ignore-working-copy --at-op=@ --no-pager diff -r CHANGE_ID --git -- path/to/relevant-file
jj --ignore-working-copy --at-op=@ --no-pager evolog -r CHANGE_ID -n 5 -p --git
```

Resolve `CHANGE_ID` from the assigned worker's change; do not assume a later `@`
still names it. `evolog -p` compares saved versions of that change, accounting for
changed parents; it is not a filesystem edit stream. Scope patch inspection to
non-secret work; use evolog without `-p` when content scope is uncertain. Separate
new task edits from rebases and other writers' operations. If the worker starts
another change, follow the newly identified change rather than only its predecessor.

`--ignore-working-copy` avoids snapshotting or updating files; `--at-op=@` avoids
merging divergent operations during inspection. If operation heads are ambiguous,
inspect explicitly identified operations instead of resolving them by mutation.
Record the operation/commit identity only when comparing versions or handing off
requires it. These views show saved JJ state, which may lag behind disk. Read
relevant files directly for unsnapshotted work; in a colocated repository Git diff
can also expose disk edits, but its HEAD/index baseline is not the JJ change
identity. In a non-colocated JJ repository do not assume Git worktree commands work.

Do not run snapshot, restore, undo, checkout, or other VCS mutations merely to
monitor a worker. No new diff or evolution entry alone proves inactivity; combine
VCS evidence with task events, findings, and known ongoing commands.
