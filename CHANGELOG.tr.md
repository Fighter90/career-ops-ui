# Changelog (Türkçe)

> Bu changelog v1.85.0'dan başlar — Türkçe yerelleştirmenin eklendiği sürüm. Önceki sürümler için bkz. [CHANGELOG.md](CHANGELOG.md).

## [1.86.0] — 2026-07-03
### Eklenenler
- **Hedef rollere göre istatistikler (`#/stats`) — HEDEF rollerin için piyasa ilan ve maaş istatistikleri.** Yeni bir Analitik sayfası, **profildeki hedef rollerini** (`config/profile.yml` → sabit kodlanmamış) ve son taramadaki ilanları okur, ardından her rol ve ülke için şunları gösterir: **ülkeye göre ilanlar** ve **ülkeye göre medyan maaş (USD)** — tarayıcıların zaten topladığı seyrek verilerden istemci tarafında toplanır (`public/js/lib/role-stats.js`, `window.Countries` yeniden kullanılarak).
- Herhangi bir para birimindeki maaşlar, açıkça yaklaşık olduğu belirtilen bir FX tablosu aracılığıyla USD'ye normalleştirilir ve örneklem büyüklüğü uyarısı eklenir — asla uydurulmaz. Ayrıca **rol ve ülke filtreleri** ile elle yazılmış satır içi SVG çubuk ve trend grafikleri (yeni bağımlılık yok, CSP güvenli — yalnızca `addEventListener`).
- **Anlık görüntüyü kaydet** (`POST /api/stats/snapshot`) mevcut toplamı `data/role-stats.jsonl` dosyasında kalıcı hale getirir; **trend grafiği** (`GET /api/stats/trend`) ilan sayılarını zaman içinde izler — "dinamik" görünümü. Dürüst hibrit: anlık görüntüler yerel tarama verilerinden gelir ve istek üzerine yenilenir.
- Tüm **16 yerel ayarda** tamamen yerelleştirildi (26 yeni i18n anahtarı). Yeni: `server/lib/routes/stats.mjs` (16. rota modülü), `public/js/lib/role-stats.js`, `public/js/views/stats.js`, `PATHS.roleStats`; testler `role-stats.test.mjs` (7) + `stats-routes.test.mjs` (5).

## [1.85.0] - 2026-07-03
### Eklenenler
- **Almanca (`de`), İtalyanca (`it`) ve Türkçe (`tr`) yerelleştirme** — arayüz, uygulama içi Yardım kılavuzu, README ve CHANGELOG artık bu üç ek dilde de mevcut (career-ops 1.16.0 yerel ayar setinden aktarıldı). Arayüz artık 16 dili destekliyor.
- Dil seçici artık Deutsch 🇩🇪, Italiano 🇮🇹 ve Türkçe 🇹🇷 dillerini listeliyor; tarayıcı dili otomatik algılama `de`, `it`, `tr` dillerini tanıyor.
- Prompt iskeleleri (`server/lib/prompts.mjs`) üç yeni dil için yerelleştirildi.
