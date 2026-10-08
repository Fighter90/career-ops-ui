/* global window, document, navigator, location, fetch, UI, I18n */
/**
 * bug-report.js — in-app bug reporter (vanilla JS, no framework). Gathers a STRUCTURAL diagnostic snapshot
 * (versions, route, browser, viewport, recent errors from logbuf.js, a
 * fail-check data-shape), computes a deterministic dedupe fingerprint, and
 * opens a PRE-FILLED GitHub issue — preview-then-confirm, nothing auto-filed.
 *
 * Privacy floor (invariant): counts, booleans, versions, system-check names,
 * and scrubbed error text only. NEVER cv.md, profile values, application
 * answers, job URLs, report content, or API keys. The user reviews the exact
 * payload before the issue opens. Contract format: report-format: v1.
 */
(function () {
  var REPO = 'Fighter90/career-ops-ui';

  /** Strip PII / secrets that could ride in error text or paths BEFORE anything
   *  leaves the machine. Defence-in-depth — the user also reviews the payload. */
  function scrub(s) {
    return String(s || '')
      .replace(/\/Users\/[^/\s"']+/g, '~')
      .replace(/\/home\/[^/\s"']+/g, '~')
      // Bare provider keys (unlabelled — common in SDK stack traces): Anthropic
      // sk-ant-, OpenAI sk-, GitHub ghp_/gho_, Slack xox?-, Google AIza.
      .replace(/\b(sk-ant-[A-Za-z0-9._-]{6,}|sk-[A-Za-z0-9._-]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|AIza[A-Za-z0-9._-]{10,})/g, '[redacted]')
      // Labelled secrets (key: …, token=…, bearer …).
      .replace(/(sk|key|token|secret|bearer|api[-_]?key)([-_=:\s"']+)[A-Za-z0-9._-]{8,}/gi, '$1$2[redacted]');
  }

  /** Stable error CLASS: strip volatile bits (urls, quoted values, numbers) so
   *  the same underlying bug yields the same class across sessions/machines. */
  function errorClass(log) {
    return String(log || '')
      .replace(/https?:\/\/\S+/g, '<url>')
      .replace(/["'`][^"'`]{0,80}["'`]/g, '<v>')
      .replace(/\d+/g, '<n>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  /** Deterministic short fingerprint (djb2 → base36) of route + newest error
   *  class + structural degradation flags. Same bug → same fingerprint. */
  function fingerprint(d) {
    var route = String(d.route || '').split('?')[0];
    var logs = d.logs || [];
    var err = errorClass(logs[logs.length - 1] || '');
    var flags = (d.failChecks && d.failChecks.length ? ['checks-fail'] : []).join(',');
    var s = route + '|' + err + '|' + flags;
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return 'co-web-' + h.toString(36);
  }

  /** Gather a STRUCTURAL diagnostic snapshot from /api/health. Excludes anything
   *  personal — no cv.md, profile, application answers, job URLs, report text. */
  async function collect() {
    var version = '';
    var parentVersion = '';
    var okChecks = 0;
    var failChecks = [];
    try {
      var h = await window.API.get('/api/health');
      version = h.version || '';
      parentVersion = h.parentVersion || '';
      var checks = Array.isArray(h.checks) ? h.checks : [];
      checks.forEach(function (c) {
        if (!c) return;
        // /api/health checks are {name, required, ok, value} — the old
        // c.status || c.state read always missed, so okChecks stayed 0 and
        // failing checks were never reported.
        var name = String(c.name || c.id || c.label || 'check');
        if (c.ok === true) okChecks++;
        else if (c.ok === false) failChecks.push(name);
      });
    } catch (_e) { /* best-effort — a report with no shape is still useful */ }
    return {
      version: version,
      parentVersion: parentVersion,
      // Privacy invariant: the route must never carry the job URL query
      // (#/evaluate?url=…) or a report slug (a company name). Reduce it to
      // the bare view name — enough to reproduce a UI bug, nothing personal.
      route: scrub((location.hash || '#/').split('?')[0].split('/').slice(0, 2).join('/')),
      ua: navigator.userAgent,
      viewport: window.innerWidth + '×' + window.innerHeight,
      okChecks: okChecks,
      failChecks: failChecks,
      logs: (window.CoLogBuf ? window.CoLogBuf.recent() : []).map(scrub),
    };
  }

  /** The EXACT markdown body the user reviews and that becomes the issue. */
  function issueBody(d, description) {
    var shapeLine = (d.okChecks || d.failChecks.length)
      ? '- **Health checks:** ' + d.okChecks + ' OK' + (d.failChecks.length ? (' · **FAIL:** ' + d.failChecks.join(', ')) : '')
      : '';
    var lines = [
      '## What happened',
      scrub(description).trim() || '_(describe what you were doing and what went wrong)_',
      '',
      '## Environment',
      '- **Version:** `' + (d.version || '?') + '`' + (d.parentVersion ? (' · parent `' + d.parentVersion + '`') : ''),
      '- **Screen:** `' + d.route + '`',
      '- **Browser:** ' + scrub(d.ua),
      '- **Viewport:** ' + d.viewport,
      '- **Fingerprint:** `' + fingerprint(d) + '`',
    ];
    if (shapeLine) lines.push(shapeLine);
    lines.push(
      '',
      '## Recent errors',
      d.logs.length ? '```\n' + d.logs.join('\n') + '\n```' : '_(none captured)_',
      '',
      '---',
      '_Filed from the in-app bug reporter (report-format: v1). Contains NO CV, profile, application answers, or job URLs._'
    );
    return lines.join('\n').slice(0, 6000);
  }

  function issueTitle(d, description) {
    var head = (scrub(description) || 'bug report').replace(/\s+/g, ' ').trim().slice(0, 70);
    return '[web] ' + head;
  }

  function issueUrl(d, description) {
    var base = 'https://github.com/' + REPO + '/issues/new?';
    var title = issueTitle(d, description);
    var body = issueBody(d, description);
    var qs = function () {
      return new URLSearchParams({ title: title, body: body, labels: 'bug' }).toString();
    };
    var url = base + qs();
    // GitHub issue URLs die past ~16KB: percent-encoding can inflate the
    // 6000-char body severalfold, so the cap must be applied to the ENCODED
    // url, not to the raw markdown before it.
    while (url.length > 16000 && body.length > 0) {
      body = body.slice(0, Math.max(0, body.length - 1024));
      url = base + qs();
    }
    return url;
  }

  /** Search existing issues by fingerprint — deflect duplicates at write time. */
  function searchUrl(d) {
    return 'https://github.com/' + REPO + '/issues?q=' + encodeURIComponent('is:issue ' + fingerprint(d));
  }

  /** Open the preview-then-confirm modal. */
  async function openModal() {
    var t = function (k, f) { return (window.I18n && I18n.t) ? I18n.t(k, f) : f; };
    var c = UI.el;
    var d = await collect();

    var ta = c('textarea', {
      className: 'input', rows: '4', style: { width: '100%' },
      placeholder: t('bug.ph', 'What were you doing, and what went wrong?'),
    });
    var preview = c('textarea', {
      className: 'input', readonly: 'readonly', rows: '14',
      style: { width: '100%', fontFamily: 'monospace', fontSize: '12px', marginTop: '8px' },
    });
    var openLink = c('a', {
      className: 'btn btn-primary', target: '_blank', rel: 'noopener noreferrer',
      style: { textDecoration: 'none' },
    }, t('bug.openIssue', 'Open a GitHub issue →'));
    var searchLink = c('a', {
      className: 'btn btn-ghost btn-sm', target: '_blank', rel: 'noopener noreferrer',
      href: searchUrl(d),
    }, t('bug.searchSimilar', 'Search similar issues'));
    var copyBtn = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, t('bug.copy', 'Copy report'));

    function refresh() {
      preview.value = issueBody(d, ta.value);
      openLink.href = issueUrl(d, ta.value);
    }
    ta.addEventListener('input', refresh);
    copyBtn.addEventListener('click', function () {
      var doneMsg = t('bug.copied', 'Report copied');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(preview.value).then(function () { UI.toast(doneMsg, 'success'); },
          function () { UI.toast(t('bug.copyFailed', 'Could not copy'), 'error'); });
      } else {
        // No async clipboard API (plain-http LAN deployments, older browsers):
        // select + execCommand('copy'). Honesty rule — a FAILED copy must
        // never toast success.
        preview.select();
        var copied = false;
        try { copied = !!(document.execCommand && document.execCommand('copy')); } catch (_e) { copied = false; }
        UI.toast(copied ? doneMsg : t('bug.copyFailed', 'Could not copy'), copied ? 'success' : 'error');
      }
    });
    refresh();

    var body = c('div', null, [
      c('p', { style: { color: 'var(--foggy)', fontSize: '13px', margin: '0 0 8px' } },
        t('bug.privacy', 'Nothing is filed automatically. The report below carries only versions, your screen, browser, and recent error text — never your CV, profile, answers, or job URLs. Review it, then open the issue yourself.')),
      c('label', { style: { fontSize: '12px', color: 'var(--foggy)' } }, t('bug.what', 'What happened')),
      ta,
      c('label', { style: { fontSize: '12px', color: 'var(--foggy)', display: 'block', marginTop: '8px' } }, t('bug.preview', 'Exactly what will be filed (editable via the box above)')),
      preview,
      c('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '12px' } },
        [openLink, searchLink, copyBtn]),
    ]);
    UI.modal(t('bug.title', 'Report a bug'), body);
  }

  window.BugReport = {
    scrub: scrub, errorClass: errorClass, fingerprint: fingerprint,
    collect: collect, issueBody: issueBody, issueUrl: issueUrl, issueTitle: issueTitle,
    searchUrl: searchUrl, openModal: openModal,
  };
})();
