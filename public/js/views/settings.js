/* global Router, API, UI, I18n */
// Route is now `profile` (was `settings` until v1.10.0). The router
// aliases the old `settings` hash so existing bookmarks keep working.
Router.register('profile', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const data = await API.get('/api/profile');
  const profile = data.profile;

  if (!profile) {
    return c('div', null, [
      c('header', { className: 'page-header' }, [c('div', null, [c('h1', { className: 'page-title' }, t('set.title'))])]),
      c('div', { className: 'empty' }, t('set.notFound')),
    ]);
  }

  // G-009 (v1.15.0): consume the server-side summary which accepts both
  // legacy (candidate:{...}) and canonical (top-level full_name / location /
  // narrative.headline) schemas. Legacy wins when both shapes are present.
  // Falls back to the old in-place parsing on older servers.
  const summary = data.summary || (function legacyFallback() {
    const cand = profile.candidate || {};
    const targets = profile.target_roles || {};
    const target = profile.target || {};
    return {
      full_name: cand.full_name || profile.full_name || null,
      email:     cand.email     || profile.email     || null,
      linkedin:  cand.linkedin  || profile.linkedin  || null,
      location:  cand.location  || profile.location  || null,
      headline:  cand.headline  || profile.narrative?.headline || null,
      target_roles: target.roles || targets.primary || [],
      archetypes:   target.archetypes || [],
    };
  }());
  const archetypes = summary.archetypes || (profile.target_roles?.archetypes) || [];

  function info(k, v) {
    return c('div', { className: 'card' }, [
      c('div', { className: 'metric-label' }, k),
      c('div', { style: { fontSize: '17px', fontWeight: 600, marginTop: '6px' } },
        v || c('span', { style: { color: 'var(--foggy)', fontWeight: 400 } },
                       t('profile.missing', '— not set'))),
    ]);
  }

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        c('h1', { className: 'page-title' }, t('set.title')),
        c('p', { className: 'page-subtitle' }, t('set.subtitle')),
      ]),
    ]),

    c('div', { className: 'card-row' }, [
      info(t('set.name'), summary.full_name),
      info(t('set.email'), summary.email),
      info(t('set.location'), summary.location),
      info(t('set.linkedin', 'LinkedIn'), summary.linkedin),
    ]),

    // G-009: surface the narrative.headline — used by cover-letter and
    // outreach generation but invisible to users before v1.15.0.
    summary.headline ? c('section', { className: 'section' }, [
      c('h2', { className: 'section-title' }, t('profile.headline', 'Headline')),
      c('div', { className: 'card' }, [
        c('p', { style: { fontSize: '15px', lineHeight: '1.5', margin: 0 } }, summary.headline),
      ]),
    ]) : null,

    // G-008 (v1.15.0): surface the existence of modes/_profile.md, the
    // canonical "Career framing" file (Quick Start §Step-5). Until now
    // the UI had no pointer to it and users discovered it only via
    // career-ops.org docs.
    c('section', { className: 'section' }, [
      c('h2', { className: 'section-title' }, t('profile.framingTitle', 'Career framing')),
      c('div', { className: 'card' }, [
        c('p', { style: { color: 'var(--foggy)', fontSize: '14px', margin: '0 0 12px' } },
          t('profile.framingHint',
            "modes/_profile.md is the canonical career-framing file (target roles, framing, exit narrative, comp targets, location policy). Never committed. Read by every evaluation, deep-research, and outreach prompt.")),
        c('a', { href: '#/config?tab=modes', className: 'btn btn-primary btn-sm' },
          '✎ ' + t('profile.editModes', 'Edit in App settings → Modes')),
      ]),
    ]),

    c('section', { className: 'section' }, [
      c('h2', { className: 'section-title' }, t('set.targetRoles')),
      c('div', { className: 'card' }, [
        c('div', { className: 'flex', style: { flexWrap: 'wrap', gap: '8px' } },
          (summary.target_roles || []).map((r) => c('span', { className: 'tag', style: { fontSize: '13px' } }, r))
        ),
      ]),
    ]),

    c('section', { className: 'section' }, [
      c('h2', { className: 'section-title' }, t('set.archetypes')),
      c('div', { className: 'card-row' },
        archetypes.map((a) => c('div', { className: 'card' }, [
          c('div', { style: { fontWeight: 700 } }, a.name),
          c('div', { className: 'flex gap-1 mt-3' }, [
            // WS2 #34 — were two bare ambiguous chips; prefix each with
            // what it means (and an aria-label) so it's self-describing.
            a.fit ? c('span', { className: 'tag', 'aria-label': t('set.fit', 'Fit') + ': ' + a.fit },
              t('set.fit', 'Fit') + ': ' + a.fit) : null,
            a.level ? c('span', { className: 'tag', 'aria-label': t('set.level', 'Level') + ': ' + a.level },
              t('set.level', 'Level') + ': ' + a.level) : null,
          ]),
          c('p', { style: { color: 'var(--foggy)', fontSize: '13.5px', marginTop: '8px' } }, a.notes || ''),
        ]))
      ),
    ]),

    c('section', { className: 'section' }, [
      c('h2', { className: 'section-title' }, t('set.rawYaml')),
      c('details', null, [
        c('summary', { style: { cursor: 'pointer', padding: '8px 0', color: 'var(--foggy)' } }, t('set.show')),
        c('pre', { className: 'console' }, data.raw || ''),
      ]),
    ]),
  ]);
});
