# SPEC — cvstart.org Pages build green again: JobMapShowcase must not import bare `astro`

- **Status:** In progress
- **Release:** post-v1.241.1 fixup (no version bump — CI-only, nothing user-facing in the app)
- **Related:** v1.241.1 (#399, job map showcase ×17), #398 (site job map section)
- **Owner:** maintainer

## Goal

`Deploy landing to GitHub Pages` passes again on `main`, so cvstart.org ships the
v1.241.1 changelog + job-map showcase in all 17 languages.

## Context

Run 37674890622 (push `24630e34`, 2026-10-07 19:29) failed in `Sync repo assets + build`:

```
src/components/JobMapShowcase.astro:4:36 - error ts(2307): Cannot find module 'astro'
  or its corresponding type declarations. … could not be resolved under your current
  'moduleResolution' setting. Consider updating to 'node16', 'nodenext', or 'bundler'.
Result (40 files): 1 error
```

`site/` has **no tsconfig.json**, so `astro check` runs with the TS default
`moduleResolution: node10`, which cannot resolve the `exports`-map-only `astro`
package. `site/src/lib/screenshots.ts` makes the same import but passes —
without a tsconfig `astro check` only checks `.astro` files; the failing import
is the new `import type { ImageMetadata } from 'astro'` in
`src/components/JobMapShowcase.astro:4` (added with the job-map showcase).

## Scope

One file: `site/src/components/JobMapShowcase.astro` — replace the bare-module
type import with a local structural type identical to Astro's `ImageMetadata`
(`{ src: string; width: number; height: number; format: string }`), so the
`import.meta.glob` generic keeps the same safety without touching module
resolution.

## Out of scope

- **Adding `site/tsconfig.json`** (extends `astro/tsconfigs/base`) — the real
  root-cause fix, but it changes what `astro check` includes (`.ts` files start
  being checked) and can surface new errors in a release-critical moment.
  Deliberately deferred; noted as a follow-up.
- Any change to the app (`public/`, `server/`) or to the already-shipped
  v1.241.1 tag.

## Acceptance criteria

1. `cd site && npx astro check` → **0 errors** (before the fix: exactly the
   ts(2307) error above — reproduced locally first).
2. `cd site && npm run build` → exits 0 (includes sync-assets, check-i18n,
   generate-og).
3. `grep -L '1.241.1' site/src/content/changelog/*.md` → prints nothing
   (HANDOFF ship-train step 3 sanity unchanged).
4. GitHub Actions: `Deploy landing to GitHub Pages` on the fix branch → green;
   after merge → green on `main`.

## Plan

1. Red: reproduce the ts(2307) locally with `npx astro check`.
2. Fix the single import (local interface, same shape).
3. Green: criteria 1–3 locally, twice (проверяй несколько раз).
4. Branch `fix/cvstart-pages-astro-check` → PR → CI → merge; watch the Pages
   workflow to green.

## Risks and invariants touched

- TRACEABILITY row "site (cvstart.org) builds and deploys from `site/**`" —
  guarded by criterion 4; nothing else in the invariant→gate matrix touches
  `.astro` type-checking.

## Verification

_(filled in with real output)_

1. Red (reproduced): `npx astro check` → `src/components/JobMapShowcase.astro:4:36
   - error ts(2307): Cannot find module 'astro' …` — 1 error, 40 files (same as CI run
   37674890622).
2. First attempt (local structural `ImageMeta` interface) — **rejected**: check went
   green for the import but red one hop further — `Picture`'s props want astro's real
   `ImageMetadata` (`ts(2322)`). Fix moved to the proven pattern instead: the typing
   stays in `site/src/lib/screenshots.ts` (a `.ts` module — `astro check` without a
   tsconfig only checks `.astro` files, so that import passes, as it always has) and
   the component imports `jobMapShotFor(locale.file)` with the en-fallback preserved.
3. Green, run three times: `npx astro check` → `Result (40 files): 0 errors` ×3.
4. `npm run build` → exit 0, 86 pages built (sync-assets + check-i18n + generate-og
   + astro build).
5. `node --test tests/site-sources.test.mjs tests/locales-de-it-tr.test.mjs` →
   12 pass / 0 fail (no test references the two touched files; full CI runs on the PR).
6. CI + Pages on the fix branch → green; after merge → Pages green on `main`
   _(watch link: this run's conclusion recorded in the PR)_.
