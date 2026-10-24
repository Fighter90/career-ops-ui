# Nhật ký thay đổi (Tiếng Việt)

> Nhật ký này bắt đầu từ v1.254.0 — bản phát hành thêm tiếng Việt làm ngôn ngữ giao diện thứ 19. Các bản phát hành trước xem [🇬🇧 CHANGELOG.md](CHANGELOG.md).

Bản dịch: [🇬🇧 English](CHANGELOG.md) · [🇪🇸 Español](CHANGELOG.es.md) · [🇧🇷 Português](CHANGELOG.pt-BR.md) · [🇰🇷 한국어](CHANGELOG.ko-KR.md) · [🇯🇵 日本語](CHANGELOG.ja.md) · [🇷🇺 Русский](CHANGELOG.ru.md) · [🇨🇳 简体中文](CHANGELOG.zh-CN.md) · [🇹🇼 繁體中文](CHANGELOG.zh-TW.md) · [🇫🇷 Français](CHANGELOG.fr.md) · [🇵🇱 Polski](CHANGELOG.pl.md) · [🇺🇦 Українська](CHANGELOG.uk.md) · [🇩🇰 Dansk](CHANGELOG.da.md) · [🇸🇦 العربية](CHANGELOG.ar.md) · [🇩🇪 Deutsch](CHANGELOG.de.md) · [🇮🇹 Italiano](CHANGELOG.it.md) · [🇹🇷 Türkçe](CHANGELOG.tr.md) · [🇮🇳 हिन्दी](CHANGELOG.hi.md) · [🇱🇰 தமிழ்](CHANGELOG.ta.md)

---

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
