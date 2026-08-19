/**
 * Senjob source — board-wide HTML listing for Senegal (server/lib/sources/senjob.mjs).
 *
 * CI-isolated: a stubbed transport (no network, no port binding). The fixtures
 * reproduce shapes the live board serves, and each one decides the parser's
 * design:
 *   - the title link and the publication date sit in SIBLING cells, so a parser
 *     that windows around the link loses the date;
 *   - the board pins "sticky" postings to the top of every page, so the same
 *     posting id recurs and must merge rather than duplicate;
 *   - anchor bodies carry an HTML comment between the title and a spacer image,
 *     which a naive tag strip would leave inside the title;
 *   - the date is only machine-readable in a hidden span next to its localized form.
 *
 * The important group: a listing page that parses to nothing must THROW.
 * Returning [] would render a broken parser as a board with no openings —
 * indistinguishable from a healthy quiet board, and the reason scraped sources
 * are hard to trust.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  meta, DEFAULT_LIST_URL, SENJOB_HOST_RE, assertSenjobUrl, resolveListUrl,
  buildListUrl, visibleText, parseListingPage, assertParsedSomething, fetchSenjob,
} from '../server/lib/sources/senjob.mjs';
import { senjobAdapter } from '../server/lib/portals/adapters/senjob.mjs';

const textResponse = (s) => ({ ok: true, status: 200, text: async () => s });

// ---------------------------------------------------------------- fixtures

// One posting: title anchor in its own row, dates in the SIBLING row that
// follows. The anchor body carries an HTML comment + a spacer image.
const ROW_WITH_SIBLING_DATE = `
<tr style="height:70px;">
  <td align=center><div align=left>
    <a href="https://senjob.com/jobseekers/developpeur-fullstack_e_163401.html" style="font-size:18px; color:#222;">
      Developpeur Fullstack
      <!-- d ico postulez -->
      <img src="images/blank.gif">
      <!-- f ico postulez -->
    </a>
  </div></td>
  <td align=left valign=middle>Dakar</td>
</tr>
<tr>
  <td><a href="https://senjob.com/jobseekers/developpeur-fullstack_e_163401.html">&nbsp;</a>
    <span style='color:#999;'> Publi&eacute;: </span>
    <span style="display:none;">2026-08-14</span>14&nbsp;Aou.
  </td>
</tr>`;

// A self-contained posting whose place cell precedes the "Publié:" label inside
// the SAME row.
const ROW_INLINE = `
<tr>
  <td><div align=left>
    <a href="https://senjob.com/jobseekers/software-and-data-engineer_e_163402.html" style="color:#222;">Software and Data Engineer</a>
  </div></td>
  <td>Dakar <span style='color:#999;'> Publi&eacute;: </span><span style="display:none;">2026-08-12</span>12&nbsp;Aou.</td>
</tr>`;

// A title carrying a named entity AND a non-emittable C0 numeric reference — the
// entity decodes, the C0 reference stays literal (never becomes a control char).
const ROW_ENTITY = `
<tr>
  <td><div align=left>
    <a href="https://senjob.com/jobseekers/r-and-d-engineer_e_163403.html">R&amp;D Engineer&#1;</a>
  </div></td>
  <td>Dakar <span style='color:#999;'> Publi&eacute;: </span><span style="display:none;">2026-08-10</span>10&nbsp;Aou.</td>
</tr>`;

const PAGE = `<html><body><table>${ROW_WITH_SIBLING_DATE}${ROW_INLINE}</table></body></html>`;

// ------------------------------------------------------------------- tests

test('meta is valid for scan-dropdown auto-discovery', () => {
  assert.equal(meta.value, 'senjob');
  assert.equal(meta.label, 'Senjob');
  assert.equal(meta.region, 'en');
});

test('SENJOB_HOST_RE + assertSenjobUrl pin to senjob.com (anchored, HTTPS-only)', () => {
  assert.equal(SENJOB_HOST_RE.test('senjob.com'), true);
  assert.equal(SENJOB_HOST_RE.test('www.senjob.com'), true);
  assert.equal(SENJOB_HOST_RE.test('senjob.com.evil.com'), false); // suffix spoof
  assert.equal(SENJOB_HOST_RE.test('evilsenjob.com'), false);
  assert.equal(assertSenjobUrl('https://senjob.com/offres-d-emploi.php'), 'https://senjob.com/offres-d-emploi.php');
  assert.throws(() => assertSenjobUrl('https://evil.example.com/x.senjob.com'), /untrusted hostname/);
  assert.throws(() => assertSenjobUrl('https://senjob.com.evil.com/jobs'), /untrusted hostname/);
  assert.throws(() => assertSenjobUrl('http://senjob.com/offres-d-emploi.php'), /HTTPS/); // https only
  assert.throws(() => assertSenjobUrl('not a url'), /invalid URL/);
});

test('resolveListUrl collapses on-host URLs to the board, rejects foreign/http', () => {
  assert.equal(resolveListUrl({ careers_url: 'https://senjob.com/offres-d-emploi.php' }), DEFAULT_LIST_URL);
  assert.equal(resolveListUrl({ api: 'https://senjob.com/anything-else' }), DEFAULT_LIST_URL);
  assert.equal(resolveListUrl({ careers_url: 'https://evil.com/x.senjob.com' }), null);
  assert.equal(resolveListUrl({ careers_url: 'https://senjob.com.evil.com/jobs' }), null);
  assert.equal(resolveListUrl({ careers_url: 'http://senjob.com/offres-d-emploi.php' }), null); // https only
  assert.equal(resolveListUrl({}), null);
});

test('buildListUrl: page 1 is bare, later pages carry ?page=N', () => {
  assert.equal(buildListUrl(DEFAULT_LIST_URL, 1), DEFAULT_LIST_URL);
  assert.equal(buildListUrl(DEFAULT_LIST_URL, 3), `${DEFAULT_LIST_URL}?page=3`);
});

test('visibleText strips comments before tags and decodes entities in one C0-safe pass', () => {
  // A tag-only strip leaves "d ico postulez" sitting inside the title.
  assert.equal(visibleText('Developpeur Fullstack <!-- d ico postulez --> <img src="x.gif">'), 'Developpeur Fullstack');
  // Single-pass decode: &amp;quot; must NOT double-unescape into a literal quote.
  assert.equal(visibleText('&amp;quot;'), '&quot;');
  assert.equal(visibleText('&amp;amp;'), '&amp;');
  // The shared decoder's named table is small (amp/lt/gt/quot/apos/nbsp); named
  // accented entities are left literal, but decimal + hex NUMERIC references —
  // the accented form a French board also emits — decode.
  assert.equal(visibleText('R&amp;D'), 'R&D');
  assert.equal(visibleText('Charg&eacute; de projet'), 'Charg&eacute; de projet'); // named accent stays literal
  assert.equal(visibleText('D&#233;veloppeur'), 'Développeur'); // decimal
  assert.equal(visibleText('D&#xE9;veloppeur'), 'Développeur'); // hex
  assert.equal(visibleText("L&#39;agent"), "L'agent");
  // C0 controls, NUL and lone surrogates stay literal — never emitted as chars.
  assert.equal(visibleText('&#1;'), '&#1;');
  assert.equal(visibleText('&#55296;'), '&#55296;'); // 0xD800 surrogate half
  assert.equal(visibleText('&#xD800;'), '&#xD800;');
  // No actual control character leaks through.
  assert.ok(!/[\u0000-\u0008\u000e-\u001f]/.test(visibleText('Bad&#1;Entity')));
});

test('parseListingPage: one job per posting id, sticky rows merged, sibling date recovered', () => {
  const jobs = parseListingPage(PAGE);
  assert.equal(jobs.length, 2);

  const fullstack = jobs.find((j) => /Fullstack/.test(j.title));
  assert.ok(fullstack);
  assert.equal(fullstack.title, 'Developpeur Fullstack'); // comment + spacer image removed
  assert.equal(fullstack.id, '163401'); // id extracted from _e_{id}.html
  assert.equal(fullstack.url, 'https://senjob.com/jobseekers/developpeur-fullstack_e_163401.html');
  assert.equal(fullstack.location, 'Dakar');
  assert.equal(fullstack.date, '2026-08-14'); // hidden ISO date from the SIBLING row

  const inline = jobs.find((j) => /Data Engineer/.test(j.title));
  assert.ok(inline);
  assert.equal(inline.location, 'Dakar');
  assert.equal(inline.date, '2026-08-12'); // place + date share one row

  // robustness
  assert.equal(parseListingPage('<html>no jobs</html>').length, 0);
  assert.equal(parseListingPage(undefined).length, 0);
});

test('assertParsedSomething throws only when posting links are present but unparsed', () => {
  // Links on the page but the parser found none → the markup changed → throw.
  assert.throws(
    () => assertParsedSomething(PAGE, DEFAULT_LIST_URL),
    /markup changed/,
  );
  // A genuinely empty page is a quiet board, not a break — must NOT throw.
  assert.doesNotThrow(() => assertParsedSomething('<html><body>No results.</body></html>', DEFAULT_LIST_URL));
});

test('fetchSenjob: pins redirect:error + a browser UA, dedups sticky repeats, stops on no-fresh page', async () => {
  const pages = new Map([
    [DEFAULT_LIST_URL, PAGE],
    [`${DEFAULT_LIST_URL}?page=2`, ROW_INLINE], // only a sticky repeat of 163402
  ]);
  const seenInit = [];
  const requested = [];
  const fetchImpl = async (url, init) => {
    requested.push(url);
    seenInit.push(init);
    return textResponse(pages.get(url) ?? '<html><body>No results.</body></html>');
  };

  const jobs = await fetchSenjob(DEFAULT_LIST_URL, { fetchImpl });
  assert.equal(jobs.length, 2); // sticky 163402 not duplicated
  assert.equal(requested.length, 2); // stops once page 2 contributes nothing new
  assert.equal(jobs[0].source, 'senjob');
  assert.equal(jobs[0].id, 'senjob-163401');
  assert.equal(jobs[0].company, ''); // never invented from the slug
  // every request is host-pinned via redirect:error + a non-empty browser UA
  assert.ok(seenInit.length > 0);
  for (const init of seenInit) {
    assert.equal(init.redirect, 'error');
    assert.equal(typeof init.headers['User-Agent'], 'string');
    assert.ok(init.headers['User-Agent'].length > 0);
  }
});

test('fetchSenjob: entity decodes in the normalized output, no C0 control leaks', async () => {
  const jobs = await fetchSenjob(DEFAULT_LIST_URL, {
    fetchImpl: async (url) => textResponse(
      url.includes('page=') ? '<html>No results.</html>'
        : `<html><body><table>${ROW_ENTITY}</table></body></html>`,
    ),
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'senjob-163403');
  assert.ok(jobs[0].title.startsWith('R&D Engineer')); // &amp; decoded to a single &
  assert.equal(jobs[0].location, 'Dakar'); // place cut at the (entity-form) Publié label
  assert.equal(jobs[0].date, '2026-08-10');
  // the &#1; reference must not have become an actual control character
  assert.ok(!/[\u0000-\u0008\u000e-\u001f]/.test(jobs[0].title));
});

test('fetchSenjob: a broken page 1 (links present, unparsable) throws instead of an empty board', async () => {
  const brokenCtx = {
    // Realistic markup change: postings still on the page, but the link moved
    // off an anchor `href` onto a data attribute (a JS-driven card).
    fetchImpl: async () => textResponse('<div data-url="https://senjob.com/jobseekers/x_e_1.html">x</div>'),
  };
  await assert.rejects(() => fetchSenjob(DEFAULT_LIST_URL, brokenCtx), /markup changed/);
});

test('fetchSenjob: rejects a foreign host and a non-HTTPS endpoint (SSRF pin)', async () => {
  const fetchImpl = async () => textResponse(PAGE);
  await assert.rejects(() => fetchSenjob('https://evil.example.com/jobs', { fetchImpl }), /untrusted hostname/);
  await assert.rejects(() => fetchSenjob('http://senjob.com/offres-d-emploi.php', { fetchImpl }), /HTTPS/);
});

test('fetchSenjob: honours a per-company max_pages walk cap; clamps an over-large value', async () => {
  // Every page yields a NEW posting, so nothing but the cap can stop the run.
  const uniquePage = (n) => `<html><body><table>${ROW_WITH_SIBLING_DATE.replace(/163401/g, String(800000 + n))}</table></body></html>`;
  let calls = 0;
  const fetchImpl = async () => textResponse(uniquePage(calls++));
  // An already-aborted signal short-circuits the polite inter-page delay (the
  // mock fetch ignores the signal), so the 50-page clamp doesn't wall-clock the
  // suite. delay() resolves immediately when signal.aborted is set.
  const signal = AbortSignal.abort();

  calls = 0;
  await fetchSenjob(DEFAULT_LIST_URL, { fetchImpl, signal, company: { max_pages: 2 } });
  assert.equal(calls, 2); // capped despite every page bringing fresh ids

  calls = 0;
  await fetchSenjob(DEFAULT_LIST_URL, { fetchImpl, signal, company: { max_pages: 999 } });
  assert.equal(calls, 50); // clamped to the 50-page ceiling
});

test('senjobAdapter: matches() + buildEndpoint() contracts (endpoint is a string or null)', () => {
  assert.equal(senjobAdapter.id, 'senjob');
  assert.equal(senjobAdapter.label, 'Senjob');
  assert.equal(typeof senjobAdapter.fetch, 'function');

  // provider OR on-host careers_url; foreign/spoof hosts do not match
  assert.equal(senjobAdapter.matches({ provider: 'senjob' }), true);
  assert.equal(senjobAdapter.matches({ careers_url: 'https://senjob.com/offres-d-emploi.php' }), true);
  assert.equal(senjobAdapter.matches({ careers_url: 'https://senjob.com.evil.com/jobs' }), false);
  assert.equal(senjobAdapter.matches({ careers_url: 'https://example.com/jobs' }), false);
  assert.equal(senjobAdapter.matches(null), false);

  // buildEndpoint: on-host → canonical board; provider-only → default; foreign → null
  assert.equal(senjobAdapter.buildEndpoint({ careers_url: 'https://senjob.com/x' }), DEFAULT_LIST_URL);
  assert.equal(senjobAdapter.buildEndpoint({ provider: 'senjob' }), DEFAULT_LIST_URL);
  assert.equal(senjobAdapter.buildEndpoint({ careers_url: 'https://example.com/jobs' }), null);
  assert.equal(typeof senjobAdapter.buildEndpoint({ provider: 'senjob' }), 'string');
});
