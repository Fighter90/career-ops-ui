/**
 * changelog-split.mjs — pure helpers behind sync-assets.mjs's changelog
 * pagination (CAR-132). No I/O — behavior-tested by
 * tests/site-changelog-split.test.mjs.
 */

/** Pseudo `ym` for Keep-a-Changelog's undated `## [Unreleased]` section. */
export const UNRELEASED_YM = 'unreleased';

/** Default page caps — see the byte rationale in sync-assets.mjs §3b. */
export const PAGE_BYTES = 100 * 1024;
export const PAGE_MAX_RELEASES = 80;

/**
 * Strip the docs' leading title H1 — the site page supplies its own <h1>
 * (CAR-132: exactly one h1 per page). Matches only at the head of the
 * document (optional BOM, optional blank lines, then the H1 line), so a
 * mid-document H1 is never touched; a document without a leading H1 is
 * returned unchanged.
 */
export function stripLeadingH1(md) {
  return md.replace(/^(?:\uFEFF)?[ \t]*\n*#[ \t]+[^\n]*\n+/, '');
}

// Release sections start at a top-level `## [<version>] — YYYY-MM-DD` line.
// Keep-a-Changelog's standard undated `## [Unreleased]` is allowed and becomes
// a pseudo-release that lands on page 1 (it is the newest content) but never
// enters the month index. Any OTHER undated top-level H2 before the first
// release is a parse drift and fails loudly; after the first release such
// sections (the translated changelogs' "Older versions" epilogues) fold into
// the preceding chunk, so nothing silently disappears.
const RELEASE_HEADING_RE = /^##\s+\[[^\]]+\]\s*[—–-]\s*(\d{4})-(\d{2})-\d{2}/;
const UNRELEASED_HEADING_RE = /^##\s+\[Unreleased\]/i;

/**
 * Split a changelog into release chunks `{ ym, lines }` in file order
 * (newest first). Fenced code blocks (test transcripts in older entries) are
 * tracked by their OPENING marker — a closer must repeat the same character
 * at the same or greater length, so a `~~~` inside a ``` block (or vice
 * versa) is content, never a boundary, and a `##` line inside any fence is
 * never mistaken for a section heading.
 */
export function splitReleases(md, { lang = 'en', fail = (msg) => { throw new Error(msg); } } = {}) {
  const releases = [];
  let current = null;
  let fence = null; // opening marker: { char, len }
  for (const line of md.split('\n')) {
    const fenceLine = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceLine) {
      const marker = fenceLine[1];
      if (fence === null) fence = { char: marker[0], len: marker.length };
      else if (marker[0] === fence.char && marker.length >= fence.len) fence = null;
      // The fence line itself is content of the current chunk.
      if (current) current.push(line);
      continue;
    }
    if (fence === null && /^##\s/.test(line)) {
      const ym = line.match(RELEASE_HEADING_RE);
      if (ym) {
        // The heading line itself is the release's rendered title — keep it.
        current = [line];
        releases.push({ ym: `${ym[1]}-${ym[2]}`, lines: current });
        continue;
      }
      if (UNRELEASED_HEADING_RE.test(line)) {
        current = [line];
        releases.push({ ym: UNRELEASED_YM, lines: current });
        continue;
      }
      if (current === null) {
        fail(`[${lang}] changelog has a top-level "## " section without a parsable "[version] — YYYY-MM-DD" date before the first release: "${line.slice(0, 80)}" — it would silently vanish from the site`);
      }
      // else: undated epilogue — falls through, appended to the current chunk.
    }
    if (current) current.push(line);
  }
  return releases;
}

/**
 * Chunk releases into pages under a markdown-byte cap (entries vary from a
 * paragraph to several KB, and CJK/Devanagari carry ~2× the bytes) with a
 * release-count ceiling so runs of tiny patch releases still paginate.
 */
export function chunkByWeight(releases, { pageBytes = PAGE_BYTES, maxReleases = PAGE_MAX_RELEASES } = {}) {
  const pages = [];
  let cur = [];
  let bytes = 0;
  for (const r of releases) {
    const size = Buffer.byteLength(r.lines.join('\n'), 'utf8');
    if (cur.length > 0 && (bytes + size > pageBytes || cur.length >= maxReleases)) {
      pages.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(r);
    bytes += size;
  }
  if (cur.length > 0) pages.push(cur);
  return pages;
}

/**
 * Month index for the archive nav. Consecutive releases of one month merge
 * while they stay on the same page; a month crossing a page boundary keeps
 * its FULL count and records pages [page, lastPage] — the link always lands
 * where the month starts. Unreleased pseudo-chunks never appear here.
 */
export function buildMonthIndex(chunks) {
  const months = [];
  chunks.forEach((chunk, p) => {
    const page = p + 1;
    for (const r of chunk) {
      if (r.ym === UNRELEASED_YM) continue;
      const last = months[months.length - 1];
      if (last && last.ym === r.ym) {
        last.count += 1;
        if (page > last.lastPage) last.lastPage = page;
      } else {
        months.push({ ym: r.ym, page, lastPage: page, count: 1 });
      }
    }
  });
  return months;
}
