/**
 * Networking & deep company research routes (v1.91.0, roadmap Epic 16).
 *
 * Given a company (+ optional role / JD), builds a NETWORKING PLAN grounded in
 * the candidate's cv.md / profile / two-pager:
 *   • who to contact (target personas: hiring manager, recruiter, team lead,
 *     warm/alumni connections) and how to find each on LinkedIn;
 *   • an intro-path heuristic (warmest realistic route in);
 *   • a tailored outreach draft per persona;
 *   • a compact company dossier (what they do + why-you-fit hooks).
 *
 *   POST /api/networking/plan       → next plan (live via provider, or manual)
 *   POST /api/networking/save       → persist a plan (explicit user Save)
 *   GET  /api/networking/plans      → list saved plans
 *   GET  /api/networking/plans/:name → one saved plan (cleaned)
 *   DELETE /api/networking/plans/:name → remove a saved plan
 *
 * Only write is the user's own `networking/*.md` on Save. Live runs use the
 * shared provider cascade; no key → copy-paste prompt (honest fallback).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { PATHS, path as projPath } from '../paths.mjs';
import { slugify, today } from '../parsers.mjs';
import { sanitizeJobDescription, sanitizePathName } from '../security.mjs';
import { bundleProjectContext, resolveLocale } from '../prompts.mjs';
import { cleanLlmMarkdown } from '../llm-output.mjs';
import { withFileLock } from '../file-lock.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runActiveProvider, providerAvailable } from '../llm-dispatch.mjs';

const MAX_FIELD = 200;
const MAX_JD = 50 * 1024;
const MAX_DOC = 200 * 1024;

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

/** Resolve a plan filename and prove it stays inside networking/ (path-injection barrier). */
function resolvePlanFile(name) {
  const dir = resolve(PATHS.networkingDir);
  const file = resolve(dir, name);
  return (file === dir || file.startsWith(dir + sep)) ? file : null;
}

/** Build the networking-plan prompt. Exported for tests (pure string builder). */
export function buildNetworkingPrompt(ctx, { company, role, jd, lang }) {
  return [
    ctx,
    '<networking_plan>',
    `Build a concrete networking plan to help this candidate get an interview at "${clip(company, MAX_FIELD)}"` +
      (role ? ` for the role of "${clip(role, MAX_FIELD)}"` : '') + '.',
    'Use ONLY the candidate materials inlined above (CV, profile, two-pager) to',
    'judge fit and warm angles — never invent connections or credentials the',
    'candidate does not have. Output these markdown sections:',
    '',
    '### Company dossier',
    'A tight 4–6 bullet brief: what the company does, recent signals worth citing,',
    'and 2–3 "why I fit" hooks drawn from the candidate\'s real background.',
    '',
    '### Who to contact',
    'A table or list of 3–5 target personas (e.g. hiring manager for the team,',
    'in-house recruiter, a senior IC on the team, a warm/alumni connection). For',
    'each: the role title to look for and a concrete LinkedIn search string to',
    'find them (do NOT fabricate real names).',
    '',
    '### Warmest intro path',
    'Given the candidate\'s background, the single most realistic warm route in',
    '(shared employer/school/community, a second-degree path, or a cold-but-',
    'high-signal direct message) — and why.',
    '',
    '### Outreach drafts',
    'A short, specific outreach message (3–5 sentences, no fluff) for the top 2',
    'personas, grounded in the candidate\'s real proof points.',
    jd ? `\nJOB DESCRIPTION:\n${jd}\n` : '',
    lang && lang !== 'en' ? `Respond in the candidate's language (${lang}).` : '',
    '</networking_plan>',
    '',
  ].filter((x) => x !== '').join('\n');
}

export function registerNetworkingRoutes(app) {
  app.post('/api/networking/plan', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const company = clip(body.company, MAX_FIELD).trim();
    const role = clip(body.role, MAX_FIELD).trim();
    const jd = body.jd ? sanitizeJobDescription(clip(body.jd, MAX_JD)) : '';
    if (!company) return res.status(400).json({ error: 'a company is required' });
    const lang = resolveLocale(req);
    const ctx = bundleProjectContext({});
    const prompt = buildNetworkingPrompt(ctx, { company, role, jd, lang });

    if (!body.run) {
      return res.json({
        mode: 'manual',
        prompt,
        message: providerAvailable()
          ? 'Set { run: true } to build the plan live, or copy the prompt into any LLM.'
          : 'No API key set — copy this prompt into any LLM (Claude Code, ChatGPT, Gemini…).',
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

  app.post('/api/networking/save', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const company = clip(body.company, MAX_FIELD).trim();
    const role = clip(body.role, MAX_FIELD).trim();
    const plan = clip(body.plan, MAX_DOC);
    if (!company) return res.status(400).json({ error: 'a company is required' });
    if (!plan.trim()) return res.status(400).json({ error: 'a plan is required' });
    const slug = slugify([company, role].filter(Boolean).join('-')) || 'plan';
    const name = sanitizePathName(`net-${slug}-${today()}.md`);
    const file = name && name.startsWith('net-') && name.endsWith('.md') ? resolvePlanFile(name) : null;
    if (!file) return res.status(400).json({ error: 'could not derive a safe plan name' });
    const doc = [
      `# Networking plan — ${company}${role ? ` · ${role}` : ''}`,
      '', `_Saved ${today()}_`, '', plan.trim(), '',
    ].join('\n');
    try {
      await withFileLock(file, async () => {
        mkdirSync(PATHS.networkingDir, { recursive: true });
        writeFileSync(file, doc);
      });
    } catch {
      return res.status(500).json({ error: 'failed to save plan' });
    }
    return res.json({ ok: true, name });
  });

  app.get('/api/networking/plans', (_req, res) => {
    if (!existsSync(PATHS.networkingDir)) return res.json({ plans: [] });
    const plans = readdirSync(PATHS.networkingDir)
      .filter((f) => f.startsWith('net-') && f.endsWith('.md'))
      .map((f) => {
        const stat = statSync(projPath('networking', f));
        return { name: f, size: stat.size, mtime: stat.mtime };
      })
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json({ plans });
  });

  app.get('/api/networking/plans/:name', (req, res) => {
    const safe = sanitizePathName(req.params.name);
    const file = safe && safe.startsWith('net-') && safe.endsWith('.md') ? resolvePlanFile(safe) : null;
    if (!file) return res.status(400).json({ error: 'invalid name' });
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    res.json({ name: safe, markdown: cleanLlmMarkdown(readFileSync(file, 'utf8')) });
  });

  app.delete('/api/networking/plans/:name', (req, res) => {
    const safe = sanitizePathName(req.params.name);
    const file = safe && safe.startsWith('net-') && safe.endsWith('.md') ? resolvePlanFile(safe) : null;
    if (!file) return res.status(400).json({ error: 'invalid name' });
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    unlinkSync(file);
    res.json({ ok: true, deleted: safe });
  });
}
