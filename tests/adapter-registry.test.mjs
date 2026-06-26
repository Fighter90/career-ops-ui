/**
 * v1.13.0 — adapter registry. Smoke test for the resolver: each known
 * ATS detects from `careers_url`, builds the right endpoint, and the
 * existing `detectApi()` keeps returning the same shape it always did.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveAdapter, ALL_ADAPTERS } from '../server/lib/portals/registry.mjs';

test('registry: every adapter has the required contract', () => {
  for (const a of ALL_ADAPTERS) {
    assert.ok(a.id, 'adapter must have id');
    assert.ok(a.label, 'adapter must have label');
    assert.equal(typeof a.matches, 'function', `${a.id}.matches must be a function`);
    assert.equal(typeof a.buildEndpoint, 'function', `${a.id}.buildEndpoint must be a function`);
    assert.equal(typeof a.fetch, 'function', `${a.id}.fetch must be a function`);
  }
});

test('registry: resolveAdapter matches Greenhouse via careers_url', () => {
  const m = resolveAdapter({ name: 'Anthropic', careers_url: 'https://job-boards.greenhouse.io/anthropic' });
  assert.ok(m);
  assert.equal(m.adapter.id, 'greenhouse');
  assert.equal(m.endpoint, 'https://boards-api.greenhouse.io/v1/boards/anthropic/jobs');
});

test('registry: resolveAdapter matches Ashby via careers_url + adds compensation flag', () => {
  const m = resolveAdapter({ name: 'Linear', careers_url: 'https://jobs.ashbyhq.com/linear' });
  assert.ok(m);
  assert.equal(m.adapter.id, 'ashby');
  assert.match(m.endpoint, /api\.ashbyhq\.com\/posting-api\/job-board\/linear\?includeCompensation=true/);
});

test('registry: resolveAdapter matches Lever via careers_url', () => {
  const m = resolveAdapter({ name: 'JetBrains', careers_url: 'https://jobs.lever.co/jetbrains' });
  assert.ok(m);
  assert.equal(m.adapter.id, 'lever');
  assert.equal(m.endpoint, 'https://api.lever.co/v0/postings/jetbrains');
});

test('registry: resolveAdapter prefers explicit `api:` field over URL detection', () => {
  const m = resolveAdapter({
    name: 'Stripe',
    careers_url: 'https://stripe.com/jobs',
    api: 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs',
  });
  assert.equal(m.adapter.id, 'greenhouse');
  assert.equal(m.endpoint, 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs');
});

test('registry: resolveAdapter returns null when no adapter matches', () => {
  const m = resolveAdapter({ name: 'CustomCo', careers_url: 'https://customco.example.com/careers' });
  assert.equal(m, null);
});

// ─── v1.14.0 — three new ATS adapters ───

test('registry: Workable via apply.workable.com/<slug>', () => {
  const m = resolveAdapter({ name: 'Foo', careers_url: 'https://apply.workable.com/foo-corp/' });
  assert.equal(m.adapter.id, 'workable');
  assert.equal(m.endpoint, 'https://apply.workable.com/api/v3/accounts/foo-corp/jobs?details=true');
});

test('registry: Workable via legacy <subdomain>.workable.com', () => {
  const m = resolveAdapter({ name: 'Foo', careers_url: 'https://foocorp.workable.com/careers' });
  assert.equal(m.adapter.id, 'workable');
  assert.match(m.endpoint, /accounts\/foocorp\/jobs/);
});

test('registry: SmartRecruiters via jobs.smartrecruiters.com/<slug>', () => {
  const m = resolveAdapter({ name: 'Bar', careers_url: 'https://jobs.smartrecruiters.com/BarCorp' });
  assert.equal(m.adapter.id, 'smartrecruiters');
  assert.equal(m.endpoint, 'https://api.smartrecruiters.com/v1/companies/BarCorp/postings');
});

test('registry: SmartRecruiters via careers.smartrecruiters.com/<slug>', () => {
  const m = resolveAdapter({ name: 'Bar', careers_url: 'https://careers.smartrecruiters.com/BarCorp/jobs' });
  assert.equal(m.adapter.id, 'smartrecruiters');
});

test('registry: Workday via <tenant>.wd5.myworkdayjobs.com/...', () => {
  const m = resolveAdapter({
    name: 'BigCo',
    careers_url: 'https://bigco.wd5.myworkdayjobs.com/en-US/External',
  });
  assert.equal(m.adapter.id, 'workday');
  assert.equal(m.endpoint, 'https://bigco.wd5.myworkdayjobs.com/wday/cxs/bigco/External/jobs');
});

test('registry: Workday defaults site=External when careers_url omits site', () => {
  const m = resolveAdapter({
    name: 'BigCo',
    careers_url: 'https://bigco.wd1.myworkdayjobs.com/en-US',
  });
  assert.equal(m.adapter.id, 'workday');
  assert.match(m.endpoint, /\/wday\/cxs\/bigco\/External\/jobs$/);
});

test('registry: ALL_ADAPTERS has the expected entries', async () => {
  const { ALL_ADAPTERS } = await import('../server/lib/portals/registry.mjs');
  assert.equal(ALL_ADAPTERS.length, 20);
  const ids = ALL_ADAPTERS.map((a) => a.id).sort();
  assert.deepEqual(ids, [
    'arbeitsagentur', 'ashby', 'bamboohr', 'breezy', 'comeet', 'glints',
    'greenhouse', 'ibm', 'jobstreet', 'lever', 'personio', 'recruitee',
    'remoteok', 'remotive', 'rss', 'smartrecruiters', 'solidjobs', 'workable',
    'workday', 'workingnomads',
  ]);
});

test('registry: detectApi (legacy shape) still returns { type, url }', async () => {
  const { detectApi } = await import('../server/lib/en-scanner.mjs');
  const d = detectApi({ name: 'Anthropic', careers_url: 'https://job-boards.greenhouse.io/anthropic' });
  assert.deepEqual(d, {
    type: 'greenhouse',
    url: 'https://boards-api.greenhouse.io/v1/boards/anthropic/jobs',
  });
});
