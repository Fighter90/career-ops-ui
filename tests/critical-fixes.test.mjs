/**
 * Cross-cutting tests for the v1.10.1 critical-fixes slice:
 *   - F-002: GET /api/help/ko resolves to ko-KR.md (not en.md fallback)
 *   - F-009: POST /api/evaluate { mode: 'manual' } skips Anthropic even with key set
 *   - PR-6:  DELETE /api/pipeline accepts body.url + returns 404 on missing
 *   - PR-2:  buildLocaleDirective + resolveLocale are wired through prompt builders
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { isPrivateOrLoopbackHost } from '../server/lib/security.mjs';

// Test-isolation fix (v1.69.2): `prompts.mjs` transitively imports `paths.mjs`,
// which resolves PROJECT_ROOT eagerly at module load (PATHS resolves once per
// process). A TOP-LEVEL import here ran BEFORE before() sets CAREER_OPS_ROOT, so
// PATHS pinned the REAL parent — and the F-008 `PUT /api/profile` then leaked the
// "Acceptance Test" fixture into the real config/profile.yml (and similar writes
// escaped the temp root). Load the prompt builders DYNAMICALLY, inside before(),
// after the env is set, so paths.mjs resolves to the temp dir. `security.mjs`
// does not import paths.mjs, so it stays a static import.
let buildLocaleDirective, resolveLocale, buildEvaluationPrompt, buildDeepPrompt, buildModePrompt, bundleProjectContext;

let server;
let baseUrl;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'crit-fixes-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  writeFileSync(resolve(dir, 'modes', '_shared.md'), '# shared\nUse WebSearch for comp.\n| WebFetch | fallback |\n');
  writeFileSync(resolve(dir, 'modes', 'deep.md'), '# deep\nstructure\n');
  process.env.CAREER_OPS_ROOT = dir;

  // Import paths.mjs-backed modules ONLY after CAREER_OPS_ROOT is set.
  ({ buildLocaleDirective, resolveLocale, buildEvaluationPrompt, buildDeepPrompt, buildModePrompt, bundleProjectContext } =
    await import('../server/lib/prompts.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

// ───────────────────────── F-002: ko alias ─────────────────────────

test('F-002: GET /api/help/ko returns ko-KR bundle, not en fallback', async () => {
  const r = await fetch(baseUrl + '/api/help/ko');
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.lang, 'ko-KR', 'should resolve via FILE_ALIASES to ko-KR.md');
  assert.ok(typeof data.markdown === 'string' && data.markdown.length > 1000);
});

test('F-002: GET /api/help/en still serves en.md', async () => {
  const r = await fetch(baseUrl + '/api/help/en');
  const data = await r.json();
  assert.equal(data.lang, 'en');
});

test('F-002: GET /api/help/xx-YY for unknown locale falls back to en.md', async () => {
  const r = await fetch(baseUrl + '/api/help/xx-YY');
  const data = await r.json();
  assert.equal(data.lang, 'en');
});

// ───────────────────────── F-009: manual mode opt-out ─────────────────────────

test('F-009: POST /api/evaluate { mode:"manual" } returns prompt without LLM call', async () => {
  // Even if ANTHROPIC_API_KEY is set in the environment, manual mode must
  // bypass it so users can paste the prompt into Claude Code by hand.
  const longJd = 'Senior Backend Engineer, Go + PostgreSQL, microservice ownership, code review, on-call rotation. ';
  const r = await fetch(baseUrl + '/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jd: longJd.repeat(2), mode: 'manual', lang: 'ru' }),
  });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.mode, 'manual');
  assert.ok(data.prompt && data.prompt.length > 100);
  // Locale directive should be present because lang=ru.
  assert.match(data.prompt, /Respond in Russian/);
});

// ───────────────────────── PR-6: DELETE shape ─────────────────────────

test('PR-6: DELETE /api/pipeline accepts body.url', async () => {
  const url = 'https://pr6-' + Date.now() + '.example.com/job/1';
  const add = await fetch(baseUrl + '/api/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  assert.equal(add.status, 200);

  const del = await fetch(baseUrl + '/api/pipeline', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  assert.equal(del.status, 200);
  const data = await del.json();
  assert.equal(data.ok, true);
  assert.equal(data.removed, 1);
  assert.equal(data.url, url);
});

test('PR-6: DELETE /api/pipeline returns 404 for missing url', async () => {
  const del = await fetch(baseUrl + '/api/pipeline?url=' + encodeURIComponent('https://never-added-' + Date.now() + '.example.com/x'), {
    method: 'DELETE',
  });
  assert.equal(del.status, 404);
  const data = await del.json();
  assert.match(data.error, /not found/);
});

test('PR-6: DELETE /api/pipeline returns 400 with no url at all', async () => {
  const del = await fetch(baseUrl + '/api/pipeline', { method: 'DELETE' });
  assert.equal(del.status, 400);
  const data = await del.json();
  assert.match(data.error, /url required/i);
});

// ───────────────────────── PR-3 helper unit tests ─────────────────────────

test('PR-3: isPrivateOrLoopbackHost classifies IPv4 ranges correctly', () => {
  assert.equal(isPrivateOrLoopbackHost('10.0.0.1'), true);
  assert.equal(isPrivateOrLoopbackHost('172.20.0.1'), true);
  assert.equal(isPrivateOrLoopbackHost('192.168.42.42'), true);
  assert.equal(isPrivateOrLoopbackHost('169.254.169.254'), true);  // AWS IMDS
  assert.equal(isPrivateOrLoopbackHost('127.5.5.5'), true);
  assert.equal(isPrivateOrLoopbackHost('0.0.0.0'), true);
  assert.equal(isPrivateOrLoopbackHost('100.64.1.1'), true);       // CGNAT
  assert.equal(isPrivateOrLoopbackHost('8.8.8.8'), false);
  assert.equal(isPrivateOrLoopbackHost('1.1.1.1'), false);
});

test('PR-3: isPrivateOrLoopbackHost handles IPv6 + bracketed forms', () => {
  assert.equal(isPrivateOrLoopbackHost('::1'), true);
  assert.equal(isPrivateOrLoopbackHost('[::1]'), true);
  assert.equal(isPrivateOrLoopbackHost('fc00::1'), true);
  assert.equal(isPrivateOrLoopbackHost('fe80::abcd'), true);
  assert.equal(isPrivateOrLoopbackHost('2606:4700::1111'), false);  // public
});

test('PR-3: isPrivateOrLoopbackHost flags localhost and *.localhost', () => {
  assert.equal(isPrivateOrLoopbackHost('localhost'), true);
  assert.equal(isPrivateOrLoopbackHost('foo.localhost'), true);
  assert.equal(isPrivateOrLoopbackHost('jobs.example.com'), false);
});

// ───────────────────────── PR-2: locale propagation ─────────────────────────

test('PR-2: resolveLocale prefers body.lang then body.locale then Accept-Language', () => {
  assert.equal(resolveLocale({ body: { lang: 'ru' } }), 'ru');
  assert.equal(resolveLocale({ body: { locale: 'pt-BR' } }), 'pt-BR');
  assert.equal(resolveLocale({ body: {}, headers: { 'accept-language': 'ja,en;q=0.5' } }), 'ja');
  // Unknown → defaults to en.
  assert.equal(resolveLocale({ body: { lang: 'klingon' } }), 'en');
  // Region-tag fallback to base.
  assert.equal(resolveLocale({ body: { lang: 'es-ES' } }), 'es');
});

test('PR-2: buildLocaleDirective emits a one-line directive for non-en', () => {
  assert.equal(buildLocaleDirective('en'), '');
  assert.match(buildLocaleDirective('ru'), /Respond in Russian/);
  assert.match(buildLocaleDirective('ko'), /Respond in Korean/);
  assert.match(buildLocaleDirective('zh-CN'), /Simplified Chinese/);
});

test('PR-2: buildEvaluationPrompt embeds the locale directive', () => {
  const p = buildEvaluationPrompt('A senior engineer JD…', 'ru');
  assert.match(p, /Respond in Russian/);
  // English path produces no directive.
  const en = buildEvaluationPrompt('A senior engineer JD…', 'en');
  assert.ok(!/Respond in/.test(en));
});

test('PR-2: buildDeepPrompt embeds the locale directive', () => {
  const p = buildDeepPrompt('Anthropic', 'Backend', 'ja');
  assert.match(p, /Respond in Japanese/);
});

// Headless /api/deep (Gemini generateContent) has no tools. Instructing
// WebFetch/WebSearch causes finishReason MALFORMED_FUNCTION_CALL → HTTP 502.
test('headless buildDeepPrompt must not name Claude Code tools', () => {
  const manual = buildDeepPrompt('Live Nation Entertainment', '', 'en');
  assert.match(manual, /WebFetch|WebSearch/);
  assert.match(manual, /Save the output to interview-prep\//);

  const live = buildDeepPrompt('Live Nation Entertainment', '', 'en', { headless: true });
  assert.doesNotMatch(live, /WebFetch|WebSearch/);
  assert.doesNotMatch(live, /Save the output to interview-prep\//);
  assert.match(live, /Live Nation Entertainment/);
  assert.match(live, /no (browsing|tool)|do NOT have access|without tools|training data|knowledge/i);
});

test('headless bundleProjectContext overrides inlined tool tables', () => {
  const ctx = bundleProjectContext({ modeSlugs: ['_shared', 'deep'], headless: true });
  assert.match(ctx, /WebSearch/); // still inlined from modes/_shared.md
  assert.match(ctx, /do NOT have access|headless API session/i);
});


test('PR-2: buildModePrompt embeds locale + strips lang/locale from rendered context', () => {
  const tmpl = 'mode template body';
  const ctx = { lang: 'ko', company: 'Acme' };
  const p = buildModePrompt(tmpl, 'project', ctx, 'ko');
  assert.match(p, /Respond in Korean/);
  // The lang field should NOT appear inside the rendered JSON context.
  const jsonBlock = p.match(/```json\n([\s\S]*?)```/)?.[1] || '';
  assert.ok(!jsonBlock.includes('"lang"'), 'lang must be stripped from rendered context');
});

// ───────────────────────── extra coverage: helper edge cases ─────────────────────────

test('PR-3: isPrivateOrLoopbackHost rejects non-string / null / empty', () => {
  assert.equal(isPrivateOrLoopbackHost(null), false);
  assert.equal(isPrivateOrLoopbackHost(undefined), false);
  assert.equal(isPrivateOrLoopbackHost(''), false);
  assert.equal(isPrivateOrLoopbackHost(42), false);
  assert.equal(isPrivateOrLoopbackHost({}), false);
});

test('PR-3: isPrivateOrLoopbackHost treats malformed IPv4 octets as private (fail-closed)', () => {
  // 999.999.999.999 has > 255 octets — not a valid IP. We fail-closed
  // (treat as private) so a parser disagreement can't slip through.
  assert.equal(isPrivateOrLoopbackHost('999.999.999.999'), true);
});

test('PR-3: isPrivateOrLoopbackHost recognizes upper-case + odd-case input', () => {
  assert.equal(isPrivateOrLoopbackHost('LOCALHOST'), true);
  assert.equal(isPrivateOrLoopbackHost('LocalHost'), true);
  assert.equal(isPrivateOrLoopbackHost('FOO.LOCALHOST'), true);
});

test('PR-3: isPrivateOrLoopbackHost lets public IPv6 through', () => {
  assert.equal(isPrivateOrLoopbackHost('2001:db8::1'), false);
  assert.equal(isPrivateOrLoopbackHost('[2606:4700::1]'), false);
});

// ───────────────────────── F-002: help route fallback edge cases ─────────────────────────

test('F-002: GET /api/help/ko-KR (full code) also works', async () => {
  const r = await fetch(baseUrl + '/api/help/ko-KR');
  const data = await r.json();
  assert.equal(data.lang, 'ko-KR');
});

test('F-002: GET /api/help/zh-AA falls through region-tag → base zh.md if present, else en', async () => {
  // No zh.md exists in docs/help/, so this should fall back to en.md.
  // The base-fallback path is exercised via the "split('-')[0]" branch.
  const r = await fetch(baseUrl + '/api/help/zh-AA');
  const data = await r.json();
  assert.equal(data.lang, 'en');
});

test('F-002: path-traversal in lang param is sanitized', async () => {
  // The route applies a [a-zA-Z0-9_-] filter — `..` becomes `..`, then
  // `..md` doesn't exist as a file, region alias miss, base miss → en.md.
  // This asserts that a slash-bearing input cannot escape the help dir.
  const r = await fetch(baseUrl + '/api/help/' + encodeURIComponent('../../../etc/passwd'));
  const data = await r.json();
  // Should fall back to en.md (sanitized to empty / unknown), NOT serve /etc/passwd.
  assert.equal(data.lang, 'en');
});

// ───────────────────────── F-005 + F-008: activity-log integration ─────────────────────────

test('F-005: rejected POST /api/pipeline does NOT create an event', async () => {
  // Need raw fetch + activity check — we hit the live server.
  const before = await fetch(baseUrl + '/api/activity?limit=200').then((r) => r.json());
  await fetch(baseUrl + '/api/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'not-a-url' }),
  });
  await new Promise((r) => setTimeout(r, 50));
  const after = await fetch(baseUrl + '/api/activity?limit=200').then((r) => r.json());
  assert.equal(after.events.length, before.events.length, 'rejected request must not produce an event');
});

test('F-008: PUT /api/profile produces a profile.save event', async () => {
  const yamlBody = '# Career-Ops Profile Configuration\ncandidate:\n  full_name: Acceptance Test\n  email: q@example.com\n';
  const put = await fetch(baseUrl + '/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml: yamlBody }),
  });
  assert.equal(put.status, 200);
  await new Promise((r) => setTimeout(r, 50));
  const events = (await fetch(baseUrl + '/api/activity?limit=20').then((r) => r.json())).events;
  const hit = events.find((e) => e.action === 'profile.save');
  assert.ok(hit, `expected profile.save event in feed, got: ${JSON.stringify(events.map((e) => e.action))}`);
  assert.equal(hit.ok, true);
});

// ───────────────────────── F-009: manual-mode opt-out works EVEN with key set ─────────────────────────

test('F-009: POST /api/evaluate { mode:"manual" } skips Anthropic even when ANTHROPIC_API_KEY is set', async () => {
  // Force the key on for this single request to prove the manual-mode path
  // short-circuits before any LLM dispatch logic runs. Restore after.
  const previous = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-fake-key-not-real';
  try {
    const longJd = 'Senior Backend Engineer, Go + PostgreSQL, microservice ownership, code review, on-call. ';
    const start = Date.now();
    const r = await fetch(baseUrl + '/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd: longJd.repeat(2), mode: 'manual', lang: 'ja' }),
    });
    const elapsed = Date.now() - start;
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.mode, 'manual');
    assert.match(data.prompt, /Respond in Japanese/);
    // Manual-mode must respond fast; if Anthropic was reached the SDK would
    // try a real network call against the bogus key and either time out or
    // 401. 5s is well below either.
    assert.ok(elapsed < 5000, `manual mode took ${elapsed}ms; suggests it didn't short-circuit`);
  } finally {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  }
});

// ───────────────────────── PR-2: Accept-Language fallback ─────────────────────────

test('PR-2: /api/evaluate honors Accept-Language when no body.lang/locale', async () => {
  const longJd = 'Senior Backend Engineer, Python + Django, REST APIs, code review, deploy ownership. ';
  const r = await fetch(baseUrl + '/api/evaluate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5',
    },
    body: JSON.stringify({ jd: longJd.repeat(2), mode: 'manual' }),
  });
  const data = await r.json();
  assert.match(data.prompt, /Respond in Brazilian Portuguese/);
});

// ───────────────────────── PR-6: query-string path also still works ─────────────────────────

test('PR-6: DELETE /api/pipeline?url=... still works (legacy contract)', async () => {
  const url = 'https://pr6-q-' + Date.now() + '.example.com/job/2';
  await fetch(baseUrl + '/api/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const del = await fetch(baseUrl + '/api/pipeline?url=' + encodeURIComponent(url), { method: 'DELETE' });
  assert.equal(del.status, 200);
  const data = await del.json();
  assert.equal(data.ok, true);
  assert.equal(data.removed, 1);
});

// ───────────────────────── PR-3: DNS-rebind defense (mocked DNS) ─────────────────────────

test('PR-3: /api/pipeline/preview blocks when DNS resolves to a private address (rebind defense)', { timeout: 15_000 }, async () => {
  // Real-world rebind exploit pattern: use a public hostname that the
  // public DNS resolver resolves to 127.0.0.1. The free service nip.io
  // does exactly that — `127.0.0.1.nip.io` always resolves to 127.0.0.1.
  // isValidJobUrl can't reject it on string-shape because the hostname
  // looks like a normal subdomain. The DNS-rebind guard in the preview
  // proxy is what should catch it.
  //
  // Skips when the test sandbox has no internet (CI fallback). We don't
  // fail open on lookup error in production, but in the test env we
  // can't tell "no DNS" apart from "DNS reports private IP" without
  // a real query, so the skip keeps the suite portable.
  let dnsWorks = false;
  try {
    const dns = await import('node:dns/promises');
    const r = await dns.lookup('127.0.0.1.nip.io', { verbatim: true });
    dnsWorks = r && r.address === '127.0.0.1';
  } catch { dnsWorks = false; }
  if (!dnsWorks) {
    // No internet or nip.io changed behavior — treat as skipped.
    return;
  }
  const r = await fetch(baseUrl + '/api/pipeline/preview?url=' + encodeURIComponent('https://127.0.0.1.nip.io/jobs/abc'));
  const data = await r.json();
  assert.equal(data.status, 0);
  assert.match(data.text, /private address|blocked/i);
});
