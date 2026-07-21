/**
 * Arbeitsagentur config-driven remoteMatch + remoteMaxPages (v1.76.0 — parent
 * career-ops v1.13.0 #1189) plus homeofficetyp confirmation (parent v1.22.0
 * #1981): the 'filter' pass now makes one detail call per hit and only tags a job
 * nationwide-remote when `homeofficetyp === 'VOLLSTAENDIG'`. CI-isolated: a fake
 * fetchImpl branches on the request URL (homeoffice=nv_true → the server-side
 * remote pass; /jobdetails/ → the per-hit homeofficetyp lookup).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchArbeitsagentur, parseArbeitsagenturConfig } from '../server/lib/sources/arbeitsagentur.mjs';

const job = (refnr, titel, extra = {}) => ({ refnr, titel, arbeitgeber: 'ACME', arbeitsort: { ort: 'Berlin' }, ...extra });

const okJson = (data) => ({ ok: true, json: async () => data });

test('parseArbeitsagenturConfig: defaults + enum validation', () => {
  const def = parseArbeitsagenturConfig({ arbeitsagentur: { keywords: ['x'] } });
  assert.equal(def.remoteMatch, 'title');
  assert.equal(def.remoteMaxPages, 1);
  assert.equal(parseArbeitsagenturConfig({ arbeitsagentur: { remoteMatch: 'filter' } }).remoteMatch, 'filter');
  assert.equal(parseArbeitsagenturConfig({ arbeitsagentur: { remoteMatch: 'bogus' } }).remoteMatch, 'title');
});

test('remoteMatch=filter confirms homeofficetyp: VOLLSTAENDIG tagged, hybrid/errored untagged', async () => {
  let usedHomeoffice = false;
  const pagesSeen = new Set();
  const detailsSeen = [];
  // R1 München = genuinely remote; R2 Stuttgart = hybrid "nach Absprache"; R3 Köln = lookup fails.
  const HOMEOFFICETYP = { R1: 'VOLLSTAENDIG', R2: 'NACH_VEREINBARUNG' };
  const fetchImpl = async (url) => {
    if (url.includes('/jobdetails/')) {
      const refnr = Buffer.from(url.split('/jobdetails/')[1], 'base64').toString();
      detailsSeen.push(refnr);
      // unverifiable → non-2xx makes fetchJson throw → must stay untagged
      if (!(refnr in HOMEOFFICETYP)) return { ok: false, status: 404, json: async () => ({}) };
      return okJson({ homeofficetyp: HOMEOFFICETYP[refnr] });
    }
    const sp = new URL(url).searchParams;
    if (sp.has('wo')) {
      return okJson({ stellenangebote: [job('L', 'ML Engineer Berlin')] });
    }
    usedHomeoffice = usedHomeoffice || sp.get('homeoffice') === 'nv_true';
    pagesSeen.add(sp.get('page'));
    return Number(sp.get('page')) === 1
      ? okJson({ stellenangebote: [ // full page (== size 2) → pagination continues
          job('R1', 'ML Engineer', { arbeitsort: { ort: 'München' } }),
          job('R2', 'ML Scientist', { arbeitsort: { ort: 'Stuttgart' } }),
        ] })
      : okJson({ stellenangebote: [job('R3', 'NLP Engineer', { arbeitsort: { ort: 'Köln' } })] }); // short → stop
  };
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl,
    company: { name: 'A', arbeitsagentur: { keywords: ['ML'], wo: 'Berlin', remoteNationwide: true, remoteMatch: 'filter', remoteMaxPages: 5, size: 2 } },
  });
  const TAG = /Deutschlandweit \(Homeoffice\)/;
  const munich = jobs.find((j) => j.id.includes('R1'));
  const stuttgart = jobs.find((j) => j.id.includes('R2'));
  const koeln = jobs.find((j) => j.id.includes('R3'));

  assert.ok(usedHomeoffice, 'sends homeoffice=nv_true on the remote pass');
  assert.ok(pagesSeen.has('1') && pagesSeen.has('2'), 'paginates the remote pass');
  // VOLLSTAENDIG → tagged nationwide-remote and flagged remote.
  assert.ok(munich && TAG.test(munich.location), 'tags confirmed VOLLSTAENDIG role');
  assert.ok(munich.isRemote && munich.workplaceType === 'Remote', 'forces remote flags on the confirmed role');
  // NACH_VEREINBARUNG (hybrid) → keeps its real city, no tag.
  assert.ok(stuttgart && !TAG.test(stuttgart.location) && stuttgart.location === 'Stuttgart',
    'does not tag NACH_VEREINBARUNG (hybrid) role as nationwide remote');
  // Lookup error → fail closed, keep real city.
  assert.ok(koeln && !TAG.test(koeln.location) && koeln.location === 'Köln',
    'leaves a posting untagged when the homeofficetyp lookup fails');
  // One detail lookup per remote candidate.
  assert.equal(detailsSeen.length, 3, 'verifies homeofficetyp once per candidate');
  assert.deepEqual([...detailsSeen].sort(), ['R1', 'R2', 'R3']);
});

test('remoteMatch=filter caps detail lookups at VERIFY_BATCH and verifies each refnr once', async () => {
  // With more candidates than one batch, peak in-flight detail requests must never
  // exceed the cap (5); a duplicate refnr across pages must not cost a second lookup.
  let inFlight = 0;
  let peakInFlight = 0;
  const detailCalls = [];
  const wideRefs = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'];
  const fetchImpl = async (url) => {
    if (url.includes('/jobdetails/')) {
      const refnr = Buffer.from(url.split('/jobdetails/')[1], 'base64').toString();
      detailCalls.push(refnr);
      inFlight++;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5)); // hold the slot so overlap is observable
      inFlight--;
      return okJson({ homeofficetyp: 'VOLLSTAENDIG' });
    }
    const sp = new URL(url).searchParams;
    if (sp.has('wo')) return okJson({ stellenangebote: [] });
    // Page 1 is full (== size 7) so pagination continues; W1 repeats on page 2.
    return Number(sp.get('page')) === 1
      ? okJson({ stellenangebote: wideRefs.map((r) => job(r, 'ML Engineer', { arbeitsort: { ort: 'München' } })) })
      : okJson({ stellenangebote: [job('W1', 'ML Engineer', { arbeitsort: { ort: 'München' } })] });
  };
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl,
    company: { name: 'A', arbeitsagentur: { keywords: ['ML'], wo: 'Berlin', remoteNationwide: true, remoteMatch: 'filter', remoteMaxPages: 5, size: 7 } },
  });
  assert.ok(peakInFlight > 0 && peakInFlight <= 5, `peak in-flight detail requests = ${peakInFlight} (expected 1..5)`);
  assert.equal(detailCalls.length, wideRefs.length, 'verifies each duplicated refnr only once');
  assert.equal(new Set(detailCalls).size, wideRefs.length);
  const tagged = jobs.filter((j) => /Deutschlandweit \(Homeoffice\)/.test(j.location));
  assert.equal(tagged.length, wideRefs.length, 'tags every confirmed VOLLSTAENDIG candidate across batches');
});

test('remoteMatch=off skips the nationwide pass entirely (no homeoffice, no detail calls)', async () => {
  let remoteHit = false;
  let detailHit = false;
  const fetchImpl = async (url) => {
    if (/\/jobdetails\//.test(url)) detailHit = true;
    if (/homeoffice=nv_true/.test(url)) remoteHit = true;
    return okJson({ stellenangebote: [job('1', 'ML Engineer')] });
  };
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl,
    company: { name: 'A', arbeitsagentur: { keywords: ['eng'], wo: 'Berlin', remoteNationwide: true, remoteMatch: 'off' } },
  });
  assert.equal(remoteHit, false, 'no homeoffice pass when remoteMatch=off');
  assert.equal(detailHit, false, 'no detail lookup when remoteMatch=off');
  assert.equal(jobs.length, 1);
});

test('remoteMatch=title keeps only remote-titled nationwide hits (no detail calls)', async () => {
  // 'title' mode re-runs the plain nationwide query (no homeoffice param) and
  // filters by the remote regex on the title — it needs no per-job proof.
  let detailHit = false;
  const fetchImpl = async (url) => {
    if (/\/jobdetails\//.test(url)) detailHit = true;
    // Pass A has wo+umkreis; Pass B (title) is the plain query (no wo/umkreis, no homeoffice).
    const isWide = !/wo=/.test(url) && !/homeoffice/.test(url);
    const data = isWide
      ? [job('9', 'Remote ML Engineer'), job('10', 'Onsite Cook')]
      : [job('1', 'ML Engineer Berlin')];
    return okJson({ stellenangebote: data });
  };
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl,
    company: { name: 'A', arbeitsagentur: { keywords: ['eng'], wo: 'Berlin', remoteNationwide: true, remoteMatch: 'title' } },
  });
  assert.equal(detailHit, false, 'title mode never hits the detail endpoint');
  // refnr 9 (remote-titled) kept + tagged; refnr 10 (non-remote) dropped from pass B.
  const nine = jobs.find((j) => j.id.includes('9'));
  assert.ok(nine && /Deutschlandweit \(Homeoffice\)/.test(nine.location));
  assert.ok(!jobs.some((j) => j.id.includes('10')));
});
