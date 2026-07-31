# Journal des modifications

Tous les changements notables de **career-ops-ui**. Format selon [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versionnage [SemVer](https://semver.org/lang/fr/).

Traductions : [🇬🇧 English](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md) · [🇪🇸 Español](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.es.md) · [🇧🇷 Português](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.pt-BR.md) · [🇰🇷 한국어](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ko-KR.md) · [🇯🇵 日本語](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ja.md) · [🇷🇺 Русский](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ru.md) · [🇨🇳 简体中文](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.zh-CN.md) · [🇹🇼 繁體中文](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.zh-TW.md) · [🇵🇱 Polski](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.pl.md) · [🇺🇦 Українська](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.uk.md) · [🇩🇰 Dansk](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.da.md) · [🇸🇦 العربية](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ar.md) · [🇩🇪 Deutsch](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.de.md) · [🇮🇹 Italiano](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.it.md) · [🇹🇷 Türkçe](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.tr.md) · [🇮🇳 हिन्दी](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.hi.md)

> **Note i18n** — depuis la v1.12.0, les entrées sont localisées dans chaque langue. Les entrées plus anciennes (v1.11.x, v1.10.x) résident dans le [🇬🇧 CHANGELOG anglais](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md), qui fait foi.

> **Note de traduction (v1.61.0)** — le français a été ajouté comme 9e langue de l'interface. Ce fichier traduit les entrées récentes ; pour l'historique antérieur à la v1.55.0, voir le [🇬🇧 CHANGELOG anglais](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md), qui reste la source normative.

---


## [1.130.0] — 2026-07-31

### Ajouté
- **Deux nouvelles sources de scan portées depuis career-ops v1.24.0 (parent)** (en-process, sans nouvelle dépendance ; les deux apparaissent dans le filtre Source de `#/scan` et sur la landing cvstart.org) :
  - **a16z Speedrun** (`a16z-speedrun-talent`, #2231) — le flux JSON global du board *talent-network* d'a16z Speedrun. Épinglé à l'hôte `speedrun-talent-network.com`, HTTPS uniquement, pagination indexée à 0 avec plafond de pages, `q`/config par entreprise, fail-soft.
  - **Cryptocurrency Jobs** (`cryptocurrencyjobs`) — le board d'emploi Web3 `cryptocurrencyjobs.co`, ingéré via son flux RSS 2.0 public (zéro authentification). Décodage des entités XML en deux passes, offres remote uniquement, employeur extrait de la fin du titre `"… at <Entreprise>"`.
  - Le registre totalise désormais **72 sources = 67 anglaises + 5 russes** (`ALL_ADAPTERS` = 67 adaptateurs de portails anglais).

### Corrigé
- **`echojobs` — les postes hybrides restent distincts du remote** (reflète le correctif parent #2258). Un marqueur `hybrid` insensible à la casse produit désormais `"<Ville> · Hybrid"` (ou un simple `Hybrid` en l'absence de ville) et `workplaceType: 'Hybrid'`, au lieu d'être fondu dans `Remote`.
- **`radancy` — balisage TalentBrew hérité + transport par fragment JSON de résultats** (reflète le commit parent a3e6df9), conditionné par un `opts.fetchJson` injectable.

### Notes
- **Non porté — fonctionnalités du parent réservées au CLI.** La large surface CLI/modes de career-ops v1.24.0 reste hors de web-ui, qui est une visionneuse + écriture directe légère, pas un hôte de modes : les tableaux de conformité/juridiction, le carnet de contacts + vCard, le débrief de transcription d'entretien / détection de plateforme d'appel, le `set-status` du ledger, l'enregistrement des issues, le triage en deux passes, la similarité de JD, le schéma versionné des artefacts CV de candidature, la détection Playwright-MCP du doctor, et `portals/fix-slugs.mjs`. Les changements d'orchestration de scan qui vivent dans le `scan.mjs` du parent — le scanner Playwright Interamt.de, le balayage complet iCIMS reverse-ATS, le filtre remote par éligibilité pays, le cadencement des résolutions DNS, la déduplication `rltr` de StepStone, et la colonne d'entreprise normalisée de l'historique de scan — ne s'appliquent pas : web-ui exécute les scanners EN/RU en-process et n'invoque jamais `scan.mjs`.
- **Déjà couvert.** Le correctif de repli des accents de `role-matcher` (#2209) a été porté en v1.127.0 ; c'est donc un no-op ici.

## [1.129.1] — 2026-07-29

### Corrigé
- **Suites de la revue IA sur les ports web de v1.128/v1.129** (toutes consultatives, corrigées à la source) : précédence de niveau dans `job-facets.js` (un modificateur explicite l'emporte désormais sur un mot de management — `Senior Engineering Manager` → `senior`, avant `lead`) ; le fallback de `states.mjs` n'est plus figé (une lecture réussie est mémoïsée, le fallback est renvoyé sans cache — un parent momentanément indisponible au démarrage est relu ensuite) + `console.warn` sur un fichier présent mais malformé ; `score-tone.js` — une ligne sans score est neutre (`muted`), pas rouge ; `domainFromName()` ignore les slugs non-ASCII avant `/api/logo` ; +une garde d'isolation dans `tests/states.test.mjs`. +4 tests → **2073**.

## [1.129.0] — 2026-07-29

### Ajouté
- **Facette Niveau + colonne Ancienneté sur `#/scan`** — la lib `job-facets.js` livrée en v1.128.0 est désormais reliée à l'UI de scan (auparavant purement logique). Un nouveau menu **Niveau** classe le titre de chaque offre en lead/staff/senior/confirmé/junior/stagiaire (`JobFacets.seniorityFromTitle`) et se remplit à partir de ce qui figure dans les résultats (comme la facette Pays) ; les titres sans mot de niveau passent toujours. Conservé dans les recherches enregistrées, Réinitialiser et Appliquer. Le tableau gagne une colonne **Niveau** (badge) et une colonne **Ancienneté** sans token (`auj.` / `Nj`, de `JobFacets.daysSince`). 12 clés i18n ×17, +3 tests → **2069**.

## [1.128.0] — 2026-07-29

### Ajouté
- **Quatre solutions portées depuis la propre web app du parent (`../web/`, Next.js)**, réécrites en JS vanilla/ESM, sans nouvelle dépendance : (1) `server/lib/states.mjs` lit `templates/states.yml` en direct comme vocabulaire canonique des statuts du tracker (fallback CI) — supprime la resync manuelle de la whitelist à chaque release ; POST replie les alias (espagnol/legacy) sur le libellé canonique, le funnel du GET regroupe par statut canonique ; (2) logos d'entreprise sur les lignes hébergées par un ATS via `domainFromName()` (~90 marques→domaine) ; (3) `score-tone.js` — teinte de score à 4 niveaux (≥4.2/3.8/3.0 + repli lettre) ; (4) `job-facets.js` — facettes seniority/source/days. +21 tests.

### Notes
- Non porté (concept seul) : la couche d'actions agentiques du parent (`actions/registry.ts` + `api/assistant/route.ts`) — plan pour quand `docs-fab` deviendra un copilote. Aucune nouvelle source (registre **70**), aucun changement i18n/help.

## [1.127.0] — 2026-07-29

### Ajouté
- **Trois nouvelles sources de scan (parité career-ops v1.23.0)** — le registre compte désormais **70 adaptateurs (65 EN + 5 RU)** : **Flowxtra** (agrégateur global sans auth), **VDAB** (API par mot-clé du service public flamand de l'emploi) et **iCIMS** (portails `careers-<tenant>.icims.com`, distinct de `jibeapply`). De plus **Cursor** revient au roster des CLIs (parent #2115) : `cli-detect` détecte désormais `cursor` (**10 outils**), roster restauré dans help/README/config ×17.

### Corrigé
- **agenticjobs** passe du scraping HTML à l'API REST (#2167) ; **Greenhouse** récupère la ville depuis `/offices` quand `location.name` n'est qu'un modèle de travail (#2104) ; parité **role-matcher** (#1933/#2164/#2009 : préfixe MTS, base `product`, repli des accents, désaccord sous-baseline).

### Notes
- **Non porté.** L'essentiel de v1.23.0 est une surface CLI/dashboard que web-ui n'utilise pas (batch-tailor, discover-ats, modes NL/PT, thèmes PDF, dashboard Go, updater/doctor) ; les scripts relayés ne changent pas. VERSION du parent → **1.23.0**.

## [1.126.1] — 2026-07-25

### Corrigé
- **Deux points de dérive du roster CLI que le resync de v1.126.0 a manqués** — (1) l'intro de l'onglet **API keys** de `#/config` (`config.providerModelNote`, i18n ×17) ne listait que 7 CLIs — **Antigravity** et **Grok Build** sont désormais insérés après OpenCode ; (2) une seconde ligne de tableau comparatif dans le guide d'aide (×17) et le help du site (construit en CI) affichaient encore `Inside Claude Code / Codex / Cursor / Gemini CLI` — l'ensemble obsolète avec **Cursor** — désormais le roster complet. Les deux utilisaient des séparateurs slash/point médian que les motifs du balayage v1.126.0 ne couvraient pas. Snapshot i18n régénéré ; la suite reste à **1969**.

## [1.126.0] — 2026-07-25

### Ajouté
- **L'onglet outils AI CLI détecte désormais les 8 CLIs de premier rang de career-ops** — le roster de `#/config` est synchronisé avec le `docs/SUPPORTED_CLIS.md` du parent : `server/lib/routes/cli-detect.mjs` gagne **Grok Build CLI** (`grok`) et **Kimi CLI** (`kimi`), et Antigravity sonde désormais son binaire canonique `agy` en priorité. Le scan PATH en lecture seule rapporte maintenant **9 outils** ; il n'exécute toujours aucun binaire trouvé.

### Modifié
- **Resynchronisation de la documentation avec career-ops.org/docs** — chaque surface de docs a été réconciliée avec les pages vivantes du parent (les 31 lues). Le roster canonique d'assistants IA (help ×17 + README ×17) liste désormais les 8 CLIs de premier rang — Claude Code, Codex, OpenCode, Antigravity CLI, Grok Build CLI, Qwen Code, Kimi, GitHub Copilot CLI — plus Gemini CLI (wrapper hérité). Les bundles d'aide gardent leur structure 29 H2 / 105 H3.

## [1.125.4] — 2026-07-23

### Modifié
- **dépendances du site** (dependabot #151–#153) — `sharp` 0.34.5→0.35.3, `svgo` 4.0.1→4.0.2, `fast-uri` (dev) 3.1.3→3.1.4 dans `site/` ; build Astro au vert, aucun impact SPA/serveur.

### Notes
- **Balayage de parité avec le parent (career-ops `37d17ec..254764a`, post-v1.22.0)** — rien à porter : le garde-fou de mauvaise ligne de `set-status` (#2108) est CLI uniquement (dans web-ui les lignes du tracker sont sélectionnées explicitement et aucune route n'invoque `set-status.mjs`), le Risk Summary des modes localisés (#2109) touche des fichiers `modes/<lang>/` que web-ui ne lit jamais (uniquement `modes/*.md` de premier niveau), la vérification de manifeste d'`update-system` (#2111) ne concerne que l'updater, et le reste est de la doc du parent (README turc, SIGNATURES ×4, SCRIPTS.md, accents es). Le VERSION du parent reste **1.22.0** — `parentVersion` inchangé.

## [1.125.3] — 2026-07-23

### Corrigé
- **Les prompts LLM en danois et en hindi répondaient en anglais** (signalé par un utilisateur) — `LOCALE_NAMES` et les cinq blocs `SCAFFOLD_STRINGS` de `server/lib/prompts.mjs` n'avaient jamais été étendus à `da` ni `hi` : `resolveLocale()` retombait sur `en` et chaque prompt IA — deep research (live et manuel), modes, évaluation, entretien, networking, CV Studio — perdait sa directive `# Output language` dans ces deux locales. Les deux sont désormais de premier rang : directive de langue + échafaudage localisé. Le garde-fou de régression de `tests/locale-scaffold.test.mjs` parcourt maintenant la liste canonique des 17 locales au lieu de 12 codées en dur, et un nouveau contrôle structurel fait échouer toute clé d'échafaudage retombant sur l'anglais — une future locale qui oublierait `prompts.mjs` ne peut plus être publiée (+12 tests, la suite passe à **1969**).

## [1.125.2] — 2026-07-22

### Corrigé
- **Deep research via Gemini : HTTP 502 (`MALFORMED_FUNCTION_CALL`)** (#145, contribution de [@Alien10140](https://github.com/Alien10140)) — le prompt live de `/api/deep` demandait au modèle « Use WebFetch / WebSearch » et d'enregistrer le brief dans un fichier, mais les fournisseurs d'API sans outils n'ont pas de canal d'outils ; Gemini répondait par un appel de fonction au lieu de texte, ce qui apparaissait comme un 502 vide. `buildDeepPrompt` et `bundleProjectContext` acceptent désormais un drapeau `headless` : les exécutions live (Anthropic/Gemini/cascade de repli) reçoivent un prompt sans outils qui rédige le brief à partir du contexte injecté, tandis que le prompt à copier-coller pour Claude Code conserve ses instructions d'outils. +1 test dans `tests/critical-fixes.test.mjs`.

### Modifié
- **Modèles Gemini par défaut mis à jour au-delà du déprécié `gemini-2.0-flash`** (#144, contribution de [@Alien10140](https://github.com/Alien10140)) — la liste déroulante de Configuration, le repli serveur de `gemini.mjs` (qui divergeait en silence de l'indice), la chaîne de repli OpenRouter, `config.geminiModelHint` ×17 et le guide d'aide ×17 nomment désormais **`gemini-3.6-flash`**. La nouvelle porte anti-dérive `tests/gemini-default-model.test.mjs` (+5 tests) épingle toutes les surfaces au même littéral — la suite atteint **1957 tests**.

## [1.125.1] — 2026-07-21

### Corrigé
- **SuccessFactors : les tenants RMK multi-marques conservent leur chemin de marque** (parent #2099, post-v1.22.0) — les holdings qui exploitent plusieurs marques acquises depuis une seule instance RMK partagée les distinguent par un segment de chemin (`careers.nemetschek.com/Bluebeam/` contre `…/Vectorworks/`) ; l'adaptateur réduisait auparavant l'URL configurée à son origine, scannant silencieusement les offres de la marque parente. Le endpoint préserve désormais le préfixe de marque, ne retirant qu'un segment final `/search/` ou `/tile-search-results/` afin que rien ne se duplique jamais sur lui-même ; les tenants à domaine unique restent inchangés au bit près. Nouveau helper exporté `resolveTenantBase` + 1 bloc de test porté dans `tests/sources-successfactors.test.mjs`.


## [1.125.0] — 2026-07-21

### Ajouté
- **cvstart.org : section « Sources d'offres » sur la landing** — une nouvelle section entre les captures d'écran et le comparatif liste **les 67 sources de scan sous forme de puces cliquables** (62 boards/ATS anglophones + les 5 boards russes sous leur propre sous-titre), chacune renvoyant vers le site public de la source. La liste est synchronisée avec le registre d'adaptateurs en direct au moment du build (`sync-assets.mjs` → `facts.sources`), si bien qu'elle ne peut jamais diverger de l'app ; une carte de liens organisée dans `Sources.astro` est protégée par la nouvelle `tests/site-sources.test.mjs`. La navigation d'en-tête a gagné une ancre **Sources** ; 4 nouvelles clés i18n du site ×17. La liste `inLanguage` du JSON-LD de la landing, à laquelle il manquait encore `hi`, a également été corrigée.


## [1.124.0] — 2026-07-21

### Ajouté
- **Cinq sources de scan** (parité avec le parent v1.22.0, #1808/#1572/#2024/#2055) — **Welcome to the Jungle** (API JSON à l'échelle du board), **Agentic Engineering Jobs** (board dédié à l'ingénierie IA/agentique), **Jobvite** (ATS par tenant sans authentification), **Gem** (ATS par tenant), et **Alibaba Group** (API JSON carrières, sur le modèle Meituan/Tencent). Chacune est une paire source + adaptateur épinglée à son hôte et isolée pour la CI ; le registre livre désormais **67 adaptateurs (62 anglais + 5 russes)** ; le repli du menu déroulant Source de `#/scan` et son garde-fou de dérive sont mis à jour ; cinq nouvelles suites `tests/sources-{wttj,agenticjobs,jobvite,gem,alibaba}.test.mjs`.

### Corrigé
- **Arbeitsagentur : full remote national uniquement quand `homeofficetyp` vaut `VOLLSTAENDIG`** (parent #1981) — la requête `homeoffice=nv_true` renvoie aussi des postes hybrides, donc la passe remote confirme désormais chaque résultat via le point de terminaison de détails de l'offre par petits lots et échoue de façon fermée (une erreur de résolution conserve la ville réelle de l'offre pour que les filtres de localisation continuent de s'appliquer).
- **SmartRecruiters : URL publiques des offres construites sans `/postings/`** (parent #2047) — les liens pointent désormais vers la page publique de l'offre au lieu d'une erreur 404 pour les tenants dont le site public omet ce segment.

### Notes
- Le parent v1.22.0 a aussi livré des changements côté CLI que l'interface web ne shell pas ou couvre déjà : le modèle de CV zh-CN + la typographie PDF, le mode `/expand`, les ajustements de cache de prompt des fournisseurs (Gemini/OpenAI/Ollama), la répartition des tokens par étape (l'interface web a son propre compteur d'utilisation), la sérialisation par verrou d'écriture du tracker (l'interface web route ses écritures via `withFileLock` depuis la v1.21), les indicateurs CLI `visa_filter` et de date de publication absolue pour le scan (l'interface web a son propre filtre d'ancienneté « Publié depuis »), et l'amorçage de déduplication des sources vues (le scanner de l'interface web garde sa propre déduplication de l'historique de scan).

## [1.123.0] — 2026-07-17

### Ajouté
- **Source de scan Oracle Recruiting Cloud** (parité avec le parent v1.21.0, #1929) — l'API REST `recruitingCEJobRequisitions` sans authentification des sites carrières Oracle Fusion/ORC (JPMorgan Chase, Oracle, BNY Mellon, American Express, Honeywell, …) : hôte épinglé à `*.fa[.<région>][.ocs].oraclecloud.com`, le numéro de site résolu depuis le `careers_url` de chaque entreprise suivie, une pagination par décalage avec un plafond de pages strict, et des en-têtes façon navigateur conscients du WAF. Le registre livre désormais **62 adaptateurs (57 anglais + 5 russes)** ; le repli du menu déroulant Source de `#/scan` et son garde-fou de dérive sont mis à jour ; nouvelle suite isolée pour la CI `tests/sources-oraclecloud.test.mjs`.

### Corrigé
- **Détecteur de reposts : les intitulés de base restent distincts des variantes à suffixe spécialisé** (parent #1922) — « Senior Analytics Engineer » ne se regroupe plus avec « Senior Analytics Engineer, People Analytics » : lorsque les tokens d'un intitulé forment un sous-ensemble strict de ceux de l'autre et que le token supplémentaire est une véritable spécialisation (pas un mot de base), les deux sont traités comme des offres publiables séparément. Les annotations de repost (« (Repost) », « relisted ») sont désormais considérées comme du bruit et filtrées comme mots vides. +2 assertions dans `tests/detect-reposts.test.mjs`.

### Notes
- Le parent v1.21.0 a aussi livré des changements côté CLI que l'interface web ne shell pas ou couvre déjà : l'avertissement de re-candidature pour une même entreprise (l'interface web a son délai de refroidissement de réapplication depuis la v1.84.0), les indicateurs `--format`/`--report` de la lettre de motivation, les modes de prompt e-mail red-flag / panel-intel / no-show pour les entretiens, la persistance des signaux de confiance de scan et de la santé des portails (l'interface web exécute son propre scanner en-process avec `trust-validator` et la page Santé des portails), et les extensions stats/salary-gap (relayées en lecture seule et en mode dégradé).

## [1.122.0] — 2026-07-16

### Ajouté
- **Hindi (हिन्दी) — la 17e langue** — dictionnaire d'UI complet (~1 110 clés), guide d'aide intégré complet (parité 29 H2 / 105 H3), `README.hi.md`, un nouveau `CHANGELOG.hi.md` (débutant à la v1.122.0, selon le précédent de/it/tr), les pages landing + Méthodologie/Licence/Changelog/Aide de cvstart.org, le sélecteur de langue (🇮🇳), la détection automatique de la langue du navigateur, et une capture d'écran de tableau de bord localisée. Chaque garde-fou de parité ×16 tourne désormais ×17 : parité du dictionnaire i18n + instantané, garde-fous H2/H3 de l'aide, parité du CHANGELOG, `check-i18n` du site, et le balayage des locales Playwright.

## [1.121.0] — 2026-07-16

### Ajouté
- **cvstart.org : pages Méthodologie, Licence et Changelog** — la landing a gagné trois nouvelles sections dans les 16 langues, à côté du bloc Comparatif existant : **/methodology/** (la grille de notation à six dimensions de 0,0 à 5,0, le seuil de candidature à 4.0, et les règles à ne jamais enfreindre — un résumé localisé de [career-ops.org/methodology](https://career-ops.org/methodology)), **/license/** (le texte canonique MIT avec un renvoi vers NOTICE.md), et **/changelog/** (ce fichier, affiché par locale à partir des 16 CHANGELOG traduits du dépôt). Nouvelle entrée **Méthodologie** dans l'en-tête et liens Ressources dans le pied de page ; `sync-assets.mjs` synchronise désormais le CHANGELOG ×16 et la LICENSE dans le site au moment du build, pour que les pages ne puissent jamais diverger du dépôt.
- **Liens vers la méthodologie dans toute la documentation** — le README (dans les 16 langues), la liste canonique du §1 du guide d'aide intégré (dans les 16 langues), et le wiki renvoient désormais vers [career-ops.org/methodology](https://career-ops.org/methodology) (ainsi que la FAQ et le glossaire), aux côtés des guides existants sur [career-ops.org/docs](https://career-ops.org/docs).

### Modifié
- Bannière de release et badges du README actualisés (1850 tests, version v1.121.0) — la bannière annonçait encore la v1.119.5.

## [1.120.0] — 2026-07-16

### Ajouté
- **Le Manifeste CareerOps** (parité parent v1.20.0) — le projet parent a publié le Manifeste CareerOps (`MANIFESTO.md` · [career-ops.org/manifesto](https://career-ops.org/manifesto)) et le met désormais en avant depuis son README, son updater et son tableau de bord Go. L'interface web fait de même : un nouveau lien dans le pied de page de la barre latérale ouvre la page du manifeste (nouvelle clé i18n `footer.manifesto` dans les 16 locales), le guide d'aide intégré a gagné le §29 « Le Manifeste CareerOps » dans les 16 langues, le README explique ce qu'est le manifeste et comment le signer, et le pied de page de la landing cvstart.org y renvoie également.

### Notes
- Le parent v1.20.0 a aussi corrigé la suppression des compétences déjà connues du mode ciblé `upskill`, rendu dotenv silencieux pour que la sortie stdout de `scan --json` reste analysable, et corrigé le template CV HTML pour qu'un en-tête de poste reste collé à ses puces — des surfaces côté CLI dans lesquelles l'interface web ne shell pas ; aucun changement de code côté web-ui n'était nécessaire.

## [1.119.5] — 2026-07-13

### Corrigé
- **Le bouton de langue de la landing ne se replie plus** — avec les drapeaux de la v1.119.2, le libellé du sélecteur dans l'en-tête (p. ex. «🇷🇺 Русский») pouvait se casser sur jusqu'à trois lignes aux largeurs desktop étroites ; le libellé du sélecteur et toutes les options du menu sont désormais en `whitespace-nowrap` — drapeau + endonyme toujours sur une ligne. La liste des langues du pied de page passe d'une grille rigide à deux colonnes à une rangée enveloppante d'éléments d'une ligne — «🇧🇷 Português (Brasil)» ne se coupe plus non plus au milieu du nom.

## [1.119.4] — 2026-07-13

### Modifié
- **LICENSE nomme l'auteur** — la ligne de copyright indique désormais : *Sergey Emelyanov (Fighter90) <https://sergey-cv.com> and career-ops-ui contributors* (texte MIT canonique intact). Un nouveau **NOTICE.md** détaille la licence : qui détient le copyright, ce que couvre exactement la concession MIT (code, docs, traductions, la landing, le wiki), ce qu'elle NE couvre PAS (vos données à l'exécution, le projet parent, le contenu des job boards, les marques), le tableau des composants tiers (express/js-yaml — MIT ; Astro/Tailwind — MIT ; les polices Figtree et JetBrains Mono — SIL OFL 1.1 ; sharp — Apache-2.0) et une ligne d'attribution facultative.

## [1.119.3] — 2026-07-13

### Ajouté
- **SECURITY.md** — la politique de sécurité vers laquelle pointait CONTRIBUTING existe désormais : versions prises en charge, flux de signalement privé (le **private vulnerability reporting** GitHub est **activé** sur le dépôt — onglet Security → « Report a vulnerability »), le modèle de menaces d'une app mono-utilisateur liée à localhost (dans le périmètre : XSS via des offres hostiles / SSRF / path traversal / fuite de secrets / affaiblissement de la CSP ; hors périmètre : DoS de son propre localhost et problèmes du projet parent) et la base de durcissement pour les relecteurs.

## [1.119.2] — 2026-07-13

### Ajouté
- **CONTRIBUTING.md** — le guide du contributeur vers lequel la landing et le README pointaient depuis toujours existe désormais : installation, carte du projet, les règles dures sécurité/no-build, les niveaux de test, le walkthrough des « deux registres » pour ajouter une source de scan, le contrat i18n ×16, les conventions de commits/PR et le processus de release.
- **Drapeaux des langues sur la landing** — le sélecteur de langues de cvstart.org, la grille des langues du pied de page et la bannière « lisez dans votre langue » affichent désormais le drapeau de chaque locale à côté de son endonyme (le même jeu d'indicateurs régionaux que le `<select>` de langue de l'app ; dégrade en lettres de région là où les glyphes de drapeau manquent).
- **Corrections du pied de page de la landing** — le lien mort vers Discussions (fonction non activée sur le dépôt) pointe désormais vers le **wiki** du projet, et le pied de page crédite l'auteur : **Sergey Emelyanov** ([sergey-cv.com](https://sergey-cv.com/) · [LinkedIn](https://www.linkedin.com/in/sergey-emelyanov-in-job/)).

## [1.119.1] — 2026-07-13

### Corrigé
- **Le filtre de sources de `#/scan` a rattrapé le registre** — la liste statique `FALLBACK_SOURCES` derrière le menu déroulant Source (utilisée seulement quand `GET /api/scan/sources` est injoignable) accusait silencieusement du retard depuis la v1.87.0 : 20 fournisseurs manquaient au repli hors-ligne (Amazon, Avature, SAP SuccessFactors, Get on Board, Dassault Systèmes, beesite, HigherEdJobs, JibeApply (iCIMS), softgarden, Cornerstone, Phenom, Radancy, Deutsche Bahn, EchoJobs, TKMS, Heckler & Koch, Rheinmetall, LaraJobs et les nouveaux Meituan / Tencent). Synchronisée avec les **61** et désormais gardée par un test de dérive qui fait échouer la CI dès que la liste client diverge du registre serveur (valeurs ET libellés). +1 test (**1845**).

## [1.119.0] — 2026-07-13

Parité avec le career-ops parent **v1.19.0** + rafraîchissement de la landing cvstart.org.

### Ajouté
- **2 nouveaux fournisseurs de scan** — Meituan (`zhaopin.meituan.com`) et Tencent (`careers.tencent.com`) : les API JSON publiques sans authentification des boards tech chinois, détectées par hôte ou sélectionnées via un `provider:` explicite, avec recherche côté serveur par mot-clé, pagination et déduplication par URL — **61 adaptateurs** désormais (56 EN + 5 RU). +20 tests (**1844**).
- **Bloc des contributeurs sur la landing** — cvstart.org affiche les avatars de toutes les personnes ayant contribué du code (API GitHub `/contributors` au build, bots filtrés), localisé dans les 16 langues, avec un lien vers le graphe complet des contributeurs.
- **Compteur d'étoiles GitHub en direct sur la landing** — le badge d'en-tête se rafraîchit désormais côté client depuis l'API GitHub à chaque visite (l'instantané de build sert de repli), et une reconstruction hebdomadaire planifiée de Pages garde l'instantané et la liste des contributeurs à jour ; les appels API en CI sont authentifiés par token.

### Corrigé
- **Les requêtes Workday CXS portent des en-têtes de navigateur** (parent #1813) — les tenants derrière Cloudflare (vu en production : geico) répondent 500 aux requêtes sans UA/`accept-language`/`origin`/`referer` ordinaires ; le fetcher dérive désormais l'origin et le slug du site depuis l'URL CXS elle-même. Les requêtes Glints ont gagné le même UA de navigateur + origin/referer, tous deux issus de la constante partagée `BROWSER_LIKE_USER_AGENT` de `http-json.mjs`.

## [1.118.4] — 2026-07-10

### Corrigé
- **Les scans hh.ru renvoyaient 0 résultat depuis une IP russe (liens de sous-domaine régional)** — depuis une IP résidentielle russe, hh.ru redirige la recherche (302) vers un sous-domaine régional (`sochi.hh.ru`, `spb.hh.ru`, …) et renvoie les liens d'offres sur ce sous-domaine. Le parseur cherchait le lien du titre sur l'hôte fixe `https://hh.ru/vacancy/` et n'en trouvait **aucun** parmi les régionaux ; un scan pleinement fonctionnel enregistrait donc 0 en silence. Il accepte désormais tout hôte `*.hh.ru` (les publicités sur `adsrv.hh.ru/click?…` restent exclues — elles n'ont pas de chemin `/vacancy/<id>`) et canonise chaque URL de résultat en `https://hh.ru/vacancy/<id>`. Vérifié en direct : 17 offres réelles sont analysées depuis une page `sochi.hh.ru` qui donnait auparavant 0. +1 test (**1824**).

## [1.118.3] — 2026-07-10

### Corrigé
- **hh.ru renvoyait silencieusement 0 résultat (interstitiel de vérification VPN)** — hh.ru redirige désormais en 302 les réseaux qu'il considère comme VPN/proxy (IP de datacenter) vers un interstitiel `/vpncheeck` (“VPN мешает работе сайта”) qui répond **HTTP 200** sans aucune carte d'offre, si bien que le scan rapportait 0 sans la moindre erreur. Le scanner détecte maintenant la redirection via l'URL finale de la réponse, désactive hh.ru pour le reste de l'exécution et affiche un indice honnête : le trafic doit réellement sortir par une IP résidentielle — un VPN/proxy système peut rester actif même quand l'interrupteur du navigateur est coupé. +1 test (**1823**).

## [1.118.2] — 2026-07-10

### Maintenance
- **Suivi du landing (#118)** — `site/README.md` réconcilié avec Astro 7 (la mise à niveau de sécurité de #116), import inutilisé supprimé et **+4 gardes exécutables** pour les scripts de build du landing : la porte de parité i18n échoue de façon démontrable sur un dictionnaire cassé et `sync-assets` n'écrit jamais hors de `site/` — suite **1822**. Deux alertes CodeQL résolues (une corrigée à la source, une rejetée comme comportement de build voulu).

## [1.118.1] — 2026-07-10

### Corrigé
- **Scan de hh.ru hors de Russie** — hh.ru renvoie désormais **HTTP 451** (blocage légal régional) aux IP non russes sur ses pages publiques de recherche. Le scanner traite le 451 comme le 403 : après le premier blocage, hh.ru est désactivé pour le reste de l'exécution avec un message honnête dans le journal indiquant une IP russe / sortie VPN, sans gaspiller les requêtes restantes ni les autres sources RU. Aide §7 mise à jour dans les 16 langues. +1 test (**1818**).

## [1.118.0] — 2026-07-09

Pack de parité avec le career-ops parent **v1.18.0**.

### Ajouté
- **9 nouveaux fournisseurs de scan** — Cornerstone OnDemand (`csod`), Phenom (`phenom`), Radancy (`radancy`), Deutsche Bahn (`deutschebahn`), EchoJobs (`echojobs`), TKMS (`tkms`), Heckler & Koch (`hecklerkoch`), Rheinmetall (`rheinmetall`), LaraJobs (`larajobs`) — désormais **54 adaptateurs**. L'adaptateur Lever détecte en plus les tableaux du tenant EU (`jobs.eu.lever.co`).
- **Statut `Hired` du tracker** (parité avec le `states.yml` parent) : les offres acceptées ont leur propre état canonique, un badge de célébration et une bannière « poste décroché » sur `#/tracker` ; l'entonnoir et les conversions le comptent comme ayant franchi toutes les étapes.
- **Onglet Cumul dans `#/stats`** — relais en lecture seule du `stats.mjs` parent (récapitulatif cumulé du tracker, taux d'entonnoir cumulés, totaux du scanner, couverture des portails) plus les observations de rémunération de `salary-gap.mjs` (souhaitée vs annoncée vs réelle, par candidature). Nouvelles routes `GET /api/stats/lifetime` et `GET /api/stats/salary-gap` — shell-outs à zéro token, dégradation sûre `{available:false}` sans le projet parent.
- 28 nouvelles clés i18n dans les 16 locales ; guide d'aide §14/§26 mis à jour dans toutes les langues.

### Tests
- +38 tests unitaires (trois suites de parité fournisseurs + routes relais/statut) — **1817** au total.

## [1.117.2] — 2026-07-06

**Correctif tracker vide pour les shell-outs de parité.** Les scripts du parent sortent avec le code 1 et un JSON `{error}` structuré quand le tracker n'a pas encore de candidatures ; le tableau de relance et l'onglet motifs de rejet l'affichaient comme « script-error ». Les deux routes le relaient désormais comme un état vide sain (`available:true, empty:true`), et l'UI montre son message honnête « rien pour l'instant ». Vérifié en direct contre un parent réel.

Nouveau : aucun.


## [1.117.1] — 2026-07-06

**Durcissement de v1.117.0 (triage CodeQL).** Les trois endpoints shell-out (`GET /api/followup`, `POST /api/followup/seed`, `GET /api/stats/patterns`) portent désormais le limiteur par IP partagé (un processus enfant par requête ; no-op en loopback). L'extraction de texte par URL d'Ajouter au CV retire les balises jusqu'au point fixe puis supprime tout `<`/`>` restant — un assainissement démontrablement complet pour du texte de prompt LLM. Aucun changement pour les entrées valides.

Nouveau : aucun.


## [1.117.0] — 2026-07-06

**Pack de parité parent — six capacités du career-ops parent portées dans l'UI.** (1) **Tableau de cadence** sur `#/followup` : urgence par candidature (🔴/🟠/🟡/🔵) via `followup-cadence.mjs`, plus le bouton **Semer les dates** (`followup-seed.mjs --backfill`). (2) **Motifs de rejet** : un quatrième onglet Statistiques exécute `analyze-patterns.mjs` (lecture seule) — répartition des issues, recommandations, taux d'avancement par fournisseur ATS. (3) **Ajouter au CV** : une carte CV Studio transforme une URL ou un texte collé en puces ATS fondées UNIQUEMENT sur cette source (suggestions seulement, aucune écriture ; le fetch d'URL est protégé anti-SSRF). (4) **4 nouveaux fournisseurs de scan** — beesite, HigherEdJobs (RSS), JibeApply (iCIMS), softgarden — le registre compte désormais **50 adaptateurs (45 EN + 5 RU)**, tous dans la liste déroulante du Scan. (5) Étape de **pré-scan des disqualifiants** dans la checklist Apply. (6) **Runner reconcile** (`/api/run/reconcile`). Les routes shell-out dégradent honnêtement sans les scripts du parent.

- Nouveau module `server/lib/routes/followup.mjs` (31ᵉ) + nouvelles routes + 8 fichiers source/adaptateur. Tests : 6 + 7 nouveaux ; suite 1737 → 1750. 41 clés i18n ×16. Aide §13/§17/§24/§26 étendue ×16.

Nouveau : `GET /api/followup`, `POST /api/followup/seed`, `GET /api/stats/patterns`, `POST /api/cv-studio/add-entry`, `POST /api/run/reconcile`.


## [1.116.0] — 2026-07-06

**Compteur d'utilisation refait + premier test bout-en-bout des widgets.** Le compteur d'utilisation de l'IA (v1.114.0) est corrigé et épinglé correctement : il est désormais **épinglé en bas de la barre latérale gauche** (toute la largeur, même surface) et réserve en bas un espace égal à sa hauteur pour que le **menu ne soit jamais couvert** — la navigation et le pied de version défilent toujours librement au-dessus. Il **s'actualise en direct** (toutes les 15 s, au focus de l'onglet et au changement de route), et chaque ligne de fenêtre affiche désormais les **`<jetons> · <coût estimé>`** réels (les barres se mettent à l'échelle contre la fenêtre 30 jours) au lieu d'une « part » toujours à 100 %. De plus : une barrière `typeof` durable dans l'importateur de CV clôt à la source le faux positif récurrent de type-confusion de CodeQL, et un nouveau **test bout-en-bout** Playwright pilote les deux widgets persistants dans un vrai navigateur.

- `public/js/lib/usage-hud.js` + `app.css`, `server/lib/cv-import.mjs`. Tests : `tests/playwright-widgets.mjs` (2 E2E) + `tests/usage-hud.test.mjs` (10). Aide §6 étendue ×16.

Nouveau : aucun.


## [1.115.0] — 2026-07-06

**Peaufinage du design (conservateur, marque corail conservée).** Une passe légère de raffinement sur le système de design partagé — sans restructuration, sans changement de palette. Les cartes de métriques du tableau de bord se soulèvent et prennent une bordure corail au survol (comme les tuiles d'action rapide) ; les cartes de contenu se soulèvent un poil ; les boutons primary / dark / danger gagnent une ombre au repos et un léger soulèvement au survol pour la profondeur ; les grands nombres s'alignent via tabular-nums ; et les contrôles interactifs reçoivent un halo corail doux derrière l'anneau clavier de 2px. Toute animation respecte `prefers-reduced-motion`, et le halo est limité aux contrôles — jamais un `*:focus-visible` global.

- CSS uniquement (`public/css/app.css`) ; aucun changement de balisage, i18n, routes ou CSP. Tests : `tests/design-polish-v1115.test.mjs` (5). Vérifié en direct avec Playwright.

Nouveau : aucun.


## [1.114.0] — 2026-07-06

**Compteur d'utilisation et de coût de l'IA dans la barre latérale (en bas à gauche).** Une section **UTILISATION** compacte se trouve désormais en bas de la barre latérale (une carte fixe en bas à gauche s'il n'y a pas de barre latérale ; en bas à droite en RTL) sur chaque page. Elle montre votre utilisation de jetons LLM sur des fenêtres **24h / 7j / 30j** — chacune sous la forme `<jetons> · <part%>` avec une barre verte (part du total) — plus un pied avec le coût estimé sur 24h. Les données sont le récapitulatif en lecture seule `GET /api/usage` de `data/llm-usage.jsonl` (local uniquement), la même source que la page `#/usage` ; le coût est une estimation et les exécutions en mode manuel sont gratuites et non comptées. Repliable — l'en-tête bascule et l'état persiste.

- Nouveau widget client `public/js/lib/usage-hud.js` chargé depuis `index.html`, monté dans la barre latérale au-dessus du pied de version (repli en coin fixe). Sûr pour la CSP ; adapté au thème et miroir RTL. Aucune nouvelle route serveur. Tests : `tests/usage-hud.test.mjs` (8). 3 nouvelles clés i18n ×16.

Nouveau : aucun.


## [1.113.0] — 2026-07-06

**Assistant flottant « Interroger l'aide » sur chaque page.** Un bouton de chat robot en dégradé flotte désormais dans le coin inférieur droit (inférieur gauche en RTL) de chaque page. Cliquez pour ouvrir un chat compact qui répond aux questions d'utilisation en se basant UNIQUEMENT sur le guide d'aide intégré dans votre langue — le même endpoint que la page `#/docs-assistant` (`POST /api/docs-assistant/ask`), donc il ne lit jamais votre CV, profil ou suivi. En direct avec une clé LLM ; sans clé → un prompt prêt à l'emploi. L'en-tête montre un avatar robot + un statut en ligne ; les puces amorcent des questions courantes ; Échap ou clic extérieur ferme ; il se masque sur la page `#/docs-assistant`.

- Nouveau widget client `public/js/lib/docs-fab.js` monté globalement depuis `index.html` ; sûr pour la CSP ; styles adaptés au thème et miroir RTL dans `app.css`. Aucune nouvelle route serveur. Tests : `tests/docs-fab.test.mjs` (8). 6 nouvelles clés i18n ×16. Aide §1 étendue sur place.

Nouveau : aucun.


## [1.112.0] — 2026-07-06

**Consolidation docs & QA.** Aucun changement de code visible. Le document de conventions SDD (`docs/sdd/CONVENTIONS.md`) est mis à jour vers les **30 modules de route** actuels (24 auparavant) et la base de tests actuelle ; le prompt QA définitif de tout le projet (`qa/QA-REGRESSION-PROMPT.md`) est consolidé — mécanique de release dépoussiérée (v1.111, parentVersion 1.17.0, publication déclenchée par la release), le tableau des ajouts §14 corrigé (Exclure du Scan ré-étiqueté v1.109.0) et étendu avec la clôture CodeQL de v1.111 — de sorte qu'il se suffit comme unique prompt de régression pour toutes les fonctionnalités. Ajoute un test de couverture pour la branche de téléversement surdimensionné.

Nouveau : aucun.


## [1.111.0] — 2026-07-06

**Sécurité — clôture du backlog CodeQL.** Trois renforcements de défense en profondeur qui closent les constats d'analyse statique restants à la source plutôt que de les écarter. `stripDangerousMarkdown` échappe désormais le `<` de toute ouverture de balise dangereuse *tronquée* (une charge se terminant par `<script`/`<iframe`/…), de sorte que sa sortie ne contient de façon prouvable aucune balise dangereuse vivante. L'import de CV lit la taille du tampon téléversé via une coercition explicite `Number()` — une barrière contre la confusion de types. Les lignes de rôle des modes sont désormais des **chaînes** de modèle interpolées avec `String.replace` au lieu de fonctions stockées, supprimant totalement l'appel à répartition dynamique. Aucun changement de comportement visible.

- `server/lib/security.mjs`, `server/lib/cv-import.mjs`, `server/lib/prompts.mjs`. Tests : `tests/security-hardening-v1111.test.mjs` (7) + test de garde v1108 mis à jour. Aucun changement i18n/aide/routes.

Nouveau : aucun.


## [1.110.0] — 2026-07-06

**Rafraîchissement docs & QA (toutes les langues).** Aucun changement de code. Le prompt QA de tout le projet passe à v1.109.0 avec un nouveau §14 (v1.98→v1.109), et les prompts pérennes UX-audit et design-export intègrent la surface de pages actuelle. Chaque paragraphe d'aide ajouté en v1.100–v1.109 est désormais traduit dans **les 16 langues**.

Nouveau : aucun.


## [1.109.0] — 2026-07-06

**Filtre Exclure du Scan + aperçu du pipeline (parité de mise en page web).** Sur `#/scan`, la boîte **Rechercher** traite désormais les virgules comme un **OU** (« rôles à trouver ») et un nouveau champ **Exclure** masque toute ligne dont l'entreprise/le rôle/le lieu contient un mot séparé par des virgules (p. ex. `senior, staff`) ; les deux sont mémorisés par vos recherches enregistrées. Sur `#/pipeline`, une **bande d'aperçu** compacte montre votre pipeline d'un coup d'œil — **N en boîte**, **N suivis**, et les décomptes **Applied / Responded / Interview / Offer** du tracker, chaque puce renvoyant à `#/tracker`.

- Côté client uniquement (aucune nouvelle route/écriture). `public/js/views/scan.js` + `public/js/views/pipeline.js`. Tests : `tests/scan-pipeline-ui-v1109.test.mjs` (2). 4 nouvelles clés i18n ×16. Aide §7 + §8 étendues sur place.

Nouveau : aucun.


## [1.108.0] — 2026-07-06

**Durcissement de sécurité (tri CodeQL, 2e passe).** Trois autres vulnérabilités de faible sévérité corrigées : le constructeur de prompts résout la ligne de rôle de la locale par **clé propre + `typeof === function`** afin qu'une locale falsifiée ne puisse pas invoquer une méthode de prototype (unvalidated-dynamic-method-call) ; le slug de nom de fichier PDF est **plafonné à 200 caractères avant le regex** pour qu'une entrée tout en tirets ne rétrograde pas (ReDoS polynomial) ; et l'import de document **convertit un `filename` tableau** (en-tête répété) en chaîne (type-confusion). Aucun changement de comportement pour une entrée valide.

- `server/lib/prompts.mjs`, `server/lib/routes/runners.mjs`, `server/lib/cv-import.mjs` + `tests/security-hardening-v1108.test.mjs` (3). Sur v1.106–v1.108, l'arriéré d'analyse statique est passé de 167 à ~14, chaque résultat réellement pertinent pour la sécurité étant corrigé et le reste (faux positifs protégés/désinfectés + lint de niveau note) rejeté avec justification.

Nouveau : aucun.


## [1.107.0] — 2026-07-06

**Durcissement du désinfectant (défense en profondeur XSS au repos).** `stripDangerousMarkdown` — qui neutralise le HTML dangereux dans le markdown de CV/offre stocké pour que tout consommateur contournant le client à échappement-au-rendu reste sûr — exécute désormais son nettoyage de balises **jusqu'à un point fixe** (répéter jusqu'à stabilisation) afin qu'une suppression qui *reforme* une charge (p. ex. `<scr<script></script>ipt>`) soit interceptée, correspond aux balises de fermeture script/style/etc. **avec des résidus** (`</script foo>`) et supprime un ouvreur exécutable **non fermé** (`<script …>`). Le comportement pour un markdown valide est inchangé — il ne supprime que davantage.

- `server/lib/security.mjs` : boucle de point fixe (limitée à 8 passes) + motifs de fermeture `[^>]*>` + suppression d'ouvreur non fermé. +3 cas de régression dans `tests/cv-xss-bypasses.test.mjs`. La frontière XSS de référence reste l'échappement en sortie (`UI.md`) ; ceci renforce la garantie au repos et clôt les résultats CodeQL correspondants.

Nouveau : aucun.


## [1.106.0] — 2026-07-06

**Durcissement de sécurité (tri CodeQL).** Trois vulnérabilités réelles (quoique de faible sévérité) corrigées après une passe sur l'arriéré d'analyse statique : le chemin d'erreur de rendu **échappe désormais le message d'erreur** avant qu'il n'atteigne le DOM (une erreur serveur peut refléter une entrée utilisateur, donc traitée comme non fiable — frontière XSS), et les écritures de propriétés profil/config **rejettent les clés `__proto__` / `constructor` / `prototype`** (protections anti-pollution de prototype par précaution — les clés viennent de specs de champs fixes, pas d'une entrée brute). La plupart des alertes restantes sont des faux positifs sur les lectures/écritures légitimes du scanner dans `data/*` et sur des routes portant déjà le limiteur maison ; rejetées avec justification.

- `public/js/router.js` échappe `err.message` via `UI.escapeHtml` avant `innerHTML` ; `server/lib/routes/content.mjs` et `server/lib/routes/config.mjs` protègent les clés de prototype. Aucun changement de comportement pour une entrée valide. Tests : `tests/security-hardening-v1106.test.mjs` (3). Aucune nouvelle clé i18n.

Nouveau : aucun.


## [1.105.0] — 2026-07-06

**Page d'utilisation et de coût de l'IA.** Une nouvelle page **Utilisation IA** (barre latérale, à côté de Santé) montre combien de tokens vous avez dépensés en générations IA **en direct** — évaluations, rapports, chats — ventilés **par fournisseur** sur les dernières 24 heures, 7 jours, 30 jours et tout le temps, avec un **coût estimé en USD**. Chaque appel en direct ajoute un petit enregistrement `{provider, in, out}` à `data/llm-usage.jsonl` (rien n'est envoyé nulle part) ; les exécutions sans clé (mode manuel) ne coûtent rien et ne sont pas enregistrées.

- Nouveau module de route (30ᵉ) `server/lib/routes/usage.mjs` — `GET /api/usage` (agrégats en lecture seule) + `server/lib/llm-usage.mjs` (`recordUsage` normalise les formes d'usage Anthropic/OpenAI/Gemini et ajoute en best-effort ; `readUsage`/`aggregate` agrègent par fenêtre 24h/7j/30j/tout × fournisseur) + `server/lib/llm-pricing.mjs` (une table **modifiable** de prix par fournisseur `$/1M` tokens — les tokens sont exacts, les dollars sont des prix catalogue approximatifs que vous pouvez corriger ; jamais facturés). L'enregistrement est branché aux points de dispatch (`runActiveProvider` + `routes/llm.mjs`).
- Nouvelle vue `public/js/views/usage.js` (`#/usage`, onglets de fenêtre). Tests : `tests/usage-routes.test.mjs`. 17 nouvelles clés i18n ×16 (`usage.*` + `nav.usage`). Aide §6 étendue sur place.

Nouveau : `server/lib/routes/usage.mjs` ; `server/lib/llm-usage.mjs` ; `server/lib/llm-pricing.mjs` ; `public/js/views/usage.js`.


## [1.104.0] — 2026-07-06

**Logos d'entreprise dans le tableau de scan (respectueux de la vie privée).** Un nouveau commutateur **Apparence** dans **Paramètres** — **Afficher les logos d'entreprise dans le tableau de scan** (désactivé par défaut) — dessine le logo de chaque entreprise à côté de son nom sur `#/scan`. Le logo est le **favicon de l'entreprise récupéré depuis son propre domaine** et relayé côté serveur (`GET /api/logo`), de sorte qu'**aucun service de logos tiers n'apprend quels employeurs vous consultez**. Les offres sur un portail d'emploi partagé (Greenhouse, Lever, Ashby, …) affichent un **badge à lettre** coloré plutôt que l'icône du portail, et tout logo qui échoue au chargement retombe sur ce même badge.

- Nouveau module de route (29ᵉ) `server/lib/routes/logos.mjs` — `GET /api/logo?domain=`. Il valide le domaine (sans schéma/chemin/loopback), récupère `/favicon.ico` via le **`safeGet` sûr contre le SSRF** (un nouveau mode `binary` renvoie les octets bruts + content-type ; l'épinglage DNS, la validation des redirections et la limite de taille sont inchangés), effectue un **sniffing de signature d'image** pour ne jamais servir une page HTML d'erreur comme image, met en cache les succès **et** les échecs dans un LRU en mémoire et **n'écrit rien sur le disque**.
- Nouvelle lib cliente `public/js/lib/company-logo.js` (`window.CompanyLogo`) : désactivée par défaut via un flag localStorage ; ignore les hôtes ATS partagés au profit d'un avatar-lettre déterministe ; repli `img.onerror` sûr pour la CSP. Tests : `tests/logo-routes.test.mjs`. 5 nouvelles clés i18n ×16 (`appear.*`). Aide §2 étendue sur place.

Nouveau : `server/lib/routes/logos.mjs` ; `public/js/lib/company-logo.js`.


## [1.103.0] — 2026-07-06

**Paramètres : « Outils CLI d'IA » — lesquels sont installés.** career-ops est piloté par Claude Code mais fonctionne avec n'importe quel CLI d'agent respectant le standard ouvert de skills. Un nouvel onglet **Outils CLI d'IA** dans **Paramètres** (`#/config`) montre lesquels — Claude Code, Codex, Gemini CLI, OpenCode, GitHub Copilot CLI, Qwen, Antigravity — sont installés sur la machine qui exécute le serveur, et leurs chemins. C'est une **analyse en lecture seule du PATH** : elle vérifie seulement si chaque binaire existe et **ne l'exécute jamais** (pas de `--version`, aucune exécution), n'écrit rien et ne touche aucune donnée utilisateur.

- Nouveau module de route (28ᵉ) `server/lib/routes/cli-detect.mjs` — `GET /api/cli-detect`. La détection résout le chemin d'un binaire depuis une liste blanche fixe de 7 entrées via `process.env.PATH` (shims `.cmd/.exe/.bat` sous Windows ; bit d'exécution sous POSIX) ; un fichier hostile sur le PATH ne peut jamais être exécuté par cette route.
- Nouvel onglet « Outils CLI d'IA » dans `public/js/views/config.js` (chargement différé, lien profond via `#/config?tab=cli`). Tests : `tests/cli-detect-routes.test.mjs`. 8 nouvelles clés i18n ×16 (`cli.*` + `config.tabCli`). Aide §2 étendue sur place.

Nouveau : `server/lib/routes/cli-detect.mjs`.


## [1.102.0] — 2026-07-05

**« Demander au guide » — un chat fondé sur le guide d'aide intégré.** Nouvelle page **Demander au guide 💬** (barre latérale, sous Aide) : posez une question comme « Comment scanner les portails d'emploi ? » et obtenez une réponse tirée **uniquement** du guide d'aide de l'appli dans votre langue — elle indique les sections utilisées et **ne lit jamais votre CV, profil ni votre recherche d'emploi**. Il s'agit de l'usage de l'appli, pas de vous. Avec une clé LLM, réponse en direct ; sans clé, une invite prête à l'emploi déjà remplie des sections d'aide pertinentes.

- Nouveau module de route (27ᵉ) `server/lib/routes/docs-assistant.mjs` — `POST /api/docs-assistant/ask`. **Récupération sans dépendance :** le guide de votre langue est découpé en sections `##` et noté par recouvrement de mots-clés avec votre question ; les meilleures sont incluses et le modèle doit répondre à partir d'elles ou dire que le guide ne le couvre pas (aucune fonctionnalité/route inventée). Cascade de fournisseurs partagée, repli manuel, limité en débit, **sans écriture**, ne lit aucune donnée utilisateur.
- Nouvelle vue `public/js/views/docs-assistant.js`. Tests : `tests/docs-assistant-routes.test.mjs`. 14 nouvelles clés i18n ×16 (`docs.*` + `nav.docsAssistant`). Aide §1 étendue sur place.

Nouveau : `server/lib/routes/docs-assistant.mjs` ; `public/js/views/docs-assistant.js`.


## [1.101.0] — 2026-07-05

**CV Studio : adaptez votre CV + rédigez une lettre de motivation pour une offre précise, avec un contrôle de type recruteur.** Nouvelle carte **Adapter à une offre** sur `#/cv-studio` : collez une offre d'emploi (et, en option, un rôle/intitulé cible) et CV Studio produit un **CV adapté à cette offre plus une lettre de motivation assortie**, puis les passe par un **contrôle** avant de les livrer — les `error` bloquent (corrigés avant que vous ne voyiez le résultat), les `warn` conseillent. La mécanique est distillée de la pratique du coaching de carrière en règles **génériques** — le recruteur lit en secondes, donc l'expérience pertinente va en haut, l'intitulé correspond au rôle de l'offre, les résultats portent des chiffres précis, et la lettre reste un teaser court avec un unique pont « exigence ↔ votre fait correspondant ». Fondé **uniquement** sur votre CV, profil et two-pager, il **n'invente jamais** — aucune entreprise, aucun rôle ni historique codés en dur.

- Nouveau point de terminaison `POST /api/cv-studio/tailor` (étend le module cv-studio existant — pas de 27ᵉ module) : `buildTailorPrompt` + un contrôle générique `TAILOR_INSTRUCTIONS`, fondé sur `bundleProjectContext`, cascade de fournisseurs partagée, repli manuel sans clé, limité en débit, **sans écriture**. Le résultat s'exporte en Markdown / PDF / **DOCX** via la barre partagée `report-export.js`.
- Tests : +3 dans `tests/cv-studio-routes.test.mjs`. 10 nouvelles clés i18n ×16 (`cvs.tailor*`). Référence générique `docs/prompts/resume-cover.md`. Aide §24 étendue sur place.

Nouveau : `docs/prompts/resume-cover.md`.


## [1.100.0] — 2026-07-05

**Two-pager : remplissage automatique par IA depuis votre CV + Aperçu + export en PDF/DOCX/Markdown.** Le two-pager (`#/two-pager`) recense ce que vous voulez vraiment de votre prochain poste, mais il fallait jusqu'ici rédiger chaque champ à la main ou copier une invite dans un autre outil. Désormais, l'**✨ assistant de remplissage IA** s'exécute en direct avec votre fournisseur configuré — il lit *uniquement* votre CV + profil (via `bundleProjectContext`, sans rien inventer), rédige tous les champs (qui je suis / ce que j'aime / indispensables / ce que je déteste / rédhibitoires / non négociables / environnement cible) et remplit le formulaire pour que vous le relisiez, l'éditiez et l'enregistriez. Sans clé API, il revient à la modale « copier l'invite », comme avant. Un nouveau bouton **👁 Aperçu et export** rend le two-pager sous forme de document avec une barre **Télécharger .md / Enregistrer en PDF / Enregistrer en DOCX / Copier**.

- **Export `.docx` sans dépendance.** Nouveau `server/lib/docx.mjs` qui produit un `.docx` Office Open XML minimal mais valide (un ZIP DEFLATE des quatre parties OOXML, CRC-32 par entrée) — sans nouvelle dépendance (les deps restent `express` + `js-yaml`). Nouvelle route `POST /api/export/docx` (`server/lib/routes/export.mjs`, le 26ᵉ module de routes ; sans état, borné à 200 Ko, sans écriture / sans LLM / sans fetch d'URL). Intégré au `public/js/lib/report-export.js` partagé, donc **le rapport de marché, le plan de carrière et l'orientation professionnelle gagnent aussi l'export DOCX**.
- Le remplissage automatique en direct utilise la cascade de fournisseurs partagée (`runActiveProvider` / `providerAvailable`) ; le YAML renvoyé est analysé et ramené à la forme bornée du two-pager (`parseYamlFields` + `normalizeTwoPager`) — clés inconnues supprimées, tableaux/chaînes plafonnés. Mode manuel préservé.
- Tests : `tests/export-routes.test.mjs`. 4 nouvelles clés i18n ×16 (`export.saveDocx`, `twoPager.preview`, `twoPager.aiFilling`, `twoPager.aiFilled`).

Nouveau : `server/lib/docx.mjs` ; `server/lib/routes/export.mjs`.


## [1.99.0] — 2026-07-05

**Page de santé des portails** (`#/portals`). Le scanner surveille un ensemble d’entreprises dans `portals.yml` ; un slug d’ATS peut se casser silencieusement et cet employeur disparaît de tous les scans futurs. La nouvelle page **Portals** liste chaque entreprise surveillée et, via **Check portal health**, sonde chaque `careers_url` à travers le `safeGet` à DNS épinglé (anti-SSRF) et signale les mortes (un 404 = écartée en silence) — en lecture seule. Renforce aussi le rapporteur de bugs de la v1.98.0 après revue : le tampon d’erreurs capture désormais les échecs réseau du fetch, et le nettoyeur masque les clés de fournisseur non étiquetées.

Nouveau : `server/lib/routes/portals.mjs`; `public/js/views/portals.js`.


## [1.98.0] — 2026-07-05

**Rapporteur de bugs intégré** (parité avec le web `web-v0.2.0` du projet parent). Un bouton **🐞 Report a bug** dans le tiroir de notifications rassemble un instantané de diagnostic à socle de confidentialité — versions, votre écran, navigateur, un résumé des vérifications de `/api/health` et les 20 dernières erreurs d’un nouveau tampon circulaire côté client — plus une empreinte de déduplication déterministe (`co-web-<base36>`), vous laisse relire le Markdown exact, puis ouvre une issue GitHub pré-remplie. Rien n’est envoyé automatiquement ; il ne transporte jamais votre CV, profil, réponses, URLs d’offres ou clés. Nouvelles libs `logbuf.js` + `bug-report.js` ; 11 clés i18n ×16 ; `tests/bug-report.test.mjs`.

Nouveau : `public/js/lib/logbuf.js`; `public/js/lib/bug-report.js`.


## [1.97.1] — 2026-07-05

**Durcissement guidé par la revue et parité de la documentation (suite de la v1.97.0).** Un balayage des journaux de revue par IA a fait remonter de vraies corrections :

- **`fit-score.js` (badge d'adéquation `◎` du scan).** `salaryFloor()` ne promeut plus un taux inférieur à l'annuel en un plancher annuel erroné — « at least 500 EUR/day », « $80/hr », « 6000 monthly » renvoient désormais `null` au lieu d'un facteur rédhibitoire de 500k/80k. La correspondance des pays se fait désormais par mot entier (`\b…\b`), de sorte que « Germany » ne correspond plus à l'adjectif « German » (ni « Nigeria » à l'intérieur de « Nigerian ») et ne déclenche plus une fausse violation d'incontournable-ailleurs. +3 tests dans `tests/fit-score.test.mjs`.
- **Parité de la documentation.** Chaque README localisé annonce désormais **16 langues** de manière cohérente — le décompte/la liste de la ligne Aide (×13) et la prose de la section Localisation ainsi que la note « ajouter la clé à tous les N fichiers » (×8) étaient encore sur les décomptes antérieurs à v1.85 (8/9). Le décompte d'adaptateurs de l'aide intégrée §17 est corrigé à **46 adaptateurs — 41 en anglais + 5 en russe** dans les 16 lots.

Aucun changement de comportement au-delà de l'heuristique du badge d'adéquation ; aucune nouvelle route, clé ou ajout d'i18n.


## [1.97.0] — 2026-07-05

**Source de scanner Dassault Systèmes + un balayage qualité sur trois fronts.**

- **Nouvelle source de scan — Dassault Systèmes (parité avec le career-ops principal, #1498).** `server/lib/sources/dassault.mjs` + `server/lib/portals/adapters/dassault.mjs` reproduisent le fournisseur « recherche par cartes » Exalead à coût nul en tokens du projet principal (le flux public derrière `3ds.com/careers/jobs`). C'est un unique endpoint global, il est donc sélectionné par fournisseur (`provider: dassault`) ou détecté automatiquement à partir d'un hôte `3ds.com`, avec l'hôte épinglé contre le SSRF sur `www.3ds.com` via `redirect:'error'`. Le XML est analysé sans DOM (cartes `<Meta>` par `<Hit>`), la ville/le pays sont extraits de la chaîne de catégorie localisée, et les offres ne sont conservées que lorsque leur URL publique est sur `*.3ds.com`. Le registre embarque désormais **46 adaptateurs** (41 EN + 5 RU) ; le décompte de `ALL_ADAPTERS`, les assertions d'id trié et de l'ensemble EN de `/api/scan/sources` passent de 40 → 41. Suite `tests/sources-dassault.test.mjs` (10 cas).
- **Corrections de robustesse portées depuis le projet principal.** L'analyseur d'Avature tolère désormais deux variantes de balisage de tenant en production (`article--result` avec un suffixe d'index de position + une ancre de titre JobDetail sans classe, #1541) ; Get on Board se prémunit contre un `published_at` `0`/négatif (fini les dates erronées de 1970) ; SuccessFactors plafonne la dernière page pour qu'elle ne puisse pas dépasser `MAX_JOBS` (#1528).
- **Corrections d'audit serveur.** `safe-fetch` ne se bloque plus sur une réponse dépassant la limite — le chemin du plafond de taille résout maintenant la promesse directement au lieu d'attendre un événement `'end'` qu'un flux détruit n'émet jamais (corrige les récupérations de grandes pages via `/api/pipeline/preview` + auto-pipeline). La journalisation d'activité SSE `stream.*` est de nouveau atteignable (la vérification de `/api/stream/` a été déplacée au-dessus de la garde générale « ignorer GET »).
- **Corrections d'audit SPA.** Le sélecteur d'onglets de `#/stats` se prémunit contre une course de rendu asynchrone — le résultat d'un onglet lent ne peut plus écraser un onglet plus récent vers lequel l'utilisateur a déjà basculé. Les confirmations de suppression du mock interview et du networking transmettent désormais un titre + un corps corrects (fini la boîte de dialogue au corps vide).
- **Corrections de traduction.** Valeurs de dictionnaire non traduites corrigées — ukrainien `config.modes*` (Adaptive Framing / Exit Narrative / Location Policy), russe `eval.jdLbl` (« Job Description »), italien `dash.quick.contactoSub` (« referral » → « segnalazione ») — plus la localisation du texte figé anglais `**16 locales**` dans les CHANGELOG ru/uk/ja/ko/zh-CN/zh-TW.

Nouveau : `server/lib/sources/dassault.mjs` ; `server/lib/portals/adapters/dassault.mjs`.


## [1.96.0] — 2026-07-04

**Orientation de carrière (Epic 27).** Une nouvelle page **`#/orientation`** répond à la question « quelles directions me correspondent vraiment ? » — la lecture qu'un test d'orientation vous donnerait, mais déduite de votre propre CV et profil plutôt que d'un questionnaire. Cliquez sur **Générer le profil** et le modèle renvoie vos **vecteurs de carrière les plus adaptés** (lesquels des huit archétypes — Fonctionnaliste, Administrateur, Communicateur, Spécialiste, Analyste, Innovateur, Manager, Entrepreneur — vous correspondent, avec des preuves), une inclinaison de type professionnel, des rôles recommandés, des forces professionnelles liées à votre CV, des tendances de style de travail et des recommandations de développement. C'est une **réflexion d'IA sur la façon dont se lit votre CV — pas un test psychométrique** : elle n'invente jamais de réalisations et ne rapporte jamais de scores numériques comme s'ils étaient mesurés. Exportez-le en Markdown ou PDF ; rien n'est écrit sur le disque.

- Nouvelle route `server/lib/routes/orientation.mjs` (24e module de routes) — `POST /api/orientation/generate` construit l'invite du profil à partir de CV+profil+two-pager+mémoire via la cascade de fournisseurs partagée, avec un repli manuel à copier-coller et **aucune écriture de fichier**.
- Réutilise `report-export.js` pour Markdown/PDF/copie, dans le groupe de navigation **Développement**.
- Tests : `tests/orientation-routes.test.mjs` (cadrage de réflexion / aucun score fabriqué, mode manuel amorcé avec CV/profil). 7 nouvelles clés i18n ×16 langues, Aide **§28** ×16.

Nouveau : `#/orientation` ; `server/lib/routes/orientation.mjs`.


## [1.95.0] — 2026-07-04

**Plan de carrière (Epic 26).** Une nouvelle page **`#/career-plan`** transforme votre CV et votre profil en un plan de développement concret et personnalisé. Choisissez un **horizon** (6/12/24 mois) et un **axe** optionnel, et le modèle — en lisant votre CV, votre profil, votre two-pager et votre note de mémoire — rédige un instantané du point de départ, une matrice AFOM forces/croissance, des objectifs en SMART / OKR / WOOP, des trajectoires alternatives, un plan de compétences techniques et comportementales, une **feuille de route mois par mois**, des méthodes de suivi de la progression, des écueils et des leviers de soutien. Il planifie à partir de ce que vos documents montrent réellement et n'invente jamais de faits sur votre parcours. Modifiez-le en ligne, **Enregistrez-le** dans la couche utilisateur (`config/career-plan.md`) et **exportez-le** en Markdown ou PDF.

- Nouvelle route `server/lib/routes/career-plan.mjs` (23e module de routes) — `GET`/`PUT /api/career-plan` (écrit `config/career-plan.md`) + `POST /api/career-plan/generate` (cascade de fournisseurs partagée, mode manuel de repli, sans fabrication). `PATHS.careerPlan`.
- Réutilise l'utilitaire partagé `report-export.js` (v1.94.0) pour Markdown/PDF/copie, et un nouveau groupe de navigation **Croissance**.
- Tests : `tests/career-plan-routes.test.mjs` (bornage, aller-retour GET/PUT, invite pré-remplie depuis le CV/profil selon l'horizon). 20 nouvelles clés i18n dans les **16 locales**, aide **§27** ×16.

Nouveau : `#/career-plan` ; `server/lib/routes/career-plan.mjs` ; `PATHS.careerPlan`.

## [1.94.0] — 2026-07-04

**Les statistiques, repensées (Epic 25).** La page `#/stats` est désormais une section **Statistiques** à trois onglets, avec de vrais graphiques et bien plus de données. Un nouvel onglet **Rapport de marché** demande au modèle une analyse des salaires et du marché du travail pour vos postes ciblés, dans une région et une devise de votre choix — synthèse exécutive, salaires par niveau avec percentiles P10/P25/P75/P90, principaux employeurs, tableau des compétences recherchées, fréquence des avantages, répartition présentiel/hybride/télétravail, tendances sur 12–24 mois et conseils de négociation. Chaque chiffre est étiqueté comme **estimation indicative issue des connaissances du modèle**, jamais présenté comme des données extraites. Un nouvel onglet **Mon pipeline** trace votre propre suivi : distribution des scores, entonnoir de statuts, principales entreprises et postes, candidatures dans le temps et taux de conversion. La vue « postes ciblés » d'origine (offres/salaires par pays + tendance des instantanés enregistrés) passe sous un troisième onglet, désormais doté d'un **sélecteur de devise** et d'un aperçu **offres par poste**.

- **Exportez n'importe quel rapport** en Markdown ou PDF, ou copiez-le — via l'utilitaire partagé `report-export.js` (téléchargement du blob Markdown ; PDF via le générateur PDF inline existant).
- Nouvelle route `server/lib/routes/market.mjs` (22e module de routes) — `POST /api/stats/market` construit une invite d'analyse de marché à partir de votre CV/profil (afin de connaître vos postes ciblés), de la région et de la devise, l'exécute via la cascade de fournisseurs partagée et retombe sur une invite à copier-coller en l'absence de clé. Aucune écriture de fichier.
- Tests : `tests/market-routes.test.mjs` (bornage région/devise, invite à l'étiquetage honnête, mode manuel pré-rempli depuis le CV/profil). 36 nouvelles clés i18n dans les **16 locales**, aide **§26** ×16.

Nouveau : `#/stats` repensée en onglets ; `server/lib/routes/market.mjs` ; `public/js/lib/report-export.js`.

## [1.93.0] — 2026-07-04

**Couche mémoire (Epic 24).** Une nouvelle page `#/memory` conserve une note courte et modifiable « à retenir à mon sujet » que l'assistant garde à l'esprit pour **chaque** tâche :

- **Une seule note, partout** — comme elle est intégrée à `bundleProjectContext`, la note atteint automatiquement chaque requête IA (évaluation, entretien blanc, networking, CV Studio) sur **tous** les fournisseurs. Écrivez-la une fois ; elle oriente tout.
- **Orientation, pas des faits** — elle capture vos préférences et votre façon de travailler (ton, format, points bloquants, cadence), jamais de nouvelles affirmations factuelles sur votre expérience — celles-ci ne vivent que dans votre CV, votre profil et votre two-pager. Enregistrée dans la couche utilisateur à `config/memory.md`, jamais écrasée par les mises à jour.
- **Suggérer à partir de vos données** — `POST /api/memory/suggest` exploite votre propre suivi de candidatures pour en dégager des schémas comportementaux et rédige des puces que vous pouvez relire et modifier. Il lit votre suivi ; il n'invente jamais de faits et ne passe aucun appel en direct.

Nouveau : `server/lib/routes/memory.mjs` (21e module de routes — `GET`/`PUT /api/memory` + `POST /api/memory/suggest`), `public/js/views/memory.js`, `PATHS.memory` et un bloc `config/memory.md` ajouté à `bundleProjectContext`. 11 nouvelles clés i18n dans les **16 locales**. Tests : `tests/memory-routes.test.mjs`.

## [1.92.0] — 2026-07-04

**CV Studio (Epic 21).** Une nouvelle page `#/cv-studio` dote votre CV de trois outils honnêtes, essentiellement locaux :

- **Diagnostic de CV** — un score déterministe de 0 à 100 avec des explications par vérification (impact quantifié, verbes faibles, mots à la mode, longueur, sections essentielles, coordonnées). Entièrement côté client (`window.CvDiagnostics`) — pas de LLM, rien d'inventé, chaque constat expliqué pour que *vous* décidiez quoi changer.
- **Masque de confidentialité** — caviardez les données personnelles (e-mail, téléphone, liens/identifiants, adresse postale et, en option, votre nom → initiales) avant de partager votre CV comme échantillon ou capture d'écran. S'exécute entièrement dans le navigateur (`window.CvPrivacy`) ; il rapporte exactement ce qu'il a caviardé et ne conserve jamais l'original.
- **Rendez-le humain / correspondance de voix** — collez une ligne ou un paragraphe rigide et réécrivez-le dans *votre* voix, ancré côté serveur dans `voice-dna.md` et `writing-samples/`. Garde-fou strict : il peut réordonner, resserrer et re-styliser, mais n'introduit jamais un fait, une métrique ou une réalisation qui ne figure pas déjà dans le texte. S'exécute en direct via la cascade de fournisseurs partagée, ou renvoie un prompt à copier-coller sans clé.

Nouveau : `server/lib/routes/cv-studio.mjs` (20e module de routes — `POST /api/cv-studio/humanize`), `public/js/views/cv-studio.js`, `public/js/lib/cv-diagnostics.js`, `public/js/lib/cv-privacy.js`, `PATHS.voiceDna` + `PATHS.writingSamplesDir`. 29 nouvelles clés i18n dans les **16 locales**. Tests : `tests/cv-diagnostics.test.mjs`, `tests/cv-studio-routes.test.mjs`. (La galerie de modèles, l'export Word et l'archivage PDF des offres sont suivis comme travaux de suivi de CV Studio.)

## [1.91.0] — 2026-07-04

**Networking et recherche approfondie sur les entreprises (Epic 16).** Une nouvelle page `#/networking` transforme une entreprise en un plan actionnable pour décrocher un entretien, ancré dans votre CV, votre profil et votre two-pager :

- **Dossier d'entreprise** — un brief resserré sur ce que fait l'entreprise, les signaux récents dignes d'être cités et les accroches « pourquoi je conviens » tirées de votre parcours réel.
- **Qui contacter** — 3 à 5 personas cibles (responsable du recrutement, recruteur interne, un IC senior de l'équipe, une connexion chaleureuse/ancien élève) avec une chaîne de recherche LinkedIn concrète pour trouver chacun. Il n'invente jamais de vrais noms.
- **La voie d'introduction la plus chaleureuse** — la route chaleureuse la plus réaliste pour *votre* parcours (employeur/école/communauté en commun, un chemin de second degré ou un DM à froid à fort signal) et pourquoi.
- **Brouillons de prise de contact** — des messages courts et spécifiques pour les principaux personas, ancrés dans vos points de preuve réels.
- **En direct ou manuel** — s'exécute en direct via la cascade de fournisseurs partagée avec n'importe quelle clé, ou renvoie un prompt prêt à copier-coller (repli honnête, rien d'inventé). **Enregistrer le plan** persiste un plan terminé dans la couche utilisateur (`networking/net-{company}-{role}-{date}.md`) ; la page liste, ouvre et supprime les plans enregistrés.

Nouveau : `server/lib/routes/networking.mjs` (19e module de routes), `public/js/views/networking.js`, `PATHS.networkingDir`. Réutilise la cascade `server/lib/llm-dispatch.mjs` de la v1.90.0. 24 nouvelles clés i18n dans les **16 locales**. Tests : `tests/networking-routes.test.mjs`.

## [1.90.0] — 2026-07-04

**Mock Interview 2.0 (Epic 15).** Une nouvelle page `#/mock-interview` transforme votre CV, votre profil, votre two-pager et votre banque d'histoires en une répétition d'entretien tour par tour :

- **Pratique conversationnelle** — indiquez un poste cible (+ entreprise / description de poste facultatives) et l'intervieweur ouvre avec une question ciblée. Chaque réponse envoyée reçoit une réponse structurée : **Feedback** (points forts + la lacune STAR+R), un **Score** (`N/5`) et une **Question suivante** qui sonde le point le plus faible de votre dernière réponse. Ancré côté serveur dans vos vrais documents — il n'invente jamais une expérience que vous n'avez pas.
- **Conscient de la banque d'histoires** — `interview-prep/story-bank.md` est intégré au prompt (même niveau de confiance que `cv.md`) pour que le feedback pointe vers vos meilleures histoires.
- **En direct ou manuel** — avec une clé de fournisseur, le tour s'exécute en direct via la cascade partagée (Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models) ; sans clé, vous obtenez un prompt prêt à copier-coller (repli honnête, aucune réponse inventée).
- **Sessions enregistrées** — cliquez sur **Enregistrer la transcription** pour conserver un entretien terminé dans la couche utilisateur (`interview-prep/mock-{company}-{role}-{date}.md`) ; la page liste, ouvre et supprime les sessions enregistrées.

Nouveau : `server/lib/routes/interview.mjs` (18e module de route), `public/js/views/mock-interview.js`, `server/lib/llm-dispatch.mjs` (cascade de fournisseurs partagée), `PATHS.storyBank`, `bundleProjectContext({ extraFiles })`. 30 nouvelles clés i18n dans les **16 langues**. Tests : `tests/interview-routes.test.mjs`.

## [1.89.0] — 2026-07-04

**Adéquation candidat-marché — le two-pager (Epic 14).** Une nouvelle page `#/two-pager` vous permet de consigner ce que *vous* voulez vraiment de votre prochain poste, sur le modèle du « Mnookin two-pager » de *Never Search Alone* :

- **Constructeur guidé** — un récit à la première personne « Qui je suis », une note « Environnement cible » et cinq éditeurs de listes de puces : **loves**, **must-haves**, **hates**, **deal-breakers** et **non-negotiables**. Enregistré dans la **couche utilisateur** du projet parent (`config/two-pager.yml`) via `PUT /api/two-pager` — jamais écrasé par les mises à jour système.
- **Assistant de remplissage IA** (`POST /api/two-pager/draft`) — construit un prompt Mnookin prêt à l'emploi avec votre CV + profil intégrés, à exécuter dans n'importe quel LLM puis à recoller. Il n'utilise que vos propres documents ; rien n'est inventé.
- **Badge d'adéquation-avec-ce-que-vous-voulez** — chaque offre sur `#/scan` affiche désormais un score d'adéquation `◎ N` (côté client, via `window.FitScore`) qui confronte le type de travail, le pays, le salaire plancher et la relocalisation de l'offre à votre two-pager. Honnête par conception : lorsqu'une offre ne fournit aucun signal comparable, **aucun badge n'est affiché** (jamais de nombre inventé). Les violations de deal-breakers pèsent plus lourd que les simples aversions.
- **Nourrit chaque évaluation** — le two-pager enregistré est intégré dans `bundleProjectContext`, de sorte que toutes les évaluations LLM en aval combinent vos préférences déclarées avec l'adéquation CV-vs-offre.

Nouveau : `server/lib/routes/two-pager.mjs`, `public/js/views/two-pager.js`, `public/js/lib/fit-score.js`, `PATHS.twoPager`. 27 nouvelles clés i18n dans les **16 locales**. Tests : `tests/two-pager-routes.test.mjs`, `tests/fit-score.test.mjs`.

## [1.88.0] — 2026-07-04

**Peaufinage de l'issue #29 — lacunes i18n du Scan + hygiène de l'API.**

- **Localisation des dernières chaînes de Scan codées en dur** (feuille de route v1.69.4) : les pastilles de résumé par source (`N nouvelles / M correspondantes`), les toasts `N nouvelles offres` et le badge `reloc` passent désormais par `t()` — 4 nouvelles clés (`scan.pillNew`, `scan.pillMatching`, `scan.newOffers`, `scan.relocBadge`) dans les **16 locales**. Les utilisateurs non anglophones ne voient plus d'anglais résiduel dans le flux de scan principal.
- **Désactivation de l'en-tête `X-Powered-By`** (feuille de route v1.69.5) : `app.disable('x-powered-by')` dans `createApp()` — le serveur n'annonce plus Express. (Le reste de cet épopée avait déjà été livré : `parentVersion` retire son commentaire release-please, le bascule de thème en mode clair, la fermeture des modales au changement de route et la localisation de « Score » (`rep.score`) dans les Rapports.)

Tests : `tests/scan-i18n-gaps.test.mjs` + une assertion d'absence de `X-Powered-By` dans `tests/security-headers.test.mjs`.

## [1.87.0] — 2026-07-04

**4 nouveaux fournisseurs de scan sans authentification (parité avec le career-ops parent v1.16.0).** Le registre du scanner passe de **41 → 45 adaptateurs** (40 EN + 5 RU) — tous publics, sans authentification, hôte épinglé, `redirect:'error'` (sûr contre le SSRF), chacun avec un test isolé pour la CI :

- **Get on Board** (`getonbrd`) — JSON:API public à l'échelle du portail (technologie LATAM/à distance), sélectionné par fournisseur, paginé. `server/lib/sources/getonbrd.mjs`.
- **Amazon** (`amazon`) — JSON de recherche public d'`amazon.jobs`, détecté par hôte ou `provider: amazon`, paginé par décalage. `server/lib/sources/amazon.mjs`.
- **Avature** (`avature`) — ATS `*.avature.net` par locataire, analysé depuis le HTML, détecté par hôte ou `provider: avature`. `server/lib/sources/avature.mjs`.
- **SAP SuccessFactors** (`successfactors`) — liste de tuiles RMK par locataire (`*.successfactors.eu/.com`, `jobs2web.com`), analysée depuis le HTML. `server/lib/sources/successfactors.mjs`.

Chacun livre un `sources/<slug>.mjs` (avec `meta` auto-découvert → menu déroulant `#/scan`) **et** un `portals/adapters/<slug>.mjs` dans `ALL_ADAPTERS` (la règle des deux registres) + `tests/sources-<slug>.test.mjs`. Le décompte d'`ALL_ADAPTERS` ainsi que les assertions d'id trié et de l'ensemble EN de `/api/scan/sources` sont passés de 36→40 ; `GET /api/scan/sources` liste désormais 45.

## [1.86.0] — 2026-07-03

**Statistiques par rôles cibles (`#/stats`) — statistiques de marché des offres et des salaires pour VOS rôles cibles.** Une nouvelle page Analytique lit vos **rôles cibles du profil** (`config/profile.yml` → non codés en dur) et les offres du dernier scan, puis affiche, par rôle et par pays :

- **Offres par pays** et **salaire médian par pays (USD)** — agrégés côté client (`public/js/lib/role-stats.js`, réutilisant `window.Countries`) à partir des données éparses que les scanners collectent déjà. Les salaires dans toute devise sont normalisés en USD via une table FX explicitement approximative, avec une mise en garde sur la taille de l'échantillon — jamais fabriqués.
- **Filtres par rôle et par pays** et graphiques en barres et de tendance en SVG inline faits main (aucune nouvelle dépendance, sûr pour la CSP — `addEventListener` uniquement).
- **Enregistrer un instantané** (`POST /api/stats/snapshot`) persiste l'agrégat actuel dans `data/role-stats.jsonl` ; le **graphique de tendance** (`GET /api/stats/trend`) suit le nombre d'offres dans le temps — la vue « dynamique ». Hybride honnête : les instantanés proviennent de données de scan locales, rafraîchies à la demande.
- Entièrement localisé dans les **16 locales** (26 nouvelles clés i18n).

Nouveau : `server/lib/routes/stats.mjs` (16e module de routes), `public/js/lib/role-stats.js`, `public/js/views/stats.js`, `PATHS.roleStats` ; tests `role-stats.test.mjs` (7) + `stats-routes.test.mjs` (5).

## [1.85.0] — 2026-07-03

**Locales allemand, italien et turc (parité de locales avec career-ops parent v1.16.0).** L'interface est désormais livrée en **16 langues** — `de` 🇩🇪, `it` 🇮🇹 et `tr` 🇹🇷 rejoignent les 13 existantes.

- **Traduction complète de l'interface** — les 730 clés i18n traduites dans `public/js/lib/locales/i18n-dict.{de,it,tr}.js` ; le sélecteur de langue liste Deutsch / Italiano / Türkçe et la détection automatique de la langue du navigateur reconnaît `de`/`it`/`tr` (`public/js/lib/i18n.js`).
- **Guide d'aide intégré** — `docs/help/{de,it,tr}.md` traduits (structure complète de 19 H2 / 75 H3), servis par `GET /api/help/:lang`.
- **Documentation** — `README.{de,it,tr}.md` et `CHANGELOG.{de,it,tr}.md` ajoutés ; le contrôle de parité des locales du CHANGELOG couvre désormais 15 locales non EN.
- **Échafaudage de prompts** — `server/lib/prompts.mjs` (`LOCALE_NAMES` + `SCAFFOLD_STRINGS`) localisé pour les trois nouvelles locales, afin que la sortie du LLM suive la langue de l'interface.

Tous les contrôles de parité (`i18n-locale-files`, `i18n-coverage`, `check-changelog-parity`, `lang-switcher-rtl`) étendus à l'ensemble de 16 locales.

## [1.84.0] — 2026-06-30

**Cooldown de recandidature + rémunération dans pipeline.md (parité avec career-ops parent v1.15.0).** Deux améliorations du scanner :

- **Cooldown de recandidature** (#1201) : le scan EN ignore désormais les rôles dans les entreprises auxquelles vous avez postulé récemment, afin que les résultats restent focalisés sur les NOUVELLES offres. Configurez des fenêtres par entreprise dans `config/profile.yml` sous `re_apply_windows:` (`last_apply_date`, `same_role_days`, `applied_to: [roles]`, `cross_role_bucket` optionnel) ; la correspondance d'entreprise est insensible à la ponctuation et basée sur des limites de mots (`server/lib/cooldown.mjs`). Désactivé si la clé est absente ; le journal de scan affiche `Cooldown skipped: N`.
- **Rémunération dans pipeline.md** (#1017) : les offres scannées sauvegardent désormais leur salaire sous forme de colonne optionnelle en fin de ligne (`url | <salary>`) dans `data/pipeline.md`. L'URL reste la clé de déduplication (la colonne `| comp` est supprimée à la lecture), la cellule est assainie (pas d'injection de lignes/colonnes, formules initiales neutralisées) et les pipelines avec URL seule restent rétrocompatibles.

Fournit `tests/cooldown.test.mjs` + tests de rémunération de pipeline. Le nombre de sources reste à 41 (les deux sont des améliorations de la logique de scan, pas de nouveaux boards).

## [1.83.0] — 2026-06-30

**Détecteur de reposts / offres fantômes (parité avec career-ops parent v1.15.0).** Un nouveau panneau **🔁 Reposts / offres fantômes** sur `#/scan` signale les clusters entreprise+rôle republiés sous des URL différentes dans une fenêtre glissante de 90 jours — signal de pipelines obsolètes et d'offres fantômes. Alimenté par un comparateur de titres de rôle fuzzy (`server/lib/role-matcher.mjs`) et un détecteur en lecture seule (`server/lib/detect-reposts.mjs`) sur `data/scan-history.tsv`, exposé via `GET /api/scan/reposts`. Aussi : `parentVersion` dans `/api/health` ne renvoie désormais que le semver (le commentaire `# x-release-please-version` de release-please est supprimé). Inclut `tests/detect-reposts.test.mjs`. Le nombre de sources reste à 41 — les reposts sont une fonctionnalité d'analyse, pas un nouveau board.

## [1.82.0] — 2026-06-30

**Source de scan NoDesk (parité career-ops v1.15.0).** Le flux RSS d'emplois à distance de [NoDesk](https://nodesk.co) est désormais une source de premier plan — ajoutez une entrée `provider: nodesk` et elle apparaît dans le menu **Source** de `#/scan` (**41 adaptateurs** au total : 36 EN + 5 RU). Hôte verrouillé sur `nodesk.co` avec `redirect:'error'` (anti-SSRF) ; les titres sont scindés sur `Role at Company` (NoDesk n'a pas de balise de localisation, donc la localisation reste vide) ; toutes les lignes sont en télétravail. Inclut une suite CI isolée `tests/sources-nodesk.test.mjs` ; suite de tests unitaires complète au vert avec 1523.

## [1.81.0] — 2026-06-29

**Parité avec le career-ops parent — 13 nouvelles sources de scan de job boards.** Porte le dernier lot de fournisseurs depuis le `main` de Fighter90/career-ops dans le scanner en processus. **APIs publiques universelles** (sélectionnées par fournisseur) : **Arbeitnow**, **Himalayas**, **Jobicy**, **Landing.jobs**, **4 Day Week**, **The Muse**, **The Hub**, **Jobspresso** (RSS) et **Hacker News "Who is hiring?"** (Algolia en deux étapes). **Boards polonais** (détectés par hôte ou `provider:`) : **JustJoin.it** et **NoFluffJobs** (recherche POST). **ATS par tenant** (auto-détectés depuis `careers_url`) : **Pinpoint** (`<slug>.pinpointhq.com/postings.json`) et **Rippling** (`ats.rippling.com/<slug>` → `api.rippling.com`). Chaque source est verrouillée par hôte avec `redirect:'error'` (anti-SSRF) et sélectionnable dans le menu **Source** de `#/scan` — le registre compte désormais **40 adaptateurs de scanner** (35 EN + 5 RU). Ajoute 13 suites de tests CI isolées par source ; suite de tests unitaires complète au vert avec 1513 tests.

## [1.80.0] — 2026-06-28

**Cinq améliorations du scan (idées de job-crawler, réimplémentées).** (1) Source **Teamtailor** — sites `<slug>.teamtailor.com` via leur flux public `/jobs.rss`, auto-détecté depuis `careers_url` (hôte verrouillé + `redirect:'error'`) ; le registre compte désormais **27 adaptateurs**. (2) **Mise en quarantaine des sources** — une source en 404/410 permanent est enregistrée dans `data/scan-quarantine.json` et ignorée aux scans suivants (auto-réparation : nouvel essai après 14 jours). (3) **Max par source** — champ optionnel sur `#/scan` limitant le nombre d'offres par board (∞ par défaut). (4) **Publié depuis** — filtre d'ancienneté côté client (24 h / 7 j / 30 j). (5) **Recherches enregistrées + ★ favoris** — nommez et réutilisez des jeux de filtres et marquez des offres, dans `localStorage` avec validation défensive (un cache corrompu se réinitialise proprement) ; le cache de résultats est réinitialisé avant chaque scan puis rempli en direct.

## [1.79.0] — 2026-06-28

**Source de scan WeWorkRemotely (parité career-ops v1.14.0).** Le flux RSS d'emplois à distance de [We Work Remotely](https://weworkremotely.com) est désormais une source de premier plan — ajoutez une entrée `provider: weworkremotely` et elle apparaît dans le menu **Source** de `#/scan` (**26 adaptateurs** au total). Hôte verrouillé sur weworkremotely.com avec `redirect:'error'` (anti-SSRF) ; les titres sont scindés sur `Company: Role`. De plus : les mots-clés `title_filter` sont désormais **rognés avant** la vérification de longueur (parent #1261).

## [1.78.2] — 2026-06-27

**Renforcement i18n et UX (correctifs après v1.78.1).** Le nom accessible du logo est désormais localisé dans les 13 langues (`nav.logoHome`). **Entrée** dans la recherche globale alors qu'on est déjà sur `#/scan` force un re-render pour ne pas perdre le terme pré-rempli (garde de même route). `health.title` est maintenant traduit en polonais (`Kondycja`) et en danois (`Systemtilstand`) — auparavant en anglais. Tests 1235 → 1238.

## [1.78.1] — 2026-06-27

**Corrections UX du Scan.** Le tableau de résultats de `#/scan` se rafraîchit désormais automatiquement pendant le scan et une fois de plus à la fin, sans rechargement. La recherche globale affiche un indice **Entrée** et, pour une requête non-URL, saute vers `#/scan` avec le champ pré-rempli (auparavant `#/tracker`). Le logo renvoie maintenant au tableau de bord (accueil).

## [1.78.0] — 2026-06-27

**Filtre géographique sur la page Scan — filtrez les résultats par pays, avec drapeaux.** Un nouveau menu **Pays** dans `#/scan` liste chaque pays détecté dans vos résultats (emoji drapeau + compteur), pour ne garder que les postes liés à un pays — aux côtés du filtre Remote/Hybrid/Onsite, afin de chercher du travail lié à un pays comme en télétravail. Reposant sur un nouvel utilitaire `countries.js` qui mappe la localisation en texte libre (noms de pays, alias et ~100 grandes villes) vers un pays ISO + drapeau ; la détection est prudente et ne devine jamais.

## [1.77.0] — 2026-06-27

**Danois (Dansk) ajouté comme 13e langue de l’interface.** Traduction complète de l’UI, du guide d’aide intégré (19 H2 / 75 H3), du README et du CHANGELOG. Le danois rejoint le sélecteur de langues à drapeaux ; la mécanique i18n (assembleur, audit, contrôles de parité, snapshot) couvre désormais 13 locales.

## [1.76.0] — 2026-06-26

**Parité avec career-ops v1.13.0 — six nouvelles sources, renforcement du scanner et tableau de résultats sans plafond.**

### Ajouté
- **Six sources ATS par locataire** — BambooHR, Breezy HR, Comeet, Personio, Recruitee, SolidJobs. Détectées via l’hôte de `careers_url` (Comeet exige l’`api:` complet) ; chaque hôte est verrouillé par un regex ancré + `redirect:'error'` (anti-SSRF). Sélectionnables dans le menu **Source** de `#/scan` — le registre compte désormais **25 adaptateurs** (20 EN + 5 RU). Ajoute un helper `fetchText` pour le flux XML de Personio.
- **`trust_filter`** — score de confiance optionnel (0–100, niveau high/medium/low, drapeaux), purement annotatif. Les lignes sous `high` reçoivent un badge ⚠ neutre dans `#/scan` ; rien n’est jamais écarté.
- **Arbeitsagentur `remoteMatch` + `remoteMaxPages`** — détection du télétravail pilotée par config : `title`, `filter` (`homeoffice=nv_true` côté serveur + pagination) ou `off`.

### Modifié
- **Plus de plafond de résultats.** `MAX_STORED_RESULTS` (2000) supprimé — toutes les correspondances sont stockées et le tableau `#/scan` les pagine (200/page).
- **Robustesse du filtre de titre** — les sigles courts (COO, SDR…) correspondent aux limites de mots ; une config `title_filter` malformée ne casse plus le scan. Les deux scanners.

### Tests
- +32 cas (1190 → **1222**) : `sources-ats-providers`, `title-filter`, `arbeitsagentur-remote`, `trust-validator` et un garde `scan-result-cap` réécrit (« sans plafond »).

## [1.75.2] — 2026-06-19

**docs : parité documentaire complète pour les agrégateurs du scanner de la v1.75.0 dans les 12 langues.** Aucun changement de code — aligne la documentation destinée à l'utilisateur sur les sept sources arrivées en v1.75.0 :

- **Guide d'aide (12 langues).** §5 gagne un bloc `content_filter` (gating par mots-clés de description/extrait, frère de `location_filter`) et une note sur les agrégateurs ; §7 énumère les sept nouvelles sources dans le balayage de scan en un clic et dans l'énumération complète de la liste déroulante **Source** ; le décompte d'adaptateurs de §17 est corrigé de l'obsolète « 11 adapters » vers « 19 adapters — 14 English + 5 Russian ». Aucun en-tête `##`/`###` n'a été ajouté, de sorte que la structure verrouillée de 19 H2 / 75 H3 reste inchangée.
- **README (9 langues complètes).** Nouvelle puce « Aggregator boards (v1.75.0) » sous les sources de scan, plus le badge de version porté à v1.75.2. (Les README abrégés pl/uk/ar n'ont pas de liste par source et restent volontairement intacts à cet endroit.)
- **Documentation de référence.** `docs/portals-examples.md` gagne une section « Aggregator boards » prête à copier-coller avec des blocs de configuration `provider:` / `<provider>:` précis pour les sept ; `docs/PROJECT.md` mis à jour à **19 adapters** ; `docs/sdd/CONVENTIONS.md` documente la distinction des deux registres (`sources/registry.mjs` pour la liste déroulante contre `portals/registry.mjs` pour le fetching), la sélection d'agrégateur basée sur `provider:` acheminée en tant que `opts.company`, le sanitiseur d'écriture de scan (`scan-sanitize.mjs`) et le nombre de tests de la v1.75.1 (1190).
- **QA.** Ajout de `qa/QA-REGRESSION-PROMPT-v1.75.2-FULL.md` — le pilote de porte de publication pleine surface, rafraîchi pour le cycle d'agrégateurs de scan de la v1.75.x.

---



## [1.75.1] — 2026-06-19

**fix(scan) : peaufinage de robustesse sur les sources pilotées par configuration de la v1.75.0.** Trois petits correctifs de durcissement issus de la revue post-publication (aucun changement de comportement pour un scan sain) :

- **Délais de pagination tenant compte de l'abandon.** Les pauses de courtoisie inter-pages de Glints (300 ms) et de Jobstreet/SEEK (200 ms) se résolvent désormais immédiatement lorsque l'`AbortSignal` du scan se déclenche, via un nouvel utilitaire `delay(ms, signal)` dans `server/lib/http-json.mjs`, de sorte qu'un client déconnecté ne puisse pas maintenir un scan paginé ouvert pendant une pause supplémentaire.
- **Erreur descriptive pour les réponses non JSON.** `fetchJson` enveloppe désormais un corps `2xx` non JSON (p. ex. une page HTML de maintenance servie avec le statut 200) sous la forme `non-JSON 2xx response from <url>` au lieu de faire remonter un `SyntaxError` nu, de sorte que le journal d'erreurs par source du scanner nomme le point de terminaison fautif.
- **Normalisation d'écriture de scan renforcée.** `normalizeScanScalar` réduit désormais la tabulation verticale, le saut de page et les séparateurs de ligne/paragraphe Unicode (`\v \f U+2028 U+2029`) en plus de `\r \n \t` — un sur-ensemble strict, de sorte qu'aucun séparateur d'enregistrement/de ligne qu'un tableur ou un visualiseur pourrait honorer ne survive jusque dans `scan-history.tsv`.

---


## [1.75.0] — 2026-06-19

**feat(scan) : porte la parité avec le career-ops parent v1.12.0 — sept nouvelles sources d'offres, filtrage de contenu et corrections de sécurité/qualité.** La web-ui exécute ses propres scanners in-process (elle ne délègue pas au `scan.mjs` du parent), de sorte que les changements de fournisseur et de scan du parent v1.12.0 ne se propagent pas automatiquement — cette version réimplémente ceux qui s'appliquent selon le contrat d'adaptateurs de la web-ui.

- **Sept nouvelles sources de scanner.** Trois agrégateurs distants couvrant tout le tableau d'offres — **RemoteOK**, **Remotive**, **Working Nomads** — s'insèrent dans le motif auto-découvert `server/lib/sources/*.mjs` (sélectionnés avec `provider: remoteok` / `remotive` / `workingnomads`). Quatre agrégateurs régionaux pilotés par configuration — careers d'**IBM**, **Arbeitsagentur** (Agence fédérale allemande pour l'emploi), **Glints** (Asie du Sud-Est), **Jobstreet / SEEK** — lisent un bloc de configuration `<provider>:` par entrée ; l'en-scanner fait désormais transiter l'entreprise résolue jusqu'à chaque fetcher afin qu'ils puissent la lire. Les sept apparaissent automatiquement dans la liste déroulante des sources de `#/scan`.
- **`content_filter` (parent #974).** Bloc `portals.yml` optionnel (listes de mots-clés `positive` / `negative`) qui filtre une offre selon le texte de sa description/extrait — reflète la sémantique de `location_filter` ; les offres sans description passent toujours. Branché dans les deux scanners EN et RU.
- **Durcissement de l'écriture de scan (parent #1098).** Les métadonnées des flux externes sont désormais assainies avant d'atterrir dans `data/scan-history.tsv` et `data/pipeline.md` : les caractères de contrôle sont réduits (un saut de ligne dans le nom d'entreprise/intitulé ne peut plus injecter une ligne TSV) et un `= + - @` en tête est neutralisé contre l'injection de formules de tableur.
- **`secondaryLocations` d'Ashby (parent #1073).** La source Ashby replie désormais l'étiquette de région de chaque localisation secondaire ainsi que les `addressLocality` / `addressCountry` postaux dans la chaîne de localisation (dédupliquée), de sorte qu'un poste éligible à l'UE dont l'étiquette principale indique p. ex. « Canada » remonte pour le `location_filter`.
- **Validation de la forme du rapport d'évaluation (parent #819).** Les fournisseurs in-process de `/api/evaluate` (Anthropic / OpenAI / Qwen / OpenRouter / GitHub Models) signalent désormais un rapport A–G / `SCORE_SUMMARY` malformé via un tableau `warnings` non fatal ; le chemin d'évaluation Gemini hérite déjà du garde-fou du `gemini-eval.mjs` du parent.
- **docs :** Antigravity CLI ajouté aux listes d'assistants pris en charge dans les 12 READMEs (correspond au fournisseur Gemini).

Hérité gratuitement du `git pull` du parent (la web-ui délègue à ceux-ci) : repli de polices CJK pour les PDF japonais (#1053), polices PDF compatibles ATS (#1074), garde-fou CJK pour LaTeX (#1054), corrections tracker/merge/followup/dashboard, et les modes chinois `modes/zh` (la web-ui liste les modes dynamiquement).

---


## [1.74.3] — 2026-06-18

**docs(parent-source): pointe le dépôt parent `career-ops` vers le fork [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops).** La web-ui référence désormais le fork du mainteneur comme projet parent partout où c'est une source réelle : la valeur par défaut `CAREER_OPS_REPO` de l'installeur `bin/setup.sh`, chaque lien `git clone` / « au-dessus de » / onboarding dans les 12 READMEs, et la documentation des agents (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `docs/`). Le crédit à l'auteur santifer (et l'avertissement d'interface non officielle) est inchangé — seules les URL de source/clonage ont changé. `tests/sh-files.test.mjs` vérifie maintenant que l'installeur clone le fork.

---


## [1.74.2] — 2026-06-17

**fix(health): exposer `GITHUB_MODELS_API_KEY` comme vérification optionnelle sur `#/health` et dans `/api/status/providers`.** Le fournisseur GitHub Models de la v1.74.0 était configurable dans `#/config` mais n'avait pas de ligne sur la page Santé et était absent de la surface de fournisseurs `keysConfigured`. Ajout de la vérification optionnelle (même formulation "set / unset (manual mode)" que les cinq autres fournisseurs d'évaluation en direct) et de `github` (+ son `GITHUB_MODELS_MODEL`) à `/api/status/providers`, de sorte que le routage du fournisseur actif et la page Santé reflètent désormais les six. Le test de ligne de santé de `tests/api.test.mjs` a été étendu aux six fournisseurs.

---



## [1.74.1] — 2026-06-17

**docs + test: section README « Installer un assistant IA » ; couverture complète des branches pour le connecteur Gemini.** Ajout d'un tableau d'installation/connexion dans le README — liens d'installation pour Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI + la correspondance de fournisseur `#/config` de chacun + « connectez-vous avant de continuer » (reflète le démarrage rapide de career-ops.org/docs ; précise que la web-ui est l'alternative autonome ne nécessitant pas de CLI). Le nouveau `tests/gemini-connector.test.mjs` (8 cas) couvre chaque branche de `runGemini` — sans clé, succès, erreur d'API, complétion vide/bloquée, corps malformé, délai d'attente dépassé, erreur réseau, `hasGeminiKey` — portant `server/lib/gemini.mjs` à 100 % d'instructions. Couverture globale : 96 % lignes / 88 % branches / 96 % fonctions. Suite 1126 → 1134.

---



## [1.74.0] — 2026-06-17

**feat(llm): GitHub Models (Copilot) comme 6e fournisseur + alignement canonique des 6 assistants.** career-ops.org/docs répertorie six assistants de codage IA — Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI. La web-ui prend désormais en charge les six : cinq correspondent à des fournisseurs actifs existants (Anthropic / Gemini / OpenAI / Qwen / OpenRouter), et GitHub Copilot CLI bénéficie d'un connecteur dédié à GitHub Models — `runGitHubModels` (OpenAI-compatible ; un PAT GitHub avec la portée `models`), configurable dans `#/config` (`GITHUB_MODELS_API_KEY` + `GITHUB_MODELS_MODEL`) et sélectionnable via `LLM_PROVIDER=github` ; 6e dans l'ordre auto. Les bundles d'aide et les README listent désormais les six canoniques (Qwen CLI renommé en Qwen Code ; Gemini CLI + GitHub Copilot CLI ajoutés), et le README ajoute une table complète de référence des modes et de liens d'adaptateurs de portails vers career-ops.org/docs afin que chaque fonctionnalité soit traçable jusqu'au projet parent. `tests/llm-provider-context.test.mjs` étend la matrice de frontière de récupération aux six fournisseurs (`cv.md` + `profile.yml` intégrés + artefact retourné) ; les nouvelles clés `GITHUB_MODELS_*` sont ajoutées aux 12 dictionnaires de paramètres régionaux. Suite 1125 → 1126.

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

Les entrées détaillées pour la v1.54.x et toutes les versions antérieures vivent dans le [🇬🇧 CHANGELOG anglais](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md), qui fait foi. Points de repère :

- **v1.43.0** · Verbe `open` + script multi-plateforme pour faire passer le navigateur au premier plan.
- **v1.42.0** · Correction de la route morte `#/portals` → lien profond vers la config.
- **v1.40.0** · Balayage d'actualisation de la documentation sur les 8 locales.
- **v1.31.0** · Champs **Model** et **Start from #** exposés sur `#/batch` (flags `--model` / `--start-from` du batch runner).
- **v1.29.2** · Le bouton 🌐 Scan unique pilote les phases ATS + régionale dans un seul flux SSE.
- **v1.15.0** · Réalignement des blocs de rapport sur le schéma canonique career-ops.org (A–F).
- **v1.12.0** · Début de la localisation des entrées de changelog par langue.
- **v1.10.0** · Éditeur `#/profile` + UX d'import de CV, parité d'aide multi-locale, sélecteur de locale.

Pour l'historique complet, voir [🇬🇧 CHANGELOG.md](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md).
