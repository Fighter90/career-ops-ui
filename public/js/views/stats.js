/* global Router, API, UI, I18n, RoleStats, Countries */
/**
 * #/stats — Statistics by target roles (v1.86.0).
 *
 * Reads the user's TARGET ROLES from the profile (never hard-coded) and the
 * latest scan's job rows, then — client-side via window.RoleStats (reusing
 * window.Countries) — shows vacancy counts and salary levels by country for
 * each target role. "Save snapshot" persists the current aggregate so the
 * numbers can be tracked over time (POST /api/stats/snapshot); the trend
 * chart reads them back (GET /api/stats/trend). Sparse data is expected and
 * surfaced honestly (sample-size caveats), never fabricated.
 */
Router.register('stats', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const SVGNS = 'http://www.w3.org/2000/svg';

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('stats.title', 'Statistics by target roles')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('stats.subtitle', 'Vacancy and salary levels for your target roles, by country — aggregated from your latest scan.')));

  const emptyState = (msgKey, msgFallback, ctaKey, ctaFallback, href) => c('div',
    { className: 'empty', style: { padding: '40px', textAlign: 'center', color: 'var(--foggy)' } }, [
      c('p', null, t(msgKey, msgFallback)),
      c('a', { className: 'btn', href }, t(ctaKey, ctaFallback)),
    ]);

  // ── load target roles + latest scan jobs in parallel ──
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
    root.appendChild(emptyState('stats.noProfile', 'No target roles set yet. Add them in your Profile so the stats know what to track.',
      'stats.goProfile', 'Open Profile', '#/profile'));
    return root;
  }
  if (!jobs.length) {
    root.appendChild(emptyState('stats.noScan', 'No scan data yet. Run a scan first, then come back for the stats.',
      'stats.goScan', 'Run a scan', '#/scan'));
    return root;
  }

  const agg = (window.RoleStats && RoleStats.aggregate) ? RoleStats.aggregate(jobs, roles) : { totalJobs: 0, matchedJobs: 0, perRole: [], byCountry: [], salaryByCountry: [] };

  // ── summary cards ──
  const summary = c('div', { className: 'stat-cards', style: { display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '16px 0' } }, [
    statCard(agg.totalJobs, t('stats.totalJobs', 'Total postings')),
    statCard(agg.matchedJobs, t('stats.matched', 'Matched to your roles')),
    statCard(agg.salaryByCountry.reduce((n, x) => n + x.salary.count, 0), t('stats.withSalary', 'With a parseable salary')),
  ]);
  root.appendChild(summary);

  function statCard(value, label) {
    return c('div', { className: 'card', style: { flex: '1 1 140px', padding: '14px', textAlign: 'center' } }, [
      c('div', { style: { fontSize: '28px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' } }, String(value)),
      c('div', { style: { color: 'var(--foggy)', fontSize: '13px' } }, label),
    ]);
  }

  // ── filters ──
  const roleSel = c('select', { className: 'lang-select', 'aria-label': t('stats.roleFilter', 'Role') }, [
    c('option', { value: '' }, t('stats.allRoles', 'All roles')),
    ...roles.map((r) => c('option', { value: r }, r)),
  ]);
  const countrySel = c('select', { className: 'lang-select', 'aria-label': t('stats.countryFilter', 'Country') }, [
    c('option', { value: '' }, t('stats.allCountries', 'All countries')),
    ...agg.byCountry.map((cc) => c('option', { value: cc.code }, `${cc.flag || ''} ${cc.name}`.trim())),
  ]);
  const controls = c('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', margin: '8px 0 20px' } }, [
    labeled(t('stats.roleFilter', 'Role'), roleSel),
    labeled(t('stats.countryFilter', 'Country'), countrySel),
  ]);
  root.appendChild(controls);

  function labeled(label, el) {
    return c('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--foggy)' } }, [label, el]);
  }

  const charts = c('div');
  root.appendChild(charts);

  // ── SVG horizontal bar chart ──
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

  function section(titleText, node) {
    return c('div', { className: 'card', style: { padding: '16px', margin: '0 0 20px' } }, [
      c('h2', { style: { fontSize: '15px', margin: '0 0 12px' } }, titleText),
      node,
    ]);
  }

  const uiLocale = (I18n.getLang && I18n.getLang()) || 'en';
  const usd = (n) => (n == null ? '—' : '$' + Math.round(n).toLocaleString(uiLocale));

  function draw() {
    charts.textContent = '';
    const role = roleSel.value;
    const country = countrySel.value;

    // Vacancies by country (per selected role, else overall).
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

    // Median salary by country (USD).
    let sal = agg.salaryByCountry.map((cc) => ({ label: `${cc.flag || ''} ${cc.name}`.trim(), value: cc.salary.medianUsd || 0, code: cc.code, n: cc.salary.count }));
    if (country) sal = sal.filter((v) => v.code === country);
    const salNode = sal.some((s) => s.value > 0)
      ? c('div', null, [
        barChart(sal, usd),
        c('p', { style: { color: 'var(--foggy)', fontSize: '12px', marginTop: '10px' } },
          t('stats.sampleCaveat', 'Based only on postings with a parseable salary — sparse data, treat as indicative. Amounts normalized to USD (approximate FX).')),
      ])
      : c('p', { style: { color: 'var(--foggy)' } }, t('stats.noSalary', 'No parseable salaries in the current scan yet.'));
    charts.appendChild(section(t('stats.salaryByCountry', 'Median salary by country (USD)'), salNode));
  }

  roleSel.addEventListener('change', draw);
  countrySel.addEventListener('change', draw);
  draw();

  // ── snapshot + trend ──
  const trendWrap = c('div');
  root.appendChild(section(t('stats.trend', 'Vacancy trend (saved snapshots)'), trendWrap));

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
  root.appendChild(c('div', { style: { margin: '4px 0 32px' } }, saveBtn));

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

  return root;
});
