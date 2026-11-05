/**
 * CAR-244.4 — the global "server is not responding" banner is a LAST-RESORT
 * signal, not a per-request one.
 *
 * Before: EVERY network-rejected request flipped #conn-banner on immediately
 * (api.js call() → setConnectionState(true) on the first catch). One dropped
 * request — a laptop waking from sleep, a momentary proxy hiccup — drowned
 * the whole app in the outage banner even though the next request would have
 * succeeded, and the actual failure surface the user needed (the view's
 * error toast with the (METHOD /path) diagnostic) got visually buried.
 *
 * The contract now:
 *   1. a SINGLE failed request  → thrown error only (the view toasts it); NO banner.
 *   2. the SECOND consecutive failure (any path) → banner. Any success
 *      resets the streak, so one-off flaps never escalate.
 *   3. a failed /api/health probe → banner on the FIRST failure (it IS the
 *      outage signal).
 *   4. recovery still clears the banner (any success while it is up, and
 *      the backoff health ping keeps its existing behaviour).
 *
 * Harness: api.js runs unmodified in a node:vm realm against a minimal DOM
 * stub (same pattern as overlay-nav-close.test.mjs). The realm's timers are
 * no-ops so the health-ping backoff loop never runs; `fetch` is a test-
 * controlled stub swapped between scenarios via the realm's global.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_SRC = readFileSync(resolve(ROOT, 'public', 'js', 'api.js'), 'utf8');

// ───────────────────────── mini-DOM stub ─────────────────────────

function makeEl(tag) {
  const el = {
    tag,
    children: [],
    attrs: {},
    style: {},
    dataset: {},
    disabled: false,
    hidden: false,
    className: '',
    _listeners: {},
    classList: {
      contains: (c) => String(el.className).split(/\s+/).includes(c),
    },
    appendChild(ch) { if (ch != null) el.children.push(ch); return ch; },
    addEventListener(type, fn) { (el._listeners[type] ||= []).push(fn); },
    removeEventListener() {},
    dispatch(type, ev = {}) { for (const fn of [...(el._listeners[type] || [])]) fn({ target: el, ...ev }); },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    removeAttribute(k) { delete el.attrs[k]; },
    // setConnectionState writes banner.querySelector('.conn-msg').textContent
    querySelector(sel) {
      if (sel === '.conn-msg') return el._connMsg ||= { textContent: '' };
      return null;
    },
    querySelectorAll() { return []; },
    focus() {},
    get textContent() { return el.children.map((n) => (typeof n === 'string' ? n : n.textContent ?? '')).join(''); },
    set textContent(v) { el.children = [{ textContent: v }]; },
    get innerHTML() { return el._html ?? ''; },
    set innerHTML(v) { el._html = String(v); el.children = []; },
  };
  return el;
}

function makeDocument() {
  const byId = new Map();
  const doc = {
    title: '',
    hidden: true, // keep the visibilitychange re-check inert
    activeElement: null,
    getElementById(id) {
      if (!byId.has(id)) byId.set(id, makeEl('div'));
      return byId.get(id);
    },
    createElement: (tag) => makeEl(tag),
    createTextNode: (t) => ({ textContent: t }),
    contains: () => false,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {},
  };
  // index.html ships the banner HIDDEN (<div id="conn-banner" hidden …>).
  const banner = makeEl('div');
  banner.hidden = true;
  byId.set('conn-banner', banner);
  return { doc, byId };
}

/**
 * Boot api.js unmodified. `fetchImpl` is test-controlled and swappable: the
 * realm's bare `fetch` resolves the context property at call time, so tests
 * reassign `realm.setFetch(...)` between scenarios. Realm timers are no-ops
 * (CI isolation) — the health-ping loop can never fire on its own.
 */
function bootRealm() {
  const win = {
    location: { origin: 'http://127.0.0.1:4317' },
    addEventListener() {},
    removeEventListener() {},
  };
  const { doc, byId } = makeDocument();
  const ctx = createContext({
    window: win,
    document: doc,
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    fetch: () => Promise.reject(new Error('no fetch installed')),
  });
  runInContext(API_SRC, ctx);
  ctx.UI = ctx.window.UI;
  return {
    ctx,
    API: ctx.window.API,
    banner: () => byId.get('conn-banner'),
    setFetch(fn) { ctx.fetch = fn; },
  };
}

const okResponse = () => ({ ok: true, status: 200, text: async () => '{}' });

// api.js exports API.{get,post,put,del} wrappers around call().
function caller(realm, method, path) {
  const name = method.toLowerCase();
  const fn = realm.API[name];
  assert.ok(typeof fn === 'function', `API.${name} exists`);
  return () => fn.call(realm.API, path);
}

// ───────────── source-static pins (cheap drift guards) ─────────────

test('source: the failure counter exists and gates the banner on the health path or streak ≥ 2', () => {
  assert.match(API_SRC, /let _failStreak = 0;/, 'the counter is declared');
  assert.match(API_SRC, /_failStreak \+= 1;/, 'every network rejection counts');
  assert.match(API_SRC, /path === HEALTH_PATH \|\| _failStreak >= 2/,
    'banner gate: the health probe, or the SECOND consecutive failure');
  assert.match(API_SRC, /_failStreak = 0;.*any success resets the streak/s,
    'any successful response resets the streak');
});

// ───────────── the behavioural contract (vm realm) ─────────────

test('ONE rejected POST → thrown (toastable) error, banner stays hidden', async () => {
  const realm = bootRealm();
  realm.setFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  await assert.rejects(caller(realm, 'POST', '/api/two-pager/draft'),
    (e) => e.network === true && /POST \/api\/two-pager\/draft/.test(e.message),
    'the error carries the diagnostic the view toast shows');
  assert.equal(realm.banner().hidden, true, 'a single failure must NOT raise the banner');
});

test('TWO consecutive failures → banner rises; ONE success resets; next single failure stays quiet', async () => {
  const realm = bootRealm();
  realm.setFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  await assert.rejects(caller(realm, 'POST', '/api/a'));
  assert.equal(realm.banner().hidden, true, 'first failure: still quiet');
  await assert.rejects(caller(realm, 'POST', '/api/b'));
  assert.equal(realm.banner().hidden, false, 'second consecutive failure: banner ON');

  realm.setFetch(() => Promise.resolve(okResponse()));
  await caller(realm, 'GET', '/api/usage')();
  assert.equal(realm.banner().hidden, true, 'success clears the banner');

  realm.setFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  await assert.rejects(caller(realm, 'POST', '/api/c'));
  assert.equal(realm.banner().hidden, true, 'streak was reset — a NEW single failure stays quiet');
});

test('a failed /api/health probe raises the banner on the FIRST failure', async () => {
  const realm = bootRealm();
  realm.setFetch((_path) => {
    // route by URL: only the health probe fails; everything else is fine
    return Promise.reject(new TypeError('Failed to fetch'));
  });
  await assert.rejects(caller(realm, 'GET', '/api/health'), (e) => e.network === true);
  assert.equal(realm.banner().hidden, false, 'the health probe IS the outage signal');
});

test('the banner decides on NETWORK rejection only — an HTTP 4xx/5xx response never raises it', async () => {
  const realm = bootRealm();
  realm.setFetch(() => Promise.resolve({ ok: false, status: 500, text: async () => '{"error":"boom"}' }));
  await assert.rejects(caller(realm, 'POST', '/api/x'), (e) => e.network !== true && e.status === 500);
  assert.equal(realm.banner().hidden, true,
    'a reached-but-erroring server means the server is UP — toast, not banner');
  // and it does not count toward the streak either
  realm.setFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  await assert.rejects(caller(realm, 'POST', '/api/y'));
  assert.equal(realm.banner().hidden, true, '5xx did not feed the streak — still a first failure');
});
