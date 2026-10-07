/* global Router, API, UI, I18n, L */
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
  const SCORE_COLORS = { good: '#008a05', warn: '#e0a100', muted: '#2b6cb0', bad: '#ff385c', none: '#9a9a9a' };
  const FIT_COLORS = { strong: '#008a05', related: '#2b6cb0', weak: '#a0a0a0', none: '#a0a0a0' };
  const FIT_RANK = { strong: 3, related: 2, weak: 1, none: 0 };

  // Generation counter — a newer render (or leaving the route) stops the
  // previous view's geocode loop.
  let gen = 0;
  // The live Leaflet instance: removed on leaving or re-rendering, or its
  // window listeners outlive the detached container.
  let live = null;
  const drop = () => { if (live) { live.remove(); live = null; } };
  // Only on leaving: the router's hashchange listener runs first, so arriving at
  // #/map has already claimed a fresh gen — bumping it here would kill that render.
  window.addEventListener('hashchange', () => { if (Router.current().name !== 'map') { gen++; drop(); } });

  const urlKey = (u) => {
    try { const x = new URL(u); return (x.host + x.pathname).replace(/\/+$/, '').toLowerCase(); }
    catch { return ''; }
  };
  // The server keeps the first place of a multi-location cell and refuses only
  // a query over its MAX_QUERY (2000) — cap the raw cell to that, nothing more.
  const geoQuery = (loc) => String(loc).slice(0, 2000);
  const openUrl = (u) => (/^https?:\/\//i.test(u || '') ? () => window.open(u, '_blank', 'noopener') : null);

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
    return { tone, num: has ? num : 0, label: r.score && r.score !== '—' ? r.score : '' };
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

  Router.register('map', async () => {
    const c = UI.el;
    const t = (k, f) => I18n.t(k, f);
    const myGen = ++gen;

    const [scan, jobs, tp] = await Promise.all([
      API.get('/api/scan-results').catch(() => ({})),
      API.get('/api/map/jobs').catch(() => ({ pipeline: [], tracker: [] })),
      API.get('/api/two-pager').catch(() => ({})),
    ]);
    const twoPager = tp && tp.twoPager;

    const scanRows = [];
    for (const region of ['en', 'ru']) {
      for (const r of (scan?.[region]?.filtered || [])) scanRows.push(r);
    }
    const locByUrl = new Map(scanRows.filter((r) => r.url && r.location).map((r) => [urlKey(r.url), r.location]));

    // Uniform point: { layer, places, company, filled, color, rank, label, title, lines, open }
    // `places` are tried in order until one geocodes to a settlement.
    const points = [];
    const fitPoint = (layer, r, href) => {
      const { band, label } = fitOf(r, twoPager);
      points.push({
        layer, places: [r.location], company: r.company, filled: false,
        color: FIT_COLORS[band], rank: FIT_RANK[band], label: label ? t('map.fit', 'Fit') + ': ' + label : '',
        title: r.title, lines: [r.company, r.location,
          [r.workplaceType || (r.isRemote ? 'Remote' : ''), r.salary].filter(Boolean).join(' · ')],
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
        label: s.label ? t('map.score', 'Score') + ': ' + s.label : '',
        title: r.role, lines: [r.company, r.workplace || location, r.status],
        open: r.reportPath
          ? () => Router.go('/reports/' + r.reportPath.replace(/^(\.\.\/)*reports\//, '').replace(/\.md$/, ''))
          : openUrl(r.href),
      });
    }

    const mapEl = c('div', { className: 'job-map', id: 'job-map' });
    const status = c('p', { className: 'page-subtitle', role: 'status', 'aria-live': 'polite' }, '');

    // Leaflet needs the container in the DOM with a size — init after the
    // router has mounted the returned node.
    setTimeout(async () => {
      if (myGen !== gen || !mapEl.isConnected || !window.L) return;
      // World view until the first places are located; fit() then frames the data.
      drop();
      const map = live = L.map(mapEl, { worldCopyJump: true }).setView([20, 0], 2);
      const tiles = jobs.tiles || {};
      L.tileLayer(tiles.url || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        // OSM's tile policy rejects requests without a Referer, and the app-wide
        // Referrer-Policy is same-origin. Send the bare origin for tiles only.
        referrerPolicy: 'strict-origin-when-cross-origin',
        // MAP_TILE_ATTRIBUTION arrives HTML-escaped from the server.
        attribution: tiles.attribution || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      // Rings under clusters (markerPane 600) under evaluated dots.
      map.createPane('scorePane').style.zIndex = 620;   // above clusters (600), below tooltips (650)

      // Layer toggles are empty groups; the actual markers live in `drawn` and
      // are rebuilt from the visible layers on every zoom/toggle.
      const toggles = { scan: L.layerGroup().addTo(map), pipeline: L.layerGroup().addTo(map), tracker: L.layerGroup().addTo(map) };
      L.control.layers(null, {
        [t('map.layerScan', 'Scan results')]: toggles.scan,
        [t('map.layerPipeline', 'Pipeline (pending)')]: toggles.pipeline,
        [t('map.layerTracker', 'Tracker')]: toggles.tracker,
      }, { collapsed: false }).addTo(map);
      const drawn = L.layerGroup().addTo(map);
      // Stop auto-fitting once the user pans/zooms themselves.
      let userMoved = false;

      const legend = L.control({ position: 'bottomleft' });
      legend.onAdd = () => {
        const box = L.DomUtil.create('div', 'job-map-legend');
        [
          ['dot', t('map.legend.score', 'Filled: evaluation score (tracker)')],
          ['ring', t('map.legend.fit', 'Ring: title fit, not evaluated (pipeline, scan)')],
          ['', t('map.legend.colors', 'green good · yellow ok · blue medium · red weak · grey none')],
          ['count', t('map.legend.count', 'Number: grouped postings, zoom in to spread')],
          ['', t('map.legend.exact', '📍 company address, otherwise place centre')],
        ].forEach(([kind, text]) => {
          const row = L.DomUtil.create('div', '', box);
          if (kind) L.DomUtil.create('span', 'job-map-swatch ' + kind, row).textContent = kind === 'count' ? '3' : '';
          row.appendChild(document.createTextNode(text));
        });
        return box;
      };
      legend.addTo(map);

      const single = (p, at) => {
        const m = L.circleMarker(at, p.filled
          ? { pane: 'scorePane', radius: 8, color: '#fff', weight: 1.5, fillColor: p.color, fillOpacity: 0.95 }
          : { radius: 6, color: p.color, weight: 2.5, fillColor: '#fff', fillOpacity: 0.85 });
        m.bindTooltip(tip([p.title, ...p.lines, p.label, p.exact ? '📍 ' + t('map.exact', 'Company address') : '']),
          { direction: 'top', offset: [0, -6] });
        if (p.open) m.on('click', p.open);
        return m;
      };

      const cluster = (members, at) => {
        const best = members[0];               // members are sorted by rank
        const n = members.length;
        const size = Math.round(24 + Math.min(16, Math.log2(n) * 4));
        const el = document.createElement('div');
        el.className = 'job-cluster' + (best.filled ? '' : ' ring');
        el.style.setProperty('--c', best.color);
        el.style.width = el.style.height = size + 'px';
        el.textContent = String(n);
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

      function render() {
        drawn.clearLayers();
        const zoom = map.getZoom();
        const visible = points.filter((p) => p.lat != null && map.hasLayer(toggles[p.layer]))
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

      // One geocode per distinct place+employer, progressively.
      const byKey = new Map();
      let noLoc = 0;
      for (const p of points) {
        p.places = [...new Set(p.places.map((x) => String(x || '').trim()).filter(Boolean))];
        if (!p.places.length) { noLoc++; continue; }
        const k = JSON.stringify([p.places, p.company || '']);
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push(p);
      }
      let done = 0;
      const update = () => {
        status.textContent = t('map.progress', 'Places located') + ': ' + done + '/' + byKey.size
          + ' · ' + t('map.noLocation', 'Without a location') + ': ' + noLoc;
      };
      // Frame where most postings are (10th–90th percentile box), so a few
      // far-away outliers don't zoom the whole region into one blob.
      const fit = () => {
        if (userMoved) return;
        const placed = points.filter((p) => p.lat != null);
        if (!placed.length) return;
        const lats = placed.map((p) => p.lat).sort((a, b) => a - b);
        const lons = placed.map((p) => p.lon).sort((a, b) => a - b);
        const cut = placed.length < 10 ? 0 : Math.floor(0.1 * placed.length);
        const hi = placed.length - 1 - cut;
        map.fitBounds([[lats[cut], lons[cut]], [lats[hi], lons[hi]]],
          { maxZoom: 9, padding: [30, 30] });
      };
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
          if (!pos || pos.lat == null) noLoc += group.length;
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

    return c('div', null, [
      c('header', { className: 'page-header' }, [
        c('div', null, [
          c('h1', { className: 'page-title' }, t('map.title', 'Job map')),
          status,
        ]),
      ]),
      mapEl,
    ]);
  });
})();
