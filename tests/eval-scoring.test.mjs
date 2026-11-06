/**
 * eval-scoring.test.mjs — the v1.268.1 DETERMINISTIC two-step evaluation
 * contract (CAR-239, on top of CAR-229/231). Pins:
 *   · extractScoringJson: fenced, noisy-wrapped, garbage → null;
 *   · normalizeScoring: INTEGER 1–5 sub-scores only — fractional or
 *     out-of-range sub-scores throw (→ scoring retry → bounded error);
 *     the model's global "score" field is IGNORED and dropped; the final
 *     score is computed SERVER-SIDE from the sub-scores by ONE rule
 *     (weighted mean, one decimal, half up);
 *   · assembleReport: the SERVER writes the header, ---SCORE_SUMMARY--- and
 *     the ```yaml machine block from the scoring JSON — a model body that
 *     "corrects" the score in prose cannot move the canonical values, and
 *     a model JSON that lies about the total cannot either;
 *   · fallbackBody + missingBlocks: a body missing sections is detected and
 *     the fallback is structurally complete;
 *   · CACHE NEUTRALITY (CAR-111): the stable prefix of BOTH steps is
 *     byte-identical across all 19 locales — the locale directive, the
 *     skeleton and the reminder live in the volatile tail only;
 *   · LOCALE-NEUTRAL SCORING INPUT (CAR-239): the full scoring prompt
 *     built for all 19 locales hashes to the SAME sha256 — the JD fence
 *     tag is sha256-derived (not Math.random), so the input is
 *     byte-reproducible and the cache key can be locale-independent.
 *
 * Pure functions — no network, no keys, no CAREER_OPS_ROOT.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  extractScoringJson,
  normalizeScoring,
  computeFinalScore,
  assembleReport,
  fallbackBody,
  missingBlocks,
  buildScoringPromptParts,
  buildRenderPromptParts,
  EVAL_BLOCK_LETTERS,
  EVAL_BLOCK_WEIGHTS,
  EVAL_SCORING_STABLE_HEADER,
  EVAL_SHARED_INSTRUCTIONS,
  JD_ARCHIVE_HEADING,
  JD_ARCHIVE_MAX_CHARS,
  serverToday,
} from '../server/lib/eval-scoring.mjs';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/** Integer sub-score fixture: every block at `n`. */
const intBlocks = (n = 4) => Object.fromEntries(EVAL_BLOCK_LETTERS.map((L) => [L, { score: n, summary: `Block ${L} summary.` }]));

const SCORING = {
  company: 'Netwrk', role: 'Team Lead Go', archetype: 'Platform',
  legitimacy: 'Proceed with Caution',
  // The model's claimed total — ignored by the new contract (CAR-239).
  score: 4.9,
  blocks: intBlocks(4),
};

test('extractScoringJson: fenced, prose-wrapped and bare JSON all parse', () => {
  const bare = JSON.stringify(SCORING);
  assert.equal(extractScoringJson(bare).company, 'Netwrk');
  // Extraction returns the RAW model JSON — the model's total (4.9) is still
  // in it here; normalizeScoring is where it gets dropped.
  assert.equal(extractScoringJson(`Вот оценка:\n\`\`\`json\n${bare}\n\`\`\`\nНадеюсь, помог.`).company, 'Netwrk');
  assert.equal(extractScoringJson(`Prefix chatter.\n${bare}\nTrailing chatter.`).role, 'Team Lead Go');
});

test('extractScoringJson: no JSON → null (drives the scoring retry)', () => {
  assert.equal(extractScoringJson('The posting looks like a good fit overall.'), null);
  assert.equal(extractScoringJson(''), null);
  assert.equal(extractScoringJson(null), null);
});

test('normalizeScoring: the final score is COMPUTED from integer sub-scores — the model total is dropped', () => {
  const n = normalizeScoring(SCORING);
  // All six scored blocks at 4 → mean 4.0. The model's own "score": 4.9 is IGNORED.
  assert.equal(n.score, 4.0);
  assert.equal(normalizeScoring({ ...SCORING, score: 0.5 }).score, 4.0, 'a lying low total is dropped too');
  assert.equal(normalizeScoring({ ...SCORING, score: 'excellent' }).score, 4.0, 'a junk total is dropped');
  assert.equal(normalizeScoring({ ...SCORING, blocks: intBlocks(5), score: 1 }).score, 5.0, 'a lying low total is dropped');
  assert.equal(normalizeScoring({ ...SCORING, legitimacy: 'proceed with caution' }).legitimacy, 'Proceed with Caution');
  assert.equal(normalizeScoring({ ...SCORING, legitimacy: 'phishing site' }).legitimacy, 'Suspicious');
});

test('computeFinalScore: the ONE rule — weighted mean (A–F ×1, G ×0), one decimal, half up', () => {
  assert.equal(EVAL_BLOCK_WEIGHTS.G, 0, 'posting legitimacy never feeds the score (modes/_shared.md)');
  const all = (n) => Object.fromEntries(EVAL_BLOCK_LETTERS.map((L) => [L, { score: n }]));
  assert.equal(computeFinalScore(all(3)), 3.0);
  assert.equal(computeFinalScore(all(5)), 5.0);
  assert.equal(computeFinalScore(all(1)), 1.0);
  // 21/6 = 3.5 exactly — the band boundary stays reachable.
  const mixed = { ...all(3) };
  mixed.A = { score: 4 }; mixed.B = { score: 4 }; mixed.C = { score: 4 };
  assert.equal(computeFinalScore(mixed), 3.5);
  // G is excluded from the mean: G=1 with A–F=5 stays 5.0.
  const gLow = { ...all(5) };
  gLow.G = { score: 1 };
  assert.equal(computeFinalScore(gLow), 5.0);
  // 25/6 = 4.1666… → 4.2 (half-up to one decimal).
  const up = { ...all(4) };
  up.A = { score: 5 };
  assert.equal(computeFinalScore(up), 4.2);
  // 19/6 = 3.1666… → 3.2.
  const down = { ...all(3) };
  down.A = { score: 4 };
  assert.equal(computeFinalScore(down), 3.2);
});

test('normalizeScoring: a non-object raw throws (string, null, array)', () => {
  assert.throws(() => normalizeScoring('a string'), /not an object/);
  assert.throws(() => normalizeScoring(null), /not an object/);
  assert.throws(() => normalizeScoring([SCORING]), /not an object/);
});

test('normalizeScoring: fractional sub-scores are rejected by the schema (drives the retry)', () => {
  const fractional = { ...SCORING, blocks: intBlocks(4), score: 3.5 };
  fractional.blocks.D = { score: 3.5, summary: 'x' };
  assert.throws(() => normalizeScoring(fractional), /block D.*integer 1–5/);
  assert.throws(() => normalizeScoring({ ...SCORING, blocks: intBlocks(3.5) }), /block A.*integer 1–5/);
});

test('normalizeScoring: out-of-range sub-scores throw (0, 6, 99, junk strings)', () => {
  assert.throws(() => normalizeScoring({ ...SCORING, blocks: intBlocks(0) }), /block A/);
  assert.throws(() => normalizeScoring({ ...SCORING, blocks: intBlocks(6) }), /block A/);
  assert.throws(() => normalizeScoring({ ...SCORING, blocks: { ...intBlocks(4), D: { score: 99, summary: 'x' } } }), /block D/);
  assert.throws(() => normalizeScoring({ ...SCORING, blocks: { ...intBlocks(4), B: { score: 'high', summary: 'x' } } }), /block B/);
});

test('normalizeScoring: junk/missing blocks throw (drives the retry), blocks must be complete', () => {
  const noG = { ...SCORING, blocks: intBlocks(4) };
  delete noG.blocks.G;
  assert.throws(() => normalizeScoring(noG), /block G/);
  // A PARTIAL map (some blocks named) is never shimmed — bad sub-scores throw.
  assert.throws(() => normalizeScoring({ ...SCORING, blocks: { A: { score: 3, summary: 'x' } } }), /block B.*integer 1–5/);
  // An EMPTY map falls to the legacy shim only when a usable flat total exists.
  assert.equal(normalizeScoring({ ...SCORING, blocks: {} }).score, 5.0, 'empty map + flat 4.9 → shim → round(4.9)=5');
  assert.throws(() => normalizeScoring({ ...SCORING, blocks: {}, score: undefined }),
    /no usable blocks and no usable flat score/, 'empty map without a usable total throws');
});

test('normalizeScoring: the LEGACY flat-shape shim — no blocks derives even integer sub-scores from the total', () => {
  // A model still answering the v1.268.0 flat shape is shimmed, not failed:
  // the total seeds every block evenly (clamped round), then the ONE rule
  // computes the final from those sub-scores.
  const legacy = normalizeScoring({ company: 'Old', role: 'Role', score: 3.6 });
  assert.equal(legacy.score, 4.0, 'round(3.6)=4 → every block 4 → server-computed 4.0');
  for (const L of EVAL_BLOCK_LETTERS) assert.equal(legacy.blocks[L].score, 4, `block ${L} shimmed to 4`);
  assert.equal(normalizeScoring({ score: 2.2 }).score, 2.0, 'round(2.2)=2 → 2.0');
  assert.equal(normalizeScoring({ score: 5 }).score, 5.0);
  assert.equal(normalizeScoring({ score: 99 }).score, 5.0, 'an out-of-range flat total clamps to the 1–5 grid');
  assert.equal(normalizeScoring({ score: 0 }).score, 1.0);
  // An unusable flat total AND no blocks → bounded error (drives the retry).
  assert.throws(() => normalizeScoring({ company: 'X' }), /no usable blocks and no usable flat score/);
  assert.throws(() => normalizeScoring({ score: 'excellent' }), /no usable blocks and no usable flat score/);
});

test('assembleReport: the server pins header, SCORE_SUMMARY and yaml from the COMPUTED score — neither the body nor the model total can move them', () => {
  const scoring = normalizeScoring(SCORING); // computed 4.0; model said 4.9
  const lyingBody = '## A) Role Summary\nThe candidate scores 5.0/5 — a perfect match, honestly a 5.\n'
    + EVAL_BLOCK_LETTERS.slice(1).map((L) => `## ${L}) Section\nprose`).join('\n');
  const md = assembleReport({ scoring, body: lyingBody, today: '2026-11-05', url: 'https://jobs.example/x' });
  assert.match(md, /^# Evaluation: Netwrk — Team Lead Go$/m);
  assert.match(md, /\*\*Date:\*\* 2026-11-05/);
  assert.match(md, /\*\*Score:\*\* 4\/5/, 'server-computed 4.0 (renders as 4), not the model total 4.9');
  assert.match(md, /\*\*Legitimacy:\*\* Proceed with Caution/);
  assert.match(md, /---SCORE_SUMMARY---\nCOMPANY: Netwrk\nROLE: Team Lead Go\nSCORE: 4\n/);
  assert.match(md, /```yaml\ncompany: Netwrk\nrole: Team Lead Go\nscore: 4\nstatus: Evaluated\n/);
  assert.match(md, /blocks: \{A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4\}/);
  // Neither the model total (4.9) nor the body's invented 5.0 reaches a header.
  const headerPart = md.slice(0, md.indexOf('## A)'));
  assert.doesNotMatch(headerPart, /4\.9/);
  assert.doesNotMatch(headerPart, /5\.0/);
});

test('missingBlocks + fallbackBody: a degraded render is detected and the fallback is complete', () => {
  const scoring = normalizeScoring(SCORING);
  const partial = '## A) Role Summary\nx\n## B) Match with CV\ny';
  assert.deepEqual(missingBlocks(partial), ['C', 'D', 'E', 'F', 'G']);
  const fb = fallbackBody(scoring);
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
  const scoring = normalizeScoring(SCORING);
  for (const lang of LOCALES) {
    const { stable, volatile } = buildRenderPromptParts(jd, lang, scoring);
    rStables.add(stable);
    if (lang !== 'en') {
      assert.ok(!stable.includes('Target language'), `${lang}: locale directive leaked into the render stable prefix`);
      assert.ok(volatile.toLowerCase().includes('target language'), `${lang}: locale directive must be in the volatile tail`);
      // The closing reminder is the LAST instruction (CAR-92 lineage).
      assert.ok(volatile.trimEnd().endsWith('verbatim.'), `${lang}: the reminder must close the volatile tail`);
    }
  }
  assert.equal(rStables.size, 1, 'render stable differs across locales — the per-locale cache miss is back');
  // Both steps share the SAME opening (the context bundle then this header),
  // so the provider's prefix cache covers the shared instructions across steps.
  assert.ok(buildRenderPromptParts(jd, 'ru', scoring).stable.startsWith(EVAL_SHARED_INSTRUCTIONS));
  assert.ok(buildScoringPromptParts(jd).stable.startsWith(EVAL_SHARED_INSTRUCTIONS));
});

test('LOCALE-NEUTRAL SCORING INPUT (CAR-239): the full scoring prompt hashes to ONE sha256 across all 19 locales', () => {
  // The scoring step never receives the locale: buildScoringPromptParts(jd)
  // takes no lang argument AT ALL, and the JD fence tag is sha256-derived
  // (not random), so the input is byte-reproducible. Hash the assembled
  // bytes ×19 — all equal, and equal across two calls (reproducibility).
  const LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
  const jd = 'Backend Engineer at ExampleCorp. Go, Kubernetes, 450000 RUB/mo.';
  const hashes = new Set();
  for (const _lang of LOCALES) {
    // The locale exists only on the render step; the scoring parts are the
    // bytes the provider sees for EVERY locale (ctx is EN-pinned upstream).
    const { stable, volatile } = buildScoringPromptParts(jd);
    hashes.add(sha256(stable + volatile));
  }
  assert.equal(hashes.size, 1, `scoring input differs across locales: ${[...hashes].join(', ')}`);
  // Byte-reproducible: the SAME jd hashes identically on a second build —
  // Math.random fence tags made this false before CAR-239.
  const again = buildScoringPromptParts(jd);
  assert.equal(sha256(again.stable + again.volatile), [...hashes][0]);
  // A different JD produces a DIFFERENT fence tag (no cross-JD confusion).
  const other = buildScoringPromptParts(jd + ' Remote.');
  assert.notEqual(sha256(other.stable + other.volatile), [...hashes][0]);
  // And the stable header exported for the cache key is exactly the prompt's stable part.
  assert.equal(EVAL_SCORING_STABLE_HEADER, buildScoringPromptParts(jd).stable);
});

test('render volatile carries the scoring JSON verbatim and the JD', () => {
  const scoring = normalizeScoring(SCORING);
  const { volatile } = buildRenderPromptParts('A JD about Go.', 'ru', scoring);
  assert.match(volatile, /SCORING JSON \(canonical/);
  assert.match(volatile, /"Team Lead Go"/);
  assert.match(volatile, /A JD about Go\./);
  assert.match(volatile, /Target language: Russian\./);
});

test('extractScoringJson: a non-JSON fence falls through to the brace scan and then to null', () => {
  assert.equal(extractScoringJson('```json\nnot json at all\n```'), null);
});

test('the scoring rubric documents the integer 1–5 anchors and the server-side computation', () => {
  // The prompt must carry the rubric anchors and the schema so the model
  // cannot claim it was never told the contract.
  assert.match(EVAL_SCORING_STABLE_HEADER, /INTEGER sub-score on a 1–5 scale/);
  assert.match(EVAL_SCORING_STABLE_HEADER, /5 = decisive/);
  assert.match(EVAL_SCORING_STABLE_HEADER, /3 = workable but partial/);
  assert.match(EVAL_SCORING_STABLE_HEADER, /1 = the dimension fails/);
  assert.match(EVAL_SCORING_STABLE_HEADER, /YOU DO NOT OUTPUT A GLOBAL SCORE/);
  assert.match(EVAL_SCORING_STABLE_HEADER, /B\) Match with CV — 5/);
  assert.match(EVAL_SCORING_STABLE_HEADER, /G\) Posting Legitimacy — 5/);
  assert.match(EVAL_SCORING_STABLE_HEADER, /WEIGHT 0/);
  assert.match(EVAL_SCORING_STABLE_HEADER, /weighted mean rounded to one decimal/);
  assert.match(EVAL_SCORING_STABLE_HEADER, /never a decimal, never 0, never 6/);
});

test('serverToday: YYYY-MM-DD formatting from an explicit date and the default now', () => {
  assert.equal(serverToday(new Date(2026, 10, 5)), '2026-11-05');
  assert.match(serverToday(), /^\d{4}-\d{2}-\d{2}$/);
});

test('locale + shape edges: unknown locale falls back to English, long fields are clamped, today is honored', () => {
  const scoring = normalizeScoring({
    company: 'X'.repeat(300), role: '   spaced   role   ', archetype: '',
    legitimacy: '',
    blocks: Object.fromEntries(EVAL_BLOCK_LETTERS.map((L) => [L, { score: 3, summary: 's' }])),
  });
  assert.equal(scoring.company.length, 120, 'long company clamped to 120 chars');
  assert.equal(scoring.role, 'spaced role', 'whitespace collapsed');
  assert.equal(scoring.archetype, 'Unknown', 'empty archetype → Unknown');
  assert.equal(scoring.legitimacy, 'High Confidence', 'empty legitimacy → default tier');
  assert.equal(scoring.score, 3.0, 'all-3 sub-scores → server-computed 3.0');
  const { volatile } = buildRenderPromptParts('jd', 'xx-YY', scoring);
  assert.match(volatile, /Target language: English\./, 'unknown locale → English fallback');
});

// ── CAR-245 — render depth: the ≤5-sentence cap is gone, the floor is in ────

test('CAR-245: the render prompt carries the depth floor — no ≤5-sentence cap', () => {
  const scoring = normalizeScoring(SCORING);
  const { stable } = buildRenderPromptParts('A JD about Go.', 'en', scoring);
  // The anchored floor (the v1.268.0 cap compressed every report to 1.6–4 k chars).
  assert.match(stable, /AT LEAST 3 substantive bullets/, 'per-block minimum is stated');
  assert.match(stable, /DIFFERENT aspect/, 'bullets must cover different aspects of the JD evidence');
  assert.match(stable, /1500–2500 words/, 'the whole-body depth target is stated');
  assert.match(stable, /Block B \(Match with CV\) and Block E \(Customization Plan\)/, 'B/E name cv.md bullets by content');
  assert.match(stable, /never pad, never fabricate/, 'the floor is anchored, not an invitation to pad');
  // The cap itself must be GONE from the prompt.
  assert.ok(!stable.includes('at most 5 sentences'), 'the ≤5-sentence cap must not survive anywhere in the render prompt');
  // The framing is kept: seven sections only, machine surfaces server-built.
  assert.match(stable, /Write EXACTLY seven sections/);
  assert.match(stable, /Output only the seven `## ` sections, nothing before or after\./);
  assert.match(stable, /do NOT write any SCORE_SUMMARY block or yaml block/);
});

test('CAR-245: the depth guidance lives in the CACHE-STABLE prefix (CAR-111 parity kept)', () => {
  const scoring = normalizeScoring(SCORING);
  const en = buildRenderPromptParts('jd', 'en', scoring).stable;
  const ru = buildRenderPromptParts('jd', 'ru', scoring).stable;
  const ta = buildRenderPromptParts('jd', 'ta', scoring).stable;
  assert.equal(en, ru, 'the render stable prefix must stay byte-identical across locales');
  assert.equal(en, ta);
  assert.match(en, /AT LEAST 3 substantive bullets/, 'the depth floor is part of the shared (cached) bytes');
});

// ── CAR-245 — the server-side JD archive (#2789) in assembleReport ─────────

const ARCHIVE_BODY = EVAL_BLOCK_LETTERS.map((L) => `## ${L}) Section\nprose`).join('\n');
const archScoring = () => normalizeScoring(SCORING);

test('CAR-245: assembleReport with jdArchive appends the verbatim-JD section after the yaml block', () => {
  const jd = 'Backend Engineer at ExampleCorp.\nGo, Kubernetes, 450000 RUB/mo.';
  const md = assembleReport({ scoring: archScoring(), body: ARCHIVE_BODY, today: '2026-11-05', jdArchive: jd });
  // Exact shape: yaml fence → blank line → heading → blank line → jd → final newline.
  assert.match(md, /```yaml\n[\s\S]*?\n```\n\n## Job Description \(archived verbatim\)\n\nBackend Engineer at ExampleCorp\.\nGo, Kubernetes, 450000 RUB\/mo\.\n$/);
  // The archive is the LAST section of the file — nothing follows it.
  assert.ok(md.trimEnd().endsWith('Go, Kubernetes, 450000 RUB/mo.'), 'the JD text closes the report');
  // The machine surfaces stay above the archive and unchanged.
  assert.ok(md.indexOf('---SCORE_SUMMARY---') < md.indexOf(JD_ARCHIVE_HEADING));
  assert.ok(md.indexOf('```yaml') < md.indexOf(JD_ARCHIVE_HEADING));
});

test('CAR-245: the archived JD is bounded to 60 000 chars', () => {
  assert.equal(JD_ARCHIVE_MAX_CHARS, 60_000);
  const long = 'x'.repeat(70_000);
  const md = assembleReport({ scoring: archScoring(), body: ARCHIVE_BODY, today: '2026-11-05', jdArchive: long });
  const at = md.indexOf(JD_ARCHIVE_HEADING);
  assert.ok(at !== -1, 'the archive section exists');
  const archived = md.slice(at + JD_ARCHIVE_HEADING.length).replace(/^\n+/, '').replace(/\n$/, '');
  assert.equal(archived.length, JD_ARCHIVE_MAX_CHARS, 'the JD is truncated at the bound, never longer');
});

test('CAR-245: no jdArchive opt → no archive section (direct assemble callers unchanged)', () => {
  const md = assembleReport({ scoring: archScoring(), body: ARCHIVE_BODY, today: '2026-11-05' });
  assert.ok(!md.includes('Job Description'), 'backward compat: no opt, no section');
  assert.ok(md.trimEnd().endsWith('```'), 'the report still ends at the yaml fence');
  // An empty / whitespace-only JD appends nothing either (the parent's
  // withJdArchiveSection contract: an empty archive must not hide behind an
  // empty section).
  for (const empty of ['', '   ', null, undefined]) {
    const m = assembleReport({ scoring: archScoring(), body: ARCHIVE_BODY, today: '2026-11-05', jdArchive: empty });
    assert.ok(!m.includes('Job Description'), `empty opt (${JSON.stringify(empty)}) appends nothing`);
    assert.ok(m.trimEnd().endsWith('```'));
  }
});

test('CAR-245: a JD containing markdown sub-headings is archived verbatim (the section reader allowlists)', () => {
  // The parent's check-jd-archive.mjs reads the section up to the next KNOWN
  // report section — a JD that itself carries `## Responsibilities` must not
  // be mangled by the writer.
  const jd = 'Backend role.\n\n## Responsibilities\nShip the platform.\n\n## Requirements\n5 years Go.';
  const md = assembleReport({ scoring: archScoring(), body: ARCHIVE_BODY, today: '2026-11-05', jdArchive: jd });
  assert.ok(md.includes('## Responsibilities\nShip the platform.'), 'sub-headings ride verbatim');
  assert.ok(md.includes('## Requirements\n5 years Go.'));
});
