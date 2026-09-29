/**
 * Report link with parentheses in the filename (parent 5f7819f, bug 4).
 *
 * parseApplications extracted reportPath with `/\(([^)]+)\)/`, which stops at
 * the first `)` and truncated `reports/042-acme-(berlin)-2024-01-15.md`. One
 * nested level of parentheses must survive.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseApplications } from '../server/lib/parsers.mjs';

const HEADER = '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n'
  + '|---|------|---------|------|-------|--------|-----|--------|-------|\n';
const row = (report) => HEADER + `| 42 | 2024-01-15 | Acme | SRE | 4.0/5 | Evaluated | ✅ | ${report} | x |\n`;
const reportPathOf = (report) => parseApplications(row(report))[0].reportPath;

test('plain report filename is preserved', () => {
  assert.equal(reportPathOf('[042](reports/042-acme-2024-01-15.md)'), 'reports/042-acme-2024-01-15.md');
});

test('report filename with one level of parentheses is not truncated', () => {
  assert.equal(reportPathOf('[042](reports/042-acme-(berlin)-2024-01-15.md)'),
    'reports/042-acme-(berlin)-2024-01-15.md');
  assert.equal(reportPathOf('[042](reports/042-acme-(senior)-(remote)-2026-08-31.md)'),
    'reports/042-acme-(senior)-(remote)-2026-08-31.md');
});

test('first of multiple links wins, with and without parens', () => {
  assert.equal(reportPathOf('[42](reports/042-foo-(bar)-2026-08-01.md) [43](reports/043-baz-2026-08-02.md)'),
    'reports/042-foo-(bar)-2026-08-01.md');
});

test('no link / empty parens → null', () => {
  assert.equal(reportPathOf('—'), null);
  assert.equal(reportPathOf('[042]()'), null);
});
