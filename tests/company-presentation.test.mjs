/**
 * company-presentation.js — the pure confidential-employer identity resolver.
 * Loaded in a synthetic window (same pattern as company-logo-domain.test.mjs).
 *
 * Parity target: the parent career-ops `web/src/lib/company-presentation.mjs`.
 * The cases below pin the SAME decisions, so the two implementations can be
 * diffed by reading the assertions rather than the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/company-presentation.js'), 'utf8'))(w); // eslint-disable-line no-new-func
const { companyPresentation: present, companySearchText: searchText } = w.CompanyPresentation;

test('a named employer passes through untouched', () => {
  const p = present({ company: 'Acme Rockets', via: 'Hays' });
  assert.equal(p.label, 'Acme Rockets');
  assert.equal(p.logoName, 'Acme Rockets');
  assert.equal(p.confidential, false);
  // Even with a Via recorded, the END EMPLOYER is what is shown — the agency
  // must never displace a company that is already named.
  assert.equal(p.via, '');
});

test("a confidential '?' employer is presented as its intermediary", () => {
  const p = present({ company: '?', via: 'Robert Walters' });
  assert.equal(p.label, 'Confidential · via Robert Walters');
  // The LOGO resolves from the agency: no domain heuristic can match '?'.
  assert.equal(p.logoName, 'Robert Walters');
  assert.equal(p.confidential, true);
  assert.equal(p.via, 'Robert Walters');
});

test("a confidential employer with no usable Via falls back to a plain label", () => {
  for (const via of [undefined, '', '   ', 'n/a', 'N/A', 'na', 'TBD', 'none', 'null', '-', '—', '–']) {
    const p = present({ company: '?', via });
    assert.equal(p.label, 'Confidential employer', `via=${JSON.stringify(via)}`);
    assert.equal(p.logoName, 'Confidential employer');
    assert.equal(p.confidential, true);
    assert.equal(p.via, '');
  }
});

test('only a bare ? is confidential — a company merely containing one is not', () => {
  assert.equal(present({ company: 'Who? Ltd', via: 'Hays' }).confidential, false);
  assert.equal(present({ company: '??', via: 'Hays' }).confidential, false);
  // Surrounding whitespace still reads as confidential (the tracker cell is trimmed).
  assert.equal(present({ company: ' ? ', via: 'Hays' }).confidential, true);
});

test('missing / empty input never throws and is not confidential', () => {
  for (const app of [undefined, null, {}, { company: '' }, { company: null }]) {
    const p = present(app);
    assert.equal(p.confidential, false);
    assert.equal(p.label, '');
  }
});

test('search text spans the raw ?, the Via name, the label and the role', () => {
  const hay = searchText({ company: '?', via: 'Hays', role: 'BI Lead' });
  for (const needle of ['?', 'Hays', 'Confidential', 'BI Lead']) {
    assert.ok(hay.includes(needle), `expected ${needle} in ${JSON.stringify(hay)}`);
  }
  // A named employer is still findable by name.
  assert.ok(searchText({ company: 'Acme', role: 'DS' }).includes('Acme'));
  // No throw on a bare object.
  assert.equal(typeof searchText({}), 'string');
});
