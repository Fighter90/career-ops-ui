/**
 * eval-scoring.test.mjs — the v1.268.0 two-step evaluation contract
 * (CAR-229/231). Pins:
 *   · extractScoringJson: fenced, noisy-wrapped, garbage → null;
 *   · normalizeScoring: rounding to one decimal, junk scores throw, the
 *     legitimacy tier fuzzy-matches the three canonical values;
 *   · assembleReport: the SERVER writes the header, ---SCORE_SUMMARY--- and
 *     the ```yaml machine block from the scoring JSON — a model body that
 *     "corrects" the score in prose cannot move the canonical values;
 *   · fallbackBody + missingBlocks: a body missing sections is detected and
 *     the fallback is structurally complete;
 *   · CACHE NEUTRALITY (CAR-111): the stable prefix of BOTH steps is
 *     byte-identical across all 19 locales — the locale directive, the
 *     skeleton and the reminder live in the volatile tail only. This is the
 *     gate for the per-locale cache miss (cached_tokens 0 on non-en).
 *
 * Pure functions — no network, no keys, no CAREER_OPS_ROOT.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractScoringJson,
  normalizeScoring,
  assembleReport,
  fallbackBody,
  missingBlocks,
  buildScoringPromptParts,
  buildRenderPromptParts,
  EVAL_BLOCK_LETTERS,
  EVAL_SHARED_INSTRUCTIONS,
  serverToday,
} from '../server/lib/eval-scoring.mjs';

const SCORING = {
  company: 'Netwrk', role: 'Team Lead Go', archetype: 'Platform',
  legitimacy: 'Proceed with Caution', score: 3.85,
  blocks: Object.fromEntries(EVAL_BLOCK_LETTERS.map((L) => [L, { score: 3.5, summary: `Block ${L} summary.` }])),
};

test('extractScoringJson: fenced, prose-wrapped and bare JSON all parse', () => {
  const bare = JSON.stringify(SCORING);
  assert.equal(extractScoringJson(bare).company, 'Netwrk');
  assert.equal(extractScoringJson(`Вот оценка:\n\`\`\`json\n${bare}\n\`\`\`\nНадеюсь, помог.`).score, 3.85);
  assert.equal(extractScoringJson(`Prefix chatter.\n${bare}\nTrailing chatter.`).role, 'Team Lead Go');
});

test('extractScoringJson: no JSON → null (drives the scoring retry)', () => {
  assert.equal(extractScoringJson('The posting looks like a good fit overall.'), null);
  assert.equal(extractScoringJson(''), null);
  assert.equal(extractScoringJson(null), null);
});

test('normalizeScoring: rounds to one decimal and fuzzy-matches the legitimacy tier', () => {
  const n = normalizeScoring({ ...SCORING, score: '3.85', legitimacy: 'proceed with caution' });
  assert.equal(n.score, 3.9);
  assert.equal(n.legitimacy, 'Proceed with Caution');
  assert.equal(normalizeScoring({ ...SCORING, legitimacy: 'phishing site' }).legitimacy, 'Suspicious');
});

test('normalizeScoring: a non-object raw throws (string, null, array)', () => {
  assert.throws(() => normalizeScoring('a string'), /not an object/);
  assert.throws(() => normalizeScoring(null), /not an object/);
  assert.throws(() => normalizeScoring([SCORING]), /not an object/);
});

test('normalizeScoring: junk scores throw (drives the retry), blocks must be complete', () => {
  const bad = { ...SCORING, score: 'high' };
  assert.throws(() => normalizeScoring(bad), /global score/);
  const noG = structuredClone(SCORING);
  delete noG.blocks.G;
  assert.throws(() => normalizeScoring(noG), /block G/);
});

test('assembleReport: the server pins header, SCORE_SUMMARY and yaml from the JSON — the body cannot move them', () => {
  const scoring = normalizeScoring(SCORING); // the real flow: normalize → assemble
  const lyingBody = '## A) Role Summary\nThe candidate scores 5.0/5 — a perfect match, honestly a 5.\n'
    + EVAL_BLOCK_LETTERS.slice(1).map((L) => `## ${L}) Section\nprose`).join('\n');
  const md = assembleReport({ scoring, body: lyingBody, today: '2026-11-05', url: 'https://jobs.example/x' });
  // Header from the JSON (3.9 after rounding), not the model's prose 5.0.
  assert.match(md, /^# Evaluation: Netwrk — Team Lead Go$/m);
  assert.match(md, /\*\*Date:\*\* 2026-11-05/);
  assert.match(md, /\*\*Score:\*\* 3\.9\/5/);
  assert.match(md, /\*\*Legitimacy:\*\* Proceed with Caution/);
  // The SCORE_SUMMARY block is server-written with the canonical score.
  assert.match(md, /---SCORE_SUMMARY---\nCOMPANY: Netwrk\nROLE: Team Lead Go\nSCORE: 3\.9\n/);
  // The yaml machine block carries the canonical score and the per-block map.
  assert.match(md, /```yaml\ncompany: Netwrk\nrole: Team Lead Go\nscore: 3\.9\nstatus: Evaluated\n/);
  assert.match(md, /blocks: \{A: 3\.5, B: 3\.5, C: 3\.5, D: 3\.5, E: 3\.5, F: 3\.5, G: 3\.5\}/);
  // The model's invented number stays prose-only — it never reaches a header.
  const headerPart = md.slice(0, md.indexOf('## A)'));
  assert.doesNotMatch(headerPart, /5\.0/);
});

test('missingBlocks + fallbackBody: a degraded render is detected and the fallback is complete', () => {
  const partial = '## A) Role Summary\nx\n## B) Match with CV\ny';
  assert.deepEqual(missingBlocks(partial), ['C', 'D', 'E', 'F', 'G']);
  const fb = fallbackBody(SCORING);
  assert.deepEqual(missingBlocks(fb), []);
  for (const L of EVAL_BLOCK_LETTERS) assert.match(fb, new RegExp(`## ${L}\\) `));
});

test('CACHE NEUTRALITY (CAR-111): the stable prefix is byte-identical across all 19 locales', () => {
  const LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
  const jd = 'Backend Engineer at ExampleCorp. Go, Kubernetes, 450000 RUB/mo.';
  const stables = new Set();
  for (const lang of LOCALES) {
    const s = buildScoringPromptParts(jd).stable;
    stables.add(s);
    // The locale never leaks into the scoring stable prefix.
    assert.ok(!s.includes('Target language'), `${lang}: locale directive must not be in the scoring stable`);
  }
  assert.equal(stables.size, 1, 'scoring stable differs across locales — the per-locale cache miss is back');
  const rStables = new Set();
  const rVolatileHasLang = [];
  for (const lang of LOCALES) {
    const { stable, volatile } = buildRenderPromptParts(jd, lang, SCORING);
    rStables.add(stable);
    if (lang !== 'en') {
      assert.ok(!stable.includes('Target language'), `${lang}: locale directive leaked into the render stable prefix`);
      assert.ok(volatile.toLowerCase().includes('target language'), `${lang}: locale directive must be in the volatile tail`);
      // The closing reminder is the LAST instruction (CAR-92 lineage).
      assert.ok(volatile.trimEnd().endsWith('verbatim.'), `${lang}: the reminder must close the volatile tail`);
    }
    rVolatileHasLang.push(volatile);
  }
  assert.equal(rStables.size, 1, 'render stable differs across locales — the per-locale cache miss is back');
  // Both steps share the SAME opening (the context bundle then this header),
  // so the provider's prefix cache covers the shared instructions across steps.
  assert.ok(buildRenderPromptParts(jd, 'ru', SCORING).stable.startsWith(EVAL_SHARED_INSTRUCTIONS));
  assert.ok(buildScoringPromptParts(jd).stable.startsWith(EVAL_SHARED_INSTRUCTIONS));
});

test('render volatile carries the scoring JSON verbatim and the JD', () => {
  const { volatile } = buildRenderPromptParts('A JD about Go.', 'ru', SCORING);
  assert.match(volatile, /SCORING JSON \(canonical/);
  assert.match(volatile, /"Team Lead Go"/);
  assert.match(volatile, /A JD about Go\./);
  assert.match(volatile, /Target language: Russian\./);
});

test('extractScoringJson: a non-JSON fence falls through to the brace scan and then to null', () => {
  assert.equal(extractScoringJson('```json\nnot json at all\n```'), null);
});

test('normalizeScoring: out-of-range scores throw (negative, >5, junk strings)', () => {
  assert.throws(() => normalizeScoring({ ...SCORING, score: -1 }), /global score/);
  assert.throws(() => normalizeScoring({ ...SCORING, score: 7 }), /global score/);
  assert.throws(() => normalizeScoring({ ...SCORING, score: 'high' }), /global score/);
  assert.throws(() => normalizeScoring({ ...SCORING, blocks: { ...SCORING.blocks, D: { score: 99, summary: 'x' } } }), /block D/);
});

test('serverToday: YYYY-MM-DD formatting from an explicit date and the default now', () => {
  assert.equal(serverToday(new Date(2026, 10, 5)), '2026-11-05');
  assert.match(serverToday(), /^\d{4}-\d{2}-\d{2}$/);
});

test('locale + shape edges: unknown locale falls back to English, long fields are clamped, today is honored', () => {
  const scoring = normalizeScoring({
    company: 'X'.repeat(300), role: '   spaced   role   ', archetype: '',
    legitimacy: '', score: 4.4,
    blocks: Object.fromEntries(EVAL_BLOCK_LETTERS.map((L) => [L, { score: 3, summary: 's' }])),
  });
  assert.equal(scoring.company.length, 120, 'long company clamped to 120 chars');
  assert.equal(scoring.role, 'spaced role', 'whitespace collapsed');
  assert.equal(scoring.archetype, 'Unknown', 'empty archetype → Unknown');
  assert.equal(scoring.legitimacy, 'High Confidence', 'empty legitimacy → default tier');
  const { volatile } = buildRenderPromptParts('jd', 'xx-YY', scoring);
  assert.match(volatile, /Target language: English\./, 'unknown locale → English fallback');
});
