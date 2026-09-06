# QA REGRESSION PROMPT — career-ops-ui **v1.187.0** (`skip_tiers` scan filter)

**Fixed (scanner).** A `skip_tiers:` list in `portals.yml` now actually drops postings by seniority tier during a scan. Before this it was silently ignored — a `skip_tiers: [intern, entry]` still let internship/junior listings through. The scanner now classifies each title's tier (intern / entry / mid / senior) and filters it out when the tier is in your `skip_tiers`.

- **Under test:** `package.json` **1.187.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2492, exit 0 (capture $? directly, never | grep)
node --test tests/classify-tier.test.mjs tests/i18n-coverage.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.187.0
```

## §1 — Change

- **New module:** `server/lib/classify-tier.mjs` — pure, zero-dep seniority classifier. `classifyTier(title)` → `intern | entry | mid | senior`, deciding by the **leftmost** seniority marker in the title (so "Summer Intern, Director of Product" is an internship, not a directorship), with two guards: (a) `Associate <senior noun>` → senior; (b) `<intern word> Program <senior noun>` → runs the programme → senior. Unrecognised titles fall back to `mid`. `buildTierFilter(skipTiers)` returns `(title) => !skip.includes(classifyTier(title))`; an empty / missing / non-array list is a pass-all no-op.
- **Wired into both scanners:** `en-scanner.mjs` and `ru-scanner.mjs` add `tierOk(j.title)` to the existing `titleOk && locOk && … && contentOk` filter chain, reading `portals.skip_tiers`. No behavioural change for users without a `skip_tiers` list (no-op filter).

## §2 — Manual check

- **With `skip_tiers: [intern, entry]` in `portals.yml`:** run a scan → internship/junior/graduate titles are dropped; mid/senior titles remain. **Without** a `skip_tiers` key (or an empty list): the scan is byte-identical to before — nothing is filtered on tier.
- **Leftmost-marker sanity:** a title like `Summer Intern, reporting to the Director` classifies as `intern` (dropped by `skip_tiers: [intern]`), not `senior`.
- **Associate guard:** `Associate Director` is `senior` (kept unless `senior` is skipped), `Associate Engineer` is `entry`.

## §3 — Sign-off

Suite **2492** green (+7: classify-tier level words, mid fallback, leftmost-marker, associate guard, program-bridge guard, buildTierFilter drop/keep, no-op) · i18n coverage + parity ×17 · CHANGELOG parity ×17 at v1.187.0 · README badge+banner ×17 · both scanner filter chains exercised against a synthetic `CAREER_OPS_ROOT` with and without `skip_tiers`.
