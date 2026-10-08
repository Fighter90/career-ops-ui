/**
 * CAR-20 (v1.243.0 views-1) — client-defect batch across the ten
 * first-party views (cv, cv-studio, dashboard, config, career-plan,
 * auto, batch, activity, deep, apply).
 *
 * Views are browser classic scripts → asserted statically, this repo's
 * established pattern (qa-report-fixes.test.mjs / auto-screen.test.mjs).
 * The two pure-logic changes — deep.js's looksLikeStructuredBrief
 * tolerance and its safeName() download sanitizer — are sliced out and
 * executed in isolation (cv-single-h1.test.mjs style) so behavior is
 * exercised, not just pattern-matched.
 *
 * CI-isolated: file reads only, no server, no network, no DOM.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(__d, '..', 'public', 'js', 'views', p), 'utf8');
const CV = read('cv.js');
const CVS = read('cv-studio.js');
const DASH = read('dashboard.js');
const CONFIG = read('config.js');
const PLAN = read('career-plan.js');
const AUTO = read('auto.js');
const BATCH = read('batch.js');
const ACT = read('activity.js');
const DEEP = read('deep.js');
const APPLY = read('apply.js');

const head = (src, marker = 'Router.register') => src.slice(0, src.indexOf(marker));

// ─── [H] cv.js — the unsaved-changes guard must preserve edits ───

test('CAR-20 [H] cv.js: unsaved edits survive a re-render via a module-level buffer', () => {
  // 1. The buffer lives at MODULE scope so it outlives one render call.
  assert.match(head(CV), /let cvDirtyBuffer\s*=\s*null/,
    'module-level dirty buffer must be declared before Router.register');
  // 2. The editor is re-seeded from the buffer, with the server copy as
  //    the dirty baseline (a restored buffer still reads as dirty).
  assert.match(CV, /if \(hasBuffer\) data\.markdown = cvDirtyBuffer;/,
    'the editor must be hydrated from the restored buffer');
  assert.match(CV, /initial = serverMarkdown;/,
    'restored baseline must be the server copy, not the buffer itself');
  // 3. Every input keeps the buffer in sync (and drops it on revert).
  assert.match(CV, /cvDirtyBuffer = cvDirty \? ta\.value : null;/,
    'input must write the buffer, clearing it when back to baseline');
  // 4. A successful Save clears the buffer.
  assert.match(CV, /API\.put\('\/api\/cv'[\s\S]{0,300}?cvDirtyBuffer = null;/,
    'save must clear the module buffer');
});

test('CAR-20 [H] cv.js: the leave-guard keys on the exact #/cv hash (no #/cv-studio bypass)', () => {
  assert.match(head(CV), /const cvRouteHash = \(\) =>/,
    'a query-tolerant exact-hash helper must exist at module scope');
  assert.match(CV, /cvRouteHash\(\) !== '#\/cv'/,
    'the guard must compare the full route hash, not a prefix');
  // startsWith('#/cv') also matched '#/cv-studio': leaving to the studio
  // skipped the confirm AND leaked the listeners forever.
  assert.doesNotMatch(CV, /startsWith\('#\/cv'\)/,
    'prefix matching must be gone (it swallowed #/cv-studio)');
});

test('CAR-20 [H] cv.js: guard listeners are single-instance across re-renders', () => {
  // Router.render() re-runs the handler (language switch, cancel-rewind);
  // the previous instance's guards must be detached or a stale textarea
  // keeps prompting on tab close.
  assert.match(CV, /cvGuardDetach\(\);/,
    'the previous view instance guards must be dropped before re-registering');
  assert.match(CV, /window\.addEventListener\('beforeunload', onBeforeUnload\);/);
  assert.match(CV, /window\.addEventListener\('hashchange', onHashChange\);/);
});

// ─── [M] cv.js — save paths surface errors ───

test('CAR-20 [M] cv.js: Save failures surface a toast (no unhandled rejection)', () => {
  const save = CV.match(/if \(!ta\.value\.trim\(\)\)[\s\S]*?common\.save/);
  assert.ok(save, 'the Save handler block must exist');
  assert.match(save[0], /try \{[\s\S]*\} catch \(err\) \{[\s\S]*UI\.toast\(\(err && err\.message\)/,
    'Save must wrap the PUT in try/catch and toast the error');
});

test('CAR-20 [M] cv.js: sync-check failures surface a toast', () => {
  const sync = CV.match(/cv\.syncCheckRunning[\s\S]*?cv\.syncCheck', 'sync-check'\)\)/);
  assert.ok(sync, 'the sync-check handler block must exist');
  assert.match(sync[0], /try \{[\s\S]*\} catch \(err\) \{/,
    'sync-check must wrap the POST in try/catch');
});

test('CAR-20 [M] cv.js: X-Filename is ASCII-safe for non-Latin1 filenames', () => {
  // A header value outside ISO-8859-1 ('Резюме.pdf') makes fetch throw
  // TypeError before a byte leaves the browser. encode; the server only
  // needs the extension hint, which encodeURIComponent preserves.
  assert.match(CV, /'X-Filename':\s*encodeURIComponent\(file\.name\)/,
    'the import header must be percent-encoded');
  assert.doesNotMatch(CV, /'X-Filename':\s*file\.name/,
    'the raw filename must not go on the wire');
});

// ─── [M] dashboard.js ───

test('CAR-20 [M] dashboard.js: header Refresh re-renders in place (same-hash go() is a no-op)', () => {
  assert.doesNotMatch(DASH, /Router\.go\(['"]\/dashboard['"]\)/,
    'Router.go to the CURRENT hash fires no hashchange — no re-render');
  const refresh = DASH.match(/data-test':\s*'dash-refresh'[\s\S]*?'common\.refresh'/);
  assert.ok(refresh, 'refresh button block must exist');
  assert.match(refresh[0], /Router\.render\(\)/,
    'the refresh handler must call Router.render()');
});

test('CAR-20 [M] dashboard.js: quick-action tiles carry live counts', () => {
  // The dict overrides the fallback strings, so counts passed as
  // fallback text never reached the screen. Counts must be appended
  // from the dashboard payload itself.
  assert.match(DASH, /QA_COUNTS/, 'a route→count map must exist');
  assert.match(DASH, /'\/pipeline': data\.counts\.pipeline/);
  assert.match(DASH, /'\/tracker': data\.counts\.applications/);
  assert.match(DASH, /'\/reports': data\.counts\.reports/);
  assert.match(DASH, /' · ' \+ count/, 'the count must be appended to the sub label');
});

test('CAR-20 [M] dashboard.js: pipeline card no longer renders local: entries as dead links', () => {
  const card = DASH.match(/function pipelineCard\(urls\) \{[\s\S]*?\n\}/);
  assert.ok(card, 'pipelineCard must exist');
  assert.match(card[0], /\/\^https\?:|startsWith\('http'\)/i,
    'only http(s) entries may become anchors');
  assert.match(card[0], /c\('span'/,
    'non-http (local:) entries must render as a plain tag, not a dead <a>');
});

// ─── [M] config.js ───

test('CAR-20 [M] config.js: providers-changed listener is scoped to the route lifetime', () => {
  assert.match(CONFIG, /document\.addEventListener\('providers-changed', refreshApiSummary\)/,
    'the subscription itself stays');
  assert.match(CONFIG, /document\.removeEventListener\('providers-changed', refreshApiSummary\)/,
    'every visit used to stack one more listener forever — cleanup required');
  assert.match(CONFIG, /window\.addEventListener\('hashchange', providersCleanup\)/,
    'cleanup rides the existing hashchange flow');
});

test('CAR-20 [M] config.js: a failed Modes/Profile load can no longer be saved over the file', () => {
  assert.doesNotMatch(CONFIG, /'# error: '/,
    'an error string must never sit in a textarea wired to a whole-file save');
  assert.match(CONFIG, /if \(!modesLoaded\) \{[\s\S]{0,120}?modesLoadError/,
    'saveModes must refuse until the content actually loaded');
  assert.match(CONFIG, /modesSaveBtn\.disabled = false;/,
    'the Modes Save button starts disabled and is enabled only on a successful load');
  assert.match(CONFIG, /modesRawSaveBtn\.disabled = false;/,
    'the raw-YAML Save button is gated the same way');
  assert.match(CONFIG, /if \(!profileLoaded\) \{[\s\S]{0,120}?return;/,
    'saveProfile must refuse while the form never loaded (blank-merge data loss)');
});

// ─── [M]/[H] career-plan.js ───

test('CAR-20 [H] career-plan.js: an edited/generated plan survives a re-render', () => {
  assert.match(head(PLAN), /let planBuffer = null;/,
    'the unsaved plan buffer lives at module scope');
  assert.match(PLAN, /editor\.value = planBuffer != null \? planBuffer : saved;/,
    'the editor is re-seeded from the buffer on every render');
  assert.match(PLAN, /planBuffer = editor\.value === saved \? null : editor\.value;/,
    'input keeps the buffer in sync, dropping it on revert-to-saved');
  assert.match(PLAN, /planBuffer = null;[\s\S]{0,200}?plan\.saved/,
    'a successful save clears the buffer');
});

test('CAR-20 [M] career-plan.js: load failure surfaces; Save is gated until content loads', () => {
  assert.match(PLAN, /planLoadError/, 'the load error must be captured');
  assert.match(PLAN, /if \(!planLoaded\) \{[\s\S]{0,120}?return;/,
    'savePlan must refuse when the plan never loaded (blank overwrite)');
  assert.match(PLAN, /disabled: !planLoaded && planBuffer == null/,
    'Save starts disabled until the plan actually loads (or a buffer exists)');
  assert.match(PLAN, /planLoadError\)/, 'the error is surfaced in the view');
});

// ─── [M] cv-studio.js ───

test('CAR-20 [M] cv-studio.js: a CV-load failure no longer masquerades as "no CV yet"', () => {
  assert.match(CVS, /cvLoadError/, 'the CV load error must be captured');
  const errIdx = CVS.indexOf('cvLoadError');
  const emptyIdx = CVS.indexOf('cvs.noCv');
  assert.ok(errIdx > -1 && emptyIdx > -1 && errIdx < emptyIdx,
    'the error branch must render before (instead of) the empty-state');
});

test('CAR-20 [M] cv-studio.js: a JD-list failure no longer reads as "no saved JDs yet"', () => {
  assert.match(CVS, /jdListError/, 'the JD-list load error must be captured');
  const branch = CVS.match(/jdListError\s*\?[\s\S]{0,240}?cvs\.gapNoJds/);
  assert.ok(branch, 'the empty-state copy must yield to the error on failure');
});

// ─── [L] activity.js ───

test('CAR-20 [L] activity.js: load() is token-guarded, awaited, and toasts failures', () => {
  assert.match(ACT, /let loadToken = 0;/, 'a request token must exist');
  assert.match(ACT, /\+\+loadToken/, 'each load claims a token');
  assert.match(ACT, /myToken !== loadToken[\s\S]{0,40}?return;/,
    'stale responses must be dropped');
  const fn = ACT.match(/async function load\(\) \{[\s\S]*?\n {2}\}/);
  assert.ok(fn, 'load() must exist');
  assert.match(fn[0], /try \{[\s\S]*\} catch \(err\) \{/, 'load() must catch its own failures');
  assert.match(ACT, /onClick: async \(e\) => \{[\s\S]*?await load\(\);/,
    'the filter click must await the reload');
});

// ─── [L] deep.js ───

test('CAR-20 [L] deep.js: brief-structure warning tolerates numbered + localized headings', () => {
  const src = DEEP.match(/function looksLikeStructuredBrief\(md\) \{[\s\S]*?\n {2}\}/);
  assert.ok(src, 'helper must exist');
  const fn = new Function(src[0] + '\nreturn looksLikeStructuredBrief;')();
  const numbered = ['## 1. Company snapshot', '## 2. Engineering culture', '## 3. Recent news',
    '## 4. Glassdoor', '## 5. Interview process', '## 6. Negotiation leverage'].join('\n');
  assert.equal(fn(numbered), true, 'numbered canonical headings must not warn');
  const localized = ['## Обзор компании', '## Инженерная культура', '## Последние новости',
    '## Glassdoor', '## Процесс интервью', '## Переговоры'].join('\n');
  assert.equal(fn(localized), true, 'a fully-sectioned localized brief must not warn');
  assert.equal(fn('## Company snapshot\n## Engineering culture\n## Glassdoor\nbody'), true,
    'plain canonical headings still pass');
  assert.equal(fn('Here is what I found about Acme.\n\nThey are a company.'), false,
    'meta-narration with no section skeleton still warns');
});

test('CAR-20 [L] deep.js: empty-output message prefers the server message', () => {
  assert.match(DEEP, /showPrompt\(r\.prompt,\s*r\.message \|\| t\('deep\.geminiNoOutput'/,
    'the provider-neutral server message wins; the Gemini wording is only a fallback');
});

test('CAR-20 [L] deep.js: clipboard writes are awaited with a failure path', () => {
  const copies = DEEP.match(/onClick: async \(\) => \{\s*try \{\s*await navigator\.clipboard\.writeText/g) || [];
  assert.ok(copies.length >= 2, 'both Copy buttons (brief + prompt) await writeText');
  assert.match(DEEP, /auto\.copyFail/, 'writeText failure must surface the manual-copy hint');
});

test('CAR-20 [L] deep.js: download filename keeps unicode (no \\w-only smash)', () => {
  assert.doesNotMatch(DEEP, /\[\^\\w\.\-\]/,
    "the old [^\\w.-]→'_' regex destroyed every non-ASCII name");
  const src = DEEP.match(/function safeName\(name, fallback\) \{[\s\S]*?\n {2}\}/);
  assert.ok(src, 'safeName must exist');
  const f = new Function(src[0] + '\nreturn safeName;')();
  assert.equal(f('Резюме — senior backend', 'deep'), 'Резюме — senior backend',
    'unicode titles survive intact');
  assert.equal(f('a/b\\c:d*e?f"g<h>i|j', 'deep'), 'a b c d e f g h i j',
    'filesystem-unsafe characters are neutralised');
  assert.equal(f('', 'deep') + '.md', 'deep.md', 'empty names fall back');
  assert.match(DEEP, /safeName\(opts\.saved, 'deep\.md'\)|safeName\(title, 'deep'\)/,
    'the download attribute goes through safeName');
});

// ─── [L] apply.js ───

test('CAR-20 [L] apply.js: run() is single-flight and reads inputs before awaiting', () => {
  const fn = APPLY.match(/async function run\(\) \{[\s\S]*?\n {2}\}/);
  assert.ok(fn, 'run() must exist');
  assert.match(fn[0], /if \(running\) return;/, 're-entry guard required');
  assert.match(fn[0], /const urlVal = url\.value\.trim\(\);/);
  assert.match(fn[0], /const jdVal = jd\.value\.trim\(\);/);
  assert.ok(fn[0].indexOf('const urlVal') < fn[0].indexOf('await API.post'),
    'inputs must be captured BEFORE the await (the user can edit mid-flight)');
  assert.match(fn[0], /substitutePlaceholders\(r\.checklist, urlVal, jdVal\)/,
    'post-await consumers must use the captured values');
  assert.match(fn[0], /runBtn\.disabled = false;/, 'the button re-enables in finally');
  assert.match(APPLY, /const runBtn = c\('button'/, 'the Run button is a tracked element');
});

// ─── [L] batch.js ───

test('CAR-20 [L] batch.js: the runner is single-flight and its stream is tracked', () => {
  assert.match(BATCH, /let batchRunning = false;/, 'in-flight flag required');
  assert.match(BATCH, /let batchStream = null;/, 'the EventSource must be tracked');
  const fn = BATCH.match(/function runRunner\(\) \{[\s\S]*?\n {2}\}/);
  assert.ok(fn, 'runRunner must exist');
  assert.match(fn[0], /if \(batchRunning\) return;/, 'second concurrent runner must be refused');
  assert.match(fn[0], /runBtn\.disabled = true;/, 'Run must be disabled in-flight');
  assert.match(fn[0], /batchStream = API\.stream/, 'the stream handle is kept');
  assert.match(BATCH, /const finishRunner = \(\) => \{[\s\S]*?batchRunning = false;/,
    'a single finish path re-enables Run');
});

test('CAR-20 [L] batch.js: the TSV row count re-renders after save/run/merge', () => {
  assert.match(BATCH, /function renderRowsCount\(\)/, 'a dedicated row-count renderer must exist');
  const calls = BATCH.match(/renderRowsCount\(\)/g) || [];
  assert.ok(calls.length >= 4,
    `row count must re-render at initial + save + done + merge (found ${calls.length})`);
});

// ─── [M] auto.js ───

test('CAR-20 [M] auto.js: ?go=1 no longer auto-starts a paid run', () => {
  assert.doesNotMatch(AUTO, /setTimeout\(run/,
    'a query parameter must never trigger a paid LLM run without a click');
  assert.doesNotMatch(AUTO, /params\.get\('go'\)/,
    'the go=1 gate is gone entirely (the visible Run button is the gate)');
  assert.match(AUTO, /params\.get\('url'\)/,
    'the URL prefill for deep links stays');
});

// ─── behavioral smoke: the [H] restore flow, EXECUTED ─────────────────
// Static canaries lock the wiring; this executes the real cv.js against
// a minimal fake DOM (same new-Function pattern as followup-view.test.mjs
// / cv-single-h1.test.mjs) so the buffer state machine itself is locked:
// edit → decline-leave → re-render restores; confirm-leave discards.

function cvFakeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), children: [], style: {}, dataset: {}, attributes: {},
    listeners: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); }, remove(c) { this._set.delete(c); },
      toggle(c, on) { (on === undefined ? !this._set.has(c) : on) ? this._set.add(c) : this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] ?? null; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    replaceChildren(...cs) { this.children = cs; },
    addEventListener(k, fn) { (this.listeners[k] ||= []).push(fn); },
    removeEventListener() {},
    querySelector() { return cvFakeEl('div'); }, querySelectorAll() { return []; },
    remove() {}, click() {}, focus() {}, select() {}, scrollIntoView() {},
    isConnected: true, hidden: false, disabled: false,
    value: '', checked: false, textContent: '', innerHTML: '', title: '',
  };
  Object.defineProperty(el, 'firstChild', { get() { return this.children[0] ?? null; } });
  return el;
}

test('CAR-20 [H] cv.js executed: decline-leave restores edits, confirm-leave discards them', async () => {
  const winListeners = {};
  const location = { hash: '#/cv' };
  let confirmAnswer = false; // user declines the leave prompt
  const windowStub = {
    location,
    addEventListener(k, fn) { (winListeners[k] ||= []).push(fn); },
    removeEventListener(k, fn) {
      const a = winListeners[k] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
    },
    confirm: () => confirmAnswer,
  };
  const documentStub = {
    createElement: (t) => cvFakeEl(t), createTextNode: (s) => ({ text: s }),
    body: cvFakeEl('body'), getElementById() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, hidden: false, title: '',
  };
  const I18n = { t: (k, f) => (f != null ? f : k), getLang: () => 'en' };
  const UI = {
    el(tag, attrs, children) {
      const e = cvFakeEl(tag);
      if (attrs) for (const [k, v] of Object.entries(attrs)) {
        if (k === 'className') e.className = v;
        else if (k === 'style') Object.assign(e.style, v);
        else if (k === 'html') e.innerHTML = v;
        else if (v !== false && v != null && !k.startsWith('on')) e.setAttribute(k, v);
      }
      if (children) for (const ch of [].concat(children)) {
        if (ch == null || ch === false) continue;
        e.appendChild(typeof ch === 'string' ? { text: ch } : ch);
      }
      if (tag === 'textarea') {
        const first = e.children[0];
        if (first && typeof first.text === 'string') e.value = first.text;
      }
      return e;
    },
    toast() {}, dismissToast() {}, modal() {}, withSpinner(_b, fn) { return fn(); },
    md: (s) => String(s ?? ''), escapeHtml: (s) => String(s ?? ''),
  };
  let cvPayload = { markdown: '# Jane\n' };
  const API = {
    // Fresh object per call — mirrors api.js (res.json() parses anew), so
    // the view's local `data` mutation can never leak across renders.
    get: async (p) => (p === '/api/cv' ? JSON.parse(JSON.stringify(cvPayload)) : {}),
    post: async () => ({}), put: async () => ({}),
    stream() { return { close() {} }; },
  };
  const routes = {};
  const Router = { register(n, f) { routes[n] = f; }, render() {}, go() {}, current: () => ({ name: 'cv', rawName: 'cv', params: [] }) };
  new Function('window', 'document', 'Router', 'API', 'UI', 'I18n', 'location', 'navigator', CV)(
    windowStub, documentStub, Router, API, UI, I18n, location,
    { clipboard: { writeText: async () => {} } });
  assert.ok(routes.cv, 'cv route registered');

  const findById = (node, id, out = []) => {
    if (!node || typeof node !== 'object') return out;
    if (node.attributes && node.attributes.id === id) out.push(node);
    for (const ch of node.children || []) findById(ch, id, out);
    return out;
  };
  const fire = (el, type) => (el.listeners[type] || []).forEach((fn) => fn({ target: el, currentTarget: el, preventDefault() {} }));

  // Render 1 — user edits, then leaves; declines the prompt.
  location.hash = '#/cv';
  let root = await routes.cv([]);
  const ta1 = findById(root, 'cv-editor')[0];
  assert.equal(ta1.value, '# Jane\n', 'editor hydrated from the server copy');
  ta1.value = '# Jane\nEdited line\n';
  fire(ta1, 'input');
  location.hash = '#/help';
  winListeners.hashchange.slice().forEach((fn) => fn());
  assert.equal(location.hash, '#/cv', 'declined leave rewinds the hash');
  assert.equal(winListeners.hashchange.length, 0, 'cancel detaches the guard pair');

  // Render 2 (the rewind) — the buffer must come back, still dirty.
  root = await routes.cv([]);
  const ta2 = findById(root, 'cv-editor')[0];
  assert.equal(ta2.value, '# Jane\nEdited line\n', 're-render restores the unsaved buffer');
  const dirtyButtons = [];
  (function walk(n) {
    if (!n || typeof n !== 'object' || !n.classList || !n.classList._set) return;
    if (n.classList._set.has('btn-dirty')) dirtyButtons.push(n);
    (n.children || []).forEach(walk);
  })(root);
  assert.ok(dirtyButtons.length >= 1, 'restored buffer renders the Save button dirty');

  // In-place re-render (language switch: no hashchange) keeps it too.
  root = await routes.cv([]);
  assert.equal(findById(root, 'cv-editor')[0].value, '# Jane\nEdited line\n',
    'in-place re-render keeps the buffer');

  // Leave again, this time confirming — the buffer must be discarded.
  confirmAnswer = true;
  location.hash = '#/help';
  winListeners.hashchange.slice().forEach((fn) => fn());
  assert.equal(winListeners.hashchange.length, 0, 'confirm detaches the guard pair');
  root = await routes.cv([]);
  assert.equal(findById(root, 'cv-editor')[0].value, '# Jane\n',
    'confirmed leave discards the buffer (server copy wins)');
  assert.equal(winListeners.hashchange.length, 1,
    'the freshly rendered view carries exactly one active guard pair');
});
