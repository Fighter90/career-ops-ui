import { ENTITIES, LEGACY_NAMES } from './html-entity-table.mjs';

// Shared HTML-entity decoder for the in-process scraping sources whose feeds
// return raw HTML (as opposed to a JSON API). Centralised so the numeric-entity
// guard can't drift between per-source copies.
//
// Background: oraclecloud/gem/dassault each carried a copy that guarded only
// with `Number.isFinite(code)` before calling `String.fromCodePoint(code)`.
// That still throws a RangeError for a code point above 0x10FFFF (e.g.
// `&#99999999;`), crashing the whole parse for a single malformed/adversarial
// entity. Centralised here so the guard is defined once.
//
// The hex/decimal alternatives are matched separately (not `#x?[0-9a-fA-F]+`)
// so a decimal entity can never absorb trailing hex letters — `&#1a2;` no
// longer parses as codepoint 1 and drops `a2`; it fails to match and passes
// through untouched, like any other malformed entity.
// The XML five plus nbsp, then the Latin-1 letter entities. The letters are not
// decoration: a European board writes `D&eacute;veloppeur` and `Fran&ccedil;ais`
// in its HTML, and leaving those literal puts `D&eacute;veloppeur` in a job
// title, the tracker, and every document generated from it. Sources that needed
// them grew private tables instead; centralising them here ends that drift.
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  // French / Portuguese / Spanish / German / Nordic letters, lower and upper.
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ',
  ccedil: 'ç',
  egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï',
  ntilde: 'ñ',
  ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü',
  yacute: 'ý', yuml: 'ÿ', szlig: 'ß',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aring: 'Å', AElig: 'Æ',
  Ccedil: 'Ç',
  Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë',
  Igrave: 'Ì', Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï',
  Ntilde: 'Ñ',
  Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', Oslash: 'Ø',
  Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û', Uuml: 'Ü',
  Yacute: 'Ý',
  // Punctuation these same pages emit around titles.
  deg: '°', hellip: '…', laquo: '«', raquo: '»', ndash: '–', mdash: '—',
  // URL punctuation and whitespace for the default (title) decoder. Attribute mode
  // reads the full table in html-entity-table.mjs, not this one.
  colon: ':', sol: '/',
  Tab: '\t', NewLine: '\n',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', middot: '·', euro: '€',
};

// HTML maps the numeric references 0x80-0x9F to windows-1252; five of them have no mapping and stay C1 controls.
const WINDOWS_1252_C1 = '\u20ac\u0081\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u008d\u017d\u008f\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u009d\u017e\u0178';

// Only these are matched case-insensitively (legacy pages do write `&AMP;`).
// The letter entities are CASE-SENSITIVE — `&Eacute;` is É, not é — so a blanket
// lowercased lookup would make every uppercase entry unreachable.
const CASE_INSENSITIVE_NAMES = new Set(['amp', 'lt', 'gt', 'quot', 'apos', 'nbsp']);

/**
 * Whether a numeric reference names a code point this decoder will emit.
 *
 * The set is XML 1.0 §2.2 Char — used instead of a bare `code <= 0x10FFFF`
 * bound because that bound only stops fromCodePoint from throwing; it still
 * admits NUL, the C0 controls, lone surrogates, and the noncharacters U+FFFE /
 * U+FFFF. A decoded title flows into scan history, the pipeline, the tracker
 * and generated documents, where a NUL or lone surrogate truncates
 * C-string-backed consumers and produces ill-formed UTF-8. Tab/LF/CR are kept
 * (legal per §2.2, and callers already normalize whitespace). NaN fails every
 * comparison, so this single predicate also subsumes the old isFinite/range
 * checks and fromCodePoint cannot throw on what survives it.
 *
 * @param {number} code
 * @returns {boolean}
 */
export function isEmittableCodePoint(code) {
  return code === 0x9 || code === 0xa || code === 0xd
    || (code >= 0x20 && code <= 0xd7ff)
    || (code >= 0xe000 && code <= 0xfffd)
    || (code >= 0x10000 && code <= 0x10ffff);
}

/**
 * Decode named (&amp; &lt; …) and numeric (&#252; / &#xfc;) HTML entities.
 * Anything outside the emittable set, or any malformed reference, is left
 * exactly as written.
 *
 * @param {string} s
 * @returns {string}
 */
// The default mode: a reference with its semicolon, the decimal and hex forms as separate
// alternatives. An HTML parser also decodes a numeric reference in an attribute value with no
// semicolon (`&#58//x` is `://x`), so a caller that inspects an attribute needs `bareNumeric`.
const STRICT_REF = /&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g;
// Attribute mode reads the whole WHATWG table (html-entity-table.mjs). A name decodes when it
// ends in a semicolon and is in the table. Otherwise the longest legacy name that prefixes it
// decodes with no semicolon, unless an alphanumeric or `=` follows it (`&amp=1`, `&ampx` and
// `&notit;` stay as written). Each run of name characters starts at its own `&`, so one pass is linear.
const ATTRIBUTE_REF = /&(?:(#[xX][0-9a-fA-F]+|#[0-9]+);?|([a-zA-Z][a-zA-Z0-9]*)(;?))/g;
const LEGACY_MAX = 6;

/**
 * Decode named (&amp; &lt; …) and numeric (&#252; / &#xfc;) HTML entities.
 * Anything outside the emittable set, or any malformed reference, is left
 * exactly as written.
 *
 * @param {string} s
 * @param {{bareNumeric?: boolean, text?: boolean}} [opts] `bareNumeric` reads
 *   an attribute value the way a browser's tokenizer does: the full WHATWG
 *   table, legacy names with no semicolon, windows-1252 C1, U+FFFD for the
 *   unemittable. `text` relaxes the legacy guard further (the tokenizer's data
 *   state decodes `&quothttps` as `"https`). The default keeps the strict
 *   title contract unchanged for every existing caller.
 * @returns {string}
 */
export function decodeEntities(s, { bareNumeric = false, text = false } = {}) {
  if (bareNumeric) return String(s).replace(ATTRIBUTE_REF, (m, numeric, name, semi, at) => {
    if (numeric === undefined) {
      if (semi && Object.hasOwn(ENTITIES, name)) return ENTITIES[name];
      for (let n = Math.min(name.length, LEGACY_MAX); n >= 2; n--) {
        const head = name.slice(0, n);
        if (!LEGACY_NAMES.has(head)) continue;
        const next = n < name.length ? name[n] : s[at + m.length];
        if (text) return ENTITIES[head] + name.slice(n) + semi;
        return next !== undefined && /[A-Za-z0-9=]/.test(next) ? m : ENTITIES[head];
      }
      return m;
    }
    const isHex = numeric[1] === 'x' || numeric[1] === 'X';
    const code = parseInt(numeric.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    // An attribute caller sees what the browser sees: NUL, a surrogate and a
    // code point past U+10FFFF become U+FFFD, and every other reference
    // decodes, a leading C0 control included (the URL parser strips it).
    if (code >= 0x80 && code <= 0x9f) return WINDOWS_1252_C1[code - 0x80];
    return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? '\ufffd' : String.fromCodePoint(code);
  });
  return String(s).replace(STRICT_REF, (m, ref) => {
    if (ref[0] === '#') {
      const isHex = ref[1] === 'x' || ref[1] === 'X';
      const code = parseInt(ref.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return isEmittableCodePoint(code) ? String.fromCodePoint(code) : m;
    }
    // Letter entities are CASE-SENSITIVE (`&Eacute;` → É). Exact-case lookup
    // first; only the XML-five + nbsp fall back case-insensitively. `Object.hasOwn`
    // (not `NAMED_ENTITIES[body]`) so `&constructor;` / `&toString;` resolve to
    // themselves, never an inherited Object.prototype member.
    if (Object.hasOwn(NAMED_ENTITIES, ref)) return NAMED_ENTITIES[ref];
    const lower = ref.toLowerCase();
    return CASE_INSENSITIVE_NAMES.has(lower) ? NAMED_ENTITIES[lower] : m;
  });
}
