/**
 * Markdown / data-file parsers for career-ops.
 * Pure functions — no I/O. Input: string. Output: structured object.
 * Heavily tested in tests/parsers.test.mjs.
 */

/**
 * Split `s` on `delim` but ignore occurrences preceded by a backslash.
 * Used by parseMarkdownTable so `\|` inside a cell stays inside the cell.
 */
function splitUnescaped(s, delim) {
  const out = [];
  let buf = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === delim) {
      buf += '\\' + delim;
      i += 1;
      continue;
    }
    if (c === delim) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += c;
  }
  out.push(buf);
  return out;
}

/**
 * Parse a markdown table (GFM). Returns { headers: string[], rows: string[][] }.
 * Empty input or no table → { headers: [], rows: [] }.
 */
export function parseMarkdownTable(text) {
  if (!text) return { headers: [], rows: [] };
  const lines = text.split('\n');
  let headers = [];
  const rows = [];
  let inTable = false;
  let separatorSeen = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('|')) {
      if (inTable) break; // table ended
      continue;
    }
    // BF-1 — split on unescaped `|` only. GFM lets writers escape a
    // literal pipe inside a cell as `\|`; without this, a company name
    // like "Acme | Co" would explode into two cells and corrupt the
    // table parse. Restore the literal `|` after splitting.
    const cells = splitUnescaped(line, '|')
      .slice(1, -1)
      .map((c) => c.replace(/\\\|/g, '|').trim());

    if (!inTable) {
      headers = cells;
      inTable = true;
      continue;
    }

    if (!separatorSeen) {
      // separator row like |---|---|
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        separatorSeen = true;
        continue;
      }
      // not a real table — abort
      return { headers: [], rows: [] };
    }

    rows.push(cells);
  }

  return { headers, rows };
}

/**
 * Parse applications.md → array of objects keyed by lowercased headers.
 * Adds .reportPath if a `[\d+](reports/...)` link is present in the Report cell.
 */
export function parseApplications(text) {
  const { headers, rows } = parseMarkdownTable(text);
  if (!headers.length) return [];
  const keys = headers.map((h) => h.replace(/^#/, 'num').toLowerCase().trim());

  return rows.map((cells) => {
    const obj = {};
    keys.forEach((k, i) => {
      obj[k] = cells[i] ?? '';
    });

    // Extract score number
    if (obj.score) {
      const m = obj.score.match(/([\d.]+)/);
      obj.scoreNum = m ? parseFloat(m[1]) : null;
    }

    // Extract report path
    if (obj.report) {
      const m = obj.report.match(/\(([^)]+)\)/);
      obj.reportPath = m ? m[1] : null;
    }

    obj.pdfReady = obj.pdf?.includes('✅') || false;
    return obj;
  });
}

/** Extract a pending URL from either a bare line or a Markdown checklist row. */
function pipelineUrlFromLine(line) {
  let candidate = line.trim();
  const checklist = candidate.match(/^- \[([ xX])\]\s+(.+)$/);
  if (checklist) {
    if (checklist[1].toLowerCase() === 'x') return '';
    candidate = checklist[2].trim();
  }
  // v1.84.0 (#1017) — a line may carry optional metadata columns; the URL is
  // the first ` | `-delimited token. Bare URLs are unaffected.
  const url = candidate.split(/\s+\|\s+/)[0].trim();
  return url.startsWith('http') || url.startsWith('local:') ? url : '';
}

/**
 * Parse pipeline.md → list of pending URLs.
 *
 * Supports both historical fenced URL lists and the current parent scanner's
 * `- [ ] URL | Company | Role | Location` rows. Checked rows are processed and
 * therefore excluded. Scan the whole document so mixed-format files remain
 * readable while users migrate between parent versions.
 */
export function parsePipeline(text) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map(pipelineUrlFromLine)
    .filter(Boolean);
}

/**
 * Cheap default validator (REVIEW-C4). Route handlers gate inputs with
 * `isValidJobUrl` from server/index.mjs; this is the parser-level
 * defense-in-depth so future callers (CLI utilities, batch importers,
 * scanners) can't accidentally pump a `javascript:` URL into pipeline.md.
 */
function defaultUrlGate(s) {
  if (typeof s !== 'string') return false;
  return /^https?:\/\//i.test(s);
}

/**
 * Sanitize an optional compensation cell for pipeline.md (#1017). Collapses
 * newlines / tabs / pipes (which would inject a column or row), trims, and
 * neutralizes a spreadsheet-formula-leading char. Returns '' when empty.
 */
function sanitizePipelineComp(v) {
  if (typeof v !== 'string') return '';
  // Collapse injection chars (newline / tab / pipe), then hard-cap the cell to
  // 80 chars TOTAL. For a formula-lead (= + - @) reserve one char for the
  // neutralizing quote so the quoted cell still fits in 80 (never 81).
  const s = v.replace(/[\r\n\t|]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (/^[=+\-@]/.test(s)) return `'${s.slice(0, 79)}`;
  return s.slice(0, 80);
}

/**
 * Add a URL to pipeline.md content. Returns updated content.
 * Preserves existing fence (and any existing `| comp` columns); creates one if missing.
 *
 * Optional `opts.validate` overrides the default `https?://` gate.
 * Optional `opts.comp` appends a sanitized compensation column (`url | comp`).
 */
export function addPipelineUrl(text, url, opts = {}) {
  const trimmed = (url || '').trim();
  if (!trimmed) return text;
  const validate = typeof opts.validate === 'function' ? opts.validate : defaultUrlGate;
  if (!validate(trimmed)) return text; // refuse to write an invalid URL

  // Dedup across both supported parent formats, including checklist rows.
  if (parsePipeline(text).includes(trimmed)) return text;

  // Keep existing FULL lines (preserve any trailing `| comp` already written).
  const fenceMatch = text && text.match(/```([\s\S]*?)```/);
  const existingLines = (fenceMatch ? fenceMatch[1] : (text || ''))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      const u = l.split(/\s+\|\s+/)[0].trim();
      return u.startsWith('http') || u.startsWith('local:');
    });
  const comp = sanitizePipelineComp(opts.comp);
  const newLine = comp ? `${trimmed} | ${comp}` : trimmed;
  const fenceContent = [...existingLines, newLine].join('\n');
  if (text && text.includes('```')) {
    return text.replace(/```[\s\S]*?```/, '```\n' + fenceContent + '\n```');
  }
  return (
    (text || '# Pipeline — Pending URLs\n\nDrop job URLs (one per line) here.\n\n') +
    '```\n' +
    fenceContent +
    '\n```\n'
  );
}

/**
 * Remove a URL from pipeline.md.
 */
export function removePipelineUrl(text, url) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return text
    .split(/\r?\n/)
    .filter((line) => pipelineUrlFromLine(line) !== url)
    .join(eol);
}

/**
 * Parse a report file's header (the first heading + bold metadata).
 * Returns { title, date, archetype, score, scoreNum, url, legitimacy, pdf }.
 */
export function parseReportHeader(text) {
  const out = {
    title: '',
    date: '',
    archetype: '',
    score: '',
    scoreNum: null,
    url: '',
    legitimacy: '',
    pdf: '',
  };
  if (!text) return out;

  const titleMatch = text.match(/^#\s+(.+)$/m);
  if (titleMatch) out.title = titleMatch[1].trim();

  const fields = {
    date: /\*\*Date:\*\*\s*(.+)/,
    archetype: /\*\*Archetype:\*\*\s*(.+)/,
    score: /\*\*Score:\*\*\s*(.+)/,
    url: /\*\*URL:\*\*\s*(.+)/,
    legitimacy: /\*\*Legitimacy:\*\*\s*(.+)/,
    pdf: /\*\*PDF:\*\*\s*(.+)/,
  };
  for (const [k, re] of Object.entries(fields)) {
    const m = text.match(re);
    if (m) out[k] = m[1].trim();
  }

  if (out.score) {
    const m = out.score.match(/([\d.]+)/);
    out.scoreNum = m ? parseFloat(m[1]) : null;
  }
  return out;
}

/**
 * Slug a string for filename use.
 */
export function slugify(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Today as YYYY-MM-DD.
 */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
