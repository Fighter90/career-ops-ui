/**
 * eval-two-step-stub.mjs — test helper for the v1.268.1 two-step evaluation
 * contract (CAR-229/CAR-239). A stub provider must answer DIFFERENTLY on the
 * two calls: the scoring step's prompt carries "Output ONLY a JSON object"
 * and expects a bare JSON object; the render step's prompt carries the
 * verbatim "SCORING JSON (canonical" marker and expects the A–G `## X)`
 * body.
 *
 * Both markers are exported so a stub can branch on the prompt it received —
 * content-keyed, stateless, safe across sequential runs in one process.
 *
 * CAR-239 fixture contract: the model JSON carries INTEGER sub-scores
 * (1–5) and the global score is computed by the SERVER from them. The
 * `score` option here is the DESIRED final score: scoringFixture solves
 * integer block scores whose weighted mean rounds to the nearest achievable
 * value on the six-block mean grid (k/6 → one decimal). Values the grid
 * cannot hit exactly (e.g. 4.1 → 4.2) SNAP — pins must assert the achieved
 * value, which is what the server prints.
 *
 * This helper owns the stub environment for every suite that imports it and
 * therefore DISABLES the CAR-239 scoring cache (EVAL_SCORE_CACHE=0): stub
 * suites reuse the same JD across tests with different fixtures, and a
 * cache hit would silently serve the first test's scoring. The dedicated
 * cache suite (tests/eval-scoring-cache.test.mjs) does NOT import this
 * helper and manages the env itself.
 */

export const SCORING_MARKER = 'Output ONLY a JSON object';
export const RENDER_MARKER = 'SCORING JSON (canonical';

// See the header: stub suites must not share scoring cache entries.
process.env.EVAL_SCORE_CACHE = '0';

/** True when the given prompt is the scoring step's. */
export function isScoringCall(prompt) {
  return String(prompt || '').includes(SCORING_MARKER);
}

/**
 * Solve integer block scores (1–5) so the server-computed weighted mean
 * (A–F weight 1 each, G weight 0 — the CAR-239 rule) rounds to the nearest
 * achievable value of `score`. Deterministic: remainder distributed to the
 * earliest blocks, G rides the base.
 */
export function solveIntegerBlocks(score) {
  const scored = ['A', 'B', 'C', 'D', 'E', 'F'];
  const s = Math.round(Math.min(5, Math.max(1, score)) * scored.length);
  const base = Math.min(5, Math.max(1, Math.floor(s / scored.length)));
  const out = { A: base, B: base, C: base, D: base, E: base, F: base, G: base };
  let rem = s - base * scored.length;
  for (let i = 0; rem > 0 && i < scored.length * 2; i += 1) {
    const k = scored[i % scored.length];
    if (out[k] < 5) { out[k] += 1; rem -= 1; }
  }
  return out;
}

/**
 * A valid scoring JSON fixture: integer sub-scores + the model's OWN total
 * (`score` — present only because real models still emit one; the server
 * IGNORES it, which is exactly what the pins assert). `blocks` may name
 * only some letters — the rest come from the solver.
 */
export function scoringFixture({ company = 'Acme', role = 'Engineer', archetype = 'Generalist', legitimacy = 'High Confidence', score = 4.0, blocks = {} } = {}) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const solved = solveIntegerBlocks(score);
  const out = { company, role, archetype, legitimacy, score, blocks: {} };
  for (const L of letters) {
    const b = blocks[L] ?? {};
    out.blocks[L] = { score: b.score ?? solved[L], summary: b.summary ?? 'Meets the requirement with relevant evidence.' };
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
