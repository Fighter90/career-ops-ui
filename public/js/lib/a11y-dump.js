/**
 * a11y-dump.js — accessible names for read-only generated-output areas (CAR-209).
 *
 * Readonly <textarea> dumps that carry a generated prompt or a result had no
 * programmatic label, so screen readers announced an unnamed "edit text"
 * region. `A11yDump.label(el, labelText)` gives one a plain localized
 * accessible name. The element stays focusable — readonly is not disabled.
 *
 * Usage (views):
 *   A11yDump.label(ta, t('a11y.readonlyOutput', 'Generated result — read only'));
 *
 * The tests/a11y-form-wires gate treats a file that calls A11yDump.label as
 * having named its readonly textareas — keep the call next to the creation.
 */
(function () {
  'use strict';
  function label(el, labelText) {
    if (el && labelText != null && labelText !== '') {
      el.setAttribute('aria-label', String(labelText));
    }
    return el;
  }
  window.A11yDump = { label };
})();
