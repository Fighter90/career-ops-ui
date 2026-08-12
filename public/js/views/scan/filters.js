/* global window */
/**
 * scan/filters.js — the #/scan result-filter state machine (file-size split of
 * views/scan.js, P-16). Apply/reset plus the getFilterState/setFilterState
 * serialization that backs saved searches. Extracted VERBATIM (de-indent only) —
 * every filter control + the three chip Sets are passed in `refs`, the paginator
 * and results-renderer in `deps`; nothing here is reassigned across files. Loaded
 * via <script src> BEFORE views/scan.js.
 *
 * Factory: `window.createScanFilters(refs, deps)`
 *   refs = { filterText, filterExclude, filterRemote, filterSalaryMin, filterSalaryMax,
 *            filterSource, filterCountry, filterSeniority, filterScope, filterAge, favOnly,
 *            activeTech, activeLevel, activeDynamic }
 *   deps = { pager, SR }
 *   → { applyFilters, resetFilters, getFilterState, setFilterState }
 */
(function () {
  window.createScanFilters = function (refs, deps) {
    const {
      filterText, filterExclude, filterRemote, filterSalaryMin, filterSalaryMax,
      filterSource, filterCountry, filterSeniority, filterScope, filterAge, favOnly,
      activeTech, activeLevel, activeDynamic,
    } = refs;
    const { pager, SR } = deps;

    // v1.68.0 — filters are now Apply-driven (was live-on-input). The user asked
    // for an explicit "Apply" so the salary range visibly re-filters the results.
    function applyFilters() { pager.reset(); SR.render(); }
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
      activeTech.clear(); activeLevel.clear(); activeDynamic.clear();
      applyFilters();
    }
    // v1.80.0 — capture/restore the whole filter set for saved searches.
    function getFilterState() {
      return {
        text: filterText.value, exclude: filterExclude.value, remote: filterRemote.value,
        salaryMin: filterSalaryMin.value, salaryMax: filterSalaryMax.value,
        source: filterSource.value, country: filterCountry.value,
        seniority: filterSeniority.value,
        scope: filterScope.value, age: filterAge.value, favOnly: favOnly.checked,
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
      activeTech.clear(); (Array.isArray(s.tech) ? s.tech : []).forEach((x) => activeTech.add(x));
      activeLevel.clear(); (Array.isArray(s.level) ? s.level : []).forEach((x) => activeLevel.add(x));
      activeDynamic.clear(); (Array.isArray(s.dynamic) ? s.dynamic : []).forEach((x) => activeDynamic.add(x));
      applyFilters();
    }

    return { applyFilters, resetFilters, getFilterState, setFilterState };
  };
})();
