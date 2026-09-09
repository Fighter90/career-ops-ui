/**
 * CONFIG-1 (v1.232.0) — `POST /api/config` must reject a select value that is
 * not in that field's own option list.
 *
 * The validator checked the key NAME against KNOWN_KEYS, the type, the length,
 * newlines, and the format of three specific keys — but never whether a value
 * belonged to the field's declared domain. So this returned 200:
 *
 *     {"LLM_PROVIDER":"not-a-provider"}  ->  {"ok":true,"written":["LLM_PROVIDER"]}
 *
 * and the garbage landed in the user's `.env`. Nothing errored afterwards: the
 * provider resolver fell back to whichever key was configured, so
 * `/api/status/providers` reported a working provider and the setting the user
 * actually chose silently had no effect. A misconfiguration that reports success
 * is worse than one that fails, because it surfaces much later — when the
 * fallback stops coinciding with intent.
 *
 * Two gates here:
 *   1. behaviour — for EVERY select field, a valid value writes, an invalid one
 *      is refused with the file left untouched, and the empty string still
 *      unsets the key (documented behaviour that must not regress);
 *   2. drift — the server's domains and the browser's `FIELDS` descriptors are
 *      two copies, so this fails if either side gains, loses or reorders a
 *      value, and if the key SETS diverge at all.
 *
 * CI-isolated: every write goes to a mkdtemp root, never the real project.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Evaluate the browser-side descriptor table in a vm (it is an IIFE on `window`). */
function loadClientFields() {
  const src = readFileSync(resolve(ROOT, 'public/js/views/config/field-specs.js'), 'utf8');
  const ctx = createContext({ window: {} });
  runInContext(src, ctx);
  const specs = ctx.window.ConfigFieldSpecs;
  if (!specs || !Array.isArray(specs.FIELDS)) {
    throw new Error('field-specs.js did not populate window.ConfigFieldSpecs.FIELDS');
  }
  // Cross-realm normalisation, and it is not cosmetic: values built inside a vm
  // carry THAT realm's Array.prototype, and `deepStrictEqual` compares
  // prototypes. Without this the assertions fail while printing two arrays that
  // look character-for-character identical — actual ['OPENROUTER_MODEL'],
  // expected ['OPENROUTER_MODEL']. Rebuild the descriptors as host-realm plain
  // objects so every later comparison is about content only.
  // `Array.from` is the HOST's, so it yields a host array; calling `.map` on
  // the vm array directly would just produce another vm array and change
  // nothing.
  return Array.from(specs.FIELDS, (f) => ({
    key: f.key,
    kind: f.kind,
    options: f.options ? Array.from(f.options) : undefined,
  }));
}

let server, baseUrl, envPath;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'cfg-domains-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, '.env'), '');
  process.env.CAREER_OPS_ROOT = dir;
  envPath = resolve(dir, '.env');
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); });
  });
});

after(async () => {
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
});

const post = async (body) => {
  const r = await fetch(`${baseUrl}/api/config`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const envText = () => readFileSync(envPath, 'utf8');

test('CONFIG-1: a closed-domain field accepts its own options and refuses anything else', async () => {
  const { LLM_PROVIDERS } = await import('../server/lib/env-config.mjs');
  // The only closed domain today. `LLM_PROVIDERS` has lived in env-config.mjs
  // all along — the validator simply never consulted it, which is the whole
  // defect. Enforcement reuses it rather than keeping a second copy.
  const closed = { LLM_PROVIDER: LLM_PROVIDERS };

  for (const key of Object.keys(closed)) {
    const options = closed[key];
    assert.ok(options.length > 0, `${key}: declared with an empty option list`);

    // A declared option is accepted and written.
    const ok = await post({ [key]: options[0] });
    assert.equal(ok.status, 200, `${key}: rejected its own first option "${options[0]}"`);
    assert.match(envText(), new RegExp(`^${key}=${options[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'),
      `${key}: accepted but not written to .env`);

    // Anything outside the domain is refused, and the file is left alone.
    const before = envText();
    const bad = await post({ [key]: '__not_in_list__' });
    assert.equal(bad.status, 400,
      `${key}: accepted "__not_in_list__" — a value outside its own option list must be a 400`);
    assert.ok(!('written' in bad.json), `${key}: a rejected request must not report anything written`);
    assert.equal(envText(), before, `${key}: .env changed despite the request being rejected`);

    // The empty string still unsets the key — documented behaviour, must not regress.
    const unset = await post({ [key]: '' });
    assert.equal(unset.status, 200, `${key}: the empty string must stay accepted (it unsets the key)`);
    assert.doesNotMatch(envText(), new RegExp(`^${key}=`, 'm'), `${key}: the empty string did not unset it`);
  }
});

test('CONFIG-1: the refusal names the field and lists what is allowed', async () => {
  const r = await post({ LLM_PROVIDER: 'not-a-provider' });
  assert.equal(r.status, 400);
  const msg = (r.json.details || []).join(' ');
  assert.match(msg, /LLM_PROVIDER/, 'the message must name the offending field');
  assert.match(msg, /openrouter/, 'the message must list the allowed values so the user can pick one');
});

test('CONFIG-1 drift: server domains and the browser descriptors stay identical', async () => {
  const { CURATED_DOMAINS, REMOTE_SELECT_KEYS } =
    await import('../server/lib/config-field-domains.mjs');
  const { LLM_PROVIDERS } = await import('../server/lib/env-config.mjs');
  const fields = loadClientFields();
  const all = { LLM_PROVIDER: LLM_PROVIDERS, ...CURATED_DOMAINS };

  const clientSelect = new Map(fields.filter((f) => f.kind === 'select').map((f) => [f.key, f.options]));
  assert.deepEqual(
    Object.keys(all).sort(), [...clientSelect.keys()].sort(),
    'the set of select fields differs between server/lib/config-field-domains.mjs and public/js/views/config/field-specs.js',
  );
  for (const [key, options] of clientSelect) {
    assert.deepEqual([...all[key]], [...options],
      `${key}: option list differs between server and browser (order included — the first entry is the default)`);
  }
  // The split itself is the contract: enforcing a curated model list would
  // block a model the vendor already serves, so it must stay unenforced.
  assert.ok(!('LLM_PROVIDER' in CURATED_DOMAINS),
    'LLM_PROVIDER is the closed domain and must not be duplicated into the curated lists');

  const clientRemote = fields.filter((f) => f.kind === 'select-remote').map((f) => f.key).sort();
  assert.deepEqual([...REMOTE_SELECT_KEYS].sort(), clientRemote,
    'select-remote fields differ; these are intentionally NOT membership-validated (the list is fetched at runtime)');
  for (const key of REMOTE_SELECT_KEYS) {
    assert.ok(!(key in CURATED_DOMAINS), `${key} is select-remote and must not carry a fixed list`);
  }
});

test('CONFIG-1 drift: every writable key has a descriptor the user can reach', async () => {
  const { KNOWN_KEYS } = await import('../server/lib/env-config.mjs');
  const fields = loadClientFields();
  const described = new Set(fields.map((f) => f.key));
  const undescribed = KNOWN_KEYS.filter((k) => !described.has(k));
  assert.deepEqual(undescribed, [],
    `these keys accept writes through POST /api/config but have no field in #/config, so they cannot be set from the UI: ${undescribed.join(', ')}`);
  const unknown = [...described].filter((k) => !KNOWN_KEYS.includes(k));
  assert.deepEqual(unknown, [], `these fields exist in the UI but the server refuses them: ${unknown.join(', ')}`);
});

/**
 * The config form resends every non-secret field on every Save, touched or not
 * (`public/js/views/config.js`: "Secrets: only send if user touched the field.
 * Non-secrets: always send."). So a strict check would freeze the page for
 * anyone whose .env predates it: their stored provider comes back on the wire
 * untouched and 400s the whole request, blocking every other setting too.
 * A browser test caught exactly that. Changes are still refused.
 */
test('CONFIG-1: an already-stored bad value is grandfathered, a new one is not', async () => {
  const { writeFileSync: write } = await import('node:fs');
  write(envPath, 'LLM_PROVIDER=legacy-typo\n');

  const resend = await post({ LLM_PROVIDER: 'legacy-typo', PORT: '4317' });
  assert.equal(resend.status, 200,
    'resending the value already on disk must be accepted, or the whole config page becomes unsaveable');
  assert.ok(resend.json.written.includes('PORT'), 'the other fields in the same Save must still be written');

  const change = await post({ LLM_PROVIDER: 'another-typo' });
  assert.equal(change.status, 400, 'a DIFFERENT out-of-domain value is still a change, and must be refused');

  const fix = await post({ LLM_PROVIDER: 'openrouter' });
  assert.equal(fix.status, 200, 'picking a real option from the dropdown must repair it');
  assert.match(readFileSync(envPath, 'utf8'), /^LLM_PROVIDER=openrouter$/m);
});
