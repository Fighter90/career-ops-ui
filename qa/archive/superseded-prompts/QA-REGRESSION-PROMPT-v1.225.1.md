# QA REGRESSION PROMPT — career-ops-ui **v1.225.1** (provider-banner render fix)

**Docs-only bugfix.** The v1.225.0 provider banner didn't render on GitHub. No code or test change; count stays **2784**.

## §0 — Gates
```bash
npm test                                    # 2784 (±2 flaky live scan-stream), exit 0
xmllint --noout images/providers.svg        # valid XML (was: attributes construct error)
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.225.1
```

## §1 — Three bugs fixed
1. **Invalid SVG XML** — `images/providers.svg` had `font-family="…,\"Segoe UI\",…"` (nested double-quotes in a double-quoted attribute). GitHub's SVG sanitizer + rsvg/xmllint reject it (browsers tolerated it, so the cvstart.org inline-SVG Astro showcase and the app's `provider-logo.js` were **unaffected** — they don't use this file). Fixed to single quotes → valid XML.
2. **Relative `<img src>` on GitHub** — raw HTML `<img src="images/providers.svg">` does not resolve relative paths on GitHub (only markdown `![]()` does). Now uses an **absolute raw URL to a rendered PNG** (`images/providers.png`, rsvg-convert 1520×288).
3. **Unterminated HTML block** — the `<p>` banner had no trailing blank line, so the following `>` blockquote merged into it (rendered as `…and more> > 📜`). Now blank lines on both sides.

## §2 — What changed
- `images/providers.svg` (font-family → valid XML) + `images/providers.png` (new, rendered).
- README ×17 + help ×17 banners → `<p align="center"><img src="https://raw.githubusercontent.com/Fighter90/career-ops-ui/main/images/providers.png" …></p>` with blank lines both sides.
- Wiki Home ×17 banner → same PNG URL.

## §3 — Manual pass
- On GitHub, the README + `docs/help/<lang>.md` show the 18-provider banner (11 real logos + 7 monograms + names) — no broken image, no mangled blockquote.
- In-app `#/help`: banner stripped by `UI.md()` (no image support) — the real logo tiles show on the provider surfaces.
- cvstart.org `#providers`: unchanged, already correct.

## §4 — Sign-off
Suite **2784** green · SVG valid XML · PNG renders 18 tiles · README/help/wiki banners fixed ×17 · parity ×17 at v1.225.1 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed. Deploy: Pages, local + resumecraft restart.
