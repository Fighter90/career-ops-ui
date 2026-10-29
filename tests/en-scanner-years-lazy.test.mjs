// L262-R3 — `statedYearsMin(i)` ran for EVERY fetched job even when the
// portals.yml `years_min` filter was not configured (parseYearsRequirement
// over the full description ≈ ms per JD — seconds of CPU on a large scan).
// The stamp exists for the filter (and the badge fed from it), so an
// unconfigured scan must not compute it at all.
//
// CI-isolated: CAREER_OPS_ROOT is a temp dir with cv.md, the fetch is a stub,
// no network, portals.yml carries NO years_min key.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let runEnScan;
let dir;

const boardResponse = () => new Response(JSON.stringify({
  jobs: [
    {
      id: 1, title: 'Role Deep', company_name: 'GH-Co',
      absolute_url: 'https://boards.greenhouse.io/ghco/jobs/1',
      location: { name: 'Berlin' }, first_published: '2026-10-01',
      content: '<p>Requirements: 8+ years of experience in strategy.</p>',
    },
    {
      id: 2, title: 'Role Junior', company_name: 'GH-Co',
      absolute_url: 'https://boards.greenhouse.io/ghco/jobs/2',
      location: { name: 'Berlin' }, first_published: '2026-10-02',
      content: '<p>Requirements: 1+ year of experience in strategy.</p>',
    },
  ],
}), { status: 200, headers: { 'content-type': 'application/json' } });

const fakeFetch = async () => boardResponse();

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'en-scanner-years-lazy-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  // No years_min key — the pass-all contract (jd-years.mjs).
  writeFileSync(resolve(dir, 'portals.yml'), [
    'tracked_companies:',
    '  - name: GH-Co',
    '    careers_url: https://job-boards.greenhouse.io/ghco',
    '    api: https://boards-api.greenhouse.io/v1/boards/ghco/jobs',
    '    enabled: true',
  ].join('\n'));
  process.env.CAREER_OPS_ROOT = dir;
  ({ runEnScan } = await import('../server/lib/en-scanner.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
});

test('without years_min both jobs pass and no yearsMin field is computed', async () => {
  const res = await runEnScan({ writeFiles: false, fetchImpl: fakeFetch });
  // Pass-all: a stated 1-year posting is NOT cut without a configured bar.
  assert.deepStrictEqual(res.fresh.map((j) => j.title).sort(), ['Role Deep', 'Role Junior']);
  for (const j of res.fresh) {
    assert.equal(j.yearsMin, undefined, `${j.title} must not carry yearsMin when years_min is not configured`);
  }
});
