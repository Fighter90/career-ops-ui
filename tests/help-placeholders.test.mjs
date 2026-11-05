/**
 * CAR-107 (P2.1) — help-bundle UI-label placeholder gate.
 *
 * The docs/help bundles must not hard-code EN UI labels ('▶ Generate prompt',
 * 'API keys & runtime', …): a translator pasting the EN label into localized
 * prose drifts from the app the moment the label changes, and a non-EN
 * reader gets an English button name mid-sentence. The bundles now carry
 * `{{t:key}}` placeholders instead; each consumer resolves them for its own
 * audience:
 *
 *   • the app (#/help) — public/js/views/help.js substitutes the ACTIVE
 *     locale's label through I18n.t before UI.md();
 *   • cvstart.org — site/scripts/sync-assets.mjs substitutes at sync time
 *     (site i18n value when one exists, EN dict value otherwise);
 *   • server-side readers — server/lib/help-markdown.mjs ::
 *     substituteHelpPlaceholdersEn() gives the docs-assistant corpus the EN
 *     value (the assistant answers in the request language; a raw
 *     placeholder in an excerpt would leak verbatim into its answer).
 *
 * Gates:
 *   1. every {{t:key}} placeholder in every bundle resolves to an existing
 *      key with an EN value in the assembled dictionary;
 *   2. none of the known EN label strings appears in a non-EN bundle;
 *   3. the server-side EN substitution actually resolves every placeholder
 *      (and keeps an unknown key visible rather than dropping it).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAssembledDict } from './helpers/i18n-vm.mjs';
import { substituteHelpPlaceholdersEn, substituteHelpPlaceholders } from '../server/lib/help-markdown.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const HELP_DIR = resolve(ROOT, 'docs', 'help');

// Label → dict key. EN value of the key MUST equal the label (asserted in
// test 1's sibling loop) so a future rewording of the dict value fails here
// and forces a re-sweep instead of silently going stale.
const EN_LABELS = [
  ['▶ Generate prompt', 'deep.run'],
  ['API keys & runtime', 'config.tabApi'],
  ['✨ AI fill assistant', 'twoPager.aiFill'],
  ['No response / ghosted', 'track.outcome.ghosted'],
  ['Advanced to interview', 'track.outcome.interview'],
  ['Applications by status', 'track.kanbanBoardAria'],
  ['Show company logos in the scan table', 'appear.logos'],
  ['Without a location', 'map.noLocation'],
  ['👁 Preview & export', 'twoPager.preview'],
  ['Hide already evaluated', 'pipe.hideTracked'],
  ['Select all shown', 'pipe.selectAllShown'],
  ['Superseded — a newer run was requested', 'auto.superseded'],
  ['The CareerOps Manifesto', 'footer.manifesto'],
];

const HELP_FILES = readdirSync(HELP_DIR).filter((f) => f.endsWith('.md')).sort();
const PLACEHOLDER_RE = /\{\{t:([A-Za-z0-9_.-]+)\}\}/g;

function helpText(file) {
  return readFileSync(resolve(HELP_DIR, file), 'utf8');
}

test('every help bundle carries the placeholder mechanism (all 13 swept keys in use)', () => {
  assert.equal(HELP_FILES.length, 19, `expected 19 help bundles, found ${HELP_FILES.length}`);
  const used = new Set();
  for (const f of HELP_FILES) {
    for (const m of helpText(f).matchAll(PLACEHOLDER_RE)) used.add(m[1]);
  }
  for (const [, key] of EN_LABELS) {
    assert.ok(used.has(key), `no bundle references {{t:${key}}} — the sweep regressed`);
  }
});

test('every {{t:key}} placeholder in every bundle resolves to a dict key with the matching EN value', () => {
  const dict = loadAssembledDict();
  for (const f of HELP_FILES) {
    const keys = [...new Set([...helpText(f).matchAll(PLACEHOLDER_RE)].map((m) => m[1]))];
    for (const key of keys) {
      const entry = dict[key];
      assert.ok(entry && typeof entry === 'object', `${f}: {{t:${key}}} is not an assembled-dict key`);
      const en = entry.en;
      assert.equal(typeof en, 'string', `${f}: {{t:${key}}} has no EN value`);
      assert.ok(en.length > 0, `${f}: {{t:${key}}} has an empty EN value`);
      // The EN value must BE the label this key was swept for — otherwise
      // the label list above has drifted from the dict and gate 2 checks a
      // string the app no longer shows.
      const swept = EN_LABELS.find(([, k]) => k === key);
      if (swept) assert.equal(en, swept[0], `dict EN value of ${key} drifted from the swept label`);
    }
  }
});

test('no known EN UI label appears in a non-EN help bundle', () => {
  for (const f of HELP_FILES) {
    if (f === 'en.md') continue; // EN bundle: the placeholder itself resolves to the EN label
    const text = helpText(f);
    for (const [label, key] of EN_LABELS) {
      assert.ok(!text.includes(label),
        `${f}: EN UI label for ${key} leaked back into the prose — use {{t:${key}}} instead`);
    }
  }
});

test('server-side EN substitution (docs-assistant corpus) resolves every placeholder', () => {
  for (const f of HELP_FILES) {
    const resolved = substituteHelpPlaceholdersEn(helpText(f));
    assert.ok(!resolved.includes('{{t:'), `${f}: raw placeholder survived EN substitution`);
  }
  // Unit behavior: known key → EN label; unknown key → raw placeholder kept
  // visible (never silently dropped); empty input → empty output.
  assert.equal(substituteHelpPlaceholdersEn('Click **{{t:deep.run}}** now.'), 'Click **▶ Generate prompt** now.');
  assert.equal(substituteHelpPlaceholdersEn('raw {{t:no.such.key}} stays'), 'raw {{t:no.such.key}} stays');
  assert.equal(substituteHelpPlaceholdersEn(''), '');
});

test('the app and site render paths apply the substitution (source contracts)', () => {
  // App: #/help must resolve placeholders through I18n.t BEFORE UI.md().
  const helpView = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'help.js'), 'utf8');
  assert.ok(helpView.includes('{{t:'), 'help.js lost the {{t: substitution marker');
  assert.ok(/I18n\.t\(key,\s*raw\)/.test(helpView), 'help.js must fall back to the raw placeholder via I18n.t(key, raw)');
  assert.ok(helpView.includes('UI.md(markdown)'), 'help.js must substitute BEFORE UI.md()');
  // Site: sync-assets must resolve placeholders while copying the guides.
  const syncAssets = readFileSync(resolve(ROOT, 'site', 'scripts', 'sync-assets.mjs'), 'utf8');
  assert.ok(syncAssets.includes('resolveHelpPlaceholders(md'), 'sync-assets must resolve placeholders in the help-copy loop');
  assert.ok(syncAssets.includes('i18n-dict.en.js'), 'sync-assets EN fallback must read the app EN dict');
});

test('generic resolver keeps unknown keys and substitutes known ones', () => {
  const out = substituteHelpPlaceholders('a {{t:pipe.hideTracked}} b {{t:missing.key}} c', (k) =>
    k === 'pipe.hideTracked' ? 'Hidden' : null);
  assert.equal(out, 'a Hidden b {{t:missing.key}} c');
});
