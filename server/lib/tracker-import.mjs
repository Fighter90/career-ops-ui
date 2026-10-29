/**
 * tracker-import.mjs — plan the import of another tracker's CSV export
 * (Teal, Huntr, Simplify, a hand-kept spreadsheet) into applications.md.
 * CAR-181; mirrors the parent's import-tracker.mjs (#6170) column aliases,
 * stage mapping and dedup rules on web-ui's own parser stack.
 *
 * Pure planning only: `planImport` touches no disk. The route
 * (`POST /api/tracker/import-csv`) runs it for the dry-run preview, then —
 * with `commit: true` — again inside `withFileLock` and appends the rows
 * through the same markdown-table conventions as `POST /api/tracker`.
 *
 * Stage semantics:
 *   • canonical labels/ids/aliases (templates/states.yml) pass through;
 *   • other trackers' stage names map onto them (Interviewing → Interview…);
 *   • "not applied yet" stages (Bookmarked / Wishlist / Saved…) are skipped —
 *     in career-ops those postings belong in the pipeline, to be evaluated;
 *   • an unknown stage does NOT block the row: it lands as Evaluated with a
 *     `source stage: X` note (the web import is interactive; the user sees
 *     the preview before committing).
 */
import { normalizeUrl } from './url-key.mjs';

export const MAX_CSV_BYTES = 512 * 1024;
export const MAX_IMPORT_ROWS = 2000;
export const NOT_APPLIED = 'not-applied';

// Header names other trackers use, per tracker field. Earlier names win when
// a file has several, so "Date Applied" beats Huntr's "Created At".
export const COLUMN_ALIASES = {
  company: ['company', 'company name', 'employer', 'organization', 'organisation'],
  role: ['role', 'job title', 'title', 'position', 'job position', 'position title', 'job'],
  status: ['status', 'stage', 'list', 'application status', 'job status'],
  date: ['date applied', 'applied date', 'applied on', 'application date', 'applied', 'date', 'created at', 'date added', 'date saved'],
  url: ['url', 'job url', 'job link', 'posting link', 'posting url', 'link', 'apply url'],
  location: ['location', 'job location'],
  notes: ['notes', 'note', 'comments'],
};

// Stage names from other trackers that states.yml does not already resolve.
// Teal: Bookmarked, Applying, Interviewing, Negotiating, Not Selected,
// No Response, Withdrawn, Archived. Huntr: Wishlist. Simplify: Saved, Screen.
export const OTHER_TRACKER_STAGES = {
  bookmarked: NOT_APPLIED,
  wishlist: NOT_APPLIED,
  saved: NOT_APPLIED,
  interested: NOT_APPLIED,
  applying: NOT_APPLIED,
  'to apply': NOT_APPLIED,
  'not applied': NOT_APPLIED,
  submitted: 'Applied',
  screen: 'Responded',
  'phone screen': 'Responded',
  'recruiter screen': 'Responded',
  interviewing: 'Interview',
  'final round': 'Interview',
  negotiating: 'Offer',
  'offer received': 'Offer',
  'not selected': 'Rejected',
  'no response': 'Discarded',
  ghosted: 'Discarded',
  withdrawn: 'Discarded',
  archived: 'Discarded',
};

const headerKey = (h) => String(h ?? '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * RFC-4180-ish CSV reader: quoted cells with embedded commas/newlines,
 * doubled-quote escapes, CRLF line endings, a UTF-8 BOM on the header.
 * @param {string} text
 * @returns {string[][]} header first; blank lines dropped
 */
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let touched = false;
  const pushCell = () => { row.push(cell); cell = ''; touched = true; };
  const pushRow = () => {
    pushCell();
    if (row.some((c) => c.trim())) rows.push(row);
    row = [];
    touched = false;
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && !cell) {
      quoted = true; touched = true;
    } else if (ch === ',') {
      pushCell();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      pushRow();
    } else {
      cell += ch; touched = true;
    }
  }
  if (touched || cell) pushRow();
  return rows;
}

/**
 * Map tracker fields to CSV column indexes by header name.
 * @param {string[]} header
 * @returns {{columns: Record<string, number>, ignored: string[]}}
 */
export function mapColumns(header) {
  const keys = header.map(headerKey);
  const columns = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const at = keys.indexOf(alias);
      if (at !== -1 && !Object.values(columns).includes(at)) { columns[field] = at; break; }
    }
  }
  const used = new Set(Object.values(columns));
  return { columns, ignored: header.filter((h, i) => !used.has(i) && headerKey(h)) };
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function isoDate(y, m, d) {
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

const SLASH_DATE = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:[ T,].*)?$/;

/**
 * Read a date the way trackers and spreadsheets export it:
 * "2026-07-03", "2026-07-03T14:00:00Z", "7/3/2026", "Jul 3, 2026", "3 Jul 2026".
 * @param {string} raw
 * @param {boolean} dayFirst - how to read a slash date
 * @returns {string|null} YYYY-MM-DD, or null when unreadable
 */
export function readSourceDate(raw, dayFirst) {
  const s = String(raw ?? '').trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/.exec(s);
  if (m) return isoDate(m[1], +m[2], +m[3]);
  m = SLASH_DATE.exec(s);
  if (m) return dayFirst ? isoDate(m[3], +m[2], +m[1]) : isoDate(m[3], +m[1], +m[2]);
  m = /^(\d{1,2})[ -]([A-Za-z]{3,})\.?[ ,-]+(\d{4})$/.exec(s);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return isoDate(m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  m = /^([A-Za-z]{3,})\.? (\d{1,2}),? (\d{4})$/.exec(s);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return isoDate(m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  return null;
}

/**
 * Decide how to read the file's slash dates from the dates themselves.
 * A first part above 12 proves day/month, a second part above 12 proves
 * month/day; a file with both is refused rather than half misread.
 * @param {string[]} values
 * @returns {boolean} true for day/month/year
 */
export function inferDayFirst(values) {
  let dayFirst = false;
  let monthFirst = false;
  for (const v of values) {
    const m = SLASH_DATE.exec(String(v ?? '').trim());
    if (!m) continue;
    if (+m[1] > 12) dayFirst = true;
    if (+m[2] > 12) monthFirst = true;
  }
  if (dayFirst && monthFirst) {
    throw new Error('The date column mixes day/month/year and month/day/year dates. Make them one format and try again.');
  }
  return dayFirst;
}

/**
 * Resolve a source stage to a tracker state via templates/states.yml first,
 * then the other-tracker stage table.
 * @param {string} raw
 * @param {{label:string,id:string,aliases:string[]}[]} states
 * @returns {string|null} a canonical label, NOT_APPLIED, or null when unknown
 */
export function resolveStage(raw, states) {
  const s = String(raw ?? '').trim();
  if (!s) return 'Applied'; // an empty stage means the application was sent
  const q = s.toLowerCase().replace(/\*\*/g, '');
  for (const st of states || []) {
    if (st.label.toLowerCase() === q || st.id.toLowerCase() === q
      || (st.aliases || []).some((a) => a.toLowerCase() === q)) return st.label;
  }
  const key = headerKey(s);
  return Object.hasOwn(OTHER_TRACKER_STAGES, key) ? OTHER_TRACKER_STAGES[key] : null;
}

const roleKey = (company, role) => `${String(company ?? '').trim().toLowerCase().replace(/\s+/g, ' ')}\u0000${String(role ?? '').trim().toLowerCase().replace(/\s+/g, ' ')}`;

const FIRST_URL_RE = /https?:\/\/[^\s|)\]}>"']+/i;

/**
 * The tracker side of the dedup: the URL cell first (parsers.mjs already
 * extracts the #3516 markdown-link href), then a bare URL the web writer
 * put into Notes when the table has no URL column.
 */
function trackerUrlKey(row) {
  return normalizeUrl(row && row.url) || normalizeUrl(FIRST_URL_RE.exec(String(row?.notes || ''))?.[0] || '');
}

/**
 * Plan an import without touching disk.
 * @param {string[][]} csvRows - parseCsv() output, header first
 * @param {{trackerRows: object[], today: string, source?: string, states: object[]}} ctx
 */
export function planImport(csvRows, { trackerRows, today, source, states }) {
  const rows = csvRows.map((cells, i) => ({ cells, row: i + 1 })).filter((r) => r.cells.some((c) => c.trim()));
  if (!rows.length) throw new Error('The file is empty.');
  const header = rows[0].cells;
  const body = rows.slice(1);
  const { columns, ignored } = mapColumns(header);
  const missing = ['company', 'role'].filter((f) => columns[f] == null);
  if (missing.length) {
    throw new Error(`No ${missing.join(' or ')} column found. The file's headers are: ${header.map((h) => `"${String(h).trim()}"`).join(', ')}. Rename one to a recognized header (Company / Role / Status / Date / URL).`);
  }
  const at = (r, f) => (columns[f] == null ? '' : String(r.cells[columns[f]] ?? '').trim());
  const dayFirst = inferDayFirst(body.map((r) => at(r, 'date')));

  // One posting is one key: the URL when both sides have one, otherwise the
  // company and role. Two different URLs under one title are two postings.
  const index = () => ({ byUrl: new Map(), byRole: new Map() });
  const remember = (idx, urlKey, rk, value) => {
    if (urlKey) idx.byUrl.set(urlKey, value);
    idx.byRole.set(rk, [...(idx.byRole.get(rk) ?? []), { urlKey, value }]);
  };
  const lookup = (idx, urlKey, rk) => (urlKey ? idx.byUrl.get(urlKey) : undefined)
    ?? (idx.byRole.get(rk) ?? []).find((c) => !(c.urlKey && urlKey && c.urlKey !== urlKey))?.value;
  const tracked = index();
  for (const t of trackerRows || []) remember(tracked, trackerUrlKey(t), roleKey(t.company, t.role), String(t.num ?? ''));
  const seen = index();

  const entries = body.map((r) => {
    const company = at(r, 'company');
    const role = at(r, 'role');
    const sourceStatus = at(r, 'status');
    const url = at(r, 'url');
    const base = { row: r.row, company, role, sourceStatus, url, location: at(r, 'location'), sourceNotes: at(r, 'notes') };
    if (!company || !role) return { ...base, outcome: 'incomplete', reason: 'missing company or role' };
    const stage = resolveStage(sourceStatus, states);
    if (stage === NOT_APPLIED) {
      return { ...base, outcome: 'not-applied', reason: `not applied yet (stage "${sourceStatus}")` };
    }
    // Task contract: an unknown stage lands as Evaluated, not dropped —
    // the preview names it and the Notes carry the original.
    const status = stage || 'Evaluated';
    const unknownStage = !stage;
    const urlKey = normalizeUrl(url);
    const rk = roleKey(company, role);
    const trackedNum = lookup(tracked, urlKey, rk);
    if (trackedNum != null) {
      const hitByUrl = urlKey && (tracked.byUrl.get(urlKey) === trackedNum);
      return {
        ...base, status, unknownStage, outcome: 'tracked', trackedNum,
        reason: hitByUrl
          ? `already in the tracker (same posting URL, #${trackedNum})`
          : `already in the tracker (same company and role, #${trackedNum})`,
      };
    }
    const firstRow = lookup(seen, urlKey, rk);
    if (firstRow != null) {
      return { ...base, status, unknownStage, outcome: 'repeat', firstRow, reason: `repeated in this file (same as row ${firstRow})` };
    }
    remember(seen, urlKey, rk, r.row);
    const date = readSourceDate(at(r, 'date'), dayFirst);
    const notes = [
      `imported from ${source || 'CSV import'}`,
      sourceStatus && sourceStatus.toLowerCase() !== status.toLowerCase() ? `source stage: ${sourceStatus}` : '',
      !date ? 'no date in source' : '',
      base.sourceNotes,
    ].filter(Boolean).join('; ');
    return { ...base, status, unknownStage, date: date || today, undated: !date, notes, outcome: 'import' };
  });

  return {
    columns: Object.fromEntries(Object.entries(columns).map(([f, i]) => [f, String(header[i] ?? '').trim()])),
    ignored,
    dayFirst,
    entries,
  };
}
