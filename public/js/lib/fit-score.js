/* global window */
/**
 * fit-score.js — "fit-to-what-you-want" heuristic (v1.89.0, roadmap Epic 14).
 *
 * Scores a scan job row against the candidate's TWO-PAGER (loves / must-haves /
 * hates / deal-breakers / non-negotiables), on the dimensions a scan row
 * actually exposes: work-type (remote/hybrid/onsite), country (via
 * window.Countries), a salary floor, and relocation/visa. Free-text semantic
 * preferences that a scan row can't confirm are NOT guessed here — they
 * influence the full LLM evaluation instead (the two-pager is inlined into the
 * eval prompt). So this is an honest, conservative sub-score: if nothing
 * matchable fires, it returns score:null and the card shows no badge.
 *
 * Pure browser-classic helper (same layout as role-stats.js) → window.FitScore.
 */
(function () {
  const norm = (s) => String(s || '').toLowerCase();
  const list = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()) : []);
  const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Whole-word containment — "Georgia" must not match inside "Georgian",
  // nor "Nigeria" inside "Nigerian" (country names are matched against
  // free-text two-pager prefs, so a bare substring is unsafe).
  const hasWord = (hay, needle) => !!needle && new RegExp('\\b' + reEsc(needle) + '\\b').test(hay);

  // Which work-type does a phrase express? null if none.
  function workTypeOf(text) {
    const s = norm(text);
    if (/\bremote\b|\bwfh\b|work from home|fully.?remote/.test(s)) return 'remote';
    if (/\bhybrid\b/.test(s)) return 'hybrid';
    if (/\bon-?site\b|\bonsite\b|\bin.?office\b|\boffice\b|\bin person\b/.test(s)) return 'onsite';
    return null;
  }

  function jobWorkType(job) {
    if (!job) return null;
    const wt = workTypeOf(job.workplaceType || job.location);
    if (wt) return wt;
    return job.isRemote === true ? 'remote' : null;
  }

  // ── salary parsing (shared by salaryFloor + jobSalaryNum, v1.243.0) ──
  // One number token: digits with '.', ',' or space-grouped thousands
  // ("150 000", "100,000", "5.000", "12.5") and an optional k/к suffix.
  const SAL_NUM_SRC = '(\\d[\\d.,\\s]*\\d|\\d)';
  const SAL_TOKEN_RE = new RegExp(SAL_NUM_SRC + '\\s*(k|к)?');
  const SAL_RANGE_RE = new RegExp(
    SAL_NUM_SRC + '\\s*(k|к)?\\s*[-–—]\\s*[$€£]?\\s*' + SAL_NUM_SRC + '\\s*(k|к)?',
  );
  function tokenToNum(raw, k) {
    const t = String(raw)
      .replace(/\s+/g, '')
      .replace(/(\d)[.,](?=\d{3}(\D|$))/g, '$1') // thousands separators
      .replace(',', '.');                        // a leftover comma = decimal
    let n = parseFloat(t);
    if (!isFinite(n)) return null;
    if (k) n *= 1000;
    return n;
  }
  // Best-effort salary magnitude from a string. A RANGE ("$100-150K") is
  // judged by its TOP: comparing a floor against the bottom of a range
  // mislabels every stretch posting as under-paying. (v1.243.0, CAR-18)
  function salaryMagnitude(s) {
    const r = s.match(SAL_RANGE_RE);
    if (r) {
      const top = tokenToNum(r[3], r[4] || r[2]); // '100-150K' scales both
      if (top != null) return top;
    }
    const m = s.match(SAL_TOKEN_RE);
    if (!m) return null;
    return tokenToNum(m[1], m[2]);
  }

  // A salary floor mentioned in a preference line ("at least $120k", "min 100000").
  function salaryFloor(text) {
    const s = norm(text);
    if (!/\b(min|at least|minimum|floor|>=|≥|no less than|not below)\b|\bk\b|\$|€|£/.test(s)) return null;
    // A sub-annual rate ("500 EUR/day", "80/hr") is not an annual salary floor —
    // don't let the k-shorthand multiply promote it into a bogus 500k deal-breaker.
    if (/\/\s*(day|hr|hour|wk|week|mo|month)\b|\bper\s+(day|hour|week|month)\b|\b(daily|hourly|weekly|monthly)\b/.test(s)) return null;
    const n = salaryMagnitude(s);
    if (n == null) return null;
    return n >= 1000 ? n : (n > 0 && n < 1000 ? n * 1000 : null); // "120" → 120k
  }

  // Best-effort numeric salary from a job's display string (USD-ish, first number).
  function jobSalaryNum(job) {
    const s = norm(job && job.salary);
    if (!s || !/\d/.test(s)) return null;
    return salaryMagnitude(s);
  }

  /**
   * @param {object} job  scan row: {title, company, location, workplaceType, isRemote, salary, relocates}
   * @param {object} tp   two-pager: {loves, must_haves, hates, deal_breakers, non_negotiables, ...}
   * @param {object} [countries] window.Countries (injectable for tests)
   * @returns {{score:number|null, matched:Array<{label:string}>, violated:Array<{label:string}>}}
   */
  function scoreJob(job, tp, countries) {
    const C = countries || (typeof window !== 'undefined' && window.Countries) || null;
    if (!job || !tp) return { score: null, matched: [], violated: [] };

    const positives = [...list(tp.loves), ...list(tp.must_haves), ...list(tp.non_negotiables)];
    const negatives = [...list(tp.hates), ...list(tp.deal_breakers)];
    const hard = new Set([...list(tp.must_haves), ...list(tp.deal_breakers), ...list(tp.non_negotiables)].map(norm));

    const matched = [];
    const violated = [];
    let fired = 0;

    // ── work-type ──
    const jwt = jobWorkType(job);
    if (jwt) {
      for (const p of positives) { if (workTypeOf(p) === jwt) { fired++; matched.push({ label: p }); break; } }
      for (const n of negatives) { if (workTypeOf(n) === jwt) { fired++; violated.push({ label: n }); break; } }
    }

    // ── country ──
    const country = C && C.detectCountry ? C.detectCountry(job.location) : null;
    if (country) {
      const cname = norm(country.name);
      for (const p of positives) { if (workTypeOf(p) == null && hasWord(norm(p), cname)) { fired++; matched.push({ label: p }); break; } }
      for (const n of negatives) { if (hasWord(norm(n), cname)) { fired++; violated.push({ label: n }); break; } }
      // a must-have country the job is NOT in → soft violation. OR-listed
      // countries ("Germany or Netherlands") are satisfied when the job's
      // country is ONE of the named ones — the same line used to count as
      // matched AND violated, netting a perfect fit negative. (v1.243.0)
      for (const p of list(tp.must_haves)) {
        const named = (C.COUNTRIES || []).filter((x) => hasWord(norm(p), norm(x.name)));
        if (!named.length) continue;
        if (named.some((x) => x.code === country.code)) continue;
        fired++; violated.push({ label: p }); break;
      }
    }

    // ── salary floor ──
    const jobSal = jobSalaryNum(job);
    if (jobSal != null) {
      for (const p of [...list(tp.must_haves), ...list(tp.non_negotiables)]) {
        const floor = salaryFloor(p);
        if (floor != null) { fired++; (jobSal >= floor ? matched : violated).push({ label: p }); break; }
      }
    }

    // ── relocation / visa ──
    if (job.relocates === true) {
      for (const p of positives) { if (/reloc|visa|sponsor/.test(norm(p))) { fired++; matched.push({ label: p }); break; } }
    }

    if (fired === 0) return { score: null, matched: [], violated: [] };

    let score = 50 + matched.length * 15;
    for (const v of violated) score += (hard.has(norm(v.label)) ? -30 : -20);
    score = Math.max(0, Math.min(100, score));
    return { score, matched, violated };
  }

  window.FitScore = { scoreJob, _internals: { workTypeOf, salaryFloor } };
})();
