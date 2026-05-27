# Registro de cambios

Todos los cambios destacables de **career-ops-ui**. Formato según [Keep a Changelog](https://keepachangelog.com/es/1.1.0/), versionado [SemVer](https://semver.org/lang/es/).

Traducciones: [English](CHANGELOG.md) · [Português](CHANGELOG.pt-BR.md) · [한국어](CHANGELOG.ko-KR.md) · [日本語](CHANGELOG.ja.md) · [Русский](CHANGELOG.ru.md) · [简体中文](CHANGELOG.zh-CN.md) · [繁體中文](CHANGELOG.zh-TW.md) · [Français](CHANGELOG.fr.md)

> **Nota i18n** — desde v1.12.0 en adelante las entradas están localizadas en cada idioma. Las entradas anteriores (v1.11.x, v1.10.x) permanecen en ruso por convención del proyecto; el contenido normativo inglés está en [CHANGELOG.md](CHANGELOG.md).

> **Nota de traducción (v1.22.0)** — este archivo está ahora íntegramente traducido al español técnico. Se han retirado los avisos provisionales "ver CHANGELOG.md en inglés" que aparecían en las entradas v1.13.0 a v1.21.0.

---



## [1.63.0] — 2026-05-27

**feat(scan): timeout por petición + barra de progreso en `#/scan`.** Las peticiones de fuentes no tenían límite de tiempo, así que una fuente atascada (p. ej. `api.hh.ru` desde una IP bloqueada) podía **colgar todo el escaneo**. El nuevo `server/lib/fetch-timeout.mjs` envuelve el `fetchImpl` de los escáneres (`makeTimeoutFetch`, por defecto **15s**, configurable con `SCAN_FETCH_TIMEOUT_MS`); una fuente expirada se registra como error no fatal y el escaneo continúa. `#/scan` muestra una barra de progreso durante el escaneo (`scan.progress` en las 9 localizaciones). 7 pruebas nuevas; suite 1039/1039.

---



## [1.62.3] — 2026-05-27

**docs: instalación aclarada (career-ops-ui corre dentro de `career-ops/web-ui/`) + solución de problemas de `init`, en las 9 localizaciones.** Sección de instalación reescrita en **Option 1** (un curl) / **Option 2** (clonar la UI *dentro* de un proyecto career-ops existente como `web-ui`) + verbos CLI + configuración del proveedor + bloque **Troubleshooting `init`**. Nota de estructura anidada añadida a `/help` §1 Setup; resumen de toda la línea v1.62.* en el README. Solo documentación; sin cambios de código.

---



## [1.62.2] — 2026-05-27

**fix(help): el filtro de `#/help` ahora es de texto completo (encuentra subsecciones H3 como RSS).** El filtro de búsqueda/TOC de la página de ayuda solo coincidía con títulos de sección H2, por lo que la documentación RSS de v1.62.x (un H3 bajo §5 Portals & sources) no se encontraba. Ahora el cuerpo de cada sección se indexa en el filtro, así que buscar p. ej. «RSS» muestra §5. Solo del lado del cliente; sin cambios de API.

---



## [1.62.1] — 2026-05-27

**feat(scan): RSS en el filtro de fuentes + corrección de ubicación RSS.** El desplegable de filtro de fuentes en `#/scan` ahora incluye **RSS** (añadido a `server/lib/sources/registry.mjs` + la lista de respaldo del SPA), por lo que los resultados de portales RSS (LaraJobs, WeWorkRemotely, …) se filtran como cualquier fuente ATS. El adaptador RSS ya no asigna la etiqueta `<category>` del feed a `location` — esas etiquetas hacían que `location_filter` descartara erróneamente puestos remotos; ahora `location` queda vacío y los feeds pasan el filtro de ubicación. Tooltips/etiquetas del botón de escaneo y la cadena de lista de fuentes actualizadas en las 9 localizaciones (Workable / SmartRecruiters / Workday / RSS). Snapshot i18n y prueba del endpoint de fuentes (6 → 7 EN) actualizados.

---



## [1.62.0] — 2026-05-27

**feat(scan): adaptador RSS genérico para portales de empleo no-ATS.** Un nuevo adaptador `rss` (`server/lib/portals/adapters/rss.mjs` + `server/lib/sources/rss.mjs`) permite al escáner extraer ofertas de cualquier feed RSS — LaraJobs, WeWorkRemotely, RemoteOK, golangprojects y otros portales fuera de Greenhouse/Ashby/Lever. Sin nuevas dependencias: el análisis del feed usa regex con soporte de CDATA y entidades HTML (títulos/empresas sin etiquetas, code points astrales decodificados de forma segura). Se activa por empresa con `provider: rss` / `rss:` / `feed_url:` en `portals.yml`, sin interceptar empresas ya emparejadas con ATS. `ALL_ADAPTERS` crece 6 → 7. 29 nuevas pruebas; documentado en las 9 localizaciones del README.

---



## [1.61.1] — 2026-05-22

**fix(i18n): localiza el title + aria-label del conmutador de tema en los 9 idiomas (MINOR-001).** El botón de tema claro/oscuro (`#theme-toggle`) tenía `title="Toggle theme"` y `aria-label="Toggle theme"` codificados en `index.html` — el tooltip y el texto para lectores de pantalla nunca se traducían, en ningún idioma. Nueva clave `top.themeToggle` + un manejador `data-i18n-title` en `applyI18n()` (espejo del arreglo de aria-label de búsqueda de v1.58.15) localizan ambos atributos al arrancar y en cada cambio de idioma. Bloqueado por `tests/playwright-theme-toggle-i18n.mjs` (9 idiomas + cambio en runtime) y dos guardas estáticas. Único hallazgo LOW del sign-off de v1.61.0. (MINOR-001)

---



## [1.61.0] — 2026-05-22

**feat(i18n): añade el francés como 9.º idioma de la interfaz.** Nuevo diccionario por idioma `public/js/lib/locales/i18n-dict.fr.js` (`window.__I18N_DICT_FR`), con paridad completa de **668 claves** con el inglés; nuevo paquete de ayuda `docs/help/fr.md` (**19 H2 / 73 H3**, paridad estructural exacta con `en`). `fr` queda registrado en el conmutador de idioma y la autodetección del navegador (`i18n.js`), en el ensamblador (`i18n-dict.js`), en `index.html` (etiqueta `<script>` antes del ensamblador), en el snapshot de test y en todas las listas de locales de los tests. La tabla de traducción inicial proviene de la **PR #9** (contribución de la comunidad). Sin cambios de lógica: `t()` y todas las vistas no cambian. **1001 / 1001** pruebas unitarias; el barrido de locales de Playwright crece a 9 subtests. (FR-LOCALE)

---



## [1.60.0] — 2026-05-22

**refactor(i18n): divide el megaarchivo de 8 columnas en archivos por idioma (I18N-SPLIT).** El diccionario de traducciones vivía en un único `public/js/lib/i18n-dict.js`; ahora hay **un archivo por idioma** en `public/js/lib/locales/` más `i18n-dict.aliases.js`, para que un traductor edite un solo idioma de forma aislada (estilo i18next / OpenWA). `i18n-dict.js` es ahora un **ensamblador** que reconstruye exactamente el mismo `window.__I18N_DICT`, así que `t()` y todas las vistas no cambian. Se carga de forma síncrona vía `<script src>` — sin paso de compilación ni fetch. Un snapshot demuestra que la migración no pierde nada (678 claves). Herramientas y ~25 tests adaptados; nuevos `tests/i18n-locale-files.test.mjs` y `tests/playwright-locale-sweep.mjs` (cada página × 8 idiomas en Chromium real). 994 → **1000** unitarios · 62 → **70** Playwright. Sin cambios de comportamiento. (I18N-SPLIT)

---



## [1.59.13] — 2026-05-21

**fix(i18n): colapsar claves duplicadas reales con @alias + purga final de datos personales.** Nombre real del maintainer eliminado de fixtures de test y reportes QA (→ `Jane Doe`); `LICENSE`/`package.json` → handle `Fighter90`. Mecanismo `@alias` colapsa las 10 claves idénticas en los 8 locales; `nav.config`/`config.title` NO se fusionan (divergen en español). 991 → **994** tests. (I18N-CL3)

---



## [1.59.12] — 2026-05-21

**fix(i18n): limpieza de i18n-dict.js — pre-fr (I18N-CL1, I18N-CL2, I18N-CL4).** Eliminado dato personal en `training.coursePh` (→ placeholder genérico), restaurado `followup.lastPh` como pista de formato (no fecha fija), añadido `npm run audit:i18n`. Los grupos de valores duplicados son intencionales (roles de UI distintos) — ver cabecera del diccionario. (I18N-CL1, I18N-CL2, I18N-CL4)

---



## [1.59.11] — 2026-05-21

**fix(test): v1.59.11 — la suite e2e-comprehensive ahora pasa 23/23 (era 11/23).** Causa raíz: `page.goto(baseUrl + '/#/X')` es un no-op para cambios solo de hash en Playwright. El nuevo helper `goRoute(hash)` rebota por `about:blank` antes de cada `goto` y fuerza una navegación real. (e2e-harness-r1)

---



## [1.59.10] — 2026-05-21

**fix(api): NEW-F1-sub-r1 (v1.59.10) — middleware de `..` crudo movido arriba de todas las rutas `/api`.** El de v1.59.8 estaba después de `app.all` y nunca disparaba. Ahora corre antes de la normalización de Express. (NEW-F1-sub-r1)

---



## [1.59.9] — 2026-05-21

**fix(ux): UX-A5-r4 (v1.59.9) — marcador de debug `data-toc-spy="active"` + lock-test conductual del scroll-spy del Help TOC.** Sexto ciclo: las 5 cerraduras anteriores pasaron las pruebas estáticas pero el bug persistía. v1.59.9 añade marcador, paint inicial síncrono, re-compute con doble rAF, listener de resize, y limpieza completa en hashchange. (UX-A5-r4)

---



## [1.59.8] — 2026-05-21

**fix(ux+api): v1.59.8 — UX-A5-r3 + NEW-F1-sub (HIGH + LOW agrupados).** Excepción de doctrina autorizada por el reporte FINAL-REGRESSION-v1.59.7. UX-A5-r3: `#/help` cambia el IntersectionObserver por un listener `scroll` con rAF throttling — tras 4 ciclos de fallos del IO, ahora el scroll-spy es robusto en todos los modos de scroll. NEW-F1-sub: middleware que rechaza `..` crudos en `/api/*` con 404 JSON. (UX-A5-r3 · NEW-F1-sub)

---



## [1.59.7] — 2026-05-20

**fix(api): NEW-D3-cache (v1.59.7) — `GET /api/cv` envía `Cache-Control: no-store`.** El CV es el artefacto principal del usuario; siempre revalidar. (NEW-D3-cache)

---



## [1.59.6] — 2026-05-20

**feat(a11y): NEW-D2-motion (v1.59.6) — respeto a `prefers-reduced-motion: reduce`.** Nuevo bloque `@media` neutraliza animaciones, transiciones y `scroll-behavior`. (NEW-D2-motion)

---



## [1.59.5] — 2026-05-20

**fix(api): NEW-F1 (v1.59.5) — `/api/*` desconocido devuelve 404 JSON en cada verbo.** `app.get` → `app.all`. (NEW-F1)

---



## [1.59.4] — 2026-05-20

**fix(ui): NEW-OR1 (v1.59.4) — chip Active/Keys en `#/config` ahora libre de races.** Construye los nodos antes del swap, token de in-flight, caché del último estado bueno. (NEW-OR1)

---



## [1.59.3] — 2026-05-20

**fix(ux): UX-A5-r2 (v1.59.3) — scroll-spy en `#/help` reforzado.** rootMargin ampliado de 10 % a 25 % de banda visible + estado inicial calculado al montar. (UX-A5-r2)

---



## [1.59.2] — 2026-05-20

**fix(ui): v1.59.2 — chip Active/Keys: cuenta correcta, nombre del proveedor capitalizado, sin solapamiento.** (post-v1.59.1 hotfix)

---



## [1.59.1] — 2026-05-20

**fix(test): v1.59.1 — NEW-D1 guard acepta el copy ES pulido en UX-A11.** Relajada la regex que bloqueaba `pipe.title[es]` a `vacantes`. Ahora también acepta `candidaturas`. (v1.59.1)

---



## [1.59.0] — 2026-05-20

**feat(ui): UX-A14 (v1.59.0) — Pase de auditoría mobile (≤ 420 px).** Cinco correcciones en un nuevo bloque `@media (max-width: 420px)`: card-row 1-up, hero CTAs apilados, page-header apilado, qa-grid floor 160 px, api-keys summary compacto. (UX-A14)

---



## [1.58.65] — 2026-05-20

**test(ui): UX-A2 (v1.58.65) — test de bloqueo del field-form estructurado de Modes.** Nuevo test que protege la implementación v1.54.3 contra regresiones. (UX-A2)

---



## [1.58.64] — 2026-05-20

**fix(i18n): UX-A11 (v1.58.64) — pulido del copy en español.** eval.subtitle ahora usa ajuste del CV, Puntaje, cabecera, informe. pipe.title ahora es Pipeline de candidaturas. (UX-A11)

---



## [1.58.63] — 2026-05-20

**fix(ui): UX-A15 (v1.58.63) — tile Pipeline del Dashboard con peso visual primario.** El tile Pipeline ahora destaca con borde de acento, ícono más grande y etiqueta en negrita. (UX-A15)

---



## [1.58.62] — 2026-05-20

**feat(ui): UX-A9 (v1.58.62) — chip sticky de resumen en la pestaña API keys.** `#/config → API keys` ahora muestra arriba un chip sticky con el proveedor activo y el conteo de claves configuradas. (UX-A9)

---



## [1.58.61] — 2026-05-20

**docs(readme): UX-A8 (v1.58.61) — sección de limpieza para primera ejecución añadida en los 8 READMEs.** Ahora se documenta el paso `make clean-test-fixtures` para purgar las dos URLs fixture QA antes del primer scan. (UX-A8)

---



## [1.58.60] — 2026-05-20

**feat(ui): UX-A12 (v1.58.60) — Cajón de notificaciones con Borrar todo + descartar por entrada.** Nuevo botón global y × por entrada en el panel de notificaciones. (UX-A12)

---



## [1.58.59] — 2026-05-20

**feat(ui): UX-A13 (v1.58.59) — CTA accionable «Fix →» en filas de salud que fallan.** Las filas con FAIL/OPTIONAL ahora muestran un botón ghost que enlaza directamente con la pestaña de configuración correspondiente. (UX-A13)

---



## [1.58.58] — 2026-05-20

**fix(ux): UX-A10 (v1.58.58) — protección contra perder edición no guardada en `#/cv`.** Ahora `beforeunload` (cierre del navegador) y `hashchange` (navegación SPA) muestran confirmación localizada antes de abandonar la página con buffer sucio. (UX-A10)

---



## [1.58.57] — 2026-05-20

**test(ui): UX-A7 (v1.58.57) — bloqueo de regresión sobre el contrato de refresco automático del cost-line.** Nueva prueba estática asegura que el evento `providers-changed` se despacha, se suscribe y que todas las vistas de asesor llaman a `UI.providerCostHint`. (UX-A7)

---



## [1.58.56] — 2026-05-20

**fix(a11y): UX-A4 (v1.58.56) — `.lang-btn` cumple el tamaño mínimo de objetivo táctil WCAG 2.5.8.** Antes los botones de idioma medían 23–25 px de alto, por debajo del piso de 24×24 px. Ahora `min-height: 28px` + `min-width: 28px` garantizan el cumplimiento WCAG 2.2 AA. (UX-A4)

---



## [1.58.55] — 2026-05-20

**feat(ui): UX-A3 (v1.58.55) — chip de proveedor activo en el Dashboard.** El hero de `#/dashboard` ahora muestra qué proveedor LLM está activo (`⚡ Live evals: Anthropic claude-sonnet-4-6` o `📋 Manual prompt mode`). Se actualiza automáticamente al cambiar `LLM_PROVIDER` en `#/config` y al recuperar foco en la pestaña. (UX-A3)

---



## [1.58.54] — 2026-05-20

**fix(ux): UX-A1 (v1.58.54) — aviso defensivo de estructura para el brief de Deep.** Cuando el brief guardado no incluye al menos 3 de las 6 secciones canónicas (Company snapshot / Engineering culture / Recent news / Glassdoor / Interview process / Negotiation leverage), `public/js/views/deep.js` antepone un aviso no bloqueante con enlace a la referencia. Solución a nivel de UI; la corrección en el prompt vive en el proyecto padre. (UX-A1)

---



## [1.58.53] — 2026-05-20

**fix(ux): UX-A6 — todo saved-card pasa por un único helper `renderSavedCard()`.** Garantiza la estructura `<span>+<time>` en cada path de renderizado. 948 → **949** unitarios. (UX-A6)

---

## [1.58.52] — 2026-05-20

**fix(ux): UX-A5 — scroll-spy del TOC en `#/help` ahora dispara correctamente.** Regresión de v1.58.45 (setTimeout(0) era demasiado temprano). Fix: refs directas a `headings` + doble `requestAnimationFrame`. 947 → **948** unitarios. (UX-A5)

---

## [1.58.51] — 2026-05-20

**chore(docs): v1.58.51 — limpieza final del ciclo v1.58.37 → v1.58.50 (14 releases).** Sin cambios de código. qa/ reorganizado (todo lo version-locked en `archive/v158-cycle/`); 6 perennials en raíz. `REGRESSION-FINAL §13` documenta cada invariante v1.58.37→.50. `UX-AUDIT-PROMPT.md` extendido. Baseline sin cambios (947/947). (housekeeping)

---

## [1.58.50] — 2026-05-20

**docs: DOC-1 — `qa/REGRESSION-FINAL.md` añade §5a documentando que los cuerpos de error del servidor son inglés-por-política.** Cierra NEW-D4 como `not-a-finding`. Recomendación A del spec. **Cierra la cola v1.58.37 → v1.58.50 de FIX-PROMPT-FINAL-EXHAUSTIVE.md (14 releases).** 946 → **947** unitarios. (DOC-1)

---

## [1.58.49] — 2026-05-20

**chore(tooling): TOOL-1 — `make clean-test-fixtures` + script para eliminar líneas `example.com` de `data/pipeline.md` del proyecto padre.** Soporta `--dry-run`. 4 tests CI-isolated. 942 → **946** unitarios. (TOOL-1)

---

## [1.58.48] — 2026-05-20

**fix(ux/onboarding): UX-D-B — banner global en `#/dashboard` cuando el perfil sigue en el template por defecto.** Nuevo `profileFixtureBanner()` que muestra `.hero-banner--warning` al detectar `Profile customized: false` en /api/health. Nuevas claves i18n `onboarding.fixtureWarning` + `onboarding.fixProfile` × 8. 941 → **942** unitarios. (UX-D-B)

---

## [1.58.47] — 2026-05-20

**fix(ux/naming): UX-D-C — el botón "Quick scan" de la barra superior pasa a llamarse `Abrir Scan` para reflejar que solo navega (no inicia un scan).** Actualizado en las 8 locales. 940 → **941** unitarios. (UX-D-C)

---

## [1.58.46] — 2026-05-20

**fix(ux): UX-D-D — checklist de `#/apply` sustituye `{company}-{role}` por slugs derivados del URL/JD.** Antes los placeholders se mostraban literalmente. Nuevas funciones `extractSlugs` + `substitutePlaceholders` reconocen Greenhouse/Lever/Ashby/Workable/SmartRecruiters/Workday. Fallback `[company]/[role]`. 939 → **940** unitarios. (UX-D-D)

---

## [1.58.45] — 2026-05-20

**fix(ux): UX-D-K — scroll-spy en el TOC de `#/help` resalta la sección actual.** `IntersectionObserver` aplica `.toc-current` al enlace cuyo H2 está en la banda de lectura. 938 → **939** unitarios. (UX-D-K)

---

## [1.58.44] — 2026-05-20

**fix(ux): UX-D-L — el brief abierto en Saved-research de `#/deep` tiene un botón × para cerrar.** Antes no había forma de cerrar el brief sin desplazarse o navegar. Nueva clave `deep.closeBrief` × 8. 937 → **938** unitarios. (UX-D-L)

---

## [1.58.43] — 2026-05-20

**fix(ux): UX-D-F — submit vacío en `#/evaluate` muestra toast localizado distinto.** Antes confundía vacío con "demasiado corto". Nueva clave `eval.emptyJd` × 8. 936 → **937** unitarios. (UX-D-F)

---

## [1.58.42] — 2026-05-20

**fix(ux): UX-D-J — paridad del chip de ETA en todas las páginas de advisor.** Antes solo `#/auto` mostraba "⏱ ~1–2 min". Ahora también `#/evaluate`, `#/deep`, y las 5 mode-pages muestran `⏱ ~30s` (clave `advisor.eta` × 8). 935 → **936** unitarios. (UX-D-J)

---

## [1.58.41] — 2026-05-20

**fix(ux/truthfulness): UX-D-I — la cost-hint vuelve a consultar al cambiar de pestaña + en evento `providers-changed`.** Antes solo se cargaba una vez; ahora se re-fetch via `visibilitychange` + un `CustomEvent` que dispara `#/config` al guardar. 934 → **935** unitarios. (UX-D-I)

---

## [1.58.40] — 2026-05-20

**fix(ux/docs): UX-D-H — regression-lock para que toda URL `career-ops.org/docs/...` visible siga siendo clickeable.** Nueva `tests/external-doc-links.test.mjs` valida views/*.js y docs/help/*.md. 932 → **934** unitarios. (UX-D-H)

---

## [1.58.39] — 2026-05-20

**fix(ux): NEW-D2 — botón Refresh en el header del panel con feedback explícito.** Distinto del Refresh del banner de conexión; este re-fetch in-place sin recargar la página. 2 nuevas claves i18n. 931 → **932** unitarios. (NEW-D2)

---

## [1.58.38] — 2026-05-20

**fix(a11y): NEW-D3 (WCAG 4.1.2) — input de búsqueda de `#/tracker` con `aria-label` localizado distinto del placeholder.** Antes solo había placeholder; SR no escuchaban el propósito. Nueva clave `track.searchAria` × 8 idiomas, distinta del placeholder. 930 → **931** unitarios. (NEW-D3)

---

## [1.58.37] — 2026-05-20

**fix(i18n): NEW-D1 — H1 de `#/pipeline` localizado en es/pt-BR/ru + 2 fugas RU corregidas.** `pipe.title` en `es` ahora `Pipeline de vacantes`; nuevo `tests/i18n-no-latin-leaks.test.mjs` que también atrapó `ru.contacto.title` y `ru.health.title`. 928 → **930** unitarios. (NEW-D1)

---

## [1.58.36] — 2026-05-20

**chore(docs): v1.58.36 — limpieza completa al cerrar el ciclo v1.58.x.** Sin cambios de código. (1) qa/: 3 snapshots versionados (`REGRESSION-END-TO-END-v1.58.16/33/35.md`) archivados en `qa/archive/v158-cycle/`. (2) `REGRESSION-FINAL.md` añade **§12** con todos los invariantes v1.58.4 → v1.58.35. (3) `UX-AUDIT-PROMPT.md` extendido con 30 filas cerradas. (4) docs/architecture/ actualizado (FRONTEND drawer, TESTING totales 928/62/20/23). (5) CLAUDE.md gana sección "Lecciones difíciles del ciclo v1.58.x". (6) README ×8 con nueva fila "Notificaciones 🔔" + conteo de tests corregido. Baseline sin cambios. (housekeeping)

---

## [1.58.35] — 2026-05-20

**fix(ui): v1.58.35 — el drawer de notificaciones ya no se auto-abre + nueva §18 "Notificaciones" en la ayuda.** Bug v1.58.34: `.notif-drawer { display: flex }` ganaba contra UA `[hidden] { display: none }`. Fix con `.notif-drawer[hidden] { display: none }` explícito + sólo se abre al hacer clic en el sino. Nueva §18 en las 8 traducciones de la ayuda con la tabla de categorías. 927 → **928** unitarios. (reporte de usuario)

---

## [1.58.34] — 2026-05-20

**feat(ui): v1.58.34 — Drawer de notificaciones (cierra U-13 por completo).** Sobre la captura de v1.58.33: nueva API `UI.onToast(fn)` (pub/sub), campana 🔔 en la top-bar con badge de no leídos, drawer derecho con título/vacío/items localizados (`notif.* × 8`). Esc + cerrar + click en la campana cierran. 926 → **927** unitarios. (U-13 follow-up)

---

## [1.58.33] — 2026-05-20

**fix(ux): U-13 + U-14 + U-15 — diario de toasts (cap 50 + `UI.getToastHistory()`) + selector de seguridad para `.page-header h1 + p` + indicador de cambios sin guardar en `#/cv`.** Cierra el ciclo v1.58.x. Nueva clave i18n `cv.unsaved` × 8 idiomas. 925 → **926** unitarios. (U-13/U-14/U-15)

---

## [1.58.32] — 2026-05-20

**fix(ux): U-12 — la barra de filtro del TOC de ayuda gana `min-width: 16ch` para que los placeholders KO/JA no se recorten.** Clase `.help-toc__filter` añadida. 924 → **925** unitarios. (U-12)

---

## [1.58.31] — 2026-05-20

**fix(ux): U-11 — el encabezado `Legitimacy` del Tracker ahora muestra un chip de info ⓘ con tooltip explicando la escala (Alta/Precaución/Sospechosa).** Nueva clave i18n `track.col.legitimacy.help` × 8 idiomas. 923 → **924** unitarios. (U-11)

---

## [1.58.30] — 2026-05-20

**fix(ux): U-10 — los botones Normalizar / Dedup / Merge del Tracker se desactivan cuando `data/applications.md` está vacío.** Tooltip localizado (`track.fixEmpty` × 8 idiomas) explica que hay que añadir filas primero. 922 → **923** unitarios. (U-10)

---

## [1.58.29] — 2026-05-20

**fix(ux): U-9 — la fila contador ↔ filtro de `#/pipeline` se apila verticalmente en ventanas estrechas.** Nueva clase `.pipeline-controls` + `@media (max-width: 720px)` que estira el filtro a 100% del ancho. 921 → **922** unitarios. (U-9)

---

## [1.58.28] — 2026-05-20

**fix(ux): U-8 — el bloque del prompt generado ahora está colapsado por defecto en las 7 páginas de modo.** Envuelto en `<details class="prompt-block">`; el resumen muestra "Show prompt (N lines)" localizado (`prompt.show` / `prompt.lines` × 8). Copy + Run-live se mantienen visibles. 920 → **921** unitarios. (U-8)

---

## [1.58.27] — 2026-05-20

**fix(ux): U-7 — los divisores ASCII `===` de `verify-pipeline.mjs` se eliminan del modal de resultado.** Regex `^={10,}$` aplicada en el handler antes de renderizar. 919 → **920** unitarios. (U-7)

---

## [1.58.26] — 2026-05-20

**fix(ux): U-6 — el chip de `#/scan` "Active companies N/M" ahora explica N vs M con tooltip + aria-label.** Nueva clave `scan.activeCo.help` × 8 idiomas. 918 → **919** unitarios. (U-6)

---

## [1.58.25] — 2026-05-20

**fix(ux/ia): U-5 — Dashboard deduplica CTAs (eliminados el botón `Open Pipeline` del header y la tarjeta `Scan all sources`).** El sidebar y el héroe ya cubren ambas rutas; las 4× Pipeline / 4× Scan que detectó la QA v1.58.3 quedan reducidas a 2× cada una. 917 → **918** unitarios. (U-5)

---

## [1.58.24] — 2026-05-20

**fix(ux): U-4 — los toasts de error tucan el postfijo "(MÉTODO /ruta · HTTP NNN)" dentro de un `<details>` colapsado.** El postfijo técnico sigue presente en el DOM (invariante de BUG-006), pero el titular humano queda limpio. Nueva clave i18n `toast.details` × 8 idiomas. 916 → **917** unitarios. (U-4)

---

## [1.58.23] — 2026-05-20

**fix(ux): U-3 — el placeholder de `lastContact` en `#/followup` ahora se calcula como hoy − 14 días.** Antes el placeholder era el ISO congelado `2026-04-21` y envejecía mal; ahora se computa en render via `new Date()` con `setDate(getDate() - 14)`. 915 → **916** unitarios. (U-3)

---

## [1.58.22] — 2026-05-20

**fix(ux): U-2 — el H1 de `#/auto` ya no se rompe a 2 líneas por el `✨` inicial.** Antes el `auto.title` contenía `✨ Auto-pipeline para una URL`; el emoji participaba en el wrap. Se separa el emoji en un `<span class="page-icon" aria-hidden="true">` y `.page-header--icon` usa `display: grid`. 914 → **915** unitarios. (U-2)

---

## [1.58.21] — 2026-05-20

**fix(ux): U-1 — H1 + subtítulo de `#/cv` ahora coinciden con el resto de páginas (supersede UX-9 v1.56.0 por diseño).** El chip `.cv-breadcrumb` se eliminó; el header de `#/cv` ahora usa `<h1 class="page-title">` + `<p class="page-subtitle">`. El invariante de UN solo `<h1>` se mantiene. 913 → **914** unitarios. (U-1)

---

## [1.58.20] — 2026-05-20

**fix(i18n/platform): I-6 — el atajo en el pie de barra muestra ⌘K en Mac y Ctrl+K en otros sistemas, con el verbo localizado.** Antes era el literal `CTRL+K — search` en todas las plataformas/idiomas. `top.langhint` ahora usa `{hotkey} — buscar`; `applyFooterHotkey()` sustituye `{hotkey}` por la combinación nativa según `navigator.platform`. 915 → **916** unitarios. (I-6)

---

## [1.58.19] — 2026-05-20

**fix(i18n): I-4 — `#/followup` ruso ya no filtra `cadence` / `follow-up`.** Las cadenas RU del modo followup (H1, hints) usaban `cadence`, `follow-up`, `scope`, `timeline`. Reemplazadas por equivalentes nativos rusos. 914 → **915** unitarios. (I-4)

---

## [1.58.18] — 2026-05-20

**fix(i18n): I-3 — ítems 2/5/13/14 del TOC de ayuda sin restos de inglés en locales no latinos.** Algunos bundles de ayuda aún mostraban `## 2. App settings & API keys`, `## 5. Portals & Sources`, `## 13. Mode prompts`, `## 14. Apply checklist` (ru/ja/ko/zh-CN/zh-TW). Ahora totalmente localizados en los 8 idiomas. 913 → **914** unitarios. (I-3)

---

## [1.58.17] — 2026-05-20

**fix(i18n): I-2 — fechas de Saved-research ahora usan `Intl.RelativeTimeFormat` por locale.** El helper `formatRelative()` en [public/js/views/deep.js](public/js/views/deep.js#L57-L82) devolvía `today` / `1d ago` / `Nd ago` en inglés en todos los idiomas. Sustituido por `Intl.RelativeTimeFormat(I18n.getLang(), { numeric: 'auto' })` — la cadena nativa del navegador (hoy/ayer, сегодня/вчера, 今日/昨日, etc.). Fechas > 7 días caen a `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`. 912 → **913** unitarios. (I-2)

---

## [1.58.16] — 2026-05-20

**fix(ui): parpadeo de hover en botones de marca (reportado por usuario).** Causa: el fondo por defecto de `.btn-primary` / `.btn-danger` era un `linear-gradient(...)` y el `:hover` lo reemplazaba por un color sólido — CSS no puede interpolar gradiente↔sólido, así que la transición de 180 ms chasqueaba y se veía un parpadeo blanco/rosa. Solución en [public/css/app.css](public/css/app.css): mantener el gradiente en hover y oscurecer con `filter: brightness(0.92)` — `filter` se interpola limpiamente. La lista de `transition` de `.btn` añade `filter var(--transition)` para que el oscurecimiento se anime. 911 → **912** unitarios. (reporte de usuario)

---

## [1.58.15] — 2026-05-20

**fix(a11y/i18n): I-1 — `aria-label` y `<label>` oculto del buscador superior ahora se localizan.** Antes los lectores de pantalla en cualquier idioma escuchaban el aria-label inglés. Nuevo hook genérico `data-i18n-aria-label` en [public/js/app.js](public/js/app.js#L4-L29) — `applyI18n()` actualiza `aria-label` en cada cambio de idioma como ya lo hace para `data-i18n` y `data-i18n-placeholder`. Dos nuevas claves i18n (`top.search.aria`, `top.search.label`) en los 8 idiomas. El hook es reutilizable para cualquier control futuro. 910 → **911** unitarios. (I-1)

---

## [1.58.14] — 2026-05-20

**fix(ux): M-9 — el botón `Actualizar` del banner de conexión ahora da feedback (antes era una recarga silenciosa).** Hasta v1.58.13 el handler llamaba directamente a `location.reload()`. Ahora muestra un toast `Actualizando…`, marca `sessionStorage['refreshedToast']`, desactiva el botón para evitar dobles clics, y difiere la recarga 200 ms para que el toast pinte. En el arranque siguiente, app.js detecta la marca y emite un toast de éxito `Actualizado`. 2 nuevas claves i18n (`common.refreshing`, `common.refreshed`) en los 8 idiomas. 909 → **910** unitarios. (M-9)

---

## [1.58.13] — 2026-05-20

**fix(ux): M-8 — el checklist de `#/apply` ahora es interactivo.** Antes de v1.58.13, `▶ Generar checklist` mostraba los ítems 0…7 como un bloque monoespaciado `<pre>` no editable. Ahora cada ítem se renderiza como `<input type="checkbox">` real, envuelto en `<label>` (área de clic ≥44 px, WCAG 2.5.5). El estado se persiste por URL en `localStorage['applyChecklist:'+slug]` — marca 3 ítems, recarga, los 3 siguen marcados. Botones: **Copiar sin marcar** (copia los ítems abiertos como bullets `- markdown`) y **Restablecer**. 5 nuevas claves i18n (`apply.checklist.copyUnchecked`, `resetBtn`, `copied`, `copyFailed`, `reset`) en los 8 idiomas. Fallback defensivo si el parser no encuentra ítems. 908 → **909** unitarios. (M-8)

---

## [1.58.12] — 2026-05-20

**fix(ux): M-7 — la línea de coste ahora sigue al proveedor activo (OpenRouter ya no cae en un número fabricado).** `UI.providerCostHint()` ya consultaba `/api/status/providers`, pero los mapas por proveedor en [public/js/api.js](public/js/api.js#L623-L676) sólo listaban `anthropic`/`gemini`/`openai`/`qwen`. Tras v1.57.0 con OpenRouter como 5º proveedor, éste caía al genérico 0,03 y mostraba el literal `openrouter` en minúsculas. Ahora EST incluye `openrouter: null` (el router elige el modelo — el coste varía), y la rama `=== null` emite `cost varies (router picks)` localizado en lugar del falso `~$0.03/eval`. NAME añade `openrouter: 'OpenRouter'`. Nueva clave i18n `cost.varies` en los 8 idiomas. 907 → **908** unitarios. (M-7)

---

## [1.58.11] — 2026-05-20

**fix(ux): M-4 — el espaciado entre título y fecha en la tarjeta de investigación guardada ahora es CSS estructural (antes margen inline).** La regresión MASTER de v1.58.3 verificó que algunas tarjetas mostraban `software-engineer-generaltoday` (sin espacio entre título y fecha), mientras otras estaban bien — el código previo dependía de `style="margin-left: 8px"` entre dos `<span>` sueltos, que colapsaba en ciertos casos. Corrección en [public/js/views/deep.js](public/js/views/deep.js#L34-L55) — sustituye los dos `<span>` por `.saved-card__title` + un `<time class="saved-card__date" datetime="…">` semántico, envueltos en un contenedor flex `.saved-card`. El espaciado ahora lo controla `gap: var(--space-2, 8px)`, no puede colapsar (y se gana semántica a11y/SEO con `<time>`). 906 → **907** unitarios. (M-4)

---

## [1.58.10] — 2026-05-20

**fix(ux): M-2 — descartar el toast de progreso antes de abrir cualquier modal de resultado.** Hacer clic en `sync-check` en `#/cv` dejaba el toast "Running cv-sync-check.mjs…" abajo a la derecha mientras se abría el modal de resultado — ambos compitiendo por la atención y, en pantallas estrechas, solapándose visualmente. Los botones Doctor / verify-pipeline de la página Health ya llamaban a `UI.dismissToast()` explícitamente antes de `UI.modal()`; el sync-check de cv.js era el único punto de entrada que lo omitía. Corrección en [public/js/api.js](public/js/api.js#L272) — `UI.modal()` ahora invoca `dismissToast()` como primera sentencia, cubriendo cualquier futuro punto de entrada (defensa en profundidad). Además, las cadenas de `cv.js` se localizaron mediante `t('cv.syncCheckRunning')` y `t('cv.syncCheck')` (invariante BUG-008: título del modal == etiqueta localizada del botón). Dos nuevas claves i18n añadidas en los 8 idiomas. 905 → **906** unitarios. (M-2)

---

## [1.58.9] — 2026-05-20

**fix(a11y): M-1 — restablecer un anillo visible de `:focus-visible` en los campos de formulario (WCAG 2.4.7 Nivel AA).** La regresión MASTER de v1.58.3 confirmó que `getComputedStyle(focusedInput)` devolvía `outline: rgb(255,255,255) none 1.5px` — la palabra clave `none` colapsaba el anillo a 0 px en cada campo. Causa raíz: las reglas base `.input, .textarea, .select { outline: none }` y `.searchbar input { outline: none }` tenían mayor especificidad que el `*:focus-visible` global y anulaban silenciosamente el anillo de teclado en 88 elementos por página. Corrección en [public/css/app.css](public/css/app.css) — añadidas reglas explícitas `.input:focus-visible/.textarea:focus-visible/.select:focus-visible` y `.searchbar input:focus-visible` con `outline: 2px solid var(--rausch)` + sombra translúcida; el foco de ratón sigue limpio (usa `:focus`, no `:focus-visible`). 904 → **905** unitarios (`tests/qa-report-fixes.test.mjs` guarda estática); Playwright **60 → 61** (`tests/playwright-smoke.mjs` Tab-traversal). (M-1)

---

## [1.58.8] — 2026-05-20

**feat(health): mostrar `OPENAI_API_KEY`, `QWEN_API_KEY`, `OPENROUTER_API_KEY` en `#/health` (igual que `GEMINI_API_KEY`).** v1.57.0 sumó OpenRouter como 5º proveedor live-eval; v1.55.3 (UX-2) añadió el onboarding de 4 proveedores. La página `#/health` solo reportaba `GEMINI_API_KEY` y `ANTHROPIC_API_KEY` — los otros tres quedaban invisibles aunque `/api/status/providers` ya los enrutaba. Petición del usuario: extender el mismo patrón "set / unset (manual mode)" a cada proveedor headless. [server/lib/routes/health.mjs](server/lib/routes/health.mjs#L57-L71) ahora añade tres filas adicionales de checks opcionales, conectadas al mismo `isUsableKey` (`hasOpenAIKey()`, `hasQwenKey()`, `hasOpenRouterKey()` ya estaban importadas pero sin usar). El texto "manual mode" coincide con la fila GEMINI en los 8 idiomas — la vista Health itera sobre `body.checks` por lo que no se requiere cadena por locale. 903 → **904** unitarios. (Solicitud del usuario)

---

## [1.58.7] — 2026-05-20

**fix(security): NEW-2 — `isValidJobUrl` ahora rechaza las sintaxis emparejadas de plantillas (`${…}`, `{{…}}`) para coincidir con el mensaje de error.** El 400 a nivel de ruta de `POST /api/pipeline` anuncia *"contain no script or template characters"*, pero la regresión MASTER de v1.58.3 confirmó que solo `<%…%>` estilo ASP/EJS estaba realmente bloqueado (efecto colateral del filtro `[<>"'`\\\s]`). Las plantillas JS (`${TEST}`) y Mustache/Handlebars (`{{TEST}}`) pasaban — un desfase semántico regex↔mensaje. Opción A del fix-prompt (endurecer la regex para coincidir con el mensaje; ligero refuerzo contra inyección por templating en URL): nuevo `TEMPLATE_PATTERNS` en [server/lib/security.mjs](server/lib/security.mjs) consultado vía `hasTemplatePlaceholder(url)` antes de `new URL(…)`. Solo se rechazan placeholders **emparejados** — `{normal}` (token ATS legítimo) sigue aceptándose. 901 → **903** unitarios. (NEW-2)

---

## [1.58.6] — 2026-05-20

**fix(a11y/i18n): BUG-008-tb — el título del modal del botón `Doctor` en la barra superior ahora coincide con la etiqueta localizada.** La regla BUG-008 (cerrada en v1.58.0) exige *"título del modal == etiqueta localizada del botón"*. La regresión MASTER de v1.58.3 detectó que el punto de entrada **de la barra superior** seguía violando la invariante: hacer clic en `Doctor` abría un modal con título `doctor` (inglés en minúsculas), independientemente del idioma. Corrección en [public/js/app.js:118](public/js/app.js#L118) — sustituir el literal `'doctor'` por `I18n.t('top.doctor', 'Doctor')`. La clave `top.doctor` ya existe en los 8 idiomas (EN `Doctor` · ES/pt-BR `Diagnóstico` · KO `진단` · JA `診断` · RU `Диагностика` · zh-CN `诊断` · zh-TW `診斷`) y es la misma que declara el botón vía `data-i18n="top.doctor"`. Guardia estática añadida en `tests/qa-report-fixes.test.mjs`. 900 → **901** unitarios; Playwright 60/60. (BUG-008-tb)

---

## [1.58.5] — 2026-05-20

**fix(ui): NEW-3 — `#/followup` Run-live doble-POST triado *no-reproducible*; bloqueado con guardia de regresión Playwright.** La regresión MASTER de v1.58.3 observó (mediante `window.fetch` parcheado) dos POSTs idénticos a `/api/mode/followup` en ~2 s tras un único clic en Run live en `#/followup` (con empresa/rol/notas rellenos y fecha vacía). Siguiendo la doctrina "reproducir primero" del fix-prompt, la inspección de `public/js/views/mode-page.js::submit()` muestra: (a) Run live y Generate prompt son `<button>` planos con un único `onClick` cada uno — no hay `<form>` padre ni `addEventListener('submit')` que dispare dos veces, y (b) `UI.withSpinner()` (FIX-L1) marca `button.disabled = true` mientras la petición está en vuelo, bloqueando un segundo clic físico en origen. Una nueva prueba Playwright en `tests/playwright-smoke.mjs` recorre la receta exacta de la regresión — rellena empresa/rol/notas, deja la fecha vacía, hace clic en el botón manual (que comparte la función `submit()` con Run live) y verifica **exactamente un** `POST /api/mode/followup` en una ventana de 3 s. Selector estable entre locales (el glifo `▶` es idéntico en los 8 idiomas) y `addInitScript` siembra `career-ops-ui:lang=en` para que una prueba previa de idioma en el mismo contexto del navegador no perturbe los selectores. Playwright **59 → 60**. La observación QA original queda como receta; no requiere cambio de código en producción. (NEW-3)

---

## [1.58.4] — 2026-05-19

**fix(security): NEW-1 — enviar `Content-Security-Policy` en cada respuesta (antes limitado a no-loopback).** Antes de v1.58.4 la cabecera CSP solo se añadía cuando `isPubliclyExposed()` era verdadero (HOST fuera de loopback); sobre `127.0.0.1` tanto `/` como `/api/health` devolvían **sin** CSP, dejando el contrato escape-first de `UI.md()` como única defensa XSS. La regresión MASTER de v1.58.3 (§5) lo marcó como invariante crítica. Ahora la CSP es **incondicional** e idéntica en cada respuesta: `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`. `script-src` nunca permite `'unsafe-inline'`/`'unsafe-eval'`. El conjunto de directivas no cambia respecto a la política anterior (ya correcta para la SPA — Google Fonts en lista blanca para Inter), sin regresión visual ni funcional. Se reescribió `tests/security-headers.test.mjs`; un recorrido Playwright (en/ru/ja/zh-TW × 7 rutas) verifica **0 violaciones de CSP**. 900 unitarios · Playwright 58→59 · e2e 20/20+23/23. Los siguientes elementos del fix-prompt se publican como versiones one-fix posteriores. (NEW-1)

---

## [1.58.3] — 2026-05-19

**fix(deep): R-2 / FIX-C1 — elimina etiquetas de andamiaje HUÉRFANAS / desbalanceadas del output de investigación.** `cleanLlmMarkdown` (v1.58.0) solo quitaba bloques *emparejados* y una etiqueta *abierta colgante*. Una regresión profunda de v1.58.2 halló un modelo con traza desbalanceada — un `</tool_response>` huérfano (y `</thinking>`) sin apertura — que sobrevivía y se renderizaba literal en el brief guardado de `#/deep`. Un barrido conservador final elimina ahora **cualquier** token de andamiaje suelto (abierto o cerrado), el XML de herramientas de Anthropic (`<invoke>`/`<parameter>`/`antml:*`) y bloques ```tool_*```. Puro + idempotente; autoenlaces `<https://…>` y spans de código se preservan. **FIX-C2** triado **no-reproducible** (i18n.js ya fija `<html lang>` y detecta `navigator.language`). Ambos bloqueados con guards. 896 → **900** unit · Playwright 58/58. Resto del fix-prompt v1.58.3 en cola como one-fix ships (doctrina: nunca en lote).

---

## [1.58.2] — 2026-05-19

**fix(i18n): I18N-011 — localiza el índice de `#/help` en los 7 idiomas no-EN.** El TOC se construye desde los encabezados `##` de `docs/help/<lang>.md`. Las secciones 3/4/6/7/8/9/10/11/12 aún tenían títulos en **inglés** en es/pt-BR/ko/ja/ru/zh-CN/zh-TW, así que el TOC salía en inglés mientras el sidebar estaba traducido. Cada encabezado afectado se localiza ahora al **mismo término que la clave `nav.*` del sidebar** (fuente única — TOC ↔ sidebar coinciden), conservando el número de sección y el paréntesis `(#/route …)` literal. EN sin cambios. Cierra el único pendiente i18n del barrido QA v1.58. Solo docs; 896/896 unit · 33/33 help · Playwright 58/58.

---

## [1.58.1] — 2026-05-19

**fix(test): guard `checkProfileCustomized` CI-aislado (parche sobre v1.58.0).** v1.58.0 pasó el pre-commit (consultivo) pero falló en `ci.yml` (Node 18/20/22): el test usaba import dinámico cache-bust + reescritura de `PATHS`, pero `paths.mjs` resuelve la raíz **una vez por proceso**. Reemplazado por un **guard estático** robusto (allow-list + regex `^(…)$/i` anclado; un nombre real con "test" nunca se marca). Sin cambios de código de producción; desbloquea `publish-package.yml`. 896/896 unit · Playwright 58/58. Ver `qa/v158-regression/`.

---

## [1.58.0] — 2026-05-19

**fix(qa): barrido de bugs del informe QA externo + salida de investigación limpia y formateada.** Corregido: **BUG-001** `#/followup` valida la fecha opcional como ISO `YYYY-MM-DD` en el cliente; **BUG-003** `**negrita**`/`` `código` ``/enlaces ahora se renderizan dentro de citas en `UI.md()` (todas las páginas de Ayuda); **BUG-005** URL duplicada en pipeline muestra «Ya está en la cola — omitido»; **BUG-006** mensaje de URL inválida humanizado (contexto `(POST /api/pipeline · HTTP 400)` se mantiene a propósito); **BUG-007/008** el toast «Running doctor.mjs…» se descarta antes del modal (nuevo `UI.dismissToast()`), título del modal = etiqueta localizada del botón; **BUG-010** subtítulo en el estado vacío de `#/reports`; **BUG-002/UX-032** `checkProfileCustomized()` marca fixtures de prueba como «no personalizado» (no se tocan `profile.yml`/`cv.md` del padre — regla #1); **I18N-012/013** Deep research en ruso realmente traducido. **Nuevo:** `cleanLlmMarkdown()` elimina el andamiaje de agente (`<tool_call>{…}</tool_call>`, `<tool_response>`, `<thinking>`, …) de `#/deep` y de Investigación guardada, en todos los proveedores y al servir archivos ya guardados; alias `#/outreach`→`#/contacto` (BUG-004); error de red del cliente localizado vía `I18n.t()` (8 locales; los `details` del servidor son diagnósticos en inglés a propósito). **Tests:** nuevos `tests/qa-report-fixes.test.mjs` (10) y `tests/llm-output.test.mjs` (5); 881 → 896 unit; Playwright 58/58. **No cambiado (con justificación):** BUG-009 (H1 `#/cv` por diseño, WCAG single-h1), datos del padre (parent-owned), cola larga de i18n/UX menor en backlog. Detalle completo en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.57.2] — 2026-05-19

**fix(config): la causa REAL del «validation failed» en `/#/config` — el campo `lang` inyectado por la SPA.** `public/js/api.js` adjunta automáticamente un campo `lang` a *todos* los cuerpos POST JSON (para que las rutas LLM tomen el idioma de la UI). `/api/config` no es una ruta LLM y `lang` no es una clave de configuración, así que el rechazo de claves desconocidas de `validateConfig` (correcto y relevante para seguridad) devolvía 400 en **cada Guardado**: `validation failed — lang: not a known config key`. Era solo del navegador: los repros con curl/in-process nunca enviaban `lang`, por eso v1.57.0/.1 mejoraron el *mensaje* pero no la *causa*. La ruta ahora elimina el `lang` de transporte antes de validar; el filtro de escritura por `KNOWN_KEYS` sigue descartando cualquier clave realmente desconocida — la protección anti-inyección no cambia. Detectado por un nuevo barrido Playwright que pulsa el botón Guardar real. **Tests:** nuevo `tests/playwright-forms.mjs` (26, integrado en `npm run test:e2e:browser`) sobre **todos los formularios**; `config-endpoint` con paridad de navegador. 879 → 881 unit; Playwright 32 → 58. Detalle completo en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.57.1] — 2026-05-19

**fix(ux): cada error de API ahora dice QUÉ falló, DÓNDE y POR QUÉ; el texto del error de entrada es lo más descriptivo posible.** El servidor ya devolvía `{ error, details: ["CAMPO: motivo", …] }`, pero los formularios solo mostraban la línea superior («validation failed»), así que en `/#/config` (y en todas partes) no se sabía qué campo estaba mal. `api.js` ahora incorpora los `details` por campo en el mensaje **en todo el sitio** (un cambio, todos los formularios se benefician), añade el contexto de la petición `(MÉTODO /ruta · HTTP NNN)` (DÓNDE), recurre a un fragmento del cuerpo crudo en errores no-JSON, y los errores de red llevan método+ruta; `err.details` queda expuesto. Los mensajes de `validateConfig` son ahora máximamente descriptivos (qué falla y cómo arreglarlo). **Las claves secretas nunca muestran el valor introducido** (solo su longitud) — una clave real mal tecleada no se filtra a un toast/log. El rango de PORT ahora sí se valida (`99999` se rechaza). En `/#/config` PORT y HOST se rellenan con sus valores por defecto reales (`4317` / `127.0.0.1`). Los toasts de error permanecen más tiempo (9–20 s) y se ajustan/desplazan en vez de recortarse. **Tests:** nuevo `tests/config-validation-detail.test.mjs` (12); 874 → 879. Detalle completo en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.57.0] — 2026-05-19

**feat(provider): OpenRouter como 5º proveedor de evaluación en vivo headless + fix(config): «validation failed» al guardar cualquier clave API.** Las claves pegadas suelen llegar con un salto de línea final o espacios (portapapeles del SO, botones «copiar» de las consolas de proveedores) — antes de 1.57 eso disparaba el guard de saltos de línea para **todos** los proveedores, y la regex anclada en `$` de `ANTHROPIC_API_KEY` rechazaba por error claves Anthropic reales. Ahora `validateConfig` normaliza (recorta) cada valor **antes** de validar, la ruta persiste el valor recortado (autentica en runtime, sin romper `.env`), y la comprobación de Anthropic es un prefijo `sk-ant-` + longitud resiliente (el umbral compartido `isUsableKey()` ≥ 20 sigue siendo la verdadera comprobación). Los saltos de línea internos se siguen rechazando (guard de inyección en `.env`). **OpenRouter** es ahora un proveedor de primera clase: `OPENROUTER_API_KEY` en `/#/config` — una clave da acceso a más de 300 modelos. Es el **último** del orden `auto` (Anthropic → Gemini → OpenAI → Qwen → **OpenRouter**), así que una configuración existente nunca se redirige en silencio; `LLM_PROVIDER=openrouter` lo fija. Conectado al mismo camino `_tailProvider()` que OpenAI/Qwen en `/api/evaluate`, `/api/deep`, `/api/mode/:slug`; expuesto en `/api/status/providers` + el panel de Health. Cliente compatible con OpenAI (sin dependencias nuevas — `fetch` directo, timeout `AbortController`, la clave nunca se registra) con los headers `HTTP-Referer`/`X-Title` recomendados. El desplegable de modelos es en vivo: `OPENROUTER_MODEL` se llena desde **`GET /api/openrouter/models`** (proxy del servidor del catálogo público de OpenRouter — mantiene CSP `connect-src 'self'`), con lista curada de respaldo y caché en memoria de 10 min. Nuevas claves i18n (`config.openrouter*`) en los 8 idiomas. **Tests:** nuevos suites `tests/openrouter-route.test.mjs` y `tests/openrouter-model-selector.test.mjs`; suites `env-config`/`openai`/`provider-selector` ampliados. 831 → 855. Detalle completo en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.56.4] — 2026-05-19

**feat(ui): UX-N2 — pista visible y según plataforma de ⌘K / Ctrl K en la búsqueda global.** El atajo Cmd/Ctrl+K (enfocar la búsqueda) solo estaba en el `aria-label`/código, así que los usuarios videntes no lo descubrían y la app parecía más lenta de lo que es. Ahora un `<kbd class="kbd-shortcut">` atenuado va al final de la píldora de búsqueda, rellenado al arrancar desde `data-mac`/`data-other` según una comprobación de plataforma (`navigator.platform`/`userAgent`): **⌘K** en macOS/iOS, **Ctrl K** en el resto. Es `aria-hidden="true"` (el `aria-label` existente ya lo anuncia a los lectores de pantalla — la insignia no debe duplicar) y `pointer-events:none` (decorativa). El atajo Cmd/Ctrl+K existente no cambia. Sin nuevas claves i18n (los glifos son universales); la insignia es hijo flex del `.searchbar` existente (sin envoltorio/posición absoluta — el input ya es `flex:1`). **Pruebas:** nueva suite estática por código aislada de CI `tests/cmdk-hint-visible.test.mjs` (5): el `<kbd class="kbd-shortcut">` está dentro de `.searchbar`; es `aria-hidden="true"` con ambas variantes `data-mac`/`data-other`; `app.js` lo rellena vía comprobación `navigator`; el binding `(e.ctrlKey||e.metaKey)&&e.key==='k'` → `search.focus()` intacto (guard de regresión); `app.css` estiliza `.kbd-shortcut` y nunca `display:none`. 826 → 831. `feat(ui)` · `test: tests/cmdk-hint-visible.test.mjs`. Detalles — [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.56.3] — 2026-05-19

**fix(reliability): la detección de claves de proveedor rechaza marcadores de posición / valores demasiado cortos, no solo la cadena vacía.** Un `GEMINI_API_KEY` de marcador en un `.env` padre se reportaba como "✓ set" Y se elegía como proveedor activo por encima de un `ANTHROPIC_API_KEY` válido. `effectiveEnv()` solo rechazaba `undefined`/`''`, así que 10 caracteres de basura contaban como clave real: el banner de onboarding mostraba *GEMINI ✓ set*, `GET /api/status/providers` devolvía `activeProvider: "gemini"`, y toda evaluación ⚡ en vivo habría fallado en silencio contra una clave muerta ignorando una clave Anthropic válida de 108 caracteres. La nueva función pura `isUsableKey()` (`env-config.mjs`) considera un secreto configurado solo si tiene ≥ 20 caracteres (ninguna clave soportada es más corta — Gemini `AIza…` ≈ 39, Anthropic `sk-ant-…` ≈ 100+, OpenAI ≥ 40, Qwen ≈ 35) y no es un marcador conocido (`your_*_here`, `changeme`, `placeholder`, `<…>`, un solo carácter repetido…). Aplicada uniformemente a `hasAnthropicKey()`/`hasGeminiKey()` (`anthropic.mjs`), `hasOpenAIKey()`/`hasQwenKey()` (`openai.mjs`) y las filas `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` de `GET /api/health` (movidas de `process.env` crudo a la misma vista effective+plausible) — la página de salud, el endpoint de proveedores y el router OR ahora siempre coinciden. `selectActiveProvider()` no cambia; recibe un `keysConfigured` correcto. **Pruebas:** nueva suite aislada de CI `tests/key-detection-rejects-placeholder.test.mjs` (5): casos unitarios de `isUsableKey` + reproducción in-process con `createApp()` del escenario reportado (`.env` temporal con `GEMINI_API_KEY` de 10 caracteres + `ANTHROPIC_API_KEY` real) — `gemini` NO está en `keysConfigured`, `activeProvider === "anthropic"`, filas de `/api/health` coherentes. Cuatro pruebas existentes de capas effective-env alargaron sus stubs demasiado cortos (el contrato no cambia). 821 → 826. `fix(reliability)` · `test: tests/key-detection-rejects-placeholder.test.mjs`. Detalles — [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.56.2] — 2026-05-19

**feat(a11y): UX-N1 — `document.title` por ruta y con idioma (orientación multipestaña + anuncio de cambio de página del lector de pantalla).** Antes las 24 rutas mantenían el `<title>` estático de `index.html` ("career-ops — command center"): pestañas con el mismo nombre, marcadores genéricos y el mismo anuncio "página cambiada". `focusNewView()` en `public/js/router.js` ahora deriva el título del propio `<h1 class="page-title">` localizado de la vista — "Vista — career-ops" — así que los títulos se traducen automáticamente (sin nuevas claves i18n) y son únicos por ruta. Se fija **antes** del guard de primer pintado para que la pestaña inicial también tenga título (mismo orden que el `tabindex` de v1.56.0 UX-12). Recurre a `career-ops — command center` si una vista no tiene encabezado. **Pruebas:** nueva suite estática por código aislada de CI `tests/document-title-per-route.test.mjs` (4): `focusNewView` asigna `document.title`; el título proviene del `<h1>` (por ruta + localizado, no un literal único); la asignación precede a `!firstPaintDone`; hay un valor por defecto de producto. 817 → 821. `feat(a11y)` · `test: tests/document-title-per-route.test.mjs`. Detalles — [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.56.1] — 2026-05-19

**fix(a11y): se suprime el anillo de foco de marca espurio en el foco del encabezado con `tabindex="-1"` gestionado por el router.** `public/js/router.js` asigna `tabindex="-1"` al encabezado de la vista destino y le hace `.focus()` en cada navegación de cliente (para que el lector de pantalla anuncie la nueva página). Un elemento `tabindex="-1"` nunca es alcanzable por teclado, pero la heurística `:focus-visible` de Chromium seguía pintando el anillo de marca global (`*:focus-visible { outline: 2px solid var(--rausch) }`) — un **rectángulo rojo alrededor del encabezado** (p. ej. "Command Center" en `#/dashboard`) en cada navegación, que también quedó grabado en las capturas hero `images/dashboard-*.png`. La corrección es una sola regla acotada `[tabindex="-1"]:focus, [tabindex="-1"]:focus-visible { outline: none }` (patrón de foco gestionado de WAI-ARIA APG). El foco real de teclado en controles interactivos conserva el anillo global `*:focus-visible` (WCAG 2.4.7 intacto); el anillo del skip-link no se ve afectado (es un `<a>`, no `tabindex="-1"`, con mayor especificidad). Las 8 `images/dashboard-*.png` se regeneraron — sin recuadro rojo. **Pruebas:** nueva suite estática por código aislada de CI `tests/managed-focus-no-ring.test.mjs` (4): el anillo global `*:focus-visible` sigue definido (WCAG 2.4.7 sin regresión); `[tabindex="-1"]:focus,:focus-visible` ⇒ `outline:none`; la regla de supresión va después de la global (seguridad de cascada); la corrección es acotada (sin `*:focus{outline:none}` general). Junto con `tests/dashboard-initial-focus.test.mjs`. 813 → 817. `fix(a11y)` · `test: tests/managed-focus-no-ring.test.mjs`. Detalles — [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.56.0] — 2026-05-19

**feat(ux): paquete de pulido LOW — UX-9 / UX-10 / UX-11 / UX-12 (una release menor agrupada).** **UX-9** `#/cv`: el título de página se degrada a un chip-breadcrumb `.cv-breadcrumb` discreto y el subtítulo ruidoso pasa al `title` del `<h1>`, para que el CV del usuario (su nombre, en la vista previa) tenga la jerarquía visual. Invariante F-V54-A intacto — sigue siendo **exactamente un `<h1>`**, sigue `.page-title`. **UX-10** nuevo helper compartido `UI.providerCostHint(t)` junto a ⚡ Ejecutar en vivo en `#/auto`, `#/evaluate`, `#/deep` y cada `#/<mode>`; reusa `GET /api/status/providers` (v1.55.3): con clave muestra *"Coste estimado: OpenAI gpt-5-codex · ~$0.04/eval"* (orden de magnitud, "~"); sin clave indica que ⚡ copia un prompt manual sin coste de API; fail-soft. **UX-11** `#/help`: cuando el filtro del TOC reduce a **exactamente una** sección, la página se desplaza allí tras 300ms de inactividad (debounced; nunca con 0 o >1). **UX-12** `#/dashboard`: en el primer pintado el `<h1>` se hace enfocable (`tabindex="-1"`) y `#content` sigue `aria-live="polite"` (anunciado al arrancar) **sin** robar el foco (evita pelear con el skip-link, decisión v1.41.0). Nuevas claves i18n `cost.estimate`, `cost.manual` ×8; nuevo CSS `.cv-breadcrumb`/`.cost-hint`. **Tests:** 4 nuevas suites estático-de-fuente CI-aisladas (cv-breadcrumb 3, run-cost-line 4, help-toc-autoscroll 4, dashboard-initial-focus 3); locks pre-existentes `cv-single-h1`/`help-nav-a11y` actualizados (invariantes preservados). 800 → 813. Sonda Playwright en vivo de los 4, 0 errores de consola. `feat(ux)` · 4 test suites. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.8] — 2026-05-19

**feat(tracker): paginación del lado servidor + chips de embudo clicables (UX-8).** **Servidor:** `GET /api/tracker` gana params **opcionales** `?page` / `?pageSize` / `?status`. Sin ellos, la respuesta es byte a byte el `{ rows: [...] }` heredado (todos los llamadores/tests existentes intactos). Con ellos devuelve `{ rows: slice, total, page, pageSize, funnel }` — `pageSize` clampado a `[1,500]`, `page` a `≥1`, `status` filtra `rows`+`total`, y `funnel` es el desglose estado→conteo de **todo el historial** (independiente de página o filtro, para que los chips sean siempre exactos). **`#/tracker`:** nueva **barra de chips de embudo** clicable arriba — *"todos los estados · N · Applied · N · Interview · N …"* (orden Applied → Responded → Interview → Offer → Rejected → Discarded → Evaluated → SKIP). Clicar un chip fija el filtro de Estado (clicar el activo lo limpia); el chip activo es `aria-pressed` y resaltado. Nueva clave i18n `track.funnelAria` ×8; nuevo CSS `.tracker-funnel`/`.tracker-chip`/`.tracker-chip--active`. **`test: tests/tracker-server-paged.test.mjs`** (nuevo, 7 casos, CI-aislado, Express in-process en puerto efímero + applications.md temporal en `CAREER_OPS_ROOT` — CLAUDE.md #2/#8): back-compat (sin params ⇒ exactamente `{rows}`); `?page&pageSize` slice + total/page/pageSize/funnel sumando N; última página parcial sin solape; página fuera de rango ⇒ rows vacío + total válido; `?status=` filtra total/rows con funnel de todo el historial; cap de pageSize; + lock estático-de-fuente de la barra de chips. 793 → 800. `feat(tracker)` · `test: tests/tracker-server-paged.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.7] — 2026-05-19

**feat(pipeline): virtualización de filas en vanilla-JS para >1000 filas (UX-7).** `#/pipeline` renderizaba **todas** las filas (`filtered.forEach(list.appendChild(urlRow))`) — un escaneo llena la cola con miles de URLs, así que miles de nodos de fila (cada uno un div flex + `<a>` + dos botones) se construían sincrónicamente en cada tecla del filtro, saturando el DOM y el árbol de accesibilidad. Nueva **virtualización vanilla-JS** (equivalente a react-window, sin deps): por encima de `VIRTUALIZE_THRESHOLD = 1000`, `#/pipeline` pasa a ser un viewport con scroll de altura fija (`70vh`) con un espaciador no encogible (`flex:0 0 auto`, `height = filas × 56px`) que preserva la **barra de scroll real de toda la lista**, y un listener de scroll con rAF renderiza solo el viewport ± un búfer de 5 filas (~16–19 nodos a la vez en lugar de N). En/por debajo del umbral se mantiene el render simple original **byte a byte**, así que los pipelines típicos y todos los tests/e2e existentes no se ven afectados. Cada fila virtualizada conserva su `aria-label` ▶/✕ desambiguado por URL (F-V54-B bloqueado por regresión). El cálculo de ventana es un helper puro `computeWindow()`. **`test: tests/pipeline-virtualize.test.mjs`** (nuevo, 5 casos, CI-aislado, estático-de-fuente): umbral numérico ~1000; rama ≤umbral mantiene `forEach`→`appendChild`; rama >umbral renderiza `slice(start,end)` con listener de scroll rAF + espaciador; `computeWindow()` clampa `[0,total]` con ± búfer; filas conservan aria-labels ▶/✕. 788 → 793. Sonda Playwright en vivo (fixture de 1200 URLs): `scrollHeight≈67248`, solo ~16–19 nodos en el DOM, la ventana sigue el scroll de extremo a extremo, 0 errores de consola. `feat(pipeline)` · `test: tests/pipeline-virtualize.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.6] — 2026-05-19

**feat(scan): ocultar filtros secundarios tras un desplegable "Filtros avanzados" (UX-4).** `#/scan` apilaba todos los filtros — texto libre, remoto/híbrido/presencial, alcance, fuente y los chips de facetas stack/nivel/dinámicos posteriores al escaneo — con igual peso, un muro de controles. Ahora los **filtros cotidianos quedan visibles** (texto libre + Remoto/Híbrido/Presencial; el botón 🌐 Buscar ya está aparte en la tarjeta de controles) y los **secundarios colapsan tras un `<details class="scan-advanced"><summary>Filtros avanzados</summary>`**: los selects Alcance + Fuente, y —por separado— el grupo de chips de facetas (que ahora encabeza el resultado con la tabla, no con un muro de chips, y solo se renderiza si hay al menos una fila de chips). Nueva clave i18n `scan.advancedFilters` en los 8 locales; nuevo estilo `.scan-advanced` (afordancia ⚙ discreta, sin marcador, negrita al abrir). **`test: tests/scan-advanced-disclosure.test.mjs`** (nuevo, 6 casos, CI-aislado, estático-de-fuente): existe `<details>`/`<summary>` con hook `.scan-advanced` y etiqueta `scan.advancedFilters`; texto libre + remoto siguen visibles; alcance + fuente dentro del desplegable; `chipsContainer` es `<details>`; `.scan-advanced summary` con estilo; `scan.advancedFilters` ×8. 782 → 788. `feat(scan)` · `test: tests/scan-advanced-disclosure.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.5] — 2026-05-19

**feat(dashboard): hero con los 2 CTA P0 + pista focal de actividad reciente (UX-3).** `#/dashboard` abría con ~30 nodos de igual peso — sin un "qué sigue" claro. Un nuevo bloque `.dash-hero` ahora va justo bajo el encabezado: los dos recorridos P0 — **✨ Auto-pipeline para una URL** y **🌐 Buscar ahora** — se promueven a botones grandes `.btn-hero`, y una única **pista focal de actividad reciente** ("Última evaluación: `<score>` — `<título>`", enlazada al informe; estado vacío guía en arranque en frío vía `dash.heroNoEval`) indica al usuario recurrente dónde se quedó y al nuevo la única acción que importa. Los dos botones primarios se quitaron del encabezado (solo queda el secundario "📋 Abrir pipeline") para no duplicar la acción. Los contadores de estado se degradaron de `.badge` prominentes a píldoras `.dash-chip` discretas. Nuevas claves i18n `dash.lastEval`, `dash.heroNoEval` en los 8 locales; nuevo CSS `.dash-hero`/`.btn-hero`/`.dash-chip`. **`test: tests/dashboard-hero.test.mjs`** (nuevo, 5 casos, CI-aislado, estático-de-fuente): `.dash-hero` existe y precede la grilla Quick-actions; ambos CTA P0 son `.btn-hero` con rutas `/auto`+`/scan`; pista focal `dash.lastEval` + estado vacío `dash.heroNoEval`; buckets usan `.dash-chip`; CSS existe; `dash.lastEval`+`dash.heroNoEval` ×8. 777 → 782. `feat(dashboard)` · `test: tests/dashboard-hero.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.4] — 2026-05-19

**feat(ux): ETA honesta del auto-pipeline junto a Run + Stop prominente durante un escaneo (UX-6).** `#/auto`: nueva pista `.auto-eta` — *"⏱ ~1–2 min"* (clave `auto.eta`, `title` vía `auto.etaTitle`) — ahora junto al botón Run, para que la promesa de un clic sea honesta sobre la duración *antes* de comprometerse; el texto coincide con career-ops.org/docs ("pega una URL → informe completo en 1–2 minutos"). `#/scan`: mientras el rastreo de varios minutos está activo (`aria-busy`), **Stop** se promueve de botón fantasma de bajo contraste a botón destructivo prominente (nuevo `.btn-danger` — relleno, blanco sobre coral de alto contraste, peso 600). `setScanRunning(running)` alterna `scan-stop-btn` entre `btn-danger` (en ejecución) y `btn-ghost` (inactivo, oculto de todos modos), para que el usuario encuentre y confíe en Stop bajo carga. Nuevas claves i18n `auto.eta`, `auto.etaTitle` en los 8 locales; nuevo CSS `.btn-danger`/`.auto-eta`. **`test: tests/auto-eta-stop.test.mjs`** (nuevo, 4 casos, CI-aislado, estático-de-fuente): `#/auto` renderiza `t('auto.eta')` con clase `.auto-eta` junto a `runBtn`; `auto.eta` ×8; `setScanRunning(running)` promueve Stop a `btn-danger`; `.btn-danger` existe con texto blanco de alto contraste. 773 → 777. `feat(ux)` · `test: tests/auto-eta-stop.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.3] — 2026-05-19

**feat(onboarding): estado OR de 4 proveedores en pantalla — banner de arranque en frío + chip de proveedor activo (UX-2, ALTA).** Nuevo endpoint de solo lectura **`GET /api/status/providers`** → `{ activeProvider, activeModel, keysConfigured }`. `keysConfigured` usa la misma vista de env efectiva que los gate sites de `llm.mjs` (process.env ∨ `.env` del padre); `activeProvider` es lo que el OR-router elegiría — `selectActiveProvider()`, nuevo helper puro en `env-config.mjs` que recorre `providerOrder()` (un pin `LLM_PROVIDER` sin clave correspondiente da `null`). No se devuelven secretos — solo nombres de proveedor + el id de modelo. El shell de la SPA ahora renderiza una región de onboarding global (`#onboarding-banner`, poblada por `app.js`, solo DOM seguro para CSP): **0 claves → banner rojo** con CTA a `#/config?tab=api-keys`; **≥1 clave → chip discreto** con el proveedor + modelo activo. Hace descubrible en pantalla el diferenciador estrella ("uno de Anthropic / Gemini / OpenAI / Qwen, auto-ordenado") en vez de aprenderse por ensayo. Nuevas claves i18n `onboarding.*` en los 8 locales; nuevo CSS `.onboarding-warn`/`.onboarding-ok`. **`test: tests/onboarding-key-banner.test.mjs`** (nuevo, 9 casos, CI-aislado): semántica de `selectActiveProvider`; `GET /api/status/providers` en proceso (puerto efímero + `.env` en `CAREER_OPS_ROOT` temporal para nunca leer la clave real del padre — CLAUDE.md #2/#8); cableado SPA estático + cobertura `onboarding.*` ×8. 764 → 773. `feat(onboarding)` · `test: tests/onboarding-key-banner.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.2] — 2026-05-18

**fix(cv): dar al editor markdown de `#/cv` un nombre accesible descriptivo y autónomo (F-V55-H / UX-5).** El `<textarea id="cv-editor">` del editor principal de `#/cv` ahora lleva un `aria-label` descriptivo mediante la nueva clave `cv.editorAria` — *"Editor markdown del CV — tu currículum profesional en formato markdown"* — en lugar del nombre escueto que heredaba del encabezado visible "Markdown". Nota: al contrario que el síntoma de F-V55-H (que solo inspeccionó `aria-label`/`labels`), el campo **no** carecía de nombre — v1.47.0 (WS2 #16) ya lo había vinculado vía `aria-labelledby` → el `<h3 id="cv-md-heading">Markdown</h3>`, así que un lector de pantalla anunciaba "Markdown, edición, multilínea". v1.55.2 mejora ese escueto "Markdown" a una etiqueta autónoma. El `aria-labelledby` redundante se elimina (sería markup muerto — `aria-label` gana por precedencia ARIA); el `<h3>Markdown</h3>` visible permanece para usuarios videntes. WCAG 1.3.1 + 4.1.2; paralelo al arreglo batch-tsv de v1.54.5 (F-V54-C). **`test: tests/cv-editor-a11y.test.mjs`** (nuevo, 3 casos, CI-aislado, estático-de-fuente como `auto-stepper-prerender.test.mjs`): `#cv-editor` se nombra vía `t('cv.editorAria', …)` con fallback no vacío; `cv.editorAria` presente y no vacío en los 8 locales; sin `aria-labelledby` redundante en el elemento. 761 → 764. `fix(cv)` · `test: tests/cv-editor-a11y.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.1] — 2026-05-18

**fix(auto): prerenderizar el stepper de 5 etapas del pipeline al montar `#/auto` (F-V55-E / UX-1, obs. senior S-4 reabierta).** `#/auto` ahora muestra el esquema documentado de cinco etapas — **validar → obtener → evaluar → guardar informe → añadir al tracker** — en el instante en que la pantalla se monta, en lugar de quedar en blanco hasta el primer evento SSE. Antes `<ol class="auto-stepper">` se creaba `display:none` y `renderStepper()` solo se alcanzaba desde `setStep()` / `run()`, así que un usuario en arranque en frío nunca veía el pipeline que prometen los docs antes de pulsar Run. El stepper ahora es visible al montar con las cinco etapas en estado `pending` y lleva un `aria-label` (`auto.stepperAria`) para que la tecnología asistiva anuncie la región. Cierra F-V55-E (lente a11y/garantía estática) y UX-1 (lente fidelidad de promesa) — misma corrección, ambas lentes. **`test: tests/auto-stepper-prerender.test.mjs`** (nuevo, 4 casos, CI-aislado, estático-de-fuente como `router.test.mjs`): el array `STEPS` son exactamente las 5 etapas canónicas en orden; `stepperEl` no es `display:none` al montar y lleva `auto.stepperAria`; una llamada `renderStepper()` de ámbito de montaje precede a `function setStep(`; `auto.stepperAria` presente en los 8 locales. 757 → 761. `fix(auto)` · `test: tests/auto-stepper-prerender.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.0] — 2026-05-18

**feat(llm): la live-eval headless funciona vía "OR" — Anthropic | Gemini | OpenAI | Qwen, autoseleccionado según qué clave esté definida.** A petición del usuario, la ⚡ live-eval del web-ui ahora funciona con **cualquier clave de API que esté definida**, no solo Anthropic/Gemini. `LLM_PROVIDER` gana `openai` y `qwen`; `auto` (por defecto) usa el primer proveedor cuya clave esté presente, prefiriendo **Anthropic → Gemini → OpenAI → Qwen**. Un valor explícito fija uno; un proveedor forzado sin clave aún cae al camino del prompt manual. Nuevo `server/lib/openai.mjs` — un cliente Chat Completions compatible con OpenAI y sin dependencias (mismo patrón HTTPS directo seguro que `anthropic.mjs`: timeout `AbortController`, clave nunca registrada, resolución de clave `effectiveEnv()` para que una clave del `.env` del padre funcione sin reinicio). Un núcleo (`runOpenAICompatible`) respalda **`runOpenAI`** (api.openai.com) y **`runQwen`** (modo compatible con OpenAI de Alibaba DashScope; sobrescribe el endpoint con `QWEN_BASE_URL` en el `.env` crudo para el host de China continental). Sin SDKs, **sin ejecución arbitraria de CLI** — el proyecto padre sigue siendo agnóstico de CLI (Claude Code · Codex · Gemini · OpenCode · Qwen · Copilot · Kimi); esto solo extiende el camino *headless* por clave de API. La cola OpenAI/Qwen está cableada en todas las superficies de eval: `/api/evaluate`, `/api/deep`, `/api/mode/:slug` y el SSE de `/api/auto-pipeline` — consultada tras las ramas Anthropic (inline) + Gemini (subproceso) para preservar la preferencia auto, con el mismo inlining de contexto empaquetado que usa Anthropic. `env-config.mjs`: `QWEN_API_KEY` (secreto) + `QWEN_MODEL` (no secreto) añadidos a `KNOWN_KEYS`/`KEY_GROUPS.core`; `LLM_PROVIDERS` y `providerOrder()` extendidos; `OPENAI_API_KEY` es ahora una clave de proveedor headless de primera clase (antes solo almacenada). Pestaña de claves de `#/config`: el select `LLM_PROVIDER` gana `openai`/`qwen`; nuevos campos `QWEN_API_KEY` + `QWEN_MODEL` (lista curada `qwen-max`/`qwen-plus`/`qwen-turbo`/`qwen2.5-*`); una nueva nota al inicio de la pestaña explica el padre agnóstico de CLI vs la eval headless del web-ui y el orden OR. Nuevas claves i18n en los 8 locales. **`test: tests/openai.test.mjs`** (nuevo, 9 casos, CI-aislado): éxito OpenAI/Qwen + contenido en array de bloques, auth Bearer, endpoints por defecto y sobrescrito por `QWEN_BASE_URL`, 4xx/5xx/malformado, clamp de `max_tokens`, timeout, detección de clave `effectiveEnv`, canario de no-fuga de clave. `tests/provider-selector.test.mjs` actualizado para la superficie `providerOrder`/`LLM_PROVIDERS`/SECRET de v1.55.0 + el cableado de la cola OpenAI/Qwen. 748 → 757. `feat(llm)` · `test: tests/openai.test.mjs` · `test: tests/provider-selector.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.10] — 2026-05-18

**fix(auto-pipeline): higiene de desconexión del cliente SSE — eliminar el job e2e de Playwright inestable.** El job e2e de Playwright se ponía en rojo de forma intermitente (32/32 pruebas individuales pasan, pero `not ok 2 - tests/playwright-smoke.mjs`): cerrar una página mientras el stream SSE de `#/auto` estaba en curso hacía que el siguiente `res.write()` del servidor fuera rechazado con `EPIPE`/`"aborted"`, y —sin un listener `'error'` en la respuesta— Node lo escalaba a una uncaughtException que node:test reportaba como "asynchronous activity after the test ended". `openSse()` en `auto-pipeline.mjs` ahora registra un `res.on('error')` no-op y protege `send()` con `res.writableEnded || res.destroyed` (envuelto en try/catch) — un cliente desaparecido es esperado, no excepcional. Esto es higiene SSE de producción correcta, no solo un arreglo de prueba. `tests/playwright-smoke.mjs`: la prueba de Cmd+K usaba una URL saliente real (`https://example.com/jobs/123`) pero solo esperaba a que apareciera el modal, así que `closePage()` abortaba el `safeGet()` en curso del servidor después de terminar la prueba. Ahora espera a que el pipeline alcance un estado terminal (para que el fetch se resuelva normalmente antes del cierre). Un helper compartido `closePage()` (`window.stop()` y luego cerrar) y el hook `after` con `server.closeAllConnections()` permanecen como defensa en profundidad. Verificado: 8/8 ejecuciones verdes consecutivas (6× `node --test` + 2× browser-smoke), antes ~1-de-2 en rojo. `tests/auto-pipeline.test.mjs` +1 caso estático que fija el contrato de higiene de desconexión de `openSse` (listener `res.on('error')` + guarda `writableEnded||destroyed` + escrituras envueltas en try). 747 → 748. `fix(auto-pipeline)` · `test: tests/auto-pipeline.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.9] — 2026-05-18

**fix(llm): honrar las claves LLM del `.env` del proyecto padre en tiempo de petición — dejar de enrutar erróneamente a un proveedor obsoleto/inválido.** La evaluación en vivo podía fallar con *"Gemini API error: API key not valid"* incluso cuando `ANTHROPIC_API_KEY` era el proveedor configurado. Causa raíz: `hasAnthropicKey()` / `hasGeminiKey()` (y la búsqueda de clave/modelo de `runAnthropic`) leían **solo el snapshot de `process.env` del arranque**. Si la clave Anthropic se añadía al `.env` del padre después de arrancar el servidor, el proceso en ejecución nunca la veía → la detección de Anthropic era falsa, y la evaluación caía a cualquier clave obsoleta que *sí* estuviera en `process.env` (a menudo un `GEMINI_API_KEY` antiguo e inválido). La ruta de ejecución de Gemini (un subproceso Node del padre) ya leía el `.env` vivo del padre, así que ambos proveedores resolvían claves de forma inconsistente. Nuevo `effectiveEnv(key, envFilePath)` en `env-config.mjs`: un valor no vacío de `process.env` gana (cubre exports de shell y el live-apply en `POST /api/config`); en otro caso se consulta el **`.env` actual del padre**. `anthropic.mjs` ahora resuelve `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` y la verificación de la clave Gemini a través de él, de modo que una clave puesta en el `.env` del padre se honra **sin reiniciar el servidor** y la DETECCIÓN de clave siempre coincide con la clave que la petición realmente ENVÍA. El orden de proveedores no cambia (`auto` → Anthropic-luego-Gemini); esto solo arregla la detección. Las claves nunca se registran ni se devuelven (la prueba de no-fuga REVIEW-B4 sigue pasando). `tests/anthropic.test.mjs` reescrito para ser CI-aislado (temp `CAREER_OPS_ROOT`, import dinámico) con 2 casos nuevos que reproducen el bug exacto (clave solo en el `.env` del padre → detectada; `runAnthropic` envía la clave + modelo del `.env` del padre cuando `process.env` está sin definir). `tests/env-config.test.mjs` +3 casos `effectiveEnv` (precedencia de `process.env`, fallback al `.env` incl. cadena-vacía-como-no-definida, archivo-ausente / clave-ausente / sin-ruta → undefined) — 100% de la rama nueva. 742 → 747. `fix(llm)` · `test: tests/anthropic.test.mjs` · `test: tests/env-config.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.8] — 2026-05-18

**feat(config): el formulario por campos de Modes siempre renderiza el esquema canónico (incluso en un archivo vacío/stub) con la guía de campos de career-ops.org.** El formulario por campos de Modes de v1.54.3 solo renderizaba campos para secciones `##` ya existentes — así que en un `modes/_profile.md` recién creado, vacío o no conforme al esquema (p. ej. el stub habitual de 1 línea) caía en *"No ## sections found — use the raw editor below."* y el usuario no obtenía campos. A petición del usuario (*"разбей по полям … описание полей возьми из career-ops.org/docs"*), el formulario ahora **siempre renderiza los 5 campos canónicos en el orden documentado** (Target Roles, Adaptive Framing, Exit Narrative, Comp Targets, Location Policy), prerrellenados desde el archivo cuando existen y vacíos-pero-editables cuando no — de modo que un perfil totalmente nuevo puede rellenarse íntegramente a través del formulario. Cada campo muestra una **descripción tomada del §Step-5 del Quick Start canónico de career-ops.org** (qué poner en Target Roles / Adaptive Framing / Exit Narrative / Comp Targets / Location Policy), cableada vía `aria-describedby` para lectores de pantalla. Tolerante a variantes de encabezado: el `## Your Target Roles` (etc.) de la plantilla mapea al mismo campo canónico que `## Target Roles`, de modo que ni la plantilla ni la convención del andamiaje del servidor rompen el formulario. `collect()` es ahora una carga etiquetada: una **fusión `{ sections }`** no destructiva cuando los encabezados renderizados coinciden exactamente con los del archivo (preámbulo + secciones intactas + personalizadas sobreviven byte-estables), o una **reconstrucción de archivo completo `{ markdown }`** que arranca/normaliza un documento conforme al esquema cuando el archivo carecía de él. La ruta de reconstrucción está **protegida por confirmación** en `config.js` (reemplaza el archivo padre — invariante de guardado destructivo WS2 #4), preserva el preámbulo existente (o un valor por defecto documentado) y mantiene las secciones no canónicas verbatim. 6 nuevas claves i18n (`config.modesDescTargetRoles` … `config.modesDescLocationPolicy` + `config.modesFormRebuildBody`) en los 8 locales. `tests/modes-form.test.mjs` reescrito para el contrato v1.54.8: esquema + orden canónico, cableado de carga/confirmación de `config.js`, presencia de la descripción de cada campo proveniente de la documentación en los 8 locales, tolerancia `canonicalKey` "Your X", estabilidad del round-trip de listas, la garantía de bootstrap-siempre-renderiza, y el `collect()` etiquetado secciones-vs-markdown con seguridad de datos. Verificado en vivo contra el archivo stub real del padre (5 campos + descripciones aparecen, 0 errores de consola) y un fixture stub aislado (rellenar → guardado protegido por confirmación → las 5 secciones canónicas persistidas). `feat(config)` · `test: tests/modes-form.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.7] — 2026-05-18

**fix: W-001 — los assets de código/estilo + el shell de la SPA se servían con `Cache-Control: no-store` (higiene de despliegue).** La SPA carga `api.js` / `router.js` / cada vista mediante `<script src>` plano sin query string de versión, y no hay paso de build (sin content hashing), por lo que tras un despliegue un navegador podía seguir sirviendo un **bundle viejo cacheado durante horas** → 404 de caché obsoleta en rutas con query string (observado en vivo durante la regresión v1.29.2; corrida de regresión W-001). `server/index.mjs` ahora fija `Cache-Control: no-store` en `.js` / `.mjs` / `.css` / `.html` vía el hook `setHeaders` de `express.static`, y explícitamente en el catch-all del shell de la SPA (que usa `sendFile` y evita `setHeaders`), de modo que el navegador siempre revalida el código que dirige el enrutado. Los assets estáticos no-código mantienen el caching por defecto de `express.static`. Las cabeceras de seguridad (CSP / nosniff / frame-deny / referrer-policy) no cambian — verificado por la suite `security-headers` existente (8 casos) corriendo en verde junto a la nueva prueba. +1 archivo de pruebas `tests/asset-cache-control.test.mjs` — 4 casos (assets JS `no-store`, CSS `no-store`, `index.html` estático `no-store`, shell de ruta profunda del catch-all de la SPA `no-store`), arrancando la app real contra un `CAREER_OPS_ROOT` aislado. Más un arreglo de teardown flaky en `tests/playwright-smoke.mjs` (commit `test(e2e)` aparte): la prueba de humo SSE del auto-pipeline ahora cancela el reader + aborta el fetch en un `finally` y el hook `after` cierra a la fuerza los sockets persistentes, eliminando el "Error: aborted" post-teardown que enrojecía el job Playwright e2e de v1.54.6. 738 → 742. `fix` · `test: tests/asset-cache-control.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.6] — 2026-05-18

**fix(a11y): S-7 — el botón back-to-top de `#/help` lleva la clase selectora canónica `back-to-top`.** El botón flotante back-to-top de `#/help` funcionaba correctamente (verificado en vivo) pero su lista de clases (`btn btn-primary help-back-top`) quedaba fuera de la convención del selector `.back-to-top` que apunta la prueba de spec §2 #28 — un selector más estricto habría flaqueado (corrida de regresión S-7, "victoria fácil"). El botón ahora lleva también la clase canónica `back-to-top`. Puramente aditivo y un no-op de CSS: `help-back-top` (el hook CSS existente) no cambia y `back-to-top` no tiene regla CSS — es solo un asa estable de prueba/automatización. Verificado en vivo: `document.querySelector('.back-to-top')` resuelve el botón, `aria-label` intacto, 0 errores de consola. Se extendió el caso #12 existente en `tests/help-nav-a11y.test.mjs` con una aserción de que la lista de clases del botón back-to-top incluye el selector canónico `back-to-top` (sin archivo nuevo). `fix(a11y)` · `test: tests/help-nav-a11y.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.5] — 2026-05-18

**fix(a11y): F-V54-C — el editor TSV de `#/batch` tiene un nombre accesible.** El `<textarea>` TSV de `#/batch` tenía una pista cableada vía `aria-describedby` pero **ningún nombre accesible** — sin `<label htmlFor>`, sin `aria-label`/`aria-labelledby` (corrida de regresión F-V54-C; WCAG 1.3.1 Info & Relationships / 4.1.2 Name, Role, Value). `aria-describedby` aporta una *descripción*, no un *nombre*, así que un lector de pantalla anunciaba un "edit text" sin etiqueta. El textarea ahora lleva un `aria-label` vía la nueva clave i18n `batch.tsvAria`, consistente con las entradas hermanas de control de corrida que ya usan claves `*Aria`; la pista describedby existente se conserva. Verificado en vivo: `aria-label` presente + localizado, `aria-describedby` intacto, 0 errores de consola. Nueva clave i18n `batch.tsvAria` en los 8 locales. +1 archivo de pruebas `tests/batch-tsv-accessible-name.test.mjs` (2 casos: el bloque `batch-tsv` tiene un `aria-label` vía `t(batch.tsvAria)` manteniendo su pista describedby; `batch.tsvAria` definida en los 8 locales); 736 → 738. `fix(a11y)` · `test: tests/batch-tsv-accessible-name.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.4] — 2026-05-18

**fix(a11y): F-V54-B — los botones de acción por fila de `#/pipeline` tienen nombres accesibles.** Los botones `▶` (evaluar) y `✕` (eliminar) por fila en `#/pipeline` eran solo iconos con únicamente un atributo `title` (corrida de regresión F-V54-B; WCAG 4.1.2 Name, Role, Value). `title` no es un nombre accesible fiable, así que un usuario de lector de pantalla oía una larga sucesión de "button" indistintos y no podía saber a qué fila afectaría un borrado. Ambos botones llevan ahora un `aria-label` explícito desambiguado por una URL compacta vía un nuevo helper `shortUrl()` (`host` + `…/` + los 2 últimos segmentos de ruta; fallback de recorte final para entradas no parseables), de modo que el árbol de a11y lee p. ej. *"Delete: hh.ru/…/vacancy/12345"*. Sin nuevas claves i18n — reutiliza `common.delete` / `pipe.evaluateBtn` + la URL. Verificado en vivo: 1385 filas, cada nombre de botón único por fila, 0 errores de consola. +1 archivo de pruebas `tests/pipeline-row-action-names.test.mjs` (4 casos: ambos botones cableados con `shortUrl(url)` + exactamente dos de esas etiquetas, `shortUrl` declarado antes de su uso, URLs de mismo host pero distinto empleo no colapsan, fallbacks de host pelado / no parseable / vacío); 732 → 736. `fix(a11y)` · `test: tests/pipeline-row-action-names.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.3] — 2026-05-18

**feat(config): formulario de campos estructurado para la pestaña "Modes" de `#/config` (sin más markdown crudo).** La pestaña "Modes" editaba `modes/_profile.md` como un único `<textarea>` crudo por sección `##` (granularidad a nivel de sección de v1.36.0). A petición del usuario, ahora renderiza un **formulario de campos estructurado derivado del esquema documentado** (career-ops.org Quick Start §Step-5): `Target Roles` / `Adaptive Framing` / `Comp Targets` → **entradas de línea etiquetadas repetibles para añadir/quitar** (una línea de rol/ángulo/comp por campo, `＋ Add line` / `✕` por fila con `aria-label`); `Exit Narrative` / `Location Policy` → un único `<textarea>` de prosa etiquetado. Cada campo es un control real vinculado con `<label htmlFor>` y un nombre de sección i18n. El nuevo `public/js/lib/modes-form.js` (`window.ModesForm`) posee la lógica parse → render → `collect()`; alimenta la ruta de merge **existente** `PUT /api/modes/_profile { sections }`, de modo que el preámbulo, el orden y cualquier sección que el formulario no toque sobreviven byte-estables (merge-no-reemplazo, aplicado por el servidor). **Seguridad de datos:** una sección de lista canónica cuyo cuerpo no sea una lista de viñetas pura (el usuario puso prosa ahí) y cualquier sección `##` no canónica recurren a un `<textarea>` literal etiquetado con una nota explicativa — el contenido arbitrario hace round-trip intacto, nunca se reescribe ni se pierde silenciosamente. Estabilidad de round-trip probada: `serialise(parse(body))` re-parsea idénticamente. El editor de markdown crudo de archivo completo permanece como la divulgación **Advanced** con confirmación para añadir/quitar sección y editar el preámbulo (puerta de guardado destructivo de WS2 #4 sin cambios). 10 nuevas claves i18n (`config.modesTargetRoles` … `config.modesUnknownNote`) en los 8 locales. +1 archivo de pruebas `tests/modes-form.test.mjs` (7 casos); 725 → 732. Verificado en vivo contra una fixture aislada `CAREER_OPS_ROOT`: 5 secciones canónicas renderizadas como campos + 1 sección personalizada como fallback etiquetado, round-trip de editar-y-guardar preservó el preámbulo + la sección personalizada, 0 errores de consola. `feat(config)` · `test: tests/modes-form.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.2] — 2026-05-18

**feat(config): selector de modelo OpenAI / Codex en `#/config`.** `#/config` no tenía forma de elegir el modelo OpenAI / Codex — solo `ANTHROPIC_MODEL` y `GEMINI_MODEL` tenían desplegables, aunque `OPENAI_API_KEY` ya estaba expuesta para el flujo multi-CLI del proyecto padre (Codex / OpenCode). Ahora `OPENAI_MODEL` es una clave de entorno de primera clase: añadida a `KNOWN_KEYS` de `env-config.mjs` (ordenada justo después de `OPENAI_API_KEY`) y al grupo de claves `core`, y **deliberadamente no** en `SECRET_KEYS` — es un id de modelo, no una credencial, así que nunca se enmascara. `config.js` gana una lista curada `OPENAI_MODELS` (`gpt-5-codex` por defecto, luego `gpt-5` / `gpt-5-mini` / `gpt-4.1` / `o4-mini` / `o3`) y un campo `<select>` `OPENAI_MODEL` renderizado justo después de la clave OpenAI, reflejando exactamente los campos de modelo Anthropic/Gemini. Nuevas claves i18n `config.openaiModel` + `config.openaiModelHint` en los 8 locales. +1 archivo de pruebas `tests/openai-model-selector.test.mjs` (4 casos); 721 → 725. Verificado en vivo: `#/config` → select `OPENAI_MODEL` con 6 opciones, por defecto `gpt-5-codex`, vinculado a etiqueta, 0 errores de consola. `feat(config)` · `test: tests/openai-model-selector.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.1] — 2026-05-18

**fix(a11y): F-V54-A — un único `<h1>` en `#/cv`.** El propio `# Name` del markdown del CV se renderizaba como un **segundo** `<h1>` de nivel superior junto al `<h1>CV</h1>` del título de página (corrida de regresión F-V54-A; WCAG 1.3.1 Información y relaciones / 2.4.6 Encabezados). Ahora `cv.js` canaliza cada punto de inyección de la vista previa del CV (render inicial, refresco al importar archivo, sincronización en vivo del editor) a través de un `cvMd()` con alcance acotado que baja los encabezados un nivel (h1→h2 … h6→`role="heading" aria-level="7"`), de modo que la página conserva exactamente un `<h1>`. Acotado a `cv.js` a propósito — `UI.md` lo comparten help/reports/deep/evaluate, que gestionan sus encabezados a su manera. +1 archivo de pruebas `tests/cv-single-h1.test.mjs` (4 casos); 717 → 721. Verificado en vivo: `#/cv` → 1 `<h1>`, el `# Name` del usuario ahora es `<h2>`, 0 errores de consola. `fix(a11y): F-V54-A` · `test: tests/cv-single-h1.test.mjs`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.0] — 2026-05-18

**WS10 — re-validación de docs canónicos + paridad H3 del paquete de ayuda (la versión final de convergencia).** El gate de CI de CHANGELOG/estructura solo comprobaba H2, así que `docs/help/en.md` había derivado en silencio hasta 70 subsecciones H3 mientras los 7 paquetes localizados se quedaban en 68 — la brecha era §17 (la tabla «Reference adapters» + la lista «Common pitfalls», solo en inglés). Ambas están ahora traducidas a los 7 idiomas (nombres de archivo / enlaces / identificadores de adaptadores mantenidos byte a byte idénticos); los 8 paquetes ahora suman 17 H2 / 70 H3. Un nuevo gate de paridad H3 en `help-ru-config-section.test.mjs` lo fija (716 → 717). `canonical-docs-coverage.test.mjs` 7/7 confirma que la ayuda sigue reflejando las 5 guías de `career-ops.org/docs`; la auditoría UX de WS2 (40 hallazgos v1.41→v1.52) validó cada pantalla frente a los docs — sin divergencia. `docs/sdd/CONVENTIONS.md` actualizado a v1.54.0 (totales de pruebas, gate de paridad H3, archivos atípicos por tamaño, nueva sección de convenciones de Accesibilidad). WS0–WS10 completos; solo queda WS11. `fix(docs): WS10 canonical re-validation + H3 parity` · `test(help): H3-parity gate`. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.53.0] — 2026-05-18

**WS9 — pirámide de pruebas de la superficie shell (la última capa sin probar).** Los 4 scripts `bin/*.sh` y el hook `.githooks/pre-commit` tenían cobertura **cero**; el nuevo `tests/sh-files.test.mjs` añade 10 casos que fijan la sintaxis `bash -n`/`sh -n`, el shebang + bit ejecutable y los contratos de comportamiento de los que dependen otros workstreams: `career-ops-ui.sh` — `help` sale con 0 sin fuga de shell-source (guarda de regresión v1.40.0), un verbo desconocido sale con 2, y `usage()` es un heredoc; `start.sh` — respeta `NO_OPEN`, exige Node ≥ 18 y delega el levantamiento del navegador a `scripts/open-dashboard.mjs` (guarda v1.43.0); `setup.sh` — modo estricto, `SKIP_START`, clona ambos repos; `run_all.sh` — parseo de `--quick`/`--no-e2e` y las 4 suites; `.githooks/pre-commit` ejecuta el revisor de WS7 y **ningún archivo shell invoca `git --no-verify`** (guarda de la regla dura #7 de CLAUDE.md); `install-hooks.mjs` cablea `core.hooksPath`. `docs/architecture/TESTING.md` — se añadió la capa base de superficie shell al diagrama de la pirámide + una nota de totales v1.53.0 (716 casos `node --test` / 90 archivos + 4 superficies E2E). 706 → 716. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.52.0] — 2026-05-18

**WS2 LOWs #33–#40 — barrido de pulido por lotes (cierra la cola de la auditoría de UX).** Ocho hallazgos de baja severidad. `fix(a11y/i18n): WS2 LOW batch` — #33: `#/dashboard` — los 3 CTA de cabecera eran inconsistentes (solo 2 tenían icono inicial); «Open Pipeline» ahora lleva `📋` y los tres coinciden. #34: `#/profile` — los `fit`/`level` del arquetipo se mostraban como dos chips ambiguos; ahora van prefijados (`Fit:` / `Level:`) con `aria-label` a juego. #35: `#/health` — los toasts de Run-doctor / verify mostraban cadenas crudas de `doctor.mjs`; ahora con clave i18n. #36: `#/health` — los resultados de las comprobaciones eran `<div>`s planos; ahora son un `role=list` `<ul>`/`<li>` y el badge de estado lleva `aria-label="<check>: <status>"`. #37: `#/reports` — las tarjetas eran `<div onClick>` solo de ratón; ahora `role=link` + `tabindex` + manejador Enter/Espacio + `aria-label`. #38: `#/activity` — el comentario del paginador decía «200» mientras el código pedía 500; reconciliado a una constante `CAP` y un aviso `role=note` aflora cuando el límite de 500 trunca el historial antiguo. #39: `#/batch` — los placeholders en prosa estaban codificados en inglés mientras sus `aria-label`s estaban localizados; los cuatro ahora con clave i18n. #40: las páginas de modo relabelaban el botón primario en silencio tras la sonda asíncrona; ahora una región `role=status` cortés lo anuncia. 10 nuevas claves i18n × 8 idiomas (`{n}` preservado); +9 tests: `test: tests/low-sweep.test.mjs`. 697 → 706. Cierra la cola de la auditoría de UX de WS2 (#1–#40 de v1.41→v1.52); siguiente WS9 → WS10 → WS11. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.51.0] — 2026-05-18

**WS2 #13 + #14 + #18 + #19 + #20 — barrido de feedback/i18n en `#/auto` y `#/evaluate`.** Cinco hallazgos de la auditoría de UX. `fix(a11y/ux): auto+evaluate — busy state, actionable HTTP errors, clipboard fallback, aria-live result, spinner-guarded submit` — #13: el botón Run de `#/auto` ahora muestra un estado ocupado (`is-loading` + `aria-busy` + «Running…») en lugar de solo deshabilitarse. #14: una petición HTTP fallida ahora aflora un mensaje i18n accionable sobre el paso Y un toast (`auto.httpFail` con `{n}`), en vez de un escueto «HTTP 500». #18: el «Copy prompt» del modo manual ahora usa la Clipboard API asíncrona con respaldo `execCommand`, y emite un toast de fallo real en lugar de un falso «Copied». #19: el contenedor del resultado de evaluate es ahora `role=status` `aria-live=polite`, de modo que la larga llamada al LLM se anuncia a los lectores de pantalla. #20: el botón Evaluate va envuelto en `UI.withSpinner` (era un `onClick: run` plano que permitía envíos duplicados). 3 nuevas claves i18n × 8 idiomas; +6 tests: 691 → 697. También una corrección solo de pruebas (commit `7f8e250`): el teardown de e2e pipeline-delete estaba en la ruta del confirm nativo previo a v1.48; pasado a DELETE por API (`fix(test): …` — el Playwright-e2e de CI estaba en rojo; no es una regresión del producto). Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.50.0] — 2026-05-18

**WS2 #12 + #27 + #28 — accesibilidad de la navegación de la ayuda.** Tres hallazgos de la auditoría de UX en `#/help` sobre una guía de 17 secciones y 90+ encabezados, corregidos en `help.js`. `fix(a11y): help — single h1, labelled+filterable TOC, focus-on-anchor, back-to-top` — #28: el markdown del documento abría con su propio `# Title`, produciendo un SEGUNDO `<h1>` en una página cuyo encabezado ya aporta el h1 canónico; ahora se elimina todo `<h1>` del artículo, de modo que hay exactamente un h1 y la jerarquía arranca limpiamente en las secciones `<h2>`. #27: el `<nav>` del TOC era un punto de referencia sin nombre (dos `<nav>` sin etiqueta en la página); ahora tiene `aria-label` (`help.toc`), y al pulsar una entrada del TOC el foco se mueve al encabezado de la sección (`tabindex=-1` + `focus()`), no solo el desplazamiento del viewport. #12: no había forma de encontrar nada en un documento largo; un filtro `type=search` sobre el TOC reduce las entradas por texto de encabezado en vivo, y un botón flotante con `aria-label` «Back to top» aparece tras desplazarse, vuelve al inicio y devuelve el foco al `<h1>` de la página; su listener de scroll se elimina en `hashchange` al salir de `#/help`. 2 nuevas claves i18n × 8 idiomas — `help.tocFilter`, `help.backToTop`; +6 tests: `test: tests/help-nav-a11y.test.mjs`. 685 → 691. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.49.0] — 2026-05-18

**WS2 #10 + #11 + #25 + #26 — accesibilidad y ordenación de la tabla del tracker.** Cuatro hallazgos de la auditoría de UX en `#/tracker`, corregidos en `tracker.js`. `fix(a11y): tracker headers, sortable table, localized fix labels, empty state` — #10: el encabezado de la columna de acción era una cadena vacía y el botón Report por fila no tenía contexto; ahora cada `<th>` lleva `scope=col`, el encabezado de acción y los de `Score`/`PDF` están con clave i18n (estaban vacíos o en inglés codificado), y el botón Report gana un `aria-label` con la empresa (`<report> — <company>`). #11: un tracker sin forma de ordenar; los encabezados Date / Score / Status son ahora botones de ordenación operables por teclado dentro del `<th>` con `aria-sort` (`none`/`ascending`/`descending`); un comparador `sorted()` (numérico para score, comparación de locale para date/status) corre antes de la paginación, y el clic alterna la dirección y reinicia el paginador. #25: `track.normalize/dedup/merge` eran inglés idéntico en los 8 idiomas pese a ser los controles destructivos de mayor riesgo (reescriben `data/applications.md`) — ahora correctamente localizados, más un `title` de ayuda. #26: la primera ejecución con cero filas mostraba el mismo mensaje «no match» que una lista sobrefiltrada; `rows.length === 0` ahora muestra un estado vacío distinto (título + cuerpo + CTA «Open pipeline»). 7 nuevas claves i18n × 8 idiomas + 3 relocalizadas; +6 tests: `test: tests/tracker-a11y-sort.test.mjs`. 677 → 683. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.48.0] — 2026-05-18

**WS2 #8 + #22 — pipeline: confirmación con foco atrapado + accesibilidad de la vista previa.** Dos hallazgos de la auditoría de UX en `#/pipeline`, corregidos en `pipeline.js`. `fix(a11y): pipeline UI.confirm() + live preview region` — #8: las tres acciones de `#/pipeline` usaban `confirm()` nativo (no atrapaba el foco): el Delete del panel de vista previa, el `✕` de cada fila y "Evaluate first"; ahora todas pasan por el `UI.confirm()` con foco atrapado (infra v1.44.0) — los dos borrados `danger:true` (Cancelar por defecto), "Evaluate first" `danger:false`; ya no queda ningún `confirm()` nativo en `pipeline.js`. #22: `previewPane` no tenía rol en vivo y un fallo de fetch se metía en `previewBody`, renderizado como una `<pre>` "preview" engañosa; ahora es `role=region` `aria-live=polite` con un `aria-label`, y los fallos fijan un `previewError` aparte renderizado como un bloque `role=alert` distinto (se limpia al (re)seleccionar o al borrar la fila activa). 4 nuevas claves i18n × 8 idiomas; +5 tests: `test: tests/pipeline-confirm-preview.test.mjs`. 672 → 677. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.47.0] — 2026-05-18

**WS2 #7 + #30 + #31 + #16 — barrido de accesibilidad de etiquetas sin vincular.** Cuatro hallazgos de la auditoría de UX donde controles de formulario no tenían etiqueta programática (WCAG 1.3.1 / 3.3.2 / 4.1.2), ahora vinculados. `fix(a11y): bind every swept form control to an accessible name` — #7 `scan.js`: el checkbox `dry-run` y el desplegable `company-select` tenían etiquetas sin `for`; se añadió `htmlFor` (con los `id` existentes). #30 `deep.js`: los inputs `company` / `role` tenían etiquetas sin vincular; se añadió `id` + `htmlFor` (`deep-company`, `deep-role`). #31 `apply.js`: `url` / `jd` tenían etiquetas sin vincular; se añadió `id` + `htmlFor` (`apply-url`, `apply-jd`). #16 `cv.js`: el `<textarea>` principal de markdown no tenía nombre accesible; se vinculó mediante `aria-labelledby` al encabezado visible "Markdown" — nombre para lectores de pantalla idéntico al título en pantalla, sin nueva clave i18n. Usa el patrón explícito `label[for]`↔`control[id]` ya estándar en `batch.js` / `mode-page.js`; sin nuevas claves i18n; cero cambio de comportamiento. +5 tests: `test:` 667 → 672. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.46.0] — 2026-05-18

**WS2 #5 + #6 + #21 + #24 — accesibilidad del SSE de scan.** Cuatro hallazgos de la auditoría de UX en `#/scan`, corregidos en `scan.js`. `fix(a11y): scan SSE — live-log region, Stop, run-state, error banner` — #5: la consola de streaming ahora es `role=log` `aria-live=polite` (+ `aria-label`, `tabindex=0`, desplazable con teclado), con una región oculta visualmente aparte `role=status` asertiva que anuncia los eventos terminales (completado / fallido / detenido). #6: un botón Stop cierra el `EventSource` en vuelo (`es.close()`), cancela el sondeo de resultados y restablece el estado; solo se muestra mientras un scan corre. #21: el botón Scan se desactiva + recibe `aria-busy` mientras corre y Stop aparece, en ambas rutas de stream (`streamTo` de una fase y `runScanAll` multifase — esta última solo finaliza la ejecución en el `done` terminal, `final !== false`). #24: un fallo del SSE ya no es solo un toast de 3,5 s; ahora un banner persistente `role=alert` muestra el error con una acción de reintento (reinvoca la última función de ejecución), limpiado en la siguiente ejecución. 8 nuevas claves i18n × 8 idiomas; +7 tests: `test: tests/scan-sse-a11y.test.mjs`. 660 → 667. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.45.0] — 2026-05-18

**WS2 #3 — pestañas de #/config: patrón WAI-ARIA Tabs completo.** Las tres pestañas de #/config (API keys / Profile / Modes) eran `<button class="tab-btn">` simples con activación solo por clic: sin `role`, sin `aria-selected`, sin modelo de teclado (UX-audit HIGH #3, WCAG 4.1.2 / 2.1.1). `fix(a11y): config.js tabs implement role=tablist/tab/tabpanel` — ahora un contenedor `role=tablist` con `aria-label`; cada pestaña `role=tab` + `id` + `aria-controls` + `aria-selected` (sincronizado en `activate()`) + `tabindex` itinerante (0 activa / -1 resto); el panel `role=tabpanel` + `tabindex=0` + `aria-labelledby` siguiendo a la pestaña activa. Navegación de teclado completa: ←/→/↑/↓ (con envolvente) + Home/End mueven el foco Y activan. El gancho CSS heredado `.tab-btn.is-active` se conserva. +1 clave i18n × 8 idiomas (`config.tablistLabel`); +7 tests: `test: tests/config-tabs-aria.test.mjs`. Además, una corrección solo de pruebas: `fix(test): retarget 2 stale auto-pipeline smoke tests` — dos smoke tests de Playwright-e2e anteriores a v1.34 afirmaban un modal transitorio que el botón "Auto-pipeline" del dashboard dejó de abrir en v1.34.0 (→ `Router.go('/auto')`); llevaban en rojo en el job de CI Playwright-e2e separado. Reorientados a la pantalla #/auto. 653 → 660. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.44.0] — 2026-05-18

**WS2 #4 + #9 — confirmación con foco atrapado antes de sobrescrituras destructivas de archivos del proyecto padre.** Dos HIGH de la auditoría de UX, ambos con pérdida de datos: (#4) `config.js` `saveProfileRaw`/`saveModesRaw` reemplazaba el `config/profile.yml` / `_profile.md` completo del padre sin confirmación; (#9) `tracker.js` Normalize/Dedup/Merge reescribía `data/applications.md` del padre in situ sin confirmación. `fix(a11y/safety): UI.confirm() gate before whole-file parent overwrites` — nuevo `UI.confirm()` en `public/js/api.js`, un diálogo con foco atrapado que reutiliza la infraestructura modal WAI-ARIA existente (un gancho `_onClose` hace que Esc / backdrop / × / Cancel resuelvan todos `false`; el foco recae por defecto en Cancel; devuelve `Promise<boolean>`; NO el `confirm()` nativo). Las tres llamadas destructivas quedan ahora protegidas antes de su escritura. 8 nuevas claves i18n × 8 idiomas (el marcador `{op}` se preserva verbatim); +8 tests: `test: tests/confirm-gate.test.mjs`, 644 → 652. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.43.0] — 2026-05-18

**Solicitado por el usuario — `career-ops-ui open` + autostart que trae el navegador al frente.** Tras `setup`/`run`, un `open`/`xdg-open` pelado dejaba la pestaña del dashboard en segundo plano cuando el navegador ya estaba abierto, obligando al usuario a buscarla. `feat(cli): career-ops-ui open — open AND raise the dashboard tab` — el nuevo `scripts/open-dashboard.mjs` construye la URL desde HOST/PORT (reescribiendo un bind `0.0.0.0` a loopback), opcionalmente espera a `/api/health`, abre el navegador por defecto y luego lo **fuerza al frente** — `osascript` en macOS activando el que esté corriendo de Chrome/Brave/Edge/Safari/Arc/Firefox, `xdg-open`+`wmctrl` en Linux, `start` en Windows. Expuesto como el verbo `career-ops-ui open` (alias `dash`, `focus`). El autostart de `bin/start.sh` ahora delega en él para que la pestaña se traiga al frente automáticamente; `NO_OPEN=1` desactiva el auto-open en arranques headless/CI. README ×8 + help §1 ×8 actualizados; +8 tests: `test: tests/open-dashboard.test.mjs`, 636 → 644. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.42.0] — 2026-05-18

**WS2 corrección n.º 2 — ruta muerta `#/portals` → enlace profundo a config.** `#/portals` era una ruta no registrada que renderizaba la vista 404, pese a ser una URL plausible de marcador/tecleo para gestionar fuentes de portales (HIGH n.º 2 de la auditoría UX). `fix(router): #/portals 404 → alias to config + Regional-sources deep-link` — se añadió `portals: 'config'` a `ALIASES` de `router.js` (mismo patrón de estabilidad de marcadores que `settings→profile`), así que ahora resuelve a la vista config con el ítem de navegación **config** activo. Cuando existe un grupo Regional-sources, la vista (`config.js`) detecta el hash `#/portals`, fuerza la apertura de ese grupo `<details>`, lo desplaza a la vista y mueve el foco a su summary (anulando el foco h1 por defecto), de modo que el usuario aterriza justo en los controles de fuentes de portales; nunca renderiza un grupo regional vacío solo por el alias. help-bundle §5 × 8 obtuvo una nota de atajo; +1 test de router: `test(router): portals→config alias guarantee` en `router.test.mjs`, 635 → 636. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.41.0] — 2026-05-18

**WS2 — auditoría sénior de UX/usabilidad + corrección transversal de gestión de foco.** Una auditoría heurística de más de 10 años (Nielsen × WCAG 2.2 AA × convenciones del proyecto) de las 17 rutas produjo una cola de 40 hallazgos ordenada por severidad (`.planning/.../UX-AUDIT.md`); HIGH→MEDIUM→LOW se entregan ahora una corrección por release. Esta release aterriza el HIGH transversal n.º 1. Correcciones: `fix(a11y): move focus to the new view on every route change` — `router.js render()` reemplazaba `#content` en cada hashchange pero nunca movía el foco, así que los usuarios de teclado / lector de pantalla quedaban en el nodo destruido y perdían su sitio (WCAG 2.4.3 Focus Order / 4.1.3 Status Messages — transversal, afectaba las 17 pantallas); el nuevo `focusNewView(content)` enfoca el primer `h1`/`.page-title` de la vista nueva (anuncio SR conciso + orden de foco correcto), haciendo el encabezado enfocable (`tabindex=-1`) si hace falta y recurriendo a `#content`; el primer pintado se omite para no pelear con el skip-link; cableado en las rutas de render de éxito y error; verificado en vivo: tras navegar, `document.activeElement` es el `H1.page-title` de la vista nueva. Tests: `test(router): focus-management static guarantees` — 4 casos en `router.test.mjs` (helper definido, destino-encabezado + fallback a content, guarda de salto en primer pintado, ≥2 puntos de llamada); 631 → 635. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.40.0] — 2026-05-18

**WS8.3 — barrido de actualización de docs + corrección de `career-ops-ui help` + endurecimiento de `askSecret`.** Correcciones: `fix(cli): career-ops-ui help no longer leaks shell source` — el dispatcher imprimía su comentario de cabecera con `sed -n '2,12p'`, pero la línea 12 (`set -euo pipefail`) es código, no comentario, así que `career-ops-ui help` (y el texto de uso de verbo desconocido) terminaba con una línea `set -euo pipefail` perdida; acotado a `2,11p` (el bloque de comentario) en los casos `help` y `*)`; `help` sale 0, verbo desconocido sale 2 — verificado. `fix(cli): scripts/init.mjs key entry never echoes` — el seguimiento de v1.39.0 reemplazó la máscara cosmética de readline por un lector real en modo raw: `setRawMode(true)` + línea con búfer para que los bytes de clave tecleados/pegados nunca lleguen al terminal (sin fuga en scrollback / tmux / pantalla compartida); un FSM completo de escape VT consume cada secuencia CSI/SS3/OSC/DCS/SOS/PM/APC para que las teclas de flecha y función no corrompan el secreto; `stdin` se inyecta por dependencia, así que el fallback no-TTY se prueba unitariamente sin tocar el global; iterado hasta un LGTM limpio de la revisión IA. Documentación: README ×8 — la antigua sección "instalación en un comando" se reemplaza por una sección destacada **"Lanzar e inicializar en un comando"** (el one-liner de curl más la cadena explícita del CLI `career-ops-ui`: clone → `npm link` → `setup` → `init` → `doctor` → `run` → `help`, la explicación del asistente de proveedor, la forma CI `--provider --anthropic-key --yes` y la nota de `LLM_PROVIDER`); las 8 insignias de README actualizadas de v1.22–v1.24 / tests-461–474 a **v1.40.0 / tests-631** (insignia e2e hecha no numérica para evitar un conteo inventado); help-bundle ×8 §1 — se añade un callout "Lanzamiento e init en un comando" al inicio del manual de inicio rápido (antes de "A. Setup") en los 8 idiomas; paridad de secciones H2 preservada (17 cada uno — gate de CI verde). Tests: `test(init): non-TTY askSecret fallback` — `provider-selector.test.mjs` gana un caso de stdin por DI que comprueba que `askSecret` delega en `ask()` plano (paridad de trim) sin TTY y sin mutar el global compartido; 629 → 631. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.39.0] — 2026-05-18

**WS8.2 — selector de proveedor LLM + clave OpenAI/Codex + asistente `init` interactivo.** `LLM_PROVIDER` (auto|claude|gemini) + `OPENAI_API_KEY` en env-config (secreto). `providerOrder()` consultado por los 6 gate-sites de llm.mjs vía `_provGate()`; sin cambio de comportamiento para auto. Select + campo en #/config. `scripts/init.mjs` ahora es un asistente real (escribe parent .env por la ruta validada). 7 tests. 622 → 629. README ×8 / fold canónico = WS8.3/WS10. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.38.0] — 2026-05-17

**WS8.1 — dispatcher CLI unificado + verbo `doctor`.** `bin/career-ops-ui.sh` despacha setup/run/doctor/init/help. `scripts/doctor.mjs` reutiliza el motor `/api/health` exacto (createApp in-process → reporte terminal); exit 0 sólo si todos los checks REQUERIDOS pasan. docs/sdd + help §1 ×8. 6 tests. 616 → 622. README quickstart ×8 = WS8.3 (paso final). Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.37.0] — 2026-05-17

**WS7 — revisión AI pre-commit en el workflow git.** Floor determinista (fail-HARD): bloquea `.env`/secretos staged, patrones de clave en el diff, `.also(` en vistas staged, fallo `node --check`. Capa AI (fail-SOFT): `claude -p` sobre el diff si el CLI está disponible y `AI_REVIEW != off`. `.githooks/pre-commit` + `prepare` cablea `core.hooksPath`. Nunca `--no-verify`. docs/sdd. 6 tests. 610 → 616. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.36.0] — 2026-05-17

**WS6.3 — pestaña Modes: blob crudo → editor por secciones. WS6 completo.** `modes/_profile.md` se edita por sección `##` (un textarea plegable por encabezado). Server `splitProfileSections` byte-exacto; `PUT { sections }` fusiona solo las secciones nombradas — preámbulo + secciones ajenas + orden se conservan byte a byte. Encabezado desconocido → 400. Ruta raw `{ markdown }` intacta. i18n 5 claves ×8. help §2 ×8. 6 tests nuevos. 604 → 610. WS6 cerrado (API-keys/Profile-escalares/Profile-arrays/Modes-secciones todo estructurado). Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.35.0] — 2026-05-17

**WS6.4 — editores de arrays del Profile + auditoría WS6.2 de API-keys.** `PUT /api/profile` acepta `{ arrays }` (combinable con `{ fields }`): Target roles/Superpowers (listas), Archetypes (name/level/fit), Proof points (name/url/hero-metric). Misma garantía merge-not-replace; filas vacías descartadas; lista vacía elimina la clave. 4 editores add/remove en #/config. i18n 6 claves ×8. Auditoría: server KNOWN_KEYS ≡ client FIELDS, sin gap. 7 tests nuevos. 597 → 604. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.34.0] — 2026-05-17

**WS5 — pantalla Auto-pipeline de un clic (`#/auto`).** El modal de auto-pipeline pasó a una página dedicada y enlazable. Un clic ejecuta validar→obtener→evaluar→guardar informe→tracker vía SSE. Stepper accesible (lista ordenada, `aria-current`, live-region), deep-links a informe/tracker, modo manual sin key, enlazable `#/auto?url=…&go=1`. Entrada en sidebar; botón ✨ del dashboard ahora va aquí. i18n 14 claves ×8. help §1 ×8 + README ×8. 8 tests nuevos. 589 → 597. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.33.0] — 2026-05-17

**WS4 — auditoría de paridad con career-ops 1.8.0 + `location_filter`.** El `scan.mjs` del proyecto padre ganó `location_filter` (#570); los scanners in-process de web-ui no delegan en él, así que no fluía. Nuevo `server/lib/location-filter.mjs` replica la semántica verbatim; integrado en ambos scanners. Doc help §5 ×8. 8 tests nuevos. 581 → 589. Resto del delta padre clasificado en PARENT-PARITY.md (FLOW/CLI-ONLY/N/A). Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.32.0] — 2026-05-17

**Pestaña Profile de `#/config` — blob YAML crudo → formulario por campos (WS1).** 3 secciones plegables (Candidato / Narrativa / Compensación), 14 rutas escalares. El guardado por campos hace **merge** en `config/profile.yml`: arquetipos, proof points y claves propias se conservan intactos. Escape-hatch raw-YAML retenido en *Advanced* (preserva comentarios). 23 claves i18n ×8. 7 tests nuevos (incl. invariante de supervivencia de claves desconocidas). 574 → 581. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.31.0] — 2026-05-17

**Sync con career-ops 1.8.0 — `#/batch` expone `--model` + `--start-from`.** El proyecto padre subió 1.7.1 → 1.8.0; `batch-runner.sh` ganó `--model NAME` (#504) y `--start-from N`. web-ui los expone en `#/batch` (campos **Model** y **Desde #**) con validación defense-in-depth en el servidor (charset para model, entero 1..100000 para start-from). i18n ×8. 7 tests nuevos. 567 → 574. Detalle completo en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.30.0] — 2026-05-14

**Paginador en `#/scan` — reemplaza el truncamiento «primeros 200 de N» de v1.12.**

Pre-v1.30 la tabla de resultados de scan estaba acotada a las primeras 200 filas filtradas con una nota «Showing first 200 of N» al pie. Las filas 201..N eran inalcanzables desde la UI. v1.30.0 cambia el cap por `UI.paginate` (mismo helper que `#/tracker` / `#/reports` / `#/activity`). `PAGE_SIZE = 200` conserva la densidad visual previa; orden boosted-to-top estable entre páginas (orden COMPLETO y luego paginación); reset automático a página 1 al cambiar filtros. Clave i18n obsoleta `scan.shownTop` eliminada (×8 locales). 9 nuevos casos de prueba en `tests/scan-paginator.test.mjs` (7 canarios estáticos + 1 tabla lógica con 6 casos límite + 1 cómputo del resumen). **558 → 567** unit + acceptance (+9). Detalles completos en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.29.2] — 2026-05-14

**Hot-fix: `🌐 Scan` con `source=both` solo ejecutaba la fase EN. La fase RU se eliminaba silenciosamente.**

El cliente SSE (`public/js/api.js:156`) cerraba el `EventSource` en el PRIMER evento `done`, pero el servidor emite uno por fase en `source=both`. La fase RU arrancaba e inmediatamente se cancelaba. Fix: el servidor marca cada `done` con `final: true|false`; el cliente cierra solo cuando `final !== false`. Retrocompatible — los productores de fase única sin `final` siguen cerrando como antes. **547 → 558** unit + acceptance (+11 nuevos). Detalles completos en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.29.1] — 2026-05-14

**Guía detallada del usuario para configurar los 5 portales RU en el help-bundle §5, en las 8 locales.**

Nueva subsección "Configurar los portales rusos — guía detallada" dentro de §5 (Portals & sources): tabla inventario de 5 fuentes con auth y restricciones geográficas, paso a paso para localizar y editar `portals.yml`, ejemplo YAML completo de las 5 fuentes, colisión con la lista negativa con corrección, cómo deshabilitar una fuente, cómo verificar vía 🌐 Scan + log SSE. §17 (shipped en v1.29.0) cubre el flujo del desarrollador; §5 v1.29.1 cubre el flujo del usuario final. **540 → 547** unit + acceptance (+7 nuevos). Detalles completos en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.29.0] — 2026-05-14

**Scanner de portales rusos pasa de 2 a 5 fuentes; registry + dropdown dinámico; nueva sección §17 "Cómo añadir un nuevo portal".**

- **3 nuevos adaptadores RU:** `Trudvsem` (API open-data del gobierno, sin auth ni geo-gate), `GetMatch` y `GeekJob` (HTML scrape con parser defensivo — `[]` si no parsea, nunca throw en 200 sano).
- **Source registry** en `server/lib/sources/registry.mjs` — única fuente de verdad consumida por dispatcher + endpoint + dropdown. Pre-v1.29 el listado de fuentes vivía hardcoded en TRES lugares.
- **Nuevo endpoint** `GET /api/scan/sources` con `Cache-Control: max-age=60` — el SPA reconstruye el dropdown del filtro de fuente al cargar `#/scan`.
- **Help-bundle §17 nueva** en las 8 locales: «Cómo añadir un nuevo portal» (plantilla de adaptador, entry del registry, dispatcher, test mockeado, `portals.yml`).
- **`russian_portals.sources` por defecto** cambia de `["hh", "habr"]` a las 5 fuentes; si tu `portals.yml` ya lista `sources:` explícitamente, debes añadir las 3 nuevas a mano.
- Tests: **520 → 540** (+20). Detalles completos en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.28.1] — 2026-05-14

**Hot-fix: router 404 con hashes que llevan `?query`. Fila HH_USER_AGENT eliminada de health.**

Antes de v1.28.1 `Router.go('/evaluate?url=…')` producía un hash cuyo primer `split('/')` era el literal `"evaluate?url=…"`, que nunca coincidía con una ruta registrada → `__not_found__` (404). Fix de una línea: `hash.split('?')[0]` antes del split del nombre. Cubre dos clicks reportados: `#/pipeline → ▶` y "App settings → Modes". La fila opcional `HH_USER_AGENT` se elimina de `/api/health` (la pista 403-fuera-de-Rusia sigue en help-bundle §16 y se emite en stderr al escanear). **515 → 520** unit + acceptance (+ 5 nuevos). Detalles completos en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.28.0] — 2026-05-14

**Alineación de docs + nuevo control `--max-retries N` en `#/batch`.** Cierra las dos issues abiertas levantadas por `qa/QA-PROMPT-docs-vs-app.md`.

- **Issue #2** — `#/batch` ahora expone un campo numérico "Max retries" (1–10) que sólo se habilita cuando "Retry failed" está activado. El servidor parsea + valida 1≤N≤10 (los valores fuera de rango se descartan silenciosamente) y omite `--max-retries` sin `--retry-failed`. 7 casos de prueba en `tests/batch-max-retries.test.mjs`. 2 claves i18n nuevas × 8 locales.
- **Issue #1** — la lista de CLIs de IA en los 8 help-bundles y 8 READMEs se alinea con el canon de career-ops.org/docs (Claude Code · Codex · OpenCode · Qwen CLI), con una frase localizada: *«otras CLIs compatibles con Claude también funcionan vía la misma superficie de slash-comandos»*. El bullet "Multi-CLI" del README sobre los archivos shim de web-ui se conserva intacto (describe otra superficie). 2 nuevos canarios en `tests/canonical-docs-coverage.test.mjs`.
- **506 → 515** unit + acceptance (+ 9 nuevos). Playwright 32/32 sin cambios. Detalles completos en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.27.0] — 2026-05-14

**Pulido cosmético + a11y: deduplicar la entrada de barra lateral `#/dashboard`.**

En la barra lateral, el logo de marca (`<a class="logo" href="#/dashboard">`) y el primer ítem de navegación apuntaban a la misma ruta. Los lectores de pantalla anunciaban «Dashboard» dos veces y los usuarios de teclado tenían un tab-stop redundante. El bloque de marca ahora es un `<div class="logo">` plano; el ítem de navegación sigue siendo el único enlace a `#/dashboard`. **506 / 506** unit + **32 / 32** Playwright — sin cambios. Detalles completos en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.26.1] — 2026-05-14

**Hot-fix WCAG 2.5.5 — altura mínima 44 px de `.btn` restaurada.**

v1.26.0 perdió la declaración `min-height: 44px` en `.btn`; los botones del header renderizaban a 39-41 px (violación WCAG 2.5.5). v1.26.1 restaura el suelo de 44 px + `flex-shrink: 0` + `line-height: 1.2`. **502 → 506** unit, 32/32 Playwright sin cambios. Detalle en [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.26.0] — 2026-05-14

**Pirámide de tests + cobertura ≥ 93 % línea.**

Adopta la estructura de 4 niveles (unit → functional → acceptance → e2e) según el backlog de v1.25. Añade 22 tests nuevos cubriendo los mayores gaps de cobertura de v1.25 (jds.mjs 61.64 % → 100 %, ramas de rechazo en auto-pipeline). Introduce el directorio `tests/acceptance/` para tests de jornada de usuario multi-endpoint. **480 → 502** unit + acceptance, 32/32 Playwright sin cambios. Detalle completo en [`CHANGELOG.md`](CHANGELOG.md) y [`docs/architecture/TESTING.md`](docs/architecture/TESTING.md).

---

## [1.25.0] — 2026-05-14

**Cortocircuito manual del auto-pipeline + ajuste cosmético del dashboard + nivelación de paridad del CHANGELOG.** Cierra G-014 (el auto-pipeline ignoraba `mode: 'manual'`), G-012 (deriva de paridad del CHANGELOG — 6 *locales* iban 2 versiones por detrás) y la duplicación cosmética del glifo `✨ ✨` en el dashboard. G-003 (renombrado de `README.cn.md`) ya estaba cerrado de facto — el repositorio solo contiene `README.zh-CN.md`. G-005 (realineamiento del bloque de informe A-G → A-F) requiere un *commit* coordinado en el proyecto padre y queda diferido.

### 🛡️ G-014 — Cortocircuito de `mode: 'manual'` en el auto-pipeline

- **`fix(auto-pipeline): G-014 — honour mode:'manual' short-circuit`** ([`server/lib/routes/auto-pipeline.mjs:158-195`](server/lib/routes/auto-pipeline.mjs#L158-L195)) — antes de v1.25 el endpoint siempre llamaba a un LLM. Pasar `mode: 'manual'` (replicando `/api/evaluate` desde v1.10.2) era ignorado de forma silenciosa y la petición quedaba colgada de 1 a 3 minutos contra Anthropic. Ahora el manejador:
  - Acepta `mode` Y `evalMode` para retrocompatibilidad. Cualquiera de los dos con valor `'manual'` dispara el cortocircuito.
  - Emite las 5 etapas SSE con `status: 'done'` / `status: 'skipped'`. Sin *fetch*. Sin llamada al LLM. Sin los 0,05 $ por petición.
  - El *payload* `done` lleva `{ mode: 'manual', prompt: <buildEvaluationPrompt scaffold>, message }` — la SPA puede renderizarlo como la actual tarjeta de *prompt* manual de `/api/evaluate`.
- **Cierra un riesgo de DoS** en `HOST=0.0.0.0`: anteriormente, incluso con `llmRateLimit` limitando a 10 req/60 s/IP, 10 atacantes × 10 peticiones = 50 $/min en consumo de Anthropic. El cortocircuito actúa antes de que el decremento del limitador de tasa cuente como llamada real.
- **Pruebas** — [`tests/auto-pipeline-manual-mode.test.mjs`](tests/auto-pipeline-manual-mode.test.mjs): 3 tests confirman (1) que `mode: 'manual'` responde en menos de 2 s con las 5 claves de etapa, (2) que incluso con `ANTHROPIC_API_KEY` configurado el cortocircuito sigue activándose (el síntoma original), (3) que los llamadores antiguos con `evalMode: 'manual'` continúan funcionando.

### 📝 G-012 — Nivelación de paridad del CHANGELOG (6 *locales* × 2 versiones ausentes)

- **`docs(changelog): backfill v1.23.0, v1.24.0, v1.24.1, v1.25.0 in 6 lagging locales`** — antes de v1.25 solo EN tenía v1.23-v1.24; RU iba 1 versión por detrás y los otros 6 iban 2 versiones por detrás. v1.25 despliega agentes de traducción en paralelo (replicando el patrón de v1.23) para incorporar las cuatro entradas en `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md`. RU recibe v1.24.0 + v1.24.1 + v1.25.0 (ya tenía v1.23.0 del ciclo v1.23).
- **`feat(ci): scripts/check-changelog-parity.mjs gate`** — falla la *build* si la entrada más reciente de cualquier *locale* del CHANGELOG es más antigua que la canónica en EN. Conectado a `npm run test:ci`. La deriva preexistente de G-012 se habría detectado a sí misma en el momento mismo de cruzar el umbral de EN.

### ✨ Cosmético — deduplicación del doble glifo del dashboard

- **`fix(dashboard): dedup ✨ glyph in auto-pipeline button label`** ([`public/js/lib/i18n-dict.js:219`](public/js/lib/i18n-dict.js#L219)) — `dash.autoPipeline` llevaba un `✨` inicial en la cadena de cada *locale* Y `public/js/views/dashboard.js:58` anteponía otro `✨` en la vista. Resultado: el botón se renderizaba como `✨ ✨ Auto-pipeline …`. v1.25 retira el glifo inicial de la entrada DICT de cada *locale*; el prefijo de la vista pasa a ser la única fuente. La misma pasada de auditoría barrió el resto del *bundle* i18n — no se hallaron otros patrones de doble glifo.

### 🚫 Diferido a una versión futura

- **G-005 — Realineamiento del bloque de informe A-G → A-F por canónico career-ops.org/docs** — requiere un *commit* coordinado en el proyecto padre `santifer/career-ops` (reescribir `modes/oferta.md` para emitir A=Role, B=CV-match, C=Strategy, D=Comp, E=Personalization, F=STAR — eliminando C-Risks/G-Legitimacy como bloques separados). v1.25.0 entrega el lado web-ui listo para el nuevo esquema (`reports.js` acepta letras de bloque arbitrarias desde v1.13). Se rastrea para la próxima ventana de versión en que padre e hijo puedan aterrizar juntos.
- **G-003 — Renombrado de `README.cn.md` → `README.zh-CN.md`** — verificado durante la preparación de v1.25: el repositorio ya contiene `README.zh-CN.md` (no hay ningún `README.cn.md` huérfano bajo el *worktree*). El hallazgo de G-003 estaba obsoleto.

### 🧪 Pruebas

- **477 → 480** *unit* (+3 de PR-B `auto-pipeline-manual-mode.test.mjs`).
- 32/32 Playwright sin cambios.
- `npm run test:ci` ejecuta ahora `npm test` + `check-no-also-leftovers.mjs` + `check-changelog-parity.mjs`.

### Verificación

```bash
$ npm run test:ci
# 480 / 480
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.25.0

# G-014 — el modo manual responde en < 2 s incluso con ANTHROPIC_API_KEY configurado:
$ ANTHROPIC_API_KEY=sk-ant-test PORT=4317 npm start &
$ sleep 3
$ time curl -sS -X POST -H 'Content-Type: application/json' \
    -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/x","mode":"manual"}' \
    http://127.0.0.1:4317/api/auto-pipeline | head -20
# real  0m0.1xx s  (antes 1-3 min)
# event: start … event: step (×5) … event: done {"mode":"manual","prompt":"…"}

# G-012 — cada CHANGELOG localizado incluye la entrada v1.25.0:
$ grep -c '^## \[1.25.0\]' CHANGELOG*.md
# 8 ficheros, cada uno → 1

# Cosmético — glifo del dashboard:
$ grep "dash.autoPipeline" public/js/lib/i18n-dict.js
# Ningún ✨ inicial en ningún valor de locale (la vista aporta el único glifo)
```

### Cambios incompatibles

Ninguno. `mode: 'manual'` es opcional; los llamadores antiguos con `evalMode: 'manual'` continúan funcionando sin cambios.

### Fuera de alcance (v1.26+)

| Ítem | Notas |
|---|---|
| G-005 — Realineamiento A-F del bloque de informe | Requiere un *commit* coordinado del padre (`santifer/career-ops` reescribe `modes/oferta.md`). |
| Ejecución en vivo de los sub-tests **visuales** del escenario QA 31 | Requieren un agente con navegador (Claude Cowork). Cubierto parcialmente por el *smoke* de Playwright. |
| Objetivo de 400 LOC en `i18n-dict.js` | *Fixture* de traducción — exento por política. Dividirlo añadiría peticiones HTTP sin un *bundler*. |

---

## [1.24.1] — 2026-05-14

**Parche urgente: caída de `#/config` en los 8 *locales* (G-015).**

### 🚑 *Hot-fix* crítico

- **`fix(config): G-015 — replace removed Element.prototype.also call in config.js`** ([`public/js/views/config.js:371`](public/js/views/config.js#L371)) — N-2 de v1.22.0 retiró el *monkey-patch* global `Element.prototype.also` y migró `cv.js` a un patrón de instrucciones libres, pero **se olvidó de `config.js`**. Resultado: `#/config` se caía en la primera invocación en cada *locale* con `c(...).also is not a function`. v1.24.1 aplica el mismo patrón de migración de `cv.js:188-201` — extraer el árbol a una `const root = c(...)`, ejecutar el bloque de activación por separado y luego `return root;`.

### 🛡️ Verja de CI

- **`feat(ci): scripts/check-no-also-leftovers.mjs sweep`** — recorre cada archivo bajo `public/js/views/` y falla la *build* ante cualquier llamada `.also(` (se permiten las referencias en comentarios). Conectado al nuevo *script* `npm run test:ci`. Una futura reversión de la eliminación del *monkey-patch* no podrá reintroducir la misma regresión en silencio.

### 🧪 Pruebas

- **`test: tests/config-view-syntax.test.mjs`** — tres guardas:
  - parsea `config.js` vía `node:vm.Script` (detecta regresiones a nivel de sintaxis sin necesidad de Playwright)
  - comprueba que no sobrevive ningún `.also(` fuera de comentarios
  - comprueba que están presentes los anclajes de migración `const root = c(...)` / `return root;`
- **474 → 477** *unit* (+3) + 32/32 Playwright sin cambios.

### Verificación

```bash
$ npm run test:ci
# 477 / 477
# ✓ no .also( leftovers in views/

# Smoke en navegador:
$ open http://127.0.0.1:4317/#/config
# → se renderiza con normalidad, sin tarjeta "is not a function". Lo mismo en cada locale.
```

### Fuera de alcance (diferido a v1.25)

- G-014, G-012, G-005, G-003 — ver la entrada v1.25.0 más arriba para el lote.

---

## [1.24.0] — 2026-05-14

**Renovación del *help-bundle* en profundidad de contenidos + ejecución en vivo del escenario QA 31 + CHANGELOG RU de cabo a rabo.** Cierra los dos ítems que la tabla "Fuera de alcance" de v1.23.0 difirió a v1.24: la renovación completa en profundidad de contenidos de los 8 *help bundles* desde las 5 URL canónicas de career-ops.org/docs (era solo cobertura de URL desde v1.11.x) y la ejecución en vivo del escenario QA 31 contra un servidor activo (era "requiere agente con navegador + credenciales LLM" — resultó que 6 de 6 sub-tests son alcanzables vía curl + grep; solo los sub-tests visuales necesitan navegador).

### 📖 Renovación en profundidad de contenidos del *help-bundle*

- **`docs(help): refresh en.md from 5 canonical career-ops.org/docs URLs`** ([`docs/help/en.md`](docs/help/en.md)) — antes de v1.24 el *bundle* EN tenía 1113 líneas y enumeraba las 5 URL canónicas en el *front-matter* pero no las desarrollaba en el cuerpo. v1.24 obtiene las 5 URL vía WebFetch y profundiza las secciones H2 correspondientes:
  - **About career-ops (front-matter)** — añadidos los principios (soberanía de datos, agnosticismo de IA, control humano), bloque "What career-ops is NOT", inventario de conceptos ampliado de 6 a 10 filas (añadidos Proof points, JD store, Interview-prep, Batch additions).
  - **§5 Portals** — añadido el *bootstrap* canónico `cp templates/portals.example.yml portals.yml`, aclarados los campos obligatorios frente a los opcionales por cada entrada `tracked_companies`.
  - **§7 Scan** — añadida la nota "no se consumen tokens de IA" para la Opción A, lista de órdenes de seguimiento (`apply` / `contacto` / `deep` / `tracker`).
  - **§14 Apply checklist** — dividida en modo SPA checklist frente a Manual-vs-Playwright-assisted frente al flujo CLI completo (los 8 pasos numerados canónicos desde `/career-ops apply <company>` hasta `Submitted.` con transición automática `Evaluated → Applied`); la subsección *batch evaluate* tiene ahora tabla de esquema TSV + las 4 banderas documentadas + `merge-tracker.mjs --dry-run`; la subsección *Playwright Setup* enumera órdenes de instalación, registro MCP, alternativa `.claude/settings.local.json`, nota *headless-by-default*.
- **Paridad de 16 secciones H2 preservada** (el test CI `help-ui.test.mjs::section-parity` exige exactamente 16 secciones H2 en los 8 *locales*).
- **Cada una de las 5 URL canónicas aparece ≥ 2 veces** en el *bundle* (lo impone el test CI `canonical-docs-coverage.test.mjs`). Recuento por URL tras v1.24: `what-is-career-ops` × 4, `scan-job-portals` × 5, `apply-for-a-job` × 3, `batch-evaluate-offers` × 5, `set-up-playwright` × 3.
- **`docs(help): translate the v1.24 deepening to 7 non-EN locales`** — 7 agentes de traducción en paralelo. Cada *locale* destino (es / pt-BR / ko-KR / ja / ru / zh-CN / zh-TW) recibe un *bundle* renovado que refleja la estructura EN sección por sección, preserva *verbatim* los bloques de código / URL / rutas de fichero / etiquetas de botón (📁 Upload CV / 🌐 Scan now / ▶ Evaluate / 📄 Generate PDF / 💾 Save) y las abreviaturas inglesas (CSP, SSRF, TOCTOU, WCAG, ATS, JD, SSE, REST, API), y traduce la profundización a un estilo técnico nativo de calidad publicable en el idioma destino.

### 🧪 Escenario QA 31 — ejecución en vivo (6/6 PASS)

- **`docs(qa): append last-verified live-execution log to qa/claude-cowork-browser-test-prompt.md`** — antes de v1.24 el escenario 31 estaba documentado pero nunca se había ejecutado contra un servidor real (diferido como "requiere agente con navegador + credenciales LLM"). v1.24 ejecutó los 6 sub-tests contra `http://127.0.0.1:4317`:

  | Sub | Descripción | Estado |
  |---|---|---|
  | 31.1 | Umbrales de puntuación en los *help bundles* | ✅ PASS (4.5 × 3, 4.0 × 9, 3.5 × 6 menciones en `docs/help/en.md`) |
  | 31.2 | Endpoints del flujo de *scan* | ✅ PASS (`/api/stream/scan-{en,ru}` + `/api/scan-ru/config` → 404; `/api/scan/regional/config` → 200) |
  | 31.3 | Checklist de `/api/apply-helper` | ✅ PASS (el cuerpo contiene `career-ops apply` + aviso `auto-submit`) |
  | 31.4 | Endpoint `/api/batch` | ✅ PASS (claves `[exists, runnerExists, raw, rows, additions]`) |
  | 31.5 | Disponibilidad de Playwright | ✅ PASS (`/api/health` reporta `Playwright (parent node_modules) ok: true, value: installed`) |
  | 31.6 | Cobertura de URL en *help-bundles* (5 URL × 8 *locales*) | ✅ PASS (**40 / 40 ✓**) |

  Los sub-tests exclusivamente visuales (requieren navegador) se marcan aparte en el *prompt* QA — siguen siendo ejecutables vía Claude Cowork o `npm run test:e2e:browser`.

### 🌐 CHANGELOG RU de cabo a rabo (seguimiento de M-9)

- **`docs(translate): CHANGELOG.ru.md retry agent — full body translation`** ([`CHANGELOG.ru.md`](CHANGELOG.ru.md)) — la versión v1.23.0 se publicó con el agente de reintento del CHANGELOG RU aún en curso (había caído con un error de *socket* y fue redespachado). v1.24 recoge la traducción completa de 1542 líneas del agente: cada entrada de v1.23.0 → v1.6.0 tiene un cuerpo en ruso de calidad publicable, sin más parches provisionales con cuerpo en EN. La disciplina estilística iguala la renovación de calidad del README en v1.22.0: "функциональность" / "возможности" / "поведение" reemplazan al torpe "функционал"; "через" / "с помощью" reemplazan "при помощи"; voz activa frente a pasiva; "эндпоинт", "лимит запросов", "состояние гонки", "санитайзинг" como términos canónicos; abreviaturas inglesas (TOCTOU, CSP, SSRF, WCAG, ATS, JD, SSE, REST, API) preservadas.

### 🧪 Pruebas

- **474 / 474** *unit* + 20 / 20 *smoke* E2E + 32 / 32 Playwright. Cero deltas en pruebas de comportamiento; cada aserción CI del *help-bundle* (16 secciones H2 × 8 *locales*, 5 URL × ≥ 2 menciones, suelo de contenido) sigue en verde.

### Verificación

```bash
$ npm test                            # 474 / 474

# Profundización del help-bundle:
$ wc -l docs/help/en.md
# ~1270 líneas (antes 1113 — profundizado, no inflado)

$ for url in what-is-career-ops scan-job-portals apply-for-a-job \
             batch-evaluate-offers set-up-playwright; do
    echo -n "$url: "
    grep -c "$url" docs/help/en.md
  done
# what-is-career-ops: 4
# scan-job-portals: 5
# apply-for-a-job: 3
# batch-evaluate-offers: 5
# set-up-playwright: 3

# Escenario 31.6 — 40/40 cobertura de URL:
$ for lang in en es pt-BR ko ja ru zh-CN zh-TW; do
    echo -n "$lang: "
    for url in what-is-career-ops scan-job-portals apply-for-a-job \
               batch-evaluate-offers set-up-playwright; do
      curl -sS "http://127.0.0.1:4317/api/help/$lang" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('markdown',''))" \
        | grep -q "$url" && echo -n "✓ " || echo -n "✗ "
    done
    echo
  done
```

### Cambios incompatibles

Ninguno.

### Fuera de alcance (v1.25+)

| Ítem | Notas |
|---|---|
| Ejecución en vivo de los sub-tests **visuales** del escenario 31 | Requieren un agente con navegador (Claude Cowork o `npm run test:e2e:browser`). Fuera de alcance para la ejecución solo con curl; cubierto por el *smoke* de Playwright existente. |
| Traducción del cuerpo del CHANGELOG RU **de las entradas más antiguas** (v1.5.x y anteriores) | El agente de reintento solo cubrió desde v1.6.0 en adelante. Las entradas pre-v1.6 (`v1.5.x`, etc.) — si alguna vez existieron — permanecen como contenido preexistente. |
| Regresión visual sobre capturas del dashboard tras futuros cambios de la SPA | `scripts/capture-dashboard-screenshots.mjs` regenera los PNG por *locale*; actualmente no hay *diff* automatizado. |

---

## [1.23.0] — 2026-05-14

**División de i18n + arreglo CI del *banner* de conexión + capturas del dashboard localizadas + cada parche provisional del *backlog* cerrado.** Entrega los tres ítems que la tabla "Fuera de alcance" de v1.22.0 marcó para v1.23 (cuerpos del CHANGELOG por *locale* M-9, división LOC de `i18n.js` N-1, auditoría de contenido del *help-bundle*) más un parche urgente para el test *smoke* E2E que dejó en rojo el CI de la rama principal tras v1.22.0.

### 🚑 *Hot-fix* de CI — recuperación del *banner* de conexión

- **`fix(client): reset health-poll cadence + visibilitychange eager re-check`** ([`public/js/api.js:21-91`](public/js/api.js#L21-L91)) — el *backoff* exponencial M-6 de v1.22.0 era correcto (3 s → 6 s → 12 s → tope de 15 s, frente al tope original de 60 s) pero el `setTimeout` en curso quedaba anclado al *delay* fijado previamente. Un servidor caído en t=0,1 con la primera *ping* en t=3 fallaba, duplicaba el *delay* a 6 y la siguiente sonda de recuperación no se disparaba hasta t=9. El *smoke* E2E "Flujo 2a: el *banner* de conexión aparece al caer el servidor y se oculta al recuperarse" esperaba solo 4 s y se ponía en rojo en `main`.

    v1.23.0 remodela el bucle de *polling*:

    - Se rastrea `_healthHandle` para que `setConnectionState(lost=true)` pueda hacer `clearTimeout` y reprogramar con `_HEALTH_MIN`. La primera sonda de recuperación se dispara ahora dentro de los 3 s desde la caída, independientemente del *delay* que estuviera encolado.
    - `_HEALTH_MAX` rebajado de 60 s a 15 s. Una pestaña en segundo plano contra un servidor caído sigue recuperándose dentro de un ciclo de *polling* cuando el usuario vuelve; el ahorro de ancho de banda se mantiene sustancial.
    - `document.addEventListener('visibilitychange')` revuelve a sondear ansiosamente cuando la pestaña recupera el foco y `connectionLost === true` — un Cmd-Tab de vuelta no espera al siguiente *tick* del *backoff*.

### 🧹 N-1 — División de `i18n.js` (por encima del objetivo de 400 LOC)

- **`refactor(client): split DICT into i18n-dict.js (data) + i18n.js (logic)`** — antes de v1.23 `public/js/lib/i18n.js` tenía 639 LOC. El grueso (líneas 23-586) era la tabla de traducción `DICT` — datos estructurados puros. v1.23.0 extrae eso a [`public/js/lib/i18n-dict.js`](public/js/lib/i18n-dict.js) (578 LOC, exento de la regla de LOC según CLAUDE.md "Exempt from these limits: generated files, migrations, test fixtures, lock files, vendored code" — las tablas de traducción califican como *fixtures*), dejando [`public/js/lib/i18n.js`](public/js/lib/i18n.js) en 86 LOC de pura lógica de módulo (muy por debajo del objetivo de 400 LOC).
- **Contrato del cargador:** `i18n-dict.js` rellena `window.__I18N_DICT = { … }`, y luego `i18n.js` lo lee dentro de la IIFE existente. [`public/index.html`](public/index.html) los carga en orden — `i18n-dict.js` antes que `i18n.js` — de modo que la IIFE ve un DICT completamente poblado en el momento de su construcción. *Fallback* de DICT ausente: cada llamada a `t()` devuelve su *fallback* en línea o la clave desnuda, lo que aflora una mala configuración de forma ruidosa sin tumbar la SPA.
- **Cableado de pruebas actualizado:** [`tests/i18n-coverage.test.mjs`](tests/i18n-coverage.test.mjs), [`tests/help-ui.test.mjs`](tests/help-ui.test.mjs), [`tests/canonical-docs-coverage.test.mjs`](tests/canonical-docs-coverage.test.mjs) ejecutan ahora ambos archivos a través del contexto VM de prueba (o concatenan su fuente para el barrido regex), preservando cada aserción existente.

### 🌐 M-9 — Traducciones del cuerpo del CHANGELOG por *locale*

- **`docs(translate): 7 non-EN CHANGELOG files end-to-end`** — antes de v1.23 `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` llevaban notas provisionales con cuerpo en EN para cada entrada desde v1.13.0 en adelante, con un pie remitiendo al lector al canónico EN. v1.23.0 despliega 7 agentes de traducción en paralelo — uno por *locale* — que reescriben cada cuerpo a un estilo técnico de calidad publicable en el idioma destino. Notas provisionales retiradas. Bloques de código, rutas de fichero, URL, cadenas con estilo de *commit-message* (`fix(security): B-1 — …`), variables de entorno y etiquetas de enlace preservadas *verbatim* en todos los *locales*.

### 🖼️ Capturas del dashboard localizadas en cada README

- **`docs(readme): wire each locale README at its locale-specific PNG`** — antes de v1.23 solo `README.pt-BR.md` referenciaba `dashboard-pt-BR.png`; los otros 6 README no ingleses seguían apuntando a `dashboard-en.png`. Las capturas (ya tomadas en el ciclo de v1.22.0 por [`scripts/capture-dashboard-screenshots.mjs`](scripts/capture-dashboard-screenshots.mjs)) estaban presentes en `images/` pero sin uso. v1.23.0 actualiza la línea 14 de cada `README.{es,ja,ko-KR,ru,zh-CN,zh-TW}.md` a su propio `dashboard-<locale>.png`.

### 🧪 Pruebas

- Los mismos 474 / 474 *unit* + 32 / 32 Playwright que v1.22.0. **El *smoke* E2E pasa ahora a 20 / 20** (era 19 / 1 fallo en `main` tras v1.22.0 por la regresión de recuperación del *banner*; la reprogramación de v1.23.0 lo cierra).
- Tres pruebas existentes recableadas para acomodar la división de i18n. Cero archivos de prueba nuevos; cero aserciones eliminadas.

### Verificación

```bash
$ npm test
# 474 / 474

$ npm run test:e2e
# passed: 20    failed: 0    (era 19/1 en main v1.22.0)

$ wc -l public/js/lib/i18n.js public/js/lib/i18n-dict.js
#       86 public/js/lib/i18n.js          ← lógica, bajo el objetivo
#      578 public/js/lib/i18n-dict.js     ← fixture de datos, exento

$ grep -h 'dashboard-' README*.md | sed -E 's/.*(dashboard-[^)]+).*/\1/' | sort -u
# dashboard-en.png    (solo README.md)
# dashboard-es.png    dashboard-ja.png
# dashboard-ko-KR.png dashboard-pt-BR.png
# dashboard-ru.png    dashboard-zh-CN.png  dashboard-zh-TW.png

# Cordura de la traducción del CHANGELOG: cada archivo de locale > 200 líneas de contenido nativo
$ wc -l CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md | grep -v total
```

### Cambios incompatibles

Ninguno. `public/index.html` carga ahora dos *scripts* donde antes cargaba uno — quien sirva la SPA desde una CDN debe incorporar `i18n-dict.js`; el orden de carga del *script* lo impone el orden de las etiquetas `<script src>` en `index.html`. El *fallback* en tiempo de ejecución (DICT vacío → `t()` devuelve el *fallback* EN en línea) previene caídas duras cuando el archivo nuevo falta.

### Fuera de alcance (v1.24+)

| Ítem | Notas |
|---|---|
| Renovación en profundidad del CONTENIDO del *help-bundle* desde career-ops.org/docs (frente a cobertura de URL) | Las 5 URL canónicas ya aparecen en cada *help-bundle* localizado desde v1.11.x y el escenario 31.6 del *prompt* QA verifica la cobertura. La renovación en profundidad del cuerpo del contenido es candidata a v1.24+. |
| Ejecución en vivo del escenario QA 31 contra un servidor activo | Requiere agente con navegador + credenciales LLM en vivo. Candidato a v1.24. |
| Barrido por componente del *touch-target* en los nuevos párrafos *hint* de la página de modos | M-1 de v1.22.0 añadió elementos `<p class="field-hint">` que aún no se han verificado contra la altura mínima WCAG 2.5.5 en los 8 *locales*. |

---

## [1.22.0] — 2026-05-14

**Limpieza del backlog M/L/N + alineación documental + pase de calidad en traducciones.** Todo el tramo medio-e-inferior de `v1.20.1-BACKLOG.md` se entrega en una sola versión: nueve ítems M, cinco ítems L, dos *nits*. Se suma una auditoría de alineación contra las cinco guías canónicas de [career-ops.org/docs](https://career-ops.org/docs), una actualización de los *system prompts* bajo `.claude/` y `.github/`, y un repaso de calidad de los README en los 7 *locales* no ingleses.

### 🛡️ Endurecimiento de seguridad (defensa en profundidad)

- **`fix(security): M-4 — stripDangerousMarkdown consciente de entidades`** ([`server/lib/security.mjs`](server/lib/security.mjs)) — la regex previa a v1.22 coincidía con `<script>`, `javascript:`, `on*=` como subcadenas literales. `&lt;script&gt;`, `java&#115;cript:` y `<img src="data:image/svg+xml,<svg onload=…>">` se colaban sin filtro. El saneamiento ahora decodifica entidades `&lt;`, `&gt;`, `&amp;`, `&quot;`, numéricas (`&#NN;`) y hexadecimales (`&#xHH;`) **antes** de ejecutar la regex de saneamiento. Validado por 11 pruebas en [`tests/cv-xss-bypasses.test.mjs`](tests/cv-xss-bypasses.test.mjs). La defensa real sigue siendo la canalización *escape-first* `UI.md` del lado cliente; esto endurece el fichero en reposo.

- **`fix(security): L-2 — bash --noprofile --norc en el ejecutor de lotes`** ([`server/lib/routes/batch.mjs:108`](server/lib/routes/batch.mjs#L108)) — `spawn('bash', [PATHS.batchRunner, ...])` heredaba el `~/.bashrc` del usuario. Un fichero rc hostil podía influir en la ejecución. Ahora `spawn('bash', ['--noprofile', '--norc', PATHS.batchRunner, ...])`.

### 🔒 Resiliencia

- **`fix(client): M-6 — *backoff* exponencial en el ping de salud`** ([`public/js/api.js:22-48`](public/js/api.js#L22-L48)) — el *poller* del estado desconectado lanzaba 28 800 *fetches* contra un servidor caído durante la noche. Ahora 3 s → 6 s → 12 s → 24 s → 60 s, con reinicio a 3 s en el primer 2xx de recuperación. La configuración es una cadena de `setTimeout` (no un `setInterval`), de modo que cada paso adopta el nuevo retardo.

- **`fix(client): M-5 — protección frente a localStorage del modo privado de Safari`** ([`public/js/lib/i18n.js:572-583`](public/js/lib/i18n.js#L572-L583)) — Safari en modo privado lanza `SecurityError` en cada `localStorage.getItem/setItem`. La IIFE de carga rompía el módulo i18n completo y dejaba el SPA mostrando claves en bruto. Se envolvieron ambas llamadas en try/catch con respaldo a `detect()` por el idioma del navegador.

- **`fix(server): M-2 — tope de tamaño en *fetches* salientes de vista previa (prueba + verificación)`** — el `safeGet` introducido en v1.21.0 ya transmitía por *chunks* y cortaba en `opts.maxBytes`. v1.22 añade una prueba explícita de regresión en [`tests/ssrf-redirect-rebind.test.mjs`](tests/ssrf-redirect-rebind.test.mjs) para fijar el contrato: 100 KB de origen + 4 KB de tope → respuesta ≤ 4 KB.

- **`fix(client): L-5 — limpiar setTimeout al cambiar de hash en scan.js`** ([`public/js/views/scan.js:6-22, :113-120`](public/js/views/scan.js#L6-L22)) — el temporizador de `refreshResults()` a los 300 ms tras *done* tenía fuga si el usuario salía de `#/scan` en esa ventana. El *handle* ahora se captura y se cancela en `__cancelActiveScanPoll`.

- **`fix(client): L-4 — combinador de líneas `data:` multilínea en SSE`** ([`public/js/lib/auto-pipeline.js:158-176`](public/js/lib/auto-pipeline.js#L158-L176)) — el *parser* SSE usaba `match()` (una sola línea). Según la especificación, un evento puede arrastrar varias líneas `data:` que el consumidor une con `\n`. El servidor envía hoy JSON en línea única, así que el código antiguo funcionaba — pero era frágil ante cualquier carga útil multilínea futura.

### ♿ Accesibilidad

- **`feat(a11y): M-3 — WCAG 1.4.1 pistas redundantes en píldoras de puntuación y banner de conexión`** ([`public/css/app.css:602-625, :812-822`](public/css/app.css#L602-L625)) — `score-high` / `score-mid` / `score-low` transmitían el estado solo por tono (rojo/ámbar/verde). Quien no percibe el tono se quedaba sin recurso. Cada nivel recibe ahora un glifo redundante vía `::before` (✓ / ◐ / ○). El banner de conexión incorpora un glifo `⚠` en el estado *offline*. Los puntos de renderizado no se tocan — endurecimiento puramente CSS.

- **`feat(a11y): M-1 — párrafos de pista en línea para cada campo de mode-page`** ([`public/js/views/mode-page.js`](public/js/views/mode-page.js), [`public/js/lib/i18n.js`](public/js/lib/i18n.js)) — v1.20.0 cableó `htmlFor → id` en cada campo de *mode-page* pero no arrastró el texto de pista en línea; sólo los recorridos del README describían la intención del campo. v1.22.0 incorpora 19 claves i18n de pista × 8 *locales* = **152 traducciones nuevas** y el constructor `field()` renderiza ahora un `<p id="…-hint">` con su cableado `aria-describedby` por campo. Los usuarios de lector de pantalla oyen la pista al enfocar el campo.

- **`fix(a11y): M-7 — protección contra null en el alias htmlFor de UI.el()`** ([`public/js/api.js:194-198`](public/js/api.js#L194-L198)) — `htmlFor: null` producía un literal `for="null"`. Espejo en una línea de la guarda `v != null && v !== false` de la rama de respaldo.

### 🧹 Calidad / portabilidad

- **`fix(server): L-1 — radix en parseInt en health.mjs + bin/start.sh + bin/setup.sh`** — `parseInt(process.versions.node)` sin radix dispara un aviso del *linter* y es frágil si Node llegara a publicar versiones hexadecimales. Se añadió `10` en todas partes.

- **`fix(server): L-3 — comprobación de punto de entrada segura en Windows`** ([`server/index.mjs:159-163`](server/index.mjs#L159-L163)) — `import.meta.url === \`file://${process.argv[1]}\`` maneja mal letras de unidad y barras invertidas en Windows. Sustituido por `fileURLToPath(import.meta.url) === path.resolve(process.argv[1])`.

- **`refactor(client): N-2 — eliminar el parche de Element.prototype.also`** ([`public/js/views/cv.js:188-201`](public/js/views/cv.js#L188-L201)) — contaminación global del prototipo DOM. Sustituido por una variable local con la raíz del árbol.

- **`test(canary): M-8 — prueba de regresión 404 para /api/scan-ru/config retirado`** ([`tests/scan-consolidated.test.mjs`](tests/scan-consolidated.test.mjs)) — v1.20.0 retiró el alias pero no dejó canario. Añadido en tres líneas como espejo de las pruebas de retirada de v1.18.

### 📚 Documentación + system prompts

- **`docs(architecture): refrescar OVERVIEW + DATA-FLOWS para la superficie de v1.21+`** — añadidos `safe-fetch.mjs` (GET con DNS fijado), `file-lock.mjs` (mutex por ruta), `rate-limit.mjs` (estrangulamiento del LLM) y `sanitizePathName` a OVERVIEW.md. DATA-FLOWS.md gana dos secciones nuevas: "*Outbound URL fetches (DNS-rebind-safe)*" y "*LLM endpoint rate-limiting*".

- **`docs(readme): refresco de la sección sobre el sobre de seguridad`** — la sección "Security notes" del README.md documenta ahora cada *helper* del sobre de seguridad de v1.21+ (sanitizePathName, safeGet, withFileLock, llmRateLimit, stripDangerousMarkdown consciente de entidades).

- **`docs(qa): escenario 31 — alineación con career-ops.org/docs`** ([`qa/claude-cowork-browser-test-prompt.md`](qa/claude-cowork-browser-test-prompt.md)) — seis nuevas subpruebas (31.1–31.6) que verifican que la UI coincide con el comportamiento descrito en las cinco guías canónicas de career-ops.org/docs: umbrales de puntuación, flujo de *scan* (un botón), flujo de aplicación (lista, no autoenvío), flujo de lotes (editor TSV), arranque de Playwright (fallo elegante) y cobertura del *help bundle* (5 URLs × 8 *locales*).

- **`docs(translate): refresco de calidad del README × 7 *locales* no ingleses`** — cada README no inglés reescrito a un estilo técnico de calidad editorial en su lengua nativa. Reemplazados los calcos torpes habituales; añadidas las menciones al sobre de seguridad v1.21/v1.22; *badges* de versión y de pruebas actualizados.

- **`docs(system): .claude/PROJECT-CONTEXT.md + .github/copilot-instructions.md`** — orientación en un único fichero para los agentes que se incorporan a una sesión. Resume CLAUDE.md, nombra los *helpers* de v1.21+ y enumera los tropiezos habituales.

- **`docs(bin): actualizar comentarios de start.sh / setup.sh / run_all.sh`** — "dos dependencias" → "tres dependencias" (express + js-yaml + multer); "298 tests" → "474+ tests"; radix de `parseInt` añadido.

### 🧪 Tests

- **461 → 474 *unit*** (+13) + 32/32 Playwright sin cambios.
- Ficheros nuevos: `cv-xss-bypasses.test.mjs` (M-4, 11 pruebas).
- Ampliados: `ssrf-redirect-rebind.test.mjs` (+1 para el tope de cuerpo M-2), `scan-consolidated.test.mjs` (+1 para el canario M-8 del alias).
- Cero *deltas* de comportamiento en suites existentes — cada *fix* es aditivo o queda cubierto por un canario nuevo.

### Verificación

```bash
npm test                          # 474 / 474
npm run test:e2e:browser          # 32 / 32

# Saneamiento XSS con entidades:
node -e "import('./server/lib/security.mjs').then(({stripDangerousMarkdown}) => console.log(stripDangerousMarkdown('&lt;script&gt;alert(1)&lt;/script&gt;')))"
# → '' (ningún <script> sobrevive)

# Backoff del health-ping (abre devtools, mata el servidor, observa el panel de red):
#   3 s → 6 s → 12 s → 24 s → 60 s, reinicio en el primer ping exitoso

# Glifo de la píldora de puntuación (abre #/reports en tema claro y oscuro):
#   .score-high muestra ✓ + puntuación numérica
#   .score-mid  muestra ◐ + puntuación numérica
#   .score-low  muestra ○ + puntuación numérica

# Pistas en mode-page (#/contacto, etc):
#   <input aria-describedby="mode-contacto-recipient-hint">  ← apunta a <p id="…">

# Alias retirado:
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/scan-ru/config
# → 404
```

### Cambios incompatibles

Ninguno. Cada *fix* es aditivo o preserva los contratos de los *endpoints* existentes.

### Fuera de alcance (v1.23+)

| Ítem | Notas |
|---|---|
| M-9 — traducción de los cuerpos del CHANGELOG por *locale* | Todas las entradas v1.13+ de `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` eran provisionales con cuerpo inglés. Candidato a traducción masiva cuando se ralentice la cadencia de versiones. |
| N-1 — `public/js/lib/i18n.js` por encima del objetivo de 400 LOC | Dividir por *locale* incrementa el coste HTTP sin un empaquetador. Se aplaza hasta que se decida el paso de *build*. |
| Refresco del contenido del *help bundle* desde career-ops.org/docs | Las cinco URLs canónicas ya aparecen en el *help bundle* de cada *locale* (desde v1.11.x). El escenario 31.6 del *prompt* QA verifica la cobertura. Refresco de profundidad es candidato a v1.23. |

---

## [1.21.0] — 2026-05-14

**Pulido de seguridad + concurrencia + accesibilidad procedente de dos pases independientes de revisión de código.** Siete hallazgos del documento [`docs/specs/V1.20.1-BACKLOG.md`](docs/specs/V1.20.1-BACKLOG.md) se entregan en una sola versión: un bloqueante (TOCTOU de DNS-rebind), seis errores de severidad alta (dispersión del saneamiento de *path traversal*, hueco de *rate-limit* en despliegues LAN, condición de carrera de escritura, agujero de cobertura i18n, `aria-describedby` huérfano, asociaciones de etiqueta ausentes). 34 pruebas nuevas; la línea base sube de 427 → 461 *unit* + 32/32 Playwright. Cada *fix* aterriza tras una prueba de regresión con nombre.

### 🛡️ Seguridad

- **`fix(security): B-1 — cerrar el TOCTOU de DNS-rebind con safe-fetch.mjs`** ([`server/lib/safe-fetch.mjs`](server/lib/safe-fetch.mjs)) — el patrón previo hacía un `dnsLookup` explícito para validar y luego dejaba que `fetch()` resolviera por su cuenta. Un atacante de *DNS rebind* con TTL=0 podía devolver una IP pública en la búsqueda 1 y `127.0.0.1` / `169.254.169.254` / una dirección LAN en la búsqueda 2, sorteando `isPrivateOrLoopbackHost`. El nuevo `safeGet` resuelve UNA vez, fija la conexión TCP a esa IP exacta vía node:http(s), y configura SNI/Host para que la validación del certificado siga apuntando al *hostname* original. Lo usan `/api/pipeline/preview` y `/api/auto-pipeline`. Fallo CERRADO ante un error de búsqueda (invierte el anterior `try { … } catch { /* fall through */ }`). Validado por 8 pruebas nuevas en [`tests/ssrf-redirect-rebind.test.mjs`](tests/ssrf-redirect-rebind.test.mjs).

- **`fix(security): H-4 — consolidar sanitizePathName a través de 10 rutas`** ([`server/lib/security.mjs`](server/lib/security.mjs)) — la regex `replace(/[^\w\-.]/g, '')` estaba duplicada a lo largo de `jds.mjs`, `content.mjs`, `reports.mjs`, `llm.mjs`, `runners.mjs` y conservaba los caracteres `.`, de modo que `..pdf`, `....md` y los nombres con punto inicial sobrevivían. Sólo `reports.mjs::sanitizeSlug` lo hacía bien. v1.21.0 eleva la versión correcta (`sanitizePathName`) a `security.mjs`, elimina 10 copias rotas y rechaza con 400 los resultados vacíos. Validado por 12 pruebas en [`tests/path-traversal.test.mjs`](tests/path-traversal.test.mjs).

- **`fix(security): H-5 — limitar la tasa en los *endpoints* LLM con bind público`** ([`server/lib/rate-limit.mjs`](server/lib/rate-limit.mjs)) — `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, `/api/auto-pipeline` no tenían antes un *throttle* por IP. Los usuarios *loopback* no se ven afectados; los despliegues expuestos a LAN (`HOST=0.0.0.0`) reciben 10 req/min/IP con cabeceras `Retry-After` y `X-RateLimit-*` al rebosar. Configurable mediante `LLM_RATE_LIMIT="N/Ws"`. Defensa interina barata antes de la puerta de autenticación P-12 de v2.0. Validado por 6 pruebas en [`tests/rate-limit.test.mjs`](tests/rate-limit.test.mjs).

### 🔒 Concurrencia

- **`fix(data): H-6 — mutex por fichero en applications.md / pipeline.md`** ([`server/lib/file-lock.mjs`](server/lib/file-lock.mjs)) — un `POST /api/tracker` concurrente (o el *auto-pipeline* compitiendo contra un alta manual) leía `num=42` por ambos lados, escribía `num=43` por ambos lados y descartaba en silencio la fila más antigua. `withFileLock(path, fn)` serializa el ciclo leer-modificar-escribir por ruta; las rutas independientes siguen ejecutándose en paralelo. Cableado en `tracker.mjs`, `pipeline.mjs` (POST + DELETE) y en el paso *tracker* de `auto-pipeline.mjs`. Validado por 5 pruebas en [`tests/concurrent-tracker-write.test.mjs`](tests/concurrent-tracker-write.test.mjs), incluida una de integración con 20 POSTs concurrentes que comprueba que las filas 001..020 aterrizan en orden.

### ♿ Accesibilidad

- **`fix(a11y): H-1 — id="batch-tsv-hint" en el párrafo de pista de batch.js`** ([`public/js/views/batch.js`](public/js/views/batch.js)) — v1.20.0 añadió `aria-describedby="batch-tsv-hint"` al *textarea* TSV pero nunca dotó al `<p>` de pista de un `id` coincidente. Los lectores de pantalla no tenían nada que vocalizar. Corregido.

- **`fix(a11y): H-2 — htmlFor en las etiquetas batch-parallel / batch-min-score`** ([`public/js/views/batch.js`](public/js/views/batch.js)) — cuatro *inputs* de v1.20.0 recibieron *ids* nuevos pero sus etiquetas no estaban asociadas programáticamente. WCAG 3.3.2 queda ahora satisfecho.

- Nuevo canario de análisis estático en [`tests/a11y-form-wires.test.mjs`](tests/a11y-form-wires.test.mjs) — recorre cada fichero de vista y comprueba que cada IDREF de `aria-describedby` / `htmlFor` apunta a un `id:` hermano. Detecta regresiones tipo-errata en tiempo de CI.

### 🌐 i18n

- **`fix(i18n): H-3 — 13 claves de v1.20.0 caían en silencio al inglés en 7 *locales*`** ([`public/js/lib/i18n.js`](public/js/lib/i18n.js)) — `pipe.filter`, `pipe.count`, `pipe.preview*`, `pipe.openTab`, `pipe.evaluateAll*`, `eval.jdHint`, `batch.parallelAria`, `batch.minScoreAria`, además de `common.delete`, `config.group{Core,Runtime,Regional}`, `config.profileEmpty`, `config.viewProfile`, `scan.atsBadge`, `scan.regionalBadge` se referenciaban con `t('key', 'EN fallback')` pero nunca se añadieron a DICT. Los usuarios de lector de pantalla en ruso, japonés y chino oían `aria-label` en inglés — anulando directamente la conquista WCAG 3.3.2 que reclamaba v1.20.0. v1.21.0 añade las 19 claves × 8 *locales* (≈ 150 traducciones nuevas) y extiende [`tests/i18n-coverage.test.mjs`](tests/i18n-coverage.test.mjs) con un pase de análisis estático que escanea cada llamada `t('key', …)` en `public/js/**/*.js` y comprueba que cada clave existe en DICT. La deriva futura queda detectada en tiempo de CI.

### 🧪 Tests

- **427 → 461 *unit*** (+34) + 32/32 Playwright sin cambios.
- Ficheros nuevos: `ssrf-redirect-rebind`, `path-traversal`, `concurrent-tracker-write`, `rate-limit`, `a11y-form-wires`.
- `pipeline-preview.test.mjs` recableado desde el *mock* `globalThis.fetch` al nuevo punto de inyección `_setTransport` de `safe-fetch.mjs` — la ruta SSRF ya no pasa por *fetch*, así que el *mock* viejo era sorteado en silencio.

### Verificación

```bash
npm test                              # 461 / 461
npm run test:e2e:browser              # 32 / 32
node --test tests/ssrf-redirect-rebind.test.mjs tests/path-traversal.test.mjs \
  tests/concurrent-tracker-write.test.mjs tests/rate-limit.test.mjs \
  tests/a11y-form-wires.test.mjs      # 34 pruebas nuevas, todas verdes

# Path-traversal: cada :name al estilo traversal devuelve 400 / 404
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/jds/..pdf
# → 400

# Rate-limit con bind público:
HOST=0.0.0.0 LLM_RATE_LIMIT=3/60s npm start &
for i in 1 2 3 4; do
  curl -sS -o /dev/null -w '%{http_code} ' -X POST -H 'Content-Type: application/json' \
    -d '{"jd":"…"}' http://0.0.0.0:4317/api/evaluate
done
# → 200 200 200 429

# Escrituras concurrentes al tracker: 20 POSTs paralelos, 20 filas aterrizan:
node tests/concurrent-tracker-write.test.mjs
# 20 filas secuenciales 001..020

# Cordura del cableado aria:
grep -r 'aria-describedby' public/js/views/ | wc -l
# todas las búsquedas `id:` correspondientes resuelven (canario a11y-form-wires.test.mjs)
```

### Fuera de alcance (v1.22+)

| Ítem | Notas |
|---|---|
| Tope por *streaming* del cuerpo en `pipeline-preview` (M-2) | `await upstream.text()` lee el cuerpo entero antes del corte a 8 KB; un *stream* malicioso de 1 GB podría agotar la memoria. Lectura por *stream* con contador de bytes y *abort*. |
| WCAG 1.4.1 — estado sólo-color en `.connection-banner` y píldoras de puntuación (M-3) | El tono por sí solo señala el estado; añadir prefijo de icono (✓ / ◐ / ○) o sufijo de texto. |
| Sorteos de `stripDangerousMarkdown` vía entidades HTML (M-4) | `&lt;script&gt;`, `java&#115;cript:`, `<img src="data:image/svg+xml,<svg onload=…>">` sobreviven a la regex. La defensa en profundidad vía `UI.md` aguanta; documentar y fijar los sorteos en una pasada de pruebas. |
| Acceso a `localStorage` en modo privado de Safari sin try/catch (M-5) | `i18n.js:544/571` lanza → el SPA renderiza claves en bruto. Envolver en try/catch con `'en'` por defecto. |
| `setInterval(checkHealth, 3000)` *poll* sin *backoff* (M-6) | Exponencial 3s → 6s → 12s → tope 60s. |
| Falta de guarda para *null* en el alias `htmlFor` (M-7) | Defensa de una línea `if (v != null && v !== false)`. |
| Canario 404 para `/api/scan-ru/config` retirado (M-8) | Prueba de tres líneas siguiendo el precedente de v1.18. |
| Traducciones del cuerpo del CHANGELOG por *locale* (M-9) | Candidato a traducción masiva cuando se ralentice la cadencia de versiones. |
| Párrafos de pista en línea para cada campo de *mode-page* (M-1) | ~168 claves i18n × 8 *locales*; reservado como pulido. |
| Pequeñeces L-1 a L-5 | Radix de parseInt, bash --noprofile, fileURLToPath seguro en Windows, SSE multilínea, limpieza del temporizador de scan.js. |

---

## [1.20.0] — 2026-05-13

**Pulido de accesibilidad por componente + paridad de README no inglés + retirada del alias `/api/scan-ru/config`.** Cierra los cuatro ítems que la tabla "Fuera de alcance" de v1.19.0 marcó para v1.20.

### ♿ WCAG 2.5.5 / 2.5.8 — auditoría de objetivo táctil por componente

- **`a11y(touch-target): chip min-height 28 px + 8 px de gap (excepción 2.5.8 spaced-target)`** — `.chip` era 24 × ~50 px (la vertical caía a 24, por debajo del piso 24 px de 2.5.5 para controles agrupados); la excepción *spaced-target* de 2.5.8 exige o bien ≥ 24 × 24 px, o bien 24 px de separación. Se elevó `.chip` a `min-height: 28px; padding: 6px 12px;` y la fila contenedora `.chip-row` a `gap: 8px;` para que ambas condiciones se cumplan.
- **`a11y(touch-target): sidebar nav-item min-height 44 px`** — `.nav-item` sólo añadía `10px 14px` de relleno, con altura calculada ~36 px en la mayoría de *viewports*. Ahora `padding: 12px 14px; min-height: 44px; box-sizing: border-box;`. Coincide con el piso de `.btn`.
- **`a11y(touch-target): tab-btn min-height 44 px`** — mismo tratamiento para *Sortable Headers* / pestañas de categoría en Reports, Tracker y resultados de Scan.

### ♿ WCAG 1.3.1 / 3.3.2 — `aria-describedby` en pistas en línea

Cada control de formulario del SPA dispone ahora de un `id` estable, su `<label>` lo apunta vía `htmlFor`, y todo párrafo de pista en línea se asocia mediante `aria-describedby`. Cinco ficheros de vista han sido recableados:

- **`a11y(forms): config.js`** — `id` por clave + asociación de pista (`cfg-<key>` / `cfg-<key>-hint`).
- **`a11y(forms): evaluate.js`** — *textarea* `eval-jd` + párrafo `eval-jd-hint` que documenta el mínimo de 50 caracteres tras el saneamiento.
- **`a11y(forms): batch.js`** — `batch-tsv` / `batch-tsv-hint`, más `aria-label` en `batch-parallel`, `batch-min-score`, `batch-dry-run`, `batch-retry`.
- **`a11y(forms): pipeline.js`** — `pipe-filter` + `pipe-new-url` / `pipe-new-url-hint`.
- **`a11y(forms): mode-page.js`** — cada campo a lo largo de los 7 *modes* genéricos (`project`, `training`, `followup`, `batch-prompt`, `contacto`, `interview-prep`, `patterns`) obtiene *ids* `mode-<slug>-<name>` y etiquetas con `htmlFor`.

`UI.el()` aprende un alias `htmlFor` al estilo React para que el código de vista permanezca declarativo — establece el atributo subyacente `for` (que está reservado en JS como nombre de propiedad).

### 🌍 Paridad de README no inglés

- **`docs(readme): traducir 7 locales a la paridad de 585 líneas con el maestro EN`** — `README.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` ocupaban entre 306 y 316 líneas (cubrían titulares pero saltaban los recorridos *marketing* y la mayor parte de la referencia de API). Los siete reflejan ahora la estructura EN extremo a extremo: About → instalación de un comando → Why? → Quick start (3 pasos numerados) → Requirements → tabla What you get → Scan → Architecture (árbol de directorios completo) → referencia de API (cada tabla de rutas) → Tests → Configuration → Security notes → Limitations → Contributing → recorrido 🌍 Getting Started de 5 pasos → License.

### 🧹 Alias `/api/scan-ru/config` retirado

- **`feat!(scan): remove /api/scan-ru/config legacy alias (sunset v1.20)`** — conservado como alias de una versión en v1.19 por compatibilidad hacia atrás. El canónico `/api/scan/regional/config` es ahora la única ruta. Eliminados: registro de ruta en `server/lib/routes/scan.mjs`, referencias en `README.md`, `docs/architecture/{OVERVIEW,SERVER,API}.md`. Las pruebas ya cubrían la ruta canónica — sin cambios de prueba.

### 🧪 Tests

- Misma suite que v1.19. **427 / 427** *unit* + 20/20 smoke + 23/23 *comprehensive* + 32/32 Playwright. Todo el cableado de accesibilidad es aditivo (más atributos `id` / `for` / `aria-describedby`) — sin cambios de comportamiento, sin *deltas* de prueba.

### Verificación

```bash
npm test                              # 427 / 427
npm run test:e2e:browser              # 32 / 32

# Objetivos táctiles — cada chip / nav-item / tab-btn ≥ 28 / 44 / 44 px:
#   Chrome DevTools → Computed → height/min-height en .chip, .nav-item, .tab-btn

# Etiquetas de formulario — cada input tiene una asociación label[for=…]:
#   document.querySelectorAll('input,textarea,select').forEach(el =>
#     console.assert(el.labels?.length || el.getAttribute('aria-label'), el))

# Alias desaparecido:
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/scan-ru/config
# → 404

# Canónico sigue funcionando:
curl -s http://127.0.0.1:4317/api/scan/regional/config | jq '.'
```

### Cambios incompatibles

- `DELETE /api/scan-ru/config` — eliminado. Usa `/api/scan/regional/config`. Se anunció el *sunset* en el CHANGELOG de v1.19.0 y en su *script* de verificación.

### Fuera de alcance (v1.21+)

| Ítem | Notas |
|---|---|
| Párrafos de pista en línea por cada campo de *mode-page* | Hoy sólo la asociación `<label for=…>` está en su sitio; el texto de pista visible por campo sigue en inglés en el SPA. Los recorridos del README documentan la intención del campo en cada *locale*, así que esto es pulido, no bloqueante. |
| Estado por sólo-color en `.connection-banner` y píldoras de puntuación del *dashboard* (WCAG 1.4.1) | El banner depende de rojo/ámbar/verde; necesita icono o sufijo de texto para quien no percibe el tono. |
| Traducción del cuerpo del CHANGELOG por *locale* | Provisionales con cuerpo inglés persisten en `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md`. La traducción se hará cuando se ralentice la cadencia v1.x. |

---

## [1.19.0] — 2026-05-13

**Contraste WCAG 1.4.3 + unificación del *scan* (final) + retirada de HH_USER_AGENT de la UI.** Cierra la auditoría de contraste fuera de alcance de v1.18, finaliza la eliminación del *split* EN/RU iniciada en v1.18, y retira el control de configuración `HH_USER_AGENT` de la UI por indicación del usuario (un valor por defecto razonable ya viene incrustado en el servidor para IPs no rusas, que cubre a la mayoría).

### ♿ Pase de contraste WCAG 1.4.3

- **`a11y(contrast): introduce AA-passing *-text variants for accent tokens`** — tema claro: `--rausch-text: #b80f42` (6,59:1 sobre blanco, antes 3,52:1), `--kazan-text: #066507` (7,31:1, antes 4,53:1), `--darjeeling-text: #7a5800` (5,73:1 sobre fondo ámbar, antes 4,24:1), `--babu-text: #00665e` (6,09:1, antes 2,70:1). Tema oscuro: espejos aclarados (`#ff8aa0`, `#6ee7b7`, `#fcd34d`, `#5eead4`) alcanzan el mismo piso 4,5:1 sobre papel `#161a22`.
- Las clases de *badge* (`.badge-ok`, `.badge-warn`, `.badge-bad`, `.badge-info`) y las píldoras de puntuación (`.score-high`, `.score-mid`, `.score-low`) se enrutan ahora por las nuevas variantes `*-text` — cada combinación texto-sobre-fondo-tintado pasa AA. Los tokens de relleno de acento (`--rausch`, `--kazan`, etc.) no varían para bordes y contornos (que sólo necesitan 3:1 al ser componentes UI no textuales).

### 🧹 Unificación del *scan* (cierra el trabajo de v1.18)

- **`docs(scan): scrub remaining EN/RU split references across READMEs + help + architecture docs`** — ocho READMEs + ocho *help bundles* + tres documentos de arquitectura (API.md, SERVER.md, OVERVIEW.md, DATA-FLOWS.md) + un comentario en scan.js describen ahora un único método de *scan* consolidado. Los alias legacy `/api/stream/scan-{en,ru}` ya habían desaparecido en v1.18; v1.19 atrapa la documentación y la copia que todavía enmarcaba el *scan* como un proceso EN+RU en dos pasos.
- **`feat(scan): canonical /api/scan/regional/config endpoint`** — `/api/scan-ru/config` se conserva como alias delgado durante una versión por compatibilidad. La nueva ruta sigue la convención de nomenclatura por origen (`?source=regional`).

### 🛠️ HH_USER_AGENT retirado de la UI

- **`feat!(config): drop HH_USER_AGENT field from /#/config + KNOWN_KEYS`** — los usuarios avanzados pueden seguir fijando `HH_USER_AGENT` directamente en `career-ops/.env` (el servidor lo lee mediante `process.env.HH_USER_AGENT` en `server/lib/sources/hh.mjs` con el UA incrustado como respaldo). La UI deja de exponerlo porque el valor por defecto funciona para la mayoría y ver un campo *User-Agent* indescifrable en la página de App Settings era una fuente recurrente de confusión.
- Las menciones en los README de 8 *locales* + las menciones en el *help bundle* de 8 *locales* se reemplazan por el consejo "ejecuta vía una IP rusa / VPN". La clave i18n `scan.hhWarning` se reformula para descartar el detalle de configuración de la variable de entorno.
- `KEY_GROUPS` se colapsa: ya no hay clasificación `regional` (sólo contenía HH_USER_AGENT). Pruebas actualizadas; el campo `regionalActive` del *payload* se conserva por compatibilidad hacia atrás del SPA.

### 🧪 Tests

- `tests/env-config.test.mjs` — la aserción `KNOWN_KEYS` ya excluye HH_USER_AGENT; nueva aserción que la clave está deliberadamente ausente.
- `tests/config-endpoint.test.mjs` — la prueba multi-clave POST-write usa `GEMINI_MODEL` como segunda clave conocida en lugar de HH_USER_AGENT.
- `tests/config-groups.test.mjs` — `groups.HH_USER_AGENT` se espera ahora `undefined`.
- Total: **427 / 427** *unit* + 20/20 smoke E2E + 23/23 *comprehensive* E2E + 32/32 Playwright. Mismos conteos que v1.18.0 porque cada prueba ajustada ya estaba contada.

### Verificación

```bash
npm test                              # 427 / 427

# Contraste (Chrome DevTools o axe) en claro + oscuro:
#   .badge-ok / .badge-warn / .badge-bad / .badge-info → AA pass (4,5:1+)
#   .score-high / .score-mid / .score-low → AA pass

# HH_USER_AGENT ya no aparece en /api/config:
curl -s http://127.0.0.1:4317/api/config | jq '.values | keys'
# → ["ANTHROPIC_API_KEY","ANTHROPIC_MODEL","GEMINI_API_KEY","GEMINI_MODEL","HOST","PORT"]
# (sin HH_USER_AGENT)

# Endpoint canónico de configuración regional:
curl -s http://127.0.0.1:4317/api/scan/regional/config | jq '.'
# Alias legacy todavía vivo hasta v1.20:
curl -s http://127.0.0.1:4317/api/scan-ru/config | jq '.'
```

### Fuera de alcance (v1.20+)

| Ítem | Notas |
|---|---|
| Auditoría de objetivo táctil por componente (chips de filtro, cabeceras ordenables, *nav* lateral) | v1.18 fijó el piso global (`.btn` 44 px, `.btn-sm` 32 px); la verificación por componente a lo largo del SPA queda pendiente. |
| `aria-describedby` en pistas de formulario en línea (`#/config`, `#/pipeline`, `#/evaluate`, `#/batch`) | v1.17 cubrió `aria-label` en la búsqueda global y el cierre de modal. La asociación de pista por *input* es la siguiente capa de pulido. |
| Paridad total de README no inglés (585 líneas como EN) | v1.18 llevó los no ingleses a ~307 (53 % del EN). Los recorridos "Quick start" y "🌍 Getting Started" *marketing-heavy* siguen sólo en inglés. |
| Retirar el alias legacy `/api/scan-ru/config` | *Sunset* planificado para v1.20. El canónico `/api/scan/regional/config` es el destino de migración. |

---

## [1.18.0] — 2026-05-13

**Consolidación del endpoint scan + paso WCAG 2.2 AA + finalización i18n long-tail.** Retira los aliases legacy `/api/stream/scan-{en,ru}` (ventana *Sunset* 2026-10-01 adelantada a v1.18 por dirección del usuario). Lleva los READMEs no ingleses a ~307 líneas y traduce las entradas CHANGELOG v1.16.0 + v1.17.0 RU-bodied restantes en 6 *locales*.

### 🚪 Breaking

- **`feat!(scan): retire legacy /api/stream/scan-{en,ru} aliases`** — los *endpoints* SSE *split* EN/RU deprecados desaparecen. Cada consumidor pasa por el *endpoint* consolidado `/api/stream/scan?source=ats|regional|both` (vivo desde v1.12.0). Las rutas legacy llevaban cabeceras *Deprecation* + *Sunset* (RFC 8594) desde v1.15.0; la ventana de migración está cerrada. Las integraciones externas en las rutas antiguas reciben un **404** limpio en vez de ser enrutadas silenciosamente al *catch-all* del SPA.

### ♿ Accesibilidad (paso WCAG 2.2 AA)

- **WCAG 2.4.1 *Bypass Blocks*** — nuevo enlace **Skip to main content** como primer enfocable en cada página. Visualmente oculto vía `.skip-link` hasta recibir foco, se ancla en la esquina superior izquierda al pulsar Tab desde la carga.
- **WCAG 2.4.7 *Focus Visible*** — estilo global `*:focus-visible`. Anillos de foco *off* en clics de ratón, *on* en Tab desde teclado (patrón estándar WAI-ARIA AP). El cierre del modal (×) recibe un anillo de foco de mayor contraste.
- **WCAG 2.5.5 *Target Size*** — objetivo táctil mínimo 44×44 px en `.skip-link`. `.btn-sm` mantiene `min-height: 32px` (combinado con el espaciado de fila cumple la excepción AAA 24×24 + *spacing* para controles compactos en filas de tabla).
- **WCAG 3.1.1 *Language of Page*** — `<html lang="en">` corregido desde `lang="ru"`. El *bootstrap* JS i18n ya sobrescribía esto en carga, pero el *default* SSR coincide ahora con el *locale* por defecto del SPA.
- **WCAG 1.3.1 *Info & Relationships*** — `#content` recibe `tabindex="-1"` para que el destino del *skip-link* reciba foco limpiamente. (Los roles ARIA + *focus-trap* ya estaban en v1.17.)

### 📚 i18n long-tail

- **`docs(i18n): CHANGELOG v1.16.0 + v1.17.0 traducidos en 6 locales`** — las entradas antes con cuerpo en ruso en `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` están ahora en su idioma nativo. El conteo de caracteres rusos por *locale* cayó 79 → 42 → 23.
- **`docs(readme): expandir READMEs no ingleses con Why / Requirements / Features / Configuration / Contributing`** — cada README no inglés creció de 240 → ~307 líneas. Cubre ahora las mismas secciones no *marketing* que el EN de 585 líneas.

### 🧪 Tests

- Total: **427 / 427** *unit* + 20/20 smoke E2E + 23/23 *comprehensive* E2E + 32/32 Playwright (conteo sin cambios; +2 nuevas aserciones correctas de retirada legacy reemplazan las +2 aserciones legacy-still-works).

---

## [1.17.0] — 2026-05-13

**Pulido + accesibilidad + *fix* de CI.** Cierra 9 *follow-ups* del REVIEW de v1.16.0: verificación de humo en navegador, *badge truth* en READMEs, refresco de cobertura, *chip* 🔒 `lastWorkdayFallback` en el SPA, re-*baseline* E2E completo tras el cambio UX de v1.16, escenarios Playwright para *auto-pipeline*, pase de accesibilidad ARIA + *focus trap*, condensación del CHANGELOG histórico en 6 *locales*, expansión de los READMEs no ingleses con secciones de referencia.

### 🐛 Fixes

- **`fix(e2e): smoke + comprehensive re-alineados con UX de v1.16`** — el cambio de v1.16 Cmd+K Enter → modal *AutoPipeline* hizo que `search.press('Enter')` en los tests E2E abriera un modal que interceptaba los clics siguientes. Los tests usan ahora `Shift+Enter` para el camino legacy *quick-add*. **Este era el fallo de CI en el push de v1.16.0** — Playwright E2E expiraba a los 30 s en clics interceptados por el *backdrop*.
- **`fix(mode-page): /#/batch-prompt → modes/batch.md vía serverSlug`** — v1.15 renombró el *slug* legacy a `batch-prompt`, pero `POST /api/mode/:slug` en el servidor buscaba `modes/batch-prompt.md`, que no existe. El nuevo campo `serverSlug` desacopla el *hash* de ruta del nombre de fichero del *mode* del padre.
- **`chore: bump de mensajes de deprecación de v1.16.0 → v1.17.0`** — la copia de deprecación de `scan-en`/`scan-ru` y el banner de `batch-prompt` referenciaban la versión pasada.

### ✨ Features

- **`feat(scan): chip 🔒 Workday CAPTCHA en card Active Companies`** — el *export* server-side `lastWorkdayFallback` de v1.16 PR-7 lo consume ahora el SPA. `/api/scan-results` devuelve la instantánea; `#/scan` renderiza una tarjeta tintada de aviso sobre *Active Companies* cuando un *tenant* Workday cayó al respaldo ("🔒 Workday tenant blocked — fallback: usa /career-ops scan (Playwright)"). El nuevo `getLastWorkdayFallback()` evita la ambigüedad de *live-binding* en ESM. 2 nuevas claves i18n × 8 *locales*.

### ♿ Accesibilidad

- **`a11y: pase de roles ARIA + gestión de foco`** —
  - `index.html`: atributos `role` en `<aside>` (*navigation*), `<header>` (*banner*), `<section id="content">` (*main*), `<div id="modal">` (*dialog* con `aria-modal`/`aria-labelledby`), `<div id="toast">` + `#conn-banner` (*status* con `aria-live`), `<div class="searchbar">` (*search*).
  - `#sidebar-toggle` recibe `aria-controls="sidebar"` + `aria-expanded` sincronizado por JS al abrir/cerrar.
  - `#global-search` obtiene un `<label>` *visually-hidden* más un `aria-label` explícito que aflora la pista del atajo Cmd+K.
  - El cierre del modal (×) recibe `aria-label="Close dialog"`.
  - Los *backdrops* decorativos reciben `aria-hidden="true"`.
  - **Focus trap en modal** — `UI.modal()` recuerda el propietario del clic, enfoca el primer enfocable no *close* al abrir, y cicla Tab/Shift+Tab dentro del modal. `UI.closeModal()` restaura el foco al propietario previo.
  - Nueva clase de utilidad `.visually-hidden` en `public/css/app.css` (patrón estándar WAI-ARIA AP).

### 📚 Documentación

- **`docs(readme): badge truth a través de 8 READMEs`** — *badge* de pruebas `284 / 379 / 360` → **427**; *badge* de versión `v1.9.1 / v1.13.0` → **v1.16.0**, luego → v1.17.0 vía el *bump* de v1.17. Destinos de los enlaces de versión actualizados.
- **`docs(readme): expandir 7 READMEs no ingleses con secciones de referencia`** — cada uno creció de 170 a ~240 líneas con nuevas secciones *Architecture* / *API reference* / *Security notes* / *Tests* / *A11y* / *Limitations* / *License* en el idioma nativo. Todavía no en paridad completa de 585 líneas con EN, pero cubre todas las superficies no *marketing* clave.
- **`docs(changelog): condensar entradas pre-v1.12 en 6 locales`** — las entradas largas con cuerpo en ruso de v1.11.x + v1.10.x que sangraban en los CHANGELOG no-EN/no-RU se reemplazan ahora por un resumen ejecutivo compacto "*Earlier releases*" en el idioma nativo de cada *locale*. La historia detallada queda en `CHANGELOG.md` (EN).

### 🛠️ Tooling

- **`coverage: refresh de números`** — el último publicado fue 95,46 % de líneas / 84,06 % de ramas (REVIEW v1.13.0). Línea base v1.17: **94,14 % líneas / 82,98 % ramas / 93,20 % funciones**. Caída ligera por nuevas rutas de error en *auto-pipeline* + *reports-write*; muy por encima aún del piso de 80 % en CLAUDE.md.

### 🧪 Tests

- Total: **427 / 427** *unit* + 20/20 smoke E2E + 23/23 *comprehensive* E2E + **32 / 32** Playwright (era 28; +4 escenarios nuevos de *auto-pipeline*: botón abre modal, Cmd+K *paste* dispara modal, URL inválida cierra el paso 1, encuadre de eventos SSE `POST /api/auto-pipeline`).
- Suite E2E re-alineada con UX de v1.16.0 (Shift+Enter *quick-add*, /#/batch-prompt para el *mode* legacy).

### Fuera de alcance (v1.18+)

| Ítem | Notas |
|---|---|
| Traducir la entrada v1.16.0 en los CHANGELOG no ingleses | Actualmente con cuerpo en ruso (~30 líneas × 6 *locales* = 180 líneas). Quedó fuera del alcance explícito v1.11.x/v1.10.x del usuario. |
| Paridad completa de README no inglés (585 líneas como EN) | v1.17 llevó los no ingleses a ~240; los recorridos "Why?" / "Quick start" *marketing-heavy* permanecen sólo en inglés. |
| Auditoría completa WCAG 2.2 AA | v1.17 cubrió ARIA estructural + *focus trap*; la auditoría por componente de contraste/orden de Tab queda pendiente. |

---

## [1.16.0] — 2026-05-13

**Finalización del auto-pipeline + pulido de adaptadores + i18n long-tail.** Cierra los 11 *follow-ups* del REVIEW de v1.15.0: SSE *auto-pipeline* en el servidor, primitiva `POST /api/reports`, atajo Cmd+K, paginación de SmartRecruiters, respaldo CAPTCHA de Workday, puerta de CI para *drift* de capturas, UX del filtro de origen en *scan*, traducción del CHANGELOG histórico (v1.13.0/v1.12.0 × 6 *locales*), expansión de los READMEs no ingleses, importador *paste-ready* de empresas en tendencia.

### ✨ Features

- **`feat(auto-pipeline): orquestador SSE server-side`** (#1, #2, #3, #8) — el orquestador *client-side chained-fetch* de v1.15 se elimina. `POST /api/auto-pipeline` es ahora un *endpoint* SSE *curl-able* que ejecuta validar → traer JD → evaluar → guardar informe → tracker en el servidor con eventos por paso en tiempo real. La llamada lenta a Anthropic (30–90 s) emite ahora eventos `running` en vez de un *spinner* genérico. Los fallos emiten `error` con `step` + `message`. El orquestador también persiste el *markdown* del informe en `reports/<slug>.md` del padre (se perdía en v1.15).
- **`feat(reports): primitiva POST /api/reports`** — nuevo *writer* en `server/lib/routes/reports.mjs`. Saneamiento de *slug* con guarda contra *path traversal*. Tope de 1 MB (413). 409 si el fichero existe sin `overwrite:true`. Escritura atómica a través de `stripDangerousMarkdown`. Registro de actividad `activity.reports.save`. Pruebas: 9 casos.
- **`feat(app): Cmd+K paste URL → auto-pipeline`** — pegar una URL en la búsqueda global + Enter abre el modal *AutoPipeline* con `autoStart=true`. Shift+Enter preserva el camino legacy "*add to pipeline only*".
- **`feat(portals): paginación SmartRecruiters`** (#4) — `server/lib/sources/smartrecruiters.mjs` recorre páginas mediante `?limit=100&offset=N` hasta alcanzar `totalFound`, O página vacía, O tope de seguridad de 30 páginas / 3000 *jobs*. Boards grandes (Procter & Gamble) ya no pierden el resto de sus publicaciones. Pruebas: 6 casos.
- **`feat(portals): respaldo CAPTCHA de Workday elegante`** (#7) — `server/lib/sources/workday.mjs` deja de lanzar en 4xx / no-JSON / errores de red. Devuelve `[]` y anota el nuevo *export* `lastWorkdayFallback`. La línea de tiempo del *scanner* continúa con el siguiente *tenant*. *Opt-in* al *throw* de v1.14 vía `strict:true`. Pruebas: 7 casos.

### 🛠️ Tooling + CI

- **`ci(workflows): puerta de drift de dashboard-screenshots`** (#5) — nuevo `.github/workflows/dashboard-screenshots.yml`. En PRs que tocan `public/css/app.css`, `public/js/views/dashboard.js`, `public/js/lib/i18n.js` o `public/index.html`, el *workflow* arranca el servidor contra un andamiaje en /tmp, regenera los 8 PNG *hero* vía Playwright + chromium, y falla la *build* si el resultado deriva del *committed*.
- **`feat(scripts): import-trending-companies.mjs`** (#11) — verifica las 13 empresas en tendencia de `docs/portals-examples.md` vía su API de *boards* real y emite YAML pegable para el `portals.yml::tracked_companies` del padre. `enabled: false` se estampa en candidatos cuyo *slug* devuelve 404. Se ejecuta con `npm run import:trending`.
- **`feat(scripts): npm run capture:dashboards`** — expone `scripts/capture-dashboard-screenshots.mjs` como *script* de primer nivel.

### 🎨 UX

- **`fix(scan): dropdown de filtro source consolidado`** (#6) — el desplegable de origen en `#/scan` reconstruido a partir del *registry* de adaptadores de v1.14: 6 ATSes + hh.ru + Habr Career, alfabético, sin prefijos geográficos. `runEnScan`/`runRuScan` apuntan ahora al *endpoint* consolidado `/api/stream/scan?source={ats,regional}`.

### 📚 i18n long-tail

- **`docs(i18n): traducir CHANGELOG v1.13.0 + v1.12.0 en 6 locales`** (#9) — entradas antes con cuerpo en ruso en `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` ahora en su *locale* real. Cada CHANGELOG no-EN/no-RU recibe además una nota i18n explicando que las entradas pre-v1.12 permanecen en ruso por convención del proyecto.
- **`docs: expandir READMEs no ingleses con sección de destacados v1.16.0`** (#10) — 6 READMEs no ingleses (es / pt-BR / ko-KR / ja / ru / zh-CN / zh-TW) reciben una nueva sección de ~35 líneas que cubre: flujo de un clic *auto-pipeline* + ejemplo curl, paginación de SmartRecruiters, respaldo de Workday, UX del filtro de origen en *scan*, *script* importador y *workflow* CI de capturas.

### 🧪 Tests

- Nuevo `tests/reports-write.test.mjs` (9 casos) — camino feliz, saneamiento de *slug* (incl. guarda contra *path traversal*), conflicto 409, *flag* *overwrite*, *strip* XSS, 400 con campos faltantes, 413 con >1 MB, *round-trip* GET/POST.
- Nuevo `tests/auto-pipeline.test.mjs` (5 casos) — encuadre SSE, puerta de URL inválida, puerta SSRF/*loopback*, ruta de error sin clave LLM, cabecera `Content-Type: text/event-stream`.
- Nuevo `tests/smartrecruiters-pagination.test.mjs` (6 casos) — *single page*, 3 páginas, *early-stop* por página vacía, tope duro respetado, *query strip*, lanzamiento en 503.
- Nuevo `tests/workday-fallback.test.mjs` (7 casos) — camino feliz, 403/429 elegante, cuerpo no-JSON, error de red, *opt-in* estricto para 4xx y errores de red.
- Total: **427 / 427** *unit* (era 400; +27 netos). 0 fallos. 28/28 Playwright + 23/23 *comprehensive* E2E + 20/20 smoke E2E en verde desde la línea base v1.15.0.

### Fuera de alcance (v1.17+)

| Ítem | Notas |
|---|---|
| Traducir entradas pre-v1.12 del CHANGELOG (v1.11.x, v1.10.x) | Convención preservada: con cuerpo en ruso. El *backport* son ~1800 líneas de traducción; diferido. |
| Paridad completa de README no inglés (585 líneas como EN) | v1.16 añadió ~35 líneas por *locale*; el espejo completo es un pase de traducción aparte. |
| Aflorar `lastWorkdayFallback` en la tarjeta *Active Companies* del SPA | *Export* en servidor cableado; consumo en UI es v1.17. |
| *Bulk add* per-empresa de `tracked_companies` para las 9 en tendencia ya verificadas | El *script* `import:trending` lo hace en 1 comando + 1 pegado. Automatizar escrituras al `portals.yml` del padre violaría la regla dura #1 de CLAUDE.md. |

### Verificación

```
npm test                              # 427 / 427
node -e "import('./server/lib/portals/registry.mjs').then(m => console.log(m.ALL_ADAPTERS.length))"   # → 6

curl -N -X POST http://127.0.0.1:4317/api/auto-pipeline \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/4567"}'

curl -X POST http://127.0.0.1:4317/api/reports \
  -H 'Content-Type: application/json' \
  -d '{"slug":"smoke","markdown":"# smoke
"}'
```

---

## [1.15.0] — 2026-05-13

**Release de conformidad documental.** Cierra 9 de 10 hallazgos abiertos en la auditoría de conformidad (`qa/conformance-vs-docs/00-CONFORMANCE-REPORT.md`) más imágenes *hero* localizadas. Alinea la UI con el flujo canónico de career-ops.org/docs — el mismo pipeline que promete el CLI, ahora extremo a extremo en navegador y en las 8 *locales*.

### ✨ Features

- **`feat(auto-pipeline): PR-C — un clic "pegar URL → informe + PDF + fila de tracker"`** (G-007) — hasta v1.15 el usuario hacía 5 clics manuales por /#/pipeline → /#/evaluate → /#/cv → /#/tracker. Ahora un único botón ✨ en /#/dashboard encadena: validar URL → traer JD (a prueba de SSRF) → evaluar contra el CV → generar PDF → añadir fila al *tracker*. Línea de tiempo modal paso a paso con [✓]/[…]/[✗]. Extracción heurística de empresa/rol. Fichero nuevo: `public/js/lib/auto-pipeline.js`. 19 claves i18n nuevas × 8 *locales*.
- **`feat(modes): PR-D — editor modes/_profile.md como pestaña Modes en #/config`** (G-008) — el fichero canónico "*Career framing*" del Quick Start §Step-5 es ahora visible en la UI. Nuevos *endpoints* `GET/PUT /api/modes/_profile` con tope 256 KB, pase XSS de `stripDangerousMarkdown`, andamiaje desde `_profile.template.md`. 9 claves i18n nuevas × 8 *locales*.
- **`feat(profile): PR-E — esquema canónico + location + headline`** (G-009) — `/api/profile` acepta TANTO el legacy (`candidate:{...}`) COMO el canónico (top-level `full_name`, `narrative.headline`, `target_roles.primary`, `compensation.target_range`). El legacy gana en colisión. Nuevo `summarizeProfile()`. /#/profile muestra `narrative.headline` como nueva tarjeta. 2 claves i18n nuevas × 8 *locales*.
- **`feat(tracker): PR-B — columna Legitimacy en #/tracker`** (G-006) — restaura paridad con la tabla de salida del *pipeline* canónico. Entre Status y PDF, con realce *badge-ok/warn/bad*. Degradación elegante para filas previas a v1.15. 1 clave i18n nueva × 8 *locales*.
- **`fix(routing): PR-H — deduplicar sidebar; #/batch → SPA TSV de v1.13.0`** (G-011) — antes del *fix*, /#/batch aparecía DOS veces en el *sidebar* Y ambas entradas llevaban al constructor de *mode-prompt* legacy. El SPA TSV de v1.13.0 (8 KB) era inaccesible. Duplicado eliminado; el legacy renombrado a `batch-prompt` con banner de deprecación.

### 📚 Documentación

- **`docs(evaluate): PR-A — realineación Block A-F`** (G-005) — career-ops.org/docs usa A–F (Estrategia/Personalización/historias STAR en C/E/F). Emitíamos A–G. v1.15 actualiza los 8 *help bundles* §9 con A–F canónico y un *callout* de compatibilidad hacia atrás. ⚠ Aún se requiere un *commit* en el padre: `santifer/career-ops::modes/oferta.md` debe reescribirse aguas arriba.
- **`docs: PR-F — seniority_boost + search_queries en help §5 × 8 locales + scaffold`** (G-010) — la sección §5 de la ayuda en las 8 *locales* documenta la tercera clave *title-filter* + bloque ejemplo `search_queries`. `bin/setup.sh` siembra `seniority_boost: ["Senior", "Staff", "Lead"]` por defecto.
- **`docs: PR-I — imágenes hero localizadas por locale de README`** — cada uno de los 8 README tiene su `images/dashboard-<locale>.png` específico (HiDPI 1440×900) generado vía `scripts/capture-dashboard-screenshots.mjs`. El viejo `public/images/screen_vacancy_found.png` se elimina.

### 🧹 Limpiezas arrastradas

- **`PR-G — G-001`** i18n `scan.noResults`: 8 cadenas con el literal "EN or RU scan" reemplazadas.
- **`PR-G — G-002`** 📄 *Generate PDF* aflora ahora en los paneles de resultado de `#/interview-prep`.
- **`PR-G — G-003`** `README.cn.md` → `README.zh-CN.md` (etiqueta *locale* canónica).
- **`PR-G — G-004`** `/api/stream/scan-en` + `scan-ru` emiten ahora cabeceras RFC 8594 *Sunset* + *Deprecation* + *Link* (sunset 2026-10-01). Retirada en v1.16.0.

### 🧪 Tests

- Nuevo `tests/profile-canonical-schema.test.mjs` (6 casos).
- Nuevo `tests/modes-profile-crud.test.mjs` (8 casos).
- Corregida una regresión de aislamiento en *fixtures* de prueba: las pruebas usan ahora el patrón `before/after + dynamic-import` para no mutar el `config/profile.yml` del padre.
- Total: **400 / 400** pruebas *unit* (era 386; +14). 0 fallos.

### Fuera de alcance (v1.16+)

| Ítem | Notas |
|---|---|
| *Commit* en el padre para el *prompt* canónico A–F | `santifer/career-ops::modes/oferta.md` debe reescribirse aguas arriba. La regla dura #1 de CLAUDE.md nos prohíbe tocar el padre. |
| `POST /api/auto-pipeline` SSE en el servidor | El orquestador *client-side* aporta la victoria UX; el server-side dará *retry-from-step-N* + ejecutable por curl en CI. |
| Primitiva `POST /api/reports` | *Auto-pipeline* muestra el *markdown* en línea pero no lo persiste en `reports/` del padre. |
| Cmd+K pegar-URL → ejecutar *auto-pipeline* | Diferido a v1.16+. |

---

## [1.14.0] — 2026-05-13

3 nuevos adaptadores ATS sobre el *registry* de v1.13.0, llevando el total de 3 → 6 ATSes soportados (Greenhouse / Ashby / Lever **+ Workable / SmartRecruiters / Workday-beta**). Documentación de cara al usuario actualizada en los 17 archivos de "3 ATSes" a "6 ATSes" en una sola pasada (42 frases): README × 8 *locales*, *help bundle* × 8 *locales*, PROJECT.md. Añadidos bloques YAML listos para pegar de 13 empresas en tendencia en `docs/portals-examples.md` para el `portals.yml` del padre.

### ✨ Features

- **`feat(portals): 3 nuevos ATS — Workable, SmartRecruiters, Workday-beta`** — el *registry* resuelve ahora 6 ATSes (antes 3). Ficheros nuevos: `server/lib/portals/adapters/{workable,smartrecruiters,workday}.mjs` (envoltorios finos con el contrato uniforme) + `server/lib/sources/{workable,smartrecruiters,workday}.mjs` (HTTP crudo + normalización al *shape* canónico).
  - **Workable**: detecta `apply.workable.com/<slug>` Y legacy `<subdomain>.workable.com`. *Endpoint*: `https://apply.workable.com/api/v3/accounts/<slug>/jobs?details=true`.
  - **SmartRecruiters**: detecta `jobs.smartrecruiters.com/<slug>` Y `careers.smartrecruiters.com/<slug>`. *Endpoint*: `https://api.smartrecruiters.com/v1/companies/<slug>/postings`.
  - **Workday (beta)**: detecta `<tenant>.wd<N>.myworkdayjobs.com/<lang>/<site>`. *Endpoint*: POST a `/wday/cxs/<tenant>/<site>/jobs`. `site=External` por defecto si la URL no incluye *site*. Beta porque algunos *tenants* cierran el *feed* CXS con CAPTCHA — el respaldo es el `/career-ops scan` del padre (Playwright).

### 📚 Documentación

- **`docs(portals-examples): bloque de boards en tendencia`** — `docs/portals-examples.md` extendido con la sección v1.14.0 que lista 13 empresas en tendencia como YAML listo para pegar en `tracked_companies`: alojadas en Greenhouse (Stripe, GitLab, HashiCorp, Cloudflare, Datadog, Hugging Face) + alojadas en Ashby (Notion, Linear, PostHog, Replicate, Modal Labs, Fly.io, Render). Todas con `enabled: false` — el usuario verifica el *slug* antes de activar. Bloques de ejemplo adicionales para Workable / SmartRecruiters / Workday.
- **`docs(framing): 42 frases ATS actualizadas en 17 ficheros de cara al usuario`** — cada aparición de "Greenhouse / Ashby / Lever" en documentación de usuario se lee ahora como "Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday". Afectados: README × 8 *locales*, *help bundle* × 8 *locales*, PROJECT.md. Las entradas históricas del CHANGELOG y los documentos prescriptivos de *bug-fix* (`qa/fixes/F-014`, `qa/FIX-PROMPT`) se dejan intactos deliberadamente — describen estado pasado o ya correcto.
- **`docs(qa): escenario 19 del *browser test*`** — `qa/claude-cowork-browser-test-prompt.md` extendido con el escenario 19: invariante `ALL_ADAPTERS.length === 6`, barrido de detección de URL vía `resolveAdapter()` para los 6, comprobación *soft* de la tarjeta *Active Companies* en `#/scan`, comprobación estructural de `docs/portals-examples.md`.

### 🧪 Tests

- `tests/adapter-registry.test.mjs` extendido con 7 casos nuevos para los 3 adaptadores (Workable *apply-URL*, Workable subdominio legacy, SmartRecruiters jobs.* + careers.*, Workday `tenant.wd5.*` con *site* explícito, Workday respaldo a *site* por defecto, invariante `ALL_ADAPTERS.length === 6`, compatibilidad del *shape* legacy `detectApi()`).
- Total: **386 / 386** pruebas *unit* (antes 379; +7 netos). 0 fallos.

### Fuera de alcance

| Ítem | Notas |
|---|---|
| Entradas por empresa para las 13 en tendencia Greenhouse/Ashby | El bloque v1.14.0 de `docs/portals-examples.md` las lista como YAML pegable; el *bulk-add* al `portals.yml` del padre es fase aparte. |
| Automatización del respaldo CAPTCHA de Workday | El adaptador Workday lanza cuando el *feed* CXS está bloqueado; el respaldo planificado delega al `/career-ops scan` del padre (Playwright). El cableado en el UX de *scan* del SPA es para v1.15+. |

---

## [1.13.0] — 2026-05-13

Gran versión. Cierra los 4 ítems diferidos en un solo *commit*: PR-4 (*pipeline multer* completo), *Adapter registry* (continuación arquitectónica de F-018), página SPA *Batch evaluate*, y andamiaje de *mode-template* consciente del *locale*. Más un *fix* a mitad de sesión de tablas en tema oscuro.

### ✨ Features

- **`feat(cv): subida multipart con multer (PR-4 completo)`** — `/api/cv/import` acepta ahora TANTO *octet-stream* (contrato original) COMO `multipart/form-data` mediante multer. El rechazo 415 de v1.10.2 era un parche; v1.13.0 es la corrección real. curl `-F`, *default* de Postman, cualquier cliente HTTP funcionan sin fricción. Nueva dependencia: `multer ^2.1.1`.
- **`feat(portals): adapter registry`** — los *fetchers* de Greenhouse / Ashby / Lever extraídos a `server/lib/portals/adapters/*.mjs` con contrato uniforme. `server/lib/portals/registry.mjs::resolveAdapter()` es el único punto de despacho. Añadir un nuevo ATS = un fichero en `adapters/` + una línea en `ALL_ADAPTERS`.
- **`feat(batch): página #/batch *evaluate*`** — nueva vista SPA + 4 *endpoints* (`GET /api/batch`, `PUT /api/batch`, `GET /api/stream/batch`, `POST /api/batch/merge`). Editor TSV para `batch/batch-input.tsv`, controles *parallel*/*min-score*/*dry-run*/*retry*, *log* SSE en vivo de `bash batch/batch-runner.sh`, botón `Merge to tracker` (ejecuta `node merge-tracker.mjs`). Enlace en *sidebar*. 21 claves i18n nuevas × 8 *locales*.
- **`feat(prompts): andamiaje de mode consciente del locale`** — `buildModePrompt` + `buildEvaluationPrompt` envuelven ahora el cuerpo inglés de la plantilla *mode* del padre con andamiaje localizado (línea de rol, "Read these files first", "User-supplied context") en 8 *locales*.

### 🎨 Fixes de UX

- **`fix(theme): tablas en modo oscuro + tab-btn`** — `#fafafa` / `#fff` / `#f7f7f7` *hardcoded* sustituidos por *tokens*. El *hover* en oscuro es ahora legible. Añadido `.row-boosted` con franja de acento.

### 🧪 Tests

- Nuevos `tests/adapter-registry.test.mjs` (7), `tests/batch-endpoints.test.mjs` (5), `tests/locale-scaffold.test.mjs` (6).
- `tests/cv-upload-multipart-reject.test.mjs` reescrito al contrato v1.13.0 (*multipart* parseado correctamente).
- Total: **379 / 379** *unit* (era 360; +19). 0 fallos. Cobertura **95,46 % líneas / 84,06 % ramas**.
- 20/20 smoke E2E · 23/23 *comprehensive* E2E · 28/28 Playwright.

### Fuera de alcance

- **14 adaptadores de portal nuevos** — el *registry* está; añadirlos = un fichero cada uno; queda el *research* portal por portal.
- **Traducir cuerpos de `modes/<slug>.md` del padre** — requiere PR aguas arriba a `santifer/career-ops` (regla dura #1 de CLAUDE.md).

### Documentación

- `docs/reviews/REVIEW-2026-05-13-v1.13.0.md`.

---

## [1.12.0] — 2026-05-13

Pase de *bug-fix* + UX + *brand*. Cierra 8 ítems del *backlog* tras v1.11.1 (huecos de prueba #9–12, error de consola #8, deriva *portals-dead* #4, afloramiento de `seniority_boost` #6, consolidación de *endpoint* F-018). Añadido conmutador día/noche de tema, eliminada la mención "*Airbnb-styled*" de todos los documentos, *metadata* del paquete y descripción del repo de GitHub.

### ✨ Features

- **`feat(theme): conmutador día/noche`** — nuevo botón de tema en la *top-bar*. Ciclo claro ↔ oscuro, persistente en `localStorage`, restaurado antes del primer pintado vía `public/js/lib/theme-bootstrap.js`. Respeta `prefers-color-scheme` en la primera carga. Paleta oscura completa en `public/css/app.css` bajo `[data-theme="dark"]`.
- **`feat(scan): /api/stream/scan?source=ats|regional|both` (F-018 LITE)`** — un *endpoint* SSE consolidado. El SPA abre UN único *event-stream* que ejecuta secuencialmente ambas fases (ATS, después regional). Los legacy `/api/stream/scan-en` + `/api/stream/scan-ru` permanecen como alias deprecados.
- **`feat(scan): afloramiento de seniority_boost`** — ambos *scanners* leen `portals.yml::title_filter.seniority_boost` y marcan `_boosted: true` en *jobs* coincidentes. El SPA ordena las filas potenciadas arriba y renderiza un *badge* `⬆ boosted`.

### 🐛 Fixes

- **`fix(ui): .message null-safe en 4 sitios (#8)`** — `app.js`, `views/tracker.js`, `views/apply.js`, `views/evaluate.js`. Antes, un *Promise rejection* sin *payload Error* lanzaba "Cannot read properties of undefined" en el *teardown* E2E.
- **`fix(test): drift portals-dead como aviso, no fallo (#4)`** — aserción convertida en aviso por *stderr*. CI sigue en verde ante deriva del padre; las decisiones de versión son manuales.

### 📝 Brand / docs

- **`docs(brand): eliminadas referencias 'Airbnb' de todos los doc + package + descripción del repo de GitHub`** — 8 README, CLAUDE.md, FRONTEND.md, package.json y la descripción del repo migrados de "*Airbnb-styled*" a "*Clean, docs-style*".

### 🧪 Tests

- Nuevo `tests/canonical-docs-coverage.test.mjs` (5 casos) cierra los huecos de prueba #9–12.
- Nuevo `tests/scan-consolidated.test.mjs` (6 casos) cubre F-018 LITE.
- Total: **360 / 360** *unit* (era 349; +11 netos). 0 fallos. Cobertura: **95,62 % líneas / 84,37 % ramas**.
- 20/20 smoke E2E · 23/23 *comprehensive* E2E · 28/28 Playwright.

### Documentación

- `docs/reviews/REVIEW-2026-05-13-v1.12.0.md`.

### Fuera de alcance (sin cambios desde v1.11.1)

Página SPA *Batch evaluate*; *adapter registry* completo (refactor arquitectónico F-018); *pipeline multer* completo (PR-4); traducción de plantillas *mode*.

---

## Versiones anteriores (v1.11.x y v1.10.x)

Las entradas detalladas para v1.11.0 / v1.11.1 / v1.10.0–v1.10.3 viven en el [CHANGELOG EN](CHANGELOG.md). Resumen ejecutivo:

- **v1.11.1 — 2026-05-13** · Pulido: pista de Playwright en `#/apply`, *taglines* unificadas, tarjeta de umbrales de puntuación en el *dashboard*. 349/349 pruebas.
- **v1.11.0 — 2026-05-13** · Integración de career-ops.org/docs en los 8 *help bundles* y los 8 README. Nuevo `docs/career-ops-canonical.md`. Documentados los conceptos *Mode*/*Archetype*/*Pipeline*/*Tracker*/*Report*/*Scan history*. 348/349 pruebas.
- **v1.10.3 — 2026-05-12** · Tramo de *bug-fix*: cierra 7 de 11 hallazgos QA del pase de regresión de v1.10.2.
- **v1.10.2 — 2026-05-12** · Rechazo 415 en *multipart* CV (parche temporal hasta el multer de v1.13.0); corrección de generación de PDF.
- **v1.10.1 — 2026-05-09** · Parche crítico del pase de regresión QA de v1.10.0.
- **v1.10.0 — 2026-05-08** · Editor `#/profile` + UX de subida de CV (pandoc/pdftotext/passthrough), 8 *locales* × 16 H2 de paridad de ayuda, conmutador de *locale*.
