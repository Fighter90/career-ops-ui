#!/usr/bin/env node
/**
 * Post-QA cleanup — replays the manual cleanup checklist from
 * qa/reports/00-FINAL-SUMMARY.md after a regression run leaves test
 * artifacts in the parent career-ops project.
 *
 *   node scripts/post-qa-cleanup.mjs           # dry-run, prints the plan, writes nothing
 *   node scripts/post-qa-cleanup.mjs --apply   # actually rewrite/move files
 *
 * Sweeps:
 *   - data/pipeline.md  — drops lines containing private-IP / nip.io /
 *     test-cloud-* URLs, plus v1.248.2: example.com fixtures (same rule as
 *     scripts/clean-test-fixtures.mjs)
 *   - data/applications.md — drops the "Acme | Co" tracker row left by Sc9,
 *     plus v1.248.2: any ZZ-QA-TEST row left by the QA harness
 *   - reports/*-t-role-*.md — v1.248.2: report files the prod eval timer
 *     wrote from garbage pipeline entries ("Insufficient JD", no score).
 *     A t-role file survives only when its SCORE_SUMMARY carries a valid
 *     number 0..5.
 *   - cv.md — reports if it's smaller than 2 KB so the user can `git checkout cv.md`
 *
 * Safety: before anything is written, the touched data file gets a
 * `data/<name>.md.bak-<ts>` copy, and report files are MOVED (not deleted)
 * into `qa/cleanup-backup-<ts>/`. Every action is reported line by line on
 * stdout. Idempotent. Skips silently if a file is missing.
 */
import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync, readdirSync, renameSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Pure module (no server deps) — the same tolerant number parser the live
// evaluation gate uses, so "valid score" means the same thing here.
import { asciiNumber } from '../server/lib/eval-validate.mjs';

const APPLY = process.argv.includes('--apply');
const ROOT = process.env.CAREER_OPS_ROOT || resolve(process.cwd(), '..');
// One run id for all backups of this invocation.
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// Private / link-local / unspecified IPv4 literals, matched only as the HOST of
// a URL (right after `://`, optional userinfo) and only as a whole address — a
// bare `10\.0\.0` also hit "Node 10.0.0" and job ids like 110.0.0.
const PRIVATE_HOST = String.raw`(?:10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|0\.0\.0\.0)`;
export const DIRTY_URL = new RegExp(String.raw`://(?:[^/@\s]*@)?${PRIVATE_HOST}(?![\d.])|test-cloud-|[./]nip\.io\b`);
// The Sc9 company "Acme | Co": tracker rows escape the pipe (`Acme \| Co`),
// a hand-written row may not. (The old /Acme \\\?\| Co/ demanded a literal
// backslash-question-mark and never matched either.)
export const TRACKER_TEST_ROW = /Acme \\?\| Co/;
// v1.248.2 — QA-harness leftovers:
export const QA_TRACKER_ROW = /ZZ-QA-TEST/;
// example.com pipeline fixtures (same rule as clean-test-fixtures.mjs).
export const EXAMPLE_URL = /example\.com/i;
// Report filenames written by the eval timer from pipeline garbage:
// `2026-10-09-t-role-<ts>.md` and variants.
export const T_ROLE_REPORT = /-t-role-/;

/**
 * A report counts as scored only when its ---SCORE_SUMMARY--- block carries a
 * SCORE whose value parses (asciiNumber, so «4,2» / «4.2 / 5» / «**4.2**» all
 * read) as a number in 0..5. Note: auto-pipeline strips the summary block from
 * SAVED reports, so a summary-less file reads as unscored — that is exactly
 * the junk signature, and the sweep only ever applies it to *-t-role-*.md
 * filenames, never to a human-written report.
 */
export function hasValidScore(text) {
  const m = String(text || '').match(/---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/);
  if (!m) return false;
  const line = m[1].match(/^[ \t]*(?:\*\*)?[ \t]*SCORE[ \t]*(?:\*\*)?[ \t]*:[ \t]*(.*)$/mi);
  if (!line) return false;
  const n = Number((asciiNumber(line[1]).match(/^[*_ \t]*([0-9]+(?:\.[0-9]+)?)/) || [])[1]);
  return Number.isFinite(n) && n >= 0 && n <= 5;
}

function relabel(path) {
  return path.replace(ROOT, '<career-ops>');
}

function preview(line) {
  const s = line.trim();
  return s.length > 160 ? s.slice(0, 157) + '…' : s;
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
  for (const l of before) if (predicate(l)) console.log(`      - ${preview(l)}`);
  if (APPLY) {
    // Backup before the first write of this file — never mutate unrecoverable.
    copyFileSync(file, `${file}.bak-${TS}`);
    console.log(`      backup → ${relabel(file)}.bak-${TS}`);
    writeFileSync(file, after.join('\n'));
  }
  return { changed };
}

function sweepReports() {
  const dir = join(ROOT, 'reports');
  const backupDir = join(ROOT, 'qa', `cleanup-backup-${TS}`);
  if (!existsSync(dir)) {
    console.log(`  · skip ${relabel(dir)} — not present`);
    return { changed: 0 };
  }
  const junk = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md') || !T_ROLE_REPORT.test(f)) continue;
    let text = '';
    try { text = readFileSync(join(dir, f), 'utf8'); } catch { continue; }
    if (!hasValidScore(text)) junk.push(f);
  }
  if (!junk.length) {
    console.log('  ✓ reports/ — no unscored *-t-role-*.md reports');
    return { changed: 0 };
  }
  for (const f of junk) {
    console.log(`  ${APPLY ? '⇧' : '◇'} reports/${f} — no valid SCORE in SCORE_SUMMARY${APPLY ? ' → moved to qa/cleanup-backup-' + TS + '/' : ' (would be moved to qa/cleanup-backup-' + TS + '/)'}`);
  }
  if (APPLY) {
    mkdirSync(backupDir, { recursive: true });
    for (const f of junk) renameSync(join(dir, f), join(backupDir, f));
    console.log(`      backup → ${relabel(backupDir)}/ (${junk.length} file(s))`);
  }
  return { changed: junk.length };
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

  sweepLines(join(ROOT, 'data/pipeline.md'),
    (l) => DIRTY_URL.test(l) || EXAMPLE_URL.test(l), 'dirty-URL');
  sweepLines(join(ROOT, 'data/applications.md'),
    (l) => TRACKER_TEST_ROW.test(l) || QA_TRACKER_ROW.test(l), 'test-row');
  sweepReports();

  if (!APPLY) {
    console.log('\nRe-run with --apply to commit changes.');
  }
}

// CLI only — importing (tests) must not sweep anything.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
