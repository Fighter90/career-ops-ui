/* global Router, API, UI, I18n, RoleStats, ReportExport, window, document */
/**
 * #/stats — Statistics (v1.94.0 rework of the v1.86.0 target-role page).
 *
 * Three tabs:
 *   • Market report — an AI salary/market analysis for your target roles and a
 *     region (POST /api/stats/market), rendered as Markdown with Download .md /
 *     Save as PDF / Copy. Figures are directional model estimates (labelled).
 *   • My pipeline   — charts built CLIENT-side from your own tracker
 *     (GET /api/tracker): score distribution, status funnel, top companies,
 *     applications over time. No external/market data — honest about your data.
 *   • Target-role trend — the original v1.86.0 view: vacancy/salary by country
 *     from your latest scan, plus the save-snapshot trend line. Preserved verbatim.
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

  function barChart(items, valueFmt) {
    const rows = items.filter((x) => x.value > 0);
    if (!rows.length) return c('p', { style: { color: 'var(--foggy)', padding: '8px 0' } }, t('stats.noData', 'No data for this selection.'));
    const max = Math.max(...rows.map((r) => r.value));
    const barW = 320; const rowH = 26; const labelW = 200;
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('viewBox', `0 0 ${labelW + barW + 80} ${rows.length * rowH + 8}`);
    svg.setAttribute('role', 'img');
    rows.forEach((r, i) => {
      const y = i * rowH + 4;
      const w = Math.max(2, Math.round((r.value / max) * barW));
      const label = document.createElementNS(SVGNS, 'text');
      label.setAttribute('x', '0'); label.setAttribute('y', String(y + rowH / 2 + 4));
      label.setAttribute('font-size', '13'); label.setAttribute('fill', 'currentColor');
      // Ellipsize instead of hard-cutting the last letters ("…Engineer" was
      // clipped to "…Enginee"); keep the full text as an SVG <title> tooltip.
      const fullLabel = String(r.label || '');
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
      rect.setAttribute('rx', '3'); rect.setAttribute('fill', 'var(--accent, #4c8bf5)');
      const val = document.createElementNS(SVGNS, 'text');
      val.setAttribute('x', String(labelW + w + 6)); val.setAttribute('y', String(y + rowH / 2 + 4));
      val.setAttribute('font-size', '12'); val.setAttribute('fill', 'var(--foggy)');
      val.textContent = valueFmt ? valueFmt(r.value) : String(r.value);
      svg.appendChild(label); svg.appendChild(rect); svg.appendChild(val);
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

  // ── tab bar ───────────────────────────────────────────────────────────────
  const panel = c('div');
  const tabDefs = [
    { id: 'market', label: t('stats.tabMarket', 'Market report'), hint: 'stats.hint.market', render: renderMarket },
    { id: 'pipeline', label: t('stats.tabPipeline', 'My pipeline'), hint: 'stats.hint.pipeline', render: renderPipeline },
    { id: 'trend', label: t('stats.tabTrend', 'Target-role trend'), hint: 'stats.hint.trend', render: renderTrend },
    // v1.117.0 — rejection patterns + per-ATS-vendor advance
    // rate from the parent's analyze-patterns.mjs (read-only shell-out).
    { id: 'patterns', label: t('stats.tabPatterns', 'Rejection patterns'), hint: 'stats.hint.patterns', render: renderPatterns },
    // v1.118.0 (parent v1.18.0 parity) — lifetime pipeline stats (stats.mjs
    // #1605) + compensation observations (salary-gap.mjs), both read-only
    // shell-outs relayed by /api/stats/lifetime and /api/stats/salary-gap.
    { id: 'lifetime', label: t('stats.tabLifetime', 'Lifetime'), hint: 'stats.hint.lifetime', render: renderLifetime },
    // funnel calibration vs benchmarks + waiting list + stage velocity,
    // relayed read-only by /api/stats/funnel (funnel-velocity.mjs).
    { id: 'funnel', label: t('stats.tabFunnel', 'Funnel & velocity'), hint: 'stats.hint.funnel', render: renderFunnel },
    // v1.191.0 — tracker-wide skill-gap roll-up (weighted 5−score across all
    // evaluated reports, tiered) relayed read-only by /api/stats/upskill.
    { id: 'upskill', label: t('stats.tabUpskill', 'What to learn next'), hint: 'stats.hint.upskill', render: renderUpskill },
  ];
  const tabBar = c('div', { className: 'tabs', role: 'tablist',
    style: { display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: '1px solid var(--line, #e5e7eb)', margin: '4px 0 18px' } });
  const btns = {};
  tabDefs.forEach((def) => {
    const b = c('button', { className: 'tab-btn', type: 'button', role: 'tab',
      style: { border: 'none', background: 'none', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', color: 'var(--foggy)', borderBottom: '2px solid transparent' } }, def.label);
    b.addEventListener('click', () => activate(def.id));
    btns[def.id] = b;
    tabBar.appendChild(b);
  });
  root.appendChild(tabBar);
  // v1.139.0 — a caption for the active tab carrying a `?` help hint ("Rejection
  // patterns (?)"). Kept OUTSIDE the tablist so the tablist holds only tabs.
  const hintRow = c('div', { style: { display: 'flex', alignItems: 'center', gap: '2px', margin: '-8px 0 14px', minHeight: '20px', fontSize: '13px', fontWeight: '600', color: 'var(--ink, #111)' } });
  root.appendChild(hintRow);
  root.appendChild(panel);

  let active = null;
  async function activate(id) {
    if (active === id) return;
    active = id;
    Object.entries(btns).forEach(([k, b]) => {
      const on = k === id;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.style.color = on ? 'var(--fg, #111)' : 'var(--foggy)';
      b.style.borderBottomColor = on ? 'var(--accent, #4c8bf5)' : 'transparent';
    });
    // refresh the active-tab caption + its help hint
    const activeDef = tabDefs.find((d) => d.id === id);
    hintRow.textContent = '';
    if (activeDef) {
      hintRow.appendChild(c('span', null, activeDef.label));
      if (window.HelpHint && activeDef.hint) hintRow.appendChild(window.HelpHint.icon(activeDef.hint, { sectionLabel: activeDef.label }));
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

  // ── tab 1: AI market report ────────────────────────────────────────────────
  async function renderMarket() {
    const wrap = c('div');
    wrap.appendChild(c('p', { style: { color: 'var(--foggy)', margin: '0 0 12px' } },
      t('stats.marketIntro', 'A salary & market analysis for your target roles and region — grades, percentiles, top employers, in-demand skills, benefits. Figures are directional estimates from the model’s knowledge, not scraped data.')));

    const region = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'stats.marketRegionPh', style: { maxWidth: '340px' } });
    region.placeholder = t('stats.marketRegionPh', 'e.g. Russia · EU-remote · US · Germany…');
    const curSel = currencySelect();
    const genBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('stats.marketGenerate', 'Generate market report'));
    const controls = c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', margin: '0 0 16px' } }, [
      c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)' } }, [t('stats.marketRegion', 'Region / market'), region]),
      c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)' } }, [t('stats.currency', 'Currency'), curSel]),
      genBtn,
      // P4-ETA (v1.170.0) — honest duration hint for a long AI generation.
      c('span', { className: 'eta-hint', title: t('common.etaTitle', 'Typical generation time') },
        '⏱ ' + t('common.eta', '~{n}s').replace('{n}', '30')),
    ]);
    const out = c('div');
    wrap.appendChild(controls);
    wrap.appendChild(out);

    let currentMd = '';
    genBtn.addEventListener('click', async () => {
      genBtn.disabled = true;
      out.textContent = '';
      out.appendChild(c('div', { className: 'loading' }, t('stats.marketRunning', 'Generating market report…')));
      try {
        const res = await API.post('/api/stats/market', { run: true, region: region.value, currency: curSel.value, lang: (I18n.getLang && I18n.getLang()) || 'en' });
        out.textContent = '';
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
    let rows = [];
    try { ({ rows } = await API.get('/api/tracker')); } catch { rows = []; }
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) {
      return emptyState(t('stats.pipeEmpty', 'No applications yet — evaluate a few roles and save them to your tracker.'),
        t('stats.goEvaluate', 'Open Evaluate'), '#/evaluate');
    }
    const wrap = c('div');
    wrap.appendChild(c('div', { className: 'stat-cards', style: { display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '0 0 16px' } }, [
      statCard(rows.length, t('stats.pipeTotal', 'Total tracked')),
      statCard(rows.filter((r) => scoreVal(r.score) != null).length, t('stats.pipeScored', 'With a score')),
      statCard(new Set(rows.map((r) => (r.company || '').toLowerCase()).filter(Boolean)).size, t('stats.pipeCompaniesN', 'Companies')),
    ]));

    function statCard(value, label) {
      return c('div', { className: 'card', style: { flex: '1 1 140px', padding: '14px', textAlign: 'center' } }, [
        c('div', { style: { fontSize: '28px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' } }, String(value)),
        c('div', { style: { color: 'var(--foggy)', fontSize: '13px' } }, label),
      ]);
    }

    // Score distribution (buckets 0–1 … 4–5).
    const buckets = ['0–1', '1–2', '2–3', '3–4', '4–5'].map((lbl) => ({ label: lbl, value: 0 }));
    rows.forEach((r) => {
      const s = scoreVal(r.score);
      if (s == null) return;
      const idx = Math.min(4, Math.max(0, Math.floor(s)));
      buckets[idx].value += 1;
    });
    wrap.appendChild(section(t('stats.pipeScores', 'Score distribution'), barChart(buckets)));

    // Status funnel (canonical order).
    const order = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Hired', 'Rejected', 'Discarded', 'SKIP'];
    const counts = {};
    rows.forEach((r) => { const s = (r.status || 'Evaluated').trim(); counts[s] = (counts[s] || 0) + 1; });
    const funnel = order.filter((s) => counts[s]).map((s) => ({ label: s, value: counts[s] }));
    Object.keys(counts).filter((s) => !order.includes(s)).forEach((s) => funnel.push({ label: s, value: counts[s] }));
    wrap.appendChild(section(t('stats.pipeStatus', 'Status funnel'), barChart(funnel)));

    // Top companies.
    const byCo = {};
    rows.forEach((r) => { const co = (r.company || '').trim(); if (co) byCo[co] = (byCo[co] || 0) + 1; });
    const topCo = Object.entries(byCo).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, value]) => ({ label, value }));
    wrap.appendChild(section(t('stats.pipeCompanies', 'Top companies'), barChart(topCo)));

    // Top roles.
    const byRole = {};
    rows.forEach((r) => { const ro = (r.role || '').trim(); if (ro) byRole[ro] = (byRole[ro] || 0) + 1; });
    const topRole = Object.entries(byRole).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, value]) => ({ label, value }));
    wrap.appendChild(section(t('stats.pipeRoles', 'Top roles'), barChart(topRole)));

    // Applications over time (by YYYY-MM).
    const byMonth = {};
    rows.forEach((r) => { const m = String(r.date || '').slice(0, 7); if (/^\d{4}-\d{2}$/.test(m)) byMonth[m] = (byMonth[m] || 0) + 1; });
    const months = Object.keys(byMonth).sort().map((m) => ({ label: m, value: byMonth[m] }));
    if (months.length) wrap.appendChild(section(t('stats.pipeTimeline', 'Applications over time'), barChart(months)));

    // Conversion rates — how far applications progress down the funnel.
    // v1.118.0 — 'Hired' (offer accepted) counts as having advanced through
    // every earlier funnel stage, mirroring the canonical funnel order.
    const advanced = (...statuses) => rows.filter((r) => statuses.includes((r.status || '').trim())).length;
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

  // Parse "4.2/5", "4.2", 4.2 → number; else null.
  function scoreVal(raw) {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const m = String(raw || '').match(/(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? n : null;
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
      charts.textContent = '';
      charts.appendChild(customChart());
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

  await activate('market');
  return root;
});
