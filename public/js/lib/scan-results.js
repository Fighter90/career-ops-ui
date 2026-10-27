// v1.244.0 — the #/scan results row was redesigned in place (row anatomy,
// icons-with-names, title hygiene, meta line — spec
// docs/sdd/specs/2026-10-06-scan-page-redesign.md §Implementation contract).
// CAR-115 added: sortable sticky header, windowed tbody (visible rows +
// buffer + spacer rows), inline facet chips, active-filter bar, quick-view
// row trigger, score colour bands, new-row highlight.
/* window.ScanResults — the #/scan results-rendering subsystem, extracted from
 * public/js/views/scan.js (v1.132.0) to pay down the 800-LOC file-size-contract
 * debt. `create(ctx)` returns { render, getRows } closing over a context object
 * the view supplies. FALLBACK_SOURCES is the offline mirror of the source
 * registry (drift-gated by tests/scan-fallback-sources.test.mjs). */
window.ScanResults = (function () {
  // NOT i18n keys, and deliberately so: every label here is the job board's
  // own brand name ("Built In", "hh.ru", …) — identical in all locales; the
  // drift vs the server registry is what tests/scan-fallback-sources.test.mjs
  // gates. Surrounding UI copy IS localized.
  const FALLBACK_SOURCES = [
    { value: '4dayweek', label: '4 Day Week' },
    { value: 'a16z-speedrun-talent', label: 'a16z Speedrun' },
    { value: 'adp-workforcenow', label: 'ADP Workforce Now' },
    { value: 'agenticjobs', label: 'Agentic Jobs' },
    { value: 'alibaba', label: 'Alibaba' },
    { value: 'amazon', label: 'Amazon' },
    { value: 'applitrack', label: 'AppliTrack' },
    { value: 'arbeitnow', label: 'Arbeitnow' },
    { value: 'arbeitsagentur', label: 'Arbeitsagentur' },
    { value: 'ashby', label: 'Ashby' },
    { value: 'atlassian', label: 'Atlassian' },
    { value: 'avature', label: 'Avature' },
    { value: 'bamboohr', label: 'BambooHR' },
    { value: 'beesite', label: 'beesite (GJB)' },
    { value: 'breezy', label: 'Breezy HR' },
    { value: 'builtin', label: 'Built In' },
    { value: 'bwi', label: 'BWI' },
    { value: 'careerviet', label: 'CareerViet' },
    { value: 'collage', label: 'Collage' },
    { value: 'comeet', label: 'Comeet' },
    { value: 'computrabajo', label: 'Computrabajo' },
    { value: 'consider', label: 'Consider' },
    { value: 'csod', label: 'Cornerstone' },
    { value: 'cryptocurrencyjobs', label: 'Cryptocurrency Jobs' },
    { value: 'dassault', label: 'Dassault Systèmes' },
    { value: 'deutschebahn', label: 'Deutsche Bahn' },
    { value: 'dover', label: 'Dover' },
    { value: 'eightfold', label: 'Eightfold' },
    { value: 'eploy', label: 'Eploy' },
    { value: 'feishu-jobs', label: 'Feishu Jobs' },
    { value: 'flowxtra', label: 'Flowxtra' },
    { value: 'garena', label: 'Garena' },
    { value: 'gem', label: 'Gem' },
    { value: 'generalist-world', label: 'Generalist World' },
    { value: 'getonbrd', label: 'Get on Board' },
    { value: 'manfred', label: 'getManfred' },
    { value: 'getro', label: 'Getro' },
    { value: 'glints', label: 'Glints' },
    { value: 'google', label: 'Google' },
    { value: 'greenhouse', label: 'Greenhouse' },
    { value: 'gupy', label: 'Gupy' },
    { value: 'hackernews', label: 'Hacker News (Who is hiring)' },
    { value: 'hecklerkoch', label: 'Heckler & Koch' },
    { value: 'higheredjobs', label: 'HigherEdJobs' },
    { value: 'himalayas', label: 'Himalayas' },
    { value: 'hiringroom', label: 'HiringRoom' },
    { value: 'ibm', label: 'IBM' },
    { value: 'icims', label: 'iCIMS' },
    { value: 'itviec', label: 'ITviec' },
    { value: 'jazzhr', label: 'JazzHR' },
    { value: 'jibeapply', label: 'JibeApply (iCIMS)' },
    { value: 'jobbankca', label: 'Job Bank (Canada)' },
    { value: 'jobicy', label: 'Jobicy' },
    { value: 'jobspresso', label: 'Jobspresso' },
    { value: 'jobstreet', label: 'Jobstreet / SEEK' },
    { value: 'jobvite', label: 'Jobvite' },
    { value: 'join', label: 'JOIN' },
    { value: 'joinup', label: 'JOINUP' },
    { value: 'justjoin', label: 'JustJoin.it' },
    { value: 'kalibrr', label: 'Kalibrr' },
    { value: 'landingjobs', label: 'Landing.jobs' },
    { value: 'larajobs', label: 'LaraJobs' },
    { value: 'lever', label: 'Lever' },
    { value: 'magneto', label: 'Magneto365' },
    { value: 'meituan', label: 'Meituan' },
    { value: 'mokahr', label: 'MokaHR' },
    { value: 'mycareersfuture', label: 'MyCareersFuture' },
    { value: 'neogov', label: 'NEOGOV (SchoolJobs / GovernmentJobs)' },
    { value: 'nodesk', label: 'NoDesk' },
    { value: 'nofluffjobs', label: 'NoFluffJobs' },
    { value: 'occ', label: 'OCC Mundial' },
    { value: 'oraclecloud', label: 'Oracle Cloud (ORC)' },
    { value: 'pageup', label: 'PageUp' },
    { value: 'paylocity', label: 'Paylocity' },
    { value: 'peoplesoft', label: 'PeopleSoft Candidate Gateway' },
    { value: 'personio', label: 'Personio' },
    { value: 'phenom', label: 'Phenom' },
    { value: 'pinpoint', label: 'Pinpoint' },
    { value: 'platsbanken', label: 'Platsbanken' },
    { value: 'prevueaps', label: 'PrevueAPS' },
    { value: 'pythonorg', label: 'Python.org Jobs' },
    { value: 'radancy', label: 'Radancy' },
    { value: 'recruitee', label: 'Recruitee' },
    { value: 'redrover', label: 'Red Rover' },
    { value: 'remoteok', label: 'RemoteOK' },
    { value: 'remotive', label: 'Remotive' },
    { value: 'remotli', label: 'Remotli' },
    { value: 'rheinmetall', label: 'Rheinmetall' },
    { value: 'rippling', label: 'Rippling' },
    { value: 'rss', label: 'RSS' },
    { value: 'successfactors', label: 'SAP SuccessFactors' },
    { value: 'schoolspring', label: 'SchoolSpring' },
    { value: 'senjob', label: 'Senjob' },
    { value: 'smartrecruiters', label: 'SmartRecruiters' },
    { value: 'softgarden', label: 'softgarden' },
    { value: 'solidjobs', label: 'SolidJobs' },
    { value: 'startup-jobs', label: 'Startup Jobs' },
    { value: 'taleo', label: 'Taleo' },
    { value: 'teamtailor', label: 'Teamtailor' },
    { value: 'techinasia', label: 'Tech in Asia' },
    { value: 'telegram', label: 'Telegram' },
    { value: 'telegram-channel', label: 'Telegram (strict)' },
    { value: 'tencent', label: 'Tencent' },
    { value: 'thehub', label: 'The Hub' },
    { value: 'themuse', label: 'The Muse' },
    { value: 'tkms', label: 'TKMS' },
    { value: 'torre', label: 'Torre' },
    { value: 'ultipro', label: 'UKG Pro (UltiPro)' },
    { value: 'vdab', label: 'VDAB' },
    { value: 'weworkremotely', label: 'We Work Remotely' },
    { value: 'wttj', label: 'Welcome to the Jungle' },
    { value: 'workable', label: 'Workable' },
    { value: 'workday', label: 'Workday' },
    { value: 'workingnomads', label: 'Working Nomads' },
    { value: 'yourator', label: 'Yourator' },
    { value: 'zoho-recruit', label: 'Zoho Recruit' },
    { value: 'geekjob', label: 'GeekJob' },
    { value: 'getmatch', label: 'GetMatch' },
    { value: 'habr-career', label: 'Habr Career' },
    { value: 'hh.ru', label: 'hh.ru' },
    { value: 'trudvsem', label: 'Trudvsem' },
  ];

  // v1.244.0 (spec Scope 2) — title hygiene: splits AT MOST ONE trailing
  // "| <country> | <work-type>" pair off a posting title, and only when the
  // tail reads as a BARE work-type marker (Remote / Гибрид / Удалённо / Офис
  // / Onsite…) optionally followed by a parenthetical. "Office Manager",
  // "Remote Work Policy Lead" and non-place middles never split. Pure —
  // unit-tested in tests/scan-title-split.test.mjs.
  const WORK_TAIL_RE = /^\s*(?:remote|hybrid|onsite|on-site|удал[её]нн\p{L}*|гибрид\p{L}*|офис\p{L}*|дистанц\p{L}*)\s*(?:\(|$)/iu;
  // v1.244.2 — salary cells keep only the leading money chunk (up to the
  // first •/· separator); boards append a benefits blurb after it. Pure.
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
  // CAR-115 — column sort state (closure: survives re-renders within a view).
  // Seeded from the URL (`sort`/`dir`), reported back through ctx.onSortChange.
  let sortKey = (ctx.sort && ctx.sort.key) || null;
  let sortDir = (ctx.sort && ctx.sort.dir) || 'desc';
  // CAR-115 — density for the windowed render ('comfortable' | 'compact').
  // Re-derived on every render: the pagebar toggle flips the view's density
  // and re-renders — a closure-frozen copy would keep the old row model.
  let density = (ctx.getDensity && ctx.getDensity()) || 'comfortable';
  // Row-height model per density (titles/meta are single-line CSS
  // ellipsized cells, so height is stable). The window re-measures the
  // first rendered row and self-corrects on the first scroll.
  let ROW_H = density === 'compact' ? 36 : 48;
  let measuredH = 0; // refined once real layout exists (first row offsetHeight)
  function syncDensity() {
    const next = (ctx.getDensity && ctx.getDensity()) || 'comfortable';
    if (next !== density) {
      density = next;
      ROW_H = density === 'compact' ? 36 : 48;
      measuredH = 0; // the old density's measurement is wrong for the new one
    }
  }
  const WIN_BUF = 6;   // rows rendered above + below the viewport
  const WIN_MIN = 40;  // corpora this small render whole — no windowing
  function windowRange(vp, total, rowH) {
    const vh = (vp && vp.clientHeight) || 0;
    if (!vh || total <= WIN_MIN) return [0, total];
    const start = Math.max(0, Math.floor((vp.scrollTop || 0) / rowH) - WIN_BUF);
    const count = Math.ceil(vh / rowH) + WIN_BUF * 2;
    return [start, Math.min(total, start + count)];
  }
  function sortValue(r, key) {
    if (key === 'salary') {
      const pr = window.Skills && window.Skills.parseSalaryRange ? window.Skills.parseSalaryRange(r && r.salary) : null;
      return pr ? pr.min : -1;
    }
    if (key === 'seniority') {
      const s = senOf(r);
      const i = s ? SEN_ORDER.indexOf(s) : SEN_ORDER.length;
      // Inverted so the DEFAULT desc direction reads senior-first and an
      // unclassified title sorts last in both directions.
      return SEN_ORDER.length - i;
    }
    if (key === 'date') { const d = Date.parse(r && r.date); return Number.isFinite(d) ? d : 0; }
    return String((r && r.title) || '').toLowerCase();
  }
  function applyUserSort(arr) {
    if (!sortKey) return; // default: boost-first scan order (pinned contract)
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const av = sortValue(a, sortKey); const bv = sortValue(b, sortKey);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0; // stable → ties keep the boost-first order
    });
  }
  // The URL mirror reads the live sort state so a filter commit never
  // strips ?sort=/?dir= from a shared link (CAR-115 review r2).
  function getSort() {
    return sortKey ? { key: sortKey, dir: sortDir } : null;
  }
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
    // CAR-93 — a saved-search restore stashes the desired value in
    // dataset.want because the matching option does not exist yet at
    // setFilterState time; apply it once it does (and clear the stash).
    // A user change voids the stash (scan.js), so a stale want can never
    // resurrect a filter the user just moved away from.
    const want = ctx.filterCountry.dataset.want || '';
    const target = want || prev;
    if (target && [...ctx.filterCountry.options].some((o) => o.value === target)) {
      ctx.filterCountry.value = target;
      if (want) delete ctx.filterCountry.dataset.want;
    }
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
    // CAR-93 — same saved-search stash contract as paintCountryOptions.
    const want = ctx.filterSeniority.dataset.want || '';
    const target = want || prev;
    if (target && [...ctx.filterSeniority.options].some((o) => o.value === target)) {
      ctx.filterSeniority.value = target;
      if (want) delete ctx.filterSeniority.dataset.want;
    }
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
    syncDensity(); // the pagebar density toggle may have flipped since last render
    // v1.243.0 — every re-render (facet-chip toggle, favorite star, filter
    // apply) wipes and rebuilds this whole subtree. Carry across what the
    // user was looking at: the focused chip (buildChipRow tags its chips
    // with data-chip), so a toggle doesn't drop keyboard focus — and, for
    // CAR-115, the windowed viewport's scroll position, so a star toggle
    // mid-list doesn't jump the table back to the top.
    const prevViewport = ctx.resultsEl.querySelector('.v2-scan-viewport');
    const prevScroll = prevViewport ? prevViewport.scrollTop : 0;
    const active = document.activeElement;
    const prevFocusChip = (active && typeof active.getAttribute === 'function' &&
      active.classList && active.classList.contains('chip') &&
      ctx.resultsEl.contains(active)) ? active.getAttribute('data-chip') : null;
    // CAR-93 — chips were the only focus restored across the rebuild; a
    // ⭐ toggle or a paginator click rebuilt the subtree and dropped focus
    // to <body>. Stars carry data-key (= the row URL); pager buttons are
    // matched by their full marker (tag|class|key|text — the ‹ › « » glyphs
    // are stable across rebuilds).
    const prevFocusKey = (active && typeof active.getAttribute === 'function' &&
      ctx.resultsEl.contains(active)) ? (active.getAttribute('data-key') || '') : '';
    const prevFocusMark = (active && typeof active.getAttribute === 'function' &&
      ctx.resultsEl.contains(active) && !prevFocusChip && !prevFocusKey)
      ? active.tagName + '|' + active.className + '|' + (active.getAttribute('data-key') || '') + '|' + (active.textContent || '')
      : null;
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

    // CAR-115 — the active-filter chip bar (✕ per engaged filter + Reset all)
    // lives at the top of the results so the current filter state is always
    // visible next to the count it produced. Skipped when the filter API is
    // not wired (unit-test harnesses drive SR without the view).
    const F = ctx.view && ctx.view.filtersApi;
    if (F) {
      ctx.resultsEl.appendChild(F.buildActiveBar(c, () => { ctx.pager.reset(); render(); ctx.onFilterChange && ctx.onFilterChange(); }));
    }

    if (!allRows.length) {
      ctx.resultsEl.appendChild(c('div', { className: 'empty' }, t('scan.noResults')));
      return;
    }

    // ── Chip facets (skills + level + dynamic keywords) — CAR-115: inline
    // live filters above the table (the "Advanced filters" disclosure is
    // gone). Dynamic keywords adapt to the scanned corpus, so non-
    // engineering profiles get meaningful chips too.
    const facets = window.Skills.computeFacets(allRows);
    // Filter dynamic keywords by script — non-Russian UI shouldn't show
    // Cyrillic-only tokens like "разработчик" leaking from Habr data.
    // v1.243.0 — 'uk' is a Cyrillic locale too; gating on lang === 'ru'
    // alone hid the Cyrillic keyword chips from Ukrainian users.
    const script = (lang === 'ru' || lang === 'uk') ? 'all' : 'latin';
    const dynKeywords = window.Skills.extractDynamicKeywords(allRows, { limit: 20, script });
    const dynCounts = Object.fromEntries(dynKeywords);
    const chipsBody = c('div', { className: 'v2-scan-facets' });
    if (Object.keys(facets.tech).length) chipsBody.appendChild(buildChipRow(t('scan.chip.stack'), facets.tech, ctx.activeTech));
    if (Object.keys(facets.level).length) chipsBody.appendChild(buildChipRow(t('scan.chip.level'), facets.level, ctx.activeLevel));
    if (dynKeywords.length) chipsBody.appendChild(buildChipRow(t('scan.chip.dynamic', 'Keywords'), dynCounts, ctx.activeDynamic));
    if (chipsBody.childNodes.length) {
      ctx.resultsEl.appendChild(chipsBody);
      // The rebuild replaced the node the user was interacting with — put
      // the focus back on the same chip (a keyboard toggle used to drop
      // focus to <body> mid-navigation).
      if (prevFocusChip) {
        const chip = [...chipsBody.querySelectorAll('.chip')]
          .find((n) => n.getAttribute('data-chip') === prevFocusChip);
        if (chip) chip.focus();
      }
    }

    // ── Now apply ALL filters (text/remote/source + chips) ──
    const q = (ctx.filterText.value || '').toLowerCase().trim();
    // Comma-separated OR for include ("roles to find"), and exclude terms.
    // CAR-115 — the search box also takes inline exclusions: a comma token
    // starting with "-" ("-java, python") excludes instead of includes, so
    // the single filter-bar search covers both directions.
    const qTokens = q ? q.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const qTerms = qTokens.filter((s) => !s.startsWith('-'));
    const inlineEx = qTokens.filter((s) => s.startsWith('-')).map((s) => s.slice(1)).filter(Boolean);
    const exTerms = (ctx.filterExclude.value || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean).concat(inlineEx);
    const fr = ctx.filterRemote.value;
    const fs = ctx.filterSource.value;
    const fc = ctx.filterCountry.value; // v1.78.0 — country code or '' (all)
    const fsen = ctx.filterSeniority.value; // v1.129.0 — seniority bucket or '' (all)
    const fa = parseInt(ctx.filterAge.value, 10); // v1.80.0 — max age in days (NaN = any)
    const ageCutoff = Number.isFinite(fa) && fa > 0 ? Date.now() - fa * 86400000 : null;
    // v1.80.0 — favorites-only: snapshot the starred set once per render.
    const favSet = ctx.favOnly.checked ? new Set(window.ScanPrefs.listFavorites()) : null;
    // FULL-M6 — the ⭐ column reads the SAME one-parse-per-render snapshot
    // (was: ScanPrefs.isFavorite per row = a localStorage read + JSON.parse
    // per row, ~50 parses on every render). toggleFavorite re-renders, so
    // the snapshot is never stale by more than the click it reacts to.
    const starredSet = new Set(window.ScanPrefs.listFavorites());
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
      // CAR-115 — "include without salary": salary-less rows stay visible
      // while bounds are set, but rows WITH pay must still overlap the range.
      const salAny = !!(ctx.filterSalaryAny && ctx.filterSalaryAny.checked);
      if (salAny) {
        const hasPay = window.Skills.parseSalaryRange ? !!window.Skills.parseSalaryRange(r && r.salary) : true;
        if (hasPay && !window.Skills.salaryInRange(r, salMin, salMax)) return false;
      } else if (!window.Skills.salaryInRange(r, salMin, salMax)) return false;
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
    // CAR-115 — an explicit user sort (th click, URL ?sort=) re-orders the
    // boost-first partition; ties stay stable so the default order survives.
    applyUserSort(sortedAll);
    const sorted = ctx.pager.slice(sortedAll);
    // CAR-115 — rows newly surfaced by the last scan get a one-time
    // fade/slide highlight (fresh = the run's `fresh` set, not every row).
    const freshUrls = new Set();
    for (const region of [ctx.getLastResults().en, ctx.getLastResults().ru]) {
      for (const r of ((region && region.fresh) || [])) if (r && r.url) freshUrls.add(r.url);
    }
    // CAR-115 — the row nodes are built ONCE and kept in `rowNodes`; the
    // windowed tbody below attaches only the visible slice of them.
    const rowNodes = sorted.map((r) => {
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
          // CAR-115 — colour-scale badge: score bands colour the ◎ icon
          // (green / amber / red) so a scan of the column reads at a glance.
          const bandCls = fit.score >= 70 ? ' v2-scan-score-hi' : fit.score >= 40 ? ' v2-scan-score-mid' : ' v2-scan-score-lo';
          signals.push(c('span', {
            className: 'scan-icon scan-icon--score' + bandCls, role: 'img',
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
      // Meta line 2 — company · location · source · date · work-type folded
      // into one bounded text node (whole string = the truncation tooltip;
      // the container announces itself with t('scan.postedMeta')).
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
      // "favorites only" filter reflects the change immediately. FULL-M6 —
      // starred membership comes from the render-scoped snapshot above.
      const starred = starredSet.has(r.url);
      const starCell = c('td', { className: 'scan-cell-star' },
        c('button', {
          type: 'button',
          className: 'btn-star' + (starred ? ' on' : ''),
          // CAR-93 — stable row identity: render() restores keyboard focus
          // to the starred row's button after the rebuild (the tag|class|
          // text marker is identical for every row's star).
          'data-key': r.url || '',
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
      // CAR-115 — quick view: the row opens the side panel (click; Enter/
      // Space on the focused row) except on nested controls (star, link) —
      // the same guard the #/pipeline rows use. <tr> keeps table semantics.
      const openQV = (e) => {
        const tgt = e && e.target;
        if (tgt && tgt !== e.currentTarget && typeof tgt.closest === 'function' && tgt.closest('a,button')) return;
        if (ctx.onQuickView) ctx.onQuickView(r);
      };
      return c('tr', {
        className: 'scan-row v2-scan-rowbtn' + (r._boosted ? ' row-boosted' : '') + (freshUrls.has(r.url) ? ' v2-scan-isnew' : ''),
        tabindex: '0',
        // The posting URL rides the row: quick-view close() re-resolves a
        // replaced row by it (the windowed tbody can detach nodes mid-session).
        'data-url': r.url || '',
        title: t('scan.v2.quickHint', 'Click to preview'),
        onClick: openQV,
        onKeydown: (e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (ctx.onQuickView) ctx.onQuickView(r); }
        },
      }, [
        starCell,
        postingCell,
        senCell,
        salaryCell,
      ]);
    });
    // CAR-115 — sticky sortable header + windowed body: only the rows in
    // (viewport + buffer) attach; spacer rows keep the scrollbar honest.
    // Small corpora (≤ WIN_MIN) render whole; row nodes are built once, so
    // a window move is a cheap re-attach.
    const tbody = c('tbody'); // window-filled by paintWindow below
    const viewport = c('div', { className: 'table-wrap v2-scan-viewport' });
    const sortBtn = (label, key, extraCls) => {
      const active = sortKey === key;
      return c('th', {
        className: extraCls || '',
        'aria-sort': active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none',
      }, c('button', {
        type: 'button', className: 'v2-scan-sort',
        'aria-label': t('scan.v2.sortBy', 'Sort by') + ' ' + label,
        title: t('scan.v2.sortBy', 'Sort by') + ' ' + label,
        onClick: () => {
          if (sortKey === key) sortDir = (sortDir === 'asc' ? 'desc' : 'asc');
          else { sortKey = key; sortDir = (key === 'title' ? 'asc' : 'desc'); }
          if (ctx.onSortChange) ctx.onSortChange(sortKey, sortDir);
          render();
        },
      }, [label, c('span', { className: 'v2-scan-sort-ind', 'aria-hidden': 'true' }, active ? (sortDir === 'asc' ? '▴' : '▾') : '↕')]));
    };
    const table = c('table', {
      className: 'tbl scan-tbl' + (density === 'compact' ? ' v2-scan-compact' : ''),
    }, [
      c('thead', null, c('tr', null, [
        c('th', { className: 'scan-col-star' }, '★'),
        sortBtn(t('scan.col.role'), 'title'),
        sortBtn(t('scan.col.seniority', 'Seniority'), 'seniority', 'scan-col-aux scan-col-sen'),
        sortBtn(t('scan.col.salary'), 'salary', 'scan-col-aux scan-col-salary'),
      ])),
      tbody,
    ]);
    viewport.appendChild(table);
    ctx.resultsEl.appendChild(viewport);
    // Window paint: attach [start,end) of the pre-built nodes plus spacer
    // rows sized to the off-screen remainder.
    let curS = -1, curE = -1;
    const paintWindow = () => {
      const rh = measuredH || ROW_H;
      const range = windowRange(viewport, rowNodes.length, rh);
      if (range[0] === curS && range[1] === curE) return;
      // A repaint that re-attaches the focused row must hand focus back to
      // it (the wipe below used to drop focus to <body> mid-scroll).
      const act = (typeof document !== 'undefined' && document.activeElement) || null;
      const focusRow = (act && typeof act.closest === 'function' && act.closest('tr.scan-row')) || null;
      const focusIdx = focusRow ? rowNodes.indexOf(focusRow) : -1;
      curS = range[0]; curE = range[1];
      tbody.textContent = '';
      if (curS > 0) {
        tbody.appendChild(c('tr', { className: 'v2-scan-pad', 'aria-hidden': 'true' },
          c('td', { colSpan: '4', style: { height: (curS * rh) + 'px' } }, '')));
      }
      for (let i = curS; i < curE; i++) tbody.appendChild(rowNodes[i]);
      if (curE < rowNodes.length) {
        tbody.appendChild(c('tr', { className: 'v2-scan-pad', 'aria-hidden': 'true' },
          c('td', { colSpan: '4', style: { height: ((rowNodes.length - curE) * rh) + 'px' } }, '')));
      }
      if (focusIdx >= curS && focusIdx < curE && typeof rowNodes[focusIdx].focus === 'function') {
        try { rowNodes[focusIdx].focus(); } catch { /* detached */ }
      }
    };
    paintWindow();
    // Self-correct the row-height model once real layout exists (the first
    // rendered row's offsetHeight); the scroll handler reuses it.
    const firstRow = tbody.querySelector('tr.scan-row');
    if (firstRow && typeof firstRow.offsetHeight === 'number' && firstRow.offsetHeight > 10) {
      measuredH = firstRow.offsetHeight;
      paintWindow();
    }
    if (typeof viewport.addEventListener === 'function') {
      viewport.addEventListener('scroll', () => paintWindow(), { passive: true });
    }
    if (prevScroll) viewport.scrollTop = prevScroll;
    paintWindow();
    // v1.30.0 — paginator replaces the v1.12-v1.29.x "first 200 of N"
    // hint. With everything on one page controls() renders just the
    // "N items" summary (never null — see UI.paginate), so small result
    // sets stay clean.
    const ctl = ctx.pager.controls(sorted.length, rows.length);
    if (ctl) ctx.resultsEl.appendChild(ctl);
    // CAR-93 — restore the star / pager focus AFTER the table + pager are
    // back in the tree (the chip restore above runs before they exist).
    if (prevFocusKey || prevFocusMark) {
      const sel = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
      for (const el of ctx.resultsEl.querySelectorAll(sel)) {
        const key = el.getAttribute && el.getAttribute('data-key');
        if (prevFocusKey && key && key === prevFocusKey) { try { el.focus(); } catch { /* detached */ } break; }
        if (!prevFocusKey && prevFocusMark) {
          const mark = el.tagName + '|' + el.className + '|' + (key || '') + '|' + (el.textContent || '');
          if (mark === prevFocusMark) { try { el.focus(); } catch { /* detached */ } break; }
        }
      }
    }
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
    return { render: render, getRows: getRows, getSort: getSort };
  }

  return { FALLBACK_SOURCES: FALLBACK_SOURCES, create: create, splitTitleCountry: splitTitleCountry, salaryHead: salaryHead };
})();
