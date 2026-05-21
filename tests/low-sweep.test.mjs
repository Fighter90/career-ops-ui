/**
 * v1.52.0 (WS2 UX-audit LOWs #33–#40) — batched polish: consistent
 * dashboard CTAs, labelled archetype chips, i18n'd health toasts +
 * list-semantic check results, keyboard-operable report cards,
 * activity 500-cap notice, localized batch placeholders, announced
 * mode-page relabel. Browser-only views → static assertions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const V = (f) => readFileSync(resolve(__d, '..', 'public', 'js', 'views', f), 'utf8');
const DICT = legacyDictText();

test('#33 dashboard: hero CTAs carry a leading icon', () => {
  // v1.58.25 (U-5) — the header `Open Pipeline` CTA was removed (dupe of
  // sidebar /pipeline). Two hero CTAs remain — '✨ Auto-pipeline a URL'
  // (primary) and '🌐 Scan now' (secondary) — both still icon-prefixed.
  const d = V('dashboard.js');
  assert.match(d, /'🌐 ' \+ t\('dash\.scanNow'/);
  assert.match(d, /'✨ ' \+ t\('dash\.autoPipeline'/);
  // Negative: the removed CTA must stay gone.
  assert.ok(!/'📋 ' \+ t\('dash\.openPipeline'\)/.test(d),
    "v1.58.25 (U-5) removed the 'Open Pipeline' header CTA");
});

test('#34 settings: archetype fit/level chips are self-describing + aria', () => {
  const s = V('settings.js');
  assert.match(s, /t\('set\.fit', 'Fit'\) \+ ': ' \+ a\.fit/);
  assert.match(s, /t\('set\.level', 'Level'\) \+ ': ' \+ a\.level/);
  assert.match(s, /'aria-label': t\('set\.fit'/);
  assert.ok(!/c\('span', \{ className: 'tag' \}, a\.fit \|\| ''\)/.test(s), 'old bare fit chip gone');
});

test('#35 health: doctor/verify toasts are i18n-keyed (no raw filename)', () => {
  const h = V('health.js');
  assert.match(h, /UI\.toast\(t\('health\.runningDoctor'/);
  assert.match(h, /UI\.toast\(t\('health\.runningVerify'/);
  assert.ok(!/UI\.toast\('doctor\.mjs…'\)/.test(h), 'raw doctor.mjs toast gone');
});

test('#36 health: check results are a list with name↔status aria pairing', () => {
  const h = V('health.js');
  assert.match(h, /c\('ul', \{ className: 'card-row', role: 'list'/);
  assert.match(h, /c\('li', \{ className: 'card' \}/);
  assert.match(h, /'aria-label': ch\.name \+ ': ' \+ badgeText/);
});

test('#37 reports: cards are keyboard-operable (role=link, tabindex, keydown)', () => {
  const r = V('reports.js');
  assert.match(r, /role: 'link',\s*\n?\s*tabindex: '0'/);
  assert.match(r, /onKeydown: \(e\) =>[\s\S]{0,80}'Enter' \|\| e\.key === ' '[\s\S]{0,40}open\(\)/);
});

test('#38 activity: 500-cap is reconciled + a truncation notice surfaces', () => {
  const a = V('activity.js');
  assert.match(a, /const CAP = 500;/);
  assert.ok(!/server returns up to 200 events/.test(a), 'stale "200" comment must be gone');
  assert.match(a, /t\('activity\.truncated'[\s\S]{0,80}\.replace\('\{n\}', String\(CAP\)\)/);
  assert.match(a, /allEvents\.length >= CAP \? '' : 'none'/);
});

test('#39 batch: prose placeholders are i18n-keyed', () => {
  const b = V('batch.js');
  for (const k of ['batch.minScorePh', 'batch.maxRetriesPh', 'batch.modelPh', 'batch.startFromPh']) {
    assert.match(b, new RegExp(`placeholder: t\\('${k.replace('.', '\\.')}'`));
  }
});

test('#40 mode-page: async relabel is announced via a polite live region', () => {
  const m = V('mode-page.js');
  assert.match(m, /const liveAnnounce = c\('div', \{\s*\n?\s*role: 'status', 'aria-live': 'polite'/);
  assert.match(m, /liveAnnounce\.textContent = t\('mode\.liveReadyAnnounce'/);
});

test('i18n: all 10 new LOW-sweep keys present with 8 locales (+{n})', () => {
  for (const k of [
    'set.fit', 'set.level', 'health.runningDoctor', 'health.runningVerify',
    'activity.truncated', 'batch.minScorePh', 'batch.maxRetriesPh',
    'batch.modelPh', 'batch.startFromPh', 'mode.liveReadyAnnounce',
  ]) {
    const line = DICT.split('\n').find((l) => l.includes(`'${k}'`));
    assert.ok(line, `missing i18n key ${k}`);
    for (const loc of ['en', 'es', "'pt-BR'", 'ko', 'ja', 'ru', "'zh-CN'", "'zh-TW'"]) {
      assert.ok(line.includes(loc + ':'), `${k} missing locale ${loc}`);
    }
  }
  const tr = DICT.split('\n').find((l) => l.includes("'activity.truncated'"));
  assert.ok((tr.match(/\{n\}/g) || []).length >= 8, 'activity.truncated must keep {n} in every locale');
});
