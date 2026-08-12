# QA REGRESSION PROMPT — career-ops-ui **v1.143.0** (`?` hints, wave 2)

User-reported UX pass (no parent-sync). The `?` help affordance now covers the nine core workflow/decision views. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.143.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite — 2365, exit 0 (capture $? directly, never | grep)
node --test tests/help-hint.test.mjs           # the 9 workflow views wire HelpHint.title + EN keys present
node tools/i18n-audit.mjs                       # dictionary clean; snapshot 1195 keys
node scripts/check-changelog-parity.mjs        # all 16 locales at v1.143.0
```

## §1 — What changed (client only; reuses the v1.139.0 HelpHint primitive)

- **`?` on 9 more view titles** via `HelpHint.title`: `#/scan`, `#/evaluate`, `#/cv-studio`, `#/tracker`, `#/config`, `#/deep`, `#/batch`, `#/auto`, `#/apply`.
- 9 new i18n keys × 17 (`help.hint.scan`/`evaluate`/`cvStudio`/`tracker`/`config`/`deep`/`batch`/`auto`/`apply`); snapshot 1186→1195.
- `#/config` and `#/batch` each have two page-title `<h1>`s (main + error state) — **both** wired.

## §2 — Manual browser pass (switch UI language to a non-EN + RTL locale too)

1. Visit each of `#/scan`, `#/evaluate`, `#/cv-studio`, `#/tracker`, `#/config`, `#/deep`, `#/batch`, `#/auto`, `#/apply` — the page `<h1>` carries an inline `?`.
2. Click a `?` → a popover opens explaining the page in the UI language; **Escape** / outside-click closes it, focus returns to the `?`.
3. **RTL** (العربية) — the `?` sits on the correct side and the popover mirrors.
4. **Theme** — dark mode: popover readable (`--paper`/`--ink`), `?` hover fills accent.
5. **No console errors** on any of the nine.

## §3 — Invariants

- **CSP-safe** — same escape-first `UI.md()` render boundary + `addEventListener`; static `?` glyph.
- **i18n parity** — 17 locales, audit clean, snapshot 1195; non-Latin locales carry native script.
- **No server / schema change** — pure client wiring + i18n.

## §4 — Not in this release (see `docs/UX-ROADMAP.md`)

The lighter views (`#/dashboard`, `#/cv`, `#/reports`, `#/usage`, `#/pipeline`, `#/portals`, `#/activity`, `#/docs-assistant`) are a later `?` wave. Interactive stats charts (Phase 3). Portals→settings + filter redesign → **Phase 4 / v1.144.0**. Nous Research / Hermes → Phase 5 / 5b.

## §5 — Sign-off

Suite **2365** green · `?` opens/closes on all 9 workflow view titles · config + batch both-h1 wired · localized in non-EN · RTL mirrored · dark-mode readable · 0 console errors · i18n 17/17 · CHANGELOG parity ×17.
