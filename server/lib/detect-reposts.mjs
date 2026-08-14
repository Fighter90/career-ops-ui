// @ts-check
/**
 * detect-reposts.mjs — repost / ghost-posting detector.
 *
 * Operates on the web-ui scan-history.tsv format. Groups scan-history rows by company,
 * fuzzy-matches role titles via roleFuzzyMatch, and flags any company+role that
 * appears 2+ times with DIFFERENT URLs inside a rolling window (default 90d).
 * Such clusters are almost certainly the same opening being re-listed by the
 * employer — a signal of stale pipelines / ghost postings.
 *
 * web-ui scan-history.tsv columns (written by en-scanner.mjs / ru-scanner.mjs):
 *   date \t source \t id \t company \t title \t url
 * (No status column — web-ui only ever writes fresh "added" rows.)
 *
 * Pure logic + a thin file reader; consumed by GET /api/scan/reposts.
 */
import { readFileSync, existsSync } from 'node:fs';
import { roleFuzzyMatch, roleTokens, BASELINE_TOKENS } from './role-matcher.mjs';
import { normalizeTextKey } from './text-key.mjs';

export const DEFAULT_WINDOW_DAYS = 90;

function parseDate(dateStr) {
  const iso = String(dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  return date;
}

function daysBetween(d1, d2) {
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Parse the web-ui scan-history.tsv into rows the detector can group.
 * Columns: date, source, id, company, title, url. Rows missing a valid date,
 * company, title, or http(s) url are skipped.
 * @param {string} content
 * @returns {Array<{url:string,date:Date,dateStr:string,source:string,company:string,title:string}>}
 */
export function parseScanHistory(content) {
  if (typeof content !== 'string') return [];
  const rows = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length < 6) continue;
    const [dateStr, source = '', , company = '', title = '', url = ''] = cols;
    const date = parseDate(dateStr);
    const u = String(url || '').trim();
    if (!date || !/^https?:\/\//i.test(u)) continue;
    rows.push({
      url: u,
      date,
      dateStr: String(dateStr).trim(),
      source: String(source).trim(),
      company: String(company).trim(),
      title: String(title).trim(),
    });
  }
  return rows;
}

/**
 * Detect repost clusters across a list of scan-history rows.
 * @param {Array} rows
 * @param {number} [windowDays]
 * @returns {Array<{company,role,repostCount,firstSeen,lastSeen,daysSpan,appearances}>}
 */
export function detectReposts(rows, windowDays = DEFAULT_WINDOW_DAYS) {
  if (!Array.isArray(rows)) return [];
  const valid = rows
    .filter((r) =>
      r && typeof r === 'object'
      && typeof r.url === 'string' && r.url.trim()
      && r.date instanceof Date && !Number.isNaN(r.date.getTime())
      && typeof r.company === 'string' && r.company.trim()
      && typeof r.title === 'string' && r.title.trim())
    .map((r) => ({ ...r, url: r.url.trim(), company: r.company.trim(), title: r.title.trim() }));
  if (valid.length < 2) return [];

  const byCompany = new Map();
  for (const row of valid) {
    // Unicode-aware key (#2569): folds width/punctuation/spacing so "Acme, Inc."
    // and "Acme Inc" cluster, and non-Latin employers («Тинькофф», 「サイボウズ」)
    // key to themselves instead of collapsing under an ASCII strip.
    const key = normalizeTextKey(row.company) || row.company.toLowerCase();
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key).push(row);
  }

  const clusters = [];
  for (const [, groupRows] of byCompany) {
    if (groupRows.length < 2) continue;
    clusters.push(...detectRepostsInGroup(groupRows, windowDays));
  }
  return clusters.sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
}

// Cluster rows in a single company group: group by title (exact or fuzzy),
// then a sliding window over dates finds sub-clusters within windowDays.
function detectRepostsInGroup(rows, windowDays) {
  const titleGroups = groupRowsByTitle(rows);

  const results = [];
  for (const group of titleGroups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => (a.date < b.date ? -1 : 1));
    let cluster = [];
    for (const row of sorted) {
      if (cluster.length === 0) { cluster = [row]; continue; }
      const span = daysBetween(cluster[0].date, row.date);
      if (span <= windowDays) {
        cluster.push(row);
      } else {
        if (cluster.length >= 2) {
          const built = buildRepostCluster(cluster, windowDays);
          if (built) results.push(built);
        }
        cluster = cluster.filter((c) => daysBetween(c.date, row.date) <= windowDays);
        cluster.push(row);
      }
    }
    if (cluster.length >= 2) {
      const built = buildRepostCluster(cluster, windowDays);
      if (built) results.push(built);
    }
  }
  return results;
}

// Group one company's rows into title groups: a seed row plus every other row
// whose title matches it (exact, case-insensitively, or via roleFuzzyMatch) —
// the SAME groups a nested loop over roleFuzzyMatch would build, without the
// quadratic cost. scan-history.tsv is append-only (one row per scanned
// posting), so a large employer accumulates thousands of DISTINCT titles;
// nothing collapses, every pair pays a full roleFuzzyMatch (which re-tokenizes
// both strings), and the naive loop goes quadratic with an expensive constant.
//
// Two structures replace the nested loop without changing what it computes:
//   1. Rows are bucketed by their lowercased title in one pass. Every row in a
//      bucket matches every other by the exact-title arm, so a bucket is atomic
//      (a seed takes the whole bucket or none). Exact reposts — the vast
//      majority of real ones — collapse in O(N) with no fuzzy calls, and
//      toLowerCase() runs once per row instead of once per comparison.
//   2. Fuzzy matching then runs over DISTINCT buckets only, gated by an inverted
//      index over non-baseline tokens. roleFuzzyMatch can only return true for
//      two non-identical titles when their deduped token sets share ≥2 tokens
//      (≥1 of them non-baseline) and their Jaccard ratio is ≥ 0.6 — all
//      necessary conditions, checked exactly here, so any bucket pair the gate
//      drops is one roleFuzzyMatch would have rejected anyway. The gate filters
//      CALLS, never verdicts: every surviving pair is still decided by
//      roleFuzzyMatch itself.
//
// Ordering is preserved exactly (it is load-bearing downstream — the date sort
// returns 1 for equal dates, so same-date rows keep input order only if the
// group arrives in input order). Groups are emitted in seed order and their
// rows re-sorted by original array position, which is what the nested loop
// produced: the seed is always the first not-yet-used row and the inner loop
// appended the rest in array order.
//
// Exported so a differential test can prove it groups identically to the naive
// O(N²) nested loop it replaced.
export function groupRowsByTitle(rows) {
  // Pass 1 — bucket by lowercased title, remembering each row's original index.
  const buckets = [];
  const bucketOfKey = new Map();
  for (let i = 0; i < rows.length; i++) {
    const key = rows[i].title.toLowerCase();
    let idx = bucketOfKey.get(key);
    if (idx === undefined) {
      idx = buckets.length;
      bucketOfKey.set(key, idx);
      // The representative title is the FIRST row's raw title — the row the
      // nested loop would have seeded with. Others in the bucket differ only in
      // case, and roleFuzzyMatch decides on lowercased text, so it cannot
      // change a verdict.
      buckets.push({ title: rows[i].title, rowIdx: [], tokens: null, tokenSet: null });
    }
    buckets[idx].rowIdx.push(i);
  }

  // One distinct title → the loop would have made a single group of everything.
  if (buckets.length === 1) return [buckets[0].rowIdx.map((i) => rows[i])];

  // Pass 2 — tokenize each distinct title once, then index DISCRIMINATING
  // (non-baseline) token → buckets. Baseline words (engineer, platform, …)
  // appear in most titles at a company; indexing them builds one enormous
  // posting list that has to be walked for every seed and can never, on its
  // own, justify a match.
  const postings = new Map();
  for (let b = 0; b < buckets.length; b++) {
    const tokens = [...new Set(roleTokens(buckets[b].title))];
    buckets[b].tokens = tokens;
    buckets[b].tokenSet = new Set(tokens);
    for (const token of tokens) {
      if (BASELINE_TOKENS.has(token)) continue;
      let list = postings.get(token);
      if (!list) { list = []; postings.set(token, list); }
      list.push(b);
    }
  }

  // Pass 3 — seed buckets in first-appearance order, gathering matches.
  const used = new Uint8Array(buckets.length);
  const seen = new Uint8Array(buckets.length);
  const candidates = [];
  const groups = [];

  for (let seed = 0; seed < buckets.length; seed++) {
    if (used[seed]) continue;
    used[seed] = 1;
    const members = [seed];
    const seedTokens = buckets[seed].tokens;

    // Collect every bucket sharing a discriminating token with the seed. One
    // sharing none cannot match — roleFuzzyMatch requires a non-baseline word
    // in the overlap, so it would return false without ever being asked.
    for (const token of seedTokens) {
      const list = postings.get(token);
      if (!list) continue;
      for (const b of list) {
        if (b === seed || used[b] || seen[b]) continue;
        seen[b] = 1;
        candidates.push(b);
      }
    }

    // Ascending bucket order keeps the candidate walk deterministic run to run.
    // It cannot change the outcome — each candidate is tested against the seed
    // alone.
    candidates.sort((a, b) => a - b);
    for (const b of candidates) {
      seen[b] = 0;
      // Exact overlap over deduped token sets, then the exact Jaccard ratio
      // |A∩B| / |A∪B| with |A∪B| = |A| + |B| − |A∩B|. Both are the same numbers
      // roleFuzzyMatch computes; failing either is a verdict it would reach.
      const candSet = buckets[b].tokenSet;
      let overlap = 0;
      for (const token of seedTokens) if (candSet.has(token)) overlap += 1;
      if (overlap < 2) continue;
      const union = seedTokens.length + buckets[b].tokens.length - overlap;
      if (overlap / union < 0.6) continue;
      if (roleFuzzyMatch(buckets[seed].title, buckets[b].title)) {
        used[b] = 1;
        members.push(b);
      }
    }
    candidates.length = 0;

    if (members.length === 1) {
      groups.push(buckets[seed].rowIdx.map((i) => rows[i]));
      continue;
    }
    // Append one index at a time (not spread): a pathological history can put a
    // very large number of rows into a single bucket, and a spread that wide
    // overflows the argument stack.
    const merged = [];
    for (const b of members) for (const i of buckets[b].rowIdx) merged.push(i);
    merged.sort((a, b) => a - b);
    groups.push(merged.map((i) => rows[i]));
  }

  return groups;
}

// A cluster becomes a repost only when ≥2 DISTINCT urls remain (same url = a
// dedup hit, not a repost) and the first→last span is within windowDays. Rows
// sharing a url collapse to their earliest sighting.
function buildRepostCluster(clusterRows, windowDays) {
  const byUrl = new Map();
  for (const row of clusterRows) {
    if (!byUrl.has(row.url) || row.date < byUrl.get(row.url).date) byUrl.set(row.url, row);
  }
  const deduped = [...byUrl.values()];
  if (deduped.length < 2) return null;

  const sorted = [...deduped].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = daysBetween(first.date, last.date);
  if (span > windowDays) return null;

  return {
    company: clusterRows[0].company,
    role: last.title,
    repostCount: sorted.length,
    firstSeen: first.dateStr,
    lastSeen: last.dateStr,
    daysSpan: span,
    appearances: sorted.map((r) => ({ url: r.url, date: r.dateStr, title: r.title, source: r.source })),
  };
}

/**
 * Read + detect from a scan-history.tsv path. Returns [] if the file is absent.
 * @param {string} path
 * @param {number} [windowDays]
 */
export function detectRepostsFromFile(path, windowDays = DEFAULT_WINDOW_DAYS) {
  if (!path || !existsSync(path)) return [];
  return detectReposts(parseScanHistory(readFileSync(path, 'utf8')), windowDays);
}
