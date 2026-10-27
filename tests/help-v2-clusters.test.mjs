/**
 * CAR-135 follow-up guard — the v2 UI clusters must reach EVERY help bundle.
 *
 * The CAR-135 rewrite of `docs/help/en.md` documented the UI v2 clusters:
 * §7 scan v2 chrome (`scan.v2.*` chips, quick view, density, per-row
 * actions), §8 pipeline grouped view + bulk discard + lossless undo
 * (`pipe.viewGrouped` …), §10 reports v2 (`rep2.*` cards/table/filters/
 * histogram), and §11 tracker kanban (`track.kanban*`). The first fan-out
 * reached most locales, but de/pl/tr/uk shipped truncated waves that
 * silently skipped some of these clusters — headings still matched, so
 * every H2/H3-count gate stayed green while whole features vanished from
 * four help guides.
 *
 * A heading-count gate cannot see this: the skeleton (33 H2 / 125 H3) is
 * intact in every file. The drift lives INSIDE sections, as missing
 * i18n-key citations. This gate greps the key families per numbered
 * section with generous floors, so a locale that loses a cluster (or a
 * future fan-out that trims one) goes red instead of shipping quietly.
 *
 * Floors are deliberately well below the healthy counts (~20 keys for
 * scan.v2/rep2 in a complete bundle): the gate asserts PRESENCE of a
 * cluster, not byte-identical prose — translations rephrase freely.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const HELP_LOCALES = ['en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW',
  'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];

/** Split a help bundle into numbered-H2 sections; returns `## N.` … `## next.` */
function numberedSection(text, n, next) {
  const start = text.search(new RegExp(`^## ${n}\\. `, 'm'));
  const end = text.search(new RegExp(`^## ${next}\\. `, 'm'));
  if (start === -1 || end === -1) return null;
  return text.slice(start, end);
}

const count = (haystack, needle) => (haystack.match(new RegExp(needle, 'g')) || []).length;

// Per-cluster floors: (section number, next section, key, minimum occurrences).
const CLUSTERS = [
  { section: 7, next: 8, key: 'scan\\.v2\\.', min: 3, label: 'scan v2 chrome (chips/quick view/density/row actions)' },
  { section: 8, next: 9, key: 'pipe\\.viewGrouped', min: 1, label: 'pipeline grouped view + bulk discard + undo' },
  { section: 10, next: 11, key: 'rep2\\.', min: 16, label: 'reports v2 (cards/table/filters/sort/histogram)' },
  { section: 11, next: 12, key: 'track\\.kanban', min: 1, label: 'tracker kanban view' },
];

test('every help bundle carries the four v2 UI clusters in §7/§8/§10/§11', () => {
  const failures = [];
  for (const lang of HELP_LOCALES) {
    const path = resolve(ROOT, 'docs', 'help', `${lang}.md`);
    const text = readFileSync(path, 'utf8');
    for (const { section, next, key, min, label } of CLUSTERS) {
      const body = numberedSection(text, section, next);
      assert.ok(body, `docs/help/${lang}.md: cannot locate §${section} (headings must stay numbered)`);
      const n = count(body, key);
      if (n < min) {
        failures.push(`docs/help/${lang}.md §${section} has ${n} × \`${key.replace(/\\\\/g, '\\')}\` (needs ≥ ${min}) — ${label} missing`);
      }
    }
  }
  assert.deepEqual(failures, [], `truncated v2 clusters:\n  ${failures.join('\n  ')}`);
});
