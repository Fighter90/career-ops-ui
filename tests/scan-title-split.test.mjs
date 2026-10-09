/**
 * splitTitleCountry (public/js/lib/scan-results.js) — the v1.244.0 title-
 * hygiene helper (spec docs/sdd/specs/2026-10-06-scan-page-redesign.md,
 * Scope 2). The scan-redesign row shows the ROLE on line 1 and folds the
 * trailing "| Country | Remote" segment into the meta line; this suite pins
 * the split rules: at most one trailing pair, only a bare work-type tail,
 * only a place-shaped middle segment, Unicode-aware (Cyrillic locales).
 *
 * CI-isolated: loads the browser lib in Node with a stub `window` (the
 * top-level IIFE only assigns window.ScanResults — no DOM at load time),
 * no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'scan-results.js'), 'utf8');

const fakeWindow = {};
new Function('window', src)(fakeWindow); // eslint-disable-line no-new-func
const splitTitleCountry = fakeWindow.ScanResults?.splitTitleCountry;
const salaryHead = fakeWindow.ScanResults?.salaryHead;

test('scan-results.js exports the splitTitleCountry helper', () => {
  assert.equal(typeof splitTitleCountry, 'function',
    'window.ScanResults.splitTitleCountry must be exported (contract: pure title hygiene)');
});

test('splits the trailing "| Country | Remote" pair (the Grafana complaint row)', () => {
  assert.deepEqual(splitTitleCountry('Senior Backend Engineer - Databases - Analytics | Germany | Remote'), {
    title: 'Senior Backend Engineer - Databases - Analytics',
    country: 'Germany',
  });
});

test('Unicode-aware: splits the ru pair (| Москва | Гибрид)', () => {
  assert.deepEqual(splitTitleCountry('Старший инженер данных (Data Platform) | Москва | Гибрид'), {
    title: 'Старший инженер данных (Data Platform)',
    country: 'Москва',
  });
  assert.deepEqual(splitTitleCountry('Бэкенд-разработчик (Go) | Санкт-Петербург | Удалённо'), {
    title: 'Бэкенд-разработчик (Go)',
    country: 'Санкт-Петербург',
  });
  assert.deepEqual(splitTitleCountry('Продуктовый аналитик | Казань | Офис'), {
    title: 'Продуктовый аналитик',
    country: 'Казань',
  });
});

test('splits when the remote tail carries a parenthetical (282-char fixture title)', () => {
  const title = 'Senior Backend Engineer - Databases - Analytics - Distributed Systems ' +
    '- Platform Infrastructure - Observability Tooling - Site Reliability ' +
    '- Developer Experience - Data Pipelines | Germany | Remote (EU time zones; ' +
    'occasional travel to the Berlin headquarters for quarterly planning)';
  const got = splitTitleCountry(title);
  assert.equal(got.country, 'Germany');
  assert.ok(got.title.startsWith('Senior Backend Engineer - Databases'));
  assert.ok(!got.title.includes('|'), 'the pipe tail must be gone from line 1');
});

test('titles with legit pipes are left untouched', () => {
  // The tail is a role fragment, not a work-type marker.
  for (const title of [
    'C++ | Rust | Go Developer',
    'Engineering Manager - Platform | REMOTE FIRST',
    'Remote Work Policy Lead',
    'Office Manager | Acme | Berlin',
  ]) {
    assert.deepEqual(splitTitleCountry(title), { title, country: '' }, title);
  }
});

test('a single trailing pipe never splits (the segment could be part of the role)', () => {
  for (const title of ['Platform Engineer | Remote', 'Data Engineer | Гибрид', 'Designer | Berlin']) {
    assert.deepEqual(splitTitleCountry(title), { title, country: '' }, title);
  }
});

test('non-place middle segments never split', () => {
  // Digits / role fragments in the middle segment mean it was never a country.
  const title = 'Engineer | 2nd line support | Remote';
  assert.deepEqual(splitTitleCountry(title), { title, country: '' });
});

test('titles without the pattern are returned whole', () => {
  assert.deepEqual(splitTitleCountry('Senior Backend Engineer'), { title: 'Senior Backend Engineer', country: '' });
  assert.deepEqual(splitTitleCountry('Dev | Germany | Remote | Platform team'), {
    title: 'Dev | Germany | Remote | Platform team', country: '',
  });
});

test('whitespace is normalized; empty/null input is safe', () => {
  assert.deepEqual(splitTitleCountry('  Dev   |  Germany  |  Remote  '), {
    title: 'Dev', country: 'Germany',
  });
  assert.deepEqual(splitTitleCountry(''), { title: '', country: '' });
  assert.deepEqual(splitTitleCountry(null), { title: '', country: '' });
  assert.deepEqual(splitTitleCountry(undefined), { title: '', country: '' });
});


// ── salaryHead (v1.244.2): the visible cell keeps only the money chunk ──

test('scan-results.js exports the salaryHead helper', () => {
  assert.equal(typeof salaryHead, 'function',
    'window.ScanResults.salaryHead must be exported (contract: money chunk for the visible cell)');
});

test('salaryHead: keeps the money range, drops the benefits blurb after •/·', () => {
  assert.equal(salaryHead('$224K – $263K • Offers Equity • This role is also eligible for medical benefits, 401(k) plan.'),
    '$224K – $263K');
  assert.equal(salaryHead('$195K – $229K · Offers · Perks'), '$195K – $229K');
});

test('salaryHead: pass-through and edge cases', () => {
  assert.equal(salaryHead('$85,000'), '$85,000');           // no separator — whole string
  assert.equal(salaryHead('50 000 kr/month'), '50 000 kr/month');
  assert.equal(salaryHead(''), '');
  assert.equal(salaryHead(null), '');
  assert.equal(salaryHead('• trailing separator'), '• trailing separator'); // nothing before • → raw
});
