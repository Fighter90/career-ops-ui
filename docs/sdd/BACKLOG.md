# BACKLOG — every open fix, by release

Source of truth for *what* is left; `PLAN.md` says *in which order* and *who* does it.
Each item: severity `[H]/[M]/[L]`, file:line at the time of the 2026-10-06 review, the defect,
and the fix. File:line can drift — re-verify before fixing (write the red test first).
Close an item by deleting it in the same commit as its fix; the commit message names it.

**Already fixed in v1.241.0** (review slices fully closed): routes-1, routes-2, scanners-filters, routes-3 (runners stats tracker portals scan pipeline ...), server-infra-security, llm-parsers, security-sweep (guard bypasses were mine, fixed: case-insensitive acting path; Origin must equal Host or ALLOWED_HOSTS entry), scripts-ci-packaging, tests-1 (and partially tests-2/3, stopped).
Fix-and-cover agents A/B/C/D/CI/T; see CHANGELOG 1.241.0.

---

## v1.242.0 — sources correctness (Phase 2)

**SHIPPED in v1.242.0** — every item that sat under this header when the phase started is closed;
the per-family sections were removed under the same rule that deletes an item in the commit of its
fix (one fix agent per file family: sources-1…sources-8, adapters-1/2; the `_shape.mjs` helper
landed first). What the phase delivered:

- `server/lib/sources/_shape.mjs` (`requireArray` / `requireContainer` / `requireObject`) —
  a 200 with the wrong shape **throws** on page 1 across ~40 sources; later-page failures keep
  partials; pagination stops on the **raw** page length; job URLs are https on the pinned host.
- Dead sources live again: **justjoin** (new envelope + cursor walk), **nofluffjobs**
  (salaryCurrency params + pageTo loop). **himalayas**/**jobicy** walk their full catalogs
  (offset/cursor pagination instead of the newest ~20).
- SSRF: exact-host pins replace `includes('vendor')` in adapters (lever, greenhouse ×5 hosts +
  legacy PATH_SLUG_HOSTS, ashby, smartrecruiters, workable, gem REST, ibm, arbeitsagentur,
  hecklerkoch www-only, workingnomads, remoteok, remotive, rss, successfactors); `redirect:'error'`;
  `resolveAdapter` + per-company `detectApi` wrapped — one bad portals entry can no longer abort
  a whole scan; `?token=` redacted in comeet errors.
- Data quality: taleo French headings, telegram keeps the NEWEST posts (paginates `?before=`),
  tencent Count-unknown walk + clamps, workday offset pagination (MAX_PAGES 20), mycareersfuture
  12-field shape, arbeitsagentur/vdab/rippling/teamtailor REMOTE_RE tightening (contract-% and
  'distributed' no longer mean remote), UTC date stamps, HTML-entity decoding (geekjob/getmatch/hh).
- Not reproducible / verified already fine: peoplesoft `peoplesoftIncomplete` (consumed at
  en-scanner:279), mokahr/telegram `buildEndpoint` throws (v1.241.0), en-scanner detectApi wrap
  (v1.241.0), `thehub.mjs` (conformed).

Still open from this phase:
- [L] dedicated tests for `sources/habr.mjs` (hh got `tests/sources-hh.test.mjs`; habr has none) —
  both remain ratchet exemptions until then.

## v1.243.0 — client, CSS/a11y, i18n (Phase 3)

Also from Phase 1 hand-offs: show `warnings` (truncation) on deep / auto-pipeline / career-plan /
market / cv-studio pages; drop `.doc` from `public/js/views/cv.js` accept list and `cv.uploadHint`
×17; `config.openaiModelHint` ×17 and help ×17 still say the web-ui default is `gpt-5-codex`
(web-ui now sends Codex-only models as `gpt-5`); raise coverage of `routes/map.mjs`, `routes/geocode.mjs`;
`content.mjs` and `networking.mjs` branch coverage (37 % / 61 %).

## client-libs-1
- [H] public/js/router.js:27 current() hash.slice(2) assumes '#/': skip link '#content' routes to 404 'ontent'; '#/?x=1' 404. Fix: ignore non-'#/' hash / strip query before default.
- [M] public/js/lib/auto-pipeline.js:153-198: stream closing without done/error renders nothing; final buf frame dropped. Same in lib/pdf-generate.js streamPostSse (button disabled forever).
- [M] public/js/api.js:187-209 API.stream calls onEvent('error') twice on dropped EventSource (native error w/o data, then onerror); cv.js data.message on undefined throws.
- [M] lib/bug-report.js:95,109: route includes job URL (#/evaluate?url=...) & report slugs (privacy invariant); slice(0,6000) before encoding -> 16KB URL; collect() reads c.status||c.state but health checks are {name,required,ok,value} -> counts always 0; copy fallback toasts success without copying.
- [M] lib/cv-diagnostics.js:46 word count ASCII-only -> non-Latin CV = 'empty'.
- [M] lib/countries.js: first alias wins: 'Sydney, New South Wales, Australia'->UK (wales), 'Latin America'->US, 'Albuquerque, New Mexico'->Mexico, 'Cambridge, MA'->UK, 'Santiago de Compostela'->Chile. Fix: longest-phrase / last comma segment; drop bare america/wales/cambridge/santiago.
- [M] lib/cv-privacy.js: bare linkedin.com/in/.. not masked; ALL-CAPS names; EU dates 12.03.2021 mangled.
- [M] lib/fit-score.js: jobSalaryNum '$100-150K'->100, '5,000 EUR/month'->5000; must-have country 'Germany or Netherlands' w/ Berlin both matched+violated.
- [L] lib/help-hint.js:38,85 & docs-fab.js:134: every dismissal focuses button (scroll/outside click steals focus). 
- [L] api.js:784 UI.providerCostHint adds 2 document listeners per call never removed (leak).

## cv/studio other

## views-2
- [M] views/memory.js:22 failed GET swallowed -> empty textarea + Save enabled -> overwrites saved note.
- [M] views/evaluate.js:79-122 ignores r.warnings (cut-off notice since v1.239.4).
- [M] views/mock-interview.js:74-131 stale-turn race (no session epoch).
- [M] views/pipeline.js:146-161 selectUrl no latest-wins guard.
- [M] pipeline.js:108-118,211-222 & health.js:14-37 async click handlers no try/catch -> silent failures.
- [L] funded.js/interview-digest.js/mode-page.js: available:false always 'script not found' (ignores reason timeout/script-error).
- [L] portals.js:217 docs-assistant.js:33,89 Enter bypasses in-flight guard; IME Enter fires.
- [L] pipeline.js:176 row mouse-only (no tabindex/role/key); isActive highlight never updates; portals toggles same aria-label.
- [L] health.js:64 FIX_TARGETS keys don't match server check names.
- [L] pipeline.js:325 overview strip never refreshed, hard-coded English stages (use TrackerStages).
- also: evaluate.js:25 prefill passes 50-char gate (spends LLM on placeholder); clipboard writeText not awaited (evaluate/mode-page); help.js back-to-top under docs FAB; list fetch failure shown as 'No saved yet'.

## views-3 (reports scan scan/filters scan/runner settings stats tracker two-pager usage)
- [M] settings.js:35 canonical archetypes fallback never runs (summary.archetypes=[] truthy) -> empty Archetypes section. Use length check.
- [M] tracker.js:551 legitimacyClass: 'Proceed with Caution' -> badge-bad (proceed before caution).
- [M] stats.js:283-322 funnel/conversion compare raw statuses ('**Applied**','aplicado') -> wrong; fold via TrackerStages.foldStatus.
- [M] scan.js:594,630 scan:refresh listeners added every #/scan visit, never removed (N fetches per tick).
- [M] scan/runner.js:200 + scan.js:22: SSE stream orphaned on navigate-away; server scan continues; new view idle; Scan -> SCAN_BUSY; can't stop orphan. Close activeES on route change / re-attach.
- [M] scan.js:44-47,177-180 client API-company test is 3-host regex drifted from server adapter registry -> eu.greenhouse/lever/workday/smartrecruiters/workable labelled 'Web-search only', counter wrong. Use server detectApi per company.
- [M] stats.js:71,88 barChart unreadable in RTL (svg <text> inherits direction) -> set direction=ltr.
- [L] scan.js:219-225 refreshResults unsequenced; wipes table on failure (catch -> {en:null,ru:null}).
- [L] two-pager.js:30 failed load looks like 'no two-pager', Save overwrites file with blanks.
- [L] stats.js:456, tracker.js:131, reports.js:102 rebuilding focused control drops keyboard focus (selects, paginators).

## views-1 (activity apply assessments auto batch career-plan config cv cv-studio dashboard deep ...)
- [H] views/cv.js:272 unsaved-changes guard can't preserve edits (Cancel re-renders and refetches; #/cv-studio bypasses via startsWith('#/cv'); language switch Router.render() no dirty check; career-plan loses plan).
- [M] cv.js:224,197 Save/sync no try/catch -> unhandled rejection no toast.
- [M] cv.js:140 X-Filename header non-ISO-8859-1 filename throws (Резюме.pdf). encodeURIComponent.
- [M] dashboard.js:195 Refresh Router.go('/dashboard') on same hash = no hashchange -> use Router.render(); tile subtitles never show counts; local: pipeline entries dead links.
- [M] api.js:187 API.stream double error (also routes/client-libs-1 finding) — cv.js:113 data.message on undefined; batch.js:143.
- [M] career-plan.js:24 cv-studio.js:22,229 config.js:628: load failures swallowed into plausible empty state; Save then overwrites (config.js writes '# error: …' into editable _profile.md raw textarea).
- [M] config.js:526 providers-changed listener leaked per visit/Save; providerCostHint (api.js:786) listeners per call (deep.js:213, auto.js:262).
- [L] activity.js:84,103 load() unawaited no try/catch no request token.
- [L] deep.js:163 canonical-section warning false positive (numbered / localized headings); deep.js:232 hard-coded 'Gemini returned no output'; clipboard unawaited; deep.js:127 filename non-ASCII->'_'.
- [L] apply.js:146 run() no in-flight guard, reads inputs after await; batch.js:119-148 no guard/disabled Run/EventSource untracked -> second concurrent batch-runner; row count stale.
- minor: hard-coded English (config.js:143,cv.js:226,cv-studio.js:71,45,auto.js:110); RTL physical margins (activity.js:34, assessments.js:104, config.js:143,799, cv-studio.js:280); cv-studio inputs placeholder-only; batch console pre no tabindex/role=log; auto.js:270 autostarts paid run from ?go=1 w/o confirm.

## client-libs-2 (skills role-stats pdf-generate scan-results score-tone modes-form report-export i18n)
- [H] lib/skills.js:131 rowHasKeyword uses \b -> Cyrillic/c++/.net dynamic keyword chips filter to zero rows. Use (?<![\p{L}\p{N}])kw(?![\p{L}\p{N}]) + u.
- [M] skills.js:182 parseSalaryRange mangles decimals/cents/suffix ('$182.9K - $240K' -> 240000..1829000; '$85,000.00' x100; '100 000 kr' x1000); disagrees with RoleStats.extractAmounts. Share one parser.
- [M] role-stats.js:34,55,84 currency detection \b near Cyrillic/ł/č never matches; K-suffix boundary; 'от 100 000 руб' null; '100 тыс. руб.' 90x; '50 000 Kč' 50M USD.
- [M] pdf-generate.js:63-141 SSE failure leaves Generate button disabled; code null (killed by signal) treated success; t('common.error') shows 'Error'; GET kinds double error.
- [M] scan-results.js:172,211,420: facet chip toggle re-renders whole DOM: Advanced <details> collapses, focus lost, page not reset (pager.reset()). Restore open/focus or update in place.
- [L] score-tone.js:37 '—','N/A','TBD' coloured bad. Letter-grade fallback only /^[A-F][+-]?$/i.
- [L] modes-form.js:94,273 nested bullets flattened; glued heading in markdown rebuild; normalise bodies to end with \n\n.
- [L] report-export.js:22,60,72 slugify a-z0-9 only -> non-Latin 'report.md'; execCommand result ignored; DOCX toast English.
- [L] scan-results.js:178,203 timestamps toLocaleString('ru') for all; Cyrillic keyword gate lang==='ru' (uk hidden); i18n.js:65 detect no 'da'.
- [L] scan-results.js:345 href from r.url unchecked -> only http(s); empty url -> href=''.

## css-a11y
- [H] overlays.css:17,34 + app.css:592: dark theme toast & .btn-dark white on --hof (near-white) contrast 1.10:1; success 1.92, error 2.94. Use color:var(--paper); dark-safe fills.
- [M] components.css:615-649 vs app.css:473: sticky onboarding/conn banner (top:0 z49) covers sticky topbar (z5): search/Doctor unclickable. One sticky or topbar top:var(--banner-h).
- [M] overlays.css:524 RTL off-canvas sidebar hidden only <=768 but mobile layout starts 900 -> sidebar on screen over content + dead 256px strip (769-900).
- [M] app.css:316 closed mobile drawer focusable/exposed (transform only): 40 invisible tab stops; no Escape. visibility:hidden/inert + Escape.
- [M] no scroll-padding-top: focus lands under sticky bars (WCAG 2.4.11). html{scroll-padding-top: calc(var(--topbar-h)+16px)}.
- [M] index.html:35,44,189,198,259 two <main>, two nav, header inside main; #content aria-live=polite announces every render; hard-coded English aria-labels (Main navigation, Toggle menu, Close dialog) no i18n; active nav no aria-current.
- [M] --rausch coral fails AA as text & as fill behind white: 3.52:1 light, 2.94 dark (btn-primary/danger/hero/conn-banner/onboarding-warn/toast.error; tracker-tab.is-active, .md a, .chip.clear, help-toc, scan title links). Use --rausch-text / --rausch-dark.
- [L] components.css:253-271 --shadow-1/--shadow-2 undefined -> qa-tile shadow/ring lost. 
- [L] overlays.css:569 docs FAB (z1150) above aria-modal dialog (z200).
- [L] tables not mirrored in RTL (.tbl text-align:left); 2 dead RTL rules (sidebar-toggle, notif-drawer__close); help-toc/score margin not mirrored.
- OK: #/scan table scrolls inside .table-wrap at 360px (scrollWidth stays 360).

## i18n-dicts
- [M] lib/i18n.js:66 detect() no 'da'; zh-Hant*/zh-MO -> zh-CN. (also client-libs-2)
- [M] config.hermesHint says Hermes last in auto order (false: AUTO_ORDER 7th of 18); onboarding.noKey.title, deep.tipManual, deep.needKey list 4/7 of 18 providers — update in 17 locales.
- [M] tests/i18n-no-latin-leaks.test.mjs:43 NON_LATIN_LOCALES omits hi; hi cvs.title 'CV Studio' English -> add hi + translate.
- [L] pipe.hint lost 2nd sentence in es, pt-BR, ko, ja, zh-CN, zh-TW.
- [L] field-specs.js:233-408: 26 labelKey/hintKey not in any locale; coverage test only scans literal t('..'); audit lacks placeholder parity check.
- [L] ru/uk/es labels left English (list in report: ru config.groupRuntime, auto.legit, health.badgeFail/Optional, config.pfProofPoints, track.histFollowups; uk top.doctor, scan.boosted/boostedBy, config.tabModes, modesTargetRoles, modesCompTargets, pfExitStory; es batch.dryRun).
- [L] ar arrows inconsistently mirrored (scan.reposts.range, cvs.mName, bug.openIssue, stats.sgGap keep →).
- [L] 33 dead keys x 17 locales (nav.settings, common.run/close, dash.evaluate, dash.system.set/unset, dash.quick.scanSub, auto.{evaluating,pdfRunning,fetchFailed,noCompany,deduped,openPdf,viewMd}, scan.{hhWarning,btnAll,btnAts,btnRegional,scanResultsApi,websearchOnly,startEnv}, set.editLink, config.{profileHint,hhUserAgent,hhUserAgentHint}, stats.{subtitle,salaryByCountry}, funded.{company,signal,source,date}).
- [L] docs/LOCALIZATION.md stale: help 29/105 vs 32/122; snapshot regeneration step missing; new-locale checklist omits RTL_LANGS & flag in LANGS; i18n.js header says 8 languages.

---

## v1.244.0 — `#/scan` redesign (Phase 4)

Spec: `specs/2026-10-06-scan-page-redesign.md`. Includes the scan view findings above
(listener leaks, orphaned SSE, drifted API-company regex, unsequenced refresh, facet chip
re-render losing focus) — fix them as part of the redesign, not twice.

## v1.245.0 — Tamil locale (Phase 5)

Follow `docs/LOCALIZATION.md` → *add a brand-new locale*; parent has `README.ta.md`.

## v1.246.0 — upstream ports (Phase 6), from the 2026-10-07 parent/upstream scan

Parent fork `origin/main` = `08db03d8`, VERSION 1.35.0, 0 behind upstream — no new providers since
`62905981`. Port now (each S unless noted):
1. Liveness: a posting that says how it will close is still open — parent `c0264e7c` (#4771) **with**
   the open #4810 line-break guard → `server/lib/liveness-core.mjs` + tests.
2. Inline tracker status edit (M) — relay `set-status.mjs --row N <state> --json` (+ `--dry-run`),
   new `POST /api/tracker/status`, select per row in `tracker.js`, i18n ×17; brings #4524 (JD archived
   on → Interview). Needs the route reviewer.
3. Anthropic model ids `claude-sonnet-5-5` / `claude-opus-5-5` (#4703) → `config-field-domains.mjs:40`,
   `anthropic.mjs` default, `llm-pricing.mjs`.
4. `fix-report-links.mjs` runner (#4751) with a dry-run preview → `routes/runners.mjs` + a button.
5. Gem `isoCountry` → country name (#4774): copy parent `providers/_country.mjs` (76 lines) to
   `server/lib/sources/_country.mjs`.
Later: evidence-confidence chip (#4452), `language.modes_dir` markets incl. `sg`/`id`/`nl` (#3793/#4687),
saved contacts (#4692/#4363, privacy review), batch cost confirm (#4746, needs batch usage logging).
Port when merged upstream: workable multi-country (#4806), smartrecruiters slug links (#4770),
radancy location (#4689), PageUp provider (#4693 → 110 sources), personio languages (#4789),
Vietnamese README/mode (#4729/#4727).

## Operator actions (not code)

- Move `PROD_URL`, `AUTH_LOGIN`, `AUTH_PASSWORD` into the `production` environment's secrets (repo-level
  secrets are still readable by every workflow).
- Deploy removal of upstream-deleted files needs `v<version>` tags present in the server checkouts.
