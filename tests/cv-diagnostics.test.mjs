/**
 * cv-diagnostics.js + cv-privacy.js — deterministic CV Studio libs (v1.92.0).
 * Loaded in a synthetic window (same pattern as fit-score.test.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/cv-diagnostics.js'), 'utf8'))(w); // eslint-disable-line no-new-func
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/cv-privacy.js'), 'utf8'))(w);      // eslint-disable-line no-new-func
const Diag = w.CvDiagnostics;
const Priv = w.CvPrivacy;

const STRONG_CV = `# Jane Public
jane@example.com · +1 (415) 555-0100

## Summary
Senior Backend Engineer.

## Experience
- Built a payments service that cut checkout latency 40%.
- Shipped 3 microservices handling 12k req/s.

## Education
- BSc Computer Science, MIT.

## Skills
Go, PostgreSQL, Kubernetes.
`;

const WEAK_CV = `# John Doe
## Experience
- Responsible for the backend.
- Worked on various features.
- Helped the team as a results-driven team player and self-starter.
`;

test('analyze surfaces score + all checks', () => {
  const r = Diag.analyze(STRONG_CV);
  assert.equal(typeof r.score, 'number');
  assert.ok(r.score > 60, `strong CV should score well, got ${r.score}`);
  const ids = r.checks.map((c) => c.id).sort();
  assert.deepEqual(ids, ['buzzwords', 'contact', 'length', 'quantified', 'sections', 'weakVerbs']);
  assert.equal(r.checks.find((c) => c.id === 'quantified').status, 'pass');
  assert.equal(r.checks.find((c) => c.id === 'contact').status, 'pass');
});

test('weak CV is flagged: weak verbs fail, buzzwords + low quantified', () => {
  const r = Diag.analyze(WEAK_CV);
  assert.ok(r.score < 60, `weak CV should score low, got ${r.score}`);
  assert.equal(r.checks.find((c) => c.id === 'weakVerbs').status, 'fail');
  assert.notEqual(r.checks.find((c) => c.id === 'buzzwords').status, 'pass');
  assert.equal(r.checks.find((c) => c.id === 'quantified').status, 'fail');
});

test('empty CV → length fail, score 0-ish', () => {
  const r = Diag.analyze('');
  assert.equal(r.words, 0);
  assert.equal(r.checks.find((c) => c.id === 'length').status, 'fail');
  assert.ok(r.score < 40);
});

test('analyze is null-safe', () => {
  assert.equal(Diag.analyze(null).words, 0);
  assert.equal(Diag.analyze(undefined).score >= 0, true);
});

test('privacy mask redacts email, phone, links; counts them', () => {
  const { markdown, counts } = Priv.mask(STRONG_CV);
  assert.doesNotMatch(markdown, /jane@example\.com/);
  assert.ok(counts.email >= 1);
  assert.ok(counts.phone >= 1);
  assert.doesNotMatch(markdown, /415.*555.*0100/);
});

test('name masking → initials, only when opted in with a name', () => {
  const off = Priv.mask(STRONG_CV);
  assert.match(off.markdown, /Jane Public/);        // name kept by default
  const on = Priv.mask(STRONG_CV, { name: 'Jane Public' });
  assert.doesNotMatch(on.markdown, /Jane Public/);
  assert.match(on.markdown, /J\.P\./);
  assert.equal(on.counts.name >= 1, true);
});

test('mask respects toggles + is null-safe', () => {
  const keepEmail = Priv.mask('reach me at a@b.co', { email: false });
  assert.match(keepEmail.markdown, /a@b\.co/);
  assert.equal(Priv.mask(null).markdown, '');
});

test('short numeric runs (years) are not masked as phones', () => {
  const { markdown } = Priv.mask('Worked 2019 to 2023 on v2.0', { phone: true, email: false, links: false, address: false });
  assert.match(markdown, /2019/);
  assert.match(markdown, /2023/);
});

test('date-like runs (year ranges, ISO dates) are not masked as phones', () => {
  const opts = { phone: true, email: false, links: false, address: false };
  // Hyphenated year range — 8 digits, would pass the ≥7 guard without the date check.
  assert.match(Priv.mask('Acme Corp 2018-2022 — Staff Engineer', opts).markdown, /2018-2022/);
  // ISO date in a "last updated" line.
  assert.match(Priv.mask('Résumé updated 2026-07-04', opts).markdown, /2026-07-04/);
  // A genuine phone number is still redacted.
  const phone = Priv.mask('Call +1 (415) 555-0100 anytime', opts);
  assert.doesNotMatch(phone.markdown, /555-0100/);
  assert.ok(phone.counts.phone >= 1);
});

test('address redaction requires an address boundary, not mid-prose job titles', () => {
  const opts = { address: true, phone: false, email: false, links: false, name: false };
  // A real address (comma boundary) is redacted.
  const real = Priv.mask('Home: 123 Main St, Springfield', opts);
  assert.doesNotMatch(real.markdown, /123 Main St/);
  assert.equal(real.counts.address, 1);
  // A job-title fragment that merely ends in a street-like token mid-sentence is NOT redacted.
  const prose = Priv.mask('3 Full Stack Dev St building scalable services', opts);
  assert.match(prose.markdown, /Full Stack Dev St/);
  assert.equal(prose.counts.address, 0);
});
