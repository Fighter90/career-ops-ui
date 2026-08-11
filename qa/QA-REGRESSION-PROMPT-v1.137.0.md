# QA REGRESSION PROMPT — career-ops-ui **v1.137.0** (readability & rendering)

User-reported UX pass (no parent-sync). Dark-mode contrast, chart labels, career-plan rendering. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.137.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite — 2345, exit 0 (capture $? directly, never | grep)
node --test tests/dark-theme-tokens.test.mjs   # alias tokens declared + mapped to theme-aware tokens
node --test tests/css-modularization.test.mjs  # app.css still < 800 LOC after the alias block
node scripts/check-changelog-parity.mjs        # all 16 locales at v1.137.0
```

## §1 — What changed (all client-side; no server/route/schema change)

- **Dark-mode contrast root fix** — 15 CSS custom properties (`--fg`, `--panel`, `--panel-2`, `--surface-elev1`, `--line`, `--ok`, `--go`, `--err`, `--error`, `--danger`, `--warn`, `--muted`, `--ink`, `--card`, `--border`) that views referenced but the palette never declared are now **aliased on `:root`** to the real theme-aware tokens (`--hof`/`--paper`/`--slate`/`--kazan-text`/`--rausch-text`/`--darjeeling-text`/`--foggy`). `.tab-btn.is-active` moved from a solid-pink-pill + white text to the tinted-badge pattern.
- **`#/stats` chart labels** ellipsize (`…`) + hover `<title>`; label column widened 150→200.
- **`#/career-plan`** auto-renders the generated plan as formatted HTML (was raw Markdown).

## §2 — Manual browser pass (do this in DARK mode — toggle the theme)

1. **`#/pipeline`** — the overview chips ("N in inbox / tracked / Applied…") are readable (dark chip, light text), not white-on-white.
2. **`#/stats`** — the active tab label is readable; bar-chart role labels show `…` when long with the full name on hover, not cut mid-word.
3. **`#/config`** — "Active: … / Keys: N / 5" and "✓ set" are readable; the active tab ("API keys & runtime") is a readable tinted pill.
4. **`#/two-pager`**, **`#/mock-interview`** — section labels / the interviewer question bubble are readable.
5. **`#/career-plan`** → Generate — the plan appears as formatted headings/tables/bold (no raw `##`/`**`); the textarea below still holds the editable Markdown; Preview toggles the rendered view.
6. **Light mode unchanged** — toggle back to light; every screen looks exactly as before (the aliases resolve to the same light values that were previously hardcoded).

## §3 — Invariants

- **No new i18n keys, no source-count change** — help ×17 untouched; `#/scan` Source filter unchanged (still 79).
- **XSS boundary intact** — career-plan still renders via `UI.md()` (escape-first), same as reports/orientation.
- **Contrast** — an alpha-composited auditor reports **0 WCAG-AA text failures across all 29 views** in dark mode.

## §4 — Not in this release (see `docs/UX-ROADMAP.md`)

`?`-help hints + page descriptions ×17, clearer empty states, generation-in-UI-language (Phase 2); richer salary stats + interactive charts + Unknown-archetype fix + funded enrichment (Phase 3); portals→settings + filter redesign (Phase 4).

## §5 — Sign-off

Suite **2345** green · **0 dark-mode WCAG-AA failures** / 29 views · pipeline/stats/config/two-pager/mock-interview readable in dark · career-plan renders formatted · light mode byte-identical · CHANGELOG parity ×17.
