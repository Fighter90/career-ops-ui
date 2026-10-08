/**
 * CAR-21 (BACKLOG v1.243.0 "views-2") — client-defect batch across ten views.
 *
 * The views are browser-only IIFEs/Router registrations, so — per the standing
 * repo convention (router.test.mjs, pipeline-row-action-names.test.mjs,
 * funded-view.test.mjs) — these are static source canaries plus re-derived
 * pure logic. Every assertion below is tied to the concrete fix shape:
 *
 *   1. memory.js        — failed GET no longer swallows into an empty editor
 *                         with Save armed (the overwrite-the-note bug);
 *   2. evaluate.js      — r.warnings (cut-off notice, v1.239.4) rendered;
 *   3. mock-interview.js— session epoch drops stale turns after restart;
 *   4. pipeline.js      — selectUrl latest-wins token;
 *   5. pipeline/health  — async click handlers wrapped + failures toasted;
 *   6. funded/digest/
 *      mode-page        — available:false is reason-aware, not always
 *                         "script not found";
 *   7. portals/
 *      docs-assistant   — Enter guarded in-flight + IME-safe;
 *   8. health.js        — FIX_TARGETS keys match the server check names;
 *   9. pipeline/portals — row keyboard-operable + active repaint; toggle
 *                         aria-labels name the portal;
 *  10. pipeline.js      — overview strip refreshed + server-driven stages.
 *
 * CI-isolated: reads files only; no server, no network, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (p) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const MEM = R('public/js/views/memory.js');
const EVAL = R('public/js/views/evaluate.js');
const MOCK = R('public/js/views/mock-interview.js');
const PIPE = R('public/js/views/pipeline.js');
const HEALTH = R('public/js/views/health.js');
const FUNDED = R('public/js/views/funded.js');
const DIGEST = R('public/js/views/interview-digest.js');
const MODE = R('public/js/views/mode-page.js');
const PORTALS = R('public/js/views/portals.js');
const DOCS = R('public/js/views/docs-assistant.js');
const HEALTH_ROUTE = R('server/lib/routes/health.mjs');

// ─────────────────────────── 1 · memory.js ───────────────────────────

test('memory: a failed GET surfaces an error and never mounts the editor', () => {
  // The swallowed-error shape — `catch { markdown = ''; }` — rendered an
  // EMPTY textarea with Save enabled: one click overwrote the saved note
  // with ''. It must be gone.
  assert.doesNotMatch(MEM, /catch\s*\{\s*markdown\s*=\s*''/,
    'the swallowed-GET shape must be gone');
  const loadAt = MEM.indexOf("API.get('/api/memory')");
  const taAt = MEM.indexOf("c('textarea'");
  assert.ok(loadAt > -1 && taAt > -1, 'both the load and the editor exist');
  const seg = MEM.slice(loadAt, taAt);
  assert.ok(seg.includes('catch (err)'), 'the failed load is caught explicitly');
  assert.ok(seg.includes("role: 'alert'"), 'the error is surfaced to the user');
  assert.ok(seg.includes('return root;'),
    'the view returns early — Save is never mounted off a failed load');
});

// ─────────────────────────── 2 · evaluate.js ─────────────────────────

test('evaluate: r.warnings (cut-off report notice) is rendered in the live branch', () => {
  assert.match(EVAL, /const warnings = Array\.isArray\(r\.warnings\) \? r\.warnings : \[\];/,
    'warnings read from the payload');
  // Rendered in the LIVE branch (after the manual-branch early card) and
  // BEFORE the markdown body, so a cut-off report is named before the user
  // reads it.
  const liveAt = EVAL.indexOf("const failed = typeof r.code === 'number'");
  const warnAt = EVAL.indexOf('Array.isArray(r.warnings)');
  const mdAt = EVAL.indexOf("className: 'md'");
  assert.ok(warnAt > liveAt, 'warnings handled in the live branch');
  assert.ok(warnAt < mdAt, 'the warning banner renders above the report body');
  assert.match(EVAL, /warnings\.map\(/, 'each warning string is rendered');
});

// ─────────────────────── 3 · mock-interview.js ───────────────────────

test('mock-interview: a session epoch drops stale turns after Start / New interview', () => {
  assert.match(MOCK, /let sessionEpoch = 0;/, 'epoch state exists');
  const reqAt = MOCK.indexOf('async function requestTurn');
  const capAt = MOCK.indexOf('const epoch = sessionEpoch');
  const postAt = MOCK.indexOf('/api/mock-interview/turn');
  assert.ok(reqAt > -1 && capAt > reqAt && capAt < postAt,
    'requestTurn tags itself with the epoch BEFORE awaiting');
  assert.ok((MOCK.match(/epoch !== sessionEpoch/g) || []).length >= 2,
    'both the success and the error path drop stale responses');
  assert.match(MOCK, /epoch === sessionEpoch/,
    'buttons/scroll are only restored for the current epoch');
  assert.ok((MOCK.match(/sessionEpoch\+\+/g) || []).length >= 2,
    'both Start and New interview invalidate in-flight turns');
});

// ─────────────────────────── 4 · pipeline.js ─────────────────────────

test('pipeline: selectUrl has a latest-wins token', () => {
  assert.match(PIPE, /let selectToken = 0;/, 'token state exists');
  assert.match(PIPE, /const token = \+\+selectToken;/,
    'each selection claims a token');
  const awaitAt = PIPE.indexOf("API.get('/api/pipeline/preview");
  const staleAt = PIPE.indexOf('if (token !== selectToken) return;');
  const bodyAt = PIPE.indexOf('previewBody = (r.text');
  assert.ok(awaitAt > -1 && staleAt > awaitAt && staleAt < bodyAt,
    'a superseded response must not write preview state');
  assert.match(PIPE, /if \(token === selectToken\) \{\s*previewLoading = false;\s*renderPreview\(\);/,
    'only the newest selection renders the preview');
});

// ─────────────── 5 · pipeline.js + health.js async clicks ────────────

test('pipeline: both delete handlers wrap their awaits and toast failures', () => {
  let sites = 0;
  for (const m of PIPE.matchAll(/API\.del\('\/api\/pipeline/g)) {
    sites += 1;
    const before = PIPE.slice(Math.max(0, m.index - 260), m.index);
    const after = PIPE.slice(m.index, m.index + 460);
    assert.ok(before.includes('try {'), `delete site ${sites}: awaits wrapped in try`);
    assert.ok(after.includes('catch (err)'), `delete site ${sites}: caught`);
    assert.ok(after.includes('UI.toast'), `delete site ${sites}: failure surfaced`);
  }
  assert.equal(sites, 2, 'two delete call sites (preview pane + row)');
});

test('health: doctor/verify buttons catch failures, toast, and clear the progress toast', () => {
  let sites = 0;
  for (const m of HEALTH.matchAll(/API\.post\('\/api\/run\/(doctor|verify)'/g)) {
    sites += 1;
    const before = HEALTH.slice(Math.max(0, m.index - 220), m.index);
    const after = HEALTH.slice(m.index, m.index + 900);
    assert.ok(before.includes('try {'), `${m[1]}: await wrapped in try`);
    assert.ok(after.includes('catch (err)'), `${m[1]}: caught`);
    assert.ok(after.includes('UI.dismissToast()'),
      `${m[1]}: the "Running…" toast is cleared on failure too`);
    assert.ok(after.includes('UI.toast'), `${m[1]}: failure surfaced`);
  }
  assert.equal(sites, 2, 'both the doctor and the verify buttons');
});

// ───────── 6 · funded / interview-digest / mode-page reasons ─────────

test("available:false is reason-aware — 'script-not-found' vs timeout/script-error", () => {
  for (const [name, src] of [['funded.js', FUNDED], ['interview-digest.js', DIGEST], ['mode-page.js', MODE]]) {
    assert.match(src, /reason === 'script-not-found'/,
      `${name}: branches on the reason instead of always saying "not found"`);
    assert.match(src, /\.detail \|\| reason/,
      `${name}: surfaces the server's sanitized detail (or the raw reason)`);
  }
});

// ───────────── 7 · portals / docs-assistant Enter + IME ──────────────

test('portals: Enter discovery is IME-safe and cannot bypass the in-flight guard', () => {
  assert.match(PORTALS, /isComposing|keyCode === 229/,
    'composition Enter is not a submit');
  const fnAt = PORTALS.indexOf('async function runDiscover');
  const guardAt = PORTALS.indexOf('if (discBtn.disabled) return;');
  assert.ok(fnAt > -1 && guardAt > fnAt,
    'runDiscover itself carries the in-flight guard');
  assert.ok(guardAt < PORTALS.indexOf('discInput.value.trim()'),
    'the guard fires before validation/toast noise');
});

test('docs-assistant: send() is in-flight-guarded; Enter is IME-safe', () => {
  const sendAt = DOCS.indexOf('async function send');
  const guardAt = DOCS.indexOf('if (askBtn.disabled) return;');
  assert.ok(sendAt > -1 && guardAt > sendAt, 'send() refuses re-entry');
  assert.ok(guardAt < DOCS.indexOf('const question = input.value.trim()'),
    'the guard fires before any state change');
  assert.match(DOCS, /isComposing|keyCode === 229/,
    'composition Enter is not a submit');
});

// ──────────────── 8 · health.js FIX_TARGETS alignment ────────────────

test('health: FIX_TARGETS keys are exact /api/health check names', () => {
  const block = HEALTH.match(/const FIX_TARGETS = \{([\s\S]*?)\};/);
  assert.ok(block, 'FIX_TARGETS object exists');
  const keys = Array.from(block[1].matchAll(/^\s*'([^']+)':/gm), (m) => m[1]);
  assert.ok(keys.length > 0, 'keys parsed');
  // Every name the server pushes: literal name: pushes + the provider-key
  // roster loop (['DEEPSEEK_API_KEY', hasDeepSeekKey()], …).
  const serverNames = new Set([
    ...Array.from(HEALTH_ROUTE.matchAll(/checks\.push\(\{\s*name:\s*'([^']+)'/g), (m) => m[1]),
    ...Array.from(HEALTH_ROUTE.matchAll(/^\s+\['([A-Z_]+)',\s*has[A-Za-z]+\(\)\],/gm), (m) => m[1]),
  ]);
  assert.ok(serverNames.has('cv.md') && serverNames.has('portals.yml'),
    'server name extraction is real (sanity)');
  for (const k of keys) {
    assert.ok(serverNames.has(k), `FIX_TARGETS key "${k}" is a real /api/health check name`);
  }
  // The two stale keys matched no check — their Fix links never rendered.
  assert.ok(!keys.includes('cv.md non-empty'), "stale key 'cv.md non-empty' gone");
  assert.ok(!keys.includes('portals.yml present'), "stale key 'portals.yml present' gone");
});

// ─────────── 9 · pipeline row a11y + active repaint; portals ─────────

test('pipeline: rows are keyboard-operable buttons and the selection repaints', () => {
  const rowAt = PIPE.indexOf('function urlRow');
  const rowEnd = PIPE.indexOf('function paintWindow', rowAt);
  const row = PIPE.slice(rowAt, rowEnd);
  assert.match(row, /role: 'button'/, 'the row exposes a button role');
  assert.match(row, /tabindex: '0'/, 'the row is focusable');
  assert.match(row, /onKeyDown/, 'Enter/Space activates the row');
  assert.match(row, /aria-pressed/, 'the row announces its selected state');
  // The click handler lives on the ROW (the inner mouse-only div is gone).
  assert.match(row, /onClick: \(\) => selectUrl\(url\)/,
    'the row itself carries the activation handler');
  // Selecting repaints the list so the active highlight follows the click.
  const selAt = PIPE.indexOf('async function selectUrl');
  const selEnd = PIPE.indexOf('function urlRow', selAt);
  const sel = PIPE.slice(selAt, selEnd);
  assert.match(sel, /if \(vVirtual\) paintWindow\(\); else renderList\(\);/,
    'the active highlight is repainted on selection');
  assert.match(sel, /focus\(\)/,
    'focus is restored to the (re-rendered) active row');
});

test('portals: toggle buttons announce WHICH portal they toggle', () => {
  assert.match(PORTALS, /'aria-label':\s*\(isOn \? t\('portals\.disable', 'Disable'\) : t\('portals\.enable', 'Enable'\)\)/,
    'the label is built from the state');
  assert.match(PORTALS, /\+ ': ' \+ \(company\.name \|\| company\.careers_url\)/,
    '…and disambiguated by the company');
});

// ─────────────── 10 · pipeline overview strip ────────────────────────

test('pipeline: the overview strip is server-staged and refreshed', () => {
  assert.match(PIPE, /api\/tracker\/stages/,
    'canonical stages come from the server, not a hard-coded list');
  assert.match(PIPE, /window\.TrackerStages/, 'TrackerStages is used for counts');
  assert.doesNotMatch(PIPE, /\['Applied',\s*'Responded',\s*'Interview',\s*'Offer'\]/,
    'the hard-coded English stage list is gone');
  const refreshAt = PIPE.indexOf('async function refresh');
  const refreshEnd = PIPE.indexOf("filterInput.addEventListener", refreshAt);
  const refresh = PIPE.slice(refreshAt, refreshEnd);
  assert.match(refresh, /paintOverview\(\)/, 'refresh() repaints the strip');
  assert.match(refresh, /api\/tracker'/, 'refresh() re-reads tracker rows');
});
