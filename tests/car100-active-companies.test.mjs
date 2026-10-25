// CAR-100 — the #/scan «Active companies» counter paired two different universes.
//
// labelN()'s numerator (activeFromLastScan) counted DISTINCT company names
// across ALL result rows — 1554 on prod, with hh.ru / telegram alone
// contributing hundreds of employers no portals.yml entry names — over a
// denominator of the API-backed enabled tracked companies (~90). The tooltip
// promises "configured in portals.yml", so the pairing must stay inside that
// universe (chosen fix, pairing (a)):
//   numerator   = distinct companies among rows the API-backed tracked scan
//                 itself fetched — matched against apiCompanies, the set the
//                 page already builds with isApiBackedCompany. Row identity:
//                 the scanner stamps the portals entry name on every row it
//                 fetches (`_entry`; `company` on rows saved by older builds —
//                 the same `_entry ?? company` rule en-scanner's carry-over
//                 logic uses), so a board's own employer spelling (or an RU
//                 channel post's employer) never leaks into the numerator.
//   denominator = those same API-backed enabled tracked companies
//                 (apiCompanies.length), pre-scan fallback included.
//
// Static assertions run over tests/helpers/scan-src.mjs::loadScanSrc(); the
// behavioural cases execute the REAL counter functions extracted from
// views/scan.js (the same vm-extraction pattern tests/scan-view-lifecycle
// uses for isApiBackedCompany).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScanSrc } from './helpers/scan-src.mjs';

const SRC = loadScanSrc();

// The REAL counter slice inside Router.register('scan'): activeFromLastScan +
// labelN, closing over SR / companies / apiCompanies exactly as shipped.
const FN_START = SRC.indexOf('function activeFromLastScan');
const FN_END = SRC.indexOf('const setLabel = () => {');
assert.ok(FN_START >= 0 && FN_END > FN_START, 'counter slice bounds');
const COUNTER = SRC.slice(FN_START, FN_END);

function counter(sandbox) {
  const ctx = vm.createContext({ Set, ...sandbox });
  vm.runInContext(COUNTER, ctx);
  return vm.runInContext('({ activeFromLastScan, labelN })', ctx);
}

// ── behavioural (real code) ────────────────────────────────────────────────

test('CAR-100: the numerator counts only rows fetched from API-backed tracked companies', () => {
  const rows = [
    { _entry: 'Grafana Labs', company: 'Grafana Labs', source: 'greenhouse', title: 'a' },
    { _entry: 'Acme', company: 'Acme Corp', source: 'ashby', title: 'b' }, // entry name wins
    { company: 'Some hh Employer', source: 'hh', title: 'c' }, // RU board employer
    { company: 'Telegram Consulting', source: 'telegram', title: 'd' }, // channel post
    { company: 'Unknown Web Co', source: 'rss', title: 'e' }, // untracked board
  ];
  const { activeFromLastScan, labelN } = counter({
    SR: { getRows: () => rows },
    companies: [{ name: 'Grafana Labs' }, { name: 'Acme' }, { name: 'WebSearch Co' }],
    apiCompanies: [{ name: 'Grafana Labs' }, { name: 'Acme' }],
  });
  assert.equal(activeFromLastScan(), 2,
    'hh/telegram/untracked employers are outside the tracked universe — no more 1554/90');
  assert.equal(labelN(), '2/2');
});

test('CAR-100: rows saved by older builds (no _entry) still count via their company name', () => {
  const { activeFromLastScan } = counter({
    SR: { getRows: () => [{ company: 'acme', source: 'greenhouse' }, { company: 'zzz', source: 'lever' }] },
    companies: [{ name: 'Acme' }],
    apiCompanies: [{ name: 'Acme' }],
  });
  assert.equal(activeFromLastScan(), 1, '`company` is the fallback identity (en-scanner stamp), case-insensitive');
});

test('CAR-100: the pre-scan fallback stays in the API-backed universe (never companies.length)', () => {
  const { labelN } = counter({
    SR: { getRows: () => [] },
    companies: [{ name: 'A' }, { name: 'B' }, { name: 'C websearch' }],
    apiCompanies: [{ name: 'A' }, { name: 'B' }],
  });
  assert.equal(labelN(), '2/2',
    'the old fallback could read 3/2 — numerator universe must equal the denominator\'s');
});

// ── source-static (loadScanSrc) ────────────────────────────────────────────

test('CAR-100 (static): the numerator is matched against the isApiBackedCompany-classified set', () => {
  assert.match(COUNTER, /apiCompanies\.map\(\(co\) => String\(\(co && co\.name\) \|\| ''\)\.toLowerCase\(\)\)/,
    'the tracked set must be built from apiCompanies — the page\'s own registry-driven classification');
  assert.match(COUNTER, /_entry \?\? \(r\.company \|\| r\.companyName\)/,
    'row identity goes through the scanner-stamped portals entry name');
});

test('CAR-100 (static): denominator + pre-scan fallback read apiCompanies.length, never companies.length', () => {
  assert.doesNotMatch(COUNTER, /fromScan > 0 \? fromScan : companies\.length/,
    'the pre-scan fallback must not leak web-search-only entries into the numerator');
  assert.match(COUNTER, /fromScan > 0 \? fromScan : apiCompanies\.length/);
  assert.match(COUNTER, /`\$\{n\}\/\$\{apiCompanies\.length\}`/,
    'the denominator stays the API-backed enabled tracked count');
});
