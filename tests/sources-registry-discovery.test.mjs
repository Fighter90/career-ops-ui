/**
 * v1.69.0 (P-14) — dynamic auto-discovery of scanner sources.
 *
 * Validates that `server/lib/sources/registry.mjs`:
 *   1. Still produces the same canonical SOURCES list at module load
 *      (regression guard against a missing `export const meta` in one
 *      of the shipped adapters).
 *   2. Re-runs discovery against a fixture directory containing
 *      drop-in adapter files (one good, one broken, one helper).
 *   3. Skips files without a valid `meta` export silently (warned to
 *      stderr) so half-migrated branches and helper-only files do not
 *      break the registry.
 *   4. Preserves the public API surface (SOURCES_BY_REGION,
 *      RU_CONFIG_KEYS, getRegionalSources) — every existing import
 *      keeps working.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  SOURCES,
  SOURCES_BY_REGION,
  RU_CONFIG_KEYS,
  getRegionalSources,
  discoverSources,
} from '../server/lib/sources/registry.mjs';

// ── 1. Shipped adapters are all discovered ───────────────────────────

test('registry: SOURCES is non-empty after auto-discovery', () => {
  assert.ok(SOURCES.length >= 1, 'no sources discovered');
});

test('registry: every shipped EN adapter is present', () => {
  // These adapters live in `server/lib/sources/` and are required for
  // the scanner to keep working. If you intentionally remove one,
  // update this list AND CHANGELOG.
  const expected = ['ashby', 'greenhouse', 'lever', 'rss', 'smartrecruiters', 'workable', 'workday'];
  const got = SOURCES_BY_REGION.en.map((s) => s.value).sort();
  for (const v of expected) {
    assert.ok(got.includes(v), `EN source "${v}" missing — did you delete its meta export?`);
  }
});

test('registry: every shipped RU adapter is present and has configKey', () => {
  const expected = ['geekjob', 'getmatch', 'habr-career', 'hh.ru', 'trudvsem'];
  const got = SOURCES_BY_REGION.ru.map((s) => s.value).sort();
  for (const v of expected) {
    assert.ok(got.includes(v), `RU source "${v}" missing — did you delete its meta export?`);
  }
  for (const s of SOURCES_BY_REGION.ru) {
    assert.ok(s.configKey, `RU source "${s.value}" has no configKey`);
  }
});

test('registry: RU_CONFIG_KEYS matches every RU source configKey, no dupes', () => {
  const expected = SOURCES_BY_REGION.ru.map((s) => s.configKey);
  assert.deepEqual(RU_CONFIG_KEYS, expected);
  assert.equal(new Set(RU_CONFIG_KEYS).size, RU_CONFIG_KEYS.length, 'configKey dupes');
});

test('registry: getRegionalSources returns exactly the RU rows', () => {
  const ru = getRegionalSources();
  assert.equal(ru.length, SOURCES_BY_REGION.ru.length);
  for (const r of ru) {
    assert.ok(r.value && r.label && r.configKey);
  }
});

test('registry: ordering — EN first then RU, alpha by label within region', () => {
  const enLabels = SOURCES_BY_REGION.en.map((s) => s.label);
  const ruLabels = SOURCES_BY_REGION.ru.map((s) => s.label);
  assert.deepEqual(enLabels, [...enLabels].sort((a, b) => a.localeCompare(b)));
  assert.deepEqual(ruLabels, [...ruLabels].sort((a, b) => a.localeCompare(b)));
  // EN comes before RU in the flat list.
  const firstRuIdx = SOURCES.findIndex((s) => s.region === 'ru');
  if (firstRuIdx !== -1) {
    for (let i = 0; i < firstRuIdx; i++) {
      assert.equal(SOURCES[i].region, 'en', `index ${i} should be en, got ${SOURCES[i].region}`);
    }
  }
});

// ── 2. Drop-in behaviour on a fixture directory ──────────────────────

function writeAdapter(dir, name, body) {
  writeFileSync(join(dir, name), body, 'utf8');
}

test('discoverSources: picks up a drop-in adapter with a valid meta export', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cops-discovery-good-'));
  try {
    writeAdapter(dir, 'fake-ats.mjs', `
      export const meta = {
        value: 'fake-ats',
        label: 'Fake ATS',
        region: 'en',
      };
      export async function fetchFakeAts() { return []; }
    `);
    const sources = await discoverSources(dir);
    assert.equal(sources.length, 1);
    assert.deepEqual(sources[0], {
      value: 'fake-ats',
      label: 'Fake ATS',
      region: 'en',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSources: a drop-in RU adapter carries configKey through', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cops-discovery-ru-'));
  try {
    writeAdapter(dir, 'fake-ru.mjs', `
      export const meta = {
        value: 'fake-ru',
        label: 'Fake RU',
        region: 'ru',
        configKey: 'fake_ru',
      };
    `);
    const sources = await discoverSources(dir);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].configKey, 'fake_ru');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSources: skips files without a meta export (helper modules)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cops-discovery-helper-'));
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => { warnings.push(args.join(' ')); };
  try {
    writeAdapter(dir, 'good.mjs', `
      export const meta = { value: 'good', label: 'Good', region: 'en' };
    `);
    // Declared helper (parent convention: a leading underscore means "not a
    // source") — skipped without being imported and without a warning, the
    // way _safe-url.mjs is.
    writeAdapter(dir, '_helper.mjs', `
      export function tinyHash(s) { return s.length; }
    `);
    // An UNDECLARED file with no meta is still a mistake worth a warning: a
    // source someone forgot to give a meta to would otherwise vanish silently.
    writeAdapter(dir, 'forgot-meta.mjs', `
      export function fetchSomething() { return []; }
    `);
    const sources = await discoverSources(dir);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].value, 'good');
    assert.ok(warnings.some((w) => w.includes('forgot-meta.mjs')), 'expected a console.warn for the undeclared file');
    assert.ok(!warnings.some((w) => w.includes('_helper.mjs')), 'a _-prefixed helper must be skipped silently');
  } finally {
    console.warn = originalWarn;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSources: rejects malformed meta (RU without configKey)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cops-discovery-bad-ru-'));
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    writeAdapter(dir, 'bad-ru.mjs', `
      export const meta = { value: 'bad-ru', label: 'Bad RU', region: 'ru' };
    `);
    const sources = await discoverSources(dir);
    assert.equal(sources.length, 0, 'RU source without configKey must be skipped');
  } finally {
    console.warn = originalWarn;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSources: rejects malformed meta (bad region)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cops-discovery-bad-region-'));
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    writeAdapter(dir, 'bad-region.mjs', `
      export const meta = { value: 'x', label: 'X', region: 'mars' };
    `);
    const sources = await discoverSources(dir);
    assert.equal(sources.length, 0, 'meta.region must be "en" or "ru"');
  } finally {
    console.warn = originalWarn;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSources: registry.mjs itself is excluded from auto-discovery', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cops-discovery-self-'));
  try {
    writeAdapter(dir, 'registry.mjs', `
      export const meta = { value: 'should-not-load', label: 'X', region: 'en' };
    `);
    writeAdapter(dir, 'other.mjs', `
      export const meta = { value: 'other', label: 'Other', region: 'en' };
    `);
    const sources = await discoverSources(dir);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].value, 'other');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSources: missing directory yields empty array, never throws', async () => {
  const sources = await discoverSources(join(tmpdir(), 'cops-does-not-exist-xyz-12345'));
  assert.deepEqual(sources, []);
});

test('discoverSources: deterministic order on identical input', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cops-discovery-determ-'));
  try {
    writeAdapter(dir, 'zeta.mjs', `export const meta = { value: 'zeta', label: 'Zeta', region: 'en' };`);
    writeAdapter(dir, 'alpha.mjs', `export const meta = { value: 'alpha', label: 'Alpha', region: 'en' };`);
    writeAdapter(dir, 'middle.mjs', `export const meta = { value: 'mid', label: 'Middle', region: 'en' };`);
    const a = await discoverSources(dir);
    const b = await discoverSources(dir);
    assert.deepEqual(a.map((s) => s.value), b.map((s) => s.value));
    assert.deepEqual(a.map((s) => s.label), ['Alpha', 'Middle', 'Zeta']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
