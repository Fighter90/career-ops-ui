/**
 * data-migrations.mjs — one-off user-data migrations shipped as DRY-RUN
 * runners (CAR-232/233 + the 2026-11-05 prod-regression fixes CAR-241/242).
 * The default mode is read-only; `apply` rewrites with a timestamped .bak
 * backup beside the file. They never touch anything but the documented
 * surfaces:
 *   · report header dates — the localized **Date:** / **Дата:** / **Datum:**
 *     … line of reports whose filename carries the true date (CAR-101 tail:
 *     368 of the pre-2026-10-26 reports carry an invented 2026-01-xx header
 *     date; the v1.268.0 scan recognized only the English label — CAR-241);
 *   · the tracker Company cell — rows where the cell holds the SOURCE's
 *     name ("hh", "habr", …, CAR-127) or a role title (CAR-128) get the
 *     employer from their report's `# Evaluation: {Company} — {Role}` H1 in
 *     any UI locale and any dash variant (— / – / " - "), falling back to
 *     the ATS slug of the row's posting URL (CAR-242).
 *
 * Line-surgical: everything outside the touched cells/lines stays
 * byte-for-byte identical, so localized headers, comments and the
 * owner's own columns survive untouched.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEADER_ALIASES, reportDateLine } from './parsers.mjs';

// CAR-241 — the filename stamp is the date INSIDE the slug; the numeric
// prefix is conventional but not required (a non-ASCII slug like
// `007-ромашка-2026-10-25.md` must reconcile like any other).
const FILENAME_DATE_RE = /(\d{4}-\d{2}-\d{2})(?:-\d+)?\.md$/i;

/** True when the file's name follows the reports/ convention with a date. */
export function filenameDate(name) {
  const m = String(name || '').match(FILENAME_DATE_RE);
  return m ? m[1] : null;
}

/**
 * Scan a reports directory: every file whose header date line differs from
 * its filename date. Rows carry { file, fileDate, headerDate, line, lineText }
 * (line = 1-based). Files that cannot be reconciled are listed in `skipped`
 * with a reason — 'no-file-date' (nothing to reconcile against),
 * 'no-header-date' (no recognizable date line in the report header) or
 * 'unreadable' — never silently dropped. Files whose header already matches
 * the filename are not listed anywhere (they need nothing).
 */
export function scanReportDateMismatches(reportsDir) {
  const rows = [];
  const skipped = [];
  let names = [];
  try { names = readdirSync(reportsDir); } catch { return { rows, skipped }; }
  for (const name of names.filter((n) => n.endsWith('.md')).sort()) {
    const fileDate = filenameDate(name);
    if (!fileDate) { skipped.push({ file: name, reason: 'no-file-date' }); continue; }
    let text = '';
    try { text = readFileSync(join(reportsDir, name), 'utf8'); } catch { skipped.push({ file: name, reason: 'unreadable' }); continue; }
    const found = reportDateLine(text);
    if (!found) { skipped.push({ file: name, reason: 'no-header-date' }); continue; }
    if (found.date !== fileDate) {
      rows.push({
        file: name,
        fileDate,
        headerDate: found.date,
        line: found.lineIndex + 1,
        lineText: found.lineText,
      });
    }
  }
  return { rows, skipped };
}

/**
 * Rewrite the report's header date line to `fileDate`, keeping the
 * (possibly localized) label byte-for-byte — only the date value inside the
 * matched line changes. Returns null when the text has no recognizable date
 * line (nothing to rewrite).
 */
export function fixReportHeaderDate(text, fileDate) {
  const found = reportDateLine(text);
  if (!found) return null;
  const lines = String(text ?? '').split('\n');
  lines[found.lineIndex] = found.lineText.slice(0, found.valueStart)
    + fileDate
    + found.lineText.slice(found.valueEnd);
  return lines.join('\n');
}

// ── CAR-242 — the employer, from a report H1 or the posting's ATS URL ──────

/**
 * The localized H1 label words, mirroring auto-pipeline's own list
 * (longest first so «Оценка вакансии» wins over «Оценка») plus Vietnamese —
 * every UI locale the report H1 convention is written in.
 */
export const REPORT_H1_LABELS = [
  'Evaluation', 'Оценка вакансии', 'Оценка', 'Оцінка вакансії', 'Оцінка',
  'Evaluación', 'Avaliação', 'Évaluation', 'Bewertung', 'Valutazione',
  'Ocena', 'Değerlendirme', '評価', '평가', '评估', '評估', 'Evaluering',
  'تقييم', 'मूल्यांकन', 'மதிப்பீடு', 'Đánh giá',
].sort((a, b) => b.length - a.length);

const escapeReMeta = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const H1_LABEL_RE = new RegExp(
  '^[ \\t]*\\*{0,2}[ \\t]*(?:'
  + REPORT_H1_LABELS.map(escapeReMeta).join('|')
  + ')[ \\t]*\\*{0,2}[ \\t]*[:：][ \\t]*(.+)$',
  'iu',
);
// Any of the three dash variants with surrounding spaces splits `Company —
// Role`; an UNSPACED hyphen is part of a compound name (ACME-Global) and
// never splits. Non-greedy left, bounded — the company is the short side.
const H1_DASH_RE = /^(.{1,120}?)\s+[—–-]\s+(.+)$/u;

/**
 * The employer named by a report's H1 (`# Evaluation: {Company} — {Role}`,
 * label localized, any dash variant). The LEFT side of the dash is the
 * company; a one-part header names the company itself. Emphasis markers are
 * stripped, whitespace collapsed. Returns null when the report has no H1 or
 * its H1 carries no company shape (a bare label word is not a company).
 */
export function companyFromReportH1(reportText) {
  const m = String(reportText ?? '').match(/^#\s+(.+)$/m);
  if (!m) return null;
  const raw = m[1].replace(/\r$/, '').trim();
  const labelMatch = raw.match(H1_LABEL_RE);
  if (!labelMatch && REPORT_H1_LABELS.some((w) => raw.toLowerCase() === w.toLowerCase())) {
    return null; // a bare localized label (# Evaluation) names no company
  }
  const body = (labelMatch ? labelMatch[1] : raw).trim();
  if (!body) return null;
  const dash = body.match(H1_DASH_RE);
  const clean = (dash ? dash[1] : body)
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || null;
}

// The per-tenant boards whose FIRST path segment is the company slug. A
// small, deliberate list — no registry import, and anything that does not
// match yields null (never guessed).
const ATS_URL_RE = /^https?:\/\/(?:boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|jobs\.eu\.lever\.co|jobs\.ashbyhq\.com|jobs\.smartrecruiters\.com|jobs\.workable\.com|apply\.workable\.com)\/([A-Za-z0-9][A-Za-z0-9._-]*)/i;

// Joined slugs that a mechanical Title Case cannot split; a tiny table of
// well-known brands (grafanalabs → Grafana Labs), keyed lowercase.
const ATS_COMPOUND_NAMES = {
  grafanalabs: 'Grafana Labs',
  gitlab: 'GitLab',
  github: 'GitHub',
  linkedin: 'LinkedIn',
  openai: 'OpenAI',
};

/**
 * The employer a posting URL's ATS tenant slug names:
 * boards.greenhouse.io/grafanalabs/jobs/123 → 'Grafana Labs',
 * jobs.lever.co/acme-corp/abc → 'Acme Corp'. CamelCase slugs keep their
 * interior capitals (AcmeCorp). Non-ATS hosts (aggregators) and slugless
 * URLs yield null — never guessed.
 */
export function atsCompanyFromUrl(url) {
  const m = String(url ?? '').match(ATS_URL_RE);
  if (!m) return null;
  const raw = m[1];
  const compound = ATS_COMPOUND_NAMES[raw.replace(/[._]+/g, '').toLowerCase()];
  if (compound) return compound;
  const titled = raw
    .split(/[-._]+/)
    .filter(Boolean)
    .map((t) => (/[A-Z]/.test(t.slice(1)) ? t : t.charAt(0).toUpperCase() + t.slice(1)))
    .join(' ');
  return titled || null;
}

// ── tracker cell primitives (shared with score-backfill) ───────────────────

/** The source-name set a Company cell must never hold (CAR-127). */
export const SOURCE_COMPANY_NAMES = new Set([
  'hh', 'hh.ru', 'habr', 'habr career', 'career.habr', 'habr.com', 'linkedin',
  'telegram', 't.me', 'indeed', 'glassdoor', 'geekjob', 'getmatch', 'careerjet',
  'superjob', 'zarplata', 'remoteok', 'remote ok', 'wellfound', 'habrcareer',
]);

/** A Company cell holding a role title (CAR-128). */
const ROLE_IN_COMPANY_RE = /\b(?:engineer|developer|manager|senior|junior|middle|lead|principal|staff|intern|designer|analyst|specialist|architect|admin|devops|qa)\b/i;

/** The display text of a tracker cell: bold/link/code markers stripped. */
export function trackerCellText(cell) {
  return String(cell ?? '')
    .replace(/\*\*/g, '')          // bold
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [label](url) → label
    .replace(/`/g, '')
    .trim();
}

/** True when the Company cell is the source's name (case-insensitive). */
export function isSourceNameCompany(cell) {
  return SOURCE_COMPANY_NAMES.has(trackerCellText(cell).toLowerCase().replace(/\.$/, ''));
}

/** True when the Company cell holds a role title. */
export function isRoleInCompany(cell) {
  return ROLE_IN_COMPANY_RE.test(trackerCellText(cell));
}

/** One tracker table row → trimmed cells, or null for non-table lines. */
export function splitTrackerRow(line) {
  const trimmed = String(line ?? '').replace(/^\s*|\s*$/g, '');
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((c) => c.trim());
}

/**
 * The column indexes the migrations care about, resolved from the tracker's
 * own header row through the same alias fold parseApplications uses (a
 * canonical, ES-localized or variant header all resolve by NAME). When a
 * label is unknown, the canonical position is the fallback — an unlocalizable
 * header (ru/uk/de) keeps the positional behavior this module always had.
 */
export function trackerColumnIndexes(trackerText) {
  const defaults = { company: 2, report: 7, score: 4, url: -1 };
  for (const line of String(trackerText ?? '').split('\n')) {
    const cells = splitTrackerRow(line);
    if (!cells) continue;
    const keys = cells.map((h) => {
      const norm = String(h).replace(/^#/, 'num').toLowerCase().trim();
      return HEADER_ALIASES[norm] ?? norm;
    });
    if (keys[0] !== 'num') continue; // the header row starts with #
    const at = (name, fallback) => {
      const i = keys.indexOf(name);
      return i >= 0 ? i : fallback;
    };
    return {
      company: at('company', defaults.company),
      report: at('report', defaults.report),
      score: at('score', defaults.score),
      url: keys.indexOf('url'), // an optional trailing column — -1 when absent
    };
  }
  return defaults;
}

/**
 * Scan the tracker text for Company cells that hold a source name or a role
 * title. `resolveCompany(reportCell, urlCell)` maps the row's Report cell
 * (a markdown link like `[42](../reports/042-acme-2026-05-01.md)`) and its
 * optional URL cell to `{ company, source }` — source is 'report' or 'ats'
 * — or `{ reason }` / null when unresolvable (provided by the caller so
 * this module stays filesystem-free). Rows without a resolvable employer
 * are reported with `fixed: null` and an `unresolvedReason` (never guessed).
 */
export function scanTrackerCompanyIssues(trackerText, resolveCompany) {
  const issues = [];
  const lines = String(trackerText ?? '').split('\n');
  const cols = trackerColumnIndexes(trackerText);
  for (let i = 0; i < lines.length; i += 1) {
    const cells = splitTrackerRow(lines[i]);
    if (!cells || cells.length < 8) continue;
    if (!/^\d+$/.test(cells[0])) continue; // data rows carry a numeric #
    const company = trackerCellText(cells[cols.company]);
    const reason = isSourceNameCompany(cells[cols.company]) ? 'source-name'
      : isRoleInCompany(cells[cols.company]) ? 'role-in-company' : null;
    if (!reason) continue;
    const res = resolveCompany
      ? resolveCompany(cells[cols.report], cols.url >= 0 ? cells[cols.url] : '')
      : null;
    const employer = typeof res === 'string' ? res : (res && res.company != null ? res.company : null);
    const fixed = employer != null && employer !== '' && employer !== company ? String(employer) : null;
    const unresolvedReason = fixed ? null
      : (employer != null && employer !== '' ? 'same-company'
        : (res && typeof res === 'object' && res.reason ? res.reason : 'no-report'));
    issues.push({
      line: i + 1,
      num: cells[0],
      company,
      reason,
      reportCompany: employer ?? null,
      fixed,
      source: fixed ? (res && typeof res === 'object' ? (res.source ?? 'report') : 'report') : null,
      unresolvedReason,
    });
  }
  return issues;
}

/**
 * Apply the fixes: only rows whose scan entry carries a non-null `fixed`.
 * Each touched line has ONLY its Company cell replaced — every other byte
 * of the line (dates, score, notes) survives verbatim.
 */
export function applyTrackerCompanyFix(trackerText, issues) {
  const fixByLine = new Map(issues.filter((i) => i.fixed).map((i) => [i.line, i.fixed]));
  if (!fixByLine.size) return { text: trackerText, changed: 0 };
  const lines = String(trackerText ?? '').split('\n');
  const cols = trackerColumnIndexes(trackerText);
  let changed = 0;
  for (const [lineNo, employerRaw] of fixByLine) {
    const idx = lineNo - 1;
    const cells = splitTrackerRow(lines[idx]);
    if (!cells || cells.length < 8) continue;
    // Review v1.268.1 — the employer comes from a report H1 (free text). A
    // `|` (or a line break) inside it would add a phantom column to the
    // `|`-delimited row; flatten to spaces before the rebuild. A null/blank
    // resolution (missing report, empty H1) must NOT blank the cell — skip.
    const employer = String(employerRaw ?? '').replace(/[|\r\n\t]+/g, ' ').trim();
    if (!employer) continue;
    const before = lines[idx];
    const rebuilt = `| ${cells.map((c, i2) => (i2 === cols.company ? employer : c)).join(' | ')} |`;
    if (rebuilt !== before) {
      lines[idx] = rebuilt;
      changed += 1;
    }
  }
  return { text: lines.join('\n'), changed };
}
