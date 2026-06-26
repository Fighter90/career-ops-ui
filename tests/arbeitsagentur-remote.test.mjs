/**
 * Arbeitsagentur config-driven remoteMatch + remoteMaxPages (v1.76.0 — parent
 * career-ops v1.13.0 #1189). CI-isolated: a fake fetchImpl branches on the
 * request URL (homeoffice=nv_true → the server-side remote pass).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchArbeitsagentur, parseArbeitsagenturConfig } from '../server/lib/sources/arbeitsagentur.mjs';

const job = (refnr, titel, extra = {}) => ({ refnr, titel, arbeitgeber: 'ACME', arbeitsort: { ort: 'Berlin' }, ...extra });

// fetchImpl factory: returns canned stellenangebote keyed by whether the URL has
// homeoffice=nv_true (remote pass) vs the primary radius pass.
function makeFetch({ primary = [], remotePages = [] } = {}) {
  let remoteCall = 0;
  return async (url) => {
    const isRemotePass = /homeoffice=nv_true/.test(url);
    if (isRemotePass) {
      const page = remotePages[remoteCall++] || [];
      return { ok: true, json: async () => ({ stellenangebote: page }) };
    }
    return { ok: true, json: async () => ({ stellenangebote: primary }) };
  };
}

test('parseArbeitsagenturConfig: defaults + enum validation', () => {
  const def = parseArbeitsagenturConfig({ arbeitsagentur: { keywords: ['x'] } });
  assert.equal(def.remoteMatch, 'title');
  assert.equal(def.remoteMaxPages, 1);
  assert.equal(parseArbeitsagenturConfig({ arbeitsagentur: { remoteMatch: 'filter' } }).remoteMatch, 'filter');
  assert.equal(parseArbeitsagenturConfig({ arbeitsagentur: { remoteMatch: 'bogus' } }).remoteMatch, 'title');
});

test('remoteMatch=filter paginates homeoffice=nv_true and marks hits remote', async () => {
  const fetchImpl = makeFetch({
    primary: [job('1', 'ML Engineer Berlin')],
    // page1 full (size default 100 → emulate short page to stop after 1), here a single page
    remotePages: [[job('2', 'Backend Dev'), job('3', 'Data Eng')]],
  });
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl,
    company: { name: 'A', arbeitsagentur: { keywords: ['eng'], wo: 'Berlin', remoteNationwide: true, remoteMatch: 'filter', remoteMaxPages: 5 } },
  });
  const remoteJobs = jobs.filter((j) => /Homeoffice/.test(j.location));
  assert.equal(remoteJobs.length, 2, 'both remote-pass hits kept regardless of title');
  assert.ok(remoteJobs.every((j) => j.isRemote && j.workplaceType === 'Remote'));
});

test('remoteMatch=off skips the nationwide pass entirely', async () => {
  let remoteHit = false;
  const fetchImpl = async (url) => {
    if (/homeoffice=nv_true/.test(url)) remoteHit = true;
    return { ok: true, json: async () => ({ stellenangebote: [job('1', 'ML Engineer')] }) };
  };
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl,
    company: { name: 'A', arbeitsagentur: { keywords: ['eng'], wo: 'Berlin', remoteNationwide: true, remoteMatch: 'off' } },
  });
  assert.equal(remoteHit, false, 'no homeoffice pass when remoteMatch=off');
  assert.equal(jobs.length, 1);
});

test('remoteMatch=title keeps only remote-titled nationwide hits', async () => {
  // 'title' mode re-runs the plain nationwide query (no homeoffice param) and
  // filters by the remote regex on the title.
  const fetchImpl = async (url) => {
    // Pass A has wo+umkreis; Pass B (title) is the plain query (no wo/umkreis, no homeoffice).
    const isWide = !/wo=/.test(url) && !/homeoffice/.test(url);
    const data = isWide
      ? [job('9', 'Remote ML Engineer'), job('10', 'Onsite Cook')]
      : [job('1', 'ML Engineer Berlin')];
    return { ok: true, json: async () => ({ stellenangebote: data }) };
  };
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl,
    company: { name: 'A', arbeitsagentur: { keywords: ['eng'], wo: 'Berlin', remoteNationwide: true, remoteMatch: 'title' } },
  });
  // refnr 9 (remote-titled) kept; refnr 10 (non-remote) dropped from pass B.
  assert.ok(jobs.some((j) => j.id.includes('9')));
  assert.ok(!jobs.some((j) => j.id.includes('10')));
});
