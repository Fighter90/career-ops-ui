/**
 * CV Studio — "make it human / match my voice" route (v1.92.0, Epic 21).
 *
 * Given a chunk of CV text, builds a rewrite prompt that makes it read less
 * like generic AI prose and more like the CANDIDATE's own voice, grounded in
 * `voice-dna.md` (how their writing reads) and `writing-samples/` (their real
 * prose). Per DATA_CONTRACT these govern STYLE only — the rewrite may reorder,
 * tighten, and re-voice, but must NEVER introduce a factual claim, metric, or
 * achievement not already present in the input text.
 *
 *   POST /api/cv-studio/humanize  → rewritten text (live) or a copy-paste prompt
 *
 * No file writes — the user edits their CV via the existing PUT /api/cv. Live
 * runs use the shared provider cascade; no key → manual prompt (honest).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { PATHS, path as projPath } from '../paths.mjs';
import { resolveLocale } from '../prompts.mjs';
import { cleanLlmMarkdown } from '../llm-output.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runActiveProvider, providerAvailable } from '../llm-dispatch.mjs';

const MAX_TEXT = 20 * 1024;      // the CV chunk to rewrite
const MAX_SAMPLE = 8 * 1024;     // per writing sample
const MAX_SAMPLES = 3;           // how many samples to inline

/** Read voice-dna.md + up to N writing samples as a bounded grounding block. */
export function readVoiceContext() {
  const blocks = [];
  if (existsSync(PATHS.voiceDna)) {
    try { blocks.push(`--- voice-dna.md ---\n${readFileSync(PATHS.voiceDna, 'utf8').slice(0, MAX_SAMPLE)}`); } catch { /* ignore */ }
  }
  if (existsSync(PATHS.writingSamplesDir)) {
    let n = 0;
    for (const f of readdirSync(PATHS.writingSamplesDir).sort()) {
      if (n >= MAX_SAMPLES) break;
      if (!/\.(md|txt)$/i.test(f)) continue;
      try {
        blocks.push(`--- writing-samples/${f} ---\n${readFileSync(projPath('writing-samples', f), 'utf8').slice(0, MAX_SAMPLE)}`);
        n++;
      } catch { /* ignore */ }
    }
  }
  return blocks.join('\n\n');
}

const INSTRUCTIONS = [
  'Rewrite the CV TEXT below so it reads in the candidate\'s own voice — human,',
  'specific, and free of generic AI phrasing (no "leveraged", "spearheaded",',
  '"passionate about", "results-oriented" filler). Use the voice references to',
  'match their cadence and word choice.',
  '',
  'HARD RULES:',
  '  - Do NOT add any fact, metric, employer, date, or achievement that is not',
  '    already in the CV TEXT. Reorder, tighten, and re-voice only.',
  '  - Keep it truthful and concise. Prefer strong verbs and concrete nouns.',
  '  - Return ONLY the rewritten text (same markdown structure), no commentary.',
  '',
].join('\n');

export function buildHumanizePrompt(voiceCtx, text, lang) {
  return [
    voiceCtx ? `<voice_references>\n${voiceCtx}\n</voice_references>\n` : '',
    INSTRUCTIONS,
    'CV TEXT:',
    '"""',
    text,
    '"""',
    '',
    lang && lang !== 'en' ? `Respond in the candidate's language (${lang}).` : '',
  ].filter((x) => x !== '').join('\n');
}

export function registerCvStudioRoutes(app) {
  app.post('/api/cv-studio/humanize', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const text = (typeof body.text === 'string' ? body.text : '').slice(0, MAX_TEXT).trim();
    if (!text || text.length < 20) {
      return res.status(400).json({ error: 'select at least ~20 characters of CV text to rewrite' });
    }
    const lang = resolveLocale(req);
    const prompt = buildHumanizePrompt(readVoiceContext(), text, lang);

    if (!body.run) {
      return res.json({
        mode: 'manual',
        prompt,
        message: providerAvailable()
          ? 'Set { run: true } to rewrite live, or copy this prompt into any LLM.'
          : 'No API key set — copy this prompt into any LLM, then paste the rewrite back.',
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
