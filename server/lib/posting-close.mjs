// CAR-256 (parent parity, upstream #6597) — posting CLOSE dates.
//
// A posting close date is a calendar day, or absent. `closesAtIso` reads it
// off a job (a `YYYY-MM-DD` string, an ISO datetime, or any of the JSON-LD /
// ATS close-date field names), and `closeDatesByUrl` / `closeDateForUrl`
// join the days recorded in scan-history back onto URLs — the storage side
// lives in the scanners' history writers (a `closes_at` cell appended to
// every newer row), the reading side is GET /api/pipeline feeding the
// `#/pipeline` close-date chip.

import { normalizeUrl } from './url-key.mjs';

// First present valid field wins.
const CLOSE_FIELDS = [
  'validThrough',
  'applicationDeadline',
  'application_deadline',
  'endDate',
  'end_date',
  'closeDate',
  'close_date',
];

// The offset may be written with or without its colon ("+00:00" or "+0000");
// PHP's DATE_ISO8601 and Java formatters write the second form.
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Parent-format rows lead with the URL; web-ui rows lead with the date. */
const URL_PREFIX_RE = /^https?:\/\//i;
// Parent SCAN_HISTORY_COLUMNS: closes_at was appended LAST (index 15); older
// parent rows simply stop short. web-ui's own row shape:
// `date | source | id | company | title | url | closes_at` (index 6, added by
// CAR-256; rows written before it stop short at an empty cell).
const PARENT_CLOSES_AT_INDEX = 15;
const WEBUI_URL_INDEX = 5;
const WEBUI_CLOSES_AT_INDEX = 6;

/**
 * Mirror of the parent's lib/parse-date.mjs: a real `YYYY-MM-DD` calendar day.
 *
 * The falsy-input guard and the format re-check are parent-parity guards that
 * cannot fire through the exported surface — `isCalendarDay` is only ever
 * called with a day that `dayFromString` already regex-matched — so they are
 * excluded from the branch accounting instead of being deleted (the mirror
 * stays comparable with the parent).
 * @param {string} dateStr
 * @returns {boolean}
 */
function isCalendarDay(dateStr) {
  /* node:coverage ignore next 2 */
  const iso = String(dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return false;
  return true;
}

/**
 * @param {unknown} value
 * @returns {string} `YYYY-MM-DD`, or `''`
 */
export function closesAtIso(value) {
  if (typeof value === 'string') return dayFromString(value);
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return '';
  for (const name of CLOSE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value, name)) continue;
    const field = value[name];
    if (typeof field !== 'string') continue;
    const day = dayFromString(field);
    if (day) return day;
  }
  return '';
}

function dayFromString(raw) {
  const text = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return isCalendarDay(text) ? text : '';
  const match = DATE_TIME.exec(text);
  if (!match) return '';
  const day = match[1];
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const seconds = match[4] === undefined ? 0 : Number(match[4]);
  if (hours > 23 || minutes > 59 || seconds > 59) return '';
  if (!isCalendarDay(day)) return '';
  const zone = match[6];
  if (!zone) return day;
  return utcCalendarDay(day, hours, minutes, seconds, match[5], zone);
}

function utcCalendarDay(day, hours, minutes, seconds, fraction, zone) {
  let offsetMinutes = 0;
  if (zone !== 'Z') {
    // `zone` comes from DATE_TIME's (Z|[+-]\d{2}:?\d{2}) capture, so this inner
    // re-parse cannot fail — a parent-parity guard, not a reachable branch.
    const match = /^([+-])(\d{2}):?(\d{2})$/.exec(zone);
    /* node:coverage ignore next */
    if (!match) return '';
    const sign = match[1] === '+' ? 1 : -1;
    const offsetHours = Number(match[2]);
    const offsetMins = Number(match[3]);
    if (offsetHours > 14 || offsetMins > 59) return '';
    offsetMinutes = sign * (offsetHours * 60 + offsetMins);
  }
  const fractionMs = fraction ? Number(fraction.slice(1, 4).padEnd(3, '0')) : 0;
  const localAsUtc = Date.UTC(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
    hours,
    minutes,
    seconds,
    fractionMs,
  );
  const utc = new Date(localAsUtc - offsetMinutes * 60 * 1000);
  // The components are validated above and the offset is bounded, so this
  // Date can never be NaN — a parent-parity guard, not a reachable branch.
  /* node:coverage ignore next */
  if (Number.isNaN(utc.getTime())) return '';
  return utc.toISOString().slice(0, 10);
}

/**
 * Statuses recorded for VISIBILITY only (parent parity — the same set the
 * scanners treat as non-seeing). A later observational row must not override
 * the close day an `added` row recorded.
 */
const OBSERVATIONAL_HISTORY_STATUSES = new Set([
  'skipped_title',
  'skipped_location',
  'skipped_age',
  'skipped_no_apply_control',
  'skipped_content',
  'skipped_visa',
  'skipped_country_eligibility',
  'skipped_experience',
]);

/**
 * One scan-history row, shape-aware. Two shapes share the file: the parent's
 * (`url | first_seen | portal | title | company | status | … | closes_at`)
 * and web-ui's own (`date | source | id | company | title | url | closes_at`).
 * The URL's position tells them apart.
 * @param {string} line
 * @returns {{ url: string, status: string, closesAt: string }}
 */
function parseHistoryRow(line) {
  const cells = line.split('\t');
  if (URL_PREFIX_RE.test(cells[0] || '')) {
    // Inside this branch cells[0] is always a truthy URL, so its `|| ''`
    // fallback is dead defensive code (parent-parity shape), not a branch.
    /* node:coverage ignore next */
    return { url: cells[0] || '', status: String(cells[5] || '').trim(), closesAt: cells[PARENT_CLOSES_AT_INDEX] || '' };
  }
  return { url: cells[WEBUI_URL_INDEX] || '', status: 'added', closesAt: cells[WEBUI_CLOSES_AT_INDEX] || '' };
}

/**
 * Index every recorded close day by canonical posting URL.
 * @param {string} text - raw scan-history.tsv content.
 * @returns {Map<string, string>} canonical URL → `YYYY-MM-DD`
 */
export function closeDatesByUrl(text) {
  const index = new Map();
  const added = new Set();
  for (const line of String(text ?? '').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const row = parseHistoryRow(line);
    const day = closesAtIso(row.closesAt);
    if (!day) continue;
    const key = normalizeUrl(row.url) || row.url;
    if (!key) continue;
    if (row.status === 'added') {
      added.add(key);
      index.set(key, day);
      continue;
    }
    if (added.has(key) && OBSERVATIONAL_HISTORY_STATUSES.has(row.status)) continue;
    index.set(key, day);
  }
  return index;
}

/**
 * @param {ReadonlyMap<string, string>|null|undefined} index
 * @param {unknown} url
 * @returns {string} `YYYY-MM-DD`, or `''`
 */
export function closeDateForUrl(index, url) {
  if (!index || typeof url !== 'string' || !url) return '';
  const key = normalizeUrl(url) || url;
  if (!key || !index.has(key)) return '';
  return index.get(key);
}
