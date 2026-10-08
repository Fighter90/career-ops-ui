/* global window */
/**
 * Skill / level detection from job titles + snippets.
 * Pure functions exposed on window.Skills for the scan view.
 */
window.Skills = (function () {
  // Order matters slightly — longer/more-specific terms first to avoid bad matches
  // ("Tech Lead" must beat "Lead", "Golang" must beat "Go").
  const TECH_GROUPS = [
    {
      label: 'PHP',
      patterns: [/\bphp\b/i, /symfony/i, /laravel/i, /phalcon/i, /wordpress/i, /drupal/i, /yii\b/i],
    },
    { label: 'Symfony',  patterns: [/symfony/i] },
    { label: 'Laravel',  patterns: [/laravel/i] },
    { label: 'Go',       patterns: [/\bgo(?:lang)?\b/i, /\bgo backend\b/i, /go developer/i, /go engineer/i] },
    { label: 'Rust',     patterns: [/\brust\b/i] },
    { label: 'Node.js',  patterns: [/node\.js/i, /\bnode\b(?!.*ssh)/i, /nest\.?js/i] },
    { label: 'TypeScript', patterns: [/typescript/i, /\bts\b(?!.*ssh)/i] },
    { label: 'Python',   patterns: [/python/i, /django/i, /fastapi/i, /flask/i] },
    { label: 'Ruby',     patterns: [/\bruby\b/i, /rails/i] },
    { label: 'Java',     patterns: [/\bjava\b(?!script)/i, /\bspring\b/i, /kotlin/i] },
    { label: 'C#/.NET',  patterns: [/\bc#/i, /\.net/i, /dotnet/i] },
    { label: 'C++',      patterns: [/\bc\+\+/i] },

    // Domain
    { label: 'Backend',         patterns: [/backend/i, /back-?end/i, /server-side/i, /бэкенд/i, /бэк-энд/i] },
    { label: 'Frontend',        patterns: [/frontend/i, /front-?end/i, /\bui\b/i, /\bux\b/i] },
    { label: 'Fullstack',       patterns: [/full-?stack/i] },
    { label: 'Microservices',   patterns: [/microservic/i, /микросервис/i] },
    { label: 'High-load',       patterns: [/high[-\s]?load/i, /highload/i, /высоконагруж/i] },
    { label: 'Distributed',     patterns: [/distributed/i, /распределённ/i] },
    { label: 'DevOps / SRE',    patterns: [/devops/i, /\bsre\b/i, /reliability/i, /platform engineer/i, /infrastructure/i] },
    { label: 'Data',            patterns: [/\bdata\b/i, /\betl\b/i, /pipeline/i, /streaming/i, /kafka/i, /spark/i, /dbt\b/i] },
    { label: 'ML / AI',         patterns: [/\bml\b/i, /\bai\b/i, /machine learning/i, /llm/i, /deep learning/i, /gen[-\s]?ai/i] },
    { label: 'Mobile',          patterns: [/mobile/i, /\bios\b/i, /android/i] },
    { label: 'Security',        patterns: [/security/i, /\bsecops\b/i, /безопасность/i] },
    { label: 'Database',        patterns: [/postgres/i, /mysql/i, /clickhouse/i, /mongo/i, /redis/i, /database/i, /бд/i] },
    { label: 'Cloud',           patterns: [/\baws\b/i, /\bgcp\b/i, /azure/i, /kubernetes/i, /\bk8s\b/i, /docker/i] },
    { label: 'API',             patterns: [/\bapi\b/i, /rest\b/i, /graphql/i, /grpc/i] },
  ];

  const LEVEL_GROUPS = [
    { label: 'Lead / Tech Lead',
      patterns: [/tech\s*lead/i, /team\s*lead/i, /\blead\b/i, /техлид/i, /тимлид/i, /тим[-\s]?лид/i] },
    { label: 'Architect',
      patterns: [/architect/i, /архитектор/i] },
    { label: 'Manager',
      patterns: [/\bmanager\b/i, /head of/i, /director/i, /vp\s/i, /менеджер/i] },
    { label: 'Principal / Staff',
      patterns: [/principal/i, /\bstaff\b/i, /distinguished/i] },
    { label: 'Senior',
      patterns: [/\bsenior\b/i, /\bsr\.?\b/i, /старший/i, /\bsenior\+/i, /sr\s/i] },
    { label: 'Middle',
      patterns: [/\bmiddle\b/i, /\bmid\b/i] },
    { label: 'Junior',
      patterns: [/\bjunior\b/i, /\bjr\.?\b/i, /младший/i, /\bintern/i, /стажёр/i, /стажер/i] },
  ];

  function matchGroups(text, groups) {
    if (!text) return [];
    const out = new Set();
    for (const g of groups) {
      for (const re of g.patterns) {
        if (re.test(text)) {
          out.add(g.label);
          break;
        }
      }
    }
    return [...out];
  }

  function detectTech(row) {
    const haystack = `${row.title || ''} ${row.snippet || ''}`;
    return matchGroups(haystack, TECH_GROUPS);
  }
  function detectLevel(row) {
    const haystack = `${row.title || ''}`;
    return matchGroups(haystack, LEVEL_GROUPS);
  }

  /**
   * Dynamic keyword extraction — pull the N most-frequent capitalised tokens
   * from titles, excluding noise. This makes chips ADAPT to whatever roles
   * the user actually scans (marketing, design, finance, etc.) instead of
   * being locked to the backend-engineer vocabulary above.
   *
   * Returns ordered list of [keyword, count] pairs.
   */
  const STOPWORDS = new Set([
    'and', 'or', 'the', 'a', 'an', 'of', 'to', 'in', 'at', 'for', 'with',
    'by', 'on', 'as', 'from', 'us', 'eu', 'uk', 'usa', 'india', 'remote',
    'hybrid', 'engineer', 'developer', 'software', 'job', 'role',
  ]);
  function extractDynamicKeywords(rows, opts = {}) {
    const { limit = 25, minLength = 3, minCount = 2, script } = opts;
    const counts = {};
    for (const r of rows) {
      const title = (r.title || '').replace(/[(){}\[\],/—–•·|]/g, ' ');
      // tokens: words 3+ chars, must contain a letter
      const tokens = title.split(/\s+/).filter((w) =>
        w.length >= minLength && /[a-zа-я]/i.test(w)
      );
      for (const raw of tokens) {
        // strip punctuation, normalise case
        const w = raw.replace(/^[^\p{L}+#.]+|[^\p{L}+#.]+$/gu, '');
        if (!w || STOPWORDS.has(w.toLowerCase())) continue;
        // Optional: filter by script — when script='latin', drop Cyrillic-only
        // tokens (e.g. "разработчик" leaking from Habr data into an EN UI).
        // 'cyrillic' keeps Cyrillic-only tokens, 'all' (default) keeps both.
        if (script === 'latin' && /[А-Яа-яЁё]/.test(w) && !/[A-Za-z]/.test(w)) continue;
        if (script === 'cyrillic' && !/[А-Яа-яЁё]/.test(w)) continue;
        // canonical form: lowercase except for known acronyms (PHP, Go, AI)
        const key = (/^[A-Z]{2,5}$/.test(w) || /^[A-Z][a-z]/.test(w))
          ? w
          : w.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .filter(([_, n]) => n >= minCount)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit);
  }

  /**
   * Whether row's title contains the dynamic keyword (case-insensitive
   * whole-token match). The guards are Unicode letter/number lookarounds,
   * NOT \b: \b is ASCII-only, so a Cyrillic chip ("разработчик") or a
   * punctuation-led tech ("c++", ".net") had no boundary to align and
   * filtered every row to zero (v1.243.0).
   */
  function rowHasKeyword(row, keyword) {
    if (!keyword) return true;
    const esc = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?<![\\p{L}\\p{N}])' + esc + '(?![\\p{L}\\p{N}])', 'iu');
    return re.test(row.title || '');
  }

  /**
   * Compute facet counts for a list of rows: { tech: {label: count}, level: {…} }.
   * Used to render only the chips that actually have results.
   */
  function computeFacets(rows) {
    const tech = {};
    const level = {};
    for (const r of rows) {
      for (const t of detectTech(r)) tech[t] = (tech[t] || 0) + 1;
      for (const l of detectLevel(r)) level[l] = (level[l] || 0) + 1;
    }
    return { tech, level };
  }

  /**
   * Apply tech & level filters to a row.
   * Returns true if row matches ALL active filters (intersection).
   */
  function rowMatches(row, activeTech, activeLevel) {
    if (activeTech.size) {
      const t = detectTech(row);
      let any = false;
      for (const sel of activeTech) if (t.includes(sel)) { any = true; break; }
      if (!any) return false;
    }
    if (activeLevel.size) {
      const l = detectLevel(row);
      let any = false;
      for (const sel of activeLevel) if (l.includes(sel)) { any = true; break; }
      if (!any) return false;
    }
    return true;
  }

  // ───────────────────────── salary range ─────────────────────────
  // Salary arrives as a free-text string that differs per source
  // (trudvsem "от N до M RUB", hh/habr "100 000 – 200 000 ₽", lever
  // "120000-150000 USD", ashby "$120K – $150K", most ATS ""). Extract the
  // numeric bound(s) so #/scan can filter by a от/до range.
  //
  // NB: the comparison is currency-agnostic — a number is a number, so a
  // ₽ salary and a $ salary with the same digits compare equal. There is no
  // FX conversion (no rates available offline). In practice the user scans
  // RU sources in ₽ and most ATS rows carry no salary at all, so the raw
  // numeric compare is useful despite the caveat.

  // ───────────── shared salary-amount parser (v1.243.0) ─────────────
  // ONE tokenizer shared with role-stats.js (window.Skills.parseAmounts;
  // index.html loads skills.js first). Both sides used to run their own
  // regex and disagreed: "$182.9K" folded the decimal into the digits
  // (1829000), "$85,000.00" read the cents as ×100, and the currency
  // words "kr"/"Kč" read as a K-suffix (×1000).
  //
  // Number-token grammar: digit groups joined by single space/comma/dot
  // separators, an optional multiplier (тысяч/тыс/k/к → ×1000, млн/m →
  // ×1e6), and a trailing letter/number lookaround so "kr"/"Kč"/"km" can
  // never be read as multipliers.
  const AMOUNT_RE = /(\d+(?:[.,\s]\d+)*)(?:\s*(тысяч\.?|тыс\.?|млн\.?|[kmк]))?(?![\p{L}\p{N}])/giu;

  // "85,000.00" → 85000; "182.9" → 182.9; "1.234.567,89" → 1234567.89;
  // "100 000" → 100000; "1.234.567" → 1234567. Heuristic: a trailing group
  // that is NOT exactly three digits makes the last separator the decimal
  // point (a space never is — "100 000" always groups); otherwise every
  // separator is a thousands grouping.
  function parseNumberToken(raw) {
    const parts = raw.split(/([.,\s])/);
    if (parts.length === 1) return Number(raw);
    const seps = parts.filter((_, i) => i % 2 === 1);
    const lastSep = seps[seps.length - 1];
    const lastGroup = parts[parts.length - 1];
    const decimalSep = (lastGroup.length !== 3 && lastSep !== ' ') ? lastSep : null;
    let n = '';
    for (let i = 0; i < parts.length; i += 2) {
      n += parts[i];
      if (i + 1 < parts.length && parts[i + 1] === decimalSep) n += '.';
    }
    return Number(n);
  }

  function applyAmountMultiplier(n, suffix) {
    if (!suffix) return n;
    const s = suffix.toLowerCase().replace(/\.$/, '');
    if (s === 'k' || s === 'к' || s === 'тыс' || s === 'тысяч') return n * 1e3;
    if (s === 'm' || s === 'млн') return n * 1e6;
    return n;
  }

  /**
   * All monetary amounts in a free-text salary string, ascending.
   * @returns {number[]}
   */
  function parseAmounts(str) {
    if (typeof str !== 'string') return [];
    // Normalise the space zoo (NBSP, narrow NBSP, thin space) to ASCII space.
    const s = str.replace(/[\u00A0\u202F\u2009\u2007]/g, ' ');
    const out = [];
    let m;
    AMOUNT_RE.lastIndex = 0;
    while ((m = AMOUNT_RE.exec(s))) {
      const n = applyAmountMultiplier(parseNumberToken(m[1]), m[2]);
      if (Number.isFinite(n) && n > 0) out.push(n);
    }
    return out.sort((a, b) => a - b);
  }

  function parseSalaryRange(str) {
    const nums = parseAmounts(str);
    if (!nums.length) return null;
    return { min: nums[0], max: nums[nums.length - 1] };
  }

  // Does a row's salary overlap the [min, max] filter window? Unset bounds
  // (both NaN/null) open the filter — every row passes. Once EITHER bound is
  // set, a row with NO parseable salary is HIDDEN (v1.68.0): the user
  // explicitly asked that setting "salary from" drop jobs that don't list a
  // salary, so the filter actually narrows the list. Overlapping-range
  // semantics for rows that DO list pay: keep if salaryMax ≥ min AND
  // salaryMin ≤ max.
  function salaryInRange(row, min, max) {
    const lo = Number.isFinite(min) ? min : null;
    const hi = Number.isFinite(max) ? max : null;
    if (lo === null && hi === null) return true;
    const r = parseSalaryRange(row && row.salary);
    if (!r) return false;
    if (lo !== null && r.max < lo) return false;
    if (hi !== null && r.min > hi) return false;
    return true;
  }

  return {
    detectTech, detectLevel, computeFacets, rowMatches,
    extractDynamicKeywords, rowHasKeyword,
    parseAmounts, parseSalaryRange, salaryInRange,
    TECH_GROUPS, LEVEL_GROUPS,
  };
})();
