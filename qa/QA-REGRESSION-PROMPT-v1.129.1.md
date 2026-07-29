# QA Regression Prompt — v1.129.1 (AI-review follow-ups on the web-ports)

> Patch release. Fixes the advisory findings raised on v1.128.0/v1.129.0 (none
> were blocking). Baseline: v1.129.0 (all green, 2069).

## What changed (all fixed at source)

1. **`job-facets.js` seniority precedence** — an explicit modifier now beats a
   management word: `Senior Engineering Manager` → `senior` (was `lead`),
   `Staff Manager` → `staff`, `Junior Manager` → `junior`, while a bare
   `Engineering Manager` stays `lead` and `Senior Staff Engineer` → `staff`.
2. **`server/lib/states.mjs` fallback not pinned** — a successful
   `templates/states.yml` read is memoized; the FALLBACK is returned
   **uncached**, so a parent momentarily unavailable at boot (or updated live)
   is re-read next call. A present-but-malformed file emits `console.warn`; a
   genuinely absent file stays quiet.
3. **`score-tone.js` — no-score row is neutral** — null/blank score → `muted`
   (`.score-muted`), not `bad`; a real low grade (`D`/`F`) still reads `bad`.
4. **`company-logo.js` `domainFromName()` skips non-ASCII slugs** — a name like
   `株式会社` no longer builds an invalid host for `/api/logo`; straight to the
   avatar. (Server `looksLikeHost` is still the real boundary.)
5. **`tests/states.test.mjs` isolation guard** — a sanity assertion pins
   `PATHS.statesYml` to the temp `CAREER_OPS_ROOT` so a future isolation
   regression fails loudly. +4 tests → **2073**.

## Sign-off checklist

- [ ] `npm test` — **2073** green.
- [ ] `node --test tests/job-facets.test.mjs` — `Senior Engineering Manager`→
      `senior`, `Staff Manager`→`staff`, `Engineering Manager`→`lead`.
- [ ] `node --test tests/states.test.mjs` — sanity guard + fallback-not-cached.
- [ ] `node --test tests/score-tone.test.mjs` — blank/null → `muted`.
- [ ] `node --test tests/company-logo-domain.test.mjs` — non-ASCII → null.
- [ ] Manual: `#/scan` seniority filter buckets a "Senior … Manager" row under
      **Senior**, not Lead.
- [ ] Help H2/H3 unchanged (29/105); CHANGELOG parity ×17 at 1.129.1.
- [ ] `/api/health` → `version 1.129.1`, `parentVersion 1.23.0`.
