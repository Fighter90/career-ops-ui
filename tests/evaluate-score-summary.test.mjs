/**
 * The machine-surface contract (v1.268.0, CAR-229/102) — the successor of the
 * v1.238.2 score-summary suite. The OLD single-shot contract asked the model
 * to write the whole localized report including the ---SCORE_SUMMARY--- block
 * and hoped the machine surface survived translation (prod 2026-11-04: the
 * yaml block existed in only 8 of 17 locales; de/uk lost the header). The
 * TWO-STEP contract makes that impossible by construction: the scoring step
 * returns a canonical EN JSON, the render step writes only the seven A–G
 * sections, and the SERVER assembles the header, the ---SCORE_SUMMARY--- and
 * the ```yaml machine block for every locale.
 *
 * /api/evaluate runs through a stub OpenAI-compatible provider (Hermes) here.
 * Assertions:
 *   · the render prompt carries the verbatim scoring JSON (the render step is
 *     elaboration, not re-judgement);
 *   · a Spanish evaluation's done payload carries the SAME machine surface
 *     en gets (header + **Score:** line + ```yaml block, `blocks:` map);
 *   · the display markdown strips ---SCORE_SUMMARY--- (saved-file contract);
 *   · no warnings for a well-formed run.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { twoShapeAnswers, scoringFixture, isScoringCall, RENDER_MARKER } from './helpers/eval-two-step-stub.mjs';

let createApp, stub, lastPrompt = '', lastMaxTokens = 0, lastRenderPrompt = '';
let currentAnswers = null; // tests swap fixtures via setAnswers()
const ES_BODY = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => `## ${L}) Sección\nEl candidato cumple los requisitos del puesto: su experiencia en la plataforma es relevante, y el equipo valora el conocimiento de Kubernetes y Go para este rol.`).join('\n\n');

before(async () => {
  stub = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        const b = JSON.parse(body);
        lastPrompt = b.messages.map((m) => m.content).join('\n');
        lastMaxTokens = b.max_tokens;
        if (!isScoringCall(lastPrompt)) lastRenderPrompt = lastPrompt;
      } catch { lastPrompt = ''; }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: currentAnswers(lastPrompt) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
    });
  });
  await new Promise((r) => stub.listen(0, '127.0.0.1', r));

  const dir = mkdtempSync(resolve(tmpdir(), 'eval-summary-'));
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
  ({ createApp } = await import('../server/index.mjs'));
  currentAnswers = twoShapeAnswers({ scoring: scoringFixture({ company: 'Acme', role: 'Ingeniera', score: 4.1 }), body: ES_BODY });
});

function setAnswers(v) { currentAnswers = v; }

after(() => {
  for (const k of ['CAREER_OPS_ROOT', 'LLM_PROVIDER', 'HERMES_API_KEY', 'HERMES_BASE_URL']) delete process.env[k];
  stub?.close();
});

async function drainEvaluate(lang = 'es') {
  const server = await new Promise((r) => { const s = createApp().listen(0, '127.0.0.1', () => r(s)); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': lang, accept: 'text/event-stream' },
      body: JSON.stringify({ jd: 'Senior Platform Engineer at Acme. Kubernetes, Go, on-call. '.repeat(3), save: false }),
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    const events = [];
    for (const frame of text.split('\n\n')) {
      const ev = (frame.match(/^event:\s*(.+)$/m) || [])[1];
      const data = (frame.match(/^data:\s*([\s\S]+)$/m) || [])[1];
      if (ev) events.push({ ev, data: data ? JSON.parse(data) : {} });
    }
    return events;
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
}

test('the render prompt carries the verbatim scoring JSON and the locale directive sits in the volatile tail', async () => {
  setAnswers(twoShapeAnswers({ scoring: scoringFixture({ company: 'Acme', role: 'Ingeniera', score: 4.1 }), body: ES_BODY }));
  const events = await drainEvaluate('es');
  const done = events.find((e) => e.ev === 'done').data;
  assert.ok(done, `no done frame: ${JSON.stringify(events.map((e) => e.ev))}`);
  assert.ok(lastRenderPrompt.includes(RENDER_MARKER), 'the render call is recognizable');
  assert.match(lastRenderPrompt, /"Ingeniera"/, 'the render prompt carries the scoring JSON verbatim');
  assert.match(lastRenderPrompt, /Target language: Spanish\./);
  assert.equal(lastMaxTokens, 16384);
});

test('a Spanish evaluation carries the SAME machine surface en does (CAR-102)', async () => {
  const events = await drainEvaluate('es');
  const done = events.find((e) => e.ev === 'done').data;
  assert.equal(done.mode, 'hermes');
  assert.equal(done.warnings, undefined, `unexpected warnings: ${JSON.stringify(done.warnings)}`);
  // The display markdown strips ---SCORE_SUMMARY--- but KEEPS the yaml
  // machine block and the server-written header.
  assert.doesNotMatch(done.markdown, /SCORE_SUMMARY|END_SUMMARY/);
  assert.match(done.markdown, /^# Evaluation: Acme — Ingeniera/m);
  // CAR-239: the fixture carries INTEGER sub-scores (solver: A=5, B–F=4 for
  // the 4.2 grid point); the pins assert the achieved score 4.2.
  assert.match(done.markdown, /\*\*Score:\*\* 4\.2\/5/);
  assert.match(done.markdown, /```yaml\ncompany: Acme\nrole: Ingeniera\nscore: 4\.2\nstatus: Evaluated\n/);
  assert.match(done.markdown, /blocks: \{A: 5, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4\}/);
  assert.match(done.markdown, /## A\) Sección/);
});
