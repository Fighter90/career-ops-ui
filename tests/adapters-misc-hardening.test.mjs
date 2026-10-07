/**
 * Misc adapter hardening (BACKLOG adapters-1 / adapters-2 leftovers).
 *
 *   • gem: the opt-in REST mode (api.gem.com/job_board/v0/<board>/job_posts)
 *     was unreachable through the adapter — boardId() required jobs.gem.com —
 *     and matches() had two identical branches.
 *   • generalist-world: buildEndpoint fell back to careers_url, so an on-host
 *     homepage rode into the fetch slot and the parser threw (fail-loud).
 *   • ibm / arbeitsagentur: `company.api` was returned unpinned and the
 *     sources do no host assert of their own → pin https + exact host.
 *   • hecklerkoch: any *.heckler-koch.com subdomain was claimed, but only
 *     www serves the vacancy list (karriere.* is the apply backend, 404s).
 *   • rippling: `provider:` + a `rippling:` config block matched while
 *     buildEndpoint needed a URL slug — a dead pin (the source never reads it).
 *   • solidjobs: the docblock claimed a provider match that matches() never
 *     implemented — fix the docblock, and refuse garbage input instead of
 *     throwing.
 *   • jibeapply: the docblock example (branded domain, no explicit api:)
 *     resolved to null — the example now shows the explicit api: it needs.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with cv.md, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir;
let resolveAdapter;
let gem, generalistWorld, ibm, arbeitsagentur, hecklerkoch, rippling, solidjobs, jibeapply;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'adapters-misc-'));
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ resolveAdapter } = await import('../server/lib/portals/registry.mjs'));
  const A = '../server/lib/portals/adapters/';
  ({ gemAdapter: gem } = await import(A + 'gem.mjs'));
  ({ generalistWorldAdapter: generalistWorld } = await import(A + 'generalist-world.mjs'));
  ({ ibmAdapter: ibm } = await import(A + 'ibm.mjs'));
  ({ arbeitsagenturAdapter: arbeitsagentur } = await import(A + 'arbeitsagentur.mjs'));
  ({ hecklerkochAdapter: hecklerkoch } = await import(A + 'hecklerkoch.mjs'));
  ({ ripplingAdapter: rippling } = await import(A + 'rippling.mjs'));
  ({ solidjobsAdapter: solidjobs } = await import(A + 'solidjobs.mjs'));
  ({ jibeapplyAdapter: jibeapply } = await import(A + 'jibeapply.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

// ─── gem: REST mode reachable ─────────────────────────────────────────────

test('gem: an opt-in REST api pin is claimed and passed through', () => {
  const rest = 'https://api.gem.com/job_board/v0/acme/job_posts';
  assert.equal(gem.matches({ provider: 'gem', api: rest }), true);
  assert.equal(gem.buildEndpoint({ provider: 'gem', api: rest }), rest);
  const m = resolveAdapter({ name: 'G', provider: 'gem', api: rest });
  assert.equal(m.adapter.id, 'gem');
  assert.equal(m.endpoint, rest);
});

test('gem: REST is auto-detected from the api field without provider', () => {
  const rest = 'https://api.gem.com/job_board/v0/acme/job_posts';
  assert.equal(gem.matches({ api: rest }), true);
  assert.equal(gem.buildEndpoint({ api: rest }), rest);
});

test('gem: the SPA board path still builds the GraphQL endpoint', () => {
  assert.equal(gem.buildEndpoint({ provider: 'gem', careers_url: 'https://jobs.gem.com/acme' }),
    'https://jobs.gem.com/api/public/graphql/batch?board=acme');
});

test('gem: an explicit REST api wins over careers_url; a foreign api does not hide it', () => {
  const rest = 'https://api.gem.com/job_board/v0/acme/job_posts';
  const both = { api: rest, careers_url: 'https://jobs.gem.com/other' };
  assert.equal(gem.buildEndpoint(both), rest);
  const foreignApi = { api: 'https://api.gem.com/wrong', careers_url: 'https://jobs.gem.com/acme' };
  assert.equal(gem.buildEndpoint(foreignApi),
    'https://jobs.gem.com/api/public/graphql/batch?board=acme');
});

test('gem: nothing claimable → null endpoint, never a throw', () => {
  assert.equal(gem.matches(null), false);
  assert.doesNotThrow(() => gem.buildEndpoint(null));
  assert.equal(gem.buildEndpoint({ provider: 'gem' }), null);
  assert.equal(gem.buildEndpoint({ provider: 'gem', api: 'https://api.gem.com/wrong' }), null);
});

// ─── generalist-world: no careers_url fallback ────────────────────────────

test('generalist-world: an on-host careers_url never becomes the endpoint', () => {
  for (const careers_url of ['https://generalist.world/', 'https://generalist.world/about']) {
    assert.equal(generalistWorld.buildEndpoint({ provider: 'generalist-world', careers_url }),
      'https://generalist.world/jobs/', careers_url);
  }
});

test('generalist-world: a foreign override falls back to the canonical list URL', () => {
  assert.equal(generalistWorld.buildEndpoint({ provider: 'generalist-world', api: 'https://evil.example' }),
    'https://generalist.world/jobs/');
});

test('generalist-world: explicit on-host overrides still pass through', () => {
  const api = 'https://generalist.world/jobs/?mirror=1';
  assert.equal(generalistWorld.buildEndpoint({ provider: 'generalist-world', api }), api);
  assert.equal(generalistWorld.buildEndpoint({ 'generalist-world': api }), api);
});

test('generalist-world: auto-detection still claims the board’s own domain', () => {
  const entry = { careers_url: 'https://generalist.world/jobs/' };
  assert.equal(generalistWorld.matches(entry), true);
  assert.equal(generalistWorld.buildEndpoint(entry), 'https://generalist.world/jobs/');
});

// ─── ibm / arbeitsagentur: pinned api ─────────────────────────────────────

test('ibm: api is pinned to https://www-api.ibm.com', () => {
  const API_URL = 'https://www-api.ibm.com/search/api/v2';
  assert.equal(ibm.buildEndpoint({ provider: 'ibm' }), API_URL);
  assert.equal(ibm.buildEndpoint({ provider: 'ibm', api: 'https://169.254.169.254/latest' }), API_URL);
  assert.equal(ibm.buildEndpoint({ provider: 'ibm', api: 'http://www-api.ibm.com/search/api/v2' }), API_URL);
  assert.equal(ibm.buildEndpoint({ provider: 'ibm', api: 'https://www-api.ibm.com.evil.test/x' }), API_URL);
  assert.equal(ibm.buildEndpoint({ provider: 'ibm', api: {} }), API_URL);
  assert.equal(ibm.buildEndpoint({ provider: 'ibm', api: API_URL }), API_URL);
});

test('arbeitsagentur: api is pinned to https://rest.arbeitsagentur.de', () => {
  const API_URL = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs';
  assert.equal(arbeitsagentur.buildEndpoint({ provider: 'arbeitsagentur' }), API_URL);
  assert.equal(arbeitsagentur.buildEndpoint({ provider: 'arbeitsagentur', api: 'https://evil.example/x' }), API_URL);
  assert.equal(arbeitsagentur.buildEndpoint({ provider: 'arbeitsagentur', api: 'http://rest.arbeitsagentur.de/x' }), API_URL);
  assert.equal(arbeitsagentur.buildEndpoint({ provider: 'arbeitsagentur', api: 'https://rest.arbeitsagentur.de.evil.test/x' }), API_URL);
  assert.equal(arbeitsagentur.buildEndpoint({ provider: 'arbeitsagentur', api: 42 }), API_URL);
  assert.equal(arbeitsagentur.buildEndpoint({ provider: 'arbeitsagentur', api: API_URL }), API_URL);
});

// ─── hecklerkoch: only the list host is claimed ───────────────────────────

test('hecklerkoch: a karriere.* apply-backend URL is not claimed', () => {
  const entry = { careers_url: 'https://karriere.heckler-koch.com/jobposting/abc123' };
  assert.equal(hecklerkoch.matches(entry), false);
  assert.equal(hecklerkoch.buildEndpoint(entry), null);
});

test('hecklerkoch: the www list page (and the apex) still resolve', () => {
  const www = 'https://www.heckler-koch.com/de/Karriere/Stellenangebote';
  assert.equal(hecklerkoch.matches({ careers_url: www }), true);
  assert.equal(hecklerkoch.buildEndpoint({ careers_url: www }), www);
  assert.equal(hecklerkoch.buildEndpoint({ careers_url: 'https://heckler-koch.com/de/Karriere/Stellenangebote' }), www);
});

test('hecklerkoch: a provider-selected entry with an unusable URL gets the default', () => {
  assert.equal(
    hecklerkoch.buildEndpoint({ provider: 'hecklerkoch', careers_url: 'https://karriere.heckler-koch.com/x' }),
    'https://www.heckler-koch.com/de/Karriere/Stellenangebote',
  );
});

// ─── rippling: the `rippling:` block is not a dead pin ────────────────────

test('rippling: the `rippling:` config block is not a pin (source never reads it)', () => {
  // A URL is present but unusable — the removed `|| !!company.rippling` term
  // used to claim this entry while buildEndpoint had no slug for it.
  const entry = { provider: 'rippling', careers_url: 'https://bad.example/jobs', rippling: { slug: 'acme' } };
  assert.equal(rippling.matches(entry), false);
  assert.equal(rippling.buildEndpoint(entry), null);
});

test('rippling: a real tenant URL still matches and builds', () => {
  const entry = { careers_url: 'https://ats.rippling.com/acme-jobs/jobs' };
  assert.equal(rippling.matches(entry), true);
  assert.match(rippling.buildEndpoint(entry), /^https:\/\/ats\.rippling\.com\/api\/v2\/board\/acme-jobs\/jobs/);
});

// ─── solidjobs: provider is not (and is not documented as) a match ────────

test('solidjobs: a bare provider: solidjobs entry is no match (docblock is honest)', () => {
  const entry = { provider: 'solidjobs' };
  assert.equal(solidjobs.matches(entry), false);
  assert.equal(solidjobs.buildEndpoint(entry), null);
});

test('solidjobs: garbage input is refused, never thrown', () => {
  assert.equal(solidjobs.matches(null), false);
  assert.equal(solidjobs.buildEndpoint(null), null);
  assert.equal(solidjobs.buildEndpoint({ api: 42 }), null);
});

test('solidjobs: a real offers URL still matches', () => {
  const entry = { careers_url: 'https://solid.jobs/public-api/offers/it' };
  assert.equal(solidjobs.matches(entry), true);
  assert.equal(solidjobs.buildEndpoint(entry), 'https://solid.jobs/public-api/offers/it');
  assert.equal(solidjobs.buildEndpoint({ api: 'https://solid.jobs/public-api/offers/it' }),
    'https://solid.jobs/public-api/offers/it');
});

// ─── jibeapply: a branded domain needs the explicit api: ──────────────────

test('jibeapply: a branded careers_url without an explicit api: builds no endpoint', () => {
  // The docblock example used to promise exactly this shape works; it does
  // not — toApiUrl only accepts *.jibeapply.com hosts, so the example now
  // shows the explicit `api:` a branded tenant must wire.
  const entry = { provider: 'jibeapply', careers_url: 'https://jobs.globalpayments.com/en/jobs/' };
  assert.equal(jibeapply.matches(entry), true);
  assert.equal(jibeapply.buildEndpoint(entry), null);
  assert.equal(jibeapply.buildEndpoint({ ...entry, api: 'https://jobs.globalpayments.com/api/jobs' }),
    'https://jobs.globalpayments.com/api/jobs');
});
