/* global window */
/**
 * cv-diagnostics.js — deterministic résumé diagnostics (v1.92.0, Epic 21).
 *
 * window.CvDiagnostics.analyze(markdown) inspects a CV in markdown and returns
 * a set of pass/warn/fail checks plus a 0–100 score. Pure and client-side —
 * no LLM, no network, no fabrication. It measures signals a recruiter/ATS
 * cares about (quantified impact, weak verbs, buzzwords, length, sections,
 * contact info) and explains each so the user can act, never rewriting silently.
 */
(function () {
  const WEAK_VERBS = [
    'responsible for', 'worked on', 'helped', 'assisted', 'involved in',
    'participated in', 'tasked with', 'duties included', 'in charge of',
  ];
  const BUZZWORDS = [
    'synergy', 'synergies', 'go-getter', 'think outside the box', 'team player',
    'hard worker', 'results-driven', 'detail-oriented', 'self-starter', 'dynamic',
    'proactive', 'go-to person', 'rockstar', 'ninja', 'guru', 'wheelhouse',
  ];
  const SECTION_HINTS = {
    experience: /\b(experience|employment|work history)\b/i,
    education: /\b(education|degree|university|b\.?sc|m\.?sc|ph\.?d)\b/i,
    skills: /\b(skills|technologies|tech stack|competenc)/i,
    summary: /\b(summary|profile|about|objective)\b/i,
  };
  const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
  const PHONE_RE = /(?:\+?\d[\s().-]?){7,}/;

  function bulletLines(md) {
    return md.split('\n').map((l) => l.trim()).filter((l) => /^([-*+]|\d+\.)\s+/.test(l));
  }
  function countMatches(text, terms) {
    const lower = text.toLowerCase();
    const found = [];
    for (const term of terms) {
      let idx = lower.indexOf(term);
      while (idx !== -1) { found.push(term); idx = lower.indexOf(term, idx + term.length); }
    }
    return found;
  }
  const hasNumber = (s) => /\d/.test(s) || /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(s);

  function analyze(markdown) {
    const md = typeof markdown === 'string' ? markdown : '';
    const words = (md.match(/\b[\w'-]+\b/g) || []).length;
    const bullets = bulletLines(md);
    const checks = [];
    const add = (id, label, status, detail) => checks.push({ id, label, status, detail });

    // Empty / near-empty CV: the "pass-by-absence" checks (no weak verbs, no
    // buzzwords) would otherwise inflate the score for a blank document. Return
    // a single honest failure instead.
    if (words < 20) {
      add('length', 'Length', 'fail', words === 0 ? 'The CV is empty.' : `Only ${words} words — there's almost nothing to evaluate yet.`);
      return { score: 0, words, bullets: bullets.length, checks };
    }

    // 1. Length (word count). The `words < 20` guard above already returned,
    // so here words >= 20 — no empty-document branch is reachable.
    if (words < 200) add('length', 'Length', 'warn', `Only ${words} words — most one-page CVs run 300–600. Consider adding detail.`);
    else if (words > 1100) add('length', 'Length', 'warn', `${words} words is long (≈2+ pages). Tighten to the most relevant.`);
    else add('length', 'Length', 'pass', `${words} words — a healthy one-to-two-page range.`);

    // 2. Quantified impact — share of bullets containing a number/metric.
    if (bullets.length) {
      const quantified = bullets.filter(hasNumber).length;
      const pct = Math.round((quantified / bullets.length) * 100);
      if (pct >= 50) add('quantified', 'Quantified impact', 'pass', `${pct}% of bullets include a number or metric.`);
      else if (pct >= 25) add('quantified', 'Quantified impact', 'warn', `Only ${pct}% of bullets are quantified. Add concrete numbers (%, $, time saved).`);
      else add('quantified', 'Quantified impact', 'fail', `Just ${pct}% of bullets have a metric. Recruiters skim for numbers — add them.`);
    } else {
      add('quantified', 'Quantified impact', 'warn', 'No bullet points detected — use bullets with metrics for experience.');
    }

    // 3. Weak verbs / passive framing.
    const weak = countMatches(md, WEAK_VERBS);
    if (!weak.length) add('weakVerbs', 'Strong action verbs', 'pass', 'No weak "responsible for / helped" phrasing found.');
    else add('weakVerbs', 'Strong action verbs', weak.length > 2 ? 'fail' : 'warn',
      `${weak.length} weak phrase(s) (e.g. "${weak[0]}"). Lead bullets with strong verbs (built, shipped, cut, grew).`);

    // 4. Buzzwords / clichés.
    const buzz = countMatches(md, BUZZWORDS);
    if (!buzz.length) add('buzzwords', 'Buzzwords', 'pass', 'No empty clichés detected.');
    else add('buzzwords', 'Buzzwords', buzz.length > 2 ? 'warn' : 'pass',
      `${buzz.length} cliché(s) (e.g. "${buzz[0]}"). Replace with specifics.`);

    // 5. Sections present.
    const missing = Object.keys(SECTION_HINTS).filter((k) => !SECTION_HINTS[k].test(md));
    if (!missing.length) add('sections', 'Core sections', 'pass', 'Summary, Experience, Education, and Skills are all present.');
    else add('sections', 'Core sections', missing.length > 1 ? 'warn' : 'pass', `Missing/undetected: ${missing.join(', ')}.`);

    // 6. Contact info.
    const hasEmail = EMAIL_RE.test(md);
    const hasPhone = PHONE_RE.test(md);
    if (hasEmail) add('contact', 'Contact info', 'pass', hasPhone ? 'Email and phone found.' : 'Email found (phone optional).');
    else add('contact', 'Contact info', 'warn', 'No email detected — make sure recruiters can reach you.');

    // Score: pass=full weight, warn=half, fail=zero; normalized to 0–100.
    const weight = { pass: 1, warn: 0.5, fail: 0 };
    const score = checks.length
      ? Math.round((checks.reduce((s, c) => s + weight[c.status], 0) / checks.length) * 100)
      : 0;

    return { score, words, bullets: bullets.length, checks };
  }

  window.CvDiagnostics = { analyze, _internals: { WEAK_VERBS, BUZZWORDS } };
})();
