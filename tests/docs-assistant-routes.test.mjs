/**
 * Docs assistant route (v1.102.0). Grounded "ask the help guide" chat. CI-isolated:
 * the help docs come from WEB_UI_ROOT (this repo), not the parent project, so the
 * retrieval is deterministic. No provider keys → the honest manual prompt.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server; let baseUrl;
let splitSections; let topSections; let buildAskPrompt; let resolveHelpFile;

before(async () => {
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = mkdtempSync(join(tmpdir(), 'docs-asst-'));
  ({ splitSections, topSections, buildAskPrompt, resolveHelpFile } = await import('../server/lib/routes/docs-assistant.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const post = (p, b) => fetch(`${baseUrl}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('resolveHelpFile falls back to en.md and is path-traversal safe', () => {
  assert.ok(resolveHelpFile('en'));
  assert.ok(resolveHelpFile('zz-unknown'));                 // → en.md fallback
  // A traversal attempt must resolve to a real file INSIDE docs/help (never
  // /etc/passwd). Assert the actual return (no `|| fallback` masking a null).
  const traversed = resolveHelpFile('../../etc/passwd');
  assert.ok(traversed, 'traversal input must still resolve (to the en.md fallback), not null');
  assert.match(traversed, /docs[/\\]help[/\\][a-zA-Z0-9_-]+\.md$/); // stayed inside docs/help
  assert.doesNotMatch(traversed, /etc[/\\]passwd/);                 // never escaped
});

test('splitSections splits on ## and keeps ### inside their parent', () => {
  const secs = splitSections('# Title\n\n## One\nintro\n### Sub A\nbody a\n## Two\nintro two\n');
  assert.equal(secs.length, 2);
  assert.equal(secs[0].title, 'One');
  assert.match(secs[0].body, /Sub A/);      // ### stays inside its ## parent
  assert.equal(secs[1].title, 'Two');
});

test('topSections ranks the section whose title/body matches the question', () => {
  const secs = [
    { title: 'Scanning job portals', body: '## Scanning job portals\nRun a scan of Greenhouse and Lever.\n' },
    { title: 'Your two-pager', body: '## Your two-pager\nWhat you want from a role.\n' },
    { title: 'Health', body: '## Health\nServer status.\n' },
  ];
  const top = topSections(secs, 'how do I scan job portals?', 2);
  assert.equal(top[0].title, 'Scanning job portals');
});

test('buildAskPrompt grounds on the excerpts and forbids invention', () => {
  const p = buildAskPrompt([{ title: 'Scanning', body: '## Scanning\nRun a scan.\n' }], 'how do I scan?', 'en');
  assert.match(p, /ONLY the help-guide/i);
  assert.match(p, /do NOT invent/i);
  assert.match(p, /HELP SECTION: Scanning/);
  assert.match(p, /QUESTION: how do I scan\?/);
});

test('POST /ask with no key → manual prompt grounded in real help sections', async () => {
  const r = await post('/api/docs-assistant/ask', { question: 'How do I scan job portals?' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.mode, 'manual');
  assert.ok(Array.isArray(j.sections) && j.sections.length > 0);  // retrieval found real sections
  assert.match(j.prompt, /help-guide/i);
  assert.equal(j.answer, undefined);                              // nothing answered/invented with no key
});

test('POST /ask rejects an empty question', async () => {
  const r = await post('/api/docs-assistant/ask', { question: '  ' });
  assert.equal(r.status, 400);
});
