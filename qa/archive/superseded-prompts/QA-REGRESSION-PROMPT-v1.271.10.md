# QA regression prompt — v1.271.10

Swarm release (CAR-262). Story: Postings whose job description is only rendered by script (JSON-LD or embedded blobs) previously stalled evaluation with empty JD text, and Cloudflare challenge pages could slip past liveness. The swarm added the JD-parse rescue, wired prefetch into auto-pipeline, refused Cloudflare-challenge pages, recognized Bokmål ATS headings, and taught scoring the `positioning_band` field. Evaluations on script-rendered boards now get real JD text with fewer junk fetches.
[0m
> build · glm-5.3-flash

- Gates at ship time: see the CHANGELOG entry for 1.271.10 and the release workflow run.
- Spot check: Parent-sync #8: JD-загрузка и evaluate — script-rendered JD prefetch (#6604), JSON-LD JobPosting fetch (lib/jd-page-fetch), Cloudflare-challenge refusal (#6798), Bokmål ATS headings (#6654), positioning_band (#6789) behaves as described; no regressions on the touched surfaces.
