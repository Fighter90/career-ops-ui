/**
 * eval-two-step-stub.mjs — test helper for the v1.268.0 two-step evaluation
 * contract (CAR-229). A stub provider must answer DIFFERENTLY on the two
 * calls: the scoring step's prompt carries "Output ONLY a JSON object" and
 * expects a bare JSON object; the render step's prompt carries the verbatim
 * "SCORING JSON (canonical" marker and expects the A–G `## X)` body.
 *
 * Both markers are exported so a stub can branch on the prompt it received —
 * content-keyed, stateless, safe across sequential runs in one process.
 */

export const SCORING_MARKER = 'Output ONLY a JSON object';
export const RENDER_MARKER = 'SCORING JSON (canonical';

/** True when the given prompt is the scoring step's. */
export function isScoringCall(prompt) {
  return String(prompt || '').includes(SCORING_MARKER);
}

/**
 * A valid scoring JSON fixture. `blocks` may name only some letters — the
 * rest default to 3 / 'Meets the requirement'.
 */
export function scoringFixture({ company = 'Acme', role = 'Engineer', archetype = 'Generalist', legitimacy = 'High Confidence', score = 4.1, blocks = {} } = {}) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const out = { company, role, archetype, legitimacy, score, blocks: {} };
  for (const L of letters) {
    const b = blocks[L] ?? {};
    out.blocks[L] = { score: b.score ?? 3.5, summary: b.summary ?? 'Meets the requirement with relevant evidence.' };
  }
  return out;
}

/** A render-body fixture: the seven `## X)` headings with one line each. */
export function renderBodyFixture({ titles = {}, line = 'The candidate meets the requirements: relevant platform experience, Kubernetes and Go valued for this role.', broken = [] } = {}) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  return letters
    .filter((L) => !broken.includes(L))
    .map((L) => `## ${L}) ${titles[L] || 'Section'}\n${line}`)
    .join('\n\n');
}

/** The prompt text of an OpenAI-compatible request body (messages[].content). */
export function promptFromOpenAiBody(rawBody) {
  try {
    const b = JSON.parse(rawBody);
    return (b.messages || []).map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n');
  } catch {
    return '';
  }
}

/**
 * The canonical two-shape provider reply factory: give it the scoring
 * fixture and the render body, get back a handler `(promptText) => string`
 * that returns what the provider should say for that call. A scoring call
 * whose fixture is `null` answers with garbage (drives the scoring-retry
 * path); a render call whose body is `null` answers with a truncated body
 * (drives the fallback path).
 */
export function twoShapeAnswers({ scoring, body }) {
  return (promptText) => {
    if (isScoringCall(promptText)) {
      return scoring === null ? 'I evaluated the posting carefully and it looks fine overall.' : JSON.stringify(scoring);
    }
    if (promptText.includes(RENDER_MARKER)) return body ?? '';
    return '';
  };
}
