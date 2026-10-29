// L262-R4 — TOCTOU in the posting-guard capture resolution: readdirSync
// lists jds/, then statSync(mtimes) runs per file. A capture removed between
// the two calls (another session, a cleanup) threw ENOENT and the route
// returned 500. Contract: vanished files are SKIPPED, the newest surviving
// capture still resolves, and nothing throws.
//
// CI-isolated: temp dir only, no network, no server — the helper is pure.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { statSync } from 'node:fs';

let root;
let jdsDir;
let findCaptureByReport;

const enoentStat = (p) => {
  if (String(p).endsWith('064-vanishing.txt')) {
    const err = new Error(`ENOENT: no such file or directory, stat '${p}'`);
    err.code = 'ENOENT';
    throw err;
  }
  return statSync(p);
};

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'runners-capture-toctou-'));
  jdsDir = join(root, 'jds');
  mkdirSync(jdsDir, { recursive: true });
  writeFileSync(join(jdsDir, '064-vanishing.txt'), 'removed mid-scan\n');
  writeFileSync(join(jdsDir, '064-acme.txt'), 'survivor\n');
  ({ findCaptureByReport } = await import('../server/lib/routes/runners.mjs'));
});

after(() => rmSync(root, { recursive: true, force: true }));

test('a capture stat-failing ENOENT between readdir and stat is skipped, not a 500', () => {
  const name = findCaptureByReport(jdsDir, 64, enoentStat);
  assert.equal(name, '064-acme.txt', 'the surviving capture resolves');
});

test('when every matching capture vanishes the result is null, not a throw', () => {
  const allVanish = () => {
    const err = new Error('ENOENT: no such file or directory');
    err.code = 'ENOENT';
    throw err;
  };
  assert.equal(findCaptureByReport(jdsDir, 64, allVanish), null);
});

test('real fs: newest capture wins and the number never bleeds into a longer one', () => {
  const name = findCaptureByReport(jdsDir, 64, statSync);
  assert.equal(name, '064-acme.txt');
  assert.equal(findCaptureByReport(jdsDir, 640, statSync), null);
});
