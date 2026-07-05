/**
 * Portals health routes (v1.99.0). CI-isolated. Verifies the watched-company
 * listing reads portals.yml and that the health probe is bounded to enabled
 * companies. The one enabled company points at a loopback URL, which the SSRF
 * guard in `safeGet` rejects synchronously — so the probe exercises the route +
 * error path with ZERO network egress. Real external probing is manual /
 * Playwright, not CI.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl; let root;

// Acme's careers_url is a loopback address → SSRF-blocked by safeGet (no egress).
const PORTALS = `tracked_companies:
  - name: Acme
    careers_url: http://127.0.0.1:9/careers
    provider: greenhouse
  - name: Globex
    careers_url: https://jobs.globex.com
    enabled: false
`;

before(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'portals-'));
  writeFileSync(resolve(root, 'cv.md'), '# Dev\n');
  writeFileSync(resolve(root, 'portals.yml'), PORTALS);
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => { delete process.env.CAREER_OPS_ROOT; try { rmSync(root, { recursive: true, force: true }); } catch { /* noop */ } return new Promise((r) => server.close(r)); });

test('GET /api/portals (existing content route) exposes the tracked companies the view reads', async () => {
  const r = await fetch(`${baseUrl}/api/portals`);
  assert.equal(r.status, 200);
  const j = await r.json();
  const tracked = j.portals && j.portals.tracked_companies;
  assert.ok(Array.isArray(tracked) && tracked.length === 2);
  const acme = tracked.find((c) => c.name === 'Acme');
  assert.ok(acme && acme.careers_url === 'http://127.0.0.1:9/careers' && acme.provider === 'greenhouse');
  const globex = tracked.find((c) => c.name === 'Globex');
  assert.equal(globex.enabled, false);
});

test('POST /api/portals/health probes only enabled companies; SSRF-blocked URL → dead, no egress', async () => {
  const r = await fetch(`${baseUrl}/api/portals/health`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.probed, 1); // only Acme is enabled
  assert.ok(Array.isArray(j.results) && j.results.length === 1);
  assert.equal(j.results[0].name, 'Acme');
  assert.equal(j.results[0].ok, false); // loopback rejected by the SSRF guard
  assert.ok(!j.results.some((x) => x.name === 'Globex'), 'disabled company must not be probed');
});
