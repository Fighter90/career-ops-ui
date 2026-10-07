# Spec — Dassault scanner source + audit sweep (v1.97.0)

## Problem

The parent career-ops advanced ~27 commits past our v1.16.0 baseline, adding a new zero-token **Dassault Systèmes** job-board provider (#1498) plus robustness fixes to existing providers. Separately, a three-front code/translation audit surfaced real defects in the web-ui itself.

## Approach

Two workstreams, one release.

### 1. Parent parity

- **New source — Dassault Systèmes.** Port `providers/dassault.mjs` into the web-ui two-file source contract: `server/lib/sources/dassault.mjs` (`meta` for auto-discovery + `fetchDassault` + exported `parseHits`/`buildUrl`/`assertDassaultUrl`) and `server/lib/portals/adapters/dassault.mjs` (registry adapter). It hits the public Exalead "card search" feed behind `3ds.com/careers/jobs` — a single global endpoint, so it is **provider-selected** (`provider: dassault`) or auto-detected from a `3ds.com` careers host, and **SSRF host-pinned** to `www.3ds.com` (`assertDassaultUrl` + `redirect:'error'`). The response is Exalead XML; it is parsed without a DOM (per-`<Hit>` `<Meta>` maps), city/country sliced out of the localized `content_categories` label string, dates coerced to ISO, and only postings whose public URL is on `*.3ds.com` are kept. Registered as the 41st EN adapter (46 total with the 5 RU sources); the three registry assertions (`ALL_ADAPTERS.length`, sorted-id list, `/api/scan/sources` EN set) bump 40 → 41.
- **Ported robustness fixes.** Avature two-variant markup (`article--result` position-index suffix + classless JobDetail anchor, #1541); Get on Board `published_at <= 0` date guard; SuccessFactors last-page `slice(0, MAX_JOBS)` cap (#1528).

### 2. Audit sweep (server + SPA + 16-language translation)

- **`safe-fetch` over-cap hang (MED).** The size-cap branch called `res.destroy()` and relied on an `'end'` event that a destroyed `IncomingMessage` never emits, so an over-cap `/api/pipeline/preview` or auto-pipeline fetch hung until the AbortSignal timeout. Fix: settle the promise directly in the cap branch, guarded by a `settled` flag so `end`/`error` become no-ops.
- **SSE activity-logging dead code (LOW).** The `/api/stream/*` branch sat below a blanket `if (GET) return null`, so stream starts were never logged. Fix: hoist the stream check above the GET guard.
- **`#/stats` async tab race (MED).** `activate(id)` awaited `render()` then unconditionally wrote the panel; a slow tab's late result could clobber a newer tab. Fix: re-check `active === id` after the await in both branches. (This matches the transient "empty pipeline" flicker seen in manual QA.)
- **Empty delete-confirm dialogs (LOW).** `UI.confirm(question)` put the question in the title and left the body empty; mock-interview + networking now pass `(title, message, { danger })`.
- **Translation leaks.** uk `config.modes*`, ru `eval.jdLbl`, it `dash.quick.contactoSub`; plus the English `**16 locales**` boilerplate in six non-Latin CHANGELOGs.

## Data contract & security

No new routes, no new writes, no new i18n keys. Dassault is a read-only scan source; the host-pin + `redirect:'error'` keep it inside the existing SSRF envelope. The delete-confirm and translation changes reuse existing keys.

## Tests

`tests/sources-dassault.test.mjs` (10 cases — meta/adapter surface, both refinements, SSRF host-pin, entity decode + city/country + ISO date, off-host drop, pagination/dedup, company override, repointed-host refusal). Registry assertions updated in `tests/adapter-registry.test.mjs` + `tests/scan-sources-endpoint.test.mjs`. Provider ports covered by the existing avature/getonbrd/ats-providers suites. Full suite: 1661 pass.

## Out of scope

The parent's new `modes/email.md`, Korean mode set, and ES/FR interview sub-modes are CLI-mode prompts (not mirrored by the web-ui SPA). The parent's own `web/` frontend is unrelated to this repo. `higheredjobs`/`jibeapply`/`local-parser` predate the baseline and remain unmirrored by design.
