# QA REGRESSION PROMPT — career-ops-ui **v1.89.0** (Epic 14: candidate market fit — the two-pager)

Delta-focused regression for the two-pager feature. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.89.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                     # full suite (≥1609 cases; new: two-pager-routes + fit-score)
node --test tests/two-pager-routes.test.mjs  # GET/PUT/draft + normalizeTwoPager + bundleProjectContext inlining
node --test tests/fit-score.test.mjs         # FitScore heuristic (null-safe, deal-breaker weighting)
node --test tests/i18n-coverage.test.mjs     # 27 new keys ×16 locales, zero missing
node tools/i18n-audit.mjs                     # clean
node scripts/check-changelog-parity.mjs       # all 15 locales at v1.89.0
```

## §1 — What changed

1. **New `#/two-pager` page** (nav: Setup → Two-pager 🎯). Guided builder:
   - "Who I am" + "Target environment" textareas.
   - Five chip-list editors: **loves / must-haves / hates / deal-breakers / non-negotiables**. Type + Enter (or comma) adds a chip; × removes it; blur commits a pending value; duplicates are ignored.
   - **Save two-pager** → `PUT /api/two-pager` → writes `config/two-pager.yml` in the **parent** project (user layer). Reload the page: values round-trip.
   - **✨ AI fill assistant** → `POST /api/two-pager/draft` → opens a modal with a ready-to-run Mnookin prompt (your CV + profile inlined). No live LLM call is made; nothing is fabricated.

2. **Fit-to-what-you-want badge on `#/scan`.** With a saved two-pager, each result row shows a `◎ N` badge (0–100). Colour tiers: ≥66 `badge-ok`, ≥40 `badge-info`, else `badge-bad`. Tooltip lists what matched (✓) / what a deal-breaker violated (✗). **Honesty check:** a posting with no matchable signal (e.g. only free-text prefs a scan row can't confirm) shows **no badge** — never a made-up number. Deal-breaker violations must score lower than a soft "hate" of the same thing.

3. **Two-pager feeds evaluations.** After saving, run any live evaluation (`⚡ Run live` on `#/evaluate`) — the prompt payload includes `config/two-pager.yml` (loves/must-haves as positive signals, hates/deal-breakers as negative). Verified programmatically by `tests/two-pager-routes.test.mjs::"the saved two-pager is inlined into bundleProjectContext"`.

## §2 — Contract & security invariants (must stay green)

- **Parent write-through only on explicit Save.** `PUT /api/two-pager` is the only write; `GET`/`draft` never write. Off-limits parent files untouched.
- **Bounded input.** `normalizeTwoPager` caps strings (4000 chars), arrays (40 items × 400 chars each), drops non-string items and unknown keys, and coerces junk (`null`/array/number) to the empty shape. No prototype pollution surface.
- **CSP-safe view.** `two-pager.js` uses only `addEventListener` + `UI.el`; no inline handlers, no `innerHTML` from user input. The draft prompt renders into a `readonly` textarea (`.value`), never `innerHTML`.
- **CodeQL `js/missing-rate-limiting`** on `POST /api/two-pager/draft` is guarded by `llmRateLimit`; if the scanner still flags it, it is the known false positive — **dismiss**, don't weaken.

## §3 — i18n

27 new keys (`nav.twoPager`, `twoPager.*`, `scan.fitTip`) present and translated in all **16** locales. Switch to a non-English locale: the Two-pager nav item, page, chip-editor labels/hints, buttons, and the scan `◎` tooltip all read in-language. Arabic renders RTL (chrome mirrors; the values are plain strings, no direction markers).

## §4 — Sign-off

All §0 gates green · builder saves + round-trips to `config/two-pager.yml` · AI-fill modal shows a CV/profile-inlined prompt · scan `◎` badge appears only with matchable signal and weights deal-breakers correctly · two-pager inlined into eval prompts · 27 keys ×16 locales · CSP/SSRF/parent-write invariants intact.
