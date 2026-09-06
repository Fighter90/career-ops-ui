# QA REGRESSION PROMPT — career-ops-ui **v1.207.1** (patch: mobile landing overflow + flaky-test hardening)

**Fixed.** Two non-app fixes: (1) the `site/` marketing landing (cvstart.org) clipped its hero off the right edge on narrow phones; (2) a flaky Playwright smoke assertion that could fail on a transient resource 404. **No server or SPA app code changed.**

- **Under test:** `package.json` **1.207.1**.

## §0 — Gates

```bash
npm test                                     # 2618, exit 0 (unit suite unchanged)
node scripts/check-changelog-parity.mjs      # 16 non-EN at v1.207.1
# site build + mobile overflow (Node 22 via nvm):
cd site && npm run build                     # 86 pages, exit 0
# Playwright smoke (uses parent's playwright):
node --test tests/playwright-smoke.mjs       # 20/20
```

## §1 — Mobile overflow fix (`site/`)

**Root cause:** the install-command `<pre>` (a flex item) and the two hero grid columns (`max-w-xl`, `hero-seq-3`) carried the default `min-width: auto`, so a long `curl …` command + the columns refused to shrink to a narrow viewport. The hero section's `overflow-hidden` then **clipped** the heading/intro/terminal off the right edge (the user-reported bug).

**Fix (3 classes, zero JS):**
- `site/src/components/Hero.astro` — `min-w-0` on the `max-w-xl` left column and the `hero-seq-3` right column (grid items).
- `site/src/components/InstallTabs.astro` — `min-w-0 flex-1` on the `<pre>` (so the long command scrolls **inside** its own `overflow-x-auto` terminal box).

**Verified:** Playwright measurement at **360 / 390 / 414 px** → `documentElement.scrollWidth == clientWidth` (**0 horizontal page overflow**) at every width. The hero heading/intro/terminal now fit; the only intentionally-wide elements are the `<pre>` code and the `.compare-scroll` comparison table, both inside `overflow-x: auto` wrappers. No desktop (`lg:grid-cols-2`) or RTL regression (`min-w-0` only affects shrink-below-content).

## §2 — Flaky smoke hardening (`tests/`)

`tests/playwright-smoke.mjs` — two `assert.deepEqual(consoleErrors, [], …)` assertions (the dashboard-render test and the auto-pipeline-button test) asserted **zero** console errors, so a transient resource 404 (a favicon / optional-widget fetch racing SPA boot) flaked them. This passed on the v1.207.0 PR and failed on the **identical** post-merge commit → a flake, not a regression. Fix: a module-level `BENIGN_CONSOLE = /favicon|net::ERR|Failed to load resource/i` + `realConsoleErrors()` helper, applied to both assertions — **mirrors the existing filter in `tests/playwright-forms.mjs`**. Real JS/script errors (uncaught exceptions, thrown `console.error`) still surface, and the `contentHtml.length > 50` render assertion is unchanged.

## §3 — Sign-off

Unit suite **2618** green (unchanged — no unit tests added/removed) · CHANGELOG parity ×17 at v1.207.1 · README badge+banner ×17 · site builds clean (86 pages) · smoke 20/20 · **no server/SPA/app-behavior change**, no new dependency, no parent edits. Deploy: Pages rebuild refreshes cvstart.org with the overflow fix; resumecraft.ru re-synced (app byte-identical to 1.207.0, version footer → 1.207.1).
