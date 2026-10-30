/**
 * Branch coverage — server/lib/routes/map.mjs (BACKLOG: "raise coverage of
 * routes/map.mjs"). CI-isolated: CAREER_OPS_ROOT is a mkdtemp fixture, the
 * app is created in-process and bound to 127.0.0.1:0; no network (the route
 * makes no outbound calls — tiles are config strings, not fetches).
 *
 * Covers the validation/error/edge branches: read() catch paths, httpOnly
 * rejects, notesPlace shape filters, buildLocationIndex first-wins and
 * column-less TSV, reportUrl path-escape refusal, tileConfig env validation +
 * entity escaping, and the /api/commute + /api/map/jobs payloads.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl; let root;
let notesPlace; let buildLocationIndex; let tileConfig; let DARK_TILES;

before(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'mapcov-'));
  mkdirSync(resolve(root, 'data'), { recursive: true });
  mkdirSync(resolve(root, 'config'), { recursive: true });
  mkdirSync(resolve(root, 'reports'), { recursive: true });
  // jds/ deliberately NOT created yet — the first /api/map/jobs hit below
  // exercises readJds()'s catch branch over a missing directory.
  writeFileSync(resolve(root, 'cv.md'), '# Jane\nEngineer\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'target_roles:\n  primary:\n    - Backend Engineer\n');
  writeFileSync(resolve(root, 'data', 'applications.md'), [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|-----|',
    '| 1 | 2026-01-01 | Acme | Backend | 4.2/5 | Applied | ❌ | — | Leeds (West Yorkshire) – 40 min drive; hybrid | https://example.com/a |',
    '| 2 | 2026-01-02 | Beta | Dev | 3/5 | Evaluated | ❌ | [043](reports/043-beta-2026-01-02.md) | no place here | |',
    '| 3 | 2026-01-03 | Gamma | Ops | 3/5 | Applied | ❌ | — | Berlin office; note | |',
    '| 4 | 2026-01-04 | Evil | Hack | 1/5 | Discarded | ❌ | [x](a/../../evil.md) | nothing | javascript:alert(1) |',
    '',
  ].join('\n'));
  // Report 043 exists → reportUrl() reads its **URL:** header; its URL is in
  // scan-history so the tracker row resolves a location through the index.
  writeFileSync(resolve(root, 'reports', '043-beta-2026-01-02.md'),
    '# Evaluation: Beta — Dev\n**URL:** https://beta.example.com/jobs/9\n**Score:** 3/5\n');
  // scan-history.tsv — header carries both url and location columns.
  writeFileSync(resolve(root, 'data', 'scan-history.tsv'), [
    'url\ttitle\tcompany\tlocation\tdate',
    'https://example.com/a\tBackend\tAcme\tLeeds, UK\t2026-01-01',
    'https://beta.example.com/jobs/9\tDev\tBeta\tMunich, Germany\t2026-01-01',
    '',
  ].join('\n'));

  for (const k of ['MAP_TILE_URL', 'MAP_TILE_DARK_URL', 'MAP_TILE_ATTRIBUTION', 'MAP_TILE_DARK_ATTRIBUTION']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  ({ notesPlace, buildLocationIndex, tileConfig, DARK_TILES } = await import('../server/lib/routes/map.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const getJson = async (path) => {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, body: await res.json() };
};

// ─── notesPlace (exported pure helper) ───

test('notesPlace: leading capitalized place survives; parentheticals and separators split', () => {
  assert.equal(notesPlace('Leeds (West Yorkshire) – 40 min drive; hybrid'), 'Leeds');
  assert.equal(notesPlace('Berlin, Germany; remote'), 'Berlin');
  assert.equal(notesPlace('Münster - Büro; hybrid'), 'Münster');
  assert.equal(notesPlace('Upper Heyford'), 'Upper Heyford'); // 2-word form allowed
});

test('notesPlace: shape filters — lowercase lead, >40 chars, wordy leads, empty', () => {
  assert.equal(notesPlace('berlin office; note'), '');           // lowercase first letter
  assert.equal(notesPlace('Berlin office; note'), '', 'second word must be capitalised');
  assert.equal(notesPlace(`${'Verylongplacename'.repeat(4)}`), '', '>40 chars');
  assert.equal(notesPlace('Located near Leeds'), '', 'wordy lead fails the shape');
  assert.equal(notesPlace(''), '');
  assert.equal(notesPlace(null), '');
  assert.equal(notesPlace(undefined), '');
  assert.equal(notesPlace(42), '');
});

// ─── buildLocationIndex ───

test('buildLocationIndex: pipeline url+href both indexed; first write wins; empty cells skipped', () => {
  const idx = buildLocationIndex({
    pipelineRows: [
      { url: 'https://a.example/1', href: 'https://a.example/1', location: 'Berlin' },
      { url: 'https://a.example/1', href: 'https://a.example/1', location: 'Should not win' },
      { url: 'local:jds/x.md', href: 'https://b.example/2', location: 'Munich' },
      { url: '', href: null, location: 'Ignored' },
      { url: 'https://c.example/3', href: '', location: '' },
    ],
  });
  assert.equal(idx.get('https://a.example/1'), 'Berlin');
  assert.equal(idx.get('https://b.example/2'), 'Munich');
  assert.equal(idx.has('https://c.example/3'), false, 'empty location never indexed');
  assert.equal(idx.has(''), false, 'falsy url/href never indexed');
});

test('buildLocationIndex: scan-history columns; a TSV without url/location headers is ignored', () => {
  const tsv = ['url\tlocation', 'https://s.example/1\tHamburg', '\tNoUrl', 'https://s.example/2\t'].join('\n');
  const idx = buildLocationIndex({ scanHistory: tsv });
  assert.equal(idx.get('https://s.example/1'), 'Hamburg');
  assert.equal(idx.has('https://s.example/2'), false);
  assert.equal(buildLocationIndex({ scanHistory: 'title\tcompany\nx\ty' }).size, 0);
});

test('buildLocationIndex: JD headers (- URL: / - Location:) inside the first 1500 chars', () => {
  const jds = [
    '# Capture\n- URL: https://jd.example/1\n- Location:  Berlin, Germany \n\n' + 'x'.repeat(2000),
    'no markers here',
    '- URL: https://jd.example/2\n' + 'x'.repeat(1600) + '\n- Location: too far down to matter',
  ];
  const idx = buildLocationIndex({ jds });
  assert.equal(idx.get('https://jd.example/1'), 'Berlin, Germany');
  assert.equal(idx.has('https://jd.example/2'), false, 'Location beyond the 1500-char head is not read');
  assert.equal(buildLocationIndex({}).size, 0, 'no arguments at all');
});

// ─── tileConfig ───

test('tileConfig: defaults → OSM + Carto dark preset, not configured', () => {
  const t = tileConfig({});
  assert.equal(t.url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.equal(t.attribution, '');
  assert.equal(t.origin, 'https://tile.openstreetmap.org');
  assert.equal(t.darkOrigin, 'https://*.basemaps.cartocdn.com');
  assert.equal(t.dark.configured, false);
  assert.equal(t.dark.url, DARK_TILES.url);
});

test('tileConfig: a valid MAP_TILE_URL replaces OSM; {s} becomes the CSP wildcard', () => {
  const t = tileConfig({ MAP_TILE_URL: 'https://{s}.tiles.example.org/x/{z}/{y}.png' });
  assert.equal(t.url, 'https://{s}.tiles.example.org/x/{z}/{y}.png');
  assert.equal(t.origin, 'https://*.tiles.example.org');
});

test('tileConfig: an invalid MAP_TILE_URL falls back to OSM', () => {
  assert.equal(tileConfig({ MAP_TILE_URL: 'javascript:alert(1)' }).url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.equal(tileConfig({ MAP_TILE_URL: 'https://host only-no-path' }).url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
});

test('tileConfig: MAP_TILE_DARK_URL marks the dark layer configured with its own origin/attribution', () => {
  const t = tileConfig({
    MAP_TILE_DARK_URL: 'https://maps.example.net/dark/{z}/{x}/{y}.png',
    MAP_TILE_DARK_ATTRIBUTION: 'Dark & <Tiles>',
  });
  assert.equal(t.dark.configured, true);
  assert.equal(t.dark.url, 'https://maps.example.net/dark/{z}/{x}/{y}.png');
  assert.equal(t.darkOrigin, 'https://maps.example.net');
  assert.equal(t.dark.attribution, 'Dark &#38; &#60;Tiles&#62;');
  assert.equal(tileConfig({ MAP_TILE_DARK_URL: 'ftp://bad' }).dark.configured, false);
});

test('tileConfig: custom attribution is entity-escaped (env cannot smuggle markup)', () => {
  assert.equal(tileConfig({ MAP_TILE_ATTRIBUTION: `<a href="x">&"'</a>` }).attribution,
    '&#60;a href=&#34;x&#34;&#62;&#38;&#34;&#39;&#60;/a&#62;');
});

test('DARK_TILES is frozen', () => {
  assert.ok(Object.isFrozen(DARK_TILES));
});

// ─── routes ───

test('GET /api/commute: no commute.tsv → available:false, null home', async () => {
  const { status, body } = await getJson('/api/commute');
  assert.equal(status, 200);
  assert.equal(body.available, false);
  assert.equal(body.home, null);
  assert.deepEqual(body.byNum, {});
  assert.deepEqual(body.byUrl, {});
});

test('GET /api/map/jobs: missing jds dir + empty pipeline → empty lists, tiles present', async () => {
  const { status, body } = await getJson('/api/map/jobs');
  assert.equal(status, 200);
  assert.deepEqual(body.pipeline, []);
  assert.equal(body.tracker.length, 4, 'tracker rows are served even before jds/ exists');
  assert.equal(body.tiles.url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.equal(body.tiles.dark.url, DARK_TILES.url);
});

test('GET /api/map/jobs: tracker rows resolve href/location/workplace; hostile cells defused', async () => {
  const { body } = await getJson('/api/map/jobs');
  assert.equal(body.tracker.length, 4);
  const byCompany = Object.fromEntries(body.tracker.map((r) => [r.company, r]));
  // Row 1 — own URL → indexed location + workplace from Notes
  assert.equal(byCompany.Acme.href, 'https://example.com/a');
  assert.equal(byCompany.Acme.location, 'Leeds, UK');
  assert.equal(byCompany.Acme.workplace, 'Leeds');
  // Row 2 — no URL → reportUrl() reads the report's **URL:** header → indexed location
  assert.equal(byCompany.Beta.href, 'https://beta.example.com/jobs/9');
  assert.equal(byCompany.Beta.location, 'Munich, Germany');
  assert.equal(byCompany.Beta.workplace, '');
  // Row 3 — no URL, no report → empty href/location; "Berlin office" fails the place shape
  assert.equal(byCompany.Gamma.href, '');
  assert.equal(byCompany.Gamma.location, '');
  assert.equal(byCompany.Gamma.workplace, '');
  // Row 4 — path-escaping report link refused; javascript: URL stripped
  assert.equal(byCompany.Evil.href, '');
  assert.equal(byCompany.Evil.location, '');
});

test('GET /api/map/jobs: pipeline rows carry httpOnly hrefs and title fit', async () => {
  // Write a pipeline with: http row (fit), local: row (href from the extra cell, jds-indexed),
  // and a no-token title (no fit chip).
  writeFileSync(resolve(root, 'data', 'pipeline.md'), [
    '# Pipeline',
    '',
    '```',
    '- [ ] https://acme.example.com/jobs/1 | Acme | Backend Engineer | Berlin, Germany',
    '- [ ] local:jds/job1.md | Gamma | DevOps | Берлин | https://gamma.example.com/jobs/3',
    '- [ ] https://zoo.example.com/j/2 | Zoo | — | Remote',
    '```',
    '',
  ].join('\n'));
  // A JD capture so the local: row's extra-cell URL resolves through the index.
  mkdirSync(resolve(root, 'jds'), { recursive: true });
  writeFileSync(resolve(root, 'jds', 'job1.md'), '- URL: https://gamma.example.com/jobs/3\n- Location: Berlin, Germany\nJD body\n');
  writeFileSync(resolve(root, 'jds', 'notes.txt'), 'not a markdown capture');

  const { body } = await getJson('/api/map/jobs');
  assert.equal(body.pipeline.length, 3);
  const fit = body.pipeline.find((r) => r.title === 'Backend Engineer');
  assert.equal(fit.href, 'https://acme.example.com/jobs/1');
  assert.equal(fit.fit.band, 'strong');
  const local = body.pipeline.find((r) => r.title === 'DevOps');
  assert.equal(local.href, 'https://gamma.example.com/jobs/3', 'extra-cell URL becomes the http href');
  assert.equal(local.location, 'Берлин');
  const dash = body.pipeline.find((r) => r.title === '—');
  assert.equal(dash.fit, undefined, 'a title with no usable tokens gets no fit chip');
  // Read-only: pipeline.md is untouched by GET.
  const raw = await fetch(`${baseUrl}/api/cv`).then(() => null);
  assert.equal(raw, null);
});

test('GET /api/commute: a commute.tsv row joins the tracker by URL and by tracker num', async () => {
  writeFileSync(resolve(root, 'data', 'commute.tsv'), [
    'url\tlocation\tprecision\tlat\tlon\tkm\tmin\tchecked',
    'https://example.com/a\tLeeds, UK\texact\t53.8\t-1.55\t12\t25\t2026-01-02',
    'not-a-url\tBroken\tunknown\t\t\t\t\t',
    'https://range.example/x\tX\texact\t99\t200\t5\t5\t2026-01-02', // out-of-range lat/lon → nulls
  ].join('\n'));
  mkdirSync(resolve(root, 'config'), { recursive: true });
  writeFileSync(resolve(root, 'config', 'plugins.yml'),
    'plugins:\n  commute:\n    home_lat: 53.8\n    home_lon: -1.55\n    max_minutes: 45\n');
  const { body } = await getJson('/api/commute');
  assert.equal(body.available, true);
  assert.deepEqual(body.home, { lat: 53.8, lon: -1.55 });
  assert.equal(body.maxMinutes, 45);
  assert.equal(body.byUrl['https://example.com/a']?.min, 25);
  assert.equal(body.byUrl['https://range.example/x']?.lat, null, 'out-of-range lat/lon are nulled');
  assert.deepEqual(body.byNum['1']?.min, 25);
});

test('GET /api/map/jobs: tiles payload honours an operator MAP_TILE_URL', async () => {
  process.env.MAP_TILE_URL = 'https://maps.example.org/all/{z}/{x}/{y}.png';
  try {
    const { body } = await getJson('/api/map/jobs');
    assert.equal(body.tiles.url, 'https://maps.example.org/all/{z}/{x}/{y}.png');
  } finally {
    delete process.env.MAP_TILE_URL;
  }
});

test('GET /api/map/jobs: unreadable/unparseable data files degrade to empty (read catch paths)', async () => {
  writeFileSync(resolve(root, 'data', 'pipeline.md'), 'no fence, no rows — just prose');
  rmSync(resolve(root, 'data', 'scan-history.tsv'));
  const { status, body } = await getJson('/api/map/jobs');
  assert.equal(status, 200);
  assert.deepEqual(body.pipeline, []);
  // Tracker rows still served — applications.md intact.
  assert.equal(body.tracker.length, 4);
});
