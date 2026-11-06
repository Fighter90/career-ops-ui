/* global window */
/**
 * role-stats.js — Target-Roles market statistics aggregator (v1.86.0).
 *
 * Pure, browser-classic helper (same layout as skills.js / countries.js):
 * exposes `window.RoleStats`. It turns the SPARSE data the system already
 * collects — the latest scan's job rows (`/api/scan-results`) — into
 * per-target-role vacancy counts, country breakdowns, and salary levels by
 * region, WITHOUT inventing any numbers. Anything it can't parse it simply
 * drops from the salary sample (and reports the sample size).
 *
 * Country detection is delegated to `window.Countries` (loaded first), so we
 * keep ONE country table for the whole app. Target roles come from the
 * profile (`/api/profile` → summary.target_roles) — never hard-coded.
 *
 * All money is normalized to USD via a small, explicitly-approximate FX
 * table so salaries in different currencies are comparable on one axis.
 */
(function () {
  // Approximate FX → USD. Documented as a rough comparison aid, not a live
  // rate. Keep conservative, round numbers; extend as new currencies appear.
  const FX_TO_USD = {
    USD: 1, EUR: 1.08, GBP: 1.27, CHF: 1.12, CAD: 0.73, AUD: 0.66, NZD: 0.61,
    RUB: 0.011, UAH: 0.025, PLN: 0.25, CZK: 0.043, SEK: 0.095, NOK: 0.093,
    DKK: 0.145, TRY: 0.031, JPY: 0.0064, CNY: 0.14, INR: 0.012, BRL: 0.185,
    SGD: 0.74, AED: 0.27, ILS: 0.27, ZAR: 0.054,
  };

  // Currency signals → ISO code. Symbol OR word/code, longest-first so
  // "US$" and "C$" resolve before a bare "$".
  // v1.243.0 — the non-ASCII words use Unicode letter/number lookarounds,
  // NOT \b: \b is ASCII-only, so "руб", "грн", "zł" and "Kč" could never
  // match — 'от 100 000 руб' fell through to the default-USD read (~90×
  // off), '50 000 Kč' had no currency and its K was read as a k-suffix
  // (×1000 → 50M USD), and zł/грн salaries were dropped from the sample.
  // Currency SYMBOLS stay bare on purpose: a trailing lookaround would
  // reject "€90,000" (symbol directly followed by a digit).
  const CURRENCY_SIGNALS = [
    [/\bkr\.?\b|\bnok\b/i, 'NOK'], [/\bsek\b/i, 'SEK'], [/\bdkk\b/i, 'DKK'],
    [/€|\beur\b|\beuros?\b/i, 'EUR'], [/£|\bgbp\b|\bquid\b/i, 'GBP'],
    [/₽|\brub\b|(?<![\p{L}\p{N}])руб(?![\p{L}\p{N}])/iu, 'RUB'],
    [/₴|\buah\b|(?<![\p{L}\p{N}])грн(?![\p{L}\p{N}])/iu, 'UAH'],
    [/\bpln\b|(?<![\p{L}\p{N}])zł(?![\p{L}\p{N}])|\bzl\b/iu, 'PLN'],
    [/\bczk\b|(?<![\p{L}\p{N}])kč(?![\p{L}\p{N}])/iu, 'CZK'],
    // ¥/￥ is shared by JPY and CNY (a ~20× FX gap), so a BARE yen sign is
    // deliberately NOT mapped — only explicit words/scripts resolve these two,
    // and an unresolvable ¥ salary is dropped from the sample rather than guessed.
    [/\btry\b|\btl\b|₺/i, 'TRY'],
    [/\bjpy\b|(?<![\p{L}\p{N}])円(?![\p{L}\p{N}])|\byen\b/iu, 'JPY'],
    [/\bcny\b|\brmb\b|\byuan\b|(?<![\p{L}\p{N}])元(?![\p{L}\p{N}])/iu, 'CNY'],
    [/₹|\binr\b/i, 'INR'], [/\bbrl\b|\br\$/i, 'BRL'], [/\bchf\b/i, 'CHF'],
    [/\bcad\b|\bc\$/i, 'CAD'], [/\baud\b|\ba\$/i, 'AUD'], [/\bnzd\b/i, 'NZD'],
    [/\bsgd\b|\bs\$/i, 'SGD'], [/\baed\b|\bdhs?\b/i, 'AED'], [/₪|\bils\b/i, 'ILS'],
    [/\bzar\b/i, 'ZAR'], [/\$|\busd\b|\bus\$/i, 'USD'],
  ];

  function detectCurrency(s) {
    for (const [re, code] of CURRENCY_SIGNALS) if (re.test(s)) return code;
    return null;
  }

  // Pull numeric amounts, honoring a trailing k/к/тыс (×1000) and grouping
  // separators. Returns an ascending array of plain numbers.
  // v1.243.0 — this is now the ONE shared tokenizer,
  // window.Skills.parseAmounts (skills.js loads first in index.html):
  // decimals ("$182.9K"), cents ("$85,000.00"), space/comma/dot thousands
  // and K/M suffixes parse identically for the #/scan salary filter and
  // these USD stats. The old local regex folded "85,000.00" into 8.5M and
  // let the "K" of "Kč"/"kr" read as a k-suffix ("50 000 Kč" → 50M).
  function extractAmounts(s) {
    return (window.Skills && window.Skills.parseAmounts) ? window.Skills.parseAmounts(s).slice() : [];
  }

  /**
   * Parse a free-text salary string into a USD range. Conservative: returns
   * null unless there's a currency signal OR a k-suffixed amount (so stray
   * numbers — years, counts — are not mistaken for pay). Amounts below a
   * plausible annual floor after k-expansion are dropped.
   * @returns {{minUsd:number,maxUsd:number,currency:string}|null}
   */
  function parseSalaryUSD(str) {
    if (typeof str !== 'string' || !str.trim()) return null;
    const s = str.trim();
    // v1.243.0 — the k-suffix probe carries the same letter/number
    // guard as the shared tokenizer, so the "K" of "Kč" (and the "k" of
    // "kr") no longer counts as a multiplier.
    const hasK = /\d\s*(?:тысяч|тыс|[kк])(?![\p{L}\p{N}])/iu.test(s);
    const currency = detectCurrency(s);
    if (!currency && !hasK) return null;
    const cur = currency || 'USD';
    const fx = FX_TO_USD[cur] || 1;
    let amounts = extractAmounts(s);
    // If any amount is k-suffixed the extractor already ×1000'd it, but bare
    // companions in the same range (e.g. "120k-150") should scale too when
    // clearly a range shorthand; keep it simple and drop implausibly small
    // annual figures (< 1000 in local currency) as noise.
    amounts = amounts.filter((n) => n >= 1000);
    if (!amounts.length) return null;
    const min = amounts[0];
    const max = amounts[amounts.length - 1];
    const round = (n) => Math.round(n * fx);
    return { minUsd: round(min), maxUsd: round(max), currency: cur };
  }

  // Lowercased token set of a role/title, minus trivial noise.
  function tokens(str) {
    return new Set(
      String(str || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 1),
    );
  }

  /**
   * Best target-role match for a job title. A title matches a role when the
   * role's significant tokens are (mostly) present in the title — e.g. role
   * "Backend Engineer" matches title "Senior Backend Engineer (Go)". Returns
   * the matched role string or null.
   */
  function matchRole(title, roles) {
    const t = tokens(title);
    if (!t.size) return null;
    let best = null;
    let bestScore = 0;
    for (const role of (roles || [])) {
      const r = [...tokens(role)];
      if (!r.length) continue;
      const hit = r.filter((tok) => t.has(tok)).length;
      const score = hit / r.length;
      // Require the majority of the role's tokens to appear in the title.
      if (score >= 0.6 && score > bestScore) { bestScore = score; best = role; }
    }
    return best;
  }

  function median(sortedNums) {
    const n = sortedNums.length;
    if (!n) return null;
    const mid = Math.floor(n / 2);
    return n % 2 ? sortedNums[mid] : Math.round((sortedNums[mid - 1] + sortedNums[mid]) / 2);
  }

  function salaryStats(usdMidpoints) {
    const arr = usdMidpoints.slice().sort((a, b) => a - b);
    if (!arr.length) return { count: 0, minUsd: null, avgUsd: null, medianUsd: null, maxUsd: null };
    // v1.140.0 — mean alongside the median. Median resists outliers; the average
    // exposes skew (a few very-high postings pull it above the median), so the
    // two together read as a distribution, not a single point.
    const avg = Math.round(arr.reduce((s, n) => s + n, 0) / arr.length);
    return { count: arr.length, minUsd: arr[0], avgUsd: avg, medianUsd: median(arr), maxUsd: arr[arr.length - 1] };
  }

  /**
   * Aggregate scan job rows against the user's target roles.
   * @param {Array<{title?:string,location?:string,salary?:string}>} jobs
   * @param {string[]} roles
   * @param {object} [countries] window.Countries (injectable for tests)
   * @returns {{totalJobs:number, matchedJobs:number, roles:string[], perRole:Array, byCountry:Array, salaryByCountry:Array}}
   */
  function aggregate(jobs, roles, countries) {
    const C = countries || (typeof window !== 'undefined' && window.Countries) || null;
    const rows = Array.isArray(jobs) ? jobs : [];
    const targetRoles = Array.isArray(roles) ? roles.filter((r) => r && r.trim()) : [];

    const perRoleMap = new Map();
    for (const role of targetRoles) {
      perRoleMap.set(role, { role, total: 0, byCountry: {}, _sal: [] });
    }
    const countryCount = new Map();  // code → {code,name,flag,count}
    const countrySalary = new Map(); // code → number[] (usd midpoints)

    let matched = 0;
    for (const j of rows) {
      const country = C && C.detectCountry ? C.detectCountry(j.location) : null;
      const cc = country ? country.code : (/(remote|anywhere|worldwide)/i.test(j.location || '') ? 'remote' : 'other');
      const cName = country ? country.name : (cc === 'remote' ? 'Remote' : 'Other');
      const cFlag = country ? country.flag : (cc === 'remote' ? '🌐' : '🏳️');

      const sal = parseSalaryUSD(j.salary);
      const mid = sal ? Math.round((sal.minUsd + sal.maxUsd) / 2) : null;

      const role = targetRoles.length ? matchRole(j.title, targetRoles) : null;
      if (role) {
        matched += 1;
        const bucket = perRoleMap.get(role);
        bucket.total += 1;
        bucket.byCountry[cc] = (bucket.byCountry[cc] || 0) + 1;
        if (mid) bucket._sal.push(mid);
      }

      // Overall country tallies span ALL jobs (context), not just matched.
      const prev = countryCount.get(cc);
      if (prev) prev.count += 1;
      else countryCount.set(cc, { code: cc, name: cName, flag: cFlag, count: 1 });
      if (mid) {
        if (!countrySalary.has(cc)) countrySalary.set(cc, []);
        countrySalary.get(cc).push(mid);
      }
    }

    const perRole = targetRoles.map((role) => {
      const b = perRoleMap.get(role);
      return { role, total: b.total, byCountry: b.byCountry, salary: salaryStats(b._sal) };
    }).sort((a, b) => b.total - a.total);

    const byCountry = [...countryCount.values()].sort((a, b) => b.count - a.count);
    const salaryByCountry = byCountry.map((c) => ({
      code: c.code, name: c.name, flag: c.flag, count: c.count,
      salary: salaryStats(countrySalary.get(c.code) || []),
    })).filter((c) => c.salary.count > 0).sort((a, b) => (b.salary.medianUsd || 0) - (a.salary.medianUsd || 0));

    return {
      totalJobs: rows.length,
      matchedJobs: matched,
      roles: targetRoles,
      perRole,
      byCountry,
      salaryByCountry,
    };
  }

  // ── CAR-247 — the #/stats «Детали» (Details) dataset layer ─────────────────
  // Pure, window-free helpers: the view builds ONE filterable dataset from the
  // tracker (/api/tracker) + the latest scan snapshot (/api/scan-results) and
  // runs currency conversion, period windows, search, facets and chart
  // aggregation through these. All rates/thresholds are static and documented.

  // USD → display-currency rates for the Details tab selector. STATIC and
  // explicitly approximate (the salary caveat already says "approximate FX" —
  // never presented as a live quote), same round numbers the stats view's
  // market-report selector has used since v1.94.0. A currency missing here
  // degrades to USD passthrough in convertFromUsd — never a guessed rate.
  const USD_TO_DISPLAY = { USD: 1, EUR: 0.92, RUB: 90, GBP: 0.79, CNY: 7.2 };
  const DISPLAY_CURRENCIES = Object.keys(USD_TO_DISPLAY);

  /**
   * Convert a USD amount into the selected display currency. An unknown or
   * missing currency passes the USD amount through unchanged (rate 1) —
   * an unknown currency must never silently use a wrong rate.
   * @param {number|null} v USD amount
   * @param {string} cur ISO code from DISPLAY_CURRENCIES (or anything)
   * @returns {number|null} rounded display-currency amount, or null for non-finite input
   */
  function convertFromUsd(v, cur) {
    if (v == null) return null; // null/undefined → null (Number(null) would be 0)
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const rate = USD_TO_DISPLAY[cur];
    return Math.round(n * (typeof rate === 'number' && rate > 0 ? rate : 1));
  }

  // One normalized posting-URL key for the tracker↔scan join: lowercase host
  // (www. stripped) + path, query/fragment dropped on purpose — tracking
  // params (`?gh_src=…`) and SPA hops must not split one posting in two.
  function urlKey(u) {
    const s = String(u == null ? '' : u).trim();
    if (!/^https?:\/\//i.test(s)) return '';
    try {
      const url = new URL(s);
      return url.host.toLowerCase().replace(/^www\./, '') + url.pathname.replace(/\/+$/, '');
    } catch { return ''; }
  }

  // `[\d+](reports/042-acme-….md)` → the report path; a sentinel / bare cell
  // → null. (Extracts the FIRST parenthesised target, matching how the
  // tracker renders the Report cell's markdown link.)
  function reportPathOf(rawReport) {
    const m = String(rawReport == null ? '' : rawReport).match(/\(([^()\s][^()]*)\)/);
    return (m && m[1]) ? m[1] : null;
  }

  // Tracker/scores "4.2/5" → 4.2; null when no finite number is present.
  function scoreNum(raw) {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const m = String(raw == null ? '' : raw).match(/(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? n : null;
  }

  // Free-text location → { code, name, flag } via the shared Countries table
  // (ONE country table for the whole app). Remote-ish text folds to 'remote',
  // anything unparseable to 'other'; an EMPTY location → null so the entry
  // honestly carries no country (it can never match a country chip).
  function countryOf(location, C) {
    const loc = String(location == null ? '' : location).trim();
    if (!loc) return null;
    const c = C && C.detectCountry ? C.detectCountry(loc) : null;
    if (c) return { code: c.code, name: c.name, flag: c.flag };
    if (/(remote|anywhere|worldwide)/i.test(loc)) return { code: 'remote', name: 'Remote', flag: '🌐' };
    return { code: 'other', name: 'Other', flag: '🏳️' };
  }

  /**
   * Build the Details dataset: tracked applications (+ any scanned postings
   * that ARE tracked rows, folded in as enrichment — never duplicated) and
   * the remaining scan postings as their own entries.
   * @param {Array} trackerRows /api/tracker rows
   * @param {Array} jobs /api/scan-results rows (en + ru merged by the caller)
   * @param {{fold?:Function, countries?:object, parseSalaryUsd?:Function}} [deps]
   *   fold folds a raw tracker status to its canonical stage (server alias map);
   *   countries/parseSalaryUsd are injectable for tests (defaults: window.Countries / parseSalaryUSD)
   * @returns {Array<{kind:'tracked'|'posting', num, company, role, score, status,
   *   date, salaryUsd, country, source, location, url, reportPath}>}
   */
  function buildEntries(trackerRows, jobs, deps) {
    const d = deps || {};
    const C = d.countries || (typeof window !== 'undefined' && window.Countries) || null;
    const parseSal = d.parseSalaryUsd || parseSalaryUSD;
    const fold = typeof d.fold === 'function' ? d.fold : (s) => String(s == null ? '' : s).trim();
    const entries = [];
    const byUrl = new Map();

    for (const r of (Array.isArray(trackerRows) ? trackerRows : [])) {
      if (!r) continue;
      const e = {
        kind: 'tracked',
        num: (r.num ?? null),
        company: String(r.company || '').trim(),
        role: String(r.role || '').trim(),
        score: scoreNum(r.score),
        status: fold(r.status),
        date: String(r.date || '').trim(),
        salaryUsd: null,
        country: countryOf(r.location, C),
        source: null,
        location: String(r.location || '').trim(),
        url: String(r.url || '').trim(),
        reportPath: reportPathOf(r.report),
      };
      entries.push(e);
      const k = urlKey(e.url);
      if (k && !byUrl.has(k)) byUrl.set(k, e);
    }

    const rows = Array.isArray(jobs) ? jobs : [];
    for (const j of rows) {
      if (!j) continue;
      const sal = parseSal(j.salary);
      const salaryUsd = sal ? { minUsd: sal.minUsd, maxUsd: sal.maxUsd, currency: sal.currency } : null;
      const k = urlKey(j.url);
      const hit = k ? byUrl.get(k) : null;
      if (hit) {
        // One posting seen twice (tracked + scanned) = ONE fuller entry.
        if (!hit.salaryUsd && salaryUsd) hit.salaryUsd = salaryUsd;
        if (!hit.country && j.location) hit.country = countryOf(j.location, C);
        if (!hit.location && j.location) hit.location = String(j.location).trim();
        if (!hit.source && j.source) hit.source = String(j.source);
        continue;
      }
      entries.push({
        kind: 'posting',
        num: null,
        company: String(j.company || '').trim(),
        role: String(j.title || '').trim(),
        score: null,
        status: null,
        date: String(j.date || '').trim(),
        salaryUsd,
        country: countryOf(j.location, C),
        source: j.source ? String(j.source) : null,
        location: String(j.location || '').trim(),
        url: String(j.url || '').trim(),
        reportPath: null,
      });
    }
    return entries;
  }

  // Rolling period windows in CALENDAR DAYS (day-granular data → day-granular
  // math): month = last 30 days including today, quarter = 91, year = 365.
  // An entry with an unparseable/absent date is EXCLUDED from a bounded window
  // (guessing "recent" would fabricate data) and included under 'all'.
  const DAY_MS = 86400000;
  const PERIOD_DAYS = { month: 30, quarter: 91, year: 365 };

  function withinPeriod(dateStr, period, nowMs) {
    const p = period || 'all';
    if (p === 'all') return true;
    const days = PERIOD_DAYS[p];
    if (!days) return true; // unknown period behaves as 'all' (defensive)
    const m = String(dateStr == null ? '' : dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return false;
    const ms = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    if (!Number.isFinite(ms)) return false;
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const nowDay = Math.floor(now / DAY_MS) * DAY_MS;
    return ms >= nowDay - (days - 1) * DAY_MS;
  }

  function filterPeriod(entries, period, nowMs) {
    return (Array.isArray(entries) ? entries : []).filter((e) => withinPeriod(e && e.date, period, nowMs));
  }

  // Case-insensitive substring over company + role. An empty/blank query is a
  // no-op (a copy, so callers can treat the result as theirs).
  function searchEntries(entries, q) {
    const needle = String(q == null ? '' : q).trim().toLowerCase();
    const list = Array.isArray(entries) ? entries : [];
    if (!needle) return list.slice();
    return list.filter((e) => (`${(e && e.company) || ''}\n${(e && e.role) || ''}`)
      .toLowerCase()
      .includes(needle));
  }

  // The three facet dimensions the tab builds chips from.
  const FACET_KEYS = ['country', 'status', 'source'];

  function facetValue(e, key) {
    if (!e) return null;
    if (key === 'country') return (e.country && e.country.name) || null;
    if (key === 'status') return e.status || null;
    if (key === 'source') return e.source || null;
    return null;
  }

  /**
   * Distinct values of one facet with counts, descending by count then value.
   * @returns {Array<{value:string,count:number}>}
   */
  function facetCounts(entries, key) {
    const counts = new Map();
    for (const e of (Array.isArray(entries) ? entries : [])) {
      const v = facetValue(e, key);
      if (!v) continue;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => (b.count - a.count) || a.value.localeCompare(b.value));
  }

  /**
   * Faceted filter: chips within ONE group are OR (an entry has exactly one
   * country — ANDing within the group would always be empty), across groups
   * they AND. `active` is { country:[…], status:[…], source:[…] } (arrays or
   * single values; absent/empty groups are inert).
   */
  function facetFilter(entries, active) {
    const list = Array.isArray(entries) ? entries : [];
    const a = active || {};
    const groups = FACET_KEYS
      .map((key) => ({ key, set: new Set(Array.isArray(a[key]) ? a[key] : (a[key] ? [a[key]] : [])) }))
      .filter((g) => g.set.size > 0);
    if (!groups.length) return list.slice();
    return list.filter((e) => groups.every((g) => g.set.has(facetValue(e, g.key))));
  }

  /**
   * Salary min/median/max (USD) per country from entries that carry BOTH a
   * parsed salary and a country — sorted by count desc (ties by median desc),
   * capped at `topN` (default 8, the chart's bar budget).
   * @returns {Array<{code,name,flag,count,minUsd,medianUsd,maxUsd}>}
   */
  function salaryRangeByCountry(entries, topN) {
    const by = new Map(); // name → { code, name, flag, mids[], mins[], maxs[] }
    for (const e of (Array.isArray(entries) ? entries : [])) {
      if (!e || !e.salaryUsd || !e.country) continue;
      const { minUsd, maxUsd } = e.salaryUsd;
      if (!Number.isFinite(minUsd) && !Number.isFinite(maxUsd)) continue;
      let b = by.get(e.country.name);
      if (!b) { b = { code: e.country.code, name: e.country.name, flag: e.country.flag || '', mids: [], mins: [], maxs: [] }; by.set(e.country.name, b); }
      const lo = Number.isFinite(minUsd) ? minUsd : maxUsd;
      const hi = Number.isFinite(maxUsd) ? maxUsd : minUsd;
      b.mins.push(lo); b.maxs.push(hi);
      // Same one-end rule as the grade medians: a midpoint only when BOTH
      // ends exist, otherwise the one end we have.
      b.mids.push((minUsd && maxUsd) ? Math.round((minUsd + maxUsd) / 2) : Math.round(lo || hi));
    }
    const cap = Number.isInteger(topN) && topN > 0 ? topN : 8;
    return [...by.values()].map((b) => {
      const mids = b.mids.slice().sort((x, y) => x - y);
      const n = mids.length;
      const med = n % 2 ? mids[(n - 1) / 2] : Math.round((mids[n / 2 - 1] + mids[n / 2]) / 2);
      return { code: b.code, name: b.name, flag: b.flag, count: n, minUsd: Math.min(...b.mins), medianUsd: med, maxUsd: Math.max(...b.maxs) };
    }).sort((a, b2) => (b2.count - a.count) || ((b2.medianUsd || 0) - (a.medianUsd || 0))).slice(0, cap);
  }

  /** Entries with a parseable date → [{label:'YYYY-MM', value}] ascending. */
  function monthlyCounts(entries) {
    const byMonth = {};
    for (const e of (Array.isArray(entries) ? entries : [])) {
      const m = String((e && e.date) || '').match(/^(\d{4}-\d{2})/);
      if (m) byMonth[m[1]] = (byMonth[m[1]] || 0) + 1;
    }
    return Object.keys(byMonth).sort().map((m) => ({ label: m, value: byMonth[m] }));
  }

  /** Entries → top-n companies by count (case-folded merge; first spelling wins). */
  function topCompanies(entries, n) {
    const counts = new Map();
    for (const e of (Array.isArray(entries) ? entries : [])) {
      const k = String((e && e.company) || '').trim();
      if (!k) continue;
      const lk = k.toLowerCase();
      const prev = counts.get(lk);
      counts.set(lk, { label: prev ? prev.label : k, value: (prev ? prev.value : 0) + 1 });
    }
    return [...counts.values()].sort((a, b) => b.value - a.value).slice(0, Number.isInteger(n) && n > 0 ? n : 10);
  }

  window.RoleStats = {
    parseSalaryUSD, matchRole, aggregate, FX_TO_USD,
    // CAR-247 Details dataset
    DISPLAY_CURRENCIES, USD_TO_DISPLAY, convertFromUsd,
    buildEntries, filterPeriod, searchEntries, facetCounts, facetFilter,
    salaryRangeByCountry, monthlyCounts, topCompanies,
  };
})();
