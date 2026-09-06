# QA REGRESSION PROMPT — career-ops-ui **v1.227.0** (career-ops 1.30.0 parity — SEEK Hong Kong · due-only follow-ups · confidential-employer attribution)

**Parity release.** Parent HEAD `8d64f65` → `6cc46a4` (its `VERSION` still reads 1.30.0 — release-please lags `main`). No new source: **JobsDB Hong Kong** is a new MARKET on the existing Jobstreet/SEEK adapter, so the registry stays at **85 sources** (80 EN + 5 RU) / `ALL_ADAPTERS` **80**. Also migrates Jobstreet/SEEK off the retired chalice-search v4 endpoint, and mirrors two parent UI modules.

## §0 — Gates
```bash
npm test                                              # 2837 (was 2818), exit 0 — capture $? directly, never pipe to grep
node --test tests/sources-config-providers.test.mjs   # 22 (was 16) — jobstreet v5 + hk.jobsdb.com
node --test tests/company-presentation.test.mjs       # 6
node --test tests/followup-view.test.mjs              # 8
node --test tests/i18n-locale-files.test.mjs tests/i18n-coverage.test.mjs   # 4 new keys ×17, snapshot regenerated
node scripts/check-changelog-parity.mjs               # 16 non-EN at v1.227.0
node tools/i18n-audit.mjs                             # no hard failures
npm run test:e2e                                      # 21/21
```

## §1 — What changed
- **`server/lib/sources/jobstreet.mjs`** — `DEFAULT_API` → `https://id.jobstreet.com/api/jobsearch/v5/search`; new `V5_SEARCH_PATH`; `hk.jobsdb.com` added to `ALLOWED_JOBSTREET_HOSTS`. `parseJobstreetItem` reads the v5 shape natively: job URL built from `id` (`${origin}/id/job/${id}`), `locations[0].label`, `advertiser.description` (preferred over the shorter `companyName`), `salaryLabel`. The v4-only `solrFields` projection param is gone. `buildSearchUrl` rebuilds the PATH from `V5_SEARCH_PATH` while keeping the entry's market hostname — an entry whose `portals.yml` still pins the dead v4 path is silently upgraded, no user edit.
- **`public/js/lib/company-presentation.js`** (new, pure) — mirrors the parent's `company-presentation.mjs`. `company === '?'` + a usable `Via` → label `Confidential · via <agency>`, `logoName` = the agency. Placeholder Vias (`n/a`, `tbd`, `none`, `null`, `-`, `—`, `–`, blank) fall back to `Confidential employer`. Wired into `#/tracker`: company cell label, `CompanyLogo.badge(url, pres.logoName)`, and the search haystack via `companySearchText`.
- **`public/js/lib/followup-view.js`** (new, pure) — mirrors the parent's `followup-view.mjs`. `isDue` = `urgency ∈ {urgent, overdue}`; `selectDueFollowups` sorts urgent-before-overdue and caps; `pickNextUpcoming` returns the nearest not-yet-due dated entry (unparseable dates → `Infinity`, never `NaN`). Wired into the `#/modes/followup` cadence board as a **Due only** checkbox + a "next up" line on the empty state.
- **i18n** — 4 new keys ×17 locales: `track.confidential`, `track.confidentialVia`, `fu.dueOnly`, `fu.nextUpcoming`. `tests/fixtures/i18n-dict.snapshot.json` regenerated (+76 lines, purely additive).

## §2 — Manual browser pass
1. `#/tracker` — a row whose Company is `?` with a `Via` value reads **“Confidential · via \<agency\>”**, not a bare `?`; its logo (if logos are enabled in Settings) is the agency's, not a letter-avatar for `?`. Typing the agency name in the search box finds that row. A `?` row with `Via` empty or `—` reads **“Confidential employer”**. A normally-named row is unchanged.
2. `#/modes/followup` — the cadence board head has a **Due only** checkbox. Ticking it narrows the table to 🔴 urgent + 🟠 overdue rows only; the urgency chips above stay full-population counts. Untick restores the full board. With nothing due, the empty message is followed by a "Next up: #N Company on DATE" line (when any dated non-due entry exists).
3. Switch the language picker across several locales (incl. **ar** for RTL) — the new strings are translated, the RTL chrome is still mirrored, no raw key names leak.
4. `#/scan` — the Source filter is unchanged and still lists **85** sources; `GET /api/scan/sources` returns 85 (80 EN + 5 RU).

## §3 — Contract / security invariants
- Jobstreet host allowlist still HTTPS-only and exact-hostname: `hk.jobsdb.com` passes; `jobsdb.com` and `hk.jobsdb.com.evil.test` are rejected (asserted).
- `company-presentation.js` is presentation-only — the canonical `company` field is never written back with the recruiter; no route writes were added.
- Both new libs are pure (no `document`, no network, no storage), CSP-safe, and loaded as plain `<script src>` — no build step, no inline handlers.
- No new server route, no change to the parent read/write contract.

## §4 — Not ported (documented, with reasons)
- **iCIMS JSON-LD location fill** — web-ui's iCIMS source has no `enrichDate()` detail-page hook at all (list pages only); there is no code path to fix.
- **Nonfatal CLI stderr on clean exit (#1974)** — web-ui's `runner.mjs` decides failure from the exit code alone and never had the stderr-keyword heuristic the bug lived in.
- **Turbopack path tracing** — web-ui has no bundler.
- **`cv-sync-check` crash / `CODE_ROOT` fixes** — relayed read-only and fail-soft, so parent-side fixes land without a web-ui change.
- **Playwright sequencing in `scan.mjs`, Block H application answers, updater/doctor/`update-system` guards, the recursive syntax gate, the Go dashboard, `jd-skill-gap`/`verify-cv-facts` self-tests** — CLI-only surfaces web-ui does not shell into, or self-tests with no behavior change.

## §5 — Sign-off
Suite **2837** green (was 2818, +19) · E2E 21/21 · jobstreet on v5 + HK market · 2 new pure libs + 14 new tests · 4 i18n keys ×17 + snapshot · parity ×17 at v1.227.0 · README banner+badges ×17 · **help ×17 untouched (source count unchanged at 85)** · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · site changelog mirrors ×17 + facts.json rebuilt. Deploy: Pages (cvstart.org), local + resumecraft restart, wiki (version · 85 sources · 80 adapters · 2837 tests).
