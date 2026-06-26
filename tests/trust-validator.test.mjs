/**
 * Trust validator (v1.76.0 — parent career-ops v1.13.0 parity).
 * Annotate-only: scores 0-100, flags, level. Never drops a job.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrustValidator, classifyTrustLevel, validateUrl, matchesDomainList, companyMatchesHostname,
} from '../server/lib/trust-validator.mjs';

test('classifyTrustLevel thresholds', () => {
  assert.equal(classifyTrustLevel(100), 'high');
  assert.equal(classifyTrustLevel(90), 'high');
  assert.equal(classifyTrustLevel(75), 'medium');
  assert.equal(classifyTrustLevel(60), 'medium');
  assert.equal(classifyTrustLevel(59), 'low');
});

test('validateUrl + matchesDomainList + companyMatchesHostname', () => {
  assert.equal(validateUrl('https://x.com/a').valid, true);
  assert.equal(validateUrl('ftp://x').valid, false);
  assert.equal(validateUrl('not a url').valid, false);
  assert.equal(matchesDomainList('abc.bit.ly', ['bit.ly']), true);
  assert.equal(matchesDomainList('bit.ly', ['bit.ly']), true);
  assert.equal(matchesDomainList('safe.com', ['bit.ly']), false);
  assert.equal(companyMatchesHostname('Acme Corp', 'careers.acme.com'), true);
  assert.equal(companyMatchesHostname('Acme', 'jobs.zzz.io'), false);
});

test('disabled/absent config → no-op (100/high, no flags)', () => {
  for (const cfg of [undefined, null, { enabled: false }]) {
    const v = buildTrustValidator(cfg)({ url: 'https://bit.ly/x', company: 'Zzz' });
    assert.deepEqual(v, { score: 100, flags: [], level: 'high' });
  }
});

test('enabled: missing url → missing_apply_url, low', () => {
  const v = buildTrustValidator({ enabled: true })({ url: '', company: 'Acme' });
  assert.deepEqual(v.flags, ['missing_apply_url']);
  assert.equal(v.score, 60);
  assert.equal(v.level, 'medium');
});

test('enabled: suspicious shortener domain flagged', () => {
  const v = buildTrustValidator({ enabled: true })({ url: 'https://bit.ly/job', company: 'bit' });
  assert.ok(v.flags.includes('suspicious_domain'));
  assert.ok(v.score <= 75);
});

test('enabled: company↔domain mismatch (non-ATS host) flagged', () => {
  const v = buildTrustValidator({ enabled: true })({ url: 'https://randomsite.xyz/apply', company: 'Acme Corp' });
  assert.ok(v.flags.includes('company_domain_mismatch'));
});

test('enabled: ATS-hosted url skips the mismatch check', () => {
  const v = buildTrustValidator({ enabled: true })({ url: 'https://boards.greenhouse.io/acme/jobs/1', company: 'Totally Different' });
  assert.equal(v.flags.includes('company_domain_mismatch'), false);
  assert.equal(v.level, 'high');
});

test('custom suspicious_domains/ats_allowlist overrides honoured', () => {
  const v = buildTrustValidator({ enabled: true, suspicious_domains: ['evil.test'] })({ url: 'https://evil.test/x', company: 'evil' });
  assert.ok(v.flags.includes('suspicious_domain'));
});
