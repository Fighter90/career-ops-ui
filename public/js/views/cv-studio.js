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
 *
 * CAR-119 — every live generation (humanize / tailor / add-entry) runs under
 * the shared LlmPageKit run panel: synchronous progress paint, live
 * elapsed/ETA, and Cancel wired to an AbortSignal over the POST.
 * Deliberate template deviation (documented in the PR): CV Studio is a
 * five-tool toolbox, so the kit's two-column form|result split does not
 * apply — the run/progress/cancel component does, per tool.
 * // CAR-119 i18n: no new dictionary keys — the kit's `llm2.*` strings ship
 * as I18n.t EN fallbacks inside public/js/lib/llm-page-kit.js.
 *
 * CAR-179 — two upstream CV-Studio concepts ported onto this toolbox page
 * (upstream #6183 "undo the last CV Studio edit" + #6182 "keep the last CV
 * Studio edit when you leave"; their React studio edits a tailored CV in
 * place, our equivalent of "the last edit" is the pasted tool input plus
 * the finished LLM result the next run would overwrite):
 *   - an Undo stack — every result-panel overwrite first pushes a
 *     repaintable snapshot onto one shared bounded stack; the Undo button
 *     and a Cmd/Ctrl+Z hotkey pop it back (the hotkey steps aside inside
 *     text fields, where the field's native undo owns the keystroke, and
 *     matches e.code too — the CAR-172 non-QWERTY lesson);
 *   - a leave-guard — dirty state is probed LIVE at event time, a
 *     hashchange confirm (decline rewinds the hash) plus a beforeunload
 *     veto protect the work, and a module-level restore buffer brings it
 *     back on the next render (guard Cancel rewind, language switch —
 *     Router.render() fires no hashchange — and confirmed leaves).
 *     Nothing on this page is server-persisted, so a restore buffer is
 *     the honest port of upstream's keepalive flush.
 * CAR-179 i18n: three new `cvs.*` keys (`cvs.undo`, `cvs.undoHint`,
 * `cvs.unsavedConfirm`) ship as EN fallbacks — pending the ×19 dict
 * fan-out, so the dictionaries themselves are untouched here.
 *
 * CAR-188 — "Voice check" (upstream #6178): a zero-LLM stock-phrase lint
 * over any pasted draft. POST /api/cv-studio/voice-check reports the stock
 * phrases ("spearheaded", "proven track record", …) plus em/en dashes that
 * are not date ranges, each with a 1-based line number + the matched line
 * text, so the panel highlights hits exactly (server-provided lineText —
 * no client re-matching). Read-only, joins the CAR-179 restore buffer and
 * dirty probe like the fact-check.
 */

// CAR-179 — module-level state shared by every render of this route (a
// classic script executes once, so these bindings outlive individual
// Router.render() calls):
//   - cvsRestoreBuffer  the studio's transient work — tool inputs plus the
//     exact repaintable payload of every result panel — captured as it
//     changes and consumed by the next render, so the guard's Cancel
//     rewind, a language switch (Router.render(), no hashchange) and a
//     confirmed leave no longer throw a pasted JD or a finished LLM run
//     away.
//   - cvsRouteHash      current hash with any ?query stripped — the
//     leave-guard compares EXACTLY ('#/cv' shares the first segment).
//   - cvsViewDetach     detaches the active instance's beforeunload /
//     hashchange / undo-hotkey listeners; the next render drops the
//     previous instance's set first (the cv.js CAR-20 lifecycle).
let cvsRestoreBuffer = null;
const cvsRouteHash = () => (window.location.hash || '').split('?')[0];
let cvsViewDetach = null;
// Upstream parity: a 30-entry bounded history.
const CVS_UNDO_LIMIT = 30;

Router.register('cv-studio', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  const root = c('div');
  root.appendChild(HelpHint.title(t('cvs.title', 'CV Studio'), 'help.hint.cvStudio'));
  root.appendChild(c('p', { className: 'page-subtitle' },
    t('cvs.subtitle', 'Diagnose your CV, mask it for safe sharing, and rewrite stiff lines in your own voice — grounded only in what you actually wrote.')));

  // ── Undo the last studio edit (CAR-179, upstream #6183) ──
  // The humanize / tailor / add-entry runs overwrite their result panels in
  // place, and the previous result — often a finished LLM run that is saved
  // nowhere — used to be unrecoverable. Every overwrite first pushes a
  // repaintable snapshot onto one shared bounded stack (repaintXxx below);
  // the Undo button and a Cmd/Ctrl+Z hotkey pop it back.
  const undoStack = [];
  const undoBtn = c('button', {
    className: 'btn btn-ghost btn-sm', type: 'button', disabled: 'disabled',
    title: t('cvs.undoHint', 'Restore the previous CV Studio result.'),
    'aria-label': t('cvs.undoHint', 'Restore the previous CV Studio result.'),
  }, t('cvs.undo', 'Undo'));
  const pushUndo = (repaint) => {
    undoStack.push(repaint);
    if (undoStack.length > CVS_UNDO_LIMIT) undoStack.shift();
    undoBtn.disabled = false;
  };
  const runUndo = () => {
    const repaint = undoStack.pop();
    if (!repaint) { undoBtn.disabled = true; return; }
    repaint();
    undoBtn.disabled = undoStack.length === 0;
  };
  undoBtn.addEventListener('click', runUndo);
  root.appendChild(c('div', { style: { margin: '0 0 14px' } }, [undoBtn]));

  // (Discriminated result object — CodeQL js/trivial-conditional clean.)
  const cvLoad = await API.get('/api/cv')
    .then(({ markdown }) => ({ markdown }))
    .catch((e) => ({ error: e }));
  const cvLoadError = cvLoad.error || null;
  let cvMarkdown = cvLoad.markdown || '';
  // CAR-20 (v1.243.0) — a failed GET /api/cv used to be swallowed into
  // cvMarkdown = '', so the page showed the "No CV yet" empty state and
  // sent the user off to (re)write a CV that actually exists. Surface
  // the error instead of masquerading as an empty workspace.
  cvMarkdown = cvMarkdown || '';

  if (cvLoadError) {
    root.appendChild(c('div', { className: 'empty' }, [
      c('p', { style: { color: 'var(--danger, #d9534f)', margin: '0 0 12px' } },
        (cvLoadError && cvLoadError.message) || String(cvLoadError)),
      c('a', { className: 'btn', href: '#/cv' }, t('cvs.goCv', 'Open CV')),
    ]));
    return root;
  }

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
  const nameInput = c('input', { type: 'text', className: 'input', style: { maxWidth: '200px' }, 'data-i18n-placeholder': 'cvs.namePh', 'data-i18n-aria-label': 'cvs.namePh' });
  nameInput.placeholder = t('cvs.namePh', 'Your full name (to initial-ise)');
  const maskOut = c('textarea', { className: 'input', rows: '10', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px', marginTop: '10px' } });
  A11yDump.label(maskOut, t('a11y.readonlyOutput', 'Generated result — read only'));
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
  const humanIn = c('textarea', { className: 'input', rows: '5', 'data-i18n-placeholder': 'cvs.humanPh', 'data-i18n-aria-label': 'cvs.humanPh' });
  humanIn.placeholder = t('cvs.humanPh', 'Paste a stiff line or paragraph from your CV to rewrite in your voice…');
  const humanBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('cvs.humanize', '✨ Make it human'));
  const humanOut = c('div', { style: { marginTop: '10px' }, 'data-studio-panel': 'human' });
  // CAR-119 — run/progress host for the humanize POST.
  const humanRun = c('div');
  humanBtn.addEventListener('click', async () => {
    const text = humanIn.value.trim();
    if (text.length < 20) { UI.toast(t('cvs.needText', 'Paste at least ~20 characters'), 'error'); return; }
    humanBtn.disabled = true;
    // CAR-179 — snapshot the current result before the run overwrites it.
    const prevHuman = humanLive;
    pushUndo(() => repaintHuman(prevHuman));
    humanLive = null;
    humanOut.textContent = '';
    const runCtrl = window.LlmPageKit.createRun({ etaSeconds: 30 }).mount(humanRun);
    try {
      const res = await window.LlmPageKit.run({
        run: runCtrl,
        intro: t('cvs.rewriting', 'Rewriting in your voice…'),
        request: (signal) => window.LlmPageKit.postJSON('/api/cv-studio/humanize', { text, run: true }, signal),
      });
      if (runCtrl.cancelled || runCtrl.signal.aborted) return; // a cancelled run paints nothing more
      if (res && res.markdown) {
        humanLive = res.markdown;
        paintHumanResult(res.markdown);
        rememberStudioState();
      } else {
        const dump = c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, res && res.prompt);
        A11yDump.label(dump, t('a11y.readonlyOutput', 'Generated result — read only'));
        const body = c('div', null, [
          c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } }, t('cvs.humanManualHelp', 'No LLM key is set. Copy this prompt into any LLM, then paste the rewrite back into your CV.')),
          dump,
        ]);
        UI.modal(t('cvs.humanize', '✨ Make it human'), body);
      }
    } catch (err) {
      UI.toast((err && err.message) || t('cvs.humanFailed', 'Could not rewrite the text'), 'error');
    } finally { humanBtn.disabled = false; }
  });
  root.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '0 0 8px' } }, [
    c('h2', { style: { fontSize: '15px', margin: '0 0 4px' } }, t('cvs.humanTitle', 'Make it human')),
    c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 10px' } }, t('cvs.humanHelp', 'Rewrite generic AI phrasing in your own voice — grounded in your voice-dna and writing samples. It never invents facts.')),
    humanIn, c('div', { style: { marginTop: '8px' } }, humanBtn), humanRun, humanOut,
  ]));

  // ── 4. Tailor to a job — résumé + cover letter with a checklist gate ──
  const jdIn = c('textarea', { className: 'input', rows: '6', 'data-i18n-placeholder': 'cvs.tailorJdPh', 'data-i18n-aria-label': 'cvs.tailorJdPh' });
  jdIn.placeholder = t('cvs.tailorJdPh', 'Paste the target job description here…');
  const headIn = c('input', { type: 'text', className: 'input', style: { marginTop: '8px' }, 'data-i18n-placeholder': 'cvs.tailorHeadPh', 'data-i18n-aria-label': 'cvs.tailorHeadPh' });
  headIn.placeholder = t('cvs.tailorHeadPh', 'Optional: target role / headline (e.g. "Senior Backend Engineer")');
  const tailorBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('cvs.tailorBtn', '🎯 Tailor résumé + cover letter'));
  const tailorOut = c('div', { style: { marginTop: '10px' } });
  // CAR-119 — run/progress host for the tailor POST.
  const tailorRun = c('div');

  tailorBtn.addEventListener('click', async () => {
    const jd = jdIn.value.trim();
    if (jd.length < 40) { UI.toast(t('cvs.tailorNeedJd', 'Paste the job description (~40+ characters) first'), 'error'); return; }
    tailorBtn.disabled = true;
    // CAR-179 — snapshot the current result before the run overwrites it.
    const prevTailor = tailorLive;
    pushUndo(() => repaintTailor(prevTailor));
    tailorLive = null;
    tailorOut.textContent = '';
    const runCtrl = window.LlmPageKit.createRun({ etaSeconds: 60 }).mount(tailorRun);
    try {
      const res = await window.LlmPageKit.run({
        run: runCtrl,
        intro: t('cvs.tailoring', 'Tailoring and running the checklist gate…'),
        request: (signal) => window.LlmPageKit.postJSON('/api/cv-studio/tailor', { jd, headline: headIn.value.trim(), run: true }, signal),
      });
      if (runCtrl.cancelled || runCtrl.signal.aborted) return; // a cancelled run paints nothing more
      if (res && res.markdown) {
        tailorLive = res.markdown;
        paintTailorResult(res.markdown);
        rememberStudioState();
      } else {
        const dump = c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, res && res.prompt);
        A11yDump.label(dump, t('a11y.readonlyOutput', 'Generated result — read only'));
        const body = c('div', null, [
          c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } }, t('cvs.tailorManualHelp', 'No LLM key is set. Copy this prompt into any LLM, then paste the tailored résumé + cover letter back.')),
          dump,
        ]);
        UI.modal(t('cvs.tailorBtn', '🎯 Tailor résumé + cover letter'), body);
      }
    } catch (err) {
      UI.toast((err && err.message) || t('cvs.tailorFailed', 'Could not tailor the application'), 'error');
    } finally { tailorBtn.disabled = false; }
  });

  root.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '18px 0 8px' } }, [
    c('h2', { style: { fontSize: '15px', margin: '0 0 4px' } }, t('cvs.tailorTitle', 'Tailor to a job')),
    c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 10px' } }, t('cvs.tailorHelp', 'Paste a job description and get a résumé tailored to it plus a matching cover letter — run through a recruiter-grade checklist gate (errors block, warnings advise). Grounded only in your own CV, profile, and two-pager; it never fabricates.')),
    jdIn, headIn, c('div', { style: { marginTop: '8px' } }, tailorBtn), tailorRun, tailorOut,
  ]));

  // ── 5. Add to CV (v1.117.0) ──
  // A project/publication URL or pasted text → grounded ATS bullets to review
  // and paste into the CV editor yourself. Suggestions only — nothing is
  // written to any file (the URL fetch is SSRF-guarded server-side).
  const addUrlIn = c('input', { type: 'text', className: 'input', 'data-i18n-placeholder': 'cvs.addUrlPh', 'data-i18n-aria-label': 'cvs.addUrlPh' });
  addUrlIn.placeholder = t('cvs.addUrlPh', 'https:// … a repo, article, or portfolio page (optional)');
  const addTextIn = c('textarea', { className: 'input', rows: '5', style: { marginTop: '8px' }, 'data-i18n-placeholder': 'cvs.addTextPh', 'data-i18n-aria-label': 'cvs.addTextPh' });
  addTextIn.placeholder = t('cvs.addTextPh', '…or paste the project/publication description here');
  const addBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('cvs.addBtn', '➕ Suggest CV bullets'));
  const addOut = c('div', { style: { marginTop: '10px' } });
  // CAR-119 — run/progress host for the add-entry POST.
  const addRun = c('div');

  addBtn.addEventListener('click', async () => {
    const url = addUrlIn.value.trim();
    const text = addTextIn.value.trim();
    if (!url && text.length < 80) { UI.toast(t('cvs.addNeedSrc', 'Give a URL or paste ~80+ characters of source text first'), 'error'); return; }
    addBtn.disabled = true;
    // CAR-179 — snapshot the current result before the run overwrites it.
    const prevAdd = addLive;
    pushUndo(() => repaintAdd(prevAdd));
    addLive = null;
    addOut.textContent = '';
    const runCtrl = window.LlmPageKit.createRun({ etaSeconds: 40 }).mount(addRun);
    try {
      const res = await window.LlmPageKit.run({
        run: runCtrl,
        intro: t('cvs.adding', 'Reading the source and drafting grounded bullets…'),
        request: (signal) => window.LlmPageKit.postJSON('/api/cv-studio/add-entry', { url, text, run: true }, signal),
      });
      if (runCtrl.cancelled || runCtrl.signal.aborted) return; // a cancelled run paints nothing more
      if (res && res.markdown) {
        addLive = res.markdown;
        paintAddResult(res.markdown);
        rememberStudioState();
      } else {
        const dump = c('textarea', { className: 'input', rows: '16', readonly: 'readonly', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, res && res.prompt);
        A11yDump.label(dump, t('a11y.readonlyOutput', 'Generated result — read only'));
        UI.modal(t('cvs.addTitle', 'Add to CV'), c('div', null, [
          c('p', { style: { margin: '0 0 10px', color: 'var(--foggy)' } }, t('cvs.addManualHelp', 'No LLM key is set. Copy this prompt into any LLM, then review the bullets it returns.')),
          dump,
        ]));
      }
    } catch (err) {
      UI.toast((err && err.message) || t('cvs.addFailed', 'Could not draft bullets from that source'), 'error');
    } finally { addBtn.disabled = false; }
  });

  root.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '18px 0 8px' } }, [
    c('h2', { style: { fontSize: '15px', margin: '0 0 4px' } }, t('cvs.addTitle', 'Add to CV')),
    c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 10px' } }, t('cvs.addHelp', 'Point at a project, publication, or portfolio page (URL or pasted text) and get ATS-ready bullet points grounded ONLY in that source — never invented. You review and paste them into your CV yourself; nothing is written automatically.')),
    addUrlIn, addTextIn, c('div', { style: { marginTop: '8px' } }, addBtn), addRun, addOut,
  ]));

  // ── 6. Skill gap vs a saved JD ──
  // Zero-LLM: which of a saved job description's required skills your CV already
  // names, only implies, or is missing. Relayed by GET /api/jds/:name/skill-gap.
  const gapSel = c('select', { className: 'lang-select', style: { minWidth: '220px' }, 'aria-label': t('cvs.gapPick', 'Job description') });
  const gapBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('cvs.gapAnalyze', 'Analyze skill gap'));
  const gapOut = c('div', { style: { marginTop: '12px' } });
  let jdList = [];
  // CAR-20 (v1.243.0) — a failed GET /api/jds used to read as "No saved
  // job descriptions yet"; the user believed their archive was empty.
  // Keep the empty list, but surface the error in place of that copy.
  // (Discriminated result object — CodeQL js/trivial-conditional clean.)
  const jdLoad = await API.get('/api/jds')
    .then(({ jds }) => ({ jds }))
    .catch((e) => ({ error: e }));
  const jdListError = jdLoad.error || null;
  jdList = Array.isArray(jdLoad.jds) ? jdLoad.jds : [];
  for (const jd of jdList) gapSel.appendChild(c('option', { value: jd.name }, jd.name));

  // "Reuse a past CV?" hint — a muted, zero-token line telling you whether a
  // PREVIOUSLY saved JD is similar enough to reuse its tailored CV, reuse it
  // with edits, or start fresh. Relayed by GET /api/jds/:name/reuse; it stays
  // silent (never a toast) when the parent script or a prior JD is absent.
  const reuseHint = c('div', { style: { fontSize: '12px', color: 'var(--foggy)', marginTop: '8px', minHeight: '1em' } });
  async function refreshReuseHint() {
    const name = gapSel.value;
    reuseHint.textContent = '';
    if (!name) return;
    let res;
    try { res = await API.get('/api/jds/' + encodeURIComponent(name) + '/reuse'); }
    catch { return; }
    if (!res || res.available === false || !res.best) return;
    const b = res.best;
    const pct = Math.round((Number(b.score) || 0) * 100);
    if (b.decision === 'reuse') {
      reuseHint.textContent = t('cvs.reuseHigh', 'Very similar to a saved job description — you can likely reuse that CV:') + ' ' + b.name + ' (' + pct + '%)';
    } else if (b.decision === 'reuse-with-edits') {
      reuseHint.textContent = t('cvs.reuseEdits', 'Similar to a saved job description — you could reuse that CV with edits:') + ' ' + b.name + ' (' + pct + '%)';
    } else {
      reuseHint.textContent = t('cvs.reuseRegen', 'No closely similar saved job description — best to tailor a fresh CV.');
    }
  }
  gapSel.addEventListener('change', refreshReuseHint);

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
            : c('span', { style: { color: 'var(--foggy)', marginInlineStart: '6px' } }, t('cvs.gapNone', 'none')),
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
      : (jdListError
          ? c('p', { style: { color: 'var(--danger, #d9534f)' } },
              (jdListError && jdListError.message) || String(jdListError))
          : c('p', { style: { color: 'var(--foggy)' } },
            t('cvs.gapNoJds', 'No saved job descriptions yet. Save one from a scan result or the tailor above, then come back.'))),
    reuseHint,
    gapOut,
  ]));
  // Auto-surface the reuse hint for the default-selected JD (needs ≥2 saved
  // JDs — one to compare against). Fire-and-forget so it never blocks render.
  if (jdList.length >= 2) refreshReuseHint();

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
      const res = await API.post('/api/cv-studio/verify-facts', { text }, { lang: true });
      pending.remove();
      if (!res || res.available === false) {
        vfOut.appendChild(c('p', { style: { color: 'var(--foggy)' } },
          t('cvs.vfUnavailable', 'Fact-check needs the parent career-ops project (verify-cv-facts.mjs) next to this app.')));
        return;
      }
      vfLive = res;
      paintVfResult(res);
      rememberStudioState();
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

  // ── 8. Voice check (CAR-188, upstream #6178) ──
  // Zero-LLM stock-phrase lint: paste a tailored CV / cover letter / any AI
  // draft and see the stock phrases ("spearheaded", "proven track record"…)
  // and non-date-range em/en dashes it carries. Relayed by
  // POST /api/cv-studio/voice-check → { phrases: [{phrase, line, match,
  // index, lineText}], count }. Nothing is written; suggestions only.
  const vcIn = c('textarea', {
    className: 'input', rows: 8, style: { width: '100%', fontFamily: 'inherit' },
    'data-i18n-placeholder': 'cvs.voicePlaceholder',
    placeholder: t('cvs.voicePlaceholder', 'Paste the text to check…'),
    'aria-label': t('cvs.voiceTitle', 'Voice check'),
  });
  const vcBtn = c('button', { className: 'btn btn-primary', type: 'button' }, t('cvs.voiceCheck', 'Check for stock phrases'));
  const vcOut = c('div', { style: { marginTop: '12px' } });

  vcBtn.addEventListener('click', async () => {
    const text = vcIn.value.trim();
    if (!text) { UI.toast(t('cvs.voiceEmpty', 'Paste some text to check first.'), 'warn'); return; }
    vcBtn.disabled = true;
    vcOut.textContent = '';
    try {
      const res = await API.post('/api/cv-studio/voice-check', { text });
      voiceLive = res || { phrases: [], count: 0 };
      paintVoiceResult(voiceLive);
      rememberStudioState();
    } catch (err) {
      UI.toast((err && err.message) || t('cvs.voiceFailed', 'Could not check the text'), 'error');
    } finally { vcBtn.disabled = false; }
  });

  root.appendChild(c('div', { className: 'card', style: { padding: '16px', margin: '18px 0 8px' } }, [
    c('h2', { style: { fontSize: '15px', margin: '0 0 4px' } }, t('cvs.voiceTitle', 'Voice check')),
    c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '0 0 10px' } },
      t('cvs.voiceHelp', 'Paste an AI-tailored CV or cover letter and see the stock phrases it carries — “spearheaded”, “proven track record”, “leveraged” — plus dashes that are not date ranges. Zero-LLM; nothing is written.')),
    vcIn, c('div', { style: { marginTop: '8px' } }, vcBtn), vcOut,
  ]));

  // ── Keep the studio's work when you leave (CAR-179, upstream #6182) ──
  // Paint helpers first (hoisted declarations — the run handlers above and
  // the restore below share one path per panel, so an undo snapshot
  // repaints exactly what the run painted).
  function paintHumanResult(markdown) {
    humanOut.appendChild(c('div', { className: 'card', style: { padding: '12px' } },
      c('div', { className: 'md', html: UI.md(markdown) })));
  }
  function paintTailorResult(markdown) {
    tailorOut.appendChild(c('div', { className: 'card', style: { padding: '12px' } }, [
      c('div', { className: 'md', html: UI.md(markdown) }),
      window.ReportExport ? ReportExport.actionsBar(() => markdown, () => t('cvs.tailorFileTitle', 'Tailored application'), t) : null,
    ].filter(Boolean)));
  }
  function paintAddResult(markdown) {
    addOut.appendChild(c('div', { className: 'card', style: { padding: '12px' } }, [
      c('div', { className: 'md', html: UI.md(markdown) }),
      c('p', { style: { fontSize: '12px', color: 'var(--foggy)', margin: '10px 0 0' } },
        t('cvs.addReview', 'Review these suggestions and paste what you accept into the CV editor — nothing was saved automatically.')),
    ]));
  }
  function paintVfResult(res) {
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
  }
  // Voice check (CAR-188): the panel renders the SERVER's post-markup lines
  // (lineText) with each hit marked at the server's index — exact by
  // construction, no client-side re-matching. Like the fact-check, the
  // verdict is zero-LLM and re-runnable, so it is not undoable; it only
  // joins the dirty probe and restore buffer.
  function paintVoiceResult(res) {
    const findings = Array.isArray(res && res.phrases) ? res.phrases : [];
    const panel = c('div', { className: 'card', style: { padding: '12px' } });
    if (!findings.length) {
      panel.appendChild(c('span', { className: 'badge badge-ok' },
        t('cvs.voiceClean', 'Clean — no stock phrases found.')));
    } else {
      panel.appendChild(c('div', { style: { margin: '0 0 8px' } }, c('span', { className: 'badge badge-warn' },
        t('cvs.voiceFound', '{n} stock phrase(s) found.').replace('{n}', String(findings.length)))));
      const byLine = new Map();
      for (const f of findings) {
        if (!byLine.has(f.line)) byLine.set(f.line, []);
        byLine.get(f.line).push(f);
      }
      const markStyle = {
        background: 'var(--warn-bg, #fff7e6)',
        color: 'var(--warn-fg, #663d00)',
        borderRadius: '2px',
        padding: '0 1px',
      };
      for (const [lineNo, fs] of byLine) {
        fs.sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));
        const lineText = String((fs[0] && fs[0].lineText) ?? '');
        const row = c('div', { style: { fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6', overflowWrap: 'anywhere' } },
          [c('span', { style: { color: 'var(--foggy)', userSelect: 'none' } }, `${lineNo}: `)]);
        let cursor = 0;
        for (const f of fs) {
          const start = Number(f.index);
          const hit = String(f.match || '');
          if (!Number.isFinite(start) || start < cursor || start + hit.length > lineText.length) continue;
          if (start > cursor) row.appendChild(document.createTextNode(lineText.slice(cursor, start)));
          row.appendChild(c('mark', { title: String(f.phrase || ''), style: markStyle }, lineText.slice(start, start + hit.length)));
          cursor = start + hit.length;
        }
        if (cursor < lineText.length) row.appendChild(document.createTextNode(lineText.slice(cursor)));
        panel.appendChild(row);
      }
    }
    vcOut.appendChild(panel);
  }
  // An undo snapshot re-runs the panel's own paint path after clearing it.
  // The fact-check verdict is deliberately NOT undoable — it is zero-LLM
  // and re-runnable in place — it only joins the dirty probe and buffer.
  function repaintHuman(markdown) {
    humanLive = markdown;
    humanOut.textContent = '';
    if (markdown != null) paintHumanResult(markdown);
    rememberStudioState();
  }
  function repaintTailor(markdown) {
    tailorLive = markdown;
    tailorOut.textContent = '';
    if (markdown != null) paintTailorResult(markdown);
    rememberStudioState();
  }
  function repaintAdd(markdown) {
    addLive = markdown;
    addOut.textContent = '';
    if (markdown != null) paintAddResult(markdown);
    rememberStudioState();
  }

  // The exact repaintable payload each result panel currently shows
  // (markdown for the three LLM tools, the verdict object for the
  // fact-check). Declared before the restore below consumes them; the run
  // handlers' closures read them at click time.
  let humanLive = null;
  let tailorLive = null;
  let addLive = null;
  let vfLive = null;
  let voiceLive = null;

  // Restore buffer — written on every input event and after every
  // paint/undo, consumed by the next render of this route.
  const rememberStudioState = () => {
    cvsRestoreBuffer = {
      humanIn: humanIn.value,
      jdIn: jdIn.value,
      addUrlIn: addUrlIn.value,
      addTextIn: addTextIn.value,
      vfIn: vfIn.value,
      vcIn: vcIn.value,
      human: humanLive,
      tailor: tailorLive,
      add: addLive,
      vf: vfLive,
      voice: voiceLive,
    };
  };
  [humanIn, jdIn, addUrlIn, addTextIn, vfIn, vcIn].forEach((inp) => inp.addEventListener('input', rememberStudioState));

  // Upstream guards e.key === 'z'; the CAR-172 lesson adds the e.code
  // chord so a non-QWERTY layout (Cmd+Я) still reaches the studio undo.
  const isUndoChord = (e) => (e.key === 'z' || e.code === 'KeyZ') && !e.shiftKey && !!(e.metaKey || e.ctrlKey);
  const onStudioUndoHotkey = (e) => {
    if (!isUndoChord(e)) return;
    const tgt = e.target;
    if (tgt && (tgt.tagName === 'TEXTAREA' || tgt.tagName === 'INPUT' || tgt.isContentEditable)) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    runUndo();
  };
  window.addEventListener('keydown', onStudioUndoHotkey);

  // ── Keep the studio's work when you leave (CAR-179, upstream #6182) ──
  if (cvsRestoreBuffer) {
    const b = cvsRestoreBuffer;
    humanIn.value = b.humanIn || '';
    jdIn.value = b.jdIn || '';
    addUrlIn.value = b.addUrlIn || '';
    addTextIn.value = b.addTextIn || '';
    vfIn.value = b.vfIn || '';
    vcIn.value = b.vcIn || '';
    if (b.human) { humanLive = b.human; paintHumanResult(b.human); }
    if (b.tailor) { tailorLive = b.tailor; paintTailorResult(b.tailor); }
    if (b.add) { addLive = b.add; paintAddResult(b.add); }
    if (b.vf) { vfLive = b.vf; paintVfResult(b.vf); }
    if (b.voice) { voiceLive = b.voice; paintVoiceResult(b.voice); }
  }

  // Dirty is probed LIVE at event time (UX-A10: never a flag an async
  // handler may have missed): any typed input or any painted result.
  const isStudioDirty = () => !!(humanIn.value.trim() || jdIn.value.trim() || addUrlIn.value.trim()
    || addTextIn.value.trim() || vfIn.value.trim() || vcIn.value.trim()
    || humanLive || tailorLive || addLive || vfLive || voiceLive);

  const onStudioBeforeUnload = (e) => {
    if (!isStudioDirty()) return;
    e.preventDefault();
    e.returnValue = '';
  };
  const detachStudioView = () => {
    window.removeEventListener('beforeunload', onStudioBeforeUnload);
    window.removeEventListener('hashchange', onStudioHashChange);
    window.removeEventListener('keydown', onStudioUndoHotkey);
    if (cvsViewDetach === detachStudioView) cvsViewDetach = null;
  };
  const onStudioHashChange = () => {
    if (cvsRouteHash() === '#/cv-studio') return;
    if (!isStudioDirty()) { detachStudioView(); return; }
    const ok = window.confirm(t('cvs.unsavedConfirm', 'You have unsaved CV Studio work. Leave anyway?'));
    if (!ok) {
      // The hash already changed by the time hashchange fires — rewind to
      // keep the user on the page (preventDefault is a no-op on
      // hashchange). Detach first: the re-rendered view registers its own
      // set, and the restore buffer brings the work back.
      detachStudioView();
      window.location.hash = '#/cv-studio';
      return;
    }
    // Leaving confirmed — the buffer keeps the work for the next visit.
    rememberStudioState();
    detachStudioView();
  };
  // Single-instance lifecycle (cv.js CAR-20): drop the previous render's
  // listeners before registering this instance's set.
  if (cvsViewDetach) cvsViewDetach();
  cvsViewDetach = detachStudioView;
  window.addEventListener('beforeunload', onStudioBeforeUnload);
  window.addEventListener('hashchange', onStudioHashChange);

  return root;
});
