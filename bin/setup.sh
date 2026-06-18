#!/usr/bin/env bash
# career-ops-ui — one-command bootstrap.
#
# Sets up BOTH repos (Fighter90/career-ops + Fighter90/career-ops-ui) in
# the current directory and starts the web UI. Idempotent: safe to re-run.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Fighter90/career-ops-ui/main/bin/setup.sh | bash
#
# Or after cloning manually:
#   bash web-ui/bin/setup.sh
#
# What it does:
#   1. Clones (or updates) Fighter90/career-ops into ./career-ops
#   2. Clones (or updates) Fighter90/career-ops-ui into career-ops/web-ui
#   3. Adds /web-ui/ to career-ops/.gitignore (so the parent doesn't track it)
#   4. Installs npm deps for web-ui (only on first run, three deps: express + js-yaml + multer)
#   5. Starts the server on http://127.0.0.1:4317
#
# Env knobs:
#   PORT              default 4317
#   HOST              default 127.0.0.1
#   CAREER_OPS_DIR    target dir for the parent project (default: ./career-ops)
#   SKIP_START=1      install only, don't launch the server

set -euo pipefail

CAREER_OPS_REPO="${CAREER_OPS_REPO:-https://github.com/Fighter90/career-ops.git}"
CAREER_OPS_UI_REPO="${CAREER_OPS_UI_REPO:-https://github.com/Fighter90/career-ops-ui.git}"
CAREER_OPS_DIR="${CAREER_OPS_DIR:-career-ops}"
PORT="${PORT:-4317}"
HOST="${HOST:-127.0.0.1}"

bold()  { printf "\033[1m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
dim()   { printf "\033[2m%s\033[0m\n" "$1"; }

bold ""
bold "  career-ops-ui — one-command setup"
bold "  ───────────────────────────────────"
dim   "  parent: $CAREER_OPS_REPO"
dim   "  ui:     $CAREER_OPS_UI_REPO"
dim   "  target: $(pwd)/$CAREER_OPS_DIR"
echo  ""

# ── 0. preflight ──────────────────────────────────────────────────────
need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "  error: '$1' is required but not installed."
    [ -n "${2:-}" ] && dim "  → $2"
    exit 1
  fi
}
need git "Install: brew install git  /  apt install git"
need node "Install Node.js >= 18 from https://nodejs.org"
need npm

NODE_MAJOR=$(node -p "parseInt(process.versions.node, 10)")
if [ "$NODE_MAJOR" -lt 18 ]; then
  red "  error: Node.js >= 18 required (found $(node -v))"
  exit 1
fi
green "  ✓ git, node $(node -v), npm $(npm -v)"

# ── 1. parent repo ────────────────────────────────────────────────────
if [ -d "$CAREER_OPS_DIR/.git" ]; then
  green "  ✓ $CAREER_OPS_DIR already cloned — fetching updates"
  ( cd "$CAREER_OPS_DIR" && git fetch --quiet origin && \
    git pull --quiet --ff-only origin main 2>/dev/null || true )
else
  green "  → cloning $CAREER_OPS_REPO"
  git clone --quiet "$CAREER_OPS_REPO" "$CAREER_OPS_DIR"
fi

# ── 2. UI repo as web-ui ──────────────────────────────────────────────
UI_DIR="$CAREER_OPS_DIR/web-ui"
if [ -d "$UI_DIR/.git" ]; then
  green "  ✓ $UI_DIR already cloned — fetching updates"
  ( cd "$UI_DIR" && git fetch --quiet origin && \
    git pull --quiet --ff-only origin main 2>/dev/null || true )
else
  green "  → cloning $CAREER_OPS_UI_REPO into $UI_DIR"
  git clone --quiet "$CAREER_OPS_UI_REPO" "$UI_DIR"
fi

# ── 3. tell parent to ignore web-ui ──────────────────────────────────
GITIGNORE="$CAREER_OPS_DIR/.gitignore"
if ! grep -q "^/web-ui" "$GITIGNORE" 2>/dev/null; then
  echo "" >> "$GITIGNORE"
  echo "# career-ops-ui (separate repo: $CAREER_OPS_UI_REPO)" >> "$GITIGNORE"
  echo "/web-ui/" >> "$GITIGNORE"
  green "  ✓ added /web-ui/ to $GITIGNORE"
else
  green "  ✓ /web-ui/ already in $GITIGNORE"
fi

# ── 4. npm install ────────────────────────────────────────────────────
if [ ! -d "$UI_DIR/node_modules" ]; then
  green "  → installing npm deps (one-time, three packages: express + js-yaml + multer)"
  ( cd "$UI_DIR" && npm install --silent --no-audit --no-fund )
else
  green "  ✓ npm deps already installed"
fi

# ── 5. scaffold any missing user-data files from upstream templates ──
# This avoids the red "Setup issue" badges on the Health page on first launch.
# Each scaffolded file contains a clear "EDIT ME" marker so the user knows
# exactly what to fill in.

scaffold_cv() {
  local target="$CAREER_OPS_DIR/cv.md"
  [ -f "$target" ] && return
  # Realistic example CV (fictional — Alex Doe). Lets the project run
  # end-to-end out of the box: scan finds vacancies, evaluator can match
  # against this CV, dashboard shows metrics. Replace with your own when
  # ready (or use the "📁 Upload CV" button in the UI).
  cat > "$target" <<'CV_EOF'
# Alex Doe

Senior Backend Engineer · 8 years · PHP + Go · Berlin → Remote EU/UK

## Summary

Senior backend engineer with 8 years building high-throughput services
in PHP (Symfony, Laravel) and Go. Shipped microservices handling 50K+
RPS at peak, led migrations from monoliths to event-driven architectures
on Kafka, and mentored 6 engineers across 2 teams. Comfortable owning
a service from API design through production observability.

## Experience

### Acme Marketplace — Senior Backend Engineer
*Mar 2023 — present · Berlin (remote-first)*

- Led migration of the order-pricing service from monolith PHP 7.4 to a
  fleet of 4 Go microservices (gRPC + Kafka), reducing p99 latency
  **from 380 ms to 95 ms (−75%)** under 2× peak load.
- Designed the new shipping-rates API consumed by 12 internal clients;
  reached **99.97% availability** over 9 months with zero post-launch
  PagerDuty incidents.
- Mentored 3 mid-level engineers: introduced async code review playbook,
  cut average PR cycle time from 3.2 days to 1.4 days.
- Stack: Go 1.22, PHP 8.3 (Symfony 6.4), PostgreSQL 16, Kafka, Redis,
  Kubernetes (EKS), Datadog, GitHub Actions.

### Northwind SaaS — Backend Engineer
*Jan 2020 — Feb 2023 · Berlin*

- Built the multi-tenant billing engine in Symfony + Doctrine handling
  €4.2M ARR across 1.8K B2B accounts; **reduced invoice-error rate from
  1.1% to 0.07%** by introducing event sourcing for state transitions.
- Owned the public REST API (140+ endpoints) — wrote OpenAPI spec,
  versioning policy, deprecation workflow; SDK clients in 4 languages.
- Performance: cut average PDF-invoice generation from 3.4 s to 410 ms
  with a Redis-backed render queue and PHP-FPM tuning.
- Stack: PHP 8.1 (Symfony 5.4), MySQL 8, RabbitMQ, Redis, Docker,
  Bitbucket Pipelines.

### Tinker Studio — PHP Developer
*Aug 2017 — Dec 2019 · Berlin*

- Shipped 14 client projects (e-commerce, CMS, internal tooling) in
  Laravel 5.x → 8.x; consistent on-time delivery across 3 PMs.
- Wrote the studio's reusable headless-CMS skeleton — adopted by all
  new projects, **cut greenfield setup from 5 days to 6 hours**.

## Projects

- **`open-rate-limiter`** — Go library, sliding-window rate limiter
  with Redis backend. 1.2K GitHub stars, used in production by 3
  companies. https://github.com/example/open-rate-limiter
- **`acme-cli`** — internal-tool CLI in Go for managing the marketplace
  staging environments. Adopted across 4 teams (24 daily users).

## Education

- 2013–2017 — TU Berlin, BSc Computer Science (GPA 1.7 / 1.0 best)

## Skills

- **Backend:** Go (1.22), PHP (8.3, Symfony 6, Laravel 10), gRPC, REST
- **Databases:** PostgreSQL, MySQL, Redis, ClickHouse, Elasticsearch
- **Streaming:** Kafka, RabbitMQ, NATS
- **Cloud / DevOps:** Docker, Kubernetes (EKS), Terraform, Datadog,
  Prometheus, Grafana, GitHub Actions
- **Practices:** TDD, event sourcing, DDD, code review, on-call
- **Languages:** English (C1), German (B2)
CV_EOF
  green "  ✓ scaffolded $target — sample CV (Alex Doe). Replace with yours when ready."
}

scaffold_profile() {
  local target="$CAREER_OPS_DIR/config/profile.yml"
  [ -f "$target" ] && return
  mkdir -p "$CAREER_OPS_DIR/config"
  if [ -f "$CAREER_OPS_DIR/config/profile.example.yml" ]; then
    cp "$CAREER_OPS_DIR/config/profile.example.yml" "$target"
    green "  ✓ scaffolded $target from profile.example.yml — please edit"
  else
    cat > "$target" <<'PROFILE_EOF'
# EDIT ME — replace with your real values
candidate:
  full_name: "Your Name"
  email: "you@example.com"
  phone: ""
  location: "City, Country"
  linkedin: "https://www.linkedin.com/in/your-handle/"
  portfolio_url: ""
  github: ""

target_roles:
  primary:
    - "Senior Backend Engineer"
  archetypes:
    - name: "Senior Backend Engineer"
      level: "Senior"
      fit: "primary"
      notes: "Replace with your strongest archetype"

compensation:
  target_currency: "USD"
  target_range:
    base_min: 100000
    base_max: 160000

language:
  modes_dir: "modes"
PROFILE_EOF
    green "  ✓ scaffolded $target — please edit"
  fi
}

scaffold_portals() {
  local target="$CAREER_OPS_DIR/portals.yml"
  [ -f "$target" ] && return
  if [ -f "$CAREER_OPS_DIR/templates/portals.example.yml" ]; then
    cp "$CAREER_OPS_DIR/templates/portals.example.yml" "$target"
    green "  ✓ scaffolded $target from portals.example.yml"
  else
    cat > "$target" <<'PORTALS_EOF'
# Minimal portals.yml. Add more entries from docs/portals-examples.md in
# the career-ops-ui repo for ready-to-paste blocks (24+ verified companies).
title_filter:
  positive:
    - "Backend"
    - "Senior"
  negative:
    - "Junior"
    - "Intern"
  # seniority_boost reranks (does not filter) — matching jobs surface higher.
  # Default per career-ops.org/docs.
  seniority_boost:
    - "Senior"
    - "Staff"
    - "Lead"

tracked_companies:
  - name: GitLab
    careers_url: https://about.gitlab.com/jobs/
    api: https://boards-api.greenhouse.io/v1/boards/gitlab/jobs
    scan_method: greenhouse
    enabled: true

  - name: Vercel
    careers_url: https://vercel.com/careers
    api: https://boards-api.greenhouse.io/v1/boards/vercel/jobs
    scan_method: greenhouse
    enabled: true

  - name: Linear
    careers_url: https://linear.app/careers
    api: https://api.ashbyhq.com/posting-api/job-board/linear?includeCompensation=true
    scan_method: ashby
    enabled: true

# Russian portals (used by web-ui /api/stream/scan-ru).
russian_portals:
  sources: ["habr"]   # add "hh" if running from a Russian IP
  area: 113
  per_page: 50
  queries:
    - "Senior Backend"
PORTALS_EOF
    green "  ✓ scaffolded minimal $target — see docs/portals-examples.md to add more"
  fi
}

scaffold_data() {
  mkdir -p "$CAREER_OPS_DIR/data"
  if [ ! -f "$CAREER_OPS_DIR/data/applications.md" ]; then
    cat > "$CAREER_OPS_DIR/data/applications.md" <<'APPS_EOF'
# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
APPS_EOF
    green "  ✓ scaffolded data/applications.md (empty tracker)"
  fi
  if [ ! -f "$CAREER_OPS_DIR/data/pipeline.md" ]; then
    cat > "$CAREER_OPS_DIR/data/pipeline.md" <<'PIPE_EOF'
# Pipeline — Pending URLs

Drop job URLs (one per line) inside the fence. Run scan or `/career-ops pipeline`
to process them.

```
```
PIPE_EOF
    green "  ✓ scaffolded data/pipeline.md (empty pipeline)"
  fi
}

bold ""
bold "  Scaffolding starter files (so Health is green on first launch)"
scaffold_cv
scaffold_profile
scaffold_portals
scaffold_data

# ── 6. show first-run hints ───────────────────────────────────────────
echo ""
bold "  Setup complete."
dim   "  parent project: $(cd "$CAREER_OPS_DIR" && pwd)"
dim   "  web UI:         $(cd "$UI_DIR" && pwd)"
echo  ""
dim   "  → Edit cv.md, config/profile.yml, portals.yml in the parent project."
dim   "  → Then refresh the Health page — everything should be green."
dim   "  → Or use the CV view in the UI to upload your CV directly."

# ── 7. launch ─────────────────────────────────────────────────────────
if [ "${SKIP_START:-0}" = "1" ]; then
  bold "  Skipping start (SKIP_START=1). To launch later:"
  dim   "    bash $UI_DIR/bin/start.sh"
  exit 0
fi

bold "  Launching at http://${HOST}:${PORT}/"
echo  ""
exec env PORT="$PORT" HOST="$HOST" bash "$UI_DIR/bin/start.sh"
