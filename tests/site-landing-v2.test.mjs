/**
 * Landing v2 guards (cvstart.org).
 *
 * The redesign moved the hero visual to a clearly-labelled simulated demo and
 * added four animation systems; the screenshot section now renders FRESH v2
 * captures (the 2026-10-27 refresh: dashboard ×19, job-map ×19, plus
 * scan/pipeline/tracker/reports EN) instead of any placeholder. These guards
 * pin the three invariants a future edit is most likely to silently break:
 *
 *   1. MOTION SAFETY — every animation in site/src/styles/global.css is
 *      either declared inside a `prefers-reduced-motion: no-preference`
 *      block or its exact selector is disabled by an `animation: none` in a
 *      `reduce` block. The static end-state is the default; motion is the
 *      enhancement.
 *   2. HONESTY — the demo is labelled as simulated, every screenshot slot
 *      renders a real capture of the current UI (no placeholder slots, no
 *      hand-off markers left in the tree), and alt texts describe what is
 *      actually shown.
 *   3. I18N — the keys exist (non-empty) in ALL 19 site locale files and the
 *      keys orphaned by the redesign are gone.
 *
 * CI-isolated: reads repo source files only; no server / network / browser.
 * (The one dist-based assertion self-skips unless `site/dist/` exists.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

test('every screenshot slot renders a fresh v2 capture — no placeholder remains', () => {
  assert.ok(
    !existsSync(resolve(SITE, 'src', 'components', 'ScreenshotSlot.astro')),
    'ScreenshotSlot.astro must be deleted — real captures replaced the placeholders',
  );

  const showcase = readFileSync(resolve(SITE, 'src', 'components', 'ScreenshotShowcase.astro'), 'utf8');
  assert.doesNotMatch(
    showcase,
    /ScreenshotSlot|shot-slot|placeholder/i,
    'showcase must not carry placeholder remnants',
  );
  assert.match(showcase, /astro:assets/, 'showcase must render real captures via astro:assets');
  // The four data-view tabs render the EN captures (only EN was captured for
  // them); each tab must name its capture file.
  for (const name of ['scan', 'pipeline', 'tracker', 'reports']) {
    assert.match(showcase, new RegExp(`${name}-en\\.png`), `tab ${name} must render ${name}-en.png`);
  }
  // The dashboard tab is per-locale (fresh ×19, same family as job-map).
  assert.match(showcase, /screenshotFor\(/, 'dashboard tab must pick the locale capture via lib/screenshots');

  // Dashboard sits in hero visibility — eager; the four data views lazy.
  // The panels share one templated <Picture>, so assert the loading contract
  // itself. NOTE: Astro's <Picture> destructures loading with a 'lazy'
  // DEFAULT, so `undefined` would still render lazy — the eager entry must
  // produce the literal 'eager'.
  assert.match(
    showcase,
    /loading=\{SHOTS\[tab\.name\]\.eager \? 'eager' : 'lazy'\}/,
    'the loading contract must be explicit (Picture defaults undefined to lazy)',
  );
  assert.doesNotMatch(showcase, /loading="lazy"/, 'no hardcoded lazy on the shared Picture (flag-driven instead)');
  assert.match(
    showcase,
    /dashboard: \{ src: screenshotFor\(locale\.file\), eager: true \}/,
    'the dashboard capture alone must be eager (hero visibility)',
  );

  const jobMap = readFileSync(resolve(SITE, 'src', 'components', 'JobMapShowcase.astro'), 'utf8');
  assert.doesNotMatch(jobMap, /ScreenshotSlot|shot-slot|placeholder/i, 'job-map must not carry placeholder remnants');
  assert.match(jobMap, /jobMapShotFor\(/, 'job-map must use the per-locale + en-fallback helper');
  assert.match(jobMap, /<Picture/, 'job-map must render the real capture');

  const lib = readFileSync(resolve(SITE, 'src', 'lib', 'screenshots.ts'), 'utf8');
  assert.match(lib, /import\.meta\.glob/, 'helper must resolve the synced assets via import.meta.glob');
  assert.match(lib, /job-map-en\.png/, 'helper must pin the en fallback');

  // Honesty: the alts describe real UI — they must not promise a future state.
  const en = JSON.parse(readFileSync(resolve(SITE, 'src', 'i18n', 'en.json'), 'utf8'));
  for (const k of ['map.alt', 'showcase.alt.dashboard', 'showcase.alt.scan', 'showcase.alt.pipeline', 'showcase.alt.tracker', 'showcase.alt.reports']) {
    assert.doesNotMatch(en[k], /placeholder|coming soon/i, `alt ${k} must describe the capture, not a promise`);
  }
});

test('no placeholder hand-off markers remain anywhere in site/ or tests/', () => {
  const hits = [];
  // Assembled so this file's own source does not carry the contiguous marker.
  const MARKER = ['CAR', '140'].join('-');
  // node_modules/dist/.astro are tooling output; content/ + generated/ are
  // written by sync-assets at prebuild and mirror the repo CHANGELOGs/help
  // verbatim — release-notes prose legitimately names the (now closed) work
  // item, and the changelog-parity gates pin that text. Hand-written source
  // must be clean; generated mirrors are out of scope.
  const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', 'content', 'generated']);
  const TEXT = /\.(mjs|js|astro|ts|css|json|md|html|txt|yml)$/;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(p);
      } else if (TEXT.test(e.name) && readFileSync(p, 'utf8').includes(MARKER)) {
        hits.push(p);
      }
    }
  };
  walk(SITE);
  walk(resolve(ROOT, 'tests'));
  assert.deepEqual(hits, [], `placeholder hand-off markers left in:\n  ${hits.join('\n  ')}`);
});

test('the built EN landing renders the real captures (when dist exists)', () => {
  const index = resolve(SITE, 'dist', 'index.html');
  if (!existsSync(index)) return; // dist is a build artifact — checked after `cd site && npm run build`
  const html = readFileSync(index, 'utf8');
  assert.doesNotMatch(html, /placeholder/i, 'dist/index.html must not mention placeholders');
  for (const name of ['dashboard', 'scan', 'pipeline', 'tracker', 'reports']) {
    assert.match(html, new RegExp(`${name}-en\\.[a-zA-Z0-9_.-]+\\.(?:png|webp|avif)`),
      `dist/index.html must embed a ${name} capture`);
  }
  // Loading contract survived the build: dashboard eager (hero visibility),
  // the data views lazy.
  const imgTag = (needle) => html.match(new RegExp(`<img[^>]*${needle}[^>]*>`))?.[0] ?? '';
  assert.doesNotMatch(imgTag('dashboard-en'), /loading="lazy"/, 'dashboard capture must render eager');
  assert.match(imgTag('scan-en'), /loading="lazy"/, 'scan capture must render lazy');
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
  // CAR-138: the registry note below the band is placeholder-substituted too —
  // a typed 121/116/5 in any dictionary is exactly the drift the band forbids.
  assert.match(stats, /replace\('\{sources\}'/, 'stats.note must substitute {sources}');
  assert.match(stats, /facts\.adaptersEn/, 'the EN-adapter count must come from facts');
  assert.match(stats, /facts\.adaptersRu/, 'the RU-board count must come from facts');
  // No hardcoded count in the rendered markup (the verified comment lives in
  // the frontmatter; digits there are fine).
  const markup = stats.slice(stats.indexOf('---', 4) + 3);
  assert.doesNotMatch(markup, /\b12[01]\b/, 'rendered markup must not hardcode the sources count');
});

test('CAR-138 — site page facts derive from facts.json, never typed by hand', () => {
  const VI = {
    en: 'Vietnamese', ru: 'вьетнамский', ar: 'الفيتنامية', da: 'vietnamesisk',
    de: 'Vietnamesisch', es: 'vietnamita', fr: 'vietnamien', hi: 'वियतनामी',
    it: 'vietnamita', ja: 'ベトナム語', ko: '베트남어', pl: 'wietnamski',
    'pt-BR': 'vietnamita', ta: 'வியட்நாமீஸ்', tr: 'Vietnamca', uk: "в'єтнамська",
    vi: 'Tiếng Việt', 'zh-CN': '越南语', 'zh-TW': '越南文',
  };
  assert.equal(Object.keys(VI).length, SITE_LOCALES.length, 'the Vietnamese word map must cover every site locale');
  for (const code of SITE_LOCALES) {
    const dict = JSON.parse(readFileSync(resolve(SITE, 'src', 'i18n', `${code}.json`), 'utf8'));
    // stats.note: placeholders only — no typed counts left in any locale
    assert.doesNotMatch(dict['stats.note'], /\d/, `${code}.stats.note must not carry typed counts`);
    assert.ok(dict['stats.note'].includes('{sources}') && dict['stats.note'].includes('{en}') && dict['stats.note'].includes('{ru}'),
      `${code}.stats.note must carry the {sources}/{en}/{ru} placeholders`);
    // changelog.lead: the language count is a placeholder
    assert.doesNotMatch(dict['changelog.lead'], /18|19/, `${code}.changelog.lead must not carry a typed language count`);
    assert.ok(dict['changelog.lead'].includes('{n}'), `${code}.changelog.lead must carry {n}`);
    // faq.a8: the enumerated language list must include Vietnamese (v1.255.0)
    assert.ok(dict['faq.a8'].includes(VI[code]), `${code}.faq.a8 must list Vietnamese`);
  }
  // the substitution sites actually consume facts
  const changelogPage = readFileSync(resolve(SITE, 'src', 'components', 'ChangelogPage.astro'), 'utf8');
  assert.match(changelogPage, /replace\('\{n\}', String\(facts\.locales\)\)/,
    'changelog.lead must substitute {n} from facts.locales');
});

test('the landing screenshot keys exist in all 19 site locale dictionaries', () => {
  const KEYS = [
    'hero.ctaDocs',
    'demo.badge', 'demo.note', 'demo.stageScan', 'demo.stageEval', 'demo.stageTrack', 'demo.a11y',
    'a11y.shotTabs',
    'showcase.alt.dashboard', 'showcase.alt.scan', 'showcase.alt.pipeline',
    'showcase.alt.tracker', 'showcase.alt.reports',
    'showcase.tabDashboard', 'showcase.tabScan', 'showcase.tabPipeline',
    'showcase.tabTracker', 'showcase.tabReports',
    'stats.t.sources', 'stats.t.tests', 'stats.t.langs', 'stats.t.providers', 'stats.t.license',
    'stats.t.local', 'stats.note',
    'map.alt',
  ];
  assert.equal(KEYS.length, 26);
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
    'showcase.placeholder', 'map.placeholder',
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
