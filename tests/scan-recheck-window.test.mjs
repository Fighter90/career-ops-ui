// scan_history.recheck_after_days — the web-ui scanners' seen set honours the
// recheck window (CAR-263, upstream #5905).
//
// portals.yml's `scan_history.recheck_after_days` lets an `added` (or
// `skipped_expired`) URL become eligible again after N days, for roles that
// reopen at the same URL. The web-ui scanners built their seen set with no
// policy, which reads as "dedup forever": a posting the user's window released
// stayed out of every later scan. The window now rides the shared
// collectSeenUrls(policy) both scanners feed, so one portals.yml gives one
// verdict. Ported from the parent's tests/scan-recheck-policy-siblings.test.mjs
// repro cases onto web-ui's seams (collectSeenUrls / shouldDedupScanHistoryRow /
// runEnScan over a temp CAREER_OPS_ROOT).
//
// CI-isolated: mkdtemp CAREER_OPS_ROOT, stub adapter, no network.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { normalizeUrl } from '../server/lib/url-key.mjs';

let dir;
let en;
let ALL_ADAPTERS;

const data = (f) => resolve(dir, 'data', f);
const writePortals = (lines) => writeFileSync(resolve(dir, 'portals.yml'), lines.join('\n'));
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date(`${today()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

const OLD = 'https://boards.greenhouse.io/acme/jobs/1001';
const FRESH = 'https://boards.greenhouse.io/acme/jobs/1002';
const REPEATED = 'https://boards.greenhouse.io/acme/jobs/1003';

const HISTORY_HEADER =
  'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\tfingerprint\tposted_at\ttrust_score\ttrust_flags\tnormalized_company\trequisition_id\tlanguage\tlisting_key';

const policy = (n) => ({ recheckAfterDays: n });

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-recheck-window-'));
  mkdirSync(dir, { recursive: true });
  mkdirSync(data(''), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  writePortals(['tracked_companies:', '  - { name: LangCo, provider: zz-recheck }']);
  process.env.CAREER_OPS_ROOT = dir;
  en = await import('../server/lib/en-scanner.mjs');
  ({ ALL_ADAPTERS } = await import('../server/lib/portals/registry.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  for (const f of readdirSync(data(''))) rmSync(data(f), { force: true });
});

// ── scanHistoryPolicy: the portals.yml parse ────────────────────────

test('scanHistoryPolicy: a whole-number window parses; garbage, negative and absence read as null', () => {
  assert.deepEqual(en.scanHistoryPolicy({ scan_history: { recheck_after_days: 30 } }), { recheckAfterDays: 30 });
  assert.deepEqual(en.scanHistoryPolicy({ scan_history: { recheck_after_days: 0 } }), { recheckAfterDays: 0 });
  assert.deepEqual(en.scanHistoryPolicy({ scan_history: { recheck_after_days: '45' } }), { recheckAfterDays: 45 });
  for (const v of [-1, 'yes', null, undefined]) {
    assert.deepEqual(en.scanHistoryPolicy({ scan_history: { recheck_after_days: v } }), { recheckAfterDays: null }, String(v));
  }
  // parseInt semantics: a fractional value truncates (1.5 → 1), as the parent's parse does.
  assert.deepEqual(en.scanHistoryPolicy({ scan_history: { recheck_after_days: 1.5 } }), { recheckAfterDays: 1 });
  assert.deepEqual(en.scanHistoryPolicy({}), { recheckAfterDays: null });
  assert.deepEqual(en.scanHistoryPolicy(null), { recheckAfterDays: null });
});

// ── shouldDedupScanHistoryRow: the pin verdict ───────────────────────

test('a recheckable status pins within the window and releases past it', () => {
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: daysAgo(5), status: 'added' }, policy(30)), true);
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: daysAgo(60), status: 'added' }, policy(30)), false);
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: daysAgo(60), status: 'skipped_expired' }, policy(30)), false);
  // The default today is the UTC calendar day the writers stamp rows with.
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: daysAgo(60), status: 'added' }), true);
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: daysAgo(60), status: 'added' }, policy(null)), true);
  // An explicit today is honoured.
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: '2020-01-01', status: 'added' }, { recheckAfterDays: 30, today: '2020-01-10' }), true);
});

test('a permanent status pins even past the window; an unknown status pins forever', () => {
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: daysAgo(400), status: 'skipped_invalid_url' }, policy(30)), true);
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: daysAgo(400), status: 'skipped_blocked_host' }, policy(30)), true);
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: daysAgo(400), status: 'skipped_weird' }, policy(30)), true);
});

test('an observational status never counts as seen', () => {
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: daysAgo(1), status: 'skipped_location' }, policy(30)), false);
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: daysAgo(1), status: 'skipped_age' }, policy(30)), false);
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: daysAgo(1), status: 'skipped_experience' }, policy(30)), false);
});

test('a scan-history date outside the calendar reads as no date — and does not throw', () => {
  // The parent's #5905 crash: new Date('2026-13-01T00:00:00Z') is an Invalid
  // Date and toISOString() threw, aborting the whole seen-set build.
  assert.doesNotThrow(() =>
    en.shouldDedupScanHistoryRow({ firstSeen: '2026-13-01', status: 'added' }, policy(30)));
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: '2026-13-01', status: 'added' }, policy(30)), true);
  assert.equal(en.shouldDedupScanHistoryRow({ firstSeen: '2026-02-30', status: 'added' }, policy(30)), true);
});

// ── collectSeenUrls under a window ──────────────────────────────────

test('under a 30-day window an aged row is released and a fresh one stays seen; with no window both stay seen', () => {
  writeFileSync(data('scan-history.tsv'), [
    HISTORY_HEADER,
    `${OLD}\t${daysAgo(60)}\tgreenhouse\tEngineer\tAcme\tadded`,
    `${FRESH}\t${daysAgo(5)}\tgreenhouse\tEngineer\tAcme\tadded`,
    '',
  ].join('\n'));
  const aged = normalizeUrl(OLD);
  const fresh = normalizeUrl(FRESH);

  const released = en.collectSeenUrls(policy(30)).seen;
  assert.equal(released.has(aged), false, 'the 60-day-old row is eligible again');
  assert.equal(released.has(fresh), true, 'the 5-day-old row stays seen');

  const forever = en.collectSeenUrls({}).seen;
  assert.equal(forever.has(aged), true, 'no window: dedup forever, as before');
  assert.equal(forever.has(fresh), true);

  // web-ui-format rows (date first, url sixth) age by their own date cell.
  writeFileSync(data('scan-history.tsv'),
    `2026-06-02\tgreenhouse\t8\tAcme\tOld\t${OLD}\n${today()}\tgreenhouse\t9\tAcme\tNew\t${FRESH}`);
  const ui = en.collectSeenUrls(policy(30)).seen;
  assert.equal(ui.has(aged), false, 'a web-ui-format row releases past the window too');
  assert.equal(ui.has(fresh), true);
});

test('a skipped_dup row follows its original: it neither pins nor restarts the clock', () => {
  writeFileSync(data('scan-history.tsv'), [
    HISTORY_HEADER,
    `${REPEATED}\t${daysAgo(60)}\tgreenhouse\tEngineer\tAcme\tadded`,
    `${REPEATED}\t${daysAgo(1)}\tgreenhouse\tEngineer\tAcme\tskipped_dup`,
    '',
  ].join('\n'));
  const token = normalizeUrl(REPEATED);
  assert.equal(en.collectSeenUrls(policy(30)).seen.has(token), false,
    'the aged original released; the fresh repeat goes with it');

  // A fresh or re-added row keeps the URL seen — the repeat's age never matters.
  writeFileSync(data('scan-history.tsv'), [
    HISTORY_HEADER,
    `${REPEATED}\t${daysAgo(5)}\tgreenhouse\tEngineer\tAcme\tadded`,
    `${REPEATED}\t${daysAgo(1)}\tgreenhouse\tEngineer\tAcme\tskipped_dup`,
    '',
  ].join('\n'));
  assert.equal(en.collectSeenUrls(policy(30)).seen.has(token), true);

  // A row with no original ages on its own first_seen.
  writeFileSync(data('scan-history.tsv'),
    `${REPEATED}\t${daysAgo(60)}\tgreenhouse\tEngineer\tAcme\tskipped_dup`);
  assert.equal(en.collectSeenUrls(policy(30)).seen.has(token), false, 'an aged orphan dup releases');
  writeFileSync(data('scan-history.tsv'),
    `${REPEATED}\t${daysAgo(1)}\tgreenhouse\tEngineer\tAcme\tskipped_dup`);
  assert.equal(en.collectSeenUrls(policy(30)).seen.has(token), true, 'a fresh orphan dup pins');

  // With no window nothing moves — the repeat pins like any row.
  writeFileSync(data('scan-history.tsv'), [
    HISTORY_HEADER,
    `${REPEATED}\t${daysAgo(60)}\tgreenhouse\tEngineer\tAcme\tadded`,
    `${REPEATED}\t${daysAgo(1)}\tgreenhouse\tEngineer\tAcme\tskipped_dup`,
    '',
  ].join('\n'));
  assert.equal(en.collectSeenUrls({}).seen.has(token), true);
});

test('any row still pinning the URL keeps it seen: a newer skipped_expired holds after the older added row aged out', () => {
  writeFileSync(data('scan-history.tsv'), [
    HISTORY_HEADER,
    `${OLD}\t${daysAgo(60)}\tgreenhouse\tEngineer\tAcme\tadded`,
    `${OLD}\t${daysAgo(3)}\tgreenhouse\tEngineer\tAcme\tskipped_expired`,
    '',
  ].join('\n'));
  assert.equal(en.collectSeenUrls(policy(30)).seen.has(normalizeUrl(OLD)), true,
    'the still-pinned expired row holds the URL seen');
});

test('a permanent row pins even past the window; an observational row never pins', () => {
  writeFileSync(data('scan-history.tsv'), [
    HISTORY_HEADER,
    `https://blocked.example/j/1\t${daysAgo(400)}\tmanual\tX\tAcme\tskipped_blocked_host`,
    `https://observ.example/j/1\t${daysAgo(1)}\tgreenhouse\tX\tAcme\tskipped_age`,
    '',
  ].join('\n'));
  const s = en.collectSeenUrls(policy(30)).seen;
  assert.equal(s.has(normalizeUrl('https://blocked.example/j/1')), true,
    'an invalid-URL/blocked-host verdict does not expire with the window');
  assert.equal(s.has(normalizeUrl('https://observ.example/j/1')), false);
});

// ── the pipeline interplay ──────────────────────────────────────────

test('a released URL is re-pinned while its actionable pipeline entry exists, and freed once the entry is finished', () => {
  const token = normalizeUrl(OLD);
  writeFileSync(data('scan-history.tsv'),
    `${OLD}\t${daysAgo(60)}\tgreenhouse\tEngineer\tAcme\tadded`);

  // The web-ui fence: a bare URL line is the pending inbox — still queued.
  writeFileSync(data('pipeline.md'), ['# Pipeline', '', '```', OLD, '```', ''].join('\n'));
  assert.equal(en.collectSeenUrls(policy(30)).seen.has(token), true,
    'a fence line re-pins: re-scanning it would append a second queue copy');

  // A checklist `- [ ]` row is equally actionable.
  writeFileSync(data('pipeline.md'), ['## Pending', `- [ ] ${OLD} | Acme | Engineer`, ''].join('\n'));
  assert.equal(en.collectSeenUrls(policy(30)).seen.has(token), true);

  // `- [x]` is finished work: the scan-history TTL governs alone → released.
  writeFileSync(data('pipeline.md'), ['## Pending', `- [x] ${OLD} | Acme | Engineer`, ''].join('\n'));
  assert.equal(en.collectSeenUrls(policy(30)).seen.has(token), false);

  // A row under `## Processed` is finished too.
  writeFileSync(data('pipeline.md'), ['## Processed', OLD, ''].join('\n'));
  assert.equal(en.collectSeenUrls(policy(30)).seen.has(token), false);

  // A pipeline-only URL (no history row) is never un-pinned by a window.
  writeFileSync(data('pipeline.md'), ['## Processed', OLD, ''].join('\n'));
  writeFileSync(data('scan-history.tsv'), '');
  assert.equal(en.collectSeenUrls(policy(30)).seen.has(token), true);
});

test('applications.md keeps pinning forever — the tracker is deliberate, never aged', () => {
  writeFileSync(data('scan-history.tsv'), '');
  writeFileSync(data('applications.md'),
    `| 1 | ${daysAgo(400)} | Acme | Engineer | 4.0/5 | Applied | ❌ | — | ${OLD} |`);
  assert.equal(en.collectSeenUrls(policy(30)).seen.has(normalizeUrl(OLD)), true);
});

// ── the scanners wire the policy through ────────────────────────────

async function withRecheckAdapter(rows, fn) {
  const adapter = {
    id: 'zz-recheck',
    matches: (c) => c.provider === 'zz-recheck',
    buildEndpoint: () => 'https://recheck.test/api',
    fetch: async () => rows.map((r, i) => ({ id: String(i + 1), location: 'Remote', ...r })),
  };
  ALL_ADAPTERS.unshift(adapter);
  try {
    return await fn();
  } finally {
    ALL_ADAPTERS.splice(ALL_ADAPTERS.indexOf(adapter), 1);
  }
}

test('runEnScan: with a 30-day window a 60-day-old seen row is FRESH again; without it the posting dedups away', async () => {
  writeFileSync(data('scan-history.tsv'), [
    HISTORY_HEADER,
    `${OLD}\t${daysAgo(60)}\tgreenhouse\tEngineer\tAcme\tadded`,
    '',
  ].join('\n'));
  await withRecheckAdapter([{ title: 'Engineer', company: 'Acme', url: OLD }], async () => {
    writePortals([
      'tracked_companies:',
      '  - { name: LangCo, provider: zz-recheck }',
      'scan_history:',
      '  recheck_after_days: 30',
    ]);
    const withWindow = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(withWindow.fresh.map((j) => j.url), [OLD],
      'the released posting returns to the scan');
    assert.equal(withWindow.counts.dup, 0);

    writePortals(['tracked_companies:', '  - { name: LangCo, provider: zz-recheck }']);
    const noWindow = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(noWindow.fresh.map((j) => j.url), []);
    assert.equal(noWindow.counts.dup, 1, 'no window: dedup forever, as before');
  });
});
