// TODO: split by concern (JD fetch/guess helpers vs the SSE orchestrator) — 400–800 LOC band.
/**
 * v1.16.0 — POST /api/auto-pipeline (G-007 follow-up).
 *
 * Server-side SSE orchestrator that chains the 5-step canonical
 * career-ops.org pipeline:
 *
 *   1. validate URL              → isValidJobUrl (SSRF gate)
 *   2. fetch JD                  → SSRF-safe proxy with DNS-rebind guard
 *   3. evaluate against CV       → llm-dispatch cascade (or a pinned
 *                                  anthropic / gemini-eval.mjs --no-save)
 *   4. save report               → writes parent reports/<slug>.md
 *   5. append tracker row        → writes parent data/applications.md
 *
 * SSE events:
 *   start  → { steps: 5, url }
 *   step   → { i, key, label, status: 'running'|'done'|'failed', detail? }
 *   done   → { slug, score, legitimacy, reportPath, trackerNum, company, role, evalMode, warnings? }
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
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';

import { PATHS, path as projPath } from '../paths.mjs';
import { isValidJobUrl, sanitizeJobDescription } from '../security.mjs';
import { runAnthropic, hasAnthropicKey } from '../anthropic.mjs';
import { runNodeScript } from '../runner.mjs';
import { bundleProjectContext, buildEvaluationPrompt, resolveLocale } from '../prompts.mjs';
import { runActiveProvider, PROMPT_SIZE_SOFT_CAP } from '../llm-dispatch.mjs';
import { recordUsage } from '../llm-usage.mjs';
import { evaluationWarnings, EVAL_MAX_TOKENS } from './llm.mjs';
import { stripDangerousMarkdown } from '../security.mjs';
import { stripScoreSummary, validateEvaluationReport } from '../eval-validate.mjs';
import { parseReportHeader } from '../parsers.mjs';
import { parseApplications, today } from '../parsers.mjs';
import { logActivity } from '../activity-log.mjs';
import { safeGet } from '../safe-fetch.mjs';
import { withFileLock } from '../file-lock.mjs';
import { llmRateLimit } from '../rate-limit.mjs';

const FETCH_TIMEOUT_MS = 30_000;
const FETCH_MAX_BODY_BYTES = 64 * 1024;
const EVAL_TIMEOUT_MS = 300_000;       // 5 min — a full A–G report took up to 136 s on prod
// v1.248.2 — an evaluate of a real posting clears 1 KB of sanitized text; the
// old 50-char floor was passed by any boilerplate (cookie banners, placeholder
// pages like the example.com QA entries that leaked into the prod pipeline).
// ~200 chars (≈ 2–3 sentences) is the smallest text that can still describe a
// role — below it the model can only answer "Insufficient JD", and saving that
// answer as reports/<date>-t-role-<ts>.md is how the dashboard ended up
// showing junk as "Last evaluation". Stop BEFORE the LLM call: no report, no
// tracker row, no spend.
const MIN_JD_CHARS = 200;
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

// v1.248.5 — a t.me single-post page serves only the channel header in its
// HTML (~0.2 KB: title, channel, «View in Telegram») — the post text arrives
// only in the embed widget. Rewrite to the embed form and read the post from
// `.tgme_widget_message_text` (fallback: og:description).
export function telegramEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 't.me' && u.hostname !== 'telegram.me') return null;
    const seg = u.pathname.split('/').filter(Boolean);
    const chan = seg[0] === 's' ? seg[1] : seg[0];
    const id = seg[0] === 's' ? seg[2] : seg[1];
    if (!chan || !id) return null;
    return `https://t.me/${chan}/${id}?embed=1&mode=tme`;
  } catch {
    return null;
  }
}

/** Pull the post text out of the embed widget HTML (tag-stripped). */
export function extractTelegramPostText(html) {
  const raw = String(html || '');
  const open = raw.match(/<div[^>]*class="[^"]*tgme_widget_message_text[^"]*"[^>]*>/i);
  if (open) {
    // Walk forward with a div-depth counter — the widget div can nest quotes.
    const start = raw.indexOf(open[0]) + open[0].length;
    let depth = 1, i = start;
    const re = /<\/?div\b/gi;
    re.lastIndex = start;
    let m;
    while ((m = re.exec(raw))) {
      depth += m[0][1] === '/' ? -1 : 1;
      if (depth === 0) { i = m.index; break; }
    }
    if (depth === 0) {
      const t = raw.slice(start, i).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/[ \t]+/g, ' ').trim();
      if (t) return t;
    }
  }
  const og = raw.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i);
  if (og && og[1].trim()) return og[1].trim().replace(/&[a-z]+;/gi, ' ');
  return '';
}

async function fetchJobDescription(url, signal) {
  // v1.20.1 (B-1) — safeGet pins the DNS lookup at validation time
  // and reuses the IP for the actual TCP connection, closing the
  // DNS-rebind TOCTOU window between an explicit dnsLookup and the
  // second lookup `fetch()` would do internally. Redirect targets
  // are re-validated per hop inside safeGet itself.
  try {
    // v1.248.5 — the embed form of a t.me single post. The rewrite can change
    // the host (telegram.me → t.me), so the embed URL goes through the SAME
    // isValidJobUrl() entry gate as the original — never fetch an unvalidated
    // URL, even one this module constructed itself.
    // The /s/ feed page carries ~20 posts — evaluating it would score
    // someone else's posting, so the embed form is used for BOTH link forms.
    const embed = telegramEmbedUrl(url);
    if (embed && !isValidJobUrl(embed)) {
      return { ok: false, error: 'telegram embed URL failed validation', rejected: true };
    }
    const r = await safeGet(embed || url, {
      signal,
      maxBytes: FETCH_MAX_BODY_BYTES * 4, // raw HTML budget before strip
      userAgent: 'Mozilla/5.0 (career-ops-ui auto-pipeline) AppleWebKit/537.36',
    });
    if (r.status < 200 || r.status >= 300) {
      return { ok: false, error: `HTTP ${r.status}` };
    }
    if (embed) {
      const post = extractTelegramPostText(r.text);
      if (!post || post.length < MIN_JD_CHARS) {
        // No widget text (or shorter than the JD floor) → the entry is junk.
        return { ok: false, error: 'telegram post has no text', rejected: true };
      }
      return { ok: true, text: post };
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

// Hosts that say nothing about the hiring company: messenger/aggregator
// pages whose domain slug would become a nonsense company name («T» from
// t.me was the motivating bug — 44 `t-role` junk reports on prod).
const EMPTY_DOMAINS = new Set([
  't.me', 'telegram.me', 'vk.com', 'linkedin.com', 'www.linkedin.com',
  'facebook.com', 'www.facebook.com', 'x.com', 'twitter.com',
  'example.com', 'jobs.google.com',
]);

export function guessCompanyRole(jdText, url) {
  const lines = (jdText || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 30);
  let company = '';
  let role = '';
  // Telegram page shapes: t.me/<channel>/<postId> (scan links) and
  // t.me/s/<channel>/<postId> (the web-preview form — v1.248.4: the «s»
  // segment is skipped, it is not a channel). The channel is the closest
  // thing to a «company» a Telegram post has (CONTEXT.md: telegram-channel
  // source).
  let channelGuess = '';
  try {
    const u = new URL(url);
    if (u.hostname === 't.me' || u.hostname === 'telegram.me') {
      const seg = u.pathname.split('/').filter(Boolean);
      const chan = seg[0] === 's' ? seg[1] : seg[0];
      if (chan) channelGuess = chan;
    }
  } catch {}
  for (const line of lines) {
    if (line.length > 200) continue;
    let m = line.match(/^([A-Z][\w\s/&,.()-]{4,80}?)\s+(?:at|@|·|\|)\s+([A-Z][\w\s.&-]{1,40})$/);
    if (m) { role = m[1].trim(); company = m[2].trim(); break; }
    m = line.match(/^([A-Z][\w\s.&-]{1,40})\s+[—–-]\s+(.{4,80})$/);
    if (m && !role) { company = m[1].trim(); role = m[2].trim(); }
    // v1.248.4 — «Компания: X» / «Компания — X» self-labels on Telegram posts.
    m = line.match(/^Компания:\s*(.+)$/u);
    if (m && !company) company = m[1].trim().slice(0, 60);
  }
  if (!company) {
    // «…в X» / «…в компании X» — the employer named mid-sentence (Cyrillic
    // posts routinely do this). Only for messenger hosts, where the domain
    // carries nothing.
    try {
      const u = new URL(url);
      if (EMPTY_DOMAINS.has(u.hostname.toLowerCase())) {
        const inMatch = (jdText || '').match(/\bв\s+компании\s+([A-ZА-Я][\w\s&.-]{2,40})/u)
          || (jdText || '').match(/\bв\s+([A-ZА-Я][\w\s&.-]{2,40})\s+(?:ищем|требуется|открываем|нанимаем)/u);
        if (inMatch) company = inMatch[1].trim();
      }
    } catch {}
  }
  if (!company) {
    try {
      const u = new URL(url);
      const parts = u.hostname.split('.');
      const slug = parts.length >= 2 ? parts[parts.length - 2] : u.hostname;
      if (EMPTY_DOMAINS.has(u.hostname.toLowerCase())) {
        if (channelGuess) company = channelGuess.charAt(0).toUpperCase() + channelGuess.slice(1);
      } else if (!['greenhouse', 'ashbyhq', 'lever', 'workable', 'smartrecruiters', 'myworkdayjobs'].includes(slug)) {
        company = slug.charAt(0).toUpperCase() + slug.slice(1);
      }
    } catch {}
  }
  if (!role) {
    // The matching LINE (not the bare keyword): the tracker dedupes on
    // company+role, and a bare keyword would collide with earlier rows.
    // v1.248.5 — word boundaries: a bare substring matched 'lead'/'it'
    // inside unrelated page chrome (linkedin.com/x.com roots).
    const matchIn = (l, k) => {
      const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?<![\\p{L}\\p{M}])${esc}(?![\\p{L}\\p{M}])`, 'iu').test(l);
    };
    const kw = ROLE_KEYWORDS.find((k) => lines.some((l) => matchIn(l, k)));
    role = kw ? (lines.find((l) => matchIn(l, kw)) || '').slice(0, 100) : '';
  }
  return { company: company || '', role: role || '', roleHint: guessRoleHint(jdText, url) };
}

// v1.248.4 — role keywords in EN + RU (the old list was EN-only: a Cyrillic
// post never matched, so every Telegram entry looked role-less and was
// rejected after a full LLM call — 0 of 40 real posts got a role).
const ROLE_KEYWORDS = [
  'engineer', 'developer', 'manager', 'lead', 'architect', 'designer',
  'analyst', 'director', 'specialist', 'devops', 'sre', 'qa',
  'data scientist',
  'разработчик', 'программист', 'инженер', 'аналитик', 'менеджер',
  'руководитель', 'тимлид', 'лид', 'дизайнер', 'тестировщик',
  'архитектор', 'специалист', 'директор',
];

function channelHintFor(u) {
  try { const seg = new URL(u).pathname.split('/').filter(Boolean); return Boolean(seg[0]); } catch { return false; }
}

/** Cheap pre-LLM check: does this entry text carry any role/company hint? */
export function guessRoleHint(jdText, url) {
  const lines = (jdText || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 30);
  // v1.248.5 — word-boundary matching: a bare `includes` matched 'lead'
  // inside a LinkedIn page's own chrome text and let domain roots through.
  const matchIn = (l, k) => {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\p{L}\\p{M}])${esc}(?![\\p{L}\\p{M}])`, 'iu').test(l);
  };
  const kw = ROLE_KEYWORDS.find((k) => lines.some((l) => matchIn(l, k)));
  if (kw) return kw;
  // A messenger-host entry with a channel name has an identity even without
  // a keyword — the channel fallback gives the company, so the entry is
  // trackable and worth evaluating.
  try {
    const u = new URL(url);
    if ((u.hostname === 't.me' || u.hostname === 'telegram.me') && channelHintFor(u) && lines.length > 0) return 'channel-post';
  } catch {}
  return '';
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

// v1.248.5 — server-side skip contract: a rejected entry leaves the timer's
// candidate pool. The URL line moves OUT of the code fence into a
// «## Rejected» section below it (the timer greps bare URLs in the fence),
// annotated with a short reason. Idempotent: re-rejecting the same URL
// never duplicates the mark.
function markPipelineRejected(url, reason) {
  const short = String(reason || 'rejected').slice(0, 80);
  try {
    const file = projPath('data', 'pipeline.md');
    let src = readFileSync(file, 'utf8');
    if (!src.includes(url)) return false;
    const lines = src.split('\n');
    const fence = lines.indexOf('```');
    const close = lines.indexOf('```', fence + 1);
    const inFence = fence !== -1 && close !== -1
      ? lines.findIndex((l, i) => i > fence && i < close && l.trim() === url.trim()) !== -1
      : false;
    const already = lines.some((l) => l.includes(url) && /rejected:/i.test(l));
    if (inFence) {
      const out = [];
      let f = false;
      let dropped = false;
      for (const l of lines) {
        if (/^```/.test(l)) { out.push(l); f = !f; continue; }
        // Drop exactly ONE matching line: if the same URL was queued twice,
        // one rejection must not silently consume the second copy.
        if (f && !dropped && l.trim() === url.trim()) { dropped = true; continue; }
        out.push(l);
      }
      src = out.join('\n');
    }
    if (!already) {
      // Defense-in-depth: a line is the record's boundary in pipeline.md, so
      // control characters are stripped from both interpolated pieces (WHATWG
      // URL parsing already drops \n\r\t, but the guarantee is made explicit
      // here rather than delegated to the URL parser).
      const safeUrl = String(url || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
      const safeReason = short.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
      src = src.replace(/\s*$/, '') + `\n\n## Rejected\n\n- ${safeUrl} — rejected: ${safeReason} (${today()})\n`;
    }
    writeFileSync(file, src);
    return true;
  } catch { /* pipeline.md not writable — the timer will retry; never crash the SSE */ }
  return false;
}

export function registerAutoPipelineRoutes(app) {
  app.post('/api/auto-pipeline', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    // R-03 — type the body BEFORE the SSE stream opens, so a malformed field
    // is a plain JSON 400 (it used to throw in .toString() / the prompt builder).
    for (const k of ['url', 'lang', 'locale', 'mode', 'evalMode']) {
      if (body[k] != null && typeof body[k] !== 'string') {
        return res.status(400).json({ error: `${k} must be a string` });
      }
    }
    const url = body.url || '';
    const lang = resolveLocale(req);
    // v1.25.0 (G-014) — accept `mode: 'manual'` (mirrors /api/evaluate
    // contract from v1.10.2) as well as the legacy `evalMode` override.
    const requestedMode = body.mode || body.evalMode || null;
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
    function fail(stepIndex, message, extra = {}) {
      // `rejected: true` marks a validation-driven stop: the server-side
      // timer uses it to skip the pipeline entry instead of retrying it.
      send('error', { step: STEPS[stepIndex].key, message, ...extra });
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
        // rejected:true marks a validation-driven stop (t.me no-text) — the
        // server-side timer skips the entry; plain fetch failures (404 etc.)
        // keep the bare error shape.
        const extra = result.rejected ? { rejected: true } : {};
        if (result.rejected) markPipelineRejected(url, result.error);
        return fail(1, result.error || 'fetch failed', extra);
      }
      jdText = sanitizeJobDescription(result.text);
      if (!jdText || jdText.length < MIN_JD_CHARS) {
        // Warning goes to the SERVER CONSOLE ONLY (never a file) — URL + reason
        // + length, never the fetched page text (it can hold third-party content).
        // Host-only (never the full user-supplied URL) — CI logs are public.
        const logHost = (() => { try { return new URL(url).hostname; } catch { return '[unparsable URL]'; } })();
        console.warn(`[auto-pipeline] no evaluation: JD too short after sanitization (${jdText ? jdText.length : 0} < ${MIN_JD_CHARS} chars) — host: ${logHost}`);
        step(1, 'failed', `JD too short after sanitization (${jdText ? jdText.length : 0} < ${MIN_JD_CHARS} chars)`);
        return fail(1, 'JD too short');
      }
      step(1, 'done', `${(jdText.length / 1024).toFixed(1)} KB`);
    } catch (e) {
      clearTimeout(timer);
      step(1, 'failed', e.message);
      return fail(1, e.message);
    }

    // v1.248.4 — the identity gate runs BEFORE the LLM call: an entry with
    // neither a company nor any role hint would burn a full evaluation and
    // then be rejected. Host-only logging (CI logs are public).
    // v1.248.5 — a domain root is not a job posting (linkedin.com/, x.com/
    // fired the role gate on junk page text).
    let rootRejection = false;
    try { rootRejection = new URL(url).pathname.replace(/\/+$/, '').length <= 1; } catch {}
    const guess = guessCompanyRole(jdText, url);
    if (rootRejection) {
      const logHost = (() => { try { return new URL(url).hostname; } catch { return '[unparsable URL]'; } })();
      logActivity({ action: 'auto-pipeline.evaluation.rejected', target: logHost, detail: 'domain root — not a job posting' });
      markPipelineRejected(url, 'domain root — not a job posting');
      step(1, 'failed', 'domain root — not a job posting');
      return fail(1, 'domain root — not a job posting', { rejected: true });
    }
    if (!guess.company && !guess.roleHint) {
      const logHost = (() => { try { return new URL(url).hostname; } catch { return '[unparsable URL]'; } })();
      logActivity({ action: 'auto-pipeline.evaluation.rejected', target: logHost, detail: 'no company/role hints' });
      markPipelineRejected(url, 'no company/role hints');
      step(1, 'failed', 'no company/role hints — entry skipped before the LLM call');
      return fail(1, 'no company/role hints — entry skipped before the LLM call', { rejected: true });
    }

    // Step 3 — evaluate
    step(2, 'running', 'LLM call (30–90 s)…');
    let markdown = '';
    let evalMode = lockEvalMode;
    const warnings = [];
    try {
      const promptText = buildEvaluationPrompt(jdText, lang);

      if (evalMode === 'gemini') {
        // Explicit `mode: 'gemini'` keeps the oferta-tuned gemini-eval.mjs.
        // --no-save: this route writes the report + tracker row itself; the
        // script would add a second report, row and merge. Temp file removed.
        const tmp = projPath('output', `auto-pipeline-${Date.now()}.txt`);
        mkdirSync(PATHS.outputDir, { recursive: true });
        writeFileSync(tmp, jdText);
        let r;
        try {
          r = await runNodeScript('gemini-eval.mjs', ['--file', tmp, '--no-save'], { timeoutMs: EVAL_TIMEOUT_MS });
        } finally {
          try { unlinkSync(tmp); } catch { /* already gone */ }
        }
        if (r.code !== 0) {
          step(2, 'failed', `gemini-eval exit ${r.code}`);
          return fail(2, `gemini-eval exit ${r.code}`);
        }
        markdown = r.stdout || '';
      } else {
        const ctx = bundleProjectContext({ modeSlugs: ['_shared', 'oferta'], lang, warnings });
        const full = ctx + promptText;
        if (full.length > PROMPT_SIZE_SOFT_CAP) {
          step(2, 'failed', `prompt ${full.length} > ${PROMPT_SIZE_SOFT_CAP} cap`);
          return fail(2, 'prompt too large');
        }
        // 16384, as /api/evaluate: a CJK A–G report plus SCORE_SUMMARY outgrew 8192.
        const runOpts = { maxTokens: EVAL_MAX_TOKENS, timeoutMs: EVAL_TIMEOUT_MS };
        let r;
        if (evalMode === 'anthropic') {
          // Explicit `mode: 'anthropic'` pins the provider.
          if (!hasAnthropicKey()) {
            step(2, 'failed', 'ANTHROPIC_API_KEY not set');
            return fail(2, 'no LLM key');
          }
          r = await runAnthropic(full, runOpts);
          if (!r.error) recordUsage('anthropic', r.usage);
          r = { ...r, mode: 'anthropic' };
        } else {
          // The shared cascade: honours LLM_PROVIDER, covers every provider,
          // records usage (llm-dispatch.mjs).
          r = await runActiveProvider(full, runOpts);
          if (r.mode === 'manual') {
            step(2, 'failed', 'no LLM key set; manual mode incompatible with auto-pipeline');
            return fail(2, 'no LLM key');
          }
        }
        evalMode = r.mode;
        if (r.error) {
          step(2, 'failed', r.error);
          return fail(2, r.error);
        }
        // A cut-off report would be filed as complete (score missing, tracker
        // row pointing at half a report) — stop instead.
        if (r.truncated) {
          step(2, 'failed', 'report cut off at the output-token limit');
          return fail(2, 'report cut off at the output-token limit');
        }
        markdown = r.markdown || '';
        warnings.push(...evaluationWarnings(r));
      }
      if (!markdown.trim()) {
        step(2, 'failed', 'empty evaluation');
        return fail(2, 'the model returned an empty evaluation');
      }
      // v1.248.3 — validate BEFORE anything is written. A junk entry (a
      // t.me/telegram placeholder that clears the length gate) used to
      // produce a «the model answered insufficient data» report that was
      // saved, tracker-rowed and shown by the dashboard as «Last
      // evaluation» (44 such files on prod).
      const issues = validateEvaluationReport(markdown);
      const preScore = extractScore(markdown);
      if (preScore == null || issues.length > 0) {
        const reason = preScore == null
          ? 'no SCORE 0–5 in the report'
          : issues.slice(0, 3).join('; ');
        // Host only — the entry URL is user-supplied and CI logs are public.
        const logHost = (() => { try { return new URL(url).hostname; } catch { return '[unparsable URL]'; } })();
        logActivity({ action: 'auto-pipeline.evaluation.rejected', target: logHost, detail: reason });
        markPipelineRejected(url, reason);
        step(2, 'failed', `evaluation incomplete: ${reason}`);
        return fail(2, `evaluation incomplete: ${reason}`, { rejected: true });
      }
      const score = extractScore(markdown);
      step(2, 'done', score != null ? `${evalMode} · score ${score}/5` : evalMode);
    } catch (e) {
      step(2, 'failed', e.message);
      return fail(2, e.message);
    }

    // v1.248.4 — the role chain: (a) the model writes the role into the
    // report header (parseReportHeader reads the H1); (b) the keyword/line
    // guess from the entry text. An entry that survives the pre-LLM gate
    // with a company but no post-report role still rejects (never file a
    // `<company>-role` placeholder).
    const header = parseReportHeader(markdown);
    const reportRole = (header.title || '').replace(/^#+\s*/, '').trim();
    const role = reportRole || guess.role || '';
    if (!guess.company || !role) {
      logActivity({ action: 'auto-pipeline.evaluation.rejected', target: guess.company || 'unknown', detail: 'company/role not identifiable after evaluation' });
      markPipelineRejected(url, 'company/role not identifiable');
      step(3, 'failed', 'company/role not identifiable for this entry');
      return fail(3, 'company/role not identifiable for this entry', { rejected: true });
    }
    const score = extractScore(markdown);
    const legitimacy = extractLegitimacy(markdown);

    // Step 4 — save report
    step(3, 'running');
    let slug = buildSlug(guess.company || 'unknown', guess.role || 'role');
    let reportPath = `reports/${slug}.md`;
    try {
      // Score and legitimacy were read above, with the summary block present;
      // the saved report drops that machine block, as the parent's scripts do.
      const sanitized = stripDangerousMarkdown(stripScoreSummary(markdown));
      mkdirSync(PATHS.reportsDir, { recursive: true });
      const file = projPath('reports', `${slug}.md`);
      if (existsSync(file)) {
        // Don't clobber existing — append epoch suffix. The tracker row and
        // the `done` event must point at the file actually written.
        const altSlug = `${slug}-${Date.now()}`;
        writeFileSync(projPath('reports', `${altSlug}.md`), sanitized);
        logActivity({ action: 'auto-pipeline.report.saved', target: `reports/${altSlug}.md`, detail: `deduped from ${slug}` });
        slug = altSlug;
        reportPath = `reports/${slug}.md`;
        step(3, 'done', slug);
      } else {
        writeFileSync(file, sanitized);
        logActivity({ action: 'auto-pipeline.report.saved', target: reportPath });
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
          logActivity({ action: 'auto-pipeline.tracker.added', target: safeCompany, detail: `#${nextNum}` });
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
        ...(warnings.length ? { warnings } : {}),
      });
      res.end();
    }
  });
}
