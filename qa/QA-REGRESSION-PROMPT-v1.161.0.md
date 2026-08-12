# QA REGRESSION PROMPT — career-ops-ui **v1.161.0** (FIX-3: "score not detected" chip)

**Audit finding (MEDIUM, `FIX-PROMPT-post-v1.158.0.md` SHIP 3).** Because a report can still lack a parseable score even after the v1.159.0 locale-aware parser, `#/reports` cards rendered a blank metadata area with no explanation — the user couldn't tell "failed" from "unparsed", and there was no recovery affordance. Client-only fix. Pairs with `qa/QA-REGRESSION-PROMPT.md` and builds on v1.159.0 (FIX-1).

- **Under test:** `package.json` **1.161.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2416, exit 0 (capture $? directly, never | grep)
node --test tests/reports-unparsed-chip.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.161.0
```

## §1 — Root cause + fix

- `public/js/views/reports.js` score cell was `rep.scoreNum != null && pill` — a falsy `&&` that rendered **nothing** when the score was null. Now it branches: parsed → the tone pill; **null → a muted `.score-muted` chip** reading `rep.scoreUnparsed` ("Score not detected", ×17) with the `rep.scoreUnparsedHint` tooltip ("Open the report to see the score").
- The card itself stays a keyboard-operable `role="link"` that navigates to the report (where the score is in the body); the chip is a non-nested visual span (no nested-interactive a11y violation). The date still renders (v1.159.0 mtime fallback).
- Reuses the existing neutral `.score-muted` token — no new colour (`score-tone.js` already classes a no-score row as *muted*).

## §2 — Manual pass

1. **A report with no parseable score** — write `reports/x.md` = `# Note\n\n(no score, no Machine Summary)`. On `#/reports` its card shows a **muted "Score not detected" chip**, not empty space; hovering shows the "Open the report…" tooltip.
2. **Click / Enter on the card** — navigates to `#/reports/x` (the score, if any, is visible in the body).
3. **Scored reports unchanged** — a report with a score still shows the coloured tone pill.
4. **Locale** — repeat in `ru`/`ja`/`ar`: the chip text is localized, the muted tone is identical.

## §3 — Invariants

- **Client-only** — no route, CSP, SSRF, or parent-write change. +2 i18n keys ×17 (`rep.scoreUnparsed`, `rep.scoreUnparsedHint`); snapshot **1217 → 1219**, parity ×17, i18n-audit clean.
- **No new colour** — the chip uses `.score-muted` (existing neutral token), never red.
- **A11y** — the chip is not separately focusable; the card remains the single `role="link"` navigation control.

## §4 — Sign-off

Suite **2416** green · an unparsed report shows the muted "Score not detected" chip + tooltip · the card navigates on click/Enter · scored reports unchanged · chip localized ×17 · no route/CSP/SSRF/parent-write change. **Closes SHIP 3 (FIX-3, MEDIUM).**
