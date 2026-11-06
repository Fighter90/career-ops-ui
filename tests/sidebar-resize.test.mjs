/**
 * CAR-235 (P1 UX) — the sidebar frame is RESIZABLE: a drag handle on the
 * sidebar's inline-end border (role="separator"), width 200–420px,
 * persisted in localStorage `career-ops-ui:sidebarW`, restored at boot
 * (sanitized/clamped; corrupt → default), double-click = reset, keyboard
 * ArrowLeft/ArrowRight ±16px + Home = reset.
 *
 * The view code is a browser classic script, so:
 *   Part A — source-static canaries (markup wiring, i18n key, RTL logical
 *            properties, bounds constants, ≤900px handle hiding).
 *   Part B — vm-realm behaviour: the lib runs in a vm context against a
 *            stub DOM + storage, and the drag / keyboard / persistence
 *            flows are driven through the real event handlers.
 *
 * RTL direction convention (pinned here, do not change silently): the drag
 * math is ABSOLUTE-POSITION based — the candidate width is the pointer's
 * distance from the INLINE-START viewport edge (left in LTR, right in
 * RTL), never a hardcoded `left`. Keyboard picks ONE consistent logical
 * convention across locales: ArrowRight ALWAYS widens (toward the
 * content), ArrowLeft always narrows — regardless of document direction.
 *
 * CI-isolated: reads files from disk / runs vm, no network, no server.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const INDEX = readFileSync(R('public', 'index.html'), 'utf8');
const APP = readFileSync(R('public', 'js', 'app.js'), 'utf8');
const LIB = readFileSync(R('public', 'js', 'lib', 'sidebar-resize.js'), 'utf8');
const OVERLAYS = readFileSync(R('public', 'css', 'overlays.css'), 'utf8');
const APPCSS = readFileSync(R('public', 'css', 'app.css'), 'utf8');

// ───────────────────────── Part A — source-static ─────────────────────────

test('CAR-235: index.html carries the resize handle with separator semantics + the i18n key', () => {
  assert.match(INDEX, /id="sidebar-resize"/, 'handle element present in the sidebar shell');
  const m = INDEX.match(/<div[^>]*id="sidebar-resize"[^>]*>/);
  assert.ok(m, 'handle is a single self-contained <div>');
  const tag = m[0];
  assert.match(tag, /role="separator"/);
  assert.match(tag, /aria-orientation="vertical"/);
  assert.match(tag, /tabindex="0"/, 'keyboard-operable');
  assert.match(tag, /data-i18n-aria-label="nav\.resizeSidebar"/);
  assert.match(tag, /aria-label="Resize sidebar"/, 'English fallback label present');
  assert.match(tag, /aria-valuemin="200"/);
  assert.match(tag, /aria-valuemax="420"/);
});

test('CAR-235: index.html loads the lib before app.js (app.js calls the init)', () => {
  const atLib = INDEX.indexOf('<script src="/js/lib/sidebar-resize.js">');
  const atApp = INDEX.indexOf('<script src="/js/app.js">');
  assert.ok(atLib > -1, 'lib script tag present');
  assert.ok(atApp > -1, 'app.js script tag present');
  assert.ok(atLib < atApp, 'lib must load before app.js');
  assert.match(APP, /SidebarResize\.init\(|SidebarResize\?\.init\?\./, 'app.js boots the resize feature');
  assert.match(APP, /window\.SidebarResize\b/, 'guarded call (fail-soft on shell drift)');
});

test('CAR-235: the lib pins the localStorage key + the 200–420 bounds', () => {
  assert.match(LIB, /career-ops-ui:sidebarW/, 'persistence key');
  assert.match(LIB, /200/, 'MIN bound literal');
  assert.match(LIB, /420/, 'MAX bound literal');
  assert.match(LIB, /clampWidth/, 'sanitizing clamp helper');
  assert.match(LIB, /pointerWidth/, 'RTL-aware drag math helper');
  assert.match(LIB, /dblclick/, 'double-click reset wired');
});

test('CAR-235: the handle CSS uses logical inline-end positioning — no bare left/right', () => {
  const block = OVERLAYS.match(/\.sidebar-resize\s*\{([^}]*)\}/);
  assert.ok(block, '.sidebar-resize rule present in overlays.css (app.css is at its LOC ceiling)');
  const body = block[1];
  assert.match(body, /position:\s*fixed/);
  assert.match(body, /inset-inline-end:/, 'logical property — mirrors under RTL with no mirror rule');
  assert.match(body, /col-resize/, 'affordance cursor');
  // A bare physical left/right on the handle would break the RTL mirror.
  assert.doesNotMatch(body, /(?<![\w-])(left|right)\s*:/, 'no physical left/right on the handle');
  // A physical RTL override rule would defeat the logical-property mirror
  // (anchor at line start so comment PROSE mentioning [dir="rtl"] can't match).
  assert.doesNotMatch(OVERLAYS, /\n\[dir="rtl"\][^{]*\.sidebar-resize/, 'no physical RTL override needed');
});

test('CAR-235: the handle hides at ≤900px (the mobile drawer contract is untouched)', () => {
  const media = OVERLAYS.match(/@media\s*\(max-width:\s*900px\)\s*\{([\s\S]*?)\n\}/g) || [];
  const hide = media.some((b) => /\.sidebar-resize/.test(b) && /display:\s*none/.test(b));
  assert.ok(hide, '.sidebar-resize { display: none } inside a max-width:900px media block');
});

test('CAR-235: the width still flows through the existing --sidebar-w var (reflow contract)', () => {
  assert.match(APPCSS, /\.sidebar\s*\{[^}]*width:\s*var\(--sidebar-w\)/, '.sidebar reads the var');
  assert.match(APPCSS, /\.main\s*\{[^}]*margin-inline-start:\s*var\(--sidebar-w\)/, '.main follows the var');
  assert.match(APPCSS, /--sidebar-w:\s*256px/, 'the default width literal is unchanged');
});

test('CAR-235: nav.resizeSidebar exists in every locale (non-empty string)', () => {
  const dict = loadAssembledDict();
  for (const lang of I18N_LANGS) {
    const v = dict['nav.resizeSidebar']?.[lang];
    assert.equal(typeof v, 'string', `${lang} must define nav.resizeSidebar`);
    assert.ok(v.length > 0, `${lang} nav.resizeSidebar must be non-empty`);
  }
});

// ───────────────────────── Part B — vm-realm ─────────────────────────

/** Stub DOM + storage; `dir` flips the document direction, `vw` the viewport. */
function makeStub({ dir = 'ltr', vw = 1200, stored = null } = {}) {
  const storage = {
    _m: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem(k, v) { this._m[k] = String(v); },
    removeItem(k) { delete this._m[k]; },
  };
  if (stored != null) storage.setItem('career-ops-ui:sidebarW', stored);
  const docEl = {
    _dir: dir,
    style: {
      _p: {},
      setProperty(k, v) { this._p[k] = v; },
      removeProperty(k) { delete this._p[k]; },
      getPropertyValue(k) { return this._p[k] ?? null; },
    },
    getAttribute(n) { return n === 'dir' ? this._dir : null; },
    setAttribute() {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
  };
  function makeEl(id) {
    return {
      id,
      attrs: {},
      listeners: {},
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return this.attrs[k] ?? null; },
      addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
      removeEventListener() {},
      setPointerCapture() {},
      releasePointerCapture() {},
      focus() {},
      dispatch(type, ev) {
        ev = ev || {};
        if (!ev.preventDefault) ev.preventDefault = () => {};
        for (const fn of this.listeners[type] || []) fn(ev);
      },
    };
  }
  const handle = makeEl('sidebar-resize');
  const doc = {
    documentElement: docEl,
    getElementById(id) { return id === 'sidebar-resize' ? handle : null; },
  };
  const win = { document: doc, localStorage: storage, innerWidth: vw };
  const ctx = createContext({ window: win });
  runInContext(LIB, ctx);
  const SR = ctx.window.SidebarResize;
  assert.ok(SR, 'lib registers window.SidebarResize');
  return { SR, handle, docEl, storage, win };
}

test('vm: clampWidth pins 200–420, non-finite → default', () => {
  const { SR } = makeStub();
  assert.equal(SR.clampWidth(150), 200);
  assert.equal(SR.clampWidth(500), 420);
  assert.equal(SR.clampWidth(256), 256);
  assert.equal(SR.clampWidth(380.4), 380, 'fractions round');
  assert.equal(SR.clampWidth(NaN), SR.DEFAULT_W);
  assert.equal(SR.clampWidth('junk'), SR.DEFAULT_W);
});

test('vm: parseStoredWidth — numbers parse+clamp, corrupt → null (caller falls back to default)', () => {
  const { SR } = makeStub();
  assert.equal(SR.parseStoredWidth('300'), 300);
  assert.equal(SR.parseStoredWidth(' 376 '), 376);
  assert.equal(SR.parseStoredWidth('5000'), 420, 'out-of-range clamps');
  assert.equal(SR.parseStoredWidth('abc'), null, 'corrupt string');
  assert.equal(SR.parseStoredWidth(''), null);
  assert.equal(SR.parseStoredWidth(null), null);
});

test('vm: pointerWidth is absolute-position math from the INLINE-START edge (no hardcoded left)', () => {
  const { SR } = makeStub();
  assert.equal(SR.pointerWidth(500, 1200, false), 500, 'LTR: width = clientX');
  assert.equal(SR.pointerWidth(500, 1200, true), 700, 'RTL: width = viewport − clientX');
});

test('vm: drag grows the width and persists on pointerup (LTR)', () => {
  const { SR, handle, docEl, storage } = makeStub({ dir: 'ltr', vw: 1200 });
  SR.init();
  assert.equal(docEl.style._p['--sidebar-w'], '256px', 'boot applies the default before any drag');
  handle.dispatch('pointerdown', { pointerId: 1, clientX: 256 });
  handle.dispatch('pointermove', { pointerId: 1, clientX: 256 + 120 });
  assert.equal(docEl.style._p['--sidebar-w'], '376px', 'live drag updates the var');
  assert.equal(storage.getItem('career-ops-ui:sidebarW'), null, 'nothing persisted mid-drag');
  handle.dispatch('pointerup', { pointerId: 1, clientX: 256 + 120 });
  assert.equal(storage.getItem('career-ops-ui:sidebarW'), '376', 'persisted on pointerup');
});

test('vm: drag clamps at the bounds (LTR 5000px flick → 420; RTL leftward flick → 420)', () => {
  const ltr = makeStub({ dir: 'ltr', vw: 1200 });
  ltr.SR.init();
  ltr.handle.dispatch('pointerdown', { pointerId: 1, clientX: 256 });
  ltr.handle.dispatch('pointermove', { pointerId: 1, clientX: 5000 });
  assert.equal(ltr.docEl.style._p['--sidebar-w'], '420px');

  const rtl = makeStub({ dir: 'rtl', vw: 1200 });
  rtl.SR.init();
  // RTL: the rail hugs the RIGHT edge; the handle sits near x = 1200-256.
  rtl.handle.dispatch('pointerdown', { pointerId: 1, clientX: 1200 - 256 });
  rtl.handle.dispatch('pointermove', { pointerId: 1, clientX: -5000 }); // dragging far left
  assert.equal(rtl.docEl.style._p['--sidebar-w'], '420px', 'RTL widen clamps at max');
  rtl.handle.dispatch('pointermove', { pointerId: 1, clientX: 1200 }); // back at the right edge
  assert.equal(rtl.docEl.style._p['--sidebar-w'], '200px', 'RTL shrink clamps at min');
});

test('vm: drag narrows below min clamps to 200 and persists the clamped value', () => {
  const t = makeStub({ dir: 'ltr', vw: 1200 });
  t.SR.init();
  t.handle.dispatch('pointerdown', { pointerId: 1, clientX: 300 });
  t.handle.dispatch('pointermove', { pointerId: 1, clientX: 0 });
  t.handle.dispatch('pointerup', { pointerId: 1, clientX: 0 });
  assert.equal(t.docEl.style._p['--sidebar-w'], '200px');
  assert.equal(t.storage.getItem('career-ops-ui:sidebarW'), '200', 'persisted value is the clamped one');
});

test('vm: keyboard — ArrowRight ALWAYS widens (documented convention), ArrowLeft narrows, ±16px', () => {
  const ltr = makeStub({ dir: 'ltr', vw: 1200 });
  ltr.SR.init();
  ltr.handle.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(ltr.docEl.style._p['--sidebar-w'], '272px');
  ltr.handle.dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(ltr.docEl.style._p['--sidebar-w'], '256px');

  // The convention is locale-independent (pinned: ArrowRight = widen everywhere).
  const rtl = makeStub({ dir: 'rtl', vw: 1200 });
  rtl.SR.init();
  rtl.handle.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(rtl.docEl.style._p['--sidebar-w'], '272px', 'ArrowRight widens under RTL too');
});

test('vm: keyboard steps clamp + persist; Home resets to the default', () => {
  const t = makeStub({ dir: 'ltr', vw: 1200, stored: '420' });
  t.SR.init();
  assert.equal(t.docEl.style._p['--sidebar-w'], '420px', 'boot restores the stored width');
  t.handle.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(t.docEl.style._p['--sidebar-w'], '420px', 'cannot grow past max');
  t.handle.dispatch('keydown', { key: 'Home' });
  assert.equal(t.docEl.style._p['--sidebar-w'], '256px', 'Home = reset');
  assert.equal(t.storage.getItem('career-ops-ui:sidebarW'), null, 'reset clears the stored override');
});

test('vm: persistence round-trip — stored value survives a re-init (boot restore)', () => {
  const t = makeStub({ dir: 'ltr', vw: 1200 });
  t.SR.init();
  t.SR.set(384);
  assert.equal(t.storage.getItem('career-ops-ui:sidebarW'), '384');
  const t2 = makeStub({ dir: 'ltr', vw: 1200, stored: t.storage.getItem('career-ops-ui:sidebarW') });
  t2.SR.init();
  assert.equal(t2.docEl.style._p['--sidebar-w'], '384px', 'restored at boot');
});

test('vm: corrupt stored value falls back to the default at boot', () => {
  const t = makeStub({ dir: 'ltr', vw: 1200, stored: 'not-a-number' });
  t.SR.init();
  assert.equal(t.docEl.style._p['--sidebar-w'], '256px');
  assert.equal(t.handle.getAttribute('aria-valuenow'), '256', 'aria tracks the effective width');
});

test('vm: double-click resets the width and clears the override', () => {
  const t = makeStub({ dir: 'ltr', vw: 1200, stored: '400' });
  t.SR.init();
  t.handle.dispatch('dblclick', {});
  assert.equal(t.docEl.style._p['--sidebar-w'], '256px');
  assert.equal(t.storage.getItem('career-ops-ui:sidebarW'), null);
});

test('vm: init is fail-soft without the handle element', () => {
  const storage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const doc = { documentElement: { style: { setProperty() {}, removeProperty() {} }, getAttribute() { return null; }, setAttribute() {}, classList: { add() {}, remove() {} } }, getElementById() { return null; } };
  const ctx = createContext({ window: { document: doc, localStorage: storage, innerWidth: 1200 } });
  runInContext(LIB, ctx);
  assert.doesNotThrow(() => ctx.window.SidebarResize.init());
});
