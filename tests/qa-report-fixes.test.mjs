/**
 * v1.58.0 — regression guards for the external QA report fixes.
 *
 * Browser-only files (api.js, mode-page.js, router.js, views) are
 * asserted statically (the project's router.test/openai-model-selector
 * pattern). checkProfileCustomized is importable → exercised directly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __d = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__d, '..', ...p), 'utf8');

test('BUG-003: UI.md() runs inline() on block-quote lines (bold/code/links render)', () => {
  const src = read('public', 'js', 'api.js');
  // the blockquote replacement must map through inline(), not raw text
  assert.match(src, /<blockquote>'\s*\+\s*block\.split\('\\n'\)\.map\(\(l\)\s*=>\s*inline\(l\.replace/);
});

test('BUG-007/008: UI exposes dismissToast; health view dismisses + reuses button label as modal title', () => {
  const api = read('public', 'js', 'api.js');
  assert.match(api, /function dismissToast\(\)/);
  assert.match(api, /return \{ toast, dismissToast, modal,/);
  const health = read('public', 'js', 'views', 'health.js');
  // v1.58.27 (U-7) introduced an intermediate `const stripped = …` line
  // between `UI.dismissToast()` and `UI.modal(t('health.verify'), …)`
  // in the verify handler. The BUG-007/008 contract is still satisfied:
  // dismissToast runs BEFORE modal, and the title is the localized key,
  // not the hardcoded 'doctor'. Loosen the regex from strict adjacency
  // (\n\s*) to "dismissToast call appears before modal(t('…'))" within
  // a small text window.
  assert.match(health, /UI\.dismissToast\(\);[\s\S]{0,1200}?UI\.modal\(t\('health\.runDoctor'\)/);
  assert.match(health, /UI\.dismissToast\(\);[\s\S]{0,1200}?UI\.modal\(t\('health\.verify'\)/);
  assert.ok(!/UI\.modal\('doctor'/.test(health), "modal title must not be the hardcoded lowercase 'doctor'");
});

test('UX-A14 (v1.59.0): mobile (≤ 420 px) media query addresses dashboard / hero / qa-grid / api-keys / drawer', () => {
  const css = read('public', 'css', 'app.css');
  // The media query block must exist and target ≤ 420 px specifically.
  assert.match(css, /@media \(max-width:\s*420px\)\s*\{/,
    'app.css must declare a @media (max-width: 420px) block');
  // Five known regressions must be addressed within the block.
  const block = css.split('@media (max-width: 420px)')[1] || '';
  // Stop at the next top-level rule so we don't leak into siblings.
  const inside = block.slice(0, block.indexOf('\n}\n') + 2);
  assert.match(inside, /\.card-row\s*\{\s*grid-template-columns:\s*1fr/,
    '.card-row must collapse to 1-up under 420 px');
  assert.match(inside, /\.dash-hero-cta\s*\{[^}]*flex-direction:\s*column/,
    '.dash-hero-cta must stack vertically on mobile');
  assert.match(inside, /\.dash-hero-cta\s+\.btn-hero\s*\{[^}]*width:\s*100%/,
    'hero buttons must stretch full-width on mobile');
  assert.match(inside, /\.page-header\s*\{[^}]*flex-direction:\s*column/,
    '.page-header must stack vertically on mobile');
  assert.match(inside, /\.qa-grid\s*\{[^}]*minmax\(160px,\s*1fr\)/,
    '.qa-grid floor must drop to 160 px on mobile');
});

test('UX-A2 (v1.58.65): ModesForm renders all 5 canonical fields as repeatable line-inputs + prose textareas', () => {
  // The v1.54.3 ModesForm already implemented the field-form, but
  // UX-A2 in the audit assumed it was missing. This lock-test
  // documents the existing capability and prevents a future collapse
  // back to raw markdown:
  //   - All 5 canonical fields are in CANON, in the canonical order.
  //   - Target Roles / Adaptive Framing / Comp Targets are `kind: list`
  //     (repeatable line-inputs).
  //   - Exit Narrative / Location Policy are `kind: prose` (textareas).
  //   - List rows render with × remove + a footer "+ add" button.
  //   - collect() returns the tagged payload the server merges.
  const mf = read('public', 'js', 'lib', 'modes-form.js');
  const expected = [
    { key: 'Target Roles',     kind: 'list' },
    { key: 'Adaptive Framing', kind: 'list' },
    { key: 'Exit Narrative',   kind: 'prose' },
    { key: 'Comp Targets',     kind: 'list' },
    { key: 'Location Policy',  kind: 'prose' },
  ];
  for (const { key, kind } of expected) {
    const re = new RegExp(`key:\\s*'${key.replace(/ /g, ' ')}',\\s*kind:\\s*'${kind}'`);
    assert.match(mf, re, `CANON must list '${key}' as kind: ${kind}`);
  }
  // Repeatable line-inputs (× remove + + add affordance).
  assert.match(mf, /config\.modesRemoveItem/, 'list rows must have × remove with i18n key config.modesRemoveItem');
  assert.match(mf, /onClick:\s*\(\)\s*=>\s*addRow\(''\)/, 'card footer must wire + add row affordance');
  // The collect() contract is tagged {mode: sections, sections}|{mode: markdown, markdown}.
  assert.match(mf, /mode:\s*'sections'/, "collect() must return mode: 'sections' for merge");
  assert.match(mf, /mode:\s*'markdown'/, "collect() must return mode: 'markdown' for rebuild");
});

test('UX-A11 (v1.58.64): es/pt-BR copy polish — English loanwords replaced with native equivalents', () => {
  const dict = legacyDictText();
  // The ES eval.subtitle previously used "fit CV", "Score", "header",
  // "reporte"; the polish replaces them with "ajuste del CV",
  // "Puntaje", "cabecera", "informe" — fewer English calques.
  assert.match(dict, /es:\s*'Análisis canónico A–F:[^']*ajuste del CV[^']*Puntaje y legitimidad en la cabecera del informe/,
    'es eval.subtitle must use ajuste del CV + Puntaje + cabecera + informe');
  // pt-BR analogous polish.
  assert.match(dict, /'pt-BR':\s*'Análise canônica A–F:[^']*aderência do CV[^']*Pontuação e legitimidade no cabeçalho do relatório/,
    'pt-BR eval.subtitle must use aderência do CV + Pontuação + cabeçalho + relatório');
  // pipe.title polish: ES "Pipeline de candidaturas".
  assert.match(dict, /'pipe\.title':\s*\{[^}]*es:\s*'Pipeline de candidaturas'/,
    'es pipe.title must read "Pipeline de candidaturas" (candidate-side perspective)');
});

test('UX-A15 (v1.58.63): dashboard Pipeline tile carries the qa-tile--primary visual weight modifier', () => {
  const dash = read('public', 'js', 'views', 'dashboard.js');
  // The qa() helper must accept a `primary` flag.
  assert.match(dash, /function qa\(icon, labelKey, labelFallback, subKey, subFallback, route, primary\)/,
    'qa() must accept a 7th positional `primary` flag');
  assert.match(dash, /qa-tile' \+ \(primary \? ' qa-tile--primary' : ''\)/,
    'qa() must apply the modifier when primary is truthy');
  // The Pipeline tile must call qa(..., true).
  assert.match(dash, /qa\('📥',\s*'nav\.pipeline',[^)]*,\s*'\/pipeline',\s*true\)/,
    'Pipeline tile must be flagged primary so it gets the accent');
  // CSS rule present.
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.qa-tile--primary\s*\{/, 'app.css must style .qa-tile--primary');
  assert.match(css, /\.qa-tile--primary\s+\.qa-label\s*\{[^}]*font-weight:\s*600/,
    'primary tile label must be bolder (font-weight: 600)');
});

test('NEW-OR1 (v1.59.4): #/config api-keys summary refresh is race-safe (atomic replaceChildren + stale-token drop)', () => {
  const cfg = read('public', 'js', 'views', 'config.js');
  // Race-safe pattern: token-counting prevents stale fetch resolves
  // from clobbering a newer-fetch result.
  assert.match(cfg, /const myToken = \+\+inFlight/,
    'refreshApiSummary must use an inFlight token to guard against stale resolves');
  assert.match(cfg, /if \(myToken !== inFlight\) return/,
    'refreshApiSummary must drop the response if a newer fetch has started');
  // Atomic DOM swap (no transient empty chip).
  assert.match(cfg, /apiSummary\.replaceChildren\(activeLabel, countLabel\)/,
    'refreshApiSummary must use replaceChildren() for atomic swap (no flash)');
  // On null fetch result, preserve the previous good state.
  assert.match(cfg, /let lastGoodSt = null/,
    'refreshApiSummary must cache lastGoodSt to survive transient fetch failures');
  assert.match(cfg, /if \(!lastGoodSt\) apiSummary\.hidden = true/,
    'refreshApiSummary must only hide chip on first-ever fetch failure');
});

test('UX-A9 (v1.58.62 + v1.59.2): #/config API-keys panel has an Active/Keys summary chip with correct count + provider key', () => {
  const cfg = read('public', 'js', 'views', 'config.js');
  assert.match(cfg, /className:\s*'api-keys__summary'/,
    'config.js must render an .api-keys__summary element');
  assert.match(cfg, /\/api\/status\/providers/,
    'summary must fetch /api/status/providers for active provider + count');
  assert.match(cfg, /config\.activeProvider/, 'summary must use i18n key config.activeProvider');
  assert.match(cfg, /config\.keysConfiguredPrefix/, 'summary must use i18n key config.keysConfiguredPrefix');
  assert.match(cfg, /document\.addEventListener\('providers-changed', refreshApiSummary\)/,
    'summary must subscribe to providers-changed for live updates after Save');
  // v1.59.2 — count comes from Array.length, not typeof === 'number'.
  assert.match(cfg, /Array\.isArray\(st\.keysConfigured\)\s*\?\s*st\.keysConfigured\.length/,
    'count must read keysConfigured.length (server returns an array)');
  // v1.59.2 — NAME map keyed by 'anthropic' (server returns lowercase
  // resolved provider name), NOT 'claude'.
  assert.match(cfg, /\{\s*anthropic:\s*'Anthropic'/,
    'NAME map must key on "anthropic" (server contract — not "claude")');
  // i18n keys present in 8 locales.
  const dict = legacyDictText();
  for (const key of ['config.activeProvider', 'config.keysConfiguredPrefix']) {
    assert.ok(dict.includes(`'${key}'`), `i18n-dict.js must define '${key}'`);
  }
  // CSS rule present and (v1.59.2) NOT sticky-overlapping.
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.api-keys__summary\s*\{/, 'app.css must style .api-keys__summary');
  // v1.59.2 — assert the sticky positioning is gone (it created
  // overlap with the tablist + page header on scroll).
  assert.ok(!/\.api-keys__summary\s*\{[^}]*position:\s*sticky/.test(css),
    '.api-keys__summary must NOT use position: sticky (overlapped other elements)');
});

test('UX-A8 (v1.58.61): README documents the make clean-test-fixtures first-run step', () => {
  // All 8 READMEs must mention the cleanup step so first-time users
  // don't mistake the fixture rows for real jobs.
  const FILES = ['README.md','README.es.md','README.pt-BR.md','README.ko-KR.md',
                 'README.ja.md','README.ru.md','README.zh-CN.md','README.zh-TW.md'];
  for (const f of FILES) {
    const md = read(f);
    assert.match(md, /make clean-test-fixtures/,
      `${f} must document the make clean-test-fixtures first-run step`);
    assert.match(md, /qa-fixture-\*/,
      `${f} must reference the qa-fixture-* shape so users recognize the rows`);
  }
});

test('UX-A12 (v1.58.60): notifications drawer supports Clear all + per-entry dismiss', () => {
  const api = read('public', 'js', 'api.js');
  // UI surface must expose the new helpers.
  assert.match(api, /function clearToastHistory\(\)/, 'api.js must define clearToastHistory()');
  assert.match(api, /function dismissToastHistory\(ts\)/, 'api.js must define dismissToastHistory(ts)');
  assert.match(api, /clearToastHistory,\s*dismissToastHistory/,
    'UI return object must export both helpers');

  // HTML must include the Clear all button + i18n hooks.
  const html = read('public', 'index.html');
  assert.match(html, /id="notif-clear-all"/, 'drawer must have Clear all button');
  assert.match(html, /data-i18n="notif\.clearAll"/, 'Clear all must use i18n key');

  // App.js drawer must wire the new buttons.
  const app = read('public', 'js', 'app.js');
  assert.match(app, /UI\.clearToastHistory\(\)/,
    'Clear all click handler must call UI.clearToastHistory()');
  assert.match(app, /UI\.dismissToastHistory\(it\.ts\)/,
    'per-entry dismiss must call UI.dismissToastHistory(it.ts)');
  // Purge sentinels must NOT bump the unread counter.
  assert.match(app, /entry\.cleared \|\| entry\.dismissed != null/,
    'onToast subscriber must detect purge sentinels and skip unread bump');

  // i18n keys present in 8 locales.
  const dict = legacyDictText();
  for (const key of ['notif.clearAll', 'notif.clearAllAria', 'notif.dismiss']) {
    assert.ok(dict.includes(`'${key}'`), `i18n-dict.js must define '${key}'`);
  }
  // CSS rules present.
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.notif-drawer__clear-all\s*\{/, 'CSS must style .notif-drawer__clear-all');
  assert.match(css, /\.notif-item__dismiss\s*\{/, 'CSS must style .notif-item__dismiss');
});

test('UX-A13 (v1.58.59): #/health failing rows render an actionable "Fix →" CTA mapped to the right config tab', () => {
  const health = read('public', 'js', 'views', 'health.js');
  assert.match(health, /const FIX_TARGETS = \{/,
    'health.js must define FIX_TARGETS map for fixable rows');
  assert.match(health, /'Profile customized':\s*'#\/config\?tab=profile'/,
    'Profile customized must route to the profile tab');
  assert.match(health, /_API_KEY\$/,
    'API key rows must be matched by suffix regex and routed to api-keys tab');
  assert.match(health, /className:\s*'btn btn-ghost btn-sm health-fix'/,
    'the CTA must render as a small ghost button with .health-fix class');
  // The CTA copy must be localized (no hardcoded English).
  assert.match(health, /t\('health\.fix',/, 'CTA label must use i18n key health.fix');
  // i18n keys present.
  const dict = legacyDictText();
  for (const key of ['health.fix', 'health.fixAria']) {
    assert.ok(dict.includes(`'${key}'`), `i18n-dict.js must define '${key}'`);
  }
});

test('UX-A10 (v1.58.58): #/cv guards against leaving with unsaved buffer (beforeunload + hashchange)', () => {
  const cv = read('public', 'js', 'views', 'cv.js');
  assert.match(cv, /let cvDirty = false/,
    'cv.js must track cvDirty flag in the save-button IIFE closure');
  assert.match(cv, /window\.addEventListener\('beforeunload', onBeforeUnload\)/,
    'cv.js must register beforeunload guard (browser-close confirm)');
  assert.match(cv, /window\.addEventListener\('hashchange', onHashChange\)/,
    'cv.js must register hashchange guard (SPA-internal nav confirm)');
  // The hashchange guard must offer a localized confirm copy.
  assert.match(cv, /t\('cv\.unsavedConfirm'/,
    'hashchange guard must use the localized cv.unsavedConfirm prompt');
  // i18n key must exist in 8 locales.
  const dict = legacyDictText();
  assert.ok(dict.includes("'cv.unsavedConfirm'"), 'i18n-dict.js must define cv.unsavedConfirm');
});

test('UX-A7 (v1.58.57): cost-line auto-refreshes when LLM_PROVIDER changes (providers-changed wiring)', () => {
  // The contract — verified statically because Playwright is not in the
  // node --test suite — is that:
  //   1. config.js dispatches a `providers-changed` CustomEvent on Save.
  //   2. The shared UI.providerCostHint helper subscribes via
  //      document.addEventListener('providers-changed', refreshCostLine).
  //   3. Every advisor view that surfaces cost (#/deep, #/evaluate,
  //      #/auto, #/<mode>) calls UI.providerCostHint(t).
  // If any of those three pieces breaks, the cost line silently lies
  // after a provider switch — exactly the regression UX-D-I (v1.58.41)
  // was meant to prevent. This guard locks all three in place.
  const config = read('public', 'js', 'views', 'config.js');
  assert.match(config,
    /document\.dispatchEvent\(new CustomEvent\('providers-changed'\)\)/,
    'config.js Save handler must dispatch providers-changed CustomEvent');

  const api = read('public', 'js', 'api.js');
  assert.match(api,
    /document\.addEventListener\('providers-changed', refreshCostLine\)/,
    'UI.providerCostHint must subscribe refreshCostLine to providers-changed');
  assert.match(api,
    /document\.addEventListener\('visibilitychange', onVisibility\)/,
    'UI.providerCostHint must also refresh on tab refocus (cross-tab provider switch)');

  // All 4 advisor views call UI.providerCostHint(t).
  for (const view of ['deep.js', 'evaluate.js', 'auto.js', 'mode-page.js']) {
    const src = read('public', 'js', 'views', view);
    assert.match(src, /UI\.providerCostHint\(t\)/,
      `${view} must call UI.providerCostHint(t) so the cost line auto-refreshes`);
  }
});

test('UX-A4 (v1.58.56): .lang-btn meets WCAG 2.5.8 minimum touch-target (≥ 28×28 px)', () => {
  const css = read('public', 'css', 'app.css');
  // The pre-fix rule was `padding: 4px 8px` with no min-height — pulling
  // buttons to 23–25 px tall, below the 24×24 WCAG 2.5.8 floor.
  assert.match(css, /\.lang-btn\s*\{[^}]*min-height:\s*28px/,
    '.lang-btn must declare min-height: 28px (WCAG 2.5.8 floor)');
  assert.match(css, /\.lang-btn\s*\{[^}]*min-width:\s*28px/,
    '.lang-btn must declare min-width: 28px for short labels (en/ja)');
  // Padding now 6px 10px (vs pre-fix 4px 8px) for visual balance.
  assert.ok(/\.lang-btn\s*\{[^}]*padding:\s*6px 10px/.test(css),
    '.lang-btn padding must be 6px 10px to match the new vertical rhythm');
});

test('UX-A3 (v1.58.55): dashboard renders an active-provider chip wired to /api/status/providers', () => {
  const dash = read('public', 'js', 'views', 'dashboard.js');
  assert.match(dash, /function providerChip\(\)/,
    'dashboard.js must define providerChip() helper');
  assert.match(dash, /\/api\/status\/providers/,
    'providerChip must fetch /api/status/providers (existing endpoint)');
  assert.match(dash, /dash-chip--provider/, 'chip must carry .dash-chip--provider class');
  assert.match(dash, /document\.addEventListener\('providers-changed', refresh\)/,
    'chip must re-render on providers-changed event (#/config save dispatches it)');
  assert.match(dash, /document\.addEventListener\('visibilitychange', onVisibility\)/,
    'chip must re-render on tab refocus (cross-tab provider switch)');
  // M-1 discipline: listeners must self-detach when leaving #/dashboard.
  assert.match(dash, /window\.addEventListener\('hashchange', cleanup\)/,
    'chip must register a hashchange cleanup so listeners do not stack');
  assert.match(dash, /document\.removeEventListener\('providers-changed', refresh\)/,
    'cleanup must remove providers-changed listener');
  // i18n keys present in 8 locales.
  const dict = legacyDictText();
  for (const key of ['dash.provider.live', 'dash.provider.manual']) {
    assert.ok(dict.includes(`'${key}'`), `i18n-dict.js must define '${key}'`);
  }
  // CSS rule present.
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.dash-chip--provider\s*\{/, 'app.css must define .dash-chip--provider');
});

test('UX-A1 (v1.58.54): showResult prepends a brief-warning when ≥3 canonical H2s are missing', () => {
  const deep = read('public', 'js', 'views', 'deep.js');
  assert.match(deep, /function looksLikeStructuredBrief\(md\)/,
    'deep.js must define looksLikeStructuredBrief(md) for the canonical H2 audit');
  // The six canonical H2 section titles must all be in the expected list.
  for (const section of ['Company snapshot', 'Engineering culture', 'Recent news',
                         'Glassdoor', 'Interview process', 'Negotiation leverage']) {
    assert.ok(deep.includes(section),
      `deep.js must list '${section}' as one of the six canonical H2 sections`);
  }
  assert.match(deep, /className:\s*'brief-warning'/,
    'deep.js must render a .brief-warning element when the brief lacks structure');
  assert.match(deep, /deep\.briefUnstructured\.title/,
    'deep.js must use the i18n key deep.briefUnstructured.title for the warning headline');
  // The warning must be appended into the card before header+body so it
  // surfaces above the rendered markdown, not buried at the bottom.
  assert.match(deep, /if \(briefWarning\) card\.appendChild\(briefWarning\)/,
    'deep.js must conditionally appendChild(briefWarning) into the card');

  // The .brief-warning class must have a real CSS rule (not just markup).
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.brief-warning\s*\{/, 'app.css must define a .brief-warning rule');

  // All 8 locales must carry the three UX-A1 i18n keys.
  const dict = legacyDictText();
  for (const key of ['deep.briefUnstructured.title', 'deep.briefUnstructured.body', 'deep.docsLink']) {
    assert.ok(dict.includes(`'${key}'`), `i18n-dict.js must define '${key}'`);
  }
});

test('UX-A6 (v1.58.53): every saved-research card flows through a single `renderSavedCard()` helper', () => {
  const deep = read('public', 'js', 'views', 'deep.js');
  assert.match(deep, /function renderSavedCard\(f\)/,
    'deep.js must define renderSavedCard(f) as the single render helper');
  assert.match(deep, /className:\s*'saved-card__title'/, 'helper must emit .saved-card__title');
  assert.match(deep, /className:\s*'saved-card__date',\s*datetime:\s*iso/,
    'helper must emit <time class="saved-card__date" datetime=…>');
  assert.match(deep, /list\.appendChild\(renderSavedCard\(f\)\)/,
    'renderArchive must delegate every card to renderSavedCard');
});

test('NEW-D2-motion (v1.59.6): CSS honours prefers-reduced-motion: reduce', () => {
  const css = read('public', 'css', 'app.css');
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)\s*\{/,
    'app.css must declare a @media (prefers-reduced-motion: reduce) block');
  // The block must neutralize both animation + transition + scroll-behavior.
  const block = css.split('@media (prefers-reduced-motion: reduce)')[1] || '';
  // Take everything up to the matching closing brace of the @media.
  const inside = block.slice(0, block.indexOf('\n}\n') + 2);
  assert.match(inside, /animation-duration:\s*0\.01ms\s*!important/,
    'must neutralize animation-duration');
  assert.match(inside, /transition-duration:\s*0\.01ms\s*!important/,
    'must neutralize transition-duration');
  assert.match(inside, /scroll-behavior:\s*auto\s*!important/,
    'must override scroll-behavior: smooth on reduced-motion');
});

test('UX-A5-r4 (v1.59.9): help.js TOC scroll-spy ships a <body data-toc-spy="active"> debug marker', () => {
  const help = read('public', 'js', 'views', 'help.js');
  // The single-selector "is the spy alive?" check — any tester / agent
  // can run `document.body.dataset.tocSpy === 'active'` to verify the
  // spy mount without scrolling first. Previous 5 cycles all shipped
  // with passing tests + broken behaviour because the tests never
  // asserted a behaviour-side invariant. This marker is the new floor.
  assert.match(help, /document\.body\.setAttribute\('data-toc-spy', 'active'\)/,
    'help.js must set <body data-toc-spy="active"> on scroll-spy mount');
  assert.match(help, /document\.body\.removeAttribute\('data-toc-spy'\)/,
    'help.js must remove the marker on hashchange cleanup');
});

test('UX-A5-r4 (v1.59.9): scroll-spy is initial-paint-eager (synchronous compute + double-rAF re-compute)', () => {
  const help = read('public', 'js', 'views', 'help.js');
  // Previous v1.59.8 relied on double-rAF alone; if the router pre-
  // painted the view, the rAF callback fired AFTER the user had
  // already scrolled. v1.59.9 fires `computeActiveAndApply()` once
  // synchronously at mount tail (no-ops if rects are 0/detached) AND
  // schedules a double-rAF re-compute for the post-append rects.
  // Match the synchronous invocation followed by the double-rAF block.
  assert.match(help, /computeActiveAndApply\(\);\s*\n\s*\/\/[^\n]*[Dd]ouble rAF[\s\S]{0,400}requestAnimationFrame\(\(\)\s*=>\s*requestAnimationFrame\(computeActiveAndApply\)\)/,
    'help.js must call computeActiveAndApply() synchronously then schedule double-rAF re-compute');
  // resize listener — re-paint when viewport changes mid-scroll
  // (mobile orientation flip, devtools toggle, etc).
  assert.match(help, /window\.addEventListener\('resize', onSpyScroll/,
    'help.js must also subscribe onSpyScroll to resize for viewport-change reflow');
  // CSS rule has paint declarations (the regression report cited one
  // previous cycle where `.toc-current` was attached but a later CSS
  // rule reset border-left). Assert the rule has both color AND a
  // visible border-left declaration.
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.help-toc\s+a\.toc-current\s*\{[^}]*color:\s*var\(--rausch/,
    '.help-toc a.toc-current must paint color from --rausch');
  assert.match(css, /\.help-toc\s+a\.toc-current\s*\{[^}]*border-left:\s*\d+px\s+solid\s+var\(--rausch/,
    '.help-toc a.toc-current must paint a visible border-left from --rausch');
});

test('UX-A5-r3 (v1.59.8): help.js TOC scroll-spy uses a plain scroll listener (NOT IntersectionObserver)', () => {
  const help = read('public', 'js', 'views', 'help.js');
  // After 4 ship cycles with IntersectionObserver still failing, v1.59.8
  // switched to a scroll listener. The IO machinery must be gone.
  assert.ok(!/new IntersectionObserver/.test(help),
    'help.js must NOT use IntersectionObserver for scroll-spy (replaced by scroll listener in v1.59.8)');
  // The new path must have the named computeActiveAndApply function +
  // rAF-throttled scroll listener + double-rAF initial-state.
  assert.match(help, /function computeActiveAndApply\(\)/,
    'help.js must define computeActiveAndApply() for the spy');
  assert.match(help, /window\.addEventListener\('scroll', onSpyScroll,\s*\{\s*passive:\s*true\s*\}\)/,
    'help.js must register a passive scroll listener for scroll-spy');
  assert.match(help, /requestAnimationFrame\(\(\)\s*=>\s*requestAnimationFrame\(computeActiveAndApply\)\)/,
    'help.js must compute initial state via double rAF after mount');
  // rAF throttling — one rAF per scroll burst.
  assert.match(help, /requestAnimationFrame\(computeActiveAndApply\)/,
    'help.js scroll listener must rAF-throttle the recompute');
  // Cleanup must remove the new listener.
  assert.match(help, /window\.removeEventListener\('scroll', onSpyScroll\)/,
    'hashchange cleanup must remove onSpyScroll');
});

// UX-A5-r2 (v1.59.3) lock-test SUPERSEDED by UX-A5-r3 (v1.59.8) — the
// IntersectionObserver wiring it asserted no longer exists; v1.59.8
// replaced the entire approach with a scroll listener. The new
// contract is locked by the UX-A5-r3 test above.

// UX-A5 (v1.58.52) lock-test SUPERSEDED by UX-A5-r3 (v1.59.8). The
// IntersectionObserver-based mountTocSpy that this test asserted no
// longer exists; v1.59.8 replaced it with a scroll listener after the
// IO approach failed a 5th regression cycle. The negative-match for
// the buggy setTimeout(0) + document.querySelectorAll pattern still
// matters — preserve it as a residual guard.
test('UX-A5 residual: pre-v1.58.52 setTimeout(0) + document.querySelectorAll pattern must NOT return', () => {
  const help = read('public', 'js', 'views', 'help.js');
  assert.ok(!/setTimeout\(\(\)\s*=>\s*\{\s*const articleHeadings = document\.querySelectorAll/.test(help),
    "pre-v1.58.52 setTimeout(0) + document.querySelectorAll('.help-article h2') wrapper must stay gone");
});

test('DOC-1 (v1.58.50): qa/REGRESSION-FINAL.md has §5a documenting English-by-policy server error bodies', () => {
  const final = read('qa', 'REGRESSION-FINAL.md');
  assert.match(final, /^## §5a — Server error bodies are English-by-policy/m,
    "REGRESSION-FINAL.md must declare a §5a English-by-policy section");
  assert.match(final, /Accept-Language[\s\S]{0,400}?not[\s\S]{0,40}?read/i,
    "§5a must call out that Accept-Language is not currently read");
  assert.match(final, /v1\.59/,
    '§5a must point to v1.59 as the future-feature gate for localized errors');
});

test('UX-D-B (v1.58.48): #/dashboard renders a fixture-profile warning banner when /api/health flags `Profile customized: false`', () => {
  const dash = read('public', 'js', 'views', 'dashboard.js');
  assert.match(dash, /function profileFixtureBanner\(\)/,
    'dashboard.js must define profileFixtureBanner()');
  assert.match(dash, /health\.checks\.find\([\s\S]{0,200}?'Profile customized'/,
    "banner must look for the 'Profile customized' check from /api/health");
  assert.match(dash, /'hero-banner hero-banner--warning'/,
    'banner must use .hero-banner.hero-banner--warning classes');
  assert.match(dash, /t\('onboarding\.fixtureWarning'/,
    "banner message must come from t('onboarding.fixtureWarning', …)");
  assert.match(dash, /t\('onboarding\.fixProfile'/,
    "banner CTA label must come from t('onboarding.fixProfile', …)");
  // i18n parity for both keys.
  const dict = legacyDictText();
  for (const key of ['onboarding.fixtureWarning', 'onboarding.fixProfile']) {
    const row = dict.match(new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*\\{([^}]+)\\}`));
    assert.ok(row, `i18n-dict.js missing '${key}'`);
    for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
      const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
      assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
        `'${key}' must have a non-empty ${lang} value`);
    }
  }
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.hero-banner\s*\{/, '.hero-banner CSS rule must exist');
  assert.match(css, /\.hero-banner--warning\s*\{/, '.hero-banner--warning rule must exist');
});

test('UX-D-C (v1.58.47): top-bar `Quick scan` renamed to `Open Scan` so the label matches the behavior', () => {
  // The button only navigates to #/scan — it does not start a scan.
  // The pre-fix "Quick scan" implied an instant action; "Open Scan"
  // is honest about the nav-only behavior.
  const html = read('public', 'index.html');
  assert.ok(!/data-i18n="top\.quickscan">Quick scan</.test(html),
    "pre-fix 'Quick scan' default label must be gone from index.html");
  assert.match(html, /data-i18n="top\.quickscan">Open Scan</,
    "index.html must declare 'Open Scan' as the default label");
  const dict = legacyDictText();
  const row = dict.match(/'top\.quickscan':\s*\{([^}]+)\}/);
  assert.ok(row, "i18n-dict.js missing 'top.quickscan'");
  // EN value must be the new label.
  assert.match(row[1], /en:\s*'Open Scan'/,
    "top.quickscan EN must be 'Open Scan'");
  // Old loaded "Quick scan" / "Búsqueda rápida" / "Быстрый скан" gone in en/es/ru.
  assert.ok(!/en:\s*'Quick scan'/.test(row[1]), "EN 'Quick scan' is gone");
});

test('UX-D-D (v1.58.46): apply checklist substitutes {company}-{role} with slugs derived from URL/JD', () => {
  const apply = read('public', 'js', 'views', 'apply.js');
  assert.match(apply, /function substitutePlaceholders\(/,
    'apply.js must define substitutePlaceholders()');
  assert.match(apply, /function extractSlugs\(/,
    'apply.js must define extractSlugs()');
  // Run substitution must happen before parseChecklist sees the text.
  assert.match(apply, /const substituted = substitutePlaceholders\(r\.checklist,[\s\S]{0,200}const items = parseChecklist\(substituted\)/,
    'run() must call substitutePlaceholders() before parseChecklist()');
  // Greenhouse + Lever + Ashby + Workable + SmartRecruiters + Workday
  // all recognised in the host whitelist.
  assert.match(apply, /greenhouse\|lever\|ashby\|workable\|smartrecruit/,
    'host whitelist must include the 5 ATS hosts');
  assert.match(apply, /myworkdayjobs/, 'must handle Workday subdomain');
  // Fallback "[company]" / "[role]" markers when extraction fails.
  assert.match(apply, /'\[company\]'/, 'unresolved company must fall back to [company]');
  assert.match(apply, /'\[role\]'/, 'unresolved role must fall back to [role]');
});

test('UX-D-K (v1.58.45) — scroll-spy highlights current section via `.toc-current` class (mechanism: scroll listener since v1.59.8)', () => {
  const help = read('public', 'js', 'views', 'help.js');
  // The mechanism changed from IntersectionObserver (v1.58.45 → v1.59.3)
  // to a scroll listener (v1.59.8) after the IO approach failed 5
  // regression cycles. The OBSERVABLE contract — `.toc-current` toggle
  // on the matching link — is unchanged and remains the user-visible
  // promise. Lock the class toggle + CSS rule, not the implementation.
  assert.match(help, /classList\.add\('toc-current'\)/,
    'observed link must get .toc-current class');
  assert.match(help, /classList\.remove\('toc-current'\)/,
    'old current link must lose the .toc-current class');
  // CSS rule provides the visual.
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.help-toc\s+a\.toc-current\s*\{/,
    '.help-toc a.toc-current CSS rule must exist');
});

test('UX-D-L (v1.58.44): #/deep saved-research opened brief has an inline × close button', () => {
  const deep = read('public', 'js', 'views', 'deep.js');
  assert.match(deep, /'aria-label':\s*t\('deep\.closeBrief'/,
    'showResult must declare an × button with aria-label: t("deep.closeBrief", …)');
  assert.match(deep, /onClick:\s*\(\)\s*=>\s*\{\s*out\.innerHTML = ''/,
    'close button must clear the out container on click');
  const dict = legacyDictText();
  const row = dict.match(/'deep\.closeBrief':\s*\{([^}]+)\}/);
  assert.ok(row, "i18n-dict.js missing 'deep.closeBrief'");
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
      `'deep.closeBrief' must have a non-empty ${lang} value`);
  }
});

test('UX-D-F (v1.58.43): empty JD on #/evaluate triggers a distinct localized error toast (not "too short")', () => {
  const ev = read('public', 'js', 'views', 'evaluate.js');
  // Branch order: empty check must precede the <50 check, with its
  // own dedicated i18n key + focus restore.
  assert.match(ev, /if \(!jd\) \{[\s\S]{0,400}UI\.toast\(t\('eval\.emptyJd'/,
    'evaluate.js must distinguish empty JD from short JD via t("eval.emptyJd")');
  assert.match(ev, /jdInput\.focus\(\)/,
    'evaluate.js must call jdInput.focus() after the empty-JD toast');
  const dict = legacyDictText();
  const row = dict.match(/'eval\.emptyJd':\s*\{([^}]+)\}/);
  assert.ok(row, "i18n-dict.js missing 'eval.emptyJd'");
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
      `'eval.emptyJd' must have a non-empty ${lang} value`);
  }
});

test('UX-D-J (v1.58.42): every advisor view renders a localized ETA chip next to the cost hint', () => {
  for (const f of ['evaluate.js', 'deep.js', 'mode-page.js']) {
    const v = read('public', 'js', 'views', f);
    assert.match(v, /className:\s*'advisor-eta'/,
      `${f} must render a <span class="advisor-eta"> chip`);
    assert.match(v, /t\('advisor\.eta'/,
      `${f} must localize the ETA via t('advisor.eta', …)`);
  }
  const dict = legacyDictText();
  const row = dict.match(/'advisor\.eta':\s*\{([^}]+)\}/);
  assert.ok(row, "i18n-dict.js missing 'advisor.eta'");
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
      `'advisor.eta' must have a non-empty ${lang} value`);
  }
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.advisor-eta\b/, '.advisor-eta CSS rule must exist');
});

test('UX-D-I (v1.58.41): cost-hint re-fetches on visibility-change + on `providers-changed` custom event', () => {
  // Background — v1.58.12 (M-7) wired the cost hint to /api/status/providers
  // but only fetched once at node creation. If the user switched
  // providers in another tab, the cost line silently lied until the
  // view was rebuilt. This release extracts a named `refreshCostLine`
  // function and re-binds it to two triggers.
  const api = read('public', 'js', 'api.js');
  assert.match(api, /async function refreshCostLine\(\)/,
    'providerCostHint must extract a named refreshCostLine() function');
  assert.match(api, /document\.addEventListener\('visibilitychange',[^)]+\)/,
    'cost-hint must subscribe to visibilitychange');
  assert.match(api, /document\.addEventListener\('providers-changed',\s*refreshCostLine\)/,
    "cost-hint must subscribe to the 'providers-changed' CustomEvent");

  // Config save path must broadcast the event so in-page cost lines refresh.
  const cfg = read('public', 'js', 'views', 'config.js');
  assert.match(cfg, /document\.dispatchEvent\(new CustomEvent\('providers-changed'\)\)/,
    "#/config save handler must dispatch 'providers-changed' after a successful POST /api/config");
});

test('NEW-D2 (v1.58.39): #/dashboard header Refresh button gives explicit toast feedback', () => {
  const dash = read('public', 'js', 'views', 'dashboard.js');
  // The header must declare a Refresh button with the right ARIA hook
  // and toast pipeline (Refreshing… → success "Dashboard refreshed"
  // → error fallback). Distinct from connection-banner Refresh (M-9).
  assert.match(dash, /'data-test':\s*'dash-refresh'/,
    'header Refresh button must declare data-test="dash-refresh"');
  assert.match(dash, /'aria-label':\s*t\('dash\.refreshAria'/,
    'header Refresh button must declare aria-label: t("dash.refreshAria", …)');
  assert.match(dash, /UI\.toast\(I18n\.t\('common\.refreshing',[^)]*\)\)/,
    'header Refresh must emit common.refreshing toast on click');
  assert.match(dash, /UI\.toast\(I18n\.t\('dash\.refreshed',[^)]*\),\s*'success'\)/,
    'header Refresh must emit dash.refreshed success toast on completion');
  // i18n parity for the 2 new keys.
  const dict = legacyDictText();
  for (const key of ['dash.refreshAria', 'dash.refreshed']) {
    const row = dict.match(new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*\\{([^}]+)\\}`));
    assert.ok(row, `i18n-dict.js missing '${key}'`);
    for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
      const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
      assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
        `'${key}' must have a non-empty ${lang} value`);
    }
  }
});

test('NEW-D3 (v1.58.38): #/tracker search input has explicit aria-label distinct from placeholder', () => {
  const tr = read('public', 'js', 'views', 'tracker.js');
  // The input must carry both placeholder and aria-label, sourced
  // from distinct i18n keys.
  assert.match(tr, /placeholder:\s*t\('track\.search'\)/,
    'filterText must declare placeholder: t("track.search")');
  assert.match(tr, /'aria-label':\s*t\('track\.searchAria'/,
    'filterText must declare aria-label: t("track.searchAria", …)');
  // The input must be type=search so user agents render the affordance
  // and SRs announce it correctly.
  assert.match(tr, /type:\s*'search',[\s\S]{0,200}placeholder:\s*t\('track\.search'\)/,
    'filterText must be type="search"');
  // i18n parity for the new key.
  const dict = legacyDictText();
  const row = dict.match(/'track\.searchAria':\s*\{([^}]+)\}/);
  assert.ok(row, "i18n-dict.js missing 'track.searchAria'");
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
      `'track.searchAria' must have a non-empty ${lang} value`);
  }
  // aria-label and placeholder must NOT be the same string in any locale
  // (per WCAG 4.1.2 — accessible name must convey purpose, not duplicate
  // the placeholder).
  const phRow = dict.match(/'track\.search':\s*\{([^}]+)\}/);
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    const phM = phRow[1].match(new RegExp(`${keyPat}\\s*:\\s*'([^']+)'`));
    const ariaM = row[1].match(new RegExp(`${keyPat}\\s*:\\s*'([^']+)'`));
    assert.ok(phM && ariaM, `${lang} values not parseable`);
    assert.notEqual(ariaM[1], phM[1],
      `'track.searchAria[${lang}]' must differ from 'track.search[${lang}]'`);
  }
});

test('v1.58.35: notifications drawer hides via `[hidden]` (CSS override) + help §18 in all 8 locales', () => {
  // BUG (user-reported): the drawer was always visible on page load
  // because `.notif-drawer { display: flex }` shadowed the UA
  // `[hidden] { display: none }` rule. Fix in app.css:
  //     .notif-drawer[hidden] { display: none; }
  //     .notif-badge[hidden]  { display: none; }
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.notif-drawer\[hidden\]\s*\{[^}]*display:\s*none/,
    "must add an explicit '.notif-drawer[hidden] { display: none }' rule");
  assert.match(css, /\.notif-badge\[hidden\]\s*\{[^}]*display:\s*none/,
    "must add an explicit '.notif-badge[hidden] { display: none }' rule");
  // The drawer markup must still ship with the `hidden` attribute so
  // the new CSS rule has something to match.
  const html = read('public', 'index.html');
  assert.match(html, /<aside id="notif-drawer"[^>]*hidden/,
    'notif-drawer must declare the hidden attribute at boot');
  // The notif-bell click handler is the SOLE entry-point — verify no
  // other auto-open call site exists in app.js.
  const app = read('public', 'js', 'app.js');
  // Strip comments before counting open() so doc-strings can mention
  // the call site without tripping the guard. v1.58.36 (M-1) added
  // an explanatory comment that referenced open()/close() and broke
  // the naive regex; strip line + block comments first.
  const appCode = app
    .replace(/\/\*[\s\S]*?\*\//g, '')        // /* … */
    .replace(/^[ \t]*\/\/.*$/gm, '')         // // …
    .replace(/[^:]\/\/[^\n]*$/gm, '');       // trailing // … (avoid http://)
  const openCalls = (appCode.match(/(?<!const\s)open\(\)/g) || []).length;
  // open() is referenced exactly: once in the ternary bell click
  // (`drawer.hidden ? open() : close()`). Anywhere else risks
  // auto-opening.
  assert.equal(openCalls, 1,
    `app.js must call open() exactly once (only from the bell click ternary). Found ${openCalls}.`);

  // Help §18 — every locale must document the categories.
  for (const locale of ['en', 'es', 'ja', 'ko-KR', 'pt-BR', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const help = read('docs', 'help', `${locale}.md`);
    assert.match(help, /^## 18\. /m, `${locale}.md must include H2 "## 18. <Notifications>"`);
    // The categories table must be present (3 rows: success / error / info).
    assert.match(help, /\| \*\*[\s\S]*?\*\*[\s\S]*?\| /,
      `${locale}.md §18 must include the category table`);
  }
});

test('v1.58.34: notifications drawer wires bell + onToast subscribe + 4 i18n keys', () => {
  // U-13 follow-up — the drawer UI promised but deferred in v1.58.33.
  // UI exposes onToast() pub/sub on top of the v1.58.33 capture.
  const api = read('public', 'js', 'api.js');
  assert.match(api, /const toastSubscribers = new Set\(\)/,
    'api.js must declare a toastSubscribers Set');
  assert.match(api, /function onToast\(fn\)/, 'onToast() must be defined');
  assert.match(api, /toastSubscribers\.add\(fn\)/, 'onToast must add subscribers');
  assert.match(api, /for \(const fn of toastSubscribers\)/,
    'toast() must notify subscribers on every push');
  assert.match(api, /return\s*\{[^}]*onToast[^}]*\}/,
    'UI return must export onToast');
  // v1.58.36 (L-7) — onToast must return an unsubscribe function so
  // long-lived sessions can clean up per-mount subscribers.
  assert.match(api, /function onToast\(fn\) \{ toastSubscribers\.add\(fn\); return \(\) => toastSubscribers\.delete\(fn\); \}/,
    'onToast must return an unsubscribe closure');

  // index.html — bell button + drawer shell.
  const html = read('public', 'index.html');
  assert.match(html, /id="notif-bell"[^>]*aria-haspopup="dialog"[^>]*aria-controls="notif-drawer"/,
    'index.html must declare the notif-bell with aria-haspopup+aria-controls');
  assert.match(html, /id="notif-badge"[^>]*hidden/, 'notif-badge must start hidden');
  assert.match(html, /id="notif-drawer"[^>]*role="dialog"/,
    'notif-drawer must be role="dialog"');
  assert.match(html, /data-i18n="notif\.title"/, 'drawer title must use data-i18n');
  assert.match(html, /data-i18n="notif\.empty"/, 'empty state must use data-i18n');

  // app.js — drawer behavior: open/close, badge increment, onToast subscribe.
  const app = read('public', 'js', 'app.js');
  assert.match(app, /UI\.onToast\(/, 'app.js must subscribe via UI.onToast()');
  assert.match(app, /UI\.getToastHistory\(\)\.slice\(\)\.reverse\(\)/,
    'drawer render must show newest-first');
  assert.match(app, /bell\.setAttribute\('aria-expanded',\s*'true'\)/,
    'bell aria-expanded must flip true on open');
  assert.match(app, /e\.key === 'Escape'/, 'Escape must close the drawer');

  // i18n parity for the 4 new keys.
  const dict = legacyDictText();
  for (const key of ['notif.title', 'notif.empty', 'notif.bellAria', 'notif.closeAria']) {
    const row = dict.match(new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*\\{([^}]+)\\}`));
    assert.ok(row, `i18n-dict.js missing '${key}'`);
    for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
      const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
      assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
        `'${key}' must have a non-empty ${lang} value`);
    }
  }
  // CSS contract — bell, drawer, item rules exist.
  const css = read('public', 'css', 'app.css');
  for (const sel of ['.notif-bell', '.notif-badge', '.notif-drawer', '.notif-drawer__head', '.notif-item']) {
    assert.match(css, new RegExp(`${sel.replace(/[.\-]/g, (m) => '\\' + m)}\\s*\\{`),
      `${sel} CSS rule must exist`);
  }
});

test('U-13/U-14/U-15 (v1.58.33): toast journal + page-header spacing safety net + CV dirty-state', () => {
  // U-13 — UI.getToastHistory() exposed + history append guarded by cap.
  const api = read('public', 'js', 'api.js');
  assert.match(api, /const toastHistory = \[\]/, 'api.js must declare toastHistory array');
  assert.match(api, /TOAST_HISTORY_CAP\s*=\s*50/, 'cap must be 50');
  assert.match(api, /const entry = \{\s*ts:\s*Date\.now\(\)[\s\S]*?toastHistory\.push\(entry\)/,
    'toast() must build { ts, type, message, detail } and push before render');
  assert.match(api, /toastHistory\.shift\(\)/, 'must trim oldest beyond the cap');
  assert.match(api, /function getToastHistory\(\)/, 'getToastHistory() must be defined');
  assert.match(api, /return\s*\{\s*toast,[\s\S]*?getToastHistory\b/,
    'UI return must export getToastHistory');

  // U-14 — global page-header safety net rule.
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.page-header h1 \+ p\s*\{[^}]*margin-block-start:\s*var\(--space-2\)/,
    '.page-header h1 + p rule must set margin-block-start: var(--space-2)');

  // U-15 — CV dirty-state wiring.
  const cv = read('public', 'js', 'views', 'cv.js');
  assert.match(cv, /let initial = ta\.value/, 'cv.js must capture initial textarea baseline');
  assert.match(cv, /ta\.addEventListener\('input'/, 'cv.js must listen on input to flip dirty');
  // UX-A10 (v1.58.58) renamed the local from `dirty` to `cvDirty` to
  // share state with the beforeunload/hashchange guards — the wiring
  // is unchanged behaviorally, so the assertion accepts either name.
  assert.match(cv, /saveBtn\.classList\.toggle\('btn-dirty', (?:dirty|cvDirty)\)/,
    'cv.js must toggle .btn-dirty on the Save button');
  assert.match(cv, /t\('cv\.unsaved'/, 'cv.js must use t("cv.unsaved", …) for the tooltip');
  assert.match(cv, /ta\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/,
    'cv.js must dispatch a synthetic input event after programmatic upload assignment');
  assert.match(css, /\.btn\.btn-dirty\s*\{/, '.btn.btn-dirty CSS rule must exist');

  // i18n parity for cv.unsaved
  const dict = legacyDictText();
  const row = dict.match(/'cv\.unsaved':\s*\{([^}]+)\}/);
  assert.ok(row, "i18n-dict.js missing 'cv.unsaved'");
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
      `'cv.unsaved' must have a non-empty ${lang} value`);
  }
});

test('U-12 (v1.58.32): help TOC filter input carries `.help-toc__filter` class + CSS min-width', () => {
  const help = read('public', 'js', 'views', 'help.js');
  assert.match(help, /className:\s*'input help-toc__filter'/,
    'tocSearch must carry className "input help-toc__filter"');
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.help-toc__filter\s*\{[^}]*min-width:\s*16ch/,
    '.help-toc__filter must declare min-width: 16ch (fits all 8 locale placeholders)');
});

test('U-11 (v1.58.31): tracker Legitimacy column header has localized info chip with tooltip', () => {
  const tr = read('public', 'js', 'views', 'tracker.js');
  assert.match(tr, /className:\s*'th-info'/, '<span class="th-info"> must exist in the legitimacy header');
  assert.match(tr, /tabIndex:\s*0/, 'info chip must be keyboard-reachable (tabIndex: 0)');
  assert.match(tr, /title:\s*t\('track\.col\.legitimacy\.help'/,
    "info chip must declare title: t('track.col.legitimacy.help', …)");
  assert.match(tr, /'aria-label':\s*t\('track\.col\.legitimacy\.help'/,
    "info chip must declare aria-label: t('track.col.legitimacy.help', …)");
  const dict = legacyDictText();
  const row = dict.match(/'track\.col\.legitimacy\.help':\s*\{([^}]+)\}/);
  assert.ok(row, "i18n-dict.js missing 'track.col.legitimacy.help'");
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
      `'track.col.legitimacy.help' must have a non-empty ${lang} value`);
  }
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.th-info\s*\{/, '.th-info CSS rule must exist');
  assert.match(css, /\.th-info:focus-visible\s*\{/, '.th-info:focus-visible rule must exist (keyboard ring)');
});

test('U-10 (v1.58.30): tracker Normalize/Dedup/Merge buttons disabled when rows is empty', () => {
  const tr = read('public', 'js', 'views', 'tracker.js');
  assert.match(tr, /const empty = rows\.length === 0;/,
    'tracker must compute the empty flag from rows.length === 0');
  assert.match(tr, /disabled:\s*empty/, 'each button must declare disabled: empty');
  assert.match(tr, /'aria-disabled':\s*empty\s*\?\s*'true'\s*:\s*'false'/,
    "each button must declare aria-disabled mirroring the disabled state");
  assert.match(tr, /t\('track\.fixEmpty'/, 'empty tooltip must come from t("track.fixEmpty", …)');
  const dict = legacyDictText();
  const row = dict.match(/'track\.fixEmpty':\s*\{([^}]+)\}/);
  assert.ok(row, "i18n-dict.js missing 'track.fixEmpty'");
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
      `'track.fixEmpty' must have a non-empty ${lang} value`);
  }
});

test('U-9 (v1.58.29): pipeline counter ↔ filter row stacks at narrow viewports via .pipeline-controls', () => {
  const pipeline = read('public', 'js', 'views', 'pipeline.js');
  assert.match(pipeline, /className:\s*'flex gap-3 mb-3 pipeline-controls'/,
    'pipeline counter/filter row must carry the .pipeline-controls class');
  const css = read('public', 'css', 'app.css');
  assert.match(css, /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*?\.pipeline-controls\s*\{[^}]*flex-direction:\s*column/,
    '@media (max-width: 720px) must stack .pipeline-controls');
});

test('U-8 (v1.58.28): mode-page Generate-prompt wraps the <pre> in a collapsible <details>', () => {
  const mp = read('public', 'js', 'views', 'mode-page.js');
  assert.match(mp, /c\('details',\s*\{\s*className:\s*'prompt-block'\s*\}/,
    "showPrompt must wrap the prompt in <details class=\"prompt-block\">");
  assert.match(mp, /c\('summary',\s*null,\s*t\('prompt\.show'/,
    "showPrompt must use t('prompt.show', …) for the summary label");
  assert.match(mp, /t\('prompt\.lines'/,
    "showPrompt must localize the 'lines' word too");
  // i18n parity for the two new keys:
  const dict = legacyDictText();
  for (const key of ['prompt.show', 'prompt.lines']) {
    const row = dict.match(new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*\\{([^}]+)\\}`));
    assert.ok(row, `i18n-dict.js missing '${key}'`);
    for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
      const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
      assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
        `'${key}' must have a non-empty ${lang} value`);
    }
  }
  // CSS rule must exist:
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.prompt-block\s*\{/, '.prompt-block rule must exist');
  assert.match(css, /\.prompt-block\s*>\s*summary\s*\{/, '.prompt-block > summary rule must exist');
});

test('U-7 (v1.58.27): verify-pipeline modal strips `==========` ASCII dividers', () => {
  const health = read('public', 'js', 'views', 'health.js');
  assert.match(health, /\.replace\(\/\^=\{10,\}\$\/gm,\s*''\)/,
    "verify handler must strip lines that are >=10 '=' chars before rendering");
});

test('U-6 (v1.58.26): scan Active-companies chip exposes localized tooltip + aria-label', () => {
  const scan = read('public', 'js', 'views', 'scan.js');
  // toggleBtn must declare both title and aria-label so sighted users
  // get a hover tooltip and screen-reader users get the same text.
  assert.match(scan, /title:\s*t\('scan\.activeCo\.help'/,
    'toggleBtn must declare title: t("scan.activeCo.help", …)');
  assert.match(scan, /'aria-label':\s*t\('scan\.activeCo\.help'/,
    'toggleBtn must declare aria-label: t("scan.activeCo.help", …)');

  // i18n parity:
  const dict = legacyDictText();
  const row = dict.match(/'scan\.activeCo\.help':\s*\{([^}]+)\}/);
  assert.ok(row, "i18n-dict.js missing 'scan.activeCo.help'");
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
      `'scan.activeCo.help' must have a non-empty ${lang} value`);
  }
});

test('U-5 (v1.58.25): dashboard CTA duplicates removed (no `Open Pipeline` header btn, no `Scan all sources` tile)', () => {
  const dash = read('public', 'js', 'views', 'dashboard.js');
  // Pre-fix the header carried '📋 ' + t('dash.openPipeline'); that
  // button must be gone (sidebar handles /pipeline already).
  assert.ok(
    !/onClick:\s*\(\)\s*=>\s*Router\.go\('\/pipeline'\)\s*\}\s*,\s*'📋 '\s*\+\s*t\('dash\.openPipeline'\)/.test(dash),
    "'Open Pipeline' header button must be removed (duplicates sidebar /pipeline)",
  );
  // Pre-fix qa('🌐', 'dash.quick.scanCta', 'Scan all sources', …, '/scan')
  // duplicated the hero 'Scan now' CTA. It must be removed too.
  assert.ok(
    !/qa\('🌐',\s*'dash\.quick\.scanCta'/.test(dash),
    "'Scan all sources' Quick-action tile must be removed (duplicates hero Scan-now CTA)",
  );
  // Negative-count: the unique `Router.go('/pipeline')` and
  // `Router.go('/scan')` references should be ≤ 2 each on the dashboard
  // (hero + Quick-action Pipeline tile for /pipeline; hero only for /scan).
  const pipelineRefs = [...dash.matchAll(/Router\.go\('\/pipeline'\)/g)].length;
  const scanRefs = [...dash.matchAll(/Router\.go\('\/scan'\)/g)].length;
  assert.ok(pipelineRefs <= 2,
    `dashboard.js should have at most 2 Router.go('/pipeline') sites, found ${pipelineRefs}`);
  assert.ok(scanRefs <= 2,
    `dashboard.js should have at most 2 Router.go('/scan') sites, found ${scanRefs}`);
});

test('U-4 (v1.58.24): toast splits the "(METHOD /path · HTTP NNN)" postfix into a collapsible <details>', () => {
  const api = read('public', 'js', 'api.js');
  // Toast renderer must define the endpoint-detail regex:
  assert.match(api, /TOAST_ENDPOINT_RE\s*=\s*\/.*GET\|POST\|PUT\|PATCH\|DELETE.*HTTP/,
    'TOAST_ENDPOINT_RE must exist and match METHOD /path · HTTP NNN');
  // Headline + detail must be emitted as separate DOM nodes:
  assert.match(api, /createElement\('p'\)/, 'toast must create a <p> for the headline');
  assert.match(api, /createElement\('details'\)/, 'toast must create a <details> for the technical detail');
  assert.match(api, /createElement\('summary'\)/, 'toast must create a <summary>');
  assert.match(api, /I18n\.t\('toast\.details',\s*'Details'\)/,
    "summary must use I18n.t('toast.details', 'Details')");

  // i18n parity for toast.details:
  const dict = legacyDictText();
  const row = dict.match(/'toast\.details':\s*\{([^}]+)\}/);
  assert.ok(row, "i18n-dict.js missing 'toast.details'");
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
      `'toast.details' must have a non-empty ${lang} value`);
  }

  // CSS contract — collapsible block exists:
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.toast\s+\.toast-detail\s*\{/, '.toast .toast-detail rule must exist');
  assert.match(css, /\.toast\s+\.toast-detail\s+>\s+code\s*\{/, '.toast .toast-detail > code rule must exist');
});

test('U-3 (v1.58.23): #/followup lastContact placeholder is computed as today − 14 days', () => {
  const mp = read('public', 'js', 'views', 'mode-page.js');
  // The placeholder for followup.lastContact must be computed at render
  // time from `new Date()` minus 14 days, not read from i18n directly.
  assert.match(
    mp,
    /cfg\.slug === 'followup' && spec\.name === 'lastContact'/,
    'mode-page.js must special-case followup.lastContact for dynamic placeholder',
  );
  assert.match(
    mp,
    /d\.setDate\(d\.getDate\(\) - 14\)/,
    'placeholder must subtract 14 days',
  );
  assert.match(
    mp,
    /d\.toISOString\(\)\.slice\(0,\s*10\)/,
    'placeholder must format as ISO YYYY-MM-DD via toISOString().slice(0, 10)',
  );
});

test('I18N-CL2 (v1.59.12): followup.lastPh dict value is a format hint, not a rotting calendar date', () => {
  // The dynamic placeholder lives in mode-page.js (locked above). The
  // dict fallback regressed to a frozen `2026-04-21` literal — harmless
  // (the view always overrides it) but it rots and would trip the
  // i18n-audit bare-date guard. v1.59.12 replaced it with a localized
  // format hint (YYYY-MM-DD / AAAA-MM-DD / ГГГГ-ММ-ДД).
  const dict = legacyDictText();
  const m = dict.match(/'followup\.lastPh':\s*\{[^}]*\}/);
  assert.ok(m, 'followup.lastPh must exist');
  assert.equal(/\b20\d{2}-\d{2}-\d{2}\b/.test(m[0]), false,
    `followup.lastPh must not be a hardcoded YYYY-MM-DD calendar date — got: ${m[0]}`);
  assert.match(m[0], /en:\s*'YYYY-MM-DD'/,
    'followup.lastPh[en] must be the format hint "YYYY-MM-DD"');
});

test('U-2 (v1.58.22): #/auto separates ✨ from the H1 via a .page-icon span', () => {
  const auto = read('public', 'js', 'views', 'auto.js');
  // Header must use the icon variant + emoji as a sibling span:
  assert.match(auto, /className:\s*'page-header page-header--icon'/,
    "auto.js header must use 'page-header page-header--icon'");
  assert.match(auto, /c\('span',\s*\{\s*className:\s*'page-icon',\s*'aria-hidden':\s*'true'\s*\},\s*'✨'\)/,
    'auto.js must emit ✨ as a separate <span class="page-icon" aria-hidden="true">');
  // The H1 i18n value must NOT include the leading ✨ anymore:
  const dict = legacyDictText();
  const row = dict.match(/'auto\.title':\s*\{([^}]+)\}/);
  assert.ok(row, 'auto.title row must exist');
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    const m = row[1].match(new RegExp(`${keyPat}\\s*:\\s*'([^']+)'`));
    assert.ok(m, `auto.title row missing ${lang}`);
    assert.ok(!/^✨/.test(m[1]),
      `auto.title[${lang}] must not start with ✨ (moved to .page-icon span): '${m[1]}'`);
  }
  // CSS must define the grid header + icon class:
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.page-header--icon\s*\{[^}]*display:\s*grid/,
    '.page-header--icon must declare display: grid');
  assert.match(css, /\.page-icon\s*\{[^}]*line-height:\s*1/,
    '.page-icon rule must exist');
});

test('U-1 (v1.58.21): #/cv has a proper page-header H1 + subtitle (no `.cv-breadcrumb` chip)', () => {
  const cv = read('public', 'js', 'views', 'cv.js');
  // Pre-fix chip class is gone:
  assert.ok(!/className:\s*'page-title cv-breadcrumb'/.test(cv),
    "'.cv-breadcrumb' chip class must be removed");
  // New H1 + subtitle pair:
  assert.match(cv, /c\('h1',\s*\{\s*className:\s*'page-title'\s*\},\s*t\('cv\.title'\)\)/,
    "cv.js must render <h1 class=\"page-title\">{t('cv.title')}</h1>");
  assert.match(cv, /c\('p',\s*\{\s*className:\s*'page-subtitle'\s*\},\s*t\('cv\.subtitle'\)\)/,
    "cv.js must render <p class=\"page-subtitle\">{t('cv.subtitle')}</p>");
  // Single-H1 invariant still holds — cv.js has exactly one h1 occurrence in the header.
  const h1Count = (cv.match(/c\('h1'/g) || []).length;
  assert.equal(h1Count, 1, `cv.js must declare exactly one <h1>, got ${h1Count}`);
});

test('I-6 (v1.58.20): footer hotkey uses {hotkey} placeholder + per-platform substitution', () => {
  // v1.58.3 footer showed 'CTRL+K — search' literally on every platform
  // and locale. The i18n value now embeds {hotkey} so app.js can swap
  // it to ⌘K on Mac and Ctrl+K elsewhere; the localized verb stays.
  const dict = legacyDictText();
  assert.match(dict, /'top\.langhint':\s*\{\s*en:\s*'\{hotkey\} — search'/,
    "top.langhint EN must use '{hotkey} — search'");
  for (const lang of ['es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW']) {
    const quotedKey = /-/.test(lang) ? `'${lang}'` : lang;
    assert.match(dict, new RegExp(`${quotedKey.replace(/[\.]/g, '\\.')}:\\s*'\\{hotkey\\} — [^']+'`),
      `top.langhint ${lang} must use '{hotkey} — <verb>' shape`);
  }
  // app.js must apply the platform-specific substitution.
  const app = read('public', 'js', 'app.js');
  assert.match(app, /applyFooterHotkey/, 'app.js must define applyFooterHotkey()');
  assert.match(app, /isMac\s*\?\s*'⌘K'\s*:\s*'Ctrl\+K'/,
    'applyFooterHotkey must branch ⌘K vs Ctrl+K');
  assert.match(app, /\.replace\(\/\\\{hotkey\\\}\/g,\s*hotkey\)/,
    "applyFooterHotkey must substitute {hotkey} placeholder");
  assert.match(app, /I18n\.onChange\(applyFooterHotkey\)/,
    'applyFooterHotkey must re-run on every language change');
});

test('I-4 (v1.58.19): RU followup strings contain no Latin `cadence`/`follow-up` leakage', () => {
  // v1.58.3: RU `#/followup` H1 was 'Советник по cadence follow-up'; subtitle
  // 'ISO-дата (YYYY-MM-DD) — основа для cadence.'. Translate.
  const dict = legacyDictText();
  const ruFollowup = dict.split('\n')
    .filter((l) => /^\s*'followup\./.test(l))
    .map((l) => {
      const m = l.match(/ru:\s*'([^']+)'/);
      return m ? m[1] : null;
    })
    .filter(Boolean);
  assert.ok(ruFollowup.length >= 10, 'should find ≥ 10 followup.* RU strings');
  for (const s of ruFollowup) {
    assert.ok(!/\bcadence\b/i.test(s),
      `RU followup string must not contain 'cadence': ${s}`);
    assert.ok(!/\bfollow-up\b/i.test(s),
      `RU followup string must not contain 'follow-up': ${s}`);
  }
});

test('I-3 (v1.58.18): help TOC items 2/5/13/14 contain no Latin English bleed in non-Latin locales', () => {
  // v1.58.3 regression: '## 2. App settings & API keys', '## 5. Portals
  // & Sources', '## 13. Mode prompts', '## 14. Apply checklist' bled
  // English into ru / ja / ko / zh-CN / zh-TW help bundles. Items 2,
  // 5, 13, 14 must now contain no top-level English glossary terms
  // (App, settings, Apply, checklist, Portals, Sources, Mode, prompts)
  // in those 5 locales.
  const banned = /\b(App|settings|Apply|checklist|Portals|Sources|Mode|prompts)\b/;
  for (const locale of ['ru', 'ja', 'ko-KR', 'zh-CN', 'zh-TW']) {
    const text = read('docs', 'help', `${locale}.md`);
    for (const n of [2, 5, 13, 14]) {
      const re = new RegExp(`^## ${n}\\. (.+)$`, 'm');
      const m = text.match(re);
      assert.ok(m, `${locale}.md missing H2 item ${n}`);
      assert.ok(!banned.test(m[1]),
        `${locale}.md H2 item ${n} still contains English: ${m[1]}`);
    }
  }
});

test('I-2 (v1.58.17): formatRelative uses Intl.RelativeTimeFormat with the active locale', () => {
  const deep = read('public', 'js', 'views', 'deep.js');
  // The pre-fix hardcoded English strings are gone:
  assert.ok(!/return 'today';\s*\n\s*if \(days === 1\) return '1d ago'/.test(deep),
    "pre-fix hardcoded 'today' / '1d ago' / 'Nd ago' must be removed");
  // The new path must call Intl.RelativeTimeFormat with I18n.getLang() and numeric:auto:
  assert.match(deep, /new Intl\.RelativeTimeFormat\(locale,\s*\{\s*numeric:\s*'auto'\s*\}\)/,
    'formatRelative must use Intl.RelativeTimeFormat(locale, { numeric: "auto" })');
  assert.match(deep, /I18n\.getLang\(\)/,
    'formatRelative must read the active locale from I18n.getLang()');
  // Older dates fall back to a localized absolute via Intl.DateTimeFormat:
  assert.match(deep, /new Intl\.DateTimeFormat\(locale,\s*\{\s*dateStyle:\s*'medium'\s*\}\)/,
    'formatRelative must fall back to Intl.DateTimeFormat(locale, { dateStyle: "medium" })');
});

test('v1.58.16: btn-primary/btn-danger hover no longer flickers (gradient stays, filter dims)', () => {
  // Pre-fix the default background was a gradient and the :hover state
  // replaced it with a solid colour. CSS can't smoothly transition
  // gradient ↔ solid, so the 180ms transition snapped and the user
  // perceived a brief flash. The new rule keeps the gradient on hover
  // and dims via `filter: brightness(...)`, which interpolates cleanly.
  const css = read('public', 'css', 'app.css');
  // Pre-fix solid-background hover must be gone:
  assert.ok(
    !/\.btn-primary:hover\s*\{\s*background:\s*var\(--rausch-dark\)/.test(css),
    "'.btn-primary:hover' must not swap the gradient for a solid background"
  );
  assert.ok(
    !/\.btn-danger:hover\s*\{\s*background:\s*var\(--rausch-dark\)/.test(css),
    "'.btn-danger:hover' must not swap the gradient for a solid background"
  );
  // New filter-based hover must be present on both:
  assert.match(css, /\.btn-primary:hover\s*\{[^}]*filter:\s*brightness\(/,
    "'.btn-primary:hover' must dim via filter: brightness()");
  assert.match(css, /\.btn-danger:hover\s*\{[^}]*filter:\s*brightness\(/,
    "'.btn-danger:hover' must dim via filter: brightness()");
  // And `filter` must be in `.btn`'s transition list so the dim animates.
  assert.match(css, /\.btn\s*\{\s*transition:[^}]*filter\s+var\(--transition\)/m,
    '.btn transition must include `filter var(--transition)` so hover dim animates');
});

test('I-1 (v1.58.15): top-bar search aria-label + visually-hidden label are localized via data-i18n', () => {
  const html = read('public', 'index.html');
  // The visually-hidden <label> for the search input must declare its
  // i18n key so applyI18n() can swap the text on language change.
  assert.match(
    html,
    /<label for="global-search"[^>]*data-i18n="top\.search\.label"/,
    'visually-hidden label for #global-search must use data-i18n="top.search.label"'
  );
  // The input's aria-label must use the new data-i18n-aria-label hook.
  assert.match(
    html,
    /id="global-search"[\s\S]{0,400}?data-i18n-aria-label="top\.search\.aria"/,
    '#global-search must declare data-i18n-aria-label="top.search.aria"'
  );

  // app.js must process data-i18n-aria-label alongside data-i18n /
  // data-i18n-placeholder so the attribute actually swaps on lang
  // change (the contract is symmetric).
  const app = read('public', 'js', 'app.js');
  assert.match(
    app,
    /document\.querySelectorAll\('\[data-i18n-aria-label\]'\)\.forEach/,
    'applyI18n() must iterate [data-i18n-aria-label] and apply aria-label'
  );
  assert.match(
    app,
    /el\.setAttribute\('aria-label',\s*I18n\.t\(key,/,
    'data-i18n-aria-label handler must call el.setAttribute(aria-label, I18n.t(key, …))'
  );

  // i18n parity — both new keys present + non-trivially translated
  // (at least one non-EN locale differs from EN so the test catches a
  // fresh-add that forgot to translate).
  const dict = legacyDictText();
  for (const key of ['top.search.label', 'top.search.aria']) {
    const re = new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*\\{([^}]*)\\}`);
    const row = dict.match(re);
    assert.ok(row, `i18n-dict.js missing '${key}'`);
    for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
      const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
      assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
        `'${key}' must have a non-empty ${lang} value`);
    }
    // Sanity — at least one CJK / Cyrillic locale must differ from EN
    // (catches the accidental copy-paste-EN bug).
    const enM = row[1].match(/\ben:\s*['"]([^'"]+)['"]/);
    const ruM = row[1].match(/\bru:\s*['"]([^'"]+)['"]/);
    assert.ok(enM && ruM && enM[1] !== ruM[1],
      `'${key}' must have a non-English Russian translation`);
  }
});

test('M-9 (v1.58.14): connection-banner Refresh emits a localized toast (no silent reload)', () => {
  const app = read('public', 'js', 'app.js');
  // Click handler must show the in-flight toast (synchronous before
  // the reload steals the page).
  assert.match(app, /UI\.toast\(I18n\.t\('common\.refreshing',/,
    "Refresh click must show t('common.refreshing', …) before reload");
  // Reload must be deferred via setTimeout so the toast paints before
  // navigation; immediate location.reload() would swallow the toast.
  assert.match(app, /setTimeout\(\(\)\s*=>\s*location\.reload\(\),\s*\d+\)/,
    'Refresh reload must be deferred via setTimeout');
  // Per-button disabled guard prevents toast stacking on rapid clicks.
  assert.match(app, /refreshBtn\.disabled\s*=\s*true/,
    'Refresh button must disable itself to swallow rapid double-clicks');
  // sessionStorage handoff so the success toast survives the navigation.
  assert.match(app, /sessionStorage\.setItem\('refreshedToast'/,
    "Refresh must set sessionStorage['refreshedToast'] before reload");
  assert.match(app, /sessionStorage\.getItem\('refreshedToast'\)/,
    'next page boot must check sessionStorage for the pending toast');
  assert.match(app, /UI\.toast\(I18n\.t\('common\.refreshed',[^)]*\),\s*'success'\)/,
    "next page boot must emit t('common.refreshed', …) as a success toast");
  // Pre-fix silent `location.reload()` direct call (no toast, no
  // sessionStorage) must be gone.
  assert.ok(
    !/conn-refresh-btn[^\n]*addEventListener\('click',\s*\(\)\s*=>\s*location\.reload\(\)\)/.test(app),
    'pre-fix silent location.reload() handler must be replaced'
  );

  // i18n parity — both new keys present in all 8 locales.
  const dict = legacyDictText();
  for (const key of ['common.refreshing', 'common.refreshed']) {
    const re = new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*\\{([^}]*)\\}`);
    const row = dict.match(re);
    assert.ok(row, `i18n-dict.js missing '${key}'`);
    for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
      const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
      assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
        `'${key}' must have a non-empty ${lang} value`);
    }
  }
});

test('M-8 (v1.58.13): apply checklist renders interactive checkboxes + persists per URL', () => {
  const apply = read('public', 'js', 'views', 'apply.js');
  // Items render as real <input type="checkbox"> with index data attr.
  assert.match(apply, /type:\s*'checkbox'.*data-item-index/s,
    "apply.js must render each checklist item as <input type='checkbox' data-item-index=…>");
  // Each row uses a <label> wrapping checkbox + span so the click
  // target covers the full row (WCAG 2.5.5 / M-1 focus-visible).
  assert.match(apply, /c\('label',\s*null,\s*\[cb,\s*c\('span'/,
    'apply.js must wrap each checklist item in <label> for full-row click target');
  // State is persisted under the per-URL slug in localStorage.
  assert.match(apply, /STORAGE_PREFIX\s*=\s*'applyChecklist:'/,
    'apply.js must use the canonical applyChecklist: localStorage prefix');
  assert.match(apply, /function loadState\(/,
    'apply.js must define loadState() to rehydrate ticks across reloads');
  assert.match(apply, /function saveState\(/,
    'apply.js must define saveState() to persist ticks on every change');
  // Copy-unchecked and Reset buttons must be present.
  assert.match(apply, /t\('apply\.checklist\.copyUnchecked'/,
    'apply.js must use t(apply.checklist.copyUnchecked, ...) for the copy button');
  assert.match(apply, /t\('apply\.checklist\.resetBtn'/,
    'apply.js must use t(apply.checklist.resetBtn, ...) for the reset button');
  // Pre-fix raw <pre>…r.checklist…</pre> must be gone from the main
  // path (kept only as a defensive fallback when parseChecklist→0).
  assert.ok(
    !/c\('pre',\s*\{\s*className:\s*'console'\s*\},\s*r\.checklist\)\)/.test(apply),
    "apply.js must not render r.checklist as a plain <pre> in the happy path"
  );

  // CSS must define .apply-checklist with full-row click target sizing.
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.apply-checklist\s*\{/, 'app.css must define .apply-checklist');
  assert.match(css, /\.apply-checklist label\s*\{[^}]*min-height:\s*32px/m,
    '.apply-checklist label must have min-height ≥32px for click-target');
  assert.match(css, /\.apply-checklist__actions\b/,
    '.apply-checklist__actions container must be defined');

  // i18n parity — all 5 new checklist keys present in all 8 locales.
  const dict = legacyDictText();
  for (const key of [
    'apply.checklist.copyUnchecked',
    'apply.checklist.resetBtn',
    'apply.checklist.copied',
    'apply.checklist.copyFailed',
    'apply.checklist.reset',
  ]) {
    const re = new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*\\{([^}]*)\\}`);
    const row = dict.match(re);
    assert.ok(row, `i18n-dict.js missing '${key}'`);
    for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
      const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
      assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
        `'${key}' must have a non-empty ${lang} value`);
    }
  }
});

test('M-7 (v1.58.12): cost hint follows active provider; OpenRouter + null-cost path handled', () => {
  const api = read('public', 'js', 'api.js');
  // The EST map must include openrouter (was previously absent → fell
  // through to a generic 0.03 fallback that misrepresented the cost).
  assert.match(api, /EST\s*=\s*\{[^}]*openrouter:\s*null/m,
    'EST map must include openrouter with null (router picks → cost varies)');
  // The NAME map must also know about openrouter so the visible name
  // isn't the lowercase literal 'openrouter'.
  assert.match(api, /NAME\s*=\s*\{[^}]*openrouter:\s*'OpenRouter'/m,
    "NAME map must map openrouter → 'OpenRouter'");
  // The render path must branch on null cost and emit cost.varies
  // (no fabricated hard number for router-picks providers).
  assert.match(api, /EST\[st\.activeProvider\]\s*===\s*null/,
    'render path must branch on EST[active] === null');
  assert.match(api, /tr\('cost\.varies',\s*'cost varies/,
    "render path must use t('cost.varies', 'cost varies …') for the null-cost case");
  // i18n parity — cost.varies present in all 8 locales.
  const dict = legacyDictText();
  const row = dict.match(/'cost\.varies':\s*\{([^}]*)\}/);
  assert.ok(row, "i18n-dict.js missing 'cost.varies'");
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
      `'cost.varies' must have a non-empty ${lang} value`);
  }
});

test('M-4 (v1.58.11): saved-research card has CSS gap between title and date (no string concat)', () => {
  const deep = read('public', 'js', 'views', 'deep.js');
  // Title and date must be SEPARATE child elements with the new classes,
  // not concatenated strings. The date element must be semantic <time>
  // with a datetime attribute (a11y) — assert all three.
  assert.match(deep, /className: 'saved-card__title'/,
    'saved-research card must have a .saved-card__title element');
  assert.match(deep, /c\('time',\s*\{[^}]*className: 'saved-card__date'[^}]*datetime:/,
    'saved-research date must be a <time class="saved-card__date" datetime=...>');
  // The pre-fix inline marginLeft: 8px must be gone — gap is now structural CSS.
  assert.ok(!/marginLeft: '8px'.*formatRelative/s.test(deep),
    'pre-fix inline marginLeft string-concat must be removed');

  // CSS must define the .saved-card flex container with non-zero gap so
  // a future tweak to the JSX can't reintroduce the collapsed-margin bug.
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.saved-card\s*\{[^}]*display:\s*inline-flex[^}]*gap:\s*var\(--space-2[^)]*\)/m,
    '.saved-card must declare inline-flex + gap');
  assert.match(css, /\.saved-card__title\b/, 'CSS must define .saved-card__title');
  assert.match(css, /\.saved-card__date\b/,  'CSS must define .saved-card__date');
});

test('M-2 (v1.58.10): UI.modal() drains the progress toast at entry (defence-in-depth)', () => {
  // Health view already calls UI.dismissToast() at every modal-opening
  // site. cv.js's sync-check used to skip it → 'Running …' toast
  // overlapped the result modal. Re-route the drain into UI.modal so
  // every future call site is covered for free.
  const api = read('public', 'js', 'api.js');
  // The new auto-drain must be the FIRST executable statement of modal().
  assert.match(
    api,
    /function modal\(title, html, onClose\)\s*\{[\s\S]{0,1500}?dismissToast\(\);[\s\S]{0,400}?if \(_onClose\)/,
    'UI.modal must call dismissToast() before processing onClose'
  );

  // cv.js sync-check call site is now localized via t('cv.syncCheck',
  // 'sync-check') for both button label and modal title, satisfying the
  // BUG-008 'modal title == localized button label' invariant.
  const cv = read('public', 'js', 'views', 'cv.js');
  assert.match(cv, /UI\.toast\(t\('cv\.syncCheckRunning',/,
    "cv.js sync-check must use t('cv.syncCheckRunning', ...) for the progress toast");
  assert.match(cv, /UI\.modal\(t\('cv\.syncCheck',\s*'sync-check'\),/,
    "cv.js sync-check must use t('cv.syncCheck', 'sync-check') as the modal title");
  assert.ok(!/UI\.toast\('sync-check…'\)/.test(cv),
    "cv.js must not use the hardcoded English 'sync-check…' toast");

  // i18n parity — both keys present in all 8 locales.
  const dict = legacyDictText();
  for (const key of ['cv.syncCheck', 'cv.syncCheckRunning']) {
    const re = new RegExp(`'${key.replace('.', '\\.')}':\\s*\\{([^}]*)\\}`);
    const row = dict.match(re);
    assert.ok(row, `i18n-dict.js missing '${key}'`);
    for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
      const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
      assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
        `'${key}' must have a non-empty ${lang} value`);
    }
  }
});

test('M-1 (v1.58.9): form fields get a visible :focus-visible ring (WCAG 2.4.7)', () => {
  // The base .input/.textarea/.select rules in app.css zero `outline`
  // (to avoid mouse-focus ring noise), which silently overrode the
  // global `*:focus-visible` ring on every form field. Re-establish a
  // visible keyboard-only ring at higher specificity than the form-base.
  const css = read('public', 'css', 'app.css');
  // The new rule must declare a visible outline on input/textarea/select focus-visible.
  assert.match(
    css,
    /\.input:focus-visible,\s*\n\s*\.textarea:focus-visible,\s*\n\s*\.select:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--rausch[^)]*\)/m,
    'form-field :focus-visible must declare a 2px solid var(--rausch) outline'
  );
  // The searchbar input override (the global ⌘K/Ctrl K search) must also have a focus ring.
  assert.match(
    css,
    /\.searchbar input:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--rausch[^)]*\)/m,
    'searchbar input :focus-visible must declare a 2px solid var(--rausch) outline'
  );
  // The pre-existing global *:focus-visible ring must still be in place
  // (regression-lock the WCAG 2.4.7 invariant the new rules build on).
  assert.match(
    css,
    /\*:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--rausch[^)]*\)/m,
    'global *:focus-visible ring must remain in place'
  );
});

test('BUG-008-tb: top-bar Doctor modal title equals the localized button label (parity with Health page)', () => {
  // v1.58.6 — pre-fix, app.js passed the hardcoded English 'doctor' as
  // the modal title regardless of locale. Health-page passes
  // t('health.runDoctor'). Both entry-points must follow the
  // ledger BUG-008 invariant: modal-title == localized button label.
  const app = read('public', 'js', 'app.js');
  // The new modal call uses the same i18n key the <button> declares
  // via data-i18n="top.doctor" in index.html.
  assert.match(app, /UI\.modal\(I18n\.t\('top\.doctor', 'Doctor'\),/,
    "top-bar Doctor modal must look up t('top.doctor', 'Doctor') as its title");
  assert.ok(!/UI\.modal\('doctor',/.test(app),
    "top-bar Doctor modal title must not be the hardcoded lowercase 'doctor'");

  // The localized strings must exist in every locale so the modal title
  // never falls back to the English fallback string mid-flow.
  const dict = legacyDictText();
  const row = dict.match(/'top\.doctor':\s*\{([^}]*)\}/);
  assert.ok(row, "i18n-dict.js missing 'top.doctor' entry");
  for (const lang of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    // i18n-dict uses bare keys for short locales (en, es, ko, ja, ru)
    // and quoted keys for hyphenated locales (pt-BR, zh-CN, zh-TW).
    const keyPat = /-/.test(lang) ? `['"]${lang}['"]` : `(?:['"]${lang}['"]|${lang})`;
    assert.ok(new RegExp(`${keyPat}\\s*:\\s*['"][^'"]+['"]`).test(row[1]),
      `'top.doctor' must have a non-empty ${lang} value`);
  }

  // And the visible top-bar button declares the same key.
  const html = read('public', 'index.html');
  assert.match(html, /id="btn-doctor"[^>]*data-i18n="top\.doctor"/);
});

test('BUG-001: followup lastContact has an ISO-date pattern; validate() enforces spec.pattern', () => {
  const mp = read('public', 'js', 'views', 'mode-page.js');
  const field = mp.match(/name: 'lastContact'[\s\S]{0,800}?patternMsgFallback/);
  assert.ok(field, 'lastContact field missing pattern wiring');
  assert.ok(field[0].includes("patternMsgKey: 'followup.lastErr'"), 'lastContact missing patternMsgKey');
  // the source string literal is `'^\\d{4}-\\d{2}-\\d{2}$'` → two
  // backslash bytes per group; match them literally.
  assert.ok(field[0].includes('\\\\d{4}-\\\\d{2}-\\\\d{2}'), 'lastContact missing ISO-date pattern');
  assert.ok(mp.includes('spec.pattern && val && !new RegExp(spec.pattern).test(val)'),
    'validate() does not enforce spec.pattern');
});

test('BUG-004: router aliases #/outreach → contacto', () => {
  const r = read('public', 'js', 'router.js');
  assert.match(r, /outreach: 'contacto'/);
});

test('BUG-005: pipeline add surfaces server `deduped` as an info toast', () => {
  const p = read('public', 'js', 'views', 'pipeline.js');
  assert.match(p, /r\.deduped\) UI\.toast\(t\('pipe\.dup'/);
});

test('BUG-006: server returns a humanized, sentence-cased invalid-URL message', () => {
  const route = read('server', 'lib', 'routes', 'pipeline.mjs');
  assert.match(route, /That doesn't look like a valid job posting URL/);
  assert.ok(!/error: 'invalid url \(must be http/.test(route), 'old terse message must be gone');
});

test('BUG-010: reports empty state renders a page-subtitle', () => {
  const rep = read('public', 'js', 'views', 'reports.js');
  const empty = rep.match(/reports\.length === 0[\s\S]{0,600}?rep\.empty/);
  assert.ok(empty, 'empty-state block not found');
  assert.ok(empty[0].includes("rep.subtitle") && empty[0].includes('page-subtitle'),
    'empty state still missing the page-subtitle');
});

test('i18n: new QA keys cover all 8 locales', () => {
  const dict = legacyDictText();
  const locales = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr'];
  for (const key of ['followup.lastErr', 'pipe.dup', 'rep.subtitle']) {
    const line = dict.split('\n').find((l) => l.includes(`'${key}'`));
    assert.ok(line, `i18n key ${key} missing`);
    for (const loc of locales) {
      const tok = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
      assert.ok(line.includes(tok), `${key} missing locale ${loc}`);
    }
  }
});

test('I18N-012/013: Deep research is localized in Russian (no leftover English)', () => {
  const dict = legacyDictText();
  const title = dict.split('\n').find((l) => l.includes("'deep.title'"));
  assert.ok(!/ru: 'Deep research'/.test(title), 'deep.title ru still English');
  const sub = dict.split('\n').find((l) => l.includes("'deep.subtitle'"));
  assert.ok(!/smart questions/.test(sub.split("ru: '")[1].split("'")[0]),
    'deep.subtitle ru still contains untranslated "smart questions"');
});

test('BUG-002/UX-032: store.mjs allow-list flags fixtures + is exact-anchored (no false positives)', () => {
  // Static guard — robust + CI-isolated. checkProfileCustomized()
  // reads PATHS.profile (resolved once per process), so a multi-root
  // behavioural test can't run inside the shared `npm test` process;
  // assert the allow-list contract directly instead.
  const src = read('server', 'lib', 'store.mjs');
  for (const name of ['Acceptance Test', 'Real Person', 'QA', 'Sample User', 'Placeholder', 'Example User', 'Test User?']) {
    assert.ok(src.includes(name), `allow-list must flag "${name}"`);
  }
  assert.match(src, /still on template \/ test fixture/);

  // Pull the exact regex literal and prove it is ^…$-anchored +
  // case-insensitive, so a real name merely *containing* a fixture
  // word (e.g. "María Testanova") can never be false-flagged.
  const m = src.match(/if \(\/\^\((.+?)\)\$\/i\.test\(name\)\)/);
  assert.ok(m, 'allow-list must be a single ^(…)$/i anchored regex');
  const re = new RegExp('^(' + m[1] + ')$', 'i');
  assert.equal(re.test('Acceptance Test'), true);
  assert.equal(re.test('Real Person'), true);
  assert.equal(re.test('María Testanova'), false, 'real name containing "test" must NOT match');
  assert.equal(re.test('Testy McTestface'), false, 'substring "Test" must NOT match the anchored list');
});

// ── v1.58.3 — FIX-C2: <html lang> contract (the QA "stuck on en" was
// a stale-localStorage/pre-redeploy artifact; the code is correct —
// lock it so it can't regress). i18n.js is browser-only → static.
test('FIX-C2: i18n.js sets document.documentElement.lang on setLang AND at boot, detects navigator.language', () => {
  const src = read('public', 'js', 'lib', 'i18n.js');
  // setLang writes the attribute
  assert.match(src, /function setLang\(code\)\s*\{[\s\S]*document\.documentElement\.lang\s*=\s*code/,
    'setLang must set <html lang>');
  // boot sets it from the resolved current locale
  assert.match(src, /document\.documentElement\.lang\s*=\s*current/,
    'boot must set <html lang> from the resolved locale');
  // first-load detection from the browser
  assert.match(src, /navigator\.language/, 'must detect from navigator.language');
  // persisted choice
  assert.match(src, /STORAGE_KEY\s*=\s*'career-ops-ui:lang'/, 'locale persisted to localStorage');
});
