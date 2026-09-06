# QA REGRESSION PROMPT — career-ops-ui **v1.167.0** (FIX-9 / D-3: elevation token)

**Audit finding (LOW, design-system — `FIX-PROMPT-post-v1.158.0.md` SHIP 9 / D-3).** `--line`/`--border` AND `--panel-2`/`--surface-elev1` all resolved to `--slate`, so an elevated panel/chip inside a bordered card had no separation in either theme. CSS-token-only fix.

- **Under test:** `package.json` **1.167.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2428, exit 0 (capture $? directly, never | grep)
node --test tests/elevation-token.test.mjs tests/dark-theme-tokens.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.167.0
```

## §1 — Fix

- A dedicated theme-aware **`--elev`** token backs the raised surfaces: `#eef1f6` (light) / `#1e232e` (dark) — distinct from `--slate` (`#ebebeb` / `#2a2f3a`) in both themes. `--panel-2` and `--surface-elev1` now resolve to `--elev`; the hairlines `--line`/`--border` stay on `--slate`. `--elev` is declared in the light `:root` and BOTH dark blocks, so it follows the theme.
- The other design-export findings are restated as tracked backlog in `docs/UX-ROADMAP.md`: **D-2** (checkbox target size — per-view, its own release), **D-4** (type-scale/z-index tokens — standing P4 backlog), **D-5** (inline PDF preview — behaviour change), **P4-ETA** (long-generation ETA — behaviour change).

## §2 — Manual pass

1. **Elevated chips/bubbles** — on `#/pipeline` (overview chips), `#/two-pager` (fit chips), the docs-assistant / mock-interview chat bubbles, `#/funded` (amount bars): the raised fill (`--panel-2`) is visibly distinct from the card border, in BOTH light and dark.
2. **Elevated panels** (`--surface-elev1`) — read as raised, not flush with the hairline.
3. **Contrast** — text on the elevated surfaces stays legible (dark-mode contrast guard green).

## §3 — Invariants

- **CSS-token only** — no behaviour, JS, i18n, route, CSP, SSRF, or parent-write change. `--line`/`--border` unchanged (still `--slate`).
- **Theme-aware** — `--elev` redeclared in the light `:root` + both dark blocks (`tests/dark-theme-tokens.test.mjs`).

## §4 — Sign-off

Suite **2428** green · elevated surfaces separate from hairlines in light + dark · `--elev` distinct from `--slate` both themes · dark-mode contrast guard green · deferred D-2/D-4/D-5/P4-ETA tracked in UX-ROADMAP · parity ×17. **Closes SHIP 9 (FIX-9 / D-3, LOW).**
