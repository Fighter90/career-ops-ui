# QA Regression Prompt — v1.266.0

> Release: **v1.266.0** (2026-11-01) · personio language-dedup wave (CAR-223: parent #4789 + #5044 + #5285), PR #617 → `fc3d931d`
> Prod target: resumecraft.ru = **1.266.0**, parent 1.38.0 @ `fe857ecf`
> Tests: **7203** unit (0 fail) · Playwright 174 (173 pass / 1 opt-in skip) · registry unchanged **125 = 120 EN + 5 RU · 120 adapters**

## What shipped (verify these first)

1. **personio emits per-language rows.** A personio entry whose careers page serves ≥2 language
   versions returns one row per version (no `?language=en` force — a tenant `?language=xx` is honoured).
2. **`scan_history.dedup_include_language: true`** (opt-in; OFF = previous behavior byte-identical):
   a `?language=de` variant of an already-seen `?language=en` posting is accepted as NEW.
3. **`preferred_languages: [en, fr]`** (top-level portals key): one posting's version rows order
   preferred-first; with the switch OFF the dedup keeps the preferred version.
4. **recruitee** carries the same per-language emission + `preferred_languages`.

## Standard sweep (every release)

- [ ] `#/health` all green; `/api/health` reports `1.266.0`; 19 locales switch cleanly.
- [ ] personio/recruitee scans without the new keys behave exactly as before (byte-identical OFF path).

## Not in scope (by design)

- RU scanner language-aware seen-filter; client url-key.js mirror; portals-route validation wiring — hand-offs in the wave spec.
