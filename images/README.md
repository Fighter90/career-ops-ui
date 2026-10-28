# Localized dashboard screenshots

The `dashboard-<locale>.png` family is referenced as the main hero image in
each locale's README; the rest of the folder is the landing's screenshot
supply (synced into `site/src/assets/screenshots/` by
`site/scripts/sync-assets.mjs` at prebuild).

| Files | Used by |
|---|---|
| `dashboard-{en,ru,es,pt-BR,ko-KR,ja,zh-CN,zh-TW,pl,uk,da,ar,de,it,tr,hi,ta,vi}.png` (×19) | `README*.md` hero image + the landing Dashboard tab (per locale) |
| `job-map-<locale>.png` (×19, same locale set) | landing Job-map section (per locale, en fallback) |
| `scan-en.png`, `pipeline-en.png`, `tracker-en.png`, `reports-en.png` | landing screenshot tabs (EN captures) |
| `ru/scan-ru.png`, `ru/pipeline-ru.png`, `ru/tracker-ru.png`, `ru/reports-ru.png` | localized README/landing supply (deliberate; sync-assets only walks `images/*.png`) |

## Regenerate

Two capture scripts, both run from the `web-ui/` root. Each screenshot is a
viewport-only capture (`1440×900`, devicePixelRatio 2 = HiDPI). Idempotent:
re-runs overwrite the PNGs.

### Dashboards + job maps (README + landing hero family)

```bash
# Make sure the server is running
npm start &

node scripts/capture-dashboard-screenshots.mjs   # dashboard-<locale>.png ×19
node scripts/capture-map-screenshots.mjs         # job-map-<locale>.png ×19
```

Each dashboard capture is a viewport of `#/dashboard` after switching the
locale via the `[data-lang-btn]` button.

### Scan / pipeline / tracker / reports (data views)

`scripts/capture-car140-screenshots.mjs` needs no operator-started server: it
seeds a throw-away `CAREER_OPS_ROOT` fixture, boots the server on an ephemeral
loopback port and captures ×8 (en into `images/`, ru into `images/ru/`):

```bash
node scripts/capture-car140-screenshots.mjs
```

Set `CAREER_OPS_UI_URL=http://127.0.0.1:4317` to capture against an
already-running server, or `CAR140_SERVE=1` to boot the fixture and hold for
the map/dashboard capture scripts.

## Manual capture (fallback)

If Playwright is missing on the parent project:

1. Open `http://127.0.0.1:4317/#/dashboard` in your browser.
2. Click each `[data-lang-btn]` in turn.
3. Use your OS screenshot tool (Cmd+Shift+4 on macOS, PrtSc on Linux/Windows)
   to capture just the page area.
4. Save as `dashboard-<locale>.png` here.

Target resolution: 1440×900 viewport. PNG, no compression artifacts.
