# QA REGRESSION PROMPT — career-ops-ui **v1.154.0** (Cloud-deployment guide — docs-only)

career-ops has no cloud/server story of its own, so this adds one: a step-by-step guide for putting the **whole stack** — the parent `career-ops` pipeline, this `career-ops-ui` viewer, and the AI **engine** (a **Claude subscription** via the Claude Code CLI, a local **Hermes** gateway, or provider API keys) — on a small always-on server. Docs-only; no route/server/client change. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.154.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2396, exit 0 (capture $? directly, never | grep)
node --test tests/canonical-docs-coverage.test.mjs tests/help-ui.test.mjs tests/help-ru-config-section.test.mjs tests/locales-de-it-tr.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.154.0
```

## §1 — What changed (docs)

- **In-app Help §31 "Running the whole stack in the cloud"** (× 17 locales) — appended to every `docs/help/<locale>.md`. Structure: 1 H2 + 4 H3 (the three moving parts / provision + install / pick your engine / expose it safely). Help bundle now **31 H2 / 112 H3** (was 30/108).
- **README** — a `## Run the whole stack in the cloud` section (× 17) pointing to Help §31, `docs/integrations/HERMES.md`, and the wiki page; the stale **release badge** was refreshed v1.137.0 → v1.154.0 across all 17.
- **Wiki** — a dedicated **Cloud-Deployment** page, linked from Home.
- **Gate tests** — the four help-bundle parity tests move to the 31 H2 / 112 H3 contract.

## §2 — Manual pass

1. **`#/help`** — §31 renders in EN with the four subsections; the docs-assistant (`#/docs-assistant` / the floating FAB) answers a cloud-deployment question grounded in it.
2. **Locale sweep** — switch to a non-EN locale (e.g. `ru`, `ja`, `ar`); §31 appears translated, headings and code spans intact (code/URLs stay LTR in Arabic). No stray-script characters.
3. **README** — the new section links resolve (Help §31, `docs/integrations/HERMES.md`, the Cloud-Deployment wiki page).
4. **No console errors.**

## §3 — Invariants

- **Docs-only** — no route, no server, no client-code change, no new i18n key (help is Markdown, not the dict). No security-surface change. Parent read-only contract untouched.
- **CHANGELOG parity** — 17 locales at `## [1.154.0]`; app dict snapshot unchanged.
- **Suite count unchanged** — the four gate assertions were *updated* (30→31, 108→112), not added; total stays **2396**.

## §4 — Sign-off

Suite **2396** green · help bundle 31 H2 / 112 H3 across all 17 locales (gate tests pass) · §31 present + translated ×17 (no stray script) · README section + refreshed release badge ×17 · wiki Cloud-Deployment page linked from Home · CHANGELOG parity ×17. **Docs-only; no code surface touched.**
