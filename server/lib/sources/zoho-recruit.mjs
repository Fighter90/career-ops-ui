// @ts-check
/**
 * Zoho Recruit source — target list: `tracked_companies:` (one Zoho Recruit
 * tenant's career site per entry).
 *
 * Auto-detects any `https://<tenant>.zohorecruit.com` careers_url. Only the
 * hostname is used: the board is always read from `/jobs/Careers`, which every
 * tenant with the current career site serves, whatever its own portal name
 * (`Emplois`, …) or the path the configured URL carries (a posting, the bare
 * host, the legacy `/recruit/Portal.na`). Posting URLs are built under the
 * same path.
 *
 * The career site is server-rendered: the whole board sits in the list page
 * as `<input type="hidden" id="jobs" value="[…]">`, a JSON array whose
 * quotes are HTML-entity-escaped. One list request per tenant, no auth.
 *   - `id="jobs"` present with `[]`     → a live board with nothing open.
 *   - `id="jobs"` absent on the page   → throw. Zoho answers 200 with a
 *     "Page does not exist" page for an unknown tenant, and for a tenant that
 *     only has the legacy career site, so a missing input is the only signal
 *     that tells a broken or unsupported board from an empty one.
 * Rows marked `Is_Locked: true` or `Publish: false` are postings the career
 * site shows as filled, and are skipped.
 *
 * Each posting's own page (`/jobs/Careers/<id>`) embeds its record as a
 * JavaScript string literal, `var jobs = JSON.parse('[…]')`, with HTML
 * `Job_Description`, `Date_Opened` and a free-text `Salary`.
 * parseZohoDetailPage() reads it without evaluating any script.
 *
 * Detail enrichment is opt-in:
 *
 *   - name: Example Zoho Recruit Co
 *     careers_url: https://exampleco.zohorecruit.com/jobs/Careers
 *     zohoRecruit:
 *       fetchDetails: true   # optional: fetch each posting's page for description, date and salary
 *       detailLimit: 25      # optional: max detail fetches per sweep (1..100, default 25)
 *
 * Ported from the parent's providers/zoho-recruit.mjs (parity v1.253.0).
 * Deviations from the parent, per the web-ui source contract:
 *   - the parent's ctx transport (ctx.fetchText / ctx.sleep) does not exist
 *     here; the source fetches through the injected fetchImpl with a local
 *     retry budget, and web-ui's scanner has no probe path (enrichment is
 *     bounded by its own budget alone);
 *   - the parent's shared free-text salary helpers (_salary-text.mjs) have no
 *     web-ui equivalent yet, so the annual-compensation parser this source
 *     needs is inlined module-locally (verbatim semantics); extract it into a
 *     shared server/lib/sources/_salary-text.mjs when a second consumer appears;
 *   - the parsed salary renders as the web-ui row's STRING salary field (the
 *     remotli/agenticjobs convention — web-ui rows carry salary as a display
 *     string, never a structured object);
 *   - the list row's Job_Description becomes the web-ui row's `snippet` (the
 *     scanner's content filter reads it) and Date_Opened becomes `date`.
 */
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText } from '../html-to-text.mjs';
import {
  fetchText,
  fetchRawResponse,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

const UA = BROWSER_LIKE_USER_AGENT;

export const meta = {
  value: 'zoho-recruit',
  label: 'Zoho Recruit',
  region: 'en',
};

/** A tenant host: exampleco.zohorecruit.com. Only .com tenants are matched —
 * [spec, review round CAR-86 #24] zohorecruit.eu / .in / .com.au tenants are
 * silently unsupported; extend ZOHO_HOST_RE (with fixtures) if one appears. */
export const ZOHO_HOST_RE = /^[a-z0-9][a-z0-9-]*\.zohorecruit\.com$/;
export const BOARD_PATH = '/jobs/Careers';

// Parent retry budget (1 attempt + 2 retries on a transient failure).
export const RETRIES = 2;
export const RETRY_DELAY_MS = 500;
export const RETRY_MAX_DELAY_MS = 8000;

// Pause between detail requests (same pacing as the parent).
export const INTER_REQUEST_DELAY_MS = 250;

const SNIPPET_CAP = 500;

/** @param {unknown} value */
function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** @param {unknown} value */
function toEpochMs(value) {
  if (!value || typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Clamp a runtime integer into [min, max], falling back to `def` for NaN. */
function intInRange(val, def, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * Parse an entry's `api` / careers_url into its Zoho Recruit host, or null for
 * anything that is not an HTTPS `<tenant>.zohorecruit.com` URL. Candidates are
 * tried in order (`api` first, then careers_url) like the computrabajo /
 * magneto adapters: a non-Zoho human careers_url must never shadow a valid
 * Zoho `api`.
 * @param {any} entry
 * @returns {URL | null}
 */
function parseZohoUrl(entry) {
  for (const raw of [str(entry?.api), str(entry?.careers_url)]) {
    if (!raw) continue;
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:') continue;
    if (!ZOHO_HOST_RE.test(parsed.hostname)) continue;
    return parsed;
  }
  return null;
}

/**
 * The board an entry points at: the origin rebuilt from the hostname alone,
 * and the fixed list path. The configured path and port are discarded.
 * Exported for the adapter (buildEndpoint) and tests.
 * @param {any} entry
 * @returns {{ origin: string, boardUrl: string } | null}
 */
export function resolveZohoBoard(entry) {
  const parsed = parseZohoUrl(entry);
  if (!parsed) return null;
  const origin = `https://${parsed.hostname}`;
  return { origin, boardUrl: `${origin}${BOARD_PATH}` };
}

/**
 * Defence-in-depth endpoint check: rebuild the board URL from an endpoint's
 * hostname alone — HTTPS on a `<tenant>.zohorecruit.com` host only, the fixed
 * list path, port and credentials dropped. Throws on anything else.
 * @param {string} url
 * @returns {string} the normalized board URL
 */
export function assertZohoBoardUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`zoho-recruit: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`zoho-recruit: URL must use HTTPS: ${url}`);
  if (!ZOHO_HOST_RE.test(parsed.hostname)) {
    throw new Error(`zoho-recruit: untrusted hostname "${parsed.hostname}" — must be a <tenant>.zohorecruit.com host`);
  }
  return `https://${parsed.hostname}${BOARD_PATH}`;
}

// A tag ends at an unquoted `>`: a JSON value inside an attribute can carry a
// literal `>`. [spec, review round CAR-86 #20] an unterminated attribute quote
// scans to EOF per `<input` — O(k·n), no catastrophic case found; cap the
// HTML length here if a tenant page ever grows past the scanner's sanity size.
const INPUT_TAG_RE = /<input\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;

/**
 * The raw job records from a list page's `<input id="jobs">`. Throws when the
 * input is missing or its value is not a JSON array — a missing page or a
 * markup change, never an empty board. Exported for tests.
 * @param {unknown} html
 * @returns {any[]}
 */
export function extractZohoListRecords(html) {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('zoho-recruit: empty careers page');
  }
  let value = null;
  for (const [tag] of html.matchAll(INPUT_TAG_RE)) {
    if (!/\sid\s*=\s*["']?jobs["'\s/>]/i.test(tag)) continue;
    const attr = tag.match(/\svalue\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    value = attr ? (attr[1] ?? attr[2] ?? '') : '';
    break;
  }
  if (value === null) {
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    throw new Error(`zoho-recruit: no id="jobs" input on ${BOARD_PATH} — an unknown tenant, or one with only the legacy career site, which is not supported${title ? ` (page title: "${decodeEntities(title)}")` : ''}`);
  }
  let records;
  try {
    records = JSON.parse(decodeEntities(value));
  } catch (err) {
    throw new Error(`zoho-recruit: id="jobs" value is not JSON (${/** @type {Error} */ (err).message})`);
  }
  if (!Array.isArray(records)) {
    const got = records && typeof records === 'object' ? `{${Object.keys(records).join(', ')}}` : typeof records;
    throw new Error(`zoho-recruit: id="jobs" value is not an array, got: ${got}`);
  }
  return records;
}

/**
 * True for a record the career site shows as filled. Exported for tests.
 * @param {any} record
 */
export function isZohoRecordClosed(record) {
  return record?.Is_Locked === true || record?.Publish === false;
}

/**
 * Location from the tenant-configured fields: city, state and country as
 * given, then "Remote" when the posting is flagged remote.
 * @param {any} record
 */
function locationOf(record) {
  const parts = [str(record.City), str(record.State), str(record.Country)].filter(Boolean);
  if (record.Remote_Job === true) parts.push('Remote');
  return [...new Set(parts)].join(', ');
}

/**
 * Normalize one list record, or null when it is filled or lacks a title/id.
 * @param {any} record
 * @param {{ origin: string }} board
 * @param {string} company
 * @returns {{ title: string, url: string, company: string, location: string, externalId: string, postedAt?: number, description?: string } | null}
 */
function normalizeRecord(record, board, company) {
  if (!record || typeof record !== 'object' || isZohoRecordClosed(record)) return null;
  const title = str(record.Posting_Title) || str(record.Job_Opening_Name);
  if (!title) return null;
  const id = typeof record.id === 'number' ? String(record.id) : str(record.id);
  if (!id) return null;
  const seg = safeEncodeURIComponent(id);
  if (seg === null) return null;
  /** @type {{ title: string, url: string, company: string, location: string, externalId: string, postedAt?: number, description?: string }} */
  const job = {
    title,
    url: `${board.origin}${BOARD_PATH}/${seg}`,
    company,
    location: locationOf(record),
    externalId: id,
  };
  const postedAt = toEpochMs(record.Date_Opened);
  if (postedAt !== undefined) job.postedAt = postedAt;
  const description = htmlToText(record.Job_Description);
  if (description) job.description = description;
  return job;
}

/**
 * @param {any[]} records
 * @param {{ origin: string }} board
 * @param {string} company
 * @returns {Array<{ job: { title: string, url: string, company: string, location: string, externalId: string, postedAt?: number, description?: string }, record: any }>}
 */
function pairRecords(records, board, company) {
  const seen = new Set();
  const out = [];
  for (const record of records) {
    const job = normalizeRecord(record, board, company);
    if (!job || seen.has(job.url)) continue;
    seen.add(job.url);
    out.push({ job, record });
  }
  return out;
}

/**
 * List page → normalized jobs. Exported for tests.
 * @param {unknown} html
 * @param {{ origin: string }} board
 * @param {string} company
 */
export function parseZohoJobsPage(html, board, company) {
  return pairRecords(extractZohoListRecords(html), board, company).map(({ job }) => job);
}

const JS_ESCAPES = /** @type {Record<string, string>} */ ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' });

/**
 * Unescape the body of a single-quoted JavaScript string literal (`\x22`,
 * `\u00e9`, `\n`, `\/`, `\-`, `\'`, line continuations). Never evaluates code.
 * @param {string} body
 */
function unescapeJsString(body) {
  return body.replace(/\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|u\{([0-9a-fA-F]{1,6})\}|(\r\n|[\s\S]))/g,
    (_, hex, u4, uBraced, ch) => {
      if (hex) return String.fromCharCode(parseInt(hex, 16));
      if (u4) return String.fromCharCode(parseInt(u4, 16));
      if (uBraced) {
        const cp = parseInt(uBraced, 16);
        return cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
      }
      if (ch === '\n' || ch === '\r' || ch === '\r\n' || ch === '\u2028' || ch === '\u2029') return '';
      return JS_ESCAPES[ch] ?? ch;
    });
}

const DETAIL_RECORD_RE = /\bjobs\s*=\s*JSON\.parse\(\s*'((?:[^'\\]|\\[\s\S])*)'\s*\)/;

/**
 * The posting record embedded in a detail page, or null when the page carries
 * none (a removed posting, an error page, a markup change). Exported for
 * tests (and the same read the parent's liveness-api/browser-extract make).
 * @param {unknown} html
 * @returns {Record<string, any> | null}
 */
export function parseZohoDetailPage(html) {
  if (typeof html !== 'string') return null;
  const match = html.match(DETAIL_RECORD_RE);
  if (!match) return null;
  let parsed;
  try {
    parsed = JSON.parse(unescapeJsString(match[1]));
  } catch {
    return null;
  }
  const record = Array.isArray(parsed) ? parsed[0] : parsed;
  return record && typeof record === 'object' && !Array.isArray(record) ? record : null;
}

// --- Free-text annual-compensation parsing (see the header note) -------------
// Verbatim semantics of the parent's shared _salary-text.mjs, inlined because
// web-ui has no second consumer yet. Extract to a shared module when one does.

/**
 * Rewrite a number's separators into a form parseFloat reads correctly.
 * Both separators mean different things in different markets; which one is
 * the decimal point is decidable from their positions, before either is
 * touched — deleting every comma first turns "45.000,00" into "45.00000".
 * @param {string} numStr - The numeric run, currency already stripped.
 * @returns {string}
 */
function canonicalizeSeparators(numStr) {
  const lastComma = numStr.lastIndexOf(',');
  const lastDot = numStr.lastIndexOf('.');

  // Both present: the LAST one is the decimal separator and the other is
  // grouping. True in both conventions, which is what makes it decidable.
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const grouping = decimal === ',' ? '.' : ',';
    return numStr.split(grouping).join('').replace(decimal, '.');
  }

  // Only one separator, so its role is genuinely ambiguous and is inferred
  // from what follows it: exactly three digits and not a fourth reads as
  // grouping ("35.000", "123,684"), anything else as a decimal point ("82.5").
  const sep = lastComma !== -1 ? ',' : lastDot !== -1 ? '.' : null;
  if (sep === null) return numStr;
  const grouped = new RegExp(`(\\d)\\${sep}(?=\\d{3}(?!\\d))`, 'g');
  return numStr.replace(grouped, '$1').replace(sep, '.');
}

/**
 * Parse a written amount or range into numbers. Annual suffixes and currency
 * tokens are stripped, never interpreted; a non-annual period ("/hr", "per
 * month") leaves the string unparseable, so it returns null rather than a
 * figure in the wrong unit.
 * @param {unknown} raw
 * @returns {{min: number, max: number, mid: number} | null}
 */
function parseAmount(raw) {
  let s = String(raw ?? '').trim();
  if (!s || s === '?' || s === '-' || /^(n\/?a|null)$/i.test(s)) return null;
  const stripAnnual = (value) => value.replace(/\s*(?:\/\s*(?:year|yr)|per\s+(?:year|annum)|annual(?:ly)?|yearly)\s*$/i, '').trim();
  s = stripAnnual(s);
  // Strip currency symbols anywhere (US ranges often repeat the symbol on
  // both bounds) and a trailing 3-letter ISO-4217-style alpha token — exactly
  // three letters, so the lone "k" magnitude suffix ("80k") is never eaten.
  s = s.replace(/[€$£¥]/g, '').replace(/\s*[A-Za-z]{3}\s*$/, '').trim();
  s = stripAnnual(s);
  const toNum = (numStr, kFlag) => {
    const n = parseFloat(canonicalizeSeparators(numStr));
    return Number.isNaN(n) ? null : (kFlag ? n * 1000 : n);
  };
  const range = s.match(/^([\d.,]+)\s*(k)?\s*[-–—]\s*([\d.,]+)\s*(k)?$/i);
  if (range) {
    const lo = toNum(range[1], range[2] || range[4]); // "80-90k": k applies to both
    const hi = toNum(range[3], range[4] || range[2]);
    if (lo === null || hi === null) return null;
    const min = Math.min(lo, hi), max = Math.max(lo, hi);
    return { min, max, mid: (min + max) / 2 };
  }
  const single = s.match(/^([\d.,]+)\s*(k)?$/i);
  if (single) {
    const v = toNum(single[1], single[2]);
    return v === null ? null : { min: v, max: v, mid: v };
  }
  return null;
}

/**
 * The pay period a compensation string names, or null when it names none.
 * @param {unknown} raw
 * @returns {'annual' | 'monthly' | 'hourly' | null}
 */
function compensationPeriod(raw) {
  const value = String(raw ?? '');
  if (/(?:\/\s*(?:year|yr)\b|\bper\s+(?:year|annum)\b|\bannual(?:ly)?\b|\byearly\b)/i.test(value)) return 'annual';
  if (/(?:\/\s*(?:month|mo)\b|\bper\s+month\b|\bmonthly\b)/i.test(value)) return 'monthly';
  if (/(?:\/\s*(?:hour|hr)\b|\bper\s+hour\b|\bhourly\b)/i.test(value)) return 'hourly';
  return null;
}

// Symbols that name exactly one currency. `$` does not (USD, CAD, AUD…).
const CURRENCY_SYMBOLS = /** @type {Record<string, string>} */ ({ '€': 'EUR', '£': 'GBP' });

// ISO-4217 active alpha codes (as of 2026). Any three-capital token is NOT
// necessarily a currency — Indian tenants (the fixtures' Chennai market)
// write "12 LPA" and "CTC", which a bare `[A-Z]{3}` turns into a fake code
// and a wrong-magnitude figure. Only this whitelist reads as a code.
const ISO_4217_CODES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BOV', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD',
  'CAD', 'CDF', 'CHE', 'CHF', 'CHW', 'CLF', 'CLP', 'CNY', 'COP', 'COU', 'CRC', 'CUP', 'CVE', 'CZK',
  'DJF', 'DKK', 'DOP', 'DZD',
  'EGP', 'ERN', 'ETB', 'EUR',
  'FJD', 'FKP',
  'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD',
  'HKD', 'HNL', 'HTG', 'HUF',
  'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK',
  'JMD', 'JOD', 'JPY',
  'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT',
  'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD',
  'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MXV', 'MYR', 'MZN',
  'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD',
  'OMR',
  'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG',
  'QAR',
  'RON', 'RSD', 'RUB', 'RWF',
  'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL',
  'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS',
  'UAH', 'UGX', 'USD', 'USN', 'UYI', 'UYU', 'UYW', 'UZS',
  'VES', 'VND', 'VUV',
  'WST',
  'XAF', 'XCD', 'XDR', 'XOF', 'XPF', 'XSU', 'XTS', 'XUA',
  'YER',
  'ZAR', 'ZMW', 'ZWG', 'ZWL',
];
const CURRENCY_CODE_RE = new RegExp(`(?<![A-Za-z])(?:${ISO_4217_CODES.join('|')})(?![A-Za-z])`, 'g');

// Indian-market magnitude tokens: a figure carrying one is NOT an absolute
// annual amount ("12 LPA" = 12 lakhs per annum ≈ 1,200,000; "8-12 CTC"
// likewise; a bare lakh/lac is a magnitude unit, not a currency). Parsing
// such a figure as the raw number would render it wrong by ~100000x, so the
// compensation is refused outright (null) rather than unit-mangled.
const INDIAN_MAGNITUDE_RE = /\b(?:lpa|ctc|lakhs?|lacs?)\b/i;

/**
 * The currency a compensation string names: its one upper-case three-letter
 * code ("USD"), else its one unambiguous symbol (€, £). `undefined` when it
 * names none, a bare `$` included, so the caller may fall back to another
 * source; `''` when it names more than one, so no fallback overrides the text.
 * @param {unknown} raw
 * @returns {string | undefined}
 */
function compensationCurrency(raw) {
  const text = String(raw ?? '');
  const codes = new Set(text.match(CURRENCY_CODE_RE) || []);
  const symbols = new Set([...text].map((c) => CURRENCY_SYMBOLS[c]).filter(Boolean));
  if (codes.size === 1) return [...codes][0];
  if (codes.size === 0 && symbols.size === 1) return [...symbols][0];
  if (codes.size === 0 && symbols.size === 0) return undefined;
  return '';
}

/**
 * parseAmount() for an annual figure whose string may repeat its currency
 * code after each bound ("65.000 EUR-75.000 EUR"). null when the string names
 * a non-annual period ("$20-25/hr", "5.000 EUR per month") or no amount.
 * @param {unknown} raw
 * @returns {{min: number, max: number, mid: number} | null}
 */
function parseAnnualCompensation(raw) {
  const text = String(raw ?? '');
  const period = compensationPeriod(text);
  if (period && period !== 'annual') return null;
  return parseAmount(text.replace(CURRENCY_CODE_RE, ' ').replace(/\s+/g, ' '));
}

// --- End salary-text helpers --------------------------------------------------

/**
 * Annual salary from a detail record's free-text `Salary` field, never
 * inferred. Currency: the one the text names, else the list record's
 * `Currency` field when the text names none, else unset. A non-annual period
 * ("$20-25/hr") or an unreadable amount yields null. Exported for tests.
 * @param {unknown} salaryText
 * @param {unknown} [listCurrency]
 * @returns {{ min: number, max: number, currency?: string } | null}
 */
export function parseZohoSalary(salaryText, listCurrency) {
  const text = str(salaryText);
  if (!text) return null;
  // LPA / CTC / lakh figures carry their own magnitude unit — reading them as
  // an absolute annual amount is wrong by orders of magnitude. Refuse.
  if (INDIAN_MAGNITUDE_RE.test(text)) return null;
  const amount = parseAnnualCompensation(text);
  if (!amount || !(amount.max > 0)) return null;
  const named = compensationCurrency(text);
  const fallback = /^[A-Za-z]{3}$/.test(str(listCurrency)) ? str(listCurrency).toUpperCase() : '';
  const currency = named === undefined ? fallback : named;
  return { min: amount.min, max: amount.max, ...(currency ? { currency } : {}) };
}

/**
 * Render a parsed salary as the web-ui row's STRING salary field ('' when
 * there is no comp data) — the remotli/agenticjobs convention (web-ui rows
 * carry salary as a display string). Exported for tests.
 * @param {{ min?: unknown, max?: unknown, currency?: unknown } | null} salary
 * @returns {string}
 */
export function renderZohoSalary(salary) {
  if (!salary || typeof salary !== 'object') return '';
  const min = Number(salary.min);
  const max = Number(salary.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > 0)) return '';
  const currency = str(salary.currency).toUpperCase();
  const cur = currency ? ` ${currency}` : '';
  return `${Math.min(min, max)}–${Math.max(min, max)}${cur}`;
}

/**
 * Read the `zohoRecruit:` block of an entry: fetchDetails is opt-in (true
 * only), and detailLimit is a cap in 1..100 — it is never what turns
 * enrichment on. Exported for tests.
 * @param {any} entry
 * @returns {{ fetchDetails: boolean, detailLimit: number }}
 */
export function parseZohoConfig(entry) {
  const cfg = (entry && entry.zohoRecruit) || {};
  return {
    fetchDetails: cfg.fetchDetails === true,
    detailLimit: intInRange(cfg.detailLimit, 25, 1, 100),
  };
}

/**
 * `fetchText` with the parent's retry budget. Only transient failures are
 * retried: HTTP 429, HTTP 5xx, and network errors that carry no status. A
 * permanent 4xx (which is how the exhausted detail budget surfaces), and a
 * refused redirect (undici's `unexpected redirect`), are rethrown at once.
 * @param {Function} fetchImpl
 * @param {string} url
 * @param {{ signal?: AbortSignal, retries: number, retryDelayMs: number,
 *           headers: Record<string, string> }} o
 */
async function fetchTextWithRetry(fetchImpl, url, { signal, retries, retryDelayMs, headers }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchText(/** @type {any} */ (fetchImpl), url, { signal, headers, redirect: 'error' });
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === 'number' ? err.status : undefined;
      const redirectRefusal = status === undefined
        && err instanceof TypeError
        && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
      const transient = !redirectRefusal && (status === undefined || status === 429 || status >= 500);
      if (!transient || attempt === retries || signal?.aborted) throw err;
      await delay(computeRetryDelayMs({
        attempt, baseDelayMs: retryDelayMs, maxDelayMs: RETRY_MAX_DELAY_MS, retryAfter: err?.retryAfter,
      }), signal);
    }
  }
  throw lastErr;
}

const PAGE_HEADERS = { 'User-Agent': UA, Accept: 'text/html' };

/**
 * Fill description, postedAt and salary from each posting's own page.
 * Best-effort: a failed or unreadable detail fetch, or a page whose record is
 * not this posting's, keeps the list row.
 * @param {Array<{ job: any, record: any }>} rows
 * @param {{ fetchImpl: Function, signal?: AbortSignal, detailDelayMs: number,
 *           retries: number, retryDelayMs: number, detailLimit: number }} o
 */
async function enrichFromDetails(rows, { fetchImpl, signal, detailDelayMs, retries, retryDelayMs, detailLimit }) {
  // detailLimit caps HTTP requests, retries included: fetchTextWithRetry may
  // make several attempts per posting, so the budget is counted at the
  // transport, not per candidate. Once it is spent the next attempt fails
  // with a non-retryable error and the loop stops.
  let requests = 0;
  const budgetedFetch = async (url, fetchOpts) => {
    if (requests >= detailLimit) {
      const err = new Error('zoho-recruit: detail request budget exhausted');
      // A 4xx status marks the error non-retryable in the retry helper.
      err.status = 400;
      throw err;
    }
    requests++;
    // The guarded raw-Response transport (FULL-R2 lint): the retry helper
    // needs a Response, and the request must still pass the DNS-rebinding
    // guard like every other zoho-recruit request.
    return fetchRawResponse(fetchImpl, url, fetchOpts);
  };

  for (let i = 0; i < rows.length; i++) {
    if (requests >= detailLimit) break;
    if (signal?.aborted) break;
    if (i > 0 && detailDelayMs > 0) await delay(detailDelayMs, signal);
    const { job, record } = rows[i];
    try {
      // assertZohoBoardUrl() ran on the board; job.url was built from the same
      // origin and a safeEncodeURIComponent'd id, so the detail URL stays on
      // the tenant host by construction.
      const html = await fetchTextWithRetry(budgetedFetch, job.url, { signal, retries, retryDelayMs, headers: PAGE_HEADERS });
      const detail = parseZohoDetailPage(html);
      if (!detail || String(detail.id) !== job.externalId) continue;
      const description = htmlToText(detail.Job_Description);
      if (description) job.description = description;
      if (job.postedAt === undefined) {
        const postedAt = toEpochMs(detail.Date_Opened);
        if (postedAt !== undefined) job.postedAt = postedAt;
      }
      const salary = parseZohoSalary(detail.Salary, record.Currency);
      if (salary) job.salary = salary;
    } catch {
      // Detail enrichment is opt-in; keep the list row as-is.
    }
  }
}

function normalize(row, entry) {
  return {
    id: `zoho-recruit-${row.externalId}`,
    title: row.title,
    company: row.company || String(entry?.name ?? ''),
    url: row.url,
    salary: renderZohoSalary(row.salary),
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(row.title),
    workplaceType: row.location.includes('Remote') ? 'Remote' : '',
    relocates: false,
    date: row.postedAt !== undefined ? new Date(row.postedAt).toISOString() : '',
    snippet: row.description ? String(row.description).slice(0, SNIPPET_CAP) : '',
    source: 'zoho-recruit',
  };
}

/**
 * Fetch + normalize one Zoho Recruit tenant's board (one list request, plus
 * opt-in bounded detail enrichment).
 *
 * @param {string} endpoint - a board URL on a <tenant>.zohorecruit.com host
 *   (asserted and normalized to the fixed list path here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           detailDelayMs?: number, retries?: number, retryDelayMs?: number }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchZohoRecruit(endpoint, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company = {},
    detailDelayMs = INTER_REQUEST_DELAY_MS,
    retries = RETRIES,
    retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  const entry = company ?? {};
  // Host allowlist before any request (SSRF guard): only the hostname is used;
  // the board is always read from the fixed list path.
  const boardUrl = assertZohoBoardUrl(endpoint);
  const origin = new URL(boardUrl).origin;

  const html = await fetchTextWithRetry(fetchImpl, boardUrl, { signal, retries, retryDelayMs, headers: PAGE_HEADERS });
  const rows = pairRecords(extractZohoListRecords(html), { origin }, str(entry?.name));

  const { fetchDetails, detailLimit } = parseZohoConfig(entry);
  if (fetchDetails && rows.length) {
    await enrichFromDetails(rows, { fetchImpl, signal, detailDelayMs, retries, retryDelayMs, detailLimit });
  }
  return rows.map(({ job }) => normalize(job, entry));
}
