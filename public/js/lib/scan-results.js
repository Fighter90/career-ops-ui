/* window.ScanResults — the #/scan results-rendering subsystem, extracted from
 * public/js/views/scan.js (v1.132.0) to pay down the 800-LOC file-size-contract
 * debt. `create(ctx)` returns { render, getRows } closing over a context object
 * the view supplies (filter elements, active facet Sets, pager, twoPagerData,
 * and a lastResults getter). NO logic change — the functions were moved verbatim
 * and their closure vars mechanically rewired to `ctx.*`. FALLBACK_SOURCES is the
 * offline mirror of the source registry (drift-gated by
 * tests/scan-fallback-sources.test.mjs). The whole subsystem is regression-guarded
 * in-browser by tests/playwright-scan-filters.mjs.
 */
window.ScanResults = (function () {
  const FALLBACK_SOURCES = [
    { value: '4dayweek',        label: '4 Day Week' },
    { value: 'a16z-speedrun-talent', label: 'a16z Speedrun' },
    { value: 'agenticjobs',     label: 'Agentic Jobs' },
    { value: 'alibaba',         label: 'Alibaba' },
    { value: 'amazon',          label: 'Amazon' },
    { value: 'arbeitnow',       label: 'Arbeitnow' },
    { value: 'arbeitsagentur',  label: 'Arbeitsagentur' },
    { value: 'ashby',           label: 'Ashby' },
    { value: 'avature',         label: 'Avature' },
    { value: 'bamboohr',        label: 'BambooHR' },
    { value: 'beesite',         label: 'beesite (GJB)' },
    { value: 'breezy',          label: 'Breezy HR' },
    { value: 'comeet',          label: 'Comeet' },
    { value: 'consider',        label: 'Consider' },
    { value: 'cryptocurrencyjobs', label: 'Cryptocurrency Jobs' },
    { value: 'csod',            label: 'Cornerstone' },
    { value: 'dassault',        label: 'Dassault Systèmes' },
    { value: 'deutschebahn',    label: 'Deutsche Bahn' },
    { value: 'echojobs',        label: 'EchoJobs' },
    { value: 'eightfold',       label: 'Eightfold' },
    { value: 'flowxtra',        label: 'Flowxtra' },
    { value: 'gem',             label: 'Gem' },
    { value: 'getonbrd',        label: 'Get on Board' },
    { value: 'getro',           label: 'Getro' },
    { value: 'glints',          label: 'Glints' },
    { value: 'greenhouse',      label: 'Greenhouse' },
    { value: 'hackernews',      label: 'Hacker News (Who is hiring)' },
    { value: 'hecklerkoch',     label: 'Heckler & Koch' },
    { value: 'higheredjobs',    label: 'HigherEdJobs' },
    { value: 'himalayas',       label: 'Himalayas' },
    { value: 'ibm',             label: 'IBM' },
    { value: 'icims',           label: 'iCIMS' },
    { value: 'jibeapply',       label: 'JibeApply (iCIMS)' },
    { value: 'jobicy',          label: 'Jobicy' },
    { value: 'jobspresso',      label: 'Jobspresso' },
    { value: 'jobstreet',       label: 'Jobstreet / SEEK' },
    { value: 'jobvite',         label: 'Jobvite' },
    { value: 'join',            label: 'JOIN' },
    { value: 'joinup',          label: 'JOINUP' },
    { value: 'justjoin',        label: 'JustJoin.it' },
    { value: 'landingjobs',     label: 'Landing.jobs' },
    { value: 'larajobs',        label: 'LaraJobs' },
    { value: 'lever',           label: 'Lever' },
    { value: 'manfred',         label: 'getManfred' },
    { value: 'meituan',         label: 'Meituan' },
    { value: 'nodesk',          label: 'NoDesk' },
    { value: 'nofluffjobs',     label: 'NoFluffJobs' },
    { value: 'oraclecloud',     label: 'Oracle Cloud (ORC)' },
    { value: 'personio',        label: 'Personio' },
    { value: 'phenom',          label: 'Phenom' },
    { value: 'pinpoint',        label: 'Pinpoint' },
    { value: 'radancy',         label: 'Radancy' },
    { value: 'recruitee',       label: 'Recruitee' },
    { value: 'remoteok',        label: 'RemoteOK' },
    { value: 'remotive',        label: 'Remotive' },
    { value: 'remotli',         label: 'Remotli' },
    { value: 'rheinmetall',     label: 'Rheinmetall' },
    { value: 'rippling',        label: 'Rippling' },
    { value: 'rss',             label: 'RSS' },
    { value: 'successfactors',  label: 'SAP SuccessFactors' },
    { value: 'senjob',          label: 'Senjob' },
    { value: 'smartrecruiters', label: 'SmartRecruiters' },
    { value: 'softgarden',      label: 'softgarden' },
    { value: 'solidjobs',       label: 'SolidJobs' },
    { value: 'teamtailor',      label: 'Teamtailor' },
    { value: 'tencent',         label: 'Tencent' },
    { value: 'thehub',          label: 'The Hub' },
    { value: 'themuse',         label: 'The Muse' },
    { value: 'tkms',            label: 'TKMS' },
    { value: 'vdab',            label: 'VDAB' },
    { value: 'weworkremotely',  label: 'We Work Remotely' },
    { value: 'workable',        label: 'Workable' },
    { value: 'workday',         label: 'Workday' },
    { value: 'workingnomads',   label: 'Working Nomads' },
    { value: 'wttj',            label: 'Welcome to the Jungle' },
    { value: 'yourator',        label: 'Yourator' },
    { value: 'geekjob',         label: 'GeekJob' },
    { value: 'getmatch',        label: 'GetMatch' },
    { value: 'habr-career',     label: 'Habr Career' },
    { value: 'hh.ru',           label: 'hh.ru' },
    { value: 'trudvsem',        label: 'Trudvsem' },
  ];

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
    ctx.resultsEl.innerHTML = '';
    const allRows = getRows();
    // v1.78.0 — refresh the country dropdown from the (scope-filtered) corpus so
    // it lists exactly the countries present, each with a count.
    paintCountryOptions(allRows);
    paintSeniorityOptions(allRows);
    const enWhen = ctx.getLastResults().en?.when ? new Date(ctx.getLastResults().en.when).toLocaleString('ru') : null;
    const ruWhen = ctx.getLastResults().ru?.when ? new Date(ctx.getLastResults().ru.when).toLocaleString('ru') : null;

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
    const lang = (window.I18n && I18n.getLang()) || 'en';
    const script = lang === 'ru' ? 'all' : 'latin';
    const dynKeywords = window.Skills.extractDynamicKeywords(allRows, { limit: 20, script });
    const dynCounts = Object.fromEntries(dynKeywords);
    // v1.55.6 — UX-4: the stack / level / dynamic facet chips are a
    // secondary refinement — collapse them behind the same "Advanced
    // filters" disclosure so a fresh result set leads with the table,
    // not a wall of chips. The body keeps the original flex-column.
    const chipsContainer = c('details', { className: 'mb-3 scan-advanced' });
    chipsContainer.appendChild(c('summary', null, t('scan.advancedFilters', 'Advanced filters')));
    const chipsBody = c('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' } });
    if (Object.keys(facets.tech).length) chipsBody.appendChild(buildChipRow(t('scan.chip.stack'), facets.tech, ctx.activeTech));
    if (Object.keys(facets.level).length) chipsBody.appendChild(buildChipRow(t('scan.chip.level'), facets.level, ctx.activeLevel));
    if (dynKeywords.length) chipsBody.appendChild(buildChipRow(t('scan.chip.dynamic', 'Keywords'), dynCounts, ctx.activeDynamic));
    // Only surface the cluster when there is at least one chip row.
    if (chipsBody.childNodes.length) {
      chipsContainer.appendChild(chipsBody);
      ctx.resultsEl.appendChild(chipsContainer);
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
      const wtClass = /remote/i.test(wt) ? 'badge-ok' : /hybrid/i.test(wt) ? 'badge-info' : '';
      // Title cell shows a "⬆ boosted" pill before the link when the
      // server-side scanner matched a `seniority_boost` keyword on the
      // title. Title attribute reveals WHICH keyword matched, so the
      // user can trace it back to portals.yml.
      // v1.76.0 — trust badge. Only shown when
      // trust_filter is enabled AND the posting is below "high" trust. The badge
      // is language-neutral (⚠ + score/100); the tooltip lists the flag codes,
      // so it renders identically across all 12 locales with no i18n keys.
      const trustBadge = (r._trustLevel && r._trustLevel !== 'high') ? c('span', {
        className: 'badge ' + (r._trustLevel === 'low' ? 'badge-bad' : 'badge-warn'),
        title: t('scan.trustTip', 'Trust') + ' ' + (r._trustScore != null ? r._trustScore + '/100' : '?')
          + (r._trustFlags && r._trustFlags.length ? ' · ' + r._trustFlags.join(', ') : ''),
        style: { marginRight: '6px', fontSize: '11px' },
      }, '⚠ ' + (r._trustScore != null ? r._trustScore : '')) : null;
      // v1.89.0 — fit-to-what-you-want badge. Only shown when the two-pager
      // yields a matchable signal (FitScore returns null otherwise — never a
      // fabricated number). Colour tiers: ≥66 ok, ≥40 info, else bad. Tooltip
      // lists what matched / what a deal-breaker violated.
      let fitBadge = null;
      if (ctx.twoPagerData && window.FitScore) {
        const fit = window.FitScore.scoreJob(r, ctx.twoPagerData, window.Countries);
        if (fit && fit.score != null) {
          const cls = fit.score >= 66 ? 'badge-ok' : fit.score >= 40 ? 'badge-info' : 'badge-bad';
          const tip = [
            fit.matched.length ? '✓ ' + fit.matched.map((x) => x.label).join(', ') : '',
            fit.violated.length ? '✗ ' + fit.violated.map((x) => x.label).join(', ') : '',
          ].filter(Boolean).join(' · ');
          fitBadge = c('span', {
            className: 'badge ' + cls,
            title: t('scan.fitTip', 'Fit to what you want') + (tip ? ' · ' + tip : ''),
            style: { marginRight: '6px', fontSize: '11px' },
          }, '◎ ' + fit.score);
        }
      }
      const titleCell = c('td', null, [
        r._boosted ? c('span', {
          className: 'badge badge-info',
          title: t('scan.boostedBy', 'Boosted by') + ': ' + (r._boostedBy || '?'),
          style: { marginRight: '6px', fontSize: '11px' },
        }, '⬆ ' + t('scan.boosted', 'boosted')) : null,
        fitBadge,
        trustBadge,
        c('a', { href: r.url, target: '_blank', rel: 'noopener', style: { color: 'var(--rausch)' } }, r.title),
      ]);
      // v1.80.0 — ⭐ favorite toggle (localStorage, by URL). Re-renders so the
      // "favorites only" filter reflects the change immediately.
      const starred = window.ScanPrefs.isFavorite(r.url);
      const starCell = c('td', { style: { width: '28px', textAlign: 'center' } },
        c('button', {
          type: 'button',
          className: 'btn-star' + (starred ? ' on' : ''),
          title: starred ? t('scan.unstar', 'Remove from favorites') : t('scan.star', 'Add to favorites'),
          'aria-label': starred ? t('scan.unstar', 'Remove from favorites') : t('scan.star', 'Add to favorites'),
          'aria-pressed': starred ? 'true' : 'false',
          onClick: () => { window.ScanPrefs.toggleFavorite(r.url); render(); },
          style: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '15px', lineHeight: '1', color: starred ? 'var(--rausch)' : 'var(--foggy)' },
        }, starred ? '★' : '☆'));
      // Optional company logo (favicon of the company's own domain) — off by
      // default; window.CompanyLogo.badge returns null when disabled.
      const logo = window.CompanyLogo ? window.CompanyLogo.badge(r.url, r.company) : null;
      const companyCell = logo
        ? c('td', { style: { minWidth: '160px' } },
            c('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } }, [logo, c('span', null, r.company || '—')]))
        : c('td', { style: { minWidth: '160px' } }, r.company || '—');
      // v1.129.0 — zero-token seniority bucket + freshness ("Nd" / today) from
      // job-facets.js. Both are best-effort: a title with no seniority word or
      // a job with no listed date renders an empty cell.
      const sen = senOf(r);
      const senCell = c('td', null, sen
        ? c('span', { className: 'badge', style: { fontSize: '11px' } }, senLabel(sen))
        : '');
      const days = window.JobFacets ? window.JobFacets.daysSince(r.date) : null;
      const freshText = days == null ? '' : (days <= 0 ? t('scan.freshToday', 'today') : days + t('scan.dSuffix', 'd'));
      const freshCell = c('td', {
        style: { fontSize: '13px', color: 'var(--foggy)', whiteSpace: 'nowrap' },
        title: r.date || '',
      }, freshText);
      return c('tr', null, [
        starCell,
        companyCell,
        titleCell,
        senCell,
        c('td', { style: { fontSize: '13px', color: 'var(--foggy)' } }, r.location || '—'),
        c('td', null, c('span', { className: 'badge ' + wtClass }, wt)),
        c('td', null, r.relocates ? c('span', { className: 'badge badge-info' }, t('scan.relocBadge', 'reloc')) : ''),
        c('td', { style: { fontSize: '13px', color: 'var(--foggy)' } }, r.salary || ''),
        freshCell,
        c('td', null, c('span', { className: 'tag' }, r.source)),
      ]);
    }));
    ctx.resultsEl.appendChild(c('div', { className: 'table-wrap' },
      c('table', { className: 'tbl' }, [
        c('thead', null, c('tr', null,
          ['★', t('scan.col.company'), t('scan.col.role'), t('scan.col.seniority', 'Seniority'), t('scan.col.loc'), t('scan.col.type'), t('scan.col.reloc', 'Reloc'), t('scan.col.salary'), t('scan.col.age', 'Age'), t('scan.col.source')].map((h) => c('th', null, h))
        )),
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
    // Sort by count desc, then alpha
    const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
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
        render();
      };
      const chip = c('span', {
        className: 'chip' + (isOn ? ' on' : ''),
        role: 'button',
        tabindex: '0',
        'aria-pressed': String(isOn),
        onClick: toggle,
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } },
      }, [name, c('span', { className: 'chip-count' }, String(count))]);
      row.appendChild(chip);
    }
    if (activeSet.size) {
      const clearAll = () => { activeSet.clear(); render(); };
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

  return { FALLBACK_SOURCES: FALLBACK_SOURCES, create: create };
})();
