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
 * appended `v2-dash-` rules in public/css/overlays.css:
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

const __d = dirname(fileURLToPath(import.meta.url));
const DASH = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'dashboard.js'), 'utf8');
const OVERLAYS = readFileSync(resolve(__d, '..', 'public', 'css', 'overlays.css'), 'utf8');

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

test('CAR-114: the primary CTA is marked aria-current within the CTA group', () => {
  assert.match(DASH, /aria-current/,
    'the active/primary CTA must carry aria-current so AT users hear which action is primary');
});

test('CAR-114: a localized greeting leads the hero', () => {
  assert.match(DASH, /v2-dash-greeting/, 'the hero must open with a greeting line');
  // The greeting is a genuinely NEW string (no dict key may be added by this
  // epic — the orchestrator fans out ×19 later) → it must carry the marker.
  assert.match(DASH, /CAR-114 i18n:/, 'new EN-only strings must carry the // CAR-114 i18n: marker');
});

// ── 2 · Status funnel ────────────────────────────────────────────────────────

test('CAR-114: a status funnel strip replaces the flat status chips', () => {
  assert.match(DASH, /v2-dash-funnel/, 'the funnel strip container must exist');
  assert.match(DASH, /v2-dash-fstep/, 'each funnel step must be a styled step');
});

test('CAR-114: the funnel folds REAL counts through the canonical stage map', () => {
  assert.match(DASH, /\/api\/tracker\/stages/,
    'the funnel must reuse GET /api/tracker/stages (canonical labels + alias fold)');
  assert.match(DASH, /TrackerStages\.foldStatus/,
    'folding must go through window.TrackerStages.foldStatus — never a client-side whitelist');
  // No invented endpoint: only the two sanctioned dashboard data sources
  // plus the stages map.
  assert.ok(!/\/api\/tracker\?/.test(DASH), 'no full-tracker fetch invented for the funnel');
});

test('CAR-114: the funnel renders conversions between steps', () => {
  assert.match(DASH, /v2-dash-fconv/, 'a conversion chip must render between funnel steps');
});

// ── 3 · KPI tiles: Intl separators, count-up, trend delta ───────────────────

test('CAR-114: KPI numbers are formatted with Intl.NumberFormat in the ACTIVE locale', () => {
  assert.match(DASH, /Intl\.NumberFormat\(/, 'numbers must be locale-formatted');
  assert.match(DASH, /I18n\.getLang\(\)/, 'the formatter must use the active UI locale');
});

test('CAR-114: KPI values count up on first paint, static under reduced motion', () => {
  assert.match(DASH, /requestAnimationFrame/, 'count-up must be rAF-driven');
  // The reduced-motion gate must sit BEFORE the animation loop starts.
  const gate = DASH.indexOf('prefers-reduced-motion');
  const raf = DASH.indexOf('requestAnimationFrame');
  assert.ok(gate > -1 && raf > gate,
    'prefers-reduced-motion must be consulted before any rAF animation is scheduled');
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
  assert.match(DASH, /if \(typeof __dashV2Cleanup === 'function'\) __dashV2Cleanup\(\)/,
    'a re-render must tear down the previous visit\u2019s listeners first');
  assert.match(DASH, /removeEventListener\('pointermove'/, 'pointer listener must detach');
  assert.match(DASH, /removeEventListener\('scroll'/, 'scroll listener must detach');
  // Drift is bounded (≤ 16px) so text contrast over the planes is unaffected.
  assert.match(DASH, /Math\.min\([^)]*16/, 'the drift must be clamped to ≤ 16px');
});

test('CAR-114: reduced motion ⇒ no parallax listeners, static planes', () => {
  assert.match(DASH, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/,
    'the parallax setup must consult the reduced-motion media query');
  // The listeners may only be attached inside the non-reduced branch.
  const gate = DASH.indexOf("matchMedia('(prefers-reduced-motion: reduce)')");
  const attach = DASH.indexOf("addEventListener('pointermove'");
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

test('CAR-114: overlays.css (at the 800-LOC ceiling) owns only planes, delta chips, reduced motion', () => {
  // The stylesheet tail is minimal by necessity (css-modularization gate);
  // everything structural is inline in dashboard.js — asserted separately below.
  for (const cls of ['v2-dash-planes', 'v2-dash-plane', 'v2-dash-delta']) {
    assert.ok(OVERLAYS.includes(cls), `overlays.css must style .${cls}`);
  }
  for (const cls of ['v2-dash-hero', 'v2-dash-split', 'v2-dash-funnel', 'v2-dash-fstep',
    'v2-dash-greeting', 'v2-dash-fconv']) {
    assert.ok(DASH.includes(cls), `dashboard.js must carry .${cls} (inline-styled structure)`);
  }
  // Ownership rule: the appended tail may not restyle unprefixed selectors.
  const tail = OVERLAYS.slice(OVERLAYS.indexOf('CAR-114'));
  for (const m of tail.matchAll(/(^|\n)\s*([.a-zA-Z@][^{\n]*)\{/g)) {
    const sel = m[2].trim();
    if (sel.startsWith('@') || sel.startsWith('/*')) continue;
    assert.ok(sel.includes('v2-dash-'),
      `appended rule "${sel}" must be prefixed v2-dash- (file-ownership contract)`);
  }
});

test('CAR-114: the appended layer neutralizes its own motion under prefers-reduced-motion', () => {
  const tail = OVERLAYS.slice(OVERLAYS.indexOf('CAR-114'));
  // The media block is a single dense line (LOC ceiling) — match within it.
  assert.match(tail, /@media \(prefers-reduced-motion: reduce\) \{.*v2-dash-plane \{ transition: none; transform: none !important;.*animation: none/,
    'planes must be static under reduced motion');
});

test('CAR-114: no bare z-index literals in the appended CSS (D-4 token gate)', () => {
  const tail = OVERLAYS.slice(OVERLAYS.indexOf('CAR-114'));
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
