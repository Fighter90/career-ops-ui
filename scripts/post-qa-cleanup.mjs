#!/usr/bin/env node
/**
 * Post-QA cleanup — replays the manual cleanup checklist from
 * qa/reports/00-FINAL-SUMMARY.md after a regression run leaves test
 * artifacts in the parent career-ops project.
 *
 *   node scripts/post-qa-cleanup.mjs           # dry-run, report what would change
 *   node scripts/post-qa-cleanup.mjs --apply   # actually rewrite files
 *
 * Sweeps:
 *   - data/pipeline.md  — drops lines containing private-IP / nip.io / test-cloud-* URLs
 *   - data/applications.md — drops the "Acme | Co" tracker row left by Sc9
 *   - cv.md — reports if it's smaller than 2 KB so the user can `git checkout cv.md`
 *
 * Idempotent. Skips silently if a file is missing.
 */
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPLY = process.argv.includes('--apply');
const ROOT = process.env.CAREER_OPS_ROOT || resolve(process.cwd(), '..');

// Private / link-local / unspecified IPv4 literals, matched only as the HOST of
// a URL (right after `://`, optional userinfo) and only as a whole address — a
// bare `10\.0\.0` also hit "Node 10.0.0" and job ids like 110.0.0.
const PRIVATE_HOST = String.raw`(?:10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|0\.0\.0\.0)`;
export const DIRTY_URL = new RegExp(String.raw`://(?:[^/@\s]*@)?${PRIVATE_HOST}(?![\d.])|test-cloud-|[./]nip\.io\b`);
// The Sc9 company "Acme | Co": tracker rows escape the pipe (`Acme \| Co`),
// a hand-written row may not. (The old /Acme \\\?\| Co/ demanded a literal
// backslash-question-mark and never matched either.)
export const TRACKER_TEST_ROW = /Acme \\?\| Co/;

function relabel(path) {
  return path.replace(ROOT, '<career-ops>');
}

function sweepLines(file, predicate, label) {
  if (!existsSync(file)) {
    console.log(`  · skip ${relabel(file)} — not present`);
    return { changed: 0 };
  }
  const before = readFileSync(file, 'utf8').split('\n');
  const after = before.filter((l) => !predicate(l));
  const changed = before.length - after.length;
  if (!changed) {
    console.log(`  ✓ ${relabel(file)} — already clean`);
    return { changed: 0 };
  }
  console.log(`  ${APPLY ? '✎' : '◇'} ${relabel(file)} — ${changed} ${label} line(s)${APPLY ? ' removed' : ' would be removed'}`);
  if (APPLY) writeFileSync(file, after.join('\n'));
  return { changed };
}

function main() {
  console.log(APPLY ? 'Applying cleanup …' : 'Dry run (pass --apply to write):');
  console.log('CAREER_OPS_ROOT =', ROOT);

  const cv = join(ROOT, 'cv.md');
  if (existsSync(cv)) {
    const size = statSync(cv).size;
    if (size < 2048) {
      console.log(`  ⚠ ${relabel(cv)} is only ${size} bytes — likely overwritten during QA. Restore with: git -C "${ROOT}" checkout cv.md`);
    } else {
      console.log(`  ✓ ${relabel(cv)} — ${size} bytes (looks fine)`);
    }
  }

  sweepLines(join(ROOT, 'data/pipeline.md'),    (l) => DIRTY_URL.test(l), 'dirty-URL');
  sweepLines(join(ROOT, 'data/applications.md'), (l) => TRACKER_TEST_ROW.test(l), 'test-row');

  if (!APPLY) {
    console.log('\nRe-run with --apply to commit changes.');
  }
}

// CLI only — importing (tests) must not sweep anything.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
