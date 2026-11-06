/**
 * eval-two-step.test.mjs — orchestration-level unit tests for the two-step
 * evaluate (CAR-229/230): scoring retry accounting, render retry + fallback
 * accounting, warning propagation, and usage aggregation — all against a
 * stubbed runActiveProvider via the route-level suites' trick: the helper
 * is exercised through the real llm-dispatch with LLM_PROVIDER pointed at a
 * stub Hermes endpoint.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, stub 127.0.0.1:0, no network/keys.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { twoShapeAnswers, scoringFixture, renderBodyFixture, isScoringCall } from './helpers/eval-two-step-stub.mjs';

let runTwoStepEvaluation, evalScoreSeed, evalScoreSamples, medianScoring, providerAcceptsSeed;
let stub, lastPrompt = '', lastMaxTokens = null;
let rootDir; // the suite's CAREER_OPS_ROOT — the route-level CAR-245 test reads saved reports from it
// CAR-239 — every stub call is recorded so a test can pin what the SCORING
// step put on the wire (temperature, seed) separately from the render step.
let calls = [];
let setAnswers = (v) => { current = v; };
let current = twoShapeAnswers({ scoring: scoringFixture(), body: renderBodyFixture({}) });

// CAR-245 — the render depth floor: a well-formed body is ≥ 2500 chars, so
// suites that pin "no warnings" answer with a body AT the floor. The default
// one-line fixture (~1.1 k chars) is the THIN case the new warning exists for.
const LONG_LINE = 'The candidate meets the requirement with direct platform evidence: owned the service end to end, ran on-call for it, and migrated the stack to the posted tooling. '.repeat(4);
const longBody = () => renderBodyFixture({ line: LONG_LINE });

before(async () => {
  stub = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let content = '';
      try {
        const b = JSON.parse(body);
        lastPrompt = b.messages.map((m) => m.content).join('\n');
        lastMaxTokens = b.max_tokens;
        calls.push({ prompt: lastPrompt, temperature: b.temperature, seed: b.seed, maxTokens: b.max_tokens });
        content = current(lastPrompt);
      } catch { lastPrompt = ''; }
      let usage = { prompt_tokens: 10, completion_tokens: 5 };
      if (content && typeof content === 'object' && content.__stubUsage) {
        usage = content.__stubUsage;
        content = content.__stubText;
      }
      if (content && content.__stubError) {
        res.statusCode = 503;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: { message: 'overloaded' } }));
        return;
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content } }], usage }));
    });
  });
  await new Promise((r) => stub.listen(0, '127.0.0.1', r));
  const dir = mkdtempSync(resolve(tmpdir(), 'eval-two-step-'));
  rootDir = dir;
  for (const d of ['config', 'data', 'modes', 'reports']) mkdirSync(resolve(dir, d), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  for (const m of ['_shared', 'oferta']) writeFileSync(resolve(dir, 'modes', `${m}.md`), `# ${m}\n`);
  process.env.CAREER_OPS_ROOT = dir;
  process.env.LLM_PROVIDER = 'hermes';
  process.env.HERMES_API_KEY = 'stub-key-123456';
  process.env.HERMES_BASE_URL = `http://127.0.0.1:${stub.address().port}/v1`;
  ({ runTwoStepEvaluation, evalScoreSeed, evalScoreSamples, medianScoring } = await import('../server/lib/eval-two-step.mjs'));
  ({ providerAcceptsSeed } = await import('../server/lib/llm-dispatch.mjs'));
});

after(() => {
  for (const k of ['CAREER_OPS_ROOT', 'LLM_PROVIDER', 'HERMES_API_KEY', 'HERMES_BASE_URL']) delete process.env[k];
  stub?.close();
});

test('the happy two-step run: complete machine surface, aggregated usage, stages fired', async () => {
  setAnswers(twoShapeAnswers({ scoring: scoringFixture({ company: 'Acme', role: 'Engineer', score: 4.1 }), body: longBody() }));
  const stages = [];
  const r = await runTwoStepEvaluation('Senior Platform Engineer at Acme. Kubernetes, Go, on-call. '.repeat(3), 'en', {
    url: 'https://jobs.example/1',
    today: '2026-11-05',
    onStage: (name) => stages.push(name),
  });
  assert.deepEqual(stages, ['scoring', 'rendering', 'assembling', 'done']);
  assert.match(r.markdown, /^# Evaluation: Acme — Engineer/m);
  // CAR-239 fixture contract: 4.1 is not on the six-block mean grid — the
  // solver snaps to 4.2 and the pin asserts the ACHIEVED value (the helper
  // header documents this).
  assert.match(r.markdown, /\*\*Score:\*\* 4\.2\/5/);
  assert.match(r.markdown, /```yaml/);
  assert.equal(r.usage.in, 20, 'two calls × 10 prompt tokens');
  assert.equal(r.usage.out, 10, 'two calls × 5 completion tokens');
  assert.equal(r.steps, 2);
  assert.equal(r.fallbackUsed, false);
  assert.deepEqual(r.warnings, [], 'a deep, complete run carries no warnings');
  // CAR-245 — the run's own JD is archived server-side into the saved markdown.
  assert.match(r.markdown, /```yaml\n[\s\S]*?\n```\n\n## Job Description \(archived verbatim\)\n\nSenior Platform Engineer at Acme\./);
});

test('the scoring step retries garbage then succeeds; the warning is carried', async () => {
  let scoringCalls = 0;
  setAnswers((prompt) => {
    if (prompt.includes('Output ONLY a JSON object')) {
      scoringCalls += 1;
      return scoringCalls === 1 ? 'Looks like a great fit overall!' : JSON.stringify(scoringFixture({ score: 3.2 }));
    }
    return renderBodyFixture({});
  });
  const r = await runTwoStepEvaluation('Backend Engineer at Globex. Rust, distributed systems. '.repeat(3), 'en', { today: '2026-11-05' });
  assert.equal(scoringCalls, 2, 'one retry after the garbage answer');
  assert.ok(r.warnings.some((w) => /scoring retry/.test(w)));
  assert.equal(r.scoring.score, 3.2);
});

test('both scoring attempts garbage → the step throws with the bounded error', async () => {
  setAnswers((prompt) => (prompt.includes('Output ONLY a JSON object') ? 'No JSON here, sorry.' : renderBodyFixture({})));
  await assert.rejects(
    runTwoStepEvaluation('Platform role. '.repeat(10), 'en', { today: '2026-11-05' }),
    (e) => e.step === 'scoring' && /scoring step failed after retry/.test(e.message),
  );
});

test('a render error on both attempts → fallback body, no thrown, warnings carried', async () => {
  setAnswers((prompt) => {
    if (prompt.includes('Output ONLY a JSON object')) return JSON.stringify(scoringFixture({ score: 2.8 }));
    return { __stubError: true }; // the stub answers HTTP 503 on both render attempts
  });
  const r = await runTwoStepEvaluation('Data Engineer at Initech. Python, Airflow. '.repeat(3), 'en', { today: '2026-11-05' });
  assert.equal(r.fallbackUsed, true);
  assert.ok(r.warnings.some((w) => /render attempt 1 failed/.test(w)));
  assert.ok(r.warnings.some((w) => /server fallback body used/.test(w)));
  // The machine surface is complete even in the fallback.
  for (const L of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) assert.match(r.markdown, new RegExp(`^## ${L}\\)`, 'm'), `heading ${L}`);
  assert.match(r.markdown, /```yaml/);
});

test('salary and location land in the yaml block when provided', async () => {
  setAnswers(twoShapeAnswers({ scoring: scoringFixture({ score: 3.0 }), body: renderBodyFixture({}) }));
  const r = await runTwoStepEvaluation('Analyst at Dunder Mifflin. SQL, Excel. '.repeat(3), 'en', {
    today: '2026-11-05',
    salary: '450000-600000 RUB/mo',
    location: 'Moscow / remote',
  });
  assert.match(r.markdown, /salary: "450000-600000 RUB\/mo"/);
  assert.match(r.markdown, /location: "Moscow \/ remote"/);
});

// ── Review v1.268.1: url header-forgery guard, render budget threading, cached absorb ──

const JD_R = 'Senior Platform Engineer at Acme. Kubernetes, Go, on-call. '.repeat(3);

test('a url with embedded newlines cannot forge report header lines', async () => {
  setAnswers(twoShapeAnswers({ scoring: scoringFixture({ company: 'Acme', role: 'Engineer', score: 4.1 }), body: renderBodyFixture({}) }));
  const r = await runTwoStepEvaluation(JD_R, 'en', { url: 'https://jobs.example.com/1\n**Score:** 5.0/5\n**Date:** 1999-01-01', today: '2026-11-05' });
  const urlCell = (r.markdown.match(/\*\*URL:\*\* [^\n]*/) || [''])[0].replace(/^\*\*URL:\*\* /, '');
  // The injection is flattened INTO the URL cell (one line, no bold markers
  // left) — it can no longer forge `**X:**` header LINES the parsers read.
  assert.ok(!urlCell.includes('**'), `no bold markers survive in the URL cell: ${urlCell}`);
  assert.ok(!/^\*\*Date:\*\* 1999-01-01/m.test(r.markdown), 'no forged Date header line');
  assert.ok(!/^\*\*Score:\*\* 5\.0/m.test(r.markdown), 'no forged Score header line');
  assert.equal((r.markdown.match(/\*\*Date:\*\* 1999-01-01/g) || []).length, 0, 'no bold Date forgery anywhere');
});

test('the render budget is threaded from opts.maxTokens (CAR-174 — token-dense locales)', async () => {
  setAnswers(twoShapeAnswers({ scoring: scoringFixture({ company: 'Acme', role: 'Engineer', score: 4.1 }), body: renderBodyFixture({}) }));
  lastMaxTokens = null;
  await runTwoStepEvaluation(JD_R, 'en', { maxTokens: 32768 });
  assert.equal(lastMaxTokens, 32768, 'the render step must carry the caller budget (32768 for token-dense locales)');
  lastMaxTokens = null;
  await runTwoStepEvaluation(JD_R, 'en', {});
  assert.equal(lastMaxTokens, 16384, 'no opts → the EN default');
});

test('a provider reporting the cache sum AS `cached` is absorbed into usage.cached', async () => {
  const stubText = (t) => ({ __stubText: t, __stubUsage: { prompt_tokens: 10, completion_tokens: 5, cached: 37000 } });
  setAnswers((promptText) => (isScoringCall(promptText)
    ? stubText(JSON.stringify(scoringFixture({ company: 'Acme', role: 'Engineer', score: 4.1 })))
    : stubText(renderBodyFixture({}))));
  const r = await runTwoStepEvaluation(JD_R, 'en', {});
  assert.equal(r.usage.cached, 74000, 'two steps × 37000 — a top-level `cached` field is not lost');
});

// ── CAR-239 — score determinism: temperature 0, fixed seed, self-consistency ──

test('CAR-239: the scoring call runs at temperature 0 with the fixed seed; the render call carries neither', async () => {
  setAnswers(twoShapeAnswers({ scoring: scoringFixture({ company: 'Acme', role: 'Engineer', score: 4.2 }), body: renderBodyFixture({}) }));
  calls = [];
  await runTwoStepEvaluation(JD_R, 'en', {});
  const scoring = calls.filter((c) => isScoringCall(c.prompt));
  const render = calls.filter((c) => !isScoringCall(c.prompt));
  assert.equal(scoring.length, 1, 'hermes accepts a seed → one scoring sample by default');
  for (const c of scoring) {
    assert.equal(c.temperature, 0, 'scoring temperature is 0 (was 0.1 in v1.268.0 — the prod spread that bought)');
    assert.equal(c.seed, 42, 'the fixed default seed (EVAL_SCORE_SEED unset → 42) rides the scoring body');
  }
  for (const c of render) {
    assert.equal(c.seed, undefined, 'the render step is creative — no seed');
    assert.equal(c.temperature, 0.3, 'the render step keeps its own temperature');
  }
});

test('CAR-239: EVAL_SCORE_SEED overrides the default and reaches the scoring body', async () => {
  process.env.EVAL_SCORE_SEED = '7';
  try {
    setAnswers(twoShapeAnswers({ scoring: scoringFixture({ score: 3.2 }), body: renderBodyFixture({}) }));
    calls = [];
    await runTwoStepEvaluation(JD_R, 'en', {});
    for (const c of calls.filter((x) => isScoringCall(x.prompt))) assert.equal(c.seed, 7);
  } finally {
    delete process.env.EVAL_SCORE_SEED;
  }
});

test('CAR-239: self-consistency — EVAL_SCORE_SAMPLES=3 makes three parallel scoring calls and folds the MEDIAN', async () => {
  process.env.EVAL_SCORE_SAMPLES = '3';
  let n = 0;
  try {
    // Three usable samples whose block scores are 3 / 4 / 5 per block —
    // the median of every block sub-score is 4, so the server-computed
    // final is 4.0 regardless of the samples' order or timing.
    const fixtures = [scoringFixture({ score: 3.0 }), scoringFixture({ score: 4.0 }), scoringFixture({ score: 5.0 })];
    setAnswers((prompt) => (isScoringCall(prompt) ? JSON.stringify(fixtures[n++ % 3]) : renderBodyFixture({})));
    calls = [];
    const r = await runTwoStepEvaluation(JD_R, 'en', { today: '2026-11-05' });
    const scoringCalls = calls.filter((c) => isScoringCall(c.prompt));
    assert.equal(scoringCalls.length, 3, 'three parallel samples, not one');
    assert.equal(r.scoring.score, 4.0, 'the final score is the server-computed mean of the MEDIAN sub-scores');
    for (const L of ['A', 'B', 'C', 'D', 'E', 'F']) assert.equal(r.scoring.blocks[L].score, 4, `block ${L}: median of [3,4,5]`);
    assert.equal(r.steps, 4, '3 scoring samples + 1 render');
    assert.equal(r.usage.in, 40, 'all samples absorbed: 3 scoring × 10 + 1 render × 10');
    assert.equal(r.usage.out, 20, '3 × 5 + 1 × 5');
    assert.ok(r.warnings.some((w) => /self-consistency: median of 3\/3/.test(w)), `warning carried: ${r.warnings.join(' | ')}`);
  } finally {
    delete process.env.EVAL_SCORE_SAMPLES;
  }
});

test('CAR-239: a fractional sub-score fails the schema on both attempts → bounded error names the block', async () => {
  const fractional = scoringFixture({ score: 3.2 });
  fractional.blocks.D = { ...fractional.blocks.D, score: 3.5 };
  setAnswers((prompt) => (isScoringCall(prompt) ? JSON.stringify(fractional) : renderBodyFixture({})));
  await assert.rejects(
    runTwoStepEvaluation(JD_R, 'en', { today: '2026-11-05' }),
    (e) => e.step === 'scoring' && /integer 1–5/.test(e.message) && /block D/.test(e.message),
    `expected the bounded scoring error, got: none`,
  );
});

test('CAR-239 pure helpers: evalScoreSeed / evalScoreSamples / medianScoring', () => {
  assert.equal(evalScoreSeed({}), 42, 'default 42 — a constant chosen once, not a per-run random');
  assert.equal(evalScoreSeed({ EVAL_SCORE_SEED: '7' }), 7);
  assert.equal(evalScoreSeed({ EVAL_SCORE_SEED: 'junk' }), 42, 'junk env falls back to the default');
  // Samples: 1 when the provider accepts a seed, 3 when it does not.
  assert.equal(evalScoreSamples(true, {}), 1);
  assert.equal(evalScoreSamples(false, {}), 3);
  assert.equal(evalScoreSamples(true, { EVAL_SCORE_SAMPLES: '4' }), 4, 'env override wins');
  assert.equal(evalScoreSamples(true, { EVAL_SCORE_SAMPLES: '99' }), 5, 'clamped high');
  assert.equal(evalScoreSamples(true, { EVAL_SCORE_SAMPLES: '0' }), 1, 'clamped low');
  assert.equal(evalScoreSamples(true, { EVAL_SCORE_SAMPLES: 'junk' }), 1, 'junk env → the seed-aware default');
  // medianScoring: single sample passthrough; the fold takes the MEDIAN of
  // every block and the identity fields from the median-final sample.
  // (scoringFixture solves achievable grid points, so the fixture's `score`
  // IS the computed final for these inputs.)
  const mk = (score, company) => ({ ...scoringFixture({ score, company }) });
  const a = mk(3.0, 'Low'), b = mk(4.0, 'Mid'), c = mk(5.0, 'High');
  const single = medianScoring([b]);
  assert.equal(single, b, 'one sample is returned as-is');
  const folded = medianScoring([a, b, c]);
  assert.equal(folded.score, 4.0);
  assert.equal(folded.company, 'Mid', 'identity rides the median-final sample');
  for (const L of ['A', 'B', 'C', 'D', 'E', 'F']) assert.equal(folded.blocks[L].score, 4);
  assert.throws(() => medianScoring([]), /no usable scoring samples/);
  // Deterministic fold: order permutation gives the same numbers.
  const perm = medianScoring([c, a, b]);
  assert.equal(perm.score, folded.score);
  assert.deepEqual(
    Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => [L, perm.blocks[L].score])),
    Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => [L, folded.blocks[L].score])),
  );
});

test('CAR-239 pure helper: providerAcceptsSeed truth table', () => {
  for (const m of ['anthropic', 'gemini', 'manual', null, undefined]) {
    assert.equal(providerAcceptsSeed(m), false, `${m} does not take a seed`);
  }
  for (const m of ['hermes', 'openai', 'deepseek', 'ollama', 'qwen', 'glm', 'kimi']) {
    assert.equal(providerAcceptsSeed(m), true, `${m} (OpenAI-compatible) takes a seed`);
  }
});

// ── CAR-245 — render depth guard + the server-side JD archive ──────────────

test('CAR-245: a render body under the 2500-char floor fires the depth warning; a deep body does not', async () => {
  // THIN — the one-line fixture (~1.1 k chars) is exactly the v1.268.0 shape
  // the analysis doc blamed: warning, never a rejection.
  setAnswers(twoShapeAnswers({ scoring: scoringFixture({ score: 3.6 }), body: renderBodyFixture({}) }));
  const thin = await runTwoStepEvaluation(JD_R, 'en', { today: '2026-11-05' });
  assert.ok(thin.warnings.includes('report depth below target — blocks too thin'),
    `depth warning must fire on a thin body: ${thin.warnings.join(' | ')}`);
  // The warning rides the same channel the UI/API already surface (warnings array).
  assert.equal(thin.fallbackUsed, false, 'the thin run is still a complete A–G run — warn only');

  // DEEP — at/above the floor the warning must NOT fire.
  setAnswers(twoShapeAnswers({ scoring: scoringFixture({ score: 3.6 }), body: longBody() }));
  const deep = await runTwoStepEvaluation(JD_R, 'en', { today: '2026-11-05' });
  assert.ok(!deep.warnings.some((w) => /blocks too thin/.test(w)),
    `no depth warning at target depth: ${deep.warnings.join(' | ')}`);
});

test('CAR-245: the fallback body (structurally thin) also warns — but never rejects', async () => {
  setAnswers((prompt) => {
    if (prompt.includes('Output ONLY a JSON object')) return JSON.stringify(scoringFixture({ score: 3.0 }));
    return { __stubError: true };
  });
  const r = await runTwoStepEvaluation(JD_R, 'en', { today: '2026-11-05' });
  assert.equal(r.fallbackUsed, true);
  assert.ok(r.warnings.some((w) => /server fallback body used/.test(w)));
  assert.ok(r.warnings.includes('report depth below target — blocks too thin'),
    'the fallback body is thin by construction — the depth warning is honest about it');
  // The archive still lands on the degraded report: the JD is server knowledge.
  assert.match(r.markdown, /## Job Description \(archived verbatim\)\n\n/);
});

test('CAR-245: the archived JD is the SANITIZED input JD, byte-faithful, bounded at 60k', async () => {
  setAnswers(twoShapeAnswers({ scoring: scoringFixture({ score: 3.6 }), body: longBody() }));
  const marker = 'CAR245-UNIQUE-MARKER quantum flux capacitor duties. '.repeat(2);
  const r = await runTwoStepEvaluation(marker + 'Go, Kubernetes.', 'en', { today: '2026-11-05' });
  const at = r.markdown.indexOf('## Job Description (archived verbatim)');
  assert.ok(at !== -1);
  const archived = r.markdown.slice(at + '## Job Description (archived verbatim)\n\n'.length);
  assert.ok(archived.startsWith('CAR245-UNIQUE-MARKER'), 'the JD rides verbatim from the first byte');
  assert.ok(archived.includes('Go, Kubernetes.'), 'the whole JD is in the section');
  // The section is the tail of the report.
  assert.ok(r.markdown.trimEnd().endsWith('Go, Kubernetes.'));
});

// ── CAR-245 — route level: the auto-pipeline SAVED report carries the archive
// (the parent's check-jd-archive.mjs contract, #2789). ──────────────────────

test('CAR-245: /api/auto-pipeline saves a report whose file carries the JD-verbatim archive', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dns = (await import('node:dns')).promises;
  const realLookup = dns.lookup;
  const { _setTransport } = await import('../server/lib/safe-fetch.mjs');
  const { createApp } = await import('../server/index.mjs');

  const page = '<html><body><div class="tgme_widget_message_text js-message_text" dir="auto">'
    + '<p>Senior Platform Engineer в платформенной команде. Компания : ArchiveCo</p><br>'
    + 'Полностью удалённо, Европа. Опыт Go от 4 лет, Kubernetes, Postgres, Prometheus, on-call. '
    + 'CAR245-ARCHIVE-MARKER unique posting sentence for the saved-file assertion. '
    + 'Оформление по контракту, опционы, ежегодные бонусы, обучение за счёт компании. Пишите в личку.</div></body></html>';
  const restoreLookup = () => { dns.lookup = realLookup; };
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  const restoreTransport = _setTransport(async () => ({
    status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(page),
  }));
  setAnswers(twoShapeAnswers({ scoring: scoringFixture({ company: 'ArchiveCo', role: 'Senior Platform Engineer', score: 4 }), body: longBody() }));
  const appServer = await new Promise((r) => { const s = createApp().listen(0, '127.0.0.1', () => r(s)); });
  try {
    const res = await fetch(`http://127.0.0.1:${appServer.address().port}/api/auto-pipeline`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://t.me/jobsfeed/245' }),
    });
    const text = await res.text();
    const events = text.split('\n\n').filter(Boolean).map((b) => ({
      event: (b.match(/^event: (.+)$/m) || [])[1],
      data: JSON.parse((b.match(/^data: (.+)$/m) || [, 'null'])[1]),
    }));
    const done = events.find((e) => e.event === 'done');
    assert.ok(done, `the pipeline completes: ${JSON.stringify(events.map((e) => [e.event, e.data?.message || e.data?.detail || ''])).slice(-400)}`);

    // THE saved file — the artifact the parent's check-jd-archive.mjs reads —
    // carries the archive with the posting text, even though the route's save
    // path strips the SCORE_SUMMARY machine block.
    const reports = readdirSync(resolve(rootDir, 'reports'));
    assert.equal(reports.length, 1, `exactly one report saved: ${reports.join(', ')}`);
    const saved = readFileSync(resolve(rootDir, 'reports', reports[0]), 'utf8');
    assert.match(saved, /^# Evaluation: ArchiveCo — Senior Platform Engineer$/m);
    assert.match(saved, /```yaml\n[\s\S]*?\n```\n\n## Job Description \(archived verbatim\)\n\n/);
    assert.ok(saved.includes('CAR245-ARCHIVE-MARKER'), 'the posting text is archived in the saved file');
    assert.ok(!saved.includes('---SCORE_SUMMARY---'), 'the summary block stays stripped from the saved file');
    // The archive is the file's tail — the JD closes the report.
    assert.ok(saved.trimEnd().includes('CAR245-ARCHIVE-MARKER unique posting sentence'));
  } finally {
    restoreTransport();
    restoreLookup();
    appServer.closeAllConnections?.();
    await new Promise((r) => appServer.close(r));
  }
});
