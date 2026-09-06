# QA REGRESSION PROMPT — career-ops-ui v1.76.0 · FULL / EXHAUSTIVE (whole project)

> **Scope:** the *entire* career-ops-ui project, *all* functionality, as of `package.json` **1.76.0**. Single-pass, full-surface driver — supersedes the v1.75.2 FULL prompt and folds in the **parent career-ops v1.13.0 parity** cycle (six new per-tenant ATS sources, title-filter robustness, Arbeitsagentur `remoteMatch`, `trust_filter`, and the removal of the scan result cap).
> **Role:** strict release-gate QA engineer. Prove the whole app works, correctly and clearly, and that nothing regression-locked has drifted.
> **Output:** save your run report to `qa/v57-regression/<YYYY-MM-DD>-REGRESSION-v1.76.0.md` with a PASS/FAIL per item and evidence (command output, HTTP traces, screenshots). One finding = one fix-ship (one-fix-per-release doctrine; HIGH → MEDIUM → LOW).
>
> **Sibling perennials (run alongside, do not duplicate):** `REGRESSION-FINAL.md` (invariant ledger), `UX-AUDIT-PROMPT.md`, `FUNCTIONALITY-CHECK.md`, `key/E2E-REGRESSION-EVERY-BUTTON-EVERY-LANGUAGE.md`.

---

## §−1 — Methodology footguns (READ FIRST)

1. **Never `npm test 2>&1 | grep …`** — `grep` returns 0 on match even when the suite failed. Run `npm test`, capture `$?`, then grep separately. Same for `git … 2>&1 | tail`.
2. **Pre-commit AI review is advisory; `ci.yml` is the hard gate.** Watch the CI run, not just the local hook.
3. **`PATHS` resolves once per process.** Don't reimport `paths.mjs`; CI-isolated tests bootstrap their own `CAREER_OPS_ROOT`. Locks: `tests/paths-once.test.mjs`, `tests/test-root-isolation.test.mjs`. **Eager-import leak:** a test that sets `CAREER_OPS_ROOT` in `before()` must load every paths.mjs carrier via dynamic `import()` inside `before()`.
4. **`cleanLlmMarkdown` is NOT an XSS sanitizer.** XSS boundary = `UI.md()` (client) + `stripDangerousMarkdown()` (CV ingress).
5. **`[hidden]` is a no-op against an author `display:` rule** — components with `display:flex|grid` need an explicit `.sel[hidden]{display:none}`.
6. **Parent career-ops is READ-ONLY** (hard rule #1). Tests must not assume it exists.
7. **Server error bodies are English-by-policy.** Only client UI strings are localized.
8. **Playwright headless shell:** browser tests fail at the launch hook if `chromium_headless_shell` is absent → `npx playwright install chromium-headless-shell` (env gap, not a regression).
9. **Cross-realm vm arrays:** comparing a vm-realm array to a main-realm literal with `deepEqual` fails on prototype identity — spread (`[...]`) first.
10. **Two scanner registries — don't conflate them.** `server/lib/sources/registry.mjs` (auto-discovered `meta`) drives the `#/scan` *dropdown* + RU dispatch; `server/lib/portals/registry.mjs` (`ALL_ADAPTERS`, hand-maintained) is what the EN scanner walks to actually *fetch* (`matches` → `buildEndpoint` → fetch). **A new EN board needs BOTH** — the v1.76.0 six (bamboohr/breezy/comeet/personio/recruitee/solidjobs) each ship a `sources/<slug>.mjs` AND a `portals/adapters/<slug>.mjs` in `ALL_ADAPTERS` (now **20 EN adapters**, **25 total**).
11. **`buildEndpoint(company)` must return a string** (the resolved URL). A non-string silently drops the source — `resolveAdapter` treats a falsy endpoint as "no match".
12. **v1.76.0 per-tenant ATSes are `careers_url`-host-detected, not `provider:`-selected.** BambooHR/Breezy/Personio/Recruitee match on the host of `careers_url`; Comeet/SolidJobs match on a full careers-api URL in `api:`/`careers_url`. Each pins its host with an anchored regex + `redirect:'error'` (SSRF). An explicit `provider:` still works as an override. Contrast with the v1.75.0 aggregators, which are `provider:`-only.
13. **`trust_filter` is ANNOTATE-ONLY (v1.76.0).** It never drops a job — it stamps `_trustScore`/`_trustLevel`/`_trustFlags`. Off unless `trust_filter:` is present and `enabled !== false`. The `#/scan` ⚠ badge is language-neutral (symbol + score), so it needs **no** i18n key.
14. **The scan result display cap is GONE (v1.76.0).** `MAX_STORED_RESULTS` was removed; both scanners store the full matched `filtered` set and the table paginates 200/page. `tests/scan-result-cap.test.mjs` is now a *no-cap* guard — it must FAIL if anyone reintroduces `filtered.slice(...)` or the `MAX_STORED_RESULTS` symbol.
15. **Title-filter word boundaries (v1.76.0).** `buildTitleFilter`/`compileKeyword` in `location-filter.mjs`: 2–3-letter ASCII acronyms match `\bkw\b`; everything else is substring. Malformed `title_filter` entries (null/number/empty) are dropped, never crash. Both EN and RU scanners use it (RU via `compileKeywordList` on negatives).
16. **`fetchText` (v1.76.0)** in `http-json.mjs` is the text sibling of `fetchJson` (Personio's XML feed). Same `redirect:'error'` default.
17. **`scan-sanitize` is an egress (write) sanitizer, not an XSS boundary.** It does not replace `stripDangerousMarkdown`.

---

## §0 — Gates (all must be green)

```bash
npm test                                    # full unit/integration suite (≥1222 cases)
npm run test:ci                             # unit + check-no-also + check-changelog-parity + i18n-audit
node tools/i18n-audit.mjs                   # "no hard failures — dictionary is clean"
node scripts/check-changelog-parity.mjs     # "all 11 locales at v1.76.0"
npm run test:coverage                       # ≥80% line / ≥83% branch (baseline ~93/~83)
npm run test:e2e:browser                    # playwright smoke + full-cycle + forms + locale-sweep(12) + theme-toggle
npm run test:e2e && npm run test:e2e:full   # smoke (20) + comprehensive (23) E2E
node scripts/portals-health-check.mjs       # portals.yml reachability (informational)
```

---

## §1 — Boot / security envelope
- `npm start` → `127.0.0.1:4317`. CSP has no `'unsafe-inline'`/`'unsafe-eval'` in `script-src`; `frame-ancestors 'none'`; `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy` set. No inline `onclick=`.
- SSRF: `isValidJobUrl()` gates `/api/pipeline` + `/api/pipeline/preview`; outbound via `safeGet()` (DNS-pinned redirect revalidation). **All 25 source fetchers use `redirect:'error'`** (the v1.76.0 six pin their host with an anchored regex first).
- XSS: CV/markdown → `stripDangerousMarkdown()`; render → `UI.md()`; JD → `sanitizeJobDescription()`; slugs → `sanitizePathName()`; scan egress → `scan-sanitize.mjs`.
- Rate limit on LLM routes; file-lock on tracker writes; activity-log redaction. `.aiignore` excludes real user data; no secrets/PII committed (incl. screenshots).

## §2 — Scan source registry (25 adapters) — **primary v1.76.0 surface**
- `GET /api/scan/sources` returns the auto-discovered registry. **25 adapters** — 20 EN + 5 RU. Verify the dropdown lists all 25 labels, including the v1.76.0 six: **BambooHR / Breezy HR / Comeet / Personio / Recruitee / SolidJobs**.
- **Two-registry check:** for each of the six, confirm it appears in BOTH `/api/scan/sources` (dropdown) AND `ALL_ADAPTERS` (fetchable). `tests/adapter-registry.test.mjs` asserts `ALL_ADAPTERS.length === 20` with the exact id list; `tests/scan-sources-endpoint.test.mjs` asserts the 20-value EN list.
- **Host detection (E2E):** with a fixture `portals.yml` (under `CAREER_OPS_ROOT=$(mktemp -d)`) add entries:
  - `careers_url: https://acme.bamboohr.com` → resolves to `…/careers/list`
  - `careers_url: https://foo.breezy.hr` → `…/json`
  - `careers_url: https://bar.jobs.personio.de` → `…/xml` (XML feed via `fetchText`)
  - `careers_url: https://baz.recruitee.com` → `…/api/offers/`
  - `careers_url: https://solid.jobs/public-api/offers/it` → SolidJobs
  - `api: https://www.comeet.co/careers-api/2.0/company/<uid>/positions?token=<t>` → Comeet
  Run an in-process scan with an injected `fetchImpl`; confirm each normalizes to the rich Job shape (`isRemote`/`workplaceType`/`source`) and that an off-domain host (`https://evil.com/...`) throws "untrusted hostname".
- **trust_filter (E2E):** add `trust_filter: { enabled: true }` to the fixture; scan a posting on a shortener (`bit.ly`) or with a company↔domain mismatch → the stored job carries `_trustLevel: 'low'|'medium'` + flags, and the `#/scan` row shows a ⚠ badge with the score in its tooltip. Remove `trust_filter` → no `_trust*` fields, no badge (pre-1.76 behaviour). **No job is ever dropped.**
- **No-cap (E2E):** scan a fixture that yields >2000 matching rows → `data/last-scan.json` stores them ALL; the `#/scan` table pages 200/row with working prev/next; nothing truncated. Confirm `SCAN_MAX_RESULTS` is no longer read.
- **Title-filter (E2E):** `title_filter.negative: ['coo']` must NOT drop "Coordinator"; `positive: ['.net']` matches "Senior .NET Developer"; a malformed `title_filter.positive: [null, 42, '']` does not crash the scan.
- **Arbeitsagentur `remoteMatch`:** `filter` paginates `homeoffice=nv_true` (up to `remoteMaxPages`) and marks every hit remote + `Deutschlandweit (Homeoffice)`; `off` skips the pass; `title` keeps only remote-titled nationwide hits.
- SSE: `GET /api/stream/scan?source=ats|regional|both` (`start`/`log`/`progress`/`done`/`error`); determinate progress; Stop; `role=log` console; error banner.
- `content_filter` (v1.75.0) still gates description/snippet on both scanners; aggregators (RemoteOK/Remotive/Working Nomads/IBM/Arbeitsagentur/Glints/Jobstreet·SEEK) still `provider:`-selected.

## §3 — Pipeline / evaluate / batch / deep
- `POST /api/pipeline/preview` + `POST /api/pipeline` (SSRF-gated). `/api/evaluate` A–G incl. Block G legitimacy + `## Machine Summary`. Batch `#/batch` → `/api/batch/merge` (file-locked, no dupes). `/api/deep` + saved-research + PDF.

## §4 — Modes / cover / apply / tracker / reports / CV
- `POST /api/mode/:slug` allowlist; unknown/missing-template → 404 not 500; single-shot contract; 6-provider context inlines cv+profile.
- `#/cover` (JD+Company required) → Generate PDF. `#/apply` checklist. `/api/tracker` canonical states + paginator. `/api/reports` + render + PDF (root-relative links). `#/cv` `PUT /api/cv` through `stripDangerousMarkdown` + PDF.

## §5 — Config / health / activity / notifications / help
- `#/config`: Profile field-form (non-destructive), Modes tab, API-keys tab. **The `trust_filter` block + per-tenant ATS `careers_url` entries are edited via the raw-YAML editor / `tracked_companies`, not the field-form — confirm graceful round-trip (untouched).**
- `#/health` OK/OPTIONAL/FAIL; `#/activity`; notifications drawer.
- `#/help`: **12 bundles**; invariant **19 H2 / 75 H3** per bundle (`canonical-docs-coverage` + `help-ui` + `help-ru-config-section`). v1.76.0 docs added the trust_filter/per-tenant prose + the no-cap note **as prose within existing sections** (no new H2/H3) and updated the §17 count to **25 adapters** and the **Source** dropdown enumeration to 25 across all 12 — confirm the counts still gate green.

## §6 — i18n (12 locales) + Arabic RTL
- 12 locales; parity + snapshot gated. The new ⚠ trust badge is language-neutral (no key). Flag `<select>` switcher; Arabic `<html dir="rtl">`. Full browser sweep: every page localizes in every locale, zero console errors.

## §7 — Runners / PDF / OpenRouter / output
- Buffered `/api/run/*`; streaming `/api/stream/*` (incl. `pdf`); `/api/output/pdfs`; `/api/openrouter/models`. PDFs embed fonts. Screenshots fixture-generated (no live data).

## §8 — Deferred / backlog (verify absent-by-design)
- Parent features not yet in the SPA: interactive **interview** onboarding, **reverse-ATS** discovery (`scan-ats-full.mjs`), **follow-up cadence** widget, **rejection-pattern** data, **portals validator**, **update-check** badge, **SQLite tracker query**, **ofertas** multi-job compare. None half-wired.
- **All 25 sources must be fully wired** (dropdown + fetch + filter + dedup + append). The v1.76.0 six and the v1.75.0 seven must each appear in `/api/scan/sources` AND `ALL_ADAPTERS` — none half-present.

## §9 — Release mechanics
- `package.json` 1.76.0; footer reads `/api/health`. README badge + CHANGELOG ×12 at 1.76.0 (parity gate green). Tag `v1.76.0` → `release.yml` → `publish-package.yml` (GitHub Packages). `parentVersion` reports 1.13.0 independently.
