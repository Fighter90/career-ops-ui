# QA regression prompt — v1.271.7

Swarm release (CAR-268). Story: The Apple job source previously read only the newest slice of Apple's careers board, so postings beyond the first pages never appeared in scan results. The swarm ported the parent's full-board walk to the Apple source and adapter and covered it with expanded red-first tests. Scans now surface the complete live Apple board, not just its latest entries.
[0m
> build · glm-5.3-flash

- Gates at ship time: see the CHANGELOG entry for 1.271.7 and the release workflow run.
- Spot check: Parent-sync #5b: cryptojobs eligibility-клауза тизера (#6765+#6747) + apple full_board (#6634) behaves as described; no regressions on the touched surfaces.
