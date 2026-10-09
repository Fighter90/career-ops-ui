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
import { parseReportHeader } from '../server/lib/parsers.mjs';

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
// CodeQL js/incomplete-url-substring-sanitization: a bare /example\.com/i
// would match `notexample.com.evil.io` too. Extract the HOSTNAME and compare
// it (or the registrable suffix) strictly instead.
export function isExampleUrl(raw) {
  // A pipeline line carries prose around the link — cut the first
  // http(s) URL out, then judge it by its HOSTNAME (strict equality),
  // never by substring (CodeQL js/incomplete-url-substring-sanitization:
  // `notexample.com.evil.io` must not match).
  const m = /https:\/\/[^\s|)]+/.exec(String(raw));
  if (!m) return false;
  try {
    const host = new URL(m[0]).hostname.toLowerCase();
    return host === 'example.com' || host.endsWith('.example.com');
  } catch {
    return false;
  }
}
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
  // v1.248.3 — auto-pipeline strips the SCORE_SUMMARY block before saving
  // (stripScoreSummary), so EVERY saved t-role file used to read as
  // «no score» here and --apply would delete REAL Telegram postings. The
  // header score (**Score:** 4.2/5, locale-tolerant label parsing) is the
  // primary signal — exactly what parseReportHeader reads for the dashboard.
  const header = parseReportHeader(String(text || ''));
  if (header.scoreNum != null && Number.isFinite(header.scoreNum) && header.scoreNum >= 0 && header.scoreNum <= 5) {
    return true;
  }
  // Fallback: the machine block, for reports that kept it.
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
  // Read-first (no existsSync pre-check — CodeQL TOCTOU): a file vanishing
  // between the check and the read is handled by the catch below.
  let before;
  try {
    before = readFileSync(file, 'utf8').split('\n');
  } catch {
    console.log(`  · skip ${relabel(file)} — not present`);
    return { changed: 0 };
  }
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
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    console.log(`  · skip ${relabel(dir)} — not present`);
    return { changed: 0 };
  }
  const junk = [];
  for (const f of entries) {
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
    (l) => DIRTY_URL.test(l) || isExampleUrl(l), 'dirty-URL');
  sweepLines(join(ROOT, 'data/applications.md'),
    (l) => TRACKER_TEST_ROW.test(l) || QA_TRACKER_ROW.test(l), 'test-row');
  sweepReports();

  if (!APPLY) {
    console.log('\nRe-run with --apply to commit changes.');
  }
}

// CLI only — importing (tests) must not sweep anything.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
