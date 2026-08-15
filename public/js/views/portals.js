/* global Router, API, UI, I18n */
/**
 * #/portals — the companies the scanner watches (parent `portals.yml`
 * `tracked_companies:`) + an on-demand liveness check + "Discover ATS board".
 *
 * An ATS slug can quietly break (a company renames its board or moves off
 * Greenhouse) and then that employer silently disappears from every future scan
 * — the health check surfaces the dead ones. "Discover ATS board" is the other
 * direction: type a company name, probe Greenhouse/Ashby/Lever for a live board,
 * and add the one you want to the watched list. Read-only until you click "Add".
 * (v1.99.0 · discover added later)
 */
Router.register('portals', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('portals.title', 'Portals')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('portals.subtitle', 'The companies the scanner watches for new roles (portals.yml). Run a health check to catch ATS slugs that have quietly broken — a 404 means that company silently disappears from every future scan.')));

  let companies = [];

  // ── Discover ATS board ──────────────────────────────────────────────
  const discInput = c('input', {
    type: 'text',
    className: 'input',
    placeholder: t('portals.discoverPlaceholder', 'Company name (e.g. Stripe)'),
    'aria-label': t('portals.discoverTitle', 'Discover ATS board'),
    style: { flex: '1 1 240px', minWidth: '180px' },
  });
  const discBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('portals.discoverBtn', 'Discover'));
  const discResults = c('div', { style: { marginTop: '10px' } });
  const discCard = c('div', {
    className: 'card',
    style: { padding: '14px 16px', margin: '16px 0' },
  }, [
    c('h2', { className: 'card-title', style: { margin: '0 0 4px', fontSize: '16px' } }, t('portals.discoverTitle', 'Discover ATS board')),
    c('p', { style: { color: 'var(--foggy)', fontSize: '13px', margin: '0 0 10px' } },
      t('portals.discoverHint', 'Type a company name to find its job board on Greenhouse, Ashby, or Lever — then add it to the companies the scanner watches.')),
    c('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, [discInput, discBtn]),
    discResults,
  ]);
  root.appendChild(discCard);

  // ── Health check + tracked list ─────────────────────────────────────
  const checkBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('portals.check', 'Check portal health'));
  const summary = c('span', { style: { marginLeft: '12px', color: 'var(--foggy)', fontSize: '13px' } });
  root.appendChild(c('div', { style: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', margin: '16px 0' } }, [checkBtn, summary]));

  const listWrap = c('div');
  root.appendChild(listWrap);

  // health results keyed by careers_url (filled by the check)
  let health = {};

  function row(company) {
    const h = health[company.careers_url];
    let badge;
    if (!company.enabled) {
      badge = c('span', { className: 'badge', style: { color: 'var(--foggy)' } }, t('portals.disabled', 'disabled'));
    } else if (h) {
      const ok = h.ok;
      badge = c('span', {
        className: 'badge',
        style: { color: ok ? 'var(--go, #2e7d32)' : 'var(--danger, #d9534f)', fontWeight: '600' },
        title: h.error || ('HTTP ' + h.status),
      }, ok ? ('✓ ' + h.status) : (h.status ? ('✗ ' + h.status) : '✗ ' + t('portals.dead', 'dead')));
    } else {
      badge = c('span', { className: 'badge', style: { color: 'var(--foggy)' } }, t('portals.enabled', 'watched'));
    }
    const meta = [company.provider ? c('span', { style: { color: 'var(--foggy)', fontSize: '12px' } }, company.provider) : null];
    const link = company.careers_url
      ? c('a', { href: company.careers_url, target: '_blank', rel: 'noopener noreferrer', style: { fontSize: '12px', color: 'var(--foggy)' } }, company.careers_url.replace(/^https?:\/\//, '').slice(0, 60))
      : null;
    // v1.144.0 — enable/disable toggle (writes portals.yml; the scanner skips
    // disabled companies via `c.enabled !== false`). Keyed by careers_url, so a
    // company without one can't be toggled from here.
    const canToggle = !!company.careers_url;
    // `enabled` may be an un-normalized field (undefined = watched, like the
    // scanner's `!== false`), so treat anything but an explicit false as ON.
    const isOn = company.enabled !== false;
    const toggleBtn = c('button', {
      className: 'btn btn-ghost btn-sm', type: 'button',
      'aria-label': isOn ? t('portals.disable', 'Disable') : t('portals.enable', 'Enable'),
    }, isOn ? t('portals.disable', 'Disable') : t('portals.enable', 'Enable'));
    if (!canToggle) toggleBtn.disabled = true;
    else toggleBtn.addEventListener('click', async () => {
      const next = !isOn;
      toggleBtn.disabled = true;
      try {
        await API.post('/api/portals/toggle', { careers_url: company.careers_url, enabled: next });
        company.enabled = next;
        UI.toast(next
          ? t('portals.enabledToast', 'Portal enabled — the scanner will watch it')
          : t('portals.disabledToast', 'Portal disabled — the scanner will skip it'), 'success');
        renderList(companies);
      } catch (err) {
        UI.toast((err && err.message) || t('portals.toggleFailed', 'Could not update the portal'), 'error');
        toggleBtn.disabled = false;
      }
    });
    return c('div', {
      className: 'card',
      style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', margin: '0 0 6px', flexWrap: 'wrap' },
    }, [
      c('strong', { style: { flex: '1 1 200px' } }, company.name || t('portals.unnamed', '(unnamed)')),
      ...meta,
      link,
      badge,
      toggleBtn,
    ]);
  }

  function renderList(list) {
    listWrap.textContent = '';
    if (!list.length) {
      listWrap.appendChild(c('p', { style: { color: 'var(--foggy)' } }, t('portals.empty', 'No companies are tracked yet. Add tracked_companies to portals.yml.')));
      return;
    }
    // dead first (after a check), then enabled, then disabled
    const sorted = list.slice().sort((a, b) => {
      const ha = health[a.careers_url]; const hb = health[b.careers_url];
      const da = ha && !ha.ok ? 0 : (a.enabled ? 1 : 2);
      const db = hb && !hb.ok ? 0 : (b.enabled ? 1 : 2);
      return da - db;
    });
    sorted.forEach((co) => listWrap.appendChild(row(co)));
  }

  // Load (or reload) the tracked companies from portals.yml and re-render.
  async function loadCompanies() {
    try {
      const r = await API.get('/api/portals');
      const tracked = (r && r.portals && (r.portals.tracked_companies || r.portals.companies)) || [];
      companies = (Array.isArray(tracked) ? tracked : []).map((co) => ({
        name: typeof co.name === 'string' ? co.name : '',
        careers_url: typeof co.careers_url === 'string' ? co.careers_url : (typeof co.api === 'string' ? co.api : ''),
        provider: typeof co.provider === 'string' ? co.provider : '',
        enabled: co.enabled !== false,
      })).filter((co) => co.name || co.careers_url);
      const enabled = companies.filter((x) => x.enabled).length;
      summary.textContent = t('portals.counts', '{total} companies · {enabled} enabled')
        .replace('{total}', String(companies.length)).replace('{enabled}', String(enabled));
      renderList(companies);
    } catch (err) {
      companies = [];
      listWrap.textContent = '';
      listWrap.appendChild(c('p', { style: { color: 'var(--danger, #d9534f)' } }, (err && err.message) || t('portals.loadFailed', 'Could not read portals.yml')));
    }
  }

  const norm = (u) => String(u || '').trim().toLowerCase().replace(/\/+$/, '');

  function discoverRow(company, res) {
    const addBtn = c('button', { className: 'btn btn-primary btn-sm', type: 'button' }, t('portals.discoverAdd', 'Add to tracked'));
    const already = companies.some((co) => norm(co.careers_url) === norm(res.careers_url));
    if (already) { addBtn.disabled = true; addBtn.textContent = t('portals.discoverExists', 'Already tracked'); }
    addBtn.addEventListener('click', async () => {
      addBtn.disabled = true;
      try {
        const r = await API.post('/api/portals/track', { name: company, careers_url: res.careers_url, provider: res.vendor });
        UI.toast((r && r.duplicate)
          ? t('portals.discoverExists', 'Already tracked')
          : t('portals.discoverAdded', 'Added — the scanner now watches this company'),
        (r && r.duplicate) ? 'info' : 'success');
        addBtn.textContent = t('portals.discoverExists', 'Already tracked');
        await loadCompanies();
      } catch (err) {
        UI.toast((err && err.message) || t('portals.discoverAddFailed', 'Could not add the company'), 'error');
        addBtn.disabled = false;
      }
    });
    return c('div', {
      className: 'card',
      style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', margin: '6px 0 0', flexWrap: 'wrap' },
    }, [
      c('strong', { style: { textTransform: 'capitalize' } }, res.label || res.vendor),
      c('a', { href: res.careers_url, target: '_blank', rel: 'noopener noreferrer', style: { flex: '1 1 200px', fontSize: '12px', color: 'var(--foggy)' } },
        String(res.careers_url || '').replace(/^https?:\/\//, '')),
      c('span', { className: 'badge', style: { color: 'var(--go, #2e7d32)' } },
        t('portals.discoverJobs', '{count} open roles').replace('{count}', String(res.jobCount || 0))),
      addBtn,
    ]);
  }

  function renderDiscover(company, results) {
    discResults.textContent = '';
    if (!results.length) {
      discResults.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '13px' } },
        t('portals.discoverNone', 'No public ATS board with open roles found for “{company}”. It may use a portal we do not probe, or list no jobs right now.')
          .replace('{company}', company)));
      return;
    }
    discResults.appendChild(c('p', { style: { color: 'var(--foggy)', fontSize: '13px', margin: '4px 0 0' } },
      t('portals.discoverFound', '{count} board(s) found').replace('{count}', String(results.length))));
    results.forEach((res) => discResults.appendChild(discoverRow(company, res)));
  }

  async function runDiscover() {
    const company = discInput.value.trim();
    if (!company) { UI.toast(t('portals.discoverEmptyInput', 'Enter a company name first'), 'error'); return; }
    discBtn.disabled = true;
    const prev = discBtn.textContent;
    discBtn.textContent = t('portals.discovering', 'Searching…');
    discResults.textContent = '';
    try {
      const r = await API.post('/api/portals/discover', { company });
      renderDiscover((r && r.company) || company, (r && r.results) || []);
    } catch (err) {
      UI.toast((err && err.message) || t('portals.discoverFailed', 'Discovery failed'), 'error');
    } finally {
      discBtn.disabled = false; discBtn.textContent = prev;
    }
  }
  discBtn.addEventListener('click', runDiscover);
  discInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runDiscover(); } });

  checkBtn.addEventListener('click', async () => {
    checkBtn.disabled = true;
    const prev = checkBtn.textContent;
    checkBtn.textContent = t('portals.checking', 'Probing…');
    try {
      const r = await API.post('/api/portals/health', {});
      health = {};
      (r.results || []).forEach((res) => { health[res.url] = res; });
      const alive = (r.probed || 0) - (r.dead || 0);
      summary.textContent = t('portals.result', '{alive}/{probed} alive · {dead} dead')
        .replace('{alive}', String(alive)).replace('{probed}', String(r.probed || 0)).replace('{dead}', String(r.dead || 0));
      summary.style.color = (r.dead > 0) ? 'var(--danger, #d9534f)' : 'var(--go, #2e7d32)';
      renderList(companies);
    } catch (err) {
      UI.toast((err && err.message) || t('portals.checkFailed', 'Health check failed'), 'error');
    } finally {
      checkBtn.disabled = false; checkBtn.textContent = prev;
    }
  });

  await loadCompanies();
  return root;
});
