/**
 * JDs routes — manage saved Job Description text in jds/*.txt.
 *
 *   GET    /api/jds         → { jds: { name, size, mtime }[] }
 *   GET    /api/jds/:name   → text/plain body
 *   DELETE /api/jds/:name   → unlink (.txt suffix required)
 *   POST   /api/jds { text, slug? }
 *
 * `:name` is sanitized via [^\w\-.]/g; DELETE additionally enforces .txt
 * suffix. POST sanitizes the optional slug via slugify(); falls back to
 * `jd-<date>-<ts>.txt` when no slug supplied. Returns a `warning` field
 * when slug normalization stripped unsafe characters.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { PATHS, path as projPath, PROJECT_ROOT } from '../paths.mjs';
import { slugify, today } from '../parsers.mjs';
import { sanitizePathName } from '../security.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runNodeScript } from '../runner.mjs';
import { parseJsonStdout, sanitizeDetail } from '../parent-relay.mjs';

export function registerJdsRoutes(app) {
  app.get('/api/jds', (_req, res) => {
    if (!existsSync(PATHS.jdsDir)) return res.json({ jds: [] });
    const files = readdirSync(PATHS.jdsDir)
      .filter((f) => f.endsWith('.txt') || f.endsWith('.md'))
      .map((f) => {
        const stat = statSync(projPath('jds', f));
        return { name: f, size: stat.size, mtime: stat.mtime };
      });
    res.json({ jds: files });
  });

  app.get('/api/jds/:name', (req, res) => {
    const name = sanitizePathName(req.params.name);
    if (!name) return res.status(400).json({ error: 'invalid jd name' });
    const file = projPath('jds', name);
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    res.type('text/plain').send(readFileSync(file, 'utf8'));
  });

  app.delete('/api/jds/:name', (req, res) => {
    // Strip path-traversal characters; require the canonical .txt suffix
    // so we cannot accidentally remove an unrelated file.
    const safe = sanitizePathName(req.params.name);
    if (!safe || !safe.endsWith('.txt')) {
      return res.status(400).json({ error: 'invalid jd name' });
    }
    const file = projPath('jds', safe);
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    unlinkSync(file);
    res.json({ ok: true, deleted: safe });
  });

  app.post('/api/jds', (req, res) => {
    const { text, slug } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text required' });
    let warning = null;
    let safeSlug = null;
    if (slug) {
      safeSlug = slugify(slug);
      if (!safeSlug) {
        return res.status(400).json({ error: 'slug had no usable characters' });
      }
      // FIX-M2 — only flag the cases users care about: unsafe characters
      // were stripped. Pure case-folding ("Acme" → "acme") and whitespace
      // collapsing don't deserve a warning.
      const stripped = /[^\w\s-]/.test(slug);
      if (stripped) warning = `slug normalized from "${slug}" to "${safeSlug}"`;
    }
    const name = (safeSlug || `jd-${today()}-${Date.now()}`) + '.txt';
    mkdirSync(PATHS.jdsDir, { recursive: true });
    writeFileSync(projPath('jds', name), text);
    res.json({ ok: true, name, ...(warning ? { warning } : {}) });
  });

  // Zero-token skill-gap of a SAVED JD vs cv.md — relays jd-skill-gap.mjs
  // (JSON: { existing, supportedByResume, gap, lowConfidence }). `:name` is
  // path-sanitized and confirmed to exist before it becomes a script arg (which
  // runNodeScript passes as an array element — no shell interpolation). Read-only,
  // fail-soft { available:false } without the script.
  app.get('/api/jds/:name/skill-gap', llmRateLimit, async (req, res) => {
    const name = sanitizePathName(req.params.name);
    if (!name) return res.status(400).json({ error: 'invalid jd name' });
    if (!existsSync(projPath('jds', name))) return res.status(404).json({ error: 'not found' });
    const script = 'jd-skill-gap.mjs';
    if (!existsSync(resolve(PROJECT_ROOT, script))) {
      return res.json({ available: false, reason: 'script-not-found' });
    }
    const r = await runNodeScript(script, [`jds/${name}`, '--json'], { timeoutMs: 30_000 });
    const data = parseJsonStdout(r.stdout);
    if (r.code !== 0 || !data) {
      return res.json({
        available: false,
        reason: r.killed ? 'timeout' : 'script-error',
        detail: sanitizeDetail(r.stderr),
      });
    }
    res.json({ available: true, ...data });
  });
}
