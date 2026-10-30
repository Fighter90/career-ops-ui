/**
 * #4746 — batch cost confirmation + usage recording.
 *
 * The batch run is the app's most expensive operation: N real LLM
 * evaluations through the parent's batch-runner.sh workers. Two gaps:
 *   1. none of that spend reached data/llm-usage.jsonl (the Usage page was
 *      blind to it) — the route now parses the parent's aggregate-tokens.mjs
 *      tail (=== Aggregated Token Breakdown === … total: 64.7k tokens ($X))
 *      out of the streamed stdout and records ONE usage record per run
 *      under the 'batch' provider tag, carrying the parent-computed cost
 *      estimate when present (CAR-106 shape);
 *   2. no spend confirmation — the view now shows UI.confirm with a cost
 *      estimate for every run of N ≥ 2 rows (single row keeps the old
 *      path; --dry-run makes zero model calls so the estimate premise is
 *      false and the gate is skipped there).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT (with cv.md), a fake batch-runner.sh
 * inside the temp root, 127.0.0.1, no network. The view's pure halves
 * (countBatchRows / estimateBatchCost) are driven in a vm; the confirm gate
 * is a source-static structural check (weak by design — TRACEABILITY rule 2).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(resolve(REPO, ...p), 'utf8');
const BATCH = read('public', 'js', 'views', 'batch.js');

const COST_KEYS = ['batch.cost.confirmTitle', 'batch.cost.confirmBody', 'batch.cost.confirmOk', 'batch.cost.usdUnknown'];

// The behavioral half spawns a bash fake runner (same shape as llm-batch-kill).
const posix = process.platform !== 'win32';

// ─── server: usage recording in the batch path (behavioral) ───

let server; let baseUrl; let ROOT;

const RUNNER_WITH_SUMMARY = [
  '#!/bin/bash',
  'echo started',
  'cat <<\'AGGEOF\'',
  '=== Aggregated Token Breakdown ===',
  '  scan:           12.3k prompt / 1.2k completion',
  '  evaluation:     45.6k prompt / 5.6k completion (cached: 40.0k)',
  '  pdf payload:    (zero-token by design)',
  '  total:          64.7k tokens ($0.1234)',
  'AGGEOF',
  'exit 0',
  '',
].join('\n');

const RUNNER_PLAIN = ['#!/bin/bash', 'echo started', 'echo plain output, no token summary', 'exit 0', ''].join('\n');

function writeRunner(text) {
  const runner = resolve(ROOT, 'batch', 'batch-runner.sh');
  writeFileSync(runner, text);
  chmodSync(runner, 0o755);
}

/** Open the SSE stream and resolve once the done event has arrived. */
async function runToDone() {
  const res = await fetch(`${baseUrl}/api/stream/batch`);
  const text = await res.text();
  assert.match(text, /event: done/, 'the run reached its done event');
  return text;
}

const usageLines = () => {
  try {
    return readFileSync(resolve(ROOT, 'data', 'llm-usage.jsonl'), 'utf8').split('\n').filter(Boolean);
  } catch { return []; }
};

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'batch-cost-confirm-'));
  mkdirSync(resolve(ROOT, 'batch'), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeRunner(RUNNER_WITH_SUMMARY);
  process.env.CAREER_OPS_ROOT = ROOT;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(async () => {
  delete process.env.CAREER_OPS_ROOT;
  await new Promise((r) => server.close(r));
  try { rmSync(ROOT, { recursive: true, force: true }); } catch { /* temp cleanup */ }
});

test('#4746: a batch run with an aggregate-tokens tail records ONE usage record (batch provider, parent cost)', { skip: !posix }, async () => {
  await runToDone();
  const lines = usageLines();
  assert.equal(lines.length, 1, `exactly one usage record, got ${lines.length}`);
  const rec = JSON.parse(lines[0]);
  assert.equal(rec.provider, 'batch');
  assert.equal(rec.in, 12300 + 45600, 'prompt tokens summed across step lines (12.3k + 45.6k)');
  assert.equal(rec.out, 1200 + 5600, 'completion tokens summed across step lines (1.2k + 5.6k)');
  assert.equal(rec.cost, 0.1234, 'the parent-computed cost estimate rides the record (CAR-106 shape)');
  assert.ok(typeof rec.ts === 'number');
});

test('#4746: a run without an aggregate-tokens tail records nothing', { skip: !posix }, async () => {
  writeRunner(RUNNER_PLAIN);
  await runToDone();
  assert.equal(usageLines().length, 1, 'still the single record from the previous run');
});

// ─── client: pure estimate halves (vm-driven) ───

/** Load batch.js in a vm with view stubs; module-scope function declarations
 *  become context globals (same harness as car124-empty-states). */
function loadBatchModule() {
  const ctx = {
    URL,
    window: { addEventListener() {} },
    Router: { register() {} },
    API: {}, UI: {},
    I18n: { t: (k, f) => f },
    HelpHint: { title() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(BATCH, ctx, { filename: 'batch.js' });
  return ctx;
}

test('#4746: countBatchRows mirrors the server parseTsv (blank + # comment lines skipped)', () => {
  const { countBatchRows } = loadBatchModule();
  assert.equal(countBatchRows('# id\turl\tsource\tnotes\n1\thttps://a.com\t\n2\thttps://b.com\t\n'), 2);
  assert.equal(countBatchRows('\n\n   \n#comment\n'), 0);
  assert.equal(countBatchRows(''), 0);
  assert.equal(countBatchRows('1\thttps://a.com'), 1);
});

test('#4746: estimateBatchCost folds usage history into a per-evaluation average', () => {
  const { estimateBatchCost } = loadBatchModule();
  // history: 3 calls averaging 40k in / 5k out; anthropic-ish prices
  const est = estimateBatchCost(10, { in: 120000, out: 15000, calls: 3 }, { in: 3.0, out: 15.0 });
  assert.equal(est.n, 10);
  assert.equal(est.tokensPerEval, 45000, '(120k+15k)/3 = 45k tokens per evaluation');
  // 10 × (40000×3 + 5000×15) / 1e6 = 10 × (0.12 + 0.075) = 1.95
  assert.ok(Math.abs(est.usd - 1.95) < 1e-9, `usd from the real in/out split, got ${est.usd}`);
});

test('#4746: estimateBatchCost falls back to 8000 tokens and a blended price without history', () => {
  const { estimateBatchCost } = loadBatchModule();
  const est = estimateBatchCost(2, null, { in: 2.0, out: 6.0 });
  assert.equal(est.tokensPerEval, 8000, 'the documented no-history fallback');
  // 2 × 8000 × (2+6)/2 / 1e6 = 0.064
  assert.ok(Math.abs(est.usd - 0.064) < 1e-9, `blended-rate estimate, got ${est.usd}`);
});

test('#4746: estimateBatchCost returns usd=null when no price row exists', () => {
  const { estimateBatchCost } = loadBatchModule();
  assert.equal(estimateBatchCost(5, { in: 9000, out: 1000, calls: 1 }, null).usd, null);
  assert.equal(estimateBatchCost(5, null, null).usd, null);
});

// ─── client: the confirm gate (source-static, weak by design) ───

test('#4746: runRunner gates every N≥2 run behind UI.confirm BEFORE the stream starts', () => {
  const start = BATCH.indexOf('async function runRunner(');
  const streamAt = BATCH.indexOf("API.stream('/api/stream/batch");
  assert.ok(start > -1 && streamAt > start, 'runRunner exists and starts the batch stream');
  const runBody = BATCH.slice(start, streamAt);
  assert.match(runBody, /countBatchRows\(/, 'the row count comes from the editor content');
  assert.match(runBody, /rows >= 2/, 'the gate fires for every multi-row run');
  assert.match(runBody, /await UI\.confirm\(/, 'the confirm is awaited before the stream opens');
  assert.match(runBody, /batch\.cost\.confirmTitle/, 'the confirm title is localized');
  assert.match(runBody, /batch\.cost\.confirmBody/, 'the confirm body is localized');
  assert.match(runBody, /if \(!ok\) return/, 'a declined confirm aborts the run');
});

test('#4746: the estimate reads the usage history and the active provider, fail-soft', () => {
  assert.match(BATCH, /API\.get\('\/api\/usage'\)/, 'usage history endpoint');
  assert.match(BATCH, /API\.get\('\/api\/status\/providers'\)/, 'active provider endpoint');
  assert.match(BATCH, /try \{[\s\S]*?Promise\.all\(\[[\s\S]*?\/api\/status\/providers/, 'the fetches sit in a try — estimate failure must not block the run');
});

// ─── i18n: batch.cost.* in all 19 locales + non-empty ───

test('#4746: batch.cost.* keys exist in ALL 19 locale dicts, non-empty, with placeholders kept', () => {
  const dict = JSON.parse(JSON.stringify(loadAssembledDict()));
  for (const lang of I18N_LANGS) {
    for (const key of COST_KEYS) {
      const v = (dict[key] || {})[lang];
      assert.ok(typeof v === 'string' && v.trim(), `${key} missing/empty in ${lang}`);
    }
    assert.ok(dict['batch.cost.confirmBody'][lang].includes('{n}')
      && dict['batch.cost.confirmBody'][lang].includes('{usd}')
      && dict['batch.cost.confirmBody'][lang].includes('{provider}'),
    `${lang} confirmBody lost a placeholder`);
  }
});
