# portals.yml — ready-to-paste blocks

Drop these into the `tracked_companies:` list of your `career-ops/portals.yml`
to enable scanning. The classic per-company ATSes are
**Greenhouse · Ashby · Lever · Workable · SmartRecruiters · Workday**, joined in
v1.76.0 by the per-tenant ATSes **BambooHR · Breezy HR · Comeet · Personio ·
Recruitee · SolidJobs** (see below). Board-wide and regional aggregators
(RemoteOK / Remotive / Working Nomads / IBM / Arbeitsagentur / Glints /
Jobstreet · SEEK) are selected with an explicit `provider:` block — see the help
guide §5.

If a slug ever 404s upstream, just remove that one entry — the scanner
skips companies whose API call fails and continues with the rest.

> **v1.14.0 update.** Three new adapters joined the registry (Workable,
> SmartRecruiters, Workday). The blocks below for those three are
> documented examples — verify the slug in each board's URL before
> pasting. Workday is **beta** because each customer hosts on a different
> tenant + site path; the adapter assumes `site=External` when omitted.

## Greenhouse boards

```yaml
  - name: Stripe
    careers_url: https://stripe.com/jobs/search
    api: https://boards-api.greenhouse.io/v1/boards/stripe/jobs
    scan_method: greenhouse
    notes: "Heavy Go + Ruby. Remote-friendly."
    enabled: true

  - name: GitLab
    careers_url: https://about.gitlab.com/jobs/
    api: https://boards-api.greenhouse.io/v1/boards/gitlab/jobs
    scan_method: greenhouse
    notes: "Fully remote; Go + Ruby."
    enabled: true

  - name: Vercel
    careers_url: https://vercel.com/careers
    api: https://boards-api.greenhouse.io/v1/boards/vercel/jobs
    scan_method: greenhouse
    enabled: true

  - name: Cloudflare
    careers_url: https://www.cloudflare.com/careers/jobs/
    api: https://boards-api.greenhouse.io/v1/boards/cloudflare/jobs
    scan_method: greenhouse
    notes: "Heavy Go usage."
    enabled: true

  - name: Discord
    careers_url: https://discord.com/careers
    api: https://boards-api.greenhouse.io/v1/boards/discord/jobs
    scan_method: greenhouse
    enabled: true

  - name: Datadog
    careers_url: https://www.datadoghq.com/careers/
    api: https://boards-api.greenhouse.io/v1/boards/datadog/jobs
    scan_method: greenhouse
    notes: "Go-heavy. Remote EU options."
    enabled: true

  - name: Elastic
    careers_url: https://www.elastic.co/careers
    api: https://boards-api.greenhouse.io/v1/boards/elastic/jobs
    scan_method: greenhouse
    enabled: true

  - name: Grafana Labs
    careers_url: https://grafana.com/about/careers/
    api: https://boards-api.greenhouse.io/v1/boards/grafanalabs/jobs
    scan_method: greenhouse
    notes: "Go observability; remote EU welcome."
    enabled: true

  - name: CockroachDB
    careers_url: https://www.cockroachlabs.com/careers/
    api: https://boards-api.greenhouse.io/v1/boards/cockroachlabs/jobs
    scan_method: greenhouse
    notes: "Pure Go database company."
    enabled: true

  - name: Fastly
    careers_url: https://www.fastly.com/about/careers
    api: https://boards-api.greenhouse.io/v1/boards/fastly/jobs
    scan_method: greenhouse
    enabled: true

  - name: Twilio
    careers_url: https://www.twilio.com/en-us/company/jobs
    api: https://boards-api.greenhouse.io/v1/boards/twilio/jobs
    scan_method: greenhouse
    enabled: true

  - name: Coinbase
    careers_url: https://www.coinbase.com/careers
    api: https://boards-api.greenhouse.io/v1/boards/coinbase/jobs
    scan_method: greenhouse
    notes: "Remote-first. Go-heavy."
    enabled: true

  - name: Reddit
    careers_url: https://www.redditinc.com/careers
    api: https://boards-api.greenhouse.io/v1/boards/reddit/jobs
    scan_method: greenhouse
    enabled: true

  - name: Robinhood
    careers_url: https://careers.robinhood.com/
    api: https://boards-api.greenhouse.io/v1/boards/robinhood/jobs
    scan_method: greenhouse
    enabled: true

  - name: Affirm
    careers_url: https://www.affirm.com/careers
    api: https://boards-api.greenhouse.io/v1/boards/affirm/jobs
    scan_method: greenhouse
    enabled: true

  - name: Lyft
    careers_url: https://www.lyft.com/careers
    api: https://boards-api.greenhouse.io/v1/boards/lyft/jobs
    scan_method: greenhouse
    enabled: true
```

## Ashby boards

```yaml
  - name: Linear
    careers_url: https://linear.app/careers
    api: https://api.ashbyhq.com/posting-api/job-board/linear?includeCompensation=true
    scan_method: ashby
    notes: "Top-tier product company; Remote US/EU."
    enabled: true

  - name: Supabase
    careers_url: https://supabase.com/careers
    api: https://api.ashbyhq.com/posting-api/job-board/supabase?includeCompensation=true
    scan_method: ashby
    notes: "Remote-first; PostgreSQL/Go."
    enabled: true

  - name: PostHog
    careers_url: https://posthog.com/careers
    api: https://api.ashbyhq.com/posting-api/job-board/posthog?includeCompensation=true
    scan_method: ashby
    notes: "Remote-first analytics."
    enabled: true

  - name: Ramp
    careers_url: https://ramp.com/careers
    api: https://api.ashbyhq.com/posting-api/job-board/ramp?includeCompensation=true
    scan_method: ashby
    enabled: true

  - name: Modal Labs
    careers_url: https://modal.com/careers
    api: https://api.ashbyhq.com/posting-api/job-board/modal?includeCompensation=true
    scan_method: ashby
    enabled: true

  - name: Railway
    careers_url: https://railway.com/careers
    api: https://api.ashbyhq.com/posting-api/job-board/railway?includeCompensation=true
    scan_method: ashby
    notes: "Infra; remote-first."
    enabled: true

  - name: Browserbase
    careers_url: https://www.browserbase.com/careers
    api: https://api.ashbyhq.com/posting-api/job-board/browserbase?includeCompensation=true
    scan_method: ashby
    enabled: true
```

## Lever boards

```yaml
  - name: JetBrains
    careers_url: https://www.jetbrains.com/careers/jobs/
    api: https://api.lever.co/v0/postings/jetbrains
    scan_method: lever
    notes: "Czech / EU. Go-heavy backend."
    enabled: true
```

## Per-tenant ATS boards (v1.76.0 — parent career-ops v1.13.0 parity)

Six more ATSes auto-detect from the `careers_url` host (no `provider:` needed).
Each pins its host with an anchored regex + `redirect:'error'`, so a server-side
redirect can't bounce the fetch off-domain (SSRF-safe).

```yaml
  # BambooHR — https://<tenant>.bamboohr.com/careers/list
  - name: Acme
    careers_url: https://acme.bamboohr.com
    enabled: true

  # Breezy HR — https://<tenant>.breezy.hr/json
  - name: Foo
    careers_url: https://foo.breezy.hr
    enabled: true

  # Personio — https://<slug>.jobs.personio.de/xml (public XML feed; .com also works)
  - name: Bar GmbH
    careers_url: https://bar.jobs.personio.de
    enabled: true

  # Recruitee — https://<slug>.recruitee.com/api/offers/
  - name: Baz
    careers_url: https://baz.recruitee.com
    enabled: true

  # SolidJobs — https://solid.jobs/public-api/offers/<division>
  # divisions: it, engineering, marketing, sales, hr, logistics, finances, other
  - name: SolidJobs — IT
    careers_url: https://solid.jobs/public-api/offers/it
    enabled: true

  # Comeet — needs the FULL careers-api URL (uid + token aren't in the branded page)
  - name: ComeetCo
    api: https://www.comeet.co/careers-api/2.0/company/<uid>/positions?token=<token>
    enabled: true
```

## RU portals (extension recognized by career-ops-ui)

```yaml
russian_portals:
  sources: ["hh", "habr"]
  area: 113          # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "PHP Symfony"
    - "PHP Laravel"
    - "PHP-разработчик"
    - "Senior Go"
    - "Golang Backend"
    - "Go-разработчик"
    - "Backend Senior"
    - "Тимлид PHP"
    - "Тимлид Go"
```

---

## How to find more boards

The detection is dead simple — for any company you suspect uses one of these
ATS systems, try:

```bash
curl -sS "https://boards-api.greenhouse.io/v1/boards/<slug>/jobs" -o /dev/null -w "%{http_code}\n"
curl -sS "https://api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true" -o /dev/null -w "%{http_code}\n"
curl -sS "https://api.lever.co/v0/postings/<slug>" -o /dev/null -w "%{http_code}\n"
```

`200` means there's a board with that slug. `404` means try a different slug.
The slug is usually the company name in lowercase, dash-separated, or the
subdomain of their careers site. Examples:

- `https://boards.greenhouse.io/instacart` → slug `instacart`
- `https://jobs.ashbyhq.com/linear` → slug `linear`
- `https://jobs.lever.co/jetbrains` → slug `jetbrains`

---

## v1.14.0 — 13 trending boards (assign to your registered ATS)

These companies appeared in user requests; each one's `careers_url` is the
SPA-recognizable form. **Verify the slug before pasting** — companies do
migrate between ATSes. If you hit a 404, drop the entry or update the URL
to whichever ATS the company moved to. The `enabled: false` flag below is
intentional — flip to `true` after you confirm the slug responds.

### Greenhouse-hosted (verify slug at job-boards.greenhouse.io/<slug>)

```yaml
  - name: Stripe
    careers_url: https://job-boards.greenhouse.io/stripe
    enabled: false

  - name: GitLab
    careers_url: https://job-boards.greenhouse.io/gitlab
    enabled: false

  - name: HashiCorp
    careers_url: https://job-boards.greenhouse.io/hashicorp
    enabled: false

  - name: Cloudflare
    careers_url: https://job-boards.greenhouse.io/cloudflare
    enabled: false

  - name: Datadog
    careers_url: https://job-boards.greenhouse.io/datadog
    enabled: false

  - name: Hugging Face
    careers_url: https://job-boards.greenhouse.io/huggingface
    enabled: false
```

### Ashby-hosted (verify slug at jobs.ashbyhq.com/<slug>)

```yaml
  - name: Notion
    careers_url: https://jobs.ashbyhq.com/notion
    enabled: false

  - name: Linear
    careers_url: https://jobs.ashbyhq.com/linear
    enabled: false

  - name: PostHog
    careers_url: https://jobs.ashbyhq.com/posthog
    enabled: false

  - name: Replicate
    careers_url: https://jobs.ashbyhq.com/replicate
    enabled: false

  - name: Modal Labs
    careers_url: https://jobs.ashbyhq.com/modal
    enabled: false

  - name: Fly.io
    careers_url: https://jobs.ashbyhq.com/fly
    enabled: false

  - name: Render
    careers_url: https://jobs.ashbyhq.com/render
    enabled: false
```

---

## Workable boards (v1.14.0)

Public REST: `https://apply.workable.com/api/v3/accounts/<account>/jobs`.
Detect via `apply.workable.com/<slug>` or legacy `<slug>.workable.com`.

```yaml
  - name: ExampleWorkable
    careers_url: https://apply.workable.com/example-corp/
    enabled: false
    notes: "Replace example-corp with the account slug from the careers page URL."
```

## SmartRecruiters boards (v1.14.0)

Public REST: `https://api.smartrecruiters.com/v1/companies/<slug>/postings`.
Detect via `jobs.smartrecruiters.com/<slug>` or `careers.smartrecruiters.com/<slug>`.

```yaml
  - name: ExampleSmartRecruiters
    careers_url: https://jobs.smartrecruiters.com/ExampleCorp
    enabled: false
    notes: "Replace ExampleCorp with the slug from the careers page URL."
```

## Workday boards — BETA (v1.14.0)

Public CXS feed: POST `https://<tenant>.wd<N>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs`.
Detect via `<tenant>.wdN.myworkdayjobs.com/<lang>/<site>`. The adapter
defaults `site=External` when not present in the URL.

```yaml
  - name: ExampleWorkday
    careers_url: https://example-tenant.wd5.myworkdayjobs.com/en-US/External
    enabled: false
    notes: "BETA — some tenants gate CXS behind CAPTCHA; fallback to /career-ops scan."
```

## Aggregator boards (v1.75.0)

Seven board-wide / config-driven sources ported from parent career-ops v1.12.0.
Unlike the ATSes above they are **not** detected from a `careers_url` — each is
selected by an explicit `provider:` field on a `tracked_companies` entry. All
seven run the same `title_filter` / `location_filter` / `content_filter` + dedup
+ pipeline-append flow as every other source.

### Board-wide remote feeds — RemoteOK / Remotive / Working Nomads / We Work Remotely

Whole-board remote-jobs feeds. No per-entry config — just the `provider:` slug.
The board returns its full feed and your `title_filter` (and optional
`content_filter`) gate the rows. One entry pulls the entire board, so one each is
plenty:

```yaml
  - { name: RemoteOK,          provider: remoteok,       enabled: true }
  - { name: Remotive,          provider: remotive,       enabled: true }
  - { name: Working Nomads,    provider: workingnomads,  enabled: true }
  - { name: We Work Remotely,  provider: weworkremotely, enabled: true }   # v1.79.0 — board-wide RSS feed
```

### IBM careers (config-driven — global, language-agnostic)

POSTs to IBM's careers search API. One endpoint serves every locale. Reads the
entry's `ibm:` block:

```yaml
  - name: IBM Germany — SWE & Data
    provider: ibm
    ibm:
      country: Germany                                          # field_keyword_05
      categories: ["Software Engineering", "Data & Analytics"]  # field_keyword_08
    enabled: true
```

### Arbeitsagentur (config-driven — German national job board)

Hits the public Bundesagentur für Arbeit Jobsuche API (recall-first; the scanner
filters afterwards). Reads the entry's `arbeitsagentur:` block:

```yaml
  - name: Arbeitsagentur — ML/KI Deutschland
    provider: arbeitsagentur
    arbeitsagentur:
      keywords: ["Machine Learning Engineer", "Data Scientist"]  # required
      wo: Berlin              # optional anchor city; omit for nationwide
      umkreis: 50             # km radius around `wo` (default 50)
      days: 30                # recency window in days (default 30)
      size: 100               # results per keyword (1–100, default 100)
      remoteNationwide: true  # also run a nationwide pass keeping remote-titled hits
    enabled: true
```

### Glints (config-driven — SE Asia: SG / ID / MY / VN)

Hits the public GraphQL endpoint behind glints.com search. Reads the entry's
`glints:` block:

```yaml
  - name: Glints Indonesia
    provider: glints
    glints:
      searchKeywords: "Machine Learning"
      countryCode: ID        # SG | ID | MY | VN (default ID)
      pageSize: 30
      maxPages: 3
    enabled: true
```

### Jobstreet / SEEK (config-driven — APAC chalice-search)

Jobstreet and SEEK share SEEK's no-auth chalice-search JSON API. Reads the
entry's `jobstreet:` block:

```yaml
  - name: Jobstreet Indonesia
    provider: jobstreet
    jobstreet:
      siteKey: ID-Main       # e.g. ID-Main, MY-Main, SEEK-AU, SEEK-NZ
      searchKeywords: "Data Scientist"
      searchLocation: "Jakarta"
      pageSize: 30
      maxPages: 3
    enabled: true
```
