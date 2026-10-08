/**
 * role-stats.js — Target-Roles market-statistics aggregator (v1.86.0).
 *
 * Loads the browser classic script (plus countries.js it delegates to) in a
 * synthetic window — same pattern as countries.test.mjs — and exercises the
 * pure salary parser, role matcher, and aggregate().
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
// Load order mirrors index.html: countries.js (role-stats delegates country
// detection to it), then skills.js (v1.243.0 — the shared amount tokenizer
// window.Skills.parseAmounts lives there), then role-stats.
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/countries.js'), 'utf8'))(w); // eslint-disable-line no-new-func
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/skills.js'), 'utf8'))(w); // eslint-disable-line no-new-func
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/role-stats.js'), 'utf8'))(w); // eslint-disable-line no-new-func
const RS = w.RoleStats;
const C = w.Countries;

test('RoleStats API surface', () => {
  assert.ok(RS && typeof RS.parseSalaryUSD === 'function');
  assert.ok(typeof RS.matchRole === 'function');
  assert.ok(typeof RS.aggregate === 'function');
});

test('parseSalaryUSD: USD k-ranges and plain amounts', () => {
  assert.deepEqual(RS.parseSalaryUSD('$120k–$150k'), { minUsd: 120000, maxUsd: 150000, currency: 'USD' });
  assert.deepEqual(RS.parseSalaryUSD('$120,000 - $150,000'), { minUsd: 120000, maxUsd: 150000, currency: 'USD' });
  // Comma-grouped range with NO spaces and NO k (the reviewer's gap).
  assert.deepEqual(RS.parseSalaryUSD('$80,000-$100,000'), { minUsd: 80000, maxUsd: 100000, currency: 'USD' });
  assert.deepEqual(RS.parseSalaryUSD('up to $200,000 per year'), { minUsd: 200000, maxUsd: 200000, currency: 'USD' });
  // No currency but k-suffix → assume USD.
  assert.deepEqual(RS.parseSalaryUSD('80k-100k'), { minUsd: 80000, maxUsd: 100000, currency: 'USD' });
});

test('parseSalaryUSD: ¥ is ambiguous (JPY vs CNY) — resolved only by explicit words', () => {
  // A bare yen sign is NOT guessed (a wrong pick is a ~20x FX distortion).
  assert.equal(RS.parseSalaryUSD('¥5000000'), null);
  // Explicit words resolve it.
  assert.equal(RS.parseSalaryUSD('5,000,000 CNY').currency, 'CNY');
  assert.equal(RS.parseSalaryUSD('¥5,000,000 RMB').currency, 'CNY');
  assert.equal(RS.parseSalaryUSD('8,000,000 JPY').currency, 'JPY');
});

test('parseSalaryUSD: non-USD currencies normalize to USD via FX', () => {
  const eur = RS.parseSalaryUSD('€90,000');
  assert.equal(eur.currency, 'EUR');
  assert.equal(eur.minUsd, Math.round(90000 * RS.FX_TO_USD.EUR));
  const gbp = RS.parseSalaryUSD('£70k');
  assert.equal(gbp.currency, 'GBP');
  assert.equal(gbp.minUsd, Math.round(70000 * RS.FX_TO_USD.GBP));
  const rub = RS.parseSalaryUSD('₽300000');
  assert.equal(rub.currency, 'RUB');
  assert.equal(rub.minUsd, Math.round(300000 * RS.FX_TO_USD.RUB));
});

test('parseSalaryUSD: conservative — junk / non-pay numbers → null', () => {
  assert.equal(RS.parseSalaryUSD('Competitive salary'), null);
  assert.equal(RS.parseSalaryUSD('5+ years experience'), null); // no currency, no k
  assert.equal(RS.parseSalaryUSD(''), null);
  assert.equal(RS.parseSalaryUSD(null), null);
  assert.equal(RS.parseSalaryUSD(undefined), null);
});

// v1.243.0 — currency signals used ASCII \b boundaries, which never match
// against Cyrillic/ł/č (a Cyrillic char is a non-\w char, so \b руб could
// not align). 'от 100 000 руб' fell through to the default-USD read
// (~90× off), '50 000 Kč' read its K as a k-suffix (×1000), and zł/грн
// salaries were dropped from the sample entirely.

test('parseSalaryUSD: Cyrillic currency words (руб / грн) now detected', () => {
  const rub = RS.parseSalaryUSD('от 100 000 руб');
  assert.equal(rub.currency, 'RUB');
  assert.equal(rub.minUsd, Math.round(100000 * RS.FX_TO_USD.RUB));
  assert.equal(rub.maxUsd, Math.round(100000 * RS.FX_TO_USD.RUB));
  const uah = RS.parseSalaryUSD('100 000 грн');
  assert.equal(uah.currency, 'UAH');
  assert.equal(uah.minUsd, Math.round(100000 * RS.FX_TO_USD.UAH));
});

test('parseSalaryUSD: "100 тыс. руб." is RUB (was USD — ~90× off)', () => {
  const s = RS.parseSalaryUSD('100 тыс. руб.');
  assert.equal(s.currency, 'RUB');
  assert.equal(s.minUsd, Math.round(100000 * RS.FX_TO_USD.RUB));
});

test('parseSalaryUSD: "50 000 Kč" is CZK (was ×1000 → 50M USD)', () => {
  const s = RS.parseSalaryUSD('50 000 Kč');
  assert.equal(s.currency, 'CZK');
  assert.equal(s.minUsd, Math.round(50000 * RS.FX_TO_USD.CZK));
});

test('parseSalaryUSD: zł / kr words resolve (were dropped or mis-scaled)', () => {
  const pln = RS.parseSalaryUSD('15 000 zł');
  assert.equal(pln.currency, 'PLN');
  assert.equal(pln.minUsd, Math.round(15000 * RS.FX_TO_USD.PLN));
  const kr = RS.parseSalaryUSD('450 000 kr');
  assert.equal(kr.currency, 'NOK');
  assert.equal(kr.minUsd, Math.round(450000 * RS.FX_TO_USD.NOK));
});

test('parseSalaryUSD: the K-suffix boundary rejects Kč/kr tails', () => {
  // "k" followed by a letter is a currency word, not a multiplier — the
  // amount itself must come through un-scaled even without a currency hit
  // on another token.
  assert.equal(RS.parseSalaryUSD('50 000 Kč').minUsd, Math.round(50000 * RS.FX_TO_USD.CZK));
});

test('matchRole: majority-token fuzzy match, else null', () => {
  const roles = ['Backend Engineer', 'Data Scientist'];
  assert.equal(RS.matchRole('Senior Backend Engineer (Go)', roles), 'Backend Engineer');
  assert.equal(RS.matchRole('Staff Data Scientist, ML', roles), 'Data Scientist');
  assert.equal(RS.matchRole('Marketing Manager', roles), null);
  assert.equal(RS.matchRole('', roles), null);
});

test('aggregate: counts, country breakdown, salary-by-country', () => {
  const jobs = [
    { title: 'Senior Backend Engineer', location: 'Berlin, Germany', salary: '€80k–100k' },
    { title: 'Backend Engineer', location: 'London, UK', salary: '£70,000' },
    { title: 'Data Scientist', location: 'Remote', salary: '$150k' },
    { title: 'Marketing Lead', location: 'Paris, France', salary: '€60k' }, // no role match
  ];
  const roles = ['Backend Engineer', 'Data Scientist'];
  const r = RS.aggregate(jobs, roles, C);

  assert.equal(r.totalJobs, 4);
  assert.equal(r.matchedJobs, 3);

  const be = r.perRole.find((x) => x.role === 'Backend Engineer');
  assert.equal(be.total, 2);
  assert.equal(be.byCountry.de, 1);
  assert.equal(be.byCountry.gb, 1);
  assert.equal(be.salary.count, 2);

  const ds = r.perRole.find((x) => x.role === 'Data Scientist');
  assert.equal(ds.total, 1);
  assert.equal(ds.byCountry.remote, 1);

  // perRole sorted by total desc → Backend Engineer first.
  assert.equal(r.perRole[0].role, 'Backend Engineer');

  // Overall country tallies span ALL jobs (incl. the unmatched marketing role).
  assert.equal(r.byCountry.length, 4);
  const remote = r.salaryByCountry.find((c) => c.code === 'remote');
  assert.equal(remote.salary.medianUsd, 150000);
  assert.equal(remote.salary.avgUsd, 150000);   // single sample → avg == median (v1.140.0)
  // salaryByCountry sorted by median desc → remote ($150k) leads.
  assert.equal(r.salaryByCountry[0].code, 'remote');
});

test('salaryStats: average exposes right-skew (v1.140.0)', () => {
  // three remote postings, one very high → median resists it, average is pulled up.
  const jobs = [
    { title: 'Data Scientist', location: 'Remote', salary: '$100k' },
    { title: 'Data Scientist', location: 'Remote', salary: '$100k' },
    { title: 'Data Scientist', location: 'Remote', salary: '$400k' },
  ];
  const r = RS.aggregate(jobs, ['Data Scientist'], C);
  const remote = r.salaryByCountry.find((c) => c.code === 'remote');
  assert.equal(remote.salary.count, 3);
  assert.equal(remote.salary.minUsd, 100000);
  assert.equal(remote.salary.maxUsd, 400000);
  assert.equal(remote.salary.medianUsd, 100000);        // middle value, unmoved by the outlier
  assert.equal(remote.salary.avgUsd, 200000);           // (100+100+400)/3 → skew visible
  assert.ok(remote.salary.avgUsd > remote.salary.medianUsd, 'avg must exceed median under right-skew');
});

test('aggregate: empty / no-scan input is safe', () => {
  const r = RS.aggregate([], ['Backend Engineer'], C);
  assert.equal(r.totalJobs, 0);
  assert.equal(r.matchedJobs, 0);
  assert.equal(r.perRole[0].total, 0);
  assert.deepEqual(r.byCountry, []);
  assert.deepEqual(r.salaryByCountry, []);
});
