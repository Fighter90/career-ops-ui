/**
 * Markdown / data-file parsers for career-ops.
 * Pure functions — no I/O. Input: string. Output: structured object.
 * Heavily tested in tests/parsers.test.mjs.
 */
import { normalizeUrl } from './url-key.mjs';

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
    // A row may omit the trailing `|` (GFM allows it) — then the last split
    // part IS the last cell, not the empty tail after the closing pipe.
    const parts = splitUnescaped(line, '|');
    const closed = line.length > 1 && line.endsWith('|') && !line.endsWith('\\|');
    // L262-R1 — undo the writer's escape chain in reverse: the import
    // writer (routes/tracker.mjs cell()) escapes `\` → `\\` FIRST and
    // `|` → `\|` second, so the reader restores `\|` before `\\` —
    // otherwise a company like `C:\Users\Иван` reads back as
    // `C:\\Users\Иван` and a re-import misses the company+role dedup.
    const cells = (closed ? parts.slice(1, -1) : parts.slice(1))
      .map((c) => c.replace(/\\\|/g, '|').replace(/\\\\/g, '\\').trim());

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
 * Header text (already lowercased + trimmed) → canonical field name.
 *
 * A tracker written in another language or with variant column labels — e.g.
 * Spanish `Empresa`/`Puesto`/`Estado`, or English `Position`/`Stage`/`Link` —
 * would otherwise land its values under the wrong keys, so the SPA (which reads
 * `.company`/`.status`/…) renders blanks. This map folds well-known localized /
 * variant headers back onto the canonical field name before the row object is
 * built, so every downstream consumer sees the same field names.
 *
 * The header-alias table covers:
 * identity entries for the canonical labels plus the ES `empresa`→company /
 * `puesto`→role pairs, extended conservatively with the remaining well-known,
 * unambiguous Spanish translations and English variants. Kept deliberately
 * small — an already-canonical English header is unaffected (each maps to
 * itself, or is absent and falls through unchanged), and no risky guess that
 * could shadow a legitimately different column is included.
 */
export const HEADER_ALIASES = {
  // Canonical labels (identity) — mirrors tracker-aliases.json.
  '#': 'num',
  num: 'num',
  date: 'date',
  company: 'company',
  via: 'via',
  role: 'role',
  location: 'location',
  score: 'score',
  status: 'status',
  pdf: 'pdf',
  report: 'report',
  notes: 'notes',
  url: 'url',
  // Spanish localized headers.
  empresa: 'company', // ES header alias
  puesto: 'role', // ES header alias
  estado: 'status',
  fecha: 'date',
  enlace: 'url',
  // English variant headers.
  position: 'role',
  stage: 'status',
  link: 'url',
};

/**
 * Parse applications.md → array of objects keyed by canonical field names.
 * Adds .reportPath if a `[\d+](reports/...)` link is present in the Report cell.
 */
// ── v1.248.8 — parent parity #3516 (URL cell rendering) ─────────────────────
// The parent now writes a tracker `URL` cell as a markdown link
// (`[careers.acme.com](https://…)`) so the table stays readable. The href IS
// the dedup key, so every reader extracts it before normalizing. Ported from
// the parent's tracker-parse.mjs (markdownLinkDestination / parseMarkdownLinks
// / extractCellUrl): a cell with a link yields the first http(s) target; a
// bare URL / `N/A` / `—` / empty cell is returned verbatim (trimmed), so the
// "no key is not a key" rule keeps working unchanged.
function markdownLinkDestination(raw) {
  const value = String(raw).trimStart();
  if (value.startsWith('<')) {
    for (let i = 1; i < value.length; i++) {
      if (value[i] === '\\') {
        i++;
      } else if (value[i] === '>') {
        return value.slice(1, i).replace(/\\([\\()<> ])/g, '$1');
      }
    }
    return null;
  }

  let depth = 0;
  let end = value.length;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\') {
      i++;
      continue;
    }
    if (value[i] === '(') depth++;
    else if (value[i] === ')' && depth > 0) depth--;
    else if (/\s/.test(value[i]) && depth === 0) {
      end = i;
      break;
    }
  }
  const destination = value.slice(0, end).trim();
  return destination ? destination.replace(/\\([\\()<> ])/g, '$1') : null;
}

/** Every markdown link in a string, as {label, target} in encounter order. */
export function parseMarkdownLinks(value) {
  const links = [];
  let cursor = 0;
  const v = String(value ?? '');
  while (cursor < v.length) {
    const labelStart = v.indexOf('[', cursor);
    if (labelStart === -1) break;

    let labelEnd = -1;
    for (let i = labelStart + 1; i < v.length; i++) {
      if (v[i] === '\\') i++;
      else if (v[i] === ']') {
        labelEnd = i;
        break;
      }
    }
    if (labelEnd === -1 || v[labelEnd + 1] !== '(') {
      cursor = labelStart + 1;
      continue;
    }

    let depth = 1;
    let linkEnd = -1;
    for (let i = labelEnd + 2; i < v.length; i++) {
      if (v[i] === '\\') {
        i++;
      } else if (v[i] === '(') {
        depth++;
      } else if (v[i] === ')' && --depth === 0) {
        linkEnd = i;
        break;
      }
    }
    if (linkEnd === -1) {
      cursor = labelStart + 1;
      continue;
    }

    const target = markdownLinkDestination(v.slice(labelEnd + 2, linkEnd));
    if (target != null) links.push({ label: v.slice(labelStart + 1, labelEnd), target });
    cursor = linkEnd + 1;
  }
  return links;
}

/**
 * The posting URL a tracker `URL` cell points at, in either written form
 * (markdown link or bare URL). First http(s) target wins; no link → the
 * trimmed cell, so placeholder handling keeps working unchanged.
 */
export function extractCellUrl(cellValue) {
  const value = String(cellValue ?? '').trim();
  if (!value) return '';
  for (const link of parseMarkdownLinks(value)) {
    const target = String(link.target).trim().replace(/^<|>$/g, '');
    if (/^https?:\/\//i.test(target)) return target;
  }
  return value;
}

export function parseApplications(text) {
  const { headers, rows } = parseMarkdownTable(text);
  if (!headers.length) return [];
  // Normalize each header cell exactly as before (leading `#` → `num`,
  // lowercase, trim), then fold known localized/variant labels onto their
  // canonical field name. Unknown or already-canonical headers pass through
  // unchanged, so an all-English tracker parses byte-identically to before.
  const keys = headers.map((h) => {
    const norm = h.replace(/^#/, 'num').toLowerCase().trim();
    return HEADER_ALIASES[norm] ?? norm;
  });

  return rows.map((cells) => {
    const obj = {};
    keys.forEach((k, i) => {
      obj[k] = cells[i] ?? '';
    });
    // v1.248.8 — the parent renders the URL cell as a markdown link
    // (#3516); the href is the dedup key, so extract it at parse time.
    if (obj.url) obj.url = extractCellUrl(obj.url);

    // Extract score number
    if (obj.score) {
      // `4,5/5` (comma decimal, de/fr/ru trackers) is 4.5, not 4.
      const m = obj.score.match(/(\d+(?:[.,]\d+)?)/);
      obj.scoreNum = m ? parseFloat(m[1].replace(',', '.')) : null;
    }

    // Extract report path
    if (obj.report) {
      // One nested level of parentheses is allowed inside the link target, so
      // `[042](reports/042-acme-(berlin)-2024-01-15.md)` keeps its full path
      // instead of truncating at the first `)` (parent 5f7819f, bug 4).
      const m = obj.report.match(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)/);
      obj.reportPath = m && m[1] ? m[1] : null;
    }

    obj.pdfReady = obj.pdf?.includes('✅') || false;
    return obj;
  });
}

// Upstream career-ops writes pipeline.md as `## Pending` / `## Processed`
// sections of `- [ ] url | company | title | …` rows (scan.mjs
// PIPELINE_SKELETON / appendToPipeline), with Spanish section names on older
// installs. A file in that shape has no code fence.
const PENDING_HEADINGS = ['## Pending', '## Pendientes'];
const PROCESSED_HEADINGS = ['## Processed', '## Procesadas'];
const UNCHECKED_ROW = /^-\s+\[ \]\s+/;

function isChecklistPipeline(text) {
  if (!text || text.includes('```')) return false;
  return /^-\s+\[[ xX]\]\s+/m.test(text)
    || [...PENDING_HEADINGS, ...PROCESSED_HEADINGS].some((h) => new RegExp(`^${h}\\s*$`, 'm').test(text));
}

/** The URL of one pipeline line (fenced or `- [ ]` row); '' when it has none. */
function lineUrl(line) {
  return line.trim().replace(UNCHECKED_ROW, '').split(/\s+\|\s+/)[0].trim();
}

/**
 * Parse pipeline.md → list of pending URLs.
 * URLs live inside the first ```code-fence``` block, one per line — or, in the
 * parent's checklist format, in the unchecked `- [ ] url | …` rows.
 */
export function parsePipeline(text) {
  if (!text) return [];
  const fenceMatch = text.match(/```([\s\S]*?)```/);
  const block = fenceMatch ? fenceMatch[1] : text;
  return block
    .split('\n')
    // v1.84.0 (#1017) — a line may carry an optional `| <compensation>` column;
    // the URL is the first ` | `-delimited token. Bare URLs are unaffected.
    // Checked `- [x]` rows keep their prefix and so fall out of the filter.
    .map(lineUrl)
    .filter((l) => l && (l.startsWith('http') || l.startsWith('local:')));
}

/**
 * Pending pipeline rows with their metadata, for the #/map view. A checklist
 * row is `- [ ] url | company | title | location | note…`; a fenced bare-URL
 * line (whose 2nd column is compensation, not company) yields the URL only.
 * `href` is a clickable link: the URL itself, or for `local:` entries the
 * first http(s) URL in the trailing cells (e.g. `note: linkedin https://…`).
 */
export function parsePipelineRows(text) {
  if (!text) return [];
  const fenceMatch = text.match(/```([\s\S]*?)```/);
  const block = fenceMatch ? fenceMatch[1] : text;
  const rows = [];
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    const checklist = UNCHECKED_ROW.test(line);
    const cells = line.replace(UNCHECKED_ROW, '').split(/\s+\|\s+/).map((s) => s.trim());
    const url = cells[0];
    if (!url || !(url.startsWith('http') || url.startsWith('local:'))) continue;
    const [, company = '', title = '', location = '', ...rest] = checklist ? cells : [url];
    const href = url.startsWith('http') ? url : ((rest.join(' ').match(/https?:\/\/\S+/) || [])[0] || null);
    rows.push({ url, company, title, location, href });
  }
  return rows;
}

/** Insert one `- [ ]` row at the end of the checklist's Pending section. */
function addChecklistRow(text, row) {
  const pending = PENDING_HEADINGS.find((h) => new RegExp(`^${h}\\s*$`, 'm').test(text));
  if (pending) {
    const start = text.search(new RegExp(`^${pending}\\s*$`, 'm')) + pending.length;
    const next = text.indexOf('\n## ', start);
    const end = next === -1 ? text.length : next;
    const section = text.slice(start, end).replace(/\s+$/, '');
    const rest = text.slice(end).replace(/^\n+/, '');
    return text.slice(0, start) + section + '\n' + row + '\n' + (rest ? '\n' + rest : '');
  }
  // No Pending section — create one before Processed (or at the end).
  const processed = text.search(new RegExp(`^(${PROCESSED_HEADINGS.join('|')})\\s*$`, 'm'));
  const at = processed === -1 ? text.length : processed;
  const head = text.slice(0, at).replace(/\s+$/, '');
  return (head ? head + '\n\n' : '') + '## Pending\n\n' + row + '\n\n' + text.slice(at);
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

  // URL lines (with any trailing `| comp`) — used for dedup only; the write
  // below appends to the raw text so nothing else in the file is rebuilt.
  const fenceMatch = text && text.match(/```([\s\S]*?)```/);
  const existingLines = (fenceMatch ? fenceMatch[1] : (text || ''))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      const u = l.split(/\s+\|\s+/)[0].trim();
      return u.startsWith('http') || u.startsWith('local:');
    });
  // Dedup on the CANONICAL URL key (ignore the comp column), so the same
  // posting re-listed with a tracking param / http↔https / trailing slash is
  // recognised instead of appended as a second line. Falls back to the raw
  // token when the URL can't be keyed (e.g. a `local:jds/…` reference).
  const incomingKey = normalizeUrl(trimmed) || trimmed;
  if (existingLines.some((l) => {
    const u = l.split(/\s+\|\s+/)[0].trim();
    return (normalizeUrl(u) || u) === incomingKey;
  })) return text;

  const comp = sanitizePipelineComp(opts.comp);
  if (isChecklistPipeline(text)) {
    // Dedup against processed `- [x]` rows too, so an evaluated posting is not
    // queued (and paid for) a second time.
    const known = text.split('\n')
      .filter((l) => /^-\s+\[[ xX]\]\s+/.test(l.trim()))
      .map((l) => l.trim().replace(/^-\s+\[[ xX]\]\s+/, '').split(/\s+\|\s+/)[0].trim());
    if (known.some((u) => (normalizeUrl(u) || u) === incomingKey)) return text;
    // The parent reads checklist columns positionally (url | company | title |
    // location | comp), so compensation rides as a labeled `note:` segment.
    return addChecklistRow(text, `- [ ] ${trimmed}${comp ? ` | note: comp ${comp}` : ''}`);
  }
  const newLine = comp ? `${trimmed} | ${comp}` : trimmed;
  if (fenceMatch) {
    // Append inside the existing fence, keeping every raw line (comments,
    // blank lines, a language tag). A replacer FUNCTION: a replacement string
    // would expand `$&` / `$'` / `$$` inside a URL and corrupt the file.
    const inner = fenceMatch[1].replace(/\s+$/, '');
    return text.replace(/```[\s\S]*?```/, () => '```' + inner + '\n' + newLine + '\n```');
  }
  if (existingLines.length) {
    // Bare-URL file (no fence): append a bare line rather than duplicating
    // every existing URL into a new fence.
    return text.replace(/\s*$/, '\n') + newLine + '\n';
  }
  return (
    (text || '# Pipeline — Pending URLs\n\nDrop job URLs (one per line) here.\n\n') +
    '```\n' +
    newLine +
    '\n```\n'
  );
}

/**
 * CAR-151 — removePipelineUrl's lossless twin: the same matching, the same
 * updated text, plus the RAW lines that were dropped, so an undo can put
 * them back content-faithfully (the bare addPipelineUrl re-add loses a
 * checklist row's `| company | title | …` cells).
 */
export function removePipelineUrlExtract(text, url) {
  // Only a URL token can name a pipeline row — never drop a comment line.
  if (!text || typeof url !== 'string' || !(url.startsWith('http') || url.startsWith('local:'))) {
    return { updated: text, removedLines: [] };
  }
  const removedLines = [];
  if (isChecklistPipeline(text)) {
    const updated = text
      .split('\n')
      .filter((l) => {
        if (UNCHECKED_ROW.test(l.trim()) && lineUrl(l) === url) { removedLines.push(l); return false; }
        return true;
      })
      .join('\n');
    return { updated, removedLines };
  }
  // Drop only the matching raw lines — other rows keep their `| comp` column
  // and any non-URL line survives. `updated === text` ⇔ nothing matched
  // (a filter that removes nothing rejoins to the identical string), so
  // callers can detect a no-op without consulting removedLines.
  const dropMatching = (block) => block
    .split('\n')
    .filter((l) => {
      if (lineUrl(l) === url) { removedLines.push(l); return false; }
      return true;
    })
    .join('\n');
  const fenceMatch = text.match(/```([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = dropMatching(fenceMatch[1]);
    if (inner === fenceMatch[1]) return { updated: text, removedLines: [] };
    return { updated: text.replace(/```[\s\S]*?```/, () => '```' + inner + '```'), removedLines };
  }
  const updated = dropMatching(text);
  return updated === text ? { updated: text, removedLines: [] } : { updated, removedLines };
}

/**
 * Remove a URL from pipeline.md.
 */
export function removePipelineUrl(text, url) {
  return removePipelineUrlExtract(text, url).updated;
}

/**
 * CAR-150 — the compensation cell of a raw pipeline line, so the undo's
 * BARE re-add fallback can restore the column the token path preserves
 * byte-for-byte (the DELETE answer carries it; GET /api/pipeline only
 * ever answered bare URLs). A fenced/bare line's trailing cells ARE the
 * comp column (the v1.84.0 written shape is exactly `url | comp`); a
 * checklist row's cells are company/title/location — only its labeled
 * `note: comp …` segment is compensation, never the other cells.
 * Returns '' when the line carries none (or the input isn't a line).
 */
export function pipelineLineComp(line) {
  if (typeof line !== 'string') return '';
  const trimmed = line.trim();
  const isCheckRow = UNCHECKED_ROW.test(trimmed);
  const cells = trimmed.replace(UNCHECKED_ROW, '').split(/\s+\|\s+/).map((s) => s.trim());
  if (isCheckRow) {
    const note = cells.find((c) => /^note: comp /.test(c));
    return note ? sanitizePipelineComp(note.replace(/^note: comp /, '')) : '';
  }
  return sanitizePipelineComp(cells.slice(1).join(' | '));
}

/** Any `- [ ]` / `- [x]` row prefix (checklist pipeline rows). */
const ANY_CHECK_ROW = /^-\s+\[[ xX]\]\s+/;

/**
 * The URL token of a pipeline line in either written form. Finding 4
 * (review r2): the SAME tokenizer the removal path uses — lineUrl, after
 * stripping either check-row prefix — so a dedup key computed here is
 * always a key parsePipeline would compute too.
 */
function pipelineRowUrl(line) {
  return lineUrl(line.replace(ANY_CHECK_ROW, ''));
}

/**
 * Adapt a raw line to the checklist row shape. A line that already IS an
 * unchecked row is used verbatim — the content-faithful path. Anything
 * else (a fenced `url | comp` line restored after a format switch) is
 * converted the way addPipelineUrl writes compensation — a labeled
 * `note: comp` segment — so the parent reading columns positionally never
 * takes a trailing cell for the company or title. The cells join with `; `
 * (review finding 2): no `|` separators that could re-introduce columns.
 */
function toChecklistRow(line) {
  if (UNCHECKED_ROW.test(line)) return line;
  const cells = line.replace(ANY_CHECK_ROW, '').split(/\s+\|\s+/).map((s) => s.trim());
  const comp = sanitizePipelineComp(cells.slice(1).join('; '));
  return `- [ ] ${cells[0]}${comp ? ` | note: comp ${comp}` : ''}`;
}

/**
 * Append raw lines to a fenced / bare-URL pipeline, in the same shapes
 * addPipelineUrl writes (in-fence append, bare append, fenced skeleton) —
 * ONE splice for the whole batch.
 */
function addRawPipelineLines(text, lines) {
  const block = lines.join('\n');
  const fenceMatch = text.match(/```([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = fenceMatch[1].trimEnd();
    // Replacer FUNCTION: a replacement string would expand `$&` / `$'` /
    // `$$` inside the lines and corrupt the file (same trap addPipelineUrl
    // documents).
    return text.replace(/```[\s\S]*?```/, () => '```' + inner + '\n' + block + '\n```');
  }
  const hasLines = text.split('\n').some((l) => {
    const u = lineUrl(l);
    return u.startsWith('http') || u.startsWith('local:');
  });
  // trimEnd(), not /\s+$/ — linear on large files (review finding 9).
  if (hasLines) return text.trimEnd() + '\n' + block + '\n';
  return (
    (text || '# Pipeline — Pending URLs\n\nDrop job URLs (one per line) here.\n\n') +
    '```\n' +
    block +
    '\n```\n'
  );
}

/**
 * CAR-151 — lossless undo. Reinsert RAW pipeline lines exactly as
 * removePipelineUrlExtract returned them, so a checklist row's cells
 * (`- [ ] url | company | title | location | notes…`) survive an undo —
 * which the bare addPipelineUrl re-add loses.
 *
 * CONTENT-faithful, not byte-faithful (review finding 10): the cells come
 * back exactly, but rows re-insert at the END of the Pending section /
 * fence (not their old position) and stray indentation is trimmed.
 *
 * Per line: a single line whose URL token (lineUrl — the removal
 * tokenizer, review finding 4) is an http(s)/`local:` URL WITHOUT
 * whitespace, no fence-breaking ```, at most 2000 chars; anything else is
 * refused — counted, never written. A line whose canonical URL key is
 * already present (pending OR processed) is skipped as a dup, mirroring
 * addPipelineUrl, so an undo stays idempotent when the URL was re-added
 * meanwhile. Duplicates WITHIN the batch are not collapsed: removing a
 * duplicated row took both lines, undo puts both back.
 *
 * Format choice (review finding 3): decided from the file first, but a
 * checklist-shaped removed line forces the checklist path when the file
 * itself no longer shows it (e.g. the deleted row was the only
 * `- [ ]` feature) — a fence still wins, so a Pending section is never
 * spliced into a fenced file.
 *
 * The whole batch inserts in ONE splice (review finding 11) — no
 * per-line full-file rewrites.
 *
 * Optional `opts.validate` overrides the row-token gate (for callers
 * restoring UNTRUSTED content; the route feeds back the server's own
 * stored lines and passes no validator). Returns
 * { updated, restored, deduped, refused }.
 */
export function restorePipelineLines(text, lines, opts = {}) {
  const validate = typeof opts.validate === 'function'
    ? opts.validate
    : (s) => /^(https?:\/\/|local:)/i.test(s);
  const base = typeof text === 'string' ? text : '';
  const incoming = Array.isArray(lines) ? lines : [];
  const checklist = isChecklistPipeline(base)
    || (!base.includes('```') && incoming.some((l) => typeof l === 'string' && UNCHECKED_ROW.test(l.trim())));
  // Dedup keys of the file BEFORE this restore — anything re-added between
  // the delete and the undo must not be duplicated by it. Covers the fence
  // lines and, in checklist mode (no fence by definition), the processed
  // `[x]` rows too.
  const known = new Set();
  const fenceMatch = base.match(/```([\s\S]*?)```/);
  const block = fenceMatch ? fenceMatch[1] : base;
  for (const l of block.split('\n')) {
    const u = pipelineRowUrl(l.trim());
    if (u.startsWith('http') || u.startsWith('local:')) known.add(normalizeUrl(u) || u);
  }

  const rows = [];
  let restored = 0;
  let deduped = 0;
  let refused = 0;
  for (const raw of incoming) {
    const line = typeof raw === 'string' ? raw.trim() : '';
    // Row/fence-injection guards: one line, one token, no fence breaker.
    if (!line || /[\r\n]/.test(line) || line.includes('```') || line.length > 2000) {
      refused += 1;
      continue;
    }
    const token = pipelineRowUrl(line);
    if (!token || /\s/.test(token)
      || !(token.startsWith('http') || token.startsWith('local:'))
      || !validate(token)) {
      refused += 1;
      continue;
    }
    if (known.has(normalizeUrl(token) || token)) {
      deduped += 1;
      continue;
    }
    rows.push(checklist ? toChecklistRow(line) : line.replace(ANY_CHECK_ROW, '').trim());
    restored += 1;
  }
  // One splice for the whole batch: addChecklistRow splices its argument
  // verbatim before the next heading, so the joined rows are one insert.
  const updated = rows.length
    ? (checklist ? addChecklistRow(base, rows.join('\n')) : addRawPipelineLines(base, rows))
    : base;
  return { updated, restored, deduped, refused };
}

/**
 * FIX-1 (v1.159.0) — locale-aware prose labels for the report score /
 * legitimacy lines, used ONLY as a last-resort fallback when neither the
 * English bold labels nor the language-invariant `## Machine Summary` block
 * carried the fact. Keyed by the 17 UI-dict locale codes (note `ko`, not
 * `ko-KR`). A per-locale entry is required — `report-header-locale.test.mjs`
 * fails the build if a locale is added without one, so a new locale can't
 * silently regress non-English report parsing.
 */
export const REPORT_LABELS = {
  en: { score: ['Score'], legitimacy: ['Legitimacy'] },
  es: { score: ['Puntuación', 'Puntaje'], legitimacy: ['Legitimidad'] },
  'pt-BR': { score: ['Pontuação'], legitimacy: ['Legitimidade'] },
  ko: { score: ['점수'], legitimacy: ['정당성', '진위'] },
  ja: { score: ['スコア', '評価'], legitimacy: ['正当性', '信頼性'] },
  ru: { score: ['Оценка', 'Балл'], legitimacy: ['Легитимность'] },
  'zh-CN': { score: ['评分', '分数'], legitimacy: ['合法性', '真实性'] },
  'zh-TW': { score: ['評分', '分數'], legitimacy: ['合法性', '真實性'] },
  fr: { score: ['Score', 'Note'], legitimacy: ['Légitimité'] },
  pl: { score: ['Wynik', 'Ocena'], legitimacy: ['Wiarygodność'] },
  uk: { score: ['Оцінка', 'Бал'], legitimacy: ['Легітимність'] },
  da: { score: ['Score', 'Pointtal'], legitimacy: ['Legitimitet'] },
  ar: { score: ['الدرجة', 'التقييم'], legitimacy: ['المشروعية', 'الشرعية'] },
  de: { score: ['Bewertung', 'Punktzahl'], legitimacy: ['Legitimität', 'Seriosität'] },
  it: { score: ['Punteggio', 'Valutazione'], legitimacy: ['Legittimità'] },
  tr: { score: ['Puan', 'Skor'], legitimacy: ['Meşruiyet', 'Güvenilirlik'] },
  hi: { score: ['स्कोर'], legitimacy: ['वैधता'] },
};

// Label words that are also everyday words in another language (French
// `Note` = score, but `**Note:**` is an English/German annotation). They are
// tried LAST and only accepted when the value carries a score number, so a
// German `**Note:** remote unclear` can't beat `**Bewertung:** 4/5`.
const AMBIGUOUS_LABELS = new Set(['note']);

// Flattened, de-duplicated label word lists (English first as universal;
// ambiguous words moved to the end).
const LABEL_WORDS = { score: [], legitimacy: [] };
for (const kind of ['score', 'legitimacy']) {
  const seen = new Set();
  for (const loc of Object.values(REPORT_LABELS)) {
    for (const w of loc[kind]) {
      if (!seen.has(w)) { seen.add(w); LABEL_WORDS[kind].push(w); }
    }
  }
  LABEL_WORDS[kind].sort((a, b) => Number(AMBIGUOUS_LABELS.has(a.toLowerCase())) - Number(AMBIGUOUS_LABELS.has(b.toLowerCase())));
}

/** An ambiguous label only counts when its value parses as a score. */
function acceptLabelValue(word, value) {
  return !AMBIGUOUS_LABELS.has(word.toLowerCase()) || scoreStringToNum(value) != null;
}

const escapeReMeta = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * FIX-1 — locale-tolerant "score string → number". Accepts `4.5/5`,
 * `4.5 / 5`, `4,5/5` (comma decimal), `1.5 из 5` / `4.5 out of 5`, and a bare
 * `4.5`. Returns null when there is no in-range (0–5) number.
 */
export function scoreStringToNum(s) {
  if (s == null) return null;
  const m = String(s).match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

/**
 * FIX-1 — the language-invariant `## Machine Summary` block body, or '' when
 * the report has none. The heading itself is emitted in English by the
 * oferta template regardless of the report's prose locale, so its `score:` /
 * `legitimacy:` / `date:` YAML keys are the reliable, locale-free source.
 */
function machineSummaryBlock(text) {
  const at = text.search(/^##\s+Machine Summary/im);
  if (at === -1) return '';
  const after = text.slice(at);
  const rest = after.slice(after.indexOf('\n') + 1);
  const nextH = rest.search(/^##\s/m);
  return nextH === -1 ? rest : rest.slice(0, nextH);
}

// Grab a `key: value` (or `key - value`) line, case-insensitive.
function yamlValue(src, key) {
  // `[ \t]*`, not `\s*`: with the `m` flag `\s*` crosses newlines, so an
  // empty `score:` would capture the NEXT line as its value.
  const m = src.match(new RegExp('^[ \\t]*' + key + '[ \\t]*[:\\-][ \\t]*(.+)$', 'im'));
  return m ? m[1].trim() : '';
}

// #4452 — `score_evidence` from the Machine Summary: the parent's evaluation
// contract (modes/oferta.md, canonical schema in batch/batch-prompt.md) makes
// the model mirror its Score Evidence table as a nested YAML map of scoring
// dimensions → `supported | partial | unknown`. Tolerant of the ```yaml
// fences and of quoted values; the scan stops at the first line that is not
// an indented `key: value` (dedent / next top-level key / closing fence), so
// later summary fields are never swallowed. Unknown dims and off-contract
// values are dropped, so an unfilled placeholder degrades to {} and the
// evidence chips stay hidden. Returns {} when the key is absent.
function machineScoreEvidence(src) {
  const lines = String(src).split('\n');
  const at = lines.findIndex((l) => /^[ \t]*score_evidence[ \t]*:/.test(l));
  if (at === -1) return {};
  const out = {};
  for (let i = at + 1; i < lines.length; i++) {
    const m = lines[i].match(/^[ \t]{2,}([\w-]+)[ \t]*:[ \t]*"?(supported|partial|unknown)"?[ \t]*$/);
    if (!m) break;
    out[m[1]] = m[2];
  }
  return out;
}

// #4452 — `confidence_gaps` from the Machine Summary: up to three concrete
// verification priorities the model could not resolve. Both YAML list forms
// are read — the inline `confidence_gaps: ["a", "b"]` and the block list
// under a bare `confidence_gaps:` — plus the schema default `[]`. Items keep
// their commas: the inline form prefers quoted-string extraction, the block
// form is line-based. Returns [] when absent or empty.
function machineConfidenceGaps(src) {
  const lines = String(src).split('\n');
  const at = lines.findIndex((l) => /^[ \t]*confidence_gaps[ \t]*:/.test(l));
  if (at === -1) return [];
  const inline = lines[at].slice(lines[at].indexOf(':') + 1).trim();
  if (inline && inline !== '[]' && inline !== 'null' && inline !== '~') {
    const quoted = inline.match(/"([^"]*)"/g);
    const items = quoted
      ? quoted.map((s) => s.slice(1, -1).trim())
      : inline.replace(/^\[/, '').replace(/\]$/, '').split(',').map((s) => s.replace(/^['"]|['"]$/g, '').trim());
    return items.filter(Boolean);
  }
  const out = [];
  for (let i = at + 1; i < lines.length; i++) {
    const m = lines[i].match(/^[ \t]+-[ \t]*(.+)$/);
    if (!m) break;
    const item = m[1].replace(/^['"]|['"]$/g, '').trim();
    if (item) out.push(item);
  }
  return out;
}

// v1.174.0 (FIND-2) — strip markdown emphasis markers (**bold** / *italic*)
// from an extracted value, so a legitimacy chip reads "High Confidence", not
// "** High Confidence". v1.175.0 — nullish-safe (a nullish input yields '',
// never the string "undefined"; the fields are string-initialized, so this is
// defense-in-depth per the AI review).
const stripEmphasis = (s) => (s == null ? '' : String(s).replace(/\*+/g, '').trim());

// v1.174.0 (FIND-1) — a localized BOLD label line: `**Оценка:** 1.5 / 5` /
// `**Label**: value`. Requiring the leading `**` is what makes this immune to
// a plain H1 that merely contains the label word (`# Оценка вакансии: …`) —
// headings use `#`, never `**`. The colon must sit next to the label.
function boldLabelValue(text, words) {
  for (const w of words) {
    const re = new RegExp('\\*\\*[ \\t]*' + escapeReMeta(w) + '[ \\t]*\\*{0,2}[ \\t]*[:：][ \\t]*\\*{0,2}[ \\t]*(.+)', 'i');
    const m = text.match(re);
    if (m && acceptLabelValue(w, m[1])) return stripEmphasis(m[1]);
  }
  return '';
}

// v1.176.0 (FIND-5) — language-independent score fallback. Finds a score under
// ANY bold label (`**Итоговый балл:** 1.8 / 5`, `**Скор:** 1.8 / 5`) by matching
// the VALUE form (a fraction over the /5 rubric denominator) rather than a
// synonym list — so localized labels the REPORT_LABELS table doesn't enumerate
// still parse. A plain heading can't match (no `**`, no `/5` value); a date like
// `5/5/2026` can't either (the negative lookahead rejects a denominator followed
// by another `/` or digit).
function boldScoreValueForm(text) {
  const m = String(text).match(
    /\*\*[^*\n]+?\*\*[ \t]*[:：]?[ \t]*(\d+(?:[.,]\d+)?[ \t]*\/[ \t]*5(?:[.,]0)?)(?![\d/])/,
  );
  return m ? m[1].replace(/[ \t]+/g, ' ').trim() : '';
}

// v1.174.0 (overflow) — keep the score field compact so a chip never renders a
// trailing status sentence ("1.8, Status: Evaluated, …") and blow out its
// coloured block. A clean "X.X" / "X.X / Y" is returned verbatim (EN reports
// stay byte-identical); anything with trailing prose collapses to the numeric
// fraction, or `<num> / 5` when only a bare number survives.
function compactScore(raw, num) {
  if (!raw) return raw;
  if (/^\s*\d+(?:[.,]\d+)?\s*(?:\/\s*\d+(?:[.,]\d+)?)?\s*$/.test(raw)) return raw.trim();
  const frac = String(raw).match(/\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?/);
  if (frac) return frac[0].replace(/\s+/g, ' ').trim();
  // No fraction and no derivable number → empty, so the value falls through to
  // the muted "Score not detected" chip (reports.js) instead of leaving trailing
  // status prose in the score field / its accessible name (AI-review #2).
  return num != null ? `${num} / 5` : '';
}

// Last-resort: a localized prose label (`Оценка: …`, `评分：…`, optionally
// bold-wrapped) on its OWN line. v1.174.0 (FIND-1): scan line-by-line, skip
// heading lines (`# …`) entirely, and require the label to sit at the line
// start immediately before the colon — so `# Оценка вакансии: <title>` and
// `Общая оценка …:` can never hijack the field. Runs only after the bold
// labels and the Machine Summary block came up empty.
function proseLabelValue(text, kind) {
  for (const line of String(text).split('\n')) {
    if (/^\s*#/.test(line)) continue;
    for (const w of LABEL_WORDS[kind]) {
      const re = new RegExp('^[ \\t]*\\*{0,2}[ \\t]*' + escapeReMeta(w) + '[ \\t]*\\*{0,2}[ \\t]*[:：][ \\t]*(.+)', 'i');
      const m = line.match(re);
      if (m && acceptLabelValue(w, m[1])) return stripEmphasis(m[1]);
    }
  }
  return '';
}

function toIsoDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/**
 * Parse a report file's header (the first heading + metadata).
 * Returns { title, date, archetype, score, scoreNum, url, legitimacy, pdf,
 *           scoreEvidence, confidenceGaps }.
 *
 * #4452 — `scoreEvidence` ({dim: supported|partial|unknown}) and
 * `confidenceGaps` (string[]) come from the Machine Summary contract; both
 * default to {} / [] so a report without them renders no evidence block.
 *
 * FIX-1 (v1.159.0): parsing is no longer English-only. Order of precedence:
 *   1. English `**Score:**`-style bold labels  → keeps EN reports byte-identical.
 *   2. the language-invariant `## Machine Summary` YAML block  → all locales.
 *   3. locale-aware prose labels (REPORT_LABELS)  → last resort.
 * `scoreNum` is derived with locale-tolerant numeric parsing, and `date`
 * falls back to `opts.mtime` (the file mtime the list builder already has) so
 * a card never loses its chronological anchor.
 */
export function parseReportHeader(text, opts = {}) {
  const out = {
    title: '',
    date: '',
    archetype: '',
    score: '',
    scoreNum: null,
    url: '',
    legitimacy: '',
    pdf: '',
    scoreEvidence: {},
    confidenceGaps: [],
  };
  const mtimeIso = opts.mtime ? toIsoDate(opts.mtime) : '';
  if (!text) {
    out.date = mtimeIso;
    return out;
  }

  const titleMatch = text.match(/^#\s+(.+)$/m);
  if (titleMatch) out.title = titleMatch[1].trim();

  // (1) English bold labels — primary; preserves EN reports exactly.
  // `[ \t]*` keeps an empty label from capturing the next line.
  const enFields = {
    date: /\*\*Date:\*\*[ \t]*(.+)/,
    archetype: /\*\*Archetype:\*\*[ \t]*(.+)/,
    score: /\*\*Score:\*\*[ \t]*(.+)/,
    url: /\*\*URL:\*\*[ \t]*(.+)/,
    legitimacy: /\*\*Legitimacy:\*\*[ \t]*(.+)/,
    pdf: /\*\*PDF:\*\*[ \t]*(.+)/,
  };
  for (const [k, re] of Object.entries(enFields)) {
    const m = text.match(re);
    if (m) out[k] = m[1].trim();
  }

  // (2) `## Machine Summary` block — language-invariant. Fills only the
  //     fields the English labels didn't (non-EN + auto-pipeline reports).
  const src = machineSummaryBlock(text) || text;
  if (!out.score) out.score = yamlValue(src, 'score');
  if (!out.legitimacy) out.legitimacy = yamlValue(src, 'legitimacy');
  if (!out.date) out.date = yamlValue(src, 'date');
  if (!out.url) out.url = yamlValue(src, 'url');
  if (!out.archetype) out.archetype = yamlValue(src, 'archetype');
  if (!out.pdf) out.pdf = yamlValue(src, 'pdf');

  // (#4452) Evidence-confidence surfaces — the Machine Summary contract's
  // score_evidence map and confidence_gaps list, for the report-view chips.
  out.scoreEvidence = machineScoreEvidence(src);
  out.confidenceGaps = machineConfidenceGaps(src);

  // (2.5) Localized BOLD labels (`**Оценка:** 1.5/5`). Beats the loose prose
  //       fallback so a body H1 that merely contains the label word can't win.
  if (!out.score) out.score = boldLabelValue(text, LABEL_WORDS.score);
  if (!out.legitimacy) out.legitimacy = boldLabelValue(text, LABEL_WORDS.legitimacy);

  // (2.6) FIND-5 — score under a bold label the table doesn't enumerate
  //       (`**Итоговый балл:**`, `**Скор:**`), matched by the /5 value form.
  if (!out.score) out.score = boldScoreValueForm(text);

  // (3) Locale-aware prose labels — last resort (heading-safe, colon-anchored).
  if (!out.score) out.score = proseLabelValue(text, 'score');
  if (!out.legitimacy) out.legitimacy = proseLabelValue(text, 'legitimacy');

  // (4) Normalize: strip stray emphasis from the legitimacy chip (FIND-2),
  //     derive the numeric score, and compact the score display (overflow).
  out.legitimacy = stripEmphasis(out.legitimacy);
  out.scoreNum = scoreStringToNum(out.score);
  // (4.5) FIND-A — rescue a body score the earlier steps couldn't turn into a
  //   number. A Machine Summary placeholder (`score: —` / `score: не определён`)
  //   or an out-of-range value occupies out.score and blocks the value-form
  //   pass, leaving a real `**Итоговый балл:** 1.8 / 5` in the body unparsed. If
  //   we still have no usable number, take the /5 value form now.
  if (out.scoreNum == null) {
    const vf = boldScoreValueForm(text);
    const vfNum = scoreStringToNum(vf);
    if (vfNum != null) { out.score = vf; out.scoreNum = vfNum; }
  }
  out.score = compactScore(out.score, out.scoreNum);

  // (5) Date never null when the file mtime is known.
  if (!out.date) out.date = mtimeIso;

  return out;
}

/** FNV-1a 32-bit → 8 hex chars. Pure, dependency-free, stable across runs. */
function shortHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Slug a string for filename use. Output stays ASCII `[a-z0-9-]` (every
 * route's sanitizePathName accepts it). Latin accents fold (`Nürnberg` →
 * `nurnberg`); letters/digits that cannot fold (Cyrillic, CJK, …) would be
 * lost, so an 8-hex hash of the input is appended instead — `Яндекс` and
 * `Сбербанк` get distinct, stable slugs rather than colliding on ''.
 */
export function slugify(s) {
  const src = String(s || '').normalize('NFC');
  const folded = src.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const base = folded
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!/[^\x00-\x7f]/.test(folded) || !/[\p{L}\p{N}]/u.test(folded.replace(/[\x00-\x7f]/g, ''))) {
    return base;
  }
  const h = shortHash(src.toLowerCase());
  return base ? `${base}-${h}` : h;
}

/**
 * Today as YYYY-MM-DD.
 */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
