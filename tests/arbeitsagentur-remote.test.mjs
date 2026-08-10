/**
 * Arbeitsagentur config-driven remoteMatch + remoteMaxPages (v1.76.0 — parent
 * career-ops v1.13.0 #1189), migrated to the v6 Jobsuche API (parent #2494).
 *
 * v6 change: the v4 search + detail endpoints both 404, so the source now queries
 * `/pc/v6/jobs` (response list `ergebnisliste`; a posting carries
 * `referenznummer` / `stellenangebotsTitel` / `firma` / `stellenlokationen[]`)
 * and the `remoteMatch: 'filter'` pass no longer makes a per-hit detail call —
 * v6 does not serve `homeofficetyp` to this public key. 'filter' narrows the set
 * server-side with `homeoffice=nv_true` + pagination, then applies the SAME
 * title check 'title' mode uses before tagging a job nationwide-remote.
 *
 * CI-isolated: a fake fetchImpl branches on the request URL; the real detail
 * endpoint (`/jobdetails/`) is asserted NEVER to be hit, guarding against a
 * silent revert to the removed detail-verification path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchArbeitsagentur, parseArbeitsagenturConfig } from '../server/lib/sources/arbeitsagentur.mjs';

/** One posting in the v6 search shape. */
const v6 = (referenznummer, stellenangebotsTitel, ort = 'Berlin', extra = {}) => ({
  referenznummer,
  stellenangebotsTitel,
  firma: 'ACME',
  stellenlokationen: [{ adresse: { ort, region: 'BERLIN', land: 'DEUTSCHLAND' } }],
  ...extra,
});

/** A v6 search response. */
const page = (...jobs) => ({ ergebnisliste: jobs });
const okJson = (data) => ({ ok: true, json: async () => data });

const TAG = /Deutschlandweit \(Homeoffice\)/;

test('parseArbeitsagenturConfig: defaults + enum validation', () => {
  const def = parseArbeitsagenturConfig({ arbeitsagentur: { keywords: ['x'] } });
  assert.equal(def.remoteMatch, 'title');
  assert.equal(def.remoteMaxPages, 1);
  assert.equal(parseArbeitsagenturConfig({ arbeitsagentur: { remoteMatch: 'filter' } }).remoteMatch, 'filter');
  assert.equal(parseArbeitsagenturConfig({ arbeitsagentur: { remoteMatch: 'bogus' } }).remoteMatch, 'title');
});

test('fetchArbeitsagentur queries the v6 jobs endpoint (pin against a dead-endpoint revert)', async () => {
  let sentUrl = '';
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl: async (url) => {
      sentUrl = url;
      return okJson(page(v6('A', 'ML Engineer')));
    },
    company: { name: 'A', arbeitsagentur: { keywords: ['ML'] } },
  });
  assert.ok(sentUrl.includes('/pc/v6/jobs'), `expected v6 endpoint, got ${sentUrl}`);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].source, 'arbeitsagentur');
  assert.ok(!('refnr' in jobs[0]), 'refnr stripped from output');
});

test('remoteMatch=filter narrows with homeoffice=nv_true, paginates, and tags only remote-titled hits', async () => {
  let usedHomeoffice = false;
  let detailHit = false;
  const pagesSeen = new Set();
  const fetchImpl = async (url) => {
    if (url.includes('/jobdetails/')) { detailHit = true; return okJson({}); }
    const sp = new URL(url).searchParams;
    if (sp.has('wo')) return okJson(page(v6('L', 'ML Engineer', 'Berlin')));
    usedHomeoffice = usedHomeoffice || sp.get('homeoffice') === 'nv_true';
    pagesSeen.add(sp.get('page'));
    // v6 exposes only a boolean `homeofficemoeglich`; every nv_true hit carries it,
    // so it cannot separate fully-remote from hybrid — the title must prove it.
    return Number(sp.get('page')) === 1
      ? okJson(page( // full page (== size 2) → pagination continues
          v6('R1', 'ML Engineer — 100% Remote', 'München', { homeofficemoeglich: true }),
          v6('R2', 'ML Scientist', 'Stuttgart', { homeofficemoeglich: true }),
        ))
      : okJson(page(v6('R3', 'NLP Engineer (Homeoffice)', 'Köln', { homeofficemoeglich: true }))); // short → stop
  };
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl,
    company: { name: 'A', arbeitsagentur: { keywords: ['ML'], wo: 'Berlin', remoteNationwide: true, remoteMatch: 'filter', remoteMaxPages: 5, size: 2 } },
  });
  const munich = jobs.find((j) => j.id.includes('R1'));
  const stuttgart = jobs.find((j) => j.id.includes('R2'));
  const koeln = jobs.find((j) => j.id.includes('R3'));

  assert.equal(detailHit, false, 'v6 filter mode never hits the removed detail endpoint');
  assert.ok(usedHomeoffice, 'sends homeoffice=nv_true on the remote pass');
  assert.ok(pagesSeen.has('1') && pagesSeen.has('2'), 'paginates the remote pass');
  // Title claims remote → tagged nationwide-remote and remote flags forced.
  assert.ok(munich && TAG.test(munich.location), 'tags a hit whose title claims remote');
  assert.ok(munich.isRemote && munich.workplaceType === 'Remote', 'forces remote flags on the tagged role');
  // Title makes no remote claim (despite homeofficemoeglich:true) → keeps its real city.
  assert.ok(stuttgart && !TAG.test(stuttgart.location) && stuttgart.location === 'Stuttgart',
    'never tags on homeofficemoeglich alone — hybrid stays commute-filtered');
  // Remote-titled hit found on a later page is still tagged.
  assert.ok(koeln && TAG.test(koeln.location), 'tags remote-titled hits found on later pages');
});

test('remoteMatch=filter keeps a duplicated refnr once and tags every remote-titled candidate', async () => {
  // No per-hit detail lookup in v6, so no VERIFY_BATCH cap — just dedup by refnr
  // across pagination pages and tag each proven (remote-titled) candidate.
  let detailHit = false;
  const wideRefs = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'];
  const fetchImpl = async (url) => {
    if (url.includes('/jobdetails/')) { detailHit = true; return okJson({}); }
    const sp = new URL(url).searchParams;
    if (sp.has('wo')) return okJson(page());
    // Page 1 is full (== size 7) so pagination continues; W1 repeats on page 2.
    return Number(sp.get('page')) === 1
      ? okJson(page(...wideRefs.map((r) => v6(r, 'ML Engineer (Remote)', 'München'))))
      : okJson(page(v6('W1', 'ML Engineer (Remote)', 'München')));
  };
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl,
    company: { name: 'A', arbeitsagentur: { keywords: ['ML'], wo: 'Berlin', remoteNationwide: true, remoteMatch: 'filter', remoteMaxPages: 5, size: 7 } },
  });
  assert.equal(detailHit, false, 'no detail lookups in v6 filter mode');
  assert.equal(jobs.length, wideRefs.length, 'keeps each duplicated refnr only once');
  assert.equal(jobs.filter((j) => TAG.test(j.location)).length, wideRefs.length, 'tags every remote-titled candidate');
});

test('remoteMatch=off skips the nationwide pass entirely (no homeoffice, no detail calls)', async () => {
  let remoteHit = false;
  let detailHit = false;
  const fetchImpl = async (url) => {
    if (/\/jobdetails\//.test(url)) detailHit = true;
    if (/homeoffice=nv_true/.test(url)) remoteHit = true;
    return okJson(page(v6('1', 'ML Engineer')));
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
    const sp = new URL(url).searchParams;
    // Pass A has wo+umkreis; Pass B (title) is the plain query (no wo, no homeoffice).
    const isWide = !sp.has('wo') && !sp.has('homeoffice');
    return okJson(page(...(isWide
      ? [v6('9', 'Remote ML Engineer', 'München'), v6('10', 'Onsite Cook', 'Hamburg')]
      : [v6('1', 'ML Engineer Berlin', 'Berlin')])));
  };
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl,
    company: { name: 'A', arbeitsagentur: { keywords: ['eng'], wo: 'Berlin', remoteNationwide: true, remoteMatch: 'title' } },
  });
  assert.equal(detailHit, false, 'title mode never hits the detail endpoint');
  // refnr 9 (remote-titled) kept + tagged; refnr 10 (non-remote) dropped from pass B.
  const nine = jobs.find((j) => j.id.includes('9'));
  assert.ok(nine && TAG.test(nine.location));
  assert.ok(!jobs.some((j) => j.id.includes('10')));
});

test('dead board: throws when no keywords are configured', async () => {
  await assert.rejects(
    () => fetchArbeitsagentur(undefined, { fetchImpl: async () => okJson(page()), company: { name: 'X', arbeitsagentur: {} } }),
    /no arbeitsagentur\.keywords/,
  );
});

test('dead board: throws when every keyword request fails (no silent empty)', async () => {
  await assert.rejects(
    () => fetchArbeitsagentur(undefined, {
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
      company: { name: 'A', arbeitsagentur: { keywords: ['ML'] } },
    }),
    /all 1 keyword request\(s\) failed/,
  );
});

test('partial success: one keyword answers (empty) while another fails → does not throw', async () => {
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl: async (url) => {
      if (new URL(url).searchParams.get('was') === 'BAD') return { ok: false, status: 503, json: async () => ({}) };
      return okJson(page()); // OK answers, just empty
    },
    company: { name: 'A', arbeitsagentur: { keywords: ['OK', 'BAD'] } },
  });
  assert.ok(Array.isArray(jobs) && jobs.length === 0);
});

test('partial page failure: Pass A jobs survive when the remote pass (Pass B) fails', async () => {
  const jobs = await fetchArbeitsagentur(undefined, {
    fetchImpl: async (url) => {
      // Pass A (wo set) returns a job; Pass B (no wo) throws.
      if (new URL(url).searchParams.has('wo')) return okJson(page(v6('L', 'ML Engineer', 'Berlin')));
      return { ok: false, status: 503, json: async () => ({}) };
    },
    company: { name: 'A', arbeitsagentur: { keywords: ['ML'], wo: 'Berlin', remoteNationwide: true } },
  });
  assert.equal(jobs.length, 1);
  assert.ok(jobs[0].id.includes('L'), 'primary (Pass A) result preserved');
});
