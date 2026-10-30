/**
 * Habr Career scanner. Scrapes the public search HTML at
 * https://career.habr.com/vacancies?q=<query>
 *
 * No API key needed. Works from any IP.
 *
 * The site is server-rendered HTML — we parse vacancy-card blocks with regex
 * (intentionally not pulling in cheerio/JSDOM to keep deps minimal).
 */

import { decodeEntities } from '../html-entities.mjs';
import { fetchTextFollowSameHost } from '../http-json.mjs';

// CAR-142 parity with hh.mjs: decode entities FIRST, then strip any markup
// the decode resurrected («&lt;script&gt;» must not reach scan rows live).
function stripDecoded(s) {
  return decodeEntities(String(s || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/</g, '') // a lone raw '<' could still open markup downstream; '>>' in titles is real text
    .replace(/\s+/g, ' ')
    .trim();
}

const HABR_BASE = 'https://career.habr.com';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Safari/605.1.15';

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs for the rationale.
export const meta = {
  value: 'habr-career',
  label: 'Habr Career',
  region: 'ru',
  configKey: 'habr',
};

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

// A qualification level in the meta row is never a city. ASCII \b is dead
// next to Cyrillic — the boundary is Unicode-letter/digit (see the
// specialization matcher in public/js/views/map.js for the same pattern).
const QUALIFICATION_CHIP =
  /^(?:junior|middle|senior|lead|intern|стаж[её]р|младший|средний|старший|ведущий)(?![\p{L}\p{N}])/iu;

// CAR-142 — a meta chip that merely is not the remote marker or a
// qualification is not necessarily a city: the relocation notice
// («Возможна релокация») and employment types («Полный рабочий день»,
// «Полная занятость», «Стажировка») sit in the same row, and a city-less
// card used to wear the relocation text as its `location`. These chips are
// never candidates.
const RELOCATION_CHIP = /релок|reloc|переезд/i;
const EMPLOYMENT_CHIP =
  /рабоч(?:ий|их) (?:день|час)|час(?:а|ов) в день|день в неделю|занятость|график|стажировк|волонт[её]р|вахтов|проектная|оформлени|командировк/i;
// CAR-142 rev-3 #3 — «Опыт от 3 лет» passes every filter above but is an
// experience REQUIREMENT, not a city: the chip-order fallback used to wear it
// as `location` (a fabricated place). ASCII `\b` never bounds Cyrillic, so
// the lookahead follows the QUALIFICATION_CHIP pattern.
const EXPERIENCE_CHIP = /^опыт(?![\p{L}\p{N}])/iu;
// Habr marks the real city structurally — it links the chip to the
// city-filtered board (?city_id=…) and/or carries a location icon class
// (the Cyrillic «с» in loсation is Habr's own). Preferred over chip order.
const LOCATION_HINT = /city_id=|meta_lo[сc]ation|svg-icon-(?:lo[сc]ation|earth|map)/i;

/**
 * CAR-142 — pick the city chip from a card's meta row. Every chip keeps the
 * markup BETWEEN it and the previous chip (its "lead"): the location link
 * and icon class live there, so a structurally marked chip wins over an
 * earlier chip that merely passes the text filters.
 */
function pickCityChip(metaBlock) {
  const chips = [];
  const re = /chip-with-icon__text">([^<]+)</g;
  let m, end = 0;
  while ((m = re.exec(metaBlock)) !== null) {
    chips.push({ lead: metaBlock.slice(end, m.index), text: decodeEntities(m[1].trim()) });
    end = m.index + m[0].length;
  }
  const isCity = (c) =>
    c.text && c.text !== 'Можно удалённо'
    && !QUALIFICATION_CHIP.test(c.text)
    && !RELOCATION_CHIP.test(c.text)
    && !EMPLOYMENT_CHIP.test(c.text)
    && !EXPERIENCE_CHIP.test(c.text);
  return (chips.find((c) => isCity(c) && LOCATION_HINT.test(c.lead)) || chips.find(isCity) || {}).text || '';
}

export async function searchHabr(query, opts = {}) {
  const { onlyRemote = false, experience, sort = 'date', maxPages = MAX_PAGES, fetchImpl = fetch, signal } = opts;

  const out = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({ q: query, type: 'all', sort, page: String(page) });
    if (onlyRemote) params.set('remote', '1');
    if (experience) params.set('qid', experience);

    // Guarded transport with the manual same-host redirect contract: a 3xx is
    // followed only when its Location stays on career.habr.com over https
    // (each hop re-guarded), and an off-host redirect is refused — Node's
    // default 'follow' would bounce the request to any host upstream names.
    let pageHtml;
    try {
      ({ text: pageHtml } = await fetchTextFollowSameHost(fetchImpl, `${HABR_BASE}/vacancies?${params}`, {
        signal,
        headers: { 'User-Agent': UA, Accept: 'text/html' },
      }));
    } catch (e) {
      // Page 1 failing = source down → surface it; a later page is non-fatal.
      if (page === 1) {
        if (typeof e?.status !== 'number') throw e; // network-level: surface raw
        const err = new Error(`Habr Career: HTTP ${e.status}`);
        err.status = e.status;
        throw err;
      }
      break;
    }

    let added = 0;
    for (const job of parseHabrCards(pageHtml)) {
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
    // CAR-105 — the meta row is "qualification · remote marker · CITY"; the
    // city feeds `location` so the job map can geocode a real place instead
    // of the country string 'Russia' (a country centroid is exactly what the
    // geocoder refuses, so every Habr row landed in the map's no-location
    // bucket). Skills chips live in their own section AFTER the meta row and
    // are excluded by slicing at it; qualification levels, relocation,
    // employment-type and experience chips are excluded by name, and a
    // structurally marked city chip (?city_id= link / location icon) wins
    // over chip order (CAR-142).
    const metaEnd = block.indexOf('vacancy-card__skills');
    const metaBlock = metaEnd === -1 ? block : block.slice(0, metaEnd);
    const city = pickCityChip(metaBlock);
    out.push({
      id: id ? `habr-${id}` : `habr-${out.length}`,
      // Decode HTML entities BEFORE the title reaches title_filter and before
      // the company name flows on to the tracker/reports — the SSR cards arrive
      // escaped ("Changellenge &gt;&gt;", "ООО &quot;М-ТЕХ&quot;"), so an undecoded
      // "&" in a role silently failed a user's own "&" keyword (v1.210.1).
      title: stripDecoded(titleMatch[2].trim()),
      company: stripDecoded(company?.trim() || ''),
      url: HABR_BASE + titleMatch[1],
      salary: (salary || '').trim(),
      location: city || (isRemote ? 'Remote' : 'Russia'),
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
