/* global window, document */
/**
 * Shared report-export helper (v1.94.0).
 *
 * Used by the AI reports the app generates — market statistics, career plan,
 * career-orientation — to let the user take the report OUT of the browser:
 *
 *   ReportExport.downloadMarkdown('market-report.md', md)  → save the raw .md
 *   ReportExport.savePdf(md, 'Market report', button)      → server-side PDF
 *                                                            (reuses PdfGenerate
 *                                                            /api/stream/pdf/inline)
 *   ReportExport.copy(text)                                → clipboard (Promise)
 *   ReportExport.actionsBar(getMarkdown, titleFn, t)       → a ready ⬇/🖨/⧉ row
 *
 * CSP-safe: the .md download uses a Blob object URL on a user-clicked
 * `<a download>` (a user-initiated download, not a fetch/navigation governed
 * by connect-src), so it works under `default-src 'self'`. The PDF path stays
 * same-origin via the existing inline-PDF SSE runner.
 */
window.ReportExport = (function () {
  function slugify(s) {
    return String(s || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'report';
  }

  function downloadMarkdown(filename, md) {
    const name = /\.md$/i.test(filename) ? filename : `${slugify(filename)}.md`;
    const blob = new Blob([String(md == null ? '' : md)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function savePdf(md, title, button) {
    if (!window.PdfGenerate || !PdfGenerate.run) return;
    return PdfGenerate.run({ kind: 'inline', markdown: String(md || ''), title: title || 'Report', slug: slugify(title || 'report'), button });
  }

  function copy(text) {
    const s = String(text == null ? '' : text);
    if (window.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(s);
    }
    // Fallback: hidden textarea + execCommand (older / insecure contexts).
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove(); resolve();
      } catch (e) { reject(e); }
    });
  }

  /**
   * Build a small actions row (Download .md / Save as PDF / Copy). `getMarkdown`
   * returns the current report string; `titleFn` returns a title for the PDF/file.
   * `t` is the i18n translator. Returns the row element.
   */
  function actionsBar(getMarkdown, titleFn, t) {
    const UI = window.UI; const c = UI.el;
    const tr = (k, f) => (t ? t(k, f) : f);
    const dl = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, tr('export.downloadMd', 'Download .md'));
    const pdf = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, tr('export.savePdf', 'Save as PDF'));
    const cp = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, tr('export.copy', 'Copy'));
    dl.addEventListener('click', () => downloadMarkdown(titleFn(), getMarkdown()));
    pdf.addEventListener('click', () => savePdf(getMarkdown(), titleFn(), pdf));
    cp.addEventListener('click', () => copy(getMarkdown())
      .then(() => UI.toast(tr('export.copied', 'Copied to clipboard'), 'success'))
      .catch(() => UI.toast(tr('export.copyFailed', 'Could not copy'), 'error')));
    return c('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0 0' } }, [dl, pdf, cp]);
  }

  return { downloadMarkdown, savePdf, copy, actionsBar, slugify };
})();
