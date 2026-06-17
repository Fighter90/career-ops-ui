# 도움말 — career-ops-ui

앱을 실행한 순간부터 인터뷰를 따낼 때까지, 모든 페이지를 단계별로
안내합니다. 아래 각 `##` 헤딩은 사이드바 항목 또는 워크플로의 한
단계에 대응합니다. 처음 실행 시에는 위에서 아래로 읽고, 이후에는
도움말 사이드바의 목차로 특정 섹션에 바로 이동하십시오.

> **대상 독자:** 이 UI를 `career-ops` 체크아웃 안에 두고 방금
> `bash bin/start.sh`를 실행한 분. career-ops에 대한 사전 지식은
> 가정하지 않습니다.

### career-ops 소개

[career-ops](https://career-ops.org)는 모든 AI 코딩 CLI(Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI — 다른 Claude 호환 CLI도 동일한 슬래시 커맨드 인터페이스에서 작동합니다) 안에서
슬래시 명령으로 동작하는 오픈소스 구직 시스템입니다. 모델
무관(model-agnostic). 각 채용 공고를 여러분의 CV에 대해 6차원
0.0–5.0 루브릭으로 평가하고, 맞춤형 PDF 이력서를 생성하며, 모든
지원을 로컬 머신에서 추적합니다.

**정식 레퍼런스 (최초 설치 시 이 순서대로 읽으십시오):**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — 시스템, 원칙, 개념 목록.
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — 채용 공고 발견과 Pipeline 채우기.
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — Playwright 폼 읽기를 포함한 전체 제출 흐름.
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — `batch-runner.sh`로 10개 이상 JD를 한 번에 채점.
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — Chromium 설치 및 PDF·폼 채우기를 위한 MCP 등록.

**핵심 원칙**
([career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
출처):

- **오픈소스, 진심으로** — MIT 라이선스, 유료 티어 없음, 대기열
  없음, 텔레메트리 없음, 계정 없음. 시스템은 유료 티어, 계정,
  텔레메트리 없이 동작합니다. 코드 기여는 릴리스 전에 커뮤니티
  리뷰를 거칩니다.
- **데이터 주권** — `cv.md`, `config/profile.yml`, `data/`,
  `reports/`, `interview-prep/`는 명시적으로 푸시하지 않는 한
  여러분의 노트북을 절대 떠나지 않습니다. 로컬 머신에서
  실행하므로 데이터 주권을 온전히 유지합니다.
- **AI-비종속 아키텍처** — career-ops는 모델을 번들로 제공하지
  **않습니다**. 기존 AI 코딩 CLI 내부에서 명령으로 동작합니다.
  제공자(Anthropic ↔ Gemini ↔ OpenAI)를 바꿔도 평가 이력은
  일관되게 유지됩니다.
- **사람이 통제하는 제출** — career-ops가 답변을 작성하고 폼을
  열어주지만, **Submit은 여러분이 클릭**합니다. 시스템은 절대로
  자동 지원하지 않습니다. 시스템은 구조와 평가를 제공하고, 최종
  제출 권한은 사람에게 있습니다.
- **구조적 검색** — 능동적이고 의도적인 다수 지원 구직을 위해
  설계되었습니다. 단발 제출 도구나 추천 엔진이 아닙니다. 설정에
  약 15분이 걸리며 터미널 사용에 익숙하다고 가정합니다.

**career-ops가 아닌 것** (명시적 비목표):

- 자동 지원 도구가 아닙니다. 폼을 대신 제출하지 않습니다.
- 이력서 재작성 도구가 아닙니다. JD별로 맞춤화할 뿐, 경험을
  지어내지 않습니다.
- LinkedIn 최적화 도구가 아닙니다. 프로필 관리는 여러분의
  영역입니다.
- SaaS UI 뒤에 숨은 스프레드시트 대체재가 아닙니다. 데이터는
  여러분의 파일 시스템에 있는 일반 마크다운입니다.

**핵심 개념** (career-ops가 다루는 모든 산출물의 전수 목록):

| 개념 | 설명 |
|---|---|
| **Mode** | `modes/<slug>.md`에 있는 프롬프트 템플릿. 내장: `oferta`, `deep`, `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`, `ofertas`, `auto-pipeline`, `pdf`, `latex`, `scan`, `tracker`. |
| **Archetype** | `config/profile.yml`에 있는 타깃 롤 프로필. 루브릭은 활성 archetype에 대한 스킬 매칭에 가중치를 부여 — **가장 중요한 단일 필드**. |
| **Pipeline** | `data/pipeline.md` — 평가 대기 중인 JD URL의 inbox. |
| **Tracker** | `data/applications.md` — 모든 평가와 지원 상태의 이력 GFM 테이블. |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — JD별 전체 A–F 평가, 헤더에 score와 legitimacy 포함. |
| **Scan history** | `data/scan-history.tsv` — append-only 로그. 스캔 간 중복 방지. |
| **Proof points** | `cv.md`에서 추출한 STAR+R 증거 블록. 평가·apply 답변·인터뷰 준비에 재사용. |
| **JD store** | `jds/jd-<date>-<ts>.txt` — 평가 시 그대로 저장된 채용 공고 원문. 감사 추적용. |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — 심층 리서치 브리프와 라운드별 한 장 요약. |
| **Batch additions** | `batch/tracker-additions/*.tsv` — `batch-runner.sh`가 큐잉한, tracker로 병합 대기 중인 행. |

### career-ops vs career-ops-ui (이 앱)

| | career-ops (CLI) | career-ops-ui (이 앱) |
|---|---|---|
| 실행 위치 | Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI 내부 | 브라우저의 `http://127.0.0.1:4317` |
| 표면 | `/career-ops <mode>` 슬래시 명령 | 워크플로우당 한 페이지를 가진 사이드바 |
| 폼 채우기 | 예, Playwright MCP 경유 | 아니오 — 체크리스트만 생성. CLI에서 마무리 |
| PDF | `generate-pdf.mjs` | `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep`의 `📄 Generate PDF` |
| 데이터 파일 | career-ops-ui와 공유 | career-ops와 공유 |

career-ops-ui는 **순수 추가물**입니다. `career-ops/` 내부의 무엇도
변경되지 않습니다. 두 표면은 동일한 `cv.md`,
`config/profile.yml`, `portals.yml`, `data/`, `reports/`,
`interview-prep/`, `modes/`를 공유합니다.

### Score별 액션 임계값

JD가 평가되고 나면 점수가 다음에 무엇을 할지 결정합니다 (정식 표는
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
에서 가져왔습니다):

| Score | 다음 단계 |
|---|---|
| **≥ 4.5** | `/career-ops apply` — 적합도 높음. 즉시 지원. |
| **4.0 – 4.4** | 지원하거나 `/career-ops contacto`로 warm intro 먼저. |
| **3.5 – 3.9** | `/career-ops deep` — 결정 전에 회사/롤 리서치. |
| **< 3.5** | 개인적 사유가 명확하지 않은 한 건너뜀. |

career-ops-ui의 `#/dashboard`와 `#/tracker`는 4.0 이상 모든 행을
강조하므로 재실행 없이 바로 다음 액션을 선택할 수 있습니다.

### 외부 문서

기반이 되는 career-ops 엔진의 전체 레퍼런스(스캐닝, 평가 루브릭,
batch 처리, apply 흐름, Playwright 설정)는
[career-ops.org/docs](https://career-ops.org/docs)에 있습니다:

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. 빠른 시작 — "CV 만들기"에서 "지원 및 메시지 발송"까지의 전체 단계

이것이 정식 버튼별 플레이북입니다. 처음에는 순서대로 따라
하십시오. 각 단계는 정확한 경로, 정확한 버튼, 성공 시 보이는
화면을 명시합니다. 아래 2–16절은 각 단계를 더 깊이 다룹니다.

> **한 번의 명령으로 실행 및 초기화.** 터미널에서 UI를 건드리지
> 않고 전체 부트스트랩을 수행할 수 있습니다:
>
> ```bash
> career-ops-ui setup      # 의존성 설치 → doctor → 서버 실행
> career-ops-ui init       # LLM 공급자 선택 + 해당 키 붙여넣기 (에코 숨김)
> career-ops-ui doctor     # 언제든 재검증 (종료 코드 0 ⇔ 필수 항목 모두 녹색)
> career-ops-ui run        # http://127.0.0.1:4317 에서 서버만 실행
> career-ops-ui open       # 브라우저의 대시보드 탭을 열고 맨 앞으로 가져오기
> ```
>
> `setup`/`run` 이후 브라우저 탭은 자동으로 열리고 **맨 앞으로
> 가져와집니다** (v1.43.0). `career-ops-ui open`은 필요할 때 동일하게
> 동작하므로 대시보드 탭을 찾아 헤맬 필요가 없습니다. `NO_OPEN=1`은
> 헤드리스/CI 시작 시 자동 열기를 비활성화합니다.
>
> `setup`은 전체 체인을 스스로 실행합니다. `init`은 `#/config`의
> API 키 탭이 사용하는 것과 동일한 검증된 경로를 통해 상위
> `career-ops/.env`에 키를 기록하고, 라이브 evaluate / deep / mode /
> 자동 파이프라인 경로가 따르는 `LLM_PROVIDER`
> (`auto` | `claude` | `gemini`)를 설정합니다. CI 형식:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`.
> UI가 더 편하신가요? 아래 단계를 계속 진행하세요.

### A. 설정 (한 번만 수행, 약 5분)

**career-ops-ui는 `career-ops/web-ui/`에 위치해야 합니다**(상위 career-ops 프로젝트 내부에 중첩). `../`를 통해 부모 폴더의 `cv.md`, `config/`, `data/`를 읽으며 단독으로는 작동하지 않습니다. `git pull` 후 `career-ops-ui init`을 찾을 수 없는 경우, `cd career-ops/web-ui && npm install && npx career-ops-ui init`을 실행하세요.

**1단계 — `http://127.0.0.1:4317`에서 앱을 엽니다.** 실행 중이
아니라면 저장소 루트에서 터미널로 `bash bin/start.sh`를
실행하십시오. Dashboard(`#/dashboard`)가 로드됩니다.

**2단계 — 왼쪽 사이드바의 `❤ Health`를 클릭합니다.** 필수 체크는
모두 초록이어야 합니다:

- `cv.md`, `config/profile.yml`, `portals.yml` 존재
- API 키 설정 (`ANTHROPIC_API_KEY` 또는 `GEMINI_API_KEY` 중 최소
  하나)
- Playwright 설치 (Generate PDF를 사용할 때만 필수)

빨간 항목이 있으면 페이지가 어떤 파일 또는 환경 변수를 고쳐야 하는지
정확히 알려줍니다. Health가 초록이 되기 전에는 진행하지 마십시오.

**3단계 — 사이드바의 `⚒ App settings`를 클릭합니다.** **API keys
& runtime** 탭이 열립니다.
- `ANTHROPIC_API_KEY`(선호 — 장문 채점 품질이 더 좋습니다) 또는
  `GEMINI_API_KEY`를 붙여넣으십시오. 키는
  <https://console.anthropic.com/settings/keys> 또는
  <https://aistudio.google.com/apikey>에서 발급받을 수 있습니다.
- **💾 Save**를 클릭하십시오. 그 다음 **▶ Test Anthropic** (또는
  Gemini)을 클릭하면 작은 왕복 호출이 키가 정상임을 확인합니다.

**4단계 — 같은 페이지의 `Profile` 탭으로 전환합니다.** 여기는
`config/profile.yml`의 직접 YAML 에디터입니다. 최소한 다음을
편집하십시오:
- `candidate.full_name` — 자리표시자("Jane Smith")를 실제
  이름으로 교체.
- `candidate.email`, `linkedin`, `github` — 커버 레터에 사용.
- `target.roles` — 지원할 직무 명칭.
- `target.comp_total_min_usd` — 최소 총 보상. 이 값 이하 오퍼는
  모든 평가의 D 섹션에서 빨강으로 표시됩니다.
- `target.archetypes` — 수용 가능한 커리어 패턴 (가장 영향이
  큰 단일 필드).

**💾 Save**를 클릭하십시오. 서버가 YAML을 검증하고 정식 헤더
`# Career-Ops Profile Configuration`를 찍어 넣습니다.

### B. CV (한 번만 수행, 약 10분)

**5단계 — 사이드바 `✎ CV`를 클릭합니다.** 두 열: 왼쪽은 에디터,
오른쪽은 라이브 미리보기.

**6단계 — 에디터를 채우는 방법 하나를 선택합니다:**
- **기존 이력서 업로드** — **📁 Upload CV**를 클릭하고
  `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md` 중
  아무 파일이나 선택. 서버가 pandoc 또는 pdftotext로 마크다운으로
  변환하고 XSS를 정화한 결과를 에디터에 채워줍니다. **변환
  결과를 검토**하십시오 — 특히 PDF는 레이아웃이 손실되기 쉽습니다.
- **마크다운 직접 붙여넣기** — 텍스트 영역이 마크다운 에디터이며,
  오른쪽 패널이 LLM(과 미래의 리크루터)이 보게 될 모습입니다.
- **톤 팁:** 한 불릿 = 지표가 있는 한 가지 성과. 1500단어 이내.
  순서: Summary, Experience, Projects, Education, Skills.

**7단계 — CV 페이지 오른쪽 상단의 `💾 Save`를 클릭합니다.**
서버가 정화하고 (`<script>` / `javascript:` / 인라인 핸들러 제거)
`cv.md`에 씁니다. 토스트: *"Saved"*.

**8단계 (선택) — `📄 Generate PDF`를 클릭합니다.** 부모에서
`generate-pdf.mjs`를 실행합니다 (Playwright 필요). 완료되면 **새 PDF가
브라우저에서 자동 다운로드**됩니다. 페이지 하단의 목록은 이전에
생성한 모든 파일을 유지합니다.

### C. 채용 공고 찾기 (스캔당 약 2분)

**9단계 — 사이드바 `🌐 Scan`을 클릭합니다.** `portals.yml`에
원하는 보드가 등록되어 있는지 확인하십시오 (이 도움말의 5절).
**🌐 Scan now** 버튼을 누르십시오. 스캐너가 Greenhouse / Ashby /
Lever / Workable / SmartRecruiters / Workday(영문 보드)와 hh.ru / Habr Career / Trudvsem / GetMatch / GeekJob(활성화된 경우의 러시아어 보드)를 순회하는 동안 SSE
라이브 로그가 흐릅니다.

**10단계 — 스캔이 끝나면 결과를 검토합니다.** 회사 태그를 클릭해
필터링하고, ↗ 아이콘을 클릭해 회사 채용 페이지를 새 탭에서
여십시오. 제목 필터를 통과한 모든 공고는 Pipeline에 큐잉됩니다.

### D. 오퍼 채점 (JD당 약 30초)

**11단계 — 사이드바 `Pipeline`을 클릭합니다.** 스캐너가 큐잉한
모든 URL이 보입니다. 항목을 클릭하면 인라인으로 JD가
미리보입니다.

**12단계 — JD 옆의 `▶ Evaluate`를 클릭합니다.** `#/evaluate`로
이동합니다. API 키가 설정되어 있으면 실시간 실행, 없으면 직접
LLM에 붙여넣을 프롬프트가 제공됩니다. 실시간 모드는 CV 대비
**0–5 점수**를 A–G 섹션(Role / Company / Compensation / Risk /
Stretch / Cultural fit / Verdict)에 걸쳐 생성합니다. 저장본은
`reports/<date>-<slug>.md`에 떨어집니다.

**13단계 — 사이드바 `Reports`를 클릭**하고 최신 평가를
검토하십시오. `comp_total_min_usd` 이하인 항목은 D 섹션에서
빨강으로 표시됩니다. `Verdict: pursue`가 있는 항목이 여러분의
쇼트리스트입니다.

### E. 결정 및 쇼트리스트 회사 심층 리서치 (약 3분)

**14단계 — 추진할 공고를 선택합니다. 사이드바 `Deep research`를
클릭하십시오.** 회사 이름과 롤을 입력하십시오. 모델이 7개 섹션의
회사 브리프(미션, 최근 뉴스, 기술 스택, 채용 신호, 보상 벤치마크,
리스크, 권장 어프로치)를 생성합니다. 저장본은
`interview-prep/<company>-<role>.md`에 떨어집니다.

### F. 지원 (지원당 약 5분)

**15단계 — 사이드바 `Apply checklist`를 클릭합니다.** 공고 URL과
JD를 붙여넣으십시오. 헬퍼가 단계별 제출 체크리스트를 생성합니다:
- 맞춤형 커버 레터 초안 (`cv.md` + `profile.yml` 사용).
- JD에서 따라가야 할 구체적 키워드.
- 첨부할 파일 (CV PDF — 8단계 참조).
- 어디에 지원할지 (집계 사이트 리디렉트가 아닌 정식 채용 URL).
- 알림: **절대 자동 제출 금지** — 최종 검토와 제출은 항상
  수동입니다.

**16단계 — 채용 페이지를 새 탭에서 엽니다.** apply 체크리스트를
할 일 목록으로 사용하십시오. 회사의 실제 폼을 통해 제출하고,
8단계에서 만든 PDF를 첨부하십시오.

**17단계 — 실제 사람에게 메시지를 보냅니다.** 사이드바에서
**Outreach** 모드 (`#/contacto`)를 여십시오. 모델이 14단계에서
만든 회사 브리프에 맞춰 짧은 LinkedIn / 이메일 메시지를
작성합니다. 오프닝(심층 리서치 브리프의 구체적인 디테일 하나)은
직접 개인화하십시오. 전송합니다.

### G. 추적 및 팔로업 (지속)

**18단계 — 사이드바 `Tracker`를 클릭**하고 지원에 대한 행을
추가하십시오: 회사, 롤, 점수, 상태 `Applied`, 보고서 링크, 심층
리서치 브리프 링크. 날짜는 자동 입력됩니다.

**19단계 — 일주일 후: `Follow-up` 모드(`#/followup`)를 엽니다.**
원래 지원을 참조한 정중한 체크인 이메일을 초안으로 작성합니다.
전송하고 tracker 상태를 `Followed up`으로 갱신하십시오.

**20단계 — 인터뷰 초대를 받으면 `Interview prep` 모드
(`#/interview-prep`)를 실행합니다.** 특정 회사와 단계(system
design / behavioral / coding)에 맞는 타깃 준비물을 생성합니다.
심층 리서치 브리프에서 자동으로 가져옵니다.

**21단계 — 오퍼를 받았다면? Tracker 상태를 `Offer`로 갱신**하고
평가 보고서의 comp 섹션을 다시 살펴보십시오 — 최소 수용 금액이
거기에 있습니다.

### 한 줄 요약 — 사이드바 순서가 곧 워크플로

`Health → App settings → Profile → CV → Scan → Pipeline →
Evaluate → Reports → Deep research → Apply checklist → Outreach
→ Tracker → Follow-up → Interview prep → Activity log`

이상입니다. 21단계, 버튼별, 0에서 오퍼까지.

### 원클릭 Auto-pipeline (`#/auto`) — 21단계 단축

특정 공고만 빠르게 평가하려면 수동 절차를 건너뛰세요. **사이드바 → ✨ Auto-pipeline**(또는 대시보드 ✨ 버튼): URL 붙여넣고 **Enter** 또는 **▶ 전체 파이프라인 실행** — 서버가 전체 체인을 한 번에 관찰 가능하게 실행:

1. **URL 검증** — SSRF 안전 검사(`isValidJobUrl`).
2. **JD 가져오기** — `safeGet`(DNS 고정)로 다운로드 + 정제.
3. **CV 대조 평가** — Anthropic → Gemini → 키 없으면 수동 프롬프트.
4. **리포트 저장** — `reports/<slug>.md` 작성(점수 + 신뢰도).
5. **트래커 추가** — `data/applications.md`에 행 추가.

피드백은 세로 **스테퍼**(순서 목록, 활성 단계에 `aria-current`, 스크린리더 라이브 영역). 완료 시 카드가 리포트(**리포트 보기 · N/5**)와 **트래커**로 딥링크. 실패 단계는 표시되고 버튼이 재활성화되어 새로고침 없이 재시도. **API 키 없음?** 수동 모드: 3–5단계 접힘 + 복사용 프롬프트. 링크 가능: `#/auto?url=<enc>&go=1` 자동 시작.
> **CLI (v1.38.0).** 한 명령이 전체 체인: `career-ops-ui setup`. 동사: `career-ops-ui doctor`(env/키/툴링 점검 — Health와 동일 엔진; 필수 실패 시 exit 1), `career-ops-ui run`, `career-ops-ui init`(공급자+키 마법사, v1.39.0).
> **공급자 (v1.39.0).** API-keys 탭에 `LLM_PROVIDER` select(`auto`=Anthropic→Gemini · `claude` · `gemini`) 및 `OPENAI_API_KEY` 필드(Codex/OpenCode CLI 측) 추가. `career-ops-ui init`이 대화형 마법사.
>
> **공급자 (v1.57.0).** 헤드리스 라이브 평가가 **Anthropic → Gemini → OpenAI → Qwen → OpenRouter**(`auto` 순서; `LLM_PROVIDER`로 고정)로 확장. **OpenRouter** — `OPENROUTER_API_KEY` 하나로 300+ 모델 접근; `OPENROUTER_MODEL` 드롭다운은 OpenRouter 라이브 카탈로그를 로드(서버 측 프록시, 오프라인 선별 폴백). 또한 수정: 줄바꿈/공백이 붙어 붙여넣은 키를 검증 전에 트림하므로 `/#/config`에서 더 이상 어떤 공급자에도 「validation failed」가 표시되지 않음.



---

## 2. 앱 설정 및 API 키 (`#/config`)

> **v1.55 → v1.56 새 기능.** LLM 키가 없으면 모든 화면의 빨간 배너가 ⚡ 라이브 실행이 수동 프롬프트 모드임을 알리고 여기로 연결합니다; 키가 있으면 활성 제공자를 표시하는 조용한 칩이 됩니다. 모든 ⚡ 라이브 실행 버튼(`#/auto`, `#/evaluate`, `#/deep`, 모드) 앞에 정직한 예상 비용이 표시됩니다(예: "예상 비용: OpenAI gpt-5-codex · ~$0.04/eval", 수동 모드는 API 비용 없음). `#/scan`은 보조 필터를 **고급 필터** 디스클로저 뒤로, `#/tracker`는 클릭형 퍼널 칩 + 선택적 서버 페이지네이션, `#/pipeline`은 1000행 초과 시 가상화.

두 탭:

1. **API keys & runtime** — 부모 프로젝트의 `.env`를 브라우저에서
   편집합니다 (career-ops Node 스크립트가 시작 시 읽는 동일 파일).
   이 탭은 공급자별 모델 선택기도 제공합니다 — `ANTHROPIC_MODEL`·
   `GEMINI_MODEL` 옆에 `OPENAI_MODEL`(OpenAI/Codex).
2. **Profile** — `config/profile.yml`의 직접 YAML 에디터. 저장
   시 정식 헤더 `# Career-Ops Profile Configuration`가 찍힙니다.

어느 탭에서 저장하든 즉시 반영됩니다 — 서버 재시작 불필요.

**LLM 공급자 설정 (단계별).** web UI 의 ⚡ 라이브 평가는 *헤드리스*로 실행되며 하나의 API 키를 사용합니다. "OR" 로 동작합니다 — 이 중 **아무거나 하나만** 설정하면 바로 동작하며, 여러 개를 설정하면 `auto` 가 다음 순서로 선호합니다: Anthropic → Gemini → OpenAI → Qwen. (career-ops 자체는 CLI 비종속입니다 — Claude Code, Codex, Gemini, OpenCode, Qwen, Copilot 또는 Kimi 안에서도 실행하며, 그것은 이 헤드리스 키와는 별개입니다.)

1. `#/config` → **API keys & runtime** 탭을 엽니다.
2. **`LLM_PROVIDER`**에서 공급자를 선택합니다: `auto`(설정된 키를 사용), 또는 `claude` / `gemini` / `openai` / `qwen` 로 강제 지정.
3. 선택한 공급자의 키 + 모델을 채웁니다:
   - **Anthropic** — `ANTHROPIC_API_KEY`(console.anthropic.com) 설정, 선택적으로 `ANTHROPIC_MODEL`(기본값 `claude-sonnet-4-6`).
   - **Gemini** — `GEMINI_API_KEY`(aistudio.google.com/apikey) 설정, 선택적으로 `GEMINI_MODEL`(기본값 `gemini-2.0-flash`).
   - **OpenAI** — `OPENAI_API_KEY`(platform.openai.com) 설정, 선택적으로 `OPENAI_MODEL`(기본값 `gpt-5-codex`).
   - **Qwen** — `QWEN_API_KEY`(Alibaba Model Studio / DashScope, dashscope.console.aliyun.com) 설정, 선택적으로 `QWEN_MODEL`(기본값 `qwen-max`). 중국 본토 엔드포인트는 raw `.env` 에서 `QWEN_BASE_URL` 을 설정합니다.
4. **Save** 를 클릭합니다. 키는 부모 프로젝트의 `.env` 에 기록됩니다; 변경은 즉시 반영됩니다 — 서버 재시작 불필요.
5. `#/evaluate` 에서 검증합니다: 채용 URL/설명을 붙여넣고 **⚡ Run live** 를 누릅니다. 결과 헤더에 어떤 공급자가 실행됐는지(`anthropic` / `gemini` / `openai` / `qwen`) 표시됩니다. 어디에도 키가 설정되지 않으면 → 복사-붙여넣기 수동 프롬프트가 대신 제공됩니다.

비밀 값은 저장 후 마스킹되며 결코 로깅되지 않습니다. 모델 id 필드(`*_MODEL`)는 비밀이 아닙니다.

### Profile 탭

> **v1.32.0 — 항목별 폼.** Profile 탭은 더 이상 원본 YAML textarea가 아니라 **지원자 / 내러티브 / 보상** 접이식 섹션 폼입니다. 저장 시 모델링된 14개 스칼라 경로만 전송하며, 서버가 `config/profile.yml`에 **병합**하므로 `archetypes`·`proof_points`·커스텀 키가 **그대로 보존**됩니다. 트레이드오프: 항목 저장은 YAML을 재직렬화하여 **`#` 주석이 사라집니다** — 보존하거나 중첩 배열을 편집하려면 탭 하단의 **Advanced: edit raw YAML** 디스클로저를 사용하세요.
> **v1.35.0 — 배열 에디터.** **Target roles**·**Superpowers**(문자열 목록), **Archetypes**(name/level/fit), **Proof points**(name/url/hero-metric)용 add/remove 에디터 추가. 동일한 merge-not-replace 보장; 목록을 비우면 키가 깔끔히 제거됩니다.
> **v1.54.3 — Modes 탭 구조화 폼.** `modes/_profile.md`는 더 이상 섹션별 원본 markdown 에디터가 아니라, 문서화된 스키마에서 파생된 필드 폼입니다. 목록형 섹션 — **Target Roles / Adaptive Framing / Comp Targets** — 은 반복 가능한 라인 항목 입력(행 추가/삭제)으로, 산문 섹션 — **Exit Narrative / Location Policy** — 은 레이블된 textarea로 렌더링되며, 알 수 없거나 비목록 섹션은 레이블된 verbatim textarea로 폴백합니다. 저장은 **여전히 섹션 단위로 병합** — 프리앰블·미변경 섹션·커스텀 섹션이 바이트 단위로 보존됩니다. 전체 파일 편집(섹션 추가/삭제·프리앰블 편집)용 *Advanced: raw markdown* 디스클로저는 그대로 유지됩니다.




- 텍스트 영역은 현재 `config/profile.yml`을 그대로 보여줍니다.
- 편집 후 **💾 Save**를 클릭하십시오. 서버가 YAML을 검증하고
  (매핑이어야 하고 `candidate`를 포함해야 함) 파일에 씁니다.
- 누락된 경우 `# Career-Ops Profile Configuration` 헤더가
  추가됩니다.
- `#/profile`의 읽기 전용 요약이 시각적 동반자입니다.

### 인식되는 키

| 키 | 역할 | 발급처 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic SDK 실시간 호출 활성화. Anthropic + Gemini 모두 설정 시 선호 — JD 채점과 심층 리서치에서 장문 구조화 출력 품질이 더 우수합니다. | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | 기본 `claude-sonnet-4-6` 재정의. 어려운 추론에는 `claude-opus-4-7`, 저렴·빠르게는 `claude-haiku-4-5-20251001` 시도. | — |
| `GEMINI_API_KEY` | Anthropic 키가 없을 때의 대안. `gemini-eval.mjs`가 `oferta` 모드에 사용. 저볼륨이면 무료 티어로 충분. | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | 기본 Gemini 모델 재정의. | — |
| `(서버가 기본 UA 사용)` | 러시아 외부에서 `hh.ru` 스캔 시 필요 (단순 User-Agent에는 API가 403 반환). <https://dev.hh.ru/admin>에서 앱 등록 후 그 UA 문자열 사용. | dev.hh.ru |
| `PORT` | Express 바인드 포트. 기본 4317. | — |
| `HOST` | 바인드 주소. 기본 `127.0.0.1`. `0.0.0.0` 설정 시 LAN에 UI 노출 — **아직 인증 게이트 없음**. Production-readiness 문서 참조. | — |

### 동작

- **Read** (`GET /api/config`)는 인식되는 모든 키를 반환합니다.
  비밀 키 (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`)는 **마스킹**됩니다 —
  `sk-ant•••••••a1b2` 형태로만 보이고 원본은 노출되지 않습니다.
- **Save** (`POST /api/config`)는 각 값을 검증하고
  `<parent>/.env`에 쓴 다음 실행 중인 프로세스에 즉시 적용합니다.
  재시작 불필요.
- **빈 값은 키 삭제**입니다. 러시아 IP / VPN을 비활성화할 때
  유용합니다.

### 스모크 테스트 버튼

저장 후 **▶ Test Anthropic** 또는 **▶ Test Gemini**를 클릭하면
작은 프롬프트(출력 ≤256 토큰)를 호출합니다. 비용은 거의 없으며
키가 정상 연결되었는지 확인합니다. 성공 시 약 200자 샘플을
반환합니다.

---

## 3. 프로필 (`#/profile` — `#/settings`로도 접근 가능)

`config/profile.yml`의 읽기 전용 카드 요약 뷰입니다. **편집은**
**App settings → Profile 탭** (`#/config` → Profile)에서
수행하십시오. 저장은 동일한 파일로 떨어지며, 이 페이지는 새로
고칠 때 다시 파싱합니다.

가장 중요한 필드:

- `candidate.full_name` — 모든 프롬프트에 사용됩니다. **실 운영
  스캔 전에 템플릿 `Jane Smith`를 반드시 교체**하지 않으면 생성된
  커버 레터가 자리표시자 이름으로 발송됩니다.
- `candidate.email`, `linkedin`, `github` — 커버 레터 생성과
  apply 체크리스트에서 참조.
- `target.roles` — 수용 직무 명칭. 스캐너의 양성 필터가
  (`portals.yml::title_filter`를 통해) 암묵적으로 사용합니다.
- `target.comp_total_min_usd` — 최소 총 보상. 모든 평가의 D
  섹션이 이 값 이하 오퍼를 표시합니다.
- `target.archetypes` — *가장 중요한 필드*. 수용 가능한 커리어
  패턴(예: `Tech-Lead-Backend`, `Founding-Engineer`,
  `Data-Platform`). 모든 JD는 이들에 매칭되고 가장 잘 맞는
  archetype이 보고서 헤더에 표시됩니다.

Health 페이지는 `full_name`이 알려진 자리표시자 이름과 일치하는
한 실패하는 **Profile customized** 체크를 노출합니다.

---

## 4. 이력서 (`#/cv`)

모든 평가, 심층 리서치, 커버 레터의 단일 진실 공급원. 부모
프로젝트 루트의 `cv.md`에 존재합니다.

### 편집 옵션

- **직접 붙여넣기** — 왼쪽 텍스트 영역이 마크다운 에디터입니다.
  오른쪽 패널은 LLM(과 미래의 리크루터)이 볼 모습을 미러링합니다.
- **📁 Upload CV** — 다음 형식 중 로컬 파일을 선택하면 서버가
  마크다운으로 변환합니다:
  - **텍스트 형식** — `.md`, `.markdown`, `.txt`, `.html`,
    `.htm`은 그대로 통과 (HTML은 pandoc → GFM markdown).
  - **오피스 형식** — `.docx`, `.doc`, `.odt`, `.rtf`는
    **pandoc**으로 변환 (macOS: `brew install pandoc`, Linux:
    `apt install pandoc`).
  - **PDF** — `.pdf`는 Poppler의 **pdftotext**로 추출
    (`brew install poppler` / `apt install poppler-utils`).
  - 변환된 마크다운이 에디터에 채워집니다. **💾 Save**로
    영속화하십시오. 결과는 정화됩니다 (붙여넣기와 동일한 XSS
    제거).
  - 하드 캡: 업로드당 **10 MB**. 더 큰 파일 → 413.
- **LinkedIn에서** — 가장 쉬운 경로: 부모 프로젝트에서 Claude
  Code를 열고 `/career-ops`를 실행, LinkedIn URL을 붙여넣고
  `extract my CV from this and write it to cv.md`라고
  요청하십시오.

### 정화되는 항목

서버 측에서 `/api/cv`로의 모든 PUT은 `stripDangerousMarkdown`을
통과합니다:

- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`,
  `<style>`, `<form>` 태그 — 완전히 제거.
- 인라인 이벤트 핸들러 (`onclick=`, `onerror=` 등) — 제거.
- `javascript:`, `vbscript:`, `data:text/html` URI 스킴 — 무력화.

위 중 하나라도 제거되면 응답에 `sanitized: true`가 포함되므로
원본에 위험한 내용이 있었는지 알 수 있습니다.

최대 바디 크기: 1 MB. 초과 시 413 반환.

### 기타 버튼

- **sync-check** — 부모 프로젝트에서 `cv-sync-check.mjs` 실행.
  불일치 항목(CV에는 있지만 `data/applications.md` archetypes에는
  없는 프로젝트 등)을 표시합니다.
- **📄 Generate PDF** — `generate-pdf.mjs`를 스트림합니다.
  출력은 `output/*.pdf`에 저장됩니다. Playwright 필요 (Health
  페이지에서 부모의 `node_modules`에 설치되었는지 확인 가능).
  생성이 완료되면 **가장 새** PDF가 기본 다운로드 폴더로 자동
  다운로드되며, 페이지의 목록은 이전에 생성한 모든 파일을
  유지합니다.

### 톤/포맷 팁

- 한 불릿 = 지표 한 개가 있는 한 가지 성과.
  *"p99 latency 38% 감소"*가 *"performance 개선"*보다 모든
  평가 루브릭에서 우수합니다.
- 섹션 순서: **Summary** (3–5줄), **Experience** (역연대순),
  **Projects** (최대 5개), **Education**, **Skills** (중복 제거,
  버즈워드 나열 금지).
- 1500단어 이내로. 채점 루브릭은 정보 밀도가 높은 텍스트를
  좋아하며, 산만한 CV는 노이즈로 감점됩니다.

---

## 5. 포털 및 소스 (`portals.yml`)

스캐너 설정은 부모 루트의 `portals.yml`에 있습니다. 세 섹션이
중요합니다. SPA의 세 섹션(아래)은
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
의 career-ops.org 정식 스키마와 1:1로 일치합니다.

> **단축 경로:** 이제 `#/portals` URL은 곧바로 **App settings**로
> 해석되며, (지역 소스가 구성된 경우) **Regional sources** 그룹으로
> 점프합니다 — 그래서 북마크했거나 직접 입력한 `#/portals` 링크가
> 더 이상 404가 나지 않습니다 (v1.42.0).

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

스캔된 공고는 제목이 **positive 키워드 중 하나 이상**을 포함하고
**negative 키워드 중 어느 것도** 포함하지 않을 때 통과합니다.
양쪽 모두 튜닝하십시오. 키워드는 대소문자 무시 부분 일치입니다.

`seniority_boost`는 세 번째 제목 필터 키입니다. 여기 나열된
키워드는 무엇도 걸러내지 않지만, 매칭된 공고를 결과에서 더 위로
밀어 올려 "Senior Backend Engineer"가 "Engineer"보다 위에
오도록 합니다. 기본값: `["Senior", "Staff", "Lead"]`. 타깃
직무가 어떻게 명명되는지에 맞춰 튜닝하십시오.

명확성을 위해 positive 키워드 3–5개로 시작하고 나중에
넓히십시오.

### `location_filter` (선택 — web-ui 1.33.0, parent #570)

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

스캔된 채용 공고를 **위치** 문자열(대소문자 구분 없는 부분 문자열)로 필터링하며, ATS 스윕과 지역 스윕 모두에 적용됩니다. 정식 career-ops `scan.mjs`와 동일한 의미:

- `location_filter` 없음 → 모든 위치 통과(기본값).
- 위치가 비어 있음/없음 → 통과(누락 데이터는 불이익 없음).
- `block` 일치 → **거부**(block이 allow보다 우선).
- `allow` 비어 있음 → 통과(block이 이미 거름).
- `allow` 비어 있지 않음 → **최소 한 개** 키워드와 일치해야 함.

`portals.yml`의 최상위 키(`title_filter`의 형제, `russian_portals` 하위 아님).

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

`search_queries`는 AI 기반 Option B 스캔(Claude Code / Codex
내부의 `/career-ops scan`)을 구동합니다. 인프로세스
`npm run scan` (공개 보드 API만 호출)에서는 실행되지 **않습니다**.
`tracked_companies`에 아직 없는 회사의 롤을 발견하고 싶을 때
사용하십시오. 항목을 유지하면서 실행하지 않으려면
`enabled: false`로 설정하십시오.

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

항목당 필수 필드: `name`과 `careers_url`. 선택: `api` (명시적
Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
엔드포인트), `enabled: true|false`로 항목을 삭제하지 않고
포함/제외 가능. ATS 스캐너는 URL 패턴
(`job-boards.greenhouse.io/<slug>` → Greenhouse 등)에서 ATS를
감지하고 각 회사의 공개 boards-api를 직접 호출합니다. 인식
가능한 ATS가 없는 회사는 건너뜁니다 (`/#/scan`의 **Active
Companies** 카드에서 회색 `○`로 표시).

### `rss` (RSS / Atom boards)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

RSS/Atom 피드를 게시하는 모든 채용 보드(LaraJobs, WeWorkRemotely, RemoteOK, golangprojects 등)에 `provider: rss` 와 `rss:`(또는 `feed_url:`) 키를 가진 항목을 추가하기만 하면 스캐너를 연결할 수 있습니다 — **코드 변경 불필요**. RSS 어댑터는 각 `<item>` 을 파싱하고(CDATA + HTML 엔티티, 제목/회사명 태그 제거) 채용 공고로 정규화한 뒤, ATS 소스와 동일한 `title_filter` / `location_filter` + 중복 제거 + 파이프라인 추가 흐름을 실행합니다. 이후 **RSS** 가 `#/scan` 필터 드롭다운에 선택 가능한 소스로 표시됩니다. (web-ui v1.62.x)


### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # 또는 하나만
  area: 113                 # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries`는 hh.ru와 Habr Career의 공고 제목에 대한 대소문자
무시 부분 일치입니다. **negative 리스트와의 중복에 주의**하십시오
— `"Senior PHP"`가 `queries`에 있는데 `"php"`가
`title_filter.negative`에 들어가면 스캔이 0건을 반환하고
콘솔이 충돌을 경고합니다.


### 러시아 포털 구성 — 상세 설정 가이드

v1.29.0은 5개의 러시아어 어댑터를 제공합니다. 두 개는 기본 UA 이상의 설정이 필요 없습니다(`habr-career` HTML 스크레이프, `trudvsem` 정부 open-data API — 키 없음, IP 제한 없음). 두 개는 기술 포털의 HTML 스크레이프(`getmatch`, `geekjob` — 키 없음)이며, 하나는 hh.ru 표준 API로 러시아 외부 IP에서는 `HH_USER_AGENT` 환경 변수를 **App settings → API keys & runtime**에서 설정하지 않으면 403이 발생할 수 있습니다(또는 러시아 IP/VPN 사용).

#### 소스 목록

| 키 | 표시명 | 유형 | 인증 | 지역 제한 |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | `HH_USER_AGENT`(선택) | RU 외부 IP는 403 가능 |
| `habr` | Habr Career | HTML | 없음 | 없음 |
| `trudvsem` | Trudvsem | JSON API(open-data) | 없음 | 없음 |
| `getmatch` | GetMatch | HTML | 없음 | 없음 |
| `geekjob` | GeekJob | HTML | 없음 | 없음 |

#### 1단계 — `portals.yml` 열기

파일은 부모 프로젝트 `career-ops/` 루트에 있습니다(`web-ui/` 안이 아님). 아직 없다면 부모 프로젝트의 템플릿을 복사하세요:

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### 2단계 — 5개 소스 활성화

`russian_portals` 블록을 추가/수정하여 스캔할 모든 소스를 나열합니다. 배열 순서는 무관 — 스캐너는 레지스트리 순서로 호출합니다.

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

#### 3단계 — 쿼리와 필터 튜닝

`queries`는 스캐너가 각 소스에 대해 검색하는 문자열입니다. 각 쿼리는 소스마다 한 번씩 실행됩니다 — 4 쿼리 × 5 소스 = 1회 스캔당 20회 호출. 스캔 시간을 1분 이내로 유지하려면 리스트를 3–7개로 좁히세요. `area`는 hh.ru의 지역 코드(다른 소스는 무시). `per_page`는 쿼리당 반환되는 채용 수 상한. `only_remote: true`는 어댑터 레벨에서 리모트만 필터(결과 테이블에도 별도 Remote 칩 있음).

#### 흔한 함정

**Negative 리스트 충돌.** 쿼리의 단어(`"php"`, `"senior"`)가 `title_filter.negative`에도 있으면 모든 결과가 사용자 앞에서 필터링됩니다. 스캔 시 스캐너가 stderr 경고를 출력합니다 — `⚠ config: query "Senior PHP" contains "php" which is in the negative list` 라인을 찾으세요. 충돌하는 단어를 `negative`에서 제거해 해결합니다:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### 일시적으로 소스 비활성화

데이터를 삭제하지 않고 소스를 비활성화하려면 `sources`에서 그 키만 제거하세요:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### 설정 확인

`portals.yml` 저장 후:

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

### CLI 부트스트랩 흐름 ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

부모 루트에서 한 번 실행하는 career-ops 정식 설정:

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

이것이 전체 부트스트랩입니다. 세 섹션(`title_filter`,
`tracked_companies`, `search_queries`, 선택적 `russian_portals`)을
편집하고 저장하면 스캔할 준비가 끝납니다.

### SPA 부트스트랩 동작

최초 실행 시 서버는 `portals.yml`에 `russian_portals:` 블록이
없으면 문서화된 형태로 덧붙입니다 — 멱등적입니다 (두 번째 부팅은
no-op. 리터럴 `russian_portals:` 라인이 이미 있기 때문). 영문
섹션은 자동 주입되지 **않습니다**. 위의 정식 부트스트랩대로
`templates/portals.example.yml`을 복사해서 얻으십시오.

---

## 6. 상태 (`#/health`)

OK / OPTIONAL / FAIL 배지로 표시되는 모든 설정 게이트. "동작하지
않습니다" 이슈를 등록하기 전에 먼저 읽으십시오.

### 필수 체크 (없으면 시스템 동작 불가)

- `Node version` ≥ 18 — 서버가 네이티브 `fetch`와 `node:test`를
  사용합니다.
- `Project root` — `CAREER_OPS_ROOT`(환경 변수 또는 자동 감지)가
  존재합니다.
- `cv.md`, `config/profile.yml`, `portals.yml`,
  `data/applications.md`, `data/pipeline.md`, `modes/oferta.md`.

### 선택 체크 (경고만)

- `Profile customized` — `candidate.full_name`이 템플릿
  자리표시자가 아님.
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — `.env`에 설정됨.
- `(서버가 기본 UA 사용)` — 러시아 외부에서 hh.ru 스캔 시에만
  중요.
- `Playwright (parent node_modules)` — PDF 생성과
  `check-liveness.mjs`에 필수. 설치:
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`.
- `Parent project dependencies` — 누락 시
  `cd $CAREER_OPS_ROOT && npm install`.
- `data/`, `reports/`, `output/`, `jds/` 디렉터리 — 첫 쓰기 시
  자동 생성.

서버가 loopback 외부에 노출되면 (`HOST=0.0.0.0`) 절대 경로와 정확한
Node 버전은 응답에서 `"hidden"`으로 대체되어, 호기심 많은 이웃이
설치 환경을 핑거프린팅할 수 없습니다.

### 실행 버튼

- **▶ Doctor**는 `node doctor.mjs`를 실행하고 모달에 출력 표시.
- **▶ Verify pipeline**은 `node verify-pipeline.mjs` 실행.

---

## 7. 검색 (`#/scan`)

스캐너는 활성화된 모든 보드를 크롤링하고 이력과 중복 제거한 다음
hits를 `data/last-scan.json`과 `data/pipeline.md`에 기록합니다.

### 원클릭 스캔 (SPA)

**🌐 Scan**은 활성화된 모든 소스를 한 번에 실행합니다:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
  (ATS 스윕) — 인식 가능한 ATS URL을 가진 `tracked_companies`의
  모든 회사.
- hh.ru API + Habr Career + Trudvsem + GetMatch + GeekJob — `russian_portals`의 모든 쿼리.

**한 번의 클릭으로 두 단계 (v1.29.2).** 단일 🌐 Scan 버튼이 ATS 스윕과 지역 스윕을 모두 하나의 SSE 스트림으로 실행합니다. 로그에는 두 개의 단계 헤더가 순서대로 나타납니다:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — EN ATS 보드.
2. `▶ Regional scan (hh.ru + Habr Career)` — 레지스트리의 5개 RU 소스.

각 단계는 `✓ done · NEW=N` 요약으로 끝납니다. ATS 단계만 보인다면 stand가 v1.29.2 이전 빌드입니다 — 업그레이드하세요. v1.29.2 이전에는 SSE 클라이언트가 첫 `done`에서 닫혀 지역 단계가 조용히 누락되었습니다.

스캔이 진행되는 동안 SSE 라이브 로그가 오른쪽 패널에 흐릅니다.
중단하려면 **Stop**을 클릭하거나 페이지에서 나가면 됩니다. 서버는
진행 중인 HTTPS 요청을 `AbortController`로 취소합니다.

### 결과 필터링

로그 아래에서 결과 테이블이 `data/last-scan.json`의 행을
렌더링합니다.

필터:

- **자유 텍스트** — 제목/회사에 대한 부분 문자열 일치.
- **Source** 드롭다운 — Ashby / GeekJob / Greenhouse / GetMatch / Habr Career / hh.ru / Lever / SmartRecruiters / Trudvsem / Workable / Workday.
- **Remote / Hybrid / Onsite** 드롭다운.
- **스택 칩** (PHP / Go / Backend / Senior / …) — 각 행에 대해
  `Skills.detectTech`와 `Skills.detectLevel`이 자동 감지합니다.
  다중 선택은 교집합 — `PHP + Senior` 선택 시 두 가지 모두 가진
  행만 표시됩니다.
- **동적 칩** — 정적 스택 칩 아래에 제목의 대문자 토큰 중 빈도
  상위 25개를 보여주어, 백엔드 엔지니어 어휘에 갇히지 않고
  실제로 스캔하는 롤(마케팅, 디자인, 재무 등)에 UI가 적응하도록
  합니다.

### Active Companies 카드

`portals.yml`의 모든 회사를 스캔 상태와 함께 보여주는 접이식
카드:

- ✓ 초록 태그 — 직접 API 지원 (Greenhouse / Ashby / Lever /
  Workable / SmartRecruiters / Workday).
- ○ 회색 태그 — 웹 검색 프롬프트 폴백 (API 매칭 없음).

**회사 이름 클릭** → 위 결과 필터에 그 이름이 채워집니다.
**↗ 아이콘 클릭** → 회사의 `careers_url`을 새 탭에서 엽니다.

### CLI 스캔 흐름 ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

CLI 쪽에서 스캔하는 두 가지 방법 (둘 다 SPA가 읽는 동일한
`data/pipeline.md`에 URL을 적재):

**옵션 A — 직접 스크립트 (~30초, AI 토큰 0):**

```bash
npm run scan                          # 모든 Greenhouse/Ashby/Lever 보드
npm run scan -- --dry-run             # 영속화 없이 미리보기
npm run scan -- --company Anthropic   # 하나의 tracked company로 좁히기
```

Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
(인식 가능한 ATS URL)에서만 동작합니다. 공개 boards API를 직접
호출하므로 AI 토큰을 소비하지 않습니다.

**옵션 B — AI 기반 브라우저 스캔:**

```
/career-ops scan
```

Claude Code / Codex / Cursor / Gemini CLI 내부에서. 모델 토큰을
사용합니다. 각 `tracked_companies` 페이지를 직접 방문하며 API가
없는 보드(채용 페이지, 커스텀 ATS, 지역 포털)도 발견할 수
있습니다. 느리지만 더 넓습니다. 채용 중인 것이 분명한 타깃에서
ATS 스윕이 아무것도 반환하지 않을 때 유용합니다.

**출력 (양쪽 모두)** — 새 JD URL이 `data/pipeline.md`에
append되고, 방문한 모든 URL이 `data/scan-history.tsv`에
로그됩니다(미래의 모든 스캔에 걸친 중복 제거). 요약 출력: 스캔된
회사 수 · 발견된 잡 수 · 제목으로 필터된 수 · 건너뛴 중복 수 ·
추가된 새 오퍼 수.

**Score별 액션 임계값** (`/career-ops pipeline`이 새 URL을 배치
채점한 후 적용):

| Score | 권장 다음 단계 |
|---|---|
| **≥ 4.5** | `/career-ops apply` — 적합도 높음. 즉시 지원 |
| **4.0 – 4.4** | 지원 또는 `/career-ops contacto`로 warm intro |
| **3.5 – 3.9** | `/career-ops deep` — 먼저 리서치 |
| **< 3.5** | 특별한 개인 사유 없는 한 건너뜀 |

SPA의 `#/dashboard`와 `#/tracker`는 4.0 이상 모든 행을 강조하여,
어떤 것도 재실행하지 않고 다음 액션을 고를 수 있게 합니다.

### 후속 명령

채점 후 정식 후속 명령:

- `/career-ops apply` — 맞춤형 답변으로 지원서 작성.
- `/career-ops contacto` — LinkedIn / 이메일 outreach 초안.
- `/career-ops deep` — 회사/롤 심층 리서치.
- `/career-ops tracker` — 파이프라인 상태 보기.

---
### hh.ru — 웹사이트에서 스크랩 (설정·프록시 불필요)

hh.ru는 공개 검색 웹사이트(`hh.ru/search/vacancy`)를 읽어 스캔합니다 — Habr Career와 동일하게 **어떤 IP에서도 키·프록시·설정 없이 작동합니다.** JSON API(`api.hh.ru`)는 의도적으로 사용하지 *않습니다*: 이제 IP나 User-Agent와 무관하게 모든 프로그램 클라이언트에 `403 forbidden`을 반환합니다(문서화된 API 오류가 아니라 엣지 안티봇 차단). 반면 웹사이트는 브라우저류 클라이언트에 전체 결과를 제공합니다. 따라서 hh.ru는 Habr·Trudvsem과 똑같이 동작합니다 — `russian_portals.sources`에 그대로 두고 스캔하면 됩니다.

## 8. 파이프라인 (`#/pipeline`)

평가 대기 URL의 inbox. `data/pipeline.md`에 존재합니다.

### URL 추가

세 가지 방법:

- 입력란에 URL을 입력/붙여넣고 **+ Add** 클릭.
- **Ctrl+K** (또는 **Cmd+K**)로 전역 검색에 포커스, `http(s)://…`
  링크를 붙여넣고 **Enter** — URL이 즉시 pipeline에 들어갑니다.
- Scan 실행 (위 참조) — 새 hits가 자동으로 pipeline에 들어갑니다.

모든 URL은 서버 측에서 `isValidJobUrl()`을 통과합니다. Loopback
(`localhost`, `127.0.0.1`), `file://`, `javascript:`, IP 리터럴,
템플릿 문자 (`<`, `>`, `"`)를 포함한 문자열은 모두 400.

### 서버 측 미리보기 패널

pipeline 행을 클릭하면 오른쪽에 미리보기가 로드됩니다. 대부분의
ATS 보드는 CORS 헤더를 보내지 않으므로 브라우저가 직접 가져올 수
없습니다. 서버가 요청을 프록시하고 `<script>` / `<style>` / HTML
태그를 제거한 다음 최대 8 KB의 평문을 반환합니다.

미리보기 프록시는 리디렉트를 수동으로 따라가며 **홉별 SSRF
검증**을 수행합니다 — 모든 `Location` 헤더가 다시 `isValidJobUrl()`을
통과하므로 적대적인 보드가 loopback / 사설 IP / `file://`로
바운스시킬 수 없습니다. 최대 3홉, 15초 타임아웃.

### 행 액션

- **▶** — URL이 미리 채워진 채로 `#/evaluate?url=…`로 이동.
- **✕** — `data/pipeline.md`에서 URL 제거.

### 오른쪽 상단 버튼

- **⚡ Evaluate first** — Evaluate 페이지에서 큐 첫 번째 URL을
  열어 채점 준비.
- **Scan** — 더 많은 URL이 필요하면 스캐너로 돌아가기.

---

## 9. 평가 (`#/evaluate`)

단일 Job Description을 `cv.md`와 `config/profile.yml`에 대해
채점합니다. `modes/oferta.md`에 따른 구조화된 A–G 평가와 0–5
점수를 반환합니다.

### 입력

JD를 텍스트 영역에 붙여넣거나, `#/pipeline`에서 `?url=<href>`로
이동합니다 — 페이지가 pipeline 미리보기와 동일한 SSRF-안전
프록시를 통해 URL을 가져와 텍스트 영역에 미리 채웁니다.

**💾 Save JD**를 클릭하면 JD가 감사 추적용으로
`jds/jd-<date>-<ts>.txt`에 영속화됩니다 (API 호출에서 `save:
true`도 동일 효과).

### 폴백 체인

1. **Anthropic** — `ANTHROPIC_API_KEY` 설정 시 선호. 서버는 프롬프트
   앞에 `<project_context>` 블록으로 `cv.md`, `config/profile.yml`,
   `modes/_shared.md`, `modes/oferta.md`를 묶습니다 (각 파일 16
   KB, 전체 프롬프트 200 KB 소프트 캡). 페이지로 grounded
   markdown을 직접 반환합니다.
2. **Gemini** — `GEMINI_API_KEY`만 설정된 경우. 서버가 JD를 임시
   파일로 두고 `gemini-eval.mjs`를 스폰합니다. 무료 티어 모델
   (`gemini-2.0-flash`)도 일상적 채점에 충분합니다.
3. **수동** — 키가 없을 때. 페이지가 Claude Code, ChatGPT 또는
   다른 LLM에 붙여넣을 수 있는 완성된 프롬프트를 반환합니다.

### 출력 섹션 (정식 career-ops.org A–F)

> **v1.15.0 정렬.** 블록 글자가 이제
> [정식 career-ops.org 스키마](https://career-ops.org/docs)와
> 일치합니다. v1.15 이전 보고서는 A–G(`C=Risks`, `F=Verdict`,
> `G=Legitimacy`)를 사용했으며 호환성을 위해 그대로 렌더링되지만,
> 새 보고서는 아래 정식 의미의 A–F를 발행합니다. Score와
> Legitimacy는 이제 보고서 헤더에 있습니다 (`score: 4.2/5`,
> `legitimacy: High|Medium|Low`).

A. **Role Summary** — 3불릿 요약 (리스크는 인라인으로 명시).
B. **CV Match** — 매칭된 상위 3개 스킬 + 누락된 상위 3개.
C. **Strategy** — 권장사항: 즉시 지원 / contacto 먼저 / deep
먼저 / skip. v1.15 이전엔 `Risks`였음.
D. **Compensation** — `target.comp_total_min_usd` (레거시) 또는
`compensation.target_range` (정식) 대비.
E. **Personalization** — 강조할 어프로치, archetype별 프레이밍,
커버 레터 / outreach에서 언급할 후크. v1.15 이전엔 `Application
Strategy`였음.
F. **STAR stories** — 롤에 맞춘 즉시 붙여넣기 가능한 1–3개의
S-T-A-R 블록. v1.15 이전엔 `Verdict` (원점수)였으며, score는 이제
`legitimacy`와 함께 보고서 헤더에 표시됩니다.

### 보고서 저장

**💾 Save report**를 클릭하거나 API 호출의 save 토글을 사용하면
마크다운이 `reports/<date>-<company>-<role>.md`에 영속화됩니다.
보고서의 파싱된 헤더(Score / Legitimacy / URL)는 **Reports**
페이지와 **Dashboard**에 나타납니다.

### 10개 이상 JD가 있을 때는 배치 평가

단일 JD라면 이 `#/evaluate` 페이지가 적절한 도구입니다.
pipeline에 10개 이상 URL이 큐잉되었다면 JD별 클릭은 비현실적이니
14절의 **Batch evaluate** 하위 절(부모에서 `./batch/batch-runner.sh`
실행)로 점프해서 밤새 돌리고, `#/reports` / `#/tracker`에서
결과를 확인하십시오. 전체 흐름:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

---

## 10. 보고서 (`#/reports`)

저장된 모든 평가를 탐색합니다. 카드에는 제목, 날짜, legitimacy
플래그, score (색상 코드: 초록 ≥ 4.0, 노랑 ≥ 3.0, 빨강 그 아래)가
표시됩니다.

카드를 클릭하면 전체 마크다운을 읽을 수 있습니다. 페이지네이션:
페이지당 12개, 하단에 컨트롤.

단일 보고서 뷰에는 다음도 있습니다:

- **← All reports** — 그리드로 돌아감.
- **🔗 Open JD** — 원본 채용 공고를 새 탭에서 엽니다.

---

## 11. 트래커 (`#/tracker`)

CRM. 지원당 한 행. `data/applications.md`에 GitHub-Flavored
Markdown 테이블로 존재합니다.

### 상태 흐름

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Rejected` / `Discarded` / `SKIP`.

상태 허용 목록은 서버 측에서 강제됩니다. `POST /api/tracker`에서
다른 값을 보내면 `Evaluated`로 기본 설정됩니다. 정식
`Evaluated → Applied` 전환은 `/career-ops apply` 마지막에
`Submitted.`를 확인할 때 자동입니다 (14절 참조).

### 컬럼 레이아웃

| 컬럼 | 설명 |
|---|---|
| `#` | 자동 번호, 영 패딩 (`001`, `002`, …). |
| `Date` | ISO 날짜 (`YYYY-MM-DD`). 기본 오늘. |
| `Company` | 자유 텍스트. **파이프 (`\|`)와 개행은 자동 이스케이프됩니다.** |
| `Role` | 동일. |
| `Score` | `N/5` 포맷 (예: `4.2/5`). |
| `Status` | 허용 목록 enum. |
| `PDF` | `generate-pdf.mjs`가 이 행에 대해 성공하면 ✅. |
| `Report` | 대응하는 `reports/*.md`로의 마크다운 링크. |
| `Notes` | 자유 텍스트, 200자 캡. |

### 필터

- **Status** 드롭다운.
- **Score** 드롭다운 — `≥ 4.0` (높음), `≥ 3.0` (중간),
  `< 3.0` (낮음).
- **Search** — 회사 + 롤에 대한 부분 문자열 일치.

모든 필터는 페이지네이터를 1페이지로 리셋합니다. 페이지당 25행.

### 유지보수 버튼

- **▶ Normalize**는 `normalize-statuses.mjs`를 실행 — 상태
  표기를 재정규화 (`applied` → `Applied`, `interview` →
  `Interview`).
- **▶ Dedup**은 `dedup-tracker.mjs`를 실행 — `(company, role)`
  기준 대소문자 무시 중복 제거.
- **▶ Merge**는 `merge-tracker.mjs`를 실행 —
  `batch/tracker-additions/*.tsv` (부모의 배치 흐름이 Apply
  헬퍼로 제출한 지원을 떨어뜨리는 곳)의 대기 항목을 가져옵니다.
  중복을 제거하고 처리된 파일을 `batch/tracker-additions/merged/`로
  아카이브합니다. 업스트림 배치 흐름은
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  를 참조하십시오.

### 행 추가

`POST /api/tracker` — 바디 `{ company, role, score?, status?,
url?, reportSlug?, notes?, date? }`. `(company, role)` 대소문자
무시로 중복 제거. UI에서는 Evaluate 페이지가 채점 성공 후 "Add to
tracker" 버튼을 제공합니다.

---

## 12. 심층 조사 (`#/deep`)

구조화된 회사 브리프 생성: 스냅샷, 엔지니어링 문화, 최근 뉴스,
Glassdoor 분위기, 인터뷰 프로세스, 협상 레버리지 포인트,
리크루터에게 물어볼 스마트한 질문 3가지.

### 입력

두 필드 — 회사 이름과 (선택) 롤. 구조를 형성하는 것은 모드
템플릿(`modes/deep.md`)입니다.

### 출력 경로

Evaluate와 동일한 폴백 체인:

1. **Anthropic 라이브** (선호) — `bundleProjectContext`가
   cv + profile + `_shared.md` + `deep.md`를 인라인. 출력:
   `interview-prep/<company>-<role>.md`에 저장되는 10–30 KB의
   grounded markdown.
2. **Gemini 라이브** — `gemini-eval.mjs` 호출. 동일 저장 경로.
3. **수동 프롬프트** — 페이지가 Claude Code (WebFetch + WebSearch가
   있어 실제 리서치 가능)에 줄 준비된 프롬프트를 건넵니다.

### 팁

- Anthropic `claude-sonnet-4-6`은 호출당 보통 1–3분에 약 13 KB의
  유용한 텍스트를 반환합니다.
- Anthropic SDK는 내장 웹 검색이 없습니다. 최신 뉴스 + Glassdoor
  분위기가 필요한 롤은 수동 프롬프트를 Claude Code에 붙여넣어
  WebFetch 툴을 사용하게 하십시오.
- 라이브 실행은 과금됩니다. Sonnet 4.6 심층 리서치 호출 한
  번에 약 $0.30–0.50.

---

## 13. 모드 프롬프트 (일곱 개 `/#/<mode>` 페이지)

일곱 개 프롬프트 빌더: **Project** 아이디어, **Training** 계획,
**Follow-up** 이메일, **Batch** 평가, **Outreach**(리크루터에게),
**Interview prep** 한 장 요약, **Patterns** 회고. 각각 특정
`modes/<slug>.md` 템플릿을 감쌉니다:

| 페이지 | Slug | 목적 |
|---|---|---|
| `#/project` | `project` | 타깃 롤에 맞춘 포트폴리오 프로젝트 |
| `#/training` | `training` | 스킬 갭 분석 → 커리큘럼 |
| `#/followup` | `followup` | 인터뷰 후 이메일 초안 |
| `#/batch` | `batch` | 다중 JD 배치 평가 프롬프트 |
| `#/contacto` | `contacto` | 리크루터/추천 outreach 메시지 |
| `#/interview-prep` | `interview-prep` | 특정 인터뷰 라운드 한 장 준비 |
| `#/patterns` | `patterns` | "어떤 패턴이 나를 성공시켰나?" 반성적 분석 |

### 공통 형태

각 페이지에 모드별 소형 폼, **▶ Generate prompt** 버튼(수동),
그리고 Anthropic 또는 Gemini 키가 있을 때 — 기본 액션으로 격상되는
**⚡ Run live** 버튼이 있습니다.

**▶ Generate prompt** 클릭은 폼 값을 `User-supplied context:`
블록에 JSON 직렬화한 다음 `modes/<slug>.md` 템플릿을 그대로
이어 붙인 조립된 프롬프트를 반환합니다. 선호하는 LLM에 복사해
붙여넣으십시오.

**⚡ Run live** 클릭은 동일 프롬프트를 Anthropic(또는 Gemini)에
보내며, `cv.md` + `profile.yml` + `_shared.md`는
`bundleProjectContext`로 인라인됩니다. 결과는 페이지에
렌더링되고, 복사 가능하며, `.md`로 다운로드할 수 있습니다.

이 일곱 페이지는 명시적 허용 목록입니다. 전용 라우트를 가진
모드(`oferta` → Evaluate, `deep` → Deep research)와 부모
프로젝트가 Claude Code 내부에서만 지원하는 모드(`apply`, `scan`,
`pipeline`, `tracker`, `pdf`, `latex`, `ofertas`,
`auto-pipeline`)는 의도적으로 이 UI에서 제외됩니다.

---

## 14. 지원 체크리스트 (`#/apply`)

지원을 결정한 다음 이 Apply 헬퍼 페이지가 실제 지원 단계용 제출
체크리스트를 생성합니다. 폼을 자동 채우지는 **않습니다** — 그
흐름은 부모 프로젝트에서 Playwright를 사용하는 Claude Code 내부의
`/career-ops apply`에 남아 있습니다.

### SPA 체크리스트 모드 (`#/apply`)

SPA의 체크리스트는 Playwright를 호출하지 않고 손으로 폼을 채우려는
사용자를 위한 것입니다. 다음을 다룹니다:

0. Claude Code에서 `/career-ops apply <url>`를 실행해 Playwright로
   폼을 읽기 (손으로 채울 거면 이 단계 생략).
1. 공고가 여전히 열려 있는지 확인 (`check-liveness.mjs`).
2. CV가 최신인지 확인 (`cv-sync-check.mjs`, 점수 ≥ 4.0이면 PDF).
3. `cv.md`의 STAR+R proof points로 커버 레터 / "Why us?" 답변
   맞춤화.
4. EEO / 스폰서십 / 시작일 질문은 진실되게 답변.
5. 제출 전에 채워진 답변을 `interview-prep/{company}-{role}.md`에
   저장.
6. **절대 자동 제출 금지** — 최종 버튼은 사람(여러분)이 클릭.
7. 제출 후: `data/applications.md`에 행 추가 (또는
   `batch/tracker-additions/`에 TSV 쓰기).

### 수동 채우기 vs Playwright 보조

실제 제출의 두 경로:

- **수동** — 일반 브라우저 탭에서 채용 페이지를 열고, 위 SPA
  체크리스트를 따르며, 답변을 복사/붙여넣기. Playwright 불필요.
  폼이 짧거나 Chromium이 설치되어 있지 않을 때 사용.
- **Playwright 보조** — Claude Code(부모 프로젝트)에서
  `/career-ops apply <company>` 실행. Playwright가 자체 브라우저를
  열고 모든 폼 필드를 읽으며 번호 매긴 초안 답변을 반환합니다.
  Submit은 여전히 여러분이 클릭. 폼이 길거나 동적일 때, 또는 어떤
  질문에 어떻게 답했는지 감사 추적이 필요할 때 사용.

### 전체 CLI apply 흐름 ([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**선결 조건:**

1. 먼저 `/career-ops pipeline`을 실행해서 JD가 `reports/`에 평가
   보고서를 갖도록 합니다. apply 명령은 기존 평가에 의존합니다.
   평가가 없다면 먼저 pipeline을 실행하십시오.
2. 보고서와 프로필이 로드된 상태.
3. **권장:** Playwright 설치
   (`npx playwright install chromium` — 아래 Playwright Setup
   참조). 누락 시 WebFetch로 폴백 (텍스트 전용 폼 미리보기, 클릭
   채우기 없음).

**번호 매긴 흐름** (정식 8단계):

1. **회사 이름과 함께 명령 실행:**

   ```
   /career-ops apply <company>
   ```

   예: `/career-ops apply Anthropic`. 인자 없이 실행하면 다음 턴에
   폼 스크린샷, 폼 텍스트 붙여넣기, 또는 지원 URL을 제공합니다.

2. **보고서 찾기.** 시스템이 `reports/`에서 매칭되는 평가
   (앞서 `/career-ops pipeline` 또는 `#/evaluate`로 만든 것)를
   찾습니다.

3. **폼 열기.** Playwright가 브라우저 창을 **자동으로** 띄웁니다 —
   직접 여는 것이 아닙니다.

4. **필드 읽기.** 시스템이 모든 폼 필드(레이블, 타입, 필수 여부,
   select의 옵션)를 읽고 파싱합니다.

5. **답변 생성.** career-ops가 프로필, proof points, 롤을 기반으로
   각 필드에 대한 맞춤형 응답을 만듭니다.

6. **번호 매긴 목록 반환.** 폼 레이아웃에 맞춰 답변이
   정렬됩니다 — 단순 필드(이름, 이메일)부터, 자유 텍스트(커버
   레터, "Why us?")는 마지막. 플래그 표시는 사람의 주의가 필요한
   것 — 급여 앵커, 누락된 이력서 디테일, 선택 질문 — 을 가리킵니다.

7. **수동 채우기.** 각 답변을 해당 필드에 복사/붙여넣습니다. 이
   단계는 수동이며 자동화되지 않습니다. 모든 답변을 먼저
   검토하십시오.

8. **사용자가 제출.** Submit은 여러분이 직접 클릭합니다.
   career-ops는 **절대로** Submit을 클릭하지 않습니다. 채팅에
   다음을 입력해 완료를 확인합니다:

   ```
   Submitted.
   ```

**`Submitted.` 시 자동 갱신:**

- `data/applications.md`에서 상태가 `Evaluated → Applied`로 전환.
- 채워진 답변이 추후 참조용으로 보고서 G 섹션에 영속화.

**Tracker로의 핸드오프:**

```
/career-ops tracker
```

롤 점수와 무관하게 전체 파이프라인 상태를 모니터링합니다.

### Batch evaluate ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

한 번에 채점할 JD가 10개 이상이라면 (SPA의 일대일 `#/evaluate`는
그 볼륨에 비현실적입니다) CLI의 배치 러너를 사용하십시오.

**입력 파일 — `batch/batch-input.tsv`** (탭 구분):

| 컬럼 | 목적 |
|---|---|
| `id` | 고유 순차 번호 |
| `url` | 전체 채용 공고 링크 |
| `source` | 출처 플랫폼 (LinkedIn, Greenhouse 등) |
| `notes` | 선택적 맥락 정보 |

행 예시:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**`./batch/batch-runner.sh` 플래그:**

- `--dry-run` — 평가 없이 대기 중인 오퍼 미리보기. TSV를 검증할
  때 항상 먼저 실행하십시오.
- `--parallel N` — N개 워커를 동시 실행 (1, 2, 3 권장).
- `--min-score X.X` — 임계값 미만 점수의 오퍼는 영속화 건너뜀.
  적합도 높은 롤의 보고서만 보관할 때 유용.
- `--retry-failed` — 이전 실행에서 오류 난 오퍼(네트워크 실패,
  레이트 리밋)만 재처리.
- `--max-retries N` — 실패한 오퍼를 최대 N번 재시도 (기본 2).
- `--model NAME` — `claude -p --model`에 전달되는 Claude 모델 (career-ops 1.8.0, #504). 미설정 = Claude Max 구독 기본 모델. 대량 배치에는 더 저렴한 모델 사용, 예: `claude-sonnet-4-6`. `#/batch`에서 **모델** 입력으로 노출 (web-ui 1.31.0).
- `--start-from N` — N 미만의 오퍼 ID 건너뛰기 (부분 처리된 배치 재개). `#/batch`에서 **시작 #** 입력으로 노출 (web-ui 1.31.0).

**표준 시퀀스:**

1. **편집** `batch/batch-input.tsv` — JD당 한 행.

2. **Dry-run** (먼저 권장):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **실행** — 순차 또는 병렬:

   ```bash
   ./batch/batch-runner.sh                       # 하나씩
   ./batch/batch-runner.sh --parallel 2          # 두 개 동시
   ./batch/batch-runner.sh --parallel 3          # 세 개 동시
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # 적합도 높은 것만 영속화
   ```

4. **실패 재시도** (네트워크 / 레이트 리밋):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **Reports**는 `reports/`에
   `{id}-{company}-{YYYY-MM-DD}.md` 형태로 저장됩니다. 요약 행이
   `batch/tracker-additions/`에 append됩니다.

6. **Tracker로 병합:**

   ```bash
   node merge-tracker.mjs                 # 배치 추가분 적용
   node merge-tracker.mjs --dry-run       # 병합 미리보기
   ```

   병합 명령은 항목을 중복 제거하고 처리된 파일을
   `batch/tracker-additions/merged/`로 아카이브합니다.

SPA는 결과 보고서를 `#/reports`(페이지네이션, 점수 필 색상)에,
tracker 행을 `#/tracker`에 노출합니다 — 마치 `#/evaluate`로 각각
추가한 것과 동일합니다. CLI로 내려가는 것을 선호하지 않는다면
`#/tracker`의 **▶ Merge** 유지보수 버튼과 짝지어 사용하십시오.

### Playwright Setup ([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

두 가지 career-ops 기능에 필수:

- **폼 채우기**: `/career-ops apply` 내부 (위 3단계 — Playwright가
  브라우저를 열고 필드 레이블을 읽으며 답변을 제안합니다).
- **PDF 생성**: `/career-ops pdf` 및 `#/cv` / `#/reports/:slug` /
  `#/evaluate` / `#/deep` / `#/interview-prep`의 SPA
  **📄 Generate PDF** 버튼.

**Playwright가 없을 때의 폴백:** apply 흐름은 WebFetch로
폴백합니다 (텍스트 전용 폼 미리보기, 클릭 채우기 없음). PDF
생성은 그냥 오류가 납니다.

**기본 설정 (career-ops 부모 루트에서 실행):**

```bash
# Playwright용 Chromium 설치
npm install
npx playwright install chromium

# Claude Code가 폼을 구동할 수 있도록 Playwright MCP 등록
claude mcp add playwright npx @playwright/mcp@latest

# 세 컴포넌트(Chromium, Playwright lib, MCP) 모두 검증
npm run doctor
```

**대안 MCP 등록** — `.claude/settings.local.json`에 추가:

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

**동작 노트:**

- **기본 헤드리스.** Playwright는 조용히 동작합니다. 브라우저를
  실제로 보고 싶다면 Claude에게 `open up with playwright the
  browser and fill out the entire form.`이라고 지시하십시오.
- **한 패키지 안의 세 가지 역할** — Playwright npm 설치는
  브라우저 자동화 라이브러리, `/career-ops pdf`용 PDF 렌더링
  엔진, 그리고 (MCP를 통해) Claude Code 안의 폼 채우기 워크플로를
  모두 제공합니다.
- **신뢰하기 전에 검증** — `npm run doctor`가 세 가지가 모두
  작동함을 확인합니다. SPA의 Health 페이지는 누락 시 빠르게
  실패하는 `Playwright (parent node_modules)` 체크를 노출합니다.

---

## 15. 인터뷰 준비

리서치 이후, 인터뷰 이전 단계. 이 앱의 세 가지 산출물이 수렴합니다:

1. **저장된 심층 리서치 파일**: `interview-prep/` 아래, 실행한
   회사-롤 쌍마다 하나. **Deep research** 페이지에서 또는 직접
   `/api/interview-prep`로 탐색.
2. **Patterns 모드** (`#/patterns`) — 자기 성찰 프롬프트 생성:
   "지난 N건의 인터뷰 / 오퍼 / 거절을 가로질러 어떤 패턴이
   있는가?" tracker 행이 5개 이상 쌓였을 때 유용.
3. **Interview-prep 모드** (`#/interview-prep`) — 다가오는 특정
   라운드(behavioral, technical, system design)를 위한 한 장
   요약을 미리 채워줍니다. 출력은 동일한 `interview-prep/`
   폴더로 떨어집니다.

### 권장 워크플로

예약된 각 인터뷰에 대해:

1. **Deep을 재실행** (또는 저장 파일 열기)을 전날 수행.
2. **`#/interview-prep`** — 해당 라운드용 한 장 요약 생성. 메모에
   붙여넣기.
3. **System design / 코딩 라운드** — `#/training`을 열어 JD가
   강조하는 특정 서브시스템에 대한 30분 타깃 복습 요청.
4. **보상 라운드** — 심층 리서치 파일을 열고 "Negotiation
   leverage points"로 이동. 2–3개의 구체적 데이터 포인트
   (Glassdoor 밴드, 최근 펀딩, 다른 회사의 비교 가능 오퍼)
   준비.
5. **Behavioral 라운드** — 원본 Evaluate 보고서 B 섹션에 들어간
   `cv.md`의 STAR+R 스토리를 꺼내기.

인터뷰 직후:

1. tracker 행 갱신: 상태 → `Responded` (그 다음 `Interview`,
   `Offer` 등).
2. `#/followup` 실행 — 감사 이메일 초안 작성.
3. 새 정보(보상 범위, 팀 구성, 기술 스택의 의외성)를 얻었다면,
   저장된 `interview-prep/<company>-<role>.md`에 `## Post-round
   notes`로 편집해 둬서 미래의 자신이 가질 수 있게 하십시오.

---

## 16. Activity log + 문제 해결

### Activity log (`#/activity`)

서버에 도달하는 모든 상태 변경 요청의 감사 추적. 기록:
pipeline 추가, tracker 쓰기, CV 저장, JD 저장, evaluate 실행,
deep research 실행, scan 실행, 설정 변경, 모드 실행.

비밀(`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`)은 들어오는 과정에서
편집됩니다. `data/activity.jsonl`에서 실제 키 값을 보는 일은
없습니다.

액션 프리픽스 (`pipeline.`, `cv.`, `evaluate`, `scan.` 등)로
필터링. 페이지당 25행. 서버는 가장 최근 이벤트 최대 500개를
반환합니다.

### 문제 해결

| 증상 | 가능한 원인 | 해결 |
|---|---|---|
| Health 페이지에서 `cv.md`가 빨강 | 최초 실행, 파일 아직 없음 | `touch $CAREER_OPS_ROOT/cv.md` 후 새로고침. |
| `Profile customized`가 빨강 | `candidate.full_name`이 여전히 `Jane Smith` | `config/profile.yml` 편집. |
| 스캔 로그에 `hh.ru: HTTP 403` | 러시아 외부 IP, `(서버가 기본 UA 사용)` 미설정 | `dev.hh.ru/admin`에 등록, 러시아 IP / VPN 사용. |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | 부모 프로젝트 의존성 미설치 | `cd $CAREER_OPS_ROOT && npm install`. |
| Generate PDF 오류 | 부모에 Playwright 미설치 | `cd $CAREER_OPS_ROOT && npx playwright install chromium`. |
| `/career-ops apply`가 "no report found"라 함 | Pipeline이 이 JD를 채점한 적 없음 | `/career-ops pipeline` (또는 `#/evaluate`) 먼저 실행. 14절 선결 조건 참조. |
| `batch-runner.sh: no such file` | 잘못된 디렉터리에서 실행 | `./batch/batch-runner.sh` 호출 전에 `cd $CAREER_OPS_ROOT`. |
| 서버가 `EADDRINUSE: 4317` 보고 | 기존 인스턴스 실행 중 | `pkill -f 'node server/index.mjs'` 후 재시작. |
| 라이브 LLM 호출이 2분 이상 멈춤 | 프롬프트가 거대하거나 Anthropic이 느림 | `/api/health`의 Anthropic 플래그 확인. 서버는 프롬프트를 200 KB 소프트 캡으로 자르고 413을 반환합니다. |
| Pipeline 미리보기에 `(unsafe redirect)` | 공고가 사설 IP / loopback으로 리디렉트 | 보안 기능입니다(REVIEW-B1). 리디렉트 타깃은 거부되고 원본 URL은 변경되지 않습니다. |
| Tracker 행이 테이블을 깨뜨림 | v1.9.1 이전의 회사 이름 파이프 | v1.9.1+로 업데이트 — 파이프는 종단 간 이스케이프됩니다 (BF-1). |
| 신선한 클론에서 `npm test` 실패 | 테스트가 부모 프로젝트 레이아웃 가정 | `CAREER_OPS_ROOT=$(mktemp -d)` 사용 및 픽스처 부트스트랩. |

더 깊은 진단: Health 페이지에서 **▶ Doctor** 실행, 출력 복사,
<https://github.com/Fighter90/career-ops-ui/issues>의 이슈
트래커에서 검색하십시오.


---

## 17. 새 채용 포털 소스를 추가하는 방법

career-ops-ui는 각 채용 사이트를 **어댑터**로 취급합니다 — [`server/lib/sources/<slug>.mjs`](../../server/lib/sources/) 아래의 단일 파일이 한 사이트의 결과를 가져오고 정규화하는 방법을 알고 있습니다. v1.29.0은 11개의 어댑터(영문 ATS 6개, 러시아 보드 5개)를 포함합니다.

> **v1.69.0 (P-14) — 드롭인 자동 검색.** 12번째 소스 추가는 이제
> **순수 파일 드롭**입니다. 레지스트리
> ([`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs))는
> 더 이상 직접 관리하는 목록을 유지하지 않습니다 — 부팅 시 이 폴더를
> 스캔하고(`readdirSync` + 동적 `import()`) 모든 `*.mjs`에서
> `export const meta` 블록을 수집합니다. 어댑터를 작성하고 `meta`를 선언하면
> 스캐너, `#/scan` 필터 드롭다운, RU 디스패처에서 즉시 보입니다 —
> **`registry.mjs` 편집 불필요**. (RU 소스는 여전히 부모의
> `portals.yml`에 한 줄이 필요합니다; 5단계 참조.)

### 1단계 — 어댑터 작성

`server/lib/sources/<slug>.mjs`를 생성합니다. 소스에 JSON API가 있는지 HTML만
렌더링하는지에 따라 두 가지 패턴이 동작합니다:

**API 기반 소스** (가장 깔끔 — 사이트에 열린 데이터 엔드포인트가 있을 때 사용):

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

**HTML 스크레이프 소스** (API가 없을 때 —
[`getmatch.mjs`](../../server/lib/sources/getmatch.mjs)와
[`geekjob.mjs`](../../server/lib/sources/geekjob.mjs)에서 전체 예시 확인):

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

모든 어댑터가 반드시 지켜야 할 세 가지 계약:

- **유효한 `meta` 블록 내보내기** (2단계 참조). 없으면 레지스트리가
  파일을 조용히 건너뜁니다(부팅 시 `console.warn` 한 번) — 소스가
  드롭다운에 절대 나타나지 않습니다.
- **`opts`에서 `{ onlyRemote, fetchImpl, signal }` 수용.** `fetchImpl`이 있어야
  네트워크 없이 어댑터를 테스트할 수 있고, `signal`은 클라이언트 연결 해제 전파에
  필요합니다(REVIEW-B3).
- **공통 형태로 레코드 반환** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`. 여기서 `source`는
  `meta.value`와 일치해야 합니다.

### 2단계 — 어댑터의 `meta` 선언 (자동 등록)

이것이 등록 단계의 전부입니다. **`registry.mjs`는 편집하지 않습니다.**
어댑터가 `meta` 블록을 내보내기만 하면 — 레지스트리가 부팅 시 자동으로
검색합니다:

```js
// at the top of server/lib/sources/example.mjs
export const meta = {
  value: 'example',          // job.source value AND #/scan option.value
  label: 'Example.com',      // display label in the dropdown
  region: 'ru',              // 'en' | 'ru'
  configKey: 'example',      // RU only — key in portals.yml::russian_portals.sources
};
```

검색 유효성 검사 방식(규칙 하나라도 실패하면 파일이 건너뛰어지고
`[sources/registry]` 경고 하나가 남아 반쯤 마이그레이션된 브랜치도 진단 가능):

- `value` — 비어 있지 않은 문자열. 어댑터의 `job.source`와 일치해야 합니다.
- `label` — 비어 있지 않은 문자열.
- `region` — 정확히 `'en'` 또는 `'ru'`; 그 외는 거부됩니다.
- `configKey` — `region: 'ru'`에는 **필수**, `'en'`에는 무시됩니다.

`region: 'en'`은 ATS 스윕에 합류하고(`tracked_companies` URL 패턴에서 자동 검색),
`region: 'ru'`는 지역 디스패처에 합류합니다. 공개 API
(`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`)는
발견된 모든 `meta`에서 재구성되며, `en` 먼저 그다음 `ru`, 각 지역 내에서
레이블 알파벳 순 — 드롭다운 순서가 사용자에게 안정적으로 유지됩니다.

### 3단계 — 디스패처에 연결 (RU만)

EN ATS 소스는 `tracked_companies` URL 패턴에서 자동 검색됩니다 —
추가 연결 불필요. RU 소스의 경우
[`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs)를 열고
`RU_DISPATCH` 테이블에 행을 추가합니다:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

디스패처 루프는 `cfg.sources`에 있는 모든 키에 대해 `entry.search(query, opts)`를
호출합니다. 추가 코드 변경 불필요.

### 4단계 — 테스트 (모킹, 실제 네트워크 금지)

`tests/sources-<slug>.test.mjs` 아래에 파일을 두세요. 실제 네트워크는
테스트에서 **금지**됩니다(CI-isolation 계약):

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

### 5단계 — 자신의 `portals.yml`에서 활성화

부모 프로젝트의 `portals.yml`은 사용자 소유 설정입니다. 새 소스의
`configKey`를 배열에 추가하세요:

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

브라우저에서 `#/scan`을 새로 고치세요. 소스 필터 드롭다운이 새 항목을
자동으로 인식합니다(단일 진실 공급원:
[`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs)). 🌐 스캔 버튼이
이제 모든 지역 스윕에 새 소스를 포함합니다.

### 참조 어댑터 (새 소스는 이것들을 미러링하세요)

| 어댑터 파일 | 유형 | 비고 |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | 표준 RU API 어댑터; 지오 인식 UA 폴백. |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | 러시아 정부 오픈 데이터; IP 게이트 없음. |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML 스크레이프 | 러시아 기술 게시판; 정규식 기반 카드 파서. |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML 스크레이프 | 방어적 파서, 파싱 실패 시 `[]`. |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML 스크레이프 | GetMatch와 동일한 방어적 스타일. |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | 표준 EN ATS 어댑터; `tracked_companies` URL 패턴 사용. |

### 일반적인 함정

- **`meta` 내보내기 빠뜨리기.** v1.69.0부터 `meta` 블록이 소스를 등록하는
  *유일한* 수단입니다. `meta`가 없거나 잘못된 경우 = 파일이 부팅 시 조용히
  건너뛰어지고 `[sources/registry] <file> has no valid \`export const meta\` — skipped`
  경고 하나만 남습니다. 새 어댑터가 드롭다운에 보이지 않으면 서버 로그를 확인하세요.
- **`source` 필드 불일치.** 어댑터가 기록하는 문자열은
  `meta.value`와 정확히 일치해야 합니다. 둘이 어긋나면,
  `#/scan` 필터 드롭다운에는 소스가 표시되지만 선택하면
  모든 행이 걸러집니다(동등성 검사가 `r.source === fs`이기 때문).
- **파싱 실패 시 예외 던지기.** HTML 스크레이퍼는 파싱 가능한 카드가 없는
  정상 200에서 `[]`를 반환해야 합니다. 예외를 던지면 멀티 소스
  디스패처 루프가 깨집니다 — 잘못된 HTML 구조 하나가 같은 쿼리의
  다른 모든 소스를 죽입니다.
- **`fetchImpl` / `signal` 빠뜨리기.** 이것들이 없으면 어댑터는
  실제 네트워크에 접속하지 않고는 유닛 테스트할 수 없으며, 클라이언트
  연결 해제도 전파되지 않습니다(사용자가 탭을 닫아도 백그라운드
  페치가 살아 있습니다).
- **RU에 `tracked_companies` 의존.** 그 목록은 EN ATS
  소스 전용입니다. RU 어댑터는 대신
  `russian_portals.queries`에서 스스로 구동합니다 — 회사별 항목 없음.

---

## 18. 알림 (상단바의 🔔)

> v1.58.34 — 우측 하단에 나타나는 모든 토스트는 in-memory 저널(최대 50, 오래된 것 삭제)에 캡처됩니다. 상단바의 🔔 을 클릭하면 우측 슬라이드 **알림** 드로어가 열려 놓친 메시지를 다시 확인할 수 있습니다. 저널은 탭/세션 단위 — 탭을 닫으면 비워집니다.

드로어는 **벨 클릭 시에만 열립니다**(또는 키보드 포커스 + Enter / Space). 자동으로 열리지 않습니다. 빨간 배지는 마지막 열람 후 안 읽은 개수를 표시하고, 열면 초기화됩니다.

### 카테고리

| 카테고리 | 발생 시점 | 시각적 신호 |
|---|---|---|
| **성공** | `Saved`, `Copied`, `Refreshed`, 스캔 완료, CV 임포트, apply-checklist 액션, 프로필 저장 | 왼쪽 테두리 녹색; 녹색 토스트 배경 |
| **오류** | URL 검증 실패, `(METHOD /path · HTTP NNN)` 접미사가 붙은 API 오류, 네트워크 실패, pipeline-400 중복, doctor/verify 비정상 종료 | 왼쪽 테두리 빨강; 빨간 토스트 배경; 기술 접미사는 `세부 정보` `<details>` 에 격납 (U-4) |
| **정보 / 진행** | `Running doctor.mjs…`, `Running verify-pipeline.mjs…`, `Refreshing…`, `Loading…`, 스캔 진행 | 왼쪽 테두리 회색 |

각 항목: 시각(`HH:MM:SS`, 현재 언어), 메시지(U-4 로 헤드라인은 정리됨), 있을 경우 `(METHOD /path · HTTP NNN)` 등 기술 세부 사항(monospace).

### 알림이 아닌 것

- Doctor / verify 결과 모달(모달은 토스트와 별개, 저널 외).
- `#/scan` / `#/auto` 의 SSE 로그(페이지 본문에 직접 출력).
- 토스트 없는 spinner-only 로딩 상태.

### 키보드

- 벨 **클릭** 또는 focus + **Enter / Space** → 드로어 열기.
- **Esc**, **×**, 벨 재클릭 → 닫기; 포커스 벨로 복귀.


## 19. 앱을 내 언어로 현지화하기

인터페이스는 9개 언어로 제공됩니다(English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文). 화면의 모든 라벨은 번역 사전에서 오며, 앱 로직을 건드리지 않고도 언어를 추가하거나 수정할 수 있습니다.

**번역이 있는 곳.** v1.60.0부터 각 언어는 `public/js/lib/locales/` 아래 자체 파일입니다 — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.ru.js` 등 — `'키': '텍스트'` 쌍의 단순한 목록입니다. 공용 `i18n-dict.aliases.js`는 항상 동일하게 표시되어야 하는 키(사이드바 라벨과 그 페이지 제목)가 하나의 번역을 가리키게 합니다. `i18n-dict.js`가 로드 시 이를 조립하며, 직접 편집하지 않습니다.

**문구 수정/추가.** 해당 언어 파일을 열고 키(예: `'nav.scan'`)를 찾아 텍스트를 수정합니다. 새 라벨을 추가하려면 **8개** 언어 파일 모두에 같은 키와 번역값을 추가한 뒤 페이지에서 `t('your.key')`로 사용합니다. `npm test`를 실행하세요 — 어느 언어든 키가 빠지면 실패하므로 절반만 번역된 채 배포되지 않습니다.

**새 언어 추가.** `i18n-dict.en.js`를 `i18n-dict.<code>.js`로 복사해 모든 값을 번역한 뒤, 코드를 `i18n.js`(언어 목록 + 브라우저 자동 감지)와 `i18n-dict.js` 조립기에 등록하고 `index.html`에 `<script>` 한 줄을 추가합니다. 테스트 스냅샷과 도움말 / README 동반 파일을 포함한 전체 체크리스트는 `docs/LOCALIZATION.md`에 있습니다.

**알아두면 좋은 점.** 언어 전환기는 사이드바 하단에 있으며, 선택은 브라우저별로 기억됩니다. 서버 진단 메시지는 의도적으로 영어로 유지됩니다(로그 일관성) — 화면 인터페이스만 번역됩니다.

전체 단계별 현지화 가이드는 저장소의 **`docs/LOCALIZATION.md`**를 참조하세요.
