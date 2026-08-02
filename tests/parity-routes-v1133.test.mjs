/**
 * v1.133.0 parent-parity relays — two read-only shell-outs to new parent
 * career-ops scripts:
 *   • GET /api/interview/weekly-digest → weekly-digest.mjs (#2129/#2130,
 *     zero-LLM interview-session roll-up; JSON stdout, optional --from/--to)
 *   • GET /api/company-funded         → company-funded.mjs (#2117,
 *     funded-company discovery; JSON stdout via --json, no writes via --dry-run)
 *
 * CI-isolated: bootstraps a mkdtemp CAREER_OPS_ROOT and writes FAKE parent
 * scripts into it, so the shell-out contract is tested without the real parent
 * and without any network. paths.mjs carriers load via dynamic import() AFTER
 * the env is set (the paths-once eager-import rule).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let server, baseUrl, root;

// A good fake weekly-digest.mjs: reflects the --from/--to it was handed (so we
// can prove arg threading) and emits the parent's real result shape.
const WEEKLY_OK = `
const a = process.argv.slice(2);
const fi = a.indexOf('--from'), ti = a.indexOf('--to');
const from = fi !== -1 ? a[fi + 1] : 'DEFAULT-from';
const to = ti !== -1 ? a[ti + 1] : 'DEFAULT-to';
console.log(JSON.stringify({
  metadata: { range: { from, to }, sessionsDirFound: true, questionBankFound: false,
    totalSessionsFound: 3, sessionsInRange: 2, companiesInRange: 2 },
  companies: [
    { company: 'Acme', role: 'ML Engineer', rounds: ['phone', 'onsite'] },
    { company: 'Globex', role: 'Data Scientist', rounds: ['phone'] },
  ],
  competencyTagCounts: [{ tag: 'system-design', count: 3 }],
  recurringCompetencies: [{ tag: 'system-design', count: 3 }],
  recurringGaps: [],
}));`;

// A good fake company-funded.mjs: writes a marker ONLY when NOT --dry-run
// (the relay must pass --dry-run, so the marker must NEVER appear), and emits
// JSON only when --json is present (the relay must pass --json). The result
// shape mirrors the REAL parent output verbatim (top-level `companies`, each
// { company, amount, round, funding: { status, confidence, sources:
// [{ source, title, url, observed_date, date_precision }] }, discovery_score,
// suggested_action } + generated_at/window_months/sort/dry_run/diagnostics) —
// the v1.133.1 fix: the first cut assumed a `candidates` key that the parent
// never emits, so the #/funded table always rendered empty.
const FUNDED_OK = `
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const a = process.argv.slice(2);
const dry = a.includes('--dry-run');
const json = a.includes('--json');
const rootDir = dirname(fileURLToPath(import.meta.url));
if (!dry) writeFileSync(join(rootDir, 'FUNDED_ARTIFACT_MARKER.json'), '{}');
const result = {
  generated_at: '2026-08-02',
  window_months: 3,
  sort: 'date',
  dry_run: dry,
  sources: ['techcrunch', 'prnewswire', 'guardian', 'hn'],
  diagnostics: [
    { source: 'techcrunch', status: 'ok', fetched_items: 40, funding_like_items: 12, candidate_count: 1, blocked: false, errors: [] },
    { source: 'prnewswire', status: 'ok', fetched_items: 20, funding_like_items: 0, candidate_count: 0, blocked: false, errors: [] },
  ],
  companies: [{
    company: 'NovaAI', amount: '$30M', round: 'Series B',
    funding: { status: 'recent_funding', confidence: 'high', sources: [
      { source: 'techcrunch', title: 'NovaAI raises $30M Series B', url: 'https://techcrunch.com/novaai', observed_date: '2026-07-28', date_precision: 'day' },
    ] },
    discovery_score: 80, suggested_action: 'review_company_manually',
  }],
};
if (json) console.log(JSON.stringify(result));`;

// A failing fake (overwrites FUNDED_OK mid-test): exits non-zero with stderr.
const FUNDED_ERR = `
console.error('boom in company-funded at ' + import.meta.url);
process.exit(1);`;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'parity133-root-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  writeFileSync(join(root, 'weekly-digest.mjs'), WEEKLY_OK);
  writeFileSync(join(root, 'company-funded.mjs'), FUNDED_OK);
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

test('GET /api/interview/weekly-digest relays the weekly-digest.mjs JSON (default range)', async () => {
  const r = await fetch(baseUrl + '/api/interview/weekly-digest');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.metadata.sessionsInRange, 2);
  assert.equal(d.metadata.companiesInRange, 2);
  assert.equal(d.companies.length, 2);
  assert.equal(d.companies[0].company, 'Acme');
  assert.equal(d.recurringCompetencies[0].tag, 'system-design');
  // No range passed → the script's default range placeholders come back.
  assert.equal(d.metadata.range.from, 'DEFAULT-from');
});

test('weekly-digest threads --from/--to only when BOTH are valid YYYY-MM-DD', async () => {
  // Both valid → threaded.
  const both = await (await fetch(baseUrl + '/api/interview/weekly-digest?from=2026-07-13&to=2026-07-19')).json();
  assert.equal(both.metadata.range.from, '2026-07-13');
  assert.equal(both.metadata.range.to, '2026-07-19');
  // Only one supplied → NOT threaded (falls through to the script default).
  const partial = await (await fetch(baseUrl + '/api/interview/weekly-digest?from=2026-07-13')).json();
  assert.equal(partial.metadata.range.from, 'DEFAULT-from');
  // Malformed date → NOT threaded.
  const bad = await (await fetch(baseUrl + '/api/interview/weekly-digest?from=2026-7-1&to=2026-07-19')).json();
  assert.equal(bad.metadata.range.from, 'DEFAULT-from');
});

test('GET /api/company-funded relays the company-funded.mjs JSON (parent `companies` shape)', async () => {
  const r = await fetch(baseUrl + '/api/company-funded');
  const d = await r.json();
  assert.equal(d.available, true);
  // The parent emits the ranked list under `companies` (NOT `candidates`) —
  // the v1.133.1 regression guard for the #/funded empty-table bug.
  assert.ok(Array.isArray(d.companies), 'result must carry a `companies` array');
  assert.equal(d.companies.length, 1);
  assert.equal(d.companies[0].company, 'NovaAI');
  assert.equal(d.companies[0].round, 'Series B');
  assert.equal(d.companies[0].amount, '$30M');
  // The evidence link + source + date the #/funded view renders come from
  // funding.sources[0] — assert the exact path the client reads.
  assert.equal(d.companies[0].funding.sources[0].url, 'https://techcrunch.com/novaai');
  assert.equal(d.companies[0].funding.sources[0].source, 'techcrunch');
  assert.equal(d.companies[0].funding.sources[0].observed_date, '2026-07-28');
  assert.equal(d.sources.length, 4);
  assert.equal(d.diagnostics[0].status, 'ok');
});

test('company-funded relay is read-only — passes --dry-run so no artifact is written', async () => {
  // The GET above (and this one) must have run the script with --dry-run, so
  // the fake never wrote its marker file into the project root.
  await (await fetch(baseUrl + '/api/company-funded')).json();
  assert.equal(existsSync(join(root, 'FUNDED_ARTIFACT_MARKER.json')), false,
    'relay must pass --dry-run: the discovery script must not persist any artifact');
});

test('company-funded relay fails soft when the script errors', async () => {
  // Overwrite the fake with a non-zero-exit version; the script re-executes
  // on the next request, so no app restart is needed.
  writeFileSync(join(root, 'company-funded.mjs'), FUNDED_ERR);
  const d = await (await fetch(baseUrl + '/api/company-funded')).json();
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-error');
  assert.equal(typeof d.detail, 'string');
  // Restore the good script for isolation from any later test.
  writeFileSync(join(root, 'company-funded.mjs'), FUNDED_OK);
});

test('#/funded view reads the parent `companies` field, not `candidates` (v1.133.1 regression guard)', () => {
  // The view is browser-only, so this is a source-static canary: the first cut
  // read `res.candidates`, a key the parent never emits, so the table was always
  // empty. Lock the correct field access at the client layer too.
  const src = readFileSync(fileURLToPath(new URL('../public/js/views/funded.js', import.meta.url)), 'utf8');
  assert.match(src, /res\.companies/, 'funded.js must read res.companies (the parent output key)');
  assert.doesNotMatch(src, /res\.candidates/, 'funded.js must NOT read res.candidates — the parent never emits it');
  assert.match(src, /funding\.sources/, 'funded.js must read the evidence link/source/date via funding.sources[0]');
  // UI.el(tag, attrs, children) takes children as ONE param (a node or an
  // array) — passing table cells as varargs renders only the first column.
  // The v1.133.1 second fix: rows MUST pass their cells as an array.
  assert.match(src, /c\('tr',\s*\{\},\s*\[/, "funded.js table rows must pass cells as an array — c('tr', {}, [ … ]) — not varargs");
});
