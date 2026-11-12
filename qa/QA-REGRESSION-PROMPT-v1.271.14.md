# QA regression prompt — v1.271.14

**The republish of v1.271.13**: the v1.271.13 tag was re-cut mid-deploy (the `_salary-text.mjs` coverage exemption landed between the tag and the deploy), which raced the production checkout's cached tag — production stayed on v1.271.12 while everything else was green. Cut fresh so the production checkout has never cached this tag. Content = v1.271.13 + the exemption.

## §0 Gates
- `npm run test:ci` — 8428/8411/0 (local Node 22, 2026-11-12). evals 0 ✗. CI green on the release commit.

## §1 Acceptance
- resumecraft.ru `/api/health` reports **version=1.271.14, parentVersion=1.40.0** after `deploy.yml mode=verify`.
- Full remote-qa (routes × locales, site, links) green on prod; the browser suite 210-pass locally.

## §2 Unchanged
Registry 140 = 135 EN + 5 RU · 135 adapters; `/api/pipeline`; scan filtering/dedup.
