/**
 * v1.241.0 review hardening — cv-import.mjs.
 *
 *  - pandoc's HTML reader fetches `<iframe src>` / remote resources itself, an
 *    SSRF that bypasses safeGet → it now runs with `--sandbox` (and retries
 *    without it only on a pandoc too old to know the flag — those versions
 *    predate the fetching reader).
 *  - A scanned PDF (no text layer) came back ok:true with markdown '\n'; empty
 *    converter output is now ok:false.
 *  - stdout was decoded per chunk, so a multibyte character split across two
 *    chunks became U+FFFD.
 *  - `.doc` was advertised but pandoc cannot read it (always 422).
 *
 * The converters are replaced by fake executables on PATH — no pandoc/poppler
 * needed, and the arguments they receive are observable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let importDocumentToMarkdown;
let describeSupportedFormats;
let BIN;
const savedPath = process.env.PATH;

/** Write an executable shell script named `name` into the fake bin dir. */
function fakeBin(name, body) {
  const p = join(BIN, name);
  writeFileSync(p, `#!/bin/sh\n${body}\n`);
  chmodSync(p, 0o755);
}

before(async () => {
  BIN = mkdtempSync(join(tmpdir(), 'infra-cvimport-bin-'));
  process.env.PATH = `${BIN}:${savedPath}`;
  ({ importDocumentToMarkdown, describeSupportedFormats } = await import('../server/lib/cv-import.mjs'));
});
after(() => {
  process.env.PATH = savedPath;
  rmSync(BIN, { recursive: true, force: true });
});

test('pandoc runs with --sandbox', { skip: process.platform === 'win32' }, async () => {
  const argsFile = join(BIN, 'pandoc-args');
  fakeBin('pandoc', `printf '%s\\n' "$@" > '${argsFile}'\nprintf '# CV\\n'`);
  const r = await importDocumentToMarkdown(Buffer.from('<html><iframe src="http://169.254.169.254/"></iframe><h1>CV</h1></html>'), 'cv.html');
  assert.equal(r.ok, true);
  assert.equal(r.markdown, '# CV\n');
  const args = readFileSync(argsFile, 'utf8').split('\n');
  assert.ok(args.includes('--sandbox'), args.join(' '));
});

test('a pandoc that does not know --sandbox is retried without it', { skip: process.platform === 'win32' }, async () => {
  const log = join(BIN, 'pandoc-calls');
  fakeBin('pandoc', [
    `echo "$*" >> '${log}'`,
    'for a in "$@"; do if [ "$a" = "--sandbox" ]; then echo "Unknown option --sandbox." >&2; exit 2; fi; done',
    "printf 'old pandoc\\n'",
  ].join('\n'));
  const r = await importDocumentToMarkdown(Buffer.from('{\\rtf1 hi}'), 'cv.rtf');
  assert.equal(r.ok, true);
  assert.equal(r.markdown, 'old pandoc\n');
  const calls = readFileSync(log, 'utf8').trim().split('\n');
  assert.equal(calls.length, 2);
  assert.match(calls[0], /--sandbox/);
  assert.doesNotMatch(calls[1], /--sandbox/);
});

test('other pandoc failures are reported, not retried', { skip: process.platform === 'win32' }, async () => {
  fakeBin('pandoc', 'echo "parse error at line 3" >&2; exit 64');
  const r = await importDocumentToMarkdown(Buffer.from('x'), 'cv.odt');
  assert.equal(r.ok, false);
  assert.match(r.error, /pandoc failed \(exit 64\)/);
  assert.match(r.hint, /parse error/);
});

test('empty converter output is ok:false (scanned PDF / empty doc)', { skip: process.platform === 'win32' }, async () => {
  fakeBin('pdftotext', "printf '\\n\\n  \\n\\f'");
  const pdf = await importDocumentToMarkdown(Buffer.from('%PDF-1.4'), 'scan.pdf');
  assert.equal(pdf.ok, false);
  assert.equal(pdf.sourceFormat, 'pdf');
  assert.match(pdf.error, /no text/i);

  fakeBin('pandoc', "printf '\\n'");
  const docx = await importDocumentToMarkdown(Buffer.from('PK'), 'cv.docx');
  assert.equal(docx.ok, false);
  assert.match(docx.error, /no text/i);
});

test('multibyte text split across output chunks decodes intact', { skip: process.platform === 'win32' }, async () => {
  // "Я" is d0 af; the two bytes arrive in separate writes / chunks.
  fakeBin('pdftotext', "printf 'Резюме \\320'; sleep 0.2; printf '\\257\\n'");
  const r = await importDocumentToMarkdown(Buffer.from('%PDF-1.4'), 'cv.pdf');
  assert.equal(r.ok, true);
  assert.equal(r.markdown, 'Резюме Я\n');
  assert.ok(!r.markdown.includes('�'));
});

test('pdftotext failure and missing converters are reported', { skip: process.platform === 'win32' }, async () => {
  fakeBin('pdftotext', 'echo "Syntax Error: broken xref" >&2; exit 1');
  const bad = await importDocumentToMarkdown(Buffer.from('%PDF'), 'cv.pdf');
  assert.equal(bad.ok, false);
  assert.match(bad.error, /pdftotext failed \(exit 1\)/);

  rmSync(join(BIN, 'pdftotext'));
  rmSync(join(BIN, 'pandoc'));
  process.env.PATH = BIN; // nothing else on PATH → ENOENT
  try {
    const noPdf = await importDocumentToMarkdown(Buffer.from('%PDF'), 'cv.pdf');
    assert.equal(noPdf.error, 'pdftotext not installed');
    const noPandoc = await importDocumentToMarkdown(Buffer.from('<p>x</p>'), 'cv.htm');
    assert.equal(noPandoc.error, 'pandoc not installed');
  } finally {
    process.env.PATH = `${BIN}:${savedPath}`;
  }
});

test('.doc is no longer offered (pandoc cannot read it)', async () => {
  assert.ok(!describeSupportedFormats().includes('doc'));
  const r = await importDocumentToMarkdown(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), 'old.doc');
  assert.equal(r.ok, false);
  assert.equal(r.sourceFormat, 'doc');
  assert.match(r.error, /unsupported format/);
  assert.match(r.hint, /\.docx/);
});

test('passthrough, size and payload guards', async () => {
  const md = await importDocumentToMarkdown(Buffer.from('plain'), 'notes');
  assert.equal(md.ok, true);
  assert.equal(md.sourceFormat, 'txt');
  assert.equal((await importDocumentToMarkdown('not a buffer', 'a.md')).ok, false);
  const big = await importDocumentToMarkdown(Buffer.alloc(10 * 1024 * 1024 + 1, 0x61), 'a.md');
  assert.match(big.error, /too large/);
});
