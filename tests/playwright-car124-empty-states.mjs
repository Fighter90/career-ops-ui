/**
 * CAR-124 review round — browser-level gates for the empty states whose
 * defects only exist in a real DOM:
 *
 *   f3/f4 (auto)  the example URL is a non-real jobs.example.com address and
 *                 the "Try an example" button fills an EMPTY field only — a
 *                 user-typed URL (and a `?url=` deep link) is never
 *                 overwritten; a deep link skips the example block entirely.
 *   f7/f8 (batch) the programmatic paste lands in the editor as real rows
 *                 (first token only — a spreadsheet row's tabs must not leak
 *                 into the url cell), hides the first-run card via the
 *                 dispatched input event, and Save persists the pasted rows.
 *
 * CI-isolated: a throw-away CAREER_OPS_ROOT via mkdtempSync — never the
 * user's real career-ops data; no network beyond 127.0.0.1 (the example run
 * is never started; the save goes to the local server only).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function resolvePlaywright() {
  const candidates = [];
  if (process.env.CAREER_OPS_PLAYWRIGHT_PATH) candidates.push(process.env.CAREER_OPS_PLAYWRIGHT_PATH);
  for (const id of ['playwright', resolve(process.cwd(), '..', 'node_modules', 'playwright'), resolve(process.cwd(), 'node_modules', 'playwright')]) {
    candidates.push(id);
  }
  for (const id of candidates) {
    try { return require(id); } catch { /* next */ }
  }
  return null;
}
const playwright = resolvePlaywright();
const SKIP = !playwright;

let server, baseUrl, browser, context;

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-car124-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nReal Person, Senior Backend Engineer.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');

  process.env.CAREER_OPS_ROOT = dir;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
  context = await browser.newContext();
  // the batch paste test reads the REAL clipboard (a stubbed readText would
  // not exercise the guard under review)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseUrl });
});

after(async () => {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
});

// Pin the UI to EN so text selectors are locale-stable.
async function newPage() {
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('career-ops-ui:lang', 'en');
  });
  return page;
}
const exampleBtn = (page) => page.locator('button', { hasText: 'Try an example URL' });

test('f3+f4 auto: the example URL is a reserved example.com address and fills an EMPTY field only', async () => {
  const page = await newPage();
  await page.goto(baseUrl + '/#/auto');
  await page.waitForSelector('#auto-url');
  assert.equal(await page.locator('.v2-empty-example').count(), 1, 'the example block is visible on a clean mount');

  // the user types their own URL first — the button must NOT overwrite it
  await page.fill('#auto-url', 'https://my-real-board.example/careers/999');
  await exampleBtn(page).click();
  assert.equal(await page.inputValue('#auto-url'), 'https://my-real-board.example/careers/999',
    'a filled field survives the example click');

  // an empty field gets the sample URL — a deliberately non-real host
  await page.fill('#auto-url', '');
  await exampleBtn(page).click();
  const v = await page.inputValue('#auto-url');
  assert.match(v, /^https:\/\/jobs\.example\.com\//, 'the sample URL is an IETF-reserved example.com address');
  assert.ok(!/greenhouse\.io|lever\.co|ashbyhq\.com/.test(v), 'no real ATS host in the sample');
  // and nothing ran: the Run button is idle (dict label: auto.run → "Run auto-pipeline")
  const runBtn = page.locator('button', { hasText: 'Run auto-pipeline' });
  assert.equal(await runBtn.getAttribute('aria-busy'), null, 'no run was started');
  await page.close();
});

test('f4 auto: a ?url= deep link skips the example block and keeps its URL', async () => {
  const page = await newPage();
  await page.goto(baseUrl + '/#/auto?url=https://deep-link.example/j/42');
  await page.waitForSelector('#auto-url');
  assert.equal(await page.locator('.v2-empty-example').count(), 0,
    'no example block for a deep link (the field arrives filled)');
  assert.equal(await page.inputValue('#auto-url'), 'https://deep-link.example/j/42');
  await page.close();
});

test('f5+f7+f8 batch: a pasted spreadsheet row lands as clean TSV rows, hides the card, and Save persists', async () => {
  const page = await newPage();
  await page.goto(baseUrl + '/#/batch');
  await page.waitForSelector('#batch-tsv');
  assert.equal(await page.locator('.v2-empty-example').count(), 1, 'the first-run card is visible with an empty TSV');

  // line 2 carries a spreadsheet tab + notes — only the URL token may survive
  await page.evaluate(() => navigator.clipboard.writeText(
    'https://pw-a.example/j/1\nhttps://pw-b.example/j/2\tSenior Dev\tBerlin\n'));
  await page.locator('button', { hasText: 'Paste URL list' }).click();
  // pasteUrlList is async (clipboard IPC) — wait for the rows, not the click
  await page.waitForFunction(() => /pw-a\.example/.test(document.querySelector('#batch-tsv')?.value || ''));

  const raw = await page.inputValue('#batch-tsv');
  // regex (not split+trim — the editor's trailing newline/whitespace would
  // trim the row's own trailing tabs) — each row is exactly id, url, empty
  // source/notes with NO foreign tab inside the url cell
  assert.match(raw, /(^|\n)1\thttps:\/\/pw-a\.example\/j\/1\t\t(\n|$)/, 'row 1: id, url, empty source/notes');
  assert.match(raw, /(^|\n)2\thttps:\/\/pw-b\.example\/j\/2\t\t(\n|$)/,
    'row 2: the spreadsheet tab-tail was stripped from the url cell');
  assert.equal(raw.trim().split('\n').length, 2, 'two clean rows appended');

  // f8 — the dispatched input event ends the first-run state immediately
  // (syncEmptyCard sets display:none; the node stays in the DOM, so assert
  // on visibility, not DOM count)
  assert.ok(await page.locator('.v2-empty-example').first().isHidden(),
    'the empty-state card hides as soon as the editor holds content');

  // f7 — Save persists EXACTLY the pasted rows (no stale/empty write)
  const [saveResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/batch') && r.request().method() === 'PUT'),
    page.locator('button', { hasText: 'Save' }).first().click(),
  ]);
  assert.equal(saveResp.status(), 200, 'the save round-trips');
  const stored = await page.evaluate(async () => (await (await fetch('/api/batch')).json()).raw);
  assert.ok(stored.includes('https://pw-a.example/j/1') && stored.includes('https://pw-b.example/j/2'),
    'the pasted rows reached batch-input.tsv');
  assert.match(stored, /(^|\n)2\thttps:\/\/pw-b\.example\/j\/2\t\t(\n|$)/m,
    'no tab leaked into the url cell of the stored file');
  await page.close();
});

test('f8 batch: a saved TSV keeps the first-run card hidden on reload', async () => {
  const page = await newPage();
  await page.goto(baseUrl + '/#/batch');
  await page.waitForSelector('#batch-tsv');
  assert.ok((await page.inputValue('#batch-tsv')).trim().length > 0, 'the saved TSV is loaded');
  assert.ok(await page.locator('.v2-empty-example').first().isHidden(),
    'no first-run card once a TSV exists (initial hasInput gate)');
  await page.close();
});
