# FIX-PROMPT — `i18n-dict.js` cleanup × 8 locales (pre-fr ship)

External contributor audit of `public/js/i18n-dict.js` surfaced four classes of defects that block the upcoming French (`fr`) locale PR. Fix the **English source-of-truth** and **propagate to all 8 existing locales** (`en`, `es`, `pt-BR`, `ru`, `ja`, `ko`, `zh-CN`, `zh-TW`) before the French translator commits — otherwise these defects multiply.

**Audit source:** Discord `career-ops` server, `#feature-requests` channel, message from French-locale contributor on 2026-05-21.

**Doctrine — non-negotiable:**
> One issue per release, HIGH → MEDIUM → LOW. Bump + CHANGELOG ×8 (parity-gated) + dedicated test (must fail first) + Playwright-verify + pre-commit AI-review LGTM + CI-watch to green.

---

## §1 — Severity ledger

| ID | Severity | Class | Description |
|---|---|---|---|
| **I18N-CL1** | **🔴 CRITICAL** | Privacy / Security | Personal data of the maintainer leaked into public OSS dictionary (`training.coursePh = "AWS Solutions Architect Associate"`). Must be removed and the git history scrubbed-or-noted before further publishing. |
| **I18N-CL2** | 🟡 MEDIUM | Regression (v1.58.23 U-3) | `followup.lastPh` is now a hardcoded literal `"2026-04-21"`. U-3 originally shipped a dynamic `today − 14d` value; somewhere it regressed back to a string literal. |
| **I18N-CL3** | 🟡 MEDIUM | Dict hygiene (DRY) | Duplicate keys carry identical values — e.g. `nav.config` ↔ `config.title`, three `Help` strings. Translators have to translate the same word 2–3× and risk drift. |
| **I18N-CL4** | 🟢 LOW | Audit pass | Contributor said "etc" — implies more issues he didn't enumerate. Full diff-audit of the dictionary required to catch the long tail. |

**Bundled vs serial decision.** §10 below proposes one **bundled** ship — v1.59.12 — because all four items touch the same file (`public/js/i18n-dict.js`) and propagating to 8 locales × 4 issues × 4 patches = 128 edits is unrealistic to split. Bundled ship is doctrine-acceptable when (a) all items in the same file, (b) one shared test surface, (c) audit-authorised. This document **is** that authorisation.

---

## §2 — FIX I18N-CL1 (🔴 CRITICAL) — Remove personal data from placeholders

### What
`training.coursePh` contains `"AWS Solutions Architect Associate"`. That is the **maintainer's actual certification target**, not a neutral example. Personal data must not live in an OSS public dictionary.

### Diagnostic (run this first)

```bash
# Find all personal-data leaks in the dictionary
node - <<'EOF'
const fs = require('node:fs');
const src = fs.readFileSync('public/js/i18n-dict.js', 'utf-8');

// Patterns that are clearly maintainer-personal, not generic
const SUSPECT_PATTERNS = [
  /AWS\s+Solutions\s+Architect/i,
  /Azure\s+(Architect|Developer|Engineer)/i,
  /GCP\s+(Architect|Engineer)/i,
  /Senior\s+(Backend|Frontend|Fullstack)\s+Engineer.*Anthropic/i,
  // emails
  /[a-z0-9._%+-]+@(?:gmail|yandex|mail|outlook|proton|protonmail|hotmail)\.[a-z]{2,}/i,
  // GitHub handles that look personal
  /github\.com\/(?!career-ops|santifer|Fighter90|anthropic|openai|google)[\w-]+/i,
  // LinkedIn profile slugs
  /linkedin\.com\/in\/[\w-]+/i,
  // Specific company-targeting that looks like maintainer's job hunt
  /(?:Stripe|Notion|Vercel|Linear|Cloudflare)[^\w]/g,
];

const lines = src.split('\n');
const hits = [];
lines.forEach((line, i) => {
  for (const re of SUSPECT_PATTERNS) {
    if (re.test(line)) hits.push({ line: i + 1, text: line.trim() });
  }
});
console.log(`Found ${hits.length} suspect lines:`);
hits.forEach(h => console.log(`  L${h.line}: ${h.text.slice(0, 100)}`));
EOF
```

Run, paste output in the PR description, eyeball every match. **A "hit" doesn't always mean "remove"** — some companies might be examples in Help text legitimately. Use judgment: if it could plausibly be a generic example, keep with anonymisation; if it's clearly your own target, replace.

### Replacement strategy

Per-key generic placeholders (apply uniformly across all 8 locales):

| Field | Replace with (EN) | Replace with (RU) | Notes |
|---|---|---|---|
| `training.coursePh` | `"Cloud architecture certification"` | `"Сертификация по облачной архитектуре"` | Generic category, not vendor-specific |
| `interview-prep.companyPh` (if leaks) | `"Example Corp"` | `"Пример Корп."` | — |
| `interview-prep.rolePh` (if leaks) | `"Senior Backend Engineer"` | `"Senior Backend Engineer"` | Already generic; verify |
| `project.ideaPh` (if leaks) | `"Build a CLI that…"` | `"Сделать CLI, который…"` | Verify already generic |
| `followup.companyPh` | `"Stripe"` | `"Stripe"` | A well-known company name as example is OK (no personal data) |

**Important.** If your `git log -p public/js/i18n-dict.js` shows the commit that introduced `"AWS Solutions Architect Associate"` was authored by you (`Fighter90` / your email), the data is in public git history. Note this in the PR but do NOT rewrite history — that breaks downstream forks and the public-already.

### Test · `tests/i18n-no-personal-data.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('public/js/i18n-dict.js', 'utf-8');

const FORBIDDEN_PATTERNS = [
  /AWS\s+Solutions\s+Architect/i,
  /Azure\s+(Architect|Developer|Engineer)\s+Associate/i,
  /[a-z0-9._%+-]+@(?:gmail|yandex|mail|outlook|proton|protonmail|hotmail)\.[a-z]{2,}/i,
  /linkedin\.com\/in\/[\w-]+/i,
];

test('i18n-dict.js contains no maintainer-personal data', () => {
  for (const re of FORBIDDEN_PATTERNS) {
    const m = SRC.match(re);
    assert.equal(m, null,
      `Forbidden pattern ${re} matched: "${m?.[0]}"`);
  }
});
```

### Acceptance
- [ ] `tests/i18n-no-personal-data.test.mjs` green
- [ ] Diagnostic script reports 0 hits
- [ ] Replacement applied uniformly across all 8 locales (same generic placeholder, native-translated)

---

## §3 — FIX I18N-CL2 (🟡 MEDIUM) — Restore dynamic `followup.lastPh`

### What
`followup.lastPh` is currently a string literal `"2026-04-21"`. U-3 (v1.58.23) shipped a dynamic placeholder computed as `today − 14d`. The fix regressed somewhere.

### WHERE

```bash
git log --all -p -- public/js/i18n-dict.js | grep -n "lastPh\|U-3" | head -40
git log --all --oneline -- public/js/views/followup.js | head -20
```

The dynamic logic likely lives in `public/js/views/followup.js`, NOT in `i18n-dict.js`. The dictionary value should be just `""` or a meta-key (`__DYNAMIC__`) that the view replaces at render time.

### Fix
**Option A (view-level dynamic, recommended):**

```js
// public/js/views/followup.js — inside mountFollowup() or render()
const lastInput = document.getElementById('mode-followup-lastContact');
if (lastInput && !lastInput.value) {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const iso = fourteenDaysAgo.toISOString().slice(0, 10);  // YYYY-MM-DD
  lastInput.placeholder = iso;
}
```

Remove the literal `"2026-04-21"` from `followup.lastPh` in **all 8 locales** — set each to `""` (or a meta-marker if your i18n layer treats empty as fallback to en).

**Option B (i18n-time computation, more general):**

If `i18n-dict.js` supports function values:
```js
ru: {
  'followup.lastPh': () => {
    const d = new Date(Date.now() - 14 * 86400000);
    return d.toISOString().slice(0, 10);
  },
}
```

Pick A unless you have a broader case for function values in the dict.

### Test · extend `tests/qa-report-fixes.test.mjs`

```js
test('U-3 regression: followup.lastPh is dynamic, not a 2026 literal', () => {
  const src = readFileSync('public/js/i18n-dict.js', 'utf-8');
  // No hardcoded 2026 (or any year) date as a lastPh literal
  assert.equal(/lastPh[^,}]*['"]20\d{2}-\d{2}-\d{2}['"]/m.test(src), false,
    'followup.lastPh must not be a hardcoded YYYY-MM-DD literal');
});

test('followup view sets dynamic placeholder = today - 14d', async () => {
  // Playwright: navigate to #/followup, read placeholder of #mode-followup-lastContact
  const today = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  // ...assert placeholder === today
});
```

### Acceptance
- [ ] `tests/qa-report-fixes.test.mjs` updated — both new asserts green
- [ ] Playwright `#/followup` placeholder of `#mode-followup-lastContact` reads as `today − 14d` in EN
- [ ] Same dynamic behaviour in RU / ZH-CN / JA spot-check (placeholder is locale-agnostic by design)

---

## §4 — FIX I18N-CL3 (🟡 MEDIUM) — Dedupe keys with identical values

### What
- `nav.config` and `config.title` both contain `"App settings"` (and the localised equivalent in each locale)
- `'Help'` appears as the value of **3 distinct keys** in EN
- "etc" — the contributor implies many more

This is a DRY violation. Every duplicate = 8 redundant translator-edits, 8 risks of drift over time.

### Diagnostic — find all dupes

```bash
node - <<'EOF'
const dict = require('./public/js/i18n-dict.js');

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

const locales = ['en', 'es', 'pt-BR', 'ru', 'ja', 'ko', 'zh-CN', 'zh-TW'];
for (const loc of locales) {
  if (!dict[loc]) continue;
  const flat = flatten(dict[loc]);
  const valueToKeys = {};
  for (const [k, v] of Object.entries(flat)) {
    if (typeof v !== 'string' || v.length === 0) continue;
    (valueToKeys[v] ??= []).push(k);
  }
  const dupes = Object.entries(valueToKeys).filter(([_, keys]) => keys.length > 1);
  console.log(`\n=== ${loc} — ${dupes.length} duplicate-value groups ===`);
  dupes.slice(0, 30).forEach(([val, keys]) => {
    console.log(`  "${val}" → [${keys.join(', ')}]`);
  });
}
EOF
```

Paste the EN output in the PR description so the consolidation plan is visible.

### Consolidation policy

For each duplicate group:

1. **Identify the canonical key.** Prefer the one used most often in code (`git grep -c "'<key>'" public/js`). If tied, prefer the more specific one (`config.title` over `nav.config` because `nav.config` is just the side-nav label, but happens to share the EN word with the page title).
2. **Pick or create a single canonical key** that semantically fits both usages.
3. **For each remaining old key:** either delete and update every call-site to use the canonical key, OR keep both keys but make them reference the same value via a `@ref` mechanism if the i18n layer supports it.

**Most practical for this codebase** — delete the redundant key, codemod all call-sites:

```bash
# Example for nav.config / config.title duplicate
git grep -nE "['\"](nav\.config|config\.title)['\"]" public/js
# Pick one (e.g. config.title) and replace nav.config call-sites with it
git ls-files public/js | xargs sed -i.bak \
  -e "s/['\"]nav\.config['\"]/'config.title'/g"
# Then delete nav.config from i18n-dict.js in all 8 locales
rm public/js/**/*.bak
```

Common candidates to consolidate (verify with diagnostic):
- `nav.config` ↔ `config.title` → keep `config.title`
- `nav.help` ↔ `help.title` ↔ `help.h1` → keep `help.title`
- `nav.cv` ↔ `cv.title` → keep `cv.title`
- `nav.health` ↔ `health.title` → keep `health.title`

Apply the dedupe **identically** across all 8 locales — i.e. if `nav.config` is removed from EN, it must be removed from RU, JA, etc., and call-sites must use the canonical key.

### Test · `tests/i18n-no-duplicate-values.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';

// Allow-list of values that legitimately repeat (e.g. emoji-only or single chars)
const ALLOW = new Set(['', '·', '—', '×', '→', '⌘K', 'Ctrl+K']);

test('no key has a duplicate-value sibling in EN dict', async () => {
  const dict = (await import('../public/js/i18n-dict.js')).default;
  const en = flatten(dict.en);
  const valueToKeys = {};
  for (const [k, v] of Object.entries(en)) {
    if (typeof v !== 'string' || ALLOW.has(v)) continue;
    (valueToKeys[v] ??= []).push(k);
  }
  const dupes = Object.entries(valueToKeys).filter(([_, keys]) => keys.length > 1);
  assert.deepEqual(dupes, [],
    `Found duplicate values:\n${dupes.map(([v, ks]) => `  "${v}" → [${ks.join(', ')}]`).join('\n')}`);
});

function flatten(obj, prefix = '') { /* same as diagnostic */ }
```

### Acceptance
- [ ] Diagnostic reports 0 duplicate-value groups (or only allow-listed ones) in EN
- [ ] All 7 non-EN locales mirror the same key set (no key in EN that doesn't exist in RU, etc.)
- [ ] `tests/i18n-no-duplicate-values.test.mjs` green
- [ ] No call-site references a deleted key (`git grep` clean)

---

## §5 — FIX I18N-CL4 (🟢 LOW) — Full audit pass

### What
Run a full hygiene audit on `public/js/i18n-dict.js` to catch the long tail of issues the contributor implied with "etc".

### Audit checklist (`tools/i18n-audit.mjs`)

```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import dict from '../public/js/i18n-dict.js';

const LOCALES = ['en', 'es', 'pt-BR', 'ru', 'ja', 'ko', 'zh-CN', 'zh-TW'];
const issues = [];

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

const en = flatten(dict.en);
const enKeys = new Set(Object.keys(en));

// 1. Parity — every locale has the same keys as EN
for (const loc of LOCALES) {
  if (loc === 'en') continue;
  const flat = flatten(dict[loc] || {});
  const locKeys = new Set(Object.keys(flat));
  const missing = [...enKeys].filter(k => !locKeys.has(k));
  const extra = [...locKeys].filter(k => !enKeys.has(k));
  if (missing.length) issues.push(`[${loc}] missing keys (${missing.length}): ${missing.slice(0, 5).join(', ')}…`);
  if (extra.length) issues.push(`[${loc}] extra keys (${extra.length}): ${extra.slice(0, 5).join(', ')}…`);
}

// 2. Empty values
for (const loc of LOCALES) {
  const flat = flatten(dict[loc] || {});
  const empty = Object.entries(flat).filter(([_, v]) => typeof v === 'string' && v.trim() === '');
  if (empty.length > 0) issues.push(`[${loc}] empty values (${empty.length}): ${empty.slice(0, 5).map(([k]) => k).join(', ')}…`);
}

// 3. Latin leakage in CJK / Cyrillic locales (suspect if >40% Latin)
for (const loc of ['ru', 'ja', 'ko', 'zh-CN', 'zh-TW']) {
  const flat = flatten(dict[loc] || {});
  for (const [k, v] of Object.entries(flat)) {
    if (typeof v !== 'string' || v.length < 10) continue;
    const latin = (v.match(/[a-zA-Z]/g) || []).length;
    if (latin / v.length > 0.5 && !/^[A-Z][a-zA-Z\s]+$/.test(v)) {
      // >50% Latin in a non-Latin locale + not a proper noun-only string
      issues.push(`[${loc}] suspected Latin-leak in ${k}: "${v.slice(0, 60)}"`);
    }
  }
}

// 4. Personal-data scan (re-use §2 patterns)
const PERSONAL = [/AWS\s+Solutions\s+Architect/i, /Azure\s+\w+\s+Associate/i, /@gmail\.com|@yandex\./i];
for (const loc of LOCALES) {
  const flat = flatten(dict[loc] || {});
  for (const [k, v] of Object.entries(flat)) {
    if (typeof v !== 'string') continue;
    for (const re of PERSONAL) {
      if (re.test(v)) issues.push(`[${loc}] personal-data leak in ${k}: "${v.slice(0, 60)}"`);
    }
  }
}

// 5. Hardcoded dates (any YYYY-MM-DD literal that looks suspicious)
for (const loc of LOCALES) {
  const flat = flatten(dict[loc] || {});
  for (const [k, v] of Object.entries(flat)) {
    if (typeof v !== 'string') continue;
    if (/\b20\d{2}-\d{2}-\d{2}\b/.test(v) && !/example|sample|demo/i.test(v)) {
      issues.push(`[${loc}] hardcoded date in ${k}: "${v}"`);
    }
  }
}

// 6. Trailing/leading whitespace
for (const loc of LOCALES) {
  const flat = flatten(dict[loc] || {});
  for (const [k, v] of Object.entries(flat)) {
    if (typeof v === 'string' && v !== v.trim()) {
      issues.push(`[${loc}] whitespace in ${k}: "${v}"`);
    }
  }
}

// 7. Duplicate values within a locale (re-use §4)
for (const loc of LOCALES) {
  const flat = flatten(dict[loc] || {});
  const v2k = {};
  for (const [k, v] of Object.entries(flat)) {
    if (typeof v !== 'string' || v.length < 3) continue;
    (v2k[v] ??= []).push(k);
  }
  const dupes = Object.entries(v2k).filter(([_, ks]) => ks.length > 1);
  if (dupes.length) issues.push(`[${loc}] ${dupes.length} duplicate-value groups`);
}

console.log(`\n=== i18n audit: ${issues.length} issues ===\n`);
issues.forEach(i => console.log(i));
process.exit(issues.length ? 1 : 0);
```

Add to `package.json`:
```json
"scripts": {
  "audit:i18n": "node tools/i18n-audit.mjs"
}
```

### Acceptance
- [ ] `npm run audit:i18n` exits 0
- [ ] CI runs `npm run audit:i18n` on every PR
- [ ] Diagnostic output committed in the PR description with before/after counts

---

## §6 — Per-locale propagation contract

For each item above, the fix must be applied uniformly across **all 8 existing locales**. The 9th locale (`fr`) will follow once this cleanup ships.

| Locale | I18N-CL1 (personal-data) | I18N-CL2 (dynamic date) | I18N-CL3 (dedupe) | I18N-CL4 (full audit) |
|---|---|---|---|---|
| en | ☐ | ☐ | ☐ | ☐ |
| es | ☐ | ☐ | ☐ | ☐ |
| pt-BR | ☐ | ☐ | ☐ | ☐ |
| ru | ☐ | ☐ | ☐ | ☐ |
| ja | ☐ | ☐ | ☐ | ☐ |
| ko | ☐ | ☐ | ☐ | ☐ |
| zh-CN | ☐ | ☐ | ☐ | ☐ |
| zh-TW | ☐ | ☐ | ☐ | ☐ |

A row is "done" only when:
1. The English source-of-truth change is committed
2. The native-equivalent translation is committed in that locale
3. The corresponding test passes locally and on CI

---

## §7 — Updated `i18n-dict.js` example (EN excerpt)

Before:
```js
en: {
  'nav.config': 'App settings',
  'config.title': 'App settings',
  'training.coursePh': 'AWS Solutions Architect Associate',
  'followup.lastPh': '2026-04-21',
  'help.h1': 'Help',
  'nav.help': 'Help',
  'help.title': 'Help',
  // ...
}
```

After:
```js
en: {
  // 'nav.config' removed — call-sites use 'config.title'
  'config.title': 'App settings',
  'training.coursePh': 'Cloud architecture certification',
  // 'followup.lastPh' removed — placeholder set dynamically by views/followup.js
  // 'help.h1' and 'nav.help' removed — call-sites use 'help.title'
  'help.title': 'Help',
  // ...
}
```

Mirror this exact key-set transformation in all 7 other locales.

---

## §8 — CHANGELOG ×8 (one-line each, parity-gated)

EN example:
```md
## [1.59.12] - 2026-MM-DD

### Fixed
- i18n dictionary cleanup: removed personal-data leak in
  `training.coursePh`, restored dynamic `followup.lastPh`
  (regression of U-3), deduped `nav.config / config.title`,
  `nav.help / help.title / help.h1`, and `nav.cv / cv.title`
  groups. Added `npm run audit:i18n` static guard. Applied
  uniformly across all 8 locales. Unblocks the upcoming French
  locale PR. (I18N-CL1, I18N-CL2, I18N-CL3, I18N-CL4)
```

RU translation example:
```md
## [1.59.12] - 2026-MM-DD

### Fixed
- Чистка i18n-словаря: убрана утечка персональных данных в
  `training.coursePh`, восстановлен динамический `followup.lastPh`
  (регресс U-3), дедуплицированы группы `nav.config / config.title`,
  `nav.help / help.title / help.h1` и `nav.cv / cv.title`. Добавлен
  статический guard `npm run audit:i18n`. Применено единообразно
  во всех 8 локалях. Разблокирует предстоящий PR французской
  локали. (I18N-CL1, I18N-CL2, I18N-CL3, I18N-CL4)
```

Run `node scripts/check-changelog-parity.mjs` — all 8 must show `v1.59.12` at top.

---

## §9 — Acceptance protocol (per release)

```bash
git status                                       # clean
npm ci
node tools/i18n-audit.mjs                        # 0 issues
node scripts/check-changelog-parity.mjs          # all 8 @ v1.59.12
node scripts/check-no-also-leftovers.mjs

npm test                                         # >= 988 + 3 new tests, 0 fail
npm run test:e2e                                 # 20 smoke green
npm run test:e2e:full                            # 23 comprehensive green
npm run test:e2e:browser                         # 62 Playwright + new spy assert green

# Live verification in browser
npm start
# 1. Open #/followup — placeholder of #mode-followup-lastContact is today − 14d
# 2. Open #/training — placeholder of #mode-training-courseTarget is
#    "Cloud architecture certification" (NOT "AWS Solutions Architect…")
# 3. Switch locale to ru / ja / zh-CN → re-verify both placeholders are translated
# 4. grep i18n-dict.js for "AWS" — 0 matches
# 5. grep i18n-dict.js for "2026-04-21" — 0 matches

git commit -m "fix(i18n): dict cleanup × 8 locales (I18N-CL1..CL4)"
git tag v1.59.12
git push origin main v1.59.12
# CI Node 18/20/22 + Playwright → all 4 jobs success
```

---

## §10 — Bundling justification

The doctrine permits **one bundled release** when:
1. ✓ All items touch the same file surface (`public/js/i18n-dict.js` + `public/js/views/followup.js`)
2. ✓ One shared test surface (`tools/i18n-audit.mjs` covers all 4)
3. ✓ Audit-authorised (this document)
4. ✓ Splitting would multiply work by 8 (8 locales × 4 issues = 32 ships, infeasible)
5. ✓ All 4 issues block the same external contributor

The alternative — 32 single-fix ships — would take a week minimum and would block the French contributor for that entire window. **Bundled ship v1.59.12 is the doctrine-correct choice here.**

---

## §11 — Sign-off matrix

| Gate | Pass |
|---|---|
| §2 I18N-CL1 — `tests/i18n-no-personal-data.test.mjs` green; diagnostic 0 hits | ☐ |
| §3 I18N-CL2 — `followup.lastPh` dynamic in 8 locales; Playwright placeholder = today − 14d | ☐ |
| §4 I18N-CL3 — `tests/i18n-no-duplicate-values.test.mjs` green; 0 call-site references to deleted keys | ☐ |
| §5 I18N-CL4 — `npm run audit:i18n` exits 0; CI wires up the script | ☐ |
| §6 Per-locale propagation — all 8 locales updated identically | ☐ |
| §7 EN source-of-truth updated; mirrored to 7 other locales | ☐ |
| §8 CHANGELOG ×8 parity-gated | ☐ |
| §9 Live verification 5 steps green | ☐ |
| `npm test` ≥ 991 (988 + 3 new), 0 fail | ☐ |
| CI Node 18 / 20 / 22 + Playwright e2e — all `success` after tag push | ☐ |
| French contributor unblocked: re-pinged in Discord with PR-merged confirmation | ☐ |

---

## §12 — What the French contributor sees after this ships

```
fix(i18n): dict cleanup × 8 locales (I18N-CL1..CL4)

- nav.config / config.title duplicate consolidated to config.title
- nav.help / help.title / help.h1 consolidated to help.title
- nav.cv / cv.title consolidated to cv.title
- training.coursePh: "AWS Solutions Architect Associate" →
  "Cloud architecture certification" (personal-data leak removed)
- followup.lastPh: hardcoded "2026-04-21" → dynamic today−14d via
  views/followup.js (restored U-3 from v1.58.23)
- Added tools/i18n-audit.mjs + npm run audit:i18n
- Mirrored across en / es / pt-BR / ru / ja / ko / zh-CN / zh-TW
- 3 new tests:
  · i18n-no-personal-data.test.mjs
  · i18n-no-duplicate-values.test.mjs
  · qa-report-fixes.test.mjs (U-3 regression-lock extended)

Total: 988 → 991 unit tests, all 8 locales pass full audit.
Unblocks fr-locale PR.
```

Then ping him: `Hey, dict cleanup landed in v1.59.12 — all 4 items you flagged are fixed across 8 locales. Ready for the fr translation whenever you are 🙏`

---

*Generated 2026-05-21 based on external-contributor audit of i18n-dict.js. Hand to Claude Code or human dev. Bundled fix per §10 audit authorisation.*
