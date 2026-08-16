/**
 * v1.58.0 — strip agent/tool scaffolding the model sometimes echoes
 * into its prose so the SPA (which already renders markdown via
 * UI.md()) shows a clean, formatted brief instead of raw
 * `<tool_call>{…json…}</tool_call>` / `<tool_response>…</tool_response>`
 * blocks (reported on #/deep + Saved research).
 *
 * Conservative by design: only well-known agent-loop wrappers are
 * removed. Real fenced ```code blocks, tables, headings, etc. are left
 * untouched — this is NOT a markdown sanitizer (that's UI.md(), which
 * still escapes-first on the client).
 *
 * Pure + idempotent: safe to apply at the provider boundary AND again
 * when serving an already-saved file (older briefs on disk still get
 * cleaned on display).
 */

// <tool_call>…</tool_call>, <tool_response>…</tool_response>,
// <tool_use>…</tool_use>, <function_call>…</function_call> and the
// bracketed [TOOL_CALL]…[/TOOL_CALL] variants — case-insensitive,
// across newlines, non-greedy.
const SCAFFOLD_TAGS = /<\s*(tool_call|tool_response|tool_use|function_call|function_results?|thinking)\s*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const SCAFFOLD_BRACKETS = /\[\s*(TOOL_CALL|TOOL_RESPONSE|FUNCTION_CALL)\s*\][\s\S]*?\[\s*\/\s*\1\s*\]/gi;
// A self-closing / unterminated trailing scaffold tag at EOF (the
// stream was cut mid tool-call) — drop from the tag to end of string.
const SCAFFOLD_DANGLING = /<\s*(tool_call|tool_response|tool_use|function_call)\s*>[\s\S]*$/i;
// v1.58.3 (R-2 / FIX-C1) — fenced ```tool_call / ```thinking blocks.
const SCAFFOLD_FENCE = /```\s*(?:tool_call|tool_response|tool_use|function_call|function_results?|thinking)\b[\s\S]*?```/gi;
// Final sweep: ANY remaining standalone scaffold tag — OPEN or CLOSE,
// balanced or not. The paired regex only removes `<tag>…</tag>`; an
// UNBALANCED orphan closing tag (`</tool_response>` with no opener —
// the model emitted a lopsided trace) survived and rendered literally
// in the saved brief (R-2). Also covers the Anthropic tool XML
// (`<invoke name=…>`, `</invoke>`, `<parameter …>`, `<function_calls>`
// and the `antml:`-namespaced forms). These token names are never
// legitimate prose/markdown in a job brief, so a blunt per-tag strip
// is safe and keeps the function idempotent.
const SCAFFOLD_ANY_TAG =
  /<\/?\s*(?:tool_call|tool_response|tool_use|function_call|function_results?|thinking|invoke|parameter|function_calls|antml:[a-z_]+)\b[^>]*>/gi;

/**
 * @param {string} md raw model output
 * @returns {string} cleaned markdown (never throws; '' for falsy input)
 */
export function cleanLlmMarkdown(md) {
  if (!md || typeof md !== 'string') return '';
  let s = md
    .replace(SCAFFOLD_FENCE, '')
    .replace(SCAFFOLD_TAGS, '')
    .replace(SCAFFOLD_BRACKETS, '');
  // Only treat a leftover OPEN tag with no close as dangling (don't
  // re-trigger on the already-stripped paired form).
  if (/<\s*(tool_call|tool_response|tool_use|function_call)\s*>/i.test(s)) {
    s = s.replace(SCAFFOLD_DANGLING, '');
  }
  // R-2: blunt-strip every remaining standalone scaffold tag (the
  // orphan-closing-tag case the paired/dangling regexes can't reach).
  s = s.replace(SCAFFOLD_ANY_TAG, '');
  // Collapse the blank-line craters the removed blocks leave behind.
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  // v1.207.2 — some models wrap their ENTIRE markdown answer in a
  // ```markdown … ``` fence (career-plan / orientation returned the whole
  // brief fenced, so UI.md rendered a monospace code dump instead of a
  // formatted plan). Unwrap it — but ONLY when the language is explicitly
  // `markdown`/`md` AND the closing fence sits at EOF (a whole-document wrap),
  // so a real ```python / ```js / bare-``` code answer is left intact. The
  // non-greedy middle still reaches the FINAL fence, so inner code blocks
  // survive. Idempotent: the unwrapped result no longer starts with a fence.
  const whole = s.match(/^```(?:markdown|md)[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/i);
  if (whole) s = whole[1].trim();
  return s;
}
