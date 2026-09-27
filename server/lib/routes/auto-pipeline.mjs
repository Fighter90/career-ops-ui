/**
 * v1.16.0 — POST /api/auto-pipeline (G-007 follow-up).
 *
 * Server-side SSE orchestrator that chains the 5-step canonical
 * career-ops.org pipeline:
 *
 *   1. validate URL              → isValidJobUrl (SSRF gate)
 *   2. fetch JD                  → SSRF-safe proxy with DNS-rebind guard
 *   3. evaluate against CV       → runAnthropic / runNodeScript('gemini-eval')
 *   4. save report               → writes parent reports/<slug>.md
 *   5. append tracker row        → writes parent data/applications.md
 *
 * SSE events:
 *   start  → { steps: 5, url }
 *   step   → { i, key, label, status: 'running'|'done'|'failed', detail? }
 *   done   → { slug, score, legitimacy, reportPath, trackerNum, company, role }
 *   error  → { step, message }
 *
 * Compared to the client-side orchestrator (v1.15 PR-C), this:
 *  - emits real-time progress during long Anthropic calls (the client-side
 *    version showed a generic spinner for 30-60 s);
 *  - persists the report markdown to reports/<slug>.md (PR-I follow-up);
 *  - is curl-able for CI / smoke tests;
 *  - keeps a clean failure boundary — any step error → SSE error event,
 *    stops the chain, returns what was completed.
 *
 * PDF generation stays a separate explicit step on the client (the
 * existing /api/stream/pdf/inline endpoint handles it). Folding PDF
 * into this SSE would double the time budget; users can trigger PDF
 * from #/reports/<slug> after auto-pipeline completes.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';

import { PATHS, path as projPath } from '../paths.mjs';
import { isValidJobUrl, sanitizeJobDescription } from '../security.mjs';
import { runAnthropic, hasAnthropicKey, hasGeminiKey } from '../anthropic.mjs';
import { runOpenAI, runQwen, hasOpenAIKey, hasQwenKey } from '../openai.mjs';
import { runNodeScript } from '../runner.mjs';
import { bundleProjectContext, buildEvaluationPrompt } from '../prompts.mjs';
import { stripDangerousMarkdown } from '../security.mjs';
import { stripScoreSummary } from '../eval-validate.mjs';
import { parseApplications, today } from '../parsers.mjs';
import { logActivity } from '../activity-log.mjs';
import { safeGet } from '../safe-fetch.mjs';
import { withFileLock } from '../file-lock.mjs';
import { llmRateLimit } from '../rate-limit.mjs';

const FETCH_TIMEOUT_MS = 30_000;
const FETCH_MAX_BODY_BYTES = 64 * 1024;
const EVAL_TIMEOUT_MS = 180_000;       // 3 min — Anthropic can take 60-90s
const PROMPT_SIZE_SOFT_CAP = 200 * 1024;
const STEPS = [
  { key: 'validate', label: 'Validating URL' },
  { key: 'fetch',    label: 'Fetching job description' },
  { key: 'evaluate', label: 'Evaluating against your CV' },
  { key: 'report',   label: 'Saving report' },
  { key: 'tracker',  label: 'Adding to tracker' },
];

function openSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  // SSE hygiene: when the client disconnects mid-stream the next
  // res.write() rejects with EPIPE/ECONNRESET/"aborted". Without an
  // 'error' listener Node escalates that to an uncaughtException
  // (which, under node:test, surfaces as "asynchronous activity after
  // the test ended" and flaked the Playwright e2e job). Swallow it —
  // a gone client is expected, not exceptional — and stop writing
  // once the socket is finished/destroyed.
  res.on('error', () => { /* client vanished — nothing to do */ });
  return (event, data) => {
    if (res.writableEnded || res.destroyed) return;
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch { /* socket torn down between the guard and the write */ }
  };
}

async function fetchJobDescription(url, signal) {
  // v1.20.1 (B-1) — safeGet pins the DNS lookup at validation time
  // and reuses the IP for the actual TCP connection, closing the
  // DNS-rebind TOCTOU window between an explicit dnsLookup and the
  // second lookup `fetch()` would do internally. Redirect targets
  // are re-validated per hop inside safeGet itself.
  try {
    const r = await safeGet(url, {
      signal,
      maxBytes: FETCH_MAX_BODY_BYTES * 4, // raw HTML budget before strip
      userAgent: 'Mozilla/5.0 (career-ops-ui auto-pipeline) AppleWebKit/537.36',
    });
    if (r.status < 200 || r.status >= 300) {
      return { ok: false, error: `HTTP ${r.status}` };
    }
    const text = r.text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim()
      .slice(0, FETCH_MAX_BODY_BYTES);
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

function guessCompanyRole(jdText, url) {
  const lines = (jdText || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 30);
  let company = '';
  let role = '';
  for (const line of lines) {
    if (line.length > 200) continue;
    let m = line.match(/^([A-Z][\w\s/&,.()-]{4,80}?)\s+(?:at|@|·|\|)\s+([A-Z][\w\s.&-]{1,40})$/);
    if (m) { role = m[1].trim(); company = m[2].trim(); break; }
    m = line.match(/^([A-Z][\w\s.&-]{1,40})\s+[—-]\s+(.{4,80})$/);
    if (m && !role) { company = m[1].trim(); role = m[2].trim(); }
  }
  if (!company) {
    try {
      const u = new URL(url);
      const parts = u.hostname.split('.');
      const slug = parts.length >= 2 ? parts[parts.length - 2] : u.hostname;
      if (!['greenhouse', 'ashbyhq', 'lever', 'workable', 'smartrecruiters', 'myworkdayjobs'].includes(slug)) {
        company = slug.charAt(0).toUpperCase() + slug.slice(1);
      }
    } catch {}
  }
  if (!role) {
    role = lines.find((l) => /engineer|developer|manager|lead|architect|designer|analyst|director|specialist/i.test(l)) || '';
    role = role.slice(0, 100);
  }
  return { company: company || '', role: role || '' };
}

function extractScore(md) {
  if (!md) return null;
  const patterns = [
    /score\s*[:\-]\s*(\d+\.?\d*)\s*\/\s*5/i,
    /\*\*\s*score\s*[:\-]\s*(\d+\.?\d*)/i,
    /^score:\s*(\d+\.?\d*)/im,
  ];
  for (const p of patterns) {
    const m = md.match(p);
    if (m) {
      const n = parseFloat(m[1]);
      if (!isNaN(n) && n >= 0 && n <= 5) return n;
    }
  }
  return null;
}

function extractLegitimacy(md) {
  if (!md) return '';
  const m = md.match(/legitimacy\s*[:\-]\s*(high|medium|low|verified|suspicious|caution)\b/i);
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() : '';
}

function buildSlug(company, role) {
  const base = `${today()}-${company}-${role}`.toLowerCase();
  return base.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').slice(0, 120) || `auto-${Date.now()}`;
}

export function registerAutoPipelineRoutes(app) {
  app.post('/api/auto-pipeline', llmRateLimit, async (req, res) => {
    const url = (req.body && req.body.url || '').toString();
    const lang = (req.body && req.body.lang) || 'en';
    // v1.25.0 (G-014) — accept `mode: 'manual'` (mirrors /api/evaluate
    // contract from v1.10.2) as well as the legacy `evalMode` override.
    const requestedMode = (req.body && (req.body.mode || req.body.evalMode)) || null;
    const lockEvalMode = (requestedMode === 'anthropic' || requestedMode === 'gemini' || requestedMode === 'manual')
      ? requestedMode
      : null;

    const send = openSse(res);
    const ctrl = new AbortController();
    let aborted = false;
    res.on('close', () => { aborted = true; ctrl.abort(); });

    function step(i, status, detail) {
      if (aborted) return;
      send('step', { i, key: STEPS[i].key, label: STEPS[i].label, status, detail });
    }
    function fail(stepIndex, message) {
      send('error', { step: STEPS[stepIndex].key, message });
      res.end();
    }

    send('start', { steps: STEPS.length, url });

    // Step 1 — validate
    step(0, 'running');
    if (!isValidJobUrl(url)) {
      step(0, 'failed', 'invalid URL');
      return fail(0, 'isValidJobUrl rejected');
    }
    step(0, 'done');

    // v1.25.0 (G-014) — manual-mode short-circuit. When the caller
    // explicitly asks for `mode: 'manual'` (mirrors /api/evaluate's
    // contract from v1.10.2), emit the orchestrator shape with all
    // downstream steps marked skipped and the buildEvaluationPrompt
    // string in the `done` payload. No fetch, no LLM call, no $0.05
    // per request. Used by CI / preview flows and by users who want
    // a copy-pasteable prompt for Claude Code rather than a live run.
    if (lockEvalMode === 'manual') {
      step(1, 'done', 'skipped (manual mode)');
      const promptText = buildEvaluationPrompt('', lang);
      step(2, 'done', 'manual-prompt');
      step(3, 'done', 'skipped (manual mode)');
      step(4, 'done', 'skipped (manual mode)');
      send('done', {
        mode: 'manual',
        url,
        prompt: promptText,
        message: 'Manual mode — copy the prompt below into Claude Code / Anthropic / Gemini. No live LLM call was made.',
      });
      return res.end();
    }

    // Step 2 — fetch JD
    step(1, 'running');
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let jdText = '';
    try {
      const result = await fetchJobDescription(url, ctrl.signal);
      clearTimeout(timer);
      if (!result.ok || !result.text) {
        step(1, 'failed', result.error || 'empty body');
        return fail(1, result.error || 'fetch failed');
      }
      jdText = sanitizeJobDescription(result.text);
      if (!jdText || jdText.length < 50) {
        step(1, 'failed', 'JD too short after sanitization');
        return fail(1, 'JD too short');
      }
      step(1, 'done', `${(jdText.length / 1024).toFixed(1)} KB`);
    } catch (e) {
      clearTimeout(timer);
      step(1, 'failed', e.message);
      return fail(1, e.message);
    }

    // Step 3 — evaluate
    step(2, 'running', 'LLM call (30–90 s)…');
    let markdown = '';
    let evalMode = lockEvalMode;
    try {
      const promptText = buildEvaluationPrompt(jdText, lang);

      if (!evalMode) {
        // v1.55.0 — "works via OR": first key set wins, Anthropic →
        // Gemini → OpenAI → Qwen (matches env-config providerOrder).
        if (hasAnthropicKey()) evalMode = 'anthropic';
        else if (hasGeminiKey()) evalMode = 'gemini';
        else if (hasOpenAIKey()) evalMode = 'openai';
        else if (hasQwenKey()) evalMode = 'qwen';
        else evalMode = 'manual';
      }

      if (evalMode === 'anthropic' || evalMode === 'openai' || evalMode === 'qwen') {
        const ctx = bundleProjectContext({ modeSlugs: ['_shared', 'oferta'] });
        const full = ctx + promptText;
        if (full.length > PROMPT_SIZE_SOFT_CAP) {
          step(2, 'failed', `prompt ${full.length} > ${PROMPT_SIZE_SOFT_CAP} cap`);
          return fail(2, 'prompt too large');
        }
        const runFn = evalMode === 'openai' ? runOpenAI
          : evalMode === 'qwen' ? runQwen
            : runAnthropic;
        const r = await runFn(full, { maxTokens: 8192, timeoutMs: EVAL_TIMEOUT_MS });
        if (r.error) {
          step(2, 'failed', r.error);
          return fail(2, r.error);
        }
        markdown = r.markdown || '';
      } else if (evalMode === 'gemini') {
        const tmp = projPath('output', `auto-pipeline-${Date.now()}.txt`);
        mkdirSync(PATHS.outputDir, { recursive: true });
        writeFileSync(tmp, jdText);
        const r = await runNodeScript('gemini-eval.mjs', ['--file', tmp], { timeoutMs: EVAL_TIMEOUT_MS });
        if (r.code !== 0) {
          step(2, 'failed', `gemini-eval exit ${r.code}`);
          return fail(2, `gemini-eval exit ${r.code}`);
        }
        markdown = r.stdout || '';
      } else {
        step(2, 'failed', 'no LLM key set; manual mode incompatible with auto-pipeline');
        return fail(2, 'no LLM key');
      }
      const score = extractScore(markdown);
      step(2, 'done', score != null ? `${evalMode} · score ${score}/5` : evalMode);
    } catch (e) {
      step(2, 'failed', e.message);
      return fail(2, e.message);
    }

    const guess = guessCompanyRole(jdText, url);
    const score = extractScore(markdown);
    const legitimacy = extractLegitimacy(markdown);

    // Step 4 — save report
    step(3, 'running');
    const slug = buildSlug(guess.company || 'unknown', guess.role || 'role');
    const reportPath = `reports/${slug}.md`;
    try {
      // Score and legitimacy were read above, with the summary block present;
      // the saved report drops that machine block, as the parent's scripts do.
      const sanitized = stripDangerousMarkdown(stripScoreSummary(markdown));
      mkdirSync(PATHS.reportsDir, { recursive: true });
      const file = projPath('reports', `${slug}.md`);
      if (existsSync(file)) {
        // Don't clobber existing — append epoch suffix.
        const altSlug = `${slug}-${Date.now()}`;
        writeFileSync(projPath('reports', `${altSlug}.md`), sanitized);
        logActivity({ type: 'auto-pipeline.report.saved', target: `reports/${altSlug}.md`, dedupedFrom: slug });
        step(3, 'done', altSlug);
      } else {
        writeFileSync(file, sanitized);
        logActivity({ type: 'auto-pipeline.report.saved', target: reportPath });
        step(3, 'done', slug);
      }
    } catch (e) {
      step(3, 'failed', e.message);
      return fail(3, e.message);
    }

    // Step 5 — tracker row
    step(4, 'running');
    let trackerNum = '';
    try {
      if (!guess.company) {
        step(4, 'failed', 'company unknown — fill manually');
      } else {
        const cell = (s) => String(s || '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();
        const safeCompany = cell(guess.company);
        const safeRole    = cell(guess.role || 'Role TBD');
        const safeStatus  = 'Evaluated';
        const safeScore   = score != null ? `${score}/5` : '—';
        const safeDate    = today();
        const safeReport  = `[${slug}](reports/${slug}.md)`;
        const safeNotes   = `auto-pipeline · ${cell(url).slice(0, 160)}`;

        // v1.20.1 (H-6) — auto-pipeline races a manual POST /api/tracker
        // for the same race window described in tracker.mjs. Hold the lock
        // for the read-modify-write so dedup and nextNum see consistent state.
        trackerNum = await withFileLock(PATHS.applications, async () => {
          let content = '';
          try { content = readFileSync(PATHS.applications, 'utf8'); } catch { content = ''; }
          const existing = parseApplications(content);
          const dup = existing.find((r) => (r.company || '').toLowerCase() === safeCompany.toLowerCase()
            && (r.role || '').toLowerCase() === safeRole.toLowerCase());
          if (dup) {
            step(4, 'done', `deduped #${dup.num}`);
            return dup.num;
          }
          const nextNum = String((Math.max(0, ...existing.map((r) => parseInt(r.num, 10) || 0))) + 1).padStart(3, '0');
          const row = `| ${nextNum} | ${safeDate} | ${safeCompany} | ${safeRole} | ${safeScore} | ${safeStatus} | ❌ | ${safeReport} | ${safeNotes} |`;
          let updated;
          if (!content || !/^\|\s*#/m.test(content)) {
            updated = [
              '# Applications Tracker', '',
              '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
              '|---|------|---------|------|-------|--------|-----|--------|-------|',
              row, '',
            ].join('\n');
          } else {
            updated = content.replace(/\n*$/, '\n') + row + '\n';
          }
          mkdirSync(projPath('data'), { recursive: true });
          writeFileSync(PATHS.applications, updated);
          logActivity({ type: 'auto-pipeline.tracker.added', num: nextNum, company: safeCompany });
          step(4, 'done', `#${nextNum}`);
          return nextNum;
        });
      }
    } catch (e) {
      step(4, 'failed', e.message);
    }

    if (!aborted) {
      send('done', {
        slug, score, legitimacy,
        reportPath,
        trackerNum,
        company: guess.company, role: guess.role,
        evalMode,
      });
      res.end();
    }
  });
}
