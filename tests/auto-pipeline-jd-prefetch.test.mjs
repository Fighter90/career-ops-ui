/**
 * CAR-262 (parent-sync #8, upstream #6604 + #6798) — the auto-pipeline JD
 * prefetch + the Cloudflare-challenge refusal.
 *
 * Two upstream failures this suite pins:
 *
 * 1. (#6604) A template-driven career site keeps the whole JD in a schema.org
 *    JobPosting inside <script> while the visible HTML is ~a hundred characters
 *    of chrome. The route's tag-strip drops script content, so the entry died
 *    at the 200-char JD floor BEFORE the LLM call. The fix: on a short visible
 *    extraction, read the page's OWN JSON-LD/embedded payloads (offline parse
 *    of the already-downloaded HTML) — a live posting evaluates instead of
 *    bouncing; a posting the page itself calls closed (JSON-LD validThrough in
 *    the past) is refused with the closure evidence.
 *
 * 2. (#6798) A Cloudflare challenge/block page is REFUSED, never emitted as
 *    the JD. The parent's jd mode refused interstitial TITLES on an HTTP
 *    error; web-ui's static GET cannot pass a challenge at all, so a 200 page
 *    under an interstitial title is the wall itself — its ~800-char body would
 *    otherwise clear the 200-char floor and reach the model.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, page fetch via _setTransport + a DNS
 * stub, provider HTTP mocked on globalThis.fetch, 127.0.0.1 only.
 */
import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promises as dns } from 'node:dns';
import {
  twoShapeAnswers, scoringFixture, renderBodyFixture, promptFromOpenAiBody,
} from './helpers/eval-two-step-stub.mjs';

const KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY',
  'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER', 'HUGGINGFACE_API_KEY'];
const OAI = 'sk-fakeopenai0123456789abcdefghijklmn';
const PIPE_URL = 'https://careers.example.com/job/2044';
const savedEnv = {};
let server; let baseUrl; let ROOT; let restoreTransport = null;
const realFetch = globalThis.fetch;
const realLookup = dns.lookup;

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'auto-pipe-prefetch-'));
  for (const d of ['config', 'data', 'modes', 'output', 'reports']) mkdirSync(resolve(ROOT, d), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n\nSenior backend engineer, 10 years.\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '# Applications Tracker\n');
  // The queue entry markPipelineRejected() moves on a rejection.
  writeFileSync(resolve(ROOT, 'data', 'pipeline.md'), `# Pipeline\n\n\`\`\`\n${PIPE_URL}\n\`\`\`\n`);
  writeFileSync(resolve(ROOT, 'modes', 'oferta.md'), '# Oferta\n');
  writeFileSync(resolve(ROOT, 'modes', '_shared.md'), '# Shared\n');
  for (const k of KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  savedEnv.LLM_RATE_LIMIT = process.env.LLM_RATE_LIMIT;
  process.env.LLM_RATE_LIMIT = '1000/60s';
  process.env.CAREER_OPS_ROOT = ROOT;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(async () => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  if (restoreTransport) restoreTransport();
  for (const k of [...KEYS, 'LLM_RATE_LIMIT']) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
  delete process.env.CAREER_OPS_ROOT;
  await new Promise((r) => server.close(r));
  try { rmSync(ROOT, { recursive: true, force: true }); } catch {}
});

beforeEach(() => {
  globalThis.fetch = realFetch;
  for (const f of readdirSync(resolve(ROOT, 'reports'))) rmSync(resolve(ROOT, 'reports', f));
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '# Applications Tracker\n');
});

afterEach(() => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  if (restoreTransport) { restoreTransport(); restoreTransport = null; }
  delete process.env.OPENAI_API_KEY;
});

let providerCalls;

/**
 * Serve `page` for ANY posting URL; count + answer the provider calls.
 */
async function run(body, page, { status = 200, provider = null } = {}) {
  const answer = typeof provider === 'function' ? provider : () => provider;
  const { _setTransport: set } = await import('../server/lib/safe-fetch.mjs');
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  restoreTransport = set(async () => ({ status, headers: { 'content-type': 'text/html' }, body: Buffer.from(page) }));
  providerCalls = 0;
  globalThis.fetch = async (u, o = {}) => {
    const host = (() => { try { return new URL(String(u)).hostname; } catch { return ''; } })();
    if (host === 'api.openai.com') {
      providerCalls += 1;
      const content = answer(promptFromOpenAiBody(o?.body)) ?? '';
      return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(u, o);
  };
  process.env.OPENAI_API_KEY = OAI;
  const resp = await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  const events = text.split('\n\n').filter(Boolean).map((b) => ({
    event: (b.match(/^event: (.+)$/m) || [])[1],
    data: JSON.parse((b.match(/^data: (.+)$/m) || [, 'null'])[1]),
  }));
  return { status: resp.status, events, text };
}

const RU_TITLES = { A: 'Контекст', B: 'Соответствие', C: 'Риски', D: 'Зарплата', E: 'Вопросы работодателю', F: 'Легитимность', G: 'Рекомендация' };
const twoStep = () => twoShapeAnswers({
  scoring: scoringFixture({ company: 'Robert Half', role: 'Senior Platform Engineer', score: 4, archetype: 'platform' }),
  body: renderBodyFixture({ titles: RU_TITLES, line: 'Текст анализа блока: опыт кандидата соответствует требованиям позиции.' }),
});

// A Phenom-like page: the visible HTML is a loading shell (the stripped text is
// far below the 200-char floor) and the whole JD lives in one ld+json block.
const DESCRIPTION = 'Own the Kubernetes platform, the CI/CD pipelines and the observability stack across AWS and Terraform. '
  + 'You will partner with product teams on reliability targets, lead incident reviews and grow the platform team. '
  + 'Requirements: deep Go and Linux experience, production SRE on-call history, and a bias for automation. '
  + 'Benefits: competitive salary, learning budget and hybrid work from our Amsterdam hub.'.repeat(3);
const POSTING = {
  '@context': 'https://schema.org', '@type': 'JobPosting',
  title: 'Senior Platform Engineer',
  description: DESCRIPTION,
  hiringOrganization: { name: 'Robert Half' },
  employmentType: 'FULL_TIME',
  jobLocation: { address: { addressLocality: 'Amsterdam', addressRegion: 'NH', addressCountry: 'NL' } },
};
const chromePage = (ldJson) => `<!doctype html><html><head><title>Senior Platform Engineer</title></head>`
  + `<body><div id="app"><span>Loading…</span><nav>Jobs Teams Life About</nav></div>`
  + `<script type="application/ld+json">${ldJson}</script></body></html>`;

// A site-branded Cloudflare interstitial: >200 chars of body so the old code
// passed it through the JD floor (the #6713 shape: 838 chars, "Humans only").
const CF_TITLE = 'Just a moment...';
const cfBody = (status) => `<!doctype html><html><head><title>${CF_TITLE}</title></head>`
  + `<body><div class="cf-browser-verification"><h1>Humans only</h1><p>Checking your browser before accessing this site. `
  + `This process is automatic. Ray ID: 8f3a91c2d4b5e6f7 · Performance and security by Cloudflare. </p>`
  + `${'Please stand by, while we are checking your browser. Please turn JavaScript on and reload the page. '.repeat(12)}`
  + `<span>HTTP ${status} — challenge required</span></div></body></html>`;

test('a JSON-LD-only page is rescued BEFORE the LLM call — evaluation proceeds, report + tracker row written', async () => {
  const out = await run({ url: PIPE_URL }, chromePage(JSON.stringify(POSTING)), { provider: twoStep() });
  const err = out.events.find((e) => e.event === 'error');
  assert.ok(!err, `no fetch-stage rejection — got: ${err ? err.data.message : '(none)'}`);
  assert.ok(out.events.some((e) => e.event === 'done'), 'the run completes');
  const reports = readdirSync(resolve(ROOT, 'reports'));
  assert.equal(reports.length, 1, 'one report written');
  const md = readFileSync(resolve(ROOT, 'reports', reports[0]), 'utf8');
  assert.match(md, /# Evaluation: Robert Half — Senior Platform Engineer/);
  const apps = readFileSync(resolve(ROOT, 'data', 'applications.md'), 'utf8');
  assert.ok(apps.includes(`${'careers.example.com'}/job/2044`), 'a tracker row was added for the rescued posting');
});

test('a posting the page calls closed (JSON-LD validThrough past) is refused with closure evidence and marked rejected', async () => {
  const closed = JSON.stringify({ ...POSTING, validThrough: '2020-01-01' });
  const out = await run({ url: PIPE_URL }, chromePage(closed), { provider: twoStep() });
  const err = out.events.find((e) => e.event === 'error');
  assert.ok(err, 'expected an SSE error event');
  assert.equal(err.data.step, 'fetch');
  assert.match(err.data.message, /closed/i, `the closure is named — got: ${err.data.message}`);
  assert.equal(providerCalls, 0, 'a closed posting costs no LLM tokens');
  const pipeline = readFileSync(resolve(ROOT, 'data', 'pipeline.md'), 'utf8');
  assert.match(pipeline, /## Rejected/, 'the pipeline entry left the queue');
  assert.ok(pipeline.split(/[\s|]/).includes(PIPE_URL), 'the pipeline carries the posting URL');
});

test('a 403 Cloudflare interstitial is refused as bot_challenge — the challenge body never becomes the JD', async () => {
  const out = await run({ url: PIPE_URL }, cfBody(403), { status: 403, provider: twoStep() });
  const err = out.events.find((e) => e.event === 'error');
  assert.ok(err);
  assert.equal(err.data.step, 'fetch');
  assert.match(err.data.message, /cloudflare|bot_challenge/i, `the interstitial is named — got: ${err.data.message}`);
  assert.equal(providerCalls, 0);
  assert.deepEqual(readdirSync(resolve(ROOT, 'reports')), [], 'no report for a challenge page');
});

test('a 200-served Cloudflare interstitial is refused — a static GET cannot pass the wall', async () => {
  const out = await run({ url: PIPE_URL }, cfBody(200), { status: 200, provider: twoStep() });
  const err = out.events.find((e) => e.event === 'error');
  assert.ok(err);
  assert.equal(err.data.step, 'fetch', `refused at fetch — got step ${err ? err.data.step : '(no error)'}: ${err ? err.data.message : ''}`);
  assert.match(err.data.message, /cloudflare|bot_challenge/i);
  assert.equal(providerCalls, 0, 'the ~800-char challenge body must not reach the model');
  assert.deepEqual(readdirSync(resolve(ROOT, 'reports')), []);
});

test('control: a real-size VISIBLE JD still evaluates — the new gates do not over-block', async () => {
  const visible = `<!doctype html><html><head><title>Real</title></head><body><article>`
    + `${'We are looking for a Senior Platform Engineer to own our Kubernetes platform. You will design CI/CD pipelines, run AWS infrastructure with Terraform and improve observability. '.repeat(4)}`
    + `</article></body></html>`;
  const out = await run({ url: PIPE_URL }, visible, { provider: twoStep() });
  const err = out.events.find((e) => e.event === 'error');
  assert.ok(!err, `a normal page must evaluate — got: ${err ? `${err.data.step}: ${err.data.message}` : '(none)'}`);
  assert.ok(out.events.some((e) => e.event === 'done'));
});

test('control: a challenge-TITLED page that is actually a real posting under its own site still evaluates', async () => {
  const real = `<!doctype html><html><head><title>Senior Platform Engineer at Acme</title></head><body><article>`
    + `${'We are looking for a Senior Platform Engineer to own our Kubernetes platform. You will design CI/CD pipelines, run AWS infrastructure with Terraform and improve observability. '.repeat(4)}`
    + `</article></body></html>`;
  const out = await run({ url: PIPE_URL }, real, { provider: twoStep() });
  const err = out.events.find((e) => e.event === 'error');
  assert.ok(!err, 'a posting under its own title is never refused');
});
