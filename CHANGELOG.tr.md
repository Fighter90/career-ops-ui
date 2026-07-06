# Changelog (Türkçe)

> Bu changelog v1.85.0'dan başlar — Türkçe yerelleştirmenin eklendiği sürüm. Önceki sürümler için bkz. [CHANGELOG.md](CHANGELOG.md).

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
