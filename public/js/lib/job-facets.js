/* global window */
/**
 * job-facets.js — zero-token job "facet" derivations.
 *
 * window.JobFacets exposes three PURE, client-side functions. Every signal is
 * FREE — parsed from data a raw posting already carries (URL host, title text,
 * a first_seen ISO date). No LLM, no network, no ranking — they only label and
 * bucket so cheap facet filters can narrow the firehose with zero tokens.
 *
 * CSP-safe: no DOM, no eval, no inline handlers. Null/empty-safe throughout.
 */
(function () {
  // Which ATS/source a posting lives on, from its URL host. Anchored at a dot
  // boundary (host === base OR host ends with ".base") so "notgreenhouse.com"
  // or "greenhouse.io.evil.com" can't be misread as that source. Source names
  // mirror the scanner registry `meta.value` fields (server/lib/sources/*.mjs)
  // and the shared-ATS host list in public/js/lib/company-logo.js, so the two
  // surfaces agree. Order: most specific host first.
  var SOURCE_HOSTS = [
    ['greenhouse.io', 'greenhouse'],
    ['lever.co', 'lever'],
    ['ashbyhq.com', 'ashby'],
    ['myworkdayjobs.com', 'workday'],
    ['workday.com', 'workday'],
    ['smartrecruiters.com', 'smartrecruiters'],
    ['teamtailor.com', 'teamtailor'],
    ['recruitee.com', 'recruitee'],
    ['workable.com', 'workable'],
    ['bamboohr.com', 'bamboohr'],
    ['jobvite.com', 'jobvite'],
    ['icims.com', 'icims'],
    ['successfactors.com', 'successfactors'],
    ['avature.net', 'avature'],
    ['breezy.hr', 'breezy'],
    ['personio.de', 'personio'],
    ['pinpointhq.com', 'pinpoint'],
    ['rippling.com', 'rippling'],
    ['oraclecloud.com', 'oraclecloud'],
  ];

  /** The source name for a posting URL, or null if the host is unknown/unparseable. */
  function sourceFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    var host;
    try { host = new URL(url).hostname.toLowerCase(); } catch (e) { return null; }
    for (var i = 0; i < SOURCE_HOSTS.length; i++) {
      var base = SOURCE_HOSTS[i][0];
      if (host === base || host.endsWith('.' + base)) return SOURCE_HOSTS[i][1];
    }
    return null;
  }

  // Coarse seniority buckets, senior→junior, detected from the title. A title
  // that matches no keyword at all gets null (still shows, just untagged); a
  // generic IC role with none of the ladder words sits in the broad "mid".
  var SENIORITY_ORDER = ['lead', 'staff', 'senior', 'mid', 'junior', 'intern'];

  /**
   * Bucket a job title into a seniority band, or null when nothing matches.
   *
   * EXPLICIT seniority modifiers (staff / senior / junior / intern) are tested
   * BEFORE the role-level "lead" bucket, so a modifier is never swallowed by a
   * management word: "Senior Engineering Manager" → 'senior', "Staff Manager" →
   * 'staff', while a bare "Engineering Manager" (no modifier) → 'lead'. Staff
   * outranks senior ("Senior Staff Engineer" → 'staff').
   */
  function seniorityFromTitle(title) {
    if (!title || typeof title !== 'string') return null;
    var t = ' ' + title.toLowerCase() + ' ';
    if (/\b(staff|principal|distinguished|fellow|architect)\b/.test(t)) return 'staff';
    if (/\b(senior|sr\.?|snr)\b/.test(t)) return 'senior';
    if (/\b(junior|jr\.?|entry|graduate|associate)\b/.test(t)) return 'junior';
    if (/\b(intern|internship|working student|apprentice)\b/.test(t)) return 'intern';
    if (/\b(head|vp|vice president|director|chief|manager|mgr|lead)\b/.test(t)) return 'lead';
    if (/\b(engineer|developer|scientist|designer|analyst|specialist|consultant)\b/.test(t)) return 'mid';
    return null;
  }

  /** Whole days between an ISO date (YYYY-MM-DD) and `now` (ms, default now); null if unparseable. */
  function daysSince(iso, now) {
    if (!iso || typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    var t = Date.parse(iso + 'T00:00:00Z');
    if (Number.isNaN(t)) return null;
    var ref = typeof now === 'number' ? now : Date.now();
    return Math.floor((ref - t) / 86400000);
  }

  window.JobFacets = {
    seniorityFromTitle: seniorityFromTitle,
    sourceFromUrl: sourceFromUrl,
    daysSince: daysSince,
    SENIORITY_ORDER: SENIORITY_ORDER,
  };
})();
