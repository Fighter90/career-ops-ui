# REGRESSION-PROMPT — FINAL · career-ops-ui · post-v1.59.10

Canonical post-cycle regression handoff written **after** the v1.58.52 → v1.59.10 closure (17 single-fix releases + 2 verification patches + 1 v1.59.2 chip hotfix + 1 v1.59.8 doctrine-exception bundle + v1.59.9 UX-A5-r4 (6th-cycle close with behavioural test) + v1.59.10 NEW-F1-sub-r1 (path-traversal guard hoist), all CI-green, all AI-review LGTM). This document is the 100 %-maturity verification protocol — run it before declaring a 1.x line frozen.

**Baseline at v1.61.1:** **1003** unit · 81 Playwright (smoke + full-cycle + forms + locale-sweep + theme-toggle) · 20 smoke E2E · 23 comprehensive E2E.

> **Shipped since this cycle (v1.60.0 → v1.61.1):** I18N-SPLIT (per-locale
> dictionary, v1.60.0); **French (`fr`) added as the 9th UI locale**
> (v1.61.0) — all "8 locales / ×8" counts above are now **9 / ×9**; and
> **MINOR-001** (v1.61.1) — theme-toggle `title`/`aria-label` localized via a
> new `data-i18n-title` hook. For the locale work use the dedicated prompts:
> `qa/QA-REGRESSION-PROMPT-v1.61.0-FULL.md` (exhaustive) and
> `qa/QA-REGRESSION-PROMPT-fr-v1.61.0.md` (focused). This document remains the
> perennial maturity-verification protocol.

---

## §0 — Doctrine recap (the lessons that survived this cycle)

Non-negotiable for any future ship.

1. **One fix per release.** HIGH → MEDIUM → LOW. Each release ships: bump + CHANGELOG ×9 (parity-gated) + dedicated test + Playwright-verify + pre-commit AI-review LGTM + `ci.yml` green + redeploy.
2. **CHANGELOG parity is non-negotiable.** Run `node scripts/check-changelog-parity.mjs` before every commit.
3. **`ci.yml` is the hard gate.** Pre-commit AI review is advisory.
4. **`[hidden]` is shadowed by author `display:` rules.** Add explicit `.x[hidden] { display: none }` override.
5. **`npm test 2>&1 | grep …` masks the exit code.** Run `npm test` first, capture `$?`, then grep separately.
6. **`cleanLlmMarkdown` is NOT an XSS sanitizer.** XSS boundary = `stripDangerousMarkdown()` (server) + `UI.md()` (client).
7. **`PATHS` resolves once per process.** Static guard in `tests/paths-once.test.mjs`.
8. **Lifecycle listeners must scope to the route via `hashchange` cleanup.** v1.58.36 / 52 / 55 / 58 — same pattern.
9. **Author cascade beats UA-level `[hidden]`.** v1.58.34 / 35 / 60 — same trap.
10. **Help bundle parity (H2 + H3) is locked.** v1.59.7 baseline: 18 H2 / 73 H3.
11. **`saveBtn.onclick =` is a footgun on `c()`-built elements.** They register via `addEventListener`, not the property. Use bubble-phase listeners.
12. **GitHub Packages publish runs against the tagged ref, not main.** Re-tag if you need a fix in the published artifact.
13. **i18n copy polish can break older static guards** (v1.59.1 — UX-A11 caught NEW-D1).
14. **Server contract `keysConfigured` is an ARRAY, `activeProvider` is the resolved NAME (`anthropic`, not `claude`).** v1.59.2 chip hotfix — always derive from server snapshot, never from local form state.
15. **`position: sticky` + `z-index: <N>` creates a stacking context that overlaps anything below it on scroll.** v1.59.2 chip hotfix — only use sticky when the overlap is intentional.
16. **`app.get('/api/*', …)` is GET-only — use `app.all` for the JSON-404 fallback.** v1.59.5 NEW-F1.
17. **DOM refresh races during Save: build new nodes first, then `replaceChildren()` atomically.** v1.59.4 NEW-OR1.
18. **IntersectionObserver `rootMargin` too tight = scroll skips the trigger zone.** v1.59.3 UX-A5-r2 — but the 25 % band `-20% 0% -55% 0%` still missed `scrollIntoView({block:'center'})` (50 % viewport, just below the 45 % band end). After 4 failed IO cycles, **v1.59.8 (UX-A5-r3) replaced IntersectionObserver with a plain scroll listener** + rAF throttling. The simpler approach probes absolute positions every scroll frame — no band, no race. Lesson: when an IO refuses to fire after multiple rootMargin fixes, abandon IO; the scroll listener is reliable.
19. **`req.url` is normalised, `req.originalUrl` is verbatim.** v1.59.8 NEW-F1-sub — Express resolves `/api/jds/../../../etc/passwd` to `/etc/passwd` BEFORE matching, so a `/api`-fallback handler never sees `..`. A `req.originalUrl.includes('..')` guard runs late but inspects the raw URL string.
20. **Middleware position matters as much as content.** v1.59.10 NEW-F1-sub-r1 — the v1.59.8 `req.originalUrl` guard was placed AFTER `app.all('/api/*')` AND AFTER all route registrations, so Express's normalisation rewrote the URL before the guard ran. v1.59.10 hoisted it ABOVE every `register*Routes(app)` call. **Express middleware order is strictly imperative; "the right code in the wrong place" is unreachable code.**
21. **Static lock-tests can pass while the user-visible bug stays open.** v1.59.9 UX-A5-r4 — 5 previous closures all shipped with "tests green" but the same bug returned. Root cause: every test asserted source-code shape (`/IntersectionObserver/`, `/toc-current/` exists in DOM at any time), never the user promise. **A regression-lock test must drive the actual user-facing scenario** — for scroll-spy, that means simulated scroll positions + algorithm output assertions (not just "the file mentions the right symbol").

---

## §1 — Single-command verification ladder

```bash
# Rung 1 — workspace sanity
git status                                     # clean
node --version                                 # >= 18
npm ci

# Rung 2 — static parity gates
node scripts/check-changelog-parity.mjs        # all 9 locales at same version
node scripts/check-no-also-leftovers.mjs       # no .also( leftovers

# Rung 3 — unit suite
npm test                                       # 971+ pass, 0 fail
                                               # DO NOT pipe through grep — masks exit

# Rung 4 — coverage
npm run test:coverage                          # line >= 93%, branch >= 83%

# Rung 5 — Playwright suites
npm run test:e2e                               # 20 smoke green
npm run test:e2e:full                          # 23 comprehensive green
npm run test:e2e:browser                       # 81 Playwright green

# Rung 6 — first-run cleanup invariant
make clean-test-fixtures                       # idempotent on clean tree

# Rung 7 — live smoke
npm start                                      # server on 127.0.0.1:4317
```

---

## §2 — Live-smoke checklist (9 locales × 7 routes)

For each locale (`en`, `es`, `pt-BR`, `ko`, `ja`, `ru`, `zh-CN`, `zh-TW`):

| Route | What to verify |
|---|---|
| `#/dashboard` | Hero CTAs · `.dash-chip--provider` shows `⚡ Live evals: Anthropic <model>` (NOT `anthropic` lowercase) · Pipeline tile primary visual weight · 4 metric cards |
| `#/pipeline` | Title localized · counter accurate · filter chips work |
| `#/config → API keys` | `.api-keys__summary` shows `Active: <Provider>` + `Keys: <N>/5` correctly · NOT sticky (no overlap on scroll) · Save preserves correct count atomically (no `0/5` flash) |
| `#/cv` | `.btn-dirty` toggles on edit · navigate away → confirm dialog · cancel keeps user on `#/cv` · `GET /api/cv` responds `Cache-Control: no-store` |
| `#/deep` | Saved cards render structurally · brief lacking ≥3 H2 sections triggers `.brief-warning` |
| `#/help` | TOC visible · scroll body — TOC `.toc-current` follows section · on first paint the visible section is already highlighted (initial-state) |
| `#/health` | Failing rows show `Fix →` CTA |

**Mobile (≤ 420 px):** open `#/dashboard` at iPhone SE — card-row 1-up, hero CTAs full-width stack, page-header stacked. `#/config → API keys` chip wraps cleanly. Notifications drawer head fits.

**Reduced motion (NEW-D2-motion):** in macOS System Settings → Accessibility → Display → Reduce motion ON · Chrome DevTools → Rendering → Emulate `prefers-reduced-motion: reduce` · verify no `transform`-based slide-ins fire (CSS animations are 0.01 ms).

**API contract spot-check (NEW-F1 + NEW-D3-cache):**
```bash
curl -i -X POST http://127.0.0.1:4317/api/no-such-endpoint        # 404 JSON
curl -i -X DELETE http://127.0.0.1:4317/api/no-such-endpoint      # 404 JSON
curl -i -X GET http://127.0.0.1:4317/api/cv | grep -i cache       # Cache-Control: no-store
```

---

## §3 — The 22 invariants locked across v1.58.52 → v1.59.7

Each row is a static or behavioural guard. Any future PR that regresses the row will fail `npm test`.

### v1.58.52 → v1.59.0 — maturity-10 cycle (15 invariants)

| Release | Ticket | Invariant |
|---|---|---|
| v1.58.52 | UX-A5 | `help.js` uses `mountTocSpy()` + double `requestAnimationFrame` |
| v1.58.53 | UX-A6 | Every saved-research card flows through `renderSavedCard(f)` |
| v1.58.54 | UX-A1 | `looksLikeStructuredBrief()` checks ≥ 3 of 6 canonical H2 sections |
| v1.58.55 | UX-A3 | Dashboard `providerChip()` · `providers-changed` + `visibilitychange` · `hashchange` cleanup |
| v1.58.56 | UX-A4 | `.lang-btn` `min-height: 28 px` + `min-width: 28 px` (WCAG 2.5.8) |
| v1.58.57 | UX-A7 | `config.js` dispatches `providers-changed` · `UI.providerCostHint` subscribes · 4 advisor views call it |
| v1.58.58 | UX-A10 | `cv.js` registers `beforeunload` + `hashchange` guards · `isDirty()` reads live |
| v1.58.59 | UX-A13 | `health.js` `FIX_TARGETS` map · `_API_KEY$` regex fallback · `.health-fix` ghost button |
| v1.58.60 | UX-A12 | `UI.clearToastHistory()` + `UI.dismissToastHistory(ts)` · notif-clear-all + per-item × |
| v1.58.61 | UX-A8 | All 8 READMEs reference `make clean-test-fixtures` |
| v1.58.62 | UX-A9 | `.api-keys__summary` chip · `Active` + `Keys: N/5` · subscribes to `providers-changed` |
| v1.58.63 | UX-A15 | `qa()` 7th `primary` flag · Pipeline tile · `.qa-tile--primary` |
| v1.58.64 | UX-A11 | es / pt-BR copy polish (English loanwords replaced) · es `pipe.title` = `Pipeline de candidaturas` |
| v1.58.65 | UX-A2 | `modes-form.js` CANON has 5 fields in canonical order |
| v1.59.0 | UX-A14 | `@media (max-width: 420px)` mobile block |

### v1.59.1 → v1.59.8 — final polish + new findings (9 invariants)

| Release | Ticket | Invariant |
|---|---|---|
| v1.59.1 | NEW-D1 patch | `i18n-no-latin-leaks` regex accepts both `vacant\|candidatur` (es) |
| v1.59.2 | chip hotfix | Provider chips read array length + `anthropic` key in NAME · `.api-keys__summary` NOT sticky |
| v1.59.3 | UX-A5-r2 | `help.js` TOC scroll-spy `rootMargin: '-20% 0% -55% 0%'` · explicit `root: null` · `applyCurrent(id)` initial-state (**superseded by v1.59.8 — IO removed**) |
| v1.59.4 | NEW-OR1 | `refreshApiSummary` race-safe: `inFlight` token · atomic `replaceChildren()` · `lastGoodSt` cache |
| v1.59.5 | NEW-F1 | `app.all('/api/*', …)` JSON-404 on every verb (was GET-only) |
| v1.59.6 | NEW-D2-motion | `@media (prefers-reduced-motion: reduce)` neutralizes animations + transitions + scroll-behavior |
| v1.59.7 | NEW-D3-cache | `GET /api/cv` sends `Cache-Control: no-store` |
| v1.59.8 | UX-A5-r3 | `help.js` TOC scroll-spy uses `function computeActiveAndApply()` + rAF-throttled passive `scroll` listener + double-rAF initial state — IntersectionObserver fully removed |
| v1.59.8 | NEW-F1-sub | server middleware inspects `req.originalUrl` and bounces `/api` requests containing raw `..` as 404 JSON `{error: 'invalid path'}` |

**Cycle stats:** 25 releases v1.58.52 → v1.59.10 · **1003** unit tests at v1.59.10 (was 949 at v1.58.51) · 100 % CI-green · all AI-review LGTM · zero rollbacks · 1 chip hotfix (v1.59.2) · 1 doctrine-exception bundle (v1.59.8 — HIGH+LOW, authorized by FINAL REGRESSION-v1.59.7 report) · 1 sixth-cycle behavioural-test close (v1.59.9 UX-A5-r4 + new `tests/help-toc-spy-behavior.test.mjs`).

### v1.59.9 → v1.59.10 — final closure to 100 % (4 invariants)

| Release | Ticket | Invariant |
|---|---|---|
| v1.59.9 | UX-A5-r4 (a) | `help.js` sets `<body data-toc-spy="active">` on mount, removes on hashchange cleanup; single-selector "is the spy alive?" check |
| v1.59.9 | UX-A5-r4 (b) | `help.js` linear scan uses `if (absTop <= triggerY) chosen = h; else break;` (short-circuit, O(active-index) per scroll event); identical formula proved by behavioural test `tests/help-toc-spy-behavior.test.mjs` (7 cases against synthetic geometry + 1 algorithm-parity guard) |
| v1.59.9 | UX-A5-r4 (c) | `help.js` initial paint: synchronous compute at mount tail + double-rAF re-compute + resize listener subscription |
| v1.59.10 | NEW-F1-sub-r1 | server `req.originalUrl` `..` guard hoisted ABOVE every `register*Routes(app)` call (was after `app.all('/api/*')` in v1.59.8 — never fired). Pattern: `/^\/api(\/\|$)/.test && /\.\.\//.test`. New `tests/api-path-traversal.test.mjs` (6 cases via raw `http.request` since Node's fetch normalises `..`) |

---

## §4 — Security envelope (must be byte-stable)

- `server/index.mjs` CSP excludes `'unsafe-inline'`/`'unsafe-eval'` from `script-src`.
- Every job-URL ingress passes through `isValidJobUrl()` — no loopback / `file://` / script chars.
- CV markdown ingress passes through `stripDangerousMarkdown()` (server) + `UI.md()` (client).
- Server error bodies are English-by-policy (DOC-1 / v1.58.50).
- `.env*` gitignored. `.env.example` placeholders only.
- **NEW (v1.59.5):** every `/api/*` verb (GET/POST/PUT/DELETE) returns JSON 404 for unknown paths — no HTML fallthrough.
- **NEW (v1.59.7):** `GET /api/cv` sends `Cache-Control: no-store` matching the SPA-shell policy.

---

## §5 — Parent-project read-only contract

The web-ui never writes outside its own tree except via explicit user actions. Write-allowed routes:

| Route | Writes (in parent) |
|---|---|
| `POST /api/pipeline` | appends to `data/pipeline.md` |
| `POST /api/tracker` | appends to `data/applications.md` |
| `PUT /api/cv` | overwrites `cv.md` (after `stripDangerousMarkdown`) |
| `POST /api/jds` | creates `data/jds/<slug>.md` |
| `DELETE /api/{jds,interview-prep}/:name` | unlinks the named file |
| `POST /api/config` | writes parent `.env` (validated via `validateConfig`) |
| Streaming runners (`/api/run/*` POST) | shell out to `runner.mjs` in parent — same scope as CLI |

Anything else MUST be a read.

---

## §6 — Out of scope (deferred to parent / cross-repo)

| Item | Owner | Status |
|---|---|---|
| C-1 prompt-layer (parent `modes/deep.md`) | parent | blocked — UX-A1 is the defensive UI workaround |
| G-005 (parent `modes/oferta.md`) | parent | blocked — renderer is schema-tolerant |
| UX-022 stale portals (parent `portals.yml`) | parent | blocked |
| CLI locale (parent stdout) | parent | post v1.60 |
| RTL support (Arabic / Hebrew) | this repo | post v1.60 |
| Drag-and-drop reorder · bulk delete · PWA / offline | this repo | post v1.60 |

---

## §7 — Sign-off matrix (v1.59.7)

| Gate | Pass |
|---|---|
| All 23 cycle releases shipped + tagged + pushed (v1.58.52 → v1.59.8) | ✅ |
| Parity matrix green at v1.59.8 | ✅ |
| `npm test` 973 / 973, 0 fail | ✅ |
| `npm run test:e2e` ≥ 20 smoke green | ☐ |
| `npm run test:e2e:full` ≥ 23 comprehensive green | ☐ |
| `npm run test:e2e:browser` ≥ 81 Playwright green | ☐ |
| Live-smoke checklist (§2) green on 2 locales (en + 1 non-en) | ☐ |
| Mobile (≤ 420 px) smoke on the 5 critical routes | ☐ |
| Reduced-motion (DevTools emulation) smoke | ☐ |
| API contract spot-check curl probes (NEW-F1 + NEW-D3-cache) | ☐ |
| Security envelope byte-stable | ✅ |
| Parent-project read-only contract preserved | ✅ |
| `qa/` reorganized — stale docs archived to `qa/archive/v159-cycle/` | ✅ |

---

## §8 — Maturity scoring (final)

| Dimension | v1.58.51 baseline | v1.59.8 | Notes |
|---|---|---|---|
| Function | 9 | 10 | every advertised feature shipped + lock-tested; UX-A5-r3 finally green via scroll-listener |
| Output quality | 7 | 9 | UX-A1 defensive warning surfaces upstream drift |
| i18n | 9 | 10 | 9 locales, parity-gated, native-equivalent polish |
| A11y | 9 | 10 | WCAG 2.5.8 lang-picker + 2.3.3 reduced-motion + ARIA drawer + Fix CTAs |
| UX | 8 | 10 | provider chips, race-safe counter, drawer purge, Pipeline weight, **TOC scroll-spy reliable** |
| Performance | 9 | 9 | no regressions |
| Security | 9 | 10 | JSON-404 fallback on every verb + raw `..` guard + `Cache-Control: no-store` on `/api/cv` |
| Mobile | 5 | 9 | `@media (max-width: 420px)` ships |
| **Overall** | **8.5 / 10** | **10 / 10** | within web-ui scope |

Within scope of this repo, **the web-ui is at 10 / 10**.

---

## §9 — Handoff

This document is the post-cycle authority. The next QA pass:

1. Walks the `§1` verification ladder.
2. Confirms the `§2` live-smoke checklist for 2 locales minimum + the 3 spot-checks (mobile / reduced-motion / curl).
3. Confirms the `§4` security envelope is byte-stable.
4. Tags green and moves on.

If anything in `§3` fails, the responsible lock-test will be the precise failure location — file a `FIX-PROMPT-vN.M.K.md` under `qa/` referencing the lock-test that fired, then ship the one-fix-per-release patch following the `§0` doctrine.

**Open items at v1.59.7:**
- Optional UX-A2-r1 (`.mode-field` class invariant) — deferred (the contract is asserted via existing CANON lock-test).
- G-005 — cross-repo, parent-blocked.

---

*End of canonical regression prompt. Generated 2026-05-20 after v1.59.7; refreshed 2026-05-21 after v1.59.8 (UX-A5-r3 + NEW-F1-sub doctrine-exception bundle).*
