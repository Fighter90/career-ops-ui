/**
 * CAR-133 — landing v2 guards (cvstart.org).
 *
 * The redesign replaced every screenshot on the landing (all of them predated
 * the v1.260.0 v2 pipeline/tracker/reports views) with labelled placeholders
 * for CAR-140, moved the hero visual to a clearly-labelled simulated demo,
 * and added four animation systems. These guards pin the three invariants a
 * future edit is most likely to silently break:
 *
 *   1. MOTION SAFETY — every animation in site/src/styles/global.css is
 *      either declared inside a `prefers-reduced-motion: no-preference`
 *      block or its exact selector is disabled by an `animation: none` in a
 *      `reduce` block. The static end-state is the default; motion is the
 *      enhancement.
 *   2. HONESTY — the demo is labelled as simulated, the placeholder slots
 *      carry the CAR-140 marker, and no component renders the stale
 *      dashboard/job-map captures anymore.
 *   3. I18N — the new keys exist (non-empty) in ALL 19 site locale files
 *      and the keys orphaned by the redesign are gone.
 *
 * CI-isolated: reads repo source files only; no server / network / browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = resolve(ROOT, 'site');
const CSS = readFileSync(resolve(SITE, 'src', 'styles', 'global.css'), 'utf8');

const SITE_LOCALES = [
  'en', 'es', 'fr', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW',
  'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi',
];

const NO_PREF = 'prefers-reduced-motion: no-preference';
const REDUCE = 'prefers-reduced-motion: reduce';

/**
 * Parse plain CSS (no strings containing braces in this file) into rules:
 *   { selectors: string[], decls: string, inNoPref: boolean, inReduce: boolean }
 * @media flags OR-accumulate through nesting; @keyframes/inner blocks are
 * skipped as rule sources.
 */
function parseRules(text) {
  const stack = []; // { type, nopref?, reduce?, selectors?, decls? }
  const rules = [];
  let buf = '';
  const mediaFlags = () => ({
    inNoPref: stack.some((e) => e.nopref === true),
    inReduce: stack.some((e) => e.reduce === true),
  });
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    if (ch === '{') {
      const prelude = buf.trim();
      buf = '';
      const top = stack[stack.length - 1];
      if (top && (top.type === 'keyframes' || top.type === 'kf-inner')) {
        stack.push({ type: 'kf-inner' });
      } else if (prelude.startsWith('@keyframes')) {
        stack.push({ type: 'keyframes' });
      } else if (prelude.startsWith('@media')) {
        stack.push({ type: 'media', nopref: prelude.includes(NO_PREF), reduce: prelude.includes(REDUCE) });
      } else if (prelude.startsWith('@')) {
        stack.push({ type: 'other' }); // @theme, @layer, …
      } else {
        stack.push({
          type: 'rule',
          selectors: prelude.split(',').map((s) => s.trim()).filter(Boolean),
          decls: '',
        });
      }
      continue;
    }
    if (ch === '}') {
      const popped = stack.pop();
      if (popped && popped.type === 'rule') {
        rules.push({ selectors: popped.selectors, decls: buf, ...mediaFlags() });
      }
      buf = '';
      continue;
    }
    buf += ch;
  }
  return rules;
}

/** Every `animation:` declaration found, `none` included. */
function animationDecls(rules) {
  const out = [];
  for (const r of rules) {
    for (const m of r.decls.matchAll(/animation(?:-name)?:\s*([^;}]+)/g)) {
      out.push({ selectors: r.selectors, decl: m[1].trim(), inNoPref: r.inNoPref, inReduce: r.inReduce });
    }
  }
  return out;
}

test('every animation declaration in global.css is motion-safe', () => {
  const rules = parseRules(CSS);
  assert.ok(rules.length > 40, `parser found only ${rules.length} rules — it is broken`);

  // Selectors the reduce blocks explicitly disable with `animation: none`.
  const disabled = new Set();
  for (const r of rules) {
    if (r.inReduce && /animation(?:-name)?:\s*none/.test(r.decls)) {
      for (const s of r.selectors) disabled.add(s);
    }
  }

  // A declaration OUTSIDE a no-preference block is only safe if every
  // selector it applies to is disabled in a reduce block.
  const unsafe = animationDecls(rules)
    .filter((d) => d.decl !== 'none' && !d.inNoPref)
    .filter((d) => !d.selectors.every((s) => disabled.has(s)))
    .map((d) => `${d.selectors.join(', ')} → animation: ${d.decl}`);

  assert.deepEqual(
    unsafe,
    [],
    'animation declared outside @media (prefers-reduced-motion: no-preference) and not disabled ' +
      'in a reduce block — move it inside the no-preference block or add an animation: none override:\n  ' +
      unsafe.join('\n  '),
  );
  assert.ok(
    disabled.size >= 3,
    'expected the reduce block to explicitly disable the pre-existing reveal/hero/terminal animations',
  );
});

test('the CAR-133 keyframes exist and are only referenced from motion-gated context', () => {
  for (const kf of ['demo-flow', 'demo-score-pop', 'demo-chip-pop']) {
    assert.match(CSS, new RegExp(`@keyframes ${kf}\\b`), `@keyframes ${kf} missing`);
  }
  // The static (default) demo composition must not animate — the composed
  // end-state is what reduced-motion and no-JS readers get.
  const start = CSS.indexOf('.demo-score,');
  const staticBlock = CSS.slice(start, CSS.indexOf('@media', start));
  assert.ok(staticBlock.includes('.demo-row-3 .demo-chip'), 'static demo composition lost');
  assert.doesNotMatch(staticBlock, /animation:/, 'static demo rules must not animate');
});

test('hero shows the simulated demo, not a stale screenshot', () => {
  const hero = readFileSync(resolve(SITE, 'src', 'components', 'Hero.astro'), 'utf8');
  assert.match(hero, /<DemoPanel/, 'hero must render the simulated demo');
  assert.doesNotMatch(hero, /astro:assets|<Picture|screenshotFor/, 'hero must not render a screenshot');
  assert.match(hero, /demo\.a11y/, 'the demo figure needs its aria-label');
  assert.match(hero, /hero\.ctaDocs/, 'hero needs the docs CTA next to the GitHub CTA');
  assert.match(hero, /data-parallax=/, 'hero parallax layers must be marked');

  const demo = readFileSync(resolve(SITE, 'src', 'components', 'DemoPanel.astro'), 'utf8');
  assert.match(demo, /demo\.badge/, 'demo must carry the "Simulated demo" badge');
  assert.match(demo, /aria-hidden="true"/, 'demo rows are decorative — aria-hidden');
});

test('screenshot slots carry the CAR-140 marker; no stale capture is rendered', () => {
  const slot = readFileSync(resolve(SITE, 'src', 'components', 'ScreenshotSlot.astro'), 'utf8');
  assert.match(slot, /CAR-140: replace this placeholder/, 'slot missing the CAR-140 hand-off marker');

  for (const comp of ['ScreenshotShowcase.astro', 'JobMapShowcase.astro']) {
    const src = readFileSync(resolve(SITE, 'src', 'components', comp), 'utf8');
    assert.match(src, /<ScreenshotSlot/, `${comp} must use the placeholder slot`);
    assert.doesNotMatch(src, /astro:assets|<Picture/, `${comp} must not render a stale capture`);
  }
  assert.ok(
    !existsSync(resolve(SITE, 'src', 'lib', 'screenshots.ts')),
    'lib/screenshots.ts should be gone — nothing renders the stale captures',
  );
});

test('the screenshot switcher is a real ARIA tablist reusing the site tab engine', () => {
  const showcase = readFileSync(resolve(SITE, 'src', 'components', 'ScreenshotShowcase.astro'), 'utf8');
  assert.match(showcase, /role="tablist"/, 'missing tablist');
  assert.match(showcase, /role="tab"/, 'missing tabs');
  assert.match(showcase, /role="tabpanel"/, 'missing tabpanels');
  assert.match(showcase, /data-install/, 'must reuse the generic [data-install] tab engine (no new JS)');
  assert.match(showcase, /a11y\.shotTabs/, 'tablist needs an accessible name');
  // The component builds its keys dynamically — pin the exact key set they
  // resolve to, against the EN dictionary.
  const NAMES = ['dashboard', 'scan', 'pipeline', 'tracker', 'reports'];
  for (const name of NAMES) assert.match(showcase, new RegExp(`'${name}'`), `tab "${name}" missing`);
  const en = JSON.parse(readFileSync(resolve(SITE, 'src', 'i18n', 'en.json'), 'utf8'));
  for (const name of NAMES) {
    const key = `showcase.tab${name[0].toUpperCase()}${name.slice(1)}`;
    assert.equal(typeof en[key], 'string', `en.json missing ${key} (the dynamic builder resolves to it)`);
  }
});

test('the numbers band derives every count from facts.json (never a literal)', () => {
  const stats = readFileSync(resolve(SITE, 'src', 'components', 'StatsBar.astro'), 'utf8');
  assert.match(stats, /facts\.sources\.length/, 'sources tile must come from the registry snapshot');
  assert.match(stats, /facts\.tests/, 'tests tile must come from facts');
  assert.match(stats, /facts\.locales/, 'locales tile must come from facts');
  assert.match(stats, /VERIFIED 2026-10-27/, 'the verification-date comment must stay');
  // No hardcoded count in the rendered markup (the verified comment lives in
  // the frontmatter; digits there are fine).
  const markup = stats.slice(stats.indexOf('---', 4) + 3);
  assert.doesNotMatch(markup, /\b12[01]\b/, 'rendered markup must not hardcode the sources count');
});

test('the 22 CAR-133 keys exist in all 19 site locale dictionaries', () => {
  const KEYS = [
    'hero.ctaDocs',
    'demo.badge', 'demo.note', 'demo.stageScan', 'demo.stageEval', 'demo.stageTrack', 'demo.a11y',
    'a11y.shotTabs',
    'showcase.placeholder', 'showcase.tabDashboard', 'showcase.tabScan', 'showcase.tabPipeline',
    'showcase.tabTracker', 'showcase.tabReports',
    'stats.t.sources', 'stats.t.tests', 'stats.t.langs', 'stats.t.providers', 'stats.t.license',
    'stats.t.local', 'stats.note',
    'map.placeholder',
  ];
  assert.equal(KEYS.length, 22);
  for (const code of SITE_LOCALES) {
    const dict = JSON.parse(readFileSync(resolve(SITE, 'src', 'i18n', `${code}.json`), 'utf8'));
    for (const k of KEYS) {
      assert.equal(typeof dict[k], 'string', `${code}.json missing ${k}`);
      assert.ok(dict[k].trim().length > 0, `${code}.json empty ${k}`);
    }
  }
});

test('the keys orphaned by the redesign are gone from all 19 dictionaries', () => {
  const DEAD = ['hero.alt', 'a11y.browserFrame', 'showcase.alt',
    'stats.mit', 'stats.langs', 'stats.adapters', 'stats.providers', 'stats.tests', 'stats.local'];
  for (const code of SITE_LOCALES) {
    const dict = JSON.parse(readFileSync(resolve(SITE, 'src', 'i18n', `${code}.json`), 'utf8'));
    for (const k of DEAD) {
      assert.equal(dict[k], undefined, `${code}.json still carries dead key ${k}`);
    }
  }
});

test('site.js keeps both new effects double-gated (JS media query + CSS media query)', () => {
  const js = readFileSync(resolve(SITE, 'src', 'scripts', 'site.js'), 'utf8');
  const parallax = js.slice(js.indexOf('CAR-133: hero parallax'));
  const countup = js.slice(js.indexOf('CAR-133: numbers band count-up'));
  assert.match(parallax, /prefers-reduced-motion: reduce/, 'parallax must check reduced motion in JS too');
  assert.match(parallax, /hover: hover[\s\S]*pointer: fine/, 'parallax must be fine-pointer only');
  assert.match(countup, /prefers-reduced-motion: reduce/, 'count-up must check reduced motion in JS too');
  assert.match(countup, /IntersectionObserver/, 'count-up reveals via IntersectionObserver');
});
