import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseYearsRequirement, classifyYears, formatYearsSegment, buildYearsMinFilter } from '../server/lib/jd-years.mjs';

// CAR-180 — the stated years-of-experience parser (upstream #6154, jd-years.mjs).
// The case tables are ported from the upstream tests/jd-years.test.mjs verbatim:
// the property they protect is that a posting is gated only on a clear,
// required, overall bar. Unknown, ambiguous, preferred-only, skill-only and
// absent readings carry no number the filter may act on.

// [JD text, status, gating min, confident, display]
const PARSE_CASES = [
  // Plain required bars
  ['5+ years of experience in product management', 'stated', 5, true, '5+'],
  ['Minimum of five (5) years of relevant experience', 'stated', 5, true, '5+'],
  ['A minimum of 6 years’ experience in management consulting', 'stated', 6, true, '6+'],
  ['5 or more years of experience', 'stated', 5, true, '5+'],
  ['At least two years in investment banking or consulting', 'stated', 2, true, '2+'],
  ['3+ yrs exp in data analytics', 'stated', 3, true, '3+'],
  ['10-plus years of software engineering experience', 'stated', 10, true, '10+'],
  ['Seven plus years of experience leading teams', 'stated', 7, true, '7+'],
  ['Experience: 3+ years.', 'stated', 3, true, '3+'],
  ['3 years of experience required.', 'stated', 3, true, '3+'],
  ['At least 1 year of experience in a fast-paced environment', 'stated', 1, true, '1+'],
  ['18 months of experience in a customer-facing role', 'stated', 1.5, true, '1.5+'],
  ['5+ years of Python experience', 'stated', 5, true, '5+'],
  // Ranges count by their floor
  ['3-5 years experience in finance', 'stated', 3, true, '3-5'],
  ['Typically requires 2–4 years of related experience', 'stated', 2, true, '2-4'],
  ['Between 3 and 6 years of experience in consulting', 'stated', 3, true, '3-6'],
  ['4 to 8 years of experience in corporate development', 'stated', 4, true, '4-8'],
  ['<ul><li>4-8 years of experience in corporate development</li><li>MBA preferred</li></ul>', 'stated', 4, true, '4-8'],
  ['0-2 years of professional experience', 'stated', 0, true, '0-2'],
  // Degree-conditional alternatives: the lowest bar gates
  ['Bachelor degree with 7 years of experience, or a Master degree with 5 years of experience.', 'stated', 5, true, '5/7+ by degree'],
  ['10 or more years with a Bachelor’s Degree, or at least 8 years with an Advanced Degree, or 2 years with a PhD', 'stated', 2, true, '2/8/10+ by degree'],
  ['BS in Computer Science + 7 years of experience / MS + 5 years', 'stated', 5, true, '5/7+ by degree'],
  // Years instead of a degree bind only candidates without it
  ['Bachelor’s degree or 4 years of equivalent experience.', 'none', null, false, 'none stated'],
  ['Bachelor\'s degree and 5+ years of experience, or equivalent', 'stated', 5, true, '5+'],
  // Required vs preferred
  ['Ideally 4+ years in a strategy role', 'preferred-only', null, false, 'pref 4+'],
  ['Preferred qualifications:\n- 8 years of experience in strategy', 'preferred-only', null, false, 'pref 8+'],
  ['Minimum qualifications:\n- 5 years of experience in finance\nPreferred qualifications:\n- 8 years of experience in strategy', 'stated', 5, true, '5+'],
  ['Required: 3+ years in FP&A. Preferred: 5+ years in strategy.', 'stated', 3, true, '3+'],
  ['5+ years of experience is a plus', 'preferred-only', null, false, 'pref 5+'],
  ['Nice to have\n- 3 years of experience in fintech', 'preferred-only', null, false, 'pref 3+'],
  ['Minimum of 2 years of frontend engineering experience preferred', 'preferred-only', null, false, 'pref 2+'],
  // Live Ashby posting: two required bars
  ['- Minimum 5 years of experience building software\n- Minimum 3 years of experience building in AWS (with Terraform)', 'stated', 3, true, '3/5+'],
  // Skill-specific figures do not gate
  ['2+ years of experience with SQL', 'skill-only', null, false, 'skill 2+'],
  ['3+ years of hands-on experience with Kubernetes', 'skill-only', null, false, 'skill 3+'],
  // Sub-requirements do not lower the overall bar
  ['7+ years of experience, including 2 years managing people', 'stated', 7, true, '7+'],
  // Several required bars: all shown, the lowest gates
  ['3+ years of experience in strategy; 6+ years in finance', 'stated', 3, true, '3/6+'],
  ['- 5+ years of professional software development experience\n- 2+ years of experience as a mentor or tech lead', 'stated', 2, true, '2/5+'],
  // Phrasings seen on live boards
  ['- 8+ years practicing employment law', 'stated', 8, true, '8+'],
  ['What We Require:\n- 3+ years of experience in finance within a US multi-national company', 'stated', 3, true, '3+'],
  ['- Extensive security experience (3+ years) in at least one major platform', 'stated', 3, true, '3+'],
  ['- 2+ years technical engineering experience', 'stated', 2, true, '2+'],
  ['- 4+ years of experience with Linux system administration', 'skill-only', null, false, 'skill 4+'],
  // "No experience required" is a stated zero
  ['No prior experience required', 'stated', 0, true, '0+'],
  // Not about the candidate's experience
  ['We have over 20 years of experience serving clients.', 'none', null, false, 'none stated'],
  ['Our team brings 15 years of combined experience to every engagement.', 'none', null, false, 'none stated'],
  ['Four-year degree required.', 'none', null, false, 'none stated'],
  ['A 4-year degree in economics', 'none', null, false, 'none stated'],
  ['Must be 18 years of age or older', 'none', null, false, 'none stated'],
  ['Our company was founded 12 years ago', 'none', null, false, 'none stated'],
  ['Equity vests over 4 years', 'none', null, false, 'none stated'],
  ['Within 2 years you will lead the team.', 'none', null, false, 'none stated'],
  ['Over the past 10 years, Acme has grown to 5,000 employees.', 'none', null, false, 'none stated'],
  ['This is a 12-month contract', 'none', null, false, 'none stated'],
  ['Revenue grew 40% year-over-year for 3 years', 'none', null, false, 'none stated'],
  ['', 'none', null, false, 'none stated'],
  // False-drop guards found in upstream review
  ['This is a year-long rotational program for new graduates', 'none', null, false, 'none stated'],
  ['Pay is about $100K a year, depending on experience.', 'none', null, false, 'none stated'],
  ['Join our 3-year rotational program; prior experience welcome', 'none', null, false, 'none stated'],
  ["You'll work alongside engineers with 10+ years of experience", 'none', null, false, 'none stated'],
  ['Learn from mentors who have 15 years in the industry.', 'none', null, false, 'none stated'],
  ['Even better if you have:\n- 8+ years of experience in strategy', 'preferred-only', null, false, 'pref 8+'],
  ['Bonus points:\n- 6 years in fintech', 'preferred-only', null, false, 'pref 6+'],
  ['5+ years of experience, or an equivalent combination of education and experience', 'stated', 5, false, '5+ or equivalent'],
  ['- 5+ years of relevant experience\n- Or an equivalent combination of education and experience', 'stated', 5, false, '5+ or equivalent'],
  ['A year of experience in customer support', 'stated', 1, true, '1+'],
];

test(`parser reads ${PARSE_CASES.length} real phrasings (upstream case table)`, () => {
  const misses = [];
  for (const [text, status, min, confident, display] of PARSE_CASES) {
    const r = parseYearsRequirement(text);
    const got = { status: r.status, min: r.min, confident: r.confident, display: r.display };
    const want = { status, min, confident, display };
    if (JSON.stringify(got) !== JSON.stringify(want)) misses.push(`${JSON.stringify(text)}: got ${JSON.stringify(got)}`);
  }
  assert.deepStrictEqual(misses, []);
});

// Upstream review regressions: each of these was read as a confident bar
// above a 3-year band, so `drop` semantics would have removed the very
// early-career postings the filter exists to keep. None may read as `out`.
const NEVER_OUT = [
  // A ceiling is not a floor.
  'Up to 10 years of experience in finance.',
  'Less than 8 years of professional experience',
  'No more than 6 years of experience',
  '5 years of experience maximum.',
  'Requirements:\n- 6 years of experience or less',
  // Someone else's experience.
  "You'll join a team that averages 12 years of industry experience.",
  'Manage a team of analysts with 5-8 years of experience.',
  'Responsibilities:\n- Support clients with 10+ years of experience in the market.',
  'Experience hiring candidates with 10+ years of experience.',
  // A heading the parser does not know is not a required section.
  'Requirements:\n- 2+ years of experience with SQL\nWhat we\'d love to see\n- 8+ years of experience in fintech',
  'Requirements:\n- 2+ years of experience with SQL\nAdditional Qualifications\n- 8+ years of experience in fintech',
  'Requirements:\n- 2+ years of experience with SQL\nPreferred Qualifications (any 2 of the following)\n- 7+ years of experience in fintech',
  'Requirements:\n- 2+ years of experience with SQL\nIt would be great if you also have the following things\n- 7+ years of experience in fintech',
];

test(`review regressions: ${NEVER_OUT.length} ceilings, third parties and unknown headings never read as out`, () => {
  const bad = NEVER_OUT
    .map((jd) => ({ jd, req: parseYearsRequirement(jd) }))
    .filter(({ req }) => classifyYears(req, { years: 3, stretchYears: 1 }) === 'out')
    .map(({ jd, req }) => `${JSON.stringify(jd)} → ${req.display}`);
  assert.deepStrictEqual(bad, []);
});

test('a bar under an unknown heading still gates when the sentence speaks to the candidate', () => {
  const req = parseYearsRequirement('About the role\n- You have 8+ years of experience in fintech.');
  assert.strictEqual(classifyYears(req, { years: 3, stretchYears: 1 }), 'out');
  // A short bullet with a figure in parentheses is not a heading, so it does
  // not end the required section it sits in (a live Lever JD).
  const travel = parseYearsRequirement('What We Require\n- Ability to travel (50%+) per business needs\n- 10+ years of outbound sales experience');
  assert.strictEqual(classifyYears(travel, { years: 3, stretchYears: 1 }), 'out');
});

test('pathological whitespace and tag-like input parse in well under a second', () => {
  for (const jd of [`5+ years${' '.repeat(60_000)}of experience. Next`, '<a'.repeat(30_000)]) {
    const t = performance.now();
    parseYearsRequirement(jd);
    assert.ok(performance.now() - t < 500, `${Math.round(performance.now() - t)}ms`);
  }
});

test('a full multi-section JD gates on its required section only', () => {
  const jd = [
    'About Acme',
    'Founded 25 years ago, we have served customers for over 20 years.',
    'What you will do',
    '- Own the quarterly planning cycle',
    'Minimum Qualifications:',
    '- Bachelor’s degree in Finance, Economics, or a related field.',
    '- 4+ years of experience in corporate strategy, consulting, or investment banking.',
    '- 2+ years of experience with SQL.',
    'Preferred Qualifications:',
    '- 7+ years of experience in strategy.',
    'Benefits',
    '- 401(k) match after 1 year of service',
  ].join('\n');
  const r = parseYearsRequirement(jd);
  assert.strictEqual(r.status, 'stated');
  assert.strictEqual(r.min, 4);
  assert.strictEqual(r.confident, true);
  assert.ok(r.mentions.some((m) => m.kind === 'preferred' && m.floor === 7));
  assert.ok(r.mentions.some((m) => m.scope === 'skill' && m.floor === 2));
});

test('band verdict: a floor at or below years + stretch is in band; ranges count by their floor', () => {
  const band = { years: 3, stretchYears: 0 };
  assert.strictEqual(classifyYears(parseYearsRequirement('3+ years of experience'), band), 'in');
  assert.strictEqual(classifyYears(parseYearsRequirement('2-4 years of experience'), band), 'in');
  assert.strictEqual(classifyYears(parseYearsRequirement('3-5 years of experience'), band), 'in');
  assert.strictEqual(classifyYears(parseYearsRequirement('3+ years of experience'), { years: 2, stretchYears: 1 }), 'in');
  assert.strictEqual(classifyYears(parseYearsRequirement('5+ years of experience'), band), 'out');
  for (const text of [
    'No years mentioned anywhere.',
    'Ideally 10+ years in a strategy role',
    '8+ years of experience with Kubernetes',
  ]) {
    assert.strictEqual(classifyYears(parseYearsRequirement(text), band), 'unknown', text);
  }
  assert.strictEqual(classifyYears(null, band), 'unknown');
});

test('formatYearsSegment labels the pipeline segment', () => {
  assert.strictEqual(formatYearsSegment(parseYearsRequirement('5+ years of experience'), 'in'), 'yrs: 5+');
  assert.strictEqual(formatYearsSegment(parseYearsRequirement('6+ years of experience'), 'out'), 'yrs: 6+ above band');
  assert.strictEqual(formatYearsSegment(null, 'unknown'), 'yrs: unread');
});

test('buildYearsMinFilter: off unless a finite non-negative number', () => {
  assert.strictEqual(buildYearsMinFilter(undefined)(0), true);
  assert.strictEqual(buildYearsMinFilter(null)(0), true);
  assert.strictEqual(buildYearsMinFilter('3')(0), true);
  assert.strictEqual(buildYearsMinFilter(-1)(0), true);
  assert.strictEqual(buildYearsMinFilter(Number.NaN)(0), true);
  assert.strictEqual(buildYearsMinFilter(Number.POSITIVE_INFINITY)(0), true);
});

test('buildYearsMinFilter: below N is cut, at-or-above N passes, no figure passes', () => {
  const ok = buildYearsMinFilter(3);
  assert.strictEqual(ok(0), false);
  assert.strictEqual(ok(2), false);
  assert.strictEqual(ok(1.5), false);
  assert.strictEqual(ok(3), true, 'boundary: exactly N passes');
  assert.strictEqual(ok(5), true);
  assert.strictEqual(ok(undefined), true, 'no stated figure never filters');
});

test('buildYearsMinFilter: fractional thresholds work (18 months = 1.5)', () => {
  const ok = buildYearsMinFilter(1.5);
  assert.strictEqual(ok(1.5), true);
  assert.strictEqual(ok(1), false);
});
