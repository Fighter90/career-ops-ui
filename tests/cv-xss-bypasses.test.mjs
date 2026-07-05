/**
 * v1.22.0 (M-4) — stripDangerousMarkdown bypass regression sweep.
 *
 * The pre-v1.22 implementation matched script/style/javascript: as
 * literal substrings. An attacker could store HTML-entity-encoded
 * variants of the same payloads in cv.md; downstream renderers that
 * decode entities (or browsers consuming the file via untrusted paths)
 * would resurrect the payload.
 *
 * This sweep locks in the v1.22 behavior: the decoder normalizes
 * `&lt;`, `&gt;`, `&amp;`, `&quot;`, `&#NN;`, and `&#xHH;` BEFORE the
 * strip regex runs, so the dangerous patterns are caught regardless
 * of encoding.
 *
 * Note: `stripDangerousMarkdown` is documented as defense-in-depth, not
 * a full sanitizer — the production client renders all markdown through
 * UI.md which escape-firsts everything. The strip's job is to neutralize
 * payloads in the AT-REST file so external consumers (cat, grep, third-
 * party tools) don't get a live script back.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripDangerousMarkdown } from '../server/lib/security.mjs';

// ─── Entity-encoded tag bypasses ───────────────────────────────────

test('strips entity-encoded <script> via &lt; &gt;', () => {
  const payload = '&lt;script&gt;alert(1)&lt;/script&gt;';
  const out = stripDangerousMarkdown(payload);
  assert.ok(!/<script/i.test(out), `expected no <script>, got: ${out}`);
  assert.ok(!/script>alert/i.test(out));
});

test('strips numeric-entity-encoded javascript: scheme', () => {
  // java&#115;cript:  (115 = "s")
  const payload = '[click](java&#115;cript:alert(1))';
  const out = stripDangerousMarkdown(payload);
  assert.ok(!/javascript\s*:/i.test(out), `still contains javascript: → ${out}`);
});

test('strips hex-entity-encoded javascript: scheme', () => {
  // ja&#x76;ascript:  (0x76 = "v")
  const payload = '<a href="ja&#x76;ascript:alert(1)">x</a>';
  const out = stripDangerousMarkdown(payload);
  assert.ok(!/javascript\s*:/i.test(out));
});

test('strips entity-encoded onerror handler in img tag', () => {
  // &lt;img src=x onerror=alert(1)&gt;
  const payload = '&lt;img src=x onerror=alert(1)&gt;';
  const out = stripDangerousMarkdown(payload);
  assert.ok(!/onerror/i.test(out), `onerror leaked: ${out}`);
  // The decoder un-escapes <img to <img then strips onerror; final
  // result should have no `on*=` attribute pair.
});

test('strips SVG with onload via data URI', () => {
  const payload = '<img src="data:image/svg+xml,<svg onload=alert(1)></svg>">';
  const out = stripDangerousMarkdown(payload);
  // Either the entire <svg>…</svg> block is gone, or at minimum the
  // onload= attribute pair is. Both pass the rendering safety bar.
  assert.ok(!/onload\s*=/i.test(out), `onload= survived: ${out}`);
});

// ─── Belt-and-suspenders: existing v1.20 cases must keep passing ─

test('still strips literal <script> tag', () => {
  const out = stripDangerousMarkdown('# CV\n<script>alert(1)</script>\nbody');
  assert.ok(!/<script/i.test(out));
  assert.match(out, /# CV/);
  assert.match(out, /body/);
});

test('still strips literal javascript: in href', () => {
  const out = stripDangerousMarkdown('[x](javascript:alert(1))');
  assert.ok(!/javascript\s*:/i.test(out));
});

test('still strips literal on* event handlers', () => {
  const out = stripDangerousMarkdown('<button onclick="evil()">x</button>');
  assert.ok(!/onclick/i.test(out));
});

// ─── v1.107.0 CodeQL hardening: end-tag variants, reforming, unclosed ───

test('strips a script end-tag with trailing junk/attributes (bad-tag-filter)', () => {
  assert.ok(!/<script/i.test(stripDangerousMarkdown('<script>alert(1)</script foo>')));
  assert.ok(!/<script/i.test(stripDangerousMarkdown('<script>alert(1)</script\n bar>')));
  assert.ok(!/<style/i.test(stripDangerousMarkdown('<style>x{}</style bar>')));
});

test('strips a payload that a single pass would REVEAL (incomplete-multi-char)', () => {
  // Removing the inner `<script></script>` reforms `<script>…</script>`, which
  // the repeat-until-stable loop then removes too.
  const nested = '<scr<script></script>ipt>alert(1)</scr<script></script>ipt>';
  assert.ok(!/<script/i.test(stripDangerousMarkdown(nested)));
});

test('strips an UNCLOSED executable opener (no closing tag present)', () => {
  assert.ok(!/<script/i.test(stripDangerousMarkdown('<script src="//evil">alert(1)')));
  assert.ok(!/<iframe/i.test(stripDangerousMarkdown('text <iframe src="//evil"> more')));
});

// ─── Decoder edge cases (no XSS, just contract) ────────────────────

test('decodes &amp; without resurrecting double-encoded payload', () => {
  // &amp;lt;script&amp;gt; — double-encoded. After one decode pass we
  // get &lt;script&gt; which the next strip turns harmless. The
  // current implementation runs entity decode ONCE, so &amp;lt; ends
  // up as &lt; in the output — still safe (no `<` glyph). Lock that
  // in.
  const payload = '&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;';
  const out = stripDangerousMarkdown(payload);
  // No literal "<script" must appear regardless of decode depth.
  assert.ok(!/<script/i.test(out));
});

test('passes through harmless plain text unchanged', () => {
  const out = stripDangerousMarkdown('# Hello\n\n## Section\n\nA paragraph.');
  assert.match(out, /# Hello/);
  assert.match(out, /## Section/);
  assert.match(out, /A paragraph\./);
});

test('passes through markdown with safe entities (currency)', () => {
  // We deliberately do NOT decode &copy; / &nbsp; etc. — only the four
  // entities relevant to XSS rewriting. Stored CV body with `&copy; 2026`
  // should round-trip unchanged.
  const out = stripDangerousMarkdown('© 2026 Alex Doe — &copy;');
  // The literal &copy; isn't in our decode list; it should survive.
  assert.match(out, /&copy;/);
});
