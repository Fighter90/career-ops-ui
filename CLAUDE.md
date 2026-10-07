# career-ops-ui — agent entry point

This file is deliberately a **short index, not a knowledge base**. Long instructions
here get skimmed and then ignored; the detail lives in files that are loaded when
they are relevant.

| Read this | When |
|---|---|
| [CONTEXT.md](CONTEXT.md) | **first** — domain dictionary. One accepted name per concept. Settles `source` vs `adapter` (109 vs 104), `mirror` vs `relay`, `telegram` vs `telegram-channel`. |
| [PROGRESS.md](PROGRESS.md) | at session start — current state, next step, known issues, and **abandoned approaches** you should not retry. |
| [docs/adr/](docs/adr/) | before changing anything the records cover — why a choice was made, and what would make us revisit it. |
| [docs/sdd/CONVENTIONS.md](docs/sdd/CONVENTIONS.md) | while writing code — module system, routes, sanitizers, i18n, testing. |
| [docs/sdd/](docs/sdd/) — `PLAN.md`, `TRACEABILITY.md`, `specs/` | before starting work — the program plan, the invariant→gate matrix, and **the only specifications folder** (`docs/sdd/specs/`; there is no `docs/specs/`). |
| [AGENTS.md](AGENTS.md) | non-Claude CLIs — same rules, portable phrasing. |
| [.claude/skills/](.claude/skills/) | `parent-sync` (parity releases), `contributor-pr`, `hermes-bridge`. Invoke the skill rather than improvising the pipeline. |

## Non-negotiable

- **The parent project (`..`) is read-only** except a user-authorised `git pull`.
- **Never point a test at the real parent.** `CAREER_OPS_ROOT=$(mktemp -d)` plus
  dynamic imports inside `before()`.
- **Counts come from the live registry**, never hand-edited into the gate tests.
- **Every release ships a QA prompt** (`qa/QA-REGRESSION-PROMPT-v<version>.md`),
  patches included.
- **Every release runs the full regression on BOTH stands** — local `127.0.0.1:4317`
  and prod (resumecraft.ru): all views, ×17 locales, live LLM (`remote-qa -f live=true`)
  and scanner (`-f scan=true`). Findings go to Linear (Russian) immediately and are
  executed until done.
- **Every release updates: CHANGELOG ×17 (EN + 16 locales, parity green), the wiki
  (Home ×17 banners + counts + Roadmap), the site build (cvstart.org), `PROGRESS.md`,
  and a spec in `docs/sdd/specs/` with real verification output.** Linear statuses move
  with the work (In Progress → In Review → Done on deployed-and-verified). Full list:
  `docs/sdd/HANDOFF.md` → *Post-release standing rules*.
- **Verify before claiming done.** A passing unit suite is not an end-to-end check —
  see the premature-success note in [PROGRESS.md](PROGRESS.md).

Working practice follows [Agentic Coding Design Patterns](https://mokevnin.github.io/agentic-coding-design-patterns/);
the patterns this repo implements are listed in the wiki under *Agentic Practices*.
