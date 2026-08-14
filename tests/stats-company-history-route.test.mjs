/**
 * GET /api/stats/company-history[?company=X] — zero-token read-only relay of
 * company-history.mjs (JSON stdout by default; `--company X` → single card,
 * bare → full result). CI-isolated: bootstraps a mkdtemp CAREER_OPS_ROOT and
 * writes a FAKE company-history.mjs that branches on --company, so the shell-out
 * contract is tested without the real parent. paths.mjs carriers load via dynamic
 * import() AFTER the env is set (paths-once rule).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

// A fake that echoes the real shapes: a single card for --company, the full
// result otherwise. Kept inline so the test never depends on the real parent.
const FAKE = `
const argv = process.argv.slice(2);
const ci = argv.indexOf('--company');
if (ci >= 0) {
  const name = argv[ci + 1] || '';
  console.log(JSON.stringify({
    company: name, key: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    responsiveness: { label: 'silent-on-you', facts: [
      { num: 4, appliedDate: '2026-07-01', status: 'Applied', silentDays: 30, followupsSent: 1, confidence: 'confirmed-by-followups', stale: false },
    ], medianResponseDays: null },
    postingChurn: { label: 'reposts-detected', clusters: [
      { role: 'Engineer', repostCount: 3, daysSpan: 40, lastSeen: '2026-08-01' },
    ] },
    explanations: ['A silent application is not a rejection.'],
  }));
} else {
  console.log(JSON.stringify({
    metadata: { silenceWindowDays: 14, staleAfterDays: 45, companies: 1, sources: { tracker: true, followups: true, scanHistory: true, statusLog: true } },
    hygiene: { agedApplied: [{ num: 4, company: 'Umbrella', silentDays: 30 }] },
    companies: [{ company: 'Umbrella', key: 'umbrella', responsiveness: { label: 'silent-on-you', facts: [] }, postingChurn: { label: 'none-detected', clusters: [] }, explanations: [] }],
    dataQuality: { unjoinable: 0 },
  }));
}
`;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'cohist-root-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  writeFileSync(join(root, 'company-history.mjs'), FAKE);
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  if (root) rmSync(root, { recursive: true, force: true });
  return new Promise((r) => server.close(r));
});

test('GET /api/stats/company-history?company=X relays a single card under available:true', async () => {
  const r = await fetch(baseUrl + '/api/stats/company-history?company=' + encodeURIComponent('Umbrella Corp'));
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.company, 'Umbrella Corp');
  assert.equal(d.responsiveness.label, 'silent-on-you');
  assert.equal(d.responsiveness.facts.length, 1);
  assert.equal(d.responsiveness.facts[0].silentDays, 30);
  assert.equal(d.postingChurn.label, 'reposts-detected');
  assert.equal(d.postingChurn.clusters[0].repostCount, 3);
});

test('GET /api/stats/company-history (no company) relays the full result', async () => {
  const r = await fetch(baseUrl + '/api/stats/company-history');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.metadata.companies, 1);
  assert.ok(Array.isArray(d.companies));
  assert.equal(d.companies[0].company, 'Umbrella');
});

test('GET /api/stats/company-history fails soft to {available:false} when the script is absent', async () => {
  rmSync(join(root, 'company-history.mjs'), { force: true });
  const r = await fetch(baseUrl + '/api/stats/company-history?company=Umbrella');
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-not-found');
});
