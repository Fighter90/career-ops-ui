# QA REGRESSION PROMPT — career-ops-ui **v1.214.0** (job descriptions feed the content filter + classify-tier fix)

**Parity release (career-ops 1.29.0 delta).** No new source; two default-behaviour scan-quality fixes. Several opt-in items deferred.

- **Under test:** `package.json` **1.214.0**. Registry **82** = 77 EN + 5 RU — **unchanged** (help/OVERVIEW/API untouched).

## §0 — Gates

```bash
npm test                                                   # 2736, exit 0
node --test tests/html-to-text.test.mjs                    # 7 (new shared pipeline)
node --test tests/sources-ashby.test.mjs                   # 8 (was 7: +descriptionPlain)
node --test tests/sources-recruitee.test.mjs               # 2 (new: list-body description)
node --test tests/sources-greenhouse-offices.test.mjs      # 9 (contentToText now wraps htmlToText)
node --test tests/classify-tier.test.mjs                   # +2 (Associate<senior>/academic; junior variants stay entry)
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.214.0
```

## §1 — What changed

- **`server/lib/html-to-text.mjs`** (NEW, shared) — the extracted form of greenhouse's `contentToText` (`htmlToText` + `DESCRIPTION_CAP=4000`): double-decode entity-escaped markup → strip script/style → strip tags → re-decode → collapse whitespace → cap. Mirrors the parent's `_html-to-text.mjs`; uses web-ui's `html-entities.mjs`.
- **greenhouse** — `contentToText` now delegates to `htmlToText` (thin wrapper, tested export name preserved).
- **ashby** — `description: j.descriptionPlain` (list payload ships it free; empty string when absent).
- **recruitee** — `description = htmlToText(j.description)` from the list-payload HTML body (conditional on a usable body).
- **classify-tier** — Guard (a) rewritten: `Associate <senior noun>` resolves to **senior**, now including academic ranks (professor/dean/provost/chancellor/superintendent/general counsel). WHITESPACE-only, ≤2-word gap (so `Administrative Associate, Office of the Dean` stays entry, and employers named for a noun on the list don't false-match); a leading junior marker still decides (`Intern, Associate Dean` → intern); the noun list is CLOSED so `Associate Attorney`/`Associate Editor` stay entry.

## §2 — Manual browser pass

1. A Greenhouse/Ashby/Recruitee company with a `content_filter` (or `country_eligibility`/`visa_filter`) in `portals.yml` now filters on the posting body (before: those boards passed the filter blind).
2. A `skip_tiers: [entry]` config no longer drops an "Associate Director"/"Associate Professor" role.
3. `#/scan` still lists **82** sources; `/api/scan/sources` unchanged.

## §3 — Invariants / security

- `htmlToText` is not an XSS boundary — it produces plain text for filter matching only; the client XSS boundary stays `UI.md()`, the CV ingress stays `stripDangerousMarkdown()`.
- No new source, no new route, no new dependency; host-pinning / SSRF guards on the touched sources unchanged. No count moved except the test count.

## §4 — Deferred / not ported (documented)

- **SmartRecruiters opt-in detail-fetch descriptions** — the parent's `#3175` opt-in path fetches each posting's detail JSON. web-ui's smartrecruiters has a divergent raw-fetch signature (`fetchSmartRecruiters(apiUrl, opts)`, no `entry`/`ctx`), so it needs a config surface + host-guarded detail URLs — queued.
- **detect-reposts `aggregator: true` board skip** — needs a portals.yml `aggregator:` config surface + a `loadAggregatorCompanies` loader; opt-in per company. Queued. (The "concurrent openings" repost fix is already in web-ui.)
- **title-filter `stem:` / `word:` anchored-keyword prefixes** — web-ui has no `title-keywords.mjs`; the whole anchored-keyword feature stays deferred.
- **DNS-rebinding guard** — still queued for its own security release ([[dns-rebinding-guard-deferred]]).
- CLI-flag validation, pdf/liveness/locks/updater/rename-sync/verify-portals/web (parent Next.js) — not web-ui surfaces.

## §5 — Sign-off

Suite **2736** green (2724 + 12) · new `html-to-text` (7) · `sources-ashby` 7→8 · new `sources-recruitee` (2) · `classify-tier` +2 · greenhouse `contentToText` wraps the shared helper (9 still green) · CHANGELOG parity ×17 at v1.214.0 · help **untouched** (source count unchanged 82/77) · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · site rebuild (changelog mirrors + facts version) + wiki (version + tests only). Deploy: resumecraft rsync of `html-to-text.mjs` + `greenhouse.mjs` + `ashby.mjs` + `recruitee.mjs` + `classify-tier.mjs` + `package.json`, restart. cvstart.org Pages rebuild (site/ changelog mirrors changed).
