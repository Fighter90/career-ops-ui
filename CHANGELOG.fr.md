# Journal des modifications

Tous les changements notables de **career-ops-ui**. Format selon [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versionnage [SemVer](https://semver.org/lang/fr/).

Traductions : [English](CHANGELOG.md) · [Español](CHANGELOG.es.md) · [Português](CHANGELOG.pt-BR.md) · [한국어](CHANGELOG.ko-KR.md) · [日本語](CHANGELOG.ja.md) · [Русский](CHANGELOG.ru.md) · [简体中文](CHANGELOG.zh-CN.md) · [繁體中文](CHANGELOG.zh-TW.md) · [Polski](CHANGELOG.pl.md) · [Українська](CHANGELOG.uk.md) · [Dansk](CHANGELOG.da.md) · [العربية](CHANGELOG.ar.md)

> **Note i18n** — depuis la v1.12.0, les entrées sont localisées dans chaque langue. Les entrées plus anciennes (v1.11.x, v1.10.x) résident dans le [CHANGELOG anglais](CHANGELOG.md), qui fait foi.

> **Note de traduction (v1.61.0)** — le français a été ajouté comme 9e langue de l'interface. Ce fichier traduit les entrées récentes ; pour l'historique antérieur à la v1.55.0, voir le [CHANGELOG anglais](CHANGELOG.md), qui reste la source normative.

---


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
