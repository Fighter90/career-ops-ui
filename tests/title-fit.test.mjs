/**
 * title-fit — free banded title-vs-profile fit hint on #/scan rows.
 *
 * Parity port of the parent's tests/title-fit.test.mjs (career-ops b0805395,
 * #3260/#3261): every parent case is reproduced against server/lib/title-fit.mjs
 * so the two UIs band the same posting identically. On top of that:
 *   - profileTargetRoles mirrors the parent's profileTargetKeywords;
 *   - loadProfileTargetRoles reads config/profile.yml tolerantly;
 *   - annotateSnapshotFit is annotation-only (order, counts, fields untouched);
 *   - GET /api/scan-results serves rows with `fit` (and without, when the
 *     profile has no target roles), in both bare and paged modes;
 *   - the SPA row renderer shows the band word via t() keys, never the score.
 *
 * CI isolation: CAREER_OPS_ROOT is a fresh mkdtemp, every server import is
 * dynamic inside before(), no network beyond the in-process ephemeral port.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let dir, server, baseUrl;
let titleFit, profileTargetRoles, loadProfileTargetRoles, annotateSnapshotFit;

const job = (title, extra = {}) => ({ title, company: 'Acme', url: `https://x/${encodeURIComponent(title)}`, ...extra });

const SNAPSHOT = {
  en: {
    kind: 'en', when: '2026-09-26T10:00:00Z', errors: [],
    fresh: [job('Staff Engineer, Platform')],
    filtered: [job('Product Designer'), job('Staff Engineer, Platform'), job('Data Engineer')],
  },
  ru: {
    kind: 'ru', when: '2026-09-26T09:58:00Z', errors: [],
    fresh: [],
    filtered: [job('!!!'), job('Senior Platform Engineer', { _boosted: true })],
  },
};

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'titlefit-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'last-scan.json'), JSON.stringify(SNAPSHOT));
  writeFileSync(resolve(dir, 'config', 'profile.yml'),
    'candidate:\n  full_name: X\ntarget_roles:\n  primary:\n    - platform engineer\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ titleFit, profileTargetRoles, loadProfileTargetRoles, annotateSnapshotFit } =
    await import('../server/lib/title-fit.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); });
  });
});

after(async () => {
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('titleFit — parent parity (b0805395)', () => {
  test('word-order/punctuation titles still band strong', () => {
    assert.deepEqual(titleFit('Staff Engineer, Platform', ['platform engineer']), { band: 'strong', score: 1 });
  });

  test('seniority words excluded on both title and target side', () => {
    assert.deepEqual(titleFit('Senior Staff Platform Engineer', ['platform engineer']), { band: 'strong', score: 1 });
    assert.equal(titleFit('Platform Engineer', ['senior platform engineer']).score, 1);
  });

  test('partial overlap → related, no overlap → weak (still returned)', () => {
    assert.equal(titleFit('Data Engineer', ['platform engineer']).band, 'related');
    assert.equal(titleFit('Product Designer', ['platform engineer']).band, 'weak');
  });

  test('best-matching target role wins across profile targets', () => {
    assert.equal(titleFit('Data Engineer', ['product designer', 'data engineer']).band, 'strong');
  });

  test('thresholds: >=0.6 strong, >=0.34 related, else weak (2dp scores)', () => {
    const t3 = ['alpha beta gamma'];
    assert.deepEqual(titleFit('x alpha beta', t3), { band: 'strong', score: 0.67 });
    assert.deepEqual(titleFit('x gamma', t3), { band: 'weak', score: 0.33 });
    assert.deepEqual(titleFit('x alpha', ['alpha beta']), { band: 'related', score: 0.5 });
  });

  test('empty title/targets/non-array targets → null, never a throw', () => {
    assert.equal(titleFit('Anything At All', []), null);
    assert.equal(titleFit('', ['engineer']), null);
    assert.equal(titleFit(null, ['engineer']), null);
    assert.equal(titleFit('Engineer', null), null);
    assert.equal(titleFit('Engineer', 'not an array'), null);
  });

  test('single-token target matches fully when present (documented behaviour)', () => {
    assert.deepEqual(titleFit('Warranty Engineer', ['engineer']), { band: 'strong', score: 1 });
  });

  test('trailing periods stripped; node.js / .net stay whole', () => {
    assert.deepEqual(titleFit('Platform Engineer.', ['platform engineer']), { band: 'strong', score: 1 });
    assert.equal(titleFit('Node.js Engineer', ['node.js engineer']).score, 1);
    assert.equal(titleFit('.NET Developer', ['.net developer']).score, 1);
  });

  test('deterministic for identical inputs', () => {
    const a = titleFit('Senior Platform Engineer', ['platform engineer', 'data engineer']);
    const b = titleFit('Senior Platform Engineer', ['platform engineer', 'data engineer']);
    assert.deepEqual(a, b);
  });

  test('non-Latin scripts tokenize (regional rows)', () => {
    assert.equal(titleFit('Менеджер продукта', ['менеджер продукта']).band, 'strong');
  });
});

describe('profileTargetRoles — mirror of parent profileTargetKeywords', () => {
  test('primary[] then archetypes[].name, order preserved', () => {
    assert.deepEqual(profileTargetRoles({
      target_roles: {
        primary: ['Platform Engineer', 'SRE'],
        archetypes: [{ name: 'AI Engineer', level: 'senior', fit: 'primary' }, { level: 'x' }, null],
      },
    }), ['Platform Engineer', 'SRE', 'AI Engineer']);
  });

  test('a string `primary` is ignored (parent parity — primary is a list)', () => {
    assert.deepEqual(profileTargetRoles({ target_roles: { primary: 'Platform Engineer' } }), []);
  });

  test('malformed / missing input never throws', () => {
    for (const bad of [null, undefined, 42, 'x', [], {}, { target_roles: null }, { target_roles: 'x' },
      { target_roles: { primary: [1, null, {}], archetypes: 'x' } }]) {
      assert.deepEqual(profileTargetRoles(bad), []);
    }
  });
});

describe('loadProfileTargetRoles — tolerant profile.yml read', () => {
  test('reads target roles from config/profile.yml under CAREER_OPS_ROOT', () => {
    assert.deepEqual(loadProfileTargetRoles(), ['platform engineer']);
  });

  test('missing file or invalid YAML → []', () => {
    assert.deepEqual(loadProfileTargetRoles(resolve(dir, 'config', 'nope.yml')), []);
    const bad = resolve(dir, 'config', 'bad.yml');
    writeFileSync(bad, 'target_roles: [unclosed\n  : :\n');
    assert.deepEqual(loadProfileTargetRoles(bad), []);
  });
});

describe('annotateSnapshotFit — annotation only', () => {
  test('attaches fit, preserves order/counts/fields, never mutates input', () => {
    const input = JSON.parse(JSON.stringify(SNAPSHOT));
    const before = JSON.stringify(input);
    const out = annotateSnapshotFit(input, ['platform engineer']);
    assert.equal(JSON.stringify(input), before, 'input must not be mutated');
    for (const region of ['en', 'ru']) {
      for (const set of ['fresh', 'filtered']) {
        assert.equal(out[region][set].length, input[region][set].length);
        assert.deepEqual(out[region][set].map((r) => r.title), input[region][set].map((r) => r.title));
      }
      assert.equal(out[region].when, input[region].when);
    }
    const [designer, platform, data] = out.en.filtered;
    assert.deepEqual(platform.fit, { band: 'strong', score: 1 });
    assert.equal(data.fit.band, 'related');
    assert.equal(designer.fit.band, 'weak');
    // Token-less title → key absent (not undefined).
    assert.equal('fit' in out.ru.filtered[0], false);
    assert.equal(out.ru.filtered[1]._boosted, true, 'other row fields survive');
  });

  test('no targets / odd snapshots → returned unchanged', () => {
    assert.equal(annotateSnapshotFit(SNAPSHOT, []), SNAPSHOT);
    assert.equal(annotateSnapshotFit(SNAPSHOT, null), SNAPSHOT);
    assert.deepEqual(annotateSnapshotFit({ en: null, ru: null }, ['x']), { en: null, ru: null });
    assert.equal(annotateSnapshotFit(null, ['x']), null);
  });
});

describe('GET /api/scan-results — fit attached server-side', () => {
  const get = async (qs = '') => (await fetch(`${baseUrl}/api/scan-results${qs}`)).json();

  test('bare snapshot rows carry fit; counts unchanged', async () => {
    const b = await get();
    assert.equal(b.en.filtered.length, 3);
    assert.equal(b.ru.filtered.length, 2);
    assert.deepEqual(b.en.fresh[0].fit, { band: 'strong', score: 1 });
    assert.equal(b.ru.filtered[1].fit.band, 'strong');
    assert.equal('fit' in b.ru.filtered[0], false);
  });

  test('paged mode rows carry fit too; total/order unchanged', async () => {
    const b = await get('?region=en&limit=10');
    assert.equal(b.total, 3);
    assert.deepEqual(b.rows.map((r) => r.title), SNAPSHOT.en.filtered.map((r) => r.title));
    assert.deepEqual(b.rows.map((r) => r.fit && r.fit.band), ['weak', 'strong', 'related']);
  });

  test('last-scan.json on disk is never rewritten', () => {
    assert.deepEqual(JSON.parse(readFileSync(resolve(dir, 'data', 'last-scan.json'), 'utf8')), SNAPSHOT);
  });

  test('profile without target roles → no fit on any row (no chips)', async () => {
    const p = resolve(dir, 'config', 'profile.yml');
    const orig = readFileSync(p, 'utf8');
    try {
      writeFileSync(p, 'candidate:\n  full_name: X\n');
      const b = await get();
      const all = [...b.en.fresh, ...b.en.filtered, ...b.ru.fresh, ...b.ru.filtered];
      assert.ok(all.length > 0);
      assert.ok(all.every((r) => !('fit' in r)));
      writeFileSync(p, ': : not yaml [\n');
      const b2 = await get();
      assert.ok([...b2.en.filtered, ...b2.ru.filtered].every((r) => !('fit' in r)));
    } finally {
      writeFileSync(p, orig);
    }
  });
});

describe('SPA row renderer (source-static)', () => {
  const src = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'scan-results.js'), 'utf8');

  test('band word + tooltip route through t() keys', () => {
    for (const k of ['scan.titleFit.strong', 'scan.titleFit.related', 'scan.titleFit.weak', 'scan.titleFitTip']) {
      assert.ok(src.includes(`t('${k}'`), `missing t('${k}')`);
    }
  });

  test('renders from r.fit.band only and never prints the score', () => {
    assert.match(src, /r\.fit && r\.fit\.band/);
    assert.doesNotMatch(src, /r\.fit\.score/, 'the score is for tests/debugging, not the UI');
  });

  test('every locale defines the four keys', () => {
    const langs = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];
    for (const lang of langs) {
      const dict = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'locales', `i18n-dict.${lang}.js`), 'utf8');
      for (const k of ['scan.titleFit.strong', 'scan.titleFit.related', 'scan.titleFit.weak', 'scan.titleFitTip']) {
        assert.ok(dict.includes(`'${k}':`), `${lang} missing ${k}`);
      }
    }
  });
});
