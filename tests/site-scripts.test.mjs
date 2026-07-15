/**
 * site/ build-script guards (landing follow-up to PR #116 review).
 *
 * The landing's build gates (check-i18n.mjs) and asset pipeline
 * (sync-assets.mjs) are CI gates, not tested code — these tests make the
 * two review-relevant invariants executable:
 *
 *   1. check-i18n.mjs actually FAILS (exit != 0) when a locale dictionary
 *      is missing a key or a whole file — the parity gate is real, not
 *      decorative. Verified against a fixture tree (the script resolves
 *      paths relative to its own location, so we copy it into a mkdtemp
 *      site-shaped skeleton — CI-isolated, no parent project involved).
 *   2. sync-assets.mjs only ever WRITES under site/ — reads from the repo
 *      root (images/, docs/help/, public/) are fine; a write outside site/
 *      would violate the landing's parent-boundary rule. Locked as a
 *      source-level invariant: no write destination may be ROOT-derived.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = join(ROOT, 'site', 'scripts', 'check-i18n.mjs');
const SYNC = join(ROOT, 'site', 'scripts', 'sync-assets.mjs');

const CODES = ['en', 'es', 'fr', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];

/** Build a minimal site-shaped skeleton with two-key dictionaries. */
function fixtureSite() {
  const dir = mkdtempSync(join(tmpdir(), 'site-i18n-'));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'src', 'i18n'), { recursive: true });
  copyFileSync(CHECK, join(dir, 'scripts', 'check-i18n.mjs'));
  for (const code of CODES) {
    writeFileSync(join(dir, 'src', 'i18n', `${code}.json`),
      JSON.stringify({ 'hero.title': `title-${code}`, 'nav.faq': 'FAQ' }));
  }
  return dir;
}

function run(script) {
  try {
    execFileSync(process.execPath, [script], { stdio: 'pipe' });
    return 0;
  } catch (e) {
    return e.status ?? 1;
  }
}

test('check-i18n: passes on a key-parity fixture (16 locales, same keys)', () => {
  const dir = fixtureSite();
  assert.equal(run(join(dir, 'scripts', 'check-i18n.mjs')), 0);
});

test('check-i18n: FAILS when a locale is missing a key (the gate is real)', () => {
  const dir = fixtureSite();
  writeFileSync(join(dir, 'src', 'i18n', 'ru.json'), JSON.stringify({ 'hero.title': 'x' })); // nav.faq dropped
  assert.notEqual(run(join(dir, 'scripts', 'check-i18n.mjs')), 0);
});

test('check-i18n: FAILS when a locale dictionary file is missing entirely', () => {
  const dir = fixtureSite();
  rmSync(join(dir, 'src', 'i18n', 'tr.json'));
  assert.notEqual(run(join(dir, 'scripts', 'check-i18n.mjs')), 0);
});

test('sync-assets: every write call targets a SITE-derived path, never ROOT (source invariant)', () => {
  const src = readFileSync(SYNC, 'utf8');
  assert.match(src, /const SITE = resolve\(/, 'SITE anchor must exist');
  // Every mkdirSync/writeFileSync/cpSync DESTINATION must be a SITE-derived
  // dir (shotsDst / pubDst / logoDst / helpDst / genDir / join(SITE, …)).
  // ROOT may appear as a cpSync READ source — never as a destination.
  const writeCalls = src.match(/(?:writeFileSync|mkdirSync|cpSync)\([^;]*\)/g) || [];
  assert.ok(writeCalls.length >= 5, 'expected the known write sites');
  for (const call of writeCalls) {
    const inner = call.slice(call.indexOf('(') + 1);
    // cpSync(src, dst): destination = everything after the first comma. The
    // known call shapes keep the (allowed) ROOT read-source before it; if a
    // future edit nests commas differently, the widened pattern below still
    // trips on any ROOT-derived expression reaching the destination slice.
    const dest = call.startsWith('cpSync') ? inner.slice(inner.indexOf(',') + 1) : inner;
    assert.doesNotMatch(dest, /(?:join|resolve)\(ROOT|ROOT\s*\+/,
      `write destination must not be ROOT-derived: ${call}`);
  }
});
