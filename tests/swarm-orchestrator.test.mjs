// parsePickOutput — the swarm orchestrator's Linear-pick parser and its identifier
// validator. Regression: the first live run had the clerk echo the FORMAT TEMPLATE
// (SWARM_PICK::<issueId>::<identifier>::<title> with literal angle-bracket
// placeholders); the old parser happily returned `<identifier>` as the issue, the
// branch checkout failed, and an executor started on `main`. The validator must
// refuse anything that is not a real Linear identifier (e.g. CAR-252).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePickOutput, acquireLock, developCheckout, changelogInsert, captureTestCount, baselineBump, rotateReadmeRelease } from '../scripts/swarm/orchestrator.mjs';

test('parses a real pick line', () => {
  const issue = parsePickOutput('blah\nSWARM_PICK::uuid-1::CAR-252::#/health: FIX_TARGETS keys\ntrailer');
  assert.deepEqual(issue, { id: 'uuid-1', identifier: 'CAR-252', title: '#/health: FIX_TARGETS keys' });
});

test('NONE means an empty queue', () => {
  assert.equal(parsePickOutput('SWARM_PICK::NONE'), null);
});

test('REFUSES the literal placeholder echo (the first-run regression)', () => {
  // The <…> check runs first, so the template echo is reported as placeholders.
  assert.throws(
    () => parsePickOutput('SWARM_PICK::<issueId>::<identifier>::<title>'),
    /placeholder characters/,
  );
});

test('REFUSES placeholder characters anywhere in the payload', () => {
  assert.throws(() => parsePickOutput('SWARM_PICK::uuid::<CAR-1>::title'), /placeholder characters/);
  assert.throws(() => parsePickOutput('SWARM_PICK::uuid::CAR-1::<title>'), /placeholder characters/);
});

test('REFUSES garbage that does not name an issue', () => {
  assert.throws(() => parsePickOutput('SWARM_PICK::uuid::hello world::title'), /non-issue identifier/);
  assert.throws(() => parsePickOutput('no marker at all'), /cannot parse/);
});

// ── the executor's issue-identity pin (live-run regression: the CAR-258 executor
// fetched and implemented ANOTHER issue's body — ibm/oraclecloud scope instead of
// talentlink/google — because its prompt told it to "fetch the full issue BODY"
// without naming which issue). The develop-phase DESCRIPTION must repeat the
// identifier, and the executor role prompt must pin the identity. ──

test('develop prompt: the executor DESCRIPTION instruction names the exact identifier', async () => {
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../scripts/swarm/orchestrator.mjs', import.meta.url), 'utf8'),
  );
  // The DESCRIPTION literal handed to the executor worker must carry the
  // {{IDENTIFIER}} interpolation — the body to fetch is EXACTLY this issue's.
  assert.match(
    src,
    /DESCRIPTION: `[^`]*EXACTLY \$\{issue\.identifier\}[^`]*`/,
    'executor DESCRIPTION must interpolate the picked issue identifier (fetch EXACTLY <id>…)',
  );
});

test('executor role prompt: rule 7 pins the issue identity', async () => {
  const fs = await import('node:fs');
  const role = fs.readFileSync(new URL('../scripts/swarm/roles/executor.md', import.meta.url), 'utf8');
  assert.match(role, /\{\{IDENTIFIER\}\}/, 'the identity pin must be templated per run');
  assert.match(
    role,
    /never fetch or implement any other issue['’s ]* body/i,
    'rule 7 must forbid fetching/implementing another issue’s body',
  );
});

// ── stale-lock takeover (live-run regression ×2: a SIGKILLed orchestrator never
// runs its cleanup unlink, and every next launch aborted with "another swarm
// instance holds the lock" until a human removed the file). A lock whose PID is
// dead must be taken over; a lock held by a live process must still refuse. ──

test('acquireLock: takes over a lock whose holder PID is dead', () => {
  const dir = mkdtempSync(join(tmpdir(), 'swarm-lock-'));
  const lock = join(dir, 'lock');
  // A genuinely dead PID: spawn `true`, which has exited by the time this runs.
  const deadPid = spawnSync('true').pid;
  writeFileSync(lock, String(deadPid));
  assert.equal(acquireLock(lock), true, 'a dead holder must be taken over');
  assert.equal(readFileSync(lock, 'utf8'), String(process.pid), 'the lock must record the new holder');
  rmSync(dir, { recursive: true, force: true });
});

test('acquireLock: still refuses a lock held by a live process', () => {
  const dir = mkdtempSync(join(tmpdir(), 'swarm-lock-'));
  const lock = join(dir, 'lock');
  writeFileSync(lock, String(process.pid)); // this test process is alive
  assert.throws(() => acquireLock(lock), /holds the lock/);
  rmSync(dir, { recursive: true, force: true });
});

// developCheckout — the develop-phase branch checkout contract. Regression: the
// v1.5 salvage semantics reused ANY existing task branch (`checkout -q branch
// || checkout -B`), so a stale branch left by an aborted run — cut from a base
// several releases old and carrying zero commits — silently became the
// executor's working base (the run-6 class: CAR-266 started on a pre-1.271.6
// tree). A branch with nothing to salvage must be refreshed onto current
// origin/main; only real salvaged work is continued.
test('developCheckout: an empty stale branch is reset onto origin/main', () => {
  assert.equal(
    developCheckout('swarm/car-266', 0),
    'git checkout -q -B swarm/car-266 origin/main',
    'zero salvaged commits → -B refresh (the stale-base fix)',
  );
});

test('developCheckout: salvaged work is continued, never wiped', () => {
  assert.equal(
    developCheckout('swarm/car-259', 4),
    'git checkout -q swarm/car-259',
    'committed salvaged work → plain checkout (the v1.5 no-wipe rule)',
  );
});

test('orchestrator source: the bare reuse-without-reset literal is gone', async () => {
  const src = readFileSync(new URL('../scripts/swarm/orchestrator.mjs', import.meta.url), 'utf8');
  assert.ok(
    !src.includes('git checkout -q ${branch} 2>/dev/null'),
    'the checkout-reuse-without-reset shell line must not return',
  );
  assert.ok(src.includes('developCheckout('), 'the develop phase must route through developCheckout()');
});

// changelogInsert — the release-manager's entry placement. Regression: three
// releases in a row the release script prepended the new `## [ver]` ABOVE the
// locale files' title + `>` preamble, breaking the ×18 preamble-first layouts
// and forcing a manual re-restore each time.
test('changelogInsert: the entry lands BELOW the locale preamble', () => {
  const content = '# Changelog (Deutsch)\n\n> Notiz Vorbemerkung.\n\n## [1.271.8] — 2026-11-12\n\n### Behoben\n- alt\n';
  const out = changelogInsert(content, '## [1.271.9] — 2026-11-12\n\n### Behoben\n- neu\n\n');
  assert.ok(out.startsWith('# Changelog (Deutsch)'), 'the preamble must stay at the top');
  assert.ok(out.indexOf('## [1.271.9]') < out.indexOf('## [1.271.8]'), 'the new entry precedes the old one');
  assert.ok(out.indexOf('> Notiz Vorbemerkung.') < out.indexOf('## [1.271.9]'), 'the preamble precedes the new entry');
});

test('changelogInsert: a preamble-less file prepends as before', () => {
  const content = '## [1.271.8] — 2026-11-12\n\n### Fixed\n- old\n';
  const out = changelogInsert(content, '## [1.271.9] — 2026-11-12\n\n### Fixed\n- new\n\n');
  assert.ok(out.startsWith('## [1.271.9]'), 'entry-first file prepends');
});

test('changelogInsert: a file with no release entry gets the entry prepended', () => {
  assert.equal(changelogInsert('header text\n', 'ENTRY\n'), 'ENTRY\nheader text\n');
});

// captureTestCount + baselineBump — the release manager's baseline bump.
// Regression: the no-blanket-version-sweep grader reds EVERY swarm release
// commit whose SDD baselines still name the previous version (v1.271.9 and
// v1.271.10 both needed a babysitter push within an hour of each other).
test('captureTestCount: reads the TAP pass line', () => {
  assert.equal(captureTestCount('ok 1 - x\n# tests 10\n# pass 8295\n# fail 0\n'), 8295);
});

test('captureTestCount: reads the spec-reporter line', () => {
  assert.equal(captureTestCount('✔ 8255 passing (30s)\n'), 8255);
});

test('captureTestCount: no summary line → null (no guessed numbers)', () => {
  assert.equal(captureTestCount('all systems nominal\n'), null);
});

test('baselineBump: current line demotes to history, new current carries the gated count', () => {
  const before = '- Current count as of **v1.271.9**: **8255** unit + **210** Playwright (v1.271.9 — CAR-266 details)\n- Count as of **v1.271.8**: **8249** unit\n';
  const after = baselineBump(before, 'v1.271.10', 8295, '2026-11-12');
  assert.ok(after.includes('- Current count as of **v1.271.10**: **8295**'), 'new current line');
  assert.ok(after.includes('- Count as of **v1.271.9**: **8255**'), 'previous line demoted to history');
  assert.ok(after.indexOf('v1.271.10') < after.indexOf('v1.271.9'), 'current precedes history');
  assert.ok(after.includes('- Count as of **v1.271.8**: **8249**'), 'older history untouched');
});

test('baselineBump: no test count → file unchanged (no fabricated numbers)', () => {
  const before = '- Current count as of **v1.271.9**: **8255** unit + **210** Playwright (x)\n';
  assert.equal(baselineBump(before, 'v1.271.10', null, '2026-11-12'), before);
});

test('orchestrator source: the release manager routes through baselineBump', async () => {
  const src = readFileSync(new URL('../scripts/swarm/orchestrator.mjs', import.meta.url), 'utf8');
  assert.ok(src.includes('baselineBump('), 'the release manager must bump the baselines');
});

// The false-Done guard on the salvage path: an "already merged" verdict
// requires a PR-squash marker `(#NNN)` in the commit subject. CAR-269 was
// closed as Done twice by infra commits that merely MENTION the identifier
// in their bodies ("chore(coverage): exempt … CAR-269 tracks raising the
// coverage").
test('orchestrator source: the salvage Done requires a PR marker', async () => {
  const src = readFileSync(new URL('../scripts/swarm/orchestrator.mjs', import.meta.url), 'utf8');
  assert.ok(
    src.includes("test(subj)"), 'the salvage path must inspect the commit subject',
  );
  assert.ok(
    src.includes('lacks a PR marker'),
    'the salvage path must refuse non-PR merges (the false-Done guard)',
  );
});

// ── rotateReadmeRelease — the release manager's README banner + badge
// rotation. Three releases (v1.271.13/.14/.15) shipped with a stale EN lead
// because the release script rotated CHANGELOGs but never READMEs; the
// manual sweeps then missed the EN trail (it stayed on v1.271.12 through
// v1.271.15) and the EN lead's trailing test count (8411 while every badge
// said 8450). The rotation moves the lead version, demotes the old lead
// into the trail, and follows the language-independent badges. ──

const EN_BANNER = [
  '# career-ops-ui',
  '',
  '[![tests](https://img.shields.io/badge/tests-8411%20passed-brightgreen)](#tests)',
  '[![release](https://img.shields.io/badge/release-v1.271.14-blue)](https://github.com/Fighter90/career-ops-ui/releases/tag/v1.271.14)',
  '',
  '> **🆕 Latest release — v1.271.14** — the **parent-sync wave**. Tests 8411.',
  '> **Previous — v1.271.13** — the wire-weight fix.',
  '',
].join('\n');

test('rotateReadmeRelease: lead takes the new version, the trail is demoted', () => {
  const out = rotateReadmeRelease(EN_BANNER, 'v1.271.15', 'v1.271.14', 8450);
  assert.ok(out.includes('🆕 Latest release — v1.271.15'), 'lead moves to the new version');
  assert.ok(out.includes('Previous — v1.271.14'), 'the trail carries the version released over');
  assert.ok(!out.includes('v1.271.13'), 'the two-releases-ago version leaves the banner');
});

test('rotateReadmeRelease: badges follow (release, tag, tests count)', () => {
  const out = rotateReadmeRelease(EN_BANNER, 'v1.271.15', 'v1.271.14', 8450);
  assert.ok(out.includes('release-v1.271.15-blue'));
  assert.ok(out.includes('releases/tag/v1.271.15'));
  assert.ok(out.includes('tests-8450%20passed'));
  assert.ok(!out.includes('tests-8411%20passed'), 'the stale badge number is gone');
});

test('rotateReadmeRelease: the localized trailing count moves in every script', () => {
  const mk = (lead) => `> intro\n${lead}\n${lead.replace(/^[^v]*/, '')}`;
  const cases = [
    ['> **🆕 Latest — v1.271.14** — x. Tests 8411.', 'Tests 8450.'],
    ['> **🆕 Latest — v1.271.14** — x. Tests: 8411.', 'Tests: 8450.'],
    ['> **🆕 Dernière — v1.271.14** — x. Tests : 8411.', 'Tests : 8450.'],
    ['> **🆕 Последний релиз — v1.271.14** — x. Тесты: 8411.', 'Тесты: 8450.'],
    ['> **🆕 最新リリース — v1.271.14** — x。テスト 8411。', 'テスト 8450。'],
    ['> **🆕 最新版本 — v1.271.14** — x。测试 8411。', '测试 8450。'],
    ['> **🆕 नवीनतम — v1.271.14** — x। टेस्ट 8411।', 'टेस्ट 8451।'.replace('8451', '8450')],
  ];
  for (const [lead, expect] of cases) {
    const out = rotateReadmeRelease(lead, 'v1.271.15', 'v1.271.14', 8450);
    assert.ok(out.includes(expect), `trailing count localized: ${expect}`);
  }
});

test('rotateReadmeRelease: a lead without the trailing count is left alone there', () => {
  const lead = '> **🆕 Latest — v1.271.14** — no count here, ends with words.';
  const out = rotateReadmeRelease(lead, 'v1.271.15', 'v1.271.14', 8450);
  assert.ok(out.includes('v1.271.15'));
  assert.ok(out.endsWith('ends with words.'), 'no fabricated number');
});

test('rotateReadmeRelease: lead without oldVersion → content untouched (no guessing)', () => {
  const handEdited = EN_BANNER.replace(/v1\.271\.14/g, 'v9.9.9');
  assert.equal(rotateReadmeRelease(handEdited, 'v1.271.15', 'v1.271.14', 8450), handEdited);
});

test('rotateReadmeRelease: null test count → versions rotate, badge numbers keep', () => {
  const out = rotateReadmeRelease(EN_BANNER, 'v1.271.15', 'v1.271.14', null);
  assert.ok(out.includes('🆕 Latest release — v1.271.15'));
  assert.ok(out.includes('tests-8411%20passed'), 'no fabricated badge number');
  assert.ok(out.includes('release-v1.271.15-blue') === false, 'badges untouched without a count');
});

test('orchestrator source: the release manager rotates the READMEs into the release commit', async () => {
  const src = readFileSync(new URL('../scripts/swarm/orchestrator.mjs', import.meta.url), 'utf8');
  assert.ok(src.includes('rotateReadmeRelease('), 'the rotation must be wired');
  assert.ok(src.includes('README.*.md'), 'the release commit must carry the rotated READMEs');
});
