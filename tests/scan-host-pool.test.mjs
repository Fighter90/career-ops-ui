import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// CAR-178 — host-pool port of the parent scan-ats-full pattern (upstream
// 5ef0676a "cap single-host ATS sweeps at their own concurrency" and the
// keyed hostname limiter that followed it): the scan's company pool may keep
// up to CONCURRENCY (32) fetches in flight, but any ONE ATS host never takes
// more than PER_HOST_CONCURRENCY (10) concurrent requests. Greenhouse, Lever
// and Ashby serve their ENTIRE directory from a single hostname
// (boards-api.greenhouse.io, api.lever.co, api.ashbyhq.com), so an uncapped
// pool would hold dozens of sustained connections to one API and earn an
// HTTP throttle — and a throttled board silently loses live postings.
//
// Everything else must be untouched by the port: quarantine, dedup, the
// title/location filters, snapshot safety (R-12), and the deterministic row
// order — results are collected by input index, so the saved snapshot is
// identical to a sequential run's, whatever the fetch completion order.

let runEnScan;
let createKeyedLimiter;

const GH_HOST = 'boards-api.greenhouse.io';
const ASH_HOST = 'api.ashbyhq.com';
const LEV_HOST = 'api.lever.co';

// Deterministic scramble: company i's fetch resolves after
// 8 + ((i*7) % 12) * 3 ms — a distinct delay per company, so the completion
// order never matches the portals.yml order.
const delayForCompany = (i) => 8 + ((i * 7) % 12) * 3;

function portalsCompanies() {
  return [...Array(12).keys()].map((i) => [
    `  - name: GH-Co${i}`,
    `    careers_url: https://job-boards.greenhouse.io/co${i}`,
    `    enabled: true`,
  ].join('\n'));
}

function portalsAshbyLever() {
  return [...Array(4).keys()].map((i) => [
    `  - name: ASH-Co${i}`,
    `    careers_url: https://jobs.ashbyhq.com/a${i}`,
    `    enabled: true`,
    `  - name: LEV-Co${i}`,
    `    careers_url: https://jobs.lever.co/l${i}`,
    `    enabled: true`,
  ].join('\n'));
}

function portalsMixed6() {
  return [...Array(3).keys()].map((i) => [
    `  - name: GH-Co${i}`,
    `    careers_url: https://job-boards.greenhouse.io/co${i}`,
    `    enabled: true`,
    `  - name: ASH-Co${i}`,
    `    careers_url: https://jobs.ashbyhq.com/a${i}`,
    `    enabled: true`,
  ].join('\n'));
}

function writePortals(dir, companyBlocks) {
  writeFileSync(resolve(dir, 'portals.yml'), `tracked_companies:\n${companyBlocks.join('\n')}\n`);
}

// A fetchImpl that resolves after a per-URL delay and records concurrency:
// global in-flight max, per-host in-flight max, and how many DISTINCT hosts
// were ever in flight at the same moment.
function makeTimedFetch({ delayFor }) {
  const m = {
    inFlight: 0,
    maxInFlight: 0,
    perHostNow: new Map(),
    perHostMax: new Map(),
    hostsNow: new Set(),
    maxOverlapHosts: 0,
  };
  const fetch = async (url) => {
    const host = new URL(url).hostname;
    m.inFlight += 1;
    m.maxInFlight = Math.max(m.maxInFlight, m.inFlight);
    const cur = (m.perHostNow.get(host) || 0) + 1;
    m.perHostNow.set(host, cur);
    m.perHostMax.set(host, Math.max(m.perHostMax.get(host) || 0, cur));
    m.hostsNow.add(host);
    m.maxOverlapHosts = Math.max(m.maxOverlapHosts, m.hostsNow.size);
    try {
      await new Promise((r) => setTimeout(r, delayFor(url)));
      return new Response(JSON.stringify(bodyFor(url)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    } finally {
      m.inFlight -= 1;
      const left = (m.perHostNow.get(host) || 0) - 1;
      m.perHostNow.set(host, left);
      if (left <= 0) m.hostsNow.delete(host);
    }
  };
  return { fetch, m };
}

// One job per board; the ATS slug sits at path index 2 on every host shape
// (after filter(Boolean) drops the leading empty segment):
//   boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true
//   api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true
//   api.lever.co/v0/postings/<slug>
function slugOf(url) {
  return new URL(url).pathname.split('/').filter(Boolean)[2] || '';
}

function bodyFor(url) {
  const u = new URL(url);
  const slug = slugOf(url);
  if (u.hostname === GH_HOST) {
    return {
      jobs: [{
        id: 1,
        title: 'Senior Platform Engineer',
        company_name: slug,
        absolute_url: `https://${slug}.example/1`,
        location: { name: 'Berlin' },
        offices: [],
        first_published: '2026-01-01',
      }],
    };
  }
  if (u.hostname === ASH_HOST) {
    return {
      jobs: [{
        id: `a-${slug}`,
        title: 'Platform Engineer',
        location: 'Berlin',
        isRemote: false,
        jobUrl: `https://${slug}.example/1`,
        publishedAt: '2026-01-01',
      }],
    };
  }
  if (u.hostname === LEV_HOST) {
    return [{
      id: `l-${slug}`,
      text: 'Platform Engineer',
      categories: { location: 'Berlin' },
      hostedUrl: `https://${slug}.example/1`,
    }];
  }
  throw new Error('unexpected host in test fetch: ' + url);
}

const idxFromSlug = (slug) => Number(String(slug).replace(/^\D+/, ''));

let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-host-pool-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writePortals(dir, portalsCompanies());
  process.env.CAREER_OPS_ROOT = dir;
  ({ runEnScan, createKeyedLimiter } = await import('../server/lib/en-scanner.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
});

// ───────────── (a) one host: 12 companies, ≤ 10 concurrent ─────────────

test('host pool: 12 companies on ONE host — ≤10 concurrent per host, 10-wide pool', async () => {
  const { fetch, m } = makeTimedFetch({ delayFor: (url) => delayForCompany(idxFromSlug(slugOf(url))) });
  const result = await runEnScan({ writeFiles: false, fetchImpl: fetch, onLog: () => {} });

  // All 12 boards answered: the port may reorder fetches, never lose them.
  assert.equal(result.counts.raw, 12, 'every board contributed its job');
  assert.equal(result.errors.length, 0, 'no errors: ' + JSON.stringify(result.errors));

  // Per-host contract: the shared Greenhouse API never sees more than 10
  // concurrent requests.
  assert.equal(m.perHostMax.get(GH_HOST), 10, 'exactly 10 slots in flight on the one host');
  assert.ok(m.maxInFlight <= 10, `global in-flight must respect the per-host cap (got ${m.maxInFlight})`);
  // The pool actually widened past the old global 8 — otherwise this port
  // buys nothing for the single-host case.
  assert.equal(m.maxInFlight, 10, 'the pool reaches 10 in flight (old global pool was 8)');
});

// ───────────── (b) different hosts: fully parallel ─────────────

test('host pool: companies on different hosts run in parallel (12 in flight, hosts overlap)', async () => {
  writePortals(dir, [...portalsCompanies().slice(0, 4), ...portalsAshbyLever()]);
  const { fetch, m } = makeTimedFetch({ delayFor: (url) => delayForCompany(idxFromSlug(slugOf(url))) });
  const result = await runEnScan({ writeFiles: false, fetchImpl: fetch, onLog: () => {} });

  assert.equal(result.counts.raw, 12, '4 GH + 4 ASH + 4 LEV boards');
  assert.equal(result.errors.length, 0);

  // Different ATS hosts are independent servers: all 12 run at once.
  assert.equal(m.maxInFlight, 12, `all 12 companies in flight (got ${m.maxInFlight})`);
  // …and distinct hosts really overlap in time.
  assert.ok(m.maxOverlapHosts >= 2, `distinct hosts overlapped in flight (got ${m.maxOverlapHosts})`);
  // Each host stayed within its own cap (4 ≤ 10 here — full parallelism).
  for (const h of [GH_HOST, ASH_HOST, LEV_HOST]) {
    assert.equal(m.perHostMax.get(h), 4, `${h} fully parallel at 4`);
  }
});

// ───────────── (c) snapshot identical to a sequential run ─────────────

test('host pool: snapshot rows deterministic — portals order, not completion order', async () => {
  writePortals(dir, portalsMixed6());
  const { fetch, m } = makeTimedFetch({ delayFor: (url) => delayForCompany(idxFromSlug(slugOf(url))) });
  const result = await runEnScan({ writeFiles: true, fetchImpl: fetch, onLog: () => {} });

  assert.equal(result.counts.raw, 6);
  assert.equal(result.errors.length, 0);
  const snap = JSON.parse(readFileSync(resolve(dir, 'data', 'last-scan.json'), 'utf8'));
  assert.ok(snap.en && Array.isArray(snap.en.filtered), 'snapshot.en.filtered written (nothing kept)');
  const expectedUrls = ['co0', 'a0', 'co1', 'a1', 'co2', 'a2'].map((s) => `https://${s}.example/1`);
  assert.deepEqual(
    snap.en.filtered.map((j) => j.url),
    expectedUrls,
    'filtered rows follow portals.yml order, not fetch completion order',
  );
  assert.deepEqual(
    snap.en.fresh.map((j) => j.url),
    expectedUrls,
    'fresh rows follow portals.yml order too',
  );
});

// ───────────── the limiter primitive itself ─────────────

test('createKeyedLimiter: ≤limit concurrent per key, parallel across keys, FIFO handoff', async () => {
  assert.equal(typeof createKeyedLimiter, 'function', 'createKeyedLimiter is exported');
  const withSlot = createKeyedLimiter(2);
  const perKeyNow = new Map();
  const perKeyMax = new Map();
  let globalNow = 0;
  let globalMax = 0;
  let completed = 0;
  const run = (key, ms) => withSlot(key, async () => {
    const cur = (perKeyNow.get(key) || 0) + 1;
    perKeyNow.set(key, cur);
    perKeyMax.set(key, Math.max(perKeyMax.get(key) || 0, cur));
    globalNow += 1;
    globalMax = Math.max(globalMax, globalNow);
    try {
      await new Promise((r) => setTimeout(r, ms));
    } finally {
      perKeyNow.set(key, perKeyNow.get(key) - 1);
      globalNow -= 1;
      completed += 1;
    }
  });
  // 3 tasks on h1 (2 admitted, 1 queued), 2 on h2 — independent keys.
  await Promise.all([run('h1', 15), run('h1', 15), run('h1', 15), run('h2', 5), run('h2', 5)]);
  assert.equal(completed, 5, 'every task ran exactly once');
  assert.equal(perKeyMax.get('h1'), 2, 'h1 never exceeds the limit');
  assert.equal(perKeyMax.get('h2'), 2, 'h2 full parallelism within its own limit');
  assert.equal(globalMax, 4, 'distinct keys run in parallel (2+2)');
  assert.equal(perKeyNow.get('h1') || 0, 0, 'no slot leak after the run');
  assert.equal(globalNow, 0, 'no global leak');
});
