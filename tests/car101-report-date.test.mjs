/**
 * CAR-101 — the report's **Date:** header is server-side knowledge, never
 * the model's. 349 of 789 prod reports carry a model-invented 2026-01-xx
 * date: the header template bundled from modes/oferta.md says
 * `**Date:** {YYYY-MM-DD}` and the model fills a recalled date.
 *
 * The fix has two halves, both locked here:
 *   - prompts.mjs states today explicitly (`Today is <date>`, injectable
 *     opts.today like CAR-110) and pins the **Date:** field to EXACTLY
 *     that value; the deep prompt's freshness anchor gains the same pin.
 *   - eval-validate.mjs::fixReportDate rewrites a drifted or placeholder
 *     **Date:** line to today at the save/validate site (auto-pipeline
 *     save, /api/evaluate + /api/deep responses) — a correction with a
 *     warning, never a rejection.
 *
 * CI-isolated: CAREER_OPS_ROOT → mkdtemp (cv.md present) before import;
 * provider HTTP mocked at the host boundary; JD fetch via the safe-fetch
 * transport + a DNS stub; server bound to 127.0.0.1. No network.
 */
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promises as dns } from 'node:dns';

let P; let fixReportDate; let routeToday;
let server; let baseUrl; let ROOT; let restoreTransport = null;
const realFetch = globalThis.fetch;
const realLookup = dns.lookup;
const ENV_KEYS = ['CAREER_OPS_ROOT', 'LLM_PROVIDER', 'ANTHROPIC_API_KEY'];
const ANT = 'sk-ant-fake0123456789abcdefghijklmnop';
const saved = {};

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'car101-report-date-'));
  for (const d of ['config', 'data', 'modes', 'reports', 'output', 'interview-prep']) {
    mkdirSync(resolve(ROOT, d), { recursive: true });
  }
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\nSenior backend engineer.\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '');
  for (const m of ['_shared', 'oferta', 'deep']) writeFileSync(resolve(ROOT, 'modes', `${m}.md`), `# ${m}\n`);
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  process.env.CAREER_OPS_ROOT = ROOT;
  P = await import('../server/lib/prompts.mjs');
  ({ fixReportDate } = await import('../server/lib/eval-validate.mjs'));
  ({ today: routeToday } = await import('../server/lib/parsers.mjs'));
  const { createApp } = await import('../server/index.mjs');
  await new Promise((r) => { server = createApp().listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

afterEach(() => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  if (restoreTransport) { restoreTransport(); restoreTransport = null; }
});

after(async () => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
  await new Promise((r) => server.closeAllConnections?.() ?? r());
  await new Promise((r) => server.close(r));
  try { rmSync(ROOT, { recursive: true, force: true }); } catch { /* temp dir */ }
});

// ── Prompt side ─────────────────────────────────────────────────────────────

test('CAR-101: the evaluation prompt states today and pins the **Date:** field (injected)', () => {
  const p = P.buildEvaluationPrompt('Senior Platform Engineer at Acme. Kubernetes, Go, on-call. '.repeat(3), 'en', { today: '2026-03-01' });
  assert.match(p, /Today is 2026-03-01/);
  assert.match(p, /\*\*Date:\*\* field MUST be exactly 2026-03-01/);
  assert.match(p, /never any other date/);
});

test('CAR-101: the live evaluation prompt carries the server date by default', () => {
  const p = P.buildEvaluationPrompt('Senior Platform Engineer at Acme. Kubernetes, Go. '.repeat(3), 'en');
  assert.match(p, /Today is \d{4}-\d{2}-\d{2}/);
});

test('CAR-101: the pinned date rides the cacheable stable part; stable+volatile stays byte-identical', () => {
  const normalizeTag = (s) => s.replace(/JD-[0-9a-f]{12}/g, 'JD-TAG');
  const jd = 'Senior Platform Engineer at Acme. Kubernetes, Go, on-call rotation. '.repeat(3);
  const { stable, volatile } = P.buildEvaluationPromptParts(jd, 'en');
  assert.match(stable, /Today is \d{4}-\d{2}-\d{2}/, 'the date is part of the cacheable prefix');
  assert.equal(normalizeTag(stable + volatile), normalizeTag(P.buildEvaluationPrompt(jd, 'en')), 'CAR-111 split invariant holds');
});

test('CAR-101: the deep prompt pins any Date field to the injected today (CAR-110 anchor extended)', () => {
  const p = P.buildDeepPrompt('Acme', '', 'en', { today: '2026-03-01' });
  assert.match(p, /today's date is 2026-03-01/, 'CAR-110 freshness anchor untouched');
  assert.match(p, /exactly 2026-03-01/, 'the Date-field pin is present');
  assert.match(p, /never any other date/);
});

// ── fixReportDate (the belt-and-braces normalizer) ──────────────────────────

test('CAR-101: an invented header date is rewritten to today', () => {
  const input = '# Evaluation: Acme — Engineer\n\n**Date:** 2026-01-15\n**URL:** https://jobs.acme.example/42\n';
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 1);
  assert.ok(r.text.includes('**Date:** 2026-10-25'));
  assert.ok(!r.text.includes('2026-01-15'));
});

test('CAR-101: a correct date passes through byte-identical', () => {
  const input = '# Evaluation: Acme — Engineer\n\n**Date:** 2026-10-25\n**URL:** https://jobs.acme.example/42\n';
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 0);
  assert.equal(r.text, input);
});

test('CAR-101: the {YYYY-MM-DD} placeholder echo and a bare label are rewritten too', () => {
  const r1 = fixReportDate('**Date:** {YYYY-MM-DD}\n', '2026-03-01');
  assert.equal(r1.replaced, 1);
  assert.ok(r1.text.includes('**Date:** 2026-03-01'));
  const r2 = fixReportDate('Date: 2026-01-15\n', '2026-03-01');
  assert.equal(r2.replaced, 1);
  assert.ok(r2.text.includes('Date: 2026-03-01'));
});

test('CAR-101: prose mentioning a date or the template never matches', () => {
  const prose = 'The **Date:** field of the template is {YYYY-MM-DD}; posted 2026-01-15 online.\n';
  const r = fixReportDate(prose, '2026-03-01');
  assert.equal(r.replaced, 0);
  assert.equal(r.text, prose);
});

// CAR-144 r5 — preamble-only scoping: the correction applies to the text
// before the FIRST `## ` heading and nothing else. A report that OPENS
// with an H2 (a model-written H2 title, or no title at all) has an empty
// preamble — not this pipeline's generated shape (the prompt pins
// `# Evaluation: …` / `# Deep Brief…` H1s) — and gets a conservative
// no-op: a stale date is acceptable, a fabricated one is not. Within the
// preamble the selection rule is: unique candidate, else unique bold
// `**Date:**`, else no-op — a second REAL date survives, and the only
// change in the output is that one header date, proven by full-output
// equality (guarded: the fixture must contain the invented date exactly
// once): any stray rewrite anywhere fails the test.
test('CAR-144: a bulleted Date: line inside a block body is never rewritten; the header date still is', () => {
  const input = [
    '# Evaluation: Acme — Engineer',
    '',
    '**Date:** 2026-01-15',
    '**URL:** https://jobs.acme.example/42',
    '',
    '## Block F — Posting legitimacy',
    'The listing was first posted on the board:',
    '- Date: 2025-11-02',
    '- Source: employer careers page',
    '',
    '## Block G — Verdict',
    'Posted:',
    'Date: 2024-02-03',
    '',
    'Apply.',
  ].join('\n');
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 1, 'exactly one line — the header date — is corrected');
  assert.equal(input.split('2026-01-15').length, 2, 'fixture: the invented date appears exactly once');
  assert.equal(
    r.text,
    input.replace('2026-01-15', '2026-10-25'),
    'full-output equality: the header date is the ONLY change — no stray rewrite anywhere',
  );
});

// CAR-144 r4 — an H2 opening line means an EMPTY preamble (the boundary is
// the first `## ` line itself): conservative no-op, byte-identical.
// Deliberate reversal of the r2/r3 positive expectation — the H2-title
// branch was the whack-a-mole; the prompt pins H1 titles, so this shape is
// not ours to correct.
test('CAR-144 r4: a report that opens with an ## title is a conservative no-op', () => {
  const input = [
    '## Evaluation: Acme — Engineer',
    '**Date:** 2026-01-15',
    '**URL:** https://jobs.acme.example/42',
    '',
    '## Block A — x',
    '- Date: 2025-11-02',
  ].join('\n');
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 0, 'empty preamble — nothing may be rewritten');
  assert.equal(r.text, input, 'byte-identical');
});

// CAR-144 r4 — a title-less report opening with a block heading: empty
// preamble, conservative no-op — bulleted or not, nothing is rewritten.
test('CAR-144 r4: a title-less report opening with a block heading is never touched', () => {
  const input = [
    '## Block A — x',
    '- Date: 2025-11-02',
    '## Block B — y',
    'Body text.',
  ].join('\n');
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 0, 'no header exists — nothing may be rewritten');
  assert.equal(r.text, input, 'byte-identical');
});

// CAR-144 r4 — the r3 bullet-stop could not save a NON-bulleted Date line
// after a block heading (it became "header"); the preamble rule does.
test('CAR-144 r4: a plain Date: body line after an opening block heading is never touched', () => {
  const input = [
    '## Block A — x',
    'Date: 2024-02-03',
    '## Block B — y',
    'Body text.',
  ].join('\n');
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 0, 'empty preamble — nothing may be rewritten');
  assert.equal(r.text, input, 'byte-identical');
});

// CAR-144 r4 — a title-only H2 followed by more headings: empty preamble.
test('CAR-144 r4: a title-only H2 followed by more headings is never touched', () => {
  const input = [
    '## Evaluation: X',
    '## Block A',
    '- Date: 2025-11-02',
  ].join('\n');
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 0, 'no header fields exist — nothing may be rewritten');
  assert.equal(r.text, input, 'byte-identical');
});

// CAR-144 r4 — ambiguity rule, preference: a preamble holding a plain AND
// a bold Date candidate corrects the BOLD one (the report header's own
// label shape) and the plain real date survives.
test('CAR-144 r4: with a plain and a bold Date candidate, the bold one is corrected', () => {
  const input = [
    '# Evaluation: Acme — Engineer',
    '',
    'Date: 2025-06-01',
    '**Date:** 2026-01-15',
    '**URL:** https://jobs.acme.example/42',
    '',
    '## Block A — x',
    '- Date: 2024-01-01',
  ].join('\n');
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 1, 'the bold header label is the correction target');
  assert.equal(input.split('2026-01-15').length, 2, 'fixture: the invented date appears exactly once');
  assert.equal(
    r.text,
    input.replace('2026-01-15', '2026-10-25'),
    'full-output equality: the bold date is corrected, the plain one survives',
  );
});

// CAR-144 r4 — ambiguity rule, no-op: TWO bold **Date:** candidates in the
// preamble cannot be disambiguated — rewrite none.
test('CAR-144 r4: two bold Date candidates in the preamble are an ambiguity no-op', () => {
  const input = [
    '# Evaluation: Acme — Engineer',
    '',
    '**Date:** 2026-01-15',
    '**Date:** 2025-06-01',
    '**URL:** https://jobs.acme.example/42',
    '',
    '## Block A — x',
  ].join('\n');
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 0, 'two bold candidates are ambiguous — rewrite none');
  assert.equal(r.text, input, 'byte-identical');
});

// CAR-144 r4 — first-match-only + bold preference: a second REAL date in
// the preamble (a posting date, an as-of date) SURVIVES; the bold header
// label is the one corrected.
test('CAR-144 r4: only the bold header Date is corrected; a second real date survives', () => {
  const input = [
    '# Evaluation: Acme — Engineer',
    '',
    '**Date:** 2026-01-15',
    'Date: 2025-06-01',
    '**URL:** https://jobs.acme.example/42',
    '',
    '## Block A — x',
    '- Date: 2024-01-01',
  ].join('\n');
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 1, 'exactly the bold header Date line is corrected');
  assert.equal(input.split('2026-01-15').length, 2, 'fixture: the invented date appears exactly once');
  assert.equal(
    r.text,
    input.replace('2026-01-15', '2026-10-25'),
    'full-output equality: the bold date is corrected, the plain one and the body bullet survive',
  );
});

// CAR-144 r5 — deliberate, pinned: two PLAIN candidates have no bold to
// prefer, which is ambiguous → rewrite none, byte-identical.
test('CAR-144 r5: two plain Date candidates in the preamble are an ambiguity no-op', () => {
  const input = [
    '# Evaluation: Acme — Engineer',
    '',
    'Date: 2026-01-15',
    'Date: 2025-06-01',
    '**URL:** https://jobs.acme.example/42',
    '',
    '## Block A — x',
  ].join('\n');
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 0, 'no bold to prefer — ambiguous, rewrite none');
  assert.equal(r.text, input, 'byte-identical');
});

// CAR-144 r5 — accepted asymmetry, pinned: a LONE plain Date: line in the
// preamble IS rewritten (there is nothing to prefer against it — it IS
// the header field), while a plain line NEXT TO a bold one is protected
// as the real date. Chosen over a bulletless/after-H1 restriction.
test('CAR-144 r5: a lone plain Date line in the preamble is still corrected', () => {
  const input = '# Evaluation: Acme — Engineer\n\nDate: 2026-01-15\n**URL:** https://jobs.acme.example/42\n';
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 1, 'the lone plain candidate is the header field — corrected');
  assert.equal(input.split('2026-01-15').length, 2, 'fixture: the invented date appears exactly once');
  assert.equal(r.text, input.replace('2026-01-15', '2026-10-25'), 'full-output equality');
});

// CAR-144 r5 — bulleted-bold alignment: `- **Date:** …` matches
// REPORT_DATE_LINE, so BOLD_DATE_LINE must accept the optional list
// marker too — otherwise a bulleted-bold next to any other Date yields
// zero bold candidates and nothing is corrected.
test('CAR-144 r5: a bulleted-bold Date candidate is preferred over a plain one', () => {
  const input = [
    '# Evaluation: Acme — Engineer',
    '',
    '- **Date:** 2026-01-15',
    'Date: 2025-06-01',
    '**URL:** https://jobs.acme.example/42',
    '',
    '## Block A — x',
  ].join('\n');
  const r = fixReportDate(input, '2026-10-25');
  assert.equal(r.replaced, 1, 'the bulleted-bold header label is the correction target');
  assert.equal(input.split('2026-01-15').length, 2, 'fixture: the invented date appears exactly once');
  assert.equal(
    r.text,
    input.replace('2026-01-15', '2026-10-25'),
    'full-output equality: the bulleted-bold date is corrected, the plain one survives',
  );
});

test('CAR-101: an invalid today argument falls back to the server date', () => {
  const r = fixReportDate('**Date:** 2026-01-15\n', 'not-a-date');
  assert.equal(r.replaced, 1);
  assert.match(r.text, /\*\*Date:\*\* \d{4}-\d{2}-\d{2}/);
});

// ── Route level: /api/evaluate (Anthropic path) ─────────────────────────────

const GOOD_BLOCKS = (dateLine) => [
  '# Evaluation: Acme — Platform Engineer',
  '',
  `**Date:** ${dateLine}`,
  '**URL:** https://jobs.example.com/acme/42',
  '',
  ...['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => `## Block ${L} — x\nok\n`),
  '---SCORE_SUMMARY---',
  'COMPANY: Acme',
  'ROLE: Platform Engineer',
  'SCORE: 4.2',
  'ARCHETYPE: Platform',
  'LEGITIMACY: High Confidence',
  '---END_SUMMARY---',
  '',
].join('\n');

const JD = 'Senior Platform Engineer at Acme. Kubernetes, Go, on-call rotation, platform tooling. '.repeat(3);

test('CAR-101: /api/evaluate corrects an invented header date server-side, with a warning', async () => {
  process.env.LLM_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = ANT;
  const TODAY = routeToday();
  globalThis.fetch = async (u, o = {}) => {
    if (new URL(String(u)).host === 'api.anthropic.com') {
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: GOOD_BLOCKS('2026-01-15') }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(u, o);
  };
  const res = await fetch(`${baseUrl}/api/evaluate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jd: JD }),
  });
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.match(b.markdown, new RegExp(`\\*\\*Date:\\*\\* ${TODAY}`), 'the saved/returned markdown carries today');
  assert.ok(!b.markdown.includes('2026-01-15'));
  assert.ok((b.warnings || []).some((w) => w.includes('**Date:**')), JSON.stringify(b.warnings));
});

test('CAR-101: /api/evaluate passes a correct date through byte-identical, no warning', async () => {
  process.env.LLM_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = ANT;
  const TODAY = routeToday();
  globalThis.fetch = async (u, o = {}) => {
    if (new URL(String(u)).host === 'api.anthropic.com') {
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: GOOD_BLOCKS(TODAY) }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(u, o);
  };
  const res = await fetch(`${baseUrl}/api/evaluate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jd: JD }),
  });
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.match(b.markdown, new RegExp(`\\*\\*Date:\\*\\* ${TODAY}`));
  assert.ok(!(b.warnings || []).some((w) => w.includes('**Date:**')), JSON.stringify(b.warnings));
});

// ── Route level: /api/auto-pipeline save path ────────────────────────────────

const JOB_URL = 'https://jobs.example.com/acme/42';
const JOB_HTML = '<html><body><h1>Platform Engineer at Acme</h1><p>' + 'We build distributed systems in Go. '.repeat(10) + '</p></body></html>';

async function stubJobPage() {
  const { _setTransport } = await import('../server/lib/safe-fetch.mjs');
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  restoreTransport = _setTransport(async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(JOB_HTML) }));
}

const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
const sseEvents = (text) => text.split('\n\n').filter(Boolean).map((b) => ({
  event: (b.match(/^event: (.+)$/m) || [])[1],
  data: JSON.parse((b.match(/^data: (.+)$/m) || [, 'null'])[1]),
}));

async function runPipeline(reportDateLine) {
  process.env.ANTHROPIC_API_KEY = ANT;
  process.env.LLM_PROVIDER = 'anthropic';
  await stubJobPage();
  globalThis.fetch = async (u, o = {}) => {
    if (new URL(String(u)).host === 'api.anthropic.com') {
      return json({
        content: [{ type: 'text', text: GOOD_BLOCKS(reportDateLine) }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    }
    return realFetch(u, o);
  };
  const r = await fetch(`${baseUrl}/api/auto-pipeline`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: JOB_URL }),
  });
  return sseEvents(await r.text());
}

test('CAR-101: the auto-pipeline saves the report with today in the header, never an invented date', async () => {
  const TODAY = routeToday();
  rmSync(resolve(ROOT, 'reports'), { recursive: true, force: true });
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  const ev = await runPipeline('2026-01-15');
  const done = ev.find((e) => e.event === 'done');
  assert.ok(done, `the run completes: ${JSON.stringify(ev.map((e) => e.event))}`);
  const savedFile = resolve(ROOT, 'reports', `${done.data.slug}.md`);
  assert.ok(existsSync(savedFile), 'report written');
  const md = readFileSync(savedFile, 'utf8');
  assert.match(md, new RegExp(`\\*\\*Date:\\*\\* ${TODAY}`), 'the saved header carries today');
  assert.ok(!md.includes('2026-01-15'));
  assert.ok((done.data.warnings || []).some((w) => w.includes('**Date:**')), JSON.stringify(done.data.warnings));
});

test('CAR-101: the auto-pipeline saves a correct date untouched and stays silent', async () => {
  const TODAY = routeToday();
  rmSync(resolve(ROOT, 'reports'), { recursive: true, force: true });
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  const ev = await runPipeline(TODAY);
  const done = ev.find((e) => e.event === 'done');
  assert.ok(done, `the run completes: ${JSON.stringify(ev.map((e) => e.event))}`);
  const md = readFileSync(resolve(ROOT, 'reports', `${done.data.slug}.md`), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Date:\\*\\* ${TODAY}`));
  assert.ok(!(done.data.warnings || []).some((w) => w.includes('**Date:**')), JSON.stringify(done.data.warnings));
});
