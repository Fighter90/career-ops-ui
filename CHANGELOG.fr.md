# Journal des modifications

Tous les changements notables de **career-ops-ui**. Format selon [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versionnage [SemVer](https://semver.org/lang/fr/).

Traductions : [English](CHANGELOG.md) · [Español](CHANGELOG.es.md) · [Português](CHANGELOG.pt-BR.md) · [한국어](CHANGELOG.ko-KR.md) · [日本語](CHANGELOG.ja.md) · [Русский](CHANGELOG.ru.md) · [简体中文](CHANGELOG.zh-CN.md) · [繁體中文](CHANGELOG.zh-TW.md) · [Polski](CHANGELOG.pl.md) · [Українська](CHANGELOG.uk.md) · [العربية](CHANGELOG.ar.md)

> **Note i18n** — depuis la v1.12.0, les entrées sont localisées dans chaque langue. Les entrées plus anciennes (v1.11.x, v1.10.x) résident dans le [CHANGELOG anglais](CHANGELOG.md), qui fait foi.

> **Note de traduction (v1.61.0)** — le français a été ajouté comme 9e langue de l'interface. Ce fichier traduit les entrées récentes ; pour l'historique antérieur à la v1.55.0, voir le [CHANGELOG anglais](CHANGELOG.md), qui reste la source normative.

---


## [1.73.0] — 2026-06-17

**feat(llm): connecteur Gemini générique + contexte CV/profil vérifié pour tous les fournisseurs.** Ajout de `server/lib/gemini.mjs` (`runGemini`) — un client Gemini `generateContent` sans dépendance externe renvoyant la même forme `{markdown, usage, error}` que les clients compatibles Anthropic / OpenAI. Correction : `/api/mode/:slug` et `/api/deep` acheminaient auparavant leurs prompts via `gemini-eval.mjs`, conçu uniquement pour l'évaluation d'offres, ce qui faisait que Gemini **Run live** renvoyait une évaluation au lieu de l'artefact demandé (lettre de motivation, prise de contact, note de synthèse). Ils appellent désormais `runGemini` avec `bundleProjectContext`, de sorte que `cv.md` + `config/profile.yml` sont intégrés en ligne pour Gemini exactement comme pour tous les autres fournisseurs — les lettres et notes sont détaillées et personnalisées. Le nouveau `tests/llm-provider-context.test.mjs` simule la frontière HTTP de chaque fournisseur et vérifie que les cinq (Anthropic / Gemini / OpenAI / Qwen / OpenRouter) intègrent `cv.md` + `profile.yml` en ligne et renvoient l'artefact (matrice mode + deep + evaluate, 9 cas). `/api/evaluate` conserve son `gemini-eval.mjs` optimisé pour les offres. Suite 1116 → 1125.

---



## [1.72.0] — 2026-06-17

**feat(modes): **Run live** retourne désormais l'artefact final directement (contrat de sortie en un seul appel).** Les templates parents `modes/<slug>.md` sont conçus pour les sessions interactives de Claude Code — plusieurs (cover, contacto, …) font une pause pour poser des questions de clarification avant de produire le résultat, ce qui amenait le **Run live** de l'interface web à émettre un questionnaire plutôt que l'artefact. `buildModePrompt` enveloppe désormais chaque mode dans un contrat de sortie non interactif : il effectue l'analyse (décomposition de l'offre d'emploi, notes sur l'entreprise, mots-clés ATS, écarts profil↔offre, choix de ton/angle) en silence, sélectionne des valeurs par défaut sensées depuis `cv.md` / `config/profile.yml` pour tout ce que le template demanderait normalement, et ne génère que l'artefact final — clôturé par un rappel par mode «output ONLY {the cover letter / outreach message / …}». Ainsi, cliquer sur **Run live** dans `#/cover` retourne désormais la lettre de motivation elle-même ; le même correctif s'applique à tous les modes génériques (cover, contacto, interview-prep, project, training, followup, patterns) dans les 12 locales (l'artefact est rédigé dans la langue de l'interface via la directive de locale). Suite 1103 → 1116.

---



## [1.71.2] — 2026-06-17

**docs(i18n):** publie le passage de cohérence de la documentation. Le bloc "Translations of this guide" de chaque README liste désormais les 11 langues sœurs (certaines omettaient auparavant English/Français ou comportaient un lien vers elles-mêmes), avec la ligne vide avant le séparateur de section restaurée. Le prompt complet de régression QA est renommé pour la version actuelle, et la documentation (`CLAUDE.md`, `CONVENTIONS`, `LOCALIZATION`, `PROJECT-CONTEXT`) est synchronisée avec la version actuelle et le nombre de tests (1103). Aucun changement de code ou de comportement — documentation uniquement, de sorte que les traductions d'aide/UI et toutes les fonctionnalités de 1.70.0–1.71.1 restent inchangées.

---



## [1.71.1] — 2026-06-17

**fix(i18n): le guide d'aide intégré est désormais entièrement traduit dans les 12 langues.** Ajout de `docs/help/{pl,uk,ar}.md` (contenant chacun la structure validée de 19 H2 / 75 H3) afin que `#/help` serve un bundle natif en polonais, ukrainien et arabe au lieu de basculer vers l'anglais — `GET /api/help/{pl,uk,ar}` retournent maintenant leur propre locale. Câblé dans toutes les vérifications d'aide (`help-ui`, `help.test`, `help-ru-config-section`, `canonical-docs-coverage`). Toutes les listes de traduction en 12 langues ont également été complétées : le bloc «Translations of this guide» du README (9 READMEs), les en-têtes «Translations:» des CHANGELOG localisés (8 fichiers), et les compteurs de documentation obsolètes ont été mis à jour. Suite 1100 → 1103.

---



## [1.71.0] — 2026-06-16

**feat(cover): générez un PDF de lettre de motivation directement depuis `#/cover`.** Le mode cover (ajouté dans la v1.70.0) produit le texte de la lettre ; le résultat propose désormais un bouton **Generate PDF** qui le restitue via le pipeline partagé markdown→PDF en ligne (`POST /api/stream/pdf/inline` → `generate-pdf.mjs`), le même chemin qu'utilise interview-prep. Vous pouvez maintenant rédiger la lettre et produire un PDF sans quitter le SPA.

**test/docs: renforcement de la revue v1.70.0.** Ajout d'une couverture CI-isolée pour le mode cover (liste d'autorisation + assemblage du prompt), le sélecteur `<select>` de drapeaux + RTL arabe (`dirFor`/`<html dir>`), `top.langLabel` dans chaque locale, le câblage du PDF de lettre de motivation, et la directive de locale de `prompts.mjs` + le scaffolding pour fr/pl/uk/ar. Mise à jour des références obsolètes « tous les 8 » → 12 locales dans `docs/sdd/CONVENTIONS.md` et dans le prompt de régression QA du projet complet.

---



## [1.70.0] — 2026-06-16

**feat(i18n): trois nouvelles langues d'interface — le polonais (pl), l'ukrainien (uk) et l'arabe (ar, avec prise en charge complète du RTL) — portant la SPA à 12 locales, correspondant à toutes les langues du README du projet parent career-ops.** Chaque nouvelle locale est livrée avec un dictionnaire complet de 697 clés (`public/js/lib/locales/i18n-dict.{pl,uk,ar}.js`), validé par les suites existantes de parité / couverture / absence de fuite latine / absence de données personnelles. L'arabe ajoute un véritable support de droite à gauche : `i18n.js` définit `<html dir="rtl">` pour les locales RTL et un bloc `[dir="rtl"]` dans `app.css` reflète le chrome (barre latérale, tiroir de notifications, tableaux et citations markdown, espacement inline) — les locales LTR restent identiques octet pour octet. Nouvelle clé `top.langLabel` (×12) nommant le sélecteur pour les lecteurs d'écran.

**feat(ui): le sélecteur de langue `<select>` avec icônes de drapeaux remplace la rangée de boutons qui débordait.** Avec 12 locales, l'ancienne rangée `.lang-btn` s'étendait sur trois lignes dans la barre latérale ; un `<select>` natif (chaque option préfixée d'un émoji de drapeau) s'adapte proprement, est compatible clavier et lecteur d'écran nativement, et reste sûr vis-à-vis du CSP (gestionnaire de changement via `addEventListener`, sans JS inline). Les drapeaux se dégradent en lettres de région lorsque la plateforme ne dispose pas des glyphes correspondants, de sorte que le libellé de langue est toujours l'identifiant clé.

**feat(cover): portage du mode lettre de motivation du projet parent (career-ops v1.10.0 + formule de salutation v1.11.0) dans la SPA.** Nouvelle page `#/cover` dans le groupe de navigation Candidature, construite sur l'exécuteur de modes générique : description du poste + entreprise/rôle + une formule de salutation optionnelle → une lettre personnalisée générée depuis `cv.md` / `modes/_profile.md`. Ajout de `cover` dans la `MODE_ALLOWLIST` du serveur et d'un bloc i18n `cover.*` (×12 locales).

**chore(compat): suivi du projet parent career-ops v1.11.0.** Vérification que le contrat de lecture/écriture est intact — `data/applications.md` reste la source de vérité en markdown (l'index de suivi SQLite de v1.11.0 est un cache dérivé), les colonnes du tableau de suivi sont toujours mappées par en-tête. `parentVersion` indique désormais 1.11.0.

**fix(i18n): fermeture d'un écart latent où le français (ajouté en v1.61.0) était absent de `LOCALE_NAMES` et `SCAFFOLD_STRINGS` dans `server/lib/prompts.mjs`** — les appels LLM en français retombaient silencieusement sur une sortie en anglais et un échafaudage en anglais. fr/pl/uk/ar sont maintenant tous connectés au chemin de locale des prompts.

> Suites connues : le guide d'aide intégré (`docs/help/`) repasse en anglais pour pl/uk/ar (le chrome de l'interface lui-même est entièrement localisé) ; l'onboarding interactif pour les entretiens, la découverte ATS inversée et les nouveaux fournisseurs de scan du projet parent ne sont pas encore exposés dans la SPA.

---




## [1.69.2] — 2026-06-12

**fix(test) : corrige une fuite d'isolation des tests qui laissait `npm test` écraser vos `config/profile.yml` et `data/scan-history.tsv` réels.** `tests/critical-fixes.test.mjs` importait `prompts.mjs` (→ `paths.mjs`) en haut du fichier, donc `PROJECT_ROOT` se résolvait vers le dossier parent réel avant que `before()` ne fixe `CAREER_OPS_ROOT` sur un dossier temporaire — et `PUT /api/profile` injectait la fixture « Acceptance Test » dans votre profil réel à chaque exécution. Correctif : charger `prompts.mjs` via `import()` dynamique dans `before()`. Nouveau `tests/test-root-isolation.test.mjs` (2 cas) protège toute la suite contre ce schéma. Aucun changement de code de production. Suite 1084 → 1086.

---



## [1.69.1] — 2026-06-12

**fix(scan) : `#/scan` ne tronque plus silencieusement les grands balayages régionaux.** L'ensemble affiché par région était plafonné à 500 (un scan RU réel de 1352 offres correspondantes n'en montrait que 500 ; 852 masquées — le symptôme « 2000 scannées, ~600 affichées »). Les deux scanners utilisent désormais une constante partagée et surchargeable par variable d'environnement `MAX_STORED_RESULTS` (par défaut 2000, surchargée via `SCAN_MAX_RESULTS`). Affichage uniquement : les ajouts à `pipeline.md` / `scan-history.tsv` utilisaient déjà l'ensemble non tronqué. **fix(health/ui) : les cartes de vérification de `#/health` ne débordent plus.** Un nom/valeur long entrait en collision avec le bouton **Fix →** et le badge de statut ; la ligne se rétrécit et passe à la ligne via `.health-check-row`. Nouveaux tests `scan-result-cap` + `health-card-overflow`. Suite 1079 → 1084.

---



## [1.69.0] — 2026-06-12

**feat(scan) : auto-découverte des adaptateurs du scanner (P-14) — il suffit de déposer un `.mjs` dans `server/lib/sources/` pour enregistrer une nouvelle source.** Avant la v1.69, la liste des sources dans `server/lib/sources/registry.mjs` était un tableau statique maintenu à la main — ajouter un adaptateur exigeait de modifier à la fois `<id>.mjs` ET `registry.mjs`. Ferme la partie restante de l'item P-14 de la feuille de route (`docs/ROADMAP.md`). Désormais, chaque `*.mjs` du dossier `server/lib/sources/` est chargé dynamiquement au boot du module ; chaque adaptateur déclare son identité via un bloc auto-descriptif `export const meta = { value, label, region, configKey? }`. Les 12 adaptateurs livrés (ashby / greenhouse / lever / rss / smartrecruiters / workable / workday + geekjob / getmatch / habr / hh / trudvsem) ont chacun reçu un export `meta` ; `registry.mjs` utilise désormais `readdirSync` + `import()` dynamique résolu via top-level await (standard ESM Node 18+). L'API publique (`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`) est inchangée — tous les imports existants continuent de fonctionner. La validation rejette les `meta` malformés (`value`/`label`/`region` manquants, RU sans `configKey`, region hors `'en'|'ru'`) et logge un seul `console.warn` par fichier fautif, pour rester diagnostiquable sur des branches partiellement migrées. Le `registry.mjs` lui-même est exclu de l'auto-discovery. Nouveau fichier `tests/sources-registry-discovery.test.mjs` : 14 cas couvrant la couverture des adaptateurs livrés, l'ajout d'un adaptateur drop-in, le skip des modules helper, le rejet des `meta` malformés, l'exclusion de l'auto-import, la tolérance aux dossiers manquants, et l'ordre déterministe. Suite 1065 → 1079.

---



## [1.68.2] — 2026-06-07

**fix(bin) : les verbes de la CLI via `npx` / `npm link` étaient cassés — le chemin du bin est désormais résolu à travers les liens symboliques.** npm et npx exposent `career-ops-ui` comme un lien symbolique sous `node_modules/.bin/`, où l'ancien `dirname "${BASH_SOURCE[0]}"` pointait vers `.bin` au lieu de la racine du paquet — si bien que `npx career-ops-ui init` exécutait `node node_modules/scripts/init.mjs` et échouait avec `MODULE_NOT_FOUND` (les exécutions locales après `npm install` n'étaient pas affectées, ce qui masquait le bug). Désormais `bin/career-ops-ui.sh` et `bin/start.sh` canonisent `SCRIPT_DIR` à travers la chaîne de liens (boucle `readlink` + `cd -P`), de sorte que chaque verbe fonctionne depuis le dépôt, via `npm link` et via `npx`. Ajoute un verrou de régression dans `tests/sh-files.test.mjs` qui exécute un verbe à travers un lien symbolique de style `.bin`. Suite 1065/1065.

---



## [1.68.1] — 2026-05-29

**fix(scan) : timeout de fetch par source 10s → 60s.** Le fail-fast de 10s (v1.67.1) coupait aussi des tableaux Ashby lents mais vivants qui avaient juste besoin de plus de temps. Relève la valeur par défaut à une minute pour qu'ils répondent. Compromis : une source vraiment morte/bloquée occupe désormais un créneau de concurrence pendant les 60s complètes (scan pire-cas plus lent), et les bloqueurs chroniques (Perplexity, Supabase, Resend, …) expirent probablement encore — un correctif par source / concurrence Ashby réduite les réglerait proprement. Override via `SCAN_FETCH_TIMEOUT_MS`. Suite 1063/1063.

---



## [1.68.0] — 2026-05-29

**feat(scan) : panneau de filtres de résultats repensé — champs étiquetés, bouton Appliquer, option Sur site et un filtre salaire qui fonctionne.** Chaque filtre de `#/scan` est désormais un champ étiqueté (libellé **au-dessus** du contrôle, pas un placeholder) : Recherche · Type · Salaire de · Salaire à · Source · Portée. Un bouton **Appliquer** explicite (plus **Réinitialiser**, et Entrée dans n'importe quel champ) relance le filtre ; une aide sur la page explique son fonctionnement. **La fourchette salariale filtre vraiment maintenant** — dès qu'une valeur *de*/*à* est définie, les offres dont la rémunération est hors fourchette **et les offres sans salaire indiqué** sont retirées (chevauchement de fourchettes ; devise ignorée). Le filtre Type gagne une option **Sur site** à côté de Distanciel / Hybride / Relocalisation. Nouvelles clés i18n ×9 ; `salaryInRange` rendu strict ; suite 1063/1063.

---



## [1.67.1] — 2026-05-29

**fix(scan) : timeout de fetch par source 30s → 10s (fail-fast).** La hausse à 30s de v1.67.0 n'a récupéré qu'~la moitié des tableaux Ashby lents ; les autres (Perplexity, Supabase, Resend, DeepL, Ramp, …) se bloquent quel que soit le délai, donc un timeout plus long ne faisait que ralentir chaque scan en attendant des créneaux morts. 10s échoue vite sur les bloqueurs chroniques et garde les scans réactifs. Override via `SCAN_FETCH_TIMEOUT_MS`. Suite 1060/1060.

---



## [1.67.0] — 2026-05-29

**feat(scan) : filtre de fourchette salariale (de / à) sur `#/scan`, et un timeout de fetch par source allongé.** Le tableau de résultats gagne deux champs numériques — salaire **de** / **à** — à côté des filtres texte et remote. Le salaire en texte libre de chaque ligne (`от 100 000 до 200 000 ₽`, `120000-150000 USD`, `$120K–$150K`, …) est analysé en une fourchette numérique et comparé avec une sémantique de chevauchement ; les lignes sans salaire publié sont conservées, donc le filtre affine la liste au lieu de la vider (comparaison indépendante de la devise — sans conversion de change). Relève aussi **le timeout de fetch par source de 15s → 30s** (override : `SCAN_FETCH_TIMEOUT_MS`) : les payloads `includeCompensation` d'Ashby dépassaient régulièrement 15s sous une concurrence ×8, donc ~30 tableaux Ashby expiraient à chaque scan. Nouveaux `window.Skills.parseSalaryRange`/`salaryInRange` + i18n ×9 ; 13 nouveaux tests ; suite 1060/1060.

---



## [1.66.0] — 2026-05-28

**feat(scan) : les sources RU parcourent désormais TOUTES les pages, pas seulement la première.** hh.ru, Habr Career et Trudvsem ne paginaient que les ~50 premiers résultats par requête ; ils suivent maintenant la pagination jusqu'au bout — `&page=N` pour hh.ru/Habr, `offset`/`meta.total` pour Trudvsem — en dédupliquant entre les pages et en s'arrêtant quand une page n'apporte rien de neuf (ou à un plafond de sécurité de 50 pages). Une requête comme « Backend разработчик » renvoie désormais l'ensemble complet (p. ex. hh.ru PHP 17 → 55+ sur 3 pages ; Trudvsem renvoie les 72). Chaque page conserve le timeout + AbortSignal existants. 4 nouveaux tests ; suite 1045/1045.

---



## [1.65.0] — 2026-05-28

**feat(scan) : hh.ru est désormais scrapé depuis son site public au lieu de l'API JSON — fonctionne depuis n'importe quelle IP, sans proxy.** `api.hh.ru` s'est mis à renvoyer un `403 forbidden` à tout client programmatique quels que soient l'IP ou le User-Agent (blocage anti-bot en périphérie). Le site (`hh.ru/search/vacancy`) sert quant à lui des résultats complets à tout client de type navigateur, donc l'adaptateur parse désormais ce HTML (comme Habr Career). **Supprime la variable `HH_PROXY` de 1.64.0 et la dépendance `undici`** — ni proxy, ni clé, ni User-Agent. Tests réécrits pour le parseur HTML ; suite 1041/1041.

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
