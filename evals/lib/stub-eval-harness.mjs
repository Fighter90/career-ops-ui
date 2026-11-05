/**
 * stub-eval-harness.mjs — the offline harness shared by the two evaluate
 * determinism graders (CAR-239): evals/evaluate-locale-parity and
 * evals/evaluate-repeatability.
 *
 * The harness runs the REAL two-step evaluate (server/lib/eval-two-step.mjs)
 * against a deterministic STUB provider on 127.0.0.1:0 in a mkdtemp
 * CAREER_OPS_ROOT — the same CI-isolation shape the unit suites use. The
 * stub's scoring answer is derived from sha256(jd), so the same JD always
 * produces the same integer sub-scores: a determinism gate run against a
 * non-deterministic stub would prove nothing.
 *
 * `--live` mode is deliberately NOT part of this module: each grader owns
 * its live leg (post-deploy, against a configured PROD_URL) and keeps the
 * offline path dependency-free.
 */

import { createHash } from 'node:crypto';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const SCORING_MARKER = 'Output ONLY a JSON object';
const RENDER_MARKER = 'SCORING JSON (canonical';
const BLOCKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** All 19 UI locales — the same canonical list the i18n gates use. */
export const LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];

/** The synthetic probe JD (≥50 chars — the /api/evaluate floor). */
export const PROBE_JD = [
  'Senior Platform Engineer (m/f/d) — Remote EU.',
  'We are ExampleCorp, a series-B infrastructure company.',
  'You will own our Kubernetes platform: multi-cluster Go services,',
  'on-call rotation, Terraform, observability stack.',
  'Requirements: 5+ years Go, deep Kubernetes, SRE mindset.',
  'Compensation: €85,000–110,000 per year plus equity.',
  'Process: intro call, take-home, system design, team interview.',
].join(' ');

/**
 * The DETERMINISTIC stub scoring: integer sub-scores selected from the JD's
 * own hash bytes — byte-stable for the same JD, no randomness anywhere.
 */
function stubScoring(jd) {
  const h = createHash('sha256').update(String(jd ?? '')).digest();
  const blocks = Object.fromEntries(BLOCKS.map((L, i) => [L, { score: 1 + (h[i] % 5), summary: `Block ${L}: stub judgement, anchored.` }]));
  return {
    company: 'ExampleCorp', role: 'Senior Platform Engineer', archetype: 'Platform',
    legitimacy: 'High Confidence', score: 4.2, // the model total — IGNORED by the server
    blocks,
  };
}

const stubRender = () => BLOCKS.map((L) => `## ${L}) Section\nStub prose for block ${L}: evidence grounded in the documents.`).join('\n\n');

/**
 * Spin up the stub + temp root, import the real two-step evaluate, run
 * `body` with a `run(jd, lang)` helper, then restore everything.
 * @returns {Promise<{ run: (jd: string, lang: string) => Promise<{score: number, markdown: string, scoring: object, stages: string[]}> }>}
 */
export async function withStubEval(body) {
  const calls = { scoring: 0, render: 0 };
  const stub = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      let content = '';
      try {
        const b = JSON.parse(raw);
        const prompt = b.messages.map((m) => m.content).join('\n');
        if (prompt.includes(SCORING_MARKER)) { calls.scoring += 1; content = JSON.stringify(stubScoring(extractJd(prompt))); }
        else if (prompt.includes(RENDER_MARKER)) { calls.render += 1; content = stubRender(); }
      } catch { content = ''; }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    });
  });
  await new Promise((r) => stub.listen(0, '127.0.0.1', r));

  const dir = mkdtempSync(resolve(tmpdir(), 'eval-grader-'));
  for (const d of ['config', 'data', 'modes', 'reports', 'jds']) mkdirSync(resolve(dir, d), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\nGo, Kubernetes, 6 years, platform engineering.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Grader\n  target_roles:\n    - Platform Engineer\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  for (const m of ['_shared', 'oferta']) writeFileSync(resolve(dir, 'modes', `${m}.md`), `# ${m}\n`);

  const savedEnv = { root: process.env.CAREER_OPS_ROOT, provider: process.env.LLM_PROVIDER, key: process.env.HERMES_API_KEY, base: process.env.HERMES_BASE_URL };
  process.env.CAREER_OPS_ROOT = dir;
  process.env.LLM_PROVIDER = 'hermes';
  process.env.HERMES_API_KEY = 'stub-key-123456';
  process.env.HERMES_BASE_URL = `http://127.0.0.1:${stub.address().port}/v1`;

  const { runTwoStepEvaluation } = await import('../../server/lib/eval-two-step.mjs');
  const run = async (jd, lang) => {
    const stages = [];
    const r = await runTwoStepEvaluation(jd, lang, { onStage: (s) => stages.push(s) });
    const m = String(r.markdown).match(/\*\*Score:\*\* ([\d.]+)\/5/);
    if (!m) throw new Error(`no score line in the report (${lang})`);
    return { score: Number(m[1]), markdown: r.markdown, scoring: r.scoring, stages, warnings: r.warnings };
  };

  try {
    return await body({ run, calls, root: dir });
  } finally {
    if (savedEnv.root === undefined) delete process.env.CAREER_OPS_ROOT; else process.env.CAREER_OPS_ROOT = savedEnv.root;
    if (savedEnv.provider === undefined) delete process.env.LLM_PROVIDER; else process.env.LLM_PROVIDER = savedEnv.provider;
    if (savedEnv.key === undefined) delete process.env.HERMES_API_KEY; else process.env.HERMES_API_KEY = savedEnv.key;
    if (savedEnv.base === undefined) delete process.env.HERMES_BASE_URL; else process.env.HERMES_BASE_URL = savedEnv.base;
    await new Promise((r) => stub.close(r));
  }
}

/** The probe JD as sent inside the prompt (between the untrustedJd fences). */
function extractJd(prompt) {
  const m = String(prompt).match(/<untrustedJd-[0-9a-f]+>\n([\s\S]*?)\n<\/untrustedJd>/);
  return m ? m[1] : '';
}

export const spread = (xs) => Math.max(...xs) - Math.min(...xs);
export const round1 = (x) => Math.round(x * 10) / 10;
