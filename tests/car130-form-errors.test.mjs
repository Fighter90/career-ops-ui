/**
 * CAR-130 — form errors: field-level invalid state + a server-aware net hint.
 *
 * Two defects, one concern (form/error UX):
 *
 * (1) A failed POST (4xx/5xx, or a dropped connection) surfaced ONLY as a
 *     toast — the offending control kept no visual state (WCAG 3.3.1).
 *     The shared submit helper (views/mode-page.js `submit()`, the pattern
 *     the seven generic mode pages use) must mark the FIRST form control
 *     `aria-invalid="true"` + `.is-error`, focus it, and clear both on the
 *     next input/change.
 *
 * (2) The generic network-error hint (`api.netHint` — "run:
 *     bash web-ui/bin/start.sh") is local-DEV advice; on a deployed origin
 *     it reads as nonsense. The hint (and the connection banner, which
 *     hardcodes the same command) must branch on `location.origin`:
 *     loopback keeps the dev command, anything else gets the generic
 *     wording via the existing `conn.down` key (translated in all 19
 *     locales — no new i18n keys).
 *
 * api.js is a browser classic script → loaded in a synthetic window with a
 * rejecting injected fetch; no network. The mode-page wiring is asserted
 * source-visibly (the file needs a full DOM to execute).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_SRC = readFileSync(resolve(ROOT, 'public/js/api.js'), 'utf8');
const MODE_PAGE_SRC = readFileSync(resolve(ROOT, 'public/js/views/mode-page.js'), 'utf8');
const COMPONENTS_CSS = readFileSync(resolve(ROOT, 'public/css/components.css'), 'utf8');
// The .is-error rule lives in overlays.css, NOT components.css (forms):
// components.css sits exactly at the 800-LOC canary and cannot take a
// single line. Next to `.toast.error` — the other transient error state.
const OVERLAYS_CSS = readFileSync(resolve(ROOT, 'public/css/overlays.css'), 'utf8');

// ── synthetic browser ────────────────────────────────────────────────────

function loadApi({ origin, withBanner = false } = {}) {
  const bannerMsg = { textContent: '' };
  const banner = {
    hidden: true,
    querySelector: (sel) => (sel === '.conn-msg' ? bannerMsg : null),
  };
  const loc = { hash: '#/' };
  if (origin !== undefined) loc.origin = origin;
  const w = { location: loc, addEventListener() {} };
  const doc = {
    // api.js starts a self-rescheduling health watchdog at load → the
    // banner element is looked up by id on every state flip.
    getElementById: (id) => (withBanner && id === 'conn-banner' ? banner : null),
    addEventListener() {},
    removeEventListener() {},
    createElement: () => ({
      style: {}, setAttribute() {}, getAttribute: () => null,
      removeAttribute() {}, appendChild() {}, addEventListener() {},
    }),
  };
  // Every POST under test fails at the transport layer — that is the path
  // that used to advise the local dev command.
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'fetch', 'EventSource', 'MutationObserver', 'setTimeout', 'clearTimeout', API_SRC)(
    w, doc, fetchImpl, class {}, class {}, () => 0, () => {},
  );
  return { w, banner, bannerMsg };
}

// ── (2) server-aware net hint ────────────────────────────────────────────

test('CAR-130: loopback origin keeps the local dev hint (start.sh)', async () => {
  for (const origin of ['http://127.0.0.1:4317', 'http://localhost:4317', 'http://[::1]:4317']) {
    const { w } = loadApi({ origin });
    await assert.rejects(
      () => w.API.post('/api/mode/project', {}),
      (e) => /web-ui\/bin\/start\.sh/.test(e.message),
      `loopback origin ${origin} is local dev — the start.sh hint stays`,
    );
  }
});

test('CAR-130: a deployed origin shows generic wording, never the dev command', async () => {
  for (const origin of ['https://resumecraft.ru', 'http://192.168.1.10:4317', '']) {
    const { w } = loadApi({ origin });
    await assert.rejects(
      () => w.API.post('/api/mode/project', {}),
      (e) => e.message.includes('Server is not responding.')
        && !/start\.sh/.test(e.message),
      `deployed origin ${origin} must not advise the local dev command`,
    );
  }
});

test('CAR-130: the connection banner drops the dev command when deployed', async () => {
  const { w, banner, bannerMsg } = loadApi({ origin: 'https://resumecraft.ru', withBanner: true });
  await assert.rejects(() => w.API.post('/api/x', {}), () => true);
  assert.equal(banner.hidden, false, 'the lost-connection banner still shows');
  assert.match(bannerMsg.textContent, /Server is not responding\./);
  assert.ok(!/start\.sh/.test(bannerMsg.textContent),
    'the banner must not hardcode the local dev command on a deployed origin');
});

test('CAR-130: the connection banner keeps the dev command on loopback', async () => {
  const { w, bannerMsg } = loadApi({ origin: 'http://127.0.0.1:4317', withBanner: true });
  await assert.rejects(() => w.API.post('/api/x', {}), () => true);
  assert.match(bannerMsg.textContent, /web-ui\/bin\/start\.sh/);
});

// ── (1) failed-POST field marking in the shared submit helper ───────────

test('CAR-130: the shared submit helper marks the first form control on failure', () => {
  assert.match(MODE_PAGE_SRC, /function markFormError\(/,
    'mode-page.js carries the shared marking helper');
  assert.match(MODE_PAGE_SRC, /setAttribute\('aria-invalid', 'true'\)/,
    'the marked control gets aria-invalid="true" (WCAG 3.3.1)');
  assert.match(MODE_PAGE_SRC, /classList\.add\('is-error'\)/,
    'the marked control gets the .is-error class');
  assert.match(MODE_PAGE_SRC, /\.focus\(\)/,
    'the marked control receives focus');
  // The catch branch of submit() — the failed-POST path — calls the helper.
  assert.match(MODE_PAGE_SRC, /catch \(e\) \{[\s\S]*?markFormError\(\)/,
    'submit() marks the field in its error branch');
});

test('CAR-130: the marking clears on the next input/change', () => {
  assert.match(MODE_PAGE_SRC, /function clearFieldError\(/,
    'a dedicated clear helper exists');
  assert.match(MODE_PAGE_SRC, /removeAttribute\('aria-invalid'\)/);
  assert.match(MODE_PAGE_SRC, /classList\.remove\('is-error'\)/);
  // Every rendered field wires BOTH events to the clear helper.
  const src = MODE_PAGE_SRC;
  assert.match(src, /addEventListener\('input', clearFieldError\)/);
  assert.match(src, /addEventListener\('change', clearFieldError\)/);
});

test('CAR-130: components.css styles the invalid state with an existing token', () => {
  assert.match(COMPONENTS_CSS, /^\.field \{/m,
    'components.css still owns the form-control base styles');
  assert.match(OVERLAYS_CSS, /\.input\.is-error/,
    '.is-error is defined for form controls (overlays.css — components.css is at the 800-LOC canary)');
  assert.match(OVERLAYS_CSS, /\.is-error\s*\{[^}]*border-color:\s*var\(--err\)/,
    'the invalid border uses the existing --err token (no new colors)');
});
