/**
 * Two-pager routes (v1.89.0, roadmap Epic 14 — candidate market fit).
 *
 * The two-pager captures what the candidate ACTUALLY wants (loves / must-haves /
 * hates / deal-breakers / target environment / non-negotiables), modeled on the
 * "Mnookin two-pager" from *Never Search Alone*. It is user career-framing
 * content stored in the user layer at `config/two-pager.yml` (web-ui-owned,
 * never overwritten by parent updates), and it is inlined into every evaluation
 * prompt (see bundleProjectContext) so preferences blend with the CV-vs-JD match.
 *
 *   GET  /api/two-pager        → the parsed structure (empty-safe default)
 *   PUT  /api/two-pager        → validate + write (explicit user Save)
 *   POST /api/two-pager/draft  → a ready-to-run Mnookin draft prompt (cv+profile
 *                                inlined) for the "AI fill assistant"
 *
 * The only write is `config/two-pager.yml` on an explicit Save — same
 * write-through contract as PUT /api/cv.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import yaml from 'js-yaml';
import { PATHS } from '../paths.mjs';
import { withFileLock } from '../file-lock.mjs';
import { bundleProjectContext } from '../prompts.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runActiveProvider, providerAvailable } from '../llm-dispatch.mjs';

const EMPTY = () => ({
  who_i_am: '', loves: [], must_haves: [], hates: [],
  deal_breakers: [], non_negotiables: [], target_environment: '',
});

const str = (v, cap = 4000) => (typeof v === 'string' ? v.slice(0, cap) : '');
const arr = (v, cap = 40, itemCap = 400) => (Array.isArray(v)
  ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, cap).map((x) => x.trim().slice(0, itemCap))
  : []);

/** Coerce arbitrary input to the bounded two-pager shape. Exported for tests. */
export function normalizeTwoPager(body) {
  const b = (body && typeof body === 'object' && !Array.isArray(body)) ? body : {};
  return {
    who_i_am: str(b.who_i_am),
    loves: arr(b.loves),
    must_haves: arr(b.must_haves),
    hates: arr(b.hates),
    deal_breakers: arr(b.deal_breakers),
    non_negotiables: arr(b.non_negotiables),
    target_environment: str(b.target_environment),
  };
}

/** Read + parse config/two-pager.yml, always returning the full shape. */
export function readTwoPager() {
  if (!existsSync(PATHS.twoPager)) return EMPTY();
  try {
    const parsed = yaml.load(readFileSync(PATHS.twoPager, 'utf8'));
    return normalizeTwoPager(parsed);
  } catch { return EMPTY(); }
}

const DRAFT_INSTRUCTIONS = [
  'You are helping the candidate write a **two-pager** in the style of the',
  '"Mnookin two-pager" from *Never Search Alone* — a short, first-person',
  'statement of what they actually want from their next role, used to sharpen',
  'targeting and interview prep.',
  '',
  'Using ONLY the candidate materials inlined below (CV + profile), draft a',
  'two-pager as YAML with exactly these keys — infer sensible starting content',
  'the candidate can then edit; never invent facts not supported by the materials:',
  '',
  '  who_i_am: a 3–5 sentence first-person "Who I am" narrative.',
  '  loves: 4–7 short bullets — what energizes them.',
  '  must_haves: 3–6 short bullets — non-negotiable requirements.',
  '  hates: 3–6 short bullets — what drains them.',
  '  deal_breakers: 2–5 short bullets — hard nos.',
  '  target_environment: 1–2 sentences — the company size/stage/culture they want.',
  '  non_negotiables: 2–5 short bullets — boundaries (comp floor, location, remote…).',
  '',
  'Output ONLY the YAML. Keep bullets short (a few words each).',
  '',
].join('\n');

export function registerTwoPagerRoutes(app) {
  app.get('/api/two-pager', (_req, res) => {
    res.json({ twoPager: readTwoPager() });
  });

  app.put('/api/two-pager', async (req, res) => {
    const clean = normalizeTwoPager(req.body);
    try {
      await withFileLock(PATHS.twoPager, async () => {
        mkdirSync(dirname(PATHS.twoPager), { recursive: true });
        writeFileSync(PATHS.twoPager, yaml.dump(clean, { lineWidth: 100 }));
      });
    } catch {
      return res.status(500).json({ error: 'failed to save two-pager' });
    }
    return res.json({ ok: true, twoPager: clean });
  });

  // The "AI fill assistant" — build a ready-to-run Mnookin draft prompt with the
  // candidate's cv.md + profile inlined. With `{ run: true }` and a provider
  // configured, we run it live and parse the YAML back into the two-pager shape
  // so the form auto-fills; otherwise we return the prompt for the user to run
  // manually (shared manual-fallback contract, same as career-plan/market).
  app.post('/api/two-pager/draft', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const ctx = bundleProjectContext({});
    if (!ctx) {
      return res.status(400).json({ error: 'no candidate materials yet — add your CV / profile first' });
    }
    const prompt = `${DRAFT_INSTRUCTIONS}${ctx}`;

    if (!body.run) {
      return res.json({
        mode: 'manual',
        prompt,
        message: providerAvailable()
          ? 'Set { run: true } to auto-fill live, or copy this prompt into any LLM.'
          : 'No API key set — copy this prompt into any LLM, then paste the YAML back.',
      });
    }

    const r = await runActiveProvider(prompt);
    if (r.mode === 'too-large') {
      return res.status(413).json({ error: 'prompt too large', details: [`assembled prompt is ${r.size} bytes; soft cap is ${r.cap}.`] });
    }
    if (r.mode === 'manual') return res.json({ mode: 'manual', prompt, message: 'No provider available — copy this prompt into any LLM.' });
    if (r.error) return res.status(502).json({ mode: r.mode, prompt, error: r.error });
    const fields = parseYamlFields(r.markdown);
    if (!fields) return res.status(502).json({ mode: r.mode, prompt, error: 'could not parse the two-pager YAML the model returned' });
    return res.json({ mode: r.mode, prompt, fields, usage: r.usage });
  });
}

/** Strip ```yaml fences, parse, and coerce to the bounded two-pager shape. */
export function parseYamlFields(raw) {
  const text = String(raw || '').replace(/^\s*```(?:ya?ml)?\s*/i, '').replace(/```\s*$/i, '').trim();
  if (!text) return null;
  try {
    const parsed = yaml.load(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return normalizeTwoPager(parsed);
  } catch { return null; }
}
