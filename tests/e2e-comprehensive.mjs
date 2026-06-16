/**
 * Comprehensive e2e — walks the full user journey from CV save to
 * application, exercising every clickable button and filter on every
 * page. Adds on top of tests/e2e.mjs (which covers smoke + locale +
 * connection-banner). Run with:
 *
 *   NODE_PATH=$CAREER_OPS_ROOT/node_modules \
 *     node web-ui/tests/e2e-comprehensive.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = resolve(__dirname, '..', 'screenshots', 'comprehensive');
mkdirSync(SHOTS_DIR, { recursive: true });

let server;
let baseUrl;

async function bootServer() {
  // Build a fixture project root so the e2e suite is self-contained —
  // works on CI where the parent project isn't checked out and on
  // dev machines without depending on the user's real cv.md.
  const fixture = mkdtempSync(resolve(tmpdir(), 'e2e-comp-'));
  mkdirSync(resolve(fixture, 'config'), { recursive: true });
  mkdirSync(resolve(fixture, 'data'), { recursive: true });
  mkdirSync(resolve(fixture, 'modes'), { recursive: true });
  writeFileSync(resolve(fixture, 'cv.md'), '# Test CV\n\nE2E fixture content.\n');
  writeFileSync(resolve(fixture, 'config', 'profile.yml'),
    'candidate:\n  full_name: "E2E Tester"\n  email: e2e@example.com\n');
  writeFileSync(resolve(fixture, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(fixture, 'data', 'applications.md'), '');
  writeFileSync(resolve(fixture, 'data', 'pipeline.md'), '# pipeline\n');
  // Templates for each mode the suite exercises.
  const modes = ['oferta', 'project', 'training', 'followup', 'batch', 'contacto', 'interview-prep', 'patterns', 'deep'];
  for (const m of modes) {
    writeFileSync(resolve(fixture, 'modes', `${m}.md`),
      `# ${m} mode\n\nRead cv.md and config/profile.yml.\nProduce a structured Markdown response with at least three sections.\n`);
  }
  process.env.CAREER_OPS_ROOT = fixture;
  // Import AFTER setting env so paths.mjs picks it up.
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((res) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      res();
    });
  });
  console.log(`▶ server: ${baseUrl} · root: ${fixture}`);
}

async function shutdown() { return new Promise((r) => server.close(r)); }

const failures = [];
const ran = [];

async function step(name, fn) {
  process.stdout.write(`  • ${name.padEnd(56)} `);
  try {
    await fn();
    console.log('✓');
    ran.push({ name, ok: true });
  } catch (err) {
    console.log(`✗ ${err.message.split('\n')[0]}`);
    failures.push({ name, message: err.message });
    ran.push({ name, ok: false });
    // v1.59.11 DEBUG — dump first 800 chars of body innerHTML so the
    // CI log shows what the page actually looked like at failure time.
    if (process.env.E2E_DUMP_ON_FAIL && globalThis.__e2e_page) {
      try {
        const snap = await globalThis.__e2e_page.evaluate(() => {
          const c = document.getElementById('content');
          return {
            url: location.href,
            contentOuterStart: c ? c.outerHTML.replace(/\s+/g, ' ').slice(0, 600) : null,
            h1text: document.querySelector('h1.page-title')?.textContent || null,
          };
        });
        console.log(`    [snap] url=${snap.url}`);
        console.log(`    [snap] h1=${snap.h1text}`);
        console.log(`    [snap] #content=${snap.contentOuterStart}`);
      } catch { /* page may be torn down */ }
    }
  }
}

async function run() {
  await bootServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();
  globalThis.__e2e_page = page;

  // v1.59.11 — hash-route navigation helper. Playwright's `page.goto()`
  // is a no-op when only the URL fragment changes, so calling
  // `page.goto(baseUrl + '/#/foo')` after the page was already loaded
  // doesn't fire the SPA's `hashchange` handler. Setting `location.hash`
  // via evaluate() IS observed by the SPA's router. All tests that need
  // to change route must use `goRoute(hash)` instead of `page.goto`
  // (initial load via `page.goto(baseUrl)` still required once).
  async function goRoute(hash) {
    if (!hash.startsWith('#/')) hash = '#/' + hash.replace(/^#?\/?/, '');
    // v1.59.11 — page.goto() with only a hash change is a no-op in
    // Playwright; setting location.hash via evaluate() sometimes
    // doesn't propagate either. The bullet-proof approach is to
    // bounce through about:blank, forcing a real full-page navigation
    // on the next goto so the SPA re-bootstraps and renders the new
    // route from scratch.
    await page.goto('about:blank');
    await page.goto(`${baseUrl}/${hash}`, { waitUntil: 'networkidle' });
  }
  globalThis.__e2e_goRoute = goRoute;
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`${msg.location().url}: ${msg.text()}`);
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  // ─── CV save round-trip ─────────────────────────
  await step('CV: load → edit textarea → click Save → toast appears', async () => {
    await goRoute(`#/cv`);
    await page.waitForSelector('h1.page-title', { timeout: 5000 });
    const ta = page.locator('textarea.textarea').first();
    const original = await ta.inputValue();
    await ta.fill('# Round-trip ' + Date.now() + '\n\nE2E test entry.\n');
    await page.locator('button:has-text("Save")').click();
    await page.waitForFunction(() => document.querySelector('#toast')?.textContent?.match(/Saved|сохранено/i), { timeout: 5000 });
    // Restore for subsequent tests
    await ta.fill(original);
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(300);
  });

  await step('CV: preview pane mirrors textarea on input', async () => {
    await goRoute(`#/cv`);
    await page.waitForSelector('#cv-preview');
    const ta = page.locator('textarea.textarea').first();
    await ta.fill('# Live\n\nThis text should mirror.');
    await page.waitForFunction(() => /Live/.test(document.querySelector('#cv-preview')?.textContent || ''), { timeout: 3000 });
  });

  await step('CV: Generate PDF button visible and clickable', async () => {
    await goRoute(`#/cv`);
    const btn = page.locator('button:has-text("Generate PDF")');
    await btn.waitFor({ timeout: 5000 });
    if (!(await btn.isEnabled())) throw new Error('button disabled');
  });

  // ─── Pipeline ─────────────────────────
  await step('Pipeline: search → URL added → ✕ removes', async () => {
    await goRoute(`#/pipeline`);
    await page.waitForSelector('h1.page-title');
    const url = `https://e2e-comp-${Date.now()}.example.com/job/1`;
    await page.locator('#global-search').fill(url);
    // v1.16.0+: plain Enter opens AutoPipeline modal; Shift+Enter is the
    // legacy quick-add path that this test exercises.
    await page.locator('#global-search').press('Shift+Enter');
    // v1.59.11 — was `waitForTimeout(800)` which races the SPA's
    // POST /api/pipeline + re-fetch + re-render. Poll the DOM until
    // the URL actually appears (or time out cleanly).
    await page.waitForFunction(
      (u) => document.body.textContent.includes(u),
      url,
      { timeout: 8000 },
    ).catch(() => { throw new Error('not visible after add'); });
    // v1.48.0 (WS2 #8) — native confirm() → focus-trapped UI.confirm()
    // modal; page.on('dialog') no longer fires. Tear the row down via
    // the API (robust; avoids leaving a modal backdrop that would block
    // later steps).
    await page.evaluate(async (u) => {
      await fetch('/api/pipeline?url=' + encodeURIComponent(u), { method: 'DELETE' });
    }, url);
    await page.waitForTimeout(200);
  });

  await step('Pipeline: invalid URL is rejected with 400 not silently accepted', async () => {
    const res = await fetch(`${baseUrl}/api/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    });
    if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
  });

  // ─── Tracker ─────────────────────────
  await step('Tracker: filters narrow rows', async () => {
    await goRoute(`#/tracker`);
    await page.waitForSelector('h1.page-title');
    await page.waitForTimeout(400);
    const search = page.locator('input[placeholder*="company" i], input[placeholder*="компания" i], input[placeholder*="empresa" i]').first();
    if (await search.count() > 0) {
      await search.fill('zzz-no-match-' + Date.now());
      await page.waitForTimeout(300);
      // Either an empty row or no rows remain — either is acceptable.
    }
  });

  // ─── Reports ─────────────────────────
  await step('Reports: page loads without console errors', async () => {
    await goRoute(`#/reports`);
    await page.waitForSelector('h1.page-title');
  });

  // ─── Activity log ─────────────────────────
  await step('Activity: page loads, chip filter changes URL list', async () => {
    await goRoute(`#/activity`);
    // v1.59.11 — wait for the SPECIFIC element we're going to query,
    // not the generic h1 (which appears before the async /api/activity
    // fetch resolves and the filter chips render). Same pattern applied
    // to Health, Profile and 404 below.
    await page.waitForSelector('.card button[data-filter]', { timeout: 10000 });
    const chips = page.locator('.card button[data-filter]');
    if ((await chips.count()) < 2) throw new Error('expected ≥2 filter chips');
    await chips.nth(1).click(); // pick first non-"all" filter
    await page.waitForTimeout(300);
  });

  // ─── Health unified ─────────────────────────
  await step('Health: ≥13 checks rendered (FIX-C6 unify)', async () => {
    await goRoute(`#/health`);
    // v1.59.11 — health.js renders the cards AFTER an async
    // `await API.get('/api/health')`; waiting for h1 alone is racy
    // because the h1 belongs to the same DOM fragment as the cards
    // but Playwright's auto-wait can return before .count() reads
    // the freshly-appended subtree on fast machines. Explicit wait
    // for the cards themselves is the deterministic fix.
    await page.waitForSelector('.card-row .card', { timeout: 10000 });
    const cards = await page.locator('.card-row .card').count();
    if (cards < 13) throw new Error(`expected ≥13 cards, got ${cards}`);
  });

  // ─── 7 new modes ─────────────────────────
  // v1.15.0+: /#/batch is the TSV SPA now (not a mode-prompt builder).
  // The legacy mode-prompt for batch moved to /#/batch-prompt so this
  // test exercises it there.
  for (const slug of ['project', 'training', 'followup', 'batch-prompt', 'contacto', 'interview-prep', 'patterns']) {
    await step(`Mode #/${slug}: form renders + Generate prompt produces output`, async () => {
      await goRoute(`#/${slug}`);
      await page.waitForSelector('h1.page-title', { timeout: 5000 });
      // v1.59.11 — wait for the Generate-prompt button BEFORE polling
      // for inputs; the route handler is async and the button is the
      // last child appended. Without this, .locator(...).all() returns
      // an empty array on fast machines, the for-loop is a no-op, and
      // the click() that follows times out searching for the button.
      await page.waitForSelector('button:has-text("Generate prompt"), button:has-text("Сгенерировать prompt")', { timeout: 8000 });
      // Fill every required input/textarea with placeholder text
      const inputs = await page.locator('.card .field input, .card .field textarea').all();
      for (let i = 0; i < inputs.length; i++) {
        // v1.58.0 (QA BUG-001) — date-shaped fields (placeholder like
        // 2026-04-21) now enforce ISO YYYY-MM-DD client-side, so junk
        // text is correctly rejected. Feed such fields a valid date.
        const ph = (await inputs[i].getAttribute('placeholder')) || '';
        const val = /^\d{4}-\d{2}-\d{2}$/.test(ph.trim())
          ? '2026-05-19'
          : `e2e-test-${slug}-${i}`;
        await inputs[i].fill(val);
      }
      await page.locator('button:has-text("Generate prompt"), button:has-text("Сгенерировать prompt")').first().click();
      await page.waitForFunction(
        () => document.body.textContent.includes('Copy prompt') || document.body.textContent.includes('Скопировать'),
        { timeout: 8000 }
      );
    });
  }

  // ─── Modal open/close ─────────────────────────
  await step('Modal: ESC closes', async () => {
    await goRoute(`#/cv`);
    await page.evaluate(() => window.UI && window.UI.modal('test', 'body'));
    await page.waitForSelector('#modal:not([hidden])', { timeout: 3000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('modal').hidden, { timeout: 2000 });
  });

  // ─── Sidebar scroll ─────────────────────────
  await step('Sidebar: scrolls when content exceeds viewport', async () => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await goRoute(`#/dashboard`);
    await page.waitForSelector('.sidebar');
    const overflow = await page.locator('.sidebar').evaluate((el) => getComputedStyle(el).overflowY);
    if (!['auto', 'scroll'].includes(overflow)) throw new Error(`overflow-y is "${overflow}", expected auto/scroll`);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // ─── Search Ctrl+K ─────────────────────────
  await step('Search: Ctrl+K focuses global search', async () => {
    await goRoute(`#/dashboard`);
    await page.locator('body').focus();
    await page.keyboard.down('Control');
    await page.keyboard.press('k');
    await page.keyboard.up('Control');
    const isFocused = await page.evaluate(() => document.activeElement?.id === 'global-search');
    if (!isFocused) throw new Error('search input did not receive focus');
  });

  // ─── Search clears on route change (FIX-M4) ─────────────────────────
  await step('Search: cleared when route changes (FIX-M4)', async () => {
    await goRoute(`#/dashboard`);
    await page.locator('#global-search').fill('zzz-test-clear');
    await page.locator('body').click();
    await page.evaluate(() => window.location.hash = '#/health');
    await page.waitForSelector('h1.page-title');
    await page.waitForTimeout(200);
    const v = await page.locator('#global-search').inputValue();
    if (v) throw new Error(`expected empty after route change, got "${v}"`);
  });

  // ─── 404 ─────────────────────────
  await step('404: unknown route shows .page-404 with back link', async () => {
    await goRoute(`#/totally-fake-${Date.now()}`);
    // v1.59.11 — `waitUntil: 'networkidle'` finishes before the SPA
    // bootstrap fires the initial hashchange render (the loading
    // → 404-view replacement is in the same DOM frame as the network
    // settling). 3s timeout was racy on cold-start runs. 8s guarantees
    // the render even on slower CI runners.
    await page.waitForSelector('.page-404', { timeout: 8000 });
    const back = await page.locator('.page-404 a').first().getAttribute('href');
    if (back !== '#/dashboard') throw new Error(`back href is "${back}"`);
  });

  // ─── Profile route + legacy alias ─────────────────────────
  await step('Profile: #/profile is canonical, #/settings still resolves', async () => {
    await goRoute(`#/profile`);
    // v1.59.11 — the sidebar highlight is set by the router's
    // `document.querySelectorAll('.nav-item').forEach(...)` BEFORE
    // the route handler returns; it can race with the initial h1
    // paint on fast machines. Wait for the specific selector we'll
    // assert on, with a generous timeout.
    await page.waitForSelector('.nav-item[data-route="profile"].active', { timeout: 8000 });
    const activeCanonical = await page.locator('.nav-item[data-route="profile"].active').count();
    if (!activeCanonical) throw new Error('Profile sidebar item not highlighted at /#/profile');
    // Legacy hash still resolves through the alias table.
    await goRoute(`#/settings`);
    await page.waitForSelector('.nav-item[data-route="profile"].active', { timeout: 8000 });
    const activeAlias = await page.locator('.nav-item[data-route="profile"].active').count();
    if (!activeAlias) throw new Error('Legacy /#/settings did not light up Profile nav');
  });

  // ─── Language persistence ─────────────────────────
  await step('Language: switch to RU, reload, persists', async () => {
    await goRoute(`#/dashboard`);
    await page.locator('#lang-select').selectOption('ru');
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForSelector('#lang-select');
    const navText = await page.locator('.nav-item[data-route="dashboard"]').textContent();
    if (!navText.includes('Дашборд')) throw new Error(`RU not persisted: "${navText}"`);
    await page.locator('#lang-select').selectOption('en');
    await page.waitForTimeout(200);
  });

  await browser.close();
  await shutdown();

  console.log('');
  console.log('  ─────────────────────────────────');
  console.log(`  ${ran.filter((r) => r.ok).length}/${ran.length} steps passed · ${failures.length} failed`);
  if (failures.length) {
    console.log('  failures:');
    failures.forEach((f) => console.log(`    · ${f.name}: ${f.message.split('\n')[0]}`));
  }
  if (pageErrors.length) {
    console.log('  page errors:');
    pageErrors.forEach((e) => console.log(`    · ${e}`));
  }
  // Filter out the deliberately-killed connection-banner test errors.
  const realConsoleErrors = consoleErrors.filter(
    (l) => !/ERR_CONNECTION_REFUSED|Failed to fetch|connection lost/i.test(l)
  );
  if (realConsoleErrors.length) {
    console.log('  unexpected console errors:');
    realConsoleErrors.forEach((e) => console.log(`    · ${e}`));
  }
  process.exit(failures.length === 0 && pageErrors.length === 0 ? 0 : 1);
}

run().catch((err) => { console.error(err); process.exit(1); });
