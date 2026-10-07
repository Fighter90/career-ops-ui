# Company logos in the scan table (v1.104.0)

**Status:** Shipped · **Version:** 1.104.0 · **Date:** 2026-07-06

## Problem

Parent-web parity: show company logos in the scan table (and reusable across the
app), behind a toggle. The obvious sources (Clearbit, logo.dev, Google favicons)
all leak **which employers the user is scanning** to a third party — a privacy
regression the rest of the app avoids. The user chose the privacy-preserving
option: the favicon from the company's **own** domain.

## Solution

### Server

- **`safe-fetch.mjs`** — a minimal `binary: true` option on `safeGet` returns the
  raw `Buffer` + `content-type` instead of a utf8 string. All SSRF protections —
  DNS-pinned transport, redirect-target validation, the `maxBytes` cap — are
  unchanged; only body decoding differs.
- **`server/lib/routes/logos.mjs`** (29th route module) — `GET /api/logo?domain=`:
  validates the domain (`isPlausibleDomain` — no scheme/path/port/loopback),
  fetches `https://<domain>/favicon.ico` via the SSRF-safe binary path
  (`maxBytes` 200 KB, 6 s abort), **image-magic sniffs** the result so an HTML
  error page is never served as an image, and serves it with a 24 h cache header.
  Results (hits **and** misses) are cached in an in-memory LRU (cap 512, 24 h TTL)
  — **no disk writes** (this is a viewer over the parent). Errors / SSRF blocks /
  timeouts → 404, never a throw.

### Client

- **`public/js/lib/company-logo.js`** (`window.CompanyLogo`) — off by default via
  a `localStorage` flag. `domainFromUrl` derives the company domain from a scan
  row's URL but returns null for **shared ATS/aggregator hosts** (Greenhouse,
  Lever, Ashby, Workday, …) so the board's icon is never shown as the employer's;
  those get a deterministic coloured **letter-avatar**. `badge(url, name)` renders
  an `<img src="/api/logo?domain=…">` with a CSP-safe `img.onerror` fallback to the
  avatar — a logo is decoration, never load-bearing.
- **`#/scan`** company cell renders the badge next to the name when enabled.
- **`#/config`** gains an **Appearance** card with the "Show company logos" toggle.

## Invariants held

- **Privacy:** logos come only from the company's own domain (already contacted by
  the scanner), never a third-party logo API. Off by default.
- **SSRF-safe:** every fetch goes through `safeGet` (DNS-pinned, private-range
  blocked, size-capped, time-bounded). Domain input is validated first.
- **No writes / no user data / CSP-safe** (`img.onerror` property, no innerHTML).

## Tests

`tests/logo-routes.test.mjs` (5): domain guard (accepts real hosts, rejects
schemes/paths/loopback/junk), `fetchFavicon` accepts image-looking 200s and
rejects HTML/non-200/throws, the endpoint serves bytes on a hit and
**negatively-caches** a miss (no re-fetch), and `safeGet` binary mode returns the
Buffer + content-type while text mode is unchanged. 5 new i18n keys ×16
(`appear.*`). Help §2 extended in place (no new H2/H3).
