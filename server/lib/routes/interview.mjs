/**
 * Mock Interview 2.0 routes (v1.90.0, roadmap Epic 15).
 *
 * A turn-by-turn conversational rehearsal driven by a role/company (+ optional
 * JD) and the candidate's own materials (cv.md, profile, two-pager, and the
 * STAR+R story bank at interview-prep/story-bank.md). Each turn:
 *   • empty history → the interviewer opens with a first question;
 *   • last turn is a candidate answer → concise per-answer feedback (strengths,
 *     the STAR gap, a tighter reframing) + a score + the next question.
 *
 *   POST /api/mock-interview/turn      → next interviewer turn (live or manual)
 *   POST /api/mock-interview/save      → persist a transcript (explicit user Save)
 *   GET  /api/mock-interview/sessions  → list saved mock sessions
 *   GET  /api/mock-interview/sessions/:name → one saved transcript (cleaned)
 *   DELETE /api/mock-interview/sessions/:name → remove a saved session
 *
 * Live turns go through the shared provider cascade (runActiveProvider); with
 * no key the route returns the ready-to-run prompt for the user to paste into
 * any LLM — the app's standard honest fallback, never a fabricated answer.
 * The only writes are the user's own `interview-prep/mock-*.md` on Save.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { PATHS, path as projPath } from '../paths.mjs';
import { slugify, today } from '../parsers.mjs';
import { sanitizeJobDescription, sanitizePathName } from '../security.mjs';
import { bundleProjectContext, resolveLocale } from '../prompts.mjs';
import { cleanLlmMarkdown } from '../llm-output.mjs';
import { withFileLock } from '../file-lock.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runActiveProvider, providerAvailable } from '../llm-dispatch.mjs';

const MAX_TURNS = 40;          // hard cap on history length accepted per request
const MAX_TEXT = 6000;         // per-turn answer/question length cap
const MAX_FIELD = 200;         // role / company length cap

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

/** Coerce arbitrary request history to a bounded [{ speaker, text }] list. */
export function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t === 'object')
    .slice(0, MAX_TURNS)
    .map((t) => ({
      speaker: t.speaker === 'candidate' ? 'candidate' : 'interviewer',
      text: clip(t.text, MAX_TEXT).trim(),
    }))
    .filter((t) => t.text);
}

/**
 * Build the interviewer prompt. `ctx` is the inlined project context; `body`
 * carries role/company/jd/history. Exported for tests (pure string builder).
 */
export function buildInterviewPrompt(ctx, { role, company, jd, history, lang }) {
  const turns = normalizeHistory(history);
  const last = turns[turns.length - 1];
  const opening = turns.length === 0 || (last && last.speaker === 'interviewer');

  const transcript = turns.length
    ? turns.map((t) => `${t.speaker === 'candidate' ? 'CANDIDATE' : 'INTERVIEWER'}: ${t.text}`).join('\n\n')
    : '(no turns yet)';

  const instructions = opening
    ? [
      'Ask ONE focused opening interview question for this role. Make it specific',
      'to the role/JD and the candidate\'s background — not a generic "tell me',
      'about yourself" unless that genuinely fits. Output ONLY the question.',
    ]
    : [
      'The candidate has just answered. Respond as a rigorous but fair interviewer',
      'with EXACTLY these markdown sections:',
      '',
      '### Feedback',
      '- **Strengths** — what landed (1–3 bullets).',
      '- **Gaps** — what was missing or vague, in STAR+R terms (Situation, Task,',
      '  Action, Result, Reflection). Name the specific missing dimension.',
      '- **Tighter version** — one or two sentences showing how to reframe the',
      '  answer more crisply, grounded ONLY in the candidate\'s real materials',
      '  below (never invent achievements or numbers).',
      '',
      '### Score',
      'A single line `Score: N/5` with a one-clause justification.',
      '',
      '### Next question',
      'One follow-up question that probes the weakest part of the last answer.',
    ];

  return [
    ctx,
    '<mock_interview>',
    `You are conducting a mock job interview for the role of "${clip(role, MAX_FIELD) || 'the target role'}"` +
      (company ? ` at ${clip(company, MAX_FIELD)}` : '') + '.',
    'Ground every question and every piece of feedback in the candidate materials',
    'inlined above (CV, profile, two-pager, and story bank if present). Never',
    'fabricate experience the candidate does not have; if their materials are',
    'thin on something the role needs, probe it as a genuine gap.',
    jd ? `\nJOB DESCRIPTION:\n${jd}\n` : '',
    'CONVERSATION SO FAR:',
    transcript,
    '',
    ...instructions,
    '',
    lang && lang !== 'en' ? `Respond in the candidate's language (${lang}).` : '',
    '</mock_interview>',
    '',
  ].filter((x) => x !== '').join('\n');
}

export function registerInterviewRoutes(app) {
  app.post('/api/mock-interview/turn', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const role = clip(body.role, MAX_FIELD).trim();
    const company = clip(body.company, MAX_FIELD).trim();
    // A JD is optional; when present, sanitize it like every other JD ingress.
    const jd = body.jd ? sanitizeJobDescription(body.jd) : '';
    if (!role && !jd) {
      return res.status(400).json({ error: 'a target role or a job description is required' });
    }
    const lang = resolveLocale(req);
    const ctx = bundleProjectContext({
      extraFiles: [{ label: 'interview-prep/story-bank.md (candidate STAR+R stories — authoritative, do not invent)', path: PATHS.storyBank }],
    });
    const prompt = buildInterviewPrompt(ctx, { role, company, jd, history: body.history, lang });

    if (!body.run) {
      return res.json({
        mode: 'manual',
        prompt,
        message: providerAvailable()
          ? 'Set { run: true } to run this turn live, or copy the prompt into any LLM.'
          : 'No API key set — copy this prompt into any LLM (Claude Code, ChatGPT, Gemini…).',
      });
    }

    const r = await runActiveProvider(prompt);
    if (r.mode === 'too-large') {
      return res.status(413).json({ error: 'prompt too large', details: [`assembled prompt is ${r.size} bytes; soft cap is ${r.cap}.`] });
    }
    if (r.mode === 'manual') {
      return res.json({ mode: 'manual', prompt, message: 'No provider available — copy this prompt into any LLM.' });
    }
    if (r.error) return res.status(502).json({ mode: r.mode, prompt, error: r.error });
    return res.json({ mode: r.mode, prompt, markdown: cleanLlmMarkdown(r.markdown), usage: r.usage });
  });

  // Persist a finished transcript to the user layer. Explicit user action.
  app.post('/api/mock-interview/save', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const role = clip(body.role, MAX_FIELD).trim();
    const company = clip(body.company, MAX_FIELD).trim();
    const transcript = clip(body.transcript, MAX_TEXT * MAX_TURNS);
    if (!transcript.trim()) return res.status(400).json({ error: 'transcript is required' });
    const slug = slugify([company, role].filter(Boolean).join('-') || 'session') || 'session';
    // Defense-in-depth: slugify already strips path chars, but route the final
    // filename through sanitizePathName too and re-assert the mock-*.md shape
    // so the write target can never escape interview-prep/ (path-injection).
    const name = sanitizePathName(`mock-${slug}-${today()}.md`);
    if (!name || !name.startsWith('mock-') || !name.endsWith('.md')) {
      return res.status(400).json({ error: 'could not derive a safe session name' });
    }
    const file = projPath('interview-prep', name);
    const doc = [
      `# Mock interview — ${role || 'role'}${company ? ` @ ${company}` : ''}`,
      '', `_Saved ${today()}_`, '', transcript.trim(), '',
    ].join('\n');
    try {
      await withFileLock(file, async () => {
        mkdirSync(PATHS.interviewPrepDir, { recursive: true });
        writeFileSync(file, doc);
      });
    } catch {
      return res.status(500).json({ error: 'failed to save session' });
    }
    return res.json({ ok: true, name });
  });

  app.get('/api/mock-interview/sessions', (_req, res) => {
    if (!existsSync(PATHS.interviewPrepDir)) return res.json({ sessions: [] });
    const sessions = readdirSync(PATHS.interviewPrepDir)
      .filter((f) => f.startsWith('mock-') && f.endsWith('.md'))
      .map((f) => {
        const stat = statSync(projPath('interview-prep', f));
        return { name: f, size: stat.size, mtime: stat.mtime };
      })
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json({ sessions });
  });

  app.get('/api/mock-interview/sessions/:name', (req, res) => {
    const safe = sanitizePathName(req.params.name);
    if (!safe || !safe.startsWith('mock-') || !safe.endsWith('.md')) return res.status(400).json({ error: 'invalid name' });
    const file = projPath('interview-prep', safe);
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    res.json({ name: safe, markdown: cleanLlmMarkdown(readFileSync(file, 'utf8')) });
  });

  app.delete('/api/mock-interview/sessions/:name', (req, res) => {
    const safe = sanitizePathName(req.params.name);
    if (!safe || !safe.startsWith('mock-') || !safe.endsWith('.md')) return res.status(400).json({ error: 'invalid name' });
    const file = projPath('interview-prep', safe);
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    unlinkSync(file);
    res.json({ ok: true, deleted: safe });
  });
}
