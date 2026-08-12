/* global Router, API, UI, I18n */
Router.register('dashboard', async () => {
  // Pull both dashboard data and live health in parallel — saves a round-trip
  // since the System Status card reuses /api/health.
  const [data, health] = await Promise.all([
    API.get('/api/dashboard'),
    API.get('/api/health').catch(() => null),
  ]);
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  function scoreClass(n) {
    if (n == null) return '';
    if (n >= 4.0) return 'score-high';
    if (n >= 3.0) return 'score-mid';
    return 'score-low';
  }

  // Compact "quick action" tile. Renders an icon + label + sub-label.
  // Click goes to `route`. Each tile is keyboard-focusable for a11y.
  // UX-A15 (v1.58.63) — optional `primary` flag adds a stronger visual
  // weight (larger icon + bolder label) to the most-used tile (Pipeline)
  // so the user's eye lands on the highest-frequency action first.
  function qa(icon, labelKey, labelFallback, subKey, subFallback, route, primary) {
    return c('button', {
      className: 'qa-tile' + (primary ? ' qa-tile--primary' : ''),
      onClick: () => Router.go(route),
      title: route,
    }, [
      c('span', { className: 'qa-icon' }, icon),
      c('span', { className: 'qa-body' }, [
        c('span', { className: 'qa-label' }, t(labelKey, labelFallback)),
        c('span', { className: 'qa-sub' }, t(subKey, subFallback)),
      ]),
    ]);
  }

  // Group of tiles under a heading.
  function qaGroup(titleKey, titleFallback, tiles) {
    return c('div', { className: 'qa-group' }, [
      c('h3', { className: 'qa-group-title' }, t(titleKey, titleFallback)),
      c('div', { className: 'qa-grid' }, tiles),
    ]);
  }

  // UX-A3 (v1.58.55) — active-provider chip near the P0 CTAs. The
  // OR-model (Anthropic→Gemini→OpenAI→Qwen→OpenRouter) is the core
  // trust mechanic but Dashboard didn't show which provider is active
  // — the user had to wander to Health to know. This chip mounts
  // empty, fetches `/api/status/providers`, then renders. It re-fetches
  // on `providers-changed` (dispatched from #/config save) and on
  // `visibilitychange` (tab refocus from another window where the user
  // may have changed `LLM_PROVIDER`) — same pattern as the shared
  // UI.providerCostHint helper (v1.58.41).
  function providerChip() {
    const chip = c('div', {
      className: 'dash-chip dash-chip--provider',
      role: 'status',
      'aria-live': 'polite',
    }, '');
    async function refresh() {
      let st = null;
      try {
        st = await API.get('/api/status/providers');
      } catch { /* offline → say nothing */ }
      // Clear children safely (CSP-compatible — no innerHTML).
      while (chip.firstChild) chip.removeChild(chip.firstChild);
      if (!st) { chip.hidden = true; return; }
      chip.hidden = false;
      // v1.59.2 — server returns `anthropic` lowercase, not `claude`
      // (the LLM_PROVIDER env value is `claude` but the resolved name
      // is `anthropic`). Pre-fix the NAME lookup missed and the chip
      // showed `Live evals: anthropic` instead of `Anthropic`.
      const NAME = { anthropic: 'Anthropic', gemini: 'Gemini', openai: 'OpenAI', qwen: 'Qwen', openrouter: 'OpenRouter' };
      if (!st.activeProvider) {
        chip.classList.add('dash-chip--manual');
        chip.appendChild(c('span', { className: 'dash-chip__icon', 'aria-hidden': 'true' }, '📋'));
        chip.appendChild(c('span', { className: 'dash-chip__label' },
          t('dash.provider.manual', 'Manual prompt mode (no API key set)')));
      } else {
        chip.classList.remove('dash-chip--manual');
        const name = NAME[st.activeProvider] || st.activeProvider;
        const lbl = t('dash.provider.live', 'Live evals') + ': ' + name +
          (st.activeModel ? ' ' + st.activeModel : '');
        chip.appendChild(c('span', { className: 'dash-chip__icon', 'aria-hidden': 'true' }, '⚡'));
        chip.appendChild(c('span', { className: 'dash-chip__label' }, lbl));
      }
    }
    refresh();
    const onVisibility = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('providers-changed', refresh);
    // M-1 discipline (v1.58.36) — scope listeners to the route lifetime.
    // Without this, every Router.go('/dashboard') stacks another pair of
    // listeners on `document` and they fire forever. The cleanup
    // self-detaches the first time the hash leaves `#/dashboard`.
    const cleanup = () => {
      if (!location.hash.startsWith('#/dashboard')) {
        document.removeEventListener('visibilitychange', onVisibility);
        document.removeEventListener('providers-changed', refresh);
        window.removeEventListener('hashchange', cleanup);
      }
    };
    window.addEventListener('hashchange', cleanup);
    return chip;
  }

  // v1.55.5 — UX-3: a visually dominant hero. Two P0 CTAs as large
  // buttons + a single focal recent-activity hint (last evaluation,
  // linked) so a returning user sees progress and a new user sees the
  // one action that matters. Empty-state guides the cold start.
  function heroBlock() {
    const lr = data.lastReport;
    const focal = lr
      ? c('a', { className: 'dash-hero-focal', href: '#/reports/' + lr.slug }, [
          c('span', { className: 'dash-hero-focal-label' }, t('dash.lastEval', 'Last evaluation') + ': '),
          lr.scoreNum != null
            ? c('span', { className: 'score-pill ' + scoreClass(lr.scoreNum) }, lr.score)
            : null,
          c('span', { className: 'dash-hero-focal-title' }, ' ' + (lr.title || lr.slug)),
        ])
      : c('div', { className: 'dash-hero-focal dash-hero-focal--empty' },
          t('dash.heroNoEval', 'No evaluations yet — paste a job URL to get your first report.'));
    return c('section', { className: 'dash-hero' }, [
      c('div', { className: 'dash-hero-cta' }, [
        c('button', { className: 'btn btn-primary btn-hero', onClick: () => Router.go('/auto') },
          '✨ ' + t('dash.autoPipeline', 'Auto-pipeline a URL')),
        c('button', { className: 'btn btn-primary btn-hero', onClick: () => Router.go('/scan') },
          '🌐 ' + t('dash.scanNow', 'Scan now')),
      ]),
      focal,
      providerChip(),
    ]);
  }

  // UX-D-B (v1.58.48) — global banner that flags the user when they're
  // still on the default "Acceptance Test" / template profile. The
  // server-side checkProfileCustomized() (server/lib/store.mjs) puts a
  // `{ name: "Profile customized", ok: false }` row in /api/health; if
  // we see it here we surface it loudly at the top of the Dashboard
  // (instead of waiting for the user to wander to /#/health). Each
  // advisor output (Apply / Followup / Contacto / Deep / etc.) would
  // otherwise be addressed to "Acceptance Test" — broken first impression.
  function profileFixtureBanner() {
    if (!health || !Array.isArray(health.checks)) return null;
    const row = health.checks.find((x) => x && x.name === 'Profile customized');
    if (!row || row.ok) return null;
    return c('div', {
      className: 'hero-banner hero-banner--warning',
      role: 'status',
      'aria-live': 'polite',
      id: 'profile-fixture-banner',
    }, [
      c('p', { className: 'hero-banner__msg' },
        t('onboarding.fixtureWarning',
          'Your profile is still on the default template. Every report and email will use this name until you fix it.')),
      c('a', {
        href: '#/config',
        className: 'btn btn-primary btn-sm',
      }, t('onboarding.fixProfile', 'Open profile settings')),
    ]);
  }

  const root = c('div', null, [
    profileFixtureBanner(),
    c('header', { className: 'page-header' }, [
      c('div', null, [
        c('h1', { className: 'page-title' }, t('dash.title')),
        c('p', { className: 'page-subtitle' }, t('dash.subtitle')),
      ]),
      // U-5 (v1.58.25) — removed the header 'Open Pipeline' button.
      // NEW-D2 (v1.58.39) — added a Refresh button that re-fetches the
      // dashboard counters and gives explicit toast feedback. Distinct
      // from the connection-banner Refresh (v1.58.14 / M-9) which does
      // a full page reload — this one only re-fetches the data and
      // re-renders the view in place, so the user can pull fresh
      // counts without leaving the page or losing scroll position.
      c('div', { className: 'flex gap-3' }, [
        c('button', {
          className: 'btn btn-ghost btn-sm',
          'data-test': 'dash-refresh',
          'aria-label': t('dash.refreshAria', 'Refresh dashboard counters'),
          onClick: async (e) => {
            const btn = e.currentTarget;
            UI.toast(I18n.t('common.refreshing', 'Refreshing…'));
            try {
              await UI.withSpinner(btn, async () => {
                const fresh = await API.get('/api/dashboard');
                // Re-execute the route handler so the view rebuilds
                // with the new counts; cheap (one fetch already done).
                Router.go('/dashboard');
                return fresh;
              });
              UI.dismissToast();
              UI.toast(I18n.t('dash.refreshed', 'Dashboard refreshed'), 'success');
            } catch (err) {
              UI.dismissToast();
              UI.toast((err && err.message) || I18n.t('common.error', 'Refresh failed'), 'error');
            }
          },
        }, '↻ ' + t('common.refresh', 'Refresh')),
      ]),
    ]),

    // ── v1.55.5 (UX-3) — hero: the 2 P0 CTAs + a focal recent hint ──
    heroBlock(),

    // ── 4 metric cards ────────────────────────────────────────────
    c('div', { className: 'card-row' }, [
      metric(t('dash.apps'), data.counts.applications, t('dash.tracker')),
      metric(t('dash.pipeline'), data.counts.pipeline, t('dash.pending')),
      metric(t('dash.reports'), data.counts.reports, t('dash.generated')),
      metric(t('dash.avgScore'), data.avgScore ?? '—', '/ 5.0', scoreClass(data.avgScore)),
    ]),

    // ── Quick actions (every sidebar item, grouped by purpose) ────
    c('section', { className: 'section' }, [
      c('h2', { className: 'section-title' }, t('dash.quick.title', 'Quick actions')),

      // U-5 (v1.58.25) — dropped the duplicate 'Scan all sources' card.
      // The Scan-now hero CTA already routes to /scan; carrying a
      // second tile in 'Search & Apply' was the 4× Scan duplication
      // the v1.58.3 QA flagged.
      qaGroup('dash.quick.searchApply', 'Search & Apply', [
        // UX-A15 (v1.58.63) — Pipeline is the highest-frequency action
        // by far; mark it primary so the eye lands here first.
        qa('📥', 'nav.pipeline', 'Pipeline', 'dash.quick.pipelineSub', `${data.counts.pipeline} pending URLs`, '/pipeline', true),
        qa('▶', 'dash.quick.evaluateCta', 'Evaluate a JD', 'dash.quick.evaluateSub', 'Anthropic-first scoring', '/evaluate'),
        qa('≡', 'nav.tracker', 'Tracker', 'dash.quick.trackerSub', `${data.counts.applications} applications`, '/tracker'),
      ]),

      qaGroup('dash.quick.researchPrep', 'Research & Prep', [
        qa('⌕', 'dash.quick.deepCta', 'Deep research', 'dash.quick.deepSub', 'Company intel via LLM', '/deep'),
        qa('🎯', 'dash.quick.interviewCta', 'Interview prep', 'dash.quick.interviewSub', 'Saved research', '/interview-prep'),
        qa('📈', 'dash.quick.patternsCta', 'Patterns', 'dash.quick.patternsSub', 'Analyze your wins', '/patterns'),
        qa('🔔', 'dash.quick.followupCta', 'Follow-up', 'dash.quick.followupSub', 'After-interview email', '/followup'),
      ]),

      qaGroup('dash.quick.promptBuilders', 'Prompt builders', [
        qa('💡', 'dash.quick.projectCta', 'Project ideas', 'dash.quick.projectSub', 'Tailor a portfolio', '/project'),
        qa('📚', 'dash.quick.trainingCta', 'Training plan', 'dash.quick.trainingSub', 'Skill gap → curriculum', '/training'),
        qa('📦', 'dash.quick.batchCta', 'Batch evaluate', 'dash.quick.batchSub', 'Multiple JDs at once', '/batch'),
        qa('✉️', 'dash.quick.contactoCta', 'Outreach', 'dash.quick.contactoSub', 'Recruiter / referral', '/contacto'),
      ]),

      qaGroup('dash.quick.workspace', 'Workspace', [
        qa('✎', 'dash.quick.cvCta', 'Edit CV', 'dash.quick.cvSub', 'cv.md side-by-side', '/cv'),
        qa('⚙', 'dash.quick.profileCta', 'Profile', 'dash.quick.profileSub', 'config/profile.yml', '/profile'),
        qa('🔧', 'dash.quick.configCta', 'App settings', 'dash.quick.configSub', 'API keys, host, port', '/config'),
        qa('▦', 'dash.quick.reportsCta', 'Reports', 'dash.quick.reportsSub', `${data.counts.reports} past evaluations`, '/reports'),
        qa('→', 'dash.quick.applyCta', 'Apply helper', 'dash.quick.applySub', 'Submission checklist', '/apply'),
        qa('🕘', 'dash.quick.activityCta', 'Activity log', 'dash.quick.activitySub', 'Audit trail', '/activity'),
      ]),

      qaGroup('dash.quick.system', 'System', [
        qa('❤', 'dash.quick.healthCta', 'Health', 'dash.quick.healthSub', 'System checks', '/health'),
        qa('📖', 'dash.quick.helpCta', 'Help', 'dash.quick.helpSub', 'In-app guide', '/help'),
      ]),
    ]),

    // ── Status breakdown ──────────────────────────────────────────
    c('section', { className: 'section' }, [
      c('h2', { className: 'section-title' }, t('dash.statuses')),
      c('div', { className: 'card' },
        c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap' } },
          Object.entries(data.byStatus).length === 0
            ? [c('div', { className: 'empty', style: { width: '100%' } }, t('common.empty'))]
            : Object.entries(data.byStatus).map(([s, n]) =>
                // v1.55.5 — UX-3: demoted from prominent badges to
                // compact chips so they don't compete with the hero.
                c('div', { className: 'dash-chip ' + statusClass(s) }, `${s} · ${n}`)
              )
        )
      ),
    ]),

    // ── Recent + Pipeline (existing 2-col grid) ───────────────────
    c('div', { className: 'grid-2 section' }, [
      c('div', null, [
        c('h2', { className: 'section-title' }, t('dash.recent')),
        recentTable(data.recent, scoreClass),
      ]),
      c('div', null, [
        c('h2', { className: 'section-title' }, t('dash.pipeline')),
        pipelineCard(data.pipeline),
      ]),
    ]),

    // ── Last report (existing) ────────────────────────────────────
    data.lastReport && c('section', { className: 'section' }, [
      c('h2', { className: 'section-title' }, t('dash.lastReport')),
      c('div', { className: 'card' }, [
        c('div', { className: 'flex-between' }, [
          c('div', null, [
            c('div', { style: { fontWeight: 700, fontSize: '17px' } }, data.lastReport.title || data.lastReport.slug),
            c('div', { className: 'flex gap-1', style: { marginTop: '6px' } }, [
              c('span', { className: 'tag' }, data.lastReport.date || ''),
              data.lastReport.legitimacy && c('span', { className: 'tag' }, data.lastReport.legitimacy),
              data.lastReport.scoreNum != null && c('span', { className: 'score-pill ' + scoreClass(data.lastReport.scoreNum) }, data.lastReport.score),
            ]),
          ]),
          c('button', { className: 'btn btn-ghost btn-sm', onClick: () => Router.go('/reports/' + data.lastReport.slug) }, t('common.open') + ' →'),
        ]),
      ]),
    ]),

    // ── System status card (live from /api/health) ────────────────
    health && c('section', { className: 'section' }, [
      c('h2', { className: 'section-title' }, t('dash.system.title', 'System status')),
      systemStatusCard(health, t),
    ]),
  ]);

  return root;
});

function metric(label, value, sub, cls) {
  const c = UI.el;
  return c('div', { className: 'card metric-card' }, [
    c('div', { className: 'metric-label' }, label),
    c('div', { className: 'metric-value ' + (cls || '') }, String(value)),
    c('div', { className: 'metric-sub' }, sub),
  ]);
}

function recentTable(rows, scoreClass) {
  const c = UI.el;
  const t = (k, f) => window.I18n.t(k, f);
  if (!rows.length) {
    return c('div', { className: 'empty' }, t('common.empty'));
  }
  const tbody = c('tbody', null,
    rows.map((r) => c('tr', null, [
      c('td', null, r.company || ''),
      c('td', null, r.role || ''),
      c('td', null,
        c('span', { className: 'score-pill ' + scoreClass(r.scoreNum) }, r.score || '—')
      ),
      c('td', null, c('span', { className: 'badge ' + statusClass(r.status) }, r.status || '')),
      c('td', null, r.date || ''),
    ]))
  );
  return c('div', { className: 'table-wrap' },
    c('table', { className: 'tbl' }, [
      c('thead', null, c('tr', null,
        [t('scan.col.company'), t('scan.col.role'), t('track.col.score', 'Score'), t('track.col.status'), t('track.col.date')].map((h) => c('th', null, h))
      )),
      tbody,
    ])
  );
}

function pipelineCard(urls) {
  const c = UI.el;
  const t = (k, f) => window.I18n.t(k, f);
  if (!urls.length) {
    return c('div', { className: 'empty' }, t('pipe.empty'));
  }
  return c('div', { className: 'card' },
    c('div', { className: 'flex', style: { flexDirection: 'column', alignItems: 'stretch', gap: '8px' } },
      urls.map((u) =>
        c('a', { href: u, target: '_blank', rel: 'noopener', className: 'tag', style: { padding: '8px 12px', fontSize: '13px', wordBreak: 'break-all' } }, u)
      )
    )
  );
}

function systemStatusCard(h, t) {
  const c = UI.el;
  // Surface 4 high-signal facts:
  //   - Required checks pass / total
  //   - Optional warnings count
  //   - Anthropic key set / unset
  //   - Gemini key set / unset
  const req = h.checks.filter((x) => x.required);
  const reqOk = req.filter((x) => x.ok).length;
  // v1.157.0 — "Live evals" readiness reflects ANY of the seven providers
  // (Anthropic / Gemini / OpenAI / Qwen / OpenRouter / GitHub Models / Hermes),
  // not just Anthropic/Gemini — so a user whose only key is e.g. OpenRouter no
  // longer sees a misleading "unset". Which engine would run is on /#/health.
  const PROVIDER_KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY', 'HERMES_API_KEY'];
  const liveReady = PROVIDER_KEYS.some((k) => h.checks.find((x) => x.name === k)?.ok === true);
  const tag = (label, value, ok) =>
    c('div', { className: 'badge ' + (ok ? 'badge-ok' : 'badge-warn') }, label + ' · ' + value);
  return c('div', { className: 'card' }, [
    c('div', { className: 'flex gap-3', style: { flexWrap: 'wrap', alignItems: 'center' } }, [
      tag(t('dash.system.required', 'Required'), `${reqOk}/${req.length}`, reqOk === req.length),
      tag(t('dash.system.warnings', 'Warnings'), String(h.warnings || 0), (h.warnings || 0) === 0),
      tag(t('dash.system.liveEvals', 'Live evals'), liveReady ? t('dash.system.ready', 'ready') : t('dash.system.manual', 'manual'), liveReady),
      c('div', { style: { marginLeft: 'auto' } },
        c('button', {
          className: 'btn btn-ghost btn-sm',
          onClick: () => window.Router.go('/health'),
        }, t('common.open', 'Open') + ' →')
      ),
    ]),
  ]);
}

function statusClass(s) {
  s = (s || '').toLowerCase();
  if (s.includes('offer')) return 'badge-ok';
  if (s.includes('reject') || s.includes('discard')) return 'badge-bad';
  if (s.includes('interview') || s.includes('respond')) return 'badge-info';
  if (s.includes('skip')) return 'badge-warn';
  return '';
}
