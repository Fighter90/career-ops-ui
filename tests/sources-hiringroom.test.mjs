/**
 * HiringRoom source + adapter — ported from parent career-ops
 * `tests/providers/hiringroom.test.mjs` (legacy `/jobs` cards and the newer
 * JSON-LD `/portal/jobs` layout), plus web-ui contract checks.
 *
 * Quirks pinned here, all easy to undo by accident:
 *   - JSON-LD wins over card markup; the card parser is only the fallback.
 *   - JSON-LD posting URLs are advertised as http:// — they are rebuilt on the
 *     validated https origin, and a foreign-host or non-vacancy URL is dropped.
 *   - Apply links (`…/candidates/new`) and title-less card blocks are dropped;
 *     a repeated card is deduped.
 *   - `evil-hiringroom.com` is a look-alike, not a subdomain.
 *
 * CI-isolated: fake fetchImpl, no network, no parent checkout, no port binding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  MAX_JOBS,
  assertHiringRoomUrl,
  isHiringRoomHost,
  parseHiringRoomJobs,
  fetchHiringRoom,
} from '../server/lib/sources/hiringroom.mjs';
import { hiringroomAdapter } from '../server/lib/portals/adapters/hiringroom.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

// ── fixtures (mirroring the parent's) ───────────────────────────────────────

// Two real cards (one with an HTML entity + whitespace in the title), one
// apply link (dropped), one anchor whose block has no title (dropped), and a
// duplicate of card 1 (deduped).
const LEGACY_HTML = `
  <a href="/jobs/get_vacancy/aaa111" class="text-decoration-none">
    <div class="card p-3">
      <div class="card-vacancy">
        <h4 class="font-black fs-20 name__vacancy"> Senior Python Backend Engineer (USA) </h4>
        <p class="card-text"><span><i class="hr-Location-pin hrc-black"></i> Argentina </span></p>
      </div>
    </div>
  </a>
  <a href="/jobs/get_vacancy/bbb222" class="text-decoration-none">
    <div class="card p-3">
      <div class="card-vacancy">
        <h4 class="fs-20 name__vacancy"> Desarrollador Go &amp; Cloud </h4>
        <p class="card-text"><span><i class="hr-Location-pin hrc-black"></i> Remoto </span></p>
      </div>
    </div>
  </a>
  <a href="/jobs/get_vacancy/aaa111/candidates/new">Postularme</a>
  <a href="/jobs/get_vacancy/ccc333" class="text-decoration-none">
    <div class="card p-3"><div class="card-vacancy"><h5>No title here</h5></div></div>
  </a>
  <a href="/jobs/get_vacancy/aaa111" class="text-decoration-none">
    <div class="card p-3"><div class="card-vacancy"><h4 class="name__vacancy"> Senior Python Backend Engineer (USA) </h4></div></div>
  </a>`;

const LD = {
  '@context': 'https://schema.org', '@type': 'ItemList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, item: {
      '@type': 'JobPosting', title: ' Ingeniero/a de Producci&oacute;n ',
      jobLocation: { '@type': 'Place', address: 'La Plata, Buenos Aires, Argentina' },
      description: '<p>Gestionar la ingenier&iacute;a de <strong>producci&oacute;n</strong>.</p>\n<p>Turnos rotativos.</p>',
      datePosted: '2026-09-08',
      url: 'http://acme.hiringroom.com/jobs/get_vacancy/6aa02812d6589654b9d9ff67' } },
    { '@type': 'ListItem', position: 2, item: {
      '@type': 'JobPosting', title: 'Operario/a de Mantenimiento',
      jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Puerto Madryn', addressRegion: 'Chubut', addressCountry: 'Argentina' } },
      datePosted: 'not-a-date',
      url: 'https://acme.hiringroom.com/jobs/get_vacancy/68a629f6a7b3ca2fd423e61b' } },
    { '@type': 'ListItem', position: 3, item: {
      '@type': 'JobPosting', title: 'Elsewhere',
      url: 'https://evil.example.com/jobs/get_vacancy/aaa111' } },
    { '@type': 'ListItem', position: 4, item: {
      '@type': 'JobPosting', title: 'Not a vacancy',
      url: 'https://acme.hiringroom.com/portal' } },
  ],
};

const PORTAL_HTML = `<html><head>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script>
  <script type="application/ld+json">${JSON.stringify(LD)}</script>
  </head><body><a href="https://acme.hiringroom.com/jobs/get_vacancy/6aa02812d6589654b9d9ff67">Ver</a></body></html>`;

/** A fetchText-compatible stub that records every call and serves one body. */
function htmlFetch(html, { status = 200 } = {}) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: status >= 200 && status < 300, status, headers: new Map(), text: async () => html };
  };
  return { impl, calls };
}

// ── meta / host pin ─────────────────────────────────────────────────────────

test('meta is registry-shaped', () => {
  assert.deepEqual(meta, { value: 'hiringroom', label: 'HiringRoom', region: 'en' });
});

test('isHiringRoomHost: apex + subdomains only, never a look-alike', () => {
  assert.equal(isHiringRoomHost('hiringroom.com'), true);
  assert.equal(isHiringRoomHost('growuphr.hiringroom.com'), true);
  assert.equal(isHiringRoomHost('GrowUpHR.HiringRoom.com'), true);
  assert.equal(isHiringRoomHost('evil-hiringroom.com'), false);
  assert.equal(isHiringRoomHost('hiringroom.com.evil.test'), false);
  assert.equal(isHiringRoomHost('evil.test'), false);
  assert.equal(isHiringRoomHost(undefined), false);
});

test('assertHiringRoomUrl: HTTPS-only, host-pinned, names the offending value', () => {
  assert.equal(assertHiringRoomUrl('https://acme.hiringroom.com/portal/jobs').origin, 'https://acme.hiringroom.com');
  assert.throws(() => assertHiringRoomUrl('http://acme.hiringroom.com/jobs'), /must use HTTPS/);
  assert.throws(() => assertHiringRoomUrl('https://evil.example.com/jobs'), /untrusted hostname "evil\.example\.com"/);
  assert.throws(() => assertHiringRoomUrl('https://evil-hiringroom.com/jobs'), /untrusted hostname/);
  assert.throws(() => assertHiringRoomUrl('not a url'), /invalid URL/);
});

// ── adapter ─────────────────────────────────────────────────────────────────

test('adapter: id/label/fetch surface', () => {
  assert.equal(hiringroomAdapter.id, 'hiringroom');
  assert.equal(hiringroomAdapter.label, 'HiringRoom');
  assert.equal(hiringroomAdapter.fetch, fetchHiringRoom);
});

test('adapter.matches: claims *.hiringroom.com (parent detect()), rejects others and look-alikes', () => {
  assert.equal(hiringroomAdapter.matches({ careers_url: 'https://growuphr.hiringroom.com/jobs' }), true);
  assert.equal(hiringroomAdapter.matches({ api: 'https://acme.hiringroom.com/portal/jobs' }), true);
  assert.equal(hiringroomAdapter.matches({ provider: 'hiringroom' }), true);
  assert.equal(hiringroomAdapter.matches({ careers_url: 'https://jobs.lever.co/acme' }), false);
  assert.equal(hiringroomAdapter.matches({ careers_url: 'https://evil-hiringroom.com/jobs' }), false);
  assert.equal(hiringroomAdapter.matches({ careers_url: 'http://acme.hiringroom.com/jobs' }), false);
  // An explicit different provider wins over the host.
  assert.equal(hiringroomAdapter.matches({ provider: 'lever', careers_url: 'https://acme.hiringroom.com/jobs' }), false);
  assert.equal(hiringroomAdapter.matches({}), false);
  assert.equal(hiringroomAdapter.matches(null), false);
});

test('adapter.buildEndpoint: string for a pinnable URL, null otherwise — never an object', () => {
  assert.equal(
    hiringroomAdapter.buildEndpoint({ careers_url: 'https://growuphr.hiringroom.com/jobs' }),
    'https://growuphr.hiringroom.com/jobs',
  );
  assert.equal(
    hiringroomAdapter.buildEndpoint({ api: 'https://acme.hiringroom.com/portal/jobs', careers_url: 'https://acme.example.com' }),
    'https://acme.hiringroom.com/portal/jobs',
  );
  // A foreign api falls through to a pinnable careers_url.
  assert.equal(
    hiringroomAdapter.buildEndpoint({ api: 'https://evil.example.com/', careers_url: 'https://acme.hiringroom.com/jobs' }),
    'https://acme.hiringroom.com/jobs',
  );
  assert.equal(hiringroomAdapter.buildEndpoint({ provider: 'hiringroom', careers_url: 'https://evil.example.com/jobs' }), null);
  assert.equal(hiringroomAdapter.buildEndpoint({ provider: 'hiringroom' }), null);
});

// ── legacy /jobs cards ──────────────────────────────────────────────────────

test('legacy: keeps 2 cards (drops apply link, title-less block, dedups repeat)', () => {
  const jobs = parseHiringRoomJobs(LEGACY_HTML, 'https://growuphr.hiringroom.com', 'Grow UP HR');
  assert.deepEqual(jobs.map((j) => new URL(j.url).pathname), [
    '/jobs/get_vacancy/aaa111',
    '/jobs/get_vacancy/bbb222',
  ]);
});

test('legacy: maps title/url/company/location, trims whitespace, web-ui row shape', () => {
  const [j0] = parseHiringRoomJobs(LEGACY_HTML, 'https://growuphr.hiringroom.com', 'Grow UP HR');
  assert.deepEqual(j0, {
    id: 'hiringroom-growuphr.hiringroom.com-aaa111',
    title: 'Senior Python Backend Engineer (USA)',
    company: 'Grow UP HR',
    url: 'https://growuphr.hiringroom.com/jobs/get_vacancy/aaa111',
    salary: '',
    location: 'Argentina',
    isRemote: false,
    workplaceType: '',
    relocates: false,
    date: '',
    snippet: '',
    source: 'hiringroom',
  });
  assert.equal('description' in j0, false);
});

test('legacy: decodes HTML entities in the title and reads the location after the pin icon', () => {
  const jobs = parseHiringRoomJobs(LEGACY_HTML, 'https://growuphr.hiringroom.com', 'Grow UP HR');
  assert.equal(jobs[1].title, 'Desarrollador Go & Cloud');
  assert.equal(jobs[1].location, 'Remoto');
  // Spanish "Remoto" is a remote signal.
  assert.equal(jobs[1].isRemote, true);
  assert.equal(jobs[1].workplaceType, 'Remote');
});

test('legacy: blank company label falls back to "HiringRoom"', () => {
  const jobs = parseHiringRoomJobs(LEGACY_HTML, 'https://growuphr.hiringroom.com', '   ');
  assert.equal(jobs[0].company, 'HiringRoom');
});

test('parse: non-string / empty html and an unusable origin yield []', () => {
  assert.deepEqual(parseHiringRoomJobs(undefined, 'https://a.hiringroom.com', 'A'), []);
  assert.deepEqual(parseHiringRoomJobs('', 'https://a.hiringroom.com', 'A'), []);
  assert.deepEqual(parseHiringRoomJobs('<html><body>nothing</body></html>', 'https://a.hiringroom.com', 'A'), []);
  assert.deepEqual(parseHiringRoomJobs(LEGACY_HTML, 'not a url', 'A'), []);
});

test('legacy: row count is capped at MAX_JOBS', () => {
  const cards = Array.from({ length: MAX_JOBS + 5 }, (_, i) =>
    `<a href="/jobs/get_vacancy/${i.toString(16)}f"><h4 class="name__vacancy">Job ${i}</h4></a>`).join('');
  assert.equal(parseHiringRoomJobs(cards, 'https://a.hiringroom.com', 'A').length, MAX_JOBS);
});

// ── /portal/jobs JSON-LD ────────────────────────────────────────────────────

test('portal: reads the JSON-LD listing (drops foreign-host and non-vacancy urls)', () => {
  const pj = parseHiringRoomJobs(PORTAL_HTML, 'https://acme.hiringroom.com', 'Acme');
  assert.deepEqual(pj.map((j) => j.url), [
    'https://acme.hiringroom.com/jobs/get_vacancy/6aa02812d6589654b9d9ff67',
    'https://acme.hiringroom.com/jobs/get_vacancy/68a629f6a7b3ca2fd423e61b',
  ]);
});

test('portal: maps title/url/location, forcing the https origin', () => {
  const [p0] = parseHiringRoomJobs(PORTAL_HTML, 'https://acme.hiringroom.com', 'Acme');
  assert.equal(p0.url, 'https://acme.hiringroom.com/jobs/get_vacancy/6aa02812d6589654b9d9ff67');
  assert.equal(new URL(p0.url).protocol, 'https:');
  assert.equal(p0.title, 'Ingeniero/a de Producción');
  assert.equal(p0.company, 'Acme');
  assert.equal(p0.location, 'La Plata, Buenos Aires, Argentina');
  assert.equal(p0.source, 'hiringroom');
});

test('portal: maps datePosted to an ISO date', () => {
  const [p0] = parseHiringRoomJobs(PORTAL_HTML, 'https://acme.hiringroom.com', 'Acme');
  assert.equal(p0.date, '2026-09-08');
});

test('portal: flattens the JSON-LD description to plain text (and snippets it)', () => {
  const [p0] = parseHiringRoomJobs(PORTAL_HTML, 'https://acme.hiringroom.com', 'Acme');
  assert.equal(p0.description, 'Gestionar la ingeniería de producción. Turnos rotativos.');
  assert.equal(p0.snippet, p0.description);
});

test('portal: joins a PostalAddress and leaves an unparseable datePosted empty', () => {
  const [, p1] = parseHiringRoomJobs(PORTAL_HTML, 'https://acme.hiringroom.com', 'Acme');
  assert.equal(p1.location, 'Puerto Madryn, Chubut, Argentina');
  assert.equal(p1.date, '');
  assert.equal('description' in p1, false);
});

test('portal: JSON-LD wins over card markup on the same page', () => {
  const mixed = PORTAL_HTML.replace('</body>', `${LEGACY_HTML}</body>`);
  const jobs = parseHiringRoomJobs(mixed, 'https://acme.hiringroom.com', 'Acme');
  assert.deepEqual(jobs.map((j) => new URL(j.url).pathname), [
    '/jobs/get_vacancy/6aa02812d6589654b9d9ff67',
    '/jobs/get_vacancy/68a629f6a7b3ca2fd423e61b',
  ]);
});

test('portal: a malformed JSON-LD block is skipped, not fatal; TELECOMMUTE marks remote', () => {
  const ld = { itemListElement: [{ item: {
    '@type': 'JobPosting', title: 'Dev', jobLocationType: 'TELECOMMUTE',
    url: 'https://acme.hiringroom.com/jobs/get_vacancy/abc123' } }] };
  const html = `<script type="application/ld+json">{ not json</script>
    <script type="application/ld+json">${JSON.stringify(ld)}</script>`;
  const jobs = parseHiringRoomJobs(html, 'https://acme.hiringroom.com', 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].workplaceType, 'Remote');
});

test('portal: a JSON-LD page with no usable postings falls back to the legacy cards', () => {
  const html = `<script type="application/ld+json">{"@type":"Organization","name":"X"}</script>${LEGACY_HTML}`;
  assert.equal(parseHiringRoomJobs(html, 'https://growuphr.hiringroom.com', 'G').length, 2);
});

// ── fetch ───────────────────────────────────────────────────────────────────

test('fetch: GETs the careers_url with redirect:"error" + browser UA, labels rows with entry.name', async () => {
  const { impl, calls } = htmlFetch(LEGACY_HTML);
  const company = { name: 'Grow UP HR', careers_url: 'https://growuphr.hiringroom.com/jobs', provider: 'hiringroom' };
  const endpoint = hiringroomAdapter.buildEndpoint(company);
  const jobs = await hiringroomAdapter.fetch(endpoint, { fetchImpl: impl, company });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://growuphr.hiringroom.com/jobs');
  assert.equal(calls[0].opts.redirect, 'error');
  assert.equal(calls[0].opts.headers['User-Agent'], BROWSER_LIKE_USER_AGENT);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].company, 'Grow UP HR');
});

test('fetch: /portal/jobs endpoint parses the JSON-LD layout', async () => {
  const { impl, calls } = htmlFetch(PORTAL_HTML);
  const jobs = await fetchHiringRoom('https://acme.hiringroom.com/portal/jobs', { fetchImpl: impl, company: { name: 'Acme' } });
  assert.equal(calls[0].url, 'https://acme.hiringroom.com/portal/jobs');
  assert.equal(jobs.length, 2);
});

test('fetch: an untrusted hostname or http URL throws before any request', async () => {
  const { impl, calls } = htmlFetch(LEGACY_HTML);
  await assert.rejects(
    fetchHiringRoom('https://evil.example.com/jobs', { fetchImpl: impl, company: { name: 'X' } }),
    /untrusted hostname/,
  );
  await assert.rejects(
    fetchHiringRoom('http://acme.hiringroom.com/jobs', { fetchImpl: impl, company: { name: 'X' } }),
    /must use HTTPS/,
  );
  assert.equal(calls.length, 0);
});

test('fetch: a non-2xx throws with .status (scanner logs it per company / quarantines 404)', async () => {
  const { impl } = htmlFetch('gone', { status: 404 });
  await assert.rejects(
    fetchHiringRoom('https://acme.hiringroom.com/jobs', { fetchImpl: impl, company: { name: 'Acme' } }),
    (err) => err.status === 404,
  );
});

test('fetch: a 200 HTML challenge page throws instead of reading as an empty board', async () => {
  // A bot-wall answer references nothing HiringRoom-shaped: no tenant host, no
  // /jobs/get_vacancy/ links, no JSON-LD.
  const challenge = '<html><head><title>Access denied</title></head><body>Checking your browser…</body></html>';
  const { impl } = htmlFetch(challenge);
  await assert.rejects(
    fetchHiringRoom('https://acme.hiringroom.com/jobs', { fetchImpl: impl, company: { name: 'Acme' } }),
    /not a HiringRoom microsite/,
  );
});

test('fetch: a 200 non-HTML garbage body throws too', async () => {
  const { impl } = htmlFetch('Maintenance — come back later');
  await assert.rejects(
    fetchHiringRoom('https://acme.hiringroom.com/jobs', { fetchImpl: impl, company: { name: 'Acme' } }),
    /not a HiringRoom microsite/,
  );
});

test('fetch: an empty legacy board (shell only, zero vacancies) stays a legitimate []', async () => {
  // The shell still references the tenant host + apply paths — no false alarm.
  const emptyBoard = '<html><body><h1>¡Oportunidades de Empleo en Acme!</h1>'
    + '<a href="https://acme.hiringroom.com/jobs/get_vacancy_placeholder">Apply</a></body></html>';
  const { impl } = htmlFetch(emptyBoard);
  const jobs = await fetchHiringRoom('https://acme.hiringroom.com/jobs', { fetchImpl: impl, company: { name: 'Acme' } });
  assert.deepEqual(jobs, []);
});
