/**
 * CAR-137 — HelpHint on the 13 remaining views + the mode-page kit.
 *
 * The v1.143.0 `?` affordance (help-hint.test.mjs) covered the 8 AI/analytics
 * views and the 9 core workflow views. CAR-137 wires the same affordance onto
 * every remaining page H1 — 12 single views plus the mode-page kit, which
 * renders 8 mode pages (project / training / followup / batch-prompt /
 * contacto / cover / interview-prep / patterns) through one shared builder and
 * therefore carries a `hintKey` per mode config.
 *
 * Gates (all static + dict-level, CI-isolated):
 *   - each of the 12 views builds its page H1 via HelpHint.title() bound to
 *     its `help.hint.<slug>` key;
 *   - mode-page.js declares all 8 per-mode hintKeys and renders them through
 *     HelpHint.title(t(cfg.titleKey), cfg.hintKey);
 *   - every referenced key exists with a non-empty value in all 19 locale
 *     tables (the assembled dict is exactly what the browser loads).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
/** Escape every regex metacharacter before interpolating a key into a RegExp. */
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

// view file (public/js/views/<file>.js) → its page-level hint key
const VIEW_KEYS = {
  pipeline: 'help.hint.pipeline',
  reports: 'help.hint.reports',
  dashboard: 'help.hint.dashboard',
  cv: 'help.hint.cvEditor',
  portals: 'help.hint.portals',
  usage: 'help.hint.usage',
  activity: 'help.hint.activity',
  assessments: 'help.hint.assessments',
  map: 'help.hint.map',
  health: 'help.hint.health',
  'docs-assistant': 'help.hint.docsAssistant',
  settings: 'help.hint.settings',
};

// the 8 mode-page kit keys, one per MODES entry
const MODE_KEYS = [
  'help.hint.modeProject',
  'help.hint.modeTraining',
  'help.hint.modeFollowup',
  'help.hint.modeBatch',
  'help.hint.modeContacto',
  'help.hint.modeCover',
  'help.hint.modeInterviewPrep',
  'help.hint.modePatterns',
];

const ALL_KEYS = [...Object.values(VIEW_KEYS), ...MODE_KEYS];

test('CAR-137: the 12 remaining views build their page H1 via HelpHint.title()', () => {
  for (const [view, key] of Object.entries(VIEW_KEYS)) {
    const src = read(`public/js/views/${view}.js`);
    assert.match(
      src,
      new RegExp(`HelpHint\\.title\\(.*'${reEsc(key)}'`),
      `${view}.js must wire ${key} via HelpHint.title`,
    );
    // global declaration hygiene — mirrors batch.js / tracker.js / scan.js
    assert.match(src, /\/\* global [^*]*\bHelpHint\b/, `${view}.js /* global */ must list HelpHint`);
  }
});

test('CAR-137: mode-page kit declares all 8 per-mode hintKeys and renders them', () => {
  const src = read('public/js/views/mode-page.js');
  for (const key of MODE_KEYS) {
    assert.match(
      src,
      new RegExp(`hintKey:\\s*'${reEsc(key)}'`),
      `mode-page.js MODES must declare hintKey '${key}'`,
    );
  }
  assert.match(
    src,
    /HelpHint\.title\(\s*t\(\s*cfg\.titleKey\s*\)\s*,\s*cfg\.hintKey\s*\)/,
    'mode-page.js must render the page H1 via HelpHint.title(t(cfg.titleKey), cfg.hintKey)',
  );
  assert.match(src, /\/\* global [^*]*\bHelpHint\b/, 'mode-page.js /* global */ must list HelpHint');
});

test('CAR-137: all 20 hint keys exist with non-empty values in all 19 locales', () => {
  const dict = loadAssembledDict();
  const missing = [];
  for (const key of ALL_KEYS) {
    const row = dict[key];
    if (!row || row['@alias']) {
      missing.push(`${key}: key absent`);
      continue;
    }
    for (const lang of I18N_LANGS) {
      if (!row[lang] || !String(row[lang]).trim()) missing.push(`${key}: empty in ${lang}`);
    }
  }
  assert.deepEqual(missing, [], 'missing/empty hint translations:\n  ' + missing.join('\n  '));
});
