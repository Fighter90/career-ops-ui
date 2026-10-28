/* global Router, API, UI, I18n, HelpHint, L, MapPrefs, PostingUrlKey */
/**
 * #/map — scan results, pending pipeline and tracked applications on an
 * OpenStreetMap map.
 *
 * Two kinds of dot: FILLED = an evaluation score (tracker, ScoreTone tiers),
 * RING = a free title-fit hint (pipeline/scan: two-pager FitScore, else the
 * title-fit band). Positions come from /api/geocode (server-side Nominatim,
 * cached): the employer's own address when OSM knows it, else the place centre.
 *
 * Postings on the same coordinate are spread on a small pixel spiral. At
 * every zoom the pure clusterMarkers() pass (CAR-125) groups dots whose
 * drawn markers would touch into one counted cluster coloured by its best
 * posting; clicking it zooms in (at the zoom ceiling it peeks instead).
 * Evaluated dots never ride a pending-ring crowd when geometry allows.
 * No plugin — a greedy place-or-join per zoom change, then a conflict pass
 * so no two markers ever overlap (Linear CAR-125).
 *
 * CAR-125 also adds the v2 surface: a side list of the jobs inside the
 * visible bounds (synced on moveend/zoomend, no refetch, keyboard-operable —
 * every cluster has a list counterpart) and filter chips (specialization
 * tokens from the settings + score bands) replacing the old select.
 */
(function () {
  const SPREAD_ZOOM = 11;
  const SCORE_COLORS = { good: 'var(--map-score-top)', warn: 'var(--map-score-good)', muted: 'var(--map-score-mid)', bad: 'var(--map-score-low)', none: 'var(--map-score-none)' };
  const FIT_COLORS = { strong: 'var(--map-score-top)', related: 'var(--map-score-mid)', weak: 'var(--map-score-low)', none: 'var(--map-score-none)' };
  const SCORE_RADIUS = { good: 10, warn: 8, muted: 7, bad: 5.5, none: 6 };
  const SCORE_OPACITY = { good: 1, warn: 0.9, muted: 0.7, bad: 0.42, none: 0.7 };
  const FIT_RANK = { strong: 3, related: 2, weak: 1, none: 0 };

  // Generation counter — a newer render (or leaving the route) stops the
  // previous view's geocode loop.
  let gen = 0;
  // The live Leaflet instance: removed on leaving or re-rendering, or its
  // window listeners outlive the detached container.
  let live = null;
  // CAR-57 — the theme watcher for the live view: attribute flips (toggle)
  // and OS-scheme flips both re-mount the tile layer. Cleared in drop().
  let themeObs = null;
  let themeMql = null;
  let sheetObs = null;
  let viewportHandler = null;
  const drop = () => {
    if (live) { live.remove(); live = null; }
    if (themeObs) { themeObs.disconnect(); themeObs = null; }
    if (sheetObs) { sheetObs.disconnect(); sheetObs = null; }
    if (themeMql) { themeMql.onchange = null; themeMql = null; }
    if (viewportHandler) {
      window.removeEventListener('resize', viewportHandler);
      window.visualViewport?.removeEventListener('resize', viewportHandler);
      viewportHandler = null;
    }
    document.body.classList.remove('job-map-active');
  };
  // Only on leaving: the router's hashchange listener runs first, so arriving at
  // #/map has already claimed a fresh gen — bumping it here would kill that render.
  window.addEventListener('hashchange', () => { if (Router.current().name !== 'map') { gen++; drop(); } });

  const urlKey = (u) => PostingUrlKey ? PostingUrlKey.normalizeUrl(u) : '';
  // The server keeps the first place of a multi-location cell and refuses only
  // a query over its MAX_QUERY (2000) — cap the raw cell to that, nothing more.
  const geoQuery = (loc) => String(loc).slice(0, 2000);
  const openUrl = (u) => (/^https?:\/\//i.test(u || '') ? () => window.open(u, '_blank', 'noopener') : null);

  // CAR-57 (v1.247.0) — the effective theme, mirroring app.js's
  // readEffectiveTheme(): an explicit data-theme wins, else the OS setting.
  // The tile layer re-mounts when it flips so dark mode gets a dark basemap.
  function effectiveTheme() {
    const explicit = document.documentElement.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /** Pipeline/scan row → fit band (two-pager FitScore wins over the title band). */
  function fitOf(r, twoPager) {
    if (twoPager && window.FitScore) {
      const fit = window.FitScore.scoreJob(r, twoPager, window.Countries);
      if (fit && fit.score != null) {
        return { band: fit.score >= 66 ? 'strong' : fit.score >= 40 ? 'related' : 'weak', label: '◎ ' + fit.score };
      }
    }
    const band = (r.fit && r.fit.band) || 'none';
    return { band: FIT_COLORS[band] ? band : 'none', label: band === 'none' ? '' : band };
  }

  function scoreOf(r) {
    const num = r.scoreNum ?? (window.ScoreTone ? window.ScoreTone.scoreNum(r.score) : NaN);
    const has = Number.isFinite(num);
    const tone = has && window.ScoreTone ? window.ScoreTone.scoreTone(num) : 'none';
    return { tone, num: has ? num : null, label: r.score && r.score !== '—' ? r.score : '', evaluated: has };
  }

  // DOM built with textContent — job data is untrusted.
  function tip(lines) {
    const box = document.createElement('div');
    lines.filter((l) => l).forEach((text, i) => {
      const d = document.createElement(i === 0 ? 'strong' : 'div');
      d.textContent = text;
      box.appendChild(d);
    });
    return box;
  }

  // Golden-angle spiral, in pixels so the spread is the same at every zoom.
  // CAR-125 review f1: the base radius must clear the pass-1 solo distance
  // (26px) AND the widest singleton pair (2×12px + pad = 28px) — at 30px two
  // postings sharing one geocoded place centre (the common fallback) are
  // never re-merged, so both stay reachable at every zoom.
  function spiral(i) {
    if (i === 0) return [0, 0];
    const a = i * 2.39996;
    const r = 30 * Math.sqrt(i);
    return [r * Math.cos(a), r * Math.sin(a)];
  }

  // CAR-41 (v1.243.0) — pure per-layer header stats, top-level so the unit
  // test can run it in isolation. Over the ACTIVE layers' points only:
  //   located — geocoded (lat set),
  //   noLoc   — structurally without a location (no candidate place) or
  //             attempted and unresolvable (geoDone),
  //   pending — still queued (total − located − noLoc).
  // One denominator for all three numbers; the old label mixed a geocode
  // group total with an all-history no-location count and never followed
  // the layer toggles.
  function mapLayerStats(points, isActiveLayer) {
    const vis = (Array.isArray(points) ? points : []).filter((p) => p && isActiveLayer(p.layer));
    const located = vis.filter((p) => p.lat != null).length;
    const noLoc = vis.filter((p) => p.lat == null
      && (!(Array.isArray(p.places) && p.places.length) || p.geoDone)).length;
    return { located, total: vis.length, noLoc };
  }

  // CAR-125 (map v2) — pure screen-pixel clustering math. Everything below
  // is top-level and dependency-free so the unit test can vm-slice it
  // (tests/map-v2-car125.test.mjs), like mapLayerStats above.

  // Drawn radius of a CLUSTER marker for n postings — the same 36–40px
  // diameter the v1 cluster chip always had, so the conflict math matches
  // what render() actually draws (singletons are circle markers, ≤12px).
  function clusterRadius(n) {
    return Math.max(36, Math.round(24 + Math.min(16, Math.log2(n) * 4))) / 2;
  }

  // Count tiers for the cluster chip — size and shadow grow with the
  // posting count (the epic's «размер … по количеству»).
  function clusterTier(n) {
    return n >= 100 ? 'l' : n >= 10 ? 'm' : 's';
  }

  /**
   * Group `points` (sorted best-first; each carries px {x, y} projected at
   * the CURRENT zoom) so no two drawn markers overlap, at any zoom.
   *
   * Pass 1 — greedy place-or-join: a point joins the first group of the
   * SAME KIND whose anchor is within `soloPx` (anchors never move here, so
   * the evaluated/pending separation survives whenever geometry allows).
   * Pass 2 — conflict resolution, sweeps bounded by points.length: each
   * sweep folds EVERY conflicting pair (the smaller group into the larger,
   * whose anchor then re-anchors on its best member). Total folds ≤ n−1
   * (each fold removes one group), so a bound of n sweeps can never
   * truncate while a conflict remains — the loop exits only when no pair
   * of anchors sits closer than radius(a) + radius(b) + pad. That exit
   * condition IS the no-overlap guarantee; the CAR-125 review f2 cap
   * (`guard < 100`) that could leave overlaps on a dense city viewport is
   * gone.
   *
   * Pure: no Leaflet, no DOM — dist/radius are plain Math over px.
   */
  function clusterMarkers(points, opts = {}) {
    const solo = opts.soloPx ?? 26;
    const pad = opts.padPx ?? 4;
    const radiusOf = (n) => (n === 1 ? (opts.singletonRadius ?? 12) : clusterRadius(n));
    const dist = (a, b) => Math.hypot(a.px.x - b.px.x, a.px.y - b.px.y);
    const groups = [];
    for (const p of points) {
      const hit = groups.find((g) => g.kind === p.filled && dist(g, p) <= solo);
      if (hit) hit.members.push(p);
      else groups.push({ px: { x: p.px.x, y: p.px.y }, kind: p.filled, members: [p] });
    }
    for (let sweep = 0; sweep <= points.length; sweep++) {
      let merged = false;
      for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const a = groups[i]; const b = groups[j];
          if (dist(a, b) > radiusOf(a.members.length) + radiusOf(b.members.length) + pad) continue;
          const big = a.members.length >= b.members.length ? a : b;
          const small = big === a ? b : a;
          // f5: the folded members re-sort best-first and the anchor rides
          // the best member's position, so the cluster always represents
          // (colour, label, ring/fill, peek) its highest-ranked posting.
          big.members = big.members.concat(small.members).sort((x, y) => y.rank - x.rank);
          big.px = { x: big.members[0].px.x, y: big.members[0].px.y };
          groups.splice(groups.indexOf(small), 1);
          merged = true;
          j = i; // re-scan the slot: `big` grew, neighbours may now conflict
        }
      }
      if (!merged) break;
    }
    return groups;
  }

  Router.register('map', async () => {
    const c = UI.el;
    const t = (k, f) => I18n.t(k, f);
    const myGen = ++gen;
    document.body.classList.add('job-map-active');

    // CAR-112 — the page h1 + shimmer rows mount BEFORE the five GETs: the
    // route used to show only the router's bare «Loading…» (the map's DOM,
    // h1 included, did not exist until every fetch resolved). The title is
    // static per view (existing i18n keys); the full page below replaces
    // this shell when the data lands, and a navigation away mid-fetch is
    // discarded by the router's epoch check (and this view's own `gen`).
    const shell = document.getElementById('content');
    if (shell) {
      shell.replaceChildren(
        c('div', null, [
          c('header', { className: 'page-header' }, [
            c('div', null, [
              HelpHint.title(t('map.title', 'Job map'), 'help.hint.map'),
            ]),
          ]),
          window.Skeleton.block(6, t('common.loading', 'Loading…')),
        ]),
      );
    }

    const [scan, jobs, tp, commute, profile] = await Promise.all([
      API.get('/api/scan-results').catch(() => ({})),
      API.get('/api/map/jobs').catch(() => ({ pipeline: [], tracker: [] })),
      API.get('/api/two-pager').catch(() => ({})),
      API.get('/api/commute').catch(() => null),
      // v1.251.0 — the specializations live in the settings
      // (config/profile.yml → target_roles.primary); /api/profile's summary
      // already exposes them as target_roles.
      API.get('/api/profile').catch(() => ({})),
    ]);
    const twoPager = tp && tp.twoPager;

    const scanRows = [];
    for (const region of ['en', 'ru']) {
      for (const r of (scan?.[region]?.filtered || [])) scanRows.push(r);
    }
    const locByUrl = new Map(scanRows.filter((r) => r.url && r.location).map((r) => [urlKey(r.url), r.location]));
    const byUrl = (commute && commute.byUrl) || {};
    const byNum = (commute && commute.byNum) || {};
    const commuteOf = (r, href) => byNum[r?.num] || byUrl[urlKey(href || r?.url)] || null;
    const driveLabel = (cm) => !cm ? '' : cm.precision === 'remote'
      ? t('commute.remote', 'Remote')
      : Number.isFinite(cm.min) ? cm.min + ' min' : '?';

    // Uniform point: { layer, places, company, filled, color, rank, label, title, lines, open }
    // `places` are tried in order until one geocodes to a settlement.
    const points = [];
    const fitPoint = (layer, r, href) => {
      const { band, label } = fitOf(r, twoPager);
      const cm = commuteOf(r, href);
      points.push({
        layer, places: [r.location], company: r.company, filled: false,
        color: FIT_COLORS[band], rank: FIT_RANK[band], label: label ? t('map.fit', 'Fit') + ': ' + label : '',
        fitBand: band, evaluated: false, scoreNum: null, commute: cm,
        title: r.title, lines: [r.company, r.location,
          [r.workplaceType || (r.isRemote ? 'Remote' : ''), r.salary].filter(Boolean).join(' · '), driveLabel(cm)],
        open: openUrl(href),
      });
    };
    for (const r of scanRows) fitPoint('scan', r, r.url);
    for (const r of (jobs.pipeline || [])) fitPoint('pipeline', r, r.href);
    for (const r of (jobs.tracker || [])) {
      const s = scoreOf(r);
      // Server resolves most locations; a scan row with the same URL is the fallback.
      const location = r.location || (r.href && locByUrl.get(urlKey(r.href)));
      // The evaluation's own workplace (from Notes) beats the posting's label:
      // first with the posting's region (a bare "Springfield" is ambiguous), then
      // alone (the posting's region can be wrong), then the posting's location.
      const region = String(location || '').split(',').slice(1).join(',').trim();
      const places = r.workplace
        ? [region ? r.workplace + ', ' + region : '', r.workplace, location]
        : [location];
      points.push({
        layer: 'tracker', places, company: r.company, filled: true,
        color: SCORE_COLORS[s.tone] || SCORE_COLORS.none, rank: 100 + s.num,
        tone: s.tone, evaluated: s.evaluated, scoreNum: s.num, commute: commuteOf(r, r.href),
        label: s.label ? t('map.score', 'Score') + ': ' + s.label : '',
        title: r.role, lines: [r.company, r.workplace || location, r.status, driveLabel(commuteOf(r, r.href))],
        open: r.reportPath
          ? () => Router.go('/reports/' + r.reportPath.replace(/^(\.\.\/)*reports\//, '').replace(/\.md$/, ''))
          : openUrl(r.href),
      });
    }

    for (const p of points) {
      if (Number.isFinite(p.commute?.lat) && Number.isFinite(p.commute?.lon)) {
        p.lat = p.commute.lat; p.lon = p.commute.lon; p.fixed = true;
      }
    }

    const mapEl = c('div', { className: 'job-map', id: 'job-map' });
    const status = c('p', { className: 'page-subtitle', role: 'status', 'aria-live': 'polite' }, '');
    const statusChip = c('div', { className: 'job-map-status-chip', 'aria-hidden': 'true' }, '');
    const mapPrefs = MapPrefs ? MapPrefs.loadMap() : { scoreMin: null, showUnevaluated: true, q: '', layers: { scan: true, pipeline: true, tracker: true } };
    const commutePrefs = MapPrefs ? MapPrefs.loadCommute() : { maxMinutes: null, showUnknown: true };
    // CAR-125 — the score ceiling moved from the filter sheet to a chip row
    // (applied immediately, state visible at a glance, like #/scan). The
    // bands are the same three values the old select offered.
    const SCORE_BANDS = [3, 3.8, 4.2];
    const unevaluated = c('input', { type: 'checkbox', checked: mapPrefs.showUnevaluated });
    const commuteLimits = [...new Set([commute?.maxMinutes, 30, 45, 60, 90, commutePrefs.maxMinutes]
      .map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
    const commuteFilter = c('select', { className: 'select', 'aria-label': t('commute.filter', 'Maximum drive time') }, [
      c('option', { value: '' }, t('commute.any', 'Any drive time')),
      ...commuteLimits.map((n) => c('option', { value: String(n) }, n === Number(commute?.maxMinutes)
        ? t('commute.max', '≤ {n} min (profile)').replace('{n}', n)
        : t('commute.upTo', '≤ {n} min').replace('{n}', n))),
    ]);
    commuteFilter.value = commutePrefs.maxMinutes == null ? '' : String(commutePrefs.maxMinutes);
    const unknownCommute = c('input', { type: 'checkbox', checked: commutePrefs.showUnknown });
    // v1.251.0 — the SPECIALIZATION filter fed from the settings
    // (config/profile.yml → target_roles.primary — «PHP-разработчик»,
    // «Product Manager», …) plus the v1.250.0 text search. CAR-125: the
    // select became a chip row (single filter system, applied immediately);
    // the chips are populated inside the map init where the profile lands.
    const specChips = c('div', { className: 'v2-map-chipset', role: 'group', 'aria-label': t('map.filter.spec', 'Specialization') });
    const scoreChips = c('div', { className: 'v2-map-chipset', role: 'group', 'aria-label': t('map.filter.score', 'Minimum evaluation score') });
    const chipRow = c('div', { className: 'v2-map-chiprow' }, [specChips, scoreChips]);
    const searchInput = c('input', {
      className: 'input job-map-search', type: 'search',
      'aria-label': t('map.filter.search', 'Search company or title'),
      placeholder: t('map.filter.searchPlaceholder', 'company or title…'),
      value: String(mapPrefs.q || ''),
      maxLength: 120,
    });
    const layerInputs = Object.fromEntries(['scan', 'pipeline', 'tracker'].map((layer) => [layer,
      c('input', { type: 'checkbox', checked: mapPrefs.layers[layer] !== false })]));
    const check = (input, label) => c('label', { className: 'map-check' }, [input, label]);
    const legend = c('div', { className: 'job-map-legend-inline' }, [
      c('strong', null, t('map.legend.title', 'Relevance')),
      c('span', null, t('map.legend.colors', 'teal strongest · grey weakest')),
      c('span', null, t('map.legend.score', 'Filled: evaluated')),
      c('span', null, t('map.legend.fit', 'Ring: not evaluated')),
      c('span', null, t('map.legend.count', 'Number: grouped postings')),
      c('span', null, t('map.legend.exact', '📍 company address, otherwise place centre')),
    ]);
    const filtersBody = c('div', { className: 'job-map-filter-body' }, [
      c('div', { className: 'job-map-filter-group' }, [
        c('strong', null, t('map.layers', 'Layers')),
        check(layerInputs.scan, t('map.layerScan', 'Scan results')),
        check(layerInputs.pipeline, t('map.layerPipeline', 'Pipeline (pending)')),
        check(layerInputs.tracker, t('map.layerTracker', 'Tracker')),
      ]),
      c('div', { className: 'job-map-filter-group' }, [check(unevaluated, t('map.filter.unevaluated', 'Show jobs without a score'))]),
      commute?.available ? c('div', { className: 'job-map-filter-group' }, [commuteFilter, check(unknownCommute, t('commute.unknown', 'Show unknown drive time'))]) : null,
      legend,
    ].filter(Boolean));
    const resetBtn = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, t('map.filter.reset', 'Reset'));
    const fitBtn = c('button', { className: 'btn btn-ghost btn-sm', type: 'button' }, t('map.filter.fit', 'Fit results'));
    const closeSheet = c('button', { className: 'job-map-sheet-close', type: 'button', 'aria-label': t('common.closeDialog', 'Close dialog') }, '×');
    const sheet = c('section', { className: 'job-map-sheet', id: 'job-map-sheet', 'aria-label': t('map.filters', 'Map filters') }, [
      closeSheet,
      filtersBody,
      c('div', { className: 'job-map-filter-actions' }, [resetBtn, fitBtn]),
      c('div', { className: 'job-map-peek', hidden: true }),
    ]);
    const filterButton = c('button', { className: 'btn btn-primary job-map-filter-button', type: 'button', 'aria-controls': 'job-map-sheet', 'aria-expanded': 'false' }, t('map.filters', 'Filters'));
    // CAR-125 — the side list: jobs inside the visible bounds, sorted
    // best-first, synced on pan/zoom from the already-loaded points (no
    // refetch). Desktop: a panel beside the map. Phone: a bottom sheet over
    // the full-screen map, opened by the floating toggle — the keyboard-
    // accessible path to every marker, clusters included.
    // i18n: map.list.title / map.list.empty / map.list.more live in all 19
    // locale dicts (the fan-out landed with the review round).
    const listCount = c('span', { className: 'v2-map-list-count' }, '0');
    const listRows = c('ol', { className: 'v2-map-list-rows' }, []);
    const listEmpty = c('p', { className: 'v2-map-list-empty', hidden: true }, t('map.list.empty', 'Nothing in view — pan the map or zoom out.'));
    const listMore = c('li', { className: 'v2-map-list-more', hidden: true });
    const listClose = c('button', { className: 'v2-map-list-close', type: 'button', 'aria-label': t('common.closeDialog', 'Close dialog') }, '×');
    const listPanel = c('aside', { className: 'v2-map-list', id: 'v2-map-list', 'aria-label': t('map.list.title', 'Jobs in view') }, [
      c('div', { className: 'v2-map-list-head' }, [
        c('strong', null, t('map.list.title', 'Jobs in view')),
        listCount,
        listClose,
      ]),
      listRows,
      listEmpty,
    ]);
    listRows.appendChild(listMore);
    const listToggle = c('button', { className: 'btn btn-primary v2-map-list-toggle', type: 'button', 'aria-controls': 'v2-map-list', 'aria-expanded': 'false' }, t('map.list.title', 'Jobs in view'));
    const jobToolbar = c('div', { className: 'job-map-toolbar' }, [searchInput]);
    const mapWrap = c('div', { className: 'job-map-wrap' }, [mapEl, statusChip, filterButton, listToggle, sheet]);
    // CAR-125 — «Without a location: N» is a control now: it leads to #/scan
    // (the epic's click-through). Zero no-location rows → hidden.
    const noLocBtn = c('button', { className: 'v2-map-noloc', type: 'button', hidden: true }, '');
    noLocBtn.addEventListener('click', () => Router.go('/scan'));
    const layout = c('div', { className: 'v2-map-layout' }, [mapWrap, listPanel]);
    const page = c('div', { className: 'job-map-page' }, [
      c('header', { className: 'page-header' }, [
        c('div', null, [
          HelpHint.title(t('map.title', 'Job map'), 'help.hint.map'),
          status,
          noLocBtn,
        ]),
      ]),
      chipRow,
      jobToolbar,
      layout,
    ]);

    // Leaflet needs the container in the DOM with a size — init after the
    // router has mounted the returned node.
    setTimeout(async () => {
      if (myGen !== gen || !mapEl.isConnected || !window.L) return;
      // World view until the first places are located; fit() then frames the data.
      drop();
      document.body.classList.add('job-map-active');
      const syncViewport = () => {
        page.style.height = window.matchMedia('(max-width: 900px)').matches
          ? Math.max(320, window.innerHeight - page.getBoundingClientRect().top) + 'px'
          : '';
        live?.invalidateSize({ pan: false });
      };
      viewportHandler = syncViewport;
      window.addEventListener('resize', viewportHandler);
      window.visualViewport?.addEventListener('resize', viewportHandler);
      syncViewport();
      const map = live = L.map(mapEl, { worldCopyJump: true }).setView([20, 0], 2);
      let q = String(mapPrefs.q || '').toLowerCase();
      // v1.251.0 — the SPECIALIZATION filter: the selected entry from
      // config/profile.yml → target_roles.primary (loaded from /api/profile).
      let specialization = '';
      // CAR-125 — the chip-driven score band (was the sheet's select).
      // Review f6: only the shipped bands pass — a stale or tampered
      // localStorage value ("3.5", NaN) must not seed a silent filter that
      // no chip reflects.
      let minScore = mapPrefs.scoreMin == null ? null
        : SCORE_BANDS.includes(Number(mapPrefs.scoreMin)) ? Number(mapPrefs.scoreMin) : null;
      let specKeywords = {}; // specialization name -> its token list
      // v1.251.1 — seniority and generic job nouns never single-handedly
      // match a specialization: «Senior PHP Developer» matched «Senior Java
      // Developer» because both carry Senior/Developer. A token on this list
      // is dropped from the role's matcher; if nothing distinctive remains
      // («Software Engineer»), the whole phrase is the matcher.
      const GENERIC_TOKENS = new Set([
        'senior', 'junior', 'middle', 'lead', 'principal', 'staff', 'head',
        'ведущий', 'старший', 'младший', 'главный',
        'developer', 'engineer', 'разработчик', 'инженер',
        'specialist', 'специалист', 'manager', 'менеджер',
      ]);
      {
        const roles = ((profile || {}).summary || {}).target_roles;
        if (Array.isArray(roles) && roles.length) {
          for (const role of roles) {
            if (typeof role !== 'string' || !role.trim()) continue;
            const name = role.trim();
            // Tokens of the role string = its matchers. Length ≥ 2 («Go»),
            // letters/digits/+/#/. — «PHP», «C++», «.NET» survive.
            const tokens = (name.match(/[\p{L}\p{N}][\p{L}\p{N}+#.]*/gu) || [])
              .filter((tok) => tok.length >= 2);
            // v1.251.1 — keep only DISTINCTIVE tokens (seniority and generic
            // job nouns dropped); a role with no distinctive tokens left
            // («Software Engineer») falls back to the whole phrase.
            const distinctive = tokens.filter((tok) => !GENERIC_TOKENS.has(tok.toLowerCase()));
            specKeywords[name] = distinctive.length ? distinctive : [name];
          }
          // A specialization whose tokens are a subset of another's longer
          // name still works: matching is per-token ANY, per the settings'
          // own wording.
        }
        // CAR-125 — the specialization chips: one chip per configured role
        // plus the «All» reset chip (always rendered — review f8). With no
        // roles configured (or /api/profile failed) the All chip would be a
        // dead control, so the whole group hides instead.
        specChips.replaceChildren(
          c('button', { className: 'v2-map-chip v2-map-chip-any', type: 'button', 'aria-pressed': 'true' },
            t('map.filter.specAny', 'All specializations')),
          ...Object.keys(specKeywords).map((name) =>
            c('button', { className: 'v2-map-chip', type: 'button', 'aria-pressed': 'false', 'data-spec': name }, name)),
        );
        specChips.hidden = !Object.keys(specKeywords).length;
      }
      const tiles = jobs.tiles || {};
      // CAR-57 (v1.247.0) — theme-aware basemap. If the server has a
      // CONFIGURED dark provider (MAP_TILE_DARK_URL — keyed Carto, a
      // self-hosted dark style), it is mounted per theme like any layer.
      // Without one, dark mode keeps the light OSM layer and inverts the
      // raster in place (.job-map--invert, app.css): the keyless Carto
      // preset answers real requests with an "API KEY REQUIRED" placeholder
      // PNG, so it must not be the default. Either way the appearance
      // re-mounts on every theme flip — Leaflet has no in-place URL swap.
      const darkCfg = tiles.dark || {};
      const darkConfigured = Boolean(darkCfg.configured && darkCfg.url);
      const OSM_FALLBACK = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
      let tileLayer = null;
      function applyTiles() {
        const dark = effectiveTheme() === 'dark';
        const real = dark && darkConfigured;
        const cfg = real ? darkCfg : tiles;
        if (tileLayer) map.removeLayer(tileLayer);
        tileLayer = L.tileLayer(cfg.url || OSM_FALLBACK, {
          maxZoom: 19,
          subdomains: 'abcd',
          // OSM's tile policy rejects requests without a Referer, and the app-wide
          // Referrer-Policy is same-origin. Send the bare origin for tiles only.
          referrerPolicy: 'strict-origin-when-cross-origin',
          // MAP_TILE_ATTRIBUTION arrives HTML-escaped from the server; a
          // configured dark provider may name its own attribution.
          attribution: (real && darkCfg.attribution) || cfg.attribution || OSM_ATTR,
        }).addTo(map);
        mapEl.classList.toggle('job-map--invert', dark && !darkConfigured);
      }
      applyTiles();
      themeObs = new MutationObserver(applyTiles);
      themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      themeMql = window.matchMedia('(prefers-color-scheme: dark)');
      themeMql.onchange = () => { if (myGen === gen && live) applyTiles(); };
      // Rings under clusters (markerPane 600) under evaluated dots.
      map.createPane('scorePane').style.zIndex = 620;   // above clusters (600), below tooltips (650)

      // Empty groups retain Leaflet's layer semantics while page-level controls
      // keep overlays off the map itself (especially on phones).
      const toggles = { scan: L.layerGroup(), pipeline: L.layerGroup(), tracker: L.layerGroup() };
      for (const layer of Object.keys(toggles)) if (layerInputs[layer].checked) toggles[layer].addTo(map);
      const drawn = L.layerGroup().addTo(map);
      // Stop auto-fitting once the user pans/zooms themselves.
      let userMoved = false;

      if (commute?.home) {
        L.marker([commute.home.lat, commute.home.lon], {
          keyboard: true,
          icon: L.divIcon({ html: '<span aria-hidden="true">⌂</span>', className: 'job-map-home', iconSize: [32, 32], iconAnchor: [16, 16] }),
          title: t('map.home', 'Home'),
        }).bindTooltip(t('map.home', 'Home')).addTo(map);
      }

      const coarsePointer = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;
      const peek = sheet.querySelector('.job-map-peek');
      let selectedMarker = null;
      function syncSheetOffset() {
        const open = sheet.classList.contains('is-open');
        mapWrap.style.setProperty('--map-sheet-h', open ? sheet.offsetHeight + 'px' : '0px');
      }
      function hideSheet({ restore = false } = {}) {
        sheet.classList.remove('is-open', 'is-peek');
        filterButton.setAttribute('aria-expanded', 'false');
        filtersBody.hidden = false;
        sheet.querySelector('.job-map-filter-actions').hidden = false;
        peek.hidden = true;
        selectedMarker = null;
        syncSheetOffset();
        if (restore) filterButton.focus();
      }
      function showPeek(point, marker, event, opts = {}) {
        // The job locator ALWAYS peeks: its whole purpose is «show me this
        // job here» — navigating away would defeat it on desktop.
        if (!coarsePointer() && !opts.peek) { point.open?.(); return; }
        if (event?.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
        selectedMarker = marker;
        filtersBody.hidden = true;
        sheet.querySelector('.job-map-filter-actions').hidden = true;
        peek.hidden = false;
        peek.textContent = '';
        const card = c('div', { className: 'job-map-peek-card', role: 'button', tabIndex: 0 }, [
          c('strong', null, [point.company, point.title].filter(Boolean).join(' · ')),
          c('span', null, point.label || t('map.filter.unevaluatedShort', 'No score')),
          c('span', null, commute?.available
            ? t('commute.col.time', 'Drive') + ': ' + (point.commute ? driveLabel(point.commute) : '?')
            : ''),
        ]);
        const open = () => point.open?.();
        card.addEventListener('click', open);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
        peek.appendChild(card);
        sheet.classList.add('is-open', 'is-peek');
        filterButton.setAttribute('aria-expanded', 'true');
        syncSheetOffset();
        requestAnimationFrame(() => {
          if (!selectedMarker) return;
          map.panBy([0, Math.ceil(sheet.offsetHeight / 2)], { animate: true });
          card.focus({ preventScroll: true });
        });
      }

      const single = (p, at) => {
        const tone = p.tone || (p.evaluated ? 'none' : p.fitBand === 'strong' ? 'good' : p.fitBand === 'related' ? 'muted' : 'bad');
        const m = L.circleMarker(at, p.filled
          ? { pane: 'scorePane', bubblingMouseEvents: false, radius: SCORE_RADIUS[tone] || 6, className: tone === 'good' ? 'job-marker-best' : '', color: '#fff', weight: 1.5, fillColor: p.color, fillOpacity: SCORE_OPACITY[tone] ?? 0.7 }
          : { bubblingMouseEvents: false, radius: SCORE_RADIUS[tone] || 6, color: p.color, weight: tone === 'good' ? 3 : 2.5, fillColor: 'var(--paper)', fillOpacity: 0.88 });
        m.bindTooltip(tip([p.title, ...p.lines, p.label, p.exact ? '📍 ' + t('map.exact', 'Company address') : '']),
          { direction: 'top', offset: [0, -6] });
        if (p.open) m.on('click', (e) => showPeek(p, m, e));
        return m;
      };

      const cluster = (members, at) => {
        const best = members[0];               // members are sorted by rank
        const n = members.length;
        const size = Math.round(clusterRadius(n) * 2);
        const el = document.createElement('div');
        el.className = 'job-cluster v2-map-cluster v2-map-cluster--' + clusterTier(n) + (best.filled ? '' : ' ring');
        el.style.setProperty('--c', best.color);
        el.style.width = el.style.height = size + 'px';
        const bestLabel = best.evaluated && best.scoreNum != null ? best.scoreNum.toFixed(1)
          : best.label.replace(/^.*:\s*/, '').replace(/^◎\s*/, '') || '–';
        el.append(c('span', { className: 'job-cluster-best' }, bestLabel), c('span', { className: 'job-cluster-count' }, String(n)));
        const m = L.marker(at, { icon: L.divIcon({ html: el, className: '', iconSize: [size, size] }), keyboard: false });
        const shown = members.slice(0, 8).map((p) => [p.label, p.company, p.title].filter(Boolean).join(' · '));
        if (n > shown.length) shown.push('+' + (n - shown.length) + ' ' + t('map.more', 'more'));
        m.bindTooltip(tip([n + ' ' + t('map.postings', 'postings'), ...shown]), { direction: 'top', offset: [0, -size / 2] });
        m.on('click', () => {
          userMoved = true;
          // CAR-125 — expand on click; at the zoom ceiling an
          // un-expandable cluster peeks its best posting instead of
          // refitting the same viewport forever.
          if (map.getZoom() >= (map.getMaxZoom?.() ?? 19)) {
            showPeek(best, m, null, { peek: true });
            return;
          }
          map.fitBounds(L.latLngBounds(members.map((p) => [p.lat, p.lon])).pad(0.3),
            { maxZoom: Math.max(map.getZoom() + 2, SPREAD_ZOOM) });
        });
        return m;
      };

      function passes(point) {
        if (q) {
          const hay = (point.company + ' ' + point.title).toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        // v1.251.0 — a chosen specialization keeps only the postings whose
        // title carries one of its distinguishing tokens (word-bounded, so
        // «Go» never matches «Google»; Cyrillic works through the same
        // Unicode lookarounds).
        if (specialization && specKeywords[specialization]) {
          const kws = specKeywords[specialization];
          const title = String(point.title || '');
          if (!kws.some((k) => {
            const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'iu').test(title);
          })) return false;
        }
        if (point.evaluated) {
          if (minScore != null && point.scoreNum < minScore) return false;
        } else if (!unevaluated.checked) return false;
        const maxDrive = commuteFilter.value ? Number(commuteFilter.value) : null;
        const remote = point.commute?.precision === 'remote';
        const known = remote || Number.isFinite(point.commute?.min);
        if (!known && !unknownCommute.checked) return false;
        if (maxDrive != null) {
          if (known && !remote && point.commute.min > maxDrive) return false;
        }
        return true;
      }

      // CAR-125 — what is drawn right now, for the side list: point → the
      // Leaflet marker (peek target) and point → its DOM element
      // (hover/focus highlight). Rebuilt on every render.
      const markerByPoint = new Map();
      const markerElByPoint = new Map();
      let ranked = []; // every passing point, best-first (the list filters it by bounds)
      let tidSeq = 0; // review f3 — stable per-point identity for the list memo
      let lastListIds = null; // review f3 — the ordered identities last drawn
      function register(m, members) {
        const el = (m.getElement ? m.getElement() : null) || m._path || null;
        for (const p of members) {
          markerByPoint.set(p, m);
          if (el) markerElByPoint.set(p, el);
        }
      }

      function render() {
        drawn.clearLayers();
        markerByPoint.clear();
        markerElByPoint.clear();
        const zoom = map.getZoom();
        const visible = points.filter((p) => p.lat != null && map.hasLayer(toggles[p.layer]) && passes(p))
          .sort((a, b) => b.rank - a.rank);
        ranked = visible;
        // Spread postings sharing a coordinate; best one stays at the centre.
        const seen = new Map();
        for (const p of visible) {
          const k = p.lat.toFixed(5) + ',' + p.lon.toFixed(5);
          const i = seen.get(k) || 0;
          seen.set(k, i + 1);
          const [dx, dy] = spiral(i);
          p.px = map.project([p.lat, p.lon], zoom).add([dx, dy]);
        }
        const at = (px) => map.unproject(px, zoom);
        // CAR-125 — one pure clustering call at every zoom. Below the spread
        // ceiling it groups aggressively; at/above it mostly separates,
        // catching only the markers that would still overlap. Either way
        // the drawn markers never touch (see clusterMarkers).
        const groups = clusterMarkers(visible, zoom >= SPREAD_ZOOM ? { soloPx: 23 } : { soloPx: 26 });
        for (const g of groups) {
          if (g.members.length === 1) {
            const p = g.members[0];
            register(single(p, at(p.px)).addTo(drawn), [p]);
            continue;
          }
          register(cluster(g.members, at(g.px)).addTo(drawn), g.members);
        }
        syncList();
      }

      // ---- CAR-125: the bounds-synced side list ----
      const LIST_CAP = 200;
      function hot(p, on) {
        markerElByPoint.get(p)?.classList?.toggle('v2-map-marker-hot', on);
      }
      function setListOpen(open) {
        listPanel.classList.toggle('is-open', open);
        listToggle.setAttribute('aria-expanded', String(open));
      }
      function rowFor(p) {
        const badge = p.evaluated
          ? (p.scoreNum != null ? p.scoreNum.toFixed(1) : '')
          : (p.fitBand && p.fitBand !== 'none' ? '◎' : '·');
        const btn = c('button', { className: 'v2-map-row', type: 'button' }, [
          c('span', { className: 'v2-map-row-main' }, [p.company, p.title].filter(Boolean).join(' · ')),
          c('span', { className: 'v2-map-row-meta' }, [badge, p.lines[1] || ''].filter(Boolean).join(' · ')),
        ]);
        btn.addEventListener('click', () => {
          if (coarsePointer()) setListOpen(false); // the peek sheet takes over on phones
          map.panTo([p.lat, p.lon], { animate: true });
          showPeek(p, markerByPoint.get(p) || null, null, { peek: true });
        });
        btn.addEventListener('mouseenter', () => hot(p, true));
        btn.addEventListener('mouseleave', () => hot(p, false));
        btn.addEventListener('focus', () => hot(p, true));
        btn.addEventListener('blur', () => hot(p, false));
        return c('li', null, [btn]);
      }
      function syncList() {
        if (myGen !== gen || !mapEl.isConnected) return;
        let inView = [];
        try {
          const b = map.getBounds().pad(0.02);
          inView = ranked.filter((p) => b.contains([p.lat, p.lon]));
        } catch { return; } // the map is already disposed
        // The geocode storm calls update() (→ here) per lookup; rebuilding
        // ≤200 rows on every tick is waste. The memo is the ordered point
        // IDENTITY (review f3): the old geometry signature (length + first/
        // last lat/lon) stayed unchanged when two same-sized sets shared a
        // place centre, so the list kept showing the PREVIOUS filter's jobs.
        const ids = inView.map((p) => (p.tid ??= ++tidSeq));
        const same = lastListIds && lastListIds.length === ids.length
          && ids.every((id, i) => lastListIds[i] === id);
        if (same) return;
        lastListIds = ids;
        listCount.textContent = String(inView.length);
        listEmpty.hidden = inView.length > 0;
        listMore.hidden = inView.length <= LIST_CAP;
        if (inView.length > LIST_CAP) listMore.textContent = '+' + (inView.length - LIST_CAP) + ' ' + t('map.list.more', 'more in view');
        listRows.replaceChildren(...inView.slice(0, LIST_CAP).map(rowFor), listMore);
      }
      listToggle.addEventListener('click', () => {
        const opening = !listPanel.classList.contains('is-open');
        setListOpen(opening);
        if (opening) listClose.focus();
      });
      listClose.addEventListener('click', () => { setListOpen(false); listToggle.focus(); });

      map.on('zoomend overlayadd overlayremove', render);
      map.on('moveend', syncList);
      map.on('dragstart', () => { userMoved = true; });
      mapEl.addEventListener('wheel', () => { userMoved = true; }, { passive: true });
      map.on('click', () => { if (sheet.classList.contains('is-peek')) hideSheet(); });

      searchInput.addEventListener('input', () => {
        q = searchInput.value.trim(); // raw text — the display keeps the user's case
        savePreferences();
        render();
        update();
      });

      // One geocode per distinct place+employer, progressively.
      const byKey = new Map();
      for (const p of points) {
        if (p.fixed) continue;
        p.places = [...new Set(p.places.map((x) => String(x || '').trim()).filter(Boolean))];
        if (!p.places.length) continue;
        const k = JSON.stringify([p.places, p.company || '']);
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push(p);
      }
      let done = 0;
      const update = () => {
        // CAR-41 (v1.243.0) — consistent per-layer denominators (see
        // mapLayerStats above): located / total / without-a-location are all
        // counts over the SAME active-layer point set.
        const s = mapLayerStats(points, (layer) => map.hasLayer(toggles[layer]));
        const visible = points.filter((p) => p.lat != null && map.hasLayer(toggles[p.layer]) && passes(p)).length;
        status.textContent = t('map.progress', 'Places located') + ': ' + s.located + '/' + s.total;
        // CAR-125 — «Without a location: N» is a control that leads to
        // #/scan; hidden while there is nothing to show.
        noLocBtn.textContent = t('map.noLocation', 'Without a location') + ': ' + s.noLoc;
        noLocBtn.hidden = s.noLoc === 0;
        statusChip.textContent = t('map.visible', '{visible} / {total} mapped')
          .replace('{visible}', visible).replace('{total}', s.total);
        syncList();
      };
      // CAR-41 — the header stats follow the layer toggles, so the located
      // counter is bound to what is actually shown (registered after `update`
      // exists; Leaflet handlers fire later, but the binding is eager).
      map.on('overlayadd overlayremove', update);
      // Frame where most postings are (10th–90th percentile box), so a few
      // far-away outliers don't zoom the whole region into one blob.
      const fit = (force = false) => {
        if (userMoved && !force) return;
        const placed = points.filter((p) => p.lat != null && map.hasLayer(toggles[p.layer]) && passes(p));
        if (!placed.length) return;
        const lats = placed.map((p) => p.lat).sort((a, b) => a - b);
        const lons = placed.map((p) => p.lon).sort((a, b) => a - b);
        const cut = placed.length < 10 ? 0 : Math.floor(0.1 * placed.length);
        const hi = placed.length - 1 - cut;
        map.fitBounds([[lats[cut], lons[cut]], [lats[hi], lons[hi]]],
          { maxZoom: 9, padding: [30, 30] });
      };
      function savePreferences() {
        MapPrefs?.saveMap({
          scoreMin: minScore,
          showUnevaluated: unevaluated.checked,
          q: searchInput.value.trim(),
          layers: Object.fromEntries(Object.keys(layerInputs).map((layer) => [layer, layerInputs[layer].checked])),
        });
        MapPrefs?.saveCommute({
          maxMinutes: commuteFilter.value ? Number(commuteFilter.value) : null,
          showUnknown: unknownCommute.checked,
        });
      }
      function filtersChanged() { savePreferences(); render(); update(); }
      ;[unevaluated, commuteFilter, unknownCommute].forEach((control) => control.addEventListener('input', filtersChanged));
      // CAR-125 — the filter chips: pressed state is the single source the
      // paint function reads, so Reset and the handlers stay in sync.
      function paintChips() {
        for (const chip of specChips.querySelectorAll('.v2-map-chip')) {
          const on = chip.dataset.spec ? chip.dataset.spec === specialization : !specialization;
          chip.classList.toggle('is-active', on);
          chip.setAttribute('aria-pressed', String(on));
        }
        for (const chip of scoreChips.querySelectorAll('.v2-map-chip')) {
          const on = chip.dataset.score ? Number(chip.dataset.score) === minScore : minScore == null;
          chip.classList.toggle('is-active', on);
          chip.setAttribute('aria-pressed', String(on));
        }
      }
      scoreChips.replaceChildren(
        ...[null, ...SCORE_BANDS].map((band) => c('button', {
          className: 'v2-map-chip', type: 'button', 'aria-pressed': 'false',
          ...(band != null ? { 'data-score': String(band) } : {}),
        }, band == null ? t('map.filter.allScores', 'All scores')
          : t('map.filter.scoreAtLeast', 'Score ≥ {n}').replace('{n}', band))),
      );
      specChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.v2-map-chip');
        if (!chip) return;
        specialization = chip.dataset.spec || '';
        paintChips();
        filtersChanged();
      });
      scoreChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.v2-map-chip');
        if (!chip) return;
        minScore = chip.dataset.score ? Number(chip.dataset.score) : null;
        paintChips();
        filtersChanged();
      });
      paintChips();
      for (const [layer, control] of Object.entries(layerInputs)) control.addEventListener('input', () => {
        if (control.checked) toggles[layer].addTo(map); else toggles[layer].removeFrom(map);
        filtersChanged();
      });
      resetBtn.addEventListener('click', () => {
        MapPrefs?.reset();
        searchInput.value = '';
        q = '';
        specialization = '';
        minScore = null;
        paintChips();
        unevaluated.checked = true;
        commuteFilter.value = '';
        unknownCommute.checked = true;
        for (const [layer, control] of Object.entries(layerInputs)) {
          control.checked = true;
          if (!map.hasLayer(toggles[layer])) toggles[layer].addTo(map);
        }
        filtersChanged();
      });
      fitBtn.addEventListener('click', () => { fit(true); if (coarsePointer()) hideSheet({ restore: true }); });
      filterButton.addEventListener('click', () => {
        const opening = !sheet.classList.contains('is-open') || sheet.classList.contains('is-peek');
        if (!opening) { hideSheet({ restore: true }); return; }
        filtersBody.hidden = false;
        sheet.querySelector('.job-map-filter-actions').hidden = false;
        peek.hidden = true;
        sheet.classList.add('is-open');
        sheet.classList.remove('is-peek');
        filterButton.setAttribute('aria-expanded', 'true');
        syncSheetOffset();
        unevaluated.focus({ preventScroll: true });
      });
      closeSheet.addEventListener('click', () => hideSheet({ restore: true }));
      sheet.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideSheet({ restore: true }); });
      if (window.ResizeObserver) {
        sheetObs = new ResizeObserver(syncSheetOffset);
        sheetObs.observe(sheet);
      }
      update();
      // A few lookups in flight: cached places answer at once, while the server
      // still sends uncached ones to Nominatim one by one.
      const queue = [...byKey.values()];
      const worker = async () => {
        for (let group; (group = queue.shift());) {
          if (myGen !== gen) return;
          const company = group[0].company || '';
          let pos = null;
          for (const loc of group[0].places) {
            try {
              pos = await API.get('/api/geocode?q=' + encodeURIComponent(geoQuery(loc)) + '&company=' + encodeURIComponent(company.slice(0, 200)));
            } catch { pos = null; }
            if (pos && pos.lat != null) break;
          }
          done++;
          if (!pos || pos.lat == null) group.forEach((p) => { p.geoDone = true; });
          else group.forEach((p) => { p.lat = pos.lat; p.lon = pos.lon; p.exact = !!pos.exact; });
          // Redraw in batches — cheap, but not per lookup; frame the map once early.
          if (done === 1) fit();
          if (done === 1 || done % 8 === 0) render();
          update();
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      if (myGen !== gen) return;
      fit();
      render();
    }, 0);

    return page;
  });
})();
