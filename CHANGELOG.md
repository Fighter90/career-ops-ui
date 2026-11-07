## [1.270.0] — 2026-11-07

### Added
- **Six new scan sources (registry 135 = 130 EN + 5 RU · 130 adapters)** — **ALDI Nord** (single-company provider, per-tenant detail pages, full stop-reason machinery), **HiBob** (tenant boards `<tenant>.careers.hibob.com`, one job-ad API request), **HireHive** (`<tenant>.hirehive.com` v2 jobs API; later-page failures keep partials per the house contract), **Factorial** (tenant careers sites on the factorial domain family, CSP-derived allowlist, cross-domain tenant matching), **Polymer** (careers-API walk; RAW-length stops + a covering-count guard so a demo tenant's lying `total` cannot end a real board), **Remote** (apply.remote.com's own ATS; `closed`/not-accepting rows drop while unseen statuses never do — and region codes are kept AND spelled out so either vocabulary matches a location filter).
- **Scanner reads whole boards**: Consider walks its full catalog through the board's own `meta.sequence` with per-page retry and a hard cap warning (the ~10-posting first page was the whole scan); a country-only location filter now accepts worldwide labels (`worldwide`, `remote (worldwide)`) without widening a city list; a portals.yml entry can raise its request timeout with `timeout_ms`; `CAREER_OPS_HTTP_TIMEOUT_MS` is read per request, so setting it in `.env` after boot works; scan concurrency is configurable (`CAREER_OPS_SCAN_CONCURRENCY` / `CAREER_OPS_SCAN_HOST_CONCURRENCY`, defaults unchanged 32/10).
- **Telegram strict source grows real-world parsing** — Habr Career vacancy links (only `/vacancies/<id>` is a vacancy; profiles, lists and searches refuse), four positional employer shapes (`Employer ищет …`, `Title в Employer`, second-line `Employer is a …`, employer after the salary) with refusal rules for role/sector/department/format/person/place captures, and agency-withholding phrasing («название компании-заказчика не раскрыто») drops the post.
- **Job descriptions reach the content filter on six more boards** — RemoteOK, Remotive, We Work Remotely, Working Nomads, Jobspresso (the full post, not the WordPress excerpt) and Arbeitnow now carry a description; NoDesk titles decode the twice-escaped ampersand; Jobicy decodes HTML entities before deciding a row is empty.

### Fixed
- **Avature** accepts query-style `/JobDetail?jobId=` links and cards whose `article` class is not the leading one (Deloitte USI); **Arbeitsagentur** keeps reference numbers containing a slash working end to end (outgoing URL double-encodes, the liveness rung decodes once and compares the real refnr); **Getro** warns when `getro_max_pages` cuts a board short — and stays silent when the board genuinely ended.
- **Contributors list** — goldbillka joined ×19 READMEs, ta/vi gained the avatar cards, release badges actualized.

### Notes
- The board-body-cap fallbacks the parent added have no web-ui counterpart: this scanner's transport has no body-size cap (reads are bounded by the request budget, never a size failure) — documented no-port.
- The verify-portals probe-timeout fix is a no-port: the health surface probes `careers_url` pages, not ATS board APIs.
- Telegram strict keeps its Unicode-boundary `LOCATIONISH_RE` — the fork divergence is intact.

