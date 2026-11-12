# QA regression prompt — v1.271.11

Swarm release (CAR-259). Story: Norwegian postings that had closed showed a local closure banner the liveness checker did not know, so dead jobs looked live in scan results. The swarm ported the parent fix into `liveness-core.mjs` and added tests pinning it alongside scanner snapshot-safety behavior. Closed Norwegian postings now expire correctly, while genuinely live postings still win over soft banner wording.
[0m
> build · glm-5.3-flash

- Gates at ship time: see the CHANGELOG entry for 1.271.11 and the release workflow run.
- Spot check: Parent-sync #4: liveness-волна — норвежский баннер закрытия (#6788) + scanner-correctness (#6757, #6784, #6779) behaves as described; no regressions on the touched surfaces.
