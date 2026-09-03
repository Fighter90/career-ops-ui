#!/usr/bin/env node
/**
 * v1.25.0 (G-012) — CI gate against CHANGELOG locale drift.
 *
 * Pre-v1.25 the seven non-EN CHANGELOG files drifted behind the EN
 * canonical: RU was 1 release behind, the other 6 were 2 releases
 * behind. Releases v1.23 and v1.24 had landed in `CHANGELOG.md` but
 * never propagated to the locale files. No CI gate noticed.
 *
 * This script reads the newest `## [X.Y.Z] — YYYY-MM-DD` heading from each
 * CHANGELOG file and fails the build if any locale lags behind EN in either
 * the version or the date.
 *
 * Wired into `npm run test:ci` so the next release can't ship with
 * silent locale drift.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');

const LOCALES = ['es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];

// The date is captured as well as the version. v1.229.0 shipped with the
// EN heading corrected to the release date while all 16 locales kept the
// drafting date — this gate passed clean, because it only ever compared
// versions. A date that differs per locale is the same drift class as a
// version that does: it tells two readers two different things about when a
// release became available.
function newestEntry(path) {
  const src = readFileSync(path, 'utf8');
  const m = src.match(/^## \[(\d+\.\d+\.\d+)\][^\S\n]*(?:[-\u2013\u2014][^\S\n]*(\d{4}-\d{2}-\d{2}))?/m);
  return m ? { version: m[1], date: m[2] || null } : null;
}

const en = newestEntry(join(REPO, 'CHANGELOG.md'));
if (!en) {
  console.error('::error::CHANGELOG.md has no `## [X.Y.Z]` heading — schema regression');
  process.exit(1);
}

const lagging = [];
for (const lang of LOCALES) {
  const entry = newestEntry(join(REPO, `CHANGELOG.${lang}.md`));
  if (!entry) {
    lagging.push(`CHANGELOG.${lang}.md — no version heading found`);
    continue;
  }
  if (entry.version !== en.version) {
    lagging.push(`CHANGELOG.${lang}.md — newest is ${entry.version}, EN is ${en.version}`);
    continue;
  }
  // Only compared once the versions agree: on a lagging locale the dates
  // SHOULD differ, and reporting that too would bury the real fault.
  if (en.date && entry.date !== en.date) {
    lagging.push(`CHANGELOG.${lang}.md — v${entry.version} dated ${entry.date ?? '(none)'}, EN dated ${en.date}`);
  }
}

if (lagging.length) {
  console.error('::error::CHANGELOG locale parity drift (G-012 regression):');
  for (const l of lagging) console.error('  ' + l);
  console.error('');
  console.error('Backfill the missing entries in each lagging file. The EN');
  console.error('master is the source of truth.');
  process.exit(1);
}
console.log(`✓ CHANGELOG parity: all ${LOCALES.length} locales at v${en.version}${en.date ? ` (${en.date})` : ''}`);
