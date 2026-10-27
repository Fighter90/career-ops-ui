// TODO: split by concern (evaluate vs deep/interview-prep vs mode runner) — 400–800 LOC band.
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
 * P-7: /api/evaluate reaches Anthropic in addition to Gemini (better
 * long-form structured output for oferta-style A-G evaluations).
 * FULL-M5: provider CHOICE is decided once, in `llm-dispatch.mjs`
 * (`resolveProvider`) — this route intercepts the Gemini evaluation
 * subprocess through that shared gate and runs the Anthropic / tail
 * branches through `runActiveProvider` with a client-disconnect abort
 * signal. Fallback chain: Anthropic → Gemini → tail → manual.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { PATHS, path as projPath } from '../paths.mjs';
import { today } from '../parsers.mjs';
// FULL-M5 — the cascade is shared: resolveProvider() is the ONE gate (the
// Gemini subprocess below intercepts through it) and every live run goes
// through runActiveProvider with a client-abort signal.
import { runActiveProvider, providerAvailable, resolveProvider, PROMPT_SIZE_SOFT_CAP } from '../llm-dispatch.mjs';
import { runNodeScript } from '../runner.mjs';
import { runAnthropic, hasAnthropicKey, hasGeminiKey } from '../anthropic.mjs';
import { validateEvaluationReport, stripScoreSummary, fixReportDate } from '../eval-validate.mjs';
// v1.248.8 (CAR-76) — the wrong-language report is surfaced as a warning on
// /api/evaluate too (the auto-pipeline has had it since v1.248.7).
import { languageOk } from '../../../scripts/remote-qa/lang-check.mjs';

// An A–G report plus the SCORE_SUMMARY block runs past 8192 output tokens in
// CJK locales (ko / zh-TW / ja, 10–13k characters): the summary at the end was
// cut off and read as "missing SCORE_SUMMARY" (live regression, v1.239.3).
export const EVAL_MAX_TOKENS = 16384;
// A full A–G report with a ~190 KB context took 88–136 s on prod and one
// locale passed 180 s (the provider default) — 2026-10-07 QA.
export const EVAL_TIMEOUT_MS = 300_000;
// CAR-147 — the evaluate ceiling is locale-aware. Tamil/Hindi are not slower
// on input (the prompt ≈ EN and the context prefix is prompt-cached): they are
// output-token-dense — Indic scripts tokenize at several tokens per syllable —
// so the same buffered 16384-token A–G report sits at/past the 300 s wall
// (ta on prod: HTTP 502 after exactly 300 s, empty report). EN and unknown
// locales keep EVAL_TIMEOUT_MS; token-dense locales get 480 s. Pure function
// of the locale string; GEMINI_EVAL_TIMEOUT_MS below stays the EN baseline.
const EVAL_TIMEOUT_TOKEN_DENSE_MS = 480_000;
const TOKEN_DENSE_EVAL_LOCALES = new Set(['ta', 'hi']);
export function evalTimeoutMs(lang) {
  const base = String(lang || 'en').trim().toLowerCase().split('-')[0];
  return TOKEN_DENSE_EVAL_LOCALES.has(base) ? EVAL_TIMEOUT_TOKEN_DENSE_MS : EVAL_TIMEOUT_MS;
}

/** Shape warnings for an evaluation, with a cut-off answer named as such. */
export function evaluationWarnings(r) {
  const warnings = validateEvaluationReport(r.markdown);
  if (r.truncated) warnings.unshift('report cut off at the output-token limit');
  return warnings;
}

/**
 * CAR-92 — warnings for the generic mode runner: the bundled-context notices
 * (a file left out / truncated) plus a cut-off answer. Every /api/mode
 * provider branch returns them; the default 8192-token output used to cut
 * silently and the user saw a half artifact with no explanation.
 */
function modeWarnings(ctxWarnings, r) {
  const warnings = [...(ctxWarnings || [])];
  if (r.truncated) warnings.push('answer cut off at the output-token limit');
  return warnings;
}
import { recordUsage, parseSubprocessUsage } from '../llm-usage.mjs';
import { sanitizeJobDescription, sanitizePathName } from '../security.mjs';
import { cleanLlmMarkdown } from '../llm-output.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import {
  bundleProjectContext,
  buildEvaluationPromptParts,
  buildDeepPrompt,
  buildModePrompt,
  buildApplyChecklist,
  resolveLocale,
  deepReportStem,
} from '../prompts.mjs';

/** Remove a temp file; a missing file or a race is not an error. */
function unlinkQuiet(file) {
  try { unlinkSync(file); } catch { /* already gone */ }
}

// ─── gemini-eval.mjs subprocess contract (CAR-92) ───────────────────────────
// The evaluate route and the auto-pipeline both shell out to the parent's
// gemini-eval.mjs. The subprocess ignores the output locale unless told, its
// failures surfaced as HTTP 200 with raw stderr attached, and its Gemini
// spend never reached the Usage page. One shared shape:
//   · `--lang <locale>` FIRST — the script skips unknown `--` flags but would
//     glue the bare VALUE onto the positional JD text; `--file` (later)
//     replaces the text, so an unknown `--lang` stays harmless either way.
//   · the locale-aware evalTimeoutMs(lang) ceiling (300 s; 480 s for the
//     token-dense ta/hi, CAR-147 — a real EN evaluation ran 136 s; the old
//     120 s evaluate-side timeout killed live runs).
//   · a non-zero exit is the CALLER's failure path; stderr stays on the
//     server (it can echo provider errors) and never reaches the client.
//   · usage is parsed from stdout best-effort (parseSubprocessUsage) and
//     recorded; the script prints none today, so this usually no-ops.
export const GEMINI_EVAL_TIMEOUT_MS = EVAL_TIMEOUT_MS;

export function geminiEvalArgs(tmpFile, { save = false, lang = 'en' } = {}) {
  return ['--lang', String(lang || 'en'), '--file', tmpFile, ...(save ? [] : ['--no-save'])];
}

// Deep-research briefs live in interview-prep/ next to the parent's own
// reports (story-bank.md, <company>-<role>.md written by `apply`), so the web
// UI lists and deletes only its own deep-<slug>.md files. Unicode letters are
// allowed: deepReportStem keeps Яндекс as яндекс.
const DEEP_NAME_RE = /^deep-[\p{L}\p{N}][\p{L}\p{N}-]{0,200}\.md$/u;
export function isDeepReportName(name) {
  return typeof name === 'string' && DEEP_NAME_RE.test(name);
}

/** A deep brief name that does not overwrite an existing file (`-2`, `-3`, …). */
function freeDeepName(stem) {
  let name = `${stem}.md`;
  for (let n = 2; existsSync(projPath('interview-prep', name)); n++) name = `${stem}-${n}.md`;
  return name;
}

// v1.39.0 (WS8.2) — LLM_PROVIDER is honoured by the SHARED cascade
// (llm-dispatch.mjs): auto → the full order; claude → Anthropic only; gemini →
// Gemini only; etc. v1.157.0 — a *forced* provider whose key isn't set falls
// back to the auto order among the configured keys, so a user who ran `init`
// with Claude Code and later added only, say, OPENROUTER_API_KEY still runs
// live. FULL-M5 — the local copy of those rules (the _provGate/_tailProvider
// pair) is deleted; resolveProvider() below is the single gate.

/**
 * FULL-M5 — abort the in-flight provider call when the client hangs up.
 * Wired ONCE per request; `close` also fires after a normal response, where
 * the abort is a harmless no-op (the provider call has already resolved).
 */
function clientAbort(res) {
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  return controller;
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
// stack up. 256 KB ≈ ~65K tokens, comfortably below any current ceiling
// while flagging clearly when something is off.
// One value for every route — defined in llm-dispatch.mjs.

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

    // CAR-111 — build the prompt once, as parts: `promptText` (stable +
    // volatile, byte-identical to the pre-split prompt) is what manual mode
    // echoes and error paths return; the Anthropic branch caches
    // `ctx + stable` and leaves the volatile JD tail uncached.
    const promptParts = buildEvaluationPromptParts(jd, lang);
    const promptText = promptParts.stable + promptParts.volatile;

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

    // P-7 — Anthropic parity. FULL-M5: the cascade is resolved ONCE via the
    // shared gate (llm-dispatch.mjs::resolveProvider). The Gemini branch is
    // the CAR-92 gemini-eval.mjs subprocess (NOT a runGemini call), so it is
    // intercepted before the cascade runs; the Anthropic + tail branches then
    // go through runActiveProvider with a client-disconnect abort signal —
    // a hung-up browser no longer burns the rest of a 300 s generation.
    const chosen = resolveProvider();

    if (chosen && chosen.mode === 'gemini') {
      // Use the existing gemini-eval.mjs pipe interface — it reads the
      // CV from disk itself (it's a standalone Node script), so no
      // bundleProjectContext needed here. --no-save: the script otherwise
      // writes its own report, tracker row and merge — side effects the user
      // asked for only with `save`. The temp JD file is always removed.
      // CAR-92: --lang, the 300 s timeout, a bounded error on a non-zero
      // exit (raw stderr stays server-side) and best-effort usage recording.
      const tmpFile = projPath('output', `web-jd-${Date.now()}.txt`);
      mkdirSync(PATHS.outputDir, { recursive: true });
      writeFileSync(tmpFile, jd);
      try {
        const args = geminiEvalArgs(tmpFile, { save: !!save, lang });
        const result = await runNodeScript('gemini-eval.mjs', args, { timeoutMs: evalTimeoutMs(lang) });
        if (result.code !== 0) {
          // Server log gets a bounded stderr excerpt (provider errors live
          // there); the client gets the exit code, never the raw output.
          console.error(`[evaluate] gemini-eval.mjs exit ${result.code}: ${(result.stderr || '').trim().slice(0, 400)}`);
          return res.status(502).json({ mode: 'gemini', prompt: promptText, saved, error: `gemini-eval.mjs exited with code ${result.code}` });
        }
        recordUsage('gemini', parseSubprocessUsage(result.stdout));
        const stdout = result.stdout || '';
        // CAR-101 — same header-date correction as the in-process branches:
        // the subprocess report's **Date:** line is the model's, today's is
        // the server's. stdout stays raw; markdown is what the client saves.
        const dated = fixReportDate(stdout, today());
        const dateWarnings = dated.replaced ? [`report **Date:** corrected to ${today()}`] : [];
        return res.json({ mode: 'gemini', prompt: promptText, saved, code: 0, stdout, markdown: dated.text, ...(dateWarnings.length ? { warnings: dateWarnings } : {}) });
      } finally {
        unlinkQuiet(tmpFile);
      }
    }

    if (chosen) {
      // REVIEW-A1 inlining: bundle cv + profile + _shared + oferta so the
      // model has the files the prompt references. CAR-111 — build the prompt
      // once, as parts: the byte-stable prefix (context + instructions) is
      // what Anthropic caches; only the volatile JD tail — whose fence tag is
      // random per prompt — stays uncached. `ctx + stable + volatile` is
      // byte-identical to the tail providers' old `ctx + promptText`.
      const controller = clientAbort(res);
      const ctxWarnings = [];
      const ctx = bundleProjectContext({ modeSlugs: ['_shared', 'oferta'], lang, warnings: ctxWarnings });
      const cachePrefix = ctx + promptParts.stable;
      const fullPrompt = cachePrefix + promptParts.volatile;
      // BF-3 — bail fast when the assembled prompt would exceed the
      // soft cap. Otherwise we'd burn a multi-second roundtrip + tokens
      // before the provider complains about context size.
      if (fullPrompt.length > PROMPT_SIZE_SOFT_CAP) {
        return res.status(413).json({
          error: 'prompt too large',
          details: [`assembled prompt is ${fullPrompt.length} bytes; soft cap is ${PROMPT_SIZE_SOFT_CAP}. Truncate the JD or shrink your CV.`],
        });
      }
      const r = await runActiveProvider(fullPrompt, {
        maxTokens: EVAL_MAX_TOKENS,
        timeoutMs: evalTimeoutMs(lang),
        cachePrefix,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return; // client hung up mid-generation
      if (r.error) return res.status(502).json({ mode: r.mode, prompt: promptText, error: r.error, saved });
      // v1.75.0 (#819) — flag malformed A–G / SCORE_SUMMARY shape as a non-fatal
      // warning so the user knows the report may be truncated/off-format.
      const warnings = [...ctxWarnings, ...evaluationWarnings(r)];
      // CAR-101 — the header date is server-side knowledge: a model that
      // ignored the prompt's pinned date gets its **Date:** line rewritten to
      // today here (a correction with a warning, never a rejection).
      const dated = fixReportDate(r.markdown, today());
      if (dated.replaced) warnings.push(`report **Date:** corrected to ${today()}`);
      // v1.248.8 (CAR-76) — same language warning the auto-pipeline carries:
      // a drift (ta came back 2–22 % own-script on prod) must surface on
      // /api/evaluate as well, where remote-qa reads it.
      if (lang && lang !== 'en' && r.markdown && !languageOk(r.markdown, lang)) {
        warnings.push(`report not in ${lang}`);
      }
      return res.json({ mode: r.mode, prompt: promptText, markdown: stripScoreSummary(dated.text), usage: r.usage, saved, ...(warnings.length ? { warnings } : {}) });
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
  app.post('/api/evaluate/test-gemini', llmRateLimit, async (_req, res) => {
    if (!hasGeminiKey()) {
      return res.status(400).json({ ok: false, error: 'GEMINI_API_KEY not set' });
    }
    const tmp = projPath('output', `gemini-smoke-${Date.now()}.txt`);
    mkdirSync(PATHS.outputDir, { recursive: true });
    writeFileSync(tmp, SMOKE_JD);
    try {
      // A smoke test must not file a report + tracker row for the fixture JD.
      // FULL-M5 — the args come from the ONE shared subprocess contract
      // (geminiEvalArgs: --lang first, --no-save for a smoke run).
      const result = await runNodeScript('gemini-eval.mjs', geminiEvalArgs(tmp), { timeoutMs: 30_000 });
      const sample = (result.stdout || '').slice(0, 200);
      const ok = result.code === 0 && sample.length > 0;
      res.json({ ok, code: result.code, sampleLength: (result.stdout || '').length, sample });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    } finally {
      unlinkQuiet(tmp);
    }
  });

  // P-7 — Anthropic equivalent of test-gemini. Sends a tiny prompt
  // (≤256 tokens output) so it costs essentially nothing. Returns a
  // 200-char sample so the SPA can show "✓ Anthropic working".
  app.post('/api/evaluate/test-anthropic', llmRateLimit, async (_req, res) => {
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
    const { company, role, run, url } = req.body || {};
    // Typed before use: a non-string company/role used to throw inside the
    // prompt builder (R-03 — a malformed body is a 4xx, never a 500).
    if (typeof company !== 'string' || !company.trim()) return res.status(400).json({ error: 'company required' });
    if (role != null && typeof role !== 'string') return res.status(400).json({ error: 'role must be a string' });
    // CAR-110 — optional freshness anchor. The URL is embedded in the prompt
    // as a bounded research label (promptLabel); the server never fetches it.
    if (url != null && typeof url !== 'string') return res.status(400).json({ error: 'url must be a string' });
    const lang = resolveLocale(req);
    // Manual copy keeps Claude Code tool names (WebFetch/WebSearch). Live run
    // must not — Gemini otherwise returns MALFORMED_FUNCTION_CALL (no tools).
    const manualPrompt = buildDeepPrompt(company, role, lang, { companyUrl: url });
    const livePrompt = buildDeepPrompt(company, role, lang, { headless: true, companyUrl: url });

    // When run:true AND a key is configured, execute server-side and
    // return the rendered Markdown so the user sees real research output
    // without leaving the browser. Persist every successful run into
    // interview-prep/deep-<slug>.md for future browsing.
    if (run) {
      const prompt = livePrompt;
      // REVIEW-A1 — the API providers have no filesystem; inline cv/profile/mode
      // content so "Read these files first" actually has files to read. The
      // shared cascade (llm-dispatch) honours LLM_PROVIDER, covers every
      // provider and records usage. CAR-92: `lang` leads the bundled context
      // (the directive after ~150 KB of English context lost to it), and the
      // prompt itself now closes with the language reminder (prompts.mjs).
      // FULL-M5 — the abort signal reaches the provider when the client
      // hangs up mid-research.
      const controller = clientAbort(res);
      const ctxWarnings = [];
      const ctx = bundleProjectContext({ modeSlugs: ['_shared', 'deep'], headless: true, warnings: ctxWarnings, lang });
      const r = await runActiveProvider(ctx + prompt, { maxTokens: 8192, sizeCap: PROMPT_SIZE_SOFT_CAP, signal: controller.signal });
      if (controller.signal.aborted) return; // client hung up mid-generation
      if (r.mode === 'too-large') {
        return res.status(413).json({
          error: 'prompt too large',
          details: [`assembled prompt is ${r.size} bytes; soft cap is ${r.cap}.`],
        });
      }
      if (r.mode !== 'manual') {
        if (r.error) return res.status(502).json({ mode: r.mode, prompt, error: r.error });
        // A brief cut off at the token limit is still saved (it is useful),
        // but the user is told it is incomplete. CAR-101 — a **Date:** line
        // the model invented is rewritten to today before it is saved.
        const dated = fixReportDate(r.markdown, today());
        const warnings = [
          ...ctxWarnings,
          ...(r.truncated ? ['brief cut off at the output-token limit'] : []),
          ...(dated.replaced ? [`brief **Date:** corrected to ${today()}`] : []),
        ];
        let saved = null;
        if (r.markdown) {
          mkdirSync(PATHS.interviewPrepDir, { recursive: true });
          saved = freeDeepName(deepReportStem(company, role));
          writeFileSync(projPath('interview-prep', saved), dated.text);
        }
        return res.json({ mode: r.mode, prompt, markdown: dated.text, saved, code: 0, ...(warnings.length ? { warnings } : {}) });
      }
    }

    res.json({
      mode: 'manual',
      prompt: manualPrompt,
      message: providerAvailable()
        ? 'Set { run: true } to execute via your configured provider, or copy the prompt into Claude Code.'
        : 'No API key set. Paste this into Claude Code for full deep research with WebFetch.',
    });
  });

  // ─── Interview-prep archive ─────────────────────────────────────────
  app.get('/api/interview-prep', (_req, res) => {
    if (!existsSync(PATHS.interviewPrepDir)) return res.json({ files: [] });
    const files = readdirSync(PATHS.interviewPrepDir)
      .filter(isDeepReportName)
      .map((f) => {
        const stat = statSync(projPath('interview-prep', f));
        return { name: f, size: stat.size, mtime: stat.mtime };
      })
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json({ files });
  });

  app.get('/api/interview-prep/:name', (req, res) => {
    // A deep brief may carry Unicode letters; any other name is read through
    // the ASCII sanitizer (legacy briefs saved before the deep- namespace).
    const safe = isDeepReportName(req.params.name) ? req.params.name : sanitizePathName(req.params.name);
    if (!safe || !safe.endsWith('.md')) return res.status(400).json({ error: 'invalid name' });
    const file = projPath('interview-prep', safe);
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    // v1.58.0 — clean on serve so briefs saved before the fix (with
    // leaked <tool_call>/<tool_response> scaffolding) still render as a
    // formatted document in Saved research.
    res.json({ name: safe, markdown: cleanLlmMarkdown(readFileSync(file, 'utf8')) });
  });

  app.delete('/api/interview-prep/:name', (req, res) => {
    // Only the web UI's own deep-*.md briefs: the parent's interview-prep
    // reports and story-bank.md are not this page's to delete.
    const safe = req.params.name;
    if (!isDeepReportName(safe)) return res.status(400).json({ error: 'invalid name' });
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
      // FULL-M5 — the shared cascade (llm-dispatch) decides the provider and
      // records usage; a client disconnect aborts the in-flight call. When no
      // provider is chosen the request falls through to the manual response
      // WITHOUT bundling context, exactly as the old per-provider branches did.
      const chosen = resolveProvider();
      if (chosen) {
        // CAR-92 — `lang` leads the bundled context and a cut-off answer is
        // surfaced as a warning on every provider branch. buildModePrompt
        // already opens with the locale directive and closes with the reminder.
        // REVIEW-A1 — buildModePrompt already inlines modes/<slug>.md; here we
        // add cv.md + profile.yml + modes/_shared.md so the provider has the
        // same context that Claude Code would read locally.
        const controller = clientAbort(res);
        const ctxWarnings = [];
        const ctx = bundleProjectContext({ modeSlugs: ['_shared'], lang, warnings: ctxWarnings });
        const fullPrompt = ctx + prompt;
        if (fullPrompt.length > PROMPT_SIZE_SOFT_CAP) {
          return res.status(413).json({
            error: 'prompt too large',
            details: [`assembled prompt is ${fullPrompt.length} bytes; soft cap is ${PROMPT_SIZE_SOFT_CAP}.`],
          });
        }
        const r = await runActiveProvider(fullPrompt, { signal: controller.signal });
        if (controller.signal.aborted) return; // client hung up mid-generation
        if (r.error) return res.status(502).json({ mode: r.mode, slug, prompt, error: r.error });
        const warnings = modeWarnings(ctxWarnings, r);
        return res.json({ mode: r.mode, slug, prompt, markdown: r.markdown, usage: r.usage, ...(warnings.length ? { warnings } : {}) });
      }
    }
    res.json({
      mode: 'manual',
      slug,
      prompt,
      message: providerAvailable()
        ? 'Set { run: true } to execute via your configured provider, or copy this prompt into Claude Code.'
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
