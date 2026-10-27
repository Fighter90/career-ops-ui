/* global window */
/**
 * ReportLabels — the ONE client copy of the localized report-H1 labels
 * (FULL-M6).
 *
 * The server strips a localized prose label (`Evaluation:`, `Оценка
 * вакансии:`, …) from a report H1 before splitting Company — Role
 * (H1_LABEL_WORDS in server/lib/routes/auto-pipeline.mjs, longest first so
 * «Оценка вакансии» wins over «Оценка»). The client used to carry TWO
 * literal copies of the table — report-ops.js (H1_LABEL_WORDS → LABEL_RE)
 * and pipeline-view.js (TITLE_LABELS → splitReportTitle); both now read
 * this table. tests/m6-wave1-consolidations.test.mjs drift-gates it
 * against the server table.
 */
window.ReportLabels = (function () {
  'use strict';
  const H1_LABEL_WORDS = [
    'Evaluation', 'Оценка вакансии', 'Оценка', 'Оцінка вакансії', 'Оцінка',
    'Evaluación', 'Avaliação', 'Évaluation', 'Bewertung', 'Valutazione',
    'Ocena', 'Değerlendirme', '評価', '평가', '评估', '評估', 'Evaluering',
    'تقييم', 'मूल्यांकन', 'மதிப்பீடு',
  ].sort((a, b) => b.length - a.length);
  return { H1_LABEL_WORDS };
})();
