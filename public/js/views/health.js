/* global Router, API, UI, I18n */
Router.register('health', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const data = await API.get('/api/health');

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        c('h1', { className: 'page-title' }, t('health.title')),
        c('p', { className: 'page-subtitle' }, `career-ops v${data.version}`),
      ]),
      c('div', { className: 'flex gap-3' }, [
        // CAR-21 (v1.243.0) — both run buttons were async handlers without a
        // catch: a failed run rejected unhandled, the "Running…" toast stayed
        // up, and nothing told the user. Wrapped + surfaced; the progress
        // toast is cleared on the failure path too.
        c('button', { className: 'btn btn-ghost', onClick: async (e) => {
          UI.toast(t('health.runningDoctor', 'Running doctor.mjs…'));
          try {
            const r = await UI.withSpinner(e.currentTarget, () => API.post('/api/run/doctor'));
            // QA BUG-007: clear the progress toast so it can't linger over
            // the result modal. QA BUG-008: the title reuses the button's
            // localized label so its casing always matches the button.
            UI.dismissToast();
            UI.modal(t('health.runDoctor'), UI.el('pre', { className: 'console' }, (r.stdout || '') + (r.stderr ? '\n' + r.stderr : '')));
          } catch (err) {
            UI.dismissToast();
            UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
          }
        }}, t('health.runDoctor')),
        c('button', { className: 'btn btn-ghost', onClick: async (e) => {
          UI.toast(t('health.runningVerify', 'Running verify-pipeline.mjs…'));
          try {
            const r = await UI.withSpinner(e.currentTarget, () => API.post('/api/run/verify'));
            UI.dismissToast();
            // U-7 (v1.58.27) — verify-pipeline.mjs prints
            // `==================================================` ASCII
            // dividers between sections. In a fixed-width 14px font the
            // 50-char run pushes the modal body wider than the rest of
            // the SPA needs. Strip lines that are entirely ≥10 `=` chars
            // before rendering; the remaining whitespace already
            // separates sections visually.
            const stripped = ((r.stdout || '') + (r.stderr ? '\n' + r.stderr : ''))
              .replace(/^={10,}$/gm, '');
            UI.modal(t('health.verify'), UI.el('pre', { className: 'console' }, stripped));
          } catch (err) {
            UI.dismissToast();
            UI.toast((err && err.message) || t('common.error', 'Error'), 'error');
          }
        }}, t('health.verify')),
      ]),
    ]),

    // UX-A13 (v1.58.59) — actionable "Fix" CTA on failing rows. The
    // 21 rows previously showed status only; the user had to guess
    // where to go to fix `Profile customized` / `ANTHROPIC_API_KEY` /
    // etc. This map links failing/optional checks to the right config
    // tab. Unmapped failures (e.g. parent project structural ones the
    // user can't fix from the UI) stay action-less to avoid leading the
    // user to a dead end.
    // WS2 #36 — a flat run of generic divs gave SR users no name↔status
    // relationship. Render as a list; the badge carries an aria-label
    // pairing the check name with its pass/fail state.
    c('ul', { className: 'card-row', role: 'list', style: { listStyle: 'none', margin: 0, padding: 0 } },
      data.checks.map((ch) => {
        let badgeClass, badgeText;
        if (ch.ok) {
          badgeClass = 'badge-ok'; badgeText = t('health.badgeOk');
        } else if (ch.required === false) {
          badgeClass = 'badge-warn'; badgeText = t('health.badgeOptional');
        } else {
          badgeClass = 'badge-bad'; badgeText = t('health.badgeFail');
        }
        // Map failing/optional rows to their config tab. Key match is
        // exact on `ch.name` plus a tolerant substring fallback for
        // *_API_KEY variants. CAR-21 (v1.243.0): the keys MUST be the
        // exact names server/lib/routes/health.mjs pushes — 'cv.md
        // non-empty' and 'portals.yml present' matched nothing, so those
        // two rows silently lost their Fix link. 'portals.yml' now aims
        // at the real #/portals view (the old '#/config?tab=portals'
        // hash matches no tab and landed on API keys).
        const FIX_TARGETS = {
          'Profile customized':         '#/config?tab=profile',
          'config/profile.yml':         '#/config?tab=profile',
          'cv.md':                      '#/cv',
          'portals.yml':                '#/portals',
          'data/applications.md':       '#/tracker',
        };
        let fixUrl = null;
        if (!ch.ok) {
          if (FIX_TARGETS[ch.name]) fixUrl = FIX_TARGETS[ch.name];
          else if (/_API_KEY$/.test(ch.name)) fixUrl = '#/config?tab=api-keys';
          else if (/^LLM_PROVIDER/.test(ch.name)) fixUrl = '#/config?tab=api-keys';
        }
        return c('li', { className: 'card' }, [
          c('div', { className: 'flex-between health-check-row' }, [
            c('div', null, [
              c('div', { className: 'metric-label' }, ch.name),
              // CAR-56 #4 (v1.247.0) — was word-break: break-all, which cut
              // ordinary words mid-letter («"Run" butt ons)»). overflow-wrap:
              // anywhere still folds a pathological long token (a URL) but
              // leaves normal words whole.
              ch.value && c('div', { style: { fontSize: '13px', color: 'var(--foggy)', marginTop: '6px', overflowWrap: 'anywhere' } }, ch.value),
            ]),
            c('div', { className: 'flex gap-3', style: { alignItems: 'center' } }, [
              fixUrl ? c('a', {
                className: 'btn btn-ghost btn-sm health-fix',
                href: fixUrl,
                'aria-label': t('health.fixAria', 'Fix this') + ': ' + ch.name,
              }, t('health.fix', 'Fix →')) : null,
              c('span', { className: 'badge ' + badgeClass, 'aria-label': ch.name + ': ' + badgeText }, badgeText),
            ]),
          ]),
        ]);
      })
    ),
  ]);
});
