/* global window */
/**
 * logbuf.js — a tiny client-side ring buffer of recent ERRORS (not arbitrary
 * logs → far less PII surface) that feeds the in-app bug reporter
 * (`bug-report.js`). Ported from parent career-ops `web/src/lib/report/logbuf.ts`
 * (web-v0.2.0). Installed once, as early as possible, so it captures failures
 * from the first paint.
 *
 * Captures: console.error, window 'error', 'unhandledrejection', and FAILED
 * `/api/*` responses (pathname + status only — query strings can carry company
 * names, so they're never recorded). Max 20 entries, each ≤300 chars.
 */
(function () {
  if (typeof window === 'undefined' || window.__coLogBufInstalled) return;
  window.__coLogBufInstalled = true;

  var MAX = 20;
  var BUF = [];
  function push(s) {
    try {
      BUF.push(String(s).replace(/\s+/g, ' ').slice(0, 300));
      if (BUF.length > MAX) BUF.shift();
    } catch (_e) { /* never break logging */ }
  }

  var origError = console.error ? console.error.bind(console) : function () {};
  console.error = function () {
    var args = Array.prototype.slice.call(arguments);
    try {
      push('[error] ' + args.map(function (a) { return a instanceof Error ? a.message : String(a); }).join(' '));
    } catch (_e) { /* never break logging */ }
    origError.apply(null, args);
  };

  window.addEventListener('error', function (e) {
    push('[onerror] ' + ((e && e.message) || '') + ' @ ' + ((e && e.filename) || '') + ':' + ((e && e.lineno) || ''));
  });

  window.addEventListener('unhandledrejection', function (e) {
    push('[rejection] ' + String(e && e.reason));
  });

  // Server-side failures are invisible to console.error — wrap fetch so a
  // degraded API (a 4xx/5xx, or a route that answered but couldn't do its job)
  // lands in the ring too. Pathname only; never the query string.
  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch.bind(window);
    window.fetch = function () {
      var args = arguments;
      return origFetch.apply(null, args).then(function (res) {
        try {
          var input = args[0];
          var href = typeof input === 'string' ? input : (input && input.url) || '';
          var u = new URL(href, location.origin);
          if (u.pathname.indexOf('/api/') === 0 && res && !res.ok) {
            push('[api] ' + u.pathname + ' → ' + res.status);
          }
        } catch (_e) { /* never break fetch */ }
        return res;
      });
    };
  }

  window.CoLogBuf = {
    recent: function () { return BUF.slice(); },
    _push: push, // exposed for tests
  };
})();
