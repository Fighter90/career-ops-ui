/* window.Skeleton — CAR-112 loading placeholders.
 *
 * Renders N grey shimmer rows (<div class="skeleton-row">) where a bare
 * «Loading…» text — or a blank table — used to sit while a view's data
 * fetch was in flight (#/tracker board, #/scan results + reposts panel,
 * #/map shell). Pure layout hints: no data, no i18n — the localized
 * announcement stays with the CALLER, which wraps the rows in a
 * role="status" block whose aria-label reuses an existing key
 * (t('common.loading')). The shimmer animation lives in overlays.css and
 * is disabled under prefers-reduced-motion.
 */
window.Skeleton = (function () {
  // Row count is clamped to a small sane range so a caller bug can
  // neither paint zero feedback nor thousands of divs.
  var MIN_ROWS = 1;
  var MAX_ROWS = 24;

  function rows(n) {
    var count = Math.min(Math.max(Number(n) || 0, MIN_ROWS), MAX_ROWS);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var row = document.createElement('div');
      row.className = 'skeleton-row';
      row.setAttribute('aria-hidden', 'true');
      // Staggered widths read as the rows of a list/table, not one striped
      // banner. Deterministic — no layout shift between renders.
      row.style.width = (94 - (i % 5) * 9) + '%';
      frag.appendChild(row);
    }
    return frag;
  }

  // A polite loading region: the caller's localized label (an EXISTING
  // i18n key) is announced once; sighted users see the shimmer rows.
  function block(n, label) {
    var d = document.createElement('div');
    d.className = 'skeleton-block';
    d.setAttribute('role', 'status');
    if (label) d.setAttribute('aria-label', String(label));
    d.appendChild(rows(n));
    return d;
  }

  return { rows: rows, block: block };
})();
