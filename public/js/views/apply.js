/* global Router, API, UI, I18n, HelpHint */
Router.register('apply', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const url = c('input', { className: 'input', id: 'apply-url', placeholder: 'https://...' });
  const jd = c('textarea', { className: 'textarea', id: 'apply-jd', rows: 10, placeholder: t('apply.jdLbl') });
  const out = c('div');

  // M-8 (v1.58.13) — apply checklist is now interactive: the pre-fix
  // monospace block is replaced by real <input type="checkbox"> rows
  // whose state is persisted per-URL in localStorage so the user can
  // come back later and resume. Items are extracted from the plain
  // checklist text on a best-effort basis (split on newlines, trim,
  // drop blanks); a leading list marker (`-`, `*`, `1.`, `[ ]`) is
  // stripped so the label reads cleanly. Two action buttons sit below
  // the list: "Copy unchecked" (clipboard the still-open items as a
  // markdown bullet list) and "Reset" (clear all ticks for this URL).
  const STORAGE_PREFIX = 'applyChecklist:';
  function slugForUrl(u) {
    // Deterministic, short, no PII — strip protocol/query then keep
    // alphanum+`-_./:` chars. Safe as a localStorage suffix.
    return String(u || '')
      .replace(/^https?:\/\//, '')
      .replace(/\?.*$/, '')
      .replace(/[^a-zA-Z0-9._/:-]/g, '_')
      .slice(0, 240);
  }
  function parseChecklist(raw) {
    return String(raw || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      // strip a leading list marker so the label is the item text only
      .map((l) => l.replace(/^(?:[-*•]|\d+[.)]|\[\s?\])\s+/, ''))
      .filter((l) => l.length > 0);
  }
  // UX-D-D (v1.58.46) — the server-generated checklist item 5 mentions
  // `interview-prep/{company}-{role}.md`. v1.58.36 audit: the literal
  // placeholders {company}/{role} were displayed verbatim — the user
  // had to mentally substitute them before pasting or could leave them
  // in by accident. Try to extract a company + role slug from the URL
  // (and optionally the JD's first H1) and substitute. If extraction
  // fails, replace with `[company]`/`[role]` to make the slot honest
  // (square-bracket convention for "fill in").
  function extractSlugs(u, jdText) {
    let company = '';
    let role = '';
    try {
      const parsed = new URL(u);
      const host = parsed.hostname.replace(/^www\./, '');
      const segs = parsed.pathname.split('/').filter(Boolean);
      // Greenhouse: boards.greenhouse.io/<company>/jobs/<id> → company=segs[0]
      // Lever:      jobs.lever.co/<company>/<id>
      // Ashby:      jobs.ashbyhq.com/<company>/<id>
      // Workable:   apply.workable.com/<company>
      // SmartRec:   jobs.smartrecruiters.com/<company>/<id>
      // Hh.ru:      hh.ru/vacancy/<id>   (no company in URL — skip)
      // Workday:    <company>.wd1.myworkdayjobs.com/...
      if (/greenhouse|lever|ashby|workable|smartrecruit/.test(host) && segs[0]) {
        company = segs[0];
      } else if (/myworkdayjobs/.test(host)) {
        company = host.split('.')[0];
      }
      // The trailing segment often contains the role slug
      // (e.g. "senior-backend-engineer-4567"). Strip a trailing
      // numeric id so the slug is human-readable.
      const last = segs[segs.length - 1] || '';
      role = last.replace(/-?\d{4,}$/, '').replace(/^\d+-/, '').toLowerCase();
    } catch { /* not a URL; keep slugs empty */ }
    // Fallback: try to derive role from JD's first non-empty heading line.
    if (!role && jdText) {
      const firstLine = String(jdText).split(/\r?\n/).map((l) => l.trim()).find(Boolean);
      if (firstLine) {
        role = firstLine.replace(/^#+\s*/, '').toLowerCase()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
      }
    }
    return { company, role };
  }
  function substitutePlaceholders(raw, url, jdText) {
    if (!raw || !/\{company\}|\{role\}/.test(raw)) return raw;
    const { company, role } = extractSlugs(url, jdText);
    return raw
      .replace(/\{company\}/g, company || '[company]')
      .replace(/\{role\}/g, role || '[role]');
  }
  function loadState(slug, n) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + slug);
      if (!raw) return new Array(n).fill(false);
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Array(n).fill(false);
      const out = new Array(n).fill(false);
      for (let i = 0; i < Math.min(arr.length, n); i++) out[i] = !!arr[i];
      return out;
    } catch { return new Array(n).fill(false); }
  }
  function saveState(slug, state) {
    try { localStorage.setItem(STORAGE_PREFIX + slug, JSON.stringify(state)); }
    catch { /* private mode — ignore */ }
  }

  function renderChecklist(items, slug) {
    const state = loadState(slug, items.length);
    const list = c('ul', { className: 'apply-checklist', 'data-url-slug': slug });
    items.forEach((text, i) => {
      const cb = c('input', { type: 'checkbox', 'data-item-index': String(i) });
      cb.checked = state[i];
      cb.addEventListener('change', () => {
        state[i] = cb.checked;
        saveState(slug, state);
      });
      list.appendChild(c('li', null,
        c('label', null, [cb, c('span', null, text)])));
    });
    const actions = c('div', { className: 'apply-checklist__actions' }, [
      c('button', {
        type: 'button',
        className: 'btn btn-ghost btn-sm',
        onClick: async () => {
          const lines = items
            .filter((_, i) => !state[i])
            .map((s) => '- ' + s);
          const md = lines.join('\n');
          try {
            await navigator.clipboard.writeText(md);
            UI.toast(t('apply.checklist.copied', 'Unchecked items copied'), 'success');
          } catch {
            UI.toast(t('apply.checklist.copyFailed', 'Copy failed'), 'error');
          }
        },
      }, '📋 ' + t('apply.checklist.copyUnchecked', 'Copy unchecked')),
      c('button', {
        type: 'button',
        className: 'btn btn-ghost btn-sm',
        onClick: () => {
          for (let i = 0; i < state.length; i++) state[i] = false;
          saveState(slug, state);
          list.querySelectorAll('input[type=checkbox]').forEach((el) => { el.checked = false; });
          UI.toast(t('apply.checklist.reset', 'Checklist reset'), 'info');
        },
      }, '↺ ' + t('apply.checklist.resetBtn', 'Reset')),
    ]);
    return c('div', null, [list, actions]);
  }

  async function run() {
    if (!url.value.trim()) return UI.toast(t('apply.enterUrl'), 'error');
    out.innerHTML = `<div class="loading">…</div>`;
    try {
      const r = await API.post('/api/apply-helper', { url: url.value.trim(), jd: jd.value.trim() });
      // UX-D-D (v1.58.46) — substitute {company}-{role} placeholders
      // before parsing so item 5 reads as `interview-prep/anthropic-senior-backend-engineer.md`
      // instead of the literal `{company}-{role}.md`.
      const substituted = substitutePlaceholders(r.checklist, url.value.trim(), jd.value.trim());
      const items = parseChecklist(substituted);
      const slug = slugForUrl(url.value.trim());
      out.innerHTML = '';
      const card = c('div', { className: 'card' }, [c('p', null, r.message)]);
      if (items.length) {
        card.appendChild(renderChecklist(items, slug));
      } else {
        // Defensive fallback: if the parser found nothing, show the raw
        // text so the user isn't presented with an empty card.
        card.appendChild(c('pre', { className: 'console' }, r.checklist || ''));
      }
      out.appendChild(card);
    } catch (e) {
      out.innerHTML = '';
      out.appendChild(c('div', { className: 'empty' }, (e && e.message) || 'apply failed'));
    }
  }

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        HelpHint.title(t('apply.title'), 'help.hint.apply'),
        c('p', { className: 'page-subtitle' }, t('apply.subtitle')),
      ]),
    ]),
    c('div', {
      className: 'card mb-3',
      style: { background: '#eef5ff', borderColor: '#9bb6e0', color: '#1f3b6e' },
    }, [
      c('strong', null, 'ℹ ' + t('apply.bannerTitle', 'Checklist only')),
      c('p', { style: { margin: '6px 0 0', fontSize: '14px' } },
        t('apply.bannerBody', 'This page generates a checklist + paste-ready text. Real Playwright form-fill (with a final-confirm) lives in Claude Code: /career-ops apply <url>')),
      c('p', { style: { margin: '6px 0 0', fontSize: '13px' } }, [
        // PR-9: surface the canonical Playwright setup guide so users
        // who hit a "browser not installed" error in the CLI have an
        // exact, vendor-blessed install path.
        t('apply.playwrightHint', 'Need Playwright? See '),
        c('a', {
          href: 'https://career-ops.org/docs/introduction/guides/set-up-playwright',
          target: '_blank', rel: 'noopener noreferrer',
        }, 'career-ops.org/docs/.../set-up-playwright'),
        ' · ',
        c('a', {
          href: 'https://career-ops.org/docs/introduction/guides/apply-for-a-job',
          target: '_blank', rel: 'noopener noreferrer',
        }, t('apply.docsLink', 'Apply guide')),
      ]),
    ]),
    c('div', { className: 'card' }, [
      c('div', { className: 'field' }, [c('label', { htmlFor: 'apply-url' }, t('apply.urlLbl')), url]),
      c('div', { className: 'field' }, [c('label', { htmlFor: 'apply-jd' }, t('apply.jdLbl')), jd]),
      c('button', { className: 'btn btn-primary', onClick: run }, t('apply.run')),
    ]),
    c('div', { className: 'mt-5' }, out),
  ]);
});
