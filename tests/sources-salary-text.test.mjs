/**
 * Shared free-text salary parsing (`server/lib/sources/_salary-text.mjs`),
 * ported from the parent's `providers/_salary-text.mjs`.
 *
 * One reading of an amount or range string ("80-90k", "$123,684—$254,644
 * USD", "kr 1.100.000 – 1.400.000", "25-40K·15薪") for every caller that
 * turns written compensation into numbers. Pure parsers: no network, no
 * parent project, no filesystem.
 *
 * Cases mirror the parent's own suites (tests/salary-text-nordic.test.mjs
 * #6620, tests/salary-text-zh.test.mjs #6932), minus the salary-gap.mjs
 * integration web-ui does not carry.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let parseAmount;
let compensationPeriod;
let compensationCurrency;
let parseAnnualCompensation;

before(async () => {
  ({ parseAmount, compensationPeriod, compensationCurrency, parseAnnualCompensation }
    = await import('../server/lib/sources/_salary-text.mjs'));
});

const assertAmount = (raw, expected) => {
  const got = parseAmount(raw);
  if (expected === null) {
    assert.equal(got, null, `${JSON.stringify(raw)} should not parse`);
    return;
  }
  assert.ok(got !== null, `${JSON.stringify(raw)} should parse`);
  assert.equal(got.min, expected.min, `${JSON.stringify(raw)} min`);
  assert.equal(got.max, expected.max, `${JSON.stringify(raw)} max`);
};

test('parseAmount: Norwegian/Bokmål salary spellings (#6620)', () => {
  assertAmount('kr 1.100.000 – 1.400.000', { min: 1100000, max: 1400000 });
  assertAmount('NOK 2 000 000-2 600 000', { min: 2000000, max: 2600000 });
  assertAmount('1 100 000 - 1 400 000 kr', { min: 1100000, max: 1400000 });
  assertAmount('650 000 kr', { min: 650000, max: 650000 });
  assertAmount('kr 650 000,-', { min: 650000, max: 650000 });
  assertAmount('kr. 900 000', { min: 900000, max: 900000 });
  assertAmount('NOK 1500000', { min: 1500000, max: 1500000 });
  assertAmount('1 250 000 kr', { min: 1250000, max: 1250000 });
});

test('parseAmount: existing spellings keep their meaning', () => {
  assertAmount('2000k-2600k NOK', { min: 2000000, max: 2600000 });
  assertAmount('80 - 90k', { min: 80000, max: 90000 });
  assertAmount('80-90k', { min: 80000, max: 90000 });
  assertAmount('$123,684—$254,644 USD', { min: 123684, max: 254644 });
  assertAmount('45.000,00 EUR', { min: 45000, max: 45000 });
  assertAmount('82.5k', { min: 82500, max: 82500 });
  assertAmount('450k SEK', { min: 450000, max: 450000 });
  assertAmount('60000', { min: 60000, max: 60000 });
});

test('parseAmount: prose around a figure is not a salary', () => {
  assertAmount('Lønn fra kr 1.100.000 – 1.400.000 som avdelingsdirektør i stillingskode 1060', null);
  assertAmount('konkurransedyktig', null);
  assertAmount('competitive', null);
  assertAmount('?', null);
  assertAmount('n/a', null);
  assertAmount('', null);
});

test('parseAmount: monthly pay with a stated month count is annualized by it (#6932)', () => {
  assertAmount('25-40K·15薪', { min: 375000, max: 600000 });
  assertAmount('25-40k · 15 薪', { min: 375000, max: 600000 });
  assertAmount('月薪 30-50K·14薪', { min: 420000, max: 700000 });
  assertAmount('税前月薪 2.5万-4万，13薪', { min: 325000, max: 520000 });
  assertAmount('20-30K*16薪', { min: 320000, max: 480000 });
  assertAmount('35K·14薪', { min: 490000, max: 490000 });
  assertAmount('25,000-40,000元/月·13薪', { min: 325000, max: 520000 });
});

test('parseAmount: a parenthetical is a note, not part of the figure', () => {
  assertAmount('25-40K·15薪（13 薪 + 2 个月浮动年终奖）', { min: 375000, max: 600000 });
  assertAmount('25-40K（15薪）', { min: 375000, max: 600000 });
  assertAmount('月薪 25-40K（13 薪 + 2 个月浮动年终奖）', { min: 325000, max: 520000 });
});

test('parseAmount: 年薪 is taken as written; a month count beside it changes nothing', () => {
  assertAmount('年薪 50 万（12 薪，另有 option）', { min: 500000, max: 500000 });
  assertAmount('年薪 60-80 万人民币', { min: 600000, max: 800000 });
  assertAmount('税前年薪 40万-60万', { min: 400000, max: 600000 });
  assertAmount('年薪 50 万·14薪', { min: 500000, max: 500000 });
  assertAmount('60-80万/年', { min: 600000, max: 800000 });
  assertAmount('CNY 600,000-800,000 年薪', { min: 600000, max: 800000 });
  assertAmount('25-40K（年薪）', { min: 25000, max: 40000 });
  assertAmount('300K/年', { min: 300000, max: 300000 });
});

test('parseAmount: 万 with no period word is read as written, like a bare "80-90k"', () => {
  assertAmount('60-80 万人民币', { min: 600000, max: 800000 });
  assertAmount('1.5万', { min: 15000, max: 15000 });
});

test('parseAmount: a monthly amount with no month count is not annualized', () => {
  assertAmount('月薪 35k', null);
  assertAmount('base 月薪 35k 起', null);
  assertAmount('3万/月', null);
  assertAmount('每月 2-3 万', null);
  assertAmount('30K/月', null);
  assertAmount('25-40K CNY（月薪）', null);
  assertAmount('SGD 14,000–18,000 per month', null);
});

test('parseAmount: not a salary figure, or not one figure', () => {
  assertAmount('15薪', null);
  assertAmount('13 薪 + 2 个月浮动年终奖', null);
  assertAmount('50 万用户', null);
  assertAmount('年薪面议', null);
  assertAmount('税后年薪 50 万', null);
  assertAmount('25-40K·13薪或15薪', null);
  assertAmount('25-40K·3薪', null);
  // The whole count is read, so "115薪" is not taken as "15薪".
  assertAmount('25-40K·115薪', null);
  assertAmount('年薪 50 万（月薪约 4 万）', null);
  assertAmount('年薪 50 万，月薪 35k', null);
});

test('compensationPeriod: the period of the figure parseAmount returns', () => {
  assert.equal(compensationPeriod('年薪 60-80 万人民币'), 'annual');
  assert.equal(compensationPeriod('25-40K·15薪'), 'annual', 'an amount with a month count is annual');
  assert.equal(compensationPeriod('月薪 35k'), 'monthly');
  assert.equal(compensationPeriod('3万/月'), 'monthly');
  assert.equal(compensationPeriod('25-40K'), null);
  assert.equal(compensationPeriod('SGD 14,000–18,000 per month'), 'monthly', 'English monthly unchanged');
  assert.equal(compensationPeriod('60000 per year'), 'annual');
  assert.equal(compensationPeriod('$20-25/hr'), 'hourly');
});

test('compensationCurrency: one code, one symbol, none, or two', () => {
  assert.equal(compensationCurrency('80-90k USD'), 'USD');
  assert.equal(compensationCurrency('年薪 60-80 万 RMB'), 'RMB');
  assert.equal(compensationCurrency('€50-60k'), 'EUR', 'an unambiguous symbol resolves');
  assert.equal(compensationCurrency('£45-50k'), 'GBP');
  assert.equal(compensationCurrency('80-90k'), undefined, 'no currency named');
  assert.equal(compensationCurrency('$80-90k'), undefined, 'a bare $ names no single currency');
  assert.equal(compensationCurrency('60k USD / 55k EUR'), '', 'two codes name more than one currency');
});

test('parseAnnualCompensation: rejects non-annual periods, annualizes a month count', () => {
  assert.equal(parseAnnualCompensation('月薪 35k'), null);
  assert.equal(parseAnnualCompensation('$20-25/hr'), null);
  assert.equal(parseAnnualCompensation('5.000 EUR per month'), null);
  assert.equal(parseAnnualCompensation('25-40K·15薪 CNY')?.max, 600000);
  assert.equal(parseAnnualCompensation('65.000 EUR-75.000 EUR')?.min, 65000, 'a repeated currency code is stripped');
  assert.equal(parseAnnualCompensation('65.000 EUR-75.000 EUR')?.max, 75000);
});
