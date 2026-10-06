import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let parsePipelineRows, buildLocationIndex, notesPlace;
before(async () => {
  process.env.CAREER_OPS_ROOT = mkdtempSync(join(tmpdir(), 'map-jobs-'));
  ({ parsePipelineRows } = await import('../server/lib/parsers.mjs'));
  ({ buildLocationIndex, notesPlace } = await import('../server/lib/routes/map.mjs'));
});

test('parsePipelineRows: checklist rows carry company/title/location; local: rows link the note URL', () => {
  const rows = parsePipelineRows([
    '## Pending',
    '- [ ] https://jobs.example.com/1 | Acme | Head of Platform | Karlsruhe, Germany',
    '- [ ] local:jds/linkedin-42.md | ZEISS | PM | Oberkochen | note: linkedin https://www.linkedin.com/jobs/view/42',
    '- [x] #3 | https://jobs.example.com/3 | Done | Old | 4.0/5',
  ].join('\n'));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { url: 'https://jobs.example.com/1', company: 'Acme', title: 'Head of Platform', location: 'Karlsruhe, Germany', href: 'https://jobs.example.com/1' });
  assert.equal(rows[1].href, 'https://www.linkedin.com/jobs/view/42');
  assert.equal(rows[1].location, 'Oberkochen');
});

test('parsePipelineRows: fenced url | comp lines do not read comp as company', () => {
  const rows = parsePipelineRows('```\nhttps://jobs.example.com/9 | 90k EUR\n```');
  assert.deepEqual(rows, [{ url: 'https://jobs.example.com/9', company: '', title: '', location: '', href: 'https://jobs.example.com/9' }]);
});

test('buildLocationIndex: pipeline, scan-history and JD headers all feed the index', () => {
  const idx = buildLocationIndex({
    pipelineRows: [{ url: 'local:jds/a.md', href: 'https://li/a', location: 'Leeds' }],
    scanHistory: 'url\tfirst_seen\tlocation\r\nhttps://s/1\t2026-10-01\tStuttgart\r\n',
    jds: ['# T\n\n- URL: https://li/b\n- Location: Karlsruhe, Germany\n'],
  });
  assert.equal(idx.get('https://li/a'), 'Leeds');
  assert.equal(idx.get('https://s/1'), 'Stuttgart');
  assert.equal(idx.get('https://li/b'), 'Karlsruhe, Germany');
});

test('notesPlace: leading verified workplace from tracker notes, any language; role phrases rejected', () => {
  assert.equal(notesPlace('Leeds (West Yorkshire) – 40 min drive; fit 4.2/5'), 'Leeds');
  assert.equal(notesPlace('Saint-Denis, hybride 2j/sem'), 'Saint-Denis');
  assert.equal(notesPlace('Den Haag / Rotterdam'), 'Den Haag');
  assert.equal(notesPlace('Lyon: télétravail partiel'), 'Lyon');
  assert.equal(notesPlace('Turin (IT) — hard blocker: no relocation'), 'Turin');
  assert.equal(notesPlace('Ulm ~1h; x'), 'Ulm');
  assert.equal(notesPlace('Ulm (unclosed paren'), 'Ulm');
  assert.equal(notesPlace('Strong infra fit, but scope unclear'), '');
  assert.equal(notesPlace('MedTech Technical Product Ownership, Leeds'), '');
  assert.equal(notesPlace(''), '');
});

test('tileConfig: OSM by default; MAP_TILE_URL drives URL and CSP origin; junk falls back', async () => {
  const { tileConfig } = await import('../server/lib/routes/map.mjs');
  assert.deepEqual(tileConfig({}), { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '', origin: 'https://tile.openstreetmap.org' });
  const own = tileConfig({ MAP_TILE_URL: 'https://{s}.tiles.example.org/{z}/{x}/{y}.png', MAP_TILE_ATTRIBUTION: '© Example' });
  assert.equal(own.origin, 'https://*.tiles.example.org');
  assert.equal(own.attribution, '© Example');
  assert.equal(tileConfig({ MAP_TILE_ATTRIBUTION: '<img src=x onerror=alert(1)>' }).attribution, '&#60;img src=x onerror=alert(1)&#62;');
  assert.equal(tileConfig({ MAP_TILE_URL: 'https://evil;script-src */x.png' }).origin, 'https://tile.openstreetmap.org');
  assert.equal(tileConfig({ MAP_TILE_URL: 'javascript:alert(1)//x' }).origin, 'https://tile.openstreetmap.org');
});
