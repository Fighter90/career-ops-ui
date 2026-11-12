/**
 * CAR-262 (parent-sync #8, upstream #6604) — the pure JD page parsers.
 *
 * A template-driven career site (Phenom, most bespoke ones) renders the job
 * body from <script> data: the page ships a schema.org JobPosting in
 * `application/ld+json` and the visible HTML is title/location/Apply chrome.
 * Anything that strips tags drops the script content, so the auto-pipeline's
 * visible-text extraction sees ~270 characters and rejects the entry as
 * "JD too short" — exactly the live Robert Half failure the parent fixed by
 * reading the page's own JSON-LD (lib/jd-parse.mjs + lib/jd-page-fetch.mjs).
 *
 * This suite pins the WEB-UI mirror (server/lib/jd-parse.mjs): pure, offline
 * parsers over already-downloaded HTML — no network, no I/O — plus the
 * ambiguity/closure guards that keep another job's JD (or a listing page's)
 * from being handed to the evaluate step.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  wordCount,
  MIN_PAGE_JD_WORDS,
  ldJsonBlocks,
  fromLdJson,
  embeddedDescriptionStrings,
  fromEmbeddedDescription,
  jdFromPageHtml,
  pageTitle,
} = await import('../server/lib/jd-parse.mjs');

const BODY = '&lt;div&gt;&lt;p&gt;Own the Kubernetes platform, the CI/CD pipelines and the observability stack across AWS and Terraform. '.repeat(3)
  + 'You will partner with product teams on reliability targets, lead incident reviews and grow the platform team. '
  + 'Requirements: deep Go and Linux experience, production SRE on-call history, and a bias for automation.&lt;/p&gt;&lt;/div&gt;';

const posting = (over = {}) => ({
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Senior Platform Engineer',
  description: BODY,
  hiringOrganization: { name: 'Robert Half' },
  employmentType: 'FULL_TIME',
  jobLocation: { address: { addressLocality: 'Amsterdam', addressRegion: 'NH', addressCountry: 'NL' } },
  ...over,
});

const wrap = (inner, extra = '') =>
  `<!doctype html><html><head><title>Senior Platform Engineer at Acme</title></head><body><div id="app">Loading…</div>${extra}<script type="application/ld+json">${inner}</script></body></html>`;

test('ldJsonBlocks: finds ld+json script bodies, skips plain scripts and other types', () => {
  const html = '<script>var a = 1;</script>'
    + `<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>`
    + `<script type='application/ld+json'>{"@type":"Organization"}</script>`;
  const blocks = ldJsonBlocks(html);
  assert.equal(blocks.length, 2, 'only the two ld+json blocks are collected');
  assert.match(blocks[0], /BreadcrumbList/);
  assert.match(blocks[1], /Organization/);
  assert.equal(ldJsonBlocks('<script type="application/ld+json">{"x":1}').length, 0, 'unclosed script yields nothing');
});

test('fromLdJson: composes the JD document from a single JobPosting (entity-escaped markup decoded to text)', () => {
  const jd = fromLdJson(wrap(JSON.stringify(posting())));
  assert.ok(jd, 'a single posting is extracted');
  assert.equal(jd.method, 'ld+json');
  assert.match(jd.text, /^# Senior Platform Engineer/);
  assert.match(jd.text, /\*\*Company:\*\* Robert Half/);
  assert.match(jd.text, /\*\*Location:\*\* Amsterdam, NH, NL/);
  assert.match(jd.text, /\*\*Employment type:\*\* FULL_TIME/);
  assert.match(jd.text, /Own the Kubernetes platform/);
  assert.ok(!jd.text.includes('&lt;'), 'entity-escaped markup is decoded, not emitted');
  assert.ok(!jd.text.includes('<div>'), 'decoded tags are stripped to text, never carried');
  assert.ok(wordCount(jd.text) >= MIN_PAGE_JD_WORDS, `above the ${MIN_PAGE_JD_WORDS}-word floor`);
});

test('fromLdJson: array and @graph wrappers are walked; a malformed block is skipped', () => {
  const arr = wrap(JSON.stringify([posting()]));
  assert.ok(fromLdJson(arr), 'a top-level array block is walked');
  const graph = wrap(JSON.stringify({ '@graph': [posting()] }));
  assert.ok(fromLdJson(graph), 'an @graph wrapper is walked');
  const broken = wrap('{"@type":"JobPosting","description":');
  assert.equal(fromLdJson(broken), null, 'malformed JSON is skipped, not thrown');
});

test('fromLdJson: several DIFFERENT postings → null; the same posting twice → still one', () => {
  const two = wrap(JSON.stringify([posting(), posting({ title: 'Data Engineer', description: 'Build pipelines all day long with Spark, Airflow and dbt on cloud warehouses.' })]));
  assert.equal(fromLdJson(two), null, 'a listing page hands over nothing');
  const dup = wrap(JSON.stringify([posting(), posting()]));
  assert.ok(fromLdJson(dup), 'an identical duplicate representation is one candidate');
});

test('jdFromPageHtml: a Phenom-like page (chrome only, JD in JSON-LD) is rescued', () => {
  const html = wrap(JSON.stringify(posting()));
  const found = jdFromPageHtml(html);
  assert.ok(found, 'the JD is found');
  assert.equal(found.method, 'ld+json');
  assert.ok(!found.closed);
  assert.match(found.text, /Own the Kubernetes platform/);
});

test('jdFromPageHtml: several distinct postings → null (ambiguous page proves nothing)', () => {
  const html = wrap(JSON.stringify([posting(), posting({ title: 'Data Engineer', description: 'Build pipelines all day long with Spark, Airflow and dbt on cloud warehouses.' })]));
  assert.equal(jdFromPageHtml(html), null);
});

test('jdFromPageHtml: a posting whose URL names another job on the same host → null', () => {
  const html = wrap(JSON.stringify(posting({ url: 'https://careers.example.com/job/2031' })));
  const found = jdFromPageHtml(html, Date.now(), 'https://careers.example.com/job/2044');
  assert.equal(found, null, 'the other job\'s JD must not be lent to this URL');
  const same = jdFromPageHtml(html, Date.now(), 'https://careers.example.com/job/2031');
  assert.ok(same, 'the matching URL is kept');
  const noUrl = jdFromPageHtml(html, Date.now(), '');
  assert.ok(noUrl, 'no requested URL → no identity check');
});

test('jdFromPageHtml: a past validThrough is CLOSURE evidence, not a JD; a future one is a JD', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  const past = jdFromPageHtml(wrap(JSON.stringify(posting({ validThrough: '2026-11-01' }))), now);
  assert.ok(past?.closed, 'past validThrough says closed');
  assert.match(past.evidence, /validThrough/);
  assert.equal(past.text, '');
  const future = jdFromPageHtml(wrap(JSON.stringify(posting({ validThrough: '2027-01-31' }))), now);
  assert.ok(future && !future.closed && future.text, 'a future validThrough stays a JD');
  const absent = jdFromPageHtml(wrap(JSON.stringify(posting())), now);
  assert.ok(absent && !absent.closed, 'no validThrough is not closure evidence');
});

test('jdFromPageHtml: the embedded-payload fallback fires only when the page holds ONE description-sized string', () => {
  const desc = 'Own the Kubernetes platform, the CI/CD pipelines and the observability stack across AWS and Terraform. '.repeat(8);
  const one = `<!doctype html><html><body><script>window.__appData = {"posting":{"descriptionHtml":"<p>${desc}</p>"}};</script></body></html>`;
  const found = jdFromPageHtml(one);
  assert.ok(found, 'one payload is extracted');
  assert.equal(found.method, 'embedded-description');
  const two = `<!doctype html><html><body><script>window.__appData = {"a":{"descriptionHtml":"<p>${desc}</p>"},"b":{"descriptionHtml":"<p>${desc} Extra other posting text entirely.</p>"}};</script></body></html>`;
  assert.equal(jdFromPageHtml(two), null, 'two description-sized payloads are ambiguous');
});

test('jdFromPageHtml: a description below the word floor is a stub, not a JD', () => {
  const tiny = wrap(JSON.stringify(posting({ description: 'Apply now.' })));
  assert.equal(jdFromPageHtml(tiny), null);
  assert.ok(MIN_PAGE_JD_WORDS >= 40 && MIN_PAGE_JD_WORDS <= 200, 'the floor stays in the documented band');
});

test('embeddedDescriptionStrings: escaped JSON survives; an unterminated string stops the scan', () => {
  const html = '<script>x = {"descriptionHtml":"line one \\"quoted\\" end"};</script>';
  assert.deepEqual(embeddedDescriptionStrings(html), ['line one "quoted" end']);
  const open = '<script>x = {"descriptionHtml":"never closed';
  assert.deepEqual(embeddedDescriptionStrings(open), [], 'an unterminated value yields nothing');
});

test('fromEmbeddedDescription: the LONGEST description wins; no payload → null', () => {
  const html = '<script>x = {"descriptionHtml":"<p>short</p>","jobDescriptionHtml":"<p>the long one that should win the contest entirely</p>"};</script>';
  const jd = fromEmbeddedDescription(html);
  assert.ok(jd);
  assert.equal(jd.method, 'embedded-description');
  assert.match(jd.text, /long one/);
  assert.equal(fromEmbeddedDescription('<html><body>no payload</body></html>'), null);
});

test('pageTitle: the document title is extracted raw; absent → empty string', () => {
  assert.equal(pageTitle('<html><head><title>Just a moment...</title></head></html>'), 'Just a moment...');
  assert.equal(pageTitle('<TITLE>Attention Required! | Cloudflare</TITLE>'), 'Attention Required! | Cloudflare');
  assert.equal(pageTitle('<title class="x" data-y="z">Acme Careers</title>'), 'Acme Careers');
  assert.equal(pageTitle('<html><body>no title</body></html>'), '');
  assert.equal(pageTitle(''), '');
  assert.equal(pageTitle('<title>truncated'), '', 'an unterminated title yields nothing');
});

test('wordCount: splits on any whitespace, counts real words only', () => {
  assert.equal(wordCount('a b  c\n\td'), 4);
  assert.equal(wordCount('   '), 0);
});

// ── branch hardening (the coverage ratchet): every remaining branch in the
// module, driven through its exported pure functions only — htmlToText's
// entity decoding, stripMarkup's script/unclosed-tag paths, scriptTagEnd's
// bound, embeddedDescriptionStrings' malformed-string recovery, ldJsonBlocks'
// hostile tag heads, and the posting-identity/queue-walk fallbacks ──

test('htmlToText entities: Latin-1 names, named refs (incl. case-folded), decimal + hex code points; out-of-range, surrogate and unknown each become a space', () => {
  const jd = fromEmbeddedDescription(
    '{"descriptionHtml":"&Eacute;lite caf&eacute; &nbsp;&amp;&AMP; &#20320;&#x4F60;&#X597D; &#99999999; &#xD800; &nosuchentity;"}',
  );
  assert.match(jd.text, /Élite café/, 'Latin-1 named refs decode case-correctly; nbsp becomes a plain space');
  assert.match(jd.text, /&&/, 'a decoded ampersand survives (&amp; and case-folded &AMP;)');
  assert.match(jd.text, /你你好/, 'decimal and hex code points decode');
  assert.match(jd.text, /^Élite café && 你你好$/, 'out-of-range, surrogate and unknown entities collapse to spacing');
});

test('htmlToText escaped markup: tags with quoted attributes (&quot;, &amp; inside a value) unescape to real tags then strip to text', () => {
  const jd = fromEmbeddedDescription(
    '{"descriptionHtml":"&lt;p&gt;Apply &lt;a href=&quot;https://x.example/jobs/1?a=1&amp;b=2&quot;&gt;here&lt;/a&gt; today&lt;/p&gt; and &lt;br /&gt; soon"}',
  );
  assert.equal(jd.text, 'Apply here today\nand\nsoon', 'the attribute survives the tag strip; br/ becomes a line break');
});

test('stripMarkup: closed <script>/<style> payloads are dropped with text around them kept; an unclosed one swallows the rest', () => {
  const closed = fromEmbeddedDescription(
    '{"descriptionHtml":"Before<script>var t = 1;</script>Mid<style>p { color: red }</style>After"}',
  );
  assert.equal(closed.text, 'Before Mid After');
  assert.ok(!closed.text.includes('var t'), 'script payload is not text');
  assert.ok(!closed.text.includes('color'), 'style payload is not text');
  const unclosedScript = fromEmbeddedDescription('{"descriptionHtml":"Visible<script>var a = 1 and everything after is payload"}');
  assert.equal(unclosedScript.text, 'Visible', 'an unclosed <script> ends the extractable text');
  const unclosedStyle = fromEmbeddedDescription('{"descriptionHtml":"Kept<style>.a { broken"}');
  assert.equal(unclosedStyle.text, 'Kept', 'an unclosed <style> ends the extractable text');
});

test('stripMarkup: a "<" with no ">" keeps the rest as prose; a tag-wannabe (<5 …>) degrades to a space', () => {
  const noGt = fromEmbeddedDescription('{"descriptionHtml":"I would love <3 for this role"}');
  assert.equal(noGt.text, 'I would love <3 for this role', 'a lone "<" is prose, never eaten');
  const wannabe = fromEmbeddedDescription('{"descriptionHtml":"teams of <5 engineers> apply here"}');
  assert.equal(wannabe.text, 'teams of apply here', 'a "<" whose name does not parse strips to a space');
});

test('ldJsonBlocks: hostile tag heads — no ">", an oversized head, a ">" inside an unmatched quote, a closing tag without ">"', () => {
  assert.deepEqual(ldJsonBlocks(null), [], 'null input yields nothing');
  assert.deepEqual(ldJsonBlocks('<script type="application/ld+json"'), [], 'no ">" after <script → nothing');
  const big = `<script type="application/ld+json" ${'x'.repeat(5000)}>{}</script>`;
  assert.deepEqual(ldJsonBlocks(big), [], 'a tag head beyond the 4 KB bound is skipped, not scanned');
  assert.deepEqual(ldJsonBlocks('<script type="application/ld+json" q="unfinished>{}'), [],
    'a ">" inside an unmatched attribute quote is not a tag end');
  const noCloseGt = '<script type="application/ld+json">{"a":1}</script';
  assert.deepEqual(ldJsonBlocks(noCloseGt), ['{"a":1}'], 'a closing tag without ">" still yields the block, then stops');
});

test('embeddedDescriptionStrings: a raw control character is escaped and recovered; a bad escape degrades to spacing', () => {
  const ctrl = '{"descriptionHtml":"line one\u0007line two"}';
  assert.deepEqual(embeddedDescriptionStrings(ctrl), ['line one\u0007line two'],
    'the raw BEL is escaped, parsed, and kept as a character');
  const bad = '{"descriptionHtml":"abc\\d"}';
  assert.deepEqual(embeddedDescriptionStrings(bad), ['abc '],
    'an invalid JSON escape fails both parses and degrades to spacing, never markup');
});

test('fromLdJson: odd node shapes — array @type, null queue nodes, string hiringOrganization, array/string jobLocation, object country, array employmentType, absent location', () => {
  const rich = wrap(JSON.stringify({
    '@context': 'https://schema.org',
    '@type': ['JobPosting', 'Thing'],
    title: 'Marine Engineer',
    description: BODY,
    hiringOrganization: 'Acme GmbH',
    jobLocation: [{ address: { addressLocality: 'Kiel', addressRegion: 'SH', addressCountry: { name: 'Germany' } } }],
    employmentType: ['FULL_TIME', 'CONTRACTOR'],
  }));
  const jd = fromLdJson(rich);
  assert.ok(jd, 'an array @type still qualifies');
  assert.match(jd.text, /^# Marine Engineer/);
  assert.match(jd.text, /\*\*Company:\*\* Acme GmbH/, 'a string hiringOrganization is used directly');
  assert.match(jd.text, /\*\*Location:\*\* Kiel, SH, Germany/, 'array jobLocation takes the first entry; object country takes .name');
  assert.match(jd.text, /\*\*Employment type:\*\* FULL_TIME, CONTRACTOR/, 'an array employmentType joins');
  const noLoc = fromLdJson(wrap(JSON.stringify({ '@type': 'JobPosting', title: 'X', description: BODY, jobLocation: 'Remote · Kiel' })));
  assert.ok(noLoc && !noLoc.text.includes('**Location:**'), 'a string jobLocation resolves to nothing → no Location line');
  const nullNode = fromLdJson(wrap(JSON.stringify({ '@graph': [null, posting()] })));
  assert.ok(nullNode, 'a null node in the queue is skipped, the real posting still found');
});

test('jdFromPageHtml: queue-walk fallbacks — malformed block, null nodes, @graph walk, array @type, minimal posting (every canon fallback)', () => {
  assert.equal(jdFromPageHtml('<script type="application/ld+json">{"broken":</script>'), null,
    'a malformed block is skipped by the closure scanner too');
  assert.equal(jdFromPageHtml(wrap(JSON.stringify([null, { '@type': 'JobPosting', identifier: 42 }]))), null,
    'null nodes are skipped; a bare JobPosting (non-string scalar identifier) has no JD to give');
  const graph = wrap(JSON.stringify({ '@graph': [{ '@type': ['JobPosting'] }] }));
  assert.equal(jdFromPageHtml(graph), null, 'an @graph walk with an array @type reaches the minimal posting');
});

test('jdFromPageHtml: identity checks — @id fallback, foreign host kept, strong-token compare, token-less URLs kept, malformed requested URL kept, fragment-query ids', () => {
  const req = 'https://careers.example.com/offer/777x';
  assert.equal(jdFromPageHtml(wrap(JSON.stringify(posting({ '@id': 'https://careers.example.com/offer/999z' }))), Date.now(), req),
    null, 'a same-host @id naming another job is refused');
  const foreign = jdFromPageHtml(wrap(JSON.stringify(posting({ url: 'https://cdn.other.org/job/1' }))), Date.now(), req);
  assert.ok(foreign && foreign.method === 'ld+json', 'a different host is not an identity match → kept');
  const noTok = jdFromPageHtml(wrap(JSON.stringify(posting({ url: req }))), Date.now(), 'https://careers.example.com/about');
  assert.ok(noTok && noTok.method === 'ld+json', 'a requested URL with no id tokens is not refused');
  const badUrl = jdFromPageHtml(wrap(JSON.stringify(posting({ url: req }))), Date.now(), 'not a url at all');
  assert.ok(badUrl && badUrl.method === 'ld+json', 'an unparseable requested URL is not refused');
  assert.equal(jdFromPageHtml(wrap(JSON.stringify(posting({ url: req }))), Date.now(), 'https://careers.example.com/offer/2044-summer'),
    null, 'two non-year id tokens that share nothing are different jobs');
  assert.equal(jdFromPageHtml(wrap(JSON.stringify(posting({ url: 'https://careers.example.com/#/job?jobId=2031' }))), Date.now(), 'https://careers.example.com/#/jobs/2044'),
    null, 'an id inside a fragment query is compared like a path id');
});

test('pageTitle: a nullish page yields an empty string', () => {
  assert.equal(pageTitle(null), '');
  assert.equal(pageTitle(undefined), '');
});
