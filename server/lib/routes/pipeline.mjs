/**
 * Pipeline routes — inbox of pending JD URLs + server-side preview proxy.
 *
 *   GET    /api/pipeline             → { urls: string[] }
 *   POST   /api/pipeline { url, comp? } → append (URL gated by
 *                                     isValidJobUrl; optional comp column,
 *                                     CAR-150's undo-fallback re-add)
 *   POST   /api/pipeline/restore     → { tokens } → reinsert the lines a
 *                                     previous DELETE stored (CAR-151 undo)
 *   GET    /api/pipeline/preview?url → stripped HTML snippet (≤ 8 KB)
 *   DELETE /api/pipeline?url=…       → remove ({ ok, removed, url,
 *                                     restoreToken, comp })
 *
 * The preview endpoint walks redirects manually, revalidating each
 * Location through isValidJobUrl (REVIEW-B1). Cap: 3 hops, 15 s timeout,
 * 8 KB body. SSRF surface is bounded by isValidJobUrl which rejects
 * loopback, file://, IP literals, etc.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PATHS, path as projPath } from '../paths.mjs';
import { parsePipeline, addPipelineUrl, removePipelineUrlExtract, restorePipelineLines, pipelineLineComp } from '../parsers.mjs';
import { isValidJobUrl } from '../security.mjs';
import { safeReadPipeline } from '../store.mjs';
import { safeGet } from '../safe-fetch.mjs';
import { withFileLock, atomicWrite } from '../file-lock.mjs';

const PREVIEW_TIMEOUT_MS = 15_000;
const PREVIEW_MAX_BODY_BYTES = 8000;
// CAR-151 review r2 — the undo round-trip carries opaque TOKENS, not
// content: the client never sends pipeline lines, so /api/pipeline/restore
// has no content-injection surface. 10 000 tokens ≈ a 360 KB request.
const RESTORE_MAX_TOKENS = 10_000;
// The removed lines live in-process, keyed by the unguessable token, FIFO-
// evicted. Undo is a seconds-scale interaction: a server restart (or
// eviction after a very large sweep) between delete and undo simply makes
// the token unknown — the client falls back to the bare re-add — and the
// URL itself is never lost.
const RESTORE_STORE_CAP = 5000;
const restoreTokens = new Map(); // token → removed raw lines

function rememberRestoreToken(lines) {
  const token = randomUUID();
  restoreTokens.set(token, lines);
  while (restoreTokens.size > RESTORE_STORE_CAP) {
    restoreTokens.delete(restoreTokens.keys().next().value);
  }
  return token;
}

export function registerPipelineRoutes(app) {
  app.get('/api/pipeline', (_req, res) => {
    res.json({ urls: safeReadPipeline() });
  });

  app.post('/api/pipeline', async (req, res) => {
    const url = (req.body?.url || req.body?.text || '').toString().trim();
    if (!url) return res.status(400).json({ error: 'url required' });
    if (!isValidJobUrl(url)) {
      // QA BUG-006 — human, sentence-cased. (The api.js client still
      // appends the "(POST /api/pipeline · HTTP 400)" where/why context
      // by design — that was an explicit product requirement.)
      return res.status(400).json({ error: "That doesn't look like a valid job posting URL — it must start with http:// or https:// and contain no script or template characters." });
    }
    // CAR-150 — optional compensation column for the undo's bare re-add
    // fallback (an unknown restoreToken degrades the lossless restore to
    // this path, and the comp column used to die here). Absent → the
    // behavior is byte-identical for every existing caller;
    // addPipelineUrl re-sanitizes (cap, formula neutralization, column
    // injection collapse).
    const rawComp = req.body?.comp;
    if (rawComp !== undefined && typeof rawComp !== 'string') {
      return res.status(400).json({ error: 'comp must be a string when present' });
    }
    const comp = typeof rawComp === 'string'
      ? rawComp.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200)
      : '';
    // v1.20.1 (H-6) — same read-modify-write race as tracker.mjs. Two
    // concurrent POST /api/pipeline with distinct URLs would both read
    // the same content, both compute their own append, and the later
    // write would clobber the earlier. Serialize via the per-path
    // mutex.
    const result = await withFileLock(PATHS.pipeline, async () => {
      let content = '';
      try {
        content = readFileSync(PATHS.pipeline, 'utf8');
      } catch {
        content = '';
      }
      const updated = addPipelineUrl(content, url, comp ? { comp } : {});
      // addPipelineUrl dedups on the canonical URL and against processed
      // rows, so "nothing written" is the only honest dedup signal.
      const deduped = updated === content;
      if (!deduped) {
        mkdirSync(projPath('data'), { recursive: true });
        atomicWrite(PATHS.pipeline, updated);
      }
      return { ok: true, deduped, urls: parsePipeline(updated) };
    });
    res.json(result);
  });

  // CAR-151 — lossless undo, round 2: the client replays the opaque
  // restoreToken(s) a DELETE answered with; the RAW lines they key live
  // server-side, so no client-supplied content is ever written here.
  // restorePipelineLines reinserts them under the same lock, deduping on
  // the canonical URL key so a URL re-added meanwhile is skipped, not
  // duplicated (and the same token twice is a no-op). Unknown tokens
  // (restart, store eviction, or a fabricated value) are REPORTED, never
  // written — the client falls back to the bare re-add for those URLs.
  app.post('/api/pipeline/restore', async (req, res) => {
    const tokens = req.body?.tokens;
    if (!Array.isArray(tokens)) {
      return res.status(400).json({ error: 'tokens required (array of restore tokens from DELETE)' });
    }
    if (tokens.length > RESTORE_MAX_TOKENS) {
      return res.status(400).json({ error: `too many tokens (max ${RESTORE_MAX_TOKENS})` });
    }
    const result = await withFileLock(PATHS.pipeline, async () => {
      let content = '';
      try {
        content = readFileSync(PATHS.pipeline, 'utf8');
      } catch {
        content = '';
      }
      const unknown = [];
      const lines = [];
      for (const tok of tokens) {
        const stored = typeof tok === 'string' ? restoreTokens.get(tok) : null;
        if (stored) lines.push(...stored);
        else unknown.push(String(tok));
      }
      const r = lines.length
        ? restorePipelineLines(content, lines)
        : { updated: content, restored: 0, deduped: 0, refused: 0 };
      if (r.restored > 0) {
        mkdirSync(projPath('data'), { recursive: true });
        atomicWrite(PATHS.pipeline, r.updated);
      }
      return { ok: true, restored: r.restored, deduped: r.deduped, unknown, urls: parsePipeline(r.updated) };
    });
    res.json(result);
  });

  // Server-side fetch proxy for the pipeline preview pane. Most ATS
  // boards (Greenhouse, Ashby, Lever) don't send CORS headers, so the
  // browser can't read them directly; we fetch on the server and return
  // a stripped text snippet.
  app.get('/api/pipeline/preview', async (req, res) => {
    const url = (req.query.url || '').toString();
    if (!isValidJobUrl(url)) return res.status(400).json({ error: 'invalid url' });
    // v1.20.1 (B-1) — safeGet does the DNS resolve ONCE, validates the
    // address against isPrivateOrLoopbackHost, then pins the TCP
    // connection to that exact IP (with SNI/Host targeting the original
    // hostname for cert validation). The DNS-rebind TOCTOU window
    // between an explicit dnsLookup and the second lookup `fetch()`
    // would do is closed because there is no second lookup.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PREVIEW_TIMEOUT_MS);
    try {
      const r = await safeGet(url, {
        signal: ctrl.signal,
        maxBytes: PREVIEW_MAX_BODY_BYTES * 4, // raw HTML budget before strip
        userAgent: 'Mozilla/5.0 (career-ops-ui preview) AppleWebKit/537.36',
      });
      // Preserve the historical "(HTTP 4xx)" preview text for non-2xx
      // upstreams — the SPA renders this directly in the preview pane.
      if (r.status < 200 || r.status >= 300) {
        return res.json({ status: r.status, text: '(HTTP ' + r.status + ')' });
      }
      const text = r.text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n\n')
        .trim()
        .slice(0, PREVIEW_MAX_BODY_BYTES);
      res.json({ status: r.status, text });
    } catch (e) {
      const msg = e.message || String(e);
      // Map known safeGet errors to user-friendly preview text.
      if (msg.includes('resolves to private address')) {
        res.json({ status: 0, text: '(blocked: host resolves to private address)' });
      } else if (msg.includes('redirects from')) {
        res.json({ status: 0, text: '(too many redirects)' });
      } else if (msg.includes('unsafe redirect target')) {
        res.json({ status: 0, text: '(unsafe redirect target rejected)' });
      } else if (msg === 'aborted') {
        res.json({ status: 0, text: '(timeout)' });
      } else {
        res.json({ status: 0, text: '(' + msg + ')' });
      }
    } finally {
      clearTimeout(timer);
    }
  });

  app.delete('/api/pipeline', async (req, res) => {
    const url = (req.query.url || (req.body && req.body.url) || '').toString().trim();
    if (!url) return res.status(400).json({ error: 'url required (query ?url= or body.url)' });
    // v1.20.1 (H-6) — guard the read-modify-write so DELETE doesn't
    // race a concurrent POST add.
    const outcome = await withFileLock(PATHS.pipeline, async () => {
      let content = '';
      try {
        content = readFileSync(PATHS.pipeline, 'utf8');
      } catch {
        return { _status: 404, body: { error: 'pipeline not found' } };
      }
      // removePipelineUrlExtract drops only the matching lines, returns the
      // text untouched when nothing matched (→ 404 then, not a fake
      // { removed: 1 }) — and hands back the RAW dropped lines, which stay
      // SERVER-SIDE under an opaque restoreToken so the client's undo can
      // reinsert them content-faithfully (CAR-151 review r2: the client
      // never sends content). `removed` counts the raw lines dropped — a
      // URL listed twice takes both (this used to be a parse-length diff,
      // the same number in every real case).
      const { updated, removedLines } = removePipelineUrlExtract(content, url);
      if (updated === content) {
        return { _status: 404, body: { error: 'url not found in pipeline', url } };
      }
      const removed = removedLines.length;
      const restoreToken = rememberRestoreToken(removedLines);
      // CAR-150 — the fallback re-add needs the compensation column: the
      // token path restores the raw lines byte-for-byte, but an unknown
      // token (restart / store eviction) degrades to the bare re-add,
      // and GET /api/pipeline never carried the column. The sanitized
      // cell of the FIRST removed line rides the answer ('' when none).
      const comp = removedLines.length ? pipelineLineComp(removedLines[0]) : '';
      atomicWrite(PATHS.pipeline, updated);
      return { _status: 200, body: { ok: true, removed, url, restoreToken, comp } };
    });
    res.status(outcome._status).json(outcome.body);
  });
}
