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
  // v1.243.0 — keep Unicode letters: a non-Latin title ("Отчёт по рынку",
  // "Καθημερινή αναφορά") collapsed to nothing under [^a-z0-9] and EVERY
  // download was called report.md. The download attribute is UTF-8 in
  // every evergreen browser, so the readable name is safe to keep.
  function slugify(s) {
    return String(s || 'report').toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '') || 'report';
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

  async function saveDocx(md, title, button) {
    const UI = window.UI;
    const wasDisabled = button && button.disabled;
    if (button) button.disabled = true;
    try {
      const res = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title || 'Document', markdown: String(md || '') }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${slugify(title || 'document')}.docx`; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      // v1.243.0 — route the failure through an existing dict key instead of
      // a hard-coded English sentence (wrong in the other 16 locales). The
      // DOCX button was just clicked, so the generic key stays clear; the
      // dicts still lack a dedicated export.docxFailed key (reported, not
      // added here).
      const tr = (k, f) => (window.I18n && I18n.t) ? I18n.t(k, f) : f;
      if (UI && UI.toast) UI.toast(tr('common.error', 'Error'), 'error');
    } finally {
      if (button) button.disabled = wasDisabled || false;
    }
  }

  function copy(text) {
    const s = String(text == null ? '' : text);
    if (window.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(s);
    }
    // Fallback: hidden textarea + execCommand (older / insecure contexts).
    return new Promise((resolve, reject) => {
      let ta = null;
      try {
        ta = document.createElement('textarea');
        ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        // execCommand reports whether the copy actually happened — a silent
        // false used to resolve "Copied" with an empty clipboard (v1.243.0).
        const ok = document.execCommand('copy');
        ta.remove();
        if (ok) resolve();
        else reject(new Error('execCommand copy rejected'));
      } catch (e) {
        if (ta && ta.remove) ta.remove();
        reject(e);
      }
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
    const docx = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, tr('export.saveDocx', 'Save as DOCX'));
    const cp = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, tr('export.copy', 'Copy'));
    dl.addEventListener('click', () => downloadMarkdown(titleFn(), getMarkdown()));
    pdf.addEventListener('click', () => savePdf(getMarkdown(), titleFn(), pdf));
    docx.addEventListener('click', () => saveDocx(getMarkdown(), titleFn(), docx));
    cp.addEventListener('click', () => copy(getMarkdown())
      .then(() => UI.toast(tr('export.copied', 'Copied to clipboard'), 'success'))
      .catch(() => UI.toast(tr('export.copyFailed', 'Could not copy'), 'error')));
    return c('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0 0' } }, [dl, pdf, docx, cp]);
  }

  return { downloadMarkdown, savePdf, saveDocx, copy, actionsBar, slugify };
})();
