# 17 — JDs

## Goal

`#/jds` lists every saved JD under `jds/<name>.txt`. Add via `POST /api/jds`. Delete via `DELETE /api/jds/:name`. JD content is read with `GET /api/jds/:name`.

## Inputs

| Endpoint | Body / Param |
|---|---|
| `GET /api/jds` | — |
| `GET /api/jds/:name` | `:name` slug |
| `POST /api/jds` | `{ name, text }` |
| `DELETE /api/jds/:name` | `:name` slug |

## Negative cases

| Case | Expected |
|---|---|
| Slug not matching `[\w\-.]+` | `400 { error: "invalid name" }` |
| Empty text | `400 { error: "name and text required" }` |
| File missing on read or delete | `404 { error: "not found" }` |
| JD text > 50,000 characters (`MAX_JD_CHARS`) | `413` |

## Test coverage

- `tests/jds-delete.test.mjs` — list / read / save / delete.
