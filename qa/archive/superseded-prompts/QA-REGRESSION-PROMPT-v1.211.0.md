# QA REGRESSION PROMPT — career-ops-ui **v1.211.0** (Yourator + accented-entity decode + trust-validator accent fold)

**Parity release.** Closes the post-`career-ops-v1.27.0`-tag delta v1.210.0 under-scoped (it diffed to the tag, not the fork's main HEAD). One new source + two shared-library fixes.

- **Under test:** `package.json` **1.211.0**. Registry **81** = 76 EN + 5 RU, `ALL_ADAPTERS` **76**.

## §0 — Gates

```bash
npm test                                                   # 2667, exit 0
node --test tests/sources-yourator.test.mjs                # 19 (new source)
node --test tests/html-entities.test.mjs                   # 10 (was 7; Latin-1 + case + prototype guard)
node --test tests/trust-validator.test.mjs                 # accent-fold
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs tests/scan-fallback-sources.test.mjs tests/site-sources.test.mjs   # gate lists incl. yourator
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.211.0
```

## §1 — What changed

- **Added — Yourator** (`sources/yourator.mjs` + `adapters/yourator.mjs`). Zero-token public JSON API for the Taiwan tech/digital market; walks every page until `payload.hasMore` is false. **SSRF:** the emitted employer URL (`thirdPartyUrl`, utm-stripped) is display-only and **never fetched** — any https origin is accepted for display; every URL actually requested is host-pinned to yourator.co via `assertYouratorUrl` (HTTPS-only, `redirect:'error'`). Wired across all 5 surfaces (registry, adapter-registry + scan-sources-endpoint sorted lists, FALLBACK_SOURCES, SOURCE_URLS).
- **Fixed — accented named entities decode everywhere.** The shared `html-entities.mjs` gained the Latin-1 letter table + punctuation, and its named lookup is now exact-case-first then a case-insensitive whitelist (via `Object.hasOwn`). So `&eacute;`→é and `&Eacute;`→É (case-correct), a French board's `D&eacute;veloppeur` decodes in the title/tracker/reports, and `&constructor;`/`&toString;` resolve to themselves (a latent prototype-pollution lookup bug). Lifts **every** shared-decoder source.
- **Fixed — accented company names match their own domain.** `trust-validator.mjs::asciiFoldForHostname` NFD-folds + strips combining marks + folds non-decomposing Latin (ø/æ/ß/**ı**/…). "Işık"→"isik" matches isik.com.tr; "Société Générale" matches societegenerale.com. The old `[^a-z0-9 ]` strip deleted accented letters instead of folding.

## §2 — Manual browser pass

1. `#/scan` **Source** filter lists **Yourator** (offline FALLBACK + live `/api/scan/sources` agree — the drift gate proves it).
2. `GET /api/scan/sources` returns **81**; the EN set includes `yourator`.
3. cvstart.org **Job sources** links Yourator → yourator.co.
4. A scan row with a French/DACH title carrying `&eacute;`/`&#233;` renders the accented letter, not the entity.

## §3 — Invariants / security

- Yourator: only yourator.co API URLs are fetched (host-pinned, HTTPS-only, redirect:'error'); the display link is never a fetch target.
- Decoder is C0-safe (numeric refs outside XML §2.2 Char pass through); the named table cannot resolve to an Object.prototype member.
- No new dependency, no new write route, parent read-only contract intact.

## §4 — Not ported (already covered)

- Parent **senjob C0-control fix** — web-ui's senjob used the shared C0-safe decoder from day one.
- Parent **jobvite** shared-decoder swap — web-ui's jobvite already imports the shared decoder.

## §5 — Sign-off

Suite **2667** green · new `sources-yourator` (19) · `html-entities` 7→10 · `trust-validator` +accent-fold · gate lists (adapter-registry / scan-sources-endpoint / FALLBACK / SOURCE_URLS) carry `yourator` · registry **81** = 76 EN + 5 RU · CHANGELOG parity ×17 at v1.211.0 · help §17 count 80→81 · 75→76 + anchor → v1.211.0 · API/OVERVIEW/CONVENTIONS refreshed · site Sources.astro + wiki. Deploy: resumecraft rsync of the new source+adapter + registry + `html-entities.mjs` + `trust-validator.mjs` + `scan-results.js`, restart. cvstart.org Pages rebuild (site/ changed).
