/**
 * public/js/lib/report-export.js — shared take-the-report-out helpers
 * (v1.94.0; browser classic script → loaded under a synthetic window, same
 * pattern as score-tone.test.mjs).
 *
 * v1.243.0 coverage:
 *   - slugify keeps Unicode letters: a non-Latin title ("Отчёт по рынку")
 *     collapsed to '' under [^a-z0-9] and EVERY download was report.md.
 *   - the execCommand copy fallback reports failure instead of resolving
 *     "Copied" with an empty clipboard.
 *   - the DOCX failure toast routes through an existing i18n key (was a
 *     hard-coded English sentence in all 17 locales).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let ReportExport;

/** Minimal DOM: just what report-export.js touches. */
function makeDom({ execCommandOk = true } = {}) {
  const clicks = [];
  const anchorAttrs = [];
  const toasts = [];
  const el = (tag) => ({
    tag,
    style: {},
    dataset: {},
    attrs: {},
    href: '',
    download: '',
    value: '',
    appendChild() {},
    remove() {},
    select() {},
    click() { clicks.push(tag); if (tag === 'a') anchorAttrs.push({ href: this.href, download: this.download }); },
    setAttribute(k, v) { this.attrs[k] = String(v); },
  });
  const document = {
    createElement: el,
    body: { appendChild() {}, removeChild() {} },
    execCommand: () => execCommandOk,
  };
  return { document, clicks, anchorAttrs, toasts };
}

before(() => {
  const win = {};
  const src = readFileSync(resolve(ROOT, 'public/js/lib/report-export.js'), 'utf8');
  new Function('window', 'document', src)(win, makeDom().document);
  ReportExport = win.ReportExport;
});

// ───────────────────────── slugify ─────────────────────────

test('slugify: Latin behavior unchanged', () => {
  assert.equal(ReportExport.slugify('Hello World!'), 'hello-world');
  assert.equal(ReportExport.slugify('Wheely (Cyprus)'), 'wheely-cyprus');
  assert.equal(ReportExport.slugify(''), 'report');
  assert.equal(ReportExport.slugify(null), 'report');
});

test('slugify: non-Latin titles keep their letters (no more report.md for everything)', () => {
  assert.equal(ReportExport.slugify('Отчёт по рынку'), 'отчёт-по-рынку');
  assert.equal(ReportExport.slugify('Київ — ринок праці'), 'київ-ринок-праці');
  assert.equal(ReportExport.slugify('Opschorting bijstand'), 'opschorting-bijstand');
  assert.equal(ReportExport.slugify('Αναφορά αγοράς'), 'αναφορά-αγοράς');
});

test('slugify: caps at 60 chars and never ends on a dash', () => {
  const long = 'x'.repeat(100);
  const out = ReportExport.slugify(long);
  assert.ok(out.length <= 60, 'length capped');
  assert.ok(!out.endsWith('-'), 'no trailing dash after the cap');
});

// ───────────────────────── downloadMarkdown ─────────────────────────

test('downloadMarkdown: a non-Latin title produces a named .md, not report.md', () => {
  const dom = makeDom();
  const realCreate = URL.createObjectURL;
  const realRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
  const win = {};
  new Function('window', 'document', readFileSync(resolve(ROOT, 'public/js/lib/report-export.js'), 'utf8'))(
    win, dom.document,
  );
  try {
    win.ReportExport.downloadMarkdown('Отчёт по рынку', '# hello');
    assert.equal(dom.anchorAttrs.length, 1);
    assert.equal(dom.anchorAttrs[0].download, 'отчёт-по-рынку.md');
  } finally {
    URL.createObjectURL = realCreate;
    URL.revokeObjectURL = realRevoke;
  }
});

// ───────────────────────── copy fallback ─────────────────────────

test('copy: execCommand fallback RESOLVES when the copy succeeds', async () => {
  const dom = makeDom({ execCommandOk: true });
  const win = {};
  new Function('window', 'document', readFileSync(resolve(ROOT, 'public/js/lib/report-export.js'), 'utf8'))(
    win, dom.document,
  );
  await win.ReportExport.copy('text');
});

test('copy: execCommand fallback REJECTS when the browser refuses (was: silent success)', async () => {
  const dom = makeDom({ execCommandOk: false });
  const win = {};
  new Function('window', 'document', readFileSync(resolve(ROOT, 'public/js/lib/report-export.js'), 'utf8'))(
    win, dom.document,
  );
  await assert.rejects(() => win.ReportExport.copy('text'));
});

// ───────────────────────── saveDocx ─────────────────────────

test('saveDocx: success downloads slugified .docx and re-enables the button', async () => {
  const dom = makeDom();
  const btn = { disabled: false };
  const calls = [];
  globalThis.fetch = async () => new Response(new Blob(['docx-bytes']), { status: 200 });
  const realCreate = URL.createObjectURL;
  const realRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
  const win = {
    UI: { toast: (m, t) => dom.toasts.push([m, t]) },
    PdfGenerate: { run: () => {} },
  };
  new Function('window', 'document', 'fetch', readFileSync(resolve(ROOT, 'public/js/lib/report-export.js'), 'utf8'))(
    win, dom.document, globalThis.fetch,
  );
  try {
    await win.ReportExport.saveDocx('# md', 'Отчёт по рынку', btn);
    assert.equal(dom.anchorAttrs.length, 1);
    assert.equal(dom.anchorAttrs[0].download, 'отчёт-по-рынку.docx');
    assert.equal(btn.disabled, false, 'button re-enabled');
    assert.equal(dom.toasts.length, 0, 'no toast on success');
  } finally {
    URL.createObjectURL = realCreate;
    URL.revokeObjectURL = realRevoke;
    delete globalThis.fetch;
  }
});

test('saveDocx: failure toasts via the existing common.error key, not hard-coded English', async () => {
  const dom = makeDom();
  const btn = { disabled: false };
  globalThis.fetch = async () => new Response('nope', { status: 500 });
  // The codebase resolves t() via the browser global (window.I18n && I18n.t);
  // mirror it the way index.html does.
  globalThis.I18n = { t: (k, f) => (k === 'common.error' ? 'Ошибка' : f) };
  const win = {
    I18n: globalThis.I18n,
    UI: { toast: (m, t) => dom.toasts.push([m, t]) },
    PdfGenerate: { run: () => {} },
  };
  new Function('window', 'document', 'fetch', readFileSync(resolve(ROOT, 'public/js/lib/report-export.js'), 'utf8'))(
    win, dom.document, globalThis.fetch,
  );
  try {
    await win.ReportExport.saveDocx('# md', 'Report', btn);
    assert.equal(dom.toasts.length, 1);
    assert.equal(dom.toasts[0][0], 'Ошибка', 'toast must come from the common.error dict key');
    assert.equal(dom.toasts[0][1], 'error');
    assert.equal(btn.disabled, false, 'button re-enabled on failure too');
  } finally {
    delete globalThis.fetch;
    delete globalThis.I18n;
  }
});
