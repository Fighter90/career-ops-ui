/* global Router, API, UI, I18n */
Router.register('health', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  // CAR-121 — the view owns its stylesheet (public/css/v2-portals.css, the
  // v2-pipeline.css pattern): components.css sits at its 800-LOC gate limit
  // and index.html is shared across the parallel UX epics, so the link is
  // injected here instead, idempotently. Same-origin link — CSP-safe.
  if (!document.getElementById('v2-portals-css')) {
    document.head.appendChild(c('link', {
      id: 'v2-portals-css', rel: 'stylesheet', href: '/css/v2-portals.css',
    }));
  }

  const [data, providers] = await Promise.all([
    API.get('/api/health'),
    // CAR-121 — the success summary names the active provider; a failed
    // provider read must not take the whole page down.
    API.get('/api/status/providers').catch(() => null),
  ]);

  // CAR-121 — the flat card run put ~8 required checks next to ~20 optional
  // provider keys with orange "OPTIONAL" badges: a working Hermes setup read
  // like an outage. Required checks stay prominent; the optional ones (ok or
  // merely unset) collapse into one <details> section, and orange is reserved
  // for real (required) failures.
  const checksOk = Array.isArray(data.checks);
  const checks = checksOk ? data.checks : [];
  const requiredChecks = checks.filter((ch) => ch.required !== false);
  const optionalChecks = checks.filter((ch) => ch.required === false);
  const requiredBad = requiredChecks.filter((ch) => !ch.ok);
  const optionalMissing = optionalChecks.filter((ch) => !ch.ok).length;

  // UX-A13 (v1.58.59) — actionable "Fix" CTA on failing rows. The
  // 21 rows previously showed status only; the user had to guess
  // where to go to fix `Profile customized` / `ANTHROPIC_API_KEY` /
  // etc. This map links failing/optional checks to the right config
  // tab. Unmapped failures (e.g. parent project structural ones the
  // user can't fix from the UI) stay action-less to avoid leading the
  // user to a dead end.
  const FIX_TARGETS = {
    'Profile customized':         '#/config?tab=profile',
    'config/profile.yml':         '#/config?tab=profile',
    'cv.md':                      '#/cv',
    'portals.yml':                '#/portals',
    'data/applications.md':       '#/tracker',
  };
  function resolveFixUrl(ch) {
    if (ch.ok) return null;
    if (FIX_TARGETS[ch.name]) return FIX_TARGETS[ch.name];
    if (/_API_KEY$/.test(ch.name)) return '#/config?tab=api-keys';
    if (/^LLM_PROVIDER/.test(ch.name)) return '#/config?tab=api-keys';
    return null;
  }

  // WS2 #36 — a flat run of generic divs gave SR users no name↔status
  // relationship. Render as a list; the badge carries an aria-label
  // pairing the check name with its pass/fail state.
  // CAR-121 — one shared row renderer for BOTH sections, so every row
  // (required and optional) keeps the same value line, badge and Fix → hint.
  function checkRow(ch) {
    let badgeClass, badgeText;
    if (ch.ok) {
      badgeClass = 'badge-ok'; badgeText = t('health.badgeOk');
    } else if (ch.required === false) {
      // A merely-unset optional key is not a problem — neutral badge.
      badgeClass = 'badge'; badgeText = t('health.badgeOptional');
    } else {
      badgeClass = 'badge-bad'; badgeText = t('health.badgeFail');
    }
    const fixUrl = resolveFixUrl(ch);
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
  }

  // CAR-121 — the green summary renders ONLY when the payload is well-formed,
  // the required list is non-empty, and nothing required is failing: an
  // empty/malformed payload trivially has zero failures and must never read
  // as "all clear" (review finding 6). Failures keep the page honest (the
  // red rows below are the summary).
  const allRequiredOk = checksOk
    && requiredChecks.length > 0
    && requiredBad.length === 0;
  let providerSummary = null;
  if (providers && providers.activeProvider) {
    // function replacers (review finding 10): provider/model come from
    // config/env — a value like "$&" must not act as a replace pattern.
    providerSummary = providers.activeModel
      ? t('health.activeProvider', 'Active provider: {provider} ({model})')
        .replace('{provider}', () => providers.activeProvider)
        .replace('{model}', () => providers.activeModel)
      : t('health.activeProviderNoModel', 'Active provider: {provider}')
        .replace('{provider}', () => providers.activeProvider);
  }

  const optionalListStyle = { listStyle: 'none', margin: '10px 0 0', padding: 0 };

  const body = [];
  if (!checksOk) {
    // malformed payload → an explicit, announced error state (never green).
    body.push(c('div', { className: 'empty', role: 'alert', style: { marginTop: '16px' } },
      t('health.checksUnavailable', 'Health data is unavailable or malformed — run the doctor and reload.')));
  } else {
    body.push(allRequiredOk ? c('div', { className: 'v2-portals-health-ok', role: 'status' }, [
      '✓ ' + t('health.allOk', 'All required checks pass'),
      providerSummary ? c('span', { style: { fontWeight: '400', color: 'var(--foggy)' } }, '· ' + providerSummary) : null,
    ]) : null);

    // Required checks — prominent, uncollapsed.
    body.push(c('ul', { className: 'card-row', role: 'list', style: { listStyle: 'none', margin: 0, padding: 0 } },
      requiredChecks.map(checkRow)
    ));

    // CAR-121 — optional keys (provider keys, deps, directories) collapse
    // into one quiet section: <summary> carries the accessible name, so no
    // extra aria wiring is needed. Collapsed content stays in the DOM.
    body.push(c('details', { className: 'v2-portals-optional' }, [
      c('summary', null, optionalMissing > 0
        ? t('health.optionalCollapsed', '{count} optional checks not configured (optional)')
          .replace('{count}', String(optionalMissing))
        : t('health.optionalOk', 'Optional checks — all configured')),
      c('ul', { className: 'card-row', role: 'list', style: optionalListStyle },
        optionalChecks.map(checkRow)
      ),
    ]));
  }

  // FULL-R5 (review 1) — the guarded body[] tree IS the tree. The return
  // used to hand-duplicate the summary/required-list/<details> blocks and
  // ignore checksOk, so a malformed payload rendered empty cards with no
  // alert — the CAR-121 "never read as all-clear" contract was advertised
  // but never shipped. One tree, built once above.
  const header = c('header', { className: 'page-header' }, [
    c('div', null, [
      c('h1', { className: 'page-title' }, t('health.title')),
      data && data.version ? c('p', { className: 'page-subtitle' }, `career-ops-ui v${data.version}`) : null,
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
  ]);

  return c('div', null, [header, ...body]);
});
