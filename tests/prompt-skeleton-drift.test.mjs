/**
 * CAR-148 — drift gate: the evaluation prompt must teach ONE A–G map.
 *
 * The parent's modes/oferta.md is the single source of truth for the block
 * order: A Role Summary · B Match with CV · C Level and Strategy · D Comp and
 * Demand · E Customization Plan · F Interview Plan · G Posting Legitimacy —
 * G is the LAST lettered block and the verdict is NOT one of A–G (it is the
 * report's `## Verdict (lead)` section). Before CAR-148 the prompt carried
 * three mutually inconsistent maps (the stable list put the verdict at F, the
 * non-EN heading skeleton at G, and the language reminder's example used a
 * word-first heading shape), and a model reconciling them sometimes dropped
 * or merged the final block — the prod «missing Block G» ru failures.
 *
 * The parent repo is not present in CI, so the fixture below snapshots the
 * parent's real block headings; a parent-sync that reorders oferta.md must
 * move BOTH the parent file and this fixture in the same change.
 *
 * CI-isolated: temp CAREER_OPS_ROOT, dynamic import in before(), no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Verbatim block headings from the parent's modes/oferta.md.
const OFERTA_FIXTURE = [
  '# Oferta evaluation mode (fixture)',
  '',
  '## Block A — Role Summary',
  'Body.',
  '',
  '## Block B — Match with CV',
  'Body.',
  '',
  '## Block C — Level and Strategy',
  'Body.',
  '',
  '## Block D — Comp and Demand',
  'Body.',
  '',
  '## Block E — Customization Plan',
  'Body.',
  '',
  '## Block F — Interview Plan',
  'Body.',
  '',
  '## Block G — Posting Legitimacy',
  'Body.',
  '',
].join('\n');

const TINY_JD = 'Engineer at Example Corp.';

const BLOCK_RE = /^## Block ([A-G]) — (.+)$/gm;
const SKEL_RE = /^## ([A-G])\) (.+)$/gm;

let P;
let dir;

function fixtureBlocks() {
  const src = OFERTA_FIXTURE;
  const blocks = [];
  for (const m of src.matchAll(BLOCK_RE)) blocks.push({ letter: m[1], title: m[2].trim() });
  return blocks;
}

function skeletonLines(prompt) {
  const lines = [];
  for (const m of prompt.matchAll(SKEL_RE)) lines.push({ letter: m[1], title: m[2].trim() });
  return lines;
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'car148-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: "T"\n');
  writeFileSync(resolve(dir, 'modes', '_shared.md'), '# shared\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), OFERTA_FIXTURE);
  process.env.CAREER_OPS_ROOT = dir;
  P = await import('../server/lib/prompts.mjs');
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

// Every locale that gets the heading skeleton (any non-EN with a known name).
const SKELETON_LOCALES = ['ru', 'de', 'ta', 'zh-TW'];

for (const lang of SKELETON_LOCALES) {
  test(`[${lang}] skeleton headings follow oferta.md's block order, G = Posting Legitimacy last`, () => {
    const blocks = fixtureBlocks();
    const prompt = P.buildEvaluationPrompt(TINY_JD, lang);
    const skel = skeletonLines(prompt);

    assert.equal(skel.length, 7, `expected exactly 7 skeleton headings, got ${skel.length}`);
    assert.deepEqual(
      skel.map((h) => h.letter),
      blocks.map((b) => b.letter),
      'skeleton letters must match oferta.md block letters in order',
    );
    assert.deepEqual(
      skel.map((h) => h.title.toLowerCase()),
      blocks.map((b) => b.title.toLowerCase()),
      'skeleton titles must match oferta.md block titles in order (case-insensitive)',
    );
    assert.equal(skel[6].letter, 'G', 'the last skeleton heading is G');
    assert.equal(
      skel[6].title.toLowerCase(),
      'posting legitimacy',
      'CAR-148: G — Posting Legitimacy is the LAST block (not the verdict)',
    );
  });

  test(`[${lang}] the stable instruction list names oferta.md's blocks in the same order`, () => {
    const { stable } = P.buildEvaluationPromptParts(TINY_JD, lang);
    const m = stable.match(/per modes\/oferta\.md \(([^)]+)\)/);
    assert.ok(m, 'the stable part names the A-G blocks after modes/oferta.md');
    const titles = m[1].split(',').map((s) => s.trim().toLowerCase());
    assert.deepEqual(
      titles,
      fixtureBlocks().map((b) => b.title.toLowerCase()),
      'the stable list must carry the same titles in the same order as oferta.md',
    );
  });

  test(`[${lang}] the closing reminder's example uses the skeleton's letter-first shape`, () => {
    const reminder = P.buildLanguageReminder(lang);
    assert.match(
      reminder,
      /`## A\) <translated title>`/,
      'the example must be letter-first (`## A) …`), matching the skeleton the model is told to use',
    );
  });
}

test('EN gets no heading skeleton (the skeleton is a non-EN aid only)', () => {
  const prompt = P.buildEvaluationPrompt(TINY_JD, 'en');
  assert.equal(skeletonLines(prompt).length, 0, 'no `## X)` skeleton headings in the EN prompt');
});
