/* global window */
/**
 * cv-privacy.js — deterministic PII masking for a CV (v1.92.0, Epic 21).
 *
 * window.CvPrivacy.mask(markdown, opts) redacts personally-identifying data so
 * a CV can be shared as a sample or screenshot without leaking the live job
 * search: email, phone, URLs/handles, street address, and (optionally) the
 * candidate's name → initials. Pure and client-side — nothing leaves the
 * browser. Reversible only by the user (it does not store the original).
 *
 * opts: { email=true, phone=true, links=true, address=true, name=false }
 *   name masking needs the candidate's full name (opts.name = "Jane Q. Public")
 *   so we can replace it with initials ("J.Q.P.") wherever it appears.
 */
(function () {
  const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
  // Phone: an optional +CC, optional (area), then digit groups. The ≥7-digit
  // guard in the callback rejects plain year/version runs (2019, v2.0).
  const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]?\d{2,4}){1,4}/g;
  const URL_RE = /\b((?:https?:\/\/|www\.)[^\s)]+)\b/gi;
  const HANDLE_RE = /(?:^|\s)(@[A-Za-z0-9_]{2,})/g;
  // Street address: "123 Main St", optionally with apt — a light heuristic.
  const ADDRESS_RE = /\b\d{1,5}\s+([A-Z][a-z]+\.?\s){1,4}(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|square|sq)\b\.?/gi;

  const REDACT = '████';

  function initials(fullName) {
    return String(fullName || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0].toUpperCase() + '.')
      .join('');
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function mask(markdown, opts) {
    let out = typeof markdown === 'string' ? markdown : '';
    const o = Object.assign({ email: true, phone: true, links: true, address: true, name: false }, opts || {});
    const counts = { email: 0, phone: 0, links: 0, address: 0, name: 0 };

    if (o.email) out = out.replace(EMAIL_RE, () => { counts.email++; return `${REDACT}@${REDACT}`; });
    if (o.address) out = out.replace(ADDRESS_RE, () => { counts.address++; return REDACT; });
    if (o.links) {
      out = out.replace(URL_RE, () => { counts.links++; return REDACT; });
      out = out.replace(HANDLE_RE, (m, h) => { counts.links++; return m.replace(h, REDACT); });
    }
    // Phone last so it doesn't eat digits inside URLs/emails already redacted.
    if (o.phone) out = out.replace(PHONE_RE, (m) => {
      // Skip short numeric runs (years, versions) — require ≥7 digits total.
      if ((m.replace(/\D/g, '').length) < 7) return m;
      counts.phone++; return REDACT;
    });
    if (o.name && typeof o.name === 'string' && o.name.trim()) {
      const init = initials(o.name);
      const re = new RegExp(escapeRe(o.name.trim()), 'g');
      out = out.replace(re, () => { counts.name++; return init; });
    }

    return { markdown: out, counts };
  }

  window.CvPrivacy = { mask, _internals: { initials } };
})();
