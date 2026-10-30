/**
 * Branch coverage — server/lib/routes/content.mjs (BACKLOG: 37 % branch) and
 * server/lib/routes/networking.mjs (61 %). CI-isolated: CAREER_OPS_ROOT is a
 * mkdtemp fixture, app in-process on 127.0.0.1:0, no network and no LLM keys
 * (the networking "live" path answers from the honest manual fallback).
 *
 * Focus is the validation / error / edge branches: 400s on every malformed
 * body shape, 409/413 paths, atomic-write round-trips, the sanitizer flags,
 * the field-form merge allowlists, section-merge unknown-heading refusal,
 * path-injection refusals, and the write-exclusive same-day collision ladder.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl; let root; let today;
const p = (...a) => resolve(root, ...a);
const getJson = async (path) => { const r = await fetch(`${baseUrl}${path}`); return { status: r.status, body: await r.json(), headers: r.headers }; };
const jsonReq = (method, path, body) => fetch(`${baseUrl}${path}`, {
  method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const rawReq = (method, path, body, headers = {}) => fetch(`${baseUrl}${path}`, { method, headers, body });

before(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'content-net-'));
  mkdirSync(p('data'), { recursive: true });
  mkdirSync(p('config'), { recursive: true });
  writeFileSync(p('cv.md'), '# Jane Dev\nSenior Backend Engineer.\n');
  writeFileSync(p('data', 'applications.md'), '# Applications\n| # |\n|---|\n');
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'DEEPSEEK_API_KEY', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  ({ today } = await import('../server/lib/parsers.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

// ─── CV read/write ───

test('GET /api/cv: missing file → empty markdown; present file → markdown', async () => {
  rmSync(p('cv.md'));
  let r = await getJson('/api/cv');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { markdown: '' });
  writeFileSync(p('cv.md'), '# Jane\n');
  r = await getJson('/api/cv');
  assert.equal(r.body.markdown, '# Jane\n');
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('PUT /api/cv: malformed bodies → 400; oversized → 413', async () => {
  assert.equal((await jsonReq('PUT', '/api/cv', {})).status, 400);
  assert.equal((await jsonReq('PUT', '/api/cv', { markdown: 42 })).status, 400);
  assert.equal((await jsonReq('PUT', '/api/cv', { markdown: 'x' })).status, 200, 'sanity: minimal body saves');
  assert.equal((await jsonReq('PUT', '/api/cv', { markdown: 'a'.repeat(1024 * 1024 + 1) })).status, 413);
});

test('PUT /api/cv: a scalar JSON body is refused by the strict body parser (global 400 branch)', async () => {
  // express.json strict mode rejects scalars before the route runs; the
  // route's `?? req.body` string fallback is therefore unreachable over the
  // wire and the request lands in the global body-parser error handler.
  const res = await jsonReq('PUT', '/api/cv', '# Plain string CV');
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error, 'the parser failure is a JSON error body, never HTML');
});

test('PUT /api/cv: sanitizes dangerous markdown and reports the flag', async () => {
  const dirty = '# CV\n<script>alert(1)</script>\nAll good.';
  const res = await jsonReq('PUT', '/api/cv', { markdown: dirty });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.sanitized, true);
  const stored = readFileSync(p('cv.md'), 'utf8');
  assert.ok(!/<script/i.test(stored), 'script tag never lands on disk');
  assert.match(stored, /All good\./);
  const clean = await jsonReq('PUT', '/api/cv', { markdown: '# Clean\n' });
  assert.equal((await clean.json()).sanitized, false);
});

// ─── CV import ───

const importReq = (body, headers) => rawReq('POST', '/api/cv/import', body, headers);

test('POST /api/cv/import: empty octet-stream body → 400 with the contract hint', async () => {
  const res = await importReq('', { 'content-type': 'application/octet-stream', 'x-filename': 'cv.md' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /empty body/);
});

test('POST /api/cv/import: multipart bytes under octet-stream → 415', async () => {
  const multipart = '-----------------------------X\r\nContent-Disposition: form-data; name="file"\r\n\r\nx\r\n';
  const res = await importReq(multipart, { 'content-type': 'application/octet-stream', 'x-filename': 'cv.md' });
  assert.equal(res.status, 415);
  assert.match((await res.json()).error, /multipart\/form-data under octet-stream/);
});

test('POST /api/cv/import: multipart with no file part → 400', async () => {
  const fd = new FormData();
  fd.append('note', 'just a text field');
  const res = await fetch(`${baseUrl}/api/cv/import`, { method: 'POST', body: fd });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /no file part/);
});

test('POST /api/cv/import: .md passthrough converts and sanitizes', async () => {
  const res = await importReq('# Imported <script>x</script>CV', { 'content-type': 'application/octet-stream', 'x-filename': 'cv.md' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.sourceFormat, 'md');
  assert.equal(body.converter, 'passthrough');
  assert.ok(!/<script/i.test(body.markdown));
  assert.match(body.markdown, /Imported/);
});

test('POST /api/cv/import: a real multipart file part converts (multer path)', async () => {
  const fd = new FormData();
  fd.append('file', new Blob(['# Multipart CV\nbody'], { type: 'text/markdown' }), 'cv.md'); // Blob, not File: Node 18 has no File global
  const res = await fetch(`${baseUrl}/api/cv/import`, { method: 'POST', body: fd });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.sourceFormat, 'md');
  assert.match(body.markdown, /Multipart CV/);
});

test('POST /api/cv/import: an unsupported extension → 422 ok:false with the format hint', async () => {
  const res = await importReq('MZ fake binary', { 'content-type': 'application/octet-stream', 'x-filename': 'cv.exe' });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /unsupported format/);
  assert.match(body.hint, /Supported:/);
});

test('POST /api/cv/import: a broken .docx → 422 (converter failure, never a 500)', async () => {
  const res = await importReq('not really a docx', { 'content-type': 'application/octet-stream', 'x-filename': 'cv.docx' });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).ok, false);
});

// ─── Profile read ───

test('GET /api/profile: missing → nulls; canonical schema summarized (comp range folded)', async () => {
  rmSync(p('config', 'profile.yml'), { force: true });
  let r = await getJson('/api/profile');
  assert.deepEqual(r.body, { profile: null, summary: null });
  writeFileSync(p('config', 'profile.yml'), [
    'full_name: Jane Dev',
    'email: jane@example.com',
    'narrative:',
    '  headline: Platform engineer',
    'target_roles:',
    '  primary:',
    '    - Backend Engineer',
    'compensation:',
    '  target_range: "$120K-160K"',
    '',
  ].join('\n'));
  r = await getJson('/api/profile');
  assert.equal(r.status, 200);
  assert.equal(r.body.summary.full_name, 'Jane Dev');
  assert.equal(r.body.summary.target_roles[0], 'Backend Engineer');
  assert.equal(r.body.summary.comp_min_usd, 120000);
  assert.equal(r.body.summary.headline, 'Platform engineer');

  // parseCompRange single-value + unparseable branches
  writeFileSync(p('config', 'profile.yml'), 'compensation:\n  target_range: "120K+"\n');
  r = await getJson('/api/profile');
  assert.equal(r.body.summary.comp_min_usd, 120000, 'single "120K+" folds to min, max null');
  assert.deepEqual(r.body.summary.target_roles, [], 'no roles → empty list');
  writeFileSync(p('config', 'profile.yml'), 'compensation:\n  target_range: "TBD"\n');
  r = await getJson('/api/profile');
  assert.equal(r.body.summary.comp_min_usd, null);
});

test('GET /api/profile: legacy schema wins when both blocks exist; broken YAML → 500', async () => {
  writeFileSync(p('config', 'profile.yml'), 'candidate:\n  full_name: Legacy Name\nfull_name: Canonical Name\n');
  let r = await getJson('/api/profile');
  assert.equal(r.body.summary.full_name, 'Legacy Name');
  assert.deepEqual(r.body.summary.archetypes, []);
  writeFileSync(p('config', 'profile.yml'), 'candidate: [unclosed\n');
  r = await getJson('/api/profile');
  assert.equal(r.status, 500);
});

// ─── Profile field-form merge (PUT /api/profile {fields|arrays}) ───

test('PUT /api/profile: unknown field/array paths are refused (400)', async () => {
  let r = await jsonReq('PUT', '/api/profile', { fields: { 'evil.path': 'x' } });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /unknown profile field path/);
  r = await jsonReq('PUT', '/api/profile', { arrays: { 'not.a.spec': [] } });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /unknown profile array path/);
});

test('PUT /api/profile: a corrupt existing profile.yml blocks the merge with 409', async () => {
  writeFileSync(p('config', 'profile.yml'), 'candidate: [broken\n');
  const r = await jsonReq('PUT', '/api/profile', { fields: { 'candidate.full_name': 'Jane' } });
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /not valid YAML/);
  rmSync(p('config', 'profile.yml'));
});

test('PUT /api/profile: field merge requires a full name; a cleared field is deleted, not emptied', async () => {
  writeFileSync(p('config', 'profile.yml'), 'candidate:\n  full_name: Jane\n  phone: "+49 170 1"\n');
  let r = await jsonReq('PUT', '/api/profile', { fields: { 'candidate.phone': '' } });
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'fields');
  const raw = readFileSync(p('config', 'profile.yml'), 'utf8');
  assert.ok(!/phone/.test(raw), 'cleared leaf removed');
  assert.match(raw, /full_name: Jane/, 'siblings untouched');

  rmSync(p('config', 'profile.yml'));
  r = await jsonReq('PUT', '/api/profile', { fields: { 'candidate.email': 'x@y.z' } });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /full name is required/);
});

test('PUT /api/profile: array merge — string specs trim/filter, object specs drop unknown keys and junk rows', async () => {
  rmSync(p('config', 'profile.yml'), { force: true });
  const r = await jsonReq('PUT', '/api/profile', {
    fields: { 'candidate.full_name': 'Jane' },
    arrays: {
      'target_roles.primary': ['Backend', '   ', 'Frontend'],
      'target_roles.archetypes': [{ name: 'IC', level: 'senior', fit: 'primary', junk: 'drop' }, 'junk-string', null, { name: '', level: '' }],
    },
  });
  assert.equal(r.status, 200);
  const stored = readFileSync(p('config', 'profile.yml'), 'utf8');
  assert.match(stored, /- Backend\n    - Frontend/s);
  assert.match(stored, /level: senior/);
  assert.ok(!/junk|drop/.test(stored), 'unknown keys and non-object rows never land');
  // An emptied list removes the leaf entirely (round-trip cleanliness).
  const r2 = await jsonReq('PUT', '/api/profile', { arrays: { 'target_roles.primary': [] } });
  assert.equal(r2.status, 200);
  assert.ok(!/Frontend/.test(readFileSync(p('config', 'profile.yml'), 'utf8')));
});

test('PUT /api/profile: an oversized merged profile → 413', async () => {
  rmSync(p('config', 'profile.yml'), { force: true });
  const r = await jsonReq('PUT', '/api/profile', { fields: { 'candidate.full_name': 'Jane', 'narrative.headline': 'x'.repeat(270000) } });
  assert.equal(r.status, 413);
});

// ─── Profile raw-YAML path ───

test('PUT /api/profile raw: body shapes, YAML errors, non-mappings and missing names → 400/413', async () => {
  let r = await jsonReq('PUT', '/api/profile', {});
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /yaml body required/);
  r = await jsonReq('PUT', '/api/profile', { yaml: 'x'.repeat(256 * 1024 + 1) });
  assert.equal(r.status, 413);
  r = await jsonReq('PUT', '/api/profile', { yaml: 'a: [unclosed' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /invalid YAML/);
  r = await jsonReq('PUT', '/api/profile', { yaml: '- just\n- a list\n' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /YAML mapping/);
  // Neither block at all → 400. (A candidate OBJECT without full_name is a
  // separate gap — see the skipped finding pin below.)
  r = await jsonReq('PUT', '/api/profile', { yaml: 'target_roles:\n  primary:\n    - Backend Engineer\n' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /full_name is required/);
});

// FINDING (reported, not fixed — tests-only task): the 400 above only fires
// when `candidate` is MISSING entirely. A candidate OBJECT without a
// full_name (`candidate: {email: x}`) passes `hasCandidate` and saves with
// `full_name: null` — contradicting the route's own error message ("profile.
// candidate.full_name OR top-level full_name is required") and the stricter
// fields-merge gate (`typeof base.candidate.full_name === 'string' && trim`).
// content.mjs PUT /api/profile raw path, hasCandidate check. Skipped pin of
// the intended behaviour; flip to assert.equal(…, 400) when tightened.
test('PUT /api/profile raw: a candidate block WITHOUT full_name is refused (fixed: raw gate holds the fields-merge line)', async () => {
  const r = await jsonReq('PUT', '/api/profile', { yaml: 'candidate:\n  email: x\n' });
  assert.equal(r.status, 400);
});

test('PUT /api/profile raw: success stamps a header (or preserves a leading comment) and summarizes', async () => {
  let r = await jsonReq('PUT', '/api/profile', { yaml: 'candidate:\n  full_name: Jane\n' });
  let body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.candidate, 'Jane');
  assert.match(readFileSync(p('config', 'profile.yml'), 'utf8'), /^# Career-Ops Profile Configuration\n/);

  r = await jsonReq('PUT', '/api/profile', { yaml: '# my comment\ncandidate:\n  full_name: Jane\n' });
  await r.json();
  assert.match(readFileSync(p('config', 'profile.yml'), 'utf8'), /^# my comment/, 'a leading comment survives, no header stamped');
});

// ─── Portals ───

test('GET /api/portals: missing → null; valid → parsed + raw; broken → 500', async () => {
  rmSync(p('portals.yml'), { force: true });
  let r = await getJson('/api/portals');
  assert.deepEqual(r.body, { portals: null });
  writeFileSync(p('portals.yml'), 'tracked_companies:\n  - company: acme\n');
  r = await getJson('/api/portals');
  assert.equal(r.body.raw, 'tracked_companies:\n  - company: acme\n');
  assert.equal(r.body.portals.tracked_companies[0].company, 'acme');
  writeFileSync(p('portals.yml'), 'a: [broken');
  r = await getJson('/api/portals');
  assert.equal(r.status, 500);
  writeFileSync(p('portals.yml'), 'tracked_companies: []\n');
});

// ─── Modes list + _profile ───

test('GET /api/modes: missing dir → []; a dir lists only .md names', async () => {
  rmSync(p('modes'), { recursive: true, force: true });
  assert.deepEqual((await getJson('/api/modes')).body, { modes: [] });
  mkdirSync(p('modes'), { recursive: true });
  writeFileSync(p('modes', 'oferta.md'), 'x');
  writeFileSync(p('modes', 'notes.txt'), 'x');
  const list = (await getJson('/api/modes')).body.modes;
  assert.deepEqual(list.sort(), ['oferta']);
});

test('GET /api/modes/_profile: scaffold chain — neither file → inline scaffold; template → template', async () => {
  rmSync(p('modes', '_profile.md'), { force: true });
  rmSync(p('modes', '_profile.template.md'), { force: true });
  let r = await getJson('/api/modes/_profile');
  assert.equal(r.status, 200);
  assert.equal(r.body.scaffolded, true);
  assert.match(r.body.markdown, /Career framing/);
  assert.ok(r.body.sections.length >= 4, 'the inline scaffold already carries the section headings');
  assert.match(r.body.preamble, /Career framing/);

  writeFileSync(p('modes', '_profile.template.md'), '# Template framing\n\n## Target Roles\n\n- dev\n');
  r = await getJson('/api/modes/_profile');
  assert.equal(r.body.markdown, '# Template framing\n\n## Target Roles\n\n- dev\n');
  assert.equal(r.body.scaffolded, true);
  assert.equal(r.body.sections.length, 1);
  assert.equal(r.body.sections[0].heading, 'Target Roles');
});

test('GET /api/modes/_profile: an existing _profile.md wins and is split into sections', async () => {
  writeFileSync(p('modes', '_profile.md'), 'Preamble text.\n\n## Target Roles\n\n- dev\n\n## Exit Narrative\n\nstory\n');
  const r = await getJson('/api/modes/_profile');
  assert.equal(r.body.scaffolded, false);
  assert.equal(r.body.preamble, 'Preamble text.\n\n');
  assert.deepEqual(r.body.sections.map((s) => s.heading), ['Target Roles', 'Exit Narrative']);
});

test('PUT /api/modes/_profile sections: unknown heading → 400 (add via raw instead)', async () => {
  rmSync(p('modes', '_profile.md'), { force: true });
  rmSync(p('modes', '_profile.template.md'), { force: true });
  const r = await jsonReq('PUT', '/api/modes/_profile', { sections: { 'No Such Section': 'x' } });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /unknown _profile\.md section/);
});

test('PUT /api/modes/_profile sections: merge-not-replace, sanitized, other sections byte-intact', async () => {
  writeFileSync(p('modes', '_profile.md'), '## Target Roles\n\n- dev\n\n## Exit Narrative\n\nstory<script>x</script>\n');
  const r = await jsonReq('PUT', '/api/modes/_profile', { sections: { 'Target Roles': '- engineer\n- platform\n' } });
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.mode, 'sections');
  assert.equal(body.sanitized, true);
  const stored = readFileSync(p('modes', '_profile.md'), 'utf8');
  assert.match(stored, /- engineer\n- platform\n/);
  assert.match(stored, /story/);
  assert.ok(!/<script/i.test(stored));
  assert.match(stored, /## Exit Narrative/, 'sibling section preserved');
});

test('PUT /api/modes/_profile sections: an oversized merged result → 413', async () => {
  writeFileSync(p('modes', '_profile.md'), '## Target Roles\n\n- dev\n');
  const r = await jsonReq('PUT', '/api/modes/_profile', { sections: { 'Target Roles': 'x'.repeat(260 * 1024) } });
  assert.equal(r.status, 413);
  assert.match((await r.json()).error, /too large/);
});

test('PUT /api/modes/_profile raw: non-string → 400; oversized → 413; sanitize + bytes round-trip', async () => {
  let r = await jsonReq('PUT', '/api/modes/_profile', { markdown: 7 });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /markdown body required/);
  r = await jsonReq('PUT', '/api/modes/_profile', { markdown: 'x'.repeat(256 * 1024 + 1) });
  assert.equal(r.status, 413);
  r = await jsonReq('PUT', '/api/modes/_profile', { markdown: '# Modes\n<script>x</script>' });
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.sanitized, true);
  assert.ok(!/<script/i.test(readFileSync(p('modes', '_profile.md'), 'utf8')));
});

test('GET /api/modes/:name: invalid name → 400; missing → 404; existing → text/plain', async () => {
  let r = await fetch(`${baseUrl}/api/modes/${encodeURIComponent('###')}`);
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /invalid mode name/);
  r = await fetch(`${baseUrl}/api/modes/nowhere`);
  assert.equal(r.status, 404);
  writeFileSync(p('modes', 'oferta.md'), 'mode body');
  r = await fetch(`${baseUrl}/api/modes/oferta`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/plain/);
  assert.equal(await r.text(), 'mode body');
});

// ─── Networking ───

test('POST /api/networking/plan: no company → 400', async () => {
  const r = await jsonReq('POST', '/api/networking/plan', {});
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /company is required/);
});

test('POST /api/networking/plan: manual mode — prompt carries company/role/jd and the locale line', async () => {
  let r = await jsonReq('POST', '/api/networking/plan', { company: 'Acme' });
  let body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.mode, 'manual');
  assert.match(body.prompt, /networking plan.*Acme/s);
  assert.match(body.message, /copy this prompt into any LLM/);   // no keys → honest no-key message
  assert.equal(body.markdown, undefined, 'no live run → no markdown');

  r = await jsonReq('POST', '/api/networking/plan', { company: 'Acme', role: 'Backend', jd: 'A real JD body', lang: 'ru' });
  body = await r.json();
  assert.match(body.prompt, /role of "Backend"/);
  assert.match(body.prompt, /JOB DESCRIPTION:\nA real JD body/);
  assert.match(body.prompt, /Respond in the candidate's language \(ru\)/);

  r = await jsonReq('POST', '/api/networking/plan', { company: 'Acme', lang: 'en' });
  assert.ok(!/Respond in the candidate's language/.test((await r.json()).prompt), 'en adds no language line');
});

test('POST /api/networking/plan: run:true with no provider → honest manual fallback', async () => {
  const r = await jsonReq('POST', '/api/networking/plan', { company: 'Acme', run: true });
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.mode, 'manual');
  assert.match(body.message, /No provider available/);
});

test('POST /api/networking/save: validation → 400 on missing company / missing plan', async () => {
  let r = await jsonReq('POST', '/api/networking/save', {});
  assert.equal(r.status, 400);
  r = await jsonReq('POST', '/api/networking/save', { company: 'Acme', plan: '   ' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /plan is required/);
});

test('POST /api/networking/save: writes net-<slug>-<today>.md; a same-day re-save gets -2', async () => {
  rmSync(p('networking'), { recursive: true, force: true });
  let r = await jsonReq('POST', '/api/networking/save', { company: 'Acme', role: 'Backend', plan: '# Plan\n- contact the hiring manager' });
  let body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.name, `net-acme-backend-${today()}.md`);
  assert.ok(existsSync(p('networking', body.name)));

  r = await jsonReq('POST', '/api/networking/save', { company: 'Acme', role: 'Backend', plan: '# Plan v2' });
  assert.equal((await r.json()).name, `net-acme-backend-${today()}-2.md`);
});

test('POST /api/networking/save: an unslugifiable company falls back to the "plan" slug', async () => {
  const r = await jsonReq('POST', '/api/networking/save', { company: '!!!', plan: 'x' });
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.name, `net-plan-${today()}.md`);
});

test('POST /api/networking/save: 100 same-day collisions → 409 (write-exclusive ladder exhausted)', async () => {
  mkdirSync(p('networking'), { recursive: true });
  const base = `net-batch-${today()}`;
  writeFileSync(p('networking', `${base}.md`), 'x');
  for (let i = 2; i <= 100; i++) writeFileSync(p('networking', `${base}-${i}.md`), 'x');
  const r = await jsonReq('POST', '/api/networking/save', { company: 'Batch', plan: 'x' });
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /too many plans/);
});

test('POST /api/networking/save: an unwritable networking/ dir → 500 fail-soft', async () => {
  rmSync(p('networking'), { recursive: true, force: true });
  writeFileSync(p('networking'), 'a FILE where the dir should be — mkdirSync throws');
  const r = await jsonReq('POST', '/api/networking/save', { company: 'Doomed', plan: 'x' });
  assert.equal(r.status, 500);
  assert.match((await r.json()).error, /failed to save plan/);
  rmSync(p('networking'), { force: true });
});

test('GET /api/networking/plans: newest first; a missing dir → []', async () => {
  mkdirSync(p('networking'), { recursive: true });
  for (const n of [`net-acme-backend-${today()}.md`, `net-acme-backend-${today()}-2.md`, `net-plan-${today()}.md`, 'not-a-plan.md']) {
    writeFileSync(p('networking', n), 'x');
  }
  const listed = await getJson('/api/networking/plans');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.plans.length, 3, 'only net-*.md entries are listed');
  const names = listed.body.plans.map((x) => x.name);
  for (const expected of [`net-acme-backend-${today()}.md`, `net-acme-backend-${today()}-2.md`, `net-plan-${today()}.md`]) {
    assert.ok(names.includes(expected), `lists ${expected}`);
  }
  assert.ok(listed.body.plans[0].mtime >= listed.body.plans[listed.body.plans.length - 1].mtime, 'sorted newest first');
  rmSync(p('networking'), { recursive: true, force: true });
  assert.deepEqual((await getJson('/api/networking/plans')).body, { plans: [] });
});

test('GET /api/networking/plans/:name: invalid → 400; missing → 404; saved plan reads back cleaned', async () => {
  mkdirSync(p('networking'), { recursive: true });
  let r = await fetch(`${baseUrl}/api/networking/plans/${encodeURIComponent('###')}`);
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /invalid name/);
  r = await fetch(`${baseUrl}/api/networking/plans/net-nope-2020-01-01.md`);
  assert.equal(r.status, 404);

  await jsonReq('POST', '/api/networking/save', { company: 'Readme', plan: 'Contact the platform lead.' });
  const name = `net-readme-${today()}.md`;
  r = await fetch(`${baseUrl}/api/networking/plans/${name}`);
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.name, name);
  assert.match(body.markdown, /# Networking plan — Readme/);
  assert.match(body.markdown, /Contact the platform lead\./);
});

test('DELETE /api/networking/plans/:name: invalid → 400; missing → 404; existing removes the file', async () => {
  let r = await fetch(`${baseUrl}/api/networking/plans/${encodeURIComponent('###')}`, { method: 'DELETE' });
  assert.equal(r.status, 400);
  r = await fetch(`${baseUrl}/api/networking/plans/net-nope-2020-01-01.md`, { method: 'DELETE' });
  assert.equal(r.status, 404);
  const name = `net-delme-${today()}.md`;
  await jsonReq('POST', '/api/networking/save', { company: 'Delme', plan: 'x' });
  r = await fetch(`${baseUrl}/api/networking/plans/${name}`, { method: 'DELETE' });
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.deleted, name);
  assert.equal(existsSync(p('networking', name)), false);
});
