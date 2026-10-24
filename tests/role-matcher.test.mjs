/**
 * A short capitalised code makes a requisition its own opening (#5688 port,
 * parent 134057b8 / CAR-87).
 *
 * roleTokens drops every word of three letters or fewer (bar SHORT_SPECIALTY),
 * which is right for prepositions and wrong for the codes employers use to
 * split one base title into many requisitions: a segment (DNB, FSI), a
 * platform (AWS, GCP), a country or state (DE, HU, GA, OH). Those pairs
 * tokenize identically, score a perfect Jaccard ratio and — with no URL or req
 * number to separate them — merge-tracker folds the second requisition into
 * the first row.
 *
 * The acronym is read from the raw title, and only when written in capitals
 * inside a title that is not itself all capitals: the capitals are what mark a
 * code rather than a short common word. The all-capitals check is Unicode
 * aware (any letter that is not upper case — lower case, or a script without
 * case — marks the title as not all capitals), so codes are read in titles
 * written in another script ('Μηχανικός Δεδομένων AWS').
 *
 * CI-isolated: pure functions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roleFuzzyMatch, extractShortAcronyms } from '../server/lib/role-matcher.mjs';

test('segment codes split two requisitions apart', () => {
  assert.equal(roleFuzzyMatch('Enterprise Account Executive - DNB', 'Enterprise Account Executive - FSI'), false);
  assert.equal(roleFuzzyMatch('Enterprise Account Executive - FSI', 'Enterprise Account Executive - DNB'), false);
});

test('platform codes split two requisitions apart', () => {
  assert.equal(roleFuzzyMatch('Cloud Platform Engineer (AWS)', 'Cloud Platform Engineer (GCP)'), false);
  assert.equal(roleFuzzyMatch('Cloud Platform Engineer (GCP)', 'Cloud Platform Engineer (AWS)'), false);
});

test('country and state codes split two requisitions apart', () => {
  assert.equal(roleFuzzyMatch('Customer Support Agent - DE', 'Customer Support Agent - HU'), false);
  assert.equal(
    roleFuzzyMatch('Territory Account Executive, Retail - Columbus, GA',
      'Territory Account Executive, Retail - Columbus, OH'),
    false,
  );
});

test('a different code on each side splits even next to a shared word', () => {
  assert.equal(roleFuzzyMatch('Solutions Architect, AI', 'Solutions Architect, SMB'), false);
});

test('codes are read in titles written in another script', () => {
  assert.equal(roleFuzzyMatch('Μηχανικός Δεδομένων AWS', 'Μηχανικός Δεδομένων GCP'), false);
});

test('the same code on both sides still matches', () => {
  assert.equal(roleFuzzyMatch('Senior Data Engineer (GCP)', 'Data Engineer - GCP'), true);
});

test('a code on one side only still matches', () => {
  assert.equal(roleFuzzyMatch('Customer Success Manager (SMB)', 'Customer Success Manager - SMB (Remote)'), true);
});

test('lower-case gender markers are not codes', () => {
  assert.equal(roleFuzzyMatch('Backend Engineer, Payments (m/f/d)', 'Backend Engineer, Payments (w/m/x)'), true);
});

test('an all-capitals title carries no code signal', () => {
  assert.equal(
    roleFuzzyMatch('SENIOR SOFTWARE ENGINEER, PAYMENTS', 'SENIOR SOFTWARE ENGINEER, PAYMENTS PLATFORM'),
    true,
  );
});

test('extractShortAcronyms reads codes from the raw title', () => {
  // Two codes joined by a slash are read as two; a 4-letter run (EMEA) is not
  // a short code.
  assert.deepEqual([...extractShortAcronyms('Engineer (AWS/GCP), EMEA')].sort(), ['AWS', 'GCP']);
  // Read inside a title whose other words are Greek lower case.
  assert.deepEqual([...extractShortAcronyms('Μηχανικός Δεδομένων AWS')], ['AWS']);
  // An all-capitals Greek title is one shouting string, not a code carrier.
  assert.deepEqual([...extractShortAcronyms('ΜΗΧΑΝΙΚΟΣ ΔΕΔΟΜΕΝΩΝ AWS')], []);
  // A stated level and filler words carry no requisition identity.
  assert.deepEqual([...extractShortAcronyms('Engineer II (ALL GENDERS)')], []);
});
