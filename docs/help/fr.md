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
n'importe quel CLI de codage IA (Claude Code, Cursor, Codex, OpenCode, Antigravity CLI, Grok Build CLI, Qwen Code, Kimi, GitHub Copilot CLI, Gemini CLI (legacy)
— d'autres CLI compatibles Claude fonctionnent aussi via la même surface
de commandes slash). Indépendant du modèle. Il évalue chaque offre par
rapport à votre CV selon une grille à cinq dimensions plus un score global holistique notée de 0.0 à 5.0,
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
- [Comment career-ops note les offres d'emploi](https://career-ops.org/methodology)
  — la méthodologie de notation : les cinq dimensions plus un score global holistique, le seuil de
  candidature à 4.0, et ce que le système refuse explicitement de faire.
  Également résumée sur
  [cvstart.org/methodology](https://cvstart.org/methodology/) dans votre langue.

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
| Où il s'exécute | dans Claude Code / Cursor / Codex / OpenCode / Antigravity CLI / Grok Build CLI / Qwen Code / Kimi / GitHub Copilot CLI / Gemini CLI (legacy) | `http://127.0.0.1:4317` dans votre navigateur |
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

**Demander au guide.** Ouvrez **Demander au guide 💬** (barre latérale, sous Aide) et posez une question — il répond uniquement depuis ce guide dans votre langue et ne lit jamais votre CV. Le même assistant est à un clic depuis chaque page : un bouton de chat robot flotte dans le coin inférieur droit (inférieur gauche dans les langues de droite à gauche) ; cliquez pour poser une question sans quitter ce que vous faites.

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
> **Providers (v1.57.0).** L'évaluation live headless couvre désormais **Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes** (l'ordre `auto` ; `LLM_PROVIDER` en épingle un). **OpenRouter** — une `OPENROUTER_API_KEY` donne accès à 300+ modèles ; le menu `OPENROUTER_MODEL` charge le catalogue live d'OpenRouter (proxy côté serveur, repli hors-ligne curé). Corrigé aussi : les clés collées avec un retour à la ligne / des espaces autour sont désormais nettoyées avant validation, donc `/#/config` n'affiche plus « validation failed » pour aucun fournisseur.



---

## 2. App settings & API keys (`#/config`)

> **Nouveau en v1.55 → v1.56.** Sans **aucune** clé LLM, une bannière rouge sur chaque écran explique que ⚡ Run-live est en mode prompt-manuel et renvoie ici ; une fois une clé définie, elle devient une puce discrète nommant le fournisseur actif. Avant tout bouton ⚡ Run-live (`#/auto`, `#/evaluate`, `#/deep`, modes), une estimation honnête du coût s'affiche (p. ex. « Estimated cost: OpenAI gpt-5-codex · ~$0.04/eval », ou une note « pas de coût API » en mode manuel). `#/scan` range les filtres secondaires derrière un volet **Advanced filters** ; `#/tracker` ajoute des puces d'entonnoir cliquables + une pagination côté serveur optionnelle ; `#/pipeline` virtualise au-delà de 1000 lignes.

**Outils CLI d'IA.** L'onglet **Outils CLI d'IA** indique quels CLI d'agent (Claude Code, Cursor, Codex, Gemini, OpenCode, Copilot, Qwen, Antigravity, Kimi CLI, Grok Build CLI) sont installés sur le serveur — une analyse du PATH en lecture seule, sans les exécuter. **Apparence → Afficher les logos d'entreprise** (désactivé par défaut) affiche le favicon de chaque entreprise dans le tableau de scan, récupéré depuis son propre domaine (jamais un service tiers).

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

**Configurer votre fournisseur LLM (pas à pas).** L'évaluation live ⚡ de l'UI web tourne *headless* et utilise une seule clé API. Elle fonctionne par « OU » — définissez **n'importe laquelle** et ça marche ; avec plusieurs, `auto` les préfère dans cet ordre : Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes. (career-ops lui-même est agnostique du CLI — vous l'exécutez aussi dans Claude Code, Cursor, Codex, Gemini, OpenCode, Antigravity, Grok Build, Qwen, Copilot ou Kimi ; c'est distinct de cette clé headless.)

1. Ouvrez `#/config` → l'onglet **API keys & runtime**.
2. Choisissez votre fournisseur dans **`LLM_PROVIDER`** : `auto` (utilise la clé définie), ou forcez-en un avec `claude` / `gemini` / `openai` / `qwen`.
3. Renseignez la clé + le modèle du fournisseur choisi :
   - **Anthropic** — définissez `ANTHROPIC_API_KEY` (console.anthropic.com), éventuellement `ANTHROPIC_MODEL` (défaut `claude-sonnet-4-6`).
   - **Gemini** — définissez `GEMINI_API_KEY` (aistudio.google.com/apikey), éventuellement `GEMINI_MODEL` (défaut `gemini-3.6-flash`).
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

**Utilisation et coût de l'IA.** La page **Utilisation IA** (💳, à côté de Santé) montre les tokens des générations IA en direct par fournisseur sur 24 h / 7 j / 30 j / tout, avec un coût estimé en USD issu d'une table de prix modifiable (jamais facturé). Un compteur **UTILISATION** compact est aussi épinglé en bas de la barre latérale gauche sur chaque page — les mêmes totaux de jetons 24h/7j/30j et un coût estimé sur 24 heures, actualisé en direct ; le menu reste toujours dégagé au-dessus, et cliquer sur son en-tête le replie.

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

**Rechercher + Exclure.** La boîte Rechercher traite les virgules comme un OU (« rôles à trouver ») ; le nouveau champ Exclure masque les lignes correspondant à un mot séparé par des virgules. Les deux sont enregistrés avec vos recherches.

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

Dans Claude Code / Cursor / Codex / OpenCode / Antigravity CLI / Grok Build CLI / Qwen Code / Kimi / GitHub Copilot CLI (Gemini CLI legacy). Utilise des tokens de modèle.
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
### hh.ru — récupéré depuis le site web (IP russe requise depuis juillet 2026)

hh.ru est scanné en lisant son site public de recherche (`hh.ru/search/vacancy`), comme Habr Career — sans clé ni configuration. **Depuis juillet 2026, cependant, hh.ru renvoie HTTP 451 (blocage légal régional) aux IP hors de Russie** : le scan ne fonctionne donc que depuis une IP russe — lancez le serveur depuis la Russie ou via un VPN avec sortie russe. Au premier 451 (ou 403 anti-bot), le scanner désactive hh.ru pour le reste de l'exécution et l'indique dans le journal, si bien que les autres sources russes se terminent normalement. L'API JSON (`api.hh.ru`) n'est volontairement *pas* utilisée : elle renvoie `403 forbidden` à tout client programmatique, quels que soient l'IP ou le User-Agent.

Même depuis un réseau qui *semble* correct, hh.ru peut considérer l'IP de sortie comme un VPN/proxy (toute IP de datacenter/hébergeur compte) et rediriger le scan en 302 vers un interstitiel `/vpncheeck` (“VPN мешает работе сайта”) qui renvoie HTTP 200 avec **zéro** offre. Le scanner détecte cette redirection, désactive hh.ru pour le reste de l'exécution et l'indique dans le log. La solution est côté réseau : assurez-vous que le trafic sort réellement par une IP résidentielle — un VPN ou proxy système reste souvent actif même quand l'interrupteur du navigateur est coupé (vérifiez votre IP de sortie réelle, p. ex. sur api.ipify.org).

## 8. Pipeline (`#/pipeline`)

Boîte de réception des URL en attente d'évaluation. Vit dans
`data/pipeline.md`.

**Bande d'aperçu.** Une bande compacte en haut montre votre pipeline d'un coup d'œil — combien d'URL en boîte, combien suivies, et les décomptes Applied/Responded/Interview/Offer, chacun renvoyant au tracker.

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
   gratuit (`gemini-3.6-flash`) convient à une notation de routine.
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

### Exporter un rapport en PDF

Ouvrez un rapport enregistré et cliquez sur **📄 Generate PDF**. Cela
exécute `generate-pdf.mjs` dans le projet parent et écrit le fichier dans
`output/*.pdf` (nécessite Playwright ; la page Santé indique s'il est
installé). Rien n'est envoyé : relisez le PDF avant de le joindre à une
candidature.

---

## 11. Tracker (`#/tracker`)

Le CRM. Une ligne par candidature ; vit dans `data/applications.md` sous
forme de tableau GitHub-Flavored Markdown.

### Status flow

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` / `Hired` / `Rejected`
/ `Discarded` / `SKIP`.

`Hired` (v1.118.0) est l'état final heureux — l'offre a été acceptée. Le tracker le marque d'un badge de célébration et l'accueille avec une bannière « poste décroché ».

**Tableau à onglets d'étape (v1.131.0).** Au-dessus du tableau, une **bande d'onglets d'étape** permet de parcourir l'entonnoir : un onglet **All** plus un onglet par statut canonique, chacun affichant un compte en direct sur tout l'historique — **y compris les étapes à zéro** — afin que le pipeline complet reste toujours visible d'un coup d'œil. Cliquez sur une étape pour filtrer le tableau dessus ; cliquez à nouveau pour revenir à **All**. Les onglets (et le repli des alias de statut localisés/hérités dans les comptes) proviennent de `GET /api/tracker/stages`, qui lit le même `templates/states.yml` que le serveur — de sorte que l'ensemble des onglets reste automatiquement synchronisé avec le vocabulaire de statuts du parent, sans liste codée en dur sur la page. La recherche, le filtre de score, les colonnes triables et les actions rapport/PDF/légitimité par ligne restent inchangés ; avec les logos activés, l'entreprise de chaque ligne affiche une marque.

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

**Tableau de cadence (v1.117.0).** La page de relance s'ouvre désormais sur un **tableau de cadence** déterministe alimenté par le `followup-cadence.mjs` du parent : urgence par candidature (🔴 urgent / 🟠 en retard / 🟡 en attente / 🔵 froid) avec les jours avant la prochaine étape, plus un bouton **Semer les dates de relance** qui fixe une première date pour chaque ligne Applied (`followup-seed.mjs --backfill`). Sans les scripts du parent, le tableau affiche honnêtement « indisponible ».

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

career-ops-ui traite chaque site d'emploi comme un **adaptateur** — un fichier unique sous [`server/lib/sources/<slug>.mjs`](../../server/lib/sources/) qui sait récupérer + normaliser les résultats d'un site. Depuis la v1.124.0, le registre `server/lib/sources/` livre **79** adaptateurs — **74 anglais + 5 russes**. L'ensemble anglais couvre les principaux ATS (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday), les agrégateurs couvrant tout un board sélectionnés par un `provider:` explicite (RemoteOK, Remotive, We Work Remotely, NoDesk, Get on Board, Amazon, …), et les ATS par tenant auto-détectés depuis un hôte `careers_url` ou une URL `api:` explicite (BambooHR, Personio, Recruitee, Teamtailor, Avature, SAP SuccessFactors, …). **La liste complète n'a jamais besoin d'être comptée à la main ici — elle est auto-découverte depuis `server/lib/sources/` et affichée en direct dans le menu déroulant Source de `#/scan`.** Voir le §5 pour le YAML et `docs/portals-examples.md` pour des entrées à copier-coller.

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

L'interface est livrée en 17 langues (English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文, Polski, Українська, Dansk, العربية, Deutsch, Italiano, Türkçe, हिन्दी). Chaque libellé à l'écran provient d'un dictionnaire de traduction, et vous pouvez ajouter ou corriger une langue sans toucher à la logique de l'application.

**Où vivent les traductions.** Depuis la v1.60.0, chaque langue est son propre fichier sous `public/js/lib/locales/` — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.fr.js`, `i18n-dict.ru.js`, et ainsi de suite — une simple liste de paires `'key': 'text'`. Un `i18n-dict.aliases.js` partagé permet aux clés qui doivent toujours se lire à l'identique (un libellé de barre latérale et son titre de page) de pointer vers une seule traduction. `i18n-dict.js` les fusionne toutes au chargement de la page ; vous ne l'éditez jamais.

**Corriger ou ajouter une phrase.** Ouvrez le fichier de votre langue, trouvez la clé (p. ex. `'nav.scan'`) et éditez le texte. Pour ajouter un libellé tout neuf, ajoutez la même clé à **tous les 9** fichiers de langue avec la valeur traduite, puis référencez-la dans la page via `t('your.key')`. Lancez `npm test` — il échoue si une langue manque la clé, donc rien n'est livré à moitié traduit.

**Ajouter une langue entièrement nouvelle.** Copiez `i18n-dict.en.js` vers `i18n-dict.<code>.js`, traduisez chaque valeur, puis enregistrez le code dans `i18n.js` (la liste de langues + l'auto-détection du navigateur), dans l'assembleur `i18n-dict.js`, et ajoutez une ligne `<script>` dans `index.html`. La checklist complète — y compris le snapshot de test et les fichiers compagnons help / README — est dans `docs/LOCALIZATION.md`.

**Bon à savoir.** Le sélecteur de langue est dans le pied de la barre latérale ; votre choix est mémorisé par navigateur. Les messages de diagnostic du serveur restent en anglais à dessein (pour que les logs se lisent de façon cohérente) — seule l'interface à l'écran est traduite.

Voir **`docs/LOCALIZATION.md`** dans le dépôt pour le guide de localisation complet, étape par étape.

## 20. Statistiques par rôles cibles (`#/stats`)

La page **Analytics → Statistiques par rôle cible** transforme les données éparses que vos scans collectent déjà en une image du marché pour les rôles que vous visez réellement : nombre d'offres et niveaux de salaire par pays, plus une tendance que vous pouvez suivre dans le temps. Rien n'est inventé : elle agrège seulement ce que les scanners ont trouvé, et elle est honnête sur la finesse de l'échantillon.

### D'où viennent les chiffres

- Les **rôles cibles** sont lus depuis votre Profil (`config/profile.yml` → target roles), jamais codés en dur. Définissez-les d'abord sur `#/profile` ; sans rôles, la page affiche une invite « définissez vos rôles cibles » au lieu de graphiques vides.
- **Les offres** proviennent de votre dernier scan (lancez-en un d'abord sur `#/scan`). Le lieu de chaque offre est associé à un pays (le même détecteur que le filtre pays du scan) et sa chaîne de salaire est analysée puis normalisée en **USD** via une table de change approximative.
- Tout est agrégé **dans votre navigateur** : aucune donnée ne quitte votre machine, et la seule chose que la page écrit jamais est un instantané que vous enregistrez explicitement.

### Lire les graphiques

- **Offres par pays** : combien d'offres correspondantes se trouvent dans chaque pays. Utilisez les filtres **Rôle** et **Pays** en haut pour restreindre à un seul rôle cible ou à un seul pays.
- **Salaire médian par pays (USD)** : le salaire médian analysé par pays. Seules les offres avec un salaire exploitable sont comptées ; la taille de l'échantillon est indiquée à côté du graphique, et les montants sont convertis à des taux approximatifs, alors lisez-le comme *indicatif*, non exact. Un `¥` seul (ambigu entre le yen japonais et le yuan chinois) est écarté plutôt que deviné, pour éviter une forte distorsion de FX.
- Lorsque le scan actuel n'a aucun salaire exploitable, le graphique des salaires le signale au lieu d'inventer des chiffres.

### Enregistrer des instantanés et suivre la tendance

- Cliquez sur **Enregistrer l'instantané** pour ajouter l'agrégat actuel à `data/role-stats.jsonl`. Chaque instantané est horodaté sur le serveur ; les instantanés sont la seule chose que cette page écrit et ils ne touchent jamais votre CV ni votre profil.
- Le graphique de **tendance** trace le nombre d'offres au fil de vos instantanés enregistrés — enregistrez-en un régulièrement (par exemple après chaque scan hebdomadaire) pour observer comment le marché de vos rôles cibles évolue dans le temps.

## 21. Votre document de deux pages — adéquation candidat-marché (`#/two-pager`)

La plupart de career-ops-ui demande « cette offre correspond-elle à mon CV ? ». Le **document de deux pages** répond à l'autre moitié : « cette offre correspond-elle à ce que *je veux vraiment* ? ». Il s'inspire du **« document de deux pages de Mnookin »** de *Never Search Alone* — une déclaration brève, à la première personne, de ce qui vous donne de l'énergie, de ce que vous exigez et de ce que vous n'accepterez pas. Ouvrez-le depuis **Configuration → Document de deux pages 🎯**.

**Remplissage IA + export (v1.100).** L'« ✨ assistant de remplissage IA » remplit désormais tous les champs en direct depuis votre CV (relisez, puis Enregistrez) ; **👁 Aperçu et export** rend le two-pager et l'exporte en Markdown, PDF ou DOCX.

### Ce que vous remplissez

- **Qui je suis** — quelques phrases à la première personne sur votre parcours et le type de rôle où vous excellez.
- **Environnement cible** — la taille, le stade et la culture d'entreprise que vous recherchez.
- Cinq listes de chips — tapez et appuyez sur **Enter** (ou virgule) pour ajouter chaque élément, cliquez sur **×** pour le retirer :
  - **Ce que j'adore** — sources d'énergie (télétravail, autonomie, greenfield, mentorat…).
  - **Indispensables** — exigences fermes (un salaire plancher, un pays, une stack…).
  - **Ce que je déteste** — sources d'épuisement (astreintes, réunions interminables, legacy uniquement…).
  - **Rédhibitoires** — non absolus (présentiel uniquement, pas de parrainage de visa, en dessous d'un chiffre…).
  - **Non négociables** — limites (localisation, télétravail, salaire plancher…).

Cliquez sur **Enregistrer le document de deux pages** pour le conserver. Il est écrit dans la **couche utilisateur de votre projet parent career-ops** dans `config/two-pager.yml`, donc — comme votre CV et votre profil — il n'est **jamais** écrasé lorsque vous mettez le système à jour.

### L'assistant de remplissage IA

Vous ne savez pas comment le formuler ? Cliquez sur **✨ Assistant de remplissage IA**. Il construit un prompt prêt à exécuter (le format Mnookin, avec votre CV et votre profil intégrés) et l'affiche dans une boîte de dialogue. Exécutez ce prompt dans n'importe quel LLM, puis collez les champs YAML obtenus dans le formulaire. L'assistant n'utilise que **votre propre** CV et profil — il n'invente jamais de faits à votre sujet, et aucun appel d'API en direct n'est effectué depuis ce bouton.

### Le score d'adéquation avec ce que vous voulez

Une fois que vous avez enregistré un document de deux pages, chaque offre sur **`#/scan`** obtient un petit badge **`◎ N`** (0–100). Il compare le **type de travail** (télétravail/hybride/présentiel), le **pays**, le **salaire plancher** et la **relocalisation** de chaque offre à votre document de deux pages — un badge vert signifie une bonne adéquation, un rouge signifie qu'un critère rédhibitoire s'est déclenché. Survolez pour voir les détails (✓ ce qui a correspondu, ✗ quel critère rédhibitoire a été violé).

Il est délibérément honnête : lorsqu'une offre ne donne **aucun signal comparable** (par exemple si vos préférences sont toutes du texte libre qu'une ligne de scan ne peut confirmer), **aucun badge n'est affiché du tout** — le système n'invente jamais de chiffre. La violation d'un **critère rédhibitoire** ferme pèse plus lourd qu'une **détestation** légère de la même chose. Au-delà du badge, votre document de deux pages enregistré est intégré à chaque **évaluation** par LLM, de sorte que vos préférences déclarées façonnent aussi le verdict écrit, pas seulement l'adéquation CV-vs-offre.

## 22. Entretien simulé (`#/mock-interview`)

Lire la préparation d'entretien est une chose ; *dire les réponses à voix haute* en est une autre. La page **Entretien simulé** (ouvrez-la depuis **Préparation d'entretien → Entretien simulé 🎤** dans la barre latérale) déroule une répétition tour par tour face à un poste précis, ancrée dans votre propre CV, profil, document de deux pages et banque d'histoires. Ce n'est pas une liste de questions toutes faites — l'intervieweur réagit à ce que vous dites réellement.

### Démarrer une session

- Saisissez un **poste cible** (et éventuellement une **entreprise**). Collez aussi la **description du poste** si vous l'avez — les questions deviennent nettement plus précises.
- Cliquez sur **Démarrer l'entretien**. L'intervieweur ouvre avec une question ciblée, adaptée au poste et à votre parcours.
- Tapez votre réponse et cliquez sur **Envoyer la réponse**. Répétez autant que vous voulez — c'est une conversation, pas un questionnaire figé.

### Ce que chaque tour vous apporte

Après chaque réponse, l'intervieweur répond en trois parties :

- **Retour** — ce qui a marqué (points forts) et ce qui manquait, formulé en termes **STAR+R** (Situation, Tâche, Action, Résultat, Réflexion). Il nomme la dimension précise que vous avez sautée.
- **Score** — un rapide `N/5` avec une justification d'une ligne, pour que vous ressentiez la progression au fil d'une session.
- **Question suivante** — une relance qui sonde délibérément la partie la plus faible de votre dernière réponse.

Tout est ancré dans vos vrais documents : `cv.md`, `config/profile.yml`, `config/two-pager.yml` et votre banque d'histoires STAR+R (`interview-prep/story-bank.md`) sont tous intégrés au prompt. L'intervieweur insistera sur les vraies lacunes mais n'invente jamais une expérience que vous n'avez pas. Si aucune clé LLM n'est configurée, la page vous remet un prompt prêt à l'emploi à coller dans n'importe quel assistant — le même repli honnête utilisé ailleurs dans l'app.

### Enregistrer et revisiter les sessions

Cliquez sur **Enregistrer la transcription** pour conserver une répétition terminée. Elle est écrite dans la couche utilisateur de votre projet parent, à `interview-prep/mock-{company}-{role}-{date}.md`, de sorte qu'elle vit aux côtés de vos autres notes de préparation d'entretien et n'est jamais écrasée par les mises à jour du système. La liste **Sessions enregistrées** en bas de la page vous permet de rouvrir n'importe quelle transcription ou de la supprimer. Utilisez **Nouvel entretien** pour recommencer avec un poste différent.

## 23. Réseautage et recherche approfondie sur les entreprises (`#/networking`)

Postuler par la grande porte ne représente que la moitié du jeu — l'autre moitié consiste à *connaître quelqu'un*, ou au moins à savoir qui contacter et quoi dire. La page **Réseautage** (ouvrez-la depuis **Recherche approfondie → Réseautage 🤝** dans la barre latérale) transforme une entreprise en un plan concret pour décrocher un entretien, ancré dans votre propre CV, votre profil et votre two-pager.

### Construire un plan

- Saisissez une **entreprise** (obligatoire) et, en option, un **poste** et la **description du poste**. La description affine les accroches « pourquoi je conviens ».
- Cliquez sur **Construire le plan**. Avec une clé LLM, il s'exécute en direct et affiche le plan dans la page ; sans clé, il vous fournit un prompt prêt à coller dans n'importe quel assistant (le même repli honnête utilisé dans toute l'application — rien n'est inventé).

### Ce que contient le plan

Le plan revient en quatre sections :

- **Dossier de l'entreprise** — un briefing serré sur ce que fait l'entreprise, des signaux récents qui méritent d'être cités, et deux ou trois accroches « pourquoi je conviens » tirées de votre parcours réel.
- **Qui contacter** — trois à cinq personas cibles (le responsable du recrutement de l'équipe, un recruteur interne, un ingénieur senior de l'équipe, une relation chaleureuse ou issue des anciens élèves) avec une **chaîne de recherche LinkedIn** concrète pour trouver chacun d'eux. Il n'invente jamais de vrais noms — il vous dit comment trouver les bonnes personnes.
- **Meilleure voie d'introduction** — la route chaleureuse la plus réaliste pour *votre* parcours : un employeur, une école ou une communauté commune ; une relation de second degré ; ou un message à froid à fort signal lorsque c'est réellement la meilleure option.
- **Brouillons de prise de contact** — des messages courts et précis (trois à cinq phrases, sans remplissage) pour vos principales personas, ancrés dans vos preuves réelles pour qu'ils ne paraissent pas génériques.

### Enregistrer et revoir des plans

Cliquez sur **Enregistrer le plan** pour en conserver un. Il est écrit dans la couche utilisateur de votre projet parent, à `networking/net-{company}-{role}-{date}.md` — votre propre fichier, jamais écrasé par les mises à jour du système. La liste **Plans enregistrés** en bas de la page vous permet de rouvrir ou de supprimer n'importe quel plan. Comme les brouillons et les personas ne s'appuient que sur vos supports réels, considérez-les comme un solide premier jet à personnaliser — pas comme un script à envoyer à l'aveugle.

## 24. CV Studio (`#/cv-studio`)

**Ajouter au CV (v1.117.0).** Une nouvelle carte transforme un projet, une publication ou une page de portfolio (URL ou texte collé) en puces prêtes pour les ATS fondées UNIQUEMENT sur cette source — les métriques, employeurs ou dates absents sont omis, jamais inventés. Vous relisez les suggestions et collez vous-même celles que vous acceptez dans l'éditeur de CV ; rien n'est écrit automatiquement et les URL passent par le même validateur anti-SSRF que le pipeline.

La page `#/cv` est l'endroit où vous *rédigez* votre CV ; le **CV Studio** (ouvrez-le depuis **Setup → CV Studio 🎨** dans la barre latérale) est l'endroit où vous l'*affinez*. Il offre à votre `cv.md` trois outils honnêtes, dont deux ne quittent jamais votre navigateur.

**Adapter à une offre (v1.101).** Collez une offre d'emploi et CV Studio produit un CV adapté plus une lettre de motivation, passés par un contrôle de type recruteur (les erreurs bloquent, les avertissements conseillent), fondé uniquement sur vos matériaux.

### Diagnostic du CV

Dès que vous ouvrez la page, il note votre CV sur 100 et liste les constats par vérification, chacun accompagné d'une brève explication pour que *vous* décidiez de ce qu'il faut changer (il ne réécrit jamais en silence) :

- **Longueur** — le CV est-il dans une fourchette saine d'une à deux pages ?
- **Impact chiffré** — quelle part de vos puces comporte un chiffre ou une métrique réels ? Les recruteurs les repèrent en survolant.
- **Verbes d'action forts** — signale les formulations faibles comme « responsable de » ou « aidé à ».
- **Mots à la mode** — signale les clichés creux (« orienté résultats », « esprit d'équipe »).
- **Sections essentielles** — vérifie la présence de Résumé, Expérience, Formation et Compétences.
- **Coordonnées** — s'assure qu'un e-mail est présent.

Tout cela s'exécute entièrement dans votre navigateur, sans aucun LLM — les chiffres sont déterministes et rien n'est inventé.

### Masque de confidentialité

Avant de partager votre CV comme échantillon d'écriture ou capture d'écran, le **Masque de confidentialité** occulte les données personnelles identifiantes : e-mail, téléphone, liens/identifiants et adresse postale, ainsi que votre **nom → initiales** si vous l'activez et le saisissez. Activez ou désactivez chaque catégorie, copiez la version masquée et partagez-la en toute sécurité. Tout se passe intégralement dans le navigateur, il indique exactement combien d'éléments ont été occultés et ne stocke ni ne transmet jamais l'original.

### Rendez-le humain (correspondance de voix)

Collez une phrase ou un paragraphe rigide — ce genre de formulation générique d'IA qui sonne comme du texte tout fait — et **Rendez-le humain** le réécrit dans *votre* voix. La réécriture est ancrée côté serveur dans votre `voice-dna.md` (la façon dont votre écriture se lit) et vos `writing-samples/` (votre prose réelle). La règle stricte : il peut réorganiser, resserrer et réajuster la voix, mais il n'introduira **jamais** un fait, une métrique ou une réalisation qui ne figure pas déjà dans le texte que vous avez collé. Avec une clé LLM, il réécrit en direct ; sans clé, il vous remet un prompt prêt à coller dans n'importe quel assistant. Modifiez ensuite votre CV sur la page `#/cv` comme d'habitude — le CV Studio suggère, vous décidez.

## 25. Mémoire (`#/memory`)

Toutes les autres pages repartent de zéro à chaque fois. La **Mémoire** (ouvrez-la depuis **Configuration → Mémoire 🧠** dans la barre latérale) est le seul endroit où vous dites quelque chose à l'assistant *une seule fois* pour que cela reste. Elle contient une note courte et modifiable du type « retiens ceci à mon sujet » qui est injectée dans **chaque** requête IA.

### À quoi elle sert

Utilisez-la pour des préférences durables et un style de travail, par exemple :

- Les types de postes et d'entreprises que vous visez (et ceux que vous ne voulez jamais voir).
- La façon dont vous aimez que les réponses soient rédigées — concises ou détaillées, ton senior, sans remplissage.
- Les contraintes fermes qui méritent d'être répétées — télétravail uniquement, un salaire plancher, pas d'astreinte.

Limitez-la aux préférences et à l'orientation. Ce **n'est pas** l'endroit pour des faits sur votre expérience — vos compétences, employeurs et réalisations vivent dans votre CV, votre profil et votre synthèse de deux pages, qui restent les seules sources de tout ce qui apparaît dans vos CV et lettres de motivation. La note de mémoire façonne *comment* l'assistant travaille avec vous, jamais *ce qu'*il affirme à votre sujet.

### Comment elle atteint tout

Quand vous cliquez sur **Enregistrer la mémoire**, la note est écrite dans la couche utilisateur de votre projet parent à `config/memory.md` et intégrée au contexte partagé du projet. Cela signifie qu'elle voyage automatiquement avec **chaque** requête IA — évaluations, entretiens simulés, plans de réseautage, réécritures dans CV Studio — et à travers **chaque** fournisseur que vous avez configuré. Écrivez-la une fois ; vous n'avez pas à vous répéter sur chaque page. Comme vos autres fichiers de la couche utilisateur, elle n'est jamais écrasée quand vous mettez le système à jour, et elle ne quitte votre machine qu'à l'intérieur des prompts LLM que vous choisissez d'exécuter.

### Suggérer à partir de vos données

Vous ne savez pas quoi écrire ? **✨ Suggérer à partir de mes données** lit votre suivi de candidatures et rédige un ensemble de points comportementaux — les tendances dans ce que vous poursuivez, acceptez et refusez. Exécutez le prompt qu'il vous donne dans n'importe quel LLM, examinez les suggestions et collez une version modifiée dans la note. Il n'exploite que votre propre suivi et n'invente jamais de faits ; vous relisez toujours avant que quoi que ce soit ne soit enregistré.

## 26. Statistiques (`#/stats`)

**Onglet motifs de rejet (v1.117.0).** Un quatrième onglet exécute le `analyze-patterns.mjs` du parent (lecture seule) et montre la répartition des issues, des recommandations actionnables et le taux d'avancement par fournisseur ATS (le signal de « monoculture algorithmique » — Bommasani et al., FAccT 2026). Les fournisseurs sous l'échantillon minimal portent un astérisque ; sans le projet parent, l'onglet l'indique honnêtement.

La page **Statistiques** réunit trois vues sous une même section : un rapport de marché généré par l'IA, des analyses sur votre propre pipeline, et la tendance des offres pour vos rôles cibles issue de vos scans. Passez de l'une à l'autre avec les onglets en haut.

### **Rapport de marché**

L'onglet **Rapport de marché** demande au modèle une analyse des salaires et du marché du travail pour *vos* rôles cibles — il lit votre CV et votre profil pour savoir quels rôles et quel niveau de séniorité couvrir. Saisissez une **Région / marché** (par exemple `Russia`, `EU-remote`, `US` ou `Germany`), choisissez une **Devise**, puis cliquez sur **Générer le rapport de marché**. Vous obtenez un rapport structuré avec un résumé exécutif, les salaires par grade (médiane plus P10/P25/P75/P90), les principaux employeurs, un tableau des compétences recherchées, la fréquence des avantages, la répartition présentiel/hybride/télétravail, les tendances sur 12–24 mois y compris l'impact de l'IA, et des conseils de négociation. Chaque chiffre est une **estimation indicative issue des connaissances d'entraînement du modèle** — ni extraites ni en temps réel — et le rapport le précise ; traitez les nombres comme des fourchettes, pas comme des devis. Sans clé API configurée, vous obtenez à la place un prompt à copier-coller plutôt qu'un rapport fabriqué. Utilisez **Télécharger .md**, **Enregistrer en PDF** ou **Copier** pour sortir le rapport de l'application.

### **Mon pipeline**

L'onglet **Mon pipeline** trace votre propre suivi de candidatures — rien d'externe. Il montre combien de rôles vous avez suivis, votre distribution de scores, l'entonnoir des statuts, vos principales entreprises et rôles, les candidatures dans le temps, et les taux de conversion (quelle part des candidatures atteint Applied, Responded, Interview et Offer). C'est le miroir honnête de votre recherche : il ne reflète jamais que ce qui figure déjà dans `data/applications.md`.

### **Tendance des rôles cibles**

L'onglet **Tendance des rôles cibles** est la vue d'origine : le nombre d'offres et le salaire médian par pays pour vos rôles cibles, agrégés depuis votre dernier scan, avec un sélecteur de devise et un aperçu **Offres par rôle cible**. **Enregistrer un instantané** consigne l'agrégat actuel pour que vous puissiez observer l'évolution du nombre d'offres dans le temps, et la courbe de tendance relit ces instantanés. Des données éparses sont attendues et étiquetées comme indicatives — elles ne sont jamais complétées par des nombres inventés.

### Cumul et rémunération

L'onglet **Cumul** (v1.118.0) relaie en lecture seule deux scripts parents à zéro token : `stats.mjs` — le récapitulatif cumulé de votre tracker, les taux d'entonnoir cumulés (réponse / entretien / offre), les totaux du scanner et la couverture des portails — et `salary-gap.mjs` — la rémunération souhaitée vs annoncée vs réelle par candidature, consolidée depuis les Machine Summary des rapports et `data/salary-observations.tsv`. Les petits échantillons sont marqués comme indicatifs ; sans le projet parent, l'onglet affiche une note honnête.

## 27. Plan de carrière (`#/career-plan`)

La page **Plan de carrière** transforme votre CV et votre profil en un plan de développement concret et personnalisé — du genre que vous construiriez avec un coach de carrière, mais généré à partir de vos propres documents et modifiable par vous.

### Générer un plan

Choisissez un **Horizon** (6, 12 ou 24 mois), saisissez éventuellement un **Focus** (par exemple « passer au management », « passer en télétravail » ou « basculer vers Go »), puis cliquez sur **Générer le plan**. Le modèle lit votre CV, votre profil, votre two-pager et votre note de mémoire (via le contexte de projet partagé) et rédige un plan structuré : un instantané honnête de votre point de départ, un SWOT des forces et axes de progression, des objectifs exprimés en SMART / OKR / WOOP, des trajectoires de carrière alternatives avec leurs arbitrages, un plan de compétences techniques et comportementales, une feuille de route mois par mois pour l'horizon choisi, comment suivre les progrès, les écueils probables et les actions de soutien. Chaque recommandation s'appuie sur ce que vos documents montrent réellement — le plan se projette vers l'avant, il n'invente jamais de faits sur votre parcours. Sans clé API configurée, vous obtenez à la place une invite à copier-coller.

### Modifier et enregistrer

Le plan apparaît dans une zone de texte modifiable — ajustez ce que vous voulez, puis cliquez sur **Enregistrer le plan**. Il est écrit dans la couche utilisateur de votre projet parent, dans `config/career-plan.md`, de sorte qu'il survit aux mises à jour du système et n'est envoyé qu'à l'intérieur des invites LLM que vous choisissez d'exécuter. **Aperçu** rend votre Markdown pour que vous puissiez le lire mis en forme avant de l'enregistrer.

### Exporter

Utilisez **Télécharger .md**, **Enregistrer en PDF** ou **Copier** pour sortir le plan de l'application — les mêmes commandes d'export que celles utilisées dans tous les rapports IA de l'application. Le PDF passe par le générateur PDF inline existant ; le Markdown est un téléchargement direct.

## 28. Orientation de carrière (`#/orientation`)

La page **Orientation de carrière** répond à la question « quelles directions me correspondent vraiment ? » — le genre de lecture qu'un test d'orientation vous donnerait, mais déduite de votre propre CV et profil plutôt que d'un questionnaire.

### Ce qu'elle produit

Cliquez sur **Générer le profil** et le modèle lit votre CV, votre profil, votre two-pager et votre note de mémoire et rédige un profil d'orientation de carrière : vos **vecteurs de carrière les plus adaptés** (lesquels des huit archétypes — Fonctionnaliste, Administrateur, Communicateur, Spécialiste, Analyste, Innovateur, Manager, Entrepreneur — vous correspondent le mieux, avec des preuves tirées de votre CV), une **inclinaison de type professionnel**, un ensemble de **rôles recommandés**, vos **forces professionnelles** liées à ce que montre le CV, des **tendances de style de travail** (« comment se lit votre CV » sur quelques axes) et des **recommandations de développement** pour élargir votre adéquation.

### Comment elle est générée

C'est une **réflexion d'IA sur la façon dont se lit votre CV — pas un test psychométrique.** L'invite s'appuie entièrement sur vos propres documents : elle n'invente pas de réalisations et ne rapporte jamais de scores numériques de test comme s'ils étaient mesurés. Sans clé API configurée, vous obtenez une invite à copier-coller à exécuter dans n'importe quel LLM au lieu d'un profil en direct. Rien n'est écrit sur le disque — le profil est généré à neuf à chaque fois.

### Exporter

Utilisez **Télécharger .md**, **Enregistrer en PDF** ou **Copier** pour conserver le profil — les mêmes commandes d'export que celles utilisées dans les rapports IA de l'application. Le PDF passe par le générateur PDF inline existant ; le Markdown est un téléchargement direct.

## 29. Le Manifeste CareerOps

career-ops — le projet parent que cette application habille — est la première implémentation de référence du [Manifeste CareerOps](https://career-ops.org/manifesto) (parent v1.20.0). Le manifeste nomme la pratique pour laquelle toute cette chaîne d'outils existe : mener une recherche d'emploi comme les ingénieurs font tourner la production — avec des preuves, avec de la discipline, et avec des outils du côté du candidat de la table.

### Ce qu'il dit

Six principes — « postuler mieux à moins d'offres », « le signal plutôt que le volume », « la preuve plutôt que les mots-clés », « un humain décide », « local d'abord », « la dignité des deux côtés de la table » — plus une charte des droits du candidat pour l'ère du recrutement médié par l'IA : vous êtes invisible par défaut, personne ne vous propose sans votre accord, votre accord est humain et ne peut être délégué à un agent, vous ne payez jamais, vos données vous appartiennent. L'application suit ces règles par conception : rien n'est jamais soumis automatiquement, tout s'exécute localement, et chaque affirmation d'un CV généré remonte à vos propres documents.

### Le lire et le signer

Le lien dans le pied de page de la barre latérale ouvre la page du manifeste. Vous pouvez aussi lire `MANIFESTO.md` dans le projet parent, ou y exécuter `npm run manifesto` pour ouvrir la page de signature. Signer est optionnel et prend dix secondes — votre signature devient un commit public dans le registre `SIGNATURES.md` du dépôt parent. Rien dans l'application ne dépend du fait que vous signiez ou non.

## 30. Hermes & Telegram

**Hermes, de Nous Research,** est un agent autonome ouvert — appel d’outils, skills et plus de 20 canaux de messagerie, dont Telegram. **Depuis la v1.151.0, Hermes est un fournisseur LLM branché :** lancez son API Server compatible OpenAI (`hermes gateway`), définissez `HERMES_API_KEY` dans **Réglages de l’app**, et career-ops-ui exécute ses évaluations en direct via votre Hermes local. Cette section couvre aussi l’exécution de l’app sur un serveur cloud et le pont de ses événements vers Telegram via Hermes — ces deux parties sont du guide pour opérateurs, pas des fonctionnalités de l’app. Le guide complet est `docs/integrations/HERMES.md`, et la skill `hermes-bridge` déroule les étapes.

### Ce qu'est Hermes

Hermes est un runtime d’agent qui se connecte à vos propres fournisseurs LLM — et il expose aussi un **API Server compatible OpenAI** : `hermes gateway` sert `POST /v1/chat/completions` sur `http://127.0.0.1:8642/v1` avec une clé Bearer (son `API_SERVER_KEY`). C’est pourquoi career-ops-ui le traite comme un fournisseur de plus (la voie « Shape A » du guide) : l’app envoie un POST vers cet endpoint local exactement comme pour OpenAI ou Qwen, et Hermes route la requête vers le modèle que vous avez configuré à l’intérieur. Il est **en dernier** dans l’ordre auto, donc il n’écrase jamais une configuration Anthropic/Gemini/OpenAI/Qwen existante.

### Exécuter sur un serveur cloud

career-ops-ui écoute sur `127.0.0.1` par défaut. Pour atteindre un agent Hermes qui vit sur un serveur, vous sortez du loopback — prudemment. Gardez l'application liée au loopback et placez devant un reverse proxy (nginx ou Caddy) qui termine HTTPS ; exécutez-la sous systemd ou pm2 en tant qu'utilisateur non-root ; et gardez intact le contrat en lecture seule avec le projet parent career-ops sur la machine headless. L'enveloppe de sécurité doit survivre au déplacement : une Content-Security-Policy sans scripts en ligne, la protection SSRF sur chaque fetch d'URL fournie par l'utilisateur, la frontière markdown/XSS et aucun secret dans les logs. Le guide a la liste complète — n'exposez jamais `0.0.0.0` directement sur internet.

### Telegram via Hermes

Le pont fait parvenir les événements de l'application — un scan terminé, un nouveau rapport, une relance qui vient de devenir urgente — à un chat Telegram via Hermes. Le token du bot Telegram vit dans la config de Hermes lui-même, jamais dans career-ops-ui. N'envoyez que le minimum utile : « Scan terminé — 12 nouvelles correspondances » plus un lien que vous ouvrez vous-même. **N'envoyez jamais** le texte du CV, des montants de salaire, le corps des rapports, des clés d'API ou des URL internes au canal — la liste du modèle de menaces « ce qu'il ne faut PAS exposer » du guide est la règle. Cette page est accessible depuis `#/help`, et l'assistant de documentation intégré répond aux questions en s'appuyant dessus.

## 31. Faire tourner toute la pile dans le cloud

La plupart des gens font tourner career-ops sur leur propre ordinateur portable. Mais le pipeline est à son meilleur quand il est **toujours actif** — scannant les portails pendant que vous dormez, gardant le tracker à jour, prêt dans un navigateur depuis n'importe quel appareil. Cette section est la recette de bout en bout pour installer **toute la pile** sur un petit serveur cloud : le pipeline parent **career-ops**, ce visualiseur **career-ops-ui**, et le **moteur** qui exécute l'IA — soit votre **abonnement Claude** (via la CLI Claude Code), soit une passerelle **Hermes** locale. Elle s'appuie sur les notes Hermes cloud du §30 ; la liste de contrôle complète pour l'opérateur se trouve dans `docs/integrations/HERMES.md`.

### Les trois pièces mobiles

La pile se compose de trois pièces qui coopèrent, et il est utile de bien les distinguer. **career-ops** (le parent) est le pipeline de recherche d'emploi par IA — il possède vos `cv.md`, `config/`, `reports/` et `portals.yml`, et il est piloté par une **CLI d'agent**. **career-ops-ui** (cette application) est un visualiseur web essentiellement en lecture qui se place *à l'intérieur* de career-ops comme `web-ui/` et affiche les mêmes fichiers dans un navigateur ; il n'écrit en retour que sur des actions explicites. Le **moteur** est ce qui répond réellement aux prompts d'IA. Deux des trois pièces sont identiques sur un serveur et sur votre ordinateur portable — seuls le choix du moteur et l'exposition réseau changent.

### Provisionner et installer

Louez un petit VPS (1 vCPU / 1 Go de RAM suffit largement pour le visualiseur) sous un Linux à jour, et installez **Node ≥ 18** (22.5+ est recommandé — cela active l'index SQLite du tracker du parent). Installez `git`. Faites ensuite exactement ce qu'une installation locale fait : clonez le parent `career-ops`, puis clonez ce dépôt à l'intérieur comme `career-ops/web-ui/`. Placez les clés des fournisseurs dans le `.env` du parent (ne le committez jamais — `.env` / `.env.*` sont dans le gitignore ; partez de `.env.example`). Lancez le visualiseur avec `npm start` — mais gardez-le lié à `127.0.0.1` ; vous l'exposerez via un proxy, pas directement (voir plus bas).

### Choisir votre moteur

career-ops est agnostique quant à la CLI, donc vous avez trois options honnêtes pour l'IA. **Votre abonnement Claude** — installez la CLI **Claude Code** sur la machine et faites `claude login` avec votre plan Pro/Max ; l'agent du parent utilise alors votre abonnement, sans facturation d'API au jeton. **Hermes** — exécutez `hermes gateway` sur la même machine (il expose une API compatible OpenAI sur `http://127.0.0.1:8642/v1`) et définissez `HERMES_API_KEY` dans les **paramètres de l'application** ; les évaluations en direct de career-ops-ui passent par là (en dernier dans l'ordre automatique des fournisseurs). **Clés d'API** — définissez `ANTHROPIC_API_KEY` (ou l'un des sept fournisseurs : Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes) dans le `.env` du parent, et les actions en direct ⚡ fonctionnent sans supervision. Vous pouvez les combiner : un abonnement Claude pour le travail lourd de l'agent du parent, et un fournisseur bon marché ou local pour les évaluations rapides du visualiseur.

### L'exposer en toute sécurité

Quitter `127.0.0.1` signifie que la sécurité que le loopback vous offrait gratuitement doit maintenant être construite explicitement — **le code est identique ; seule l'exposition change.** Gardez l'application liée au loopback et placez devant un reverse proxy (**nginx** ou **Caddy**) qui termine **HTTPS** (Let's Encrypt / TLS automatique) et redirige vers `127.0.0.1:4317` ; exécutez-le sous **systemd** ou `pm2` en tant qu'utilisateur dédié **non-root** avec `Restart=on-failure`. Placez l'**authentification** devant — l'application n'a pas de login propre, donc c'est le proxy (basic-auth, un forward-auth SSO, ou un réseau privé / VPN) qui empêche les inconnus d'entrer. Quand vous définissez `HOST=0.0.0.0` pour que le proxy puisse l'atteindre, le durcissement intégré qui était un no-op sur le loopback s'active et devient structurel : la limitation de débit du LLM, la défense contre le DNS-rebinding de `safeGet`, et l'assainissement des noms de chemin. Quatre invariants doivent survivre au déplacement, et vous ne devez pas les relâcher : la **CSP** (aucun script en ligne, `frame-ancestors 'none'` — le proxy ne doit pas retirer ces en-têtes), la **protection SSRF** sur chaque fetch d'URL fournie par l'utilisateur, la **frontière markdown/XSS** (`stripDangerousMarkdown()` côté serveur + `UI.md()` avec échappement en premier côté client), et **aucun secret dans les logs**. Le contrat en lecture seule du parent tient toujours sur la machine headless — le serveur ne fait que lire vos `cv.md` / `config/` / `reports/` et n'écrit que sur des actions explicites.
