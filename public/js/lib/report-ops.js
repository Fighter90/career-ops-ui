/* global window */
/**
 * ReportOps — pure helpers for the #/reports v2 list (CAR-118): unified
 * title/score format, search/filter/sort over the report summaries.
 *
 * The list view (public/js/views/reports.js) renders whatever
 * GET /api/reports returns; every entry there is parseReportHeader's shape
 * ({ title, date, archetype, score, scoreNum, url, legitimacy, pdf } — see
 * server/lib/parsers.mjs). This lib MIRRORS the server conventions, it does
 * not reinvent them:
 *
 *   - Title split: server/lib/routes/auto-pipeline.mjs (v1.248.7) — the H1
 *     follows the parent oferta convention `# Evaluation: {Company} — {Role}`;
 *     a localized prose label is stripped first, then `Company — Role` after
 *     a label / `Role — Company` without one.
 *   - Score: parseReportHeader already reduced the raw header text to
 *     `scoreNum` (0–5 float or null). Rendering is always `x.x/5`.
 */
window.ReportOps = (function () {
  'use strict';

  // The localized H1 prose labels the server strips — the ONE client copy
  // lives in lib/report-labels.js (FULL-M6; was a literal table here, kept
  // in sync by convention). Drift-gated against the server table
  // (H1_LABEL_WORDS in routes/auto-pipeline.mjs) by
  // tests/m6-wave1-consolidations.test.mjs.
  const H1_LABEL_WORDS = window.ReportLabels.H1_LABEL_WORDS;

  const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const LABEL_RE = new RegExp(
    '^[ \\t]*\\*{0,2}[ \\t]*(?:' + H1_LABEL_WORDS.map(escapeRe).join('|') + ')[ \\t]*\\*{0,2}[ \\t]*[:：][ \\t]*(.+)$',
    'iu',
  );

  // Dash separators: em/en dashes take priority; a spaced hyphen is only a
  // separator when the body carries no em/en dash at all (a hyphen inside a
  // company or role name — «Acme - Labs» — is content, not a boundary).
  const EM_DASH_SEP = '\\s+[—–]\\s+';
  const HYPHEN_SEP = '\\s+-\\s+';

  /** All separator occurrences of `sepSrc` in `body` (leftmost-first). */
  function separators(body, sepSrc) {
    const re = new RegExp(sepSrc, 'g');
    const out = [];
    let m;
    while ((m = re.exec(body)) !== null) out.push({ idx: m.index, len: m[0].length });
    return out;
  }

  /**
   * Split `body` at the LAST dash separator (em/en dashes take priority; a
   * spaced hyphen is only a separator when the body carries no em/en dash at
   * all — a hyphen inside a name, «Acme - Labs», is content, not a boundary).
   *
   * LAST, not first, keeps the multi-token side whole in BOTH H1 forms:
   *   labelled   `Company — Role`   → «Acme - Labs — Staff Eng» keeps the
   *                                    hyphenated company intact;
   *   unlabelled `Role — Company`   → «Engineer - Platform — Acme» keeps the
   *                                    role intact.
   */
  function splitDash(body) {
    const seps = separators(body, EM_DASH_SEP).length
      ? separators(body, EM_DASH_SEP)
      : separators(body, HYPHEN_SEP);
    if (!seps.length) return null;
    const sep = seps[seps.length - 1];
    const left = body.slice(0, sep.idx).trim();
    const right = body.slice(sep.idx + sep.len).trim();
    if (!left || !right) return null;
    return { left, right };
  }

  /**
   * Split a report H1 into { company, role, labelled } following the
   * server's v1.248.7 convention. Never throws; unknown parts come back ''.
   * `labelled` records whether a recognised H1 label was stripped —
   * displayTitle rewrites the order ONLY for labelled headers.
   */
  function normalizeTitle(title) {
    const raw = String(title || '').replace(/^#+\s*/, '').trim();
    if (!raw) return { company: '', role: '', labelled: false };
    const labelled = raw.match(LABEL_RE);
    const body = (labelled ? labelled[1] : raw).trim();
    const split = splitDash(body);
    if (!split) return { company: '', role: body, labelled: Boolean(labelled) };
    // After a label: `Company — Role` (role is the RIGHT side); without a
    // label: `Role — Company` (role is the LEFT side).
    return labelled
      ? { company: split.left, role: split.right, labelled: true }
      : { company: split.right, role: split.left, labelled: false };
  }

  /**
   * The ONE rounding for display AND banding (review finding 2): a score is
   * shown to one decimal, so band decisions must run on the same rounded
   * value — 4.47 displays «4.5» and bands high, never «4.5»+good.
   */
  function roundScore(scoreNum) {
    if (scoreNum == null || !Number.isFinite(Number(scoreNum))) return null;
    return Math.round(Number(scoreNum) * 10) / 10;
  }

  /** Unified list format. Rewrites to «Company — Role» ONLY when a
   * recognised H1 label was stripped (review finding 4): a legacy
   * hand-written label-less title keeps its raw form — reordering it would
   * mis-attribute role and company. Label-less + no dash → the raw title. */
  function displayTitle(rep) {
    const r = rep || {};
    const raw = String(r.title || '').replace(/^#+\s*/, '').trim();
    const { company, role, labelled } = normalizeTitle(r.title);
    if (labelled) return (company && role) ? company + ' — ' + role : (role || raw);
    return raw || String(r.slug || '');
  }

  /** Score is ALWAYS «x.x/5» (rounded via roundScore); null when the server
   * couldn't parse one. */
  function formatScore(scoreNum) {
    const n = roundScore(scoreNum);
    return n == null ? null : n.toFixed(1) + '/5';
  }

  // The four action bands (career-ops.org scan guide): ≥4.5 apply now,
  // 4.0–4.4 apply / find a contact, 3.5–3.9 research first, <3.5 skip.
  const BANDS = [
    { id: 'high', min: 4.5 },
    { id: 'good', min: 4.0, max: 4.5 },
    { id: 'mid', min: 3.5, max: 4.0 },
    { id: 'low', max: 3.5 },
  ];

  /** 'high' | 'good' | 'mid' | 'low' | null (unparsed) — bands the
   * DISPLAYED (rounded) value so a «4.0/5» chip never sits in the mid band. */
  function bandOf(scoreNum) {
    const n = roundScore(scoreNum);
    if (n == null) return null;
    if (n >= 4.5) return 'high';
    if (n >= 4.0) return 'good';
    if (n >= 3.5) return 'mid';
    return 'low';
  }

  const norm = (s) => String(s || '').toLowerCase();

  /**
   * Filter the report summaries. `f` keys (all optional):
   *   q          — substring over company/role/title/slug (case-insensitive)
   *   company    — substring over the parsed company
   *   legitimacy — exact legitimacy chip value ('' = all)
   *   band       — 'all' | 'high' | 'good' | 'mid' | 'low'
   *   dateFrom / dateTo — inclusive ISO YYYY-MM-DD bounds
   *
   * Missing title/slug contribute nothing to the haystack (no literal
   * "undefined" tokens — review finding 6); an undated report is excluded
   * as soon as EITHER date bound is set (review finding 7 — the old
   * ''-string compare passed dateTo but failed dateFrom).
   */
  function applyFilters(reports, f) {
    const fs = f || {};
    const q = norm(fs.q).trim();
    const company = norm(fs.company).trim();
    const legitimacy = norm(fs.legitimacy);
    const band = fs.band && fs.band !== 'all' ? fs.band : null;
    const from = fs.dateFrom ? String(fs.dateFrom) : '';
    const to = fs.dateTo ? String(fs.dateTo) : '';
    return (reports || []).filter((r) => {
      const date = String(r.date || '');
      if ((from || to) && !date) return false;
      if (q) {
        const parts = normalizeTitle(r.title);
        const hay = norm((parts.company || '') + ' ' + (parts.role || '') + ' '
          + (r.title || '') + ' ' + (r.slug || ''));
        if (!hay.includes(q)) return false;
      }
      if (company && !norm(normalizeTitle(r.title).company).includes(company)) return false;
      if (legitimacy && norm(r.legitimacy) !== legitimacy) return false;
      if (band && bandOf(r.scoreNum) !== band) return false;
      if (from && !(date >= from)) return false;
      if (to && !(date <= to)) return false;
      return true;
    });
  }

  /** sortReports(reports, 'date'|'score'|'company', 'asc'|'desc') → new array. */
  function sortReports(reports, key, dir) {
    const k = ['date', 'score', 'company'].includes(key) ? key : 'date';
    const mul = dir === 'asc' ? 1 : -1;
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
    return (reports || []).slice().sort((a, b) => {
      if (k === 'score') {
        const an = a.scoreNum, bn = b.scoreNum;
        if (an == null && bn == null) return 0;
        if (an == null) return 1;  // unparsed LAST in both directions
        if (bn == null) return -1;
        return (an - bn) * mul;
      }
      if (k === 'company') {
        const ac = normalizeTitle(a.title).company;
        const bc = normalizeTitle(b.title).company;
        if (!ac && !bc) return 0;
        if (!ac) return 1; // unparsed company last (desc: mul=-1 keeps it last)
        if (!bc) return -1;
        return collator.compare(ac, bc) * mul;
      }
      const ad = String(a.date || '');
      const bd = String(b.date || '');
      if (ad === bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;
      return ad < bd ? -mul : mul;
    });
  }

  /** Per-band counts for the mini histogram, unparsed included. */
  function scoreHistogram(reports) {
    const out = { high: 0, good: 0, mid: 0, low: 0, unparsed: 0 };
    for (const r of reports || []) {
      const b = bandOf(r.scoreNum);
      out[b || 'unparsed']++;
    }
    return out;
  }

  /** Distinct parsed companies, sorted case-insensitively. */
  function companies(reports) {
    const seen = new Map();
    for (const r of reports || []) {
      const c = normalizeTitle(r.title).company;
      if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
    }
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    return Array.from(seen.values()).sort((a, b) => collator.compare(a, b));
  }

  /**
   * Trailing debounce with a .cancel() escape (review finding 8): a pending
   * filter keystroke must not resurrect state the user just reset.
   */
  function debounce(fn, ms) {
    let handle;
    const wrapped = (...args) => {
      clearTimeout(handle);
      handle = setTimeout(() => fn(...args), ms);
    };
    wrapped.cancel = () => { clearTimeout(handle); };
    return wrapped;
  }

  return {
    normalizeTitle, displayTitle, roundScore, formatScore, bandOf, BANDS,
    applyFilters, sortReports, scoreHistogram, companies, debounce,
  };
})();
