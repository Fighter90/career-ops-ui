/**
 * Habr Career scanner. Scrapes the public search HTML at
 * https://career.habr.com/vacancies?q=<query>
 *
 * No API key needed. Works from any IP.
 *
 * The site is server-rendered HTML — we parse vacancy-card blocks with regex
 * (intentionally not pulling in cheerio/JSDOM to keep deps minimal).
 */

const HABR_BASE = 'https://career.habr.com';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Safari/605.1.15';

/**
 * Search Habr Career for one query string.
 * Returns array of normalized job objects.
 *
 * Options:
 *   onlyRemote   — restrict to "Можно удалённо" (default false)
 *   experience   — '1' junior, '2' middle, '3' senior, '4' lead
 *   sort         — 'date' (default) or 'salary_desc'
 */
// Hard safety cap on pagination depth per query (Habr pages are 1-indexed).
const MAX_PAGES = 50;

export async function searchHabr(query, opts = {}) {
  const { onlyRemote = false, experience, sort = 'date', maxPages = MAX_PAGES, fetchImpl = fetch, signal } = opts;

  const out = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({ q: query, type: 'all', sort, page: String(page) });
    if (onlyRemote) params.set('remote', '1');
    if (experience) params.set('qid', experience);

    const res = await fetchImpl(`${HABR_BASE}/vacancies?${params}`, {
      signal, // REVIEW-B3: propagate client-disconnect
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    if (!res.ok) {
      // Page 1 failing = source down → surface it; a later page is non-fatal.
      if (page === 1) {
        const err = new Error(`Habr Career: HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      break;
    }

    let added = 0;
    for (const job of parseHabrCards(await res.text())) {
      const key = job.url || job.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(job);
      added++;
    }
    if (added === 0) break; // no new vacancies → end of results
  }

  return out;
}

/**
 * Parse vacancy-cards from a Habr Career HTML page.
 * Pure function — exported for testing.
 */
export function parseHabrCards(html) {
  if (!html) return [];
  const out = [];
  // Each card starts with <div class="vacancy-card"> (no extra modifier classes
  // on the container itself) and is self-contained.
  const cardRe = /<div class="vacancy-card">([\s\S]*?)(?=<div class="vacancy-card">|<\/div>\s*<\/section>)/g;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const block = m[1];

    const titleMatch = block.match(
      /vacancy-card__title-link"\s+href="([^"]+)"[^>]*>\s*([^<]+?)\s*</
    );
    if (!titleMatch) continue;

    const id = (titleMatch[1].match(/\/vacancies\/(\d+)/) || [])[1];
    const company = (block.match(
      /vacancy-card__company"[^>]*>\s*<a[^>]*>\s*([^<]+?)\s*</
    ) || [])[1];
    const salary = (block.match(/basic-salary[^>]*>([^<]+)</) || [])[1];
    const date = (block.match(/<time[^>]*datetime="([^"]+)"/) || [])[1];

    // chip-with-icon__text yields experience level + remote tag
    const chips = [...block.matchAll(/chip-with-icon__text">([^<]+)</g)].map(
      (c) => c[1].trim()
    );

    const isRemote = chips.includes('Можно удалённо');
    const hasRelocation = chips.some((ch) => /релок|reloc/i.test(ch));
    out.push({
      id: id ? `habr-${id}` : `habr-${out.length}`,
      title: titleMatch[2].trim(),
      company: company?.trim() || '',
      url: HABR_BASE + titleMatch[1],
      salary: (salary || '').trim(),
      location: isRemote ? 'Remote' : 'Russia',
      isRemote,
      relocates: hasRelocation,
      workplaceType: isRemote ? 'Remote' : 'Onsite',
      date: date || '',
      snippet: chips.join(' · '),
      source: 'habr-career',
    });
  }
  return out;
}

export const HABR = { searchHabr, parseHabrCards };
