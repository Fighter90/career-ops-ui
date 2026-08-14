/* global Router, API, UI, I18n, CvDiagnostics, CvPrivacy, HelpHint */
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
  root.appendChild(HelpHint.title(t('cvs.title', 'CV Studio'), 'help.hint.cvStudio'));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('cvs.subtitle', 'Diagnose your CV, mask it for safe sharing, and rewrite stiff lines in your own voice — grounded only in what you actually wrote.')));

  let cvMarkdown = '';
  try { ({ markdown: cvMarkdown } = await API.get('/api/cv')); } catch { cvMarkdown = ''; }
  cvMarkdown = cvMarkdown || '';

  if (!cvMarkdown.trim()) {
    root.appendChild(c('div', { className: 'empty' }, [
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

  // ── 4. Tailor to a job — résumé + cover letter with a checklist gate ──
  const jdIn = c('textarea', { className: 'input', rows: '6', 'data-i18n-placeholder': 'cvs.tailorJdPh' });
  jdIn.placeholder = t('cvs.tailorJdPh', 'Paste the target job description here…');
  const headIn = c('input', { type: 'text', className: 'input', style: { marginTop: '8px' }, 'data-i18n-placeholder': 'cvs.tailorHeadPh' });
  headIn.placeholder = t('cvs.tailorHeadPh', 'Optional: target role / headline (e.g. "Senior Backend Engineer")');
  const tailorBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('cvs.tailorBtn', '🎯 Tailor résumé + cover letter'));
  const tailorOut = c('div', { style: { marginTop: '10px' } });

  tailorBtn.addEventListener('click', async () => {
    const jd = jdIn.value.trim();
    if (jd.length < 40) { UI.toast(t('cvs.tailorNeedJd', 'Paste the job description (~40+ characters) first'), 'error'); return; }
    tailorBtn.disabled = true;
    tailorOut.textContent = '';
    const pending = c('div', { className: 'loading', style: { color: 'var(--foggy)' } }, t('cvs.tailoring', 'Tailoring and running the checklist gate…'));
    tailorOut.appendChild(pending);
    try {
      const res = await API.post('/api/cv-studio/tailor', { jd, headline: headIn.value.trim(), run: true });
      pending.remove();
      if (res.markdown) {
        const md = res.markdown;
        const card = c('div', { className: 'card', style: { padding: '12px' } }, [
          c('div', { className: 'md', html: UI.md(md) }),
          window.ReportExport ? ReportExport.actionsBar(() => md, () => t('cvs.tailorFileTitle', 'Tailored application'), t) : null,
        ]);
        tailorOut.appendChild(card);
      } else {
        const body = c('div', null, [
          c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } }, t('cvs.tailorManualHelp', 'No LLM key is set. Copy this prompt into any LLM, then paste the tailored résumé + cover letter back.')),
          c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, res.prompt),
        ]);
        UI.modal(t('cvs.tailorBtn', '🎯 Tailor résumé + cover letter'), body);
      }
    } catch (err) {
      pending.remove();
      UI.toast((err && err.message) || t('cvs.tailorFailed', 'Could not tailor the application'), 'error');
    } finally { tailorBtn.disabled = false; }
  });

  root.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '18px 0 8px' } }, [
    c('h2', { style: { fontSize: '15px', margin: '0 0 4px' } }, t('cvs.tailorTitle', 'Tailor to a job')),
    c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 10px' } }, t('cvs.tailorHelp', 'Paste a job description and get a résumé tailored to it plus a matching cover letter — run through a recruiter-grade checklist gate (errors block, warnings advise). Grounded only in your own CV, profile, and two-pager; it never fabricates.')),
    jdIn, headIn, c('div', { style: { marginTop: '8px' } }, tailorBtn), tailorOut,
  ]));

  // ── 5. Add to CV (v1.117.0) ──
  // A project/publication URL or pasted text → grounded ATS bullets to review
  // and paste into the CV editor yourself. Suggestions only — nothing is
  // written to any file (the URL fetch is SSRF-guarded server-side).
  const addUrlIn = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'cvs.addUrlPh' });
  addUrlIn.placeholder = t('cvs.addUrlPh', 'https:// … a repo, article, or portfolio page (optional)');
  const addTextIn = c('textarea', { className: 'input', rows: '5', style: { marginTop: '8px' }, 'data-i18n-placeholder': 'cvs.addTextPh' });
  addTextIn.placeholder = t('cvs.addTextPh', '…or paste the project/publication description here');
  const addBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('cvs.addBtn', '➕ Suggest CV bullets'));
  const addOut = c('div', { style: { marginTop: '10px' } });

  addBtn.addEventListener('click', async () => {
    const url = addUrlIn.value.trim();
    const text = addTextIn.value.trim();
    if (!url && text.length < 80) { UI.toast(t('cvs.addNeedSrc', 'Give a URL or paste ~80+ characters of source text first'), 'error'); return; }
    addBtn.disabled = true;
    addOut.textContent = '';
    const pending = c('div', { className: 'loading', style: { color: 'var(--foggy)' } }, t('cvs.adding', 'Reading the source and drafting grounded bullets…'));
    addOut.appendChild(pending);
    try {
      const res = await API.post('/api/cv-studio/add-entry', { url, text, run: true });
      pending.remove();
      if (res.markdown) {
        addOut.appendChild(c('div', { className: 'card', style: { padding: '12px' } }, [
          c('div', { className: 'md', html: UI.md(res.markdown) }),
          c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '10px 0 0' } },
            t('cvs.addReview', 'Review these suggestions and paste what you accept into the CV editor — nothing was saved automatically.')),
        ]));
      } else {
        UI.modal(t('cvs.addTitle', 'Add to CV'), c('div', null, [
          c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } }, t('cvs.addManualHelp', 'No LLM key is set. Copy this prompt into any LLM, then review the bullets it returns.')),
          c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, res.prompt),
        ]));
      }
    } catch (err) {
      pending.remove();
      UI.toast((err && err.message) || t('cvs.addFailed', 'Could not draft bullets from that source'), 'error');
    } finally { addBtn.disabled = false; }
  });

  root.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '18px 0 8px' } }, [
    c('h2', { style: { fontSize: '15px', margin: '0 0 4px' } }, t('cvs.addTitle', 'Add to CV')),
    c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 10px' } }, t('cvs.addHelp', 'Point at a project, publication, or portfolio page (URL or pasted text) and get ATS-ready bullet points grounded ONLY in that source — never invented. You review and paste them into your CV yourself; nothing is written automatically.')),
    addUrlIn, addTextIn, c('div', { style: { marginTop: '8px' } }, addBtn), addOut,
  ]));

  // ── 6. Skill gap vs a saved JD ──
  // Zero-LLM: which of a saved job description's required skills your CV already
  // names, only implies, or is missing. Relayed by GET /api/jds/:name/skill-gap.
  const gapSel = c('select', { className: 'lang-select', style: { minWidth: '220px' }, 'aria-label': t('cvs.gapPick', 'Job description') });
  const gapBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('cvs.gapAnalyze', 'Analyze skill gap'));
  const gapOut = c('div', { style: { marginTop: '12px' } });
  let jdList = [];
  try { ({ jds: jdList } = await API.get('/api/jds')); } catch { jdList = []; }
  jdList = Array.isArray(jdList) ? jdList : [];
  for (const jd of jdList) gapSel.appendChild(c('option', { value: jd.name }, jd.name));

  gapBtn.addEventListener('click', async () => {
    const name = gapSel.value;
    if (!name) return;
    gapBtn.disabled = true;
    gapOut.textContent = '';
    const pending = c('div', { className: 'loading', style: { color: 'var(--foggy)' } }, t('cvs.gapAnalyzing', 'Comparing the JD to your CV…'));
    gapOut.appendChild(pending);
    try {
      const res = await API.get('/api/jds/' + encodeURIComponent(name) + '/skill-gap');
      pending.remove();
      if (!res || res.available === false) {
        gapOut.appendChild(c('p', { style: { color: 'var(--foggy)' } },
          t('cvs.gapUnavailable', 'Skill-gap analysis needs the parent career-ops project (jd-skill-gap.mjs) next to this app.')));
        return;
      }
      const bucket = (label, items, tone) => {
        const list = Array.isArray(items) ? items : [];
        return c('div', { style: { margin: '0 0 10px' } }, [
          c('strong', { style: { color: tone } }, `${label} (${list.length})`),
          list.length
            ? c('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' } },
              list.map((s) => c('span', { className: 'chip' }, String(s))))
            : c('span', { style: { color: 'var(--foggy)', marginLeft: '6px' } }, t('cvs.gapNone', 'none')),
        ]);
      };
      gapOut.appendChild(c('div', { className: 'card', style: { padding: '12px' } }, [
        bucket(t('cvs.gapExisting', 'Named in your CV'), res.existing, 'var(--ok, #2e7d32)'),
        bucket(t('cvs.gapSupported', 'Implied in your CV'), res.supportedByResume, 'var(--foggy)'),
        bucket(t('cvs.gapMissing', 'Missing (gap)'), res.gap, 'var(--danger, #d9534f)'),
        res.lowConfidence
          ? c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '8px 0 0' } },
            t('cvs.gapLowConf', 'Low confidence — this JD had no clear requirements section, so the gap list may be noisy.'))
          : null,
      ].filter(Boolean)));
    } catch (err) {
      pending.remove();
      UI.toast((err && err.message) || t('cvs.gapFailed', 'Could not analyze the skill gap'), 'error');
    } finally { gapBtn.disabled = false; }
  });

  root.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '18px 0 8px' } }, [
    c('h2', { style: { fontSize: '15px', margin: '0 0 4px' } }, t('cvs.gapTitle', 'Skill gap vs a job')),
    c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 10px' } },
      t('cvs.gapHelp', 'Pick a saved job description and see which of its required skills your CV already names, which it only implies, and which are missing. Zero-LLM — it just compares words, and nothing is written.')),
    jdList.length
      ? c('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } }, [
        c('label', { style: { fontSize: '12px', color: 'var(--foggy)' } }, t('cvs.gapPick', 'Job description')),
        gapSel, gapBtn,
      ])
      : c('p', { style: { color: 'var(--foggy)' } },
        t('cvs.gapNoJds', 'No saved job descriptions yet. Save one from a scan result or the tailor above, then come back.')),
    gapOut,
  ]));

  // ── 7. Fact-check (truthfulness gate) ──
  // Zero-LLM: paste a tailored CV / cover letter and check every asserted metric
  // and fact against your real cv.md + profile + two-pager. Relayed by
  // POST /api/cv-studio/verify-facts → { verdict: pass|warn|block, invented,
  // unsupportedFacts, forbidden, warnings }. Nothing is written; suggestions only.
  const vfIn = c('textarea', {
    className: 'input', rows: 8, style: { width: '100%', fontFamily: 'inherit' },
    'data-i18n-placeholder': 'cvs.vfPlaceholder',
    placeholder: t('cvs.vfPlaceholder', 'Paste the generated CV or cover letter here to fact-check it against your real CV…'),
    'aria-label': t('cvs.vfTitle', 'Fact-check your CV'),
  });
  const vfBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('cvs.vfVerify', 'Verify facts'));
  const vfOut = c('div', { style: { marginTop: '12px' } });

  vfBtn.addEventListener('click', async () => {
    const text = vfIn.value.trim();
    if (!text) { UI.toast(t('cvs.vfEmpty', 'Paste some text to fact-check first.'), 'warn'); return; }
    vfBtn.disabled = true;
    vfOut.textContent = '';
    const pending = c('div', { className: 'loading', style: { color: 'var(--foggy)' } }, t('cvs.vfChecking', 'Checking every claim against your CV…'));
    vfOut.appendChild(pending);
    try {
      const res = await API.post('/api/cv-studio/verify-facts', { text });
      pending.remove();
      if (!res || res.available === false) {
        vfOut.appendChild(c('p', { style: { color: 'var(--foggy)' } },
          t('cvs.vfUnavailable', 'Fact-check needs the parent career-ops project (verify-cv-facts.mjs) next to this app.')));
        return;
      }
      const VERDICT = {
        pass: [t('cvs.vfPass', 'Grounded — every claim traces to your CV, profile, or two-pager.'), 'badge badge-ok'],
        warn: [t('cvs.vfWarn', 'Advisory — soft phrases worth a second look.'), 'badge badge-warn'],
        block: [t('cvs.vfBlock', 'Unsupported claims — fix these before you send it.'), 'badge badge-bad'],
      };
      const v = VERDICT[res.verdict] || VERDICT.block;
      const chips = (label, items, tone) => {
        const list = Array.isArray(items) ? items : [];
        if (!list.length) return null;
        return c('div', { style: { margin: '0 0 10px' } }, [
          c('strong', { style: { color: tone } }, `${label} (${list.length})`),
          c('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' } },
            list.map((s) => c('span', { className: 'chip' },
              String(s && typeof s === 'object' ? `${s.kind || ''}: ${s.value || ''}` : s)))),
        ]);
      };
      vfOut.appendChild(c('div', { className: 'card', style: { padding: '12px' } }, [
        c('div', { style: { margin: '0 0 8px' } }, c('span', { className: v[1] }, v[0])),
        chips(t('cvs.vfInvented', 'Metric-like claims not in your sources'), res.invented, 'var(--danger, #d9534f)'),
        chips(t('cvs.vfUnsupported', 'Facts not in your sources'), res.unsupportedFacts, 'var(--danger, #d9534f)'),
        chips(t('cvs.vfForbidden', 'Forbidden phrases'), res.forbidden, 'var(--danger, #d9534f)'),
        chips(t('cvs.vfWarnings', 'Advisory phrases'), res.warnings, 'var(--foggy)'),
      ].filter(Boolean)));
    } catch (err) {
      pending.remove();
      UI.toast((err && err.message) || t('cvs.vfFailed', 'Could not fact-check the text'), 'error');
    } finally { vfBtn.disabled = false; }
  });

  root.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '18px 0 8px' } }, [
    c('h2', { style: { fontSize: '15px', margin: '0 0 4px' } }, t('cvs.vfTitle', 'Fact-check your CV')),
    c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 10px' } },
      t('cvs.vfHelp', 'Paste a tailored CV or cover letter and check every asserted metric and fact against your real CV, profile, and two-pager. Catches numbers and claims that were not in your sources. Zero-LLM — nothing is written, suggestions only.')),
    vfIn, c('div', { style: { marginTop: '8px' } }, vfBtn), vfOut,
  ]));

  return root;
});
