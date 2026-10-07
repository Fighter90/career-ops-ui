/**
 * v1.241.0 review hardening — security.mjs.
 *
 *  - stripDangerousMarkdown / sanitizeJobDescription removed tag spans with
 *    lazy `<tag\b[\s\S]*?</tag…>` regexes, which a backtracking engine retries
 *    from every opener: 160 KB of `<script ` blocked the event loop for 27 s
 *    (/api/cv/import accepts 10 MB). They now scan in linear time with the same
 *    matches.
 *  - A trailing-dot FQDN (`http://localhost./x`) slipped past isValidJobUrl.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let sec;
before(async () => {
  sec = await import('../server/lib/security.mjs');
});

const timed = (fn) => { const t = Date.now(); fn(); return Date.now() - t; };

test('adversarial unclosed-tag runs are sanitized in linear time', () => {
  const N = 40_000; // ~320 KB each; the old regexes needed minutes here
  const inputs = {
    unclosedScript: '<script '.repeat(N),
    closerFirst: '</script>' + '<script '.repeat(N),
    closerNoGt: '<script '.repeat(N) + '</script',
    iframeRun: '<iframe'.repeat(N),
    mixed: '<svg <form <style '.repeat(N / 3),
  };
  for (const [name, s] of Object.entries(inputs)) {
    const ms = timed(() => sec.stripDangerousMarkdown(s));
    assert.ok(ms < 1500, `${name}: ${ms}ms`);
    const out = sec.stripDangerousMarkdown(s);
    assert.doesNotMatch(out, /<\s*\/?\s*(script|iframe|svg|form|style)\b/i, name);
  }
  const ms = timed(() => sec.sanitizeJobDescription('<script '.repeat(N * 4)));
  assert.ok(ms < 1500, `sanitizeJobDescription: ${ms}ms`);
});

test('paired removal keeps the old semantics', () => {
  const f = sec.stripDangerousMarkdown;
  assert.equal(f('a<script>x</script>b'), 'ab');
  assert.equal(f('a<SCRIPT src=1>x</script foo>b'), 'ab');
  assert.equal(f('a<script>1</script>m<script>2</script>z'), 'amz');
  // first closer after the opener wins (lazy), text between pairs survives
  assert.equal(f('<style>p{}</style>keep<style>q{}</style>'), 'keep');
  // nested reveal: the revealed opener is stripped, the stray closer escaped
  assert.equal(f('<scr<script></script>ipt>alert(1)</script>'), 'alert(1)&lt;/script>');
  // `<scripts>` is not a script tag (word boundary)
  assert.match(f('<scripts>ok</scripts>'), /ok/);
  // opener without closer: the opener alone goes, the text stays
  assert.equal(f('hi <iframe src=x> there'), 'hi  there');
  assert.equal(f('a<embed src=x/>b'), 'ab');
  // truncated opener with no `>` is escaped by the final belt
  assert.equal(f('tail <script'), 'tail &lt;script');
  // ordinary markdown is untouched
  const md = '# CV\n\n- **Role** at Co (2020–2024)\n- a < b > c\n';
  assert.equal(f(md), md);
});

test('sanitizeJobDescription: strict `</script\\s*>` closer, linear', () => {
  const g = sec.sanitizeJobDescription;
  assert.equal(g('a<script>x</script >b'), 'ab');
  assert.equal(g('a<script>x</script\n>b'), 'ab');
  // `</script foo>` is not a closer under the strict form; the later one is
  assert.equal(g('a<script>x</script foo>y</script>b'), 'ab');
  // no valid closer → nothing removed
  assert.equal(g('a<script>x</script foo>b'), 'a<script>x</script foo>b');
  assert.equal(g('plain'), 'plain');
  assert.equal(g(42), '');
});

test('trailing-dot FQDNs are treated as the host they name', () => {
  assert.equal(sec.isPrivateOrLoopbackHost('localhost.'), true);
  assert.equal(sec.isPrivateOrLoopbackHost('LOCALHOST..'), true);
  assert.equal(sec.isPrivateOrLoopbackHost('foo.localhost.'), true);
  assert.equal(sec.isPrivateOrLoopbackHost('example.com.'), false);
  assert.equal(sec.isValidJobUrl('http://localhost./x'), false);
  assert.equal(sec.isValidJobUrl('https://jobs.example.com./x'), true);
});

test('stripDangerousMarkdown leaves no live on…= handler even past the 8-pass strip cap', async () => {
  const { stripDangerousMarkdown } = await import('../server/lib/security.mjs');
  let attr = 'onclick="x"';
  for (let i = 0; i < 12; i++) attr = attr.replace('on', 'on' + 'on' + 'click="y" on'); // deep nesting
  const out = stripDangerousMarkdown(`<a ${attr}>link</a> <img src=x onerror=alert(1)>`);
  assert.equal(/\son[a-z]+\s*=/i.test(out), false, out.slice(0, 200));
  assert.ok(out.includes('link'), 'text is kept');
});
