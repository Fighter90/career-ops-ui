# QA REGRESSION PROMPT — career-ops-ui v1.61.0 · FULL / EXHAUSTIVE

Complete, detail-level hand-off for a QA tester (human or agent) to verify **everything that changed when French (`fr`) became the 9th UI locale**, plus the whole multilingual surface it touches. Standalone — walk top-to-bottom, fill the §16 sign-off matrix, file a FIX-PROMPT on any failure.

Pairs with:
- `qa/QA-REGRESSION-PROMPT.md` (v1.60.0 I18N-SPLIT baseline)
- `qa/QA-REGRESSION-PROMPT-fr-v1.61.0.md` (focused 9th-locale hand-off)

**This document is the maximal one — it enumerates every locale, every route, every nav item, every primary button, every translated namespace, the docs, the release, and the package.**

```
Version:   1.61.0  (package.json + footer via /api/health)
Locales:   9 — en · es · fr · pt-BR · ko · ja · ru · zh-CN · zh-TW
Dict:      678 keys (668 real + 10 @alias), French at FULL parity (0 missing)
Help:      19 H2 / 73 H3 per bundle (all 9 locales)
Tests:     1001 unit · 20 smoke e2e · 23 comprehensive e2e · Playwright incl. 9-locale sweep
Server:    http://127.0.0.1:4317  (npm start)
Browsers:  Chrome stable + 1 secondary (Firefox or Safari)
```

---

## §0 — Exact change set under test (every file)

**New files (6)**
- `public/js/lib/locales/i18n-dict.fr.js` — French dictionary (`window.__I18N_DICT_FR`).
- `docs/help/fr.md` — French help bundle (19 H2 / 73 H3).
- `README.fr.md` — French README (image → `images/dashboard-fr.png`).
- `CHANGELOG.fr.md` — French changelog (newest `## [1.61.0]`).
- `images/dashboard-fr.png` — French dashboard screenshot.
- `qa/QA-REGRESSION-PROMPT-fr-v1.61.0.md` + this file.

**Modified (registration & propagation)**
- `public/js/lib/i18n.js` — `LANGS` gains `{ code:'fr', label:'Français' }`; `detect()` maps `fr*`.
- `public/js/lib/i18n-dict.js` — assembler `LANGS` + `TABLES` gain `fr`.
- `public/index.html` — `<script src=".../i18n-dict.fr.js">` before `i18n-dict.aliases.js`.
- `tests/fixtures/i18n-dict.snapshot.json` — carries `fr` on every key.
- `tools/i18n-audit.mjs`, `tests/helpers/i18n-vm.mjs` (`I18N_LANGS`), `.github/workflows/ci.yml` inline check — locale lists include `fr`.
- `tests/{canonical-docs-coverage,help-ui,help-ru-config-section,help, …}.mjs` — locale lists include `fr`; `README_FILES` gains `README.fr.md`.
- `tests/e2e.mjs` — Flow 2d resets locale to `en` after the 9-locale rotation; Flow 5 + route-walk accept `Profil` (the regression CI caught — see §11).
- `scripts/capture-dashboard-screenshots.mjs` — `LOCALE_TO_FILE` gains `fr`.
- `scripts/check-changelog-parity.mjs` — `LOCALES` includes `fr`.
- All 9 `CHANGELOG.*.md` — `## [1.61.0]` entry + `Français` link.
- All 9 `README.*.md` — "8 → 9 languages", `Français` nav + footer link.
- All 9 `docs/help/*.md` §19 — "8 → 9 languages" + `Français` in the list.
- `docs/LOCALIZATION.md` — "8 → 9 locales", `fr` listed, "19 H2" fixed.
- `package.json` — `1.60.0 → 1.61.0`.
- Regenerated all 9 `images/dashboard-*.png`.

```bash
git show --stat v1.61.0 | tail -40   # confirm the merged surface matches the above
```

---

## §−1 — Methodology footguns (READ FIRST)

1. **`npm test` does NOT run the e2e/Playwright suites.** The French regression that broke `/#/profile` (§11) was invisible to `npm test`; only `npm run test:e2e` / the CI Playwright job caught it. Run the e2e suites explicitly.
2. **vm-realm deepEqual** — comparing an assembled-in-`node:vm` dict to the JSON snapshot needs `JSON.parse(JSON.stringify(x))` first (foreign prototype). `tests/i18n-locale-files.test.mjs` already does this.
3. **Split is text-invisible** — `i18n-dict.js` is an assembler; French strings live ONLY in `i18n-dict.fr.js`. A `grep` in the assembler returns nothing — not a bug.
4. **Grep under-counts dict keys** — count parity in Node, never with `grep -c` (multi-line values / quote variance):
   ```bash
   node --input-type=module -e '
   import {loadAssembledDict} from "./tests/helpers/i18n-vm.mjs";
   const D=loadAssembledDict(); let miss=0;
   for(const k of Object.keys(D)){const v=D[k]; if(v&&typeof v==="object"&&!("@alias"in v)&&!("fr"in v))miss++;}
   console.log("fr missing:", miss);'   # → 0
   ```
5. **Locale persists in `localStorage`.** Switching language sticks across routes and reloads. Reset to `en` (sidebar footer) between manual locale passes, or you will misread later routes.
6. **Server diagnostics stay English by policy** — `/api/*` error bodies and server logs are intentionally English. Do NOT file "untranslated" bugs against server messages; only the on-screen UI is localized.

---

## §1 — Boot & version

```bash
node --version            # >= 18
npm ci
npm test                  # 1001 / 1001, 0 fail   (DO NOT pipe through grep)
npm start                 # 127.0.0.1:4317
```
- `/api/health` → `{"version":"1.61.0","ok":true}`. Footer reads **v1.61.0**.
- `node -p "require('./package.json').version"` → `1.61.0`.

---

## §2 — French registration (the 6 wiring points)

```bash
grep -n "code: 'fr'"            public/js/lib/i18n.js          # { code:'fr', label:'Français' }
grep -n "startsWith('fr')"      public/js/lib/i18n.js          # detect() → 'fr'
grep -n "'fr'\|__I18N_DICT_FR"  public/js/lib/i18n-dict.js     # assembler LANGS + TABLES
grep -n "locales/i18n-dict"     public/index.html              # 9 locale <script>s → aliases → assembler → i18n.js
node --test tests/i18n-locale-files.test.mjs                   # snapshot ≡ assembled · key parity · load order
node tools/i18n-audit.mjs                                      # 668 keys × 9 locales · 0 hard failures
grep -n "fr" tests/helpers/i18n-vm.mjs tests/canonical-docs-coverage.test.mjs tests/help-ui.test.mjs
```
All six must be present and `index.html` order must be: **en es pt-BR ko ja ru zh-CN zh-TW fr → aliases → i18n-dict.js → i18n.js**.

---

## §3 — Per-locale render sweep (automated + manual)

```bash
node --test tests/playwright-locale-sweep.mjs   # 9 subtests; each walks all 22 routes, asserts no key leaks, zero console errors
```

**Manual (browser):** sidebar footer → switch each language. For every locale verify on **every route**: content non-empty, **no raw `key.path` leaks**, no English left in a non-English UI (except server-policy strings), no truncation/overflow, `<html lang="…">` matches.

The 22 routes to walk per locale: `#/dashboard #/scan #/pipeline #/evaluate #/deep #/project #/training #/followup #/batch #/contacto #/interview-prep #/patterns #/apply #/tracker #/reports #/cv #/profile (=#/settings) #/health #/config #/help #/activity #/auto` + an unknown route → 404.

---

## §4 — Sidebar navigation (28 nav keys + 6 groups) — French expected text

Switch to **Français**. The sidebar must read exactly:

| Key | French label | Key | French label |
|---|---|---|---|
| `nav.dashboard` | Tableau de bord | `nav.tracker` | Suivi |
| `nav.scan` | Scanner | `nav.reports` | Rapports |
| `nav.pipeline` | Pipeline | `nav.cv` | CV |
| `nav.evaluate` | Évaluer | `nav.profile` | Profil |
| `nav.deep` | Recherche approfondie | `nav.config` | Paramètres de l'application |
| `nav.project` | Projet | `nav.health` | Santé |
| `nav.training` | Formation | `nav.help` | Aide |
| `nav.followup` | Suivi | `nav.activity` | Activité |
| `nav.batch` | Lot | `nav.auto` | Pilote automatique |
| `nav.contacto` | Relations publiques | `nav.interviewPrep` | Préparation à l'entretien |
| `nav.apply` | Liste de contrôle de candidature | `nav.patterns` | Modèles |

**Nav groups (6):** Configuration (`setup`) · Sourcing · Prise de décision (`decision`) · Candidature (`application`) · Réseautage (`networking`) · Analytique (`analytics`).

> Note `nav.tracker` and `nav.followup` both read "Suivi" — that is intentional (distinct routes, same French word). Do NOT "fix" to differ.

---

## §5 — Per-page H1 titles + primary buttons (French)

Switch to Français; visit each route; the `h1.page-title` and primary buttons must read:

| Route | H1 (French) | Primary controls (French) |
|---|---|---|
| `#/dashboard` | Centre de Commande | 2 CTAs · provider chip · 4 metric cards |
| `#/scan` | Recherche d'offres d'emploi | 🌐 (Scanner) · **Arrêter** (`scan.stop`) · filtres |
| `#/pipeline` | Pipelines | **Ajouter une URL** (`pipe.add`) · ▶ · ✕ |
| `#/evaluate` | Évaluer la candidature | textarea · Save JD · run |
| `#/deep` | Recherche approfondie | **▶ Générer la commande** (`deep.run`) · ⚡ Run live |
| `#/apply` | Liste de contrôle de candidature | interactive checklist |
| `#/tracker` | Suivi des candidatures | **Normaliser** · **Supprimer les doublons** · **Fusionner TSV** |
| `#/cv` | CV | **Télécharger le CV** (`cv.upload`) · Save · Generate PDF |
| `#/health` | Santé | ▶ Docteur · ▶ Verify |
| `#/config` | Paramètres de l'application | API-keys tab · Save |
| `#/auto` | Pipeline automatique pour une URL | **Lancer le pipeline automatique** (`auto.run`) |

`common.*` buttons that appear across pages (must be French):
`Ajouter · Annuler · Fermer · Confirmer · Supprimer · Aucun résultat · Erreur · Générer un PDF · Ouvrir · Actualiser · Réessayer · Exécuter · Enregistrer · Chargement…`

---

## §6 — Top bar (French)

- `top.search` placeholder → **Rechercher une entreprise, un rôle ou une URL…**
- `top.langhint` → **{hotkey} — recherche** (hotkey = `⌘K` on macOS, else `Ctrl+K`).
- `top.quickscan` → **Ouvrir un scan**; `top.doctor` → **Docteur**.
- `top.search.aria` / `top.search.label` localized (screen-reader).
- `Ctrl/Cmd+K` focuses search; pasting a URL + Enter opens auto-pipeline.

---

## §7 — Notifications drawer 🔔 (French — `notif.*`)

Open via bell click / Enter / Space. Verify:
- `notif.title` → **Alertes**; `notif.bellAria` → **Notifications — ouvrir le journal des toasts récents**.
- `notif.empty` → **Aucune notification pour le moment.**
- `notif.clearAll` → **Tout supprimer**; `notif.dismiss` → **Ignorer**; `notif.closeAria` → **Fermer les notifications**.
- `notif.unread` → **{n} non lues** (n substituted).
- Trigger Success/Error/Info toasts; each lands in the drawer with a localized `HH:MM:SS`, the human message, and any `(METHOD /path · HTTP NNN)` tucked in `<details>`. Closes via ×, Esc, re-click.

---

## §8 — Onboarding banner, cost hints, connection banner (French)

- No-key state: `onboarding.noKey.title` → **Pas de clé LLM définie — «⚡ Exécution en direct» est en mode manuel. Définissez l'une des Anthropic / Gemini / OpenAI / Qwen.** · CTA `onboarding.noKey.cta` → **Configurer une clé →**.
- Fixture profile warning `onboarding.fixtureWarning` (French) + `onboarding.fixProfile` → **Ouvrir les paramètres du profil**.
- `cost.manual` / `cost.varies` / `cost.estimate` French.
- Kill the server → connection banner `conn.down` → **Le serveur n'est pas disponible.**; recovery `conn.recovered` → **Connexion rétablie**.

---

## §9 — In-app Help (French) — `#/help`

- TOC auto-built from H2s; must list **all 19 sections**, French titles:
  1. Quick start — pas à pas complet … 2. App settings & API keys 3. Profile 4. CV 5. Portals & sources 6. Health 7. Scan 8. Pipeline 9. Evaluate 10. Reports 11. Tracker 12. Deep research 13. Mode prompts 14. Apply checklist 15. Interview preparation 16. Activity log + Troubleshooting 17. How to add a new job-portal source 18. Notifications 19. **Localizing the app into your language**.
- §19 prose must say the UI ships in **9 langues** and list `i18n-dict.fr.js`.
- Scroll-spy: after ~1.5 s, `document.body.dataset.tocSpy === "active"`, exactly one `.help-toc a.toc-current`.

```bash
echo "fr help H2/H3: $(grep -cE '^## ' docs/help/fr.md) / $(grep -cE '^### ' docs/help/fr.md)"   # 19 / 73
diff <(grep -cE '^## ' docs/help/en.md) <(grep -cE '^## ' docs/help/fr.md)                          # equal
```

---

## §10 — Translated-text coverage by namespace (no English bleed in French)

Every namespace below must render in French on its surface — switch to `fr` and spot-check each area; **no English fallback, no raw key**. Counts are the number of keys per namespace (678 total):

```
config:108  dash:71  scan:60  batch:43  auto:41  track:32  nav:29  pipe:25
cv:23  deep:23  common:17  eval:17  followup:15  apply:15  contacto:14  rep:14
set:13  interviewPrep:11  activity:10  health:10  project:8  training:8
patterns:8  notif:8  mode:6  top:6  help:5  pg:5  onboarding:5  profile:5
router:4  cost:3  notFound:3  prompt:2  batch-prompt:2  app:2  api:2  conn:2
toast:1  a11y:1  advisor:1
```

Highest-risk (largest) areas to walk carefully in French: **config (108)** → `#/config` every label/help text; **dash (71)** → dashboard cards/labels; **scan (60)** → filters, chips, source names, phase headers; **batch (43)** → `#/batch` form; **auto (41)** → `#/auto` stepper steps; **track (32)** → tracker columns/filters.

Automated guard that no key is missing in any locale:
```bash
node --test tests/i18n-coverage.test.mjs            # every key present in all 9 locales
node tools/i18n-audit.mjs                            # parity / empty / personal-data / alias integrity
```

---

## §11 — The regression CI caught (must stay fixed) — `tests/e2e.mjs`

Root cause: French is **last** in the locale list, so Flow 2d's rotation left the **persisted** UI language as `fr`; Flow 5 then read `/#/profile` as **"Profil"** and its allow-list rejected it. Invisible to `npm test`.

Fix verification:
```bash
npm run test:e2e        # smoke 20/20 — Flow 2d resets to en after rotation; Flow 5 accepts "Profil"
npm run test:e2e:full   # comprehensive 23/23
```
- Confirm `tests/e2e.mjs` Flow 2d ends with a click on `data-lang-btn="en"` after the rotation loop.
- Confirm both Flow 5 `expected` and the route-walk `settings` `expectAny` include `'Profil'`.

---

## §12 — Docs / README / CHANGELOG / LOCALIZATION (all 9 locales)

```bash
# Every README links the French one + says 9 languages
grep -l "README.fr.md" README*.md | wc -l            # → 9
# Every help bundle §19 says 9 and lists Français
for l in en es fr pt-BR ko-KR ja ru zh-CN zh-TW; do grep -q "Français" docs/help/$l.md && echo "$l ok" || echo "$l MISSING"; done
# LOCALIZATION lists fr, says 9 locales, 19 H2
grep -nE "9 locales|i18n-dict.fr|19 H2" docs/LOCALIZATION.md
# CHANGELOG parity — all 9 at v1.61.0
node scripts/check-changelog-parity.mjs
# README.fr passes the canonical-docs contract (front page + ≥3 sub-guides + OpenCode + Qwen CLI)
node --test tests/canonical-docs-coverage.test.mjs
```
Manual: open `README.fr.md` rendered — the language nav shows **Français** bold, image is `dashboard-fr.png`, the 5 career-ops.org guide links resolve, the "Localisation" section says **9 locales**.

---

## §13 — Screenshots (all 9 regenerated)

```bash
ls -la images/dashboard-*.png      # 9 files: en es fr pt-BR ko-KR ja zh-CN zh-TW ru
file images/dashboard-fr.png       # PNG, 2880x1800 (deviceScaleFactor 2)
```
- Each localized README points at its own image (`README.fr.md → dashboard-fr.png`, etc.).
- `scripts/capture-dashboard-screenshots.mjs` `LOCALE_TO_FILE` includes `fr: 'fr'` (no `dashboard-undefined.png`).
- Regenerate end-to-end (needs Playwright + running server):
  ```bash
  npm start &  node scripts/capture-dashboard-screenshots.mjs   # → "saved images/dashboard-<loc>.png" ×9
  ```

---

## §14 — Release & package (v1.61.0)

- Tag `v1.61.0` pushed → **Release** workflow created the GitHub Release (notes sliced from `CHANGELOG.md`), marked **Latest**.
- Release published → **Publish to GitHub Packages** published `@fighter90/career-ops-ui@1.61.0`.
```bash
gh release view v1.61.0 --json tagName,isDraft,isPrerelease
gh api '/users/Fighter90/packages/npm/career-ops-ui/versions' -q '.[].name' | head   # 1.61.0 present
git ls-remote --tags origin v1.61.0
```
- Install smoke (consumer):
  ```bash
  npm install @fighter90/career-ops-ui@1.61.0 --registry=https://npm.pkg.github.com
  ```

---

## §15 — Full gate battery (CI-equivalent)

```bash
npm test                  # 1001 / 1001 unit, 0 fail
npm run test:coverage     # line >= 93%, branch >= 83%
npm run test:e2e          # 20 / 20 smoke
npm run test:e2e:full     # 23 / 23 comprehensive
npm run test:e2e:browser  # Playwright incl. 9-locale sweep
npm run test:ci           # aggregate hard gate (unit + no-also + changelog-parity + i18n-audit)
git ls-files -z '*.js' '*.mjs' | xargs -0 -n1 node --check   # syntax gate
```
⚠️ Pre-commit AI review is advisory; **`ci.yml` is the hard gate** (Node 18/20/22 + Playwright e2e + Code quality + CodeQL + dependency-review). Watch the Actions run.

---

## §16 — Sign-off matrix

| Gate | Pass? |
|---|---|
| §−1 — six footguns understood (esp. e2e ≠ npm test, locale persists) | ☐ |
| §1 — boot, `/api/health` version `1.61.0`, footer v1.61.0 | ☐ |
| §2 — all 6 registration points + load order | ☐ |
| §3 — locale-sweep (9 × 22 routes) + manual no-leak walk | ☐ |
| §4 — 28 nav labels + 6 groups read the exact French strings | ☐ |
| §5 — 11 page H1s + primary buttons + `common.*` in French | ☐ |
| §6 — top bar (search / hint / quickscan / doctor) French | ☐ |
| §7 — notifications drawer texts French; open/close behavior | ☐ |
| §8 — onboarding banner / cost / connection-banner French | ☐ |
| §9 — Help TOC 19 sections, §19 says 9 langues, scroll-spy | ☐ |
| §10 — every namespace renders French; coverage + audit clean | ☐ |
| §11 — e2e regression fixed (smoke 20/20, comprehensive 23/23) | ☐ |
| §12 — README ×9 / help ×9 / CHANGELOG ×9 / LOCALIZATION at 9 + Français | ☐ |
| §13 — 9 screenshots present; READMEs self-reference; capture map has fr | ☐ |
| §14 — release v1.61.0 Latest + package 1.61.0 published | ☐ |
| §15 — full gate battery green; CI matrix `success` | ☐ |
| Security envelope byte-stable; parent career-ops read-only | ☐ |

---

## §17 — On failure

1. Re-check §−1 (most "failures" are methodology: e2e-not-in-npm-test, vm deepEqual, locale persistence).
2. Identify the lock-test: `node --test tests/i18n-locale-files.test.mjs tests/i18n-coverage.test.mjs tests/i18n-alias.test.mjs tests/playwright-locale-sweep.mjs tests/canonical-docs-coverage.test.mjs`; e2e via `npm run test:e2e[:full]`.
3. Missing/empty French value → edit `public/js/lib/locales/i18n-dict.fr.js`, re-run §2 + §10.
4. Help/README parity drift → diff `{en,fr}` headers / counts and realign.
5. File `qa/FIX-PROMPT-fr-v1.61.<N+1>.md` (HOW + TEST + ACCEPTANCE + CHANGELOG ×9 sketch + §16 gate ID).
6. Doctrine: ONE fix per release · CHANGELOG parity ×9 non-negotiable · `ci.yml` is the hard gate · adding/altering a locale never touches `t()` or any view.

---

*Exhaustive QA hand-off for the French 9th-locale shipment (v1.61.0). Source of truth: tag `v1.61.0` (`git show --stat v1.61.0`). French dict 668/668 parity · help 19 H2 / 73 H3 · 1001 unit · smoke 20/20 · comprehensive 23/23 · package `@fighter90/career-ops-ui@1.61.0` published. Generated 2026-05-22.*
