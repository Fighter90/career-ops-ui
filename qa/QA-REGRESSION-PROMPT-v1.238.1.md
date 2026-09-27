# QA regression — v1.238.1

Stability patch found by the first live regression of the prod server. **Counts:**
98 sources (93 EN + 5 RU) / 93 adapters — unchanged. **Tests 3481 → 3486.**

## §0 — Gates

```bash
node --test tests/scan-single-flight.test.mjs          # 3 pass — fails/hangs without the guard
node --test tests/site-scripts.test.mjs                # 6 pass — sitemap map vs locale registry
node --test tests/scan-stream-multi-phase.test.mjs     # still green: both-phase SSE contract
npm run test:ci                                        # 3486 (3483 + 3 skipped), exit 0
npm run test:e2e:browser                               # 116 pass
npm run test:e2e && npm run test:e2e:full              # smoke + 23/23
(cd site && node scripts/check-i18n.mjs)               # OK — 17 locales, sitemap map complete
```

## §1 — What changed

1. **Single-flight scan.** `GET /api/stream/scan` while another scan runs → one SSE
   `error` `{code: 'SCAN_BUSY', startedAt}`; no scanner phase starts. The slot is
   released in `finally` (success, error, unknown source).
2. **Heap drop-in on deploy.** `deploy.yml` `mode=deploy` writes
   `/etc/systemd/system/career-ops-ui.service.d/heap.conf` with
   `NODE_OPTIONS=--max-old-space-size=<heap_mb>` (default 448) and daemon-reloads only
   when it changes. `verify` reports exits, OOM kills, memory and Caddy 502s.
3. **cvstart.org**: `/help` + `/changelog` no horizontal overflow at 390 / 1366 px;
   `sitemap-0.xml` carries `hreflang="hi"` (85 alternates).
4. **Help §19 ×17**: "add the key to all 17 language files" (was 8 / 9).
5. **Remote QA** (`remote-qa.yml`): prod × 17 locales (read-only), cvstart.org × 17 ×
   2 viewports, README ×17 + wiki links; `live: true` adds one scan + live LLM
   (docs assistant, evaluate with `save:false`) in every locale.
   The prod origin comes from the `PROD_URL` secret (no hostname in the repo); a
   `prod_url` input outside that origin, or not https, is refused before any credential
   is sent.

## §2 — Manual pass

1. Open `#/scan` in two tabs, click **Scan** in both within a few seconds: the second
   tab shows "a scan is already running (started …)" and no second progress bar.
2. After the first finishes, **Scan** works again in either tab.
3. cvstart.org on a phone: `/help`, `/changelog` (also ja, zh-CN) — no sideways scroll.
4. `curl -s https://cvstart.org/sitemap-0.xml | grep -c 'hreflang="hi"'` → 85.

## §3 — Invariants

- A scan still runs both phases (`final:false` then `final:true`) — the guard wraps,
  not replaces, the multi-phase contract.
- The remote QA never writes: only GETs, `/api/docs-assistant/ask` and
  `/api/evaluate` with `save:false` leave the browser; basic-auth secrets go only to
  the `PROD_URL` origin.

## §5 — Sign-off

- [ ] §0 gates green with the counts above
- [ ] §2 in a real browser
- [ ] deploy with `heap_mb=448`, then `verify`: NRestarts stays 0 through a scan
- [ ] remote QA (`live: true`) green on prod
