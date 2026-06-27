/* global window */
/**
 * countries.js — geography helper for the #/scan results filter (v1.78.0).
 *
 * A scanned job's `location` is free text ("Berlin, Germany", "London",
 * "San Francisco, CA, USA", "Remote — EU", "Москва"…). This module turns that
 * into a best-effort {code, name, flag} country so the Scan page can offer a
 * **country dropdown with flags** and let the user keep only roles tied to a
 * given country — alongside the existing Remote/Hybrid/Onsite work-type filter,
 * so you can search both country-bound AND remote work.
 *
 * Browser classic script (like skills.js): exposes `window.Countries`.
 * Structured-data fixture: exempt from the 400-LOC file-size rule.
 *
 * Detection is intentionally conservative — it never guesses. A location it
 * can't confidently map returns `null` (the row then only shows under
 * "All countries"). It is NOT a geocoder; it covers the countries and major
 * cities that actually appear in tech/job-board postings.
 */
(function () {
  // code = ISO-3166 alpha-2 (lowercased). flag = regional-indicator emoji.
  // aliases = lowercased names/abbreviations that may appear in a location.
  const COUNTRIES = [
    { code: 'us', name: 'United States', flag: '🇺🇸', aliases: ['united states', 'usa', 'u.s.a', 'u.s.', 'america', 'estados unidos'] },
    { code: 'gb', name: 'United Kingdom', flag: '🇬🇧', aliases: ['united kingdom', 'uk', 'u.k.', 'great britain', 'britain', 'england', 'scotland', 'wales', 'northern ireland'] },
    { code: 'de', name: 'Germany', flag: '🇩🇪', aliases: ['germany', 'deutschland', 'alemania', 'allemagne'] },
    { code: 'fr', name: 'France', flag: '🇫🇷', aliases: ['france', 'frankreich'] },
    { code: 'es', name: 'Spain', flag: '🇪🇸', aliases: ['spain', 'españa', 'espana', 'espagne'] },
    { code: 'it', name: 'Italy', flag: '🇮🇹', aliases: ['italy', 'italia', 'italie'] },
    { code: 'pt', name: 'Portugal', flag: '🇵🇹', aliases: ['portugal'] },
    { code: 'nl', name: 'Netherlands', flag: '🇳🇱', aliases: ['netherlands', 'the netherlands', 'holland', 'nederland', 'pays-bas'] },
    { code: 'be', name: 'Belgium', flag: '🇧🇪', aliases: ['belgium', 'belgique', 'belgië', 'belgie'] },
    { code: 'ch', name: 'Switzerland', flag: '🇨🇭', aliases: ['switzerland', 'schweiz', 'suisse', 'svizzera'] },
    { code: 'at', name: 'Austria', flag: '🇦🇹', aliases: ['austria', 'österreich', 'osterreich'] },
    { code: 'ie', name: 'Ireland', flag: '🇮🇪', aliases: ['ireland', 'éire', 'eire'] },
    { code: 'dk', name: 'Denmark', flag: '🇩🇰', aliases: ['denmark', 'danmark'] },
    { code: 'se', name: 'Sweden', flag: '🇸🇪', aliases: ['sweden', 'sverige'] },
    { code: 'no', name: 'Norway', flag: '🇳🇴', aliases: ['norway', 'norge'] },
    { code: 'fi', name: 'Finland', flag: '🇫🇮', aliases: ['finland', 'suomi'] },
    { code: 'pl', name: 'Poland', flag: '🇵🇱', aliases: ['poland', 'polska'] },
    { code: 'cz', name: 'Czechia', flag: '🇨🇿', aliases: ['czechia', 'czech republic', 'česko', 'cesko'] },
    { code: 'ro', name: 'Romania', flag: '🇷🇴', aliases: ['romania', 'românia'] },
    { code: 'ua', name: 'Ukraine', flag: '🇺🇦', aliases: ['ukraine', 'україна', 'ukraina'] },
    { code: 'ru', name: 'Russia', flag: '🇷🇺', aliases: ['russia', 'russian federation', 'россия', 'rossiya'] },
    { code: 'tr', name: 'Türkiye', flag: '🇹🇷', aliases: ['türkiye', 'turkiye', 'turkey'] },
    { code: 'gr', name: 'Greece', flag: '🇬🇷', aliases: ['greece', 'hellas', 'ελλάδα'] },
    { code: 'hu', name: 'Hungary', flag: '🇭🇺', aliases: ['hungary', 'magyarország'] },
    { code: 'ca', name: 'Canada', flag: '🇨🇦', aliases: ['canada'] },
    { code: 'mx', name: 'Mexico', flag: '🇲🇽', aliases: ['mexico', 'méxico'] },
    { code: 'br', name: 'Brazil', flag: '🇧🇷', aliases: ['brazil', 'brasil'] },
    { code: 'ar', name: 'Argentina', flag: '🇦🇷', aliases: ['argentina'] },
    { code: 'cl', name: 'Chile', flag: '🇨🇱', aliases: ['chile'] },
    { code: 'co', name: 'Colombia', flag: '🇨🇴', aliases: ['colombia'] },
    { code: 'au', name: 'Australia', flag: '🇦🇺', aliases: ['australia'] },
    { code: 'nz', name: 'New Zealand', flag: '🇳🇿', aliases: ['new zealand', 'aotearoa'] },
    { code: 'in', name: 'India', flag: '🇮🇳', aliases: ['india', 'bhārat'] },
    { code: 'sg', name: 'Singapore', flag: '🇸🇬', aliases: ['singapore'] },
    { code: 'jp', name: 'Japan', flag: '🇯🇵', aliases: ['japan', '日本', 'nippon'] },
    { code: 'kr', name: 'South Korea', flag: '🇰🇷', aliases: ['south korea', 'korea', '대한민국', '한국'] },
    { code: 'cn', name: 'China', flag: '🇨🇳', aliases: ['china', '中国', '中國'] },
    { code: 'tw', name: 'Taiwan', flag: '🇹🇼', aliases: ['taiwan', '台灣', '臺灣'] },
    { code: 'hk', name: 'Hong Kong', flag: '🇭🇰', aliases: ['hong kong', '香港'] },
    { code: 'id', name: 'Indonesia', flag: '🇮🇩', aliases: ['indonesia'] },
    { code: 'my', name: 'Malaysia', flag: '🇲🇾', aliases: ['malaysia'] },
    { code: 'ph', name: 'Philippines', flag: '🇵🇭', aliases: ['philippines'] },
    { code: 'th', name: 'Thailand', flag: '🇹🇭', aliases: ['thailand'] },
    { code: 'vn', name: 'Vietnam', flag: '🇻🇳', aliases: ['vietnam', 'viet nam'] },
    { code: 'ae', name: 'United Arab Emirates', flag: '🇦🇪', aliases: ['united arab emirates', 'uae', 'u.a.e'] },
    { code: 'sa', name: 'Saudi Arabia', flag: '🇸🇦', aliases: ['saudi arabia', 'ksa'] },
    { code: 'il', name: 'Israel', flag: '🇮🇱', aliases: ['israel'] },
    { code: 'za', name: 'South Africa', flag: '🇿🇦', aliases: ['south africa'] },
    { code: 'eg', name: 'Egypt', flag: '🇪🇬', aliases: ['egypt'] },
    { code: 'ng', name: 'Nigeria', flag: '🇳🇬', aliases: ['nigeria'] },
    { code: 'ke', name: 'Kenya', flag: '🇰🇪', aliases: ['kenya'] },
  ];

  const BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

  // Major job-market cities → country code. Lowercased. Only well-known,
  // low-ambiguity cities (so "San Francisco" → us without a country token).
  const CITIES = {
    // US
    'san francisco': 'us', 'new york': 'us', 'nyc': 'us', 'los angeles': 'us', 'seattle': 'us',
    'austin': 'us', 'boston': 'us', 'chicago': 'us', 'denver': 'us', 'atlanta': 'us',
    'mountain view': 'us', 'palo alto': 'us', 'san jose': 'us', 'washington': 'us', 'miami': 'us',
    // UK
    london: 'gb', manchester: 'gb', edinburgh: 'gb', cambridge: 'gb', bristol: 'gb', glasgow: 'gb',
    // DE
    berlin: 'de', munich: 'de', münchen: 'de', hamburg: 'de', frankfurt: 'de', cologne: 'de', köln: 'de', stuttgart: 'de',
    // FR
    paris: 'fr', lyon: 'fr', toulouse: 'fr', nantes: 'fr',
    // ES
    madrid: 'es', barcelona: 'es', valencia: 'es',
    // NL/BE/CH/AT/IE
    amsterdam: 'nl', rotterdam: 'nl', utrecht: 'nl', brussels: 'be', bruxelles: 'be',
    zurich: 'ch', zürich: 'ch', geneva: 'ch', genève: 'ch', vienna: 'at', wien: 'at', dublin: 'ie',
    // Nordics
    copenhagen: 'dk', københavn: 'dk', stockholm: 'se', oslo: 'no', helsinki: 'fi',
    // CEE
    warsaw: 'pl', warszawa: 'pl', krakow: 'pl', kraków: 'pl', wrocław: 'pl', wroclaw: 'pl',
    prague: 'cz', praha: 'cz', bucharest: 'ro', budapest: 'hu',
    kyiv: 'ua', kiev: 'ua', lviv: 'ua', moscow: 'ru', москва: 'ru', 'saint petersburg': 'ru', 'st petersburg': 'ru',
    istanbul: 'tr', ankara: 'tr', athens: 'gr',
    // Americas
    toronto: 'ca', vancouver: 'ca', montreal: 'ca', montréal: 'ca',
    'mexico city': 'mx', 'são paulo': 'br', 'sao paulo': 'br', 'rio de janeiro': 'br',
    'buenos aires': 'ar', santiago: 'cl', bogotá: 'co', bogota: 'co',
    // APAC / MENA / Africa
    sydney: 'au', melbourne: 'au', auckland: 'nz', bangalore: 'in', bengaluru: 'in', mumbai: 'in',
    delhi: 'in', hyderabad: 'in', pune: 'in', tokyo: 'jp', osaka: 'jp', seoul: 'kr',
    beijing: 'cn', shanghai: 'cn', shenzhen: 'cn', taipei: 'tw', jakarta: 'id', 'kuala lumpur': 'my',
    manila: 'ph', bangkok: 'th', hanoi: 'vn', 'ho chi minh': 'vn', dubai: 'ae', 'abu dhabi': 'ae',
    riyadh: 'sa', 'tel aviv': 'il', cairo: 'eg', lagos: 'ng', nairobi: 'ke',
    'cape town': 'za', johannesburg: 'za',
  };

  // Match a lowercased alias as a whole word/phrase (so "us" won't match
  // "Austin" and "uk" won't match "Paducah").
  function aliasHit(haystack, alias) {
    if (!alias) return false;
    // Escape regex specials in the alias, then word-boundary it. For aliases
    // ending in a dot (e.g. "u.s.") fall back to substring.
    if (/[.]/.test(alias)) return haystack.includes(alias);
    const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}])${esc}([^\\p{L}]|$)`, 'u').test(haystack);
  }

  /**
   * Best-effort country for a free-text location. Returns {code,name,flag} or null.
   * @param {string} location
   */
  function detectCountry(location) {
    if (typeof location !== 'string') return null;
    const s = location.toLowerCase().trim();
    if (!s) return null;

    // 1) explicit country name/alias anywhere in the string
    for (const c of COUNTRIES) {
      for (const a of c.aliases) {
        if (aliasHit(s, a)) return { code: c.code, name: c.name, flag: c.flag };
      }
    }
    // 2) a known city token
    for (const city of Object.keys(CITIES)) {
      if (aliasHit(s, city)) {
        const c = BY_CODE[CITIES[city]];
        if (c) return { code: c.code, name: c.name, flag: c.flag };
      }
    }
    return null;
  }

  /**
   * Distinct countries present across a set of job rows, sorted by name.
   * Each entry: {code, name, flag, count}.
   * @param {Array<{location?: string}>} rows
   */
  function countriesIn(rows) {
    const acc = new Map();
    for (const r of (rows || [])) {
      const c = detectCountry(r && r.location);
      if (!c) continue;
      const prev = acc.get(c.code);
      if (prev) prev.count += 1;
      else acc.set(c.code, { ...c, count: 1 });
    }
    return [...acc.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** True if a row's location resolves to the given country code. */
  function rowInCountry(row, code) {
    if (!code) return true;
    const c = detectCountry(row && row.location);
    return !!c && c.code === code;
  }

  window.Countries = { COUNTRIES, detectCountry, countriesIn, rowInCountry, flagFor: (code) => (BY_CODE[code] || {}).flag || '' };
})();
