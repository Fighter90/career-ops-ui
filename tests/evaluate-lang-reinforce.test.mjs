/**
 * CAR-183 — reinforced Tamil language directive in the evaluation prompt's
 * volatile tail.
 *
 * remote-QA v1.261.2: a ta evaluation produced a report that passed the A–G
 * structure check but came back in English (18/19 locales green — ta is the
 * only drift locale; hi has never drifted). The open directive (the locale
 * header) and the closing reminder (CAR-92) hold every other locale, so ta
 * alone gets one additional native-language sentence — the same lesson both
 * CAR-92 and CAR-174 recorded: a calm native sentence binds, a thundering
 * standalone mandate makes the weak-ta model drop the Latin A–G headings.
 *
 * Pattern per CAR-174: a per-locale map (`EVAL_LANGUAGE_REINFORCE`) rendered
 * into the volatile tail BEFORE the volume-budget block; the closing language
 * reminder stays the prompt's LAST instruction. '' for every other locale.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with cv.md; dynamic import inside
 * before(); no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let buildEvaluationPrompt;

const JD = 'Senior Platform Engineer at Acme. Kubernetes, Go, on-call.';

// Marker substrings of the reinforced ta directive (own wording, must stay
// stable — a change here is a prompt-behaviour change).
const REINFORCE_MARK = 'மொழி விதி (கட்டாயம்)'; // "Language rule (mandatory):"
const REINFORCE_BODY = 'தமிழில் மட்டுமே'; // "only in Tamil"
const BUDGET_MARK = 'அளவு வரம்பு'; // CAR-174 volume-budget lead
const REMINDER_MARK = 'Write the whole report in Tamil'; // CAR-92 closing reminder

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'eval-lang-reinforce-'));
  for (const d of ['config', 'data', 'modes', 'reports']) mkdirSync(resolve(dir, d), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  for (const m of ['_shared', 'oferta']) writeFileSync(resolve(dir, 'modes', `${m}.md`), `# ${m}\n`);
  process.env.CAREER_OPS_ROOT = dir;

  ({ buildEvaluationPrompt } = await import('../server/lib/prompts.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
});

test('the ta evaluation prompt carries the reinforced Tamil language directive', () => {
  const ta = buildEvaluationPrompt(JD, 'ta');
  assert.match(ta, /மொழி விதி \(கட்டாயம்\)/, 'reinforced-directive lead');
  assert.match(ta, /தமிழில் மட்டுமே/, 'ONLY in Tamil');
  assert.match(ta, /ஒவ்வொரு வாக்கியமும்/, 'every sentence');
  // English words allowed only as technical terms and names:
  assert.match(ta, /தொழில்நுட்பச் சொற்களாகவும்/, 'as technical terms');
  assert.match(ta, /பெயர்களாகவும் மட்டுமே/, 'and names only');
});

test('the reinforcement is ta-only: en, es and hi prompts do not carry it', () => {
  for (const lang of ['en', 'es', 'hi']) {
    assert.doesNotMatch(buildEvaluationPrompt(JD, lang), /மொழி விதி/, `${lang} must stay reinforcement-free`);
    assert.doesNotMatch(buildEvaluationPrompt(JD, lang), /தமிழில் மட்டுமே/, `${lang} must stay reinforcement-free`);
  }
});

test('the reinforcement rides the volatile tail BEFORE the volume budget; the language reminder stays LAST (CAR-92)', () => {
  const ta = buildEvaluationPrompt(JD, 'ta');
  const atReinforce = ta.indexOf(REINFORCE_MARK);
  const atBudget = ta.indexOf(BUDGET_MARK);
  const atReminder = ta.lastIndexOf(REMINDER_MARK);
  assert.ok(atReinforce > 0, 'reinforcement present');
  assert.ok(atBudget > atReinforce, 'budget comes after the reinforcement');
  assert.ok(atReminder > atBudget, 'language reminder stays the last instruction');
});

test('base-locale matching: ta-IN resolves to the same reinforcement as ta', () => {
  assert.ok(buildEvaluationPrompt(JD, 'ta-IN').includes(REINFORCE_BODY));
});

test('the reinforcement is in the volatile tail, not the cached stable part', () => {
  // The stable prefix is the context bundle + everything up to the JD block;
  // the reinforcement sits after the JD fence, in the uncached tail.
  const ta = buildEvaluationPrompt(JD, 'ta');
  const tailStart = ta.indexOf('JD (untrusted data');
  assert.ok(tailStart > 0);
  assert.ok(ta.indexOf(REINFORCE_MARK) > tailStart, 'reinforcement after the JD block');
});
