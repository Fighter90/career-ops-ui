# Spec — German, Italian & Turkish locales (v1.85.0)

**Status:** implemented · **Date:** 2026-07-03 · **Release:** v1.85.0
**Epic:** parent career-ops v1.16.0 locale parity (issue-driven: "add the missing languages from the parent repo").

## Problem

The parent [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) reached **1.16.0** and ships `modes/` for `de`, `it` and `tr` that this UI did not have. career-ops-ui shipped **13 UI locales** (`en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr, pl, uk, da, ar`) — missing German, Italian and Turkish. The goal: bring the UI to **16 locales** with full parity (UI strings, in-app Help guide, README, CHANGELOG, and localized LLM-prompt scaffolding), so a `de`/`it`/`tr` user sees a fully translated product.

Non-goals: Korean stays UI-only in this repo (the parent lacks a `ko` mode dir); no changes to the parent (read-only per hard rule #1).

## Design

A new locale is a **data addition following the documented recipe** (see `docs/LOCALIZATION.md` and `CLAUDE.md` → i18n). Each of `de`, `it`, `tr` requires:

| Layer | File(s) |
|---|---|
| UI dictionary | `public/js/lib/locales/i18n-dict.{de,it,tr}.js` — all 730 keys, byte-identical key set to `en`, translated values, `window.__I18N_DICT_{DE,IT,TR}` |
| Assembler | `public/js/lib/i18n-dict.js` — `LANGS` + `TABLES` |
| Runtime | `public/js/lib/i18n.js` — `LANGS` (code/label/flag) + `detect()` |
| Load order | `public/index.html` — three `<script src>` tags before the aliases file |
| Prompt scaffolding | `server/lib/prompts.mjs` — `LOCALE_NAMES` + `SCAFFOLD_STRINGS` (readFiles, userContext, modeTemplate, modeRoleLine, evalRoleLine) |
| Help guide | `docs/help/{de,it,tr}.md` — full 19 H2 / 75 H3 structure, served by `GET /api/help/:lang` |
| Docs | `README.{de,it,tr}.md`, `CHANGELOG.{de,it,tr}.md` (seeded at v1.85.0 — no back-translation of prior history) |
| Test/tooling arrays | `tests/helpers/i18n-vm.mjs` `I18N_LANGS`, `tools/i18n-audit.mjs`, `scripts/check-changelog-parity.mjs`, `tests/lang-switcher-rtl.test.mjs` (deepEqual list 13→16) |
| Snapshot | `tests/fixtures/i18n-dict.snapshot.json` — regenerated from the real assembler |

### Decisions

- **CHANGELOG seeding, not back-translation.** `CHANGELOG.{de,it,tr}.md` start at v1.85.0 with a pointer to `CHANGELOG.md` for older history. Honest and cheap; the parity gate only checks the newest version heading.
- **Latin-script exemption.** `de/it/tr` are Latin-script, so `tests/i18n-no-latin-leaks.test.mjs` (which only guards the non-Latin locales) needs no change.
- **RTL untouched.** Only `ar` is RTL; the three new locales are LTR, so `app.css`/`RTL_LANGS` are unchanged.
- **Translation fidelity.** Keys, code, paths, CLI, URLs, env vars, placeholders and proper nouns stay verbatim; only prose/value strings are translated (formal register).

## Verification

Green gates: `i18n-locale-files` (key parity + lossless snapshot), `i18n-coverage` (every key in all 16 + every `t()` resolves), `lang-switcher-rtl` (16 codes with label+flag), `i18n-no-latin-leaks`, `locale-scaffold` (prompt localization), `check-changelog-parity` (all 15 non-EN CHANGELOGs at v1.85.0), `tools/i18n-audit.mjs`, plus the full `node --test` suite.
