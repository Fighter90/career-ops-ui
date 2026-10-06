# BACKLOG — every open fix, by release

Source of truth for *what* is left; `PLAN.md` says *in which order* and *who* does it.
Each item: severity `[H]/[M]/[L]`, file:line at the time of the 2026-10-06 review, the defect,
and the fix. File:line can drift — re-verify before fixing (write the red test first).
Close an item by deleting it in the same commit as its fix; the commit message names it.

**Already fixed in v1.241.0** (review slices fully closed): routes-1, routes-2, scanners-filters, routes-3 (runners stats tracker portals scan pipeline ...), server-infra-security, llm-parsers, security-sweep (guard bypasses were mine, fixed: case-insensitive acting path; Origin must equal Host or ALLOWED_HOSTS entry), scripts-ci-packaging, tests-1 (and partially tests-2/3, stopped).
Fix-and-cover agents A/B/C/D/CI/T; see CHANGELOG 1.241.0.

---

## v1.242.0 — sources correctness (Phase 2)

Cross-cutting rule for every source: a 200 with the wrong shape **throws** on page 1; a later
page failure keeps partials and logs; pagination stops on the **raw** page length; job URLs
must be `https:` on the pinned host; adapters parse `api` and match an exact host (never
`includes('vendor')`); `region` is `en`/`ru`. First create `server/lib/sources/_shape.mjs`
(`requireArray`, `requireContainer`) — the registry skips `_` files.

Also from Phase 1 hand-offs: `sources/mokahr.mjs` and `sources/feishu-jobs.mjs` must stop reading
`careers_url ?? api` directly; raise branch coverage of `habr.mjs`, `hh.mjs` (ratchet exemptions).

## sources-6 (phenom..remoteok etc.)
- [M] sources/phenom.mjs:242: succeededOnce before shape check; malformed first page -> []. 
- [M] rheinmetall.mjs:160 page loop no try/catch -> one 503 loses all earlier pages.
- [M] rheinmetall.mjs:166 & radancy.mjs:457: page-1 200 with zero cards only warns, returns [] (Cloudflare challenge).
- [M] pinpoint.mjs:85, recruitee.mjs:115, personio.mjs:88-94, pythonorg.mjs:229, redrover.mjs:173: wrong-shape body -> [] instead of throw.
- [M] radancy.mjs:365: JSON fragment transport dead in prod (only when opts.fetchJson passed; callers don't). Default fetchJsonImpl.
- [M] radancy.mjs:53,82 vs 99-103: resolveListUrl yields endpoints assertRadancyUrl rejects (no lang segment / en-us) -> every scan fails. Widen regex.
- [L] radancy.mjs:161-225 job url no scheme/origin check (javascript:, data:, //evil).
- [L] peoplesoft.mjs:788 peoplesoftIncomplete has no consumer.
- [L] phenom.mjs:50 MAX_JOBS silent truncation.
- [L] remoteok.mjs/remotive.mjs: feed URL no https/host assert; http: urls accepted.

## sources-8 (thehub..yourator)
- [M] workingnomads.mjs:34 + adapters/workingnomads.mjs:23: no https/host assert -> SSRF to http://169.254.169.254 (bypasses fetchJson DNS guard).
- [M] workday.mjs:217-300: strict default false -> every failure [] ; 404 quarantine unreachable; lastWorkdayFallback never read; null body TypeError.
- [M] workday.mjs:249: only offset 0 limit 100 -> tenants >100 postings truncated silently.
- [M] workable.mjs:198, yourator.mjs:195, tkms.mjs:125, vdab.mjs:274 (counts succeeded++ on missing resultaten), weworkremotely.mjs:95, trudvsem.mjs:75: malformed 200 -> [].
- [M] taleo.mjs:186-218,422: extractHeadings fallback to all <th>/<label> -> zero rows after 100 POSTs silently. Throw when requisitionList non-empty and 0 rows parse.
- [M] vdab.mjs:62,186 REMOTE_RE bare '100%' marks 'Verpleegkundige (100%)' remote.
- [L] themuse.mjs:124, trudvsem.mjs:60: later-page reject/JSON error discards earlier pages.
- [L] trudvsem.mjs:60: no redirect:'error'; id-less vacancy -> shared url.
- [L] torre/workingnomads/workday date not YYYY-MM-DD -> freshness blank.
- [L] taleo/yourator/tkms cap hit no log; ultiproTruncated flag lost in en-scanner slice/map.

## sources-1 (4dayweek..arbeitsagentur etc: alibaba amazon ashby avature bamboohr beesite applitrack)
- [M] alibaba:118 amazon:145 bamboohr:75 beesite:104 ashby:29 arbeitsagentur:187 applitrack:197(blank body skips canary): wrong-shape 200 -> []. alibaba total=0 if totalCount renamed.
- [M] avature.mjs:241 last-page test uses FILTERED rows vs PAGE_SIZE -> drop of one card stops walk. Use raw article count.
- [M] arbeitsagentur.mjs:47 REMOTE_RE has 100\s*% and bundesweit/deutschlandweit -> on-site titles remote.
- [M] adapters/ashby.mjs:16 host pinned only by api.includes('ashbyhq'); source has no URL assert; jobUrl not validated (javascript:). greenhouse adapter :80,84 same includes pattern. Fix: exact-host https assert; drop non-https jobUrl.
- [L] arbeitsagentur apiUrl never validated (X-API-Key to any host).
- [L] 4dayweek.mjs:128-155: max_pages only from opts.maxPages (entry.max_pages dead); `${feedUrl}?page=N` concat breaks with query; later-page json unguarded.
- [L] agenticjobs/amazon/beesite/avature: later-page error discards collected jobs.
- [L] amazon.mjs:56 date off-by-one east of UTC (Date.parse local + toISOString). Use Date.UTC.
- [L] agenticjobs.mjs:208 snippet uncapped.

## sources-7 (rss rippling rss/smartrecruiters softgarden successfactors teamtailor telegram tencent)
- [M] smartrecruiters.mjs:24 + adapter includes('smartrecruiters.com') & rss.mjs:94: no https/host pin/redirect:'error'/DNS guard (raw fetchImpl). successfactors claims host-pinned but only checks https+hostname.
- [M] rss/teamtailor/softgarden/successfactors/smartrecruiters/tencent: malformed 200 -> [].
- [M] taleo extractHeadings: French headings / no jobs table -> all rows dropped (rawCount>0, 0 parsed). Fallback to positions or throw; restrict label scan to jobs table.
- [M] rippling.mjs:239 parse outside try -> page N>0 malformed discards collected.
- [M] tencent.mjs:86,134,167: Posts non-array -> []; missing Count stops after p1; max_pages unclamped (0.5 -> zero requests).
- [M] telegram.mjs:261 posts.slice(0,cap) keeps OLDEST posts; no pagination.
- [L] rss.mjs extractLink: CDATA link -> ''; no entity decode; scheme not validated (href).
- [L] taleo.mjs:273 date TZ off-by-one.
- [L] rippling/teamtailor/solidjobs REMOTE_RE 'distributed' marks 'Distributed Systems Engineer' remote; teamtailor invents location Remote.
- [L] telegram.mjs:214 location passed through companyName() splits on comma/dash.

## sources-4 (higheredjobs himalayas hiringroom icims itviec jazzhr jobbankca jobicy jobspresso jobstreet jobvite join jibeapply ibm)
- [H] himalayas.mjs:16 one page only (limit clamped to 20) -> sees newest ~20 of 118k; jobicy.mjs same (hasMore ignored). Fix: loop cursor with page cap.
- [M] jobspresso.mjs:93: reads nonexistent job_listing_location; ignores <job_listing:company>/<job_listing:location>; fixture invented.
- [M] jobstreet.mjs:273 & jibeapply.mjs:67,106: wrong-shape 200 -> []; jibeapply later page {jobs:{}} TypeError outside try.
- [M] jobvite/jobspresso/jobbankca/icims (+hiringroom,jazzhr): HTML challenge 200 -> []. Need container marker checks.
- [M] jobbankca.mjs:372 pagination stops on post-filter count; no retry.
- [M] itviec.mjs:300 no retry; later-page error discards pages; 404 on out-of-range page would quarantine board 14 days.
- [L] jobicy/himalayas salary fields renamed (salaryMin/Max/Currency/Period; minSalary/maxSalary/currency) -> salary always ''.
- [L] ibm.mjs:102 apiUrl override no https/host pin; job urls accept http.
- [L] jobvite.mjs:292 M/D/YYYY parsed local TZ.
- [L] jobstreet.mjs:255 maxPages/pageSize unclamped (negative -> empty).

## sources-5 (justjoin landingjobs lever mokahr mycareersfuture nodesk nofluffjobs oraclecloud larajobs ...)
- [H] justjoin.mjs:63 expects bare array; live API returns {data, meta:{next:{cursor,itemsCount}}} -> throws every scan; only 10 of 10000; salary fields employmentTypes[].from/to/currency (fixture stale snake_case). Port parent's paginated walk.
- [H] nofluffjobs.mjs:146 live API answers 400 'Required parameter salaryCurrency' -> source dead. Parent sends ?sort=newest&withSalaryMatch=true&pageTo=N&pageSize=20&salaryCurrency=PLN&salaryPeriod=month&region=pl&language=pl-PL; add pageTo loop (totalPages); drop rows without slug (filter p.title && (p.url||p.id) never rejects).
- [M] lever.mjs:16 + adapter:18: no host pin/https/redirect:'error'; adapter accepts any api containing 'lever.co' -> blind SSRF via 302. Add assertLeverUrl (api.lever.co / api.eu.lever.co), redirect:'error'. (lever also puts categories.commitment in workplaceType.)
- [M] mokahr.mjs:249 pagination stops on normalized count not raw page length (regressed parent fix rawJobs.length<MAX_LIMIT).
- [M] mokahr.mjs:242 unwrap + success===false outside try -> mid-walk in-band error discards collected; hire-r1 error text lost ({code:102,success:false,msg}). Check success===false before unwrap; same catch.
- [M] oraclecloud.mjs:331 page0 TotalJobsCount>0 but no requisitionList -> []; offset ignored re-serves until cap. Throw on page 0; stop when page adds no fresh urls.
- [M] nodesk.mjs:100 larajobs.mjs:95 (neogov.mjs:192): non-feed 200 -> []; neogov search-results-listing-container escape defeats guard. Throw unless <rss/<channel; neogov throw when page1 has items but 0 jobs.
- [M] mycareersfuture.mjs:284 returns {title,url,company,location,postedAt} without id/source/date/isRemote/workplaceType -> Source column blank, source filter drops all, empty ids. Map to 12-field shape.
- [L] landingjobs.mjs:155 only first 50 (limit capped); loop limit=50&offset.
- [L] oraclecloud.mjs:237 ExternalURL scheme unchecked (javascript:/http:). Require https + host.

## sources-2 (breezy collage comeet consider cryptocurrencyjobs csod dassault eightfold feishu-jobs flowxtra builtin ...)
- [H] collage.mjs:168 buildCollageUrl/assertCollageApiUrl:60 + feishu-jobs.mjs:121 buildFeishuUrl THROW from adapter buildEndpoint; resolveAdapter no try/catch; detectApi inside companies.map (en-scanner:186) outside per-company catch -> one misconfigured entry aborts whole EN scan (violates buildEndpoint string|null contract). Fix: adapters catch -> null, and wrap detectApi per company.
- [M] flowxtra.mjs:164: page-1 failure/malformed -> [] via catch{break}; never reads opts.company (max_pages ignored; capped 3 pages). Throw on page 1; read company.max_pages/name; tests assert soft behaviour (update).
- [M] unrecognised 2xx -> [] in breezy:62 comeet:80 consider:276 eightfold:287 csod:166 feishu-jobs:190 dassault:135,200 cryptocurrencyjobs:132,193 (exact host cryptocurrencyjobs.co, www. drops all). Throw on first page unless container present; throw when raw rows exist but zero normalise.
- [M] builtin.mjs:518: every fetchText failure incl. page1 caught -> [] ; drift guard needs >=5 rows. Rethrow when out empty on page 1.
- [L] csod.mjs:288 last-page uses post-filter count (raw requisitions length).
- [L] consider.mjs:199 dassault:149 deutschebahn:121 builtin:378 job URL scheme unchecked (javascript:, http:).
- [L] feishu-jobs.mjs:73,195 missing count -> stops after page 1.
- [L] builtin.mjs:550 added===0 judged vs global cross-query seen set.
- [L] comeet.mjs:125 ?token= leaked via fetchJson error message -> SSE log, last-scan errors, quarantine json. Redact.
- [L] consider.mjs:69 handshake GET bypasses guardResolvedHost; resolveOrigin accepts port/*.localhost; empty-title rows not dropped.

## sources-3 (garena geekjob gem generalist-world getmatch getonbrd getro glints greenhouse gupy habr hackernews hecklerkoch hh)
- [M] greenhouse.mjs:96,113 + adapter:80,84: no https/host pin/redirect:'error'; adapter accepts api containing 'greenhouse'. Port parent's assertGreenhouseUrl allowlist; adapter exact host.
- [M] geekjob.mjs:69 getmatch.mjs:75: card regex needs lookahead within {0,2000} chars else card dropped (tail card / big cards). Slice by index to next anchor.
- [M] hackernews.mjs:159: missing thread / item w/o children -> []. Throw (parent does).
- [M] gem.mjs:379 getro.mjs:398 greenhouse:103 hecklerkoch parseListing: malformed 200 -> []; tests/sources-gem.test.mjs:170 pins []. Throw on page 0 unless container.
- [M] getro.mjs:169 timeoutMs dead when signal passed (safeGet) -> stalled careers_url hangs worker. Use withTimeout(opts.signal,15000).
- [M] glints.mjs:161 maxPages/pageSize unclamped.
- [L] getonbrd.mjs:189 no fail-soft per category/page (bad category 404 quarantines entry 14d); getro no retry/pacing.
- [L] geekjob/getmatch/hh: HTML entities in title/company not decoded -> decodeEntities.
- [L] glints:117 getro:298 greenhouse:103 job URL scheme unchecked.
- [L] gem.mjs:134 getro.mjs:73,326 out-of-range timestamp RangeError aborts whole board.

## adapters-1
- [M] registry.mjs:316 resolveAdapter doesn't catch matches()/buildEndpoint() throws; collage/feishu-jobs adapters throw -> one bad entry aborts EN scan (same as sources-2 [H]). Wrap + adapters return null.
- [M] adapters/greenhouse.mjs:17 legacy boards.greenhouse.io/<slug> & boards.eu.greenhouse.io no longer claimed (missing from PATH_SLUG_HOSTS; parent LEGACY_BOARD_HOSTS #4195 not ported).
- [M] adapters/greenhouse.mjs:80,84 & ashby.mjs:17,21 claim any api containing 'greenhouse'/'ashbyhq' (greenhouse 7th wins before jobicy/himalayas whose api contains 'greenhouse' as a query) ; non-string api throws. Parse api: https + exact host.
- [M] adapters/gem.mjs:19: REST mode unreachable via adapter (boardId requires jobs.gem.com); matches() identical branches.
- [M] adapters/generalist-world.mjs:50 buildEndpoint falls back to careers_url -> homepage -> parser throws; drop careers_url fallback.
- [L] ibm.mjs / arbeitsagentur.mjs adapters return company.api unpinned.
- [L] hecklerkoch.mjs:35 accepts any *.heckler-koch.com subdomain (karriere.* 404) -> force www.
- [L] jibeapply.mjs:9 header example resolves to null.
- minor: buildEndpoint returns non-string for non-string api in 4dayweek arbeitnow arbeitsagentur flowxtra glints gupy higheredjobs himalayas ibm jobbankca jobicy jobspresso jobstreet.

## adapters-2
- [H] adapters/mokahr.mjs:27, telegram.mjs:33, telegram-channel.mjs:26: buildEndpoint THROWS (bad handle etc.) -> aborts whole EN scan (en-scanner:186 map(detectApi)); POST /api/portals/track can persist such provider entry. Return null; wrap per entry.
- [M] adapters/mokahr.mjs:22: matches accepts mokahr url in careers_url OR api but source reads careers_url ?? api -> set non-mokahr careers_url hides valid api -> throws.
- [M] lever.mjs:18,22 workable.mjs:19,24 smartrecruiters.mjs:16,20: api.includes('lever.co'/'workable.com'/'smartrecruiters.com') substring (clever.com contains lever.co); off-host claimed; non-string throws; default redirect. Parse hostname allowlist.
- [M] smartrecruiters.mjs: careers-page api pin returned as endpoint (fetches HTML); oneclick-ui/company/<Name> slug broken.
- [M] mycareersfuture (see sources-5): no id/source.
- [L] mycareersfuture adapter host test looser than source assert; api unpinned.
- [L] solidjobs.mjs:19 docblock says provider match but ignores provider.
- [L] rippling.mjs:21 provider+company.rippling pin dead (matches true, buildEndpoint null).
- [L] workday.mjs:27,86 / workable:13,21 / lever:12 / smartrecruiters:10 unanchored careers_url regexes claim look-alikes (workable www/jobs as account).

---

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
