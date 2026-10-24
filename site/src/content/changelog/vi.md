# Nhật ký thay đổi (Tiếng Việt)

> Nhật ký này bắt đầu từ v1.254.0 — bản phát hành thêm tiếng Việt làm ngôn ngữ giao diện thứ 19. Các bản phát hành trước xem [🇬🇧 CHANGELOG.md](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md).

Bản dịch: [🇬🇧 English](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md) · [🇪🇸 Español](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.es.md) · [🇧🇷 Português](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.pt-BR.md) · [🇰🇷 한국어](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ko-KR.md) · [🇯🇵 日本語](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ja.md) · [🇷🇺 Русский](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ru.md) · [🇨🇳 简体中文](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.zh-CN.md) · [🇹🇼 繁體中文](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.zh-TW.md) · [🇫🇷 Français](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.fr.md) · [🇵🇱 Polski](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.pl.md) · [🇺🇦 Українська](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.uk.md) · [🇩🇰 Dansk](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.da.md) · [🇸🇦 العربية](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ar.md) · [🇩🇪 Deutsch](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.de.md) · [🇮🇹 Italiano](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.it.md) · [🇹🇷 Türkçe](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.tr.md) · [🇮🇳 हिन्दी](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.hi.md) · [🇱🇰 தமிழ்](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ta.md)

---

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
