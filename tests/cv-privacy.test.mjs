/**
 * CAR-18 / client-libs-1 [M] — cv-privacy.js masking gaps (v1.243.0).
 *
 * Three leaks/mangles in the pre-fix regexes:
 *   1. `URL_RE` only matched `https?://` or `www.` — a bare
 *      `linkedin.com/in/jane-doe` (the most common CV link form) sailed
 *      through unmasked.
 *   2. Name masking was case-SENSITIVE: an ALL-CAPS "JANE Q. PUBLIC" in the
 *      CV never matched opts.name "Jane Q. Public".
 *   3. PHONE_RE ate EU dotted dates — "12.03.2021" has 8 digits, passed the
 *      ≥7-digit guard, and matched neither the year-range nor ISO guards →
 *      became ████.
 *
 * Loaded in a synthetic window (same pattern as tests/countries.test.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
// eslint-disable-next-line no-new-func
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/cv-privacy.js'), 'utf8'))(w);
const mask = (md, opts) => w.CvPrivacy.mask(md, opts);

// ── 1. bare profile URLs ─────────────────────────────────────────────────

test('bare linkedin.com/in/… is masked like its https:// form', () => {
  const r = mask('Find me at linkedin.com/in/jane-doe for more.', {});
  assert.ok(!/linkedin\.com\/in\/jane-doe/.test(r.markdown), `bare profile link leaked: ${r.markdown}`);
  assert.ok(r.counts.links >= 1);
});

test('bare github/gitlab/x.com profile paths are masked; ordinary prose is not', () => {
  const r = mask('Code: github.com/janedoe · gitlab.com/janedoe · x.com/janedoe · Portfolio under construction since 2021', {});
  assert.ok(!/github\.com\/janedoe/.test(r.markdown));
  assert.ok(!/gitlab\.com\/janedoe/.test(r.markdown));
  assert.ok(!/x\.com\/janedoe/.test(r.markdown));
  // "under construction since 2021" must survive — only known profile hosts
  assert.match(r.markdown, /under construction since 2021/);
});

test('the schemeful forms still mask (regression guard)', () => {
  const r = mask('https://www.linkedin.com/in/jane-doe and www.github.com/janedoe', {});
  assert.ok(!/linkedin\.com\/in\/jane-doe/.test(r.markdown));
  assert.ok(!/github\.com\/janedoe/.test(r.markdown));
});

// ── 2. ALL-CAPS names ────────────────────────────────────────────────────

test('name masking is case-insensitive: ALL-CAPS CV spelling still matches', () => {
  const r = mask('JANE Q. PUBLIC\nSenior Engineer', { name: 'Jane Q. Public' });
  assert.match(r.markdown, /^J\.Q\.P\./, `ALL-CAPS name leaked: ${r.markdown}`);
  assert.equal(r.counts.name, 1);
});

test('name masking still handles exact-case and lowercase spellings', () => {
  const exact = mask('Contact Jane Q. Public anytime', { name: 'Jane Q. Public' });
  assert.ok(!/Jane Q\. Public/.test(exact.markdown) && exact.counts.name === 1);
  const lower = mask('signed: jane q. public', { name: 'Jane Q. Public' });
  assert.ok(!/jane q\. public/i.test(lower.markdown.replace(/J\.Q\.P\./g, '')), 'lowercase spelling leaked');
});

test('diacritic names match across cases too', () => {
  const r = mask('Best, MÜLLER María', { name: 'Müller María' });
  assert.ok(!/M[Üü]LLER/.test(r.markdown.replace(/M\./g, '')), `diacritic ALL-CAPS leaked: ${r.markdown}`);
  assert.equal(r.counts.name, 1);
});

// ── 3. EU dates ──────────────────────────────────────────────────────────

test('EU dotted dates are NOT mangled into phone blocks', () => {
  const r = mask('Experience\n12.03.2021 – 31.12.2022 Senior Engineer\n2021.03.12 joined', {});
  assert.match(r.markdown, /12\.03\.2021/);
  assert.match(r.markdown, /31\.12\.2022/);
  assert.match(r.markdown, /2021\.03\.12/);
  assert.equal(r.counts.phone, 0, 'dates must not count as phones');
});

test('dashed EU dates survive, real phones still masked (regression guard)', () => {
  const r = mask('03-12-21 to 05-04-22 · call +49 30 1234567 or (212) 555-0134', {});
  assert.match(r.markdown, /03-12-21/);
  assert.match(r.markdown, /05-04-22/);
  assert.equal(r.counts.phone, 2, 'the two real phone numbers must be redacted');
});

// ── existing contract guard ──────────────────────────────────────────────

test('emails, year ranges and street addresses behave as before', () => {
  const r = mask('jane@example.com · 2018-2022 · 123 Main Street, 02139 · 2026-07-04 shipped', {});
  assert.ok(!/jane@example\.com/.test(r.markdown));
  assert.match(r.markdown, /2018-2022/, 'year range must survive');
  assert.match(r.markdown, /2026-07-04/, 'ISO date must survive');
  assert.ok(!/123 Main Street/.test(r.markdown), 'street address must be redacted');
});
