// @ts-check
/**
 * detect-reposts.mjs — repost / ghost-posting detector.
 *
 * Ported from parent career-ops `detect-reposts.mjs` (v1.15.0) and adapted to
 * the web-ui scan-history.tsv format. Groups scan-history rows by company,
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
import { roleFuzzyMatch } from './role-matcher.mjs';
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
  const titleGroups = [];
  const used = new Set();
  for (const row of rows) {
    if (used.has(row)) continue;
    const group = [row];
    used.add(row);
    for (const other of rows) {
      if (used.has(other)) continue;
      if (row.title.toLowerCase() === other.title.toLowerCase() || roleFuzzyMatch(row.title, other.title)) {
        group.push(other);
        used.add(other);
      }
    }
    titleGroups.push(group);
  }

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
