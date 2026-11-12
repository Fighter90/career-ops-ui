# Agent Swarm — architecture

> A swarm of agents for career-ops-ui: a task from Linear automatically passes the full
> lifecycle — develop → test → review → release → deploy → prod verification — with no
> human in the loop. Run: `node scripts/swarm/orchestrator.mjs --max 1` (from `web-ui/`).
> Spec: `docs/sdd/specs/2026-11-08-agent-swarm.md`. Process prototype: the "Swarm over one
> environment" talk (Podlodka AI Crew, Oct 2026).

## How it works

```
                    LINEAR (Carrer-ops-ui, Todo + label `swarm`)
                                        │  pick
                                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR  scripts/swarm/orchestrator.mjs                             │
│  a deterministic state machine: git / npm / gh / marker parsing.          │
│  It NEVER decides what code to write.                                     │
└───┬───────────────┬───────────────┬───────────────┬──────────────┬────────┘
    │ claim         │ diff          │ texts         │ git+gh       │ gh run
    ▼               ▼               ▼               ▼              ▼
┌─────────┐   ┌───────────┐   ┌───────────┐   ┌────────────┐  ┌─────────────┐
│ CLERK   │   │ EXECUTOR  │   │ REVIEWER  │   │ DOCUMENTER │  │ RELEASE MGR │
│ (GLM)   │   │ (GLM)     │   │ (GLM,     │   │ (GLM)      │  │ + PROD TESTER│
│ Linear: │   │ red-first │   │ fresh     │   │ changelog  │  │ (no LLM)    │
│ InProg/ │   │ coding on │   │ context,  │   │ + story    │  │ PR→CI→merge │
│ Done    │   │ a branch  │   │ ACCEPT/   │   └────────────┘  │ →tag→Release│
└─────────┘   └───────────┘   │ RETURN    │                   │ →deploy→    │
      ▲             │         └─────┬─────┘                   │ verify      │
      │             ▼               │ RETURN (≤3 rounds)      └──────┬──────┘
      │      ┌────────────┐         │ back to EXECUTOR          ┌────────────┐
      │      │ TESTER     │◀────────┘   npm run test:ci        │ PROD TESTER │
      │      │ (no LLM)   │────────▶                           │ remote-qa   │
      │      │ gates      │                                    │ (perf/live) │
      │      └────────────┘                                    └────────────┘
      │         Linear: Done + evidence comment
      └──────────────────────────────────────────────────────────────────────┘
```

## Roles

| Role | Runs on | Does | Prompt file |
|---|---|---|---|
| **Orchestrator** | Node, no LLM | The state machine: picks the task, checks out a branch, drives workers, parses markers, runs git/gh | `orchestrator.mjs` |
| **Clerk** | GLM (`opencode run`) | The only role that touches Linear: pick, claim → In Progress, Done/Canceled + evidence comment | `roles/clerk.md` |
| **Executor** | GLM | Implements the issue red-first on branch `swarm/<id>`; commits; prints `DEV_SUMMARY: status: done\|already-implemented\|…` | `roles/executor.md` |
| **Tester** | **no LLM** | Deterministic gates `npm run test:ci`; a red run feeds its output tail back to the executor | — |
| **Reviewer** | GLM, **fresh context** | Sees ONLY the diff and the issue (never the executor's reasoning). Verdict `VERDICT: ACCEPT` / `VERDICT: RETURN: notes` | `roles/reviewer.md` |
| **Documenter** | GLM | The human story: changelog bullet + a Notes bullet with the deliberate non-goal + 3-sentence `STORY:` | `roles/documenter.md` |
| **Release manager** | no LLM | PR → CI → squash-merge → `npm version patch` → changelog ×19 (label-stub entries) → QA-prompt rotation → tag → Release → publish → Pages → deploy → `ok=true` | orchestrator code |
| **Prod tester** | no LLM | `remote-qa.yml -f perf=true` (live via `SWARM_REMOTE_QA_LIVE=1`) → job verdicts | orchestrator code |

**All LLM roles run on one model, GLM-5.3** (owner directive). The review is independent
because of the **fresh context**: the reviewer receives only the task and the diff, never
the executor's reasoning. (The talk's ideal "reviewer from another model family" degrades
honestly: a second authenticated CLI would restore it — codex/claude/qwen are unavailable
on this machine today.)

## Cycle, step by step

1. **Pick** — the clerk finds the first Todo issue labeled `swarm` → `SWARM_PICK::id::CAR-xxx::title`.
2. **Claim** — the clerk sets In Progress + a "🎯 Swarm claimed" comment.
3. **Develop** — `git checkout -B swarm/car-xxx origin/main`; the executor codes red-first.
4. **Tester** — `npm run test:ci`; green → continue, red → the output tail goes back to the executor.
5. **Review** — the reviewer judges the diff. `ACCEPT` → continue; `RETURN` → notes → the executor (max 3 rounds, then blocked).
6. **Document** — the documenter writes the changelog bullets + `STORY:`.
7. **Release** — PR → CI → squash → `npm version patch` → changelog ×19 → QA prompt → tag `vX.Y.Z` → Release → publish → Pages → `deploy.yml` → grep `ok=true version=…`.
8. **Prod test** — `remote-qa.yml -f perf=true` → all job verdicts.
9. **Done** — the clerk: Linear Done + an evidence comment (PR, version, runs, story). Branch deleted.

## Feeding tasks to the swarm

1. Create a Linear issue in the **Carrer-ops-ui** team: a one-line actionable title, the
   description carries the acceptance criteria. Keep it SMALL — one cycle ships one task.
2. Set state **Todo** and add the label **`swarm`** — that label is the ONLY claim trigger.
3. Run the orchestrator (`--max 1` per task, or `--max 3` for a queue). A daemon variant is
   any scheduler that reruns the command (cron / launchd); the lock file makes reruns safe.

## Safety valves

- Only Todo issues labeled `swarm` are claimed — the owner opts each task in.
- `--max N` (default 1) · `--dry-run` (pick + plan only) · `--no-release` (stop after ACCEPT) · `--rounds N`.
- A clean tree is required; the `.task-board/lock` file blocks a second instance.
- Any failure → the clerk comments `⚠️ Swarm failed at <step>` on the issue; the issue stays
  In Progress; the branch is kept for a human. The board is the source of truth: the
  orchestrator is restartable and resumes from the board.

## Deliberate v1 simplifications

- Changelog ×19 locales are **label-stubbed EN entries** (CI parity passes; translation
  remains a separate human step).
- No worktree isolation (cycles are sequential); parallelism is a follow-up.

## What the release step does (v1.5+)

The release phase is deterministic code in `orchestrator.mjs`, executed by the release
manager after ACCEPT:

- `npm version patch`, then CHANGELOG ×19 (the entry lands **below** each locale's
  preamble — the `changelogInsert` guard), QA prompt for the new version (the previous
  one moves to `qa/archive/superseded-prompts/`).
- **README ×19 banner rotation** (`rotateReadmeRelease`): the 🆕 lead takes the new
  version, the old lead is demoted into the trail line, the release/tests badges and the
  lead's trailing localized test count follow. The user directive «при каждом пуше
  актуализировать Readme» is also enforced out-of-band by
  `tests/readme-version-gate.test.mjs` (TRACEABILITY R-13): any push where a README
  lead/badge lags `package.json` fails CI.
- SDD baselines (`docs/sdd/CONVENTIONS.md`, `.claude/PROJECT-CONTEXT.md`) are bumped
  from the gated tree's own test count (`captureTestCount` + `baselineBump`).
- The salvage path refuses an "already merged" Done unless the commit subject carries a
  PR-squash marker `(#N)` — the false-Done guard (CAR-269 was closed as Done twice by
  infra commits that merely mentioned the identifier).
