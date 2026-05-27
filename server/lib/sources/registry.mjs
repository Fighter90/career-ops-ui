/**
 * Source registry — single source of truth for every scanner adapter the
 * SPA and the regional dispatcher know about.
 *
 * Why this exists (v1.29.0):
 *   • Pre-v1.29 the source list was hardcoded in THREE places:
 *     - `public/js/views/scan.js` <option> elements for the filter dropdown
 *     - `server/lib/ru-scanner.mjs` if/then dispatcher block per source
 *     - the `default` for `russian_portals.sources` in `loadConfig()`
 *     Adding a fourth source (e.g. Trudvsem) meant three edits + the risk
 *     of forgetting one. The registry consolidates to one edit per new
 *     adapter.
 *
 * Fields:
 *   - value     : the user-visible source label that every adapter writes
 *                 to `job.source` after normalization. ALSO the value the
 *                 `#/scan` filter dropdown uses for `option.value`.
 *                 (Filter is `r.source === fs`, so these MUST match.)
 *   - label     : display label in the dropdown.
 *   - region    : 'en' (ATS sweep) | 'ru' (regional portals).
 *   - configKey : the key used in `portals.yml::russian_portals.sources`.
 *                 Only present for RU sources. (EN sources are auto-driven
 *                 from `tracked_companies` URL patterns — no config-key
 *                 needed.)
 *
 * Public API:
 *   - SOURCES              — full array, ordered by region then label.
 *   - SOURCES_BY_REGION    — convenience indexed view.
 *   - RU_CONFIG_KEYS       — list of `configKey` strings for RU sources.
 *   - getRegionalSources() — same, but as `[{ value, label, configKey }]`.
 */

export const SOURCES = [
  // English ATS sweep — alphabetical by label.
  { value: 'ashby',           label: 'Ashby',           region: 'en' },
  { value: 'greenhouse',      label: 'Greenhouse',      region: 'en' },
  { value: 'lever',           label: 'Lever',           region: 'en' },
  { value: 'rss',             label: 'RSS',             region: 'en' },
  { value: 'smartrecruiters', label: 'SmartRecruiters', region: 'en' },
  { value: 'workable',        label: 'Workable',        region: 'en' },
  { value: 'workday',         label: 'Workday',         region: 'en' },

  // Russian regional portals — alphabetical by label.
  { value: 'geekjob',     label: 'GeekJob',     region: 'ru', configKey: 'geekjob'  },
  { value: 'getmatch',    label: 'GetMatch',    region: 'ru', configKey: 'getmatch' },
  { value: 'habr-career', label: 'Habr Career', region: 'ru', configKey: 'habr'     },
  { value: 'hh.ru',       label: 'hh.ru',       region: 'ru', configKey: 'hh'       },
  { value: 'trudvsem',    label: 'Trudvsem',    region: 'ru', configKey: 'trudvsem' },
];

export const SOURCES_BY_REGION = {
  en: SOURCES.filter((s) => s.region === 'en'),
  ru: SOURCES.filter((s) => s.region === 'ru'),
};

/** Config-key strings for RU sources, in registry order. Used as the
 *  fallback when `russian_portals.sources` is missing from portals.yml. */
export const RU_CONFIG_KEYS = SOURCES_BY_REGION.ru.map((s) => s.configKey);

/** Returns the RU sub-array with just the fields the dispatcher cares about. */
export function getRegionalSources() {
  return SOURCES_BY_REGION.ru.map(({ value, label, configKey }) => ({
    value, label, configKey,
  }));
}
