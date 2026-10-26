/**
 * CAR-122 test helper — seed the sidebar-v2 persisted state so EVERY
 * group is pinned open for a suite that drives the sidebar.
 *
 * Why: the v2 sidebar defaults untouched groups to closed (they follow
 * the active route), so a `.nav-item` outside the current group is
 * hidden and any suite that clicks or waits for it would time out.
 * Suites that deliberately test the v2 group model (playwright-nav-v2)
 * must NOT use this helper. Suites with no sidebar interaction at all
 * (smoke, full-cycle, forms, car93-spa — grepped, zero `.nav-item`
 * references) need it only if they grow sidebar steps.
 *
 * Usage (before any navigation, on the browser CONTEXT or PAGE):
 *   import { seedNavOpenGroups } from './helpers/nav-seed.mjs';
 *   await seedNavOpenGroups(context);          // or: page
 */

// Mirrors nav-v2.js STATIC_GROUP_IDS — the nav-v2 unit suite drift-locks
// this list against the index.html `data-nav-group` sections.
const STATIC_GROUP_IDS = [
  'sourcing', 'decision', 'application', 'networking',
  'analytics', 'growth', 'setup',
];

export async function seedNavOpenGroups(target) {
  await target.addInitScript(([groupsJson]) => {
    try {
      const groups = JSON.parse(groupsJson);
      const collapsed = {};
      for (const g of groups) collapsed[g] = 'open'; // explicit beats the auto-follow default
      window.localStorage.setItem('career-ops-ui:nav-v2',
        JSON.stringify({ collapsed, favs: [], recent: [] }));
    } catch { /* private mode */ }
  }, [JSON.stringify(STATIC_GROUP_IDS)]);
}
