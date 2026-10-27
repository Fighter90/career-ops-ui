/* global window, document */
/**
 * FocusPreserved — the ONE shared withFocusPreserved (FULL-M6).
 *
 * tracker.js, reports.js and stats.js each carried a byte-identical
 * file-local copy (L-FOCUS, v1.243.0; marker keyed on data-key/aria-label
 * since CAR-93 — the tag|class|text marker was IDENTICAL for the same
 * control on every row, so focus jumped to row 1). Snapshot the focused
 * element among the container's focusable descendants, let mutate()
 * rebuild, then restore focus to the matching node. No-op when focus is
 * outside the container.
 */
window.FocusPreserved = (function () {
  function withFocusPreserved(container, mutate) {
    // data-key (row-scoped controls carry one) or aria-label before falling
    // back to the text — text alone is shared by every row's button.
    const markOf = (el) => el.tagName + '|' + el.className + '|'
      + ((el.getAttribute && (el.getAttribute('data-key') || el.getAttribute('aria-label'))) || '')
      + '|' + (el.textContent || '');
    let marker = null;
    try {
      const doc = container.ownerDocument || document;
      const active = doc.activeElement;
      if (active && active !== container && container.contains(active)) {
        marker = markOf(active);
      }
    } catch { marker = null; }
    mutate();
    if (!marker) return;
    const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let candidates = [];
    try { candidates = Array.from(container.querySelectorAll(sel)); } catch { return; }
    for (const el of candidates) {
      if (markOf(el) === marker) {
        try { el.focus(); } catch { /* detached node */ }
        return;
      }
    }
  }

  return { withFocusPreserved };
})();
