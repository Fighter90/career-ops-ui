/**
 * CAR-124 — [UX·Пустые состояния] Funded, Batch, Apply, Auto.
 *
 * Acceptance criteria (the spec):
 *   • no screen shows a single lonely button before the first action — each
 *     empty state carries (a) a one-line explanation, (b) a concrete EXAMPLE
 *     of the filled state (static, decorative, clearly tagged, never sent to
 *     any API), (c) the primary action pre-wired to the real first step.
 *   • Batch accepts pasting a bare URL list from the clipboard.
 *
 * Structural gate in the project's established source-static style
 * (the views are browser classic scripts; cf. car119/car20/auto-screen).
 * New UI strings ship as `I18n.t('v2empty.*', 'EN fallback')` with NO
 * dictionary edits (the CAR-119 `llm2.*` precedent) — marked `// CAR-124 i18n:`
 * in each view and listed in the PR for the locale fan-out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

const FUNDED = read('public', 'js', 'views', 'funded.js');
const BATCH = read('public', 'js', 'views', 'batch.js');
const APPLY = read('public', 'js', 'views', 'apply.js');
const AUTO = read('public', 'js', 'views', 'auto.js');
const OVERLAYS = read('public', 'css', 'overlays.css');

// ─── shared example-preview component ───

test('CAR-124: overlays.css carries the shared v2-empty example styles (append-only, at END)', () => {
  const tag = OVERLAYS.indexOf('/* CAR-124');
  assert.ok(tag > -1, 'the CAR-124 CSS block exists');
  assert.ok(OVERLAYS.includes('.v2-empty-example {'), 'the dashed example container');
  assert.ok(OVERLAYS.includes('.v2-empty-example__tag {'), 'the EXAMPLE tag pill');
  // append-only: the CAR-124 block must sit at the very end of the cascade
  const tail = OVERLAYS.slice(tag).replace(/\s+$/, '');
  assert.ok(tail.includes('}') , 'rules live in the trailing block');
  assert.ok(tag > OVERLAYS.indexOf('.v2-stats-tab'), 'appended after the v2-stats block');
});

// ─── #/funded ───

test('CAR-124 funded: first-run example card (explanation + tagged, decorative sample) paints before any run', () => {
  assert.match(FUNDED, /v2-empty-example/, 'the example preview uses the shared component');
  assert.match(FUNDED, /v2empty\.funded\.emptyBody/, 'a one-line explanation ships in the empty state');
  // the sample block is decorative: aria-hidden, and never reaches an API —
  // the relay call stays single and the sample name appears only near the
  // aria-hidden example builder.
  const ex = FUNDED.match(/function\s+\w*[Ee]xample[\s\S]*?\n {2}\}/);
  assert.ok(ex, 'a dedicated example builder function exists');
  assert.match(ex[0], /aria-hidden['"]?\s*[,:]\s*['"]?true/, 'the sample card is aria-hidden');
  assert.equal((FUNDED.match(/API\.get\('\/api\/company-funded'\)/g) || []).length, 1,
    'the discovery endpoint is called exactly once — sample data never rides it');
});

test('CAR-124 funded: the empty-state CTA runs the SAME discovery flow (one kit run, one cancel guard)', () => {
  assert.match(FUNDED, /function runDiscovery\(/, 'the handler is extracted to a named function');
  const calls = (FUNDED.match(/runDiscovery\(\)/g) || []).length;
  assert.ok(calls >= 2, `both the Discover button and the empty-state CTA call runDiscovery (found ${calls})`);
  assert.equal((FUNDED.match(/LlmPageKit\.run\(/g) || []).length, 1, 'still a single kit run (car119 gate)');
  assert.match(FUNDED, /runCtrl\.cancelled \|\| runCtrl\.signal\.aborted/, 'cancel guard intact');
  // the example is hidden once a run starts — results replace it
  assert.match(FUNDED, /emptyHost\.style\.display = 'none'/, 'the example yields to real results');
});

// ─── #/batch ───

test('CAR-124 batch: first-run empty state explains the flow, shows a tagged TSV example row', () => {
  assert.match(BATCH, /v2-empty-example/, 'the example preview uses the shared component');
  assert.match(BATCH, /v2empty\.batch\.emptyBody/, 'a one-line explanation ships in the empty state');
  const ex = BATCH.match(/function\s+\w*[Ee]xample[\s\S]*?\n {2}\}/);
  assert.ok(ex, 'a dedicated example builder function exists');
  assert.match(ex[0], /aria-hidden['"]?\s*[,:]\s*['"]?true/, 'the sample row is aria-hidden');
  assert.match(BATCH, /batch\.inputHint/, 'the format explanation reuses the existing editor hint key');
  // the example is only for the FIRST run: gated on an empty saved TSV
  assert.match(BATCH, /const hasInput = /, 'the empty-state gate is a named flag');
  assert.match(BATCH, /!hasInput[\s\S]{0,160}buildBatchExample/,
    'the example is gated on an empty batch-input.tsv');
});

test('CAR-124 batch: accepts a bare URL list pasted from the clipboard (acceptance criterion)', () => {
  assert.match(BATCH, /navigator\.clipboard\.readText/, 'clipboard read is the paste mechanism');
  assert.match(BATCH, /v2empty\.batch\.pasteList/, 'a labelled Paste-URL-list affordance exists');
  // clipboard may be unavailable / contain no URLs — both fail honestly
  assert.match(BATCH, /v2empty\.batch\.pasteFail/, 'a clipboard-failure toast exists');
  assert.match(BATCH, /v2empty\.batch\.pasteNone/, 'a no-URLs-found toast exists');
  // pasted URLs become TSV rows (id, url, source, notes) — tab-separated,
  // and only lines that actually look like http(s) URLs are taken
  const fn = BATCH.match(/function\s+\w*[Pp]aste[\s\S]*?\n {2}\}/);
  assert.ok(fn, 'a dedicated paste handler exists');
  assert.match(fn[0], /\\t/, 'rows are tab-separated TSV');
  assert.ok(fn[0].includes('/^https?:\\/\\//i'), 'bare http(s) URL lines only');
});

test('CAR-124 batch: the empty state links the batch docs guide (the real first step)', () => {
  const guide = 'https://career-ops.org/docs/introduction/guides/batch-evaluate-offers';
  assert.ok((BATCH.match(new RegExp(guide.replace(/[./]/g, '\\$&'), 'g')) || []).length >= 2,
    'the guide URL appears in the subtitle AND the empty state');
});

// ─── #/apply ───

test('CAR-124 apply: first-run empty state explains the checklist and links #/reports', () => {
  assert.match(APPLY, /v2-empty-example/, 'the example preview uses the shared component');
  assert.match(APPLY, /v2empty\.apply\.emptyBody/, 'a one-line explanation ships in the empty state');
  assert.match(APPLY, /href: '#\/reports'/, 'the empty state links the reports list');
  assert.match(APPLY, /v2empty\.apply\.pickReport/, 'the link is labelled (pick an evaluated report)');
  const ex = APPLY.match(/function\s+\w*[Ee]xample[\s\S]*?\n {2}\}/);
  assert.ok(ex, 'a dedicated example builder function exists');
  assert.match(ex[0], /aria-hidden['"]?\s*[,:]\s*['"]?true/, 'the sample checklist is aria-hidden');
  // decorative boxes are spans, NOT real checkboxes (real ones only come from renderChecklist)
  assert.doesNotMatch(ex[0], /type: 'checkbox'/, 'no live inputs inside the decorative example');
});

// ─── #/auto ───

test('CAR-124 auto: a try-the-example affordance fills the URL input (never auto-runs)', () => {
  assert.match(AUTO, /const EXAMPLE_URL = '/, 'the sample URL is one shared constant');
  const uses = (AUTO.match(/EXAMPLE_URL/g) || []).length;
  assert.ok(uses >= 3, `the constant feeds the placeholder AND the example button (found ${uses})`);
  assert.match(AUTO, /urlInput\.value = EXAMPLE_URL/, 'clicking the affordance pre-fills the input');
  assert.match(AUTO, /v2empty\.auto\.tryExample/, 'the affordance is labelled');
  // CAR-20 invariant stays: nothing auto-starts a paid run
  assert.doesNotMatch(AUTO, /setTimeout\(run/, 'still no auto-start');
});

test('CAR-124 auto: the empty state explains the cadence timer and links App settings', () => {
  assert.match(AUTO, /v2empty\.auto\.hint/, 'a timer/cadence note ships in the empty state');
  assert.match(AUTO, /href: '#\/config'/, 'the note links App settings');
  assert.match(AUTO, /nav\.config/, 'the link reuses the localized App-settings label');
  assert.match(AUTO, /auto\.eta/, 'the timer note reuses the existing ETA key');
});

// ─── i18n discipline (no dictionary edits) ───

test('CAR-124: every new v2empty.* string goes through I18n.t with an EN fallback, marked for fan-out', () => {
  for (const [name, src] of [['funded.js', FUNDED], ['batch.js', BATCH], ['apply.js', APPLY], ['auto.js', AUTO]]) {
    assert.ok(src.includes('// CAR-124 i18n:'), `${name}: carries the fan-out marker`);
    for (const m of src.matchAll(/t\('(v2empty\.[a-zA-Z.]+)'\s*,\s*'([^']+)'/g)) {
      assert.ok(m[2].length > 0, `${name}: ${m[1]} has an EN fallback`);
    }
    // no bare v2empty key without a fallback argument
    for (const m of src.matchAll(/t\('v2empty\.[a-zA-Z.]+'\)/g)) {
      assert.fail(`${name}: ${m[0]} is missing its EN fallback`);
    }
  }
});
