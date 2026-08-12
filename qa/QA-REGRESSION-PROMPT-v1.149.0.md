# QA REGRESSION PROMPT — career-ops-ui **v1.149.0** (Portals → Settings nav)

A nav-only change (no parent-sync, no route/view/server code). `#/portals` moves from the *Sourcing* sidebar group into the *Setup* (settings) group, next to *App settings* — it's been a settings surface since v1.144.0. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.149.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                          # full suite — 2383, exit 0 (capture $? directly, never | grep)
node --test tests/portals-nav-placement.test.mjs  # #/portals under Setup, not Sourcing (2 tests)
node scripts/check-changelog-parity.mjs           # all 16 non-EN locales at v1.149.0
node tools/i18n-audit.mjs                           # app dict clean; snapshot UNCHANGED 1208 (no new keys)
```

## §1 — What changed (nav markup only; ZERO route/view/i18n/server change)

- In `public/index.html`, the `<a href="#/portals" data-route="portals">` nav item **moved** from the *Sourcing* `nav-group` (which keeps Scan / Pipeline / Auto-pipeline / Funded companies) into the *Setup* `nav-group`, placed right after *App settings* (`#/config`).
- The `#/portals` route, the Portals view, and the `nav.portals` label are unchanged. No other file touched.

## §2 — Manual browser pass

1. **Sidebar** — the **Portals** item (⛩) now appears in the **Setup** group next to **App settings** / Profile / Health / AI usage — **not** under *Sourcing*.
2. **Navigate** — click Portals → `#/portals` still loads the Portals view (enable/disable tracked companies + ATS health) exactly as before; the item highlights as active.
3. **Sourcing group** — now shows Scan / Pipeline / Auto-pipeline / Funded companies (no Portals).
4. **Localization** — a non-EN locale still labels the item via `nav.portals` (unchanged); RTL (العربية) mirrors.
5. **No console errors.**

## §3 — Invariants

- **Nav markup only** — no `server/`, no `public/js/`, no CSS, no i18n dict change (snapshot stays **1208**). The `#/portals` route + view are byte-for-byte the same.
- **Placement guarded** — `tests/portals-nav-placement.test.mjs` asserts `#/portals` is under *Setup* (after *App settings*) and absent from *Sourcing*.
- **CHANGELOG parity** — 17 locales, newest `## [1.149.0]`.

## §4 — Not in this release (see `docs/UX-ROADMAP.md` Phase 4)

- **Overall visual polish across all pages** — a subjective, whole-app senior-designer pass (tracked separately).
- **Phase 5** — the Hermes/Nous LLM-provider integration stays blocked on the API-contract spike.

## §5 — Sign-off

Suite **2383** green · portals-nav-placement 2/2 · Portals renders under *Setup* next to *App settings* · route/view unchanged · Sourcing group no longer lists Portals · RTL mirrored · 0 console errors · i18n snapshot 1208 · CHANGELOG parity ×17.
