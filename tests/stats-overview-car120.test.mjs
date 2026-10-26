/**
 * CAR-120 — #/stats v2: a real-data "Overview" as the FIRST tab, the LLM
 * market report moved to its own (last, separated) tab, and a one-line
 * horizontal-scroll tab bar.
 *
 * Acceptance (Linear CAR-120):
 *   • ≥ 6 charts built from REAL data (tracker + scan snapshot) — no LLM.
 *   • Tab bar stays on ONE line at 1280 px in every locale (scroll + fade).
 *   • Charts are CSP-safe SVG (no canvas/innerHTML), RTL-safe, animated in
 *     300 ms with `prefers-reduced-motion` opt-out, and carry a11y labels +
 *     native <title> tooltips.
 *
 * Two layers:
 *   1. Pure aggregation helpers sliced out of the view source and run in a vm
 *      against fixtures (and against the REAL RoleStats.parseSalaryUSD — the
 *      chart must never silently depend on an assumed parser shape).
 *   2. A BEHAVIORAL render of the whole Overview tab in a vm with a minimal
 *      DOM shim and stubbed API/UI/I18n — the acceptance "≥ 6 charts" is
 *      asserted on RENDERED svg[role] nodes, not on source-text occurrences.
 *
 * Opus review round 2 findings covered here: min-only salary midpoints (no
 * $60k fabrication), keyboard-operable clickable bars, conditional click
 * hint, funnel empty-state branching, shared distinct-companies count,
 * localized stage-hop labels + Intl.PluralRules day forms, and the
 * activate() scroll-into-view.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__d, '..');
const STATS = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'stats.js'), 'utf8');
const OVERLAYS = readFileSync(resolve(ROOT, 'public', 'css', 'overlays.css'), 'utf8');
const APPCSS = readFileSync(resolve(ROOT, 'public', 'css', 'app.css'), 'utf8');
const SKILLS = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'skills.js'), 'utf8');
const ROLE_STATS = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'role-stats.js'), 'utf8');
const JOB_FACETS = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'job-facets.js'), 'utf8');
const TRACKER_STAGES = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'tracker-stages.js'), 'utf8');

/** Slice a top-level `function name(…) { … }` out of the source (balanced braces). */
function sliceFn(src, startMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} must exist`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces after ${startMarker}`);
}

function runFns(names) {
  const src = names.map((n) => sliceFn(STATS, `function ${n}`)).join('\n');
  const ctx = vm.createContext({ Math, Number, Set, Map, Array, Object, String, RegExp, parseInt, parseFloat, isFinite });
  vm.runInContext(src, ctx);
  return vm.runInContext(`({ ${names.join(', ')} })`, ctx);
}

// Round-trip vm-realm objects through JSON (foreign Object.prototype makes
// deepStrictEqual throw "same structure but not reference-equal" — the
// documented i18n-vm trap; helpers run inside node:vm here).
const host = (x) => JSON.parse(JSON.stringify(x));

// ── the REAL parser, not an assumed shape (Opus r2 finding 3) ────────────────

/** Boot the real skills.js + role-stats.js in a vm; return parseSalaryUSD. */
function realParseSalaryUSD() {
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(SKILLS, ctx);
  vm.runInContext(ROLE_STATS, ctx);
  const RS = vm.runInContext('window.RoleStats', ctx);
  assert.ok(RS && typeof RS.parseSalaryUSD === 'function', 'role-stats.js must expose parseSalaryUSD');
  // Shape assertion: the whole salary pipeline assumes {minUsd, maxUsd}.
  const probe = RS.parseSalaryUSD('$100,000');
  assert.ok(probe && typeof probe.minUsd === 'number' && typeof probe.maxUsd === 'number',
    `parseSalaryUSD must return {minUsd,maxUsd}, got ${JSON.stringify(probe)}`);
  return RS.parseSalaryUSD;
}

// ── pure helpers ──────────────────────────────────────────────────────────────

test('scoreBuckets: tracker scores land in 0–1…4–5 buckets, unparseable rows drop', () => {
  const { scoreBuckets } = runFns(['scoreVal', 'scoreBuckets']);
  const rows = [
    { score: '4.2/5' }, { score: '4.8/5' }, { score: 0.5 },
    { score: '2.5' }, { score: 'N/A' }, { score: '' }, {},
  ];
  const buckets = scoreBuckets(rows);
  assert.equal(buckets.length, 5);
  assert.deepEqual(host(buckets), [
    { label: '0–1', value: 1 },
    { label: '1–2', value: 0 },
    { label: '2–3', value: 1 },
    { label: '3–4', value: 0 },
    { label: '4–5', value: 2 },
  ]);
});

test('topCountItems: counts, sorts desc, caps at n, skips empty keys', () => {
  const { topCountItems } = runFns(['topCountItems']);
  const rows = [
    { company: 'Acme' }, { company: 'acme' }, { company: 'Beta' },
    { company: 'Gamma' }, { company: '' }, { company: null }, {},
  ];
  const items = topCountItems(rows, 'company', 2);
  assert.deepEqual(host(items), [
    { label: 'Acme', value: 2 },
    { label: 'Beta', value: 1 },
  ], 'case-insensitive fold, desc, capped');
});

test('distinctCompanies: ONE shared fold (trim + lowercase) for both tabs’ KPI', () => {
  const { distinctCompanies } = runFns(['distinctCompanies']);
  assert.equal(distinctCompanies([
    { company: 'Acme' }, { company: ' acme ' }, { company: 'Beta' },
    { company: '  ' }, { company: null }, {},
  ]), 2, 'trims and case-folds before deduping');
  // Both tabs must use the same helper — same label, same number.
  assert.match(STATS, /statCard\(distinctCompanies\(rows\)/, 'Overview KPI uses the shared helper');
  assert.match(STATS, /statCard\(rows\.filter[\s\S]{0,200}statCard\(distinctCompanies\(rows\)/,
    'Pipeline KPI uses the shared helper too');
});

test('monthItems: groups tracker dates by YYYY-MM and sorts ascending', () => {
  const { monthItems } = runFns(['monthItems']);
  const rows = [
    { date: '2026-03-02' }, { date: '2026-03-11' }, { date: '2026-01-31' },
    { date: 'garbage' }, { date: '' }, {},
  ];
  assert.deepEqual(host(monthItems(rows)), [
    { label: '2026-01', value: 1 },
    { label: '2026-03', value: 2 },
  ]);
});

test('weekItems: buckets posting dates into Monday weeks, keeps the last N, sorts asc', () => {
  const { weekItems } = runFns(['weekItems']);
  // 2026-10-26 is a Monday; 2026-10-27/29 fall into the same week.
  const dates = [
    '2026-10-27', '2026-10-29', '2026-10-26',
    '2026-10-13', // week of Mon 2026-10-12
    'not-a-date', '', null,
  ];
  const items = weekItems(dates, { weeks: 4, now: '2026-10-29T12:00:00Z' });
  assert.deepEqual(host(items), [
    { label: '2026-10-12', value: 1 },
    { label: '2026-10-26', value: 3 },
  ]);
});

test('sourceItems: ATS slug first, URL-host fallback, leftovers → Other', () => {
  const { sourceItems } = runFns(['sourceItems']);
  const jobs = [
    { source: 'greenhouse' }, { source: 'greenhouse' }, { source: 'hh.ru' },
    { url: 'https://jobs.lever.co/acme/1' },   // no source → host fallback
    { url: 'https://example.com/x' },          // unknown host → other
    {},                                        // nothing at all → other
  ];
  const items = sourceItems(jobs, (u) => (/lever\.co/.test(u) ? 'lever' : null));
  assert.deepEqual(host(items), [
    { label: 'greenhouse', value: 2 },
    { label: 'hh.ru', value: 1 },
    { label: 'lever', value: 1 },
    { label: 'other', value: 2 },
  ]);
});

test('gradeSalaryItems: REAL RoleStats parser → median USD per grade in ladder order', () => {
  const parseSalaryUSD = realParseSalaryUSD();
  const { gradeSalaryItems } = runFns(['gradeSalaryItems']);
  const jobs = [
    { title: 'Senior Backend Engineer', salary: '$180,000' },
    { title: 'senior engineer', salary: '$220,000' },
    { title: 'Junior Dev', salary: '$60k' },
    { title: 'Lead Platform', salary: '$90,000' },
    { title: 'intern', salary: '$20k' },
    { title: 'Mystery Role', salary: '$150,000' },  // no grade → dropped
    { title: 'Senior No Pay' },                     // no salary → dropped
    { title: 'Senior Garbage', salary: 'competitive' }, // unparseable → dropped
  ];
  const seniorityOf = (t) => (/senior/i.test(t) ? 'senior' : /junior/i.test(t) ? 'junior' : /lead/i.test(t) ? 'lead' : /intern/i.test(t) ? 'intern' : null);
  const labelFor = (g) => ({ senior: 'Senior', junior: 'Junior', lead: 'Lead', intern: 'Intern' }[g] || g);
  const items = gradeSalaryItems(jobs, { parseSalaryUsd: parseSalaryUSD, seniorityOf, labelFor });
  assert.deepEqual(host(items.map((i) => i.label)), ['Lead', 'Senior', 'Junior', 'Intern'],
    'ladder order (lead, staff, senior, mid, junior, intern), empty grades dropped');
  const senior = items.find((i) => i.label === 'Senior');
  assert.equal(senior.value, 200000, 'median of the grade’s USD midpoints (real parser)');
  assert.equal(senior.n, 2);
});

test('gradeSalaryItems: a min-only range never becomes half a median (Opus r2 finding 2)', () => {
  const { gradeSalaryItems } = runFns(['gradeSalaryItems']);
  const jobs = [{ title: 'Senior Dev', salary: 'from $120k' }];
  const items = gradeSalaryItems(jobs, {
    // A «from $120k»-style parser result: only minUsd is meaningful.
    parseSalaryUsd: () => ({ minUsd: 120000 }),
    seniorityOf: () => 'senior',
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].value, 120000, 'min-only → the min itself, never (min+0)/2 = $60k');
  assert.equal(items[0].n, 1);
});

test('velocityItems: stage hops keep from/to/value — labels are localized by the view', () => {
  const { velocityItems } = runFns(['velocityItems']);
  const velocity = {
    appliedToResponded: { from: 'Applied', to: 'Responded', median: 9, p75: 20, n: 12, censored: 3 },
    respondedToInterview: { from: 'Responded', to: 'Interview', median: 14, p75: 30, n: 4, censored: 1 },
    interviewToOffer: { from: 'Interview', to: 'Offer', median: null, n: 0, censored: 2 },
  };
  assert.deepEqual(host(velocityItems(velocity)), [
    { from: 'Applied', to: 'Responded', value: 9 },
    { from: 'Responded', to: 'Interview', value: 14 },
  ], 'raw English stage names must not be baked into the helper');
  // The view maps them through the existing track.status.* keys.
  assert.match(STATS, /'track\.status\.' \+ String\(/, 'stage labels go through track.status.*');
});

// ── tab structure ─────────────────────────────────────────────────────────────

test('Overview is the FIRST tab; the LLM market report is LAST and separated', () => {
  const ids = [...STATS.matchAll(/\{ id: '([a-z]+)', label:/g)].map((m) => m[1]);
  assert.ok(ids.length >= 9, `expected ≥ 9 tabs, got ${ids.join(',')}`);
  assert.equal(ids[0], 'overview', 'the Overview tab must be first');
  assert.equal(ids[ids.length - 1], 'market', 'the LLM market report must be its own LAST tab');
  assert.match(STATS, /v2-stats-tabsep/, 'a divider separates the LLM tab from the data tabs');
  assert.match(STATS, /v2-stats-scroller/, 'the tab row scrolls horizontally');
  assert.match(STATS, /v2-stats-strip/, 'the strip carries the v2 class');
});

test('activate() scrolls the selected tab into view (Opus r2 finding 11)', () => {
  assert.match(STATS, /scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/,
    'programmatic/deep-linked activation must reveal the tab in the scroller');
});

// ── BEHAVIORAL: render the Overview tab for real (Opus r2 finding 7) ─────────

// Minimal DOM shim — just the surface stats.js's render path touches.
function makeDoc() {
  const els = [];
  function makeEl(tag, ns) {
    const el = {
      tagName: String(tag).toUpperCase(),
      namespaceURI: ns || null,
      style: {},
      children: [],
      attributes: {},
      listeners: {},
      parentNode: null,
      ownerDocument: null,
      textContent: '',
      _classes: new Set(),
      classList: null, // wired right after creation (needs el)
      setAttribute(k, v) {
        this.attributes[k] = String(v);
        if (k === 'class') String(v).split(/\s+/).forEach((c) => c && this._classes.add(c));
      },
      getAttribute(k) {
        if (k === 'class') return this._classes.size ? [...this._classes].join(' ') : null;
        return k in this.attributes ? this.attributes[k] : null;
      },
      appendChild(ch) { if (ch && ch.nodeType !== 3) { this.children.push(ch); ch.parentNode = this; } return ch; },
      removeChild(ch) { const i = this.children.indexOf(ch); if (i >= 0) this.children.splice(i, 1); return ch; },
      addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      removeEventListener() {},
      querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }; },
      scrollIntoView() {},
      focus() {},
      contains() { return false; },
    };
    Object.defineProperty(el, 'className', {
      get: () => [...el._classes].join(' '),
      set: (v) => { el._classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
    });
    el.classList = {
      add: (...cls) => cls.forEach((c) => el._classes.add(c)),
      remove: (...cls) => cls.forEach((c) => el._classes.delete(c)),
      contains: (c) => el._classes.has(c),
    };
    els.push(el);
    return el;
  }
  return {
    els,
    createElementNS: (ns, tag) => makeEl(tag, ns),
    createElement: (tag) => makeEl(tag),
  };
}

function walk(el, fn) {
  if (!el) return;
  fn(el);
  for (const ch of el.children || []) walk(ch, fn);
}

function treeText(root) {
  let out = '';
  walk(root, (el) => { out += (el.textContent || '') + '\n'; });
  return out;
}

function svgs(root) {
  const found = [];
  walk(root, (el) => { if (el.tagName === 'SVG' && el.attributes.role) found.push(el); });
  return found;
}

const FIXTURES = {
  '/api/tracker': {
    rows: [
      { num: 1, company: 'Acme', role: 'Senior Backend Engineer', score: '4.2/5', status: 'Evaluated', date: '2026-10-01' },
      { num: 2, company: 'acme', role: 'Platform Engineer', score: '3.1/5', status: '**Applied**', date: '2026-10-05' },
      { num: 3, company: 'Beta', role: 'Senior Backend Engineer', score: '2.5/5', status: 'aplicado', date: '2026-10-12' },
      { num: 4, company: 'Beta', role: 'Senior Backend Engineer', score: 'N/A', status: '', date: '' },
      { num: 5, company: 'Gamma', role: 'Backend Engineer', score: '1.5/5', status: 'Interview', date: '2026-10-14' },
    ],
  },
  '/api/tracker/stages': { aliases: { aplicado: 'Applied', applied: 'Applied' } },
  '/api/scan-results': {
    en: { filtered: [
      { title: 'Senior Backend Engineer', company: 'Acme', source: 'greenhouse', date: '2026-10-20T09:00:00Z', location: 'Berlin, Germany', salary: '$120,000', url: 'https://boards.greenhouse.io/acme/jobs/1' },
      { title: 'Senior Platform Engineer', company: 'Beta', source: 'ashby', date: '2026-10-21T09:00:00Z', location: 'Remote', salary: '€90.000', url: 'https://jobs.ashbyhq.com/beta/2' },
      { title: 'Backend Engineer', company: 'Gamma', source: '', date: '2026-10-22T09:00:00Z', location: 'Warsaw, Poland', salary: '', url: 'https://jobs.lever.co/gamma/3' },
      { title: 'Junior Dev', company: 'Delta', source: 'hh.ru', date: '2026-10-23T09:00:00Z', location: 'Москва', salary: 'от 100 000 руб', url: 'https://hh.ru/vacancy/4' },
    ] },
    ru: { filtered: [] },
  },
  '/api/profile': { summary: { target_roles: ['Senior Backend Engineer'] } },
  '/api/stats/funnel': {
    available: true,
    velocity: {
      appliedToResponded: { from: 'Applied', to: 'Responded', median: 1, p75: 20, n: 12, censored: 3 },
      respondedToInterview: { from: 'Responded', to: 'Interview', median: 5, p75: 30, n: 4, censored: 1 },
    },
  },
};

/** Boot the whole view in a vm with stubbed API/UI/I18n + the real libs. */
async function renderOverviewWith(fixtures, lang = 'en') {
  const doc = makeDoc();
  const registered = {};
  const tKeys = [];
  const sandbox = {
    document: doc,
    console,
    Intl,    Router: {
      register: (id, fn) => { registered[id] = fn; },
      go: () => {},
    },
    API: { get: (url) => Promise.resolve(JSON.parse(JSON.stringify(fixtures[url] ?? {}))) },
    UI: { el: (tag, attrs, children) => {
      const node = doc.createElement(tag);
      for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null) continue;
        if (k === 'className') node.className = v;
        else if (k === 'style') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      }
      const kids = children == null ? [] : (Array.isArray(children) ? children : [children]);
      for (const ch of kids) {
        if (ch == null) continue;
        if (typeof ch === 'string' || typeof ch === 'number') {
          const t = doc.createElement('#text'); t.textContent = String(ch); node.appendChild(t);
        } else node.appendChild(ch);
      }
      return node;
    } },
    I18n: {
      // Dict-aware: the real EN table is loaded into the vm below, so
      // ovDay_* / track.status.* resolve to their actual strings (the plural
      // selection is proven against the shipped dict, not the inline fallback).
      t: (k, f) => {
        tKeys.push(k);
        const d = sandbox.window.__I18N_DICT_EN;
        if (d && typeof d[k] === 'string') return d[k];
        return f === undefined ? k : f;
      },
      getLang: () => lang,
    },
  };
  const ctx = vm.createContext(sandbox);
  // The view reads RoleStats/JobFacets/TrackerStages both as window.* AND as
  // bare globals (in the browser `window` IS the global scope). Make the vm's
  // `window` be the actual global, so the classic-script libs register both.
  vm.runInContext('var window = globalThis;', ctx);
  // The real EN dictionary (before the view, mirroring the browser order).
  vm.runInContext(readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'locales', 'i18n-dict.en.js'), 'utf8'), ctx);
  // The real client libs, in index.html load order.
  vm.runInContext(SKILLS, ctx);
  vm.runInContext(ROLE_STATS, ctx);
  vm.runInContext(JOB_FACETS, ctx);
  vm.runInContext(TRACKER_STAGES, ctx);
  vm.runInContext(STATS, ctx);
  assert.ok(registered.stats, 'the view must register the stats route');
  const root = await registered.stats();
  return { root, doc, tKeys };
}

test('BEHAVIORAL: the Overview renders ≥ 6 real charts from fixture data', async () => {
  const { root } = await renderOverviewWith(FIXTURES);
  const charts = svgs(root);
  assert.ok(charts.length >= 6, `expected ≥ 6 rendered svg[role] charts, got ${charts.length}`);
  const text = treeText(root);
  for (const title of ['Status funnel', 'Score distribution', 'Top companies', 'Vacancies by country', 'Vacancies by source', 'Postings by week', 'Median salary by grade', 'Time between stages']) {
    assert.ok(text.includes(title), `section missing from the render: ${title}`);
  }
  // The funnel folds through the alias map: 2 Applied-family rows land in one bucket.
  const funnelSvg = charts.find((s) => treeText(s).includes('Evaluated'));
  assert.ok(funnelSvg, 'the funnel chart rendered');
});

test('BEHAVIORAL: empty fixtures → the honest empty state, zero charts', async () => {
  const { root } = await renderOverviewWith({});
  assert.equal(svgs(root).length, 0, 'no data → no invented charts');
  const text = treeText(root);
  assert.match(text, /No scan data yet/, 'the empty state must render');
  assert.doesNotMatch(text, /Median salary by grade/, 'no salary section without data');
});

test('BEHAVIORAL: scan-only data renders charts but NO click hint (nothing clickable)', async () => {
  const { root } = await renderOverviewWith({
    '/api/scan-results': FIXTURES['/api/scan-results'],
    '/api/profile': FIXTURES['/api/profile'],
  });
  assert.ok(svgs(root).length >= 3, 'scan charts render');
  assert.doesNotMatch(treeText(root), /Click a bar to open those postings in Scan/,
    'the hint must not promise a click that does nothing');
});

test('BEHAVIORAL: the click hint renders exactly when a clickable chart rendered', async () => {
  const { root, tKeys } = await renderOverviewWith(FIXTURES);
  const text = treeText(root);
  const matches = text.match(/Click a bar to open those postings in Scan/g) || [];
  assert.equal(matches.length, 1, 'the hint renders once, destination folded into the string');
  assert.ok(tKeys.includes('stats.ovClickHintScan'), 'the hint text is the localized key (not a suffix)');
  assert.ok(!tKeys.includes('stats.ovClickHint'), 'the old suffix-style hint key is gone');
});

test('BEHAVIORAL: clickable bars are keyboard-operable (Opus r2 finding 4)', async () => {
  const { root } = await renderOverviewWith(FIXTURES);
  const clickable = svgs(root).find((s) => s.attributes.role === 'group');
  assert.ok(clickable, 'a chart with onItemClick flips svg role=img → group so children stay in the a11y tree');
  const links = [];
  walk(clickable, (el) => { if (el.attributes.role === 'link') links.push(el); });
  assert.ok(links.length >= 3, 'each bar is a link');  for (const g of links.slice(0, 3)) {
    assert.equal(g.attributes.tabindex, '0', 'tab-reachable');
    assert.ok(g.attributes['aria-label'], 'named for screen readers');
    assert.ok((g.listeners.keydown || []).length === 1, 'Enter/Space handler registered');
    assert.ok((g.listeners.click || []).length === 1, 'click handler registered');
    // fire the keydown → the scan prefill handoff must run (no throw)
    const fn = g.listeners.keydown[0];
    fn({ key: 'Enter', preventDefault: () => {} });
  }
});

test('BEHAVIORAL: stage-hop labels go through track.status.* and days pluralize (finding 10)', async () => {
  const { root, tKeys } = await renderOverviewWith(FIXTURES);
  assert.ok(tKeys.includes('track.status.applied'), 'from/to mapped through the existing stage-label keys');
  assert.ok(tKeys.includes('track.status.responded'));
  // median 1 → PluralRules('en').select(1) = 'one'; median 5 → 'other'.
  assert.ok(tKeys.includes('stats.ovDay_one'), 'Intl.PluralRules picks the per-form day key');
  assert.ok(tKeys.includes('stats.ovDay_other'));
  assert.ok(!tKeys.includes('stats.ovDays'), 'the old non-plural day key is gone');
  assert.match(treeText(root), /1 day\b/, 'the {n} placeholder is replaced (singular, not "1 days")');
  assert.match(treeText(root), /5 days\b/);
});

test('BEHAVIORAL: funnel empty-state branches on available (Opus r2 finding 6)', async () => {
  // available:true but no uncensored medians → "not enough replies", NOT the parent-project message.
  const a = await renderOverviewWith({
    '/api/stats/funnel': { available: true, velocity: {} },
  });
  assert.match(treeText(a.root), /Not enough replies yet/);
  assert.doesNotMatch(treeText(a.root), /needs the parent career-ops project/);
  // available:false → the relay really is absent → the parent-project message.
  const b = await renderOverviewWith({
    '/api/stats/funnel': { available: false },
  });
  assert.match(treeText(b.root), /needs the parent career-ops project/);
});

// ── barChart a11y / tooltips / animation ──────────────────────────────────────

test('barChart: role=img + localized aria-label, per-bar <title> tooltip, clickable option', () => {
  const chart = sliceFn(STATS, 'function barChart');
  assert.match(chart, /setAttribute\('role', 'img'\)/);
  assert.match(chart, /setAttribute\('aria-label'/, 'the chart carries an accessible summary');
  assert.match(chart, /createElementNS\(SVGNS, 'title'\)/, 'native <title> tooltips stay');
  assert.match(chart, /onItemClick/, 'an optional click handler enables filter-drilldown');
  assert.match(chart, /svg\.style\.direction = 'ltr';/, 'RTL-safe (pinned LTR svg)');
  assert.match(chart, /role', 'group'/, 'clickable charts drop role=img so links stay in the a11y tree');
  assert.match(chart, /'keydown'/, 'Enter/Space activates a focused bar');
  // click-to-filter into #/scan exists for the companies chart
  assert.match(STATS, /__scanSearchPrefill/, 'bar click hands the label to the scan search prefill');
  assert.match(STATS, /Router\.go\('\/scan'\)/);
});

test('CSS: one-line scroll strip with fade edges + 300 ms entrance animation (reduced-motion off)', () => {
  assert.match(OVERLAYS, /\.v2-stats-strip \{[^}]*flex-wrap:\s*nowrap/, 'strip never wraps');
  assert.match(OVERLAYS, /\.v2-stats-scroller \{[^}]*overflow-x:\s*auto/, 'scroller scrolls');
  assert.match(OVERLAYS, /\.v2-stats-scroller \{[^}]*mask-image:/, 'fade edges via mask');
  assert.match(OVERLAYS, /@keyframes v2-stats-rise/);
  assert.match(OVERLAYS, /\.v2-stats-anim \{[^}]*v2-stats-rise[^}]*300ms/, 'entrance animation ≈300 ms');
  assert.match(OVERLAYS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.v2-stats-anim \{[^}]*animation:\s*none/, 'reduced-motion disables the animation');
  assert.match(OVERLAYS, /\.v2-stats-bar:focus-visible/, 'keyboard-focused bars are visible');
  // CSS ownership: the v2-stats block lives ONLY in overlays.css
  assert.doesNotMatch(APPCSS, /v2-stats-/, 'app.css must stay untouched (car115 owns it)');
});

// ── i18n discipline ───────────────────────────────────────────────────────────

test('new CAR-120 strings ship with EN fallbacks (and in all 19 dicts — see the dict test)', () => {
  const pairs = [
    ['stats.tabOverview', 'Overview'],
    ['stats.ovVacanciesBySource', 'Vacancies by source'],
    ['stats.ovPostingsByWeek', 'Postings by week'],
    ['stats.ovSalaryByGrade', 'Median salary by grade'],
    ['stats.ovStageVelocity', 'Time between stages'],
    ['stats.ovClickHintScan', 'Click a bar to open those postings in Scan'],
    ['stats.ovVelocityEmpty', 'Not enough replies yet'],
  ];
  for (const [k, en] of pairs) {
    assert.match(STATS, new RegExp(`t\\('${k.replace(/\./g, '\\.')}', '${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      `${k} must carry its EN fallback inline`);
  }
  // reused localized grade labels come from the existing scan facet keys
  assert.match(STATS, /scan\.sen\.\$\{g\}|'scan\.sen\.' \+ g/, 'grade axis labels reuse scan.sen.*');
});

test('every CAR-120 dict key exists in ALL 19 locale files (Opus r2 finding 1)', () => {
  const LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
  const KEYS = [
    'stats.tabOverview', 'stats.ovVacanciesBySource', 'stats.ovPostingsByWeek',
    'stats.ovSalaryByGrade', 'stats.ovStageVelocity', 'stats.ovClickHintScan',
    'stats.ovVelocityEmpty', 'stats.hint.overview',
    'stats.ovDay_zero', 'stats.ovDay_one', 'stats.ovDay_two',
    'stats.ovDay_few', 'stats.ovDay_many', 'stats.ovDay_other',
  ];
  const missing = [];
  for (const loc of LOCALES) {
    const src = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'locales', `i18n-dict.${loc}.js`), 'utf8');
    for (const k of KEYS) {
      if (!src.includes(`'${k}'`)) missing.push(`${loc}: ${k}`);
    }
  }
  assert.deepEqual(missing, [], 'dict fan-out incomplete: ' + missing.join(', '));
});
