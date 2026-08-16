/**
 * discover-ats resolver — pure + network-seam unit tests. CI-isolated: no live
 * network (the SSRF-safe safeGet is injected via `deps.safeGet`), no parent
 * project (nothing reads PATHS here). Never binds a port.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveSlugs,
  buildProbeUrl,
  discoverAts,
  renderPortalEntry,
  insertIntoTrackedCompanies,
  isDuplicateCompany,
  KNOWN_CAREERS_HOSTS,
} from '../server/lib/discover-ats.mjs';

// A safeGet stub keyed by the ATS API hostname. Unlisted hosts → 404.
function stubByHost(map) {
  return async (url) => {
    const u = new URL(url);
    const e = map[u.hostname];
    if (!e) return { status: 404, text: '', finalUrl: url };
    return { status: e.status ?? 200, text: e.text ?? '', finalUrl: e.finalUrl ?? url };
  };
}
const GH_JOBS = JSON.stringify({ jobs: [{ id: 1, title: 'Engineer', location: { name: 'London' } }] });
const ASHBY_JOBS = JSON.stringify({ jobs: [{ id: 'a1', title: 'Engineer' }] });
const LEVER_JOBS = JSON.stringify([{ id: 'l1', text: 'Engineer', categories: { location: 'Remote' } }]);

// ── slug generation ─────────────────────────────────────────────────────
test('deriveSlugs: hyphenated + concatenated forms, deduped', () => {
  assert.deepEqual(deriveSlugs('Trade Republic'), ['trade-republic', 'traderepublic']);
  assert.deepEqual(deriveSlugs('Adyen'), ['adyen']); // both forms collapse → 1
  assert.deepEqual(deriveSlugs('  N8N!  '), ['n8n']);
  assert.deepEqual(deriveSlugs('Foo/Bar'), ['foo-bar', 'foobar']);
  assert.deepEqual(deriveSlugs('   '), []);
  assert.deepEqual(deriveSlugs(''), []);
});

test('deriveSlugs output always passes the strict SLUG_RE (no dots/slashes/traversal)', () => {
  for (const name of ['Acme.io', 'A/B', 'Föö Bär', '../etc']) {
    for (const slug of deriveSlugs(name)) {
      assert.match(slug, /^[a-z0-9-]+$/, `slug "${slug}" from "${name}"`);
      assert.ok(!slug.includes('..'));
    }
  }
});

// ── fixed-host probe URL (SSRF choke point) ─────────────────────────────
test('buildProbeUrl: builds fixed-host careers_url, rejects unsafe slugs', () => {
  const gh = { host: 'job-boards.greenhouse.io', buildCareersUrl: (s) => `https://job-boards.greenhouse.io/${s}` };
  assert.equal(buildProbeUrl(gh, 'adyen'), 'https://job-boards.greenhouse.io/adyen');
  assert.equal(buildProbeUrl(gh, 'a/b'), null);       // slash → rejected by SLUG_RE
  assert.equal(buildProbeUrl(gh, '..'), null);        // traversal → rejected
  assert.equal(buildProbeUrl(gh, 'a.b'), null);       // dot → rejected
  assert.equal(buildProbeUrl(gh, 'evil@x'), null);    // @ → rejected (can't smuggle a host)
});

test('KNOWN_CAREERS_HOSTS exposes exactly the 3 fixed vendor hosts', () => {
  assert.deepEqual([...KNOWN_CAREERS_HOSTS].sort(),
    ['job-boards.greenhouse.io', 'jobs.ashbyhq.com', 'jobs.lever.co']);
});

// ── discoverAts (network seam) ──────────────────────────────────────────
test('discoverAts: Greenhouse board with ≥1 job → resolved', async () => {
  const stub = stubByHost({ 'boards-api.greenhouse.io': { text: GH_JOBS } });
  const out = await discoverAts('Adyen', { safeGet: stub });
  assert.equal(out.results.length, 1);
  assert.equal(out.results[0].vendor, 'greenhouse');
  assert.equal(out.results[0].careers_url, 'https://job-boards.greenhouse.io/adyen');
  assert.ok(out.results[0].jobCount >= 1);
});

test('discoverAts: no vendor resolves → empty results', async () => {
  const out = await discoverAts('Adyen', { safeGet: stubByHost({}) }); // everything 404
  assert.deepEqual(out.results, []);
});

test('discoverAts: a board that exists but lists 0 jobs does NOT resolve', async () => {
  const stub = stubByHost({ 'boards-api.greenhouse.io': { text: JSON.stringify({ jobs: [] }) } });
  const out = await discoverAts('Adyen', { safeGet: stub });
  assert.deepEqual(out.results, []);
});

test('discoverAts: Ashby-only match is isolated to the Ashby vendor', async () => {
  const stub = stubByHost({ 'api.ashbyhq.com': { text: ASHBY_JOBS } });
  const out = await discoverAts('Adyen', { safeGet: stub });
  assert.equal(out.results.length, 1);
  assert.equal(out.results[0].vendor, 'ashby');
  assert.equal(out.results[0].careers_url, 'https://jobs.ashbyhq.com/adyen');
});

test('discoverAts: multiple vendors can each resolve', async () => {
  const stub = stubByHost({
    'boards-api.greenhouse.io': { text: GH_JOBS },
    'api.lever.co': { text: LEVER_JOBS },
  });
  const out = await discoverAts('Adyen', { safeGet: stub });
  const vendors = out.results.map((r) => r.vendor).sort();
  assert.deepEqual(vendors, ['greenhouse', 'lever']);
});

test('discoverAts: a cross-origin redirect landing is treated as NOT resolved', async () => {
  // safeGet followed a redirect off the fixed API origin.
  const stub = stubByHost({ 'boards-api.greenhouse.io': { text: GH_JOBS, finalUrl: 'https://login.evil.com/sso' } });
  const out = await discoverAts('Adyen', { safeGet: stub });
  assert.deepEqual(out.results, []);
});

test('discoverAts: blank name → no probing, empty results', async () => {
  let calls = 0;
  const stub = async (u) => { calls += 1; return { status: 200, text: GH_JOBS, finalUrl: u }; };
  const out = await discoverAts('   ', { safeGet: stub });
  assert.deepEqual(out.results, []);
  assert.equal(calls, 0, 'must not fetch for a blank company name');
});

// ── portals.yml write helpers ────────────────────────────────────────
test('renderPortalEntry: name + careers_url + provider + enabled, no api line', () => {
  const s = renderPortalEntry({ name: 'Adyen', careers_url: 'https://job-boards.greenhouse.io/adyen', provider: 'greenhouse' });
  assert.match(s, /^\n {2}- name: Adyen\n/);
  assert.match(s, /careers_url: https:\/\/job-boards\.greenhouse\.io\/adyen/);
  assert.match(s, /provider: greenhouse/);
  assert.match(s, /enabled: true/);
  assert.ok(!/\bapi:/.test(s));
});

test('renderPortalEntry: quotes a name with a colon', () => {
  const s = renderPortalEntry({ name: 'Foo: Bar', careers_url: 'https://jobs.ashbyhq.com/foo' });
  assert.match(s, /name: "Foo: Bar"/);
});

test('insertIntoTrackedCompanies: splices before the next top-level key, preserving bytes', () => {
  const doc = 'tracked_companies:\n  - name: Existing\n    careers_url: https://jobs.lever.co/existing\n\ntitle_filter:\n  positive: [a]\n';
  const snippet = renderPortalEntry({ name: 'New', careers_url: 'https://jobs.lever.co/new' });
  const out = insertIntoTrackedCompanies(doc, [snippet]);
  assert.ok(out.indexOf('- name: New') > out.indexOf('tracked_companies:'));
  assert.ok(out.indexOf('- name: New') < out.indexOf('title_filter:'));
  assert.ok(out.includes('- name: Existing'));
});

test('insertIntoTrackedCompanies: appends a fresh block when the header is missing', () => {
  const out = insertIntoTrackedCompanies('title_filter:\n  positive: [a]\n', [renderPortalEntry({ name: 'New', careers_url: 'https://jobs.lever.co/new' })]);
  assert.match(out, /tracked_companies:/);
  assert.ok(out.includes('- name: New'));
});

test('isDuplicateCompany: matches by name (case-insensitive) or careers_url (normalized)', () => {
  const existing = [{ name: 'Adyen', careers_url: 'https://job-boards.greenhouse.io/adyen/' }];
  assert.equal(isDuplicateCompany(existing, 'adyen', 'https://x'), true);       // name hit
  assert.equal(isDuplicateCompany(existing, 'Other', 'https://job-boards.greenhouse.io/adyen'), true); // url hit (trailing slash normalized)
  assert.equal(isDuplicateCompany(existing, 'Fresh', 'https://jobs.lever.co/fresh'), false);
  assert.equal(isDuplicateCompany([], 'Any', 'https://x'), false);
});
