/**
 * data-migrations.mjs — one-off user-data migrations shipped as DRY-RUN
 * runners (CAR-232/233, the 2026-11-04 prod regression tails). The default
 * mode is read-only; `apply` rewrites with a timestamped .bak backup beside
 * the file. They never touch anything but the two documented surfaces:
 *   · report header dates — the **Date:** line of reports whose filename
 *     carries the true date (CAR-101 tail: 368 of the pre-2026-10-26
 *     reports carry an invented 2026-01-xx header date);
 *   · the tracker Company cell — rows where the cell holds the SOURCE's
 *     name ("hh", "habr", …, CAR-127) or a role title (CAR-128) get the
 *     employer from their report's `# Evaluation: {Company} — {Role}` H1.
 *
 * Line-surgical: everything outside the touched cells/lines stays
 * byte-for-byte identical, so localized headers, comments and the
 * owner's own columns survive untouched.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILENAME_DATE_RE = /^\d{3}-.*-(\d{4}-\d{2}-\d{2})(?:-\d+)?\.md$/;
const HEADER_DATE_RE = /^(\*\*Date:\*\*)\s*(\d{4}-\d{2}-\d{2})\s*$/;

/** True when the file's name follows the reports/ convention with a date. */
export function filenameDate(name) {
  const m = String(name || '').match(FILENAME_DATE_RE);
  return m ? m[1] : null;
}

/**
 * Scan a reports directory: every file whose header **Date:** differs from
 * its filename date. Files without a date in the name, or without a header
 * date line, are skipped (nothing to reconcile against).
 */
export function scanReportDateMismatches(reportsDir) {
  const out = [];
  let names = [];
  try { names = readdirSync(reportsDir); } catch { return out; }
  for (const name of names.filter((n) => n.endsWith('.md'))) {
    const fileDate = filenameDate(name);
    if (!fileDate) continue;
    let text = '';
    try { text = readFileSync(join(reportsDir, name), 'utf8'); } catch { continue; }
    const line = text.split('\n').find((l) => HEADER_DATE_RE.test(l));
    if (!line) continue;
    const headerDate = line.match(HEADER_DATE_RE)[2];
    if (headerDate !== fileDate) out.push({ file: name, fileDate, headerDate });
  }
  return out;
}

/** Rewrite the **Date:** line of one report to the filename date. */
export function fixReportHeaderDate(text, fileDate) {
  const lines = String(text ?? '').split('\n');
  let replaced = false;
  const out = lines.map((l) => {
    if (!replaced && HEADER_DATE_RE.test(l)) {
      replaced = true;
      return l.replace(HEADER_DATE_RE, `$1 ${fileDate}`);
    }
    return l;
  });
  return replaced ? out.join('\n') : null;
}

/** The source-name set a Company cell must never hold (CAR-127). */
export const SOURCE_COMPANY_NAMES = new Set([
  'hh', 'hh.ru', 'habr', 'habr career', 'career.habr', 'habr.com', 'linkedin',
  'telegram', 't.me', 'indeed', 'glassdoor', 'geekjob', 'getmatch', 'careerjet',
  'superjob', 'zarplata', 'remoteok', 'remote ok', 'wellfound', 'habrcareer',
]);

/** A Company cell holding a role title (CAR-128). */
const ROLE_IN_COMPANY_RE = /\b(?:engineer|developer|manager|senior|junior|middle|lead|principal|staff|intern|designer|analyst|specialist|architect|admin|devops|qa)\b/i;

function cellText(cell) {
  return String(cell ?? '')
    .replace(/\*\*/g, '')          // bold
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [label](url) → label
    .replace(/`/g, '')
    .trim();
}

/** True when the Company cell is the source's name (case-insensitive). */
export function isSourceNameCompany(cell) {
  return SOURCE_COMPANY_NAMES.has(cellText(cell).toLowerCase().replace(/\.$/, ''));
}

/** True when the Company cell holds a role title. */
export function isRoleInCompany(cell) {
  return ROLE_IN_COMPANY_RE.test(cellText(cell));
}

function splitRow(line) {
  const trimmed = line.replace(/^\s*|\s*$/g, '');
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((c) => c.trim());
}

/**
 * Scan the tracker text for Company cells that hold a source name or a role
 * title. `resolveReportCompany(reportLinkCell)` maps the row's Report cell
 * (a markdown link like `[42](../reports/042-acme-2026-05-01.md)`) to the
 * employer the report's H1 names — provided by the caller so this module
 * stays filesystem-free. Rows without a resolvable employer are listed with
 * `fixed: null` (reported, never guessed).
 */
export function scanTrackerCompanyIssues(trackerText, resolveReportCompany) {
  const issues = [];
  const lines = String(trackerText ?? '').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const cells = splitRow(lines[i]);
    if (!cells || cells.length < 8) continue;
    if (!/^\d+$/.test(cells[0])) continue; // data rows carry a numeric #
    const company = cellText(cells[2]);
    const reason = isSourceNameCompany(cells[2]) ? 'source-name'
      : isRoleInCompany(cells[2]) ? 'role-in-company' : null;
    if (!reason) continue;
    const employer = resolveReportCompany ? resolveReportCompany(cells[7]) : null;
    issues.push({
      line: i + 1,
      num: cells[0],
      company,
      reason,
      reportCompany: employer,
      fixed: employer && employer !== company ? employer : null,
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
  let changed = 0;
  for (const [lineNo, employer] of fixByLine) {
    const idx = lineNo - 1;
    const cells = splitRow(lines[idx]);
    if (!cells || cells.length < 8) continue;
    const before = lines[idx];
    const rebuilt = `| ${cells.map((c, i2) => (i2 === 2 ? employer : c)).join(' | ')} |`;
    if (rebuilt !== before) {
      lines[idx] = rebuilt;
      changed += 1;
    }
  }
  return { text: lines.join('\n'), changed };
}
