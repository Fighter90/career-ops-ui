/* window.TrackerStages — pure helpers for the #/tracker CRM stage-tab board
 * (v1.131.0, ported from the parent web/ `/pipeline` view).
 *
 * The canonical funnel (stage labels in order) and the alias-fold map both come
 * from the server (GET /api/tracker/stages → server/lib/states.mjs, which reads
 * templates/states.yml). The client NEVER hardcodes the status whitelist — that
 * is the v1.128.0 doctrine. These helpers only bucket rows against whatever the
 * server sent, so a parent that renames or reorders a stage flows through with
 * no client change.
 *
 * No DOM, no globals beyond the assigned window property — safe to unit-test in
 * a synthetic window (see tests/tracker-stages.test.mjs).
 */
window.TrackerStages = (function () {
  // Normalize a raw status the same way the server keys its alias map: strip
  // stray markdown bold, trim, lowercase. Kept in sync with the endpoint's
  // key-building so "**Applied**" and "aplicado" both resolve.
  function norm(s) {
    return String(s == null ? '' : s).replace(/\*/g, '').trim().toLowerCase();
  }

  // Fold a row's raw status to its canonical stage label using the server alias
  // map. An unknown status is returned RAW (never invented into a stage) so it
  // still counts under ALL but lands in no canonical tab.
  function foldStatus(raw, aliases) {
    const k = norm(raw);
    if (!k) return '';
    if (aliases && Object.prototype.hasOwnProperty.call(aliases, k)) return aliases[k];
    return raw == null ? '' : String(raw);
  }

  // { <stageLabel>: n } for EVERY stage the server sent — including zero-count
  // stages, which is what gives the board its full-funnel CRM look. Unknown
  // statuses are ignored here (they surface only in the ALL count the caller
  // derives from rows.length).
  function stageCounts(rows, stages, aliases) {
    const counts = {};
    (stages || []).forEach(function (s) { counts[s] = 0; });
    (rows || []).forEach(function (r) {
      const folded = foldStatus(r && r.status, aliases);
      if (Object.prototype.hasOwnProperty.call(counts, folded)) counts[folded] += 1;
    });
    return counts;
  }

  return { norm: norm, foldStatus: foldStatus, stageCounts: stageCounts };
})();
