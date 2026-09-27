/**
 * The live regression (v1.238.2) flagged every in-process evaluation, in all
 * 17 locales, with A–G shape warnings: the prompt never asked for the
 * ---SCORE_SUMMARY--- block the validator requires (the parent's eval scripts
 * do ask for it), and translated reports translated the word "Block".
 *
 * /api/evaluate runs through a stub OpenAI-compatible provider (Hermes) here:
 * the prompt must ask for the summary and the block letters, a well-formed
 * translated reply must carry no warnings, and the machine block must not
 * reach the client.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let createApp, stub, lastPrompt = '';
const REPLY = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => `## Bloque ${L} — Sección\ntexto`).join('\n\n')
  + '\n\n---SCORE_SUMMARY---\nCOMPANY: Acme\nROLE: Ingeniera\nSCORE: 4.1\nARCHETYPE: Platform\nLEGITIMACY: High Confidence\n---END_SUMMARY---\n';

before(async () => {
  stub = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { lastPrompt = JSON.parse(body).messages.map((m) => m.content).join('\n'); } catch { lastPrompt = ''; }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: REPLY } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
    });
  });
  await new Promise((r) => stub.listen(0, '127.0.0.1', r));

  const dir = mkdtempSync(resolve(tmpdir(), 'eval-summary-'));
  for (const d of ['config', 'data', 'modes', 'reports']) mkdirSync(resolve(dir, d), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  for (const m of ['_shared', 'oferta']) writeFileSync(resolve(dir, 'modes', `${m}.md`), `# ${m}\n`);
  process.env.CAREER_OPS_ROOT = dir;
  process.env.LLM_PROVIDER = 'hermes';
  process.env.HERMES_API_KEY = 'stub-key-123456';
  process.env.HERMES_BASE_URL = `http://127.0.0.1:${stub.address().port}/v1`;
  ({ createApp } = await import('../server/index.mjs'));
});

after(() => {
  for (const k of ['CAREER_OPS_ROOT', 'LLM_PROVIDER', 'HERMES_API_KEY', 'HERMES_BASE_URL']) delete process.env[k];
  stub?.close();
});

test('a translated, well-formed evaluation has no warnings and no machine block', async () => {
  const server = await new Promise((r) => { const s = createApp().listen(0, '127.0.0.1', () => r(s)); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/evaluate?lang=es`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'es' },
      body: JSON.stringify({ jd: 'Senior Platform Engineer at Acme. Kubernetes, Go, on-call. '.repeat(3), save: false }),
    });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body).slice(0, 200));
    assert.equal(body.mode, 'hermes');
    assert.equal(body.warnings, undefined, `unexpected warnings: ${JSON.stringify(body.warnings)}`);
    assert.doesNotMatch(body.markdown, /SCORE_SUMMARY|END_SUMMARY/);
    assert.match(body.markdown, /## Bloque G — Sección/);
    assert.match(lastPrompt, /---SCORE_SUMMARY---[\s\S]*LEGITIMACY:[\s\S]*---END_SUMMARY---/);
    assert.match(lastPrompt, /keep the letter A–G/);
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
});
