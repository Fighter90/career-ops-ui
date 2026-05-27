/* global Router, API, UI, I18n */
/**
 * /#/help — long-form user guide. Loads docs/help/{lang}.md from the
 * server and renders it via the XSS-safe UI.md(). Falls back to English
 * when a locale file is missing. Builds a sticky table of contents
 * from <h2> headings synchronously (no setTimeout race).
 */
Router.register('help', async () => {
  const c = UI.el;
  const t = (k, f) => I18n.t(k, f);
  const lang = (I18n.getLang && I18n.getLang()) || 'en';

  let payload;
  try {
    payload = await API.get('/api/help/' + encodeURIComponent(lang));
  } catch (e) {
    return c('div', null, [
      c('header', { className: 'page-header' }, c('h1', { className: 'page-title' }, t('help.title', 'Help'))),
      c('div', { className: 'empty' }, e.message || 'failed to load help'),
    ]);
  }

  // Render markdown into a hidden scratch div so we can extract h2's
  // and assign anchor IDs BEFORE the DOM lands on the page.
  const scratch = document.createElement('div');
  scratch.innerHTML = UI.md(payload.markdown || '');

  // v1.50.0 (WS2 #28) — the doc markdown starts with its own `# Title`
  // → a SECOND <h1> on a page whose header already provides the single
  // h1. Strip every article <h1> so there's exactly one h1 and the
  // hierarchy starts cleanly at the <h2> sections (no h1→h3 skip).
  scratch.querySelectorAll('h1').forEach((h) => h.remove());

  // Assign stable IDs to h2's so the TOC can scroll to them.
  const headings = Array.from(scratch.querySelectorAll('h2'));
  headings.forEach((h, i) => { h.id = 'help-h-' + i; });

  // Build the article and TOC in one synchronous pass.
  const article = c('div', {
    className: 'card md help-article',
    style: { padding: '24px 32px', maxWidth: '880px' },
  });
  // Move every child from scratch into article (preserves IDs).
  while (scratch.firstChild) article.appendChild(scratch.firstChild);

  const tocLinks = headings.map((h) => {
    // The renderer leaves heading content as raw markdown (backticks,
    // emphasis markers etc.) because the heading regex captures $1
    // verbatim. Pretty-print for the TOC by stripping inline-code
    // backticks AND rendering bold/italic markers as <strong>/<em>.
    const plain = (h.textContent || '')
      .replace(/`([^`]+)`/g, '$1')   // drop the backtick fences
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1');
    const a = c('a', {
      href: '#help-h-' + h.id.replace(/^help-h-/, ''),
      style: {
        display: 'block', padding: '4px 0', color: 'var(--hof)',
        textDecoration: 'none', fontSize: '13px', lineHeight: 1.55,
      },
      onClick: (e) => {
        e.preventDefault();
        const target = document.getElementById(h.id);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // WS2 #27 — move keyboard/SR focus to the section, not just the
        // viewport. Headings aren't focusable by default → tabindex=-1.
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      },
    }, plain);
    // v1.62.x — index each section's BODY too (every node from this H2
    // up to the next H2), so the filter is full-text: an H3 subsection
    // like `rss` is findable by content, not just by its H2 title.
    let bodyText = '';
    for (let n = h.nextElementSibling; n && n.tagName !== 'H2'; n = n.nextElementSibling) {
      bodyText += ' ' + (n.textContent || '');
    }
    a.dataset.tocText = (plain + ' ' + bodyText).toLowerCase();
    a.dataset.targetId = h.id; // v1.56.0 — UX-11: filter→1-match scroll
    return a;
  });

  // WS2 #12 — in-page filter over the TOC (92-heading doc).
  let tocScrollTimer = 0; // v1.56.0 — UX-11 debounce handle
  const tocSearch = c('input', {
    // U-12 (v1.58.32) — `.help-toc__filter` class lets CSS pin a
    // min-width: 16ch so the KO `섹션 필터` / JA `セクションをフィルター`
    // placeholders (5–10% wider than EN) never get clipped if the
    // surrounding card squeezes the input.
    className: 'input help-toc__filter', type: 'search',
    'aria-label': t('help.tocFilter', 'Filter sections'),
    placeholder: t('help.tocFilter', 'Filter sections'),
    style: { width: '100%', marginBottom: '10px', fontSize: '13px' },
    onInput: (e) => {
      const q = e.currentTarget.value.toLowerCase().trim();
      let visible = [];
      for (const a of tocLinks) {
        const show = !q || a.dataset.tocText.includes(q);
        a.style.display = show ? 'block' : 'none';
        if (show) visible.push(a);
      }
      // v1.56.0 — UX-11: when the filter narrows the TOC to exactly
      // one section, jump there for the user after a 300ms idle (so
      // mid-typing keystrokes don't yank the page around). Cancelled
      // and rescheduled on every keystroke; never fires for 0 or >1.
      clearTimeout(tocScrollTimer);
      if (q && visible.length === 1) {
        const only = visible[0];
        tocScrollTimer = setTimeout(() => {
          const target = document.getElementById(only.dataset.targetId);
          if (!target) return;
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }, 300);
      }
    },
  });

  const toc = c('nav', {
    className: 'card help-toc',
    // WS2 #27 — the TOC landmark was unnamed (two unlabeled <nav>s).
    'aria-label': t('help.toc', 'On this page'),
    style: {
      // top:110px keeps the TOC below the fixed topbar (which is
      // ~88px tall + a comfortable gap) so it never sits behind it.
      position: 'sticky', top: '110px',
      padding: '16px 18px', maxHeight: 'calc(100vh - 130px)',
      overflowY: 'auto',
    },
  }, [
    c('strong', { style: { display: 'block', marginBottom: '8px', fontSize: '13px' } },
      t('help.toc', 'On this page')),
    tocSearch,
    ...tocLinks,
  ]);

  // WS2 #12 — floating back-to-top; appears after scrolling down, sends
  // focus back to the page heading (keyboard-safe, CSP-safe handler).
  // S-7 (v1.54.6, regression run) — also tag with the canonical
  // `back-to-top` selector class the spec §2 #28 test targets, so a
  // tighter selector can't flake. Purely additive: `help-back-top`
  // (existing CSS hook) is unchanged; `back-to-top` has no CSS rule
  // (CSS-no-op), it's just a stable test/automation handle.
  const backTop = c('button', {
    className: 'btn btn-primary help-back-top back-to-top',
    'aria-label': t('help.backToTop', 'Back to top'),
    style: {
      position: 'fixed', right: '24px', bottom: '24px', zIndex: 50,
      display: 'none', borderRadius: '999px', padding: '10px 14px',
    },
    onClick: () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const h1 = document.querySelector('#content .page-title');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    },
  }, '↑ ' + t('help.backToTop', 'Back to top'));
  const onScroll = () => { backTop.style.display = window.scrollY > 600 ? 'block' : 'none'; };
  window.addEventListener('scroll', onScroll, { passive: true });

  // UX-D-K (v1.58.45) + UX-A5 (v1.58.52) — scroll-spy on the TOC.
  // v1.58.45 wired `IntersectionObserver`, but the 2026-05-19
  // verification regression caught **0** links ever receiving
  // `.toc-current` on scroll. Root cause: `setTimeout(0)` fired
  // BEFORE the router mounted the returned root into `#content`, so
  // `document.querySelectorAll('.help-article h2[id]')` matched nothing
  // and the observer never bound. UX-A5 fix:
  //   1. Observe the actual `<h2>` element refs we already hold from
  //      the synchronous `headings` array above — they're stable
  //      DOM nodes that travel with the `article` div the router
  //      appends. No re-query against `document` needed.
  //   2. Defer the IntersectionObserver creation via a double
  //      `requestAnimationFrame` so the observer attaches on the
  //      first frame AFTER mount (more reliable than setTimeout(0)
  //      against the SPA's render order).
  //   3. Also wire a same-document-DOM-mounted fallback: if `headings`
  //      somehow has no ids (regressed renderer), the observer is a
  //      no-op rather than throwing.
  const linkByTarget = new Map();
  for (const a of tocLinks) {
    const id = a.dataset.targetId;
    if (id) linkByTarget.set(id, a);
  }
  function applyCurrent(id) {
    for (const link of linkByTarget.values()) link.classList.remove('toc-current');
    const link = linkByTarget.get(id);
    if (link) link.classList.add('toc-current');
  }
  // UX-A5-r4 (v1.59.9) — 6th cycle. Five previous closures (v1.58.45,
  // v1.58.52, v1.59.0, v1.59.3, v1.59.8) all shipped with "tests green"
  // but the bug stayed open because the tests asserted the wrong thing
  // (existence of the `.toc-current` class anywhere, or the string
  // `IntersectionObserver` in the source). The TDD-first FIX-PROMPT for
  // v1.59.9 introduces:
  //   1. `<body data-toc-spy="active">` debug marker — a single CSS
  //      selector that any tester / future agent can use to answer
  //      "is the spy alive?" without needing to scroll first.
  //   2. Initial paint fires SYNCHRONOUSLY at mount end (no rAF
  //      dependency, just-in-case the router pre-paints the view).
  //   3. Double-rAF re-computation for the case where heading rects
  //      weren't valid yet (detached nodes during synchronous compute).
  //   4. rAF-throttled scroll listener — at most one paint per frame.
  //   5. Cleanup removes the marker AND both listeners when leaving
  //      #/help via hashchange.
  let spyScheduled = false;
  function computeActiveAndApply() {
    spyScheduled = false;
    if (!headings.length || !linkByTarget.size) return;
    const triggerY = window.scrollY + window.innerHeight * 0.3;
    let chosen = headings[0];
    for (const h of headings) {
      const absTop = h.getBoundingClientRect().top + window.scrollY;
      if (absTop <= triggerY) chosen = h;
      else break;            // headings is in document order
    }
    if (chosen) applyCurrent(chosen.id);
  }
  function onSpyScroll() {
    if (spyScheduled) return;
    spyScheduled = true;
    requestAnimationFrame(computeActiveAndApply);
  }
  window.addEventListener('scroll', onSpyScroll, { passive: true });
  window.addEventListener('resize', onSpyScroll, { passive: true });
  // Synchronous initial paint — covers the case where the router
  // appends the view before either rAF fires.
  computeActiveAndApply();
  // Double rAF re-compute — covers the opposite case: the route
  // handler returned before the router did the append. After two
  // frames, the headings are guaranteed to be in the DOM with valid
  // rects. The rAF callback no-ops if `applyCurrent` already fired.
  requestAnimationFrame(() => requestAnimationFrame(computeActiveAndApply));
  // UX-A5-r4 debug marker — any tester can answer "is the spy alive?"
  // with a single selector: `document.body.dataset.tocSpy === 'active'`.
  // Removed on cleanup so the marker accurately reflects route state.
  document.body.setAttribute('data-toc-spy', 'active');

  // Detach all listeners + the marker when the SPA leaves #/help.
  const cleanup = () => {
    if (!location.hash.startsWith('#/help')) {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onSpyScroll);
      window.removeEventListener('resize', onSpyScroll);
      window.removeEventListener('hashchange', cleanup);
      document.body.removeAttribute('data-toc-spy');
    }
  };
  window.addEventListener('hashchange', cleanup);

  return c('div', null, [
    c('header', { className: 'page-header' }, [
      c('div', null, [
        c('h1', { className: 'page-title' }, t('help.title', 'Help')),
        c('p', { className: 'page-subtitle' }, t('help.subtitle', 'Step-by-step walkthrough of every page.')),
      ]),
    ]),
    c('div', {
      className: 'help-grid',
      style: { display: 'grid', gridTemplateColumns: '240px 1fr', gap: '24px', alignItems: 'start' },
    }, [
      headings.length ? toc : c('div'),
      article,
    ]),
    backTop,
  ]);
});
