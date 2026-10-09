// v1.244.0 — the #/scan results row was redesigned in place (row anatomy,
// icons-with-names, title hygiene, meta line — spec
// docs/sdd/specs/2026-10-06-scan-page-redesign.md §Implementation contract);
// ~470 LOC, inside the 400–800 file-size-contract band.
/* window.ScanResults — the #/scan results-rendering subsystem, extracted from
 * public/js/views/scan.js (v1.132.0) to pay down the 800-LOC file-size-contract
 * debt. `create(ctx)` returns { render, getRows } closing over a context object
 * the view supplies (filter elements, active facet Sets, pager, twoPagerData,
 * and a lastResults getter). FALLBACK_SOURCES is the offline mirror of the
 * source registry (drift-gated by tests/scan-fallback-sources.test.mjs).
 * splitTitleCountry is the pure title-hygiene helper (unit-tested in
 * tests/scan-title-split.test.mjs). The whole subsystem is regression-guarded
 * in-browser by tests/playwright-scan-filters.mjs and the layout contract in
 * tests/scan-redesign-layout.test.mjs.
 */
window.ScanResults = (function () {
  // NOT i18n keys, and deliberately so: every label here is the job board's own
  // brand name — "Built In", "hh.ru", "4 Day Week", "a16z Speedrun". A brand
  // reads the same in all 17 locales, and routing it through I18n.t() would
  // invite 17 translations of a proper noun. These mirror `meta.label` from the
  // server registry, which is English for the same reason; the drift between
  // the two is what tests/scan-fallback-sources.test.mjs gates. Surrounding UI
  // copy — the dropdown's own label, placeholder and empty state — IS localized.
  const FALLBACK_SOURCES = [
    { value: '4dayweek',              label: '4 Day Week' },
    { value: 'a16z-speedrun-talent',  label: 'a16z Speedrun' },
    { value: 'adp-workforcenow',      label: 'ADP Workforce Now' },
    { value: 'agenticjobs',           label: 'Agentic Jobs' },
    { value: 'alibaba',               label: 'Alibaba' },
    { value: 'amazon',                label: 'Amazon' },
    { value: 'arbeitnow',             label: 'Arbeitnow' },
    { value: 'arbeitsagentur',        label: 'Arbeitsagentur' },
    { value: 'ashby',                 label: 'Ashby' },
    { value: 'avature',               label: 'Avature' },
    { value: 'bamboohr',              label: 'BambooHR' },
    { value: 'beesite',               label: 'beesite (GJB)' },
    { value: 'breezy',                label: 'Breezy HR' },
    { value: 'builtin',               label: 'Built In' },
    { value: 'careerviet',            label: 'CareerViet' },
    { value: 'collage',               label: 'Collage' },
    { value: 'comeet',                label: 'Comeet' },
    { value: 'consider',              label: 'Consider' },
    { value: 'csod',                  label: 'Cornerstone' },
    { value: 'cryptocurrencyjobs',    label: 'Cryptocurrency Jobs' },
    { value: 'dassault',              label: 'Dassault Systèmes' },
    { value: 'deutschebahn',          label: 'Deutsche Bahn' },
    { value: 'eightfold',             label: 'Eightfold' },
    { value: 'eploy',                 label: 'Eploy' },
    { value: 'feishu-jobs',           label: 'Feishu Jobs' },
    { value: 'flowxtra',              label: 'Flowxtra' },
    { value: 'garena',                label: 'Garena' },
    { value: 'gem',                   label: 'Gem' },
    { value: 'generalist-world',      label: 'Generalist World' },
    { value: 'getonbrd',              label: 'Get on Board' },
    { value: 'gupy',                  label: 'Gupy' },
    { value: 'jazzhr',                label: 'JazzHR' },
    { value: 'manfred',               label: 'getManfred' },
    { value: 'getro',                 label: 'Getro' },
    { value: 'glints',                label: 'Glints' },
    { value: 'greenhouse',            label: 'Greenhouse' },
    { value: 'hackernews',            label: 'Hacker News (Who is hiring)' },
    { value: 'hecklerkoch',           label: 'Heckler & Koch' },
    { value: 'higheredjobs',          label: 'HigherEdJobs' },
    { value: 'himalayas',             label: 'Himalayas' },
    { value: 'hiringroom',            label: 'HiringRoom' },
    { value: 'ibm',                   label: 'IBM' },
    { value: 'icims',                 label: 'iCIMS' },
    { value: 'itviec',                label: 'ITviec' },
    { value: 'jibeapply',             label: 'JibeApply (iCIMS)' },
    { value: 'jobbankca',             label: 'Job Bank (Canada)' },
    { value: 'jobicy',                label: 'Jobicy' },
    { value: 'jobspresso',            label: 'Jobspresso' },
    { value: 'jobstreet',             label: 'Jobstreet / SEEK' },
    { value: 'jobvite',               label: 'Jobvite' },
    { value: 'join',                  label: 'JOIN' },
    { value: 'joinup',                label: 'JOINUP' },
    { value: 'justjoin',              label: 'JustJoin.it' },
    { value: 'landingjobs',           label: 'Landing.jobs' },
    { value: 'larajobs',              label: 'LaraJobs' },
    { value: 'lever',                 label: 'Lever' },
    { value: 'meituan',               label: 'Meituan' },
    { value: 'mokahr',                label: 'MokaHR' },
    { value: 'mycareersfuture',       label: 'MyCareersFuture' },
    { value: 'nodesk',                label: 'NoDesk' },
    { value: 'nofluffjobs',           label: 'NoFluffJobs' },
    { value: 'oraclecloud',           label: 'Oracle Cloud (ORC)' },
    { value: 'peoplesoft',            label: 'PeopleSoft Candidate Gateway' },
    { value: 'personio',              label: 'Personio' },
    { value: 'phenom',                label: 'Phenom' },
    { value: 'pinpoint',              label: 'Pinpoint' },
    { value: 'prevueaps',             label: 'PrevueAPS' },
    { value: 'applitrack',            label: 'AppliTrack' },
    { value: 'neogov',                label: 'NEOGOV (SchoolJobs / GovernmentJobs)' },
    { value: 'occ',                   label: 'OCC Mundial' },
    { value: 'redrover',              label: 'Red Rover' },
    { value: 'schoolspring',          label: 'SchoolSpring' },
    { value: 'pythonorg',             label: 'Python.org Jobs' },
    { value: 'radancy',               label: 'Radancy' },
    { value: 'recruitee',             label: 'Recruitee' },
    { value: 'remoteok',              label: 'RemoteOK' },
    { value: 'remotive',              label: 'Remotive' },
    { value: 'remotli',               label: 'Remotli' },
    { value: 'rheinmetall',           label: 'Rheinmetall' },
    { value: 'rippling',              label: 'Rippling' },
    { value: 'rss',                   label: 'RSS' },
    { value: 'startup-jobs',          label: 'Startup Jobs' },
    { value: 'successfactors',        label: 'SAP SuccessFactors' },
    { value: 'senjob',                label: 'Senjob' },
    { value: 'smartrecruiters',       label: 'SmartRecruiters' },
    { value: 'softgarden',            label: 'softgarden' },
    { value: 'solidjobs',             label: 'SolidJobs' },
    { value: 'taleo',                 label: 'Taleo' },
    { value: 'teamtailor',            label: 'Teamtailor' },
    { value: 'telegram',              label: 'Telegram' },
    { value: 'telegram-channel',      label: 'Telegram (strict)' },
    { value: 'tencent',               label: 'Tencent' },
    { value: 'thehub',                label: 'The Hub' },
    { value: 'themuse',               label: 'The Muse' },
    { value: 'tkms',                  label: 'TKMS' },
    { value: 'torre',                 label: 'Torre' },
    { value: 'ultipro',               label: 'UKG Pro (UltiPro)' },
    { value: 'vdab',                  label: 'VDAB' },
    { value: 'weworkremotely',        label: 'We Work Remotely' },
    { value: 'wttj',                  label: 'Welcome to the Jungle' },
    { value: 'workable',              label: 'Workable' },
    { value: 'workday',               label: 'Workday' },
    { value: 'workingnomads',         label: 'Working Nomads' },
    { value: 'yourator',              label: 'Yourator' },
    { value: 'geekjob',               label: 'GeekJob' },
    { value: 'getmatch',              label: 'GetMatch' },
    { value: 'habr-career',           label: 'Habr Career' },
    { value: 'hh.ru',                 label: 'hh.ru' },
    { value: 'trudvsem',              label: 'Trudvsem' },
  ];

  // v1.244.0 (spec Scope 2) — title hygiene. Scanners concatenate a trailing
  // "| Country | Remote" onto posting titles (the Grafana complaint row);
  // the redesigned row shows the role on line 1 and folds country/work-type
  // into the meta line. Unicode-aware (Cyrillic locales included): splits AT
  // MOST ONE trailing "| <country> | <work-type>" pair, and only when the
  // tail reads as a BARE work-type marker (Remote / Гибрид / Удалённо / Офис
  // / Onsite…) optionally followed by a parenthetical. "Office Manager",
  // "Remote Work Policy Lead", a single trailing pipe ("C++ | Rust
  // Developer") and non-place middle segments ("| 2nd line support |") never
  // split. Pure — unit-tested in tests/scan-title-split.test.mjs.
  const WORK_TAIL_RE = /^\s*(?:remote|hybrid|onsite|on-site|удал[её]нн\p{L}*|гибрид\p{L}*|офис\p{L}*|дистанц\p{L}*)\s*(?:\(|$)/iu;
  // v1.244.2 — boards append a benefits blurb after the money range
  // ("$224K – $263K • Offers Equity • … 401(k) …"). The visible cell keeps
  // only the leading money chunk (up to the first •/· separator). Pure +
  // exported for tests.
  function salaryHead(salary) {
    const raw = String(salary == null ? '' : salary);
    if (!raw) return '';
    const head = raw.split(/[•·]/)[0].trim();
    return head || raw.trim();
  }

  function splitTitleCountry(title, isPlace) {
    const raw = String(title == null ? '' : title).replace(/\s+/g, ' ').trim();
    const last = raw.lastIndexOf('|');
    if (last === -1) return { title: raw, country: '' };
    const tail = raw.slice(last + 1).trim();
    const head = raw.slice(0, last).trim();
    if (!head || !tail || !WORK_TAIL_RE.test(tail)) return { title: raw, country: '' };
    const prev = head.lastIndexOf('|');
    // "Role | Remote" — no country pair to lift; leave the title whole.
    if (prev === -1) return { title: raw, country: '' };
    const country = head.slice(prev + 1).trim();
    const clean = head.slice(0, prev).trim();
    // The middle segment must read as a place/name — starts with a letter
    // (any script) and keeps letter/punctuation shape. Digits, pipes or
    // role fragments ("2nd line support") mean this was never a country.
    if (!clean || !country || !/^\p{L}[\p{L}\s.,'’()–-]*$/u.test(country)) {
      return { title: raw, country: '' };
    }
    // v1.244.1 — shape alone is not enough: "Go Developer | Onsite" is
    // place-shaped but is a ROLE fragment. When the caller can say what a
    // country is (the window.Countries resolver at render time), demand it
    // agrees before lifting the segment out of the title.
    if (typeof isPlace === 'function' && !isPlace(country)) {
      return { title: raw, country: '' };
    }
    return { title: clean, country };
  }

  function create(ctx) {
    const c = window.UI.el;
    const t = ctx.t;
  const SEN_ORDER = (window.JobFacets && window.JobFacets.SENIORITY_ORDER) || ['lead', 'staff', 'senior', 'mid', 'junior', 'intern'];
  const senOf = (r) => (window.JobFacets ? window.JobFacets.seniorityFromTitle(r && r.title) : null);
  // Literal-key label lookup: a concatenated dynamic key would read as an
  // unmapped key to the i18n-coverage gate, so every key here is a literal.
  const senLabel = (s) => ({
    lead: t('scan.sen.lead', 'Lead'), staff: t('scan.sen.staff', 'Staff'),
    senior: t('scan.sen.senior', 'Senior'), mid: t('scan.sen.mid', 'Mid'),
    junior: t('scan.sen.junior', 'Junior'), intern: t('scan.sen.intern', 'Intern'),
  }[s] || s);
  function paintCountryOptions(rows) {
    const prev = ctx.filterCountry.value;
    while (ctx.filterCountry.children.length > 1) ctx.filterCountry.removeChild(ctx.filterCountry.lastChild);
    for (const co of window.Countries.countriesIn(rows)) {
      ctx.filterCountry.appendChild(c('option', { value: co.code }, `${co.flag} ${co.name} (${co.count})`));
    }
    if (prev && [...ctx.filterCountry.options].some((o) => o.value === prev)) ctx.filterCountry.value = prev;
  }
  function paintSeniorityOptions(rows) {
    const prev = ctx.filterSeniority.value;
    while (ctx.filterSeniority.children.length > 1) ctx.filterSeniority.removeChild(ctx.filterSeniority.lastChild);
    const counts = {};
    for (const r of rows || []) { const s = senOf(r); if (s) counts[s] = (counts[s] || 0) + 1; }
    for (const s of SEN_ORDER) {
      if (!counts[s]) continue;
      ctx.filterSeniority.appendChild(c('option', { value: s }, `${senLabel(s)} (${counts[s]})`));
    }
    if (prev && [...ctx.filterSeniority.options].some((o) => o.value === prev)) ctx.filterSeniority.value = prev;
  }
  function getRows() {
    const scope = ctx.filterScope.value || 'all';
    const en = ctx.getLastResults().en;
    const ru = ctx.getLastResults().ru;
    const enRows = (scope === 'fresh' ? en?.fresh : (en?.filtered || en?.fresh)) || [];
    const ruRows = (scope === 'fresh' ? ru?.fresh : (ru?.filtered || ru?.fresh)) || [];
    return [...enRows, ...ruRows];
  }
  function render() {
    // v1.243.0 — every re-render (facet-chip toggle, favorite star, filter
    // apply) wipes and rebuilds this whole subtree. Carry across what the
    // user was looking at: the Advanced-disclosure open state and the
    // focused chip (buildChipRow tags its chips with data-chip), so a
    // toggle doesn't collapse the panel or drop keyboard focus.
    const prevDetails = ctx.resultsEl.querySelector('details.scan-advanced');
    const prevOpen = prevDetails ? prevDetails.open : false;
    const active = document.activeElement;
    const prevFocusChip = (active && typeof active.getAttribute === 'function' &&
      active.classList && active.classList.contains('chip') &&
      ctx.resultsEl.contains(active)) ? active.getAttribute('data-chip') : null;
    ctx.resultsEl.innerHTML = '';
    const allRows = getRows();
    // v1.78.0 — refresh the country dropdown from the (scope-filtered) corpus so
    // it lists exactly the countries present, each with a count.
    paintCountryOptions(allRows);
    paintSeniorityOptions(allRows);
    const lang = (window.I18n && I18n.getLang()) || 'en';
    // v1.243.0 — format with the ACTIVE locale; a hard-coded 'ru' read
    // wrong (or plain wrong-script) for the other 16 locales.
    const enWhen = ctx.getLastResults().en?.when ? new Date(ctx.getLastResults().en.when).toLocaleString(lang) : null;
    const ruWhen = ctx.getLastResults().ru?.when ? new Date(ctx.getLastResults().ru.when).toLocaleString(lang) : null;

    // Header summary — labels neutralized to "ATS / Regional" so the
    // adapter geography isn't baked into the UI (F-010).
    const atsLabel = t('scan.atsBadge', 'ATS adapters');
    const regionalLabel = t('scan.regionalBadge', 'Regional portals');
    const summary = c('div', { className: 'flex gap-3 mb-3', style: { flexWrap: 'wrap' } }, [
      enWhen && c('span', { className: 'badge badge-info' }, `${atsLabel} · ${enWhen} · ${ctx.getLastResults().en.fresh?.length || 0} ${t('scan.pillNew', 'new')} / ${ctx.getLastResults().en.filtered?.length || 0} ${t('scan.pillMatching', 'matching')}`),
      ruWhen && c('span', { className: 'badge badge-info' }, `${regionalLabel} · ${ruWhen} · ${ctx.getLastResults().ru.fresh?.length || 0} ${t('scan.pillNew', 'new')} / ${ctx.getLastResults().ru.filtered?.length || 0} ${t('scan.pillMatching', 'matching')}`),
    ]);
    ctx.resultsEl.appendChild(summary);

    if (!allRows.length) {
      ctx.resultsEl.appendChild(c('div', { className: 'empty' }, t('scan.noResults')));
      return;
    }

    // ── Chip facets (skills + level + dynamic keywords) ──
    // Dynamic keywords adapt to whatever roles the user actually scanned —
    // gives meaningful chips even for non-engineering profiles (marketing,
    // design, finance, …) where the hardcoded TECH_GROUPS would be empty.
    const facets = window.Skills.computeFacets(allRows);
    // Filter dynamic keywords by script — non-Russian UI shouldn't show
    // Cyrillic-only tokens like "разработчик" leaking from Habr data.
    // v1.243.0 — 'uk' is a Cyrillic locale too; gating on lang === 'ru'
    // alone hid the Cyrillic keyword chips from Ukrainian users.
    const script = (lang === 'ru' || lang === 'uk') ? 'all' : 'latin';
    const dynKeywords = window.Skills.extractDynamicKeywords(allRows, { limit: 20, script });
    const dynCounts = Object.fromEntries(dynKeywords);
    // v1.55.6 — UX-4: the stack / level / dynamic facet chips are a
    // secondary refinement — collapse them behind the same "Advanced
    // filters" disclosure so a fresh result set leads with the table,
    // not a wall of chips. The body keeps the original flex-column.
    // v1.243.0 — the previous disclosure's open state is restored, so a
    // chip toggle inside it doesn't collapse it.
    const chipsContainer = c('details', { className: 'mb-3 scan-advanced', open: prevOpen ? '' : null });
    chipsContainer.appendChild(c('summary', null, t('scan.advancedFilters', 'Advanced filters')));
    const chipsBody = c('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' } });
    if (Object.keys(facets.tech).length) chipsBody.appendChild(buildChipRow(t('scan.chip.stack'), facets.tech, ctx.activeTech));
    if (Object.keys(facets.level).length) chipsBody.appendChild(buildChipRow(t('scan.chip.level'), facets.level, ctx.activeLevel));
    if (dynKeywords.length) chipsBody.appendChild(buildChipRow(t('scan.chip.dynamic', 'Keywords'), dynCounts, ctx.activeDynamic));
    // Only surface the cluster when there is at least one chip row.
    if (chipsBody.childNodes.length) {
      chipsContainer.appendChild(chipsBody);
      ctx.resultsEl.appendChild(chipsContainer);
      // The rebuild replaced the node the user was interacting with — put
      // the focus back on the same chip (a keyboard toggle used to drop
      // focus to <body> mid-navigation).
      if (prevFocusChip) {
        const chip = [...chipsContainer.querySelectorAll('.chip')]
          .find((n) => n.getAttribute('data-chip') === prevFocusChip);
        if (chip) chip.focus();
      }
    }

    // ── Now apply ALL filters (text/remote/source + chips) ──
    const q = (ctx.filterText.value || '').toLowerCase().trim();
    // Comma-separated OR for include ("roles to find"), and exclude terms.
    const qTerms = q ? q.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const exTerms = (ctx.filterExclude.value || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
    const fr = ctx.filterRemote.value;
    const fs = ctx.filterSource.value;
    const fc = ctx.filterCountry.value; // v1.78.0 — country code or '' (all)
    const fsen = ctx.filterSeniority.value; // v1.129.0 — seniority bucket or '' (all)
    const fa = parseInt(ctx.filterAge.value, 10); // v1.80.0 — max age in days (NaN = any)
    const ageCutoff = Number.isFinite(fa) && fa > 0 ? Date.now() - fa * 86400000 : null;
    // v1.80.0 — favorites-only: snapshot the starred set once per render.
    const favSet = ctx.favOnly.checked ? new Set(window.ScanPrefs.listFavorites()) : null;
    const salMin = parseInt(ctx.filterSalaryMin.value, 10);
    const salMax = parseInt(ctx.filterSalaryMax.value, 10);
    const rows = allRows.filter((r) => {
      const hay = (r.company + ' ' + r.title + ' ' + (r.location || '')).toLowerCase();
      if (qTerms.length && !qTerms.some((term) => hay.includes(term))) return false;      // include (OR)
      if (exTerms.length && exTerms.some((term) => hay.includes(term))) return false;      // exclude (ANY)
      if (fr === 'remote' && !r.isRemote) return false;
      if (fr === 'hybrid' && !/hybrid/i.test(r.workplaceType || '')) return false;
      if (fr === 'onsite' && (r.isRemote || /remote|hybrid/i.test(r.workplaceType || ''))) return false;
      if (fr === 'reloc' && !r.relocates) return false;
      if (fs && r.source !== fs) return false;
      if (fc && !window.Countries.rowInCountry(r, fc)) return false;
      // v1.129.0 — seniority: keep only the selected bucket; titles with no
      // seniority word (bucket null) always pass, like the other facets.
      if (fsen && senOf(r) !== fsen) return false;
      if (favSet && !favSet.has(r.url)) return false;
      // age: rows with a parseable date older than the cutoff are dropped;
      // dateless rows pass (don't penalize missing data).
      if (ageCutoff !== null && r.date) {
        const t0 = Date.parse(r.date);
        if (Number.isFinite(t0) && t0 < ageCutoff) return false;
      }
      if (!window.Skills.salaryInRange(r, salMin, salMax)) return false;
      if (!window.Skills.rowMatches(r, ctx.activeTech, ctx.activeLevel)) return false;
      if (ctx.activeDynamic.size) {
        let any = false;
        for (const k of ctx.activeDynamic) if (window.Skills.rowHasKeyword(r, k)) { any = true; break; }
        if (!any) return false;
      }
      return true;
    });
    if (!rows.length) {
      ctx.resultsEl.appendChild(c('div', { className: 'empty' }, t('track.noMatch')));
      return;
    }
    // v1.12.0 — sort boosted rows to the top of each render. Stable
    // within the boosted/non-boosted partition so the underlying scan
    // order is preserved otherwise. Boost is sourced from
    // `portals.yml::title_filter.seniority_boost` and stamped server-side
    // by both en-scanner and ru-scanner.
    // v1.30.0 — sort the FULL filtered set FIRST (so the boost-to-top
    // invariant holds across pages), then page-slice.
    const sortedAll = rows.slice().sort((a, b) => {
      const ab = a && a._boosted ? 1 : 0;
      const bb = b && b._boosted ? 1 : 0;
      return bb - ab;
    });
    const sorted = ctx.pager.slice(sortedAll);
    const tbody = c('tbody', null, sorted.map((r) => {
      const wt = r.workplaceType || (r.isRemote ? 'Remote' : 'Onsite');
      // v1.244.0 — signal-icon rail (spec AC2 / §Implementation contract):
      // boost, title-fit, fit-score, trust and reloc render as compact
      // role="img" icons in a left rail of the posting cell, each with a
      // localized accessible name (the scan.*Icon keys) and a title tooltip
      // carrying the concrete values (which keyword boosted, which band,
      // what matched / was violated). Replaces the v1.238-and-earlier word
      // badges that concatenated into one sprawling line.
      const signals = [];
      if (r._boosted) {
        // Boosted rows: title reveals WHICH keyword matched, so the user
        // can trace it back to portals.yml (tooltip unchanged from v1.132).
        signals.push(c('span', {
          className: 'scan-icon scan-icon--boost', role: 'img',
          'aria-label': t('scan.boostIcon', 'Boosted').replace('{by}', r._boostedBy || '?'),
          title: t('scan.boostedBy', 'Boosted by') + ': ' + (r._boostedBy || '?'),
        }, '⬆'));
      }
      // Parent #3260 parity — serve-time title-fit band, stamped server-side
      // (server/lib/title-fit.mjs) as r.fit = {band, score}. Annotation only:
      // it never filters, orders or counts. The band WORD moves into the
      // tooltip (with the explainer); the icon glyph carries the band shape.
      const band = r.fit && r.fit.band;
      if (band === 'strong' || band === 'related' || band === 'weak') {
        const bandWord = band === 'strong' ? t('scan.titleFit.strong', 'strong fit')
          : band === 'related' ? t('scan.titleFit.related', 'related fit')
          : t('scan.titleFit.weak', 'weak fit');
        signals.push(c('span', {
          className: 'scan-icon scan-icon--fit scan-icon--' + band, role: 'img',
          'aria-label': t('scan.fitIcon', 'Fit').replace('{band}', bandWord),
          title: bandWord + ' · ' + t('scan.titleFitTip', "Free keyword-level estimate: posting title vs your profile's target roles (config/profile.yml). Not an evaluation — Evaluate still gives the real A–G fit score."),
        }, band === 'strong' ? '◆' : band === 'related' ? '◇' : '○'));
      }
      // v1.89.0 — fit-to-what-you-want score badge → icon. Only shown when
      // the two-pager yields a matchable signal (FitScore returns null
      // otherwise — never a fabricated number). The score stays ON the icon
      // (◎ NN); the tooltip lists what matched / what a deal-breaker violated.
      if (ctx.twoPagerData && window.FitScore) {
        const fit = window.FitScore.scoreJob(r, ctx.twoPagerData, window.Countries);
        // v1.244.2 — rows WITHOUT a matchable signal render a muted "◎ —"
        // (was: nothing, which read as broken/inconsistent next to scored
        // rows). The tooltip says why: the two-pager compare found no
        // matching keywords — a number is never fabricated.
        if (!fit || fit.score == null) {
          signals.push(c('span', {
            className: 'scan-icon scan-icon--score scan-icon--none', role: 'img',
            'aria-label': t('scan.scoreNone', 'Match score: none — the two-pager compare found no matching keywords'),
            title: t('scan.scoreNoneTip', 'No matching keywords vs your two-pager, so there is no match score'),
            style: { color: 'var(--foggy)' },
          }, '◎ —'));
        }
        else if (fit && fit.score != null) {
          const tip = [
            fit.matched.length ? '✓ ' + fit.matched.map((x) => x.label).join(', ') : '',
            fit.violated.length ? '✗ ' + fit.violated.map((x) => x.label).join(', ') : '',
          ].filter(Boolean).join(' · ');
          signals.push(c('span', {
            className: 'scan-icon scan-icon--score', role: 'img',
            'aria-label': t('scan.scoreIcon', 'Fit score').replace('{score}', String(fit.score)),
            title: t('scan.fitTip', 'Fit to what you want') + (tip ? ' · ' + tip : ''),
          }, '◎ ' + fit.score));
        }
      }
      // v1.76.0 — trust icon. Only when trust_filter is enabled AND the
      // posting is below "high" trust; the tooltip lists the flag codes.
      if (r._trustLevel && r._trustLevel !== 'high') {
        const trustTip = t('scan.trustTip', 'Trust') + ' ' + (r._trustScore != null ? r._trustScore + '/100' : '?')
          + (r._trustFlags && r._trustFlags.length ? ' · ' + r._trustFlags.join(', ') : '');
        signals.push(c('span', {
          className: 'scan-icon scan-icon--trust', role: 'img',
          'aria-label': trustTip, title: trustTip,
        }, '⚠'));
      }
      // Relocation marker → icon (the reloc column folded into the rail).
      if (r.relocates) {
        signals.push(c('span', {
          className: 'scan-icon scan-icon--reloc', role: 'img',
          'aria-label': t('scan.col.reloc', 'Reloc'),
          title: t('scan.relocBadge', 'reloc'),
        }, '✈'));
      }
      // Scope 2 — title hygiene: a trailing "| Country | Remote-ish" segment
      // is split off; line 1 shows the role only. title= keeps the FULL
      // original text (the truncation + split tooltip).
      // Countries.detectCountry is intentionally conservative ("never
      // guesses") — exactly the contract this split needs: a segment it
      // cannot confidently map to a country stays in the title.
      const isPlace = (name) => !!(window.Countries && window.Countries.detectCountry
        && window.Countries.detectCountry(name));
      const split = splitTitleCountry(r.title, isPlace);
      const fullTitle = r.title || split.title;
      // v1.243.0 — only a real http(s) URL becomes a link target: a crafted
      // `javascript:` / `data:` url (or a missing one) used to be written
      // straight into href. Unlinkable rows render the title as plain text.
      const safeUrl = /^https?:\/\//i.test(r.url || '') ? r.url : null;
      // v1.244.2 — a row with an empty title rendered a blank cell that
      // stretched with its aux columns; fall back to the company, then a
      // locale-neutral dash, so every row has visible content.
      const titleText = split.title || r.company || '—';
      const titleEl = safeUrl
        ? c('a', { className: 'scan-posting-title', href: safeUrl, target: '_blank', rel: 'noopener', title: fullTitle }, titleText)
        : c('span', { className: 'scan-posting-title', title: fullTitle }, titleText);
      // Meta line 2 — company · location · source · date · work-type (the
      // company/location/type/source/age columns folded into one bounded
      // line; the aux detail that stays a column is seniority + salary). One
      // text node keeps the row inside the DOM node budget; the whole string
      // is the truncation tooltip and the container announces itself with
      // t('scan.postedMeta'). A row with a parseable date shows the fresh
      // "Nd"/today form; the full ISO date was already the freshCell title
      // and now rides in the same tooltip via the raw parts when present.
      const days = window.JobFacets ? window.JobFacets.daysSince(r.date) : null;
      const freshText = days == null ? '' : (days <= 0 ? t('scan.freshToday', 'today') : days + t('scan.dSuffix', 'd'));
      const metaText = [
        r.company || '—',
        r.location || split.country,
        r.source,
        freshText,
        wt,
      ].filter(Boolean).join(' · ');
      // Optional company logo (favicon of the company's own domain) — off by
      // default; window.CompanyLogo.badge returns null when disabled.
      const logo = window.CompanyLogo ? window.CompanyLogo.badge(r.url, r.company) : null;
      const metaEl = c('div', {
        className: 'scan-posting-meta',
        'aria-label': t('scan.postedMeta', 'Posting details'),
        title: metaText,
      }, logo ? [logo, metaText] : metaText);
      // THE bounded column (spec §Implementation contract): signal rail +
      // exactly two one-line text blocks (title / meta), CSS-ellipsized.
      const postingCell = c('td', { className: 'scan-cell-posting' }, [
        signals.length ? c('span', { className: 'scan-posting-signals' }, signals) : null,
        titleEl,
        metaEl,
      ]);
      // v1.80.0 — ⭐ favorite toggle (localStorage, by URL). Re-renders so the
      // "favorites only" filter reflects the change immediately.
      const starred = window.ScanPrefs.isFavorite(r.url);
      const starCell = c('td', { className: 'scan-cell-star' },
        c('button', {
          type: 'button',
          className: 'btn-star' + (starred ? ' on' : ''),
          title: starred ? t('scan.unstar', 'Remove from favorites') : t('scan.star', 'Add to favorites'),
          'aria-label': starred ? t('scan.unstar', 'Remove from favorites') : t('scan.star', 'Add to favorites'),
          'aria-pressed': starred ? 'true' : 'false',
          onClick: () => { window.ScanPrefs.toggleFavorite(r.url); render(); },
          style: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '15px', lineHeight: '1', color: starred ? 'var(--rausch)' : 'var(--foggy)' },
        }, starred ? '★' : '☆'));
      // v1.129.0 — zero-token seniority bucket stays a desktop-only column
      // (hidden ≤900px; the meta line carries the story on a phone).
      const sen = senOf(r);
      const senCell = c('td', { className: 'scan-cell-aux', style: { whiteSpace: 'nowrap' } }, sen
        ? c('span', { className: 'badge', style: { fontSize: '11px', whiteSpace: 'nowrap' } }, senLabel(sen))
        : '');
      // v1.244.2 — some boards put the whole benefits blurb in the salary
      // field; an unclamped cell stretched rows to ~10 lines (caught live on
      // production). The visible cell keeps only the leading money chunk (up
      // to the first •/· separator); the full string stays in the tooltip.
      const salaryFull = String(r.salary || '');
      const salaryText = salaryHead(salaryFull) || '—';
      const salaryCell = c('td', { className: 'scan-cell-aux' },
        c('span', {
          className: 'scan-salary-text',
          style: {
            display: 'block', fontSize: '13px', color: 'var(--foggy)',
            maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          },
          title: salaryText,
        }, salaryText));
      return c('tr', { className: 'scan-row' + (r._boosted ? ' row-boosted' : '') }, [
        starCell,
        postingCell,
        senCell,
        salaryCell,
      ]);
    }));
    ctx.resultsEl.appendChild(c('div', { className: 'table-wrap' },
      c('table', { className: 'tbl scan-tbl' }, [
        c('thead', null, c('tr', null, [
          c('th', { className: 'scan-col-star' }, '★'),
          c('th', null, t('scan.col.role')),
          c('th', { className: 'scan-col-aux scan-col-sen' }, t('scan.col.seniority', 'Seniority')),
          c('th', { className: 'scan-col-aux scan-col-salary' }, t('scan.col.salary')),
        ])),
        tbody,
      ])
    ));
    // v1.30.0 — paginator replaces the v1.12-v1.29.x "first 200 of N"
    // hint. controls() returns null when there's only one page, so
    // small result sets stay clean.
    ctx.resultsEl.appendChild(ctx.pager.controls(sorted.length, rows.length));
  }
  // Build a chip row for one facet category. Active selections survive across re-renders
  // because ctx.activeTech / ctx.activeLevel are scoped above.
  function buildChipRow(label, counts, activeSet) {
    const row = c('div', { className: 'chip-row' }, c('span', { className: 'chip-label' }, label));
    // v1.248.2 (QA) — a board can emit a facet value that is EMPTY (blank
    // tech/level token). An empty chip had no accessible name — its text was
    // only the aria-hidden count span — and selecting it filtered nothing
    // meaningful. Blank names are SKIPPED rather than labelled "(no value)":
    // an empty value is not a real facet dimension (it has no filterable
    // meaning and no stable identity across boards), so the clean contract is
    // a chip row that lists only real values.
    // Sort by count desc, then alpha
    const ordered = Object.entries(counts)
      .filter(([name]) => String(name == null ? '' : name).trim() !== '')
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!ordered.length) {
      row.appendChild(c('span', { style: { color: 'var(--foggy)', fontSize: '12px' } }, '—'));
      return row;
    }
    for (const [name, count] of ordered) {
      const isOn = activeSet.has(name);
      // Stateful toggle chip — keyboard-operable (WCAG 2.1.1): a bare <span>
      // isn't focusable/announced, so give it button semantics + Enter/Space.
      const toggle = () => {
        if (activeSet.has(name)) activeSet.delete(name);
        else activeSet.add(name);
        // v1.243.0 — a facet change resets the pager like every other
        // filter (applyFilters()); toggling on a deep page used to land
        // on a clamped mid-list page.
        ctx.pager.reset();
        render();
      };
      const chip = c('span', {
        className: 'chip' + (isOn ? ' on' : ''),
        role: 'button',
        tabindex: '0',
        'aria-pressed': String(isOn),
        // Stable identity across re-renders — render() restores keyboard
        // focus to the chip the user just toggled via this attribute.
        'data-chip': name,
        onClick: toggle,
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } },
      }, [name, c('span', { className: 'chip-count' }, String(count))]);
      row.appendChild(chip);
    }
    if (activeSet.size) {
      const clearAll = () => { activeSet.clear(); ctx.pager.reset(); render(); };
      row.appendChild(c('span', {
        className: 'chip clear',
        role: 'button',
        tabindex: '0',
        onClick: clearAll,
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearAll(); } },
      }, t('scan.chip.clear')));
    }
    return row;
  }
    return { render: render, getRows: getRows };
  }

  return { FALLBACK_SOURCES: FALLBACK_SOURCES, create: create, splitTitleCountry: splitTitleCountry, salaryHead: salaryHead };
})();
