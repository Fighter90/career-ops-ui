# QA Regression Prompt — v1.120.0 (parent v1.20.0 parity: the CareerOps Manifesto)

> Delta-focused sign-off for v1.120.0. Baseline: v1.119.5 (all green).
> Scope of the release: **no new server routes, no new scan adapters** — the delta is
> the CareerOps Manifesto surfacing across the SPA, help guide, READMEs, and the
> cvstart.org landing, mirroring parent career-ops v1.20.0 (which shipped
> `MANIFESTO.md`, `manifesto.mjs`, and dashboard/README manifesto links).

## What changed

1. **SPA sidebar footer** (`public/index.html` + `public/css/app.css`): a new outbound
   anchor `.manifesto-link` → `https://career-ops.org/manifesto`
   (`target="_blank" rel="noopener noreferrer"`, label via `data-i18n="footer.manifesto"`).
2. **i18n**: new `footer.manifesto` key in all 16 locale dicts + regenerated
   `tests/fixtures/i18n-dict.snapshot.json`.
3. **Help guide §29 "The CareerOps Manifesto"** in all 16 `docs/help/<lang>.md`
   bundles (+1 H2, +2 H3 → gates now **29 H2 / 105 H3**; bumped in
   `tests/help-ui.test.mjs`, `tests/canonical-docs-coverage.test.mjs`,
   `tests/help-ru-config-section.test.mjs`).
4. **README ×16**: a "The CareerOps Manifesto" section after "About career-ops".
5. **CHANGELOG ×16**: the `[1.120.0] — 2026-07-16` entry.
6. **cvstart.org landing** (`site/`): Community footer column gained a manifesto link
   (`footer.manifesto` in all 16 `site/src/i18n/*.json`, link in `Footer.astro` →
   `https://career-ops.org/manifesto`).
7. **New suite** `tests/manifesto-link.test.mjs` (5 cases) pinning all of the above.

Parent v1.20.0 also fixed `upskill` targeted mode, `scan --json` stdout purity, and the
HTML CV template pagination — none of these surfaces exist in / are shelled into by the
web UI, so **no code parity was required** (documented in the CHANGELOG "Notes").

## Sign-off checklist

- [ ] `npm test` — full suite green, count ≥ 1850 (baseline 1845 + manifesto suite).
- [ ] `node --test tests/manifesto-link.test.mjs` — 5/5.
- [ ] Help gates: every `docs/help/<lang>.md` has exactly **29 H2 / 105 H3**
      (`for f in docs/help/*.md; do grep -c '^## ' $f; done`).
- [ ] `scripts/check-changelog-parity.mjs` — all 16 CHANGELOGs at `1.120.0`.
- [ ] SPA smoke: `npm start` → sidebar footer shows the manifesto link under the
      language switcher; label localizes when switching language (spot-check ru → «Манифест CareerOps», ar RTL).
- [ ] Link contract: opens in a new tab, `noopener noreferrer`, no CSP violations in
      the console (it is a navigation, not a resource load).
- [ ] `#/help` renders §29 at the end of the guide in the selected language.
- [ ] Site: `cd site && npm run build` (Node ≥ 22) — 33 pages; `dist/<locale>/index.html`
      footer contains `career-ops.org/manifesto` (no query params).
- [ ] No regressions in the untouched surfaces: `#/scan` sources dropdown still lists
      61 adapters; `/api/health` reports `version: 1.120.0` and the live `parentVersion`.
