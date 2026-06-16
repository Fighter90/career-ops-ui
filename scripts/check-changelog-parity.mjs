#!/usr/bin/env node
/**
 * v1.25.0 (G-012) — CI gate against CHANGELOG locale drift.
 *
 * Pre-v1.25 the seven non-EN CHANGELOG files drifted behind the EN
 * canonical: RU was 1 release behind, the other 6 were 2 releases
 * behind. Releases v1.23 and v1.24 had landed in `CHANGELOG.md` but
 * never propagated to the locale files. No CI gate noticed.
 *
 * This script reads the newest `## [X.Y.Z]` heading from each
 * CHANGELOG file and fails the build if any locale lags behind EN.
 *
 * Wired into `npm run test:ci` so the next release can't ship with
 * silent locale drift.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');

const LOCALES = ['es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'ar'];

function newestEntry(path) {
  const src = readFileSync(path, 'utf8');
  const m = src.match(/^## \[(\d+\.\d+\.\d+)\]/m);
  return m ? m[1] : null;
}

const enVersion = newestEntry(join(REPO, 'CHANGELOG.md'));
if (!enVersion) {
  console.error('::error::CHANGELOG.md has no `## [X.Y.Z]` heading — schema regression');
  process.exit(1);
}

const lagging = [];
for (const lang of LOCALES) {
  const v = newestEntry(join(REPO, `CHANGELOG.${lang}.md`));
  if (!v) {
    lagging.push(`CHANGELOG.${lang}.md — no version heading found`);
    continue;
  }
  if (v !== enVersion) {
    lagging.push(`CHANGELOG.${lang}.md — newest is ${v}, EN is ${enVersion}`);
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
console.log(`✓ CHANGELOG parity: all ${LOCALES.length} locales at v${enVersion}`);
