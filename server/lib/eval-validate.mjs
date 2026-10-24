/**
 * Evaluation-report shape validation (v1.75.0).
 *
 * The `/api/evaluate` Gemini branch shells out to a `gemini-eval.mjs` script
 * whose `validateEvaluationShape()` makes a malformed Gemini evaluation surface
 * as an error instead of saving garbage, so it inherits that guard. But web-ui
 * ALSO runs evaluations IN-PROCESS through Anthropic / OpenAI / Qwen /
 * OpenRouter / GitHub Models — those responses were returned with no shape
 * check at all.
 *
 * This is the in-process analog. Rather than throwing to abort a CLI, web-ui
 * returns a list of issues so the route can attach them as a non-fatal
 * `warnings` array — the SPA still receives the artifact, but the caller is
 * told the report looks malformed (e.g. truncated by MAX_TOKENS). The checks
 * mirror the `validateEvaluationShape` contract exactly.
 *
 * @param {string} text the model's evaluation markdown
 * @returns {string[]} issue messages — empty array means the shape is valid
 */
/**
 * v1.248.8 (CAR-74) — detect a REPEATED block heading and cut the report at
 * its first occurrence. A model that repeats Block B (the 46 587-char ta
 * report on prod) is looping; everything after the first repeat is garbage
 * the validator would read as missing blocks anyway. Returns the cut text
 * plus what happened, so the caller can warn instead of filing half a
 * report silently.
 *
 * CAR-92: the heading scan tightened (see scanBlockLetterHeadings) — a
 * subheading like `### Option A` no longer counts as a block heading, so a
 * valid report with such subheadings is never destroyed; only a repeated
 * heading at the report's own block-heading level cuts.
 *
 * @param {string} text
 * @returns {{ text: string, cut: boolean, letter: string | null, at: number }}
 */
export function cutRepeatedBlockHeadings(text) {
  const src = String(text ?? '');
  const headings = scanBlockLetterHeadings(src);
  if (!headings.length) return { text: src, cut: false, letter: null, at: -1 };
  const ref = referenceHeadingLevel(headings);
  const seen = new Set();
  for (const h of headings) {
    if (h.level !== ref) continue; // subheadings never count (CAR-92)
    if (seen.has(h.letter)) {
      return { text: src.slice(0, h.pos).replace(/\s*$/, ''), cut: true, letter: h.letter, at: h.pos };
    }
    seen.add(h.letter);
  }
  return { text: src, cut: false, letter: null, at: -1 };
}

// ── Block-heading scan (CAR-92) ─────────────────────────────────────────────
// A block heading is a `#`–`###` heading carrying a STANDALONE A–G letter
// (Latin, or the Cyrillic look-alikes А В С Е) that is FOLLOWED by a
// separator — `)`, a dash, a colon, a dot, a bracket, a comma — or ends the
// line. `## Block A — …`, `## A) …`, `## Blok A. Sekcja` are block headings;
// `### Plan B`, `### Q&A`, `### A1` and `## About` are not.
// Review round 2: bold headings (`**Block A** — x`), bracketed letters
// (`[A] x`), the fullwidth paren （）, the CJK enumerator 、, the pipe/asterisk
// forms, and CRLF output (the `\r` before the newline) all terminated real
// headings and were rejected. The CJK case is its own regex: `ブロックA 役割`
// glues the letter to the block word (CJK has no spaces), so a WHITESPACE
// after the letter is the separator — allowed only when the character before
// the letter is CJK.
const LETTER_TERMINATOR = '(?=[ \\t]*[)\\]\\uFF09\\u3011\\u3001,:\\uFF1A.\\uFF0E|*\\u2013\\u2014-]|[ \\t]*\\r?$)';
// The letter must close a CJK compound (a CJK char immediately before it), then
// any separator — or just whitespace/line end, which in CJK IS the separator.
const LETTER_TERMINATOR_CJK = '(?=[ \\t]*[)\\]\\uFF09\\u3011\\u3001,:\\uFF1A.\\uFF0E|*\\u2013\\u2014-]|[ \\t]|\\r?$)';
// CJK ideographs + kana (2E80–9FFF), hangul (AC00–D7AF), compatibility ideographs (F900–FAFF).
const CJK_CHAR = '[\\u2E80-\\u9FFF\\uAC00-\\uD7AF\\uF900-\\uFAFF]';

// Spelled-out letters (Arabic abjad أ ب ج د هـ و ز; Devanagari ए बी सी …):
// the letter must be followed by a separator — for the cutter too. A bare
// letter — line end, or another word after it — is ordinary prose («و» IS
// the Arabic word "and"; CAR-92: `## تحليل و تطوير` must not satisfy Block F).
// Review round 2: `:` (ASCII/fullwidth) and `.` separators — `## أ: x`,
// `## ए. x` — are real heading forms and were false-rejected.
const SPELLED_TERMINATOR = `(?=[ \\t]*[)\\u2014\\u2013\\-.:\\uFF1A\\uFF0E])`;

// Heading LEVELS matter (CAR-92): only headings at the report's own
// block-heading level count, so a subheading can neither cut a report nor
// fake a missing block. The reference level is the MOST COMMON level among
// the scanned letter headings (a stray early subheading must not set it).
function scanBlockLetterHeadings(text) {
  const found = [];
  for (const [label, ...regexes] of blockLetterRegexes()) {
    for (const re of regexes) {
      for (const m of text.matchAll(re)) {
        // `at` — the letter's own offset in the text (the letter is the last
        // character the regex consumed).
        found.push({ pos: m.index, at: m.index + m[0].length - 1, level: headingLevel(m[0]), letter: label });
      }
    }
  }
  // Review round 2 — one heading used to register SEVERAL letters (one regex
  // per letter, each free to match a DIFFERENT letter of the heading text:
  // «## G) Interview Q&A» also registered the trailing A, «## D) Plan B» the
  // B, «## F) Red Flags (Grade: D)» the graded D). The validator then read
  // «Plan B» as a present Block B and the cutter truncated at the wrong
  // heading. Only the EARLIEST letter of each heading counts — the one its
  // author wrote as the block letter.
  const byPos = new Map();
  for (const h of found) {
    const cur = byPos.get(h.pos);
    if (!cur || h.at < cur.at) byPos.set(h.pos, h);
  }
  return [...byPos.values()].sort((a, b) => a.pos - b.pos);
}

function headingLevel(heading) {
  return (heading.match(/^#+/) || ['#'])[0].length;
}

function referenceHeadingLevel(headings) {
  // Review round 2 — the MOST COMMON level false-rejects a report whose
  // blocks carry recurring same-shaped subsections: seven blocks with an
  // `### A. Strengths` / `### B. Gaps` pair each give 14 headings at `###`
  // against 7 at `##`, `###` wins the count, and C–G read as missing. The
  // block-heading level is the one carrying the most DISTINCT letters; ties
  // go to the shallowest (block headings are the outer letter level).
  const per = new Map(); // level → { letters: Set, }
  for (const h of headings) {
    let e = per.get(h.level);
    if (!e) { e = { letters: new Set() }; per.set(h.level, e); }
    e.letters.add(h.letter);
  }
  let best = null;
  for (const [level, e] of per) {
    if (!best || e.letters.size > best.size
      || (e.letters.size === best.size && level < best.level)) {
      best = { level, size: e.letters.size };
    }
  }
  return best ? best.level : -1;
}

// Per-block letter → [latin regex, spelled regex]. Built fresh per call —
// validateEvaluationReport runs once per evaluation, the cost is noise.
function blockLetterRegexes() {
  // Cyrillic look-alikes are accepted INSIDE the Latin classes (А looks like
  // A, В like B, С like C, Е like E) — a translated report keeps its Latin
  // letter but the model often writes the look-alike.
  const LOOKALIKE = { A: 'АA', B: 'ВB', C: 'СC', E: 'ЕE' };
  // An Arabic report writes the block letter in abjad order (أ ب ج د هـ و ز)
  // however the prompt asks — three live runs in a row (v1.239.x). Accepted
  // only as a standalone word followed by a separator, so a letter inside an
  // Arabic word — or «و» the conjunction — never counts.
  const ABJAD = { A: 'أ|ا|إ|آ', B: 'ب', C: 'ج', D: 'د', E: 'هـ|ه', F: 'و', G: 'ز' };
  // A Hindi report spells the letter out in Devanagari: `## ए)`, `## बी)` …
  // `## जी)` (local deepseek run, 2026-10-07). Same standalone + separator rule.
  const DEVANAGARI = { A: 'ए', B: 'बी', C: 'सी', D: 'डी', E: 'ई', F: 'एफ़|एफ', G: 'जी' };
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => [
    L,
    new RegExp(`^#{1,3}[ \\t]*[^\\n]{0,24}?(?<![A-Za-z\\u0400-\\u04FF])[${LOOKALIKE[L] || L}](?![A-Za-z\\u0400-\\u04FF])${LETTER_TERMINATOR}`, 'gmu'),
    new RegExp(`^#{1,3}[ \\t]*[^\\n]{0,24}?${CJK_CHAR}[${LOOKALIKE[L] || L}](?![A-Za-z\\u0400-\\u04FF])${LETTER_TERMINATOR_CJK}`, 'gmu'),
    new RegExp(`^#{1,3}[ \\t]*[^\\n]{0,24}?(?<![\\p{L}\\p{M}])(?:${ABJAD[L]}|${DEVANAGARI[L]})${SPELLED_TERMINATOR}`, 'gmu'),
  ]);
}

export function validateEvaluationReport(text) {
  const issues = [];
  if (typeof text !== 'string' || text.trim() === '') return ['empty evaluation report'];

  // CAR-92: one shared scan feeds the block check — each letter counts only
  // at the report's reference heading level (see scanBlockLetterHeadings).
  const requiredBlocks = blockLetterRegexes();
  const headings = scanBlockLetterHeadings(text);
  const ref = headings.length ? referenceHeadingLevel(headings) : -1;
  const present = new Set(headings.filter((h) => h.level === ref).map((h) => h.letter));
  for (const [label] of requiredBlocks) {
    if (!present.has(label)) issues.push(`missing Block ${label}`);
  }

  // A Ukrainian report numbers the blocks with the Ukrainian alphabet order
  // (А Б В Г Д Є Ж — positionally A..G). Accepted ONLY when the headings
  // appear as a sequence (each next letter after the previous one) — resolves
  // the lookalike conflict (В is both «B» and the 3rd Ukrainian letter, so an
  // isolated В cannot be trusted, but А→Б→В→Г→Д→Є→Ж in order can only be the
  // block numbering).
  // CAR-92: the letters must be STANDALONE in the heading (`## А) Роль`) —
  // the first character of any heading word let a Russian report's ordinary
  // headings («Анализ», «Бюджет», «Выводы», «Гибкость») clear A–D with no
  // block letters at all. And the Russian-tail numbering (…Д Е Ж) is
  // accepted alongside the Ukrainian tail (…Д Є Ж) — the prompt's example
  // names the Ukrainian order, but a Russian-numbered report broke at Є and
  // was false-rejected.
  const UKR_SEQS = [
    ['А', 'Б', 'В', 'Г', 'Д', 'Є', 'Ж'],
    ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж'],
  ];
  const headingStarts = [];
  for (const m of text.matchAll(/^#{1,3}[ \t]*([^\n]{0,40})$/gm)) {
    const standalone = m[1].match(/(?<![\p{L}])([АБВГДЕЄЖ])(?![\p{L}])/u);
    headingStarts.push({ pos: m.index, ch: standalone ? standalone[1] : null });
  }
  let best = [];
  for (const seq of UKR_SEQS) {
    let cursor = -1;
    const found = [];
    for (const want of seq) {
      const at = headingStarts.findIndex((h) => h.pos > cursor && h.ch === want);
      if (at === -1) break;
      cursor = headingStarts[at].pos;
      found.push(want);
    }
    if (found.length > best.length) best = found;
  }
  if (best.length >= 3) {
    for (let i = 0; i < best.length; i++) {
      const label = requiredBlocks[i][0];
      const at = issues.indexOf(`missing Block ${label}`);
      if (at !== -1) issues.splice(at, 1);
    }
  }

  const summary = text.match(/---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/);
  if (!summary) {
    issues.push('missing SCORE_SUMMARY block');
  } else {
    const summaryBlock = summary[1];
    // [ \t]*, not \s*: \s crosses newlines, so an EMPTY `ROLE:` line would
    // capture the next line ("SCORE: 4.1") as its value and pass.
    for (const key of ['COMPANY', 'ROLE', 'ARCHETYPE', 'LEGITIMACY']) {
      const field = summaryBlock.match(new RegExp(`^[ \\t]*${key}:[ \\t]*(.+)$`, 'mi'));
      const value = field?.[1]?.trim() ?? '';
      // COMPANY may legitimately be "unknown"; the others may not.
      if (!value || (key !== 'COMPANY' && value.toLowerCase() === 'unknown')) {
        issues.push(`SCORE_SUMMARY ${key} is required`);
      }
    }
    // CAR-92 — one score parser, shared with the auto-pipeline extractor, so
    // a report the validator accepts can never be read with a different score.
    const scoreValue = summaryScoreValue(summaryBlock);
    if (scoreValue == null) {
      issues.push('SCORE_SUMMARY score must be a number between 0 and 5');
      // v1.248.2 (da regression) — when the score check fails, the server log
      // gets ONLY the SCORE: line itself (trimmed, capped). CI logs are public:
      // no other report content (JD/CV quotes, company prose) may be printed.
      const scoreLine = summaryBlock.match(/^[ \t]*(?:\*\*)?[ \t]*SCORE[ \t]*(?:\*\*)?[ \t]*:[ \t]*(.*)$/mi);
      if (scoreLine) {
        console.warn(`[eval-validate] invalid score — SCORE line: ${JSON.stringify(scoreLine[0].trim().slice(0, 120))}`);
      }
    }
  }

  return issues;
}

/**
 * CAR-92 — the global score, read ONLY from the ---SCORE_SUMMARY--- block,
 * localized digits folded through asciiNumber. The auto-pipeline's own
 * extractor used to re-scan the whole report (`score: 4/5` in a Block B
 * sub-table won; `SCORE: 4,2` read as 4; native digits read as null) and
 * disagree with this validator. Returns null when the summary is absent,
 * has no SCORE line, or the value is outside 0–5.
 * @param {string} text the full report (or any string)
 * @returns {number | null}
 */
export function extractSummaryScore(text) {
  const summary = String(text ?? '').match(/---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/);
  if (!summary) return null;
  return summaryScoreValue(summary[1]);
}

/**
 * Review round 2 (gemini-eval.mjs subprocess path) — the LAST-RESORT whole-
 * report score scan. The subprocess prints the parent's oferta report, whose
 * machine summary block only exists when the model (or the script's own
 * prompt) asked for one; the body's `Score: x/5` line — the parent's saved
 * header form is `**Score:** 4.2/5` — is then the only score source. Reads
 * line-anchored score lines (never mid-sentence prose), folds localized
 * digits through asciiNumber, and keeps the same 0–5 gate as the summary
 * parser. Callers use it only where the summary block cannot exist.
 * @param {string} text the full report
 * @returns {number | null}
 */
export function extractBodyScore(text) {
  const src = String(text ?? '');
  if (!src) return null;
  for (const line of src.split('\n')) {
    const m = asciiNumber(line)
      .match(/^[ \t]*(?:\*\*)?[ \t]*score[ \t]*(?:\*\*)?[ \t]*[:：\-–—][ \t]*(?:\*\*)?[ \t]*([0-9]+(?:\.[0-9]+)?)/i);
    if (!m) continue;
    const value = Number(m[1]);
    if (Number.isFinite(value) && value >= 0 && value <= 5) return value;
  }
  return null;
}

/** SCORE line → 0–5 number or null. Callers pass the summary block's text. */
function summaryScoreValue(summaryBlock) {
  const scoreLine = summaryBlock.match(/^[ \t]*(?:\*\*)?[ \t]*SCORE[ \t]*(?:\*\*)?[ \t]*:[ \t]*(.*)$/mi);
  if (!scoreLine) return null;
  const m = asciiNumber(scoreLine[1]).match(/^[*_ \t]*([0-9]+(?:\.[0-9]+)?)/);
  const value = m ? Number(m[1]) : NaN;
  return Number.isFinite(value) && value >= 0 && value <= 5 ? value : null;
}

/**
 * Localized digits → ASCII, then comma disambiguation:
 *  - a separator followed by 1–2 digits is DECIMAL («4,2» → 4.2, the da/fr
 *    form) — Arabic decimal \u066B and fullwidth full stop \uFF0E behave alike;
 *  - a comma followed by EXACTLY 3 digits is a THOUSANDS separator
 *    («4,200» → 4200). The old code read it as 4.200 = 4.2 and passed the
 *    0..5 gate — the exact false positive the v1.248.2 regression flagged.
 * Ambiguous runs (4 digits+, several commas) are left untouched so the
 * score match simply fails and the report is flagged instead of misread.
 */
const DIGIT_ZEROS = [0x0660, 0x06F0, 0x0966, 0x09E6, 0x0A66, 0x0AE6, 0x0B66, 0x0BE6, 0x0C66, 0x0CE6, 0x0D66, 0x0E50, 0xFF10];
export function asciiNumber(s) {
  return String(s ?? '').replace(/[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0E50-\u0E59\uFF10-\uFF19]/g, (c) => {
    const cp = c.codePointAt(0);
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9);
    return String(cp - zero);
  })
    // thousands first: exactly 3 trailing digits (ASCII, Arabic \u066C, fullwidth \uFF0C comma)
    .replace(/(\d)[,\u066C\uFF0C](\d{3})(?!\d)/g, '$1$2')
    // then decimal: 1–2 trailing digits (ASCII, Arabic \u066B, fullwidth \uFF0E)
    .replace(/(\d)[,\u066B\uFF0E](\d{1,2})(?!\d)/g, '$1.$2');
}

/**
 * Remove the machine-readable ---SCORE_SUMMARY--- … ---END_SUMMARY--- block
 * the prompt asks for, as the parent's eval scripts do before writing a
 * report: it exists for validation, not for the reader.
 */
export function stripScoreSummary(text) {
  return String(text ?? '').replace(/\n*---SCORE_SUMMARY---[\s\S]*?---END_SUMMARY---\n*/, '\n').trimEnd();
}
