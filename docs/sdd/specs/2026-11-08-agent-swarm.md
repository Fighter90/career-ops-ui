# SPEC — Agent Swarm (Linear → dev → review → release → prod-QA)

**Status:** shipped as `scripts/swarm/` · **Date:** 2026-11-08 · **Driver:** owner directive
("рой агентов: один ревьюит, второй кодит, третий артистирует — всё в автоматическом режиме",
алгоритм уточнён: задача из Linear → разработка → ревью → тесты → релиз-менеджер пушит и
деплоит → тестировщик гоняет прод).

## Goal

A single-command, repeatable pipeline that takes ONE task from the Linear board and carries it
through the full lifecycle without a human in the loop:

```
Linear (Todo + label `swarm`)
  └─ ОРКЕСТРАТОР  scripts/swarm/orchestrator.mjs  (deterministic state machine)
       ├─ CLERK (GLM)        claims the issue → In Progress + comment
       ├─ EXECUTOR (GLM)     red-first fix on branch swarm/<id>, scoped, commits
       ├─ TESTER (no LLM)    npm run test:ci — deterministic gates
       ├─ REVIEWER (GLM, fresh context)  diff review → VERDICT: ACCEPT | RETURN:notes
       │      RETURN → back to EXECUTOR (max 3 rounds, then blocked)
       ├─ DOCUMENTER-АРТИСТ (GLM)  the human story: changelog bullet + notes + narrative
       ├─ RELEASE MANAGER (no LLM) PR → CI → squash-merge → version bump →
       │      changelog ×19 (parity-safe stubs) → QA prompt rotation → tag →
       │      Release → publish → Pages → deploy.yml → verify (`ok=true`)
       ├─ PROD TESTER (no LLM)     remote-qa.yml (-f perf=true) → job verdicts
       └─ CLERK (GLM)        Linear → Done + evidence comment
```

## Model choice (owner directive)

**All LLM roles run on GLM-5.3 via `opencode run`** — the only authenticated CLI on this
machine (`codex` has no OPENAI_API_KEY, `claude` is not logged in, `qwen` is over quota).
The reviewer is a **separate worker with a fresh context** — it sees only the diff and the
issue, never the executor's session, so the review is independent even within one model
family (the Podlodka talk's "reviewer from another family" degrades honestly to
"independent context, same family" until a second authenticated CLI exists).

## Roles as prompts, process as code

Per the talk's "процессы как конфигурация": every LLM role is a **markdown prompt template**
(`scripts/swarm/roles/*.md`) the orchestrator fills with task facts; the state machine,
gates, git/gh operations are deterministic code. No LLM ever runs git or gh.

## Safety valves

- Claims only issues with the **`swarm` label** in **Todo** — the owner opts each task in.
- `--max N` tasks per run (default 1); single-instance lockfile in `.task-board/`.
- `--dry-run`: pick + plan only, no mutation, no workers.
- `--no-release`: stop after ACCEPT + document (no push, no deploy).
- Any failure → clerk comments `⚠️ swarm failed at <step>` on the issue, stays In Progress,
  non-zero exit. The board (Linear) is the source of truth; the orchestrator is restartable.
- Max 3 dev/review rounds; the branch is kept for human inspection on any blocked path.

## Deliberately NOT done (v1)

- No worktree isolation (sequential single-task cycles; parallelism is a follow-up).
- Changelog entries ×18 locales are **labeled EN stubs** (CI parity passes; the per-locale
  translation fan-out stays a human/subagent polish step).
- `remote-qa` runs with `perf=true` only; `-f live=true` (19 × LLM) stays opt-in via
  `SWARM_REMOTE_QA_LIVE=1`.
- Counters (PROJECT-CONTEXT/CONVENTIONS/HANDOFF/wiki) are not touched — not CI-gated.

## Verification

Real end-to-end run recorded in `.task-board/log/` and the Linear issue's evidence comment:
pick → claim → dev → gates → review ACCEPT → PR → CI ✓ → squash → v-patch release chain →
`ok=true version=…` → remote-qa perf ✓ → Linear Done.
