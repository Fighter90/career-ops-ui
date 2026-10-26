# Nhật ký thay đổi (Tiếng Việt)

> Nhật ký này bắt đầu từ v1.254.0 — bản phát hành thêm tiếng Việt làm ngôn ngữ giao diện thứ 19. Các bản phát hành trước xem [🇬🇧 CHANGELOG.md](CHANGELOG.md).

Bản dịch: [🇬🇧 English](CHANGELOG.md) · [🇪🇸 Español](CHANGELOG.es.md) · [🇧🇷 Português](CHANGELOG.pt-BR.md) · [🇰🇷 한국어](CHANGELOG.ko-KR.md) · [🇯🇵 日本語](CHANGELOG.ja.md) · [🇷🇺 Русский](CHANGELOG.ru.md) · [🇨🇳 简体中文](CHANGELOG.zh-CN.md) · [🇹🇼 繁體中文](CHANGELOG.zh-TW.md) · [🇫🇷 Français](CHANGELOG.fr.md) · [🇵🇱 Polski](CHANGELOG.pl.md) · [🇺🇦 Українська](CHANGELOG.uk.md) · [🇩🇰 Dansk](CHANGELOG.da.md) · [🇸🇦 العربية](CHANGELOG.ar.md) · [🇩🇪 Deutsch](CHANGELOG.de.md) · [🇮🇹 Italiano](CHANGELOG.it.md) · [🇹🇷 Türkçe](CHANGELOG.tr.md) · [🇮🇳 हिन्दी](CHANGELOG.hi.md) · [🇱🇰 தமிழ்](CHANGELOG.ta.md)

---

## [1.260.0] — 2026-10-26

**Đợt-gia-cố-sau-rà-soát, tám-lượt-merge (#491–#498) từ-các-vòng-rà-soát-opus-5-5 và-rà-soát-AI trên-đội-agent-v1.259.0: chuẩn-hóa-lương, giới-hạn-phạm-vi-ngày-báo-cáo, độ-bền-geocode, bust-cache-bundle r2+r3, bản-sửa-tràn-#/deep — cùng-hai-lượt-UI-v2 (pipeline, reports). Mọi-bản-sửa đều-đổ-bộ qua-một-fix-forward-đỏ→xanh.**

### Đã sửa

- **Chuẩn-hóa-lượt-so-sánh-lương (CAR-143 rev-2)**: các-dấu-chu-kỳ chỉ-được-nhận-diện khi-đứng-sát-con-số mà-chúng-thuộc-về — «6 month contract, $120k» không-còn-bị-nhân-×12-quy-năm, và-các-dạng-chu-kỳ-chỉ-gắn-sát của-RU/ES («за месяц» đứng-cạnh-con-số) thắng-mọi-từ-đi-ngang-không-liên-quan; họ-ký-hiệu `$`/`¥` được-nhận-diện nhưng không-được-ánh-xạ trừ-khi-một-mã-ISO-tường-minh cùng-đứng-trên-dòng (đô-la AUD/CA/SG không-còn-bị-tính-thành-USD, dạng-¥-RMB nhận-một-lưu-ý-tường-minh thay-vì-một-lượt-đổi-JPY-lệch-tới-hơn-20×); các-con-số-trần 19xx/20xx luôn-là-năm; các-con-số-trong-khoảng thừa-hưởng-chu-kỳ-của-vế-kia; `minimum` và `target_range` của-profile không-bao-giờ-được-nối-thành-một-khoảng.
- **Giới-hạn-phạm-vi-của-`fixReportDate` (CAR-144 rev-2)**: lượt-sửa-ngày-ghim-phía-server chỉ-áp-dụng cho-phần-mở-đầu trước-tiêu-đề-`## `-đầu-tiên (một-báo-cáo mở-đầu-ngay-bằng-tiêu-đề-H2 nhận-no-op-bảo-thủ — ngày-cũ chấp-nhận-được, ngày-bịa thì-không); trong-phần-mở-đầu: một-ứng-viên-duy-nhất được-sửa, nếu-không-thì-một-`**Date:**`-in-đậm-duy-nhất, nếu-không-thì-không-sửa-gì-cả (hai-ứng-viên-in-đậm hoặc-hai-ứng-viên-trần viết-lại-không-cái nào). Cổng-nhãn-PDF của-FIX-5 giờ đọc-bộ-từ-điển-lắp-ráp-thật — một-locale-thiếu ném-lỗi thay-vì-lặng-lẽ-đỗ trên-fallback-tiếng-Anh.
- **Chip-vị-trí-Habr + độ-bền-geocode (CAR-142 rev-2)**: một-chip-meta-Habr chỉ-trở-thành-một-thành-phố khi-có-bằng-chứng-cấu-trúc (một-liên-kết-bộ-lọc-thành-phố hoặc-một-biểu-tượng-vị-trí) — thông-báo-chuyển-địa («Возможна релокация») và-các-loại-hình-việc-làm không-bao-giờ-giả-mạo-thành-vị-trí; cache-geocode giờ sống-sót qua-lần-khởi-động-lại (flush tại `beforeExit`/`exit`/SIGTERM+SIGINT kèm-gửi-lại-tín-hiệu, cờ-dirty chỉ-được-xóa sau-khi-lượt-ghi-hoàn-tất), tắt-máy-có-giới-hạn (chốt-vòng-thoát, bộ-đếm-thế-hệ, LRU-theo-mức-mới), và-một-ngân-sách-geocode-đã-cạn trả-lời 503 + Retry-After thay-vì-502-chung-chung.
- **Bust-cache-bundle (CAR-145 r2+r3)**: shell-trang dẫn `/js/bundle.js?v=<content-hash>` — bất-biến-khi-khớp, no-store-khi-lệch — giết-cửa-sổ-5-phút của-lượt-triển-khai, nơi-một-shell-mới đi-cặp-với-một-bundle-cũ-được-cache. Hash và-luồng-đọc dùng-chung-một-bộ-mô-tả-tệp (không-có-lượt-đọc-bị-vỡ-nửa-giữa); một-lượt-đọc-ngắn trả-lời null thay-vì-một-hash-dự-phòng-từ-stat mà-có-thể-đầu-độc-cả-một-lượt-triển-khai; `make-bundle` viết-identity cùng-các-bản-đồng-hành-.br/.gz qua-một-tệp-tạm-đầu-chấm + rename, nên-một-build-bị-giết không-thể-phục-vụ-byte-viết-dở cũng-như-không-thể-rò-tệp-tạm của-nó.
- **Tràn-#/deep (CAR-146)**: một-bản-tóm-tắt-nghiên-cứu-sâu-đã-lưu mà-chỉ-riêng-tên-tệp đã-vượt-khung-hình-điện-thoại không-còn-đẩy-`#/deep` vượt-390px — thẻ-chặn-tại-dòng-của-nó, tiêu-đề-xuống-dòng, ngày-giữ-một-dòng; lượt-quét-khung-hình-hẹp giờ đi-qua-`#/deep` với-một-fixture-quá-dài-được-gieo-sẵn (phát-hiện-duy-nhất của-hai-lượt-chạy-remote-QA, đã-đóng).
- **Gia-cố-Pipeline-v2 (CAR-116 review)**: xóa-có-xác-nhận và-hoàn-tác-được (kèm-lời-văn-hoàn-tác-trung-thực), không-bịa-nhà-tuyển-dụng trong-các-thẻ, id-dòng-FNV-1a, số-đếm-hàng-loạt-thật, và-một-chốt-chống-tái-vào trên-các-thao-tác-hàng-loạt.

### Thêm mới

- **Pipeline v2 (CAR-116)**: các-thẻ-phong-phú-hơn, một-view-nhóm, và-loại-bỏ-hàng-loạt-kèm-hoàn-tác; 17-khóa-`pipe.*`-mới đổ-bộ-kèm-bản-dịch-sẵn trên-cả-19-bộ-từ-điển.
- **Reports v2 (CAR-118)**: tìm-kiếm-trực-tiếp với-các-bộ-lọc-dải-điểm/tính-hợp-lệ/công-ty/ngày, các-header-sắp-xếp-được (`aria-sort`), một-view-thẻ-lưu-được-trạng-thái với-các-nút-hành-động-theo-dải, một-biểu-đồ-điểm-bấm-để-lọc, và-lượt-render-thống-nhất «Company — Role» / «x.x/5» (`window.ReportOps`); 31-khóa-`rep2.*`-mới đổ-bộ-kèm-bản-dịch-sẵn trên-cả-19-bộ-từ-điển.

### Ghi chú

- Mọi-bản-sửa đến-qua-một-vòng-rà-soát kèm-bằng-chứng-đỏ→xanh; hai-phát-hiện-HIGH của-rà-soát-AI trên-r2-bundle-đầu-tiên (hash-đọc-ngắn, tính-nguyên-tử-các-bản-đồng-hành) được-đóng bởi-r3, và-các-vòng-CAR-143/CAR-144/CAR-142 mỗi-vòng đều-tái-xác-minh-các-phát-hiện-còn-mở của-vòng-tiền-nhiệm.
- Cố-ý-không-làm: view-cụm-bản-đồ vẫn-ở-CAR-125 (đang-xếp-hàng); khôi-phục-metadata-pipeline-phía-server là-một-ticket-riêng; không-bản-sửa-hồi-cố nào cho-nội-dung-đã-lưu dưới-các-trạng-thái-v1.259.0-trước-rev-2.
- Kiểm-thử 5988 (+165). Trình-duyệt 152 đỗ / 0 trượt / 1 bỏ-qua-tùy-chọn. Không-chạm-nguồn-quét nào (registry 121 = 116 EN + 5 RU · 116 adapter); 48-khóa-i18n-mới đổ-bộ cùng-lượt-fan-out-×19 của-chúng ngay-trong-chính-các-PR-tính-năng.

## [1.259.0] — 2026-10-25

**Đợt-phát-hành-thứ-hai-của-đội-agent, sáu-bản-sửa: ngày-báo-cáo được-ghim-phía-server, geocoder-bản-đồ cache và-đọc-các-thành-phố-RU, help ×18 trích-các-nhãn-nút-bút-đã-bản-dịch-hóa, các-câu-UI ngừng-trộn-ngôn-ngữ, các-lượt-so-sánh-lương được-tính-phía-server — và-bundle-JS được-phát-hành-sẵn-nén (tải-lạnh 3.1 MB → 598 KB).**

### Đã sửa

- **Ngày-báo-cáo-bịa (CAR-101)**: prompt-đánh-giá giờ ghim-ngày-hôm-nay-phía-server ("trường **Date:** PHẢI chính-xác là <date> — chép-nguyên-văn; không-bao-giờ-bịa"), và `fixReportDate` viết-lại-một-ngày-lệch thành-hôm-nay tại-mọi-điểm-chấp-nhận (nhánh-Anthropic, tiến-trình-con-Gemini, phần-đuôi-tương-thích-OpenAI, /api/deep, auto-pipeline) kèm-một-cảnh-báo + bản-ghi-hoạt-động — một-lượt-sửa-chữa, không-bao-giờ-là-một-lượt-từ-chối. 349/789 báo-cáo-trên-máy-chủ-thật mang-ngày-bịa; các-báo-cáo-mới không-thể-nữa.
- **Geocoding-bản-đồ (CAR-105)**: các-chuỗi-thành-phố-Cyrillic của-các-dòng hh.ru/Habr giờ đến-được-bộ-geocoder; một-cache-có-giới-hạn-bền-vững (`data/geocode-cache.json`, withFileLock) nghĩa-là một-thành-phố-đã-giải-tỏa không-bao-giờ gọi-nhà-cung-cấp-lần-hai; các-lời-gọi-geocode được-phân-bổ-ngân-sách-theo-mỗi-yêu-cầu để-bản-đồ lấp-đầy-từng-bước thay-vì-chặn-13.9 s.
- **UI-trộn-ngôn-ngữ (CAR-108)**: 23-rò-rỉ-theo-khóa được-sửa trên-17-trong-19-bộ-từ-điển (85-giá-trị) — «все matching», «только remote», «Открыть Scan», phễu-«Evaluated → Applied…» và-nhiều-hơn-nữa trở-thành-các-câu-đầy-đủ-đã-bản-dịch-hóa tái-sử-dụng-từ-vựng-sản-phẩm riêng-của-mỗi-locale. `i18n-no-latin-leaks` được-mở-rộng với-bảng-mảnh + probe-phễu (đỏ→xanh).
- **Lật-phán-quyết-tiền-tệ (CAR-109)**: lượt-so-sánh-lương được-tính-phía-server trong `comp-compare.mjs` và-nhúng-theo-một-dạng-quy-chuẩn (`Candidate minimum: … per YEAR (raw: …)` so-với `JD offer: …`); dạng-hàng-tháng ×12, k/к/тыс/萬 và-dạng-dấu-phẩy-thập-phân được-chuẩn-hóa trước-khi-so-sánh; một-lượt-chuyển-đổi-không-chắc-chắn không-bao-giờ một-mình lật-phán-quyết (case-zh-TW «€80–100k ниже минимума» đã-chết). Mô-hình không-bao-giờ-tự-nhân.
- **Nhãn-nút-bút help ×18 (CAR-107)**: các-bundle-help-đã-bản-dịch-hóa trích-các-nhãn-tiếng-Anh («⚡ Run live», «Save», «Scan now») mà-UI không-còn-hiển-thị — 263-lượt-thay-thế trên-18-locale được-ánh-xạ từ-mã-nguồn-các-view; trợ-lý-docs thừa-hưởng-bản-sửa-này.

### Thêm mới

- **Bundle-sẵn-nén + tải-lạnh-cache-được (CAR-104)**: `make-bundle.mjs` phát-sinh `bundle.js.br` (brotli q11) + `.gz` vào-lúc-phát-hành; một-middleware-phạm-vi-bundle đàm-phán br > gz với `Vary: Accept-Encoding`, `public, max-age=300, must-revalidate` + ETag/304; được-bảo-vệ-theo-độ-tươi (một-bản-đồng-hành không-bao-giờ phục-vụ thứ-cũ-hơn-bundle-identity), các-lượt-lấy-artifact-trực-tiếp trả-về-404, CSP-giống-hệt-byte. Tải-lạnh: 3.1 MB → ~0.6 MB trên-đường-truyền (−80%); các-lượt-ghé-thăm-lặp-lại trong-5-phút truyền ≈0 bytes.

### Ghi chú

- Tất-cả-các-bản-sửa đến-từ-đội-agent kèm-bằng-chứng-đỏ→xanh (13 + 28 + 1 + 30 + 7 case-mới trên-các-suite-của-chúng) và-được-rà-soát-làm-tròn (CodeQL #579/#580/#584 được-sửa trong-code — các-stub-URL được-parse qua `new URL().host`, một-chuỗi-prompt-chết đã-bị-loại-bỏ).
- Các-con-số-backfill-điểm của-v1.258.0 giờ được-ghi trong-CAR-129 (`updated: 22`, `reportScoreless: 159`).
- Cố-ý-không-làm: không-sửa-ngày-hồi-cố cho-349-báo-cáo-lịch-sử (một-backfill sẽ-là-thao-tác-được-chủ-sở-hữu-chấp-thuận), không-view-cụm-trên-bản-đồ (CAR-125 vẫn-xếp-hàng-phía-sau-bản-sửa-geocode này).
- Kiểm-thử 5823 (+74). Không-chạm-nguồn-quét nào (registry 121 = 116 EN + 5 RU · 116 adapter); không-có-khóa-i18n nào (CAR-108 chỉ-sửa-giá-trị-của-các-khóa-hiện-có).

## [1.258.0] — 2026-10-25

**Sáu-bản-sửa-của-đội-agent trong-một-đợt-phát-hành: bộ-đếm-công-ty của-#/scan ngừng-trộn-hai-vũ-trụ, nghiên-cứu-sâu đòi-buộc-nguồn-dẫn, lỗi-biểu-mẫu làm-sáng-cá-trường, các-trạng-thái-tải nhận-skeleton và-h1-tức-thời, và-các-lượt-đánh-giá cache phần-tiền-tố-prompt 37k-token của-chúng.**

### Đã sửa

- **Bộ-đếm-«Công ty đang hoạt động» của-#/scan (CAR-100)**: tử-số đếm-các-công-ty-phân-biệt trên-TẤT-CẢ-các-dòng-kết-quả (1554 trên-máy-chủ-thật — riêng-hh.ru đã-đóng-góp-hàng-trăm) trong-khi-mẫu-số đếm-các-công-ty-tracked-có-hỗ-trợ-API (~90) — hai-vũ-trụ trong-một-phân-số. Phương-án-ghép-cặp-(a): tử-số giờ đếm-các-công-ty trong-các-dòng mà-lượt-quét-tracked-có-hỗ-trợ-API tự-nó đã-lấy-về (khớp bằng `_entry ?? company`; các-dòng-nhà-tuyển-dụng hh.ru/telegram rơi-ra ngoài); bộ-dự-phòng-trước-quét được-chuyển vào cùng-vũ-trụ (nó có-thể-hiện «104/90»).
- **Bịa-đặt trong-nghiên-cứu-sâu (CAR-110)**: prompt-deep giờ mang-một-hợp-đồng-ràng-buộc-cứng — mọi-kiến-định-sự-thật kết-thúc bằng `[source: domain.com]` (không-nêu-được-tên → không-nói-ra; bịa-một-marker còn-tệ hơn-viết "unknown"), các-sự-thật không-rõ được-viết `unknown`, và-báo-cáo BẮT-BUỘC kết-thúc bằng-một-mục `## Data freshness`. Các-mỏ-neo-độ-mới: ngày-UTC-hôm-nay + một-trường-`url`-của-công-ty-tùy-chọn trên `POST /api/deep` (có-giới-hạn, không-bao-giờ được-lấy-về-phía-server).
- **Lỗi-biểu-mẫu làm-sáng-cá-trường (CAR-130)**: một-POST-thất-bại đánh-dấu trường-biểu-mẫu-đầu-tiên `aria-invalid` + `.is-error` và-tập-trung vào-nó (WCAG 3.3.1); xóa-đi-khi-chỉnh-sửa. Gợi-ý-lỗi-mạng nhận-biết-hình-thức-triển-khai — loopback giữ-gợi-ý-lệnh-dev, một-origin-đã-triển-khai nhận-«Máy chủ không phản hồi» thay-vì-lời-khuyên `bash web-ui/bin/start.md` (banner-kết-nối cũng-mang-cùng-lời-khuyên-ghim-cứng ấy).
- **Các-trạng-thái-tải (CAR-112)**: #/map và-#/tracker render-h1 của-chúng ngay-lập-tức (đích-tập-trung-của-router chỉ-tồn-tại sau-khi-dữ-liệu-đến) và-một-helper-skeleton-dùng-chung (`Skeleton.rows`, các-hàng-shimmer-aria-hidden bên-trong-một-vùng-`role="status"` tái-sử-dụng `common.loading`) thay-thế văn-bản-«Đang tải…»-trần-trụi trên-tracker, kết-quả-quét và-khung-map; `prefers-reduced-motion` dừng-hiệu-nhấp-nháy.
- **Cache-prompt-của-trang-đánh-giá (CAR-111)**: `buildEvaluationPromptParts` tách prompt ~37k-token thành-một-phần-tiền-tố-bền-byte (CV + profile + các-tệp-mode + hướng-dẫn) và-phần-đuôi-JD; đường-Anthropic gửi `[prefix + cache_control: ephemeral] + [JD]` — phần-tiền-tố được-tính-tiền theo-mức-giá-đọc-cache (rẻ hơn ≈10×) ở-mọi-lời-gọi sau-lời-gọi-đầu-tiên. Phần-tiền-tố-thiếu/không-khớp fail-open về-yêu-cầu-cũ-giống-hệt-byte; cascade-tương-thích-OpenAI không-bị-động-đến (caching-phía-server ở-đó).

### Ghi chú

- Cả-sáu-bản-sửa đến-từ-đội-agent kèm-bằng-chứng-đỏ→xanh (5 + 7 + 7 + 7 + 8 case-mới) và-các-vòng-rà-soát; các-cảnh-báo-CodeQL-đầu-tiên của-CAR-111 (#579/#580) được-sửa-ngay-trong-code — stub-kiểm-thử parse-host-của-URL thay-vì-khớp-chuỗi-con, và-một-chuỗi-prompt-đầy-đủ-không-dùng-đến đã-bị-loại-bỏ.
- **Backfill-điểm đã-chạy trên-máy-chủ-thật** (endpoint v1.256.0, được-chủ-sở-hữu-chấp-thuận): `updated: 22`, `missingReport: 0`, `reportScoreless: 159` — 159 dòng-không-có-điểm trỏ-về-các-báo-cáo mà-header ra-đời trước-khối-máy hoặc-mang-định-dạng-điểm-không-parse-được; chỉ-hồi-được bằng-đánh-giá-lại hoặc-một-lượt-parser-rộng-hơn (được-ghi trong-CAR-129).
- Cố-ý-không-làm: không-đổi-nulls-last cho-cột-commute (một-quirk-`Infinity`-khi-giảm-dần có-từ-trước), không-tính-lại-giá-hồi-cố cho-các-dòng-usage cũ, không-highlight-kiểu-`.is-error` cho-các-biểu-mẫu-bộ-lọc-quét (CAR-130 giới-hạn ở-helper-submit-dùng-chung của-mode-page + gợi-ý-api.js).
- Kiểm-thử 5749 (+36). Không-chạm-nguồn-quét nào (registry 121 = 116 EN + 5 RU · 116 adapter); không-có-khóa-i18n nào (gợi-ý CAR-130 tái-sử-dụng `conn.down`; vùng-skeleton tái-sử-dụng `common.loading`).

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
