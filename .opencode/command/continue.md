---
description: Continue the program — take the next open phase from docs/sdd/PLAN.md and work it to a shipped release.
---
Start with: `git fetch origin && git log --oneline origin/main -5 && gh pr list`.
Read `PROGRESS.md`, `docs/sdd/PLAN.md`, `docs/sdd/BACKLOG.md`. Pick the earliest phase that is not
shipped. Create branch `fix/vX.Y.Z-<slug>` from `origin/main`. Split its BACKLOG items into disjoint
file groups and give each group to the `fixer` agent (in parallel when the files do not overlap).
Integrate, run the gates, then hand the version to the `release` agent. $ARGUMENTS
