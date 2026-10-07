/**
 * CV import — convert an uploaded document of any common format into
 * markdown the SPA can drop straight into the CV editor.
 *
 * Pipeline per file extension:
 *   .md / .markdown / .txt           → keep as-is (decode UTF-8)
 *   .html / .htm / .docx / .odt / .rtf → pandoc --sandbox → markdown
 *   (.doc — the legacy binary Word format — is NOT accepted: pandoc has no
 *   reader for it, so it could only ever fail; the hint says to save as .docx)
 *   .pdf                             → pdftotext -layout → wrap as markdown
 *
 * Each external converter is invoked with the upload buffered to a
 * temp file (avoids stdin streaming quirks for binary inputs) and the
 * result captured from a temp output file. Both temps are cleaned in a
 * finally block — no orphans on success or error.
 *
 * The function never throws on a missing converter — instead it
 * surfaces { ok: false, error, hint } so the UI can render a friendly
 * "install pandoc / poppler" message rather than a 500.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';

const PANDOC_FORMATS = new Set(['html', 'htm', 'docx', 'odt', 'rtf']);
const PASSTHROUGH_FORMATS = new Set(['md', 'markdown', 'txt']);
const SUPPORTED = new Set([...PANDOC_FORMATS, ...PASSTHROUGH_FORMATS, 'pdf']);

// Hard cap on uploads. 10 MB covers the longest real CV by ~50× and
// stops accidental PowerPoint/photo uploads dead in their tracks.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function describeSupportedFormats() {
  return [...SUPPORTED].sort();
}

function runCmd(cmd, args, { input, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve) => {
    // Collect raw bytes and decode once at the end: decoding each chunk on its
    // own turned a multibyte character split across two chunks into U+FFFD.
    const out = [];
    const err = [];
    let timedOut = false;
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      return resolve({ code: -1, stdout: '', stderr: e.message, missing: e.code === 'ENOENT' });
    }
    const text = (chunks) => Buffer.concat(chunks).toString('utf8');
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch {}
    }, timeoutMs);
    child.stdout.on('data', (b) => { out.push(b); });
    child.stderr.on('data', (b) => { err.push(b); });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout: text(out), stderr: e.message, missing: e.code === 'ENOENT' });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: text(out), stderr: text(err), timedOut });
    });
    if (input) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
  });
}

/**
 * A converter that exits 0 but extracts nothing — a scanned PDF with no text
 * layer, an empty document. Reporting ok:true here dropped a blank CV into the
 * editor as if the import had worked.
 */
function noText(ext, converter) {
  return {
    ok: false,
    sourceFormat: ext,
    error: `no text could be extracted (${converter})`,
    hint: ext === 'pdf'
      ? 'The PDF has no text layer (a scan or an image). Export it from the original document, or run OCR first.'
      : 'The document appears to be empty.',
  };
}

/**
 * Best-effort file-extension detection. Falls back to .txt if the
 * filename has no extension, so plain-text uploads (e.g. dragged from
 * a clipboard buffer save) still land on the passthrough branch.
 */
export function classifyExtension(filename) {
  const ext = extname(filename || '').toLowerCase().replace(/^\./, '');
  if (!ext) return 'txt';
  return ext;
}

/**
 * Convert an uploaded buffer to markdown.
 *
 * @param {Buffer} buffer    raw bytes from the upload
 * @param {string} filename  original name — only ext matters
 * @returns {Promise<{ ok: true, markdown, sourceFormat, converter, sizeBytes } |
 *                   { ok: false, error, hint?, sourceFormat? }>}
 */
export async function importDocumentToMarkdown(buffer, filename) {
  // Coerce to a string — a repeated request header arrives as an array, and the
  // downstream extension/format logic assumes a string (type-confusion guard).
  filename = typeof filename === 'string' ? filename : String(Array.isArray(filename) ? filename[0] : (filename ?? ''));
  if (!Buffer.isBuffer(buffer)) {
    return { ok: false, error: 'expected a Buffer payload' };
  }
  // `buffer` is a verified Buffer here, so `.length` is already a number. Read
  // it once behind an explicit `typeof … === 'number'` guard (a barrier CodeQL
  // recognizes for js/type-confusion-through-parameter-tampering) so a tampered
  // payload can never smuggle an object/array `.length` into a size decision.
  // Behaviour is unchanged: a real Buffer's length is always a finite number.
  const rawLen = buffer.length;
  const sizeBytes = (typeof rawLen === 'number' && Number.isFinite(rawLen)) ? rawLen : 0;
  if (sizeBytes === 0) {
    return { ok: false, error: 'empty file' };
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `file too large (${(sizeBytes / 1024 / 1024).toFixed(1)} MB > ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)`,
    };
  }

  const ext = classifyExtension(filename);
  if (!SUPPORTED.has(ext)) {
    const supported = `Supported: ${describeSupportedFormats().map((e) => '.' + e).join(', ')}`;
    return {
      ok: false,
      sourceFormat: ext,
      error: `unsupported format ".${ext}"`,
      hint: ext === 'doc' ? `Save the file as .docx and upload that. ${supported}` : supported,
    };
  }

  // Passthrough branch — md/markdown/txt are already text.
  if (PASSTHROUGH_FORMATS.has(ext)) {
    const text = buffer.toString('utf8');
    return {
      ok: true,
      markdown: text,
      sourceFormat: ext,
      converter: 'passthrough',
      sizeBytes,
    };
  }

  const tmp = mkdtempSync(join(tmpdir(), 'cv-import-'));
  try {
    if (ext === 'pdf') {
      const inFile = join(tmp, 'in.pdf');
      writeFileSync(inFile, buffer);
      // pdftotext -layout preserves the visual layout of columns / two-pagers
      // which gives MUCH better markdown than the default reflow mode.
      const r = await runCmd('pdftotext', ['-layout', '-enc', 'UTF-8', inFile, '-']);
      if (r.missing) {
        return {
          ok: false,
          sourceFormat: ext,
          error: 'pdftotext not installed',
          hint: 'Install Poppler: macOS → `brew install poppler`, Linux → `apt install poppler-utils`.',
        };
      }
      if (r.code !== 0) {
        return {
          ok: false,
          sourceFormat: ext,
          error: `pdftotext failed (exit ${r.code})`,
          hint: r.stderr.split('\n').slice(0, 4).join('\n'),
        };
      }
      // Wrap the extracted text — preserve line breaks but collapse
      // runs of 3+ blank lines so the editor doesn't drown in whitespace.
      const md = r.stdout.replace(/\n{3,}/g, '\n\n').trim() + '\n';
      if (!md.trim()) return noText(ext, 'pdftotext');
      return {
        ok: true,
        markdown: md,
        sourceFormat: ext,
        converter: 'pdftotext',
        sizeBytes,
      };
    }

    // Pandoc branch — covers docx, doc, odt, rtf, html.
    const inFile = join(tmp, 'in.' + ext);
    writeFileSync(inFile, buffer);
    // --sandbox: pandoc's readers (HTML in particular) otherwise fetch
    // `<iframe src>` / remote images themselves — a server-side request to any
    // URL in the upload, past every SSRF guard we have. The flag exists since
    // pandoc 2.15; an older pandoc rejects it, and is retried without it —
    // those versions also predate the fetching iframe reader.
    const baseArgs = ['-f', ext === 'htm' ? 'html' : ext, '-t', 'gfm-raw_html', '--wrap=preserve'];
    let r = await runCmd('pandoc', ['--sandbox', ...baseArgs, inFile]);
    if (r.code !== 0 && !r.missing && /unknown option.*--sandbox/i.test(r.stderr)) {
      r = await runCmd('pandoc', [...baseArgs, inFile]);
    }
    if (r.missing) {
      return {
        ok: false,
        sourceFormat: ext,
        error: 'pandoc not installed',
        hint: 'Install Pandoc: macOS → `brew install pandoc`, Linux → `apt install pandoc`.',
      };
    }
    if (r.code !== 0) {
      return {
        ok: false,
        sourceFormat: ext,
        error: `pandoc failed (exit ${r.code})`,
        hint: r.stderr.split('\n').slice(0, 4).join('\n'),
      };
    }
    const md = r.stdout.trim() + '\n';
    if (!md.trim()) return noText(ext, 'pandoc');
    return {
      ok: true,
      markdown: md,
      sourceFormat: ext,
      converter: 'pandoc',
      sizeBytes,
    };
  } finally {
    if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  }
}
