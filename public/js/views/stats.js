/* global Router, API, UI, I18n, RoleStats, ReportExport, window, document */
/**
 * #/stats — Statistics (v1.94.0 rework of the v1.86.0 target-role page;
 * CAR-120 reshuffled the tabs and added a real-data Overview first).
 *
 * Tab order — data first, the one LLM tab last and separated by a divider:
 *   • Overview       — CAR-120: ≥ 6 charts built from REAL data only (tracker
 *     + latest-scan snapshot + the funnel relay): status funnel, score
 *     distribution, top companies, applications over time, vacancies by
 *     country/source/week, median salary by grade, stage velocity. No LLM.
 *   • My pipeline    — your own tracker in depth (score/status/companies/
 *     roles/timeline/conversions), folded through the canonical stages.
 *   • Target-role trend — the original v1.86.0 view: vacancy/salary by country
 *     from your latest scan, plus the save-snapshot trend line.
 *   • Funnel & velocity / Lifetime / Rejection patterns / What to learn /
 *     Silent after interview — zero-token read-only relays of the parent
 *     project's own scripts, honest empty states when they are absent.
 *   • Market report  — THE one LLM tab: an AI salary/market analysis for your
 *     target roles and a region (POST /api/stats/market). Directional model
 *     estimates, clearly labelled — never mixed into the data charts.
 */
Router.register('stats', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const SVGNS = 'http://www.w3.org/2000/svg';

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('stats.title', 'Statistics by target roles')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('stats.subtitle2', 'An AI market report for your target roles, analytics on your own pipeline, and the vacancy trend from your scans.')));

  // ── shared helpers ────────────────────────────────────────────────────────
  function section(titleText, node) {
    return c('div', { className: 'card', style: { padding: '16px', margin: '0 0 20px' } }, [
      c('h2', { style: { fontSize: '15px', margin: '0 0 12px' } }, titleText),
      node,
    ]);
  }

  // v1.140.0 — a min/avg/median/max salary breakdown per country. `money` formats
  // a USD amount into the selected currency; `per` applies the year⇄month divisor.
  function salaryTable(rows, money, per) {
    const th = (txt, left) => c('th', { style: { textAlign: left ? 'left' : 'right', padding: '5px 8px', color: 'var(--foggy)', fontWeight: '600', fontSize: '12px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--line)' } }, txt);
    const td = (txt, left) => c('td', { style: { textAlign: left ? 'left' : 'right', padding: '5px 8px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderBottom: '1px solid var(--line)' } }, txt);
    const head = c('tr', null, [
      th(t('stats.colCountry', 'Country'), true), th('n'),
      th(t('stats.colMin', 'Min')), th(t('stats.colAvg', 'Avg')), th(t('stats.colMedian', 'Median')), th(t('stats.colMax', 'Max')),
    ]);
    const body = rows.map((cc) => c('tr', null, [
      td(`${cc.flag || ''} ${cc.name}`.trim(), true),
      td(String(cc.salary.count)),
      td(money(per(cc.salary.minUsd))),
      td(money(per(cc.salary.avgUsd))),
      td(money(per(cc.salary.medianUsd))),
      td(money(per(cc.salary.maxUsd))),
    ]));
    return c('div', { style: { overflowX: 'auto', marginTop: '12px' } }, [
      c('table', { style: { borderCollapse: 'collapse', width: '100%', fontSize: '13px' } }, [
        c('thead', null, head),
        c('tbody', null, body),
      ]),
    ]);
  }

  // v1.243.0 (views-3) — hoisted from renderPipeline so the CAR-120 Overview
  // KPI row reuses the same card shape.
  function statCard(value, label) {
    return c('div', { className: 'card', style: { flex: '1 1 140px', padding: '14px', textAlign: 'center' } }, [
      c('div', { style: { fontSize: '28px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' } }, String(value)),
      c('div', { style: { color: 'var(--foggy)', fontSize: '13px' } }, label),
    ]);
  }

  // CAR-120 — an aria-label summary for a chart: role="img" hides the SVG's
  // text children from the accessibility tree, so the label must carry the
  // data itself ("Score distribution: 0–1 1, 2–3 1, 4–5 2"). The table/list
  // fallbacks on the detail tabs remain the full a11y answer.
  function chartAria(title, items, valueFmt) {
    const parts = (Array.isArray(items) ? items : [])
      .filter((x) => x && x.value > 0)
      .map((x) => `${x.label} ${valueFmt ? valueFmt(x.value) : x.value}`);
    return parts.length ? `${title}: ${parts.join(', ')}` : title;
  }

  function barChart(items, valueFmt, opts) {
    const o = opts || {};
    const rows = items.filter((x) => x.value > 0);
    if (!rows.length) return c('p', { style: { color: 'var(--foggy)', padding: '8px 0' } }, t('stats.noData', 'No data for this selection.'));
    const max = Math.max(...rows.map((r) => r.value));
    const barW = 320; const rowH = 26; const labelW = 200;
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('viewBox', `0 0 ${labelW + barW + 80} ${rows.length * rowH + 8}`);
    svg.setAttribute('role', 'img');
    // CAR-120 — the accessible summary rides the role="img" node.
    if (o.ariaLabel) svg.setAttribute('aria-label', o.ariaLabel);    // v1.243.0 (views-3) — RTL pages set dir="rtl" on <html>; SVG <text>
    // inherits CSS `direction`, which mirrored the bar labels and value
    // captions into unreadable ordering (labels hugged the wrong edge,
    // values overlapped the bars). Charts are LTR compositions — pin the
    // inherited property at the svg root so every <text> child reads LTR
    // in any document direction.
    svg.style.direction = 'ltr';
    rows.forEach((r, i) => {
      const y = i * rowH + 4;
      const w = Math.max(2, Math.round((r.value / max) * barW));
      // CAR-120 — one group per bar so the native <title> tooltip and the
      // optional click-to-filter hit the whole row (label + bar + value).
      const g = document.createElementNS(SVGNS, 'g');
      const fullLabel = String(r.label || '');
      const tipText = `${fullLabel}: ${valueFmt ? valueFmt(r.value) : r.value}`;
      const tip = document.createElementNS(SVGNS, 'title');
      tip.textContent = tipText;
      g.appendChild(tip);
      if (typeof o.onItemClick === 'function') {
        // CAR-120 (Opus r2) — a mouse-only click on a role="img" chart is
        // invisible to keyboards and screen readers. role="group" on the svg
        // keeps the bars in the accessibility tree; each bar becomes a
        // named, tab-reachable link activated by Enter/Space as well.
        svg.setAttribute('role', 'group');
        g.setAttribute('class', 'v2-stats-bar');
        g.setAttribute('role', 'link');
        g.setAttribute('tabindex', '0');
        g.setAttribute('aria-label', tipText);
        const activate = () => { try { o.onItemClick(r); } catch { /* noop */ } };
        g.addEventListener('click', activate);
        g.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
        });
      }
      const label = document.createElementNS(SVGNS, 'text');
      label.setAttribute('x', '0'); label.setAttribute('y', String(y + rowH / 2 + 4));
      label.setAttribute('font-size', '13'); label.setAttribute('fill', 'currentColor');
      // Ellipsize instead of hard-cutting the last letters ("…Engineer" was
      // clipped to "…Enginee"); keep the full text as an SVG <title> tooltip.
      const MAXC = 30; // labelW is 200px; ~30 chars fit before the bar at x=200
      label.textContent = fullLabel.length > MAXC ? fullLabel.slice(0, MAXC - 1) + '…' : fullLabel;
      if (fullLabel.length > MAXC) {
        const ttl = document.createElementNS(SVGNS, 'title');
        ttl.textContent = fullLabel;
        label.appendChild(ttl);
      }
      const rect = document.createElementNS(SVGNS, 'rect');
      rect.setAttribute('x', String(labelW)); rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(w)); rect.setAttribute('height', String(rowH - 8));
      rect.setAttribute('rx', '3'); rect.setAttribute('fill', o.barFill || 'var(--accent, #4c8bf5)');
      const val = document.createElementNS(SVGNS, 'text');
      val.setAttribute('x', String(labelW + w + 6)); val.setAttribute('y', String(y + rowH / 2 + 4));
      val.setAttribute('font-size', '12'); val.setAttribute('fill', 'var(--foggy)');
      val.textContent = valueFmt ? valueFmt(r.value) : String(r.value);
      g.appendChild(label); g.appendChild(rect); g.appendChild(val);
      svg.appendChild(g);
    });
    return svg;
  }

  const loc = (I18n.getLang && I18n.getLang()) || 'en';
  const usdFmt = (() => {
    try { return new Intl.NumberFormat(loc, { maximumFractionDigits: 0, numberingSystem: 'latn' }); }
    catch { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }); }
  })();
  const usd = (n) => (n == null ? '—' : '$' + usdFmt.format(Math.round(n)));

  // Approximate USD→X FX for the currency selector. Clearly indicative (the
  // salary caveat already says "approximate FX") — not live rates.
  const FX = { USD: 1, EUR: 0.92, GBP: 0.79, RUB: 90, KZT: 480, UAH: 41, PLN: 4.0, TRY: 33, JPY: 157, CNY: 7.2 };
  const CURRENCIES = Object.keys(FX);
  function moneyFmt(cur) {
    const money = (n) => {
      if (n == null) return '—';
      const v = Math.round(n * (FX[cur] || 1));
      try { return new Intl.NumberFormat(loc, { style: 'currency', currency: cur, maximumFractionDigits: 0, numberingSystem: 'latn' }).format(v); }
      catch { return `${v} ${cur}`; }
    };
    return money;
  }
  function currencySelect(onChange) {
    const sel = c('select', { className: 'lang-select', 'aria-label': t('stats.currency', 'Currency') },
      CURRENCIES.map((cur) => c('option', { value: cur }, cur)));
    if (onChange) sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  const emptyState = (msg, ctaLabel, href) => c('div',
    { className: 'empty' }, [
      c('p', null, msg),
      href ? c('a', { className: 'btn', href }, ctaLabel) : null,
    ].filter(Boolean));

  // CAR-120 — click-to-filter: hand a chart label to #/scan's one-shot search
  // prefill (the same handoff the top-bar global search uses) and navigate.
  // Honest scope: #/tracker exposes no URL-param prefill yet, so only charts
  // whose terms the scan search actually matches are clickable.
  function scanFilter(term) {
    try { window.__scanSearchPrefill = String(term || ''); } catch { /* noop */ }
    Router.go('/scan');
  }

  // ── tab bar ───────────────────────────────────────────────────────────────
  // CAR-120 — the strip is a ONE-LINE horizontal scroller with fade edges
  // (v2-stats-* classes in overlays.css): nine tabs no longer wrap onto a
  // second line at 1280 px in any locale. The "?" help hint stays OUTSIDE the
  // scroller so it is always visible; the LLM market report is LAST, divided
  // from the data tabs by a separator.
  const panel = c('div');
  const tabDefs = [
    // CAR-120 — the Overview: real-data charts (tracker + scan + funnel
    // relay), zero LLM, first thing the page shows. The hint key shipped with
    // the ×19 dict fan-out (Opus r2 finding 8 — no keyless tab).
    { id: 'overview', label: t('stats.tabOverview', 'Overview'), hint: 'stats.hint.overview', render: renderOverview },
    { id: 'pipeline', label: t('stats.tabPipeline', 'My pipeline'), hint: 'stats.hint.pipeline', render: renderPipeline },
    { id: 'trend', label: t('stats.tabTrend', 'Target-role trend'), hint: 'stats.hint.trend', render: renderTrend },
    // funnel calibration vs benchmarks + waiting list + stage velocity,
    // relayed read-only by /api/stats/funnel (funnel-velocity.mjs).
    { id: 'funnel', label: t('stats.tabFunnel', 'Funnel & velocity'), hint: 'stats.hint.funnel', render: renderFunnel },
    // v1.118.0 (parent v1.18.0 parity) — lifetime pipeline stats (stats.mjs
    // #1605) + compensation observations (salary-gap.mjs), both read-only
    // shell-outs relayed by /api/stats/lifetime and /api/stats/salary-gap.
    { id: 'lifetime', label: t('stats.tabLifetime', 'Lifetime'), hint: 'stats.hint.lifetime', render: renderLifetime },
    // v1.117.0 — rejection patterns + per-ATS-vendor advance
    // rate from the parent's analyze-patterns.mjs (read-only shell-out).
    { id: 'patterns', label: t('stats.tabPatterns', 'Rejection patterns'), hint: 'stats.hint.patterns', render: renderPatterns },
    // v1.191.0 — tracker-wide skill-gap roll-up (weighted 5−score across all
    // evaluated reports, tiered) relayed read-only by /api/stats/upskill.
    { id: 'upskill', label: t('stats.tabUpskill', 'What to learn next'), hint: 'stats.hint.upskill', render: renderUpskill },
    // v1.193.0 — interviews silent past a courtesy window (default 30d),
    // relayed read-only by /api/stats/rejection-latency. Suggestion-only.
    { id: 'rejection', label: t('stats.tabRejection', 'Silent after interview'), hint: 'stats.hint.rejection', render: renderRejection },
    // CAR-120 — the ONE LLM tab, moved last and separated from the data tabs:
    // an AI salary/market analysis (POST /api/stats/market). Directional
    // model estimates — never mixed into the charts above.
    { id: 'market', label: t('stats.tabMarket', 'Market report'), hint: 'stats.hint.market', render: renderMarket, ai: true },
  ];
  // v1.248.2 (QA) — the "?" help affordance rides ON the tab strip (end-aligned,
  // after the tablist) instead of dropping to its own line under the tabs. The
  // wrapping flex STRIP owns the border; the tablist inside keeps only tabs
  // (the CAR-55 a11y shape), and each tab is nowrap so a long localized label
  // wraps as a unit and never drags the "?" onto a stray line.
  const tabBar = c('div', { className: 'tabs v2-stats-tabbar', role: 'tablist' });
  const btns = {};
  tabDefs.forEach((def) => {
    // The LLM tab gets a visual divider so it never reads as one more data tab.
    if (def.ai) tabBar.appendChild(c('span', { className: 'v2-stats-tabsep', 'aria-hidden': 'true' }));
    const b = c('button', { className: 'tab-btn v2-stats-tab', type: 'button', role: 'tab' }, def.label);
    b.addEventListener('click', () => activate(def.id));
    btns[def.id] = b;
    tabBar.appendChild(b);
  });
  // v1.139.0 — a caption for the active tab carrying a `?` help hint ("Rejection
  // patterns (?)"). Kept OUTSIDE the tablist so the tablist holds only tabs.
  // v1.248.2 — marginInlineStart: auto pushes it to the strip's end; the
  // LOGICAL margin mirrors correctly under [dir="rtl"] (no physical margin-left).
  // CAR-120 — it now sits outside the scroller too, so a scrolling tab row
  // never carries the hint away with it.
  const hintRow = c('div', { style: { display: 'flex', alignItems: 'center', gap: '2px', flex: '0 0 auto', padding: '0 8px', minHeight: '20px', fontSize: '13px', fontWeight: '600', color: 'var(--ink, #111)' } });
  const tabStrip = c('div', {
    className: 'v2-stats-strip',
  }, [c('div', { className: 'v2-stats-scroller' }, tabBar), hintRow]);
  root.appendChild(tabStrip);
  root.appendChild(panel);

  let active = null;
  async function activate(id) {
    if (active === id) return;
    active = id;
    Object.entries(btns).forEach(([k, b]) => {
      // CAR-120 — visuals moved to the .v2-stats-tab[aria-selected] CSS rule
      // (the strip classes live in overlays.css, last in the cascade).
      b.setAttribute('aria-selected', k === id ? 'true' : 'false');
    });
    // CAR-120 (Opus r2) — the Market tab is LAST in a horizontal scroller;
    // a deep-linked or programmatic activation must reveal it, not leave it
    // off-screen. `nearest` never scrolls the PAGE, only the strip.
    const activeBtn = btns[id];
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      try { activeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch { /* noop */ }
    }
    // refresh the active-tab caption + its help hint.
    // CAR-55 #1 (v1.247.0) — the caption used to repeat the active tab's
    // label right under the tab strip it mirrored; only the "?" help hint
    // remains (its aria-label still names the tab for screen readers).
    const activeDef = tabDefs.find((d) => d.id === id);
    hintRow.textContent = '';
    if (activeDef) {
      if (window.HelpHint && activeDef.hint) {
        hintRow.appendChild(window.HelpHint.icon(activeDef.hint, { sectionLabel: activeDef.label }));
      }
    }
    panel.textContent = '';
    panel.appendChild(c('div', { className: 'loading' }, t('common.loading', 'Loading…')));
    const def = tabDefs.find((d) => d.id === id);
    try {
      const node = await def.render();
      if (active !== id) return; // a newer tab click superseded this render — don't clobber it
      panel.textContent = '';
      panel.appendChild(node);
    } catch (err) {
      if (active !== id) return;
      panel.textContent = '';
      panel.appendChild(c('p', { style: { color: 'var(--danger, #d9534f)' } }, (err && err.message) || t('common.error', 'Something went wrong')));
    }
  }

  // ── tab 1: CAR-120 Overview — real-data charts, zero LLM ──────────────────
  // Every series comes from data the app already serves: the tracker
  // (/api/tracker + /api/tracker/stages), the latest scan snapshot
  // (/api/scan-results) and the zero-token funnel relay (/api/stats/funnel).
  // A series with no data source behind it renders an honest empty state —
  // nothing is invented. The one LLM surface (the market report) lives on its
  // own tab at the far end of the strip.
  async function renderOverview() {
    const wrap = c('div');
    const [trackerRes, stagesRes, scanRes, profileRes, funnelRes] = await Promise.all([
      API.get('/api/tracker').catch(() => ({})),
      API.get('/api/tracker/stages').catch(() => ({})),
      API.get('/api/scan-results').catch(() => ({})),
      API.get('/api/profile').catch(() => ({})),
      API.get('/api/stats/funnel').catch(() => null),
    ]);
    const rows = Array.isArray(trackerRes && trackerRes.rows) ? trackerRes.rows : [];
    const aliases = (stagesRes && stagesRes.aliases) || {};
    const TS = window.TrackerStages;
    const fold = (s) => (TS ? TS.foldStatus(s, aliases) : (s || ''));
    const jobs = [
      ...((scanRes && scanRes.en && Array.isArray(scanRes.en.filtered)) ? scanRes.en.filtered : []),
      ...((scanRes && scanRes.ru && Array.isArray(scanRes.ru.filtered)) ? scanRes.ru.filtered : []),
    ];
    const roles = (profileRes && profileRes.summary && Array.isArray(profileRes.summary.target_roles))
      ? profileRes.summary.target_roles.filter((r) => r && r.trim()) : [];
    const agg = (jobs.length && window.RoleStats && RoleStats.aggregate) ? RoleStats.aggregate(jobs, roles) : null;

    // Entrance animation (300 ms, prefers-reduced-motion opt-out in CSS).
    const ovSection = (titleText, node) => {
      const s = section(titleText, node);
      s.classList.add('v2-stats-anim');
      return s;
    };
    const addChart = (titleText, items, valueFmt, opts) => {
      const o = opts || {};
      const list = (Array.isArray(items) ? items : []).filter((x) => x && x.value > 0);
      if (!list.length) return false;
      wrap.appendChild(ovSection(titleText, barChart(list, valueFmt, {
        ariaLabel: chartAria(titleText, list, valueFmt),
        ...o,
      })));
      return true;
    };
    const hint = (txt) => c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '10px 0 0' } }, txt);

    // Opus r2 (finding 5) — the hint only promises a click that exists: it
    // renders when (and only when) a clickable chart actually rendered.
    let clickableRendered = false;

    // CAR-120 — localized stage labels for the velocity hops: the canonical
    // names go through the same track.status.* keys the #/tracker board uses
    // (composed in a variable so the static t()-scan sees no phantom key).
    const stageLabel = (s) => {
      const k = 'track.status.' + String(s || '').toLowerCase();
      return t(k, s || '');
    };
    // Days pluralized via Intl.PluralRules into per-form keys (stats.ovDay_*,
    // {n} replaced by hand — the established track.histDaysSilent pattern).
    const plural = (typeof Intl !== 'undefined' && Intl.PluralRules) ? new Intl.PluralRules(loc) : null;
    const daysFmt = (n) => {
      const cat = plural ? plural.select(n) : 'other';
      const k = 'stats.ovDay_' + cat;
      const tpl = t(k, '') || t('stats.ovDay_other', '{n} days');
      return tpl.replace('{n}', String(n));
    };
    const velFmt = (v) => daysFmt(v);

    // KPI row — the same numbers the detail tabs expand below. Opus r2
    // (finding 9): ONE shared distinct-companies fold, so the Overview KPI
    // and the Pipeline KPI can never disagree about "Companies".
    const scoredN = rows.filter((r) => scoreVal(r.score) != null).length;
    wrap.appendChild(c('div', { className: 'stat-cards', style: { display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '0 0 16px' } }, [
      statCard(rows.length, t('stats.pipeTotal', 'Total tracked')),
      statCard(scoredN, t('stats.pipeScored', 'With a score')),
      statCard(distinctCompanies(rows), t('stats.pipeCompaniesN', 'Companies')),
      statCard(jobs.length, t('stats.totalJobs', 'Total postings')),
    ]));

    // ── tracker-derived charts ──
    if (rows.length) {
      // 1. Status funnel (canonical order, folded through the alias map).
      const order = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Hired', 'Rejected', 'Discarded', 'SKIP'];
      const counts = stageCountsFolded(rows, fold);
      const funnel = order.filter((s) => counts[s]).map((s) => ({ label: s, value: counts[s] }));
      Object.keys(counts).filter((s) => !order.includes(s)).forEach((s) => funnel.push({ label: s, value: counts[s] }));
      addChart(t('stats.pipeStatus', 'Status funnel'), funnel);

      // 2. Score distribution.
      addChart(t('stats.pipeScores', 'Score distribution'), scoreBuckets(rows));

      // 3. Top companies — click a bar to see that company's postings in #/scan.
      addChart(t('stats.pipeCompanies', 'Top companies'), topCountItems(rows, 'company', 12),
        undefined, { onItemClick: (r) => scanFilter(r.label) });
      clickableRendered = true;
    }

    // ── scan-snapshot-derived charts ──
    if (jobs.length && agg) {
      // 4. Vacancies by country.
      addChart(t('stats.vacanciesByCountry', 'Vacancies by country'),
        (agg.byCountry || []).slice(0, 14).map((cc) => ({ label: `${cc.flag || ''} ${cc.name}`.trim(), value: cc.count })));

      // 5. Vacancies by source (ATS slug; URL-host fallback for strays).
      addChart(t('stats.ovVacanciesBySource', 'Vacancies by source'),
        sourceItems(jobs, (u) => (window.JobFacets ? window.JobFacets.sourceFromUrl(u) : null)).slice(0, 12));

      // 6. Postings per week (Monday weeks, last 12 weeks with data).
      addChart(t('stats.ovPostingsByWeek', 'Postings by week'),
        weekItems(jobs.map((j) => (j && j.date) || ''), { weeks: 12 }));

      // 7. Median salary by seniority grade (parseable salaries only;
      // USD midpoints through the shared approximate-FX parser).
      const gradeItems = gradeSalaryItems(jobs, {
        parseSalaryUsd: window.RoleStats ? RoleStats.parseSalaryUSD : null,
        seniorityOf: window.JobFacets ? window.JobFacets.seniorityFromTitle : null,
        // built as a variable so the static t()-key scan sees no bare
        // 'scan.sen.' prefix — the scan.sen.* keys all exist in every dict
        labelFor: (g) => { const k = 'scan.sen.' + g; return t(k, g); },
      });
      if (gradeItems.some((g) => g.value > 0)) {
        const sec = section(t('stats.ovSalaryByGrade', 'Median salary by grade'), c('div', null, [
          barChart(gradeItems, usd, {
            ariaLabel: chartAria(t('stats.ovSalaryByGrade', 'Median salary by grade'), gradeItems, usd),
            barFill: 'var(--go, #2e7d32)',
          }),
          hint(t('stats.sampleCaveat', 'Based only on postings with a parseable salary — sparse data, treat as indicative. Amounts normalized to USD (approximate FX).')),
        ]));
        sec.classList.add('v2-stats-anim');
        wrap.appendChild(sec);
      }
    }

    // 8. Time between stages — from the zero-token funnel relay (median days
    // per hop; right-censored rows excluded by the parent script itself).
    // Opus r2 (finding 6): available:false (relay absent) and
    // available:true-but-empty (relay present, nothing uncensored yet) are
    // DIFFERENT states with different messages.
    if (funnelRes && funnelRes.available === true) {
      const vel = velocityItems(funnelRes.velocity).map((v) => ({
        label: `${stageLabel(v.from)} → ${stageLabel(v.to)}`,
        value: v.value,
      }));
      if (vel.length) {
        const sec = section(t('stats.ovStageVelocity', 'Time between stages'), c('div', null, [
          barChart(vel, velFmt, {
            ariaLabel: chartAria(t('stats.ovStageVelocity', 'Time between stages'), vel, velFmt),
          }),
          hint(t('stats.funnelVelocityNote', '0-day same-day entries are excluded from the medians; "still waiting" rows are right-censored (not yet counted).')),
        ]));
        sec.classList.add('v2-stats-anim');
        wrap.appendChild(sec);
      } else {
        const sec = section(t('stats.ovStageVelocity', 'Time between stages'),
          c('p', { style: { color: 'var(--foggy)' } },
            t('stats.ovVelocityEmpty', 'Not enough replies yet — median days appear as responses come in.')));
        sec.classList.add('v2-stats-anim');
        wrap.appendChild(sec);
      }
    } else {
      const sec = section(t('stats.ovStageVelocity', 'Time between stages'),
        c('p', { style: { color: 'var(--foggy)' } },
          t('stats.funnelUnavailable', 'Funnel & velocity needs the parent career-ops project (funnel-velocity.mjs) next to this app.')));
      sec.classList.add('v2-stats-anim');
      wrap.appendChild(sec);
    }

    if (!rows.length && !jobs.length) {
      wrap.appendChild(c('div', { style: { margin: '8px 0 0' } }, emptyState(
        t('stats.noScan', 'No scan data yet. Run a scan first, then come back for the stats.'),
        t('stats.goScan', 'Run a scan'), '#/scan')));
    } else if (clickableRendered) {
      wrap.appendChild(hint(t('stats.ovClickHintScan', 'Click a bar to open those postings in Scan')));
    }
    return wrap;
  }

  // ── tab: AI market report (the ONE LLM tab) ────────────────────────────────
  async function renderMarket() {
    const wrap = c('div');
    wrap.appendChild(c('p', { style: { color: 'var(--foggy)', margin: '0 0 12px' } },
      t('stats.marketIntro', 'A salary & market analysis for your target roles and region — grades, percentiles, top employers, in-demand skills, benefits. Figures are directional estimates from the model’s knowledge, not scraped data.')));

    // CAR-55 #1 (v1.247.0) — the placeholder was truncated twice over: the
    // copy was long AND the shrink-wrapped label column starved the input.
    // Short copy + an explicit min(340px, 100%) width fit both concerns.
    const region = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'stats.marketRegionPh', style: { width: '340px', maxWidth: '100%' } });
    region.placeholder = t('stats.marketRegionPh', 'e.g. EU-remote · Germany');
    const curSel = currencySelect();
    const genBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('stats.marketGenerate', 'Generate market report'));
    const controls = c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', margin: '0 0 16px' } }, [
      c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)' } }, [t('stats.marketRegion', 'Region / market'), region]),
      c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)' } }, [t('stats.currency', 'Currency'), curSel]),
      genBtn,
      // P4-ETA (v1.170.0) → v1.248.2 — honest duration hint: a live market
      // report really runs 86–285 s, so the shared "~{n}s / 30" placeholder
      // became the dedicated stats.marketEta key ("~2–4 min" ×18).
      c('span', { className: 'eta-hint', title: t('common.etaTitle', 'Typical generation time') },
        '⏱ ' + t('stats.marketEta', '~2–4 min')),
    ]);
    const out = c('div');
    // CAR-119 — the market tab renders through the shared AI-page template:
    // controls (sticky form column) | report, with the shared run panel
    // (live elapsed/ETA + Cancel wired to an AbortSignal over the POST).
    // // CAR-119 i18n: no new dictionary keys — the kit's `llm2.*` strings
    // ship as I18n.t EN fallbacks inside public/js/lib/llm-page-kit.js.
    const runHost = c('div');
    const page = window.LlmPageKit.layout({
      form: controls,
      result: c('div', null, [runHost, out]),
    });
    wrap.appendChild(page.root);

    let currentMd = '';
    genBtn.addEventListener('click', async () => {
      genBtn.disabled = true;
      out.textContent = '';
      const runCtrl = window.LlmPageKit.createRun({ etaSeconds: 150, onBegin: () => page.show('result') }).mount(runHost);
      try {
        const res = await window.LlmPageKit.run({
          run: runCtrl,
          // CAR-119 review #4 — the report region paints the failure (its own
          // surface, with the export context); the kit stays silent.
          failPaint: false,
          intro: t('stats.marketRunning', 'Generating market report…'),
          request: (signal) => window.LlmPageKit.postJSON('/api/stats/market',
            { run: true, region: region.value, currency: curSel.value }, signal),
        });
        if (runCtrl.cancelled || runCtrl.signal.aborted) return; // a cancelled run paints nothing more
        if (res && res.markdown) {
          currentMd = res.markdown;
          const title = () => `${t('stats.marketTitle', 'AI market report')}${region.value ? ' — ' + region.value : ''}`;
          out.appendChild(c('div', { className: 'card md', html: UI.md(res.markdown), style: { padding: '16px' } }));
          out.appendChild(ReportExport.actionsBar(() => currentMd, title, t));
        } else if (res && res.prompt) {
          out.appendChild(c('p', { style: { color: 'var(--foggy)', margin: '0 0 8px' } },
            (res.message) || t('export.manual', 'No API key set — copy this prompt into any LLM, then paste the result back.')));
          out.appendChild(c('textarea', { className: 'input', rows: '18', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, res.prompt));
        }
      } catch (err) {
        out.textContent = '';
        out.appendChild(c('p', { style: { color: 'var(--danger, #d9534f)' } }, (err && err.message) || t('stats.marketFailed', 'Could not generate the market report')));
      } finally { genBtn.disabled = false; }
    });
    return wrap;
  }

  // ── tab 2: my pipeline analytics ───────────────────────────────────────────
  async function renderPipeline() {
    // v1.243.0 (views-3) — the funnel + conversion blocks compare CANONICAL
    // stages, so fetch the server's alias map alongside the rows and fold
    // every raw status through TrackerStages.foldStatus first (the same
    // helper the #/tracker board uses): '**Applied**' and 'aplicado' now
    // land in 'Applied' instead of splitting off into dead buckets.
    const [trackerRes, stagesRes] = await Promise.all([
      API.get('/api/tracker').catch(() => ({})),
      API.get('/api/tracker/stages').catch(() => ({})),
    ]);
    let rows = Array.isArray(trackerRes && trackerRes.rows) ? trackerRes.rows : [];
    const aliases = (stagesRes && stagesRes.aliases) || {};
    const TS = window.TrackerStages;
    const fold = (s) => (TS ? TS.foldStatus(s, aliases) : (s || ''));
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) {
      return emptyState(t('stats.pipeEmpty', 'No applications yet — evaluate a few roles and save them to your tracker.'),
        t('stats.goEvaluate', 'Open Evaluate'), '#/evaluate');
    }
    const wrap = c('div');
    // Opus r2 (finding 9) — the Companies KPI uses the SAME shared fold as
    // the Overview (distinctCompanies: trim + case-fold), so the two tabs
    // can never show different numbers for the same label.
    wrap.appendChild(c('div', { className: 'stat-cards', style: { display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '0 0 16px' } }, [
      statCard(rows.length, t('stats.pipeTotal', 'Total tracked')),
      statCard(rows.filter((r) => scoreVal(r.score) != null).length, t('stats.pipeScored', 'With a score')),
      statCard(distinctCompanies(rows), t('stats.pipeCompaniesN', 'Companies')),
    ]));

    // Score distribution (buckets 0–1 … 4–5). CAR-120 — the bucketing moved
    // to a top-level helper shared with the Overview tab.
    wrap.appendChild(section(t('stats.pipeScores', 'Score distribution'), barChart(scoreBuckets(rows))));

    // Status funnel (canonical order). v1.243.0 (views-3) — statuses are
    // FOLDED through the server alias map before counting (stageCountsFolded).
    const order = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Hired', 'Rejected', 'Discarded', 'SKIP'];
    const counts = stageCountsFolded(rows, fold);
    const funnel = order.filter((s) => counts[s]).map((s) => ({ label: s, value: counts[s] }));
    Object.keys(counts).filter((s) => !order.includes(s)).forEach((s) => funnel.push({ label: s, value: counts[s] }));
    wrap.appendChild(section(t('stats.pipeStatus', 'Status funnel'), barChart(funnel)));

    // Top companies (CAR-120 — shared helper).
    wrap.appendChild(section(t('stats.pipeCompanies', 'Top companies'), barChart(topCountItems(rows, 'company', 12))));

    // Top roles.
    wrap.appendChild(section(t('stats.pipeRoles', 'Top roles'), barChart(topCountItems(rows, 'role', 12))));

    // Applications over time (by YYYY-MM).
    const months = monthItems(rows);
    if (months.length) wrap.appendChild(section(t('stats.pipeTimeline', 'Applications over time'), barChart(months)));

    // Conversion rates — how far applications progress down the funnel.
    // v1.118.0 — 'Hired' (offer accepted) counts as having advanced through
    // every earlier funnel stage, mirroring the canonical funnel order.
    // v1.243.0 (views-3) — the comparisons run on FOLDED statuses
    // (rowsReachedStage), so aliased rows no longer shrink the denominators.
    const advanced = (...statuses) => rowsReachedStage(rows, fold, statuses);
    const applied = advanced('Applied', 'Responded', 'Interview', 'Offer', 'Hired');
    const responded = advanced('Responded', 'Interview', 'Offer', 'Hired');
    const interviewed = advanced('Interview', 'Offer', 'Hired');
    const offered = advanced('Offer', 'Hired');
    const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
    const convRows = [
      { label: t('stats.convApplied', 'Applied'), value: pct(applied, rows.length) },
      { label: t('stats.convResponded', 'Responded'), value: pct(responded, applied) },
      { label: t('stats.convInterview', 'Interview'), value: pct(interviewed, applied) },
      { label: t('stats.convOffer', 'Offer'), value: pct(offered, applied) },
    ];
    wrap.appendChild(section(t('stats.pipeConversion', 'Conversion rates'),
      c('div', null, [
        barChart(convRows, (v) => `${v}%`),
        c('p', { style: { color: 'var(--foggy)', fontSize: '12px', marginTop: '10px' } },
          t('stats.convCaveat', 'Applied = share of all tracked; Responded / Interview / Offer = share of applied that reached each stage.')),
      ])));

    return wrap;
  }

  // ── tab 3: target-role trend (original v1.86.0 view) ───────────────────────
  async function renderTrend() {
    const wrap = c('div');
    const [profileRes, scanRes] = await Promise.all([
      API.get('/api/profile').catch(() => ({})),
      API.get('/api/scan-results').catch(() => ({})),
    ]);
    const roles = (profileRes && profileRes.summary && Array.isArray(profileRes.summary.target_roles))
      ? profileRes.summary.target_roles.filter((r) => r && r.trim()) : [];
    const jobs = [
      ...((scanRes && scanRes.en && Array.isArray(scanRes.en.filtered)) ? scanRes.en.filtered : []),
      ...((scanRes && scanRes.ru && Array.isArray(scanRes.ru.filtered)) ? scanRes.ru.filtered : []),
    ];
    if (!roles.length) {
      wrap.appendChild(emptyState(t('stats.noProfile', 'No target roles set yet. Add them in your Profile so the stats know what to track.'),
        t('stats.goProfile', 'Open Profile'), '#/profile'));
      return wrap;
    }
    if (!jobs.length) {
      wrap.appendChild(emptyState(t('stats.noScan', 'No scan data yet. Run a scan first, then come back for the stats.'),
        t('stats.goScan', 'Run a scan'), '#/scan'));
      return wrap;
    }

    const agg = (window.RoleStats && RoleStats.aggregate) ? RoleStats.aggregate(jobs, roles) : { totalJobs: 0, matchedJobs: 0, perRole: [], byCountry: [], salaryByCountry: [] };

    wrap.appendChild(c('div', { className: 'stat-cards', style: { display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '0 0 16px' } }, [
      trendCard(agg.totalJobs, t('stats.totalJobs', 'Total postings')),
      trendCard(agg.matchedJobs, t('stats.matched', 'Matched to your roles')),
      trendCard(agg.salaryByCountry.reduce((n, x) => n + x.salary.count, 0), t('stats.withSalary', 'With a parseable salary')),
    ]));
    function trendCard(value, label) {
      return c('div', { className: 'card', style: { flex: '1 1 140px', padding: '14px', textAlign: 'center' } }, [
        c('div', { style: { fontSize: '28px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' } }, String(value)),
        c('div', { style: { color: 'var(--foggy)', fontSize: '13px' } }, label),
      ]);
    }

    const roleSel = c('select', { className: 'lang-select', 'aria-label': t('stats.roleFilter', 'Role') }, [
      c('option', { value: '' }, t('stats.allRoles', 'All roles')),
      ...roles.map((r) => c('option', { value: r }, r)),
    ]);
    const countrySel = c('select', { className: 'lang-select', 'aria-label': t('stats.countryFilter', 'Country') }, [
      c('option', { value: '' }, t('stats.allCountries', 'All countries')),
      ...agg.byCountry.map((cc) => c('option', { value: cc.code }, `${cc.flag || ''} ${cc.name}`.trim())),
    ]);
    function labeled(label, el) {
      return c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)' } }, [label, el]);
    }
    let curState = 'USD';
    const curSel = currencySelect((v) => { curState = v; draw(); });
    // v1.140.0 — annual ⇄ monthly toggle (÷12) for the salary figures.
    let perState = 'year';
    const perSel = c('select', { className: 'lang-select', 'aria-label': t('stats.period', 'Period') }, [
      c('option', { value: 'year' }, t('stats.perYear', 'Per year')),
      c('option', { value: 'month' }, t('stats.perMonth', 'Per month')),
    ]);
    perSel.addEventListener('change', () => { perState = perSel.value; draw(); });
    // v1.145.0 — rebuildable chart: pick a metric × dimension and re-render.
    let metricState = 'vacancies'; // vacancies | median | avg
    let dimState = 'country';      // country | role
    const metricSel = c('select', { className: 'lang-select', 'aria-label': t('stats.metric', 'Metric') }, [
      c('option', { value: 'vacancies' }, t('stats.metricVacancies', 'Vacancies')),
      c('option', { value: 'median' }, t('stats.metricMedian', 'Median salary')),
      c('option', { value: 'avg' }, t('stats.metricAvg', 'Average salary')),
    ]);
    metricSel.value = metricState;
    metricSel.addEventListener('change', () => { metricState = metricSel.value; draw(); });
    const dimSel = c('select', { className: 'lang-select', 'aria-label': t('stats.dimension', 'Dimension') }, [
      c('option', { value: 'country' }, t('stats.dimCountry', 'By country')),
      c('option', { value: 'role' }, t('stats.dimRole', 'By role')),
    ]);
    dimSel.value = dimState;
    dimSel.addEventListener('change', () => { dimState = dimSel.value; draw(); });
    wrap.appendChild(c('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', margin: '8px 0 20px' } }, [
      labeled(t('stats.roleFilter', 'Role'), roleSel),
      labeled(t('stats.countryFilter', 'Country'), countrySel),
      labeled(t('stats.currency', 'Currency'), curSel),
      labeled(t('stats.period', 'Period'), perSel),
    ]));

    const charts = c('div');
    wrap.appendChild(charts);

    // The rebuildable chart, driven by metricSel/dimSel + the currency/period.
    function customChart() {
      const money = moneyFmt(curState);
      const per = (n) => (n == null ? null : (perState === 'month' ? n / 12 : n));
      const isSalary = metricState !== 'vacancies';
      const val = (o) => {
        if (metricState === 'vacancies') return (dimState === 'role' ? (o.total || 0) : (o.count || 0));
        const s = o.salary || {};
        return per(metricState === 'median' ? s.medianUsd : s.avgUsd) || 0;
      };
      const src = dimState === 'role'
        ? (agg.perRole || [])
        : (isSalary ? agg.salaryByCountry : agg.byCountry);
      const items = src.map((o) => ({
        label: dimState === 'role' ? o.role : `${o.flag || ''} ${o.name}`.trim(),
        value: val(o),
      })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
      const body = items.length
        ? barChart(items, isSalary ? money : undefined)
        : c('p', { style: { color: 'var(--foggy)' } }, t('stats.noData', 'No data for this combination yet.'));
      return c('div', { className: 'card', style: { padding: '16px', margin: '0 0 20px' } }, [
        c('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', margin: '0 0 12px' } }, [
          c('h2', { style: { fontSize: '15px', margin: '0', flex: '1 1 auto' } }, t('stats.customChart', 'Build a chart')),
          metricSel, dimSel,
        ]),
        body,
      ]);
    }

    function draw() {
      // L-FOCUS (v1.243.0) — draw() re-attaches the metric/dimension <select>s
      // (clearing `charts` detaches them, which drops focus to <body>);
      // restore it once the same nodes are back in the tree.
      FocusPreserved.withFocusPreserved(charts, () => {
        charts.textContent = '';
        charts.appendChild(customChart());
      });
      const role = roleSel.value; const country = countrySel.value;
      const money = moneyFmt(curState);

      // Postings per target role (across all countries) — new overview chart.
      if (!role) {
        const perRole = (agg.perRole || []).map((r) => ({ label: r.role, value: r.total || 0 }));
        if (perRole.some((r) => r.value > 0)) charts.appendChild(section(t('stats.postingsByRole', 'Postings by target role'), barChart(perRole)));
      }

      let vac;
      if (role) {
        const pr = agg.perRole.find((r) => r.role === role);
        const map = pr ? pr.byCountry : {};
        vac = agg.byCountry.map((cc) => ({ label: `${cc.flag || ''} ${cc.name}`.trim(), value: map[cc.code] || 0, code: cc.code }));
      } else {
        vac = agg.byCountry.map((cc) => ({ label: `${cc.flag || ''} ${cc.name}`.trim(), value: cc.count, code: cc.code }));
      }
      if (country) vac = vac.filter((v) => v.code === country);
      charts.appendChild(section(t('stats.vacanciesByCountry', 'Vacancies by country'), barChart(vac)));

      // period divisor: annual figures ÷12 when "Per month" is selected.
      const per = (n) => (n == null ? null : (perState === 'month' ? n / 12 : n));
      let rows = agg.salaryByCountry.slice();
      if (country) rows = rows.filter((cc) => cc.code === country);
      rows = rows.filter((cc) => cc.salary && cc.salary.count > 0);
      let sal = rows.map((cc) => ({ label: `${cc.flag || ''} ${cc.name}`.trim(), value: per(cc.salary.medianUsd) || 0, code: cc.code, n: cc.salary.count }));
      const salNode = sal.some((s) => s.value > 0)
        ? c('div', null, [
          barChart(sal, money),
          salaryTable(rows, money, per),
          c('p', { style: { color: 'var(--foggy)', fontSize: '12px', marginTop: '10px' } },
            t('stats.sampleCaveat', 'Based only on postings with a parseable salary — sparse data, treat as indicative. Amounts normalized to USD (approximate FX).')),
        ])
        : c('p', { style: { color: 'var(--foggy)' } }, t('stats.noSalary', 'No parseable salaries in the current scan yet.'));
      charts.appendChild(section(t('stats.salaryByCountry2', 'Median salary by country'), salNode));
    }
    roleSel.addEventListener('change', draw);
    countrySel.addEventListener('change', draw);
    draw();

    const trendWrap = c('div');
    wrap.appendChild(section(t('stats.trend', 'Vacancy trend (saved snapshots)'), trendWrap));
    const saveBtn = c('button', { className: 'btn btn-primary' }, t('stats.saveSnapshot', 'Save snapshot'));
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      try {
        await API.post('/api/stats/snapshot', {
          totalJobs: agg.totalJobs, matchedJobs: agg.matchedJobs,
          perRole: agg.perRole.map((r) => ({ role: r.role, total: r.total, medianUsd: r.salary.medianUsd })),
          byCountry: agg.byCountry.map((cc) => ({ code: cc.code, count: cc.count })),
        });
        UI.toast(t('stats.snapshotSaved', 'Snapshot saved'), 'success');
        await loadTrend();
      } catch (err) {
        UI.toast((err && err.message) || t('stats.snapshotFailed', 'Could not save snapshot'), 'error');
      } finally { saveBtn.disabled = false; }
    });
    wrap.appendChild(c('div', { style: { margin: '4px 0 32px' } }, saveBtn));

    async function loadTrend() {
      trendWrap.textContent = '';
      let snapshots = [];
      try { ({ snapshots } = await API.get('/api/stats/trend')); } catch { snapshots = []; }
      if (!snapshots || !snapshots.length) {
        trendWrap.appendChild(c('p', { style: { color: 'var(--foggy)' } },
          t('stats.snapshotsEmpty', 'No snapshots yet — save one to start tracking how vacancy counts change over time.')));
        return;
      }
      const pts = snapshots.map((s) => ({ ts: s.ts, v: Number(s.totalJobs) || 0 }));
      const max = Math.max(1, ...pts.map((p) => p.v));
      const W = 520; const H = 120; const pad = 8;
      const svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('width', '100%'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('role', 'img');
      const stepX = pts.length > 1 ? (W - pad * 2) / (pts.length - 1) : 0;
      const coords = pts.map((p, i) => [pad + i * stepX, H - pad - (p.v / max) * (H - pad * 2)]);
      const poly = document.createElementNS(SVGNS, 'polyline');
      poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', 'var(--accent, #4c8bf5)'); poly.setAttribute('stroke-width', '2');
      poly.setAttribute('points', coords.map((xy) => xy.join(',')).join(' '));
      svg.appendChild(poly);
      coords.forEach((xy, i) => {
        const dot = document.createElementNS(SVGNS, 'circle');
        dot.setAttribute('cx', String(xy[0])); dot.setAttribute('cy', String(xy[1])); dot.setAttribute('r', '3');
        dot.setAttribute('fill', 'var(--accent, #4c8bf5)');
        const ttl = document.createElementNS(SVGNS, 'title');
        ttl.textContent = `${new Date(pts[i].ts).toLocaleString()}: ${pts[i].v}`;
        dot.appendChild(ttl); svg.appendChild(dot);
      });
      trendWrap.appendChild(svg);
      trendWrap.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', marginTop: '6px' } },
        `${pts.length} ${t('stats.snapshotsCount', 'snapshots')} · ${t('stats.trendMetric', 'total postings over time')}`));
    }
    await loadTrend();
    return wrap;
  }

  // ── tab 4: rejection patterns / ATS channels (v1.117.0) ─────
  // GET /api/stats/patterns shells out to the parent's analyze-patterns.mjs
  // (read-only). Renders outcome mix, actionable recommendations, and the
  // per-ATS-vendor advance rate; honest empty state when the script is absent.
  async function renderPatterns() {
    const wrap = c('div');
    let d = null;
    try { d = await API.get('/api/stats/patterns'); } catch { d = null; }
    if (!d || d.available !== true) {
      wrap.appendChild(emptyState(t('stats.patUnavailable',
        'Pattern analytics needs the parent career-ops project (analyze-patterns.mjs) next to this app.'), null, ''));
      return wrap;
    }
    const m = d.metadata || {};
    const oc = m.byOutcome || {};
    wrap.appendChild(c('div', { className: 'stat-cards', style: { display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '0 0 16px' } }, [
      c('span', { className: 'chip' }, `${t('stats.patTotal', 'Analyzed')}: ${m.total || 0}`),
      c('span', { className: 'chip' }, `✅ ${t('stats.patPositive', 'positive')}: ${oc.positive || 0}`),
      c('span', { className: 'chip' }, `❌ ${t('stats.patNegative', 'negative')}: ${oc.negative || 0}`),
      c('span', { className: 'chip' }, `⏳ ${t('stats.patPending', 'pending')}: ${oc.pending || 0}`),
    ]));
    const recs = Array.isArray(d.recommendations) ? d.recommendations.slice(0, 10) : [];
    if (recs.length) {
      wrap.appendChild(section(t('stats.patRecs', 'Recommendations'), c('ul', { style: { margin: '0', paddingLeft: '20px' } },
        recs.map((r) => c('li', { style: { margin: '0 0 8px' } }, [
          c('strong', null, String(r.action || '')),
          c('div', { style: { color: 'var(--foggy)', fontSize: '13px' } }, String(r.reasoning || '')),
        ])))));
    }
    const va = d.vendorAnalysis || {};
    const vendors = Array.isArray(va.breakdown) ? va.breakdown : [];
    if (vendors.length) {
      const head = c('tr', null, [t('stats.patVendor', 'ATS vendor'), t('stats.patApps', 'Applications'), t('stats.patAdvanced', 'Advanced'), t('stats.patRate', 'Advance rate')]
        .map((h) => c('th', { style: { textAlign: 'left' } }, h)));
      const rows = vendors.map((v) => c('tr', null, [
        c('td', null, String(v.vendor || '')),
        c('td', { style: { fontVariantNumeric: 'tabular-nums' } }, String(v.total ?? 0)),
        c('td', { style: { fontVariantNumeric: 'tabular-nums' } }, String(v.advanced ?? 0)),
        c('td', { style: { fontVariantNumeric: 'tabular-nums' } }, `${v.advanceRate ?? 0}%${v.sufficientSample === false ? ' *' : ''}`),
      ]));
      const tblNode = c('div', null, [
        c('div', { className: 'table-wrap' }, c('table', { className: 'tbl' }, [c('thead', null, head), c('tbody', null, rows)])),
        c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '8px 0 0' } },
          `* ${t('stats.patSmallN', 'below the minimum sample for a claim')} (n<${va.minSampleForClaim || 8}) · ${String(va.citation || '')}`),
      ]);
      wrap.appendChild(section(t('stats.patChannels', 'ATS channel advance rate'), tblNode));
    }
    const archetypes = Array.isArray(d.archetypeBreakdown) ? d.archetypeBreakdown.slice(0, 15) : [];
    if (archetypes.length) {
      const items = archetypes.map((a) => ({ label: String(a.archetype || ''), value: a.total || 0 }));
      wrap.appendChild(section(t('stats.patArchetypes', 'Applications per archetype'), barChart(items)));
    }
    if (!recs.length && !vendors.length && !archetypes.length) {
      wrap.appendChild(emptyState(t('stats.patEmpty', 'Not enough tracked applications yet for pattern analysis.'), null, ''));
    }
    return wrap;
  }

  // ── tab 5: lifetime pipeline stats + salary gap (v1.118.0) ──
  // GET /api/stats/lifetime relays the parent's stats.mjs (tracker roll-up,
  // cumulative funnel, lifetime scanner totals, portal coverage); GET
  // /api/stats/salary-gap relays salary-gap.mjs (desired vs advertised vs
  // actual comp). Both zero-token and read-only; honest empty states when the
  // parent scripts are absent or the sections are null (fresh install).
  async function renderLifetime() {
    const wrap = c('div');
    let d = null;
    try { d = await API.get('/api/stats/lifetime'); } catch { d = null; }
    if (!d || d.available !== true) {
      wrap.appendChild(emptyState(t('stats.lifeUnavailable',
        'Lifetime stats need the parent career-ops project (stats.mjs) next to this app.'), null, ''));
      return wrap;
    }
    const chip = (label, value) => c('span', { className: 'chip' }, `${label}: ${value}`);
    const pctStr = (v) => (v == null ? '—' : `${v}%`);
    const tr = d.tracker || null;
    if (tr) {
      wrap.appendChild(c('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '0 0 16px' } }, [
        chip(t('stats.lifeTracked', 'Tracked'), tr.total ?? 0),
        chip(t('stats.lifeActive', 'Active'), tr.activeApps ?? 0),
        chip(t('stats.lifeAvgScore', 'Avg score'), tr.avgScore == null ? '—' : tr.avgScore),
        chip(t('stats.lifeTopScore', 'Top score'), tr.topScore == null ? '—' : tr.topScore),
      ]));
      const byStatus = tr.byStatus || {};
      const items = Object.keys(byStatus).map((s) => ({ label: s, value: byStatus[s] || 0 }));
      wrap.appendChild(section(t('stats.lifeByStatus', 'Lifetime status roll-up'), barChart(items)));
    }
    const fu = d.funnel || null;
    if (fu) {
      const small = fu.smallSample
        ? c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '8px 0 0' } },
          t('stats.lifeSmallSample', 'Small sample — rates are indicative, not statistics.'))
        : null;
      wrap.appendChild(section(t('stats.lifeFunnel', 'Cumulative funnel'), c('div', null, [
        c('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } }, [
          chip(t('stats.lifeResponseRate', 'Response rate'), pctStr(fu.responseRate)),
          chip(t('stats.lifeInterviewRate', 'Interview rate'), pctStr(fu.interviewRate)),
          chip(t('stats.lifeOfferRate', 'Offer rate'), pctStr(fu.offerRate)),
        ]),
        small,
      ].filter(Boolean))));
    }
    const sc = d.scan || null;
    if (sc) {
      const byPortal = sc.byPortal || {};
      const top = Object.entries(byPortal).sort((a, b) => b[1] - a[1]).slice(0, 12)
        .map(([label, value]) => ({ label, value: Number(value) || 0 }));
      wrap.appendChild(section(t('stats.lifeScan', 'Lifetime scanner totals'), c('div', null, [
        c('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '0 0 12px' } }, [
          chip(t('stats.lifeScanSeen', 'Postings seen'), sc.totalRecorded ?? 0),
          chip(t('stats.lifeScanAdded', 'Added to pipeline'), sc.added ?? 0),
          chip(t('stats.lifeScanCompanies', 'Distinct companies'), sc.distinctCompanies ?? 0),
        ]),
        top.length ? barChart(top) : null,
      ].filter(Boolean))));
    }
    const po = d.portals || null;
    if (po) {
      wrap.appendChild(section(t('stats.lifePortals', 'Portal coverage'), c('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } }, [
        chip(t('stats.lifePortalsConfigured', 'Companies configured'), po.configuredCompanies ?? 0),
        chip(t('stats.lifePortalsProducing', 'Producing results'), `${po.producingCompanies ?? 0} (${pctStr(po.producingPct)})`),
      ])));
    }

    // Salary gap — separate relay; render whatever observations exist.
    let sg = null;
    try { sg = await API.get('/api/stats/salary-gap'); } catch { sg = null; }
    if (sg && sg.available === true) {
      // One row per folded application (salary-gap.mjs `applications[]`):
      // desired / advertised / actual are { value, currency } or absent.
      const apps = (Array.isArray(sg.applications) ? sg.applications : []).slice(0, 20);
      if (apps.length) {
        const obsFmt = (o) => (o && o.value != null
          ? `${usdFmt.format(Math.round(o.value))}${o.currency ? ' ' + o.currency : ''}`
          : '—');
        const head = c('tr', null, [
          t('stats.sgCompanyRole', 'Company · role'), t('stats.sgDesired', 'Desired'),
          t('stats.sgAdvertised', 'Advertised'), t('stats.sgActual', 'Actual'),
          t('stats.sgGap', 'Advertised → actual'),
        ].map((h) => c('th', { style: { textAlign: 'left' } }, h)));
        const cell = (v) => c('td', { style: { fontVariantNumeric: 'tabular-nums' } }, v);
        const rows = apps.map((a) => c('tr', null, [
          c('td', null, [a.company, a.role].filter(Boolean).join(' · ') || `#${a.num || ''}`),
          cell(obsFmt(a.desired)), cell(obsFmt(a.advertised)), cell(obsFmt(a.actual)),
          cell(a.advToActPct == null ? '—' : `${a.advToActPct > 0 ? '+' : ''}${Math.round(a.advToActPct)}%`),
        ]));
        wrap.appendChild(section(t('stats.sgTitle', 'Compensation observations'), c('div', { className: 'table-wrap' },
          c('table', { className: 'tbl' }, [c('thead', null, head), c('tbody', null, rows)]))));
      } else {
        wrap.appendChild(section(t('stats.sgTitle', 'Compensation observations'),
          c('p', { style: { color: 'var(--foggy)' } }, t('stats.sgEmpty',
            'No compensation observations yet — they accumulate from report Machine Summaries and data/salary-observations.tsv in the parent project.'))));
      }
    }
    return wrap;
  }

  // ── tab 6: funnel calibration + waiting + stage velocity ──────────────────
  // Zero-token read-only relay of /api/stats/funnel (funnel-velocity.mjs):
  // own funnel rates vs candidate-side market benchmarks, the in-flight
  // waiting list, and median/p75 days per stage hop — with the script's
  // statistical-honesty caveats passed through verbatim.
  async function renderFunnel() {
    const wrap = c('div');
    let d = null;
    try { d = await API.get('/api/stats/funnel'); } catch { d = null; }
    if (!d || d.available !== true) {
      wrap.appendChild(emptyState(t('stats.funnelUnavailable',
        'Funnel & velocity needs the parent career-ops project (funnel-velocity.mjs) next to this app.'), null, ''));
      return wrap;
    }
    const chip = (label, value) => c('span', { className: 'chip' }, `${label}: ${value}`);
    const pct = (v) => (v == null ? '—' : `${v}%`);
    const foot = (txt) => c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '8px 0 0' } }, txt);

    // Calibration — own response/interview rate vs the benchmark band.
    const cal = d.calibration || null;
    if (cal) {
      const bandLabel = (b) => ({
        'below-range': t('stats.funnelBelow', 'below range'),
        'in-range': t('stats.funnelInRange', 'in range'),
        'above-range': t('stats.funnelAbove', 'above range'),
      })[b] || b || '';
      const rateBlock = (label, r) => {
        if (!r) return null;
        const range = Array.isArray(r.rangePct) ? `${r.rangePct[0]}–${r.rangePct[1]}%` : '—';
        return c('div', { style: { margin: '0 0 12px' } }, [
          c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } }, [
            c('strong', null, label),
            chip(t('stats.funnelYours', 'yours'), pct(r.ownPct)),
            chip(t('stats.funnelTypical', 'typical'), `${pct(r.typicalPct)} (${range})`),
            c('span', { className: 'chip' }, bandLabel(r.band)),
          ]),
          r.caveat ? foot(r.caveat) : null,
        ].filter(Boolean));
      };
      const body = c('div', null, [
        rateBlock(t('stats.lifeResponseRate', 'Response rate'), cal.responseRate),
        rateBlock(t('stats.lifeInterviewRate', 'Interview rate'), cal.interviewRate),
        cal.smallSample ? foot(t('stats.lifeSmallSample', 'Small sample — rates are indicative, not statistics.')) : null,
      ].filter(Boolean));
      wrap.appendChild(section(t('stats.funnelCalibration', 'Funnel calibration vs market'), body));
    }

    // Waiting — in-flight applications and how long they have been silent.
    const w = d.waiting || null;
    if (w) {
      const win = Array.isArray(w.windowDays) ? `${w.windowDays[0]}–${w.windowDays[1]}` : '—';
      const beyond = (Array.isArray(w.items) ? w.items : []).filter((it) => it.beyondTypicalWindow);
      const body = c('div', null, [
        c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } }, [
          chip(t('stats.funnelInFlight', 'In flight'), w.inFlight ?? 0),
          chip(t('stats.funnelWindow', 'Typical reply window (days)'), win),
          chip(t('stats.funnelBeyond', 'Beyond the window'), beyond.length),
        ]),
        beyond.length ? c('ul', { style: { margin: '10px 0 0', paddingLeft: '18px', fontSize: '13px' } },
          beyond.slice(0, 15).map((it) => c('li', null,
            `#${it.num} ${it.company || ''} — ${it.elapsedDays != null ? it.elapsedDays + 'd' : '—'}`))) : null,
      ].filter(Boolean));
      wrap.appendChild(section(t('stats.funnelWaiting', 'Waiting on a reply'), body));
    }

    // Velocity — median/p75 days per forward stage hop.
    const v = d.velocity || null;
    if (v) {
      const thL = { textAlign: 'left', padding: '5px 8px', color: 'var(--foggy)', fontWeight: '600', fontSize: '12px', borderBottom: '1px solid var(--line)' };
      const thR = { ...thL, textAlign: 'right' };
      const tdL = { padding: '5px 8px', fontSize: '13px', borderBottom: '1px solid var(--line)' };
      const tdR = { ...tdL, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
      const hops = ['appliedToResponded', 'respondedToInterview', 'interviewToOffer', 'appliedToRejected']
        .map((k) => v[k]).filter(Boolean);
      // UI.el does not coerce numbers → always hand it a string child.
      const rows = hops.map((h) => c('tr', null, [
        c('td', { style: tdL }, `${h.from} → ${h.to}`),
        c('td', { style: tdR }, h.median != null ? String(h.median) : '—'),
        c('td', { style: tdR }, h.p75 != null ? String(h.p75) : '—'),
        c('td', { style: tdR }, String(h.n ?? 0)),
        c('td', { style: tdR }, String(h.censored ?? 0)),
      ]));
      const table = c('div', { style: { overflowX: 'auto' } },
        c('table', { style: { borderCollapse: 'collapse', width: '100%' } }, [
          c('thead', null, c('tr', null, [
            c('th', { style: thL }, t('stats.funnelHop', 'Stage hop')),
            c('th', { style: thR }, t('stats.funnelMedian', 'Median days')),
            c('th', { style: thR }, 'p75'),
            c('th', { style: thR }, 'n'),
            c('th', { style: thR }, t('stats.funnelCensored', 'Still waiting')),
          ])),
          c('tbody', null, rows),
        ]));
      wrap.appendChild(section(t('stats.funnelVelocity', 'Stage velocity (days per hop)'), c('div', null, [
        table,
        foot(t('stats.funnelVelocityNote', '0-day same-day entries are excluded from the medians; "still waiting" rows are right-censored (not yet counted).')),
      ])));
    }
    return wrap;
  }

  // v1.191.0 — "What to learn next": tracker-wide skill-gap roll-up from
  // /api/stats/upskill (upskill.mjs JSON). Tiered by how often a missing skill
  // sank a low-fit report; carries an { error } field when there is too little data.
  async function renderUpskill() {
    const wrap = c('div');
    let d = null;
    try { d = await API.get('/api/stats/upskill'); } catch { d = null; }
    if (!d || d.available !== true) {
      wrap.appendChild(emptyState(t('stats.upskillUnavailable',
        'What to learn next needs the parent career-ops project (upskill.mjs) next to this app.'), null, ''));
      return wrap;
    }
    if (d.error) {
      wrap.appendChild(emptyState(String(d.error), null, ''));
      return wrap;
    }
    const chip = (label, value) => c('span', { className: 'chip' }, `${label}: ${String(value)}`);
    const m = d.metadata || {};
    wrap.appendChild(c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '0 0 14px' } }, [
      chip(t('stats.upReportsScored', 'Reports scored'), m.reportsScored ?? 0),
      chip(t('stats.upLowFit', 'Low-fit reports'), m.lowFitReports ?? 0),
      chip(t('stats.upKnownSkills', 'Skills already yours'), m.knownSkillCount ?? 0),
    ]));

    const gaps = Array.isArray(d.gaps) ? d.gaps : [];
    if (!gaps.length) {
      wrap.appendChild(emptyState(t('stats.upNoGaps',
        'No recurring skill gaps across your evaluated reports — nice.'), null, ''));
      return wrap;
    }
    const TIER = { Critical: 'badge badge-bad', High: 'badge badge-warn', Medium: 'badge badge-info', Low: 'badge' };
    const thL = { textAlign: 'left', padding: '5px 8px', color: 'var(--foggy)', fontWeight: '600', fontSize: '12px', borderBottom: '1px solid var(--line)' };
    const thR = { ...thL, textAlign: 'right' };
    const tdL = { padding: '5px 8px', fontSize: '13px', borderBottom: '1px solid var(--line)' };
    const tdR = { ...tdL, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
    const rows = gaps.map((g) => c('tr', null, [
      c('td', { style: tdL }, c('span', { className: TIER[g.tier] || 'badge' }, String(g.tier || '—'))),
      c('td', { style: tdL }, String(g.skill || '')),
      c('td', { style: tdR }, String(g.reports ?? 0)),
      c('td', { style: tdR }, String(g.lowFitReports ?? 0)),
      c('td', { style: tdR }, String(g.weightedScore ?? 0)),
    ]));
    const table = c('div', { style: { overflowX: 'auto' } },
      c('table', { style: { borderCollapse: 'collapse', width: '100%' } }, [
        c('thead', null, c('tr', null, [
          c('th', { style: thL }, t('stats.upTier', 'Tier')),
          c('th', { style: thL }, t('stats.upSkill', 'Skill')),
          c('th', { style: thR }, t('stats.upReports', 'Reports')),
          c('th', { style: thR }, t('stats.upLowFitCol', 'Low-fit')),
          c('th', { style: thR }, t('stats.upWeighted', 'Weighted')),
        ])),
        c('tbody', null, rows),
      ]));
    wrap.appendChild(section(t('stats.upTitle', 'What to learn next'), c('div', null, [
      table,
      c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '8px 0 0' } },
        t('stats.upNote', 'Weighted by 5−fit-score across every evaluated report; tiers reflect how often the gap sank a low-fit match. Suggestions only.')),
    ])));

    const excluded = Array.isArray(d.excludedAsKnown) ? d.excludedAsKnown : [];
    if (excluded.length) {
      wrap.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '10px 0 0' } },
        t('stats.upExcluded', 'Already in your CV/profile (excluded):') + ' ' + excluded.map((e) => String((e && e.skill) || e)).join(', ')));
    }
    return wrap;
  }

  // v1.193.0 — "Silent after interview": interviews that have gone quiet past a
  // courtesy window, from /api/stats/rejection-latency (rejection-latency.mjs).
  // A gentle nudge/closure list — suggestion-only, never a rejection claim.
  async function renderRejection() {
    const wrap = c('div');
    let d = null;
    try { d = await API.get('/api/stats/rejection-latency'); } catch { d = null; }
    if (!d || d.available !== true) {
      wrap.appendChild(emptyState(t('stats.rejUnavailable',
        'This needs the parent career-ops project (rejection-latency.mjs) next to this app.'), null, ''));
      return wrap;
    }
    const chip = (label, value) => c('span', { className: 'chip' }, `${label}: ${String(value)}`);
    const m = d.metadata || {};
    wrap.appendChild(c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '0 0 14px' } }, [
      chip(t('stats.rejWindow', 'Courtesy window (days)'), m.courtesyDays ?? 30),
      chip(t('stats.rejCompanies', 'Companies checked'), m.companiesChecked ?? 0),
      chip(t('stats.rejFlagged', 'Silent past the window'), m.flagged ?? 0),
    ]));

    const flags = Array.isArray(d.flags) ? d.flags : [];
    if (!flags.length) {
      wrap.appendChild(emptyState(t('stats.rejNone',
        'No interviews are silent past your courtesy window — nothing to chase.'), null, ''));
    } else {
      const list = c('div', { className: 'card', style: { padding: '12px' } });
      for (const f of flags) {
        if (!f) continue;
        const line = c('div', { style: { margin: '0 0 10px' } });
        line.appendChild(c('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, [
          c('strong', null, String(f.company || '—')),
          f.role ? c('span', { style: { color: 'var(--foggy)' } }, String(f.role)) : null,
          c('span', { className: 'badge badge-warn' },
            `${String(f.daysSinceLastInterview ?? 0)}${t('stats.rejDaysSuffix', 'd silent')}`),
        ].filter(Boolean)));
        line.appendChild(c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '4px 0 0' } },
          `${t('stats.rejLast', 'Last interview')}: ${String(f.lastInterviewDate || '—')}${f.reason ? ' · ' + String(f.reason) : ''}`));
        list.appendChild(line);
      }
      wrap.appendChild(section(t('stats.rejTitle', 'Interviews worth a nudge'), list));
    }

    if (m.disclaimer) {
      wrap.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '10px 0 0' } }, String(m.disclaimer)));
    }
    const warnings = Array.isArray(d.warnings) ? d.warnings : [];
    for (const w of warnings) {
      wrap.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '11px', margin: '4px 0 0' } }, String(w)));
    }
    return wrap;
  }

  await activate('overview'); // CAR-120 — the data Overview is the entry tab
  return root;
});

// v1.243.0 (views-3) — pure helpers for the "My pipeline" tab, kept top-level
// so the unit test can run them in isolation (the view itself mounts on
// Router.register at import). `fold` is injected so the tab passes its
// server-alias-aware folder and tests can pass an identity fold.

// CAR-120 — the Overview tab's aggregation helpers live here too, top-level,
// so tests slice and run them against real fixtures the same way.

// { <status>: n } counting every row under its FOLDED status. A row with no
// status counts as 'Evaluated' (the tab's pre-existing convention).
function stageCountsFolded(rows, fold) {
  const counts = {};
  for (const r of (Array.isArray(rows) ? rows : [])) {
    const s = fold(r && r.status) || 'Evaluated';
    counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
}

// How many rows currently sit at any of `stages` — the funnel denominators.
function rowsReachedStage(rows, fold, stages) {
  const set = new Set(Array.isArray(stages) ? stages : [stages]);
  return (Array.isArray(rows) ? rows : []).filter((r) => set.has(fold(r && r.status))).length;
}

// Parse "4.2/5", "4.2", 4.2 → number; else null. (Hoisted from renderPipeline
// in CAR-120 so scoreBuckets below can share it.)
function scoreVal(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const m = String(raw || '').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

// Opus r2 (finding 9) — ONE shared distinct-companies fold (trim + case-fold)
// for the Overview KPI and the Pipeline KPI, so the same label can never
// carry two different numbers. (The Pipeline tab previously folded case but
// not whitespace — this helper is now the single definition.)
function distinctCompanies(rows) {
  return new Set((Array.isArray(rows) ? rows : [])
    .map((r) => String((r && r.company) || '').trim().toLowerCase())
    .filter(Boolean)).size;
}

// Tracker scores → the five 0–1 … 4–5 buckets. Unparseable/absent scores
// drop out (never invented into a bucket).
function scoreBuckets(rows) {
  const buckets = ['0–1', '1–2', '2–3', '3–4', '4–5'].map((label) => ({ label, value: 0 }));
  for (const r of (Array.isArray(rows) ? rows : [])) {
    const s = scoreVal(r && r.score);
    if (s == null) continue;
    const idx = Math.min(4, Math.max(0, Math.floor(s)));
    buckets[idx].value += 1;
  }
  return buckets;
}

// Count rows by a field (case-insensitive fold so 'Acme'/'acme' merge),
// descending, capped at `n`, empty keys skipped. The first spelling wins as
// the display label.
function topCountItems(rows, key, n) {
  const counts = new Map();
  for (const r of (Array.isArray(rows) ? rows : [])) {
    const v = r && r[key];
    const k = String(v == null ? '' : v).trim();
    if (!k) continue;
    const lk = k.toLowerCase();
    const prev = counts.get(lk);
    counts.set(lk, { label: prev ? prev.label : k, value: (prev ? prev.value : 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.value - a.value).slice(0, n || 12);
}

// Tracker dates → [{label:'YYYY-MM', value}] ascending. Unparseable dates drop.
function monthItems(rows) {
  const byMonth = {};
  for (const r of (Array.isArray(rows) ? rows : [])) {
    const m = String((r && r.date) || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(m)) byMonth[m] = (byMonth[m] || 0) + 1;
  }
  return Object.keys(byMonth).sort().map((m) => ({ label: m, value: byMonth[m] }));
}

// Posting dates (full ISO timestamps or bare YYYY-MM-DD) → Monday-week
// buckets, kept to the LAST `weeks` weeks relative to `now`, ascending.
// Weeks with no postings are simply absent (never filled with zeros).
function weekItems(dates, opts) {
  const o = opts || {};
  const weeks = o.weeks || 12;
  const nowMs = o.now ? Date.parse(o.now) : Date.now();
  if (!Number.isFinite(nowMs)) return [];
  const DAY = 86400000;
  const mondayOf = (ms) => {
    const d = new Date(ms);
    const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
  };
  const thisWeek = mondayOf(nowMs);
  const oldest = thisWeek - (weeks - 1) * 7 * DAY;
  const counts = new Map();
  for (const raw of (Array.isArray(dates) ? dates : [])) {
    const m = String(raw || '').match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) continue;
    const ms = Date.parse(m[1] + 'T00:00:00Z');
    if (!Number.isFinite(ms)) continue;
    const wk = mondayOf(ms);
    if (wk < oldest || wk > thisWeek) continue;
    counts.set(wk, (counts.get(wk) || 0) + 1);
  }
  return [...counts.keys()].sort((a, b) => a - b).map((wk) => ({
    label: new Date(wk).toISOString().slice(0, 10),
    value: counts.get(wk),
  }));
}

// Scan jobs → postings per source. The row's own `source` slug (what every
// scanner stamps) wins; a URL-host fallback (`srcOf`, JobFacets.sourceFromUrl
// in the view) rescues strays; the rest land in 'other', kept LAST so an
// unclassified tail never reads as a top source.
function sourceItems(jobs, srcOf) {
  const counts = new Map();
  for (const j of (Array.isArray(jobs) ? jobs : [])) {
    let s = (j && j.source) || null;
    if (!s && typeof srcOf === 'function') s = srcOf(j && j.url) || null;
    if (!s) s = 'other';
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  const items = [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const otherIdx = items.findIndex((x) => x.label === 'other');
  if (otherIdx >= 0) items.push(items.splice(otherIdx, 1)[0]);
  return items;
}

// Scan jobs → median USD salary midpoint per seniority grade, in ladder
// order (lead, staff, senior, mid, junior, intern). Jobs without a grade or
// a parseable salary drop out — the medians never invent a grade or a number.
function gradeSalaryItems(jobs, deps) {
  const d = deps || {};
  const parse = d.parseSalaryUsd;
  const gradeOf = d.seniorityOf;
  const labelFor = d.labelFor || ((g) => g);
  const order = d.order || ['lead', 'staff', 'senior', 'mid', 'junior', 'intern'];
  if (typeof parse !== 'function' || typeof gradeOf !== 'function') return [];
  const byGrade = new Map();
  for (const j of (Array.isArray(jobs) ? jobs : [])) {
    const g = gradeOf(j && j.title);
    if (!g) continue;
    const sal = parse(j && j.salary);
    if (!sal) continue;
    // Opus r2 (finding 2) — a one-sided range («from $120k» → only minUsd)
    // must never become ((min + 0) / 2) = a fabricated half-median. Use the
    // midpoint only when BOTH ends exist; otherwise the one end we have.
    const lo = sal.minUsd;
    const hi = sal.maxUsd;
    const mid = (lo && hi) ? Math.round((lo + hi) / 2) : Math.round(lo || hi);
    if (!Number.isFinite(mid) || mid <= 0) continue;
    if (!byGrade.has(g)) byGrade.set(g, []);
    byGrade.get(g).push(mid);
  }
  return order
    .filter((g) => byGrade.has(g))
    .map((g) => {
      const arr = byGrade.get(g).slice().sort((a, b) => a - b);
      const n = arr.length;
      const med = n % 2 ? arr[(n - 1) / 2] : Math.round((arr[n / 2 - 1] + arr[n / 2]) / 2);
      return { label: labelFor(g), value: med, n };
    });
}

// The funnel relay's stage hops → {from, to, value} (median days). Labels
// are localized by the VIEW (track.status.* stage keys) — the helper never
// bakes in raw English. Hops without a median (nothing uncensored yet) drop.
function velocityItems(velocity) {
  const v = velocity || {};
  return [v.appliedToResponded, v.respondedToInterview, v.interviewToOffer, v.appliedToRejected]
    .filter((h) => h && h.median != null)
    .map((h) => ({ from: h.from, to: h.to, value: h.median }));
}

// L-FOCUS (v1.243.0) — a rebuild that replaces the node a keyboard user is
// on drops focus to <body>. FULL-M6 — the three byte-identical view copies
// (tracker/reports/stats) are consolidated into the shared
// lib/focus-preserve.js helper.
