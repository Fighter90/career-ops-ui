/**
 * Shared response-shape guards for board sources (v1.242.0, Phase 2).
 *
 * Phase-2 cross-cutting rule (docs/sdd/BACKLOG.md): a 200 with the wrong shape
 * THROWS on page 1 instead of silently reading as an empty board. Before this
 * module every source repeated the same anti-pattern —
 *   const jobs = (data.jobs || []).map(...)   // malformed 200 → [] → board
 *                                              // looks healthy-but-empty,
 *                                              // scan "succeeds"
 * — which hid dead sources (justjoin's envelope change shipped for months as
 * "0 postings") and let Cloudflare challenges read as empty boards. The
 * helpers here make the failure loud: the scanner's per-company catch sees the
 * throw, records the error text, and the quarantine layer treats the board as
 * broken instead of empty.
 *
 * Pure shape checks — no fetch, no network, no parent-project dependency.
 * The sources registry skips `_`-prefixed files, so this module is never
 * loaded as a source.
 */

/** Human-readable one-line description of a parsed-JSON value, for error text. */
function describe(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  switch (typeof value) {
    case 'string':
      return `a string (len ${value.length})`;
    case 'number':
      return `a number (${value})`;
    case 'boolean':
      return `a boolean (${value})`;
    case 'object':
      if (Array.isArray(value)) return `an array (len ${value.length})`;
      return `an object with keys [${Object.keys(value).slice(0, 8).join(', ')}]`;
    default:
      return typeof value;
  }
}

/** Dotted-path lookup ('data.jobs', 'pages.0.jobs'); returns true when the
 *  path resolves to a PRESENT value — `null` counts as absent, because a
 *  container key that arrived null means the API stopped speaking its shape. */
function hasPath(body, path) {
  let cur = body;
  for (const seg of String(path).split('.')) {
    if (!cur || typeof cur !== 'object') return false;
    if (!(seg in cur)) return false;
    cur = cur[seg];
  }
  return cur !== null && cur !== undefined;
}

/**
 * Assert the body is a JSON object (not an array, not null/primitives) and
 * return it. The base check behind requireContainer.
 */
export function requireObject(body, label) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TypeError(`${label}: expected a JSON object, got ${describe(body)}`);
  }
  return body;
}

/**
 * Assert the value is a real array and return it. Use on the rows array after
 * unwrapping the container — `(data.jobs || [])` becomes
 * `requireArray(data.jobs, 'Ashby jobs')`.
 */
export function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label}: expected an array, got ${describe(value)}`);
  }
  return value;
}

/**
 * Assert the body is an object that carries at least ONE of the alternative
 * container paths, and return the body. Use when a board has known envelope
 * variants (API version drift, regional hosts):
 *   requireContainer(body, 'VDAB', 'vacancies', 'resultaten')
 * A path that resolves to null/undefined does NOT satisfy the check.
 * The error names the label, the expected paths and the keys actually seen,
 * so the quarantine record says what arrived instead of what was missing.
 */
export function requireContainer(body, label, ...paths) {
  requireObject(body, label);
  for (const p of paths) {
    if (hasPath(body, p)) return body;
  }
  throw new TypeError(
    `${label}: expected a container with one of [${paths.join(', ')}], got ${describe(body)}`
  );
}
