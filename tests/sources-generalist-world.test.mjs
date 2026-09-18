/**
 * Generalist World source — ported from parent career-ops
 * `tests/providers/generalist-world.test.mjs`, at the parent's FINAL behaviour
 * (including #4264, "match inner class tokens and fail loud on unusable
 * generalist-world cards").
 *
 * Two behaviours are the reason this suite exists, and both are easy to undo:
 *
 *   - WHOLE CLASS TOKENS. A `class` attribute is a token list. Before #4264 the
 *     title / employer / description selectors demanded the class be exactly
 *     one token, so an extra class dropped the whole card (title, employer) or
 *     the field (description). The token still has to be WHOLE, though:
 *     `gw-job-title-small` is not `gw-job-title`, and `data-class=` is not
 *     `class=`.
 *
 *   - FAIL LOUD. A scraped board that answers "0 jobs" after a redesign looks
 *     healthy forever. So a page with neither cards nor the listing container
 *     throws, and — the #4264 half — so does one whose card anchors all match
 *     but none yields a usable job. Only the alive-but-empty board (container
 *     present, zero cards) returns [].
 *
 * CI-isolated: fake fetchImpl, no network, no parent checkout, no port binding.
 * URL assertions use extraction + strict equality, never String.includes().
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  LIST_URL,
  SITE_ORIGIN,
  assertGeneralistWorldUrl,
  resolveGeneralistWorldUrl,
  normalizeGeneralistWorldCard,
  parseGeneralistWorldJobs,
  fetchGeneralistWorld,
} from '../server/lib/sources/generalist-world.mjs';
import { generalistWorldAdapter } from '../server/lib/portals/adapters/generalist-world.mjs';
import { htmlToText } from '../server/lib/html-to-text.mjs';

// ── fixtures ────────────────────────────────────────────────────────────────

const card = (attrs, inner) => `<a class="gw-job-card" ${attrs}>${inner}</a>`;
const ACME = '<div class="gw-job-company">Acme</div>';
const TITLE = '<div class="gw-job-title">Ops Lead</div>';

const page = ({ featured = '', main = '' } = {}) => `<!doctype html><html><body>
  <section class="gw-featured-section"><div class="gw-featured-grid">${featured}</div></section>
  <div class="gw-jobs-section" data-jobs-container><div class="gw-jobs-grid">${main}</div></div>
  </body></html>`;

const c1 = card('data-region="remote" href="/jobs/chief-of-staff-exampleco/"',
  '<div class="gw-job-company">ExampleCo</div><div class="gw-job-title">Chief of Staff</div><p class="gw-job-description">Teaser one.</p>');
const c2 = card('data-region="us" href="/jobs/ops-lead-acme/"',
  `${ACME}${TITLE}<span class="gw-job-meta-tag gw-location">Austin, TX</span>`);
const c3 = card('data-region="eu" href="/jobs/broken-acme/"', ACME);            // no title
const c4 = card('data-region="eu" href="/jobs/orphan-role/"', TITLE);           // no employer

/** A fetchText-compatible stub that records every call and serves one body. */
function htmlFetch(html) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, headers: new Map(), text: async () => html };
  };
  return { impl, calls };
}

/** Path of a job URL, for equality assertions that no unanchored regex can fake. */
const pathOf = (u) => new URL(u).pathname;

// ── meta / registry shape ───────────────────────────────────────────────────

test('meta is registry-shaped', () => {
  assert.deepEqual(meta, { value: 'generalist-world', label: 'Generalist World', region: 'en' });
});

test('the canonical list URL is the board page on the pinned host', () => {
  assert.equal(SITE_ORIGIN, 'https://generalist.world');
  assert.equal(LIST_URL, 'https://generalist.world/jobs/');
});

// ── SSRF guard ──────────────────────────────────────────────────────────────

test('the host is pinned by an anchored regex — look-alikes and userinfo are refused', () => {
  for (const bad of [
    'https://evil.example/jobs/',
    'https://generalist.world.evil.example/jobs/',
    'https://evil.example/generalist.world/jobs/',
    'https://generalist.world@evil.example/jobs/',
    'https://notgeneralist.world/jobs/',
  ]) {
    assert.throws(() => assertGeneralistWorldUrl(bad), /untrusted hostname/, `must reject ${bad}`);
  }
});

test('plain http is refused — HTTPS only', () => {
  assert.throws(() => assertGeneralistWorldUrl('http://generalist.world/jobs/'), /must use HTTPS/);
});

test('an unparseable URL is refused with a named error, not a raw TypeError', () => {
  assert.throws(() => assertGeneralistWorldUrl('not a url'), /generalist-world: invalid URL/);
});

test('the board and its www alias pass unchanged', () => {
  assert.equal(assertGeneralistWorldUrl(LIST_URL), LIST_URL);
  assert.equal(
    assertGeneralistWorldUrl('https://www.generalist.world/jobs/'),
    'https://www.generalist.world/jobs/',
  );
});

// ── resolveGeneralistWorldUrl() ─────────────────────────────────────────────

test('a card href resolves to the canonical posting URL, or to null', () => {
  const cases = [
    ['/jobs/chief-of-staff-exampleco/', 'https://generalist.world/jobs/chief-of-staff-exampleco/'],
    ['/jobs/chief-of-staff-exampleco', 'https://generalist.world/jobs/chief-of-staff-exampleco/'],
    ['https://generalist.world/jobs/ops-lead-acme/', 'https://generalist.world/jobs/ops-lead-acme/'],
    // the www alias normalises onto the canonical origin
    ['https://www.generalist.world/jobs/ops-lead-acme/', 'https://generalist.world/jobs/ops-lead-acme/'],
    ['  /jobs/padded-slug/  ', 'https://generalist.world/jobs/padded-slug/'],
    ['https://evil.example/jobs/x/', null],
    ['https://generalist.world.evil.example/jobs/x/', null],
    ['https://generalist.world@evil.example/jobs/x/', null],
    ['http://generalist.world/jobs/x/', null],
    ['//evil.example/jobs/x/', null],
    ['/jobs/../wp-admin/', null],
    ['/jobs/x/y/', null],
    ['/jobs/x/?utm=1', null],
    ['https://generalist.world/jobs/x/?utm=1', null],
    ['https://generalist.world/jobs/x/#top', null],
    ['/jobs/x%2F../', null],
    ['/jobs/', null],
    ['/about/', null],
    ['javascript:alert(1)', null],
    ['', null],
    [undefined, null],
    [null, null],
    [42, null],
  ];
  for (const [href, want] of cases) {
    assert.equal(resolveGeneralistWorldUrl(href), want, `href ${JSON.stringify(href)}`);
  }
});

// ── normalizeGeneralistWorldCard() ──────────────────────────────────────────

test('a full card maps onto exactly the 12-field web-ui job shape', () => {
  const job = normalizeGeneralistWorldCard(card(
    'data-type="connector" data-region="uk" href="/jobs/ops-finance-lead-exampleco/"',
    `<div class="gw-job-card-top"><div class="gw-job-company">Example &amp; Co</div></div>
     <div class="gw-job-title">Ops &amp; Finance Lead &#8211; Founder&#x27;s Office</div>
     <p class="gw-job-description">Run the <strong>back office</strong> of a 12-person team.<br>Hybrid.</p>
     <div class="gw-job-meta"><span class="gw-job-meta-tag gw-salary">£70k&#8211;£85k</span>
     <span class="gw-job-meta-tag gw-location">London (in office)</span></div>`,
  ));
  assert.deepEqual(job, {
    id: 'generalist-world-ops-finance-lead-exampleco',
    title: "Ops & Finance Lead – Founder's Office",
    company: 'Example & Co',
    url: 'https://generalist.world/jobs/ops-finance-lead-exampleco/',
    // the parent drops this tag (its Job.salary carries figures); web-ui's
    // salary is a display string, so the free text is carried through
    salary: '£70k–£85k',
    location: 'London (in office)',
    isRemote: false,
    workplaceType: '',
    relocates: false,
    date: '',
    snippet: 'Run the back office of a 12-person team. Hybrid.',
    source: 'generalist-world',
  });
});

test('no posting date is invented, and the field set never grows', () => {
  const job = normalizeGeneralistWorldCard(card('href="/jobs/x-acme/"', `${ACME}${TITLE}`));
  assert.equal(job.date, '', 'the list page carries no date — exempt from the age filter, not faked');
  assert.deepEqual(Object.keys(job).sort(), [
    'company', 'date', 'id', 'isRemote', 'location', 'relocates',
    'salary', 'snippet', 'source', 'title', 'url', 'workplaceType',
  ]);
});

test('data-region is the location fallback, and a remote card is flagged remote', () => {
  const remote = normalizeGeneralistWorldCard(card(
    'data-region="remote" href="/jobs/founders-associate-acme/"',
    `${ACME}<div class="gw-job-title">Founder's Associate</div>`,
  ));
  assert.equal(remote.location, 'Remote');
  assert.equal(remote.isRemote, true);
  assert.equal(remote.workplaceType, 'Remote');
  assert.equal(remote.snippet, '', 'no teaser on the card means no snippet, not a placeholder');

  const eu = normalizeGeneralistWorldCard(card('data-region="eu" href="/jobs/x-acme/"', `${ACME}${TITLE}`));
  assert.equal(eu.location, 'EU', 'a non-remote region is upper-cased');

  const none = normalizeGeneralistWorldCard(card('href="/jobs/x-acme/"', `${ACME}${TITLE}`));
  assert.equal(none.location, '', 'neither tag nor region yields an empty location');
  assert.equal(none.workplaceType, '', 'and never a guessed "Onsite" — this board has no onsite signal');

  const tagged = normalizeGeneralistWorldCard(card(
    'data-region="uk" href="/jobs/x-acme/"',
    `${ACME}${TITLE}<span class="gw-job-meta-tag gw-location">Remote (UK)</span>`,
  ));
  assert.equal(tagged.isRemote, true, 'a "Remote (UK)" tag is remote even when the region says uk');
});

test('a card with no usable title, employer or link is dropped', () => {
  const drops = [
    [card('href="/jobs/x-acme/"', ACME), 'no title'],
    [card('href="/jobs/x-acme/"', `${ACME}<div class="gw-job-title"> &nbsp; </div>`), 'whitespace/nbsp title'],
    [card('data-region="us" href="/jobs/x-acme/"', TITLE), 'no employer'],
    [card('href="/jobs/x-acme/"', `<div class="gw-job-company"> &nbsp; </div>${TITLE}`), 'whitespace/nbsp employer'],
    [card('data-region="us"', `${ACME}${TITLE}`), 'no href'],
  ];
  for (const [html, label] of drops) {
    assert.equal(normalizeGeneralistWorldCard(html), null, `must drop a card with ${label}`);
  }
});

test('a card whose href leaves the board is dropped', () => {
  for (const href of ['https://evil.example/jobs/x/', '/jobs/../wp-admin/', '/jobs/x/?y=1', '/about/', 'javascript:alert(1)']) {
    assert.equal(
      normalizeGeneralistWorldCard(card(`href="${href}"`, `${ACME}${TITLE}`)),
      null,
      `must drop href ${href}`,
    );
  }
});

test('attribute names are matched whole — data-class= / data-href= are not class= / href=', () => {
  assert.equal(
    normalizeGeneralistWorldCard(`<a data-class="gw-job-card" data-href="/jobs/x-acme/">${ACME}${TITLE}</a>`),
    null,
    'a data-class/data-href anchor is not a card',
  );
  assert.equal(
    normalizeGeneralistWorldCard(card('data-href="/jobs/x-acme/"', `${ACME}${TITLE}`)),
    null,
    'data-href is not read as href',
  );
  const prefixedRegion = normalizeGeneralistWorldCard(
    card('data-data-region="remote" href="/jobs/x-acme/"', `${ACME}${TITLE}`),
  );
  assert.equal(prefixedRegion.location, '', 'data-data-region is not read as data-region');
});

test('the card class token must be whole, but may sit anywhere in the list', () => {
  assert.equal(
    normalizeGeneralistWorldCard(`<a class="gw-job-card-top" href="/jobs/x-acme/">${ACME}${TITLE}</a>`),
    null,
    'gw-job-card-top is a child div, not a card',
  );
  const multi = normalizeGeneralistWorldCard(`<a class="featured gw-job-card is-new" href="/jobs/x-acme/">${ACME}${TITLE}</a>`);
  assert.equal(multi.title, 'Ops Lead');
  assert.equal(pathOf(multi.url), '/jobs/x-acme/');
});

// The #4264 regression: before it, an extra class on the title or employer
// element dropped the whole card and one on the description dropped the field.
test('inner class tokens match anywhere in a multi-token class list (parent #4264)', () => {
  const job = normalizeGeneralistWorldCard(card('data-region="us" href="/jobs/x-acme/"',
    `<div class="gw-job-card-top"><div class="card-field gw-job-company is-verified">Acme</div></div>
     <div class="gw-job-title featured">Ops Lead</div>
     <p class="teaser gw-job-description clamp-2">Teaser two.</p>`));
  assert.equal(job.title, 'Ops Lead');
  assert.equal(job.company, 'Acme');
  assert.equal(job.snippet, 'Teaser two.');
});

test('inner class tokens still have to be WHOLE — a near-miss class is not the field', () => {
  const job = normalizeGeneralistWorldCard(card('href="/jobs/x-acme/"',
    `<div class="gw-job-company-logo">Logo</div><div class="gw-job-company">Acme</div>`
    + `<div class="gw-job-title-small">Not it</div><div class="gw-job-title">Ops Lead</div>`
    + `<p class="gw-job-description-more">More</p>`));
  assert.equal(job.title, 'Ops Lead');
  assert.equal(job.company, 'Acme');
  assert.equal(job.snippet, '', 'gw-job-description-more is not the description');

  const prefixedInner = normalizeGeneralistWorldCard(card('href="/jobs/x-acme/"',
    `${ACME}<div data-class="gw-job-title">Not a title</div>${TITLE}`));
  assert.equal(prefixedInner.title, 'Ops Lead', 'data-class="gw-job-title" is skipped');
});

test('a non-card input yields null rather than throwing', () => {
  for (const input of [null, undefined, 42, '', '<div>no card</div>']) {
    assert.equal(normalizeGeneralistWorldCard(input), null, `input ${JSON.stringify(input)}`);
  }
});

test('title decoding agrees with the shared html-to-text helper (incl. &#0; and double-encoding)', () => {
  const raw = 'A&#0;B &amp;amp; C';
  const job = normalizeGeneralistWorldCard(card('href="/jobs/x-acme/"',
    `${ACME}<div class="gw-job-title">${raw}</div>`));
  assert.equal(job.title, htmlToText(raw));
});

// ── parseGeneralistWorldJobs() ──────────────────────────────────────────────

test('featured + main cards are read, the repeat is deduped, unusable ones are skipped', () => {
  const jobs = parseGeneralistWorldJobs(page({ featured: c1, main: c1 + c2 + c3 + c4 }));
  assert.equal(jobs.length, 2, '4 cards + 1 repeat → 2 jobs');
  assert.deepEqual(jobs.map((j) => pathOf(j.url)), ['/jobs/chief-of-staff-exampleco/', '/jobs/ops-lead-acme/']);
  assert.equal(jobs[0].location, 'Remote');
  assert.equal(jobs[0].snippet, 'Teaser one.');
  assert.equal(jobs[1].location, 'Austin, TX');
  assert.equal(jobs[1].snippet, '');
  assert.equal(jobs[1].id, 'generalist-world-ops-lead-acme');
});

test('an alive-but-empty board yields [], and so does an empty body', () => {
  for (const [input, label] of [
    ['', 'an empty body'],
    ['   \n ', 'a whitespace-only body'],
    [null, 'a null body'],
    [undefined, 'an undefined body'],
    [page(), 'the listing container with zero cards'],
  ]) {
    assert.deepEqual(parseGeneralistWorldJobs(input), [], `expected [] for ${label}`);
  }
});

test('a real <section data-jobs-container> with zero cards is an empty board, not an error', () => {
  assert.deepEqual(
    parseGeneralistWorldJobs('<html><body><section data-jobs-container><p>No roles right now</p></section></body></html>'),
    [],
  );
});

test('a page with neither cards nor the listing container throws and names what changed', () => {
  assert.throws(
    () => parseGeneralistWorldJobs('<html><body><h1>Just a moment...</h1><div class="jobs"><a href="/jobs/x/">Ops Lead</a></div></body></html>'),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /^generalist-world: /);
      assert.match(err.message, /no gw-job-card anchors and no listing container/);
      assert.match(err.message, /page structure likely changed/);
      return true;
    },
  );
});

// The #4264 half: anchors match, no job comes out. That is a CHANGED CARD, not
// an empty board — before the fix it read as zero postings forever.
test('cards that all fail to yield a job throw with the anchor count (parent #4264)', () => {
  assert.throws(
    () => parseGeneralistWorldJobs(page({ main: c3 + c4 })),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /^generalist-world: 2 gw-job-card anchor\(s\) matched/);
      assert.match(err.message, /usable title, employer and \/jobs\/\{slug\}\/ link/);
      assert.match(err.message, /card markup likely changed/);
      return true;
    },
  );
});

test('one malformed card among usable ones is still only skipped', () => {
  const jobs = parseGeneralistWorldJobs(page({ main: c3 + c1 }));
  assert.equal(jobs.length, 1);
  assert.equal(pathOf(jobs[0].url), '/jobs/chief-of-staff-exampleco/');
});

test('the container marker must be a real opening tag, not the words in text, CSS or script', () => {
  const nearMisses = [
    ['<html><body>gw-jobs-section data-jobs-container</body></html>', 'marker words in body text'],
    ['<html><head><style>.gw-jobs-section{display:grid} [data-jobs-container]{gap:1rem}</style></head><body><p>Maintenance</p></body></html>', 'marker words in CSS only'],
    ['<html><body><script>var sel = ".gw-jobs-section"; var attr = "data-jobs-container";</script></body></html>', 'marker words in script only'],
    ['<html><body><div class="gw-jobs-section-legacy"></div><div data-jobs-container-old></div></body></html>', 'prefixed look-alike class / attribute'],
    ['<html><body><div data-class="gw-jobs-section"></div></body></html>', 'data-class= instead of class='],
  ];
  for (const [html, label] of nearMisses) {
    assert.throws(() => parseGeneralistWorldJobs(html), /page structure likely changed/, `must still throw for ${label}`);
  }
});

test('card literals in non-rendered blocks are not jobs', () => {
  const ghost = c1.replace('chief-of-staff-exampleco', 'ghost-exampleco');
  const jobs = parseGeneralistWorldJobs(page({
    main: `<script type="text/template">${ghost}</script><!-- ${ghost} --><textarea>${ghost}</textarea>`
      + `<style>.x::before{content:'${ghost}'}</style>` + c1,
  }));
  assert.deepEqual(jobs.map((j) => pathOf(j.url)), ['/jobs/chief-of-staff-exampleco/']);
});

test('<template> subtrees are inert, nested or stray-closed or unclosed', () => {
  const ghost = c1.replace('chief-of-staff-exampleco', 'ghost-exampleco');
  const ghost2 = c1.replace('chief-of-staff-exampleco', 'ghost-two-exampleco');
  const jobs = parseGeneralistWorldJobs(page({
    main: `<template id="card-tpl">${ghost}</template>`
      + `<TEMPLATE><template>${ghost2}</template>${ghost}</TEMPLATE>`
      + `</template>` + c1 + `<template>${ghost2}`,
  }));
  assert.deepEqual(jobs.map((j) => pathOf(j.url)), ['/jobs/chief-of-staff-exampleco/']);
});

test('a marker inside a quoted attribute value is attribute text, not a tag', () => {
  const ghost = c1.replace('chief-of-staff-exampleco', 'ghost-exampleco');
  const quoted = [
    [`<div data-copy="<template>"></div>${c1}`, 'a quoted <template> opener before the card'],
    [`<div data-copy="<script>"></div>${c1}<script>track()</script>`, 'a quoted <script> opener and a real script after'],
    [`<div data-copy="<!--"></div>${c1}<!-- footer -->`, 'a quoted comment opener and a real comment after'],
    [`<template><div data-copy="</template>"></div>${ghost}</template>${c1}`, 'a quoted </template> closer inside a template'],
    [`<template data-x="a>b">${ghost}</template>${c1}`, 'a > inside a template opener attribute'],
    [`<script data-x="a>b">${ghost}</script>${c1}`, 'a > inside a script opener attribute'],
    [`<script>var s = "</template>";</script><template>${ghost}</template>${c1}`, 'a </template> literal inside a script string'],
    [`<!-->${c1}<!-- footer -->`, 'an abrupt empty comment <!--> before the card'],
    [`<!--->${c1}<!-- footer -->`, 'an abrupt <!---> comment before the card'],
    [`<!-- ${ghost} --!>${c1}<!-- footer -->`, 'an incorrectly closed --!> comment before the card'],
  ];
  for (const [main, label] of quoted) {
    assert.deepEqual(
      parseGeneralistWorldJobs(page({ main })).map((j) => pathOf(j.url)),
      ['/jobs/chief-of-staff-exampleco/'],
      `expected exactly the rendered card with ${label}`,
    );
  }
});

test('a listing container that exists only inside an inert block does not make the page an empty board', () => {
  const container = '<div class="gw-jobs-section" data-jobs-container></div>';
  const hidden = [
    [`<html><body><template data-x="a>b">${container}</template><p>Maintenance</p></body></html>`, 'a <template> whose opener carries a quoted >'],
    [`<html><body><template>${container}</template><p>Maintenance</p></body></html>`, 'a <template>'],
    [`<html><body><template><div><template>${container}</template></div>${container}</template><p>Maintenance</p></body></html>`, 'nested <template>s'],
    [`<html><body><script>document.body.innerHTML = '${container}';</script><p>Maintenance</p></body></html>`, 'a script string'],
    [`<html><body><!-- ${container} --><p>Maintenance</p></body></html>`, 'an HTML comment'],
    [`<html><head><style>.x::after{content:'${container}'}</style></head><body><p>Maintenance</p></body></html>`, 'a CSS content string'],
    [`<html><body><textarea>${container}</textarea></body></html>`, 'a textarea'],
    [`<html><body><SCRIPT>var t = '${container}';</SCRIPT></body></html>`, 'an upper-case SCRIPT block'],
  ];
  for (const [html, label] of hidden) {
    assert.throws(() => parseGeneralistWorldJobs(html), /page structure likely changed/, `must still throw for ${label}`);
  }
  // …while a quoted opener before a REAL container leaves the empty board intact.
  assert.deepEqual(
    parseGeneralistWorldJobs(`<html><body><div data-copy="<template>"></div>${container}</body></html>`),
    [],
  );
});

// ── fetchGeneralistWorld() ──────────────────────────────────────────────────

test('fetch makes exactly one request, to the list URL, through the injected fetchImpl', async () => {
  const { impl, calls } = htmlFetch(page({ main: c1 + c2 }));
  const jobs = await fetchGeneralistWorld(LIST_URL, { fetchImpl: impl });
  assert.equal(jobs.length, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, LIST_URL);
});

test('fetch defaults to the list URL and refuses server-side redirects (SSRF guard)', async () => {
  const { impl, calls } = htmlFetch(page({ main: c1 }));
  await fetchGeneralistWorld(undefined, { fetchImpl: impl });
  assert.equal(calls[0].url, LIST_URL);
  assert.equal(calls[0].opts.redirect, 'error');
});

test('fetch refuses an off-host or non-HTTPS endpoint BEFORE any request', async () => {
  for (const [bad, pattern] of [
    ['https://evil.example/jobs/', /untrusted hostname/],
    ['https://generalist.world.evil.example/jobs/', /untrusted hostname/],
    ['http://generalist.world/jobs/', /must use HTTPS/],
  ]) {
    const { impl, calls } = htmlFetch(page({ main: c1 }));
    await assert.rejects(() => fetchGeneralistWorld(bad, { fetchImpl: impl }), pattern);
    assert.equal(calls.length, 0, `${bad} must never reach the network`);
  }
});

test('fetch returns [] on an empty body but surfaces a structure change as an error', async () => {
  assert.deepEqual(await fetchGeneralistWorld(LIST_URL, { fetchImpl: htmlFetch('').impl }), []);
  await assert.rejects(
    () => fetchGeneralistWorld(LIST_URL, { fetchImpl: htmlFetch('<html><body><p>Access denied</p></body></html>').impl }),
    /page structure likely changed/,
  );
});

// ── adapter ─────────────────────────────────────────────────────────────────

test('the adapter carries the registry contract', () => {
  assert.equal(generalistWorldAdapter.id, 'generalist-world');
  assert.equal(generalistWorldAdapter.label, 'Generalist World');
  for (const fn of ['matches', 'buildEndpoint', 'fetch']) {
    assert.equal(typeof generalistWorldAdapter[fn], 'function', `${fn} must be a function`);
  }
  assert.equal(generalistWorldAdapter.fetch, fetchGeneralistWorld);
});

test('the adapter matches its own provider and the board host, and defers otherwise', () => {
  const m = (company) => generalistWorldAdapter.matches(company);
  assert.equal(m({ name: 'Generalist World', provider: 'generalist-world' }), true);
  assert.equal(m({ name: 'X', careers_url: LIST_URL }), true);
  assert.equal(m({ name: 'X', careers_url: 'https://www.generalist.world/jobs' }), true);
  assert.equal(m({ name: 'X', api: LIST_URL }), true);
  // A different explicit provider wins even when the URL sits on this host.
  assert.equal(m({ name: 'X', provider: 'remoteok', careers_url: LIST_URL }), false);
  for (const company of [
    { name: 'X', careers_url: 'http://generalist.world/jobs/' },
    { name: 'X', careers_url: 'https://evil.example/generalist.world/jobs/' },
    { name: 'X', careers_url: 'https://generalist.world.evil.example/jobs/' },
    { name: 'X', careers_url: 'https://generalist.world@evil.example/jobs/' },
    { name: 'X', careers_url: 'not a url' },
    { name: 'X', careers_url: 42 },
    { name: 'X' },
    {},
    null,
    undefined,
  ]) {
    assert.equal(m(company), false, `must not claim ${JSON.stringify(company)}`);
  }
});

test('buildEndpoint always returns a string — never an object, never null', () => {
  const cases = [
    [{ provider: 'generalist-world' }, LIST_URL],
    [{ provider: 'generalist-world', api: 'https://www.generalist.world/jobs/' }, 'https://www.generalist.world/jobs/'],
    [{ provider: 'generalist-world', 'generalist-world': 'https://generalist.world/jobs/?page=2' }, 'https://generalist.world/jobs/?page=2'],
    // An off-host / non-HTTPS / unparseable override falls back to the
    // canonical URL rather than reaching the fetch slot at all.
    [{ provider: 'generalist-world', api: 'https://evil.example/jobs/' }, LIST_URL],
    [{ provider: 'generalist-world', api: 'http://generalist.world/jobs/' }, LIST_URL],
    [{ provider: 'generalist-world', api: 'not a url' }, LIST_URL],
    [{ provider: 'generalist-world', api: 42 }, LIST_URL],
    [{}, LIST_URL],
    [null, LIST_URL],
  ];
  for (const [company, want] of cases) {
    const endpoint = generalistWorldAdapter.buildEndpoint(company);
    assert.equal(typeof endpoint, 'string', `endpoint for ${JSON.stringify(company)} must be a string`);
    assert.equal(endpoint, want);
  }
});
