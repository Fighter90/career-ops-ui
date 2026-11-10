# QA regression prompt — v1.271.3

Parent-sync wave (career-ops @ 298d2282): 3 new scan providers (turbohire, adp-myjobs, sitemap — registry 135 → 138), provider-fix wave (jobicy full-walk, workday, adp-workforcenow, applicantpro, mokahr, computrabajo, apple, dover, oraclecloud, platsbanken), scanner wave (partial boards, retry-after-sweep, close date in pipeline, ISO case-sensitive location match).

- Gates at ship: full test:ci + Playwright + evals green; coverage re-ratcheted (177 exempt files).
- Spot checks: new providers answer in `#/scan` sources dropdown (138 total); jobicy boards walk past page 1; a posting with a known close date shows the chip in `#/pipeline`; location filter keeps uppercase ISO entries.
- remote-QA: perf=true leg; live=true optional.
