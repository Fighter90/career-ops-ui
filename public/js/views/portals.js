/* global Router, API, UI, I18n, HelpHint */
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
 *
 * CAR-121 — the 129-company list became unusable at scale: a debounced search
 * (name / domain substring), an enabled/disabled filter, grouping by ATS
 * vendor, and enable/disable as a real switch with an UNDO bar (the pipeline
 * undo pattern — one body-level bar per action, LIFO, re-applied through the
 * SAME POST /api/portals/toggle write path).
 *
 * CAR-121 i18n: all 16 new keys (portals.search/filterLabel/filterAll/
 * filterEnabled/filterDisabled/groupOther/noMatch/watch/undoEnabled/
 * undoDisabled + health.allOk/activeProvider/activeProviderNoModel/
 * optionalCollapsed/optionalOk/checksUnavailable) live in all 19 locale
 * dicts — no pending allowlist. Reused keys: pipe.undo, pipe.undoDismiss,
 * portals.enable/disable/enabledToast/disabledToast/toggleFailed, the
 * portals.* discover set, health.badge* / health.fix*.
 */
// CAR-137 i18n: the v2empty.portals.* empty-state strings live in all 19
// locale dicts (the ×19 fan-out landed in the same change).

// ── CAR-121 · pure helpers (no DOM / closure deps — vm-extractable) ──

/** Host needle → vendor label. Order = match precedence (specific first). */
const ATS_VENDORS = [
  ['greenhouse.io', 'Greenhouse'],
  ['ashbyhq.com', 'Ashby'],
  ['lever.co', 'Lever'],
  ['workable.com', 'Workable'],
  ['smartrecruiters.com', 'SmartRecruiters'],
  ['myworkdayjobs.com', 'Workday'],
  ['myworkdaysite.com', 'Workday'],
  ['recruitee.com', 'Recruitee'],
  ['personio', 'Personio'],
  ['teamtailor', 'Teamtailor'],
  ['rippling.com', 'Rippling'],
  ['gem.com', 'Gem'],
  ['jazzhr.com', 'JazzHR'],
  ['breezy.hr', 'Breezy HR'],
  ['pinpoint', 'Pinpoint'],
  ['jobvite.com', 'Jobvite'],
  ['successfactors', 'SAP SuccessFactors'],
  ['csod.com', 'Cornerstone'],
  ['taleo.net', 'Taleo'],
  ['eightfold.ai', 'Eightfold'],
  ['avature.net', 'Avature'],
  ['phenom.com', 'Phenom'],
  ['radancy', 'Radancy'],
  ['icims.com', 'iCIMS'],
  ['bamboohr.com', 'BambooHR'],
  ['paylocity.com', 'Paylocity'],
  ['comeet', 'Comeet'],
  ['hh.ru', 'hh.ru'],
  ['habr.com', 'Habr Career'],
];

/** portals.yml `provider:` slug → the same vendor label the host match yields. */
const PROVIDER_LABELS = {
  greenhouse: 'Greenhouse',
  ashby: 'Ashby',
  lever: 'Lever',
  workable: 'Workable',
  smartrecruiters: 'SmartRecruiters',
  workday: 'Workday',
  recruitee: 'Recruitee',
  personio: 'Personio',
  teamtailor: 'Teamtailor',
  rippling: 'Rippling',
  gem: 'Gem',
  jazzhr: 'JazzHR',
  breezy: 'Breezy HR',
  pinpoint: 'Pinpoint',
  jobvite: 'Jobvite',
  successfactors: 'SAP SuccessFactors',
  eightfold: 'Eightfold',
  phenom: 'Phenom',
  icims: 'iCIMS',
  bamboohr: 'BambooHR',
  paylocity: 'Paylocity',
  comeet: 'Comeet',
  hh: 'hh.ru',
  habr: 'Habr Career',
};

/** Host of a careers_url: scheme-agnostic, path / userinfo / port stripped. */
function hostOfCareerUrl(url) {
  let rest = String(url || '').trim().toLowerCase();
  rest = rest.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // scheme, if any
  rest = rest.split(/[/?#]/, 1)[0];                   // drop path / query / fragment
  const at = rest.lastIndexOf('@');                   // userinfo
  if (at !== -1) rest = rest.slice(at + 1);
  return rest.replace(/:\d+$/, '');                   // port
}

/** ATS vendor for a tracked company, or null → the "Other" group.
 * Matching is boundary-anchored: `clever.com` is NOT lever.co, `xhh.ru` is
 * NOT hh.ru — a needle must be the whole host or a dotted suffix of it
 * (dotted needles), or sit on its own label (bare tokens: acme.personio.de). */
function vendorOf(co) {
  const host = hostOfCareerUrl(co && co.careers_url);
  if (host) {
    // Label-boundary matching, string ops only (no RegExp): CodeQL's
    // missing-regexp-anchor otherwise taints every table entry, and the
    // semantics are identical — a dotted needle must be the whole host or
    // a dotted suffix of it; a bare token must appear as a complete label
    // with at least one label after it (acme.personio.de, not xpersonio.de).
    const labels = host.split('.');
    for (const pair of ATS_VENDORS) {
      const needle = pair[0];
      if (needle.indexOf('.') !== -1) {
        if (host === needle || host.endsWith('.' + needle)) return pair[1];
      } else {
        const idx = labels.indexOf(needle);
        if (idx !== -1 && idx < labels.length - 1) return pair[1];
      }
    }
  }
  const prov = String((co && co.provider) || '').trim().toLowerCase();
  if (prov && Object.prototype.hasOwnProperty.call(PROVIDER_LABELS, prov)) {
    return PROVIDER_LABELS[prov];
  }
  return null;
}

/** Case-insensitive name/domain substring match (empty query matches all). */
function matchPortal(co, q) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return true;
  return String(co.name || '').toLowerCase().indexOf(needle) !== -1
    || String(co.careers_url || '').toLowerCase().indexOf(needle) !== -1;
}

/** Enabled-state filter: 'all' | 'on' | 'off' (undefined counts as watched). */
function matchState(co, f) {
  if (f === 'on') return co.enabled !== false;
  if (f === 'off') return co.enabled === false;
  return true;
}

/** Within-group order: dead (after a check) → enabled → by name. */
function sortGroup(items, health) {
  return items.slice().sort((a, b) => {
    const ha = health[a.careers_url]; const hb = health[b.careers_url];
    const da = ha && !ha.ok ? 0 : (a.enabled !== false ? 1 : 2);
    const db = hb && !hb.ok ? 0 : (b.enabled !== false ? 1 : 2);
    if (da !== db) return da - db;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

// ── CAR-121 · undo bar lifecycle (file-scope singleton) ──
// The bar is a body-level element that outlives any single view mount, so
// its hide-timer and teardown live here, not in the Router.register closure:
// any route change hides it (one page-level hashchange hook), and Undo on a
// detached view is refused by the view's isConnected guard (review finding 3).
let portalsUndoTimer = 0;

function hidePortalsUndoBar() {
  const bar = document.getElementById('portals-undo-bar');
  if (bar) bar.hidden = true;
  clearTimeout(portalsUndoTimer);
}

function showPortalsUndoBar(next, count, onUndo) {
  const t = (k, f) => I18n.t(k, f);
  let bar = document.getElementById('portals-undo-bar');
  if (!bar) {
    bar = UI.el('div', {
      id: 'portals-undo-bar',
      className: 'v2-portals-undo-bar',
      role: 'status',
      'aria-live': 'polite',
    });
    document.body.appendChild(bar);
  }
  bar.replaceChildren(
    UI.el('span', { className: 'v2-portals-undo-msg' },
      (next
        ? t('portals.undoEnabled', 'Enabled: {count}')
        : t('portals.undoDisabled', 'Disabled: {count}')).replace('{count}', String(count))),
    UI.el('button', {
      type: 'button',
      id: 'portals-undo-btn',
      className: 'btn btn-primary btn-sm',
      onClick: () => { onUndo(); },
    }, t('pipe.undo', 'Undo')),
    UI.el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm',
      onClick: () => { hidePortalsUndoBar(); },
    }, t('pipe.undoDismiss', 'Dismiss')),
  );
  bar.hidden = false;
  clearTimeout(portalsUndoTimer);
  portalsUndoTimer = setTimeout(() => { bar.hidden = true; }, 8000);
}

let portalsUndoNavHook = false;
function installPortalsUndoNavHook() {
  if (portalsUndoNavHook) return; // once per page — a per-mount listener would leak
  portalsUndoNavHook = true;
  window.addEventListener('hashchange', hidePortalsUndoBar);
}

Router.register('portals', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  // CAR-121 — the view owns its stylesheet (public/css/v2-portals.css, the
  // v2-pipeline.css pattern): components.css sits at its 800-LOC gate limit
  // and index.html is shared across the parallel UX epics, so the link is
  // injected here instead, idempotently. Same-origin link — CSP-safe.
  if (!document.getElementById('v2-portals-css')) {
    document.head.appendChild(c('link', {
      id: 'v2-portals-css', rel: 'stylesheet', href: '/css/v2-portals.css',
    }));
  }

  const root = c('div');
  root.appendChild(HelpHint.title(t('portals.title', 'Portals'), 'help.hint.portals'));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('portals.subtitle', 'The companies the scanner watches for new roles (portals.yml). Run a health check to catch ATS slugs that have quietly broken — a 404 means that company silently disappears from every future scan.')));

  let companies = [];
  // health results keyed by careers_url (filled by the check)
  let health = {};
  // CAR-121 — the alive/dead line from the last check survives toggles;
  // while it is set, the counts line does not overwrite it.
  let checkSummaryText = null;

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

  // ── Health check ────────────────────────────────────────────────────
  const checkBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('portals.check', 'Check portal health'));
  const summary = c('span', { style: { marginLeft: '12px', color: 'var(--foggy)', fontSize: '13px' } });
  root.appendChild(c('div', { style: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', margin: '16px 0' } }, [checkBtn, summary]));

  // ── CAR-121 · search + enabled-state filter (debounced) ─────────────
  let query = '';
  let stateFilter = 'all';
  let searchTimer = 0;
  const searchInput = c('input', {
    type: 'search',
    className: 'input',
    placeholder: t('portals.search', 'Search by name or domain…'),
    'aria-label': t('portals.search', 'Search by name or domain…'),
    style: { flex: '1 1 220px', minWidth: '180px' },
  });
  const filterSelect = c('select', {
    className: 'select',
    // the select is labelled by a dedicated verb, not by its first OPTION
    // (review finding 9 — it otherwise read "All portals, Disabled only")
    'aria-label': t('portals.filterLabel', 'Show'),
    style: { flex: '0 1 auto', width: 'auto' },
  }, [
    c('option', { value: 'all' }, t('portals.filterAll', 'All portals')),
    c('option', { value: 'on' }, t('portals.filterEnabled', 'Enabled only')),
    c('option', { value: 'off' }, t('portals.filterDisabled', 'Disabled only')),
  ]);
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = searchInput.value.trim();
      renderList();
    }, 250);
  });
  filterSelect.addEventListener('change', () => {
    stateFilter = filterSelect.value;
    renderList();
  });
  const toolbar = c('div', { className: 'v2-portals-toolbar' }, [searchInput, filterSelect]);
  root.appendChild(toolbar);

  const listWrap = c('div');
  root.appendChild(listWrap);

  // ── CAR-121 · undo (session-scoped, body-level bar — pipeline pattern)
  const undoStack = []; // [{ next, items: [{ careers_url, prev }] }]
  // one write per portal at a time (review finding 5): a flip while its POST
  // is in flight would race the re-render and record a stale undo state.
  const pendingToggles = new Set();

  installPortalsUndoNavHook();

  // Re-apply the recorded pre-toggle states through the SAME write path
  // (POST /api/portals/toggle); the server write is idempotent per state.
  async function undoLast() {
    // A detached view must never write — navigation already hid the bar;
    // this guard is the belt to that hook's braces (review finding 3).
    if (!root.isConnected) { hidePortalsUndoBar(); return; }
    // Pop only after success (review finding 4): a failed undo must stay
    // undoable, and a PARTIAL failure keeps its remaining items on the stack.
    const action = undoStack[undoStack.length - 1] || null;
    if (!action) { hidePortalsUndoBar(); return; }
    const remaining = [];
    for (const item of action.items) {
      try {
        await API.post('/api/portals/toggle', { careers_url: item.careers_url, enabled: item.prev });
        const co = companies.find((x) => x.careers_url === item.careers_url);
        if (co) co.enabled = item.prev;
      } catch {
        remaining.push(item);
      }
    }
    updateSummary();
    renderList();
    if (remaining.length) {
      action.items = remaining; // trimmed in place — still the stack top
      showPortalsUndoBar(remaining.some((x) => x.prev !== false), remaining.length, undoLast);
      return;
    }
    undoStack.pop();
    hidePortalsUndoBar();
    UI.toast(action.items.some((x) => x.prev !== false)
      ? t('portals.enabledToast', 'Portal enabled — the scanner will watch it')
      : t('portals.disabledToast', 'Portal disabled — the scanner will skip it'), 'success');
  }

  async function applyToggle(company, next) {
    const url = company.careers_url;
    if (!url || pendingToggles.has(url)) return; // re-entry / in-flight guard
    pendingToggles.add(url);
    renderList(); // repaint now: the in-flight row renders its switch disabled
    let ok = false;
    try {
      await API.post('/api/portals/toggle', { careers_url: url, enabled: next });
      undoStack.push({ next, items: [{ careers_url: url, prev: !next }] });
      company.enabled = next;
      ok = true;
      UI.toast(next
        ? t('portals.enabledToast', 'Portal enabled — the scanner will watch it')
        : t('portals.disabledToast', 'Portal disabled — the scanner will skip it'), 'success');
    } catch (err) {
      UI.toast((err && err.message) || t('portals.toggleFailed', 'Could not update the portal'), 'error');
    } finally {
      pendingToggles.delete(url);
      updateSummary();
      renderList();
    }
    if (ok) showPortalsUndoBar(next, 1, undoLast);
  }

  function updateSummary() {
    if (checkSummaryText) { summary.textContent = checkSummaryText; return; }
    const enabled = companies.filter((x) => x.enabled !== false).length;
    summary.textContent = t('portals.counts', '{total} companies · {enabled} enabled')
      .replace('{total}', String(companies.length)).replace('{enabled}', String(enabled));
  }

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
    // FULL-R5 — careers_url comes from portals.yml (user-edited) — only a
    // real http(s) URL becomes the link. Review r2 (finding 9): a non-http
    // value still RENDERS as plain text — it must not vanish from the row.
    const strippedUrl = String(company.careers_url || '').replace(/^https?:\/\//, '').slice(0, 60);
    const safeCareersUrl = UI.safeHref(company.careers_url);
    const link = company.careers_url
      ? (safeCareersUrl
        ? c('a', { href: safeCareersUrl, target: '_blank', rel: 'noopener noreferrer', style: { fontSize: '12px', color: 'var(--foggy)' } }, strippedUrl)
        : c('span', { style: { fontSize: '12px', color: 'var(--foggy)' } }, strippedUrl))
      : null;
    // v1.144.0 — enable/disable toggle (writes portals.yml; the scanner skips
    // disabled companies via `c.enabled !== false`). Keyed by careers_url, so a
    // company without one can't be toggled from here.
    const canToggle = !!company.careers_url;
    // `enabled` may be an un-normalized field (undefined = watched, like the
    // scanner's `!== false`), so treat anything but an explicit false as ON.
    const isOn = company.enabled !== false;
    // CAR-121 — a real switch (checkbox painted as a pill toggle) instead of
    // the Enable/Disable button; undo lives in the bar, not in a confirm().
    const toggleInput = c('input', {
      type: 'checkbox',
      className: 'v2-portals-switch',
      role: 'switch',
      checked: isOn,
      disabled: !canToggle || pendingToggles.has(company.careers_url),
      // CAR-21 (v1.243.0) + review finding 8 — the accessible name is
      // STABLE ("Watch: <company>"); the ON/OFF state is announced by the
      // switch itself via :checked. The old name embedded the action, so
      // SRs read "Disable: Acme, switch, on".
      'aria-label': t('portals.watch', 'Watch')
        + ': ' + (company.name || company.careers_url),
    });
    if (canToggle) {
      toggleInput.addEventListener('change', () => {
        applyToggle(company, toggleInput.checked);
      });
    }
    return c('div', {
      className: 'card',
      style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', margin: '0 0 6px', flexWrap: 'wrap' },
    }, [
      c('strong', { style: { flex: '1 1 200px' } }, company.name || t('portals.unnamed', '(unnamed)')),
      ...meta,
      link,
      badge,
      toggleInput,
    ]);
  }

  function renderList() {
    listWrap.textContent = '';
    if (!companies.length) {
      // CAR-137 — the v2empty pattern (CAR-124): explanation + a tagged,
      // decorative example of a tracked-company card + the real first
      // step — the Discover block already on this page (scroll + focus,
      // no duplicate discover UI, no extra network call).
      listWrap.appendChild(c('div', { className: 'empty' }, [
        c('p', { style: { fontWeight: 600, margin: '0 0 4px' } },
          t('v2empty.portals.emptyTitle', 'No companies tracked yet')),
        c('p', { style: { color: 'var(--foggy)', fontSize: '13px', margin: '0 0 12px' } },
          t('v2empty.portals.emptyBody', 'Discover a company\'s job board below (Greenhouse, Ashby, or Lever) and add it to the watch list — tracked companies appear here as cards like the one below.')),
        c('div', { className: 'v2-empty-example', 'aria-hidden': 'true' }, [
          c('span', { className: 'v2-empty-example__tag' }, t('v2empty.exampleTag', 'Example')),
          c('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' } }, [
            c('span', { style: { fontWeight: '700', fontSize: '14px' } }, 'Acme Robotics'),
            c('span', { className: 'tag' }, 'Greenhouse'),
            c('span', { style: { color: 'var(--foggy)', fontSize: '12px' } }, 'boards.greenhouse.io/acme'),
          ]),
        ]),
        c('p', { style: { margin: '12px 0 0' } },
          c('button', {
            className: 'btn btn-primary', type: 'button',
            onClick: () => {
              discCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
              discInput.focus({ preventScroll: true });
            },
          }, '🔎 ' + t('v2empty.portals.discover', 'Discover a company'))),
      ]));
      return;
    }
    const vis = companies.filter((co) => matchState(co, stateFilter) && matchPortal(co, query));
    if (!vis.length) {
      listWrap.appendChild(c('p', { style: { color: 'var(--foggy)' } }, t('portals.noMatch', 'No portals match the current search or filter.')));
      return;
    }
    const otherLabel = t('portals.groupOther', 'Other');
    const groups = new Map();
    for (const co of vis) {
      const label = vendorOf(co) || otherLabel;
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(co);
    }
    const labels = Array.from(groups.keys()).sort((a, b) => {
      if (a === otherLabel) return 1;
      if (b === otherLabel) return -1;
      return a.localeCompare(b);
    });
    for (const label of labels) {
      const items = sortGroup(groups.get(label), health);
      listWrap.appendChild(c('h3', { className: 'v2-portals-group-h' }, [
        label,
        c('span', { className: 'v2-portals-count' }, String(items.length)),
      ]));
      items.forEach((co) => listWrap.appendChild(row(co)));
    }
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
      // a fresh read invalidates the last probe's alive/dead line (review
      // finding 7): new rows were never probed, so the counts come back.
      checkSummaryText = null;
      summary.style.color = '';
      updateSummary();
      renderList();
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
      // FULL-R5 — only a real http(s) URL becomes the link.
      (UI.safeHref(res.careers_url) ? c('a', { href: UI.safeHref(res.careers_url), target: '_blank', rel: 'noopener noreferrer', style: { flex: '1 1 200px', fontSize: '12px', color: 'var(--foggy)' } },
        String(res.careers_url || '').replace(/^https?:\/\//, '')) : c('span', { style: { flex: '1 1 200px', fontSize: '12px', color: 'var(--foggy)' } }, String(res.careers_url || '').replace(/^https?:\/\//, ''))),
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
    // CAR-21 (v1.243.0) — the button disables itself while a discovery is in
    // flight, but pressing Enter again called runDiscover() directly and
    // bypassed that guard (double POST + result clobber). Guard here too —
    // this also covers double-clicks on the chips-adjacent UI.
    if (discBtn.disabled) return;
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
  discInput.addEventListener('keydown', (e) => {
    // CAR-21 (v1.243.0) — an IME composition Enter (confirming CJK
    // candidates) is text input, not a submit.
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') { e.preventDefault(); runDiscover(); }
  });

  checkBtn.addEventListener('click', async () => {
    checkBtn.disabled = true;
    const prev = checkBtn.textContent;
    checkBtn.textContent = t('portals.checking', 'Probing…');
    try {
      const r = await API.post('/api/portals/health', {});
      health = {};
      (r.results || []).forEach((res) => { health[res.url] = res; });
      const alive = (r.probed || 0) - (r.dead || 0);
      checkSummaryText = t('portals.result', '{alive}/{probed} alive · {dead} dead')
        .replace('{alive}', String(alive)).replace('{probed}', String(r.probed || 0)).replace('{dead}', String(r.dead || 0));
      summary.style.color = (r.dead > 0) ? 'var(--danger, #d9534f)' : 'var(--go, #2e7d32)';
      updateSummary();
      renderList();
    } catch (err) {
      UI.toast((err && err.message) || t('portals.checkFailed', 'Health check failed'), 'error');
    } finally {
      checkBtn.disabled = false; checkBtn.textContent = prev;
    }
  });

  await loadCompanies();
  return root;
});
