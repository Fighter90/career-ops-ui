# Trợ giúp — career-ops-ui

<p align="center"><img src="https://raw.githubusercontent.com/Fighter90/career-ops-ui/main/images/providers.png" alt="Works with 18 LLM providers — Anthropic, OpenAI, Gemini, Qwen, OpenRouter, GitHub, DeepSeek, Kimi, MiniMax, Mistral, Ollama and more" width="760"></p>

Hướng dẫn đầy đủ cho mọi trang, từ lúc bạn khởi chạy ứng dụng đến khi có
buổi phỏng vấn trong tay. Mỗi đề mục `##` bên dưới tương ứng với một mục
trên thanh bên hoặc một giai đoạn của quy trình. Đọc từ trên xuống trong
lần chạy đầu; sau đó nhảy tới mục cụ thể qua mục lục ở thanh bên trợ giúp.

> **Đối tượng:** bất kỳ ai vừa thả UI này vào một bản `career-ops`
> và chạy `bash bin/start.sh`. Không cần biết trước gì về career-ops.

### Về career-ops

[career-ops](https://career-ops.org) là hệ thống tìm việc mã nguồn mở chạy
dưới dạng slash command bên trong bất kỳ AI coding CLI nào (Claude Code, Cursor, Codex, OpenCode, Antigravity CLI, Grok Build CLI, Qwen Code, Kimi, GitHub Copilot CLI, Gemini CLI (legacy) — các CLI tương thích Claude khác cũng hoạt động qua cùng mặt slash-command). Không ràng buộc mô hình. Nó
đánh giá từng tin tuyển dụng so với CV của bạn bằng một thang 0.0–5.0 gồm năm chiều cộng với một
điểm tổng toàn cục, tạo các bản nháp PDF được điều chỉnh, và theo dõi mọi đơn ứng tuyển
ngay trên máy của bạn.

**Tài liệu tham chiếu chính thức (đọc theo thứ tự này khi lần đầu cài):**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is career-ops)
  — hệ thống, nguyên tắc, và bảng khái niệm.
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — khám phá tin tuyển dụng; làm đầy Pipeline.
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — quy trình nộp đầy đủ với đọc-form bằng Playwright.
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — chấm điểm 10+ JD cùng lúc qua `batch-runner.sh`.
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — cài Chromium + đăng ký MCP cho PDF và điền form.
- [How career-ops scores job listings](https://career-ops.org/methodology)
  — phương pháp chấm điểm: năm chiều cộng điểm tổng toàn cục, ngưỡng ứng tuyển 4.0,
  và những gì hệ thống cố tình không làm. Cũng được tóm tắt tại
  [cvstart.org/methodology](https://cvstart.org/methodology/) bằng ngôn ngữ của bạn.

**Nguyên tắc nền tảng** (từ
[career-ops.org/docs/introduction/what-is career-ops](https://career-ops.org/docs/introduction/what-is career-ops)):

- **Mã nguồn mở, nghiêm túc** — MIT, không gói trả phí, không danh sách chờ, không
  telemetry, không tài khoản. Hệ thống vận hành không cần gói trả phí,
  tài khoản hay telemetry. Đóng góp code được cộng đồng xem xét
  trước khi phát hành.
- **Chủ quyền dữ liệu** — `cv.md`, `config/profile.yml`, `data/`,
  `reports/`, `interview-prep/` không bao giờ rời khỏi máy của bạn trừ khi bạn
  chủ động đẩy chúng đi. Bạn chạy nó tại chỗ trên máy mình, giữ trọn
  chủ quyền dữ liệu.
- **Kiến trúc không phụ thuộc AI** — career-ops KHÔNG đóng gói sẵn một mô hình.
  Nó hoạt động như các lệnh bên trong các AI coding CLI có sẵn. Đổi
  nhà cung cấp (Anthropic ↔ Gemini ↔ OpenAI) và lịch sử đánh giá
  của bạn vẫn nhất quán.
- **Nộp hồ sơ do con người kiểm soát** — career-ops soạn câu trả lời và
  mở form, nhưng **bạn mới bấm Submit**. Hệ thống không bao giờ
  tự ứng tuyển. Hệ thống cung cấp cấu trúc và đánh giá; con người
  giữ quyền quyết định nộp cuối cùng.
- **Tìm kiếm có cấu trúc** — được xây cho một cuộc săn việc chủ động, có chủ đích
  với nhiều đơn ứng tuyển; không phải công cụ nộp một-đơn-một-lần, không phải
  máy đề xuất. Việc thiết lập mất ~15 phút và đòi hỏi familiarity
  với terminal.

**career-ops KHÔNG phải là gì** (các mục tiêu phi-đích rõ ràng):

- Không phải máy tự-động-nộp-đơn. Nó sẽ không nộp form thay bạn.
- Không phải máy dựng lại CV. Nó điều chỉnh theo từng JD; nó không bịa
  kinh nghiệm.
- Không phải máy tối ưu LinkedIn. Hồ sơ LinkedIn là việc của bạn.
- Không phải bản thay bảng tính ẩn sau một UI SaaS. Dữ liệu
  là markdown thuần trên filesystem của bạn.

**Khái niệm chính** (bảng kê đầy đủ — mọi artifact career-ops chạm tới):

| Khái niệm | Là gì |
|---|---|
| **Mode** | Một mẫu prompt trong `modes/<slug>.md`. Có sẵn: `oferta`, `deep`, `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`, `ofertas`, `auto-pipeline`, `pdf`, `latex`, `scan`, `tracker`. |
| **Archetype** | Hồ sơ vị-trí-mục-têu trong `config/profile.yml`. Thang điểm lấy khớp kỹ năng so với archetype đang hoạt động — **trường quan trọng nhất**. |
| **Pipeline** | `data/pipeline.md` — hộp vào chứa các URL JD chờ đánh giá. |
| **Tracker** | `data/applications.md` — bảng GFM lịch sử của mọi lần đánh giá + trạng thái ứng tuyển. |
| **Báo cáo** | `reports/<NNN>-<company>-<DATE>.md` — đánh giá A–F đầy đủ cho từng JD, kèm điểm + độ chính đáng ở phần đầu. |
| **Lịch sử quét** | `data/scan-history.tsv` — nhật ký chỉ-ghi-thêm; chống trùng lặp qua các lần quét. |
| **Điểm chứng minh** | Các khối bằng chứng STAR+R rút ra từ `cv.md`, dùng lại trong đánh giá, câu trả lời ứng tuyển, chuẩn bị phỏng vấn. |
| **Kho JD** | `jds/jd-<date>-<ts>.txt` — mô tả công việc nguyên văn được lưu trong lúc đánh giá cho dấu vết kiểm toán. |
| **Chuẩn bị phỏng vấn** | `interview-prep/<company>-<role>.md` — bản tóm tắt nghiên cứu sâu và one-pager từng vòng. |
| **Bổ sung batch** | `batch/tracker-additions/*.tsv` — các dòng đang chờ do `batch-runner.sh` xếp hàng chờ hợp nhất vào tracker. |

### career-ops và career-ops-ui (ứng dụng này)

| | career-ops (CLI) | career-ops-ui (ứng dụng này) |
|---|---|---|
| Chạy ở đâu | bên trong Claude Code / Cursor / Codex / OpenCode / Antigravity CLI / Grok Build CLI / Qwen Code / Kimi / GitHub Copilot CLI / Gemini CLI (legacy) | `http://127.0.0.1:4317` trên trình duyệt của bạn |
| Mặt bàn | slash command `/career-ops <mode>` | thanh bên với một trang cho mỗi quy trình |
| Điền form | có, qua Playwright MCP | không — tạo danh mục kiểm tra, bạn hoàn tất trong CLI |
| PDF | `generate-pdf.mjs` | `📄 Generate PDF` trên `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep` |
| Tệp dữ liệu | dùng chung với career-ops-ui | dùng chung với career-ops |

career-ops-ui là **phần bổ sung thuần túy**. Không gì bên trong `career-ops/`
bị thay đổi. Cả hai mặt bàn dùng chung `cv.md`, `config/profile.yml`,
`portals.yml`, `data/`, `reports/`, `interview-prep/`, `modes/`.

### Ngưỡng hành động theo điểm

Khi một JD đã có đánh giá, điểm số quyết định bước tiếp theo
(bảng chính thức từ
[career-ops.org/docs/introduction/what-is career-ops](https://career-ops.org/docs/introduction/what-is career-ops)):

| Điểm | Bước tiếp theo |
|---|---|
| **≥ 4.5** | Chạy `/career-ops apply` — khớp cao, đẩy ngay. |
| **4.0 – 4.4** | Nộp đơn, hoặc `/career-ops contacto` để được giới thiệu thân thiện trước. |
| **3.5 – 3.9** | Chạy `/career-ops deep` — nghiên cứu công ty / vị trí trước khi quyết. |
| **< 3.5** | Bỏ qua trừ khi bạn có lý do cá nhân cụ thể. |

`#/dashboard` và `#/tracker` của career-ops-ui làm nổi bật mọi dòng từ 4.0
trở lên để bạn chọn hành động mà không cần chạy lại gì.

### Tài liệu bên ngoài

Tài liệu tham chiếu đầy đủ cho engine career-ops bên dưới
(quét, thang đánh giá, xử lý batch, luồng apply,
thiết lập Playwright) nằm tại
[career-ops.org/docs](https://career-ops.org/docs):

- [What is career-ops](https://career-ops.org/docs/introduction/what-is career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. Bắt đầu nhanh — từng bước đầy đủ từ "tạo CV" đến "đã ứng tuyển & đã nhắn tin"

Đây là cẩm nang chính thức, theo từng nút bấm. Làm theo thứ tự này trong
lần đầu. Mỗi bước nêu đúng route, đúng nút,
và những gì bạn sẽ thấy khi thành công. Các mục 2–16 bên dưới đi sâu hơn vào
từng giai đoạn.

> **Thích chỉ hỏi?** Mở **Ask the docs 💬** (trên thanh bên, dưới Help) và gõ câu hỏi như "Làm cách nào để quét các cổng việc làm?" hay "Điểm khớp hai-trang hoạt động thế nào?". Nó trả lời **chỉ** từ hướng dẫn này, bằng ngôn ngữ của bạn, và cho biết nó lấy từ những mục nào — nó không bao giờ đọc CV hay việc tìm việc của bạn. Có khóa LLM thì nó trả lời trực tiếp; không có thì nó đưa bạn một prompt chạy-ngay (đã điền sẵn các mục hướng dẫn liên quan) để dán vào bất kỳ trợ lý nào. Cùng trợ lý ấy cũng cách một cú chạm từ **mọi** trang — một nút chat hình robot nổi ở góc dưới-phải (dưới-trái với ngôn ngữ viết từ phải sang trái); bấm nó để hỏi mà không rời việc đang làm.

> **Khởi chạy & init bằng một lệnh.** Từ terminal bạn có thể làm toàn bộ
> bootstrap mà không đụng tới UI:
>
> ```bash
> career-ops-ui setup      # cài deps → doctor → chạy máy chủ
> career-ops-ui init       # chọn nhà cung cấp LLM + dán khóa (echo bị chặn)
> career-ops-ui doctor     # kiểm chứng lại bất cứ lúc nào (exit 0 ⇔ mọi mục bắt buộc đều xanh)
> career-ops-ui run        # chỉ khởi chạy máy chủ tại http://127.0.0.1:4317
> career-ops-ui open       # mở + NÂNG tab bảng điều khiển lên trước trong trình duyệt
> ```
>
> Sau `setup`/`run`, tab trình duyệt được mở **và đưa lên
> trước** tự động (v1.43.0); `career-ops-ui open` làm điều tương tự theo
> yêu cầu để bạn không phải săn tab bảng điều khiển. `NO_OPEN=1`
> tắt tự-mở cho các lần khởi chạy headless/CI.
>
> `setup` tự chạy toàn bộ chuỗi. `init` ghi khóa vào `career-ops/.env`
> của dự án gốc qua cùng đường dẫn có kiểm chứng mà tab
> khóa API `#/config` dùng, và đặt `LLM_PROVIDER`
> (`auto` | `claude` | `gemini`) mà các route đánh giá / deep / mode /
> auto-pipeline trực tiếp tuân theo. Dạng CI:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`.
> Thích dùng UI? Tiếp tục với các bước bên dưới.

### A. Thiết lập (làm một lần, ~5 phút)

**career-ops-ui phải nằm tại `career-ops/web-ui/`** (lồng bên trong dự án career-ops gốc). Nó đọc `cv.md`, `config/` và `data/` của bạn từ thư mục gốc qua `../` và không chạy standalone. Nếu không tìm thấy `career-ops-ui init` sau khi pull, chạy `cd career-ops/web-ui && npm install && npx career-ops-ui init`.

**Bước 1 — Mở ứng dụng tại `http://127.0.0.1:4317`.** Nếu nó chưa
chạy, trong terminal chạy `bash bin/start.sh` từ thư mục gốc repo.
Bảng điều khiển (`#/dashboard`) sẽ nạp.

**Bước 2 — Bấm `❤ Health` trên thanh bên trái.** Mọi mục kiểm tra
bắt buộc phải xanh:

- `cv.md`, `config/profile.yml`, `portals.yml` tồn tại
- Đã đặt khóa API (ít nhất một trong `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`)
- Playwright đã cài (chỉ bắt buộc nếu bạn dùng Generate PDF)

Nếu có gì đỏ, trang sẽ chỉ đúng tệp hay biến môi trường cần
sửa. Đừng đi tiếp cho tới khi Health xanh.

**Bước 3 — Bấm `⚒ App settings` trên thanh bên.** Bạn tới tab
**API keys & runtime**.
- Dán `ANTHROPIC_API_KEY` (ưu tiên — chấm điểm dạng-dài tốt hơn)
  và/hoặc `GEMINI_API_KEY`. Lấy khóa từ
  <https://console.anthropic.com/settings/keys> hoặc
  <https://aistudio.google.com/apikey>.
- Bấm **💾 Save**. Rồi bấm **▶ Test Anthropic** (hoặc Gemini) — một
  lượt đi-về nhỏ xác nhận khóa hoạt động.

**Bước 4 — Chuyển sang tab `Profile` trên cùng trang.** Đây là
trình soạn YAML trực tiếp cho `config/profile.yml`. Sửa ít nhất:
- `candidate.full_name` — thay mọi placeholder ("Jane Smith") bằng
  tên thật của bạn
- `candidate.email`, `linkedin`, `github` — dùng trong thư xin việc
- `target.roles` — các chức danh bạn sẽ ứng tuyển
- `target.comp_total_min_usd` — tổng lương tối thiểu; offer dưới mức này
  bị gắn cờ ở mục D của mọi đánh giá
- `target.archetypes` — các mẫu sự nghiệp bạn chấp nhận (trường
  có-ảnh-hưởng-nhất)

Bấm **💾 Save**. Máy chủ kiểm tra YAML và đóng dấu phần đầu
chuẩn `# Career-Ops Profile Configuration`.

### B. CV (làm một lần, ~10 phút)

**Bước 5 — Bấm `✎ CV` trên thanh bên.** Hai cột: trình soạn bên
trái, xem-trước trực tiếp bên phải.

**Bước 6 — Chọn một đường để làm đầy trình soạn:**
- **Tải lên CV có sẵn** — bấm **📁 Upload CV**, chọn tùy ý
  `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`. Máy chủ
  chuyển sang markdown qua pandoc hay pdftotext, làm sạch XSS,
  và thả kết quả vào trình soạn. **Xem lại bản chuyển đổi** —
  nhất là PDF dễ mất định dạng.
- **Dán markdown trực tiếp** — textarea là một trình soạn markdown;
  khung bên phải là những gì LLM (và recruiter tương lai của bạn) sẽ thấy.
- **Mẹo văn phong:** một gạch đầu dòng = một thành tựu kèm một chỉ số. Giữ
  dưới 1500 từ. Các mục theo thứ tự này: Tóm tắt, Kinh nghiệm,
  Dự án, Học vấn, Kỹ năng.

**Bước 7 — Bấm `💾 Save` (góc trên-phải trang CV).** Máy chủ
làm sạch (`<script>` / `javascript:` / inline handler bị loại) và
ghi `cv.md`. Toast: *"Đã lưu"*.

**Bước 8 (tùy chọn) — Bấm `📄 Generate PDF`.** Chạy
`generate-pdf.mjs` ở dự án gốc (cần Playwright) và **PDF mới
tự tải xuống** trình duyệt của bạn khi xong. Danh sách ở
dưới trang giữ mọi tệp đã tạo trước đó.

### C. Tìm tin tuyển dụng (~2 phút mỗi lần quét)

**Bước 9 — Bấm `🌐 Scan` trên thanh bên.** Xác nhận `portals.yml`
liệt kê các bảng bạn quan tâm (mục 5 của hướng dẫn này). Bấm nút
**🌐 Scan now**. Một nhật ký SSE trực tiếp chạy trong lúc scanner
đi qua Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (bảng tiếng Anh) và hh.ru / Habr
Career (bảng tiếng Nga nếu bật).

**Bước 10 — Khi quét xong, xem lại kết quả.** Bấm thẻ công ty bất kỳ để lọc; bấm biểu tượng ↗ để mở trang
tuyển dụng của công ty trong tab mới. Mọi tin sống sót qua
bộ lọc tiêu đề được xếp vào Pipeline. Mỗi dòng kết quả gói tin đăng trong hai dòng gọn — tiêu đề phía trên, một dòng chi tiết gồm
các biểu tượng nhỏ bên dưới (khớp tiêu đề, tăng cấp bậc, điểm khớp,
nguồn và ngày) — và danh sách kết quả dài được phân trang.

### D. Chấm điểm các offer (~30 giây mỗi JD)

**Bước 11 — Bấm `Pipeline` trên thanh bên.** Bạn thấy mọi URL
scanner đã xếp hàng. Bấm một mục để xem trước JD ngay tại chỗ.

**Bước 12 — Bấm `▶ Evaluate` cạnh JD bất kỳ.** Nó nhảy tới
`#/evaluate`. Đã đặt khóa API thì chạy trực tiếp; chưa có thì
bạn nhận một prompt thủ công để dán vào LLM của mình. Chế độ trực tiếp tạo
**điểm 0–5** so với CV của bạn qua các mục A–G (Vai trò / Công ty /
Lương thưởng / Rủi ro / Độ-vượt-mức / Văn hóa / Kết luận). Lưu sẽ
đổ vào `reports/<date>-<slug>.md`.

**Bước 13 — Bấm `Reports` trên thanh bên** và xem lại đánh giá mới nhất.
Mọi thứ dưới `comp_total_min_usd` của bạn bị gắn cờ đỏ
ở mục D. Mọi thứ có `Verdict: pursue` là danh sách ngắn của bạn.

### E. Quyết định & nghiên cứu sâu công ty lọt-vòng (~3 phút)

**Bước 14 — Chọn một tin đáng theo đuổi. Bấm `Deep research`
trên thanh bên.** Nhập tên công ty và vị trí. Mô hình
tạo một bản tóm tắt công ty 7 mục (sứ mệnh, tin tức gần đây, tech
stack, tín hiệu tuyển người, chuẩn lương, rủi ro, góc tiếp cận đề xuất).
Lưu sẽ đổ vào `interview-prep/<company>-<role>.md`.

### F. Ứng tuyển (~5 phút mỗi đơn)

**Bước 15 — Bấm `Apply checklist` trên thanh bên.** Dán
URL tin + JD. Trợ lý tạo một danh mục kiểm tra nộp từng bước:
- Bản nháp thư xin việc được điều chỉnh (dùng `cv.md` + `profile.yml` của bạn)
- Các từ khóa cụ thể cần phản chiếu từ JD
- Tệp cần đính kèm (PDF CV — xem bước 8)
- Nơi nộp (URL tuyển dụng chính thức, không phải redirect từ aggregator)
- Lưu ý: **KHÔNG BAO GIỜ tự nộp** — xem lại cuối và nộp luôn là
  thủ công.

**Bước 16 — Mở trang tuyển dụng trong tab mới.** Dùng danh mục
kiểm tra làm todo-list của bạn. Nộp qua form thật của công ty.
Đính kèm PDF bạn đã tạo ở bước 8.

**Bước 17 — Chủ động liên hệ một con người thật.** Mở mode **Outreach**
(`#/contacto` trên thanh bên). Mô hình soạn một tin LinkedIn /
email ngắn được điều chỉnh theo bản tóm tắt công ty từ bước 14. Cá nhân hóa
câu mở đầu (một chi tiết cụ thể từ bản tóm tắt nghiên cứu sâu của bạn).
Gửi nó.

### G. Theo dõi & nhắc lại (liên tục)

**Bước 18 — Bấm `Tracker` trên thanh bên** và thêm một dòng cho
đơn ứng tuyển: công ty, vị trí, điểm, trạng thái `Applied`, liên kết tới
báo cáo, liên kết tới bản tóm tắt nghiên cứu sâu. Ngày được điền tự động.

**Bước 19 — Một tuần sau: mở mode `Follow-up`** (`#/followup`).
Soạn email hỏi-thăm lịch sự đề cập đến đơn ứng tuyển ban đầu.
Gửi. Cập nhật trạng thái tracker thành `Followed up`.

**Bước 20 — Khi nhận thư mời phỏng vấn, chạy mode `Interview prep`**
(`#/interview-prep`). Tạo chuẩn bị có nhắm cho
công ty + vòng cụ thể (system design / hành vi / coding).
Tự lấy từ bản tóm tắt nghiên cứu sâu.

**Bước 21 — Nhận offer rồi? Cập nhật trạng thái Tracker thành `Offer`** và
xem lại phần lương trong báo cáo đánh giá của bạn — con số chấp nhận
tối thiểu của bạn nằm ngay đó.

### TL;DR — thứ tự thanh bên khớp quy trình

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

Vậy thôi. 21 bước, theo từng nút, từ số không tới có offer.

### Auto-pipeline một-cú-bấm (`#/auto`) — lối tắt của 21 bước

Nếu bạn chỉ muốn chấm nhanh một tin cụ thể, bỏ qua walkthrough
thủ công. **Thanh bên → ✨ Auto-pipeline** (hoặc nút ✨ trên
Dashboard) mở một màn hình riêng: dán URL việc làm, bấm **Enter**
hay bấm **▶ Run full pipeline**, và máy chủ chạy toàn chuỗi
trong một lượt quan sát được:

1. **Đang xác thực URL** — kiểm tra an-toàn-SSRF (`isValidJobUrl`); từ chối
   loopback / `file:` / IP riêng / ký tự script.
2. **Đang tải mô tả công việc** — `safeGet` (ghim-DNS, xác thực lại redirect) tải + làm sạch JD.
3. **Đang đánh giá với CV của bạn** — Anthropic (ưu tiên) → Gemini
   dự phòng → prompt-thủ-công nếu không có khóa.
4. **Đang lưu báo cáo** — ghi `reports/<slug>.md` với điểm +
   độ chính đáng ở phần đầu.
5. **Đang thêm vào tracker** — nối một dòng vào `data/applications.md`.

Phản hồi trực tiếp là một **stepper** dọc (từng bước sáng lên
running → done / failed). Nó là danh sách có thứ tự với `aria-current`
trên bước đang chạy và một live-region lịch sự cho trình đọc màn hình
thông báo mọi chuyển tiếp. Thành công thì thẻ kết quả dẫn thẳng tới
báo cáo đã lưu (**View report · N/5**) và **tracker**. Bước thất bại
được đánh dấu đỏ kèm thông điệp và nút được bật lại để bạn
sửa URL và thử lại mà không cần tải lại trang.

**Chưa có khóa API?** Pipeline chạy ở **chế độ thủ công**: các bước 3–5
thu gọn và bạn nhận một thẻ prompt sẵn-sàn-dán (sao chép vào Claude
Code / Anthropic / Gemini). Không gọi LLM trực tiếp, không tốn tiền.

`#/auto` có thể liên-kết-được: `#/auto?url=<encoded>&go=1` mở màn hình và
tự khởi chạy. Nút ✨ trên dashboard và mục thanh bên này cùng đổ về đây
(một luồng nhất quán — modal tạm thời trước-1.34 đã được nâng lên
trang này).
> **CLI (v1.38.0).** Một lệnh làm cả chuỗi: `career-ops-ui setup` (bootstrap → cài → khởi động). Các động từ độc lập: `career-ops-ui doctor` (kiểm tra môi-trường/khóa/công-cụ — cùng engine với trang Health; exit 1 nếu có mục bắt buộc nào thất bại), `career-ops-ui run`, `career-ops-ui init` (trình hướng dẫn nhà-cung-cấp+khóa, v1.39.0).
> **Nhà cung cấp (v1.39.0).** Tab khóa API thêm select `LLM_PROVIDER` (`auto` = Anthropic→Gemini mặc định · `claude` · `gemini`) và trường `OPENAI_API_KEY` (phía CLI Codex/OpenCode). `career-ops-ui init` là trình hướng dẫn tương tác cho cùng việc đó.
>
> **Nhà cung cấp (v1.57.0).** Đánh giá-trực-tiếp không-đầu giờ trải rộng **Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes → DeepSeek → GLM (Z.ai) → Kimi (Moonshot) → MiniMax → Mistral → Grok (xAI) → Together → Fireworks → Ollama → BytePlus Ark → Volcengine Ark** (thứ tự `auto`; `LLM_PROVIDER` ghim một cái). **OpenRouter** — một `OPENROUTER_API_KEY` đứng trước 300+ mô hình; dropdown `OPENROUTER_MODEL` nạp danh mục trực tiếp của OpenRouter (proxy phía máy chủ, dự phòng offline được tuyển chọn). Cũng đã sửa: khóa dán kèm ký tự xuống dòng / khoảng trắng bao quanh được cắt trước khi kiểm tra, nên `/#/config` không còn hiện "validation failed" với bất kỳ nhà cung cấp nào.

---

## 2. Cài đặt ứng dụng & khóa API (`#/config`)

> **Mới từ v1.55 → v1.56.** Khi **chưa** đặt khóa LLM nào, một banner đỏ trên mọi màn hình giải thích rằng ⚡ Run-live đang ở chế độ prompt-thủ-công và dẫn về đây; khi đã đặt khóa nó trở thành một chip im lặng nêu tên nhà cung cấp đang hoạt động. Trước mọi nút ⚡ Run-live (`#/auto`, `#/evaluate`, `#/deep`, các mode) hiện một khoảng chi phí trung thực (vd "Chi phí ước tính: OpenAI gpt-5-codex · ~$0.04/eval", hoặc ghi chú không-tốn-phí-API ở chế độ thủ công). `#/scan` giấu các bộ lọc phụ sau một mục mở-rộng **Advanced filters**; `#/tracker` thêm chip phễu bấm-được + phân trang phía-máy-chủ tùy chọn; `#/pipeline` ảo-hóa khi quá 1000 dòng.

Ba tab:

1. **API keys & runtime** — biểu mẫu trường có cấu trúc đè lên `.env`
   của dự án gốc (cùng tệp mà các script Node career-ops đọc khi
   khởi động). Nhóm theo: Khóa API / Runtime / Nguồn khu vực. Tab
   cũng có các select mô-hình theo từng nhà cung cấp — `OPENAI_MODEL`
   (OpenAI/Codex) cạnh `ANTHROPIC_MODEL` và `GEMINI_MODEL`.
2. **Profile** — **biểu mẫu theo từng trường** cho `config/profile.yml`
   (web-ui 1.32.0). Lưu **hợp nhất** vào tệp — archetype,
   điểm chứng minh và mọi khóa tùy chỉnh của bạn được giữ nguyên.
3. **Modes** — **biểu mẫu trường có cấu trúc** cho `modes/_profile.md`
   (web-ui 1.54.3), suy ra từ schema được tài liệu hóa. Các mục dạng danh sách — **Target Roles / Adaptive Framing / Comp Targets** —
   hiển thị thành các ô nhập dòng lặp-được (thêm/xóa dòng); các mục dạng văn xuôi — **Exit Narrative / Location Policy** —
   hiển thị thành textarea có nhãn; mọi mục lạ hoặc không-phải-danh-sách quay về
   một textarea nguyên-văn có nhãn. Lưu vẫn **hợp nhất theo mục** —
   phần mở đầu, các mục không đụng tới và mọi mục tùy chỉnh
   được giữ nguyên từng-byte. Một mục mở-rộng *Advanced: raw markdown*
   vẫn còn cho sửa-toàn-bộ-tệp — thêm/xóa mục hay sửa
   phần mở đầu.

Lưu ở bất kỳ tab nào áp dụng ngay lập tức — không cần khởi động lại máy chủ.

**Thiết lập nhà cung cấp LLM (từng bước).** Đánh giá ⚡ trực tiếp của web UI chạy *headless* và dùng một khóa API. Nó hoạt động theo kiểu "HOẶC" — đặt **bất kỳ một** khóa nào trong số này là chạy ngay; nếu đặt nhiều, `auto` ưu tiên theo thứ tự: Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes → DeepSeek → GLM (Z.ai) → Kimi (Moonshot) → MiniMax → Mistral → Grok (xAI) → Together → Fireworks → Ollama → BytePlus Ark → Volcengine Ark. (Bản thân career-ops không ràng buộc CLI — bạn cũng chạy nó bên trong Claude Code, Cursor, Codex, Gemini, OpenCode, Antigravity, Grok Build, Qwen, Copilot hay Kimi; điều đó tách biệt với khóa headless này.)

1. Mở `#/config` → tab **API keys & runtime**.
2. Chọn nhà cung cấp trong **`LLM_PROVIDER`**: `auto` (dùng khóa nào đã đặt), hoặc ép một slug — `claude` / `gemini` / `openai` / `qwen` / `openrouter` / `github` / `hermes` / `deepseek` / `zai` / `kimi` / `minimax` / `mistral` / `grok` / `together` / `fireworks` / `ollama`.
3. Điền khóa + mô hình cho nhà cung cấp bạn chọn:
   - **Anthropic** — đặt `ANTHROPIC_API_KEY` (console.anthropic.com), tùy chọn `ANTHROPIC_MODEL` (mặc định `claude-sonnet-4-6`).
   - **Gemini** — đặt `GEMINI_API_KEY` (aistudio.google.com/apikey), tùy chọn `GEMINI_MODEL` (mặc định `gemini-3.6-flash`).
   - **OpenAI** — đặt `OPENAI_API_KEY` (platform.openai.com), tùy chọn `OPENAI_MODEL` (mặc định `gpt-5-codex`).
   - **Qwen** — đặt `QWEN_API_KEY` (Alibaba Model Studio / DashScope, dashscope.console.aliyun.com), tùy chọn `QWEN_MODEL` (mặc định `qwen-max`). Với endpoint Trung-Quốc-đại-lục đặt `QWEN_BASE_URL` trong `.env` thô.
   - **Thêm các nhà cung cấp tương thích OpenAI (v1.216.0)** — mỗi cái chỉ cách một khóa, cùng đánh giá ⚡ trực tiếp và ô monogram trong danh sách trường: **DeepSeek** (`DEEPSEEK_API_KEY`, platform.deepseek.com), **GLM / Z.ai** (`ZAI_API_KEY`, z.ai — `ZAI_BASE_URL` chuyển sang endpoint Trung Quốc `open.bigmodel.cn`), **Kimi / Moonshot** (`MOONSHOT_API_KEY`, platform.moonshot.ai — `MOONSHOT_BASE_URL` cho endpoint CN), **MiniMax** (`MINIMAX_API_KEY`), **Mistral** (`MISTRAL_API_KEY`, console.mistral.ai), **Grok / xAI** (`XAI_API_KEY`, console.x.ai), **Together** (`TOGETHER_API_KEY`, together.ai — các mô hình trọng-số-mở kể cả **Inkling** của Thinking Machines, `thinkingmachines/Inkling`), **Fireworks** (`FIREWORKS_API_KEY`, fireworks.ai), và **Ollama** — hoàn toàn cục bộ, **không cần khóa**: đặt `OLLAMA_BASE_URL` (mặc định `http://localhost:11434/v1`) và chạy `ollama serve`. Mỗi cái có trường `*_MODEL` tùy chọn với mặc định hợp lý.
4. Bấm **Save**. Khóa được ghi vào `.env` của dự án gốc; thay đổi áp dụng ngay — không cần khởi động lại máy chủ.
5. Kiểm chứng tại `#/evaluate`: dán URL/mô tả việc làm và bấm **⚡ Run live**. Phần đầu kết quả cho biết nhà cung cấp nào đã chạy (`anthropic` / `gemini` / `openai` / `qwen`). Không khóa nào được đặt ở đâu cả → bạn nhận prompt thủ công sao-chép-dán thay thế.

Secret được che sau khi lưu và không bao giờ được ghi log. Các trường id-mô-hình (`*_MODEL`) không phải secret.

### Tab Profile (biểu mẫu trường — v1.32.0)

Trước v1.32.0 tab này là một textarea YAML-thô duy nhất nơi mọi
cài đặt nằm trong một khối không-phân-biệt. Giờ nó là một biểu mẫu có cấu trúc, các trường nhóm vào ba mục thu-gọn-được:

- **Candidate** — Họ tên (bắt buộc), Email, Điện thoại, Địa điểm,
  LinkedIn, GitHub, URL Portfolio, X / Twitter.
- **Narrative** — Tiêu đề, Câu chuyện ra đi.
- **Compensation** — Dải mục tiêu, Đơn vị tiền, Mức tối thiểu thoái-thúc,
  Linh hoạt địa điểm.
- **Trình soạn mảng có cấu trúc** (web-ui 1.35.0) — trình soạn
  thêm/xóa-dòng cho các trường dạng danh sách, nên đến những trường này cũng không cần YAML thô: **Target roles** + **Superpowers** (danh sách chuỗi);
  **Archetypes** (dòng name / level / fit); **Proof points** (dòng name /
  url / hero-metric). Dòng trống bị bỏ; danh sách rút sạch sẽ gỡ khóa
  một cách sạch sẽ. Cùng cam kết hợp-nhất-không-phải-thay-thế — mọi
  mảng bạn không đụng tới sống sót nguyên vẹn.

Vì sao việc lưu an toàn:

- Biểu mẫu chỉ gửi 14 đường vô-hướng được mô hình hóa dưới dạng
  `{ fields: { "candidate.full_name": … } }`. Máy chủ **đọc
  `config/profile.yml` hiện có, chỉ đặt/xóa đúng những lá đó, và
  tuần-tự-hóa lại toàn bộ đối tượng** — nên các mảng lồng nhau mà biểu mẫu
  không mô hình (`target_roles.archetypes`, `narrative.proof_points`,
  `narrative.superpowers`) và mọi khóa tùy chọn bạn tự thêm
  **sống sót qua lượt đi-về nguyên vẹn**. Xóa trắng một trường gỡ khóa đó
  sạch sẽ (không để lại `phone: ""`).
- Kiểm tra vẫn yêu cầu họ tên; phần đầu `# Career-Ops Profile
  Configuration` được đóng dấu tự động.
- Một đánh đổi: lưu-biểu-mẫu **tuần-tự-hóa lại YAML, nên chú thích
  `#` nội dòng bị mất**. Để giữ chú thích hay sửa mảng lồng nhau,
  dùng mục mở-rộng **Advanced: edit raw YAML** ở dưới tab — đó là
  trình soạn toàn-tệp trước-1.32, không đổi (thay thế toàn bộ tệp khi lưu).
- Tóm tắt chỉ-đọc tại `#/profile` là người bạn đồng hành trực quan.

### Các khóa được công nhận

Những khóa hay cần nhất. Đây là một tuyển chọn, không phải bảng kê — `#/config` liệt kê **tất cả** khóa được công nhận, theo nhóm, mỗi khóa một gợi ý.

| Khóa | Tác dụng | Lấy ở đâu |
|---|---|---|
| `ANTHROPIC_API_KEY` | Bật các lời gọi SDK Anthropic trực tiếp. Ưu tiên khi cả Anthropic + Gemini đều đặt — đầu-ra có cấu trúc dạng-dài tốt hơn cho chấm JD và nghiên cứu sâu. | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | Ghi đè mặc định `claude-sonnet-4-6`. Thử `claude-opus-4-7` cho suy luận nặng, `claude-haiku-4-5-20251001` cho rẻ-và-nhanh. | — |
| `GEMINI_API_KEY` | Dự phòng khi không có khóa Anthropic. Được `gemini-eval.mjs` dùng cho mode `oferta`. Gói miễn phí đủ cho lượng thấp. | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | Ghi đè mô hình Gemini mặc định. | — |
| `PORT` | Cổng bind của Express. Mặc định 4317. | — |
| `HOST` | Địa chỉ bind. Mặc định `127.0.0.1`. Đặt `0.0.0.0` mở UI lên LAN — **chưa có cổng xác thực**, xem tài liệu Production-readiness. | — |

### Hành vi

- **Đọc** (`GET /api/config`) trả về mọi khóa được công nhận. Khóa
  secret (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) được **che** — bạn thấy
  `sk-ant•••••••a1b2`, không bao giờ thấy giá trị đầy đủ.
- **Lưu** (`POST /api/config`) kiểm tra từng giá trị, ghi vào
  `<parent>/.env`, và áp dụng ngay vào tiến trình đang chạy.
  Không cần khởi động lại.
- **Giá trị trống xóa khóa** — cài đặt quay về *chưa đặt*, và mặc định dự án được áp dụng lại.
- **Dropdown dẫn đầu bằng "Dùng mặc định (…)".** Chọn nó nghĩa là khóa *không được đặt* trong `.env`: ứng dụng dùng mặc định dự án, và bạn tiếp tục nhận giá trị mới mỗi khi dự án đổi. Chọn cùng giá trị đó từ danh sách bên dưới là **ghim** nó — nó ở lại kể cả khi mặc định đổi.
- **Trường bạn không đụng không bao giờ bị ghi.** Một trường chưa đặt hiển thị mặc định để bạn thấy máy chủ sẽ dùng gì; giá trị hiển thị đó không được lưu trừ khi bạn thật sự sửa trường.
- **Lưu báo cáo những gì đổi.** Toast đếm số khóa được ghi *và* số khóa bị xóa, nên xóa trắng một trường hiện `· 1`, không phải `· 0`.

### Nút smoke-test

Sau khi lưu, bấm **▶ Test Anthropic** hay **▶ Test Gemini** — cả hai
bắn một prompt nhỏ (≤256 token đầu-ra) để bạn gần như không
tốn gì trong lúc xác nhận khóa được nối đúng. Trả về một mẫu
~200 ký tự khi thành công.

**Tab AI CLI tools.** career-ops được vận hành bằng Claude Code nhưng hoạt động với mọi agent CLI theo chuẩn skill mở. Tab **AI CLI tools** liệt kê những cái nó biết — Claude Code, Cursor, Codex, Gemini CLI, OpenCode, GitHub Copilot CLI, Qwen, Antigravity, Kimi CLI, Grok Build CLI — và cho biết cái nào **đã cài trên máy đang chạy máy chủ** và ở đâu. Đó là quét chỉ-đọc `PATH` của máy chủ: nó chỉ kiểm tra binary có tồn tại không, **không bao giờ chạy nó** (không `--version`, không thực thi), và không ghi gì. Nếu không cái nào hiện lên, hãy cài một cái (vd Claude Code) để điều khiển pipeline từ terminal.

**Diện mạo — logo công ty.** Thẻ **Appearance** có một công tắc: **Hiện logo công ty trong bảng kết quả quét**. Mặc định tắt. Khi bật, mỗi dòng quét hiện logo công ty — **favicon lấy từ tên miền của chính nó** và proxy qua máy chủ (`/api/logo`), nên không dịch vụ logo bên thứ ba nào biết bạn đang xem những nhà tuyển dụng nào. Tin đăng trên một bảng việc làm dùng chung (Greenhouse, Lever, Ashby, …) hiện **huy hiệu chữ cái** có màu thay cho biểu tượng của bảng, và logo nào tải lỗi cũng quay về huy hiệu đó. Thuần mỹ thuật — không ghi gì và không có dữ liệu CV/hồ sơ nào liên quan.

### Setup doctor — phát hiện CV hay hồ sơ chưa hoàn chỉnh

Tab **Setup doctor** trên `#/config` chạy kiểm tra chỉ-đọc xem `cv.md` và `config/profile.yml` của bạn có thật sự được điền không — và cảnh báo khi dữ liệu mẫu hay placeholder còn sót, hay số liệu cứng trong các tệp prompt (`modes/_shared.md`, `modes/_writing.md`, `batch/batch-prompt.md`) lọt qua. Nó tách **lỗi** (thứ pipeline cần nhưng thiếu, chẳng hạn chưa có `cv.md`) khỏi **cảnh báo** (dữ liệu mẫu còn đó, CV trông quá ngắn, một chỉ số đáng ngờ). Không ghi gì và không gửi đi đâu — nó chỉ đọc và báo cáo. Bấm **Re-run check** sau khi sửa các tệp ấy. Trên bản cài standalone không có dự án gốc, tab hiện một dòng "không khả dụng" trầm thay thế.

---

## 3. Hồ sơ (`#/profile` — cũng tới được qua `#/settings`)

Chế độ xem thẻ tóm-tắt chỉ-đọc của `config/profile.yml`. **Để sửa**,
hãy tới **App settings → tab Profile** (`#/config` → Profile) — từ
web-ui 1.32.0 đó là một biểu mẫu theo-từng-trường (Candidate / Narrative /
Compensation), không còn là khối YAML thô. Lưu hợp nhất vào cùng tệp;
trang này đọc lại khi tải lại.

Những trường quan trọng nhất:

- `candidate.full_name` — dùng trong mọi prompt. **Hãy thay placeholder
  `Jane Smith`** trước khi quét bất cứ thứ gì thật, nếu không các thư
  xin việc được tạo sẽ đi ra dưới tên placeholder.
- `candidate.email`, `linkedin`, `github` — được tham chiếu khi tạo
  thư xin việc và trong danh mục kiểm tra apply.
- `target.roles` — các chức danh chấp nhận. Bộ lọc positive của scanner
  dùng chúng ngầm (qua `portals.yml::title_filter`).
- `target.comp_total_min_usd` — tổng lương tối thiểu. Mục D của mọi
  đánh giá gắn cờ offer dưới mức này.
- `target.archetypes` — *trường quan trọng nhất*. Đây là các
  mẫu sự nghiệp bạn chấp nhận (vd `Tech-Lead-Backend`,
  `Founding-Engineer`, `Data-Platform`). Mọi JD được so khớp với
  chúng và archetype khớp-nhất đổ vào phần đầu báo cáo.

Trang Health hiển thị mục kiểm tra **Profile customized** thất bại chừng nào
`full_name` còn khớp một tên placeholder đã biết.

---

## 4. CV (`#/cv`)

Nguồn chân lý duy nhất cho mọi đánh giá, nghiên cứu sâu và thư
xin việc. Nằm trong `cv.md` tại thư mục gốc dự án.

### Các cách sửa

- **Dán trực tiếp** — textarea bên trái là một trình soạn
  markdown. Khung phải phản chiếu những gì LLM (và recruiter
  tương lai của bạn) thấy.
- **📁 Upload CV** — chọn tệp cục bộ ở bất kỳ định dạng nào sau đây và
  máy chủ chuyển nó sang markdown giúp bạn:
  - **Định dạng văn bản** — `.md`, `.markdown`, `.txt`, `.html`, `.htm`
    được đưa thẳng qua (HTML đi qua pandoc → markdown GFM).
  - **Định dạng Office** — `.docx`, `.doc`, `.odt`, `.rtf` được
    chuyển qua **pandoc** (`brew install pandoc` trên macOS,
    `apt install pandoc` trên Linux).
  - **PDF** — `.pdf` được trích qua **pdftotext** từ Poppler
    (`brew install poppler` / `apt install poppler-utils`).
  - Markdown chuyển đổi đổ vào trình soạn; bấm **💾 Save**
    để giữ lại. Kết quả được làm sạch (cùng lượt strip XSS như dán).
  - Giới hạn cứng: **10 MB** mỗi lần tải lên. Tệp lớn hơn → 413.
- **Từ LinkedIn** — đường dễ nhất: mở Claude Code trong dự án
  gốc, chạy `/career-ops`, dán URL LinkedIn của bạn, và nhờ
  `extract my CV from this and write it to cv.md`.

### Những gì bị làm sạch

Phía máy chủ, mọi PUT tới `/api/cv` đi qua `stripDangerousMarkdown`:

- Các thẻ `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<style>`,
  `<form>` — bị loại hoàn toàn.
- Inline event handler (`onclick=`, `onerror=`, v.v.) — bị strip.
- Các scheme URI `javascript:`, `vbscript:`, `data:text/html` — bị vô hiệu.

Phản hồi kèm `sanitized: true` bất cứ khi nào có thứ gì ở trên bị
loại, để bạn biết nguồn có thứ gì đó bẩn.

Giới hạn kích thước body: 1 MB. Lớn hơn trả về 413.

### Các nút khác

- **sync-check** — chạy `cv-sync-check.mjs` trong dự án gốc.
  Gắn cờ mâu thuẫn: một dự án có trong CV nhưng không có archetype
  `data/applications.md`, v.v.
- **📄 Generate PDF** — streaming `generate-pdf.mjs`. Kết quả đổ vào
  `output/*.pdf`. Cần Playwright (trang Health cho biết nó
  có trong `node_modules` của dự án gốc chưa). Khi tạo xong,
  PDF **mới nhất** tự tải về thư mục Downloads mặc định; danh sách
  trên trang giữ mọi tệp đã tạo trước đó.

### Mẹo văn phong / định dạng

- Một gạch đầu dòng = một thành tựu kèm một chỉ số.
  *"Giảm độ trễ p99 38%"* thắng *"cải thiện hiệu năng"* ở
  mọi thang đánh giá.
- Các mục theo thứ tự này: **Tóm tắt** (3–5 dòng), **Kinh nghiệm**
  (ngược-thời-gian), **Dự án** (tối đa 5), **Học vấn**,
  **Kỹ năng** (đã khử trùng lặp, không xúp-từ-khóa hoa mỹ).
- Giữ dưới 1500 từ. Thang điểm thiên về thông tin dày; một CV
  dài dòng bị phạt vì nhiễu.

---

## 5. Cổng việc làm & nguồn (`portals.yml`)

Cấu hình scanner nằm trong `portals.yml` tại thư mục gốc. Ba
phần quan trọng. Ba phần của SPA (bên dưới) khớp 1:1 với schema
chính thức career-ops.org từ
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals).

> **Đường tắt:** URL `#/portals` giờ trỏ thẳng tới **App
> settings** và (khi một nguồn khu vực được cấu hình) nhảy tới nhóm
> **Regional sources** — nên liên kết `#/portals` đã lưu-đánh-dấu hay gõ-tay
> không còn 404 (v1.42.0).

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

Một tin được quét đi qua khi tiêu đề của nó chứa **ít nhất một
từ khóa positive** VÀ **không từ khóa negative nào**. Tinh chỉnh cả hai.
Từ khóa là chuỗi-con không-phân-biệt-hoa-thường.

`seniority_boost` là khóa thứ ba của bộ lọc tiêu đề. Từ khóa liệt kê
ở đây không lọc gì ra — chúng đẩy các việc khớp lên cao hơn trong
kết quả để "Senior Backend Engineer" xếp trên "Engineer".
Mặc định: `["Senior", "Staff", "Lead"]`. Tinh chỉnh theo cách các vị trí
mục tiêu của bạn được đặt tiêu đề.

Bắt đầu với 3–5 từ khóa positive cho rõ ràng; mở rộng sau.

### `location_filter` (tùy chọn — web-ui 1.33.0, parent #570)

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

Lọc tin được quét theo chuỗi **địa điểm** (không-phân-biệt-hoa-thường
kiểu chuỗi-con), áp dụng bởi cả lượt quét ATS lẫn lượt quét khu vực.
Ngữ nghĩa, giống hệt `scan.mjs` chính thức của career-ops:

- Không có khóa `location_filter` → mọi địa điểm đi qua (mặc định).
- Tin có địa điểm **trống/thiếu** → đi qua (dữ liệu thiếu không bị phạt).
- Khớp từ khóa `block` → **bị loại** (block ưu tiên hơn
  allow).
- Khớp từ khóa `always_allow` → **đi qua** kể cả khi một từ khóa `block` cũng khớp — lối thoát cho chuỗi địa điểm đa-quốc-gia (v1.248.1).
- Khớp từ khóa `block_hard` → **bị loại**, và `always_allow` không thể override.
- `allow` rỗng → đi qua (block đã lọc rồi).
- `allow` không rỗng → phải khớp **ít nhất một** từ khóa.

Khóa cấp-đỉnh trong `portals.yml` (một phần tử ngang-hàng với `title_filter`, không lồng
dưới `russian_portals`). Dùng nó để bỏ các việc lọt qua bộ lọc tiêu đề
nhưng ở vùng bạn không nhận được.

Bắt đầu với 3–5 từ khóa positive cho rõ ràng; mở rộng sau.

**`content_filter` (tùy chọn — web-ui 1.75.0, parent #974).** Một khóa
cấp-đỉnh ngang-hàng với `location_filter`, cùng dạng danh sách từ khóa
`positive` / `negative`, nhưng so khớp với văn bản **mô tả / snippet** của tin
thay vì địa điểm:

```yaml
content_filter:
  positive: ["python", "machine learning"]
  negative: ["security clearance", "on-site only"]
```

Ngữ nghĩa giống hệt `location_filter`: không có khóa → mọi thứ đi qua; tin
có mô tả **trống/thiếu** đi qua (dữ liệu thiếu không bị phạt); khớp
`negative` → bị loại; `positive` rỗng → đi qua; `positive` không rỗng →
phải khớp ít nhất một từ khóa (chuỗi-con không-phân-biệt-hoa-thường). Áp dụng bởi cả
lượt quét ATS lẫn khu vực. Chỉ các nguồn có kèm mô tả/snippet
(vd RSS) bị ảnh hưởng — mọi tin khác đi qua — nên việc bật nó không bao giờ
âm thầm bỏ dòng của các nguồn không mang phần thân. Dùng nó để bỏ một tin
đậu-bộ-lọc-tiêu đề nhưng phần thân lộ ra điều-phá-vỡ-thỏa-thuận.

**`trust_filter` (tùy chọn — web-ui 1.76.0, parent career-ops v1.13.0).** Một
khối cấp-đỉnh **chú thích** (không bao giờ bỏ) từng tin được quét với
điểm tin-cậy (0–100), một mức (`high` / `medium` / `low`) và các cờ. Tắt trừ khi
có mặt và không bị vô hiệu:

```yaml
trust_filter:
  enabled: true
  suspicious_domains: ["bit.ly", "tinyurl.com"]   # tùy chọn — ghi đè danh sách shortener mặc định
  ats_allowlist: ["greenhouse.io", "ashbyhq.com"] # tùy chọn — ghi đè danh sách host ATS mặc định
```

Heuristic: thiếu URL apply (−40), URL không hợp lệ (−50), tên miền shortener đáng ngờ
(−25), công-tý↔tên-miền lệch nhau (−15, bỏ qua với host ATS đã biết).
Các tin dưới mức `high` nhận một huy hiệu **⚠ điểm** trung-tính-ngôn-ngữ trong bảng
`#/scan` (tooltip liệt kê các mã cờ), để bạn liếc thấy các dòng ít-tin-cậy
mà không có gì bị lọc. Bỏ hẳn khối này để giữ hành vi
trước-1.76 (không chú thích, không huy hiệu).

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

`search_queries` điều khiển lượt quét Option B chạy-bằng-AI (`/career-ops scan`
bên trong Claude Code / Cursor / Codex). Chúng KHÔNG được `npm run scan` trong-tiến-trình
thực thi (lượt này chỉ gọi API bảng công khai). Dùng chúng khi
bạn muốn khám phá vị trí tại các công ty chưa có trong
`tracked_companies`. Đặt `enabled: false` để giữ một mục mà không
chạy nó.

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

Các trường bắt buộc mỗi mục: `name` và `careers_url`. Tùy chọn:
`api` (endpoint Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday tường minh),
`enabled: true|false` để loại/bao gồm mà không xóa
mục. Scanner ATS nhận diện ATS từ mẫu URL
(`job-boards.greenhouse.io/<slug>` → Greenhouse, v.v.) và gọi trực tiếp
bảng-api công khai của từng công ty. Công ty không có ATS nhận-diện-được
bị bỏ qua (thẻ **Active Companies** trên `/#/scan` hiện chúng
màu xám với `○`).

**Các nhà cung cấp ATS theo-tenant (v1.76.0 — parent career-ops v1.13.0 parity).** Sáu
ATS nữa tự nhận diện ngay từ `careers_url` (hoặc `api:` tường minh), không cần
`provider:`:

```yaml
tracked_companies:
  - { name: Acme,    enabled: true, careers_url: https://acme.bamboohr.com }          # BambooHR
  - { name: Foo,     enabled: true, careers_url: https://foo.breezy.hr }              # Breezy HR
  - { name: Bar,     enabled: true, careers_url: https://bar.jobs.personio.de }       # Personio (feed XML)
  - { name: Baz,     enabled: true, careers_url: https://baz.recruitee.com }          # Recruitee
  - { name: SolidCo, enabled: true, careers_url: https://solid.jobs/public-api/offers/it }  # SolidJobs
  # Comeet cần URL careers-api đầy đủ (uid + token không nằm trên trang thương hiệu):
  - { name: ComeetCo, enabled: true, api: https://www.comeet.co/careers-api/2.0/company/<uid>/positions?token=<token> }
```

Mỗi cái ghim host của nó bằng một regex neo + `redirect:'error'` (an-toàn-SSRF). Xem
`docs/portals-examples.md` cho các mục copy-paste đầy đủ hơn.

**Ghim một tenant Personio (v1.237.0).** Nhiều công ty nhúng bảng Personio của họ vào một **iframe**
trên trang tuyển dụng mang thương hiệu riêng, nên `careers_url` trỏ vào tên miền
của chính công ty trong khi feed thực nằm ở `<slug>.jobs.personio.de`. Không ghim thì
những bảng đó không phân giải ra gì. Cho slug tenant tường minh và nó thắng
so với `careers_url`:

```yaml
tracked_companies:
  - { name: Acme, enabled: true, provider: personio, personio: acme, careers_url: https://acme.com/careers }
```

Slug bị giới hạn bộ-ký-tự (chữ, số và gạch-ngang, không bắt đầu bằng gạch
-ngang, tối đa 63 ký tự) và URL kết quả vẫn đi qua cùng danh-sách-host
cho phép và kiểm tra HTTPS — một slug chứa dấu chấm, gạch chéo, `@` hay `:` bị từ chối
và mục quay về `careers_url`.

**Hiện loại hình việc làm trong tiêu đề (Jobstreet / SEEK, v1.237.0).** Bật bằng
`appendWorkType` và các loại hình của tin được nối vào tiêu đề, nên bộ
lọc tiêu đề và phân loại thấy được chúng ngay lúc quét. Mặc định tắt:

```yaml
tracked_companies:
  - name: Acme
    enabled: true
    provider: jobstreet
    jobstreet: { siteKey: AU-Main, appendWorkType: true }   # → "Strategy Consultant [Part time]"
```

`siteKey` chọn thị trường: `ID-Main` (id.jobstreet.com), `SG-Main`, `MY-Main`,
`HK-Main` (hk.jobsdb.com), `AU-Main` (au.seek.com, www.seek.com.au) và `NZ-Main` (nz.seek.com, www.seek.co.nz).
Liên kết việc làm được dựng theo từng thị trường — chỉ các host Indonesia dùng tiền tố
vùng `/id/`, nên liên kết dựng cho thị trường khác kèm tiền tố đó trả về 404 (đã sửa trong v1.237.0).

### `rss` (bảng RSS / Atom)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

Trỏ scanner vào bất kỳ bảng việc làm nào phát feed RSS/Atom (LaraJobs, WeWorkRemotely, RemoteOK, golangprojects, …) bằng cách thêm một mục với `provider: rss` cộng một khóa `rss:` (hay `feed_url:`) — **không đổi code**. Adapter RSS đọc từng `<item>` (CDATA + HTML entities, tiêu đề/công ty đã strip-thẻ), chuẩn hóa thành một việc làm, và chạy cùng luồng `title_filter` / `location_filter` + khử-trùng-lặp + nối-pipeline như các nguồn ATS. **RSS** khi đó xuất hiện như một nguồn chọn-được trong dropdown lọc `#/scan`. (web-ui v1.62.x)


### `telegram_channels` (kênh Telegram việc làm công khai)

```yaml
telegram_channels:
  enabled: true
  max_posts: 100          # cap mặc định mỗi kênh (cap cứng 300)
  channels:
    - { name: "PHP jobs", channel: rabotaphp }
    - { name: "Salary PM", channel: salary_pm, max_posts: 50 }
```

Quét bất kỳ kênh Telegram **công khai** nào bằng cách liệt kê nó ở đây — không bot token, không khóa API. Mỗi kênh được đọc từ bản xem trước web công khai của nó tại `https://t.me/s/<channel>`, vốn là HTML thuần render-phía-máy-chủ. `channel:` chấp nhận mọi dạng (`rabotaphp`, `@rabotaphp`, hay một liên kết `t.me/…` đầy đủ); `max_posts:` giới hạn số bài gần nhất được đọc (mặc định 100, cap cứng 300). Các kênh nằm trong khối cấp-đỉnh riêng chứ không nằm trong `tracked_companies`, vì một kênh không phải nhà tuyển dụng và không có URL tuyển dụng để nhận diện.

**Bài đăng trong kênh là văn xuôi, không phải bản-ghi-việc-làm** — không có trường có cấu trúc. Nguồn này nâng một tiêu đề từ dòng có-nội-dung đầu tiên, đọc công ty / địa điểm / lương chỉ từ các nhãn tường minh (`Компания:`, `Локация:`), và giữ toàn bộ văn bản trong phần mô tả. Việc tách tin-thật khỏi quảng cáo và bản-digest là việc của `title_filter` bạn. Kênh riêng-tư hay không-tồn-tại được báo là **lỗi**, không bao giờ là "không có việc làm". **Telegram** khi đó xuất hiện như một nguồn chọn-được trong dropdown lọc `#/scan`. (web-ui v1.228.0)


### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # hoặc chỉ một
  area: 113                 # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries` là các chuỗi so-khớp-chuỗi-con không-phân-biệt-hoa-thường với tiêu đề
việc làm trên hh.ru và Habr Career. **Cẩn thận với chồng lấn với danh sách
negative** — nếu `"Senior PHP"` nằm trong `queries` nhưng `"php"` lại nằm trong
`title_filter.negative`, lượt quét sẽ trả về 0 kết quả và console
sẽ cảnh báo về xung đột.


### Cấu hình các cổng Nga — hướng dẫn thiết lập chi tiết

v1.29.0 phát hành 5 adapter tiếng Nga. Hai cái không cần gì hơn UA mặc định (`habr-career`, scrape HTML; `trudvsem`, API open-data chính phủ — không khóa, không chặn IP). Hai cái là scrape HTML của các bảng công nghệ (`getmatch`, `geekjob` — cũng không khóa). Một cái là API hh.ru chính thức có thể 403 với IP ngoài-Nga trừ khi bạn đặt biến môi trường `HH_USER_AGENT` qua **App settings → API keys & runtime** (hoặc chạy máy chủ từ IP Nga / nút thoát VPN).

#### Bảng kê nguồn

| Khóa nguồn | Nhãn hiển thị | Kiểu | Xác thực | Giới hạn địa lý |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | `HH_USER_AGENT` tùy chọn | IP ngoài-RU có thể 403 |
| `habr` | Habr Career | HTML | không | không |
| `trudvsem` | Trudvsem | JSON API (open-data) | không | không |
| `getmatch` | GetMatch | HTML | không | không |
| `geekjob` | GeekJob | HTML | không | không |

#### Bước 1 — Mở `portals.yml`

Tệp nằm ở thư mục gốc `career-ops/` (KHÔNG phải trong `web-ui/`). Nếu nó chưa tồn tại, chép ví dụ đi kèm dự án gốc:

```bash
# từ thư mục gốc career-ops/ (KHÔNG phải web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### Bước 2 — Bật cả 5 nguồn

Thêm hay cập nhật khối `russian_portals` để liệt kê mọi nguồn bạn muốn quét. Thứ tự trong mảng là vô nghĩa; scanner đi qua chúng theo thứ tự registry.

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]
  area: 113                  # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50               # bao nhiêu việc làm mỗi truy vấn mỗi nguồn
  only_remote: false         # đặt true để chỉ giữ tin từ xa
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Backend Senior"
    - "Тимлид PHP"
```

#### Bước 3 — Tinh chỉnh truy vấn và bộ lọc

`queries` là các chuỗi scanner dùng để tìm kiếm trên từng nguồn. Mỗi truy vấn chạy một lần trên mỗi nguồn — nên 4 truy vấn × 5 nguồn = 20 lời gọi mỗi lần quét. Giữ danh sách tập trung (3–7 truy vấn) để thời gian quét dưới một phút. `area` là mã vùng hh.ru (các nguồn khác bỏ qua). `per_page` giới hạn số việc làm mỗi nguồn trả về cho mỗi truy vấn. `only_remote: true` lọc mọi kết quả xuống chỉ-remote ngay ở tầng adapter (bảng kết quả vẫn có chip Remote riêng).

#### Các bẫy thường gặp

**Xung đột danh-sách-negative.** Nếu một từ trong truy vấn (`"php"`, `"senior"`) cũng xuất hiện trong `title_filter.negative`, mọi kết quả bị lọc ra trước khi bạn thấy. Scanner phát một cảnh báo xung đột ra stderr lúc quét — tìm dòng `⚠ config: query "Senior PHP" contains "php" which is in the negative list`. Sửa bằng cách bỏ từ xung đột khỏi `negative`:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" không còn trong danh sách negative
    - "Senior Go"
```

#### Tắt tạm thời một nguồn

Để tắt một nguồn mà không xóa dữ liệu của nó, chỉ cần bỏ khóa của nó khỏi `sources`:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # chỉ 3 trong 5 nguồn sẽ chạy
```

#### Kiểm chứng thiết lập

Sau khi lưu `portals.yml`:

```bash
# 1. Lưu portals.yml.
# 2. Trong SPA, chuyển tới #/scan.
# 3. Bấm 🌐 Scan now.
# 4. Xem nhật ký SSE cho dòng theo-nguồn của mỗi truy vấn:
#       "Senior PHP"
#         hh.ru    18
#         habr     21
#         trudvsem  3
#         getmatch  0
#         geekjob   2
#    Giá trị 0 là bình thường với một số truy vấn — chỉ nghĩa là
#    nguồn đó không có kết quả khớp. Dòng "geo-blocked" hay "timeout" nghĩa là
#    adapter đã chạm tới trang nhưng không đọc được kết quả.
```

### Luồng bootstrap CLI ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Thiết lập career-ops chính thức (chạy một lần từ thư mục gốc):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

Đó là toàn bộ bootstrap. Sửa ba phần (`title_filter`,
`tracked_companies`, `search_queries`, tùy chọn `russian_portals`),
lưu, và bạn sẵn sàng quét.

### Hành vi bootstrap của SPA

Ở lần chạy đầu máy chủ nối một khối `russian_portals:` có tài-liệu-hóa vào
`portals.yml` nếu nó thiếu — idempotent (lần khởi động thứ hai là no-op
vì dòng `russian_portals:` nguyên-văn đã ở đó). Các phần
tiếng Anh KHÔNG được tiêm tự động; chúng đến từ
`templates/portals.example.yml` mà bạn đã chép theo bootstrap
chính thức ở trên.

**Cooldown tái-ứng-tuyển (v1.84.0).** Thêm khối `re_apply_windows:` vào
`config/profile.yml` để chặn lượt quét tái-làm-lột-ra các vị trí bạn đã
ứng tuyển. Theo từng công ty bạn đặt `last_apply_date` (`YYYY-MM-DD`),
`same_role_days` (độ dài cooldown), `applied_to:` (danh sách chức danh bạn
đã ứng tuyển), và một `cross_role_bucket` tùy chọn (các từ-khóa gạch-dưới, vd
`backend_em`). Chừng nào `today` còn trước `last_apply_date + same_role_days`, mọi
vị trí được quét tại công ty ấy mà tiêu đề khớp `applied_to` (chuỗi-con) hay
các từ-khóa bucket sẽ **bỏ qua** — nhật ký quét hiện `Cooldown skipped: N`
và các dòng đó không bao giờ chạm bảng kết quả hay `pipeline.md`. So khớp công ty
không-câu-trấu-và-dấu-chấm và có ý-thức-ranh-giới-từ (`Acme Inc` khớp
`Acme, Inc.`). Không có khóa `re_apply_windows:` → không cooldown (mặc định).

**Lương thưởng trong `pipeline.md` (v1.84.0).** Khi một offer được quét có
mức lương, nó được nối vào `data/pipeline.md` như một cột đuôi tùy chọn —
`url | salary` — cạnh URL. URL vẫn là khóa khử-trùng-lặp (cột lương
bị strip khi pipeline được đọc lại), ô được làm sạch để nó
không thể tiêm một dòng hay một công-thức-bảng-tính, và các pipeline
URL-trần hiện có vẫn hoạt động không đổi.

### Khám phá bảng ATS của một công ty

Ở đầu `#/portals` có một ô **Discover ATS board**. Gõ tên công ty (ví dụ "Stripe") và ứng dụng dò Greenhouse, Ashby, và Lever tìm một bảng việc làm công khai dưới tên đó — chỉ-đọc, không AI, không trình duyệt. Với mỗi nhà cung cấp có bảng *và* đang liệt kê ít nhất một vị trí mở, bạn nhận một kết quả khớp cho biết nhà cung cấp, URL tuyển dụng và số vị trí mở. Bấm **Add to tracked** và bảng ấy được nối vào `tracked_companies:` trong `portals.yml` của bạn, nên scanner bắt đầu theo dõi nó từ lần quét kế tiếp. Trùng lặp được phát hiện (bạn sẽ thấy "Already tracked") và chỉ các host ATS đã biết mới thêm được — URL tùy ý bị từ chối. Chỉ Greenhouse, Ashby, và Lever được dò; một công ty trên cổng khác, hay không đăng việc nào lúc này, sẽ không hiện kết quả khớp.

---

## 6. Tình trạng (`#/health`)

Mọi cổng thiết lập, dưới dạng huy hiệu OK / OPTIONAL / FAIL. Đọc trang này trước
khi nộp bất kỳ issue "không chạy" nào.

**Mức dùng & chi phí AI (`#/usage`).** Cạnh Health trên thanh bên, trang **AI usage** cho biết bạn đã chi bao nhiêu token cho các lần tạo AI **trực tiếp** — đánh giá, báo cáo, chat — tách theo từng nhà cung cấp qua 24 giờ, 7 ngày, 30 ngày qua và toàn-thời-gian, với chi phí **USD ước tính**. Mọi lời gọi nhà cung cấp trực tiếp nối một bản-ghi nhỏ `{provider, in, out}` vào `data/llm-usage.jsonl`; không gửi đi đâu cả. Con số đô-la chỉ là ước tính từ một bảng giá có thể sửa (`server/lib/llm-pricing.mjs`) — số token là chính xác, nhưng giá là giá niêm yết gần đúng bạn có thể sửa cho khớp gói của mình. Các lần chạy không-khóa-API (chế độ thủ công) không tốn gì và không được ghi. Một đồng hồ đo **USAGE** gọn cũng được ghim ở dưới thanh bên trái trên mọi trang — cùng tổng token 24h / 7d / 30d và chi phí 24 giờ ước tính, làm mới trực tiếp; menu luôn thoáng phía trên nó, và bấm vào phần đầu sẽ thu nó lại.

### Các mục kiểm tra bắt buộc (hệ thống không chạy được nếu thiếu)

- `Node version` ≥ 18 — máy chủ dùng `fetch` native và
  `node:test`.
- `Project root` — rằng `CAREER_OPS_ROOT` (env hoặc tự-dò)
  tồn tại.
- `cv.md`, `config/profile.yml`, `portals.yml`,
  `data/applications.md`, `data/pipeline.md`, `modes/oferta.md`.

### Các mục kiểm tra tùy chọn (chỉ cảnh báo)

- `Profile customized` — `candidate.full_name` không còn là placeholder
  mẫu.
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — đã đặt trong `.env`.
- `Playwright (parent node_modules)` — cần cho tạo PDF
  và `check-liveness.mjs`. Cài bằng
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`.
- `Parent project dependencies` — `cd $CAREER_OPS_ROOT && npm install`
  nếu thiếu.
- Các thư mục `data/`, `reports/`, `output/`, `jds/` — tự tạo ở
  lần ghi đầu.

Khi máy chủ được mở ra ngoài loopback (`HOST=0.0.0.0`), các
đường dẫn tuyệt đối và phiên bản Node chính xác được thay bằng `"hidden"`
trong phản hồi để hàng-xóm tò-mò không fingerprint được bản cài của bạn.

### Các nút chạy

- **▶ Doctor** chạy `node doctor.mjs` và hiện kết quả trong một modal.
- **▶ Verify pipeline** chạy `node verify-pipeline.mjs`.

---

## 7. Quét (`#/scan`)

Scanner bò qua mọi bảng đang bật, khử trùng lặp với lịch sử
của bạn, và ghi các kết quả trúng vào `data/last scan.json` và
`data/pipeline.md`.

### Quét một cú bấm (SPA)

**🌐 Scan** chạy mọi nguồn đang bật trong một lượt duy nhất:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (lượt quét ATS) cho mọi công ty trong
  `tracked_companies` có URL ATS nhận diện được.
- Các aggregator v1.75.0 cho mọi mục `tracked_companies` chọn tham gia: RemoteOK / Remotive / Working Nomads (feed remote toàn bảng, `provider: <slug>`) và IBM / Arbeitsagentur / Glints / Jobstreet · SEEK (điều khiển bằng cấu hình, khối `<provider>:` theo mục).
- hh.ru API + Habr Career + Trudvsem + GetMatch + GeekJob cho mọi truy vấn trong `russian_portals`.

**Hai pha, một cú bấm (v1.29.2).** Nút 🌐 Scan duy nhất điều khiển CẢ lượt quét ATS lẫn lượt quét khu vực trong một luồng SSE. Bạn sẽ thấy hai phần đầu pha trong nhật ký, theo thứ tự:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — các bảng ATS EN.
2. `▶ Regional scan (hh.ru + Habr Career)` — 5 nguồn RU từ registry.

Mỗi pha kết thúc bằng một tóm tắt `✓ done · NEW=N`. Nếu bạn chỉ thấy pha ATS, bản của bạn là pre v1.29.2 — hãy nâng cấp. Trước v1.29.2, client SSE đóng ở sự kiện `done` đầu tiên và pha khu vực bị bỏ lặng lẽ (`tests/scan stream multi phase.test.mjs` là lưới hồi quy).

Nhật ký SSE trực tiếp đổ vào khung phải trong lúc quét chạy. Bấm
**Stop** (hoặc chỉ cần rời trang) để hủy — máy chủ hủy
các yêu cầu HTTPS đang bay qua `AbortController`.

### Lọc kết quả

Dưới nhật ký, bảng kết quả render các dòng từ `data/last scan.json`.

**Search + Exclude (v1.109.0).** Ô **Search** là bộ lọc "vị trí cần tìm" của bạn — gõ một hay nhiều thuật từ **phân tách bằng phẩy** và một dòng hiện ra nếu khớp **bất kỳ** cái nào (HOẶC). Ô **Exclude** mới làm điều ngược lại: các từ phân tách bằng phẩy **ẩn** mọi dòng mà công ty / vị trí / địa điểm của nó chứa chúng (vd exclude `senior, staff, java`). Cả hai được các truy vấn đã lưu của bạn ghi nhớ cùng với các bộ lọc remote / nguồn / quốc gia / đăng trong / lương.

> **v1.76.0 — bỏ cap kết quả.** Các bản trước lưu tối đa 2000 dòng khớp
> mỗi vùng (`MAX_STORED_RESULTS`), âm thầm giấu phần đuôi của một lượt quét lớn.
> Cap đó **đã biến mất**: mọi tin khớp được lưu và bảng chỉ đơn giản
> lật trang qua chúng (200 mỗi trang — dùng các nút phân trang dưới bảng).
> Không gì bị bỏ; bạn chỉ việc lật trang.

> **v1.78.1 — tự làm mới trực tiếp.** Bảng kết quả giờ tự cập nhật
> trong lúc quét chạy và thêm một lần nữa ngay khi nó xong — không cần
> tải lại hay chuyển trang thủ công. Bộ đệm được đặt lại ở đầu mỗi lần quét và làm đầy lại.

> **v1.80.0 — Max per source & cách ly nguồn.** Trường **Max per source**
> cạnh nút Scan giới hạn số việc làm mỗi bảng đóng góp (trống/0 =
> không giới hạn, mặc định) — tiện khi một bảng khổng lồ lấn át các bảng khác.
> Riêng, bất kỳ nguồn nào trả về **404 / 410** vĩnh viễn sẽ được ghi vào
> `data/scan-quarantine.json` và bị bỏ qua ở các lần quét sau (tự chữa: được thử lại
> sau 14 ngày), nên các slug chết ngừng spam nhật ký. Tắt bằng
> `scan_quarantine: false` trong `portals.yml`.

Các bộ lọc:

- **Văn bản tự do** — so khớp chuỗi con với tiêu đề / công ty.
- **Nguồn** dropdown — Arbeitsagentur / Ashby / BambooHR / Breezy HR / Comeet / GeekJob / Glints / Greenhouse / GetMatch / Habr Career / hh.ru / IBM / Jobstreet · SEEK / Lever / Personio / Recruitee / RemoteOK / Remotive / RSS / SmartRecruiters / SolidJobs / Teamtailor / Trudvsem / We Work Remotely / Workable / Workday / Working Nomads (tự làm đầy từ `GET /api/scan/sources`).
- **Remote / Hybrid / Onsite** dropdown.
- **Quốc gia** dropdown (v1.78.0) — một bộ lọc địa lý làm đầy từ các quốc gia được phát hiện trong kết quả hiện tại, mỗi quốc gia kèm emoji cờ và số đếm (vd `🇩🇪 Germany (12)`). Chọn một quốc gia để chỉ giữ các vị trí gắn với quốc gia đó. Việc nhận diện ánh xạ địa điểm văn bản tự do của một tin (tên quốc gia/bí danh + ~100 thành phố thị trường việc làm lớn) về một quốc gia; nó thận trọng và không bao giờ đoán, nên một tin có địa điểm không phân giải được — hay tin thuần "Remote" — ở lại dưới **All countries**. Kết hợp với dropdown loại hình làm việc để tìm các vị trí gắn quốc gia *và* remote.
- **Posted within** dropdown (v1.80.0) — bộ lọc tuổi phía client (24 giờ qua / 7 ngày / 30 ngày). Dòng có `pubDate` cũ hơn bị ẩn; dòng **không có ngày vẫn đi qua** (thiếu dữ liệu không bị phạt).
- **★ Yêu thích** (v1.80.0) — bấm ☆ ở bất kỳ dòng nào để gắn sao một việc (lưu trong `localStorage` theo URL); tích **★ Yêu thích** trong khung lọc để chỉ hiện dòng đã gắn sao. Sao sống sót qua các lần quét và tải lại.
- **Truy vấn đã lưu** (v1.80.0) — thanh phía trên các bộ lọc: đặt tên cho bộ lọc hiện tại và **💾 Save**, rồi áp dụng lại từ dropdown hay **🗑 Delete** nó. Lưu trong `localStorage`; giá trị hỏng/bị sửa đặt lại sạch về rỗng.
- **Chip công nghệ** (PHP / Go / Backend / Senior / …) — tự phát hiện
  theo từng dòng bởi `Skills.detectTech` và `Skills.detectLevel`. Chọn nhiều
  dạng giao — chọn `PHP + Senior` hiện các dòng có CẢ HAI.
- **Chip động** dưới các chip tĩnh — top-25 token viết hoa
  thường xuyên nhất từ các tiêu đề, nên UI thích ứng với
  đúng những vị trí bạn thực sự quét (marketing, design, tài chính…)
  thay vì bị khóa vào từ vựng kỹ sư backend.

### Thẻ Active Companies

Một thẻ thu gọn được liệt kê mọi công ty trong `portals.yml` cùng
trạng thái quét:

- ✓ thẻ xanh — hỗ trợ API trực tiếp (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday).
- ○ thẻ xám — quay về prompt tìm kiếm web (không khớp API).

**Bấm tên công ty** → điền bộ lọc kết quả phía trên bằng tên đó. **Bấm biểu tượng ↗** → mở `careers_url`
của công ty trong tab mới.

### Luồng quét CLI ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Hai cách quét từ phía CLI (cả hai đổ URL vào cùng
`data/pipeline.md` mà SPA đọc):

**Option A — script trực tiếp (~30 giây, 0 token AI):**

```bash
npm run scan                          # mọi bảng Greenhouse/Ashby/Lever
npm run scan -- --dry run             # xem trước không ghi
npm run scan -- --company Anthropic   # thu hẹp một công ty đang theo dõi
```

Chỉ hoạt động với Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (URL ATS nhận diện được).
Không tốn token AI — nó gọi thẳng các API bảng công khai.

**Option B — quét trình duyệt chạy bằng AI:**

```
/career-ops scan
```

Bên trong Claude Code / Cursor / Codex / OpenCode / Antigravity CLI / Grok Build CLI / Qwen Code / Kimi / GitHub Copilot CLI (Gemini CLI legacy). Tốn token mô hình.
Trực tiếp vào từng trang `tracked_companies` và có thể khám phá các bảng
không phải API (trang tuyển dụng, ATS riêng, cổng khu vực). Chậm hơn nhưng
rộng hơn. Hữu ích khi một lượt quét ATS không trả gì cho một mục tiêu
bạn biết đang tuyển.

**Kết quả (cả hai đường)** — các URL JD mới được nối vào `data/pipeline.md`,
mỗi URL đã thăm được ghi vào `data/scan-history.tsv` (khử trùng lặp qua mọi
lần quét sau), tóm tắt được in: công ty đã quét · việc tìm thấy ·
lọc bởi tiêu đề · trùng lặp bỏ qua · việc mới được thêm.

**Ngưỡng hành động theo điểm** (áp dụng sau khi `/career-ops pipeline`
chấm batch các URL mới):

| Điểm | Bước tiếp theo đề xuất |
|---|---|
| **≥ 4.5** | `/career-ops apply` — khớp cao, đẩy ngay |
| **4.0 – 4.4** | nộp đơn, hoặc `/career-ops contacto` để được giới thiệu thân thiện |
| **3.5 – 3.9** | `/career-ops deep` — nghiên cứu trước |
| **< 3.5** | bỏ qua trừ khi bạn có lý do cá nhân cụ thể |

`#/dashboard` và `#/tracker` của SPA làm nổi bật mọi dòng từ
4.0 trở lên để bạn chọn hành động mà không cần chạy lại gì.

### Các lệnh nhắc lại

Sau khi chấm điểm, các bước nhắc lại chính thức là:

- `/career-ops apply` — Điền đơn ứng tuyển với các câu trả lời được điều chỉnh
- `/career-ops contacto` — Soạn thư tiếp cận LinkedIn / email
- `/career-ops deep` — Nghiên cứu sâu công ty / vị trí
- `/career-ops tracker` — Xem trạng thái pipeline

---
### hh.ru — quét từ trang web (cần IP Nga từ tháng 7/2026)

hh.ru được quét bằng cách đọc trang tìm kiếm công khai của nó (`hh.ru/search/vacancy`), cùng cách Habr Career được quét — không khóa và không cấu hình. **Tuy nhiên từ tháng 7/2026, hh.ru trả về HTTP 451 (một lệnh chặn pháp- lý khu vực) cho các IP ngoài Nga**, nên lượt quét chỉ chạy được từ một IP Nga — hãy chạy máy chủ từ Nga hoặc qua VPN với nút thoát Nga. Ở lần 451 đầu tiên (hay một 403 chống bot), scanner tắt hh.ru cho phần còn lại của lượt và nói vậy trong nhật ký, nên các nguồn Nga khác vẫn chạy trọn. API JSON (`api.hh.ru`) được cố tình *không* dùng: nó trả `403 forbidden` cho mọi client lập trình bất kể IP hay User Agent.

Ngay cả từ một mạng *có vẻ* đúng, hh.ru có thể gắn cờ IP đầu ra là VPN/proxy (mọi IP datacenter/hosting đều bị tính) và 302-redirect lượt quét tới một trang chặn `/vpncheeck` ("VPN мешает работе сайта") trả về HTTP 200 với **zero** việc làm. Scanner phát hiện redirect này, tắt hh.ru cho phần còn lại của lượt và nói vậy trong nhật ký. Cách sửa nằm ở phía mạng: đảm bảo traffic thực sự đi ra qua một IP dân cư — VPN hay proxy toàn hệ thống thường vẫn bật kể cả khi công tắc trình duyệt tắt (kiểm tra IP đầu ra thật của bạn, vd tại api.ipify.org).

## 8. Pipeline (`#/pipeline`)

Hộp vào các URL chờ đánh giá. Nằm trong `data/pipeline.md`.

**Dải tổng quan (v1.109.0).** Ở đầu trang, một dải gọn cho bạn thấy pipeline qua một cái nhìn — bao nhiêu URL **trong hộp vào**, bao nhiêu dòng **đang theo dõi**, và các con số cho **Applied / Responded / Interview / Offer** lấy từ tracker. Mỗi chip dẫn thẳng tới `#/tracker` (các chip trạng thái mở nó ở dạng đã lọc). Nó suy giảm xuống chỉ số đếm hộp vào nếu không đọc được tracker.

### Thêm URL

Ba cách:

- Gõ / dán một URL vào ô nhập + bấm **+ Add**.
- Dùng **ô tìm kiếm toàn cục trên thanh trên** (huy hiệu của nó ghi **Enter**): dán bất kỳ liên kết `http(s)://…` và bấm **Enter** để mở auto pipeline;
  gõ văn bản khác và **Enter** nhảy tới `#/scan` với thuật từ đó
  điền sẵn (v1.78.1). Ctrl/Cmd+K vẫn trỏ focus vào ô nơi
  trình duyệt cho phép. **Logo** thương hiệu quay về dashboard.
- Chạy một lượt Scan (xem trên) — các kết quả mới tự đổ vào
  pipeline.

Mọi URL đi qua `isValidJobUrl()` phía máy chủ. Loopback
(`localhost`, `127.0.0.1`), `file://`, `javascript:`, IP literal, và
chuỗi chứa ký tự template (`<`, `>`, `"`) đều nhận 400.

### Khung xem trước phía máy chủ

Bấm bất kỳ dòng pipeline nào để nạp bản xem trước bên phải. Đa số bảng ATS
không gửi header CORS nên trình duyệt không thể gọi trực tiếp; máy chủ
proxy yêu cầu, strip `<script>` / `<style>` / thẻ HTML,
và trả về tối đa 8 KB văn bản thuần.

Proxy xem trước đi qua các redirect thủ công với **xác thực SSRF
từng bước** — mọi header `Location` lại đi qua `isValidJobUrl()`
thêm một lần, nên một bảng ác ý không thể ném bạn về loopback / IP riêng
/ `file://`. Giới hạn 3 bước, timeout 15 giây.

### Thao tác trên dòng

- **▶** — nhảy tới `#/evaluate?url=…` với URL điền sẵn.
- **✕** — xóa URL khỏi `data/pipeline.md`.

### Các nút trên phải

- **⚡ Evaluate first** — mở URL đầu tiên trong hàng đợi trên trang
  Evaluate, sẵn sàng chấm điểm.
- **Scan** — quay về scanner nếu bạn muốn thêm URL.

---

## 9. Đánh giá (`#/evaluate`)

Chấm điểm một Mô tả Công việc đơn lẻ so với `cv.md` và
`config/profile.yml`. Trả về một đánh giá A–G có cấu trúc theo
`modes/oferta.md` cộng một điểm 0–5.

### Đầu vào

Dán JD vào textarea, hoặc tới đây từ `#/pipeline` với
`?url=<href>` — trang tải URL qua cùng proxy
an toàn SSRF dùng cho các bản xem trước pipeline và điền sẵn textarea.

Bấm **💾 Save JD** để giữ JD vào `jds/jd-<date>-<ts>.txt`
cho dấu vết kiểm toán (hoặc truyền `save: true` trong lời gọi API — cùng
hiệu quả).

### Chuỗi dự phòng

1. **Anthropic** — ưu tiên khi `ANTHROPIC_API_KEY` đã đặt. Máy chủ
   gói `cv.md`, `config/profile.yml`, `modes/_shared.md`,
   và `modes/oferta.md` vào một khối `<project_context>` trước
   prompt (cap theo từng loại tệp — cv 64 KB, tệp mode 128 KB, còn lại 32 KB — với toàn bộ prompt cap mềm ở 256 KB). Trả markdown có gốc rễ trực tiếp lên trang.
2. **Gemini** — khi chỉ có `GEMINI_API_KEY`. Máy chủ khởi chạy
   `gemini eval.mjs` với JD là tệp tạm. Mô hình gói miễn phí
   (`gemini-3.6-flash`) đủ cho chấm điểm thường nhật.
3. **Thủ công** — chưa đặt khóa nào. Trang trả một prompt dạng đầy đủ
   bạn có thể dán vào Claude Code, ChatGPT, hay bất kỳ LLM nào khác.

### Các phần đầu ra (career-ops.org A-F chính thức)

> **Tái căn chỉnh v1.15.0.** Các chữ khối giờ khớp
> [schema chính thức career-ops.org](https://career-ops.org/docs).
> Các báo cáo trước v1.15 dùng A–G (với `C=Risks`, `F=Verdict`,
> `G=Legitimacy`); chúng ta vẫn render nguyên trạng cho khả năng tương thích
> ngược, nhưng báo cáo mới phát A–F với ngữ nghĩa chính thức
> bên dưới. Điểm và Legitimacy giờ nằm ở phần đầu báo cáo
> (`score: 4.2/5`, `legitimacy: High|Medium|Low`).

A. **Role Summary** — tóm tắt 3 gạch đầu dòng (rủi ro được nêu ngay tại chỗ).
B. **CV Match** — top 3 kỹ năng trúng + top 3 còn thiếu.
C. **Strategy** — khuyến nghị: nộp ngay / contacto trước /
deep trước / bỏ qua. Trước đây là `Risks` trước v1.15.
D. **Compensation** — so với
`target.comp_total_min_usd` (legacy) hay `compensation.target_range`
(chính thức).
E. **Personalization** — góc cần dẫn dắt, định vị theo archetype,
điểm móc cần nhắc trong thư xin việc / tiếp cận. Trước đây là `Application
Strategy` trước v1.15.
F. **STAR stories** — 1–3 khối S T A R sẵn sàn dán được điều chỉnh theo vị trí. Trước đây là `Verdict` (điểm thô) trước v1.15; điểm giờ
xuất hiện ở phần đầu báo cáo cạnh `legitimacy`.

### Lưu báo cáo

Bấm **💾 Save report** (hay dùng công tắc lưu trong lời gọi API) để
giữ markdown vào `reports/<date>-<company>-<role>.md`. Phần đầu
đã phân tách của báo cáo (Score / Legitimacy / URL) xuất hiện trên trang
**Reports** và **Dashboard**.

### Đánh giá hàng loạt khi bạn có 10+ JD

Cho một JD đơn lẻ, trang `#/evaluate` này là đúng công cụ. Với 10+
URL trong hàng đợi pipeline, việc bấm qua từng JD là bất khả thi
— hãy nhảy tới mục con **Batch evaluate** của §14 (chạy
`./batch/batch runner.sh` từ thư mục gốc), để nó gặm qua
đêm, rồi quay lại `#/reports` / `#/tracker` xem
kết quả. Toàn bộ luồng:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

---

## 10. Báo cáo (`#/reports`)

Duyệt mọi đánh giá đã lưu. Các thẻ hiện tiêu đề, ngày, cờ
độ chính đáng, và điểm (màu mã hóa: xanh ≥ 4.0, vàng ≥ 3.0, đỏ dưới mức).

Bấm một thẻ để đọc toàn bộ markdown. Phân trang: 12 mỗi trang;
nút điều khiển ở dưới.

Chế độ xem báo cáo đơn còn có:

- **← All reports** — quay về lưới.
- **🔗 Open JD** — mở tin tuyển dụng gốc trong tab mới.

### Xuất báo cáo ra PDF

Mở một báo cáo đã lưu và bấm **📄 Generate PDF**. Nó streaming
`generate pdf.mjs` trong dự án gốc và ghi tệp vào
`output/*.pdf` (việc này cần Playwright — trang Health cho biết nó
được cài chưa). Không gửi đi đâu cả: xem lại PDF trước khi đính kèm
nó vào một đơn ứng tuyển.

---

## 11. Trình theo dõi (`#/tracker`)

Chiếc CRM. Mỗi đơn một dòng; nằm trong `data/applications.md` dưới dạng
bảng GitHub Flavored Markdown.

### Luồng trạng thái

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Hired` / `Rejected` / `Discarded` / `SKIP`.

`Hired` (v1.118.0) là trạng thái hạnh phúc cuối cùng — offer đã được chấp nhận. Tracker đánh dấu nó bằng một huy hiệu ăn mừng và chào đón bằng một banner đã có việc.

**Bảng tab giai đoạn (v1.131.0).** Phía trên bảng, một **dải tab giai đoạn** cho bạn đi bộ phễu: một tab **All** cộng một tab cho mỗi trạng thái chính thức, mỗi tab hiện số đếm toàn lịch sử trực tiếp — **bao gồm cả giai đoạn số đếm bằng-0**, nên toàn bộ pipeline luôn hiện rõ trong một cái nhìn. Bấm một giai đoạn để lọc bảng về nó; bấm lần nữa để quay về **All**. Các tab (và cách số đếm gộp các bí danh trạng thái đã bản địa hóa/legacy) đến từ `GET /api/tracker/stages`, vốn đọc cùng `templates/states.yml` máy chủ dùng — nên bộ tab luôn đồng bộ với từ vựng trạng thái của dự án gốc một cách tự động, không có danh sách hardcode nào trên trang. Search, bộ lọc điểm, các cột sắp xếp được và report/PDF/legitimacy từng dòng không đổi; khi bật logo, công ty của mỗi dòng hiện một dấu thương hiệu.

Danh sách trạng thái cho phép được ép phía máy chủ; gửi thứ gì khác trong
`POST /api/tracker` sẽ mặc định về `Evaluated`. Chuyển tiếp
chính thức `Evaluated → Applied` diễn ra tự động khi bạn xác nhận
`Submitted.` ở cuối `/career-ops apply` (xem §14).

### Bố cục cột

| Cột | Là gì |
|---|---|
| `#` | Tự đánh số, đệm số-0 (`001`, `002`, …). |
| `Date` | Ngày ISO (`YYYY-MM-DD`). Mặc định hôm nay. |
| `Company` | Văn bản tự do. **Dấu ống (`\|`) và ký tự xuống dòng được thoát tự động.** |
| `Role` | Như trên. |
| `Score` | Định dạng `N/5` (vd `4.2/5`). |
| `Status` | Enum trong danh sách cho phép. |
| `PDF` | ✅ khi `generate pdf.mjs` đã chạy thành công cho dòng này. |
| `Report` | Liên kết markdown tới `reports/*.md` tương ứng. |
| `Notes` | Văn bản tự do, giới hạn 200 ký tự. |

### Bộ lọc

- **Trạng thái** dropdown.
- **Điểm** dropdown — `≥ 4.0` (cao), `≥ 3.0` (trung), `< 3.0` (thấp).
- **Search** — so khớp chuỗi con trên công ty + vị trí.

Mọi bộ lọc đặt lại paginator về trang 1. 25 dòng mỗi trang.

### Các nút bảo trì

- **▶ Normalize** chạy `normalize statuses.mjs` — tái chuẩn hóa cách viết
  trạng thái (`applied` → `Applied`, `interview` → `Interview`).
- **▶ Dedup** chạy `dedup tracker.mjs` — loại trùng lặp không phân biệt hoa thường
  theo `(company, role)`.
- **▶ Merge** chạy `merge tracker.mjs` — kéo các mục đang chờ từ
  `batch/tracker additions/*.tsv` (nơi luồng batch của dự án gốc thả
  các đơn đã nộp qua Apply helper). Khử trùng lặp và lưu trữ các tệp đã xử lý vào `batch/tracker-additions/merged/`. Xem
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  cho luồng batch thượng nguồn.

### Thêm dòng

`POST /api/tracker` — body `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`. Khử trùng lặp theo `(company, role)`
không phân biệt hoa thường. Từ UI, trang Evaluate cung cấp nút "Add to
tracker" sau một lần chấm điểm thành công.

### "Still live?" — kiểm tra tin ATS còn mở không

Mỗi dòng đang theo dõi liên kết tới một tin trên host ATS (Greenhouse, Lever, Ashby, Workday, hay SmartRecruiters) nhận một nút nhỏ **Still live?**. Bấm nó và ứng dụng hỏi chính endpoint JSON công khai của ATS đó xem tin còn treo không — không trình duyệt, không token AI, không lưu gì. Bạn nhận một trong ba huy hiệu:

- **Còn sống** — tin vẫn được liệt kê.
- **Hết hạn** — ATS trả về một "đã biến mất" dứt khoát (HTTP 404/410), tức vị trí đã bị rút.
- **Không rõ** — lần kiểm tra không kết luận được (URL không phải tin ATS nhận diện được, hay API bị giới tốc, timeout, hay trả lời mơ hồ).

Lần kiểm tra được cố tình thận trọng: nó chỉ nói **Hết hạn** khi gặp cứng 404/410, không bao giờ dựa trên phỏng đoán, nên nó sẽ không bao giờ dọa bạn rời khỏi một vị trí thật ra vẫn còn mở. API công khai của Lever bị coi là không thẩm quyền (nó ẩn một số tin mật), nên những cái đó phân giải thành **Không rõ** thay vì Hết hạn.

### Ghi nhận một kết quả

Khi một đơn ứng tuyển đi tới điểm cuối — bạn nhận offer, nhận việc, bị từ chối, hay đơn giản không bao giờ nghe lại — bấm nút **Outcome** trên dòng tracker ấy để ghi lại. Một modal nhỏ xem trước rồi xác nhận mở ra:

- **Chọn chuyện gì xảy ra** — Rejected, Offer received, Hired / accepted, Offer declined, No response / ghosted, hay Advanced to interview.
- **Ghi chú (tùy chọn)** — một dòng ngắn cho chính bạn.
- **Xem trước** — ứng dụng cho thấy chính xác nó sẽ làm gì (vd *"Will set #12 Acme → Rejected"*) và chưa ghi gì cả.
- **Record outcome** — xác nhận nó.

Ghi nhận làm ba việc cùng lúc: nối kết quả vào một nhật ký kết quả chỉ ghi thêm, lưu trữ CV và thư xin việc bạn đã nộp vào thư mục kết quả của đơn ấy, và đồng bộ **Trạng thái** chính thức của dòng — nên một **Hired** hay **Rejected** xuất hiện trong tracker và thống kê mà bạn không phải sửa bảng tay. Như các công cụ tracker khác, nó chỉ đọc cho tới khi bạn bấm **Record outcome**, và nó cần dự án career-ops gốc nằm cạnh ứng dụng (nút bị ẩn khi dự án ấy không có).

---

## 12. Nghiên cứu sâu (`#/deep`)

Tạo một bản tóm tắt công ty có cấu trúc: ảnh chụp tổng quan, văn hóa kỹ thuật,
tin tức gần đây, cảm nhận Glassdoor, quy trình phỏng vấn, các điểm
lợi thế đàm phán, ba câu hỏi thông minh để hỏi recruiter.

### Đầu vào

Hai trường — tên công ty và (tùy chọn) vị trí. Mẫu mode
(`modes/deep.md`) là thứ định hình cấu trúc.

### Đường đầu ra

Cùng chuỗi dự phòng với Evaluate:

1. **Anthropic trực tiếp** (ưu tiên) — `bundleProjectContext` nhúng
   cv + profile + `_shared.md` + `deep.md`. Kết quả: 10–30 KB
   markdown có gốc rễ lưu vào
   `interview prep/<company>-<role>.md`.
2. **Gemini trực tiếp** — lời gọi `gemini eval.mjs`. Cùng đích lưu.
3. **Prompt thủ công** — trang đưa bạn một prompt sẵn sàng cho Claude
   Code (nó có WebFetch + WebSearch và có thể nghiên cứu thật).

### Mẹo

- Anthropic trên `claude sonnet-4-6` thường trả ~13 KB văn bản hữu ích trong 1–3 phút mỗi lần gọi.
- SDK Anthropic không có web search tích hợp. Với các vị trí cần
  tin tức mới + cảm nhận Glassdoor, dán prompt thủ công vào
  Claude Code và để nó dùng công cụ WebFetch.
- Các lần chạy trực tiếp bị tính tiền; một lần gọi nghiên cứu sâu Sonnet 4.6 tốn ≈
  $0.30–0.50.

---

## 13. Các mode prompt (bảy trang `/#/<mode>`)

**Bảng nhịp độ (v1.117.0).** Trang Follow-up giờ mở đầu bằng một **bảng nhịp độ** tất định nuôi bởi `followup-cadence.mjs` của dự án gốc: mức khẩn theo từng đơn (🔴 urgent / 🟠 overdue / 🟡 waiting / 🔵 cold) với số ngày đến hạn tiếp, cộng một nút **Seed follow-up dates** ghim ngày nhắc đầu tiên cho mọi dòng Applied (`followup-seed.mjs --backfill`). Không có script dự án gốc thì bảng hiện một ghi chú trung thực "không khả dụng".

Bảy trình tạo prompt: ý tưởng **Project**, kế hoạch **Training**,
email **Follow up**, đánh giá **Batch**, tiếp cận **Outreach**
recruiter, one pager **Interview prep**, và hồi đáo **Patterns**
. Mỗi cái bọc một mẫu `modes/<slug>.md` cụ thể:

| Trang | Slug | Mục đích |
|---|---|---|
| `#/project` | `project` | Điều chỉnh một dự án portfolio cho một vị trí mục tiêu. |
| `#/training` | `training` | Phân tích khoảng trống kỹ năng → giáo trình. |
| `#/followup` | `followup` | Bản nháp email sau phỏng vấn. |
| `#/batch` | `batch` | Prompt đánh giá batch đa JD. |
| `#/contacto` | `contacto` | Tin tiếp cận tới recruiter / người giới thiệu. |
| `#/interview prep` | `interview prep` | One pager chuẩn bị cho một vòng phỏng vấn cụ thể. |
| `#/patterns` | `patterns` | Phân tích hồi đáo "Mẫu nao đã khiến tôi thành công?". |

### Dạng chung

Mỗi trang có một biểu mẫu nhỏ (các trường riêng từng mode), một nút **▶
Generate prompt** (thủ công), và — khi có khóa Anthropic hay Gemini
— một nút **⚡ Run live** được nâng lên làm nút chính.

Bấm **▶ Generate prompt** trả về prompt đã lắp ráp với các giá trị
biểu mẫu JSON stringify vào một khối `User supplied context:`,
tiếp theo là mẫu `modes/<slug>.md` nguyên văn. Sao chép và dán
vào LLM tùy chọn của bạn.

Bấm **⚡ Run live** gửi cùng prompt tới Anthropic (hay
Gemini), với `cv.md` + `profile.yml` + `_shared.md` nhúng qua
`bundleProjectContext`. Kết quả được render trên trang, sao chép được, và
tải được dưới dạng `.md`.

Bảy trang là một danh sách cho phép tường minh — các mode có
route riêng (`oferta` → Evaluate, `deep` → Deep research) và
các mode mà dự án gốc chỉ hỗ trợ bên trong Claude Code (`apply`,
`scan`, `pipeline`, `tracker`, `pdf`, `latex`, `ofertas`,
`auto-pipeline`) được cố tình giữ khỏi UI này.

---

## 14. Danh mục kiểm tra Apply (`#/apply`)

Khi đã quyết ứng tuyển, trang Apply helper này tạo một
danh mục kiểm tra nộp cho bước ứng tuyển thực tế. Nó KHÔNG tự điền
form — luồng ấy ở lại trong `/career-ops apply` bên trong Claude Code,
vốn dùng Playwright trong dự án gốc.

### Chế độ danh mục SPA (`#/apply`)

Danh mục của SPA dành cho những ai thích tự điền form
mà không gọi Playwright. Nó bao gồm:

0. Chạy `/career-ops apply <url>` trong Claude Code để đọc form qua
   Playwright (bỏ qua bước này nếu bạn điền tay).
1. Xác nhận tin vẫn còn sống (`check liveness.mjs`).
2. Xác nhận CV là bản mới nhất (`cv sync check.mjs`, rồi PDF nếu điểm ≥ 4.0).
3. Điều chỉnh thư xin việc / câu trả lời "Why us?" dùng các điểm chứng minh STAR+R
   từ `cv.md`.
4. Trả lời trung thực các câu hỏi EEO / bảo lãnh / ngày bắt đầu.
5. Lưu các câu trả lời đã điền vào
   `interview prep/{company}-{role}.md` trước khi nộp.
6. **KHÔNG BAO GIỜ tự nộp** — bạn (con người) bấm nút cuối.
7. Sau khi nộp: thêm dòng vào `data/applications.md` (hay ghi TSV vào
   `batch/tracker additions/`).

### Điền tay so với Playwright hỗ trợ

Hai đường cho việc nộp thực tế:

- **Thủ công** — mở trang tuyển dụng trong một tab trình duyệt thường, theo
  danh mục SPA ở trên, copy/paste các câu trả lời. Không cần Playwright.
  Dùng khi form ngắn hay bạn chưa cài Chromium.
- **Playwright hỗ trợ** — chạy `/career-ops apply <company>` trong
  Claude Code (dự án gốc). Playwright mở trình duyệt riêng,
  đọc mọi trường form, trả các câu trả lời bản nháp đánh số. Bạn vẫn
  tự bấm Submit. Dùng khi form dài, động, hay bạn muốn dấu vết kiểm toán của câu nào thuộc câu trả lời nào.

### Toàn bộ luồng apply CLI ([apply for a job](https://career-ops.org/docs/introduction/guides/apply for a job))

**Điều kiện tiên quyết:**

1. Chạy `/career-ops pipeline` trước để JD có báo cáo đánh giá
   dưới `reports/`. Lệnh apply phụ thuộc một đánh giá hiện có; không có thì
   chạy pipeline trước.
2. Đã nạp báo cáo và hồ sơ.
3. **Khuyến nghị:** Playwright đã cài
   (`npx playwright install chromium` — xem Thiết lập Playwright bên dưới).
   Quay về WebFetch (xem trước form chỉ văn bản, không click điền) khi
   thiếu.

**Luồng đánh số** (8 bước chính thức):

1. **Chạy lệnh** với tên công ty:

   ```
   /career-ops apply <company>
   ```

   Ví dụ: `/career-ops apply Anthropic`. Không có đối số, hãy cung cấp
   một ảnh chụp màn hình của form, văn bản form dán vào, hay URL
   ứng tuyển ở lượt sau.

2. **Xác định báo cáo.** Hệ thống tìm đánh giá khớp trong
   `reports/` (cái do `/career-ops pipeline` hay
   `#/evaluate` tạo trước đó).

3. **Mở form.** Playwright khởi chạy một cửa sổ trình duyệt
   **tự động** — bạn KHÔNG tự mở nó.

4. **Đọc các trường.** Hệ thống đọc và phân tách mọi trường form
   (nhãn, kiểu, bắt buộc, các tùy chọn select).

5. **Tạo câu trả lời.** career-ops tạo các câu trả lời được điều chỉnh cho từng
   trường dựa trên hồ sơ, điểm chứng minh và vị trí của bạn.

6. **Trả danh sách đánh số.** Bạn nhận các câu trả lời xếp theo
   bố cục form — các trường đơn giản (tên, email) trước, các trường văn bản tự do
   (thư xin việc, "Why us?") sau. Các mục được gắn cờ trỏ tới những thứ cần
   con người chú ý — mốc lương, chi tiết CV còn thiếu, câu hỏi tùy chọn.

7. **Điền thủ công.** Bạn copy và paste từng câu trả lời vào
   trường tương ứng. Bước này là thủ công, không tự động. Bạn
   xem lại mọi câu trả lời trước.

8. **Người dùng nộp.** Bạn tự bấm Submit. career-ops **không bao giờ**
   bấm Submit. Xác nhận hoàn all tất bằng cách gõ vào chat:

   ```
   Submitted.
   ```

**Cập nhật tự động khi có `Submitted.`:**

- Trạng thái lật `Evaluated → Applied` trong `data/applications.md`.
- Các câu trả lời đã điền được giữ ở mục G của báo cáo để tham chiếu
  sau.

**Bàn giao cho tracker:**

```
/career-ops tracker
```

Theo dõi trạng thái toàn bộ pipeline của bạn, bất kể điểm vị trí.

### Đánh giá hàng loạt ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

Khi bạn có 10+ JD cần chấm cùng lúc (việc dùng `#/evaluate` của SPA
từng cái một là bất khả thi với lượng đó), dùng batch runner
từ CLI.

**Tệp đầu vào — `batch/batch input.tsv`** (phân tách bằng tab):

| Cột | Mục đích |
|---|---|
| `id` | Số tuần tự duy nhất |
| `url` | Liên kết đầy đủ của tin tuyển dụng |
| `source` | Nền tảng nguồn gốc (LinkedIn, Greenhouse, v.v.) |
| `notes` | Chi tiết ngữ cảnh tùy chọn |

Dòng ví dụ:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**Các cờ `./batch/batch runner.sh`:**

- `--dry run` — Xem trước các offer đang chờ mà không đánh giá. Luôn chạy
  cái này đầu tiên để kiểm tra TSV.
- `--parallel N` — Chạy N worker đồng thời (khuyến nghị 1, 2, hay 3).
- `--min score X.X` — Bỏ lưu các offer chấm dưới ngưỡng. Hữu ích để chỉ
  giữ báo cáo cho các vị trí khớp cao.
- `--retry failed` — Chỉ xử lý lại các offer lỗi ở lần chạy trước (lỗi mạng, giới hạn tốc).
- `--max retries N` — Thử lại các offer lỗi tới N lần (mặc định: 2).
- `--model NAME` — Mô hình Claude truyền cho `claude -p --model` (parent career-ops 1.8.0, #504). Bỏ đặt = mặc định gói đăng ký Claude Max của bạn. Dùng một mô hình rẻ hơn cho batch lớn, ví dụ `claude sonnet-4-6`. Được hiển thị trong `#/batch` ở ô nhập **Model** (web ui 1.31.0).
- `--start from N` — Bỏ các ID offer nhỏ hơn N (tiếp tục một batch xử lý dở). Được hiển thị trong `#/batch` ở ô nhập **Start from #** (web ui 1.31.0).

**Trình tự chuẩn:**

1. **Sửa** `batch/batch input.tsv` — mỗi JD một dòng.

2. **Dry run** (khuyến nghị chạy trước):

   ```bash
   ./batch/batch runner.sh --dry run
   ```

3. **Chạy** — tuần tự hay song song:

   ```bash
   ./batch/batch runner.sh                       # từng cái một
   ./batch/batch runner.sh --parallel 2          # hai đồng thời
   ./batch/batch runner.sh --parallel 3          # ba đồng thời
   ./batch/batch runner.sh --parallel 2 --min score 4.0  # chỉ lưu khớp cao
   ```

4. **Thử lại lỗi** (mạng / giới hạn tốc):

   ```bash
   ./batch/batch runner.sh --retry failed --max retries 3
   ```

5. **Báo cáo** đổ vào `reports/` dưới dạng
   `{id}-{company}-{YYYY-MM-DD}.md`. Các dòng tóm tắt nối vào
   `batch/tracker additions/`.

6. **Hợp nhất vào tracker:**

   ```bash
   node merge tracker.mjs                 # áp dụng các bổ sung batch
   node merge tracker.mjs --dry run       # xem trước phép hợp nhất
   ```

   Lệnh hợp nhất khử trùng lặp các mục và lưu trữ các tệp đã xử lý
   vào `batch/tracker-additions/merged/`.

SPA hiển thị các báo cáo kết quả dưới `#/reports` (có phân trang,
pill điểm có màu) và các dòng tracker dưới `#/tracker` — chính xác
như bạn tự thêm từng cái qua `#/evaluate`. Ghép cặp với nút bảo trì
**▶ Merge** trên `#/tracker` nếu bạn không muốn đổ xuống CLI.

### Thiết lập Playwright ([set up playwright](https://career-ops.org/docs/introduction/guides/set up playwright))

Cần thiết cho hai tính năng career-ops:

- **Điền form** trong `/career-ops apply` (bước 3 ở trên — Playwright
  mở trình duyệt, đọc nhãn các trường, gợi ý câu trả lời).
- **Tạo PDF** qua `/career-ops pdf` và nút
  **📄 Generate PDF** của SPA trên `#/cv` / `#/reports/:slug` /
  `#/evaluate` / `#/deep` / `#/interview prep`.

**Dự phòng khi thiếu Playwright:** luồng apply quay về
WebFetch (xem trước form chỉ văn bản, không click điền). Tạo PDF
đơn giản báo lỗi.

**Thiết lập cốt lõi (chạy từ thư mục gốc career-ops):**

```bash
# Cài Chromium cho Playwright
npm install
npx playwright install chromium

# Đăng ký Playwright MCP để Claude Code điều khiển form
claude mcp add playwright npx @playwright/mcp@latest

# Kiểm chứng cả ba thành phần (Chromium, thư viện Playwright, MCP)
npm run doctor
```

**Đăng ký MCP khác** — thêm vào
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

**Ghi chú hành vi:**

- **Headless mặc định.** Playwright vận hành im lặng. Để xem
  trình duyệt hoạt động, bảo Claude `open up with playwright the browser
  and fill out the entire form.`
- **Ba vai trò trong một gói** — bản cài Playwright npm cho bạn
  thư viện tự động hóa trình duyệt, engine render PDF cho
  `/career-ops pdf`, và (qua MCP) luồng điền form bên trong
  Claude Code.
- **Kiểm chứng trước khi dựa vào nó** — `npm run doctor` xác nhận cả ba
  đều vận hành. Trang Health của SPA lộ một mục kiểm tra
  `Playwright (parent node_modules)` báo lỗi nhanh nếu thiếu.

---

## 15. Chuẩn bị phỏng vấn

Đây là giai đoạn sau nghiên cứu, trước phỏng vấn. Ba artifact trong
ứng dụng này hội tụ:

1. **Các tệp nghiên cứu sâu đã lưu** dưới `interview-prep/`, mỗi cặp
   công ty vị trí bạn đã chạy một tệp. Duyệt từ trang **Deep research**
   hay trực tiếp qua `/api/interview-prep`.
2. **Mode Patterns** (`#/patterns`) — tạo một prompt tự hồi đáo:
   "qua N buổi phỏng vấn / offer / lần bị từ chối gần đây của tôi,
   những mẫu nào vẫn đúng?" Hữu ích khi bạn đã tích lũy 5+ dòng tracker.
3. **Mode Interview prep** (`#/interview-prep`) — điền sẵn một
   one-pager cho một vòng cụ thể sắp tới (hành vi, kỹ thuật,
   system design). Kết quả đổ vào cùng thư mục `interview-prep/`.

### Quy trình được khuyến nghị

Với mỗi buổi phỏng vấn bạn có trong lịch:

1. **Chạy lại Deep** (hay mở tệp đã lưu) vào ngày hôm trước.
2. **`#/interview-prep`** — tạo một one-pager cho vòng cụ thể.
   Dán vào ghi chú của bạn.
3. **Vòng system design / coding** — mở `#/training` và xin
   một buổi ôn nhanh-30-phút nhắm vào đúng subsystem mà JD
   nhấn mạnh.
4. **Vòng lương thưởng** — mở tệp nghiên cứu sâu, nhảy tới
   "Negotiation leverage points". Mang theo 2–3 điểm dữ liệu cụ thể
   (dải Glassdoor, vòng gọi vốn gần đây, offer so sánh được ở công ty khác).
5. **Vòng hành vi** — lấy các câu chuyện STAR+R từ `cv.md` của bạn mà
   đổ vào mục B của báo cáo Evaluate ban đầu.

Sau buổi phỏng vấn, ngay lập tức:

1. Cập nhật dòng tracker: trạng thái → `Responded` (rồi `Interview`,
   `Offer`, v.v.).
2. Chạy `#/followup` để soạn thư cảm ơn.
3. Nếu bạn có thông tin mới (dải lương, cơ cấu đội, bất ngờ tech stack),
   sửa tệp `interview-prep/<company>-<role>.md` đã lưu
   với `## Post-round notes` để bản tương lai của bạn có nó.

---

## 16. Nhật ký hoạt động + Khắc phục sự cố

### Nhật ký hoạt động (`#/activity`)

Dấu vết kiểm toán của mọi yêu cầu thay đổi trạng thái chạm tới máy chủ.
Ghi lại: các lần thêm pipeline, ghi tracker, lưu CV, lưu JD, các lần chạy
evaluate, các lần chạy deep research, các lần quét, thay đổi cấu hình,
các lần chạy mode.

Các secret (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) được che
trên đường đi; bạn sẽ không bao giờ thấy giá trị khóa thật trong `data/activity.jsonl`.

Lọc theo tiền tố hành động (`pipeline.`, `cv.`, `evaluate`, `scan.`,
v.v.). 25 dòng mỗi trang; máy chủ trả về tới 500 sự kiện
gần nhất.

### Khắc phục sự cố

| Triệu chứng | Nguyên nhân có thể | Cách sửa |
|---|---|---|
| Trang Health đỏ ở `cv.md` | Lần chạy đầu, tệp chưa tồn tại | `touch $CAREER_OPS_ROOT/cv.md` rồi làm mới. |
| Health đỏ ở `Profile customized` | `candidate.full_name` vẫn là `Jane Smith` | Sửa `config/profile.yml`. |
| `hh.ru: HTTP 451` hay `403` trong nhật ký quét | IP đầu ra ngoài Nga, hay hh.ru gắn cờ nó là địa chỉ VPN/datacenter | Chạy từ một IP **dân cư** Nga. Không có cài đặt khóa hay User Agent nào — scanner tự gửi một UA trình duyệt. |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | Chưa cài deps dự án gốc | `cd $CAREER_OPS_ROOT && npm install`. |
| Generate PDF báo lỗi | Chưa cài Playwright ở dự án gốc | `cd $CAREER_OPS_ROOT && npx playwright install chromium`. |
| `/career-ops apply` báo "no report found" | Pipeline chưa từng chấm JD này | Chạy `/career-ops pipeline` (hay `#/evaluate`) trước; xem điều kiên tiên quyết §14. |
| `batch-runner.sh: no such file` | Chạy từ sai thư mục | `cd $CAREER_OPS_ROOT` trước khi gọi `./batch/batch-runner.sh`. |
| Máy chủ báo `EADDRINUSE: 4317` | Bản cũ vẫn đang chạy | `pkill -f 'node server/index.mjs'` rồi khởi động lại. |
| Gọi LLM trực tiếp treo > 2 phút | Prompt quá lớn hay Anthropic chậm | Kiểm tra cờ Anthropic trên `/api/health`; máy chủ cap mềm prompt ở 256 KB và trả 413. |
| Xem trước pipeline hiện `(unsafe redirect)` | Tin đăng redirect tới IP riêng / loopback | Đây là tính năng bảo mật (REVIEW-B1). Đích redirect bị từ chối và URL gốc không đổi. |
| Văn bản dòng tracker làm vỡ bảng | Dấu ống trong tên công ty trước v1.9.1 | Nâng lên v1.9.1+ — dấu ống được thoát từ đầu đến cuối (BF-1). |
| `npm test` thất bại trên bản clone mới | Các test giả định bố cục dự án gốc | Dùng `CAREER_OPS_ROOT=$(mktemp -d)` và dựng fixtures. |

Để chẩn đoán sâu hơn: chạy **▶ Doctor** trên trang Health, sao chép
kết quả, và tìm trên trình theo dõi issue tại
<https://github.com/Fighter90/career-ops-ui/issues>.


---

## 17. Cách thêm một nguồn cổng việc làm mới

career-ops-ui coi mỗi bảng việc làm là một **adapter** — một tệp đơn dưới
[`server/lib/sources/<slug>.mjs`](../../server/lib/sources/) biết
cách lấy + chuẩn hóa kết quả của một bảng. Hiện tại
`server/lib/sources/` registry cung cấp **121** adapter — **116 bảng tiếng Anh + 5 bảng tiếng Nga**. Bộ tiếng Anh trải khắp các ATS lớn (Greenhouse / Ashby / Lever /
Workable / SmartRecruiters / Workday), các aggregator toàn bảng chọn bằng
`provider:` tường minh (RemoteOK, Remotive, We Work Remotely, NoDesk, Get on Board,
Amazon, …), và các ATS theo tenant tự phát hiện từ host `careers_url` hay
URL `api:` tường minh (BambooHR, Personio, Recruitee, Teamtailor, Avature,
SAP SuccessFactors, …). **Danh sách đầy đủ không bao giờ cần được đếm tay ở đây —
nó được tự phát hiện từ `server/lib/sources/` và hiển thị trực tiếp trong dropdown
Source của `#/scan`.** Xem §5 cho YAML và
`docs/portals-examples.md` cho các mục copy paste.

> **v1.69.0 (P-14) — tự phát hiện thả vào là chạy.** Thêm nguồn thứ 12 giờ là một
> **lượt thả tệp thuần túy**. Registry
> ([`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs))
> không còn giữ một danh sách bảo trì tay nào — khi khởi động nó quét thư mục này
> (`readdirSync` + `import()` động) và thu khối `export const meta`
> từ mọi `*.mjs`. Viết adapter, khai báo `meta` của nó, và nó
> hiện ngay với scanner, dropdown lọc `#/scan`, và bộ điều phối RU —
> **không cần sửa `registry.mjs`**. (Nguồn RU vẫn cần
> một dòng trong `portals.yml` của dự án gốc; xem Bước 5.)

### Bước 1 — Viết adapter

Tạo `server/lib/sources/<slug>.mjs`. Hai mẫu hoạt động tùy
nguồn có API JSON hay chỉ render HTML:

**Nguồn có API sau** (sạch nhất — dùng cái này bất cứ khi nào trang có
một endpoint dữ liệu mở):

```js
// server/lib/sources/example.mjs
const ENDPOINT = 'https://example.com/api/v1/vacancies';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...';

// v1.69.0 (P-14) — metadata tự-mô-tả. Registry tự-phát-hiện
// khối này lúc khởi động; ĐÂY là thứ đăng-ký nguồn (xem Bước 2).
export const meta = {
  value: 'example',          // ← phải bằng job.source ghi bên dưới
  label: 'Example.com',      // ← hiện trong dropdown lọc #/scan
  region: 'ru',              // ← 'en' (lượt-quét-ATS) | 'ru' (bộ-điều-phối-khu-vực)
  configKey: 'example',      // ← chỉ RU; khóa dùng trong portals.yml
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
    source: 'example',           // ← phải khớp `value` của registry chính xác
  };
}
```

**Nguồn scrape HTML** (khi không có API — xem
[`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) và
[`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) cho các ví dụ đầy đủ):

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
  // …trích-thẻ-dựa-trên-regex. Trả [] khi phân-tách-lỗi (ĐỪNG throw):
  // một 200 lành-mạnh không có thẻ đọc-được là "không có kết quả", không phải "lỗi",
  // nên scanner đa-nguồn có thể tiếp tục.
}
```

Ba hợp đồng mọi adapter PHẢI tuân theo:

- **Export một khối `meta` hợp lệ** (xem Bước 2). Không có nó, registry
  âm thầm bỏ qua tệp (một `console.warn` lúc khởi động) và nguồn
  không bao giờ xuất hiện.
- **Chấp nhận `{ onlyRemote, fetchImpl, signal }` trong `opts`.** `fetchImpl`
  là thứ làm adapter kiểm tra được mà không cần mạng; `signal` là bắt buộc
  cho việc lan truyền ngắt kết nối client (REVIEW-B3).
- **Trả các bản ghi với dạng chung** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`, trong đó `source` khớp
  `meta.value`.

### Bước 2 — Khai báo `meta` của adapter (tự đăng ký)

Đây là toàn bộ bước đăng ký. **Bạn không sửa `registry.mjs`.**
Chỉ cần đảm bảo adapter export một khối `meta` — registry
tự phát hiện nó lúc khởi động:

```js
// ở đầu server/lib/sources/example.mjs
export const meta = {
  value: 'example',          // giá-trị job.source VÀ option.value của #/scan
  label: 'Example.com',      // nhãn hiển-thị trong dropdown
  region: 'ru',              // 'en' | 'ru'
  configKey: 'example',      // chỉ RU — khóa trong portals.yml::russian_portals.sources
};
```

Cách phát hiện kiểm tra nó (một tệp vi phạm bất kỳ quy tắc nào bị bỏ qua, với một
cảnh báo `[sources/registry]`, nên một nhánh đưa nửa chừng vẫn chẩn đoán được):

- `value` — chuỗi không rỗng. PHẢI khớp `job.source` từ adapter của bạn.
- `label` — chuỗi không rỗng.
- `region` — đúng `'en'` hay `'ru'`; thứ gì khác bị từ chối.
- `configKey` — **bắt buộc** cho `region: 'ru'`, bị bỏ qua cho `'en'`.

`region: 'en'` tham gia lượt quét ATS (tự phát hiện từ các mẫu URL
`tracked_companies`); `region: 'ru'` tham gia bộ điều phối khu vực. API công khai
(`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`) được
dựng lại từ mọi `meta` được phát hiện, sắp `en` trước rồi `ru`,
theo bảng chữ cái theo nhãn bên trong mỗi vùng — nên thứ tự dropdown
ổn định cho người dùng.

### Bước 3 — Nối vào bộ điều phối (chỉ RU)

Các nguồn ATS EN tự phát hiện từ các mẫu URL `tracked_companies` —
không cần nối thêm gì. Với nguồn RU, mở
[`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs), tìm
bảng `RU_DISPATCH`, và thêm một dòng:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …đã có…
  example: { label: 'example.com', search: searchExample },
};
```

Vòng lặp bộ điều phối gọi `entry.search(query, opts)` cho mọi khóa
có mặt trong `cfg.sources`. Không cần đổi code nào thêm.

### Bước 4 — Kiểm tra (mock, không bao giờ chạy thật)

Thả một tệp dưới `tests/sources-<slug>.test.mjs`. Mạng thật là
**bị cấm** trong test (hợp đồng cách lý CI):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchExample } from '../server/lib/sources/example.mjs';

test('searchExample chuẩn hóa một bản ghi', async () => {
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

### Bước 5 — Bật trong `portals.yml` của bạn

`portals.yml` của dự án gốc là cấu hình thuộc về người dùng. Thêm
`configKey` của nguồn mới vào mảng:

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

Tải lại `#/scan` trên trình duyệt. Dropdown bộ lọc nguồn tự nhặt
mục mới (một nguồn chân lý duy nhất qua
[`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs)). Nút
🌐 Scan giờ bao gồm nguồn mới trong mỗi lượt quét khu vực.

### Các adapter tham chiếu (lấy làm mẫu cho nguồn mới)

| Tệp adapter | Kiểu | Ghi chú |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | Adapter API RU chính thức; dự phòng UA nhận biết địa lý. |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | Open data chính phủ Nga; không chặn IP. |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | Scrape HTML | Bảng công nghệ Nga; bộ phân tách thẻ dựa trên regex. |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | Scrape HTML | Bộ phân tách phòng thủ, `[]` khi đọc hụt. |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | Scrape HTML | Cùng phong cách phòng thủ với GetMatch. |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | Adapter ATS EN chính thức; dùng mẫu URL `tracked_companies`. |

### Các bẫy thường gặp

- **Quên export `meta`.** Từ v1.69.0, khối `meta` là
  *thứ duy nhất* đăng ký một nguồn. Không có `meta` (hay một khối méo) =
  tệp bị bỏ qua im lặng lúc khởi động với một cảnh báo
  `[sources/registry] <file> has no valid \`export const meta\` — skipped`,
  và nguồn không bao giờ tới dropdown. Kiểm tra log máy chủ
  nếu một adapter mới tỏm không xuất hiện.
- **Trường `source` lệch nhau.** Chuỗi do adapter của bạn ghi PHẢI
  khớp `meta.value` chính xác. Nếu chúng trôi khỏi nhau, dropdown
  lọc `#/scan` vẫn hiện nguồn nhưng chọn nó sẽ
  lọc sạch mọi dòng (vì phép so sánh là `r.source === fs`).
- **Throw khi phân tách lỗi.** Bộ scrape HTML PHẢI trả `[]` khi gặp
  một 200 lành mạnh không có thẻ đọc được. Throw làm vỡ
  vòng lặp bộ điều phối đa nguồn — một cấu trúc HTML xấu giết mọi nguồn khác
  cho cùng truy vấn.
- **Quên `fetchImpl` / `signal`.** Không có chúng, adapter
  không thể unit test mà không chạm mạng thật, và các lần ngắt kết nối client
  không lan truyền (lần tải nền vẫn sống sau khi người dùng đóng tab).
- **Tin vào `tracked_companies` cho RU.** Danh sách đó chỉ dành cho
  nguồn ATS EN. Adapter RU tự lái từ
  `russian_portals.queries` — không có mục theo từng công ty.

---

## 18. Thông báo (🔔 trên thanh trên)

> v1.58.34 — mọi toast xuất hiện ở góc dưới phải cũng được ghi vào
> một nhật ký trong bộ nhớ (cap 50, cái cũ bị bỏ). Bấm chiếc chuông 🔔 trên
> thanh trên để mở ngăn kéo **Notifications** trượt từ phải và đọc lại mọi thứ
> bạn lỡ. Nhật ký là theo tab, theo phiên — đóng tab là xóa nó.

Ngăn kéo **chỉ mở khi bạn bấm chiếc chuông** (hay kích hoạt nó bằng Enter /
Space khi nó đang focus bàn phím). Nó không bao giờ tự hiện. Huy hiệu đỏ trên
chiếc chuông đếm các mục bạn chưa thấy kể từ lần mở cuối; mở ngăn kéo
xóa huy hiệu.

### Các loại thông báo

| Loại | Khi nào bắn | Dấu hiệu trực quan |
|---|---|---|
| **Thành công** | `Đã lưu`, `Đã sao chép`, `Đã làm mới`, quét xong, CV đã nhập, các hành động danh mục apply ("Đã sao chép phần chưa tích", "Đã đặt lại"), hồ sơ đã lưu, URL đã thêm vào pipeline | viền trái xanh trong ngăn kéo; nền toast xanh |
| **Lỗi** | xác thực URL thất bại (phải bắt đầu bằng `http://` / `https://`, không có ký tự script/template), lỗi API với hậu tố `(METHOD /path · HTTP NNN)`, lỗi mạng (máy chủ tắt), trùng lặp pipeline-400, doctor / verify pipeline exit khác-0 | viền trái đỏ; nền toast đỏ; hậu tố kỹ thuật giấu trong khối `Details` `<details>` (U-4 / v1.58.24) |
| **Thông tin / tiến trình** | `Đang chạy doctor.mjs…`, `Đang chạy verify-pipeline.mjs…`, `Đang làm mới…`, `Đang tải…`, `Đang tạo prompt…`, các dòng tiến trình quét | viền trái xám; nền toast mặc định |

Mỗi mục trong ngăn kéo hiện:

- **Dấu thời gian** (`HH:MM:SS` bản địa hóa theo ngôn ngữ SPA đang bật).
- **Thông điệp** (câu cho người, với hậu tố kỹ thuật bị strip khỏi tiêu đề theo U-4).
- **Chi tiết** (khi có — hậu tố `(METHOD /path · HTTP NNN)` của lời gọi API hay bất kỳ chú thích kỹ thuật nào khác, monospace).

### Thứ KHÔNG phải là thông báo

- **Modal kết quả** Doctor / verify pipeline (toàn bộ stdout / stderr) — đó là modal, không phải toast, và không được ghi nhật ký.
- Các dòng log SSE trên `#/scan` và `#/auto` — những cái đổ vào thân trang, không phải vào đường dẫn toast.
- Các trạng thái tải chỉ có spinner (những cái dùng `UI.withSpinner` không kèm toast).

### Bàn phím

- **Bấm** hay focus + **Enter / Space** trên chiếc chuông → mở ngăn kéo.
- **Esc**, bấm nút đóng **×**, hay bấm lại chiếc chuông → đóng ngăn kéo; focus quay về chiếc chuông.
- **Tab** trong khi ngăn kéo đang mở → đi qua nút đóng và mọi chi tiết focus được bên trong; ngăn kéo là `aria-modal="false"`, nên Tab không bị bẫy (bạn vẫn tới được phần còn lại của trang).


## 19. Bản địa hóa ứng dụng sang ngôn ngữ của bạn

Giao diện có bản cho 19 ngôn ngữ (English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文, Polski, Українська, Dansk, العربية, Deutsch, Italiano, Türkçe, हिन्दी, தமிழ், Tiếng Việt). Mọi nhãn trên màn hình đến từ một từ điển bản dịch, và bạn có thể thêm hay sửa một ngôn ngữ mà không đụng đến lô gic ứng dụng.

**Bản dịch nằm ở đâu.** Từ v1.60.0 mỗi ngôn ngữ là một tệp riêng dưới `public/js/lib/locales/` — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.ru.js`, v.v. — một danh sách đơn giản các cặp `'key': 'text'`. Một `i18n-dict.aliases.js` dùng chung cho phép các khóa luôn phải đọc giống nhau (một nhãn thanh bên và tiêu đề trang của nó) trỏ về một bản dịch. `i18n-dict.js` gộp chúng lại lúc trang tải; bạn không bao giờ sửa nó.

**Sửa hay thêm một cụm từ.** Mở tệp cho ngôn ngữ của bạn, tìm khóa (vd `'nav.scan'`) và sửa văn bản. Để thêm một nhãn hoàn toàn mới, thêm cùng khóa đó vào **tất cả 19** tệp ngôn ngữ với giá trị đã dịch, rồi tham chiếu nó trong trang qua `t('your.key')`. Chạy `npm test` — nó thất bại nếu ngôn ngữ nào thiếu khóa, nên không gì được đem đi dở dạng.

**Thêm cả một ngôn ngữ mới.** Chép `i18n-dict.en.js` thành `i18n-dict.<code>.js`, dịch mọi giá trị, rồi đăng ký mã trong `i18n.js` (danh sách ngôn ngữ + tự phát hiện trình duyệt), trong bộ lắp ráp `i18n-dict.js`, và thêm một dòng `<script>` trong `index.html`. Danh sách kiểm tra đầy đủ — kể cả ảnh chụp test và các tệp đồng hành help / README — nằm trong `docs/LOCALIZATION.md`.

**Nên biết.** Công tắc ngôn ngữ nằm ở chân thanh bên; lựa chọn của bạn được ghi nhớ theo trình duyệt. Các thông điệp chẩn đoán máy chủ cố tình giữ tiếng Anh (để log đọc nhất quán) — chỉ giao diện trên màn hình được dịch.

Xem **`docs/LOCALIZATION.md`** trong repository cho hướng dẫn bản địa hóa đầy đủ, theo từng bước.

## 20. Thống kê theo vị trí mục tiêu (`#/stats`)

Trang **Analytics → Target role stats** biến dữ liệu thưa mà các lượt quét của bạn đã thu thập thành một bức tranh thị trường cho đúng những vị trí bạn đang nhắm — số đếm việc làm và mức lương theo quốc gia, cộng một xu hướng bạn có thể theo dõi theo thời gian. Không gì bị bịa: nó chỉ tổng hợp những gì các scanner tìm thấy, và nó trung thực về việc mẫu có mỏng đến đâu.

### Các con số đến từ đâu

- **Vị trí mục tiêu** được đọc từ Hồ sơ của bạn (`config/profile.yml` → target roles) — không bao giờ hardcode. Đặt chúng trên `#/profile` trước; chưa có vị trí thì trang hiện một prompt "đặt vị trí mục tiêu của bạn" thay vì biểu đồ rỗng.
- **Các tin đăng** đến từ lần quét gần nhất của bạn (chạy một lượt trên `#/scan` trước). Địa điểm của mỗi việc được ánh xạ về một quốc gia (cùng bộ phát hiện với bộ lọc quốc gia của Scan) và chuỗi lương của nó được phân tách và chuẩn hóa về **USD** qua một bảng tỷ giá gần đúng.
- Mọi thứ được tổng hợp **trong trình duyệt của bạn** — không dữ liệu nào rời máy của bạn, và thứ duy nhất trang có thể ghi là một ảnh chụp bạn chủ động lưu.

### Đọc các biểu đồ

- **Việc làm theo quốc gia** — bao nhiêu tin khớp nằm trong mỗi quốc gia. Dùng các bộ lọc **Role** và **Country** ở đầu để thu hẹp về một vị trí mục tiêu hay một quốc gia.
- **Lương trung vị theo quốc gia (USD)** — mức lương đã phân tách ở giữa cho mỗi quốc gia. Chỉ các tin có lương đọc được được đếm; cỡ mẫu hiện cạnh biểu đồ, và số tiền được quy đổi theo tỷ giá thô, nên hãy đọc nó như *tham khảo*, không phải chính xác. Một dấu `¥` trần (mơ hồ giữa yên Nhật và nhân dân tệ Trung) bị bỏ thay vì đoán, để tránh một méo mỡ tỷ giá lớn.
- Khi lượt quét hiện tại không có lương đọc được, biểu đồ lương nói vậy thay vì bịa số.

### Lưu ảnh chụp & theo dõi xu hướng

- Bấm **Save snapshot** để nối tổng hợp hiện tại vào `data/role-stats.jsonl`. Mỗi ảnh chụp được đóng dấu thời gian trên máy chủ; ảnh chụp là thứ duy nhất trang này ghi và chúng không bao giờ đụng vào CV hay hồ sơ của bạn.
- Biểu đồ **xu hướng** vẽ số đếm việc làm qua các ảnh chụp đã lưu của bạn — lưu một cái định kỳ (ví dụ sau mỗi lượt quét tuần) để xem thị trường cho các vị trí mục tiêu của bạn di chuyển ra sao theo thời gian.

## 21. Hai trang của bạn — độ phù thị trường ứng viên (`#/two-pager`)

Đa phần career-ops-ui hỏi "công việc này có khớp CV của tôi không?". **Hai trang** trả lời nửa còn lại: "công việc này có khớp điều tôi thực sự muốn không?". Nó được lấy mẫu theo **"hai trang Mnookin"** từ *Never Search Alone* — một tuyên bố ngắn ngọn ngôi thứ nhất về điều khiến bạn hưng phấn, điều bạn yêu cầu, và điều bạn không chấp nhận. Mở nó từ **Setup → Two pager 🎯**.

### Những gì bạn điền vào

- **Tôi là ai** — vài câu ngôi thứ nhất về thành tích của bạn và dạng vị trí bạn phát triển tốt.
- **Môi trường mục tiêu** — quy mô, giai đoạn và văn hóa công ty bạn muốn.
- Năm danh sách chip — gõ rồi bấm **Enter** (hay dấu phẩy) để thêm mỗi mục, bấm **×** để gỡ:
  - **Điều tôi thích** — nhiên liệu (remote, quyền sở hữu, dự án mới, hướng dẫn người khác…).
  - **Điều bắt buộc** — yêu cầu cứng (sàn lương, một quốc gia, một stack…).
  - **Điều tôi ghét** — thứ hao kiệt (trực ca, họp triền miên, chỉ code cũ…).
  - **Điều phá vỡ thỏa thuận** — thứ tuyệt đối không (chỉ văn phòng, không bảo lãnh, dưới một con số…).
  - **Điều không thoái thúc** — ranh gới (địa điểm, remote, sàn lương…).

Bấm **Save two-pager** để giữ nó. Nó được ghi vào **tầng người dùng của dự án career-ops-gốc** tại `config/two-pager.yml`, nên — như CV và hồ sơ của bạn — nó **không bao giờ** bị ghi đè khi bạn cập nhật hệ thống.

### Trợ lý điền AI

Chưa biết diễn đạt ra sao? Bấm **✨ AI fill assistant** và nó soạn toàn bộ hai trang giúp bạn. Khi bạn đã **cấu hình một nhà cung cấp LLM** (xem §3), nó chạy trực tiếp: nó đọc **chỉ** CV và hồ sơ của chính bạn, soạn mọi trường — bạn là ai, điều bạn thích, điều bắt buộc, điều bạn ghét, điều phá vỡ thỏa thuận, điều không thoái thúc, và môi trường mục tiêu — và điền form ngay tại chỗ. Không gì được nộp tự động: bạn **xem lại, sửa, và bấm Lưu** như một hai trang gõ tay bất kỳ. Nó không bao giờ bịa sự kiện về bạn; nó chỉ định hình lại những gì CV và hồ sơ của bạn đã nói. **Chưa có khóa API**, nó quay về hành vi cũ — hiện prompt Mnookin chạy ngay trong một hộp thoại để bạn chạy nó trong bất kỳ LLM nào và dán YAML trở lại.

**Xem trước & xuất (PDF / DOCX / Markdown).** Bấm **👁 Preview & export** để thấy hai trang của bạn được render thành một tài liệu sạch, có định dạng. Từ bản xem trước bạn có thể **Download .md**, **Save as PDF**, **Save as DOCX** (một tệp Word thật — tiện khi chia sẻ với một coach hay recruiter), hay **Copy** nó vào clipboard. Cùng thanh xuất này giờ cũng xuất hiện trên các trang **báo cáo thị trường**, **kế hoạch sự nghiệp**, và **định hướng sự nghiệp**. Tệp `.docx` được dựng hoàn toàn trong ứng dụng — không dịch vụ bên ngoài nào từng thấy hai trang của bạn.

### Điểm khớp theo điều bạn muốn

Khi bạn đã lưu một hai trang, mọi tin trên **`#/scan`** nhận một huy hiệu nhỏ **`◎ N`** (0–100). Nó so sánh mỗi việc của **loại hình làm việc** (remote/hybrid/onsite), **quốc gia**, **sàn lương**, và **di chuyển** so với hai trang của bạn — huy hiệu xanh nghĩa khớp mạnh, đỏ nghĩa một điều phá vỡ thỏa thuận đã kích hoạt. Rê chuột để xem chi tiết (✓ điều gì đã khớp, ✗ điều phá vỡ thỏa thuận nào đã vi phạm).

Nó được cố tình trung thực: khi một tin không đưa ra **tín hiệu nào để so khớp** (ví dụ các sở thích của bạn toàn là văn bản tự do mà một dòng quét không thể xác nhận), **không huy hiệu nào được hiện cả** — hệ thống không bao giờ bịa một con số. Một vi phạm **điều phá vỡ thỏa thuận** cứng được tính nặng hơn một-**ghét**-mềm cùng loại. Ngoài huy hiệu, hai trang đã lưu của bạn được nhúng vào mọi lượt **đánh giá** LLM, nên các sở thích bạn nêu cũng định hình kết luận viết, không chỉ phép so CV vs JD.

## 22. Phỏng vấn thử (`#/mock-interview`)

Đọc tài liệu chuẩn bị phỏng vấn là một chuyện; *nói to câu trả lời thành tiếng* là chuyện khác. Trang **Phỏng vấn thử** (mở nó từ **Interview prep → Mock interview 🎤** trên thanh bên) chạy một luyện tập từng lượt so với một vị trí cụ thể, dựa trên chính CV, hồ sơ, hai trang, và kho chuyện của bạn. Nó không phải một danh sách câu hỏi có sẵn — người phỏng vấn phản ứng với những gì bạn thực sự nói.

### Bắt đầu một buổi

- Nhập một **vị trí mục tiêu** (và tùy chọn một **công ty**). Dán thêm **mô tả công việc** nếu bạn có — các câu hỏi sắc bén hơn hẳn.
- Bấm **Start interview**. Người phỏng vấn mở bằng một câu hỏi tập trung, được điều chỉnh theo vị trí và nền bản thân bạn.
- Gõ câu trả lời của bạn và bấm **Send answer**. Lặp lại bao lâu tùy bạn — đây là một cuộc trò chuyện, không phải một bài trắc nghiệm cố định.

### Mỗi lượt cho bạn gì

Sau mỗi câu trả lời, người phỏng vấn trả lời với ba phần:

- **Phản hồi** — điều gì đã ăn(tiếng) (điểm mạnh) và điều gì còn thiếu, diễn đạt dưới dạng **STAR+R** (Tình huống, Nhiệm vụ, Hành động, Kết quả, Chiêm niệm). Nó nêu tên chiều cụ thể bạn bỏ qua.
- **Điểm** — một `N/5` nhanh kèm một dòng lý do, để bạn cảm được tiến bộ qua một buổi.
- **Câu hỏi tiếp theo** — một câu hỏi nối tiếp chủ đàng dò phần yếu nhất trong câu trả lời vừa rồi.

Mọi thứ dựa trên tài liệu thật của bạn: `cv.md`, `config/profile.yml`, `config/two-pager.yml`, và kho chuyện STAR+R của bạn (`interview-prep/story-bank.md`) đều được nhúng vào prompt. Người phỏng vấn sẽ đẩy vào những khoảng trống thật nhưng không bao giờ bịa kinh nghiệm bạn không có. Chưa có khóa LLM, trang đưa bạn một prompt chạy ngay để dán vào bất kỳ trợ lý nào — cùng dự phòng trung thực được dùng ở mọi nơi khác trong ứng dụng.

### Lưu và xem lại các buổi

Bấm **Save transcript** để giữ một buổi luyện tập hoàn tất. Nó được ghi vào tầng người dùng của dự án gốc của bạn tại `interview-prep/mock-{company}-{role}-{date}.md`, nên nó nằm cạnh các ghi chú chuẩn bị phỏng vấn khác của bạn và không bao giờ bị ghi đè bởi các bản cập nhật hệ thống. Danh sách **Saved sessions** ở dưới trang cho bạn mở lại bất kỳ bản ghi nào hay xóa nó. Dùng **New interview** để bắt đầu lại với một vị trí khác.

## 23. Kết nối & nghiên cứu sâu công ty (`#/networking`)

Ứng tuyển qua cửa chính chỉ mới được một nửa ván — nửa còn lại là *biết một người nào đó*, hay ít nhất biết liên hệ ai và nói gì. Trang **Networking** (mở nó từ **Deep research → Networking 🤝** trên thanh bên) biến một công ty thành một kế hoạch cụ thể để có được một buổi phỏng vấn, dựa trên chính CV, hồ sơ, và hai trang của bạn.

### Dựng một kế hoạch

- Nhập một **công ty** (bắt buộc) và tùy chọn một **vị trí** cùng **mô tả công việc**. JD làm sắc các móc "tại sao tôi phù hợp".
- Bấm **Build plan**. Có khóa LLM nó chạy trực tiếp và render kế hoạch ngay tại chỗ; không có khóa nó đưa bạn một prompt chạy ngay để dán vào bất kỳ trợ lý nào (cùng dự phòng trung thực được dùng khắp ứng dụng — không gì bị bịa).

### Kế hoạch chứa gì

Kế hoạch quay lại trong bốn phần:

- **Hồ sơ công ty** — một bản tóm tắt gọn về công ty làm gì, những tín hiệu gần đây đáng trích, và hai ba móc "tại sao tôi phù hợp" rút từ nền bản thật của bạn.
- **Liên hệ ai** — ba đến năm persona mục tiêu (hiring manager của đội, một recruiter nội bộ, một kỹ sư cao cấp trong đội, một kết nối thân hay cựu sinh viên) kèm một chuỗi tìm kiếm LinkedIn **cụ thể** để tìm mỗi người. Nó không bao giờ bịa tên thật — nó báo bạn cách tìm đúng người.
- **Con đường giới thiệu ấm nhất** — con đường vào ấm thực tế nhất cho *nền bản*-của bạn: một nhà tuyển dụng/nhà trường/cộng đồng chung; một kết nối cấp hai; hay một tin lạnh tín hiệu cao khi đó thực sự là lựa chọn tốt nhất.
- **Bản nháp tiếp cận** — các tin ngắn, cụ thể (ba đến năm câu, không màu mè) cho các persona hàng đầu của bạn, dựa trên các điểm chứng minh thật của bạn để chúng không đọc như hàng loạt.

### Lưu và xem lại các kế hoạch

Bấm **Save plan** để giữ một kế hoạch. Nó được ghi vào tầng người dùng của dự án gốc của bạn tại `networking/net-{company}-{role}-{date}.md` — tệp của chính bạn, không bao giờ bị ghi đè bởi các bản cập nhật hệ thống. Danh sách **Saved plans** ở dưới trang cho bạn mở lại hay xóa bất kỳ kế hoạch nào. Vì các bản nháp và persona chỉ dựa trên tài liệu thật của bạn, hãy coi chúng như một bản nháp đầu tiên mạnh để cá nhân hóa — không phải một kịch bản để gửi mù quáng.

## 24. CV Studio (`#/cv-studio`)

**Add to CV (v1.117.0).** Một thẻ mới biến một dự án, bài đăng, hay trang portfolio (URL hay văn bản dán) thành các gạch đầu dòng ATS-ready chỉ dựa trên nguồn đó — chỉ số, nhà tuyển dụng, hay ngày không có trong nguồn bị bỏ qua, không bao giờ bịa. Bạn xem lại các gợi ý và tự dán phần bạn chấp nhận vào trình soạn CV; không gì được ghi tự động, và các nguồn URL được lấy qua cùng bộ xác thực an toàn SSRF với pipeline.

Trang `#/cv` là nơi bạn *viết* CV của mình; **CV Studio** (mở nó từ **Setup → CV Studio 🎨** trên thanh bên) là nơi bạn *mài sắc* nó. Nó đưa cho-`cv.md` của bạn ba công cụ trung thực, trong đó hai công cụ không bao giờ rời trình duyệt của bạn.

### Chẩn đoán CV

Ngay khi bạn mở trang, nó chấm CV của bạn trên-100 và liệt kê các phát hiện theo từng mục kiểm tra, mỗi mục kèm một giải thích ngắn để *chính bạn* quyết định sửa gì (nó không bao giờ viết lại im lặng):

- **Độ dài** — CV có nằm trong khoảng một hai trang lành mạnh không?
- **Tác động định lượng** — bao nhiêu phần trăm gạch đầu dòng của bạn có một con số hay chỉ số thật? Các recruiter lướt tìm chúng.
- **Động từ hành động mạnh** — gắn cờ cách diễn đạt yếu như "chịu trách nhiệm cho" hay "hỗ trợ".
- **Từ hoa mỹ** — gắn cờ sáo ngữ rỗng ("hướng đến kết quả", "người chơi đội group").
- **Các mục cốt lõi** — kiểm tra Tóm tắt, Kinh nghiệm, Học vấn, và Kỹ năng.
- **Thông tin liên hệ** — đảm bảo có email.

Việc này chạy hoàn toàn trong trình duyệt của bạn, không LLM — các con số là tất định và không gì bị bịa.

### Mặt nạ riêng tư

Trước khi bạn chia sẻ CV như một mẫu bài viết hay một ảnh chụp màn hình, **Mặt nạ riêng tư** che các dữ liệu nhận diện cá nhân: email, điện thoại, liên kết/tên tài khoản, và địa chỉ đường phố, cộng **tên → viết tắt** nếu bạn chọn bật và nhập nó. Bật tắt từng loại, sao chép bản đã che, và chia sẻ một cách an toàn. Nó diễn ra hoàn toàn trong trình duyệt, báo đúng số mục đã che, và không bao giờ lưu hay truyền bản gốc.

### Làm nó tự nhiên (khớp giọng nói)

Dán một câu hay đoạn cứng nhắc — kiểu cách diễn đạt AI chung chung đọc như hàng khuôn — và **Làm nó tự nhiên** viết lại nó bằng *giọng*-của bạn. Bản viết lại được đặt gốc phía máy chủ trong `voice-dna.md` của bạn (cách bài viết của bạn đọc ra sao) và `writing-samples/` của bạn (văn bản thật của bạn). Quy tắc cứng: nó có thể sắp lại, thu gọn, và đổi giọng, nhưng nó **không bao giờ** đưa vào một sự kiện, chỉ số, hay thành tựu không đã có trong văn bản bạn vừa dán. Có khóa LLM nó viết lại trực tiếp; không khóa nó đưa bạn một prompt chạy ngay để dán vào bất kỳ trợ lý nào. Rồi sửa CV trên trang-`#/cv` như thường lệ — CV Studio gợi ý, bạn quyết định.

**Điều chỉnh theo một công việc.** Dán một mô tả công việc vào thẻ **Tailor to a job** và CV Studio tạo ra một **CV được điều chỉnh cho tin đăng ấy cộng một thư xin việc khớp**, rồi đưa cả hai qua một **cổng danh mục kiểm tra độ recruiter** trước khi trao chúng. Cơ chế này được chưng cất từ thực hành coaching sự nghiệp thành các quy tắc chung — một recruiter đọc trong vài giây, nên kinh nghiệm liên quan lên đầu, tiêu đề khớp vị trí của tin, kết quả mang con số cụ thể, và thư xin việc giữ dạng teaser ngắn với một cầu nối "yêu cầu ↔ sự kiện khớp của bạn". Danh mục báo cáo mỗi mục dưới dạng PASS/FAIL: **lỗi chặn** (chúng được sửa trước khi bạn thấy kết quả), **cảnh báo khuyên**. Mọi thứ được đặt gốc chỉ trong CV, hồ sơ, và hai trang của chính bạn — nó sắp lại và định hình lại những gì bạn đã có nhưng **không bao giờ bịa** một nhà tuyển dụng, chỉ số, hay tuyên bố. Có khóa LLM nó chạy trực tiếp; không khóa bạn nhận prompt chạy ngay. Tùy chọn gõ một vị trí/tiêu đề mục tiêu để lái nó. Xuất kết quả thành Markdown, PDF, hay DOCX bằng các nút trên thẻ kết quả.

### Gợi ý "Dùng lại CV cũ?"

Khi bạn chọn một mô tả công việc đã lưu trong CV Studio, một gợi ý một dòng trầm báo bạn bạn đã từng điều chỉnh một CV cho một vị trí tương tự hay chưa. Ứng dụng so sánh JD được chọn với các JD khác đã lưu của bạn (một điểm chồng từ tất định cộng một hàng rào cấp bậc — không AI, không lưu gì) và lộ khớp tốt nhất duy nhất dưới một trong ba kết luận:

- **dùng lại** — rất giống một JD đã lưu; nhiều khả năng bạn dùng lại được CV đó nguyên trạng.
- **dùng lại kèm chỉnh sửa** — giống; dùng lại CV đó nhưng sửa nhẹ.
- **tạo lại** — không có JD đã lưu nào gần giống, nên điều chỉnh một CV mới.

Gợi ý xuất hiện tự động một khi bạn có ít nhất hai JD đã lưu, và làm mới khi bạn đổi JD được chọn. Nó chỉ là một cú hích — nó không bao giờ đổi CV hay các JD của bạn.

## 25. Bộ nhớ (`#/memory`)

Mọi trang khác bắt đầu tươi mỗi lần. **Bộ nhớ** (mở nó từ **Setup → Memory 🧠** trên thanh bên) là nơi duy nhất bạn nói với trợ lý một lần và nó dính lại. Nó giữ một ghi chú ngắn, có thể sửa "nhớ điều này về tôi" được đưa vào **mọi** yêu cầu AI.

### Nó dùng để làm gì

Dùng nó cho các sở thích bền và phong cách làm việc, ví dụ:

- Các loại vị trí và công ty bạn đang nhắm (và những cái bạn không muốn từng thấy).
- Bạn thích câu trả lời được viết ra sao — gọn hay chi tiết, giọng người kỳ cựu, không màu mè.
- Các ràng buộc cứng đáng lặp lại — chỉ remote, một sàn lương, không trực ca.

Giữ nó trong phạm vi sở thích và lái hướng. Nó **không phải** nơi cho các sự kiện về kinh nghiệm của bạn — kỹ năng, nhà tuyển dụng, và thành tựu của bạn nằm trong CV, hồ sơ, và hai trang, vốn vẫn là nguồn duy nhất cho bất cứ gì xuất hiện trong các CV và thư xin việc của bạn. Ghi chú bộ nhớ định hình *cách* trợ lý làm việc cùng bạn, không bao giờ *nói gì* về bạn.

### Nó lan tới mọi thứ như thế nào

Khi bạn bấm **Save memory**, ghi chú được ghi vào tầng người dùng của dự án gốc của bạn tại `config/memory.md` và nhúng vào ngữ cảnh dự án chung. Điều đó nghĩa là nó tự động đi cùng **mọi** yêu cầu AI — các đánh giá, phỏng vấn thử, kế hoạch kết nối, các bản viết lại CV Studio — và trên **mọi** nhà cung cấp bạn đã cấu hình. Viết một lần; bạn không phải lặp lại trên mỗi trang. Như các tệp tầng người dùng khác của bạn, nó không bao giờ bị ghi đè khi bạn cập nhật hệ thống, và nó chỉ rời máy của bạn bên trong các prompt LLM bạn chọn chạy.

### Gợi ý từ dữ liệu của bạn

Chưa biết viết gì? **✨ Suggest from my data** đọc tracker ứng tuyển của bạn và soạn một bộ gạch đầu dòng hành vi — các mẫu trong những gì bạn theo đuổi, chấp nhận, và từ chối. Chạy prompt nó đưa bạn trong bất kỳ LLM nào, xem lại các gợi ý, và dán một bản đã sửa vào ghi chú. Nó khai thác chỉ tracker của chính bạn và không bao giờ bịa sự kiện; bạn luôn xem lại trước khi bất cứ gì được lưu.

## 26. Thống kê (`#/stats`)

**Tab Mẫu lý do từ chối (v1.117.0).** Một tab thứ tư chạy `analyze-patterns.mjs` của dự án gốc (chỉ đọc) và hiển thị cơ cấu kết quả của bạn, các khuyến nghị hành động được, và tỷ lệ đi tiếp theo từng nhà cung cấp ATS (tín hiệu "đơn culture thuần thuật toán" — Bommasani và cộng sự, FAccT 2026). Các nhà cung cấp dưới mẫu tối thiểu được đánh dấu dấu sao; không có dự án gốc thì tab hiện một ghi chú trung thực.

Trang **Thống kê** gộp ba chế độ xem dưới một mục: một báo cáo thị trường do AI tạo, phân tích trên pipeline của chính bạn, và xu hướng việc làm theo vị trí mục tiêu từ các lượt quét của bạn. Chuyển giữa chúng bằng các tab ở đầu.

### Báo cáo thị trường

Tab **Market report** nhờ mô hình một phân tích lương và thị trường lao động cho *các*-vị trí mục tiêu của bạn — nó đọc CV và hồ sơ của bạn để biết cần bao phủ những vị trí và cấp bậc nào. Gõ một **Region / market** (ví dụ `Russia`, `EU-remote`, `US`, hay `Germany`), chọn một **Currency**, và bấm **Generate market report**. Bạn nhận một báo cáo có cấu trúc với tóm tắt điều hành, lương theo cấp (trung vị cộng P10/P25/P75/P92), các nhà tuyển dụng hàng đầu, một bảng kỹ năng đang cần, tần suất phúc lợi, tỷ lệ văn phòng/hybrid/remote, các xu hướng-12–24-tháng kể cả tác động AI, và hướng dẫn đàm phán. Mọi con số là một **ước tính định hướng từ kiến thức huấn luyện của mô hình** — không phải dữ liệu thu thập hay trực tiếp — và báo cáo nói vậy; hãy coi các con số như khoảng, không phải báo giá. Chưa có khóa API bạn nhận một prompt sao chép dán thay vì một báo cáo bịa. Dùng **Download .md**, **Save as PDF**, hay **Copy** để mang báo cáo khỏi ứng dụng.

### Pipeline của tôi

Tab **My pipeline** vẽ tracker ứng tuyển của chính bạn — không gì bên ngoài. Nó hiển thị bạn đã theo dõi bao nhiêu vị trí, phân bố điểm của bạn, phễu trạng thái, các công ty và vị trí hàng đầu của bạn, các đơn ứng tuyển theo thời gian, và các tỷ lệ chuyển đổi (bao nhiêu phần trăm đơn đạt tới Applied, Responded, Interview, và Offer). Đó là tấm gương trung thực của cuộc tìm kiếm của bạn: nó chỉ phản ánh những gì đã có trong `data/applications.md`.

### Xu hướng vị trí mục tiêu

Tab **Target role trend** là chế độ xem ban đầu: số đếm việc làm và lương trung vị theo quốc gia cho các vị trí mục tiêu của bạn, tổng hợp từ lượt quét gần nhất của bạn, với một bộ chọn tiền tệ và một tổng quan **Postings by target role**. **Save snapshot** ghi lại tổng hợp hiện tại để bạn xem số đếm việc làm di chuyển ra sao theo thời gian, và đường xu hướng đọc lại những ảnh chụp ấy. Dữ liệu thưa là mong đợi và được gán nhãn tham khảo — nó không bao giờ được làm đầy bằng số bịa.

### Toàn thời gian & lương thưởng

Tab **Lifetime** (v1.118.0) chuyển tiếp hai script dự án gốc không tốn token, chỉ đọc: `stats.mjs` — bản gộp tracker toàn thời gian của bạn, các tỷ lệ phễu lũy kế (phản hồi / phỏng vấn / offer), tổng số scanner, và độ phủ cổng — và `salary-gap.mjs` — lương mong muốn so với đăng tuyển so với thực tế cho từng đơn, gộp từ các Machine Summary của báo cáo và `data/salary-observations.tsv`. Mẫu nhỏ được gán nhãn tham khảo; không có dự án gốc thì tab hiện một ghi chú trung thực.

### Nhật ký tự đánh giá kỹ năng (`#/assessments`)

`#/assessments` là một nhật ký đơn giản cho các bài đánh giá kỹ năng bạn làm — một bài test lập trình trên nền tảng của một công ty, một bài tập về nhà, một bài quiz chứng chỉ. Ghi một sự kiện — **công ty**, **nền tảng**, **kỹ năng**, một ngưỡng đậu **%** tùy chọn và **điểm-%** của bạn, cộng một ghi chú văn bản tự do — và nó được nối, mỗi sự kiện một dòng, vào `data/assessments.tsv` trong dự án gốc. Trang cũng liệt kê mọi thứ bạn đã ghi và gộp nó theo nền tảng để bạn thấy mình đang làm ra sao theo thời gian. Đó là một lần ghi tường minh do bạn kích hoạt; khi dự án gốc không có mặt, trang hiện một dòng "không khả dụng" trầm.

## 27. Kế hoạch sự nghiệp (`#/career-plan`)

Trang **Career plan** biến CV và hồ sơ của bạn thành một kế hoạch phát triển cụ thể, được cá nhân hóa — kiểu kế hoạch bạn sẽ dựng cùng một coach sự nghiệp, nhưng được tạo từ chính tài liệu của bạn và thuộc về bạn để sửa.

### Tạo một kế hoạch

Chọn một **Horizon** (6, 12, hay 24 tháng), tùy chọn gõ một **Focus** (ví dụ "chuyển sang quản lý", "đi remote", hay "đổi sang Go"), và bấm **Generate plan**. Mô hình đọc CV, hồ sơ, hai-trang, và ghi chú bộ nhớ của bạn (qua ngữ cảnh dự án chung) và viết một kế hoạch có cấu trúc: một ảnh chụp điểm khởi đầu trung thực, một SWOT thế mạnh và tăng trưởng, các mục tiêu diễn đạt dưới dạng SMART / OKR / WOOP, các quỹ đạo sự nghiệp thay thế kèm đánh đổi, một kế hoạch kỹ năng cứng/mềm, một lộ trình theo tháng cho chặng bạn chọn, cách theo dõi tiến độ, các bẫy dễ dính, và các nước đi hỗ trợ. Mọi khuyến nghị được đặt gốc vào những gì tài liệu của bạn thực sự thể hiện — nó lập kế hình tiến lên, không bao giờ bịa sự kiện về lịch sử của bạn. Chưa có khóa API bạn nhận một prompt sao chép dán thay thế.

### Sửa và lưu

Kế hoạch đổ vào một vùng văn bản có thể sửa — sửa bất cứ gì, rồi bấm **Save plan**. Nó được ghi vào tầng người dùng của dự án gốc của bạn tại `config/career-plan.md`, nên nó sống sót qua các bản cập nhật hệ thống và chỉ rời máy của bạn bên trong các prompt LLM bạn chọn chạy. **Preview** render Markdown của bạn để bạn đọc nó có định dạng trước khi lưu.

### Xuất

Dùng **Download .md**, **Save as PDF**, hay **Copy** để mang kế hoạch khỏi ứng dụng — cùng các nút xuất được dùng khắp các báo cáo AI của ứng dụng. PDF đi qua bộ tạo PDF nội dòng hiện có; Markdown là tải trực tiếp.

## 28. Định hướng sự nghiệp (`#/orientation`)

Trang **Career orientation** trả lời "những hướng nào thực sự phù hợp với tôi?" — kiểu đọc bạn sẽ nhận từ một bài test hướng nghiệp, nhưng suy ra từ chính CV và hồ sơ của bạn chứ không phải từ một bảng câu hỏi.

### Nó tạo ra gì

Bấm **Generate profile** và mô hình đọc CV, hồ sơ, hai-trang, và ghi chú bộ nhớ của bạn rồi viết một hồ sơ định hướng sự nghiệp: các **vectơ sự nghiệp khớp nhất** của bạn (trong tám archetype — Functionalist, Administrator, Communicator, Specialist, Analyst, Innovator, Manager, Entrepreneur — cái nào khớp tốt nhất, kèm bằng chứng từ CV của bạn), một xu hướng loại hình sự nghiệp, một bộ **vị trí đề xuất**, các **thế mạnh chuyên môn** gắn với những gì CV thể hiện, các **xu hướng phong cách làm việc** ("CV của bạn đọc ra sao" trên vài trục), và các **khuyến nghị phát triển** để mở rộng độ phù hợp của bạn.

### Nó được tạo ra như thế nào

Đây là một **sự chiệm nghiệm AI về CV của bạn đọc ra sao — không phải một bài trắc nghiệm tâm lý.** Prompt được đặt gốc hoàn toàn vào tài liệu của chính bạn: nó không bịa thành tựu và không bao giờ báo các điểm bài test số học như thể chúng được đo. Chưa có khóa API bạn nhận một prompt sao chép dán để chạy trong bất kỳ LLM nào thay vì một hồ sơ trực tiếp. Không gì được ghi lên đĩa — hồ sơ được tạo mới mỗi lần.

### Xuất

Dùng **Download .md**, **Save as PDF**, hay **Copy** để giữ hồ sơ — cùng các nút xuất được dùng khắp các báo cáo AI của ứng dụng. PDF đi qua bộ tạo PDF nội dòng hiện có; Markdown là tải trực tiếp.

## 29. Tuyên ngôn CareerOps

career-ops — dự án gốc mà ứng dụng này đứng trước — là bản tham chiếu triển khai đầu tiên của [Tuyên ngôn CareerOps](https://career-ops.org/manifesto) (parent v1.20.0). Tuyên ngôn đặt tên cho thực hành mà cả chuỗi công cụ này tồn tại vì nó: chạy một cuộc tìm việc theo cách kỹ sư vận hành hệ thống sản xuất — với bằng chứng, với kỷ luật, và với các công cụ đứng về phía ứng viên trên bàn đàm phán.

### Nó nói gì

Sáu nguyên tắc — "ứng tuyển tốt hơn vào những nơi ít hơn", "tín hiệu hơn lượng", "bằng chứng hơn từ khóa", "một con người quyết định", "cục bộ trước", "phẩm giá trên cả hai bên bàn đàm phán" — cộng một hiên chương quyền ứng viên cho thời đại tuyển dụng trung gian bởi AI: bạn vô hình theo mặc định, không ai đề xuất bạn không có lời đồng ý của bạn, lời đồng ý của bạn là của con người và không thể ủy quyền cho một agent, bạn không bao giờ phải trả tiền, dữ liệu của bạn thuộc về bạn. Ứng dụng tuân theo những quy tắc này ngay trong thiết kế: không gì từng được nộp tự động, mọi thứ chạy cục bộ, và mọi tuyên bố trong một CV được tạo truy vết ngược về tài liệu của chính bạn.

### Đọc và ký

Liên kết trên chân thanh bên mở trang tuyên ngôn. Bạn cũng có thể đọc `MANIFESTO.md` trong dự án gốc, hay chạy `npm run manifesto` ở đó để mở trang ký. Ký là tùy chọn và mất mười giây — chữ ký của bạn trở thành một commit công khai trong sổ cái `SIGNATURES.md` của repository gốc. Không gì trong ứng dụng phụ thuộc vào việc bạn có ký hay không.

**Ứng dụng này tự nó được dựng ra sao.** Tuyên ngôn nói về cách chạy một cuộc tìm việc; phần mềm đứng trước nó được dựng bằng các coding agent, và thực hành ấy có danh mục riêng: [Agentic Coding Design Patterns](https://mokevnin.github.io/agentic-coding-design-patterns/en/)
của Kirill Mokevnin ([bản tiếng Nga](https://mokevnin.github.io/agentic-coding-design-patterns/ru/)).
career-ops-ui tuân theo nó một cách có chủ đích — các lan can thực thi được trong một pre commit hook được commit, các quy trình đóng gói dưới dạng skill, các fan out song song cách lý, một từ điển miền dữ liệu,
ADR, nhật ký tiến độ và các eval quy trình. Những gì thực sự được triển khai, và những gì chưa, được kiểm toán trên trang *Agentic Practices* của wiki dự án.

## 30. Hermes & Telegram

**Hermes của Nous Research** là một agent tự chủ mở — gọi công cụ, skill, và hơn-20-kênh nhắn tin, trong đó có Telegram. **Từ v1.151.0, Hermes là một nhà cung cấp LLM được nối hẳn:** chạy OpenAI compatible API Server của nó (`hermes gateway`), đặt `HERMES_API_KEY` trong **App settings**, và career-ops-ui chạy các lượt đánh giá trực tiếp qua Hermes cục bộ của bạn. Mục này cũng bao gồm chạy ứng dụng trên một máy chủ đám mây và cầu nối các sự kiện của nó sang Telegram qua Hermes — hai việc đó là hướng dẫn vận hành, không phải tính năng ứng dụng. Hướng dẫn đầy đủ là `docs/integrations/HERMES.md`, và skill `hermes-bridge` đi từng bước.

### Hermes là gì

Hermes là một runtime agent nối vào các nhà cung cấp LLM của chính bạn — và nó cũng cung cấp một **API Server tương thích OpenAI**: `hermes gateway` phục vụ `POST /v1/chat/completions` tại `http://127.0.0.1:8642/v1` với một khóa Bearer (`API_SERVER_KEY` của nó). Đó là lý do career-ops-ui coi nó chỉ là một nhà cung cấp khác (đường "Shape A" trong hướng dẫn): ứng dụng POST vào điểm cuối cục bộ ấy chính xác như nó làm với OpenAI hay Qwen, và Hermes điều hướng yêu cầu tới bất kỳ mô hình nào bạn đã cấu hình bên trong nó. Nó đứng **cuối** trong thứ tự nhà cung cấp tự động, nên nó không bao giờ ghi đè một thiết lập Anthropic/Gemini/OpenAI/Qwen hiện có.

### Chạy trên một máy chủ đám mây

career-ops-ui bind vào-`127.0.0.1` theo mặc định. Để tới một agent Hermes nằm trên máy chủ, bạn đưa nó khỏi loopback — một cách cẩn thận. Giữ ứng dụng bind vào loopback và đặt một reverse proxy (nginx hay Caddy) ở trước chấm dứt HTTPS; chạy nó dưới systemd hay pm2 với một user không phải root; và giữ nguyên hợp hợp đồng read-only của career-ops gốc trên cái hộp headless. Lớp bảo mật phải sống sót qua lần di chuyển: một Content Security Policy không có script nội dòng, hàng rào SSRF trên mọi lần lấy URL do người dùng cung cấp, ranh gới markdown/XSS, và không secret trong log. Hướng dẫn có danh sách kiểm tra đầy đủ — không bao giờ mở `0.0.0.0` ra internet công khai một cách trực tiếp.

### Telegram qua Hermes

Cây cầu cho phép các sự kiện ứng dụng — một lượt quét hoàn tất, một báo cáo mới, một lần nhắc lại vừa đxfc trở nên khẩn — tới một chat Telegram qua Hermes. Token bot Telegram nằm trong cấu hình của chính Hermes, không bao giờ trong career-ops-ui. Chỉ gửi tối thiểu những gì hữu dụng: "Quét xong — 12 kết quả mới" cộng một liên kết bạn tự mở. **Không bao giờ gửi** văn bản CV, con số lương, thân báo cáo thô, khóa API, hay URL nội bộ sang kênh — danh sách "điều KHÔNG nên lộ" trong mô hình mối họa của hướng dẫn là quy tắc. Trang này tới được từ-`#/help`, và trợ lý tài liệu trong ứng dụng trả lời các câu hỏi dựa trên nó.

## 31. Chạy toàn bộ stack trên đám mây

Đa số người chạy career-ops trên laptop của mình. Nhưng pipeline ở trạng thái tốt nhất khi nó **luôn bật** — quét các bảng trong khi bạn ngủ, giữ tracker tươi mới, sẵn sàng trên trình duyệt từ bất kỳ thiết bị nào. Mục này là công thức đầu cuối để đặt **toàn bộ stack** lên một máy chủ đám mây nhỏ: pipeline **career-ops** gốc, trình xem **career-ops-ui** này, và **engine** chạy AI — hoặc **gói đăng ký Claude** của bạn (qua CLI Claude Code) hay một gateway-**Hermes** cục bộ. Nó xây trên các ghi chú đám mây Hermes ở-§30; danh sách kiểm tra vận hành đầy đủ là `docs/integrations/HERMES.md`.

### Ba bộ phận chuyển động

Stack gồm ba mảnh phối hợp, và việc giữ chúng tách bạch có lợi. **career-ops** (gốc) là pipeline tìm việc AI — nó sở hữu `cv.md`, `config/`, `reports/`, và `portals.yml` của bạn, và nó được lái bởi một **agent CLI**. **career-ops-ui** (ứng dụng này) là một trình xem web chủ yếu đọc nằm *bên trong* career-ops dạng `web-ui/` và đưa cùng những tệp ấy lên trình duyệt; nó chỉ ghi ngược trên các hành động tường minh. **Engine** là bất cứ gì thực sự trả lời các prompt AI. Hai trong ba vẫn giống nhau trên máy chủ như trên laptop — chỉ lựa chọn engine và mức lộ mạng là đổi.

### Cấp phát và cài đặt

Thuê một VPS nhỏ (1 vCPU / 1 GB RAM là dư dả cho trình xem) chạy một Linux hiện tại, và cài **Node ≥ 18** (khuyến nghị-22.5+ — nó bật chỉ mục tracker SQLite của dự án gốc). Cài `git`. Rồi làm chính xác như một bản cài cục bộ làm: clone `career-ops` gốc, và clone repo này bên trong nó dạng `career-ops/web-ui/`. Đặt các khóa nhà cung cấp vào `.env` của dự án gốc (không bao giờ commit nó — `.env` / `.env.*` bị gitignore; bắt đầu từ-`.env.example`). Chạy trình xem bằng `npm start` — nhưng giữ nó bind vào-`127.0.0.1`; bạn sẽ lộ nó qua một proxy, không trực tiếp (xem dưới).

### Chọn engine của bạn

career-ops không ràng buộc CLI, nên bạn có ba lựa chọn trung thực cho AI. **Gói đăng ký Claude của bạn** — cài CLI-**Claude Code** trên cái hộp và `claude login` với gói Pro/Max; các lần chạy agent của dự án gốc khi đó dùng gói đăng ký của bạn, không có hóa đơn API theo token. **Hermes** — chạy `hermes gateway` trên cùng cái hộp (nó cung cấp một API tương thích OpenAI tại `http://127.0.0.1:8642/v1`) và đặt `HERMES_API_KEY` trong **App settings**; các lượt đánh giá trực tiếp của career-ops-ui điều hướng qua nó (cuối trong thứ tự nhà cung cấp tự động). **Các khóa API** — đặt `ANTHROPIC_API_KEY` (hay bất kỳ nhà cung cấp nào: Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes → DeepSeek → GLM (Z.ai) → Kimi (Moonshot) → MiniMax → Mistral → Grok (xAI) → Together → Fireworks → Ollama → BytePlus Ark → Volcengine Ark) vào `.env` của dự án gốc, và các hành động-⚡-trực tiếp chạy headless. Bạn có thể trộn: một gói đăng ký Claude cho công việc agent nặng của dự án gốc, và một nhà cung cấp rẻ hay cục bộ cho các lượt đánh giá nhanh của trình xem.

### Lộ nó ra ngoài một cách an toàn

Rời-`127.0.0.1` nghĩa là lớp an toàn mà loopback đã tặng bạn miễn phí giờ phải được dựng tường minh — **code giống hệt; chỉ mức lộ đổi.** Giữ ứng dụng bind vào loopback và đặt một reverse proxy (**nginx** hay **Caddy**) ở trước chấm dứt-**HTTPS** (Let's Encrypt / TLS tự động) và chuyển tiếp về-`127.0.0.1:4317`; chạy nó dưới-**systemd** hay `pm2` với một user dedicated **không phải root** kèm-`Restart=on-failure`. Đặt **xác thực** ở trước — ứng dụng không có đăng nhập riêng, nên proxy (basic-auth, một-forward-auth-SSO, hay một mạng riêng / VPN) là thứ giữ người lạ ra. Khi bạn đặt `HOST=0.0.0.0` để proxy tới được nó, lớp cứng hoá có sẵn đã là no op trên loopback bật lên và trở thành chịu tải: giới hạn tốc LLM, hàng rào DNS rebind-`safeGet`, và vệ sinh tên đường dẫn. Bất biến phải sống sót qua lần di chuyển, và bạn không được nới lỏng chúng: **CSP** (không script nội dòng, `frame-ancestors 'none'` — proxy không được strip những header ấy), **hàng rào SSRF** trên mọi lần lấy URL do người dùng cung cấp, **ranh gới markdown/XSS** (`stripDangerousMarkdown()` phía máy chủ + `UI.md()` escape trước phía client), và **không secret trong log**. Hợp đồng read only của dự án gốc vẫn hiệu lực trên cái hộp headless — máy chỉ chỉ đọc `cv.md` / `config/` / `reports/` của bạn và ghi trên các hành động tường minh.

## 32. Chạy nó từ OpenWorker (AI coworker)

Thích một AI coworker desktop hơn trình duyệt? **[career-ops-coworker](https://github.com/Fighter90/career-ops-coworker)** là một coworker **[OpenWorker](https://github.com/andrewyng/openworker)** (ứng dụng coworker AI mở, cục bộ trước của Andrew Ng) lái toàn bộ pipeline này giúp bạn — quét các bảng, chấm độ khớp so với CV của bạn, điều chỉnh một CV + thư xin việc có gốc rễ, theo dõi các đơn ứng tuyển, soạn các lần nhắc lại — và nó có thể **khởi chạy dashboard này** theo yêu cầu. Đó là một-"persona"-Markdown đơn, không code; OpenWorker không chạy bất cứ phần nào của nó như một chương trình, các chỉ dẫn chỉ lái agent. Hướng dẫn của nó phát hành trong cả-17-ngôn ngữ.

### Coworker làm gì

Làm việc bên trong thư mục dự án-`career-ops`-của bạn, coworker chạy cùng các bước pipeline làm: nó quét các bảng trong-`portals.yml`-của bạn (không tốn token), chấm mỗi tin-0–5 so với `cv.md` + `config/profile.yml`-của bạn, và — theo yêu cầu — điều chỉnh một CV + thư xin việc theo vị trí đặt gốc **chỉ** vào các sự kiện đã có trong CV của bạn (nó không bao giờ bịa một nhà tuyển dụng, ngày, hay chỉ số). Nó cập nhật `data/applications.md`, soạn các email nhắc lại, và có thể đặt các slot phỏng vấn — với mỗi lần gửi hay ghi **được cổng bởi sự đồng ý**, chính xác như học thuyết của chính career-ops. Để mở trình xem này, nó chạy `bash web-ui/bin/start.sh` (hay `npm start`) và đưa bạn `http://127.0.0.1:4317`.

### Cài đặt và khởi chạy

Cài OpenWorker và thêm một khóa mô hình (Anthropic / OpenAI / Google, hay một Ollama cục bộ). Nhanh nhất là **một lệnh** — nó dựng pipeline-`career-ops`-mà coworker lái và là idempotent, dùng lại `career-ops` / `web-ui`-hiện có mà không ghi đè dữ liệu của bạn:

```bash
curl -fsSL https://raw.githubusercontent.com/Fighter90/career-ops-coworker/main/install.sh | bash
```

Rồi thêm coworker trong panel-**Install a coworker** của OpenWorker — bằng **GitHub-URL** (`https://github.com/Fighter90/career-ops-coworker`), bằng **.zip** (từ [Releases](https://github.com/Fighter90/career-ops-coworker/releases)), hay bằng cách-**nhập** `career-ops.md`. Mở một buổi **Job-Search Coworker**, chọn thư mục-`career-ops`-của bạn, và hỏi *"scan my boards and give me the top 5 fits this week"* hay *"open the dashboard."* Các connector (Gmail, Google-Calendar, GitHub) và hướng dẫn đầy đủ nằm trong-[hướng dẫn](https://github.com/Fighter90/career-ops-coworker/tree/main/help) của repo coworker. Đã xác minh cài được đối với bộ nạp của chính OpenWorker và bộ cài repo của nó.

## 33. Bản đồ việc làm (`#/map`)

Bản đồ hiển thị kết quả quét, pipeline đang chờ và tracker của bạn trên một bản đồ OpenStreetMap. Một **chấm đặc** là một điểm đánh giá (tracker); một **vòng tròn** là một gợi ý khớp tiêu đề cho một tin bạn chưa đánh giá (pipeline, quét). Một **con số** gộp các tin gần nhau và hiển thị điểm/khớp tốt nhất đang thấy; phóng to để tách chúng. Thang xanh ngọc sang xám tuyến tính làm các việc mạnh nhất lớn nhất và nổi bật nhất trong khi các việc yếu lùi xa. 📍 đánh dấu một địa chỉ nhà tuyển dụng tìm thấy trong OpenStreetMap, nếu không chấm nằm tại trung tâm của địa điểm.

Thanh công cụ lọc các lớp, điểm đánh giá (**All / 3.0+ / 3.8+ / 4.2+**) và, khi dữ liệu-`career-ops-plugin-commute`-v0.2.0-có mặt, thời gian lái xe tối đa. Các việc chưa đánh giá và các lượt đi làm không rõ có các công tắc độc lập, mặc định bao hàm. Các lựa chọn được giữ trong trình duyệt này; **Reset** khôi phục mặc định và **Fit results** là hành động lọc duy nhất định hình lại bản đồ. Một ngôi nhà đã cấu hình được hiển thị như một mốc tham chiếu trung tính và không bao giờ được đếm hay gộm cụm. Trên điện thoại bản đồ lấp đầy khung hình hữu dụng: **Filters** mở một bottom sheet, và lần chạm mốc đầu tiền nhìn peek công ty + tiêu đề, điểm/khớp và lượt đi làm; chạm thẻ để mở việc làm.

UI đọc hợp đồng ổn định `config/plugins.yml` + `data/commute.tsv` của plugin qua một endpoint no-store. Các URL router, email geocoder và các cài đặt plugin riêng khác không bao giờ tới trình duyệt. Cùng sở thích đi làm ấy điều khiển các cột Location/Drive tùy chọn, bộ lọc và sắp xếp của Tracker.

### Cách dùng bản đồ

<p align="center"><img src="https://raw.githubusercontent.com/Fighter90/career-ops-ui/main/images/job-map-en.png" alt="Bản đồ việc làm: kết quả quét, pipeline và các tin tracker trên bản đồ OpenStreetMap" width="760"></p>

1. **Chạy một lượt quét trước** (`#/scan`) — bản đồ vẽ những gì lần quét cuối, pipeline và tracker đang giữ; một dự án rỗng hiện một bản đồ rỗng.
2. **Mở `#/map`.** Dòng dưới tiêu đề đếm tiến độ: *Đã định vị: N/M* lấp đầy khi các địa điểm được tra (những địa điểm đã cache hiện ngay), và *Không có địa điểm* đếm các tin không nêu địa điểm nào (chỉ remote, "Anywhere").
3. **Đọc các màu.** Đặc = điểm đánh giá của bạn (xanh=tốt · vàng=khá · xanh dương=trung bình · đỏ=yếu). Vòng tròn = khớp tiêu đề trước khi đánh giá (cùng các màu, xám = không có tín hiệu khớp).
4. **Phóng to** vào một con số để tách một nhóm; ở cấp đường phố các tin cùng một điểm lan ra để mỗi tin được bấm riêng.
5. **Bấm một chấm** để mở tin, hay báo cáo đánh giá cho một mục tracker.
6. **Đổi lớp** (trên phải) để so sánh, ví dụ, chỉ tracker với kết quả quét mới.

Một tin liệt kê nhiều địa điểm ("Berlin Office · Berlin · Germany · Bosnia · …", "Berlin; Munich", "Remote U.S. · Toronto") được đặt tại **địa điểm thật đầu tiên** của nó; các đoạn-"Remote …", "(HQ)" và một-"Office"-đuôi bị bỏ qua. Bản đồ khung vào nơi đa số tin nằm, nên vài tin xa xôi không làm thu nhỏ khung — thu nhỏ để thấy chúng.

### Dữ liệu và quyền riêng tư

Bản đồ là chế độ xem duy nhất nói chuyện với các dịch vụ bên ngoài, và chỉ trong khi bạn đang mở nó: trình duyệt tải các tile bản đồ từ máy chủ tile, và máy chủ gửi **địa điểm và tên công ty** của mỗi tin (không bao giờ CV hay hồ sơ của bạn) tới bộ định vị địa lý Nominatim. Các câu trả lời được cache trong `web-ui/.cache/geocode.json`, nên mỗi địa điểm được tra một lần. Để giữ những yêu cầu này trên hạ tầng của chính bạn, trỏ các biến dưới đây về các máy chủ tự lưu trữ.

### Cấu hình

| Biến | Mặc định | Mục đích |
|---|---|---|
| `NOMINATIM_URL` | `https://nominatim.openstreetmap.org` | URL gốc bộ định vị (Nominatim tự lưu trữ) |
| `NOMINATIM_EMAIL` | — | Địa chỉ liên hệ gửi tới Nominatim công khai, như chính sách sử dụng của nó yêu cầu |
| `NOMINATIM_GAP_MS` | `1100` | Khoảng cách tối thiểu giữa các lượt tra trên host công khai (nâng lên khi vài instance dùng chung một IP) |
| `MAP_TILE_URL` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Mẫu tile Leaflet; host của nó được thêm vào CSP `img-src` |
| `MAP_TILE_ATTRIBUTION` | OpenStreetMap | Ghi công hiển thị cho tile tùy chỉnh |
