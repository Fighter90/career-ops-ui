# QA REGRESSION PROMPT — career-ops-ui **v1.146.0** (Hermes docs + skill)

Docs + skill deliverable (no parent-sync, no runtime code). Phase 5b, part 1: the **integration design + deployment guide** for bridging career-ops-ui to a Nous Research **Hermes** agent (and Telegram through it), plus a `hermes-bridge` skill. The Hermes **LLM-provider** path stays **planned / not-yet-wired**. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.146.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2376, exit 0 (capture $? directly, never | grep)
node --test tests/hermes-docs.test.mjs      # docs + skill + honesty-marker canary (4 tests)
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.146.0
node tools/i18n-audit.mjs                    # dictionary clean (no NEW i18n keys this release; snapshot unchanged at 1208)
```

## §1 — What changed (docs + skill only; ZERO runtime/route/i18n-dict change)

- **`docs/integrations/HERMES.md`** (new) — the deep-dive: (1) what Hermes is + the two integration shapes (Shape A OpenAI-compatible endpoint vs. Shape B agent runtime); (2) **cloud-server deployment** (VPS, Node ≥18, reverse proxy + HTTPS + systemd/pm2, the read-only parent contract on a headless box, the CSP/SSRF/markdown/no-secrets invariants that must survive the move off `127.0.0.1`); (3) **Telegram via Hermes** (push vs. tool-call) + a threat-model "what NOT to expose" list.
- **`## Hermes agent + Telegram`** README teaser — EN `README.md` + the 13 fully-translated locale READMEs (da/de/es/fr/hi/it/ja/ko-KR/pt-BR/ru/tr/zh-CN/zh-TW), inserted before the Localization section; a short pointer + link, keeping the "planned / not-yet-wired" honesty marker. The 3 thin stub READMEs (ar/pl/uk) get the release **banner** update but not the section (they carry no Limitations/Localization sections).
- **`.claude/skills/hermes-bridge/SKILL.md`** (new) — operationalizes the guide: a **scoping gate** before any provider code, prerequisite checks (Node ≥18, keys present, endpoint reachability via the SSRF-safe path), never writes secrets to disk/logs, refuses to invent a Hermes endpoint or claim the provider is wired; cross-links HERMES.md as the single source of truth.
- **`docs/architecture/OVERVIEW.md`** — a new **Integrations** section links the guide.
- README badge + banner ×17 → v1.146.0 / 2376 tests.

## §2 — Manual / doc pass

1. **`docs/integrations/HERMES.md`** renders on GitHub — the status banner reads "planned / not-yet-wired", Shape A + Shape B are both described, the "what NOT to expose" list is present, and the security invariants (CSP, SSRF, `stripDangerousMarkdown`, `127.0.0.1`) are named.
2. **README** (EN + a non-EN, e.g. `README.ru.md`) — the `## Hermes agent + Telegram` teaser sits before Localization, links `docs/integrations/HERMES.md`, and keeps the not-yet-wired marker; the top "🆕 Latest release" banner shows v1.146.0 + 2376 tests, localized.
3. **Skill** — `.claude/skills/hermes-bridge/SKILL.md` has valid frontmatter (`name: hermes-bridge`), a scoping gate (step 0), and the no-secrets guardrail; it appears in the skill list.
4. **Honesty check** — grep the server: `grep -ri 'hermes\|nous' server/` returns **nothing** (no provider branch). The docs never claim Hermes is a live provider.

## §3 — Invariants

- **No runtime code changed** — no new route, no `server/lib/**` edit, no `public/js/**` edit. `llm-dispatch.mjs` has **no** Hermes/Nous branch (asserted by the canary).
- **No new i18n keys** — the dict snapshot stays 1208 (the teaser/banner are README prose, not `t()` keys).
- **Docs-ahead-of-code, honestly labeled** — every Hermes surface says planned / not-yet-wired / blocked; none imply a working provider.
- **CHANGELOG parity** — 17 locales, newest heading `## [1.146.0]`.

## §4 — Not in this release (see `docs/UX-ROADMAP.md` Phase 5 / 5b)

- **v1.147.0 (Phase 5b, part 2):** the in-app help "Hermes & Telegram" H2 §30 ×17 (H2/H3 gate 29→30, 105→108) + `DocsFab`/docs-assistant grounding + the cvstart.org marketing surface.
- **Phase 5 (blocked):** the actual Hermes/Nous LLM-provider integration — needs the API-contract spike (base URL, auth, OpenAI-compatibility, model ids, streaming, tool-calling) confirmed first.

## §5 — Sign-off

Suite **2376** green · `hermes-docs` canary 4/4 · HERMES.md + skill present with honesty markers · README teaser (EN + 13 locales) + banner ×17 at v1.146.0 · OVERVIEW Integrations link · no server Hermes branch · i18n audit clean (snapshot 1208) · CHANGELOG parity ×17.
