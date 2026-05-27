# Ayuda — career-ops-ui

Recorrido completo por cada página, desde el momento en que arrancas
la app hasta conseguir una entrevista. Cada encabezado `##` de abajo
corresponde a una entrada del sidebar o a una fase del workflow. Lee
de arriba a abajo en el primer arranque; después salta a la sección
concreta vía el índice del sidebar de ayuda.

> **Audiencia:** cualquiera que acaba de poner este UI dentro de un
> checkout de `career-ops` y ejecutó `bash bin/start.sh`. No se asume
> conocimiento previo de career-ops.

### Sobre career-ops

[career-ops](https://career-ops.org) es un sistema open-source de
búsqueda de empleo que se ejecuta como slash-comandos dentro de
cualquier CLI de codificación con IA (Claude Code, Codex, OpenCode, Qwen CLI — otras CLIs compatibles con Claude también funcionan vía la misma superficie de slash-comandos). Modelo-agnóstico. Evalúa cada puesto
contra tu CV con una rúbrica de seis dimensiones 0.0–5.0, genera CVs
PDF adaptados, y registra cada candidatura localmente en tu máquina.

**Referencia canónica (léela en orden en la primera instalación):**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — el sistema, los principios y el inventario de conceptos.
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — descubre vacantes; alimenta el Pipeline.
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — flujo de envío completo con la lectura de formularios de Playwright.
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — puntúa 10+ JDs a la vez vía `batch-runner.sh`.
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — instala Chromium + registra el MCP para PDF y form-fill.

**Principios fundamentales** (de
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

- **Open source, en serio** — MIT, sin tier de pago, sin lista de
  espera, sin telemetría, sin cuentas. El sistema funciona sin niveles
  de pago, cuentas ni telemetría. Las contribuciones de código pasan
  revisión comunitaria antes del release.
- **Soberanía de datos** — `cv.md`, `config/profile.yml`, `data/`,
  `reports/`, `interview-prep/` nunca salen de tu portátil salvo que
  los subas explícitamente. Lo ejecutas en local, conservando la
  soberanía total de tus datos.
- **Arquitectura AI-agnóstica** — career-ops NO empaqueta un modelo.
  Funciona como comandos dentro de las CLIs de codificación con IA
  existentes. Cambia de proveedor (Anthropic ↔ Gemini ↔ OpenAI) y tu
  historial de evaluaciones se mantiene consistente.
- **Envío controlado por humanos** — career-ops redacta las respuestas
  y abre el formulario, pero **tú haces clic en Submit**. El sistema
  jamás auto-aplica. Aporta estructura y evaluación; el humano
  conserva la autoridad final sobre el envío.
- **Búsqueda estructurada** — pensado para una búsqueda activa y
  deliberada con muchas candidaturas; no es una herramienta de envío
  único ni un motor de recomendaciones. La instalación lleva ~15
  minutos y asume soltura con la terminal.

**Lo que career-ops NO es** (no-objetivos explícitos):

- No es un auto-applier. No enviará formularios por ti.
- No es un reconstructor de currículum. Adapta por JD; no inventa
  experiencia.
- No es un optimizador de LinkedIn. Tu perfil es asunto tuyo.
- No es un sustituto de hoja de cálculo escondido tras un UI SaaS. Los
  datos son markdown plano en tu sistema de archivos.

**Conceptos clave** (inventario completo — cada artefacto que
career-ops toca):

| Concepto | Qué es |
|---|---|
| **Mode** | Plantilla de prompt bajo `modes/<slug>.md`. Built-in: `oferta`, `deep`, `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`, `ofertas`, `auto-pipeline`, `pdf`, `latex`, `scan`, `tracker`. |
| **Arquetipo** | Un perfil de rol objetivo en `config/profile.yml`. La rúbrica pondera coincidencias de skills contra el arquetipo activo — **el campo más importante**. |
| **Pipeline** | `data/pipeline.md` — inbox de URLs de JD pendientes de evaluación. |
| **Tracker** | `data/applications.md` — tabla GFM histórica de cada evaluación + estado de candidatura. |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — evaluación A–F completa por JD, con puntuación + legitimidad en el header. |
| **Scan history** | `data/scan-history.tsv` — log append-only; previene duplicados entre scans. |
| **Proof points** | Bloques de evidencia STAR+R extraídos de `cv.md`, reutilizados a través de evaluación, respuestas de apply y preparación de entrevistas. |
| **JD store** | `jds/jd-<date>-<ts>.txt` — descripciones de empleo verbatim guardadas durante la evaluación para el audit trail. |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — briefings de deep research y one-pagers por ronda. |
| **Batch additions** | `batch/tracker-additions/*.tsv` — filas pendientes encoladas por `batch-runner.sh` para su merge al tracker. |

### career-ops vs career-ops-ui (esta app)

| | career-ops (CLI) | career-ops-ui (esta app) |
|---|---|---|
| Dónde corre | dentro de Claude Code / Codex / OpenCode / Qwen CLI | `http://127.0.0.1:4317` en tu navegador |
| Superficie | slash-comandos `/career-ops <mode>` | sidebar con una página por workflow |
| Form-fill | sí, vía Playwright MCP | no — genera la checklist, tú la completas en el CLI |
| PDF | `generate-pdf.mjs` | `📄 Generate PDF` en `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep` |
| Archivos de datos | compartidos con career-ops-ui | compartidos con career-ops |

career-ops-ui son **puramente adiciones**. Nada dentro de
`career-ops/` cambia. Ambas superficies comparten el mismo `cv.md`,
`config/profile.yml`, `portals.yml`, `data/`, `reports/`,
`interview-prep/`, `modes/`.

### Umbrales de acción por puntuación

Una vez que un JD tiene una evaluación, la puntuación determina qué
hacer a continuación (tabla canónica de
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

| Puntuación | Siguiente paso |
|---|---|
| **≥ 4.5** | Ejecuta `/career-ops apply` — fit alto, envía de inmediato. |
| **4.0 – 4.4** | Aplica, o `/career-ops contacto` para warm intro primero. |
| **3.5 – 3.9** | Ejecuta `/career-ops deep` — investiga la empresa / rol antes de decidir. |
| **< 3.5** | Salta salvo que tengas un motivo personal específico. |

El `#/dashboard` y el `#/tracker` de career-ops-ui resaltan cada fila
en 4.0 o por encima para que puedas tomar acción sin re-ejecutar
nada.

### Documentación externa

Referencia completa del motor career-ops subyacente (scanning, rúbrica
de evaluación, procesamiento batch, flujo de apply, setup de
Playwright) en
[career-ops.org/docs](https://career-ops.org/docs):

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. Inicio rápido — paso a paso de "crear CV" hasta "postulado y mensajeado"

Este es el playbook canónico botón-por-botón. Síguelo en orden la
primera vez. Cada paso nombra la ruta exacta, el botón exacto, y qué
verás al éxito. Las secciones 2–16 entran en profundidad en cada fase.

> **Lanzamiento e inicialización con un solo comando.** Desde una
> terminal puedes hacer todo el arranque sin tocar la interfaz:
>
> ```bash
> career-ops-ui setup      # instala dependencias → doctor → arranca el servidor
> career-ops-ui init       # elige el proveedor LLM + pega su clave (eco suprimido)
> career-ops-ui doctor     # vuelve a verificar cuando quieras (salida 0 ⇔ todo lo requerido en verde)
> career-ops-ui run        # solo arranca el servidor en http://127.0.0.1:4317
> career-ops-ui open       # abre + TRAE AL FRENTE la pestaña del panel en tu navegador
> ```
>
> Tras `setup`/`run` la pestaña del navegador se abre **y se trae al
> frente** automáticamente (v1.43.0); `career-ops-ui open` hace lo mismo
> bajo demanda, así nunca tienes que buscar la pestaña del panel.
> `NO_OPEN=1` desactiva la apertura automática en arranques headless/CI.
>
> `setup` ejecuta toda la cadena por sí mismo. `init` escribe la clave
> en el `career-ops/.env` del proyecto padre a través de la misma ruta
> validada que usa la pestaña de claves API de `#/config`, y define
> `LLM_PROVIDER` (`auto` | `claude` | `gemini`), que respetan las rutas
> en vivo de evaluación / profundo / modo / pipeline automático. Forma
> para CI:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`.
> ¿Prefieres la interfaz? Continúa con los pasos de abajo.

### A. Configuración (haz esto una vez, ~5 minutos)

**career-ops-ui debe estar en `career-ops/web-ui/`** (anidado dentro del proyecto career-ops padre). Lee tu `cv.md`, `config/` y `data/` de la carpeta padre mediante `../` y no funciona de forma independiente. Si `career-ops-ui init` no se encuentra después de un pull, ejecuta `cd career-ops/web-ui && npm install && npx career-ops-ui init`.

**Paso 1 — Abre la app en `http://127.0.0.1:4317`.** Si no está
corriendo, en una terminal ejecuta `bash bin/start.sh` desde la raíz
del repo. Carga el Dashboard (`#/dashboard`).

**Paso 2 — Haz clic en `❤ Health` en el sidebar izquierdo.** Cada
check requerido debe estar en verde:

- Existen `cv.md`, `config/profile.yml`, `portals.yml`
- API key configurada (al menos una de `ANTHROPIC_API_KEY` /
  `GEMINI_API_KEY`)
- Playwright instalado (solo necesario si vas a usar Generate PDF)

Si algo está en rojo, la página te indica el archivo o variable de
entorno exacta a arreglar. No continúes hasta que Health esté verde.

**Paso 3 — Haz clic en `⚒ App settings` en el sidebar.** Aterrizas en
la pestaña **API keys & runtime**.
- Pega `ANTHROPIC_API_KEY` (preferida — mejor scoring de formato
  largo) y/o `GEMINI_API_KEY`. Obtén las claves en
  <https://console.anthropic.com/settings/keys> o
  <https://aistudio.google.com/apikey>.
- Haz clic en **💾 Save**. Después haz clic en **▶ Test Anthropic**
  (o Gemini) — un round-trip diminuto confirma que la clave funciona.

**Paso 4 — Cambia a la pestaña `Profile` en la misma página.** Es el
editor YAML directo para `config/profile.yml`. Edita como mínimo:
- `candidate.full_name` — reemplaza cualquier placeholder ("Jane
  Smith") por tu nombre real
- `candidate.email`, `linkedin`, `github` — se usan en cover letters
- `target.roles` — los títulos de empleo a los que aplicarás
- `target.comp_total_min_usd` — compensación total mínima; las
  ofertas por debajo se marcan en la sección D de cada evaluación
- `target.archetypes` — los patrones de carrera que aceptas (el campo
  individual de mayor impacto)

Haz clic en **💾 Save**. El servidor valida el YAML y estampa el
encabezado canónico `# Career-Ops Profile Configuration`.

### B. CV (haz esto una vez, ~10 minutos)

**Paso 5 — Haz clic en `✎ CV` en el sidebar.** Dos columnas: editor a
la izquierda, vista previa en vivo a la derecha.

**Paso 6 — Elige una ruta para llenar el editor:**
- **Sube un currículum existente** — haz clic en **📁 Upload CV**,
  elige cualquiera de `.docx / .doc / .odt / .rtf / .pdf / .html /
  .txt / .md`. El servidor convierte a markdown vía pandoc o
  pdftotext, sanea XSS, y coloca el resultado en el editor. **Revisa
  la conversión** — los PDFs especialmente pueden perder fidelidad de
  layout.
- **Pega markdown directamente** — el textarea es un editor markdown;
  el panel derecho es lo que verá el LLM (y tu futuro reclutador).
- **Tips de tono:** un bullet = un logro con métrica. Mantén por
  debajo de 1500 palabras. Secciones en este orden: Summary,
  Experience, Projects, Education, Skills.

**Paso 7 — Haz clic en `💾 Save` (arriba a la derecha de la página
CV).** El servidor sanea (se eliminan `<script>` / `javascript:` /
manejadores inline) y escribe `cv.md`. Toast: *"Saved"*.

**Paso 8 (opcional) — Haz clic en `📄 Generate PDF`.** Ejecuta
`generate-pdf.mjs` en el padre (Playwright requerido) y **el PDF nuevo
se descarga automáticamente** en tu navegador al terminar. La lista al
final de la página conserva cada archivo previamente generado.

### C. Encontrar vacantes (~2 minutos por scan)

**Paso 9 — Haz clic en `🌐 Scan` en el sidebar.** Confirma que
`portals.yml` lista los boards que te interesan (sección 5 de esta
ayuda). Pulsa el botón **🌐 Scan now**. Un log SSE en vivo se va
mostrando mientras el scanner recorre Greenhouse / Ashby / Lever /
Workable / SmartRecruiters / Workday (boards en inglés) y hh.ru / Habr
Career (boards rusos, si están habilitados).

**Paso 10 — Cuando termine el scan, revisa los resultados.** Haz clic
en cualquier tag de empresa para filtrar; haz clic en el icono ↗ para
abrir la página de carreras de la empresa en una pestaña nueva. Cada
vacante que sobrevivió al filtro de título queda encolada en el
Pipeline.

### D. Puntuar las ofertas (~30 segundos por JD)

**Paso 11 — Haz clic en `Pipeline` en el sidebar.** Ves cada URL que
el scanner encoló. Haz clic en una entrada para vista previa del JD
inline.

**Paso 12 — Haz clic en `▶ Evaluate` al lado de cualquier JD.** Esto
salta a `#/evaluate`. Con una API key configurada, corre live; sin
ella, obtienes un prompt manual para pegar en tu propio LLM. El modo
live produce una **puntuación 0–5** contra tu CV en las secciones A–G
(Rol / Empresa / Compensación / Riesgo / Stretch / Fit cultural /
Verdict). El guardado aterriza en `reports/<date>-<slug>.md`.

**Paso 13 — Haz clic en `Reports` en el sidebar** y revisa la última
evaluación. Cualquier cosa por debajo de tu `comp_total_min_usd` se
marca en rojo en la sección D. Cualquier cosa con `Verdict: pursue`
es tu short-list.

### E. Decidir e investigar a fondo la empresa preseleccionada (~3 minutos)

**Paso 14 — Elige una vacante que valga la pena perseguir. Haz clic
en `Deep research` en el sidebar.** Introduce el nombre de la empresa
y el rol. El modelo produce un briefing de empresa de 7 secciones
(misión, news recientes, stack tecnológico, señales de contratación,
benchmarks de compensación, riesgos, ángulo recomendado). El guardado
aterriza en `interview-prep/<company>-<role>.md`.

### F. Postular (~5 minutos por candidatura)

**Paso 15 — Haz clic en `Apply checklist` en el sidebar.** Pega la
URL de la vacante + JD. El helper genera una checklist de envío paso
a paso:
- Borrador de cover letter adaptada (usa tu `cv.md` + `profile.yml`)
- Keywords específicas a reflejar desde el JD
- Archivos a adjuntar (CV en PDF — ver paso 8)
- Dónde aplicar (la URL canónica de careers, no redirecciones de
  agregadores)
- Recordatorio: **NUNCA auto-enviar** — la revisión final y el envío
  son siempre manuales.

**Paso 16 — Abre la página de careers en una pestaña nueva.** Usa la
apply checklist como tu lista de tareas. Envía a través del formulario
real de la empresa. Adjunta el PDF que generaste en el paso 8.

**Paso 17 — Contacta con un humano real.** Abre el modo **Outreach**
(`#/contacto` en el sidebar). El modelo redacta un mensaje corto de
LinkedIn / email adaptado al briefing de empresa del paso 14.
Personaliza el opener (un detalle específico de tu briefing de deep
research). Envíalo.

### G. Trackear y hacer follow-up (continuo)

**Paso 18 — Haz clic en `Tracker` en el sidebar** y añade una fila
para la candidatura: empresa, rol, puntuación, estado `Applied`,
enlace al reporte, enlace al briefing de deep research. La fecha se
autorellena.

**Paso 19 — Una semana después: abre el modo `Follow-up`**
(`#/followup`). Redacta un email cortés de check-in referenciando la
candidatura original. Envía. Actualiza el estado del tracker a
`Followed up`.

**Paso 20 — Cuando te llegue una invitación a entrevista, ejecuta el
modo `Interview prep`** (`#/interview-prep`). Genera preparación
dirigida para la empresa + etapa específica (system design /
behavioral / coding). Tira automáticamente del briefing de deep
research.

**Paso 21 — ¿Conseguiste la oferta? Actualiza el estado del Tracker a
`Offer`** y revisa la sección de comp de tu reporte de evaluación —
tu número mínimo de aceptación está justo ahí.

### TL;DR — el orden del sidebar coincide con el workflow

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

Eso es todo. 21 pasos, botón-por-botón, de cero a oferta.

### Auto-pipeline de un clic (`#/auto`) — el atajo de 21 pasos

Si solo quieres puntuar rápido una vacante concreta, salta el recorrido manual. **Barra lateral → ✨ Auto-pipeline** (o el botón ✨ del Dashboard): pega la URL, pulsa **Enter** o **▶ Ejecutar pipeline completo**, y el servidor corre toda la cadena en una pasada observable:

1. **Validar URL** — comprobación SSRF-segura (`isValidJobUrl`).
2. **Obtener la descripción** — `safeGet` (DNS fijado) descarga + sanea la JD.
3. **Evaluar contra tu CV** — Anthropic → Gemini → prompt manual si no hay key.
4. **Guardar informe** — escribe `reports/<slug>.md` con score + legitimidad.
5. **Añadir al tracker** — añade una fila a `data/applications.md`.

El feedback es un **stepper** vertical (lista ordenada, `aria-current` en el paso activo, región viva para lectores de pantalla). Al terminar, la tarjeta enlaza al informe (**Ver informe · N/5**) y al **tracker**. Un paso fallido se marca y el botón se rehabilita para reintentar sin recargar. **¿Sin API key?** Modo manual: pasos 3–5 colapsan y obtienes un prompt para copiar. Enlazable: `#/auto?url=<enc>&go=1` autoarranca.
> **CLI (v1.38.0).** Un comando hace la cadena: `career-ops-ui setup`. Verbos: `career-ops-ui doctor` (chequeo env/claves/tooling — mismo motor que Health; exit 1 si falla algo requerido), `career-ops-ui run`, `career-ops-ui init` (asistente proveedor+clave, v1.39.0).
> **Proveedores (v1.39.0).** La pestaña API-keys añade un select `LLM_PROVIDER` (`auto`=Anthropic→Gemini · `claude` · `gemini`) y un campo `OPENAI_API_KEY` (lado Codex/OpenCode CLI). `career-ops-ui init` es el asistente interactivo.
>
> **Proveedores (v1.57.0).** La eval en vivo headless abarca **Anthropic → Gemini → OpenAI → Qwen → OpenRouter** (orden `auto`; `LLM_PROVIDER` fija uno). **OpenRouter** — una `OPENROUTER_API_KEY` da acceso a más de 300 modelos; el desplegable `OPENROUTER_MODEL` carga el catálogo en vivo de OpenRouter (proxy del servidor, fallback curado offline). Corregido también: las claves pegadas con salto de línea / espacios se recortan antes de validar, así que `/#/config` ya no muestra «validation failed» para ningún proveedor.



---

## 2. Ajustes de la app y claves API (`#/config`)

> **Novedades v1.55 → v1.56.** Sin clave LLM, un banner rojo en cada pantalla explica que ⚡ Ejecutar en vivo está en modo prompt manual y enlaza aquí; con una clave se vuelve un chip discreto con el proveedor activo. Antes de cada botón ⚡ Ejecutar en vivo (`#/auto`, `#/evaluate`, `#/deep`, modos) se muestra un coste estimado honesto (p. ej. "Coste estimado: OpenAI gpt-5-codex · ~$0.04/eval", o sin coste de API en modo manual). `#/scan` oculta filtros secundarios tras un desplegable **Filtros avanzados**; `#/tracker` añade chips de embudo clicables + paginación de servidor opcional; `#/pipeline` virtualiza más de 1000 filas.

Dos pestañas:

1. **API keys & runtime** — edita el `.env` del proyecto padre desde
   el navegador (el mismo archivo que los scripts Node de career-ops
   leen al arrancar). La pestaña también ofrece selectores de modelo
   por proveedor — `OPENAI_MODEL` (OpenAI/Codex) junto a
   `ANTHROPIC_MODEL` y `GEMINI_MODEL`.
2. **Profile** — editor YAML directo para `config/profile.yml`. El
   guardado estampa el encabezado canónico
   `# Career-Ops Profile Configuration`.

Un guardado en cualquiera de las pestañas se propaga al instante — sin
reiniciar el servidor.

**Configurar tu proveedor LLM (paso a paso).** La ⚡ evaluación en vivo del web UI corre *headless* y usa una clave de API. Funciona vía "OR" — define **cualquiera** de estas y ya funciona; con varias definidas, `auto` las prefiere en este orden: Anthropic → Gemini → OpenAI → Qwen. (career-ops en sí es agnóstico de CLI — también lo ejecutas dentro de Claude Code, Codex, Gemini, OpenCode, Qwen, Copilot o Kimi; eso es independiente de esta clave headless.)

1. Abre `#/config` → la pestaña **API keys & runtime**.
2. Elige tu proveedor en **`LLM_PROVIDER`**: `auto` (usa la clave que esté definida), o fuerza uno con `claude` / `gemini` / `openai` / `qwen`.
3. Rellena la clave + modelo del proveedor que elegiste:
   - **Anthropic** — define `ANTHROPIC_API_KEY` (console.anthropic.com), opcionalmente `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`).
   - **Gemini** — define `GEMINI_API_KEY` (aistudio.google.com/apikey), opcionalmente `GEMINI_MODEL` (default `gemini-2.0-flash`).
   - **OpenAI** — define `OPENAI_API_KEY` (platform.openai.com), opcionalmente `OPENAI_MODEL` (default `gpt-5-codex`).
   - **Qwen** — define `QWEN_API_KEY` (Alibaba Model Studio / DashScope, dashscope.console.aliyun.com), opcionalmente `QWEN_MODEL` (default `qwen-max`). Para el endpoint de China continental define `QWEN_BASE_URL` en el `.env` crudo.
4. Haz clic en **Save**. Las claves se escriben en el `.env` del proyecto padre; el cambio surte efecto al instante — sin reiniciar el servidor.
5. Verifica en `#/evaluate`: pega una URL/descripción de vacante y pulsa **⚡ Run live**. El encabezado del resultado muestra qué proveedor corrió (`anthropic` / `gemini` / `openai` / `qwen`). Sin ninguna clave definida → obtienes el prompt manual de copiar-pegar.

Los secretos se enmascaran tras guardar y nunca se registran. Los campos de id de modelo (`*_MODEL`) no son secretos.

### Pestaña Profile

> **v1.32.0 — formulario por campos.** La pestaña Profile ya no es un textarea de YAML crudo: ahora es un formulario con secciones plegables **Candidato / Narrativa / Compensación**. Al guardar se envían solo las 14 rutas escalares modeladas; el servidor **fusiona** en `config/profile.yml`, así que tus `archetypes`, `proof_points` y claves propias **se conservan intactos**. Compromiso: el guardado por campos re-serializa el YAML y **pierde los comentarios `#`** — usa el desplegable **Advanced: edit raw YAML** al final de la pestaña para preservarlos o editar arrays anidados.
> **v1.35.0 — editores de arrays.** Editores add/remove para **Target roles** y **Superpowers** (listas de texto), **Archetypes** (name/level/fit) y **Proof points** (name/url/hero-metric). Misma garantía merge-not-replace; vaciar una lista elimina la clave limpiamente.
> **v1.54.3 — pestaña Modes como formulario estructurado.** `modes/_profile.md` ya no es un editor de markdown por sección: ahora es un formulario derivado del esquema documentado. Las secciones de lista — **Target Roles / Adaptive Framing / Comp Targets** — son campos de línea repetibles (añadir/quitar filas); las secciones de prosa — **Exit Narrative / Location Policy** — son textareas etiquetadas; cualquier sección desconocida o no-lista cae a un textarea etiquetado verbatim. Guardar **sigue fusionando por sección** — preámbulo, secciones intactas y secciones propias se conservan byte a byte. Persiste el desplegable *Advanced: raw markdown* para editar el archivo completo: añadir/quitar secciones o editar el preámbulo.




- El textarea muestra el `config/profile.yml` actual verbatim.
- Edita y haz clic en **💾 Save**. El servidor valida el YAML (debe
  ser un mapping, debe contener `candidate`) y escribe el archivo.
- Se añade un encabezado `# Career-Ops Profile Configuration` si no
  está.
- El resumen de solo lectura en `#/profile` es el compañero visual.

### Claves reconocidas

| Clave | Para qué sirve | Dónde obtenerla |
|---|---|---|
| `ANTHROPIC_API_KEY` | Habilita llamadas live al SDK de Anthropic. Preferida cuando ambas Anthropic + Gemini están configuradas — mejor output estructurado largo para puntuación de JD y deep research. | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | Sobrescribe el default `claude-sonnet-4-6`. Prueba `claude-opus-4-7` para razonamiento más exigente, `claude-haiku-4-5-20251001` para barato-y-rápido. | — |
| `GEMINI_API_KEY` | Fallback cuando no hay clave Anthropic. La usa `gemini-eval.mjs` para el modo `oferta`. El free tier funciona para volumen bajo. | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | Sobrescribe el modelo Gemini por defecto. | — |
| `(server uses default UA)` | Necesario al ejecutar scans en `hh.ru` desde fuera de Rusia (la API devuelve 403 ante User-Agents planos). Registra una app en <https://dev.hh.ru/admin> y usa su string UA. | dev.hh.ru |
| `PORT` | Puerto de bind de Express. Default 4317. | — |
| `HOST` | Dirección de bind. Default `127.0.0.1`. Poner `0.0.0.0` expone el UI en la LAN — **sin auth gate todavía**, ver el doc de Production-readiness. | — |

### Comportamiento

- **Lectura** (`GET /api/config`) devuelve cada clave reconocida. Las
  claves secretas (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) están
  **enmascaradas** — ves `sk-ant•••••••a1b2`, nunca el valor
  completo.
- **Guardado** (`POST /api/config`) valida cada valor, escribe en
  `<parent>/.env`, e inmediatamente aplica al proceso en ejecución.
  No se requiere reinicio.
- **Un valor vacío borra** la clave. Útil si quieres dejar de usar
  una IP rusa / VPN.

### Botones smoke-test

Después de guardar, haz clic en **▶ Test Anthropic** o **▶ Test
Gemini** — ambos disparan un prompt diminuto (≤256 tokens de output)
para que gastes esencialmente nada mientras confirmas que la clave
está conectada correctamente. Devuelve una muestra de ~200 caracteres
en caso de éxito.

---

## 3. Perfil (`#/profile` — también accesible como `#/settings`)

Una vista de tarjeta resumen de solo lectura de `config/profile.yml`.
**Para editar**, ve a **App settings → pestaña Profile** (`#/config`
→ Profile). Los guardados aterrizan en el mismo archivo; esta página
re-parsea al recargar.

Los campos que más importan:

- `candidate.full_name` — usado en cada prompt. **Reemplaza el
  template `Jane Smith`** antes de escanear nada de verdad, o tus
  cover letters generadas saldrán bajo el nombre placeholder.
- `candidate.email`, `linkedin`, `github` — referenciados en la
  generación de cover letters y en la apply checklist.
- `target.roles` — títulos de empleo aceptados. El filtro positivo
  del scanner los usa implícitamente (vía
  `portals.yml::title_filter`).
- `target.comp_total_min_usd` — compensación total mínima. La sección
  D de cada evaluación marca ofertas por debajo de esto.
- `target.archetypes` — el *campo más importante*. Estos son los
  patrones de carrera que aceptas (p. ej. `Tech-Lead-Backend`,
  `Founding-Engineer`, `Data-Platform`). Cada JD se mide contra ellos
  y el arquetipo de mejor fit aterriza en el header del reporte.

La página Health expone un check **Profile customized** que falla
mientras `full_name` coincida con un nombre placeholder conocido.

---

## 4. CV (`#/cv`)

Fuente única de verdad para cada evaluación, deep research, y cover
letter. Vive en `cv.md` en la raíz del proyecto padre.

### Opciones de edición

- **Pégalo directamente** — el textarea de la izquierda es un editor
  markdown. El panel derecho refleja lo que el LLM (y tu futuro
  reclutador) verán.
- **📁 Upload CV** — elige un archivo local en cualquiera de estos
  formatos y el servidor te lo convierte a markdown:
  - **Formatos de texto** — `.md`, `.markdown`, `.txt`, `.html`,
    `.htm` se pasan a través (HTML va vía pandoc → GFM markdown).
  - **Formatos de Office** — `.docx`, `.doc`, `.odt`, `.rtf` se
    convierten vía **pandoc** (`brew install pandoc` en macOS,
    `apt install pandoc` en Linux).
  - **PDF** — `.pdf` se extrae vía **pdftotext** de Poppler
    (`brew install poppler` / `apt install poppler-utils`).
  - El markdown convertido aterriza en el editor; haz clic en **💾
    Save** para persistir. El resultado se sanea (mismo strip XSS
    que el pegado).
  - Tope estricto: **10 MB** por upload. Archivos más grandes → 413.
- **Desde LinkedIn** — la ruta más fácil: abre Claude Code en el
  proyecto padre, ejecuta `/career-ops`, pega tu URL de LinkedIn, y
  pide `extract my CV from this and write it to cv.md`.

### Qué se sanea

Server-side, cada PUT a `/api/cv` pasa por `stripDangerousMarkdown`:

- Tags `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`,
  `<style>`, `<form>` — eliminados por completo.
- Manejadores de eventos inline (`onclick=`, `onerror=`, etc.) —
  eliminados.
- Esquemas URI `javascript:`, `vbscript:`, `data:text/html` —
  neutralizados.

La respuesta incluye `sanitized: true` siempre que se haya eliminado
alguno de los anteriores, así sabes si la fuente tenía algo
desagradable.

Tamaño máximo de body: 1 MB. Cualquier cosa más grande devuelve 413.

### Otros botones

- **sync-check** — ejecuta `cv-sync-check.mjs` en el proyecto padre.
  Marca inconsistencias: un proyecto listado en tu CV pero no en los
  arquetipos de `data/applications.md`, etc.
- **📄 Generate PDF** — streamea `generate-pdf.mjs`. El output
  aterriza en `output/*.pdf`. Requiere Playwright (la página Health
  muestra si está instalado en el `node_modules` del padre). Cuando
  termina la generación, el PDF **más reciente** se descarga
  automáticamente a tu carpeta de Descargas por defecto; la lista
  on-page conserva cada archivo previamente generado.

### Tips de tono / formato

- Un bullet = un logro con métrica.
  *"Reducí la latencia p99 en un 38%"* le gana a *"mejoré el
  rendimiento"* en cada rúbrica de evaluación.
- Secciones en este orden: **Summary** (3–5 líneas), **Experience**
  (reverse-chronological), **Projects** (máximo 5), **Education**,
  **Skills** (deduplicadas, sin sopa de buzzwords).
- Mantén bajo 1500 palabras. La rúbrica de scoring usa información
  densa; un CV desbordante se penaliza por ruido.

---

## 5. Portales y fuentes (`portals.yml`)

La configuración del scanner vive en `portals.yml` en la raíz del
padre. Tres secciones importan. Las tres secciones del SPA (abajo)
coinciden 1:1 con el schema canónico de career-ops.org de
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals).

> **Atajo:** la URL `#/portals` ahora resuelve directamente a **App
> settings** y (cuando hay una fuente regional configurada) salta al
> grupo **Regional sources** — así un enlace `#/portals` marcado o
> tecleado ya no da 404 (v1.42.0).

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

Una vacante escaneada pasa cuando su título contiene **al menos una
keyword positiva** Y **ninguna de las keywords negativas**. Ajusta
ambas. Las keywords son substrings case-insensitive.

`seniority_boost` es la tercera clave de title-filter. Las keywords
listadas aquí no filtran nada — empujan los empleos coincidentes más
arriba en los resultados, así un "Senior Backend Engineer" queda por
encima de un "Engineer". Default: `["Senior", "Staff", "Lead"]`.
Ajusta para que coincida con cómo se titulan tus roles objetivo.

Empieza con 3–5 keywords positivas por claridad; amplía después.

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

Filtra las vacantes escaneadas por su **ubicación** (subcadena, sin distinguir mayúsculas), aplicado por el barrido ATS y el regional. Semántica idéntica al `scan.mjs` canónico de career-ops:

- Sin `location_filter` → todas las ubicaciones pasan (por defecto).
- Ubicación vacía/ausente → pasa (no se penaliza el dato faltante).
- Coincidencia en `block` → **rechazada** (block tiene prioridad sobre allow).
- `allow` vacío → pasa (block ya filtró).
- `allow` no vacío → debe coincidir con **al menos una** palabra clave.

Clave de nivel superior en `portals.yml` (hermana de `title_filter`, no anidada en `russian_portals`).

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

`search_queries` impulsa el scan AI-powered Option B (`/career-ops
scan` dentro de Claude Code / Codex). NO los ejecuta el `npm run
scan` in-process (que solo consulta APIs públicas de tableros). Úsalos
cuando quieras descubrir roles en empresas que aún no están en
`tracked_companies`. Pon `enabled: false` para mantener una entrada
sin ejecutarla.

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

Campos requeridos por entrada: `name` y `careers_url`. Opcionales:
`api` (endpoint explícito de Greenhouse / Ashby / Lever / Workable /
SmartRecruiters / Workday), `enabled: true|false` para incluir /
excluir sin borrar la entrada. El ATS scanner detecta el ATS desde el
patrón de URL (`job-boards.greenhouse.io/<slug>` → Greenhouse, etc.)
y consulta la boards-api pública de cada empresa directamente. Las
empresas sin un ATS reconocible se omiten (la tarjeta **Active
Companies** en `/#/scan` las muestra en gris con `○`).

### `rss` (RSS / Atom boards)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

Apunta el escáner a cualquier portal de empleo que publique un feed RSS/Atom (LaraJobs, WeWorkRemotely, RemoteOK, golangprojects, …) añadiendo una entrada con `provider: rss` y una clave `rss:` (o `feed_url:`) — **sin cambios de código**. El adaptador RSS analiza cada `<item>` (CDATA + entidades HTML, títulos/empresas sin etiquetas), lo normaliza a una oferta y aplica el mismo flujo `title_filter` / `location_filter` + dedup + añadir a pipeline que las fuentes ATS. Luego **RSS** aparece como fuente seleccionable en el desplegable de filtro de `#/scan`. (web-ui v1.62.x)


### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # o solo uno
  area: 113                 # 1=Moscú, 2=SPb, 113=Rusia, 1001=remoto
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries` son matches de substring case-insensitive contra los títulos
de vacantes en hh.ru y Habr Career. **Cuida el solapamiento con la
lista negativa** — si `"Senior PHP"` está en `queries` pero `"php"`
acaba en `title_filter.negative`, el scan devolverá cero resultados y
la consola te avisará del conflicto.


### Configurar los portales rusos — guía detallada

v1.29.0 incluye 5 adaptadores rusos. Dos no requieren nada más allá del UA por defecto (`habr-career`, scraping HTML; `trudvsem`, API open-data gubernamental — sin key, sin barrera geográfica). Dos son scrapers HTML de portales técnicos (`getmatch`, `geekjob` — tampoco requieren key). Uno es la API canónica de hh.ru, que puede devolver 403 desde IPs fuera de Rusia salvo que configures la variable de entorno `HH_USER_AGENT` vía **App settings → API keys & runtime** (o ejecutes el servidor desde una IP rusa / VPN).

#### Inventario de fuentes

| Clave | Etiqueta | Tipo | Auth | Restricción geográfica |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | `HH_USER_AGENT` opcional | IPs no-RU pueden recibir 403 |
| `habr` | Habr Career | HTML | ninguno | ninguna |
| `trudvsem` | Trudvsem | JSON API (open-data) | ninguno | ninguna |
| `getmatch` | GetMatch | HTML | ninguno | ninguna |
| `geekjob` | GeekJob | HTML | ninguno | ninguna |

#### Paso 1 — Abre `portals.yml`

El archivo vive en la raíz del proyecto padre `career-ops/` (NO dentro de `web-ui/`). Si aún no existe, copia el ejemplo que viene con el proyecto padre:

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### Paso 2 — Habilita las 5 fuentes

Añade o actualiza el bloque `russian_portals` listando todas las fuentes que quieres escanear. El orden no importa; el scanner las recorre en el orden del registry.

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

#### Paso 3 — Ajusta queries y filtros

`queries` son las cadenas que el scanner usa para buscar en cada fuente. Cada query se ejecuta una vez por fuente — 4 queries × 5 fuentes = 20 llamadas por escaneo. Mantén la lista enfocada (3–7 queries) para que el escaneo no supere el minuto. `area` es el código de región de hh.ru (las demás fuentes lo ignoran). `per_page` limita cuántas vacantes devuelve cada fuente por query. `only_remote: true` filtra a remoto a nivel de adaptador (la tabla de resultados aún tiene su propio chip Remoto).

#### Errores comunes

**Colisión con la lista negativa.** Si una palabra de una query (`"php"`, `"senior"`) también está en `title_filter.negative`, todos los resultados se filtran antes de verlos. El scanner emite una advertencia stderr en tiempo de escaneo — busca la línea `⚠ config: query "Senior PHP" contains "php" which is in the negative list`. Soluciona quitando la palabra de la lista `negative`:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### Desactivar temporalmente una fuente

Para deshabilitar una fuente sin borrar sus datos, simplemente quita su clave de `sources`:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### Verificar la configuración

Después de guardar `portals.yml`:

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

### Flujo bootstrap CLI ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

El setup canónico de career-ops (ejecutar desde la raíz del padre una
sola vez):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

Eso es todo el bootstrap. Edita las tres secciones (`title_filter`,
`tracked_companies`, `search_queries`, y opcionalmente
`russian_portals`), guarda, y estás listo para escanear.

### Comportamiento de bootstrap del SPA

En el primer arranque el servidor añade un bloque `russian_portals:`
documentado a `portals.yml` si falta — idempotente (el segundo boot
es un no-op porque la línea literal `russian_portals:` ya está). Las
secciones en inglés NO se auto-inyectan; vienen del
`templates/portals.example.yml` que copiaste según el bootstrap
canónico de arriba.

---

## 6. Estado (`#/health`)

Cada gate de setup, en badges OK / OPTIONAL / FAIL. Lee esto antes de
abrir cualquier issue de "no funciona".

### Checks requeridos (el sistema no puede funcionar sin estos)

- `Node version` ≥ 18 — el servidor usa `fetch` y `node:test`
  nativos.
- `Project root` — que `CAREER_OPS_ROOT` (env o auto-detectado)
  exista.
- `cv.md`, `config/profile.yml`, `portals.yml`,
  `data/applications.md`, `data/pipeline.md`, `modes/oferta.md`.

### Checks opcionales (solo warnings)

- `Profile customized` — `candidate.full_name` no es el placeholder
  del template.
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — configuradas en `.env`.
- `(server uses default UA)` — solo importa si escaneas hh.ru desde
  fuera de Rusia.
- `Playwright (parent node_modules)` — requerido para generación de
  PDF y `check-liveness.mjs`. Instálalo con
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`.
- `Parent project dependencies` — `cd $CAREER_OPS_ROOT && npm
  install` si faltan.
- Directorios `data/`, `reports/`, `output/`, `jds/` — se
  auto-crean en la primera escritura.

Cuando el servidor está expuesto más allá de loopback (`HOST=0.0.0.0`)
las rutas absolutas y la versión Node exacta se reemplazan por
`"hidden"` en la respuesta para que un vecino curioso no pueda hacer
fingerprinting de tu instalación.

### Botones de ejecución

- **▶ Doctor** ejecuta `node doctor.mjs` y muestra el output en un
  modal.
- **▶ Verify pipeline** ejecuta `node verify-pipeline.mjs`.

---

## 7. Búsqueda (`#/scan`)

El scanner crawlea cada board habilitado, deduplica contra tu
historia, y escribe los hits a `data/last-scan.json` y
`data/pipeline.md`.

### Scan de un clic (SPA)

**🌐 Scan** ejecuta cada fuente habilitada en una sola pasada:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
  (la pasada ATS) para cada empresa de `tracked_companies` con una
  URL ATS reconocible.
- API de hh.ru + HTML de Habr Career para cada query de
  `russian_portals`.

**Dos fases en un clic (v1.29.2).** El único botón 🌐 Scan dispara TANTO el sweep ATS COMO el regional en un único stream SSE. En el log verás dos encabezados de fase, en orden:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — boards ATS EN.
2. `▶ Regional scan (hh.ru + Habr Career)` — 5 fuentes RU del registry.

Cada fase termina con un resumen `✓ done · NEW=N`. Si solo ves la fase ATS, tu stand está en un build pre-v1.29.2 — actualiza. Antes de v1.29.2 el cliente SSE cerraba en el primer `done` y la fase regional se descartaba silenciosamente.

El log SSE en vivo se va mostrando en el panel derecho mientras corre
el scan. Haz clic en **Stop** (o simplemente navega fuera) para
abortar — el servidor cancela los requests HTTPS en vuelo vía
`AbortController`.

### Filtrado de resultados

Debajo del log, la tabla de resultados renderiza filas de
`data/last-scan.json`.

Filtros:

- **Texto libre** — match de substring contra título / empresa.
- Dropdown **Source** — Ashby / GeekJob / Greenhouse / GetMatch / Habr Career / hh.ru / Lever / SmartRecruiters / Trudvsem / Workable / Workday.
- Dropdown **Remote / Hybrid / Onsite**.
- **Chips de stack** (PHP / Go / Backend / Senior / …) —
  auto-detectados por fila por `Skills.detectTech` y
  `Skills.detectLevel`. Intersección multi-select — seleccionar `PHP
  + Senior` muestra filas que tienen AMBAS.
- **Chips dinámicos** debajo de los chips de stack estáticos — top-25
  tokens capitalizados más frecuentes de los títulos, así el UI se
  adapta a cualquier rol que de hecho escanees (marketing, design,
  finance…) en vez de quedar fijado al vocabulario de backend
  engineer.

### Tarjeta Active Companies

Una tarjeta colapsable listando cada empresa de `portals.yml` con su
estado de scan:

- Tag verde ✓ — soporte API directo (Greenhouse / Ashby / Lever /
  Workable / SmartRecruiters / Workday).
- Tag gris ○ — fallback a prompt web-search (sin match de API).

**Haz clic en el nombre de la empresa** → rellena el filtro de
resultados arriba con ese nombre. **Haz clic en el icono ↗** → abre
el `careers_url` de la empresa en una pestaña nueva.

### Flujo CLI de scan ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Dos formas de escanear desde el lado CLI (ambas depositan URLs en el
mismo `data/pipeline.md` que el SPA lee):

**Option A — script directo (~30 s, cero tokens de IA consumidos):**

```bash
npm run scan                          # todos los boards Greenhouse/Ashby/Lever
npm run scan -- --dry-run             # preview sin persistir
npm run scan -- --company Anthropic   # acota a una empresa rastreada
```

Funciona solo para Greenhouse / Ashby / Lever / Workable /
SmartRecruiters / Workday (URLs ATS reconocibles). No se consumen
tokens de IA — consulta las APIs públicas de los tableros
directamente.

**Option B — scan AI-powered desde navegador:**

```
/career-ops scan
```

Dentro de Claude Code / Codex / Cursor / Gemini CLI. Usa tokens del
modelo. Visita cada página de `tracked_companies` directamente y
puede descubrir boards sin API (career pages, ATS custom, portales
regionales). Más lento pero más amplio. Útil cuando una pasada ATS
no devuelve nada para un target que sabes que está contratando.

**Output (ambos paths)** — nuevos JD URLs añadidos a
`data/pipeline.md`, cada URL visitada loggeada a
`data/scan-history.tsv` (dedup entre todos los scans futuros),
resumen impreso: empresas escaneadas · empleos encontrados · filtrados
por título · duplicados omitidos · nuevas ofertas añadidas.

**Umbrales de acción por puntuación** (aplica después de que
`/career-ops pipeline` puntúe en batch las URLs nuevas):

| Puntuación | Siguiente paso recomendado |
|---|---|
| **≥ 4.5** | `/career-ops apply` — fit alto, envía de inmediato |
| **4.0 – 4.4** | aplica, o `/career-ops contacto` para warm intro |
| **3.5 – 3.9** | `/career-ops deep` — investiga primero |
| **< 3.5** | salta salvo razón personal específica |

El `#/dashboard` y el `#/tracker` del SPA resaltan cada fila en 4.0
o por encima para que puedas tomar acción sin re-ejecutar nada.

### Comandos de seguimiento

Después del scoring, los seguimientos canónicos son:

- `/career-ops apply` — rellena candidatura con respuestas adaptadas
- `/career-ops contacto` — redacta outreach a LinkedIn / email
- `/career-ops deep` — investiga empresa / rol a fondo
- `/career-ops tracker` — visualiza el estado del pipeline

---

### Escanear hh.ru desde fuera de Rusia (`HH_PROXY`)

hh.ru geo-bloquea su API pública por **dirección IP**. Desde un nodo de salida no ruso, cada petición a `api.hh.ru` devuelve **HTTP 403 forbidden**; el escáner registra un aviso, desactiva hh.ru en esa pasada y sigue con las demás fuentes. `HH_USER_AGENT` por sí solo **no** levanta el bloqueo, ni tampoco cabeceras de navegador (Referer, Accept-Language…) — la barrera es tu **IP**. Para incluir hh.ru desde el extranjero, enruta **solo su petición** por un proxy ruso con `HH_PROXY`; el resto mantiene su conexión directa.

**1 — Consigue un proxy ruso. Tres requisitos independientes:**
- **IPv4, no IPv6.** `api.hh.ru` es solo IPv4 (sin registro AAAA). Un proxy IPv6 nunca lo alcanza — falla con `502 Bad Gateway / Host Not Found`. Elige **IPv4** explícitamente.
- **HTTP/HTTPS, no SOCKS.** El proxy tuneliza HTTPS vía `CONNECT`. **SOCKS5 no está soportado** (usa `ProxyAgent` de undici).
- **Residencial / móvil, no datacenter.** hh.ru devuelve **403** para rangos de hosting/datacenter *aunque la IP sea rusa* (Selectel, Timeweb…). Necesitas un proxy ruso **residencial o móvil** (IP real de un ISP).

**2 — Pruébalo antes de configurarlo.** Desde el servidor:
```bash
curl -x "http://LOGIN:PASS@HOST:PORT" \
  "https://api.hh.ru/vacancies?text=php&per_page=1" -w "\nHTTP %{http_code}\n"
```
- `HTTP 200` + JSON → funciona.
- `HTTP 403 {"type":"forbidden"}` → llega a hh.ru pero la IP está bloqueada → es datacenter, cambia a residencial/móvil.
- `CONNECT tunnel failed, response 502` → no llega a hh.ru (proxy IPv6, plan caducado o IP sin whitelist).
- `407` → credenciales incorrectas.

**3 — Configúralo.** Añade a `.env` en la **raíz del proyecto career-ops** (el mismo archivo que `HH_USER_AGENT`):
```
HH_PROXY=http://LOGIN:PASS@HOST:PORT
```
Se lee al arrancar — **reinicia el servidor** tras editar. `.env` contiene una contraseña; nunca lo subas al repo.

**4 — Verifica.** Relanza un escaneo desde `#/scan`; las filas de hh.ru aparecen junto a Habr Career.

## 8. Vacantes (`#/pipeline`)

Inbox de URLs esperando ser evaluadas. Vive en `data/pipeline.md`.

### Añadir URLs

Tres formas:

- Tipea / pega una URL en el input + haz clic en **+ Add**.
- Pulsa **Ctrl+K** (o **Cmd+K**) para enfocar la búsqueda global,
  pega cualquier enlace `http(s)://…`, dale a **Enter** — la URL va
  al pipeline inmediatamente.
- Ejecuta un Scan (ver arriba) — los hits frescos van al pipeline
  automáticamente.

Cada URL pasa por `isValidJobUrl()` del lado del servidor. Loopback
(`localhost`, `127.0.0.1`), `file://`, `javascript:`, IP literales, y
strings con chars de template (`<`, `>`, `"`) — todos 400.

### Panel de vista previa server-side

Haz clic en cualquier fila del pipeline para cargar una vista previa
a la derecha. La mayoría de los boards ATS no envían cabeceras CORS
así que el navegador no puede fetchearlos directamente; el servidor
proxea la petición, elimina `<script>` / `<style>` / tags HTML, y
devuelve hasta 8 KB de texto plano.

El proxy de preview camina las redirecciones manualmente con
**validación SSRF por hop** — cada cabecera `Location` re-pasa por
`isValidJobUrl()`, así un board hostil no puede hacerte rebotar a
loopback / IP privada / `file://`. Capado a 3 hops, timeout de 15
segundos.

### Acciones de fila

- **▶** — salta a `#/evaluate?url=…` con la URL pre-rellenada.
- **✕** — elimina la URL de `data/pipeline.md`.

### Botones arriba a la derecha

- **⚡ Evaluate first** — abre la primera URL encolada en la página
  Evaluate, lista para puntuar.
- **Scan** — vuelve al scanner si quieres más URLs.

---

## 9. Evaluar (`#/evaluate`)

Puntúa una sola Job Description contra `cv.md` y
`config/profile.yml`. Devuelve una evaluación estructurada A–G según
`modes/oferta.md` más una puntuación 0–5.

### Input

Pega el JD en el textarea, o llega aquí desde `#/pipeline` con
`?url=<href>` — la página fetchea la URL a través del mismo proxy
SSRF-safe usado para previews del pipeline y pre-rellena el textarea.

Haz clic en **💾 Save JD** para persistir el JD a
`jds/jd-<date>-<ts>.txt` para el audit trail (o pasa `save: true` en
la llamada API — mismo efecto).

### Cadena de fallback

1. **Anthropic** — preferida cuando `ANTHROPIC_API_KEY` está
   configurada. El servidor agrupa `cv.md`, `config/profile.yml`,
   `modes/_shared.md` y `modes/oferta.md` en un bloque
   `<project_context>` antes del prompt (cada archivo capado a 16
   KB, prompt completo soft-cap a 200 KB). Devuelve markdown
   fundamentado directo a la página.
2. **Gemini** — cuando solo `GEMINI_API_KEY` está configurada. El
   servidor spawnea `gemini-eval.mjs` con el JD como archivo
   temporal. El modelo del free tier (`gemini-2.0-flash`) está bien
   para scoring rutinario.
3. **Manual** — sin clave configurada. La página devuelve un prompt
   completamente formado que puedes pegar en Claude Code, ChatGPT, o
   cualquier otro LLM.

### Secciones de salida (A-F canónicas de career-ops.org)

> **Realineación v1.15.0.** Las letras de bloque ahora coinciden con
> el [schema canónico de career-ops.org](https://career-ops.org/docs).
> Los reportes pre-v1.15 usaban A–G (con `C=Risks`, `F=Verdict`,
> `G=Legitimacy`); seguimos renderizándolos tal cual por
> compatibilidad hacia atrás, pero los reportes nuevos emiten A–F con
> la semántica canónica de abajo. Score y Legitimacy ahora viven en
> el header del reporte (`score: 4.2/5`, `legitimacy: High|Medium|Low`).

A. **Role Summary** — recapitulación de 3 bullets (riesgos
mencionados inline).
B. **CV Match** — top 3 skills coincidentes + top 3 ausentes.
C. **Strategy** — recomendación: apply now / contacto first / deep
first / skip. Antes de v1.15 era `Risks`.
D. **Compensation** — relativa a tu `target.comp_total_min_usd`
(legacy) o `compensation.target_range` (canónico).
E. **Personalization** — ángulo para liderar, framing por arquetipo,
ganchos a mencionar en cover letter / outreach. Antes de v1.15 era
`Application Strategy`.
F. **STAR stories** — 1–3 bloques S-T-A-R listos-para-pegar adaptados
al rol. Antes de v1.15 era `Verdict` (puntuación cruda); la
puntuación ahora aparece en el header del reporte junto a
`legitimacy`.

### Guardar el reporte

Haz clic en **💾 Save report** (o usa el toggle de save en la llamada
API) para persistir el markdown a
`reports/<date>-<company>-<role>.md`. El header parseado del reporte
(Score / Legitimacy / URL) aparece en la página **Reports** y en el
**Dashboard**.

### Evaluación en batch cuando tienes 10+ JDs

Para un solo JD esta página `#/evaluate` es la herramienta correcta.
Para 10+ URLs encoladas en el pipeline, el click-through por JD es
impráctico — salta a la subsección **Batch evaluate** del §14
(ejecutando `./batch/batch-runner.sh` desde el padre), deja que
trabaje toda la noche, después vuelve a `#/reports` / `#/tracker`
para los resultados. Flujo completo:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

---

## 10. Reportes (`#/reports`)

Navega cada evaluación guardada. Las tarjetas muestran título, fecha,
flag de legitimidad, y puntuación (color-coded: verde ≥ 4.0,
amarillo ≥ 3.0, rojo por debajo).

Haz clic en una tarjeta para leer el markdown completo. Paginación:
12 por página; controles abajo.

La vista de reporte individual también tiene:

- **← All reports** — vuelve al grid.
- **🔗 Open JD** — abre el job posting original en una pestaña nueva.

---

## 11. Tracker (`#/tracker`)

El CRM. Una fila por candidatura; vive en `data/applications.md` como
tabla GitHub-Flavored Markdown.

### Flujo de estados

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Rejected` / `Discarded` / `SKIP`.

La whitelist de estados se aplica del lado del servidor; enviar
cualquier otra cosa en un `POST /api/tracker` cae por defecto a
`Evaluated`. La transición canónica `Evaluated → Applied` es
automática cuando confirmas `Submitted.` al final de `/career-ops
apply` (ver §14).

### Layout de columnas

| Columna | Qué es |
|---|---|
| `#` | Auto-numerado, con ceros a la izquierda (`001`, `002`, …). |
| `Date` | Fecha ISO (`YYYY-MM-DD`). Default: hoy. |
| `Company` | Texto libre. **Pipes (`\|`) y newlines se escapan automáticamente.** |
| `Role` | Lo mismo. |
| `Score` | Formato `N/5` (p. ej. `4.2/5`). |
| `Status` | Enum de la whitelist. |
| `PDF` | ✅ una vez que `generate-pdf.mjs` tuvo éxito para esta fila. |
| `Report` | Enlace markdown al `reports/*.md` correspondiente. |
| `Notes` | Texto libre, capado a 200 chars. |

### Filtros

- Dropdown **Status**.
- Dropdown **Score** — `≥ 4.0` (alto), `≥ 3.0` (medio), `< 3.0`
  (bajo).
- **Search** — match de substring a través de empresa + rol.

Cada filtro resetea el paginador a la página 1. 25 filas por página.

### Botones de mantenimiento

- **▶ Normalize** ejecuta `normalize-statuses.mjs` —
  re-canonicaliza la ortografía de estados (`applied` → `Applied`,
  `interview` → `Interview`).
- **▶ Dedup** ejecuta `dedup-tracker.mjs` — elimina duplicados
  case-insensitive por `(empresa, rol)`.
- **▶ Merge** ejecuta `merge-tracker.mjs` — trae entradas pendientes
  de `batch/tracker-additions/*.tsv` (donde el flujo batch del padre
  deposita candidaturas enviadas vía el helper Apply). Deduplica y
  archiva los archivos procesados a `batch/tracker-additions/merged/`.
  Ver
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  para el flujo batch upstream.

### Añadir filas

`POST /api/tracker` — body `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`. Dedup por `(empresa, rol)`
case-insensitive. Desde el UI, la página Evaluate ofrece un botón
"Add to tracker" tras una puntuación exitosa.

---

## 12. Investigación (`#/deep`)

Genera un briefing estructurado de la empresa: snapshot, cultura de
ingeniería, news recientes, sentiment de Glassdoor, proceso de
entrevistas, palancas de negociación, tres preguntas inteligentes para
hacerle al reclutador.

### Input

Dos campos — nombre de empresa y (opcional) rol. La plantilla del
modo (`modes/deep.md`) es la que da forma a la estructura.

### Rutas de salida

Misma cadena de fallback que Evaluate:

1. **Anthropic live** (preferida) — `bundleProjectContext` inlinea
   cv + profile + `_shared.md` + `deep.md`. Output: 10–30 KB de
   markdown fundamentado guardado a
   `interview-prep/<company>-<role>.md`.
2. **Gemini live** — invocación de `gemini-eval.mjs`. Mismo target de
   guardado.
3. **Prompt manual** — la página te entrega un prompt listo para
   Claude Code (que tiene WebFetch + WebSearch y puede hacer
   research real).

### Tips

- Anthropic en `claude-sonnet-4-6` típicamente devuelve ~13 KB de
  texto útil en 1–3 minutos por llamada.
- El SDK de Anthropic no tiene web search built-in. Para roles donde
  necesitas news frescas + sentiment de Glassdoor, pega el prompt
  manual en Claude Code y deja que use su herramienta WebFetch.
- Las ejecuciones live se facturan; una llamada de deep-research con
  Sonnet 4.6 cuesta ≈ $0.30–0.50.

---

## 13. Prompts de modos (las siete páginas `/#/<mode>`)

Siete generadores de prompts: ideas de **Project**, planes de
**Training**, emails de **Follow-up**, evaluaciones **Batch**,
**Outreach** a reclutadores, one-pagers de **Interview prep**, y
retrospectivas de **Patterns**. Cada uno envuelve una plantilla
`modes/<slug>.md` específica:

| Página | Slug | Propósito |
|---|---|---|
| `#/project` | `project` | Adaptar un proyecto del portfolio para un rol objetivo. |
| `#/training` | `training` | Análisis de skill-gap → currículum. |
| `#/followup` | `followup` | Borrador de email post-entrevista. |
| `#/batch` | `batch` | Prompt de evaluación batch multi-JD. |
| `#/contacto` | `contacto` | Mensaje de outreach a un reclutador / referido. |
| `#/interview-prep` | `interview-prep` | One-pager de prep para una ronda específica. |
| `#/patterns` | `patterns` | Análisis reflexivo "¿Qué patrones me hicieron exitoso?". |

### Forma compartida

Cada página tiene un pequeño formulario (los campos son específicos
del modo), un botón **▶ Generate prompt** (manual), y — cuando hay
una clave Anthropic o Gemini presente — un botón **⚡ Run live** que
asciende a primary.

Hacer clic en **▶ Generate prompt** devuelve el prompt ensamblado con
tus valores del formulario JSON-stringificados en un bloque
`User-supplied context:`, seguido por la plantilla `modes/<slug>.md`
verbatim. Copia y pega en tu LLM de elección.

Hacer clic en **⚡ Run live** envía el mismo prompt a Anthropic (o
Gemini), con `cv.md` + `profile.yml` + `_shared.md` inlineados vía
`bundleProjectContext`. El resultado se renderiza en la página, es
copiable, y descargable como `.md`.

Las siete páginas son una allowlist explícita — los modos que tienen
una ruta dedicada (`oferta` → Evaluate, `deep` → Deep research) y los
modos que el proyecto padre solo soporta dentro de Claude Code
(`apply`, `scan`, `pipeline`, `tracker`, `pdf`, `latex`, `ofertas`,
`auto-pipeline`) deliberadamente se quedan fuera de este UI.

---

## 14. Checklist de aplicación (`#/apply`)

Una vez que has decidido aplicar, esta página Apply helper genera una
checklist de envío para el paso de candidatura real. **NO**
auto-rellena formularios — ese flujo se queda en `/career-ops apply`
dentro de Claude Code, que usa Playwright en el proyecto padre.

### Modo checklist SPA (`#/apply`)

La checklist del SPA es para usuarios que prefieren rellenar el
formulario a mano sin invocar Playwright. Cubre:

0. Ejecuta `/career-ops apply <url>` en Claude Code para leer el
   formulario vía Playwright (omite este paso si lo rellenas a mano).
1. Verifica que el posting siga vivo (`check-liveness.mjs`).
2. Confirma que el CV es el último (`cv-sync-check.mjs`, después PDF
   si la puntuación ≥ 4.0).
3. Adapta la cover letter / respuesta "Why us?" usando proof points
   STAR+R de `cv.md`.
4. Responde con honestidad las preguntas de EEO / sponsorship /
   start-date.
5. Guarda las respuestas rellenadas en
   `interview-prep/{company}-{role}.md` antes de enviar.
6. **NUNCA auto-enviar** — tú (el humano) haces clic en el botón
   final.
7. Tras enviar: añade una fila a `data/applications.md` (o escribe un
   TSV a `batch/tracker-additions/`).

### Rellenado manual vs asistido por Playwright

Dos rutas para el envío real:

- **Manual** — abre la página de careers en una pestaña normal del
  navegador, sigue la checklist SPA de arriba, copia/pega las
  respuestas. No se requiere Playwright. Úsalo cuando el formulario
  es corto o no tienes Chromium instalado.
- **Asistido por Playwright** — ejecuta `/career-ops apply <company>`
  en Claude Code (proyecto padre). Playwright abre su propio
  navegador, lee cada campo del formulario, devuelve respuestas
  numeradas en borrador. Tú aún haces clic en Submit. Úsalo cuando
  el formulario es largo, dinámico, o quieres el audit trail de qué
  preguntas tuvieron qué respuestas.

### Flujo CLI completo de apply ([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**Prerrequisitos:**

1. Ejecuta `/career-ops pipeline` primero para que el JD tenga un
   reporte de evaluación bajo `reports/`. El comando apply depende de
   una evaluación existente; sin una, ejecuta el pipeline
   inicialmente.
2. Tener el reporte y el profile cargados.
3. **Recomendado:** Playwright instalado (`npx playwright install
   chromium` — ver Setup de Playwright abajo). Cae a WebFetch
   (preview de formulario solo texto, sin click-fill) cuando falta.

**Flujo numerado** (los 8 pasos canónicos):

1. **Ejecuta el comando** con el nombre de la empresa:

   ```
   /career-ops apply <company>
   ```

   Ejemplo: `/career-ops apply Anthropic`. Sin argumento, comparte un
   screenshot del formulario, el texto del formulario pegado, o la
   URL de la candidatura en el siguiente turno.

2. **Localiza el reporte.** El sistema encuentra la evaluación
   correspondiente en `reports/` (la creada por `/career-ops
   pipeline` o `#/evaluate` previamente).

3. **Abre el formulario.** Playwright lanza una ventana del navegador
   **automáticamente** — tú NO la abres.

4. **Lee los campos.** El sistema lee y parsea cada campo del
   formulario (label, type, required, options para los selects).

5. **Genera respuestas.** career-ops crea respuestas adaptadas para
   cada campo basadas en tu profile, proof points, y el rol.

6. **Devuelve lista numerada.** Recibes respuestas ordenadas para
   coincidir con el layout del formulario — campos simples (name,
   email) primero, campos de texto libre (cover letter, "Why us?")
   al final. Los items marcados apuntan a cosas que necesitan
   atención humana — salary anchor, detalles del currículum
   ausentes, preguntas opcionales.

7. **Rellenado manual.** Tú copias y pegas cada respuesta en el
   campo correspondiente. Este paso es manual, no automatizado.
   Revisas cada respuesta primero.

8. **El usuario envía.** Tú haces clic en Submit tú mismo. career-ops
   **nunca** hace clic en Submit. Confirma la finalización tipeando
   en el chat:

   ```
   Submitted.
   ```

**Actualizaciones automáticas al confirmar `Submitted.`:**

- El estado cambia `Evaluated → Applied` en `data/applications.md`.
- Las respuestas rellenadas persisten en la Section G del reporte
  para referencia futura.

**Handoff al tracker:**

```
/career-ops tracker
```

Monitorea el estado de todo tu pipeline, independientemente de la
puntuación del rol.

### Batch evaluate ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

Cuando tienes 10+ JDs para puntuar a la vez (el `#/evaluate` del SPA
uno-por-uno es impráctico para ese volumen), usa el batch runner
desde el CLI.

**Archivo de entrada — `batch/batch-input.tsv`** (tab-separado):

| Columna | Propósito |
|---|---|
| `id` | Número secuencial único |
| `url` | Enlace completo del job posting |
| `source` | Plataforma de origen (LinkedIn, Greenhouse, etc.) |
| `notes` | Detalle contextual opcional |

Fila de ejemplo:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**Flags de `./batch/batch-runner.sh`:**

- `--dry-run` — Previsualiza ofertas pendientes sin evaluación.
  Ejecuta esto siempre primero para validar el TSV.
- `--parallel N` — Ejecuta N workers simultáneamente (1, 2, o 3
  recomendados).
- `--min-score X.X` — Omite persistir ofertas que puntúen por debajo
  del umbral. Útil para quedarte solo con reportes de roles de alto
  fit.
- `--retry-failed` — Reprocesa solo las ofertas que dieron error en
  la ejecución anterior (fallos de red, rate limits).
- `--max-retries N` — Reintenta las ofertas fallidas hasta N veces
  (default: 2).
- `--model NAME` — Modelo Claude pasado a `claude -p --model` (career-ops 1.8.0, #504). Sin valor = el modelo por defecto de tu suscripción Claude Max. Usa uno más barato para lotes grandes, p. ej. `claude-sonnet-4-6`. En `#/config` → no; en `#/batch` aparece como el campo **Model** (web-ui 1.31.0).
- `--start-from N` — Omite los IDs de oferta por debajo de N (reanuda un lote parcialmente procesado). En `#/batch` aparece como el campo **Desde #** (web-ui 1.31.0).

**Secuencia estándar:**

1. **Edita** `batch/batch-input.tsv` — una fila por JD.

2. **Dry-run** (recomendado primero):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **Ejecuta** — secuencial o en paralelo:

   ```bash
   ./batch/batch-runner.sh                       # uno a uno
   ./batch/batch-runner.sh --parallel 2          # dos concurrentes
   ./batch/batch-runner.sh --parallel 3          # tres concurrentes
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # solo persistir high-fit
   ```

4. **Reintentar fallos** (red / rate-limit):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **Los reportes** aterrizan en `reports/` como
   `{id}-{company}-{YYYY-MM-DD}.md`. Las filas resumen se añaden a
   `batch/tracker-additions/`.

6. **Merge al tracker:**

   ```bash
   node merge-tracker.mjs                 # aplica las batch additions
   node merge-tracker.mjs --dry-run       # previsualiza el merge
   ```

   El comando merge deduplica las entradas y archiva los archivos
   procesados a `batch/tracker-additions/merged/`.

El SPA expone los reportes resultantes en `#/reports` (paginados,
con pill de score coloreada) y las filas del tracker bajo `#/tracker`
— exactamente como si hubieras añadido cada uno a través de
`#/evaluate`. Combínalo con el botón de mantenimiento **▶ Merge** en
`#/tracker` si prefieres no bajar al CLI.

### Setup de Playwright ([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

Requerido para dos features de career-ops:

- **Form-fill** en `/career-ops apply` (paso 3 de arriba — Playwright
  abre el navegador, lee labels de campos, sugiere respuestas).
- **Generación de PDF** vía `/career-ops pdf` y el botón **📄
  Generate PDF** del SPA en `#/cv` / `#/reports/:slug` /
  `#/evaluate` / `#/deep` / `#/interview-prep`.

**Fallback cuando falta Playwright:** el flujo apply cae a WebFetch
(preview de formulario solo texto, sin click-fill). La generación de
PDF simplemente da error.

**Setup principal (ejecutar desde la raíz del padre career-ops):**

```bash
# Instalar Chromium para Playwright
npm install
npx playwright install chromium

# Registrar el MCP de Playwright para que Claude Code pueda manejar formularios
claude mcp add playwright npx @playwright/mcp@latest

# Verificar los tres componentes (Chromium, lib de Playwright, MCP)
npm run doctor
```

**Registro MCP alternativo** — añadir a
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

**Notas de comportamiento:**

- **Headless por defecto.** Playwright opera silenciosamente. Para
  ver el navegador en acción, dile a Claude `open up with playwright
  the browser and fill out the entire form.`
- **Tres roles en un paquete** — la instalación npm de Playwright te
  da la librería de automatización del navegador, el motor de
  renderizado de PDF para `/career-ops pdf`, y (vía el MCP) el
  workflow de form-fill dentro de Claude Code.
- **Verifica antes de confiar en él** — `npm run doctor` confirma
  que los tres están operativos. La página Health del SPA expone un
  check `Playwright (parent node_modules)` que falla rápido si
  falta.

---

## 15. Preparación para entrevistas

Esta es la fase post-research, pre-interview. Tres artefactos en
esta app convergen:

1. **Archivos de deep-research guardados** bajo `interview-prep/`,
   uno por pareja company-role que ejecutaste. Navégalos desde la
   página **Deep research** o directamente vía `/api/interview-prep`.
2. **Modo Patterns** (`#/patterns`) — genera un prompt
   auto-reflexivo: "a través de mis últimas N entrevistas / ofertas
   / rechazos, ¿qué patrones se mantienen?" Útil cuando hayas
   acumulado 5+ filas en el tracker.
3. **Modo Interview-prep** (`#/interview-prep`) — pre-rellena un
   one-pager para una ronda upcoming específica (behavioral,
   technical, system design). El output va al mismo folder
   `interview-prep/`.

### Workflow recomendado

Para cada entrevista que tengas agendada:

1. **Re-ejecuta Deep** (o abre el archivo guardado) el día anterior.
2. **`#/interview-prep`** — genera un one-pager para la ronda
   específica. Pégalo en tus notas.
3. **Rondas de System design / coding** — abre `#/training` y pide
   un refresher de 30 minutos dirigido sobre el subsistema específico
   que el JD enfatiza.
4. **Rondas de compensación** — abre el archivo de deep-research,
   salta a "Negotiation leverage points." Lleva 2–3 datos específicos
   (banda de Glassdoor, funding reciente, oferta comparable en otra
   empresa).
5. **Rondas behavioral** — saca historias STAR+R de tu `cv.md` que
   aterrizan en la sección B del reporte de Evaluate original.

Tras la entrevista, inmediatamente:

1. Actualiza la fila del tracker: estado → `Responded` (después
   `Interview`, `Offer`, etc.).
2. Ejecuta `#/followup` para redactar el email de agradecimiento.
3. Si conseguiste inteligencia nueva (rango de compensación,
   composición del equipo, sorpresa del stack tecnológico), edita el
   `interview-prep/<company>-<role>.md` guardado con `## Post-round
   notes` así future-you lo tiene.

---

## 16. Activity log + Troubleshooting

### Activity log (`#/activity`)

Audit trail de cada request state-changing que llega al servidor.
Registra: adiciones al pipeline, escrituras al tracker, guardados de
CV, guardados de JD, ejecuciones de evaluate, ejecuciones de
deep-research, ejecuciones de scan, cambios de configuración,
ejecuciones de modos.

Los secretos (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) se redactan al
entrar; nunca verás un valor real de clave en `data/activity.jsonl`.

Filtra por prefijo de acción (`pipeline.`, `cv.`, `evaluate`,
`scan.`, etc.). 25 filas por página; el servidor devuelve hasta los
500 eventos más recientes.

### Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| Página Health roja en `cv.md` | Primer arranque, el archivo aún no existe | `touch $CAREER_OPS_ROOT/cv.md` y después refresca. |
| Health roja en `Profile customized` | `candidate.full_name` aún dice `Jane Smith` | Edita `config/profile.yml`. |
| `hh.ru: HTTP 403` en el log del scan | IP no rusa, sin `(server uses default UA)` | Registra una app en `dev.hh.ru/admin`, usa una IP / VPN rusa. |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | Dependencias del proyecto padre no instaladas | `cd $CAREER_OPS_ROOT && npm install`. |
| Errores al Generate PDF | Playwright no instalado en el padre | `cd $CAREER_OPS_ROOT && npx playwright install chromium`. |
| `/career-ops apply` dice "no report found" | El pipeline nunca puntuó este JD | Ejecuta `/career-ops pipeline` (o `#/evaluate`) primero; ver prerrequisitos del §14. |
| `batch-runner.sh: no such file` | Ejecutando desde el directorio incorrecto | `cd $CAREER_OPS_ROOT` antes de invocar `./batch/batch-runner.sh`. |
| El servidor reporta `EADDRINUSE: 4317` | Instancia vieja aún corriendo | `pkill -f 'node server/index.mjs'` y reinicia. |
| Llamada LLM live cuelga > 2 min | Prompt enorme o Anthropic lento | Revisa el flag de Anthropic en `/api/health`; el servidor pone soft-cap a los prompts en 200 KB y devuelve 413. |
| Pipeline preview muestra `(unsafe redirect)` | El posting redirigió a una IP privada / loopback | Es un feature de seguridad (REVIEW-B1). El target de redirect se rechaza y la URL original se mantiene sin cambios. |
| El texto de una fila del tracker rompe la tabla | Pipe en el nombre de empresa pre-v1.9.1 | Actualiza a v1.9.1+ — los pipes se escapan end-to-end (BF-1). |
| `npm test` falla en clon fresco | Los tests asumen el layout del proyecto padre | Usa `CAREER_OPS_ROOT=$(mktemp -d)` y bootstrapea fixtures. |

Para diagnóstico más profundo: ejecuta **▶ Doctor** en la página
Health, copia el output, y busca el issue en el tracker en
<https://github.com/Fighter90/career-ops-ui/issues>.


---

## 17. Cómo añadir una nueva fuente de portal de empleo

career-ops-ui trata cada bolsa de empleo como un **adapter** — un único archivo bajo [`server/lib/sources/<slug>.mjs`](../../server/lib/sources/) que sabe cómo obtener y normalizar los resultados de una bolsa concreta. v1.29.0 incluye 11 adapters (6 ATS en inglés, 5 portales rusos). Añadir el 12.º son tres ediciones cortas en este repo más una línea en el `portals.yml` del proyecto padre.

### Paso 1 — Escribe el adapter

Crea `server/lib/sources/<slug>.mjs`. Para una fuente con API JSON pública:

```js
// server/lib/sources/example.mjs
const ENDPOINT = 'https://example.com/api/v1/vacancies';

export async function searchExample(query, opts = {}) {
  const { onlyRemote = false, fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${ENDPOINT}?text=${encodeURIComponent(query)}`, {
    signal,
    headers: { Accept: 'application/json' },
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
    source: 'example',
  };
}
```

### Paso 2 — Añade una fila al registry

Abre [`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs) y añade una entrada:

```js
export const SOURCES = [
  // …existing entries…
  { value: 'example', label: 'Example.com', region: 'ru', configKey: 'example' },
];
```

### Paso 3 — Conecta al dispatcher (sólo RU)

Los adapters EN se auto-descubren desde `tracked_companies`. Para RU, edita [`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs) y añade una fila a `RU_DISPATCH`:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

### Paso 4 — Test (mockeado, jamás en vivo)

La red real está **prohibida** en los tests (contrato CI-isolation). Pasa un `fetchImpl` mockeado al adapter — ver [`tests/sources-trudvsem.test.mjs`](../../tests/sources-trudvsem.test.mjs).

### Paso 5 — Activa en tu `portals.yml`

El `portals.yml` del proyecto padre es la config del usuario. Añade el `configKey` de la nueva fuente al array:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob", "example"]
```

Recarga `#/scan` en el navegador. El dropdown del filtro de fuente recoge la nueva entrada automáticamente (única fuente de verdad vía `GET /api/scan/sources` → `registry.mjs`).

**Para el ejemplo de código completo (adapter HTML-scrape, pitfalls comunes, tabla de adapters de referencia), consulta la versión inglesa de esta sección en [docs/help/en.md §17](https://github.com/Fighter90/career-ops-ui/blob/main/docs/help/en.md#17-how-to-add-a-new-job-portal-source).**

### Adapters de referencia (úsalos como espejo para nuevas fuentes)

| Archivo del adapter | Tipo | Notas |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | Adapter de API RU canónico; fallback de UA según geo. |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | Open-data del gobierno ruso; sin barrera de IP. |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML scrape | Tablón tech ruso; parser de tarjetas basado en regex. |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML scrape | Parser defensivo, `[]` si falla el parseo. |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML scrape | Mismo estilo defensivo que GetMatch. |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | Adapter ATS EN canónico; usa el patrón de URL `tracked_companies`. |

### Pitfalls comunes

- **Desajuste del campo `source`.** El string que escribe tu adapter DEBE
  coincidir exactamente con el `value` en `registry.mjs`. Si se desincronizan, el
  dropdown del filtro de `#/scan` mostrará la fuente pero al seleccionarla
  filtrará todas las filas (porque la comprobación de igualdad es `r.source === fs`).
- **Lanzar excepción al fallar el parseo.** Los scrapers HTML DEBEN devolver `[]` ante un
  200 sano sin tarjetas parseables. Lanzar excepción rompe el bucle del
  dispatcher multi-fuente — una estructura HTML mala mata todas las demás fuentes para
  la misma consulta.
- **Olvidar `fetchImpl` / `signal`.** Sin ellos, tu adapter
  no puede probarse en unit tests sin tocar la red real, y las desconexiones del
  cliente no se propagan (el fetch en background sigue vivo después de que el
  usuario cierra la pestaña).
- **Confiar en `tracked_companies` para RU.** Esa lista es sólo para fuentes
  ATS EN. Los adapters RU se autoabastecen desde
  `russian_portals.queries` — sin entradas por empresa.

---

## 18. Notificaciones (🔔 en la barra superior)

> v1.58.34 — cada toast en la esquina inferior derecha se captura en un diario in-memory (tope 50, se descartan los más viejos). Haz clic en 🔔 en la barra superior para abrir el drawer **Notificaciones** y releer lo que te perdiste. El diario es por pestaña y por sesión — cerrar la pestaña lo borra.

El drawer **solo se abre al hacer clic en la campana** (o Enter / Space con foco). Nunca aparece solo. El badge rojo cuenta entradas no vistas; abrir el drawer lo reinicia.

### Categorías

| Categoría | Cuándo dispara | Pista visual |
|---|---|---|
| **Éxito** | `Guardado`, `Copiado`, `Actualizado`, scan completo, CV importado, apply-checklist, perfil guardado | borde izquierdo verde; toast verde |
| **Error** | URL inválida, errores de API con sufijo `(MÉTODO /ruta · HTTP NNN)`, fallos de red, duplicados de pipeline-400, doctor/verify exit ≠ 0 | borde izquierdo rojo; toast rojo; postfix en `Detalles` (U-4) |
| **Info** | `Running doctor.mjs…`, `Refreshing…`, `Loading…`, progreso de scan | borde gris |

Cada entrada muestra hora local, mensaje humano y, si existe, el postfix técnico en monospace.

### Qué NO es una notificación

- Modal de resultado de Doctor / verify (es modal, no toast).
- Líneas SSE en `#/scan`/`#/auto` (van al cuerpo de la página).
- Estados de spinner sin toast.

### Teclado

- **Clic** o **Enter / Space** en la campana → abrir.
- **Esc**, **×**, o nuevo clic en la campana → cerrar; el foco vuelve a la campana.


## 19. Localizar la aplicación a tu idioma

La interfaz se distribuye en 9 idiomas (English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文). Cada etiqueta en pantalla proviene de un diccionario de traducciones, y puedes añadir o corregir un idioma sin tocar la lógica de la app.

**Dónde viven las traducciones.** Desde la v1.60.0 cada idioma es su propio archivo en `public/js/lib/locales/` — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.ru.js`, etc. — una lista simple de pares `'clave': 'texto'`. Un `i18n-dict.aliases.js` compartido permite que claves que deben leerse igual (una etiqueta del menú y el título de su página) apunten a una sola traducción. `i18n-dict.js` los ensambla al cargar; nunca lo edites.

**Corregir o añadir un texto.** Abre el archivo de tu idioma, busca la clave (p. ej. `'nav.scan'`) y edita el texto. Para añadir una etiqueta nueva, agrega la misma clave a **los 8** archivos de idioma con el valor traducido y úsala en la página con `t('tu.clave')`. Ejecuta `npm test` — falla si a algún idioma le falta la clave, así nada se publica a medio traducir.

**Añadir un idioma nuevo.** Copia `i18n-dict.en.js` a `i18n-dict.<código>.js`, traduce cada valor y registra el código en `i18n.js` (la lista de idiomas + autodetección del navegador), en el ensamblador `i18n-dict.js`, y añade una línea `<script>` en `index.html`. La lista completa — incluido el snapshot de tests y los archivos de ayuda / README — está en `docs/LOCALIZATION.md`.

**Bueno saberlo.** El selector de idioma está en el pie de la barra lateral; tu elección se recuerda por navegador. Los mensajes de diagnóstico del servidor permanecen en inglés a propósito (para que los logs sean consistentes) — solo se traduce la interfaz en pantalla.

Consulta **`docs/LOCALIZATION.md`** en el repositorio para la guía de localización completa, paso a paso.
