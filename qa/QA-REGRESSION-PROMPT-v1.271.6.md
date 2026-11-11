# QA regression prompt — v1.271.6

Swarm release (CAR-263). Story: Repost detection missed the same role re-listed under regional title variants, previously seen postings stayed filtered out with no re-check window, and HTML entities in attribute contexts went undecoded. The swarm ported the parent's regional fold, recheck_after_days admission, a reverse-pipeline write lock, and attribute-mode entity decoding, with new regression tests for the re-check window and attribute decoding. Users now get cleaner repost grouping, postings re-admitted after the configured window, and correctly decoded job titles.
[0m
> build · glm-5.3-flash

- Gates at ship time: see the CHANGELOG entry for 1.271.6 and the release workflow run.
- Spot check: Parent-sync #7: сканер-волна — detect-reposts regional-fold (#6190), recheck_after_days admission (#5905), reverse-pipeline lock (#6022), html-entities attribute-mode behaves as described; no regressions on the touched surfaces.
