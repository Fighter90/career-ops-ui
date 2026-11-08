---
name: swarm
description: "Launch the career-ops-ui agent swarm: tasks from Linear (state Todo + label `swarm`) are carried automatically through develop → gates → review → document → release (PR, CI, version, tag, deploy) → prod-QA, and Linear is updated at every step. Use when the user says «запусти рой», «запусти навык Рой», «run the swarm», «swarm run», or asks to process swarm-labeled Linear tasks."
---

# Swarm run

You are launching the agent swarm of this repository (career-ops-ui). The machinery lives in
`scripts/swarm/` (orchestrator + role prompts, architecture in `scripts/swarm/README.md`).
Your job is to preflight, launch, babysit, and report — the orchestrator does the rest.

## 1. Preflight (all must pass)

```bash
git -C <repo> status --porcelain        # must be EMPTY
git -C <repo> rev-parse --abbrev-ref HEAD   # must be `main`
opencode --version                      # the worker CLI must exist
```

`<repo>` is this repository root. If the tree is dirty, commit or stash FIRST (never launch
the swarm on a dirty tree — it self-checks and aborts). If tasks should come from a queue of
N, note the user's N (default 1).

## 2. Launch

```bash
node scripts/swarm/orchestrator.mjs --max <N> 2>&1 | tee /tmp/swarm-run-$(date +%H%M).log
```

- Flags you may pass through: `--max N` (tasks this run), `--rounds N` (dev/review rounds,
  default 3), `--dry-run` (pick + plan only), `--no-release` (stop after review ACCEPT).
- `SWARM_REMOTE_QA_LIVE=1` env adds the 19-locale live LLM leg to the prod QA (expensive).
- Run it in the background; stream the log to the user (`tail -f` path) — the user asked to
  see the trace in real time.

## 3. Babysit (the swarm talks through its log)

Milestones to relay: `picked <ID>` → claim → `round n: develop` → `gates green` →
`verdict: ACCEPT|RETURN` → `story:` → `merged:` → release chain (`ok=true version=…`) →
`remote-qa` verdicts → `=== DONE ===`. Read `.task-board/log/<cycle>.log` for worker tails.

## 4. On failure — fix forward, do not shrug

Every failure mode so far was an orchestrator bug that a regression test now pins
(placeholder echo, permission-denied edits, lost branch commits, already-merged work).
When a run fails:

1. Read the latest `.task-board/log/*.log` and the failed issue's Linear comments.
2. Classify: **orchestrator bug** → fix it red-first (extend
   `tests/swarm-orchestrator.test.mjs` or add a suite), commit, push, watch CI, relaunch.
   **Task-side problem** (ambiguous issue, scope creep) → report to the user, leave the
   issue In Progress — never fabricate a close.
3. Known landmines (do not re-learn them the hard way):
   - `git push` on a branch without upstream silently no-ops — always push `origin main`
     explicitly from your own commits;
   - never run the swarm from a non-`main` branch; `checkout -B` recreates task branches
     and the reflog-rescue (v1.2) recovers lost work automatically;
   - the executor runs with `opencode run --auto` (owner-directed autonomy); all other
     roles are permission-gated on purpose.

## 5. Report

When the run ends, summarize to the user in THEIR language: which issues were picked,
what shipped (version, PR, CI runs, prod-QA verdicts), what was closed and why. Linear is
the source of truth — quote its final states. Then stop; never start another run without
the user asking (or a queued `--max` they requested).
