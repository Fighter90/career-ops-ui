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

  // The localized H1 prose labels the server strips (H1_LABEL_WORDS in
  // routes/auto-pipeline.mjs, longest-first). Kept in sync by convention —
  // a label that reaches the client unstripped only degrades to the raw
  // title fallback, never to a wrong split.
  const H1_LABEL_WORDS = [
    'Evaluation', 'Оценка вакансии', 'Оценка', 'Оцінка вакансії', 'Оцінка',
    'Evaluación', 'Avaliação', 'Évaluation', 'Bewertung', 'Valutazione',
    'Ocena', 'Değerlendirme', '評価', '평가', '评估', '評估', 'Evaluering',
    'تقييم', 'मूल्यांकन', 'மதிப்பீடு',
  ].sort((a, b) => b.length - a.length);

  const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const LABEL_RE = new RegExp(
    '^[ \\t]*\\*{0,2}[ \\t]*(?:' + H1_LABEL_WORDS.join('|') + ')[ \\t]*\\*{0,2}[ \\t]*[:：][ \\t]*(.+)$',
    'iu',
  );
  const DASH_RE = /^(.{1,120}?)\s+[—–-]\s+(.+)$/u;

  /**
   * Split a report H1 into { company, role } following the server's
   * v1.248.7 convention. Never throws; unknown parts come back ''.
   */
  function normalizeTitle(title) {
    const raw = String(title || '').replace(/^#+\s*/, '').trim();
    if (!raw) return { company: '', role: '' };
    const labelled = raw.match(LABEL_RE);
    const body = (labelled ? labelled[1] : raw).trim();
    const dash = body.match(DASH_RE);
    if (!dash) return { company: '', role: body };
    const left = dash[1].trim();
    const right = dash[2].trim();
    // After a label: `Company — Role` (role is the RIGHT side); without a
    // label: `Role — Company` (role is the LEFT side).
    return labelled ? { company: left, role: right } : { company: right, role: left };
  }

  /** Unified list format: «Company — Role», falling back to title then slug. */
  function displayTitle(rep) {
    const rep2 = rep || {};
    const { company, role } = normalizeTitle(rep2.title);
    if (company && role) return company + ' — ' + role;
    if (role) return role;
    return String(rep2.title || rep2.slug || '');
  }

  /** Score is ALWAYS «x.x/5»; null when the server couldn't parse one. */
  function formatScore(scoreNum) {
    if (scoreNum == null || !Number.isFinite(Number(scoreNum))) return null;
    return Number(scoreNum).toFixed(1) + '/5';
  }

  // The four action bands (career-ops.org scan guide): ≥4.5 apply now,
  // 4.0–4.4 apply / find a contact, 3.5–3.9 research first, <3.5 skip.
  const BANDS = [
    { id: 'high', min: 4.5 },
    { id: 'good', min: 4.0, max: 4.5 },
    { id: 'mid', min: 3.5, max: 4.0 },
    { id: 'low', max: 3.5 },
  ];

  /** 'high' | 'good' | 'mid' | 'low' | null (unparsed). */
  function bandOf(scoreNum) {
    const n = Number(scoreNum);
    if (scoreNum == null || !Number.isFinite(n)) return null;
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
      if (q) {
        const { company: pc, role: pr } = normalizeTitle(r.title);
        const hay = norm(pc + ' ' + pr + ' ' + r.title + ' ' + r.slug);
        if (!hay.includes(q)) return false;
      }
      if (company && !norm(normalizeTitle(r.title).company).includes(company)) return false;
      if (legitimacy && norm(r.legitimacy) !== legitimacy) return false;
      if (band && bandOf(r.scoreNum) !== band) return false;
      if (from && !(String(r.date || '') >= from)) return false;
      if (to && !(String(r.date || '') <= to)) return false;
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

  return { normalizeTitle, displayTitle, formatScore, bandOf, BANDS, applyFilters, sortReports, scoreHistogram, companies };
})();
