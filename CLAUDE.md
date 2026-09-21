# career-ops-ui — agent entry point

This file is deliberately a **short index, not a knowledge base**. Long instructions
here get skimmed and then ignored; the detail lives in files that are loaded when
they are relevant.

| Read this | When |
|---|---|
| [CONTEXT.md](CONTEXT.md) | **first** — domain dictionary. One accepted name per concept. Settles `source` vs `adapter` (94 vs 89), `mirror` vs `relay`, `telegram` vs `telegram-channel`. |
| [PROGRESS.md](PROGRESS.md) | at session start — current state, next step, known issues, and **abandoned approaches** you should not retry. |
| [docs/adr/](docs/adr/) | before changing anything the records cover — why a choice was made, and what would make us revisit it. |
| [docs/sdd/CONVENTIONS.md](docs/sdd/CONVENTIONS.md) | while writing code — module system, routes, sanitizers, i18n, testing. |
| [AGENTS.md](AGENTS.md) | non-Claude CLIs — same rules, portable phrasing. |
| [.claude/skills/](.claude/skills/) | `parent-sync` (parity releases), `contributor-pr`, `hermes-bridge`. Invoke the skill rather than improvising the pipeline. |

## Non-negotiable

- **The parent project (`..`) is read-only** except a user-authorised `git pull`.
- **Never point a test at the real parent.** `CAREER_OPS_ROOT=$(mktemp -d)` plus
  dynamic imports inside `before()`.
- **Counts come from the live registry**, never hand-edited into the gate tests.
- **Every release ships a QA prompt** (`qa/QA-REGRESSION-PROMPT-v<version>.md`),
  patches included.
- **Verify before claiming done.** A passing unit suite is not an end-to-end check —
  see the premature-success note in [PROGRESS.md](PROGRESS.md).

Working practice follows [Agentic Coding Design Patterns](https://mokevnin.github.io/agentic-coding-design-patterns/);
the patterns this repo implements are listed in the wiki under *Agentic Practices*.
