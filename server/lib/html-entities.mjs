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
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

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
export function decodeEntities(s) {
  return String(s).replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return isEmittableCodePoint(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}
