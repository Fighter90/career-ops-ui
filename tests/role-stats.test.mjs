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
// countries.js first (role-stats delegates country detection to it), then role-stats.
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/countries.js'), 'utf8'))(w); // eslint-disable-line no-new-func
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
  // salaryByCountry sorted by median desc → remote ($150k) leads.
  assert.equal(r.salaryByCountry[0].code, 'remote');
});

test('aggregate: empty / no-scan input is safe', () => {
  const r = RS.aggregate([], ['Backend Engineer'], C);
  assert.equal(r.totalJobs, 0);
  assert.equal(r.matchedJobs, 0);
  assert.equal(r.perRole[0].total, 0);
  assert.deepEqual(r.byCountry, []);
  assert.deepEqual(r.salaryByCountry, []);
});
