# QA REGRESSION PROMPT — career-ops-ui **v1.158.0** (cosmetic display fixes)

**User-reported NITs (both cosmetic, non-blocking).** (1) The HelpHint `?` affordance leaked into the browser-tab `document.title` ("Vacancy search?" instead of "Vacancy search"). (2) The cvstart.org landing feature card said "17 AI providers" while the stats banner on the same page said "7". Display-only — no server, route, CSP, SSRF, i18n-key, or data-flow change; no parent-sync. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.158.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2402, exit 0 (capture $? directly, never | grep)
node --test tests/document-title-per-route.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.158.0
```

## §1 — Root cause + fix

- **NIT-1 (app).** `HelpHint.title(text, key)` builds the page `<h1>` as `[<span>text</span>, <button class="help-hint">?</button>]`. `router.js::focusNewView` derived the per-route `document.title` from the raw `h1.textContent`, folding the "?" into the tab title and the screen-reader "page changed" announcement. **Fix:** it now deep-clones the heading, strips `.help-hint` from the *clone*, then reads `textContent` — the live DOM heading (and its visible "?") is untouched, and the tab reads "Vacancy search".
- **NIT-2 (site).** `site/src/components/Features.astro`'s `sub()` helper ran `.replace(/\{n\}/g, facts.locales)` (17) on every string *before* the per-card override could set the providers card to `facts.providers` (7), so the `.replace('{n}', …)` on line 42 was a no-op. **Fix:** `sub()` no longer touches `{n}`; each card resolves `{n}` itself (providers card → 7, languages card → 17) with a `/g` replace applied to both title and desc.

## §2 — Manual pass

1. **Tab title, any view with a `?` hint** (`#/scan`, `#/evaluate`, `#/deep`, the 8 AI/analytics views) — the browser tab / `document.title` reads e.g. "Vacancy search — career-ops-ui", **not** "Vacancy search? — …". The visible `?` help button in the `<h1>` is still present and still opens its popover.
2. **404 + heading-less fallback** — an unknown hash still titles the tab "404 — page not found — career-ops-ui" (title logic is defensive, no "undefined").
3. **cvstart.org landing** (`/` and a spot locale) — the **feature card** and the **stats banner** BOTH say **"7 AI providers"**; the languages card still says **"17 languages"**. No card shows "17 AI providers".

## §3 — Invariants

- **No behaviour/security change** — no route, CSP, SSRF, sanitizer, or i18n-key change. `facts.json` shape unchanged (`providers: 7`, `locales: 17`).
- **Live DOM untouched** — the title fix computes from a clone; the on-screen `?` affordance and its `addEventListener` handler are unaffected (still CSP-safe, no inline `on*=`).
- **CHANGELOG parity** — 17 locales at `## [1.158.0]`.

## §4 — Sign-off

Suite **2402** green · every `?`-hinted view titles its tab without the "?" · 404 fallback title intact · cvstart.org feature card + stats banner agree on **7 AI providers**, languages card still **17** · no server/CSP/SSRF/i18n change · CHANGELOG parity ×17. **Closes the four user-reported NITs (NIT-1 app title, NIT-2 site provider count; NIT-3/NIT-4 wiki handled in the wiki sweep).**
