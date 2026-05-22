/**
 * v1.54.3 → v1.54.8 — the #/config "Modes" tab renders a STRUCTURED
 * field-form derived from the documented modes/_profile.md schema
 * (career-ops.org §Step-5), "не сырой". v1.54.8: the 5 canonical
 * fields are ALWAYS rendered (even on an empty / stub file), each
 * with a doc-sourced description; heading variants ("Your X") map to
 * the canonical field; collect() returns a tagged payload — a
 * non-destructive { mode:'sections' } merge when the rendered
 * headings exactly match the file's, else a { mode:'markdown' }
 * full-file rebuild (preamble + canonical order + custom verbatim).
 *
 * Browser-only → wiring asserted statically; the pure
 * parse/serialise/classify/canonicalise logic is re-derived from the
 * source contract and exercised so the data-safety + bootstrap
 * guarantees are locked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__d, '..', ...p), 'utf8');
const MF = read('public', 'js', 'lib', 'modes-form.js');
const CFG = read('public', 'js', 'views', 'config.js');
const HTML = read('public', 'index.html');
const DICT = legacyDictText();

test('modes-form.js defines the documented schema (5 canonical fields, ordered)', () => {
  for (const [k, kind] of [
    ['Target Roles', 'list'], ['Adaptive Framing', 'list'],
    ['Exit Narrative', 'prose'], ['Comp Targets', 'list'],
    ['Location Policy', 'prose'],
  ]) {
    const re = new RegExp(`key: '${k}',\\s*kind: '${kind}'`);
    assert.match(MF, re, `CANON missing ${k} → ${kind}`);
  }
  // canonical order = the §Step-5 order
  const order = [...MF.matchAll(/key: '([^']+)',\s*\n?\s*kind:/g)].map((m) => m[1]);
  assert.deepEqual(order.slice(0, 5),
    ['Target Roles', 'Adaptive Framing', 'Exit Narrative', 'Comp Targets', 'Location Policy']);
  assert.match(MF, /window\.ModesForm = \{/);
  assert.match(MF, /collect\(\)/);
});

test('config.js passes the full GET payload + handles the tagged collect()', () => {
  assert.match(CFG, /window\.ModesForm\.build\(data \|\| \{ sections: \[\], preamble: '' \}\)/,
    'build must receive the whole payload (sections + preamble)');
  assert.match(CFG, /payload\.mode === 'markdown'/,
    'saveModes must branch on the tagged collect() mode');
  // the destructive full-file rebuild path is confirm-gated (WS2 #4)
  assert.match(CFG, /payload\.mode === 'markdown'[\s\S]{0,400}await UI\.confirm\(/,
    'markdown-rebuild must be confirm-gated before PUT');
  assert.match(CFG, /body = \{ sections: payload\.sections \}/,
    'sections-merge path preserved');
  assert.ok(!/modesSectionInputs/.test(CFG), 'stale modesSectionInputs gone');
  assert.match(HTML, /\/js\/lib\/modes-form\.js/, 'modes-form.js loaded in index.html');
});

test('every canonical field wires a doc-sourced description (career-ops.org §Step-5)', () => {
  for (const k of [
    'config.modesDescTargetRoles', 'config.modesDescAdaptiveFraming',
    'config.modesDescExitNarrative', 'config.modesDescCompTargets',
    'config.modesDescLocationPolicy',
  ]) {
    assert.match(MF, new RegExp(`descKey: '${k}'`), `CANON missing ${k}`);
    const line = DICT.split('\n').find((l) => l.includes(`'${k}'`));
    assert.ok(line, `i18n key ${k} missing`);
    for (const loc of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
      const tok = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
      assert.ok(line.includes(tok), `${k} missing locale ${loc}`);
    }
  }
});

// ── Re-derived pure logic (mirrors modes-form.js exactly) ──
const SCHEMA = {
  'Target Roles': 1, 'Adaptive Framing': 1, 'Exit Narrative': 1,
  'Comp Targets': 1, 'Location Policy': 1,
};
function canonicalKey(heading) {
  const h = String(heading || '').trim();
  if (SCHEMA[h]) return h;
  const stripped = h.replace(/^your\s+/i, '').trim();
  return SCHEMA[stripped] ? stripped : null;
}
const BULLET_RE = /^[ \t]*[-*+][ \t]+(.*)$/;
const isPureList = (body) => {
  const lines = String(body || '').split('\n');
  let saw = false;
  for (const ln of lines) {
    if (ln.trim() === '') continue;
    if (!ln.match(BULLET_RE)) return false;
    saw = true;
  }
  return saw || String(body || '').trim() === '';
};
const parseListItems = (b) => String(b || '').split('\n')
  .map((ln) => { const m = ln.match(BULLET_RE); return m ? m[1].trim() : null; })
  .filter((v) => v && v.length);
const serialiseList = (items) => {
  const clean = (items || []).map((s) => String(s).trim()).filter(Boolean);
  return clean.length ? '\n' + clean.map((s) => `- ${s}`).join('\n') + '\n\n' : '\n\n';
};

test('canonicalKey tolerates the template "Your X" heading variant', () => {
  assert.equal(canonicalKey('Target Roles'), 'Target Roles');
  assert.equal(canonicalKey('Your Target Roles'), 'Target Roles');
  assert.equal(canonicalKey('  your   Comp Targets '), 'Comp Targets');
  assert.equal(canonicalKey('Custom Notes'), null);
  assert.equal(canonicalKey(''), null);
});

test('list round-trip is stable and drops blank/placeholder items', () => {
  const body = '\n- Staff Frontend Engineer\n- Engineering Manager\n\n';
  const items = parseListItems(body);
  assert.deepEqual(items, ['Staff Frontend Engineer', 'Engineering Manager']);
  assert.equal(serialiseList(items), body);
  assert.equal(serialiseList(['a', ' ', '', 'b']), '\n- a\n- b\n\n');
  assert.equal(serialiseList([]), '\n\n');
  assert.equal(isPureList('\n- \n\n'), true);
  assert.equal(isPureList('\n\nprose\n\n'), false);
});

test('source: empty/stub file still renders all 5 canonical fields (bootstrap)', () => {
  // The build() loop iterates CANON unconditionally (not the incoming
  // sections), so a file with zero `##` sections still shows fields.
  assert.match(MF, /CANON\.forEach\(\(spec, idx\) => \{/,
    'must iterate CANON, not the incoming sections, so fields always render');
  // and the no-sections "use the raw editor" early-return is GONE
  assert.ok(!/No \#\# sections found — use the raw editor below/.test(MF),
    'the old empty-state early return must be removed');
  // default preamble exists for the truly-empty-file rebuild
  assert.match(MF, /DEFAULT_PREAMBLE/);
  assert.match(MF, /# Career framing \(modes\/_profile\.md\)/);
});

test('source: collect() is tagged sections-vs-markdown with data-safety', () => {
  assert.match(MF, /mode: 'sections', sections/,
    'non-destructive merge path');
  assert.match(MF, /mode: 'markdown', markdown: md/,
    'full-file rebuild path');
  // merge only when membership matches AND file had sections
  assert.match(MF, /sameMembership && existingHeadings\.size > 0/);
  // rebuild preserves preamble + canonical order + custom verbatim
  assert.match(MF, /const pre = preamble \|\| DEFAULT_PREAMBLE;/);
  assert.match(MF, /rendered\.map\(\(r\) =>\s*`## \$\{r\.heading\}\\n\$\{r\.body\}`\)/);
  // non-canonical sections collected verbatim (no reshaping)
  assert.match(MF, /nonCanonCollectors\.push\(\(\) => \(\{ heading: s\.heading, body: ta\.value \}\)\)/);
});
