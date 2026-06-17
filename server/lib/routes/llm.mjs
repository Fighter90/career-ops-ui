/**
 * LLM-bound routes: evaluate, deep research, generic modes, apply-helper,
 * and interview-prep archive.
 *
 *   POST /api/evaluate                 → score JD vs CV (Anthropic | Gemini | manual)
 *   POST /api/evaluate/test-gemini     → smoke check for GEMINI_API_KEY
 *   POST /api/evaluate/test-anthropic  → smoke check for ANTHROPIC_API_KEY (P-7)
 *   POST /api/deep                     → company deep-dive
 *   POST /api/mode/:slug               → generic mode runner (whitelisted slugs)
 *   POST /api/apply-helper             → static checklist text
 *   GET  /api/interview-prep           → list saved deep-research files
 *   GET  /api/interview-prep/:name     → read one
 *   DELETE /api/interview-prep/:name   → unlink one
 *
 * P-7: /api/evaluate now reaches Anthropic in addition to Gemini. The
 * routing rule mirrors /api/deep — Anthropic is preferred when both keys
 * are present. Fallback chain: Anthropic → Gemini → manual.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { PATHS, path as projPath } from '../paths.mjs';
import { slugify, today } from '../parsers.mjs';
import { runNodeScript } from '../runner.mjs';
import { runAnthropic, hasAnthropicKey, hasGeminiKey } from '../anthropic.mjs';
import { runGemini } from '../gemini.mjs';
import { runOpenAI, runQwen, runOpenRouter, hasOpenAIKey, hasQwenKey, hasOpenRouterKey } from '../openai.mjs';
import { providerOrder } from '../env-config.mjs';
import { sanitizeJobDescription, sanitizePathName } from '../security.mjs';
import { cleanLlmMarkdown } from '../llm-output.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import {
  bundleProjectContext,
  buildEvaluationPrompt,
  buildDeepPrompt,
  buildModePrompt,
  buildApplyChecklist,
  resolveLocale,
} from '../prompts.mjs';

// v1.39.0 (WS8.2) — honor LLM_PROVIDER. auto → both (legacy
// Anthropic→Gemini); claude → Anthropic only; gemini → Gemini
// only. A forced provider with no key falls through to the
// manual-prompt path exactly like the pre-v1.39 no-key case.
function _provGate() {
  const o = providerOrder();
  return {
    wantAnthropic: o.includes('anthropic'), wantGemini: o.includes('gemini'),
    wantOpenAI: o.includes('openai'), wantQwen: o.includes('qwen'),
    wantOpenRouter: o.includes('openrouter'),
  };
}

// v1.55.0 — the "works via OR" tail. OpenAI & Qwen are in-process
// HTTPS clients (like Anthropic) with no parent filesystem, so the
// same bundled context must be inlined. Consulted AFTER the existing
// Anthropic (inline) and Gemini (subprocess) branches so the auto
// preference Anthropic→Gemini→OpenAI→Qwen is preserved; an explicit
// LLM_PROVIDER=openai|qwen makes only that one `want*`. Returns the
// first keyed provider in tail order, or null.
function _tailProvider() {
  const g = _provGate();
  if (g.wantOpenAI && hasOpenAIKey()) return { mode: 'openai', run: runOpenAI };
  if (g.wantQwen && hasQwenKey()) return { mode: 'qwen', run: runQwen };
  // v1.57.0 — OpenRouter is last in the auto tail (a single key fronts
  // every major model), so an existing Anthropic/Gemini/OpenAI/Qwen
  // setup is never silently re-routed through it.
  if (g.wantOpenRouter && hasOpenRouterKey()) return { mode: 'openrouter', run: runOpenRouter };
  return null;
}

// Generic mode endpoints — kept narrow on purpose. Modes that have a
// dedicated route (oferta → /api/evaluate, deep → /api/deep) and
// modes the user only runs in Claude Code (apply, scan, pipeline,
// tracker, pdf, latex, ofertas, auto-pipeline) intentionally stay off
// this list. Update when a UI page adds support for a new mode.
const MODE_ALLOWLIST = ['batch', 'contacto', 'cover', 'followup', 'interview-prep', 'patterns', 'project', 'training'];

// Smoke-test fixture — chosen to be ≥50 chars after sanitization so it
// passes the same gate as real /api/evaluate calls.
const SMOKE_JD = 'Smoke test: Senior Backend Engineer with PHP and Go responsibilities, including microservice ownership and code review duties.';

// BF-3 — soft cap on combined prompt size before we hit the LLM. Even
// the largest Anthropic models (1M-token context for Sonnet 4.6) charge
// per input token and the bundleProjectContext output + huge JD could
// stack up. 200 KB ≈ ~50K tokens, comfortably below any current ceiling
// while flagging clearly when something is off.
const PROMPT_SIZE_SOFT_CAP = 200 * 1024;

export function registerLlmRoutes(app) {
  // ─── /api/evaluate ──────────────────────────────────────────────────
  app.post('/api/evaluate', llmRateLimit, async (req, res) => {
    const { jd: rawJd, save, mode } = req.body || {};
    const jd = sanitizeJobDescription(rawJd);
    if (!jd || jd.length < 50) {
      return res.status(400).json({ error: 'JD text required (min 50 chars after sanitization)' });
    }
    const lang = resolveLocale(req);

    let saved = null;
    if (save) {
      const name = `jd-${today()}-${Date.now()}.txt`;
      mkdirSync(PATHS.jdsDir, { recursive: true });
      writeFileSync(projPath('jds', name), jd);
      saved = name;
    }

    const promptText = buildEvaluationPrompt(jd, lang);

    // F-009 — explicit manual mode mirrors /api/deep. Lets the user opt
    // out of the live LLM call (and the Anthropic credit burn) even when
    // a key is set — useful for offline copying into Claude Code.
    if (mode === 'manual') {
      return res.json({
        mode: 'manual',
        prompt: promptText,
        message: 'Manual mode: copy this prompt into Claude/ChatGPT/Gemini.',
        saved,
      });
    }

    // P-7 — Anthropic parity. Prefer Anthropic over Gemini when both keys
    // present (better long-form structured output for oferta-style A-G
    // evaluations). REVIEW-A1 inlining: bundle cv + profile + _shared +
    // oferta so the model has the files the prompt references.
    if (_provGate().wantAnthropic && hasAnthropicKey()) {
      const ctx = bundleProjectContext({ modeSlugs: ['_shared', 'oferta'] });
      const fullPrompt = ctx + promptText;
      // BF-3 — bail fast when the assembled prompt would exceed the
      // soft cap. Otherwise we'd burn a multi-second roundtrip + tokens
      // before Anthropic complains about context size.
      if (fullPrompt.length > PROMPT_SIZE_SOFT_CAP) {
        return res.status(413).json({
          error: 'prompt too large',
          details: [`assembled prompt is ${fullPrompt.length} bytes; soft cap is ${PROMPT_SIZE_SOFT_CAP}. Truncate the JD or shrink your CV.`],
        });
      }
      const r = await runAnthropic(fullPrompt, { maxTokens: 8192 });
      if (r.error) return res.status(502).json({ mode: 'anthropic', prompt: promptText, error: r.error, saved });
      return res.json({ mode: 'anthropic', prompt: promptText, markdown: r.markdown, usage: r.usage, saved });
    }

    if (_provGate().wantGemini && hasGeminiKey()) {
      // Use the existing gemini-eval.mjs pipe interface — it reads the
      // CV from disk itself (it's a Node script in the parent), so no
      // bundleProjectContext needed here.
      const tmpFile = projPath('output', `web-jd-${Date.now()}.txt`);
      mkdirSync(PATHS.outputDir, { recursive: true });
      writeFileSync(tmpFile, jd);
      const result = await runNodeScript('gemini-eval.mjs', ['--file', tmpFile], { timeoutMs: 120_000 });
      return res.json({ mode: 'gemini', saved, ...result });
    }

    // v1.55.0 — OpenAI / Qwen tail (same inlined context as Anthropic).
    const tp = _tailProvider();
    if (tp) {
      const ctx = bundleProjectContext({ modeSlugs: ['_shared', 'oferta'] });
      const fullPrompt = ctx + promptText;
      if (fullPrompt.length > PROMPT_SIZE_SOFT_CAP) {
        return res.status(413).json({
          error: 'prompt too large',
          details: [`assembled prompt is ${fullPrompt.length} bytes; soft cap is ${PROMPT_SIZE_SOFT_CAP}. Truncate the JD or shrink your CV.`],
        });
      }
      const r = await tp.run(fullPrompt, { maxTokens: 8192 });
      if (r.error) return res.status(502).json({ mode: tp.mode, prompt: promptText, error: r.error, saved });
      return res.json({ mode: tp.mode, prompt: promptText, markdown: r.markdown, usage: r.usage, saved });
    }

    return res.json({
      mode: 'manual',
      message: 'No LLM key set — copy this prompt into Claude/ChatGPT/Gemini/Qwen',
      prompt: promptText,
      saved,
    });
  });

  // Smoke-test endpoints — verify each provider key is wired without
  // burning a real evaluation. Kept as separate routes so the SPA can
  // probe each independently from /#/config.
  app.post('/api/evaluate/test-gemini', async (_req, res) => {
    if (!hasGeminiKey()) {
      return res.status(400).json({ ok: false, error: 'GEMINI_API_KEY not set' });
    }
    const tmp = projPath('output', `gemini-smoke-${Date.now()}.txt`);
    mkdirSync(PATHS.outputDir, { recursive: true });
    writeFileSync(tmp, SMOKE_JD);
    try {
      const result = await runNodeScript('gemini-eval.mjs', ['--file', tmp], { timeoutMs: 30_000 });
      const sample = (result.stdout || '').slice(0, 200);
      const ok = result.code === 0 && sample.length > 0;
      res.json({ ok, code: result.code, sampleLength: (result.stdout || '').length, sample });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // P-7 — Anthropic equivalent of test-gemini. Sends a tiny prompt
  // (≤256 tokens output) so it costs essentially nothing. Returns a
  // 200-char sample so the SPA can show "✓ Anthropic working".
  app.post('/api/evaluate/test-anthropic', async (_req, res) => {
    if (!hasAnthropicKey()) {
      return res.status(400).json({ ok: false, error: 'ANTHROPIC_API_KEY not set' });
    }
    try {
      const r = await runAnthropic('Reply with the single word "ok".', { maxTokens: 256, timeoutMs: 30_000 });
      if (r.error) return res.json({ ok: false, error: r.error });
      const sample = (r.markdown || '').slice(0, 200);
      res.json({ ok: sample.length > 0, sampleLength: (r.markdown || '').length, sample, usage: r.usage });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─── /api/deep ──────────────────────────────────────────────────────
  app.post('/api/deep', llmRateLimit, async (req, res) => {
    const { company, role, run } = req.body || {};
    if (!company) return res.status(400).json({ error: 'company required' });
    const lang = resolveLocale(req);
    const prompt = buildDeepPrompt(company, role, lang);

    // When run:true AND a key is configured, execute server-side and
    // return the rendered Markdown so the user sees real research output
    // without leaving the browser. Persist every successful run into
    // interview-prep/ for future browsing.
    if (run) {
      let result = null;
      let mode = null;
      if (_provGate().wantAnthropic && hasAnthropicKey()) {
        mode = 'anthropic';
        // REVIEW-A1 — Anthropic has no filesystem; inline cv/profile/mode
        // content so "Read these files first" actually has files to read.
        const ctx = bundleProjectContext({ modeSlugs: ['_shared', 'deep'] });
        const fullPrompt = ctx + prompt;
        if (fullPrompt.length > PROMPT_SIZE_SOFT_CAP) {
          return res.status(413).json({
            error: 'prompt too large',
            details: [`assembled prompt is ${fullPrompt.length} bytes; soft cap is ${PROMPT_SIZE_SOFT_CAP}.`],
          });
        }
        const r = await runAnthropic(fullPrompt, { maxTokens: 8192 });
        if (r.error) return res.status(502).json({ mode, prompt, error: r.error });
        result = { markdown: r.markdown, code: 0 };
      } else if (_provGate().wantGemini && hasGeminiKey()) {
        // v1.73.0 — generic Gemini client with the real deep-research prompt
        // (cv.md + profile.yml + modes/deep.md inlined), NOT oferta-only
        // gemini-eval.mjs. runGemini already pipes through cleanLlmMarkdown.
        mode = 'gemini';
        const ctx = bundleProjectContext({ modeSlugs: ['_shared', 'deep'] });
        const fullPrompt = ctx + prompt;
        if (fullPrompt.length > PROMPT_SIZE_SOFT_CAP) {
          return res.status(413).json({
            error: 'prompt too large',
            details: [`assembled prompt is ${fullPrompt.length} bytes; soft cap is ${PROMPT_SIZE_SOFT_CAP}.`],
          });
        }
        const r = await runGemini(fullPrompt, { maxTokens: 8192 });
        if (r.error) return res.status(502).json({ mode, prompt, error: r.error });
        result = { markdown: r.markdown, code: 0 };
      } else {
        // v1.55.0 — OpenAI / Qwen tail (in-process, inline context).
        const tp = _tailProvider();
        if (tp) {
          mode = tp.mode;
          const ctx = bundleProjectContext({ modeSlugs: ['_shared', 'deep'] });
          const fullPrompt = ctx + prompt;
          if (fullPrompt.length > PROMPT_SIZE_SOFT_CAP) {
            return res.status(413).json({
              error: 'prompt too large',
              details: [`assembled prompt is ${fullPrompt.length} bytes; soft cap is ${PROMPT_SIZE_SOFT_CAP}.`],
            });
          }
          const r = await tp.run(fullPrompt, { maxTokens: 8192 });
          if (r.error) return res.status(502).json({ mode, prompt, error: r.error });
          result = { markdown: r.markdown, code: 0 };
        }
      }
      if (result) {
        let saved = null;
        if (result.markdown) {
          const slug = `${slugify(company)}-${role ? slugify(role) : 'general'}.md`;
          mkdirSync(PATHS.interviewPrepDir, { recursive: true });
          writeFileSync(projPath('interview-prep', slug), result.markdown);
          saved = slug;
        }
        return res.json({ mode, prompt, markdown: result.markdown, saved, code: result.code });
      }
    }

    res.json({
      mode: 'manual',
      prompt,
      message: (hasAnthropicKey() || hasGeminiKey() || hasOpenAIKey() || hasQwenKey() || hasOpenRouterKey())
        ? 'Set { run: true } to execute via Anthropic/Gemini/OpenAI/Qwen/OpenRouter, or copy the prompt into Claude Code.'
        : 'No API key set. Paste this into Claude Code for full deep research with WebFetch.',
    });
  });

  // ─── Interview-prep archive ─────────────────────────────────────────
  app.get('/api/interview-prep', (_req, res) => {
    if (!existsSync(PATHS.interviewPrepDir)) return res.json({ files: [] });
    const files = readdirSync(PATHS.interviewPrepDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const stat = statSync(projPath('interview-prep', f));
        return { name: f, size: stat.size, mtime: stat.mtime };
      })
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json({ files });
  });

  app.get('/api/interview-prep/:name', (req, res) => {
    const safe = sanitizePathName(req.params.name);
    if (!safe || !safe.endsWith('.md')) return res.status(400).json({ error: 'invalid name' });
    const file = projPath('interview-prep', safe);
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    // v1.58.0 — clean on serve so briefs saved before the fix (with
    // leaked <tool_call>/<tool_response> scaffolding) still render as a
    // formatted document in Saved research.
    res.json({ name: safe, markdown: cleanLlmMarkdown(readFileSync(file, 'utf8')) });
  });

  app.delete('/api/interview-prep/:name', (req, res) => {
    const safe = sanitizePathName(req.params.name);
    if (!safe || !safe.endsWith('.md')) return res.status(400).json({ error: 'invalid name' });
    const file = projPath('interview-prep', safe);
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    unlinkSync(file);
    res.json({ ok: true, deleted: safe });
  });

  // ─── /api/mode/:slug — generic mode runner ──────────────────────────
  app.post('/api/mode/:slug', llmRateLimit, async (req, res) => {
    const slug = req.params.slug;
    if (!MODE_ALLOWLIST.includes(slug)) {
      return res.status(404).json({ error: `unknown mode "${slug}"` });
    }
    const modeFile = projPath('modes', `${slug}.md`);
    if (!existsSync(modeFile)) {
      return res.status(404).json({ error: `modes/${slug}.md not found in parent project` });
    }
    const template = readFileSync(modeFile, 'utf8');
    const context = (req.body && typeof req.body === 'object') ? req.body : {};
    const lang = resolveLocale(req);
    const prompt = buildModePrompt(template, slug, context, lang);

    if (context.run) {
      // Prefer Anthropic for live execution (better at long-form
      // structured output than Gemini for these modes); fall back to
      // Gemini if no Anthropic key. Either path produces the same
      // response shape so the UI doesn't care which engine ran.
      if (_provGate().wantAnthropic && hasAnthropicKey()) {
        // REVIEW-A1 — buildModePrompt already inlines modes/<slug>.md;
        // here we add cv.md + profile.yml + modes/_shared.md so Anthropic
        // has the same context that Claude Code would read locally.
        const ctx = bundleProjectContext({ modeSlugs: ['_shared'] });
        const fullPrompt = ctx + prompt;
        if (fullPrompt.length > PROMPT_SIZE_SOFT_CAP) {
          return res.status(413).json({
            error: 'prompt too large',
            details: [`assembled prompt is ${fullPrompt.length} bytes; soft cap is ${PROMPT_SIZE_SOFT_CAP}.`],
          });
        }
        const r = await runAnthropic(fullPrompt);
        if (r.error) return res.status(502).json({ mode: 'anthropic', slug, prompt, error: r.error });
        return res.json({ mode: 'anthropic', slug, prompt, markdown: r.markdown, usage: r.usage });
      }
      if (_provGate().wantGemini && hasGeminiKey()) {
        // v1.73.0 — use the generic Gemini client with the real mode prompt
        // (cv.md + profile.yml inlined via bundleProjectContext), NOT the
        // oferta-only gemini-eval.mjs which would mis-evaluate the prompt as
        // a JD. Now matches the Anthropic / OpenAI-compatible branches.
        const ctx = bundleProjectContext({ modeSlugs: ['_shared'] });
        const fullPrompt = ctx + prompt;
        if (fullPrompt.length > PROMPT_SIZE_SOFT_CAP) {
          return res.status(413).json({
            error: 'prompt too large',
            details: [`assembled prompt is ${fullPrompt.length} bytes; soft cap is ${PROMPT_SIZE_SOFT_CAP}.`],
          });
        }
        const r = await runGemini(fullPrompt);
        if (r.error) return res.status(502).json({ mode: 'gemini', slug, prompt, error: r.error });
        return res.json({ mode: 'gemini', slug, prompt, markdown: r.markdown, usage: r.usage });
      }
      // v1.55.0 — OpenAI / Qwen tail (in-process, inline _shared ctx).
      const tp = _tailProvider();
      if (tp) {
        const ctx = bundleProjectContext({ modeSlugs: ['_shared'] });
        const fullPrompt = ctx + prompt;
        if (fullPrompt.length > PROMPT_SIZE_SOFT_CAP) {
          return res.status(413).json({
            error: 'prompt too large',
            details: [`assembled prompt is ${fullPrompt.length} bytes; soft cap is ${PROMPT_SIZE_SOFT_CAP}.`],
          });
        }
        const r = await tp.run(fullPrompt);
        if (r.error) return res.status(502).json({ mode: tp.mode, slug, prompt, error: r.error });
        return res.json({ mode: tp.mode, slug, prompt, markdown: r.markdown, usage: r.usage });
      }
    }
    res.json({
      mode: 'manual',
      slug,
      prompt,
      message: (hasAnthropicKey() || hasGeminiKey() || hasOpenAIKey() || hasQwenKey() || hasOpenRouterKey())
        ? 'Set { run: true } to execute via Anthropic/Gemini/OpenAI/Qwen/OpenRouter, or copy this prompt into Claude Code.'
        : 'No API key set. Copy this prompt into Claude Code (it has WebFetch/WebSearch).',
    });
  });

  // ─── /api/apply-helper ──────────────────────────────────────────────
  app.post('/api/apply-helper', (req, res) => {
    const { url, jd } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url required' });
    res.json({
      checklist: buildApplyChecklist(url, jd),
      message: 'Live application checklist generated.',
    });
  });
}
