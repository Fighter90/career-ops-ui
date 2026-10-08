/**
 * Release-version parity — CI-isolated (no network, no server, no ports).
 *
 * Catches the release-train failure mode where the version bump (or the
 * release-prep commit) lands on one branch but the docs fan-out lands on
 * another, or a tag is cut from a tree whose package.json still names the
 * previous release (exactly how the v1.243.1 deploy failed its healthy()
 * version gate and rolled back).
 *
 * Contract: package.json version === the newest `## [X.Y.Z]` heading in
 * CHANGELOG.md === the newest heading in EVERY locale changelog (full ×17
 * parity is separately gated by scripts/check-changelog-parity.mjs in
 * test:ci; this test pins the package.json side, which that script cannot
 * see).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;

test('package.json version matches the newest CHANGELOG.md entry', () => {
  const s = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  const m = s.match(/^## \[(\d+\.\d+\.\d+)\]/m);
  assert.ok(m, 'CHANGELOG.md has at least one ## [X.Y.Z] entry');
  assert.equal(m[1], version, `newest CHANGELOG.md entry is ${m[1]}, package.json says ${version}`);
});

test('package.json version matches the newest entry in every locale changelog', () => {
  const files = readdirSync(join(ROOT)).filter((f) => /^CHANGELOG\.[a-zA-Z-]+\.md$/.test(f));
  assert.ok(files.length >= 16, `expected ≥16 locale changelogs, found ${files.length}`);
  for (const f of files) {
    const s = readFileSync(join(ROOT, f), 'utf8');
    const m = s.match(/^## \[(\d+\.\d+\.\d+)\]/m);
    assert.ok(m, `${f} has at least one ## [X.Y.Z] entry`);
    assert.equal(m[1], version, `${f} newest entry is ${m[1]}, expected ${version} (package.json)`);
  }
});

test('README.md release badge matches package.json version', () => {
  const s = readFileSync(join(ROOT, 'README.md'), 'utf8');
  assert.match(s, new RegExp(`release-v${version.replace(/\\/g, '\\\\').replace(/\./g, '\\.')}-blue`),
    'the README release badge must name the current version');
});
