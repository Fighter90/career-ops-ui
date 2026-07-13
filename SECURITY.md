# Security Policy

career-ops-ui handles a live job search — CVs, application history, salary expectations and LLM API keys — so security reports get priority attention.

## Supported versions

Only the latest release line receives security fixes.

| Version | Supported |
|---|---|
| latest `v1.x` release (see [Releases](https://github.com/Fighter90/career-ops-ui/releases)) | ✅ |
| anything older | ❌ — upgrade first |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's **private vulnerability reporting** (enabled for this repo):

1. Go to the repo's [Security tab → Report a vulnerability](https://github.com/Fighter90/career-ops-ui/security/advisories/new).
2. Describe the issue, affected version, and a reproduction (a curl transcript or a failing test is ideal).
3. You'll get an acknowledgement within a few days; a fix for a confirmed report ships as the next patch release with a CHANGELOG credit (tell us if you prefer to stay anonymous).

Low-risk hardening ideas (headers, lint-level findings, dependency bumps) are fine as regular public issues.

## What counts as a vulnerability here

The app binds to `127.0.0.1` by default and is designed for a single local user, so the threat model is mostly about hostile *content*, not hostile *users*:

- **XSS / content injection** — a scanned job posting, imported CV, or LLM response executing script in the SPA. The render boundary is `UI.md()` client-side and `stripDangerousMarkdown()` on CV ingress; bypasses of either are always in scope.
- **SSRF** — getting the server to fetch a URL that `isValidJobUrl()` / `safeGet` should have refused (loopback, redirects to internal hosts, non-HTTP schemes), from any endpoint that takes a user-supplied URL.
- **Path traversal / parent-project writes** — any way to make the server read or write outside its allowed roots, especially into the user-owned parent career-ops files beyond the documented explicit write actions.
- **Secret leakage** — API keys or personal data ending up in logs, error messages, diagnostics (the in-app bug reporter is deliberately privacy-floored), or the repo itself.
- **CSP / header weakening** — anything that reintroduces `unsafe-inline`, drops `frame-ancestors 'none'`, or otherwise degrades the shipped response headers.
- **Prototype pollution / injection** in the config and content routes that accept structured input.

Out of scope: issues requiring the attacker to already run code on the user's machine, DoS against your own localhost instance, and reports against the separate parent [career-ops](https://github.com/Fighter90/career-ops) project (report those upstream).

## Hardening baseline (for reviewers)

- CSP without `'unsafe-inline'` in `script-src`; all handlers via `addEventListener`; `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` set centrally in `server/index.mjs`.
- Every outbound fetch of a user-supplied URL goes through the SSRF validator (`isValidJobUrl`) or the DNS-pinned `safeGet`; scan sources pin their exact upstream hostname in an `assert<Name>Url` guard.
- CV/markdown ingress is sanitized by `stripDangerousMarkdown()` (fixed-point tag strip); the client renders through `UI.md()` only.
- CodeQL + dependency review run on every PR; `npm audit` runs in the code-quality CI job.
- `.env*` files are gitignored; `.env.example` carries placeholders only.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full set of hard rules and [`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md) for where each boundary lives.
