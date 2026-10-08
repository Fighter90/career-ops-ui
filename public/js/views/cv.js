/* global Router, API, UI, I18n */
// CAR-20 (v1.243.0) — module-level dirty state, shared by every render
// of this route (a classic script executes once, so these bindings
// outlive individual Router.render() calls):
//   - cvDirtyBuffer  the latest unsaved editor content, or null when the
//     editor matches the server copy. Written on every input; cleared on
//     Save / baseline reset / a confirmed leave. Restored into the
//     editor on the next render, so the guard's Cancel (hash rewind →
//     re-render) and the language switch (Router.render(), no
//     hashchange) no longer throw the user's edits away.
//   - cvRouteHash    the current route hash with any ?query stripped —
//     the leave-guard compares it EXACTLY — a prefix check would also
//     swallow the studio route ('#/cv-studio' shares the first segment).
//   - cvGuardDetach  detaches the active view instance's
//     beforeunload/hashchange guard listeners; the next render drops the
//     previous instance's guards before registering its own, so a stale
//     textarea can never prompt on tab close.
let cvDirtyBuffer = null;
const cvRouteHash = () => (window.location.hash || '').split('?')[0];
let cvGuardDetach = null;
Router.register('cv', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  // F-V54-A (v1.54.1) — a CV markdown's own `# Name` rendered as a
  // SECOND top-level <h1> beside the page-title <h1>CV</h1> (WCAG 1.3.1
  // Info & Relationships / 2.4.6 Headings). Shift every preview heading
  // down one level (h1→h2 … h5→h6, h6→role=heading aria-level=7) so the
  // page keeps exactly one <h1>. Scoped to cv.js on purpose: UI.md is
  // shared by help/reports/deep/evaluate which each manage headings
  // their own way (help strips article h1s + builds its TOC from h2).
  const cvMd = (src) => UI.md(src || '')
    .replace(/<h6\b([^>]*)>/g, '<div role="heading" aria-level="7"$1>')
    .replace(/<\/h6>/g, '</div>')
    .replace(/<h5\b/g, '<h6').replace(/<\/h5>/g, '</h6>')
    .replace(/<h4\b/g, '<h5').replace(/<\/h4>/g, '</h5>')
    .replace(/<h3\b/g, '<h4').replace(/<\/h3>/g, '</h4>')
    .replace(/<h2\b/g, '<h3').replace(/<\/h2>/g, '</h3>')
    .replace(/<h1\b/g, '<h2').replace(/<\/h1>/g, '</h2>');
  const data = await API.get('/api/cv');
  // CAR-20 (v1.243.0) — restore an unsaved-edit buffer across re-renders
  // (guard-Cancel rewind, language switch). The server copy stays the
  // dirty baseline, so a restored buffer still reads as dirty until Save
  // lands. If the server already caught up, drop the buffer.
  const serverMarkdown = data.markdown || '';
  if (cvDirtyBuffer != null && cvDirtyBuffer === serverMarkdown) cvDirtyBuffer = null;
  const hasBuffer = typeof cvDirtyBuffer === 'string' && cvDirtyBuffer !== serverMarkdown;
  if (hasBuffer) data.markdown = cvDirtyBuffer;
  // v1.47.0 (WS2 #16) gave the editor an accessible name via
  // aria-labelledby → the "Markdown" section heading. v1.55.2
  // (F-V55-H / UX-5) upgrades that terse "Markdown" name to a
  // descriptive, self-contained aria-label so a screen-reader user
  // landing on the field hears what it is, not just "Markdown". The
  // visible <h3 id="cv-md-heading">Markdown</h3> stays on screen for
  // sighted users; aria-label takes ARIA precedence over the now-
  // removed aria-labelledby (avoids dead, ignored markup).
  const ta = c('textarea', {
    className: 'textarea', rows: 30, style: { minHeight: '60vh' },
    id: 'cv-editor',
    'aria-label': t('cv.editorAria', 'CV markdown editor — your professional resume in markdown format'),
  }, data.markdown || '');
  const pdfBox = c('div');

  async function loadPdfList() {
    pdfBox.innerHTML = '';
    let files = [];
    try {
      const r = await API.get('/api/output/pdfs');
      files = r.files || [];
    } catch {}
    if (!files.length) return;
    pdfBox.appendChild(c('h3', { className: 'section-title' }, t('cv.pdfTitle', 'Generated PDFs')));
    const list = c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap' } });
    for (const f of files) {
      const url = '/api/output/pdfs/' + encodeURIComponent(f.name);
      list.appendChild(c('div', { className: 'card', style: { padding: '12px 16px', minWidth: '260px' } }, [
        c('div', { style: { fontWeight: 600, marginBottom: '4px' } }, f.name),
        c('div', { style: { color: 'var(--foggy)', fontSize: '12px', marginBottom: '8px' } },
          `${(f.size / 1024).toFixed(1)} KB · ${new Date(f.mtime).toLocaleString()}`),
        c('div', { className: 'flex gap-3' }, [
          // D-5 (v1.169.0) — `?inline=1` makes the browser RENDER the PDF in a
          // new tab (review-before-send) instead of downloading it; the old
          // attachment route forced a download even from this "open" link.
          c('a', { className: 'btn btn-ghost btn-sm', href: url + '?inline=1', target: '_blank', rel: 'noopener' }, '👁 ' + t('cv.openPdf', 'Preview')),
          c('a', { className: 'btn btn-primary btn-sm', href: url, download: f.name }, '⬇ ' + t('cv.downloadPdf', 'Download')),
        ]),
      ]));
    }
    pdfBox.appendChild(list);
  }

  // Snapshot the latest PDF in the output dir so we can detect what
  // generate-pdf.mjs produced and trigger a browser download for it.
  async function latestPdfName() {
    try {
      const r = await API.get('/api/output/pdfs');
      const files = r.files || [];
      if (!files.length) return null;
      // /api/output/pdfs returns files sorted newest-first.
      return files[0].name;
    } catch { return null; }
  }

  function triggerDownload(name) {
    const a = document.createElement('a');
    a.href = '/api/output/pdfs/' + encodeURIComponent(name);
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function streamPdf(btn) {
    UI.toast(t('cv.pdfRunning', 'Generating PDF…'));
    btn.classList.add('is-loading');
    btn.disabled = true;
    const before = await latestPdfName();
    const lines = [];
    const console_ = c('pre', { className: 'console', style: { maxHeight: '320px', overflow: 'auto' } }, '');
    UI.modal(t('cv.pdfTitle', 'Generate PDF'), console_);
    const es = API.stream('/api/stream/pdf', async (event, data) => {
      if (event === 'log' && data.line) {
        lines.push(data.line);
        console_.textContent = lines.join('\n');
        console_.scrollTop = console_.scrollHeight;
      } else if (event === 'done') {
        lines.push(`✓ done (exit ${data.code})`);
        console_.textContent = lines.join('\n');
        UI.toast(t('cv.pdfDone', 'PDF generated'), 'success');
        await loadPdfList();
        const after = await latestPdfName();
        // Only auto-download if generate-pdf produced a NEW file; otherwise
        // a no-op rerun would silently re-download the same artifact.
        if (after && after !== before) {
          triggerDownload(after);
        }
        btn.classList.remove('is-loading');
        btn.disabled = false;
      } else if (event === 'error') {
        const hint = /ERR_MODULE_NOT_FOUND|playwright/i.test(data.message || '')
          ? '\n\n' + t('cv.pdfNeedsPlaywright', 'Playwright is missing. Run in the parent project:\n  cd "$CAREER_OPS_ROOT" && npm install && npx playwright install chromium')
          : '';
        lines.push('✗ ' + (data.message || 'error') + hint);
        console_.textContent = lines.join('\n');
        UI.toast(data.message || 'error', 'error');
        btn.classList.remove('is-loading');
        btn.disabled = false;
      }
    });
    return es;
  }

  // Hidden file input — we'll click() it from the visible "Upload CV" button.
  // Accepts text formats; binary formats (pdf/docx/odt/rtf/doc) POST to
  // /api/cv/import, which delegates to pandoc / pdftotext server-side.
  const fileInput = c('input', {
    type: 'file',
    accept: '.md,.markdown,.txt,.html,.htm,.pdf,.docx,.doc,.odt,.rtf',
    style: { display: 'none' },
    onChange: async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const sizeKb = (file.size / 1024).toFixed(1);
      UI.toast(t('cv.uploadConverting', 'Converting…') + ` ${file.name} (${sizeKb} KB)`);
      try {
        const buf = await file.arrayBuffer();
        // CAR-20 (v1.243.0) — a header value outside ISO-8859-1
        // ('Резюме.pdf') makes fetch throw TypeError before a byte leaves
        // the browser. Percent-encode; the server only reads the
        // extension hint, which encodeURIComponent preserves verbatim.
        const res = await fetch('/api/cv/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Filename': encodeURIComponent(file.name),
          },
          body: buf,
        });
        let payload;
        try { payload = await res.json(); }
        catch { payload = { ok: false, error: `HTTP ${res.status}` }; }
        if (!res.ok || !payload.ok) {
          const hint = payload.hint ? '\n\n' + payload.hint : '';
          UI.toast((payload.error || 'import failed') + hint, 'error');
          return;
        }
        ta.value = payload.markdown;
        // U-15 (v1.58.33) — programmatic assignment doesn't fire 'input';
        // dispatch one so the Save button's dirty-state indicator fires.
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        const p = document.getElementById('cv-preview');
        if (p) p.innerHTML = cvMd(payload.markdown);
        UI.toast(t('cv.uploadDone', 'Loaded') +
          ` ${file.name} (${payload.converter}) — ` + t('cv.reviewSave', 'review, then Save'),
          'success');
      } catch (err) {
        UI.toast(err.message || 'upload failed', 'error');
      } finally {
        // Reset the input so re-selecting the same file fires onChange again.
        e.target.value = '';
      }
    },
  });

  const root = c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        // U-1 (v1.58.21) — promote #/cv H1 to match every other page:
        // single <h1 class="page-title">CV</h1> + <p class="page-subtitle">.
        // v1.56.0 UX-9 demoted this to a `.cv-breadcrumb` chip so the
        // user's name in the preview "owned the visual space"; v1.58.3
        // QA confirmed the chip reads as a layout bug — the page-header
        // looks broken next to #/dashboard, #/help, etc. Single-<h1>
        // invariant still holds (F-V54-A: cvMd shifts the user's own
        // `# Name` heading to <h2>, so this stays the page's only H1).
        // We just stop styling it as a chip.
        c('h1', { className: 'page-title' }, t('cv.title')),
        c('p', { className: 'page-subtitle' }, t('cv.subtitle')),
      ]),
      c('div', { className: 'flex gap-3' }, [
        fileInput,
        c('button', {
          className: 'btn btn-ghost',
          onClick: () => fileInput.click(),
          title: t('cv.uploadHint',
            'Upload .md, .txt, .html, .pdf, .docx, .odt, .rtf or .doc — converted server-side, then review and Save.'),
        }, '📁 ' + t('cv.upload', 'Upload CV')),
        c('button', { className: 'btn btn-ghost', onClick: async (e) => {
          // M-2 (v1.58.10): UI.modal() now auto-dismisses the progress
          // toast (defence-in-depth in api.js). Localize the toast/modal
          // strings via t() so the modal title matches the visible
          // button label (BUG-008 invariant: modal title == localized
          // button label) instead of the hardcoded English 'sync-check'.
          UI.toast(t('cv.syncCheckRunning', 'Running cv-sync-check.mjs…'));
          // CAR-20 (v1.243.0) — a failed POST used to reject unhandled
          // (withSpinner re-throws); the button restored but the user
          // never learned why nothing opened. Surface the error.
          try {
            const r = await UI.withSpinner(e.currentTarget, () => API.post('/api/run/sync-check'));
            UI.modal(t('cv.syncCheck', 'sync-check'),
              UI.el('pre', { className: 'console' },
                (r.stdout || '') + (r.stderr ? '\n' + r.stderr : '')));
          } catch (err) {
            UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
          }
        }}, t('cv.syncCheck', 'sync-check')),
        c('button', {
          className: 'btn btn-ghost',
          onClick: (e) => streamPdf(e.currentTarget),
          title: t('cv.pdfHint', 'Run generate-pdf.mjs and save into output/'),
        }, '📄 ' + t('cv.generatePdf', 'Generate PDF')),
        (() => {
          // U-15 (v1.58.33) — dirty-state indicator on the CV Save
          // button. The baseline (`initial`) is the SERVER copy the
          // textarea was hydrated from — CAR-20: when a dirty buffer was
          // restored, the textarea is seeded from the buffer while
          // `initial` deliberately stays the server markdown, so the
          // restored edits still read as dirty until Save lands. Every
          // `input` toggles the `.btn-dirty` class + localized tooltip
          // and keeps the module-level cvDirtyBuffer in sync; a
          // successful Save resets the baseline so edits re-arm dirty.
          const saveBtn = c('button', {
            className: 'btn btn-primary',
            onClick: async (e) => {
              if (!ta.value.trim()) {
                UI.toast('CV is empty', 'error');
                return;
              }
              // CAR-20 (v1.243.0) — a failed PUT used to reject unhandled
              // (withSpinner re-throws) with no toast; the dirty indicator
              // even stayed armed while the user believed it saved.
              try {
                await UI.withSpinner(e.currentTarget, () => API.put('/api/cv', { markdown: ta.value }));
                UI.toast(t('cv.saved', 'Saved'), 'success');
                initial = ta.value;
                cvDirtyBuffer = null;
                saveBtn.classList.remove('btn-dirty');
                saveBtn.title = '';
              } catch (err) {
                UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
              }
            },
          }, '💾 ' + t('common.save'));
          let initial = ta.value;
          let cvDirty = false;
          if (hasBuffer) {
            initial = serverMarkdown;
            cvDirty = true;
            saveBtn.classList.add('btn-dirty');
            saveBtn.title = t('cv.unsaved', 'Unsaved changes — click Save to persist.');
          }
          ta.addEventListener('input', () => {
            cvDirty = ta.value !== initial;
            cvDirtyBuffer = cvDirty ? ta.value : null;
            saveBtn.classList.toggle('btn-dirty', cvDirty);
            saveBtn.title = cvDirty ? t('cv.unsaved', 'Unsaved changes — click Save to persist.') : '';
          });
          // The fetch that hydrates `ta.value` fires a CustomEvent on
          // the textarea so we can re-baseline once the actual CV body
          // arrives (the initial render runs before the API call returns).
          ta.addEventListener('cv:baseline', () => {
            initial = ta.value; cvDirty = false; cvDirtyBuffer = null;
            saveBtn.classList.remove('btn-dirty'); saveBtn.title = '';
          });
          // UX-A10 (v1.58.58 + patch): probe the live diff at the moment
          // beforeunload/hashchange fires. This sidesteps every timing
          // race: we never rely on the async Save handler having reset
          // a flag — the textarea value vs `initial` is the source of
          // truth at that exact moment (Save handler updates `initial`
          // when it succeeds, so isDirty() returns false after save).
          const isDirty = () => ta.value !== initial;
          const onBeforeUnload = (e) => {
            if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
          };
          const onHashChange = () => {
            // CAR-20 (v1.243.0) — exact-hash compare. The old prefix
            // check also matched the studio route ('#/cv-studio' begins
            // with the same two segments), so leaving to it skipped the
            // confirm AND leaked these listeners forever.
            const leaving = cvRouteHash() !== '#/cv';
            if (!leaving) return;
            if (isDirty()) {
              const ok = window.confirm(t('cv.unsavedConfirm',
                'You have unsaved CV changes. Leave anyway?'));
              if (!ok) {
                // The hash already changed by the time hashchange fires
                // — rewind to #/cv to keep the user on the page.
                // (preventDefault is a no-op on hashchange.) CAR-20: the
                // rewind re-renders this route and the module-level
                // cvDirtyBuffer restores the edits, so declining the
                // prompt no longer means losing them to the refetch.
                // Detach first: the re-rendered view registers its own
                // guard pair.
                detachGuard();
                location.hash = '#/cv';
                return;
              }
              // User confirmed leaving. Drop the buffer and reset the
              // baseline so isDirty() returns false and the listeners
              // detach cleanly.
              cvDirtyBuffer = null;
              initial = ta.value;
            }
            detachGuard();
          };
          const detachGuard = () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            window.removeEventListener('hashchange', onHashChange);
            if (cvGuardDetach === detachGuard) cvGuardDetach = null;
          };
          // CAR-20 — single-instance lifecycle: the previous view
          // instance's guards are dropped before this render registers
          // its own (language switch Router.render() never fires
          // hashchange, so the old pair would otherwise keep prompting
          // against a detached textarea forever).
          if (cvGuardDetach) cvGuardDetach();
          cvGuardDetach = detachGuard;
          window.addEventListener('beforeunload', onBeforeUnload);
          window.addEventListener('hashchange', onHashChange);
          return saveBtn;
        })(),
      ]),
    ]),

    c('div', { className: 'grid-2' }, [
      c('div', null, [
        c('h3', { className: 'section-title', id: 'cv-md-heading' }, t('cv.markdown')),
        c('div', { className: 'card', style: { padding: 0 } }, ta),
      ]),
      c('div', null, [
        c('h3', { className: 'section-title' }, t('cv.preview')),
        c('div', { className: 'card md', id: 'cv-preview', html: cvMd(data.markdown || '') }),
      ]),
    ]),

    c('div', { className: 'mt-5' }, pdfBox),
  ]);
  // v1.22.0 (N-2) — was `.also(fn)` via Element.prototype monkey-patch;
  // replaced with a free function so we don't pollute the global DOM
  // prototype (would conflict with any future library defining `.also`).
  ta.addEventListener('input', () => {
    const p = root.querySelector('#cv-preview');
    p.innerHTML = cvMd(ta.value);
  });
  // Lazy-load the PDF list so the page first paint isn't blocked.
  loadPdfList();
  return root;
});
