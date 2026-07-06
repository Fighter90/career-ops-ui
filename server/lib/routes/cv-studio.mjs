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
import { resolveLocale, bundleProjectContext } from '../prompts.mjs';
import { cleanLlmMarkdown } from '../llm-output.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runActiveProvider, providerAvailable } from '../llm-dispatch.mjs';
import { isValidJobUrl } from '../security.mjs';
import { safeGet } from '../safe-fetch.mjs';

const MAX_TEXT = 20 * 1024;      // the CV chunk to rewrite
const MAX_SAMPLE = 8 * 1024;     // per writing sample
const MAX_SAMPLES = 3;           // how many samples to inline
const MAX_JD = 24 * 1024;        // the target job description to tailor against
const MAX_HEADLINE = 200;        // optional target-role / headline hint

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

// ── "Tailor to a job" — résumé + cover-letter doctor with a checklist gate ──
//
// The transferable mechanics of a strong application, distilled from career-
// coaching practice into GENERIC rules — no hardcoded companies, roles, tracks,
// or personal history. Everything specific comes from <project_context> (the
// candidate's own cv.md / profile / two-pager) and the target JD. Source-of-
// truth is absolute: reorder, reframe, emphasise — NEVER fabricate a fact,
// metric, employer, date, or authorship claim not already in the materials.
const TAILOR_INSTRUCTIONS = [
  'You tailor a résumé and write a cover letter for ONE specific job, then run',
  'both through a hard checklist-gate before returning them.',
  '',
  '## Recruiter model (why the rules are what they are)',
  'A recruiter spends seconds per résumé with ~99 others beside it. They first',
  'check: does the candidate\'s role match the vacancy\'s role? If not, skip. Then',
  'the eye runs diagonally for matches and reads the top 2–3 jobs. The cover',
  'letter is a teaser whose only job is to get the résumé opened. Anything that',
  'is not grasped at a glance does not work.',
  '',
  '## Five invariants',
  '1. Relevant first — what matches the vacancy goes in the top lines.',
  '2. Role = role of the vacancy — the headline and titles reflect the role',
  '   actually performed and what the JD asks for (never inflate beyond the',
  '   evidence in the materials).',
  '3. Shorter = stronger — cut duplication and walls of text.',
  '4. Match the stack and setup — surface the JD\'s key stack keywords (only those',
  '   the candidate genuinely has), methodology, and team/scale signals.',
  '5. Numbers only in results — achievements are quantified; a metric marker (✔)',
  '   sets them off. Never put numbers in plain responsibilities.',
  '',
  '## Résumé rules',
  '- Headline = the target role (from the JD / the optional headline hint), using',
  '  the candidate\'s real role, not a paper job title.',
  '- State key stack keywords explicitly so a keyword scan hits them.',
  '- Summary: 1–2 sentences on scale/scope; lead with what the JD prioritises.',
  '- Each job: short project description (NDA-safe) → area of responsibility →',
  '  quantified results. Prefer the perfective formula: "{Built/Introduced/',
  '  Rolled out} X, which {cut/sped up/automated} Y by {Z% | A→B}."',
  '- Make every metric specific ("38% p99", not "improved performance"); if a',
  '  result has no metric in the materials, mark it NEEDS_METRIC rather than',
  '  inventing one.',
  '- One consistent language of terms (do not mix e.g. "fintech" and a native',
  '  translation of it in the same document).',
  '',
  '## Cover-letter rules',
  '- Short: ≤ ~150 words, readable in ≤15 seconds on the diagonal. No long lists',
  '  of domains/projects.',
  '- Structure, in order: (1) greeting + one-line hook naming the role and years',
  '  in the domain; (2) a compact inline stack line; (3) the BRIDGE (see below);',
  '  (4) optionally one line on growth/learning; (5) a one-line close; (6) sign-off.',
  '- The BRIDGE technique: pull the key role requirement from the JD, find the',
  '  candidate fact that best meets it, and write ONE sentence linking them',
  '  ("You wrote you need {REQUIREMENT} — I have exactly that: {FACT}."). If no',
  '  genuine match exists, DO NOT invent one — omit the bridge.',
  '',
  '## Checklist gate (run before returning)',
  'Score each item PASS/FAIL. `error` BLOCKS the output — if any error fails, fix',
  'the artifact and re-check until all errors pass. `warn` is advisory.',
  'Résumé — R1(error): headline = target role · R2(error): the top job\'s first',
  '1–2 bullets carry the role-relevant signals · R3(error): one consistent term',
  'language · R4(error): numbers only in results, not responsibilities · R5(warn):',
  'every result has a specific metric (else NEEDS_METRIC) · R6(warn): each job has',
  'a project description + methodology where the materials allow.',
  'Cover — CL1(error): within the word limit · CL2(error): role in the hook = the',
  'vacancy role · CL3(error): a bridge is present when the JD states an explicit',
  'role requirement · CL4(error): no long domain/project list · CL5(warn): one',
  'consistent term language.',
  '',
  '## Output (return exactly these three sections in Markdown)',
  '## 1. Tailored résumé',
  '<Headline, Summary, Experience with ✔ results, Skills, Education>',
  '## 2. Cover letter',
  '<the letter per the structure above; end with a word count>',
  '## 3. Checklist report',
  '<a table: ID | Severity | Status | Comment, then a final line',
  '"ERRORS: n · WARNINGS: m · GATE: PASS|BLOCKED">',
  '',
  'If GATE would be BLOCKED, fix the artifacts until all errors PASS, then return',
  'the corrected versions. Use ONLY the candidate materials in <project_context>',
  'and the JD below — never fabricate facts, metrics, employers, or authorship.',
  '',
].join('\n');

/** Build the résumé-and-cover tailoring prompt. Generic; personalisation comes
 *  entirely from `ctx` (bundleProjectContext) + the target `jd`. */
export function buildTailorPrompt(ctx, jd, headline, lang) {
  return [
    TAILOR_INSTRUCTIONS,
    headline ? `TARGET ROLE / HEADLINE HINT: ${headline}\n` : '',
    'TARGET JOB DESCRIPTION:',
    '"""',
    jd,
    '"""',
    ctx ? `\n<project_context>\n${ctx}\n</project_context>` : '',
    lang && lang !== 'en' ? `\nWrite the résumé and cover letter in the candidate's language (${lang}).` : '',
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

  // Tailor the CV + write a cover letter for a specific JD, gated by the generic
  // checklist. Reads only the candidate's own materials + the JD; no file writes.
  app.post('/api/cv-studio/tailor', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const jd = (typeof body.jd === 'string' ? body.jd : '').slice(0, MAX_JD).trim();
    if (!jd || jd.length < 40) {
      return res.status(400).json({ error: 'paste the target job description (~40+ characters) to tailor against' });
    }
    const headline = (typeof body.headline === 'string' ? body.headline : '').replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_HEADLINE);
    const lang = resolveLocale(req);
    const ctx = bundleProjectContext({});
    if (!ctx) {
      return res.status(400).json({ error: 'no candidate materials yet — add your CV / profile first, so the tailoring is about you' });
    }
    const prompt = buildTailorPrompt(ctx, jd, headline, lang);

    if (!body.run) {
      return res.json({
        mode: 'manual',
        prompt,
        message: providerAvailable()
          ? 'Set { run: true } to tailor live, or copy this prompt into any LLM.'
          : 'No API key set — copy this prompt into any LLM, then paste the result back.',
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

  // v1.117.0 (parent parity — modes/add.md, generalized) — "Add to CV".
  // Turn a source (a GitHub repo / article / portfolio URL, or pasted text)
  // into ATS-ready CV bullet points GROUNDED ONLY in that source. The model is
  // forbidden from inventing metrics, employers, or dates — anything not in
  // the source is omitted (the "keywords get reformulated, never fabricated"
  // rule). Returns SUGGESTIONS ONLY: no file is ever written — the user reviews
  // the bullets and pastes what they accept into the CV editor themselves,
  // which goes through the normal PUT /api/cv (stripDangerousMarkdown) path.
  // A URL source must pass isValidJobUrl and is fetched via the DNS-pinned
  // safeGet (the SSRF envelope), size-capped and HTML-stripped.
  app.post('/api/cv-studio/add-entry', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    let source = (typeof body.text === 'string' ? body.text : '').slice(0, MAX_JD).trim();
    let origin = 'pasted text';
    const url = (typeof body.url === 'string' ? body.url : '').trim();
    if (!source && url) {
      if (!isValidJobUrl(url)) {
        return res.status(400).json({ error: 'invalid or unsafe URL' });
      }
      try {
        const r = await safeGet(url, { timeoutMs: 15_000, maxBytes: 512 * 1024 });
        if (r.status < 200 || r.status >= 300) {
          return res.status(422).json({ error: `source fetch failed (HTTP ${r.status})` });
        }
        // Plain-TEXT extraction for an LLM prompt (never rendered as HTML —
        // the client renders answers through UI.md, the escape-first
        // boundary). Drop script/style CONTENT, strip tags to a fixed point
        // (a strip can reveal a new tag), then remove every remaining < / >
        // outright. The [<>] sweep below is what makes the bounded 8-pass loop
        // safe: even if the cap trips, no angle bracket — hence no partial
        // tag — can survive it (CodeQL incomplete-multi-character-sanitization).
        let text = String(r.body || '')
          .replace(/<script\b[\s\S]*?<\/script[^>]*>/gi, ' ')
          .replace(/<style\b[\s\S]*?<\/style[^>]*>/gi, ' ');
        let prev;
        let passes = 0;
        do { prev = text; text = text.replace(/<[^>]*>/g, ' '); } while (text !== prev && ++passes < 8);
        source = text
          .replace(/[<>]/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, MAX_JD)
          .trim();
        origin = url;
      } catch (e) {
        return res.status(422).json({ error: `source fetch failed: ${String(e && e.message || e).slice(0, 200)}` });
      }
    }
    if (!source || source.length < 80) {
      return res.status(400).json({ error: 'provide a source: a URL or pasted text (~80+ characters) describing the project/publication/role' });
    }
    const lang = resolveLocale(req);
    const ctx = bundleProjectContext({});
    const prompt = [
      'You are career-ops CV Studio in "add to CV" mode.',
      `Respond in language: ${lang}.`,
      '',
      'TASK: turn the SOURCE below into CV-ready content the candidate can paste into their CV:',
      '1. A one-line entry title (project/publication/role name + a dash + a one-clause summary).',
      '2. 2-4 ATS-friendly bullet points (impact verbs; concrete tech nouns from the source).',
      '3. A "Skills to add" line listing only technologies/methods that literally appear in the source.',
      '',
      'HARD RULES:',
      '- Ground EVERY claim in the SOURCE text. If a metric, employer, date, or outcome is not in the source, OMIT it — never invent or estimate.',
      '- Do not claim authorship or a role the source does not state.',
      '- If the source is too thin to support even one honest bullet, say so instead of padding.',
      ctx ? '- The CANDIDATE CONTEXT is for tone/dedup only (skip bullets the CV already has) — never copy claims from it into the new entry.' : '',
      '',
      `SOURCE (${origin}):`,
      '"""',
      source,
      '"""',
      ctx ? '\nCANDIDATE CONTEXT (tone/dedup only):\n"""\n' + ctx.slice(0, 12_000) + '\n"""' : '',
    ].filter(Boolean).join('\n');

    if (!body.run) {
      return res.json({
        mode: 'manual',
        prompt,
        message: providerAvailable()
          ? 'Set { run: true } to generate live, or copy this prompt into any LLM.'
          : 'No API key set — copy this prompt into any LLM, then paste the result back.',
      });
    }
    const r = await runActiveProvider(prompt);
    if (r.mode === 'too-large') {
      return res.status(413).json({ error: 'prompt too large', details: [`assembled prompt is ${r.size} bytes; soft cap is ${r.cap}.`] });
    }
    if (r.mode === 'manual') return res.json({ mode: 'manual', prompt, message: 'No provider available — copy this prompt into any LLM.' });
    if (r.error) return res.status(502).json({ mode: r.mode, prompt, error: r.error });
    return res.json({ mode: r.mode, markdown: cleanLlmMarkdown(r.markdown), usage: r.usage });
  });
}
