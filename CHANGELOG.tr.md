# Changelog (Türkçe)

> Bu changelog v1.85.0'dan başlar — Türkçe yerelleştirmenin eklendiği sürüm. Önceki sürümler için bkz. [CHANGELOG.md](CHANGELOG.md).

## [1.119.5] — 2026-07-13

### Düzeltildi
- **Landing'deki dil düğmesi artık satır atlamıyor** — v1.119.2'deki bayraklarla başlıktaki değiştirici etiketi (ör. «🇷🇺 Русский») dar masaüstü genişliklerinde üç satıra kadar bölünebiliyordu; değiştirici etiketi ve açılır menüdeki tüm seçenekler artık `whitespace-nowrap` — bayrak + endonim her zaman tek satırda. Altbilgideki dil listesi katı iki sütunlu ızgaradan tek satırlık öğelerden oluşan sarmalanan bir sıraya geçti — «🇧🇷 Português (Brasil)» da artık adın ortasından bölünmüyor.

## [1.119.4] — 2026-07-13

### Değiştirildi
- **LICENSE yazarı belirtiyor** — telif satırı artık şöyle: *Sergey Emelyanov (Fighter90) <https://sergey-cv.com> and career-ops-ui contributors* (kanonik MIT metni dokunulmadı). Yeni **NOTICE.md** lisanslamayı ayrıntılı açıklıyor: telif hakkını kim tutuyor, MIT izni tam olarak neyi kapsıyor (kod, belgeler, çeviriler, landing, wiki), neyi KAPSAMIYOR (çalışma zamanı verileriniz, üst proje, iş ilanı içerikleri, ticari markalar), üçüncü taraf bileşen tablosu (express/js-yaml — MIT; Astro/Tailwind — MIT; Figtree ve JetBrains Mono yazı tipleri — SIL OFL 1.1; sharp — Apache-2.0) ve isteğe bağlı bir atıf satırı.

## [1.119.3] — 2026-07-13

### Eklendi
- **SECURITY.md** — CONTRIBUTING'in işaret ettiği güvenlik politikası artık mevcut: desteklenen sürümler, özel bildirim akışı (depoda GitHub **private vulnerability reporting artık etkin** — Security sekmesi → «Report a vulnerability»), localhost'a bağlı tek kullanıcılı bir uygulamanın tehdit modeli (kapsamda: düşmanca ilanlar üzerinden XSS / SSRF / path traversal / gizli anahtar sızıntısı / CSP zayıflatma; kapsam dışı: kendi localhost'una DoS ve üst projenin sorunları) ve gözden geçirenler için sertleştirme taban çizgisi.

## [1.119.2] — 2026-07-13

### Eklendi
- **CONTRIBUTING.md** — landing'in ve README'nin başından beri bağlantı verdiği katkıda bulunan rehberi artık mevcut: kurulum, proje haritası, katı güvenlik/no-build kuralları, test katmanları, tarama kaynağı eklemek için «iki kayıt» walkthrough'u, ×16 i18n sözleşmesi, commit/PR kuralları ve sürüm süreci.
- **Landing'de dil bayrakları** — cvstart.org dil değiştirici, alt bilgideki dil ızgarası ve «kendi dilinde oku» banner'ı artık her yerel ayarın bayrağını endoniminin yanında gösteriyor (uygulamanın dil `<select>`'iyle aynı bölgesel gösterge seti; bayrak glifleri olmayan yerlerde bölge harflerine düşer).
- **Landing altbilgi düzeltmeleri** — ölü Discussions bağlantısı (özellik depoda etkin değil) artık projenin **wiki**'sine gidiyor ve altbilgi yazarı belirtiyor: **Sergey Emelyanov** ([sergey-cv.com](https://sergey-cv.com/) · [LinkedIn](https://www.linkedin.com/in/sergey-emelyanov-in-job/)).

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
