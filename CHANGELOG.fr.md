# Journal des modifications

Tous les changements notables de **career-ops-ui**. Format selon [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versionnage [SemVer](https://semver.org/lang/fr/).

Traductions : [English](CHANGELOG.md) · [Español](CHANGELOG.es.md) · [Português](CHANGELOG.pt-BR.md) · [한국어](CHANGELOG.ko-KR.md) · [日本語](CHANGELOG.ja.md) · [Русский](CHANGELOG.ru.md) · [简体中文](CHANGELOG.zh-CN.md) · [繁體中文](CHANGELOG.zh-TW.md)

> **Note i18n** — depuis la v1.12.0, les entrées sont localisées dans chaque langue. Les entrées plus anciennes (v1.11.x, v1.10.x) résident dans le [CHANGELOG anglais](CHANGELOG.md), qui fait foi.

> **Note de traduction (v1.61.0)** — le français a été ajouté comme 9e langue de l'interface. Ce fichier traduit les entrées récentes ; pour l'historique antérieur à la v1.55.0, voir le [CHANGELOG anglais](CHANGELOG.md), qui reste la source normative.

---



## [1.64.0] — 2026-05-27

**feat(scan) : achemine la requête hh.ru via un proxy russe avec `HH_PROXY`.** hh.ru bloque son API par **IP**, pas par User-Agent — `HH_USER_AGENT` seul n'a donc jamais levé un 403 depuis un nœud de sortie non russe. Définissez `HH_PROXY` avec l'URL d'un proxy russe HTTP/HTTPS (p. ex. `http://user:pass@ru-host:port`) : **seule** la requête hh.ru passe par lui, les autres sources gardent leur connexion directe. Basé sur le `ProxyAgent` d'`undici` (nouvelle dépendance runtime) ; le dispatcher est omis quand `HH_PROXY` n'est pas défini. 3 nouveaux tests ; suite 1041/1041.

---



## [1.63.2] — 2026-05-27

**feat(scan) : progression en % en direct + détail par source dans la console `#/scan`.** La barre est désormais **déterminée** — les scanners émettent des événements de progression (EN : par entreprise ; RU : par requête) via SSE, et la barre se remplit avec un libellé **« Scanning… NN% »** (bande animée seulement jusqu'au premier événement). Le premier échec de chaque source (timeout / 403 / réseau) est journalisé en détail dans la console ; les répétitions sont supprimées. 1 nouveau test ; suite 1040/1040.

---



## [1.63.1] — 2026-05-27

**style(scan) : barre de progression de `#/scan` plus visible.** L'indicateur a désormais un libellé visible **« Scanning… »** et la barre passe à **8px** (au lieu de 4px fins), bien perceptible pendant le scan. Aucun changement de comportement.

---



## [1.63.0] — 2026-05-27

**feat(scan) : délai par requête + barre de progression sur `#/scan`.** Les requêtes des sources n'avaient pas de délai, donc une source bloquée (p. ex. `api.hh.ru` depuis une IP bloquée) pouvait **figer tout le scan**. Le nouveau `server/lib/fetch-timeout.mjs` enveloppe le `fetchImpl` des scanners (`makeTimeoutFetch`, **15s** par défaut, via `SCAN_FETCH_TIMEOUT_MS`) ; une source expirée est enregistrée comme erreur non fatale et le scan continue. `#/scan` affiche une barre de progression pendant le scan (`scan.progress` dans les 9 localisations). 7 nouveaux tests ; suite 1039/1039.

---



## [1.62.3] — 2026-05-27

**docs : installation clarifiée (career-ops-ui s'exécute dans `career-ops/web-ui/`) + dépannage de `init`, dans les 9 localisations.** Section d'installation réécrite en **Option 1** (un curl) / **Option 2** (cloner l'UI *dans* un projet career-ops existant comme `web-ui`) + verbes CLI + configuration du fournisseur + bloc **Troubleshooting `init`**. Note sur la structure imbriquée ajoutée à `/help` §1 Setup ; résumé de toute la ligne v1.62.* dans le README. Documentation uniquement ; aucun changement de code.

---



## [1.62.2] — 2026-05-27

**fix(help) : le filtre de `#/help` est désormais en texte intégral (trouve les sous-sections H3 comme RSS).** Le filtre de recherche/TOC de la page d'aide ne correspondait qu'aux titres de section H2, donc la documentation RSS de v1.62.x (un H3 sous §5 Portals & sources) était introuvable. Le corps de chaque section est maintenant indexé dans le filtre, donc rechercher p. ex. « RSS » fait apparaître §5. Côté client uniquement ; aucun changement d'API.

---



## [1.62.1] — 2026-05-27

**feat(scan) : RSS dans le filtre de sources + correction de la localisation RSS.** Le menu déroulant de filtre de sources sur `#/scan` inclut désormais **RSS** (ajouté à `server/lib/sources/registry.mjs` + la liste de repli du SPA), donc les résultats des sites RSS (LaraJobs, WeWorkRemotely, …) se filtrent comme n'importe quelle source ATS. L'adaptateur RSS ne mappe plus la balise `<category>` du flux sur `location` — ces balises faisaient rejeter à tort les postes en télétravail par `location_filter` ; `location` est désormais vide et les flux passent le filtre de localisation. Infobulles/libellés du bouton de scan et la chaîne de liste des sources mis à jour dans les 9 localisations (Workable / SmartRecruiters / Workday / RSS). Snapshot i18n et test de l'endpoint des sources (6 → 7 EN) mis à jour.

---



## [1.62.0] — 2026-05-27

**feat(scan) : adaptateur RSS générique pour les sites d'emploi hors-ATS.** Un nouvel adaptateur `rss` (`server/lib/portals/adapters/rss.mjs` + `server/lib/sources/rss.mjs`) permet au scanner de récupérer des offres depuis n'importe quel flux RSS — LaraJobs, WeWorkRemotely, RemoteOK, golangprojects et d'autres sites hors Greenhouse/Ashby/Lever. Aucune nouvelle dépendance : l'analyse du flux est basée sur des regex avec prise en charge des CDATA et des entités HTML (titres/entreprises nettoyés des balises, points de code astraux décodés en toute sécurité). Activé par entreprise via `provider: rss` / `rss:` / `feed_url:` dans `portals.yml`, sans intercepter les entreprises déjà associées à un ATS. `ALL_ADAPTERS` passe de 6 à 7. 29 nouveaux tests ; documenté dans les 9 localisations du README.

---



## [1.61.1] — 2026-05-22

**fix(i18n) : localise le title + aria-label du bouton de bascule de thème dans les 9 langues (MINOR-001).** Le bouton de thème clair/sombre (`#theme-toggle`) codait en dur `title="Toggle theme"` et `aria-label="Toggle theme"` dans `index.html` — l'info-bulle et le texte pour lecteurs d'écran n'étaient jamais traduits, quelle que soit la langue. Une nouvelle clé `top.themeToggle` + un gestionnaire `data-i18n-title` dans `applyI18n()` (sur le modèle du correctif aria-label de la recherche en v1.58.15) localisent les deux attributs au démarrage et à chaque changement de langue. Verrouillé par `tests/playwright-theme-toggle-i18n.mjs` (9 langues + bascule à l'exécution) et deux gardes statiques. Seule constatation LOW de la validation v1.61.0. (MINOR-001)

---



## [1.61.0] — 2026-05-22

**feat(i18n) : ajout du français comme 9e langue de l'interface.** Nouveau dictionnaire par locale `public/js/lib/locales/i18n-dict.fr.js` (`window.__I18N_DICT_FR`), à parité complète de **668 clés** avec l'anglais ; nouveau bundle d'aide `docs/help/fr.md` (**19 H2 / 73 H3**, parité structurelle exacte avec `en`). `fr` est enregistré dans le sélecteur de langue et l'auto-détection du navigateur (`i18n.js`), dans l'assembleur (`i18n-dict.js`), dans `index.html` (balise `<script>` avant l'assembleur), dans le snapshot de test et dans toutes les listes de locales des tests. La table de traduction initiale provient de la **PR #9** (contribution communautaire). Aucun changement de logique : `t()` et toutes les vues sont inchangés. Tests : **1001 / 1001** unitaires, balayage Playwright des locales étendu à 9 sous-tests. (FR-LOCALE)

---



## [1.60.0] — 2026-05-22

**refactor(i18n) : découpage du méga-fichier à 8 colonnes en fichiers par langue (I18N-SPLIT).** Le dictionnaire de traductions vivait dans un unique `public/js/lib/i18n-dict.js` ; il y a désormais **un fichier par langue** sous `public/js/lib/locales/` plus `i18n-dict.aliases.js`, pour qu'un traducteur édite une seule langue de façon isolée. `i18n-dict.js` est maintenant un **assembleur** qui reconstruit exactement le même `window.__I18N_DICT`, donc `t()` et toutes les vues sont inchangés. Chargé de façon synchrone via `<script src>` — sans étape de build ni fetch. Un snapshot prouve que la migration ne perd rien (678 clés). Outils et ~25 tests adaptés ; nouveaux `tests/i18n-locale-files.test.mjs` et `tests/playwright-locale-sweep.mjs` (chaque page × 8 langues sur Chromium réel). 994 → **1000** unitaires · 62 → **70** Playwright. Aucun changement de comportement. (I18N-SPLIT)

---



## [1.59.13] — 2026-05-21

**fix(i18n) : fusion des vraies clés dupliquées via @alias + purge finale des données personnelles.** Le vrai nom du mainteneur retiré des fixtures de test et des rapports QA (→ `Jane Doe`) ; `LICENSE`/`package.json` → handle `Fighter90`. Le mécanisme `@alias` fusionne les 10 clés identiques sur les 8 locales ; `nav.config`/`config.title` ne sont PAS fusionnées (elles divergent en espagnol). 991 → **994** tests. (I18N-CL3)

---



## [1.59.12] — 2026-05-21

**fix(i18n) : nettoyage de i18n-dict.js — pré-fr (I18N-CL1, I18N-CL2, I18N-CL4).** Donnée personnelle retirée dans `training.coursePh` (→ placeholder générique), `followup.lastPh` restauré comme indication de format (pas de date fixe), ajout de `npm run audit:i18n`. Les groupes de valeurs dupliquées sont intentionnels (rôles d'UI distincts) — voir l'en-tête du dictionnaire. (I18N-CL1, I18N-CL2, I18N-CL4)

---



## [1.59.11] — 2026-05-21

**fix(test) : v1.59.11 — la suite e2e-comprehensive passe désormais 23/23 (était 11/23).** Cause racine : `page.goto(baseUrl + '/#/X')` est un no-op pour les changements de hash seuls sous Playwright. Le nouveau helper `goRoute(hash)` rebondit par `about:blank` avant chaque `goto` et force une vraie navigation. (e2e-harness-r1)

---



## [1.59.10] — 2026-05-21

**fix(api) : NEW-F1-sub-r1 (v1.59.10) — le middleware de `..` brut remonté au-dessus de toutes les routes `/api`.** Celui de la v1.59.8 était après `app.all` et ne se déclenchait jamais. Il s'exécute désormais avant la normalisation d'Express. (NEW-F1-sub-r1)

---



## [1.59.9] — 2026-05-21

**fix(ux) : UX-A5-r4 (v1.59.9) — marqueur de debug `data-toc-spy="active"` + lock-test comportemental du scroll-spy du TOC de l'aide.** Sixième cycle : les 5 verrous précédents passaient les tests statiques mais le bug persistait. La v1.59.9 ajoute le marqueur, un premier paint synchrone, un recalcul en double rAF, un listener de resize, et un nettoyage complet sur hashchange. (UX-A5-r4)

---



## [1.57.0] — 2026-05-19

**feat(providers) : OpenAI et Qwen ajoutés comme fournisseurs d'évaluation live headless.** La chaîne de repli live (Anthropic → Gemini → manuel) accueille deux fournisseurs supplémentaires côté serveur, exposés via le sélecteur de modèles et la bannière d'onboarding à 4 fournisseurs. Mise à jour de la documentation sur les 8 locales. (PROV-R1)

---



## [1.55.0] — 2026-05-18

**feat(providers) : nouveau `GET /api/status/providers` + bannière d'onboarding OpenRouter à 4 fournisseurs.** L'endpoint renvoie la liste des fournisseurs dont la clé est configurée (un tableau de noms, jamais un nombre) ; la bannière de l'écran d'accueil guide la mise en place de la première clé. (PROV-STATUS)

---



## Versions antérieures (v1.54.x et avant)

Les entrées détaillées pour la v1.54.x et toutes les versions antérieures vivent dans le [CHANGELOG anglais](CHANGELOG.md), qui fait foi. Points de repère :

- **v1.43.0** · Verbe `open` + script multi-plateforme pour faire passer le navigateur au premier plan.
- **v1.42.0** · Correction de la route morte `#/portals` → lien profond vers la config.
- **v1.40.0** · Balayage d'actualisation de la documentation sur les 8 locales.
- **v1.31.0** · Champs **Model** et **Start from #** exposés sur `#/batch` (flags `--model` / `--start-from` du batch runner).
- **v1.29.2** · Le bouton 🌐 Scan unique pilote les phases ATS + régionale dans un seul flux SSE.
- **v1.15.0** · Réalignement des blocs de rapport sur le schéma canonique career-ops.org (A–F).
- **v1.12.0** · Début de la localisation des entrées de changelog par langue.
- **v1.10.0** · Éditeur `#/profile` + UX d'import de CV, parité d'aide multi-locale, sélecteur de locale.

Pour l'historique complet, voir [CHANGELOG.md](CHANGELOG.md).
