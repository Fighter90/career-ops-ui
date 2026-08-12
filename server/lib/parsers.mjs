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

/**
 * Parse pipeline.md → list of pending URLs.
 * URLs live inside the first ```code-fence``` block, one per line.
 */
export function parsePipeline(text) {
  if (!text) return [];
  const fenceMatch = text.match(/```([\s\S]*?)```/);
  const block = fenceMatch ? fenceMatch[1] : text;
  return block
    .split('\n')
    // v1.84.0 (#1017) — a line may carry an optional `| <compensation>` column;
    // the URL is the first ` | `-delimited token. Bare URLs are unaffected.
    .map((l) => l.trim().split(/\s+\|\s+/)[0].trim())
    .filter((l) => l && (l.startsWith('http') || l.startsWith('local:')));
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

  // Keep existing FULL lines (preserve any trailing `| comp` already written).
  const fenceMatch = text && text.match(/```([\s\S]*?)```/);
  const existingLines = (fenceMatch ? fenceMatch[1] : (text || ''))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      const u = l.split(/\s+\|\s+/)[0].trim();
      return u.startsWith('http') || u.startsWith('local:');
    });
  // Dedup on the URL token (ignore the comp column).
  if (existingLines.some((l) => l.split(/\s+\|\s+/)[0].trim() === trimmed)) return text;

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
  const remaining = parsePipeline(text).filter((u) => u !== url);
  const fenceContent = remaining.join('\n');
  if (text.includes('```')) {
    return text.replace(/```[\s\S]*?```/, '```\n' + fenceContent + '\n```');
  }
  return text;
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

// Flattened, de-duplicated label word lists (English first as universal).
const LABEL_WORDS = { score: [], legitimacy: [] };
for (const kind of ['score', 'legitimacy']) {
  const seen = new Set();
  for (const loc of Object.values(REPORT_LABELS)) {
    for (const w of loc[kind]) {
      if (!seen.has(w)) { seen.add(w); LABEL_WORDS[kind].push(w); }
    }
  }
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
 * the report has none. The heading itself is emitted in English by the parent
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
  const m = src.match(new RegExp('^\\s*' + key + '\\s*[:\\-]\\s*(.+)$', 'im'));
  return m ? m[1].trim() : '';
}

// Last-resort: find any localized prose label (`Оценка: …`, `评分：…`,
// optionally bold-wrapped) and return its value. Runs only after the bold
// labels and the Machine Summary block came up empty.
function proseLabelValue(text, kind) {
  for (const w of LABEL_WORDS[kind]) {
    const re = new RegExp('\\*{0,2}\\s*' + escapeReMeta(w) + '[^:：\\n]*[:：]\\s*(.+)', 'i');
    const m = text.match(re);
    if (m) return m[1].replace(/\*+\s*$/, '').trim();
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
 * Returns { title, date, archetype, score, scoreNum, url, legitimacy, pdf }.
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
  };
  const mtimeIso = opts.mtime ? toIsoDate(opts.mtime) : '';
  if (!text) {
    out.date = mtimeIso;
    return out;
  }

  const titleMatch = text.match(/^#\s+(.+)$/m);
  if (titleMatch) out.title = titleMatch[1].trim();

  // (1) English bold labels — primary; preserves EN reports exactly.
  const enFields = {
    date: /\*\*Date:\*\*\s*(.+)/,
    archetype: /\*\*Archetype:\*\*\s*(.+)/,
    score: /\*\*Score:\*\*\s*(.+)/,
    url: /\*\*URL:\*\*\s*(.+)/,
    legitimacy: /\*\*Legitimacy:\*\*\s*(.+)/,
    pdf: /\*\*PDF:\*\*\s*(.+)/,
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

  // (3) Locale-aware prose labels — last resort.
  if (!out.score) out.score = proseLabelValue(text, 'score');
  if (!out.legitimacy) out.legitimacy = proseLabelValue(text, 'legitimacy');

  // (4) Numeric score, locale-tolerant.
  out.scoreNum = scoreStringToNum(out.score);

  // (5) Date never null when the file mtime is known.
  if (!out.date) out.date = mtimeIso;

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
