/* global Router, API, UI, I18n */
/**
 * /#/config — application configuration. Lets the user set the API
 * keys, scanner knobs, and server settings WITHOUT shelling out to
 * edit `.env` by hand. Writes to the parent project's .env so both
 * career-ops scripts and web-ui's dotenv loader pick up the changes.
 *
 * Secret values are masked on read (first/last 4 chars). Saving an
 * empty field unsets that key in the .env.
 */
Router.register('config', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  let cfg;
  try {
    cfg = await API.get('/api/config');
  } catch (e) {
    return c('div', null, [
      c('header', { className: 'page-header' },
        c('h1', { className: 'page-title' }, t('config.title', 'App settings'))),
      c('div', { className: 'empty' }, e.message || 'failed to load'),
    ]);
  }

  const fields = {};
  // Curated model lists. The first entry per provider doubles as the
  // default when the user hasn't explicitly set the env var. Adding
  // a new model here is one-line — picks up automatically on the UI
  // dropdown.
  const ANTHROPIC_MODELS = [
    'claude-sonnet-4-6',
    'claude-opus-4-7',
    'claude-haiku-4-5',
    'claude-3-7-sonnet-latest',
    'claude-3-5-haiku-latest',
  ];
  const GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-thinking-exp',
  ];
  // OpenAI (v1.55.0 — now a headless live-eval provider too, not just
  // the stored parent-Codex key). First entry = default when
  // OPENAI_MODEL is unset.
  const OPENAI_MODELS = [
    'gpt-5-codex',
    'gpt-5',
    'gpt-5-mini',
    'gpt-4.1',
    'o4-mini',
    'o3',
  ];
  // Qwen via DashScope OpenAI-compatible mode (v1.55.0). First entry =
  // default when QWEN_MODEL is unset.
  const QWEN_MODELS = [
    'qwen-max',
    'qwen-plus',
    'qwen-turbo',
    'qwen2.5-72b-instruct',
    'qwen2.5-coder-32b-instruct',
  ];
  // OpenRouter (v1.57.0) — one key fronts 300+ models. The live
  // catalogue is loaded from GET /api/openrouter/models (server-side
  // proxy; keeps the CSP connect-src 'self' envelope intact). This
  // curated list is the offline fallback + the first entry is the
  // default when OPENROUTER_MODEL is unset. Model ids are namespaced
  // `vendor/model`; `openrouter/auto` lets OpenRouter pick.
  const OPENROUTER_MODELS = [
    'openrouter/auto',
    'anthropic/claude-sonnet-4',
    'anthropic/claude-opus-4',
    'openai/gpt-5',
    'openai/gpt-5-mini',
    'google/gemini-2.5-pro',
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.3-70b-instruct',
    'qwen/qwen-2.5-72b-instruct',
    'deepseek/deepseek-chat',
  ];
  // GitHub Models (v1.74.0) — GitHub Copilot CLI's developer API surface.
  // OpenAI-compatible; auth is a GitHub PAT with the `models` scope. Model
  // ids are publisher-namespaced. First entry = default when unset.
  const GITHUB_MODELS = [
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'openai/gpt-4.1',
    'meta/Llama-3.3-70B-Instruct',
    'mistral-ai/Mistral-Large-2411',
    'deepseek/DeepSeek-V3',
  ];
  const FIELDS = [
    {
      // v1.39.0 (WS8.2) — explicit provider preference.
      key: 'LLM_PROVIDER', secret: false, kind: 'select',
      options: ['auto', 'claude', 'gemini', 'openai', 'qwen', 'openrouter', 'github'], defaultValue: 'auto',
      labelKey: 'config.llmProvider', label: 'LLM_PROVIDER',
      hintKey: 'config.llmProviderHint',
      hintFallback: 'auto = use whichever key is set, preferring Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models. claude / gemini / openai / qwen / openrouter / github = force that one. A forced provider with no key → manual-prompt fallback.',
    },
    {
      key: 'ANTHROPIC_API_KEY', secret: true,
      labelKey: 'config.anthropicKey', label: 'ANTHROPIC_API_KEY',
      hintKey: 'config.anthropicHint',
      hintFallback: 'Get one at console.anthropic.com → API keys. When set, the "⚡ Run live" button executes prompts via Claude.',
    },
    {
      key: 'ANTHROPIC_MODEL', secret: false, kind: 'select',
      options: ANTHROPIC_MODELS, defaultValue: 'claude-sonnet-4-6',
      labelKey: 'config.anthropicModel', label: 'ANTHROPIC_MODEL',
      hintKey: 'config.anthropicModelHint',
      hintFallback: 'Default: claude-sonnet-4-6. Heavier reasoning: claude-opus-4-7. Cheap & fast: claude-haiku-4-5.',
    },
    {
      key: 'GEMINI_API_KEY', secret: true,
      labelKey: 'config.geminiKey', label: 'GEMINI_API_KEY',
      hintKey: 'config.geminiHint',
      hintFallback: 'Free tier at aistudio.google.com/apikey. Used as fallback when Anthropic isn\'t set.',
    },
    {
      key: 'GEMINI_MODEL', secret: false, kind: 'select',
      options: GEMINI_MODELS, defaultValue: 'gemini-2.0-flash',
      labelKey: 'config.geminiModel', label: 'GEMINI_MODEL',
      hintKey: 'config.geminiModelHint',
      hintFallback: 'Default: gemini-2.0-flash (free-tier, fast). Pro tier: gemini-1.5-pro.',
    },
    {
      // v1.55.0 — OpenAI is now a headless live-eval provider too
      // (direct HTTPS, like Anthropic). Still also read by the parent
      // Codex/OpenAI CLI flow. Stored + masked like the other keys.
      key: 'OPENAI_API_KEY', secret: true,
      labelKey: 'config.openaiKey', label: 'OPENAI_API_KEY',
      hintKey: 'config.openaiHint',
      hintFallback: 'platform.openai.com → API keys. v1.55.0: also runs the web-ui ⚡ live eval (3rd in the auto order, after Anthropic & Gemini); still read by the parent Codex/OpenAI CLI flow too.',
    },
    {
      key: 'OPENAI_MODEL', secret: false, kind: 'select',
      options: OPENAI_MODELS, defaultValue: 'gpt-5-codex',
      labelKey: 'config.openaiModel', label: 'OPENAI_MODEL',
      hintKey: 'config.openaiModelHint',
      hintFallback: 'Default: gpt-5-codex. gpt-5 / gpt-5-mini for general use; o4-mini / o3 for reasoning. Used by the web-ui OpenAI live eval and the parent Codex/OpenAI CLI flow.',
    },
    {
      // v1.55.0 — Qwen via DashScope OpenAI-compatible mode. Headless
      // live-eval provider (4th in the auto order). Override the
      // endpoint with QWEN_BASE_URL in the raw .env if you need the
      // mainland-CN host.
      key: 'QWEN_API_KEY', secret: true,
      labelKey: 'config.qwenKey', label: 'QWEN_API_KEY',
      hintKey: 'config.qwenHint',
      hintFallback: 'Alibaba Model Studio / DashScope API key (dashscope.console.aliyun.com). When set, runs the web-ui ⚡ live eval (4th in the auto order, after OpenAI). OpenAI-compatible endpoint.',
    },
    {
      key: 'QWEN_MODEL', secret: false, kind: 'select',
      options: QWEN_MODELS, defaultValue: 'qwen-max',
      labelKey: 'config.qwenModel', label: 'QWEN_MODEL',
      hintKey: 'config.qwenModelHint',
      hintFallback: 'Default: qwen-max (strongest). qwen-plus / qwen-turbo for speed/cost; qwen2.5-coder-32b-instruct for code-heavy reasoning.',
    },
    {
      // v1.57.0 — OpenRouter: one key, 300+ models. 5th in the auto
      // order (tail), so it never silently re-routes an existing
      // Anthropic/Gemini/OpenAI/Qwen setup.
      key: 'OPENROUTER_API_KEY', secret: true,
      labelKey: 'config.openrouterKey', label: 'OPENROUTER_API_KEY',
      hintKey: 'config.openrouterHint',
      hintFallback: 'openrouter.ai/keys — one key fronts 300+ models (Anthropic, OpenAI, Google, Meta, Qwen, DeepSeek …). When set, runs the web-ui ⚡ live eval (5th in the auto order, after Qwen).',
    },
    {
      key: 'OPENROUTER_MODEL', secret: false, kind: 'select-remote',
      remote: '/api/openrouter/models', options: OPENROUTER_MODELS,
      defaultValue: 'openrouter/auto',
      labelKey: 'config.openrouterModel', label: 'OPENROUTER_MODEL',
      hintKey: 'config.openrouterModelHint',
      hintFallback: 'Default: openrouter/auto (OpenRouter picks). The full live catalogue loads from OpenRouter; pick any vendor/model id. Falls back to a curated list if the catalogue is unreachable.',
    },
    {
      // v1.74.0 — GitHub Models (GitHub Copilot CLI's API surface). A GitHub
      // PAT with the `models` scope; OpenAI-compatible endpoint. 6th in the
      // auto order (tail), after OpenRouter.
      key: 'GITHUB_MODELS_API_KEY', secret: true,
      labelKey: 'config.githubKey', label: 'GITHUB_MODELS_API_KEY',
      hintKey: 'config.githubHint',
      hintFallback: 'A GitHub personal-access token with the "models" scope (github.com/settings/tokens). This is GitHub Copilot CLI\'s API surface (GitHub Models). When set, runs the web-ui ⚡ live eval (6th in the auto order, after OpenRouter).',
    },
    {
      key: 'GITHUB_MODELS_MODEL', secret: false, kind: 'select',
      options: GITHUB_MODELS, defaultValue: 'openai/gpt-4o-mini',
      labelKey: 'config.githubModel', label: 'GITHUB_MODELS_MODEL',
      hintKey: 'config.githubModelHint',
      hintFallback: 'Default: openai/gpt-4o-mini. Publisher-namespaced ids — openai/gpt-4o, openai/gpt-4.1, meta/Llama-3.3-70B-Instruct, deepseek/DeepSeek-V3, …',
    },
    // v1.19.0 — HH_USER_AGENT removed from the UI per user direction.
    // The server still honors the env var if a power user sets it via
    // career-ops/.env, but it's no longer advertised through #/config —
    // the bundled default UA in server/lib/sources/hh.mjs handles
    // non-RU IPs well enough for most users.
    {
      key: 'PORT', secret: false, defaultValue: '4317',
      labelKey: 'config.port', label: 'PORT',
      hintKey: 'config.portHint',
      hintFallback: 'Default 4317. Restart the server after changing.',
    },
    {
      key: 'HOST', secret: false, defaultValue: '127.0.0.1',
      labelKey: 'config.host', label: 'HOST',
      hintKey: 'config.hostHint',
      hintFallback: 'Default 127.0.0.1 (loopback). 0.0.0.0 exposes the UI to your LAN — only do that on a trusted network.',
    },
  ];

  const dirty = new Set();

  function fieldRow(spec) {
    const value = cfg.values[spec.key] || '';
    // v1.20.0 — WCAG 1.3.1 / 3.3.2 association: each input is now
    // wired to its hint via `aria-describedby` and to its label via
    // `id` + `htmlFor`, so screen readers announce the hint text as
    // the input gets focus.
    const inputId = 'cfg-' + spec.key.toLowerCase().replace(/_/g, '-');
    const hintId = inputId + '-hint';
    let input;
    if (spec.kind === 'select' || spec.kind === 'select-remote') {
      // Dropdown for known-enum fields (model selection).
      // Pre-select the saved value; if unset use the spec's default.
      const current = value || spec.defaultValue || '';
      // Seed the option set with the curated/fallback list AND the
      // current value (so a previously-saved custom model id is never
      // silently dropped while the live catalogue loads).
      const seed = spec.options.slice();
      if (current && !seed.includes(current)) seed.unshift(current);
      input = c('select', {
        id: inputId,
        'aria-describedby': hintId,
        className: 'select',
        style: { minWidth: '300px', fontSize: '13px' },
        onChange: () => dirty.add(spec.key),
      }, seed.map((opt) => c('option', { value: opt }, opt)));
      input.value = current;
      if (spec.kind === 'select-remote') {
        // v1.57.0 — replace the curated seed with the live OpenRouter
        // catalogue (server-side proxy → CSP-safe). Never blocks the
        // page: failure leaves the curated fallback in place.
        API.get(spec.remote).then((data) => {
          const models = Array.isArray(data && data.models) ? data.models : [];
          if (!models.length) return;
          const keep = input.value || current;
          const ids = models.map((m) => m.id).filter(Boolean);
          if (keep && !ids.includes(keep)) ids.unshift(keep);
          input.replaceChildren(
            ...ids.map((id) => c('option', { value: id }, id)));
          input.value = keep;
        }).catch(() => { /* keep the curated fallback */ });
      }
    } else {
      input = c('input', {
        id: inputId,
        'aria-describedby': hintId,
        className: 'input',
        type: spec.secret ? 'password' : 'text',
        placeholder: spec.secret && value
          ? value /* show masked preview as placeholder when set */
          : (spec.label || ''),
        style: { fontFamily: 'ui-monospace,monospace', fontSize: '13px' },
        onInput: () => dirty.add(spec.key),
      });
      // Only pre-populate if NOT secret (we never echo secrets back).
      // v1.57.1 — when the key is unset, prefill the spec's default
      // (PORT 4317 / HOST 127.0.0.1) so the field shows the value the
      // server actually uses instead of looking empty/unconfigured.
      if (!spec.secret) input.value = value || spec.defaultValue || '';
    }
    fields[spec.key] = input;
    return c('div', { className: 'field', style: { marginBottom: '20px' } }, [
      c('label', { htmlFor: inputId, style: { fontWeight: 600, fontSize: '14px' } }, [
        spec.label,
        spec.secret && value
          ? c('span', { style: { marginLeft: '10px', fontSize: '12px', color: 'var(--ok, #008a05)', fontWeight: 'normal' } }, '✓ set')
          : null,
      ]),
      c('p', { id: hintId, style: { color: 'var(--foggy)', fontSize: '13px', margin: '4px 0 8px' } },
        t(spec.hintKey, spec.hintFallback)),
      input,
    ]);
  }

  async function save(btn) {
    const body = {};
    for (const spec of FIELDS) {
      // Secrets: only send if user touched the field. Non-secrets: always send.
      if (spec.secret && !dirty.has(spec.key)) continue;
      body[spec.key] = fields[spec.key].value;
    }
    try {
      const r = await UI.withSpinner(btn, () => API.post('/api/config', body));
      UI.toast(t('config.saved', 'Settings saved · ' + (r.written?.length || 0) + ' key(s)'), 'success');
      dirty.clear();
      // Re-fetch so masked previews refresh.
      cfg = await API.get('/api/config');
      // UX-D-I (v1.58.41) — broadcast the change so any open cost-hint
      // node (auto / deep / evaluate / mode pages) re-fetches
      // `/api/status/providers` and updates the line in place. Without
      // this, the cost line would silently lie until the user navigated
      // away and back.
      document.dispatchEvent(new CustomEvent('providers-changed'));
      // Re-render in place by re-routing.
      Router.render();
    } catch (e) {
      UI.toast(e.message || 'save failed', 'error');
    }
  }

  // ─── Profile tab — v1.32.0 (WS1): field-by-field form ───
  // Replaces the bare-YAML textarea. 14 scalar paths grouped into
  // Candidate / Narrative / Compensation. Save sends `{ fields: {…} }`
  // → server MERGES (read→set/delete leaf→re-serialize), so arrays
  // (archetypes, proof_points) + unknown keys survive untouched. The
  // raw textarea is retained as a collapsed "Advanced" escape hatch
  // for comment-preservation / complex-array edits.
  const PROFILE_SECTIONS = [
    { titleKey: 'config.pfCandidate', titleFallback: 'Candidate', fields: [
      { path: 'candidate.full_name', lblKey: 'config.pfFullName', lbl: 'Full name' },
      { path: 'candidate.email', lblKey: 'config.pfEmail', lbl: 'Email', type: 'email' },
      { path: 'candidate.phone', lblKey: 'config.pfPhone', lbl: 'Phone' },
      { path: 'candidate.location', lblKey: 'config.pfLocation', lbl: 'Location' },
      { path: 'candidate.linkedin', lblKey: 'config.pfLinkedin', lbl: 'LinkedIn' },
      { path: 'candidate.github', lblKey: 'config.pfGithub', lbl: 'GitHub' },
      { path: 'candidate.portfolio_url', lblKey: 'config.pfPortfolio', lbl: 'Portfolio URL' },
      { path: 'candidate.twitter', lblKey: 'config.pfTwitter', lbl: 'X / Twitter' },
    ] },
    { titleKey: 'config.pfNarrative', titleFallback: 'Narrative', fields: [
      { path: 'narrative.headline', lblKey: 'config.pfHeadline', lbl: 'Headline' },
      { path: 'narrative.exit_story', lblKey: 'config.pfExitStory', lbl: 'Exit story', area: true },
    ] },
    { titleKey: 'config.pfComp', titleFallback: 'Compensation', fields: [
      { path: 'compensation.target_range', lblKey: 'config.pfTargetRange', lbl: 'Target range' },
      { path: 'compensation.currency', lblKey: 'config.pfCurrency', lbl: 'Currency' },
      { path: 'compensation.minimum', lblKey: 'config.pfMinimum', lbl: 'Walk-away minimum' },
      { path: 'compensation.location_flexibility', lblKey: 'config.pfLocFlex', lbl: 'Location flexibility' },
    ] },
  ];
  const pfInputs = {}; // path → input element
  function getDotted(obj, path) {
    return path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
  }
  const profileTextarea = c('textarea', {
    className: 'textarea',
    rows: 18,
    style: { minHeight: '340px', fontFamily: 'ui-monospace,monospace', fontSize: '13px' },
  });
  let profileLoaded = false;

  function buildProfileForm(profileObj) {
    return PROFILE_SECTIONS.map((sec) =>
      c('details', { open: true, style: { marginBottom: '14px' } }, [
        c('summary', { style: { fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: '6px 0' } },
          t(sec.titleKey, sec.titleFallback)),
        c('div', { style: { paddingTop: '8px' } }, sec.fields.map((f) => {
          const id = 'pf-' + f.path.replace(/\./g, '-');
          const cur = getDotted(profileObj, f.path);
          const val = (cur == null) ? '' : String(cur);
          const input = f.area
            ? c('textarea', { id, className: 'textarea', rows: 3 })
            : c('input', { id, className: 'input', type: f.type || 'text' });
          input.value = val;
          pfInputs[f.path] = input;
          return c('div', { className: 'field', style: { marginBottom: '12px' } }, [
            c('label', { htmlFor: id, style: { fontWeight: 600, fontSize: '14px' } }, t(f.lblKey, f.lbl)),
            input,
          ]);
        })),
      ]));
  }

  const pfFormHost = c('div');

  // ── v1.35.0 (WS6.4) — structured array editors ──
  // path → { spec: 'string' | [obj-keys], titleKey, title }. Mirrors
  // the server PROFILE_ARRAY_SPECS allow-list exactly.
  const PROFILE_ARRAYS = [
    { path: 'target_roles.primary', spec: 'string',
      titleKey: 'config.pfPrimaryRoles', title: 'Target roles' },
    { path: 'narrative.superpowers', spec: 'string',
      titleKey: 'config.pfSuperpowers', title: 'Superpowers' },
    { path: 'target_roles.archetypes', spec: ['name', 'level', 'fit'],
      titleKey: 'config.pfArchetypes', title: 'Archetypes' },
    { path: 'narrative.proof_points', spec: ['name', 'url', 'hero_metric'],
      titleKey: 'config.pfProofPoints', title: 'Proof points' },
  ];
  const pfArrayReaders = {}; // path → () => current rows

  function makeArrayEditor(arrSpec, profileObj) {
    const { path, spec } = arrSpec;
    const cur = getDotted(profileObj, path);
    const initial = Array.isArray(cur) ? cur : [];
    const rowsHost = c('div');
    const rowEls = []; // {read: () => value|null}

    function addRow(seed) {
      let read;
      let rowEl;
      const rm = c('button', {
        className: 'btn btn-ghost btn-sm',
        type: 'button',
        'aria-label': t('config.pfRemoveRow', 'Remove row'),
        onClick: () => {
          const i = rowEls.indexOf(holder);
          if (i >= 0) rowEls.splice(i, 1);
          rowsHost.removeChild(rowEl);
        },
      }, '✕');
      if (spec === 'string') {
        const inp = c('input', {
          className: 'input', type: 'text',
          'aria-label': t(arrSpec.titleKey, arrSpec.title),
          style: { flex: '1' },
        });
        inp.value = (seed == null) ? '' : String(seed);
        read = () => inp.value.trim() || null;
        rowEl = c('div', { className: 'flex gap-3', style: { marginBottom: '8px', alignItems: 'center' } }, [inp, rm]);
      } else {
        const inps = {};
        const cells = spec.map((k) => {
          const inp = c('input', {
            className: 'input', type: 'text',
            'aria-label': `${t(arrSpec.titleKey, arrSpec.title)} — ${k}`,
            placeholder: k, style: { flex: '1', minWidth: '90px' },
          });
          inp.value = (seed && seed[k] != null) ? String(seed[k]) : '';
          inps[k] = inp;
          return inp;
        });
        read = () => {
          const o = {};
          for (const k of spec) { const v = inps[k].value.trim(); if (v) o[k] = v; }
          return Object.keys(o).length ? o : null;
        };
        rowEl = c('div', { className: 'flex gap-3', style: { marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' } }, [...cells, rm]);
      }
      const holder = { read };
      rowEls.push(holder);
      rowsHost.appendChild(rowEl);
    }

    initial.forEach((v) => addRow(v));

    pfArrayReaders[path] = () => rowEls.map((r) => r.read()).filter((v) => v != null);

    return c('details', { open: false, style: { marginBottom: '14px' } }, [
      c('summary', { style: { fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: '6px 0' } },
        t(arrSpec.titleKey, arrSpec.title)),
      c('div', { style: { paddingTop: '8px' } }, [
        rowsHost,
        c('button', {
          className: 'btn btn-ghost btn-sm', type: 'button',
          onClick: () => addRow(spec === 'string' ? '' : {}),
        }, '+ ' + t('config.pfAddRow', 'Add')),
      ]),
    ]);
  }

  async function loadProfileTab() {
    if (profileLoaded) return;
    try {
      const data = await API.get('/api/profile');
      const obj = (data && data.profile && typeof data.profile === 'object') ? data.profile : {};
      pfFormHost.innerHTML = '';
      for (const k of Object.keys(pfArrayReaders)) delete pfArrayReaders[k];
      buildProfileForm(obj).forEach((n) => pfFormHost.appendChild(n));
      PROFILE_ARRAYS.forEach((a) => pfFormHost.appendChild(makeArrayEditor(a, obj)));
      profileTextarea.value = (data && data.raw) || '';
      profileLoaded = true;
    } catch (e) {
      pfFormHost.innerHTML = '';
      pfFormHost.appendChild(c('p', { style: { color: 'var(--err, #c00)' } },
        t('config.profileLoadErr', 'Could not load profile: ') + (e.message || e)));
    }
  }

  // Field-form save → merge path.
  async function saveProfile(btn) {
    const fieldsPayload = {};
    for (const [path, el] of Object.entries(pfInputs)) fieldsPayload[path] = el.value;
    const fullName = (fieldsPayload['candidate.full_name'] || '').trim();
    if (!fullName) {
      UI.toast(t('config.pfNameRequired', 'Full name is required'), 'error');
      pfInputs['candidate.full_name']?.focus();
      return;
    }
    const arraysPayload = {};
    for (const [path, read] of Object.entries(pfArrayReaders)) arraysPayload[path] = read();
    try {
      const r = await UI.withSpinner(btn, () =>
        API.put('/api/profile', { fields: fieldsPayload, arrays: arraysPayload }));
      UI.toast(t('config.profileSaved', 'Profile saved') +
        (r.candidate ? ` · ${r.candidate}` : ''), 'success');
      // Re-read so arrays / unknown keys the form doesn't model are
      // reflected back into the raw escape-hatch textarea.
      profileLoaded = false;
      await loadProfileTab();
    } catch (e) {
      UI.toast(e.message || 'save failed', 'error');
    }
  }

  // Raw-YAML escape hatch save (advanced).
  async function saveProfileRaw(btn) {
    if (!profileTextarea.value.trim()) {
      UI.toast(t('config.profileEmpty', 'Profile YAML is empty'), 'error');
      return;
    }
    // WS2 #4 — raw save REPLACES the whole parent config/profile.yml.
    // Focus-trapped confirm before this destructive, data-loss write.
    if (!(await UI.confirm(
      t('config.rawConfirmTitle', 'Overwrite the whole file?'),
      t('config.profileRawConfirmBody',
        'This replaces the ENTIRE config/profile.yml in the parent project with the text above. Any keys not shown here will be lost. Continue?'),
      { danger: true, confirmLabel: t('config.rawConfirmOk', 'Overwrite'), cancelLabel: t('common.cancel', 'Cancel') }))) {
      return;
    }
    try {
      const r = await UI.withSpinner(btn, () =>
        API.put('/api/profile', { yaml: profileTextarea.value }));
      UI.toast(t('config.profileSaved', 'Profile saved') +
        (r.candidate ? ` · ${r.candidate}` : ''), 'success');
      profileLoaded = false;
      await loadProfileTab();
    } catch (e) {
      UI.toast(e.message || 'save failed', 'error');
    }
  }

  // ─── Tab plumbing ───
  // F-013: group fields by cfg.groups (core | runtime | regional). The
  // regional group is auto-collapsed and only present when portals.yml
  // declares at least one regional source.
  const groups = (cfg && cfg.groups) || {};
  const regionalActive = !!(cfg && cfg.regionalActive);
  const groupOf = (k) => groups[k] || 'core';
  const groupTitle = (g) => ({
    core: t('config.groupCore', 'API keys'),
    runtime: t('config.groupRuntime', 'Runtime'),
    regional: t('config.groupRegional', 'Regional sources'),
  }[g] || g);
  // WS2 #2: via the #/portals alias, force-open Regional sources if it
  // exists (never render an empty group — the alias alone kills the 404).
  const viaPortals = (window.location.hash || '').toLowerCase().startsWith('#/portals');
  const renderGroup = (g, fields, opts = {}) => {
    if (!fields.length) return null;
    const portalsFocus = g === 'regional' && viaPortals;
    if (g === 'regional' && !regionalActive && !opts.forceVisible && !portalsFocus) return null;
    return c('details', {
      open: g !== 'regional' || portalsFocus,
      style: { marginBottom: '16px' },
      ...(g === 'regional' ? { id: 'cfg-regional' } : {}),
    }, [
      c('summary', { style: { fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: '6px 0' } },
        groupTitle(g)),
      c('div', { style: { paddingTop: '10px' } }, fields.map(fieldRow)),
    ]);
  };
  // UX-A9 (v1.58.62) — sticky summary chip at the top of the API-keys
  // panel. Without scrolling the user can see which provider the
  // current OR-fallback resolves to AND how many of the 5 supported
  // keys are configured. Refreshes on save (providers-changed) and on
  // tab focus (visibilitychange) — same pattern as the dashboard chip.
  const apiSummary = c('div', {
    className: 'api-keys__summary',
    role: 'status',
    'aria-live': 'polite',
  }, '');
  // NEW-OR1 (v1.59.4) — race-safe refresh. The pre-fix `refreshApiSummary`
  // cleared every child *before* awaiting the fetch result on some
  // browsers when the previous fetch was still in flight (a stale
  // providers-changed could race the Save). Now we:
  //   1. Build the new <span> nodes first (no DOM mutation yet).
  //   2. Atomically replace via apiSummary.replaceChildren(...newNodes).
  //   3. Refuse to swap when the fetch lost (st === null) — keep the
  //      previous state instead of blanking the chip.
  //   4. Cache `lastGoodSt` so a transient `keysConfigured: []` from a
  //      mid-Save read doesn't drag the displayed count to 0/5 while
  //      the server is still propagating. We only DROP a key from the
  //      displayed count when the server response is definitive — i.e.
  //      `keysConfigured` is present (not an absent property) AND the
  //      previously-known active provider is no longer in the list.
  let lastGoodSt = null;
  let inFlight = 0;
  async function refreshApiSummary() {
    const myToken = ++inFlight;
    let st = null;
    try {
      const r = await fetch('/api/status/providers');
      if (r.ok) st = await r.json();
    } catch { /* offline → keep last */ }
    // Drop stale resolves (another refresh started after us).
    if (myToken !== inFlight) return;
    if (!st) {
      // No fresh data — leave the chip showing the last known state.
      // Hide only when we never had any state at all.
      if (!lastGoodSt) apiSummary.hidden = true;
      return;
    }
    lastGoodSt = st;
    apiSummary.hidden = false;
    const NAME = { anthropic: 'Anthropic', gemini: 'Gemini', openai: 'OpenAI', qwen: 'Qwen', openrouter: 'OpenRouter' };
    const active = st.activeProvider
      ? (NAME[st.activeProvider] || st.activeProvider)
      : t('dash.provider.manual', 'Manual prompt mode');
    const count = Array.isArray(st.keysConfigured) ? st.keysConfigured.length : 0;
    const activeLabel = c('span', { className: 'api-keys__active' },
      t('config.activeProvider', 'Active') + ': ' + active);
    const countLabel = c('span', { className: 'api-keys__count' },
      t('config.keysConfiguredPrefix', 'Keys') + ': ' + count + ' / 5');
    // Atomic swap — never leaves the chip empty mid-update.
    apiSummary.replaceChildren(activeLabel, countLabel);
  }
  document.addEventListener('providers-changed', refreshApiSummary);
  refreshApiSummary();
  const apiPanel = c('div', { className: 'card' }, [
    apiSummary,
    // v1.55.0 — clarify the CLI-agnostic parent vs the headless
    // web-ui eval (Anthropic|Gemini|OpenAI|Qwen via "OR").
    c('p', {
      style: { color: 'var(--foggy)', fontSize: '12px', margin: '0 0 14px', lineHeight: '1.5' },
    }, t('config.providerModelNote',
      'career-ops is CLI-agnostic — you run it inside any AI coding CLI (Claude Code · Codex · Gemini · OpenCode · Qwen · Copilot · Kimi). This web UI\'s ⚡ live eval runs headless and uses whichever API key below is set (Anthropic → Gemini → OpenAI → Qwen).')),
    renderGroup('core',     FIELDS.filter((f) => groupOf(f.key) === 'core'),     { forceVisible: true }),
    renderGroup('runtime',  FIELDS.filter((f) => groupOf(f.key) === 'runtime'),  { forceVisible: true }),
    renderGroup('regional', FIELDS.filter((f) => groupOf(f.key) === 'regional')),
    c('div', { className: 'flex gap-3' }, [
      c('button', {
        className: 'btn btn-primary',
        onClick: (e) => save(e.currentTarget),
      }, '💾 ' + t('common.save', 'Save')),
      c('a', {
        href: '#/health',
        className: 'btn btn-ghost',
      }, t('config.gotoHealth', 'Verify on Health')),
    ]),
  ]);

  const profilePanel = c('div', { className: 'card' }, [
    c('p', { style: { color: 'var(--foggy)', fontSize: '13px', margin: '0 0 12px' } },
      t('config.profileHintForm',
        'Edit your profile field by field. Saves merge into config/profile.yml — your archetypes, proof points, and any custom keys are preserved untouched.')),
    pfFormHost,
    c('div', { className: 'flex gap-3 mt-3' }, [
      c('button', {
        className: 'btn btn-primary',
        onClick: (e) => saveProfile(e.currentTarget),
      }, '💾 ' + t('common.save', 'Save')),
      c('a', { href: '#/profile', className: 'btn btn-ghost' },
        t('config.viewProfile', 'View read-only summary →')),
    ]),
    // ── Advanced: raw YAML escape hatch (arrays, comments, custom keys) ──
    c('details', { style: { marginTop: '18px' } }, [
      c('summary', { style: { fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--foggy)' } },
        t('config.profileRawToggle', 'Advanced: edit raw YAML (archetypes, proof points, comments)')),
      c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '8px 0' } },
        t('config.profileRawHint',
          'Full YAML editor. Use for nested arrays the field form does not model, or to preserve comments. Replaces the whole file on save.')),
      profileTextarea,
      c('div', { className: 'flex gap-3 mt-3' }, [
        c('button', {
          className: 'btn btn-ghost',
          onClick: (e) => saveProfileRaw(e.currentTarget),
        }, '💾 ' + t('config.profileRawSave', 'Save raw YAML')),
      ]),
    ]),
  ]);

  // ─── G-008 (v1.15.0) — Modes tab: editor for modes/_profile.md ───
  // This is the canonical "Career framing" file per career-ops.org Quick
  // Start §Step-5 (Target Roles, Adaptive Framing, Exit Narrative, Comp
  // Targets, Location Policy). Most-edited file per the docs. Until
  // v1.15 it had no UI surface — users had to shell into the parent.
  const modesTextarea = c('textarea', {
    className: 'textarea',
    rows: 24,
    style: { width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: '13px', minHeight: '420px' },
    placeholder: '# Career framing (modes/_profile.md)\n\n## Target Roles\n- …',
  });
  let modesLoaded = false;
  let modesScaffolded = false;
  // v1.54.3 (USER-REQ) — structured field-form (not raw markdown).
  // `_profile.md` has a documented schema (career-ops.org §Step-5):
  // Target Roles / Adaptive Framing / Comp Targets are bullet lists,
  // Exit Narrative / Location Policy are prose. ModesForm renders real
  // fields (repeatable line-inputs for lists, labelled textareas for
  // prose) and collect()s back to the `{ sections }` merge payload the
  // server already understands — preamble + unknown sections + order
  // survive untouched (merge-not-replace). Raw markdown stays available
  // in the Advanced disclosure for add/remove-section / preamble edits.
  const modesSectionHost = c('div');
  let modesForm = null; // { host, collect } from ModesForm.build()

  function buildSectionEditors(data) {
    modesSectionHost.innerHTML = '';
    // v1.54.8 — pass the whole GET payload so the form can render the
    // 5 canonical fields (with doc-sourced descriptions) even when the
    // file has no `##` sections, and preserve the preamble on rebuild.
    modesForm = window.ModesForm.build(data || { sections: [], preamble: '' });
    modesSectionHost.appendChild(modesForm.host);
  }

  async function loadModesTab() {
    if (modesLoaded) return;
    try {
      const data = await API.get('/api/modes/_profile');
      modesTextarea.value = (data && data.markdown) || '';
      buildSectionEditors(data || { sections: [], preamble: '' });
      modesScaffolded = !!(data && data.scaffolded);
      modesLoaded = true;
      if (modesScaffolded) {
        UI.toast(t('config.modesScaffolded',
          'Scaffolded from _profile.template.md — review then Save'), 'info');
      }
    } catch (e) {
      modesTextarea.value = '# error: ' + (e.message || e);
    }
  }

  // Field-form save. collect() is tagged:
  //   { mode:'sections' } → non-destructive per-section merge (no
  //     confirm; preamble + untouched + custom sections survive).
  //   { mode:'markdown' }  → the file lacked the canonical schema, so
  //     the form bootstraps/normalises the whole document. That
  //     REPLACES the parent file → confirm-gate it (WS2 #4), exactly
  //     like the raw editor.
  async function saveModes(btn) {
    const payload = modesForm ? modesForm.collect() : null;
    if (!payload) {
      UI.toast(t('config.modesNoSections', 'No ## sections found — use the raw editor below.'), 'error');
      return;
    }
    let body;
    if (payload.mode === 'markdown') {
      if (!(await UI.confirm(
        t('config.rawConfirmTitle', 'Overwrite the whole file?'),
        t('config.modesFormRebuildBody',
          'This will (re)create modes/_profile.md from the fields above with the standard schema. Your preamble and any custom sections are preserved. Continue?'),
        { danger: true, confirmLabel: t('config.rawConfirmOk', 'Overwrite'), cancelLabel: t('common.cancel', 'Cancel') }))) {
        return;
      }
      body = { markdown: payload.markdown };
    } else {
      body = { sections: payload.sections };
    }
    try {
      const r = await UI.withSpinner(btn, () =>
        API.put('/api/modes/_profile', body));
      UI.toast(t('config.modesSaved', 'modes/_profile.md saved') +
        (r.sanitized ? ` (${t('config.sanitized', 'sanitized')})` : ''), 'success');
      modesScaffolded = false;
      modesLoaded = false;
      await loadModesTab();
    } catch (e) {
      UI.toast((e && e.message) || 'failed to save', 'error');
    }
  }

  // Raw-markdown escape hatch (add/remove sections, preamble edits).
  async function saveModesRaw(btn) {
    if (!modesTextarea.value.trim()) {
      UI.toast(t('config.modesEmpty', 'modes/_profile.md is empty'), 'error');
      return;
    }
    // WS2 #4 — raw save REPLACES the whole parent modes/_profile.md.
    if (!(await UI.confirm(
      t('config.rawConfirmTitle', 'Overwrite the whole file?'),
      t('config.modesRawConfirmBody',
        'This replaces the ENTIRE modes/_profile.md in the parent project with the text above. Sections not shown here will be lost. Continue?'),
      { danger: true, confirmLabel: t('config.rawConfirmOk', 'Overwrite'), cancelLabel: t('common.cancel', 'Cancel') }))) {
      return;
    }
    try {
      const r = await UI.withSpinner(btn, () =>
        API.put('/api/modes/_profile', { markdown: modesTextarea.value }));
      UI.toast(t('config.modesSaved', 'modes/_profile.md saved') +
        (r.sanitized ? ` (${t('config.sanitized', 'sanitized')})` : ''), 'success');
      modesScaffolded = false;
      modesLoaded = false;
      await loadModesTab();
    } catch (e) {
      UI.toast((e && e.message) || 'failed to save', 'error');
    }
  }

  const modesPanel = c('div', { className: 'card' }, [
    c('p', { style: { color: 'var(--foggy)', fontSize: '13px', margin: '0 0 12px' } },
      t('config.modesHint',
        'modes/_profile.md is your private career framing — never committed to git. Drives every evaluation, deep-research, and outreach prompt.')),
    c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '0 0 12px' } },
      t('config.modesSectionHint',
        'Each section is a structured field below — list sections take one line per item, prose sections are free text. Saving merges by section: your preamble and any sections you do not touch are preserved.')),
    modesSectionHost,
    c('div', { className: 'flex gap-3 mt-3' }, [
      c('button', {
        className: 'btn btn-primary',
        onClick: (e) => saveModes(e.currentTarget),
      }, '💾 ' + t('common.save', 'Save')),
      c('a', { href: 'https://career-ops.org/docs/introduction/what-is-career-ops',
              target: '_blank', rel: 'noopener', className: 'btn btn-ghost' },
        t('config.modesDocsLink', 'Canonical docs ↗')),
    ]),
    c('details', { style: { marginTop: '18px' } }, [
      c('summary', { style: { fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--foggy)' } },
        t('config.modesRawToggle', 'Advanced: edit raw markdown (add/remove sections, preamble)')),
      c('p', { style: { color: 'var(--foggy)', fontSize: '12px', margin: '8px 0' } },
        t('config.modesRawHint',
          'Full-file editor. Use to add or remove ## sections or edit the preamble. Replaces the whole file on save.')),
      modesTextarea,
      c('div', { className: 'flex gap-3 mt-3' }, [
        c('button', {
          className: 'btn btn-ghost',
          onClick: (e) => saveModesRaw(e.currentTarget),
        }, '💾 ' + t('config.modesRawSave', 'Save raw markdown')),
      ]),
    ]),
  ]);

  // v1.45.0 (WS2 #3) — full WAI-ARIA Tabs pattern: role=tablist/tab/
  // tabpanel, aria-selected, roving tabindex, ←/→/↑/↓/Home/End nav.
  // `is-active` class kept for the existing .tab-btn.is-active CSS.
  const TABS = []; // { btn, panel, label, key, loader }
  function tabBtn(label, panel, key, loader) {
    const btn = c('button', {
      className: 'tab-btn',
      id: 'cfg-tab-' + key,
      role: 'tab',
      'aria-selected': 'false',
      'aria-controls': 'cfg-tabpanel',
      tabindex: '-1',
      type: 'button',
      onClick: () => activate(label),
      onKeydown: onTabKey,
    }, label);
    TABS.push({ btn, panel, label, key, loader });
    return btn;
  }

  const tabsHost = c('div', { className: 'card', style: { padding: '8px', marginBottom: '16px' } });
  const panelHost = c('div', { id: 'cfg-tabpanel', role: 'tabpanel', tabindex: '0' });

  function activate(label) {
    const tab = TABS.find((x) => x.label === label) || TABS[0];
    panelHost.innerHTML = '';
    panelHost.appendChild(tab.panel);
    panelHost.setAttribute('aria-labelledby', tab.btn.id);
    for (const x of TABS) {
      const on = x === tab;
      x.btn.classList.toggle('is-active', on);
      x.btn.setAttribute('aria-selected', on ? 'true' : 'false');
      x.btn.tabIndex = on ? 0 : -1;
    }
    if (tab.loader) tab.loader();
  }

  function onTabKey(e) {
    const i = TABS.findIndex((x) => x.btn === e.currentTarget);
    if (i < 0) return;
    let n = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    else return;
    e.preventDefault();
    activate(TABS[n].label);
    TABS[n].btn.focus();
  }

  const apiLabel = t('config.tabApi', 'API keys & runtime');
  const profileLabel = t('config.tabProfile', 'Profile');
  const modesLabel = t('config.tabModes', 'Modes');
  tabsHost.appendChild(c('div', {
    className: 'flex gap-3',
    role: 'tablist',
    'aria-label': t('config.tablistLabel', 'Settings sections'),
  }, [
    tabBtn(apiLabel, apiPanel, 'api', null),
    tabBtn(profileLabel, profilePanel, 'profile', loadProfileTab),
    tabBtn(modesLabel, modesPanel, 'modes', loadModesTab),
  ]));

  // G-008: support deep-linking via /#/config?tab=modes — when the SPA
  // navigates to this view with that query, jump straight to the Modes
  // tab so the "Career framing" card on /#/profile can deep-link to it.
  function tabFromHash() {
    const hash = (window.location.hash || '').toLowerCase();
    if (hash.includes('tab=modes')) return modesLabel;
    if (hash.includes('tab=profile')) return profileLabel;
    return apiLabel;
  }

  const root = c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        c('h1', { className: 'page-title' }, t('config.title', 'App settings')),
        c('p', { className: 'page-subtitle' },
          t('config.subtitle', 'API keys + scanner knobs. Saved to ') + ' ' + (cfg.envFile || '.env')),
      ]),
    ]),

    c('div', { className: 'card', style: { background: '#fff8e6', borderColor: '#f0c674', color: '#8a6300', marginBottom: '20px' } }, [
      c('strong', null, 'ℹ ' + t('config.bannerTitle', 'Both projects pick this up')),
      c('p', { style: { margin: '6px 0 0', fontSize: '14px' } },
        t('config.bannerBody',
          'Saved values land in the parent .env, so career-ops Node scripts AND web-ui (via dotenv loader) read the same source. No restart needed for the running process — env vars are also applied live.')),
    ]),

    tabsHost,
    panelHost,
  ]);

  // v1.24.1 (G-015) — was `.also((root) => …)` via Element.prototype.also,
  // dropped by v1.22.0 N-2 without migrating this view (cv.js was migrated
  // at the time; config.js was missed and crashed `#/config` on all 8
  // locales with "c(...).also is not a function"). Default to the
  // API-keys tab unless the hash deep-links to Profile or Modes.
  {
    // tabFromHash() returns a label; activate() resolves it via TABS.
    activate(tabFromHash());
  }

  // v1.42.0 (WS2 #2) — when reached via the `#/portals` alias, scroll
  // the Regional sources group into view and move focus to its summary
  // (overriding the router's default h1 focus) so a user who typed/
  // bookmarked #/portals lands exactly on the portal-source controls.
  if (viaPortals) {
    // rAF fires after the router's synchronous focusNewView(h1), so this
    // override reliably wins. <summary> is natively focusable — do NOT
    // add tabindex=-1 (that would strip it from the Tab order, a WCAG
    // regression: the user could no longer Tab back to collapse it).
    requestAnimationFrame(() => {
      const reg = root.querySelector('#cfg-regional');
      if (!reg) return;
      reg.scrollIntoView({ behavior: 'smooth', block: 'start' });
      reg.querySelector('summary')?.focus({ preventScroll: true });
    });
  }

  return root;
});
