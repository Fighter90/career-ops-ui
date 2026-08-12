# QA REGRESSION PROMPT — career-ops-ui **v1.150.0** (consistent empty states)

A small visual-consistency fix (no parent-sync, no server/route/CSS-rule change). Four views drop a redundant inline override on their empty-state panels so every `.empty` panel renders through the one shared, tokenized style. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.150.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                            # full suite — 2385, exit 0 (capture $? directly, never | grep)
node --test tests/empty-state-consistency.test.mjs  # .empty single-source-of-truth (2 tests)
node scripts/check-changelog-parity.mjs             # all 16 non-EN locales at v1.150.0
node tools/i18n-audit.mjs                             # app dict clean; snapshot UNCHANGED 1208 (no new keys)
```

## §1 — What changed (client CSS-usage cleanup only; ZERO rule/route/i18n/server change)

- **`public/js/views/{activity,cv-studio,stats,usage}.js`** removed the inline `style: { padding: '40px', textAlign: 'center', color: 'var(--foggy)' }` from their empty-state `.empty` panels. All three properties are already provided by the shared `.empty` class (`padding: var(--space-7)` = **48px**, `text-align: center`, `color: var(--foggy)`, `2px dashed` border), so the magic `40px` is gone and the four now render identically to the ~25 other `.empty` panels.
- The `.empty` CSS **rule itself is unchanged**. Genuine per-view overrides — `#/dashboard` `width:100%`, `#/pipeline` `border:none` — are left in place.

## §2 — Manual browser pass (each of the four has a reachable empty state)

1. **`#/activity`** with no activity yet → the empty panel shows centered muted text inside a **dashed** border with comfortable (48px) padding.
2. **`#/cv-studio`** with no CV → the "No CV yet" empty panel + "Open CV" button render in the same dashed-border style.
3. **`#/stats`** with no scan data → each tab's empty state matches.
4. **`#/usage`** with no LLM usage recorded → the empty panel matches.
5. **Cross-check** — these now look identical to other empty states (e.g. `#/reports`, `#/tracker`) — same padding, centering, dashed border.
6. **Dark theme + RTL** — the dashed border (`--slate`) and muted text (`--foggy`) stay legible; RTL centers the same.
7. **No console errors.**

## §3 — Invariants

- **No `.empty` rule change** — only the four views' *usage* of it changed; the class is the single source of truth (guarded by `tests/empty-state-consistency.test.mjs`).
- **No route/server/i18n/CSS-rule change** — app dict snapshot stays **1208**.
- **Legit overrides preserved** — `#/dashboard` and `#/pipeline` empty panels keep their intentional width/border overrides.
- **CHANGELOG parity** — 17 locales, newest `## [1.150.0]`.

## §4 — Not in this release (see `docs/UX-ROADMAP.md`)

- **Further whole-app visual refinement** — an ongoing quality bar; welcome with specific direction.
- **Phase 5** — the Hermes/Nous LLM-provider integration stays blocked on the API-contract spike.

## §5 — Sign-off

Suite **2385** green · empty-state-consistency 2/2 · the four empty panels render via the shared `.empty` (48px padding + dashed border, no inline override) · matches every other empty state · dark + RTL legible · 0 console errors · i18n snapshot 1208 · CHANGELOG parity ×17.
