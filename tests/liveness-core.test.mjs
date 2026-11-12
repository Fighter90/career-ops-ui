/**
 * Liveness classifier + ATS URL resolver — pure, CI-isolated (no network,
 * no parent project). Covers the classifier's status branches and the
 * SSRF-relevant fixed-host mapping of resolveAtsApi.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLiveness } from '../server/lib/liveness-core.mjs';
import { resolveAtsApi, isAtsPosting, classifyAshbyBoard } from '../server/lib/liveness-api.mjs';

// A body long enough to clear MIN_CONTENT_CHARS (300) so short-body heuristics
// don't fire when we're isolating the status-code branches.
const LONG_BODY = 'x'.repeat(400);

test('classifyLiveness: 404 and 410 → expired (http_gone)', () => {
  for (const status of [404, 410]) {
    const r = classifyLiveness({ status, bodyText: LONG_BODY });
    assert.equal(r.result, 'expired', `status ${status}`);
    assert.equal(r.code, 'http_gone');
  }
});

test('classifyLiveness: 200 with a visible apply control → active (live)', () => {
  const r = classifyLiveness({
    status: 200,
    requestedUrl: 'https://boards.greenhouse.io/acme/jobs/123',
    finalUrl: 'https://boards.greenhouse.io/acme/jobs/123',
    bodyText: LONG_BODY,
    applyControls: ['Apply for this job'],
  });
  assert.equal(r.result, 'active'); // the /api/liveness route maps active → live
  assert.equal(r.code, 'apply_control_visible');
});

test('classifyLiveness: 403 / 429 / 503 → uncertain (access_blocked, never expired)', () => {
  for (const status of [403, 429, 503]) {
    const r = classifyLiveness({ status, bodyText: LONG_BODY });
    assert.equal(r.result, 'uncertain', `status ${status}`);
    assert.equal(r.code, 'access_blocked');
  }
});

test('classifyLiveness: other 5xx (500/502/504) → uncertain (server_error)', () => {
  for (const status of [500, 502, 504]) {
    const r = classifyLiveness({ status, bodyText: LONG_BODY });
    assert.equal(r.result, 'uncertain', `status ${status}`);
    assert.equal(r.code, 'server_error');
  }
});

test('classifyLiveness: a hard-expired banner → expired even on 200', () => {
  const r = classifyLiveness({ status: 200, bodyText: 'This job posting has expired. ' + LONG_BODY });
  assert.equal(r.result, 'expired');
  assert.equal(r.code, 'expired_body');
});

test('classifyLiveness: a banner on its own line is not part of the line above (parent 880a1cb4)', () => {
  // Chrome above a banner often ends without punctuation, so joined lines put
  // its "if"/"when" within ten words of the banner's end. The clause test now
  // sees the line break, and a closed posting with an Apply control reads
  // expired — while a stated future closure ("until … filled") on its own
  // line still stays active.
  const body = (text) => `${LONG_BODY}\n${text}`;
  const closed = classifyLiveness({
    status: 200,
    finalUrl: 'https://careers.example.com/job/123',
    bodyText: body('Sign in if you have an account\nThis job has been filled.'),
    applyControls: ['Apply'],
  });
  assert.equal(closed.result, 'expired');
  assert.equal(closed.code, 'expired_body');

  const open = classifyLiveness({
    status: 200,
    finalUrl: 'https://careers.example.com/job/123',
    bodyText: body('Applications will be accepted until the position has been filled.'),
    applyControls: ['Apply'],
  });
  assert.equal(open.result, 'active');
  assert.equal(open.code, 'apply_control_visible');
});

test('classifyLiveness: 200, content present, no apply control → uncertain (conservative)', () => {
  const r = classifyLiveness({ status: 200, bodyText: LONG_BODY, applyControls: [] });
  assert.equal(r.result, 'uncertain');
  assert.equal(r.code, 'no_apply_control');
});

test('classifyLiveness: Vietnamese apply label NỘP ĐƠN ỨNG TUYỂN → active (CareerViet, parent #4832)', () => {
  const vi = (controls) => classifyLiveness({
    status: 200,
    finalUrl: 'https://careerviet.vn/vi/tim-viec-lam/brand-executive.35C50000.html',
    bodyText: 'Mô tả công việc. '.repeat(30),
    applyControls: controls,
  });
  const r = vi(['NỘP ĐƠN ỨNG TUYỂN']);
  assert.equal(r.result, 'active');
  assert.equal(r.code, 'apply_control_visible');

  const mixed = vi(['Nộp đơn ứng tuyển']);
  assert.equal(mixed.result, 'active', 'mixed case reads too (normalizeForMatch strips the diacritics)');

  // The label must not be a loose match: "đơn" prose elsewhere ("view order")
  // is not an Apply control.
  const neg = vi(['Xem đơn hàng']);
  assert.equal(neg.result, 'uncertain', 'an unrelated "đơn" control is not an Apply control');
  assert.equal(neg.code, 'no_apply_control');
});

test('classifyLiveness: Bulgarian apply labels → active (upstream #6192)', () => {
  const bg = (controls) => classifyLiveness({
    status: 200,
    finalUrl: 'https://careers.example.bg/position/12345',
    bodyText: LONG_BODY,
    applyControls: controls,
  });
  // "Кандидатствай" / "Кандидатствайте сега" / "КАНДИДАТСТВАЙ" (imperative),
  // "Кандидатстване" and "Външно кандидатстване" (noun, plain and external).
  for (const label of ['Кандидатствай', 'Кандидатствайте сега', 'КАНДИДАТСТВАЙ', 'Кандидатстване', 'Външно кандидатстване']) {
    const r = bg([label]);
    assert.equal(r.result, 'active', label);
    assert.equal(r.code, 'apply_control_visible', label);
  }
});

test('classifyLiveness: Bulgarian non-Apply labels stay non-Apply (upstream #6192)', () => {
  const bg = (controls) => classifyLiveness({
    status: 200,
    finalUrl: 'https://careers.example.bg/position/12345',
    bodyText: LONG_BODY,
    applyControls: controls,
  });
  // «Кандидати» = candidates (a different noun); «кандидатствахте» = you
  // applied (a longer verb form the class/lookahead must not swallow);
  // «кандидатстването» = the definite noun; «Писмо за кандидатстване» is
  // advice copy — the noun only counts at the START of a label.
  for (const label of ['Кандидати', 'Кандидатствахте', 'Кандидатстването', 'Писмо за кандидатстване']) {
    const r = bg([label]);
    assert.equal(r.result, 'uncertain', label);
    assert.equal(r.code, 'no_apply_control', label);
  }
});



// --- CAR-189: language-specific apply controls (upstream APPLY_PATTERNS tail) ---
// Positives must reach active via apply_control_visible. Negatives matter as
// much: closed postings keep their FAQ/help links, so matching the verb (or an
// unanchored label) would keep dead postings alive forever.
function controlFixture(controls) {
  return classifyLiveness({
    status: 200,
    requestedUrl: 'https://careers.example.com/job/123',
    finalUrl: 'https://careers.example.com/job/123',
    bodyText: LONG_BODY,
    applyControls: controls,
  });
}

test('classifyLiveness: Dutch apply controls → active (CAR-189, VDAB/Recruitee NL)', () => {
  for (const control of ['Solliciteer nu', 'Solliciteren']) {
    const r = controlFixture([control]);
    assert.equal(r.result, 'active', control);
    assert.equal(r.code, 'apply_control_visible', control);
  }
});

test('classifyLiveness: Dutch noun "Sollicitatie…" is not an apply control (CAR-189)', () => {
  const r = controlFixture(['Sollicitatieprocedure']);
  assert.equal(r.result, 'uncertain');
  assert.equal(r.code, 'no_apply_control');
});

test('classifyLiveness: getManfred "¡Apúntame!" → active; the verb "aplicar" does not (CAR-189)', () => {
  const r = controlFixture(['¡Apúntame!']);
  assert.equal(r.result, 'active');
  assert.equal(r.code, 'apply_control_visible');

  // Closed getManfred postings keep an FAQ button like this one — a verb
  // match would keep them alive forever.
  const faq = controlFixture(['¿Puedo aplicar si vivo fuera de España?']);
  assert.equal(faq.result, 'uncertain');
  assert.equal(faq.code, 'no_apply_control');
});

test('classifyLiveness: HiringRoom "Postularse" label → active; the help-link verb does not (CAR-189)', () => {
  const r = controlFixture(['Postularse']);
  assert.equal(r.result, 'active');
  assert.equal(r.code, 'apply_control_visible');

  // Every HiringRoom posting also links a help article "¿Cómo me postulo?".
  const help = controlFixture(['¿Cómo me postulo?']);
  assert.equal(help.result, 'uncertain');
  assert.equal(help.code, 'no_apply_control');
});

test('classifyLiveness: MokaHR/Feishu exact apply labels → active; prose/status labels do not (CAR-189)', () => {
  for (const control of ['申请职位', '投递']) {
    const r = controlFixture([control]);
    assert.equal(r.result, 'active', control);
    assert.equal(r.code, 'apply_control_visible', control);
  }

  // Bare “申请” appears in descriptive prose and longer labels containing
  // “投递” are status/history controls — the patterns are anchored to the
  // whole control text on purpose.
  for (const control of ['在申请职位描述中了解详情', '投递记录']) {
    const r = controlFixture([control]);
    assert.equal(r.result, 'uncertain', control);
    assert.equal(r.code, 'no_apply_control', control);
  }
});

test('resolveAtsApi: maps each provider posting URL to its FIXED-host public API', () => {
  const cases = [
    ['https://boards.greenhouse.io/acme/jobs/123', 'greenhouse', 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/123'],
    ['https://jobs.lever.co/acme/abc-123', 'lever', 'https://api.lever.co/v0/postings/acme/abc-123'],
    ['https://jobs.ashbyhq.com/acme/uuid-1', 'ashby', 'https://api.ashbyhq.com/posting-api/job-board/acme'],
    ['https://acme.wd1.myworkdayjobs.com/en-US/careers/job/Remote/Engineer_R1', 'workday',
      'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/careers/job/Remote/Engineer_R1'],
    ['https://jobs.smartrecruiters.com/Acme/744000012345678-engineer', 'smartrecruiters',
      'https://api.smartrecruiters.com/v1/companies/Acme/postings/744000012345678'],
  ];
  for (const [url, ats, apiUrl] of cases) {
    const r = resolveAtsApi(url);
    assert.ok(r, `should resolve ${url}`);
    assert.equal(r.ats, ats, url);
    assert.equal(r.apiUrl, apiUrl, url);
    assert.equal(isAtsPosting(url), true, url);
  }
});

test('resolveAtsApi: rejects non-ATS, http, and look-alike hostnames (SSRF guard)', () => {
  for (const url of [
    'https://example.com/jobs/1',
    'http://boards.greenhouse.io/acme/jobs/123',            // not https
    'https://boards.greenhouse.io.evil.com/acme/jobs/123',  // look-alike host
    'https://jobs.ashbyhq.com.evil.com/acme/uuid',          // look-alike host
    'not-a-url',
  ]) {
    assert.equal(resolveAtsApi(url), null, url);
    assert.equal(isAtsPosting(url), false, url);
  }
});

test('classifyAshbyBoard: listed → active, absent/unlisted → expired, bad shape → null', () => {
  const listed = { jobs: [{ id: 'uuid-1', isListed: true }] };
  assert.equal(classifyAshbyBoard(listed, 'uuid-1').result, 'active');
  const unlisted = { jobs: [{ id: 'uuid-1', isListed: false }] };
  assert.equal(classifyAshbyBoard(unlisted, 'uuid-1').result, 'expired');
  const absent = { jobs: [{ id: 'other', isListed: true }] };
  assert.equal(classifyAshbyBoard(absent, 'uuid-1').result, 'expired');
  assert.equal(classifyAshbyBoard(null, 'uuid-1'), null);
  assert.equal(classifyAshbyBoard({ nope: true }, 'uuid-1'), null);
});

test('classifyLiveness: Built In "Sorry, this job was removed" banner → expired even with an APPLY control (#6336)', () => {
  // Built In keeps a removed posting's full JD and its APPLY control and says
  // it is gone only in a banner — the apply control used to win.
  const r = classifyLiveness({
    status: 200,
    bodyText: 'Sorry, this job was removed at 08:47 p.m. (UTC) on Wednesday, Oct 14, 2026\n' + LONG_BODY,
    applyControls: ['Apply for this job'],
  });
  assert.equal(r.result, 'expired');
  assert.equal(r.code, 'expired_body');
});

test('classifyLiveness: a sibling "Job removed" badge (no "sorry") with an APPLY control stays active (#6336)', () => {
  const r = classifyLiveness({
    status: 200,
    bodyText: 'Job removed\n' + LONG_BODY,
    applyControls: ['Apply for this job'],
  });
  assert.equal(r.result, 'active');
});

// ── Norwegian wave (parent #6620) + the "Sorter etter søknadsfrist" fix
// (parent #6788, CAR-259). arbeidsplassen.no, Jobbnorge and employer career
// sites keep a closed posting's "Søk her" link, so the closure banners are
// hard patterns; normalizeForMatch folds å→a but leaves ø alone, hence [øo].
const NORWEGIAN_BODY = 'Om stillingen\nVi søker en avdelingsdirektør som skal lede plattform og infrastruktur i en stor offentlig virksomhet.\n'.repeat(4);
const norwegianPage = (bodyText, applyControls) => classifyLiveness({
  status: 200,
  requestedUrl: 'https://arbeidsplassen.nav.no/stillinger/stilling/022e0f20-ab6f-4fa8-ae75-8db6143c5d51',
  finalUrl: 'https://arbeidsplassen.nav.no/stillinger/stilling/022e0f20-ab6f-4fa8-ae75-8db6143c5d51',
  bodyText,
  applyControls,
});

test('classifyLiveness: Norwegian qualified apply labels → active (parent #6620)', () => {
  for (const label of ['Gå til søknad', 'Send søknad', 'Søk på stillingen', 'Søk på denne stillingen', 'Søk nå', 'Søk her', 'GÅ TIL SØKNAD']) {
    const r = norwegianPage(NORWEGIAN_BODY, ['Lagre favoritt', label]);
    assert.equal(r.result, 'active', label);
    assert.equal(r.code, 'apply_control_visible', label);
  }
});

test('classifyLiveness: bare "Søk", the search control and the deadline stem are NOT Apply (parent #6620)', () => {
  // Bare "Søk" is also every Norwegian site's search button, and the deadline
  // line and the "Søknadsfrist" label share the stem. None of them is Apply.
  for (const label of ['Søk', 'Søk etter stillinger', 'Søknadsfrist', 'Søk senest mandag 16. november']) {
    const r = norwegianPage(NORWEGIAN_BODY, [label]);
    assert.equal(r.result, 'uncertain', label);
    assert.equal(r.code, 'no_apply_control', label);
  }
});

test('classifyLiveness: a Norwegian closure banner expires a posting that keeps its "Søk her" link (parent #6620, #6788)', () => {
  // A closed Norwegian posting can keep its "Søk her" link next to the closure
  // banner. The banner wins; a deadline still ahead does not. "Søk etter
  // stillinger" is site chrome, not a clause opener: it can sit on the banner's
  // own line and must not hide the closure. Neither may a "Sorter etter
  // søknadsfrist" sort control joined to the banner: its "etter" opens no
  // clause around the banner (#6788) — joined on one line or on the next.
  for (const notice of [
    'Søknadsfristen er utløpt',
    'Søknadsfristen har gått ut',
    'Stillingen er ikke lenger ledig',
    'Denne annonsen er utløpt',
    'Stillingen er besatt',
    'Søk etter stillinger Søknadsfristen er utløpt',
    'Sorter etter søknadsfrist Stillingen er besatt',
    'Sorter etter søknadsfrist\nStillingen er besatt',
    'Sorter etter søknadsfrist Søknadsfristen er utløpt',
  ]) {
    const r = norwegianPage(`${notice}\n${NORWEGIAN_BODY}`, ['Søk her']);
    assert.equal(r.result, 'expired', notice);
  }
});

test('classifyLiveness: Norwegian deadline-ahead clauses keep a posting active (parent #6620)', () => {
  for (const notice of [
    'Når søknadsfristen er utløpt, blir søkerlisten offentliggjort',
    'Etter at søknadsfristen er utløpt vil vi kalle inn til intervju',
    'Søknader behandles etter søknadsfristen er utløpt',
    'Søkerlisten blir offentlig så snart søknadsfristen har gått ut',
    'Søknadsfrist: 20.11.2026',
    'Søknadsfristen utløper 20. november',
    'Søknadsfristen er 20. november',
    'Stillingen er ledig fra 1. januar',
    'Stillingen vil bli besatt så snart som mulig',
  ]) {
    const r = norwegianPage(`${notice}\n${NORWEGIAN_BODY}`, ['Søk her']);
    assert.equal(r.result, 'active', notice);
    assert.equal(r.code, 'apply_control_visible', notice);
  }
});
