/* global window */
/**
 * CompanyPresentation (v1.227.0) — human-facing employer identity for a
 * tracker row. Mirrors the parent career-ops `company-presentation.mjs`.
 *
 * The tracker's canonical `company` field is the END EMPLOYER. A confidential
 * posting records it as the literal `?`, and the agency or recruiter that
 * fronted it goes in the `Via` column instead (web-ui already parses that
 * column — see the `via` header alias in server/lib/parsers.mjs).
 *
 * Rendering `?` raw leaves the user staring at a question mark with no way to
 * tell which of several confidential rows is which. So a `?` row is presented
 * as its intermediary — "Confidential · via <agency>" — and the LOGO is
 * resolved from the agency name rather than from `?`, which no domain
 * heuristic could ever match.
 *
 * The substitution is presentation only: `?` must NEVER be written back over
 * the canonical company field, or the tracker would start claiming the
 * recruiter is the employer.
 *
 * Labels are returned in English; the caller translates (see the
 * `track.confidential*` keys). `confidential`/`via` are exposed so a view can
 * build its own localized string without re-deriving the decision.
 *
 * Pure and side-effect free — also imported by tests/company-presentation.test.mjs
 * through a tiny shim, so the browser and Node assert the same behavior.
 */
(function (root) {
  // Placeholders that mean "no intermediary, this was a direct application".
  // Treating them as an agency name would render "Confidential · via —".
  var DIRECT_VIA = /^(n\/?a|tbd|none|null|-|—|–)$/i;

  /**
   * @param {{company?: string, via?: string}} application
   * @returns {{label: string, logoName: string, confidential: boolean, via: string}}
   */
  function companyPresentation(application) {
    var app = application || {};
    var companyName = String(app.company == null ? '' : app.company).trim();
    var intermediary = String(app.via == null ? '' : app.via).trim();

    if (companyName !== '?') {
      var asIs = app.company == null ? '' : app.company;
      return { label: asIs, logoName: asIs, confidential: false, via: '' };
    }
    if (intermediary && !DIRECT_VIA.test(intermediary)) {
      return {
        label: 'Confidential · via ' + intermediary,
        logoName: intermediary,
        confidential: true,
        via: intermediary,
      };
    }
    return {
      label: 'Confidential employer',
      logoName: 'Confidential employer',
      confidential: true,
      via: '',
    };
  }

  /**
   * Free-text haystack for the tracker's search box. Includes the raw `?` and
   * the `via` name as well as the rendered label, so a user can find the row
   * by the agency they actually dealt with.
   * @param {{company?: string, via?: string, role?: string}} application
   */
  function companySearchText(application) {
    var app = application || {};
    var label = companyPresentation(app).label;
    return [app.company == null ? '' : app.company,
      app.via == null ? '' : app.via,
      label,
      app.role == null ? '' : app.role].join(' ');
  }

  root.CompanyPresentation = {
    companyPresentation: companyPresentation,
    companySearchText: companySearchText,
  };
}(typeof window !== 'undefined' ? window : globalThis));
