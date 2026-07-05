/**
 * Docs assistant — a grounded "ask the help guide" chat (v1.102.0).
 *
 *   POST /api/docs-assistant/ask  { question, run? }
 *       → { mode, answer|prompt, sections: [titles used] }
 *
 * Answers how-to questions about career-ops-ui, grounded ONLY in the app's own
 * in-app help guide (web-ui/docs/help/<lang>.md — the same files the Help page
 * serves). It is NOT about the user: no cv.md / profile / tracker is read, only
 * the shipped documentation + the question. Retrieval is dependency-free — the
 * guide is split into its `##` sections and scored by keyword overlap with the
 * question; the top few sections are inlined and the model must answer from them
 * (or say the guide doesn't cover it). Live with a key via the shared provider
 * cascade; no key → the honest copy-paste prompt. No file writes.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { WEB_UI_ROOT } from '../paths.mjs';
import { resolveLocale } from '../prompts.mjs';
import { cleanLlmMarkdown } from '../llm-output.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runActiveProvider, providerAvailable } from '../llm-dispatch.mjs';

const MAX_Q = 500;              // question length cap
const TOP_SECTIONS = 5;         // how many help sections to ground on
const MAX_CONTEXT = 14 * 1024;  // total bytes of inlined help excerpts
const FILE_ALIASES = { ko: 'ko-KR' };

// Very small English/RU stopword set — enough to stop scoring on filler.
const STOP = new Set(['the', 'and', 'for', 'you', 'your', 'how', 'can', 'does', 'what', 'where', 'when', 'why', 'with', 'from', 'this', 'that', 'about', 'into', 'are', 'not', 'have', 'has', 'все', 'как', 'что', 'где', 'для', 'это', 'или', 'при']);

/** Resolve the on-disk help file for a SPA locale code (same cascade as help.mjs). */
export function resolveHelpFile(lang) {
  const safe = String(lang || 'en').replace(/[^a-zA-Z0-9_-]/g, '');
  const base = safe.split('-')[0];
  const dir = resolve(WEB_UI_ROOT, 'docs', 'help');
  for (const fname of [`${safe}.md`, FILE_ALIASES[safe] ? `${FILE_ALIASES[safe]}.md` : null, `${base}.md`, 'en.md'].filter(Boolean)) {
    const full = resolve(dir, fname);
    if (existsSync(full)) return full;
  }
  return null;
}

/** Split a help markdown doc into `##`-delimited sections { title, body }. */
export function splitSections(md) {
  const lines = String(md || '').split('\n');
  const sections = [];
  let cur = null;
  for (const line of lines) {
    if (/^##\s+/.test(line) && !/^###/.test(line)) {
      if (cur) sections.push(cur);
      cur = { title: line.replace(/^##\s+/, '').trim(), body: line + '\n' };
    } else if (cur) {
      cur.body += line + '\n';
    }
  }
  if (cur) sections.push(cur);
  return sections;
}

function tokenize(s) {
  return String(s || '').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
}

/** Score each section against the question; return the top-N by keyword overlap. */
export function topSections(sections, question, n = TOP_SECTIONS) {
  const terms = tokenize(question).filter((t) => !STOP.has(t));
  const uniq = [...new Set(terms)];
  const scored = sections.map((sec) => {
    const titleTokens = new Set(tokenize(sec.title));
    const bodyLc = sec.body.toLowerCase();
    let score = 0;
    for (const term of uniq) {
      if (titleTokens.has(term)) score += 5;              // title hit weighs most
      const m = bodyLc.split(term).length - 1;            // body occurrences
      score += Math.min(m, 6);                            // capped so one section can't dominate
    }
    return { sec, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, n).map((x) => x.sec);
}

export function buildAskPrompt(picked, question, lang) {
  let ctx = '';
  for (const sec of picked) {
    if (ctx.length + sec.body.length > MAX_CONTEXT) break;
    ctx += `\n<<< HELP SECTION: ${sec.title} >>>\n${sec.body}\n`;
  }
  return [
    'You are the in-app help assistant for career-ops-ui, a web UI for an AI',
    'job-search pipeline. Answer the user\'s question using ONLY the help-guide',
    'excerpts below. If the excerpts do not contain the answer, say the guide',
    'does not seem to cover it and point them to the closest relevant section —',
    'do NOT invent features, routes, or settings. Be concise and practical; when',
    'useful, name the section you drew from.',
    lang && lang !== 'en' ? `Answer in the user's language (${lang}).` : '',
    '',
    '<help_excerpts>',
    ctx || '(no matching help sections found)',
    '</help_excerpts>',
    '',
    `QUESTION: ${question}`,
  ].filter((x) => x !== '').join('\n');
}

export function registerDocsAssistantRoutes(app) {
  app.post('/api/docs-assistant/ask', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const question = (typeof body.question === 'string' ? body.question : '').replace(/\s+/g, ' ').trim().slice(0, MAX_Q);
    if (question.length < 3) {
      return res.status(400).json({ error: 'ask a question (at least a few characters)' });
    }
    const lang = resolveLocale(req);
    const file = resolveHelpFile(lang);
    if (!file) return res.status(500).json({ error: 'help guide not found' });

    const picked = topSections(splitSections(readFileSync(file, 'utf8')), question);
    const prompt = buildAskPrompt(picked, question, lang);
    const sections = picked.map((s) => s.title);

    if (!body.run) {
      return res.json({
        mode: 'manual',
        prompt,
        sections,
        message: providerAvailable()
          ? 'Set { run: true } to answer live, or copy this prompt into any LLM.'
          : 'No API key set — copy this prompt into any LLM to get the answer.',
      });
    }
    const r = await runActiveProvider(prompt);
    if (r.mode === 'too-large') {
      return res.status(413).json({ error: 'prompt too large', details: [`assembled prompt is ${r.size} bytes; soft cap is ${r.cap}.`] });
    }
    if (r.mode === 'manual') return res.json({ mode: 'manual', prompt, sections, message: 'No provider available — copy this prompt into any LLM.' });
    if (r.error) return res.status(502).json({ mode: r.mode, prompt, sections, error: r.error });
    return res.json({ mode: r.mode, answer: cleanLlmMarkdown(r.markdown), sections, usage: r.usage });
  });
}
