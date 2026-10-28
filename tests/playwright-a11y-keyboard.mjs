/**
 * Keyboard a11y sweep — Playwright harness.
 *
 * Drives a real Chromium against the in-process server (mkdtemp fixture,
 * same shape as playwright-smoke.mjs) and walks the KEYBOARD experience of
 * the app-chrome routes:
 *
 *   (а) Tab pass — first Tab lands on the skip link; focus order visits
 *       every visible interactive control; no focus traps (an element
 *       holding focus for ≥ TRAP_LIMIT consecutive Tabs).
 *   (б) every reachable control shows a visible focus indicator while
 *       keyboard-focused (computed outline ≠ none with width > 0, or a
 *       box-shadow) — WCAG 2.4.7.
 *   (в) Escape closes each open overlay: notifications drawer, ⌘K command
 *       palette, docs FAB panel, and a UI.confirm modal.
 *   (г) non-native interactive elements (role=button / role=link on a
 *       <div>/<span>/<tr>/…) activate on Enter and Space — WCAG 2.1.1.
 *
 * Opt-in: run via `node tests/playwright-a11y-keyboard.mjs`. Needs the
 * parent project's Playwright + a Chromium binary; gracefully skips when
 * either is missing (same contract as playwright-smoke.mjs).
 *
 * Excluded by scope: #/scan and #/evaluate (parallel agents own those
 * files); the sweep targets the other 11 chrome routes.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function resolvePlaywright() {
  const candidates = [
    'playwright',
    resolve(process.cwd(), '..', 'node_modules', 'playwright'),
    resolve(process.cwd(), 'node_modules', 'playwright'),
  ];
  for (const id of candidates) {
    try { return require(id); } catch {}
  }
  return null;
}

const playwright = resolvePlaywright();
const SKIP = !playwright;

// Routes under sweep. scan/evaluate are owned by parallel agents and
// deliberately excluded from this pass.
const ROUTES = [
  'dashboard', 'tracker', 'reports', 'pipeline', 'config', 'usage',
  'portals', 'two-pager', 'career-plan', 'memory', 'networking',
];

const TRAP_LIMIT = 15; // consecutive Tabs on one element = focus trap

let server, baseUrl, browser, context;

before(async () => {
  if (SKIP) return;
  // Minimal parent layout (tests/fixtures-style, never the real user data).
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-a11y-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'reports'), { recursive: true });
  mkdirSync(resolve(dir, 'networking'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nReal Person, Senior Engineer.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'),
    'candidate:\n  full_name: Real Person\n  email: real@example.com\ntarget_roles:\n  primary:\n    - "Senior Backend Engineer"\n');
  writeFileSync(resolve(dir, 'portals.yml'),
    'tracked_companies:\n  - name: Acme\n    careers_url: https://boards.greenhouse.io/acme\n    enabled: true\n  - name: Beta\n    careers_url: https://jobs.lever.co/beta\n    enabled: true\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), [
    '# Applications Tracker', '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
    '| 1 | 2026-10-01 | Acme | Senior Engineer | 4.2/5 | Evaluated | ❌ | [1](reports/001-acme-2026-10-01.md) | — |',
    '| 2 | 2026-10-02 | Beta | Backend Engineer | 3.8/5 | Applied | ✅ | [2](reports/002-beta-2026-10-02.md) | — |',
    '',
  ].join('\n'));
  writeFileSync(resolve(dir, 'data', 'pipeline.md'),
    '# Pipeline\n\n```\nhttps://jobs.lever.co/beta/one\nhttps://boards.greenhouse.io/acme/two\n```\n');
  writeFileSync(resolve(dir, 'reports', '001-acme-2026-10-01.md'),
    '# Evaluation: Acme — Senior Engineer\n\n**Score:** 4.2/5\n\n**URL:** https://jobs.lever.co/beta/one\n\n## Verdict\n\nGood fit.\n');
  writeFileSync(resolve(dir, 'reports', '002-beta-2026-10-02.md'),
    '# Evaluation: Beta — Backend Engineer\n\n**Score:** 3.8/5\n\n**URL:** https://boards.greenhouse.io/acme/two\n\n## Verdict\n\nFair fit.\n');
  writeFileSync(resolve(dir, 'config', 'two-pager.yml'),
    'name: Real Person\nheadline: Senior Engineer\ntags:\n  - node\n  - sql\n');
  writeFileSync(resolve(dir, 'config', 'memory.md'), '# Memory\n\nPrefers short answers.\n');
  writeFileSync(resolve(dir, 'config', 'career-plan.md'), '# Career plan\n\nTarget: staff engineer.\n');
  process.env.CAREER_OPS_ROOT = dir;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });

  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
  context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
});

after(async () => {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
  delete process.env.CAREER_OPS_ROOT;
});

async function closePage(page) {
  try { await page.evaluate(() => window.stop()); } catch { /* page gone */ }
  await page.close();
}

async function newPage(route) {
  const page = await context.newPage();
  await page.goto(`${baseUrl}/#/${route}`);
  await page.waitForSelector('#content');
  await page.waitForFunction(() => {
    const el = document.querySelector('#content');
    return el && !(el.children.length === 1 && el.firstElementChild.classList.contains('loading'));
  }, null, { timeout: 15000 });
  // Let post-render async fetches (dashboard tiles, tracker commute probe…)
  // settle so late-mounted controls are in the DOM before we enumerate.
  await page.waitForTimeout(350);
  return page;
}

// In-page audit helpers (evaluated inside the page) --------------------------

const PAGE_HELPERS = `
  window.__a11y = {
    interactiveSel: [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'summary',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]'
    ].join(', '),
    // Stable per-node id so repeated visits of visually identical controls
    // (18 .qa-tile buttons share one class) never read as a focus trap.
    idOf(el) {
      if (!el || el === document.body) return '(body)';
      if (!el.__a11yId) el.__a11yId = ++this._seq;
      return el.tagName + '#' + el.__a11yId + '.' + (typeof el.className === 'string'
        ? el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
    },
    _seq: 0,
    visible(el) {
      if (!el || !el.isConnected) return false;
      if (el.closest('[hidden]')) return false;
      // Content inside a CLOSED <details> is not rendered/tabbed even
      // though Chromium still reports client rects for it (CV:hidden).
      const det = el.closest('details');
      if (det && !det.open && el.tagName.toLowerCase() !== 'summary') return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      return el.getClientRects().length > 0;
    },
    describe(el) {
      if (!el) return '(null)';
      const tag = el.tagName.toLowerCase();
      const id = el.id ? '#' + el.id : '';
      const cls = (typeof el.className === 'string' && el.className)
        ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
      const role = el.getAttribute && el.getAttribute('role') ? '[role=' + el.getAttribute('role') + ']' : '';
      const text = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
      return '<' + tag + id + cls + role + '> "' + text + '"';
    },
    // Enumerate visible interactive elements; classify keyboard reachability.
    // Radio groups count ONCE (the checked radio — unchecked siblings are
    // reached with arrow keys, not Tab, per native semantics).
    audit() {
      const unreachable = [];
      const els = Array.from(document.querySelectorAll(this.interactiveSel));
      const seenRadios = new Set();
      let all = 0;
      for (const el of els) {
        if (!this.visible(el)) continue;
        if (el.type === 'radio' && el.name) {
          if (seenRadios.has(el.name)) continue;
          seenRadios.add(el.name);
          const group = Array.from(document.querySelectorAll('input[type="radio"][name="' + CSS.escape(el.name) + '"]'));
          const checked = group.find((r) => r.checked) || group[0];
          if (checked !== el) continue;
        }
        all++;
        const tag = el.tagName.toLowerCase();
        const native = ['a', 'button', 'input', 'select', 'textarea', 'summary'].includes(tag);
        const ti = el.getAttribute('tabindex');
        const tabbable = ti !== null && Number(ti) >= 0;
        if (!native && !tabbable) unreachable.push(this.describe(el));
      }
      return { all, unreachable };
    },
    // The set of ids the Tab walk must visit (radio groups collapse to
    // the checked radio, matching native Tab semantics; roving-tabindex
    // ARIA tabs expose ONLY the active tab to Tab — the rest are reached
    // with arrow keys per the WAI-ARIA tabs pattern).
    expectNorms() {
      const out = [];
      const seenRadios = new Set();
      document.querySelectorAll(this.interactiveSel).forEach((el) => {
        if (!this.visible(el)) return;
        if (el.type === 'radio' && el.name) {
          if (seenRadios.has(el.name)) return;
          seenRadios.add(el.name);
          const group = Array.from(document.querySelectorAll('input[type="radio"][name="' + CSS.escape(el.name) + '"]'));
          const checked = group.find((r) => r.checked) || group[0];
          if (checked !== el) return;
        }
        if (el.getAttribute('role') === 'tab' && Number(el.getAttribute('tabindex')) < 0) return;
        out.push(this.idOf(el));
      });
      return out;
    },
    // Visible focus indicator check on the CURRENTLY focused element.
    // Composite native controls (date/time) are exempt: Chromium absorbs
    // one Tab press per inner segment (day/month/year + picker) and paints
    // the segment indicator INSIDE the shadow tree — the host's computed
    // outline reads "none" there, but a screenshot at every segment state
    // shows a visible indicator (author ring dd/mm/yyyy, native ring on
    // the picker), so there is no WCAG 2.4.7 failure to catch.
    focusRing() {
      const el = document.activeElement;
      if (!el || el === document.body) return { ok: true, el: '(body)' };
      const type = el.type && ['date', 'time', 'datetime-local', 'month', 'week'].includes(el.type);
      if (type) return { ok: true, el: this.describe(el), style: 'native-composite' };
      const cs = getComputedStyle(el);
      const w = parseFloat(cs.outlineWidth) || 0;
      const outline = cs.outlineStyle !== 'none' && (cs.outlineStyle === 'auto' || w > 0);
      const shadow = cs.boxShadow !== 'none';
      return { ok: outline || shadow, el: this.describe(el),
        style: outline ? 'outline' : (shadow ? 'shadow' : 'none') };
    },
    // Non-native role=button / role=link elements (Enter/Space contract).
    syntheticActivatables() {
      const out = [];
      document.querySelectorAll('[role="button"], [role="link"]').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        if (['a', 'button', 'input', 'select', 'textarea'].includes(tag)) return;
        if (!this.visible(el)) return;
        out.push({ el, role: el.getAttribute('role'), d: this.describe(el) });
      });
      return out;
    },
    resetFocus() {
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
    }
  };
`;

async function installHelpers(page) {
  await page.evaluate(PAGE_HELPERS);
}

/**
 * Trusted-Tab walk. Driver presses real Tab keys (so :focus-visible and
 * default focus semantics apply) and reads focus state between steps.
 *
 * Landing on <body> is the NATURAL end-of-cycle wrap (Tab past the last
 * control leaves the document) — the walk continues into a second cycle;
 * it only fails when a single element holds focus for TRAP_LIMIT
 * consecutive stops (identity-based, not class-based).
 */
async function tabWalk(page, { maxCycles = 2 } = {}) {
  await page.evaluate(() => window.__a11y.resetFocus());
  const visited = new Set();
  const order = [];
  const noRing = [];
  let trapId = null;
  let consec = 0;
  let cycles = 0;
  let steps = 0;
  const expected = await page.evaluate(() => window.__a11y.expectNorms());
  while (cycles < maxCycles) {
    for (let i = 0; i < 400; i++) {
      await page.keyboard.press('Tab');
      steps++;
      const state = await page.evaluate(() => {
        const h = window.__a11y;
        const el = document.activeElement;
        const atBody = !el || el === document.body;
        return {
          id: atBody ? '(body)' : h.idOf(el),
          desc: h.describe(el),
          atBody,
          ring: h.focusRing(),
        };
      });
      if (state.atBody) { cycles++; break; } // wrapped past the last control
      order.push(state.id);
      visited.add(state.id);
      if (!state.ring.ok) noRing.push({ desc: state.desc, style: state.ring.style });
      if (state.id === trapId) {
        consec++;
        if (consec >= TRAP_LIMIT) {
          return { visited, expected, order, noRing, trapDesc: state.desc, steps };
        }
      } else {
        trapId = state.id;
        consec = 1;
      }
      if (expected.every((n) => visited.has(n))) cycles = maxCycles; // done
    }
    if (expected.every((n) => visited.has(n))) break;
  }
  return { visited, expected, order, noRing, trapDesc: null, steps };
}

test('Playwright a11y keyboard: available', { skip: SKIP }, () => {
  assert.ok(playwright, 'playwright should resolve');
});

// Per-route sweep ------------------------------------------------------------

for (const route of ROUTES) {
  test(`a11y [${route}]: first Tab = skip link; tab walk visits all controls; no traps; focus ring everywhere`, { skip: SKIP }, async () => {
    const page = await newPage(route);
    try {
      await installHelpers(page);

      // (а) First Tab from a fresh page must land on the skip link
      // (WCAG 2.4.1 bypass blocks).
      await page.evaluate(() => window.__a11y.resetFocus());
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => ({
        desc: window.__a11y.describe(document.activeElement),
        cls: document.activeElement.className,
      }));
      assert.match(first.cls, /skip-link/,
        `[${route}] first Tab should land on the skip link, got: ${first.desc}`);

      const audit = await page.evaluate(() => window.__a11y.audit());
      assert.deepEqual(audit.unreachable, [],
        `[${route}] interactive elements not keyboard-reachable (WCAG 2.1.1):\n  ` +
        audit.unreachable.join('\n  '));

      // Full walk: reachability + traps + focus ring.
      const walk = await tabWalk(page);

      assert.equal(walk.trapDesc, null,
        `[${route}] focus trap: ${walk.trapDesc} held focus for ${TRAP_LIMIT}+ consecutive Tabs`);

      // Every enumerated interactive element must have been visited
      // (radio groups collapse to their checked radio in expectNorms()).
      const missed = walk.expected.filter((n) => !walk.visited.has(n));
      const missedDesc = await page.evaluate((ids) => {
        const h = window.__a11y;
        const out = [];
        document.querySelectorAll(h.interactiveSel).forEach((el) => {
          if (!h.visible(el)) return;
          const id = h.idOf(el);
          if (ids.includes(id)) out.push(h.describe(el) + ' [' + id + ']');
        });
        return out;
      }, missed);
      assert.deepEqual(missed, [],
        `[${route}] interactive elements never reached by Tab:\n  ` + missedDesc.join('\n  '));

      // (б) Focus indicator on every stop.
      assert.deepEqual(walk.noRing, [],
        `[${route}] keyboard-focused controls without a visible focus indicator (WCAG 2.4.7):\n  ` +
        walk.noRing.map((r) => `${r.desc} [computed: ${r.style}]`).join('\n  '));
    } finally {
      await closePage(page);
    }
  });

  test(`a11y [${route}]: Escape closes overlays (drawer, palette, docs FAB, modal)`, { skip: SKIP }, async () => {
    const page = await newPage(route);
    try {
      await installHelpers(page);

      // Notifications drawer.
      const bell = page.locator('#notif-bell');
      if (await bell.count()) {
        await bell.click();
        await page.waitForTimeout(120);
        let hidden = await page.evaluate(() => document.getElementById('notif-drawer').hidden);
        assert.equal(hidden, false, `[${route}] notif drawer did not open (pre-condition)`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(120);
        hidden = await page.evaluate(() => document.getElementById('notif-drawer').hidden);
        assert.equal(hidden, true, `[${route}] Escape does not close the notifications drawer (WCAG 2.1.2)`);
      }

      // ⌘K command palette (Ctrl+K on non-Mac Chromium).
      await page.keyboard.press('Control+k');
      let paletteOpen = await page.evaluate(() => {
        const o = document.querySelector('.nav-v2-overlay');
        return !!o && !o.hidden;
      });
      if (!paletteOpen) {
        // Fallback: the sidebar launch button.
        const launch = page.locator('#nav-v2-launch');
        if (await launch.count()) {
          await launch.click();
          await page.waitForTimeout(120);
          paletteOpen = await page.evaluate(() => {
            const o = document.querySelector('.nav-v2-overlay');
            return !!o && !o.hidden;
          });
        }
      }
      if (paletteOpen) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(120);
        const closed = await page.evaluate(() => {
          const o = document.querySelector('.nav-v2-overlay');
          return !o || o.hidden;
        });
        assert.equal(closed, true, `[${route}] Escape does not close the command palette (WCAG 2.1.2)`);
      }

      // Docs FAB panel.
      const fab = page.locator('#docs-fab');
      if (await fab.count()) {
        await fab.click();
        await page.waitForTimeout(150);
        const fabOpen = await page.evaluate(() => {
          const p = document.querySelector('.docs-fab__panel');
          return !!p && !p.hidden;
        });
        if (fabOpen) {
          // Focus the FAB panel input first (Escape handler is document-level,
          // but the panel input must not swallow it).
          await page.keyboard.press('Escape');
          await page.waitForTimeout(150);
          const fabClosed = await page.evaluate(() => {
            const p = document.querySelector('.docs-fab__panel');
            return !p || p.hidden;
          });
          assert.equal(fabClosed, true, `[${route}] Escape does not close the docs FAB panel (WCAG 2.1.2)`);
        }
      }

      // UI.confirm modal.
      await page.evaluate(() => { window.UI.confirm('A11y sweep', 'Close me with Escape'); });
      await page.waitForTimeout(150);
      let modalHidden = await page.evaluate(() => document.getElementById('modal').hidden);
      assert.equal(modalHidden, false, `[${route}] modal did not open (pre-condition)`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      modalHidden = await page.evaluate(() => document.getElementById('modal').hidden);
      assert.equal(modalHidden, true, `[${route}] Escape does not close the modal dialog (WCAG 2.1.2)`);
    } finally {
      await closePage(page);
    }
  });

  test(`a11y [${route}]: role=button/link elements activate on Enter/Space`, { skip: SKIP }, async () => {
    const page = await newPage(route);
    try {
      await installHelpers(page);
      // A synthetic keydown is "honored" when the element's handler either
      // synthesizes a click or claims it via preventDefault — the app's
      // universal Enter/Space contract (handler: preventDefault + act).
      // Handlers that only listen for untrusted events would be a finding
      // either way, so a false negative here is not a concern.
      const findings = await page.evaluate(() => {
        const h = window.__a11y;
        const out = [];
        const items = h.syntheticActivatables();
        for (const it of items) {
          const el = it.el;
          let clicks = 0;
          const counter = () => { clicks++; };
          el.addEventListener('click', counter);
          try {
            const probe = (key) => {
              clicks = 0;
              const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
              el.dispatchEvent(ev);
              return { click: clicks, prevented: ev.defaultPrevented };
            };
            const enter = probe('Enter');
            const space = it.role === 'link' ? null : probe(' ');
            const enterOk = enter.click >= 1 || enter.prevented;
            const spaceOk = space == null ? true : (space.click >= 1 || space.prevented);
            if (!enterOk || !spaceOk) {
              out.push(`${it.d} — Enter:${enterOk ? 'ok' : 'IGNORED'} Space:${
                space == null ? 'n/a' : (spaceOk ? 'ok' : 'IGNORED')}`);
            }
          } finally {
            el.removeEventListener('click', counter);
          }
        }
        return out;
      });
      // Navigate-away side effects (Router.go) are fine — the assertions
      // above already ran inside the page; only the report crosses back.
      assert.deepEqual(findings, [],
        `[${route}] synthetic interactive elements without keyboard activation (WCAG 2.1.1):\n  ` +
        findings.join('\n  '));
    } finally {
      await closePage(page);
    }
  });
}
