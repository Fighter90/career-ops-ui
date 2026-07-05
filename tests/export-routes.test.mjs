/**
 * Export routes + docx writer (v1.100.0).
 *
 * POST /api/export/docx turns client-held Markdown (two-pager, career plan,
 * a report) into a downloadable .docx built by the dependency-free docx writer.
 * CI-isolated: createApp() in-process, no parent project, no network.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let app;
before(async () => {
  process.env.CAREER_OPS_ROOT = mkdtempSync(join(tmpdir(), 'export-test-'));
  ({ createApp } = await import('../server/index.mjs'));
  app = createApp();
});
let createApp;

async function listen(fn) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  try { return await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { server.close(); }
}

test('POST /api/export/docx returns a valid .docx (ZIP magic + Word content-type)', async () => {
  await listen(async (base) => {
    const res = await fetch(`${base}/api/export/docx`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'My two-pager', markdown: '# Who I am\n\nA builder.\n\n## Loves\n\n- remote\n- ownership' }),
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /wordprocessingml\.document/);
    assert.match(res.headers.get('content-disposition') || '', /\.docx/);
    const buf = Buffer.from(await res.arrayBuffer());
    // ZIP local-file-header magic "PK\x03\x04"
    assert.equal(buf[0], 0x50); assert.equal(buf[1], 0x4b);
    assert.equal(buf[2], 0x03); assert.equal(buf[3], 0x04);
    assert.ok(buf.length > 200, 'docx should be non-trivial');
  });
});

test('POST /api/export/docx rejects empty markdown with 400', async () => {
  await listen(async (base) => {
    const res = await fetch(`${base}/api/export/docx`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ markdown: '   ' }),
    });
    assert.equal(res.status, 400);
  });
});

test('buildDocx + markdownToBlocks produce a 4-part OOXML package', async () => {
  const { buildDocx, markdownToBlocks } = await import('../server/lib/docx.mjs');
  const blocks = markdownToBlocks('# Title\n\nPara.\n\n- a\n- b\n\n## Sub');
  assert.ok(blocks.some((b) => b.type === 'h1'));
  assert.ok(blocks.some((b) => b.type === 'bullet'));
  assert.ok(blocks.some((b) => b.type === 'h2'));
  const buf = buildDocx('Title', blocks);
  assert.ok(Buffer.isBuffer(buf) && buf.length > 200);
  // XML-escaping: angle brackets must not survive raw into the package bytes as tags of our own
  const withEntity = buildDocx('a & <b>', markdownToBlocks('x < y & z'));
  assert.ok(withEntity.length > 200);
});

test('two-pager parseYamlFields coerces LLM YAML (with code fence) into the bounded shape', async () => {
  const { parseYamlFields } = await import('../server/lib/routes/two-pager.mjs');
  const raw = '```yaml\nwho_i_am: I build things\nloves:\n  - remote\n  - ownership\nmust_haves:\n  - comp floor\nhates: []\ndeal_breakers:\n  - onsite only\nnon_negotiables:\n  - remote\ntarget_environment: Series A product co\nbogus_key: dropped\n```';
  const f = parseYamlFields(raw);
  assert.equal(f.who_i_am, 'I build things');
  assert.deepEqual(f.loves, ['remote', 'ownership']);
  assert.equal(f.target_environment, 'Series A product co');
  assert.ok(!('bogus_key' in f), 'unknown keys are dropped by normalizeTwoPager');
});

test('two-pager parseYamlFields returns null on non-YAML / non-object', async () => {
  const { parseYamlFields } = await import('../server/lib/routes/two-pager.mjs');
  assert.equal(parseYamlFields(''), null);
  assert.equal(parseYamlFields('just a sentence, not yaml: [unclosed'), null);
  assert.equal(parseYamlFields('- a\n- b'), null); // top-level array, not the object shape
});
