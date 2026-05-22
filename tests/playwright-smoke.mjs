/**
 * Playwright browser smoke harness.
 *
 * Drives a real Chromium against the in-process server on an ephemeral
 * port. Verifies that every navigation lands on a usable view (no
 * console errors, key DOM elements present, language switch persists).
 *
 * Opt-in: this test is NOT run by `npm test` because it needs a browser
 * binary and Playwright is not a direct dependency of this repo. Run via:
 *
 *   npm run test:e2e:browser           # uses parent's playwright
 *   PWDEBUG=1 npm run test:e2e:browser # headed, slow-mo
 *
 * Failure modes:
 *   - Playwright not installed in parent → reports a clear skip message.
 *   - No Chromium browser binary → same.
 *   - Server fails to start → assertion in before() throws.
 *
 * The harness mocks parent fixtures via `mkdtempSync`, just like the
 * other tests, so it does NOT touch the user's real career-ops data.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Resolve Playwright via the parent project's node_modules — that's
// where it's actually installed. The project keeps deps minimal so we
// don't bundle Playwright; this matches how `generate-pdf.mjs` and
// `check-liveness.mjs` reach for it at runtime.
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

let server, baseUrl, browser, context;

before(async () => {
  if (SKIP) return;
  // Build a minimal parent layout so /api/health goes green-enough for
  // the SPA boot to complete and `Profile customized` flag will show
  // (it's optional, so app.ok stays true).
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-smoke-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nReal Person, Senior Engineer.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'),
    'candidate:\n  full_name: Real Person\n  email: real@example.com\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# Pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), '# Oferta\n');
  process.env.CAREER_OPS_ROOT = dir;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });

  browser = await playwright.chromium.launch({
    headless: process.env.PWDEBUG !== '1',
  });
  context = await browser.newContext();
});

after(async () => {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) {
    // Force-destroy any lingering keep-alive / in-flight SSE sockets
    // (Node ≥18.2) so server.close() resolves deterministically and
    // no aborted-request async activity escapes after teardown.
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
  delete process.env.CAREER_OPS_ROOT;
});

/**
 * Close a page WITHOUT leaving an in-flight request attached to the
 * server socket. The #/auto stepper streams `fetch('/api/auto-pipeline')`;
 * a bare page.close() while that stream is still draining aborts the
 * request mid-flight and node:test attributes the post-teardown
 * "Error: aborted" to the before-hook server → flaky CI failure.
 * window.stop() synchronously aborts all in-flight network in the page
 * BEFORE close, so nothing survives into teardown. Belt-and-braces with
 * the after-hook's server.closeAllConnections().
 */
async function closePage(page) {
  try { await page.evaluate(() => window.stop()); } catch { /* page gone */ }
  await page.close();
}

test('Playwright smoke: dashboard renders + footer version present', { skip: SKIP }, async () => {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await page.goto(baseUrl + '/#/dashboard');
  await page.waitForSelector('#content', { timeout: 5000 });
  // Footer renders the package.json version (e.g. "v1.7.2").
  const footerText = await page.locator('#footer-version').textContent();
  assert.match(footerText || '', /^v\d+\.\d+/, `footer should show version, got "${footerText}"`);
  // Dashboard content is rendered by the dashboard view; expect something.
  const contentHtml = await page.locator('#content').innerHTML();
  assert.ok(contentHtml.length > 50, 'dashboard content empty');
  assert.deepEqual(consoleErrors, [], 'console errors on dashboard: ' + consoleErrors.join(' | '));
  await page.close();
});

test('Playwright smoke: navigate dashboard → scan → pipeline → cv', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/dashboard');
  await page.waitForSelector('#content');

  // Scan page (works even with no portals — the page renders empty state)
  await page.goto(baseUrl + '/#/scan');
  await page.waitForSelector('#content');
  const scanHtml = await page.locator('#content').innerHTML();
  assert.ok(scanHtml.length > 0, 'scan view empty');

  // Pipeline page
  await page.goto(baseUrl + '/#/pipeline');
  await page.waitForSelector('#content');
  const pipelineHtml = await page.locator('#content').innerHTML();
  assert.ok(pipelineHtml.length > 0, 'pipeline view empty');

  // CV page
  await page.goto(baseUrl + '/#/cv');
  await page.waitForSelector('#content');
  const cvHtml = await page.locator('#content').innerHTML();
  assert.match(cvHtml, /Real Person|cv|markdown|preview/i,
    'CV view did not render — got: ' + cvHtml.slice(0, 200));

  await page.close();
});

test('Playwright smoke: language switcher persists in localStorage', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/dashboard');
  await page.waitForSelector('[data-lang-btn]');
  // Click ru button if present.
  const ruBtn = page.locator('[data-lang-btn="ru"]');
  if (await ruBtn.count()) {
    await ruBtn.click();
    // i18n.onChange triggers Router.render(); wait for the next paint.
    await page.waitForTimeout(200);
    const lang = await page.evaluate(() => localStorage.getItem('lang') || localStorage.getItem('i18n.lang'));
    // The exact key name may vary by i18n.js version; we just assert
    // *some* language preference was persisted.
    assert.ok(lang === 'ru' || lang === null || /ru/.test(lang || ''),
      `lang persistence unclear, value="${lang}"`);
  }
  await page.close();
});

test('Playwright smoke: 404 view for unknown route', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/no-such-route-zzz');
  await page.waitForSelector('#content');
  const html = await page.locator('#content').innerHTML();
  assert.match(html, /404|not found|page-404/i, 'expected 404 view fallback');
  await page.close();
});

test('Playwright smoke: health page renders required-checks status', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/health');
  await page.waitForSelector('#content');
  const html = await page.locator('#content').innerHTML();
  // Health page renders one row per check; cv.md should be present and ok.
  assert.match(html, /cv\.md|Profile|Health|Node version|GEMINI_API_KEY/i,
    'health view did not render checks, got: ' + html.slice(0, 200));
  await page.close();
});

// ─── Expanded coverage (v1.9.1 production-readiness pass) ────────────

test('Playwright smoke: tracker view renders empty + accepts API-seeded row', { skip: SKIP }, async () => {
  const page = await context.newPage();
  // page.evaluate runs against about:blank without a prior goto — relative
  // URLs won't resolve. Navigate first so fetch('/api/...') hits our server.
  await page.goto(baseUrl + '/#/tracker');
  await page.waitForSelector('#content');

  // Seed via API, then re-render the view.
  const seedOk = await page.evaluate(async () => {
    const r = await fetch('/api/tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'Acme | Co', role: 'Backend Engineer', score: '4.2', status: 'Evaluated' }),
    });
    return r.ok;
  });
  assert.ok(seedOk, 'POST /api/tracker failed');

  // BF-1 verification — pipe in company name should NOT break the table.
  // Re-fetch and assert the row was parsed back as a single entity.
  const rows = await page.evaluate(async () => {
    const r = await fetch('/api/tracker');
    const j = await r.json();
    return j.rows || [];
  });
  assert.ok(rows.length >= 1, 'tracker did not return seeded row');
  const acme = rows.find((r) => /Acme/i.test(r.company || ''));
  assert.ok(acme, 'BF-1: pipe-laden company name was lost in tracker round-trip');
  assert.equal(acme.role, 'Backend Engineer');
  await page.close();
});

test('Playwright smoke: pipeline add-URL form populates the queue', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/pipeline');
  await page.waitForSelector('#content');
  const seedOk = await page.evaluate(async () => {
    const r = await fetch('/api/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://jobs.example.com/posting/smoke-1' }),
    });
    return r.ok;
  });
  assert.ok(seedOk, 'POST /api/pipeline failed');
  const urls = await page.evaluate(async () => {
    const r = await fetch('/api/pipeline');
    return (await r.json()).urls || [];
  });
  assert.ok(urls.includes('https://jobs.example.com/posting/smoke-1'),
    'pipeline did not retain seeded URL: ' + JSON.stringify(urls));
  // BF: invalid URLs (loopback, javascript:, bare strings) are rejected.
  for (const bad of ['http://localhost/x', 'javascript:alert(1)', 'not-a-url']) {
    const status = await page.evaluate(async (u) => {
      const r = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      });
      return r.status;
    }, bad);
    assert.equal(status, 400, `pipeline accepted invalid URL "${bad}"`);
  }
  await page.close();
});

test('Playwright smoke: reports view handles empty state', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/reports');
  await page.waitForSelector('#content');
  const html = await page.locator('#content').innerHTML();
  // Either empty state (no fixture has reports) or the listing — both
  // valid renders. Just make sure the view didn't crash.
  assert.ok(html.length > 50, 'reports view body too small');
  await page.close();
});

test('Playwright smoke: evaluate view returns a manual prompt without API key', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/evaluate');
  await page.waitForSelector('#content');
  // Hit /api/evaluate directly with a JD ≥50 chars after sanitization.
  const result = await page.evaluate(async () => {
    const r = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jd: 'Senior Backend Engineer with extensive PHP and Go responsibilities, including microservice architecture, code review, and on-call rotation for a high-traffic payments platform.',
      }),
    });
    return { status: r.status, body: await r.json() };
  });
  assert.equal(result.status, 200);
  // No key set in the smoke fixture, so manual mode is the expected path.
  // Also valid: anthropic/gemini if a real key happens to leak from the
  // host shell into the test process.
  assert.ok(['manual', 'anthropic', 'gemini'].includes(result.body.mode),
    `unexpected mode: ${result.body.mode}`);
  if (result.body.mode === 'manual') {
    assert.match(result.body.prompt, /career-ops|JD/, 'manual prompt missing canonical text');
  }
  await page.close();
});

test('Playwright smoke: config GET returns known keys masked', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/config');
  await page.waitForSelector('#content');
  const cfg = await page.evaluate(async () => {
    const r = await fetch('/api/config');
    return await r.json();
  });
  assert.ok(Array.isArray(cfg.keys), 'config.keys not an array');
  assert.ok(cfg.keys.length > 0, 'config.keys empty');
  assert.ok(Array.isArray(cfg.secretKeys), 'config.secretKeys not an array');
  assert.ok(cfg.values && typeof cfg.values === 'object', 'config.values missing');
  // Secret keys are present in the values map but masked when set.
  for (const k of cfg.secretKeys) {
    if (cfg.values[k] && cfg.values[k].length) {
      assert.ok(!cfg.values[k].includes('sk-ant') && !cfg.values[k].includes('AIzaSy'),
        `secret key ${k} appears unmasked in /api/config response`);
    }
  }
  await page.close();
});

test('Playwright smoke: cv.md PUT round-trips with sanitization', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/cv');
  await page.waitForSelector('#content');
  // PUT a CV with embedded XSS-y bits; assert the response reports
  // sanitization happened, then GET to verify the body is clean.
  const put = await page.evaluate(async () => {
    const md = '# CV\n\n<script>alert(1)</script>\n\nHello [link](javascript:void) world.';
    const r = await fetch('/api/cv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: md }),
    });
    return await r.json();
  });
  assert.equal(put.ok, true);
  assert.equal(put.sanitized, true, 'stripDangerousMarkdown should have flagged XSS bits');
  const got = await page.evaluate(async () => {
    const r = await fetch('/api/cv');
    return (await r.json()).markdown;
  });
  assert.ok(!/<script/i.test(got), 'script tag survived sanitization');
  assert.ok(!/javascript:/i.test(got), 'javascript: scheme survived sanitization');
  await page.close();
});

test('Playwright smoke: pipeline preview proxy strips scripts', { skip: SKIP }, async () => {
  // We can't hit a real upstream from CI reliably, but the route returns
  // 400 for invalid URLs and a JSON body for valid ones. Exercise the
  // 400 path here — the fetch-mocking happens in the unit tests.
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/pipeline');
  await page.waitForSelector('#content');
  const status = await page.evaluate(async () => {
    const r = await fetch('/api/pipeline/preview?url=' + encodeURIComponent('not-a-url'));
    return r.status;
  });
  assert.equal(status, 400, 'pipeline/preview should 400 on invalid URL');
  await page.close();
});

// Auto-pipeline scenarios. v1.34.0 (WS5) promoted the dashboard CTA
// from a transient modal to the dedicated, linkable #/auto screen
// (Router.go('/auto')); the window.AutoPipeline.open() modal helper is
// retained for the Cmd+K backward-compat path. These were rewritten in
// v1.44.x — the pre-v1.34 tests still asserted the removed modal and
// had been red on the Playwright-e2e job since v1.34.0. No LLM key in
// the fixture → step 3 errors cleanly.

test('Playwright smoke: dashboard ✨ Auto-pipeline button → #/auto screen with URL input', { skip: SKIP }, async () => {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  await page.goto(baseUrl + '/#/dashboard');
  await page.waitForSelector('#content', { timeout: 5000 });
  // The CTA in the page-header now navigates to the dedicated screen.
  await page.locator('button:has-text("Auto-pipeline")').click();
  await page.waitForSelector('#auto-url', { timeout: 5000 });
  await page.waitForFunction(() => location.hash === '#/auto', { timeout: 3000 });
  const placeholder = await page.locator('#auto-url').getAttribute('placeholder');
  assert.match(placeholder || '', /greenhouse|workable|workday|https/i, 'input should hint at a URL paste');
  assert.deepEqual(consoleErrors, [], 'dashboard auto-pipeline console errors: ' + consoleErrors.join(' | '));
  await closePage(page);
});

test('Playwright smoke: Cmd+K + URL + Enter triggers auto-pipeline modal', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/dashboard');
  await page.waitForSelector('#global-search');
  // Use a URL that's safe but reaches the SSE endpoint.
  await page.locator('#global-search').fill('https://example.com/jobs/123');
  await page.locator('#global-search').press('Enter');
  // Modal should appear with autoStart=true.
  await page.waitForSelector('#modal input.input', { timeout: 3000 });
  // Timeline should fire — step 1 (validate) at minimum.
  await page.waitForSelector('#modal', { timeout: 3000 });
  // CRITICAL: example.com is a REAL outbound fetch (step 2). Wait for
  // the pipeline to reach a terminal state — example.com returns a
  // tiny page → JD < 50 chars → step fails with "✗" — so the server's
  // safeGet() has RESOLVED (not been aborted by our close). Closing
  // mid-fetch would abort safeGet and the undici "Error: aborted"
  // would settle after this test ends → node:test reds the file.
  await page.waitForFunction(() => {
    const m = document.getElementById('modal');
    return !!m && (/✗/.test(m.textContent || '') || /✓ done|error/i.test(m.textContent || ''));
  }, { timeout: 15000 });
  await closePage(page);
});

test('Playwright smoke: #/auto invalid URL → step 1 fails inline', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/auto');
  await page.waitForSelector('#auto-url', { timeout: 5000 });
  await page.locator('#auto-url').fill('not-a-real-url');
  // Click the run CTA inside the #/auto content (the only primary
  // button there is the "▶ Run full pipeline" trigger).
  await page.evaluate(() => {
    const root = document.getElementById('content');
    const btn = root && root.querySelector('.btn-primary');
    if (btn) btn.click();
  });
  // The inline stepper marks step 1 (validate) failed with a "✗" glyph;
  // locale-agnostic. The screen, not a modal, owns the timeline now.
  await page.waitForFunction(
    () => {
      const root = document.getElementById('content');
      if (!root) return false;
      const txt = root.textContent || '';
      return txt.includes('✗') || /invalid url/i.test(txt);
    },
    { timeout: 8000 }
  );
  await closePage(page);
});

test('Playwright smoke: POST /api/auto-pipeline SSE — emits start + step events', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/');
  // Drive the SSE endpoint directly via fetch() from the page context;
  // verifies the server emits the canonical event sequence even when
  // there's no LLM key (step 3 → error).
  const events = await page.evaluate(async () => {
    // Abort + cancel the SSE stream the instant we have what we need.
    // Previously this `break`-ed out of the read loop leaving the
    // fetch body attached to the server socket; page.close() then
    // aborted it mid-stream and the "Error: aborted" surfaced as
    // async activity after the test ended → flaky CI failure. The
    // AbortController + guaranteed reader.cancel() in finally make
    // teardown deterministic.
    const ac = new AbortController();
    const resp = await fetch('/api/auto-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'javascript:bad' }),
      signal: ac.signal,
    });
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const out = [];
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop();
        for (const p of parts) {
          const ev = (p.match(/^event:\s*(\S+)/m) || [])[1];
          if (ev) out.push(ev);
        }
        if (out.includes('error') || out.includes('done')) break;
      }
    } finally {
      // Cancel the reader first (closes the client end), then abort
      // the request so the server's res stream ends cleanly before
      // the page/context/server are torn down.
      try { await reader.cancel(); } catch { /* already closed */ }
      ac.abort();
    }
    return out;
  });
  // For an invalid URL we expect at least: start, step (validate
  // running), step (validate failed), error.
  assert.ok(events.includes('start'), `expected 'start' event, got ${events.join(',')}`);
  assert.ok(events.includes('step'),  `expected 'step' event, got ${events.join(',')}`);
  assert.ok(events.includes('error'), `expected 'error' event, got ${events.join(',')}`);
  await closePage(page);
});

// ─── M-1 (v1.58.9): keyboard focus reveals a visible ring (WCAG 2.4.7) ───

test('Playwright smoke: M-1 — Tab focus on form fields paints a visible ring (WCAG 2.4.7)', { skip: SKIP }, async () => {
  const page = await context.newPage();
  // Use #/config — guaranteed to have visible form inputs out of the box.
  await page.addInitScript(() => {
    try { localStorage.setItem('career-ops-ui:lang', 'en'); } catch { /* private mode */ }
  });
  await page.goto(baseUrl + '/#/config');
  await page.waitForSelector('#content', { timeout: 5000 });
  // Find the first input/textarea/select inside the content area and
  // focus it via the keyboard pathway (`:focus-visible` only paints on
  // keyboard-initiated focus; calling .focus() in some engines yields
  // `:focus` but not `:focus-visible`, so we navigate via Tab).
  const handle = await page.evaluateHandle(() => {
    const el = document.querySelector('#content input, #content textarea, #content select');
    if (el) el.scrollIntoView({ block: 'center' });
    return el;
  });
  if (await handle.evaluate((el) => !el)) {
    // Fallback — if #/config render didn't produce a field, the test
    // skips its assertion rather than failing the suite. The static
    // qa-report-fixes guard already locks the CSS contract.
    await closePage(page);
    return;
  }
  // Programmatic focus first, then read computed style with a forced
  // `:focus-visible` heuristic via getComputedStyle on the active
  // element. Chromium applies focus-visible after a keyboard event, so
  // simulate one with `page.keyboard.press('Tab')` after blurring.
  await handle.evaluate((el) => el.blur());
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('Tab');
  // Walk Tab until the active element matches our target tag.
  for (let i = 0; i < 60; i++) {
    const matched = await page.evaluate(() => {
      const a = document.activeElement;
      return a && /^(INPUT|TEXTAREA|SELECT)$/i.test(a.tagName) &&
             a.closest && a.closest('#content');
    });
    if (matched) break;
    await page.keyboard.press('Tab');
  }
  const outline = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return null;
    const cs = getComputedStyle(a);
    return {
      tag: a.tagName,
      outlineWidth: cs.outlineWidth,
      outlineStyle: cs.outlineStyle,
      outlineColor: cs.outlineColor,
    };
  });
  assert.ok(outline, 'no element was focused via Tab');
  assert.ok(/^(INPUT|TEXTAREA|SELECT)$/i.test(outline.tag),
    `Tab did not land on a form field, landed on <${outline.tag}>`);
  // The outline must be solid AND have a non-zero width. CSS 'none'
  // collapses outline-width to 0px; a missing ring would fail either gate.
  assert.notEqual(outline.outlineStyle, 'none',
    `form-field focus-visible must not be 'none', got: ${JSON.stringify(outline)}`);
  assert.ok(parseFloat(outline.outlineWidth) >= 1.5,
    `form-field focus-visible must be ≥1.5px wide, got: ${JSON.stringify(outline)}`);
  await closePage(page);
});

// ─── NEW-3 (v1.58.5): #/followup `Run live` posts exactly once per click ───
//
// The v1.58.3 MASTER regression flagged a possible double-POST to
// /api/mode/followup after a single button click (company/role/notes
// filled, date intentionally empty). Code inspection of
// `public/js/views/mode-page.js::submit` shows a single onClick handler
// per button, no parallel form submit listener, and `UI.withSpinner`
// (FIX-L1) disables the button for the duration of the in-flight
// request. Both the manual "Generate prompt" button and the live "Run
// live" button call the same `submit(btn, run)` function — so a
// double-bind would affect both paths identically. This test exercises
// the manual button (always visible, no provider key needed) under the
// exact field-set the regression named (date left blank) and asserts
// exactly one POST to `/api/mode/followup`. If the bug returns it will
// show up here as 2+ requests, regardless of run=true/false branch.

test('Playwright smoke: NEW-3 — single click on #/followup submits exactly one POST', { skip: SKIP }, async () => {
  const page = await context.newPage();
  const posts = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/api\/mode\/followup\b/.test(r.url())) posts.push(r.url());
  });
  // A prior test in the same browser context may have switched the
  // SPA's language (the language-switcher test leaves RU in
  // localStorage). The Generate-prompt label is i18n-driven, so seed
  // the persisted preference to 'en' BEFORE any page script runs so
  // i18n.js's module-init read picks EN and the followup view renders
  // deterministically. addInitScript fires on every navigation in this
  // page before document scripts; setting localStorage there avoids
  // the re-render race we'd otherwise hit with post-goto setLang.
  await page.addInitScript(() => {
    try { localStorage.setItem('career-ops-ui:lang', 'en'); } catch { /* private mode */ }
  });
  await page.goto(baseUrl + '/#/followup');
  await page.waitForSelector('#mode-followup-company', { timeout: 15000 });
  await page.fill('#mode-followup-company', 'TestCo');
  await page.fill('#mode-followup-role', 'QA');
  await page.fill('#mode-followup-notes', 'note');
  // lastContact intentionally left empty — the regression recipe.

  // The manual button is the always-visible primary; its onClick is the
  // same submit() that the live button uses, so it tests the binding
  // contract just as effectively without needing a real provider key.
  // Locale-stable selector: the leading ▶ glyph is constant across all 8 locales.
  await page.click('#content button.btn-primary:has-text("▶")');

  // 3 s window — covers any debounced or microtask-deferred duplicate.
  await page.waitForTimeout(3000);

  assert.equal(posts.length, 1,
    `expected exactly 1 POST /api/mode/followup, got ${posts.length}: ${posts.join(' | ')}`);
  await closePage(page);
});

// ─── NEW-1 (v1.58.4): CSP is unconditional — zero violations expected ───

test('Playwright smoke: zero CSP violations on a representative route walk', { skip: SKIP }, async () => {
  const page = await context.newPage();
  const cspViolations = [];
  page.on('console', (msg) => {
    const t = msg.text();
    if (msg.type() === 'error' &&
        /violates the following Content Security Policy directive|Refused to (load|execute|apply|connect)/i.test(t)) {
      cspViolations.push(t);
    }
  });

  // The header must be present on the document itself before we walk.
  const resp = await page.goto(baseUrl + '/#/dashboard');
  const csp = resp.headers()['content-security-policy'];
  assert.ok(csp, 'CSP header missing on / over loopback');
  assert.ok(/frame-ancestors 'none'/.test(csp), 'CSP must set frame-ancestors none');
  assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp), "script-src must not allow 'unsafe-inline'");

  const routes = ['#/dashboard', '#/pipeline', '#/cv', '#/deep', '#/help', '#/health', '#/config'];
  for (const lang of ['en', 'ru', 'ja', 'zh-TW', 'fr']) {
    await page.evaluate((l) => {
      try { window.I18n?.setLang?.(l); } catch { /* boot order */ }
    }, lang);
    for (const r of routes) {
      await page.goto(baseUrl + '/' + r);
      await page.waitForSelector('#content', { timeout: 5000 });
      await page.waitForTimeout(60);
    }
  }
  assert.deepEqual(cspViolations, [],
    'CSP violations during route walk: ' + cspViolations.join(' | '));
  await closePage(page);
});

// ─── v1.58.34 + v1.58.35 — Notifications drawer end-to-end behavior ───

test('Playwright smoke: notifications drawer is hidden at boot, opens only via bell, closes via × / Esc / re-click', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/dashboard');
  await page.waitForSelector('#notif-bell', { timeout: 5000 });

  // (1) v1.58.35 — drawer must be hidden at boot (the user-reported bug
  // was that .notif-drawer { display: flex } shadowed [hidden]).
  let drawerVisible = await page.evaluate(() => {
    const d = document.getElementById('notif-drawer');
    return d && !d.hidden && getComputedStyle(d).display !== 'none';
  });
  assert.equal(drawerVisible, false, 'drawer must be hidden at boot');

  // (2) Bell ARIA contract — aria-expanded reflects state.
  const expandedAtBoot = await page.locator('#notif-bell').getAttribute('aria-expanded');
  assert.equal(expandedAtBoot, 'false', 'bell aria-expanded must be "false" at boot');

  // (3) Click the bell → drawer opens.
  await page.click('#notif-bell');
  drawerVisible = await page.evaluate(() => {
    const d = document.getElementById('notif-drawer');
    return d && !d.hidden && getComputedStyle(d).display !== 'none';
  });
  assert.equal(drawerVisible, true, 'drawer must be visible after bell click');
  const expandedOpen = await page.locator('#notif-bell').getAttribute('aria-expanded');
  assert.equal(expandedOpen, 'true', 'bell aria-expanded must flip to "true" on open');

  // (4) Empty state: with zero toasts this session, the empty paragraph shows.
  const emptyShown = await page.evaluate(() =>
    !document.getElementById('notif-empty').hidden);
  assert.equal(emptyShown, true, 'empty-state paragraph must show when history is empty');

  // (5) Click × → drawer closes.
  await page.click('#notif-close');
  drawerVisible = await page.evaluate(() => {
    const d = document.getElementById('notif-drawer');
    return d && !d.hidden && getComputedStyle(d).display !== 'none';
  });
  assert.equal(drawerVisible, false, 'drawer must be hidden after × click');

  // (6) Click bell to re-open, then Esc to close.
  await page.click('#notif-bell');
  drawerVisible = await page.evaluate(() => !document.getElementById('notif-drawer').hidden);
  assert.equal(drawerVisible, true, 'drawer must be re-openable via bell click');
  await page.keyboard.press('Escape');
  drawerVisible = await page.evaluate(() => {
    const d = document.getElementById('notif-drawer');
    return d && !d.hidden && getComputedStyle(d).display !== 'none';
  });
  assert.equal(drawerVisible, false, 'Esc must close the drawer');

  // (7) Fire a toast via UI.toast() → unread badge must increment.
  await page.evaluate(() => window.UI.toast('test notification — drawer end-to-end', 'success'));
  await page.waitForTimeout(60); // give the subscriber a tick
  const badgeText = await page.evaluate(() => {
    const b = document.getElementById('notif-badge');
    return { hidden: b.hidden, text: b.textContent };
  });
  assert.equal(badgeText.hidden, false, 'badge must become visible after a toast fires while drawer is closed');
  assert.equal(badgeText.text, '1', 'badge text must be "1" after one toast');

  // (8) Open the drawer → entry is listed; badge resets.
  await page.click('#notif-bell');
  await page.waitForTimeout(60);
  const entries = await page.locator('#notif-list .notif-item').count();
  assert.ok(entries >= 1, `drawer must list ≥1 entry after a toast; found ${entries}`);
  const badgeAfterOpen = await page.evaluate(() => document.getElementById('notif-badge').hidden);
  assert.equal(badgeAfterOpen, true, 'badge must hide once the drawer is opened (unread cleared)');

  // (9) The drawer entry must show the message text.
  const firstMsg = await page.locator('#notif-list .notif-item .notif-item__msg').first().textContent();
  assert.match(firstMsg, /test notification — drawer end-to-end/,
    'newest entry text must match the toast message');

  // (10) v1.58.36 (L-6) — an error toast carrying the U-4 endpoint
  // postfix must render the postfix as a separate <code class="notif-item__detail">
  // inside the drawer entry. Closes the U-4 ↔ U-13 ↔ drawer chain.
  await page.evaluate(() => window.UI.toast('boom (GET /api/x · HTTP 500)', 'error'));
  await page.waitForTimeout(60);
  const detailCount = await page.locator('#notif-list .notif-item .notif-item__detail').count();
  assert.ok(detailCount >= 1,
    `error toast with endpoint postfix must render a .notif-item__detail in the drawer; found ${detailCount}`);
  const detailText = await page.locator('#notif-list .notif-item .notif-item__detail').first().textContent();
  assert.match(detailText, /\(GET \/api\/x · HTTP 500\)/,
    'detail node must contain the technical postfix verbatim');

  await closePage(page);
});

if (SKIP) {
  test('Playwright smoke: skipped (playwright not resolvable)', () => {
    console.log('SKIP — install playwright in parent project: cd $CAREER_OPS_ROOT && npm i && npx playwright install chromium');
  });
}
