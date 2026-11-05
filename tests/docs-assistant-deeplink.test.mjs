/**
 * P2.2 — docs-assistant deep-link label localization.
 *
 * The model signs screen links in English ("[Open the Scan page](#/scan)") no
 * matter the answer's language. The server post-processes the live answer:
 * every markdown deep-link `[any label](#/route)` gets its LABEL rewritten to
 * the request locale's `nav.<route>` UI label (resolved through the same
 * per-locale dict files the sidebar uses, one alias hop allowed —
 * nav.apply → apply.title). The href stays verbatim; a route with no nav
 * key/alias keeps the model's label; en answers are left untouched.
 *
 * CI-isolated: provider keys scrubbed, a stub OpenAI-compatible provider rides
 * the real cascade through OLLAMA_BASE_URL (loopback, the one policy-allowed
 * local base URL), CAREER_OPS_ROOT is a temp dir, no real network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

let server; let baseUrl; let stub; let stubUrl;
let localizeDeepLinks; let buildAskPrompt; let localeLabel; let loadLocaleDict;

// What the stub "model" answers — EN labels on purpose (the bug: the model
// writes EN labels in every locale). One alias route, one kebab route, one
// route with no nav key at all.
const STUB_ANSWER = [
  'Open [Open the Scan page](#/scan) and check [the tracker](#/tracker).',
  'Then [Open the Apply checklist](#/apply) and plan in [Career plan](#/career-plan).',
  'A place that does not exist: [Custom link](#/made-up-route) stays as written.',
].join('\n');

const post = (p, b) => fetch(`${baseUrl}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

before(async () => {
  // Scrub EVERY provider credential (any *_API_KEY, Ollama URL, provider pin)
  // — same scrub contract as tests/docs-assistant-routes.test.mjs, so the
  // cascade can only ever pick the stub below.
  for (const k of Object.keys(process.env)) {
    if (/_API_KEY$|^OLLAMA_BASE_URL$|^LLM_PROVIDER$/.test(k)) delete process.env[k];
  }
  // Stub provider: a local OpenAI-compatible /chat/completions server behind
  // OLLAMA_BASE_URL. OLLAMA_BASE_URL is the one base URL whose policy allows
  // loopback (BASE_URL_POLICIES: { local: true }), so the real dispatch
  // (resolveProvider → tailProvider) picks ollama and POSTs here.
  stub = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: STUB_ANSWER }, finish_reason: 'stop' }] }));
    });
  });
  await new Promise((r) => { stub.listen(0, '127.0.0.1', r); });
  stubUrl = `http://127.0.0.1:${stub.address().port}/v1`;
  process.env.OLLAMA_BASE_URL = stubUrl;

  const root = mkdtempSync(join(tmpdir(), 'docs-deeplink-'));
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  process.env.CAREER_OPS_ROOT = root;

  ({ localizeDeepLinks, buildAskPrompt } = await import('../server/lib/routes/docs-assistant.mjs'));
  ({ localeLabel, loadLocaleDict } = await import('../server/lib/i18n-server.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(async () => {
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.CAREER_OPS_ROOT;
  await new Promise((r) => server.close(r));
  await new Promise((r) => stub.close(r));
});

// ── loader (server/lib/i18n-server.mjs) ──────────────────────────────────────

test('loadLocaleDict reads the real ru table with the literal nav.scan value', () => {
  const dict = loadLocaleDict('ru');
  assert.ok(dict && typeof dict === 'object');
  assert.equal(dict['nav.scan'], 'Поиск');            // i18n-dict.ru.js — read from the shipped file
  assert.equal(localeLabel('ru', 'nav.scan'), 'Поиск');
});

test('localeLabel resolves one alias hop (nav.apply → apply.title)', () => {
  assert.equal(localeLabel('ru', 'nav.apply'), 'Чек-лист отклика'); // apply.title in ru
  assert.equal(localeLabel('en', 'nav.scan'), 'Scan');
});

test('localeLabel returns an empty string for a missing key, never throws', () => {
  assert.equal(localeLabel('ru', 'nav.madeUpRoute'), '');
  assert.equal(localeLabel('ru', 'constructor'), ''); // own-key lookup only
  assert.equal(localeLabel('zz-unknown', 'nav.scan'), 'Scan'); // falls back to en
});

// ── the rewriter (unit) ──────────────────────────────────────────────────────

test('ru: EN deep-link label becomes the localized nav label, href verbatim', () => {
  assert.equal(localizeDeepLinks('[Open the Scan page](#/scan)', 'ru'), '[Поиск](#/scan)');
});

test('en: answers keep the model\'s EN labels untouched', () => {
  const md = '[Open the Scan page](#/scan) and [the tracker](#/tracker)';
  assert.equal(localizeDeepLinks(md, 'en'), md);
});

test('an unknown route keeps its original label', () => {
  const md = '[Custom link](#/made-up-route)';
  assert.equal(localizeDeepLinks(md, 'ru'), md);
});

test('kebab routes map camelCase: #/career-plan → nav.careerPlan', () => {
  assert.equal(localizeDeepLinks('[Career plan](#/career-plan)', 'ru'), '[Карьерный план](#/career-plan)');
});

test('alias routes rewrite too: #/apply → apply.title', () => {
  assert.equal(localizeDeepLinks('[Open the Apply checklist](#/apply)', 'ru'), '[Чек-лист отклика](#/apply)');
});

test('a full multi-link answer: every known route localized, unknown kept, hrefs intact', () => {
  const out = localizeDeepLinks(STUB_ANSWER, 'ru');
  assert.match(out, /\[Поиск\]\(#\/scan\)/);
  assert.match(out, /\[Трекер\]\(#\/tracker\)/);
  assert.match(out, /\[Чек-лист отклика\]\(#\/apply\)/);
  assert.match(out, /\[Карьерный план\]\(#\/career-plan\)/);
  assert.match(out, /\[Custom link\]\(#\/made-up-route\)/);
  // Hrefs are exactly the originals — only labels moved.
  assert.deepEqual(out.match(/\(#[a-z/-]+\)/g), STUB_ANSWER.match(/\(#[a-z/-]+\)/g));
});

test('non-string / empty input passes through untouched', () => {
  assert.equal(localizeDeepLinks(null, 'ru'), null);
  assert.equal(localizeDeepLinks('', 'ru'), '');
  assert.equal(localizeDeepLinks(undefined, 'ru'), undefined);
});

// ── the belt: the system prompt instructs localized labels ──────────────────

test('buildAskPrompt for a non-en locale instructs deep-link labels in the user\'s language', () => {
  const p = buildAskPrompt([{ title: 'Scanning', body: '## Scanning\nRun a scan.\n' }], 'how do I scan?', 'ru');
  assert.match(p, /deep-link/i);
  assert.match(p, /label/i);
  assert.match(p, /user's language \(ru\)/i);
});

test('the en prompt does not ask for non-EN labels', () => {
  const p = buildAskPrompt([{ title: 'Scanning', body: '## Scanning\nRun a scan.\n' }], 'how do I scan?', 'en');
  assert.doesNotMatch(p, /deep-link label/i);
});

// ── end-to-end through the route with the stub provider ─────────────────────

test('POST /ask run:true lang=ru → answer labels localized by the server', async () => {
  const r = await post('/api/docs-assistant/ask', { question: 'How do I scan job portals?', run: true, lang: 'ru' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.mode, 'ollama');
  assert.ok(j.answer, 'the stub answered');
  assert.match(j.answer, /\[Поиск\]\(#\/scan\)/);
  assert.doesNotMatch(j.answer, /Open the Scan page/, 'the EN label must be rewritten away');
  assert.match(j.answer, /\[Custom link\]\(#\/made-up-route\)/, 'unknown route keeps its label');
  // Href integrity: every deep-link href survived verbatim.
  assert.deepEqual(j.answer.match(/\(#[a-z/-]+\)/g), STUB_ANSWER.match(/\(#[a-z/-]+\)/g));
});

test('POST /ask run:true lang=en → answer passes through unchanged', async () => {
  const r = await post('/api/docs-assistant/ask', { question: 'How do I scan job portals?', run: true, lang: 'en' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.answer, STUB_ANSWER);
});
