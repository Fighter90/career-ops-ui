# Ajuda — career-ops-ui

Guia completo de cada página, do momento em que você abre o
aplicativo até conseguir uma entrevista. Cada cabeçalho `##` abaixo
corresponde a uma entrada da barra lateral ou a uma fase do fluxo de
trabalho. Leia de cima a baixo na primeira execução; depois pule para
uma seção específica via sumário no menu lateral de ajuda.

> **Para quem:** qualquer pessoa que acabou de colocar esta UI dentro
> de um checkout do `career-ops` e rodou `bash bin/start.sh`. Nenhum
> conhecimento prévio de career-ops é assumido.

### Sobre o career-ops

[career-ops](https://career-ops.org) é um sistema open source de
busca de emprego que roda como slash commands dentro de qualquer CLI
de programação com IA (Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI — outras CLIs compatíveis com Claude também funcionam pela mesma superfície de slash-commands). Independente de modelo. Avalia cada vaga contra seu CV
com uma rubrica de seis dimensões 0.0–5.0, gera currículos PDF
personalizados e registra cada candidatura localmente na sua máquina.

**Referência canônica (leia na ordem na primeira instalação):**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — o sistema, princípios e inventário de conceitos.
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — descubra vagas; alimente o Pipeline.
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — fluxo completo de envio com leitura de formulário via Playwright.
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — pontue 10+ JDs de uma vez via `batch-runner.sh`.
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — instale o Chromium + registre o MCP para PDF e preenchimento de
  formulários.

**Princípios fundamentais** (de
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

- **Open source, de verdade** — MIT, sem tier pago, sem lista de
  espera, sem telemetria, sem contas. O sistema opera sem tiers
  pagos, contas ou telemetria. Contribuições de código passam por
  revisão da comunidade antes da liberação.
- **Soberania de dados** — `cv.md`, `config/profile.yml`, `data/`,
  `reports/`, `interview-prep/` nunca saem do seu notebook a menos
  que você os envie explicitamente. Você roda tudo localmente na sua
  máquina, mantendo total soberania sobre seus dados.
- **Arquitetura agnóstica de IA** — career-ops NÃO empacota um
  modelo. Funciona como comandos dentro de CLIs de programação com
  IA já existentes. Troque de provedor (Anthropic ↔ Gemini ↔ OpenAI)
  e seu histórico de avaliações permanece consistente.
- **Envio controlado por humanos** — career-ops redige as respostas
  e abre o formulário, mas **você clica em Submit**. O sistema nunca
  candidata automaticamente. O sistema fornece estrutura e avaliação;
  humanos mantêm a autoridade final de envio.
- **Busca estruturada** — feito para uma busca de emprego ativa e
  deliberada, com muitas candidaturas; não é uma ferramenta de
  envio único, nem motor de recomendação. O setup leva ~15 minutos
  e assume conforto com terminal.

**O que career-ops NÃO é** (não-objetivos explícitos):

- Não é um auto-aplicador. Não envia formulários por você.
- Não é um reconstrutor de currículos. Ajusta por JD; não inventa
  experiência.
- Não é um otimizador de LinkedIn. Seu perfil é assunto seu.
- Não é uma substituição de planilha escondida atrás de uma UI SaaS.
  Os dados são markdown puro no seu sistema de arquivos.

**Conceitos-chave** (inventário completo — cada artefato que
career-ops toca):

| Conceito | O que é |
|---|---|
| **Mode** | Template de prompt em `modes/<slug>.md`. Built-in: `oferta`, `deep`, `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`, `ofertas`, `auto-pipeline`, `pdf`, `latex`, `scan`, `tracker`. |
| **Arquétipo** | Perfil de papel-alvo em `config/profile.yml`. A rubrica pondera matches de skills contra o arquétipo ativo — **o campo mais importante de todos**. |
| **Pipeline** | `data/pipeline.md` — caixa de entrada de URLs de JD aguardando avaliação. |
| **Tracker** | `data/applications.md` — tabela GFM histórica de cada avaliação + status de candidatura. |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — avaliação A–F completa por JD, com score + legitimidade no cabeçalho. |
| **Scan history** | `data/scan-history.tsv` — log append-only; previne duplicatas entre scans. |
| **Proof points** | Blocos de evidência STAR+R extraídos do `cv.md`, reaproveitados em avaliação, respostas de apply e preparação para entrevista. |
| **JD store** | `jds/jd-<date>-<ts>.txt` — descrições de vagas salvas verbatim durante a avaliação para a trilha de auditoria. |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — briefings de pesquisa profunda e one-pagers por rodada. |
| **Batch additions** | `batch/tracker-additions/*.tsv` — linhas pendentes enfileiradas pelo `batch-runner.sh` para merge no tracker. |

### career-ops vs career-ops-ui (este app)

| | career-ops (CLI) | career-ops-ui (este app) |
|---|---|---|
| Onde roda | dentro do Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI | `http://127.0.0.1:4317` no seu navegador |
| Superfície | slash commands `/career-ops <mode>` | barra lateral com uma página por workflow |
| Preenchimento de formulário | sim, via Playwright MCP | não — gera o checklist, você finaliza no CLI |
| PDF | `generate-pdf.mjs` | `📄 Generate PDF` em `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep` |
| Arquivos de dados | compartilhados com career-ops-ui | compartilhados com career-ops |

career-ops-ui é **adições puras**. Nada dentro de `career-ops/` muda.
Ambas as superfícies compartilham o mesmo `cv.md`,
`config/profile.yml`, `portals.yml`, `data/`, `reports/`,
`interview-prep/`, `modes/`.

### Limiares de ação por score

Quando um JD tem uma avaliação, o score determina o próximo passo
(tabela canônica de
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

| Score | Próximo passo |
|---|---|
| **≥ 4.5** | Rode `/career-ops apply` — alto fit, candidate-se imediatamente. |
| **4.0 – 4.4** | Candidate-se, ou `/career-ops contacto` para uma introdução calorosa antes. |
| **3.5 – 3.9** | Rode `/career-ops deep` — pesquise empresa / cargo antes de decidir. |
| **< 3.5** | Pule, a menos que tenha uma razão pessoal específica. |

O `#/dashboard` e `#/tracker` do career-ops-ui destacam cada linha
com score igual ou acima de 4.0, para você escolher uma ação sem
re-rodar nada.

### Documentação externa

Referência completa do motor career-ops subjacente (escaneamento,
rubrica de avaliação, processamento em batch, fluxo de apply, setup
do Playwright) em
[career-ops.org/docs](https://career-ops.org/docs):

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. Início rápido — passo a passo de "criar CV" até "candidatado e mensagem enviada"

Este é o playbook canônico, botão a botão. Siga em ordem na primeira
vez. Cada passo nomeia a rota exata, o botão exato e o que você verá
em caso de sucesso. As seções 2–16 abaixo aprofundam cada fase.

> **Lançamento e inicialização com um único comando.** A partir de um
> terminal você pode fazer todo o bootstrap sem tocar na interface:
>
> ```bash
> career-ops-ui setup      # instala dependências → doctor → inicia o servidor
> career-ops-ui init       # escolha o provedor LLM + cole a chave dele (eco suprimido)
> career-ops-ui doctor     # reverifique a qualquer momento (saída 0 ⇔ tudo o que é obrigatório em verde)
> career-ops-ui run        # apenas inicia o servidor em http://127.0.0.1:4317
> career-ops-ui open       # abre + TRAZ PARA FRENTE a aba do painel no seu navegador
> ```
>
> Após `setup`/`run` a aba do navegador é aberta **e trazida para a
> frente** automaticamente (v1.43.0); `career-ops-ui open` faz o mesmo
> sob demanda, então você nunca precisa procurar a aba do painel.
> `NO_OPEN=1` desativa a abertura automática em inícios headless/CI.
>
> `setup` executa toda a cadeia sozinho. `init` grava a chave no
> `career-ops/.env` do projeto pai através do mesmo caminho validado
> que a aba de chaves de API do `#/config` usa, e define
> `LLM_PROVIDER` (`auto` | `claude` | `gemini`), que as rotas ao vivo
> de avaliação / profundo / modo / pipeline automático respeitam. Forma
> para CI:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`.
> Prefere a interface? Continue com os passos abaixo.

### A. Setup (faça uma vez, ~5 minutos)

**career-ops-ui deve estar em `career-ops/web-ui/`** (aninhado dentro do projeto career-ops pai). Ele lê seu `cv.md`, `config/` e `data/` da pasta pai via `../` e não funciona de forma independente. Se `career-ops-ui init` não for encontrado após um pull, execute `cd career-ops/web-ui && npm install && npx career-ops-ui init`.

**Passo 1 — Abra o app em `http://127.0.0.1:4317`.** Se não estiver
rodando, num terminal execute `bash bin/start.sh` a partir da raiz do
repositório. O Dashboard (`#/dashboard`) carrega.

**Passo 2 — Clique em `❤ Health` na barra lateral esquerda.** Cada
verificação obrigatória deve estar verde:

- `cv.md`, `config/profile.yml`, `portals.yml` existem
- Chave de API definida (pelo menos uma de `ANTHROPIC_API_KEY` /
  `GEMINI_API_KEY`)
- Playwright instalado (apenas necessário se você for usar Generate
  PDF)

Se algo estiver vermelho, a página informa o arquivo ou variável de
ambiente exata para corrigir. Não prossiga até Health estar verde.

**Passo 3 — Clique em `⚒ App settings` na barra lateral.** Você cai
na aba **API keys & runtime**.
- Cole `ANTHROPIC_API_KEY` (preferida — melhor pontuação de
  long-form) e/ou `GEMINI_API_KEY`. Obtenha chaves em
  <https://console.anthropic.com/settings/keys> ou
  <https://aistudio.google.com/apikey>.
- Clique em **💾 Save**. Depois clique em **▶ Test Anthropic** (ou
  Gemini) — um round-trip minúsculo confirma que a chave funciona.

**Passo 4 — Mude para a aba `Profile` na mesma página.** Este é o
editor YAML direto de `config/profile.yml`. Edite no mínimo:
- `candidate.full_name` — substitua qualquer placeholder ("Jane
  Smith") pelo seu nome real
- `candidate.email`, `linkedin`, `github` — usados em cover letters
- `target.roles` — os títulos de vaga para os quais você vai se
  candidatar
- `target.comp_total_min_usd` — remuneração total mínima; ofertas
  abaixo são sinalizadas na seção D de cada avaliação
- `target.archetypes` — os padrões de carreira que você aceita
  (campo de maior impacto)

Clique em **💾 Save**. O servidor valida o YAML e carimba o cabeçalho
canônico `# Career-Ops Profile Configuration`.

### B. CV (faça uma vez, ~10 minutos)

**Passo 5 — Clique em `✎ CV` na barra lateral.** Duas colunas: editor
à esquerda, preview ao vivo à direita.

**Passo 6 — Escolha um caminho para preencher o editor:**
- **Faça upload de um currículo existente** — clique em
  **📁 Upload CV**, escolha um arquivo entre
  `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`. O
  servidor converte para markdown via pandoc ou pdftotext, sanitiza
  XSS, e coloca o resultado no editor. **Revise a conversão** — PDFs
  especialmente podem perder fidelidade de layout.
- **Cole markdown diretamente** — a área de texto é um editor
  markdown; o painel à direita é o que o LLM (e seu futuro
  recrutador) verá.
- **Dicas de tom:** um bullet = uma conquista com uma métrica.
  Mantenha abaixo de 1500 palavras. Seções nesta ordem: Summary,
  Experience, Projects, Education, Skills.

**Passo 7 — Clique em `💾 Save` (canto superior direito da página
CV).** O servidor sanitiza (`<script>` / `javascript:` / handlers
inline são removidos) e grava `cv.md`. Toast: *"Saved"*.

**Passo 8 (opcional) — Clique em `📄 Generate PDF`.** Roda
`generate-pdf.mjs` no projeto pai (Playwright necessário) e **o novo
PDF é baixado automaticamente** para o seu navegador quando termina.
A lista no rodapé da página mantém cada arquivo gerado anteriormente.

### C. Encontrar vagas (~2 minutos por scan)

**Passo 9 — Clique em `🌐 Scan` na barra lateral.** Confirme que
`portals.yml` lista os boards que te interessam (seção 5 desta
ajuda). Pressione o botão **🌐 Scan now**. Um log SSE ao vivo é
transmitido enquanto o scanner percorre Greenhouse / Ashby / Lever /
Workable / SmartRecruiters / Workday (boards em inglês) e hh.ru / Habr Career / Trudvsem / GetMatch / GeekJob (boards russos, se habilitados).

**Passo 10 — Quando o scan terminar, revise os resultados.** Clique
em qualquer tag de empresa para filtrar; clique no ícone ↗ para abrir
a página de carreiras da empresa em uma nova aba. Cada vaga que
sobreviveu ao filtro de título fica enfileirada no Pipeline.

### D. Pontuar as ofertas (~30 segundos por JD)

**Passo 11 — Clique em `Pipeline` na barra lateral.** Você vê cada
URL que o scanner enfileirou. Clique em uma entrada para visualizar o
JD inline.

**Passo 12 — Clique em `▶ Evaluate` ao lado de qualquer JD.** Isso
salta para `#/evaluate`. Com uma chave de API configurada, roda ao
vivo; sem uma, você recebe um prompt manual para colar no seu próprio
LLM. O modo ao vivo produz uma **pontuação 0–5** contra o seu CV nas
seções A–G (Papel / Empresa / Remuneração / Risco / Stretch / Fit
cultural / Veredito). Save cai em `reports/<date>-<slug>.md`.

**Passo 13 — Clique em `Reports` na barra lateral** e revise a
avaliação mais recente. Qualquer coisa abaixo do seu
`comp_total_min_usd` é sinalizada em vermelho na seção D. Qualquer
coisa com `Verdict: pursue` é sua short-list.

### E. Decidir e pesquisar a fundo a empresa shortlisted (~3 minutos)

**Passo 14 — Escolha uma vaga que valha a pena perseguir. Clique em
`Deep research` na barra lateral.** Digite o nome da empresa e o
cargo. O modelo produz um briefing de empresa em 7 seções (missão,
notícias recentes, stack tecnológico, sinais de contratação,
benchmarks de remuneração, riscos, ângulo recomendado). Save cai em
`interview-prep/<company>-<role>.md`.

### F. Candidatar (~5 minutos por candidatura)

**Passo 15 — Clique em `Apply checklist` na barra lateral.** Cole a
URL da vaga + JD. O assistente gera um checklist de envio passo a
passo:
- Rascunho de cover letter personalizado (usa seu `cv.md` +
  `profile.yml`)
- Palavras-chave específicas para espelhar do JD
- Arquivos a anexar (PDF do CV — veja passo 8)
- Onde se candidatar (a URL canônica de carreiras, não redirects de
  agregadores)
- Lembrete: **NUNCA auto-envie** — a revisão final e o envio são
  sempre manuais.

**Passo 16 — Abra a página de carreiras em uma nova aba.** Use a
checklist de apply como sua lista de tarefas. Envie pelo formulário
real da empresa. Anexe o PDF que você gerou no passo 8.

**Passo 17 — Aborde uma pessoa real.** Abra o modo **Outreach**
(`#/contacto` na barra lateral). O modelo redige uma mensagem curta
de LinkedIn / email personalizada para o briefing de empresa do
passo 14. Personalize a abertura (um detalhe específico do seu
briefing de deep research). Envie.

### G. Rastrear e dar follow-up (contínuo)

**Passo 18 — Clique em `Tracker` na barra lateral** e adicione uma
linha para a candidatura: empresa, cargo, score, status `Applied`,
link para o relatório, link para o briefing de deep research. A data
é preenchida automaticamente.

**Passo 19 — Uma semana depois: abra o modo `Follow-up`**
(`#/followup`). Redige um e-mail educado de check-in referenciando a
candidatura original. Envie. Atualize o status do tracker para
`Followed up`.

**Passo 20 — Quando receber um convite de entrevista, rode o modo
`Interview prep`** (`#/interview-prep`). Gera preparação direcionada
para a empresa específica + estágio (system design / behavioral /
coding). Puxa do briefing de deep research automaticamente.

**Passo 21 — Conseguiu a oferta? Atualize o status do Tracker para
`Offer`** e revisite a seção de remuneração do seu relatório de
avaliação — seu número mínimo de aceitação está lá.

### TL;DR — a ordem da barra lateral coincide com o workflow

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

É isso. 21 passos, botão a botão, do zero à oferta.

### Auto-pipeline de um clique (`#/auto`) — o atalho de 21 passos

Para pontuar rápido uma vaga específica, pule o passo a passo. **Barra lateral → ✨ Auto-pipeline** (ou o botão ✨ no Dashboard): cole a URL, pressione **Enter** ou **▶ Executar pipeline completo**, e o servidor roda toda a cadeia numa passagem observável:

1. **Validar URL** — verificação SSRF-segura (`isValidJobUrl`).
2. **Buscar a descrição** — `safeGet` (DNS fixado) baixa + saneia a JD.
3. **Avaliar contra seu CV** — Anthropic → Gemini → prompt manual sem key.
4. **Salvar relatório** — grava `reports/<slug>.md` com score + legitimidade.
5. **Adicionar ao tracker** — adiciona uma linha em `data/applications.md`.

Feedback é um **stepper** vertical (lista ordenada, `aria-current` no passo ativo, live-region para leitores de tela). No fim, o cartão linka ao relatório (**Ver relatório · N/5**) e ao **tracker**. Passo falho é marcado e o botão reabilita para retry sem reload. **Sem API key?** Modo manual: passos 3–5 colapsam e você recebe um prompt para copiar. Linkável: `#/auto?url=<enc>&go=1` auto-inicia.
> **CLI (v1.38.0).** Um comando faz a cadeia: `career-ops-ui setup`. Verbos: `career-ops-ui doctor` (checagem env/chaves/tooling — mesmo motor do Health; exit 1 se falhar algo obrigatório), `career-ops-ui run`, `career-ops-ui init` (assistente provedor+chave, v1.39.0).
> **Provedores (v1.39.0).** A aba API-keys adiciona um select `LLM_PROVIDER` (`auto`=Anthropic→Gemini · `claude` · `gemini`) e um campo `OPENAI_API_KEY` (lado Codex/OpenCode CLI). `career-ops-ui init` é o assistente interativo.
>
> **Provedores (v1.57.0).** A eval ao vivo headless abrange **Anthropic → Gemini → OpenAI → Qwen → OpenRouter** (ordem `auto`; `LLM_PROVIDER` fixa um). **OpenRouter** — uma `OPENROUTER_API_KEY` dá acesso a mais de 300 modelos; o dropdown `OPENROUTER_MODEL` carrega o catálogo ao vivo da OpenRouter (proxy no servidor, fallback curado offline). Também corrigido: chaves coladas com quebra de linha / espaços são aparadas antes de validar, então `/#/config` não mostra mais «validation failed» para nenhum provedor.



---

## 2. Configurações do app e chaves de API (`#/config`)

> **Novidades v1.55 → v1.56.** Sem chave LLM, um banner vermelho em cada tela explica que ⚡ Executar ao vivo está em modo de prompt manual e leva aqui; com uma chave vira um chip discreto com o provedor ativo. Antes de cada botão ⚡ Executar ao vivo (`#/auto`, `#/evaluate`, `#/deep`, modos) aparece um custo estimado honesto (ex.: "Custo estimado: OpenAI gpt-5-codex · ~$0.04/eval", ou sem custo de API no modo manual). `#/scan` recolhe filtros secundários atrás de um disclosure **Filtros avançados**; `#/tracker` adiciona chips de funil clicáveis + paginação de servidor opcional; `#/pipeline` virtualiza acima de 1000 linhas.

Duas abas:

1. **API keys & runtime** — edita o `.env` do projeto pai a partir
   do navegador (mesmo arquivo que os scripts Node do career-ops leem
   na inicialização). A aba também oferece seletores de modelo por
   provedor — `OPENAI_MODEL` (OpenAI/Codex) ao lado de
   `ANTHROPIC_MODEL` e `GEMINI_MODEL`.
2. **Profile** — editor YAML direto de `config/profile.yml`. Save
   carimba o cabeçalho canônico `# Career-Ops Profile Configuration`.

Um save em qualquer aba propaga imediatamente — sem reinício do
servidor.

**Configurar seu provedor LLM (passo a passo).** A ⚡ avaliação ao vivo do web UI roda *headless* e usa uma chave de API. Funciona via "OR" — defina **qualquer uma** destas e já funciona; com várias definidas, `auto` as prefere nesta ordem: Anthropic → Gemini → OpenAI → Qwen. (o próprio career-ops é agnóstico de CLI — você também o roda dentro de Claude Code, Codex, Gemini, OpenCode, Qwen, Copilot ou Kimi; isso é separado desta chave headless.)

1. Abra `#/config` → a aba **API keys & runtime**.
2. Escolha seu provedor em **`LLM_PROVIDER`**: `auto` (usa a chave que estiver definida), ou force um com `claude` / `gemini` / `openai` / `qwen`.
3. Preencha a chave + modelo do provedor que você escolheu:
   - **Anthropic** — defina `ANTHROPIC_API_KEY` (console.anthropic.com), opcionalmente `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`).
   - **Gemini** — defina `GEMINI_API_KEY` (aistudio.google.com/apikey), opcionalmente `GEMINI_MODEL` (default `gemini-2.0-flash`).
   - **OpenAI** — defina `OPENAI_API_KEY` (platform.openai.com), opcionalmente `OPENAI_MODEL` (default `gpt-5-codex`).
   - **Qwen** — defina `QWEN_API_KEY` (Alibaba Model Studio / DashScope, dashscope.console.aliyun.com), opcionalmente `QWEN_MODEL` (default `qwen-max`). Para o endpoint da China continental defina `QWEN_BASE_URL` no `.env` cru.
4. Clique em **Save**. As chaves são escritas no `.env` do projeto pai; a mudança surte efeito imediatamente — sem reinício do servidor.
5. Verifique em `#/evaluate`: cole uma URL/descrição de vaga e pressione **⚡ Run live**. O cabeçalho do resultado mostra qual provedor rodou (`anthropic` / `gemini` / `openai` / `qwen`). Sem nenhuma chave definida → você recebe o prompt manual de copiar-colar.

Os segredos são mascarados após salvar e nunca logados. Campos de id de modelo (`*_MODEL`) não são secretos.

### Aba Profile

> **v1.32.0 — formulário por campos.** A aba Profile não é mais um textarea de YAML bruto: agora é um formulário com seções recolhíveis **Candidato / Narrativa / Remuneração**. Ao salvar envia apenas os 14 caminhos escalares modelados; o servidor faz **merge** em `config/profile.yml`, então seus `archetypes`, `proof_points` e chaves próprias **são preservados intactos**. Trade-off: o save por campos re-serializa o YAML e **perde comentários `#`** — use o disclosure **Advanced: edit raw YAML** no fim da aba para preservá-los ou editar arrays aninhados.
> **v1.35.0 — editores de arrays.** Editores add/remove para **Target roles** e **Superpowers** (listas de texto), **Archetypes** (name/level/fit) e **Proof points** (name/url/hero-metric). Mesma garantia merge-not-replace; esvaziar uma lista remove a chave de forma limpa.
> **v1.54.3 — aba Modes como formulário estruturado.** `modes/_profile.md` não é mais um editor de markdown por seção: agora é um formulário derivado do esquema documentado. Seções de lista — **Target Roles / Adaptive Framing / Comp Targets** — são campos de linha repetíveis (adicionar/remover linhas); seções de prosa — **Exit Narrative / Location Policy** — são textareas rotuladas; qualquer seção desconhecida ou não-lista cai para um textarea rotulado verbatim. Salvar **continua fazendo merge por seção** — preâmbulo, seções intactas e seções próprias preservados byte a byte. Permanece o disclosure *Advanced: raw markdown* para editar o arquivo inteiro: adicionar/remover seções ou editar o preâmbulo.




- A área de texto mostra o `config/profile.yml` atual verbatim.
- Edite e clique em **💾 Save**. O servidor valida o YAML (precisa
  ser um mapping, precisa conter `candidate`) e grava o arquivo.
- Um cabeçalho `# Career-Ops Profile Configuration` é adicionado se
  estiver ausente.
- O resumo somente-leitura em `#/profile` é o companheiro visual.

### Chaves reconhecidas

| Chave | O que faz | Onde obter |
|---|---|---|
| `ANTHROPIC_API_KEY` | Habilita chamadas live ao SDK Anthropic. Preferida quando Anthropic + Gemini estão ambas configuradas — melhor saída estruturada long-form para pontuação de JD e deep research. | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | Sobrescreve o default `claude-sonnet-4-6`. Experimente `claude-opus-4-7` para raciocínio mais pesado, `claude-haiku-4-5-20251001` para barato-e-rápido. | — |
| `GEMINI_API_KEY` | Fallback quando não há chave Anthropic. Usado por `gemini-eval.mjs` no modo `oferta`. Free tier funciona para baixo volume. | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | Sobrescreve o modelo Gemini default. | — |
| `(server uses default UA)` | Necessário ao rodar scans do `hh.ru` de fora da Rússia (a API retorna 403 em User-Agents genéricos). Registre um app em <https://dev.hh.ru/admin> e use a string UA dele. | dev.hh.ru |
| `PORT` | Porta de bind do Express. Default 4317. | — |
| `HOST` | Endereço de bind. Default `127.0.0.1`. Configurar `0.0.0.0` expõe a UI na LAN — **sem gate de auth ainda**, veja o doc de Production-readiness. | — |

### Comportamento

- **Leitura** (`GET /api/config`) retorna cada chave reconhecida.
  Chaves secretas (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) são
  **mascaradas** — você vê `sk-ant•••••••a1b2`, nunca o valor
  completo.
- **Save** (`POST /api/config`) valida cada valor, grava em
  `<parent>/.env`, e aplica imediatamente ao processo em execução.
  Sem reinício.
- **Valor vazio deleta** a chave. Útil se você quiser deixar de usar
  uma chave hh.ru / VPN russo.

### Botões de smoke-test

Após salvar, clique em **▶ Test Anthropic** ou **▶ Test Gemini** —
ambos disparam um prompt minúsculo (≤256 tokens de saída) para você
gastar essencialmente nada confirmando que a chave está conectada
corretamente. Retorna uma amostra de ~200 caracteres em caso de
sucesso.

---

## 3. Perfil (`#/profile` — também acessível como `#/settings`)

Vista somente-leitura em card de `config/profile.yml`. **Para
editar**, vá em **App settings → aba Profile** (`#/config` →
Profile). Saves caem no mesmo arquivo; esta página faz re-parse no
reload.

Os campos que mais importam:

- `candidate.full_name` — usado em cada prompt. **Substitua o
  template `Jane Smith`** antes de escanear qualquer coisa de
  verdade, ou suas cover letters geradas sairão sob o nome
  placeholder.
- `candidate.email`, `linkedin`, `github` — referenciados na geração
  de cover letter e na checklist de apply.
- `target.roles` — títulos de vaga aceitos. O filtro positivo do
  scanner usa isso implicitamente (via `portals.yml::title_filter`).
- `target.comp_total_min_usd` — remuneração total mínima. A seção D
  de cada avaliação sinaliza ofertas abaixo disso.
- `target.archetypes` — o *campo mais importante*. Estes são os
  padrões de carreira que você aceita (ex.: `Tech-Lead-Backend`,
  `Founding-Engineer`, `Data-Platform`). Cada JD é comparado contra
  eles e o arquétipo de melhor fit aparece no cabeçalho do report.

A página Health expõe uma verificação **Profile customized** que
falha enquanto `full_name` coincidir com um nome placeholder
conhecido.

---

## 4. CV (`#/cv`)

Fonte única da verdade para cada avaliação, deep research e cover
letter. Vive em `cv.md` na raiz do projeto pai.

### Opções de edição

- **Cole diretamente** — a área de texto à esquerda é um editor
  markdown. O painel à direita espelha o que o LLM (e seu futuro
  recrutador) verá.
- **📁 Upload CV** — escolha um arquivo local em qualquer destes
  formatos e o servidor converte para markdown para você:
  - **Formatos de texto** — `.md`, `.markdown`, `.txt`, `.html`,
    `.htm` passam direto (HTML vai via pandoc → GFM markdown).
  - **Formatos Office** — `.docx`, `.doc`, `.odt`, `.rtf` são
    convertidos via **pandoc** (`brew install pandoc` no macOS,
    `apt install pandoc` no Linux).
  - **PDF** — `.pdf` é extraído via **pdftotext** do Poppler
    (`brew install poppler` / `apt install poppler-utils`).
  - O markdown convertido cai no editor; clique em **💾 Save** para
    persistir. O resultado é sanitizado (mesmo strip de XSS do
    paste).
  - Limite rígido: **10 MB** por upload. Arquivos maiores → 413.
- **A partir do LinkedIn** — caminho mais fácil: abra o Claude Code
  no projeto pai, rode `/career-ops`, cole a URL do seu LinkedIn e
  peça `extract my CV from this and write it to cv.md`.

### O que é sanitizado

No servidor, cada PUT em `/api/cv` passa por `stripDangerousMarkdown`:

- Tags `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`,
  `<style>`, `<form>` — removidas inteiramente.
- Handlers inline de evento (`onclick=`, `onerror=`, etc.) —
  removidos.
- Esquemas de URI `javascript:`, `vbscript:`, `data:text/html` —
  neutralizados.

A resposta inclui `sanitized: true` sempre que algo acima foi
removido, para você saber se a origem tinha algo nocivo.

Tamanho máximo do corpo: 1 MB. Qualquer coisa maior retorna 413.

### Outros botões

- **sync-check** — roda `cv-sync-check.mjs` no projeto pai.
  Sinaliza inconsistências: um projeto listado no seu CV mas não nos
  arquétipos de `data/applications.md`, etc.
- **📄 Generate PDF** — faz streaming de `generate-pdf.mjs`. A saída
  cai em `output/*.pdf`. Requer Playwright (a página Health mostra se
  está instalado nos `node_modules` do pai). Quando a geração
  termina, o PDF **mais novo** é baixado automaticamente para a sua
  pasta de Downloads padrão; a lista na página mantém cada arquivo
  gerado anteriormente.

### Dicas de tom / formato

- Um bullet = uma conquista com uma métrica.
  *"Reduzi a latência p99 em 38%"* bate *"melhorei a performance"* em
  qualquer rubrica de avaliação.
- Seções nesta ordem: **Summary** (3–5 linhas), **Experience**
  (cronologia reversa), **Projects** (no máximo 5), **Education**,
  **Skills** (deduplicado, sem sopa de buzzwords).
- Mantenha abaixo de 1500 palavras. A rubrica de pontuação usa
  informação densa; um CV inflado é penalizado por ruído.

---

## 5. Portais e fontes (`portals.yml`)

A configuração do scanner vive em `portals.yml` na raiz do projeto
pai. Três seções importam. As três seções da SPA (abaixo) batem com
o schema canônico de career-ops.org de
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
1:1.

> **Atalho:** a URL `#/portals` agora resolve direto para **App
> settings** e (quando há uma fonte regional configurada) salta para
> o grupo **Regional sources** — então um link `#/portals` salvo nos
> favoritos ou digitado não dá mais 404 (v1.42.0).

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

Uma vaga escaneada passa quando seu título contém **pelo menos uma
palavra-chave positiva** E **nenhuma das palavras-chave negativas**.
Ajuste os dois. As palavras-chave são substrings case-insensitive.

`seniority_boost` é a terceira chave do title-filter. Palavras-chave
listadas aqui não filtram nada — empurram vagas correspondentes para
o topo dos resultados, então um "Senior Backend Engineer" fica acima
de um "Engineer". Default: `["Senior", "Staff", "Lead"]`. Ajuste
para combinar com como seus papéis-alvo são titulados.

Comece com 3–5 palavras-chave positivas para clareza; amplie depois.

**`content_filter` (opcional — web-ui 1.75.0, parent #974).** Uma irmã de nível superior do `location_filter` com as mesmas listas de palavras-chave `positive` / `negative`, mas comparada com o texto da **descrição / snippet** de uma vaga em vez da localização:

```yaml
content_filter:
  positive: ["python", "machine learning"]
  negative: ["security clearance", "on-site only"]
```

Semântica idêntica ao `location_filter`: sem a chave → tudo passa; uma vaga com descrição **vazia/ausente** passa (dado faltante não é penalizado); um match em `negative` → rejeitada; `positive` vazio → passa; `positive` não vazio → precisa casar ao menos uma palavra-chave (substring case-insensitive). Aplicado tanto pela varredura ATS quanto pelas regionais. Apenas fontes que entregam uma descrição/snippet (ex.: RSS) são afetadas — toda outra vaga passa — então habilitá-lo nunca descarta silenciosamente linhas de fontes que não carregam corpo. Use-o para descartar uma vaga que passou pelo filtro de título mas cujo corpo revela um deal-breaker.

### `location_filter` (opcional — web-ui 1.33.0, parent #570)

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

Filtra as vagas escaneadas pela **localização** (substring, sem diferenciar maiúsculas), aplicado pela varredura ATS e pela regional. Semântica idêntica ao `scan.mjs` canônico do career-ops:

- Sem `location_filter` → todas as localizações passam (padrão).
- Localização vazia/ausente → passa (dado faltante não é penalizado).
- Match em `block` → **rejeitada** (block tem precedência sobre allow).
- `allow` vazio → passa (block já filtrou).
- `allow` não vazio → precisa casar **ao menos uma** palavra-chave.

Chave de nível superior em `portals.yml` (irmã de `title_filter`, não aninhada em `russian_portals`).

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

`search_queries` movem o scan Option B com IA (`/career-ops scan`
dentro do Claude Code / Codex). Eles NÃO são executados pelo
`npm run scan` in-process (que só bate em APIs públicas dos boards).
Use-os quando quiser descobrir papéis em empresas ainda não em
`tracked_companies`. Defina `enabled: false` para manter uma entrada
sem executá-la.

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

Campos obrigatórios por entrada: `name` e `careers_url`. Opcional:
`api` (endpoint explícito Greenhouse / Ashby / Lever / Workable /
SmartRecruiters / Workday), `enabled: true|false` para
incluir/excluir sem deletar a entrada. O scanner ATS detecta o ATS
pelo padrão da URL (`job-boards.greenhouse.io/<slug>` → Greenhouse,
etc.) e busca a boards-api pública de cada empresa diretamente.
Empresas sem um ATS reconhecível são puladas (o card **Active
Companies** em `/#/scan` as mostra em cinza com `○`).

### `rss` (RSS / Atom boards)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

Aponte o scanner para qualquer portal de vagas que publique um feed RSS/Atom (LaraJobs, WeWorkRemotely, RemoteOK, golangprojects, …) adicionando uma entrada com `provider: rss` e uma chave `rss:` (ou `feed_url:`) — **sem mudanças de código**. O adaptador RSS analisa cada `<item>` (CDATA + entidades HTML, títulos/empresas sem tags), normaliza para uma vaga e executa o mesmo fluxo `title_filter` / `location_filter` + dedup + acréscimo ao pipeline das fontes ATS. Em seguida, **RSS** aparece como fonte selecionável no menu de filtro de `#/scan`. (web-ui v1.62.x)


### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # ou apenas um
  area: 113                 # 1=Moscou, 2=SPb, 113=Rússia, 1001=remoto
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries` são matches case-insensitive de substring contra títulos de
vagas em hh.ru e Habr Career. **Cuidado com sobreposição com a lista
negativa** — se `"Senior PHP"` está em `queries` mas `"php"` acaba
em `title_filter.negative`, o scan retornará zero resultados e o
console te avisará sobre o conflito.


### Configurar os portais russos — guia detalhado

v1.29.0 inclui 5 adaptadores russos. Dois não precisam de nada além do UA padrão (`habr-career`, scraping HTML; `trudvsem`, API open-data do governo — sem key, sem barreira geográfica). Dois são scrapers HTML de portais técnicos (`getmatch`, `geekjob` — também sem key). Um é a API canônica do hh.ru, que pode retornar 403 a partir de IPs fora da Rússia, a menos que você configure a variável `HH_USER_AGENT` via **App settings → API keys & runtime** (ou rode o servidor a partir de IP russo / VPN).

#### Inventário de fontes

| Chave | Rótulo | Tipo | Auth | Restrição geográfica |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | `HH_USER_AGENT` opcional | IPs não-RU podem 403 |
| `habr` | Habr Career | HTML | nenhum | nenhuma |
| `trudvsem` | Trudvsem | JSON API (open-data) | nenhum | nenhuma |
| `getmatch` | GetMatch | HTML | nenhum | nenhuma |
| `geekjob` | GeekJob | HTML | nenhum | nenhuma |

#### Passo 1 — Abra `portals.yml`

O arquivo fica na raiz do projeto pai `career-ops/` (NÃO dentro de `web-ui/`). Se ainda não existir, copie o exemplo que vem com o projeto pai:

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### Passo 2 — Habilite as 5 fontes

Adicione ou atualize o bloco `russian_portals` listando todas as fontes que quer escanear. A ordem não importa; o scanner percorre na ordem do registry.

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

#### Passo 3 — Ajuste queries e filtros

`queries` são as strings que o scanner usa para buscar em cada fonte. Cada query roda uma vez por fonte — 4 queries × 5 fontes = 20 chamadas por scan. Mantenha a lista focada (3–7 queries) para que o scan fique abaixo do minuto. `area` é o código de região do hh.ru (as outras fontes ignoram). `per_page` limita quantas vagas cada fonte retorna por query. `only_remote: true` filtra remoto a nível de adaptador (a tabela de resultados ainda tem chip Remoto próprio).

#### Erros comuns

**Colisão com lista negativa.** Se uma palavra de query (`"php"`, `"senior"`) também está em `title_filter.negative`, todos os resultados são filtrados antes de você ver. O scanner emite aviso stderr em tempo de scan — procure pela linha `⚠ config: query "Senior PHP" contains "php" which is in the negative list`. Resolva removendo a palavra de `negative`:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### Desativar uma fonte temporariamente

Para desabilitar uma fonte sem apagar seus dados, basta remover sua chave de `sources`:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### Verificar a configuração

Depois de salvar `portals.yml`:

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

### Fluxo de bootstrap CLI ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

O setup canônico do career-ops (rode a partir da raiz do pai uma vez):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

Esse é todo o bootstrap. Edite as três seções (`title_filter`,
`tracked_companies`, `search_queries`, opcional `russian_portals`),
salve, e está pronto para escanear.

### Comportamento de bootstrap da SPA

No primeiro arranque, o servidor anexa um bloco `russian_portals:`
documentado ao `portals.yml` se ele estiver ausente — idempotente
(o segundo boot é no-op porque a linha literal `russian_portals:`
agora está lá). As seções em inglês NÃO são auto-injetadas; elas vêm
do `templates/portals.example.yml` que você copiou seguindo o
bootstrap canônico acima.

---

## 6. Saúde (`#/health`)

Cada gate de setup, em badges OK / OPTIONAL / FAIL. Leia isto antes
de abrir qualquer issue "não funciona".

### Verificações obrigatórias (sistema não funciona sem elas)

- `Node version` ≥ 18 — o servidor usa `fetch` nativo e `node:test`.
- `Project root` — que `CAREER_OPS_ROOT` (env ou auto-detectado)
  existe.
- `cv.md`, `config/profile.yml`, `portals.yml`,
  `data/applications.md`, `data/pipeline.md`, `modes/oferta.md`.

### Verificações opcionais (apenas avisos)

- `Profile customized` — `candidate.full_name` não é o placeholder
  do template.
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — configurada em `.env`.
- `(server uses default UA)` — só importa se você escanear hh.ru de
  fora da Rússia.
- `Playwright (parent node_modules)` — necessário para geração de
  PDF e `check-liveness.mjs`. Instale com
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`.
- `Parent project dependencies` —
  `cd $CAREER_OPS_ROOT && npm install` se faltarem.
- Diretórios `data/`, `reports/`, `output/`, `jds/` — auto-criados
  na primeira escrita.

Quando o servidor é exposto além de loopback (`HOST=0.0.0.0`), os
caminhos absolutos e a versão exata do Node são substituídos por
`"hidden"` na resposta para que um vizinho curioso não consiga
fingerprintar sua instalação.

### Botões de execução

- **▶ Doctor** roda `node doctor.mjs` e mostra a saída num modal.
- **▶ Verify pipeline** roda `node verify-pipeline.mjs`.

---

## 7. Busca (`#/scan`)

O scanner percorre cada board habilitado, deduplica contra seu
histórico, e grava hits em `data/last-scan.json` e
`data/pipeline.md`.

### Scan com um clique (SPA)

**🌐 Scan** roda cada fonte habilitada numa única varredura:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
  (a varredura ATS) para cada empresa em `tracked_companies` com URL
  ATS reconhecível.
- Os agregadores da v1.75.0 para cada entrada de `tracked_companies`
  que opte por um deles: RemoteOK / Remotive / Working Nomads (feeds
  remotos de todo o board, `provider: <slug>`) e IBM / Arbeitsagentur /
  Glints / Jobstreet · SEEK (orientados a configuração, com bloco
  `<provider>:` por entrada).
- API hh.ru + HTML Habr Career para cada query em `russian_portals`.

**Duas fases em um clique (v1.29.2).** O único botão 🌐 Scan dispara TANTO o sweep ATS QUANTO o regional em um único stream SSE. No log verá dois cabeçalhos de fase, na ordem:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — boards ATS EN.
2. `▶ Regional scan (hh.ru + Habr Career)` — 5 fontes RU do registry.

Cada fase termina com um resumo `✓ done · NEW=N`. Se vê só a fase ATS, seu stand está em build pré-v1.29.2 — atualize. Antes de v1.29.2 o cliente SSE fechava no primeiro `done` e a fase regional era descartada silenciosamente.

O log SSE ao vivo é transmitido ao painel direito enquanto o scan
roda. Clique em **Stop** (ou simplesmente navegue para fora) para
abortar — o servidor cancela as requisições HTTPS em voo via
`AbortController`.

### Filtrando resultados

Abaixo do log, a tabela de resultados renderiza linhas de
`data/last-scan.json`.

> **v1.78.1 — atualização automática ao vivo.** A tabela de resultados agora se
> atualiza automaticamente enquanto uma varredura roda e mais uma vez logo após
> terminar — sem recarregar manualmente nem trocar de página.

Filtros:

- **Texto livre** — match de substring contra título / empresa.
- Dropdown de **Fonte** — Arbeitsagentur / Ashby / BambooHR / Breezy HR / Comeet / GeekJob / Glints / Greenhouse / GetMatch / Habr Career / hh.ru / IBM / Jobstreet · SEEK / Lever / Personio / Recruitee / RemoteOK / Remotive / RSS / SmartRecruiters / SolidJobs / Trudvsem / We Work Remotely / Workable / Workday / Working Nomads (preenchido automaticamente a partir de `GET /api/scan/sources`).
- Dropdown **Remote / Hybrid / Onsite**.
- Dropdown **Country** (v1.78.0) — um filtro de geografia preenchido a partir dos países detectados nos resultados atuais, cada um exibido com seu emoji de bandeira e uma contagem (ex.: `🇩🇪 Germany (12)`). Escolha um para manter apenas as vagas ligadas àquele país. A detecção mapeia a localização em texto livre de uma vaga (nomes de países/aliases + ~100 grandes cidades do mercado de trabalho) para um país; é conservadora e nunca chuta, então uma vaga cuja localização não possa ser resolvida — ou um anúncio puramente "Remote" — permanece em **All countries**. Combine com o dropdown de tipo de trabalho para encontrar vagas ligadas a um país *e* remotas.
- **Chips de stack** (PHP / Go / Backend / Senior / …) —
  auto-detectados por linha por `Skills.detectTech` e
  `Skills.detectLevel`. Interseção multi-select — selecionar
  `PHP + Senior` mostra linhas que têm AMBOS.
- **Chips dinâmicos** abaixo dos chips estáticos de stack — top-25
  tokens capitalizados mais frequentes dos títulos, então a UI se
  adapta aos papéis que você realmente escaneia (marketing, design,
  finanças…) em vez de ficar travada no vocabulário de backend.

### Card Active Companies

Um card colapsável listando cada empresa em `portals.yml` com seu
status de scan:

- Tag verde ✓ — suporte direto via API (Greenhouse / Ashby / Lever /
  Workable / SmartRecruiters / Workday).
- Tag cinza ○ — fallback para prompt de web-search (sem match de API).

**Clique no nome da empresa** → preenche o filtro de resultados
acima com aquele nome. **Clique no ícone ↗** → abre a `careers_url`
da empresa em uma nova aba.

### Fluxo CLI de scan ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Duas formas de escanear pelo CLI (ambas depositam URLs no mesmo
`data/pipeline.md` que a SPA lê):

**Opção A — script direto (~30 s, zero tokens de IA):**

```bash
npm run scan                          # todos os boards Greenhouse/Ashby/Lever
npm run scan -- --dry-run             # preview sem persistir
npm run scan -- --company Anthropic   # restringe a uma empresa rastreada
```

Funciona apenas para Greenhouse / Ashby / Lever / Workable /
SmartRecruiters / Workday (URLs ATS reconhecíveis). Nenhum token de
IA consumido — bate diretamente nas APIs públicas dos boards.

**Opção B — scan com IA via navegador:**

```
/career-ops scan
```

Dentro de Claude Code / Codex / Cursor / Gemini CLI. Usa tokens do
modelo. Visita cada página de `tracked_companies` diretamente e pode
descobrir boards não-API (páginas de carreiras, ATS custom, portais
regionais). Mais lento, porém mais amplo. Útil quando uma varredura
ATS retorna nada para um alvo que você sabe que está contratando.

**Saída (ambos os caminhos)** — novas URLs de JD anexadas a
`data/pipeline.md`, cada URL visitada registrada em
`data/scan-history.tsv` (dedup entre todos os scans futuros), resumo
impresso: empresas escaneadas · vagas encontradas · filtradas por
título · duplicatas puladas · novas ofertas adicionadas.

**Limiares de ação por score** (aplique depois que
`/career-ops pipeline` pontua as novas URLs em batch):

| Score | Próximo passo recomendado |
|---|---|
| **≥ 4.5** | `/career-ops apply` — alto fit, candidate-se imediatamente |
| **4.0 – 4.4** | candidate-se, ou `/career-ops contacto` para introdução calorosa |
| **3.5 – 3.9** | `/career-ops deep` — pesquise primeiro |
| **< 3.5** | pule, a menos que tenha uma razão pessoal específica |

O `#/dashboard` e `#/tracker` da SPA destacam cada linha com score
igual ou acima de 4.0, para você escolher uma ação sem re-rodar nada.

### Comandos de follow-up

Depois de pontuar, os follow-ups canônicos são:

- `/career-ops apply` — Preenche candidatura com respostas
  personalizadas
- `/career-ops contacto` — Redige outreach por LinkedIn / email
- `/career-ops deep` — Pesquisa empresa / cargo a fundo
- `/career-ops tracker` — Vê o status do pipeline

---
### hh.ru — coletado do site (sem configuração nem proxy)

O hh.ru é coletado lendo seu site público de busca (`hh.ru/search/vacancy`), do mesmo modo que o Habr Career: **funciona de qualquer IP, sem chave, proxy ou configuração.** A API JSON (`api.hh.ru`) *não* é usada de propósito: ela agora retorna `403 forbidden` a qualquer cliente programático independentemente de IP ou User-Agent (um bloqueio anti-bot de borda, não um erro de API documentado), enquanto o site entrega resultados completos a qualquer cliente tipo navegador. Então o hh.ru funciona igual ao Habr e Trudvsem — basta mantê-lo em `russian_portals.sources` e escanear.

## 8. Vagas (`#/pipeline`)

Caixa de entrada de URLs aguardando avaliação. Vive em
`data/pipeline.md`.

### Adicionando URLs

Três formas:

- Digite / cole uma URL no input + clique em **+ Add**.
- Use a **busca global da barra superior** (o badge dela mostra **Enter**):
  cole qualquer link `http(s)://…` e aperte **Enter** para abrir o
  auto-pipeline; digite qualquer outro texto e **Enter** salta para `#/scan`
  com aquele termo pré-preenchido (v1.78.1). Ctrl/Cmd+K continua focando a
  caixa onde o navegador permite. O **logo** da marca volta ao painel.
- Rode um Scan (veja acima) — hits frescos vão para o pipeline
  automaticamente.

Cada URL passa por `isValidJobUrl()` no servidor. Loopback
(`localhost`, `127.0.0.1`), `file://`, `javascript:`, IPs literais e
strings com caracteres de template (`<`, `>`, `"`) retornam 400.

### Painel de preview server-side

Clique em qualquer linha do pipeline para carregar um preview à
direita. A maioria dos boards ATS não envia cabeçalhos CORS, então o
navegador não consegue buscá-los diretamente; o servidor faz proxy
da requisição, remove `<script>` / `<style>` / tags HTML, e retorna
até 8 KB de texto puro.

O proxy de preview percorre redirects manualmente com **validação
SSRF por hop** — cada cabeçalho `Location` passa por
`isValidJobUrl()` novamente, para que um board hostil não consiga te
bouncear para loopback / IP privada / `file://`. Limite de 3 hops,
timeout de 15 segundos.

### Ações de linha

- **▶** — salta para `#/evaluate?url=…` com a URL pré-preenchida.
- **✕** — remove a URL de `data/pipeline.md`.

### Botões do topo

- **⚡ Evaluate first** — abre a primeira URL enfileirada na página
  Evaluate, pronta para pontuar.
- **Scan** — volta para o scanner se você quiser mais URLs.

---

## 9. Avaliar (`#/evaluate`)

Pontua uma única Job Description contra `cv.md` e
`config/profile.yml`. Retorna uma avaliação estruturada A–G conforme
`modes/oferta.md` mais uma pontuação 0–5.

### Entrada

Cole o JD na área de texto, ou chegue aqui de `#/pipeline` com
`?url=<href>` — a página busca a URL através do mesmo proxy seguro
contra SSRF usado para previews do pipeline e pré-preenche a área de
texto.

Clique em **💾 Save JD** para persistir o JD em
`jds/jd-<date>-<ts>.txt` para a trilha de auditoria (ou passe
`save: true` na chamada da API — mesmo efeito).

### Cadeia de fallback

1. **Anthropic** — preferida quando `ANTHROPIC_API_KEY` está
   configurada. O servidor empacota `cv.md`, `config/profile.yml`,
   `modes/_shared.md`, e `modes/oferta.md` num bloco
   `<project_context>` antes do prompt (cada arquivo limitado a
   16 KB, prompt completo com soft-cap em 200 KB). Retorna markdown
   fundamentado diretamente à página.
2. **Gemini** — quando apenas `GEMINI_API_KEY` está configurada. O
   servidor faz spawn de `gemini-eval.mjs` com o JD como arquivo
   temporário. O modelo free-tier (`gemini-2.0-flash`) basta para
   pontuação de rotina.
3. **Manual** — sem chave. A página retorna um prompt totalmente
   formado para você colar no Claude Code, ChatGPT, ou qualquer
   outro LLM.

### Seções de saída (A–F canônico de career-ops.org)

> **Realinhamento da v1.15.0.** As letras dos blocos agora batem com
> o [schema canônico de career-ops.org](https://career-ops.org/docs).
> Reports pre-v1.15 usavam A–G (com `C=Risks`, `F=Verdict`,
> `G=Legitimacy`); ainda os renderizamos como estão para
> compatibilidade retroativa, mas novos reports emitem A–F com a
> semântica canônica abaixo. Score e Legitimidade agora vivem no
> cabeçalho do report (`score: 4.2/5`, `legitimacy: High|Medium|Low`).

A. **Role Summary** — recapitulação em 3 bullets (riscos chamados
inline).
B. **CV Match** — top 3 skills atendidas + top 3 faltantes.
C. **Strategy** — recomendação: candidate-se agora / contacto
primeiro / deep primeiro / pule. Era `Risks` antes da v1.15.
D. **Compensation** — relativo ao seu `target.comp_total_min_usd`
(legado) ou `compensation.target_range` (canônico).
E. **Personalization** — ângulo para liderar, framing por arquétipo,
ganchos para mencionar em cover letter / outreach. Era `Application
Strategy` antes da v1.15.
F. **STAR stories** — 1–3 blocos S-T-A-R prontos para colar
personalizados para o papel. Era `Verdict` (score bruto) antes da
v1.15; o score agora aparece no cabeçalho do report junto com
`legitimacy`.

### Salvando o relatório

Clique em **💾 Save report** (ou use o toggle de save na chamada da
API) para persistir o markdown em
`reports/<date>-<company>-<role>.md`. O cabeçalho parseado do
relatório (Score / Legitimacy / URL) aparece na página **Reports** e
no **Dashboard**.

### Avaliação em batch quando você tem 10+ JDs

Para um único JD, esta página `#/evaluate` é a ferramenta certa.
Para 10+ URLs enfileiradas no pipeline, o click-through por JD é
impraticável — salte para a subseção **Batch evaluate** da §14
(executando `./batch/batch-runner.sh` no projeto pai), deixe processar
durante a noite, depois volte para `#/reports` / `#/tracker` para os
resultados. Fluxo completo:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

---

## 10. Relatórios (`#/reports`)

Navegue por cada avaliação salva. Cards mostram título, data, flag
de legitimidade e score (com código de cores: verde ≥ 4.0, amarelo
≥ 3.0, vermelho abaixo).

Clique num card para ler o markdown completo. Paginação: 12 por
página; controles no rodapé.

A vista de um único relatório também tem:

- **← All reports** — volta para o grid.
- **🔗 Open JD** — abre a postagem de vaga original em uma nova aba.

---

## 11. Tracker (`#/tracker`)

O CRM. Uma linha por candidatura; vive em `data/applications.md`
como uma tabela GitHub-Flavored Markdown.

### Fluxo de status

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Rejected` / `Discarded` / `SKIP`.

O whitelist de status é aplicado no servidor; enviar qualquer outra
coisa em um `POST /api/tracker` faz default para `Evaluated`. A
transição canônica `Evaluated → Applied` é automática quando você
confirma `Submitted.` no fim de `/career-ops apply` (veja §14).

### Layout das colunas

| Coluna | O que é |
|---|---|
| `#` | Auto-numerada, com zero à esquerda (`001`, `002`, …). |
| `Date` | Data ISO (`AAAA-MM-DD`). Default para hoje. |
| `Company` | Texto livre. **Pipes (`\|`) e quebras de linha são escapados automaticamente.** |
| `Role` | Igual. |
| `Score` | Formato `N/5` (ex.: `4.2/5`). |
| `Status` | Enum com whitelist. |
| `PDF` | ✅ assim que `generate-pdf.mjs` teve sucesso para esta linha. |
| `Report` | Link markdown para o `reports/*.md` correspondente. |
| `Notes` | Texto livre, limitado a 200 caracteres. |

### Filtros

- Dropdown **Status**.
- Dropdown **Score** — `≥ 4.0` (alto), `≥ 3.0` (médio),
  `< 3.0` (baixo).
- **Search** — match de substring contra empresa + cargo.

Cada filtro reseta o paginador para a página 1. 25 linhas por
página.

### Botões de manutenção

- **▶ Normalize** roda `normalize-statuses.mjs` — re-canoniza
  grafias de status (`applied` → `Applied`,
  `interview` → `Interview`).
- **▶ Dedup** roda `dedup-tracker.mjs` — remove duplicatas
  case-insensitive por `(company, role)`.
- **▶ Merge** roda `merge-tracker.mjs` — puxa entradas pendentes de
  `batch/tracker-additions/*.tsv` (onde o fluxo batch do projeto pai
  deposita candidaturas enviadas via o assistente Apply). Deduplica e
  arquiva arquivos processados em `batch/tracker-additions/merged/`.
  Veja
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  para o fluxo batch upstream.

### Adicionando linhas

`POST /api/tracker` — corpo `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`. Dedup por `(company, role)`
case-insensitive. Na UI, a página Evaluate oferece um botão "Add to
tracker" depois de uma pontuação bem-sucedida.

---

## 12. Pesquisa (`#/deep`)

Gera um briefing estruturado de empresa: snapshot, cultura de
engenharia, notícias recentes, sentimento Glassdoor, processo de
entrevista, pontos de alavancagem para negociação, três perguntas
inteligentes para fazer ao recrutador.

### Entrada

Dois campos — nome da empresa e (opcional) cargo. O template do modo
(`modes/deep.md`) é o que molda a estrutura.

### Caminhos de saída

Mesma cadeia de fallback do Evaluate:

1. **Anthropic live** (preferida) — `bundleProjectContext` inlineia
   cv + profile + `_shared.md` + `deep.md`. Saída: 10–30 KB de
   markdown fundamentado salvos em
   `interview-prep/<company>-<role>.md`.
2. **Gemini live** — invocação de `gemini-eval.mjs`. Mesmo target
   de save.
3. **Prompt manual** — a página te entrega um prompt pronto para o
   Claude Code (que tem WebFetch + WebSearch e consegue fazer
   pesquisa real).

### Dicas

- Anthropic em `claude-sonnet-4-6` tipicamente retorna ~13 KB de
  texto útil em 1–3 minutos por chamada.
- O SDK Anthropic não tem busca web embutida. Para cargos onde você
  precisa de notícias frescas + sentimento Glassdoor, cole o prompt
  manual no Claude Code e deixe ele usar a ferramenta WebFetch.
- Execuções live são cobradas; uma chamada de deep research no
  Sonnet 4.6 custa ≈ US$ 0,30–0,50.

---

## 13. Prompts de modos (as sete páginas `/#/<mode>`)

Sete construtores de prompts: ideias de **Project**, planos de
**Training**, emails de **Follow-up**, avaliações em **Batch**,
**Outreach** para recrutadores, one-pagers de **Interview prep** e
retrospectivas de **Patterns**. Cada um encapsula um template
específico `modes/<slug>.md`:

| Página | Slug | Propósito |
|---|---|---|
| `#/project` | `project` | Personalizar um projeto de portfólio para um papel-alvo. |
| `#/training` | `training` | Análise de skill-gap → currículo. |
| `#/followup` | `followup` | Rascunho de email pós-entrevista. |
| `#/batch` | `batch` | Prompt de avaliação batch multi-JD. |
| `#/contacto` | `contacto` | Mensagem de outreach a um recrutador / referral. |
| `#/interview-prep` | `interview-prep` | One-pager de preparação para uma rodada específica. |
| `#/patterns` | `patterns` | Análise reflexiva "Que padrões me tornaram bem-sucedido?". |

### Forma compartilhada

Cada página tem um pequeno formulário (os campos são específicos do
mode), um botão **▶ Generate prompt** (manual), e — quando uma chave
Anthropic ou Gemini está presente — um botão **⚡ Run live** que
sobe a primário.

Clicar em **▶ Generate prompt** retorna o prompt montado com seus
valores do formulário JSON-stringified num bloco `User-supplied
context:`, seguido pelo template `modes/<slug>.md` verbatim. Copie e
cole no LLM da sua escolha.

Clicar em **⚡ Run live** envia o mesmo prompt para Anthropic (ou
Gemini), com `cv.md` + `profile.yml` + `_shared.md` inlineados via
`bundleProjectContext`. O resultado é renderizado na página,
copiável, e baixável como `.md`.

As sete páginas são uma allowlist explícita — modes que têm uma rota
dedicada (`oferta` → Evaluate, `deep` → Deep research) e modes que o
projeto pai suporta apenas dentro do Claude Code (`apply`, `scan`,
`pipeline`, `tracker`, `pdf`, `latex`, `ofertas`, `auto-pipeline`)
ficam fora desta UI deliberadamente.

---

## 14. Checklist de candidatura (`#/apply`)

Depois que você decidiu se candidatar, esta página de assistente
Apply gera um checklist de envio para a etapa real de candidatura.
**NÃO** auto-preenche formulários — esse fluxo permanece em
`/career-ops apply` dentro do Claude Code, que usa Playwright no
projeto pai.

### Modo checklist da SPA (`#/apply`)

O checklist da SPA é para usuários que preferem preencher o
formulário à mão sem invocar o Playwright. Cobre:

0. Rode `/career-ops apply <url>` no Claude Code para ler o
   formulário via Playwright (pule este passo se for preencher à
   mão).
1. Verifique que a postagem ainda está viva
   (`check-liveness.mjs`).
2. Confirme que o CV é o mais recente (`cv-sync-check.mjs`, depois
   PDF se score ≥ 4.0).
3. Personalize a cover letter / resposta "Why us?" usando proof
   points STAR+R do `cv.md`.
4. Responda perguntas de EEO / sponsorship / data de início com
   honestidade.
5. Salve as respostas preenchidas em
   `interview-prep/{company}-{role}.md` antes de enviar.
6. **NUNCA auto-envie** — você (humano) clica no botão final.
7. Depois do envio: adicione linha em `data/applications.md` (ou
   escreva TSV em `batch/tracker-additions/`).

### Preenchimento manual vs assistido por Playwright

Duas rotas para o envio real:

- **Manual** — abra a página de carreiras em uma aba normal do
  navegador, siga o checklist da SPA acima, copie/cole respostas.
  Não precisa de Playwright. Use quando o formulário é curto ou você
  não tem Chromium instalado.
- **Assistido por Playwright** — rode `/career-ops apply <company>`
  no Claude Code (projeto pai). O Playwright abre seu próprio
  navegador, lê cada campo do formulário, retorna respostas
  rascunho numeradas. Você ainda clica em Submit. Use quando o
  formulário é longo, dinâmico, ou você quer a trilha de auditoria
  de quais perguntas tiveram quais respostas.

### Fluxo CLI completo de apply ([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**Pré-requisitos:**

1. Rode `/career-ops pipeline` primeiro para que o JD tenha um
   relatório de avaliação em `reports/`. O comando apply depende de
   uma avaliação existente; sem uma, rode o pipeline inicialmente.
2. Tenha o report e profile carregados.
3. **Recomendado:** Playwright instalado
   (`npx playwright install chromium` — veja Setup do Playwright
   abaixo). Faz fallback para WebFetch (preview de formulário só
   texto, sem click-fill) quando ausente.

**Fluxo numerado** (8 passos canônicos):

1. **Rode o comando** com o nome da empresa:

   ```
   /career-ops apply <company>
   ```

   Exemplo: `/career-ops apply Anthropic`. Sem argumento, forneça
   um screenshot do formulário, o texto do formulário colado, ou a
   URL da candidatura no próximo turno.

2. **Localiza o report.** O sistema encontra a avaliação
   correspondente em `reports/` (a que foi criada por
   `/career-ops pipeline` ou `#/evaluate` antes).

3. **Abre o formulário.** O Playwright lança uma janela do
   navegador **automaticamente** — você NÃO o abre você mesmo.

4. **Lê os campos.** O sistema lê e parseia cada campo do
   formulário (label, tipo, obrigatório, opções para selects).

5. **Gera respostas.** career-ops cria respostas personalizadas
   para cada campo com base no seu profile, proof points e o papel.

6. **Retorna lista numerada.** Você recebe respostas ordenadas para
   coincidir com o layout do formulário — campos simples (nome,
   email) primeiro, campos de texto livre (cover letter, "Why
   us?") por último. Itens sinalizados apontam coisas que precisam
   de atenção humana — âncora de salário, detalhes ausentes do
   currículo, perguntas opcionais.

7. **Preenchimento manual.** Você copia e cola cada resposta no
   campo correspondente. Este passo é manual, não automatizado.
   Você revisa cada resposta primeiro.

8. **Usuário envia.** Você clica em Submit você mesmo. career-ops
   **nunca** clica em Submit. Confirme a conclusão digitando no
   chat:

   ```
   Submitted.
   ```

**Atualizações automáticas em `Submitted.`:**

- Status muda `Evaluated → Applied` em `data/applications.md`.
- As respostas preenchidas persistem na Seção G do report para
  referência futura.

**Handoff ao tracker:**

```
/career-ops tracker
```

Monitore o status de todo o seu pipeline, independentemente do score
do papel.

### Batch evaluate ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

Quando você tem 10+ JDs para pontuar de uma vez (o `#/evaluate` um a
um da SPA é impraticável nesse volume), use o batch runner pelo CLI.

**Arquivo de entrada — `batch/batch-input.tsv`** (separado por
tabulação):

| Coluna | Propósito |
|---|---|
| `id` | Número sequencial único |
| `url` | Link completo da postagem da vaga |
| `source` | Plataforma de origem (LinkedIn, Greenhouse, etc.) |
| `notes` | Detalhe contextual opcional |

Linha de exemplo:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**Flags do `./batch/batch-runner.sh`:**

- `--dry-run` — Preview de ofertas pendentes sem avaliação. Sempre
  rode isto primeiro para validar o TSV.
- `--parallel N` — Roda N workers simultaneamente (1, 2, ou 3
  recomendados).
- `--min-score X.X` — Pula a persistência de ofertas com score
  abaixo do limiar. Útil para manter relatórios apenas para papéis
  de alto fit.
- `--retry-failed` — Reprocessa apenas as ofertas que erraram na
  execução anterior (falhas de rede, limitação de taxa).
- `--max-retries N` — Tenta ofertas falhas até N vezes (default: 2).
- `--model NAME` — Modelo Claude passado para `claude -p --model` (career-ops 1.8.0, #504). Sem valor = o modelo padrão da sua assinatura Claude Max. Use um mais barato para lotes grandes, ex. `claude-sonnet-4-6`. Em `#/batch` aparece como o campo **Modelo** (web-ui 1.31.0).
- `--start-from N` — Pula IDs de vaga abaixo de N (retoma um lote parcialmente processado). Em `#/batch` aparece como o campo **A partir de #** (web-ui 1.31.0).

**Sequência padrão:**

1. **Edite** `batch/batch-input.tsv` — uma linha por JD.

2. **Dry-run** (recomendado primeiro):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **Rode** — sequencial ou paralelo:

   ```bash
   ./batch/batch-runner.sh                       # um de cada vez
   ./batch/batch-runner.sh --parallel 2          # dois concorrentes
   ./batch/batch-runner.sh --parallel 3          # três concorrentes
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # persiste apenas alto fit
   ```

4. **Retry falhas** (rede / limitação de taxa):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **Reports** caem em `reports/` como
   `{id}-{company}-{AAAA-MM-DD}.md`. Linhas de resumo são anexadas a
   `batch/tracker-additions/`.

6. **Merge no tracker:**

   ```bash
   node merge-tracker.mjs                 # aplica as adições do batch
   node merge-tracker.mjs --dry-run       # preview do merge
   ```

   O comando merge deduplica entradas e arquiva arquivos processados
   em `batch/tracker-additions/merged/`.

A SPA expõe os relatórios resultantes em `#/reports` (paginados,
score-pill colorido) e as linhas do tracker em `#/tracker` —
exatamente como se você tivesse adicionado cada uma via `#/evaluate`.
Combine com o botão de manutenção **▶ Merge** em `#/tracker` se
preferir não descer ao CLI.

### Setup do Playwright ([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

Necessário para duas features do career-ops:

- **Preenchimento de formulário** em `/career-ops apply` (passo 3
  acima — Playwright abre o navegador, lê labels de campos, sugere
  respostas).
- **Geração de PDF** via `/career-ops pdf` e o botão
  **📄 Generate PDF** da SPA em `#/cv` / `#/reports/:slug` /
  `#/evaluate` / `#/deep` / `#/interview-prep`.

**Fallback quando o Playwright está ausente:** o fluxo de apply faz
fallback para WebFetch (preview de formulário só texto, sem
click-fill). A geração de PDF simplesmente dá erro.

**Setup principal (rode a partir da raiz do projeto pai
career-ops):**

```bash
# Instala o Chromium para o Playwright
npm install
npx playwright install chromium

# Registra o Playwright MCP para que o Claude Code consiga dirigir formulários
claude mcp add playwright npx @playwright/mcp@latest

# Verifica os três componentes (Chromium, lib Playwright, MCP)
npm run doctor
```

**Registro alternativo do MCP** — adicione a
`.claude/settings.local.json`:

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

**Notas de comportamento:**

- **Headless por padrão.** O Playwright opera silenciosamente. Para
  observar o navegador em ação, diga ao Claude `open up with
  playwright the browser and fill out the entire form.`
- **Três papéis em um pacote** — o npm install do Playwright te dá
  a biblioteca de automação de navegador, o motor de renderização
  de PDF para `/career-ops pdf`, e (via o MCP) o workflow de
  preenchimento de formulário dentro do Claude Code.
- **Verifique antes de confiar** — `npm run doctor` confirma que
  todos os três estão operacionais. A página Health da SPA expõe uma
  verificação `Playwright (parent node_modules)` que falha rápido se
  estiver ausente.

---

## 15. Preparação para entrevistas

Esta é a fase pós-research, pré-entrevista. Três artefatos neste app
convergem:

1. **Arquivos de deep research salvos** em `interview-prep/`, um por
   par empresa-cargo que você rodou. Navegue da página **Deep
   research** ou diretamente via `/api/interview-prep`.
2. **Modo Patterns** (`#/patterns`) — gera um prompt
   auto-reflexivo: "ao longo das minhas últimas N entrevistas /
   ofertas / rejeições, que padrões se mantêm?" Útil quando você
   acumulou 5+ linhas no tracker.
3. **Modo Interview-prep** (`#/interview-prep`) — pré-preenche um
   one-pager para uma rodada específica que vai acontecer
   (behavioral, técnica, system design). A saída vai para a mesma
   pasta `interview-prep/`.

### Workflow recomendado

Para cada entrevista que você tem agendada:

1. **Re-rode Deep** (ou abra o arquivo salvo) no dia anterior.
2. **`#/interview-prep`** — gere um one-pager para a rodada
   específica. Cole nas suas anotações.
3. **Rodadas de system design / coding** — abra `#/training` e peça
   um refresher direcionado de 30 minutos sobre o subsistema
   específico que o JD enfatiza.
4. **Rodadas de remuneração** — abra o arquivo de deep research,
   salte para "Negotiation leverage points." Traga 2–3 datapoints
   específicos (banda Glassdoor, funding recente, oferta comparável
   em outra empresa).
5. **Rodadas behavioral** — puxe histórias STAR+R do seu `cv.md`
   que caem na seção B do report Evaluate original.

Depois da entrevista, imediatamente:

1. Atualize a linha do tracker: status → `Responded` (depois
   `Interview`, `Offer`, etc.).
2. Rode `#/followup` para redigir o email de agradecimento.
3. Se você conseguiu nova informação (faixa de remuneração,
   composição do time, surpresa de stack), edite o
   `interview-prep/<company>-<role>.md` salvo com
   `## Post-round notes` para que o seu eu-futuro tenha.

---

## 16. Activity log + Solução de problemas

### Activity log (`#/activity`)

Trilha de auditoria de cada requisição que altera estado e que bate
no servidor. Registra: adições ao pipeline, escritas no tracker,
saves de CV, saves de JD, execuções de evaluate, execuções de deep
research, execuções de scan, mudanças de config, execuções de mode.

Segredos (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) são redigidos na
entrada; você nunca verá um valor real de chave em
`data/activity.jsonl`.

Filtre por prefixo de ação (`pipeline.`, `cv.`, `evaluate`, `scan.`,
etc.). 25 linhas por página; o servidor retorna até os 500 eventos
mais recentes.

### Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Página Health em vermelho no `cv.md` | Primeira execução, arquivo ainda não existe | `touch $CAREER_OPS_ROOT/cv.md` e dê refresh. |
| Health vermelho em `Profile customized` | `candidate.full_name` ainda é `Jane Smith` | Edite `config/profile.yml`. |
| `hh.ru: HTTP 403` no log do scan | IP não-russo, sem `(server uses default UA)` | Registre em `dev.hh.ru/admin`, configure um IP russo / VPN. |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | Dependências do projeto pai não instaladas | `cd $CAREER_OPS_ROOT && npm install`. |
| Erros no Generate PDF | Playwright não instalado no pai | `cd $CAREER_OPS_ROOT && npx playwright install chromium`. |
| `/career-ops apply` diz "no report found" | O pipeline nunca pontuou este JD | Rode `/career-ops pipeline` (ou `#/evaluate`) primeiro; veja os pré-requisitos da §14. |
| `batch-runner.sh: no such file` | Rodando do diretório errado | `cd $CAREER_OPS_ROOT` antes de invocar `./batch/batch-runner.sh`. |
| Servidor reporta `EADDRINUSE: 4317` | Instância antiga ainda rodando | `pkill -f 'node server/index.mjs'` e reinicie. |
| Chamada LLM live trava > 2 min | Prompt enorme ou Anthropic lento | Verifique a flag Anthropic em `/api/health`; o servidor faz soft-cap em prompts de 200 KB e retorna 413. |
| Preview do pipeline mostra `(unsafe redirect)` | Postagem redirecionou para um IP privada / loopback | Esta é uma feature de segurança (REVIEW-B1). O alvo do redirect é rejeitado e a URL original permanece inalterada. |
| Texto da linha do tracker quebra a tabela | Pipe no nome da empresa pre-v1.9.1 | Atualize para v1.9.1+ — pipes são escapados ponta a ponta (BF-1). |
| `npm test` falha em clone fresco | Os testes assumem layout do projeto pai | Use `CAREER_OPS_ROOT=$(mktemp -d)` e bootstrap fixtures. |

Para diagnóstico mais profundo: rode **▶ Doctor** na página Health,
copie a saída, e busque a issue no rastreador em
<https://github.com/Fighter90/career-ops-ui/issues>.


---

## 17. Como adicionar uma nova fonte de portal de vagas

O career-ops-ui trata cada job board como um **adapter** — um único arquivo em
[`server/lib/sources/<slug>.mjs`](../../server/lib/sources/) que sabe
como buscar e normalizar os resultados de um portal. A partir da v1.79.0 o
registry [`server/lib/sources/`](../../server/lib/sources/) inclui **26**
adapters — 21 em inglês (os ATSes Greenhouse / Ashby / Lever / Workable /
SmartRecruiters / Workday, RSS e os agregadores da v1.75.0 RemoteOK /
Remotive / Working Nomads / IBM / Arbeitsagentur / Glints / Jobstreet · SEEK, e BambooHR / Breezy HR / Comeet / Personio / Recruitee / SolidJobs, e We Work Remotely)
e 5 boards russos. Os sete agregadores adicionados na v1.75.0 são fontes de
todo o board ou orientadas a configuração, e não ATSes por empresa: os três
feeds remotos são selecionados com `provider: remoteok|remotive|workingnomads`,
e os quatro regionais (IBM / Arbeitsagentur / Glints / Jobstreet · SEEK) leem
um bloco de configuração `<provider>:` por entrada — veja a §5 para o YAML e
`docs/portals-examples.md` para entradas prontas para copiar e colar.

> **v1.69.0 (P-14) — auto-descoberta drop-in.** Adicionar uma 12.ª fonte é agora
> um **drop puro de arquivo**. O registry
> ([`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs))
> não mantém mais uma lista manual — na inicialização ele escaneia esta pasta
> (`readdirSync` + dynamic `import()`) e coleta o bloco `export const meta`
> de cada `*.mjs`. Escreva o adapter, declare seu `meta`, e ele aparece
> imediatamente no scanner, no dropdown de filtros do `#/scan` e no
> dispatcher RU — **sem nenhuma edição em `registry.mjs`**. (Fontes RU ainda precisam
> de uma linha no `portals.yml` do projeto pai; veja o Passo 5.)

### Passo 1 — Escreva o adapter

Crie `server/lib/sources/<slug>.mjs`. Dois padrões funcionam dependendo de
se a fonte tem uma API JSON ou só renderiza HTML:

**Fonte com API** (mais limpo — use sempre que o site tiver um
endpoint de dados aberto):

```js
// server/lib/sources/example.mjs
const ENDPOINT = 'https://example.com/api/v1/vacancies';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...';

// v1.69.0 (P-14) — metadados auto-descritivos. O registry auto-descobre
// este bloco na inicialização; ISTO é o que registra a fonte (veja o Passo 2).
export const meta = {
  value: 'example',          // ← deve ser igual ao job.source escrito abaixo
  label: 'Example.com',      // ← exibido no dropdown de filtros do #/scan
  region: 'ru',              // ← 'en' (varredura ATS) | 'ru' (dispatcher regional)
  configKey: 'example',      // ← apenas RU; a chave usada no portals.yml
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
    source: 'example',           // ← deve corresponder ao `meta.value` exatamente
  };
}
```

**Fonte com HTML-scrape** (quando não há API — veja
[`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) e
[`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) para exemplos completos):

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

Três contratos que todo adapter DEVE honrar:

- **Exportar um bloco `meta` válido** (veja o Passo 2). Sem ele o registry
  ignora silenciosamente o arquivo (um `console.warn` na inicialização) e a fonte
  nunca aparece.
- **Aceitar `{ onlyRemote, fetchImpl, signal }` em `opts`.** `fetchImpl`
  é o que torna os adapters testáveis sem rede; `signal` é necessário
  para propagação de desconexão do cliente (REVIEW-B3).
- **Retornar registros com o formato comum** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`, onde `source` corresponde ao
  `meta.value`.

### Passo 2 — Declare o `meta` do adapter (auto-registro)

Este é o passo completo de registro. **Você não edita `registry.mjs`.**
Basta garantir que o adapter exporte um bloco `meta` — o registry
o auto-descobre na inicialização:

```js
// at the top of server/lib/sources/example.mjs
export const meta = {
  value: 'example',          // job.source value AND #/scan option.value
  label: 'Example.com',      // display label in the dropdown
  region: 'ru',              // 'en' | 'ru'
  configKey: 'example',      // RU only — key in portals.yml::russian_portals.sources
};
```

Como a descoberta valida (um arquivo que falha em qualquer regra é ignorado, com um
aviso `[sources/registry]`, para que uma branch parcialmente migrada permaneça diagnosticável):

- `value` — string não vazia. DEVE corresponder ao `job.source` do seu adapter.
- `label` — string não vazia.
- `region` — exatamente `'en'` ou `'ru'`; qualquer outro valor é rejeitado.
- `configKey` — **obrigatório** para `region: 'ru'`, ignorado para `'en'`.

`region: 'en'` entra na varredura ATS (auto-descobre a partir dos padrões de URL de
`tracked_companies`); `region: 'ru'` entra no dispatcher regional. A API pública
(`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`) é
reconstruída a partir de cada `meta` descoberto, ordenado `en` primeiro depois `ru`,
alfabético por label dentro de cada região — assim a ordem do dropdown permanece
estável para os usuários.

### Passo 3 — Conecte ao dispatcher (apenas RU)

Fontes ATS EN se auto-descobrem a partir dos padrões de URL de `tracked_companies` —
sem mais configuração necessária. Para fontes RU, abra
[`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs), encontre
a tabela `RU_DISPATCH`, e adicione uma linha:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

O loop do dispatcher chama `entry.search(query, opts)` para cada chave
presente em `cfg.sources`. Nenhuma outra alteração de código é necessária.

### Passo 4 — Teste (mockado, nunca em rede real)

Crie um arquivo em `tests/sources-<slug>.test.mjs`. Rede real é
**proibida** nos testes (contrato CI-isolation):

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

### Passo 5 — Habilite no seu `portals.yml`

O `portals.yml` do projeto pai é a config do usuário. Adicione o
`configKey` da nova fonte ao array:

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

Recarregue `#/scan` no navegador. O dropdown do filtro de fonte capta a
nova entrada automaticamente (única fonte da verdade via
[`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs)). O
botão 🌐 Scan agora inclui a nova fonte em cada varredura regional.

### Adapters de referência (espelhe estes para novas fontes)

| Arquivo do adapter | Tipo | Notas |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | Adapter de API RU canônico; fallback de UA ciente de geo. |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | Open-data do governo russo; sem barreira de IP. |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML scrape | Quadro tech russo; parser de cards baseado em regex. |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML scrape | Parser defensivo, `[]` em falha de parse. |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML scrape | Mesmo estilo defensivo do GetMatch. |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | Adapter ATS EN canônico; usa o padrão de URL `tracked_companies`. |

### Pitfalls comuns

- **Esquecer o `export meta`.** Desde a v1.69.0 o bloco `meta` é a
  *única* coisa que registra uma fonte. Sem `meta` (ou com um malformado) =
  o arquivo é ignorado silenciosamente na inicialização com um único aviso
  `[sources/registry] <file> has no valid \`export const meta\` — skipped`,
  e a fonte nunca chega ao dropdown. Verifique o log do servidor
  se um adapter novo não aparecer.
- **Divergência do campo `source`.** A string escrita pelo seu adapter DEVE
  corresponder ao `meta.value` exatamente. Se divergirem, o
  dropdown do filtro de `#/scan` mostrará a fonte mas ao selecioná-la
  filtrará todas as linhas (porque a verificação de igualdade é `r.source === fs`).
- **Lançar exceção em falha de parse.** Scrapers HTML DEVEM retornar `[]` num
  200 saudável sem cards parseáveis. Lançar exceção quebra o loop do
  dispatcher multi-fonte — uma estrutura HTML ruim mata todas as outras fontes para
  a mesma consulta.
- **Esquecer `fetchImpl` / `signal`.** Sem eles, seu adapter
  não pode ser testado em unit tests sem acessar a rede real, e desconexões do
  cliente não se propagam (o fetch em background segue vivo após o
  usuário fechar a aba).
- **Confiar em `tracked_companies` para RU.** Essa lista é só para fontes
  ATS EN. Os adapters RU se autoabastecem a partir de
  `russian_portals.queries` — sem entradas por empresa.

---

## 18. Notificações (🔔 na barra superior)

> v1.58.34 — todo toast no canto inferior direito também é capturado em um diário in-memory (limite 50, mais antigos descartados). Clique no 🔔 da barra superior para abrir o drawer **Notificações** e revisar o que perdeu. O diário é por aba/sessão — fechar a aba o limpa.

O drawer **só abre ao clicar no sino** (ou Enter / Space com foco). Nunca abre sozinho. O badge vermelho conta entradas não vistas; abrir o drawer reseta o badge.

### Categorias

| Categoria | Quando dispara | Pista visual |
|---|---|---|
| **Sucesso** | `Salvo`, `Copiado`, `Atualizado`, scan completo, CV importado, ações de apply-checklist, perfil salvo | borda esquerda verde; toast verde |
| **Erro** | URL inválida, erros de API com postfix `(MÉTODO /caminho · HTTP NNN)`, falhas de rede, duplicatas de pipeline-400, doctor/verify exit ≠ 0 | borda esquerda vermelha; toast vermelho; postfix em `Detalhes` (U-4) |
| **Info / progresso** | `Running doctor.mjs…`, `Refreshing…`, `Loading…`, progresso do scan | borda esquerda cinza |

Cada entrada mostra hora local, mensagem humana e, se houver, postfix técnico em monospace.

### O que NÃO é notificação

- Modal de resultado de Doctor / verify (modal, não toast).
- Linhas SSE em `#/scan` / `#/auto` (vão direto pro corpo da página).
- Estados de spinner sem toast.

### Teclado

- **Clique** ou **Enter / Space** no sino → abrir.
- **Esc**, **×**, ou novo clique no sino → fechar; foco volta ao sino.


## 19. Localizar o app para o seu idioma

A interface é distribuída em 9 idiomas (English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文). Cada rótulo na tela vem de um dicionário de traduções, e você pode adicionar ou corrigir um idioma sem mexer na lógica do app.

**Onde ficam as traduções.** Desde a v1.60.0 cada idioma é um arquivo próprio em `public/js/lib/locales/` — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.ru.js`, etc. — uma lista simples de pares `'chave': 'texto'`. Um `i18n-dict.aliases.js` compartilhado faz com que chaves que devem ler igual (um rótulo do menu e o título da sua página) apontem para uma única tradução. `i18n-dict.js` monta tudo no carregamento; você nunca o edita.

**Corrigir ou adicionar um texto.** Abra o arquivo do seu idioma, encontre a chave (ex.: `'nav.scan'`) e edite o texto. Para adicionar um rótulo novo, acrescente a mesma chave aos **8** arquivos de idioma com o valor traduzido e use-a na página via `t('sua.chave')`. Rode `npm test` — ele falha se algum idioma estiver sem a chave, então nada é publicado pela metade.

**Adicionar um idioma novo.** Copie `i18n-dict.en.js` para `i18n-dict.<código>.js`, traduza cada valor e registre o código em `i18n.js` (a lista de idiomas + autodetecção do navegador), no montador `i18n-dict.js`, e adicione uma linha `<script>` em `index.html`. O checklist completo — incluindo o snapshot de testes e os arquivos de ajuda / README — está em `docs/LOCALIZATION.md`.

**Bom saber.** O seletor de idioma fica no rodapé da barra lateral; sua escolha é lembrada por navegador. As mensagens de diagnóstico do servidor permanecem em inglês de propósito (para os logs ficarem consistentes) — apenas a interface na tela é traduzida.

Veja **`docs/LOCALIZATION.md`** no repositório para o guia de localização completo, passo a passo.
