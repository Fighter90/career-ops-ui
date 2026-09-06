# QA REGRESSION PROMPT — career-ops-ui **v1.166.0** (FIX-8: docs-aligned rubric terminology)

**Audit finding (LOW, `FIX-PROMPT-post-v1.158.0.md` SHIP 8).** career-ops.org/docs states the rubric is "five scoring dimensions plus a holistic global score"; the web-ui, cvstart.org and the wiki all said "six-dimension rubric". The numbers reconcile (5 + 1 = 6) but the vocabulary did not. Docs/marketing-copy fix.

- **Under test:** `package.json` **1.166.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2426, exit 0 (capture $? directly, never | grep)
node --test tests/rubric-terminology.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.166.0
```

## §1 — Decision + fix

- Adopted the docs' phrasing — **"five dimensions plus a holistic global score"** — consistently across: README ×17, the cvstart.org site copy ×17 (`method.dimsTitle`/`method.lead`/`how.3.desc`/`features.2.desc`/`meta.methodologyDesc`), the in-app help guide ×17 (§1 intro + methodology link), `docs/career-ops-canonical.md`, and the wiki (Home ×17 + Features). The 6th factor (global fit) is framed as the holistic global score.
- The SPA UI never used the phrase (no i18n-dict key), so no app copy changed.

## §2 — Manual pass

1. **cvstart.org/methodology** (en + a spot locale) — the section title reads "Five dimensions + a global score" and the lead says "five dimensions plus a holistic global score"; no "six-dimension".
2. **`#/help` §1** (en) — the intro and the methodology bullet use the five-plus-holistic wording.
3. **README + wiki Home** — the evaluation bullet uses the docs' wording.

## §3 — Invariants

- **Docs/marketing copy only** — no code, i18n-dict key, route, CSP, SSRF, or parent-write change.
- **Consistency** — no current-copy surface (README/help/site/canonical/wiki) says "six-dimension"; CHANGELOG history and its site mirrors keep their past wording (out of scope).

## §4 — Sign-off

Suite **2426** green · no English source surface says "six-dimension" · site methodology names five dimensions + a global score · README/help/wiki ×17 aligned · parity ×17. **Closes SHIP 8 (FIX-8, LOW).**
