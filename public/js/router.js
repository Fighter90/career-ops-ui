/* global window */
window.Router = (function () {
  const routes = {};

  // Route aliases — kept for URL stability when an internal name changes
  // and bookmarks/external links exist for the old form. v1.10.0 renamed
  // the canonical route from `settings` → `profile`; the old hash still
  // resolves so existing bookmarks keep working.
  const ALIASES = {
    settings: 'profile',
    // WS2 #2: #/portals was an unregistered route → 404. Alias it to
    // config (which deep-links to the Regional-sources group on that
    // hash); same bookmark-stability pattern as settings→profile.
    portals: 'config',
    // QA BUG-004: the Outreach view's canonical hash is the Spanish
    // `#/contacto` (mode slug = modes/contacto.md) while every other
    // route is English. Expose an English `#/outreach` that resolves to
    // it so the URL is consistent and bookmarkable; the canonical slug
    // stays `contacto` to match the parent project's mode filename.
    outreach: 'contacto',
  };

  function register(name, renderer) {
    routes[name] = renderer;
  }

  function current() {
    const hash = window.location.hash.slice(2) || 'dashboard';
    // v1.28.1 — strip `?query` before route lookup.
    // Pre-v1.28.1 `Router.go('/evaluate?url=…')` produced a hash whose
    // first split('/') segment was the whole "evaluate?url=…" literal,
    // which never matched a registered route → __not_found__ (404).
    // The view itself parses `window.location.hash.split('?')[1]` via
    // URLSearchParams (see evaluate.js, config.js), so we only need to
    // drop the query portion from the NAME lookup, not from the hash.
    const beforeQuery = hash.split('?')[0];
    const [rawName, ...rest] = beforeQuery.split('/');
    const name = ALIASES[rawName] || rawName;
    return { name, rawName, params: rest };
  }

  // v1.41.0 (WS2 UX-audit HIGH, cross-cutting) — SPA focus management.
  // `render()` replaces #content on every hashchange but never moved
  // focus, so keyboard / screen-reader users stayed on the destroyed
  // node and lost their place (WCAG 2.4.3 Focus Order / 4.1.3 Status
  // Messages). After a route render we move focus to the new view's
  // first heading (concise SR announcement + correct focus order).
  // Skipped on the very first paint so it doesn't fight the skip-link.
  let firstPaintDone = false;
  function focusNewView(content) {
    const target =
      content.querySelector('h1, .page-title, [data-autofocus]') || content;
    if (target !== content && !target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    // v1.56.2 — UX-N1: per-route, locale-aware document.title for
    // multi-tab orientation, bookmarks, and the screen-reader
    // "page changed" announcement. Derived from the view's own
    // localized <h1>/.page-title, so it is automatically translated
    // and distinct per route with no new i18n keys. Set BEFORE the
    // first-paint guard below so the initial tab is titled too.
    const heading = content.querySelector('h1, .page-title');
    const viewTitle = heading
      ? heading.textContent.trim().replace(/\s+/g, ' ')
      : '';
    document.title = viewTitle
      ? `${viewTitle} — career-ops-ui`
      : 'career-ops-ui — command center';
    // v1.56.0 — UX-12: on the FIRST paint we now make the landing
    // view's heading programmatically focusable (tabindex=-1 was set
    // above) so screen-reader / heading navigation lands on it, and
    // #content is aria-live=polite so the dashboard heading is
    // announced on boot — but we still do NOT steal focus here, which
    // would fight the skip-link (the deliberate v1.41.0 behaviour).
    // Every subsequent route change DOES move focus to the new view.
    if (!firstPaintDone) { firstPaintDone = true; return; }
    try { target.focus({ preventScroll: false }); } catch { /* jsdom */ }
  }

  async function render() {
    const { name, rawName, params } = current();

    document.querySelectorAll('.nav-item').forEach((a) => {
      // Highlight nav match against EITHER the alias (rawName) or the
      // resolved route — so #/profile lights up the Profile nav item
      // even though it routes to `settings` internally.
      const r = a.dataset.route;
      a.classList.toggle('active', r === name || r === rawName);
    });

    const content = document.getElementById('content');
    // Unknown route → render the dedicated 404 view instead of silently
    // falling back to the dashboard (which masked typos and broken links).
    const renderer = routes[name] || routes['__not_found__'];

    content.innerHTML = `<div class="loading">${(window.I18n && I18n.t('router.loading', 'Loading…')) || 'Loading…'}</div>`;
    try {
      const result = await renderer(params);
      if (result instanceof Node) {
        content.innerHTML = '';
        content.appendChild(result);
      } else if (typeof result === 'string') {
        content.innerHTML = result;
      }
      focusNewView(content);
    } catch (err) {
      console.error(err);
      const isNet = err && err.network;
      const t = (k, f) => (window.I18n && I18n.t) ? I18n.t(k, f) : f;
      const titleStr = isNet ? t('router.netError', 'No connection to server') : t('router.error', 'Error');
      const retryStr = t('common.retry', 'Retry');
      const runStr = t('router.runStart', 'Run');
      content.innerHTML = `<div class="empty">
        <strong>${titleStr}</strong>
        <p style="margin: 12px 0 0; color: var(--foggy)">${(err && err.message) || err}</p>
        ${isNet ? `<p style="margin-top:8px;color:var(--foggy);font-size:13px;">${runStr}: <code>bash web-ui/bin/start.sh</code></p>` : ''}
        <button class="btn btn-ghost mt-3" data-action="router-retry">${retryStr}</button>
      </div>`;
      content.querySelector('[data-action="router-retry"]')?.addEventListener('click', () => render());
      focusNewView(content);
      if (!isNet) window.UI?.toast(err.message || 'Render error', 'error');
    }
  }

  function go(path) {
    window.location.hash = path.startsWith('#') ? path : '#' + (path.startsWith('/') ? path : '/' + path);
  }

  window.addEventListener('hashchange', render);

  // 404 view — registered here so it cannot collide with a real route name
  // and so the router never depends on an external file being loaded first.
  register('__not_found__', () => {
    const t = (k, f) => (window.I18n && window.I18n.t) ? window.I18n.t(k, f) : f;
    const { rawName } = current();
    const wrap = document.createElement('div');
    wrap.className = 'page-404 empty';
    wrap.style.padding = '64px 24px';
    wrap.style.textAlign = 'center';

    const h1 = document.createElement('h1');
    h1.className = 'page-title';
    h1.textContent = t('notFound.title', '404 — page not found');

    const p = document.createElement('p');
    p.style.color = 'var(--foggy)';
    p.style.margin = '12px 0 24px';
    const body = t('notFound.body', "The route “{path}” doesn't exist.")
      .replace('{path}', '#/' + (rawName || ''));
    p.textContent = body;

    const a = document.createElement('a');
    a.className = 'btn btn-primary';
    a.href = '#/dashboard';
    a.textContent = t('notFound.back', 'Back to Dashboard');

    wrap.append(h1, p, a);
    return wrap;
  });

  return { register, render, go, current };
})();
