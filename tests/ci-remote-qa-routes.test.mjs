/**
 * scripts/remote-qa/targets.mjs — what the prod regression visits and
 * where it is allowed to send the basic-auth credentials. Pure functions
 * over in-memory sources, plus one pass over the real public/js tree
 * (read-only, no browser, no network).
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let t;
before(async () => { t = await import(ROOT + '/scripts/remote-qa/targets.mjs'); });

test('routesFromSources takes literal register() routes and drops the 404 view', () => {
  const r = t.routesFromSources([
    "Router.register('dashboard', render); Router.register('__not_found__', nf);",
    "register('scan', x)",
  ]);
  assert.deepEqual(r, ['dashboard', 'scan']);
});

test('routesFromSources also takes the slugs of config-driven mode routes', () => {
  const modePage = `
    const MODES = [
      { slug: 'project', serverSlug: 'project' },
      { slug: 'batch-prompt', serverSlug: 'batch' },
    ];
    for (const cfg of MODES) {
      Router.register(cfg.slug, () => buildModeView(cfg));
    }`;
  assert.deepEqual(t.routesFromSources([modePage, "register('tracker', a)"]), ['batch-prompt', 'project', 'tracker']);
});

test('slugs in a file that does not register by cfg.slug are not routes', () => {
  assert.deepEqual(t.routesFromSources(["const x = { slug: 'not-a-route' };"]), []);
});

test('the real SPA yields the mode routes too', () => {
  const routes = t.discoverRoutes(ROOT);
  for (const r of ['dashboard', 'project', 'training', 'batch-prompt', 'interview-prep']) {
    assert.ok(routes.includes(r), `missing ${r}`);
  }
  assert.ok(!routes.includes('__not_found__'));
});

test('discoverLocales lists the dict files, honours an ONLY filter, skips aliases', () => {
  const all = t.discoverLocales(ROOT);
  assert.ok(all.includes('en') && all.includes('pt-BR'));
  assert.ok(!all.includes('aliases'));
  assert.deepEqual(t.discoverLocales(ROOT, ['ja', 'hi', 'nope']), ['hi', 'ja']);
});

test('requireNonEmpty refuses an empty target list instead of passing vacuously', () => {
  assert.throws(() => t.requireNonEmpty('routes', []), /no routes/);
  assert.deepEqual(t.requireNonEmpty('locales', ['en']), ['en']);
});

test('httpCredentialsFor pins the credentials to the base origin', () => {
  assert.equal(t.httpCredentialsFor('https://prod.example/', '', 'p'), undefined);
  const c = t.httpCredentialsFor('https://prod.example:8443/sub', 'u', 'p');
  assert.deepEqual(c, { username: 'u', password: 'p', origin: 'https://prod.example:8443', send: 'unauthorized' });
  assert.equal(t.httpCredentialsFor('https://prod.example', 'u', undefined).password, '');
  assert.throws(() => t.httpCredentialsFor('not a url', 'u', 'p'), /BASE_URL/);
});
