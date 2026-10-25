/* global window */
/**
 * CAR-116 — pure helpers for the #/pipeline v2 view: URL-key
 * normalization, enrichment joins over EXISTING /api payloads
 * (tracker rows, report headers, the checklist cells /api/map/jobs
 * already returns), grouping, filtering and the session undo queue.
 *
 * No DOM here on purpose — every function is pure so it can be unit
 * tested directly (tests/pipeline-view-lib.test.mjs loads this file in
 * a synthetic window, the tracker-stages.test.mjs pattern).
 */
window.PipelineView = (function () {
  'use strict';

  // Query params that mark the SAME posting reached through a different
  // click; stripped before two URLs are considered one entry.
  const TRACKING_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'fbclid', 'yclid', 'ref', 'referrer',
  ];

  /**
   * Canonical comparison key for a posting URL: host lowercased with the
   * www. prefix folded, hash dropped, tracking params dropped, trailing
   * slash dropped. Non-http(s) refs (local: captures) pass through
   * lowercased so they still key stably.
   */
  function normKey(url) {
    const s = String(url || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) return s.toLowerCase();
    try {
      const u = new URL(s);
      const keep = [];
      for (const [k, v] of u.searchParams) {
        if (!TRACKING_PARAMS.includes(k.toLowerCase())) keep.push(k + '=' + v);
      }
      const path = u.pathname.replace(/\/+$/, '') || '/';
      return u.hostname.replace(/^www\./, '').toLowerCase() + path +
        (keep.length ? '?' + keep.sort().join('&') : '');
    } catch {
      return s.toLowerCase();
    }
  }

  /** "4,2/5" → 4.2 · numbers pass through · garbage → null. */
  function parseScore(v) {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const m = String(v).match(/(\d+(?:[.,]\d+)?)/);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  }

  /** Display host for a URL ('' when unparseable), www.-stripped. */
  function hostOf(url) {
    try {
      return new URL(String(url)).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /**
   * Report H1 → { company, role }. Parent header convention (v1.248.7):
   * a leading short "Label:" (Evaluation: / Оценка: / …) means the rest
   * reads "Company — Role"; a bare title reads "Role — Company". The
   * company name may itself contain dashes, so only SPACE-surrounded
   * dashes split, and only the outermost pair is interpreted.
   */
  function splitReportTitle(title) {
    const t = String(title || '').trim();
    if (!t) return { company: '', role: '' };
    let body = t;
    let labelled = false;
    const colon = t.indexOf(':');
    if (colon > 0 && colon <= 24) {
      body = t.slice(colon + 1).trim();
      labelled = true;
    }
    const parts = body.split(/\s+[—–-]\s+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return labelled
        ? { company: parts[0], role: parts.slice(1).join(' — ') }
        : { company: parts[parts.length - 1], role: parts.slice(0, -1).join(' — ') };
    }
    return labelled ? { company: '', role: body } : { company: body, role: '' };
  }

  /**
   * One lookup table keyed by normKey(url). Later sources WIN per field
   * (verified data over display guesses), so the write order is
   * weakest-first: checklist cells → report headers → tracker rows.
   * Reads ONLY the shapes the existing endpoints already return.
   */
  function buildEnrichment(opts) {
    const o = opts || {};
    const byKey = new Map();
    const put = (url, patch) => {
      const key = normKey(url);
      if (!key) return;
      const cur = byKey.get(key) || {};
      for (const k of Object.keys(patch)) {
        if (patch[k] !== undefined && patch[k] !== null && patch[k] !== '') cur[k] = patch[k];
      }
      byKey.set(key, cur);
    };
    // GET /api/map/jobs → pipeline: [{url, company, title, location, fit?}]
    // — the parent's checklist cells (scan-written), display-grade.
    for (const r of o.mapRows || []) {
      if (!r || !r.url) continue;
      put(r.url, { company: r.company || '', role: r.title || '', location: r.location || '' });
    }
    // GET /api/reports → [{slug, title, date, score, scoreNum, url, …}]
    for (const rep of o.reports || []) {
      if (!rep || !rep.url) continue;
      const sr = splitReportTitle(rep.title);
      put(rep.url, {
        company: sr.company,
        role: sr.role,
        scoreNum: rep.scoreNum != null ? rep.scoreNum : parseScore(rep.score),
        date: rep.date || '',
        report: rep.slug || '',
      });
    }
    // GET /api/tracker → rows: [{company, role, score, scoreNum, status, url, …}]
    for (const row of o.trackerRows || []) {
      if (!row || !row.url) continue;
      put(row.url, {
        company: row.company || '',
        role: row.role || '',
        scoreNum: row.scoreNum != null ? row.scoreNum : parseScore(row.score),
        status: row.status || '',
        tracked: true,
        date: row.date || '',
        report: row.report || '',
      });
    }
    return byKey;
  }

  /**
   * Raw pipeline URLs → display entries joined against the enrichment
   * table. Entries with no match still render (host + URL fallback).
   */
  function enrichEntries(urls, enrichment) {
    const table = enrichment || new Map();
    const out = [];
    for (const url of urls || []) {
      const key = normKey(url);
      const e = table.get(key) || {};
      out.push({
        url,
        key,
        host: hostOf(url),
        company: e.company || '',
        role: e.role || '',
        location: e.location || '',
        scoreNum: e.scoreNum != null ? e.scoreNum : null,
        status: e.status || '',
        tracked: !!e.tracked,
        date: e.date || '',
        report: e.report || '',
      });
    }
    return out;
  }

  /** Entry matches a free-text query across url/company/role/host. */
  function matchesQuery(entry, q) {
    if (!q) return true;
    const hay = (entry.url + ' ' + entry.company + ' ' + entry.role + ' ' +
      entry.host + ' ' + (entry.location || '')).toLowerCase();
    return hay.includes(q);
  }

  /** Query + hide-already-evaluated filter over enriched entries. */
  function filterEntries(entries, query, opts) {
    const o = opts || {};
    const q = String(query || '').trim().toLowerCase();
    return (entries || []).filter((e) =>
      (!o.hideTracked || !e.tracked) && matchesQuery(e, q));
  }

  /**
   * Group entries by company (fallback: host). A board whose tracked
   * rows carry a company while its fresh rows do not must NOT split in
   * two, so entries without a company fold into the company already
   * mapped to their host (habr 672 evaluated «Хабр» + habr 673 fresh →
   * ONE «Хабр» group). Groups come back sorted biggest-first so the
   * bulk-cleanup path reaches the noisiest board immediately; ties
   * break alphabetically.
   */
  function groupEntries(entries) {
    const hostCompany = new Map();
    for (const e of entries || []) {
      if (e.company && e.host) hostCompany.set(e.host, e.company);
    }
    const map = new Map();
    for (const e of entries || []) {
      const label = e.company || hostCompany.get(e.host) || e.host || e.url;
      const key = label.toLowerCase();
      let g = map.get(key);
      if (!g) {
        g = { key, label, entries: [] };
        map.set(key, g);
      }
      g.entries.push(e);
    }
    return Array.from(map.values()).sort((a, b) =>
      b.entries.length - a.entries.length || a.label.localeCompare(b.label));
  }

  /** Bounded LIFO of discarded URL batches (session memory only). */
  function createUndoQueue(limit) {
    const cap = Math.max(1, limit || 5);
    const stack = [];
    return {
      push(batch) {
        if (!batch || !batch.length) return;
        stack.push(batch.slice());
        if (stack.length > cap) stack.shift();
      },
      pop() {
        return stack.pop() || null;
      },
      peek() {
        return stack.length ? stack[stack.length - 1] : null;
      },
      get size() {
        return stack.length;
      },
    };
  }

  return {
    TRACKING_PARAMS,
    normKey,
    parseScore,
    hostOf,
    splitReportTitle,
    buildEnrichment,
    enrichEntries,
    matchesQuery,
    filterEntries,
    groupEntries,
    createUndoQueue,
  };
})();
