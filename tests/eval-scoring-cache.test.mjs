/**
 * eval-scoring-cache.test.mjs — the CAR-239 deterministic-scoring cache.
 *
 * Pins (red-first against the v1.268.0 shape, where every repeat re-rolled
 * the scoring dice):
 *   · the cache key is a pure function of (stableHeader, normalizedJD,
 *     cvHash, profileHash, model) — deterministic across calls, sensitive to
 *     every ingredient, blind to the locale (the scoring input is
 *     locale-neutral, so one entry serves all 19 languages);
 *   · runTwoStepEvaluation consults the cache BEFORE the provider: a repeat
 *     of the same JD makes ONE provider call total (render only), reports
 *     the SAME score, and fires the 'scoring (cached)' stage — the provider
 *     call count is 1, not 2;
 *   · a CV/profile/_custom.md change changes the key (invalidation);
 *   · a model change changes the key (scoringModelIdentity);
 *   · TTL: an entry past 7 days reads as a miss (now override);
 *   · LRU: >500 entries evict the least-recently-used, and reads bump
 *     recency that the next write persists;
 *   · EVAL_SCORE_CACHE=0 disables the cache (both runs call the provider);
 *   · writes are locked and atomic — concurrent writes all land.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, stub 127.0.0.1:0, no network/keys.
 * This suite deliberately does NOT import tests/helpers/eval-two-step-stub.mjs
 * (that helper sets EVAL_SCORE_CACHE=0 for the stub suites) — it manages the
 * scoring-cache env itself and carries its own inline fixtures.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// The cache is the subject here — it must be ON for this suite.
delete process.env.EVAL_SCORE_CACHE;

const SCORING_MARKER = 'Output ONLY a JSON object';
const RENDER_MARKER = 'SCORING JSON (canonical';

/** Integer sub-score fixture (all blocks at `n`) — the CAR-239 model shape. */
const BLOCKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const scoringJson = (n = 4) => JSON.stringify({
  company: 'CacheCo', role: 'Platform Engineer', archetype: 'Platform',
  legitimacy: 'High Confidence', score: n, // the model total — IGNORED by the server
  blocks: Object.fromEntries(BLOCKS.map((L) => [L, { score: n, summary: `Block ${L}: meets the bar with evidence.` }])),
});
const renderBody = () => BLOCKS.map((L) => `## ${L}) Section\nGrounded prose for ${L}.`).join('\n\n');

const JD = 'Senior Platform Engineer at CacheCo. Kubernetes, Go, on-call, remote. '.repeat(3);

let runTwoStepEvaluation, scoringCache, stub, dir, cvPath, profilePath, customPath;
let scoringCalls = 0, renderCalls = 0;

before(async () => {
  stub = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let content = '';
      try {
        const b = JSON.parse(body);
        const prompt = b.messages.map((m) => m.content).join('\n');
        if (prompt.includes(SCORING_MARKER)) { scoringCalls += 1; content = scoringJson(4); }
        else if (prompt.includes(RENDER_MARKER)) { renderCalls += 1; content = renderBody(); }
      } catch { content = ''; }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }));
    });
  });
  await new Promise((r) => stub.listen(0, '127.0.0.1', r));

  dir = mkdtempSync(resolve(tmpdir(), 'eval-scoring-cache-'));
  for (const d of ['config', 'data', 'modes', 'reports']) mkdirSync(resolve(dir, d), { recursive: true });
  cvPath = resolve(dir, 'cv.md');
  profilePath = resolve(dir, 'config', 'profile.yml');
  customPath = resolve(dir, 'modes', '_custom.md');
  writeFileSync(cvPath, '# CV\nGo, Kubernetes, 6 years.\n');
  writeFileSync(profilePath, 'candidate:\n  full_name: Test\n');
  writeFileSync(customPath, '# custom rules\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  for (const m of ['_shared', 'oferta']) writeFileSync(resolve(dir, 'modes', `${m}.md`), `# ${m}\n`);
  process.env.CAREER_OPS_ROOT = dir;
  process.env.LLM_PROVIDER = 'hermes';
  process.env.HERMES_API_KEY = 'stub-key-123456';
  process.env.HERMES_BASE_URL = `http://127.0.0.1:${stub.address().port}/v1`;
  ({ runTwoStepEvaluation } = await import('../server/lib/eval-two-step.mjs'));
  scoringCache = await import('../server/lib/scoring-cache.mjs');
});

after(() => {
  for (const k of ['CAREER_OPS_ROOT', 'LLM_PROVIDER', 'HERMES_API_KEY', 'HERMES_BASE_URL']) delete process.env[k];
  stub?.close();
});

const scoreOf = (md) => Number((md.match(/\*\*Score:\*\* ([\d.]+)\/5/) || [])[1]);

test('key ingredients: deterministic, whitespace-normalized, sensitive to every input', () => {
  const { scoringCacheKey } = scoringCache;
  const header = 'STABLE HEADER BYTES\n';
  const k1 = scoringCacheKey({ stableHeader: header, jd: JD, model: 'hermes:m1' });
  assert.equal(scoringCacheKey({ stableHeader: header, jd: JD, model: 'hermes:m1' }), k1, 'same inputs → same key');
  assert.notEqual(scoringCacheKey({ stableHeader: header + 'x', jd: JD, model: 'hermes:m1' }), k1, 'header edit → new key');
  assert.notEqual(scoringCacheKey({ stableHeader: header, jd: JD + ' Rust.', model: 'hermes:m1' }), k1, 'JD edit → new key');
  assert.notEqual(scoringCacheKey({ stableHeader: header, jd: JD, model: 'hermes:m2' }), k1, 'model switch → new key');
  // Whitespace-only JD differences stay ONE key (CRLF, double spaces, trim).
  assert.equal(
    scoringCacheKey({ stableHeader: header, jd: JD.replace(/\n/g, '\r\n').replace(/  +/g, ' ') + '\n\n', model: 'hermes:m1' }),
    k1,
    'a re-scan that only reflows whitespace is a hit, not a miss',
  );
});

test('key invalidation: a CV / profile / _custom.md change changes the key; locale is not an ingredient', async () => {
  const { scoringCacheKey } = scoringCache;
  const args = { stableHeader: 'H\n', jd: JD, model: 'hermes:m1' };
  const base = scoringCacheKey(args);
  writeFileSync(cvPath, '# CV\nGo, Kubernetes, 7 years now.\n');
  assert.notEqual(scoringCacheKey(args), base, 'cv.md edit → new key');
  writeFileSync(profilePath, 'candidate:\n  full_name: Test\n  city: Berlin\n');
  assert.notEqual(scoringCacheKey(args), base, 'profile.yml edit → new key');
  writeFileSync(customPath, '# custom rules\nbe terse\n');
  assert.notEqual(scoringCacheKey(args), base, 'modes/_custom.md edit → new key');
  // Missing files hash as 'missing' — creating one later invalidates too.
  assert.ok(base, 'key computed with the files present');
});

test('scoringModelIdentity: provider slug + configured model, github special-cased', () => {
  const { scoringModelIdentity } = scoringCache;
  process.env.HERMES_MODEL = 'stub-model-9';
  assert.equal(scoringModelIdentity('hermes'), 'hermes:stub-model-9');
  delete process.env.HERMES_MODEL;
  assert.equal(scoringModelIdentity('hermes'), 'hermes:default', 'unset model → default');
  assert.equal(scoringModelIdentity('github'), 'github:default', 'the one slug breaking the ${SLUG}_MODEL convention');
  assert.equal(scoringModelIdentity(''), 'unknown:default');
});

test('normalizeJdForCache: CRLF, space runs, paragraph folds, trim', () => {
  const { normalizeJdForCache } = scoringCache;
  assert.equal(normalizeJdForCache('a\r\nb\r c'), 'a\nb\n c', 'every CR folds to LF');
  assert.equal(normalizeJdForCache('a   \t b'), 'a b');
  assert.equal(normalizeJdForCache('a\n\n\n\nb'), 'a\n\nb');
  assert.equal(normalizeJdForCache('  x  '), 'x');
  assert.equal(normalizeJdForCache(null), '');
});

test('END-TO-END hit: the repeat makes ONE provider call, not two — same score, scoring (cached) stage', async () => {
  scoringCalls = 0; renderCalls = 0;
  const stages1 = [];
  const r1 = await runTwoStepEvaluation(JD, 'en', { today: '2026-11-05', onStage: (s) => stages1.push(s) });
  assert.equal(scoringCalls, 1, 'first run: exactly one scoring call');
  assert.equal(renderCalls, 1);
  assert.deepEqual(stages1, ['scoring', 'rendering', 'assembling', 'done'], 'first run stages have no (cached)');

  const stages2 = [];
  const r2 = await runTwoStepEvaluation(JD, 'en', { today: '2026-11-05', onStage: (s) => stages2.push(s) });
  assert.equal(scoringCalls, 1, 'cache hit: the provider scoring call count stays 1 (was 2)');
  assert.equal(renderCalls, 2, 'the render step still runs — only the scoring is cached');
  assert.deepEqual(stages2, ['scoring (cached)', 'rendering', 'assembling', 'done'], 'the hit renames the stage');
  assert.equal(r2.scoring.score, r1.scoring.score, 'same JD → byte-same scoring → same final score');
  assert.deepEqual(r2.scoring.blocks, r1.scoring.blocks);
  assert.equal(r2.usage.in, 10, 'only the render call is metered in the hit run');
});

test('END-TO-END: a repeat in ANOTHER locale hits the same entry (locale-neutral scoring input)', async () => {
  scoringCalls = 0; renderCalls = 0;
  const stages = [];
  await runTwoStepEvaluation(JD, 'ru', { today: '2026-11-05', onStage: (s) => stages.push(s) });
  assert.equal(scoringCalls, 0, 'the ru run does NOT re-call scoring after the en run (0 new calls)');
  assert.ok(stages.includes('scoring (cached)'), 'ru hits the en-written entry');
  assert.equal(renderCalls, 1, 'render runs per locale (its input carries the locale directive)');
});

test('END-TO-END: a CV change invalidates the entry — the provider is called again', async () => {
  scoringCalls = 0;
  await runTwoStepEvaluation(JD, 'en', { today: '2026-11-05' });
  assert.equal(scoringCalls, 0, 'warm hit before the edit');
  writeFileSync(cvPath, '# CV\nGo, Kubernetes, 8 years.\n');
  await runTwoStepEvaluation(JD, 'en', { today: '2026-11-05' });
  assert.equal(scoringCalls, 1, 'the cv.md edit changed the key → re-scored');
});

test('EVAL_SCORE_CACHE=0 disables the cache entirely', async () => {
  process.env.EVAL_SCORE_CACHE = '0';
  scoringCalls = 0;
  try {
    await runTwoStepEvaluation(JD, 'en', { today: '2026-11-05' });
    await runTwoStepEvaluation(JD, 'en', { today: '2026-11-05' });
    assert.equal(scoringCalls, 2, 'no cache → both runs call the scoring provider');
  } finally {
    delete process.env.EVAL_SCORE_CACHE;
  }
});

test('TTL: an entry past the 7-day lifetime reads as a miss; a fresh one reads', async () => {
  const { writeScoringCache, readScoringCache } = scoringCache;
  const k = `ttl-${Date.now()}`;
  const t0 = 1_700_000_000_000;
  await writeScoringCache(k, { blocks: { A: { score: 4 } } }, { now: t0 });
  const fresh = readScoringCache(k, { now: t0 + 6 * 24 * 3600 * 1000 });
  assert.ok(fresh, 'within TTL → hit');
  assert.equal(readScoringCache(k, { now: t0 + 8 * 24 * 3600 * 1000 }), null, 'past 7 days → miss');
});

test('read-side LRU: a read bumps recency the next write persists — the read entry survives eviction', async () => {
  const { writeScoringCache, readScoringCache, SCORING_CACHE_FILE } = scoringCache;
  // Seed 500 entries at t0.
  const t0 = 2_000_000_000_000;
  const keys = Array.from({ length: 500 }, (_, i) => `lru-${i}`);
  for (let i = 0; i < 500; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await writeScoringCache(keys[i], { blocks: { A: { score: 1 } } }, { now: t0 + i });
  }
  // Touch the OLDEST entry (lru-0) — a read, no write.
  assert.ok(readScoringCache('lru-0', { now: t0 + 999 }), 'lru-0 hit before eviction');
  // One more write must evict the least-recently-used SURVIVOR (lru-1),
  // not the just-read lru-0.
  await writeScoringCache('lru-500', { blocks: { A: { score: 1 } } }, { now: t0 + 1000 });
  const map = JSON.parse(readFileSync(SCORING_CACHE_FILE, 'utf8'));
  assert.equal(Object.keys(map.entries).length, 500, 'bounded at 500');
  assert.ok(map.entries['lru-0'], 'the read entry survived (LRU, not FIFO)');
  assert.ok(!map.entries['lru-1'], 'the untouched oldest entry was evicted');
  assert.ok(map.entries['lru-500'], 'the new entry landed');
});

test('writes are locked and atomic: concurrent writes all land, the file stays valid JSON', async () => {
  const { writeScoringCache, readScoringCache, SCORING_CACHE_FILE } = scoringCache;
  const t = 3_000_000_000_000;
  await Promise.all(Array.from({ length: 8 }, (_, i) =>
    writeScoringCache(`conc-${i}`, { blocks: { A: { score: 2 } } }, { now: t + i })));
  const map = JSON.parse(readFileSync(SCORING_CACHE_FILE, 'utf8'));
  for (let i = 0; i < 8; i += 1) assert.ok(map.entries[`conc-${i}`], `conc-${i} landed`);
  assert.ok(readScoringCache('conc-3', { now: t + 50 }), 'all entries readable after the concurrent burst');
});
