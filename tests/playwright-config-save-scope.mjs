/**
 * CONFIG-2 (v1.232.1) — Save must write only what the user actually changed.
 *
 * Two individually sensible decisions combined into a write:
 *
 *   1. v1.57.1 seeds an unset control with its `defaultValue`, so the field
 *      shows the value the server will really use instead of looking blank.
 *      That is right, and it stays.
 *   2. `save()` sent every NON-secret field regardless of whether it was
 *      touched — `dirty` was consulted for secrets only.
 *
 * So the value put there for DISPLAY travelled to the server as if the user had
 * chosen it, and the server dutifully wrote it. Changing one dropdown on a
 * fixture with two keys set posted 28 keys and added 18 the user never opened,
 * each one its own `defaultValue`.
 *
 * Nothing behaves differently the day it happens — the written values ARE the
 * defaults. What changes is their STATUS: from "unset, follow the project
 * default" to "pinned in .env". These curated lists move between releases (the
 * v1.232.0 notes cite `gemini-2.0-flash` dropping out), so the next time a
 * default changes, every user who ever pressed Save is silently left behind on
 * the old one. It is CONFIG-1's shape again: that wrote nonsense, this writes
 * something plausible, which is exactly why it is harder to notice.
 *
 * The fix compares against the loaded snapshot rather than trusting `dirty` —
 * `dirty` also fires when a user types a value and puts the original back.
 *
 * Opt-in (needs a browser binary); CI-isolated under a mkdtemp root.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function resolvePlaywright() {
  for (const c of ['playwright',
    resolve(process.cwd(), '..', 'node_modules', 'playwright'),
    resolve(process.cwd(), 'node_modules', 'playwright')]) {
    try { return require(c); } catch { /* next */ }
  }
  return null;
}
const playwright = resolvePlaywright();
const SKIP = playwright ? false : 'Playwright not installed';

let server, baseUrl, browser, envPath;

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-cfgscope-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, '.env'), 'LLM_PROVIDER=auto\nPORT=4317\n');
  process.env.CAREER_OPS_ROOT = dir;
  envPath = resolve(dir, '.env');
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); });
  });
  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
});

after(async () => {
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
});

const envKeys = () => readFileSync(envPath, 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=.+/.test(l)).map((l) => l.split('=')[0]).sort();

/** Open #/config and capture every /api/config POST body the page sends. */
async function openConfig(page) {
  const posted = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/config') && r.method() === 'POST') {
      try { posted.push(JSON.parse(r.postData() || '{}')); } catch { posted.push({}); }
    }
  });
  await page.goto(baseUrl + '/#/config');
  await page.waitForSelector('#cfg-llm-provider', { timeout: 8000 });
  await page.waitForTimeout(400);
  return posted;
}
const save = async (page) => {
  await page.click('#cfg-tabpanel button.btn-primary');
  await page.waitForTimeout(1200);
};

test('CONFIG-2: changing one field writes exactly that field', { skip: SKIP }, async () => {
  writeFileSync(envPath, 'LLM_PROVIDER=auto\nPORT=4317\n');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    const before = envKeys();
    assert.deepEqual(before, ['LLM_PROVIDER', 'PORT'], 'fixture precondition');

    const posted = await openConfig(page);
    await page.selectOption('#cfg-llm-provider', 'openrouter');
    await save(page);

    const body = posted[0] || {};
    const sent = Object.keys(body).filter((k) => k !== 'lang');
    assert.deepEqual(sent, ['LLM_PROVIDER'],
      `Save posted ${sent.length} keys but only LLM_PROVIDER was touched: ${sent.join(', ')}`);

    const after = envKeys();
    const added = after.filter((k) => !before.includes(k));
    assert.deepEqual(added, [],
      `Save pinned fields the user never opened into .env: ${added.join(', ')}`);
    assert.match(readFileSync(envPath, 'utf8'), /^LLM_PROVIDER=openrouter$/m,
      'the field that WAS changed must be written');
  } finally {
    await context.close();
  }
});

test('CONFIG-2: clearing a filled field still unsets it', { skip: SKIP }, async () => {
  // HOST rather than a regional key: the SPA hides the whole "regional" group
  // unless portals.yml declares Russian sources, so those inputs do not exist.
  // Seeded with a NON-default value so clearing it is a genuine change.
  writeFileSync(envPath, 'LLM_PROVIDER=auto\nPORT=4317\nHOST=0.0.0.0\n');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    const posted = await openConfig(page);
    await page.waitForSelector('#cfg-host', { timeout: 8000 });
    await page.fill('#cfg-host', '');
    await save(page);

    const body = posted[0] || {};
    assert.ok('HOST' in body,
      'a field the user emptied is a change and must be sent, or the key can never be removed');
    assert.equal(body.HOST, '');
    assert.ok(!envKeys().includes('HOST'), 'the key must be gone from .env');
  } finally {
    await context.close();
  }
});

test('CONFIG-2: an untouched Save writes nothing at all', { skip: SKIP }, async () => {
  writeFileSync(envPath, 'LLM_PROVIDER=auto\nPORT=4317\n');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    const before = readFileSync(envPath, 'utf8');
    const posted = await openConfig(page);
    await save(page);

    const sent = Object.keys(posted[0] || {}).filter((k) => k !== 'lang');
    assert.deepEqual(sent, [], `Save with nothing changed still posted: ${sent.join(', ')}`);
    assert.equal(readFileSync(envPath, 'utf8'), before, '.env must be byte-identical');
  } finally {
    await context.close();
  }
});

test('CONFIG-2: the toast reports how many keys were actually written', { skip: SKIP }, async () => {
  writeFileSync(envPath, 'LLM_PROVIDER=auto\nPORT=4317\n');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await openConfig(page);
    await page.selectOption('#cfg-llm-provider', 'openrouter');
    await page.click('#cfg-tabpanel button.btn-primary');
    // The page raises a "Setup issue" toast on load, so wait for the SAVE one
    // rather than for whatever happens to be on screen.
    await page.waitForFunction(
      () => /saved|Сохран|Guardad|保存|儲存|저장|Salvo|Salv|gespeichert|enregistr/i
        .test(document.getElementById('toast')?.textContent || ''),
      null, { timeout: 8000 });
    const txt = (await page.locator('#toast').textContent()) || '';
    // The count used to live inside t()'s FALLBACK argument, and `config.saved`
    // exists in all 17 dictionaries — so the number was never rendered and a
    // Save of 12 keys looked exactly like a Save of one.
    assert.match(txt, /\b1\b/, `the toast should name the number of keys written, got: ${txt}`);
  } finally {
    await context.close();
  }
});

test('CONFIG-2: secrets are still only sent when touched', { skip: SKIP }, async () => {
  writeFileSync(envPath, 'LLM_PROVIDER=auto\nPORT=4317\nOPENROUTER_API_KEY=sk-or-v1-000000000000000000000000\n');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    const posted = await openConfig(page);
    await page.selectOption('#cfg-llm-provider', 'openrouter');
    await save(page);

    const body = posted[0] || {};
    assert.ok(!('OPENROUTER_API_KEY' in body),
      'an untouched secret must never be resent — its control shows a mask, so sending it would write the mask');
    assert.match(readFileSync(envPath, 'utf8'), /^OPENROUTER_API_KEY=sk-or-v1-0{24}$/m,
      'the stored secret must survive a Save it was not part of');
  } finally {
    await context.close();
  }
});

/**
 * The interaction with v1.232.0's grandfathering. A value stored outside the
 * closed domain seeds its own control (the select unshifts an unknown current
 * value so it is never silently dropped), so it now equals its seed and is not
 * resent at all — the validator never even sees it. The server-side leniency
 * stays as the guard for direct API callers.
 */
test('CONFIG-2: a stored out-of-domain value neither blocks Save nor gets rewritten', { skip: SKIP }, async () => {
  writeFileSync(envPath, 'LLM_PROVIDER=legacy-typo\nPORT=4317\n');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    const posted = await openConfig(page);
    await page.fill('#cfg-port', '4318');
    await save(page);

    const sent = Object.keys(posted[0] || {}).filter((k) => k !== 'lang');
    assert.deepEqual(sent, ['PORT'], `only PORT was changed, but Save posted: ${sent.join(', ')}`);
    assert.match(readFileSync(envPath, 'utf8'), /^LLM_PROVIDER=legacy-typo$/m,
      'the pre-existing value must be left exactly as it was');
    assert.match(readFileSync(envPath, 'utf8'), /^PORT=4318$/m, 'the changed field must be written');
  } finally {
    await context.close();
  }
});

/**
 * CONFIG-3 (v1.233.0) — a deliberate choice that happens to equal the seeded
 * value must not be discarded as "untouched".
 *
 * Fallout from v1.232.1's own fix, and its comment claimed the opposite:
 * "the only way to tell a display default apart from a user who deliberately
 * chose that same value". It cannot. `initial` conflates two different origins:
 *
 *   seeded FROM .env         → equal means the field was not edited  (skip: right)
 *   seeded from defaultValue → equal is AMBIGUOUS: never opened, or opened
 *                              and agreed with the default
 *
 * With HOST unset the control shows `127.0.0.1`. Typing that exact value and
 * saving posted `{}` and the key stayed absent — a dead end, because the only
 * way through was to enter a wrong value, save, then set the right one back.
 * Nothing misbehaves (an absent key and a key equal to the default resolve the
 * same), but the UI shows a state the file does not contain, and pressing Save
 * again never reconciles them.
 *
 * The fix adds `seededFromFile`, so `dirty` becomes a valid SECOND signal
 * exactly where the ambiguity lives — fields with no entry in the file. CONFIG-2
 * does not come back: nobody opened those eighteen, so `dirty` is empty for them.
 */
test('CONFIG-3: agreeing with a seeded default is a choice and must be written', { skip: SKIP }, async () => {
  writeFileSync(envPath, 'LLM_PROVIDER=auto\nPORT=4317\n');   // HOST deliberately absent
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    const posted = await openConfig(page);
    await page.waitForSelector('#cfg-host', { timeout: 8000 });
    assert.equal(await page.inputValue('#cfg-host'), '127.0.0.1',
      'precondition: the unset field is seeded with its default');
    assert.ok(!envKeys().includes('HOST'), 'precondition: HOST is absent from .env');

    // Type the SAME value the seed already shows — the ambiguous case.
    await page.fill('#cfg-host', '');
    await page.fill('#cfg-host', '127.0.0.1');
    await save(page);

    const sent = Object.keys(posted[0] || {}).filter((k) => k !== 'lang');
    assert.deepEqual(sent, ['HOST'],
      'a field the user edited must be sent even when the value equals the seed');
    assert.ok(envKeys().includes('HOST'), 'HOST must now exist in .env');
  } finally {
    await context.close();
  }
});

test('CONFIG-3: an untouched seeded default is still not written', { skip: SKIP }, async () => {
  writeFileSync(envPath, 'LLM_PROVIDER=auto\nPORT=4317\n');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    const before = readFileSync(envPath, 'utf8');
    const posted = await openConfig(page);
    await save(page);
    const sent = Object.keys(posted[0] || {}).filter((k) => k !== 'lang');
    assert.deepEqual(sent, [], `CONFIG-2 regression: untouched Save posted ${sent.join(', ')}`);
    assert.equal(readFileSync(envPath, 'utf8'), before, '.env must be byte-identical');
  } finally {
    await context.close();
  }
});

/**
 * ADJACENT-1 — removing a key reported "· 0".
 *
 * The server answered `{ok, written}` only, so a deletion had nothing to count
 * and the user read "Settings saved · 0" as "nothing happened" while the key
 * had in fact been removed. The toast was not lying — it counted writes — it
 * answered a different question from the one being asked.
 */
test('ADJACENT-1: clearing a field reports it as one change, not zero', { skip: SKIP }, async () => {
  writeFileSync(envPath, 'LLM_PROVIDER=auto\nPORT=4317\nHOST=0.0.0.0\n');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await openConfig(page);
    await page.fill('#cfg-host', '');
    await page.click('#cfg-tabpanel button.btn-primary');
    await page.waitForFunction(
      () => /saved|Сохран|Guardad|保存|儲存|저장|Salvo|Salv|gespeichert|enregistr/i
        .test(document.getElementById('toast')?.textContent || ''),
      null, { timeout: 8000 });
    const txt = (await page.locator('#toast').textContent()) || '';
    assert.match(txt, /\b1\b/, `removing a key must be counted as a change, got: ${txt}`);
    assert.ok(!envKeys().includes('HOST'), 'and the key must actually be gone');
  } finally {
    await context.close();
  }
});

/**
 * ADJACENT-2 — a select could be set but never cleared.
 *
 * None of the 18 dropdowns offered an empty option, so the form could not send
 * `''` for one. Text fields can be emptied; selects could not, which combined
 * with CONFIG-3 into a closed loop for an unset select: it could not be pinned
 * (its value equalled the seed) and, if pinned another way, could not be
 * released. An explicit "use the default" entry also makes "not set" stop
 * *looking* like "chosen", which is what made CONFIG-3 possible at all.
 */
test('ADJACENT-2: every select offers an explicit "use the default" option', { skip: SKIP }, async () => {
  writeFileSync(envPath, 'LLM_PROVIDER=auto\nPORT=4317\n');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await openConfig(page);
    const bad = await page.evaluate(() => [...document.querySelectorAll('#cfg-tabpanel select')]
      .filter((s) => ![...s.options].some((o) => o.value === ''))
      .map((s) => s.id));
    assert.deepEqual(bad, [],
      `these dropdowns cannot be cleared — no empty option: ${bad.join(', ')}`);
  } finally {
    await context.close();
  }
});

test('ADJACENT-2: choosing "use the default" removes the key', { skip: SKIP }, async () => {
  writeFileSync(envPath, 'LLM_PROVIDER=auto\nPORT=4317\nDEEPSEEK_MODEL=deepseek-reasoner\n');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    const posted = await openConfig(page);
    await page.waitForSelector('#cfg-deepseek-model', { timeout: 8000 });
    await page.selectOption('#cfg-deepseek-model', '');
    await save(page);
    const body = posted[0] || {};
    assert.equal(body.DEEPSEEK_MODEL, '', 'the empty option must send an empty string');
    assert.ok(!envKeys().includes('DEEPSEEK_MODEL'), 'and the key must be removed from .env');
  } finally {
    await context.close();
  }
});
