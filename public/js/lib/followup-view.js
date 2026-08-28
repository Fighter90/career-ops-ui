/* global window */
/**
 * FollowupView (v1.227.0) — which follow-ups are actionable RIGHT NOW.
 * Mirrors the parent career-ops `web/src/lib/core/followup-view.mjs`.
 *
 * followup-cadence.mjs is the single source of truth for cadence: it already
 * classifies every actionable application into an `urgency` of 'urgent',
 * 'overdue', 'waiting' or 'cold', and its own --overdue-only flag treats
 * 'urgent'/'overdue' as due. web-ui's cadence board relays that script
 * verbatim (GET /api/followup) and listed every entry, so a long tracker
 * buried the two rows that actually needed a nudge today under dozens of
 * 'waiting' ones.
 *
 * The `urgency` field — never the tracker `status` (applied / responded /
 * interview, which is never "overdue") — is what decides due-ness. Keeping
 * that decision in one place is what stops the board and any future consumer
 * from drifting apart, and from re-inventing a status-based filter that
 * silently matches nothing.
 *
 * Pure and side-effect free; asserted against the same cases in
 * tests/followup-view.test.mjs.
 */
(function (root) {
  var DUE_URGENCIES = { urgent: true, overdue: true };
  // Most urgent first; anything not due sorts last.
  var URGENCY_ORDER = { urgent: 0, overdue: 1 };

  /** True when a followup-cadence.mjs entry is actionable right now. */
  function isDue(entry) {
    return !!(entry && DUE_URGENCIES[entry.urgency]);
  }

  /** Due entries only (urgent/overdue), most urgent first, capped at `limit`. */
  function selectDueFollowups(entries, limit) {
    var cap = typeof limit === 'number' ? limit : 8;
    return (Array.isArray(entries) ? entries : [])
      .filter(isDue)
      .sort(function (a, b) {
        var av = URGENCY_ORDER[a.urgency]; var bv = URGENCY_ORDER[b.urgency];
        return (av === undefined ? 9 : av) - (bv === undefined ? 9 : bv);
      })
      .slice(0, cap);
  }

  /**
   * Sortable timestamp for an entry's nextFollowupDate, or Infinity when the
   * date is missing or unparseable — never NaN, which would corrupt the
   * comparator instead of just sorting the entry last. Ranking by the parsed
   * date rather than the precomputed daysUntilNext keeps the order correct
   * even when daysUntilNext was not populated: with it, every such entry ties
   * at Infinity and a stable sort merely preserves input order.
   */
  function nextDateValue(entry) {
    var t = entry && entry.nextFollowupDate ? Date.parse(entry.nextFollowupDate) : NaN;
    return isNaN(t) ? Infinity : t;
  }

  /**
   * The single nearest not-yet-due follow-up, for the empty state ("nothing is
   * due, but here is what is next") — never mislabeled as due. Entries with no
   * nextFollowupDate (cold, or no cadence at all) are excluded. Returns null
   * when there is nothing upcoming.
   */
  function pickNextUpcoming(entries) {
    var upcoming = (Array.isArray(entries) ? entries : [])
      .filter(function (e) { return !isDue(e) && e && e.nextFollowupDate; })
      .sort(function (a, b) { return nextDateValue(a) - nextDateValue(b); });
    return upcoming.length ? upcoming[0] : null;
  }

  root.FollowupView = {
    isDue: isDue,
    selectDueFollowups: selectDueFollowups,
    pickNextUpcoming: pickNextUpcoming,
  };
}(typeof window !== 'undefined' ? window : globalThis));
