/**
 * Deel source (upstream #6189 port) — CI-isolated suite.
 * jobs.deel.com tenant boards are server-rendered by Next.js: the whole
 * inventory rides in the RSC ("flight") payload, and each description is a
 * `$<hex>` reference to a length-prefixed text row. The parser must fail
 * CLOSED on a missing container (a silent zero would look like an empty
 * board) while a present-and-empty one is []. Ported cases: slug extraction
 * (https + exact host + first-segment slug), flight-stream chunk concat (a
 * broken chunk must not lose the board), text-row UTF-8 byte lengths, the
 * posting mapping (title/locations/arrangement/dates/description ref-resolve,
 * no salary without a pay interval), the fail-closed parse gates, and the
 * fetch contract (one request to the board root, redirect:'error', a refused
 * redirect reported by name). No network — parseDeelBoard is pure;
 * fetchDeel runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  SLUG_RE,
  assertDeelUrl,
  extractSlug,
  resolveSlug,
  boardUrlFor,
  readFlightStream,
  readTextRows,
  parseDeelBoard,
  fetchDeel,
} from '../server/lib/sources/deel.mjs';
import { deelAdapter } from '../server/lib/portals/adapters/deel.mjs';
import { resolveAdapter, ALL_ADAPTERS } from '../server/lib/portals/registry.mjs';

// ── fixtures: a page the way Next.js ships it ────────────────────────────────

/** Wrap an RSC stream the way the page does: one push per chunk, JSON-string escaped. */
function pageWith(stream, { title = 'Acme Careers' } = {}) {
  const chunks = [];
  for (let i = 0; i < stream.length; i += 400) chunks.push(stream.slice(i, i + 400));
  const pushes = chunks.map((c) => `<script>self.__next_f.push([1,${JSON.stringify(c)}])</script>`).join('');
  return `<!DOCTYPE html><html><head><title>${title}</title></head><body>${pushes}</body></html>`;
}

/** A text row: `<id>:T<hex byte length>,<payload>` (length is UTF-8 bytes). */
function textRow(id, html) {
  return `${id}:T${Buffer.byteLength(html, 'utf8').toString(16)},${html}`;
}

function posting(over = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Solutions Engineer',
    richtextDescription: '$1a',
    createdAt: '2026-09-01T10:00:00.000Z',
    job: {
      workArrangementEnum: 'HYBRID',
      jobLocations: [{ location: { name: 'New York', country: { name: 'United States' } } }],
      currentCompensation: { currencyIsoCode: 'USD', minAmount: 150000, maxAmount: 190000 },
    },
    jobPostingPublications: [{ currentState: { stateSlug: 'published_basic', createdAt: '2026-09-03T10:00:00.000Z' } }],
    ...over,
  };
}

function boardStream(postings, textHtml = '<p>body</p>') {
  const rows = [
    '0:["$","$L1",null,{}]',
    ':HL["/_next/static/css/x.css","style"]',
    `2:{"orgSlug":"acme","jobPostings":${JSON.stringify(postings)},"orgSlug":"acme"}`,
    textRow('1a', textHtml),
  ];
  return rows.join('\n') + '\n';
}

// ── registry + adapter contract ──────────────────────────────────────────────

test('deel: meta — value, label, region en', () => {
  assert.deepEqual(meta, { value: 'deel', label: 'Deel', region: 'en' });
  assert.equal(deelAdapter.id, 'deel');
  assert.equal(deelAdapter.label, 'Deel');
});

test('deel: the adapter is registered in ALL_ADAPTERS', () => {
  assert.ok(ALL_ADAPTERS.some((a) => a.id === 'deel'), 'deel missing from ALL_ADAPTERS');
});

test('deel: adapter matches the exact jobs.deel.com host only, endpoint is the board-root string', () => {
  assert.equal(deelAdapter.matches({ name: 'Klarna', careers_url: 'https://jobs.deel.com/klarna' }), true);
  assert.equal(deelAdapter.matches({ name: 'X', api: 'https://jobs.deel.com/x' }), true);
  assert.equal(deelAdapter.matches({ name: 'X', careers_url: 'https://jobs.deel.com/x/job-details/abc/overview' }), true, 'a posting permalink reduces to the board root');
  assert.equal(deelAdapter.matches({ name: 'X', careers_url: 'https://jobs.deel.com.evil.example/x' }), false, 'suffix-spoofed host');
  assert.equal(deelAdapter.matches({ name: 'X', careers_url: 'https://evil-jobs.deel.com/x' }), false, 'prefix-spoofed host');
  assert.equal(deelAdapter.matches({ name: 'X', careers_url: 'https://www.deel.com/careers/' }), false, 'the careers site is not a board');
  assert.equal(deelAdapter.matches({ name: 'X', careers_url: 'http://jobs.deel.com/x' }), false, 'non-https');
  assert.equal(deelAdapter.matches(null), false);
  assert.equal(deelAdapter.matches('jobs.deel.com'), false);
  const m = resolveAdapter({ name: 'Klarna', careers_url: 'https://jobs.deel.com/klarna' });
  assert.ok(m, 'registry resolves a jobs.deel.com board');
  assert.equal(m.adapter.id, 'deel');
  assert.equal(m.endpoint, 'https://jobs.deel.com/klarna');
  assert.equal(deelAdapter.buildEndpoint({ name: 'X', careers_url: 'https://jobs.deel.com/x' }), 'https://jobs.deel.com/x');
  assert.equal(deelAdapter.buildEndpoint({ name: 'X', careers_url: 'https://example.com/x' }), null, 'off-host entry → no endpoint (fail-soft)');
});

// ── slug extraction / host pin ───────────────────────────────────────────────

test('deel: extractSlug claims a jobs.deel.com/<slug> URL and reduces deeper paths to the slug', () => {
  assert.equal(extractSlug('https://jobs.deel.com/acme'), 'acme');
  assert.equal(extractSlug('https://jobs.deel.com/acme/job-details/abc/overview?x=1'), 'acme', 'the input path beyond the first segment is not inspected');
  assert.equal(extractSlug('  https://jobs.deel.com/acme  '), 'acme', 'whitespace trimmed');
});

test('deel: extractSlug rejects spoofed, non-HTTPS, slug-less and malformed URLs', () => {
  const rejects = [
    ['path-spoofed', 'https://evil.example/jobs.deel.com/acme'],
    ['suffix-spoofed host', 'https://jobs.deel.com.evil.example/acme'],
    ['prefix-spoofed host', 'https://evil-jobs.deel.com/acme'],
    ['other deel host', 'https://www.deel.com/careers/'],
    ['http', 'http://jobs.deel.com/acme'],
    ['bare host', 'https://jobs.deel.com/'],
    ['unsafe slug', 'https://jobs.deel.com/%2e%2e%2fadmin'],
    ['malformed', 'not a url'],
  ];
  for (const [name, u] of rejects) {
    assert.equal(extractSlug(u), null, `${name} must be rejected`);
  }
  assert.equal(extractSlug(null), null);
  assert.equal(extractSlug(7), null);
  assert.equal(extractSlug(''), null);
});

test('deel: SLUG_RE is the upstream URL-safe slug shape', () => {
  assert.ok(SLUG_RE.test('klarna'));
  assert.ok(SLUG_RE.test('acme-corp_2'));
  assert.ok(SLUG_RE.test('A1_b-c'));
  assert.ok(!SLUG_RE.test('-leading-hyphen'));
  assert.ok(!SLUG_RE.test('has space'));
  assert.ok(!SLUG_RE.test(''));
  assert.ok(!SLUG_RE.test('%2e%2e'));
});

test('deel: resolveSlug — api: wins over a foreign careers_url; the entry itself is null-guarded', () => {
  assert.equal(resolveSlug({ api: 'https://jobs.deel.com/acme', careers_url: 'https://example.com' }), 'acme');
  assert.equal(resolveSlug({ careers_url: 'https://jobs.deel.com/acme' }), 'acme');
  assert.equal(resolveSlug({}), null);
  assert.equal(resolveSlug(null), null);
});

test('deel: assertDeelUrl — https on exactly the pinned host, default port only', () => {
  assert.equal(assertDeelUrl('https://jobs.deel.com/acme'), 'https://jobs.deel.com/acme');
  assert.throws(() => assertDeelUrl('http://jobs.deel.com/acme'), /HTTPS/);
  assert.throws(() => assertDeelUrl('https://evil.example/acme'), /untrusted hostname/);
  assert.throws(() => assertDeelUrl('https://jobs.deel.com:8443/acme'), /port/);
  assert.throws(() => assertDeelUrl('not a url'), /invalid URL/);
});

test('deel: boardUrlFor rebuilds the board root from the fixed host and the slug', () => {
  assert.equal(boardUrlFor('acme'), 'https://jobs.deel.com/acme');
});

// ── flight stream + text rows ────────────────────────────────────────────────

test('deel: readFlightStream concatenates pushes; a broken chunk is skipped, the board survives', () => {
  const good = '2:{"jobPostings":[]}\n';
  const html = `<script>self.__next_f.push([1,${JSON.stringify(good.slice(0, 10))}])</script>`
    + '<script>self.__next_f.push([1,"broken \\x chunk"]);</script>'
    + `<script>self.__next_f.push([1,${JSON.stringify(good.slice(10))}])</script>`;
  assert.equal(readFlightStream(html), good, 'a chunk that will not JSON-decode is skipped, not fatal');
  assert.equal(readFlightStream('<html><body>hi</body></html>'), '', 'no pushes → empty stream');
});

test('deel: readTextRows honours the UTF-8 byte length of a text row (multi-byte payload intact)', () => {
  const multi = 'Café ’résumé’ — 日本語';
  const stream = boardStream([posting()], `<p>${multi}</p>`);
  const texts = readTextRows(readFlightStream(pageWith(stream)));
  assert.equal(texts.get('1a'), `<p>${multi}</p>`);
});

test('deel: readTextRows stops best-effort on an unrecognised row', () => {
  const texts = readTextRows('zz-not-hex:{"x":1}\n1a:T4,<p>x</p>\n');
  assert.equal(texts.size, 0, 'a non-hex id stops the walk before any row is read');
  assert.equal(readTextRows('1a:Tzz,<p>x</p>\n1b:T4,<p>y</p>\n').size, 0, 'a malformed length stops the walk');
});

// ── parseDeelBoard ───────────────────────────────────────────────────────────

test('deel: parseDeelBoard maps the postings — url/company/title, rows without title or id dropped', () => {
  const html = pageWith(boardStream([
    posting(),
    posting({
      id: '22222222-2222-4222-8222-222222222222',
      title: '  Remote Presales Engineer  ',
      richtextDescription: '<b>inline</b>',
      job: { workArrangementEnum: 'REMOTE', jobLocations: [{ location: { name: 'Ohio', country: { name: 'United States' } } }, { location: { name: 'Austin, United States', country: { name: 'United States' } } }] },
      jobPostingPublications: [{ currentState: { stateSlug: 'draft', createdAt: '2026-01-01T00:00:00.000Z' } }],
    }),
    posting({ id: '33333333-3333-4333-8333-333333333333', title: '   ' }), // blank title → dropped
    posting({ id: undefined, title: 'No id' }),                              // no id → dropped
    null,                                                                    // junk row → dropped
  ], '<p>Café ’résumé’ — 日本語</p>'));
  const jobs = parseDeelBoard(html, { slug: 'acme', company: 'Acme' });

  assert.equal(jobs.length, 2, 'rows missing a title or id are dropped, the rest kept');
  const [a, b] = jobs;
  assert.equal(a.url, 'https://jobs.deel.com/acme/job-details/11111111-1111-4111-8111-111111111111/overview');
  assert.equal(a.company, 'Acme');
  assert.equal(a.title, 'Solutions Engineer');
  assert.equal(a.location, 'New York, United States', 'the country is appended to a name that lacks it');
  assert.equal(a.postedAt, Date.parse('2026-09-03T10:00:00.000Z'), 'the publication timestamp wins for postedAt');
  assert.equal(a.description, 'Café ’résumé’ — 日本語', 'a $-reference description resolves from the text rows (HTML → text)');

  assert.equal(b.location, 'Ohio, United States; Austin, United States; Remote', 'a country already in the name is not repeated; REMOTE is marked');
  assert.equal(b.title, 'Remote Presales Engineer', 'the title is trimmed');
  assert.equal(b.postedAt, Date.parse('2026-09-01T10:00:00.000Z'), 'createdAt is the fallback when no published state exists');
  assert.equal(b.description, 'inline', 'an inline description string is accepted');

  assert.ok(!('salary' in a) && !('salary' in b), 'salary is left off (amounts carry no pay interval)');
});

test('deel: parseDeelBoard keeps a posting whose description reference is missing', () => {
  const dangling = parseDeelBoard(pageWith(boardStream([posting({ richtextDescription: '$ff' })])), { slug: 'acme', company: 'Acme' });
  assert.equal(dangling.length, 1);
  assert.ok(!('description' in dangling[0]));
});

test('deel: a lone-surrogate id drops the one posting, not the page', async () => {
  const LONE = '\uD800';
  const { parseDeelBoard: parse } = await import('../server/lib/sources/deel.mjs');
  const jobs = parse(pageWith(`2:{"jobPostings":${JSON.stringify([{ id: `${LONE}bad`, title: 'Bad' }, { id: 'ok-5', title: 'Good' }])}}\n`), { slug: 'x', company: 'X' });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://jobs.deel.com/x/job-details/ok-5/overview');
});

test('deel: parseDeelBoard — a present-and-empty jobPostings container is [] (a real empty board)', () => {
  const empty = parseDeelBoard(pageWith(boardStream([])), { slug: 'acme', company: 'Acme' });
  assert.deepEqual(empty, []);
});

test('deel: parseDeelBoard fails CLOSED on broken pages', () => {
  assert.throws(
    () => parseDeelBoard(pageWith('0:["x"]\n', { title: 'Job Board Not Found' }), { slug: 'ghost', company: 'G' }),
    /no board at jobs\.deel\.com\/ghost/,
    'the "Job Board Not Found" shell throws a named error',
  );
  assert.throws(
    () => parseDeelBoard('<html><body>hi</body></html>', { slug: 'acme', company: 'A' }),
    /no Next\.js flight data/,
    'no flight payload (markup change) throws',
  );
  assert.throws(
    () => parseDeelBoard(pageWith('0:["x"]\n2:{"jobs":[]}\n'), { slug: 'acme', company: 'A' }),
    /no jobPostings/,
    'a payload without the jobPostings container must NOT read as an empty board',
  );
  assert.throws(
    () => parseDeelBoard(pageWith('2:{"jobPostings":{"not":"an array"}}\n'), { slug: 'acme', company: 'A' }),
    /expected an array/,
    'a non-array container throws (shape guard)',
  );
  assert.throws(() => parseDeelBoard('', { slug: 'acme', company: 'A' }), /empty response/);
  assert.throws(() => parseDeelBoard(undefined, { slug: 'acme', company: 'A' }), /empty response/);
});

// ── fetchDeel — the web-ui fetch contract ────────────────────────────────────

const ENTRY = { name: 'Acme', careers_url: 'https://jobs.deel.com/acme' };

test('deel: fetchDeel issues exactly one request, to the board root, with redirect:"error"', async () => {
  const html = pageWith(boardStream([posting(), posting({ id: '22222222-2222-4222-8222-222222222222', title: 'Remote Presales Engineer' })], '<p>body</p>'));
  const seen = [];
  const jobs = await fetchDeel('https://jobs.deel.com/acme', {
    fetchImpl: async (url, opts) => { seen.push({ url, opts }); return { ok: true, status: 200, text: async () => html }; },
    company: ENTRY,
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, 'https://jobs.deel.com/acme');
  assert.equal(seen[0].opts.redirect, 'error');
  assert.equal(jobs.length, 2, 'both postings normalized');
  assert.equal(jobs[0].id, 'deel-https://jobs.deel.com/acme/job-details/11111111-1111-4111-8111-111111111111/overview');
  assert.equal(jobs[0].source, 'deel');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].salary, '');
  assert.equal(jobs[0].date, new Date(Date.parse('2026-09-03T10:00:00.000Z')).toISOString());
  assert.ok(jobs[1].isRemote === true, 'a REMOTE arrangement sets isRemote');
});

test('deel: fetchDeel refuses an off-host endpoint before any network call', async () => {
  let touched = 0;
  await assert.rejects(
    () => fetchDeel('https://evil.example/acme', { fetchImpl: async () => { touched += 1; return { ok: true, text: async () => '' }; } }),
    /untrusted hostname/,
  );
  assert.equal(touched, 0, 'the endpoint is validated before the fetch');
});

test('deel: fetchDeel reports a refused redirect by name', async () => {
  const refusal = new TypeError('fetch failed', { cause: new Error('unexpected redirect') });
  await assert.rejects(
    () => fetchDeel('https://jobs.deel.com/acme', { fetchImpl: async () => { throw refusal; } }),
    /redirects away from the board/,
  );
});

test('deel: fetchDeel propagates other failures unchanged', async () => {
  class FakeSentinel extends Error {}
  await assert.rejects(
    () => fetchDeel('https://jobs.deel.com/acme', { fetchImpl: async () => { throw new FakeSentinel('boom'); } }),
    FakeSentinel,
  );
  await assert.rejects(
    () => fetchDeel('https://jobs.deel.com/acme', { fetchImpl: async () => ({ ok: false, status: 404, headers: { get: () => null }, text: async () => '' }) }),
    /HTTP 404/,
  );
});

test('deel: fetchDeel fails loud when the signal is already aborted (no empty board)', async () => {
  const controller = new AbortController();
  controller.abort();
  let touched = 0;
  await assert.rejects(
    () => fetchDeel('https://jobs.deel.com/acme', { fetchImpl: async () => { touched += 1; return { ok: true, text: async () => '' }; }, signal: controller.signal }),
    /abort/i,
  );
  assert.equal(touched, 0);
});

test('deel: fetchDeel wraps a 200 whose body is broken — the parse throws, never an empty board', async () => {
  await assert.rejects(
    () => fetchDeel('https://jobs.deel.com/acme', { fetchImpl: async () => ({ ok: true, status: 200, text: async () => '<html>hi</html>' }) }),
    /no Next\.js flight data/,
  );
});

// L262-R6 — a short `$xx` token that is not a valid hex reference can only
// be a broken text reference, never a description: it must be skipped, not
// shipped into the snippet as the literal '$9z'.
test('deel: a short non-hex $-token description is skipped, not inlined', () => {
  const junk = parseDeelBoard(pageWith(boardStream([
    posting({ id: '44444444-4444-4444-8444-444444444444', richtextDescription: '$9z' }),
    posting({ id: '55555555-5555-4555-8555-555555555555', richtextDescription: '$zz' }),
  ])), { slug: 'acme', company: 'Acme' });
  assert.equal(junk.length, 2);
  for (const j of junk) {
    assert.ok(!('description' in j), `${j.title}: no description key for a broken $-reference`);
  }
  // A real inline description that merely STARTS with '$' still survives.
  const money = parseDeelBoard(pageWith(boardStream([
    posting({ id: '66666666-6666-4666-8666-666666666666', richtextDescription: '$120k base — a real description body' }),
  ])), { slug: 'acme', company: 'Acme' });
  assert.equal(money.length, 1);
  assert.equal(money[0].description, '$120k base — a real description body');
});
