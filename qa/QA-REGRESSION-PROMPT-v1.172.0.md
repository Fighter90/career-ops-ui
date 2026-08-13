# QA REGRESSION PROMPT — career-ops-ui **v1.172.0** (HTML-entity decoder crash fix)

**Parent-sync finding (MEDIUM, scanner — `qa/PARENT-SYNC-WORKLIST-v1.26.0.md` GAP #2; career-ops #2150 parity).** The `oraclecloud`, `gem` and `dassault` in-process scan sources decoded numeric HTML entities with a bare `Number.isFinite(code)` guard before `String.fromCodePoint(code)`. `String.fromCodePoint` still throws a `RangeError` for a code point above `0x10FFFF` (e.g. `&#99999999;`), so a single malformed/adversarial entity in a feed aborted that source's entire parse. Server-lib only; no user-facing change for valid feeds.

- **Under test:** `package.json` **1.172.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2444, exit 0 (capture $? directly, never | grep)
node --test tests/html-entities.test.mjs    # 7 cases: crash payload, valid dec/hex, named, &#1a2; passthrough, XML-char rejection, source-import canary
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.172.0
```

## §1 — Fix

- **New shared module `server/lib/html-entities.mjs`** — mirrors the parent's `providers/_html-entities.mjs`. `isEmittableCodePoint(code)` restricts numeric references to the XML 1.0 §2.2 Char set (rejects NUL, C0 controls, lone surrogates, U+FFFE/U+FFFF, and anything above `0x10FFFF`), so `String.fromCodePoint` can never throw. The regex matches hex vs decimal separately (`#[xX][0-9a-fA-F]+|#[0-9]+`) so `&#1a2;` no longer parses as codepoint 1 dropping `a2` — it passes through untouched.
- **`oraclecloud.mjs` / `gem.mjs` / `dassault.mjs`** — dropped their local `NAMED_ENTITIES` + `decodeEntities` copies; each now `import { decodeEntities } from '../html-entities.mjs'`.

## §2 — Manual / behavioural pass

1. **Valid feeds unchanged** — a scan against any Oracle Cloud / Gem / Dassault board decodes titles exactly as before (`caf&#233;` → café, `M&#xfc;nchen` → München, `&amp;`/`&lt;`/`&nbsp;` as before).
2. **Malformed entity no longer crashes** — a title containing `&#99999999;` (or `&#x110000;`) is left literal and the rest of the source's postings still parse — previously the whole source returned zero.
3. **No decimal/hex confusion** — `&#1a2;` stays literal (not codepoint 1 + `a2`).

## §3 — Invariants

- **Server-lib only** — no JS/SPA, i18n, route, CSP, SSRF, or parent-write change; no new runtime dependency.
- **Behaviour-preserving for valid input** — the emittable set only rejects code points the old code either couldn't emit or shouldn't have (NUL/C0/surrogates/noncharacters); Tab/LF/CR kept.
- **No bare guard remains** — `tests/html-entities.test.mjs` fails if `oraclecloud`/`gem`/`dassault` keep the `Number.isFinite(code) ? String.fromCodePoint(code)` pattern or drop the shared import.

## §4 — Scope note / backlog

The ~20 other in-source `decodeEntities` copies (avature, cryptocurrencyjobs, deutschebahn, higheredjobs, icims, jobspresso, larajobs, nodesk, personio, radancy, remotli, rheinmetall, rss, softgarden, successfactors, teamtailor, weworkremotely, hecklerkoch, agenticjobs) are non-crashing but still drift (some admit NUL/C0, some mis-parse `&#1a2;`). Consolidating them onto the shared module is tracked in `qa/PARENT-SYNC-WORKLIST-v1.26.0.md` as follow-up.

## §5 — Sign-off

Suite **2444** green · `tests/html-entities.test.mjs` 7/7 · valid feeds decode identically · `&#99999999;`/`&#1a2;` pass through without crash · parity ×17. **Closes PARENT-SYNC GAP #2 (MEDIUM); broader decoder consolidation remains documented backlog.**
