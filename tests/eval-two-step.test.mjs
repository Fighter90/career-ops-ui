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
import { twoShapeAnswers, scoringFixture, renderBodyFixture } from './helpers/eval-two-step-stub.mjs';

let runTwoStepEvaluation, stub, lastPrompt = '';
let setAnswers = (v) => { current = v; };
let current = twoShapeAnswers({ scoring: scoringFixture(), body: renderBodyFixture({}) });

before(async () => {
  stub = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { const b = JSON.parse(body); lastPrompt = b.messages.map((m) => m.content).join('\n'); } catch { lastPrompt = ''; }
      const content = current(lastPrompt);
      if (content && content.__stubError) {
        res.statusCode = 503;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: { message: 'overloaded' } }));
        return;
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    });
  });
  await new Promise((r) => stub.listen(0, '127.0.0.1', r));
  const dir = mkdtempSync(resolve(tmpdir(), 'eval-two-step-'));
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
  ({ runTwoStepEvaluation } = await import('../server/lib/eval-two-step.mjs'));
});

after(() => {
  for (const k of ['CAREER_OPS_ROOT', 'LLM_PROVIDER', 'HERMES_API_KEY', 'HERMES_BASE_URL']) delete process.env[k];
  stub?.close();
});

test('the happy two-step run: complete machine surface, aggregated usage, stages fired', async () => {
  setAnswers(twoShapeAnswers({ scoring: scoringFixture({ company: 'Acme', role: 'Engineer', score: 4.1 }), body: renderBodyFixture({}) }));
  const stages = [];
  const r = await runTwoStepEvaluation('Senior Platform Engineer at Acme. Kubernetes, Go, on-call. '.repeat(3), 'en', {
    url: 'https://jobs.example/1',
    today: '2026-11-05',
    onStage: (name) => stages.push(name),
  });
  assert.deepEqual(stages, ['scoring', 'rendering', 'assembling', 'done']);
  assert.match(r.markdown, /^# Evaluation: Acme — Engineer/m);
  assert.match(r.markdown, /\*\*Score:\*\* 4\.1\/5/);
  assert.match(r.markdown, /```yaml/);
  assert.equal(r.usage.in, 20, 'two calls × 10 prompt tokens');
  assert.equal(r.usage.out, 10, 'two calls × 5 completion tokens');
  assert.equal(r.steps, 2);
  assert.equal(r.fallbackUsed, false);
  assert.deepEqual(r.warnings, []);
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
