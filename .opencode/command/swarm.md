---
description: Run the agent swarm over swarm-labeled Linear tasks (dev → review → release → prod-QA)
---

Load `.agents/skills/swarm/SKILL.md` (the canonical swarm skill at the repo root) and
follow it exactly. Arguments ($ARGUMENTS), all optional: task count for `--max` (default 1)
plus orchestrator flags (`--rounds N`, `--dry-run`, `--no-release`). Preflight (clean tree,
on main, `opencode` present), launch `node scripts/swarm/orchestrator.mjs --max N` in the
background, stream the log to the user, babysit the milestones, fix forward on
orchestrator bugs (red-first, `tests/swarm-orchestrator.test.mjs`), and report the trace
in the user's language.
