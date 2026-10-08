/* global window */
/**
 * cv-diagnostics.js — deterministic résumé diagnostics (v1.92.0, Epic 21).
 *
 * window.CvDiagnostics.analyze(markdown) inspects a CV in markdown and returns
 * a set of pass/warn/fail checks plus a 0–100 score. Pure and client-side —
 * no LLM, no network, no fabrication. It measures signals a recruiter/ATS
 * cares about (quantified impact, weak verbs, buzzwords, length, sections,
 * contact info) and explains each so the user can act, never rewriting silently.
 *
 * CAR-37 — every check label + message flows through the ACTIVE locale via
 * window.I18n.t (`diag.*` keys; the inline English strings are the fallbacks
 * and byte-match the en dict). The returned shape is unchanged:
 * { score, words, bullets, checks: [{ id, label, status, detail }] } — when
 * window.I18n is absent (tests, bare embedding) everything stays English.
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

  // Active-locale lookup, resolved per call (the user can switch languages
  // without a reload). Same guard pattern as docs-fab.js / bug-report.js.
  function t(key, fallback) {
    return (typeof window !== 'undefined' && window.I18n && window.I18n.t)
      ? window.I18n.t(key, fallback)
      : fallback;
  }
  // {name} placeholder fill, mirroring the dict convention (track.hist*).
  function fill(template, vars) {
    return template.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
  }

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
    const sectionName = (k) => t(`diag.section.${k}`, k);

    // Empty / near-empty CV: the "pass-by-absence" checks (no weak verbs, no
    // buzzwords) would otherwise inflate the score for a blank document. Return
    // a single honest failure instead.
    if (words < 20) {
      add('length', t('diag.length.label', 'Length'), 'fail',
        words === 0
          ? t('diag.length.empty', 'The CV is empty.')
          : fill(t('diag.length.tooFew', "Only {n} words — there's almost nothing to evaluate yet."), { n: words }));
      return { score: 0, words, bullets: bullets.length, checks };
    }

    // 1. Length (word count). The `words < 20` guard above already returned,
    // so here words >= 20 — no empty-document branch is reachable.
    if (words < 200) add('length', t('diag.length.label', 'Length'), 'warn',
      fill(t('diag.length.short', 'Only {n} words — most one-page CVs run 300–600. Consider adding detail.'), { n: words }));
    else if (words > 1100) add('length', t('diag.length.label', 'Length'), 'warn',
      fill(t('diag.length.long', '{n} words is long (≈2+ pages). Tighten to the most relevant.'), { n: words }));
    else add('length', t('diag.length.label', 'Length'), 'pass',
      fill(t('diag.length.ok', '{n} words — a healthy one-to-two-page range.'), { n: words }));

    // 2. Quantified impact — share of bullets containing a number/metric.
    if (bullets.length) {
      const quantified = bullets.filter(hasNumber).length;
      const pct = Math.round((quantified / bullets.length) * 100);
      if (pct >= 50) add('quantified', t('diag.quantified.label', 'Quantified impact'), 'pass',
        fill(t('diag.quantified.ok', '{pct}% of bullets include a number or metric.'), { pct }));
      else if (pct >= 25) add('quantified', t('diag.quantified.label', 'Quantified impact'), 'warn',
        fill(t('diag.quantified.warn', 'Only {pct}% of bullets are quantified. Add concrete numbers (%, $, time saved).'), { pct }));
      else add('quantified', t('diag.quantified.label', 'Quantified impact'), 'fail',
        fill(t('diag.quantified.fail', 'Just {pct}% of bullets have a metric. Recruiters skim for numbers — add them.'), { pct }));
    } else {
      add('quantified', t('diag.quantified.label', 'Quantified impact'), 'warn',
        t('diag.quantified.noBullets', 'No bullet points detected — use bullets with metrics for experience.'));
    }

    // 3. Weak verbs / passive framing.
    const weak = countMatches(md, WEAK_VERBS);
    if (!weak.length) add('weakVerbs', t('diag.weakVerbs.label', 'Strong action verbs'), 'pass',
      t('diag.weakVerbs.ok', 'No weak "responsible for / helped" phrasing found.'));
    else add('weakVerbs', t('diag.weakVerbs.label', 'Strong action verbs'), weak.length > 2 ? 'fail' : 'warn',
      fill(t('diag.weakVerbs.found', '{n} weak phrase(s) (e.g. "{eg}"). Lead bullets with strong verbs (built, shipped, cut, grew).'),
        { n: weak.length, eg: weak[0] }));

    // 4. Buzzwords / clichés.
    const buzz = countMatches(md, BUZZWORDS);
    if (!buzz.length) add('buzzwords', t('diag.buzzwords.label', 'Buzzwords'), 'pass',
      t('diag.buzzwords.ok', 'No empty clichés detected.'));
    else add('buzzwords', t('diag.buzzwords.label', 'Buzzwords'), buzz.length > 2 ? 'warn' : 'pass',
      fill(t('diag.buzzwords.found', '{n} cliché(s) (e.g. "{eg}"). Replace with specifics.'),
        { n: buzz.length, eg: buzz[0] }));

    // 5. Sections present.
    const missing = Object.keys(SECTION_HINTS).filter((k) => !SECTION_HINTS[k].test(md));
    if (!missing.length) add('sections', t('diag.sections.label', 'Core sections'), 'pass',
      t('diag.sections.ok', 'Summary, Experience, Education, and Skills are all present.'));
    else add('sections', t('diag.sections.label', 'Core sections'), missing.length > 1 ? 'warn' : 'pass',
      fill(t('diag.sections.missing', 'Missing/undetected: {list}.'), { list: missing.map(sectionName).join(', ') }));

    // 6. Contact info.
    const hasEmail = EMAIL_RE.test(md);
    const hasPhone = PHONE_RE.test(md);
    if (hasEmail) add('contact', t('diag.contact.label', 'Contact info'), 'pass',
      hasPhone
        ? t('diag.contact.both', 'Email and phone found.')
        : t('diag.contact.emailOnly', 'Email found (phone optional).'));
    else add('contact', t('diag.contact.label', 'Contact info'), 'warn',
      t('diag.contact.noEmail', 'No email detected — make sure recruiters can reach you.'));

    // Score: pass=full weight, warn=half, fail=zero; normalized to 0–100.
    const weight = { pass: 1, warn: 0.5, fail: 0 };
    const score = checks.length
      ? Math.round((checks.reduce((s, c) => s + weight[c.status], 0) / checks.length) * 100)
      : 0;

    return { score, words, bullets: bullets.length, checks };
  }

  window.CvDiagnostics = { analyze, _internals: { WEAK_VERBS, BUZZWORDS } };
})();
