/* global window */
/**
 * StatusClass — the ONE status → CSS-badge classifier (FULL-M6).
 *
 * tracker.js (`trackerStatusClass`) and dashboard.js (`statusClass`) each
 * carried their own copy and they had DIVERGED: the dashboard copy had no
 * Hired branch, so a Hired row on the dashboard lost the celebratory tint
 * the tracker always gave it. Both views now read this namespaced lib —
 * which also keeps the CAR-93 window-binding collision impossible (no
 * top-level `function statusClass` in any classic script).
 */
window.StatusClass = (function () {
  function of(s) {
    s = (s || '').toLowerCase();
    // v1.118.0 — parent v1.18.0 parity: Hired (job landed) gets the celebratory tint.
    if (s.includes('hired')) return 'badge-hired';
    if (s.includes('offer')) return 'badge-ok';
    if (s.includes('reject') || s.includes('discard')) return 'badge-bad';
    if (s.includes('interview') || s.includes('respond')) return 'badge-info';
    if (s.includes('skip')) return 'badge-warn';
    return '';
  }
  return { of };
})();
