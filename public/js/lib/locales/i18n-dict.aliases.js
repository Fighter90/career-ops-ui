/* global window */
/**
 * Language-independent alias map for window.I18n (I18N-SPLIT v1.60.0).
 * `key: 'canonical.key'` — i18n-dict.js rewrites each into
 * { '@alias': 'canonical.key' }. Aliases collapse duplicate-CONCEPT keys
 * (sidebar label = page title = dashboard tile) onto ONE translated
 * string; alias targets must exist and must not themselves be aliases
 * (enforced by tools/i18n-audit.mjs + tests).
 */
window.__I18N_ALIASES = {
  'nav.apply': "apply.title",
  'nav.reports': "rep.title",
  'nav.cv': "cv.title",
  'nav.health': "health.title",
  'nav.interviewPrep': "interviewPrep.title",
  'nav.help': "help.title",
  'dash.reports': "rep.title",
  'dash.quick.reportsCta': "rep.title",
  'dash.quick.healthCta': "health.title",
  'dash.quick.helpCta': "help.title",
};
