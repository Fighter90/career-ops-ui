/* global UI, I18n */
/**
 * HelpHint — a reusable, CSP-safe `?` help affordance (v1.139.0).
 *
 * `HelpHint.icon(key)` returns a small round `?` button. Clicking it opens a
 * lightweight popover that renders the localized markdown at `I18n.t(key)`
 * (optionally a bold title from `I18n.t(key + '.t')`). It's the "Rejection
 * patterns (?)" pattern — a deeper "what this does / how it works / what to
 * expect" than the always-visible page subtitle.
 *
 * Design constraints honored:
 *  - CSP-safe: every handler via addEventListener (no inline on*), body rendered
 *    through `UI.md()` (escape-first), icons are static text.
 *  - Accessible: the button is a real <button> with aria-expanded + aria-label;
 *    the popover is role="tooltip"; Escape and outside-click close it; focus
 *    returns to the button on close.
 *  - Theme-aware + RTL: positioning flips under [dir="rtl"]; colors are tokens.
 *  - Singleton: at most one popover open at a time (opening another / clicking
 *    the same icon toggles).
 *
 * No dependency beyond window.UI (el/md) and window.I18n (t). Loaded from
 * index.html before the views that use it.
 */
(function () {
  'use strict';
  const c = (t, a, ch) => UI.el(t, a, ch);

  let current = null; // { pop, btn }

  function close() {
    if (!current) return;
    const { pop, btn } = current;
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', close, true);
    if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
    if (btn) { btn.setAttribute('aria-expanded', 'false'); try { btn.focus(); } catch { /* detached */ } }
    current = null;
  }

  function onDocClick(e) {
    if (!current) return;
    if (current.pop.contains(e.target) || current.btn.contains(e.target)) return;
    close();
  }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }

  /** Place the popover under the icon, clamped to the viewport; RTL-mirrored. */
  function position(pop, btn) {
    const r = btn.getBoundingClientRect();
    const rtl = (document.documentElement.getAttribute('dir') === 'rtl');
    const margin = 8;
    const pw = Math.min(pop.offsetWidth || 300, window.innerWidth - margin * 2);
    pop.style.maxWidth = pw + 'px';
    // horizontal: align the popover's near edge to the icon, then clamp
    let left = rtl ? (r.right - pw) : r.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
    // vertical: below the icon, or above if it would overflow the bottom
    const ph = pop.offsetHeight || 0;
    let top = r.bottom + 6;
    if (top + ph > window.innerHeight - margin && r.top - ph - 6 > margin) top = r.top - ph - 6;
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';
  }

  function open(btn, key) {
    close();
    const titleKey = key + '.t';
    const title = I18n.t(titleKey, '');
    const body = I18n.t(key, '');
    const pop = c('div', { className: 'help-pop', role: 'tooltip' }, [
      (title && title !== titleKey) ? c('div', { className: 'help-pop-title' }, title) : null,
      c('div', { className: 'help-pop-body md', html: UI.md(body || '') }),
    ].filter(Boolean));
    document.body.appendChild(pop);
    position(pop, btn);
    btn.setAttribute('aria-expanded', 'true');
    current = { pop, btn };
    // defer listener attach so the opening click doesn't immediately close it
    setTimeout(() => {
      if (!current) return;
      document.addEventListener('click', onDocClick, true);
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('resize', close);
      window.addEventListener('scroll', close, true);
    }, 0);
  }

  /**
   * Return a `?` button bound to help key `key`. `opts.label` overrides the
   * accessible name (defaults to the localized "Help — {section}" when
   * `opts.sectionKey` is given, else a generic "More info").
   */
  function icon(key, opts) {
    const o = opts || {};
    const aria = o.label
      || (o.sectionLabel ? `${I18n.t('help.hint.aria', 'More info')}: ${o.sectionLabel}` : I18n.t('help.hint.aria', 'More info'));
    const btn = c('button', {
      className: 'help-hint',
      type: 'button',
      'aria-label': aria,
      'aria-expanded': 'false',
      title: aria,
    }, '?');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (current && current.btn === btn) { close(); return; }
      open(btn, key);
    });
    return btn;
  }

  /**
   * Convenience: an `<h1 class="page-title">` carrying `text` plus a trailing
   * `?` help affordance bound to `key`. Views swap their bare page-title h1 for
   *   HelpHint.title(titleText, hintKey)
   * so the hint sits inline with the page heading (titleText usually being the
   * view's existing localized title string).
   */
  function title(text, key) {
    return c('h1', { className: 'page-title', style: { display: 'flex', alignItems: 'center', flexWrap: 'wrap' } }, [
      c('span', null, text),
      icon(key, { sectionLabel: text }),
    ]);
  }

  window.HelpHint = { icon, title, close };
})();
