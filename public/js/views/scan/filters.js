/* global window */
/**
 * scan/filters.js — the #/scan result-filter state machine (file-size split of
 * views/scan.js, P-16; CAR-115 turned it into the ONE filter system: live
 * apply + URL state + active-chip descriptors + saved-search presets).
 *
 * Factory: `window.createScanFilters(refs, deps)`
 *   refs = { filterText, filterExclude, filterRemote, filterSalaryMin, filterSalaryMax,
 *            filterSource, filterCountry, filterSeniority, filterScope, filterAge, favOnly,
 *            activeTech, activeLevel, activeDynamic }
 *   deps = { pager, SR, view?, t? } — `view` (optional) receives the api back
 *   (`view.filtersApi = api`) so scan-results can render the active-filter bar.
 *   → { applyFilters, resetFilters, getFilterState, setFilterState,
 *       commitFilters, filtersFromUrl, urlFromFilters, buildActiveBar, presetsBar }
 *
 * CAR-115 contract:
 *   - applyFilters() keeps the pinned minimal body (pager.reset + SR.render);
 *     the LIVE path is commitFilters() = applyFilters + URL sync.
 *   - Filter state serializes into the hash query (#/scan?q=…&src=…) via
 *     history.replaceState — shareable URLs, no history spam, no hashchange
 *     re-render loop. Every writer (commit/reset/preset/sort) funnels through
 *     syncUrl(); URL is DERIVED state, the DOM elements stay the source.
 */
(function () {
  window.createScanFilters = function (refs, deps) {
    const {
      filterText, filterExclude, filterRemote, filterSalaryMin, filterSalaryMax,
      filterSource, filterCountry, filterSeniority, filterScope, filterAge, favOnly,
      activeTech, activeLevel, activeDynamic,
    } = refs;
    // CAR-115 — optional: the "include without salary" toggle (older harnesses
    // build refs without it; every access is guarded).
    const salaryAny = refs.filterSalaryAny || null;
    const { pager, SR } = deps;
    const t = deps.t || ((k, f) => f);

    // v1.68.0 — filters are now Apply-driven (was live-on-input). CAR-115
    // restored LIVE filtering (debounced at the input, immediate on selects)
    // but the canonical apply keeps its pinned minimal body.
    function applyFilters() { pager.reset(); SR.render(); }
    // CAR-115 — the live path: apply + mirror the state into the URL.
    function commitFilters() { applyFilters(); syncUrl(); }
    function resetFilters() {
      filterText.value = '';
      filterExclude.value = '';
      filterRemote.value = '';
      filterSalaryMin.value = '';
      filterSalaryMax.value = '';
      filterSource.value = '';
      filterCountry.value = '';
      filterSeniority.value = '';
      filterScope.value = 'all';
      filterAge.value = '';
      favOnly.checked = false;
      // CAR-93 — clear any pending saved-search stash (dataset.want); a
      // reset must not leave a stale country/seniority/source wish that
      // paint*Options would re-apply on the next repaint.
      filterSource.dataset.want = '';
      filterCountry.dataset.want = '';
      filterSeniority.dataset.want = '';
      activeTech.clear(); activeLevel.clear(); activeDynamic.clear();
      applyFilters();
      syncUrl();
    }
    // v1.80.0 — capture/restore the whole filter set for saved searches.
    function getFilterState() {
      return {
        text: filterText.value, exclude: filterExclude.value, remote: filterRemote.value,
        salaryMin: filterSalaryMin.value, salaryMax: filterSalaryMax.value,
        source: filterSource.value, country: filterCountry.value,
        seniority: filterSeniority.value,
        scope: filterScope.value, age: filterAge.value, favOnly: favOnly.checked,
        salaryAny: !!(salaryAny && salaryAny.checked),
        tech: [...activeTech], level: [...activeLevel], dynamic: [...activeDynamic],
      };
    }
    function setFilterState(s) {
      s = s || {};
      filterText.value = s.text || '';
      filterExclude.value = s.exclude || '';
      filterRemote.value = s.remote || '';
      filterSalaryMin.value = s.salaryMin || '';
      filterSalaryMax.value = s.salaryMax || '';
      filterSource.value = s.source || '';
      filterCountry.value = s.country || '';
      filterSeniority.value = s.seniority || '';
      filterScope.value = s.scope || 'all';
      filterAge.value = s.age || '';
      favOnly.checked = !!s.favOnly;
      if (salaryAny) salaryAny.checked = !!s.salaryAny;
      // CAR-93 — the source/country/seniority options are painted FROM the
      // result corpus (paintSourceOptions / paintCountryOptions /
      // paintSeniorityOptions), so at restore time the option matching the
      // saved value may not exist yet: the assignment silently falls back
      // to '' and the repaint then preserves the empty choice — saved
      // searches lost those filters. Stash the desired value on the
      // element; the paint* helpers apply it (and clear the stash) once
      // the option exists. A manual change voids the stash (scan.js), and
      // resetFilters clears it.
      filterSource.dataset.want = s.source || '';
      filterCountry.dataset.want = s.country || '';
      filterSeniority.dataset.want = s.seniority || '';
      activeTech.clear(); (Array.isArray(s.tech) ? s.tech : []).forEach((x) => activeTech.add(x));
      activeLevel.clear(); (Array.isArray(s.level) ? s.level : []).forEach((x) => activeLevel.add(x));
      activeDynamic.clear(); (Array.isArray(s.dynamic) ? s.dynamic : []).forEach((x) => activeDynamic.add(x));
      applyFilters();
    }

    // ── CAR-115: URL state (#/scan?q=…&src=…) ─────────────────────────────
    // DOM elements are the source of truth; the URL is a serialized mirror.
    // applyFromUrl maps params → setFilterState (sort handled by the caller:
    // scan.js reads sort/dir itself for scan-results).
    function filtersFromUrl(hash) {
      const qs = String(hash || '').split('?')[1] || '';
      if (!qs) return null;
      const p = new URLSearchParams(qs);
      const has = (k) => p.has(k);
      if (!['q', 'ex', 'type', 'smin', 'smax', 'nsal', 'src', 'cc', 'sen', 'age', 'scope', 'fav', 'tech', 'lvl', 'kw'].some(has)) return null;      return {
        text: p.get('q') || '', exclude: p.get('ex') || '', remote: p.get('type') || '',
        salaryMin: p.get('smin') || '', salaryMax: p.get('smax') || '',
        source: p.get('src') || '', country: p.get('cc') || '', seniority: p.get('sen') || '',
        scope: p.get('scope') || 'all', age: p.get('age') || '', favOnly: p.get('fav') === '1',
        salaryAny: p.get('nsal') === '1',
        tech: (p.get('tech') || '').split(',').filter(Boolean),
        level: (p.get('lvl') || '').split(',').filter(Boolean),
        dynamic: (p.get('kw') || '').split(',').filter(Boolean),
      };
    }
    function urlFromFilters(extra) {
      const s = getFilterState();
      const p = new URLSearchParams();
      if (s.text) p.set('q', s.text);
      if (s.exclude) p.set('ex', s.exclude);
      if (s.remote) p.set('type', s.remote);
      if (s.salaryMin) p.set('smin', s.salaryMin);
      if (s.salaryMax) p.set('smax', s.salaryMax);
      if (s.source) p.set('src', s.source);
      if (s.country) p.set('cc', s.country);
      if (s.seniority) p.set('sen', s.seniority);
      if (s.scope && s.scope !== 'all') p.set('scope', s.scope);
      if (s.age) p.set('age', s.age);
      if (s.favOnly) p.set('fav', '1');
      if (s.salaryAny) p.set('nsal', '1');
      if (s.tech.length) p.set('tech', s.tech.join(','));
      if (s.level.length) p.set('lvl', s.level.join(','));
      if (s.dynamic.length) p.set('kw', s.dynamic.join(','));
      if (extra) for (const [k, v] of Object.entries(extra)) {
        if (v != null && v !== '') p.set(k, String(v));
      }
      return p.toString();
    }
    function syncUrl(extra) {
      try {
        if (typeof window === 'undefined' || !window.history || !window.location) return;
        const qs = urlFromFilters(extra);
        const base = (window.location.hash || '#/scan').split('?')[0];
        const next = base === '#/scan' ? base : '#/scan';
        window.history.replaceState(null, '', next + (qs ? '?' + qs : ''));
      } catch { /* a sandboxed/history-less env just skips the mirror */ }
    }

    // ── CAR-115: active-filter chips ──────────────────────────────────────
    // One descriptor per engaged filter; scan-results renders the bar and
    // every chip carries a ✕ that clears exactly that filter (and a
    // data-chip identity so focus survives the rebuild).
    function activeDescriptors() {
      const out = [];
      const add = (key, label, value, clear) => {
        if (value !== '' && value != null && value !== false) out.push({ key, label, value: String(value), clear });
      };
      add('q', t('scan.lblSearch', 'Search'), filterText.value, () => { filterText.value = ''; });
      add('ex', t('scan.lblExclude', 'Exclude'), filterExclude.value, () => { filterExclude.value = ''; });
      const typeLabel = { remote: t('scan.remoteOnly', 'Remote only'), hybrid: t('scan.hybrid', 'Hybrid'), onsite: t('scan.onsite', 'on-site'), reloc: t('scan.reloc', 'Relocation') }[filterRemote.value];
      if (typeLabel) out.push({ key: 'type', label: t('scan.lblType', 'Work type'), value: typeLabel, clear: () => { filterRemote.value = ''; } });
      add('smin', t('scan.salaryFrom', 'Salary from'), filterSalaryMin.value, () => { filterSalaryMin.value = ''; });
      add('smax', t('scan.salaryTo', 'Salary to'), filterSalaryMax.value, () => { filterSalaryMax.value = ''; });
      const srcEl = filterSource.selectedOptions && filterSource.selectedOptions[0];
      add('src', t('scan.lblSource', 'Source'), filterSource.value ? (srcEl ? srcEl.textContent : filterSource.value) : '', () => { filterSource.value = ''; filterSource.dataset.want = ''; });
      const ccEl = filterCountry.selectedOptions && filterCountry.selectedOptions[0];
      add('cc', t('scan.lblCountry', 'Country'), filterCountry.value ? (ccEl ? ccEl.textContent : filterCountry.value) : '', () => { filterCountry.value = ''; filterCountry.dataset.want = ''; });
      const senEl = filterSeniority.selectedOptions && filterSeniority.selectedOptions[0];
      add('sen', t('scan.lblSeniority', 'Seniority'), filterSeniority.value ? (senEl ? senEl.textContent : filterSeniority.value) : '', () => { filterSeniority.value = ''; filterSeniority.dataset.want = ''; });
      add('age', t('scan.lblAge', 'Posted within'), filterAge.value ? (filterAge.value === '1' ? t('scan.age1d', '24h') : filterAge.value === '7' ? t('scan.age7d', '7d') : t('scan.age30d', '30d')) : '', () => { filterAge.value = ''; });
      if (filterScope.value === 'fresh') out.push({ key: 'scope', label: t('scan.lblScope', 'Scope'), value: t('scan.scopeFresh', 'Fresh'), clear: () => { filterScope.value = 'all'; } });
      if (favOnly.checked) out.push({ key: 'fav', label: '', value: t('scan.favOnly', '★ Favorites'), clear: () => { favOnly.checked = false; } });
      const setChip = (key, set, clearAll) => {
        if (!set.size) return;
        out.push({ key, label: '', value: [...set].join(', '), clear: clearAll });
      };
      setChip('tech', activeTech, () => activeTech.clear());
      setChip('lvl', activeLevel, () => activeLevel.clear());
      setChip('kw', activeDynamic, () => activeDynamic.clear());
      return out;
    }

    function buildActiveBar(c, onChange) {
      const bar = c('div', { className: 'v2-scan-active', role: 'group', 'aria-label': t('scan.v2.activeFilters', 'Active filters') });
      const items = activeDescriptors();
      if (!items.length) return bar;
      for (const d of items) {
        const chip = c('span', {
          className: 'chip on v2-scan-chip',
          role: 'button', tabindex: '0', 'aria-pressed': 'true', 'data-chip': 'active-' + d.key,
          onClick: () => { d.clear(); onChange(); },
          onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); d.clear(); onChange(); } },
        }, [
          d.label ? d.label + ': ' : '',
          d.value,
          c('span', { className: 'v2-scan-x', role: 'img', 'aria-label': t('scan.v2.removeFilter', 'Remove filter') + ': ' + (d.label ? d.label + ' ' : '') + d.value }, '✕'),
        ]);
        bar.appendChild(chip);
      }
      bar.appendChild(c('span', {
        className: 'chip clear v2-scan-chip',
        role: 'button', tabindex: '0', 'data-chip': 'active-reset',
        onClick: () => { resetAll(); onChange(); },
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resetAll(); onChange(); } },
      }, t('scan.v2.resetAll', 'Reset all')));
      return bar;
    }
    function resetAll() { resetFilters(); }

    // ── CAR-115: saved searches as preset chips (+ Save current) ──────────
    // Replaces the v1.244.2 select/input/Save/Delete sub-card: presets are
    // chips above the table (click = load), each with an inline ✕ (confirm-
    // gated delete), plus one “＋ Save current” chip that opens the name
    // field inline. All state stays in window.ScanPrefs (localStorage).
    function presetsBar(c, t2, opts) {
      const tt = t2 || t;
      const bar = c('div', { className: 'v2-scan-presets', role: 'group', 'aria-label': tt('scan.savedSearches', 'Saved searches') });
      const searches = (window.ScanPrefs && window.ScanPrefs.listSearches()) || [];
      if (!searches.length) {
        // Reuses the old select's placeholder key — the empty state reads
        // the same in both shapes (CAR-115 keeps the dict untouched).
        bar.appendChild(c('span', { className: 'chip v2-scan-preset-empty' },
          tt('scan.savedNone', 'Saved searches…')));
      }
      for (const s of searches) {
        const chip = c('span', { className: 'chip v2-scan-preset' }, [
          c('span', {
            role: 'button', tabindex: '0', 'data-chip': 'preset-' + s.name,
            'aria-label': tt('scan.v2.loadSearch', 'Load saved search') + ': ' + s.name,
            title: tt('scan.v2.loadSearch', 'Load saved search') + ': ' + s.name,
            onClick: () => { setFilterState(s.filters); syncUrl(); if (opts && opts.onLoad) opts.onLoad(s); },
            onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilterState(s.filters); syncUrl(); if (opts && opts.onLoad) opts.onLoad(s); } },
          }, s.name),
          c('span', {
            className: 'v2-scan-x', role: 'button', tabindex: '0', 'data-chip': 'preset-del-' + s.name,
            'aria-label': tt('scan.v2.deleteSearchNamed', 'Delete saved search') + ': ' + s.name,
            title: tt('scan.deleteSearch', 'Delete') + ': ' + s.name,
            onClick: async (e) => {
              e.stopPropagation();
              const ok = await window.UI.confirm(
                tt('scan.deleteSearch', 'Delete') + ': ' + s.name,
                tt('scan.v2.deleteSearchConfirm', 'Delete this saved search?'),
                { danger: true, confirmLabel: tt('scan.deleteSearch', 'Delete') });
              if (!ok) return;
              window.ScanPrefs.removeSearch(s.name);
              window.UI.toast(tt('scan.savedDeleted', 'Search deleted'), 'success');
              if (opts && opts.onChange) opts.onChange();
            },
            onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.click(); } },
          }, '✕'),
        ]);
        bar.appendChild(chip);
      }
      // “＋ Save current” — the only writer; validates the name like before.
      const nameIn = c('input', {
        className: 'input v2-scan-preset-name', type: 'text',
        placeholder: tt('scan.savedName', 'Name this search…'),
        'aria-label': tt('scan.savedName', 'Name this search…'),
      });
      const saveBtn = c('button', {
        className: 'btn btn-ghost btn-sm', type: 'button',
        onClick: () => {
          const name = (nameIn.value || '').trim();
          if (!name) { window.UI.toast(tt('scan.savedNeedName', 'Enter a name to save the search'), 'error'); return; }
          window.ScanPrefs.saveSearch(name, getFilterState());
          nameIn.value = '';
          nameIn.hidden = true; saveBtn.hidden = true; addChip.hidden = false;
          window.UI.toast(tt('scan.savedOk', 'Search saved'), 'success');
          if (opts && opts.onChange) opts.onChange();
        },
      }, '💾 ' + tt('scan.saveSearch', 'Save search'));
      saveBtn.hidden = true;
      const addChip = c('span', {
        className: 'chip v2-scan-preset-add',
        role: 'button', tabindex: '0', 'data-chip': 'preset-add',
        'aria-label': tt('scan.saveSearch', 'Save search'),
        'aria-expanded': 'false',
        onClick: () => {
          const open = nameIn.hidden;
          nameIn.hidden = !open; saveBtn.hidden = !open;
          addChip.setAttribute('aria-expanded', String(open));
          if (open) nameIn.focus();
        },
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addChip.click(); } },
      }, '＋ ' + tt('scan.saveSearch', 'Save current'));
      bar.appendChild(addChip);
      bar.appendChild(nameIn);
      bar.appendChild(saveBtn);
      return bar;
    }

    const api = {
      applyFilters, commitFilters, resetFilters,
      getFilterState, setFilterState,
      filtersFromUrl, urlFromFilters, syncUrl,
      activeDescriptors, buildActiveBar, presetsBar,
    };
    if (deps.view) deps.view.filtersApi = api; // late-bound for scan-results render
    return api;
  };

  // ── CAR-115 — the filter bar UI (search + popover chips + presets) ────
  // The ONE results-filter surface: every control applies LIVE (debounced
  // text, immediate selects), each popover chip shows its current value,
  // saved searches are preset chips above the table. Kept beside the state
  // machine it drives; `view.syncUrl` is bound by scan.js before first use.
  // deps = { c, t, refs, api, addBodyListener, onSave, onLoad }
  window.createScanFilterBar = function (deps) {
    const { c, t, api } = deps;
    const refs = deps.refs;
    const {
      filterText, filterExclude, filterRemote, filterSalaryMin, filterSalaryMax,
      filterSource, filterCountry, filterSeniority, filterScope, filterAge, favOnly,
    } = refs;
    const salaryAny = refs.filterSalaryAny;

    const openPops = new Set();
    function closePop(p) {
      p.pop.hidden = true;
      p.btn.setAttribute('aria-expanded', 'false');
      openPops.delete(p);
    }
    function togglePop(p) {
      if (openPops.has(p)) { closePop(p); return; }
      for (const other of openPops) closePop(other);
      p.pop.hidden = false;
      p.btn.setAttribute('aria-expanded', 'true');
      openPops.add(p);
      const first = p.pop.querySelector('input, select');
      if (first) { try { first.focus(); } catch { /* detached */ } }
    }
    // Outside click / Escape close whatever popover is open. The listeners
    // ride the view's tracked body-subscription helper (scan.js detaches
    // them on route change).
    if (deps.addBodyListener) {
      deps.addBodyListener('click', (e) => {
        for (const p of [...openPops]) if (!p.anchor.contains(e.target)) closePop(p);
      });
      deps.addBodyListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        for (const p of [...openPops]) { closePop(p); try { p.btn.focus(); } catch { /* detached */ } }
      });
    }

    // chipPop — a popover chip: the button carries the CURRENT value (live
    // label); the popover holds the controls. Applied changes close nothing
    // (multi-adjust), outside click / Escape / chip re-click close.
    function chipPop(labelText, popChildren) {
      const btn = c('button', {
        type: 'button', className: 'chip v2-scan-chip-btn',
        'aria-haspopup': 'true', 'aria-expanded': 'false',
        title: labelText,
      }, [labelText, c('span', { className: 'v2-scan-chip-val' }, ''), ' ▾']);
      const pop = c('div', {
        className: 'v2-scan-pop', hidden: '', role: 'group', 'aria-label': labelText,
      }, popChildren);
      const anchor = c('span', { className: 'v2-scan-anchor' }, [btn, pop]);
      const p = { anchor, btn, pop };
      btn.addEventListener('click', (e) => { e.stopPropagation(); togglePop(p); });
      pop.addEventListener('click', (e) => e.stopPropagation());
      return p;
    }

    const field = (labelText, el) => c('label', { className: 'field scan-field' }, [c('span', { className: 'scan-field__label' }, labelText), el]);
    const popFormat = chipPop(t('scan.lblType', 'Work type'), [field(t('scan.lblType', 'Work type'), filterRemote)]);
    const popSalary = chipPop(t('scan.col.salary'), [
      field(t('scan.salaryFrom', 'Salary from'), filterSalaryMin),
      field(t('scan.salaryTo', 'Salary to'), filterSalaryMax),
      c('label', { className: 'scan-checkline v2-scan-check' }, [
        salaryAny,
        c('span', null, t('scan.v2.includeNoSalary', 'Include jobs without salary')),
      ]),
      c('p', { className: 'field-hint' }, t('scan.v2.salaryHint',
        'Plain-number comparison (currency ignored). Amounts parse from the posting text.')),
    ]);
    const popSource = chipPop(t('scan.lblSource', 'Source'), [field(t('scan.lblSource', 'Source'), filterSource)]);
    const popCountry = chipPop(t('scan.lblCountry', 'Country'), [field(t('scan.lblCountry', 'Country'), filterCountry)]);
    const popGrade = chipPop(t('scan.lblSeniority', 'Seniority'), [field(t('scan.lblSeniority', 'Seniority'), filterSeniority)]);
    const popFresh = chipPop(t('scan.lblAge', 'Posted within'), [
      field(t('scan.lblAge', 'Posted within'), filterAge),
      field(t('scan.lblScope', 'Scope'), filterScope),
    ]);
    const popMore = chipPop(t('scan.advancedFilters', 'Advanced filters'), [
      field(t('scan.lblExclude', 'Exclude'), filterExclude),
      c('label', { className: 'scan-checkline v2-scan-check' }, [
        favOnly,
        c('span', null, t('scan.favOnly', '★ Favorites')),
        c('span', { className: 'scan-checkline__hint' }, t('scan.favOnlyHint', 'starred only')),
      ]),
      c('p', { className: 'field-hint' }, t('scan.v2.moreHint',
        'Tip: "-word" inside the search box excludes; commas separate OR terms.')),
    ]);
    const pops = [popFormat, popSalary, popSource, popCountry, popGrade, popFresh, popMore];

    // Live chip labels: each popover chip shows its current value so the
    // engaged filters read at a glance without opening anything.
    function sync() {
      const selText = (el) => {
        if (!el.value) return '';
        const o = el.selectedOptions && el.selectedOptions[0];
        return (o ? o.textContent : el.value).replace(/\s*\(\d+\)\s*$/, '');
      };
      const typeMap = {
        remote: t('scan.remoteOnly', 'Remote'), hybrid: t('scan.hybrid', 'Hybrid'),
        onsite: t('scan.onsite', 'on-site'), reloc: t('scan.reloc', 'reloc'),
      };
      const ageMap = { 1: t('scan.age1d', '24h'), 7: t('scan.age7d', '7d'), 30: t('scan.age30d', '30d') };
      popFormat.btn.querySelector('.v2-scan-chip-val').textContent = typeMap[filterRemote.value] || '';
      popSalary.btn.querySelector('.v2-scan-chip-val').textContent =
        [filterSalaryMin.value && '≥' + filterSalaryMin.value, filterSalaryMax.value && '≤' + filterSalaryMax.value]
          .filter(Boolean).join(' ') + (salaryAny && salaryAny.checked ? '~' : '');
      popSource.btn.querySelector('.v2-scan-chip-val').textContent = selText(filterSource);
      popCountry.btn.querySelector('.v2-scan-chip-val').textContent = selText(filterCountry).replace(/^[^\s]+\s/, '');
      popGrade.btn.querySelector('.v2-scan-chip-val').textContent = selText(filterSeniority);
      popFresh.btn.querySelector('.v2-scan-chip-val').textContent = [
        ageMap[filterAge.value] || '',
        filterScope.value === 'fresh' ? t('scan.scopeFresh', 'fresh') : '',
      ].filter(Boolean).join(' · ');
      popMore.btn.querySelector('.v2-scan-chip-val').textContent = filterExclude.value ? '✂' : '';
      for (const p of pops) {
        p.btn.classList.toggle('is-on', !!p.btn.querySelector('.v2-scan-chip-val').textContent);
      }
    }

    // Saved searches as preset chips (click = load, ✕ = confirm-gated
    // delete) + one "＋ Save current" chip that opens the name field inline.
    const presetsWrap = c('div', { className: 'v2-scan-presets-wrap' });
    function refreshPresets() {
      presetsWrap.replaceChildren(api.presetsBar(c, t, {
        onLoad: () => sync(),
        onChange: () => refreshPresets(),
      }));
    }
    refreshPresets();

    const resetBtn = c('button', {
      className: 'btn btn-ghost btn-sm', type: 'button',
      onClick: () => { api.resetFilters(); sync(); },
    }, t('scan.resetFilters', 'Reset'));

    const barEl = c('div', { className: 'v2-scan-bar', role: 'group', 'aria-label': t('scan.filtersGroup', 'Result filters') }, [
      filterText,
      popFormat.anchor, popSalary.anchor, popSource.anchor, popCountry.anchor,
      popGrade.anchor, popFresh.anchor, popMore.anchor,
      resetBtn,
    ]);
    return { barEl, presetsWrap, sync, pops };
  };
})();
