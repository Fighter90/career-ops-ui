/**
 * hh.ru scanner — scrapes the public search HTML at
 * https://hh.ru/search/vacancy?text=<query>
 *
 * Why HTML and not the API:
 *   The JSON API (api.hh.ru/vacancies) now returns a bare
 *   `{"errors":[{"type":"forbidden"}]}` (403) to every programmatic client —
 *   from any IP (US, RU datacenter, RU residential, RU mobile) and with any
 *   User-Agent. That bare `forbidden` is NOT in hh.ru's documented error
 *   catalogue (UA problems are 400 `bad_user_agent`, auth is 403 `oauth/…`),
 *   so it's an edge/anti-bot block on the API endpoint, not something a proxy
 *   or token fixes. The *website* (hh.ru/search/vacancy), however, serves
 *   server-rendered HTML with full results to any client carrying a browser
 *   User-Agent — works from any IP, no proxy, no key. So we scrape that, the
 *   same way the Habr Career adapter scrapes its search page.
 *
 * The page is server-rendered — we parse vacancy cards with regex
 * (intentionally not pulling in cheerio/JSDOM to keep deps minimal).
 */

const HH_SITE = 'https://hh.ru/search/vacancy';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const AREA_MOSCOW = 1;
const AREA_RUSSIA = 113;
const AREA_REMOTE = 1001;

// Hard safety cap on pagination depth per query, so a broad query can't spin
// forever. hh.ru's own result window also tops out near 2000 (page×per_page),
// and the "no new vacancies" guard below usually stops us long before this.
const MAX_PAGES = 50;

/**
 * Search hh.ru for one query string. Walks ALL result pages (`&page=0,1,2…`)
 * until a page yields no new vacancies (empty or all-duplicate) or MAX_PAGES
 * is hit. Returns deduplicated normalized job objects.
 *
 * Options:
 *   area       — hh.ru area id (default 113 = Russia-wide)
 *   perPage    — items_on_page (default 50)
 *   onlyRemote — restrict to remote (schedule=remote)
 *   maxPages   — pagination cap (default MAX_PAGES)
 *   fetchImpl  — override for tests (default: global fetch)
 *   signal     — AbortSignal propagated to fetch
 */
export async function searchHH(query, opts = {}) {
  const {
    area = AREA_RUSSIA,
    perPage = 50,
    onlyRemote = false,
    maxPages = MAX_PAGES,
    fetchImpl = fetch,
    signal,
  } = opts;

  const out = [];
  const seen = new Set();

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      text: query,
      items_on_page: String(perPage),
      area: String(area),
      page: String(page),
    });
    if (onlyRemote) params.set('schedule', 'remote');

    const res = await fetchImpl(`${HH_SITE}?${params}`, {
      signal,
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'ru-RU,ru;q=0.9',
        Accept: 'text/html',
      },
    });

    if (!res.ok) {
      // Page 0 failing = the source is down/blocked → surface it. A later
      // page failing is non-fatal: keep what we already collected.
      if (page === 0) {
        const err = new Error(`hh.ru: HTTP ${res.status}`);
        err.status = res.status;
        err.geoBlocked = res.status === 403;
        throw err;
      }
      break;
    }

    let added = 0;
    for (const job of parseHhCards(await res.text())) {
      if (seen.has(job.id)) continue;
      seen.add(job.id);
      out.push(job);
      added++;
    }
    // No new vacancies on this page → we've reached the end (or hh started
    // repeating the last page past the result window). Stop.
    if (added === 0) break;
  }

  return out;
}

// Zero-width / directional marks + BOM that hh.ru sprinkles into markup.
const ZWSP = /[​-‏⁠﻿]/g;

// Single-pass HTML-entity decode. Deliberately does NOT decode &lt; / &gt;
// and the final pass strips any literal angle bracket, so tag-stripping can
// never be undone into a live `<script>` (no double-unescaping, no HTML
// element injection — these results are also rendered as text nodes, never
// innerHTML, but we keep the source clean regardless).
const ENTITY = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#x27;': "'", '&#39;': "'", '&laquo;': '«', '&raquo;': '»', '&mdash;': '—', '&ndash;': '–' };

function stripTags(s) {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|amp|quot|#x27|#39|laquo|raquo|mdash|ndash);/g, (m) => ENTITY[m] || ' ')
    .replace(ZWSP, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function qaText(block, qa) {
  const m = block.match(
    new RegExp('data-qa="' + qa + '[^"]*"[^>]*>([\\s\\S]*?)</(?:a|span|div)>'),
  );
  return m ? stripTags(m[1]) : '';
}

// Salary amount, not the "Выплаты: …" payment-frequency label. hh.ru hides
// most salaries, so this is best-effort: a currency run inside the card.
function extractSalary(block) {
  const m = block.match(
    /(?:от|до)?\s?[\d   ]{4,}(?:\s?[–—-]\s?[\d   ]{4,})?\s?(?:₽|руб|€|\$|USD|EUR|KZT|BYN|тенге|сом)/i,
  );
  return m ? stripTags(m[0]) : '';
}

/**
 * Parse vacancy cards from an hh.ru search-results HTML page.
 * Pure function — exported for testing.
 *
 * Each card container carries data-qa="vacancy-serp__vacancy" (ad blocks use
 * a different marker and link to adsrv.hh.ru, so they're skipped naturally —
 * we only accept hh.ru/vacancy/<id> title links).
 */
export function parseHhCards(html) {
  if (!html) return [];
  const out = [];
  const seen = new Set();
  const blocks = html.split('data-qa="vacancy-serp__vacancy"').slice(1);

  for (const b of blocks) {
    const tm = b.match(
      /data-qa="serp-item__title[^"]*"[^>]*href="(https:\/\/hh\.ru\/vacancy\/(\d+)[^"]*)"[\s\S]*?>([\s\S]*?)<\/a>/,
    );
    if (!tm) continue;

    const id = tm[2];
    if (seen.has(id)) continue;
    seen.add(id);

    const title = stripTags(tm[3]);
    if (!title) continue;

    const remote = /удал[её]н/i.test(b);

    out.push({
      id: `hh-${id}`,
      title,
      company:
        qaText(b, 'vacancy-serp__vacancy-employer-text') ||
        qaText(b, 'vacancy-serp__vacancy-employer'),
      url: `https://hh.ru/vacancy/${id}`,
      salary: extractSalary(b),
      location: qaText(b, 'vacancy-serp__vacancy-address'),
      isRemote: remote,
      workplaceType: remote ? 'Remote' : 'Onsite',
      relocates: false,
      date: '',
      snippet: qaText(b, 'vacancy-serp__vacancy_snippet_responsibility'),
      source: 'hh.ru',
    });
  }

  return out;
}

export const HH = { searchHH, parseHhCards, AREA_MOSCOW, AREA_RUSSIA, AREA_REMOTE };
