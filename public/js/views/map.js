/* global Router, API, UI, I18n, L, MapPrefs, PostingUrlKey */
/**
 * #/map — scan results, pending pipeline and tracked applications on an
 * OpenStreetMap map.
 *
 * Two kinds of dot: FILLED = an evaluation score (tracker, ScoreTone tiers),
 * RING = a free title-fit hint (pipeline/scan: two-pager FitScore, else the
 * title-fit band). Positions come from /api/geocode (server-side Nominatim,
 * cached): the employer's own address when OSM knows it, else the place centre.
 *
 * Postings on the same coordinate are spread on a small pixel spiral. Zoomed
 * out (< SPREAD_ZOOM), dots of the same kind closer than CLUSTER_PX merge into
 * one counted marker coloured by its best posting; clicking it zooms in.
 * Evaluated dots never merge with pending rings, so they never vanish into a
 * pipeline crowd. No plugin — a greedy pass per zoom change.
 */
(function () {
  const SPREAD_ZOOM = 11;
  const CLUSTER_PX = 20;
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
  function spiral(i) {
    if (i === 0) return [0, 0];
    const a = i * 2.39996;
    const r = 11 * Math.sqrt(i);
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

  Router.register('map', async () => {
    const c = UI.el;
    const t = (k, f) => I18n.t(k, f);
    const myGen = ++gen;
    document.body.classList.add('job-map-active');

    const [scan, jobs, tp, commute] = await Promise.all([
      API.get('/api/scan-results').catch(() => ({})),
      API.get('/api/map/jobs').catch(() => ({ pipeline: [], tracker: [] })),
      API.get('/api/two-pager').catch(() => ({})),
      API.get('/api/commute').catch(() => null),
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
    const mapPrefs = MapPrefs ? MapPrefs.loadMap() : { scoreMin: null, showUnevaluated: true, layers: { scan: true, pipeline: true, tracker: true } };
    const commutePrefs = MapPrefs ? MapPrefs.loadCommute() : { maxMinutes: null, showUnknown: true };
    const scoreFilter = c('select', { className: 'select', 'aria-label': t('map.filter.score', 'Minimum evaluation score') }, [
      c('option', { value: '' }, t('map.filter.allScores', 'All scores')),
      ...[3, 3.8, 4.2].map((n) => c('option', { value: String(n) }, t('map.filter.scoreAtLeast', 'Score ≥ {n}').replace('{n}', n))),
    ]);
    scoreFilter.value = mapPrefs.scoreMin == null ? '' : String(mapPrefs.scoreMin);
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
      c('div', { className: 'job-map-filter-group' }, [scoreFilter, check(unevaluated, t('map.filter.unevaluated', 'Show unevaluated jobs'))]),
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
    const mapWrap = c('div', { className: 'job-map-wrap' }, [mapEl, statusChip, filterButton, sheet]);
    const page = c('div', { className: 'job-map-page' }, [
      c('header', { className: 'page-header' }, [
        c('div', null, [
          c('h1', { className: 'page-title' }, t('map.title', 'Job map')),
          status,
        ]),
      ]),
      mapWrap,
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
      function showPeek(point, marker, event) {
        if (!coarsePointer()) { point.open?.(); return; }
        if (event?.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
        selectedMarker = marker;
        filtersBody.hidden = true;
        sheet.querySelector('.job-map-filter-actions').hidden = true;
        peek.hidden = false;
        peek.textContent = '';
        const card = c('div', { className: 'job-map-peek-card', role: 'button', tabIndex: 0 }, [
          c('strong', null, [point.company, point.title].filter(Boolean).join(' · ')),
          c('span', null, point.label || t('map.filter.unevaluatedShort', 'Unevaluated')),
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
        const size = Math.max(36, Math.round(24 + Math.min(16, Math.log2(n) * 4)));
        const el = document.createElement('div');
        el.className = 'job-cluster' + (best.filled ? '' : ' ring');
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
          map.fitBounds(L.latLngBounds(members.map((p) => [p.lat, p.lon])).pad(0.3),
            { maxZoom: Math.max(map.getZoom() + 2, SPREAD_ZOOM) });
        });
        return m;
      };

      function passes(point) {
        const minScore = scoreFilter.value ? Number(scoreFilter.value) : null;
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

      function render() {
        drawn.clearLayers();
        const zoom = map.getZoom();
        const visible = points.filter((p) => p.lat != null && map.hasLayer(toggles[p.layer]) && passes(p))
          .sort((a, b) => b.rank - a.rank);
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
        if (zoom >= SPREAD_ZOOM) {
          for (const p of visible) single(p, at(p.px)).addTo(drawn);
          return;
        }
        // Greedy: the best unassigned dot collects its own kind within CLUSTER_PX.
        const free = new Set(visible);
        for (const lead of visible) {
          if (!free.has(lead)) continue;
          const members = visible.filter((p) => free.has(p) && p.filled === lead.filled
            && p.px.distanceTo(lead.px) <= CLUSTER_PX);
          members.forEach((p) => free.delete(p));
          if (members.length === 1) { single(lead, at(lead.px)).addTo(drawn); continue; }
          const mid = members.reduce((s, p) => s.add(p.px), L.point(0, 0)).divideBy(members.length);
          cluster(members, at(mid)).addTo(drawn);
        }
      }
      map.on('zoomend overlayadd overlayremove', render);
      map.on('dragstart', () => { userMoved = true; });
      mapEl.addEventListener('wheel', () => { userMoved = true; }, { passive: true });
      map.on('click', () => { if (sheet.classList.contains('is-peek')) hideSheet(); });

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
        status.textContent = t('map.progress', 'Places located') + ': ' + s.located + '/' + s.total
          + ' · ' + t('map.noLocation', 'Without a location') + ': ' + s.noLoc;
        statusChip.textContent = t('map.visible', '{visible} / {total} mapped')
          .replace('{visible}', visible).replace('{total}', s.total);
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
          scoreMin: scoreFilter.value ? Number(scoreFilter.value) : null,
          showUnevaluated: unevaluated.checked,
          layers: Object.fromEntries(Object.keys(layerInputs).map((layer) => [layer, layerInputs[layer].checked])),
        });
        MapPrefs?.saveCommute({
          maxMinutes: commuteFilter.value ? Number(commuteFilter.value) : null,
          showUnknown: unknownCommute.checked,
        });
      }
      function filtersChanged() { savePreferences(); render(); update(); }
      ;[scoreFilter, unevaluated, commuteFilter, unknownCommute].forEach((control) => control.addEventListener('input', filtersChanged));
      for (const [layer, control] of Object.entries(layerInputs)) control.addEventListener('input', () => {
        if (control.checked) toggles[layer].addTo(map); else toggles[layer].removeFrom(map);
        filtersChanged();
      });
      resetBtn.addEventListener('click', () => {
        MapPrefs?.reset();
        scoreFilter.value = '';
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
        scoreFilter.focus({ preventScroll: true });
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
