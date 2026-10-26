/* global Router, API, UI, I18n, TrackerStages */

// ── CAR-114 shared helpers (module scope — used by the route AND by the
//    module-level metric() renderer; browser-only, CSP-safe DOM only) ────────

// Numbers with locale separators in EVERY UI locale (acceptance: "30 358",
// not "30358"). The active UI locale drives the grouping separators.
function fmtNum(n) {
  if (typeof n !== 'number' || !isFinite(n)) return String(n ?? '—');
  try {
    return new Intl.NumberFormat(I18n.getLang(), { maximumFractionDigits: 2 }).format(n);
  } catch { return String(n); }
}

// CAR-114 — count-up on first paint (600 ms, ease-out). Reduced motion ⇒
// static value, no animation loop is ever scheduled.
function countUp(el, target, fmt) {
  const reduced = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { el.textContent = fmt(target); return; }
  const t0 = performance.now();
  const DUR = 600;
  function frame(now) {
    const p = Math.min(1, (now - t0) / DUR);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(target * eased);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// CAR-114 — KPI trend delta. /api/dashboard ships no history (inventing an
// endpoint is out of scope), so the delta compares against a client-side
// snapshot of the PREVIOUS dashboard load. First visit ⇒ no snapshot ⇒ the
// tiles render with NO trend rather than a fake one.
const DASH_SNAP_KEY = 'career-ops-ui:dash-snapshot';
function trendDelta(key, value) {
  if (typeof value !== 'number') return null;
  try {
    const raw = localStorage.getItem(DASH_SNAP_KEY);
    if (!raw) return null;
    const prev = JSON.parse(raw);
    const p = prev && prev[key];
    if (typeof p !== 'number' || p === value) return null;
    return +(value - p).toFixed(2);
  } catch { return null; }
}

// CAR-114 i18n: EN "vs your previous visit" — trend-chip tooltip
// (fan-out ×19 pending; see PR report).
const DASH_TREND_HINT = 'vs your previous visit';

function deltaChip(d) {
  const c = UI.el;
  if (d == null) return null;
  const up = d > 0;
  return c('span', {
    className: 'v2-dash-delta ' + (up ? 'v2-dash-delta--up' : 'v2-dash-delta--down'),
    title: DASH_TREND_HINT,
  }, (up ? '▲ +' : '▼ −') + fmtNum(Math.abs(d)));
}

// CAR-114 — metric card: Intl-formatted value, 600 ms count-up on first
// paint, and an optional trend delta chip (null ⇒ no trend — first visit
// or an unchanged counter never renders a fake delta).
function metric(label, value, sub, cls, numericSub, delta) {
  const c = UI.el;
  const valEl = c('div', { className: 'metric-value ' + (cls || '') },
    typeof value === 'number' ? fmtNum(0) : String(value));
  if (typeof value === 'number') countUp(valEl, value, fmtNum);
  return c('div', { className: 'card metric-card' }, [
    c('div', { className: 'metric-label' }, label),
    valEl,
    deltaChip(delta),
    // CAR-58 (v1.246.0) — a numeric unit ("/ 5.0") is a bidi composition: in an
    // RTL locale it rendered "5.0 /". Isolate it LTR (prose subs pass no flag).
    c('div', { className: 'metric-sub', ...(numericSub ? { dir: 'ltr' } : {}) }, sub),
  ]);
}

// CAR-93 — dashboard Refresh re-runs the route via Router.render() WITHOUT
// a hashchange, so per-visit window listeners stacked one set per re-render.
// The v1.58 provider chip (the original owner of this handle) was removed by
// CAR-114 — the global header badge owns provider status — and the handle now
// guards the CAR-114 parallax hero listeners instead: same discipline, new
// owner (see tests/car93-spa-unit.test.mjs F6).
let __dashV2Cleanup = null;

Router.register('dashboard', async () => {
  // Pull dashboard data, live health and the canonical stage map in parallel —
  // the funnel (CAR-114) folds the byStatus counts through GET /api/tracker/stages
  // (labels in canonical order + the alias-fold map). All three are existing
  // endpoints; a stages miss fail-softs to raw-status chips, never a broken page.
  const [data, health, stagesInfo] = await Promise.all([
    API.get('/api/dashboard'),
    API.get('/api/health').catch(() => null),
    API.get('/api/tracker/stages').catch(() => null),
  ]);
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);

  function scoreClass(n) {
    if (n == null) return '';
    if (n >= 4.0) return 'score-high';
    if (n >= 3.0) return 'score-mid';
    return 'score-low';
  }

  // Persist the snapshot for the NEXT visit's trend deltas (called at the
  // very end of the route, after this visit's deltas were computed).
  function saveSnapshot() {
    try {
      localStorage.setItem(DASH_SNAP_KEY, JSON.stringify({
        ts: Date.now(),
        applications: data.counts.applications,
        pipeline: data.counts.pipeline,
        reports: data.counts.reports,
        avgScore: data.avgScore ?? null,
      }));
    } catch { /* storage unavailable → trends simply never appear */ }
  }

  // Compact "quick action" tile. Renders an icon + label + sub-label.
  // Click goes to `route`. Each tile is keyboard-focusable for a11y.
  // UX-A15 (v1.58.63) — optional `primary` flag adds a stronger visual
  // weight (larger icon + bolder label) to the most-used tile (Pipeline)
  // so the user's eye lands on the highest-frequency action first.
  // CAR-20 (v1.243.0) — the sub-labels were supposed to carry live
  // counts ("3 pending URLs"), but the count only ever lived in the
  // FALLBACK string, which the dict translation overrides — so no
  // locale ever showed one. The counts now come from the dashboard
  // payload itself, keyed by tile route, and are appended to whatever
  // the dict provides.
  const QA_COUNTS = {
    '/pipeline': data.counts.pipeline,
    '/tracker': data.counts.applications,
    '/reports': data.counts.reports,
  };
  function qa(icon, labelKey, labelFallback, subKey, subFallback, route, primary) {
    const count = QA_COUNTS[route];
    const sub = t(subKey, subFallback) + (count != null ? ' · ' + count : '');
    return c('button', {
      className: 'qa-tile' + (primary ? ' qa-tile--primary' : ''),
      onClick: () => Router.go(route),
      title: route,
    }, [
      c('span', { className: 'qa-icon' }, icon),
      c('span', { className: 'qa-body' }, [
        c('span', { className: 'qa-label' }, t(labelKey, labelFallback)),
        c('span', { className: 'qa-sub' }, sub),
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

  // ── CAR-114 — parallax hero planes ────────────────────────────────────────
  // 2–3 glass planes drift ≤ 16 px against pointer position / page scroll.
  // prefers-reduced-motion ⇒ NO listeners are attached and the planes stay
  // static (the CSS layer neutralizes transitions too). Listeners are scoped
  // to the route lifetime via the module-scoped __dashV2Cleanup handle
  // (CAR-93 discipline — Refresh re-renders must never stack them).
  function mountParallax(hero) {
    const reduced = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const planes = hero.querySelectorAll('.v2-dash-plane');
    if (!planes.length) return;
    let raf = 0;
    const clamp = (v) => Math.max(-16, Math.min(16, v));
    const apply = (dx, dy) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        planes.forEach((p, i) => {
          const depth = (i + 1) * 4; // 4 / 8 / 12 px of depth per plane
          p.style.transform = 'translate3d(' + clamp(dx * depth / 16) + 'px,'
            + clamp(dy * depth / 16) + 'px,0)';
        });
      });
    };
    const onPointer = (e) => {
      const r = hero.getBoundingClientRect();
      apply(((e.clientX - r.left) / r.width - 0.5) * 16,
        ((e.clientY - r.top) / r.height - 0.5) * 16);
    };
    const onLeave = () => apply(0, 0);
    const onScroll = () => apply(0, Math.min(16, window.scrollY / 40));
    hero.addEventListener('pointermove', onPointer);
    hero.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    // M-1 / CAR-93 — tear down on route change AND before the next mount
    // (Refresh re-renders with NO hashchange).
    if (typeof __dashV2Cleanup === 'function') __dashV2Cleanup();
    const detach = () => {
      hero.removeEventListener('pointermove', onPointer);
      hero.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('hashchange', onHash);
    };
    const onHash = () => {
      if (!location.hash.startsWith('#/dashboard')) detach();
    };
    window.addEventListener('hashchange', onHash);
    __dashV2Cleanup = detach;
  }

  // ── CAR-114 — hero: ONE primary CTA (split control), greeting, focal hint ─
  // v1.55.5 shipped two identical red hero buttons — the UX review (CAR-114)
  // called the hierarchy out: nothing read as primary. The split control keeps
  // BOTH journeys one click away — "🌐 Scan now" is the primary segment
  // (aria-current), "✨ Auto-pipeline a URL" the ghost segment — and the
  // provider chip is gone (the global header badge owns provider status).
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
    // CAR-114 i18n: EN "Welcome back — here's where your search stands."
    // (fan-out ×19 pending; see PR report).
    const GREETING = 'Welcome back — here\u2019s where your search stands.';
    // Presentation note: overlays.css sits at the 800-LOC ceiling, so the
    // hero's structural styling is inline here (this view's established
    // pattern); only the blur-plane base + reduced-motion rules are CSS.
    // The planes wrapper is absolutely positioned and precedes the inner
    // block in DOM order, so the relative-positioned content paints above
    // without any z-index (the D-4 no-magic-numbers gate).
    const PLANE = (grad, pos) => c('div', {
      className: 'v2-dash-plane',
      style: { background: grad, ...pos },
    });
    const hero = c('section', {
      className: 'dash-hero',
      style: { position: 'relative', overflow: 'hidden', isolation: 'isolate' },
    }, [
      c('div', { className: 'v2-dash-planes', 'aria-hidden': 'true' }, [
        PLANE('radial-gradient(closest-side, color-mix(in srgb, var(--rausch) 10%, transparent), transparent 72%)',
          { top: '-35%', right: '-8%', width: '46%', height: '140%' }),
        PLANE('radial-gradient(closest-side, color-mix(in srgb, var(--babu) 9%, transparent), transparent 70%)',
          { bottom: '-45%', left: '18%', width: '52%', height: '120%' }),
        PLANE('radial-gradient(closest-side, color-mix(in srgb, var(--darjeeling) 7%, transparent), transparent 68%)',
          { top: '-10%', left: '-12%', width: '34%', height: '90%' }),
      ]),
      c('div', { className: 'v2-dash-hero-inner', style: { position: 'relative' } }, [
        c('p', {
          className: 'v2-dash-greeting',
          style: { margin: '0 0 var(--space-2)', color: 'var(--foggy-strong)', fontSize: 'var(--font-size-base)' },
        }, GREETING),
        c('div', {
          className: 'v2-dash-split',
          role: 'group',
          'aria-label': t('dash.quick.searchApply', 'Search & Apply'),
          style: { display: 'inline-flex', flexWrap: 'wrap', gap: '8px', maxWidth: '100%' },
        }, [
          c('button', {
            className: 'btn btn-primary btn-hero',
            'aria-current': 'true',
            onClick: () => Router.go('/scan'),
          }, '🌐 ' + t('dash.scanNow', 'Scan now')),
          c('button', {
            className: 'btn btn-ghost btn-hero v2-dash-split-seg',
            onClick: () => Router.go('/auto'),
          }, '✨ ' + t('dash.autoPipeline', 'Auto-pipeline a URL')),
        ]),
        focal,
      ]),
    ]);
    hero.classList.add('v2-dash-hero');
    mountParallax(hero);
    return hero;
  }

  // ── CAR-114 — status funnel ───────────────────────────────────────────────
  // The review's headline insight: 486 applications ALL in Evaluated — the
  // funnel makes the stall visible at a glance. Counts are REAL: the
  // dashboard's byStatus map folded through the server's canonical stage
  // map (never a client-side whitelist — v1.128.0 doctrine). Conversions
  // between adjacent steps; zero-count stages render muted so the full
  // canonical funnel stays visible.
  function funnelSection() {
    const stages = (stagesInfo && Array.isArray(stagesInfo.stages)) ? stagesInfo.stages : [];
    const aliases = (stagesInfo && stagesInfo.aliases) || {};
    const fold = (s) => (window.TrackerStages
      ? TrackerStages.foldStatus(s, aliases) : String(s || ''));

    // Fold byStatus into canonical stage counts; anything that folds outside
    // the canonical set stays visible as a raw chip (data never disappears).
    const folded = {};
    for (const [s, n] of Object.entries(data.byStatus || {})) {
      const k = fold(s);
      folded[k] = (folded[k] || 0) + n;
    }

    // Localized display label — same composition as #/tracker (the canonical
    // value stays canonical everywhere it is DATA).
    const statusLabel = (s) => {
      const key = 'track.status.' + String(s || '').toLowerCase();
      return t(key, s || '');
    };

    const steps = [{ label: t('nav.pipeline', 'Pipeline'), n: data.counts.pipeline || 0 }]
      .concat(stages.map((s) => ({ label: statusLabel(s), n: folded[s] || 0 })));
    const max = Math.max(1, ...steps.map((s) => s.n));
    const evaluated = folded['Evaluated'] || 0;
    const applied = folded['Applied'] || 0;

    const strip = c('ol', {
      className: 'v2-dash-funnel',
      style: {
        listStyle: 'none', margin: '0', padding: '0',
        display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3) var(--space-4)',
      },
    },
      steps.map((st, i) => {
        const pct = st.n > 0 ? Math.max(6, Math.round((st.n / max) * 100)) : 0;
        const prev = i > 0 ? steps[i - 1].n : null;
        const conv = (prev != null && prev > 0 && st.n > 0)
          ? Math.round((st.n / prev) * 100) + '%'
          : '—';
        return c('li', {
          className: 'v2-dash-fstep' + (st.n === 0 ? ' v2-dash-fstep--zero' : ''),
          style: {
            flex: '1 1 96px', minWidth: '96px',
            display: 'flex', flexDirection: 'column', gap: '2px',
            padding: 'var(--space-2) var(--space-3)',
            border: '1px solid var(--slate)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--paper)',
            ...(st.n === 0 ? { opacity: '.62' } : {}),
          },
        }, [
          i > 0 ? c('span', {
            className: 'v2-dash-fconv', 'aria-hidden': 'true',
            style: {
              alignSelf: 'center', color: 'var(--foggy-strong)',
              fontSize: 'var(--font-size-sm)', fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            },
          }, '→ ' + conv) : null,
          c('span', {
            className: 'v2-dash-fstep-label',
            style: {
              color: 'var(--foggy-strong)', fontSize: 'var(--font-size-md)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            },
          }, st.label),
          c('span', {
            className: 'v2-dash-fstep-n',
            style: {
              color: 'var(--hof)', fontSize: 'var(--font-size-xl)',
              fontWeight: '700', fontVariantNumeric: 'tabular-nums',
            },
          }, fmtNum(st.n)),
          c('span', {
            className: 'v2-dash-fstep-bar', 'aria-hidden': 'true',
            style: {
              height: '6px', borderRadius: 'var(--radius-pill)',
              background: 'var(--elev)', overflow: 'hidden',
            },
          },
            c('span', {
              className: 'v2-dash-fstep-fill',
              style: {
                display: 'block', height: '100%', borderRadius: 'inherit',
                background: st.n > 0 ? 'var(--rausch-fill)' : 'var(--slate)',
                transition: 'width var(--transition)',
                width: pct + '%',
              },
            })),
        ]);
      }));

    // The one action the funnel should trigger when the process stalls after
    // evaluation (the review's exact scenario).
    // CAR-114 i18n: EN "evaluated · not applied yet — review the top-scored"
    // (fan-out ×19 pending; see PR report).
    const FUNNEL_CTA = 'evaluated · not applied yet — review the top-scored';
    const funnelCta = (evaluated > 0 && applied === 0)
      ? c('a', {
          className: 'btn btn-ghost btn-sm v2-dash-funnel-cta',
          href: '#/tracker',
          style: { marginTop: 'var(--space-3)', display: 'inline-block' },
        }, fmtNum(evaluated) + ' ' + FUNNEL_CTA + ' →')
      : null;

    // Screen-reader summary (the strip itself is spatial/decorative).
    // CAR-114 i18n: EN "Status funnel: N applications across the pipeline stages."
    const FUNNEL_SUMMARY = 'Status funnel: {n} applications across the pipeline stages.';
    const summary = c('p', { className: 'visually-hidden' },
      FUNNEL_SUMMARY.replace('{n}', fmtNum(data.counts.applications)));

    // Raw statuses that folded outside the canonical set stay as chips —
    // never silently dropped by the fold.
    const known = new Set(stages);
    const unknownChips = Object.entries(folded)
      .filter(([k, n]) => n > 0 && !known.has(k))
      .map(([s, n]) => c('div', { className: 'dash-chip ' + statusClass(s) }, `${s} · ${n}`));

    return c('section', { className: 'section v2-dash-funnel-sec' }, [
      c('h2', { className: 'section-title' }, t('dash.statuses', 'Application statuses')),
      c('div', {
        className: 'card v2-dash-funnel-card',
        style: { padding: 'var(--space-4)' },
      }, [
        summary,
        strip,
        unknownChips.length ? c('div', {
          className: 'flex gap-3',
          style: { flexWrap: 'wrap', marginTop: '10px' },
        }, unknownChips) : null,
        funnelCta,
      ]),
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
    // CAR-58 #4 (v1.247.0) — the warning surface moved to the shared
    // .callout--warn tokens (components.css); overlays.css keeps the banner's
    // geometry but no longer hardcodes a light-only yellow.
    return c('div', {
      className: 'hero-banner hero-banner--warning callout callout--warn',
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
                // CAR-20 (v1.243.0) — the old Router.go to our own hash
                // was a no-op: same hash → no hashchange → no re-render,
                // so the counters never moved. The router's render()
                // re-runs the handler regardless.
                Router.render();
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

    // ── CAR-114 — hero: greeting + the ONE primary split CTA + focal hint ──
    heroBlock(),

    // ── CAR-114 — status funnel (real counts + conversions) ──────────────
    funnelSection(),

    // ── 4 metric cards — Intl separators, count-up, trend delta ──────────
    c('div', { className: 'card-row' }, [
      metric(t('dash.apps'), data.counts.applications, t('dash.tracker'),
        '', false, trendDelta('applications', data.counts.applications)),
      metric(t('dash.pipeline'), data.counts.pipeline, t('dash.pending'),
        '', false, trendDelta('pipeline', data.counts.pipeline)),
      metric(t('dash.reports'), data.counts.reports, t('dash.generated'),
        '', false, trendDelta('reports', data.counts.reports)),
      metric(t('dash.avgScore'), data.avgScore ?? '—', '/ 5.0', scoreClass(data.avgScore), true,
        trendDelta('avgScore', data.avgScore)),
    ]),

    // ── Quick actions (every sidebar item, grouped by purpose) ────────────
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
        qa('▶', 'dash.quick.evaluateCta', 'Evaluate a JD', 'dash.quick.evaluateSub', '0–5 fit scoring', '/evaluate'),
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

    // ── Recent + Pipeline (existing 2-col grid) ───────────────────────────
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

    // ── Last report (existing) ────────────────────────────────────────────
    data.lastReport && c('section', { className: 'section' }, [
      c('h2', { className: 'section-title' }, t('dash.lastReport')),
      c('div', { className: 'card' }, [
        c('div', { className: 'flex-between' }, [
          c('div', null, [
            c('div', { className: 'card-value', style: { fontWeight: 700, marginTop: 0 } }, data.lastReport.title || data.lastReport.slug),
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

    // ── System status card (live from /api/health) ────────────────────────
    health && c('section', { className: 'section' }, [
      c('h2', { className: 'section-title' }, t('dash.system.title', 'System status')),
      systemStatusCard(health, t),
    ]),
  ]);

  saveSnapshot();
  return root;
});

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
  // CAR-20 (v1.243.0) — pipeline.md rows may be `local:jds/<file>`
  // references (parsePipeline deliberately passes them through). They
  // rendered as <a href="local:…"> — a scheme the browser can't
  // navigate, i.e. a dead link that looked clickable. Only genuine
  // http(s) URLs become anchors; everything else is a plain tag.
  const isHttp = (u) => /^https?:\/\//i.test(u);
  return c('div', { className: 'card' },
    c('div', { className: 'flex', style: { flexDirection: 'column', alignItems: 'stretch', gap: '8px' } },
      urls.map((u) =>
        isHttp(u)
          ? c('a', { href: u, target: '_blank', rel: 'noopener', className: 'tag', style: { padding: '8px 12px', fontSize: '13px', wordBreak: 'break-all' } }, u)
          : c('span', { className: 'tag', style: { padding: '8px 12px', fontSize: '13px', wordBreak: 'break-all', cursor: 'default' } }, u)
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
