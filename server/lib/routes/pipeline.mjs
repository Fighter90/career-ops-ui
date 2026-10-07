/**
 * Pipeline routes — inbox of pending JD URLs + server-side preview proxy.
 *
 *   GET    /api/pipeline             → { urls: string[] }
 *   POST   /api/pipeline { url }     → append (URL gated by isValidJobUrl)
 *   GET    /api/pipeline/preview?url → stripped HTML snippet (≤ 8 KB)
 *   DELETE /api/pipeline?url=…       → remove
 *
 * The preview endpoint walks redirects manually, revalidating each
 * Location through isValidJobUrl (REVIEW-B1). Cap: 3 hops, 15 s timeout,
 * 8 KB body. SSRF surface is bounded by isValidJobUrl which rejects
 * loopback, file://, IP literals, etc.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PATHS, path as projPath } from '../paths.mjs';
import { parsePipeline, addPipelineUrl, removePipelineUrl } from '../parsers.mjs';
import { isValidJobUrl } from '../security.mjs';
import { safeReadPipeline } from '../store.mjs';
import { safeGet } from '../safe-fetch.mjs';
import { withFileLock } from '../file-lock.mjs';

const PREVIEW_TIMEOUT_MS = 15_000;
const PREVIEW_MAX_BODY_BYTES = 8000;

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
      const updated = addPipelineUrl(content, url);
      // addPipelineUrl dedups on the canonical URL and against processed
      // rows, so "nothing written" is the only honest dedup signal.
      const deduped = updated === content;
      if (!deduped) {
        mkdirSync(projPath('data'), { recursive: true });
        writeFileSync(PATHS.pipeline, updated);
      }
      return { ok: true, deduped, urls: parsePipeline(updated) };
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
      // removePipelineUrl drops only the matching lines and returns the text
      // untouched when nothing matched — answer 404 then instead of a fake
      // { removed: 1 } (a bare-URL file used to be left as is).
      const updated = removePipelineUrl(content, url);
      if (updated === content) {
        return { _status: 404, body: { error: 'url not found in pipeline', url } };
      }
      const removed = parsePipeline(content).length - parsePipeline(updated).length;
      writeFileSync(PATHS.pipeline, updated);
      return { _status: 200, body: { ok: true, removed, url } };
    });
    res.status(outcome._status).json(outcome.body);
  });
}
