# Contributing to career-ops-ui

Thanks for your interest in improving career-ops-ui — a zero-build Express + vanilla-JS dashboard for the [career-ops](https://github.com/Fighter90/career-ops) job-search pipeline. This guide covers everything from a first-time setup to shipping a release-grade pull request.

Questions first? Open an [issue](https://github.com/Fighter90/career-ops-ui/issues) or start from the [wiki](https://github.com/Fighter90/career-ops-ui/wiki). Bug reports are easiest through the in-app reporter (notifications drawer → bug icon) — it pre-fills a privacy-floored diagnostic snapshot.

## Getting started

```bash
git clone https://github.com/Fighter90/career-ops-ui.git web-ui
cd web-ui
npm install          # two runtime deps: express + js-yaml
npm start            # http://127.0.0.1:4317
npm test             # full unit/integration suite (node --test)
```

- **Node ≥ 18** for the server and tests. The `site/` landing (cvstart.org) is a separate Astro artifact and needs **Node ≥ 22.12** — it builds only in CI, so you rarely need this locally.
- The app runs fine without the parent career-ops project — endpoints that relay parent scripts fail soft with `{available:false}`.

## Project map

| Path | What it is |
|---|---|
| `server/index.mjs` | ~130-line orchestrator; all logic lives in `server/lib/` |
| `server/lib/routes/*.mjs` | 31 route modules, one per topic, `register<Topic>Routes(app)` |
| `server/lib/sources/*.mjs` | 61 scan-source clients (self-registering `meta` blocks) |
| `server/lib/portals/adapters/*.mjs` | Fetch-walk adapters registered in `ALL_ADAPTERS` |
| `public/` | The SPA — vanilla JS, hash router, `<script src>` only, **no build step** |
| `public/js/lib/locales/` | One i18n dictionary per locale (16 locales) |
| `docs/` | Architecture, conventions, ADRs, and the in-app help (`docs/help/<locale>.md`) |
| `tests/` | `node --test` suites + Playwright + two E2E runners |
| `site/` | cvstart.org landing (Astro, CI-built — the no-build rule still owns `public/`) |
| `qa/` | Release QA regression prompts |

Read [`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md) before touching a layer, and [`docs/sdd/CONVENTIONS.md`](docs/sdd/CONVENTIONS.md) for the full conventions list.

## Hard rules (PRs violating these are rejected)

1. **Never write outside `web-ui/`.** The parent career-ops project (`../cv.md`, `../data/`, …) is user-owned; code changes never touch it.
2. **Never commit real user data** — CVs, applications, salary numbers, API keys. Test against fixtures under `tests/fixtures/` or a `CAREER_OPS_ROOT=$(mktemp -d)` bootstrap.
3. **Never weaken the security envelope**: CSP without `'unsafe-inline'` in `script-src` (no inline handlers — `addEventListener` only), `isValidJobUrl()` SSRF gate on every user-supplied URL fetch, `stripDangerousMarkdown()` on CV/markdown ingress, `UI.md()` as the client render boundary.
4. **ESM only, no new runtime deps lightly** — anything beyond `express` + `js-yaml` needs a written justification.
5. **No bundlers/transpilers/TypeScript in the SPA.** `site/` is the only carve-out.
6. **Tests must be CI-isolated** — no network, no parent-project dependency, no hardcoded port 4317. Spawn `createApp()` in-process on an ephemeral port.

## Testing

```bash
npm test                 # unit + integration (the floor: keep it ≥ the README badge)
npm run test:ci          # + changelog parity ×16 + i18n audit
npm run test:coverage    # V8 coverage — keep ≥ 80% line on non-trivial logic
npm run test:e2e         # smoke E2E (20 steps)
npm run test:e2e:full    # comprehensive E2E (23 steps)
npm run test:e2e:browser # Playwright: all pages × 16 locales
```

TDD for new behavior: write the failing test first, watch it fail, make it pass. Pure refactors with existing coverage may skip it. Prefer real fixtures over mocks of internal collaborators.

## Adding a scan source (the most common contribution)

An EN job-board source touches **two registries** plus tests:

1. `server/lib/sources/<slug>.mjs` — `export const meta = { value, label, region }`, a host-pinned `assert<Name>Url` SSRF guard, `fetch<Name>(apiUrl, opts)` using `fetchJson`/`fetchText` from `http-json.mjs`, returning the uniform job shape (`{ id, title, company, url, salary, location, isRemote, workplaceType, relocates, date, snippet, source }`).
2. `server/lib/portals/adapters/<slug>.mjs` — `{ id, label, matches, buildEndpoint, fetch }`, appended to `ALL_ADAPTERS` in `server/lib/portals/registry.mjs`.
3. Bump the three registry assertions (`tests/adapter-registry.test.mjs`, `tests/scan-sources-endpoint.test.mjs`) — and note `tests/scan-fallback-sources.test.mjs` will fail until you add the source to `FALLBACK_SOURCES` in `public/js/views/scan.js` (exact value + label).
4. Add `tests/sources-<slug>.test.mjs` with a stubbed `fetchImpl` — no network.

Full walkthrough with reference adapters: in-app help **§17** (`docs/help/en.md`) and the wiki's [Scanner-Providers](https://github.com/Fighter90/career-ops-ui/wiki/Scanner-Providers) page. RU sources additionally need a `RU_DISPATCH` row in `server/lib/ru-scanner.mjs`.

## i18n — every user-facing string ships in 16 locales

`en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr, pl, uk, da, ar, de, it, tr`

- New UI keys go into **every** `public/js/lib/locales/i18n-dict.<lang>.js`, then regenerate `tests/fixtures/i18n-dict.snapshot.json`. Parity is CI-gated.
- New features get a section in **every** `docs/help/<locale>.md` bundle (H2/H3 counts are gated — bump them together).
- README ×16 and CHANGELOG ×16 carry translated release notes; `scripts/check-changelog-parity.mjs` blocks drift.
- Arabic is RTL — check your UI change under `<html dir="rtl">`.
- The `site/` landing has its own dictionaries (`site/src/i18n/*.json`, gated by `site/scripts/check-i18n.mjs`).

## Commits & pull requests

- **Conventional commits**: `feat(scan): …`, `fix(api): …`, `docs: …`, `test: …`, `chore: …`, `refactor: …`, `perf: …`, `ci: …`; breaking changes use `!`.
- One PR = one logical change. Branch names use `feature/`, `fix/`, `chore/` prefixes.
- Don't bypass hooks (`--no-verify` is banned); the pre-commit AI review is advisory, **`ci.yml` is the hard gate**.
- A PR is mergeable when: CI matrix (Node 18/20/22) green, CodeQL green, Playwright green, test floors kept, i18n/docs fan-out complete for user-facing changes.

## Release process (maintainers)

Version bumps follow semver with `package.json` as the source of truth. Each release ships: CHANGELOG ×16 + README badges ×16, help updates ×16, a QA delta driver under `qa/`, a tag `v<X.Y.Z>` (fires the Release workflow), and a Publish dispatch to GitHub Packages. See the wiki's [Release-Process](https://github.com/Fighter90/career-ops-ui/wiki/Release-Process) page.

## Security

Found a vulnerability? Please **do not** open a public issue — follow [SECURITY.md](SECURITY.md) (private vulnerability reporting is enabled on the repo).

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
