---
description: Print the current SDD state of career-ops-ui — shipped releases, open phases, in-flight branches and PRs.
---
Run a fast triage of the SDD pipeline state for this repo (this project plans in `docs/sdd/`, not `.planning/`):

1. `git fetch origin --quiet && git log --oneline origin/main -5` and `gh pr list --state open` — another session may have shipped the version you are about to cut.
2. Read `PROGRESS.md` header — the shipped version and the next step.
3. Read `docs/sdd/PLAN.md` releases table — list every release with its Status column.
4. Read `docs/sdd/BACKLOG.md` — count open checklist items per section (`grep -c '\- \[' docs/sdd/BACKLOG.md`).
5. Check for in-flight worktrees/branches: `git worktree list` + `git branch` — anything not merged?
6. Cross-check the Linear project «Дорожная карта career-ops-ui» if the linear MCP is connected (CAR issues) against PLAN.md — flag drift.

Output:

```
## SDD state — <today>
- Shipped: <last version + date>
- In flight: <branches/PRs/worktrees>
- Next phase: <release + concern>
- Open backlog items: <N> (<per-section counts>)
- Roadmap drift (PLAN vs Linear): <none | description>
```
