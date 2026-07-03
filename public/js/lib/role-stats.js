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
  const CURRENCY_SIGNALS = [
    [/\bkr\.?\b|\bnok\b/i, 'NOK'], [/\bsek\b/i, 'SEK'], [/\bdkk\b/i, 'DKK'],
    [/€|\beur\b|\beuros?\b/i, 'EUR'], [/£|\bgbp\b|\bquid\b/i, 'GBP'],
    [/₽|\brub\b|\bруб/i, 'RUB'], [/₴|\buah\b|\bгрн/i, 'UAH'],
    [/\bpln\b|\bzł\b|\bzl\b/i, 'PLN'], [/\bczk\b|\bkč\b/i, 'CZK'],
    [/\btry\b|\btl\b|₺/i, 'TRY'], [/¥|\bjpy\b/i, 'JPY'], [/\bcny\b|\brmb\b|\byuan\b/i, 'CNY'],
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
  function extractAmounts(s) {
    const out = [];
    const re = /(\d[\d.,\s]*\d|\d)\s*(k|к|тыс)?/gi;
    let m;
    while ((m = re.exec(s)) !== null) {
      let raw = m[1].replace(/\s/g, '');
      // Treat commas/dots as thousands separators when they group 3 digits;
      // otherwise a lone dot is a decimal point.
      if (/[.,]\d{3}(\D|$)/.test(raw + ' ') || /\d[.,]\d{3}$/.test(raw)) {
        raw = raw.replace(/[.,]/g, '');
      } else {
        raw = raw.replace(/,/g, '.');
      }
      let n = parseFloat(raw);
      if (!isFinite(n)) continue;
      if (m[2]) n *= 1000;
      if (n > 0) out.push(n);
    }
    return out.sort((a, b) => a - b);
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
    const hasK = /\d\s*(k|к|тыс)/i.test(s);
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
    if (!arr.length) return { count: 0, minUsd: null, medianUsd: null, maxUsd: null };
    return { count: arr.length, minUsd: arr[0], medianUsd: median(arr), maxUsd: arr[arr.length - 1] };
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

  window.RoleStats = { parseSalaryUSD, matchRole, aggregate, FX_TO_USD };
})();
