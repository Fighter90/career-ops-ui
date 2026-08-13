# Changelog (Türkçe)

> Bu changelog v1.85.0'dan başlar — Türkçe yerelleştirmenin eklendiği sürüm. Önceki sürümler için bkz. [🇬🇧 CHANGELOG.md](CHANGELOG.md).

## [1.172.0] — 2026-08-13

**Düzeltildi (MEDIUM, tarayıcı) — bozuk bir HTML varlığı bir tarama kaynağını çökertebiliyordu (career-ops #2150 paritesi).**

### Düzeltildi
- `oraclecloud`, `gem` ve `dassault` kaynakları, sayısal HTML varlıklarını `String.fromCodePoint` öncesinde yalnızca zayıf bir `Number.isFinite` denetimiyle çözüyordu — `0x10FFFF` üzerindeki bir başvuru (ör. bozuk veya kötü niyetli bir akıştan `&#99999999;`) yakalanmayan bir `RangeError` fırlatıp o kaynağın tüm ayrıştırmasını iptal ediyordu. Ortak bir modül `server/lib/html-entities.mjs` (üst projenin `_html-entities.mjs` dosyasını yansıtır) artık sayısal başvuruları XML 1.0 §2.2 Char kümesiyle sınırlar; böylece `String.fromCodePoint` asla fırlatamaz ve onaltılık ile ondalığı ayrı eşleştirdiği için `&#1a2;` artık yanlış ayrıştırılmaz. Üç kaynak bunu içe aktarır.

### Notlar
- Geçerli akışlar için davranış değişmez; JS / i18n / rota / CSP / SSRF / üst yazma değişikliği yok. Kaynaklardaki kalan ~20 çözücü kopyasının birleştirilmesi `qa/PARENT-SYNC-WORKLIST-v1.26.0.md` içinde izleniyor.
- Testler: `tests/html-entities.test.mjs` (+7). Takım: **2444** (+7).

## [1.171.0] — 2026-08-13

**Değiştirildi (DÜŞÜK, tasarım sistemi) — yazı ölçeği + z-index katman belirteçleri (D-4, ilk adım).** Boyutlar ve katmanlama bileşen başına düz değerdi.

### Değiştirildi
- **z-index katmanları** — `--z-*` belirteçleri (`--z-topbar` … `--z-skiplink`) eklendi ve **her z-index düz değeri taşındı**. Değerler korundu, katmanlama aynı; yeni bir kanarya yeni sihirli sayıları yasaklıyor.
- **Yazı ölçeği** — `--font-size-*` rampası (`xs 11` … `2xl 28`, taban = Inter 15px); bileşenlerin zaten kullandığı çekirdek boyutlar taşındı (görsel değişiklik yok). Rampa dışı değerler kademeli taşınır (`docs/UX-ROADMAP.md`).

### Notlar
- Yalnızca CSS belirteci; davranış/JS/i18n/rota/CSP/SSRF/yazma değişikliği yok. Piksel değişikliği yok. `tests/design-tokens-scale.test.mjs` (+3). Takım: **2437** (+3).

## [1.170.0] — 2026-08-13

**Eklendi (DÜŞÜK) — uzun yapay zekâ oluşturmalarında dürüst ETA ipuçları (P4-ETA).** Ağır oluşturmalar (kariyer planı ~40 sn, yönlendirme / pazar / networking ~30 sn, two-pager ~20 sn) süre hissi olmadan yalnızca "Oluşturuluyor…" gösteriyordu.

### Eklendi
- Her uzun oluşturma düğmesinin yanında artık sönük bir **`⏱ ~Nsn`** ipucu var (`#/auto` ETA'sı gibi). Paylaşılan `.eta-hint` stili + iki genel anahtar (`common.eta` `~{n}s`, `common.etaTitle`).

### Notlar
- Yalnızca istemci; rota/CSP/SSRF/yazma değişikliği yok. +2 i18n anahtarı ×17 (anlık görüntü 1219 → 1221). `tests/generation-eta-hint.test.mjs` (+2). Takım: **2434** (+2).

## [1.169.0] — 2026-08-13

**Eklendi (DÜŞÜK) — satır içi PDF önizleme (D-5).** `GET /api/output/pdfs/:name`, `Content-Disposition: attachment` dayatıyordu; bu yüzden `#/cv`'deki "Aç" bağlantısı bile göstermek yerine indiriyordu.

### Eklendi
- **`?inline=1`**, AYNI temizlenmiş dosyayı `Content-Disposition: inline` ile sunar; tarayıcı yeni sekmede **👁 Önizleme** olarak işler. Varsayılan (parametresiz) hâlâ indirmedir. Yeni rota yok; aynı ad korumaları.
- `#/cv` PDF listesindeki ilk düğme artık **👁 Önizleme** (İndir'in yanında). `cv.openPdf` "Aç" → "Önizleme" ×17.

### Notlar
- CSP/SSRF değişikliği yok — aynı `sanitizePathName`. Mevcut bir i18n anahtarı ×17 yeniden yazıldı (anlık görüntü 1219). `tests/output-pdfs.test.mjs` (+3). Takım: **2432** (+3).

## [1.168.0] — 2026-08-13

**Düzeltildi (DÜŞÜK, a11y) — onay kutusu satırları artık WCAG 2.5.8'in 24×24 minimumunu karşılıyor (D-2).** `#/scan`, `#/config`, `#/evaluate` ve `#/cv-studio` üzerindeki onay kutusu/radyo etiketleri ~22 px'lik bir bantta duruyordu.

### Düzeltildi
- Kapsamı sınırlı `label:has(> input[type="checkbox"/"radio"]) { min-height: 24px }` kuralı ≥24 px'lik bir bant garanti eder. Yalnızca `min-height` — etiketler zaten flex, hiçbir şey kaymaz; `.apply-checklist` (32 px) zaten uyumluydu.

### Notlar
- Yalnızca CSS; davranış/JS/i18n/rota/CSP/SSRF/yazma değişikliği yok. `tests/checkbox-target-size.test.mjs` (+1). Takım: **2429** (+1).

## [1.167.0] — 2026-08-13

**Düzeltildi (DÜŞÜK, tasarım sistemi) — yükseltilmiş yüzeyler artık ince çizgilerden ayrışıyor (D-3).** `--panel-2` / `--surface-elev1` tokenları, ince çizgiler `--line` / `--border` ile aynı `--slate` değerine çözümleniyordu, görsel ayrım yoktu.

### Düzeltildi
- Temaya duyarlı özel bir token **`--elev`** (açık `#eef1f6` / koyu `#1e232e`, her iki temada `--slate`'ten farklı) artık yükseltilmiş yüzeyleri destekliyor; ince çizgiler `--slate`'te kalıyor. Kalan bulgular (D-2, D-4, D-5, P4-ETA) `docs/UX-ROADMAP.md`'de backlog.

### Notlar
- Yalnızca CSS token; davranış/JS/i18n/rota/CSP/SSRF/yazma değişikliği yok. `tests/elevation-token.test.mjs` (+2). Takım: **2428** (+2).

## [1.166.0] — 2026-08-13

**Düzeltildi (DÜŞÜK) — rubrik terminolojisi artık kanonik belgeleri yansıtıyor.** career-ops.org/docs "beş boyut artı bütünsel bir genel puan" diye tanımlıyor, ancak web-ui, cvstart.org ve wiki hepsi "altı boyutlu rubrik" diyordu (5 + 1 = 6, ama sözcükler uyuşmuyordu).

### Düzeltildi
- Belgelerin ifadesi — **"beş boyut artı bütünsel bir genel puan"** — README ×17, cvstart.org sitesi ×17, yardım kılavuzu ×17, `docs/career-ops-canonical.md` ve wiki (Home ×17 + Features) genelinde tutarlı biçimde benimsendi.

### Notlar
- Yalnızca belge/pazarlama; kod/i18n anahtarı/rota/CSP/SSRF/yazma değişikliği yok. `tests/rubric-terminology.test.mjs` (+2). Takım: **2426** (+2).

## [1.165.0] — 2026-08-13

**Düzeltildi (DÜŞÜK) — "Two-pager" terimi artık her dil içinde tutarlı.** Arapçada kenar çubuğu Latin "Two-pager" gösterirken `<h1>` tamamen yerelleştirilmişti — aksi halde aynalanmış RTL gezinmesindeki tek Latin dizesi.

### Düzeltildi
- **Karar uygulandı:** dil başına `nav.twoPager` ve `twoPager.title` terimde uyuşur (ikisi de Latin ya da ikisi de yerelleştirilmiş). Yalnızca Arapça ayrıktı; gezinme etiketi artık yerelleştirildi ("الصفحتان"). Yeni bir kanarya, bir dil onları tekrar ayırırsa başarısız olur.

### Notlar
- Yalnızca metin; rota/CSP/SSRF/yazma değişikliği yok. Bir i18n değeri değişti (ar); yeni anahtar yok (anlık görüntü 1219). `tests/two-pager-term-consistency.test.mjs` (+2). Takım: **2424** (+2).

## [1.164.0] — 2026-08-13

**Düzeltildi (DÜŞÜK) — üst çubuk arama yer tutucusu artık hiçbir dilde taşmıyor.** "Find a company, role or URL…" arama çubuğu küçüldüğünde kırpılıyordu; "…or URL" yarısı asla görünmüyordu.

### Düzeltildi
- `top.search` (×17) artık kısa **"Ara veya URL yapıştır"** (her dilde ≤24 karakter), dar bir çubukta bile sığar ve URL ipucunu korur. `index.html` yedeği eşleşir; `aria-label` tam ayrıntıyı korur.

### Notlar
- Yalnızca metin; rota/CSP/SSRF/yazma değişikliği yok. Mevcut bir i18n anahtarı ×17 yeniden yazıldı (yeni yok; anlık görüntü 1219). `tests/search-placeholder-fit.test.mjs` (+2). Takım: **2422** (+2).

## [1.163.0] — 2026-08-13

**Düzeltildi (DÜŞÜK) — uygulama içi "Belgelere sor" asistanı artık bir raporu PDF olarak dışa aktarmayı kapsıyor.** `#/reports/:slug`'da çalışan bir 📄 Generate PDF düğmesi olmasına rağmen kılavuzun bunu kapsamadığını söylüyordu.

### Düzeltildi
- **17 yardım paketinin** tamamında §10 Raporlar altına **"Bir raporu PDF olarak dışa aktarma"** H3'ü eklendi (düğme nerede, dosya `output/*.pdf`'e yazılır, Playwright gerekir, göndermeden önce gözden geçir). Asistan getirimi artık Raporlar bölümünü gösteriyor.

### Notlar
- Yalnızca belge/yardım; kod/rota/CSP/SSRF/yazma değişikliği yok. Yardım eşiği **112 → 113 H3** (31 H2 değişmedi). `tests/help-reports-pdf-section.test.mjs` (+2). Takım: **2420** (+2).

## [1.162.0] — 2026-08-13

**Düzeltildi (ORTA) — yardım "?" artık ≥24×24 işaretçi hedefi (WCAG 2.5.8).** `.help-hint` her başlıkta `padding:0` ile 18×18 px, minimumun altındaydı.

### Düzeltildi
- `.help-hint` kutusu artık **24×24** (ölçülebilir hedef), **görünen halka 18px kalıyor** — ortalanmış bir `::before` ile çizilir, böylece glif ve `<h1>` taban çizgisi değişmez. Hover/etkin/odak durumları halkayı izler; kenar boşluğu 6→3px ile boşluk korunur.

### Notlar
- Yalnızca CSS; JS/i18n/rota/CSP/SSRF/yazma değişikliği yok. `tests/help-hint-target-size.test.mjs` (+2). Takım: **2418** (+2).

## [1.161.0] — 2026-08-13

**Düzeltildi (ORTA) — `#/reports` boşluk yerine "Puan algılanmadı" çipi gösteriyor.** v1.159.0 dil-duyarlı ayrıştırıcıdan sonra bile puanı ayrıştırılamayan bir rapor boş alan gösteriyordu — başarısızlıktan ayırt edilemez.

### Düzeltildi
- Puan hücresi artık dallanıyor: puan varsa → ton hapı; yoksa → sönük **`.score-muted`** çipi ("Puan algılanmadı", ×17) ve "Raporu aç…" ipucu. Kart klavyeyle kullanılabilir `role="link"` olarak kalır ve tarih gösterilir.
- Mevcut nötr belirteci yeniden kullanır; yeni renk yok.

### Notlar
- Yalnızca istemci; rota/CSP/SSRF/yazma değişikliği yok. +2 i18n anahtarı ×17 (anlık görüntü 1217 → 1219). Takım: **2416** (+3).

## [1.160.0] — 2026-08-13

**Düzeltildi (YÜKSEK) — sağlayıcı metni artık 7 sağlayıcı vaadiyle çelişmiyor.** `#/config`, canlı değerlendirmenin "Anthropic veya Gemini anahtarını kullandığını" ve OpenAI anahtarının "web arayüzü tarafından kullanılmadığını" söylüyordu; panoda "Anthropic-first scoring" yazıyordu — 7 sağlayıcı zincirinden (v1.157.0) beri yanlış.

### Düzeltildi
- `config.providerModelNote` (×17): artık ⚡ canlı değerlendirmenin yedi anahtarından (Anthropic · Gemini · OpenAI · Qwen · OpenRouter · GitHub Models · Hermes) herhangi biriyle başsız çalıştığını, otomatik sıralı ve yedekli olduğunu belirtiyor. Yanlış OpenAI cümlesi kaldırıldı.
- `dash.quick.evaluateSub` (×17): sağlayıcıdan bağımsız ("0–5 uygunluk puanı"). `Keys: N / 5` → `N / 7`.

### Notlar
- Yalnızca metin; rota/CSP/SSRF/yazma değişikliği yok. Yeni i18n anahtarı yok (anlık görüntü 1217). Takım: **2413** (+3).

## [1.159.0] — 2026-08-13

**Düzeltildi (YÜKSEK) — rapor meta verileri artık dile bağlı değil.** İngilizce dışında bir dilde üretilen raporlar `#/reports` üzerinde boş bir meta veri şeridi gösteriyordu, çünkü `parseReportHeader` yalnızca İngilizce kalın etiketleri tanıyordu.

### Düzeltildi
- `parseReportHeader` artık dilden bağımsız `## Machine Summary` YAML bloğunu ayrıştırıyor (`score:` / `legitimacy:` / `date:` — `auto-pipeline`'ın zaten okuduğu kaynak): İngilizce etiketler → Machine Summary → yerelleştirilmiş etiketler (`REPORT_LABELS`, 17 dil). İngilizce raporlar bayt bayt aynı kalır.
- Toleranslı sayı ayrıştırma (`1.5/5`, `1,5/5`, `1.5 из 5`, `4.5 out of 5`); gövdede tarih yoksa dosya mtime'ına düşer.

### Notlar
- Yalnızca okuma/ayrıştırma; rota, CSP, SSRF veya üst yazma değişikliği yok. Yeni i18n anahtarı yok. Takım: **2410** (+8).

## [1.158.0] — 2026-08-12

**Düzeltildi — iki kozmetik görüntüleme hatası (sekme başlığına sızan bir «?» ve açılış sayfasında yanlış sağlayıcı sayısı).** Yalnızca görüntüleme; davranış, güvenlik veya veri akışı değişikliği yok.

### Düzeltildi
- HelpHint'in «?» işareti artık `document.title`'a sızmıyor. Yönlendirici sekme başlığını ham `h1.textContent`'ten türetiyordu, bu yüzden sekme «Vacancy search» yerine «Vacancy search?» gösteriyordu. `router.js::focusNewView` artık başlığı klonluyor, `.help-hint`'i kaldırıyor ve sonra metni okuyor; görünen «?» dokunulmadan kalıyor.
- cvstart.org «7» yerine «17 AI providers» gösteriyordu. `Features.astro`'daki `sub()` yardımcısı, kart bazlı değiştirmeden önce tüm `{n}` değerlerini dil sayısıyla (17) yeniden yazıyordu; artık `{n}` kart bazında çözülüyor (sağlayıcılar → 7, diller → 17).

### Notlar
- Sunucu, rota, CSP, SSRF veya i18n anahtarı değişikliği yok; `facts.json` biçimi değişmedi. Takım: **2402** test (+1).

## [1.157.0] — 2026-08-12

**Düzeltildi — canlı değerlendirmeler artık yalnızca Anthropic/Gemini değil, YAPILANDIRILMIŞ herhangi bir sağlayıcıyla çalışıyor.** Yalnızca `OPENROUTER_API_KEY` ayarlı bir kullanıcı yanlışlıkla manuel moda zorlanıyordu.

### Düzeltildi
- **Kök neden:** anahtarsız bir `LLM_PROVIDER` sabiti (ör. `init`’ten gelen `LLM_PROVIDER=claude`) çıkmaza giriyordu; artık yapılandırılmış sağlayıcılar arasında auto sırasına geri düşüyor (`selectActiveProvider` + her iki dağıtım kaskadında).
- İstemci kapılaması (`#/deep` + mode-page görünümleri) artık eski Anthropic/Gemini yoklaması yerine `window.ProviderStatus` (`/api/status/providers`, yedisi) kullanıyor; yeniden yazılmış metinler (deep/eval × 17) + panodaki «Canlı değerlendirmeler» rozeti + `config.llmProviderHint`.

### Notlar
- Güvenlik değişikliği yok. Takım: **2401** test (+5).

## [1.156.0] — 2026-08-12

**Refactor — `scan.js`’i boyut sınırının altına bölmek (P-16) + bir CodeQL düzeltmesi.** `scan.js` **906 satırdı**; davranışı koruyan iki fabrika çıkarılarak **648**’e indirildi. P-15/P-16 görünüm-bölme çiftini tamamlar.

### Değiştirildi
- Yeni `scan/runner.js` (tarama yürütme motoru) ve `scan/filters.js` (filtre durum makinesi) `ctx`/`refs` torbalarıyla; `scan.js` ikisini bağlar.

### Düzeltildi
- CodeQL `js/useless-assignment-to-local` (#428) `config/tab-controller.js`: `let n = i;` → `let n;`.

### Notlar
- Saf refactor, davranış değişikliği yok; kaynağı okuyan 4 test yeniden yönlendirildi. İki büyük görünüm de artık 800’ün altında (P-15/P-16 tamam). Takım: **2396** test.

## [1.155.0] — 2026-08-12

**Refactor — `config.js`’i boyut sınırının altına bölmek (P-15).** `config.js` **1030 satırdı** (800 sınırının üstünde); davranışı koruyan iki modül çıkarılarak **783**’e indirildi.

### Değiştirildi
- Yeni `config/field-specs.js` (alan verisi + model listeleri) ve `config/tab-controller.js` (sekme çubuğu fabrikası); `config.js` bunlara başvurur, render mantığı değişmez.

### Notlar
- Saf refactor, davranış değişikliği yok; kaynağı okuyan 6 test yeniden yönlendirildi. `scan.js` (906) olduğu gibi bırakıldı (zaten kısmen bölünmüş; çekirdek temiz bir mekanik bölme için fazla bağlı). Takım: **2396** test.

## [1.154.0] — 2026-08-12

**Yeni kılavuz — "Tüm yığını bulutta çalıştır."** career-ops’un kendine ait bir bulut/sunucu anlatısı yok, biz de ekledik: üst **career-ops** hattını, bu **career-ops-ui** görüntüleyiciyi ve yapay zekâ **motorunu** (Claude Code üzerinden **Claude aboneliği**, yerel **Hermes**, veya API anahtarları) küçük ve her zaman açık bir sunucuya koymak için adım adım tarif. 17 dilde **Yardım §31**, bir README bölümü ve bir wiki sayfası olarak gelir.

### Eklendi
- **Yardım §31 "Tüm yığını bulutta çalıştır"** (× 17) — üç parça, hazırlama + kurulum, motor seçimi, güvenli yayınlama (HTTPS ters proxy + kimlik doğrulama + CSP/SSRF/XSS/sır-yok değişmezleri). Yardım paketi **31 H2 / 112 H3**’e büyür.
- **README** — "Tüm yığını bulutta çalıştır" bölümü (× 17) + wiki’de **Cloud-Deployment** sayfası.

### Notlar
- **Yalnız docs** — rota, sunucu veya istemci değişikliği yok; yeni i18n anahtarı yok. 4 yardım testi 31 H2 / 112 H3 sözleşmesine geçer. Takım: **2396** test (değişmedi).

## [1.153.0] — 2026-08-12

**Jobvite tarayıcısı herkese açık XML akışına taşındı (ebeveyn senkronu).** Ebeveyn, Jobvite JSON API’sini emekliye ayırdı (artık sıfır iş döndürüyor); web-ui’nin source’u aynı ölü uç noktayı kullanıyordu, bu yüzden izlenen her Jobvite şirketi sessizce boş taranıyordu. Ebeveyn düzeltmesini (`#2623`) taşır: source artık `companyEId` ile anahtarlanan herkese açık kiracı-başına **XML akışını** okur.

### Düzeltildi
- Source, emekli JSON API’sini çağırıp sıfır iş döndürüyordu; artık `https://app.jobvite.com/CompanyJobs/Xml.aspx?c={companyEId}` çağırıp XML `<result><job>…` ayrıştırıyor (CDATA + varlıklar, `detail-url`, `apply-url`’den önce).

### Değiştirildi
- `companyEId` çözümü: (1) portaldaki `company_eid:`, (2) açık bir `api:`’nin `c=` parametresi, (3) pano sayfası keşfi. `fetchText` (`http-json.mjs`) non-ok hatasına `.location`/`.retryAfter` ekler (salt okunur, geriye dönük uyumlu).

### Notlar
- **Güvenlik** — iki host (`jobs.jobvite.com`, `app.jobvite.com`) her istekten önce `assertJobviteUrl` ile sabitlenir: yalnız https, katı izin listesi, **hiçbir yönlendirme izlenmez**. `companyEId` yalnızca bir `?c=` değeridir; source sayısı değişmez.
- Takım: **2396** test (+4).

## [1.152.0] — 2026-08-12

**Hermes sağlayıcısı — kablolama tamamlandı + doküman güncellemesi.** v1.151.0 Hermes entegrasyonunun kod incelemesi iki gerçek boşluk ve dört tamlık maddesi buldu; hepsi burada düzeltildi ve uygulamanın tüm LLM sağlayıcı listesi tüm doküman yüzeylerinde ve 17 dilde tam yediye çıkarıldı.

### Düzeltildi
- **`#/config` Hermes’i zorlayamıyordu** — `LLM_PROVIDER` açılır listesi yalnızca altı sağlayıcı listeliyordu, bu yüzden `HERMES_API_KEY` ayarlanabiliyor ama Hermes UI’dan zorlanamıyordu. Artık `hermes` 8. seçenek ve yeni bir eşlik testi açılır listenin `LLM_PROVIDERS`’tan tekrar sapmasını engelliyor.
- **Kısa kendi barındırılan anahtarlar sessizce reddediliyordu** — `isUsableKey`’in 20 karakter tabanı bulut anahtarlarına göreydi; `hasHermesKey` artık gevşetilmiş 8 karakter tabanı kullanıyor (Hermes dokümanının örneği 19 karakter).

### Değiştirildi
- Sağlayıcı listesi README (× 17), uygulama içi yardım (× 17), `config.llmProviderHint` sözlüğü (× 17) ve `docs/sdd`’de tam yediye normalleştirildi; `hermesChatUrl` yolsuz bir ana bilgisayarı tamamlıyor; manuel yedek metni Hermes’i anıyor.

### Notlar
- **Güvenlik değişmedi** — yeni rota veya SSRF/CSP değişikliği yok; health/doctor bir `HERMES_API_KEY` satırı kazanıyor.
- Takım: **2392** test (+2).

## [1.151.0] — 2026-08-12

**Hermes artık bağlı bir LLM sağlayıcısı (Phase 5)** — Phase 5 kapsam çalışması, Nous Research’ün Hermes’inin **OpenAI uyumlu bir API Server** (`hermes gateway` → `POST /v1/chat/completions`) içerdiğini doğruladı; böylece career-ops-ui canlı değerlendirmeleri artık tıpkı OpenAI/Qwen gibi yerel bir Hermes üzerinden çalıştırıyor. **Uygulama ayarları**’nda `HERMES_API_KEY` ayarlayın; auto sırasına katılır (en son). Yol haritasının son açık maddesini kapatır — **Phase 5, Shape A**.

### Eklendi
- **Hermes LLM sağlayıcısı (Shape A)** — paylaşılan `runOpenAICompatible` istemcisi üzerinde `runHermes` (`server/lib/openai.mjs`), **her iki** kaskatta (`llm-dispatch.mjs` + `routes/llm.mjs`), auto sırasının sonunda + `LLM_PROVIDER=hermes` sabiti, `/api/status/providers` ve `llm-pricing.mjs`. Yapılandırılabilir yerel bir base URL’ye (varsayılan `http://127.0.0.1:8642/v1`) Bearer kimlik doğrulamasıyla ulaşır — bu, kullanıcı tarafından verilen bir iş URL’si değil, YAPILANDIRILMIŞ bir sağlayıcı uç noktasıdır (OpenRouter/Qwen gibi), dolayısıyla SSRF korumasına dokunmaz.
- **`#/config` alanları** — `HERMES_API_KEY` (gizli) + `HERMES_BASE_URL` + `HERMES_MODEL` (varsayılan `hermes-agent`), 6 yeni i18n anahtarı × **17 dil** (anlık görüntü 1208 → 1214).

### Değişti
- Kapsam çalışması çözüldü: `docs/integrations/HERMES.md`, uygulama içi yardım §30 (× 17), README tanıtımı (× 14), `hermes-bridge` skill’i ve yol haritası "planlandı / henüz bağlanmadı"dan **bağlandı (Shape A)**’ya geçiyor. Shape B (özel bir ajan çalışma zamanı relay’i) gerekmedi.

### Notlar
- **Güvenlik:** sağlayıcı fetch’i yapılandırılmış bir uç noktadır, diğer OpenAI uyumlu sağlayıcılarla aynı kategoride — yeni SSRF yüzeyi yok, CSP/sanitizer değişikliği yok. `HERMES_API_KEY` bir `SECRET_KEY`’dir (asla gösterilmez).
- Testler (CI-izole, sahte taşıma): `tests/hermes-provider.test.mjs` (+5); v1.146.0’ın "Hermes dalı yok" kanaryası, BAĞLI olduğunu doğrulamak için **tersine çevrildi**; sağlayıcı yüzey testleri 7 sağlayıcı sırasına güncellendi.
- Takım: **2390** test (+5).

## [1.150.0] — 2026-08-12

**Tutarlı boş durumlar (Phase 4 rötuşu)** — her "henüz bir şey yok" paneli artık bazı görünümlerin görünümü sihirli bir `40px` ile satır içi yeniden tanımlaması yerine, tek bir paylaşılan `.empty` stiliyle çiziliyor. Küçük bir görsel tutarlılık düzeltmesi; `#/activity`, `#/cv-studio`, `#/stats` ve `#/usage` boş durumları artık diğerlerinin tümüyle eşleşiyor (belirteçlenmiş 48px dolgu + kesikli kenarlık).

### Değişti
- **`#/activity`, `#/cv-studio`, `#/stats`, `#/usage`** boş panellerdeki satır içi `style: { padding: '40px', textAlign: 'center', color: 'var(--foggy)' }` ifadesini kaldırdı — üç özellik de zaten paylaşılan `.empty` sınıfı tarafından sağlanıyor (`--space-7` = 48px, ortalanmış, soluk, kesikli kenarlık). Böylece bu dördü diğer ~25 `.empty` paneliyle birebir aynı çiziliyor.
- Görünüme özgü meşru geçersiz kılmalar (`#/dashboard` `width:100%`, `#/pipeline` `border:none`) el değmeden kaldı — yalnızca tamamen gereksiz yeniden tanımlamalar çıkarıldı.

### Notlar
- **Yalnızca istemci CSS kullanımı temizliği** — rota, sunucu, i18n anahtarı veya CSS kuralı değişikliği yok (`.empty` sınıfının kendisi değişmedi); sözlük anlık görüntüsü 1208. Tarayıcıda doğrulandı (`#/usage` boş paneli 48px dolgu + kesikli kenarlık hesaplıyor, 0 konsol hatası).
- Yeni kanarya testi `tests/empty-state-consistency.test.mjs`, `.empty`'yi tek doğruluk kaynağı olarak korur. Phase 5 (Hermes sağlayıcısı) engelli kalmaya devam ediyor.
- Takım: **2385** test (+2: `tests/empty-state-consistency.test.mjs`).

## [1.149.0] — 2026-08-12

**Portallar Ayarlara taşındı (Phase 4)** — `#/portals` artık *Sourcing* altında değil, *Uygulama ayarları* yanındaki **Setup** gezinme grubunda. v1.144.0'dan beri bu bir ayar yüzeyi (takip edilen şirketleri aç/kapat + bir ATS sağlık yoklaması), bir sourcing eylemi değil — dolayısıyla ait olduğu yer burası. Yalnızca gezinme değişikliği; sayfa ve rotası değişmedi.

### Değişti
- **`#/portals` gezinme öğesi → Setup grubu** (`public/index.html` içinde), *Uygulama ayarları*'nın hemen ardına yerleştirildi. *Sourcing* grubundan çıkarıldı (grup Scan / Pipeline / Auto-pipeline / Finanse edilen şirketleri korur). `#/portals` rotası, görünümü ve `nav.portals` etiketi değişmedi — yalnızca kenar çubuğundaki konum değişti.

### Notlar
- **Yalnızca gezinme biçimlendirmesi** — rota, görünüm, i18n anahtarı veya sunucu değişikliği yok. Tarayıcıda doğrulandı (0 konsol hatası); `tests/portals-nav-placement.test.mjs` ile korunuyor.
- Takım: **2383** test (+2: `tests/portals-nav-placement.test.mjs`).

## [1.148.0] — 2026-08-12

**Daha derli toplu tarama filtreleri (Phase 4) — filtre paneli artık düzenli bir ızgara** — `#/scan` filtre paneli, değişken genişlikte katı kutulardan oluşan dağınık bir flex-wrap'ten duyarlı bir ızgaraya geçti ve Uygula / Sıfırla eylemleri artık kendi ayrı, sağa hizalı satırında yer alıyor. Aynı filtreler, aynı davranış — sadece daha okunaklı. Bir tasarım rötuşu (parent-sync yok).

### Değişti
- **`#/scan` filtre paneli → duyarlı ızgara** — `.scan-filters` artık `repeat(auto-fill, minmax(180px, 1fr))` sütunları ve eşit boşluklarla `display: grid`, böylece 11 etiketli filtre her genişlikte dağınık bir satıra sarmak yerine düzenli sütunlara hizalanır.
- **Uygula / Sıfırla eylemleri** kendi satırında tüm ızgarayı kaplar, ince bir çizgiyle ayrılır ve sağa hizalanır. `scan.js`'deki eski gizli etiket hilesi + iç flex sarmalayıcı kaldırıldı.

### Notlar
- **Yalnızca CSS + küçük bir DOM temizliği** — her filtre id'si (`#scan-filter-*`, `#scan-apply`) ve `SR.render()` bağlantısı değişmedi, dolayısıyla Playwright akışı el değmeden kaldı. Yeni i18n anahtarı yok.
- Tarayıcıda doğrulandı (0 konsol hatası); `tests/scan-filters-grid.test.mjs` ile korunuyor.
- Takım: **2381** test (+3: `tests/scan-filters-grid.test.mjs`).

## [1.147.0] — 2026-08-12

**Hermes & Telegram — uygulama içi yardım bölümü + cvstart.org yüzeyi (Phase 5b, bölüm 2)** — Hermes belge çalışmasının ikinci ve son parçası: nasıl yapılır artık uygulamanın kendi yardım kılavuzunun içinde, 17 dilin tümünde yaşıyor ve uygulama içi belge asistanı Hermes sorularını buradan yanıtlıyor. Hâlâ yalnızca belge — Hermes LLM sağlayıcı yolu **planlandı / henüz bağlanmadı** durumunda kalıyor (Phase 5).

### Eklendi
- **Uygulama içi yardım §30 "Hermes & Telegram" × 17 dil** — yeni bir kılavuz bölümü (Hermes nedir + iki entegrasyon biçimi; bir bulut sunucusunda çalıştırma; Hermes üzerinden Telegram + "NEYİN açığa çıkarılmaması gerektiği" kuralı), `#/help` üzerinden erişilebilir. `docs-assistant` / `DocsFab` grounding'i bunu otomatik alır çünkü ikisi de `docs/help/<lang>.md` okur.
- **cvstart.org — Hermes kılavuzuna bir bağlantı**, GitHub'daki belgeye yönlendirir.

### Değişti
- Yardım paketi eşiği **29 → 30 H2 / 105 → 108 H3** yükseltildi (`canonical-docs-coverage`, `help-ui`, `help-ru-config-section`); §30 üç H3 ekler.

### Notlar
- **Hâlâ hiçbir şey Hermes'i çağırmıyor.** Yeni kanarya testi `tests/help-hermes-section.test.mjs`, her dilin §30'u dilden bağımsız çıpalarıyla (`docs/integrations/HERMES.md`, `hermes-bridge`, `#/help`, `127.0.0.1`, Telegram) içerdiğini doğrular. Sağlayıcı, Phase 5 API sözleşmesine kadar engelli kalır.
- Bu, Phase 5b'nin **belge + skill** çıktısını kapatır; sağlayıcı entegrasyonu (Phase 5) ayrı, engellenmiş bir madde olarak kalır.
- Takım: **2378** test (+2: `tests/help-hermes-section.test.mjs`).

## [1.146.0] — 2026-08-12

**Hermes ajanı + Telegram — entegrasyon kılavuzu + bir skill (Phase 5b, bölüm 1)** — career-ops-ui'yi bir bulut sunucusunda çalıştırabilir ve olaylarını (tamamlanmış bir tarama, yeni bir rapor, acil bir takip) Nous Research'ün Hermes ajanı üzerinden Telegram'a bağlayabilirsiniz. Bu sürüm tasarım + dağıtım belgelerini ve bir hermes-bridge skill'ini sunar; Hermes LLM sağlayıcı yolu hâlâ planlanan / henüz bağlanmamış durumda (Phase 5 API sözleşmesi spike'ına tıkanmış). Belgeler kasıtlı olarak koddan önde.

### Eklendi
- **`docs/integrations/HERMES.md`** — derinlemesine inceleme: iki entegrasyon biçimi (OpenAI uyumlu endpoint vs. ajan çalışma zamanı), bulut sunucusuna dağıtım (reverse proxy + HTTPS + systemd, başsız bir makinede salt okunur parent sözleşmesi), Hermes üzerinden Telegram ve bir tehdit modeli «NEYİN açığa çıkarılmaması gerektiği» listesi (kanal'a CV / maaş / rapor içeriği / anahtar sızdırılmaz).
- README'deki **`## Hermes agent + Telegram`** tanıtımı — İngilizce README'de kısa bir yönlendirme + bağlantı, her dilin tam çevrilmiş README'sinde de yansıtılır.
- Kılavuzu işlevsel kılan bir **`hermes-bridge` skill'i** (`.claude/skills/hermes-bridge/`) — ön koşul + kapsam denetimleri (Node ≥ 18, anahtarların varlığı, SSRF'ye karşı güvenli yol üzerinden endpoint erişilebilirliği), sırları asla diske/loglara yazmaz ve bir Hermes endpoint'i icat etmeyi veya sağlayıcının bağlı olduğunu iddia etmeyi reddeder.
- `docs/architecture/OVERVIEW.md`'deki bir **Integrations** bölümü kılavuza bağlanır.

### Notlar
- **Şu an hiçbir şey Hermes'i çağırmıyor.** Bir kanarya testi (`tests/hermes-docs.test.mjs`) «planlanan / henüz bağlanmamış» dürüstlük işaretlerini ve `llm-dispatch.mjs`'de hiçbir Hermes/Nous dalı olmadığını doğrular — yani sağlayıcının ileride bağlanması, belgeleri + yol haritasını aynı değişiklikte güncellemek zorundadır.
- **v1.147.0'a ertelendi** (Phase 5b, bölüm 2): uygulama içi yardımdaki «Hermes & Telegram» H2 bölümü × 17 dil ve cvstart.org pazarlama yüzeyi.
- Takım: **2376** test (+4: `tests/hermes-docs.test.mjs`).

## [1.145.0] — 2026-08-12

**Anlayışlı istatistikler (devam): yeniden oluşturulabilir grafik** — `#/stats`'teki "Hedef rol eğilimi" sekmesinde artık bir **Grafik oluştur** aracı var: bir metrik × boyut seçin, canlı olarak yeniden çizilsin. Kullanıcı bildirimli bir UX isteği (parent-sync yok).

### Eklendi
- **Yeniden oluşturulabilir metrik × boyut grafiği** — bir **metrik** (İlanlar / Medyan maaş / Ortalama maaş) ve bir **boyut** (Ülkeye göre / Role göre) seçin, çubuk grafik anında yeniden çizilir. Maaş metrikleri para birimi + yıllık ⇄ aylık anahtarına uyar; ilanlar basit bir sayımdır.
- 8 yeni i18n anahtarı × **17 dil**; anlık görüntü 1200 → 1208.

### Notlar
- Tarayıcıda doğrulandı (0 konsol hatası). Takım: **2372** test (+2).

## [1.144.0] — 2026-08-12

**Ayarlar ve filtreler (Aşama 4, bölüm 1): izlenen portalları etkinleştir/devre dışı bırak** — artık izlenen bir şirketi `#/portals`'tan açıp kapatabilirsiniz ve tarayıcı buna uyar. Kullanıcı bildirimli bir UX isteği (parent-sync yok).

### Eklendi
- **`#/portals`'ta şirket başına Etkinleştir/Devre dışı bırak düğmesi** — tek tıkla bir portalı kapatır (EN tarayıcı zaten `enabled: false` şirketleri atlar, böylece devre dışı portal sonraki tüm taramalardan düşer) veya yeniden açar, iyimser bir bildirimle.
- **`POST /api/portals/toggle`** — `portals.yml`'deki bir şirketin `enabled` bayrağını cerrahi biçimde ve ayrıştırma doğrulamasıyla değiştiren açık bir kullanıcı yazımı (yorumlar, sıra ve diğer alanlar korunur). 5 yeni i18n anahtarı × **17 dil**; anlık görüntü 1195 → 1200.

### Notlar
- Tarayıcı değişikliği **sıfır** oldu — `en-scanner.mjs` zaten `enabled !== false` ile filtreliyor. Takım: **2370** test (+3).

## [1.143.0] — 2026-08-12

**Anlaşılır (devam): ana iş akışı görünümlerinde `?` ipuçları** — yardım `?`'i artık tüm dillerde dokuz ana eylem sayfasını kapsıyor. Kullanıcı bildirimli bir UX düzeltmesi (parent-sync yok).

### Eklendi
- **9 görünüm başlığına daha `?` yardım ipucu** — `#/scan`, `#/evaluate`, `#/cv-studio`, `#/tracker`, `#/config`, `#/deep`, `#/batch`, `#/auto`, `#/apply` satır içi bir `?` alır (`HelpHint.title` ile) ve yerelleştirilmiş bir «ne yapar / nasıl kullanılır / ne beklenir» açılır kutusu açar — v1.139.0'daki aynı CSP-güvenli bileşen.
- 9 yeni i18n anahtarı × **17 dil** (`help.hint.scan`/…/`apply`); anlık görüntü 1186 → 1195.

### Notlar
- Tarayıcıda doğrulandı (0 konsol hatası). Takım: **2365** test (+1).

## [1.142.0] — 2026-08-12

**Düzeltme: artık "Unknown" kariyer arketipi yok** — `#/orientation` artık bazen "Unknown" yanıtlayıp ona "daha çok yüklenmenizi" önermek yerine, her zaman sekiz adlandırılmış kariyer vektöründen sıralama yapıyor. Kullanıcı bildirimli bir düzeltme (parent-sync yok).

### Düzeltildi
- **`#/orientation` — AI istemi artık küme dışı bir arketipi yasaklıyor.** Model, ilk üçü tam olarak sekiz adlandırılmış vektörden sıralamak ZORUNDA ve **asla** "Unknown"/"N/A"/"yetersiz veri" yanıtlayamaz veya yeni etiket uyduramaz. Özgeçmiş zayıfsa yine de en yakın üçünü daha düşük güvenle adlandırır ve hangi kanıtın eksik olduğunu söyler.

### Notlar
- Yalnızca sunucu istemi değişikliği (`buildOrientationPrompt`); i18n/şema değişikliği yok. Takım: **2364** test (+1).

## [1.141.0] — 2026-08-12

**Anlayışlı istatistikler (devam): finansman alan şirketlerin zenginleştirilmesi** — `#/funded` artık daha görsel: şirket logoları, finansman tutarına göre bir grafik ve tur / tutar / keşif puanı / önerilen eylem içeren kartlar. Kullanıcı bildirimli bir UX düzeltmesi (parent-sync yok).

### Değişti
- **`#/funded` — düz tablo → kart ızgarası.** Yakın zamanda finansman alan her şirket artık bir kart: **logo** (`CompanyLogo` ile addan türetilir, başarısızsa harf avatarı), **tur** + **tutar** çipleri, üst projenin **keşif puanı** ve **önerilen eylemi**, ayrıca finansman haberi bağlantısı ve tarihi.
- **Finansman tutarı görselleştirmesi** — açıklanan tutara göre en büyük şirketlerin yatay çubuk grafiği; "$120M"/"€1.5B" gibi serbest metin tutarlar yeni bir `parseAmount` ile büyüklüğe ayrıştırılır. 3 yeni i18n anahtarı × **17 dil**.

### Notlar
- Hâlâ `GET /api/company-funded` üzerinde **salt okunur**; açıklama ve maaş aralığı finansman kaynağında yok. Takım: **2363** test (+2).

## [1.140.0] — 2026-08-12

**Anlayışlı istatistikler: daha zengin maaş rakamları** — `#/stats`'teki "Pipeline'ım" maaş dökümü artık (yalnız medyan değil) **ortalamayı**, bir **yıllık ⇄ aylık** anahtarını ve ülke başına **min · ort · medyan · maks** tablosunu gösteriyor. Faz 3'ün ilk dilimi. Kullanıcı bildirimli bir UX düzeltmesi (parent-sync yok).

### Eklendi
- **Ortalama maaş** — `RoleStats.salaryStats` artık `minUsd`/`medianUsd`/`maxUsd` yanında `avgUsd` döndürüyor. Medyan aykırı değerlere dayanıklıdır, ortalama çarpıklığı gösterir — birlikte bir dağılım olarak okunur.
- Maaş bölümünde **yıllık ⇄ aylık anahtarı** ve ülke başına **min · ort · medyan · maks tablosu** (para birimi ve dönem seçicilerine bağlı). 8 yeni i18n anahtarı × **17 dil**.

### Notlar
- Rakamlar hâlâ yalnızca okunabilir maaşlı ilanlardan türetilir ve USD'ye normalize edilir (gösterge niteliğinde). Takım: **2361** test (+1).

## [1.139.0] — 2026-08-12

**Anlaşılır: `?` yardım ipuçları** — tıklayınca «ne yapar / nasıl çalışır / ne beklenir» sorularını dilinizde açıklayan, yeniden kullanılabilir ve CSP-güvenli bir `?` düğmesi. Kullanıcı bildirimli bir UX düzeltmesi (parent-sync yok).

### Eklendi
- **`?` yardım ipucu açılır kutusu** (`window.HelpHint`) — bir başlığın yanındaki yuvarlak `?`, temaya uyumlu ve RTL'de yansıtılan hafif bir açılır kutu açar ve `UI.md()` ile yerelleştirilmiş bir açıklama gösterir; erişilebilir (`role="tooltip"`, `aria-expanded`, Escape/dışa tıklama ile kapanma, odak geri yükleme) ve CSP-güvenli.
- **`#/stats`'in 5 sekmesine** ve **8 AI/analitik görünüm başlığına** (career-plan, yönlendirme, two-pager, networking, deneme mülakatı, bellek, funded, haftalık özet) `?` eklendi — 14 yeni i18n anahtarı × **17 dil**.

### Notlar
- Tüm görünümlerde zaten tek satırlık bir alt başlık vardı; `?`, istendiğinde daha derin açıklamayı ekler ve boş durumları kendini açıklar hale getirir. Takım: **2360** test (+4).

## [1.138.0] — 2026-08-12

**Arayüz dilinde üretim** — her AI üretimi artık arayüzde seçtiğin dilde yanıt veriyor; ayrıca incelemeden doğan test sağlamlaştırmaları. Kullanıcı bildirimli bir UX düzeltmesi (parent-sync yok).

### Değişti
- **AI üretimleri artık arayüz dilini gözetiyor.** Arayüz Rusça, İspanyolca, Japonca … olduğunda üretilen metin her zaman İngilizce yerine **o** dilde dönüyor. Çıktı-dili yönergesi **tüm** üretim uç noktalarına iletiliyor — kariyer planı, yönlendirme, pazar raporu, deneme mülakatı, networking planı, «belgeye sor», bellek notu önerisi ve two-pager taslağı. Kod ve tanımlayıcılar İngilizce kalır (ör. two-pager YAML anahtarları); yalnızca düzyazı, başlıklar ve maddeler yerelleştirilir.

### Düzeltildi
- **CSS renk-rolü koruması** (`tests/css-role-tokens.test.mjs`) — v1.137.0 karanlık mod takma-ad token'larının rolü asla ters çevirmediğini doğrulayan statik bir kanarya: metin-rolü token'ları (`--fg`/`--danger`/`--ok`/…) asla `background` olarak, yüzey token'ları (`--card`/`--panel`/`--line`/…) asla metin `color`'ı olarak kullanılmaz; tüm CSS ve SPA satır-içi stillerinde.
- **`UI.md()` XSS yükleyici öz-sondası** — `api.js`'ten `md()`'i yükleyen test artık çıkarımın hemen ardından `md('<script>…')`'i yokluyor ve escape eksikse hata fırlatıyor; böylece gelecekteki hatalı bir dilimleme, güvenlik takımını kırpılmış bir fonksiyon üzerinde yeşile boyamak yerine **yüksek sesle** başarısız oluyor.
- **`#/career-plan` kaydırma koruması** — üretim sonrası `scrollIntoView` yalnızca önizleme hâlâ belgeye bağlıysa çalışır.

### Notlar
- `docs/UX-ROADMAP.md` güncellendi: `?` yardım ipuçları + sayfa açıklamaları + boş durumlar artık **v1.139.0**; bir **Nous Research / Hermes** sağlayıcısı — bulut sunucu + Telegram dağıtım kılavuzu ve bir Hermes becerisi ile — **Aşama 5 / 5b** olarak izleniyor.
- Takım: **2356** test (+5).

## [1.137.0] — 2026-08-11

**Okunabilirlik ve render düzeltmeleri** — karanlık mod kontrastı, grafik etiketleri ve kariyer planı. Kullanıcı tarafından bildirilen bir UX geçişi (üst proje senkronizasyonu yok).

### Düzeltildi
- **Birçok ekranda karanlık modda beyaz-üzerine-beyaz / siyah-üzerine-siyah** — birkaç görünümün referans verdiği on beş CSS özel özelliği (`--fg`, `--panel`, `--panel-2`, `--ok`, `--danger`, `--card`, …) hiçbir zaman tanımlanmamıştı, bu yüzden sabit kodlanmış açık/siyah değerlere geri dönüyorlardı: açık modda sorun yoktu, karanlık modda okunamazdı (`#/pipeline` genel bakış çipleri, `#/stats` etkin sekme, `#/config` "Etkin / Anahtarlar" + "✓ ayarlandı", `#/two-pager` bölümleri, `#/mock-interview` soru balonu, hata metni). Artık gerçek temaya duyarlı belirteçlere takma adlandırılmış durumdalar, böylece temayı otomatik olarak takip ediyorlar — otomatik bir denetleyiciyle doğrulanmış, **29 görünümün tümünde 0 WCAG-AA kontrast hatası**; `#/config` etkin sekmesi okunabilir, tonlanmış bir stile taşındı. Bir regresyon koruyucusu (`tests/dark-theme-tokens.test.mjs`) onları takma adlı tutuyor.
- **`#/stats` grafik etiketleri kelimenin ortasından kesiliyordu** ("Senior Backend Engineer" → "…Enginee") — artık üç nokta ile kısaltılıyor ve tam etiket bir üzerine gelme araç ipucu olarak korunuyor.
- **`#/career-plan` oluşturulan planı ham Markdown olarak gösteriyordu** — artık biçimlendirilmiş, okunabilir metin olarak otomatik render ediliyor (düzenlenebilir Markdown metin kutusunda kalıyor; Önizleme onu değiştiriyor).

### Notlar
- `#/career-plan`, `#/two-pager`, `#/stats` ve haftalık mülakat özeti bozuk değil — bir plan oluşturana / veriniz olana kadar boş durumlar gösteriyorlar. Daha açık sayfa içi rehberlik ve `?` yardım ipuçları bir sonraki adım olarak planlanıyor (`docs/UX-ROADMAP.md`).

## [1.136.0] — 2026-08-11

Üst proje career-ops **v1.26.x** paritesi (v1.26.0 sonrası ana hat) — bir yeni sıfır-kimlik-doğrulama kaynak artı web-ui yansılarına yönelik bir kalite ve sağlamlık düzeltmeleri dalgası. Kayıt defteri artık **79 kaynak = 74 İngilizce + 5 Rusça** (`ALL_ADAPTERS` 74).

### Eklendi
- **`eightfold`** (Eightfold AI, #2684) — sıfır-kimlik-doğrulama `https://<tenant>.eightfold.ai/api/apply/v2/jobs` API'si üzerinden yetenek-kazanımı panoları, `*.eightfold.ai`'a ana bilgisayar-sabitli (markalı `careers.<company>.com` CNAME'i kasıtlı olarak reddediliyor); bir güvenlik üst sınırıyla sayfalanmış, ölü-pano-fırlatma, url-çiftleme. Kaynak + adaptör + CI-izole paket; `#/scan` Kaynak filtresinde ve açılış sayfasında görünüyor.

### Düzeltildi
- **Unicode-duyarlı çiftleme ve rol anahtarları** (#2569 / #2587 / #2667) — yeni bir paylaşılan `normalizeTextKey` (NFKC, herhangi bir yazı sisteminin harflerini/işaretlerini/rakamlarını koruyor) yalnızca-ASCII anahtarların yerini alıyor: `detect-reposts` artık genişlik/noktalama şirket varyantlarını kümeliyor ("Acme, Inc." ≡ "Acme Inc") ve farklı Latin-olmayan işverenleri asla çökertmiyor, `role-matcher` ise tam-genişlikli unvanları katlıyor ve Latin-olmayan rol belirteçlerini silmek yerine koruyor.
- **`fetchJsonWithRetry` artık reddedilen bir yönlendirmeyi yeniden denemiyor** (#2657) — bir 3xx ile karşılaşan `redirect:'error'` koruyucusu determinist olduğundan, artık yeniden-denenemez olarak işaretleniyor ve yeniden deneme bütçesini tüketmek yerine hızlıca başarısız oluyor.
- **`title_filter.positive` VE-grupları** (#2552) — pozitif bir girdi içindeki boşlukla ayrılmış bir ` + ` artık her terimin, herhangi bir sırada, başlıkta görünmesini gerektiriyor.
- **`oraclecloud`, numaralandırılmış kiracı apekslerini kabul ediyor** `oraclecloud1.com … oraclecloud99.com` (#2683) — sınırlı bir aile (baştaki sıfır yok, ≤ 2 hane), asla bir joker aleksi değil.
- **`workable` sağlamlaştırıldı** (#2675) — Cloudflare-önlü ana bilgisayara karşı yeniden deneme, tarayıcı-benzeri başlıklar ve istek serileştirmesi.
- **`personio`**, XML beslemesi devre dışıyken hiçbir şey döndürmek yerine bir HTML kazımasına düşüyor.
- **`states` FALLBACK takma adları** üst projeyle yeniden eşzamanlandı (#2615).

### Notlar
- Taşınmadı (web-ui tarafından yansılanmıyor veya yalnızca-CLI): reply-matcher (#2672), jd-similarity (#2661), jd-skill-gap (#2686), tarama ortam-yolu (#2568) / `--flag=value` (#2589) ayrıştırması, ve kapak mektubu / CV-şablonu / doctor / ollama / generate-pdf değişiklikleri. Web `js-yaml`/`nanoid` YÜKSEK önerileri web-ui v1.135.0'da zaten yamalanmıştı.

## [1.135.0] — 2026-08-11

Üst proje career-ops **v1.26.0** paritesi — beş yeni sıfır-kimlik-doğrulama tarama kaynağı artı web-ui'nin zaten taşıdığı dört panoya doğruluk düzeltmeleri. Kayıt defteri artık **78 kaynak = 73 İngilizce + 5 Rusça** (`ALL_ADAPTERS` 73).

### Eklendi
- **Beş yeni tarama kaynağı** (her biri bir kaynak + adaptör + CI-izole bir paket; `#/scan` Kaynak filtresinde ve cvstart.org açılış sayfasında görünüyorlar):
  - **`join`** (JOIN) — bir şirketin JOIN panosu, `join.com/companies/<slug>` içindeki Next.js `__NEXT_DATA__`'sından (ana bilgisayara sabitli, sayfa sınırlı).
  - **`getro`** (Getro) — VC "yetenek ağı" portföy panoları, herkese açık `api.getro.com` POST API'si üzerinden, en yeniden-eskiye sayfalanmış; her iş fona değil portföy işverenine atfediliyor.
  - **`consider`** (Consider) — getconsider.com VC portföy panoları, aynı-kökenli bir POST üzerinden; yapılandırma-güdümlü ana bilgisayar yapısal bir SSRF koruyucusuyla sabitleniyor (yalnızca herkese açık HTTPS ana bilgisayarı).
  - **`joinup`** (JOINUP) — İsviçre panosu joinup.ch, SSR edilmiş en yeni sayfayı okuyor; bir kazıyıcı kırılmasında hata-kapalı davranıyor.
  - **`remotli`** (Remotli) — remotli.ch, İsviçreli şirketlerdeki uzaktan roller (CHF maaşları); işverenin kendi ATS başvuru URL'sini yayınlıyor, böylece çapraz-listelemeler çiftlemeden ayıklanıyor.

### Düzeltildi
- **a16z Speedrun** artık geçici bir aksaklıkta tüm panoyu iptal etmiyor — sayfa getirmeleri artık paylaşılan bir `fetchJsonWithRetry` üzerinden geçiyor (yalnızca geçici 429/5xx/zaman aşımında sınırlı yeniden denemeler, asla kalıcı bir 4xx'te), ve sayfa bütçesi 50 işlik sayfa için yeniden boyutlandırıldı.
- **arbeitsagentur** v6 Jobsuche API'sine (`/pc/v6/jobs`) taşındı — eski v4 uç noktası 404 veriyor; yanıt şekli yeniden adlandırıldı ve uzaktan filtreleme artık sunucu tarafında daralıyor.
- **thehub** v2 `jobsandfeatured` API'sine taşındı; satırlar yayın tarihi taşımıyor ve yaş filtresinden muaf.
- **hackernews**, Algolia aramasını serbest metin sorgusu yerine `author_whoishiring` hesap etiketine filtreleyerek aylık "Kim işe alıyor?" konusunu güvenilir şekilde buluyor.

### Notlar
- Taşınmadı (web-ui zaten güvenli, aktarım-tarafından-emilmiş veya yalnızca-CLI): Unicode rol-çiftleme / şirket-eşleştirme anahtarları (web-ui'nin tekrar-ilan gruplaması zaten şirketi düz küçük harfle anahtarlıyor, bu yüzden farklı Latin-olmayan işverenler asla çökmüyor); takip reddi-gecikme sinyali + finanse edilen şirket rötuşları (salt-okunur, hataya-toleranslı olarak aktarılıyor); tarama ortam-değiştirilebilir yolları ve `--flag=value` ayrıştırması (web-ui tarayıcıları işlem içinde çalıştırıyor); User-Agent birleştirme yeniden düzenlemesi (web-ui zaten bunu merkezileştiriyor); ve yalnızca-CLI öğeleri (güvenilmeyen-içerik listesi, oferta/offer-prep, doctor, kapak/CV şablon değişiklikleri).

## [1.134.1] — 2026-08-05

Doğrulama sağlamlaştırması — kapsamlı bir proje denetimiyle ortaya çıkan düzeltmeler.

### Düzeltildi
- **`successfactors` artık tarama-ortası bir hatada kazınan işleri atmıyor** (v1.134.0'daki ölü-pano-fırlatma aktarımında bir regresyon) — sayfalama döngüsünde `try/catch` yoktu, bu yüzden 2. sayfa ve sonrasında (1. sayfa başarılı olduktan sonra) bir hata fırlatılıyor ve o ana kadar toplanan her şeyi düşürüyordu; ve bu hata bir `404` ise (aralık dışı bir `startrow`), `en-scanner` canlı bir kiracıyı günlerce ölü olarak karantinaya alıyordu. Şimdi `phenom`/`radancy` ile aynı: 0. sayfadaki bir hata hâlâ fırlatılıyor (ölü pano), ancak daha sonraki bir sayfadaki hata kısmi sonuçları koruyor.
- **`#/scan` filtre çipleri artık klavyeyle çalıştırılabiliyor** (WCAG 2.1.1) — faset çipleri (ve "temizle" çipi) bir tıklama işleyicisine sahip ama `tabindex`/rolü olmayan span'lerdi, bu yüzden klavye ve ekran okuyucu kullanıcıları onlara erişemiyor veya değiştiremiyordu. Şimdi `role="button"`, `tabindex="0"`, `aria-pressed` taşıyorlar ve Enter/Boşluk ile etkinleştiriliyorlar.
- **Üç sabit kodlanmış İngilizce dize artık yerelleştirildi** — `#/scan` güven-rozeti araç ipucu, `#/scan` yer değiştirme sütun başlığı ve `#/dashboard` puan başlığı, i18n parite kapısının göremediği çıplak literallerdi (hiçbir zaman anahtar olmamışlardı), bu yüzden İngilizce olmayan her yerelleştirmede İngilizce kalıyorlardı. Şimdi `scan.trustTip` + `scan.col.reloc` (2 yeni anahtar) ve mevcut `track.col.score`'un yeniden kullanımı var, kaynak-statik bir koruyucuyla (`tests/scan-chip-a11y.test.mjs`) sabitlenmiş.
- +3 test → paket **2187**.

## [1.134.0] — 2026-08-05

Üst proje career-ops v1.25.0 paritesi.

### Eklendi
- **Yeni tarama kaynağı: getManfred** (`manfred`) — yayınlanmış maaşlarla İspanyol/AB teknoloji rollerinin pano-geneli bir beslemesi, `www.getmanfred.com/api/v2/public/offers`'tan (sıfır-kimlik doğrulama, ana bilgisayara sabitlenmiş + yalnızca-HTTPS, tek istekli tam katalog). Kaynak + adaptör + CI-izole bir paket (`tests/sources-manfred.test.mjs`); kayıt defteri artık 73 kaynak = 68 İngilizce + 5 Rusça (`ALL_ADAPTERS` 68). `#/scan` Kaynak filtresinde ve cvstart.org açılış sayfasında görünür.

### Düzeltildi
- **a16z Speedrun beslemesi sessizce 50 işe kısaltılıyordu** (#2404) — besleme bir sayfayı 50 ile sınırlıyor ancak kaynak `PER_PAGE = 100` istiyordu, bu yüzden sayfalama 1. sayfadan sonra duruyordu. 50'ye düzeltildi.
- **Ölü panolar artık "canlı ama boş" olarak okunmak yerine hata fırlatıyor** (#2379) — `cryptocurrencyjobs`, `phenom`, `radancy`, `successfactors`: hiçbir isteğin hiç çözümlenmediği bir getirme hatası artık hata fırlatıyor (böylece `#/portals` sağlığı ve tarama gerçek bir hatayı kaydediyor), onu boş bir listeye yutmak yerine; en az bir başarıdan sonraki bir tarama-ortası hata kısmi sonuçları koruyor.
- **workable artık genel widget API'sini kullanıyor** (#5ab8425) — büyük bir hesabın tam ilan listesini tek bir istekte döndüren `apply.workable.com/api/v1/widget/accounts/<slug>`'a geçildi, böylece büyük hesaplar artık kısaltılmıyor.

### Notlar
- Taşınmadı (yalnızca CLI veya web-ui tarafından yansıtılmıyor): detect-reposts #2389 başlık-gruplama performans yeniden yazımı; Unicode şirket-anahtarı düzeltmeleri (web-ui'nin kendi takipçi çiftlemesi zaten Latin-olmayan-güvenli); `scan --since`; `cv-facts`; CV şablonu / PDF denetim geçişi; `doctor`; modes güvenilmeyen-içerik direktifi.

## [1.133.1] — 2026-08-02

### Düzeltildi
- **`#/funded` (Finanse edilen şirketler) artık sonuçları gösteriyor** — üst projenin `company-funded.mjs`'i eksiksiz bir liste döndürdüğünde bile tablonun her zaman "finanse edilmiş şirket yok" göstermesine neden olan iki hata vardı. (1) Görünüm sonuçları `res.candidates` altında okuyordu, ancak üst proje bunları `companies` altında yayınlıyor (her biri `{ company, amount, round, funding: { sources: [{ source, url, observed_date }] } }`); istemci artık doğru anahtarı okuyor ve gerçek kanıt şeklini eşliyor. (2) Sonuç tablosu hücrelerini `UI.el('tr', {}, …)`'a değişken sayıda bağımsız değişken (varargs) olarak geçiriyordu, ancak `UI.el(tag, attrs, children)` `children`'ı tek bir düğüm veya dizi olarak alıyor, bu yüzden yalnızca ilk sütun (Şirket) render ediliyordu — hücreler artık bir dizi olarak geçiriliyor. Gerçek bir tarayıcıda doğrulandı: dört besleme genelinde 11 şirket, Şirket / Finansman sinyali / Kaynak / Tarih sütunlarıyla ve çalışan kanıt bağlantılarıyla render ediliyor, sıfır konsol hatası. Boş bir tarama artık kaynak başına tanılamaları da gösteriyor, böylece sessiz bir haber günü engellenmiş bir beslemeden ayırt edilebiliyor.
- `tests/parity-routes-v1133.test.mjs` içinde regresyon korumaları: sahte üst proje betiği artık gerçek `companies` çıktı şeklini yayınlıyor (orijinal test sabiti yanlış `candidates` şeklini yansıtıyordu — hatanın yeşil geçerek yayınlanmasının tam nedeni buydu), ayrıca `funded.js`'in `res.companies`'i okuduğunu (asla `res.candidates`'i değil) ve tablo satırlarını dizi children ile oluşturduğunu doğrulayan kaynak-statik kanaryalar eklendi (+1 → 2144).

## [1.133.0] — 2026-08-01

### Eklendi
- **Finanse edilen şirket keşfi (`#/funded`, üst proje paritesi #2117)** — üst proje career-ops'un `company-funded.mjs`'ini `GET /api/company-funded` üzerinden aktaran yeni bir salt-okunur görünüm: herkese açık, ana bilgisayara sabitlenmiş finansman beslemelerinden (TechCrunch, PR Newswire, The Guardian, Hacker News) keşfedilen, yakın zamanda finanse edilmiş şirketlerin inceleme-öncelikli bir listesi. Aktarım, betiği `--json --dry-run` ile çalıştırır (stdout'a JSON, dosya yazması yok), kullanıcı girdisini asla `--sources`'a aktarmaz, hız sınırlaması taşır ve kullanıcı tarafından tetiklenir (bir Keşfet düğmesi, asla bağlanma sırasında değil). Yeni rota modülü `server/lib/routes/funded.mjs` + `public/js/views/funded.js`, Kaynak bulma altında.
- **Haftalık mülakat özeti (`#/interview-digest`, üst proje paritesi #2129/#2130)** — üst projenin sıfır-LLM `weekly-digest.mjs`'ini `GET /api/interview/weekly-digest` üzerinden aktaran yeni bir salt-okunur görünüm: mülakat oturumu notlarının mekanik bir toplu özeti — bu hafta hangi şirketlerle ve hangi turlarda mülakat yaptığınız, tekrar eden yetkinlikler ve elden geldiğince tespit edilen açık boşluklar. İsteğe bağlı `?from=&to=` aralığı yalnızca İKİSİ de geçerli `YYYY-MM-DD` olduğunda aktarılır; boş bir aralık geçerli bir `available:true` özetidir. `server/lib/routes/interview.mjs` + `public/js/views/interview-digest.js`'e eklendi, Analitik altında.
- Her iki aktarım da üst proje betiği yokken (CI, bağımsız kurulumlar) yerleşik hataya karşı toleranslı `available:false` sözleşmesini izler. 26 yeni i18n anahtarı ×17 yerelleştirme; CI-izole paket `tests/parity-routes-v1133.test.mjs` (+5 → 2143).

### Notlar
- Üst proje career-ops, Next.js `web/` uygulamasının Takip İzleyicisi sayfası (#1422) ve arka uç PDF render'ı (#2182) ile v1.24.0'ın ötesine geçti — taşınmadı: web-ui'nin zaten kendi takip aktarımı ve PDF çalıştırıcıları var ve alttaki `followup-cadence.mjs` sağlamlaştırması kabuk-açma aktarımı üzerinden bedavaya geliyor. `set-status.mjs` / `tracker-utils.mjs` değişiklikleri CLI-dahilidir ve yansıtılmıyor.

## [1.132.0] — 2026-07-31

### Değiştirildi
- **`#/scan` sonuç-render alt sistemi `public/js/lib/scan-results.js`'e çıkarıldı** (dosya-boyutu-sözleşmesi borcu — `public/js/views/scan.js` ~1254 satıra kadar büyümüştü). Alt sistem (`renderResults`, `buildChipRow`, `getRows`, satır/faset oluşturucuları, seçenek boyacıları ve `FALLBACK_SOURCES` kayıt defteri aynası) görünümün sağladığı bir bağlam nesnesini kapsayan bir `window.ScanResults.create(ctx)` fabrikasına taşındı. **Davranış değişikliği yok** — fonksiyonlar birebir taşındı, kapatma değişkenleri `ctx.*`'e yeniden bağlandı; `scan.js` artık ~906 satır (800 satırlık hedefe doğru ikinci bir çıkarma geçişi planlanıyor).
- Kaynak-statik testler her iki dosyayı `tests/helpers/scan-src.mjs::loadScanSrc()` üzerinden okuyor; `tests/scan-fallback-sources.test.mjs` artık kayıt defteri aynasını `scan-results.js`'ten okuyor.
- **Yeni tarayıcı-içi regresyon kapısı** — `tests/playwright-scan-filters.mjs` hazır bir `data/last-scan.json` tohumluyor ve her `#/scan` filtresini çalıştırarak tam satır sayılarını doğruluyor (`npm run test:e2e:browser`); bunun için kararlı filtre kimlikleri (`#scan-filter-*`, `#scan-apply`) eklendi.
- README "En son sürüm" afişi tek satırlık bir özet + tam changelog'a bir bağlantıya indirildi (uzun çok-sürümlü anlatı duvarı kaldırıldı). Tüm 17 yerelleştirmede uygulandı.

## [1.131.2] — 2026-07-31

### Değiştirildi
- **`app.css` üç sıralı stil sayfasına bölündü** (dosya-boyutu-sözleşmesi borcu — tek dosya ~1990 satıra kadar büyümüştü, 800 satırlık sert hedefin çok üzerinde). Artık `app.css` (~672 — erişilebilirlik, tasarım token'ları/tema, kenar çubuğu, ana içerik, düğmeler, içerik kabuğu), **`components.css`** (~595 — kartlar, ızgaralar, sayfalayıcı, rozetler, tablolar, formlar, günlük/konsol, markdown, dil değiştirici, çip filtresi, bağlantı afişi) ve **`overlays.css`** (~737 — toast, bildirim çekmecesi, modal, çeşitli/duyarlı, `[dir="rtl"]` aynası, docs-fab, usage-hud), her biri sert sınırın içinde.
  - Kesim **bitişik ve sırayla** yapıldı, böylece kaskad bölünmeden önceki dosyayla **bayt bayt aynı**; `index.html` üçünü sıralı `<link>`ler olarak yüklüyor. **Davranış, biçimlendirme veya i18n değişikliği yok.**
  - CSS doğrulayan testler artık birleştirilmiş içeriği paylaşılan bir `tests/helpers/css.mjs::loadAppCss()` yardımcısı üzerinden okuyor. Yeni `tests/css-modularization.test.mjs` bölünmeyi kilitliyor (dosyalar var · her biri ≤ 800 satır · index.html bağlantı sırası) → paket **2138**. Tarayıcıda doğrulandı: üç stil sayfası da ayrıştırılıyor ve kuralları uygulanıyor.

## [1.131.1] — 2026-07-31

### Düzeltildi
- **v1.130.0'daki iki kaynağın adaptör ana bilgisayar sabitleme tutarlılığı** (kod incelemesi takip işleri, derinlemesine savunma; geçerli girdiler için davranış değişikliği yok):
  - **`a16z-speedrun-talent` adaptörü** artık `api:` / `a16z-speedrun-talent:` geçersiz kılmasını `buildEndpoint`'te yeniden doğruluyor (HTTPS + tam ana bilgisayar `speedrun-talent-network.com`) ve başarısız olduğunda kanonik beslemeye geri dönüyor — `cryptocurrencyjobs` adaptörüyle parite, böylece ana bilgisayar dışı bir değer asla getirme yuvasına ulaşmıyor (önceden yalnızca getirme zamanındaki `assertSpeedrunUrl` koruyucusuna güveniyordu). Tam ana bilgisayar kontrolü artık koruyucu ve adaptör tarafından paylaşılan tek, dışa aktarılmış bir **`SPEEDRUN_TALENT_HOST_RE`**.
  - **`cryptocurrencyjobs` ayrıştırıcısı** — `cleanUrl` artık `assertCryptocurrencyJobsUrl` ve adaptör geçersiz kılmasıyla aynı tam eşleşen ana bilgisayar koruyucusunu kullanıyor (önceden alt alan adlarını kabul eden `endsWith` idi). Ayrıştırıcı asla SSRF koruyucusundan daha izin verici değil: bir `sub.cryptocurrencyjobs.co` ilan bağlantısı düşürülüyor.
  - +2 test → paket **2135**.

## [1.131.0] — 2026-07-31

### Eklendi
- **`#/tracker` CRM aşama-sekmesi panosu** (üst projenin web uygulamasının `/pipeline` görünümünden taşındı). İzleyicinin huni-çipi çubuğu + durum açılır menüsü bir **aşama-sekmesi şeridi** ile değiştirildi: bir **Tümü** sekmesi artı her kanonik durum için bir sekme — **Evaluated · Applied · Responded · Interview · Offer · Rejected · Discarded · SKIP · Hired** — her biri canlı bir tüm-geçmiş sayısı gösteriyor, **sıfır sayılı aşamalar dahil** olmak üzere, böylece tüm huni her zaman görünür kalıyor (CRM görünümü). Etkin sekme filtreyi yönlendirir; tekrar tıklamak Tümü'ne geri temizler. Satırlar puan-tonu, meşruiyet, PDF ve rapor olanaklarını korur ve şirket hücresi artık logolar etkinleştirildiğinde bir marka logosu gösterir (varsayılan olarak kapalı → sıfır ekstra istek).
  - Yeni salt-okunur rota **`GET /api/tracker/stages`** kanonik huniyi (sırayla etiketler) + bir takma-ad-katlama haritasını döndürür, `server/lib/states.mjs`'ten kaynaklanır (`templates/states.yml`, yerleşik yedekle) — böylece istemci **durum beyaz listesini asla sabit kodlamaz**. Eski parametresiz `GET /api/tracker` yanıtı değişmedi (yalnızca `{ rows }`).
  - Yeni saf, birim test edilmiş istemci kitaplığı **`public/js/lib/tracker-stages.js`** satırları sunucunun aşamalarına göre gruplandırır, başıboş markdown kalın yazısını ve yerelleştirilmiş takma adları (ör. `aplicado` → `Applied`) tolere eder. Sekmeler erişilebilir (role tablist/tab, aria-selected, ≥44 px dokunma alanı, her sekmenin erişilebilir adında sayılar). Yeni i18n anahtarı yok. Paket **2133**.

## [1.130.0] — 2026-07-31

### Eklendi
- **Üst proje career-ops v1.24.0'dan taşınan iki yeni tarama kaynağı** (işlem içinde, yeni bağımlılık yok; ikisi de `#/scan` Kaynak filtresinde ve cvstart.org açılış sayfasında görünüyor):
  - **a16z Speedrun** (`a16z-speedrun-talent`, #2231) — a16z Speedrun *yetenek ağı* panosu genelindeki JSON beslemesi. `speedrun-talent-network.com`'a ana bilgisayar sabitli, yalnızca HTTPS, sayfa sınırlı 0-indeksli sayfalama, şirket başına `q`/yapılandırma iş parçacığı, hataya karşı toleranslı.
  - **Cryptocurrency Jobs** (`cryptocurrencyjobs`) — Web3 iş panosu `cryptocurrencyjobs.co`, herkese açık RSS 2.0 beslemesi üzerinden alınıyor (kimlik doğrulamasız). İki geçişli XML varlık çözme, yalnızca uzaktan ilanlar, işveren başlık kuyruğundaki `"… at <Company>"` kalıbından ayrıştırılıyor.
  - Kayıt defteri toplamı artık **72 kaynak = 67 İngilizce + 5 Rusça** (`ALL_ADAPTERS` = 67 İngilizce portal adaptörü).

### Düzeltildi
- **`echojobs` — hibrit roller uzaktandan ayırt edilebilir kalıyor** (üst projenin #2258'ini yansıtıyor). Büyük/küçük harf duyarsız bir `hybrid` işareti artık `"<Şehir> · Hibrit"` (şehir yoksa yalnızca `Hibrit`) ve `workplaceType: 'Hybrid'` üretiyor, `Remote`'a indirgenmek yerine.
- **`radancy` — eski TalentBrew biçimlendirmesi + JSON sonuç-parçası taşıması** (üst projenin a3e6df9'unu yansıtıyor), enjekte edilebilir `opts.fetchJson` ile kapılı.

### Notlar
- **Taşınmadı — yalnızca CLI üst proje özellikleri.** career-ops v1.24.0'ün geniş CLI/mod yüzeyi web-ui'nin dışında kalıyor; web-ui bir görüntüleyici + ince yazma-geçişidir, bir mod barındırıcısı değil: uyumluluk/yargı bölgesi tabloları, kişi telefon rehberi + vCard, mülakat transkript-değerlendirmesi / çağrı platformu algılama, defter durum belirleme, sonuç kaydı, iki geçişli triyaj, iş ilanı benzerliği, sürümlü başvuru-CV yapı şeması, doctor Playwright-MCP algılama ve `portals/fix-slugs.mjs`. Üst projenin `scan.mjs`'inde yaşayan tarama-orkestrasyonu değişiklikleri — Interamt.de Playwright tarayıcısı, iCIMS ters-ATS tam taraması, ülke uygunluğu uzaktan filtresi, DNS arama hızlandırması, StepStone `rltr` yinelenen giderme ve tarama geçmişi normalleştirilmiş şirket sütunu — geçerli değil: web-ui EN/RU tarayıcılarını işlem içinde çalıştırır ve `scan.mjs`'e kabuk açmaz.
- **Zaten kapsanmış.** `role-matcher` aksan katlama düzeltmesi (#2209) v1.127.0'de taşınmıştı, bu yüzden burada no-op'tur.

## [1.129.1] — 2026-07-29

### Düzeltildi
- **v1.128/v1.129 web taşımalarına dair AI inceleme takipleri** (hepsi tavsiye niteliğinde, kaynağında düzeltildi): `job-facets.js` seviye önceliği (açık bir niteleyici artık yönetim kelimesini yener — `Senior Engineering Manager` → `senior`, önceden `lead`); `states.mjs` yedeği artık sabitlenmiyor (başarılı okuma belleğe alınır, yedek önbelleksiz döner — açılışta geçici olarak erişilemeyen üst proje sonraki çağrıda yeniden okunur) + mevcut ama bozuk dosyada `console.warn`; `score-tone.js` — puansız satır nötr (`muted`), kırmızı değil; `domainFromName()` `/api/logo` öncesi ASCII olmayan slug'ları atlar; +`tests/states.test.mjs` izolasyon koruması. +4 test → **2073**.

## [1.129.0] — 2026-07-29

### Eklendi
- **`#/scan` seviye faseti + yaş sütunu** — v1.128.0'de gelen `job-facets.js` kütüphanesi artık tarama arayüzüne bağlı (önceden yalnızca mantıktı). Yeni **Seviye** açılır menüsü her ilan başlığını lead/staff/senior/orta/junior/stajyer olarak sınıflar (`JobFacets.seniorityFromTitle`) ve sonuçlarda gerçekte olanlarla otomatik dolar (Ülke faseti gibi); seviye kelimesi olmayan başlıklar hep geçer. Kayıtlı aramalar, Sıfırla ve Uygula'da korunur. Tablo bir **Seviye** rozet sütunu ve token'sız bir **Yaş** sütunu (`bugün` / `Ng`, `JobFacets.daysSince`'ten) kazanır. 12 i18n anahtarı ×17, +3 test → **2069**.

## [1.128.0] — 2026-07-29

### Eklendi
- **Üst projenin kendi web uygulamasından (`../web/`, Next.js) dört çözüm taşındı**, saf JS/ESM ile yeniden yazıldı, yeni bağımlılık yok: (1) `server/lib/states.mjs`, izleyicinin durum sözlüğü için `templates/states.yml`'i canlı okur (CI yedeği) — her sürümdeki manuel beyaz liste yeniden senkronunu kaldırır; POST takma adları (İspanyolca/eski) kanonik etikete katlar, GET hunisi kanonik duruma göre gruplar; (2) ATS barındırmalı satırlarda şirket logoları — `domainFromName()` (~90 marka→alan adı); (3) `score-tone.js` — 4 kademeli puan tonu (≥4.2/3.8/3.0 + harf yedeği); (4) `job-facets.js` — seniority/source/days facet'leri. +21 test.

### Notlar
- Taşınmadı (yalnızca kavram): üst projenin ajan eylem katmanı (`actions/registry.ts` + `api/assistant/route.ts`) — `docs-fab` bir yardımcı pilota dönüşürse diye taslak. Yeni kaynak yok (kayıt defteri **70**), i18n/help değişikliği yok.

## [1.127.0] — 2026-07-29

### Eklendi
- **Üç yeni tarama kaynağı (career-ops v1.23.0 paritesi)** — kayıt defteri artık **70 adaptör (65 EN + 5 RU)** sunuyor: **Flowxtra** (kimlik doğrulamasız genel toplayıcı), **VDAB** (Flaman kamu istihdam servisinin anahtar kelime API'si) ve **iCIMS** (`careers-<tenant>.icims.com` portalları, `jibeapply`'dan ayrı). Ayrıca **Cursor** CLI listesine geri döndü (parent #2115): `cli-detect` artık `cursor`'ı algılıyor (**10 araç**), liste help/README/config ×17'de geri getirildi.

### Düzeltildi
- **agenticjobs** HTML kazımadan REST API'ye geçti (#2167); `location.name` yalnızca çalışma modeliyken **Greenhouse** şehri `/offices`'ten kurtarıyor (#2104); **role-matcher** paritesi (#1933/#2164/#2009: MTS öneki, `product` taban çizgisi, aksan katlama, alt-taban uyuşmazlığı).

### Notlar
- **Taşınmadı.** v1.23.0'ün çoğu web-ui'nin kullanmadığı CLI/pano yüzeyi (batch-tailor, discover-ats, NL/PT modları, PDF temaları, Go panosu, updater/doctor); aktarma betikleri değişmiyor. Üst projenin VERSION'ı → **1.23.0**.

## [1.126.1] — 2026-07-25

### Düzeltildi
- **v1.126.0 yeniden senkronunun kaçırdığı iki CLI listesi kayması** — (1) `#/config` **API keys** sekmesi girişi (`config.providerModelNote`, i18n ×17) yalnızca 7 CLI listeliyordu — artık **Antigravity** ve **Grok Build** OpenCode'dan sonra ekleniyor; (2) yardım kılavuzundaki (×17) ikinci karşılaştırma tablosu satırı ve CI'da derlenen site help'i hâlâ `Inside Claude Code / Codex / Cursor / Gemini CLI` (eski **Cursor** içeren küme) diyordu — artık tam liste. İkisi de v1.126.0 taramasının desenlerinin kapsamadığı eğik çizgi/orta nokta ayırıcıları kullanıyordu. i18n anlık görüntüsü yeniden üretildi; paket **1969**'da kalıyor.

## [1.126.0] — 2026-07-25

### Eklendi
- **AI CLI araçları sekmesi artık career-ops'un 8 birinci sınıf CLI'sinin tümünü algılıyor** — `#/config` listesi üst projenin `docs/SUPPORTED_CLIS.md` dosyasıyla senkronlandı: `server/lib/routes/cli-detect.mjs` **Grok Build CLI** (`grok`) ve **Kimi CLI** (`kimi`) kazanıyor ve Antigravity artık önce kanonik `agy` ikili dosyasını yokluyor. Salt-okunur PATH taraması artık **9 araç** bildiriyor; bulunan bir ikiliyi hâlâ asla çalıştırmıyor.

### Değiştirildi
- **career-ops.org/docs ile dokümantasyon yeniden senkronu** — her doküman yüzeyi üst projenin canlı sayfalarıyla (31'inin tümü okundu) karşılaştırıldı. Kanonik AI asistan listesi (help ×17 + README ×17) artık 8 birinci sınıf CLI'yi — Claude Code, Codex, OpenCode, Antigravity CLI, Grok Build CLI, Qwen Code, Kimi, GitHub Copilot CLI — ve Gemini CLI'yi (eski sarmalayıcı) listeliyor. Yardım paketleri 29 H2 / 105 H3 yapısını koruyor.

## [1.125.4] — 2026-07-23

### Değiştirildi
- **site bağımlılıkları** (dependabot #151–#153) — `site/` içinde `sharp` 0.34.5→0.35.3, `svgo` 4.0.1→4.0.2, `fast-uri` (dev) 3.1.3→3.1.4; Astro derlemesi yeşil, SPA/sunucu etkilenmedi.

### Notlar
- **Üst proje parite taraması (career-ops `37d17ec..254764a`, v1.22.0 sonrası)** — taşınacak bir şey yok: `set-status` yanlış-satır korumasi (#2108) yalnızca CLI (web-ui'de izleyici satırları arayüzde açıkça seçilir ve hiçbir rota `set-status.mjs`'i çağırmaz), yerelleştirilmiş modlardaki Risk Summary (#2109) web-ui'nin hiç okumadığı `modes/<lang>/` dosyalarına dokunur (yalnızca üst düzey `modes/*.md` okunur), `update-system` manifest doğrulaması (#2111) yalnızca güncelleyiciye aittir, gerisi üst proje belgeleridir (Türkçe README, SIGNATURES ×4, SCRIPTS.md, es aksanları). Üst projenin VERSION'ı **1.22.0** olarak kalır — `parentVersion` değişmedi.

## [1.125.3] — 2026-07-23

### Düzeltildi
- **Danca ve Hintçe LLM istemleri İngilizce yanıt veriyordu** (kullanıcı bildirimi) — `server/lib/prompts.mjs` içindeki `LOCALE_NAMES` ve beş `SCAFFOLD_STRINGS` bloğu `da` ve `hi` için hiç genişletilmemişti; `resolveLocale()` `en`'e düşüyor ve her AI istemi — deep research (canlı ve manuel), modlar, değerlendirme, mülakat, networking, CV Studio — bu iki dilde `# Output language` yönergesini kaybediyordu. Artık ikisi de birinci sınıf: dil yönergesi + yerelleştirilmiş iskele. `tests/locale-scaffold.test.mjs` içindeki regresyon kapısı artık sabit kodlu 12 yerine kanonik 17 dillik listeyi tarıyor ve yeni yapısal parite kapısı İngilizceye düşen her iskele anahtarını başarısız sayıyor — gelecekte `prompts.mjs`'i atlayan bir dil artık yayınlanamaz (+12 test, paket artık **1969**).

## [1.125.2] — 2026-07-22

### Düzeltildi
- **Gemini ile derin araştırma: HTTP 502 (`MALFORMED_FUNCTION_CALL`)** (#145, [@Alien10140](https://github.com/Alien10140) katkısı) — canlı `/api/deep` istemi modele "Use WebFetch / WebSearch" komutunu ve brifi dosyaya kaydetmesini söylüyordu; ancak araçsız API sağlayıcılarında araç kanalı yoktur ve Gemini metin yerine bir işlev çağrısıyla yanıt veriyor, bu da boş bir HTTP 502 olarak görünüyordu. `buildDeepPrompt` ve `bundleProjectContext` artık bir `headless` bayrağı alıyor: canlı çalıştırmalar (Anthropic/Gemini/yedek kaskadı) brifi gömülü bağlamdan yazan araçsız bir istem alırken, Claude Code için kopyala-yapıştır istemi araç talimatlarını koruyor. `tests/critical-fixes.test.mjs` içinde +1 test.

### Değiştirildi
- **Gemini varsayılanları, kullanımdan kaldırılan `gemini-2.0-flash` modelinin ötesine taşındı** (#144, [@Alien10140](https://github.com/Alien10140) katkısı) — Yapılandırma açılır listesi, `gemini.mjs` içindeki sunucu yedeği (ipucuyla sessizce çelişiyordu), OpenRouter yedek zinciri, `config.geminiModelHint` ×17 ve yardım kılavuzu ×17 artık tutarlı biçimde **`gemini-3.6-flash`** gösteriyor. Yeni kayma kapısı `tests/gemini-default-model.test.mjs` (+5 test) tüm yüzeyleri aynı değişmeze sabitliyor — paket artık **1957 test**.

## [1.125.1] — 2026-07-21

### Düzeltildi
- **SuccessFactors: çok markalı RMK kiracıları marka yollarını koruyor** (üst proje #2099, v1.22.0 sonrası) — birkaç satın alınmış markayı tek bir paylaşılan RMK örneği üzerinden yürüten holding şirketleri, bunları bir yol segmentiyle birbirinden ayırt eder (`careers.nemetschek.com/Bluebeam/` vs `…/Vectorworks/`); adaptör yapılandırılmış URL'yi daha önce kök alanına indirgiyor ve sessizce yalnızca ana markanın ilanlarını tarıyordu. Uç nokta artık marka önekini koruyor ve yalnızca sondaki bir `/search/` veya `/tile-search-results/` segmentini kırpıyor, böylece hiçbir şey kendi üzerine katlanmıyor; tek domainli kiracılarda tek bir bayt bile değişmiyor. Yeni dışa aktarılan `resolveTenantBase` yardımcı fonksiyonu + `tests/sources-successfactors.test.mjs` içinde 1 taşınmış test bloğu.

## [1.125.0] — 2026-07-21

### Eklendi
- **cvstart.org: Landingde "İş kaynakları" bölümü** — ekran görüntüleri ile karşılaştırma listesi arasına eklenen yeni bir bölüm, **67 tarama kaynağının tümünü tıklanabilir çipler olarak** listeler (62 İngilizce pano/ATS + kendi alt başlığı altında 5 Rus panosu), her biri kaynağın herkese açık sitesine bağlanır. Liste, build sırasında canlı adaptör kayıt defterinden senkronize edilir (`sync-assets.mjs` → `facts.sources`), böylece uygulamadan asla sapamaz; `Sources.astro` içindeki düzenlenmiş bağlantı haritası yeni `tests/site-sources.test.mjs` ile korunur. Üst gezinme çubuğu yeni bir **Kaynaklar** çapası kazandı; 4 yeni site i18n anahtarı ×17. Ayrıca, hâlâ `hi` eksik olan landing JSON-LD `inLanguage` listesi düzeltildi.

## [1.124.0] — 2026-07-21

### Eklendi
- **Beş tarama kaynağı** (üst proje v1.22.0 paritesi, #1808/#1572/#2024/#2055) — **Welcome to the Jungle** (pano geneli JSON API), **Agentic Engineering Jobs** (agentic/yapay zeka mühendisliği panosu), **Jobvite** (sıfır-kimlik-doğrulamalı kiracı-başına ATS), **Gem** (kiracı-başına ATS) ve **Alibaba Group** (kariyer JSON API'si, Meituan/Tencent kalıbı). Her biri ana bilgisayara sabitlenmiş, CI-izole bir kaynak + adaptör çifti; kayıt artık **67 adaptör (62 İngilizce + 5 Rusça)** gönderiyor; `#/scan` Kaynak açılır menüsü yedeği ve onun sapma kapısı güncellendi; beş yeni test paketi `tests/sources-{wttj,agenticjobs,jobvite,gem,alibaba}.test.mjs`.

### Düzeltildi
- **Arbeitsagentur: `homeofficetyp` yalnızca `VOLLSTAENDIG` olduğunda tüm ülke çapında uzaktan sayılıyor** (üst proje #1981) — `homeoffice=nv_true` sorgusu hibrit rolleri de döndürüyordu, bu yüzden uzaktan geçişi artık her sonucu küçük gruplar hâlinde ilan detayları uç noktasına karşı doğruluyor ve hataya karşı temkinli davranıyor (bir sorgu hatası ilanın gerçek şehrini korur, böylece konum filtreleri yine de uygulanmaya devam eder).
- **SmartRecruiters: herkese açık iş URL'leri `/postings/` olmadan oluşturuluyordu** (üst proje #2047) — bağlantılar artık, herkese açık sitesi bu segmenti atlayan kiracılar için 404 yerine herkese açık ilan sayfasına iniyor.

### Notlar
- Üst proje v1.22.0 ayrıca web-ui'nin shell ile çağırmadığı veya zaten kapsadığı CLI tarafı değişiklikler gönderdi: zh-CN CV şablonu + PDF tipografisi, `/expand` modu, sağlayıcı prompt-önbelleği ince ayarları (Gemini/OpenAI/Ollama), adım başına token dökümü (web-ui'nin kendi kullanım göstergesi var), tracker'ın yazıcı-kilidi serileştirmesi (web-ui yazmaları v1.21'den beri zaten `withFileLock` üzerinden yönlendiriyor), tarama `visa_filter`'ı + mutlak yayın-tarihi CLI bayrakları (web-ui'nin kendi "Posted within" yaş filtresi var) ve görülen-kaynak tekilleştirme tohumlaması (web-ui tarayıcısı kendi tarama-geçmişi tekilleştirmesini tutuyor).

## [1.123.0] — 2026-07-17

### Eklendi
- **Oracle Recruiting Cloud tarama kaynağı** (üst proje v1.21.0 paritesi, #1929) — Oracle Fusion/ORC kariyer sitelerinin (JPMorgan Chase, Oracle, BNY Mellon, American Express, Honeywell, …) sıfır-kimlik-doğrulamalı `recruitingCEJobRequisitions` REST API'si: `*.fa[.<bölge>][.ocs].oraclecloud.com` ana bilgisayarına sabitlenmiş, site numarası her takip edilen şirketin `careers_url` alanından çözümlenmiş, sabit bir sayfa üst sınırıyla offset sayfalandırma ve WAF'a duyarlı tarayıcı-benzeri başlıklar. Kayıt artık **62 adaptör (57 İngilizce + 5 Rusça)** gönderiyor; `#/scan` Kaynak açılır menüsü yedeği ve onun sapma kapısı güncellendi; yeni CI-izole test paketi `tests/sources-oraclecloud.test.mjs`.

### Düzeltildi
- **Repost dedektörü: temel başlıklar özelleştirilmiş-ek adı olan kardeşlerinden ayrı kalıyor** (üst proje #1922) — "Senior Analytics Engineer" artık "Senior Analytics Engineer, People Analytics" ile kümelenmiyor: bir başlığın belirteçleri diğerinin belirteçlerinin kesin bir alt kümesi olduğunda ve fazladan belirteç gerçek bir uzmanlaşma ise (temel bir sözcük değil), iki ilan ayrı ayrı yayınlanabilir açık pozisyonlar olarak ele alınıyor. Yeniden yayınlama açıklamaları ("(Repost)", "relisted") artık anlamsız gürültü olarak durak-sözcük listesine alındı. `tests/detect-reposts.test.mjs`'de +2 doğrulama.

### Notlar
- Üst proje v1.21.0 ayrıca web-ui'nin shell ile çağırmadığı veya zaten kapsadığı CLI tarafı değişiklikler gönderdi: tekrar-şirket yeniden başvuru uyarısı (web-ui'de v1.84.0'dan beri yeniden-başvuru soğuma süresi var), ön yazı `--format`/`--report` bayrakları, mülakat kırmızı-bayrak / panel-istihbaratı / gelmeme e-postası prompt modları, tarama güven-sinyali & portal sağlığı kalıcılığı (web-ui kendi süreç-içi tarayıcısını `trust-validator` ile ve Portallar sağlık sayfasıyla çalıştırıyor) ve istatistik/maaş-farkı uzantıları (salt okunur ve arızaya-toleranslı olarak aktarılıyor).

## [1.122.0] — 2026-07-16

### Eklendi
- **Hintçe (हिन्दी) — 17. dil** — tam arayüz sözlüğü (~1.110 anahtar), eksiksiz uygulama içi yardım kılavuzu (29 H2 / 105 H3 paritesi), `README.hi.md`, yeni bir `CHANGELOG.hi.md` (de/it/tr emsalini izleyerek v1.122.0'dan başlıyor), cvstart.org landing + Metodoloji/Lisans/Değişiklik Günlüğü/Yardım sayfaları, dil değiştirici (🇮🇳), tarayıcı diline göre otomatik algılama ve yerelleştirilmiş bir dashboard ekran görüntüsü. Her ×16 parite kapısı artık ×17 çalışıyor: i18n sözlük paritesi + anlık görüntü, yardım H2/H3 kapıları, CHANGELOG paritesi, site `check-i18n` ve Playwright yerel ayar taraması.

## [1.121.0] — 2026-07-16

### Eklendi
- **cvstart.org: Metodoloji, Lisans ve Değişiklik günlüğü sayfaları** — landing sayfası, mevcut Karşılaştırma bloğunun yanına 16 dilin tümünde üç yeni bölüm kazandı: **/methodology/** (altı boyutlu 0.0–5.0 puanlama ölçeği, 4.0 başvuru eşiği ve asla yapılmayacak kurallar — [career-ops.org/methodology](https://career-ops.org/methodology) adresinin yerelleştirilmiş bir özeti), **/license/** (NOTICE.md işaretçisiyle birlikte resmi MIT metni) ve **/changelog/** (bu dosya, depodaki 16 çevrilmiş CHANGELOG'dan yerel ayara göre işlenir). Yeni başlık **Metodoloji** girdisi ve altbilgi Kaynaklar bağlantıları; `sync-assets.mjs` artık derleme sırasında CHANGELOG ×16 ve LICENSE'ı siteye eşitliyor, böylece sayfalar depodan asla sapamaz.
- **Dokümanlar genelinde metodoloji bağlantıları** — README (16 dilin tümü), uygulama içi yardım kılavuzu §1 kanonik listesi (16 dilin tümü) ve wiki artık mevcut [career-ops.org/docs](https://career-ops.org/docs) kılavuzlarının yanı sıra [career-ops.org/methodology](https://career-ops.org/methodology) adresine (ayrıca SSS ve sözlüğe) bağlantı veriyor.

### Değiştirildi
- README sürüm banner'ı ve rozetleri güncellendi (testler 1850, sürüm v1.121.0) — banner hâlâ v1.119.5'i duyuruyordu.

## [1.120.0] — 2026-07-16

### Eklendi
- **CareerOps Manifestosu** (üst proje v1.20.0 paritesi) — üst proje CareerOps Manifestosu'nu (`MANIFESTO.md` · [career-ops.org/manifesto](https://career-ops.org/manifesto)) yayınladı ve şimdi bunu README'sinden, güncelleyicisinden ve Go dashboard'ından öne çıkarıyor. Web-ui de aynısını yapıyor: yeni bir kenar çubuğu altbilgi bağlantısı manifesto sayfasını açıyor (16 yerel ayarın tümünde yeni `footer.manifesto` i18n anahtarı), uygulama içi yardım kılavuzu 16 dilin tümünde §29 "CareerOps Manifestosu"nu kazandı, README manifestonun ne olduğunu ve nasıl imzalanacağını açıklıyor ve cvstart.org landing altbilgisi de ona bağlantı veriyor.

### Notlar
- Üst proje v1.20.0 ayrıca `upskill` hedefli modun bilinen-beceri bastırmasını düzeltti, `scan --json` stdout'unun ayrıştırılabilir kalması için dotenv'i sessizleştirdi ve bir rol başlığının madde işaretleriyle birlikte kalması için HTML CV şablonunu düzeltti — bunlar web-ui'nin shell ile çağırmadığı CLI tarafı yüzeyler; web-ui kodunda değişiklik gerekmedi.

## [1.119.5] — 2026-07-13

### Düzeltildi
- **Landing'deki dil düğmesi artık satır atlamıyor** — v1.119.2'deki bayraklarla başlıktaki değiştirici etiketi (ör. «🇷🇺 Русский») dar masaüstü genişliklerinde üç satıra kadar bölünebiliyordu; değiştirici etiketi ve açılır menüdeki tüm seçenekler artık `whitespace-nowrap` — bayrak + endonim her zaman tek satırda. Altbilgideki dil listesi katı iki sütunlu ızgaradan tek satırlık öğelerden oluşan sarmalanan bir sıraya geçti — «🇧🇷 Português (Brasil)» da artık adın ortasından bölünmüyor.

## [1.119.4] — 2026-07-13

### Değiştirildi
- **LICENSE yazarı belirtiyor** — telif satırı artık şöyle: *Sergei Emelianov (Fighter90) <https://sergey-cv.com> and career-ops-ui contributors* (kanonik MIT metni dokunulmadı). Yeni **NOTICE.md** lisanslamayı ayrıntılı açıklıyor: telif hakkını kim tutuyor, MIT izni tam olarak neyi kapsıyor (kod, belgeler, çeviriler, landing, wiki), neyi KAPSAMIYOR (çalışma zamanı verileriniz, üst proje, iş ilanı içerikleri, ticari markalar), üçüncü taraf bileşen tablosu (express/js-yaml — MIT; Astro/Tailwind — MIT; Figtree ve JetBrains Mono yazı tipleri — SIL OFL 1.1; sharp — Apache-2.0) ve isteğe bağlı bir atıf satırı.

## [1.119.3] — 2026-07-13

### Eklendi
- **SECURITY.md** — CONTRIBUTING'in işaret ettiği güvenlik politikası artık mevcut: desteklenen sürümler, özel bildirim akışı (depoda GitHub **private vulnerability reporting artık etkin** — Security sekmesi → «Report a vulnerability»), localhost'a bağlı tek kullanıcılı bir uygulamanın tehdit modeli (kapsamda: düşmanca ilanlar üzerinden XSS / SSRF / path traversal / gizli anahtar sızıntısı / CSP zayıflatma; kapsam dışı: kendi localhost'una DoS ve üst projenin sorunları) ve gözden geçirenler için sertleştirme taban çizgisi.

## [1.119.2] — 2026-07-13

### Eklendi
- **CONTRIBUTING.md** — landing'in ve README'nin başından beri bağlantı verdiği katkıda bulunan rehberi artık mevcut: kurulum, proje haritası, katı güvenlik/no-build kuralları, test katmanları, tarama kaynağı eklemek için «iki kayıt» walkthrough'u, ×16 i18n sözleşmesi, commit/PR kuralları ve sürüm süreci.
- **Landing'de dil bayrakları** — cvstart.org dil değiştirici, alt bilgideki dil ızgarası ve «kendi dilinde oku» banner'ı artık her yerel ayarın bayrağını endoniminin yanında gösteriyor (uygulamanın dil `<select>`'iyle aynı bölgesel gösterge seti; bayrak glifleri olmayan yerlerde bölge harflerine düşer).
- **Landing altbilgi düzeltmeleri** — ölü Discussions bağlantısı (özellik depoda etkin değil) artık projenin **wiki**'sine gidiyor ve altbilgi yazarı belirtiyor: **Sergei Emelianov** ([sergey-cv.com](https://sergey-cv.com/) · [LinkedIn](https://www.linkedin.com/in/sergey-emelyanov-in-job/)).

## [1.119.1] — 2026-07-13

### Düzeltildi
- **`#/scan` kaynak filtresi kayda yetişti** — Source açılır menüsünün arkasındaki statik `FALLBACK_SOURCES` listesi (yalnızca `GET /api/scan/sources` ulaşılamazken kullanılır) v1.87.0'dan beri sessizce geride kalmıştı: çevrimdışı fallback'te 20 sağlayıcı eksikti (Amazon, Avature, SAP SuccessFactors, Get on Board, Dassault Systèmes, beesite, HigherEdJobs, JibeApply (iCIMS), softgarden, Cornerstone, Phenom, Radancy, Deutsche Bahn, EchoJobs, TKMS, Heckler & Koch, Rheinmetall, LaraJobs ve yeni Meituan / Tencent). Tüm **61** ile eşitlendi ve artık istemci listesi sunucu kaydından saptığında CI'ı düşüren bir kayma testiyle korunuyor (değerler VE etiketler). +1 test (**1845**).

## [1.119.0] — 2026-07-13

Üst career-ops **v1.19.0** paritesi + cvstart.org landing yenilemesi.

### Eklendi
- **2 yeni tarama sağlayıcısı** — Meituan (`zhaopin.meituan.com`) ve Tencent (`careers.tencent.com`): Çin tech kartlarının kimlik doğrulamasız açık JSON API'leri, host'tan tespit edilir veya açık `provider:` ile seçilir; anahtar kelime başına sunucu tarafı arama, sayfalama ve URL'ye göre tekilleştirme — artık **61 adaptör** (56 EN + 5 RU). +20 test (**1844**).
- **Landingde katkıda bulunanlar bloğu** — cvstart.org, kod katkısı yapan herkesin avatarını gösterir (build sırasında GitHub `/contributors` API'si, botlar filtrelenir), 16 dilin tümünde yerelleştirilmiştir ve tam katkı grafiğine bağlantı verir.
- **Landingde canlı GitHub yıldız sayacı** — başlıktaki rozet artık her ziyarette GitHub API'sinden istemci tarafında yenilenir (build anlık görüntüsü fallback olarak kalır) ve haftalık zamanlanmış Pages yeniden derlemesi anlık görüntü + katkıda bulunanlar listesini taze tutar; CI'daki API çağrıları token ile doğrulanır.

### Düzeltildi
- **Workday CXS istekleri tarayıcı benzeri başlıklar taşır** (üst #1813) — Cloudflare arkasındaki kiracılar (canlıda görüldü: geico) olağan UA/`accept-language`/`origin`/`referer` içermeyen isteklere 500 döner; fetch'leyici artık origin + site slug'ını CXS URL'sinin kendisinden türetir. Glints istekleri aynı tarayıcı UA + origin/referer'ı kazandı; ikisi de `http-json.mjs` içindeki ortak `BROWSER_LIKE_USER_AGENT` sabitinden gelir.

## [1.118.4] — 2026-07-10

### Düzeltildi
- **hh.ru taramaları Rus IP'sinden 0 sonuç döndürüyordu (bölgesel alt alan bağlantıları)** — Rus konut IP'sinden hh.ru aramayı 302 ile bölgesel bir alt alana (`sochi.hh.ru`, `spb.hh.ru`, …) yönlendiriyor ve ilan bağlantılarını o alt alanda döndürüyor. Ayrıştırıcı başlık bağlantısını sabit `https://hh.ru/vacancy/` ana makinesinde arıyordu ve bölgesel olanların **hiçbiriyle** eşleşmiyordu; tamamen çalışan bir tarama sessizce 0 kaydediyordu. Artık herhangi bir `*.hh.ru` ana makinesini kabul ediyor (`adsrv.hh.ru/click?…` reklamları hâlâ hariç tutuluyor — `/vacancy/<id>` yolu yok) ve her sonuç URL'sini `https://hh.ru/vacancy/<id>` biçimine normalleştiriyor. Canlı doğrulandı: önceden 0 veren bir `sochi.hh.ru` sayfasından artık 17 gerçek ilan ayrıştırılıyor. +1 test (**1824**).

## [1.118.3] — 2026-07-10

### Düzeltildi
- **hh.ru sessizce 0 sonuç döndürüyordu (VPN doğrulama ara sayfası)** — hh.ru artık VPN/proxy olarak işaretlediği ağları (datacenter IP'leri) **HTTP 200** ile tek bir ilan kartı bile içermeyen `/vpncheeck` ara sayfasına (“VPN мешает работе сайта”) 302 ile yönlendiriyor; bu yüzden tarama hiçbir hata vermeden 0 raporluyordu. Tarayıcı artık yönlendirmeyi yanıtın nihai URL'sinden algılıyor, hh.ru'yu çalıştırmanın geri kalanı için devre dışı bırakıyor ve dürüst bir ipucu yazıyor: trafik gerçekten konut tipi bir IP üzerinden çıkmalı — sistem genelindeki bir VPN/proxy, tarayıcıdaki anahtar kapalıyken bile etkin kalabilir. +1 test (**1823**).

## [1.118.2] — 2026-07-10

### Bakım
- **Landing takibi (#118)** — `site/README.md` Astro 7 ile uyumlandı (#116'daki güvenlik yükseltmesi), kullanılmayan import kaldırıldı ve landing derleme betikleri için **+4 çalıştırılabilir koruma** eklendi: i18n parite kapısı bozuk bir sözlükte kanıtlanabilir şekilde başarısız olur ve `sync-assets` asla `site/` dışına yazmaz — takım **1822**. İki CodeQL uyarısı çözüldü (biri kaynakta düzeltildi, biri amaçlanan derleme davranışı olarak reddedildi).

## [1.118.1] — 2026-07-10

### Düzeltildi
- **Rusya dışından hh.ru taraması** — hh.ru artık halka açık arama sayfalarında Rus olmayan IP'lere **HTTP 451** (bölgesel yasal engel) döndürüyor. Tarayıcı 451'i 403 gibi ele alır: ilk engelden sonra hh.ru çalıştırmanın geri kalanı için devre dışı bırakılır ve günlüğe Rus IP'si / VPN çıkışına işaret eden dürüst bir satır yazılır; kalan sorgular ve diğer RU kaynakları boşa gitmez. Yardım §7 tüm 16 dilde güncellendi. +1 test (**1818**).

## [1.118.0] — 2026-07-09

Üst career-ops **v1.18.0** parite paketi.

### Eklendi
- **9 yeni tarama sağlayıcısı** — Cornerstone OnDemand (`csod`), Phenom (`phenom`), Radancy (`radancy`), Deutsche Bahn (`deutschebahn`), EchoJobs (`echojobs`), TKMS (`tkms`), Heckler & Koch (`hecklerkoch`), Rheinmetall (`rheinmetall`), LaraJobs (`larajobs`) — artık **54 adaptör**. Lever adaptörü ayrıca EU tenant panolarını (`jobs.eu.lever.co`) algılar.
- **Takipçide `Hired` durumu** (üst projenin `states.yml` paritesi): kabul edilen teklifler kendi kanonik durumunu, kutlama rozetini ve `#/tracker` üzerinde «iş bulundu» banner'ını alır; huni ve dönüşüm grafikleri onu tüm aşamalardan geçmiş sayar.
- **`#/stats` içinde Toplam sekmesi** — üst projenin `stats.mjs` dosyasının salt okunur aktarımı (toplam takipçi özeti, kümülatif huni oranları, tarayıcı toplamları, portal kapsamı) artı `salary-gap.mjs` ücret gözlemleri (istenen vs ilan edilen vs gerçek, başvuru başına). Yeni rotalar `GET /api/stats/lifetime` ve `GET /api/stats/salary-gap` — sıfır token maliyetli shell-out, üst proje yokken güvenli `{available:false}` düşüşü.
- 16 dilin tamamında 28 yeni i18n anahtarı; yardım kılavuzu §14/§26 tüm dillerde güncellendi.

### Testler
- +38 birim testi (üç sağlayıcı parite paketi + aktarım/durum rotaları) — toplam **1817**.

## [1.117.2] — 2026-07-06

**Parite shell-out'ları için boş izleyici düzeltmesi.** İzleyicide henüz başvuru yokken üst betikler kod 1 ve yapılandırılmış `{error}` JSON ile çıkar; takip panosu ve ret kalıpları sekmesi bunu "script-error" olarak gösteriyordu. Her iki rota artık bunu sağlıklı bir boş durum (`available:true, empty:true`) olarak iletir ve UI dürüst "henüz bir şey yok" mesajını gösterir. Gerçek bir üst projeyle canlı doğrulandı.

Yeni: yok.


## [1.117.1] — 2026-07-06

**v1.117.0 sertleştirmesi (CodeQL triyajı).** Üç shell-out uç noktası (`GET /api/followup`, `POST /api/followup/seed`, `GET /api/stats/patterns`) artık paylaşılan IP başına sınırlayıcıyı taşıyor (her istek bir alt süreç başlatır; loopback'te no-op). CV'ye ekle'nin URL metin çıkarımı etiketleri sabit noktaya kadar soyar, sonra kalan tüm `<`/`>` karakterlerini siler — LLM istem metni için kanıtlanabilir şekilde eksiksiz bir arındırma. Geçerli girdi için davranış değişikliği yok.

Yeni: yok.


## [1.117.0] — 2026-07-06

**Üst proje parite paketi — üst career-ops'un altı yeteneği UI'ya taşındı.** (1) `#/followup`'ta **kadans panosu**: `followup-cadence.mjs`'ten başvuru başına aciliyet (🔴/🟠/🟡/🔵) + **Takip tarihlerini ekle** düğmesi (`followup-seed.mjs --backfill`). (2) **Ret kalıpları**: dördüncü İstatistik sekmesi `analyze-patterns.mjs`'i (salt okunur) çalıştırır — sonuç dağılımı, öneriler, ATS sağlayıcısı başına ilerleme oranı. (3) **CV'ye ekle**: bir CV Studio kartı URL'yi veya yapıştırılan metni YALNIZCA o kaynağa dayanan ATS maddelerine çevirir (yalnız öneri, yazma yok; URL getirme SSRF korumalı). (4) **4 yeni tarama sağlayıcısı** — beesite, HigherEdJobs (RSS), JibeApply (iCIMS), softgarden — kayıt defteri artık **50 adaptör (45 EN + 5 RU)**, hepsi Scan açılır listesinde. (5) Apply kontrol listesine **eleme ön taraması** adımı. (6) **Reconcile çalıştırıcısı** (`/api/run/reconcile`). Shell-out rotaları üst betikler olmadan dürüstçe düşer.

- Yeni rota modülü `server/lib/routes/followup.mjs` (31.) + yeni rotalar + 8 source/adapter dosyası. Testler: 6 + 7 yeni; süit 1737 → 1750. 41 yeni i18n anahtarı ×16. Yardım §13/§17/§24/§26 ×16 genişletildi.

Yeni: `GET /api/followup`, `POST /api/followup/seed`, `GET /api/stats/patterns`, `POST /api/cv-studio/add-entry`, `POST /api/run/reconcile`.


## [1.116.0] — 2026-07-06

**Kullanım göstergesi yeniden yapıldı + ilk uçtan uca widget testi.** AI kullanım göstergesi (v1.114.0) düzeltildi ve doğru sabitlendi: artık **sol kenar çubuğunun altına sabitli** (tam kenar çubuğu genişliği, aynı yüzey) ve altta kendi yüksekliği kadar boşluk ayırarak **menü asla kapanmaz** — gezinme ve sürüm altbilgisi her zaman onun üstünde serbestçe kayar. **Canlı yenilenir** (her 15 sn, sekme odağında ve rota değişiminde) ve her pencere satırı artık her zaman %100 olan "pay" yerine gerçek **`<jeton> · <tahmini maliyet>`** gösterir (çubuklar 30 günlük pencereye göre ölçeklenir). Ayrıca: CV içe aktarıcısındaki kalıcı bir `typeof` bariyeri, tekrarlayan CodeQL tür karışıklığı yanlış pozitifini kaynağında kapatır ve yeni bir Playwright **uçtan uca testi** her iki kalıcı widget'ı gerçek bir tarayıcıda çalıştırır.

- `public/js/lib/usage-hud.js` + `app.css`, `server/lib/cv-import.mjs`. Testler: `tests/playwright-widgets.mjs` (2 E2E) + `tests/usage-hud.test.mjs` (10). Yardım §6 ×16 genişletildi.

Yeni: yok.


## [1.115.0] — 2026-07-06

**Tasarım rötuşu (muhafazakâr, mercan marka korundu).** Ortak tasarım sistemi üzerinde hafif bir ince ayar geçişi — yeniden yapılandırma yok, palet değişikliği yok. Pano metrik kartları artık üzerine gelince hafifçe yükselir ve mercan bir kenarlık kazanır (hızlı eylem karoları gibi); içerik kartları azıcık yükselir; primary / dark / danger düğmeleri derinlik için durağan bir gölge ve nazik bir hover yükselişi kazanır; büyük sayılar tabular-nums ile hizalanır; ve etkileşimli denetimler net 2px klavye halkasının arkasında yumuşak bir mercan odak halesi alır. Tüm hareket `prefers-reduced-motion`'a saygı gösterir ve hale denetimlerle sınırlıdır — asla küresel bir `*:focus-visible` değil.

- Yalnızca CSS (`public/css/app.css`); işaretleme, i18n, rota veya CSP değişikliği yok. Testler: `tests/design-polish-v1115.test.mjs` (5). Playwright ile canlı doğrulandı.

Yeni: yok.


## [1.114.0] — 2026-07-06

**Kenar çubuğunda AI kullanım ve maliyet göstergesi (sol alt).** Kompakt bir **KULLANIM** bölümü artık her sayfada kenar çubuğunun altında yer alır (kenar çubuğu yoksa sol altta sabit bir kart; RTL'de sağ altta). LLM jeton kullanımını **24s / 7g / 30g** pencerelerinde gösterir — her biri `<jeton> · <pay%>` olarak (tüm zamana göre pay) yeşil bir çubukla — ve tahmini 24s maliyet altbilgisi ekler. Veri, `data/llm-usage.jsonl` dosyasının salt okunur `GET /api/usage` özetidir (yalnızca yerel), `#/usage` sayfasıyla aynı kaynak; maliyet bir tahmindir ve manuel mod çalıştırmaları ücretsizdir ve sayılmaz. Katlanabilir — başlık değiştirir ve durum korunur.

- `index.html`'den yüklenen yeni istemci bileşeni `public/js/lib/usage-hud.js`, sürüm altbilgisinin üstünde kenar çubuğuna takılır (sabit köşe yedeği). CSP güvenli; temaya duyarlı + RTL aynalı. Yeni sunucu rotası yok. Testler: `tests/usage-hud.test.mjs` (8). 3 yeni i18n anahtarı ×16.

Yeni: yok.


## [1.113.0] — 2026-07-06

**Her sayfada yüzen "Yardıma sor" asistanı.** Gradyanlı bir robot sohbet düğmesi artık her sayfanın sağ alt köşesinde (RTL'de sol altta) yüzer. Kullanım sorularını YALNIZCA kendi dilindeki uygulama içi yardım kılavuzuna dayanarak yanıtlayan kompakt bir sohbeti açmak için tıkla — `#/docs-assistant` sayfasıyla aynı uç nokta (`POST /api/docs-assistant/ask`), dolayısıyla asla CV'ni, profilini veya izleyicini okumaz. LLM anahtarıyla canlı; anahtar yoksa → çalıştırmaya hazır bir istem. Başlıkta robot avatarı + çevrimiçi durum; çipler sık soruları doldurur; Esc veya dışına tıklama kapatır; `#/docs-assistant` sayfasında gizlenir.

- `index.html`'den global olarak takılan yeni istemci bileşeni `public/js/lib/docs-fab.js`; CSP güvenli; `app.css` içinde temaya duyarlı + RTL aynalı stiller. Yeni sunucu rotası yok. Testler: `tests/docs-fab.test.mjs` (8). 6 yeni i18n anahtarı ×16. Yardım §1 yerinde genişletildi.

Yeni: yok.


## [1.112.0] — 2026-07-06

**Doküman & QA konsolidasyonu.** Kullanıcıya görünür kod değişikliği yok. SDD kurallar belgesi (`docs/sdd/CONVENTIONS.md`) mevcut **30 rota modülüne** (önceden 24) ve mevcut test temeline güncellendi; projenin tamamı için belirleyici QA istemi (`qa/QA-REGRESSION-PROMPT.md`) konsolide edildi — yayım mekaniği güncellendi (v1.111, parentVersion 1.17.0, yayım olayıyla tetiklenen yayınlama), §14 eklemeler tablosu düzeltildi (Scan Hariç Tut v1.109.0 olarak yeniden etiketlendi) ve v1.111 CodeQL kapanışıyla genişletildi — böylece tüm işlevsellik için tek başına regresyon istemi olur. Aşırı büyük yükleme dalı için bir kapsam testi ekler.

Yeni: yok.


## [1.111.0] — 2026-07-06

**Güvenlik — CodeQL biriktirme listesi kapanışı.** Kalan statik analiz bulgularını göz ardı etmek yerine kaynağında kapatan üç derinlemesine savunma sertleştirmesi. `stripDangerousMarkdown` artık herhangi bir *kesilmiş* tehlikeli etiket açılışının (`<script`/`<iframe`/… ile biten yük) `<` karakterini kaçışlar; böylece çıktısı kanıtlanabilir şekilde canlı tehlikeli etiket içermez. CV içe aktarımı, yüklenen arabelleğin boyutunu açık bir `Number()` dönüşümüyle okur — tür karışıklığına karşı bir bariyer. Mod rol satırları artık saklanan işlevler yerine `String.replace` ile enterpole edilen şablon **dizeleri**dir; bu da dinamik gönderim çağrısını tamamen kaldırır. Kullanıcıya görünür davranış değişikliği yok.

- `server/lib/security.mjs`, `server/lib/cv-import.mjs`, `server/lib/prompts.mjs`. Testler: `tests/security-hardening-v1111.test.mjs` (7) + güncellenen v1108 koruma testi. i18n/yardım/rota değişikliği yok.

Yeni: yok.


## [1.110.0] — 2026-07-06

**Docs & QA tazeleme (tüm diller).** Kod değişikliği yok. Tüm proje QA istemi v1.109.0'a tazelendi ve v1.98→v1.109'u kapsayan yeni bir §14 eklendi; kalıcı UX-denetim ve tasarım-dışa-aktarım istemleri güncel sayfa kümesini kazandı. v1.100–v1.109'da eklenen her yardım paragrafı artık **16 dilin tümüne** çevrildi.

Yeni: yok.


## [1.109.0] — 2026-07-06

**Scan Hariç Tut filtresi + pipeline genel bakışı (web düzeni paritesi).** `#/scan`'de **Ara** kutusu artık virgülleri **VEYA** olarak ele alır ("bulunacak roller") ve yeni bir **Hariç tut** alanı, şirketi/rolü/konumu virgülle ayrılmış kelimelerden birini (örn. `senior, staff`) içeren satırları gizler; ikisi de kayıtlı aramalarınızda hatırlanır. `#/pipeline`'de kompakt bir **genel bakış şeridi** pipeline'ınızı bir bakışta gösterir — **N gelen kutusunda**, **N izlenen** ve izleyiciden **Applied / Responded / Interview / Offer** sayıları, her rozet `#/tracker`'a bağlanır.

- Yalnızca istemci (yeni rota/yazma yok). `public/js/views/scan.js` + `public/js/views/pipeline.js`. Testler: `tests/scan-pipeline-ui-v1109.test.mjs` (2). 4 yeni i18n anahtarı ×16. Yardım §7 + §8 yerinde genişletildi.

Yeni: yok.


## [1.108.0] — 2026-07-06

**Güvenlik sıkılaştırması (CodeQL triyajı, 2. tur).** Üç düşük önem dereceli bulgu daha düzeltildi: prompt oluşturucu, yerel ayar rol satırını **kendi anahtarı + `typeof === function`** ile çözerek kurcalanmış bir yerel ayarın bir prototip yöntemine yönlenmesini engeller (unvalidated-dynamic-method-call); PDF dosya adı slug'ı **regex'ten önce 200 karaktere sınırlandırılır** ki tamamı tire olan bir girdi geri izleme yapmasın (polinom ReDoS); ve belge içe aktarma **dizi türünde bir `filename`'i** (tekrarlanan başlık) dizeye zorlar (type-confusion). Geçerli girdi için davranış değişikliği yok.

- `server/lib/prompts.mjs`, `server/lib/routes/runners.mjs`, `server/lib/cv-import.mjs` + `tests/security-hardening-v1108.test.mjs` (3). v1.106–v1.108 boyunca statik analiz birikimi 167'den ~14'e düştü; gerçekten güvenlikle ilgili her bulgu düzeltildi, kalanı (korumalı/temizlenmiş yanlış pozitifler + not düzeyi lint) gerekçeyle reddedildi.

Yeni: yok.


## [1.107.0] — 2026-07-06

**Temizleyici sıkılaştırması (durağan XSS derinlemesine savunma).** `stripDangerousMarkdown` — depolanan özgeçmiş/ilan markdown'ındaki tehlikeli HTML'i etkisiz kılarak, render'da-kaçışlı istemciyi atlayan herhangi bir tüketiciyi bile güvende tutar — artık etiket temizliğini **bir sabit noktaya kadar** çalıştırıyor (kararlı olana dek tekrarla), böylece bir yükü *yeniden oluşturan* bir kaldırma (örn. `<scr<script></script>ipt>`) yakalanır, script/style vb. **sonunda çöp bulunan** kapanış etiketleriyle (`</script foo>`) eşleşir ve **kapatılmamış** bir yürütülebilir açıcıyı (`<script …>`) kaldırır. Geçerli markdown için davranış değişmez — yalnızca daha fazlasını kaldırır.

- `server/lib/security.mjs`: sabit nokta döngüsü (8 geçişle sınırlı) + `[^>]*>` kapanış etiketi kalıpları + kapatılmamış açıcı kaldırma. `tests/cv-xss-bypasses.test.mjs` içinde +3 regresyon vakası. Yetkili XSS sınırı hâlâ çıktı kaçışıdır (`UI.md`); bu, durağan garantiyi güçlendirir ve ilgili CodeQL bulgularını kapatır.

Yeni: yok.


## [1.106.0] — 2026-07-06

**Güvenlik sıkılaştırması (CodeQL triyajı).** Statik analiz birikimini gözden geçirdikten sonra üç gerçek (düşük önem dereceli de olsa) bulgu düzeltildi: rota render hata yolu artık **hata mesajını DOM'a ulaşmadan önce kaçışlıyor** (bir sunucu hatası kullanıcı girdisini yansıtabildiğinden güvenilmez sayılır — XSS sınırı) ve profil/yapılandırma özellik yazımları **`__proto__` / `constructor` / `prototype` anahtarlarını reddediyor** (her ihtimale karşı prototip kirliliği koruması — anahtarlar sabit alan özelliklerinden gelir, ham istek girdisinden değil). Kalan uyarıların çoğu, tarayıcının meşru `data/*` okuma/yazmaları ve zaten kendi hız sınırlayıcısını taşıyan rotalar üzerindeki yanlış pozitiflerdir; gerekçeyle reddedildi.

- `public/js/router.js`, `innerHTML`'den önce `UI.escapeHtml` ile `err.message`'i kaçışlar; `server/lib/routes/content.mjs` ve `server/lib/routes/config.mjs` prototip anahtarlarını korur. Geçerli girdi için davranış değişikliği yok. Testler: `tests/security-hardening-v1106.test.mjs` (3). Yeni i18n anahtarı yok.

Yeni: yok.


## [1.105.0] — 2026-07-06

**AI kullanımı ve maliyeti sayfası.** Yeni bir **AI kullanımı** sayfası (kenar çubuğu, Sağlık'ın yanında), **canlı** AI üretimlerinde — değerlendirmeler, raporlar, sohbetler — harcadığınız jetonları son 24 saat, 7 gün, 30 gün ve tüm zamanlar boyunca **sağlayıcı başına** ayrıştırarak **tahmini USD** maliyetiyle gösterir. Her canlı çağrı, `data/llm-usage.jsonl`'ye küçük bir `{provider, in, out}` kaydı ekler (hiçbir yere gönderilmez); anahtarsız çalıştırmalar (manuel kip) hiçbir şeye mal olmaz ve kaydedilmez.

- Yeni rota modülü (30.) `server/lib/routes/usage.mjs` — `GET /api/usage` (salt okunur toplamalar) + `server/lib/llm-usage.mjs` (`recordUsage` Anthropic/OpenAI/Gemini kullanım biçimlerini normalleştirir ve best-effort ekler; `readUsage`/`aggregate` 24s/7g/30g/tümü penceresi × sağlayıcıya göre toplar) + `server/lib/llm-pricing.mjs` (sağlayıcı başına **düzenlenebilir** bir `$/1M` jeton fiyat tablosu — jetonlar kesin, dolarlar planınıza göre düzeltebileceğiniz yaklaşık liste fiyatlarıdır; asla faturalanmaz). Kayıt, gönderim noktalarına (`runActiveProvider` + `routes/llm.mjs`) bağlanır.
- Yeni görünüm `public/js/views/usage.js` (`#/usage`, pencere sekmeleri). Testler: `tests/usage-routes.test.mjs`. 17 yeni i18n anahtarı ×16 (`usage.*` + `nav.usage`). Yardım §6 yerinde genişletildi.

Yeni: `server/lib/routes/usage.mjs`; `server/lib/llm-usage.mjs`; `server/lib/llm-pricing.mjs`; `public/js/views/usage.js`.


## [1.104.0] — 2026-07-06

**Tarama tablosunda şirket logoları (gizliliği koruyan).** **Uygulama ayarları**'ndaki yeni **Görünüm** anahtarı — **Tarama tablosunda şirket logolarını göster** (varsayılan kapalı) — `#/scan` üzerinde her şirketin logosunu adının yanına çizer. Logo, şirketin **kendi alan adından alınan favicon**'udur ve sunucu tarafında proxy'lenir (`GET /api/logo`); böylece **hiçbir üçüncü taraf logo servisi hangi işverenlere baktığınızı öğrenemez**. Paylaşılan bir iş ilanı portalındaki (Greenhouse, Lever, Ashby, …) ilanlar portal simgesi yerine renkli bir **harf rozeti** gösterir ve yüklenemeyen her logo aynı rozete geri döner.

- Yeni rota modülü (29.) `server/lib/routes/logos.mjs` — `GET /api/logo?domain=`. Alan adını doğrular (şema/yol/loopback yok), `/favicon.ico`'yu **SSRF güvenli `safeGet`** üzerinden alır (yeni bir `binary` modu ham baytları + content-type döndürür; DNS sabitleme, yönlendirme doğrulama ve boyut sınırı değişmedi), bir HTML hata sayfasını asla görüntü olarak sunmamak için **görüntü sihirli bayt koklaması** yapar, isabetleri **ve** ıskaları bellek içi LRU'da önbelleğe alır ve **diske hiçbir şey yazmaz**.
- Yeni istemci kütüphanesi `public/js/lib/company-logo.js` (`window.CompanyLogo`): localStorage bayrağıyla varsayılan kapalı; paylaşılan ATS ana bilgisayarlarını atlayıp deterministik bir harf avatarı kullanır; CSP güvenli `img.onerror` geri dönüşü. Testler: `tests/logo-routes.test.mjs`. 5 yeni i18n anahtarı ×16 (`appear.*`). Yardım §2 yerinde genişletildi.

Yeni: `server/lib/routes/logos.mjs`; `public/js/lib/company-logo.js`.


## [1.103.0] — 2026-07-06

**Ayarlar: "Yapay zeka CLI araçları" — hangileri kurulu.** career-ops Claude Code ile çalışır ama açık skill standardındaki herhangi bir ajan CLI'ıyla uyumludur. **Uygulama ayarları**'ndaki (`#/config`) yeni **Yapay zeka CLI araçları** sekmesi, bunlardan — Claude Code, Codex, Gemini CLI, OpenCode, GitHub Copilot CLI, Qwen, Antigravity — hangilerinin sunucuyu çalıştıran makinede kurulu olduğunu ve yollarını gösterir. Bu **salt okunur bir PATH taramasıdır**: yalnızca her ikili dosyanın var olup olmadığını kontrol eder ve **asla çalıştırmaz** (`--version` yok, yürütme yok), hiçbir şey yazmaz ve kullanıcı verisine dokunmaz.

- Yeni rota modülü (28.) `server/lib/routes/cli-detect.mjs` — `GET /api/cli-detect`. Algılama, sabit 7 girişli bir izin listesinden `process.env.PATH` üzerinden bir ikilinin yolunu çözer (Windows `.cmd/.exe/.bat` shim'leri; POSIX yürütme biti); PATH'teki kötü niyetli bir dosya bu rota tarafından asla çalıştırılamaz.
- `public/js/views/config.js` içinde yeni "Yapay zeka CLI araçları" sekmesi (tembel yükleme, `#/config?tab=cli` ile derin bağlantı). Testler: `tests/cli-detect-routes.test.mjs`. 8 yeni i18n anahtarı ×16 (`cli.*` + `config.tabCli`). Yardım §2 yerinde genişletildi.

Yeni: `server/lib/routes/cli-detect.mjs`.


## [1.102.0] — 2026-07-05

**"Belgelere sor" — uygulama içi yardım kılavuzuna dayalı bir sohbet.** Yeni bir **Belgelere sor 💬** sayfası (kenar çubuğu, Yardım altında): "İş portallarını nasıl tararım?" gibi bir soru yazın ve **yalnızca** uygulamanın kendi yardım kılavuzundan dilinizde bir yanıt alın — hangi bölümleri kullandığını gösterir ve **özgeçmişinizi, profilinizi veya iş aramanızı asla okumaz**. Bu, sizinle değil, uygulamanın nasıl kullanılacağıyla ilgilidir. LLM anahtarıyla canlı yanıtlar; anahtar yoksa ilgili yardım bölümleriyle önceden doldurulmuş, hazır bir istem verir.

- Yeni rota modülü (27.) `server/lib/routes/docs-assistant.mjs` — `POST /api/docs-assistant/ask`. **Bağımlılıksız getirme:** dilinizdeki yardım belgesi `##` bölümlerine ayrılır ve sorunuzla anahtar kelime örtüşmesine göre puanlanır; en iyileri satır içine alınır ve model bunlardan yanıt vermeli ya da kılavuzun bunu kapsamadığını söylemelidir (uydurma özellik/rota yok). Paylaşılan sağlayıcı basamaklaması, manuel geri dönüş, hız sınırlı, **yazma yok**, kullanıcı verisi okumaz.
- Yeni görünüm `public/js/views/docs-assistant.js`. Testler: `tests/docs-assistant-routes.test.mjs`. 14 yeni i18n anahtarı ×16 (`docs.*` + `nav.docsAssistant`). Yardım §1 yerinde genişletildi.

Yeni: `server/lib/routes/docs-assistant.mjs`; `public/js/views/docs-assistant.js`.


## [1.101.0] — 2026-07-05

**CV Studio: özgeçmişinizi belirli bir işe göre uyarlayın + ön yazı yazın, işe alım uzmanı kontrol listesiyle denetlenir.** `#/cv-studio` üzerinde yeni **Bir işe göre uyarla** kartı: bir iş ilanı yapıştırın (ve isteğe bağlı olarak hedef rol/başlık), CV Studio o ilana **uyarlanmış bir özgeçmiş ve uyumlu bir ön yazı** üretir, ardından teslim etmeden önce ikisini de bir **kontrol listesi kapısından** geçirir — `error` engeller (siz sonucu görmeden düzeltilir), `warn` önerir. Mekanik, kariyer koçluğu pratiğinden **genel** kurallara damıtılmıştır — işe alım uzmanı saniyeler içinde okur, bu yüzden ilgili deneyim en üste gelir, başlık ilanın rolüyle eşleşir, sonuçlar belirli sayılar taşır ve ön yazı tek bir "gereksinim ↔ sizin uyan gerçeğiniz" köprüsüyle kısa bir teaser olarak kalır. **Yalnızca** kendi özgeçmişiniz, profiliniz ve two-pager'ınıza dayanır ve **asla uydurmaz** — gömülü şirket, rol veya geçmiş yok.

- Yeni uç nokta `POST /api/cv-studio/tailor` (mevcut cv-studio modülünü genişletir — 27. modül yok): `buildTailorPrompt` + genel bir `TAILOR_INSTRUCTIONS` kapısı, `bundleProjectContext` tabanlı, paylaşılan sağlayıcı basamaklaması, anahtar yoksa manuel istem, hız sınırlı, **yazma yok**. Sonuç, paylaşılan `report-export.js` çubuğuyla Markdown / PDF / **DOCX** olarak dışa aktarılır.
- Testler: `tests/cv-studio-routes.test.mjs` içinde +3. 10 yeni i18n anahtarı ×16 (`cvs.tailor*`). Genel referans `docs/prompts/resume-cover.md`. Yardım §24 yerinde genişletildi.

Yeni: `docs/prompts/resume-cover.md`.


## [1.100.0] — 2026-07-05

**Two-pager: özgeçmişinizden yapay zeka ile otomatik doldurma + Önizleme + PDF/DOCX/Markdown dışa aktarımı.** Two-pager (`#/two-pager`) bir sonraki rolünüzden gerçekte ne istediğinizi kaydeder, ancak şimdiye dek her alanı elle yazmanız ya da bir istemi başka bir araca kopyalamanız gerekiyordu. Artık **✨ yapay zeka doldurma yardımcısı** yapılandırdığınız sağlayıcıyla canlı çalışıyor — *yalnızca* özgeçmişinizi + profilinizi okur (`bundleProjectContext` üzerinden, hiçbir şey uydurmadan), tüm alanları (ben kimim / sevdiklerim / olmazsa olmazlar / nefret ettiklerim / kesin engeller / pazarlıksızlar / hedef ortam) taslaklar ve gözden geçirip düzenleyip kaydetmeniz için formu doldurur. API anahtarı yoksa eskisi gibi istemi-kopyala kipine döner. Yeni bir **👁 Önizle ve dışa aktar** düğmesi two-pager'ı biçimlendirilmiş bir belge olarak işler ve **.md indir / PDF olarak kaydet / DOCX olarak kaydet / Kopyala** çubuğunu sunar.

- **Bağımlılıksız `.docx` dışa aktarımı.** Yeni `server/lib/docx.mjs`, minimal ama geçerli bir Office Open XML `.docx` üretir (dört OOXML parçasının DEFLATE ZIP'i, girdi başına CRC-32) — yeni çalışma zamanı bağımlılığı yok (bağımlılıklar `express` + `js-yaml` olarak kalır). Yeni rota `POST /api/export/docx` (`server/lib/routes/export.mjs`, 26. rota modülü; durumsuz, 200 KB sınırlı, yazma yok / LLM yok / URL fetch yok). Paylaşılan `public/js/lib/report-export.js`'e bağlandı, böylece **pazar raporu, kariyer planı ve kariyer yönlendirmesi de DOCX dışa aktarımı kazanır**.
- Canlı otomatik doldurma, paylaşılan sağlayıcı basamaklamasını (`runActiveProvider` / `providerAvailable`) kullanır; dönen YAML ayrıştırılır ve sınırlı two-pager biçimine (`parseYamlFields` + `normalizeTwoPager`) geri zorlanır — bilinmeyen anahtarlar atılır, diziler/dizeler sınırlanır. Manuel kip korunur.
- Testler: `tests/export-routes.test.mjs`. 4 yeni i18n anahtarı ×16 (`export.saveDocx`, `twoPager.preview`, `twoPager.aiFilling`, `twoPager.aiFilled`).

Yeni: `server/lib/docx.mjs`; `server/lib/routes/export.mjs`.


## [1.99.0] — 2026-07-05

**Portal sağlığı sayfası** (`#/portals`). Tarayıcı `portals.yml` içindeki bir dizi şirketi izler; bir ATS slug’ı sessizce bozulabilir ve o işveren tüm gelecekteki taramalardan kaybolur. Yeni **Portals** sayfası izlenen her şirketi listeler ve **Check portal health** ile her `careers_url` adresini DNS’i sabitlenmiş `safeGet` üzerinden (SSRF’ye karşı güvenli) yoklar ve ölüleri işaretler (404 = sessizce elenmiş) — salt okunur. Ayrıca v1.98.0 hata bildiricisini inceleme sonrası sağlamlaştırır: hata halka tamponu artık ağ katmanı fetch hatalarını yakalar ve temizleyici etiketsiz sağlayıcı anahtarlarını gizler.

Yeni: `server/lib/routes/portals.mjs`; `public/js/views/portals.js`.


## [1.98.0] — 2026-07-05

**Uygulama içi hata bildirici** (üst projenin `web-v0.2.0` web parçasıyla parite). Bildirim çekmecesindeki **🐞 Report a bug** düğmesi gizlilik tabanlı bir tanılama anlık görüntüsü toplar — sürümler, ekranınız, tarayıcı, bir `/api/health` kontrol özeti ve yeni bir istemci tarafı halka tamponundan son 20 hata — artı deterministik bir yinelenenleri ayıklama parmak izi (`co-web-<base36>`), tam Markdown’ı incelemenize izin verir ve ardından önceden doldurulmuş bir GitHub sorunu açar. Hiçbir şey otomatik olarak gönderilmez; asla CV’nizi, profilinizi, yanıtlarınızı, iş URL’lerinizi veya anahtarlarınızı taşımaz. Yeni kitaplıklar `logbuf.js` + `bug-report.js`; 11 i18n anahtarı ×16; `tests/bug-report.test.mjs`.

Yeni: `public/js/lib/logbuf.js`; `public/js/lib/bug-report.js`.


## [1.97.1] — 2026-07-05
### Düzeltilenler
- **İnceleme odaklı sağlamlaştırma & dokümantasyon paritesi (v1.97.0 devamı).** AI-inceleme günlüklerinin taranması gerçek düzeltmeleri ortaya çıkardı:
- **`fit-score.js` (tarama `◎` uygunluk rozeti).** `salaryFloor()` artık yıllık-altı bir oranı sahte bir yıllık tabana yükseltmiyor — "at least 500 EUR/day", "$80/hr", "6000 monthly" artık 500k/80k'lık bir anlaşma-bozucu yerine `null` döndürüyor. Ülke eşleştirmesi artık tam-sözcük (`\b…\b`) olduğundan "Germany" artık "German" sıfatıyla eşleşmiyor (ne de "Nigerian" içindeki "Nigeria") ve yanlış bir başka-yerde-olmalı ihlali tetiklemiyor. `tests/fit-score.test.mjs` içinde +3 test.
- **Dokümantasyon paritesi.** Her yerelleştirilmiş README artık tutarlı biçimde **16 yerel dil** duyuruyor — Help-satırı sayımı/listesi (×13) ve Yerelleştirme-bölümü metni artı "anahtarı N dosyanın tümüne ekleyin" notu (×8) hâlâ v1.85 öncesi sayımlardaydı (8/9). Uygulama-içi yardım §17 adaptör sayımı, 16 paketin tümünde **46 adaptör — 41 İngilizce + 5 Rusça** olarak düzeltildi.

Uygunluk-rozeti sezgiselinin ötesinde davranış değişikliği yok; yeni rota, anahtar veya i18n eklemesi yok.

## [1.97.0] — 2026-07-05
### Eklenenler
- **Dassault Systèmes tarayıcı kaynağı + üç cepheli bir kalite taraması.**
- **Yeni tarama kaynağı — Dassault Systèmes (üst career-ops eşdeğerliği, #1498).** `server/lib/sources/dassault.mjs` + `server/lib/portals/adapters/dassault.mjs`, üst projenin sıfır-token Exalead "kart araması" sağlayıcısını (`3ds.com/careers/jobs` arkasındaki genel akış) yansıtır. Tek bir global uç nokta olduğundan sağlayıcıyla seçilir (`provider: dassault`) veya bir `3ds.com` ana bilgisayarından otomatik algılanır; SSRF için ana bilgisayar `www.3ds.com`'a sabitlenir ve `redirect:'error'` kullanılır. XML, DOM olmadan ayrıştırılır (her `<Hit>` için `<Meta>` haritaları), şehir/ülke yerelleştirilmiş kategori dizesinden çekilir ve ilanlar yalnızca genel URL'leri `*.3ds.com` üzerindeyse tutulur. Kayıt defteri artık **46 adaptör** sağlıyor (41 EN + 5 RU); `ALL_ADAPTERS` sayımı, sıralı-id ve `/api/scan/sources` EN-kümesi doğrulamaları 40 → 41 yükseltildi. `tests/sources-dassault.test.mjs` paketi (10 durum).
- **Üst projeden taşınan sağlamlık düzeltmeleri.** Avature ayrıştırıcısı artık iki canlı kiracı biçimlendirme varyantını tolere ediyor (konum-indeksi son ekli `article--result` + sınıfsız bir JobDetail başlık bağlantısı, #1541); Get on Board bir `0`/negatif `published_at` değerine karşı koruma sağlıyor (artık sahte 1970 tarihleri yok); SuccessFactors son sayfayı sınırlayarak `MAX_JOBS`'u aşamamasını sağlıyor (#1528).
- **Sunucu denetim düzeltmeleri.** `safe-fetch` artık limiti aşan bir yanıtta askıda kalmıyor — boyut-limiti yolu artık, yok edilmiş bir akışın asla yaymayacağı bir `'end'` olayını beklemek yerine promise'i doğrudan çözüyor (büyük sayfalı `/api/pipeline/preview` + auto-pipeline getirmelerini düzeltir). SSE `stream.*` etkinlik günlüğü yeniden erişilebilir (`/api/stream/` denetimi, genel "GET'i atla" korumasının üstüne taşındı).
- **SPA denetim düzeltmeleri.** `#/stats` sekme değiştiricisi, asenkron bir render yarışına karşı koruyor — yavaş bir sekmenin sonucu, kullanıcının zaten geçtiği daha yeni bir sekmenin üzerine artık yazamaz. Deneme mülakatı ve networking silme onayları artık uygun bir başlık + gövde iletiyor (artık gövdesi boş diyalog yok).
- **Çeviri düzeltmeleri.** Çevrilmemiş sözlük değerleri düzeltildi — Ukraynaca `config.modes*` (Adaptive Framing / Exit Narrative / Location Policy), Rusça `eval.jdLbl` ("Job Description"), İtalyanca `dash.quick.contactoSub` ("referral" → "segnalazione") — ayrıca İngilizce **16 yerel dil** şablonu ru/uk/ja/ko/zh-CN/zh-TW CHANGELOG'larında yerelleştirildi.
- Yeni: `server/lib/sources/dassault.mjs`; `server/lib/portals/adapters/dassault.mjs`.

## [1.96.0] — 2026-07-04
### Eklenenler
- **Kariyer yönelimi (Epic 27).** Yeni bir **`#/orientation`** sayfası "hangi yönler bana gerçekten uygun?" sorusunu yanıtlar — bir meslek testinden alacağın türden bir okuma, ama bir anketten değil, kendi özgeçmişin ve profilinden çıkarılır. **Profil oluştur**a tıkla ve model şunları döndürür: **en uygun kariyer vektörlerin** (sekiz arketipten — İşlevselci, İdareci, İletişimci, Uzman, Analist, Yenilikçi, Yönetici, Girişimci — hangileri uyuyor, kanıtlarıyla), bir kariyer-tipi eğilimi, önerilen roller, özgeçmişine bağlı mesleki güçlü yönler, çalışma-stili eğilimleri ve gelişim önerileri. Bu, **özgeçmişinin nasıl okunduğuna dair bir yapay zeka yansımasıdır — psikometrik bir test değil**: asla başarı uydurmaz ve sayısal puanları asla ölçülmüş gibi bildirmez. Markdown veya PDF olarak dışa aktar; diske hiçbir şey yazılmaz.
  - Yeni rota `server/lib/routes/orientation.mjs` (24. rota modülü) — `POST /api/orientation/generate`, paylaşılan sağlayıcı kaskadı aracılığıyla CV+profil+two-pager+bellekten profil istemini oluşturur; kopyala-yapıştır bir manuel geri dönüşle ve **dosya yazımı olmadan**.
  - Markdown/PDF/kopyalama için `report-export.js` yeniden kullanılır, **Büyüme** gezinme grubu altında.
  - Testler: `tests/orientation-routes.test.mjs` (yansıma çerçevelemesi / uydurma puan yok, CV/profil ile beslenen manuel mod). 16 dilde 7 yeni i18n anahtarı, Yardım **§28** ×16.
- Yeni: `#/orientation`; `server/lib/routes/orientation.mjs`.

## [1.95.0] — 2026-07-04
### Eklenenler
- **Kariyer planı (Epic 26).** Yeni bir **`#/career-plan`** sayfası, CV'ni ve profilini somut, kişiselleştirilmiş bir gelişim planına dönüştürür. Bir **ufuk** (6/12/24 ay) ve isteğe bağlı bir **odak** seç; model — CV'ni, profilini, two-pager'ını ve bellek notunu okuyarak — bir başlangıç noktası anlık görüntüsü, güçlü yönler/büyüme SWOT'u, SMART / OKR / WOOP olarak hedefler, alternatif yörüngeler, bir hard/soft beceri planı, bir **ay ay yol haritası**, ilerleme izleme yöntemleri, tuzaklar ve destek adımları yazar. Materyallerinin gerçekten gösterdiğinden ileriye doğru plan yapar ve geçmişin hakkında asla gerçek uydurmaz. Onu inline düzenle, kullanıcı katmanına (`config/career-plan.md`) **Kaydet** ve Markdown veya PDF olarak **dışa aktar**.
  - Yeni rota `server/lib/routes/career-plan.mjs` (23. rota modülü) — `GET`/`PUT /api/career-plan` (`config/career-plan.md` yazar) + `POST /api/career-plan/generate` (paylaşılan sağlayıcı kaskadı, manuel geri dönüş, uydurma yok). `PATHS.careerPlan`.
  - Markdown/PDF/kopyalama için paylaşılan `report-export.js` (v1.94.0) yeniden kullanılır ve yeni bir **Büyüme** gezinme grubu eklenir.
  - Testler: `tests/career-plan-routes.test.mjs` (sınırlama, GET/PUT gidiş-dönüşü, ufuk farkında ve CV/profil ile beslenen istem). 16 dilde 20 yeni i18n anahtarı, Yardım **§27** ×16.
- Yeni: `#/career-plan`; `server/lib/routes/career-plan.mjs`; `PATHS.careerPlan`.

## [1.94.0] — 2026-07-04
### Eklenenler
- **İstatistik, yeniden tasarlandı (Epic 25).** `#/stats` sayfası artık üç sekmeli bir **İstatistik** bölümü; gerçek grafikler ve çok daha fazla veriyle. Yeni bir **Pazar raporu** sekmesi, seçtiğin bir bölge ve para biriminde hedef rollerin için modelden bir maaş ve işgücü piyasası analizi ister — yönetici özeti, P10/P25/P75/P90 yüzdelikleriyle seviyeye göre maaş, önde gelen işverenler, talep gören beceriler tablosu, yan hakların sıklığı, ofis/hibrit/uzaktan dağılımı, 12–24 aylık eğilimler ve müzakere rehberliği. Her rakam **modelin bilgisinden yönlendirici bir tahmin** olarak etiketlenir, asla kazınmış veri olarak sunulmaz. Yeni bir **Kendi pipeline'ım** sekmesi kendi izleyicini grafikler: puan dağılımı, durum hunisi, önde gelen şirketler ve roller, zaman içindeki başvurular ve dönüşüm oranları. Orijinal hedef rol görünümü (ülkeye göre açık pozisyon/maaş + kayıtlı anlık görüntü eğilimi) artık bir **para birimi seçici** ve bir **role göre ilanlar** genel bakışıyla üçüncü bir sekmenin altına taşınır.
  - **Herhangi bir raporu dışa aktar** Markdown veya PDF olarak, ya da kopyala — paylaşılan `report-export.js` yardımcısı aracılığıyla (Markdown blob indirme; PDF mevcut satır içi PDF çalıştırıcısı üzerinden).
  - Yeni rota `server/lib/routes/market.mjs` (22. rota modülü) — `POST /api/stats/market`, CV'nden/profilinden (böylece hedef rollerini bilir), bölgeden ve para biriminden bir pazar analizi istemi oluşturur, bunu paylaşılan sağlayıcı kaskadından geçirir ve anahtar yoksa bir kopyala-yapıştır istemine geri döner. Dosya yazımı yok.
  - Testler: `tests/market-routes.test.mjs` (bölge/para birimi sınırlaması, dürüstlük etiketli istem, CV/profil ile beslenen manuel mod). 16 dilde 36 yeni i18n anahtarı, Yardım **§26** ×16.
- Yeni: `#/stats` sekmelere yeniden tasarlandı; `server/lib/routes/market.mjs`; `public/js/lib/report-export.js`.

## [1.93.0] — 2026-07-04
### Eklenenler
- **Bellek katmanı (Epic 24).** Yeni bir `#/memory` sayfası, asistanın **her** görevde aklında tuttuğu kısa, düzenlenebilir bir "benim hakkımda bunu hatırla" notu barındırır:
  - **Tek not, her yerde** — `bundleProjectContext` içine gömülü olduğu için not, **tüm** sağlayıcılarda her AI isteğine (değerlendirme, deneme mülakatı, networking, CV Studio) otomatik olarak ulaşır. Bir kez yaz; her şeyi yönlendirir.
  - **Yönlendirme, olgu değil** — tercihlerini ve nasıl çalışmayı sevdiğini yakalar (ton, biçim, deal-breaker, kadans), deneyimin hakkında asla yeni olgusal iddialar değil — onlar hâlâ yalnızca özgeçmişinde, profilinde ve two-pager'ında yaşar. Kullanıcı katmanında `config/memory.md` içine kaydedilir, güncellemelerle asla üzerine yazılmaz.
  - **Verilerinden öner** — `POST /api/memory/suggest`, kendi başvuru izleyicini davranış kalıpları için tarar ve gözden geçirip düzenlemen için madde imleri taslağı çıkarır. İzleyicini okur; asla olgu uydurmaz ve hiçbir canlı çağrı yapmaz.
- Yeni: `server/lib/routes/memory.mjs` (21. rota modülü — `GET`/`PUT /api/memory` + `POST /api/memory/suggest`), `public/js/views/memory.js`, `PATHS.memory` ve `bundleProjectContext`'e eklenen bir `config/memory.md` bloğu. Tüm **16 dilde** 11 yeni i18n anahtarı. Testler: `tests/memory-routes.test.mjs`.

## [1.92.0] — 2026-07-04
### Eklenenler
- **CV Studio (Epic 21).** Yeni bir `#/cv-studio` sayfası, özgeçmişine dürüst ve çoğunlukla yerel üç araç sunar:
  - **Özgeçmiş tanılaması** — kontrol başına açıklamalarla 0–100 arası deterministik bir puan (nicelendirilmiş etki, zayıf fiiller, moda sözcükler, uzunluk, temel bölümler, iletişim bilgileri). Tamamen istemci tarafında (`window.CvDiagnostics`) — LLM yok, uydurma yok, her bulgu açıklanır ki neyi değiştireceğine *sen* karar veresin.
  - **Gizlilik maskesi** — özgeçmişini örnek ya da ekran görüntüsü olarak paylaşmadan önce PII'yi (e-posta, telefon, bağlantılar/kullanıcı adları, sokak adresi ve isteğe bağlı olarak adın → baş harfler) karartır. Tümüyle tarayıcıda çalışır (`window.CvPrivacy`); tam olarak neyi karartığını bildirir ve orijinali asla saklamaz.
  - **İnsanileştir / ses eşleştir** — sert bir satır veya paragraf yapıştır ve onu *senin* sesinde yeniden yaz; sunucu tarafında `voice-dna.md` ve `writing-samples/` ile temellenir. Katı koruma bandı: yeniden sıralayabilir, sıkılaştırabilir ve yeniden seslendirebilir, ancak metinde zaten olmayan bir olguyu, metriği ya da başarıyı asla eklemez. Paylaşılan sağlayıcı zinciri üzerinden canlı çalışır ya da anahtar olmadan kopyala-yapıştır için bir istem döndürür.
- Yeni: `server/lib/routes/cv-studio.mjs` (20. rota modülü — `POST /api/cv-studio/humanize`), `public/js/views/cv-studio.js`, `public/js/lib/cv-diagnostics.js`, `public/js/lib/cv-privacy.js`, `PATHS.voiceDna` + `PATHS.writingSamplesDir`. Tüm **16 dilde** 29 yeni i18n anahtarı. Testler: `tests/cv-diagnostics.test.mjs`, `tests/cv-studio-routes.test.mjs`. (Şablon galerisi, Word dışa aktarımı ve ilan PDF arşivi, sonraki CV Studio çalışması olarak izlenmektedir.)

## [1.91.0] — 2026-07-04
### Eklenenler
- **Networking ve derin şirket araştırması (Epic 16).** Yeni bir `#/networking` sayfası, bir şirketi mülakat kazanmak için uygulanabilir bir plana dönüştürür; özgeçmişine, profiline ve two-pager'ına dayanır:
  - **Şirket dosyası** — şirketin ne yaptığına, alıntılanmaya değer son sinyallere ve gerçek geçmişinden çıkarılan "neden uygunum" kancalarına dair sıkı bir brief.
  - **Kiminle iletişime geçilmeli** — her birini bulmak için somut bir LinkedIn arama dizesiyle 3–5 hedef persona (işe alım müdürü, kurum içi işe alımcı, ekipte kıdemli bir IC, sıcak/mezun bağlantısı). Asla gerçek isimler uydurmaz.
  - **En sıcak tanıştırma yolu** — *senin* geçmişin için en gerçekçi sıcak giriş rotası (ortak işveren/okul/topluluk, ikinci derece bir yol veya sinyali güçlü bir soğuk DM) ve nedeni.
  - **İletişim taslakları** — başlıca persona'lar için gerçek kanıt noktalarına dayanan kısa, spesifik mesajlar.
  - **Canlı veya manuel** — herhangi bir anahtarla paylaşılan sağlayıcı zinciri üzerinden canlı çalışır ya da kopyala-yapıştır için hazır bir istem döndürür (dürüst yedek, uydurma yok). **Planı kaydet**, tamamlanmış bir planı kullanıcı katmanında saklar (`networking/net-{company}-{role}-{date}.md`); sayfa kaydedilen planları listeler, açar ve siler.
- Yeni: `server/lib/routes/networking.mjs` (19. rota modülü), `public/js/views/networking.js`, `PATHS.networkingDir`. v1.90.0'daki `server/lib/llm-dispatch.mjs` zincirini yeniden kullanır. Tüm **16 dilde** 24 yeni i18n anahtarı. Testler: `tests/networking-routes.test.mjs`.

## [1.90.0] — 2026-07-04
### Eklenenler
- **Mock Interview 2.0 (Epic 15).** Yeni bir `#/mock-interview` sayfası; özgeçmişini, profilini, two-pager'ını ve hikâye bankanı sıra sıra bir mülakat provasına dönüştürür:
  - **Sohbet tabanlı pratik** — bir hedef rol (+ isteğe bağlı şirket / iş tanımı) gir ve mülakatçı odaklı bir soruyla açılış yapsın. Gönderdiğin her yanıt yapılandırılmış bir karşılık alır: **Feedback** (güçlü yönler + STAR+R boşluğu), bir **Score** (`N/5`) ve son yanıtının en zayıf kısmını yoklayan bir **Next question**. Sunucu tarafında gerçek belgelerine dayanır — sahip olmadığın bir deneyimi asla uydurmaz.
  - **Hikâye bankası farkında** — `interview-prep/story-bank.md` isteme gömülür (`cv.md` ile aynı güven seviyesinde), böylece geri bildirim seni en iyi hikâyelerine yönlendirebilir.
  - **Canlı veya manuel** — bir sağlayıcı anahtarıyla tur, paylaşılan zincir üzerinden canlı çalışır (Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models); anahtar yoksa kopyala-yapıştır için hazır bir istem alırsın (dürüst yedek, uydurma yanıt yok).
  - **Kaydedilen oturumlar** — bitmiş bir mülakatı kullanıcı katmanında saklamak için **Transkripti kaydet**'e tıkla (`interview-prep/mock-{company}-{role}-{date}.md`); sayfa kaydedilen oturumları listeler, açar ve siler.
- Yeni: `server/lib/routes/interview.mjs` (18. rota modülü), `public/js/views/mock-interview.js`, `server/lib/llm-dispatch.mjs` (paylaşılan sağlayıcı zinciri), `PATHS.storyBank`, `bundleProjectContext({ extraFiles })`. Tüm **16 dilde** 30 yeni i18n anahtarı. Testler: `tests/interview-routes.test.mjs`.

## [1.89.0] — 2026-07-04
### Eklenenler
- **Aday pazar uyumu — the two-pager (Epic 14).** Yeni bir `#/two-pager` sayfası, bir sonraki rolünden *senin* gerçekte ne istediğini yakalamanı sağlar; *Never Search Alone* kitabındaki "Mnookin two-pager" formatına göre modellenmiştir:
  - **Rehberli oluşturucu** — birinci tekil şahıs "Ben kimim" anlatısı, bir "Hedef ortam" notu ve beş çip listesi editörü: **sevdiklerim**, **olmazsa olmazlar**, **sevmediklerim**, **anlaşma bozucular** ve **pazarlık edilemezler**. Üst projenin **kullanıcı katmanına** (`config/two-pager.yml`) `PUT /api/two-pager` ile kaydedilir — sistem güncellemelerinde asla üzerine yazılmaz.
  - **AI doldurma asistanı** (`POST /api/two-pager/draft`) — CV + profilin satır içine yerleştirilmiş, herhangi bir LLM'de çalıştırıp geri yapıştırabileceğin, kullanıma hazır bir Mnookin istemi oluşturur. Yalnızca senin materyallerini kullanır; hiçbir şey uydurulmaz.
  - **Uyum rozeti** — `#/scan` üzerindeki her ilan artık, ilanın çalışma türünü, ülkesini, maaş tabanını ve taşınma bilgisini two-pager'ınla karşılaştıran bir `◎ N` uyum puanı gösterir (istemci tarafında, `window.FitScore` ile). Tasarım gereği dürüst: bir ilan karşılaştırılabilir sinyal vermediğinde **hiçbir rozet gösterilmez** (asla uydurma bir sayı). Anlaşma bozucu ihlalleri, basit hoşnutsuzluklardan daha ağır basar.
  - **Her değerlendirmeyi besler** — kaydedilen two-pager `bundleProjectContext` içine satır içine yerleştirilir, böylece tüm alt LLM değerlendirmeleri belirttiğin tercihleri CV-JD eşleşmesiyle harmanlar.
- Yeni: `server/lib/routes/two-pager.mjs`, `public/js/views/two-pager.js`, `public/js/lib/fit-score.js`, `PATHS.twoPager`. Tüm **16 yerel ayarda** 27 yeni i18n anahtarı. Testler: `tests/two-pager-routes.test.mjs`, `tests/fit-score.test.mjs`.

## [1.88.0] — 2026-07-04
### Değişenler
- **Issue #29 rötuşu — Tarama i18n boşlukları + API hijyeni.**
- **Son kalan sabit kodlanmış Tarama dizeleri yerelleştirildi** (yol haritası v1.69.4): kaynak özeti hapları (`N yeni / M eşleşen`), `N yeni ilan` bildirimleri ve `reloc` rozeti artık `t()` üzerinden akıyor — tüm **16 yerel ayarda** 4 yeni anahtar (`scan.pillNew`, `scan.pillMatching`, `scan.newOffers`, `scan.relocBadge`). İngilizce konuşmayan kullanıcılar temel tarama akışında artık başıboş İngilizce görmüyor.
- **`X-Powered-By` başlığı devre dışı bırakıldı** (yol haritası v1.69.5): `createApp()` içinde `app.disable('x-powered-by')` — sunucu artık Express kullandığını duyurmuyor. (Bu destanın geri kalanı zaten teslim edilmişti: `parentVersion` kendi release-please yorumunu çıkarır, açık mod tema düğmesi, rota değişiminde modal kapatma ve Raporlar'da "Score" (`rep.score`) yerelleştirmesi.)
- Testler: `tests/scan-i18n-gaps.test.mjs` + `tests/security-headers.test.mjs` içinde bir `X-Powered-By` yokluğu doğrulaması.

## [1.87.0] — 2026-07-04
### Eklenenler
- **Kimlik doğrulaması gerektirmeyen 4 yeni tarama sağlayıcısı (üst career-ops v1.16.0 ile eşitlik).** Tarayıcı kayıt defteri **41 → 45 adaptöre** (40 EN + 5 RU) büyür — tümü herkese açık, kimlik doğrulamasız, ana bilgisayara sabitlenmiş, `redirect:'error'` (SSRF güvenli) ve her biri CI'da izole bir teste sahip:
  - **Get on Board** (`getonbrd`) — portal genelinde herkese açık JSON:API (LATAM/uzaktan teknoloji), sağlayıcıya göre seçilir, sayfalanır. `server/lib/sources/getonbrd.mjs`.
  - **Amazon** (`amazon`) — `amazon.jobs` herkese açık arama JSON'u, ana bilgisayarla algılanır veya `provider: amazon`, ofsetle sayfalanır. `server/lib/sources/amazon.mjs`.
  - **Avature** (`avature`) — kiracı başına `*.avature.net` ATS, HTML'den ayrıştırılır, ana bilgisayarla algılanır veya `provider: avature`. `server/lib/sources/avature.mjs`.
  - **SAP SuccessFactors** (`successfactors`) — kiracı başına RMK kutucuk listesi (`*.successfactors.eu/.com`, `jobs2web.com`), HTML'den ayrıştırılır. `server/lib/sources/successfactors.mjs`.
- Her biri bir `sources/<slug>.mjs` (otomatik keşfedilen `meta` → `#/scan` açılır menüsü) **ve** `ALL_ADAPTERS` içinde bir `portals/adapters/<slug>.mjs` (iki kayıt defteri kuralı) + `tests/sources-<slug>.test.mjs` sağlar. `ALL_ADAPTERS` sayısı ile sıralı id ve `/api/scan/sources` EN kümesi doğrulamaları 36→40'a yükseldi; `GET /api/scan/sources` artık 45 tanesini listeliyor.

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
