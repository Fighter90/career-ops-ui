/* global window */
/**
 * logbuf.js — a tiny client-side ring buffer of recent ERRORS (not arbitrary
 * logs → far less PII surface) that feeds the in-app bug reporter
 * (`bug-report.js`). Installed once, as early as possible, so it captures failures
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
    var apiPath = function (input) {
      try {
        var href = typeof input === 'string' ? input : (input && input.url) || '';
        var u = new URL(href, location.origin);
        return u.pathname.indexOf('/api/') === 0 ? u.pathname : '';
      } catch (_e) { return ''; }
    };
    window.fetch = function () {
      var args = arguments;
      return origFetch.apply(null, args).then(function (res) {
        var p = apiPath(args[0]);
        if (p && res && !res.ok) push('[api] ' + p + ' → ' + res.status);
        return res;
      }, function (err) {
        // Network-layer failures (offline, DNS, abort) never reach console.error —
        // capture them here (the failures a bug reporter most wants), then rethrow.
        var p = apiPath(args[0]);
        if (p) push('[api] ' + p + ' → ' + String((err && err.message) || err));
        throw err;
      });
    };
  }

  window.CoLogBuf = {
    recent: function () { return BUF.slice(); },
    _push: push, // exposed for tests
  };
})();
