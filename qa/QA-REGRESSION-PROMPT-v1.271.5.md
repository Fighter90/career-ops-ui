# QA regression prompt — v1.271.5

Swarm release (CAR-265). Story: Three scan boards misbehaved: startup-jobs surfaced only a teaser slice of its listings, hackernews fetched outside the shared HTTP layer, and platsbanken could end mid-board without saying so. The swarm ported the parent's fixes into each source and extended their suites to lock the new behavior. Users scanning these boards now get the full startup-jobs listing, consistent HTTP handling on hackernews, and honest truncation reporting on platsbanken.
[0m
> build · glm-5.3-flash

- Gates at ship time: see the CHANGELOG entry for 1.271.5 and the release workflow run.
- Spot check: Parent-sync #6a: startup-jobs teaser (#6774) + hackernews общий HTTP-контекст (#6680) + platsbanken truncated (#6804) behaves as described; no regressions on the touched surfaces.
