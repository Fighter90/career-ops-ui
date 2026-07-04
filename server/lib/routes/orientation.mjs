/**
 * Career-orientation route (v1.96.0, Epic 27).
 *
 * Generates a career-orientation profile — the kind of "which directions fit you"
 * report you'd get from a vocational test, but inferred from the candidate's own
 * CV + profile (+ two-pager + memory) rather than a questionnaire. Sections:
 * best-fit career vectors (with reasoning), a career-type leaning, recommended
 * roles, professional strengths, working-style tendencies, and development moves.
 *
 *   POST /api/orientation/generate → the profile (live) or a copy-paste prompt
 *
 * Honesty contract: this is an AI REFLECTION of how the CV reads, NOT a validated
 * psychometric result. The prompt says so, must not print invented test SCORES as
 * if measured, and must ground every read in the CV. No file writes. Live runs use
 * the shared provider cascade; no key ⇒ manual prompt (honest), like CV Studio.
 */
import { bundleProjectContext, resolveLocale, buildLocaleDirective } from '../prompts.mjs';
import { cleanLlmMarkdown } from '../llm-output.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runActiveProvider, providerAvailable } from '../llm-dispatch.mjs';

const INSTRUCTIONS = [
  'You are a career-orientation analyst. Using ONLY the candidate materials',
  'inlined below (CV, profile, two-pager, memory), infer a career-orientation',
  'profile for this specific person. This is a REFLECTION of how their CV reads,',
  'NOT a psychometric test — do not present numeric test scores as if measured.',
  '',
  'Write it in Markdown with THESE sections:',
  '  1. **Best-fit career vectors** — of these eight, which fit best and why,',
  '     grounded in the CV: Functionalist, Administrator, Communicator, Specialist,',
  '     Analyst, Innovator, Manager, Entrepreneur. Rank the top 3 with evidence.',
  '  2. **Career type leaning** — Static / Corporate / Professional / Entrepreneurial',
  '     / Creative — which the CV leans toward, briefly.',
  '  3. **Recommended roles** — 8–12 concrete roles that fit the vectors + the',
  '     profile\'s target roles.',
  '  4. **Professional strengths** — the capabilities the CV actually evidences',
  '     (e.g. management, projects, communication, analysis, technology…), each',
  '     tied to something in the CV.',
  '  5. **Working-style tendencies** — how the CV reads on a few axes (e.g. hands-on',
  '     vs. leadership, structure vs. improvisation, depth vs. breadth). Frame as',
  '     "how your CV reads", not a personality verdict.',
  '  6. **Development recommendations** — trainings/skills/experiences to broaden fit.',
  '',
  'Ground every claim in the materials — do NOT invent achievements, and do NOT',
  'fabricate measured scores. Output ONLY the profile (Markdown).',
  '',
].join('\n');

/** Build the full career-orientation prompt. Pure; exported for tests. */
export function buildOrientationPrompt(ctx, lang) {
  return [
    buildLocaleDirective(lang),
    INSTRUCTIONS,
    ctx,
  ].filter((x) => x !== '').join('\n');
}

export function registerOrientationRoutes(app) {
  app.post('/api/orientation/generate', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const lang = resolveLocale(req);
    const ctx = bundleProjectContext({});
    if (!ctx) {
      return res.status(400).json({ error: 'no candidate materials yet — add your CV / profile first, so the profile is about you' });
    }
    const prompt = buildOrientationPrompt(ctx, lang);

    if (!body.run) {
      return res.json({
        mode: 'manual',
        prompt,
        message: providerAvailable()
          ? 'Set { run: true } to generate live, or copy this prompt into any LLM.'
          : 'No API key set — copy this prompt into any LLM, then paste the profile back.',
      });
    }
    const r = await runActiveProvider(prompt);
    if (r.mode === 'too-large') {
      return res.status(413).json({ error: 'prompt too large', details: [`assembled prompt is ${r.size} bytes; soft cap is ${r.cap}.`] });
    }
    if (r.mode === 'manual') return res.json({ mode: 'manual', prompt, message: 'No provider available — copy this prompt into any LLM.' });
    if (r.error) return res.status(502).json({ mode: r.mode, prompt, error: r.error });
    return res.json({ mode: r.mode, prompt, markdown: cleanLlmMarkdown(r.markdown), usage: r.usage });
  });
}
