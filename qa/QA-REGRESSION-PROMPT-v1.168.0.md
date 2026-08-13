# QA REGRESSION PROMPT — career-ops-ui **v1.168.0** (D-2: checkbox target size)

**Audit finding (LOW, a11y — `FIX-PROMPT-post-v1.158.0.md` SHIP 9 / D-2).** Checkbox/radio-wrapping labels on `#/scan`, `#/config`, `#/evaluate`, `#/cv-studio` sat in a ~22 px band — 2 px under the WCAG 2.5.8 Target Size (Minimum) 24×24 floor. CSS-only fix.

- **Under test:** `package.json` **1.168.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2429, exit 0 (capture $? directly, never | grep)
node --test tests/checkbox-target-size.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.168.0
```

## §1 — Fix

- A scoped rule `label:has(> input[type="checkbox"]), label:has(> input[type="radio"]) { min-height: 24px; align-items: center }` guarantees a ≥24 px clickable band. `min-height` only — every such label is already flex/inline-flex (`.flex`, inline-flex), so the band only grows when it's below 24 px and nothing shifts. `.apply-checklist` rows (32 px) were already compliant. `:has()` is graceful: unsupported → rule ignored, no breakage.

## §2 — Manual pass

1. **Measure** the checkbox rows on `#/scan` (dry-run, favorites-only), `#/config` (Appearance → company logos), `#/evaluate` (save JD), `#/cv-studio` — each label band is **≥24 px** tall; clicking anywhere on the row toggles.
2. **Layout** — the rows look identical to before (no wrap/shift), LTR + RTL, light + dark.

## §3 — Invariants

- **CSS-only** — no behaviour, JS, i18n, route, CSP, SSRF, or parent-write change.
- **No layout regression** — `min-height` only; flex labels grow to 24 px, inline labels unaffected.

## §4 — Sign-off

Suite **2429** green · checkbox rows ≥24 px on the four views · no layout shift LTR+RTL/light+dark · `.apply-checklist` unchanged · parity ×17. **Closes SHIP 9 / D-2 (LOW).**
