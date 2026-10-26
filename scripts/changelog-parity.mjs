/**
 * changelog-parity.mjs — the shared release-count contract for CHANGELOG files.
 *
 * CAR-131: the cvstart.org per-locale changelog pages were badly incomplete
 * (de 252, ta 28, vi 8 releases against 465 in EN) because every locale file
 * was seeded mid-history (de with a single entry at v1.85.0, ta at v1.245.0,
 * vi at v1.255.0, …) and the release train prepends exactly one translated
 * entry per release — nothing ever backfilled the rest, and the old parity
 * gate compared only the NEWEST heading, so the missing tail was invisible.
 *
 * Single splitter/counter for every consumer:
 *   - scripts/check-changelog-parity.mjs     (release-train gate, test:ci)
 *   - site/scripts/sync-assets.mjs           (site build gate, cvstart.org)
 *   - scripts/backfill-changelog-locales.mjs (the repair tool)
 *
 * Pure text transforms — no I/O, no dependencies.
 */

export const LOCALES = [
  'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl',
  'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi',
];

const HEADING_RE =
  /^## \[(\d+\.\d+\.\d+)\][^\S\n]*(?:[-\u2013\u2014][^\S\n]*(\d{4}-\d{2}-\d{2}))?/;

/**
 * Split a CHANGELOG markdown string into its preamble and its ordered release
 * entries. Entry text is byte-exact — it starts at the `## [` heading and runs
 * to just before the next one — so a caller can rebuild a file as
 * `preamble + entries.map((e) => e.text).join('')` without disturbing anything
 * it keeps.
 *
 * The splitter is fence-aware: a `## [` line inside a ``` / ~~~ block is
 * content, never a heading. `## [Unreleased]` (the Keep-a-Changelog prologue
 * section) is tolerated before the first release — kept verbatim in the
 * preamble, never counted. Anything else non-semver throws with the offending
 * heading in the message; callers report the file name around it.
 */
export function splitChangelog(md) {
  const prologue = [];
  const entries = [];
  let current = null; // lines of the entry being accumulated (null = prologue)
  let fence = null; // opening fence marker while inside a fenced block
  for (const line of md.split('\n')) {
    const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      (current ? current.lines : prologue).push(line);
      continue;
    }
    if (fence) {
      (current ? current.lines : prologue).push(line);
      continue;
    }
    const h = line.match(HEADING_RE);
    if (h) {
      current = { version: h[1], date: h[2] || null, lines: [line] };
      entries.push(current);
      continue;
    }
    if (/^## \[/.test(line)) {
      const token = (line.slice(line.indexOf('[') + 1, line.indexOf(']')) || '').trim();
      if (current === null && token.toLowerCase() === 'unreleased') {
        prologue.push(line); // prologue section: preserved, never counted
        continue;
      }
      throw new Error(
        token.toLowerCase() === 'unreleased'
          ? '## [Unreleased] appears after release entries — cannot classify it'
          : `non-release heading ${JSON.stringify(line.slice(0, 60))} — only ## [X.Y.Z] and ## [Unreleased] are recognised`,
      );
    }
    (current ? current.lines : prologue).push(line);
  }
  return {
    // The '\n' before the first entry heading belongs to the prologue (slice
    // semantics) — re-attach it so preamble + entries rebuilds byte-exactly.
    preamble: prologue.join('\n') + (entries.length && prologue.length ? '\n' : ''),
    entries: entries.map(({ version, date, lines }) => ({ version, date, text: lines.join('\n') })),
  };
}

export function countReleases(md) {
  return splitChangelog(md).entries.length;
}

/**
 * Release-set coverage of one locale's entries against the EN entries:
 *   - missing  — EN versions absent from the locale (the incompleteness);
 *   - unknown  — locale versions EN does not have (a typo'd or invented
 *                version; a rebuild would silently drop these, so callers
 *                must refuse to proceed);
 *   - ordered  — the locale's shared versions appear in the same relative
 *                order as EN; a duplicated version fails this too, which is
 *                why coverage — not counts — is what the gates enforce
 *                (a typo plus a hole keeps the count).
 */
export function auditCoverage(enEntries, localeEntries) {
  const enVersions = enEntries.map((e) => e.version);
  const locVersions = new Set(localeEntries.map((e) => e.version));
  const missing = enVersions.filter((v) => !locVersions.has(v));
  const enSet = new Set(enVersions);
  const unknown = localeEntries.map((e) => e.version).filter((v) => !enSet.has(v));
  const pos = new Map(enVersions.map((v, i) => [v, i]));
  const idxs = localeEntries.map((e) => pos.get(e.version)).filter((i) => i !== undefined);
  const ordered = idxs.every((v, i) => i === 0 || v > idxs[i - 1]);
  return { missing, unknown, ordered };
}

/**
 * Maximal runs of consecutive locale entries whose body is byte-identical to
 * the EN body of the same version — the «the locale file silently carries the
 * English original» symptom from the CAR-131 audit (da had a 199-entry run).
 * The heading line is excluded (dates and labels may legitimately differ);
 * bodies are compared trimmed. Deliberately exact: no marker-stripping, no
 * fuzzy matching — this is a diagnostic, and it must stay able to see the
 * truth even when a pending-translation note has been added.
 */
export function englishRuns(enEntries, localeEntries) {
  const bodyAfterHeading = (e) => {
    const i = e.text.indexOf('\n');
    return i === -1 ? '' : e.text.slice(i).trim();
  };
  const enBody = new Map(enEntries.map((e) => [e.version, bodyAfterHeading(e)]));
  const runs = [];
  let cur = null;
  for (const e of localeEntries) {
    const same = enBody.has(e.version) && enBody.get(e.version) === bodyAfterHeading(e);
    if (same) {
      if (!cur) {
        cur = { from: e.version, to: e.version, count: 1 };
        runs.push(cur);
      } else {
        cur.to = e.version;
        cur.count += 1;
      }
    } else {
      cur = null;
    }
  }
  return { identical: runs.reduce((n, r) => n + r.count, 0), runs };
}
