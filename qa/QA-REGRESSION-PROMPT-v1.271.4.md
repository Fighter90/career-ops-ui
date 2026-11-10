# QA regression prompt — v1.271.4

Patch release: CodeQL alert wave closed at source (6 alerts — unused vars/imports in test files, `GET /api/pipeline` rate-limited, provably-true conjunct dropped in adp-workforcenow, URL-substring assertions switched to anchored regexes). No product behavior change; tests 8126 unchanged.

- Gates: full test:ci green; coverage baseline re-ratcheted earlier in the wave.
- Spot checks: `GET /api/pipeline` still answers under repeated calls (rate limiter smoke); adp-workforcenow tenant-lang resolution unchanged (suite green); no user-visible surface touched.
- remote-QA: perf=true leg; live=true optional.
