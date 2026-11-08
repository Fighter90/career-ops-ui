/**
 * CAR-252 (BACKLOG views-3 [L]) — #/health FIX_TARGETS must cover the
 * server's real check names, not an arbitrary subset.
 *
 * The existing CAR-21 canary pins ONE direction (every FIX_TARGETS key is a
 * real /api/health check name). The missing direction is completeness:
 * every FAILING REQUIRED check whose fix is reachable from the UI must
 * resolve to a "Fix →" link — via the FIX_TARGETS map or the existing
 * regexes (`_API_KEY$`, `^LLM_PROVIDER`). Checks that genuinely cannot be
 * fixed from the UI stay action-less by design (health.js comment: avoid
 * leading the user to a dead end) — but that set must be explicit and
 * every entry in it must still be a real server check name, so a rename in
 * health.mjs cannot silently orphan either a link or an exemption.
 *
 * Both halves are behavioural and CI-isolated:
 *   • the server half spins createApp() on a throwaway CAREER_OPS_ROOT and
 *     reads the LIVE check list from GET /api/health (names + required
 *     flags — never a source regex, which is exactly how the old keys
 *     drifted);
 *   • the view half loads public/js/views/health.js in a synthetic DOM
 *     (the full-r5-health-guard harness) and renders every check as
 *     failing, then verifies which rows grew a "Fix →" link.
 *
 * No network beyond loopback, no browser, no parent project.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HEALTH_JS = readFileSync(resolve(REPO, 'public/js/views/health.js'), 'utf8');

let server;
let baseUrl;
let liveChecks; // [{ name, required, ok }] straight from GET /api/health

before(async () => {
  // A deliberately bare root: every required existence check reports ok:false,
  // which is fine — the test renders the view from these names with ok:false
  // anyway; only the names and the required flags matter.
  const dir = mkdtempSync(resolve(tmpdir(), 'car252-'));
  process.env.CAREER_OPS_ROOT = dir;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((res) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      res();
    });
  });
  const res = await fetch(baseUrl + '/api/health');
  assert.equal(res.status, 200, '/api/health must answer on the throwaway root');
  const body = await res.json();
  assert.ok(Array.isArray(body.checks) && body.checks.length > 0,
    '/api/health must return a non-empty checks[]');
  liveChecks = body.checks.map((c) => ({ name: c.name, required: c.required, ok: c.ok }));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  const root = server;
  return new Promise((res) => root.close(() => res()))
    .then(() => { try { rmSync(process.env.CAREER_OPS_ROOT || '', { recursive: true, force: true }); } catch { /* best effort */ } });
});

// ── synthetic-DOM harness (verbatim pattern from full-r5-health-guard.test.mjs)

function mkEl(tag) {
  return {
    tagName: tag,
    children: [],
    attrs: {},
    className: '',
    style: {},
    value: '',
    hidden: false,
    disabled: false,
    innerHTML: '',
    textContent: '',
    _handlers: {},
    appendChild(ch) { this.children.push(ch); return ch; },
    addEventListener(type, fn) { this._handlers[type] = fn; },
    setAttribute(k, v) { this.attrs[k] = v; },
    click() { this._handlers.click && this._handlers.click({ currentTarget: this, preventDefault() {} }); },
  };
}

async function renderHealth(payload) {
  const el = (tag, attrs, children) => {
    const e = mkEl(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'className') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const kid of [].concat(children == null ? [] : children)) {
      if (kid == null || kid === false) continue;
      e.children.push(kid);
    }
    return e;
  };
  const w = {
    Router: { register(name, fn) { w.handler = fn; } },
    API: {
      get: async (p) => (p === '/api/health' ? payload : { activeProvider: 'anthropic', activeModel: 'claude-test' }),
    },
    UI: {
      el,
      toast() {}, dismissToast() {},
      modal() { return { close() {} }; },
      withSpinner: async (btn, fn) => fn(),
    },
    I18n: { t: (k, f) => (f === undefined ? k : f) },
  };
  w.HelpHint = {
    title: (text) => w.UI.el('h1', { className: 'page-title' }, [w.UI.el('span', null, text)]),
    icon: () => w.UI.el('button', { className: 'help-hint', type: 'button' }, '?'),
    close() {},
  };
  // eslint-disable-next-line no-new-func
  new Function('Router', 'API', 'UI', 'I18n', 'HelpHint', 'document', HEALTH_JS)(
    w.Router, w.API, w.UI, w.I18n, w.HelpHint,
    { getElementById: () => null, head: { appendChild() {} } },
  );
  assert.ok(w.handler, 'health.js must register the health route');
  return w.handler();
}

function walk(node, acc = []) {
  if (node == null) return acc;
  acc.push(node);
  for (const k of node.children || []) walk(k, acc);
  return acc;
}

function textOf(node) {
  return (node.children || [])
    .map((c) => (typeof c === 'string' ? c : textOf(c)))
    .join('');
}

/**
 * Render the view with EVERY check failing and return
 * Map<checkName, fixUrlOrNull> — one entry per rendered row.
 */
async function fixLinksFor(checks) {
  const root = await renderHealth({
    version: '9.9.9',
    checks: checks.map((c) => ({ ...c, ok: false })),
  });
  const nodes = walk(root);
  const rows = nodes.filter((n) => n.tagName === 'li' && String(n.className || '').includes('card'));
  const out = new Map();
  for (const row of rows) {
    const inner = walk(row);
    const label = inner.find((n) => n.className === 'metric-label');
    assert.ok(label, 'every check row carries a .metric-label name');
    const name = textOf(label).trim();
    const fix = inner.find((n) => n.tagName === 'a' && String(n.className || '').includes('health-fix'));
    out.set(name, fix ? String(fix.attrs.href || '') : null);
  }
  return out;
}

// ── CAR-252 · the checks that cannot be fixed from the UI, on the record ──
// Every entry MUST be a real /api/health check name (asserted below), so a
// rename in health.mjs breaks this test loudly instead of silently
// un-mapping a failure or resurrecting a stale key.
const NOT_UI_FIXABLE = {
  // The host's runtime — upgrading Node is a terminal action, not a UI one.
  'Node version': 'system-level: the host runtime, not editable from the SPA',
  // The career-ops checkout itself is missing — the fix is installing the
  // project, which no SPA page can do.
  'Project root': 'system-level: the parent checkout itself is missing',
  // A parent-project system file (evaluation mode instructions). The config
  // Modes tab edits modes/_profile.md only; no UI surface writes oferta.md.
  'modes/oferta.md': 'parent system file: no UI surface edits modes/oferta.md',
};

test('CAR-252: every REQUIRED check resolves to a Fix link or is exempted on the record', async () => {
  const links = await fixLinksFor(liveChecks);
  const required = liveChecks.filter((c) => c.required !== false);
  assert.ok(required.length > 0, 'the live server must report required checks');

  const problems = [];
  for (const { name } of required) {
    if (Object.hasOwn(NOT_UI_FIXABLE, name)) continue; // exempted, with a reason
    const url = links.get(name);
    if (!url) problems.push(`"${name}" fails with no Fix link and no exemption`);
    else if (!url.startsWith('#/')) problems.push(`"${name}" Fix link is not an in-app hash route: ${url}`);
  }
  assert.deepEqual(problems, [],
    'every UI-fixable REQUIRED check must resolve (FIX_TARGETS map or the _API_KEY$ / ^LLM_PROVIDER regexes)');

  // The exemption list is honest: each entry names a check the server
  // actually reports — and each exempted name really is required, so the
  // list can't quietly grow to swallow fixable checks.
  for (const name of Object.keys(NOT_UI_FIXABLE)) {
    const ch = liveChecks.find((c) => c.name === name);
    assert.ok(ch, `exemption "${name}" must be a real /api/health check name`);
    assert.notEqual(ch.required, false, `exemption "${name}" must be a REQUIRED check`);
  }
});

test('CAR-252: every FIX_TARGETS key is a live /api/health check name (no arbitrary strings)', async () => {
  const block = HEALTH_JS.match(/const FIX_TARGETS = \{([\s\S]*?)\};/);
  assert.ok(block, 'FIX_TARGETS object exists in health.js');
  const keys = Array.from(block[1].matchAll(/^\s*'([^']+)':/gm), (m) => m[1]);
  assert.ok(keys.length > 0, 'keys parsed');
  const names = new Set(liveChecks.map((c) => c.name));
  const stale = keys.filter((k) => !names.has(k));
  assert.deepEqual(stale, [],
    'every FIX_TARGETS key must be a real check name reported by GET /api/health');
});

test('CAR-252: the API-key regex path still routes optional provider keys', async () => {
  const links = await fixLinksFor(liveChecks);
  const apiKeys = liveChecks.filter((c) => c.required === false && /_API_KEY$/.test(c.name));
  assert.ok(apiKeys.length >= 5, 'the live server reports the provider-key roster');
  const missing = apiKeys.filter(({ name }) => !links.get(name));
  assert.deepEqual(missing.map((c) => c.name), [],
    'every *_API_KEY check must render a Fix link via the _API_KEY$ regex');
});
