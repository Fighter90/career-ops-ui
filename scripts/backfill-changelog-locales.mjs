#!/usr/bin/env node
/**
 * backfill-changelog-locales.mjs — CAR-131 repair tool.
 *
 * The per-locale CHANGELOG files were seeded mid-history (de with one entry
 * at v1.85.0, ta at v1.245.0, vi at v1.255.0, …) and every release prepends
 * one translated entry — so everything published before a locale existed is
 * simply absent, and cvstart.org's per-locale changelog pages were incomplete
 * (de 252, ta 28, vi 8 against EN 465). The old parity gate compared only the
 * NEWEST heading, so no gate ever noticed.
 *
 * For every CHANGELOG.<locale>.md this tool rebuilds the entry stream from the
 * EN master:
 *   - every entry the locale already has is kept BYTE-EXACT (translations are
 *     never touched, never regenerated);
 *   - every missing release is inserted at its EN position as the EN text
 *     verbatim — the same convention the existing da backfill used;
 *   - every non-final entry is joined with a guaranteed blank-line seam, so a
 *     stored file without a trailing newline cannot glue the next `## [`
 *     heading onto its last line;
 *   - the preamble is kept, and the tool owns the pending-translation note:
 *     if the preamble carries no `⏳` note, the canonical note is inserted;
 *     an existing (hand-written, in-language) note is preserved; a preamble
 *     that still announces a start version draws a warning, because after a
 *     backfill the file carries the full history and such a claim is false.
 *
 * Translating the backfilled history is explicitly OUT OF SCOPE. Idempotent:
 * a second run adds nothing. The release train is unaffected — it keeps
 * prepending one entry per locale per release.
 *
 * Refuses to touch a file whose versions are unknown to EN or out of EN order
 * (a rebuild would silently drop or scramble those entries).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES, splitChangelog, auditCoverage } = await import(
  new URL('./changelog-parity.mjs', import.meta.url)
);

const PENDING_NOTE =
  '> ⏳ The complete release history is carried in this file. Entries that predate this locale\'s localization were backfilled from the English original ([CHANGELOG.md](CHANGELOG.md)) — translation pending.';

// A preamble blockquote that announces a start version is false once the
// history below it is complete — warn so the maintainer rewrites it.
const START_CLAIM_RE = /(?:starts?\b|begins?\b|начина|inizia|comienza|commence|başlar|शुरू|بداية|bắt đầu|தொடங்கு|시작)/i;

// Guarantee a blank-line ending: an entry or preamble glued to the next
// `## [` heading would swallow the heading.
const ensureBlankEnd = (t) => (t.endsWith('\n\n') ? t : `${t.replace(/\s*$/, '')}\n\n`);

const { entries: enEntries } = splitChangelog(
  readFileSync(join(REPO, 'CHANGELOG.md'), 'utf8'),
);
console.log(`EN master: ${enEntries.length} releases`);

let changed = 0;
for (const lang of LOCALES) {
  const path = join(REPO, `CHANGELOG.${lang}.md`);
  let loc;
  try {
    loc = splitChangelog(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`CHANGELOG.${lang}.md — cannot parse: ${err.message}`);
    process.exit(1);
  }
  const cov = auditCoverage(enEntries, loc.entries);
  if (cov.unknown.length) {
    console.error(
      `CHANGELOG.${lang}.md — versions unknown to EN (${cov.unknown.join(', ')}); ` +
        'a rebuild would drop them. Fix by hand first.',
    );
    process.exit(1);
  }
  if (!cov.ordered) {
    console.error(
      `CHANGELOG.${lang}.md — entries out of EN order; refusing to rebuild. Fix by hand first.`,
    );
    process.exit(1);
  }
  if (!cov.missing.length) {
    console.log(`CHANGELOG.${lang}.md — complete (${loc.entries.length} releases), nothing to do`);
    continue;
  }
  const byVersion = new Map(loc.entries.map((e) => [e.version, e.text]));
  const sections = enEntries.map((e) => byVersion.get(e.version) ?? e.text);
  let preamble = ensureBlankEnd(loc.preamble);
  const hadNote = preamble.split('\n').some((l) => l.startsWith('>') && l.includes('⏳'));
  if (!hadNote) {
    preamble = `${preamble}${PENDING_NOTE}\n\n`;
  }
  // A preamble blockquote that announces a start version is false once the
  // history below it is complete — warn whichever note branch applied.
  const claim = preamble
    .split('\n')
    .find((l) => l.startsWith('>') && l !== PENDING_NOTE && START_CLAIM_RE.test(l) && /v\d+\.\d+\.\d+/.test(l));
  if (claim) {
    console.warn(
      `CHANGELOG.${lang}.md — preamble still announces a start version ` +
        `(${claim.trim().slice(0, 80)}…) though the file now carries the full history; update the note`,
    );
  }
  writeFileSync(
    path,
    preamble +
      sections.map((t, i) => (i < sections.length - 1 ? ensureBlankEnd(t) : t)).join(''),
  );
  changed += 1;
  const oldest = cov.missing[cov.missing.length - 1];
  const newest = cov.missing[0];
  console.log(
    `CHANGELOG.${lang}.md — +${cov.missing.length} entries backfilled ` +
      `(${loc.entries.length} -> ${enEntries.length}; missing span v${oldest}..v${newest})`,
  );
}
console.log(changed ? `${changed} file(s) backfilled from the EN master` : 'all locales already complete');
