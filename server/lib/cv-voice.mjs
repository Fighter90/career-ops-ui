/**
 * cv-voice.mjs — stock-phrase lint for CV text (CAR-188, ported from upstream
 * career-ops #6178 `cv-voice.mjs`).
 *
 * A draft that says "spearheaded", "proven track record", or writes a
 * brand-new em dash reads like a template, not like the candidate.
 * detectStockPhrases() lints any pasted text for the stock phrases upstream
 * bans plus em/en dashes that are NOT date ranges, and reports each hit with
 * a 1-based line number so a UI can highlight it.
 *
 * Honest divergences from the upstream module (this repo has no
 * `verify-cv-facts.mjs` to import `stripMarkup`/`metricClaims` from):
 *   - markup stripping is a small self-contained tag stripper below (bounded
 *     passes + a leftover angle-bracket sweep, the shape the add-entry route
 *     in routes/cv-studio.mjs uses). Upstream strips with its own
 *     `stripMarkup(text, { keepLineBreaks: true })`; the effect here is the
 *     same — tags break lines, <head> (whose <title> carries the template's
 *     own "Name — CV" separator) is dropped entirely.
 *   - upstream's `voiceIssues(generated, source)` also detects INVENTED
 *     NUMBERS via `metricClaims()` against the source CV. That half is
 *     deliberately out of scope: this repo already covers claim-vs-source
 *     checking with POST /api/cv-studio/verify-facts (verify-cv-facts.mjs
 *     relay). detectStockPhrases(text) is a source-free lint — every banned
 *     phrase or non-date-range dash in the text is reported, and the reader
 *     (the candidate) decides.
 */

export const BANNED_PHRASES = [
  'passionate about',
  'results-oriented',
  'results-driven',
  'proven track record',
  'leveraged',
  'leveraging',
  'leverage',
  'spearheaded',
  'spearheading',
  'spearhead',
  'facilitated',
  'facilitating',
  'synergies',
  'synergy',
  'cutting-edge',
  'cutting edge',
  "in today's fast-paced world",
  'demonstrated ability to',
  'best practices',
  'significant impact',
  'measurable impact',
  'orchestrated',
  'championed',
  'utilized',
  'delve',
  'tapestry',
  'pivotal',
];

const EM_DASH = '\u2014';
const EN_DASH = '\u2013';

// A dash between two years is how a range is written, not a stock tell —
// "2022–2024" (also "Mar 2020 — Present", "2021–current"). A metric such as
// "20–30%" is not a date, so it stays a tell.
const YEAR = '(?:19|20)\\d{2}';
const AFTER_YEAR_RE = new RegExp(`${YEAR}\\s*$`);
const RANGE_TAIL_RE = new RegExp(`^\\s*(?:${YEAR}\\b|present\\b|current\\b|now\\b|today\\b)`, 'i');

/**
 * Bounded, line-preserving markup strip. Upstream imports its own
 * `stripMarkup` from verify-cv-facts.mjs (which does not exist in this repo);
 * this is the local stand-in: the <head>/<title> block and comments are
 * dropped outright, <br> and block closers become line breaks, then the
 * remaining tags are removed to a fixed point with a final angle-bracket
 * sweep, so no partial tag can survive. Newlines are preserved.
 * @param {unknown} text
 * @returns {string[]}
 */
function linesOf(text) {
  let out = String(text ?? '')
    // The <head> is not printed. Its <title> carries the template's own
    // "Name — CV" separator, which the candidate never wrote.
    .replace(/<head[\s>][\s\S]*?<\/head>/gi, '\n')
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h\d|div|tr|section|article)>/gi, '\n');
  let prev;
  let passes = 0;
  do { prev = out; out = out.replace(/<[^>]*>/g, ' '); } while (out !== prev && ++passes < 8);
  return out.replace(/[<>]/g, ' ').replace(/\r\n?/g, '\n').split('\n');
}

/**
 * Case/space-folded matcher for one banned phrase: the phrase is escaped,
 * its inner whitespace becomes `\s+` (the norm-comparison equivalent, but
 * offsets stay valid against the raw line for highlighting), and Unicode
 * word boundaries keep `leverage` out of `unleveraged`.
 * @param {string} phrase
 */
function phraseRe(phrase) {
  const body = phrase
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu');
}

const PHRASE_RES = BANNED_PHRASES.map((phrase) => ({ phrase, re: phraseRe(phrase) }));

function isDateRangeDash(line, at) {
  return AFTER_YEAR_RE.test(line.slice(0, at)) && RANGE_TAIL_RE.test(line.slice(at + 1));
}

/**
 * Lint text for stock phrasing: every banned phrase occurrence plus every
 * em/en dash that is not inside a date range.
 *
 * @param {unknown} text
 * @returns {{ phrase: string, line: number, match: string, index: number, lineText: string }[]}
 *   `line` is 1-based over the post-markup line breakdown (for plain text or
 *   markdown that is the raw line numbering); `match` is the exact text as it
 *   appears; `index` is the offset of `match` within `lineText`.
 */
export function detectStockPhrases(text) {
  const findings = [];
  const lines = linesOf(text);
  lines.forEach((lineText, i) => {
    const line = i + 1;
    const push = (phrase, match, index) => {
      findings.push({ phrase, line, match, index, lineText });
    };
    for (const [name, ch] of [['em dash', EM_DASH], ['en dash', EN_DASH]]) {
      let at = lineText.indexOf(ch);
      while (at !== -1) {
        if (!isDateRangeDash(lineText, at)) push(name, ch, at);
        at = lineText.indexOf(ch, at + 1);
      }
    }
    for (const { phrase, re } of PHRASE_RES) {
      re.lastIndex = 0;
      for (let m = re.exec(lineText); m; m = re.exec(lineText)) {
        push(phrase, m[0], m.index);
        if (m.index === re.lastIndex) re.lastIndex++; // zero-width paranoia
      }
    }
  });
  return findings;
}
