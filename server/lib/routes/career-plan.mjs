/**
 * Career-plan routes (v1.95.0, Epic 26).
 *
 * A personalized, AI-generated career development plan — self-diagnosis, goals
 * (SMART / OKR / WOOP), alternative trajectories, a hard/soft skill plan, a
 * month-by-month 12-month roadmap, progress tracking, and pitfalls — grounded in
 * the candidate's own CV + profile (+ two-pager + memory) via bundleProjectContext.
 *
 *   GET  /api/career-plan          → the saved plan markdown (empty-safe)
 *   PUT  /api/career-plan          → save (explicit user Save → config/career-plan.md)
 *   POST /api/career-plan/generate → generate live, or a copy-paste prompt (no key)
 *
 * The plan is FORWARD-LOOKING guidance built from the user's own materials — it
 * recommends and structures, and must not fabricate facts about their history.
 * The only write is `config/career-plan.md` on an explicit Save.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PATHS } from '../paths.mjs';
import { withFileLock } from '../file-lock.mjs';
import { bundleProjectContext, resolveLocale, buildLocaleDirective } from '../prompts.mjs';
import { cleanLlmMarkdown } from '../llm-output.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runActiveProvider, providerAvailable } from '../llm-dispatch.mjs';

const MAX_PLAN = 128 * 1024;    // a document, but bounded
const MAX_FOCUS = 400;
const HORIZONS = ['6', '12', '24'];

/** Coerce arbitrary input to a bounded plain-text plan. Exported for tests. */
export function normalizePlan(body) {
  const raw = body && typeof body === 'object' ? body.markdown : body;
  return (typeof raw === 'string' ? raw : '').slice(0, MAX_PLAN);
}

/** Whitelist the horizon in months (default 12). Exported for tests. */
export function normalizeHorizon(v) {
  const s = String(v == null ? '' : v).trim();
  return HORIZONS.includes(s) ? s : '12';
}

export function readPlan() {
  if (!existsSync(PATHS.careerPlan)) return '';
  try { return readFileSync(PATHS.careerPlan, 'utf8'); } catch { return ''; }
}

const INSTRUCTIONS = [
  'You are a senior career coach. Using ONLY the candidate materials inlined',
  'below (CV, profile, two-pager, memory), write a concrete, personalized career',
  'development plan for this specific person. Ground every recommendation in what',
  'their materials actually show — do NOT invent employers, titles, or achievements.',
  '',
  'Write it in Markdown with THESE sections (scale each to the person):',
  '  1. **Starting point** — an honest snapshot of where they are now.',
  '  2. **Strengths & growth areas** — a short SWOT grounded in the CV.',
  '  3. **Direction & goals** — 3–5 goals as SMART, plus one OKR and one WOOP.',
  '  4. **Alternative trajectories** — 2–3 realistic paths with trade-offs.',
  '  5. **Skill plan** — hard and soft skills to build, with resources/how.',
  '  6. **{H}-month roadmap** — a month-by-month table (focus + concrete steps per month).',
  '  7. **Tracking progress** — how to measure it (metrics, cadence, tools).',
  '  8. **Pitfalls & barriers** — likely traps and how to beat them.',
  '  9. **Support** — mentor / community / coach moves.',
  '',
  'Keep it practical and specific to THEM. Output ONLY the plan (Markdown).',
  '',
].join('\n');

/** Build the full career-plan prompt. Pure; exported for tests. */
export function buildPlanPrompt(ctx, horizon, focus, lang) {
  return [
    buildLocaleDirective(lang),
    INSTRUCTIONS.replace('{H}', horizon || '12'),
    `PLANNING HORIZON: ${horizon || '12'} months.`,
    focus ? `EMPHASIS the candidate asked for: ${focus}` : '',
    '',
    ctx,
  ].filter((x) => x !== '').join('\n');
}

export function registerCareerPlanRoutes(app) {
  app.get('/api/career-plan', (_req, res) => {
    res.json({ markdown: readPlan() });
  });

  app.put('/api/career-plan', async (req, res) => {
    const markdown = normalizePlan(req.body);
    try {
      await withFileLock(PATHS.careerPlan, async () => {
        mkdirSync(dirname(PATHS.careerPlan), { recursive: true });
        writeFileSync(PATHS.careerPlan, markdown);
      });
    } catch {
      return res.status(500).json({ error: 'failed to save career plan' });
    }
    return res.json({ ok: true, markdown });
  });

  app.post('/api/career-plan/generate', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const horizon = normalizeHorizon(body.horizon);
    const focus = (typeof body.focus === 'string' ? body.focus : '').replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_FOCUS);
    const lang = resolveLocale(req);
    const ctx = bundleProjectContext({});
    if (!ctx) {
      return res.status(400).json({ error: 'no candidate materials yet — add your CV / profile first, so the plan is about you' });
    }
    const prompt = buildPlanPrompt(ctx, horizon, focus, lang);

    if (!body.run) {
      return res.json({
        mode: 'manual',
        prompt,
        message: providerAvailable()
          ? 'Set { run: true } to generate live, or copy this prompt into any LLM.'
          : 'No API key set — copy this prompt into any LLM, then paste the plan back.',
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
