/* global API, UI, I18n */
/**
 * docs-fab.js (v1.113.0) — a floating "Ask the docs" assistant.
 *
 * A robot chat launcher pinned to the bottom-right (bottom-left in RTL) on
 * EVERY page. Clicking it opens a compact chat panel that talks to the same
 * grounded endpoint as `#/docs-assistant` (`POST /api/docs-assistant/ask`):
 * answers come ONLY from the in-app help guide in the current language, never
 * from the user's CV / profile / tracker. Live with an LLM key; no key → the
 * ready-to-run prompt is handed off in a modal.
 *
 * CSP-safe by construction: no inline handlers, DOM built with `UI.el`, answer
 * markdown routed through `UI.md()` (the escape-first render boundary). Static
 * labels carry `data-i18n*` attributes so `app.js::applyI18n()` re-localizes
 * them on boot and on every language switch. Self-contained — the only wiring
 * is the `<script>` tag in index.html; it mounts itself into `document.body`.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  // The robot glyph — an inline SVG (stroke = currentColor) so it inherits the
  // button's colour in light/dark and needs no external asset (CSP).
  var ROBOT_SVG =
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<rect x="4" y="8" width="16" height="11" rx="3"/>' +
    '<path d="M12 4v4"/><circle cx="12" cy="3" r="1.4"/>' +
    '<circle cx="9" cy="13" r="1.2"/><circle cx="15" cy="13" r="1.2"/>' +
    '<path d="M9.5 16.2h5"/><path d="M2.5 12v3"/><path d="M21.5 12v3"/></svg>';
  var CLOSE_SVG =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">' +
    '<path d="M6 6l12 12M18 6L6 18"/></svg>';
  var SEND_SVG =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  // Launcher glyph — a white speech bubble on the gradient circle (per the
  // requested look). The robot lives in the panel header as the assistant avatar.
  var BUBBLE_SVG =
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6a8.5 8.5 0 0 1-.9-3.9A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/></svg>';
  // Decorative starter-chip glyphs (emoji — purely visual, label carries meaning).
  var STARTER_ICONS = ['🔍', '🎯', '📄'];

  function t(k, f) { return (window.I18n && I18n.t) ? I18n.t(k, f) : f; }
  function el() { return (window.UI && UI.el) ? UI.el.apply(UI, arguments) : null; }

  var launcher, panel, log, input, sendBtn, greeted = false;

  function bubble(kind, node) {
    var mine = kind === 'me';
    return el('div', { className: 'docs-fab__bubble docs-fab__bubble--' + (mine ? 'me' : 'bot') }, node);
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    log.appendChild(bubble('bot', el('span', null, t('fab.greeting',
      'Hi! Ask me how to use anything in the app — I answer from the help guide in your language.'))));
    var starters = [
      t('docs.q1', 'How do I scan job portals?'),
      t('docs.q2', 'How does the two-pager fit score work?'),
      t('docs.q3', 'How do I export a report to PDF?'),
    ];
    var chips = el('div', { className: 'docs-fab__chips' }, starters.map(function (q, i) {
      var b = el('button', { className: 'docs-fab__chip', type: 'button' }, [
        el('span', { className: 'docs-fab__chip-ic', 'aria-hidden': 'true' }, STARTER_ICONS[i] || '💬'),
        el('span', null, q),
      ]);
      b.addEventListener('click', function () { input.value = q; send(); });
      return b;
    }));
    log.appendChild(chips);
  }

  async function send() {
    var question = (input.value || '').trim();
    if (question.length < 3) { if (window.UI && UI.toast) UI.toast(t('docs.needQ', 'Type a question first'), 'error'); return; }
    input.value = '';
    log.appendChild(bubble('me', el('span', null, question)));
    sendBtn.disabled = true;
    var pending = bubble('bot', el('span', { style: { color: 'var(--foggy)' } }, t('docs.thinking', 'Searching the guide…')));
    log.appendChild(pending);
    pending.scrollIntoView({ block: 'end' });
    try {
      var res = await API.post('/api/docs-assistant/ask', { question: question, run: true });
      pending.remove();
      if (res && res.answer) {
        var parts = [el('div', { className: 'md', html: UI.md(res.answer) })];
        if (Array.isArray(res.sections) && res.sections.length) {
          parts.push(el('div', { className: 'docs-fab__src' },
            (t('docs.fromSections', 'From') + ': ' + res.sections.join(' · '))));
        }
        log.appendChild(bubble('bot', el('div', null, parts)));
      } else if (res && res.prompt) {
        var body = el('div', null, [
          el('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } },
            t('docs.manualHelp', 'No LLM key is set. Copy this prompt (it already contains the relevant help sections) into any assistant to get your answer.')),
          el('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, res.prompt),
        ]);
        if (window.UI && UI.modal) UI.modal(t('docs.title', 'Ask the docs'), body);
        log.appendChild(bubble('bot', el('span', { style: { color: 'var(--foggy)' } },
          t('docs.manualBubble', 'No API key set — I opened a ready-to-run prompt you can paste into any assistant.'))));
      } else {
        log.appendChild(bubble('bot', el('span', { style: { color: 'var(--foggy)' } }, t('docs.err', 'Something went wrong. Try again.'))));
      }
    } catch (e) {
      pending.remove();
      log.appendChild(bubble('bot', el('span', { style: { color: 'var(--foggy)' } },
        (t('docs.err', 'Something went wrong. Try again.') + ' (' + ((e && e.message) || e) + ')'))));
    } finally {
      sendBtn.disabled = false;
      log.scrollTop = log.scrollHeight;
      if (input && input.focus) input.focus();
    }
  }

  function isOpen() { return panel && !panel.hidden; }

  function open() {
    if (!panel) return;
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    greet();
    if (input && input.focus) setTimeout(function () { input.focus(); }, 30);
  }
  function close() {
    if (!panel) return;
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    if (launcher && launcher.focus) launcher.focus();
  }
  function toggle() { isOpen() ? close() : open(); }

  // The assistant already has a full page at #/docs-assistant — hide the
  // floating launcher there to avoid a duplicate entry point.
  function syncRouteVisibility() {
    if (!launcher) return;
    var onDocsPage = (location.hash || '').replace(/^#\/?/, '').split('?')[0] === 'docs-assistant';
    launcher.style.display = onDocsPage ? 'none' : '';
    if (onDocsPage && isOpen()) close();
  }

  function build() {
    if (!window.UI || !UI.el || document.getElementById('docs-fab')) return;

    launcher = el('button', {
      id: 'docs-fab', className: 'docs-fab', type: 'button',
      'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'docs-fab-panel',
      'data-i18n-aria-label': 'fab.open', 'data-i18n-title': 'fab.open',
      'aria-label': t('fab.open', 'Ask the docs assistant'), title: t('fab.open', 'Ask the docs assistant'),
    });
    launcher.innerHTML = BUBBLE_SVG;
    launcher.addEventListener('click', toggle);

    var closeBtn = el('button', {
      className: 'docs-fab__close', type: 'button',
      'data-i18n-aria-label': 'fab.close', 'aria-label': t('fab.close', 'Close'),
    });
    closeBtn.innerHTML = CLOSE_SVG;
    closeBtn.addEventListener('click', close);

    var avatar = el('span', { className: 'docs-fab__avatar', 'aria-hidden': 'true' });
    avatar.innerHTML = ROBOT_SVG;
    var head = el('div', { className: 'docs-fab__head' }, [
      avatar,
      el('div', { className: 'docs-fab__head-meta' }, [
        el('span', { className: 'docs-fab__title', 'data-i18n': 'fab.title' }, t('fab.title', 'Ask the docs')),
        el('span', { className: 'docs-fab__status' }, [
          el('span', { className: 'docs-fab__dot', 'aria-hidden': 'true' }),
          el('span', { 'data-i18n': 'fab.status' }, t('fab.status', 'Help assistant')),
        ]),
      ]),
      closeBtn,
    ]);

    log = el('div', { className: 'docs-fab__log', role: 'log', 'aria-live': 'polite' });

    input = el('input', {
      type: 'text', className: 'input docs-fab__input',
      'data-i18n-placeholder': 'docs.ph', 'data-i18n-aria-label': 'docs.title',
      'aria-label': t('docs.title', 'Ask the docs'),
    });
    input.placeholder = t('docs.ph', 'Ask a question about using the app…');
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); send(); } });

    sendBtn = el('button', {
      className: 'docs-fab__send', type: 'button',
      'data-i18n-aria-label': 'docs.ask', 'aria-label': t('docs.ask', 'Ask'),
    });
    sendBtn.innerHTML = SEND_SVG;
    sendBtn.addEventListener('click', send);

    var bar = el('div', { className: 'docs-fab__bar' }, [input, sendBtn]);

    panel = el('div', {
      id: 'docs-fab-panel', className: 'docs-fab__panel', role: 'dialog', 'aria-modal': 'false',
      'aria-label': t('fab.title', 'Ask the docs'), hidden: true,
    }, [head, log, bar]);

    document.body.appendChild(panel);
    document.body.appendChild(launcher);

    // Escape closes; a click outside the panel + launcher closes.
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && isOpen()) close(); });
    document.addEventListener('click', function (ev) {
      if (!isOpen()) return;
      if (panel.contains(ev.target) || launcher.contains(ev.target)) return;
      close();
    });
    window.addEventListener('hashchange', syncRouteVisibility);
    syncRouteVisibility();
  }

  function init() { build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.DocsFab = { open: open, close: close, toggle: toggle, _build: build };
})();
