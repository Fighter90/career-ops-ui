/**
 * CAR-114 — [UX·Дашборд] Command-center dashboard.
 *
 * The v1.255.2 UX review found the dashboard opening with TWO identical red
 * hero CTAs ("✨ Auto-pipeline a URL" / "🌐 Scan now") — no visual hierarchy —
 * plus a duplicated provider badge (header chip AND hero chip), a flat KPI row
 * with un-separated numbers and no trend, and no view of the status funnel
 * (486 applications all in Evaluated — the single most valuable insight — was
 * reduced to same-weight chips).
 *
 * This suite pins the v2 contract for public/js/views/dashboard.js + the
 * `v2-dash-` rules in the view-owned public/css/v2-dash.css:
 *
 *   1. ONE primary CTA — a split control (primary scan segment + ghost
 *      paste-URL segment), aria-current on the primary, the old twin
 *      red button gone.
 *   2. Status funnel strip — real counts folded through the server's
 *      canonical stage map (GET /api/tracker/stages + TrackerStages.foldStatus),
 *      with conversions between steps. No invented endpoint.
 *   3. KPI tiles — Intl.NumberFormat separators in the ACTIVE locale,
 *      count-up on first paint, and a trend delta ONLY when a previous
 *      client-side snapshot exists (the API ships no history — the delta
 *      is a localStorage snapshot of the previous dashboard load, so the
 *      first visit renders tiles with NO trend rather than a fake one).
 *   4. Parallax hero planes — pointer/scroll drift ≤ 16px, listeners
 *      route-scoped (module-scoped cleanup, CAR-93 discipline), and
 *      everything static under prefers-reduced-motion.
 *   5. Provider de-dup — the global header badge (app.js onboarding
 *      banner) owns provider status; dashboard.js no longer fetches
 *      /api/status/providers (the hero chip was the duplicate).
 *
 * dashboard.js is browser-only → asserted statically (dashboard-hero.test.mjs
 * style). CSS asserted on the appended overlays.css tail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { legacyDictText, I18N_LANGS } from './helpers/i18n-vm.mjs';

const __d = dirname(fileURLToPath(import.meta.url));
const DASH = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'dashboard.js'), 'utf8');
const OVERLAYS = readFileSync(resolve(__d, '..', 'public', 'css', 'overlays.css'), 'utf8');
const DASH_CSS = readFileSync(resolve(__d, '..', 'public', 'css', 'v2-dash.css'), 'utf8');
const STAGES_SRC = readFileSync(resolve(__d, '..', 'public', 'js', 'lib', 'tracker-stages.js'), 'utf8');

// Finding 7 — slice ONE function body by brace counting so ordering
// assertions can't be satisfied by another function's matching line.
function fnSlice(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i === -1) return '';
  let depth = 0, started = false;
  for (let j = src.indexOf('{', i); j < src.length; j++) {
    if (src[j] === '{') { depth++; started = true; }
    else if (src[j] === '}') { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
  }
  return '';
}

// Finding 9 — a validator that actually SEES nested one-line @media rules:
// comments stripped, @media preludes dropped, chunks split on '}' so every
// selector before a '{' (top-level or nested) is inspected.
function v2TailSelectors(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@media[^{]*\{/g, '')
    .split('}')
    .map((chunk) => {
      const i = chunk.indexOf('{');
      return i === -1 ? '' : chunk.slice(0, i).trim();
    })
    .filter(Boolean);
}

// ── 1 · One primary CTA ──────────────────────────────────────────────────────

test('CAR-114: the hero carries exactly ONE primary CTA (the twin red button is gone)', () => {
  const n = DASH.split('btn-primary btn-hero').length - 1;
  assert.equal(n, 1,
    `expected exactly one 'btn-primary btn-hero' in the hero, found ${n} — ` +
    'the competing duplicate red CTA must be demoted to the split ghost segment');
});

test('CAR-114: the primary CTA is a split control with a ghost paste-URL segment', () => {
  assert.match(DASH, /v2-dash-split/, 'the split control container class must exist');
  assert.match(DASH, /v2-dash-split-seg/, 'the ghost segment class must exist');
  // Both journeys stay reachable from the hero (dashboard-hero.test.mjs pins
  // the same two Router.go calls — the split keeps them, one primary one ghost).
  assert.match(DASH, /'🌐 ' \+ t\('dash\.scanNow'/, 'primary segment keeps the scan CTA');
  assert.match(DASH, /'✨ ' \+ t\('dash\.autoPipeline'/, 'ghost segment keeps the paste-URL CTA');
});

test('CAR-114: the hero asserts NO aria-current (finding 10 — it means "current item in a set")', () => {
  // Match the attribute-USAGE form (object key / setAttribute), not prose.
  assert.doesNotMatch(DASH, /['"`]aria-current['"`]/,
    'an action button is not a "current item"; visual weight + DOM order carry the emphasis');
});

test('CAR-114: greeting leads the hero and the four v2 strings live in ALL locales (finding 1)', () => {
  assert.match(DASH, /v2-dash-greeting/, 'the hero must open with a greeting line');
  // No hardcoded-EN bypasses: every new string resolves through t(key, fallback).
  assert.match(DASH, /t\('dash\.greeting'/, 'greeting must go through I18n.t');
  assert.match(DASH, /t\('dash\.funnel\.cta'/, 'funnel CTA must go through I18n.t');
  assert.match(DASH, /t\('dash\.funnel\.summary'/, 'funnel summary must go through I18n.t');
  assert.match(DASH, /t\('dash\.trend\.hint'/, 'trend hint must go through I18n.t');
  assert.ok(!DASH.includes('CAR-114 i18n:'), 'no pending-i18n markers may remain');
  // The keys exist with a real value in every shipped locale (incl. en).
  const DICT = legacyDictText();
  const LOCALES = I18N_LANGS;
  for (const key of ['dash.greeting', 'dash.funnel.cta', 'dash.funnel.summary', 'dash.trend.hint']) {
    const line = DICT.split('\n').find((l) => l.includes(`'${key}'`));
    assert.ok(line, `i18n key ${key} missing from the assembled dict`);
    for (const loc of LOCALES) {
      const tok = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
      assert.ok(line.includes(tok), `${key} missing locale ${loc}`);
    }
  }
});

// ── 2 · Status funnel ────────────────────────────────────────────────────────

test('CAR-114: a status funnel strip replaces the flat status chips', () => {
  assert.match(DASH, /v2-dash-funnel/, 'the funnel strip container must exist');
  assert.match(DASH, /v2-dash-fstep/, 'each funnel step must be a styled step');
});

test('CAR-114: the funnel folds REAL counts through the canonical stage map', () => {
  assert.match(DASH, /\/api\/tracker\/stages/,
    'the funnel must reuse GET /api/tracker/stages (canonical labels + alias fold)');
  assert.match(DASH, /funnelCompute\(/,
    'folding must run through the pure funnelCompute (window.TrackerStages.foldStatus inside)');
  // No invented endpoint: only the two sanctioned dashboard data sources
  // plus the stages map.
  assert.ok(!/\/api\/tracker\?/.test(DASH), 'no full-tracker fetch invented for the funnel');
});

test('CAR-114: the funnel renders conversions between steps', () => {
  assert.match(DASH, /v2-dash-fconv/, 'a conversion chip must render between funnel steps');
  // Finding 3 — conversions come from the cumulative reached counts in
  // funnelCompute, not from adjacent raw counts; the inbox step and the
  // terminal steps carry conv: null.
  const body = fnSlice(DASH, 'funnelSection');
  assert.match(body, /conv: null, inbox: true/, 'the inbox step must carry no conversion');
  assert.match(body, /st\.conv != null/, 'a conversion chip renders only when funnelCompute supplied one');
});

// ── 3 · KPI tiles: Intl separators, count-up, trend delta ───────────────────

test('CAR-114: KPI numbers are formatted with Intl.NumberFormat in the ACTIVE locale', () => {
  assert.match(DASH, /Intl\.NumberFormat\(/, 'numbers must be locale-formatted');
  assert.match(DASH, /I18n\.getLang\(\)/, 'the formatter must use the active UI locale');
});

test('CAR-114: KPI values count up on first paint, static under reduced motion', () => {
  assert.match(DASH, /requestAnimationFrame/, 'count-up must be rAF-driven');
  // Finding 7 — assert INSIDE the countUp body: a global indexOf can match
  // another function's reduced-motion gate (mountParallax's) and pass for
  // the wrong reason.
  const body = fnSlice(DASH, 'countUp');
  assert.ok(body, 'countUp body must be sliceable');
  const gate = body.indexOf("matchMedia('(prefers-reduced-motion: reduce)')");
  const raf = body.indexOf('requestAnimationFrame');
  assert.ok(gate > -1 && raf > gate,
    'prefers-reduced-motion must be consulted before any rAF animation is scheduled (within countUp)');
  // Finding 2 — integer targets never render an animated fraction.
  assert.match(body, /Number\.isInteger\(target\)/, 'the integer guard must sit in the frame');
  const guard = body.indexOf('Number.isInteger(target)');
  const set = body.indexOf('el.textContent = fmt(v)');
  assert.ok(guard > -1 && set > guard, 'the value must be rounded/toFixed-ed BEFORE it is formatted');
});

test('CAR-114: KPI trend delta comes from a previous client-side snapshot — absent on first visit', () => {
  assert.match(DASH, /career-ops-ui:dash-snapshot/,
    'the snapshot key must be namespaced like the other localStorage prefs');
  // The API provides no history (do NOT invent an endpoint) — the delta may
  // only render when a previous snapshot exists.
  const gate = DASH.indexOf('career-ops-ui:dash-snapshot');
  const deltaUse = DASH.indexOf('v2-dash-delta');
  assert.ok(gate > -1 && deltaUse > -1 && deltaUse > gate,
    'the delta chip must be derived from the stored previous snapshot');
});

// ── 4 · Parallax hero ────────────────────────────────────────────────────────

test('CAR-114: parallax planes drift via pointer/scroll with a route-scoped cleanup', () => {
  assert.match(DASH, /v2-dash-plane/, 'at least one parallax plane must exist');
  assert.match(DASH, /__dashV2Cleanup/,
    'the parallax listeners must use the CAR-93 module-scoped cleanup discipline');
  // Finding 6 — the previous visit's cleanup runs BEFORE the early returns,
  // sliced INSIDE the mountParallax body (finding 7 — no global indexOf).
  const body = fnSlice(DASH, 'mountParallax');
  assert.ok(body, 'mountParallax body must be sliceable');
  const cleanup = body.indexOf('if (typeof __dashV2Cleanup === \'function\') __dashV2Cleanup();');
  const reduced = body.indexOf("matchMedia('(prefers-reduced-motion: reduce)')");
  assert.ok(cleanup > -1 && reduced > cleanup,
    'the cleanup must run before the reduced-motion early return');
  assert.match(body, /removeEventListener\('pointermove'/, 'pointer listener must detach');
  assert.match(body, /removeEventListener\('scroll'/, 'scroll listener must detach');
  // Drift is bounded (≤ 16px) so text contrast over the planes is unaffected.
  assert.match(body, /Math\.min\([^)]*16/, 'the drift must be clamped to ≤ 16px');
  // Finding 5 — a pending frame is cancelled on detach.
  assert.match(body, /cancelAnimationFrame\(raf\)/, 'detach must cancel a pending rAF');
});

test('CAR-114: reduced motion ⇒ no parallax listeners, static planes', () => {
  // Finding 7 — the ordering is asserted inside the mountParallax body.
  const body = fnSlice(DASH, 'mountParallax');
  const gate = body.indexOf("matchMedia('(prefers-reduced-motion: reduce)')");
  const attach = body.indexOf("addEventListener('pointermove'");
  assert.ok(gate > -1 && attach > gate,
    'pointermove must be attached AFTER the reduced-motion check passes');
});

// ── 5 · Provider de-dup ──────────────────────────────────────────────────────

test('CAR-114: dashboard.js no longer duplicates the header provider badge', () => {
  // The global onboarding banner (app.js) already shows "Live eval: <provider>"
  // on every page; the hero chip was the duplicate the UX review flagged.
  assert.ok(!/\/api\/status\/providers/.test(DASH),
    'dashboard.js must not fetch /api/status/providers — the header badge owns provider status');
  assert.ok(!/providerChip/.test(DASH), 'the hero providerChip helper must be gone');
});

// ── CSS: the appended v2-dash- layer ─────────────────────────────────────────

test('CAR-114: the view-owned v2-dash.css owns only planes, delta chips, reduced motion', () => {
  // The stylesheet tail is minimal by necessity (css-modularization gate);
  // everything structural is inline in dashboard.js — asserted separately below.
  for (const cls of ['v2-dash-planes', 'v2-dash-plane', 'v2-dash-delta']) {
    assert.ok(DASH_CSS.includes(cls), `v2-dash.css must style .${cls}`);
  }
  for (const cls of ['v2-dash-hero', 'v2-dash-split', 'v2-dash-funnel', 'v2-dash-fstep',
    'v2-dash-greeting', 'v2-dash-fconv']) {
    assert.ok(DASH.includes(cls), `dashboard.js must carry .${cls} (inline-styled structure)`);
  }
  // Finding 9 — the validator sees INSIDE the one-line @media block too.
  const tail = DASH_CSS;
  const sels = v2TailSelectors(tail);
  assert.ok(sels.length >= 5, `the validator must find the nested selectors (found ${sels.length})`);
  assert.ok(sels.includes('.v2-dash-plane') && sels.includes('.v2-dash-delta'),
    'the nested @media selectors must be inspected, not skipped');
  for (const sel of sels) {
    assert.ok(sel.includes('v2-dash-'),
      `appended rule "${sel}" must be prefixed v2-dash- (file-ownership contract)`);
  }
});

test('CAR-114: the ownership validator catches violations inside @media (self-probe)', () => {
  // The old line-based regex was blind to nested selectors — pin the fix by
  // proving the validator surfaces a violation hidden in a media block.
  const sels = v2TailSelectors('@media (prefers-reduced-motion: reduce) { .evil { transform: none; } }');
  assert.deepEqual(sels, ['.evil'], 'a nested unprefixed selector must be surfaced');
});

test('CAR-114: the appended layer neutralizes its own motion under prefers-reduced-motion', () => {
  const tail = DASH_CSS;
  // The media block is a single dense line (LOC ceiling) — match within it.
  assert.match(tail, /@media \(prefers-reduced-motion: reduce\) \{.*v2-dash-plane \{ transition: none; transform: none !important;.*animation: none/,
    'planes must be static under reduced motion');
});

test('CAR-114: no bare z-index literals in the appended CSS (D-4 token gate)', () => {
  const tail = DASH_CSS;
  assert.doesNotMatch(tail, /z-index:\s*\d/,
    'layering must come from DOM order + position (no magic z-index numbers)');
});

// ── Kept contracts (regression guards for the refactor itself) ──────────────

test('CAR-114: kept contracts — refresh, QA counts, pipeline guard, statusClass, focal hint', () => {
  assert.match(DASH, /data-test':\s*'dash-refresh'/, 'the header Refresh keeps its test hook');
  assert.match(DASH, /QA_COUNTS/, 'quick-action live counts kept');
  assert.match(DASH, /function pipelineCard\(urls\)/, 'the pipeline card (http-only anchors) kept');
  assert.match(DASH, /function statusClass\(/, 'statusClass stays (CAR-93 F11)');
  assert.match(DASH, /t\('dash\.lastEval'/, 'the focal last-evaluation hint stays');
  assert.match(DASH, /t\('dash\.heroNoEval'/, 'the cold-start hint stays');
  assert.match(DASH, /metric\(t\('dash\.avgScore'\), data\.avgScore \?\? '—', '\/ 5\.0', scoreClass\(data\.avgScore\), true[,)]/,
    'the LTR-isolated avg-score metric call keeps its shape (design-qa-v1246)');
});

// ── Behavioural suite (findings 2–6, 11, 12) — dashboard.js in a vm ─────────
// dashboard.js is a classic script: loaded in a sandbox it registers nothing
// and only needs stubs at RUN time, so the pure helpers (funnelCompute,
// trendDelta, deltaChip, snapshotShouldRoll, countUp, mountParallax) are
// driven for real instead of grepped.

function loadDash(stubs = {}) {
  const store = new Map(Object.entries(stubs.store || {}));
  const sandbox = {
    Router: { register() {} },
    TrackerStages: undefined,
    Intl, Math, Date, JSON, Set, Object, Array, String, Number, Boolean,
    isFinite, console,
    performance: { now: () => stubs.now ?? 0 },
    requestAnimationFrame: (cb) => { stubs.rafCb = cb; return (stubs.rafId = (stubs.rafId || 0) + 1); },
    cancelAnimationFrame: (id) => { stubs.cancelled = [...(stubs.cancelled || []), id]; },
    location: { hash: '#/dashboard' },
  };
  sandbox.__stubs = stubs; // the tests drive the captured rAF callbacks
  sandbox.window = sandbox; // classic script: window IS the global
  // Minimal UI.el stand-in: enough for deltaChip's className/children shape.
  sandbox.UI = {
    el: (tag, attrs, children) => ({
      tag,
      attrs: attrs || {},
      children: children == null ? [] : [].concat(children).filter((x) => x != null),
    }),
  };
  sandbox.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    _store: store,
  };
  sandbox.matchMedia = stubs.matchMedia || (() => ({ matches: false }));
  // Scalar window globals used at runtime (e.g. scrollY for the parallax).
  for (const [k, v] of Object.entries(stubs)) {
    if (typeof v !== 'function' && !(k in sandbox)) sandbox[k] = v;
  }
  if (stubs.TrackerStages !== false) {
    runInNewContext(STAGES_SRC, { window: sandbox.window });
  }
  runInNewContext(DASH, sandbox);
  return sandbox;
}

const STAGES = ['Evaluated', 'Applied', 'Responded', 'Assessment', 'Interview', 'Offer', 'Hired', 'Rejected', 'Discarded', 'SKIP'];
const ALIASES = Object.fromEntries(STAGES.map((s) => [s.toLowerCase(), s]));

test('CAR-114 finding 3: conversions come from cumulative reached counts, never raw adjacent counts', () => {
  const { funnelCompute } = loadDash();
  // Realistic mixed snapshot: 480 evaluated, 3 applied, 1 interview, 4 rejected.
  const fc = funnelCompute(
    { Evaluated: 478, '**Evaluated**': 2, Applied: 3, Interview: 1, Rejected: 4 },
    STAGES, ALIASES);
  const byKey = Object.fromEntries(fc.steps.map((s) => [s.key, s]));
  // Forward stages only; terminal ones trail with conv/reached null.
  assert.deepEqual(fc.steps.slice(0, 7).map((s) => s.key),
    ['Evaluated', 'Applied', 'Responded', 'Assessment', 'Interview', 'Offer', 'Hired']);
  assert.deepEqual(fc.steps.slice(7).map((s) => [s.key, s.terminal]),
    [['Rejected', true], ['Discarded', true], ['SKIP', true]]);
  // reached(≥Evaluated) = 480+3+0+0+1+0+0 = 484; reached(≥Applied) = 4; ≥Responded = 1…
  assert.equal(byKey.Evaluated.reached, 484);
  assert.equal(byKey.Evaluated.conv, null, 'the first forward step carries no conversion');
  assert.equal(byKey.Applied.reached, 4);
  assert.equal(byKey.Applied.conv, Math.round(4 / 484 * 100) + '%');
  assert.equal(byKey.Responded.conv, Math.round(1 / 4 * 100) + '%');
  assert.equal(byKey.Offer.conv, '0%', 'a reached predecessor with a zero successor is a REAL 0%');
  assert.equal(byKey.Hired.conv, null, 'a zero predecessor yields no conversion at all');
  for (const t of ['Rejected', 'Discarded', 'SKIP']) {
    assert.equal(byKey[t].conv, null, `${t} is terminal — no conversion chip`);
    assert.equal(byKey[t].reached, null, `${t} is outside the cumulative forward path`);
  }
  // The bold-marked raw status folded into Evaluated (never a separate row).
  assert.equal(byKey.Evaluated.n, 480);
});

test('CAR-114 finding 3: the inbox (pipeline) is not a funnel step', () => {
  const { funnelCompute } = loadDash();
  const fc = funnelCompute({ Evaluated: 5 }, STAGES, ALIASES);
  assert.ok(!fc.steps.some((s) => s.key === 'Pipeline'),
    'the pending inbox must never join the tracker funnel math');
});

test('CAR-114 finding 11: empty tracker renders the shared empty state; lowercase raw counts still found', () => {
  const { funnelCompute } = loadDash();
  assert.equal(funnelCompute({}, STAGES, ALIASES).isEmpty, true, 'all-zero ⇒ isEmpty');
  assert.equal(funnelCompute({ Evaluated: 1 }, STAGES, ALIASES).isEmpty, false);
  // Stages map unavailable (stagesInfo fetch failed) + raw lowercase keys:
  // the stall-CTA lookup must still find them (case-insensitive fallback).
  const fc = funnelCompute({ evaluated: 6, applied: 0 }, [], {});
  assert.equal(fc.evaluated, 6, 'lowercase "evaluated" counts toward the CTA');
  assert.equal(fc.applied, 0);
  assert.ok(fc.unknown.some((u) => u.label === 'evaluated' && u.n === 6),
    'the raw status stays visible as an unknown chip');
});

test('CAR-114 finding 4: a fresh snapshot survives Refresh within the roll window', () => {
  const NOW = 1_800_000_000_000;
  const s = loadDash({ now: NOW });
  // First visit — write, refresh 10× in quick succession, baseline intact.
  s.localStorage.setItem('career-ops-ui:dash-snapshot', JSON.stringify({ ts: NOW - 3600_000, applications: 1 }));
  assert.equal(s.snapshotShouldRoll(NOW - 3600_000, NOW), false,
    'a 1 h-old baseline must NOT roll');
  assert.equal(s.snapshotShouldRoll(NOW - 13 * 3600_000, NOW), true,
    'a 13 h-old baseline rolls');
  assert.equal(s.snapshotShouldRoll(undefined, NOW), true, 'no baseline ⇒ write');
  assert.equal(s.snapshotShouldRoll('junk', NOW), true, 'corrupt baseline ⇒ write');
  // The guard is wired into saveSnapshot.
  const body = fnSlice(DASH, 'saveSnapshot');
  assert.match(body, /snapshotShouldRoll\(/, 'saveSnapshot must consult the roll window');
});

test('CAR-114 finding 2: an integer target never renders an animated fraction', () => {
  let now = 0;
  const s = loadDash({ get now() { return now; } });
  const el = { textContent: '' };
  s.countUp(el, 486, (n) => String(n));
  const { rafCb } = s.__stubs;
  assert.equal(typeof rafCb, 'function', 'a frame was scheduled (reduced motion off)');
  // Mid-animation (p≈0.37): raw easing would give 486·0.74 ≈ 360.4.
  now = 220; rafCb(220);
  assert.ok(!el.textContent.includes('.'), `integer target showed a fraction: ${el.textContent}`);
  assert.notEqual(el.textContent, '486', 'mid-animation eases toward the target');
  now = 600; rafCb(600);
  assert.equal(el.textContent, '486', 'the final frame lands exactly on the target');
  // Fractional metric (avgScore) keeps ≤ 2 decimals while animating.
  const el2 = { textContent: '' };
  now = 0;
  s.countUp(el2, 2.87, (n) => String(n));
  now = 220; s.__stubs.rafCb(220);
  const dec = el2.textContent.includes('.') ? el2.textContent.split('.')[1].length : 0;
  assert.ok(dec <= 2, `fractional target may keep ≤ 2 decimals, got ${el2.textContent}`);
});

test('CAR-114 finding 12: delta tone follows metric polarity; avgScore noise is suppressed', () => {
  const s = loadDash({ store: {} });
  // Suppression: a 0.01–0.04 avgScore drift renders NO chip at all.
  s.localStorage.setItem('career-ops-ui:dash-snapshot',
    JSON.stringify({ ts: 0, avgScore: 2.86 }));
  assert.equal(s.trendDelta('avgScore', 2.87), null, '±0.01 on avgScore is noise, not a trend');
  assert.equal(s.trendDelta('avgScore', 3.1), 0.24, 'a real avgScore move still surfaces');
  // Tone: pipeline growth is backlog (bad); applications growth is progress (good).
  s.localStorage._store.set('career-ops-ui:dash-snapshot',
    JSON.stringify({ ts: 0, applications: 10, pipeline: 5 }));
  const up = s.deltaChip(s.trendDelta('applications', 12), 'applications');
  const pipe = s.deltaChip(s.trendDelta('pipeline', 9), 'pipeline');
  assert.match(up.attrs.className, /v2-dash-delta--up/, 'applications ▲ ⇒ good tone');
  assert.match(pipe.attrs.className, /v2-dash-delta--down/, 'pipeline ▲ ⇒ backlog tone (bad)');
  assert.match(up.children[0], /▲/, 'the arrow follows the SIGN regardless of tone');
});

test('CAR-114 findings 5+6: parallax keeps the latest target, splits pointer/scroll, cancels pending rAF, cleans up before early returns', () => {
  const planes = [{ style: {} }, { style: {} }, { style: {} }];
  const listeners = { hero: {}, win: {} };
  const hero = {
    querySelectorAll: () => planes,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    addEventListener: (t, fn) => { listeners.hero[t] = fn; },
    removeEventListener: (t) => { delete listeners.hero[t]; },
  };
  let cancelled = [];
  let reduced = false;
  const s = loadDash({
    matchMedia: () => ({ matches: reduced }),
    scrollY: 800,
  });
  s.requestAnimationFrame = (cb) => { s.__stubs.rafCb = cb; return 42; };
  s.cancelAnimationFrame = (id) => { cancelled.push(id); };
  s.window.addEventListener = (t, fn) => { listeners.win[t] = fn; };
  s.window.removeEventListener = (t) => { delete listeners.win[t]; };

  s.mountParallax(hero);
  assert.equal(typeof listeners.win.scroll, 'function', 'scroll listener attached');
  // Pointer drives dx AND dy; the frame reads the LATEST closure target.
  // clientX=150 ⇒ px=((150/100)−.5)·16=16; clientY=100 ⇒ py=8.
  listeners.hero.pointermove({ clientX: 150, clientY: 100 });
  s.__stubs.rafCb(16);
  assert.match(planes[0].style.transform, /translate3d\(4px,2px,0\)/,
    `depth 4 plane: dx 16→4px, dy 8→2px (got ${planes[0].style.transform})`);
  // Scroll updates dy WITHOUT zeroing the pointer dx (finding 5).
  listeners.win.scroll();
  s.__stubs.rafCb(17); // sy=min(16, 800/40)=16 → dy=clamp(8+16)=16
  assert.match(planes[0].style.transform, /translate3d\(4px,4px,0\)/,
    `scroll keeps the pointer dx (got ${planes[0].style.transform})`);
  // pointerleave resets the pointer pair through the same scheduled frame.
  listeners.hero.pointerleave();
  s.__stubs.rafCb(18);
  assert.match(planes[0].style.transform, /translate3d\(0px,4px,0\)/,
    'leave clears the pointer drift; scroll drift persists until scrolled back');
  // A pending frame is CANCELLED on detach (finding 5). Detach is driven the
  // way the app drives it — leaving the route fires hashchange (the
  // module-scoped handle is a lexical binding, reachable only behaviourally).
  listeners.hero.pointermove({ clientX: 100, clientY: 0 }); // schedules frame id 42
  s.location.hash = '#/scan';
  listeners.win.hashchange();
  assert.deepEqual(cancelled, [42], 'detach cancels the pending rAF');
  assert.equal(listeners.win.scroll, undefined, 'scroll listener detached');
  assert.equal(listeners.win.hashchange, undefined, 'the hashchange detach detaches itself');
  // Finding 6 — after the route left, a re-mount (here under reduced motion)
  // must attach nothing: the cleanup-first line already ran, so no stale
  // listener set can survive a mid-session settings flip.
  reduced = true;
  s.mountParallax(hero);
  assert.equal(listeners.win.scroll, undefined, 'reduced motion ⇒ no listeners');
});
