# NOTICE — Licensing & Attribution

This file explains **what the [MIT License](LICENSE) covers, who holds the copyright, and how third-party material is licensed**. The legally binding text is [`LICENSE`](LICENSE); this NOTICE is an explanatory companion, kept deliberately non-normative.

## Copyright holder

**career-ops-ui** — Copyright © 2026
**Sergei Emelianov** (GitHub: [Fighter90](https://github.com/Fighter90) · [sergey-cv.com](https://sergey-cv.com/) · [LinkedIn](https://www.linkedin.com/in/sergey-emelyanov-in-job/))
and the [career-ops-ui contributors](https://github.com/Fighter90/career-ops-ui/graphs/contributors).

Each contributor retains copyright over their contributions; by contributing they license their work under the same MIT terms (see [CONTRIBUTING.md](CONTRIBUTING.md) → License).

## What the MIT license covers

Everything authored in this repository, including:

| Material | Where |
|---|---|
| Server code | `server/` (Express app, route modules, scan sources/adapters) |
| SPA code | `public/` (vanilla-JS views, libs, CSS) |
| Tests & tooling | `tests/`, `scripts/`, `tools/` |
| Documentation | `docs/` (architecture, conventions, ADRs), `qa/`, the README/CHANGELOG files |
| Translations | all 16 locale dictionaries, help bundles, localized READMEs/CHANGELOGs |
| Landing source | `site/` (Astro components, styles, site dictionaries) |
| Project wiki content | the [GitHub wiki](https://github.com/Fighter90/career-ops-ui/wiki) |

In short: **use, copy, modify, merge, publish, distribute, sublicense and/or sell** — commercially or not — as long as the copyright notice and permission notice travel with copies or substantial portions, and with **no warranty** of any kind (see the full text in [`LICENSE`](LICENSE)).

## What is NOT covered

- **Your own data.** CVs, application history, salary data, reports and API keys the app reads/writes at runtime belong to you and never fall under this license (they are also never committed — see [SECURITY.md](SECURITY.md)).
- **The parent project.** [career-ops](https://github.com/Fighter90/career-ops) is a separate work under its own license; this repository only *reads* its files at runtime.
- **Third-party job-board content.** Postings fetched by the scanner remain the property of the respective boards/employers; the scanner only hits public, unauthenticated endpoints.
- **Names & logos.** "career-ops-ui", "cvstart.org" and third-party trademarks (Greenhouse, Workday, LinkedIn, …) are used nominatively; the MIT grant covers code, not trademark use.

## Third-party components

Runtime dependencies (npm, each under its own permissive license):

| Package | License | Used for |
|---|---|---|
| [express](https://github.com/expressjs/express) | MIT | HTTP server |
| [js-yaml](https://github.com/nodeca/js-yaml) | MIT | `portals.yml` / config parsing |

The `site/` landing additionally bundles at build time:

| Package | License | Used for |
|---|---|---|
| [Astro](https://github.com/withastro/astro) + integrations | MIT | static site build (CI only) |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT | landing styles |
| [Figtree](https://fonts.google.com/specimen/Figtree/license) (via Fontsource) | SIL OFL 1.1 | landing text face |
| [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) (via Fontsource) | SIL OFL 1.1 | landing mono face |
| [sharp](https://github.com/lovell/sharp) | Apache-2.0 | OG-image generation (build only) |

Dev/test tooling (Playwright, @astrojs/check, TypeScript for `site/` only) is not distributed with the app. Full dependency trees: `package-lock.json` and `site/package-lock.json`; license changes are watched by the Dependency Review CI job.

## Attribution (appreciated, not required)

MIT does not require visible credit beyond preserving the license text, but if you build on this project a link back is welcome:

> Based on [career-ops-ui](https://github.com/Fighter90/career-ops-ui) by Sergei Emelianov and contributors, MIT license.
