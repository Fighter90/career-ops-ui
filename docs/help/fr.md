# Aide — career-ops-ui

Une présentation complète de chaque page, du moment où vous lancez
l'application jusqu'à l'obtention d'un entretien. Chaque titre `##`
ci-dessous correspond à une entrée de la barre latérale ou à une phase
du flux de travail. Lisez de haut en bas au premier lancement ; revenez
plus tard à une section précise via la table des matières dans la barre
latérale de l'aide.

> **Public visé :** toute personne qui vient de déposer cette UI dans un
> checkout `career-ops` et a lancé `bash bin/start.sh`. Aucune
> connaissance préalable de career-ops n'est supposée.

### About career-ops

[career-ops](https://career-ops.org) est un système open-source de
recherche d'emploi qui s'exécute sous forme de commandes slash dans
n'importe quel CLI de codage IA (Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI
— d'autres CLI compatibles Claude fonctionnent aussi via la même surface
de commandes slash). Indépendant du modèle. Il évalue chaque offre par
rapport à votre CV selon une grille à six dimensions notée de 0.0 à 5.0,
génère des CV PDF sur mesure, et suit chaque candidature localement sur
votre machine.

**Référence canonique (à lire dans l'ordre à la première installation) :**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — le système, ses principes et l'inventaire des concepts.
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — découvrir des offres ; alimenter le Pipeline.
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — flux de soumission complet avec lecture de formulaire Playwright.
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — noter 10+ offres d'un coup via `batch-runner.sh`.
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — installer Chromium + enregistrer le MCP pour le PDF et le remplissage de formulaires.

**Principes fondateurs** (d'après
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)) :

- **Open source, pour de vrai** — MIT, pas de palier payant, pas de
  liste d'attente, pas de télémétrie, pas de comptes. Le système
  fonctionne sans paliers payants, sans comptes ni télémétrie. Les
  contributions de code passent par une revue communautaire avant
  publication.
- **Souveraineté des données** — `cv.md`, `config/profile.yml`, `data/`,
  `reports/`, `interview-prep/` ne quittent jamais votre ordinateur sauf
  si vous les poussez explicitement. Vous l'exécutez localement sur votre
  machine, en conservant une pleine souveraineté des données.
- **Architecture agnostique vis-à-vis de l'IA** — career-ops n'embarque
  PAS de modèle. Il fonctionne comme des commandes au sein de CLI de
  codage IA existants. Changez de fournisseur (Anthropic ↔ Gemini ↔
  OpenAI) et votre historique d'évaluations reste cohérent.
- **Soumissions contrôlées par l'humain** — career-ops rédige les
  réponses et ouvre le formulaire, mais **c'est vous qui cliquez sur
  Envoyer**. Le système ne postule jamais automatiquement. Il fournit la
  structure et l'évaluation ; l'humain garde l'autorité finale de
  soumission.
- **Recherche structurée** — conçu pour une recherche d'emploi active et
  délibérée avec de nombreuses candidatures ; ce n'est pas un outil de
  soumission unique, ni un moteur de recommandation. La configuration
  prend ~15 minutes et suppose une aisance avec le terminal.

**Ce que career-ops N'EST PAS** (non-objectifs explicites) :

- Pas un auto-postulateur. Il ne soumettra pas les formulaires à votre
  place.
- Pas un reconstructeur de CV. Il adapte par offre ; il n'invente pas
  d'expérience.
- Pas un optimiseur LinkedIn. Votre profil vous regarde.
- Pas un substitut de tableur caché derrière une UI SaaS. Les données
  sont du markdown brut sur votre système de fichiers.

**Concepts clés** (inventaire complet — chaque artefact que career-ops touche) :

| Concept | De quoi il s'agit |
|---|---|
| **Mode** | Un modèle de prompt sous `modes/<slug>.md`. Intégrés : `oferta`, `deep`, `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`, `ofertas`, `auto-pipeline`, `pdf`, `latex`, `scan`, `tracker`. |
| **Archetype** | Un profil de poste cible dans `config/profile.yml`. La grille pondère les correspondances de compétences par rapport à l'archétype actif — **le champ le plus important**. |
| **Pipeline** | `data/pipeline.md` — boîte de réception des URL d'offres en attente d'évaluation. |
| **Tracker** | `data/applications.md` — tableau GFM historique de chaque évaluation + statut de candidature. |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — évaluation A–F complète par offre, avec score + légitimité dans l'en-tête. |
| **Scan history** | `data/scan-history.tsv` — journal en ajout seul ; évite les doublons entre scans. |
| **Proof points** | Blocs de preuves STAR+R extraits de `cv.md`, réutilisés dans l'évaluation, les réponses de candidature et la préparation d'entretien. |
| **JD store** | `jds/jd-<date>-<ts>.txt` — descriptions de poste verbatim sauvegardées lors de l'évaluation pour la traçabilité. |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — dossiers de recherche approfondie et fiches récapitulatives par tour. |
| **Batch additions** | `batch/tracker-additions/*.tsv` — lignes en attente mises en file par `batch-runner.sh` pour fusion dans le tracker. |

### career-ops vs career-ops-ui (this app)

| | career-ops (CLI) | career-ops-ui (cette application) |
|---|---|---|
| Où il s'exécute | dans Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI | `http://127.0.0.1:4317` dans votre navigateur |
| Surface | commandes slash `/career-ops <mode>` | barre latérale avec une page par flux de travail |
| Remplissage de formulaire | oui, via Playwright MCP | non — génère la checklist, vous terminez dans le CLI |
| PDF | `generate-pdf.mjs` | `📄 Generate PDF` sur `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep` |
| Fichiers de données | partagés avec career-ops-ui | partagés avec career-ops |

career-ops-ui n'apporte **que des ajouts**. Rien à l'intérieur de
`career-ops/` ne change. Les deux surfaces partagent les mêmes `cv.md`,
`config/profile.yml`, `portals.yml`, `data/`, `reports/`,
`interview-prep/`, `modes/`.

### Action thresholds by score

Une fois qu'une offre a une évaluation, le score détermine la suite
(tableau canonique de
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)) :

| Score | Étape suivante |
|---|---|
| **≥ 4.5** | Lancez `/career-ops apply` — forte adéquation, foncez tout de suite. |
| **4.0 – 4.4** | Postulez, ou `/career-ops contacto` pour une intro chaleureuse d'abord. |
| **3.5 – 3.9** | Lancez `/career-ops deep` — recherchez l'entreprise / le poste avant de décider. |
| **< 3.5** | Passez, sauf raison personnelle précise. |

Le `#/dashboard` et le `#/tracker` de career-ops-ui mettent en évidence
chaque ligne à 4.0 ou au-dessus pour que vous puissiez choisir une action
sans rien relancer.

### External docs

La référence complète du moteur career-ops sous-jacent (scan, grille
d'évaluation, traitement par lot, flux de candidature, configuration
Playwright) est sur
[career-ops.org/docs](https://career-ops.org/docs) :

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. Quick start — pas à pas complet, de « créer le CV » à « postulé & contacté »

Voici le manuel canonique, bouton par bouton. Suivez-le dans l'ordre la
première fois. Chaque étape nomme la route exacte, le bouton exact, et ce
que vous verrez en cas de succès. Les sections 2 à 16 ci-dessous
détaillent chaque phase.

> **Lancement & init en une commande.** Depuis un terminal, vous pouvez
> faire tout le bootstrap sans toucher à l'UI :
>
> ```bash
> career-ops-ui setup      # install deps → doctor → run the server
> career-ops-ui init       # pick LLM provider + paste its key (echo suppressed)
> career-ops-ui doctor     # re-verify any time (exit 0 ⇔ all required green)
> career-ops-ui run        # just launch the server at http://127.0.0.1:4317
> career-ops-ui open       # open + RAISE the dashboard tab in your browser
> ```
>
> Après `setup`/`run`, l'onglet du navigateur est ouvert **et mis au
> premier plan** automatiquement (v1.43.0) ; `career-ops-ui open` fait de
> même à la demande, pour ne jamais avoir à chercher l'onglet du tableau
> de bord. `NO_OPEN=1` désactive l'ouverture auto pour les démarrages
> headless/CI.
>
> `setup` exécute toute la chaîne lui-même. `init` écrit la clé dans le
> `career-ops/.env` parent via le même chemin validé que l'onglet clés-API
> de `#/config`, et définit `LLM_PROVIDER` (`auto` | `claude` | `gemini`)
> que respectent les routes live evaluate / deep / mode / auto-pipeline.
> Forme CI :
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`.
> Vous préférez l'UI ? Continuez avec les étapes ci-dessous.

### A. Setup (à faire une fois, ~5 minutes)

**career-ops-ui doit se trouver à `career-ops/web-ui/`** (imbriqué dans le projet career-ops parent). Il lit vos `cv.md`, `config/` et `data/` depuis le dossier parent via `../` et ne fonctionne pas de manière autonome. Si `career-ops-ui init` n'est pas trouvé après un pull, exécutez `cd career-ops/web-ui && npm install && npx career-ops-ui init`.

**Étape 1 — Ouvrez l'application sur `http://127.0.0.1:4317`.** Si elle ne
tourne pas, dans un terminal lancez `bash bin/start.sh` depuis la racine du
dépôt. Le Tableau de bord (`#/dashboard`) se charge.

**Étape 2 — Cliquez sur `❤ Health` dans la barre latérale gauche.** Chaque
vérification requise doit être verte :

- `cv.md`, `config/profile.yml`, `portals.yml` existent
- Clé API définie (au moins l'une de `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`)
- Playwright installé (requis uniquement si vous utilisez Generate PDF)

Si quelque chose est rouge, la page vous indique le fichier ou la variable
d'environnement exacte à corriger. Ne continuez pas tant que Health n'est
pas verte.

**Étape 3 — Cliquez sur `⚒ App settings` dans la barre latérale.** Vous
arrivez sur l'onglet **API keys & runtime**.
- Collez `ANTHROPIC_API_KEY` (préféré — meilleure notation des textes longs)
  et/ou `GEMINI_API_KEY`. Obtenez les clés sur
  <https://console.anthropic.com/settings/keys> ou
  <https://aistudio.google.com/apikey>.
- Cliquez sur **💾 Save**. Puis cliquez sur **▶ Test Anthropic** (ou
  Gemini) — un aller-retour minimal confirme que la clé fonctionne.

**Étape 4 — Passez à l'onglet `Profile` sur la même page.** C'est
l'éditeur YAML direct de `config/profile.yml`. Modifiez au minimum :
- `candidate.full_name` — remplacez tout texte indicatif (« Jane Smith »)
  par votre vrai nom
- `candidate.email`, `linkedin`, `github` — utilisés dans les lettres de
  motivation
- `target.roles` — les intitulés de poste auxquels vous postulerez
- `target.comp_total_min_usd` — rémunération totale minimale ; les offres
  en dessous sont signalées en section D de chaque évaluation
- `target.archetypes` — les schémas de carrière que vous acceptez (le champ
  le plus impactant)

Cliquez sur **💾 Save**. Le serveur valide le YAML et appose l'en-tête
canonique `# Career-Ops Profile Configuration`.

### B. CV (à faire une fois, ~10 minutes)

**Étape 5 — Cliquez sur `✎ CV` dans la barre latérale.** Deux colonnes :
l'éditeur à gauche, l'aperçu en direct à droite.

**Étape 6 — Choisissez une voie pour remplir l'éditeur :**
- **Importer un CV existant** — cliquez sur **📁 Upload CV**, choisissez
  l'un de `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`. Le
  serveur convertit en markdown via pandoc ou pdftotext, neutralise le XSS,
  et dépose le résultat dans l'éditeur. **Vérifiez la conversion** — les
  PDF surtout peuvent perdre en fidélité de mise en page.
- **Coller du markdown directement** — la zone de texte est un éditeur
  markdown ; le volet de droite est ce que le LLM (et votre futur
  recruteur) verra.
- **Conseils de ton :** une puce = une réalisation avec une métrique.
  Restez sous 1500 mots. Sections dans cet ordre : Résumé, Expérience,
  Projets, Formation, Compétences.

**Étape 7 — Cliquez sur `💾 Save` (en haut à droite de la page CV).** Le
serveur neutralise (`<script>` / `javascript:` / gestionnaires inline
supprimés) et écrit `cv.md`. Toast : *« Saved »*.

**Étape 8 (facultatif) — Cliquez sur `📄 Generate PDF`.** Lance
`generate-pdf.mjs` dans le parent (Playwright requis) et **le nouveau PDF
se télécharge automatiquement** dans votre navigateur une fois terminé. La
liste en bas de page conserve tous les fichiers générés précédemment.

### C. Find vacancies (~2 minutes par scan)

**Étape 9 — Cliquez sur `🌐 Scan` dans la barre latérale.** Vérifiez que
`portals.yml` liste les sites qui vous intéressent (section 5 de cette
aide). Appuyez sur le bouton **🌐 Scan now**. Un journal SSE en direct
défile pendant que le scanner parcourt Greenhouse / Ashby / Lever /
Workable / SmartRecruiters / Workday (sites anglophones) et hh.ru / Habr
Career (sites russes si activés).

**Étape 10 — Quand le scan se termine, examinez les résultats.** Cliquez
sur un tag d'entreprise pour filtrer ; cliquez sur l'icône ↗ pour ouvrir la
page carrières de l'entreprise dans un nouvel onglet. Chaque offre qui a
survécu au filtre de titre est mise en file dans le Pipeline.

### D. Score the offers (~30 secondes par offre)

**Étape 11 — Cliquez sur `Pipeline` dans la barre latérale.** Vous voyez
chaque URL mise en file par le scanner. Cliquez sur une entrée pour
prévisualiser l'offre en ligne.

**Étape 12 — Cliquez sur `▶ Evaluate` à côté d'une offre.** Cela vous
amène à `#/evaluate`. Avec une clé API définie, l'évaluation est en direct ;
sans clé, vous obtenez un prompt manuel à coller dans votre propre LLM. Le
mode live produit un **score 0–5** par rapport à votre CV sur les sections
A–G (Rôle / Entreprise / Rémunération / Risque / Dépassement / Adéquation
culturelle / Verdict). L'enregistrement va dans `reports/<date>-<slug>.md`.

**Étape 13 — Cliquez sur `Reports` dans la barre latérale** et examinez la
dernière évaluation. Tout ce qui est sous votre `comp_total_min_usd` est
signalé en rouge en section D. Tout ce qui porte `Verdict: pursue` est
votre liste restreinte.

### E. Decide & deeply research the shortlisted company (~3 minutes)

**Étape 14 — Choisissez une offre qui mérite d'être poursuivie. Cliquez
sur `Deep research` dans la barre latérale.** Saisissez le nom de
l'entreprise et le poste. Le modèle produit un dossier d'entreprise en 7
sections (mission, actualités récentes, stack technique, signaux
d'embauche, repères de rémunération, risques, angle recommandé).
L'enregistrement va dans `interview-prep/<company>-<role>.md`.

### F. Apply (~5 minutes par candidature)

**Étape 15 — Cliquez sur `Apply checklist` dans la barre latérale.** Collez
l'URL de l'offre + l'offre. L'assistant génère une checklist de soumission
pas à pas :
- Brouillon de lettre de motivation sur mesure (utilise vos `cv.md` +
  `profile.yml`)
- Mots-clés précis à reprendre de l'offre
- Fichiers à joindre (CV PDF — voir étape 8)
- Où postuler (l'URL carrières canonique, pas les redirections
  d'agrégateurs)
- Rappel : **NE JAMAIS soumettre automatiquement** — la revue finale et la
  soumission sont toujours manuelles.

**Étape 16 — Ouvrez la page carrières dans un nouvel onglet.** Utilisez la
checklist de candidature comme liste de tâches. Soumettez via le vrai
formulaire de l'entreprise. Joignez le PDF généré à l'étape 8.

**Étape 17 — Contactez un véritable humain.** Ouvrez le mode **Outreach**
(`#/contacto` dans la barre latérale). Le modèle rédige un court message
LinkedIn / e-mail adapté au dossier d'entreprise de l'étape 14.
Personnalisez l'accroche (un détail précis de votre dossier de recherche).
Envoyez-le.

### G. Track & follow up (en continu)

**Étape 18 — Cliquez sur `Tracker` dans la barre latérale** et ajoutez une
ligne pour la candidature : entreprise, poste, score, statut `Applied`,
lien vers le rapport, lien vers le dossier de recherche. La date est
remplie automatiquement.

**Étape 19 — Une semaine plus tard : ouvrez le mode `Follow-up`**
(`#/followup`). Rédige un e-mail de relance poli faisant référence à la
candidature initiale. Envoyez. Mettez le statut du tracker à `Followed up`.

**Étape 20 — Quand vous recevez une invitation à un entretien, lancez le
mode `Interview prep`** (`#/interview-prep`). Génère une préparation ciblée
pour l'entreprise + l'étape précises (system design / comportemental /
coding). S'appuie automatiquement sur le dossier de recherche.

**Étape 21 — Offre obtenue ? Mettez le statut du Tracker à `Offer`** et
revoyez la section rémunération de votre rapport d'évaluation — votre
montant minimal d'acceptation est juste là.

### TL;DR — l'ordre de la barre latérale suit le flux de travail

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

Voilà. 21 étapes, bouton par bouton, de zéro à l'offre.

### One-click Auto-pipeline (`#/auto`) — le raccourci des 21 étapes

Si vous voulez juste noter rapidement une offre précise, sautez le
parcours manuel. **Barre latérale → ✨ Auto-pipeline** (ou le bouton ✨ du
Tableau de bord) ouvre un écran dédié : collez l'URL de l'offre, appuyez
sur **Entrée** ou cliquez sur **▶ Run full pipeline**, et le serveur
exécute toute la chaîne en une passe observable :

1. **Validating URL** — vérification anti-SSRF (`isValidJobUrl`) ; rejette
   loopback / `file:` / IP privées / caractères de script.
2. **Fetching job description** — `safeGet` (DNS épinglé, redirections
   revalidées) récupère + neutralise l'offre.
3. **Evaluating against your CV** — Anthropic (préféré) → repli Gemini →
   prompt manuel si pas de clé.
4. **Saving report** — écrit `reports/<slug>.md` avec score + légitimité
   dans l'en-tête.
5. **Adding to tracker** — ajoute une ligne à `data/applications.md`.

Le retour en direct est un **stepper** vertical (chaque étape s'allume
running → done / failed). C'est une liste ordonnée avec `aria-current` sur
l'étape active et une région live polie pour lecteur d'écran annonçant
chaque transition. En cas de succès, la carte de résultat renvoie
directement au rapport enregistré (**View report · N/5**) et au
**tracker**. Une étape échouée est marquée en rouge avec son message et le
bouton se réactive pour corriger l'URL et réessayer sans recharger.

**Pas de clé API ?** Le pipeline s'exécute en **mode manuel** : les étapes
3 à 5 se replient et vous obtenez une carte de prompt prête à coller (copier
dans Claude Code / Anthropic / Gemini). Aucun appel LLM en direct, aucune
dépense.

`#/auto` est partageable : `#/auto?url=<encoded>&go=1` ouvre l'écran et
démarre automatiquement. Le bouton ✨ du tableau de bord et cette entrée de
barre latérale arrivent tous deux ici (flux unique cohérent — la modale
transitoire d'avant 1.34 a été promue en cette page).
> **CLI (v1.38.0).** Une commande fait la chaîne : `career-ops-ui setup` (bootstrap → install → start). Verbes autonomes : `career-ops-ui doctor` (vérification env/clés/outils — même moteur que la page Health ; exit 1 sur tout échec requis), `career-ops-ui run`, `career-ops-ui init` (assistant fournisseur+clé, v1.39.0).
> **Providers (v1.39.0).** L'onglet clés-API ajoute un sélecteur `LLM_PROVIDER` (`auto` = défaut Anthropic→Gemini · `claude` · `gemini`) et un champ `OPENAI_API_KEY` (côté CLI Codex/OpenCode). `career-ops-ui init` est un assistant interactif équivalent.
>
> **Providers (v1.57.0).** L'évaluation live headless couvre désormais **Anthropic → Gemini → OpenAI → Qwen → OpenRouter** (l'ordre `auto` ; `LLM_PROVIDER` en épingle un). **OpenRouter** — une `OPENROUTER_API_KEY` donne accès à 300+ modèles ; le menu `OPENROUTER_MODEL` charge le catalogue live d'OpenRouter (proxy côté serveur, repli hors-ligne curé). Corrigé aussi : les clés collées avec un retour à la ligne / des espaces autour sont désormais nettoyées avant validation, donc `/#/config` n'affiche plus « validation failed » pour aucun fournisseur.



---

## 2. App settings & API keys (`#/config`)

> **Nouveau en v1.55 → v1.56.** Sans **aucune** clé LLM, une bannière rouge sur chaque écran explique que ⚡ Run-live est en mode prompt-manuel et renvoie ici ; une fois une clé définie, elle devient une puce discrète nommant le fournisseur actif. Avant tout bouton ⚡ Run-live (`#/auto`, `#/evaluate`, `#/deep`, modes), une estimation honnête du coût s'affiche (p. ex. « Estimated cost: OpenAI gpt-5-codex · ~$0.04/eval », ou une note « pas de coût API » en mode manuel). `#/scan` range les filtres secondaires derrière un volet **Advanced filters** ; `#/tracker` ajoute des puces d'entonnoir cliquables + une pagination côté serveur optionnelle ; `#/pipeline` virtualise au-delà de 1000 lignes.

Trois onglets :

1. **API keys & runtime** — formulaire structuré sur le `.env` du projet
   parent (le même fichier que lisent les scripts Node career-ops au
   démarrage). Groupé : API keys / Runtime / Regional sources. L'onglet
   expose aussi des sélecteurs de modèle par fournisseur — `OPENAI_MODEL`
   (OpenAI/Codex) aux côtés de `ANTHROPIC_MODEL` et `GEMINI_MODEL`.
2. **Profile** — **formulaire champ par champ** sur `config/profile.yml`
   (web-ui 1.32.0). L'enregistrement **fusionne** dans le fichier — vos
   archétypes, proof points et toute clé personnalisée sont préservés
   intacts.
3. **Modes** — **formulaire structuré** pour `modes/_profile.md`
   (web-ui 1.54.3), dérivé du schéma documenté. Les sections de type liste
   — **Target Roles / Adaptive Framing / Comp Targets** — s'affichent comme
   des champs répétables (ajout/suppression de lignes) ; les sections en
   prose — **Exit Narrative / Location Policy** — s'affichent comme des
   textareas étiquetées ; toute section inconnue ou non-liste retombe sur
   une textarea verbatim étiquetée. L'enregistrement **fusionne par
   section** — le préambule, les sections intactes et les sections
   personnalisées sont préservés à l'octet près. Un volet *Advanced: raw
   markdown* reste disponible pour les éditions plein fichier —
   ajout/suppression de sections ou édition du préambule.

Un enregistrement dans n'importe quel onglet se propage immédiatement —
pas de redémarrage du serveur.

**Configurer votre fournisseur LLM (pas à pas).** L'évaluation live ⚡ de l'UI web tourne *headless* et utilise une seule clé API. Elle fonctionne par « OU » — définissez **n'importe laquelle** et ça marche ; avec plusieurs, `auto` les préfère dans cet ordre : Anthropic → Gemini → OpenAI → Qwen. (career-ops lui-même est agnostique du CLI — vous l'exécutez aussi dans Claude Code, Codex, Gemini, OpenCode, Qwen, Copilot ou Kimi ; c'est distinct de cette clé headless.)

1. Ouvrez `#/config` → l'onglet **API keys & runtime**.
2. Choisissez votre fournisseur dans **`LLM_PROVIDER`** : `auto` (utilise la clé définie), ou forcez-en un avec `claude` / `gemini` / `openai` / `qwen`.
3. Renseignez la clé + le modèle du fournisseur choisi :
   - **Anthropic** — définissez `ANTHROPIC_API_KEY` (console.anthropic.com), éventuellement `ANTHROPIC_MODEL` (défaut `claude-sonnet-4-6`).
   - **Gemini** — définissez `GEMINI_API_KEY` (aistudio.google.com/apikey), éventuellement `GEMINI_MODEL` (défaut `gemini-2.0-flash`).
   - **OpenAI** — définissez `OPENAI_API_KEY` (platform.openai.com), éventuellement `OPENAI_MODEL` (défaut `gpt-5-codex`).
   - **Qwen** — définissez `QWEN_API_KEY` (Alibaba Model Studio / DashScope, dashscope.console.aliyun.com), éventuellement `QWEN_MODEL` (défaut `qwen-max`). Pour l'endpoint Chine continentale, définissez `QWEN_BASE_URL` dans le `.env` brut.
4. Cliquez sur **Save**. Les clés s'écrivent dans le `.env` du projet parent ; le changement prend effet immédiatement — pas de redémarrage.
5. Vérifiez sur `#/evaluate` : collez une URL/description d'offre et appuyez sur **⚡ Run live**. L'en-tête du résultat indique quel fournisseur a tourné (`anthropic` / `gemini` / `openai` / `qwen`). Aucune clé définie nulle part → vous obtenez le prompt manuel à copier-coller.

Les secrets sont masqués après enregistrement et jamais journalisés. Les champs d'identifiant de modèle (`*_MODEL`) ne sont pas secrets.

### Profile tab (field form — v1.32.0)

Avant la v1.32.0, cet onglet était une unique textarea YAML brute où chaque
réglage vivait dans un bloc indifférencié. C'est désormais un formulaire
structuré, champs groupés en trois sections repliables :

- **Candidate** — Nom complet (requis), E-mail, Téléphone, Localisation,
  LinkedIn, GitHub, URL de portfolio, X / Twitter.
- **Narrative** — Accroche, Récit de départ.
- **Compensation** — Fourchette cible, Devise, Minimum de rupture,
  Flexibilité de localisation.
- **Éditeurs de tableaux structurés** (web-ui 1.35.0) — éditeurs
  ajout/suppression de lignes pour les champs de type liste, pour que même
  ceux-ci n'aient plus besoin du YAML brut : **Target roles** +
  **Superpowers** (listes de chaînes) ; **Archetypes** (lignes name / level
  / fit) ; **Proof points** (lignes name / url / hero-metric). Les lignes
  vides sont supprimées ; une liste vidée retire proprement la clé. Même
  garantie fusion-pas-remplacement — chaque tableau que vous ne touchez pas
  survit intact.

Pourquoi l'enregistrement est sûr :

- Le formulaire n'envoie que les 14 chemins scalaires modélisés sous forme
  `{ fields: { "candidate.full_name": … } }`. Le serveur **lit le
  `config/profile.yml` existant, définit/efface seulement ces feuilles, et
  re-sérialise tout l'objet** — donc les tableaux imbriqués que le
  formulaire ne modélise pas (`target_roles.archetypes`,
  `narrative.proof_points`, `narrative.superpowers`) et toute clé
  personnalisée ajoutée à la main **survivent à l'aller-retour intacts**.
  Vider un champ retire proprement cette clé (pas de résidu `phone: ""`).
- La validation exige toujours un nom complet ; l'en-tête `# Career-Ops
  Profile Configuration` est apposé automatiquement.
- Un compromis : un enregistrement par formulaire **re-sérialise le YAML,
  donc les commentaires inline `#` sont perdus**. Pour préserver les
  commentaires ou éditer des tableaux imbriqués, utilisez le volet
  **Advanced: edit raw YAML** en bas de l'onglet — c'est l'éditeur plein
  fichier d'avant la 1.32, inchangé (remplace tout le fichier à
  l'enregistrement).
- Le résumé en lecture seule de `#/profile` est le compagnon visuel.

### Recognized keys

| Key | What it does | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Active les appels live au SDK Anthropic. Préféré quand Anthropic + Gemini sont tous deux définis — meilleure sortie structurée longue pour la notation d'offres et la recherche approfondie. | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | Remplace le défaut `claude-sonnet-4-6`. Essayez `claude-opus-4-7` pour un raisonnement plus dur, `claude-haiku-4-5-20251001` pour rapide-et-pas-cher. | — |
| `GEMINI_API_KEY` | Repli quand pas de clé Anthropic. Utilisé par `gemini-eval.mjs` pour le mode `oferta`. Le palier gratuit suffit à faible volume. | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | Remplace le modèle Gemini par défaut. | — |
| `(server uses default UA)` | Requis pour lancer des scans `hh.ru` hors de Russie (l'API renvoie 403 sur un User-Agent nu). Enregistrez une app sur <https://dev.hh.ru/admin> et utilisez sa chaîne UA. | dev.hh.ru |
| `PORT` | Port d'écoute Express. Défaut 4317. | — |
| `HOST` | Adresse d'écoute. Défaut `127.0.0.1`. Mettre `0.0.0.0` expose l'UI sur le LAN — **pas encore de barrière d'authentification**, voir le doc Production-readiness. | — |

### Behavior

- **Read** (`GET /api/config`) renvoie chaque clé reconnue. Les clés
  secrètes (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) sont **masquées** — vous
  voyez `sk-ant•••••••a1b2`, jamais la valeur complète.
- **Save** (`POST /api/config`) valide chaque valeur, écrit dans
  `<parent>/.env`, et applique immédiatement au processus en cours. Pas de
  redémarrage.
- **Une valeur vide supprime** la clé. Utile pour cesser d'utiliser une
  IP / un VPN russe.

### Smoke-test buttons

Après l'enregistrement, cliquez sur **▶ Test Anthropic** ou **▶ Test
Gemini** — les deux envoient un prompt minuscule (≤256 tokens en sortie)
donc vous ne dépensez quasiment rien tout en confirmant que la clé est bien
câblée. Renvoie un échantillon d'~200 caractères en cas de succès.

---

## 3. Profile (`#/profile` — also reachable as `#/settings`)

Une vue résumé en lecture seule de `config/profile.yml`. **Pour éditer**,
allez dans **App settings → onglet Profile** (`#/config` → Profile) — depuis
web-ui 1.32.0 c'est un formulaire champ par champ (Candidate / Narrative /
Compensation), pas un bloc YAML brut. Les enregistrements fusionnent dans le
même fichier ; cette page se re-parse au rechargement.

Les champs qui comptent le plus :

- `candidate.full_name` — utilisé dans chaque prompt. **Remplacez le modèle
  `Jane Smith`** avant de scanner quoi que ce soit pour de vrai, sinon vos
  lettres de motivation générées partiront sous le nom indicatif.
- `candidate.email`, `linkedin`, `github` — référencés dans la génération de
  lettre de motivation et la checklist de candidature.
- `target.roles` — intitulés de poste acceptés. Le filtre positif du scanner
  l'utilise implicitement (via `portals.yml::title_filter`).
- `target.comp_total_min_usd` — rémunération totale minimale. La section D de
  chaque évaluation signale les offres en dessous.
- `target.archetypes` — le *champ le plus important*. Ce sont les schémas de
  carrière que vous acceptez (p. ex. `Tech-Lead-Backend`,
  `Founding-Engineer`, `Data-Platform`). Chaque offre est comparée à eux et
  le meilleur archétype atterrit dans l'en-tête du rapport.

La page Health expose une vérification **Profile customized** qui échoue
tant que `full_name` correspond à un nom indicatif connu.

---

## 4. CV (`#/cv`)

Source unique de vérité pour chaque évaluation, recherche approfondie et
lettre de motivation. Vit dans `cv.md` à la racine du projet parent.

### Editing options

- **Le coller directement** — la textarea de gauche est un éditeur
  markdown. Le volet de droite reflète ce que voit le LLM (et votre futur
  recruteur).
- **📁 Upload CV** — choisissez un fichier local dans l'un de ces formats et
  le serveur le convertit en markdown pour vous :
  - **Formats texte** — `.md`, `.markdown`, `.txt`, `.html`, `.htm` sont
    passés tels quels (le HTML passe par pandoc → markdown GFM).
  - **Formats Office** — `.docx`, `.doc`, `.odt`, `.rtf` sont convertis via
    **pandoc** (`brew install pandoc` sur macOS, `apt install pandoc` sur
    Linux).
  - **PDF** — `.pdf` est extrait via **pdftotext** de Poppler
    (`brew install poppler` / `apt install poppler-utils`).
  - Le markdown converti atterrit dans l'éditeur ; cliquez sur **💾 Save**
    pour persister. Le résultat est neutralisé (même nettoyage XSS que le
    collage).
  - Plafond strict : **10 Mo** par import. Fichiers plus gros → 413.
- **Depuis LinkedIn** — voie la plus simple : ouvrez Claude Code dans le
  projet parent, lancez `/career-ops`, collez l'URL de votre LinkedIn, et
  demandez `extract my CV from this and write it to cv.md`.

### What gets sanitized

Côté serveur, chaque PUT vers `/api/cv` passe par `stripDangerousMarkdown` :

- balises `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<style>`,
  `<form>` — entièrement retirées.
- Gestionnaires d'événements inline (`onclick=`, `onerror=`, etc.) —
  supprimés.
- Schémas d'URI `javascript:`, `vbscript:`, `data:text/html` — neutralisés.

La réponse inclut `sanitized: true` dès que l'un des éléments ci-dessus a
été retiré, pour que vous sachiez si la source contenait quelque chose de
malveillant.

Taille max du corps : 1 Mo. Au-delà → 413.

### Other buttons

- **sync-check** — lance `cv-sync-check.mjs` dans le projet parent. Signale
  les incohérences : un projet listé dans votre CV mais pas dans les
  archétypes de `data/applications.md`, etc.
- **📄 Generate PDF** — diffuse `generate-pdf.mjs`. La sortie atterrit dans
  `output/*.pdf`. Nécessite Playwright (la page Health indique s'il est
  installé dans le `node_modules` du parent). Une fois la génération
  terminée, le PDF **le plus récent** est téléchargé automatiquement dans
  votre dossier Téléchargements par défaut ; la liste de la page conserve
  tous les fichiers générés précédemment.

### Tone / format tips

- Une puce = une réalisation avec une métrique. *« Réduit la latence p99 de
  38 % »* bat *« amélioré les performances »* pour toute grille
  d'évaluation.
- Sections dans cet ordre : **Résumé** (3–5 lignes), **Expérience**
  (anti-chronologique), **Projets** (max 5), **Formation**, **Compétences**
  (dédoublonnées, pas de soupe de mots-clés).
- Restez sous 1500 mots. La grille de notation utilise une info dense ; un
  CV tentaculaire est pénalisé pour le bruit.

---

## 5. Portals & sources (`portals.yml`)

La config du scanner vit dans `portals.yml` à la racine parente. Trois
sections comptent. Les trois sections de la SPA (ci-dessous) correspondent
1:1 au schéma canonique career-ops.org de
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals).

> **Raccourci :** l'URL `#/portals` se résout désormais directement vers
> **App settings** et (quand une source régionale est configurée) saute au
> groupe **Regional sources** — donc un lien `#/portals` mis en favori ou
> tapé ne renvoie plus de 404 (v1.42.0).

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

Une offre scannée passe quand son titre contient **au moins un mot-clé
positif** ET **aucun mot-clé négatif**. Réglez les deux. Les mots-clés sont
des sous-chaînes insensibles à la casse.

`seniority_boost` est la troisième clé du title-filter. Les mots-clés listés
ici ne filtrent rien — ils poussent les offres correspondantes plus haut
dans les résultats, pour qu'un « Senior Backend Engineer » passe au-dessus
d'un « Engineer ». Défaut : `["Senior", "Staff", "Lead"]`. Réglez selon
l'intitulé de vos postes cibles.

Commencez avec 3–5 mots-clés positifs pour la clarté ; élargissez plus tard.

### `location_filter` (optional — web-ui 1.33.0, parent #570)

```yaml
location_filter:
  allow:
    - "Remote"
    - "United States"
    - "Atlanta"
  block:
    - "India"
    - "London"
    - "Germany"
```

Filtre les offres scannées par leur chaîne de **localisation** (sous-chaîne
insensible à la casse), appliqué par la passe ATS et la passe régionale.
Sémantique, identique au `scan.mjs` canonique de career-ops :

- Pas de clé `location_filter` → toute localisation passe (défaut).
- Une offre avec une localisation **vide/manquante** → passe (une donnée
  manquante n'est pas pénalisée).
- Une correspondance de mot-clé `block` → **rejetée** (block prime sur
  allow).
- `allow` vide → passe (block l'a déjà filtrée).
- `allow` non vide → doit correspondre à **au moins un** mot-clé.

Clé de premier niveau dans `portals.yml` (sœur de `title_filter`, non
imbriquée sous `russian_portals`). Utilisez-la pour écarter les offres qui
ont survécu au title-filter mais sont dans une région que vous ne pouvez
pas prendre.

Commencez avec 3–5 mots-clés positifs pour la clarté ; élargissez plus tard.

**`content_filter` (optionnel — web-ui 1.75.0, parent #974).** Une clé de premier niveau sœur de `location_filter`, avec les mêmes listes de mots-clés `positive` / `negative`, mais comparée au texte de la **description / de l'extrait** d'une offre plutôt qu'à sa localisation :

```yaml
content_filter:
  positive: ["python", "machine learning"]
  negative: ["security clearance", "on-site only"]
```

Sémantique identique à `location_filter` : pas de clé → tout passe ; une offre avec une description **vide/manquante** passe (une donnée manquante n'est pas pénalisée) ; une correspondance `negative` → rejetée ; `positive` vide → passe ; `positive` non vide → doit correspondre à au moins un mot-clé (sous-chaîne insensible à la casse). Appliqué à la fois par la passe ATS et par les passes régionales. Seules les sources qui livrent une description/un extrait (p. ex. RSS) sont concernées — toute autre offre passe — donc l'activer ne supprime jamais silencieusement des lignes des sources qui ne portent pas de corps. Utilisez-la pour écarter une offre qui a survécu au title-filter mais dont le corps révèle un facteur rédhibitoire.

### `search_queries`

```yaml
search_queries:
  - name: "Greenhouse — Rails Engineer"
    query: 'site:job-boards.greenhouse.io "Rails Engineer" OR "Ruby on Rails" remote'
    enabled: true
  - name: "Ashby — Senior Backend"
    query: 'site:jobs.ashbyhq.com "Senior Backend" remote'
    enabled: false
```

`search_queries` pilote le scan IA Option B (`/career-ops scan` dans Claude
Code / Codex). Elles ne sont PAS exécutées par le `npm run scan` in-process
(qui ne touche que les API publiques des sites). Utilisez-les pour découvrir
des postes dans des entreprises pas encore dans `tracked_companies`. Mettez
`enabled: false` pour garder une entrée sans l'exécuter.

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

Champs requis par entrée : `name` et `careers_url`. Optionnels : `api`
(endpoint Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
explicite), `enabled: true|false` pour inclure/exclure sans supprimer
l'entrée. Le scanner ATS détecte l'ATS depuis le motif d'URL
(`job-boards.greenhouse.io/<slug>` → Greenhouse, etc.) et récupère la
boards-api publique de chaque entreprise directement. Les entreprises sans
ATS reconnaissable sont ignorées (la carte **Active Companies** sur `/#/scan`
les affiche en gris avec `○`).

### `rss` (RSS / Atom boards)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

Pointez le scanner vers n'importe quel site d'emploi publiant un flux RSS/Atom (LaraJobs, WeWorkRemotely, RemoteOK, golangprojects, …) en ajoutant une entrée avec `provider: rss` et une clé `rss:` (ou `feed_url:`) — **sans modification de code**. L'adaptateur RSS analyse chaque `<item>` (CDATA + entités HTML, titres/entreprises nettoyés des balises), le normalise en offre, et applique le même flux `title_filter` / `location_filter` + déduplication + ajout au pipeline que les sources ATS. **RSS** apparaît ensuite comme source sélectionnable dans le menu de filtre de `#/scan`. (web-ui v1.62.x)


### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # or just one
  area: 113                 # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries` sont des correspondances de sous-chaînes insensibles à la casse
sur les titres d'offres de hh.ru et Habr Career. **Attention au
chevauchement avec la liste négative** — si `"Senior PHP"` est dans
`queries` mais `"php"` finit dans `title_filter.negative`, le scan ne
renverra aucun résultat et la console vous avertira du conflit.


### Configuring Russian portals — detailed setup guide

La v1.29.0 livre 5 adaptateurs russophones. Deux n'ont besoin de rien de
plus que l'UA par défaut (`habr-career`, scrape HTML ; `trudvsem`, API
open-data gouvernementale — pas de clé, pas de barrière IP). Deux sont des
scrapes HTML de sites tech (`getmatch`, `geekjob` — sans clé non plus). Un
est l'API canonique hh.ru qui peut renvoyer 403 depuis des IP non russes
sauf si vous définissez une variable `HH_USER_AGENT` via **App settings →
API keys & runtime** (ou lancez le serveur depuis une IP / un nœud de sortie
VPN russe).

#### Source inventory

| Source key | Display label | Type | Auth | Geo restriction |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | optional `HH_USER_AGENT` | non-RU IPs may 403 |
| `habr` | Habr Career | HTML | none | none |
| `trudvsem` | Trudvsem | JSON API (open-data) | none | none |
| `getmatch` | GetMatch | HTML | none | none |
| `geekjob` | GeekJob | HTML | none | none |

#### Step 1 — Open `portals.yml`

Le fichier vit dans la racine parente `career-ops/` (PAS dans `web-ui/`).
S'il n'existe pas encore, copiez l'exemple livré avec le projet parent :

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### Step 2 — Enable all 5 sources

Ajoutez ou mettez à jour le bloc `russian_portals` pour lister chaque source
à scanner. L'ordre dans le tableau est sans importance ; le scanner les
parcourt dans l'ordre du registre.

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]
  area: 113                  # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50               # how many vacancies per query per source
  only_remote: false         # set true to keep only remote postings
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Backend Senior"
    - "Тимлид PHP"
```

#### Step 3 — Tune queries and filters

`queries` sont les chaînes que le scanner utilise pour chercher sur chaque
source. Chaque requête s'exécute une fois sur chaque source — donc 4
requêtes × 5 sources = 20 appels par scan. Gardez la liste ciblée (3–7
requêtes) pour garder le temps de scan sous une minute. `area` est le code
de région hh.ru (les autres sources l'ignorent). `per_page` plafonne le
nombre d'offres renvoyées par source et par requête. `only_remote: true`
filtre chaque résultat en remote-only au niveau de l'adaptateur (le tableau
de résultats garde une puce Remote distincte).

#### Common pitfalls

**Collision avec la liste négative.** Si un mot d'une requête (`"php"`,
`"senior"`) apparaît aussi dans `title_filter.negative`, chaque résultat est
filtré avant que vous le voyiez. Le scanner émet un avertissement de
collision sur stderr au moment du scan — cherchez la ligne `⚠ config: query
"Senior PHP" contains "php" which is in the negative list`. Corrigez en
retirant le mot en conflit de `negative` :

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### Disabling one source temporarily

Pour désactiver une source sans supprimer ses données, retirez simplement sa
clé de `sources` :

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### Verifying the setup

Après avoir enregistré `portals.yml` :

```bash
# 1. Save portals.yml.
# 2. In the SPA, switch to #/scan.
# 3. Click 🌐 Scan now.
# 4. Watch the SSE log for the per-source line per query:
#       "Senior PHP"
#         hh.ru    18
#         habr     21
#         trudvsem  3
#         getmatch  0
#         geekjob   2
#    A value of 0 is normal for some queries — it just means that
#    source had no matches. A "geo-blocked" or "timeout" line means
#    the adapter reached the site but couldn't read results.
```

### CLI bootstrap flow ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Le setup canonique career-ops (à lancer une fois depuis la racine parente) :

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

C'est tout le bootstrap. Éditez les trois sections (`title_filter`,
`tracked_companies`, `search_queries`, optionnellement `russian_portals`),
enregistrez, et vous êtes prêt à scanner.

### SPA bootstrap behavior

Au premier lancement, le serveur ajoute un bloc `russian_portals:` documenté
à `portals.yml` s'il manque — idempotent (le second démarrage est sans effet
car la ligne littérale `russian_portals:` est désormais là). Les sections
anglaises ne sont PAS auto-injectées ; elles viennent du
`templates/portals.example.yml` que vous avez copié selon le bootstrap
canonique ci-dessus.

---

## 6. Health (`#/health`)

Chaque barrière de configuration, en badges OK / OPTIONAL / FAIL. Lisez ceci
avant d'ouvrir tout ticket « ça ne marche pas ».

### Required checks (system can't function without these)

- `Node version` ≥ 18 — le serveur utilise les `fetch` et `node:test`
  natifs.
- `Project root` — que `CAREER_OPS_ROOT` (env ou auto-détecté) existe.
- `cv.md`, `config/profile.yml`, `portals.yml`, `data/applications.md`,
  `data/pipeline.md`, `modes/oferta.md`.

### Optional checks (warnings only)

- `Profile customized` — `candidate.full_name` n'est pas le nom indicatif du
  modèle.
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — définies dans `.env`.
- `(server uses default UA)` — ne compte que si vous scannez hh.ru hors de
  Russie.
- `Playwright (parent node_modules)` — requis pour la génération PDF et
  `check-liveness.mjs`. Installez avec
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`.
- `Parent project dependencies` — `cd $CAREER_OPS_ROOT && npm install` si
  manquant.
- répertoires `data/`, `reports/`, `output/`, `jds/` — créés
  automatiquement à la première écriture.

Quand le serveur est exposé au-delà de loopback (`HOST=0.0.0.0`), les chemins
absolus et la version Node exacte sont remplacés par `"hidden"` dans la
réponse pour qu'un voisin curieux ne puisse pas identifier votre
installation.

### Run buttons

- **▶ Doctor** lance `node doctor.mjs` et affiche la sortie dans une modale.
- **▶ Verify pipeline** lance `node verify-pipeline.mjs`.

---

## 7. Scan (`#/scan`)

Le scanner parcourt chaque site activé, déduplique par rapport à votre
historique, et écrit les trouvailles dans `data/last-scan.json` et
`data/pipeline.md`.

### One-click scan (SPA)

**🌐 Scan** exécute chaque source activée en une seule passe :

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (la passe
  ATS) pour chaque entreprise de `tracked_companies` avec une URL ATS
  reconnaissable.
- Les agrégateurs de la v1.75.0 pour chaque entrée de `tracked_companies` qui
  en active un : RemoteOK / Remotive / Working Nomads (flux remote couvrant
  tout le board, `provider: <slug>`) et IBM / Arbeitsagentur / Glints /
  Jobstreet · SEEK (pilotés par config, bloc `<provider>:` par entrée).
- API hh.ru + Habr Career + Trudvsem + GetMatch + GeekJob pour chaque
  requête de `russian_portals`.

**Deux phases, un clic (v1.29.2).** Le bouton 🌐 Scan unique pilote À LA FOIS
la passe ATS et la passe régionale dans un seul flux SSE. Vous verrez deux
en-têtes de phase dans le journal, dans l'ordre :

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — sites ATS EN.
2. `▶ Regional scan (hh.ru + Habr Career)` — 5 sources RU du registre.

Chaque phase se termine par un résumé `✓ done · NEW=N`. Si vous ne voyez que
la phase ATS, votre instance est sur un build d'avant la v1.29.2 — mettez à
jour. Avant la v1.29.2, le client SSE se fermait au premier événement `done`
et la phase régionale était silencieusement abandonnée
(`tests/scan-stream-multi-phase.test.mjs` est le filet de régression).

Le journal SSE en direct défile dans le volet de droite pendant le scan.
Cliquez sur **Stop** (ou naviguez ailleurs) pour interrompre — le serveur
annule les requêtes HTTPS en cours via `AbortController`.

### Filtering results

Sous le journal, le tableau de résultats affiche les lignes de
`data/last-scan.json`.

> **v1.78.1 — rafraîchissement automatique en direct.** Le tableau de résultats
> se met désormais à jour automatiquement pendant qu'un scan tourne et une fois
> de plus juste après la fin — sans rechargement manuel ni changement de page.

> **v1.80.0 — Max par source & mise en quarantaine des sources.** Le champ
> **Max par source** à côté du bouton Scan plafonne le nombre d'offres que
> chaque board contribue (vide/0 = illimité, la valeur par défaut) — pratique
> quand un board énorme dominerait autrement. Par ailleurs, toute source qui
> renvoie un **404 / 410** permanent est écrite dans
> `data/scan-quarantine.json` et ignorée lors des scans suivants
> (auto-réparation : réessayée après 14 jours), pour que les slugs morts cessent
> de polluer le journal. Désactivez avec `scan_quarantine: false` dans
> `portals.yml`.

Filtres :

- **Texte libre** — correspondance de sous-chaîne sur le titre / l'entreprise.
- Menu déroulant **Source** — Arbeitsagentur / Ashby / BambooHR / Breezy HR /
  Comeet / GeekJob / Glints / Greenhouse / GetMatch / Habr Career / hh.ru / IBM /
  Jobstreet · SEEK / Lever / Personio / Recruitee / RemoteOK / Remotive / RSS /
  SmartRecruiters / SolidJobs / Teamtailor / Trudvsem / We Work Remotely / Workable / Workday / Working Nomads
  (auto-rempli depuis `GET /api/scan/sources`).
- Menu déroulant **Remote / Hybrid / Onsite**.
- Menu déroulant **Country** (v1.78.0) — un filtre géographique alimenté par les pays détectés dans les résultats actuels, chacun affiché avec son emoji de drapeau et un décompte (p. ex. `🇩🇪 Germany (12)`). Choisissez-en un pour ne garder que les postes liés à ce pays. La détection mappe la localisation en texte libre d'une offre (noms de pays/alias + ~100 grandes villes du marché de l'emploi) vers un pays ; elle est prudente et ne devine jamais, de sorte qu'une offre dont la localisation ne peut être résolue — ou une annonce purement « Remote » — reste sous **All countries**. Combinez-le avec le menu déroulant de type de travail pour trouver des postes liés à un pays *et* à distance.
- Menu déroulant **Publié depuis** (v1.80.0) — un filtre d'ancienneté côté client (Dernières 24 heures / 7 jours / 30 jours). Les lignes dont la `pubDate` est plus ancienne sont masquées ; les lignes **sans date indiquée passent** (l'absence de donnée n'est pas pénalisée).
- **★ Favoris** (v1.80.0) — cliquez sur le ☆ d'une ligne pour mettre une offre en favori (stocké dans `localStorage` par URL) ; cochez **★ Favoris** dans le panneau de filtres pour n'afficher que les lignes favorites. Les favoris survivent aux scans et aux rechargements.
- **Recherches enregistrées** (v1.80.0) — la barre au-dessus des filtres : nommez le jeu de filtres actuel et **💾 Enregistrer**, puis ré-appliquez-le depuis le menu déroulant ou **🗑 Supprimer**-le. Stocké dans `localStorage` ; une valeur corrompue/modifiée se réinitialise proprement à vide.
- **Puces de stack** (PHP / Go / Backend / Senior / …) — auto-détectées par
  ligne par `Skills.detectTech` et `Skills.detectLevel`. Intersection
  multi-sélection — choisir `PHP + Senior` montre les lignes qui ont les
  DEUX.
- **Puces dynamiques** sous les puces de stack statiques — les 25 tokens
  capitalisés les plus fréquents des titres, pour que l'UI s'adapte aux
  postes que vous scannez réellement (marketing, design, finance…) au lieu
  d'être verrouillée au vocabulaire backend-engineer.

### Active Companies card

Une carte repliable listant chaque entreprise de `portals.yml` avec son
statut de scan :

- tag vert ✓ — support API direct (Greenhouse / Ashby / Lever / Workable /
  SmartRecruiters / Workday).
- tag gris ○ — repli sur un prompt de recherche web (pas de correspondance
  API).

**Cliquez sur le nom de l'entreprise** → remplit le filtre de résultats
ci-dessus avec ce nom. **Cliquez sur l'icône ↗** → ouvre le `careers_url` de
l'entreprise dans un nouvel onglet.

### CLI scan flow ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Deux façons de scanner côté CLI (les deux déposent les URL dans le même
`data/pipeline.md` que lit la SPA) :

**Option A — script direct (~30 s, zéro token IA) :**

```bash
npm run scan                          # all Greenhouse/Ashby/Lever boards
npm run scan -- --dry-run             # preview without persisting
npm run scan -- --company Anthropic   # narrow to one tracked company
```

Fonctionne uniquement pour Greenhouse / Ashby / Lever / Workable /
SmartRecruiters / Workday (URL ATS reconnaissables). Aucun token IA consommé
— il touche directement les API publiques des sites.

**Option B — scan navigateur piloté par l'IA :**

```
/career-ops scan
```

Dans Claude Code / Codex / Cursor / Gemini CLI. Utilise des tokens de modèle.
Visite chaque page `tracked_companies` directement et peut découvrir des
sites non-API (pages carrières, ATS personnalisés, portails régionaux). Plus
lent mais plus large. Utile quand une passe ATS ne renvoie rien pour une
cible que vous savez en train de recruter.

**Sortie (les deux voies)** — nouvelles URL d'offres ajoutées à
`data/pipeline.md`, chaque URL visitée journalisée dans
`data/scan-history.tsv` (dédup sur tous les scans futurs), résumé imprimé :
entreprises scannées · offres trouvées · filtrées par titre · doublons
ignorés · nouvelles offres ajoutées.

**Seuils d'action par score** (à appliquer après que `/career-ops pipeline`
note en lot les nouvelles URL) :

| Score | Étape suivante recommandée |
|---|---|
| **≥ 4.5** | `/career-ops apply` — forte adéquation, foncez tout de suite |
| **4.0 – 4.4** | postulez, ou `/career-ops contacto` pour une intro chaleureuse |
| **3.5 – 3.9** | `/career-ops deep` — recherchez d'abord |
| **< 3.5** | passez sauf raison personnelle précise |

Le `#/dashboard` et le `#/tracker` de la SPA mettent en évidence chaque
ligne à 4.0 ou au-dessus pour choisir une action sans rien relancer.

### Follow-up commands

Après la notation, les suites canoniques sont :

- `/career-ops apply` — Remplir la candidature avec des réponses sur mesure
- `/career-ops contacto` — Rédiger une prise de contact LinkedIn / e-mail
- `/career-ops deep` — Rechercher l'entreprise / le poste en profondeur
- `/career-ops tracker` — Voir le statut du pipeline

---
### hh.ru — récupéré depuis le site web (sans configuration ni proxy)

hh.ru est scanné en lisant son site public de recherche (`hh.ru/search/vacancy`), de la même façon que Habr Career : **fonctionne depuis n'importe quelle IP, sans clé, proxy ni configuration.** L'API JSON (`api.hh.ru`) n'est volontairement *pas* utilisée : elle renvoie désormais `403 forbidden` à tout client programmatique quels que soient l'IP ou le User-Agent (un blocage anti-bot en périphérie, pas une erreur d'API documentée), tandis que le site sert des résultats complets à tout client de type navigateur. hh.ru fonctionne donc exactement comme Habr et Trudvsem — il suffit de le laisser dans `russian_portals.sources` et de lancer le scan.

## 8. Pipeline (`#/pipeline`)

Boîte de réception des URL en attente d'évaluation. Vit dans
`data/pipeline.md`.

### Adding URLs

Trois façons :

- Tapez / collez une URL dans le champ + cliquez sur **+ Add**.
- Utilisez la **recherche globale de la barre supérieure** (son badge affiche
  **Enter**) : collez n'importe quel lien `http(s)://…` et appuyez sur **Enter**
  pour ouvrir l'auto-pipeline ; tapez tout autre texte et **Enter** saute vers
  `#/scan` avec ce terme pré-rempli (v1.78.1). Ctrl/Cmd+K continue de focaliser
  le champ là où le navigateur le permet. Le **logo** de marque renvoie au
  tableau de bord.
- Lancez un Scan (voir ci-dessus) — les nouvelles trouvailles vont au
  pipeline automatiquement.

Chaque URL passe par `isValidJobUrl()` côté serveur. Loopback (`localhost`,
`127.0.0.1`), `file://`, `javascript:`, les IP littérales, et les chaînes
avec des caractères de modèle (`<`, `>`, `"`) renvoient toutes 400.

### Server-side preview pane

Cliquez sur une ligne du pipeline pour charger un aperçu à droite. La plupart
des sites ATS n'envoient pas d'en-têtes CORS, donc le navigateur ne peut pas
les récupérer directement ; le serveur relaie la requête, retire les balises
`<script>` / `<style>` / HTML, et renvoie jusqu'à 8 Ko de texte brut.

Le proxy d'aperçu suit les redirections manuellement avec une **validation
SSRF par saut** — chaque en-tête `Location` repasse par `isValidJobUrl()`,
donc un site hostile ne peut pas vous renvoyer vers loopback / IP privée /
`file://`. Plafonné à 3 sauts, délai de 15 secondes.

### Row actions

- **▶** — saute à `#/evaluate?url=…` avec l'URL pré-remplie.
- **✕** — retire l'URL de `data/pipeline.md`.

### Top-right buttons

- **⚡ Evaluate first** — ouvre la première URL en file sur la page Evaluate,
  prête à noter.
- **Scan** — retour au scanner si vous voulez plus d'URL.

---

## 9. Evaluate (`#/evaluate`)

Note une seule description de poste par rapport à `cv.md` et
`config/profile.yml`. Renvoie une évaluation structurée A–G selon
`modes/oferta.md` plus un score 0–5.

### Input

Collez l'offre dans la textarea, ou arrivez ici depuis `#/pipeline` avec
`?url=<href>` — la page récupère l'URL via le même proxy anti-SSRF utilisé
pour les aperçus du pipeline et pré-remplit la textarea.

Cliquez sur **💾 Save JD** pour persister l'offre dans
`jds/jd-<date>-<ts>.txt` pour la traçabilité (ou passez `save: true` dans
l'appel API — même effet).

### Fallback chain

1. **Anthropic** — préféré quand `ANTHROPIC_API_KEY` est définie. Le serveur
   regroupe `cv.md`, `config/profile.yml`, `modes/_shared.md` et
   `modes/oferta.md` dans un bloc `<project_context>` avant le prompt (chaque
   fichier plafonné à 16 Ko, prompt complet plafonné en douceur à 200 Ko).
   Renvoie du markdown ancré directement à la page.
2. **Gemini** — quand seule `GEMINI_API_KEY` est définie. Le serveur lance
   `gemini-eval.mjs` avec l'offre en fichier temporaire. Le modèle du palier
   gratuit (`gemini-2.0-flash`) convient à une notation de routine.
3. **Manuel** — aucune clé définie. La page renvoie un prompt entièrement
   formé que vous pouvez coller dans Claude Code, ChatGPT, ou tout autre LLM.

### Output sections (canonical career-ops.org A-F)

> **Réalignement v1.15.0.** Les lettres de blocs correspondent désormais au
> [schéma canonique career-ops.org](https://career-ops.org/docs). Avant la
> v1.15, les rapports utilisaient A–G (avec `C=Risks`, `F=Verdict`,
> `G=Legitimacy`) ; nous les affichons toujours tels quels pour la
> rétrocompatibilité, mais les nouveaux rapports émettent A–F avec la
> sémantique canonique ci-dessous. Score et Légitimité vivent désormais dans
> l'en-tête du rapport (`score: 4.2/5`, `legitimacy: High|Medium|Low`).

A. **Role Summary** — récap en 3 puces (risques signalés en ligne).
B. **CV Match** — top 3 compétences présentes + top 3 manquantes.
C. **Strategy** — recommandation : postuler maintenant / contacto d'abord /
deep d'abord / passer. Était `Risks` avant la v1.15.
D. **Compensation** — par rapport à votre `target.comp_total_min_usd`
(legacy) ou `compensation.target_range` (canonique).
E. **Personalization** — angle à privilégier, cadrage par archétype,
accroches à mentionner dans la lettre / la prise de contact. Était
`Application Strategy` avant la v1.15.
F. **STAR stories** — 1 à 3 blocs S-T-A-R prêts à coller adaptés au poste.
Était `Verdict` (score brut) avant la v1.15 ; le score apparaît désormais
dans l'en-tête du rapport aux côtés de `legitimacy`.

### Saving the report

Cliquez sur **💾 Save report** (ou utilisez le toggle de sauvegarde dans
l'appel API) pour persister le markdown dans
`reports/<date>-<company>-<role>.md`. L'en-tête analysé du rapport (Score /
Légitimité / URL) apparaît sur la page **Reports** et le **Dashboard**.

### Batch-evaluate when you have 10+ JDs

Pour une seule offre, cette page `#/evaluate` est le bon outil. Pour 10+ URL
en file dans le pipeline, le clic par offre est impraticable — sautez à la
sous-section **Batch evaluate** du §14 (lancement de
`./batch/batch-runner.sh` depuis le parent), laissez-le travailler la nuit,
puis revenez à `#/reports` / `#/tracker` pour les résultats. Flux complet :
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

---

## 10. Reports (`#/reports`)

Parcourez chaque évaluation enregistrée. Les cartes montrent le titre, la
date, le drapeau de légitimité, et le score (codé couleur : vert ≥ 4.0,
jaune ≥ 3.0, rouge en dessous).

Cliquez sur une carte pour lire le markdown complet. Pagination : 12 par
page ; commandes en bas.

La vue rapport individuel a aussi :

- **← All reports** — retour à la grille.
- **🔗 Open JD** — ouvre l'offre d'origine dans un nouvel onglet.

---

## 11. Tracker (`#/tracker`)

Le CRM. Une ligne par candidature ; vit dans `data/applications.md` sous
forme de tableau GitHub-Flavored Markdown.

### Status flow

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` / `Rejected`
/ `Discarded` / `SKIP`.

La liste blanche de statuts est imposée côté serveur ; envoyer autre chose
dans un `POST /api/tracker` retombe sur `Evaluated`. La transition canonique
`Evaluated → Applied` est automatique quand vous confirmez `Submitted.` à la
fin de `/career-ops apply` (voir §14).

### Column layout

| Column | What it is |
|---|---|
| `#` | Auto-numéroté, complété de zéros (`001`, `002`, …). |
| `Date` | Date ISO (`YYYY-MM-DD`). Par défaut aujourd'hui. |
| `Company` | Texte libre. **Les barres verticales (`\|`) et les retours à la ligne sont échappés automatiquement.** |
| `Role` | Idem. |
| `Score` | Format `N/5` (p. ex. `4.2/5`). |
| `Status` | Enum en liste blanche. |
| `PDF` | ✅ une fois que `generate-pdf.mjs` a réussi pour cette ligne. |
| `Report` | Lien markdown vers le `reports/*.md` correspondant. |
| `Notes` | Texte libre, plafonné à 200 caractères. |

### Filters

- Menu déroulant **Status**.
- Menu déroulant **Score** — `≥ 4.0` (haut), `≥ 3.0` (moyen), `< 3.0` (bas).
- **Search** — correspondance de sous-chaîne sur entreprise + poste.

Chaque filtre réinitialise le paginateur à la page 1. 25 lignes par page.

### Maintenance buttons

- **▶ Normalize** lance `normalize-statuses.mjs` — recanonise l'orthographe
  des statuts (`applied` → `Applied`, `interview` → `Interview`).
- **▶ Dedup** lance `dedup-tracker.mjs` — retire les doublons insensibles à
  la casse par `(company, role)`.
- **▶ Merge** lance `merge-tracker.mjs` — récupère les entrées en attente de
  `batch/tracker-additions/*.tsv` (où le flux batch du parent dépose les
  candidatures soumises via l'assistant Apply). Déduplique et archive les
  fichiers traités vers `batch/tracker-additions/merged/`. Voir
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  pour le flux batch amont.

### Adding rows

`POST /api/tracker` — corps `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`. Dédup par `(company, role)` insensible à la
casse. Depuis l'UI, la page Evaluate propose un bouton « Add to tracker »
après une notation réussie.

---

## 12. Deep research (`#/deep`)

Générez un dossier d'entreprise structuré : aperçu, culture d'ingénierie,
actualités récentes, sentiment Glassdoor, processus d'entretien, points de
levier de négociation, trois questions intelligentes à poser au recruteur.

### Input

Deux champs — nom de l'entreprise et (optionnel) poste. Le modèle de mode
(`modes/deep.md`) est ce qui façonne la structure.

### Output paths

Même chaîne de repli qu'Evaluate :

1. **Anthropic live** (préféré) — `bundleProjectContext` inline cv + profile
   + `_shared.md` + `deep.md`. Sortie : 10–30 Ko de markdown ancré
   enregistré dans `interview-prep/<company>-<role>.md`.
2. **Gemini live** — invocation `gemini-eval.mjs`. Même cible
   d'enregistrement.
3. **Prompt manuel** — la page vous remet un prompt prêt pour Claude Code
   (qui a WebFetch + WebSearch et peut faire de vraies recherches).

### Tips

- Anthropic sur `claude-sonnet-4-6` renvoie typiquement ~13 Ko de texte
  utile en 1–3 minutes par appel.
- Le SDK Anthropic n'a pas de recherche web intégrée. Pour les postes où il
  vous faut des actualités fraîches + le sentiment Glassdoor, collez le
  prompt manuel dans Claude Code et laissez-le utiliser son outil WebFetch.
- Les exécutions live sont facturées ; un appel de recherche approfondie
  Sonnet 4.6 coûte ≈ 0,30–0,50 $.

---

## 13. Mode prompts (the seven `/#/<mode>` pages)

Sept générateurs de prompts : idées **Project**, plans **Training**, e-mails
**Follow-up**, évaluations **Batch**, **Outreach** aux recruteurs,
fiches **Interview prep**, et rétrospectives **Patterns**. Chacun enveloppe
un modèle `modes/<slug>.md` précis :

| Page | Slug | Purpose |
|---|---|---|
| `#/project` | `project` | Adapter un projet de portfolio à un poste cible. |
| `#/training` | `training` | Analyse de l'écart de compétences → curriculum. |
| `#/followup` | `followup` | Brouillon d'e-mail après entretien. |
| `#/batch` | `batch` | Prompt d'évaluation par lot multi-offres. |
| `#/contacto` | `contacto` | Message de prise de contact à un recruteur / une recommandation. |
| `#/interview-prep` | `interview-prep` | Fiche de préparation pour un tour d'entretien précis. |
| `#/patterns` | `patterns` | Analyse réflexive « Quels schémas m'ont fait réussir ? ». |

### Shared shape

Chaque page a un petit formulaire (les champs sont propres au mode), un
bouton **▶ Generate prompt** (manuel), et — quand une clé Anthropic ou
Gemini est présente — un bouton **⚡ Run live** qui passe en primaire.

Cliquer sur **▶ Generate prompt** renvoie le prompt assemblé avec vos
valeurs de formulaire converties en JSON dans un bloc `User-supplied
context:`, suivi du modèle `modes/<slug>.md` verbatim. Copiez-collez dans le
LLM de votre choix.

Cliquer sur **⚡ Run live** envoie le même prompt à Anthropic (ou Gemini),
avec `cv.md` + `profile.yml` + `_shared.md` inlinés via
`bundleProjectContext`. Le résultat est rendu sur la page, copiable, et
téléchargeable en `.md`.

Les sept pages sont une liste blanche explicite — les modes ayant une route
dédiée (`oferta` → Evaluate, `deep` → Deep research) et les modes que le
projet parent ne prend en charge que dans Claude Code (`apply`, `scan`,
`pipeline`, `tracker`, `pdf`, `latex`, `ofertas`, `auto-pipeline`) restent
délibérément hors de cette UI.

---

## 14. Apply checklist (`#/apply`)

Une fois que vous avez décidé de postuler, cette page Apply génère une
checklist de soumission pour l'étape de candidature réelle. Elle ne
remplit **PAS** les formulaires automatiquement — ce flux reste dans
`/career-ops apply` dans Claude Code, qui utilise Playwright dans le projet
parent.

### SPA checklist mode (`#/apply`)

La checklist de la SPA est pour les utilisateurs qui préfèrent remplir le
formulaire à la main sans invoquer Playwright. Elle couvre :

0. Lancez `/career-ops apply <url>` dans Claude Code pour lire le formulaire
   via Playwright (sautez cette étape si vous remplissez à la main).
1. Vérifiez que l'offre est toujours en ligne (`check-liveness.mjs`).
2. Confirmez que le CV est le plus récent (`cv-sync-check.mjs`, puis PDF si
   score ≥ 4.0).
3. Adaptez la lettre de motivation / la réponse « Pourquoi nous ? » avec les
   proof points STAR+R de `cv.md`.
4. Répondez honnêtement aux questions EEO / parrainage / date de début.
5. Enregistrez les réponses remplies dans
   `interview-prep/{company}-{role}.md` avant de soumettre.
6. **NE JAMAIS soumettre automatiquement** — c'est vous (l'humain) qui
   cliquez sur le bouton final.
7. Après la soumission : ajoutez une ligne à `data/applications.md` (ou
   écrivez un TSV dans `batch/tracker-additions/`).

### Manual fill vs Playwright-assisted

Deux voies pour la soumission réelle :

- **Manuel** — ouvrez la page carrières dans un onglet de navigateur normal,
  suivez la checklist SPA ci-dessus, copiez-collez les réponses. Pas besoin
  de Playwright. À utiliser quand le formulaire est court ou que vous n'avez
  pas Chromium installé.
- **Assisté par Playwright** — lancez `/career-ops apply <company>` dans
  Claude Code (projet parent). Playwright ouvre son propre navigateur, lit
  chaque champ du formulaire, renvoie des brouillons de réponses numérotés.
  C'est toujours vous qui cliquez sur Envoyer. À utiliser quand le
  formulaire est long, dynamique, ou que vous voulez la traçabilité des
  questions et réponses.

### Full CLI apply flow ([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**Prérequis :**

1. Lancez d'abord `/career-ops pipeline` pour que l'offre ait un rapport
   d'évaluation sous `reports/`. La commande apply dépend d'une évaluation
   existante ; sans elle, lancez d'abord le pipeline.
2. Ayez le rapport et le profil chargés.
3. **Recommandé :** Playwright installé (`npx playwright install chromium`
   — voir Playwright Setup ci-dessous). Retombe sur WebFetch (aperçu de
   formulaire texte seul, sans remplissage par clic) s'il manque.

**Flux numéroté** (8 étapes canoniques) :

1. **Lancez la commande** avec le nom de l'entreprise :

   ```
   /career-ops apply <company>
   ```

   Exemple : `/career-ops apply Anthropic`. Sans argument, fournissez une
   capture d'écran du formulaire, le texte du formulaire collé, ou l'URL de
   candidature au tour suivant.

2. **Localisez le rapport.** Le système trouve l'évaluation correspondante
   dans `reports/` (celle créée par `/career-ops pipeline` ou `#/evaluate`
   plus tôt).

3. **Ouvrez le formulaire.** Playwright lance une fenêtre de navigateur
   **automatiquement** — vous ne l'ouvrez PAS vous-même.

4. **Lisez les champs.** Le système lit et analyse chaque champ du
   formulaire (libellé, type, requis, options des sélecteurs).

5. **Générez les réponses.** career-ops crée des réponses sur mesure pour
   chaque champ, basées sur votre profil, vos proof points et le poste.

6. **Renvoyez la liste numérotée.** Vous recevez des réponses ordonnées pour
   correspondre à la disposition du formulaire — champs simples (nom,
   e-mail) d'abord, champs libres (lettre de motivation, « Pourquoi nous ? »)
   en dernier. Les éléments marqués pointent ce qui requiert une attention
   humaine — ancrage salarial, détails de CV manquants, questions
   optionnelles.

7. **Remplissage manuel.** Vous copiez-collez chaque réponse dans le champ
   correspondant. Cette étape est manuelle, pas automatisée. Vous revoyez
   chaque réponse d'abord.

8. **L'utilisateur soumet.** Vous cliquez sur Envoyer vous-même. career-ops
   ne clique **jamais** sur Envoyer. Confirmez la complétion en tapant dans
   le chat :

   ```
   Submitted.
   ```

**Mises à jour automatiques sur `Submitted.` :**

- Le statut bascule `Evaluated → Applied` dans `data/applications.md`.
- Les réponses remplies persistent en Section G du rapport pour référence
  future.

**Passation au tracker :**

```
/career-ops tracker
```

Suivez le statut de tout votre pipeline, quel que soit le score du poste.

### Batch evaluate ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

Quand vous avez 10+ offres à noter d'un coup (le `#/evaluate` un-par-un de
la SPA est impraticable pour ce volume), utilisez le batch runner en CLI.

**Fichier d'entrée — `batch/batch-input.tsv`** (séparé par tabulations) :

| Column | Purpose |
|---|---|
| `id` | Numéro séquentiel unique |
| `url` | Lien complet de l'offre |
| `source` | Plateforme d'origine (LinkedIn, Greenhouse, etc.) |
| `notes` | Détail contextuel optionnel |

Exemple de ligne :

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**Drapeaux de `./batch/batch-runner.sh` :**

- `--dry-run` — Prévisualise les offres en attente sans évaluation. Lancez
  toujours ceci d'abord pour valider le TSV.
- `--parallel N` — Lance N workers simultanément (1, 2 ou 3 recommandés).
- `--min-score X.X` — Ne persiste pas les offres sous le seuil. Utile pour ne
  garder que les rapports des postes à forte adéquation.
- `--retry-failed` — Retraite uniquement les offres en erreur au run
  précédent (échecs réseau, rate limits).
- `--max-retries N` — Réessaie les offres échouées jusqu'à N fois (défaut :
  2).
- `--model NAME` — Modèle Claude passé à `claude -p --model` (parent
  career-ops 1.8.0, #504). Non défini = votre défaut d'abonnement Claude Max.
  Utilisez un modèle moins cher pour les gros lots, p. ex.
  `claude-sonnet-4-6`. Exposé dans `#/batch` comme le champ **Model** (web-ui
  1.31.0).
- `--start-from N` — Saute les IDs d'offre sous N (reprend un lot
  partiellement traité). Exposé dans `#/batch` comme le champ **Start from #**
  (web-ui 1.31.0).

**Séquence standard :**

1. **Éditez** `batch/batch-input.tsv` — une ligne par offre.

2. **Dry-run** (recommandé en premier) :

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **Run** — séquentiel ou parallèle :

   ```bash
   ./batch/batch-runner.sh                       # one at a time
   ./batch/batch-runner.sh --parallel 2          # two concurrent
   ./batch/batch-runner.sh --parallel 3          # three concurrent
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # only persist high-fit
   ```

4. **Réessayez les échecs** (réseau / rate-limit) :

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **Les rapports** atterrissent dans `reports/` sous
   `{id}-{company}-{YYYY-MM-DD}.md`. Les lignes de résumé s'ajoutent à
   `batch/tracker-additions/`.

6. **Fusionnez dans le tracker :**

   ```bash
   node merge-tracker.mjs                 # apply the batch additions
   node merge-tracker.mjs --dry-run       # preview the merge
   ```

   La commande de fusion déduplique les entrées et archive les fichiers
   traités vers `batch/tracker-additions/merged/`.

La SPA expose les rapports résultants sous `#/reports` (paginés, pastille de
score colorée) et les lignes du tracker sous `#/tracker` — exactement comme
si vous aviez ajouté chacun via `#/evaluate`. Associez avec le bouton de
maintenance **▶ Merge** sur `#/tracker` si vous préférez ne pas descendre au
CLI.

### Playwright setup ([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

Requis pour deux fonctionnalités career-ops :

- **Remplissage de formulaire** dans `/career-ops apply` (étape 3 ci-dessus
  — Playwright ouvre le navigateur, lit les libellés des champs, suggère des
  réponses).
- **Génération PDF** via `/career-ops pdf` et le bouton **📄 Generate PDF**
  de la SPA sur `#/cv` / `#/reports/:slug` / `#/evaluate` / `#/deep` /
  `#/interview-prep`.

**Repli quand Playwright manque :** le flux apply retombe sur WebFetch
(aperçu de formulaire texte seul, sans remplissage par clic). La génération
PDF échoue simplement.

**Setup principal (à lancer depuis la racine parente career-ops) :**

```bash
# Install Chromium for Playwright
npm install
npx playwright install chromium

# Register the Playwright MCP so Claude Code can drive forms
claude mcp add playwright npx @playwright/mcp@latest

# Verify all three components (Chromium, Playwright lib, MCP)
npm run doctor
```

**Enregistrement MCP alternatif** — ajoutez à `.claude/settings.local.json` :

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

**Notes de comportement :**

- **Headless par défaut.** Playwright opère silencieusement. Pour voir le
  navigateur en action, dites à Claude `open up with playwright the browser
  and fill out the entire form.`
- **Trois rôles dans un seul paquet** — l'installation npm de Playwright
  vous donne la bibliothèque d'automatisation de navigateur, le moteur de
  rendu PDF pour `/career-ops pdf`, et (via le MCP) le flux de remplissage de
  formulaire dans Claude Code.
- **Vérifiez avant de vous y fier** — `npm run doctor` confirme que les
  trois sont opérationnels. La page Health de la SPA expose une vérification
  `Playwright (parent node_modules)` qui échoue vite s'il manque.

---

## 15. Interview preparation

C'est la phase post-recherche, pré-entretien. Trois artefacts de cette
application convergent :

1. **Fichiers de recherche approfondie enregistrés** sous `interview-prep/`,
   un par paire entreprise-poste que vous avez lancée. Parcourez depuis la
   page **Deep research** ou directement via `/api/interview-prep`.
2. **Mode Patterns** (`#/patterns`) — génère un prompt introspectif : « sur
   mes N derniers entretiens / offres / refus, quels schémas se
   maintiennent ? ». Utile une fois 5+ lignes de tracker accumulées.
3. **Mode Interview-prep** (`#/interview-prep`) — pré-remplit une fiche pour
   un tour à venir précis (comportemental, technique, system design). La
   sortie va dans le même dossier `interview-prep/`.

### Recommended workflow

Pour chaque entretien que vous avez à l'agenda :

1. **Relancez Deep** (ou ouvrez le fichier enregistré) la veille.
2. **`#/interview-prep`** — générez une fiche pour le tour précis.
   Collez-la dans vos notes.
3. **Tours system design / coding** — ouvrez `#/training` et demandez une
   remise à niveau ciblée de 30 minutes sur le sous-système précis que
   l'offre met en avant.
4. **Tours de rémunération** — ouvrez le fichier de recherche approfondie,
   sautez à « Negotiation leverage points ». Apportez 2–3 points de données
   précis (fourchette Glassdoor, levée de fonds récente, offre comparable
   ailleurs).
5. **Tours comportementaux** — tirez les histoires STAR+R de votre `cv.md`
   qui atterrissent en section B du rapport Evaluate d'origine.

Après l'entretien, immédiatement :

1. Mettez à jour la ligne du tracker : statut → `Responded` (puis
   `Interview`, `Offer`, etc.).
2. Lancez `#/followup` pour rédiger l'e-mail de remerciement.
3. Si vous avez de nouvelles infos (fourchette de rémunération, composition
   d'équipe, surprise de stack technique), éditez le
   `interview-prep/<company>-<role>.md` enregistré avec `## Post-round notes`
   pour que le vous-futur l'ait.

---

## 16. Activity log + Troubleshooting

### Activity log (`#/activity`)

Journal d'audit de chaque requête modifiant l'état qui touche le serveur.
Enregistre : ajouts au pipeline, écritures du tracker, sauvegardes de CV,
sauvegardes d'offres, exécutions d'évaluation, exécutions de recherche
approfondie, exécutions de scan, changements de config, exécutions de mode.

Les secrets (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) sont caviardés à
l'entrée ; vous ne verrez jamais une vraie valeur de clé dans
`data/activity.jsonl`.

Filtrez par préfixe d'action (`pipeline.`, `cv.`, `evaluate`, `scan.`,
etc.). 25 lignes par page ; le serveur renvoie jusqu'aux 500 événements les
plus récents.

### Troubleshooting

| Symptôme | Cause probable | Correctif |
|---|---|---|
| Page Health rouge sur `cv.md` | Premier lancement, le fichier n'existe pas encore | `touch $CAREER_OPS_ROOT/cv.md` puis rafraîchir. |
| Health rouge sur `Profile customized` | `candidate.full_name` dit encore `Jane Smith` | Éditez `config/profile.yml`. |
| `hh.ru: HTTP 403` dans le journal de scan | IP non russe, pas de `(server uses default UA)` | Inscrivez-vous sur `dev.hh.ru/admin`, utilisez une IP / VPN russe. |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | Dépendances du projet parent non installées | `cd $CAREER_OPS_ROOT && npm install`. |
| Erreurs Generate PDF | Playwright non installé dans le parent | `cd $CAREER_OPS_ROOT && npx playwright install chromium`. |
| `/career-ops apply` dit « no report found » | Le pipeline n'a jamais noté cette offre | Lancez `/career-ops pipeline` (ou `#/evaluate`) d'abord ; voir les prérequis du §14. |
| `batch-runner.sh: no such file` | Lancé depuis le mauvais répertoire | `cd $CAREER_OPS_ROOT` avant d'invoquer `./batch/batch-runner.sh`. |
| Le serveur signale `EADDRINUSE: 4317` | Ancienne instance toujours en cours | `pkill -f 'node server/index.mjs'` puis redémarrez. |
| Appel LLM live qui bloque > 2 min | Prompt énorme ou Anthropic lent | Vérifiez le drapeau Anthropic de `/api/health` ; le serveur plafonne en douceur les prompts à 200 Ko et renvoie 413. |
| L'aperçu du pipeline montre `(unsafe redirect)` | L'offre redirige vers une IP privée / loopback | C'est une fonctionnalité de sécurité (REVIEW-B1). La cible de redirection est rejetée et l'URL d'origine est inchangée. |
| Le texte d'une ligne de tracker casse le tableau | Barre verticale dans le nom d'entreprise avant la v1.9.1 | Mettez à jour vers la v1.9.1+ — les barres sont échappées de bout en bout (BF-1). |
| `npm test` échoue sur un clone neuf | Les tests supposent la disposition du projet parent | Utilisez `CAREER_OPS_ROOT=$(mktemp -d)` et amorcez des fixtures. |

Pour un diagnostic plus poussé : lancez **▶ Doctor** sur la page Health,
copiez la sortie, et cherchez le problème sur le tracker d'incidents à
<https://github.com/Fighter90/career-ops-ui/issues>.


---

## 17. How to add a new job-portal source

career-ops-ui traite chaque site d'emploi comme un **adaptateur** — un
fichier unique sous
[`server/lib/sources/<slug>.mjs`](../../server/lib/sources/) qui sait
récupérer + normaliser les résultats d'un site. Depuis la v1.80.0, le
registre [`server/lib/sources/`](../../server/lib/sources/) livre **27**
adaptateurs — 22 anglais (les ATS Greenhouse / Ashby / Lever / Workable /
SmartRecruiters / Workday, RSS, et les agrégateurs de la v1.75.0 RemoteOK /
Remotive / Working Nomads / IBM / Arbeitsagentur / Glints / Jobstreet · SEEK, et BambooHR / Breezy HR / Comeet / Personio / Recruitee / SolidJobs, et We Work Remotely, et l'ATS par tenant v1.80.0 Teamtailor)
et 5 sites russes. Les sept agrégateurs ajoutés en v1.75.0 sont des sources
couvrant tout un board ou pilotées par config plutôt que des ATS par
entreprise : les trois flux remote se sélectionnent avec
`provider: remoteok|remotive|workingnomads`, et les quatre régionaux (IBM /
Arbeitsagentur / Glints / Jobstreet · SEEK) lisent un bloc de config
`<provider>:` par entrée — voir le §5 pour le YAML et `docs/portals-examples.md`
pour des entrées à copier-coller.

> **v1.69.0 (P-14) — auto-découverte par dépôt de fichier.** Ajouter une 12e source est désormais
> un **simple dépôt de fichier**. Le registre
> ([`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs))
> ne contient plus de liste gérée à la main — au démarrage il scanne ce dossier
> (`readdirSync` + `import()` dynamique) et collecte le bloc `export const meta`
> de chaque `*.mjs`. Écrivez l'adaptateur, déclarez son `meta`, et il est
> immédiatement visible dans le scanner, dans le menu déroulant de filtre `#/scan` et dans le
> dispatcher RU — **aucune modification de `registry.mjs` requise**. (Les sources RU nécessitent
> toujours une ligne dans le `portals.yml` du parent ; voir l'étape 5.)

### Step 1 — Write the adapter

Créez `server/lib/sources/<slug>.mjs`. Deux patterns fonctionnent selon que
la source a une API JSON ou ne rend que du HTML :

**Source adossée à une API** (la plus propre — utilisez-la dès que le site a
un endpoint de données ouvert) :

```js
// server/lib/sources/example.mjs
const ENDPOINT = 'https://example.com/api/v1/vacancies';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...';

// v1.69.0 (P-14) — self-describing metadata. The registry auto-discovers
// this block at boot; THIS is what registers the source (see Step 2).
export const meta = {
  value: 'example',          // ← must equal job.source written below
  label: 'Example.com',      // ← shown in the #/scan filter dropdown
  region: 'ru',              // ← 'en' (ATS sweep) | 'ru' (regional dispatcher)
  configKey: 'example',      // ← RU only; the key used in portals.yml
};

export async function searchExample(query, opts = {}) {
  const { onlyRemote = false, fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${ENDPOINT}?text=${encodeURIComponent(query)}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Example: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return (data.items || []).map(normalizeExample);
}

function normalizeExample(item) {
  return {
    id: `example-${item.id}`,
    title: item.title || '',
    company: item.company?.name || '',
    url: item.url || '',
    salary: item.salary || '',
    location: item.location || '',
    isRemote: !!item.remote,
    workplaceType: item.remote ? 'Remote' : 'Onsite',
    relocates: false,
    date: item.posted_at || '',
    snippet: (item.description || '').slice(0, 240),
    source: 'example',           // ← must match the registry `value` exactly
  };
}
```

**Source par scraping HTML** (quand il n'y a pas d'API — voir
[`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) et
[`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) pour des exemples
complets) :

```js
const BASE = 'https://example.com';

export async function searchExample(query, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${BASE}/vacancies?q=${encodeURIComponent(query)}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Example: HTTP ${res.status}`), { status: res.status });
  }
  return parseExampleCards(await res.text());
}

export function parseExampleCards(html) {
  // …regex-based card extraction. Return [] on parse failure (DON'T throw):
  // a healthy 200 with no parseable cards is "no results", not "error",
  // so the multi-source scanner can keep going.
}
```

Trois contrats que chaque adaptateur DOIT honorer :

- **Exporter un bloc `meta` valide** (voir l'étape 2). Sans lui, le registre
  ignore silencieusement le fichier (un `console.warn` au démarrage) et la source
  n'apparaît jamais.
- **Accepter `{ onlyRemote, fetchImpl, signal }` dans `opts`.** `fetchImpl`
  est ce qui rend les adaptateurs testables sans réseau ; `signal` est requis
  pour la propagation de la déconnexion du client (REVIEW-B3).
- **Renvoyer des enregistrements à la forme commune** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`, où `source` correspond à
  `meta.value`.

### Step 2 — Declare the adapter's `meta` (auto-registration)

C'est toute l'étape d'enregistrement. **Vous ne modifiez pas `registry.mjs`.**
Assurez-vous simplement que l'adaptateur exporte un bloc `meta` — le registre
l'auto-découvre au démarrage :

```js
// at the top of server/lib/sources/example.mjs
export const meta = {
  value: 'example',          // job.source value AND #/scan option.value
  label: 'Example.com',      // display label in the dropdown
  region: 'ru',              // 'en' | 'ru'
  configKey: 'example',      // RU only — key in portals.yml::russian_portals.sources
};
```

Comment la découverte le valide (un fichier échouant à une règle est ignoré, avec un
avertissement `[sources/registry]`, afin qu'une branche à moitié migrée reste diagnosticable) :

- `value` — chaîne non vide. DOIT correspondre à `job.source` de votre adaptateur.
- `label` — chaîne non vide.
- `region` — exactement `'en'` ou `'ru'` ; toute autre valeur est rejetée.
- `configKey` — **requis** pour `region: 'ru'`, ignoré pour `'en'`.

`region: 'en'` rejoint la passe ATS (auto-découverte depuis les patterns d'URL
`tracked_companies`) ; `region: 'ru'` rejoint le dispatcher régional. L'API publique
(`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`) est
reconstruite à partir de chaque `meta` découvert, dans l'ordre `en` d'abord puis `ru`,
par ordre alphabétique du label au sein de chaque région — l'ordre du menu déroulant
reste ainsi stable pour les utilisateurs.

### Step 3 — Wire into the dispatcher (RU only)

Les sources ATS EN s'auto-découvrent depuis les patterns d'URL
`tracked_companies` — aucun câblage supplémentaire. Pour les sources RU,
ouvrez [`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs),
trouvez la table `RU_DISPATCH`, et ajoutez une ligne :

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

La boucle du dispatcher appelle `entry.search(query, opts)` pour chaque clé
présente dans `cfg.sources`. Aucun autre changement de code nécessaire.

### Step 4 — Test (mocked, never live)

Déposez un fichier sous `tests/sources-<slug>.test.mjs`. Le réseau réel est
**interdit** dans les tests (contrat d'isolation CI) :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchExample } from '../server/lib/sources/example.mjs';

test('searchExample normalizes one record', async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({ items: [{ id: 1, title: 'Backend Engineer' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  const out = await searchExample('q', { fetchImpl });
  assert.equal(out.length, 1);
  assert.equal(out[0].source, 'example');
});
```

### Step 5 — Enable in your `portals.yml`

Le `portals.yml` du projet parent est la config détenue par l'utilisateur.
Ajoutez le `configKey` de la nouvelle source au tableau :

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob", "example"]
  area: 113
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
```

Rechargez `#/scan` dans le navigateur. Le menu déroulant de filtre par source
récupère la nouvelle entrée automatiquement (source unique de vérité via
[`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs)). Le bouton
🌐 Scan inclut désormais la nouvelle source à chaque passe régionale.

### Reference adapters (mirror these for new sources)

| Fichier adaptateur | Type | Notes |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | API JSON | Adaptateur API RU canonique ; repli d'UA géo-conscient. |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | API JSON | Open-data du gouvernement russe ; pas de barrière IP. |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | Scrape HTML | Site tech russe ; parseur de cartes par regex. |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | Scrape HTML | Parseur défensif, `[]` en cas d'échec de parsing. |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | Scrape HTML | Même style défensif que GetMatch. |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | API JSON | Adaptateur ATS EN canonique ; utilise le pattern d'URL `tracked_companies`. |

### Common pitfalls

- **Oublier l'export `meta`.** Depuis la v1.69.0, le bloc `meta` est la
  *seule* chose qui enregistre une source. Pas de `meta` (ou un `meta` malformé) =
  le fichier est silencieusement ignoré au démarrage avec un seul avertissement
  `[sources/registry] <file> has no valid \`export const meta\` — skipped`,
  et la source n'atteint jamais le menu déroulant. Vérifiez le journal du serveur
  si un tout nouvel adaptateur n'apparaît pas.
- **Décalage du champ `source`.** La chaîne écrite par votre adaptateur DOIT
  correspondre exactement à `meta.value`. Si elles divergent,
  le menu de filtre `#/scan` montrera la source mais la sélectionner filtrera
  toutes les lignes (car le test d'égalité est `r.source === fs`).
- **Lever une exception en cas d'échec de parsing.** Les scrapers HTML
  DOIVENT renvoyer `[]` sur un 200 sain sans cartes analysables. Lever une
  exception casse la boucle du dispatcher multi-source — une mauvaise
  structure HTML tue toutes les autres sources pour la même requête.
- **Oublier `fetchImpl` / `signal`.** Sans eux, votre adaptateur ne peut pas
  être testé unitairement sans toucher le réseau live, et les déconnexions
  du client ne se propagent pas (la requête en arrière-plan reste vivante
  après que l'utilisateur ferme l'onglet).
- **Faire confiance à `tracked_companies` pour le RU.** Cette liste est
  uniquement pour les sources ATS EN. Les adaptateurs RU se pilotent
  eux-mêmes depuis `russian_portals.queries` — pas d'entrées par entreprise.

---

## 18. Notifications (🔔 in the top bar)

> v1.58.34 — chaque toast qui apparaît dans le coin inférieur droit est aussi
> capturé dans un journal en mémoire (plafond 50, le plus ancien éjecté).
> Cliquez sur la cloche 🔔 dans la barre du haut pour ouvrir le tiroir
> **Notifications** glissant à droite et relire tout ce que vous avez manqué.
> Le journal est par-onglet, par-session — fermer l'onglet l'efface.

Le tiroir **ne s'ouvre que quand vous cliquez sur la cloche** (ou l'activez
avec Entrée / Espace quand elle a le focus clavier). Il n'apparaît jamais de
lui-même. Le badge rouge sur la cloche compte les entrées que vous n'avez pas
vues depuis la dernière ouverture ; ouvrir le tiroir efface le badge.

### Notification categories

| Catégorie | Quand elle se déclenche | Indice visuel |
|---|---|---|
| **Success** | `Saved`, `Copied`, `Refreshed`, scan terminé, CV importé, actions de checklist apply (« Copied unchecked », « Reset »), profil enregistré, URL ajoutée au pipeline | bordure gauche verte dans le tiroir ; fond de toast vert |
| **Error** | échec de validation d'URL (doit commencer par `http://` / `https://`, pas de caractères script/template), erreurs d'API avec le postfixe `(METHOD /path · HTTP NNN)`, échecs réseau (serveur en panne), doublons pipeline-400, sortie non-zéro de doctor / verify-pipeline | bordure gauche rouge ; fond de toast rouge ; postfixe technique rangé dans le bloc `Details` `<details>` (U-4 / v1.58.24) |
| **Info / progress** | `Running doctor.mjs…`, `Running verify-pipeline.mjs…`, `Refreshing…`, `Loading…`, `Generating prompt…`, lignes de progression de scan | bordure gauche grise ; fond de toast par défaut |

Chaque entrée du tiroir affiche :

- **Horodatage** (`HH:MM:SS` localisé selon la langue active de la SPA).
- **Message** (la phrase humaine, avec le postfixe technique retiré de l'en-tête selon U-4).
- **Details** (quand présent — le postfixe `(METHOD /path · HTTP NNN)` de l'appel API ou tout autre aparté technique, en monospace).

### What is NOT a notification

- La **modale de résultat** Doctor / verify-pipeline (stdout / stderr complet) — c'est une modale, pas un toast, et non journalisée.
- Les lignes de journal SSE sur `#/scan` et `#/auto` — celles-ci défilent dans le corps de la page, pas dans le pipeline de toasts.
- Les états de chargement avec spinner seul (ceux-ci utilisent `UI.withSpinner` sans toast).

### Keyboard

- **Clic** ou focus + **Entrée / Espace** sur la cloche → ouvre le tiroir.
- **Échap**, clic sur le bouton de fermeture **×**, ou re-clic sur la cloche → ferme le tiroir ; le focus revient à la cloche.
- **Tab** quand le tiroir est ouvert → parcourt le bouton de fermeture et tout détail focalisable à l'intérieur ; le tiroir est `aria-modal="false"`, donc Tab ne piège pas (vous pouvez toujours atteindre le reste de la page).


## 19. Localizing the app into your language

L'interface est livrée en 9 langues (English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文). Chaque libellé à l'écran provient d'un dictionnaire de traduction, et vous pouvez ajouter ou corriger une langue sans toucher à la logique de l'application.

**Où vivent les traductions.** Depuis la v1.60.0, chaque langue est son propre fichier sous `public/js/lib/locales/` — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.fr.js`, `i18n-dict.ru.js`, et ainsi de suite — une simple liste de paires `'key': 'text'`. Un `i18n-dict.aliases.js` partagé permet aux clés qui doivent toujours se lire à l'identique (un libellé de barre latérale et son titre de page) de pointer vers une seule traduction. `i18n-dict.js` les fusionne toutes au chargement de la page ; vous ne l'éditez jamais.

**Corriger ou ajouter une phrase.** Ouvrez le fichier de votre langue, trouvez la clé (p. ex. `'nav.scan'`) et éditez le texte. Pour ajouter un libellé tout neuf, ajoutez la même clé à **tous les 9** fichiers de langue avec la valeur traduite, puis référencez-la dans la page via `t('your.key')`. Lancez `npm test` — il échoue si une langue manque la clé, donc rien n'est livré à moitié traduit.

**Ajouter une langue entièrement nouvelle.** Copiez `i18n-dict.en.js` vers `i18n-dict.<code>.js`, traduisez chaque valeur, puis enregistrez le code dans `i18n.js` (la liste de langues + l'auto-détection du navigateur), dans l'assembleur `i18n-dict.js`, et ajoutez une ligne `<script>` dans `index.html`. La checklist complète — y compris le snapshot de test et les fichiers compagnons help / README — est dans `docs/LOCALIZATION.md`.

**Bon à savoir.** Le sélecteur de langue est dans le pied de la barre latérale ; votre choix est mémorisé par navigateur. Les messages de diagnostic du serveur restent en anglais à dessein (pour que les logs se lisent de façon cohérente) — seule l'interface à l'écran est traduite.

Voir **`docs/LOCALIZATION.md`** dans le dépôt pour le guide de localisation complet, étape par étape.
