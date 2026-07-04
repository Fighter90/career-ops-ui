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

  function barChart(items, valueFmt) {
    const rows = items.filter((x) => x.value > 0);
    if (!rows.length) return c('p', { style: { color: 'var(--foggy)', padding: '8px 0' } }, t('stats.noData', 'No data for this selection.'));
    const max = Math.max(...rows.map((r) => r.value));
    const barW = 320; const rowH = 26; const labelW = 150;
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
      label.textContent = (r.label || '').slice(0, 22);
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
    { className: 'empty', style: { padding: '40px', textAlign: 'center', color: 'var(--foggy)' } }, [
      c('p', null, msg),
      href ? c('a', { className: 'btn', href }, ctaLabel) : null,
    ].filter(Boolean));

  // ── tab bar ───────────────────────────────────────────────────────────────
  const panel = c('div');
  const tabDefs = [
    { id: 'market', label: t('stats.tabMarket', 'Market report'), render: renderMarket },
    { id: 'pipeline', label: t('stats.tabPipeline', 'My pipeline'), render: renderPipeline },
    { id: 'trend', label: t('stats.tabTrend', 'Target-role trend'), render: renderTrend },
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
    panel.textContent = '';
    panel.appendChild(c('div', { className: 'loading' }, t('common.loading', 'Loading…')));
    const def = tabDefs.find((d) => d.id === id);
    try {
      const node = await def.render();
      panel.textContent = '';
      panel.appendChild(node);
    } catch (err) {
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
    const order = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP'];
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
    const advanced = (...statuses) => rows.filter((r) => statuses.includes((r.status || '').trim())).length;
    const applied = advanced('Applied', 'Responded', 'Interview', 'Offer');
    const responded = advanced('Responded', 'Interview', 'Offer');
    const interviewed = advanced('Interview', 'Offer');
    const offered = advanced('Offer');
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
    wrap.appendChild(c('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', margin: '8px 0 20px' } }, [
      labeled(t('stats.roleFilter', 'Role'), roleSel),
      labeled(t('stats.countryFilter', 'Country'), countrySel),
      labeled(t('stats.currency', 'Currency'), curSel),
    ]));

    const charts = c('div');
    wrap.appendChild(charts);
    function draw() {
      charts.textContent = '';
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

      let sal = agg.salaryByCountry.map((cc) => ({ label: `${cc.flag || ''} ${cc.name}`.trim(), value: cc.salary.medianUsd || 0, code: cc.code, n: cc.salary.count }));
      if (country) sal = sal.filter((v) => v.code === country);
      const salNode = sal.some((s) => s.value > 0)
        ? c('div', null, [
          barChart(sal, money),
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

  await activate('market');
  return root;
});
