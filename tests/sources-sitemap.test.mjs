// Sitemap source (CAR-254 port of the parent's providers/sitemap.mjs,
// upstream #6631) — CI-isolated suite.
//
// Generic employer job sitemap connector: `provider: sitemap` (explicit
// only) reads a standard sitemaps.org 0.9 sitemap from any public HTTPS
// employer host, gated by the site's robots.txt (RFC 9309, fail-closed),
// turning every `<loc>` that matches the entry's `job_path` regex into a
// job row (a `(?<slug>…)` group supplies the title, `(?<posting_id>…)` the
// external id, `(?<req_id>…)` the requisition id). The urlset fixture is a
// recorded live employer careers sitemap, trimmed and host-rewritten. No
// test touches the network: robots.txt verdicts come from an injected gate
// and every body from a fake fetchImpl.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  MAX_URLS_PER_SITEMAP,
  MAX_SITEMAP_BYTES,
  titleFromSlug,
  resolveSitemapUrl,
  parseSitemapConfig,
  stripXmlComments,
  parseSitemapDocument,
  jobsFromLocs,
  parseJobPostingJsonLd,
  fetchSitemap,
} from '../server/lib/sources/sitemap.mjs';
import { sitemapAdapter } from '../server/lib/portals/adapters/sitemap.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');

const JOB_PATH = '^/jobs/(?<posting_id>\\d+)/(?<slug>[^/]+)/?$';
const ENTRY = {
  name: 'Acme',
  provider: 'sitemap',
  careers_url: 'https://careers.example.com/jobs/',
  sitemap: { url: 'https://careers.example.com/sitemap.xml', job_path: JOB_PATH },
};
const allowAll = async () => ({ allowed: true, code: 'robots_allowed', reason: 'permits' });

/** Capture console.error lines while `fn` runs. */
async function captureWarnings(fn) {
  const lines = [];
  const orig = console.error;
  console.error = (...args) => { lines.push(args.join(' ')); };
  try { return { result: await fn(), lines }; } finally { console.error = orig; }
}

/** fetchSitemap with a fake transport, an allow-all gate and no wall-clock waits. */
function makeFetch(bodies, opts = {}) {
  const calls = [];
  makeFetchCalls = calls;
  const fetchImpl = async (url, fetchOpts = {}) => {
    calls.push({ url, opts: fetchOpts });
    const body = typeof bodies === 'function' ? await bodies(url, fetchOpts) : bodies[url];
    if (body instanceof Error) throw body;
    if (typeof body !== 'string') throw new Error(`unexpected request ${url}`);
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => body };
  };
  const run = () => fetchSitemap(ENTRY.sitemap.url, {
    fetchImpl, robotsGate: opts.robotsGate || allowAll, sleep: async () => {}, company: ENTRY, ...opts,
  });
  return { calls, run };
}

/** The calls of the most recent makeFetch() instance (the run() closure hides them). */
let makeFetchCalls = [];

// ── registry meta + adapter contract ─────────────────────────────────────────

test('sitemap: meta — value, label, region en; adapter contract shape', () => {
  assert.deepEqual(meta, { value: 'sitemap', label: 'Sitemap', region: 'en' });
  assert.equal(sitemapAdapter.id, 'sitemap');
  assert.equal(typeof sitemapAdapter.matches, 'function');
  assert.equal(typeof sitemapAdapter.buildEndpoint, 'function');
  assert.equal(typeof sitemapAdapter.fetch, 'function');
});

test('sitemap: adapter is explicit-only (provider: sitemap) and builds the configured URL', () => {
  assert.equal(sitemapAdapter.matches(ENTRY), true);
  assert.equal(sitemapAdapter.matches({ name: 'X', provider: 'sitemap', sitemap: { url: 'https://x.example/s.xml', job_path: JOB_PATH } }), true);
  assert.equal(sitemapAdapter.matches({ careers_url: 'https://careers.example.com/sitemap.xml' }), false);
  assert.equal(sitemapAdapter.matches(null), false);
  assert.equal(sitemapAdapter.buildEndpoint(ENTRY), ENTRY.sitemap.url);
  assert.equal(sitemapAdapter.buildEndpoint({ provider: 'sitemap' }), null);
  assert.equal(sitemapAdapter.buildEndpoint({ provider: 'sitemap', sitemap: { url: 'http://x/s.xml' } }), null);
});

// ── config validation (before any request) ───────────────────────────────────

test('sitemap: bad config throws a named error before any request or robots check', async () => {
  const configErrors = [
    [{ ...ENTRY, sitemap: { url: ENTRY.sitemap.url } }, /job_path is required/],
    [{ ...ENTRY, sitemap: { url: ENTRY.sitemap.url, job_path: '^/jobs/(\\d+)/' } }, /\(\?<slug>/],
    [{ ...ENTRY, sitemap: { url: ENTRY.sitemap.url, job_path: '([' } }, /not a valid regex/],
    [{ ...ENTRY, sitemap: { url: 'https://careers.example.com/sitemap.xml.gz', job_path: JOB_PATH } }, /gzipped/],
    [{ ...ENTRY, sitemap: { url: 'http://careers.example.com/sitemap.xml', job_path: JOB_PATH } }, /public https URL/],
  ];
  for (const [entry, re] of configErrors) {
    let calls = 0;
    let gateCalls = 0;
    let message = '';
    try {
      await fetchSitemap(entry.sitemap.url, {
        company: entry,
        robotsGate: async () => { gateCalls += 1; return { allowed: true }; },
        fetchImpl: async () => { calls += 1; return { ok: true, status: 200, text: async () => '' }; },
      });
    } catch (err) { message = err.message; }
    assert.match(message, re, re.source);
    assert.equal(calls, 0, re.source);
    assert.equal(gateCalls, 0, re.source);
  }
  assert.equal(parseSitemapConfig({ ...ENTRY, sitemap: { ...ENTRY.sitemap, index_filter: '' } }).indexFilter, null);
});

test('sitemap: resolveSitemapUrl refuses unsafe URLs', () => {
  for (const url of [
    'http://careers.example.com/sitemap.xml',
    'https://127.0.0.1/sitemap.xml',
    'https://[::1]/sitemap.xml',
    'https://localhost/sitemap.xml',
    'https://jobs.internal/sitemap.xml',
    'https://singlelabel/sitemap.xml',
    'https://user:pass@careers.example.com/sitemap.xml',
    'https://careers.example.com:8443/sitemap.xml',
    'not a url',
    null,
    42,
  ]) {
    assert.equal(resolveSitemapUrl(url), null, String(url));
  }
  const good = resolveSitemapUrl('https://Careers.Example.com./s.xml#frag');
  assert.equal(good.href, 'https://careers.example.com/s.xml');
});

// ── titleFromSlug (eploy's, re-exported) ─────────────────────────────────────

test('sitemap: titleFromSlug rebuilds titles from slugs', () => {
  const titles = [
    ['sr-consultant-value-excellence', 'Sr Consultant Value Excellence'],
    ['data-scientist--uk', 'Data Scientist - UK'],
    ['%E2%9C%93-bad-%E0%A4', '%E2%9C%93 Bad %E0%A4'],
  ];
  for (const [slug, want] of titles) assert.equal(titleFromSlug(slug), want);
});

// ── parseSitemapDocument ─────────────────────────────────────────────────────

test('sitemap: an empty <urlset> parses to zero URLs; a self-closing empty root is a valid empty board', () => {
  const empty = parseSitemapDocument('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  assert.equal(empty.kind, 'urlset');
  assert.equal(empty.locs.length, 0);
  const selfClosing = parseSitemapDocument('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
  assert.equal(selfClosing.kind, 'urlset');
  assert.equal(selfClosing.locs.length, 0);
});

test('sitemap: a root without its closing tag throws as truncated', () => {
  const truncated = [
    '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '<?xml version="1.0"?><urlset><url><loc>https://careers.example.com/jobs/1/a/</loc></url>',
    '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://careers.example.com/s.xml</loc></sitemap>',
  ];
  for (const body of truncated) {
    assert.throws(() => parseSitemapDocument(body), /truncated response/, body);
  }
});

test('sitemap: a zero-byte or blank response throws instead of reading as an empty board', () => {
  for (const body of ['', '   \n', null]) {
    assert.throws(() => parseSitemapDocument(body), /empty response/, String(body));
  }
});

test('sitemap: a bot-challenge / HTML page throws instead of reading as zero jobs', () => {
  assert.throws(
    () => parseSitemapDocument('<!doctype html><title>Just a moment...</title>'),
    /expected an XML <urlset> or <sitemapindex>/,
  );
});

test('sitemap: <loc> XML entities are decoded and CDATA is unwrapped', () => {
  const doc = parseSitemapDocument('<urlset><url><loc>https://careers.example.com/jobs/1/r%26d-lead/?a=1&amp;b=2</loc></url><url><loc><![CDATA[https://careers.example.com/jobs/2/cdata-role/]]></loc></url></urlset>');
  assert.equal(doc.locs[0], 'https://careers.example.com/jobs/1/r%26d-lead/?a=1&b=2');
  assert.equal(doc.locs[1], 'https://careers.example.com/jobs/2/cdata-role/');
});

test('sitemap: XML comments are ignored', () => {
  assert.throws(
    () => parseSitemapDocument('<urlset><url><loc>https://careers.example.com/jobs/1/a/</loc></url><!-- </urlset> -->'),
    /truncated response/,
  );
  const commented = parseSitemapDocument('<urlset><!-- <url><loc>https://careers.example.com/jobs/9/ghost/</loc></url> --><url><loc>https://careers.example.com/jobs/1/a/</loc></url></urlset>');
  assert.equal(commented.locs.length, 1);
  assert.ok(commented.locs[0].endsWith('/jobs/1/a/'));
});

test('sitemap: stripXmlComments removes comments in one linear pass; an unterminated comment drops the rest', () => {
  const cases = [
    ['a<!-- x -->b', 'ab'],
    ['a<!--<!-- x -->-->b', 'a-->b'],
    ['a<!-- x --><!-- y -->b', 'ab'],
    ['<<!-- -->!-- x', '<!-- x'],
    ['a<!-- never closed <urlset>', 'a'],
  ];
  for (const [input, want] of cases) assert.equal(stripXmlComments(input), want, input);
});

// ── jobsFromLocs ─────────────────────────────────────────────────────────────

test('sitemap: req_id → requisitionId; off-host, suffix-spoofed, http and non-job URLs are dropped', () => {
  const reqJobs = jobsFromLocs([
    'https://careers.example.com/job/R-100/finance-manager',
    'https://careers.example.com/job/R-100/finance-manager?utm=x',
    'https://other.example.com/job/R-200/spoofed',
    'https://careers.example.com.evil.example/job/R-300/suffix-spoof',
    'http://careers.example.com/job/R-400/plain-http',
    'https://careers.example.com/about/',
  ], { url: new URL(ENTRY.sitemap.url), jobPath: /^\/job\/(?<req_id>R-\d+)\/(?<slug>[^/]+)$/ }, 'Acme');
  assert.equal(reqJobs.length, 2);
  assert.equal(reqJobs[0].requisitionId, 'R-100');
  assert.equal('externalId' in reqJobs[0], false);
  for (const j of reqJobs) assert.ok(j.url.startsWith('https://careers.example.com/job/R-100/'));
});

// ── recorded urlset end to end ───────────────────────────────────────────────

test('sitemap: the recorded urlset yields 10 job rows — slug titles, posting id → externalId, lastmod never a date', async () => {
  const { run, calls } = makeFetch({ [ENTRY.sitemap.url]: fixture('sitemap-employer-urlset.xml') });
  const jobs = await run();
  const first = jobs[0];
  assert.equal(jobs.length, 10);
  assert.equal(first.title, 'Associate Customer Success Manager French');
  assert.equal(first.url, 'https://careers.example.com/jobs/744000159261519/associate-customer-success-manager-french/');
  assert.equal(first.externalId, '744000159261519');
  assert.equal('requisitionId' in first, false);
  assert.equal(first.company, 'Acme');
  assert.equal(first.location, '');
  assert.ok(jobs.every((j) => !('postedAt' in j) || j.date === ''));
  assert.equal(first.date, '');
  assert.equal(first.source, 'sitemap');
  assert.equal(first.id, `sitemap-${first.url}`);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ENTRY.sitemap.url);
  assert.equal(calls[0].opts.redirect, 'error');
  assert.ok(MAX_SITEMAP_BYTES === 52_428_800 && MAX_URLS_PER_SITEMAP === 50_000);
});

// ── robots.txt gate ──────────────────────────────────────────────────────────

test('sitemap: a robots.txt disallow is refused with a named error and no fetch', async () => {
  let robotsCalls = 0;
  let fetchCalls = 0;
  let err = null;
  try {
    await fetchSitemap(ENTRY.sitemap.url, {
      company: ENTRY,
      robotsGate: async () => { robotsCalls += 1; return { allowed: false, code: 'robots_disallowed', reason: 'disallows /sitemap.xml for career-ops' }; },
      fetchImpl: async () => { fetchCalls += 1; return { ok: true, status: 200, text: async () => '' }; },
    });
  } catch (e) { err = e; }
  assert.equal(err?.code, 'robots_disallowed');
  assert.match(err?.message || '', /robots\.txt disallows/);
  assert.equal(fetchCalls, 0);
  assert.equal(robotsCalls, 1);
});

test('sitemap: a sitemap whose URLs match no job_path throws (not a silent empty board)', async () => {
  let message = '';
  try {
    await fetchSitemap(ENTRY.sitemap.url, {
      company: { ...ENTRY, sitemap: { ...ENTRY.sitemap, job_path: '^/careers/(?<slug>[^/]+)$' } },
      robotsGate: allowAll,
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => fixture('sitemap-employer-urlset.xml') }),
    });
  } catch (err) { message = err.message; }
  assert.match(message, /22 sitemap URLs but none matched job_path/);
  const { run } = makeFetch({ [ENTRY.sitemap.url]: '<?xml version="1.0"?><urlset></urlset>' });
  const emptyJobs = await run();
  assert.deepEqual(emptyJobs, []);
});

// ── sitemap index ────────────────────────────────────────────────────────────

const CHILD1 = '<urlset><url><loc>https://careers.example.com/jobs/1/strategy-manager/</loc></url></urlset>';
const CHILD2 = '<urlset><url><loc>https://careers.example.com/jobs/2/bizops-lead/</loc></url><url><loc>https://careers.example.com/jobs/1/strategy-manager/</loc></url></urlset>';
const indexBodies = (url) => {
  if (url.endsWith('/sitemap.xml')) return fixture('sitemap-employer-index.xml');
  if (url.endsWith('/sitemap-jobs-1.xml')) return CHILD1;
  if (url.endsWith('/sitemap-jobs-2.xml')) return CHILD2;
  throw new Error(`unexpected ${url}`);
};

test('sitemap: index walk applies index_filter, same-host and .gz rules; every request is redirect-blocked', async () => {
  const { result: indexJobs, lines: warn } = await captureWarnings(() => makeFetch(indexBodies, {
    company: { ...ENTRY, sitemap: { ...ENTRY.sitemap, index_filter: 'sitemap-jobs' } },
  }).run());
  const calls = makeFetchCalls;
  const urls = calls.map((c) => c.url);
  assert.equal(indexJobs.length, 2);
  assert.equal(urls.length, 3);
  assert.ok(!urls.some((u) => u.includes('evil') || u.includes('pages') || u.endsWith('.gz')));
  assert.ok(calls.every((c) => c.opts.redirect === 'error'));
  assert.ok(warn.some((l) => /gzipped child sitemap/.test(l)));
  // A posting listed in two children comes back once.
  assert.equal(indexJobs.filter((j) => j.url.includes('strategy-manager')).length, 1);
});

test('sitemap: max_sitemaps caps child fetches and warns naming the knob', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const body = indexBodies(url);
    if (body instanceof Error) throw body;
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => body };
  };
  const { result: cappedJobs, lines: warn } = await captureWarnings(() => fetchSitemap(ENTRY.sitemap.url, {
    fetchImpl, robotsGate: allowAll, sleep: async () => {},
    company: { ...ENTRY, sitemap: { ...ENTRY.sitemap, index_filter: 'sitemap-jobs', max_sitemaps: 1 } },
  }));
  assert.equal(cappedJobs.length, 1);
  assert.ok(warn.some((l) => /lists 2 child sitemaps; read the first 1, raise sitemap\.max_sitemaps/.test(l)));
});

test('sitemap: nested index and robots-denied children are skipped with warnings; no usable child throws', async () => {
  let nestedErr = '';
  const fetchImpl = async (url) => {
    if (url.endsWith('/sitemap.xml')) return { ok: true, status: 200, headers: { get: () => null }, text: async () => fixture('sitemap-employer-index.xml') };
    if (url.endsWith('/sitemap-jobs-1.xml')) return { ok: true, status: 200, headers: { get: () => null }, text: async () => '<sitemapindex><sitemap><loc>https://careers.example.com/x.xml</loc></sitemap></sitemapindex>' };
    throw new Error(`unexpected ${url}`);
  };
  const { lines: warn } = await captureWarnings(async () => {
    try {
      await fetchSitemap(ENTRY.sitemap.url, {
        fetchImpl, sleep: async () => {},
        robotsGate: async (url) => (url.endsWith('/sitemap-jobs-2.xml')
          ? { allowed: false, code: 'robots_disallowed', reason: 'disallows /sitemap-jobs-2.xml for career-ops' }
          : allowAll()),
        company: { ...ENTRY, sitemap: { ...ENTRY.sitemap, index_filter: 'sitemap-jobs' } },
      });
    } catch (err) { nestedErr = err.message; }
  });
  assert.match(nestedErr, /none of the 2 child sitemaps read could be used/);
  assert.ok(warn.some((l) => /nested sitemap index/.test(l)));
  assert.ok(warn.some((l) => /skipped child sitemap .*sitemap-jobs-2\.xml: robots\.txt disallows/.test(l)));
});

test('sitemap: an index_filter matching no child throws instead of returning an empty board', async () => {
  let typoErr = '';
  let typoCalls = 0;
  try {
    await fetchSitemap(ENTRY.sitemap.url, {
      fetchImpl: async (url) => {
        typoCalls += 1;
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => fixture('sitemap-employer-index.xml') };
      },
      robotsGate: allowAll, sleep: async () => {},
      company: { ...ENTRY, sitemap: { ...ENTRY.sitemap, index_filter: 'sitemap-jbos' } },
    });
  } catch (err) { typoErr = err.message; }
  assert.match(typoErr, /lists 5 child sitemaps but none is usable .*index_filter sitemap-jbos/);
  assert.equal(typoCalls, 1);
});

test('sitemap: an index with no <sitemap> entries throws (only an empty <urlset> is an empty board)', async () => {
  let emptyIndexErr = '';
  try {
    await fetchSitemap(ENTRY.sitemap.url, {
      fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => '<?xml version="1.0"?><sitemapindex></sitemapindex>' }),
      robotsGate: allowAll, sleep: async () => {}, company: ENTRY,
    });
  } catch (err) { emptyIndexErr = err.message; }
  assert.match(emptyIndexErr, /lists no child sitemaps/);
});

test('sitemap: a failing child sitemap is reported and the rest are kept', async () => {
  const fetchImpl = async (url) => {
    const body = url.endsWith('/sitemap-jobs-1.xml')
      ? Object.assign(new Error('HTTP 404'), { status: 404 })
      : indexBodies(url);
    if (body instanceof Error) throw body;
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => body };
  };
  const { result: partialJobs, lines: warn } = await captureWarnings(() => fetchSitemap(ENTRY.sitemap.url, {
    fetchImpl, robotsGate: allowAll, sleep: async () => {},
    company: { ...ENTRY, sitemap: { ...ENTRY.sitemap, index_filter: 'sitemap-jobs' } },
  }));
  assert.equal(partialJobs.length, 2);
  assert.ok(warn.some((l) => /sitemap-jobs-1\.xml failed .*missing from this scan/.test(l)));
});

// ── the 50,000-URL per-file protocol limit ───────────────────────────────────

test('sitemap: a file over the protocol 50,000-URL limit is capped with a warning', async () => {
  const big = `<urlset>${Array.from({ length: 50_002 }, (_, i) => `<url><loc>https://careers.example.com/jobs/${i}/role-${i}/</loc></url>`).join('')}</urlset>`;
  const { result: bigJobs, lines: warn } = await captureWarnings(() => makeFetch({ [ENTRY.sitemap.url]: big }).run());
  assert.equal(bigJobs.length, 50_000);
  assert.ok(warn.some((l) => /50002 URLs, over the protocol's 50000-per-file limit/.test(l)));
});

// ── parseJobPostingJsonLd ────────────────────────────────────────────────────

test('sitemap: JSON-LD JobPosting (@graph) → title, location, description, datePosted; entities decoded', () => {
  const detail = parseJobPostingJsonLd(fixture('sitemap-employer-detail.html'));
  assert.equal(detail.title, 'Senior Strategy & Operations Manager');
  assert.equal(detail.location, 'Santa Clara, CA, US');
  assert.match(detail.description || '', /Own the operating plan & business reviews\./);
  assert.equal(detail.postedAt, Date.parse('2026-10-30'));
  assert.equal(Object.keys(parseJobPostingJsonLd('<script type="application/ld+json">oops</script>')).length, 0);
  assert.equal(Object.keys(parseJobPostingJsonLd('<!doctype html><title>Just a moment...</title>')).length, 0);
  assert.equal(Object.keys(parseJobPostingJsonLd('')).length, 0);
});

// ── fetchDetails: bounded, robots-checked, fail-open ─────────────────────────

test('sitemap: fetchDetails enriches, capped at detailLimit, robots-checked, warns on the cap, fails open', async () => {
  const detailCalls = [];
  const sleeps = [];
  const detailGate = [];
  const detailEntry = { ...ENTRY, sitemap: { ...ENTRY.sitemap, fetchDetails: true, detailLimit: 2 } };
  const fetchImpl = async (url) => {
    if (url === ENTRY.sitemap.url) return { ok: true, status: 200, headers: { get: () => null }, text: async () => fixture('sitemap-employer-urlset.xml') };
    detailCalls.push(url);
    if (url.includes('744000158473789')) throw new Error('HTTP 503');
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => fixture('sitemap-employer-detail.html') };
  };
  const { result: enriched, lines: warn } = await captureWarnings(() => fetchSitemap(ENTRY.sitemap.url, {
    fetchImpl,
    sleep: async (ms) => { sleeps.push(ms); },
    robotsGate: async (url) => { detailGate.push(url); return allowAll(); },
    titleWanted: (title) => /manager|engineer|executive/i.test(title),
    company: detailEntry,
  }));
  const kept = enriched.filter((j) => j.title === 'Senior Strategy & Operations Manager');
  assert.equal(detailCalls.length, 4); // one success + the 503 retried twice (1 attempt + 2 retries), then kept fail-open
  assert.ok(detailCalls.every((u) => u.startsWith('https://careers.example.com/jobs/')));
  assert.equal(detailGate.filter((u) => u.includes('/jobs/')).length, 2);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].location, 'Santa Clara, CA, US');
  assert.equal(kept[0].date, new Date(Date.parse('2026-10-30')).toISOString());
  assert.ok(kept[0].snippet.length > 0);
  assert.equal(enriched.length, 10);
  assert.ok(warn.some((l) => /qualify for detail enrichment; enriched 2, raise sitemap\.detailLimit/.test(l)));
  // Two candidates fit one DETAIL_BATCH (3), so the batch pacing pause is not owed here.
  assert.deepEqual(sleeps, []);
});

test('sitemap: without fetchDetails no detail page is fetched; a denied detail keeps its sitemap row', async () => {
  // Default (no fetchDetails): one sitemap request only.
  const plain = makeFetch({ [ENTRY.sitemap.url]: fixture('sitemap-employer-urlset.xml') });
  const jobs = await plain.run();
  assert.equal(plain.calls.length, 1);
  assert.equal(jobs.length, 10);

  // Robots-denied detail pages are not fetched; rows keep their sitemap title.
  const deniedCalls = [];
  const fetchImpl = async (url) => {
    deniedCalls.push(url);
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => fixture('sitemap-employer-urlset.xml') };
  };
  const { result: deniedJobs, lines: warn } = await captureWarnings(() => fetchSitemap(ENTRY.sitemap.url, {
    fetchImpl, sleep: async () => {},
    robotsGate: async (url) => (url.includes('/jobs/') ? { allowed: false, code: 'robots_disallowed', reason: 'disallows' } : allowAll()),
    company: { ...ENTRY, sitemap: { ...ENTRY.sitemap, fetchDetails: true, detailLimit: 2 } },
  }));
  assert.equal(deniedCalls.length, 1);
  assert.equal(deniedJobs.length, 10);
  assert.ok(warn.some((l) => /robots\.txt disallows 2 detail page/.test(l)));
});

// ── probe (opts.maxPages) ────────────────────────────────────────────────────

test('sitemap: a maxPages probe makes one request on a urlset and no detail requests', async () => {
  const probeCalls = [];
  const fetchImpl = async (url) => {
    probeCalls.push(url);
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => fixture('sitemap-employer-urlset.xml') };
  };
  const probed = await fetchSitemap(ENTRY.sitemap.url, {
    fetchImpl, robotsGate: allowAll, sleep: async () => {}, maxPages: 1,
    company: { ...ENTRY, sitemap: { ...ENTRY.sitemap, fetchDetails: true } },
  });
  assert.equal(probeCalls.length, 1);
  assert.equal(probed.length, 10);
});

test('sitemap: a probe reads one child of an index; a child failure during a probe propagates unwrapped', async () => {
  const probeErr = new Error('budget');
  let rootSeen = false;
  let probeSeen = null;
  await captureWarnings(async () => {
    try {
      await fetchSitemap(ENTRY.sitemap.url, {
        fetchImpl: async () => {
          const body = rootSeen ? probeErr : fixture('sitemap-employer-index.xml');
          rootSeen = true;
          if (body instanceof Error) throw body;
          return { ok: true, status: 200, headers: { get: () => null }, text: async () => body };
        },
        robotsGate: allowAll, sleep: async () => {}, maxPages: 1,
        company: { ...ENTRY, sitemap: { ...ENTRY.sitemap, index_filter: 'sitemap-jobs' } },
      });
    } catch (err) { probeSeen = err; }
  });
  assert.equal(probeSeen, probeErr);
});
