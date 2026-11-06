/* global window, document */
/**
 * CAR-235 (P1 UX) — resizable sidebar frame.
 *
 * A drag handle sits on the sidebar's INLINE-END border (role="separator",
 * aria-orientation="vertical", keyboard-operable). Dragging sets the
 * `--sidebar-w` custom property on documentElement — the existing rules
 * (.sidebar width / .main margin-inline-start, both in app.css) already
 * read that var, so the content area reflows with no extra CSS work.
 *
 * Contracts (pinned by tests/sidebar-resize.test.mjs + playwright):
 *   • bounds 200–420px, clamped; default 256px (the app.css literal);
 *   • persisted in localStorage `career-ops-ui:sidebarW`, restored at
 *     boot (sanitized/clamped; a corrupt value falls back to default);
 *   • double-click on the handle = reset (override cleared);
 *   • keyboard: ArrowRight ALWAYS widens and ArrowLeft always narrows
 *     (one locale-independent logical convention), ±16px; Home resets;
 *   • drag math is ABSOLUTE-POSITION based: the candidate width is the
 *     pointer's distance from the INLINE-START viewport edge (clientX in
 *     LTR, innerWidth − clientX in RTL) — never a hardcoded left/right;
 *   • RTL mirrors through inset-inline-end in CSS alone; the mobile
 *     drawer (≤900px) is untouched (the handle is display:none there).
 *
 * Pure helpers (clampWidth / parseStoredWidth / pointerWidth) are exposed
 * on the api object so the vm-realm tests drive the same math the
 * browser runs; init(deps) accepts a {document, localStorage, innerWidth}
 * stub for those tests and defaults to the real window in the browser.
 */
(function () {
  'use strict';
  var KEY = 'career-ops-ui:sidebarW';
  var MIN_W = 200;
  var MAX_W = 420;
  var DEFAULT_W = 256;
  var STEP = 16;

  function clampWidth(n) {
    var v = Number(n);
    if (!Number.isFinite(v)) return DEFAULT_W;
    v = Math.round(v);
    if (v < MIN_W) return MIN_W;
    if (v > MAX_W) return MAX_W;
    return v;
  }

  /** Stored value → number or null (null = corrupt/absent → use DEFAULT_W). */
  function parseStoredWidth(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    if (s === '') return null;
    var v = Number(s);
    if (!Number.isFinite(v)) return null;
    return clampWidth(v);
  }

  /** Absolute-position drag math from the INLINE-START viewport edge. */
  function pointerWidth(clientX, viewportW, rtl) {
    return rtl ? (viewportW - clientX) : clientX;
  }

  function initInstance(deps) {
    var d = deps || (typeof window !== 'undefined' ? window : null);
    var doc = (d && d.document) || (typeof document !== 'undefined' ? document : null);
    var store = d && d.localStorage;
    if (!store && typeof localStorage !== 'undefined') store = localStorage;
    var handle = doc && doc.getElementById ? doc.getElementById('sidebar-resize') : null;
    var docEl = doc && doc.documentElement;
    if (!handle || !docEl) return null; // fail-soft (shell drift or tests)

    function isRtl() { return docEl.getAttribute('dir') === 'rtl'; }
    function viewportW() { return (d && typeof d.innerWidth === 'number') ? d.innerWidth : window.innerWidth; }

    var current = DEFAULT_W; // the effective width (the inline style carries a px suffix — never re-parse it)
    function apply(w) {
      current = clampWidth(w);
      docEl.style.setProperty('--sidebar-w', current + 'px');
      handle.setAttribute('aria-valuenow', String(current));
      return current;
    }
    function readStored() {
      try { return store.getItem(KEY); } catch { return null; }
    }
    function writeStored(w) {
      try { store.setItem(KEY, String(w)); } catch { /* private mode */ }
    }
    function clearStored() {
      try { store.removeItem(KEY); } catch { /* private mode */ }
    }
    function set(w) {
      var v = clampWidth(w);
      apply(v);
      writeStored(v);
      return v;
    }
    function reset() {
      clearStored();
      apply(DEFAULT_W);
      return DEFAULT_W;
    }

    // Boot: restore the saved width (sanitized; corrupt → default). No write
    // at boot — an explicit user action is what persists.
    apply(parseStoredWidth(readStored()) || DEFAULT_W);

    // Pointer drag.
    var dragging = false;
    handle.addEventListener('pointerdown', function (e) {
      dragging = true;
      if (handle.setPointerCapture) { try { handle.setPointerCapture(e.pointerId); } catch { /* already up */ } }
      e.preventDefault(); // no text selection while dragging
    });
    handle.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      apply(clampWidth(pointerWidth(e.clientX, viewportW(), isRtl())));
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      writeStored(current);
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('dblclick', function () { reset(); });

    // Keyboard: ArrowRight ALWAYS widens (documented convention — see header).
    handle.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); set(current + STEP); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); set(current - STEP); }
      else if (e.key === 'Home') { e.preventDefault(); reset(); }
    });

    return {
      set: set,
      reset: reset,
      apply: apply,
      handle: handle,
    };
  }

  // The active instance registers itself at init so the static
  // `SidebarResize.set(380)` / `.reset()` delegates work without the caller
  // holding the per-instance api.
  var active = null;
  function init(deps) {
    var api = initInstance(deps);
    if (api) active = api;
    return api;
  }
  function setStatic(w) { return active ? active.set(w) : null; }
  function resetStatic() { return active ? active.reset() : null; }

  window.SidebarResize = {
    KEY: KEY,
    MIN_W: MIN_W,
    MAX_W: MAX_W,
    DEFAULT_W: DEFAULT_W,
    STEP: STEP,
    clampWidth: clampWidth,
    parseStoredWidth: parseStoredWidth,
    pointerWidth: pointerWidth,
    set: setStatic,
    reset: resetStatic,
    init: init,
  };
})();
