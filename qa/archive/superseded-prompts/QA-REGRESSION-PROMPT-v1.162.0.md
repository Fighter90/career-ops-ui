# QA REGRESSION PROMPT — career-ops-ui **v1.162.0** (FIX-4: "?" target size ≥24×24)

**Audit finding (MEDIUM, `FIX-PROMPT-post-v1.158.0.md` SHIP 4).** The `.help-hint` "?" affordance inside every page `<h1>` measured 18×18 CSS px with `padding:0` — below the WCAG 2.5.8 *Target Size (Minimum)* 24×24 floor. It is keyboard-operable and `aria-label`ed, so this is a pointer-target defect only, but it is on every page. CSS-only fix.

- **Under test:** `package.json` **1.162.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2418, exit 0 (capture $? directly, never | grep)
node --test tests/help-hint-target-size.test.mjs tests/document-title-per-route.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.162.0
```

## §1 — Root cause + fix

- `.help-hint` was `width:18px; height:18px; padding:0`. Now the **element box is 24×24** (the measurable pointer target) and the **visible ring is 18px**, drawn by a centered `.help-hint::before`. The box border/background moved to `::before` so a 24px box doesn't enlarge the glyph; hover/`aria-expanded`/focus-visible states target `::before`; the margin trims 6→3px so the horizontal gap to the title text is unchanged.
- Page-title lines are taller than 24px, so the taller box does not shift the `<h1>` baseline/line-height. The v1.158.0 `document.title` clone-strip (which removes `.help-hint`) is JS-only and unaffected.

## §2 — Manual pass

1. **Measure the "?"** on `#/scan` (and one more heading) — the `.help-hint` bounding box is **≥24×24 px**; the visible circle still looks 18px.
2. **Hover / focus / open** — hover fills the ring red, `focus-visible` shows the ring outline, click opens the popover, Escape closes it (unchanged behaviour).
3. **Layout** — the page-title baseline and the gap between the title text and the "?" are visually identical to before; no wrap/shift at 320–1920 px, LTR and RTL.
4. **Tab title** — the browser tab still reads "…" without a trailing "?" (v1.158.0 fix intact).

## §3 — Invariants

- **CSS-only** — no JS, i18n, route, CSP, SSRF, or parent-write change.
- **Glyph unchanged** — the visible ring is 18px (`::before`); only the transparent hit box grew to 24×24.
- **No baseline shift** — `<h1>` line-height and the title↔"?" gap are unchanged.

## §4 — Sign-off

Suite **2418** green · `.help-hint` measures ≥24×24 on ≥2 routes · visible ring still 18px · hover/focus/open/Escape unchanged · no baseline shift LTR+RTL · `document.title` still "?"-free. **Closes SHIP 4 (FIX-4, MEDIUM).**
