/* window.TrackerImport — the "Import CSV" flow for #/tracker (CAR-181).
 *
 * Brings the applications in another tracker's CSV export (Teal, Huntr,
 * Simplify, a spreadsheet) into data/applications.md:
 *   file input → dry-run preview (POST /api/tracker/import-csv, nothing
 *   written) → confirm → commit → refetch the tracker.
 *
 * Same two-phase shape as the outcome modal: nothing is written until the
 * user confirms the previewed rows. Extracted from views/tracker.js under
 * the 800-LOC view contract (the CAR-117 split pattern).
 */
(function () {
  'use strict';

  var PREVIEW_CAP = 50;

  function pick(btn, t) {
    var c = window.UI.el;
    var input = c('input', {
      type: 'file',
      accept: '.csv,text/csv,text/plain',
      'aria-hidden': 'true',
      style: { display: 'none' },
    });
    document.body.appendChild(input);
    input.addEventListener('change', async function () {
      var file = input.files && input.files[0];
      input.value = ''; // allow re-picking the same file after a failed run
      input.remove();
      if (!file) return;
      btn.disabled = true;
      try {
        // An oversized file is rejected server-side (413, ≤512KB) and
        // surfaces through the toast — no duplicate client-side limit.
        var csv = await file.text();
        var plan = await window.API.post('/api/tracker/import-csv', { csv: csv, source: file.name });
        preview(csv, file.name, plan, t);
      } catch (e) {
        window.UI.toast((e && e.message) || t('common.error', 'Error'), 'error');
      } finally {
        btn.disabled = false;
      }
    });
    input.click();
  }

  function preview(csv, source, plan, t) {
    var c = window.UI.el;
    var summary = c('p', { className: 'modal-msg' },
      t('import.summary', 'To import: {imported} · Duplicates: {duplicates} · Skipped: {skipped}')
        .replace('{imported}', plan.imported)
        .replace('{duplicates}', plan.duplicates.length)
        .replace('{skipped}', plan.skipped));

    var shown = (plan.rows || []).slice(0, PREVIEW_CAP);
    var rest = (plan.rows || []).length - shown.length;
    var cell = function (v) { return c('td', null, v === '' || v == null ? '—' : String(v)); };
    var table = c('div', { className: 'table-wrap', style: { maxHeight: '46vh', overflow: 'auto' } },
      c('table', { className: 'tbl' }, [
        c('thead', null, c('tr', null, [
          c('th', { scope: 'col' }, t('scan.col.company', 'Company')),
          c('th', { scope: 'col' }, t('scan.col.role', 'Role')),
          c('th', { scope: 'col' }, t('track.col.status', 'Status')),
          c('th', { scope: 'col' }, t('track.col.date', 'Date')),
          c('th', { scope: 'col' }, t('import.colReason', 'Reason')),
        ])),
        c('tbody', null, shown.map(function (r) {
          return c('tr', null, [
            cell(r.company), cell(r.role), cell(r.status), cell(r.date),
            cell(r.outcome === 'import' ? '' : (r.reason || r.outcome)),
          ]);
        })),
      ]));

    var commitBtn = c('button', { className: 'btn btn-primary', type: 'button' },
      t('import.confirm', 'Import rows ({n})').replace('{n}', plan.imported));
    commitBtn.disabled = plan.imported === 0;
    var cancelBtn = c('button', { className: 'btn btn-ghost', type: 'button' },
      t('common.cancel', 'Cancel'));
    cancelBtn.addEventListener('click', function () { window.UI.closeModal(); });

    commitBtn.addEventListener('click', async function () {
      commitBtn.disabled = true;
      try {
        var r = await window.API.post('/api/tracker/import-csv', { csv: csv, commit: true, source: source });
        window.UI.toast(
          t('import.result', 'Imported {imported} · Duplicates {duplicates} · Skipped {skipped}')
            .replace('{imported}', r.imported)
            .replace('{duplicates}', (r.duplicates || []).length)
            .replace('{skipped}', r.skipped),
          r.imported ? 'success' : undefined,
        );
        window.UI.closeModal();
        window.Router.render(); // refetch the tracker — the new rows are on the board
      } catch (e) {
        window.UI.toast((e && e.message) || t('common.error', 'Error'), 'error');
        commitBtn.disabled = false;
      }
    });

    var body = c('div', { style: { display: 'grid', gap: '10px', minWidth: '420px' } }, [
      source ? c('div', { style: { color: 'var(--foggy)', fontSize: '13px' } }, source) : null,
      summary,
      table,
      rest > 0 ? c('div', { style: { color: 'var(--foggy)', fontSize: '13px' } }, '… +' + rest) : null,
      c('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }, [cancelBtn, commitBtn]),
    ].filter(Boolean));
    window.UI.modal(t('import.title', 'Import applications from CSV'), body);
  }

  window.TrackerImport = { pick: pick };
})();
