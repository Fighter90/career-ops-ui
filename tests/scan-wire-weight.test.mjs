/**
 * scan-wire-weight — the #/scan page's wire payload is bounded.
 *
 * The prod perf probe (2026-11-12, v1.271.11) measured the scan page's
 * mount-time endpoints at /api/scan-results 1.9 s / 3.77 MB and
 * /api/scan/reposts 4.6 s / 2.97 MB — the owner-reported slow search
 * page. Two bounds, both behavior-preserving:
 *   1. /api/scan-results caps each row's `description` at 4000 chars —
 *      exactly what the SPA row renderer already slices to
 *      (scan/runner.js `String(r.description || '').slice(0, 4000)`), so
 *      the page renders byte-identical content; the wire stops carrying
 *      descriptions the client would throw away.
 *   2. /api/scan/reposts memoizes detectRepostsFromFile keyed on the
 *      scan-history's mtime+size+window — the clustering is recomputed
 *      only when the history actually changed, not on every page mount.
 *
 * CI isolation: CAREER_OPS_ROOT is a fresh mkdtemp, dynamic imports inside
 * before(), in-process server on an ephemeral port.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let dir, server, baseUrl;
let createApp;
const DESC = 'd'.repeat(10000);
const job = (title, extra = {}) => ({
  title, company: 'Acme', url: `https://x/${encodeURIComponent(title)}`,
  location: 'Berlin', source: 'greenhouse', description: DESC, ...extra,
});
const SNAPSHOT = {
  en: { kind: 'en', when: '2026-09-26T10:00:00Z', errors: [],
    fresh: [job('Fresh One')],
    filtered: [job('Big Desc'), job('Small', { description: 'short' })] },
  ru: { kind: 'ru', when: '2026-09-26T09:58:00Z', errors: [],
    fresh: [], filtered: [job('Русская', { description: DESC })] },
};
const HISTORY_V1 = [
  'https://x/a\t2026-09-01\tgreenhouse\tJob A\tAcme\tadded',
  'https://x/b\t2026-09-03\tgreenhouse\tJob A\tAcme\tadded',
].join('\n') + '\n';
const HISTORY_V2 = [
  'https://x/c\t2026-09-01\tgreenhouse\tJob B\tBeta\tadded',
  'https://x/d\t2026-09-05\tgreenhouse\tJob B\tBeta\tadded',
].join('\n') + '\n';

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scanwire-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'last-scan.json'), JSON.stringify(SNAPSHOT));
  writeFileSync(resolve(dir, 'data', 'scan-history.tsv'), HISTORY_V1);
  process.env.CAREER_OPS_ROOT = dir;
  const mod = await import(resolve(ROOT, 'server', 'index.mjs'));
  createApp = mod.createApp ?? mod.default;
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((r) => server.close(r)));

describe('GET /api/scan-results — description capped at 4000', () => {
  test('bare snapshot: long descriptions capped, short ones intact', async () => {
    const b = await (await fetch(`${baseUrl}/api/scan-results`)).json();
    assert.equal(b.en.filtered[0].description.length, 4000, 'long description sliced to the SPA cap');
    assert.equal(b.en.filtered[1].description, 'short', 'short description untouched');
    assert.equal(b.ru.filtered[0].description.length, 4000);
    assert.equal(b.en.fresh[0].description.length, 4000);
  });

  test('paged mode: capped too', async () => {
    const b = await (await fetch(`${baseUrl}/api/scan-results?region=en&limit=10`)).json();
    assert.equal(b.rows[0].description.length, 4000);
  });
});

describe('GET /api/scan/reposts — memoized on history mtime+size+window', () => {
  const get = async (qs = '') => (await fetch(`${baseUrl}/api/scan/reposts${qs}`)).json();

  test('repeat reads with an unchanged history serve the same clusters', async () => {
    const a = await get();
    const b = await get();
    assert.deepEqual(b, a, 'the memo must serve the identical payload');
    assert.ok(Array.isArray(a.clusters));
  });

  test('a changed history (new mtime+size) recomputes', async () => {
    const before = await get();
    const p = resolve(dir, 'data', 'scan-history.tsv');
    writeFileSync(p, HISTORY_V2);
    const now = new Date();
    utimesSync(p, now, now); // guarantee a fresh mtime
    const after = await get();
    assert.notEqual(JSON.stringify(after), JSON.stringify(before), 'the memo must invalidate on a changed history');
  });

  test('a different window is a different memo entry', async () => {
    const d7 = await get('?window=7');
    const d180 = await get('?window=180');
    assert.equal(d7.windowDays, 7);
    assert.equal(d180.windowDays, 180);
  });
});
