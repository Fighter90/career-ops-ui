# QA REGRESSION PROMPT — career-ops-ui **v1.103.0** (AI CLI tools settings panel)

Delta regression for the **AI CLI tools** tab in `#/config`. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.103.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite (cli-detect-routes ×3)
node --test tests/cli-detect-routes.test.mjs   # PATH resolve with a stub exec (never run), detect shape, endpoint
node --test tests/i18n-coverage.test.mjs       # 8 new cli.*/config.tabCli keys ×16, zero missing
node --test tests/help-ui.test.mjs             # 28 H2 per bundle (unchanged)
node scripts/check-changelog-parity.mjs         # all 15 locales at v1.103.0
```

## §1 — What changed

**App settings** (`#/config`) gains a 4th tab, **AI CLI tools** (deep-link `#/config?tab=cli`).

1. Open the tab → `GET /api/cli-detect` lists Claude Code, Codex, Gemini CLI, OpenCode, GitHub Copilot CLI, Qwen, Antigravity, each with an **installed ✓ / — not found** badge and, when found, its resolved path.
2. The result reflects the machine running the **server** (its `PATH`), not the browser.

## §2 — Contract & security invariants

- **Never executes.** Detection is a pure PATH scan — it resolves the *path* of a binary but never spawns it, never runs `--version`. A hostile file on `PATH` cannot be run by this route. (The test's stub prints a sentinel that must never appear.)
- **Fixed allowlist.** The 7 binary names are hardcoded, never from request input — no command injection surface.
- **No writes / no LLM / no network / no user data.** `GET /api/cli-detect` reads only `process.env.PATH` + the filesystem stat of candidate paths.
- **CSP-safe.** `UI.el` + `addEventListener`; lazy-loaded on first tab activation.

## §3 — i18n

8 new keys (`cli.*` + `config.tabCli`) present + translated in all **16** locales. Switch locale: the tab label, title/subtitle, installed/not-found badges, and the "none detected" hint read in-language. Arabic RTL.

## §4 — Sign-off

All §0 gates green · the tab lists the 7 CLIs with correct installed/not-found + paths on this machine · no binary is ever executed · nothing written to disk · 8 keys ×16 · never-execute / fixed-allowlist / no-writes / CSP invariants intact.
