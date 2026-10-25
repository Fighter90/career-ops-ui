# Nhật ký thay đổi (Tiếng Việt)

> Nhật ký này bắt đầu từ v1.254.0 — bản phát hành thêm tiếng Việt làm ngôn ngữ giao diện thứ 19. Các bản phát hành trước xem [🇬🇧 CHANGELOG.md](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md).

Bản dịch: [🇬🇧 English](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md) · [🇪🇸 Español](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.es.md) · [🇧🇷 Português](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.pt-BR.md) · [🇰🇷 한국어](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ko-KR.md) · [🇯🇵 日本語](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ja.md) · [🇷🇺 Русский](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ru.md) · [🇨🇳 简体中文](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.zh-CN.md) · [🇹🇼 繁體中文](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.zh-TW.md) · [🇫🇷 Français](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.fr.md) · [🇵🇱 Polski](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.pl.md) · [🇺🇦 Українська](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.uk.md) · [🇩🇰 Dansk](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.da.md) · [🇸🇦 العربية](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ar.md) · [🇩🇪 Deutsch](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.de.md) · [🇮🇹 Italiano](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.it.md) · [🇹🇷 Türkçe](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.tr.md) · [🇮🇳 हिन्दी](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.hi.md) · [🇱🇰 தமிழ்](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ta.md)

---

## [1.257.0] — 2026-10-25

**Hai-bản-sửa-của-đội-agent: trợ-lý-docs trong-ứng giờ hiểu chữ-Devanagari và-tiếng-Tamil, và-trang-usage cho-thấy Hermes thực-tế tốn-bao-nhiêu.**

### Đã sửa

- **Truy-hồi-của-trợ-lý-docs cho hi/ta (CAR-103)**: lớp-ký-tự-từ của-bộ-tokenizer-từ-khóa docs-assistant là `[\p{L}\p{N}\u30fc]+` — không-có-dấu-kết-hợp. Mỗi-matra-Devanagari (ा ै ्…) và-mỗi-dấu-nguyên-âm-Tamil (ே ை ்…) cắt-một-từ thành-các-mảnh; quy-tắc-độ-dài bỏ-các-mảnh-ngắn (một-truy-vấn-tiếng-Hindi khớp 0 mục) và-các-từ-dài-hơn bị-chặt-đầu thành-rác va-chạm với-các-mục-không-liên-quan. Lớp-ký-tự giờ giữ `\p{M}`; đường-bigram-CJK không-bị-động-đến. Truy-vấn-hi «मैं स्कैन कैसे चलाऊं?» và-ta «ஸ்கேன் எப்படி இயக்குவது?» truy-hồi đúng-các-mục từ-các-bundle-đóng-gói-sẵn.
- **Chi-phí-usage của-Hermes (CAR-106)**: `normalizeUsage()` gộp-usage-của-nhà-cung-cấp xuống `{in, out}` và-bỏ-lặng-lẽ trường-`cost` do-gateway-báo — `#/usage` hiện $0.0000 trên 9.5 M token Hermes (hàng-bảng-giá của-nó là 0/0). Hình-thạng-bản-ghi-usage có-thêm trường-tùy-chọn `cost?` tương-thích-ngược; bộ-tổng-hợp ưu-tiên chi-phí-do-nhà-cung-cấp-báo của-từng-bản-ghi và-chỉ-hạ-về-ước-tính-từ-bảng-giá khi-trường-vắng-mặt; các-giá-trị-rác/âm bị-bỏ, không-bao-giờ-bị-bịa.

### Ghi chú

- Cả-hai-bản-sửa đến-từ-đội-agent kèm-bằng-chứng-đỏ→xanh (3 + 5 case mới; 14/14 và-10/10 xanh; các-case-lân-cận 78/78 và-61/61). Các-PR-đầu (#470/#471) mang-một-base-worktree-lỗi-thời xung-đột với v1.256.0-vừa-được-squash-merge — bị-thay-thế bằng-các-cherry-pick-sạch (#472/#473).
- Cố-ý-không-làm: không-tính-lại-giá-hồi-cố cho-các-dòng-`data/llm-usage.jsonl` lịch-sử (chúng-không-mang-trường-chi-phí; chỉ-các-bản-ghi-mới được-hưởng).
- Kiểm-thử 5713 (+8: docs-assistant ×3, usage ×5). Không-chạm-nguồn-quét nào (registry 121 = 116 EN + 5 RU · 116 adapter); không-có-khóa-i18n nào.

## [1.256.0] — 2026-10-25

**Chất-lượng-dữ-liệu-tracker: vị-trí không-bao-giờ-được-ghi thành-công-ty, một-bảng-việc-làm không-bao-giờ-được-ghi thành-nhà-tuyển-dụng, các-dòng-không-có-điểm ngừng-nổi-lên-đầu — và-một-endpoint-một-lần-chạy backfill các-điểm-còn-thiếu từ-chính-các-báo-cáo.**

### Thêm mới

- **Backfill-điểm (CAR-129)**: `POST /api/tracker/backfill-scores` điền ô Score của-các-dòng mà-báo-cáo-liên-kết mang-một-điểm-parse-được (181 dòng-đã-đánh-giá có-báo-cáo nhưng-không-có-điểm). Các-dòng-đã-có-điểm, các-sentinel-tường-minh (`N/A`), các-dòng-không-có-báo-cáo và-các-báo-cáo-không-có-điểm không-bao-giờ-bị-động-đến; chỉ ô Score được-viết-lại, dưới-khóa-tệp; hình-thạng-điểm được-xác-thực ngay-tại-điểm-ghi và-chuẩn-hóa theo-quy-ước-`X.X/5` của-tracker; lượt-chạy là-idempotent và-trả-về `{ok, updated, missingReport, reportScoreless}`.

### Đã sửa

- **Vị-trí không-bao-giờ-là-công-ty (CAR-128)**: `guessCompanyRole` coi-bên-TRÁI của-một-dòng-tiêu-đề-có-dấu-gạch là-công-ty, nhưng-các-bảng viết-cả-hai-thứ-tự — "Senior Frontend Engineer - Grafana Labs" bị-ghi chức-danh THÀNH-công-ty (13 dòng: Grafana, CircleCI…). Một-heuristic-từ-khóa-chức-danh có-biên-từ giờ chọn-bên-chức-danh, và-một-loại-hình-việc-làm không-bao-giờ-trở-thành-nhà-tuyển-dụng ("Senior Engineer - Remote (EU)" không-ghi-gì-cả thay-vì-ghi "Remote (EU)").
- **Một-bảng-việc-làm không-bao-giờ-là-nhà-tuyển-dụng (CAR-127)**: bộ-dự-phòng-slug-tên-miền ghi-các-dòng-hh.ru là-"hh" (120 dòng). Các-slug-`hh`/`habr` gia-nhập danh-sách-không-phải-nhà-tuyển-dụng; suy-diễn-nhà-tuyển-dụng-giữa-câu ("в компании X", "X ищет") giờ cũng chạy cho-các-host-bảng-việc-làm (hh.ru/kz/uz/by, habr.com) — nơi-văn-bản-trang nêu-tên-nhà-tuyển-dụng-thật. Nguyên-nhân-gốc được-tìm-thấy trên-quá-trình: các-`\b`/`\w`-ASCII trong-các-mẫu-suy-diễn ấy chưa-bao-giờ khớp-chữ-Cyrillic — chết-lặng-lẽ từ-v1.248.4; lookbehind-Unicode và-các-lớp-`\p{L}` thay-thế chúng.
- **Các-dòng-không-có-điểm xếp-cuối (CAR-129)**: sắp-xếp-điểm của-tracker dùng-sentinel-`-1`, nên-với-sắp-xếp-tăng-dần-mặc-định mọi-dòng-không-có-điểm nổi-lên-trước mọi-dòng-có-điểm. Giá-trị-null giờ xếp-cuối ở-cả-hai-hướng (bộ-LỌC-điểm giữ-`-1` của-nó — "không-có-điểm trượt-một-bộ-lọc ≥4" là-ngữ-nghĩa-đúng ở-đó).

### Ghi chú

- Các-dòng-lịch-sử KHÔNG-được-di-cư bởi-bản-phát-hành-này: các-bản-sửa-parser áp-dụng cho-các-lượt-đánh-giá-mới; điểm có-thể-lấy-lại qua-endpoint-backfill, trong-khi 120-ô-nhà-tuyển-dụng-"hh" cần-đánh-giá-lại, chứ-không-phải-một-lần-viết-lại.
- Một-vòng-rà-soát-opus-5-5 được-gộp-vào: mẫu-"X ищет" không-có-mỏ-neo đã-bị-loại trước-khi-phát-hành (bất-kỳ-cụm-viết-hoa nào trước-động-từ đều-sẽ-bị-ghi là-nhà-tuyển-dụng — bất-biến-không-bịa), các-mỏ-neo-"В…"-đầu-câu được-thêm, và-bộ-viết-backfill kiểm-tra-lại-ô-đích (các-dòng-`#`-trùng tồn-tại sau-các-sửa-tay), giữ-nguyên-số-cột của-một-dòng-ngắn-bị-hỏng-bằng-tay, và-dừng ở-dòng-không-phải-bảng-đầu-tiên. Dấu-chấm bên-trong-một-tên-có-dấu-chấm ("Сбер. IT") không-thể-phân-biệt với-dấu-chấm-câu cho-mỏ-neo-"в компании" — tiền-tố-bảo-thủ ("Сбер") được-ghi; mẫu-neo-động-từ bắt-được-dạng-đầy-đủ.
- Cố-ý-không-làm: không-trích-bộ-so-sánh từ-`tracker.js` ra-một-lib-kiểm-thử-được (cổng-source-static giữ-nguyên; được-ghi trong-CAR-129 như-một-tiếp-nối), không-đổi-nulls-last cho-cột-commute (một-quirk-`Infinity`-khi-giảm-dần có-từ-trước), không-di-cư-dữ-liệu cho-các-dòng-"hh".
- Kiểm-thử 5705 (+10: 5-identity trong-`auto-pipeline-jd-gate`, 2 cho-CAR-128, cổng-sắp-xếp-CAR-129, 4-backfill kể-cả-việc-ghim-đường-dẫn-địch — trừ-các-case-v1.248.x-bị-thay-thế). Không-chạm-nguồn-quét nào (registry 121 = 116 EN + 5 RU · 116 adapter); không-có-khóa-i18n nào.

## [1.255.2] — 2026-10-24

**Ba-bản-sửa-hiện-thế-từ-rà-soát-trực-tiếp và-một-báo-cáo-sập-trên-máy-chủ-thật: sập-khi-render-#/scan, kiểm-tra-ngôn-ngữ-tiếng-Việt-mù, và-việc-mất-khối-tóm-tắt-zh-TW lặp-lại.**

### Đã sửa

- **Sập-#/scan (CAR-99)**: việc-tái-sinh-cổng-đếm từ-v1.253.0 đã-viết literal `FALLBACK_SOURCES` với-dấu-phẩy-kép-thừa ở-cuối-mỗi-mục — 120-lỗ-elision trong-mảng. `new Set(FALLBACK_SOURCES.map((s) => s.value))` trong-view-quét khi-đó giữ-`undefined`, và-`id.length` của-bộ-phân-loại-công-ty ném-`TypeError: Cannot read properties of undefined (reading 'length')` ở-mỗi-lượt-render-trang (logbuf bắt-được trên-máy-chủ-thật). Các-lỗ đã-được-loại-bỏ, và-một-cổng-mới (4-spec, xác-minh-bằng-đỏ) chạy-file và-trượt ở-bất-kỳ-lỗ nào, mục-không-dùng-được nào, hay-`undefined` nào trong-Set-id-adapter — cổng-phát-hiện-lệch chỉ-đọc-văn-bản không-thể-thấy-lớp-này.
- **Kiểm-tra-ngôn-ngữ-vi-mù (CAR-97)**: tiếng-Việt là-chữ-Latin và-không-có-mục trong-bảng-stop-word của-QA-trực-tiếp, nên-"vi stop words" đếm-các-trúng-tiếng-Anh và-một-câu-trả-lời-tiếng-Việt bị-đọc là-`report not in vi` (rà-soát-trực-tiếp: vi 2, en 2). Tiếng-Việt giờ có-bảng-chức-từ mười-từ riêng-của-mình — một-báo-cáo-thuần-vi đỗ, một-báo-cáo-tiếng-Anh vẫn-trượt.
- **zh-TW mất-khối-SCORE_SUMMARY (CAR-98)**: lời-nhắc-ngôn-ngữ-kết chỉ-nói định-dạng-máy không-được-dịch, chưa-bao-giờ nói khối-tóm-tắt phải-tồn-tại — một-báo-cáo-zh-TW ngắn (5,983 ký-tự) mang-các-khối-A–G nhưng-bỏ-hẳn-khối-tóm-tắt (một-sự-lặp-lại-cùng-loại-v1.239.2). Chỉ-đạo-mở-đầu và-lời-nhắc-kết giờ khẳng-định khối là-bắt-buộc và-báo-cáo-thiếu-nó là-không-hợp-lệ.

### Ghi chú

- Bản-phát-hành-này cố-ý không-đổi bất-kỳ-nguồn-quét nào, con-số-registry (121 = 116 EN + 5 RU · 116 adapter), hay-cách-nối-provider — chỉ-là-bản-sửa, nên-các-cổng-đếm nguyên-vẹn.
- Kiểm-thử 5695 (+9: `car99-fallback-holes` ×4, `car97-vi-lang-check` ×4, bất-biến-prompt-CAR-98 ×1). Trình-duyệt 143/143. Lượt-kiểm-tra-trực-tiếp-lại vi/zh-TW đi-cùng-rà-soát-sau-triển-khai.

## [1.255.1] — 2026-10-24

**Hai-vòng-sửa-sau-rà-soát: vòng-rà-soát-Opus cho-locale-tiếng-Việt (9 phát-hiện) và vòng-rà-soát-lần-hai các-bản-sửa CAR-91/92 (5 bản-sửa-bắt-buộc) — cả-hai được-đóng lại với-các-test-đỏ→xanh.**

### Đã sửa

- **Vòng-rà-soát-locale-vi (tiếp-nối CAR-88)**: chữ-glyph-Hangul (`신`) rò-vào `project.subtitle` / `project.roleHint` đã-được-sửa lại (`độ khớp tín hiệu`), kèm-một-cổng trượt khi-bất-kỳ-glyph-CJK/Kana nào xuất-hiện trong một-giá-trị-vi mà từ-điển-EN không mang; sáu-URL-markdown-có-khoảng-trắng trong docs/help/vi.md (`what-is career-ops`, `apply for a job`, `set up playwright` cùng-ba-mục-khác) được-gạch-nối về đúng-các-slug-hướng-dẫn-thực, kèm-cổng-cấm-khoảng-trắng-trong-URL.
- **Ranh-giới-tiêu-đề-đánh-giá (CAR-92 r2 H1)**: `&`, `.`, `/`, `'` giờ là ký-tự-từ trong biên-trái của-chữ-khối — `## Q&A`, `## Plan B`, `## Ph.D. requirement`, `## E-commerce` không-còn-được-đăng-ký thành khối A/B/D/E; ký-tự-kết-thúc-cuối-dòng-thuần chỉ-được-chấp-nhận sau-một-token-từ-khối (Block/блок/블록/…); ASCII `-` đã-rời các-lớp-ký-tự-kết-thúc-viết-chữ nên các-tiêu-đề `E-commerce`/`ई-मेल` sống-sót.
- **Báo-cáo-đánh-số-Ukraina/Nga (CAR-92 r2 H2)**: bộ-dò-dãy А Б В Г Д Є Ж giờ là một-helper-dùng-chung; khi tìm-thấy 3+ chữ-cái-của-dãy tại-một-mức-tiêu-đề, mức-đó trở-thành mức-tham-chiếu của-bộ-cắt — các-mục-con `### A.` có-chữ-cái không-còn-cắt-ngắn báo-cáo tại-khối Б.
- **Vòng-đời-dòng-chuyển-tiếp (CAR-92 r2 M1)**: các-dòng mà một-nguồn-thất-bại chuyển-tiếp sang-lượt-quét-kế được-đóng-dấu `carriedSince`, bị-loại sau 30 ngày hay 5 lần-chuyển-tiếp-liên-tục, và được-nối vào sau-các-dòng-mới thay-vì tích-tụy-lặng-lẽ mãi-mãi.
- **Mẫu-số-của-gemini-synthesis + legitimacy (CAR-92 r2 M2) và đường-điểm-phần-thân-của-tiến-trình-con (M3)**: đọc từ tệp-ghi-phát-hiện, sửa với-các-test-đỏ.
- **Cổng-phát-hiện-lệch-bundle-tải-lạnh** cập-nhật cho từ-điển-vi (90 thẻ-script / 87 có-thể-bundle) và loại-bỏ-biến-gán-test-không-dùng của nó (CodeQL 572).

### Ghi chú

- Cách-diễn-đạt-số-adapter trong banner "Mới-nhất" của README.vi mà-rà-soát-chỉ-ra nằm trong banner **Bản-trước** và hiện-đã-ánh-xạ README-EN byte-for-byte — để-nguyên-tiêu để-giữ-đối-xứng EN↔vi (đã-ghi trong thân-commit).
- Kiểm-thử 5686 (+26: `eval-validate-opus-r2`, `scanner-carryover-r2`, các-assertion cổng-vi). Registry không-đổi ở mức **121 nguồn (116 EN + 5 RU) · 116 adapter**.

## [1.255.0] — 2026-10-24

**Tiếng Việt gia-nhập làm ngôn-ngữ-giao-diện thứ 19 — từ-điển 1525 khóa đối-xứng hoàn-toàn với EN, nhận-diện vi/vi-VN, trọn gói trợ-giúp, bản-phản-ánh README và CHANGELOG, tích-hợp landing cvstart.org, và lá 🇻🇳 trên bộ-chọn-ngôn-ngữ.**

### Thêm mới

- **Tiếng Việt (`vi`) — 1525/1525 khóa** đối-xứng hoàn-toàn với `en`; `detect()` chấp-nhận `vi` và `vi-VN`; tiếng Việt là LTR (không-bao-giờ thêm vào `RTL_LANGS`). 'Pipeline' vẫn-là 'Pipeline' — từ-mượn-kỹ-thuật-chuẩn, nằm trong danh-sách-trắng.
- **Đầy-đủ docs/help/vi.md** (33 H2 / 125 H3), cộng với bản-phản-ánh README.vi.md và CHANGELOG.vi.md, và các-chuỗi-khung tiếng Việt trong `prompts.mjs` (`LOCALE_NAMES` + `SCAFFOLD_STRINGS`) — đầu-ra LLM tiếng Việt chạy-ngay-từ-hộp.
- **Landing cvstart.org bằng tiếng Việt** — `site/src/i18n/vi.json`, mục-locale trong sitemap và ảnh-chụp `dashboard-vi.png`; bộ-chọn-ngôn-ngữ có-thêm 🇻🇳 (19 vị-trí).
- **Các-cổng-liệt-kê 18 → 19** — LANGS, thăm-dò detect, kiểm-toán i18n, đối-xứng changelog, khối-bản-dịch README, quét-locale — cùng `tests/i18n-vi-locale.test.mjs` đỏ-trước (139 dòng).

### Ghi chú

- Landing cvstart.org nhận-thêm vi — một-lệch-chủ-đích so-với tiền-lệ ta (bản-phát-hành-ấy cố-ý giữ landing ở mức 17); đã-ghi trong đặc-tả-phát-hành.
- vi là chữ-Latin nên cổng no-latin-leaks không-áp-dụng (nó canh các-locale không-Latin); từ-vựng-kỹ-thuật-Latin là-chuẩn-tắc.
- Sàn-kiểm-thử: 5634 → **5642** (1 bị-bỏ-qua = test-trình-duyệt-bắt-ảnh-layout tùy-chọn, không-đổi).

## [1.254.0] — 2026-10-24

**Một bản phát hành gia-cố từ vòng rà-soát mô-hình-tối: ảnh-chụp-scanner không bao giờ mất dòng nữa, mười-một vi-phạm-bất-biến ở-tầng-LLM được sửa, hai-mươi-ba bản-sửa-bắt-buộc-SPA đổ-bộ, và ATS Paylocity gia-nhập-máy-quét — registry giờ cung cấp 121 nguồn (116 EN + 5 RU) với 116 adapter.**

### Thêm mới

- **Paylocity ATS** (parent #5687): các bảng `recruiting.paylocity.com` theo-tenant, bảng-chết 302 → JobNotFound được ánh-xạ-thành-404 nên cách-lý cho-nghỉ-mục-đó, cap `max_jobs` kèm-cờ-báo-cắt-ngắn, định-hình-dòng-an-toàn-ISO-4217. Registry: **121 nguồn = 116 EN + 5 RU · 116 adapter**; các-cổng-đếm được-tạo-lại.

### Đã sửa

- **An-toàn-ảnh-chụp-scanner (R-12)**: một-lượt-quét-không-thử-gì-cả giờ **GIỮ** ảnh-chụp-đã-lưu (`nothing scanned`) thay vì quét-sạch nó; một-lượt-thay-thế-toàn-phần chuyển-tiếp các-dòng-cũ-của-các-nguồn-thất-bại — đóng-dấu-theo-từng-mục nên một-"Lever"-thất-bại không còn-giữ-các-dòng-nguồn-lever-của-công-ty-khác — chạy-lại qua các-bộ-lọc-HIỆN-TẠI, chỉ-hạ-cánh ở `filtered` (một-việc-đã-ứng-tuyển không bao giờ-tái-xuất-như-là-mới).
- **Mười-một-bất-biến-ở-tầng-LLM**: chỉ-dịnh-ngôn-ngữ giờ vừa-mở-vừa-đóng các-prompt-deep/mode; tiến-trình-con-Gemini chuyển-tiếp `--lang`, thoát-khác-không→502, ngừng-rò-stderr, tuân-thu-timeout-300 s và-ghi-usage; dự-phòng-thủ-công-của-auto-pipeline mang-theo-URL-tin-đăng; cảnh-báo-cắt-ngắn và-bundle lộ-ra trong-`/api/mode`; mức-chi-tiền không-còn-bị-client-ghi-đè; ngắt-kết-nối-client hủy-lời-gọi-nhà-cung-cấp-đang-bay (signal xuyên-qua-mọi-nhà-cung-cấp); bộ-cắt-tiêu-đề-lặp không-còn-phá-hủy-các-báo-cáo-hợp-lệ; bộ-trích-điểm và-độ-chính-đáng đồng-bộ-với-bộ-kiểm-thử; dãy-Ukraina và false-accept-"wa"-tiếng-Ả-Rập được-siết-chặt.
- **Một-vòng-rà-soát Opus 5-5 TRÊN chính-các-bản-sửa** (8 bản-sửa-bắt-buộc) cũng-đổ-bộ: đăng-ký-nhiều-chữ-cái-của-bộ-cắt-tiêu-đề (một-tiêu-đề có-thể-đăng-ký-một-chữ-trong-chính-cửa-sổ-của-nó — `## G) Interview Q&A` cắt-tại-G), các-ký-tự-kết-thúc-tiêu-đề-rộng-hơn (`**Block A** —`, `[A]`, fullwidth/`、`/CRLF), dây-nối-abort-của-tiến-trình-con-Gemini, quy-attribution-chuyển-tiếp-đóng-dấu-theo-mục, các-dòng-chuyển-tiếp-chạy-lại-bộ-lọc-hiện-tại, và-mức-tiêu-đề-tham-chiếu giờ-đếm-các-chữ-khác-nhau.
- **Hai-mươi-ba-bản-sửa-bắt-buộc-SPA** rải-qua-các-view-tìm-nguồn (append-pager-một-trang, xử-lý-bàn-phím-dòng-pipeline, khôi-phục-bộ-lọc-truy-vấn-đã-lưu, đặt-lại-select-nguồn, hoàn-về-mặc-định-config, rò-rỉ-listener, SSE-đóng-khi-kết-thúc, dọn-dẹp-scan-runner, một-lần-fetch-trần, tải-lỗi-trông-như-rỗng, va-chạm-window, giữ-focus) và các-view-hỗ-trợ (deep-link-help-chết, rò-rỉ-listener-help, tái-kích-hoạt-ghi-đè-trắng-hai-trang, single-flight-chạy-trả-phí-batch/deep/mode, luồng-kết-thúc-im-lặng, các-đường-lỗi-spinner-mãi-mãi, các-dòng-ma-bộ-lọc-thất-bại, trùng-docs-fab + ngôn-ngữ).

### Ghi chú

- Toàn-bộ-vòng được Opus 5-5 rà-soát ở-mức-nghiêm-ngặt-tối-đa — các-port trước-khi-merge (21 phát-hiện, 13 đã-sửa) và chính-các-bản-sửa sau-đó (8 bản-sửa-bắt-buộc, tất-cả-đổ-bộ-ở-đây với-các-test-đỏ→xanh).
- Sàn-kiểm-thử: 5262 → **5634** (372 spec mới trải-qua-nguồn, máy-quét, tầng-LLM và SPA).
- Chuyển-tiếp-R-12-của-scanner KHÔNG-hồi-sinh-các-tin-đã-ứng-tuyển hay-đã-bỏ (các-dòng-chuyển-tiếp-chạy-lại-bộ-lọc-hiện-tại), và năm-nguồn-RU vẫn-không-có-adapter-thượng-nguồn — chỉ-có-web-ui theo-thiết-kế.
