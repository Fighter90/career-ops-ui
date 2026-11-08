---
description: Run the agent swarm over swarm-labeled Linear tasks (dev → review → release → prod-QA)
---

Load `.agents/skills/swarm/SKILL.md` (the canonical swarm skill) and follow it exactly.
Arguments ($ARGUMENTS), all optional: task count for `--max` (default 1), plus any
orchestrator flags (`--rounds N`, `--dry-run`, `--no-release`). Examples: "2" →
`node scripts/swarm/orchestrator.mjs --max 2`; "1 --no-release" → single task, stop
after review ACCEPT. Preflight, launch in the background, stream the log, babysit the
milestones, fix forward on orchestrator bugs, and report the trace in the user's language.
