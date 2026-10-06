/**
 * v1.241.0 review hardening — runner.mjs output handling + request-guard.mjs.
 *
 *  - runner decoded each stdout chunk on its own (a Cyrillic character split
 *    across two chunks became U+FFFD) and the SSE stream split lines at chunk
 *    boundaries, emitting one log line as two events.
 *  - request-guard let an acting GET with `Sec-Fetch-Site: same-site` and no
 *    Origin through — any other port on 127.0.0.1 is same-site.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const savedRoot = process.env.CAREER_OPS_ROOT;
let ROOT;
let runner;
let guard;

before(async () => {
  ROOT = mkdtempSync(join(tmpdir(), 'infra-runner-'));
  writeFileSync(join(ROOT, 'cv.md'), '# CV\n');
  // "Я" = d0 af, written as two separate chunks with a pause between them;
  // the second line is also split mid-line.
  writeFileSync(join(ROOT, 'split.mjs'), [
    "const w = (b) => new Promise((r) => process.stdout.write(Buffer.from(b), () => setTimeout(r, 60)));",
    "await w([0xd0]); await w([0xaf, 0x0a]);",
    "await w('part-one '); await w('part-two\\n'); await w('no-newline-tail');",
  ].join('\n'));
  process.env.CAREER_OPS_ROOT = ROOT;
  runner = await import('../server/lib/runner.mjs');
  guard = await import('../server/lib/request-guard.mjs');
});
after(() => {
  if (savedRoot === undefined) delete process.env.CAREER_OPS_ROOT; else process.env.CAREER_OPS_ROOT = savedRoot;
  rmSync(ROOT, { recursive: true, force: true });
});

test('runNodeScript decodes a multibyte character split across chunks', async () => {
  const r = await runner.runNodeScript('split.mjs');
  assert.equal(r.code, 0);
  assert.equal(r.stdout, 'Я\npart-one part-two\nno-newline-tail');
});

test('streamNodeScript emits whole lines (carry across chunks, flush tail on exit)', async () => {
  const writes = [];
  const done = new Promise((resolve) => {
    const res = {
      writeHead() {}, flushHeaders() {}, on() {},
      write(s) { writes.push(s); },
      end: resolve,
    };
    runner.streamNodeScript(res, 'split.mjs');
  });
  await done;
  const lines = writes.join('').split('\n\n')
    .filter((b) => b.startsWith('event: log'))
    .map((b) => JSON.parse(b.slice(b.indexOf('data: ') + 6)).line);
  assert.deepEqual(lines, ['Я', 'part-one part-two', 'no-newline-tail']);
});

test('an acting request that is only same-site (no Origin) is refused', () => {
  const p = guard.buildHostPolicy({ bindHost: '127.0.0.1' });
  const req = (h) => ({ headers: { host: '127.0.0.1:4317', ...h } });
  assert.equal(guard.isCrossSite(req({ 'sec-fetch-site': 'same-site' }), p), true);
  assert.equal(guard.isCrossSite(req({ 'sec-fetch-site': 'same-origin' }), p), false);
  assert.equal(guard.isCrossSite(req({ 'sec-fetch-site': 'none' }), p), false);
  assert.equal(guard.isCrossSite(req({}), p), false); // curl / CLI
  // same-site WITH a matching Origin is the SPA itself behind an odd proxy — allowed
  assert.equal(guard.isCrossSite(req({ 'sec-fetch-site': 'same-site', origin: 'http://127.0.0.1:4317' }), p), false);
  assert.equal(guard.isCrossSite(req({ 'sec-fetch-site': 'same-site', origin: 'http://127.0.0.1:3000' }), p), true);
});
