/* global Router, API, UI, I18n, CvDiagnostics, CvPrivacy */
/**
 * #/cv-studio — CV Studio (v1.92.0, Epic 21).
 *
 * Three tools over the user's cv.md, all honest and mostly client-side:
 *   1. Diagnostics — deterministic résumé checks + score (window.CvDiagnostics).
 *   2. Privacy mask — redact PII for sharing/screenshots (window.CvPrivacy).
 *   3. Make it human — LLM rewrite of a pasted chunk in the user's own voice,
 *      grounded server-side in voice-dna.md + writing-samples/ (never invents
 *      facts). Runs live with a key, or hands back a copy-paste prompt.
 */
Router.register('cv-studio', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(c('h1', { className: 'page-title' }, t('cvs.title', 'CV Studio')));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('cvs.subtitle', 'Diagnose your CV, mask it for safe sharing, and rewrite stiff lines in your own voice — grounded only in what you actually wrote.')));

  let cvMarkdown = '';
  try { ({ markdown: cvMarkdown } = await API.get('/api/cv')); } catch { cvMarkdown = ''; }
  cvMarkdown = cvMarkdown || '';

  if (!cvMarkdown.trim()) {
    root.appendChild(c('div', { className: 'empty', style: { padding: '40px', textAlign: 'center', color: 'var(--foggy)' } }, [
      c('p', null, t('cvs.noCv', 'No CV yet. Add one on the CV page, then come back to diagnose and polish it.')),
      c('a', { className: 'btn', href: '#/cv' }, t('cvs.goCv', 'Open CV')),
    ]));
    return root;
  }

  // ── 1. Diagnostics ──
  const diag = (window.CvDiagnostics && CvDiagnostics.analyze) ? CvDiagnostics.analyze(cvMarkdown) : { score: 0, checks: [] };
  const scoreColor = diag.score >= 75 ? 'var(--ok, #2e7d32)' : diag.score >= 50 ? 'var(--accent, #4c8bf5)' : 'var(--danger, #d9534f)';
  const ICON = { pass: '✓', warn: '▲', fail: '✕' };
  const diagCard = c('div', { className: 'card', style: { padding: '16px', margin: '0 0 18px' } }, [
    c('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' } }, [
      c('h2', { style: { fontSize: '15px', margin: '0' } }, t('cvs.diagTitle', 'Résumé diagnostics')),
      c('span', { style: { fontSize: '22px', fontWeight: '700', color: scoreColor, fontVariantNumeric: 'tabular-nums' } }, `${diag.score}/100`),
      c('span', { style: { fontSize: '12px', color: 'var(--foggy)' } }, `${diag.words} ${t('cvs.words', 'words')} · ${diag.bullets} ${t('cvs.bullets', 'bullets')}`),
    ]),
    c('ul', { style: { listStyle: 'none', padding: '0', margin: '0', display: 'flex', flexDirection: 'column', gap: '6px' } },
      diag.checks.map((ck) => c('li', { style: { display: 'flex', gap: '8px', alignItems: 'flex-start' } }, [
        c('span', { title: ck.status, style: { color: ck.status === 'pass' ? 'var(--ok, #2e7d32)' : ck.status === 'warn' ? 'var(--warn, #b8860b)' : 'var(--danger, #d9534f)', fontWeight: '700' } }, ICON[ck.status]),
        c('span', null, [c('strong', null, ck.label + ': '), ck.detail]),
      ]))),
  ]);
  root.appendChild(diagCard);

  // ── 2. Privacy mask ──
  const toggles = {};
  const mk = (key, labelKey, labelFb, def) => {
    const cb = c('input', { type: 'checkbox' });
    cb.checked = def;
    toggles[key] = cb;
    return c('label', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px' } }, [cb, t(labelKey, labelFb)]);
  };
  const nameInput = c('input', { type: 'text', className: 'input', style: { maxWidth: '200px' }, 'data-i18n-placeholder': 'cvs.namePh' });
  nameInput.placeholder = t('cvs.namePh', 'Your full name (to initial-ise)');
  const maskOut = c('textarea', { className: 'input', rows: '10', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px', marginTop: '10px' } });
  const maskStat = c('div', { style: { fontSize: '12px', color: 'var(--foggy)', marginTop: '6px' } });
  const copyBtn = c('button', { className: 'btn btn-ghost btn-sm', type: 'button', style: { marginTop: '8px' } }, t('cvs.copy', 'Copy masked CV'));

  function runMask() {
    const opts = { email: toggles.email.checked, phone: toggles.phone.checked, links: toggles.links.checked, address: toggles.address.checked, name: toggles.name.checked ? nameInput.value.trim() : false };
    const { markdown, counts } = (window.CvPrivacy && CvPrivacy.mask) ? CvPrivacy.mask(cvMarkdown, opts) : { markdown: cvMarkdown, counts: {} };
    maskOut.value = markdown;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    maskStat.textContent = total
      ? `${total} ${t('cvs.redacted', 'item(s) redacted')} — email ${counts.email || 0}, phone ${counts.phone || 0}, links ${counts.links || 0}, address ${counts.address || 0}, name ${counts.name || 0}.`
      : t('cvs.nothingRedacted', 'Nothing matched the current mask settings.');
  }
  Object.values(toggles).forEach((cb) => cb.addEventListener('change', runMask));
  nameInput.addEventListener('input', () => { if (toggles.name.checked) runMask(); });
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(maskOut.value); UI.toast(t('cvs.copied', 'Copied'), 'success'); }
    catch { maskOut.select(); UI.toast(t('cvs.copyManual', 'Press Cmd/Ctrl+C to copy'), 'info'); }
  });

  const maskCard = c('div', { className: 'card', style: { padding: '16px', margin: '0 0 18px' } }, [
    c('h2', { style: { fontSize: '15px', margin: '0 0 4px' } }, t('cvs.maskTitle', 'Privacy mask')),
    c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 10px' } }, t('cvs.maskHelp', 'Redact PII before sharing your CV as a sample. Everything happens in your browser.')),
    c('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' } }, [
      mk('email', 'cvs.mEmail', 'Email', true),
      mk('phone', 'cvs.mPhone', 'Phone', true),
      mk('links', 'cvs.mLinks', 'Links/handles', true),
      mk('address', 'cvs.mAddress', 'Address', true),
      mk('name', 'cvs.mName', 'Name → initials', false),
      nameInput,
    ]),
    maskOut, maskStat, copyBtn,
  ]);
  root.appendChild(maskCard);
  runMask();

  // ── 3. Make it human / voice match ──
  const humanIn = c('textarea', { className: 'input', rows: '5', 'data-i18n-placeholder': 'cvs.humanPh' });
  humanIn.placeholder = t('cvs.humanPh', 'Paste a stiff line or paragraph from your CV to rewrite in your voice…');
  const humanBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('cvs.humanize', '✨ Make it human'));
  const humanOut = c('div', { style: { marginTop: '10px' } });
  humanBtn.addEventListener('click', async () => {
    const text = humanIn.value.trim();
    if (text.length < 20) { UI.toast(t('cvs.needText', 'Paste at least ~20 characters'), 'error'); return; }
    humanBtn.disabled = true;
    humanOut.textContent = '';
    const pending = c('div', { className: 'loading', style: { color: 'var(--foggy)' } }, t('cvs.rewriting', 'Rewriting in your voice…'));
    humanOut.appendChild(pending);
    try {
      const res = await API.post('/api/cv-studio/humanize', { text, run: true });
      pending.remove();
      if (res.markdown) {
        humanOut.appendChild(c('div', { className: 'card', style: { padding: '12px' } }, c('div', { className: 'md', html: UI.md(res.markdown) })));
      } else {
        const body = c('div', null, [
          c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } }, t('cvs.humanManualHelp', 'No LLM key is set. Copy this prompt into any LLM, then paste the rewrite back into your CV.')),
          c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, res.prompt),
        ]);
        UI.modal(t('cvs.humanize', '✨ Make it human'), body);
      }
    } catch (err) {
      pending.remove();
      UI.toast((err && err.message) || t('cvs.humanFailed', 'Could not rewrite the text'), 'error');
    } finally { humanBtn.disabled = false; }
  });
  root.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '0 0 8px' } }, [
    c('h2', { style: { fontSize: '15px', margin: '0 0 4px' } }, t('cvs.humanTitle', 'Make it human')),
    c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 10px' } }, t('cvs.humanHelp', 'Rewrite generic AI phrasing in your own voice — grounded in your voice-dna and writing samples. It never invents facts.')),
    humanIn, c('div', { style: { marginTop: '8px' } }, humanBtn), humanOut,
  ]));

  return root;
});
