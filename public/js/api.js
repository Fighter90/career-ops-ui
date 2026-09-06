/* global window */
window.API = (function () {
  let connectionLost = false;

  // v1.22.0 (M-6) + v1.23.0 — exponential backoff on the health ping.
  // Tab left open overnight against a dead server used to fire 28,800
  // failed fetches. Backoff grows 3s → 6s → 12s → cap 15s, resets to
  // 3s on the first successful recovery.
  //
  // v1.23.0 hardening: the in-flight setTimeout is tracked by handle
  // and re-scheduled immediately when connection state flips down.
  // Without this reset, the existing timer was locked to whatever delay
  // was set previously — a server killed at t=0.1 with the first ping
  // at t=3 would fail, double the delay to 6, and the next recovery
  // probe wouldn't fire until t=9. Recovery now happens within
  // _HEALTH_MIN seconds of going down.
  //
  // v1.23.0 also re-caps at 15s instead of 60s — a tab that's been
  // backgrounded for an hour will still recover within one polling
  // cycle once the user comes back. Network savings vs no-backoff
  // remain substantial (240/hr → 240/hr → 240/hr peak, dropping to
  // 240/hr at the 15s cap — vs ~1200/hr at the original 3s constant).
  let _healthHandle = null;
  let _healthDelay = 3000;
  const _HEALTH_MIN = 3000;
  const _HEALTH_MAX = 15000;
  function _scheduleHealthCheck() {
    if (_healthHandle) { clearTimeout(_healthHandle); _healthHandle = null; }
    _healthHandle = setTimeout(async () => {
      _healthHandle = null;
      if (!connectionLost) { _healthDelay = _HEALTH_MIN; _scheduleHealthCheck(); return; }
      try {
        const r = await fetch('/api/health', { cache: 'no-store' });
        if (r.ok) {
          setConnectionState(false);
          _healthDelay = _HEALTH_MIN;
          if (window.UI) UI.toast((window.I18n && I18n.t('conn.recovered', 'Connection restored')) || 'Connection restored', 'success');
        } else {
          _healthDelay = Math.min(_healthDelay * 2, _HEALTH_MAX);
        }
      } catch {
        _healthDelay = Math.min(_healthDelay * 2, _HEALTH_MAX);
      }
      _scheduleHealthCheck();
    }, _healthDelay);
  }

  function setConnectionState(lost, reason) {
    if (lost === connectionLost) return;
    connectionLost = lost;
    const banner = document.getElementById('conn-banner');
    if (lost) {
      // v1.23.0 — reset backoff + reschedule so the FIRST recovery probe
      // happens within _HEALTH_MIN of going down (otherwise it inherits
      // whatever delay was previously queued).
      _healthDelay = _HEALTH_MIN;
      _scheduleHealthCheck();
    }
    if (!banner) return;
    if (lost) {
      banner.hidden = false;
      const baseMsg = (window.I18n && window.I18n.t)
        ? window.I18n.t('conn.down', 'Server is not responding.')
        : 'Server is not responding.';
      banner.querySelector('.conn-msg').textContent =
        baseMsg + ' (' + (reason || 'fetch failed') + ') · bash web-ui/bin/start.sh';
    } else {
      banner.hidden = true;
    }
  }
  _scheduleHealthCheck();

  // v1.23.0 — eager re-check when the tab regains focus / visibility.
  // Users typically Cmd-Tab back when the server is up; we shouldn't
  // wait up to 15s for the next backoff tick to discover that.
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && connectionLost) {
        _healthDelay = _HEALTH_MIN;
        _scheduleHealthCheck();
      }
    });
  }

  function currentLang() {
    try {
      return (window.I18n && window.I18n.getLang && window.I18n.getLang()) || 'en';
    } catch { return 'en'; }
  }

  async function call(method, path, body) {
    const lang = currentLang();
    const opts = {
      method,
      headers: { Accept: 'application/json', 'Accept-Language': lang },
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      // Auto-attach lang to LLM-bound mutations so server-side
      // resolveLocale() picks the SPA's UI locale (PR-2 / F-012).
      // Read-only requests (GET) skip this; non-object bodies are sent verbatim.
      const augmented = (body && typeof body === 'object' && !Array.isArray(body) && body.lang === undefined)
        ? { ...body, lang }
        : body;
      opts.body = JSON.stringify(augmented);
    }
    let res;
    try {
      res = await fetch(path, opts);
    } catch (netErr) {
      setConnectionState(true, netErr.message || 'network error');
      // v1.57.1 — say WHAT failed and WHERE. v1.58.0 (AI-review rule 3):
      // the human sentence is localized via I18n; the trailing
      // `(METHOD /path)` is a language-neutral diagnostic token (HTTP
      // verbs/paths are never localized, same as the `HTTP NNN` status
      // surfaced on non-OK responses).
      const _t = (k, f) => (window.I18n && window.I18n.t) ? window.I18n.t(k, f) : f;
      const err = new Error(
        _t('api.netError', 'Network error') + ': '
        + (netErr.message || 'Failed to fetch')
        + ` (${method} ${path}) — `
        + _t('api.netHint', 'the server may be down; run: bash web-ui/bin/start.sh'));
      err.network = true;
      throw err;
    }
    setConnectionState(false);

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      // v1.57.1 — surface per-field validation detail SITE-WIDE. The
      // server returns `{ error, details: ["FIELD: reason", …] }`; until
      // now every form's `catch (e) { UI.toast(e.message) }` showed only
      // the opaque top line ("validation failed"), so the user could not
      // tell WHICH field was wrong. Fold the field-level reasons into
      // the thrown message so the existing toast handlers display them
      // verbatim — no per-view change needed. `err.details` is kept
      // separately for views that want to render them inline.
      let msg = data.error || res.statusText || ('HTTP ' + res.status);
      const details = Array.isArray(data.details)
        ? data.details.filter((d) => typeof d === 'string' && d.trim())
        : [];
      if (details.length) {
        // WHY: the field-level reasons, verbatim from the server.
        msg += ' — ' + details.join(' · ');
      } else if (data && typeof data.raw === 'string' && data.raw.trim()) {
        // Non-JSON error body (HTML 500 page, proxy error, …): show a
        // trimmed snippet so the user/dev sees the actual server reason
        // instead of a bare "HTTP 500".
        msg += ' — ' + data.raw.trim().replace(/\s+/g, ' ').slice(0, 300);
      }
      // WHERE: which request failed, and the HTTP status, so an opaque
      // "validation failed" becomes "validation failed — … (POST
      // /api/config · HTTP 400)". Applied to every API error site-wide.
      msg += ` (${method} ${path} · HTTP ${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      err.details = details;
      throw err;
    }
    return data;
  }

  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b),
    put: (p, b) => call('PUT', p, b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p) => call('DELETE', p),

    // text helpers
    async getText(path) {
      const res = await fetch(path);
      if (!res.ok) throw new Error(res.statusText);
      return res.text();
    },

    // SSE wrapper
    stream(path, onEvent) {
      const es = new EventSource(path);
      ['start', 'log', 'done', 'error'].forEach((ev) => {
        es.addEventListener(ev, (e) => {
          let data;
          try { data = JSON.parse(e.data); } catch { data = e.data; }
          onEvent(ev, data);
          // v1.29.2 — close on `error` always; close on `done` UNLESS the
          // server explicitly set `final: false`. The multi-phase
          // `/api/stream/scan?source=both` endpoint emits one `done` per
          // phase (EN, then RU); the intermediate `done` carries
          // `final: false` so the EventSource stays open for the RU phase.
          // Backward-compatible: existing single-phase producers don't set
          // `final`, so it defaults to undefined → `!== false` → close as
          // before. Closing early was the v1.28-and-earlier bug that
          // silently dropped the regional scan phase ("ATS scanned but
          // no Russian sites").
          if (ev === 'error') { es.close(); return; }
          if (ev === 'done' && (!data || data.final !== false)) es.close();
        });
      });
      es.onerror = () => {
        onEvent('error', { message: 'connection lost' });
        es.close();
      };
      return es;
    },
  };
})();

window.UI = (function () {
  let toastTimer;
  // U-13 (v1.58.33) — per-tab in-memory toast journal (cap 50). Toasts
  // dwell 3.5-20 s and then vanish; a user that catches one with a
  // glance has no way to re-read it. Every toast call now appends
  // `{ ts, type, message, detail }` to `toastHistory`. `getToastHistory()`
  // returns a shallow clone for any future drawer / panel UI. The
  // drawer chrome itself (right-slide list with bell badge) is
  // deferred; the contract that makes it possible ships here.
  const TOAST_HISTORY_CAP = 50;
  const toastHistory = [];
  function getToastHistory() { return toastHistory.slice(); }
  // v1.58.34 — pub/sub on top of the U-13 capture so the notifications
  // drawer can re-render without polling getToastHistory(). Subscribers
  // receive the entry just appended.
  const toastSubscribers = new Set();
  function onToast(fn) { toastSubscribers.add(fn); return () => toastSubscribers.delete(fn); }
  // UX-A12 (v1.58.60) — bulk + per-entry purge for the notifications
  // drawer. Both mutate `toastHistory` in place and notify subscribers
  // with a sentinel `{cleared: true}` (Clear all) or `{dismissed: ts}`
  // (single) so the drawer can re-render without re-reading the array.
  // ts is used as the stable identity key — it's set at toast() time
  // with millisecond precision so collisions in normal usage are nil.
  function clearToastHistory() {
    toastHistory.length = 0;
    for (const fn of toastSubscribers) {
      try { fn({ cleared: true }); } catch { /* drawer must never break */ }
    }
  }
  function dismissToastHistory(ts) {
    const idx = toastHistory.findIndex((e) => e && e.ts === ts);
    if (idx === -1) return false;
    toastHistory.splice(idx, 1);
    for (const fn of toastSubscribers) {
      try { fn({ dismissed: ts }); } catch { /* drawer must never break */ }
    }
    return true;
  }
  // U-4 (v1.58.24) — strip the technical "(METHOD /path · HTTP NNN)"
  // postfix from the toast's headline text and stash it in a collapsed
  // `<details>` element so the human sentence reads cleanly by default.
  // BUG-006 still requires the technical detail to be reachable in
  // the DOM — the <details> satisfies that invariant.
  const TOAST_ENDPOINT_RE = /\s*\((GET|POST|PUT|PATCH|DELETE)\s+\S+\s+·\s+HTTP\s+\d{3}\)\s*$/;
  function toast(msg, type) {
    const t = document.getElementById('toast');
    const raw = String(msg ?? '');
    const m = raw.match(TOAST_ENDPOINT_RE);
    const headline = m ? raw.slice(0, m.index).trimEnd() : raw;
    const detail = m ? m[0].trim() : '';
    // U-13 (v1.58.33) — capture into the in-memory journal before
    // rendering so a future drawer can show kind/timestamp/message.
    const entry = { ts: Date.now(), type: type || 'info', message: headline, detail };
    toastHistory.push(entry);
    if (toastHistory.length > TOAST_HISTORY_CAP) toastHistory.shift();
    // v1.58.34 — notify subscribers (defensive: ignore subscriber throws).
    for (const fn of toastSubscribers) {
      try { fn(entry); } catch { /* drawer must never break the toast pipeline */ }
    }
    // Reset the toast root to a clean state.
    while (t.firstChild) t.removeChild(t.firstChild);
    const p = document.createElement('p');
    p.className = 'toast-msg';
    p.textContent = headline;
    t.appendChild(p);
    if (detail) {
      const d = document.createElement('details');
      d.className = 'toast-detail';
      const s = document.createElement('summary');
      // i18n: fall back gracefully if I18n hasn't booted yet.
      s.textContent = (window.I18n && I18n.t)
        ? I18n.t('toast.details', 'Details')
        : 'Details';
      const code = document.createElement('code');
      code.textContent = detail;
      d.appendChild(s);
      d.appendChild(code);
      t.appendChild(d);
    }
    t.className = 'toast ' + (type || '');
    t.hidden = false;
    clearTimeout(toastTimer);
    // v1.57.1 — error toasts now carry a full what/where/why message
    // (field-level validation reasons + the failing request). 3.5s is
    // too short to read that; scale the dwell time with message length
    // and give errors a longer floor so a detailed input error is
    // actually readable. Success/info keep the snappy 3.5s.
    const isErr = type === 'error';
    const dwell = isErr
      ? Math.min(20000, Math.max(9000, 60 * raw.length))
      : 3500;
    toastTimer = setTimeout(() => (t.hidden = true), dwell);
  }
  // v1.58.0 (QA BUG-007) — explicitly hide the toast. A progress toast
  // like "Running doctor.mjs…" otherwise lingered for its full dwell
  // and overlapped the result modal, looking like the app had hung.
  function dismissToast() {
    const t = document.getElementById('toast');
    if (t) t.hidden = true;
    clearTimeout(toastTimer);
  }
  // v1.17.0 — a11y: focus management + Tab trap. Remembers the element
  // that had focus before the modal opened so we can restore it on close
  // (matches the WAI-ARIA Authoring Practices "modal dialog" pattern).
  let _modalFocusReturn = null;
  // v1.44.0 (WS2 #4/#9) — optional close callback so `confirm()` resolves
  // false on ANY dismissal path (Esc / backdrop / × / Cancel), all of
  // which funnel through closeModal().
  let _onClose = null;
  function _modalFocusables() {
    const m = document.getElementById('modal');
    if (!m) return [];
    return Array.from(m.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
  }
  function _modalKeydown(e) {
    if (e.key !== 'Tab') return;
    const f = _modalFocusables();
    if (f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
  function modal(title, html, onClose) {
    // M-2 (v1.58.10) — defence-in-depth: any progress toast that was up
    // while the work ran (`Running …`) collides visually with a freshly
    // opened result modal on narrow screens and steals the user's
    // attention away from the actual result. The Health page's Doctor /
    // verify-pipeline buttons explicitly call dismissToast() before
    // modal(); cv.js's sync-check (and any future call site) used to
    // skip it. Doing it here closes the gap for every entry-point — the
    // toast is by design transient ("Running cv-sync-check.mjs…"), so
    // killing it the moment the result modal opens is always correct.
    dismissToast();
    // If a prior modal with a close hook is still open (e.g. a second
    // modal opens over an unresolved confirm), settle the old one as a
    // dismissal so its Promise never leaks. Then arm the new hook.
    if (_onClose) { const stale = _onClose; _onClose = null; stale(); }
    _onClose = typeof onClose === 'function' ? onClose : null;
    document.getElementById('modal-title').textContent = title;
    const body = document.getElementById('modal-body');
    if (typeof html === 'string') body.innerHTML = html;
    else { body.innerHTML = ''; body.appendChild(html); }
    const m = document.getElementById('modal');
    m.hidden = false;
    // Save current focus owner so Esc / data-close can restore it.
    _modalFocusReturn = document.activeElement;
    // Focus the first focusable inside the modal — defaults to the
    // close button when no body input exists.
    const focusables = _modalFocusables();
    if (focusables.length) {
      // Skip the close button (×) so the modal body input gets focus
      // when present — better UX for fill-and-submit flows like
      // AutoPipeline.
      const skipClose = focusables.find((el) => !el.classList.contains('modal-close'));
      (skipClose || focusables[0]).focus();
    }
    m.addEventListener('keydown', _modalKeydown);
  }
  function closeModal() {
    const m = document.getElementById('modal');
    m.hidden = true;
    m.removeEventListener('keydown', _modalKeydown);
    // Return focus to whatever had it before the modal opened — keeps
    // keyboard navigation contiguous (WAI-ARIA AP pattern).
    if (_modalFocusReturn && document.contains(_modalFocusReturn)) {
      try { _modalFocusReturn.focus(); } catch {}
    }
    _modalFocusReturn = null;
    // Fire the close hook exactly once (confirm() relies on this for
    // Esc / backdrop / × dismissal → resolve(false)).
    if (_onClose) { const cb = _onClose; _onClose = null; cb(); }
  }

  /**
   * Focus-trapped confirmation dialog. Returns Promise<boolean> — true
   * only when the user activates the confirm button; false on Cancel,
   * Esc, backdrop, or × (every path runs closeModal → _onClose).
   * Replaces native confirm() for destructive parent-file writes
   * (WS2 UX-audit #4 config raw saves, #9 tracker fix ops).
   *
   *   if (await UI.confirm(I18n.t('config.rawConfirmTitle'),
   *       I18n.t('config.profileRawConfirmBody'), { danger:true,
   *       confirmLabel:I18n.t('config.rawConfirmOk') })) { …destructive… }
   */
  function confirm(title, message, opts = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        resolve(val);
      };
      const cancelBtn = el('button', {
        className: 'btn btn-ghost',
        onClick: () => { finish(false); closeModal(); },
      }, opts.cancelLabel || (window.I18n && I18n.t('common.cancel', 'Cancel')) || 'Cancel');
      const okBtn = el('button', {
        className: 'btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger'),
        onClick: () => { finish(true); closeModal(); },
      }, opts.confirmLabel || (window.I18n && I18n.t('common.confirm', 'Confirm')) || 'Confirm');
      const body = el('div', null, [
        el('p', { className: 'modal-msg' }, message),
        el('div', { className: 'flex gap-3' }, [cancelBtn, okBtn]),
      ]);
      // onClose fires on Esc / backdrop / × — treat as Cancel.
      modal(title, body, () => finish(false));
      // Default focus to Cancel (the safe choice for a destructive op).
      try { cancelBtn.focus(); } catch { /* jsdom */ }
    });
  }
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') e.innerHTML = v;
      // v1.20.0 — `htmlFor` is the React-style alias for `for` on
      // <label> elements. Translate to the real attribute so a11y
      // associations land correctly.
      // v1.22.0 (M-7) — null-guard mirrors the fallthrough branch so
      // `htmlFor: null` doesn't render `for="null"`.
      else if (k === 'htmlFor') { if (v != null && v !== false) e.setAttribute('for', v); }
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    if (children) {
      for (const c of [].concat(children)) {
        if (c == null || c === false) continue;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return e;
  }
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  /**
   * Tiny markdown→HTML renderer (no deps). Handles headings, bold, italic,
   * inline code, code blocks, lists, links, tables, blockquotes, hr.
   *
   * Safe-by-construction: every byte that comes from `src` is HTML-escaped
   * before any markdown transformation runs, so raw <script>, on*= handlers,
   * <img onerror=…> and friends can never reach innerHTML. Only the renderer
   * itself emits live tags. Link hrefs are validated against an allowlist
   * of safe schemes (http/https/mailto/tel/relative); javascript:, vbscript:,
   * and data:text/html are stripped.
   */
  function md(src) {
    if (!src) return '';
    let s = src.replace(/\r\n/g, '\n');

    // 1. Pull fenced code blocks out (their content is escaped, then stashed).
    const codeBlocks = [];
    s = s.replace(/```([a-z]*)\n([\s\S]*?)```/gi, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
      return ` CB${idx} `;
    });

    // 2. Escape EVERYTHING. After this, `<` and `"` are gone — the only HTML
    //    that can appear in the output is what the regex transformations emit.
    s = escapeHtml(s);

    // 3. Tables — cell text is already escaped, so inline() can run on it.
    s = s.replace(/((?:^\|.*\|\n)+)/gm, (block) => {
      const rows = block.trim().split('\n').map((r) =>
        r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      );
      if (rows.length < 2 || !rows[1].every((c) => /^:?-+:?$/.test(c))) return block;
      const head = rows[0];
      const body = rows.slice(2);
      return (
        '<table><thead><tr>' +
        head.map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>'
      );
    });
    // headings
    // Headings — pass through inline() so backticks become <code>,
    // **bold**/*italic* render, and link syntax works inside titles.
    // Without this, "## 2. CV (`#/cv`)" would render with literal
    // backticks, which is what users were seeing in the help page.
    s = s.replace(/^###### (.+)$/gm, (_, t) => '<h6>' + inline(t) + '</h6>')
         .replace(/^##### (.+)$/gm,  (_, t) => '<h5>' + inline(t) + '</h5>')
         .replace(/^#### (.+)$/gm,   (_, t) => '<h4>' + inline(t) + '</h4>')
         .replace(/^### (.+)$/gm,    (_, t) => '<h3>' + inline(t) + '</h3>')
         .replace(/^## (.+)$/gm,     (_, t) => '<h2>' + inline(t) + '</h2>')
         .replace(/^# (.+)$/gm,      (_, t) => '<h1>' + inline(t) + '</h1>');
    // hr
    s = s.replace(/^---+$/gm, '<hr/>');
    // blockquote — leading `>` is now `&gt;`
    s = s.replace(/(^&gt; .+(?:\n&gt; .+)*)/gm, (block) => {
      // v1.58.0 (QA BUG-003) — run inline() per line so **bold**,
      // `code`, *italic* and [links] render inside block-quotes too.
      // Content is already HTML-escaped at this stage, so inline() only
      // emits the same safe tags it does for headings/lists.
      return '<blockquote>' + block.split('\n').map((l) => inline(l.replace(/^&gt; ?/, ''))).join('<br/>') + '</blockquote>';
    });
    // lists
    s = s.replace(/(^(?:- |\* ).+(?:\n(?:- |\* ).+)*)/gm, (block) => {
      const items = block.split('\n').map((l) => l.replace(/^[-*] /, ''));
      return '<ul>' + items.map((i) => `<li>${inline(i)}</li>`).join('') + '</ul>';
    });
    // paragraphs
    s = s.split('\n\n').map((p) => {
      if (/^<(h\d|ul|ol|table|pre|blockquote|hr)/i.test(p.trim())) return p;
      if (!p.trim()) return '';
      return '<p>' + inline(p.replace(/\n/g, '<br/>')) + '</p>';
    }).join('\n');

    // 4. Restore code blocks.
    s = s.replace(/ CB(\d+) /g, (_, i) => codeBlocks[+i] || '');
    return s;

    function inline(text) {
      return text
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s])\*([^*]+)\*/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
          // url here was already escaped by escapeHtml; decode entities for scheme check.
          const decoded = url
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
          if (!isSafeUrl(decoded)) return label;
          return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        });
    }
  }

  function isSafeUrl(url) {
    const t = String(url || '').trim().toLowerCase();
    if (!t) return false;
    if (t.startsWith('javascript:')) return false;
    if (t.startsWith('vbscript:')) return false;
    if (t.startsWith('data:')) return /^data:image\/(png|jpe?g|gif|webp);/.test(t);
    // Allow http/https/mailto/tel and relative URLs (#, /, ./, ../).
    if (/^(https?:|mailto:|tel:|#|\/|\.\.?\/)/.test(t)) return true;
    // Reject everything else (file:, ftp:, blob:, etc.).
    return false;
  }

  /**
   * FIX-L1 — wrap any async action triggered by a button so the button
   * shows a busy state and refuses double-clicks while the request is in
   * flight. Returns the awaited result so callers stay simple.
   *
   *   await UI.withSpinner(btn, () => API.post('/api/run/normalize'));
   */
  async function withSpinner(button, fn) {
    if (!button || typeof fn !== 'function') return fn?.();
    const original = button.textContent;
    const wasDisabled = button.disabled;
    button.classList.add('is-loading');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    // Visual cue without a CSS dependency: swap the content for an hourglass.
    //
    // BUG-TB-SPIN (v1.231.3): snapshot the child NODES, not `textContent`.
    // Assigning `textContent` replaces every child with ONE text node, so a
    // button carrying element children lost them permanently on the first
    // click. That is exactly what the v1.231.2 top bar does — `.btn-ico` +
    // `.btn-label` spans, with the label hidden under `max-width: 900px` — so
    // one Doctor tap flattened the button to bare text, the mobile rules had
    // nothing left to match, and the row overflowed. Restoring the nodes keeps
    // every existing text-only call site behaving identically.
    //
    // v1.231.4: a button that HAS element children is not rewritten at all.
    // v1.231.3 restored the spans afterwards, but the in-flight state still
    // replaced them with the text '⏳ ' + label — so for the whole length of a
    // doctor run the top-bar square became a wide `⏳ 🩺Doctor` pill and the row
    // broke exactly as before, just transiently. Restoring the children fixed
    // the aftermath, not the moment. Those buttons carry their busy cue through
    // the `.is-loading` class instead, which the stylesheet already dims and
    // which now swaps the icon for an hourglass in CSS. Text-only buttons —
    // 23 of the 24 call sites — keep the prepended hourglass and are unchanged.
    const hasElementChild = Array.from(button.childNodes).some((n) => n.nodeType === 1);
    let savedChildren = null;
    if (original && !hasElementChild && !button.dataset.spinnerBusy && !button.querySelector('.spinner')) {
      savedChildren = Array.from(button.childNodes);
      button.dataset.spinnerBusy = '1';
      button.replaceChildren(document.createTextNode('⏳ ' + original));
    }
    try {
      return await fn();
    } finally {
      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
      button.disabled = wasDisabled;
      if (savedChildren) {
        button.replaceChildren(...savedChildren);
        delete button.dataset.spinnerBusy;
      }
    }
  }

  /**
   * Reusable paginator for list views (tracker, reports, activity, etc).
   *
   *   const pager = UI.paginate({ pageSize: 25, onChange: () => render() });
   *   const visible = pager.slice(filteredRows);
   *   container.appendChild(pager.controls(visible.length, filteredRows.length));
   *
   * Each call to slice() AUTOMATICALLY clamps the current page when the
   * underlying list shrinks (filter applied, items deleted), so the
   * caller never has to track that themselves.
   */
  function paginate(opts = {}) {
    const pageSize = Math.max(1, opts.pageSize || 25);
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};
    let page = 0;
    const t = (k, f) => (window.I18n && I18n.t) ? I18n.t(k, f) : f;
    function totalPages(total) {
      return Math.max(1, Math.ceil((total || 0) / pageSize));
    }
    function clamp(total) {
      const max = totalPages(total) - 1;
      if (page > max) page = max;
      if (page < 0) page = 0;
    }
    return {
      get page() { return page; },
      get pageSize() { return pageSize; },
      reset() { page = 0; },
      slice(arr) {
        const total = arr.length;
        clamp(total);
        const start = page * pageSize;
        return arr.slice(start, start + pageSize);
      },
      controls(visibleCount, totalCount) {
        const total = totalCount;
        const max = totalPages(total) - 1;
        const wrap = document.createElement('div');
        wrap.className = 'paginator';
        if (total <= pageSize) {
          // Hide the controls when everything fits on one page; still
          // show a "N items" hint so users don't think the bar is broken.
          wrap.appendChild(makeNode('span', 'pg-summary',
            `${total} ${t('common.items', 'items')}`));
          return wrap;
        }
        const prev = makeBtn('‹', t('pg.prev', 'Previous'), page === 0, () => {
          page = Math.max(0, page - 1); onChange();
        });
        const next = makeBtn('›', t('pg.next', 'Next'), page >= max, () => {
          page = Math.min(max, page + 1); onChange();
        });
        const first = makeBtn('«', t('pg.first', 'First'), page === 0, () => {
          page = 0; onChange();
        });
        const last = makeBtn('»', t('pg.last', 'Last'), page >= max, () => {
          page = max; onChange();
        });
        const start = page * pageSize + 1;
        const end = Math.min(total, start + visibleCount - 1);
        const summary = makeNode('span', 'pg-summary',
          `${start}–${end} ${t('pg.of', 'of')} ${total}`);
        wrap.append(first, prev, summary, next, last);
        return wrap;
      },
    };
    function makeBtn(label, title, disabled, onClick) {
      const b = document.createElement('button');
      b.className = 'btn btn-ghost btn-sm pg-btn';
      b.type = 'button';
      b.textContent = label;
      b.title = title;
      b.disabled = !!disabled;
      b.addEventListener('click', onClick);
      return b;
    }
    function makeNode(tag, cls, text) {
      const e = document.createElement(tag);
      e.className = cls;
      e.textContent = text;
      return e;
    }
  }

  // v1.56.0 — UX-10: an honest "what will ⚡ Run live cost?" hint,
  // shared by #/auto, #/evaluate, #/deep and #/<mode>. Reuses
  // GET /api/status/providers (v1.55.3). Returns a node that fills
  // async: the active provider + model + a rough per-eval estimate,
  // or a clear no-cost note when there's no key (manual-prompt mode).
  // The "~" wording keeps it a ballpark, never a quote.
  function providerCostHint(t) {
    const tr = typeof t === 'function' ? t : (_k, f) => f;
    const node = document.createElement('div');
    node.className = 'cost-hint';
    node.setAttribute('role', 'note');
    // M-7 (v1.58.12) — provider → display name + order-of-magnitude USD
    // per evaluation (one call, long JD + bundled CV context). The
    // cost line must follow the active provider returned by
    // /api/status/providers; v1.58.3 MASTER regression observed it
    // stayed pinned to "Anthropic claude-sonnet-4-6 · ~$0.05/eval"
    // because OpenRouter wasn't in the maps and fell through to a
    // generic 0.03 fallback. Now openrouter has its own slot, and a
    // `null` cost (= the router picks the model, cost varies) renders
    // a "cost varies" note instead of a misleading hard number.
    const EST = {
      anthropic:  0.05,
      gemini:     0.01,
      openai:     0.04,
      qwen:       0.01,
      openrouter: null, // router picks the model — cost varies
    };
    const NAME = {
      anthropic:  'Anthropic',
      gemini:     'Gemini',
      openai:     'OpenAI',
      qwen:       'Qwen',
      openrouter: 'OpenRouter',
    };
    // UX-D-I (v1.58.41) — extract the render to a named refresh so we
    // can re-run it when the provider changes externally. Without this,
    // the cost line shows whatever provider was active when the view
    // mounted; if the user opens #/config in another tab, picks a
    // different provider, and switches back to this tab, the cost line
    // would silently lie. Now it re-fetches on `visibilitychange`
    // (tab gets focus back) and on a custom `providers-changed`
    // CustomEvent that the #/config save path can dispatch.
    async function refreshCostLine() {
      let st = null;
      try {
        const r = await fetch('/api/status/providers');
        if (r.ok) st = await r.json();
      } catch { /* offline → say nothing */ }
      if (!st) { node.hidden = true; return; }
      node.hidden = false;
      if (!st.activeProvider) {
        node.textContent = tr('cost.manual',
          'No LLM key set — “⚡ Run live” copies a manual prompt (no API cost).');
        return;
      }
      const has = Object.prototype.hasOwnProperty.call(EST, st.activeProvider);
      const name = NAME[st.activeProvider] || st.activeProvider;
      const prefix = tr('cost.estimate', 'Estimated cost') + ': ' + name +
        (st.activeModel ? ' ' + st.activeModel : '');
      if (has && EST[st.activeProvider] != null) {
        node.textContent = prefix + ' · ~$' + EST[st.activeProvider].toFixed(2) + '/eval';
      } else if (has && EST[st.activeProvider] === null) {
        // Known provider whose per-eval cost depends on the routed
        // model (OpenRouter today). Be honest, never quote a fixed
        // number that might be wrong.
        node.textContent = prefix + ' · ' + tr('cost.varies', 'cost varies (router picks)');
      } else {
        // Unknown provider — show the name but omit a fabricated number.
        node.textContent = prefix;
      }
    }
    refreshCostLine();
    const onVisibility = () => { if (!document.hidden) refreshCostLine(); };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('providers-changed', refreshCostLine);
    return node;
  }

  return { toast, dismissToast, modal, closeModal, confirm, el, escapeHtml, md, withSpinner, paginate, providerCostHint, getToastHistory, onToast, clearToastHistory, dismissToastHistory };
})();
