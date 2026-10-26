/**
 * FULL-R5 (review 3) — `lang` becomes an OPT-IN body augmentation.
 *
 * Pre-fix `API.call()` merged `lang` into EVERY object body while its
 * comment claimed "LLM-bound mutations" — so POST /api/config, PUT
 * /api/profile, PUT /api/cv, PUT /api/two-pager, PUT /api/batch, PUT
 * /api/memory, PUT /api/career-plan, /api/modes/_profile and friends all
 * carried a stray key that server routes must defensively delete
 * (server/lib/routes/config.mjs did `delete body.lang`).
 *
 * New contract:
 *   • API.post/put/patch(path, body, { lang: true }) → body gains `lang`;
 *   • every other object body is sent VERBATIM (no lang);
 *   • the Accept-Language header still rides every request (resolveLocale's
 *     fallback), so LLM routes keep resolving the locale either way;
 *   • the LLM-bound call sites opt back in explicitly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_SRC = readFileSync(resolve(ROOT, 'public/js/api.js'), 'utf8');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

function mkEl(tag) {
  return {
    tagName: tag, children: [], className: '', style: {}, hidden: false,
    textContent: '', innerHTML: '', isConnected: true,
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    appendChild(ch) { this.children.push(ch); return ch; },
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
  };
}

async function loadApiWithCapture() {
  const bodies = [];
  const doc = {
    title: '',
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null,
    createElement: (tag) => mkEl(tag),
    querySelectorAll: () => [],
    execCommand: () => true,
  };
  const w = { location: { hash: '#/' }, addEventListener() {} };
  const fetchImpl = async (path, opts) => {
    bodies.push({ path, opts });
    return { ok: true, json: async () => ({}), text: async () => '' };
  };
  const setTimeoutNoop = () => 0;
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'fetch', 'EventSource', 'MutationObserver', 'setTimeout', 'clearTimeout', API_SRC)(
    w, doc, fetchImpl, function () { this.close = () => {}; }, function () { this.disconnect = () => {}; },
    setTimeoutNoop, setTimeoutNoop,
  );
  return { w, bodies };
}

async function lastBody(bodies) {
  const last = bodies[bodies.length - 1];
  return { opts: last.opts, body: JSON.parse(last.opts.body) };
}

test('behavioural: plain POST/PUT bodies carry NO lang key', async () => {
  const { w, bodies } = await loadApiWithCapture();
  await w.API.post('/api/config', { LLM_PROVIDER: 'auto' });
  let r = await lastBody(bodies);
  assert.equal('lang' in r.body, false, 'POST /api/config body must be verbatim');
  await w.API.put('/api/cv', { markdown: '# CV' });
  r = await lastBody(bodies);
  assert.equal('lang' in r.body, false, 'PUT /api/cv body must be verbatim');
  await w.API.put('/api/profile', { yaml: 'candidate:' });
  r = await lastBody(bodies);
  assert.equal('lang' in r.body, false, 'PUT /api/profile body must be verbatim');
  await w.API.post('/api/two-pager/draft', { run: true });
  r = await lastBody(bodies);
  assert.equal('lang' in r.body, false, 'non-opt-in bodies must be verbatim');
  // The Accept-Language header still rides every request (locale fallback).
  assert.equal(r.opts.headers['Accept-Language'], 'en');
});

test('behavioural: { lang: true } opts the body in; explicit body.lang still wins', async () => {
  const { w, bodies } = await loadApiWithCapture();
  await w.API.post('/api/evaluate', { jd: 'x' }, { lang: true });
  let r = await lastBody(bodies);
  assert.equal(r.body.lang, 'en', 'opt-in sites carry the UI locale in the body');
  assert.equal(r.body.jd, 'x');
  await w.API.post('/api/x', { a: 1, lang: 'ru' }, { lang: true });
  r = await lastBody(bodies);
  assert.equal(r.body.lang, 'ru', 'a caller-supplied lang is never overwritten');
  await w.API.post('/api/y', { a: 1 });
  r = await lastBody(bodies);
  assert.equal('lang' in r.body, false);
  // Arrays and primitives are sent verbatim either way.
  await w.API.post('/api/z', [1, 2]);
  r = await lastBody(bodies);
  assert.deepEqual(r.body, [1, 2]);
});

test('static: the LLM-bound call sites opt in explicitly', () => {
  // CAR-119 (merged while this branch was in flight) moved the LIVE sites of
  // deep/mode-page/cv-studio onto the shared LlmPageKit.postJSON transport,
  // which carries lang by contract (its 12 AI-view consumers are all
  // LLM-bound). The gate therefore accepts either form per site: an explicit
  // `{ lang: true }` on API.post, or the LlmPageKit transport.
  const cases = [
    ['public/js/views/evaluate.js', /API\.post\('\/api\/evaluate',[\s\S]{0,200}?\{ lang: true \}\)/, 1],
    ['public/js/views/deep.js', /API\.post\('\/api\/deep',[\s\S]{0,200}?\{ lang: true \}\)|LlmPageKit\.postJSON\('\/api\/deep'/, 2],
    ['public/js/views/mode-page.js', /API\.post\('\/api\/mode\/' \+ apiSlug,[\s\S]{0,200}?\{ lang: true \}\)|LlmPageKit\.postJSON\('\/api\/mode\/' \+ apiSlug/, 2],
    ['public/js/views/apply.js', /API\.post\('\/api\/apply-helper',[\s\S]{0,200}?\{ lang: true \}\)/, 1],
    ['public/js/views/cv-studio.js', /API\.post\('\/api\/cv-studio\/[\w-]*'[\s\S]{0,200}?\{ lang: true \}\)|LlmPageKit\.postJSON\('\/api\/cv-studio\//, 4],
  ];
  for (const [file, re, min] of cases) {
    const src = read(file);
    const hits = (src.match(new RegExp(re.source, 'g')) || []).length;
    assert.ok(hits >= min, `${file}: expected ≥${min} opt-in call site(s), got ${hits}`);
  }
  // cv-studio: all four POSTs (humanize/tailor/add-entry/verify-facts) are
  // LLM-bound and must each carry lang (explicit opt-in or the LlmPageKit
  // transport).
  const studio = read('public/js/views/cv-studio.js');
  for (const ep of ['humanize', 'tailor', 'add-entry']) {
    assert.match(studio, new RegExp(`LlmPageKit\\.postJSON\\('/api/cv-studio/${ep}'`),
      `cv-studio ${ep} must ride the lang-carrying LlmPageKit transport`);
  }
  assert.match(studio, /API\.post\('\/api\/cv-studio\/verify-facts',[\s\S]{0,200}?\{ lang: true \}\)/,
    'cv-studio verify-facts must opt in');
  // The LlmPageKit transport itself injects lang (contract check).
  const kit = read('public/js/lib/llm-page-kit.js');
  assert.match(kit, /\{\s*\.\.\.body,\s*lang\s*\}/, 'LlmPageKit.postJSON must keep carrying lang');
});

test('static: the write endpoints stay untouched (no opt-in, no lang)', () => {
  const negatives = [
    ['public/js/views/config.js', /API\.post\('\/api\/config', body\)/, 'config POST'],
    ['public/js/views/config.js', /API\.put\('\/api\/profile', \{ fields:[^)]*\)\)/, 'profile PUT (fields)'],
    ['public/js/views/cv.js', /API\.put\('\/api\/cv', \{ markdown: ta\.value \}\)/, 'cv PUT'],
    ['public/js/views/two-pager.js', /API\.put\('\/api\/two-pager', collect\(\)\)/, 'two-pager PUT'],
    ['public/js/views/batch.js', /API\.put\('\/api\/batch', \{ raw: textarea\.value \}\)/, 'batch PUT'],
  ];
  for (const [file, re, label] of negatives) {
    assert.match(read(file), re, `${label} must keep its verbatim (no-lang) shape`);
  }
  // None of the write endpoints opts in.
  for (const [file, marker] of [
    ['public/js/views/config.js', "'/api/config'"],
    ['public/js/views/cv.js', "'/api/cv'"],
    ['public/js/views/two-pager.js', "'/api/two-pager'"],
  ]) {
    const src = read(file);
    const idx = src.indexOf(marker);
    assert.ok(idx >= 0, `${file} must still call ${marker}`);
    const around = src.slice(idx, idx + 200);
    assert.ok(!around.includes('lang: true'), `${file} ${marker} must not opt in to lang`);
  }
});

test('static: the api.js comment states the opt-in contract', () => {
  assert.match(API_SRC, /lang: true/, 'the opt-in flag must be documented in api.js');
  assert.ok(!/Auto-attach lang to LLM-bound mutations/.test(API_SRC),
    'the stale "auto-attach" comment must go');
});
