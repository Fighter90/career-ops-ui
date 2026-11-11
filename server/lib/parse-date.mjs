/**
 * parse-date.mjs — strict YYYY-MM-DD calendar-date parsing.
 *
 * `Date.parse('2026-02-30')` does not fail: it rolls over to 2 March, so an
 * impossible date becomes a "real" timestamp (upstream #6802). parseDate
 * accepts only a real calendar day: the shape must be strict YYYY-MM-DD, and
 * a UTC round-trip (`toISOString().slice(0, 10)`) must return the input
 * unchanged. Everything else — `n/a`, prose, the wrong shape, an impossible
 * day or month — is null.
 *
 * Ported with upstream #6802 (providers/ibm dcdate); shared so later
 * consumers read dates through the same strictness.
 * @param {unknown} dateStr
 * @returns {Date | null} the date at UTC midnight, or null
 */
export function parseDate(dateStr) {
  const iso = String(dateStr || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null;
  }

  const date = new Date(`${iso}T00:00:00Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    return null;
  }

  return date;
}
