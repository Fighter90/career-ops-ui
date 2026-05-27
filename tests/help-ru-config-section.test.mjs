/**
 * v1.29.1 — every locale's help-bundle §5 carries the detailed
 * "Configuring Russian portals — step by step" subsection added in v1.29.1.
 *
 * The user-facing config flow was previously buried in `qa/REGRESSION-*.md`
 * and the `§17 How to add a portal` developer guide. v1.29.1 inserts an
 * end-user guide WITHIN §5 (Portals & sources), so it shows up in the
 * `#/help` page in every locale.
 *
 * Regression contract: every help-bundle (8 locales) must contain:
 *   - the 5-source `sources: [...]` example;
 *   - the negative-list collision example;
 *   - the disable-one-source example;
 *   - the verify-via-Scan instruction.
 * The H3 title is localized per language; we don't pin its exact text,
 * we just assert the universal code-block markers below.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOCALES = ['en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr'];

function readHelp(lang) {
  return readFileSync(resolve(ROOT, 'docs', 'help', `${lang}.md`), 'utf8');
}

test('every help-bundle §5 carries the 5-source YAML example (v1.29.1)', () => {
  for (const lang of LOCALES) {
    const text = readHelp(lang);
    assert.ok(
      text.includes('sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]'),
      `${lang}.md missing the 5-source YAML example`,
    );
  }
});

test('every help-bundle §5 carries the negative-list collision example', () => {
  // The fix block shows the YAML pattern: title_filter.negative WITHOUT "php"
  // alongside russian_portals.queries WITH "Senior PHP". We assert the
  // canonical fixed snippet appears.
  for (const lang of LOCALES) {
    const text = readHelp(lang);
    assert.ok(
      text.includes('positive: [backend, senior, lead, php, go, golang, python]'),
      `${lang}.md missing the negative-list fix YAML example`,
    );
  }
});

test('every help-bundle §5 explains how to disable one source', () => {
  for (const lang of LOCALES) {
    const text = readHelp(lang);
    assert.ok(
      text.includes('sources: ["hh", "habr", "trudvsem"]'),
      `${lang}.md missing the disable-one-source YAML example`,
    );
  }
});

test('every help-bundle §5 names the verify-via-Scan flow', () => {
  // The verify block names the per-source result table the SSE log shows.
  // We assert on the canonical 5 adapter labels appearing close together.
  for (const lang of LOCALES) {
    const text = readHelp(lang);
    for (const label of ['hh.ru', 'habr', 'trudvsem', 'getmatch', 'geekjob']) {
      assert.ok(
        text.includes(label),
        `${lang}.md verify-section missing label ${label}`,
      );
    }
  }
});

test('every help-bundle §5 has a 5-row source-inventory table', () => {
  // The table has rows for: hh, habr, trudvsem, getmatch, geekjob. We
  // assert on the table-cell pattern `| \`<key>\` |` for each.
  for (const lang of LOCALES) {
    const text = readHelp(lang);
    for (const key of ['hh', 'habr', 'trudvsem', 'getmatch', 'geekjob']) {
      assert.ok(
        text.includes(`| \`${key}\` |`),
        `${lang}.md §5 source-inventory table missing row for "${key}"`,
      );
    }
  }
});

test('every help-bundle §5 references HH_USER_AGENT for the hh.ru gate', () => {
  // The hh.ru row in the inventory table says "optional HH_USER_AGENT"
  // (localized prose) — assert on the env-var name literal.
  for (const lang of LOCALES) {
    const text = readHelp(lang);
    assert.ok(
      text.includes('HH_USER_AGENT'),
      `${lang}.md must reference HH_USER_AGENT in the §5 RU-config guide`,
    );
  }
});

test('every help-bundle keeps the 19-H2 parity contract after v1.29.1 edit', () => {
  // Belt-and-suspenders: the v1.29.1 expansion is a ### subsection of
  // §5 — H2 count stays at 19 (v1.60.0 added §19 Localizing the app). If a future change accidentally
  // promotes the H3 to H2 we want it to fail here.
  let baseline = null;
  for (const lang of LOCALES) {
    const text = readHelp(lang);
    const h2 = text.split('\n').filter((l) => l.startsWith('## ')).length;
    if (baseline === null) baseline = h2;
    assert.equal(h2, baseline, `${lang}.md has ${h2} H2 sections, expected ${baseline}`);
  }
  assert.equal(baseline, 19, `expected 19 H2 sections, got ${baseline}`);
});

test('WS10: every help-bundle has identical H3 parity (en + 7 locales)', () => {
  // The CI parity gate historically checked only H2, so en.md drifted
  // to 70 H3 while the 7 locales stayed at 68 (§17 missed "Reference
  // adapters" + "Common pitfalls"). WS10 (v1.54.0) closed that and this
  // locks H3 parity so a future en-only ### addition can't silently
  // diverge the localized bundles again.
  let baseline = null;
  for (const lang of LOCALES) {
    const h3 = readHelp(lang).split('\n').filter((l) => l.startsWith('### ')).length;
    if (baseline === null) baseline = h3;
    assert.equal(h3, baseline, `${lang}.md has ${h3} H3 subsections, expected ${baseline}`);
  }
  assert.equal(baseline, 75, `expected 75 H3 subsections per bundle, got ${baseline}`); // v1.58.35 §18 added 3 H3s; v1.62.x §5 added "rss (RSS / Atom boards)"; v1.64.0 §7 added "Scanning hh.ru from outside Russia"
});
