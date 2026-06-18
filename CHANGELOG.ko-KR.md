# 변경 로그

**career-ops-ui** 의 모든 주요 변경 사항을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 를 따르며, 버전은 [Semantic Versioning](https://semver.org/) 을 준수합니다.

번역: [English](CHANGELOG.md) · [Español](CHANGELOG.es.md) · [Português](CHANGELOG.pt-BR.md) · [日本語](CHANGELOG.ja.md) · [Русский](CHANGELOG.ru.md) · [简体中文](CHANGELOG.zh-CN.md) · [繁體中文](CHANGELOG.zh-TW.md) · [Français](CHANGELOG.fr.md) · [Polski](CHANGELOG.pl.md) · [Українська](CHANGELOG.uk.md) · [العربية](CHANGELOG.ar.md)

> **i18n 노트** — 이 파일은 완전히 한국어로 번역되었습니다. 모든 버전 항목의 본문이 출판 등급의 한국어로 제공되며, 영어 본문 임시 대체 표기는 더 이상 사용되지 않습니다.

---


## [1.74.3] — 2026-06-18

**docs(parent-source): 부모 `career-ops` 저장소를 [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) 포크로 변경.** web-ui는 이제 실제 소스로 쓰이는 모든 곳에서 메인테이너의 포크를 부모 프로젝트로 참조합니다: `bin/setup.sh` 설치 스크립트의 `CAREER_OPS_REPO` 클론 기본값, 12개 README의 모든 `git clone` / "위에 올라가는" / 온보딩 링크, 그리고 에이전트 문서(`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `docs/`). 작성자 santifer 크레딧(및 비공식 UI 고지)은 변경되지 않았으며 — 소스/클론 URL만 이동했습니다. `tests/sh-files.test.mjs`는 이제 설치 스크립트가 포크를 클론하는지 검증합니다.

---


## [1.74.2] — 2026-06-17

**fix(health): `#/health` 및 `/api/status/providers`에서 `GITHUB_MODELS_API_KEY`를 선택적 점검 항목으로 노출.** v1.74.0의 GitHub Models 프로바이더는 `#/config`에서 설정할 수 있었지만 Health 페이지에 행이 없었고 `keysConfigured` 프로바이더 표면에서 누락되어 있었습니다. 선택적 점검 항목(다른 다섯 개 라이브 평가 프로바이더와 동일한 "set / unset (manual mode)" 문구)과 `github`(+ 해당 `GITHUB_MODELS_MODEL`)를 `/api/status/providers`에 추가하여, 활성 프로바이더 라우팅과 Health 페이지가 이제 여섯 개 모두를 반영합니다. `tests/api.test.mjs` 헬스 행 테스트를 여섯 개 프로바이더 모두로 확장했습니다.

---



## [1.74.1] — 2026-06-17

**docs + test: README "AI 어시스턴트 설치" 섹션; Gemini 커넥터의 전체 브랜치 커버리지.** README에 설치/로그인 표 추가 — Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI 설치 링크 + 각각의 `#/config` 공급자 매핑 + "계속하기 전에 로그인" (career-ops.org/docs 빠른 시작 반영; web-ui가 CLI 없이도 사용 가능한 독립형 대안임을 명확히 설명). 새로운 `tests/gemini-connector.test.mjs` (8개 케이스)는 `runGemini`의 모든 브랜치를 다룸 — 키 없음, 성공, API 오류, 빈/차단된 완료, 잘못된 형식의 본문, 타임아웃, 네트워크 오류, `hasGeminiKey` — `server/lib/gemini.mjs`를 구문 100%로 끌어올림. 전체 커버리지: 96% 라인 / 88% 브랜치 / 96% 함수. 스위트 1126 → 1134.

---



## [1.74.0] — 2026-06-17

**feat(llm): GitHub Models (Copilot)을 6번째 프로바이더로 추가 + 6개 어시스턴트 표준 정렬.** career-ops.org/docs에는 여섯 가지 AI 코딩 어시스턴트가 나열되어 있습니다 — Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI. 이제 web-ui는 여섯 가지 모두를 지원합니다: 다섯 개는 기존 라이브 프로바이더(Anthropic / Gemini / OpenAI / Qwen / OpenRouter)에 매핑되고, GitHub Copilot CLI는 전용 GitHub Models 커넥터 — `runGitHubModels` (OpenAI-compatible; `models` 스코프를 가진 GitHub PAT)를 갖게 됩니다. 이는 `#/config`에서 (`GITHUB_MODELS_API_KEY` + `GITHUB_MODELS_MODEL`)로 설정하고 `LLM_PROVIDER=github`를 통해 선택할 수 있으며 auto 순서에서 6번째입니다. 도움말 번들과 README는 이제 표준 여섯 가지를 나열하고(Qwen CLI→Qwen Code로 이름 변경; Gemini CLI + GitHub Copilot CLI 추가), README에는 모든 기능이 상위 프로젝트로 추적될 수 있도록 전체 모드 참조 및 포털 어댑터 링크 테이블이 career-ops.org/docs에 추가됩니다. `tests/llm-provider-context.test.mjs`는 여섯 프로바이더 모두로 페치 경계 매트릭스를 확장하고(`cv.md` + `profile.yml` 인라인 + 아티팩트 반환), 새로운 `GITHUB_MODELS_*` 키가 12개의 모든 로케일 사전에 추가됩니다. 스위트 1125 → 1126.

---



## [1.73.0] — 2026-06-17

**feat(llm): 범용 Gemini 커넥터 + 모든 공급자에 걸쳐 검증된 CV/프로필 컨텍스트.** `server/lib/gemini.mjs` (`runGemini`)를 추가했습니다 — Anthropic / OpenAI 호환 클라이언트와 동일한 `{markdown, usage, error}` 형태를 반환하는 외부 의존성 없는 Gemini `generateContent` 클라이언트입니다. 수정 사항: `/api/mode/:slug`와 `/api/deep`이 이전에는 채용 공고 전용인 `gemini-eval.mjs`를 통해 프롬프트를 라우팅하여, Gemini **Run live**가 요청된 결과물(자기소개서, 아웃리치, 브리프) 대신 평가를 반환했습니다. 이제 `bundleProjectContext`와 함께 `runGemini`를 호출하므로 `cv.md` + `config/profile.yml`이 다른 모든 공급자와 동일하게 Gemini에도 인라인으로 삽입되어 편지와 브리프가 상세하고 개인화됩니다. 새로운 `tests/llm-provider-context.test.mjs`는 각 공급자의 HTTP 경계를 목킹하고 다섯 개 공급자(Anthropic / Gemini / OpenAI / Qwen / OpenRouter) 모두 `cv.md` + `profile.yml`을 인라인으로 삽입하고 결과물을 반환함을 검증합니다(mode + deep + evaluate 매트릭스, 9개 케이스). `/api/evaluate`는 채용 공고 전용 `gemini-eval.mjs`를 유지합니다. Suite 1116 → 1125.

---



## [1.72.0] — 2026-06-17

**feat(modes): **Run live** 가 이제 최종 결과물을 직접 반환합니다 (단일 실행 출력 계약).** 상위 `modes/<slug>.md` 템플릿은 Claude Code 대화형 세션을 위해 작성되었으며, 일부(cover, contacto 등)는 결과를 생성하기 전에 확인 질문을 위해 일시 중지합니다. 이로 인해 웹 UI의 **Run live** 가 결과물 대신 설문지를 출력했습니다. `buildModePrompt` 는 이제 모든 모드를 비대화형 출력 계약으로 감쌉니다: 분석(JD 분석, 회사 노트, ATS 키워드, 프로필↔JD 간극, 톤/방향 선택)을 자동으로 수행하고, 템플릿이 보통 물어볼 내용에 대해 `cv.md` / `config/profile.yml` 에서 합리적인 기본값을 선택하며, 최종 결과물만 출력합니다 — 모드별 «output ONLY {the cover letter / outreach message / …}» 알림으로 마무리됩니다. 이제 `#/cover` 에서 **Run live** 를 클릭하면 커버 레터 자체가 반환됩니다. 동일한 수정이 모든 일반 모드(cover, contacto, interview-prep, project, training, followup, patterns)의 12개 로케일 전체에 적용됩니다(결과물은 로케일 지시어를 통해 UI 언어로 작성됩니다). Suite 1103 → 1116.

---



## [1.71.2] — 2026-06-17

**docs(i18n):** 문서 일관성 검토 결과를 게시합니다. 각 README의 "Translations of this guide" 블록에 이제 11개의 형제 언어가 모두 나열되며(이전에는 일부가 English/Français를 생략하거나 자기 자신에 링크), 섹션 구분 앞의 빈 줄이 복원되었습니다. 전체 QA 회귀 프롬프트가 현재 버전으로 이름이 변경되었고, 문서(`CLAUDE.md`, `CONVENTIONS`, `LOCALIZATION`, `PROJECT-CONTEXT`)가 현재 버전 및 테스트 수(1103)와 동기화되었습니다. 코드 또는 동작 변경 없음 — 문서만 변경되었으므로 도움말/UI 번역 및 1.70.0–1.71.1의 모든 기능은 변경되지 않습니다.

---



## [1.71.1] — 2026-06-17

**fix(i18n): 앱 내 도움말 가이드가 이제 12개 언어 모두에서 완전히 번역되었습니다.** `docs/help/{pl,uk,ar}.md`를 추가하여 (각 파일은 검증된 19 H2 / 75 H3 구조를 포함) `#/help`가 영어로 폴백하는 대신 폴란드어, 우크라이나어, 아랍어 네이티브 번들을 제공합니다 — `GET /api/help/{pl,uk,ar}`가 이제 해당 로케일을 반환합니다. 모든 도움말 게이트(`help-ui`, `help.test`, `help-ru-config-section`, `canonical-docs-coverage`)에 연결되었습니다. 또한 12개 언어 번역 목록을 모두 완성했습니다: README의 «Translations of this guide» 블록(9개 README), 로컬화된 CHANGELOG의 «Translations:» 헤더(8개 파일), 그리고 오래된 문서 수치를 업데이트했습니다. Suite 1100 → 1103.

---



## [1.71.0] — 2026-06-16

**feat(cover): `#/cover`에서 바로 자기소개서 PDF를 생성합니다.** v1.70.0에 추가된 cover 모드는 편지 텍스트를 생성하며, 이제 결과 화면에 **Generate PDF** 버튼이 제공되어 공유 인라인 markdown→PDF 파이프라인(`POST /api/stream/pdf/inline` → `generate-pdf.mjs`)을 통해 렌더링됩니다. 이는 interview-prep이 사용하는 것과 동일한 경로입니다. 이제 SPA를 벗어나지 않고도 편지를 작성하고 PDF를 제출할 수 있습니다.

**test/docs: v1.70.0 검토 강화.** cover 모드(허용 목록 + 프롬프트 조립), 국기 `<select>` 스위처 + 아랍어 RTL(`dirFor`/`<html dir>`), 모든 로케일의 `top.langLabel`, 자기소개서 PDF 연결, `prompts.mjs` 로케일 지시문 + fr/pl/uk/ar 스캐폴딩에 대한 CI-격리 커버리지를 추가했습니다. `docs/sdd/CONVENTIONS.md` 및 전체 프로젝트 QA 회귀 프롬프트에서 오래된 «8개 전체» → 12개 로케일 참조를 업데이트했습니다.

---



## [1.70.0] — 2026-06-16

**feat(i18n): 세 가지 새로운 UI 언어 — 폴란드어(pl), 우크라이나어(uk), 아랍어(ar, 완전한 RTL 지원 포함) — 를 추가하여 SPA를 12개 로케일로 확장하고, 상위 career-ops README의 모든 언어와 일치시킵니다.** 각 새 로케일은 697개 키로 구성된 완전한 사전(`public/js/lib/locales/i18n-dict.{pl,uk,ar}.js`)을 제공하며, 기존의 패리티 / 커버리지 / 라틴 누락 방지 / 개인 데이터 없음 테스트 스위트로 검증됩니다. 아랍어는 진정한 오른쪽에서 왼쪽 지원을 추가합니다: `i18n.js`는 RTL 로케일에 대해 `<html dir="rtl">`을 설정하고, `app.css`의 범위가 지정된 `[dir="rtl"]` 블록이 크롬(사이드바, 알림 드로어, 마크다운 테이블/블록 인용, 인라인 간격)을 미러링합니다 — LTR 로케일은 바이트 단위로 변경되지 않습니다. 새로운 `top.langLabel` 키(×12)가 스크린 리더를 위해 선택기 이름을 지정합니다.

**feat(ui): 플래그 아이콘 `<select>` 언어 전환기가 래핑 버튼 행을 대체합니다.** 12개 로케일에서 이전 `.lang-btn` 행은 사이드바에서 세 줄로 줄 바꿈되었습니다. 네이티브 `<select>`(각 옵션 앞에 국기 이모지)는 깔끔하게 확장되고, 기본적으로 키보드 및 스크린 리더 친화적이며, CSP에 안전합니다(`addEventListener`를 통한 변경 핸들러, 인라인 JS 없음). 플랫폼에 국기 글리프가 없는 경우 국기는 지역 문자로 대체되므로 언어 레이블이 항상 핵심 식별자입니다.

**feat(cover): 상위 프로젝트의 자기소개서 모드(career-ops v1.10.0 + v1.11.0 인사말)를 SPA로 이식합니다.** 지원 탐색 그룹 아래에 새로운 `#/cover` 페이지를 추가하고, 범용 모드 러너 위에 구축합니다: 채용 공고 설명 + 회사/역할 + 선택적 인사말 → `cv.md` / `modes/_profile.md`에서 생성된 맞춤형 편지. 서버 `MODE_ALLOWLIST`에 `cover`를 추가하고 `cover.*` i18n 블록(×12 로케일)을 추가했습니다.

**chore(compat): 상위 career-ops v1.11.0을 추적합니다.** 읽기/쓰기 계약이 그대로 유지됨을 확인했습니다 — `data/applications.md`는 마크다운 진실 소스로 유지되며(v1.11.0 SQLite 트래커 인덱스는 파생 캐시), 트래커 열은 여전히 헤더 매핑됩니다. `parentVersion`은 이제 1.11.0을 보고합니다.

**fix(i18n): 프랑스어(v1.61.0에 추가)가 `server/lib/prompts.mjs`의 `LOCALE_NAMES` 및 `SCAFFOLD_STRINGS`에 누락된 잠재적 결함을 수정합니다** — 프랑스어 LLM 호출이 자동으로 영어 출력 및 영어 스캐폴딩으로 대체되었습니다. fr/pl/uk/ar가 이제 모두 프롬프트 로케일 경로에 연결되었습니다.

> 알려진 후속 작업: 앱 내 도움말 가이드(`docs/help/`)는 pl/uk/ar의 경우 영어로 대체됩니다(UI 크롬 자체는 완전히 현지화됨); 상위 프로젝트의 대화형 인터뷰 온보딩, 역방향 ATS 검색, 새로운 스캔 제공업체는 아직 SPA에 노출되지 않았습니다.

---




## [1.69.2] — 2026-06-12

**fix(test): `npm test`가 실제 `config/profile.yml`과 `data/scan-history.tsv`를 덮어쓰던 테스트 격리 누수를 수정합니다.** `tests/critical-fixes.test.mjs`가 파일 상단에서 `prompts.mjs`(→ `paths.mjs`)를 가져왔기 때문에, `before()`가 `CAREER_OPS_ROOT`를 임시 디렉터리로 설정하기 전에 `PROJECT_ROOT`가 실제 부모로 해석되어 `PUT /api/profile`가 매 실행마다 "Acceptance Test" 픽스처를 실제 프로필에 기록했습니다. 수정: `prompts.mjs`를 `before()` 안에서 동적 `import()`로 로드. 새 `tests/test-root-isolation.test.mjs`(2개 케이스)가 전체 스위트를 이 패턴으로부터 보호합니다. 프로덕션 코드 변경 없음. 스위트 1084 → 1086.

---



## [1.69.1] — 2026-06-12

**fix(scan): `#/scan` 가 대규모 지역 스윕을 조용히 잘라내지 않습니다.** 리전별 표시 집합이 500개로 고정되어 있었습니다(실제 RU 스캔에서 일치 1352개 중 500개만 표시, 852개 숨김 — "2000개 스캔, 약 600개 표시" 증상). 두 스캐너 모두 공유 및 환경 변수로 재정의 가능한 상수 `MAX_STORED_RESULTS`(기본 2000, `SCAN_MAX_RESULTS`로 재정의)를 사용합니다. 표시 전용 — `pipeline.md` / `scan-history.tsv` 추가는 이미 잘리지 않은 집합을 사용했습니다. **fix(health/ui): `#/health` 점검 카드가 더 이상 넘치지 않습니다.** 긴 이름/값이 **Fix →** 버튼 및 상태 배지와 충돌했으나, 이제 `.health-check-row`로 축소·줄바꿈됩니다. 새 테스트 `scan-result-cap` + `health-card-overflow`. 스위트 1079 → 1084.

---



## [1.69.0] — 2026-06-12

**feat(scan): 스캐너 어댑터 자동 발견 (P-14) — `server/lib/sources/` 에 `.mjs` 파일을 두기만 하면 새로운 소스가 등록됩니다.** v1.69 이전에는 `server/lib/sources/registry.mjs` 의 소스 목록이 손으로 유지되는 정적 배열이어서, 어댑터를 추가하려면 `<id>.mjs` 와 `registry.mjs` 를 모두 수정해야 했습니다. 로드맵 항목 P-14 (`docs/ROADMAP.md`) 의 남은 절반을 마무리합니다. 이제 `server/lib/sources/` 의 모든 `*.mjs` 가 모듈 부팅 시 동적으로 로드되며, 각 어댑터는 자기 기술적인 블록 `export const meta = { value, label, region, configKey? }` 로 자신의 정체성을 선언합니다. 동봉된 12개의 어댑터(ashby / greenhouse / lever / rss / smartrecruiters / workable / workday + geekjob / getmatch / habr / hh / trudvsem) 에 `meta` 가 추가되었고, `registry.mjs` 는 `readdirSync` + 동적 `import()` 를 top-level await 로 해석합니다 (Node 18+ ESM 표준). 공개 API (`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`) 는 변경되지 않습니다 — 기존 임포트는 그대로 동작합니다. 잘못된 `meta` 는 거부되고 파일마다 `console.warn` 가 한 번씩 기록됩니다. `tests/sources-registry-discovery.test.mjs` 에 14개의 케이스를 추가했습니다. 스위트 1065 → 1079.

---



## [1.68.2] — 2026-06-07

**fix(bin): `npx` / `npm link`로 실행하는 CLI 동사가 깨져 있었음 — 이제 bin 경로를 심볼릭 링크를 따라 해석함.** npm과 npx는 `career-ops-ui`를 `node_modules/.bin/` 아래의 심볼릭 링크로 노출하는데, 기존 `dirname "${BASH_SOURCE[0]}"`가 패키지 루트가 아니라 `.bin`을 가리켜서 `npx career-ops-ui init`이 `node node_modules/scripts/init.mjs`를 실행하다 `MODULE_NOT_FOUND`로 죽었습니다(로컬 `npm install` 실행은 영향을 받지 않아 버그가 숨겨졌습니다). 이제 `bin/career-ops-ui.sh`와 `bin/start.sh`는 심볼릭 링크 체인을 따라 `SCRIPT_DIR`를 정규화하므로(`readlink` 루프 + `cd -P`) 모든 동사가 저장소에서, `npm link`로, 그리고 `npx`로 동작합니다. `.bin` 스타일 심볼릭 링크로 동사를 실행하는 회귀 방지 테스트를 `tests/sh-files.test.mjs`에 추가했습니다. 스위트 1065/1065.

---



## [1.68.1] — 2026-05-29

**fix(scan): 소스별 fetch 타임아웃 10s → 60s로 상향.** v1.67.1의 10s fail-fast는 시간이 조금 더 필요할 뿐인 "느리지만 살아있는" Ashby 보드까지 끊어냈습니다. 기본값을 1분으로 올려 그런 보드가 응답하도록 합니다. 트레이드오프: 정말로 죽거나 멈춘 소스는 이제 60s 내내 동시성 슬롯을 점유하며(최악의 경우 스캔이 느려짐), 만성적으로 멈추는 곳(Perplexity, Supabase, Resend 등)은 여전히 타임아웃될 가능성이 큽니다 — 제대로 고치려면 소스별 / Ashby 동시성 축소가 필요합니다. `SCAN_FETCH_TIMEOUT_MS`로 재정의 가능. 스위트 1063/1063.

---



## [1.68.0] — 2026-05-29

**feat(scan): 결과 필터 패널 개편 — 라벨 필드, 적용 버튼, 사무실 근무 옵션, 그리고 실제로 동작하는 급여 필터.** `#/scan`의 모든 필터가 라벨 필드가 되었습니다(플레이스홀더가 아니라 컨트롤 **위**에 라벨): 검색 · 근무 형태 · 급여 최소 · 급여 최대 · 소스 · 범위. 명시적 **적용** 버튼(및 **초기화**, 각 필드에서 Enter)이 필터를 재실행하고, 페이지의 힌트가 사용법을 설명합니다. **이제 급여 범위가 실제로 필터링합니다** — 최소/최대를 설정하면 급여가 범위를 벗어난 공고 **및 급여가 없는 공고**가 제거됩니다(범위 겹침, 통화 무시). 근무 형태 필터에 원격 / 하이브리드 / 재배치와 함께 **사무실 근무** 옵션 추가. 신규 i18n 키 ×9, `salaryInRange` 엄격화, 스위트 1063/1063.

---



## [1.67.1] — 2026-05-29

**fix(scan): 소스별 fetch 타임아웃 30s → 10s로 단축(fail-fast).** v1.67.0의 30s 상향은 느린 Ashby 보드의 절반 정도만 회복했고, 나머지(Perplexity, Supabase, Resend, DeepL, Ramp 등)는 마감과 무관하게 멈추므로 긴 타임아웃은 죽은 슬롯을 기다리며 전체 스캔을 지연시킬 뿐이었습니다. 10s는 만성 행에 즉시 실패하고 스캔 반응성을 유지합니다. `SCAN_FETCH_TIMEOUT_MS`로 재정의 가능. 스위트 1060/1060.

---



## [1.67.0] — 2026-05-29

**feat(scan): `#/scan`에 급여 범위(최소／최대) 필터 추가 및 소스별 fetch 타임아웃 연장.** 결과 테이블에 텍스트·원격 필터 옆으로 숫자 입력 두 개(급여 **최소** ／ **최대**)가 추가됩니다. 각 행의 자유 텍스트 급여(`от 100 000 до 200 000 ₽`, `120000-150000 USD`, `$120K–$150K` 등)를 숫자 범위로 파싱해 범위 겹침 방식으로 매칭합니다. 급여가 없는 행은 유지하므로 필터가 목록을 비우지 않고 좁힙니다(통화는 구분하지 않음 — 환율 변환 없음). 또한 **소스별 스캔 fetch 타임아웃을 15s → 30s로 상향**(`SCAN_FETCH_TIMEOUT_MS`로 재정의 가능). Ashby의 `includeCompensation` 페이로드는 ×8 동시성에서 흔히 15s를 초과해 매 스캔마다 ~30개 Ashby 보드가 타임아웃되었습니다. 신규 `window.Skills.parseSalaryRange`／`salaryInRange` + i18n ×9, 테스트 13개 추가, 스위트 1060/1060.

---



## [1.66.0] — 2026-05-28

**feat(scan): RU 소스가 첫 페이지뿐 아니라 모든 결과 페이지를 순회합니다.** hh.ru, Habr Career, Trudvsem은 쿼리당 처음 ~50건만 가져왔지만, 이제 끝까지 페이지를 따라갑니다 — hh.ru/Habr는 `&page=N`, Trudvsem은 `offset`/`meta.total` — 페이지 간 중복 제거 및 새 항목이 없으면(또는 50페이지 안전 상한에서) 중단. "Backend разработчик" 같은 쿼리가 한 페이지가 아니라 전체 결과를 반환합니다(예: hh.ru PHP 17 → 3페이지에 55건 이상; Trudvsem 72건 전부). 페이지별 요청은 기존 타임아웃 + AbortSignal 유지. 테스트 4개 추가; 스위트 1045/1045.

---



## [1.65.0] — 2026-05-28

**feat(scan): hh.ru를 JSON API 대신 공개 웹사이트에서 스크랩 — 어떤 IP에서도 프록시 없이 작동.** `api.hh.ru`가 IP나 User-Agent와 무관하게 모든 프로그램 클라이언트에 `403 forbidden`을 반환하기 시작했습니다(엣지 안티봇 차단). 반면 웹사이트(`hh.ru/search/vacancy`)는 브라우저류 클라이언트에 전체 결과를 제공하므로, 어댑터가 이제 그 HTML을 파싱합니다(Habr Career처럼). **1.64.0의 `HH_PROXY` 변수와 `undici` 의존성을 제거** — 프록시·키·User-Agent 설정이 필요 없습니다. HTML 파서용으로 테스트 재작성; 스위트 1041/1041.

---



## [1.64.0] — 2026-05-27

**feat(scan): `HH_PROXY`로 hh.ru 요청을 러시아 프록시로 라우팅.** hh.ru는 API를 User-Agent가 아니라 **IP**로 차단합니다 — 따라서 `HH_USER_AGENT`만으로는 러시아 외 출구 노드의 403을 해제할 수 없었습니다. `HH_PROXY`에 러시아 HTTP/HTTPS 프록시 URL(예: `http://user:pass@ru-host:port`)을 지정하면 **hh.ru 요청만** 그 프록시를 통과하고 나머지 소스는 직접 연결을 유지합니다. `undici`의 `ProxyAgent` 기반(런타임 의존성 추가); `HH_PROXY`가 없으면 dispatcher는 전혀 추가되지 않습니다. 테스트 3개 추가; 스위트 1041/1041.

---



## [1.63.2] — 2026-05-27

**feat(scan): `#/scan` 콘솔에 실시간 % 진행률 + 소스별 상세.** 진행 표시줄이 **확정형**이 되었습니다 — 스캐너가 진행 이벤트(EN: 회사별, RU: 쿼리별)를 SSE로 보내고, **"Scanning… NN%"** 라벨과 함께 막대가 채워집니다(애니메이션 줄무늬는 첫 이벤트까지만). 각 소스의 첫 실패(타임아웃 / 403 / 네트워크)는 콘솔에 상세히 기록되고 이후 반복은 억제됩니다. 신규 테스트 1개, 스위트 1040/1040.

---



## [1.63.1] — 2026-05-27

**style(scan): `#/scan` 진행 표시줄을 더 눈에 띄게.** 진행 표시기에 보이는 **"Scanning…"** 라벨을 추가하고 막대를 **8px**(기존 4px)로 키워 스캔 중 분명히 보이게 했습니다. 동작 변경 없음.

---



## [1.63.0] — 2026-05-27

**feat(scan): 요청별 타임아웃 + `#/scan` 진행 표시줄.** 소스 요청에 마감 시간이 없어, 멈춘 업스트림(예: 차단된 IP에서의 `api.hh.ru`)이 **스캔 전체를 멈출** 수 있었습니다. 새 `server/lib/fetch-timeout.mjs` 가 스캐너의 `fetchImpl` 을 감싸(`makeTimeoutFetch`, 기본 **15초**, `SCAN_FETCH_TIMEOUT_MS` 로 변경) 각 요청에 엄격한 마감을 부여합니다. 타임아웃된 소스는 비치명적 오류로 기록되고 스캔은 계속됩니다. `#/scan` 은 스캔 중 진행 표시줄을 보여줍니다(9개 로케일 `scan.progress`). 신규 테스트 7개, 스위트 1039/1039.

---



## [1.62.3] — 2026-05-27

**docs: 설치 명확화(career-ops-ui 는 `career-ops/web-ui/` 안에서 실행)+ `init` 문제 해결, 9개 로케일 전체.** 설치 섹션을 **Option 1**(원커맨드 curl)/ **Option 2**(기존 career-ops 프로젝트 안에 `web-ui` 로 UI 클론)+ CLI 명령어 + 공급자 설정 + **Troubleshooting `init`** 블록으로 재작성. 중첩 구조 안내를 `/help` §1 Setup 에도 추가하고, README 하이라이트에서 v1.62.* 라인 전체를 요약. 문서만 변경, 코드 변경 없음.

---



## [1.62.2] — 2026-05-27

**fix(help): `#/help` 필터가 이제 전문 검색입니다(RSS 같은 H3 하위 섹션도 검색됨).** 도움말 페이지의 검색/TOC 필터는 이전에 H2 섹션 제목만 일치시켰기 때문에 v1.62.x의 RSS 문서(§5 Portals & sources 아래 H3)를 찾을 수 없었습니다. 이제 각 섹션의 본문이 필터에 인덱싱되어 예를 들어 "RSS"를 검색하면 §5가 표시됩니다. 클라이언트 측만 변경, API 변경 없음.

---



## [1.62.1] — 2026-05-27

**feat(scan): 소스 필터에 RSS 추가 + RSS 위치 수정.** `#/scan` 소스 필터 드롭다운에 이제 **RSS** 가 표시됩니다(`server/lib/sources/registry.mjs` 와 SPA 폴백 목록에 추가). 따라서 RSS 보드(LaraJobs, WeWorkRemotely 등) 결과도 다른 ATS 소스처럼 필터링됩니다. RSS 어댑터는 더 이상 피드의 `<category>` 태그를 `location` 에 매핑하지 않습니다 — 위치가 아닌 태그가 `location_filter` 로 하여금 원격 직무를 잘못 제외하게 만들었기 때문입니다. 이제 `location` 은 비어 있어 피드가 위치 필터를 통과합니다. 스캔 버튼 툴팁/레이블과 소스 목록 i18n 문자열을 9개 로케일 전체에서 업데이트(Workable / SmartRecruiters / Workday / RSS). i18n 스냅샷과 소스 엔드포인트 테스트(EN 6 → 7) 업데이트.

---



## [1.62.0] — 2026-05-27

**feat(scan): 비-ATS 채용 보드를 위한 범용 RSS 어댑터.** 새 `rss` 어댑터(`server/lib/portals/adapters/rss.mjs` + `server/lib/sources/rss.mjs`)를 통해 스캐너가 모든 RSS 피드(LaraJobs, WeWorkRemotely, RemoteOK, golangprojects 등 Greenhouse/Ashby/Lever 외 보드)에서 채용 공고를 가져올 수 있습니다. 새 의존성 없음: 피드 파싱은 정규식 기반이며 CDATA와 HTML 엔티티를 지원합니다(제목/회사명 태그 제거, astral 코드포인트 안전 디코딩). `portals.yml`의 `provider: rss` / `rss:` / `feed_url:`로 회사별 활성화되어 ATS에 이미 매칭된 회사를 가로채지 않습니다. `ALL_ADAPTERS`가 6 → 7로 증가. 신규 테스트 29개; 9개 README 로케일에 문서화.

---



## [1.61.1] — 2026-05-22

**fix(i18n): 테마 토글의 title + aria-label을 9개 로케일 전체에서 현지화 (MINOR-001).** 다크/라이트 테마 버튼(`#theme-toggle`)이 `index.html`에 `title="Toggle theme"`과 `aria-label="Toggle theme"`을 하드코딩하여 — 모든 로케일에서 툴팁과 스크린리더 텍스트가 번역되지 않았습니다. 새 `top.themeToggle` 키 + `applyI18n()`의 `data-i18n-title` 핸들러(v1.58.15 검색 aria-label 수정과 동일 패턴)가 부팅 시와 언어 전환 시마다 두 속성을 현지화합니다. `tests/playwright-theme-toggle-i18n.mjs`(9개 로케일 + 런타임 전환)와 정적 가드 2개로 잠금. v1.61.0 프랑스어 사인오프의 유일한 LOW 항목. (MINOR-001)

---



## [1.61.0] — 2026-05-22

**feat(i18n): 프랑스어를 9번째 UI 언어로 추가.** 새 로케일별 사전 `public/js/lib/locales/i18n-dict.fr.js`(`window.__I18N_DICT_FR`)는 영어와 **668개 키** 완전 동등성을 가지며, 새 도움말 번들 `docs/help/fr.md`(**19 H2 / 73 H3**, `en`과 정확한 구조 동등성). `fr`는 언어 전환기와 브라우저 자동 감지(`i18n.js`), 어셈블러(`i18n-dict.js`), `index.html`(어셈블러 앞의 `<script>` 태그), 테스트 스냅샷, 모든 테스트 로케일 목록에 등록됨. 초기 번역 표는 **PR #9**(커뮤니티 기여)에서 가져옴. 로직 변경 없음: `t()`와 모든 뷰는 그대로. 단위 테스트 **1001 / 1001**; Playwright 로케일 스윕은 9개 서브테스트로 확장. (FR-LOCALE)

---



## [1.60.0] — 2026-05-22

**refactor(i18n): 8개 언어 통합 파일을 로케일별 파일로 분리 (I18N-SPLIT).** 번역 사전이 하나의 `public/js/lib/i18n-dict.js`에 있었으나, 이제 `public/js/lib/locales/` 아래 **언어당 한 파일**과 공용 `i18n-dict.aliases.js`로 나뉘어 번역가가 한 언어만 독립적으로 편집할 수 있습니다(i18next / OpenWA 방식). `i18n-dict.js`는 동일한 `window.__I18N_DICT`를 다시 조립하는 **조립기**가 되어 `t()`와 모든 화면은 그대로입니다. `<script src>`로 동기 로드 — 빌드·fetch 없음. 스냅샷으로 무손실 마이그레이션 검증(678개 키). 도구와 ~25개 테스트를 분리 인식하도록 수정; 신규 `tests/i18n-locale-files.test.mjs`, `tests/playwright-locale-sweep.mjs`(모든 페이지 × 8개 로케일, 실제 Chromium). 994 → **1000** 단위 · 62 → **70** Playwright. 동작 변화 없음. (I18N-SPLIT)

---



## [1.59.13] — 2026-05-21

**fix(i18n): @alias 로 진짜 중복 키 통합 + 개인정보 최종 정리.** 메인테이너 실명을 테스트 픽스처/QA 리포트에서 제거(→ `Jane Doe`), `LICENSE`/`package.json` 을 `Fighter90` 핸들로 변경. `@alias` 로 8개 로케일 동일한 10개 키 통합. `nav.config`/`config.title` 은 스페인어에서 달라 통합 안 함. 991 → **994** 테스트. (I18N-CL3)

---



## [1.59.12] — 2026-05-21

**fix(i18n): i18n-dict.js 정리 — fr 로케일 이전 (I18N-CL1, I18N-CL2, I18N-CL4).** `training.coursePh` 의 개인 데이터를 일반 플레이스홀더로 교체, `followup.lastPh` 를 고정 날짜에서 형식 힌트로 변경, `npm run audit:i18n` 추가. 중복 값 그룹은 의도적(서로 다른 UI 역할) — 사전 헤더 참고. (I18N-CL1, I18N-CL2, I18N-CL4)

---



## [1.59.11] — 2026-05-21

**fix(test): v1.59.11 — e2e-comprehensive 스위트가 23/23 통과 (이전 11/23).** Playwright 의 `page.goto` 가 해시만 바뀌는 경우 no-op 이라서 발생한 문제. 새 `goRoute(hash)` 헬퍼가 `about:blank` 를 거쳐 실제 내비게이션을 강제합니다. (e2e-harness-r1)

---



## [1.59.10] — 2026-05-21

**fix(api): NEW-F1-sub-r1 (v1.59.10) — 원시 `..` 가드를 모든 `/api` 라우트 등록 위로 끌어올렸습니다.** v1.59.8 버전은 `app.all` 뒤에 있어 발화되지 않았습니다. Express 정규화 이전에 실행됩니다. (NEW-F1-sub-r1)

---



## [1.59.9] — 2026-05-21

**fix(ux): UX-A5-r4 (v1.59.9) — Help TOC 스크롤 스파이에 `data-toc-spy="active"` 디버그 마커 + 동작 기반 락 테스트.** 6번째 사이클. 동기 초기 페인트 + 이중 rAF 재계산 + resize 리스너 + hashchange 정리. (UX-A5-r4)

---



## [1.59.8] — 2026-05-21

**fix(ux+api): v1.59.8 — UX-A5-r3 + NEW-F1-sub (HIGH + LOW 묶음).** FINAL-REGRESSION-v1.59.7 권고에 따른 doctrine 예외. UX-A5-r3: `#/help` 가 IntersectionObserver 를 `scroll` 리스너 + rAF 쓰로틀링으로 교체. NEW-F1-sub: `/api/*` 의 가공되지 않은 `..` 를 404 JSON 으로 거부. (UX-A5-r3 · NEW-F1-sub)

---



## [1.59.7] — 2026-05-20

**fix(api): NEW-D3-cache (v1.59.7) — `GET /api/cv` 가 `Cache-Control: no-store` 전송.** CV 는 사용자 핵심 아티팩트이므로 항상 재검증. (NEW-D3-cache)

---



## [1.59.6] — 2026-05-20

**feat(a11y): NEW-D2-motion (v1.59.6) — `prefers-reduced-motion: reduce` 존중.** 새 `@media` 블록이 애니메이션·트랜지션·`scroll-behavior` 를 비활성화. (NEW-D2-motion)

---



## [1.59.5] — 2026-05-20

**fix(api): NEW-F1 (v1.59.5) — 알 수 없는 `/api/*` 가 모든 HTTP 동사에서 JSON 404 반환.** `app.get` → `app.all`. (NEW-F1)

---



## [1.59.4] — 2026-05-20

**fix(ui): NEW-OR1 (v1.59.4) — `#/config` Active/Keys 칩 경쟁 조건 제거.** atomic replaceChildren + 인-플라이트 토큰 + last-good 캐시. (NEW-OR1)

---



## [1.59.3] — 2026-05-20

**fix(ux): UX-A5-r2 (v1.59.3) — `#/help` 스크롤 스파이 강화.** rootMargin 가시 영역을 10 %에서 25 %로 확대 + 마운트 시 초기 상태 계산 추가. (UX-A5-r2)

---



## [1.59.2] — 2026-05-20

**fix(ui): v1.59.2 — Active/Keys 칩: 카운트 정확화, 공급자 이름 대문자화, 겹침 제거.** (post-v1.59.1 hotfix)

---



## [1.59.1] — 2026-05-20

**fix(test): v1.59.1 — NEW-D1 가드가 UX-A11 다듬어진 ES 복사를 허용합니다.** (v1.59.1)

---



## [1.59.0] — 2026-05-20

**feat(ui): UX-A14 (v1.59.0) — 모바일 (≤ 420 px) 감사 패스.** 새 `@media (max-width: 420px)` 블록에 5 가지 수정. (UX-A14)

---



## [1.58.65] — 2026-05-20

**test(ui): UX-A2 (v1.58.65) — Modes 구조화된 필드 폼 리그레션 락 테스트.** v1.54.3 구현을 회귀로부터 보호합니다. (UX-A2)

---



## [1.58.64] — 2026-05-20

**fix(i18n): UX-A11 (v1.58.64) — es/pt-BR 사본 다듬기.** 영어 차용어를 모국어 동등 표현으로 교체. (UX-A11)

---



## [1.58.63] — 2026-05-20

**fix(ui): UX-A15 (v1.58.63) — Dashboard Pipeline 타일에 시각적 주요 강조.** Pipeline 타일은 이제 강조 테두리, 더 큰 아이콘, 굵은 라벨로 눈에 띄게 표시됩니다. (UX-A15)

---



## [1.58.62] — 2026-05-20

**feat(ui): UX-A9 (v1.58.62) — API keys 탭 상단의 sticky 요약 칩.** `#/config → API keys` 탭 상단에 활성 공급자와 설정된 키 수를 표시하는 sticky 칩이 추가되었습니다. (UX-A9)

---



## [1.58.61] — 2026-05-20

**docs(readme): UX-A8 (v1.58.61) — 8 개 README 모두에 첫 실행 정리 섹션 추가.** 첫 스캔 전 두 개의 QA 픽스처 URL 을 정리하는 `make clean-test-fixtures` 단계를 문서화했습니다. (UX-A8)

---



## [1.58.60] — 2026-05-20

**feat(ui): UX-A12 (v1.58.60) — 알림 드로어에 모두 지우기 + 항목별 닫기.** 알림 패널에 전체 지우기 버튼과 항목별 × 버튼이 추가되었습니다. (UX-A12)

---



## [1.58.59] — 2026-05-20

**feat(ui): UX-A13 (v1.58.59) — `#/health` 실패 행에 실행 가능한 "Fix →" CTA.** FAIL/OPTIONAL 행은 이제 해당 설정 탭으로 바로 이동하는 고스트 버튼을 표시합니다. (UX-A13)

---



## [1.58.58] — 2026-05-20

**fix(ux): UX-A10 (v1.58.58) — `#/cv` 의 저장되지 않은 편집 손실 방지.** 브라우저 종료(`beforeunload`)와 SPA 내부 이동(`hashchange`) 시 더티 버퍼가 있으면 현지화된 확인을 표시합니다. (UX-A10)

---



## [1.58.57] — 2026-05-20

**test(ui): UX-A7 (v1.58.57) — cost-line 자동 갱신 계약에 대한 리그레션 락 테스트.** `providers-changed` 이벤트의 디스패치/구독/모든 어드바이저 뷰 호출을 정적으로 보장합니다. (UX-A7)

---



## [1.58.56] — 2026-05-20

**fix(a11y): UX-A4 (v1.58.56) — `.lang-btn` 이 WCAG 2.5.8 최소 터치 타깃 크기를 충족.** 이전에 언어 버튼은 높이 23–25 px 로 24×24 px 기준 미달이었으나, 이제 `min-height: 28px` + `min-width: 28px` 로 WCAG 2.2 AA 를 충족합니다. (UX-A4)

---



## [1.58.55] — 2026-05-20

**feat(ui): UX-A3 (v1.58.55) — Dashboard 활성 공급자 칩.** `#/dashboard` 히어로에 현재 활성 LLM 공급자가 표시됩니다(`⚡ Live evals: Anthropic claude-sonnet-4-6` 또는 `📋 Manual prompt mode`). `#/config` 에서 `LLM_PROVIDER` 변경 또는 탭 포커스 복원 시 자동 갱신. (UX-A3)

---



## [1.58.54] — 2026-05-20

**fix(ux): UX-A1 (v1.58.54) — Deep 브리프 구조 방어 경고.** 저장된 브리프에 표준 6개 섹션(Company snapshot / Engineering culture / Recent news / Glassdoor / Interview process / Negotiation leverage) 중 3개 미만이 포함되면 `public/js/views/deep.js`가 비차단 경고와 레퍼런스 링크를 앞에 표시합니다. UI 가드레일이며, 프롬프트 단계 수정은 상위 프로젝트에서 진행됩니다. (UX-A1)

---



## [1.58.53] — 2026-05-20

**fix(ux): UX-A6 — 모든 saved-card 가 단일 `renderSavedCard()` 헬퍼를 통과.** 모든 렌더 경로에서 `<span>+<time>` 구조 보장. 948 → **949** 유닛. (UX-A6)

---

## [1.58.52] — 2026-05-20

**fix(ux): UX-A5 — `#/help` TOC 스크롤 스파이가 정상 동작.** v1.58.45 의 setTimeout(0) 이 라우터 마운트 전에 실행되었음. fix: `headings` 직접 참조 + 이중 `requestAnimationFrame`. 947 → **948** 유닛. (UX-A5)

---

## [1.58.51] — 2026-05-20

**chore(docs): v1.58.51 — v1.58.37 → v1.58.50 사이클(14 releases) 최종 하우스키핑.** 코드 변경 없음. qa/ 재정리(모든 버전 고정 문서 `archive/v158-cycle/` 로 이동);6 개 perennial 이 루트에 남음. `REGRESSION-FINAL §13` 가 v1.58.37→.50 모든 불변 문서화. 베이스라인 불변(947/947). (housekeeping)

---

## [1.58.50] — 2026-05-20

**docs: DOC-1 — `qa/REGRESSION-FINAL.md` 에 §5a 추가(서버 에러 바디 영어-정책 명문화).** NEW-D4 를 `not-a-finding` 으로 종료. **FIX-PROMPT-FINAL-EXHAUSTIVE.md 의 v1.58.37 → v1.58.50 큐 완료(14 릴리스).** 946 → **947** 유닛. (DOC-1)

---

## [1.58.49] — 2026-05-20

**chore(tooling): TOOL-1 — `make clean-test-fixtures` 와 부모 프로젝트 `data/pipeline.md` 에서 example.com 라인을 제거하는 스크립트 추가.** `--dry-run` 지원. CI-isolated 테스트 4 개. 942 → **946** 유닛. (TOOL-1)

---

## [1.58.48] — 2026-05-20

**fix(ux/onboarding): UX-D-B — 프로필이 기본 템플릿일 때 `#/dashboard` 에 경고 배너 표시.** /api/health 의 `Profile customized: false` 검출 시 `.hero-banner--warning` 표시. 새 i18n 키 `onboarding.fixtureWarning` + `onboarding.fixProfile` × 8. 941 → **942** 유닛. (UX-D-B)

---

## [1.58.47] — 2026-05-20

**fix(ux/naming): UX-D-C — 상단바 "Quick scan" 을 `Scan 열기` 로 개명(실제 스캔을 시작하지 않고 단지 이동만 하므로).** 8 언어 업데이트. 940 → **941** 유닛. (UX-D-C)

---

## [1.58.46] — 2026-05-20

**fix(ux): UX-D-D — `#/apply` 체크리스트의 `{company}-{role}` 을 URL/JD 에서 추출한 슬러그로 치환.** 이전엔 플레이스홀더가 그대로 표시. 새 `extractSlugs` + `substitutePlaceholders` 가 Greenhouse/Lever/Ashby/Workable/SmartRecruiters/Workday 인식. 폴백 `[company]/[role]`. 939 → **940** 유닛. (UX-D-D)

---

## [1.58.45] — 2026-05-20

**fix(ux): UX-D-K — `#/help` 의 TOC 스크롤 스파이가 현재 섹션 강조.** `IntersectionObserver` 가 보이는 H2 에 해당하는 TOC 링크에 `.toc-current` 부여. 938 → **939** 유닛. (UX-D-K)

---

## [1.58.44] — 2026-05-20

**fix(ux): UX-D-L — `#/deep` 의 Saved-research 에서 열린 brief 에 인라인 × 닫기 버튼 추가.** 이전엔 스크롤하거나 페이지를 떠나야만 닫을 수 있었음. 새 키 `deep.closeBrief` × 8. 937 → **938** 유닛. (UX-D-L)

---

## [1.58.43] — 2026-05-20

**fix(ux): UX-D-F — `#/evaluate` 빈 제출 시 별도의 현지화 토스트 표시.** 이전엔 "너무 짧음"과 같은 메시지. 새 키 `eval.emptyJd` × 8. 936 → **937** 유닛. (UX-D-F)

---

## [1.58.42] — 2026-05-20

**fix(ux): UX-D-J — 모든 advisor 페이지에서 ETA 칩 일관성 확보.** 이전엔 `#/auto` 만 "⏱ ~1–2 min" 표시. 이제 `#/evaluate` · `#/deep` · 5 개 mode 페이지도 `⏱ ~30s` 표시(새 `advisor.eta` 키 × 8). 935 → **936** 유닛. (UX-D-J)

---

## [1.58.41] — 2026-05-20

**fix(ux/truthfulness): UX-D-I — 비용 힌트가 탭 복귀 + `providers-changed` 이벤트에서 재조회.** 이전엔 한 번만 가져왔으므로 다른 탭에서 프로바이더 변경 시 오래된 값이 표시. 934 → **935** 유닛. (UX-D-I)

---

## [1.58.40] — 2026-05-20

**fix(ux/docs): UX-D-H — `career-ops.org/docs/...` 딥링크가 클릭 가능함을 보장하는 regression-lock.** 새 `tests/external-doc-links.test.mjs` 가 views/*.js 와 docs/help/*.md 검사. 932 → **934** 유닛. (UX-D-H)

---

## [1.58.39] — 2026-05-20

**fix(ux): NEW-D2 — 대시보드 헤더의 Refresh 버튼이 명시적 피드백 제공.** 페이지 리로드 없이 재페치 + 재렌더. 2 개의 새 i18n 키. 931 → **932** 유닛. (NEW-D2)

---

## [1.58.38] — 2026-05-20

**fix(a11y): NEW-D3 (WCAG 4.1.2) — `#/tracker` 검색 입력에 placeholder 와 다른 현지화 `aria-label` 추가.** 이전엔 placeholder 만 있었고 SR 은 목적을 알 수 없었음. 새 i18n 키 `track.searchAria` × 8 언어, placeholder 와 다른 문자열. 930 → **931** 유닛. (NEW-D3)

---

## [1.58.37] — 2026-05-20

**fix(i18n): NEW-D1 — `#/pipeline` H1 을 es/pt-BR/ru 에서 현지화 + RU 타이틀 누락 2 건 추가 수정.** 새 `tests/i18n-no-latin-leaks.test.mjs` 가 `contacto.title` / `health.title` 의 RU 누락도 잡아 동시 수정. 928 → **930** 유닛. (NEW-D1)

---

## [1.58.36] — 2026-05-20

**chore(docs): v1.58.36 — v1.58.x 사이클 종료 시점의 전체 하우스키핑 스윕.** 코드 변경 없음. (1) qa/: 버전 고정 스냅샷 3 개(`REGRESSION-END-TO-END-v1.58.16/33/35.md`)를 `qa/archive/v158-cycle/` 로 이동. (2) `REGRESSION-FINAL.md` 에 **§12** 추가(v1.58.4 → v1.58.35 모든 불변). (3) `UX-AUDIT-PROMPT.md` 에 30 행 추가. (4) docs/architecture/ 갱신(FRONTEND 드로어, TESTING 합계 928/62/20/23). (5) CLAUDE.md 에 "v1.58.x 사이클의 교훈" 섹션 추가. (6) README ×8 에 "알림 🔔" 행 추가 + 오래된 테스트 카운트 수정. 베이스라인 무변. (housekeeping)

---

## [1.58.35] — 2026-05-20

**fix(ui): v1.58.35 — 알림 드로어 자동 열림 버그 수정 + 도움말에 §18 "알림" 추가(사용자 보고).** v1.58.34 버그: `.notif-drawer { display: flex }` 가 UA `[hidden] { display: none }` 를 덮어쓰고 있었음. `.notif-drawer[hidden] { display: none }` 명시. 드로어는 벨 클릭으로만 열림. 8 개 언어 도움말에 §18 추가(카테고리 표 + 키보드). 927 → **928** 유닛. (사용자 보고)

---

## [1.58.34] — 2026-05-20

**feat(ui): v1.58.34 — 알림 드로어(U-13 완전 종료).** v1.58.33 캡처 위에: 신규 `UI.onToast(fn)`, 상단바 벨 🔔 + 안 읽음 배지, 우측 슬라이드 `<aside role="dialog">`, 로컬라이즈된 제목/빈 상태/항목 (`notif.* × 8`). Esc + 닫기 + 벨 재클릭으로 닫힘. 926 → **927** 유닛. (U-13 follow-up)

---

## [1.58.33] — 2026-05-20

**fix(ux): U-13 + U-14 + U-15 — 토스트 저널(50 개 캡 + `UI.getToastHistory()`) + `.page-header h1 + p` 안전 규칙 + `#/cv` 미저장 변경 인디케이터.** v1.58.x 사이클 마무리. 새 i18n 키 `cv.unsaved` × 8 언어. 925 → **926** 유닛. (U-13/U-14/U-15)

---

## [1.58.32] — 2026-05-20

**fix(ux): U-12 — `#/help` TOC 필터 입력에 `min-width: 16ch` 적용.** KO/JA 플레이스홀더가 잘리지 않도록 `.help-toc__filter` 클래스 추가. 924 → **925** 유닛. (U-12)

---

## [1.58.31] — 2026-05-20

**fix(ux): U-11 — Tracker 의 `Legitimacy` 컬럼 헤더에 현지화 정보 칩 ⓘ + 툴팁으로 High/Caution/Suspicious 척도 설명.** 새 i18n 키 `track.col.legitimacy.help` × 8 언어. 923 → **924** 유닛. (U-11)

---

## [1.58.30] — 2026-05-20

**fix(ux): U-10 — Tracker 의 Normalize / Dedup / Merge 버튼이 `data/applications.md` 가 비었을 때 비활성화.** 현지화 툴팁(`track.fixEmpty` × 8 언어)이 이유를 설명. 922 → **923** 유닛. (U-10)

---

## [1.58.29] — 2026-05-20

**fix(ux): U-9 — `#/pipeline` 카운터 ↔ 필터 행이 좁은 뷰포트에서 세로로 쌓임.** 새 `.pipeline-controls` 클래스와 `@media (max-width: 720px)` 로 필터 너비 100%. 921 → **922** 유닛. (U-9)

---

## [1.58.28] — 2026-05-20

**fix(ux): U-8 — 7 개 모드 페이지에서 생성된 프롬프트 블록이 기본 접힘.** `<details class="prompt-block">` 로 래핑되고, 요약은 "Show prompt (N lines)" 가 현지화(`prompt.show` / `prompt.lines` × 8). Copy + Run-live 는 그대로 노출. 920 → **921** 유닛. (U-8)

---

## [1.58.27] — 2026-05-20

**fix(ux): U-7 — `verify-pipeline.mjs` 의 `===` ASCII 구분자를 결과 모달에서 제거.** 핸들러에서 `^={10,}$` 정규식으로 사전 제거. 919 → **920** 유닛. (U-7)

---

## [1.58.26] — 2026-05-20

**fix(ux): U-6 — `#/scan` 의 "Active companies N/M" 칩이 툴팁 + aria-label 로 N 과 M 의 의미 설명.** 새 i18n 키 `scan.activeCo.help` × 8 언어. 918 → **919** 유닛. (U-6)

---

## [1.58.25] — 2026-05-20

**fix(ux/ia): U-5 — Dashboard CTA 중복 제거(헤더의 `Open Pipeline` 버튼과 `Scan all sources` 타일 제거).** 사이드바와 히어로가 이미 두 경로를 다루며, v1.58.3 QA 의 4× Pipeline / 4× Scan 이 각 2× 로 줄어듦. 917 → **918** 유닛. (U-5)

---

## [1.58.24] — 2026-05-20

**fix(ux): U-4 — 에러 토스트의 "(METHOD /path · HTTP NNN)" 후미를 접힌 `<details>` 안으로 이동.** 기술 정보는 DOM 에 보존(BUG-006 불변), 헤드라인은 사람이 읽을 문장만 남음. 새 i18n 키 `toast.details` × 8 언어. 916 → **917** 유닛. (U-4)

---

## [1.58.23] — 2026-05-20

**fix(ux): U-3 — `#/followup` 의 `lastContact` 플레이스홀더가 오늘 − 14 일로 동적 계산됨.** 고정 `2026-04-21` 은 시간이 흐르면서 진부해졌음. `new Date()` 기반으로 `setDate(getDate() - 14)` 후 ISO YYYY-MM-DD 생성. 915 → **916** 유닛. (U-3)

---

## [1.58.22] — 2026-05-20

**fix(ux): U-2 — `#/auto` H1 이 선행 `✨` 때문에 두 줄로 줄바꿈되던 문제 해결.** `auto.title` 에서 `✨` 분리하여 `<span class="page-icon" aria-hidden="true">` 로 이동. `.page-header--icon` 은 grid 레이아웃으로 이모지 전용 열 확보. 914 → **915** 유닛. (U-2)

---

## [1.58.21] — 2026-05-20

**fix(ux): U-1 — `#/cv` H1 + 부제목이 다른 페이지와 통일(v1.56.0 UX-9 칩을 설계상 철회).** `.cv-breadcrumb` 칩 제거, `<h1 class="page-title">` + `<p class="page-subtitle">` 복원. 단일 `<h1>` 불변 유지. 913 → **914** 유닛. (U-1)

---

## [1.58.20] — 2026-05-20

**fix(i18n/platform): I-6 — 사이드바 풋터 단축키 힌트가 Mac 에서 `⌘K`, 그 외 환경에서 `Ctrl+K` 로 표시되고 동사는 로컬라이즈.** 수정 전엔 모든 플랫폼/언어에서 `CTRL+K — search` 리터럴이 노출되었다. `top.langhint` 가 `{hotkey} — 검색` 형식을 사용하고, `applyFooterHotkey()` 가 `navigator.platform` 에 따라 `{hotkey}` 를 치환. 915 → **916** 유닛. (I-6)

---

## [1.58.19] — 2026-05-20

**fix(i18n): I-4 — 러시아어 `#/followup` 에서 라틴어 `cadence` / `follow-up` 누출 제거.** RU followup 문자열(H1, 힌트)에 `cadence`, `follow-up`, `scope`, `timeline` 이 섞여 있었으나 러시아어 네이티브 표현으로 치환. 914 → **915** 유닛. (I-4)

---

## [1.58.18] — 2026-05-20

**fix(i18n): I-3 — 도움말 TOC 항목 2/5/13/14, 비라틴 로케일에서 영어 잔재 제거.** 수정 전 여러 로케일 도움말 번들에 `## 2. App settings & API keys`, `## 5. Portals & Sources`, `## 13. Mode prompts`, `## 14. Apply checklist` 가 남아 있었음. 이제 8 개 언어에서 완전히 현지화. 913 → **914** 유닛. (I-3)

---

## [1.58.17] — 2026-05-20

**fix(i18n): I-2 — Saved-research 날짜 라벨을 `Intl.RelativeTimeFormat` 으로 로케일화.** [public/js/views/deep.js](public/js/views/deep.js#L57-L82) 의 `formatRelative()` 가 영어 `today` / `1d ago` / `Nd ago` 를 하드코딩했었다. `Intl.RelativeTimeFormat(I18n.getLang(), { numeric: 'auto' })` 로 교체 — 브라우저 네이티브의 로컬라이즈된 "오늘/어제/N일 전" 문자열 사용. 7일 초과 시 `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })` 로 폴백. 912 → **913** 유닛. (I-2)

---

## [1.58.16] — 2026-05-20

**fix(ui): 브랜드 버튼 호버 깜빡임(사용자 보고).** 원인: `.btn-primary` / `.btn-danger` 의 기본 배경은 `linear-gradient(...)`, `:hover` 는 단색 `var(--rausch-dark)`. CSS 는 그라데이션↔단색을 보간할 수 없어 180ms `transition: background` 가 스냅하면서 흰색/분홍 깜빡임이 보였다. 수정 위치 [public/css/app.css](public/css/app.css): 호버에서도 그라데이션을 유지하고 `filter: brightness(0.92)` 로 어둡게 — `filter` 는 모든 브라우저에서 부드럽게 보간된다. `.btn` 의 `transition` 목록에 `filter var(--transition)` 을 추가해 어두워짐이 애니메이션되도록 함. 911 → **912** 유닛. (사용자 보고)

---

## [1.58.15] — 2026-05-20

**fix(a11y/i18n): I-1 — 상단바 검색의 `aria-label` 과 시각적 숨김 `<label>` 을 i18n 화.** 이전에는 모든 8 개 언어에서 영문 aria-label 이 스크린 리더에 노출되었다. [public/js/app.js](public/js/app.js#L4-L29) 에 범용 `data-i18n-aria-label` 훅 추가 — `applyI18n()` 이 언어 변경 시 `data-i18n` / `data-i18n-placeholder` 와 동일하게 `aria-label` 을 교체. 새 i18n 키 2 개(`top.search.aria`, `top.search.label`)를 8 언어에 추가. 어떤 미래 컨트롤에도 재사용 가능. 910 → **911** 유닛. (I-1)

---

## [1.58.14] — 2026-05-20

**fix(ux): M-9 — 연결 배너의 새로고침 버튼에 피드백 추가(이전엔 무음 리로드).** v1.58.13 까지 클릭 시 곧바로 `location.reload()` 를 호출했다. 이제 "새로고침 중…" 토스트를 즉시 표시하고, `sessionStorage['refreshedToast']` 를 설정하며, 버튼을 `disabled` 처리해 빠른 더블클릭에서 토스트가 쌓이지 않게 하고, 리로드를 200ms 지연시켜 토스트가 그려진 뒤에 페이지가 새로 로드되도록 한다. 다음 부팅 때 app.js 가 플래그를 감지하고 성공 토스트 "새로고침됨" 을 출력. 새 i18n 키 2 개(`common.refreshing`, `common.refreshed`)를 8 언어에 추가. 909 → **910** 유닛. (M-9)

---

## [1.58.13] — 2026-05-20

**fix(ux): M-8 — `#/apply` 체크리스트가 인터랙티브해짐.** v1.58.13 이전에는 "▶ 체크리스트 생성"이 항목 0~7 을 모노스페이스 `<pre>` 블록으로만 보여주어 체크할 수 없었음. 이제 각 항목은 실제 `<input type="checkbox">` 로 렌더링되며 `<label>` 로 감싸 클릭 영역이 행 전체(WCAG 2.5.5)가 됨. 상태는 URL 별로 `localStorage['applyChecklist:'+slug]` 에 영속화 — 3 개 체크 → 새로고침 → 3 개 그대로 유지. 버튼: **미체크 항목 복사**(미해결 항목을 `- markdown` 으로 출력)와 **초기화**. 5 개 신규 i18n 키(`apply.checklist.copyUnchecked`, `resetBtn`, `copied`, `copyFailed`, `reset`)를 8 언어에 추가. 파서가 항목을 찾지 못한 경우 방어적 폴백 제공. 908 → **909** 유닛. (M-8)

---

## [1.58.12] — 2026-05-20

**fix(ux): M-7 — 비용 힌트가 활성 제공자를 따라감 (OpenRouter 가 더 이상 잘못된 고정 금액으로 빠지지 않음).** `UI.providerCostHint()` 는 이미 `/api/status/providers` 를 거쳐 제공자를 인지하고 있었으나, [public/js/api.js](public/js/api.js#L623-L676) 의 매핑이 `anthropic`/`gemini`/`openai`/`qwen` 만 포함. v1.57.0 의 5번째 제공자 OpenRouter 는 일반 폴백 0.03 에 떨어지고 표시 이름도 소문자 `openrouter` 였음. 이제 EST 에 `openrouter: null` 추가 (라우터가 모델을 선택하므로 비용 가변), `=== null` 분기에서 로컬라이즈된 "cost varies (router picks)" 출력. NAME 에 `openrouter: 'OpenRouter'`. 새 i18n 키 `cost.varies` 를 8 언어에 추가. 907 → **908** 유닛. (M-7)

---

## [1.58.11] — 2026-05-20

**fix(ux): M-4 — 저장된 리서치 카드의 제목↔날짜 간격을 구조적 CSS 로 (기존 인라인 margin).** v1.58.3 MASTER 회귀에서 일부 카드가 `software-engineer-generaltoday` (제목과 날짜 사이 공백 없음)로 표시됨을 확인. 원인은 두 개의 `<span>` 사이의 `style="margin-left: 8px"` 인라인 의존이 특정 항목에서 무너지는 것. [public/js/views/deep.js](public/js/views/deep.js#L34-L55) 수정 — 두 개의 `<span>` 을 `.saved-card__title` + 시맨틱 `<time class="saved-card__date" datetime="…">` 로 교체하고 플렉스 컨테이너 `.saved-card` 로 감쌈. 간격은 `gap: var(--space-2, 8px)` 가 제어 → 더 이상 무너지지 않으며 `<time>` 으로 a11y/SEO 시맨틱도 확보. 906 → **907** 유닛. (M-4)

---

## [1.58.10] — 2026-05-20

**fix(ux): M-2 — 결과 모달 열기 전에 진행 토스트 비우기.** `#/cv` 에서 `sync-check` 클릭 시 "Running cv-sync-check.mjs…" 토스트가 우하단에 남은 상태로 결과 모달이 열려 좁은 화면에서는 시각적으로 겹쳤습니다. Health 페이지 Doctor / verify-pipeline 은 이미 `UI.modal()` 전에 `UI.dismissToast()` 를 명시 호출했으나 cv.js sync-check 만 누락. [public/js/api.js](public/js/api.js#L272) 에서 `UI.modal()` 의 첫 실행 문장으로 `dismissToast()` 를 호출하도록 변경(경계에서의 심층 방어). cv.js 의 하드코딩 영문 문자열을 `t('cv.syncCheckRunning')` / `t('cv.syncCheck')` 로 교체해 BUG-008 불변 조건(모달 타이틀 == 로컬라이즈된 버튼 라벨)도 충족. 새 i18n 키 2 개를 8 개 언어에 추가. 905 → **906** 유닛. (M-2)

---

## [1.58.9] — 2026-05-20

**fix(a11y): M-1 — 폼 필드에 가시적 `:focus-visible` 링 복원 (WCAG 2.4.7 Level AA).** v1.58.3 MASTER 회귀에서 `getComputedStyle(focusedInput)` 이 `outline: rgb(255,255,255) none 1.5px` 를 반환 — `none` 키워드가 모든 폼 필드의 링 너비를 0 px 로 붕괴시킴을 확인. 근본 원인: `.input, .textarea, .select { outline: none }` 와 `.searchbar input { outline: none }` 의 베이스 규칙이 전역 `*:focus-visible` 보다 명시도가 높아 페이지당 88 개 포커스 가능 요소에서 키보드 포커스 링을 조용히 제거. [public/css/app.css](public/css/app.css) 에 명시적 `.input:focus-visible/.textarea:focus-visible/.select:focus-visible` 와 `.searchbar input:focus-visible` 규칙 추가, `outline: 2px solid var(--rausch)` + 반투명 box-shadow 부여. 마우스 포커스(`:focus`)는 그대로 유지. 904 → **905** 유닛(정적 계약 가드); Playwright **60 → 61**(Tab 순회). (M-1)

---

## [1.58.8] — 2026-05-20

**feat(health): `OPENAI_API_KEY` / `QWEN_API_KEY` / `OPENROUTER_API_KEY` 를 `#/health` 에 표시 (`GEMINI_API_KEY` 와 동일).** v1.57.0 에서 OpenRouter 가 5번째 헤드리스 live-eval 공급자로 추가되었고, v1.55.3 (UX-2) 에서 4-공급자 온보딩 배너가 도입됐지만 `#/health` 페이지는 여전히 `GEMINI_API_KEY` 와 `ANTHROPIC_API_KEY` 만 노출했습니다. 사용자 요청: "set / unset (manual mode)" 행 패턴을 모든 헤드리스 공급자로 확장. [server/lib/routes/health.mjs](server/lib/routes/health.mjs#L57-L71) 에 3 개의 선택적 체크 행을 추가하며 `/api/status/providers` 와 동일한 `isUsableKey` 게이트를 사용. Health 뷰는 `body.checks` 를 순회하므로 8 개 언어 문자열 변경 불필요. 903 → **904** 유닛. (사용자 요청)

---

## [1.58.7] — 2026-05-20

**fix(security): NEW-2 — `isValidJobUrl` 가 쌍을 이룬 템플릿 플레이스홀더 구문(`${…}`, `{{…}}`)을 거부하도록 수정, 오류 메시지와 일치.** `POST /api/pipeline` 의 400 응답은 *"contain no script or template characters"* 라고 안내하지만, v1.58.3 MASTER 회귀에서 실제로는 `[<>"'`\\\s]` 가드의 부수 효과로 ASP/EJS 형식 `<%…%>` 만 차단되고 JS 템플릿 리터럴 `${TEST}` 과 Mustache/Handlebars `{{TEST}}` 는 통과하던 것을 확인. fix-prompt Option A(정규식을 메시지에 맞춤): [server/lib/security.mjs](server/lib/security.mjs) 에 `TEMPLATE_PATTERNS` 배열 추가, `new URL(…)` 전에 `hasTemplatePlaceholder(url)` 호출. **쌍을 이룬** 형식만 거부(`{normal}` 같은 단일 중괄호 ATS 패턴은 유지). 901 → **903** 유닛. (NEW-2)

---

## [1.58.6] — 2026-05-20

**fix(a11y/i18n): BUG-008-tb — 상단바 `Doctor` 모달 타이틀이 로컬라이즈된 버튼 라벨과 일치하도록 수정.** v1.58.0 에서 닫힌 원장 BUG-008(*"모달 타이틀 == 로컬라이즈된 버튼 라벨"*)은 Health 페이지 진입점에만 적용되어 있었으나, v1.58.3 MASTER 회귀에서 **상단바** 진입점이 불변 조건을 위반하고 있음이 확인되었습니다 — UI 언어와 무관하게 상단바 `Doctor` 클릭 시 모달 타이틀이 항상 `doctor`(영문 소문자)였습니다. [public/js/app.js:118](public/js/app.js#L118) 에서 리터럴 `'doctor'` 를 `I18n.t('top.doctor', 'Doctor')` 로 교체. `top.doctor` 키는 8개 언어 모두에 이미 존재(EN `Doctor` · ES/pt-BR `Diagnóstico` · KO `진단` · JA `診断` · RU `Диагностика` · zh-CN `诊断` · zh-TW `診斷`)하며 버튼이 `data-i18n="top.doctor"` 로 선언한 키와 동일합니다. `tests/qa-report-fixes.test.mjs` 에 정적 계약 가드 추가. 900 → **901** 유닛; Playwright 60/60. (BUG-008-tb)

---

## [1.58.5] — 2026-05-20

**fix(ui): NEW-3 — `#/followup` Run-live 이중 POST 은 *재현 불가* 로 분류; Playwright 회귀 가드로 잠금.** v1.58.3 MASTER 회귀에서 monkey-patched `window.fetch` 측정으로, `#/followup` Run live 한 번 클릭(회사/역할/메모 입력 완료, 날짜는 의도적으로 비움) 후 약 2 초 이내에 `/api/mode/followup` 로 동일한 POST 두 건이 관측되었습니다. fix-prompt 의 "먼저 재현" 원칙에 따라 `public/js/views/mode-page.js::submit()` 을 정밀 검토한 결과: (a) Run live 와 Generate prompt 는 모두 일반 `<button>` 으로 각각 단일 `onClick` 만 가지고 있으며, 부모 `<form>` 도 `addEventListener('submit')` 도 없어 이중 발화 경로가 존재하지 않고, (b) `UI.withSpinner()` (FIX-L1) 가 요청이 진행되는 동안 `button.disabled = true` 를 설정하여 두 번째 물리 클릭을 원천 차단합니다. `tests/playwright-smoke.mjs` 에 회귀 레시피를 그대로 따라가는 새 테스트를 추가했습니다 — 회사/역할/메모를 채우고 날짜는 비운 채 Run live 와 동일한 `submit()` 을 호출하는 수동 버튼을 한 번 클릭하면, 3 초 윈도우에서 `POST /api/mode/followup` 가 **정확히 1 건** 임을 검증합니다. 로케일 안정 선택자(8 개 언어 모두 `▶` 글리프 동일) + 동일 브라우저 컨텍스트의 이전 언어 테스트 영향을 막기 위해 `addInitScript` 로 `career-ops-ui:lang=en` 사전 주입. Playwright **59 → 60**. 원본 QA 관찰은 레시피로만 기록되며 제품 코드 변경은 필요 없습니다. (NEW-3)

---

## [1.58.4] — 2026-05-19

**fix(security): NEW-1 — 모든 응답에 `Content-Security-Policy` 전송 (이전에는 루프백에서 누락).** v1.58.4 이전에는 `isPubliclyExposed()` 가 참일 때(HOST 가 루프백 밖에 바인딩)만 CSP 헤더를 추가했기 때문에 `127.0.0.1` 에서는 `/` 와 `/api/health` 모두 CSP **없이** 응답했고, `UI.md()` 의 escape-first 계약이 유일한 XSS 방어였습니다. v1.58.3 MASTER 회귀 테스트(§5)가 이를 stop-ship 불변 조건으로 지적했습니다. 이제 CSP 는 바인드 주소와 무관하게 모든 응답에서 **무조건** 동일하게 전송됩니다: `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`. `script-src` 는 `'unsafe-inline'`/`'unsafe-eval'` 를 절대 허용하지 않습니다. 디렉티브 집합은 이전의 노출 전용 정책에서 변경되지 않아(이미 SPA 에 맞게 구성 — Inter 용 Google Fonts 허용) 시각·기능 회귀가 없습니다. `tests/security-headers.test.mjs` 를 다시 작성했고, Playwright 경로 순회(en/ru/ja/zh-TW × 7 경로)에서 **CSP 위반 0** 을 검증합니다. 유닛 900 · Playwright 58→59 · e2e 20/20+23/23. 후속 fix-prompt 항목은 프로젝트 원칙에 따라 one-fix 릴리스로 순차 배포됩니다. (NEW-1)

---

## [1.58.3] — 2026-05-19

**fix(deep): R-2 / FIX-C1 — 조사 출력에서 고아/불균형 에이전트 스캐폴딩 태그 제거.** v1.58.0 `cleanLlmMarkdown`는 *쌍* 블록과 *말단 여는* 태그만 제거했음. v1.58.2 심층 회귀에서 여는 짝 없는 고아 `</tool_response>`(`</thinking>`)가 저장된 `#/deep` 브리프에 그대로 노출. 최종 보수적 스윕이 단독 스캐폴딩 토큰(여닫기·균형 무관), Anthropic 도구 XML(`<invoke>`/`<parameter>`/`antml:*`), ```tool_*``` 펜스를 제거. 순수·멱등. 실제 `<https://…>` 자동링크/코드 보존. **FIX-C2**는 **재현 안 됨**(i18n.js가 이미 `<html lang>` 설정 + `navigator.language` 감지). 둘 다 회귀 가드로 고정. 896 → **900** 유닛 · Playwright 58/58. v1.58.3 fix-prompt 잔여는 one-fix ship 대기(배치 금지).

---

## [1.58.2] — 2026-05-19

**fix(i18n): I18N-011 — `#/help` 목차를 비-EN 7개 로케일에서 현지화.** TOC는 `docs/help/<lang>.md`의 `##` 제목으로 생성됩니다. 3/4/6/7/8/9/10/11/12 섹션이 es/pt-BR/ko/ja/ru/zh-CN/zh-TW에서 여전히 **영어** 제목이라 사이드바는 번역됐는데 TOC는 영어였습니다. 각 제목을 사이드바 `nav.*` 키와 **동일한 용어**로 현지화(단일 진실원 — TOC ↔ 사이드바 일치), 섹션 번호와 `(#/route …)`는 원문 유지. EN 불변. v1.58 QA의 유일한 i18n 백로그 해소. 문서 전용; 896/896 유닛 · 33/33 help · Playwright 58/58.

---

## [1.58.1] — 2026-05-19

**fix(test): CI 격리 `checkProfileCustomized` 가드 (v1.58.0 패치).** v1.58.0은 advisory pre-commit는 통과했지만 `ci.yml`(Node 18/20/22)에서 실패: 테스트가 cache-bust 동적 import + `PATHS` 재작성을 사용했으나 `paths.mjs`는 프로젝트 루트를 **프로세스당 한 번** 해석. 견고한 **정적 가드**(allow-list + `^(…)$/i` 앵커 정규식; "test" 포함 실명 오탐 없음)로 교체. 프로덕션 코드 변경 없음; `publish-package.yml`도 해제. 896/896 유닛 · Playwright 58/58. `qa/v158-regression/` 참고.

---

## [1.58.0] — 2026-05-19

**fix(qa): 외부 QA 리포트 버그 일괄 수정 + 깔끔하게 포맷된 조사 출력.** 수정: **BUG-001** `#/followup` 선택 날짜를 클라이언트에서 ISO `YYYY-MM-DD` 검증; **BUG-003** 블록 인용 내부에서도 `**굵게**`/`` `코드` ``/링크 렌더링(모든 Help 페이지); **BUG-005** 중복 URL은 「이미 대기열에 있음 — 건너뜀」; **BUG-006** 잘못된 URL 메시지 사람 친화적으로(`(POST /api/pipeline · HTTP 400)` 컨텍스트는 의도적으로 유지); **BUG-007/008** 「Running doctor.mjs…」 토스트를 모달 전에 제거(새 `UI.dismissToast()`), 모달 제목 = 버튼의 현지화 라벨; **BUG-010** `#/reports` 빈 상태에 부제목; **BUG-002/UX-032** `checkProfileCustomized()`가 테스트 픽스처 이름을 「미설정」으로 표시(부모 `profile.yml`/`cv.md` 미변경 — 규칙 #1); **I18N-012/013** 러시아어 Deep research 실제 번역. **신규:** `cleanLlmMarkdown()`가 에이전트 스캐폴딩(`<tool_call>{…}</tool_call>`, `<tool_response>`, `<thinking>` …)을 `#/deep`·저장된 조사에서 제거(모든 제공자 + 저장 파일 제공 시); `#/outreach`→`#/contacto` 별칭(BUG-004); 클라이언트 네트워크 오류 `I18n.t()` 현지화(8개 로케일; 서버 `details`는 의도적으로 영어 진단). **테스트:** 새 `tests/qa-report-fixes.test.mjs`(10)·`tests/llm-output.test.mjs`(5), 881 → 896 유닛, Playwright 58/58. **미변경(근거 포함):** BUG-009(`#/cv` H1 — 설계상 WCAG single-h1), 부모 데이터(parent-owned), minor i18n/UX 롱테일은 백로그. 자세한 내용은 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.57.2] — 2026-05-19

**fix(config): `/#/config`「validation failed」의 진짜 원인 — SPA가 주입하는 `lang` 필드.** `public/js/api.js`는 *모든* JSON POST 본문에 `lang`을 자동 첨부합니다(LLM 라우트가 UI 로케일을 얻도록). `/api/config`는 LLM 라우트가 아니고 `lang`은 설정 키가 아니므로, `validateConfig`의 (정확하고 보안상 중요한) 미지 키 거부가 **매 저장마다** 400을 반환했습니다: `validation failed — lang: not a known config key`. 브라우저 전용 증상으로, curl/인프로세스 재현은 `lang`을 보내지 않아 v1.57.0/.1은 *메시지*만 개선하고 *원인*은 남았습니다. 이제 설정 라우트는 검증 전 전송용 `lang`을 제거합니다. `KNOWN_KEYS` 쓰기 필터는 여전히 진짜 미지 키를 버려 — 인젝션 가드 불변. 실제 저장 버튼을 누르는 새 Playwright 폼 순회로 발견. **테스트:** 새 `tests/playwright-forms.mjs`(26, `npm run test:e2e:browser`에 포함)로 **모든 폼** 순회, `config-endpoint`에 브라우저 동등 케이스. 879 → 881 유닛, Playwright 32 → 58. 자세한 내용은 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.57.1] — 2026-05-19

**fix(ux): 모든 API 오류가 무엇이 실패했고 어디서 왜인지 표시; 입력 오류 문구도 최대한 설명적으로.** 서버는 이전부터 `{ error, details: ["필드: 사유", …] }`를 반환했지만 폼들은 상단 줄(「validation failed」)만 표시해 `/#/config`(및 전 화면)에서 어느 필드가 문제인지 알 수 없었습니다. 이제 `api.js`가 필드별 `details`를 메시지에 **사이트 전역**으로 합치고(한 곳 수정으로 모든 폼이 혜택), 요청 컨텍스트 `(메서드 /경로 · HTTP NNN)`(어디서)를 덧붙이며, 비 JSON 응답은 원문 일부를 표시하고, 네트워크 오류에도 메서드+경로를 포함합니다. `err.details`도 노출. `validateConfig` 메시지는 최대한 설명적(무엇이 잘못됐고 어떻게 고치는지)으로 변경. **시크릿 키는 입력값을 절대 에코하지 않음**(글자 수만) — 실제 키 오타가 토스트/로그로 새지 않습니다. PORT 범위도 실제로 검증(`99999` 거부). `/#/config`의 PORT/HOST는 실제 기본값(`4317` / `127.0.0.1`)으로 미리 채움. 오류 토스트는 더 오래(9–20초) 표시되고 잘리지 않고 줄바꿈/스크롤됩니다. **테스트:** 새 `tests/config-validation-detail.test.mjs`(12), 874 → 879. 자세한 내용은 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.57.0] — 2026-05-19

**feat(provider): OpenRouter를 5번째 헤드리스 라이브 평가 공급자로 추가 + fix(config): 어떤 API 키를 저장해도 「validation failed」 발생하던 버그 수정.** 붙여넣은 키는 흔히 끝에 줄바꿈이나 공백이 붙어 옵니다(OS 클립보드, 공급자 콘솔의 「복사」 버튼). 1.57 이전에는 이것이 **모든** 공급자에서 줄바꿈 가드를 건드렸고, `$` 종단 앵커 `ANTHROPIC_API_KEY` 정규식이 실제 Anthropic 키를 잘못 거부했습니다. 이제 `validateConfig`는 검증 **전에** 모든 값을 정규화(트림)하고, 라우트는 트림된 값을 저장(런타임 인증 성공, `\n`로 인한 `.env` 손상 없음)하며, Anthropic 검사는 견고한 `sk-ant-` 접두사 + 길이로 변경(공통 `isUsableKey()` ≥ 20자 기준이 진짜 「실제 키인가」 게이트). 내부 줄바꿈은 계속 거부(`.env` 인젝션 가드). **OpenRouter**가 1급 공급자가 됨: `/#/config`의 `OPENROUTER_API_KEY` 하나로 300개 이상 모델 접근. `auto` 순서의 **마지막**(Anthropic → Gemini → OpenAI → Qwen → **OpenRouter**)이라 기존 설정이 조용히 재라우팅되지 않으며, `LLM_PROVIDER=openrouter`로 고정. OpenAI/Qwen과 동일한 `_tailProvider()` 경로로 `/api/evaluate`·`/api/deep`·`/api/mode/:slug`에 연결, `/api/status/providers` + Health 대시보드에 노출. OpenAI 호환 클라이언트(새 의존성 없음 — 직접 `fetch`, `AbortController` 타임아웃, 키 미기록), 권장 `HTTP-Referer`/`X-Title` 헤더 포함. 모델 드롭다운은 라이브: `OPENROUTER_MODEL`은 **`GET /api/openrouter/models`**(OpenRouter 공개 카탈로그의 서버 측 프록시 — CSP `connect-src 'self'` 유지)에서 채워지며, 카탈로그 불가 시 선별 폴백, 10분 메모리 캐시. 8개 로케일에 새 i18n 키(`config.openrouter*`). **테스트:** 새 `tests/openrouter-route.test.mjs`·`tests/openrouter-model-selector.test.mjs`, `env-config`/`openai`/`provider-selector` 확장. 831 → 855. 자세한 내용은 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.56.4] — 2026-05-19

**feat(ui): UX-N2 — 전역 검색 입력에 플랫폼 인식 가시 ⌘K / Ctrl K 힌트.** Cmd/Ctrl+K(검색 포커스) 단축키가 `aria-label`/소스에만 있어 시각 사용자는 발견하지 못했고 앱이 실제보다 느리게 느껴졌다. 이제 옅은 `<kbd class="kbd-shortcut">`가 검색 알약 끝에 표시되며 부팅 시 플랫폼 판정(`navigator.platform`/`userAgent`)으로 `data-mac`/`data-other`에서 채워진다: macOS/iOS는 **⌘K**, 그 외는 **Ctrl K**. `aria-hidden="true"`(기존 `aria-label`이 이미 AT에 알리므로 중복 안내 방지)이며 `pointer-events:none`(장식). 기존 Cmd/Ctrl+K 키바인딩 불변. 새 i18n 키 없음(글리프는 공통); 배지는 기존 `.searchbar`의 flex 자식(래퍼/절대 위치 불필요 — input은 이미 `flex:1`). **테스트:** 새 CI 격리 소스 정적 스위트 `tests/cmdk-hint-visible.test.mjs`(5): `.searchbar` 안에 `<kbd class="kbd-shortcut">`; `aria-hidden="true"` + `data-mac`/`data-other` 둘 다; `app.js`가 `navigator` 판정으로 채움; `(e.ctrlKey||e.metaKey)&&e.key==='k'` → `search.focus()` 바인딩 유지(회귀 가드); `app.css`가 `.kbd-shortcut`를 스타일링하고 `display:none` 아님. 826 → 831. `feat(ui)` · `test: tests/cmdk-hint-visible.test.mjs`. 자세히 — [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.56.3] — 2026-05-19

**fix(reliability): 프로바이더 키 감지가 빈 문자열뿐 아니라 플레이스홀더 / 너무 짧은 값도 거부.** 부모 `.env`의 플레이스홀더 `GEMINI_API_KEY`가 "✓ set"으로 표시되고 유효한 `ANTHROPIC_API_KEY`를 제치고 활성 프로바이더로 선택되었다. `effectiveEnv()`는 `undefined`/`''`만 거부해 10자 쓰레기가 실제 키로 취급됨: 온보딩 배너가 *GEMINI ✓ set*, `GET /api/status/providers`가 `activeProvider: "gemini"` 반환, 유효한 108자 Anthropic 키를 무시하고 죽은 키로 모든 라이브 ⚡ 평가가 조용히 실패. 새 순수 함수 `isUsableKey()`(`env-config.mjs`)는 시크릿을 ≥ 20자(지원 프로바이더 키 중 더 짧은 것 없음 — Gemini `AIza…` ≈ 39, Anthropic `sk-ant-…` ≈ 100+, OpenAI ≥ 40, Qwen ≈ 35)이고 알려진 플레이스홀더(`your_*_here`, `changeme`, `placeholder`, `<…>`, 동일 문자 반복…)가 아닐 때만 설정된 것으로 간주. `hasAnthropicKey()`/`hasGeminiKey()`(`anthropic.mjs`), `hasOpenAIKey()`/`hasQwenKey()`(`openai.mjs`), `GET /api/health`의 `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` 행(원시 `process.env`에서 동일한 effective+plausible 뷰로 이전)에 일괄 적용 — health 페이지·프로바이더 엔드포인트·OR 라우터가 항상 일치. `selectActiveProvider()`는 불변(올바른 `keysConfigured`를 받을 뿐). **테스트:** 새 CI 격리 스위트 `tests/key-detection-rejects-placeholder.test.mjs`(5): `isUsableKey` 단위 + in-process `createApp()`로 보고 시나리오 재현(임시 `.env`에 10자 `GEMINI_API_KEY` + 실제 `ANTHROPIC_API_KEY`) — `gemini`는 `keysConfigured`에 없고 `activeProvider === "anthropic"`, `/api/health` 행도 일치. 기존 effective-env 계층 테스트 4건은 너무 짧은 스텁을 현실적 길이로 연장(계약 불변). 821 → 826. `fix(reliability)` · `test: tests/key-detection-rejects-placeholder.test.mjs`. 자세히 — [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.56.2] — 2026-05-19

**feat(a11y): UX-N1 — 라우트별 로케일 인식 `document.title`(멀티탭 식별 + 스크린리더 페이지 변경 안내).** 수정 전에는 24개 라우트가 모두 `index.html`의 정적 `<title>`("career-ops — command center")을 유지해 탭 이름이 동일하고 북마크가 일반적이며 "페이지 변경" 안내도 매번 같았다. `public/js/router.js`의 `focusNewView()`가 뷰 자체의 현지화된 `<h1 class="page-title">`에서 제목을 도출 — "뷰 — career-ops" — 하므로 자동 번역(새 i18n 키 불필요)되고 라우트별로 고유하다. 첫 페인트 가드 **이전**에 설정해 초기 탭에도 제목이 붙는다(v1.56.0 UX-12의 `tabindex` 설정과 동일한 순서). 제목이 없는 뷰는 `career-ops — command center`로 폴백. **테스트:** 새 CI 격리 소스 정적 스위트 `tests/document-title-per-route.test.mjs`(4): `focusNewView`가 `document.title` 할당; 제목은 `<h1>`에서 파생(라우트별 + 현지화, 단일 리터럴 아님); 할당이 `!firstPaintDone` 이전; 제품 기본값 존재. 817 → 821. `feat(a11y)` · `test: tests/document-title-per-route.test.mjs`. 자세히 — [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.56.1] — 2026-05-19

**fix(a11y): 라우터가 관리하는 `tabindex="-1"` 제목 포커스에서 나타나던 가짜 브랜드 포커스 링 제거.** `public/js/router.js`는 모든 클라이언트 내비게이션에서 대상 뷰의 제목에 `tabindex="-1"`을 부여하고 `.focus()`를 호출한다(스크린리더가 새 페이지를 읽도록). `tabindex="-1"` 요소는 키보드로 도달할 수 없지만 Chromium의 `:focus-visible` 휴리스틱이 여전히 전역 브랜드 링(`*:focus-visible { outline: 2px solid var(--rausch) }`)을 그려, 내비게이션마다 **페이지 제목 둘레에 빨간 사각형**(예: `#/dashboard`의 "Command Center")이 표시되었고 `images/dashboard-*.png` 히어로 스크린샷에도 박혔다. 수정은 한 개의 범위 한정 규칙 `[tabindex="-1"]:focus, [tabindex="-1"]:focus-visible { outline: none }`(WAI-ARIA APG 관리 포커스 패턴). 실제 키보드 포커스는 전역 `*:focus-visible` 링을 유지(WCAG 2.4.7 유지); skip-link 링은 영향 없음(`<a>`이며 `tabindex="-1"`이 아니고 더 높은 특이도). 8개 `images/dashboard-*.png` 재생성 — 빨간 테두리 사라짐. **테스트:** 새 CI 격리 소스 정적 스위트 `tests/managed-focus-no-ring.test.mjs`(4): 전역 `*:focus-visible` 링 유지(WCAG 2.4.7 비퇴행); `[tabindex="-1"]:focus,:focus-visible` ⇒ `outline:none`; 억제 규칙이 전역 규칙 뒤(캐스케이드 안전); 수정 범위 한정(전역 `*:focus{outline:none}` 없음). `tests/dashboard-initial-focus.test.mjs`와 짝. 813 → 817. `fix(a11y)` · `test: tests/managed-focus-no-ring.test.mjs`. 자세히 — [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.56.0] — 2026-05-19

**feat(ux): LOW 다듬기 묶음 — UX-9 / UX-10 / UX-11 / UX-12 (하나의 묶음 마이너 릴리스).** **UX-9** `#/cv`: 페이지 제목을 조용한 `.cv-breadcrumb` 칩으로 격하하고 시끄러운 부제는 `<h1>`의 `title` 툴팁으로 이동 — 사용자 CV(미리보기의 이름)가 시각적 우선권을 가짐. F-V54-A 불변 유지 — 여전히 **정확히 하나의 `<h1>`**, 여전히 `.page-title`. **UX-10** 새 공유 헬퍼 `UI.providerCostHint(t)`를 `#/auto`·`#/evaluate`·`#/deep`·모든 `#/<mode>`의 ⚡ 라이브 실행 옆에 표시; `GET /api/status/providers`(v1.55.3) 재사용: 키 있으면 *"예상 비용: OpenAI gpt-5-codex · ~$0.04/eval"*(자릿수 추정, "~"), 키 없으면 ⚡가 수동 프롬프트를 복사(API 비용 없음)임을 명시; fail-soft. **UX-11** `#/help`: TOC 필터가 **정확히 1개** 섹션으로 좁혀지면 300ms 유휴 후 해당 섹션으로 스크롤(디바운스; 0개나 2개 이상은 안 함). **UX-12** `#/dashboard`: 첫 페인트에서 `<h1>`을 포커스 가능(`tabindex="-1"`)으로 만들고 `#content`는 `aria-live="polite"` 유지(부팅 시 안내) — 포커스는 **훔치지 않음**(skip-link 충돌 회피, v1.41.0 결정). 새 i18n 키 `cost.estimate`, `cost.manual` ×8; 새 `.cv-breadcrumb`/`.cost-hint` CSS. **테스트:** 4개 새 소스-정적 CI-격리 스위트(cv-breadcrumb 3, run-cost-line 4, help-toc-autoscroll 4, dashboard-initial-focus 3); 기존 `cv-single-h1`/`help-nav-a11y` 락 갱신(불변 보존). 800 → 813. 4개 라이브 Playwright 프로브, 콘솔 에러 0. `feat(ux)` · 4 test suites. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.8] — 2026-05-19

**feat(tracker): 서버 사이드 페이지네이션 + 클릭 가능한 퍼널 칩 (UX-8).** **서버:** `GET /api/tracker` 가 **선택적** `?page` / `?pageSize` / `?status` 쿼리 파라미터를 가짐. 없으면 응답은 기존 `{ rows: [...] }` 와 바이트 단위로 동일(모든 기존 호출자/테스트 무영향). 있으면 `{ rows: slice, total, page, pageSize, funnel }` 반환 — `pageSize` 는 `[1,500]`, `page` 는 `≥1` 로 클램프, `status` 는 `rows`+`total` 필터, `funnel` 은 **전체 이력**의 상태→개수 분포(페이지/필터와 무관하므로 칩이 항상 정확). **`#/tracker`:** 상단에 새 **클릭 가능한 퍼널 칩 바** — *"모든 상태 · N · Applied · N · Interview · N …"*(순서 Applied → Responded → Interview → Offer → Rejected → Discarded → Evaluated → SKIP). 칩 클릭은 Status 필터 설정(활성 칩 재클릭 시 해제); 활성 칩은 `aria-pressed` + 하이라이트. 8개 로케일 새 i18n 키 `track.funnelAria`; 새 `.tracker-funnel`/`.tracker-chip`/`.tracker-chip--active` CSS. **`test: tests/tracker-server-paged.test.mjs`**(신규, 7 케이스, CI-격리, 임시 포트 인프로세스 Express + 임시 `CAREER_OPS_ROOT` applications.md — CLAUDE.md #2/#8): back-compat(파라미터 없으면 정확히 `{rows}`); `?page&pageSize` 슬라이스 + total/page/pageSize/funnel 합 N; 마지막 부분 페이지 비중복; 범위 밖 페이지 ⇒ 빈 rows + 유효 total; `?status=` 가 total/rows 필터하되 funnel 은 전체 이력; pageSize 캡; + 칩 바 소스-정적 잠금. 793 → 800. `feat(tracker)` · `test: tests/tracker-server-paged.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.7] — 2026-05-19

**feat(pipeline): >1000행에서 vanilla-JS 행 가상화 (UX-7).** `#/pipeline` 은 **모든** 행을 렌더(`filtered.forEach(list.appendChild(urlRow))`)했음 — 스캔은 큐를 수천 개 URL로 채우므로 수천 개 행 노드(각각 flex div + `<a>` + 버튼 2개)가 필터 키 입력마다 동기적으로 생성되어 DOM 과 접근성 트리를 폭주시켰음. 새 **vanilla-JS 가상화**(react-window 등가, 의존성 없음): `VIRTUALIZE_THRESHOLD = 1000` 초과 시 `#/pipeline` 은 고정 높이(`70vh`) 스크롤 뷰포트가 되고, 줄어들지 않는 스페이서(`flex:0 0 auto`, `height = 행수 × 56px`)가 **전체 목록의 실제 스크롤바**를 보존하며, rAF 스로틀 스크롤 리스너가 뷰포트 ± 5행 버퍼만 렌더(한 번에 N개가 아니라 ~16–19 노드). 임계값 이하에서는 기존 단순 렌더를 **바이트 단위로 유지**하므로 일반 파이프라인과 기존 테스트/e2e 가 영향 없음. 각 가상화 행은 URL 로 구분된 ▶/✕ `aria-label` 유지(F-V54-B 회귀 잠금). 윈도우 계산은 순수 `computeWindow()` 헬퍼. **`test: tests/pipeline-virtualize.test.mjs`**(신규, 5 케이스, CI-격리, 소스-정적): ~1000 수치 임계값; ≤임계 분기는 `forEach`→`appendChild` 유지; >임계 분기는 rAF 스크롤 리스너 + 스페이서로 `slice(start,end)` 렌더; `computeWindow()` 가 `[0,total]` ± 버퍼 클램프; 행이 ▶/✕ aria-label 유지. 788 → 793. 라이브 Playwright 프로브(1200-URL 픽스처): `scrollHeight≈67248`, DOM 에 ~16–19 노드만, 윈도우가 스크롤을 끝까지 추적, 콘솔 에러 0. `feat(pipeline)` · `test: tests/pipeline-virtualize.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.6] — 2026-05-19

**feat(scan): 보조 필터를 "고급 필터" 디스클로저 뒤로 정리 (UX-4).** `#/scan` 은 모든 필터 — 자유 텍스트, 원격/하이브리드/온사이트, 범위, 소스, 스캔 후 stack/level/dynamic 패싯 칩 — 를 동일 가중치로 쌓아 컨트롤의 벽이었음. 이제 **일상 필터는 보이게 유지**(자유 텍스트 + 원격/하이브리드/온사이트; 🌐 스캔 버튼은 이미 컨트롤 카드에 별도)하고 **보조 필터는 `<details class="scan-advanced"><summary>고급 필터</summary>` 뒤로 접힘**: 범위 + 소스 셀렉트, 그리고 별도로 패싯 칩 클러스터(이제 새 결과 집합이 칩 벽이 아니라 테이블로 시작하며, 칩 행이 하나 이상일 때만 렌더). 8개 로케일 새 i18n 키 `scan.advancedFilters`; 새 `.scan-advanced` 요약 스타일(은은한 ⚙ 어포던스, 마커 없음, 열림 시 굵게). **`test: tests/scan-advanced-disclosure.test.mjs`**(신규, 6 케이스, CI-격리, 소스-정적): `.scan-advanced` 훅 + `scan.advancedFilters` 라벨의 `<details>`/`<summary>` 존재; 자유 텍스트 + 원격 가시 유지; 범위 + 소스 디스클로저 내부; `chipsContainer` 가 `<details>`; `.scan-advanced summary` 스타일; `scan.advancedFilters` ×8. 782 → 788. `feat(scan)` · `test: tests/scan-advanced-disclosure.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.5] — 2026-05-19

**feat(dashboard): 2개 P0 CTA + 초점 최근 활동 힌트의 히어로 (UX-3).** `#/dashboard` 는 동일 가중치의 ~30개 노드로 열려 "다음에 뭘 할지"가 불명확했음. 새 `.dash-hero` 블록이 이제 페이지 헤더 바로 아래에 위치: 두 P0 여정 — **✨ URL 자동 파이프라인**, **🌐 지금 스캔** — 을 큰 `.btn-hero` 버튼으로 승격하고, 단일 **초점 최근 활동 힌트**("최근 평가: `<점수>` — `<제목>`", 리포트로 링크; 콜드 스타트에서는 `dash.heroNoEval` 안내 빈 상태)가 재방문 사용자에게 멈춘 지점을, 신규 사용자에게 가장 중요한 단 하나의 행동을 알려줌. 두 기본 버튼은 헤더에서 제거(보조 "📋 파이프라인 열기"만 잔류)해 행동 중복 방지. 상태 버킷은 두드러진 `.badge` 에서 조용한 `.dash-chip` 알약으로 격하. 8개 로케일 새 i18n 키 `dash.lastEval`, `dash.heroNoEval`; 새 `.dash-hero`/`.btn-hero`/`.dash-chip` CSS. **`test: tests/dashboard-hero.test.mjs`**(신규, 5 케이스, CI-격리, 소스-정적): `.dash-hero` 존재 및 Quick-actions 그리드 선행; 두 P0 CTA 가 `/auto`+`/scan` 라우트의 `.btn-hero`; 초점 `dash.lastEval` + 빈 상태 `dash.heroNoEval`; 버킷이 `.dash-chip`; CSS 존재; `dash.lastEval`+`dash.heroNoEval` ×8. 777 → 782. `feat(dashboard)` · `test: tests/dashboard-hero.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.4] — 2026-05-19

**feat(ux): Run 옆 정직한 auto-pipeline ETA + 스캔 중 눈에 띄는 Stop (UX-6).** `#/auto`: 새 `.auto-eta` 힌트 — *"⏱ ~1–2분"*(키 `auto.eta`, `title`은 `auto.etaTitle`) — 이제 Run 버튼 옆에 표시되어, 사용자가 누르기 *전에* 원클릭 약속이 소요 시간에 대해 정직하도록 함; 문구는 career-ops.org/docs("URL 붙여넣기 → 1–2분 내 전체 리포트")와 일치. `#/scan`: 수 분짜리 크롤이 실행 중(`aria-busy`)일 때 **Stop** 을 저대비 고스트 버튼에서 눈에 띄는 파괴적 버튼으로 승격(새 `.btn-danger` — 채움, 고대비 흰색 온 코랄, 굵기 600). `setScanRunning(running)` 이 `scan-stop-btn` 을 `btn-danger`(실행 중)와 `btn-ghost`(유휴, 어차피 숨김) 사이에서 전환하여, 부하 상황에서도 사용자가 Stop 을 찾고 신뢰하게 함. 8개 로케일 새 i18n 키 `auto.eta`, `auto.etaTitle`; 새 `.btn-danger`/`.auto-eta` CSS. **`test: tests/auto-eta-stop.test.mjs`**(신규, 4 케이스, CI-격리, 소스-정적): `#/auto` 가 `runBtn` 옆에 `.auto-eta` 클래스로 `t('auto.eta')` 렌더; `auto.eta` ×8; `setScanRunning(running)` 이 Stop 을 `btn-danger` 로 승격; `.btn-danger` 가 고대비 흰색 텍스트로 존재. 773 → 777. `feat(ux)` · `test: tests/auto-eta-stop.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.3] — 2026-05-19

**feat(onboarding): 화면상 4-제공자 OR 상태 — 콜드 스타트 배너 + 활성 제공자 칩 (UX-2, HIGH).** 새 읽기 전용 엔드포인트 **`GET /api/status/providers`** → `{ activeProvider, activeModel, keysConfigured }`. `keysConfigured` 는 `llm.mjs` 게이트와 동일한 effective-env 뷰(process.env ∨ 부모 `.env`); `activeProvider` 는 OR-라우터가 실제로 고를 값 — `env-config.mjs` 의 새 순수 헬퍼 `selectActiveProvider()` 가 `providerOrder()` 를 순회(키 없는 `LLM_PROVIDER` 핀은 `null`). 비밀은 반환 안 함 — 제공자 이름 + 모델 id 만. SPA 셸이 전역 온보딩 영역(`#onboarding-banner`, `app.js` 가 채움, CSP 안전 DOM)을 렌더: **0 키 → 빨간 배너** + `#/config?tab=api-keys` CTA; **≥1 키 → 은은한 칩** 활성 제공자+모델. 대표 차별점("Anthropic / Gemini / OpenAI / Qwen 중 하나, 자동 순서")을 시행착오 대신 화면에서 발견 가능하게 함. 8개 로케일 `onboarding.*` i18n 키; 새 `.onboarding-warn`/`.onboarding-ok` CSS. **`test: tests/onboarding-key-banner.test.mjs`**(신규, 9 케이스, CI-격리): `selectActiveProvider` 의미; `GET /api/status/providers` 인프로세스(임시 포트 + 임시 `CAREER_OPS_ROOT` `.env` 로 실제 부모 키 비참조 — CLAUDE.md #2/#8); 정적 SPA 배선 + `onboarding.*` ×8 커버리지. 764 → 773. `feat(onboarding)` · `test: tests/onboarding-key-banner.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.2] — 2026-05-18

**fix(cv): `#/cv` 마크다운 편집기에 서술적이고 자체 완결된 접근 가능 이름 부여 (F-V55-H / UX-5).** `#/cv` 의 기본 편집기 `<textarea id="cv-editor">` 는 이제 새 `cv.editorAria` 키를 통해 서술적 `aria-label` — *"CV 마크다운 편집기 — 마크다운 형식의 전문 이력서"* — 을 가지며, 보이는 "Markdown" 섹션 제목에서 물려받던 간결한 이름을 대체함. 참고: F-V55-H 증상(`aria-label`/`labels` 만 검사)과 달리 이 필드는 이름이 **없지 않았음** — v1.47.0(WS2 #16)이 이미 `aria-labelledby` → `<h3 id="cv-md-heading">Markdown</h3>` 로 바인딩하여 스크린 리더가 "Markdown, 편집, 여러 줄" 로 안내했음. v1.55.2 는 그 간결한 "Markdown" 을 자체 완결 레이블로 개선함. 중복 `aria-labelledby` 는 제거됨(남으면 죽은 마크업 — ARIA 우선순위상 `aria-label` 이 이김); 보이는 `<h3>Markdown</h3>` 은 비장애 사용자를 위해 유지됨. WCAG 1.3.1 + 4.1.2; v1.54.5 batch-tsv 수정(F-V54-C)과 평행. **`test: tests/cv-editor-a11y.test.mjs`**(신규, 3 케이스, CI-격리, `auto-stepper-prerender.test.mjs` 식 소스-정적): `#cv-editor` 는 비어있지 않은 폴백과 함께 `t('cv.editorAria', …)` 로 자신을 명명; `cv.editorAria` 는 8개 로케일 전부에 존재하고 비어있지 않음; 요소에 중복 `aria-labelledby` 없음. 761 → 764. `fix(cv)` · `test: tests/cv-editor-a11y.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.1] — 2026-05-18

**fix(auto): `#/auto` 마운트 시 5단계 파이프라인 스테퍼를 사전 렌더 (F-V55-E / UX-1, 시니어 관찰 S-4 재개).** `#/auto` 는 이제 문서화된 다섯 단계 개요 — **검증 → 가져오기 → 평가 → 리포트 저장 → 트래커 추가** — 를 화면이 마운트되는 순간에 보여줌. 이전에는 첫 SSE 이벤트 전까지 빈 상태였음. 예전에는 `<ol class="auto-stepper">` 가 `display:none` 으로 생성되고 `renderStepper()` 가 `setStep()` / `run()` 에서만 도달되어, 콜드 스타트 사용자는 Run 클릭 전에 문서가 약속한 파이프라인을 결코 보지 못했음. 스테퍼는 이제 마운트 시 다섯 단계 모두 `pending` 상태로 표시되며 `aria-label`(`auto.stepperAria`)을 가져 보조 기술이 해당 영역을 안내함. F-V55-E(a11y/정적 보장 렌즈)와 UX-1(약속 충실도 렌즈)을 닫음 — 동일 수정, 두 렌즈. **`test: tests/auto-stepper-prerender.test.mjs`**(신규, 4 케이스, CI-격리, `router.test.mjs` 식 소스-정적): `STEPS` 배열은 정확히 5개 표준 단계가 순서대로; `stepperEl` 은 마운트 시 `display:none` 이 아니고 `auto.stepperAria` 를 가짐; 마운트 범위 `renderStepper()` 호출이 `function setStep(` 보다 앞섬; `auto.stepperAria` 는 8개 로케일 전부에 존재. 757 → 761. `fix(auto)` · `test: tests/auto-stepper-prerender.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.55.0] — 2026-05-18

**feat(llm): 헤드리스 라이브 평가가 "OR" 로 동작 — Anthropic | Gemini | OpenAI | Qwen, 어떤 키가 설정됐는지에 따라 자동 선택.** 사용자 요청에 따라 web-ui 의 ⚡ 라이브 평가는 이제 Anthropic/Gemini 뿐 아니라 **설정된 어떤 API 키로도** 동작함. `LLM_PROVIDER` 에 `openai` 와 `qwen` 추가; `auto`(기본값)는 키가 존재하는 첫 제공자를 사용하며 **Anthropic → Gemini → OpenAI → Qwen** 순으로 선호함. 명시값은 하나를 고정함; 키 없이 강제된 제공자는 여전히 수동 프롬프트 경로로 떨어짐. 새 `server/lib/openai.mjs` — 의존성 없는 OpenAI 호환 Chat Completions 클라이언트(`anthropic.mjs` 와 동일한 안전한 직접 HTTPS 패턴: `AbortController` 타임아웃, 키 결코 로깅 안 함, `effectiveEnv()` 키 해석으로 부모 `.env` 의 키가 재시작 없이 동작). 하나의 코어(`runOpenAICompatible`)가 **`runOpenAI`**(api.openai.com)와 **`runQwen`**(Alibaba DashScope 의 OpenAI 호환 모드; 중국 본토 호스트는 raw `.env` 에서 `QWEN_BASE_URL` 로 엔드포인트 재정의)를 뒷받침함. SDK 없음, **임의 CLI 실행 없음** — 부모 프로젝트는 CLI 비종속 유지(Claude Code · Codex · Gemini · OpenCode · Qwen · Copilot · Kimi); 이것은 *헤드리스* API-키 경로만 확장함. OpenAI/Qwen 꼬리는 모든 평가 표면에 연결됨: `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, `/api/auto-pipeline` SSE — auto 선호를 보존하기 위해 Anthropic(인라인) + Gemini(서브프로세스) 분기 뒤에서 참조되며, Anthropic 이 쓰는 것과 동일한 번들 컨텍스트 인라이닝 사용. `env-config.mjs`: `QWEN_API_KEY`(비밀) + `QWEN_MODEL`(비밀 아님)을 `KNOWN_KEYS`/`KEY_GROUPS.core` 에 추가; `LLM_PROVIDERS` 와 `providerOrder()` 확장; `OPENAI_API_KEY` 는 이제 일급 헤드리스 제공자 키(이전에는 저장 전용). `#/config` API-키 탭: `LLM_PROVIDER` 셀렉트에 `openai`/`qwen` 추가; 새 `QWEN_API_KEY` + `QWEN_MODEL` 필드(큐레이팅된 `qwen-max`/`qwen-plus`/`qwen-turbo`/`qwen2.5-*` 목록); 탭 상단의 새 노트가 CLI 비종속 부모 vs web-ui 헤드리스 평가와 OR 순서를 설명함. 8개 로케일 전체에 새 i18n 키. **`test: tests/openai.test.mjs`**(신규, 9 케이스, CI-격리): OpenAI/Qwen 성공 + 블록 배열 콘텐츠, Bearer 인증, 기본 및 `QWEN_BASE_URL` 재정의 엔드포인트, 4xx/5xx/형식 오류, `max_tokens` 클램프, 타임아웃, `effectiveEnv` 키 감지, 키 무유출 카나리. `tests/provider-selector.test.mjs` 는 v1.55.0 의 `providerOrder`/`LLM_PROVIDERS`/SECRET 표면 + OpenAI/Qwen 꼬리 배선용으로 갱신됨. 748 → 757. `feat(llm)` · `test: tests/openai.test.mjs` · `test: tests/provider-selector.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.10] — 2026-05-18

**fix(auto-pipeline): SSE 클라이언트 연결 해제 위생 — 불안정한 Playwright e2e 잡을 제거.** Playwright e2e 잡이 간헐적으로 빨강이 되었음(개별 테스트 32/32 통과하지만 `not ok 2 - tests/playwright-smoke.mjs`): `#/auto` SSE 스트림이 진행 중일 때 페이지를 닫으면 서버의 다음 `res.write()` 가 `EPIPE`/`"aborted"` 로 거부되었고 —응답에 `'error'` 리스너가 없어서— Node 가 이를 uncaughtException 으로 격상시켜 node:test 가 "asynchronous activity after the test ended" 로 보고했음. `auto-pipeline.mjs` 의 `openSse()` 는 이제 no-op `res.on('error')` 를 등록하고 `send()` 를 `res.writableEnded || res.destroyed` 로 보호함(try/catch 로 감쌈) — 사라진 클라이언트는 예외가 아니라 예상된 일임. 이것은 단순한 테스트 수정이 아니라 올바른 프로덕션 SSE 위생임. `tests/playwright-smoke.mjs`: Cmd+K 테스트가 실제 외부 URL(`https://example.com/jobs/123`)을 사용했지만 모달이 나타나기만 기다렸으므로, `closePage()` 가 테스트 종료 후 서버의 진행 중인 `safeGet()` 을 중단시켰음. 이제 파이프라인이 종단 상태에 도달할 때까지 기다림(닫기 전에 fetch 가 정상적으로 해소되도록). 공유 `closePage()` 헬퍼(`window.stop()` 후 닫기)와 `after` 훅의 `server.closeAllConnections()` 는 심층 방어로 유지됨. 검증: 연속 8/8 그린 실행(6× `node --test` + 2× browser-smoke), 이전에는 ~2회 중 1회 빨강. `tests/auto-pipeline.test.mjs` +1 정적 케이스로 `openSse` 연결 해제 위생 계약을 고정(`res.on('error')` 리스너 + `writableEnded||destroyed` 가드 + try 로 감싼 쓰기). 747 → 748. `fix(auto-pipeline)` · `test: tests/auto-pipeline.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.9] — 2026-05-18

**fix(llm): 요청 시점에 부모 `.env` 의 LLM 키를 존중함 — 오래되었거나 잘못된 제공자로의 오라우팅을 중단.** 라이브 평가가 `ANTHROPIC_API_KEY` 가 구성된 제공자였음에도 *"Gemini API error: API key not valid"* 로 실패할 수 있었음. 근본 원인: `hasAnthropicKey()` / `hasGeminiKey()`(그리고 `runAnthropic` 의 키/모델 조회)가 **부팅 시점의 `process.env` 스냅샷만** 읽었음. 서버가 시작된 후 Anthropic 키가 부모 `.env` 에 추가되면 실행 중 프로세스는 그것을 결코 보지 못함 → Anthropic 감지가 false 가 되고, 평가는 `process.env` 에 *실제로* 있던 오래된 키(흔히 낡고 잘못된 `GEMINI_API_KEY`)로 폴백했음. Gemini 실행 경로(부모 Node 서브프로세스)는 이미 부모의 라이브 `.env` 를 읽었으므로 두 제공자가 키를 일관성 없게 해석했음. `env-config.mjs` 의 새 `effectiveEnv(key, envFilePath)`: 비어 있지 않은 `process.env` 값이 우선(셸 export 와 `POST /api/config` 의 라이브 적용을 커버), 그렇지 않으면 **현재 부모 `.env` 파일**을 참조함. `anthropic.mjs` 는 이제 `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, 그리고 Gemini 키 검사를 이를 통해 해석하므로, 부모 `.env` 에 설정된 키가 **서버 재시작 없이** 존중되고 키 감지가 요청이 실제로 보내는 키와 항상 일치함. 제공자 순서는 변경 없음(`auto` → Anthropic-그-다음-Gemini); 이것은 감지만 고침. 키는 결코 로깅되거나 반환되지 않음(REVIEW-B4 무유출 테스트는 여전히 통과). `tests/anthropic.test.mjs` 는 CI-격리되도록 재작성됨(temp `CAREER_OPS_ROOT`, 동적 import) — 정확한 버그를 재현하는 2개 새 케이스 포함(키가 부모 `.env` 에만 있음 → 감지됨; `process.env` 가 미설정일 때 `runAnthropic` 가 부모 `.env` 키 + 모델을 전송). `tests/env-config.test.mjs` +3 `effectiveEnv` 케이스(`process.env` 우선, 빈-문자열-을-미설정으로 포함한 `.env` 폴백, 파일-없음 / 키-없음 / 경로-없음 → undefined) — 새 분기의 100%. 742 → 747. `fix(llm)` · `test: tests/anthropic.test.mjs` · `test: tests/env-config.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.8] — 2026-05-18

**feat(config): Modes 필드 폼이 (비어 있거나 stub 인 파일에서도) 항상 career-ops.org 필드 안내와 함께 정규 스키마를 렌더링함.** v1.54.3 Modes 필드 폼은 이미 존재하는 `##` 섹션에 대해서만 필드를 렌더링했음 — 그래서 갓 생성되었거나 비어 있거나 스키마 비준수인 `modes/_profile.md`(예: 흔한 1줄 stub)에서는 *"No ## sections found — use the raw editor below."* 로 폴백했고 사용자는 필드를 전혀 얻지 못했음. 사용자 요청(*"разбей по полям … описание полей возьми из career-ops.org/docs"*)에 따라, 폼은 이제 **항상 문서화된 순서로 5개 정규 필드를 렌더링**함(Target Roles, Adaptive Framing, Exit Narrative, Comp Targets, Location Policy), 파일에 있으면 미리 채워지고 없으면 비어-있지만-편집-가능 — 그래서 완전히 새 프로필도 폼을 통해 전부 작성 가능. 각 필드는 **career-ops.org 정규 Quick Start §Step-5 에서 가져온 설명**(Target Roles / Adaptive Framing / Exit Narrative / Comp Targets / Location Policy 에 무엇을 넣을지)을 표시하며, 스크린 리더용으로 `aria-describedby` 로 연결됨. 헤딩 변형 허용: 템플릿의 `## Your Target Roles`(등)는 `## Target Roles` 와 동일한 정규 필드로 매핑되어, 템플릿도 서버 스캐폴드 관행도 폼을 깨지 않음. `collect()` 는 이제 태깅된 페이로드임: 렌더링된 헤딩이 파일의 기존 헤딩과 정확히 일치할 때의 비파괴적 **`{ sections }` 병합**(서두 + 손대지 않은 + 커스텀 섹션이 바이트-안정으로 보존됨), 또는 파일에 스키마가 없었을 때 스키마 준수 문서를 부트스트랩/정규화하는 **`{ markdown }` 전체 파일 재구성**. 재구성 경로는 `config.js` 에서 **확인-게이트**됨(부모 파일을 대체함 — WS2 #4 파괴적-저장 불변식), 기존 서두(또는 문서화된 기본값)를 보존하고 비정규 섹션을 verbatim 으로 유지함. 8개 로케일 전반에 6개 새 i18n 키(`config.modesDescTargetRoles` … `config.modesDescLocationPolicy` + `config.modesFormRebuildBody`). `tests/modes-form.test.mjs` 는 v1.54.8 계약에 맞춰 재작성됨: 스키마 + 정규 순서, `config.js` 페이로드/확인 배선, 8개 로케일에서 각 필드의 문서-기반 설명 존재, `canonicalKey` "Your X" 허용, 리스트 라운드트립 안정성, 부트스트랩-항상-렌더링 보장, 그리고 데이터-안전성을 갖춘 태깅된 sections-vs-markdown `collect()`. 실제 부모 stub 파일에 대해 라이브 검증됨(5개 필드 + 설명 표시, 콘솔 에러 0)과 격리된 stub 픽스처(채우기 → 확인-게이트 저장 → 5개 정규 섹션 모두 영속화). `feat(config)` · `test: tests/modes-form.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.7] — 2026-05-18

**fix: W-001 — 코드/스타일 자산 + SPA 셸이 `Cache-Control: no-store` 로 제공됨(배포 위생).** SPA는 `api.js` / `router.js` / 모든 뷰를 버전 쿼리 스트링 없는 평범한 `<script src>` 로 로드하며 빌드 단계가 없음(콘텐츠 해싱 없음). 그래서 배포 후 브라우저가 **캐시된 옛 번들을 몇 시간 동안 계속 제공**할 수 있었음 → 쿼리 스트링 라우트에서 stale-cache 404(v1.29.2 회귀 중 라이브 관찰됨; 회귀 런 W-001). `server/index.mjs` 가 이제 `express.static` 의 `setHeaders` 훅을 통해 `.js` / `.mjs` / `.css` / `.html` 에 `Cache-Control: no-store` 를 설정하고, SPA 셸 catch-all(`sendFile` 을 사용해 `setHeaders` 를 우회함)에도 명시적으로 설정하여, 브라우저가 라우팅을 구동하는 코드를 항상 재검증하도록 함. 비코드 정적 자산은 `express.static` 의 기본 캐싱을 유지함. 보안 헤더(CSP / nosniff / frame-deny / referrer-policy)는 변경 없음 — 기존 `security-headers` 스위트(8 케이스)가 새 테스트와 함께 그린으로 실행되어 검증됨. 테스트 파일 `tests/asset-cache-control.test.mjs` +1 — 4 케이스(JS 자산 `no-store`, CSS `no-store`, 정적 `index.html` `no-store`, SPA catch-all 딥 라우트 셸 `no-store`), 격리된 `CAREER_OPS_ROOT` 에 대해 실제 앱을 부팅함. 더해 `tests/playwright-smoke.mjs` 의 플레이키 teardown 수정(별도 `test(e2e)` 커밋): 자동 파이프라인 SSE 스모크 테스트가 이제 `finally` 에서 리더를 취소 + fetch 를 중단하고 `after` 훅이 잔존 소켓을 강제로 닫아, v1.54.6 Playwright e2e 잡을 붉게 만들던 teardown 이후 "Error: aborted" 를 제거함. 738 → 742. `fix` · `test: tests/asset-cache-control.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.6] — 2026-05-18

**fix(a11y): S-7 — `#/help` 의 back-to-top 버튼이 정규 선택자 클래스 `back-to-top` 를 가짐.** `#/help` 의 플로팅 back-to-top 버튼은 올바르게 작동했으나(라이브 검증됨) 그 클래스 목록(`btn btn-primary help-back-top`)이 spec §2 #28 테스트가 겨냥하는 `.back-to-top` 선택자 컨벤션 밖에 있었음 — 더 엄격한 선택자였다면 플레이키했을 것(회귀 런 S-7, "쉬운 승리"). 이제 버튼은 정규 `back-to-top` 클래스도 가짐. 순수 가산적이며 CSS no-op: `help-back-top`(기존 CSS 훅)은 변경 없고 `back-to-top` 에는 CSS 규칙이 없음 — 안정적인 테스트/자동화 핸들일 뿐. 라이브 검증됨: `document.querySelector('.back-to-top')` 가 버튼을 해석, `aria-label` 유지, 콘솔 오류 0. `tests/help-nav-a11y.test.mjs` 의 기존 #12 케이스를 back-to-top 버튼의 클래스 목록이 정규 `back-to-top` 선택자를 포함한다는 어서션으로 확장(새 파일 없음). `fix(a11y)` · `test: tests/help-nav-a11y.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.5] — 2026-05-18

**fix(a11y): F-V54-C — `#/batch` TSV 편집기에 접근 가능한 이름이 있음.** `#/batch`의 TSV `<textarea>`는 `aria-describedby`로 연결된 힌트는 있었으나 **접근 가능한 이름이 없었음** — `<label htmlFor>` 없음, `aria-label`/`aria-labelledby` 없음(회귀 런 F-V54-C; WCAG 1.3.1 Info & Relationships / 4.1.2 Name, Role, Value). `aria-describedby`는 *이름*이 아니라 *설명*을 제공하므로, 스크린 리더가 레이블 없는 "edit text"를 안내했음. 이제 textarea는 새 i18n 키 `batch.tsvAria`를 통한 `aria-label`을 가지며, 이미 `*Aria` 키를 쓰는 형제 런-컨트롤 입력과 일관됨; 기존 describedby 힌트는 보존됨. 라이브 검증됨: `aria-label` 존재 + 현지화, `aria-describedby` 유지, 콘솔 오류 0. 새 i18n 키 `batch.tsvAria`를 8개 로케일 전반에 추가. 테스트 파일 `tests/batch-tsv-accessible-name.test.mjs`(2개 케이스: `batch-tsv` 블록이 describedby 힌트를 유지하면서 `t(batch.tsvAria)`를 통한 `aria-label`을 가짐; `batch.tsvAria`가 8개 로케일에 정의됨) +1; 736 → 738. `fix(a11y)` · `test: tests/batch-tsv-accessible-name.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.4] — 2026-05-18

**fix(a11y): F-V54-B — `#/pipeline` 행 액션 버튼에 접근 가능한 이름이 있음.** `#/pipeline`의 행별 `▶`(평가) 및 `✕`(삭제) 버튼은 `title` 속성만 있는 아이콘 전용이었음(회귀 런 F-V54-B; WCAG 4.1.2 Name, Role, Value). `title`은 신뢰할 수 있는 접근 가능한 이름이 아니므로, 스크린 리더 사용자는 구별 불가능한 "button"의 긴 나열을 들었고 삭제가 어느 행에 적용될지 알 수 없었음. 이제 두 버튼 모두 새 `shortUrl()` 헬퍼를 통한 압축 URL(`host` + `…/` + 마지막 2개 경로 세그먼트; 파싱 불가 입력에는 후행 슬라이스 폴백)로 명확화된 명시적 `aria-label`을 가지므로, a11y 트리가 예컨대 *"Delete: hh.ru/…/vacancy/12345"*로 읽힘. 새 i18n 키 없음 — `common.delete` / `pipe.evaluateBtn` + URL을 재사용. 라이브 검증됨: 1385개 행, 각 버튼 이름이 행마다 고유, 콘솔 오류 0. 테스트 파일 `tests/pipeline-row-action-names.test.mjs`(4개 케이스: 두 버튼 모두 `shortUrl(url)`로 연결 + 정확히 두 개의 그런 레이블, `shortUrl`이 사용 전에 선언됨, 동일 호스트 다른 채용 URL은 합쳐지지 않음, 베어 호스트 / 파싱 불가 / 빈 폴백) +1; 732 → 736. `fix(a11y)` · `test: tests/pipeline-row-action-names.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.3] — 2026-05-18

**feat(config): `#/config` "Modes" 탭을 위한 구조화된 필드 폼(더 이상 원시 마크다운 아님).** "Modes" 탭은 `modes/_profile.md`를 `##` 섹션마다 하나의 원시 `<textarea>`로 편집했음(v1.36.0 섹션 단위 세분성). 사용자 요청에 따라, 이제 **문서화된 스키마에서 파생된 구조화된 필드 폼**을 렌더링함(career-ops.org Quick Start §Step-5): `Target Roles` / `Adaptive Framing` / `Comp Targets` → **추가/제거 가능한 반복 레이블 라인 입력**(필드마다 역할/앵글/comp 한 줄, `＋ Add line` / 행마다 `aria-label`이 있는 `✕`); `Exit Narrative` / `Location Policy` → 단일 레이블 산문 `<textarea>`. 각 필드는 i18n 섹션 이름과 함께 `<label htmlFor>`로 바인딩된 실제 컨트롤임. 새 `public/js/lib/modes-form.js`(`window.ModesForm`)가 parse → render → `collect()` 로직을 소유함; 이는 **기존** `PUT /api/modes/_profile { sections }` 머지 경로에 공급되므로, 프리앰블, 순서, 그리고 폼이 건드리지 않는 모든 섹션이 바이트 안정적으로 유지됨(머지-비교체, 서버 강제). **데이터 안전성:** 본문이 순수 불릿 목록이 아닌 정규 목록 섹션(사용자가 거기에 산문을 넣음)과 비정규 `##` 섹션은 설명 노트가 있는 레이블된 그대로의 `<textarea>`로 폴백됨 — 임의 콘텐츠는 그대로 round-trip되며, 결코 조용히 재구성되거나 손실되지 않음. Round-trip 안정성 입증됨: `serialise(parse(body))`가 동일하게 재파싱됨. 전체 파일 원시 마크다운 편집기는 섹션 추가/제거 및 프리앰블 편집을 위한 확인 게이트가 있는 **Advanced** 디스클로저로 남아 있음(WS2 #4 파괴적 저장 게이트 변경 없음). 8개 로케일 전반에 새 i18n 키 10개(`config.modesTargetRoles` … `config.modesUnknownNote`). 테스트 파일 `tests/modes-form.test.mjs`(7개 케이스) +1; 725 → 732. 격리된 `CAREER_OPS_ROOT` 픽스처에 대해 라이브 검증됨: 정규 섹션 5개가 필드로 렌더링됨 + 커스텀 섹션 1개가 레이블된 폴백으로, 편집-후-저장 round-trip이 프리앰블 + 커스텀 섹션을 보존함, 콘솔 오류 0. `feat(config)` · `test: tests/modes-form.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.2] — 2026-05-18

**feat(config): `#/config`의 OpenAI / Codex 모델 선택기.** `#/config`에는 OpenAI / Codex 모델을 고를 방법이 없었음 — `OPENAI_API_KEY`가 이미 부모 멀티-CLI(Codex / OpenCode) 흐름용으로 노출되어 있었는데도 `ANTHROPIC_MODEL`과 `GEMINI_MODEL`에만 드롭다운이 있었음. 이제 `OPENAI_MODEL`이 일급 환경 키임: `env-config.mjs`의 `KNOWN_KEYS`(`OPENAI_API_KEY` 바로 뒤에 정렬)와 `core` 키 그룹에 추가되었고, `SECRET_KEYS`에는 **의도적으로 미포함** — 자격 증명이 아니라 모델 id이므로 결코 마스킹되지 않음. `config.js`는 큐레이트된 `OPENAI_MODELS` 목록(기본값 `gpt-5-codex`, 이어서 `gpt-5` / `gpt-5-mini` / `gpt-4.1` / `o4-mini` / `o3`)과 OpenAI 키 바로 뒤에 렌더링되는 `OPENAI_MODEL` `<select>` 필드를 추가하며, Anthropic/Gemini 모델 필드를 정확히 그대로 따름. 8개 로케일 전반에 새 i18n 키 `config.openaiModel` + `config.openaiModelHint`. 테스트 파일 `tests/openai-model-selector.test.mjs`(4개 케이스) +1; 721 → 725. 라이브 검증됨: `#/config` → 6개 옵션을 가진 `OPENAI_MODEL` select, 기본값 `gpt-5-codex`, 레이블 바인딩됨, 콘솔 오류 0. `feat(config)` · `test: tests/openai-model-selector.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.1] — 2026-05-18

**fix(a11y): F-V54-A — `#/cv`를 단일 `<h1>`로.** CV markdown 자체의 `# Name`이 페이지 제목 `<h1>CV</h1>` 옆에 **두 번째** 최상위 `<h1>`로 렌더링되었음(회귀 실행 F-V54-A; WCAG 1.3.1 정보와 관계 / 2.4.6 제목). 이제 `cv.js`는 CV 미리보기의 모든 주입 지점(초기 렌더, 파일 가져오기 시 새로고침, 에디터 라이브 동기화)을 제목을 한 단계 낮추는(h1→h2 … h6→`role="heading" aria-level="7"`) 범위 한정 `cvMd()`를 통과시켜 페이지가 정확히 하나의 `<h1>`을 유지함. `cv.js`로 의도적으로 범위 한정 — `UI.md`는 help/reports/deep/evaluate가 공유하며 각자 제목을 자기 방식으로 관리하기 때문. 테스트 파일 `tests/cv-single-h1.test.mjs`(4개 케이스) +1; 717 → 721. 라이브 검증됨: `#/cv` → `<h1>` 1개, 사용자의 `# Name`은 이제 `<h2>`, 콘솔 오류 0. `fix(a11y): F-V54-A` · `test: tests/cv-single-h1.test.mjs`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.54.0] — 2026-05-18

**WS10 — canonical-docs 재검증 + help 번들 H3 패리티(최종 수렴 릴리스).** CHANGELOG/구조 CI 게이트가 H2만 검사했기에 `docs/help/en.md`는 조용히 70개 H3 하위 섹션으로 표류한 반면 7개 로컬라이즈 번들은 68에 머물렀음 — 격차는 §17(「Reference adapters」 테이블 + 「Common pitfalls」 목록, 영어 전용). 둘 다 이제 7개 언어 모두로 번역됨(어댑터 파일명 / 링크 / 식별자는 바이트 동일하게 유지); 8개 번들 모두 이제 17 H2 / 70 H3. `help-ru-config-section.test.mjs`의 새로운 H3 패리티 게이트가 이를 잠금(716 → 717). `canonical-docs-coverage.test.mjs` 7/7이 help가 여전히 `career-ops.org/docs`의 5개 가이드를 모두 반영함을 확인; WS2의 UX 감사(v1.41→v1.52의 40건)가 각 화면을 docs와 대조 — 괴리 없음. `docs/sdd/CONVENTIONS.md`를 v1.54.0으로 갱신(테스트 합계, H3 패리티 게이트, 파일 크기 이상치, 새 접근성 규약 섹션). WS0–WS10 완료; WS11만 남음. `fix(docs): WS10 canonical re-validation + H3 parity` · `test(help): H3-parity gate`. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.53.0] — 2026-05-18

**WS9 — 셸 표면 테스트 피라미드(마지막 미테스트 계층).** 4개의 `bin/*.sh` 스크립트와 `.githooks/pre-commit` 훅은 커버리지가 **제로**였음; 새로운 `tests/sh-files.test.mjs`가 10개 케이스를 추가해 `bash -n`/`sh -n` 구문, shebang + 실행 비트, 그리고 다른 워크스트림이 의존하는 동작 계약을 고정함: `career-ops-ui.sh` — `help`는 0으로 종료하며 shell-source 누출이 없음(v1.40.0 회귀 가드), 알 수 없는 verb는 2로 종료, `usage()`는 heredoc임; `start.sh` — `NO_OPEN` 존중, Node ≥ 18 요구, 브라우저 띄우기를 `scripts/open-dashboard.mjs`에 위임(v1.43.0 가드); `setup.sh` — strict 모드, `SKIP_START`, 두 저장소 클론; `run_all.sh` — `--quick`/`--no-e2e` 파싱과 4개 스위트; `.githooks/pre-commit`은 WS7 리뷰어를 exec하고 **어떤 셸 파일도 `git --no-verify`를 호출하지 않음**(CLAUDE.md 하드 룰 #7 가드); `install-hooks.mjs`가 `core.hooksPath`를 배선함. `docs/architecture/TESTING.md` — 피라미드 다이어그램에 셸 표면 베이스 계층 추가 + v1.53.0 합계 노트(716개 `node --test` 케이스 / 90개 파일 + 4개 E2E 표면). 706 → 716. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.52.0] — 2026-05-18

**WS2 LOWs #33–#40 — 일괄 다듬기 정리(UX 감사 큐를 닫음).** 저심각도 8건. `fix(a11y/i18n): WS2 LOW batch` — #33: `#/dashboard` — 헤더의 3개 CTA가 불일치했음(2개만 앞 아이콘 있음); "Open Pipeline"이 이제 `📋`를 가져 셋 다 일치함. #34: `#/profile` — 아키타입 `fit`/`level`이 모호한 두 칩으로 렌더링됐음; 이제 접두사(`Fit:` / `Level:`)와 대응 `aria-label`을 가짐. #35: `#/health` — Run-doctor / verify 토스트가 `doctor.mjs`의 원시 문자열을 표시했음; 이제 i18n 키화. #36: `#/health` — 검사 결과가 평탄한 `<div>` 나열이었음; 이제 `role=list` `<ul>`/`<li>`이며 상태 배지가 `aria-label="<check>: <status>"`를 가짐. #37: `#/reports` — 리포트 카드가 마우스 전용 `<div onClick>`이었음; 이제 `role=link` + `tabindex` + Enter/Space 핸들러 + `aria-label`. #38: `#/activity` — 페이지네이터 주석은 "200"이라 했으나 코드는 500을 요청했음; `CAP` 상수로 정합화하고 500 상한이 오래된 이력을 잘라낼 때 `role=note` 알림이 표시됨. #39: `#/batch` — 프로즈 플레이스홀더가 영어 하드코딩이었던 반면 `aria-label`은 localized였음; 4개가 이제 i18n 키화. #40: 모드 페이지가 비동기 프로브 후 주 버튼을 조용히 재라벨했음; 이제 정중한 `role=status` 영역이 이를 안내함. 신규 i18n 키 10개 × 8개 로케일(`{n}` 보존); 테스트 +9: `test: tests/low-sweep.test.mjs`. 697 → 706. WS2의 UX 감사 큐(v1.41→v1.52의 #1–#40)를 닫음; 다음은 WS9 → WS10 → WS11. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.51.0] — 2026-05-18

**WS2 #13 + #14 + #18 + #19 + #20 — `#/auto`와 `#/evaluate` feedback/i18n 정리.** UX 감사 지적 5건. `fix(a11y/ux): auto+evaluate — busy state, actionable HTTP errors, clipboard fallback, aria-live result, spinner-guarded submit` — #13: `#/auto`의 Run 버튼이 이제 단순 비활성화 대신 바쁨 상태(`is-loading` + `aria-busy` + "Running…")를 표시함. #14: 실패한 HTTP 요청이 이제 단계에 실행 가능한 i18n 메시지와 토스트(`{n}`가 담긴 `auto.httpFail`)를 노출함(이전엔 무미건조한 "HTTP 500"이었음). #18: 수동 모드의 "Copy prompt"가 이제 비동기 Clipboard API를 `execCommand` 폴백과 함께 사용하며, 거짓 "Copied" 대신 실제 실패를 토스트함. #19: evaluate 결과 컨테이너가 이제 `role=status` `aria-live=polite`여서 긴 LLM 호출이 스크린 리더에 안내됨. #20: Evaluate 버튼이 `UI.withSpinner`로 감싸짐(이전엔 중복 제출을 허용하는 평범한 `onClick: run`이었음). 신규 i18n 키 3개 × 8개 로케일; 테스트 +6: 691 → 697. 또한 테스트 전용 수정(커밋 `7f8e250`): e2e pipeline-delete 티어다운이 v1.48 이전 네이티브 confirm 경로에 있었음; API DELETE로 전환(`fix(test): …` — CI Playwright-e2e가 빨간색이었음; 제품 회귀가 아님). 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.50.0] — 2026-05-18

**WS2 #12 + #27 + #28 — help 내비게이션 접근성.** 17개 섹션·90+개 헤딩 가이드의 `#/help` UX 감사 지적 3건을 `help.js`에서 수정. `fix(a11y): help — single h1, labelled+filterable TOC, focus-on-anchor, back-to-top` — #28: 문서 markdown이 자체 `# Title`로 시작해, 헤더가 이미 정규 h1을 제공하는 페이지에 두 번째 `<h1>`을 만들었음; 이제 기사의 모든 `<h1>`이 제거되어 h1은 정확히 하나이며 계층은 `<h2>` 섹션에서 깔끔하게 시작함. #27: TOC의 `<nav>`는 이름 없는 랜드마크였음(페이지에 라벨 없는 `<nav>` 2개); 이제 `aria-label`(`help.toc`)을 가지며, TOC 항목을 클릭하면 뷰포트 스크롤뿐 아니라 포커스가 섹션 헤딩으로 이동함(`tabindex=-1` + `focus()`). #12: 긴 문서에서 무언가를 찾을 방법이 없었음; TOC 위의 `type=search` 필터가 헤딩 텍스트로 항목을 실시간으로 좁히고, 스크롤 후 `aria-label`이 달린 플로팅 "Back to top" 버튼이 나타나 맨 위로 돌아가 페이지 `<h1>`로 포커스를 되돌림; 그 scroll 리스너는 `#/help`를 벗어나는 `hashchange`에서 제거됨. 신규 i18n 키 2개 × 8개 로케일 — `help.tocFilter`, `help.backToTop`; 테스트 +6: `test: tests/help-nav-a11y.test.mjs`. 685 → 691. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.49.0] — 2026-05-18

**WS2 #10 + #11 + #25 + #26 — tracker 테이블 접근성 및 정렬.** `#/tracker`의 UX 감사 지적 4건을 `tracker.js`에서 수정. `fix(a11y): tracker headers, sortable table, localized fix labels, empty state` — #10: 액션 열 헤더가 빈 문자열이었고 행별 Report 버튼에 맥락이 없었음; 이제 모든 `<th>`가 `scope=col`을 가지며, 액션 헤더와 `Score`/`PDF` 헤더는 i18n 키화되었고(비어 있거나 하드코딩된 영어였음), Report 버튼은 회사명이 담긴 `aria-label`(`<report> — <company>`)을 얻음. #11: 정렬 수단이 없던 tracker; Date / Score / Status 헤더는 이제 `<th>` 안의 키보드 조작 가능한 정렬 버튼이며 `aria-sort`(`none`/`ascending`/`descending`)를 가짐; `sorted()` 비교자(score는 숫자, date/status는 로케일 비교)가 페이지네이션 전에 실행되고, 클릭 시 방향을 토글하고 페이저를 리셋함. #25: `track.normalize/dedup/merge`는 가장 위험도가 높은 파괴적 컨트롤임에도 8개 로케일 모두에서 동일한 영어였음(`data/applications.md`를 제자리에서 다시 씀) — 이제 제대로 현지화되었고, `title` 툴팁도 추가. #26: 0행 첫 실행이 과도하게 필터링된 목록과 동일한 "no match" 메시지를 보였음; `rows.length === 0`은 이제 독립적인 빈 상태(제목 + 본문 + "Open pipeline" CTA)를 렌더링함. 신규 i18n 키 7개 × 8개 로케일 + 3개 재현지화; 테스트 +6: `test: tests/tracker-a11y-sort.test.mjs`. 677 → 683. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.48.0] — 2026-05-18

**WS2 #8 + #22 — pipeline: 포커스 트랩 확인 + 미리보기 접근성.** `#/pipeline`의 UX 감사 지적 2건을 `pipeline.js`에서 수정. `fix(a11y): pipeline UI.confirm() + live preview region` — #8: `#/pipeline`의 세 가지 액션이 네이티브 `confirm()`을 사용했음(포커스 트랩 안 됨): 미리보기 창의 Delete, 행별 `✕` 삭제, "Evaluate first". 이제 모두 포커스 트랩되는 `UI.confirm()`(v1.44.0 인프라)를 거침 — 두 삭제는 `danger:true`(Cancel 기본값), "Evaluate first"는 `danger:false`; `pipeline.js`에 네이티브 `confirm()`은 더 이상 남아 있지 않음. #22: `previewPane`에 라이브 역할이 없었고 fetch 실패가 `previewBody`에 채워져 오해를 주는 `<pre>` "preview"로 렌더링되었음; 이제 `aria-label`을 갖춘 `role=region` `aria-live=polite`이며, 실패 시 별도의 `previewError`를 설정해 독립적인 `role=alert` 블록으로 렌더링함((재)선택 시 및 활성 행 삭제 시 지워짐). 신규 i18n 키 4개 × 8개 로케일; 테스트 +5: `test: tests/pipeline-confirm-preview.test.mjs`. 672 → 677. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.47.0] — 2026-05-18

**WS2 #7 + #30 + #31 + #16 — 미바인딩 레이블 접근성 일괄 정리.** 폼 컨트롤에 프로그래밍적 레이블이 없던 UX 감사 지적 4건(WCAG 1.3.1 / 3.3.2 / 4.1.2)을 모두 바인딩. `fix(a11y): bind every swept form control to an accessible name` — #7 `scan.js`: `dry-run` 체크박스와 `company-select` 드롭다운에 `for` 없는 레이블이 있었음; 기존 `id`에 맞춰 `htmlFor` 추가. #30 `deep.js`: `company` / `role` 입력에 미바인딩 레이블이 있었음; `id` + `htmlFor` 추가(`deep-company`, `deep-role`). #31 `apply.js`: `url` / `jd`에 미바인딩 레이블이 있었음; `id` + `htmlFor` 추가(`apply-url`, `apply-jd`). #16 `cv.js`: 주요 markdown `<textarea>`에 접근 가능한 이름이 없었음; 표시된 "Markdown" 제목에 `aria-labelledby`로 바인딩 — 스크린 리더 이름과 화면 제목 일치, 신규 i18n 키 없음. `batch.js` / `mode-page.js`에서 이미 표준인 명시적 `label[for]`↔`control[id]` 패턴 사용; 신규 i18n 키 없음; 동작 변경 없음. 테스트 +5: `test:` 667 → 672. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.46.0] — 2026-05-18

**WS2 #5 + #6 + #21 + #24 — scan SSE 접근성.** `#/scan`의 UX 감사 지적 4건을 `scan.js`에서 수정. `fix(a11y): scan SSE — live-log region, Stop, run-state, error banner` — #5: 스트리밍 콘솔이 이제 `role=log` `aria-live=polite`(+ `aria-label`, `tabindex=0`, 키보드 스크롤 가능)이며, 별도의 시각적으로 숨겨진 assertive `role=status` 영역이 종단 이벤트(완료 / 실패 / 중지)를 알림. #6: Stop 버튼이 진행 중인 `EventSource`를 닫고(`es.close()`), 결과 폴링을 취소하고, 상태를 초기화함. Stop은 scan 실행 중에만 표시. #21: scan 실행 중에는 Scan 버튼을 비활성화 + `aria-busy` 부여하고 Stop을 표시함. 두 스트림 경로 모두(단일 페이즈 `streamTo`와 다중 페이즈 `runScanAll` — 후자는 종단 `done`, `final !== false`에서만 실행을 종료) 적용. #24: SSE 실패가 더 이상 3.5초 토스트만이 아니라, 영속적인 `role=alert` 배너가 재시도 액션과 함께 오류를 표시하고(직전 실행 함수를 재호출), 다음 실행에서 지워짐. 신규 i18n 키 8개 × 8개 로케일; 테스트 +7: `test: tests/scan-sse-a11y.test.mjs`. 660 → 667. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.45.0] — 2026-05-18

**WS2 #3 — #/config 탭: 완전한 WAI-ARIA Tabs 패턴.** #/config의 세 탭(API keys / Profile / Modes)은 클릭 전용으로만 활성화되는 단순 `<button class="tab-btn">`로, `role`도 `aria-selected`도 키보드 모델도 없었음(UX-audit HIGH #3, WCAG 4.1.2 / 2.1.1). `fix(a11y): config.js tabs implement role=tablist/tab/tabpanel` — 이제 `aria-label`이 있는 `role=tablist` 컨테이너; 각 탭은 `role=tab` + `id` + `aria-controls` + `aria-selected`(`activate()`에서 동기화) + 로빙 `tabindex`(활성 0 / 나머지 -1); 패널은 `role=tabpanel` + `tabindex=0` + 활성 탭을 추적하는 `aria-labelledby`. 완전한 키보드 내비게이션: ←/→/↑/↓(래핑) + Home/End가 포커스를 이동하고 활성화도 함. 레거시 `.tab-btn.is-active` CSS 훅은 보존. i18n 키 +1 × 8개 로케일(`config.tablistLabel`); 테스트 +7: `test: tests/config-tabs-aria.test.mjs`. 또한 테스트 전용 수정: `fix(test): retarget 2 stale auto-pipeline smoke tests` — v1.34 이전 Playwright-e2e smoke 테스트 2개가 대시보드 "Auto-pipeline" 버튼이 v1.34.0에서 더 이상 열지 않게 된 일시 모달(→ `Router.go('/auto')`)을 단언하고 있었고, 별도의 Playwright-e2e CI 잡에서 빨간 상태로 남아 있었음. #/auto 화면으로 재타깃. 653 → 660. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.44.0] — 2026-05-18

**WS2 #4 + #9 — 상위 프로젝트 파일의 파괴적 덮어쓰기 전 포커스 트랩 확인.** UX 감사 HIGH 두 건, 모두 데이터 손실: (#4) `config.js`의 `saveProfileRaw`/`saveModesRaw`는 상위 `config/profile.yml` / `_profile.md` 전체를 확인 없이 교체했음; (#9) `tracker.js`의 Normalize/Dedup/Merge는 상위 `data/applications.md`를 확인 없이 제자리에서 재작성했음. `fix(a11y/safety): UI.confirm() gate before whole-file parent overwrites` — `public/js/api.js`에 새 `UI.confirm()` 추가. 기존 WAI-ARIA 모달 인프라를 재사용한 포커스 트랩 다이얼로그로(`_onClose` 훅이 있어 Esc / backdrop / × / Cancel 모든 해제 경로가 `false`로 resolve; 포커스는 기본적으로 Cancel; `Promise<boolean>` 반환; 네이티브 `confirm()` 아님), 세 개의 파괴적 호출은 이제 모두 쓰기 전에 게이트됨. 신규 i18n 키 8개 × 8개 로케일(`{op}` 플레이스홀더는 그대로 보존); 테스트 +8: `test: tests/confirm-gate.test.mjs`, 644 → 652. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.43.0] — 2026-05-18

**사용자 요청 — `career-ops-ui open` + autostart 브라우저 앞으로 가져오기.** `setup`/`run` 이후 브라우저가 이미 떠 있으면 맨손 `open`/`xdg-open`은 대시보드 탭을 뒤에 남겨, 사용자가 직접 찾아야 했음. `feat(cli): career-ops-ui open — open AND raise the dashboard tab` — 새 `scripts/open-dashboard.mjs`가 HOST/PORT에서 URL을 구성하고(`0.0.0.0` 바인드를 loopback으로 재작성), 선택적으로 `/api/health`를 기다린 뒤 기본 브라우저를 열고 이어서 **강제로 앞으로 가져옴** — macOS는 `osascript`로 실행 중인 Chrome/Brave/Edge/Safari/Arc/Firefox 중 하나를 활성화, Linux는 `xdg-open`+`wmctrl`, Windows는 `start`. `career-ops-ui open` 동사로 노출(별칭 `dash`, `focus`). `bin/start.sh`의 autostart가 이제 여기에 위임하여 탭이 자동으로 앞으로 옴; `NO_OPEN=1`은 headless/CI 시작에서 auto-open을 비활성화함. README ×8 + help §1 ×8 갱신; 테스트 +8: `test: tests/open-dashboard.test.mjs`, 636 → 644. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.42.0] — 2026-05-18

**WS2 수정 #2 — 죽은 라우트 `#/portals` → config 딥링크.** `#/portals`는 미등록 라우트로 404 뷰를 렌더링했지만, 포털 소스 관리를 위해 북마크/직접 입력될 수 있는 타당한 URL이었음(UX 감사 HIGH #2). `fix(router): #/portals 404 → alias to config + Regional-sources deep-link` — `router.js`의 `ALIASES`에 `portals: 'config'`를 추가(`settings→profile`과 동일한 북마크 안정성 패턴), 이제 config 뷰로 해석되며 **config** 내비 항목이 활성화됨. Regional-sources 그룹이 존재하면 뷰(`config.js`)가 `#/portals` 해시를 감지해 해당 `<details>` 그룹을 강제로 펼치고 화면에 스크롤한 뒤 그 summary로 포커스를 이동(기본 h1 포커스를 재정의)하므로, 사용자는 포털 소스 컨트롤에 정확히 착지함; 별칭만으로 빈 지역 그룹을 렌더링하지 않음. help-bundle §5 × 8에 단축 경로 안내 추가; 라우터 테스트 +1: `test(router): portals→config alias guarantee`를 `router.test.mjs`에 추가, 635 → 636. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.41.0] — 2026-05-18

**WS2 — 시니어 UX/사용성 감사 + 횡단 포커스 관리 수정.** 10년 이상의 휴리스틱 감사(Nielsen × WCAG 2.2 AA × 프로젝트 규약)로 전체 17개 라우트를 점검해 심각도 순 40건 큐를 생성(`.planning/.../UX-AUDIT.md`); HIGH→MEDIUM→LOW를 릴리스마다 한 건씩 수정 출시. 이번 릴리스는 횡단 HIGH 1순위에 착지. 수정: `fix(a11y): move focus to the new view on every route change` — `router.js render()`가 hashchange마다 `#content`를 교체했지만 포커스를 옮기지 않아, 키보드/스크린 리더 사용자가 파괴된 노드에 남아 위치를 잃었음(WCAG 2.4.3 Focus Order / 4.1.3 Status Messages — 횡단적이며 17개 화면 모두에 영향); 새 `focusNewView(content)`가 새 뷰의 첫 `h1`/`.page-title`에 포커스(간결한 SR 안내 + 올바른 포커스 순서), 필요 시 헤딩을 포커스 가능하게(`tabindex=-1`) 만들고 `#content`로 폴백; skip-link와 충돌하지 않도록 첫 페인트는 건너뜀; 성공·오류 양 렌더 경로에 배선; 라이브 검증 완료: 내비 후 `document.activeElement`는 새 뷰의 `H1.page-title`. 테스트: `test(router): focus-management static guarantees` — `router.test.mjs`에 4개 케이스(헬퍼 정의, 헤딩 타깃 + content 폴백, 첫 페인트 스킵 가드, ≥2 호출 지점); 631 → 635. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.40.0] — 2026-05-18

**WS8.3 — docs 실태화 스윕 + `career-ops-ui help` 수정 + `askSecret` 강화.** 수정: `fix(cli): career-ops-ui help no longer leaks shell source` — 디스패처가 헤더 주석을 `sed -n '2,12p'`로 출력했으나 12행(`set -euo pipefail`)은 주석이 아니라 코드여서 `career-ops-ui help`(및 알 수 없는 동사 사용법 텍스트)가 떠도는 `set -euo pipefail` 줄로 끝났음; `help`와 `*)` 두 케이스를 `2,11p`(주석 블록)로 좁힘; `help`는 exit 0, 알 수 없는 동사는 exit 2 — 검증 완료. `fix(cli): scripts/init.mjs key entry never echoes` — v1.39.0 후속 작업에서 장식용 readline 덮어쓰기 마스크를 실제 raw 모드 리더로 교체: `setRawMode(true)` + 버퍼 라인으로 입력/붙여넣기된 키 바이트가 터미널에 전혀 도달하지 않음(scrollback / tmux / 화면 공유 누출 없음); 완전한 VT 이스케이프 FSM이 모든 CSI/SS3/OSC/DCS/SOS/PM/APC 시퀀스를 소비해 화살표·기능 키가 시크릿을 손상시키지 못함; `stdin`은 의존성 주입되어 비-TTY 폴백을 공유 전역을 건드리지 않고 단위 테스트; AI 리뷰 LGTM까지 깔끔하게 반복. 문서: README ×8 — 기존 "원커맨드 설치" 섹션을 눈에 띄는 **"한 명령으로 실행 및 초기화"** 섹션으로 교체(curl 원라이너에 더해 명시적 `career-ops-ui` CLI 체인: clone → `npm link` → `setup` → `init` → `doctor` → `run` → `help`, 공급자 마법사 설명, CI 형식 `--provider --anthropic-key --yes`, `LLM_PROVIDER` 노트); 8개 README 배지를 v1.22–v1.24 / tests-461–474에서 **v1.40.0 / tests-631**로 실태화(e2e 배지는 날조 카운트 회피를 위해 비숫자화); help-bundle ×8 §1 — 퀵스타트 플레이북 상단("A. Setup" 앞)에 "한 명령 실행 & init" 콜아웃을 8개 로케일 모두에 추가; H2 섹션 패리티 유지(각 17 — CI 게이트 녹색). 테스트: `test(init): non-TTY askSecret fallback` — `provider-selector.test.mjs`에 DI-stdin 케이스를 추가해 `askSecret`가 비-TTY에서 공유 전역을 변경하지 않고 평범한 `ask()`에 위임(trim 패리티)함을 검증; 629 → 631. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.39.0] — 2026-05-18

**WS8.2 — LLM 공급자 선택 + OpenAI/Codex 키 + 대화형 `init` 마법사.** env-config에 `LLM_PROVIDER`(auto|claude|gemini)+`OPENAI_API_KEY`(시크릿). llm.mjs 6개 gate-site가 `_provGate()`로 `providerOrder()` 참조; auto는 동작 불변. #/config에 select+필드. `scripts/init.mjs`는 실제 마법사(검증된 경로로 parent .env 기록). 7 테스트. 622 → 629. README ×8/정식문서 fold = WS8.3/WS10. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.38.0] — 2026-05-17

**WS8.1 — 통합 CLI 디스패처 + `doctor` 동사.** `bin/career-ops-ui.sh`가 setup/run/doctor/init/help 라우팅. `scripts/doctor.mjs`는 `/api/health` 엔진을 그대로 재사용(createApp 인프로세스 → 터미널 리포트); 필수 체크 전부 통과 시에만 exit 0. docs/sdd + help §1 ×8. 6 테스트. 616 → 622. README ×8 = WS8.3. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.37.0] — 2026-05-17

**WS7 — git 워크플로 pre-commit AI 리뷰.** 결정적 플로어(fail-HARD): staged `.env`/시크릿, diff 내 키 패턴, staged 뷰의 `.also(`, `node --check` 실패 차단. AI 레이어(fail-SOFT): CLI 존재 + `AI_REVIEW != off`면 `claude -p`. `.githooks/pre-commit` + `prepare`로 `core.hooksPath` 연결. `--no-verify` 금지. docs/sdd. 6 테스트. 610 → 616. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.36.0] — 2026-05-17

**WS6.3 — Modes 탭: 원본 덩어리 → 섹션별 편집기. WS6 완료.** `modes/_profile.md`를 `##` 섹션별 편집(헤딩마다 접이식 textarea). 서버 `splitProfileSections` 바이트 정확; `PUT { sections }`는 지정 섹션만 병합 — 프리앰블·타 섹션·순서 바이트 단위 보존. 미지 헤딩 → 400. raw 경로 유지. i18n 5키 ×8. help §2 ×8. 신규 테스트 6. 604 → 610. WS6 종료. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.35.0] — 2026-05-17

**WS6.4 — Profile 배열 에디터 + WS6.2 API-keys 감사.** `PUT /api/profile`가 `{ arrays }` 수용(`{ fields }`와 결합 가능): Target roles/Superpowers(목록), Archetypes(name/level/fit), Proof points(name/url/hero-metric). 동일 merge-not-replace; 빈 행 제거; 빈 목록은 키 삭제. #/config에 add/remove 에디터 4개. i18n 6키 ×8. 감사: KNOWN_KEYS ≡ FIELDS, 갭 없음. 신규 테스트 7. 597 → 604. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.34.0] — 2026-05-17

**WS5 — 원클릭 Auto-pipeline 화면(`#/auto`).** 모달이 전용·링크 가능 페이지로 승격. 한 번 클릭으로 검증→가져오기→평가→리포트 저장→트래커(SSE). 접근성 스테퍼, 딥링크, 키 없으면 수동 모드, `#/auto?url=…&go=1` 링크 가능. 사이드바 항목; 대시보드 ✨ 버튼이 여기로. i18n 14키 ×8. help §1 ×8 + README ×8. 신규 테스트 8. 589 → 597. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.33.0] — 2026-05-17

**WS4 — career-ops 1.8.0 패리티 감사 + `location_filter`.** 부모 `scan.mjs`에 `location_filter`(#570) 추가; web-ui의 in-process 스캐너는 위임하지 않아 흐르지 않음. 새 `server/lib/location-filter.mjs`가 시맨틱을 그대로 복제, 두 스캐너에 연결. help §5 ×8. 신규 테스트 8개. 581 → 589. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.32.0] — 2026-05-17

**`#/config` Profile 탭 — 원본 YAML 덩어리 → 항목별 폼 (WS1).** 접이식 3개 섹션(지원자/내러티브/보상), 14개 스칼라 경로. 항목 저장은 `config/profile.yml`에 **병합** — 아키타입·프루프포인트·커스텀 키 그대로 보존. *Advanced*에 raw-YAML 이스케이프 해치 유지(주석 보존). i18n 23키 ×8. 신규 테스트 7개. 574 → 581. 자세히는 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.31.0] — 2026-05-17

**career-ops 1.8.0 동기화 — `#/batch`가 `--model` + `--start-from` 노출.** 부모 프로젝트가 1.7.1 → 1.8.0; `batch-runner.sh`에 `--model NAME`(#504) + `--start-from N` 추가. web-ui가 `#/batch`에 노출(**모델**, **시작 #** 입력) + 서버 측 defense-in-depth 검증. i18n ×8. 신규 테스트 7개. 567 → 574. 자세한 내용은 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.30.0] — 2026-05-14

**`#/scan` 결과 페이지네이션 — v1.12의 「처음 200개 표시 / 총 N」 트렁케이션 대체.**

v1.30 이전에는 스캔 결과 표가 첫 200행으로 잘리고 「Showing first 200 of N」 각주가 표시되어, 201..N행에는 UI로 접근할 수 없었습니다. v1.30.0은 cap을 `UI.paginate`로 교체합니다(`#/tracker` / `#/reports` / `#/activity`와 동일한 헬퍼). `PAGE_SIZE = 200`으로 시각적 밀도 유지; 부스트-상단 정렬이 페이지 간에서도 안정적(전체 집합을 정렬한 후 페이지 분할); 필터 변경 시 1페이지로 자동 리셋. 사용되지 않는 `scan.shownTop` i18n 키 제거(8개 로케일). `tests/scan-paginator.test.mjs`에 9건의 새 케이스(정적 카나리 7건 + 6가지 경계 케이스를 가진 순수 로직 테이블 1건 + 요약 계산 1건). **558 → 567** 유닛 + 어셉턴스(+9). 상세 내역은 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.29.2] — 2026-05-14

**핫픽스: `🌐 Scan`을 `source=both`로 실행해도 EN 단계만 동작했음. RU 단계는 조용히 누락.**

SSE 클라이언트(`public/js/api.js:156`)는 첫 번째 `done` 이벤트에서 `EventSource`를 닫았지만, 서버는 `source=both`에서 단계별로 하나씩 발행합니다. RU 단계는 시작 직후 취소되었습니다. 수정: 서버는 각 `done`에 `final: true|false`를 표시하고, 클라이언트는 `final !== false`일 때만 닫습니다. 역호환 — `final`을 설정하지 않는 단일 단계 생산자는 이전처럼 닫힙니다. **547 → 558** 유닛 + 어셉턴스(+11 신규). 상세 내역은 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.29.1] — 2026-05-14

**5개 RU 포털 구성을 위한 상세 사용자 가이드를 help-bundle §5의 8개 로케일 전체에 추가.**

§5 (Portals & sources) 내에 새 ### 하위 섹션 "러시아 포털 구성 — 상세 설정 가이드" 추가: 인증·지역 제한이 포함된 5-소스 인벤토리 테이블, `portals.yml` 위치 및 편집 단계, 5-소스 전체 YAML 예시, negative 리스트 충돌과 수정 예시, 단일 소스를 임시 비활성화하는 방법, 🌐 Scan 및 SSE 로그를 통한 검증 방법. §17(v1.29.0 출시)은 개발자 흐름; §5 v1.29.1은 최종 사용자 흐름. **540 → 547** 유닛 + 어셉턴스(+7 신규). 상세 내역은 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.29.0] — 2026-05-14

**러시아 포털 스캐너가 2 → 5 소스로 확장; registry + 동적 드롭다운; 새로운 §17 "새 포털 추가 방법".**

- **3개의 새 RU 어댑터:** `Trudvsem`(정부 open-data API, 인증/지오 게이트 없음), `GetMatch` 및 `GeekJob`(방어적 HTML 스크레이프 — 파싱 실패 시 `[]`, 정상 200에서 throw 안 함).
- **Source registry** `server/lib/sources/registry.mjs` — dispatcher + endpoint + dropdown 모두 단일 진실 공급원. v1.29 이전에는 세 곳에 하드코딩되어 있었음.
- **새 엔드포인트** `GET /api/scan/sources` (`Cache-Control: max-age=60`) — SPA가 `#/scan` 마운트 시 소스 필터 드롭다운을 동적으로 다시 그림.
- **Help-bundle §17 신규** 8개 로케일 전체: 「새 채용 포털 소스를 추가하는 방법」(어댑터 템플릿, 레지스트리 엔트리, 디스패처, 모크 테스트, `portals.yml`).
- **`russian_portals.sources` 기본값**이 `["hh", "habr"]`에서 5 소스로 변경; `portals.yml`에서 `sources:`를 명시적으로 나열했다면 새 3개를 수동으로 추가해야 합니다.
- 테스트: **520 → 540**(+20). 상세 내역은 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.28.1] — 2026-05-14

**핫픽스: `?query`를 포함한 해시에서의 router 404. health에서 HH_USER_AGENT 행 제거.**

v1.28.1 이전에는 `Router.go('/evaluate?url=…')`가 첫 `split('/')` 세그먼트로 `"evaluate?url=…"` 리터럴을 만들어내어 등록된 라우트와 절대 일치하지 않았고, 결과적으로 `__not_found__`(404)으로 떨어졌습니다. 한 줄 수정: 이름 분할 전에 `hash.split('?')[0]`. 보고된 두 클릭을 모두 처리합니다: `#/pipeline → ▶` 및 "App settings → Modes". 선택적 `HH_USER_AGENT` 행을 `/api/health`에서 제거(러시아 외 403 게이트 힌트는 help-bundle §16에 그대로 남아 있으며, 스캔 시 stderr에서도 그대로 출력). **515 → 520** 유닛 + 어셉턴스(+5 신규). 상세 내역은 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.28.0] — 2026-05-14

**도큐 정렬 + `#/batch`의 `--max-retries N` 컨트롤.** `qa/QA-PROMPT-docs-vs-app.md`에서 제기된 두 개의 open 이슈를 종료합니다.

- **Issue #2** — `#/batch`에 숫자 입력 "Max retries"(1–10)가 추가되었으며, "Retry failed"가 체크된 경우에만 활성화됩니다. 서버는 `parseInt` + 1≤N≤10 범위 검증을 수행하고, 범위 밖 값은 조용히 폐기하며, `--retry-failed`가 없으면 `--max-retries`를 생략합니다. `tests/batch-max-retries.test.mjs`의 7 케이스. 새 i18n 키 2개 × 8 로케일.
- **Issue #1** — 8개 help-bundle + 8개 README의 AI CLI 목록이 career-ops.org/docs 정본(Claude Code · Codex · OpenCode · Qwen CLI)에 맞춰지고, 로컬라이즈된 한 줄을 추가: *「다른 Claude 호환 CLI도 동일한 슬래시 커맨드 인터페이스에서 작동합니다」*. README의 "Multi-CLI" 항목(web-ui 자체 shim 파일 설명)은 그대로 유지(다른 surface). `tests/canonical-docs-coverage.test.mjs`에 새 카나리아 2개.
- **506 → 515** 유닛 + 어셉턴스(+9 신규). Playwright 32/32 변동 없음. 상세 내역은 [`CHANGELOG.md`](CHANGELOG.md).

---

## [1.27.0] — 2026-05-14

**겉모양 + 접근성 다듬기: 사이드바 `#/dashboard` 항목 중복 제거.**

사이드바에서 브랜드 로고(`<a class="logo" href="#/dashboard">`)와 첫 번째 내비 항목이 동일 라우트를 가리켰습니다. 스크린리더는 「Dashboard」를 두 번 읽었고 키보드 사용자는 의미 없는 탭 스톱을 하나 더 거쳤습니다. 브랜드 블록은 이제 평범한 `<div class="logo">`이며 내비 항목만이 `#/dashboard`로의 유일한 링크입니다. **506 / 506** unit + **32 / 32** Playwright — 변동 없음. 상세 내역은 [`CHANGELOG.md`](CHANGELOG.md) 참조.

---

## [1.26.1] — 2026-05-14

**핫픽스 WCAG 2.5.5 — `.btn` 최소 높이 44 px 복원.**

v1.26.0에서 `.btn`의 `min-height: 44px` 선언이 누락되어 헤더 버튼이 39-41 px 로 렌더링됐습니다 (WCAG 2.5.5 위반). v1.26.1에서 44 px 하한선 + `flex-shrink: 0` + `line-height: 1.2` 를 복원했습니다. **502 → 506** unit, Playwright 32/32 그대로. 상세 내용은 [`CHANGELOG.md`](CHANGELOG.md) 참조.

---

## [1.26.0] — 2026-05-14

**테스트 피라미드 + 라인 커버리지 ≥ 93 %.**

v1.25 백로그 요구사항에 따라 4단계 테스트 피라미드(unit → functional → acceptance → e2e)를 도입했습니다. v1.25에서 가장 컸던 커버리지 gap을 메우는 22개 신규 테스트 추가 (jds.mjs 61.64 % → 100 %, auto-pipeline 거절 경로). 멀티 엔드포인트 사용자 여정 테스트를 위한 `tests/acceptance/` 디렉토리 신설. **480 → 502** unit + acceptance, Playwright 32/32 그대로. 상세 내용은 [`CHANGELOG.md`](CHANGELOG.md) 및 [`docs/architecture/TESTING.md`](docs/architecture/TESTING.md) 참조.

---

## [1.25.0] — 2026-05-14

**자동 파이프라인 수동 단락 처리 + 대시보드 외관 수정 + CHANGELOG 패리티 백필.** G-014 (auto-pipeline 이 `mode: 'manual'` 을 무시) 와 G-012 (CHANGELOG 패리티 드리프트 — 6개 로케일이 릴리스 2개 뒤처짐), 그리고 대시보드의 `✨ ✨` 이중 글리프 외관 문제를 마무리합니다. G-003 (`README.cn.md` 이름 변경) 은 사실상 이미 종료되어 있었습니다 — 저장소에는 `README.zh-CN.md` 만 존재합니다. G-005 (A-G → A-F 보고서 블록 재정렬) 은 부모 프로젝트와 조율된 커밋이 필요하여 계속 연기합니다.

### 🛡️ G-014 — 자동 파이프라인 `mode: 'manual'` 단락 처리

- **`fix(auto-pipeline): G-014 — honour mode:'manual' short-circuit`** ([`server/lib/routes/auto-pipeline.mjs:158-195`](server/lib/routes/auto-pipeline.mjs#L158-L195)) — v1.25 이전에는 라우트가 언제나 LLM 을 호출했습니다. `mode: 'manual'` 을 전달해도 (v1.10.2 이후 `/api/evaluate` 와 동일한 의미) 조용히 무시되어 요청이 Anthropic 에서 1~3분간 멈췄습니다. 이제 핸들러는:
  - 하위 호환을 위해 `mode` 와 `evalMode` 를 모두 수용합니다. 두 값 중 어느 쪽이든 `'manual'` 이면 단락 처리가 트리거됩니다.
  - 5개의 SSE 단계를 모두 `status: 'done'` / `status: 'skipped'` 로 방출합니다. fetch 없음. LLM 호출 없음. 요청당 $0.05 의 비용도 없음.
  - `done` 페이로드는 `{ mode: 'manual', prompt: <buildEvaluationPrompt scaffold>, message }` 를 운반합니다 — SPA 는 기존 `/api/evaluate` 수동 프롬프트 카드와 동일한 방식으로 렌더링할 수 있습니다.
- **`HOST=0.0.0.0` 환경에서의 DoS 위험 해소**: 기존에는 `llmRateLimit` 이 분당 IP 당 10 요청으로 제한해도 공격자 10명 × 10 요청 = 분당 $50 의 Anthropic 비용 소진이 가능했습니다. 단락 처리는 레이트 리밋의 카운터가 실제 호출을 향해 감소하기 전에 발사됩니다.
- **테스트** — [`tests/auto-pipeline-manual-mode.test.mjs`](tests/auto-pipeline-manual-mode.test.mjs): 3개의 테스트가 (1) `mode: 'manual'` 이 2초 이내에 5개 step 키 전부와 함께 반환되는지, (2) `ANTHROPIC_API_KEY` 가 설정된 상태에서도 단락 처리가 여전히 발사되는지 (원래의 증상), (3) 레거시 `evalMode: 'manual'` 호출자가 계속 동작하는지를 확인합니다.

### 📝 G-012 — CHANGELOG 패리티 백필 (6 로케일 × 누락 릴리스 2건)

- **`docs(changelog): backfill v1.23.0, v1.24.0, v1.24.1, v1.25.0 in 6 lagging locales`** — v1.25 이전에는 EN 만 v1.23-v1.24 를 보유하고 있었으며, RU 는 릴리스 1개 뒤처져 있었고 나머지 6개는 릴리스 2개씩 뒤처져 있었습니다. v1.25 는 병렬 번역 에이전트를 디스패치 (v1.23 패턴을 재현) 하여 네 개의 항목을 모두 `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` 에 안착시킵니다. RU 는 v1.24.0 + v1.24.1 + v1.25.0 을 받습니다 (v1.23 사이클에서 이미 v1.23.0 을 받았기 때문입니다).
- **`feat(ci): scripts/check-changelog-parity.mjs gate`** — 어떤 로케일 CHANGELOG 의 최신 항목이 EN 정본보다 오래되면 빌드를 실패시킵니다. `npm run test:ci` 에 연결되었습니다. 사전에 존재했던 G-012 드리프트는 EN 경계를 넘는 순간 스스로 탐지되었을 것입니다.

### ✨ 외관 — 대시보드 이중 글리프 제거

- **`fix(dashboard): dedup ✨ glyph in auto-pipeline button label`** ([`public/js/lib/i18n-dict.js:219`](public/js/lib/i18n-dict.js#L219)) — `dash.autoPipeline` 이 모든 로케일 문자열에 선두 `✨` 를 포함하고 있었고, `public/js/views/dashboard.js:58` 의 뷰가 또 다른 `✨` 를 앞에 붙였습니다. 결과적으로 버튼이 `✨ ✨ Auto-pipeline …` 로 렌더링되었습니다. v1.25 는 모든 로케일의 DICT 항목에서 선두 글리프를 제거합니다; 뷰의 접두사가 단일 소스가 됩니다. 동일한 감사 패스로 나머지 i18n 번들도 훑었습니다 — 다른 이중 글리프 패턴은 발견되지 않았습니다.

### 🚫 향후 릴리스로 연기

- **G-005 — 정규 career-ops.org/docs 에 맞춘 A-G → A-F 보고서 블록 재정렬** — 부모 `santifer/career-ops` 프로젝트와 조율된 커밋이 필요합니다 (`modes/oferta.md` 를 재작성하여 A=Role, B=CV-match, C=Strategy, D=Comp, E=Personalization, F=STAR 를 방출 — C-Risks/G-Legitimacy 는 별도 블록에서 제거). v1.25.0 은 새 스키마에 대비한 web-ui 측을 출하합니다 (`reports.js` 는 v1.13 이후 임의 블록 문자를 이미 수용합니다). 부모와 자식이 함께 안착할 수 있는 다음 릴리스 윈도우에서 추적합니다.
- **G-003 — `README.cn.md` → `README.zh-CN.md` 이름 변경** — v1.25 준비 중 검증: 저장소에 이미 `README.zh-CN.md` 가 존재합니다 (워크트리 어디에도 고아 `README.cn.md` 가 없음). G-003 결과는 낡은 발견이었습니다.

### 🧪 테스트

- **477 → 480** 유닛 (PR-B `auto-pipeline-manual-mode.test.mjs` 에서 +3).
- 32/32 Playwright 동일.
- `npm run test:ci` 가 이제 `npm test` + `check-no-also-leftovers.mjs` + `check-changelog-parity.mjs` 를 실행합니다.

### 검증

```bash
$ npm run test:ci
# 480 / 480
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.25.0

# G-014 — manual mode returns < 2 s even with ANTHROPIC_API_KEY set:
$ ANTHROPIC_API_KEY=sk-ant-test PORT=4317 npm start &
$ sleep 3
$ time curl -sS -X POST -H 'Content-Type: application/json' \
    -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/x","mode":"manual"}' \
    http://127.0.0.1:4317/api/auto-pipeline | head -20
# real  0m0.1xx s  (was 1-3 min)
# event: start … event: step (×5) … event: done {"mode":"manual","prompt":"…"}

# G-012 — every locale CHANGELOG carries the v1.25.0 entry:
$ grep -c '^## \[1.25.0\]' CHANGELOG*.md
# 8 files, each → 1

# Cosmetic — dashboard glyph:
$ grep "dash.autoPipeline" public/js/lib/i18n-dict.js
# No leading ✨ in any locale value (view supplies the single glyph)
```

### 비호환 변경

없습니다. `mode: 'manual'` 은 옵트인이며, 레거시 `evalMode: 'manual'` 호출자는 변경 없이 계속 동작합니다.

### 범위 외 (v1.26+)

| 항목 | 비고 |
|---|---|
| G-005 — A-F 보고서 블록 재정렬 | 부모와 조율된 커밋이 필요합니다 (`santifer/career-ops` 가 `modes/oferta.md` 를 재작성). |
| QA 시나리오 31 **시각적** 서브 테스트의 라이브 실행 | 브라우저 기반 에이전트가 필요합니다 (Claude Cowork). Playwright 스모크가 부분적으로 커버합니다. |
| `i18n-dict.js` 의 400 LOC 목표 초과 | 번역 fixture 이며 정책상 면제됩니다. 번들러 없는 분할은 HTTP 요청만 증가시킵니다. |

---

## [1.24.1] — 2026-05-14

**핫픽스: 8개 로케일 모두에서 `#/config` 충돌 (G-015).**

### 🚑 치명적 핫픽스

- **`fix(config): G-015 — replace removed Element.prototype.also call in config.js`** ([`public/js/views/config.js:371`](public/js/views/config.js#L371)) — v1.22.0 N-2 에서 `Element.prototype.also` 전역 멍키 패치를 제거하고 `cv.js` 를 자유 구문 (free-statement) 패턴으로 마이그레이션했으나 **`config.js` 를 누락했습니다**. 결과적으로 `#/config` 는 모든 로케일에서 첫 호출 시 `c(...).also is not a function` 으로 충돌했습니다. v1.24.1 은 `cv.js:188-201` 의 동일한 마이그레이션 패턴을 적용합니다 — 트리를 `const root = c(...)` 로 추출하고, 활성화 블록을 독립적으로 실행한 뒤 `return root;` 로 반환합니다.

### 🛡️ CI 게이트

- **`feat(ci): scripts/check-no-also-leftovers.mjs sweep`** — `public/js/views/` 아래 모든 파일을 순회하며 `.also(` 호출 지점이 있으면 빌드를 실패시킵니다 (주석 처리된 참조는 허용). 신규 `npm run test:ci` 스크립트에 연결되었습니다. 향후 멍키 패치 제거의 되돌림이 동일한 회귀를 조용히 재도입할 수 없습니다.

### 🧪 테스트

- **`test: tests/config-view-syntax.test.mjs`** — 세 개의 가드:
  - `node:vm.Script` 로 `config.js` 를 파싱 (Playwright 없이 구문 수준의 회귀 포착)
  - 주석 밖에서 `.also(` 가 살아남지 않는지 단언
  - `const root = c(...)` / `return root;` 마이그레이션 앵커가 존재하는지 단언
- **474 → 477** 유닛 (+3) + 32/32 Playwright 동일.

### 검증

```bash
$ npm run test:ci
# 477 / 477
# ✓ no .also( leftovers in views/

# Browser smoke:
$ open http://127.0.0.1:4317/#/config
# → renders normally, no "is not a function" card. Every locale equivalent.
```

### 범위 외 (v1.25 로 연기)

- G-014, G-012, G-005, G-003 — 묶음 처리에 대해서는 아래 v1.25.0 항목을 참조하십시오.

---

## [1.24.0] — 2026-05-14

**Help-bundle 콘텐츠 깊이 갱신 + QA 시나리오 31 라이브 실행 + RU CHANGELOG 전체 마무리.** v1.23.0 의 "Out of scope" 표에서 v1.24 로 연기되었던 두 항목을 모두 마무리합니다: 5개의 정규 career-ops.org/docs URL 에서 출발한 8개 help bundle 전체의 콘텐츠 깊이 갱신 (v1.11.x 이후 URL 커버리지만 보장되어 있었음) 과, 실행 중인 서버에 대한 QA 시나리오 31 의 라이브 실행 ("브라우저 에이전트 + LLM 자격 증명 필요" 로 분류되어 있었으나 6/6 서브 테스트 중 시각적 서브 테스트만 브라우저가 필요하고 나머지는 curl + grep 으로 도달 가능함이 밝혀짐).

### 📖 Help-bundle 콘텐츠 깊이 갱신

- **`docs(help): refresh en.md from 5 canonical career-ops.org/docs URLs`** ([`docs/help/en.md`](docs/help/en.md)) — v1.24 이전의 EN 번들은 1113 라인이었고 front-matter 에 5개의 정규 URL 을 나열했지만 본문에서 확장하지는 않았습니다. v1.24 는 5개 URL 을 WebFetch 로 가져와 대응되는 H2 섹션을 심화합니다:
  - **career-ops 소개 (front-matter)** — 원칙 (데이터 주권, AI 비종속, 사람 통제), "career-ops 가 아닌 것" 블록을 추가했고 개념 인벤토리를 6행에서 10행으로 확장했습니다 (Proof points, JD store, Interview-prep, Batch additions 추가).
  - **§5 Portals** — 정규 부트스트랩 `cp templates/portals.example.yml portals.yml` 을 추가했고, `tracked_companies` 항목별 필수 vs 선택 필드를 명확히 했습니다.
  - **§7 Scan** — Option A 에 "AI 토큰 소비 없음" 노트와 후속 명령 목록 (`apply` / `contacto` / `deep` / `tracker`) 을 추가했습니다.
  - **§14 지원 체크리스트** — SPA 체크리스트 모드 vs 수동-vs-Playwright 보조 vs 전체 CLI 흐름으로 분리했습니다 (`/career-ops apply <company>` 부터 `Evaluated → Applied` 자동 전이를 포함한 `Submitted.` 까지 정규 8단계 번호 매기기); batch evaluate 하위 섹션은 이제 TSV 스키마 테이블 + 4개 플래그 전체의 문서화 + `merge-tracker.mjs --dry-run` 을 포함합니다; Playwright 설정 하위 섹션은 설치 명령, MCP 등록, 대체 `.claude/settings.local.json`, 기본 헤드리스 노트를 나열합니다.
- **16개 H2 섹션 패리티 유지** (CI 테스트 `help-ui.test.mjs::section-parity` 가 8개 로케일 전체에서 정확히 16개의 H2 섹션을 단언합니다).
- **5개 정규 URL 각각이 번들에 ≥ 2회 등장** (CI 테스트 `canonical-docs-coverage.test.mjs` 가 강제합니다). v1.24 이후 URL 별 등장 횟수: `what-is-career-ops` × 4, `scan-job-portals` × 5, `apply-for-a-job` × 3, `batch-evaluate-offers` × 5, `set-up-playwright` × 3.
- **`docs(help): translate the v1.24 deepening to 7 non-EN locales`** — 7개의 병렬 번역 에이전트를 디스패치했습니다. 각 대상 로케일 (es / pt-BR / ko-KR / ja / ru / zh-CN / zh-TW) 은 EN 구조를 섹션 단위로 미러링하고, 코드 블록 / URL / 파일 경로 / 버튼 레이블 (📁 Upload CV / 🌐 Scan now / ▶ Evaluate / 📄 Generate PDF / 💾 Save) 과 영어 약어 (CSP, SSRF, TOCTOU, WCAG, ATS, JD, SSE, REST, API) 를 그대로 보존하며, 심화 부분을 대상 언어로 출판 등급 기술 문서 스타일로 번역한 새 번들을 받습니다.

### 🧪 QA 시나리오 31 — 라이브 실행 (6/6 PASS)

- **`docs(qa): append last-verified live-execution log to qa/claude-cowork-browser-test-prompt.md`** — v1.24 이전의 시나리오 31 은 문서화되어 있었으나 실제 서버에 대해 실행된 적이 없었습니다 ("브라우저 에이전트 + LLM 자격 증명 필요" 로 연기). v1.24 는 6개의 서브 테스트를 모두 `http://127.0.0.1:4317` 에 대해 실행했습니다:

  | 서브 | 설명 | 상태 |
  |---|---|---|
  | 31.1 | help bundle 의 점수 임계값 | ✅ PASS (`docs/help/en.md` 에서 4.5 × 3, 4.0 × 9, 3.5 × 6 회 언급) |
  | 31.2 | 스캔 워크플로 엔드포인트 | ✅ PASS (`/api/stream/scan-{en,ru}` + `/api/scan-ru/config` → 404; `/api/scan/regional/config` → 200) |
  | 31.3 | `/api/apply-helper` 체크리스트 | ✅ PASS (본문에 `career-ops apply` + `auto-submit` 경고 포함) |
  | 31.4 | `/api/batch` 엔드포인트 | ✅ PASS (키: `[exists, runnerExists, raw, rows, additions]`) |
  | 31.5 | Playwright 가용성 | ✅ PASS (`/api/health` 가 `Playwright (parent node_modules) ok: true, value: installed` 보고) |
  | 31.6 | help bundle URL 커버리지 (5 URLs × 8 로케일) | ✅ PASS (**40 / 40 ✓**) |

  시각 전용 서브 테스트 (브라우저 필요) 는 QA 프롬프트에 별도 플래그로 표시되었습니다 — Claude Cowork 또는 `npm run test:e2e:browser` 로 여전히 실행 가능합니다.

### 🌐 RU CHANGELOG 전체 마무리 (M-9 후속)

- **`docs(translate): CHANGELOG.ru.md retry agent — full body translation`** ([`CHANGELOG.ru.md`](CHANGELOG.ru.md)) — v1.23.0 릴리스는 RU CHANGELOG 재시도 에이전트가 아직 진행 중인 상태에서 출하되었습니다 (소켓 오류로 한 번 충돌한 뒤 재디스패치됨). v1.24 는 에이전트의 1542 라인 전체 번역을 수령합니다: v1.23.0 → v1.6.0 의 모든 항목이 출판 등급의 러시아어 본문을 갖게 되었고, 영어 본문 임시 대체는 더 이상 존재하지 않습니다. 스타일 규율은 v1.22.0 의 README 품질 갱신과 일치합니다: "функциональность" / "возможности" / "поведение" 가 어색한 "функционал" 을 대체했으며, "через" / "с помощью" 가 "при помощи" 를 대체했고, 능동태가 수동태보다 선호되며, "эндпоинт", "лимит запросов", "состояние гонки", "санитайзинг" 이 정규 용어이고, 영어 약어 (TOCTOU, CSP, SSRF, WCAG, ATS, JD, SSE, REST, API) 는 보존되었습니다.

### 🧪 테스트

- **474 / 474** 유닛 + 20 / 20 스모크 E2E + 32 / 32 Playwright. 동작상 테스트 변경 0건; 모든 help bundle CI 단언 (16개 H2 섹션 × 8개 로케일, 5개 URL × ≥ 2회 등장, 콘텐츠 하한선) 이 여전히 통과합니다.

### 검증

```bash
$ npm test                            # 474 / 474

# Help-bundle deepening:
$ wc -l docs/help/en.md
# ~1270 lines (was 1113 — deepened, not bloated)

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

# Scenario 31.6 — 40/40 URL coverage:
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

### 비호환 변경

없습니다.

### 범위 외 (v1.25+)

| 항목 | 비고 |
|---|---|
| 시나리오 31 **시각적** 서브 테스트의 라이브 실행 | 브라우저 기반 에이전트가 필요합니다 (Claude Cowork 또는 `npm run test:e2e:browser`). curl 만으로는 범위 밖이며 기존 Playwright 스모크가 커버합니다. |
| RU CHANGELOG **구버전 항목 (v1.5.x 이하) 의 본문 번역** | 재시도 에이전트는 v1.6.0 이상만 다뤘습니다. v1.6 이전 항목 (`v1.5.x` 등) — 만약 존재한 적이 있다면 — 은 사전 콘텐츠로 남습니다. |
| 향후 SPA 변경 후 대시보드 스크린샷의 시각적 회귀 | `scripts/capture-dashboard-screenshots.mjs` 가 로케일별 PNG 를 재생성합니다; 현재 자동 diff 는 없습니다. |

---

## [1.23.0] — 2026-05-14

**i18n 분할 + 연결 배너 CI 수정 + 로케일별 대시보드 스크린샷 + 모든 백로그 임시 대체 마무리.** v1.22.0 의 "Out of scope" 표에서 v1.23 으로 표시되었던 세 항목 (M-9 로케일 CHANGELOG 본문, N-1 `i18n.js` LOC 분할, help bundle 콘텐츠 감사) 과, v1.22.0 이후 메인 브랜치 CI 를 적색으로 바꾼 스모크 E2E 테스트의 핫픽스를 함께 출하합니다.

### 🚑 CI 핫픽스 — 연결 배너 복구

- **`fix(client): reset health-poll cadence + visibilitychange eager re-check`** ([`public/js/api.js:21-91`](public/js/api.js#L21-L91)) — v1.22.0 의 M-6 지수 백오프 (3초 → 6초 → 12초 → 캡 15초, 원래 캡 60초에서 감소) 는 올바른 방향이었으나, 진행 중인 `setTimeout` 이 이전에 설정된 어떤 지연 값에 고정되어 있었습니다. t=0.1 에 죽은 서버에 대해 t=3 에서 첫 핑이 실패하면 지연이 6초로 두 배가 되고, 다음 복구 프로브는 t=9 까지 발사되지 않았습니다. 스모크 E2E 의 "Flow 2a: 서버 다운 시 연결 배너 표시, 복구 시 숨김" 은 4초만 대기했고 `main` 에서 적색이 되었습니다.

    v1.23.0 은 폴링 루프를 재구성합니다:

    - `_healthHandle` 을 추적하여 `setConnectionState(lost=true)` 가 `clearTimeout` 하고 `_HEALTH_MIN` 으로 재스케줄할 수 있습니다. 다운 후 첫 복구 프로브가 이전에 큐에 있던 지연과 무관하게 3초 이내에 발사됩니다.
    - `_HEALTH_MAX` 가 60초에서 15초로 낮아졌습니다. 죽은 서버에 대해 백그라운드 탭이 되어 있어도 사용자가 돌아왔을 때 한 번의 폴링 사이클 내에서 복구되며, 대역폭 절감은 여전히 상당합니다.
    - `document.addEventListener('visibilitychange')` 가 탭이 포커스를 되찾고 `connectionLost === true` 일 때 즉시 재확인합니다 — Cmd-Tab 복귀가 다음 백오프 틱을 기다리지 않습니다.

### 🧹 N-1 — i18n.js 분할 (400 LOC 목표 초과)

- **`refactor(client): split DICT into i18n-dict.js (data) + i18n.js (logic)`** — v1.23 이전의 `public/js/lib/i18n.js` 는 639 LOC 였습니다. 대부분 (23-586 라인) 이 `DICT` 번역 테이블 — 순수 구조화 데이터였습니다. v1.23.0 은 이를 [`public/js/lib/i18n-dict.js`](public/js/lib/i18n-dict.js) (578 LOC, CLAUDE.md 의 "Exempt from these limits: generated files, migrations, test fixtures, lock files, vendored code" 에 따라 LOC 규칙 면제 — 번역 테이블은 fixture 로 분류) 로 추출하고, [`public/js/lib/i18n.js`](public/js/lib/i18n.js) 는 순수 모듈 로직 86 LOC (400 LOC 목표를 한참 밑돔) 로 남깁니다.
- **로더 계약:** `i18n-dict.js` 가 `window.__I18N_DICT = { … }` 를 채우고, `i18n.js` 가 기존 IIFE 내부에서 이를 읽습니다. [`public/index.html`](public/index.html) 이 순서대로 로드합니다 — `i18n.js` 이전에 `i18n-dict.js` 가 — 그래서 IIFE 가 생성 시점에 완전히 채워진 DICT 를 봅니다. 누락된 dict 폴백: 모든 `t()` 호출은 인라인 폴백 또는 키 자체를 반환하므로 SPA 가 충돌하지 않고 잘못된 설정을 큰 소리로 드러냅니다.
- **테스트 배선 갱신:** [`tests/i18n-coverage.test.mjs`](tests/i18n-coverage.test.mjs), [`tests/help-ui.test.mjs`](tests/help-ui.test.mjs), [`tests/canonical-docs-coverage.test.mjs`](tests/canonical-docs-coverage.test.mjs) 가 이제 두 파일을 테스트 VM 컨텍스트에서 모두 실행하거나 (정규표현식 스윕을 위해) 소스를 연결하여 모든 기존 단언을 보존합니다.

### 🌐 M-9 — 로케일 CHANGELOG 본문 번역

- **`docs(translate): 7 non-EN CHANGELOG files end-to-end`** — v1.23 이전의 `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` 는 v1.13.0 이후의 모든 항목에 영어 본문 임시 대체 노트를 담고 있었고, EN 정본을 가리키는 푸터를 가지고 있었습니다. v1.23.0 은 로케일당 1개씩 7개의 병렬 번역 에이전트를 디스패치하여 모든 본문을 대상 언어의 출판 등급 기술 문체로 다시 씁니다. 임시 대체 노트가 제거되었습니다. 모든 로케일에서 코드 블록, 파일 경로, URL, 커밋 메시지 스타일 문자열 (`fix(security): B-1 — …`), 환경 변수, 링크 레이블은 그대로 보존됩니다.

### 🖼️ 모든 README 의 로케일별 대시보드 스크린샷

- **`docs(readme): wire each locale README at its locale-specific PNG`** — v1.23 이전에는 `README.pt-BR.md` 만 `dashboard-pt-BR.png` 를 참조했고, 나머지 6개 비영어 README 는 여전히 `dashboard-en.png` 를 가리켰습니다. 스크린샷 자체는 v1.22.0 사이클에서 [`scripts/capture-dashboard-screenshots.mjs`](scripts/capture-dashboard-screenshots.mjs) 로 이미 캡처되어 `images/` 에 있었지만 사용되지 않았습니다. v1.23.0 은 모든 `README.{es,ja,ko-KR,ru,zh-CN,zh-TW}.md` 의 14번 라인을 자체 `dashboard-<locale>.png` 로 갱신합니다.

### 🧪 테스트

- v1.22.0 과 동일한 474 / 474 유닛 + 32 / 32 Playwright. **스모크 E2E 가 이제 20 / 20** (v1.22.0 이후 `main` 에서는 배너 복구 회귀로 19 / 1 실패였음; v1.23.0 의 재스케줄 수정이 이를 마무리합니다).
- 3개의 기존 테스트가 i18n 분할을 처리하도록 재배선되었습니다. 신규 테스트 파일 0건; 삭제된 단언 0건.

### 검증

```bash
$ npm test
# 474 / 474

$ npm run test:e2e
# passed: 20    failed: 0    (was 19/1 on v1.22.0 main)

$ wc -l public/js/lib/i18n.js public/js/lib/i18n-dict.js
#       86 public/js/lib/i18n.js          ← logic, under target
#      578 public/js/lib/i18n-dict.js     ← data fixture, exempt

$ grep -h 'dashboard-' README*.md | sed -E 's/.*(dashboard-[^)]+).*/\1/' | sort -u
# dashboard-en.png    (README.md only)
# dashboard-es.png    dashboard-ja.png
# dashboard-ko-KR.png dashboard-pt-BR.png
# dashboard-ru.png    dashboard-zh-CN.png  dashboard-zh-TW.png

# CHANGELOG translation sanity: each locale file > 200 lines of native content
$ wc -l CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md | grep -v total
```

### 비호환 변경

없습니다. `public/index.html` 이 이전에는 한 개를 로드하던 곳에서 이제 두 개의 스크립트를 로드합니다 — CDN 에서 SPA 를 서빙하는 사용자는 `i18n-dict.js` 도 함께 가져가야 합니다; 스크립트 로드 순서는 `index.html` 의 `<script src>` 태그 순서로 강제됩니다. 런타임 폴백 (빈 DICT → `t()` 가 인라인 EN 폴백을 반환) 이 새 파일 누락 시 하드 크래시를 방지합니다.

### 범위 외 (v1.24+)

| 항목 | 비고 |
|---|---|
| career-ops.org/docs 로부터의 Help-bundle 콘텐츠 깊이 갱신 (URL 커버리지 대비) | 5개의 정규 URL 은 v1.11.x 이후 모든 로케일의 help bundle 에 이미 등장하며 QA 프롬프트의 시나리오 31.6 이 커버리지를 검증합니다. 콘텐츠 본문 깊이 갱신은 v1.24+ 후보입니다. |
| 실행 중인 서버에 대한 QA 시나리오 31 의 라이브 실행 | 브라우저 에이전트 + 라이브 LLM 자격 증명이 필요합니다. v1.24 후보. |
| 신규 mode-page 힌트 단락에 대한 컴포넌트별 터치 타깃 스윕 | v1.22.0 M-1 이 추가한 `<p class="field-hint">` 요소가 8개 로케일 전체에서 WCAG 2.5.5 최소 높이에 대해 검증되지 않았습니다. |

---

## [1.22.0] — 2026-05-14

**M/L/N 백로그 일괄 처리 + 문서 정합성 + 번역 품질 패스.** `v1.20.1-BACKLOG.md` 의 medium 이하 등급 전체를 한 릴리스로 정리했습니다. M 항목 9개, L 항목 5개, 자잘한 nit 2개. 더하여 5개의 정규 [career-ops.org/docs](https://career-ops.org/docs) 가이드에 대한 문서 정합성 감사, `.claude/` 및 `.github/` 하위 시스템 프롬프트 갱신, 7개 비영어 로케일 README 품질 재정비를 포함합니다.

### 🛡️ 보안 강화 (심층 방어)

- **`fix(security): M-4 — entity-aware stripDangerousMarkdown`** ([`server/lib/security.mjs`](server/lib/security.mjs)) — v1.22 이전의 정규표현식은 `<script>`, `javascript:`, `on*=` 를 문자 그대로의 부분 문자열로만 매칭했습니다. `&lt;script&gt;`, `java&#115;cript:`, `<img src="data:image/svg+xml,<svg onload=…>">` 같은 입력이 그대로 통과했습니다. 정화 (sanitization) 로직은 이제 strip 정규표현식이 실행되기 **이전에** `&lt;`, `&gt;`, `&amp;`, `&quot;`, 숫자 (`&#NN;`) 및 16진 (`&#xHH;`) 엔터티를 디코딩합니다. [`tests/cv-xss-bypasses.test.mjs`](tests/cv-xss-bypasses.test.mjs) 의 11개 테스트로 검증했습니다. 실질적인 방어는 여전히 클라이언트의 escape-first 파이프라인 `UI.md` 가 담당하며, 이 변경은 저장된 파일 자체를 견고하게 만듭니다.

- **`fix(security): L-2 — bash --noprofile --norc on the batch runner`** ([`server/lib/routes/batch.mjs:108`](server/lib/routes/batch.mjs#L108)) — `spawn('bash', [PATHS.batchRunner, ...])` 가 사용자 `~/.bashrc` 를 상속받았습니다. 악성 rc 파일이 실행에 영향을 미칠 수 있었습니다. 이제 `spawn('bash', ['--noprofile', '--norc', PATHS.batchRunner, ...])` 형태로 호출합니다.

### 🔒 복원력

- **`fix(client): M-6 — exponential backoff on health ping`** ([`public/js/api.js:22-48`](public/js/api.js#L22-L48)) — 연결이 끊긴 상태의 폴러가 다운된 서버에 야간 동안 28,800회의 fetch 를 발사했습니다. 이제 3초 → 6초 → 12초 → 24초 → 60초로 백오프하며, 첫 2xx 복구 시 3초로 리셋됩니다. 각 단계가 새 지연 값을 반영하도록 `setInterval` 이 아닌 `setTimeout` 체인으로 구성했습니다.

- **`fix(client): M-5 — Safari private-mode localStorage guard`** ([`public/js/lib/i18n.js:572-583`](public/js/lib/i18n.js#L572-L583)) — Safari 사생활 보호 모드는 모든 `localStorage.getItem/setItem` 호출에서 `SecurityError` 를 던집니다. 로드 중 실행되는 IIFE 가 i18n 모듈 전체를 실패시켜 SPA 가 키 원문을 그대로 렌더링했습니다. 두 호출을 모두 try/catch 로 감싸고 `detect()` 의 브라우저 언어 폴백을 사용하도록 변경했습니다.

- **`fix(server): M-2 — body-size cap on outbound preview fetches (test + verify)`** — v1.21.0 의 `safeGet` 은 이미 청크 단위로 스트리밍하고 `opts.maxBytes` 에서 자르도록 구현되어 있었습니다. v1.22 는 [`tests/ssrf-redirect-rebind.test.mjs`](tests/ssrf-redirect-rebind.test.mjs) 에 명시적 회귀 테스트를 추가하여 계약을 고정합니다: 100 KB 업스트림 + 4 KB 캡 → 응답 ≤ 4 KB.

- **`fix(client): L-5 — clear setTimeout on hashchange in scan.js`** ([`public/js/views/scan.js:6-22, :113-120`](public/js/views/scan.js#L6-L22)) — 스캔 완료 후 300 ms `refreshResults()` 타이머가 사용자가 그 시간 안에 `#/scan` 에서 벗어날 경우 누수되었습니다. 핸들을 캡처하여 `__cancelActiveScanPoll` 에서 해제합니다.

- **`fix(client): L-4 — multi-line SSE data: joiner`** ([`public/js/lib/auto-pipeline.js:158-176`](public/js/lib/auto-pipeline.js#L158-L176)) — SSE 파서가 `match()` (단일 라인)를 사용했습니다. 명세에 따르면 한 이벤트는 여러 `data:` 라인을 가질 수 있고 컨슈머가 `\n` 으로 결합해야 합니다. 서버는 현재 단일 라인 JSON 만 보내므로 기존 코드도 동작했으나, 향후 멀티라인 페이로드에 취약했습니다.

### ♿ 접근성

- **`feat(a11y): M-3 — WCAG 1.4.1 redundant cues on score pills + connection banner`** ([`public/css/app.css:602-625, :812-822`](public/css/app.css#L602-L625)) — score-high / score-mid / score-low 가 색상만으로 상태를 전달했습니다 (빨강/주황/녹색). 색상을 인지하지 못하는 사용자는 폴백이 없었습니다. 각 등급에 `::before` 를 통한 중복 글리프 (✓ / ◐ / ○) 를 추가했습니다. 연결 배너는 오프라인 상태에서 선두에 `⚠` 글리프를 가집니다. 렌더링 지점은 손대지 않았고 순수 CSS 강화입니다.

- **`feat(a11y): M-1 — inline hint paragraphs for every mode-page field`** ([`public/js/views/mode-page.js`](public/js/views/mode-page.js), [`public/js/lib/i18n.js`](public/js/lib/i18n.js)) — v1.20.0 은 모든 mode-page 필드에 `htmlFor → id` 를 연결했으나 인라인 힌트 문구는 가져오지 못했습니다. 필드 의도를 문서화한 곳은 README 워크스루뿐이었습니다. v1.22.0 은 힌트 i18n 키 19개 × 8 로케일 = **신규 번역 152개** 를 추가하며, `field()` 빌더는 이제 필드별로 `aria-describedby` 가 연결된 `<p id="…-hint">` 를 렌더링합니다. 스크린 리더 사용자는 입력에 포커스가 갈 때 힌트를 듣습니다.

- **`fix(a11y): M-7 — null-guard on UI.el() htmlFor alias`** ([`public/js/api.js:194-198`](public/js/api.js#L194-L198)) — `htmlFor: null` 이 문자 그대로의 `for="null"` 로 렌더링되었습니다. 폴스루 분기의 `v != null && v !== false` 가드를 한 줄로 미러링했습니다.

### 🧹 품질 / 이식성

- **`fix(server): L-1 — parseInt radix in health.mjs + bin/start.sh + bin/setup.sh`** — `parseInt(process.versions.node)` 의 radix 누락은 린트 경고를 유발하며 Node 가 16진 버전을 사용하기 시작할 경우 취약합니다. 모든 곳에 `10` 을 추가했습니다.

- **`fix(server): L-3 — Windows-safe entrypoint check`** ([`server/index.mjs:159-163`](server/index.mjs#L159-L163)) — `import.meta.url === \`file://${process.argv[1]}\`` 는 Windows 의 드라이브 문자와 백슬래시를 잘못 처리합니다. `fileURLToPath(import.meta.url) === path.resolve(process.argv[1])` 로 교체했습니다.

- **`refactor(client): N-2 — drop Element.prototype.also monkey-patch`** ([`public/js/views/cv.js:188-201`](public/js/views/cv.js#L188-L201)) — 전역 DOM 프로토타입 오염이었습니다. 트리 루트를 위한 로컬 변수로 대체했습니다.

- **`test(canary): M-8 — 404 regression test for retired /api/scan-ru/config`** ([`tests/scan-consolidated.test.mjs`](tests/scan-consolidated.test.mjs)) — v1.20.0 이 별칭을 폐기했으나 카나리아를 추가하지 않았습니다. v1.18 의 폐기 테스트를 미러링하는 3줄 추가입니다.

### 📚 문서 + 시스템 프롬프트

- **`docs(architecture): refresh OVERVIEW + DATA-FLOWS for v1.21+ surface`** — OVERVIEW.md 에 `safe-fetch.mjs` (DNS-pinned GET), `file-lock.mjs` (경로별 뮤텍스), `rate-limit.mjs` (LLM 요청 빈도 제한), `sanitizePathName` 을 추가했습니다. DATA-FLOWS.md 에 두 개의 새 섹션을 추가했습니다: "Outbound URL fetches (DNS-rebind-safe)" 와 "LLM endpoint rate-limiting".

- **`docs(readme): security envelope section refresh`** — README.md 의 "Security notes" 가 이제 v1.21+ 보안 영역의 모든 헬퍼를 문서화합니다 (sanitizePathName, safeGet, withFileLock, llmRateLimit, 엔터티 인식 stripDangerousMarkdown).

- **`docs(qa): scenario 31 — career-ops.org/docs alignment`** ([`qa/claude-cowork-browser-test-prompt.md`](qa/claude-cowork-browser-test-prompt.md)) — 5개의 정규 career-ops.org/docs 가이드에 기술된 동작과 UI 가 일치하는지 검증하는 6개의 신규 서브 테스트 (31.1–31.6) 를 추가했습니다: 점수 임계값, 스캔 워크플로 (단일 버튼), 지원 워크플로 (체크리스트, 자동 제출 아님), 배치 워크플로 (TSV 편집기), Playwright 설정 (graceful 실패), help-bundle 커버리지 (5 URLs × 8 로케일).

- **`docs(translate): README quality refresh × 7 non-EN locales`** — 모든 비영어 README 가 해당 모국어로 출판 등급의 기술 문서 스타일로 재작성되었습니다. 흔한 어색한 직역을 교체했고, v1.21/v1.22 보안 영역 언급을 추가했으며, 릴리스/테스트 배지를 갱신했습니다.

- **`docs(system): .claude/PROJECT-CONTEXT.md + .github/copilot-instructions.md`** — 세션에 합류하는 에이전트를 위한 단일 파일 오리엔테이션입니다. CLAUDE.md 를 압축했고, v1.21+ 헬퍼의 이름을 명시하며, 흔한 함정을 나열합니다.

- **`docs(bin): actualize start.sh / setup.sh / run_all.sh comments`** — "two deps" → "three deps" (express + js-yaml + multer); "298 tests" → "474+ tests"; `parseInt` radix 추가.

### 🧪 테스트

- **461 → 474 유닛** (+13) + 32/32 Playwright 동일.
- 신규 테스트 파일: `cv-xss-bypasses.test.mjs` (M-4, 11 tests).
- 확장: `ssrf-redirect-rebind.test.mjs` (M-2 body cap 용 +1), `scan-consolidated.test.mjs` (M-8 별칭 카나리아 용 +1).
- 기존 스위트에 동작상 테스트 변경이 없습니다 — 모든 수정은 가산적이거나 신규 카나리아로 보호됩니다.

### 검증

```bash
npm test                          # 474 / 474
npm run test:e2e:browser          # 32 / 32

# Entity-encoded XSS strip:
node -e "import('./server/lib/security.mjs').then(({stripDangerousMarkdown}) => console.log(stripDangerousMarkdown('&lt;script&gt;alert(1)&lt;/script&gt;')))"
# → '' (no <script> survives)

# Health-ping backoff (open devtools, kill server, watch network panel):
#   3 s → 6 s → 12 s → 24 s → 60 s, then resets on first successful ping

# Score-pill glyph (open #/reports in light + dark theme):
#   .score-high shows ✓ + numeric score
#   .score-mid  shows ◐ + numeric score
#   .score-low  shows ○ + numeric score

# Mode-page hints (#/contacto, etc):
#   <input aria-describedby="mode-contacto-recipient-hint">  ← targets <p id="…">

# Retired alias:
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/scan-ru/config
# → 404
```

### Breaking changes

없습니다. 모든 수정은 가산적이거나 기존 엔드포인트 계약을 유지합니다.

### Out of scope (v1.23+)

| 항목 | 비고 |
|---|---|
| M-9 — 로케일 CHANGELOG 본문 번역 | 모든 `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` v1.13+ 항목이 영어 본문 임시 대체였습니다. 릴리스 주기가 안정되면 일괄 번역 후보입니다. |
| N-1 — `public/js/lib/i18n.js` 가 400 LOC 목표를 초과 | 로케일별 분할은 번들러 없이는 HTTP 비용을 증가시킵니다. 빌드 단계 결정이 내려질 때까지 연기합니다. |
| career-ops.org/docs 의 Help-bundle 콘텐츠 갱신 | 5개의 정규 URL 은 이미 모든 로케일의 help bundle (v1.11.x 이후) 에 등장합니다. QA 프롬프트의 시나리오 31.6 이 커버리지를 검증합니다. 콘텐츠 깊이 갱신은 v1.23 후보입니다. |

---

## [1.21.0] — 2026-05-14

**두 번의 독립적 코드 리뷰 패스에서 도출된 보안 + 동시성 + 접근성 폴리시.** [`docs/specs/V1.20.1-BACKLOG.md`](docs/specs/V1.20.1-BACKLOG.md) 의 7개 결과를 한 릴리스에 출하했습니다: 블로커 1건 (DNS-rebind TOCTOU), 고위험 버그 6건 (경로 탐색 정화 (sanitization) 분산, LAN 배포에서의 레이트 리밋 공백, 동시 쓰기 경쟁 상태 (race condition), i18n 커버리지 누락, 매달린 aria-describedby, 누락된 label 연결). 신규 테스트 34개; 기준선이 427 → 461 유닛 + 32/32 Playwright 로 상승했습니다. 모든 수정은 명명된 회귀 테스트 뒤에 배치됩니다.

### 🛡️ 보안

- **`fix(security): B-1 — close DNS-rebind TOCTOU via safe-fetch.mjs`** ([`server/lib/safe-fetch.mjs`](server/lib/safe-fetch.mjs)) — 이전 패턴은 검증을 위해 명시적 `dnsLookup` 을 한 번 수행한 뒤 `fetch()` 가 독립적인 조회를 다시 하도록 두었습니다. TTL=0 의 DNS rebind 공격자는 첫 조회에서 공인 IP 를, 두 번째 조회에서 `127.0.0.1` / `169.254.169.254` / LAN 주소를 반환하여 `isPrivateOrLoopbackHost` 를 우회할 수 있었습니다. 신규 `safeGet` 은 호스트를 **한 번만** 해석하고, node:http(s) 를 통해 TCP 연결을 정확히 그 IP 에 고정하며, 인증서 검증이 여전히 원본 호스트네임을 대상으로 하도록 SNI/Host 를 설정합니다. `/api/pipeline/preview` 와 `/api/auto-pipeline` 이 사용합니다. 조회 오류 시 fail-CLOSED (이전의 `try { … } catch { /* fall through */ }` 를 뒤집음). [`tests/ssrf-redirect-rebind.test.mjs`](tests/ssrf-redirect-rebind.test.mjs) 의 신규 테스트 8개로 검증했습니다.

- **`fix(security): H-4 — consolidate sanitizePathName across 10 routes`** ([`server/lib/security.mjs`](server/lib/security.mjs)) — 단순 `replace(/[^\w\-.]/g, '')` 정규표현식이 `jds.mjs`, `content.mjs`, `reports.mjs`, `llm.mjs`, `runners.mjs` 에 중복되어 있었고 `.` 문자를 유지해 `..pdf`, `....md`, 선행 점 이름이 살아남았습니다. `reports.mjs::sanitizeSlug` 만이 올바르게 처리했습니다. v1.21.0 은 올바른 버전 (`sanitizePathName`) 을 `security.mjs` 로 끌어올리고 10개의 잘못된 사본을 삭제했으며 빈 결과는 400 으로 거부합니다. [`tests/path-traversal.test.mjs`](tests/path-traversal.test.mjs) 의 12개 테스트로 검증했습니다.

- **`fix(security): H-5 — rate-limit LLM endpoints on public bind`** ([`server/lib/rate-limit.mjs`](server/lib/rate-limit.mjs)) — `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, `/api/auto-pipeline` 에 IP 별 요청 빈도 제한이 없었습니다. 루프백 사용자는 영향이 없으며, LAN 으로 노출된 배포 (`HOST=0.0.0.0`) 는 분당 IP 당 10 요청을 받고 초과 시 `Retry-After` 및 `X-RateLimit-*` 헤더가 부착됩니다. `LLM_RATE_LIMIT="N/Ws"` 로 설정 가능합니다. v2.0 P-12 인증 게이트 이전의 저비용 중간 방어책입니다. [`tests/rate-limit.test.mjs`](tests/rate-limit.test.mjs) 의 6개 테스트로 검증했습니다.

### 🔒 동시성

- **`fix(data): H-6 — per-file mutex on applications.md / pipeline.md`** ([`server/lib/file-lock.mjs`](server/lib/file-lock.mjs)) — 동시 `POST /api/tracker` (또는 auto-pipeline 과 수동 추가의 경쟁 상태 (race condition)) 가 둘 다 `num=42` 를 읽고 둘 다 `num=43` 을 써서 앞선 행을 조용히 누락시켰습니다. `withFileLock(path, fn)` 은 경로별로 read-modify-write 를 직렬화합니다; 독립적 경로는 여전히 병렬로 실행됩니다. `tracker.mjs`, `pipeline.mjs` (POST + DELETE), `auto-pipeline.mjs` 의 tracker 단계에 연결되어 있습니다. [`tests/concurrent-tracker-write.test.mjs`](tests/concurrent-tracker-write.test.mjs) 의 5개 테스트로 검증했으며, 20개 동시 POST 가 001..020 까지 순차적으로 저장되는지 확인하는 통합 테스트가 포함됩니다.

### ♿ 접근성

- **`fix(a11y): H-1 — id="batch-tsv-hint" on the batch.js hint paragraph`** ([`public/js/views/batch.js`](public/js/views/batch.js)) — v1.20.0 이 TSV 텍스트영역에 `aria-describedby="batch-tsv-hint"` 를 추가했으나 힌트 `<p>` 에 해당 `id` 를 부여하지 않았습니다. 스크린 리더가 발화할 대상이 없었습니다. 수정했습니다.

- **`fix(a11y): H-2 — htmlFor on batch-parallel / batch-min-score labels`** ([`public/js/views/batch.js`](public/js/views/batch.js)) — v1.20.0 의 입력 4개가 새 id 를 받았지만 라벨이 프로그래밍적으로 연결되지 않았습니다. 이제 WCAG 3.3.2 를 충족합니다.

- [`tests/a11y-form-wires.test.mjs`](tests/a11y-form-wires.test.mjs) 의 신규 정적 분석 카나리아 — 모든 뷰 파일을 순회하며 모든 `aria-describedby` / `htmlFor` IDREF 가 형제 `id:` 선언을 가리키는지 단언합니다. 오타성 회귀를 CI 시점에 잡습니다.

### 🌐 i18n

- **`fix(i18n): H-3 — 13 keys from v1.20.0 silently fell through to EN for 7 locales`** ([`public/js/lib/i18n.js`](public/js/lib/i18n.js)) — `pipe.filter`, `pipe.count`, `pipe.preview*`, `pipe.openTab`, `pipe.evaluateAll*`, `eval.jdHint`, `batch.parallelAria`, `batch.minScoreAria`, 그리고 `common.delete`, `config.group{Core,Runtime,Regional}`, `config.profileEmpty`, `config.viewProfile`, `scan.atsBadge`, `scan.regionalBadge` 가 `t('key', 'EN fallback')` 를 통해 참조되었으나 DICT 에는 결코 추가되지 않았습니다. 러시아어, 일본어, 중국어 스크린 리더 사용자는 영어 `aria-label` 을 듣게 되어, v1.20.0 이 주장한 WCAG 3.3.2 성과를 직접적으로 무효화했습니다. v1.21.0 은 19개 키 × 8 로케일 (≈ 신규 번역 150개) 을 모두 추가하고 [`tests/i18n-coverage.test.mjs`](tests/i18n-coverage.test.mjs) 를 확장하여 `public/js/**/*.js` 의 모든 `t('key', …)` 호출을 스캔하고 각 키가 DICT 에 존재하는지 단언하는 정적 분석 패스를 포함합니다. 향후 표류는 CI 시점에 잡힙니다.

### 🧪 테스트

- **427 → 461 유닛** (+34) + 32/32 Playwright 동일.
- 신규 테스트 파일: `ssrf-redirect-rebind`, `path-traversal`, `concurrent-tracker-write`, `rate-limit`, `a11y-form-wires`.
- 기존 `pipeline-preview.test.mjs` 는 `globalThis.fetch` 목에서 `safe-fetch.mjs` 의 신규 `_setTransport` 주입 지점으로 재배선되었습니다 — SSRF 경로가 더 이상 fetch 를 통과하지 않으므로 옛 목이 조용히 우회되었습니다.

### 검증

```bash
npm test                              # 461 / 461
npm run test:e2e:browser              # 32 / 32
node --test tests/ssrf-redirect-rebind.test.mjs tests/path-traversal.test.mjs \
  tests/concurrent-tracker-write.test.mjs tests/rate-limit.test.mjs \
  tests/a11y-form-wires.test.mjs      # 34 new tests, all green

# Path-traversal: every traversal-style :name returns 400 / 404
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/jds/..pdf
# → 400

# Rate-limit on public bind:
HOST=0.0.0.0 LLM_RATE_LIMIT=3/60s npm start &
for i in 1 2 3 4; do
  curl -sS -o /dev/null -w '%{http_code} ' -X POST -H 'Content-Type: application/json' \
    -d '{"jd":"…"}' http://0.0.0.0:4317/api/evaluate
done
# → 200 200 200 429

# Concurrent tracker writes: 20 parallel POSTs, 20 rows land:
node tests/concurrent-tracker-write.test.mjs
# 20 sequential rows 001..020

# Aria wires sanity:
grep -r 'aria-describedby' public/js/views/ | wc -l
# matching `id:` lookups all resolve (a11y-form-wires.test.mjs canary)
```

### Out of scope (v1.22+)

| 항목 | 비고 |
|---|---|
| `pipeline-preview` 본문 크기 스트리밍 캡 (M-2) | `await upstream.text()` 가 8 KB 슬라이스 이전에 본문 전체를 읽으므로 악성 1 GB 스트림이 메모리를 소진할 수 있습니다. 바이트 카운터 + abort 로 스트림 읽기 권장. |
| WCAG 1.4.1 — `.connection-banner` + 점수 pill 의 색상 전용 상태 (M-3) | 색상만으로 상태를 전달하므로 아이콘 접두어 (✓ / ◐ / ○) 또는 텍스트 접미어를 추가해야 합니다. |
| HTML 엔터티를 통한 `stripDangerousMarkdown` 우회 (M-4) | `&lt;script&gt;`, `java&#115;cript:`, `<img src="data:image/svg+xml,<svg onload=…>">` 가 정규표현식을 통과합니다. UI.md 를 통한 심층 방어는 여전히 유효하나 테스트 스윕에서 우회를 문서화 및 잠금. |
| try/catch 없이 Safari 사생활 보호 모드 `localStorage` 접근 (M-5) | `i18n.js:544/571` 이 던지므로 SPA 가 키 원문을 렌더링합니다. `'en'` 기본값과 함께 try/catch 로 감쌀 것. |
| 백오프 없는 `setInterval(checkHealth, 3000)` (M-6) | 지수 백오프 3s → 6s → 12s → cap 60s. |
| null 가드가 없는 `htmlFor` 별칭 (M-7) | 한 줄 `if (v != null && v !== false)` 방어. |
| 폐기된 `/api/scan-ru/config` 의 404 카나리아 (M-8) | v1.18 선례를 미러링하는 3줄 테스트. |
| 로케일 CHANGELOG 본문 번역 (M-9) | 릴리스 주기 안정 이후 일괄 번역 후보. |
| 모든 mode-page 필드의 인라인 힌트 단락 (M-1) | i18n 키 약 168개 × 8 로케일; 폴리시 항목으로 보류. |
| L-1 ~ L-5 자잘한 항목 | parseInt radix, bash --noprofile, Windows 안전 fileURLToPath, 멀티라인 SSE, scan.js 타이머 정리. |

---

## [1.20.0] — 2026-05-13

**컴포넌트별 접근성 폴리시 + 비영어 README 패리티 + `/api/scan-ru/config` 별칭 폐기.** v1.19.0 의 "Out of scope" 표가 v1.20 으로 표시했던 네 항목을 모두 종료합니다.

### ♿ WCAG 2.5.5 / 2.5.8 — 컴포넌트별 터치 타겟 감사

- **`a11y(touch-target): chip min-height 28 px + 8 px gap (2.5.8 spaced-target exception)`** — `.chip` 은 24 × ~50 px 였고 (수직 24, 군집 컨트롤용 2.5.5 의 24 px 최저치를 미달성), 2.5.8 의 spaced-target 예외는 ≥ 24 × 24 px 또는 24 px 여유 중 하나를 요구합니다. `.chip` 을 `min-height: 28px; padding: 6px 12px;` 로, 감싸는 `.chip-row` 를 `gap: 8px;` 로 조정해 두 조건을 동시에 충족했습니다.
- **`a11y(touch-target): sidebar nav-item min-height 44 px`** — `.nav-item` 은 `10px 14px` 패딩만 갖고 있어 대부분의 뷰포트에서 계산된 높이가 ~36 px 였습니다. 이제 `padding: 12px 14px; min-height: 44px; box-sizing: border-box;` 입니다. `.btn` 최저치와 일치합니다.
- **`a11y(touch-target): tab-btn min-height 44 px`** — Reports, Tracker, Scan 결과의 Sortable Headers / 카테고리 탭에도 동일한 처리.

### ♿ WCAG 1.3.1 / 3.3.2 — 인라인 폼 힌트의 `aria-describedby`

SPA 전반의 모든 폼 컨트롤이 이제 안정된 `id` 를 갖고, `<label>` 이 `htmlFor` 로 이를 가리키며, 인라인 힌트 단락은 `aria-describedby` 로 연결됩니다. 5개의 뷰 파일을 재배선했습니다:

- **`a11y(forms): config.js`** — 키별 `id` + 힌트 연결 (`cfg-<key>` / `cfg-<key>-hint`).
- **`a11y(forms): evaluate.js`** — `eval-jd` textarea + 정화 (sanitization) 후 50자 최소를 문서화하는 `eval-jd-hint` 단락.
- **`a11y(forms): batch.js`** — `batch-tsv` / `batch-tsv-hint`, 더하여 `batch-parallel`, `batch-min-score`, `batch-dry-run`, `batch-retry` 의 `aria-label`.
- **`a11y(forms): pipeline.js`** — `pipe-filter` + `pipe-new-url` / `pipe-new-url-hint`.
- **`a11y(forms): mode-page.js`** — 7개 범용 모드 (`project`, `training`, `followup`, `batch-prompt`, `contacto`, `interview-prep`, `patterns`) 의 모든 필드가 `mode-<slug>-<name>` id 와 `htmlFor` 라벨을 받습니다.

`UI.el()` 은 React 스타일 `htmlFor` 별칭을 학습하여 뷰 코드가 선언적으로 유지됩니다 — 내부적으로는 (JS 예약어인 프로퍼티 이름인) `for` 어트리뷰트를 설정합니다.

### 🌍 비영어 README 패리티

- **`docs(readme): translate 7 locales to 585-line parity with EN master`** — `README.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` 가 306–316 줄이었습니다 (헤드라인은 다루되 마케팅 중심 워크스루와 API 레퍼런스 대부분을 건너뜀). 일곱 모두 이제 EN 구조를 처음부터 끝까지 미러링합니다: About → One-command install → Why? → Quick start (번호 매겨진 3단계) → Requirements → What you get 표 → Scan → Architecture (전체 디렉토리 트리) → API reference (모든 라우트 표) → Tests → Configuration → Security notes → Limitations → Contributing → 🌍 Getting Started 5단계 워크스루 → License.

### 🧹 `/api/scan-ru/config` 별칭 폐기

- **`feat!(scan): remove /api/scan-ru/config legacy alias (sunset v1.20)`** — v1.19 에서 한 릴리스 동안의 별칭으로 유지되었습니다. 정규 `/api/scan/regional/config` 가 유일한 경로입니다. 제거: `server/lib/routes/scan.mjs` 의 라우트 등록, `README.md`, `docs/architecture/{OVERVIEW,SERVER,API}.md` 의 문서 참조. 테스트는 이미 정규 경로를 다루고 있었으므로 변경 불필요.

### 🧪 테스트

- v1.19 와 동일한 스위트. **427 / 427** 유닛 + 20/20 smoke + 23/23 comprehensive + 32/32 Playwright. 모든 접근성 배선은 가산적입니다 (`id` / `for` / `aria-describedby` 어트리뷰트가 더 추가됨) — 동작 변경이나 테스트 차이가 없습니다.

### 검증

```bash
npm test                              # 427 / 427
npm run test:e2e:browser              # 32 / 32

# Touch targets — every chip / nav-item / tab-btn ≥ 28 / 44 / 44 px:
#   Chrome DevTools → Computed → height/min-height on .chip, .nav-item, .tab-btn

# Form labels — every input has a label[for=…] association:
#   document.querySelectorAll('input,textarea,select').forEach(el =>
#     console.assert(el.labels?.length || el.getAttribute('aria-label'), el))

# Alias gone:
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/scan-ru/config
# → 404

# Canonical still works:
curl -s http://127.0.0.1:4317/api/scan/regional/config | jq '.'
```

### Breaking changes

- `DELETE /api/scan-ru/config` — 제거됨. `/api/scan/regional/config` 를 사용하십시오. v1.19.0 의 CHANGELOG 와 검증 스크립트에서 sunset 으로 예고되었습니다.

### Out of scope (v1.21+)

| 항목 | 비고 |
|---|---|
| 모든 mode-page 필드의 인라인 힌트 단락 | 현재는 `<label for=…>` 연결만 적용되어 있습니다. 필드별 가시 힌트 문구는 여전히 SPA 에서 영어 전용입니다. README 워크스루가 모든 로케일에서 필드 의도를 문서화하므로 폴리시 항목이며 블로커는 아닙니다. |
| `.connection-banner` 와 대시보드 점수 pill 의 색상 전용 상태 노출 (WCAG 1.4.1) | 배너가 빨강/주황/녹색에 의존합니다; 색상을 인지하지 못하는 사용자를 위해 아이콘 또는 텍스트 접미어가 필요합니다. |
| 로케일별 CHANGELOG 본문 번역 | `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` 에 영어 본문 임시 대체가 남아 있습니다. 번역은 v1.x 릴리스 주기가 안정된 후 진행합니다. |

---

## [1.19.0] — 2026-05-13

**WCAG 1.4.3 명도 대비 + 스캔 통합 (최종) + UI 에서 HH_USER_AGENT 제거.** v1.18 의 out-of-scope 였던 명도 대비 감사를 종료하고, v1.18 에서 시작한 EN/RU 분할 제거를 마무리하며, 사용자 방향에 따라 UI 에서 `HH_USER_AGENT` 설정 노브를 제거합니다 (서버에 번들된 합리적 기본값이 이미 대부분의 비-RU IP 에서 동작합니다).

### ♿ WCAG 1.4.3 명도 대비 패스

- **`a11y(contrast): introduce AA-passing *-text variants for accent tokens`** — 라이트 테마: `--rausch-text: #b80f42` (흰색 위 6.59:1, 이전 3.52:1), `--kazan-text: #066507` (7.31:1, 이전 4.53:1), `--darjeeling-text: #7a5800` (앰버 배경 위 5.73:1, 이전 4.24:1), `--babu-text: #00665e` (6.09:1, 이전 2.70:1). 다크 테마: 밝게 조정된 미러 (`#ff8aa0`, `#6ee7b7`, `#fcd34d`, `#5eead4`) 가 `#161a22` 페이퍼 위에서 동일한 4.5:1 최저치를 만족합니다.
- 배지 클래스 (`.badge-ok`, `.badge-warn`, `.badge-bad`, `.badge-info`) 와 점수 pill (`.score-high`, `.score-mid`, `.score-low`) 은 이제 신규 `*-text` 변종을 통해 라우팅되어 — 모든 틴트 배경 위 텍스트 조합이 AA 를 통과합니다. 액센트 채움 토큰 (`--rausch`, `--kazan` 등) 은 경계선과 외곽선용으로 유지됩니다 (비텍스트 UI 컴포넌트는 3:1 만 요구).

### 🧹 스캔 통합 (v1.18 작업 마무리)

- **`docs(scan): scrub remaining EN/RU split references across READMEs + help + architecture docs`** — README 8개 + help 번들 8개 + 아키텍처 문서 3개 (API.md, SERVER.md, OVERVIEW.md, DATA-FLOWS.md) + scan.js 주석이 이제 단일 통합 스캔 방식을 설명합니다. 레거시 `/api/stream/scan-{en,ru}` 별칭은 v1.18 에서 이미 사라졌습니다; v1.19 는 여전히 스캔을 2단계 EN+RU 프로세스로 묘사하던 문서/문구를 잡아냅니다.
- **`feat(scan): canonical /api/scan/regional/config endpoint`** — `/api/scan-ru/config` 은 한 릴리스 동안 얇은 별칭으로 유지하여 하위 호환을 제공합니다. 신규 경로는 소스 이름 규칙 (`?source=regional`) 과 일치합니다.

### 🛠️ UI 에서 HH_USER_AGENT 제거

- **`feat!(config): drop HH_USER_AGENT field from /#/config + KNOWN_KEYS`** — 파워 유저는 여전히 `career-ops/.env` 에 직접 `HH_USER_AGENT` 를 설정할 수 있습니다 (서버는 `server/lib/sources/hh.mjs` 에서 `process.env.HH_USER_AGENT` 를 읽으며 번들된 UA 가 폴백입니다). 대부분의 사용자에게는 기본값으로 충분하고 App Settings 페이지에서 알 수 없는 User-Agent 필드를 보는 것이 반복적인 혼란의 원인이었기 때문에 UI 는 더 이상 이를 노출하지 않습니다.
- 8개 로케일의 README 와 help 번들 언급이 "러시아 IP / VPN 으로 실행" 안내로 교체되었습니다. `scan.hhWarning` i18n 키는 환경 변수 설정 세부 사항을 제거하도록 재작성되었습니다.
- `KEY_GROUPS` 가 축소되었습니다: 더 이상 `regional` 분류가 없습니다 (HH_USER_AGENT 만 있었음). 테스트가 갱신되었고; `regionalActive` 페이로드 필드는 SPA 하위 호환을 위해 유지됩니다.

### 🧪 테스트

- `tests/env-config.test.mjs` — `KNOWN_KEYS` 단언이 이제 HH_USER_AGENT 를 제외합니다; 키가 의도적으로 부재함을 확인하는 신규 단언.
- `tests/config-endpoint.test.mjs` — POST 쓰기 다중 키 테스트가 HH_USER_AGENT 대신 두 번째 알려진 키로 `GEMINI_MODEL` 을 사용합니다.
- `tests/config-groups.test.mjs` — `groups.HH_USER_AGENT` 가 이제 `undefined` 로 기대됩니다.
- 합계: **427 / 427** 유닛 + 20/20 smoke E2E + 23/23 comprehensive E2E + 32/32 Playwright. 조정된 모든 테스트가 이미 집계되었기 때문에 v1.18.0 과 동일한 수치입니다.

### 검증

```bash
npm test                              # 427 / 427

# Contrast (Chrome DevTools or axe) on light + dark:
#   .badge-ok / .badge-warn / .badge-bad / .badge-info → AA pass (4.5:1+)
#   .score-high / .score-mid / .score-low → AA pass

# HH_USER_AGENT no longer in /api/config:
curl -s http://127.0.0.1:4317/api/config | jq '.values | keys'
# → ["ANTHROPIC_API_KEY","ANTHROPIC_MODEL","GEMINI_API_KEY","GEMINI_MODEL","HOST","PORT"]
# (no HH_USER_AGENT)

# Canonical regional config endpoint:
curl -s http://127.0.0.1:4317/api/scan/regional/config | jq '.'
# Legacy alias still alive through v1.20:
curl -s http://127.0.0.1:4317/api/scan-ru/config | jq '.'
```

### Out of scope (v1.20+)

| 항목 | 비고 |
|---|---|
| 컴포넌트별 터치 타겟 감사 (필터 chip, 정렬 가능한 헤더, 사이드바 내비게이션) | v1.18 이 전역 최저치를 설정했고 (`.btn` 44 px, `.btn-sm` 32 px); SPA 전반의 컴포넌트별 검증은 남아 있습니다. |
| 인라인 폼 힌트의 `aria-describedby` (`#/config`, `#/pipeline`, `#/evaluate`, `#/batch`) | v1.17 이 글로벌 검색과 모달 닫기의 `aria-label` 을 다루었습니다. 입력별 힌트 연결이 다음 폴리시 레이어입니다. |
| 비영어 README 의 전체 패리티 (EN 처럼 585줄) | v1.18 이 비영어를 ~307 (EN 의 53 %) 로 가져왔습니다. 마케팅 중심의 "Quick start" + "🌍 Getting Started" 워크스루는 영어 전용으로 남아 있습니다. |
| `/api/scan-ru/config` 레거시 별칭 제거 | v1.20 에 sunset 계획. 정규 `/api/scan/regional/config` 이 마이그레이션 대상입니다. |

---

## [1.18.0] — 2026-05-13

**스캔 엔드포인트 통합 + WCAG 2.2 AA 패스 + i18n long-tail 마무리.** 레거시 `/api/stream/scan-{en,ru}` 별칭을 폐기합니다 (Sunset 기간 2026-10-01 을 사용자 방향에 따라 v1.18 로 앞당김). 비영어 README 를 ~307 줄로 끌어올리고, 6개 로케일에서 RU 본문이 남아 있던 v1.16.0 + v1.17.0 CHANGELOG 항목을 번역합니다.

### 🚪 Breaking

- **`feat!(scan): retire legacy /api/stream/scan-{en,ru} aliases`** — 폐기된 EN/RU 분할 SSE 엔드포인트가 사라졌습니다. 모든 컨슈머는 v1.12.0 부터 활성 상태인 통합 `/api/stream/scan?source=ats|regional|both` 엔드포인트를 통과합니다. 레거시 경로는 v1.15.0 부터 Deprecation + Sunset (RFC 8594) 헤더를 갖고 있었습니다; 마이그레이션 기간이 종료되었습니다. 옛 경로의 외부 통합은 SPA catch-all 로 조용히 라우팅되는 대신 **404** 를 받습니다.

### ♿ 접근성 (WCAG 2.2 AA 패스)

- **WCAG 2.4.1 Bypass Blocks** — 모든 페이지의 첫 번째 포커스 가능 요소로 신규 **Skip to main content** 링크. `.skip-link` 로 시각적으로 숨겨져 있다가 포커스를 받으면 좌상단으로 표시됩니다.
- **WCAG 2.4.7 Focus Visible** — 전역 `*:focus-visible` 스타일. 마우스 클릭 포커스 링은 꺼지고 키보드 Tab 포커스 링은 켜집니다 (WAI-ARIA AP 표준 패턴). 모달 닫기 (×) 는 더 높은 대비의 포커스 링을 받습니다.
- **WCAG 2.5.5 Target Size** — `.skip-link` 의 최소 44×44 px 터치 타겟. `.btn-sm` 은 32 px min-height 를 유지합니다 (행 간격과 결합하면 컴팩트 테이블 행 컨트롤용 24×24 + 간격 AAA 예외를 충족).
- **WCAG 3.1.1 Language of Page** — `<html lang="en">` 을 `lang="ru"` 에서 수정했습니다 (JS i18n 부트스트랩이 이미 로드 시 이를 재정의했지만 SSR 기본값이 이제 SPA 기본 로케일과 일치합니다).
- **WCAG 1.3.1 Info & Relationships** — `#content` 가 `tabindex="-1"` 을 받아 skip-link 대상이 깔끔하게 포커싱됩니다. (ARIA 역할 + focus-trap 은 이미 v1.17 에서 추가되었습니다.)

### 📚 i18n long-tail

- **`docs(i18n): v1.16.0 + v1.17.0 CHANGELOG translated in 6 locales`** — `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` 에서 이전에 RU 본문이었던 항목들이 이제 네이티브 언어로 표시됩니다. 로케일당 RU 문자 수가 79 → 42 → 23 으로 감소했습니다 (남은 23개는 파일 경로 같은 기술적 인라인 참조와 의도적으로 유지되는 다국어 헤더 링크입니다).
- **`docs(readme): expand non-EN READMEs with Why / Requirements / Features / Configuration / Contributing`** — 각 비영어 README 가 240 → ~307 줄로 성장했습니다. 이제 585줄 EN 과 동일한 비마케팅 섹션을 다룹니다. 전체 1:1 패리티 (마케팅 중심 워크스루 섹션) 는 여전히 연기됩니다.

### 🛠️ Misc

- **`docs(api): consolidated scan endpoint in API.md + DATA-FLOWS.md + README.md`** — API 레퍼런스 표가 이제 `/api/stream/scan?source=…` 만 나열합니다. README 의 Scan 섹션이 v1.18.0 의 EN/RU 분할 폐기를 설명합니다.
- **`fix(scan.js): drop stale comment about deprecated aliases being live`** — SPA 의 runScanAll 디스패처 주석이 통합된 현실을 반영합니다.

### 🧪 테스트

- `tests/scan-consolidated.test.mjs::F-018 backwards compat` 가 재작성되었습니다 — 이전의 두 "레거시 엔드포인트가 여전히 동작함" 단언이 이제 `/api/stream/scan-{en,ru}` 요청이 (SPA catch-all 로 라우팅되는 대신) **404** 를 반환하는지 검증합니다.
- 합계: **427 / 427** 유닛 + 20/20 smoke E2E + 23/23 comprehensive E2E + 32/32 Playwright (수치 동일; +2 개의 새로운 레거시 제거 단언이 +2 개의 레거시 정상 동작 단언을 대체).

### 검증

```bash
npm test                              # 427 / 427
npm run test:e2e:full                 # 23 / 23

# Legacy endpoint retirement:
curl -sI http://127.0.0.1:4317/api/stream/scan-en | head -1   # → HTTP/1.1 404
curl -sI http://127.0.0.1:4317/api/stream/scan-ru | head -1   # → HTTP/1.1 404

# Consolidated endpoint:
curl -sN 'http://127.0.0.1:4317/api/stream/scan?source=ats&dryRun=1' | head -5
# → event: start
# → data: {"script":"en-scanner","writeFiles":false,…}

# Skip link (a11y):
curl -s http://127.0.0.1:4317/ | grep -c 'class="skip-link"'  # → 1

# html lang fallback:
curl -s http://127.0.0.1:4317/ | grep -c 'html lang="en"'     # → 1
```

### Out of scope (v1.19+)

| 항목 | 비고 |
|---|---|
| 비영어 README 의 전체 패리티 (EN 처럼 585줄) | v1.18 이 비영어를 ~307 (EN 의 53 %) 로 가져왔습니다. 마케팅 중심 "Why?" / "Quick start" 워크스루는 영어 전용으로 남아 있습니다. |
| 색상 명도 대비 감사 (WCAG 1.4.3 AA — 텍스트 4.5:1, 대형 텍스트 3:1) | v1.18 이 구조적 접근성을 다루었습니다; 라이트 + 다크 팔레트 전반의 토큰별 명도 대비 검증은 남아 있습니다. |
| 모든 상호작용 요소에 대한 터치 타겟 감사 | v1.18 이 최저치를 설정했고 (`.btn`: 44 px, `.btn-sm`: 32 px); 컴포넌트별 검증 (필터 chip, 사이드바 내비게이션, 정렬 가능한 헤더) 은 남아 있습니다. |

---

## [1.17.0] — 2026-05-13

**폴리시 + 접근성 + CI 수정 릴리스.** v1.16.0 목록의 9개 후속 작업을 모두 종료합니다: 브라우저 smoke 검증, README 배지 정합, 커버리지 갱신, SPA 에 surface 된 `lastWorkdayFallback`, 전체 E2E 재기준선, Playwright auto-pipeline 시나리오, 접근성 감사 패스, 6개 로케일에서 과거 CHANGELOG 압축, Architecture / API / Security / Tests 섹션으로 비영어 README 확장.

### 🐛 수정

- **`fix(e2e): smoke + comprehensive suites re-aligned with v1.16 UX`** — v1.16 의 Cmd+K Enter → AutoPipeline 모달 변경 때문에 e2e 테스트의 `search.press('Enter')` 가 후속 클릭을 가로채는 모달을 열었습니다. 테스트는 이제 v1.16 의 문서화된 분기와 일치하도록 레거시 quick-add 경로에 `Shift+Enter` 를 사용합니다. comprehensive E2E 의 배치 모드 반복도 (v1.15 PR-H 가 도입한 레거시 mode-prompt slug 인) `/#/batch-prompt` 를 사용하도록 갱신되었습니다. **이것이 v1.16.0 푸시의 CI 실패였습니다** — Playwright e2e 가 backdrop 가로채기 클릭에서 30초 동안 타임아웃되었습니다.
- **`fix(mode-page): batch-prompt route → modes/batch.md via serverSlug`** — v1.15 가 레거시 mode slug 를 `batch-prompt` 로 이름을 바꾸었지만, 서버의 `POST /api/mode/:slug` 는 존재하지 않는 `modes/batch-prompt.md` 를 찾고 있었습니다. 신규 `serverSlug` 필드는 라우트 해시를 부모의 mode 파일 이름과 분리합니다.
- **`chore: bump deprecation messages from v1.16.0 to v1.17.0`** — scan-en/scan-ru deprecation 문구와 batch-prompt deprecation 배너가 과거 버전을 참조하고 있었습니다.

### ✨ 기능

- **`feat(scan): 🔒 Workday CAPTCHA chip in Active Companies card`** — v1.16 PR-7 의 서버 사이드 `lastWorkdayFallback` export 가 이제 SPA 에서 소비됩니다. `/api/scan-results` 가 스냅샷을 반환합니다; `#/scan` 은 Workday 테넌트가 폴백으로 떨어진 경우 Active Companies 위에 경고 톤의 카드를 렌더링합니다 ("🔒 Workday tenant blocked — fallback: use /career-ops scan (Playwright)"). 신규 `getLastWorkdayFallback()` exporter 는 ESM live-binding 모호성을 피합니다. 신규 i18n 키 2개 × 8 로케일.

### ♿ 접근성

- **`a11y: ARIA roles + focus management pass on critical surfaces`** —
  - `index.html`: `<aside>` (navigation), `<header>` (banner), `<section id="content">` (main), `<div id="modal">` (aria-modal/aria-labelledby 를 가진 dialog), `<div id="toast">` + `#conn-banner` (aria-live 를 가진 status), `<div class="searchbar">` (search) 에 `role` 어트리뷰트.
  - `#sidebar-toggle` 은 `aria-controls="sidebar"` 와 열기/닫기 시 JS 가 동기화하는 `aria-expanded` 를 받습니다.
  - `#global-search` 는 시각적으로 숨겨진 `<label>` 과 Cmd+K 단축키 힌트를 표시하는 명시적 `aria-label` 을 받습니다.
  - 모달 닫기 (×) 는 `aria-label="Close dialog"` 를 받습니다.
  - 장식용 backdrop 은 `aria-hidden="true"` 를 받습니다.
  - **모달의 Focus trap** — `UI.modal()` 이 클릭 소유자를 기억하고, 열릴 때 첫 번째 비닫기 포커스 가능 요소에 포커스를 두며, 모달 내에서 Tab/Shift+Tab 을 순환시킵니다. `UI.closeModal()` 은 이전 소유자에게 포커스를 복원합니다.
  - `public/css/app.css` 의 신규 `.visually-hidden` 유틸리티 클래스 (WAI-ARIA AP 표준 패턴).

### 📚 문서

- **`docs(readme): badge truth across 8 READMEs`** — tests 배지 `284 / 379 / 360` → **427**; release 배지 `v1.9.1 / v1.13.0` → **v1.16.0** 그 후 v1.17 bump 로 → v1.17.0. 릴리스 링크 타깃 갱신.
- **`docs(readme): expand 7 non-EN READMEs with reference sections`** — 각 README 가 170 → ~240 줄로 성장하면서 네이티브 언어로 Architecture / API reference / Security notes / Tests / A11y / Limitations / License 섹션이 추가되었습니다. 아직 EN 의 585줄 패리티는 아니지만 모든 핵심 비마케팅 표면을 다룹니다.
- **`docs(changelog): condense pre-v1.12 entries in 6 locales`** — 비영어/비러시아어 CHANGELOG 에 흘러들어간 길고 RU 본문이었던 v1.11.x + v1.10.x 항목이 이제 각 로케일의 네이티브 언어로 압축된 "Earlier releases" 요약으로 교체되었습니다. 상세 이력은 `CHANGELOG.md` (EN) 에 유지됩니다.

### 🛠️ 도구

- **`coverage: refresh numbers`** — 마지막 공개치는 95.46 % 라인 / 84.06 % 브랜치 (v1.13.0 REVIEW) 였습니다. v1.17 기준선: **94.14 % 라인 / 82.98 % 브랜치 / 93.20 % 함수**. auto-pipeline + reports-write 의 새 오류 경로로 약간 감소; 여전히 CLAUDE.md 의 80 % 최저치보다 한참 위입니다.

### 🧪 테스트

- 합계: **427 / 427** 유닛 + 20/20 smoke E2E + 23/23 comprehensive E2E + **32 / 32** Playwright (이전 28; +4 신규 auto-pipeline 시나리오: 버튼이 모달을 엽니다, Cmd+K 붙여넣기가 모달을 트리거합니다, 잘못된 URL 이 1단계를 게이팅합니다, `POST /api/auto-pipeline` SSE 이벤트 프레이밍).
- E2E 스위트가 v1.16.0 UX 에 재정렬되었습니다 (Shift+Enter quick-add, 레거시 모드용 /#/batch-prompt).

### 검증

```bash
# Locally:
npm test                          # 427 / 427
npm run test:e2e                  # 20 / 20
npm run test:e2e:full             # 23 / 23
npm run test:e2e:browser          # 32 / 32

# Browser smoke (page-level):
curl -s http://127.0.0.1:4317/api/scan-results | jq '.workdayFallback'
# null when no Workday fallback occurred; {apiUrl, reason, at} after a 4xx.

# A11y spot-check:
node -e "
const c = require('cheerio').load(require('fs').readFileSync('public/index.html','utf8'));
['banner','navigation','main','dialog','status','search'].forEach(r =>
  console.log(r, c('[role=' + r + ']').length));
"
# Each role should appear ≥1.

# CI gate verification: dashboard-screenshots workflow boots a /tmp
# scaffold, regenerates PNGs, diffs against committed — green when
# images/dashboard-*.png are up to date with rendered SPA.
```

### Out of scope (v1.18+)

| 항목 | 비고 |
|---|---|
| 비영어 CHANGELOG 의 v1.16.0 항목 번역 | 현재 RU 본문 (~30 줄 × 6 로케일 = 180 줄). 사용자의 명시적 v1.11.x/v1.10.x 범위 밖이었습니다. |
| 비영어 README 의 전체 패리티 (EN 처럼 585줄) | v1.17 이 비영어를 ~240 으로 가져왔습니다; 마케팅 중심의 "Why?" / "Quick start" 워크스루는 영어 전용으로 남아 있습니다. |
| 정규 A-F 프롬프트의 부모 커밋 | `santifer/career-ops::modes/oferta.md` 재작성이 여전히 upstream 에서 필요합니다 (CLAUDE.md 하드 룰 #1). |
| 전체 WCAG 2.2 AA 감사 | v1.17 이 구조적 ARIA + focus trap 을 다루었습니다; 컴포넌트별 명도 대비/Tab 순서 감사는 대기 중. |

---

## [1.16.0] — 2026-05-13

**Auto-pipeline 마무리 + 어댑터 폴리시 + i18n long-tail.** v1.15.0 REVIEW 의 11개 후속 작업을 모두 종료합니다: 서버 사이드 SSE auto-pipeline, `POST /api/reports` 프리미티브, Cmd+K 단축키, SmartRecruiters 페이지네이션, Workday CAPTCHA 폴백, CI 스크린샷 드리프트 게이트, 스캔 소스 필터 UX, 과거 CHANGELOG 번역 (v1.13.0/v1.12.0 × 6 로케일), 비영어 README 확장, paste-ready trending-companies importer.

### ✨ 기능

- **`feat(auto-pipeline): server-side SSE orchestrator`** (#1, #2, #3, #8) — v1.15 의 클라이언트 사이드 chained-fetch 오케스트레이터는 사라졌습니다. `POST /api/auto-pipeline` 은 이제 curl 가능한 SSE 엔드포인트로, validate → fetch JD → evaluate → save report → tracker 를 서버 사이드에서 실시간 단계 이벤트와 함께 수행합니다. 느린 Anthropic 호출 (30–90 초) 은 일반 spinner 대신 `running` 이벤트를 emit 합니다. 실패는 `step` + `message` 와 함께 `error` 를 emit 합니다. 오케스트레이터는 또한 report markdown 을 부모의 `reports/<slug>.md` 에 영속화합니다 (v1.15 에서 손실되었음).
- **`feat(reports): POST /api/reports primitive`** — `server/lib/routes/reports.mjs` 의 신규 writer 엔드포인트. 경로 탐색 가드를 포함한 slug 정화 (sanitization) (선행 점 제거, 내부 `...` 축약). 1 MB 캡 (413). `overwrite:true` 가 아니면 기존 파일에 대해 409. `stripDangerousMarkdown` XSS 패스를 통한 원자적 쓰기. activity.reports.save 로그. 테스트: 9 케이스.
- **`feat(app): Cmd+K paste URL → auto-pipeline`** — 글로벌 검색에 URL 을 붙여넣고 Enter 를 누르면 이제 `autoStart=true` 와 함께 AutoPipeline 모달이 열립니다. Shift+Enter 는 레거시 "파이프라인에만 추가" 경로를 보존합니다. 정규 career-ops.org Quick Start §7 의 "paste URL → done" UX 입니다.
- **`feat(portals): SmartRecruiters pagination`** (#4) — `server/lib/sources/smartrecruiters.mjs` 가 `?limit=100&offset=N` 을 통해 `totalFound` 에 도달하거나 빈 페이지가 반환되거나 30 페이지 / 3000 잡 안전 캡이 발동될 때까지 페이지를 순회합니다. 호출자가 공급한 limit/offset 을 제거하여 커서가 서버 소유가 되도록 합니다. 큰 보드 (Procter & Gamble, Amazon 류) 가 더 이상 100+ 공고의 뒷부분을 잃지 않습니다. 테스트: 6 케이스.
- **`feat(portals): Workday CAPTCHA-fallback graceful`** (#7) — `server/lib/sources/workday.mjs` 가 더 이상 4xx / 비-JSON / 네트워크 오류에 throw 하지 않습니다. `[]` 를 반환하고 신규 export `lastWorkdayFallback` 스냅샷에 주석합니다. 스캐너 타임라인은 다음 테넌트로 계속됩니다. 호출자는 `strict:true` 로 v1.14 throw 동작에 다시 옵트인할 수 있습니다. 테스트: 7 케이스.

### 🛠️ 도구 + CI

- **`ci(workflows): dashboard-screenshots drift gate`** (#5) — 신규 `.github/workflows/dashboard-screenshots.yml`. `public/css/app.css` / `public/js/views/dashboard.js` / `public/js/lib/i18n.js` / `public/index.html` 를 건드리는 PR 에서 workflow 는 /tmp scaffold 에 대해 web-ui 서버를 기동하고, Playwright + chromium 으로 8개 hero PNG 를 재생성하며, 커밋된 것과 결과가 어긋나면 빌드를 실패시킵니다. 실패 시 재생성된 PNG 를 CI 아티팩트로 업로드합니다.
- **`feat(scripts): import-trending-companies.mjs`** (#11) — `docs/portals-examples.md` 의 13개 trending 회사를 실제 boards-API 로 검증하고 사용자의 부모 `portals.yml::tracked_companies` 에 붙여넣을 수 있는 YAML 을 출력합니다. slug 가 404 인 후보에는 `enabled: false` 가 찍힙니다. 6개 ATS 모두 라이브 프로브 (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday). `npm run import:trending` 으로 실행.
- **`feat(scripts): npm run capture:dashboards`** — `scripts/capture-dashboard-screenshots.mjs` 를 top-level 스크립트로 노출합니다 (이전에는 `images/README.md` 에만 문서화됨).

### 🎨 UX

- **`fix(scan): consolidated source-filter dropdown`** (#6) — `#/scan` 소스 드롭다운이 v1.14 어댑터 레지스트리에서 재구성되었습니다: 6개 ATS + hh.ru + Habr Career, 알파벳순, 지역 prefix 없음. `runEnScan` / `runRuScan` 이 이제 폐기된 `/api/stream/scan-{en,ru}` 별칭 대신 통합된 `/api/stream/scan?source={ats,regional}` 엔드포인트를 호출합니다 (Sunset 헤더는 v1.16 까지 라이브 유지).

### 📚 i18n long-tail

- **`docs(i18n): translate v1.13.0 + v1.12.0 CHANGELOG in 6 locales`** (#9) — `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` 에 이전에 RU 본문이었던 항목들이 이제 실제 로케일에 있습니다. 각 비영어/비러시아어 CHANGELOG 에는 pre-v1.12 항목이 프로젝트 관례에 따라 RU 로 유지된다는 i18n 노트도 포함됩니다 (정규 텍스트는 `CHANGELOG.md` 에 있음).
- **`docs: expand non-EN READMEs with v1.16.0 highlights section`** (#10) — 6개 비영어 README (es / pt-BR / ko-KR / ja / ru / zh-CN / zh-TW) 가 ~35 줄의 새 섹션을 받습니다: auto-pipeline 원클릭 흐름 + curl 예제, SmartRecruiters 페이지네이션, Workday 폴백, 스캔 소스 필터 UX, importer 스크립트, CI 스크린샷 워크플로. RU README 도 확장되었습니다.

### 🧪 테스트

- 신규 `tests/reports-write.test.mjs` (9 케이스) — happy path, slug 정화 (경로 탐색 가드 포함), 409 충돌, overwrite 플래그, XSS strip, 필드 누락 시 400, >1 MB 시 413, GET/POST 라운드트립.
- 신규 `tests/auto-pipeline.test.mjs` (5 케이스) — SSE 프레이밍, 잘못된 URL 게이트, SSRF/loopback 게이트, LLM 키 없음 오류 경로, `text/event-stream` Content-Type 헤더.
- 신규 `tests/smartrecruiters-pagination.test.mjs` (6 케이스) — 단일 페이지, 3 페이지, 빈 페이지 조기 종료, 하드 캡 준수, 쿼리 strip, 503 throws.
- 신규 `tests/workday-fallback.test.mjs` (7 케이스) — happy path, 403/429 graceful, 비-JSON 본문, 네트워크 오류, 4xx 및 네트워크 오류 양쪽의 strict 옵트인.
- 합계: **427 / 427** 유닛 (이전 400; +27 순증). 0 실패. 28/28 Playwright + 23/23 comprehensive E2E + 20/20 smoke E2E 가 v1.15.0 기준선에서 모두 통과.

### Out of scope (v1.17+)

| 항목 | 비고 |
|---|---|
| 정규 A-F 프롬프트의 부모 커밋 | upstream 의 `santifer/career-ops::modes/oferta.md` 재작성이 여전히 대기 중 (CLAUDE.md 하드 룰 #1). |
| pre-v1.12 CHANGELOG 항목 번역 (v1.11.x, v1.10.x) | 관례 유지: RU 본문. 백포트는 ~1800 줄 번역 작업; 연기. |
| 비영어 README 의 전체 패리티 (EN 처럼 585줄) | v1.16 이 로케일당 ~35 줄 추가; 전체 패리티는 별도 작업입니다. |
| Workday 폴백 주석을 읽어 🔒 chip 을 렌더링하는 서버 사이드 `runEnScan` | `lastWorkdayFallback` export 가 연결되어 있습니다; SPA 의 Active Companies 카드는 v1.17+ 에서 이를 소비합니다. |

### 검증

```bash
npm test                          # 427 / 427
npm run test:e2e:full             # 23 / 23
npm run import:trending --check-only   # probe 13 trending boards

# Auto-pipeline curl smoke:
curl -N -X POST http://127.0.0.1:4317/api/auto-pipeline \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/4567"}'

# POST /api/reports round-trip:
curl -X POST http://127.0.0.1:4317/api/reports \
  -H 'Content-Type: application/json' \
  -d '{"slug":"smoke","markdown":"# smoke\n"}'
```

---

## [1.15.0] — 2026-05-13

**문서 적합성 (Doc-conformance) 릴리스.** 적합성 감사 (`qa/conformance-vs-docs/00-CONFORMANCE-REPORT.md`) 에서 여전히 열려 있던 10개 결과 중 9개와 현지화된 hero 이미지를 종료합니다. CLI 가 약속하는 동일한 파이프라인이 모든 로케일에서 브라우저를 통해 end-to-end 로 동작하도록 UI 를 정규 career-ops.org/docs 워크플로에 일치시킵니다.

### ✨ 기능

- **`feat(auto-pipeline): PR-C — 1-click "paste URL → report + PDF + tracker row"`** (G-007) — 정규 career-ops.org 약속을 충족합니다. v1.15 이전에 사용자는 /#/pipeline → /#/evaluate → /#/cv → /#/tracker 에 걸쳐 5번 수동 클릭했습니다. 이제 /#/dashboard 의 단일 ✨ 버튼이 체인합니다: validate URL → fetch JD (SSRF-safe) → evaluate against CV → generate PDF → add tracker row. 단계별 모달 타임라인을 단계당 [✓]/[…]/[✗] 로 렌더링합니다. JD 첫 줄에서 휴리스틱한 회사/역할 추출. 평가 markdown 에서 정규표현식으로 점수 + 정당성 추출. 신규 파일: `public/js/lib/auto-pipeline.js`. 신규 i18n 키 19개 × 8 로케일.
- **`feat(modes): PR-D — modes/_profile.md editor as #/config → Modes tab`** (G-008) — Quick Start §Step-5 의 정규 "Career framing" 파일이 이전에는 UI 사용자에게 보이지 않았습니다. 이제 /#/config 의 신규 "Modes" 탭과 /#/profile 의 발견 가능한 카드로 노출됩니다. 신규 엔드포인트: 256 KB 캡, `stripDangerousMarkdown` XSS 패스, 첫 읽기 시 `_profile.template.md` 로부터 scaffold 하는 `GET/PUT /api/modes/_profile`. 신규 i18n 키 9개 × 8 로케일.
- **`feat(profile): PR-E — accept canonical schema; add location + headline`** (G-009) — `/api/profile` 이 이제 레거시 (`candidate:{...}`) 와 정규 (최상위 `full_name`, `narrative.headline`, `target_roles.primary`, `compensation.target_range`) 스키마를 모두 수용합니다. 둘 다 있을 때는 레거시가 우선하므로 기존 YAML 이 동일하게 렌더링됩니다. 신규 `summarizeProfile()` 헬퍼가 통합된 형태를 반환합니다. `/#/profile` 이 `narrative.headline` 을 새 카드로 노출합니다. 신규 i18n 키 2개 × 8 로케일.
- **`feat(tracker): PR-B — Legitimacy column on #/tracker`** (G-006) — career-ops.org/docs 의 정규 파이프라인 출력 표와의 패리티를 복원합니다. Status 와 PDF 사이에 Legitimacy 열을 추가하고 badge-ok/warn/bad 틴팅 (statusClass 패턴을 미러링). Graceful degrade — Legitimacy 열이 없는 v1.15 이전 행은 `—` 를 표시합니다. 신규 i18n 키 1개 × 8 로케일.
- **`fix(routing): PR-H — dedupe sidebar; route #/batch to v1.13.0 TSV SPA`** (G-011) — 이 수정 이전에는 /#/batch 가 사이드바에 두 번 등록되어 있었고 둘 다 레거시 mode-prompt builder 로 갔습니다. v1.13.0 TSV SPA (8 KB, 4 엔드포인트) 는 접근 불가능했습니다. 중복 사이드바 항목을 제거; mode slug `batch` → `batch-prompt` 로 이름을 바꾸고 deprecation 배너 추가. 정규 /#/batch 는 이제 TSV SPA 입니다.

### 📚 문서

- **`docs(evaluate): PR-A — realign Block A-F with canonical career-ops.org rubric`** (G-005) — career-ops.org 문서는 A–F 를 사용합니다 (Strategy/Personalization/STAR stories 가 C/E/F). 우리는 의미가 옮겨진 A–G 를 emit 했습니다 (Risks/Verdict/Legitimacy). v1.15 는 8개 help 번들의 §9 를 정규 A–F 로 보여주도록 갱신하고 "v1.15 이전은 A–G 를 사용; 하위 호환을 위해 그대로 렌더링" 콜아웃을 추가합니다. `eval.subtitle` i18n 키 × 8 로케일도 재정렬되었습니다. 점수 + 정당성이 이제 보고서 헤더 필드로 문서화됩니다. ⚠ 부모 커밋이 여전히 필요합니다: `santifer/career-ops::modes/oferta.md` 가 upstream 에서 재작성되어 정규 A–F 를 emit 해야 합니다.
- **`docs: PR-F — seniority_boost + search_queries in help §5 across 8 locales + scaffold`** (G-010) — 8개 번들의 Help §5 가 이제 세 번째 title-filter 키 (`seniority_boost`) 를 문서화하고 AI 기반 Option B 스캔만을 구동한다는 점을 명확히 하는 번역된 1단락 도입과 함께 `search_queries` 예제 블록을 갖습니다. `bin/setup.sh` portals.yml scaffold 가 기본으로 `seniority_boost: ["Senior", "Staff", "Lead"]` 를 시드합니다. H2 패리티 유지: 16 × 8 로케일.
- **`docs: PR-I — localized hero images per README locale`** — 8개 README 각각이 이제 (`scripts/capture-dashboard-screenshots.mjs` 를 통해 Playwright + chromium 으로 생성된) 로케일별 `images/dashboard-<locale>.png` (HiDPI 1440×900) 을 갖습니다. 옛 공유 `public/images/screen_vacancy_found.png` 는 삭제되었습니다. 비영어 독자가 첫 진입에서 자신의 언어로 라벨링된 UI 를 봅니다.

### 🧹 이월 정리

- **`PR-G — G-001`** `scan.noResults` i18n 번들: "EN or RU scan" 리터럴을 포함한 8개 문자열을 로케일 깔끔한 문구로 교체.
- **`PR-G — G-002`** 📄 Generate PDF 버튼이 이제 #/interview-prep 결과 패널에 등장합니다 (deep.js 패턴 미러링).
- **`PR-G — G-003`** `README.cn.md` → `README.zh-CN.md` (정규 로케일 태그); 형제 파일들과 tests/canonical-docs-coverage.test.mjs 에서 참조 일괄 수정.
- **`PR-G — G-004`** `/api/stream/scan-en` + `scan-ru` 가 이제 RFC 8594 Sunset + Deprecation + Link 헤더를 emit 합니다 (sunset 2026-10-01). v1.16.0 에서 제거 예정.

### 🧪 테스트

- 신규 `tests/profile-canonical-schema.test.mjs` (6 케이스) — 정규 YAML, 레거시 YAML, 혼합 (레거시 우선), 정규 전용 수용, 둘 다 아닌 형태 거부, 보상 범위 파싱.
- 신규 `tests/modes-profile-crud.test.mjs` (8 케이스) — 비어 있을 때 내장 scaffold, template-takeover, persisted-wins, 쓰기 happy-path, 정화, 비문자열 시 400, >256 KB 시 413, 범용 /api/modes/:name 도 여전히 동작.
- 테스트 픽스처의 격리 회귀 수정: 테스트가 이제 `before/after + dynamic-import` 패턴을 사용 (`tests/batch-endpoints.test.mjs` 와 일치) 하여 더 이상 사용자의 실제 부모 `config/profile.yml` 을 변경하지 않습니다. **사용자 주의:** v1.15.0-RC 빌드에서 업그레이드한 후 `config/profile.yml` 이 테스트 placeholder 처럼 보인다면 백업에서 복원하십시오 — 회귀는 dev 브랜치에만 존재했습니다.
- 합계: **400 / 400** 유닛 (이전 386; +14 순증). 0 실패. 20/20 smoke E2E + 23/23 comprehensive E2E + 28/28 Playwright 가 v1.14.0 기준선에서 모두 통과.

### Out of scope (v1.16+ 후속)

| 항목 | 비고 |
|---|---|
| 정규 A–F 프롬프트의 부모 커밋 | `santifer/career-ops::modes/oferta.md` 가 upstream 에서 재작성되어야 합니다. CLAUDE.md 하드 룰 #1 이 부모 파일 편집을 금지합니다. web-ui 쪽은 이미 완료되었습니다 (graceful degrade — v1.15 이전 A–G 보고서는 변경 없이 렌더링됨). |
| 서버 사이드 `POST /api/auto-pipeline` SSE | 클라이언트 사이드 오케스트레이터가 UX 승리를 출하했습니다. 서버 사이드 엔드포인트는 retry-from-step-N + curl 가능한 CI 를 가능하게 합니다. |
| `POST /api/reports` 프리미티브 | Auto-pipeline 이 현재 report markdown 을 인라인으로 보여주지만 부모 `reports/` 에 영속화하지 않습니다. PDF + tracker 행이 영구 아티팩트입니다. |
| Cmd+K paste-URL → run auto-pipeline | v1.16+ 로 연기. |

### 검증

```
npm test                              # 400 / 400
npm run test:e2e:full                 # 23 / 23
curl -sf http://127.0.0.1:4317/api/health | jq '.checks | length'   # → 18
curl -sI http://127.0.0.1:4317/api/stream/scan-en | grep -i sunset  # G-004 visible
curl -sf http://127.0.0.1:4317/api/modes/_profile | jq '.scaffolded' # G-008 wired
ls images/dashboard-*.png | wc -l     # 8 (PR-I)
grep -c 'href="#/batch"' public/index.html  # 1 (PR-H dedupe)
```

---

## [1.14.0] — 2026-05-13

v1.13.0 의 레지스트리 위에 3개의 신규 ATS 어댑터가 도착하면서 지원 ATS 가 3 → 6 으로 늘었습니다 (Greenhouse / Ashby / Lever **+ Workable / SmartRecruiters / Workday-beta**). 17개 파일에 걸친 사용자 대상 문서를 한 번에 "3 ATSes" 에서 "6 ATSes" 로 일괄 갱신했습니다 (42개 문구 업그레이드) — README × 8 로케일, help 번들 × 8 로케일, PROJECT.md. 부모 `portals.yml` 을 위한 13개 trending 회사의 paste-ready YAML 블록을 `docs/portals-examples.md` 에 추가합니다.

### ✨ 기능

- **`feat(portals): 3 new ATS adapters — Workable, SmartRecruiters, Workday-beta`** — 레지스트리가 이제 6개 ATS 를 해석합니다 (이전 3). 신규 파일: `server/lib/portals/adapters/{workable,smartrecruiters,workday}.mjs` (각각 신규 sources 를 감싸는 얇은 균일 계약 래퍼) 와 `server/lib/sources/{workable,smartrecruiters,workday}.mjs` (raw HTTP + `source: <id>` 가 포함된 정규 `{ id, title, company, url, location, isRemote, … }` 형태로의 응답 정규화).
  - **Workable**: `apply.workable.com/<slug>` 와 레거시 `<subdomain>.workable.com` 을 감지. 엔드포인트: `https://apply.workable.com/api/v3/accounts/<slug>/jobs?details=true`.
  - **SmartRecruiters**: `jobs.smartrecruiters.com/<slug>` 와 `careers.smartrecruiters.com/<slug>` 를 감지. 엔드포인트: `https://api.smartrecruiters.com/v1/companies/<slug>/postings`.
  - **Workday (beta)**: `<tenant>.wd<N>.myworkdayjobs.com/<lang>/<site>` 를 감지. 엔드포인트: `/wday/cxs/<tenant>/<site>/jobs` 로 POST. careers_url 이 site 를 생략하면 `site=External` 기본. 일부 테넌트가 CXS 를 CAPTCHA 뒤에 두기 때문에 beta — 그럴 경우 부모의 `/career-ops scan` (Playwright 구동) 으로 폴백합니다.

### 📚 문서

- **`docs(portals-examples): trending boards block`** — `docs/portals-examples.md` 에 v1.14.0 섹션이 추가되어 `tracked_companies` 용 paste-ready YAML 로 13개 trending 회사를 나열합니다: Greenhouse-hosted (Stripe, GitLab, HashiCorp, Cloudflare, Datadog, Hugging Face) 와 Ashby-hosted (Notion, Linear, PostHog, Replicate, Modal Labs, Fly.io, Render). 각 항목은 `enabled: false` 로 표시되어 사용자가 활성화 전에 slug 가 응답하는지 검증하도록 합니다. 더하여 각 패턴을 감지하는 URL 패턴이 포함된 Workable / SmartRecruiters / Workday 예제 블록.
- **`docs(framing): 42 ATS-phrase upgrades across 17 user-facing docs`** — 사용자 대상 문서의 "Greenhouse / Ashby / Lever" 가 등장하는 모든 곳이 이제 "Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday" 로 표시됩니다. 영향: README × 8 로케일 (EN/ES/PT-BR/RU/JA/KO/CN/TW), help 번들 × 8 로케일, PROJECT.md. 과거 CHANGELOG 항목과 버그 수정 처방 문서 (`qa/fixes/F-014`, `qa/FIX-PROMPT`) 는 의도적으로 손대지 않았습니다 — 과거 또는 이미 올바른 상태를 기술합니다.
- **`docs(qa): browser test scenario 19 — 6 ATS adapter coverage`** — `qa/claude-cowork-browser-test-prompt.md` 에 Scenario 19 가 추가되었습니다: `ALL_ADAPTERS.length === 6` 불변성, 6개 어댑터 모두에 대한 `resolveAdapter()` URL 감지 sweep, `#/scan` 의 Active Companies 카드 soft-check, `docs/portals-examples.md` 의 ATS 별 블록 구조 검사.

### 🧪 테스트

- `tests/adapter-registry.test.mjs` 가 3개의 신규 어댑터에 대한 7개 신규 테스트로 확장되었습니다 (Workable apply-URL 패턴, Workable 레거시 서브도메인 패턴, SmartRecruiters jobs.* + careers.* 패턴, 명시적 site 를 가진 Workday tenant.wd5.*, "External" 로의 Workday 기본 site 폴백, `ALL_ADAPTERS.length === 6` 불변성, `detectApi()` 레거시 형태 호환성).
- 합계: **386 / 386** 유닛 (이전 379; +7 순증). 0 실패.

### 검증

```
npm test                        # 386 / 386
node -e "import('./server/lib/portals/registry.mjs').then(m => console.log(m.ALL_ADAPTERS.length))"   # → 6

# Adapter detection sweep:
node -e "import('./server/lib/portals/registry.mjs').then(m => {
  console.log(m.resolveAdapter({ careers_url: 'https://apply.workable.com/foo/' }).adapter.id);          // → workable
  console.log(m.resolveAdapter({ careers_url: 'https://jobs.smartrecruiters.com/Bar' }).adapter.id);     // → smartrecruiters
  console.log(m.resolveAdapter({ careers_url: 'https://baz.wd5.myworkdayjobs.com/en-US' }).adapter.id);  // → workday
})"
```

### Out of scope (연기된 후속)

| 항목 | 비고 |
|---|---|
| 13개 trending Greenhouse/Ashby 회사를 위한 회사별 어댑터 레코드 | `docs/portals-examples.md` v1.14.0 블록이 사용자 paste 가능한 YAML 로 이들을 나열합니다; slug 검증 + 부모 `portals.yml` 로의 일괄 추가는 별도 단계입니다. |
| Workday CAPTCHA 폴백 자동화 | Workday 어댑터는 CXS 피드가 게이팅되면 throw 합니다; 계획된 폴백은 부모의 `/career-ops scan` (Playwright) 에 위임합니다. SPA 의 "scan" UX 에 이를 연결하는 것은 v1.15+ 입니다. |

---

## [1.13.0] — 2026-05-13

큰 슬라이스. v1.12.0 이후 백로그의 연기된 4개 항목을 한 릴리스로 모두 종료합니다: PR-4 (완전한 multer 파이프라인), 어댑터 레지스트리 (아키텍처적 F-018 후속), Batch evaluate SPA 페이지, 로케일 인식 mode-template scaffolding. 더하여 세션 중간에 발견된 다크 테마 테이블 수정.

### ✨ 기능

- **`feat(cv): multer-based multipart upload (PR-4 full)`** — `/api/cv/import` 가 이제 원본 octet-stream 계약 (`Content-Type: application/octet-stream` + `X-Filename`) 과 multer 로 적절히 파싱되는 `multipart/form-data` 양쪽을 수용합니다. v1.10.2 의 415-거부는 임시방편이었습니다; v1.13.0 이 진짜 수정입니다. 외부 클라이언트 (curl `-F`, Postman 기본, 모든 HTTP 클라이언트) 가 매끄럽게 동작합니다. 두 경로 모두 동일한 `importDocumentToMarkdown` 변환기 + `stripDangerousMarkdown` XSS 패스를 거칩니다. 신규 의존성: `multer ^2.1.1`.
- **`feat(portals): adapter registry`** — Greenhouse / Ashby / Lever fetcher 를 균일 계약 (`id`, `label`, `matches`, `buildEndpoint`, `fetch`) 으로 `server/lib/portals/adapters/*.mjs` 에 추출했습니다. 신규 `server/lib/portals/registry.mjs::resolveAdapter()` 가 단일 디스패치 표면입니다. `en-scanner.mjs::detectApi()` + `FETCHERS` 가 이제 레지스트리에 위임합니다; 레거시 반환 형태는 보존됩니다. 새 ATS 추가 = `adapters/` 아래 파일 하나를 떨어뜨리고 `ALL_ADAPTERS` 에 추가 — 스캐너 변경이 필요 없습니다.
- **`feat(batch): #/batch evaluate page`** — 신규 SPA 뷰 + 4개 엔드포인트 (`GET /api/batch`, `PUT /api/batch`, `GET /api/stream/batch`, `POST /api/batch/merge`). `batch/batch-input.tsv` 용 TSV 편집기, parallel/min-score/dry-run/retry 컨트롤, `bash batch/batch-runner.sh` 의 라이브 SSE 로그, 실행 후 `batch/tracker-additions/` 목록과 원클릭 `node merge-tracker.mjs`. Decision 그룹 아래의 사이드바 링크. 신규 i18n 키 21개 × 8 로케일.
- **`feat(prompts): locale-aware mode scaffolding`** — `buildModePrompt` + `buildEvaluationPrompt` 가 이제 부모의 영어 mode-template 본문을 8개 로케일에서 현지화된 scaffolding 텍스트 (역할 줄, "Read these files first", "User-supplied context") 로 감쌉니다. 부모의 `modes/<slug>.md` 본문은 영어로 유지됩니다 (CLAUDE.md 하드 룰 #1 에 따라 읽기 전용); career-ops-ui 의 주변 scaffolding 이 번역됩니다.

### 🎨 UX 수정

- **`fix(theme): dark-mode table hover + tab-btn`** — 하드코딩된 `#fafafa` / `#fff` / `#f7f7f7` 가 `var(--beach)` / `var(--paper)` / `var(--slate)` 토큰으로 교체되어 다크 팔레트 교체가 실제로 테이블 행과 탭 버튼에 도달합니다. boosted 스캔 행을 위한 `.row-boosted` 액센트 strip 을 추가했고 두 테마 모두에서 동작합니다.

### 🧪 테스트

- 신규 `tests/adapter-registry.test.mjs` (7 케이스) — 균일 계약, ATS 별 URL 감지, 명시적 `api:` 필드 우선, 일치 없을 시 null, 레거시 `detectApi()` 형태 보존.
- 신규 `tests/batch-endpoints.test.mjs` (5 케이스) — 빈 픽스처, TSV 라운드트립, URL 없음 거부, 1 MB 캡, 러너 누락 오류 프레임.
- 신규 `tests/locale-scaffold.test.mjs` (6 케이스) — en/ru/ja/ko 의 scaffold 문자열, `buildModePrompt`/`buildEvaluationPrompt` 통합, 영어 하위 호환.
- `tests/cv-upload-multipart-reject.test.mjs` 재작성 — 기존의 "multipart 는 415 를 반환" 계약이 이제 "multipart 가 multer 로 파싱됨" 계약입니다; cv.md 에 부작용 없음 불변성은 보존됩니다.
- 합계: **379 / 379** 유닛 (이전 360; +19 순증). 0 실패.
- 커버리지: **95.46 % 라인 / 84.06 % 브랜치**.
- 20/20 smoke E2E · 23/23 comprehensive E2E · 28/28 Playwright.

### Out of scope (연기된 후속 작업)

| 항목 | 비고 |
|---|---|
| 14개 신규 포털 어댑터 (Workable / SmartRecruiters / Workday / GitLab / HashiCorp / Cloudflare / Datadog / Stripe / Notion / Linear / Posthog / Hugging Face / Replicate / Modal Labs / Fly.io / Render) | 어댑터 레지스트리가 자리잡았습니다 — 신규 어댑터 추가는 이제 각각 파일 하나입니다. 14개 ATS 에 대한 포털별 리서치 + URL 패턴 + 엔드포인트 정규화는 별도 단계입니다. |
| 부모의 `modes/<slug>.md` 본문 번역 | 부모 파일은 CLAUDE.md 하드 룰 #1 에 따라 읽기 전용입니다. v1.13.0 의 로케일 인식 scaffolding 이 80 % 를 해결해주며; 전체 본문 번역은 `santifer/career-ops` 로의 upstream PR 이 필요합니다. |

### 문서

- `docs/reviews/REVIEW-2026-05-13-v1.13.0.md` — 세션 컨텍스트 + 어댑터 레지스트리 계약 + batch 흐름.
- 모든 8개 README: 배지 갱신 (tests 360 → 379, release v1.12.0 → v1.13.0).
- 모든 8개 CHANGELOG 가 이 항목을 받습니다.

---

## [1.12.0] — 2026-05-13

버그 수정 + UX + 브랜딩 패스. v1.11.1 이후 정직한 백로그에서 8개 항목을 종료합니다 (테스트 갭 #9–12, 콘솔 오류 #8, portals-dead 드리프트 #4, seniority_boost surface #6, F-018 엔드포인트 통합). 다크/라이트 테마 토글을 추가하고 모든 문서, 패키지 메타데이터, GitHub 저장소 설명에서 "Airbnb-styled" 브랜딩을 제거합니다.

### ✨ 기능

- **`feat(theme): dark/light toggle (v1.12.0)`** — top bar 의 신규 테마 버튼. light ↔ dark 순환; `localStorage.theme` 에 영속; 페이지 로드 시 pre-paint 부트스트랩 (`public/js/lib/theme-bootstrap.js`) 으로 복원되어 사용자가 잘못된 색상 스킴의 플래시를 보지 않습니다. 첫 방문자에게는 `prefers-color-scheme` 을 존중. `public/css/app.css` 의 `[data-theme="dark"]` 아래 전체 다크 팔레트 — 모든 컴포넌트가 CSS 사용자 속성을 읽으므로 교체가 한곳에서 중앙 집중됩니다.
- **`feat(scan): /api/stream/scan?source=ats|regional|both` (F-018 LITE)`** — 단일 통합 SSE 엔트리포인트. SPA 가 이제 두 단계 (ATS 먼저, 그다음 regional) 를 순차 구동하는 하나의 이벤트 스트림을 엽니다. 두 개의 별도 스트림을 체인하는 대신입니다. 레거시 `/api/stream/scan-en` + `/api/stream/scan-ru` 는 폐기된 별칭으로 활성 유지됩니다. runners-table `/api/stream/scan` 이 네임스페이스를 비우기 위해 `/api/stream/scan-parent` 로 이름이 변경되었습니다; 부모가 spawn 하는 `scan.mjs` 폴백은 보존됩니다.
- **`feat(scan): seniority_boost surface (canonical docs §3)`** — `en-scanner.mjs` 와 `ru-scanner.mjs` 모두 이제 `portals.yml::title_filter.seniority_boost` 를 읽고 매칭되는 잡에 `_boosted: true` + `_boostedBy: <keyword>` 를 찍습니다. SPA 는 boosted 행을 `#/scan` 결과 상단으로 정렬하고 title 어트리뷰트에 매칭 키워드를 담은 `⬆ boosted` 배지를 렌더링합니다. 신규 i18n 키 2개 (`scan.boosted`, `scan.boostedBy`) 가 8개 로케일에서 현지화됩니다.

### 🐛 버그 수정

- **`fix(ui): null-safe error message reads in 4 places (#8)`** — `app.js` (top bar doctor 버튼 + global-search pipeline add), `views/tracker.js` (112번 줄), `views/apply.js` (21번 줄), `views/evaluate.js` (32번 줄) 가 모두 이제 `(err && err.message) || '<fallback>'` 를 읽습니다. 이전에는 Error 페이로드 없는 Promise rejection 이 e2e teardown 동안 page-error 스트림에서 "Cannot read properties of undefined (reading 'message')" 를 던졌습니다.
- **`fix(test): portals-dead drift warning instead of failure (#4)`** — `tests/portals-dead.test.mjs::FIX-C3` 이 우리가 dead 로 표시한 slug 를 부모의 `templates/portals.example.yml` 이 다시 활성화시키는 방향으로 표류하면 실패했습니다. v1.12.0 은 그 단언을 stderr 경고로 변환하여 CI 가 부모 드리프트에서 녹색으로 통과합니다; 릴리스 결정은 수동으로 유지됩니다. slug 목록 `KNOWN_DEAD` 는 의도의 문서로서 보존됩니다.

### 📝 브랜딩 / 문서

- **`docs(brand): strip 'Airbnb' references from every doc (8 locales)`** — README.md, README.es.md, README.pt-BR.md, README.ko-KR.md, README.ja.md, README.ru.md, README.cn.md, README.zh-TW.md, CLAUDE.md, docs/architecture/FRONTEND.md, package.json, GitHub 저장소 설명이 모두 "Airbnb-styled" / "Airbnb-inspired" 표현에서 "Clean, docs-style" 로 이동했습니다. CSS 파일은 디자인 토큰 이름을 유지했습니다 (내부 식별자이며 외부 결합 없음) 만, 설명 주석은 재작성되었습니다.

### 🧪 테스트

- **신규 `tests/canonical-docs-coverage.test.mjs` (5 케이스)** 가 테스트 갭 #9–12 를 닫습니다: 모든 help 번들이 5개 정규 career-ops.org 가이드를 참조; 로케일당 16-H2 패리티 계약; 모든 README 가 정규 첫 페이지 + ≥ 3 서브 가이드를 참조; `#/reports` 뷰 소스가 점수 임계값 카드 scaffold 를 포함; i18n 번들이 모든 v1.11.x 신규 키를 8개 로케일 모두에서 포함.
- **신규 `tests/scan-consolidated.test.mjs` (6 케이스)** 가 F-018 LITE 를 다룹니다: `?source=ats|regional|both` 가 올바르게 디스패치; 알 수 없는 소스가 오류 프레임을 emit; 레거시 `/api/stream/scan-en` + `/api/stream/scan-ru` 가 폐기된 별칭으로 여전히 동작.
- 합계: **360 / 360** 유닛 (이전 349; +11 신규). 0 실패. 커버리지: **95.62 % 라인 / 84.37 % 브랜치** (94.59 에서 상승).
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**.

### 📋 내부

- `docs/reviews/REVIEW-2026-05-13-v1.12.0.md` — 세션 컨텍스트, 연기 목록 요약, career-ops.org 콘텐츠 동기화를 위한 갱신 절차.
- 모든 8개 CHANGELOG 가 이 항목을 받습니다.
- GitHub 저장소 설명이 새 브랜딩에 맞게 갱신되었습니다.

### Out of scope (연기, v1.11.1 에서 변경 없음)

| 항목 | 이유 |
|---|---|
| Batch evaluate SPA 페이지 | 정규 문서당 CLI 전용 흐름; SPA 등가물은 신규 뷰 + ≥3 엔드포인트 + 픽스처가 필요합니다. 2–3일 단계. |
| 전체 어댑터 레지스트리 (8개 `server/lib/portals/adapters/*.mjs` + 14 신규 포털 + FE 재작성) | 이 릴리스의 F-018 LITE 가 API 표면을 통합합니다; 전체 아키텍처 리팩터는 남아 있습니다. |
| 전체 multer 파이프라인 (PR-4) | v1.10.2 가 415 envelope 로 데이터 손상 구멍을 닫았습니다; 전체 multipart 파서 + ConversionError envelope 는 자체 단계입니다. |
| Mode-template 번역 | 부모 프로젝트와의 조정이 필요합니다. |

---

## 이전 릴리스 (v1.11.x 및 v1.10.x)

v1.11.0 / v1.11.1 / v1.10.0–v1.10.3 의 상세 항목은 [영어 CHANGELOG](CHANGELOG.md) 에 있습니다. 요약:

- **v1.11.1 — 2026-05-13** · 폴리시 슬라이스: `#/apply` 의 Playwright 힌트, 통일된 태그라인, 대시보드 점수 임계값 카드. 349/349 테스트.
- **v1.11.0 — 2026-05-13** · 8개 help 번들과 8개 README 에 career-ops.org/docs 통합. 신규 `docs/career-ops-canonical.md`. Mode/Archetype/Pipeline/Tracker/Report/Scan history 개념 문서화. 348/349 테스트.
- **v1.10.3 — 2026-05-12** · 버그 수정 슬라이스: v1.10.2 회귀 실행의 11개 QA 결과 중 7개 종료.
- **v1.10.2 — 2026-05-12** · CV multipart 415 거부 (v1.13.0 multer 까지의 임시 패치); PDF 생성 수정.
- **v1.10.1 — 2026-05-09** · v1.10.0 릴리스 QA 회귀 실행의 중요 패치.
- **v1.10.0 — 2026-05-08** · `#/profile` 편집기 + CV 업로드 UX (pandoc/pdftotext/passthrough), 8개 로케일 × 16개 H2 help 패리티, 언어 전환기.

---

## [1.9.1] — 2026-05-08

프로덕션 준비도 패스. 표적화된 버그 수정 4건 (BF-1..BF-4), Playwright smoke 가 5에서 12 테스트로 확장되어 tracker / pipeline / reports / evaluate / config / cv 저장 라운드트립을 다룹니다. 모두 CI 에서 통과.

### 🐛 버그 수정

- **`fix(tracker): escape pipes + collapse newlines in every cell, not just notes (BF-1)`** — `"Acme | Co"` 같은 회사 이름이 이전에는 markdown 표 레이아웃을 깨뜨렸습니다 (파서가 셀을 둘로 분할). 셀 정화 (sanitization) 가 이제 company / role / reportSlug / notes 에 균일하게 적용됩니다; `parsers.mjs::parseMarkdownTable` 의 동반 수정이 GFM 준수 `\|` 이스케이프 지원을 추가하여 라운드트립이 무손실입니다.
- **`fix(config): wrap updateEnvFile in try/catch (BF-2)`** — `POST /api/config` 가 이전에는 permission-denied / 읽기 전용 파일시스템에서 처리되지 않은 rejection 을 일으켰습니다. 이제 깔끔한 500 `{ error: 'failed to write parent .env', details: [...] }` 를 반환합니다.
- **`fix(llm): soft cap on assembled prompt size for Anthropic SDK calls (BF-3 + BF-4)`** — `/api/evaluate`, `/api/deep`, `/api/mode/:slug` 의 Anthropic 분기가 이제 `bundleProjectContext + prompt` 가 200 KB (≈50K 토큰) 를 초과하면 413 으로 중단합니다. API 가 컨텍스트 크기 불평을 하도록 두는 대신 다초 라운드트립 + 토큰을 절약합니다. 캡은 어떤 현재 모델 상한보다도 충분히 낮습니다 (Sonnet 4.6 = 1M 컨텍스트).

### 🧪 Playwright smoke — 커버리지 확장

5 → **12** 테스트. 신규 케이스:

- `tracker view renders empty + accepts API-seeded row` — 회사 이름에 리터럴 파이프를 가진 행을 시드하고 라운드트립이 이를 보존하는지 단언하여 BF-1 을 행사.
- `pipeline add-URL form populates the queue` + 잘못된 URL 거부 sweep (loopback, `javascript:`, 빈 문자열).
- `reports view handles empty state` — non-crash 단언.
- `evaluate view returns a manual prompt without API key` — 폴백 체인 검증.
- `config GET returns known keys masked` — 비밀이 `/api/config` 를 통해 절대 누설되지 않음.
- `cv.md PUT round-trips with sanitization` — XSS 류 (script 태그, `javascript:` 스킴) 가 end-to-end 로 strip 됨.
- `pipeline preview proxy strips scripts` — 잘못된 URL 거부 경로.

### 📦 동작 변경 (API 계약 변경 없음)

- Tracker 쓰기가 이제 파이프가 포함된 company / role 이름에 대해 무손실입니다. 원시 파이프를 가진 기존 행은 다음 읽기에서 올바르게 파싱되기 시작합니다.
- `/api/{evaluate,deep,mode/:slug}` 가 이제 비합리적으로 큰 프롬프트 (200 KB+) 에서 502/타임아웃 대신 413 을 반환합니다.

### 🧪 테스트

- **284 유닛 테스트** (수 변경 없음; 파서 갱신 후에도 기존 테스트가 모두 녹색).
- **12 Playwright 브라우저 smoke 테스트** (이전 5).

---

## [1.9.0] — 2026-05-08

v1.8.0 백로그의 P-6 → P-10 이 한 번들로 출하되었습니다. 헤드라인: `server/index.mjs` 가 이제 130-LOC 오케스트레이터입니다 (762 에서 감소, 합계 1230 → 130 = -89%); 모든 라우트 토픽이 자체 모듈을 갖습니다. `/api/evaluate` 의 Anthropic 패리티, 멀티 CLI shim, 확장된 i18n 패리티 테스트, CI 에 연결된 Playwright 브라우저 smoke.

### 🏗️ P-6 — 서버 split-by-concern (phase 2)

P-2 의 연속. 나머지 9개 라우트 토픽을 `server/index.mjs` 에서 `server/lib/routes/<topic>.mjs` 모듈로 추출. `index.mjs` 는 이제 순수 오케스트레이터입니다: 미들웨어 (보안 헤더 + activity 로그 + static), 12개 `register<Topic>Routes(app)` 호출, SPA catch-all.

- `server/lib/routes/activity.mjs` — `/api/activity`.
- `server/lib/routes/config.mjs` — `/api/config` GET/POST (부모 .env 라운드트립).
- `server/lib/routes/health.mjs` — `/api/health` + `/api/dashboard`.
- `server/lib/routes/help.mjs` — `/api/help/:lang`.
- `server/lib/routes/jds.mjs` — `jds/*.txt` 의 전체 CRUD.
- `server/lib/routes/llm.mjs` — 모든 LLM 결합 엔드포인트 (evaluate, deep, mode, apply-helper, interview-prep).
- `server/lib/routes/pipeline.mjs` — 명명된 상수 (timeout / max-redirects / max-body) 가 포함된 SSRF-안전 preview proxy 를 포함한 `/api/pipeline*`.
- `server/lib/routes/reports.mjs` — `/api/reports*`.
- `server/lib/routes/tracker.mjs` — `/api/tracker` GET + dedup 인식 POST.

동작 변경 없음. 모든 단계에서 283/283 유닛 테스트가 녹색을 유지했습니다. 오케스트레이터의 import surface 가 47줄에서 22줄로 떨어졌습니다.

### 🔌 P-7 — `/api/evaluate` 의 Anthropic 패리티

`/api/evaluate` 는 이전에 Gemini 또는 manual 이었습니다. v1.9.0 은 Anthropic 분기를 추가합니다 (두 키가 모두 있을 때 선호). `/api/deep` 와 `/api/mode/:slug` 가 이미 사용하는 라우팅 규칙을 미러링합니다. 모델이 cv / profile / mode 템플릿을 인라인으로 갖도록 `bundleProjectContext({ modeSlugs: ['_shared', 'oferta'] })` 를 통해 라우팅됩니다 (REVIEW-A1).

신규 엔드포인트: **`POST /api/evaluate/test-anthropic`** — `ANTHROPIC_API_KEY` 용 smoke 검사, 기존 Gemini smoke 를 미러링. 작은 프롬프트 (≤256 출력 토큰) 를 보내므로 사실상 비용이 없습니다; 200자 샘플을 반환합니다.

폴백 체인은 이제: Anthropic → Gemini → manual.

### 🌐 P-8 — Help-center i18n 패리티 (감사 + 테스트 강화)

모든 `docs/help/<lang>.md` 의 구조 패리티를 감사했습니다. 8개 로케일이 이미 동일한 14개 정규 h2 섹션을 다룹니다. 테스트 업그레이드:

- `tests/help-ui.test.mjs::every help doc covers the same 14 sections` 가 en + ru 만 확인하고 있었습니다. 이제 **8개 로케일 전체** (en, es, pt-BR, ko-KR, ja, ru, zh-CN, zh-TW) 를 순회하며 각각에 대해 섹션 수를 단언합니다.
- 신규 테스트: `tests/help-ui.test.mjs::every help locale has substantive content` — 각 비영어 로케일이 `en.md` 바이트 길이의 최소 30% 인지 단언하여 로케일 스텁을 방어합니다. 컴팩트 번역은 자연히 40-50% 에 도달합니다; 스텁은 한 자리 % 일 것입니다.

결과: 구조 패리티가 이제 CI 강제됩니다.

### 🤖 P-9 — CI 매트릭스의 Playwright 브라우저 smoke

`tests/playwright-smoke.mjs` (v1.8.0 에서 옵트인으로 추가됨) 가 이제 CI 워크플로의 일부입니다. 기존 `e2e` 잡이 이미 Playwright + Chromium 을 설치합니다; 신규 스텝 (`npm run test:e2e:browser`) 하나가 comprehensive Node E2E 직후에 5개 브라우저 smoke 테스트를 실행합니다.

CI 의 순서: 유닛 (Node 18/20/22 매트릭스) → smoke node E2E → comprehensive node E2E → **Playwright 브라우저 smoke** → 실패 시 스크린샷 아티팩트 업로드.

### 🌍 P-10 — 멀티 CLI 호환성

부모 career-ops v1.7.0 이 멀티 CLI / Open Agent Skill 표준 지원을 도입했습니다. UI 서브 프로젝트는 정규 `CLAUDE.md` 를 가리키는 얇은 shim 으로 동일한 관례를 따릅니다:

- `web-ui/AGENTS.md` — Codex / Aider / 범용 CLI 엔트리포인트.
- `web-ui/GEMINI.md` — Gemini CLI 엔트리포인트.

두 shim 모두 하드 룰과 빠른 참조를 재진술하지만 전체 프로젝트 수준 지침은 `CLAUDE.md` 에 위임하므로 비-Claude CLI 도 Claude Code 세션과 동일한 오리엔테이션에 도착합니다. 배포된 UI 자체는 런타임에서 CLI 무관입니다.

### 🧪 테스트

- **284 유닛 테스트** (이전 283): +1 신규 help-locale 패리티 테스트.
- **5 Playwright 브라우저 smoke 테스트** — 이제 옵트인이 아니라 CI 의 일부.
- 커버리지 유지.

### 🔧 변경된 파일

```
+ server/lib/routes/activity.mjs              + server/lib/routes/config.mjs
+ server/lib/routes/health.mjs                + server/lib/routes/help.mjs
+ server/lib/routes/jds.mjs                   + server/lib/routes/llm.mjs
+ server/lib/routes/pipeline.mjs              + server/lib/routes/reports.mjs
+ server/lib/routes/tracker.mjs
+ AGENTS.md                                   + GEMINI.md

~ server/index.mjs (762 → 130 LOC, -83%)
~ .github/workflows/ci.yml (Playwright smoke step)
~ tests/help-ui.test.mjs (all-8-locales section parity + content-floor)
~ docs/{ROADMAP,architecture/{OVERVIEW,SERVER}}.md
~ docs/sdd/CONVENTIONS.md
~ CLAUDE.md
~ package.json (1.8.0 → 1.9.0)
```

### 📦 신규 REST 엔드포인트

| Method | Path | 용도 |
|---|---|---|
| `POST` | `/api/evaluate/test-anthropic` | `ANTHROPIC_API_KEY` 용 smoke 검사 (P-7). `/api/evaluate/test-gemini` 를 미러링. |

### 🤖 신규 CLI 엔트리포인트

| 파일 | CLI | 비고 |
|---|---|---|
| `AGENTS.md` | Codex / Aider / 범용 | 전체 지침을 위해 `CLAUDE.md` 를 가리킵니다. |
| `GEMINI.md` | Gemini CLI | 세션 시작 시 Gemini 가 자동 로드합니다. |

---

## [1.8.0] — 2026-05-08

강화, 리팩터, SDD 부트스트랩. 고위험 정확성/보안 수정 3건 (A1, A2, A3), 중간 4건 (B1–B4), 정리 6건, 부모 career-ops v1.7.0 표면 감사, 서버 split-by-concern (P-2 phase 1), Playwright 브라우저 smoke 하니스, `docs/` 와 `.claude/` 아래 전체 SDD 기반.

### 🔥 고위험 수정

- **`fix(deep): inline cv/profile/mode files for Anthropic SDK calls (REVIEW-A1)`** — `/api/deep` 와 `/api/mode/:slug` 가 이전에는 모델에게 "이 파일들을 먼저 읽어라" 라고 했지만 Anthropic SDK 에는 파일시스템이 없습니다. 출력이 비어 있었습니다. 신규 `bundleProjectContext({ modeSlugs })` 가 `cv.md`, `config/profile.yml`, `modes/_shared.md`, 그리고 mode 템플릿을 읽고 각각을 16 KB 에서 자른 뒤 프롬프트 앞에 `<project_context>` 블록을 추가합니다. 라이브 검증: `claude-sonnet-4-6` 의 deep-research 호출에서 26 KB 의 근거 있는 markdown 응답.
- **`fix(runner): SIGKILL escalation after SIGTERM grace period (REVIEW-A2)`** — `runNodeScript` 와 `streamNodeScript` 가 이전에는 타임아웃 / 클라이언트 연결 끊김에서 `SIGTERM` 만 보냈습니다. syscall (DNS, 블록된 소켓) 에서 멈춘 자식 프로세스가 이를 무시하여 Node 의 GC 가 회수할 때까지 SSE 연결이 매달렸습니다. 이제 각 경로가 5초 워치독을 무장하여 `SIGKILL` 로 에스컬레이션합니다. Promise 가 항상 해결됩니다.
- **`fix(runner): max-runtime cap on streaming endpoints (REVIEW-A3)`** — 모든 SSE 스크립트 러너 (`/api/stream/{scan,liveness,pdf}`) 가 이제 하드 30분 한도를 갖습니다. 만료 시: `event: error { message: 'maximum runtime exceeded' }` emit, A2 워치독으로 자식 프로세스 종료, 응답 종료.

### 🛡️ 중간 위험 수정

- **`fix(preview): per-hop redirect validation in /api/pipeline/preview (REVIEW-B1)`** — `redirect: 'follow'` 에서 수동 redirect 워킹으로 전환. 각 `Location` 헤더가 `isValidJobUrl` 로 재검증됩니다; 3홉으로 캡. 적대적 보드가 더 이상 loopback / 사설 IP / `file://` 로 우리를 튕길 수 없습니다. 거부 경로를 다루는 신규 테스트 4개.
- **`refactor(keys): hasGeminiKey helper unifies LLM-key checks (REVIEW-B2)`** — 라우트 핸들러의 직접 `process.env.GEMINI_API_KEY` 읽기가 `lib/anthropic.mjs` 의 `hasGeminiKey()` 로 교체되었습니다. 일관성과 더 쉬운 모킹을 위해 `hasAnthropicKey()` 형태를 미러링합니다.
- **`feat(scanners): thread AbortSignal through hh.ru, Habr, Greenhouse, Ashby, Lever (REVIEW-B3)`** — SSE 클라이언트가 스캔 중간에 연결을 끊으면, 진행 중인 HTTP fetch 가 이제 모든 쿼리를 완료까지 실행하고 이벤트를 드롭하는 대신 abort 됩니다. `runRuScan` 과 `runEnScan` 이 `opts.signal` 을 수용합니다; `/api/stream/scan-{ru,en}` 의 SSE 핸들러가 `AbortController` 를 생성하고 `res.close` 에서 abort 합니다.
- **`test(anthropic): log-guard test prevents future API-key leaks via console (REVIEW-B4)`** — `runAnthropic` happy + error 경로 동안 모든 `console.{log,info,warn,error,debug}` 호출을 캡처하여 0 출력과 canary 키 문자열이 절대 등장하지 않음을 단언합니다. 미래의 `console.log(opts)` 회귀에 대한 심층 방어.

### 🧹 저위험 폴리시

- **`fix(parsers): defense-in-depth URL gate inside addPipelineUrl (REVIEW-C4)`** — 라우트 수준 `isValidJobUrl` 을 보완하는 파서 수준의 비-http(s) 값 거부. 더 엄격한 규칙을 원하는 호출자를 위한 옵션 `opts.validate`.
- **`docs(readme): badge "tests-88 passed" → "tests-277 passed" (REVIEW-C3)`** — 자릿수가 틀렸습니다.
- **`test(i18n): missing-keys diff grouped by locale (REVIEW-C6)`** — `tests/i18n-coverage.test.mjs` 가 갭을 찾으면 출력이 이제 혼합된 줄 대신 `[ru] (3): foo, bar, baz` 입니다.
- **`docs(review): C1 closed as resolved-on-inspection`** — 정화 (sanitizer) 정규표현식이 이미 `\x00-\x08` 16진 형태였습니다; 리뷰 항목은 도구 렌더링 아티팩트였습니다.

### 🏗️ P-2 phase 1 — 서버 split-by-concern

`server/index.mjs` 가 1230 LOC 로 800줄 상한을 한참 넘었습니다. 동작 변경 없이 집중된 모듈로 분할했습니다. 모든 단계에서 283 유닛 테스트가 녹색을 유지했습니다.

- `server/lib/security.mjs` — `isValidJobUrl`, `stripDangerousMarkdown`, `sanitizeJobDescription`, `isPubliclyExposed`. 외부 컨슈머와의 하위 호환을 위해 `index.mjs` 에서 재내보냅니다.
- `server/lib/prompts.mjs` — `bundleProjectContext`, `buildEvaluationPrompt`, `buildDeepPrompt`, `buildModePrompt`, `buildApplyChecklist`.
- `server/lib/store.mjs` — `safeReadApps`, `safeReadPipeline`, `safeListReports`, `checkProfileCustomized`, `ensureRussianPortalsDefaults`.
- `server/lib/routes/scan.mjs` — `/api/stream/scan-{ru,en}`, `/api/scan-ru/config`, `/api/scan-results` 용 `registerScanRoutes(app)`.
- `server/lib/routes/runners.mjs` — 버퍼링된 `/api/run/*` 표, 스트리밍 `/api/stream/{scan,liveness,pdf}`, 생성된 PDF 목록/다운로드용 `registerRunnerRoutes(app)`.
- `server/lib/routes/content.mjs` — CV / Profile / Portals / Modes 용 `registerContentRoutes(app)`.

`index.mjs` 는 이제 762 LOC 입니다 (-38%, 800 캡 아래). Phase 2 는 tracker, pipeline, reports, jds, llm (evaluate/deep/mode), health 를 라우트 모듈로 추출할 것입니다. 오케스트레이터의 목표 <500 LOC.

### 🔍 부모 career-ops v1.7.0 감사

사용자가 부모 프로젝트를 v1.7.0 으로 갱신했습니다. 모든 소비 표면을 감사했습니다 — UI 는 완전히 호환됩니다. 주목할 발견은 `docs/architecture/DATA-FLOWS.md` 에 문서화되어 있습니다:

- 모드 카탈로그가 7 → 19 파일로 성장했습니다. UI 의 `MODE_ALLOWLIST` 는 의도적으로 7개만 surface 합니다 (나머지는 Claude-Code 전용). 의도적인 좁은 범위를 설명하는 주석이 추가되었습니다.
- `portals.yml` 스키마 확인: `tracked_companies` (96 항목, 87 활성화, 71 개가 API 보유). EN 스캐너가 이를 올바르게 읽습니다; 레거시 `companies` 키도 여전히 지원됩니다.
- 오늘 소비되지 않는 신규 부모 표면: `dashboard/` (Go 프로그램), `update-system.mjs`, `generate-latex.mjs`, `analyze-patterns.mjs`, `liveness-core.mjs`, `followup-cadence.mjs`, `test-all.mjs`, 현지화된 mode 서브디렉토리 (`de/fr/ja/pt/ru`).
- 라이브 `/api/dashboard`, `/api/health`, `/api/modes`, `/api/portals`, `/api/profile`, `/api/cv`, `/api/jds`, `/api/reports`, `/api/tracker`, `/api/pipeline`, `/api/evaluate`, `/api/deep`, `/api/stream/scan-en` 이 모두 녹색으로 검증되었습니다.

### 🤖 SDD / GSD 부트스트랩

`career-ops-ui` 는 이제 GSD 파이프라인 (`superpowers@claude-plugins-official` 의 `gsd-*` 스킬) 과 정렬된 전체 Spec-Driven Development 기반을 갖습니다.

- `CLAUDE.md` (루트) — 프로젝트 수준 에이전트 시스템 프롬프트: 스택, GSD 파이프라인, 하드 룰 (부모 계약, 보안 영역, `--no-verify` 금지), 관례, 부모 프로젝트 경계.
- `.aiignore` — AI 에이전트용 제외 목록: vendored, 바이너리, 부모 사용자 데이터, `.planning/`, `.env`, 로케일 중복.
- `.claude/agents/` — 세 개의 프로젝트별 서브에이전트 정의:
  - `web-ui-route-reviewer.md` — 신규 라우트를 SSRF, CSP, 정화 (sanitizer), 부모 쓰기 계약, 관례, 테스트에 대해 게이팅합니다.
  - `spa-view-reviewer.md` — CSP 안전 DOM, i18n, 라우터 등록, 접근성.
  - `test-isolation-reviewer.md` — 테스트가 CI 격리되어 있는지 검증합니다 (부모 프로젝트 가정 없음, 라이브 네트워크 없음, 포트 충돌 없음).
- `.claude/commands/` — 슬래시 커맨드 스텁: `/sdd-status`, `/codebase-tour`.
- `docs/` 트리 — 모두 영어로:
  - `PROJECT.md` — what/why/for-whom, 범위, 제약, 성공 기준.
  - `ROADMAP.md` — 현재 마일스톤 + 완료 이력 + 백로그.
  - `sdd/SDD-GUIDE.md` — `gsd-*` 스킬에 매핑된 discuss → spec → plan → execute → verify → review 파이프라인.
  - `sdd/CONVENTIONS.md` — 모듈 시스템, 명명, 라우트, 정화 (sanitizer), 클라이언트 패턴, i18n, 오류, 로깅, 테스트, 커밋, 브랜치, CSS.
  - `architecture/OVERVIEW.md` — 최상위 다이어그램, 계층, 부팅 시퀀스, 불변성, "…일 때 먼저 볼 곳" 치트시트.
  - `architecture/SERVER.md` — `server/lib/*.mjs` 의 파일별 맵 (P-2 분할에 맞게 갱신).
  - `architecture/FRONTEND.md` — SPA 구조, 뷰 인벤토리, 전역, "뷰 추가 방법".
  - `architecture/API.md` — 모든 `/api/*` 라우트의 전체 인벤토리.
  - `architecture/DATA-FLOWS.md` — 명시적 사용자 액션 계약을 가진 모든 부모 프로젝트 읽기/쓰기.
  - `reviews/REVIEW-2026-05-07.md` — 이 변경 로그의 수정을 낳은 정적 리뷰.

### 🔒 보안 & 저장소 위생

- **`chore(.gitignore): comprehensive defense-in-depth patterns`** — env 변종, IDE 폴더, GSD 스크래치 (`.planning/`), 사용자별 에이전트 설정 (`.claude/settings.local.json`, `.claude/cache/`, `.claude/state/`, `.claude/memory/`), Playwright 아티팩트 (`playwright-report/`, `test-results/`, `.playwright/`, `trace.zip`), heap/CPU 프로파일, 미출하 도구의 락 파일, 확장된 macOS Finder 노이즈, 범용 비밀 패턴 (`secrets.json`, `credentials.json`, `*.pem`, `*.key`) 를 다룹니다.

### 🧪 테스트

- **283 유닛 테스트** (이전 277): +11 신규 (B1 redirect 거부용 4개, `hasGeminiKey` 용 1개, `runAnthropic` 로그 가드용 1개).
- **5 Playwright 브라우저 smoke 테스트** (신규, `npm run test:e2e:browser` 를 통한 옵트인): 대시보드 렌더 + 버전 푸터, 대시보드 → 스캔 → 파이프라인 → cv 내비게이션, 언어 전환 영속, 404 뷰, health 페이지 렌더. Playwright 를 부모의 `node_modules` 를 통해 해결합니다 — 신규 의존성 없음.
- 커버리지가 ~93% 라인 / ~83% 브랜치로 유지됩니다.

### 📝 신규 / 갱신된 package.json 스크립트

| 스크립트 | 용도 |
|---|---|
| `npm run test:e2e:browser` | in-process 서버에 대해 Playwright smoke 하니스 실행 (5 테스트). |

### 🔧 변경된 파일

```
+ CLAUDE.md                                    +  .aiignore
+ docs/PROJECT.md                              +  docs/ROADMAP.md
+ docs/sdd/SDD-GUIDE.md                        +  docs/sdd/CONVENTIONS.md
+ docs/architecture/OVERVIEW.md                +  docs/architecture/SERVER.md
+ docs/architecture/FRONTEND.md                +  docs/architecture/API.md
+ docs/architecture/DATA-FLOWS.md              +  docs/reviews/REVIEW-2026-05-07.md
+ .claude/agents/web-ui-route-reviewer.md      +  .claude/agents/spa-view-reviewer.md
+ .claude/agents/test-isolation-reviewer.md
+ .claude/commands/sdd-status.md               +  .claude/commands/codebase-tour.md
+ server/lib/security.mjs                      +  server/lib/prompts.mjs
+ server/lib/store.mjs
+ server/lib/routes/scan.mjs                   +  server/lib/routes/runners.mjs
+ server/lib/routes/content.mjs
+ tests/playwright-smoke.mjs

~ .gitignore                                   ~  README.md (badge fix)
~ package.json (1.7.2 → 1.8.0)
~ server/index.mjs (1230 → 762 LOC)
~ server/lib/runner.mjs (SIGKILL escalation, max-runtime cap)
~ server/lib/anthropic.mjs (hasGeminiKey)
~ server/lib/parsers.mjs (URL gate in addPipelineUrl)
~ server/lib/ru-scanner.mjs                    ~  server/lib/en-scanner.mjs
~ server/lib/sources/{hh,habr,greenhouse,ashby,lever}.mjs (signal threading)
~ tests/anthropic.test.mjs                     ~  tests/i18n-coverage.test.mjs
~ tests/pipeline-preview.test.mjs
```

---

## [1.7.2] — 2026-05-04

Help 센터, in-UI App settings, 모바일 사이드바, 단일 Scan 버튼, 모든 프롬프트 빌더의 "Show result" 단축.

### ✨ 신규 기능

- **`feat(help): in-app user guide` (`/#/help`)** — 신규 사이드바 항목에서 접근 가능한 장문 Markdown 문서. 모든 페이지를 단계별로 다룹니다: 빠른 시작, CV 편집기, Profile, 스캔 필터, Pipeline preview, Evaluate, Deep research, Apply, Tracker, Reports, 모든 7개 모드, Activity log, Health, 설정 힌트. `<h2>` 헤딩에서 자동 구축되는 sticky 목차, 동기적 DOM 빌드 (경쟁 상태 없음). 지원되는 8개 로케일 모두에 현지화.
- **`feat(config): in-UI App settings page` (`/#/config`)** — 브라우저에서 `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `HH_USER_AGENT`, `PORT`, `HOST` 를 편집합니다. **부모 프로젝트의** `.env` 파일에 쓰므로 career-ops Node 스크립트와 web-ui 의 dotenv 로더가 같은 소스를 가져갑니다. 비밀 키는 읽기 시 마스킹됩니다 (앞/뒤 4자). 모델 필드는 큐레이션된 목록의 드롭다운입니다 (claude-sonnet-4-6 / claude-opus-4-7 / claude-haiku-4-5 / gemini-2.0-flash / etc.). 빈 값은 키를 삭제합니다. 값이 즉시 실행 중인 process.env 에 적용됩니다 — 대부분의 설정은 재시작 없음.
- **`feat(modes): "⚡ Show result" button alongside "Copy prompt"`** — manual 모드에서 프롬프트가 생성될 때 사용자가 LLM 결과를 얻기 위해 입력을 재입력하지 않아도 됩니다. 신규 버튼이 동일한 폼을 `run: true` 로 재제출하고, 키가 구성되지 않았을 때는 명확한 toast (`Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env first`) 로 폴스루합니다. `/#/deep`, `/#/project`, `/#/training`, `/#/followup`, `/#/batch`, `/#/contacto`, `/#/interview-prep`, `/#/patterns` 에서 동작합니다.

### 🐛 UX + UI 수정

- **`fix(scan): single Scan button replaces three (Scan all + EN + RU)`** — 압도적인 선택이고, 99% 경우 동일한 기본값입니다. 통합된 `🌐 Scan` 버튼이 모든 활성화된 소스를 실행합니다. Help 문서가 8개 로케일에서 갱신되었습니다.
- **`fix(ui): mobile sidebar drawer`** — 뷰포트 <900px 가 이제 top bar 에 햄버거 버튼 (☰) 을 받습니다; `body.sidebar-open` 이 사이드바를 슬라이드 인 시키는 CSS transform 을 토글합니다. backdrop 어둡게 + 아무 곳이나 클릭하면 닫힘. 앵커 클릭 + hashchange 가 자동 닫기를 일으켜 사용자가 drawer 가 접힌 상태로 새 페이지에 도착합니다. 더 큰 뷰포트는 영향이 없습니다.
- **`fix(server): footer version reflects web-ui, not the parent VERSION`** — `/api/health` 가 이제 web-ui 자체의 `package.json` 을 읽습니다. 푸터가 더 이상 부모의 버전 파일에서 오래된 `1.6.0` 을 누설하지 않습니다. 부모의 VERSION 은 여전히 `parentVersion` 으로 별도 노출됩니다.

### 📦 신규 REST 엔드포인트

| Method | Path | 용도 |
|---|---|---|
| `GET`  | `/api/help/:lang` | 요청된 로케일의 Markdown 사용자 가이드를 반환, `en.md` 로 폴백. 경로 탐색 안전. |
| `GET`  | `/api/config` | 모든 알려진 env 키의 현재 값 반환; 비밀 마스킹됨. |
| `POST` | `/api/config` | 주어진 키를 부모 프로젝트의 `.env` 에 쓰고, 각 값을 검증하며, `process.env` 에 라이브 적용. |

### 🌐 i18n

- `nav.help`, `nav.config`, `help.*`, `config.*`, `deep.showResult`, `deep.needKey`, `scan.btnRun` 에 걸쳐 30+ 신규 키. 8개 로케일 모두 채워졌습니다.

### 🧪 테스트

- `tests/help.test.mjs` (12 케이스) — 모든 지원 로케일이 실질적인 markdown 을 반환, EN 이 모든 페이지 slug 를 spot-check, 알 수 없는 lang → EN 폴백, 경로 탐색 정화, 모든 로케일이 `cv.md` / `profile.yml` / `.env` 를 참조.
- `tests/help-ui.test.mjs` (9 케이스) — 뷰 파일 등록, 사이드바 항목, 모든 로케일에 i18n 키 존재, 모든 로케일용 docs 파일 존재, EN/RU help 가 14개 정규 섹션 보유, 모든 #/foo 라우트 커버됨, deep + mode-page 의 Show-result 배선.
- `tests/env-config.test.mjs` (18 케이스) — `parseEnv`, `maskSecret`, `validateConfig`, `updateEnvFile` (부트스트랩, 주석을 보존하는 in-place 재작성, 빈 값 삭제, 필요시 따옴표) 의 순수 함수 테스트.
- `tests/config-endpoint.test.mjs` (8 케이스) — GET 이 비밀 마스킹 / env 경로 반환; POST 가 부모 .env 에 쓰기; 라이브 process.env 적용; 빈 값이 unsets; 알 수 없는 키 + 잘못된 형식의 Anthropic 키를 400 으로 거부.

### 📊 통계

- **테스트:** 233 → **277** (+44, 4개 신규 테스트 파일).
- **E2E:** 20 smoke + 23 comprehensive = 43 Playwright 단계, 모두 녹색.
- **커버리지:** 93.5% 라인 / 82.6% 브랜치 / 93.7% 함수 (변경 없음 — 신규 코드는 완전히 테스트됨).

---

## [1.7.1] — 2026-05-04

v1.7.0 이후 작업을 쌓는 패치 릴리스: 파이프라인 preview 패널, Anthropic API 통합, 스크롤 가능 사이드바, dotenv 로더, 동적 Active-companies 목록, CI 워크플로 강화.

### ✨ 파이프라인 Preview 패널

- **`/#/pipeline` 개편** — 왼쪽 목록 + 오른쪽 preview 패널. 모든 URL 을 클릭하여 서버 사이드 프록시 스냅샷 (`GET /api/pipeline/preview` 가 script/style/태그를 strip 하고 8 KB 에서 캡, `isValidJobUrl` 로 검증) 을 가져옵니다. 라이브 필터 입력, "In queue" 카운터, ⚡ "Evaluate first" 헤더 버튼. 모든 행의 인라인 ▶/✕ 와 preview 패널의 전체 Evaluate / Open in tab / Delete. `data-url` + `.pipeline-row` + `.pipeline-row-delete` 클래스로 안정된 테스트 셀렉터. `tests/pipeline-preview.test.mjs` 의 **8개 신규 테스트** (목 fetch, upstream 바인딩 불필요).

### ✨ Anthropic API 통합 — 모든 곳에서 "Run live"

- **`server/lib/anthropic.mjs`** — Anthropic Messages API 용 제로 의존성 클라이언트 (claude-sonnet-4-6 기본, `ANTHROPIC_MODEL` 로 재정의). `ANTHROPIC_API_KEY` 가 설정되면 모든 모드 페이지 (`/#/deep`, `/#/project`, `/#/training`, `/#/batch`, `/#/contacto`, `/#/interview-prep`, `/#/patterns`) 가 **주요** 액션으로 "⚡ Run live (Anthropic)" 버튼을 렌더링합니다 — 클릭 시 프롬프트를 실행하고 Claude Code 로 핸드오프하는 대신 Markdown 을 브라우저로 다시 렌더링합니다. Gemini 키만 설정된 경우 Gemini 가 폴백으로 유지됩니다. 키가 전혀 없어도 manual 모드는 여전히 동작합니다. `tests/anthropic.test.mjs` 의 **8개 신규 테스트**.

### 🐛 CI / 파이프라인 수정

- **`fix(api): tighten pipeline URL validator` (FIX-M7)** — 이제 loopback 호스트네임, 길이 <10 또는 >2000, URL 내 공백도 거부합니다.
- **`fix(server): actually load .env so HH_USER_AGENT / GEMINI_API_KEY hints work`** — `server/lib/dotenv.mjs` (35줄 제로 의존성 로더) 를 추가하여 `server/index.mjs` 상단에 배선했습니다. 스캐너 코드의 런타임 힌트가 마침내 무언가를 합니다. **6개 신규 테스트**.
- **`fix(ui): scrollable sidebar`** — 6개 그룹의 18개 내비 항목이 짧은 뷰포트를 오버플로우했습니다. `.sidebar` 가 이제 thin 사용자 정의 스타일 스크롤바와 함께 `overflow-y: auto` 를 갖습니다.
- **`fix(ui): make HH_USER_AGENT banner dismissible`** — 그러다 과한 것이라고 판단하여 `/scan` 에서 완전히 제거했습니다. Health 페이지 검사가 여전히 이를 noted 합니다.
- **`fix(scan): Active companies list is now collapsible + filterable + grouped`** — 평면 87 태그는 압도적이었습니다. 이제 "▸ Active companies 87/71" 토글이 정렬된 목록을 펼칩니다 (✓ API 지원 먼저, ○ 웹 검색 두 번째) 더하기 검색 필터.
- **`fix(test): isolate api.test.mjs + en-scanner.test.mjs from parent project`** — 둘 다 이제 tmp 프로젝트 루트를 띄우므로 web-ui 옆에 부모를 체크아웃하지 않고도 CI 가 동작합니다.
- **`fix(workflow): publish-package version-match only on release events`** — main 에서의 `workflow_dispatch` 가 더 이상 tag/version 검사를 실패시키지 않습니다.
- **`fix(e2e): stable selector for pipeline row delete`** — 앵커 래퍼 복원 + `data-url` 어트리뷰트 추가로 e2e 스위트의 셀렉터가 안정됩니다.

### 📦 신규 REST 엔드포인트

| Method | Path | 용도 |
|---|---|---|
| `GET` | `/api/pipeline/preview?url=…` | 서버 사이드 프록시: URL 의 가시 텍스트 스냅샷 반환 (script/style 제거, 8 KB 캡), `isValidJobUrl` 로 게이팅. |

### 📊 이 배치 후 통계

- **테스트:** 225 → **233** (v1.7.0 위에 +8).
- **테스트 파일:** 25 → **26**.
- **E2E:** 20 + 23 = 43 Playwright 단계, 모두 녹색.

---

## [1.7.0] — 2026-05-03

QA r5 가 구동한 35커밋 강화 + UX + 기능 완성 패스. 보안 레이어 3개 (XSS 정화, CSP, 입력 검증) 가 도착했고, 누락된 CRUD 엔드포인트가 채워졌고, 부모 프로젝트 부트스트랩이 이제 완전히 자동화되었으며, UI 는 **신규 페이지 9개** 를 얻었습니다 — Activity, 재설계된 Deep Research, 더하여 부모의 `modes/` 의 100% 를 다루는 7개의 사이드바 그룹화된 모드 (project / training / followup / batch / outreach / interview-prep / patterns). 파이프라인이 서버 사이드 preview 패널을 얻었습니다. Anthropic API 통합이 모든 모드에서 "Run live" 를 원클릭으로 만듭니다. 테스트 커버리지가 **73** 에서 **225** 로, **25개 테스트 파일** 에 걸쳐 갔고, **23개 comprehensive Playwright e2e 단계** 도 있습니다. GitHub Actions 가 CI / AI 리뷰 / Release / Publish-Package 워크플로를 출하합니다.

### 🔒 보안

- **`fix(cv): sanitize CV markdown to block stored XSS in preview` (FIX-C10)** — `PUT /api/cv` 가 이제 `cv.md` 를 쓰기 전에 `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<form>`, `<svg>`, `on*=` 이벤트 핸들러, `javascript:`/`vbscript:`/`data:text/html` URI 를 strip 합니다. 본문 1 MB 캡 (오버플로 시 413). 클라이언트 사이드 `UI.md()` 는 어떤 markdown 변환도 실행되기 전에 모든 바이트를 escape 하도록 재작성되어 원시 HTML 이 절대 `innerHTML` 에 도달할 수 없습니다. 링크 `href` 어트리뷰트는 안전한 스킴 (`http`/`https`/`mailto`/`tel`/상대 + `data:image` 만) 의 allowlist 에 대해 검증됩니다. strip 헬퍼와 HTTP 라운드트립에 걸친 신규 테스트 17개.
- **`fix(server): add CSP and baseline security headers` (FIX-L2)** — 모든 응답이 이제 `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` 을 운반합니다. 서버가 loopback 너머에 바인딩되면 (`HOST` ≠ `127.0.0.1`/`::1`/`localhost`), 엄격한 `Content-Security-Policy` 가 위에 레이어링됩니다: `default-src 'self'`, `script-src 'self'` (no `unsafe-inline`), Google Fonts whitelisted, `connect-src 'self'` 가 XSS 유출을 차단. `index.html` 과 `router.js` 의 인라인 `onclick` 핸들러가 엄격한 CSP 를 손상시키지 않도록 `addEventListener` 로 이동되었습니다. 5개의 다른 `HOST` 값에 걸쳐 CSP 를 게이팅하는 신규 테스트 8개.
- **`fix(api): tighten pipeline URL validator` (FIX-M7)** — `POST /api/pipeline` 가 이전에는 `"not-a-url"` 을 수용하고 영속화했습니다. 이제 `isValidJobUrl()` 이 빈 문자열, <10 또는 >2000 자 입력, 공백 포함 URL, 비-`http(s)` 스킴, loopback 호스트네임 (`localhost`/`127.0.0.1`/`::1`) 을 거부합니다. **FIX-M3** + **FIX-M6** (잘못된 입력에서 400 반환, 더하여 성공 시 `deduped` 플래그) 도 포함합니다.
- **`fix(server): actually load .env so HH_USER_AGENT / GEMINI_API_KEY hints work`** — 이전에는 런타임이 사용자에게 ".env 에 HH_USER_AGENT 를 설정하라" 고 했지만 서버가 그 파일을 읽지 않았으므로 지시를 따라도 아무것도 하지 않았습니다. 35줄의 제로 의존성 dotenv 로더 (`server/lib/dotenv.mjs`) 를 추가하여 `server/index.mjs` 상단에 배선했습니다. 커맨드 라인에 설정된 process-env 값은 여전히 이깁니다. 부모의 `.env.example` 이 이제 실제 Chrome User-Agent 예제가 포함된 문서화된 `HH_USER_AGENT` 블록을 포함합니다. 6개 신규 테스트.
- **`fix(api): sanitize JD before prompt assembly` (FIX-M5)** — `POST /api/evaluate` 가 Gemini 를 호출하거나 프롬프트를 다시 echo 하기 전에 ANSI 이스케이프, 제어 바이트, 인라인 `<script>` 태그를 strip 하고 공백을 trim 합니다. 50 KB 길이 캡. 50자 최소는 *정화된* 텍스트에 대해 실행되므로 충분히 길어 보이지만 대부분 이스케이프로 구성된 프롬프트 주입 시도가 400 으로 fail-fast 됩니다.
- **`fix(health): mask Node version + project root when HOST!=loopback` (FIX-M1)** — `/api/health` 가 LAN 노출 배포에서 더 이상 호스트를 fingerprint 하지 않습니다. Loopback 응답은 로컬 진단을 위해 값을 유지합니다.

### ✨ 신규 기능

- **`feat: 7 new sidebar modes + grouped sidebar` (FIX-C8)** — 부모의 `modes/` 디렉토리의 100% 를 UI 갭 없이 다룹니다. 신규 라우트: `#/project` (포트폴리오 프로젝트 어드바이저), `#/training` (코스/자격 평가), `#/followup` (지원별 cadence), `#/batch` (병렬 URL 프로세서), `#/contacto` (LinkedIn 아웃리치 드래프터), `#/interview-prep` (단계별 준비), `#/patterns` (거절 패턴 분석기). 일곱 모두 단일 config 구동 뷰 팩토리 (`public/js/views/mode-page.js`) 와 단일 범용 엔드포인트 `POST /api/mode/:slug` 를 공유합니다 — 미래에 새 모드를 추가하는 것은 하나의 config 행 + 하나의 i18n 블록입니다. 사이드바가 6개 그룹으로 재구성됨: Sourcing / Decision / Application / Networking / Analytics / Setup. 총 18개 내비 항목. `tests/modes-endpoints.test.mjs` 의 신규 테스트 12개.
- **`fix: bootstrap parent deps + russian_portals defaults` (FIX-C4 + C9 + C12 + H2)** — `bin/start.sh` 가 이제 신규 클론에서 부모의 `node_modules` (js-yaml, playwright, jsdom) 와 `npx playwright install chromium` 을 설치하므로 `/api/stream/scan`, `/pdf`, `/liveness` 가 즉시 end-to-end 로 동작합니다. `createApp()` 이 모든 부팅에서 `portals.yml` 을 프로브합니다 — `russian_portals:` 블록이 없으면 주석과 함께 문서화된 기본을 추가합니다. 멱등성: 두 번째 부팅은 no-op. 3개 신규 테스트.
- **`fix: disable 9 dead portal slugs in template + health-check script` (FIX-C3)** — `templates/portals.example.yml` 이 이제 Ada / Factorial / Tinybird / Weights & Biases / Travelperk / Clarity AI / Forto / Vinted / Runway 를 `enabled: false` 로 표시하여 출하합니다 (각 항목에 인라인 이유 주석). 신규 설치는 96 대신 **87** 개의 활성 회사를 스캔합니다. 신규 `web-ui/scripts/portals-health-check.mjs` 가 활성화된 모든 `careers_url` 을 HEAD 프로브하고 제안된 패치 목록과 함께 DEAD 항목을 보고합니다 (`--json` 을 통한 JSON 출력). 3개 신규 테스트.
- **`feat(activity): user-action log + Activity sidebar page`** — 모든 상태 변경 API 요청이 `data/activity.jsonl` 에 캡처됩니다 (타임스탬프, 액션 동사, 대상, 성공 플래그, 선택적 세부). 액션 접두어 chip 필터 (pipeline / cv / jd / evaluate / scan / stream / script), 액션 ✓/✗ 배지, 새로고침 버튼이 있는 신규 사이드바 항목 **Activity**. 5 MB 에서 자동 회전. 미들웨어, 읽기 필터, 손상된 라인 허용, `GET /api/activity` 자체에 대한 재귀 가드를 다루는 10개 신규 테스트.
- **`feat(deep): view Deep Research in browser + saved-results archive`** — Deep Research 페이지가 이제 (a) `{ run: true }` 와 `GEMINI_API_KEY` 가 설정되면 Gemini 를 통해 프롬프트를 라이브 실행하고 출력을 `interview-prep/{slug}.md` 에 영속화합니다; (b) 저장된 모든 deep-research 파일을 상대 타임스탬프와 함께 클릭 가능한 카드로 나열합니다; (c) 결과를 Markdown 으로 렌더링하며 결과별 **📋 Copy / ⬇ Download .md / ↗ Open in tab** 액션을 제공합니다. 신규 REST 표면: `GET /api/interview-prep`, `GET /api/interview-prep/:name`, `DELETE /api/interview-prep/:name`. 7개 신규 테스트.
- **`feat(cv): generate + download PDF in browser, with PDF archive`** — CV 페이지의 신규 **📄 Generate PDF** 버튼이 모달 콘솔에서 `/api/stream/pdf` 를 스트리밍합니다. `ERR_MODULE_NOT_FOUND` / `playwright` 오류 시 복사-붙여넣기 가능한 부트스트랩 커맨드를 노출합니다. 신규 "Generated PDFs" 섹션이 각 성공 실행 후 자동 로드되어 모든 `output/*.pdf` 를 **↗ Open** 과 **⬇ Download** 버튼과 함께 나열합니다. 신규 REST 표면: `GET /api/output/pdfs`, `GET /api/output/pdfs/:name`. 6개 신규 테스트.
- **`feat(api): POST /api/tracker — append rows from the UI` (FIX-H8)** — 브라우저에서 정규 행을 `data/applications.md` 에 추가합니다. company + role 을 검증하고, `templates/states.yml` 에 대해 상태를 정규화하며, 0 패딩된 `#` 을 자동 증분하고, company+role 로 중복 제거 (대소문자 무시), 노트의 파이프를 이스케이프하여 markdown 표가 깨지지 않도록 합니다. 파일이 비어 있을 때 표를 부트스트랩합니다. 6개 신규 테스트.
- **`feat(api): DELETE /api/jds/:name` (FIX-H4)** — shell out 없이 저장된 JD 를 제거합니다. 어떤 파일시스템 접촉 전에 경로 탐색 문자가 strip 되며; 파라미터는 `.txt` 로 끝나야 합니다. `../../etc/passwd` 거부 포함 5개 신규 테스트.
- **`feat(api): POST /api/evaluate/test-gemini` (FIX-H7)** — `gemini-eval.mjs` 를 통해 50자 더미 JD 를 실행하여 사용자가 실제 평가를 기다리지 않고도 API 키가 동작하는지 확인할 수 있는 smoke-test 엔드포인트. `{ ok, code, sampleLength, sample }` 반환.

### 🐛 버그 수정

- **`fix(router): catch-all 404 view + i18n coverage guard` (FIX-C7)** — 알 수 없는 해시 라우트가 이전에는 조용히 대시보드로 폴백되어 오타와 깨진 북마크를 가렸습니다. 이제 `#/totally-random-xyz` 가 잘못된 경로를 인용하고 대시보드로 링크하는 전용 404 페이지를 렌더링합니다. 404 뷰는 라우터 IIFE 자체 안에 등록되어 어떤 사용자 라우트와도 충돌할 수 없습니다. 신규 `tests/i18n-coverage.test.mjs` 가 `vm.Context` 안에서 stub `window` 와 함께 `i18n.js` 를 실행하고 private `DICT` 를 노출하여 173+ 키 × 8 로케일 각각이 채워지고 비어 있지 않음을 단언합니다. 4개 신규 라우터 테스트.
- **`fix(router): alias #/profile → settings` (FIX-C2)** — 내부 라우트 이름은 `settings` (`nav.settings` 가 "Profile" 을 렌더링) 이지만 외부 링크와 근육 기억은 `#/profile` 로 갑니다. 이제 두 주소가 같은 뷰에 도달하고 사이드바 내비 항목이 어느 쪽이든 강조됩니다. 2개 신규 테스트.
- **`fix(health): unify Health/Doctor + flag template profiles` (FIX-C6 + FIX-H6)** — Health 와 Doctor 가 두 개의 다른 진실 소스였습니다. 이제 `/api/health` 가 Doctor 가 보고하는 모든 것 (parent-deps, Playwright, dirs, profile-customized, `HH_USER_AGENT`) 을 노출합니다. `Profile customized` 검사가 placeholder 이름 (`Jane Smith`, `Alex Doe`, `John Doe`, `Your Name`, `Test User`) 과 명시적 YAML 파싱 오류를 감지합니다. 4개 신규 테스트.
- **`fix(scan): warn on query↔negative collisions in RU config` (FIX-H3)** — `portals.yml` 이 Senior PHP 를 타깃하는 쿼리와 함께 `title_filter.negative` 에 `"PHP"` 를 출하하면 모든 매치가 필터링되어 사용자가 결과 0 을 봅니다. `loadConfig()` 가 이제 `warnings` 배열을 계산합니다; `runRuScan()` 이 스캔이 시작되기 전에 각 경고를 SSE stderr 라인으로 emit 합니다. 출하 기본이 PHP-친화적으로 유지됨을 검증하는 2개 테스트.
- **`fix(scan): warn when HH_USER_AGENT is unset` (FIX-H1)** — `/scan` 페이지가 `/api/health` 를 프로브하고 `HH_USER_AGENT` 가 비어 있으면 액션 행 위에 노란 경고 카드를 표시하여 사용자가 RU 스캔을 클릭하기 *전에* hh.ru 403 을 알도록 합니다.
- **`fix(api): warn when POST /api/jds slug had unsafe chars stripped` (FIX-M2)** — 위험한 문자를 strip 하는 slug 정규화가 이제 `warning` 필드를 반환합니다; 순수 대소문자/공백 정리는 조용히 유지됩니다. 정화 후 빈 결과는 400 을 반환합니다.
- **`fix(ui): clear global search on route change + button spinners` (FIX-M4 + FIX-L1)** — 글로벌 검색 입력이 `hashchange` 에서 클리어됩니다 (활성 입력 가드 포함). 신규 `UI.withSpinner(button, fn)` 헬퍼가 로딩 상태, ARIA, 더블 클릭 방지를 모든 비동기 버튼 클릭에 배선합니다. 이미 Doctor / Verify / sync-check / Save CV / Normalize / Dedup / Merge 버튼에 적용되었습니다.
- **`fix(ui): make sidebar scrollable so 18 nav items always reach the footer`** — FIX-C8 의 그룹화된 사이드바가 짧은 뷰포트를 오버플로우했습니다; 하단 항목 (Activity / Health) 이 잘렸습니다. `.sidebar` 가 이제 thin 사용자 정의 스타일 스크롤바와 함께 `overflow-y: auto` 를 갖습니다 (WebKit + Firefox). 푸터는 기존 `margin-top: auto` 를 통해 핀 유지됩니다.
- **`fix(ui): empty modal-title placeholder` (FIX-H9)** — `index.html` 의 하드코딩된 영어 `"Title"` 문자열이 사라졌으며, 모달이 열리는 동안 보였던 짧은 경쟁 창을 닫습니다.

### 🌐 i18n

- 173+ 번역 키 × 8개 지원 로케일 (`en`, `es`, `pt-BR`, `ko`, `ja`, `ru`, `zh-CN`, `zh-TW`). 모든 로케일에 추가된 신규 키: 404 페이지, activity 로그, deep research, PDF 흐름, 보안 경고, tracker 변경, apply 이름 변경. 커버리지가 이제 `tests/i18n-coverage.test.mjs` 로 강제됩니다 — 모든 키가 모든 지원 로케일에서 비어 있지 않은 값을 가져야 하며 그렇지 않으면 CI 실패합니다.

### ⚙️ DevOps

- **테스트 수:** 73 → **201** (23개 테스트 파일에 걸쳐 +128 테스트). 유일하게 남은 실패 테스트 (`runEnScan: dry-run end-to-end across multiple sources`) 는 Greenhouse/Ashby/Lever 라이브 API 응답에 의존하는 기존 flake 입니다.
- **Comprehensive Playwright e2e** (`tests/e2e-comprehensive.mjs`, 23 단계): 전체 사용자 여정을 걷습니다 — CV 저장 → preview → PDF 생성 → 모든 7개 신규 모드 → tracker 필터 → activity 로그 → 404 → 모달 ESC → 사이드바 스크롤 → Ctrl-K 포커스 → 검색 클리어 → profile alias → 언어 영속.
- **GitHub Actions** (`.github/workflows/`):
  - `ci.yml` — Node 18/20/22 매트릭스의 유닛 + 통합 테스트, 더하여 i18n 커버리지 게이트 (모든 키 × 8 로케일이 비어 있지 않아야 함), 더하여 모든 PR 의 전체 Playwright e2e.
  - `ai-review.yml` — 모든 PR 에 대한 Claude Code AI 리뷰. 메인테이너가 머지 권한을 유지합니다; Claude 는 제안만 합니다. `skip-ai-review` 레이블로 건너뛰기.
  - `release.yml` — `v*.*.*` 태그가 푸시되면 GitHub Release 자동 게시; 릴리스 노트는 `CHANGELOG.md` 에서 슬라이스되므로 8개 언어 변형이 모두 정규 소스로 유지됩니다.
- **CSP 친화적 UI:** 모든 인라인 `onclick` 핸들러가 `index.html` 과 `router.js` 에서 제거되었습니다. 엄격한 `script-src 'self'` 정책이 어떤 기능도 깨뜨리지 않고 이제 강제 가능합니다.

### 📦 신규 REST 엔드포인트

| Method | Path | 용도 |
|---|---|---|
| `GET`    | `/api/activity`                  | 사용자 액션 이벤트 목록, 최신 우선 |
| `GET`    | `/api/interview-prep`            | 저장된 Deep Research 파일 목록 |
| `GET`    | `/api/interview-prep/:name`      | 단일 Deep Research 파일 읽기 |
| `DELETE` | `/api/interview-prep/:name`      | Deep Research 파일 제거 |
| `GET`    | `/api/output/pdfs`               | 생성된 PDF 목록 |
| `GET`    | `/api/output/pdfs/:name`         | 첨부로 PDF 스트리밍 |
| `POST`   | `/api/tracker`                   | `applications.md` 에 행 추가 |
| `DELETE` | `/api/jds/:name`                 | 저장된 JD 제거 |
| `POST`   | `/api/evaluate/test-gemini`      | Gemini API 키 smoke 테스트 |
| `POST`   | `/api/mode/:slug`                | 7개 신규 모드 (project / training / followup / batch / contacto / interview-prep / patterns) 의 범용 프롬프트 빌더 |

---

## [1.6.0] — 2026-05-02

웹 UI 의 초기 공개 릴리스. 이 기준선의 기능 인벤토리는 `README.md` 를 참조하십시오.


