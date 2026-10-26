/**
 * CAR-124 — [UX·Пустые состояния] Funded, Batch, Apply, Auto (+ the 2026-10-26
 * opus review round).
 *
 * Acceptance criteria (the spec):
 *   • no screen shows a single lonely button before the first action — each
 *     empty state carries (a) a one-line explanation, (b) a concrete EXAMPLE
 *     of the filled state (static, decorative, clearly tagged, never sent to
 *     any API), (c) the primary action pre-wired to the real first step.
 *   • Batch accepts pasting a bare URL list from the clipboard — safely:
 *     only the first whitespace-free token per line, http(s)-validated,
 *     deduped, ids continuing from the max existing numeric id (f5/f6).
 *
 * Browser-level behaviour (prefilled-input survival, deep links, paste →
 * save persistence) lives in tests/playwright-car124-empty-states.mjs;
 * batch.js's pure paste helpers are driven here in a vm.
 *
 * i18n: the v2empty.* keys live in ALL 19 locale dicts (review f1) — the
 * CAR124_PENDING allowlist is gone; the parity test below is its replacement.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

const FUNDED = read('public', 'js', 'views', 'funded.js');
const BATCH = read('public', 'js', 'views', 'batch.js');
const APPLY = read('public', 'js', 'views', 'apply.js');
const AUTO = read('public', 'js', 'views', 'auto.js');
const OVERLAYS = read('public', 'css', 'overlays.css');

// ─── shared example-preview component ───

test('CAR-124: overlays.css carries the shared v2-empty example styles, appended at the very END of the cascade', () => {
  const tag = OVERLAYS.indexOf('/* CAR-124');
  assert.ok(tag > -1, 'the CAR-124 CSS block exists');
  assert.ok(OVERLAYS.includes('.v2-empty-example {'), 'the dashed example container');
  // review f9 — a REAL end-of-file assertion: the last rule in the whole
  // stylesheet is the CAR-124 tag pill (nothing may land after the block).
  assert.match(OVERLAYS.trimEnd(), /\.v2-empty-example__tag \{[^}]*\}$/,
    'the CAR-124 block must be the last thing in overlays.css');
  assert.ok(tag > OVERLAYS.indexOf('.v2-stats-tab'), 'appended after the v2-stats block');
});

// ─── batch.js pure paste helpers (review f5/f6, vm-driven) ───

/** Load batch.js in a vm with view stubs; the module-scope helper function
 *  declarations become context globals, Router.register is captured unused. */
function loadBatchModule() {
  const ctx = {
    URL, // host global — not present in a bare vm context
    window: { addEventListener() {} },
    Router: { register() {} },
    API: {}, UI: {},
    I18n: { t: (k, f) => f },
    HelpHint: { title() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(BATCH, ctx, { filename: 'batch.js' });
  return ctx;
}

test('CAR-124 f5: parsePastedUrls takes only the first whitespace-free token, http(s)-validated, deduped', () => {
  const { parsePastedUrls } = loadBatchModule();
  // vm-realm arrays carry a foreign Object.prototype — round-trip via JSON
  // before deepEqual (tests/helpers/i18n-vm.mjs documents the same trap).
  const parse = (s) => JSON.parse(JSON.stringify(parsePastedUrls(s)));
  // a copied spreadsheet row — tabs and notes must NOT reach the url cell
  assert.deepEqual(parse('https://a.com\tFoo\tBar\n'), ['https://a.com']);
  // a trailing prose tail on the same line
  assert.deepEqual(parse('https://b.com/x some notes here'), ['https://b.com/x']);
  // non-http(s) schemes, junk lines and duplicates are dropped
  assert.deepEqual(
    parse('https://a.com\nhttps://a.com\nftp://x.com/y\nnot a url\nmailto:a@b.c'),
    ['https://a.com'],
  );
  assert.deepEqual(parse(''), []);
});

test('CAR-124 f6: nextBatchId continues from the max existing numeric id (header rows / gaps safe)', () => {
  const { nextBatchId } = loadBatchModule();
  assert.equal(nextBatchId('# id\turl\tsource\tnotes\n1\ta\t\n2\tb\t\n7\tc\t'), 8,
    'a header line and non-contiguous ids (1,2,7) must not produce a colliding id');
  assert.equal(nextBatchId('1\ta\n2\tb'), 3);
  assert.equal(nextBatchId(''), 1);
  assert.equal(nextBatchId('# only a comment\n'), 1);
});

// ─── #/funded ───

test('CAR-124 funded: first-run example card (explanation + tagged, decorative sample) paints before any run', () => {
  assert.match(FUNDED, /v2-empty-example/, 'the example preview uses the shared component');
  assert.match(FUNDED, /v2empty\.funded\.emptyBody/, 'a one-line explanation ships in the empty state');
  // review f10 — the aria-hidden must sit on the example CONTAINER itself,
  // not merely somewhere inside the block (the ghost rows carry their own).
  assert.match(FUNDED, /className: 'v2-empty-example',\s*'aria-hidden': 'true'/,
    'the sample card container is aria-hidden');
  // the relay call stays single — sample data never rides it
  assert.equal((FUNDED.match(/API\.get\('\/api\/company-funded'\)/g) || []).length, 1,
    'the discovery endpoint is called exactly once');
});

test('CAR-124 funded: the empty-state CTA runs the SAME discovery flow (one kit run, one cancel guard)', () => {
  assert.match(FUNDED, /function runDiscovery\(/, 'the handler is extracted to a named function');
  const calls = (FUNDED.match(/runDiscovery\(\)/g) || []).length;
  assert.ok(calls >= 2, `both the Discover button and the empty-state CTA call runDiscovery (found ${calls})`);
  assert.equal((FUNDED.match(/LlmPageKit\.run\(/g) || []).length, 1, 'still a single kit run (car119 gate)');
  assert.match(FUNDED, /runCtrl\.cancelled \|\| runCtrl\.signal\.aborted/, 'cancel guard intact');
  assert.match(FUNDED, /emptyHost\.style\.display = 'none'/, 'the example yields to real results');
});

// ─── #/batch ───

test('CAR-124 batch: first-run empty state explains the flow, shows a tagged TSV example row', () => {
  assert.match(BATCH, /v2-empty-example/, 'the example preview uses the shared component');
  assert.match(BATCH, /v2empty\.batch\.emptyBody/, 'a one-line explanation ships in the empty state');
  assert.match(BATCH, /className: 'v2-empty-example',\s*'aria-hidden': 'true'/,
    'the sample row container is aria-hidden (review f10)');
  assert.match(BATCH, /batch\.inputHint/, 'the format explanation reuses the existing editor hint key');
  // review f8 — the card is created once, starts hidden when a TSV exists,
  // and one named sync keeps it in step with the editor.
  assert.match(BATCH, /const emptyCard = c\('div', \{ className: 'card mb-3' \}/, 'a stable card handle exists');
  assert.match(BATCH, /emptyCard\.style\.display = hasInput \? 'none' : ''/, 'initial visibility honours the saved TSV');
  assert.match(BATCH, /function syncEmptyCard\(\)/, 'a named sync exists');
  assert.match(BATCH, /syncEmptyCard\(\); \/\/ review f8/, 'a successful save also ends the empty state');
});

test('CAR-124 batch: the paste pipeline is hardened (review f5/f6/f7)', () => {
  assert.match(BATCH, /navigator\.clipboard\.readText/, 'clipboard read is the paste mechanism');
  assert.match(BATCH, /v2empty\.batch\.pasteList/, 'a labelled Paste-URL-list affordance exists');
  assert.match(BATCH, /v2empty\.batch\.pasteFail/, 'a clipboard-failure toast exists');
  assert.match(BATCH, /v2empty\.batch\.pasteNone/, 'a no-URLs-found toast exists');
  // f7 — programmatic assignment fires no input event; the view announces it
  assert.match(BATCH, /new Event\('input', \{ bubbles: true \}\)/,
    'the programmatic paste dispatches a bubbling input event');
  // f5 — the handler routes through the pure helpers, never raw line filters
  assert.match(BATCH, /parsePastedUrls\(text\)\.filter\(\(u\) => !existing\.includes\(u\)\)/,
    'clipboard tokens are parsed/validated/deduped and nothing already in the editor is re-added');
  assert.match(BATCH, /const startId = nextBatchId\(existing\)/, 'ids continue from the max existing numeric id');
  const guide = 'https://career-ops.org/docs/introduction/guides/batch-evaluate-offers';
  // split-count, not a dynamically built RegExp (CodeQL js/regex alerts)
  assert.ok(BATCH.split(guide).length - 1 >= 2,
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
  assert.match(ex[0], /className: 'v2-empty-example',\s*'aria-hidden': 'true'/,
    'the sample checklist container is aria-hidden (review f10)');
  // decorative boxes are spans, NOT real checkboxes (real ones only come from renderChecklist)
  assert.doesNotMatch(ex[0], /type: 'checkbox'/, 'no live inputs inside the decorative example');
});

// ─── #/auto ───

test('CAR-124 auto: a try-the-example affordance fills an EMPTY field only, with a non-real URL', () => {
  // review f3 — example.com is IETF-reserved: no real company gets a fake
  // posting attributed to it, and a Run on it fails validation, not money.
  assert.match(AUTO, /const EXAMPLE_URL = 'https:\/\/jobs\.example\.com\//,
    'the sample URL uses the reserved example.com host');
  assert.ok(!AUTO.includes('greenhouse.io/anthropic'), 'no real company board in the sample');
  const uses = (AUTO.match(/EXAMPLE_URL/g) || []).length;
  assert.ok(uses >= 3, `the constant feeds the placeholder AND the example button (found ${uses})`);
  // review f4 — the user's own input (incl. ?url= deep links) is never overwritten
  assert.match(AUTO, /if \(urlInput\.value\.trim\(\)\) return;/, 'a filled field is never overwritten');
  assert.match(AUTO, /urlInput\.value = EXAMPLE_URL/, 'an empty field is filled');
  assert.match(AUTO, /v2empty\.auto\.tryExample/, 'the affordance is labelled');
  assert.match(AUTO, /v2empty\.auto\.tryExampleTitle/, 'the tooltip has its own key (review 2)');
  // review 2 — the title/label keys are distinct strings
  assert.match(AUTO, /title: t\('v2empty\.auto\.tryExampleTitle'/, 'the tooltip reads tryExampleTitle');
  // CAR-20 invariant stays: nothing auto-starts a paid run
  assert.doesNotMatch(AUTO, /setTimeout\(run/, 'still no auto-start');
});

test('CAR-124 auto: deep links skip the example block; the empty state explains the timer and links App settings', () => {
  assert.match(AUTO, /params\.get\('url'\)\s*\/\/ review f4[\s\S]{0,40}v2-empty-example|const emptyEl = params\.get\('url'\)/,
    'a ?url= deep link skips the example block');
  assert.match(AUTO, /v2empty\.auto\.hint/, 'a timer/cadence note ships in the empty state');
  assert.match(AUTO, /href: '#\/config'/, 'the note links App settings');
  assert.match(AUTO, /nav\.config/, 'the link reuses the localized App-settings label');
  assert.match(AUTO, /auto\.eta/, 'the timer note reuses the existing ETA key');
});

// ─── i18n (review f1/f2): real translations in ALL 19 dicts, no allowlist ───

test('CAR-124 f1: every v2empty.* key referenced by a view is translated in all 19 locale dicts', () => {
  // the pending-fanout mechanism must be GONE (a historical mention in the
  // protocol comment is fine — the Set and the skip must not exist)
  const COV = read('tests', 'i18n-coverage.test.mjs');
  assert.ok(!COV.includes('const CAR124_PENDING'), 'the CAR124_PENDING allowlist is deleted');
  assert.ok(!COV.includes('CAR124_PENDING.has'), 'no allowlist skip remains');
  // every referenced key exists ×19 — and no orphan v2empty key lingers in a dict
  const DICT = loadAssembledDict();
  const used = new Set();
  for (const src of [FUNDED, BATCH, APPLY, AUTO]) {
    for (const m of src.matchAll(/t\('(v2empty\.[a-zA-Z.]+)'/g)) used.add(m[1]);
  }
  assert.ok(used.size >= 18, `expected the 18 CAR-124 keys, found ${used.size}`);
  for (const key of used) {
    for (const lang of I18N_LANGS) {
      const v = DICT[key] && DICT[key][lang];
      assert.ok(typeof v === 'string' && v.trim(), `${key} must be translated in ${lang}`);
    }
  }
  for (const key of Object.keys(DICT)) {
    if (!key.startsWith('v2empty.')) continue;
    assert.ok(used.has(key), `${key} sits in the dicts but no view references it — drop it`);
  }
  // placeholders survive translation verbatim
  for (const lang of I18N_LANGS) {
    assert.ok(DICT['v2empty.batch.pasteAdded'][lang].includes('{n}'), `pasteAdded.${lang} keeps {n}`);
    assert.ok(DICT['v2empty.auto.hint'][lang].includes('{eta}'), `auto.hint.${lang} keeps {eta}`);
  }
});

test('CAR-124: every v2empty.* call goes through I18n.t with a non-empty EN fallback, marked for the fan-out', () => {
  for (const [name, src] of [['funded.js', FUNDED], ['batch.js', BATCH], ['apply.js', APPLY], ['auto.js', AUTO]]) {
    assert.ok(src.includes('// CAR-124 i18n:'), `${name}: carries the i18n marker`);
    // review f11 — capture may be empty; the ASSERTION is what requires text
    for (const m of src.matchAll(/t\('(v2empty\.[a-zA-Z.]+)'\s*,\s*'([^']*)'/g)) {
      assert.ok(m[2].trim().length > 0, `${name}: ${m[1]} has a non-empty EN fallback`);
    }
    // a v2empty key without a fallback argument is a bug (dicts now own the values)
    for (const m of src.matchAll(/t\('v2empty\.[a-zA-Z.]+'\)/g)) {
      assert.fail(`${name}: ${m[0]} is missing its EN fallback`);
    }
  }
});
