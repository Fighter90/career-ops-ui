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

  // A salary floor mentioned in a preference line ("at least $120k", "min 100000").
  function salaryFloor(text) {
    const s = norm(text);
    if (!/\b(min|at least|minimum|floor|>=|≥|no less than|not below)\b|\bk\b|\$|€|£/.test(s)) return null;
    const m = s.match(/(\d[\d.,]*)\s*(k|к)?/);
    if (!m) return null;
    let n = parseFloat(m[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
    if (!isFinite(n)) return null;
    if (m[2]) n *= 1000;
    return n >= 1000 ? n : (n > 0 && n < 1000 ? n * 1000 : null); // "120" → 120k
  }

  // Best-effort numeric salary from a job's display string (USD-ish, first number).
  function jobSalaryNum(job) {
    const s = norm(job && job.salary);
    if (!s || !/\d/.test(s)) return null;
    const m = s.match(/(\d[\d.,]*)\s*(k|к)?/);
    if (!m) return null;
    let n = parseFloat(m[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
    if (!isFinite(n)) return null;
    if (m[2]) n *= 1000;
    return n;
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
      for (const p of positives) { if (workTypeOf(p) == null && norm(p).includes(cname)) { fired++; matched.push({ label: p }); break; } }
      for (const n of negatives) { if (norm(n).includes(cname)) { fired++; violated.push({ label: n }); break; } }
      // a must-have country the job is NOT in → soft violation
      for (const p of list(tp.must_haves)) {
        const pc = C.COUNTRIES && C.COUNTRIES.find((x) => norm(p).includes(norm(x.name)) && x.code !== country.code);
        if (pc) { fired++; violated.push({ label: p }); break; }
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
