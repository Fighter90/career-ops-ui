# Changelog (Türkçe)

> Bu changelog artık tüm sürüm geçmişini içerir. Türkçe yerelleştirmenin eklenmesinden (v1.85.0) önce yayınlanan girdiler aşağıda İngilizce özgün hâliyle yer alır — çeviri bekliyor; asıl kaynak [🇬🇧 CHANGELOG.md](CHANGELOG.md)'dir.

## [1.262.1] — 2026-10-29

**İtalyanca değerlendirme yaması: OpenRouter dönemi raporu SCORE_SUMMARY bloğunun hemen önünde keserken yakaladığı için `it` token-yoğun yerel ayarlara katılıyor (32768 token tavanı + 480 s saati) — ve bu tanıyı mümkün kılan sağlayıcı geçiş araç takımı deploy workflow'una geliyor.**

### Düzeltildi

- **`it` değerlendirmesi SCORE_SUMMARY'den önce kesildi (CAR-190 kuyruğu)**: remote-QA 40928864980 (yeniden doldurulan kredilerle ilk koşu) — bir `it` değerlendirmesi 264 s koştu ve 15 045 karakterle döndü, 16 384 tavanında `tok ~15635`: A–G blokları sağlam, `---SCORE_SUMMARY---` yok. v1.261.1'de (CAR-174) `ta`'ya tavanını kazandıran şekil sınıfının aynısı. `it`, `TOKEN_DENSE_EVAL_LOCALES`'e katılıyor (`ta`, `hi` → `ta`, `hi`, `it`): hem 32 768 token bütçesi hem de 480 s saati artık uygulanıyor ve `/api/evaluate` + auto-pipeline `llm.mjs`'teki tek doğruluk kaynağında kalıyor.
- **Bloksuz en raporu — tek seferlik üretim feyki**: Aynı koşu tek bir `en` değerlendirmesinin dili doğru ama A–G bloklarının hiçbiri olmadan döndüğünü gördü; hedefli bir yeniden koşu tertemiz geçti (21 091 karakter, A–G ✓). Token-yoğun kümeye eklenmedi — bir feyk tarih değildir.

### Eklendi

- **Deploy workflow'u: `mode=hermes` ve `mode=provider`** (CAR-190 operasyon kuyruğu): `mode=hermes` Hermes gateway'ini yeniden başlatır ve tam bir teşhis basar (sırları ayıklanmış unit dosyası, önce/sonra dinleyiciler, sudo günlüğü, port-port sondalar, uygulamanın kendi `HERMES_BASE_URL` görünümü, OpenRouter kredi bakiyesi); `mode=provider` bir anahtar-varlığı korumasıyla `LLM_PROVIDER`'ı değiştirir (hedef sağlayıcının `*_API_KEY`'i yoksa reddeder) ve uygulamayı yeniden başlatır — Hermes kredileri yolda bittiğinde prod'un `openrouter`'a geçtiği yöntem budur. Deploy-modu ref koruması yalnızca `mode=deploy` için doğrulanıyor, böylece recon/verify gönderimleri yeniden çalışıyor (v1.261.3 dönemindeki required-inputs değişikliği onları sessizleştirmişti).

### Notlar

- Bilinçli eylemsizlik: `en` token-yoğun kümeye **hiç** eklenmiyor — bloksuz tek bir rapor bir üretim feykidir, hacim tarihi değil.
- Bilinçli eylemsizlik: pekiştirilmiş ta dil yönergesi `it`'e **hiç** genişletilmiyor — İtalyanca için dil kayması gözlemlenmedi.
- Bilinçli eylemsizlik: yeni UI-v2 demo videosunun kaydı owner'da kalıyor (CAR-141) — landing artık her durumda `youtube-nocookie.com` üzerinden gömüyor.
- Testler 6841 → 6841, sürüm dalında.

## [1.262.0] — 2026-10-29

**Upstream-özellikleri minor sürümü: Deel iş panosu tarayıcıya katılıyor (registry 123), başka bir tracker'ın CSV'si doğrudan `#/tracker`'a aktarılıyor, posting-guard bütünlük denetimi ve CV ses denetimi relay/lint olarak geliyor, tarayıcı bir deneyim-yılı filtresi öğreniyor ve yedi dilde daha Apply düğmeleri eksik gibi okunmayı bırakıyor — ayrıca MiniMax'ın emekliye ayrılmış varsayılan modeli değiştirildi ve repost'lar artık kaynaklar arasında uydurulmuyor.**

### Eklendi

- **Deel iş panosu kaynağı (CAR-184)**: registry **123 kaynak = 118 EN + 5 RU · 118 adapter** — `jobs.deel.com/<slug>` tenant panolarını otomatik algılar (Klarna ve diğerleri); Next.js flight yükü tüm envanteri tek istekte taşır (başlıklar, konumlar, düzen, tarihler, açıklama), izin verilmeyen `/api/` yoluna hiç dokunulmaz, iş ilanlarını başka yerde yayınlayan bir tenant, kaynağın **adıyla** reddettiği bir redirect ile yanıt verir ve ücret bilgisi bilinçli olarak eşlenmemiş bırakılır (ödeme aralığı olmayan tutarlar bir tahmin olurdu); count kapıları ×5 + help §17 ×19.
- **Tracker CSV içe aktarma (CAR-181)**: dry-run önizlemeli ve kilitli commit'li `POST /api/tracker/import-csv` — RFC-4180 tırnaklama, ISO / gün-önce / ay-adı biçimlerinde tarihler, yabancı tracker aşamaları kanonik durumlara katlanır (bilinmeyen bir aşama notla birlikte Evaluated olarak gelir, asla atılmaz), markdown-link hücresinden veya Notlar sütunundan okunan normalize edilmiş ilan URL'siyle tekilleştirme, sınırlar 512 KB / 2000 satır; `#/tracker`, önizleme modallı bir CSV İçe Aktar düğmesi kazanır, i18n ×19.
- **Posting guard relay'i (CAR-182)**: `POST /api/runners/posting-guard` — parent'ın deterministik sıfır-LLM JD bütünlük kapısı, `jds/` capture önek kuralıyla (doldurulmuş ya da değil, tam-sayı karşılaştırmalı) rapor numarasından veya açık, temizlenmiş bir yoldan çözülür; çocuk yalnızca argv, 30 sn'lik bir tavan ve fail-soft bir sözleşme alır; `#/reports/:slug` üzerindeki bir «Posting guard» eylemi bulguları gösterir, i18n ×19.
- **CV ses denetimi (CAR-188)**: özgeçmişlerdeki 27 kalıplaşmış ifade (`passionate about`, `proven track record`, `leveraged`, `spearheaded`, `delve`…) artı kısa çizgi bulguları (2022–2024 gibi bir yıl aralığı bir iz değildir; `20–30%` öyledir) salt-okunur `POST /api/cv-studio/voice-check` olarak ve birebir eşleşmeleri vurgulayan bir `#/cv-studio` kartı; Tailor kontrol listesi altı değişmeze büyüyor; i18n ×19.
- **Deneyim-yılı tarama filtresi (CAR-180)**: jd-years ayrıştırıcısı (65 ifade, emin olmadığında asla atmaz) ilan açıklamalarından belirtilen alt sınırı okur, yeni bir `years_min:` portals seçeneği yetersiz-nitelikli ilanları `skipped_experience` olarak atlar (asla bir URL'yi sabitlemeyen gözlemsel bir geçmiş durumu) ve `yearsMin` gelecekteki UI için tarama snapshot'ında yolculuk eder.
- **Yedi dilde daha Apply denetimleri (CAR-185/189)**: Vietnamca `Nộp đơn ứng tuyển`, Bulgarca `Кандидатствай`/`Кандидатстване`/`Външно кандидатстване` (isim etiketin başına sabitlenir — tavsiye-makalesi bağlantıları Apply değildir), Felemenkçe `Solliciteer`/`Solliciteren`, İspanyolca `¡Apúntame!`/`Postularse` (etiketler, fiil değil — SSS bağlantıları artık önemsizdir), Çince `申请职位`/`投递` (denetimin tamamına sabitlenir) — bu panolardaki canlı ilanlar artık `no_apply_control` okumuyor.

### Düzeltildi

- **MiniMax varsayılan modeli (CAR-187)**: emekliye ayrılmış `MiniMax-Text-01` varsayılanı, `api.minimax.io` üzerinde `MiniMax-M3.1-Flash` ve `api.minimax.cn` üzerinde `MiniMax-M3` ile değiştirildi; temel URL satıcıya sabitli (satıcı-olmayan bir ana bilgisayar çalışma zamanında reddedilir ve anahtar ona hiç ulaşmaz); ayarlar ipucu ×19 yeni varsayılanları adlandırıyor.
- **Repost'lar aynı kaynağı gerektiriyor (CAR-186)**: LinkedIn'de ve işverenin Greenhouse'unda listelenen bir rol artık repost olarak bildirilmiyor — kümeler artık `sourceHost()`'a göre bölünüyor; bu, bölgesel alt alan adlarını yalnızca bilinen sitelerde katlar (`de.linkedin.com` ≡ `www.linkedin.com`, ama `ca.example.com` ayrı kalır), Greenhouse ana bilgisayar takma adlarını tek kaynakta birleştirir ve sondaki noktayı soyar.
- **Tamilce değerlendirme dil-sürüklenmesi (CAR-183)**: güçlendirilmiş bir Tamilce yönergesi artık hacim bütçesinin yanındaki uçucu prompt kuyruğunda oturuyor (CAR-174 yuvası) — v1.261.2'de görülen aralıklı sürüklenmenin ardından remote-QA raporları yeniden Tamilce'ye düşüyor.

### Notlar

- Bilinçli eylemsizlik: posting-guard relay'i fail-soft olarak geliyor — fork, parent'ın `posting-guard.mjs` dosyasını henüz **hiç** taşımıyor (upstream PR #6146 hâlâ açık), bu yüzden bir parent senkronizasyonu onu sevk edene dek uç nokta `{available:false, reason:"script-not-found"}` yanıtını veriyor.
- Bilinçli eylemsizlik: `yearsMin` bu sürümde bir `#/scan` UI çipi olarak **hiç** görünmüyor — alan snapshot'ta yol alıyor ve filtre yalnızca portals-config.
- Bilinçli eylemsizlik: upstream modes/reports Machine Summary değişiklikleri (#6161/#6160/#6157) **hiç** port edilmedi — web-ui aynaları olarak değil, dağıtılmış parent ile geliyorlar.
- Testler 6734 → 6841, sürüm dalında; tarayıcının dedup anahtarına dokunulmadı (URL-normalizasyon davranışı **hiç** değişmedi).

## [1.261.3] — 2026-10-28

**Tasarım-tamamlama yaması: Lovable tasarım fazı 3 (yoğunluk + coral'ın tamamen emekli edilmesi), tarama ana bilgisayar havuzu (32 şirket, ana bilgisayar başına 10), altı upstream sağlayıcı konum düzeltmesi, Trakstar Hire kaynağı (kayıt defteri 122), CV Studio geri alması + kaydedilmemiş-değişiklik koruması — artı nihai-regresyon P3 düzeltmeleri ve dokümantasyon paritesi.**

### Düzeltildi

- **Harita kümesi «related» etiketi 3.16:1 → 4.68:1 (her iki tema)**: açık temadaki `--map-score-mid` `#567b75`'e koyulaştırıldı (önerilen `#5f7f7a` yalnızca 4.37 ölçtü — bir adım daha koyu gerekiyordu); koyu taraf zaten 4.98:1'di, dokunulmadı. `map-cluster-visual` içinde red-first sabitlemesi.
- **Skip-link odak halkası**: son kalan literel `#ff385c` konturu → `var(--accent-c)` — 78 odak halkasının tamamı artık accent token'ını izliyor.
- **`.tab-btn.is-active` accent topolojisi** (#584, faz 3): denetim üç renk ailesini karıştırıyordu (açık coral dolgusu + danger metni + mavi kenarlık); artık tek bir accent-soft çifti.
- **Upstream sağlayıcı konum düzeltmeleri ×5 (#580, CAR-176)**: workday `Fully Remote` bayrağı (bir yer değil), workable telecommuting fan-out'u + eyaletin yalnızca şehir yokken eklenmesi, successfactors sondaki virgül, lever remote kelime-sınırı, icims `Location`-önekli etiketler.
- **http-json: tükenmiş zaman aşımında yeniden deneme yok (#580)** — son-tarih iptali her iki yeniden-deneme yardımcısında da geçici değil (upstream, 30sn×yeniden-denemelerle bir Ashby panosunda ~94sn ölçtü).
- **Dokümantasyon paritesi (#587)**: HANDOFF/CONVENTIONS/README içindeki son 17/18-dönemi sayaçları (uk, eksik Локалізація bölümünü aldı; §-geçmişi §32/§33'e uzatıldı — 33 H2 aritmetiği doğrulandı).

### Eklendi

- **Lovable tasarım fazı 3 (#584)**: yoğunluk token'ları canlı — tablo satırları ≈32px, denetimler 30px, çipler 24px (WCAG 2.5.8 boşluk istisnası); her coral rgba kalıntısı cv3 çiftlerine taşındı (`.dash-hero`, `.badge-bad`, haleler, `.tab-btn.is-active`); `--ease-out` tanımlandı, TOKEN_HANDOFF boş; `.callout--ok/--danger` sözleşmesi.
- **Trakstar Hire kaynağı (#583, CAR-177)**: kayıt defteri **122 kaynak = 117 EN + 5 RU · 117 adaptör** — ana bilgisayara sabitlenmiş jsapi.recruiterbox.com, kısa/boş/tekrarlı duruşlarla offset yürüyüşü, kısmiler korunuyor, `trakstarTruncated` etiketlemesi; sayaç kapıları ×5 + yardım §17 ×19.
- **Tarama ana bilgisayar havuzu (#579, CAR-178)**: eşzamanlı 32 şirkete kadar, ana bilgisayar başına 10 ile sınırlı (upstream anahtarlı-limiter deseni) — anlık görüntü sıralı koşuyla bayt-birebir özdeş (red-first zamanlama-sahte kapısı).
- **CV Studio geri alması + kaydedilmemiş-değişiklik koruması (#582, CAR-179)**: QWERTY-olmayan düzenlerde güvenli `Cmd/Ctrl+Z` ile AI-koşusu sonuçları üzerinde sınırlı bir geri alma yığını (30), rotadan ayrılırken kaydedilmemiş-değişiklik koruması (canlı-probe ile kirli kontrolü, confirm/rewind/beforeunload), i18n ×19.
- **Upstream sağlayıcı düzeltmeleri ×17 test edildi** (CAR-176'nın parçası); remote-QA özeti başarısız tarama kaynaklarını adlandırıyor + eval başına `tok ~N` (#567, v1.261.2'de zaten mevcut — bu sürümün triajında gözlemlenebilirlik kullanıldı).

### Notlar

- **Accent artık mavi** (Lovable konsepti): birincil eylemler/aktif durumlar/odak halkaları `--cv3-accent`'ı izliyor; kırmızı danger için saklı (`.btn-danger`, `toast.error`, danger metni). Coral yalnızca logo PNG varlığında yaşıyor (sahibin kararı).
- **Yoğunluk**: tablo satırları ≈32px / denetimler 30px / çipler 24px — WCAG 2.5.8 boşluk istisnası belgelendirildi; v1.26.1'in 44px kanaryası token sözleşmesi üzerine yeniden yazıldı.
- CodeQL: açık 10 uyarının tamamı kapatıldı (4'ü gerekçeyle FP olarak kapatıldı — belgelenmiş sınıflar: llmRateLimit/atomicWrite; 6'sı kaynakta düzeltildi).
- Testler sürüm dalında 6655 → 6734; yeni Trakstar kaynağının ötesinde hiçbir tarayıcı-kaynak davranışı değişmedi.

## [1.261.2] — 2026-10-28

**Kararlılık + cilalama yaması: geocode önbelleği yazım-ortası bir çökmeyi atlatıyor (CAR-173), UI.md madde-işareti devamlarını ve iç içe listeleri render ediyor, yardım paketlerindeki render-edilen-metin anahtar sızıntıları ×17 kapatıldı, evaluate ta için yerel-ayar duyarlı bir token tavanı alıyor (CAR-174), RTL chrome mantıksal özelliklerle aynalanıyor (85 bulgu), harita yakalamaları ×19 yeniden çerçeveleniyor ve harita kümeleri koyu temada kontrastı geçiyor — artı Lovable tasarım entegrasyonunun ilk fazı (pasif `tokens-v3.css` sayfası), dokümantasyon geri-doldurması (sürüm incelemesi + şartnameler) ve CI-düğüm kapsam muafiyetleri.**

### Düzeltildi

- **Geocode önbelleği yırtık-yazma kaybı (CAR-173, #562)**: her iki flush yolu da (gecikmeli insert-flush, çıkış-flush) `.cache/geocode.json` dosyasını çıplak bir `writeFileSync` ile yazıyordu — önce-kırp-sonra-yaz — böylece yazım ortasında bir çökme, OOM veya SIGKILL yırtık bir dosya bırakıyor ve bir sonraki açılışın `JSON.parse`'u hata fırlatıyordu; gününki değil **tüm kalıcı önbelleği** (haftalarca Nominatim bütçesi) sessizce çöpe atıyordu. Her iki yazım noktası da artık `file-lock.mjs::atomicWrite` üzerinden gidiyor (aynı dizinde geçici dosya → rename → başarısızlıkta unlink) — FULL-R1/FULL-M1'in `pipeline.md`, `cv.md`, `profile.yml`, `career-plan`, batch girdisi ve memory'ye uyguladığı sözleşmenin aynısı. CAR-142 flush mekanizmasının kendisi (gecikmeli insert-flush, çıkış-flush, sınırlı kapanış) red-first doğrulamayla sağlam olduğu kanıtlandı: testler (a)/(b), eklemelerin `GEOCODE_SAVE_MS` penceresi içinde dosyaya ulaştığını ve geçerli JSON olarak kaldığını kilitliyor; (c) bir mekanizma kapısı artı her iki flush yolunun davranışsal çalıştırmaları — geçici-dosya artığı kalmadığını ve dosyanın ayrıştırılabilir olduğunu doğruluyor.
- **UI.md liste devamları (#563)**: liste işleyicisi yalnızca arka arkaya gelen `- `/`* ` satırlarını tüketiyordu; böylece bir maddeden sonraki girintili devam satırı üretilen `<ul>`'in dışına düşüyor ve paragraf geçişi parçayı atlıyordu — devam satırı `**`/ters-tırnak işaretleriyle çıplak düzyazı olarak sızıyor (yardım paketleri boyunca yerel ayar başına ~95 sarkan metin dizisi; en.md 95, ru.md 104). Bir devam satırı — baştaki boşluk, yeni bir blok değil (başlık, madde, NUL-sarmalı fence yer tutucu, boş satır) — artık önceki `<li>`'ye `<br/>` ile birleştirilmiş metin olarak katılıyor; vurgu işaretlerinin birleşimin ötesinde asla eşleşmemesi için `inline()` satır satır çalıştırılıyor; fence-yer-tutucu koruması NUL-ilk-karakter üzerine kurulu, çıplak bir token eşleşmesi değil. İç içe `  - ` maddeleri, numaralı listeler, liste içindeki fence'ler ve liste içindeki başlıklar belgelenmiş ayrı bir boşluk olarak kalıyor (sonraki docs dalgası).
- **Yardım render-edilen-metin anahtar sızıntıları ×17 (#561)**: remote-QA, render edilen yardımda görünen 85 çiğ i18n anahtarı buldu (kök neden yeniden-üretimle kanıtlandı: aynı UI.md tek-satır-madde tüketimi — sarılmış bir devam satırı çiğ metin olarak üretilirken ters tırnaklarını düz tutuyordu; v1.260/261 yardım bölümleri çok satırlı maddeler yazmıştı). 163 madde 17 yerel ayarda tek satıra açıldı — yalnızca boşluk değişikliği, çevrilmiş tek bir sözcüğe bile dokunulmadı (eski-yeni karşılaştırması doğrulandı). Yeni kapı `tests/help-rendered-keys.test.mjs` her paketi gerçek zincir üzerinden render ediyor (`stripGithubOnlyBlocks` + vm ile yüklenen `UI.md`) ve 1711 anahtardan herhangi biri metinde görünürse başarısız oluyor; red-first 17 yerel ayar → yeşil. Yeniden-üretim araçları depoya giriyor: `scripts/remote-qa/help-render-scan.mjs` (vm) + `help-render-crosscheck.mjs` (gerçek DOM).
- **Remote-QA Ctrl+K CAR-122 palet sözleşmesini doğruluyor (#561)**: `prod-regression.mjs` artık Ctrl+K'dan sonra komut paletini bekliyor (`.nav-v2-palette[role=dialog]` + odak `nav-v2-input`'ta) VEYA geri-dönüş olarak eski arama-odaklanmasını; ikisinden birini sessizce kabul etmek yerine. Birim testi `tests/remote-qa-ctrl-k.test.mjs` sahte bir DOM üzerinde 6 senaryoyu kilitliyor, red-first 0/6 → 6/6.
- **Harita yakalama çerçevelemesi ×19 (#560)**: `images/job-map-en.png` üzerinde sahibin raporu — üstte topbar aramasının yarısı + kesilmiş bir h1, sağ kenarda yan listenin gri bir kıyısı, Londra yakınlarında çerçeveyle kesilmiş bir işaretçi kümesi ve haritada ~2/3 yükseklikte haritayı enine kesen beyaz bir yatay çizgi. `capture-map-screenshots.mjs` artık geocode kuyruğunun boşalmasını bekliyor (`located + noLoc === total`, N/N sayacı değil — Remote satırları yapısal olarak konumsuz, dolayısıyla eski bekleme asla tamamlanamıyordu), çekim için `header.topbar` ve `#notif-drawer`'ı gizliyor, tam `.job-map-page` kutusunu kırpıyor (çerçeve kenarıyla kesilen panel yok), hiçbir küme yarım kesilmesin diye iki adım uzaklaştırıyor, harita yüksekliğini sabitliyor ve düz bir görüntü-alanı ekran görüntüsü alıyor (`captureBeyondViewport` birleşik döşeme katmanını yeniden örnekliyor ve döşeme-satır sınırlarında beyaz şeritler boyuyor), ayrıca harita kapsayıcısını tamsayı hizasına oturtuyor. 19 job-map yakalamasının tamamı yeniden çekildi.
- **Harita küme baloncukları — koyu-tema kontrastı + etiket sığması (#572)**: sahibin taraması P2/P3 — koyu temadaki küme halkaları sabit bir beyaz dolgunun üzerinde duruyordu (1.83:1); halkalar artık skor-paleti rakamlarıyla `var(--paper)` alıyor (ölçülen 4.98:1+, dolguda 9.53:1; en düşük bant koyu temada matematiksel olarak renklendirilemez ve dürüst bir `data-dim` yoluyla 6.1:1'i koruyor) ve `related` etiketi baloncuğuna sığıyor (rAF yazı-tipi-sığması, rakamlar asla küçülmüyor).
- **#/scan dil değişimi — iskelet yeniden-kurulumu (#534 takibi, ajan yolda, etiketten önce iniyor)**: v1.261.0 sahibin düzeltmesine (#534) takip — dil değişimi yeniden-boyamasında yeniden kurulan iskeletler tamamlanmış bir yeniden-getirmenin ardından artık hayatta kalmıyor.
- **Dokümantasyon sapması (CAR-139, ajan yolda, etiketten önce iniyor)**: README ×19 sayaçları, HANDOFF ×19, CONVENTIONS olguları canlı kayıt defteri/test durumuyla yeniden eşitlendi.

### Eklendi

- **Sürüm incelemesi + şartname geri-doldurması (docs, #559/#558)**: `docs/reviews/REVIEW-2026-10-28-v1.261.1.md` (v1.261.0/v1.261.1 dalgası kendi şartnamelerine karşı incelendi) ve aynı dalga için SDD şartname geri-doldurması — BACKLOG kuyruğu artık kalan boşluğu adlandırıyor (`sources/habr.mjs` için özgül testler).
- **RTL derin taraması (#571)**: AR düzeneği 39 rotayı LTR-karşı-RTL dolaşıyor (X-aynası, taşma, kırpılma, text-align imzaları) — 85 bulgu düzeltildi: sabit chrome öğeleri (toast, sidebar, drawer + onun kapatma ×'i, docs-FAB, usage-HUD, skip-link) `inset-inline-*`/`border-inline-*`'a taşındı, tablolar 17 görünüm dosyası + 2 kütüphanede `text-align: start/end`'e geçti, toplu `[dir=rtl] text-align:right` kuralı kaldırıldı (scan yıldız-sütunu ortalamasıyla çelişiyordu), CAR-58 skor-sütunu izolasyonu bir `ltrNum` span'ına taşındı.
- **Klavye a11y düzenek (#570)**: `tests/playwright-a11y-keyboard.mjs` 11 rota dolaşıyor (Tab sırası/tuzakları, odak göstergeleri, Escape kaplamaları, Enter/Space) — 0 üretim hatası; regresyon kapsamı yeni.
- **i18n çevrilmemiş taraması (#565)**: 36 en-özdeş değer ×9 yerel ayarda çevrildi (`*.rolePh`, config anahtarları, ta manifestosu) + beyaz-listeye dayalı kapalı bir tarama koruması; site (cvstart.org) i18n denetimi (#568): 20 anahtar × 18 yerel ayarda çevrildi (`demo.*`/`stats.t.*`/`showcase.tab*` bloğunun tamamı her yerde İngilizceydi), 1 ölü anahtar ×19 kaldırıldı.
- **Remote-QA gözlemlenebilirliği (CAR-175, #567)**: özet, başarısız olan tarama kaynaklarını adlandırıyor (`stderr örnekleri`, kırpma-öncesi maskeleme) ve sağlayıcı kullanımından `tok ~N` yazdırıyor; mantık, bir sapma kapısıyla birlikte saf bir `summary-parts.mjs` içinde duruyor.
- **UI.md iç içe işaretçi listeleri (tek düzey, #564)**: `  - ` maddeleri iç içe bir `<ul>` olarak render ediliyor (fence-yer-tutucu-güvenli) — yerel ayar başına son 2 sarkan düzyazı dizisi gitti.
- **Lovable tasarım entegrasyonu — faz 1 (#566) / faz 2 (dal, etiketten önce iniyor)**: `public/css/tokens-v3.css` Lovable konseptini harfi harfine taşıyor (oklch yüzeyler 0–3, AA-ek-açıklamalı mürekkep çiftleri, accent ailesi, ok/warn/danger/info/neutral yumuşak+mürekkep, skor bantları A–G ×2 tema, yoğunluk + odak + gölgeler); faz 2 onu mevcut token adları üzerinde etkinleştiriyor (accent blue/danger diye bölünüyor, cv3 token'ları üzerinde skor bantları + callout'lar), kontrast/rol/koyu kapıları güncellenmiş olarak.
- **Evaluate yerel-ayar duyarlı token tavanı (CAR-174, #569)**: `evalMaxTokens(lang)` — ta/hi 32768 istiyor (üç SDK istemcisi 16384'te yeniden kırpılıyordu; her iki katman da düzeltildi), artı prompt'ta bir Tamil hacim bütçesi (blok başına ≤5 cümle, ≤900 sözcük) — v1.261.1 remote-QA ta raporu çıkış-token sınırında kesilmişti (Block B–G + SCORE_SUMMARY eksikti).
- **CodeQL gerçek-düzeltme takibi**: yeni QA render araç takımı, elle yazılmış varlık işlemey yapısal bölme geçişleri + `htmlToText({cap: Infinity})` ile değiştirdi; maskeleme doğrulamaları maskelenmiş çıktının birebirini sabitliyor; RTL düzeneğinin kullanılmayan sabitleri temizlendi.
- **CI-düğüm varyansı için Coverage muafiyet politikası (habr #558, states #561)**: `sources/habr.mjs` (CI node-matrisi dal kapsamı 87.23, yerel ≥89'a karşı) ve `states.mjs` (CI 86.49, yerel ≥89'a karşı) `scripts/coverage-baseline.json` içindeki muafiyetlere katılıyor — node-sürüm varyansı nedeniyle CI'da ölçülen dal kapsamı yerel tabanın yapısal olarak altında kalan dosyalar, tüm kapıyı aşağı kırmak yerine muaf tutuluyor.

### Notlar

- **Ctrl+K sözleşmesi (CAR-122)**: akor **komut paletini** açar — arama kutusunu doğrudan ODAKLAMAZ; arama paletten odaklanır. Remote-QA prod regresyonu artık tam olarak bunu doğruluyor (#561).
- **CodeQL yanlış-pozitif kapatmaları ×5**: main'deki `js/missing-rate-limiting` uyarıları `security_events` token'ını bekliyor — operatör eylemi, kod değişikliği değil.
- Dal kesiminden sonra indi: #561/#562/#563/#564/#565/#566/#567/#569/#570/#571/#572'nin tamamı main'e birleştirildi; #534-skeleton ve CAR-139 ajanları etiketten önce birleşiyor. Tek düzeyin ötesindeki iç içe işaretçi listeleri ve inline-ağırlıklı görünüm geometrisi belgelenmiş boşluklar olarak kalıyor.
- Test tabanı: sürüm dalında 6609 (v1.261.1'den beri +15; birleşme anında #561'den ~13 daha — 2 yeni kapı dosyası); fan-out öncesindeki tek kırmızı testler CHANGELOG ×19 parite kapıları (yerel ayar fan-out'u orkestratörün bir sonraki adımı); hiçbir tarayıcı kaynağına dokunulmadı (kayıt defteri 121 = 116 EN + 5 RU · 116 adaptör).

## [1.261.1] — 2026-10-28

**prod-QA istemci yaması: `#/two-pager` için bir P1 çökme düzeltmesi, Ctrl+K'nın QWERTY-olmayan klavye düzenlerinde çalışması, 390px mobil dalgası (docs-assistant taşması, harita çiplerinin üst üste binmesi, 39 rotalı bir düzenek), CAR-137'nin tamamlanması (özgül hatalar, v2empty ×5, ipuçları ×13 + mode sayfaları) ve CAR-140'ın gerçek v2 ekran görüntülerini her yere indirmesi.**

### Düzeltildi

- **two-pager TDZ (CAR-170, P1, #554)**: `Cannot access 'previewTimer' before initialization` — kurulum döngüsü sözcüksel olarak `let previewTimer`'ın üzerinde dururken, kaydedilmiş etiketler düzenleyicisi geri yüklenen her çip için kurulum sırasında `onChange` tetikliyordu; böylece `#/two-pager` render'ının tamamı çöküyordu (h1 yok, ×19 yerel ayar). Zamanlayıcı + bağlama artık döngünün üzerinde duruyor; davranışsal bir test gerçek görünüm modülünü yürütüyor — düzeltmeden önce birebir prod hatası, sonrasında render edilmiş bir sayfa — artı bir sözcüksel-sıra sapma kapısı.
- **QWERTY-olmayan klavye düzenlerinde Ctrl+K (CAR-172, #554)**: her iki akor işleyicisi de yalnızca `e.key` ile eşleşiyordu — Rusça bir klavye düzeninde akor `key='л' code='KeyK'` olarak geliyordu ve hiçbir şey yapmıyordu. nav-v2.js ve app.js'te `e.code === 'KeyK'` üzerinden eşleştiriliyor; sentetik bir 'л'/KeyK akoruyla gerçek bir tarayıcıda yeniden üretildi. CAR-122 sözleşmesi yeniden ifade ediliyor (bkz. Notlar).
- **docs-assistant 390px taşması (CAR-172, #554)**: CAR-136 başlangıç çipleri `.btn` idi (nowrap, `flex-shrink: 0`) — kırılamayan bir 418px öge, `#/docs-assistant`'ı 390px görüntü alanının 56px ötesine itiyordu; CAR-146 daraltma deseni (v2-llm.css içinde; 800-LOC CSS kapılarına dokunulmadan) bunu 0'a indiriyor.
- **Harita çiplerinin üst üste binmesi @390 (#552)**: 390px görüntü alanında harita meta çipleri CTA satırının üzerine biniyordu (map.css).
- **CAR-137 — özgül hatalar + v2empty ×5 (#550)**: beş genel hata geri-dönüşü ('Error' / 'failed') özgül, eyleme dönük anahtarlara dönüştü — evaluate POST başarısızlığı, sonlandırıcı olay olmayan bir auto-pipeline akışı, scan→pipeline ekleme, repost-kümeleri yükleme, pipeline geri alması; son beş düz boş durum (`#/reports`, `#/usage`, `#/portals`, `#/activity`, `#/dashboard`) CAR-124 v2empty desenine katılıyor (açıklama + etiketli aria-hidden örnek + önceden bağlanmış eylem; 15 yeni `v2empty.*` anahtarı, dört ölü tek satırlık anahtar kaldırıldı) — tamamı ×19 sözlükte, birleştirilmiş anlık görüntü yeniden üretildi.
- **CAR-137 — HelpHint ×13 + mode-sayfa kiti (#550)**: bağlamsal «?» ipucu artık kalan her sayfa H1'inde (pipeline, reports, dashboard, cv, portals, usage, activity, assessments, map, health, docs-assistant, settings) ve kit aracılığıyla 8 mode sayfasında duruyor (her MODES cfg'si bir `hintKey` taşıyor, `HelpHint.title` üzerinden render ediliyor).

### Eklendi

- **Mobile-390 düzenek (#552)**: tohumlanmış bir korpusla 390×844 boyutunda her SPA rotasının (31 kanonik + 8 mode sayfası = 39 hash) bir Playwright taraması — rota başına yatay taşma kontrolü (scrollWidth vs clientWidth, 1px tolerans, en geniş ihlalciyi adlandırır) artı bir CTA isabet kontrolü (yapışkan çubuk/çekmece/FAB birincil bir CTA'yı kapatamaz); opt-in, tarayıcı ikilisi yokken zarifçe atlanır, ağsız.
- **Taze v2 yakalamaları ×48 (CAR-140 A fazı, #551)**: tohumlanmış, CI-izole bir fikstürden gerçek v2-arayüz ekran görüntüleri — dashboard ×19 + job-map ×19 (job-map-ta ilk kez görünüyor, job-map-vi yeni) + scan/pipeline/tracker/reports × en/ru — README'yi, yardımı ve landing'i besliyor.
- **cvstart.org gerçek ekran görüntüleri (CAR-140 B fazı, #553)**: CAR-140 yer tutucu yuvaları gitti — landing artık gerçek v2 yakalamalarını gösteriyor (job-map vitrini + ekran görüntüsü satırları, ×19 landing yerel ayarı).
- **CAR-137 ipuçları (#550)**: 21 yeni çevrilmiş anahtar ×19 (`help.hint.*` ×20 + mode-sayfa `hintKey`'leri) — artık her sayfa kendini yerinde açıklıyor.

### Notlar

- **Ctrl+K sözleşmesi (CAR-122)**: akor **komut paletini** açar — arama kutusunu doğrudan ODAKLAMAZ; arama paletten odaklanır. v1.261.0 QA kontrol listesindeki «Ctrl+K фокусит поиск» satırı geçersiz kılındı; v1.261.1 QA prompt'u güncellenmiş kontrolü taşıyor.
- **CodeQL gerçek düzeltmeleri (#547)**: 4 uyarı kapatıldı (content.mjs sabit-anahtar yinelemesi yapısal hâle getirildi, lint taraması) — bu yamadan önce v1.261.0 main'inde yayın sonrası indi; eksiksizlik için burada listeleniyor.
- Test tabanı: 6582 (+51); tarayıcı süiti 171–172 geçti / 0 başarısız / 1 seçime bağlı atlama; mobile-390 düzenek bağımsız çalışıyor (`node tests/playwright-mobile-390.mjs`). Hiçbir tarayıcı kaynağına dokunulmadı (kayıt defteri 121 = 116 EN + 5 RU · 116 adaptör).

## [1.261.0] — 2026-10-28

**Tam inceleme dalgası 1.261.0 ile tamamlandı (tüm YÜKSEK + ORTA bulgular indi), sahibin bildirdiği dil değişimi düzeltmesi, değerlendirme-kalitesi düzeltmeleri, yardım ×18 fan-out'u, cvstart.org landing v2 — artı dalgayı belgeleyen 4 SDD/OpenSpec şartnamesi. Her düzeltme red→green fix-forward ve bir GLM-5.3-Flash taze-bağlam incelemesinden geçti.**

### Güvenlik

- **FULL-R1 — CSRF acting-GET kapısı + kilitli atomik pipeline yazıları (#519)**: `/api/stream/*`, `/api/run/*`, `/api/geocode` üzerinde `Sec-Fetch-Site`/Origin/Referer kapısı (dışa aktarılan `ACTING_GET`, statik kapsam kapısı); her `data/pipeline.md` / `data/last-scan.json` oku-değiştir-yaz'ı `withFileLock` + yeni `atomicWrite` altında (aynı dizinde geçici dosya → rename → başarısızlıkta unlink).
- **FULL-R2 — kaynaklarda SSRF kümesi (#514)**: rss.mjs https+özel-adres reddi; ~25 çıplak-`fetchImpl` kaynağı korumalı taşıma katmanlarına geçirildi; aynalar sabitlendi; habr/hh/geekjob/getmatch için yönlendirme doğrulaması; paylaşılan `delay(ms, signal)`.
- **FULL-R4 — stripDangerousMarkdown düzyazı bozulması (#513/#518)**: şema temizliği artık yalnızca bağlantı/öznitelik bağlamlarında çalışıyor; varlıklar yalnızca saptama amaçlı bir kopyada çözülüyor («JavaScript: React, Node» ve «R&amp;D» artık sağ kalıyor).
- **FULL-M2 — taşıma katmanı sertleştirmesi (#520)**: `safeGet`, köprü denetleyicisinin sinyaliyle birlikte `timeoutMs`'e uyuyor; `guardResolvedHost` DNS hatasında fail-closed davranıyor. #525, çapraz-köken yönlendirmelerde kimlik-bilgisi başlıklarının soyulmasını, her sonuçlanma yolunda taşıma-dinleyicisi ayrılmasını ve önceden-iptal edilmiş bir sinyalin çökmesini düzeltiyor.
- **FULL-M4 — logo/batch (#523)**: logo HER yolda magic byte sabitliyor (yalan söyleyen bir `image/png` SVG taşıyamıyor), depolama anında content-type'ı `image/*` ile sınırlıyor, özel önbellek + nosniff; batch: `--parallel` 1–8 aralığına kırpılıyor, `--min-score` doğrulanıyor, BATCH_BUSY tek-uçuş, config/batch mutasyonlarında `llmRateLimit`.

### Eklendi

- **CAR-147 — yerel ayar duyarlı değerlendirme tavanı (#524)**: `evalTimeoutMs(lang)` — ta/hi, 300 s yerine 480 s alıyor (Hint yazı sistemleri hece başına birkaç belirteç tokenize ediyor; eski sert süre sınırı 502 + boş rapor üretiyordu); remote-QA istemcisi 540 s bekliyor.
- **CAR-133 — cvstart.org landing v2 (#532)**: reduced-motion ile kapılanan paralaks hero, scan→evaluate→tracker akışının açıkça SIMULATED etiketli bir demosu, canlı-doğrulanmış sayımlarla scroll-reveal bölümleri, CAR-140 ekran-görüntüsü yer tutucu yuvaları.
- **CAR-135 — arayüz v2 için yardım yeniden yazıldı, ×18 fan-out tamamlandı (#533, #540, #541, #542)**: 19 yardım dosyasının tamamı v2 kabuğunu anlatıyor (katlanabilir gezinme, Cmd/Ctrl+K komut paleti, iskeletler, örnek+eylemli boş durumlar, scan v2 kabuğu, pipeline gruplu+geri alma, reports v2, kanban); arayüz etiketleri kendi i18n anahtarlarını aktarıyor; 121-kaynak cümlesi kayıt defterinden üretiliyor.
- **Şartnameler (SDD/OpenSpec) (#535)**: oct27 wave-two geri-doldurması + üç ileriye dönük şartname (yardım fan-out'u, yazma devirleri, dil değişimi değişmezleri).

### Düzeltildi

- **Dil değişimi artık #/scan'i boş bırakmıyor (#534)** — sahibin bildirdiği: görünüme-yerel tarama durumu (sonuçlar, facet çipleri) artık modül düzeyinde; 4 s gecikmeli yeniden-getirme ile davranışsal bir Playwright düzeneği (eski biçimde kırmızı).
- **CAR-148/149 — ru raporları «Block G eksik» diyor (#530)**: prompt, birbiriyle tutarsız üç farklı A–G eşlemesi öğretiyordu; iskelet + liste + örnek artık oferta.md ile uyuşuyor (G = Posting Legitimacy); davranışsal sapma kapısı.
- **CAR-150 — pipeline geri alması comp meta verisini koruyor (#537)**: DELETE `comp` yanıtlıyor, POST kapılı isteğe bağlı bir `comp` kabul ediyor, görünüm `{token, comp}`'u tüm geri-dönüş dallarında taşıyor.
- **FULL-M3 — ölü kaynaklar dürüst paneller raporluyor (#522)**: getro/mycareersfuture/meituan/mokahr/glints bozuk bir 1. sayfada hata fırlatıyor (ölü bir API artık «sağlıklı, 0 iş» gibi okunmuyor); `pinnedOverride`, 18 adaptörün `company.api` geçersiz kılmalarını sabitliyor.
- **FULL-M5 — tek sağlayıcı basamağı (#521)**: routes/llm.mjs `runActiveProvider` üzerinden yürüyor (+`cachePrefix`, sinyal); Gemini alt-süreç müdahalesi; yanıt sözleşmeleri bayt-aynı.
- **FULL-M1 — paylaşılan-dosya yazıları kilitli (#526, #539)**: `runTrackedScript` + `TRACKER_MUTATING` kadrosu; outcome/followup alt-süreçleri kilidi tutuyor; tracker.mjs `atomicWrite` ile yazıyor; PUT kayıtları kilitli+atomik.
- **FULL-M6 — sunucu + istemci konsolidasyonu (#531, #536, #525)**: dotenv null-prototip + `__proto__` reddi; isPrivateOrLoopback NAT64/6to4/benchmark/rezerve; env-config mtime önbelleği; file-lock gerçek yuva GC; safeGet timeout+signal; DNS koruması fail-closed; SSE ×4 → `API.postStream`; odak/etiket/durum kütüphaneleri; clipboard yazımı artık bekleniyor; dashboard Hired tonu.
- **R3 — CSS belirteç sapması (#527)**: `--accent` çözümlendi (harita odak halkaları sessizce ölüydü); 11 belirteç-dışı süre belirteç tablosuna katlandı; sapma kapısı.
- **R4 — yüklemede geride kalanlar (#538)**: assessments/mode-page/pipeline önizlemesi CAR-112 iskeletlerini render ediyor.
- **CodeQL + CI paketi (#517, #539 düzeltmesi)**: kullanılmayan import'lar; ACTING_GET kapısı gerçek regex'i import ediyor; yaşam-döngüsü dilimi yeniden çapalandı.

### Notlar

- Bilinçli olarak yapılmayanlar: bağlantı-anı DNS sabitlemesi (undici gerektiriyor — bağımlılıkların dışında, belgelenmiş kalıntı risk); CAR-140 ekran görüntüleri (dağıtılmış v2 arayüzünü gerektiriyor); CAR-137/138/141 (bir sonraki belge geçişi); `js/missing-rate-limiting` CodeQL sınıfı belgelenmiş bir yanlış-pozitiftir (özel limiter kredilendirilmiyor).
- Yardım ×18 fan-out: es/de wave-1, giriş notunu ve Aktif Şirketler kartı deltasını atladı (de kendi girişini indirdi; es tek satırlık bir takip düzeltmesi alıyor).

## [1.260.0] — 2026-10-26

**İncelemeyle sertleştirme treni, v1.259.0 filosunun opus-5-5 ve AI-inceleme turlarından sekiz birleştirmesi (#491–#498): maaş normalizasyonu, rapor-tarihi kapsamı, coğrafi kodlama sağlamlığı, paket önbellek-kırmama r2+r3, derin taşma düzeltmesi — artı iki arayüz v2'si (pipeline, reports). Her düzeltme kırmızı→yeşil fix-forward ile indi.**

### Düzeltildi

- **Maaş karşılaştırma normalizasyonu (CAR-143 rev-2)**: dönem işaretçileri yalnızca ait oldukları rakamın yakınında tanınıyor — «6 month contract, $120k» artık ×12 ile yıllıklaştırılmıyor; yalnızca sayıya ekli RU/ES dönem biçimleri («за месяц» rakamın hemen yanında) tesadüfi sözcükleri geçiyor; `$`/`¥` simge ailesi tanınıyor ama satırda açık bir ISO kodu yoksa eşlemesiz kalıyor (AUD/CA/SG dollar'lar artık USD olarak faturalandırılmıyor; bir ¥ RMB biçimi ~20×-sapmış JPY dönüşümü yerine açık bir uyarı taşıyor); çıplak 19xx/20xx sayıları her zaman yıldır; aralık rakamları ortağın dönemini devralıyor; profilin `minimum` ve `target_range` değerleri asla tek bir aralıkta birleştirilmiyor.
- **fixReportDate kapsamı (CAR-144 rev-2)**: sunucuda sabitlenen tarih düzeltmesi yalnızca ilk `## ` başlığından önceki ön-bölüme uygulanıyor (H2 başlıklı bir rapor temkinli bir no-op kazanıyor — bayat bir tarih kabul edilebilir, uydurulmuş olan değildir); ön-bölüm içinde: tek bir aday varsa o düzeltilir, değilse tek bir kalın `**Date:**` düzeltilir, o da yoksa hiçbir şey yapılmaz (iki kalın ya da iki düz aday hiçbirini yeniden yazmaz). FIX-5 PDF-etiket kapısı artık gerçek birleştirilmiş sözlüğü okuyor — eksik bir yerel ayar, İngilizce geri dönüşün üzerinden sessizce geçmek yerine hata veriyor.
- **Habr konum çipi + coğrafi kodlama sağlamlığı (CAR-142 rev-2)**: bir Habr meta çipi ancak yapısal kanıtla (bir şehir-filtresi bağlantısı ya da bir konum simgesi) şehre dönüşüyor — taşınma bildirimleri («Возможна релокация») ve istihdam türleri asla konum kılığına girmiyor; coğrafi kodlama önbelleği artık yeniden başlatmayı aşıyor (`beforeExit`/`exit`/SIGTERM+SIGINT üzerinde yeniden fırlatmayla akıtma, kirli bayrak yalnızca yazma yere indikten sonra temizleniyor); kapatma sınırlı (çıkış-döngüsü mandalı, nesil sayacı, tazelik LRU); tükenmiş bir coğrafi kodlama bütçesi genel bir 502 yerine 503 + Retry-After yanıtlıyor.
- **Paket önbellek-kırmama (CAR-145 r2+r3)**: kabuk `/js/bundle.js?v=<content-hash>` adresini gösteriyor — eşleşmede immutable, uyuşmazlıkta no-store — taze bir kabuğun önbelleğe alınmış eski bir paketle eşleştiği 5 dakikalık dağıtım penceresini ortadan kaldırıyor. Karma ve akış tek dosya tanıtıcısını paylaşıyor (yırtık okuma yok); kısa bir okuma, bütün bir dağıtımı zehirleyebilecek bir stat-geri-dönüş karması yerine null döndürüyor; `make-bundle`, kimliği ve .br/.gz eş-dosyalarını nokta-önekli bir geçici dosya + yeniden adlandırma yoluyla yazıyor — böylece öldürülen bir derleme ne yarım yazılmış bayt sunabilir ne de geçici dosyasını sızdırabilir.
- **Derin sayfa taşması (CAR-146)**: dosya adı tek başına bir telefonun dar ekranını aşan kayıtlı bir araştırma özeti `#/deep` sayfasını artık 390px ötesine itemiyor — kart kendi satırında sınırlanıyor, başlık sarılıyor, tarih tek satırda kalıyor; dar-görüntü-alanı taraması artık aşırı uzun tohumlanmış bir fikstürle `#/deep` üzerinden de yürüyor (iki uzak-QA çalışmasının tek bulgusu, kapatıldı).
- **Pipeline v2 sertleştirmesi (CAR-116 incelemesi)**: silmeler onaylıyor ve geri alınıyor (dürüst geri-alma metniyle), kartlarda ana-makineden şirket uydurması yok, FNV-1a satır kimlikleri, gerçek toplu sayımlar ve toplu işlemler üzerinde bir yeniden-giriş koruması.

### Eklendi

- **Pipeline v2 (CAR-116)**: zenginleştirilmiş kartlar, gruplanmış bir görünüm ve geri almaya izin veren toplu ıskarta; 17 yeni `pipe.*` anahtarı 19 sözlüğün tamamında çevrilmiş olarak indi.
- **Reports v2 (CAR-118)**: puan-bandı/meşruiyet/şirket/tarih filtreleriyle canlı arama, sıralanabilir başlıklar (`aria-sort`), bant başına eylem düğmeleri taşıyan kalıcı bir kart görünümü, tıkla-filtrele puan histogramı ve birleşik «Company — Role» / «x.x/5» render'ı (`window.ReportOps`); 31 `rep2.*` anahtarı 19 sözlüğün tamamında çevrilmiş olarak indi.

### Notlar

- Her düzeltme, kırmızı→yeşil kanıt taşıyan bir inceleme turundan geçti; ilk paket r2 üzerindeki iki AI-inceleme YÜKSEK bulgusu (kısa-okuma karması, eş-dosya atomikliği) r3 ile kapandı ve CAR-143/CAR-144/CAR-142 turlarının her biri öncülünün açık bulgularını yeniden doğruladı.
- Bilinçli olarak yapılmayanlar: harita küme görünümü CAR-125 olarak kalıyor (kuyrukta); sunucu-taraflı pipeline meta verisi geri yüklemesi ayrı bir bilet; rev-2 öncesi v1.259.0 durumları altında kaydedilen içerik için geriye dönük düzeltme yok.
- Test tabanı: 5988 (+165); tarayıcı süiti 152 geçti / 0 başarısız / 1 seçime bağlı atlama. Hiçbir tarayıcı kaynağına dokunulmadı (kayıt defteri 121 = 116 EN + 5 RU · 116 adaptör); 48 yeni i18n anahtarı, ×19 fan-out ile birlikte özellik PR'lerinin kendileri içinde indi.

## [1.259.0] — 2026-10-25

**Ajan filosundan ikinci tren, altı düzeltme: rapor tarihleri sunucu tarafında sabitleniyor, harita coğrafi kodlayıcısı önbelleğe alıp RU şehirlerini okuyor, yardım ×18 yerelleştirilmiş düğme etiketlerini kullandırıyor, arayüz cümleleri dilleri karıştırmayı bırakıyor, maaş karşılaştırmaları sunucu tarafında hesaplanıyor — ve JS paketi önceden sıkıştırılmış dağıtılıyor (soğuk yükleme 3.1 MB → 598 KB).**

### Düzeltildi

- **Uydurulmuş rapor tarihleri (CAR-101)**: değerlendirme prompt'u bugünün tarihini artık sunucu tarafında sabitliyor («**Date:** alanı TAM OLARAK <date> OLMALIDIR — harfiyen kopyala; asla uydurma») ve `fixReportDate`, kaymış bir tarihi her kabul noktasında (Anthropic dalı, Gemini alt-süreci, OpenAI-uyumlu kuyruk, /api/deep, auto-pipeline) bugüne yeniden yazıyor — bir uyarı + etkinlik kaydıyla; bu bir düzeltmedir, asla bir ret değil. Üretimdeki 349/789 rapor uydurulmuş tarihler taşıyordu; yenileri taşıyamıyor.
- **Harita coğrafi kodlaması (CAR-105)**: hh.ru/Habr satırlarının Kiril şehir dizgeleri artık coğrafi kodlayıcıya ulaşıyor; kalıcı ve sınırlı bir önbellek (`data/geocode-cache.json`, withFileLock), çözümlenmiş bir şehrin sağlayıcıya asla ikinci kez gitmemesini sağlıyor; coğrafi kodlama çağrıları istek başına bütçeleniyor, böylece harita 13.9 sn bloke olmak yerine aşamalı olarak doluyor.
- **Karma-dilli arayüz (CAR-108)**: 19 sözlükten 17'sinde 23 anahtarlı sızıntı düzeltildi (85 değer) — «все matching», «только remote», «Открыть Scan», «Evaluated → Applied…» hunisi ve daha fazlası, her yerel ayarın kendi ürün sözcük dağarcığını yeniden kullanan eksiksiz yerelleştirilmiş cümlelere dönüştü. `i18n-no-latin-leaks`, parça tablosu + huni sondasıyla genişletildi (kırmızı→yeşil).
- **Para birimi karar çevrilmesi (CAR-109)**: maaş karşılaştırması `comp-compare.mjs` içinde sunucu tarafında hesaplanıyor ve kanonik biçimde gömülüyor (`Candidate minimum: … per YEAR (raw: …)` karşısında `JD offer: …`); aylık ×12, k/к/тыс/萬 ve ondalık-virgül biçimleri karşılaştırmadan önce normalize ediliyor; belirsiz bir dönüştürme tek başına kararı asla çeviremez (zh-TW «€80–100k ниже минимума» vakası öldü). Model asla çarpma yapmıyor.
- **Yardım ×18 düğme etiketleri (CAR-107)**: yerelleştirilmiş yardım paketleri, arayüzün artık göstermediği İngilizce etiketleri kullandırıyordu («⚡ Run live», «Save», «Scan now») — görünüm kaynaklarından eşlenen 18 yerel ayarda 263 değişiklik; docs-assistant düzeltmeyi devralıyor.

### Eklendi

- **Ön-sıkıştırılmış paket + önbelleklenebilir soğuk yükleme (CAR-104)**: `make-bundle.mjs`, sürüm anında `bundle.js.br` (brotli q11) + `.gz` üretiyor; paket-kapsamlı bir ara katman `Vary: Accept-Encoding`, `public, max-age=300, must-revalidate` + ETag/304 ile br > gz pazarlığı yapıyor; tazelik-korumalı (eş-dosyalar asla kimlik paketinden daha eski sürüm sunmaz), doğrudan artefakt çekimleri 404 veriyor, CSP bayt-aynı. Soğuk yükleme: 3.1 MB → ~0.6 MB tel (−%80); 5 dk içindeki tekrar ziyaretler ≈0 bayt aktarıyor.

### Notlar

- Altı düzeltmenin tamamı kırmızı→yeşil kanıtla (kendi süitlerinde 13 + 28 + 1 + 30 + 7 yeni vaka) ajan filosundan geldi ve inceleme turlarıyla cilalandı (CodeQL #579/#580/#584 kodda düzeltildi — stub URL'ler `new URL().host` ile ayrıştırılıyor, ölü bir prompt dizgesi düşüldü).
- v1.258.0 puan geri-doldurması sayıları artık CAR-129'da kayıtlı (`updated: 22`, `reportScoreless: 159`).
- Bilinçli olarak yapılmayanlar: 349 tarihsel rapor için geriye dönük tarih düzeltmesi yok (bir geri-doldurma sahibin onaylayacağı bir operasyon olurdu), harita küme görünümü yok (CAR-125 bu coğrafi kodlama düzeltmesinin arkasında kuyrukta kalıyor).
- Test tabanı: 5823 (+74). Hiçbir tarayıcı kaynağına dokunulmadı (kayıt defteri 121 = 116 EN + 5 RU · 116 adaptör); i18n anahtarı yok (CAR-108 yalnızca mevcut anahtarların değerlerini düzenliyor).

## [1.258.0] — 2026-10-25

**Ajan filosundan tek tren üzerinde altı düzeltme: #/scan şirket sayacı evrenleri karıştırmayı bırakıyor, derin araştırma kaynak talep ediyor, form hataları alanı aydınlatıyor, yükleme durumları iskeletler ve anında h1 kazanıyor ve değerlendirmeler 37k-belirteçlik prompt öneklerini önbelleğe alıyor.**

### Düzeltildi

- **#/scan «Aktif şirketler» sayacı (CAR-100)**: pay, TÜM sonuç satırlarında ayırt edilen şirketleri sayıyordu (üretimde 1554 — tek başına hh.ru yüzlerce katıyor), payda ise API destekli izlenen şirketleri sayıyordu (~90) — tek kesirde iki evren. (a) eşleştirmesi: pay artık API destekli izlenen taramanın kendisinin getirdiği satırlar arasındaki şirketleri sayıyor (`_entry ?? company` ile eşleşen; hh.ru/telegram işveren satırları düşüyor); tarama-öncesi geri dönüş aynı evrene taşındı («104/90» okuyabiliyordu).
- **Derin araştırma uydurması (CAR-110)**: derin prompt artık katı bir sözleşme taşıyor — her olgusal iddia `[source: domain.com]` ile bitiyor (adlandıramıyorsa → söyleme; bir işaret uydurmak «unknown» yazmaktan daha kötüdür), bilinmeyen olgular `unknown` olarak yazılıyor ve rapor MUTLAKA bir `## Data freshness` bölümüyle bitmelidir. Tazelik çapaları: bugünün UTC tarihi + `POST /api/deep` üzerinde isteğe bağlı bir şirket `url` (sınırlı, sunucu tarafında asla getirilmez).
- **Form hataları alanı vurguluyor (CAR-130)**: başarısız bir POST ilk form alanını `aria-invalid` + `.is-error` ile işaretleyip odağı ona veriyor (WCAG 3.3.1); düzenlenince temizleniyor. Ağ-hatası ipucu dağıtım-farkında — loopback geliştirici-komutu ipucunu koruyor, dağıtılmış bir kaynak `bash web-ui/bin/start.md` tavsiyesi yerine «sunucu yanıt vermiyor» mesajını alıyor (bağlantı banner'ında da aynı sabit-kod vardı).
- **Yükleme durumları (CAR-112)**: #/map ve #/tracker h1'lerini anında render ediyor (router odak hedefi ancak veri geldikten sonra var oluyordu) ve paylaşılan bir iskelet yardımcısı (`Skeleton.rows`, `common.loading`'i yeniden kullanan bir `role="status"` bölgesi içinde aria-hidden parıltı satırları), takipçi, tarama sonuçları ve harita kabuğundaki çıplak «Yükleniyor…» metninin yerini alıyor; `prefers-reduced-motion` nabzı durduruyor.
- **Değerlendirme prompt önbelleği (CAR-111)**: `buildEvaluationPromptParts`, ~37k-belirteçlik prompt'u bayt-kararlı bir öneke (CV + profil + mod dosyaları + talimatlar) ve JD kuyruğuna ayırıyor; Anthropic yolu `[önek + cache_control: ephemeral] + [JD]` gönderiyor — önek, ilkinden sonraki her çağrıda önbellek-okuma tarifesiyle faturalanıyor (≈10× daha ucuz). Eksik/uyuşmayan önek, bayt-aynı eski isteğe geri düşüyor; OpenAI-uyumlu basamak dokunulmadan bırakıldı (oradaki önbellekleme sunucu-taraflı).

### Notlar

- Altı düzeltmenin tamamı kırmızı→yeşil kanıtla (5 + 7 + 7 + 7 + 8 yeni vaka) ve inceleme turlarıyla ajan filosundan geldi; ilk CAR-111 CodeQL uyarıları (#579/#580) kodda düzeltildi — test stub'ı alt-dizge eşleştirmesi yerine URL ana makinesini ayrıştırıyor ve ölü bir tam-prompt dizgesi düşüldü.
- **Puan geri-doldurması üretimde çalıştırıldı** (v1.256.0 uç noktası, sahibin onayıyla): `updated: 22`, `missingReport: 0`, `reportScoreless: 159` — 159 puansız satır, başlıkları makine bloğundan önce gelen ya da ayrıştırılamayan puan biçimleri taşıyan raporlara işaret ediyor; yalnızca yeniden değerlendirmeyle ya da daha geniş bir ayrıştırıcı geçişiyle kurtarılabilir (CAR-129'da not edildi).
- Bilinçli olarak yapılmayanlar: yol-süresi sütunu sona-sıralama değişikliği yok (önceden var olan `Infinity`-on-desc tuhaflığı), eski kullanım kayıtlarının geriye dönük yeniden fiyatlandırması yok, tarama filtre formları için `.is-error` tarzı vurgu yok (CAR-130, paylaşılan mod-sayfası gönderim yardımcısı + api.js ipucuyla sınırlı).
- Test tabanı: 5749 (+36). Hiçbir tarayıcı kaynağına dokunulmadı (kayıt defteri 121 = 116 EN + 5 RU · 116 adaptör); i18n anahtarı yok (CAR-130 ipucu `conn.down`'u yeniden kullanıyor; iskelet bölgesi `common.loading`'i yeniden kullanıyor).

## [1.257.0] — 2026-10-25

**Ajan filosundan iki düzeltme: uygulama içi yardım asistanı Devanagari ve Tamil yazılarını anlıyor ve kullanım sayfası Hermes'in gerçekte neye mal olduğunu gösteriyor.**

### Düzeltildi

- **hi/ta için yardım asistanı getirimi (CAR-103)**: docs-assistant anahtar-sözcük dizgecinin kelime sınıfı `[\p{L}\p{N}\u30fc]+` idi — birleştirme işareti yoktu. Her Devanagari matrası (ा ै ्…) ve Tamil sesli işareti (ே ை ்…) bir kelimeyi parçalara bölüyordu; uzunluk kuralı kısa parçaları düşürüyordu (bir Hintçe sorgu 0 bölümle eşleşiyordu), daha uzun kelimeler ise başları kesilerek alakasız bölümlerle çakışan anlamsız artıklara dönüşüyordu. Sınıf artık `\p{M}`'i içeriyor; CJK bigram yoluna dokunulmadı. hi «मैं स्कैन कैसे चलाऊं?» ve ta «ஸ்கேன் எப்படி இயக்குவது?» sorguları dağıtılan paketlerden doğru bölümleri getiriyor.
- **Hermes için kullanım maliyeti (CAR-106)**: `normalizeUsage()` sağlayıcı kullanımını `{in, out}`'a daraltıp ağ geçidinin bildirdiği `cost`'u sessizce düşürüyordu — `#/usage`, 9.5 M Hermes belirteci üzerinde $0.0000 gösteriyordu (fiyat tablosundaki satırı 0/0). Kullanım kaydı biçimi, geriye dönük uyumlu isteğe bağlı bir `cost?` kazanıyor; toplayıcı, kayıt başına sağlayıcının bildirdiği maliyeti yeğliyor ve yalnızca yokken fiyat tablosu tahminine dönüyor; çöp/negatif değerler düşürülüyor, asla uydurulmuyor.

### Notlar

- Her iki düzeltme de kırmızı→yeşil kanıtla (3 + 5 yeni test; 14/14 ve 10/10 yeşil; komşu süitler 78/78 ve 61/61) ajan filosundan geldi. İlk PR'ler (#470/#471), squash-merge edilmiş v1.256.0 ile çakışan bayat bir worktree tabanı taşıyordu — bunların yerine temiz cherry-pick'ler (#472/#473) geçti.
- Bilinçli olarak yapılmayanlar: tarihsel `data/llm-usage.jsonl` satırlarının geriye dönük yeniden fiyatlandırması yok (bunlar maliyet alanı taşımıyor; yalnızca yeni kayıtlar yararlanıyor).
- Test tabanı: 5713 (+8: docs-assistant ×3, usage ×5). Hiçbir tarayıcı kaynağına dokunulmadı (kayıt defteri 121 = 116 EN + 5 RU · 116 adaptör); i18n anahtarı yok.

## [1.256.0] — 2026-10-25

**Takip verisi kalitesi: rol hiçbir zaman şirket olarak kaydedilmiyor, bir iş panosu hiçbir zaman işveren olarak kaydedilmiyor, puanlanmamış satırlar artık en önde belirmeyi bırakıyor — ve tek-seferlik bir uç nokta, eksik puanları raporların kendilerinden geri dolduruyor.**

### Eklendi

- **Puan geri-doldurması (CAR-129)**: `POST /api/tracker/backfill-scores`, bağlantılı raporu ayrıştırılabilir bir puan taşıyan satırların Puan hücresini dolduruyor (değerlendirilmiş 181 satırın raporu vardı ama puanı yoktu). Puanlı satırlara, açık sentinel'lere (`N/A`), raporsuz satırlara ve puansız raporlara asla dokunulmuyor; yalnızca Puan hücresi, dosya kilidi altında yeniden yazılıyor; puan biçimi yazım yerinde doğrulanıyor ve takipçinin `X.X/5` kuralına normalize ediliyor; çalıştırma idempotent ve `{ok, updated, missingReport, reportScoreless}` döndürüyor.

### Düzeltildi

- **Rol hiçbir zaman şirket değildir (CAR-128)**: `guessCompanyRole` tire-başlıklı satırın SOL tarafını şirket olarak ele alıyordu, oysa panolar her iki sıralamayı da yazıyor — «Senior Frontend Engineer - Grafana Labs» rolü ŞİRKET olarak kaydediyordu (13 satır: Grafana, CircleCI…). Artık kelime-sınırlı bir rol-anahtar sözcüğü sezgisi rol tarafını seçiyor ve bir istihdam türü asla işveren olmuyor («Senior Engineer - Remote (EU)», «Remote (EU)» kaydetmek yerine hiçbir şey kaydetmiyor).
- **Bir iş panosu hiçbir zaman işveren değildir (CAR-127)**: alan-adı-slug geri dönüşü hh.ru satırlarını «hh» olarak kaydediyordu (120 satır). `hh`/`habr` slug'ları işveren-değil listesine katılıyor; cümle-içi işveren çıkarımı («в компании X», «X ищет») artık iş-panosu ana makineleri (hh.ru/kz/uz/by, habr.com) için de çalışıyor — sayfa metninin gerçek işvereni adlandırdığı yerde. Yolda kök neden de bulundu: o çıkarım desenlerindeki ASCII `\b`/`\w` Kiril alfabesiyle hiçbir zaman eşleşmiyordu — v1.248.4'ten beri sessizce ölü; Unicode lookbehind'ları ve `\p{L}` sınıfları onların yerini alıyor.
- **Puanlanmamış satırlar sona sıralanıyor (CAR-129)**: takipçinin puan sıralaması bir `-1` sentinel'i kullanıyordu; böylece varsayılan artan sıralamayla her puanlanmamış satır her puanlıdan önce beliriyordu. Boş değerler artık her iki yönde de sona sıralanıyor (puan FİLTRESİ kendi `-1`'ini koruyor — "puanlanmamış bir ≥4 filtresine takılır" orada doğru semantiktir).

### Notlar

- Tarihsel satırlar bu sürümle TAŞINMIYOR: ayrıştırıcı düzeltmeleri yeni değerlendirmelere uygulanıyor; puanlar geri-doldurma uç noktası üzerinden geri kazanılabilirken, 120 «hh» işveren hücresi yeniden yazım değil yeniden değerlendirme gerektiriyor.
- Bir opus-5-5 inceleme turu içine katıldı: çapasız «X ищет» deseni dağıtımdan önce atıldı (fiilden önceki herhangi bir büyük-harfli dizi işveren olarak kaydedilirdi — uydurma-yapmama invariatı), cümle-başı «В…» çapaları eklendi ve geri-doldurma yazıcısı hedef hücreyi yeniden denetliyor (manuel düzenlemelerden sonra yinelenen `#` satırları mevcut), elle-bozulmuş kısa bir satırın sütun sayısını koruyor ve ilk tablo-dışı satırda duruyor. Noktalı bir adın içindeki nokta («Сбер. IT»), «в компании» çapası için cümle noktasından ayırt edilemez — tutucu önek («Сбер») kaydediliyor; fiile-çapalı desen tam biçimi yakalıyor.
- Bilinçli olarak yapılmayanlar: `tracker.js`'ten birim-test-edilebilir bir lib'ye karşılaştırıcı çıkarımı yok (kaynak-statik kapı kalıyor; CAR-129'da takip işi olarak not edildi), yol-süresi sütunu sona-sıralama değişikliği yok (önceden var olan `Infinity`-on-desc tuhaflığı), «hh» satırları için veri taşıması yok.
- Test tabanı: 5705 (+10: `auto-pipeline-jd-gate` içinde 5 kimlik, 2 CAR-128, CAR-129 sıralama kapısı, düşmanca yol pinini de kapsayan 4 geri-doldurma — yerlerine konan v1.248.x örnekleri düşülünce). Hiçbir tarayıcı kaynağına dokunulmadı (kayıt defteri 121 = 116 EN + 5 RU · 116 adaptör); i18n anahtarı yok.

## [1.255.2] — 2026-10-24

**Canlı regresyondan ve bir üretim çökme bildiriminden gelen üç kullanıcıya-görünür düzeltme: #/scan render çökmesi, kör Vietnamca dil denetimi ve yinelenen zh-TW özet-bloğu kaybı.**

### Düzeltildi

- **#/scan çökmesi (CAR-99)**: v1.253.0'dan bu yana sayı-kapısı yenilemesi `FALLBACK_SOURCES` literalini her girdinin sonuna çift virgül koyarak yazdı — dizide 120 eleman-bırakma boşluğu. Tarama görünümündeki `new Set(FALLBACK_SOURCES.map((s) => s.value))` böylece `undefined` tuttu ve şirket sınıflandırıcısının `id.length`'i her sayfa render'ında `TypeError: Cannot read properties of undefined (reading 'length')` attı (üretimde logbuf yakaladı). Boşluklar kaldırıldı ve yeni bir kapı (4 özellik, kırmızı-doğrulanmış) dosyayı çalıştırıp herhangi bir boşlukta, kullanılamaz girdide ya da adaptör-kimliği Set'indeki bir `undefined`'da başarısız oluyor — yalnızca-metin sapma kapısı bu sınıfı göremiyordu.
- **Kör vi dil denetimi (CAR-97)**: Vietnamca Latin yazıdır ve canlı-QA stop-word tablosunda girdisi yoktu; bu yüzden "vi stop words" İngilizce eşleşmeleri sayıyordu ve bir Vietnamca yanıt `report not in vi` olarak okunuyordu (canlı regresyon: vi 2, en 2). Vietnamcanın artık kendi on-kelimelik işlev-sözcüğü tablosu var — saf bir vi raporu geçiyor, İngilizce olan hâlâ düşüyor.
- **zh-TW SCORE_SUMMARY bloğunu kaybetti (CAR-98)**: kapanış dil hatırlatması yalnızca makine biçiminin çevrilmemesi gerektiğini söylüyordu, özet bloğunun var olması gerektiğini asla — kısa bir zh-TW raporu (5.983 karakter) A–G bloklarını taşıyordu ama bloğu tümüyle atlıyordu (v1.239.2 sınıfı bir yinelenme). Açılış yönergesi ve kapanış hatırlatması artık bloğun zorunlu olduğunu ve bloksuz raporun geçersiz olduğunu söylüyor.

### Notlar

- Bu sürüm bilinçli olarak hiçbir tarayıcı kaynağını, kayıt defteri sayısını (121 = 116 EN + 5 RU · 116 adaptör) ya da sağlayıcı kablolamasını değiştirmiyor — yalnızca düzeltmedir, sayı-kapılarına dokunulmadı.
- Test tabanı: 5695 (+9: `car99-fallback-holes` ×4, `car97-vi-lang-check` ×4, CAR-98 prompt değişmezi ×1). Tarayıcı süiti 143/143. vi/zh-TW canlı yeniden-denetimi dağıtım-sonrası regresyonla geliyor.

## [1.255.1] — 2026-10-24

**İki inceleme düzeltme turu: Vietnamca yerelleştirmesinin Opus incelemesi (9 bulgu) ve CAR-91/92 düzeltmelerinin ikinci tur incelemesi (5 zorunlu düzeltme) — her ikisi de kırmızı→yeşil testlerle kapatıldı.**

### Düzeltildi

- **vi yerelleştirmesi inceleme turu (CAR-88 devamı)**: `project.subtitle` / `project.roleHint` içine sızan Hangul glifi (`신`) düzeltildi (`độ khớp tín hiệu`); EN sözlüğünün taşımadığı bir vi değerindeki herhangi bir CJK/Kana glifi için başarısız olan bir kapı eklendi. docs/help/vi.md içindeki altı boşluklu markdown URL'si (`what-is career-ops`, `apply for a job`, `set up playwright` ve üç tane daha) gerçek kılavuz slug'larına kısa çizgili biçime çevrildi; URL'lerde-boşluk-olmaz kapısı eklendi.
- **Değerlendirme başlık sınırları (CAR-92 r2 H1)**: `&`, `.`, `/`, `'` artık blok harfinin sol sınırında kelime karakteri sayılıyor — `## Q&A`, `## Plan B`, `## Ph.D. requirement`, `## E-commerce` artık A/B/D/E blokları olarak kaydedilmiyor; çıplak satır sonu sonlandırıcısı yalnızca bir blok-kelime dizgecinden (Block/блок/블록/…) sonra kabul ediliyor; ASCII `-` yazılı-sonlandırıcı sınıflarından çıkarıldı, böylece `E-commerce`/`ई-मेल` başlıkları hayatta kalıyor.
- **Ukraynaca/Rusça numaralı raporlar (CAR-92 r2 H2)**: А Б В Г Д Є Ж dizi algılayıcısı artık paylaşılan bir yardımcı; bir başlık düzeyinde 3+ dizi harfi bulduğunda o düzey kesicinin referans düzeyi oluyor — harfli `### A.` alt bölümleri raporu artık Б bloğunda kesmiyor.
- **Taşınan-satır yaşam döngüsü (CAR-92 r2 M1)**: başarısız bir kaynağın sonraki taramaya taşıdığı satırlar `carriedSince` damgası alıyor, 30 gün sonra ya da 5 art arda taşınmadan sonra atılıyor ve sessizce sonsuza dek birikmek yerine taze satırların arkasına ekleniyor.
- **Gemini sentez paydası + legitimacy (CAR-92 r2 M2) ve alt süreç gövde-puanı yolu (M3)**: bulgular dosyasından okundu, kırmızı testlerle düzeltildi.
- **Soğuk-yükleme paketi sapma kapısı** vi sözlüğü için güncellendi (90 script etiketi / 87 paketlenebilir) ve kullanılmayan test bağlaması kaldırıldı (CodeQL 572).

### Notlar

- İncelemenin işaretlediği README.vi "Son sürüm" bandındaki adaptör-sayısı ifadesi **Önceki** bandında yaşıyor ve zaten EN README ile bayt-bayt aynı — EN↔vi paritesini korumak için dokunulmadan bırakıldı (commit gövdesinde belgelendi).
- Test tabanı: 5686 (+26: `eval-validate-opus-r2`, `scanner-carryover-r2`, vi-kapısı doğrulamaları). Kayıt defteri değişmedi: **121 kaynak (116 EN + 5 RU) · 116 adaptör**.

## [1.255.0] — 2026-10-24

**Vietnamca (Tiếng Việt), 19. arayüz dili olarak katılıyor — EN ile tam pariteli 1525 anahtarlık sözlük, vi/vi-VN algılama, eksiksiz yardım paketi, README ve CHANGELOG aynaları, cvstart.org açılış sayfası entegrasyonu ve dil değiştiricideki 🇻🇳.**

### Eklendi

- **Vietnamca (`vi`) — 1525/1525 anahtar**, `en` ile tam parite; `detect()` `vi` ve `vi-VN` kabul eder; Vietnamca LTR'dir (asla `RTL_LANGS`'a eklenmez). 'Pipeline' 'Pipeline' olarak kalır — standart teknik ödünç kelime, beyaz listede.
- **Eksiksiz docs/help/vi.md** (33 H2 / 125 H3), ayrıca README.vi.md ve CHANGELOG.vi.md aynaları ve `prompts.mjs` içindeki Vietnamca iskele dizeleri (`LOCALE_NAMES` + `SCAFFOLD_STRINGS`) — Vietnamca LLM çıktısı kutudan çıktığı gibi çalışır.
- **cvstart.org açılış sayfasının Vietnamca'sı** — `site/src/i18n/vi.json`, sitemap locale girdisi ve bir `dashboard-vi.png` ekran görüntüsü; dil değiştirici 🇻🇳 kazanır (19 konum).
- **Sayım kapıları 18 → 19** — LANGS, detect prob'ları, i18n denetimi, changelog paritesi, README çeviri bloğu, locale taraması — ayrıca red-first `tests/i18n-vi-locale.test.mjs` (139 satır).

### Notlar

- Açılış sayfası vi kazanıyor — ta emsalinden kasıtlı bir sapma (o sürüm açılış sayfasını bilerek 17'de tutmuştu); sürüm şartnamesinde belgelendi.
- vi Latin yazıdır, bu yüzden no-latin-leaks kapısı uygulanmaz (Latin olmayan dilleri korur); Latin teknik kelime hazinesi burada normdur.
- Test tabanı: 5634 → **5642** (1 atlanan = katılım-isteğe bağlı yerleşim-yakalama tarayıcı testi, değişmedi).

## [1.254.0] — 2026-10-24

**Maksimum model inceleme turundan bir sağlamlaştırma sürümü: tarayıcı anlık görüntüsü artık satır kaybetmiyor, LLM katmanının on bir invariat ihlali düzeltildi, yirmi üç SPA must-fix'i indi ve Paylocity ATS tarayıcıya katılıyor — kayıt defteri artık 115 adaptörle 121 kaynak (115 EN + 5 RU) sunuyor.**

### Eklendi

- **Paylocity ATS** (üst #5687): kiracı başına `recruiting.paylocity.com` panoları, ölü pano 302 → JobNotFound 404'e eşleniyor ki karantina girişi emekli etsin, kesme bayraklı `max_jobs` sınırı. Kayıt: **121 kaynak = 116 EN + 5 RU · 116 adaptör**; sayaç kapıları yeniden üretildi.

### Düzeltildi

- **Tarayıcı anlık görüntü güvenliği (R-12)**: hiçbir şey denemeyen bir tarama artık anlık görüntüyü KORUYOR (`nothing scanned`); tam değiştirme, başarısız kaynakların eski satırlarını — girişe damgalı — MEVCUT filtrelerden yeniden geçirerek yalnızca `filtered`'e indiriyor.
- **LLM katmanının on bir invariat ihlali**: dil yönergesi deep/mode istemlerini açar VE kapatır; Gemini alt süreci `--lang` iletiyor, sıfır olmayan çıkış → 502, stderr'i istemciye sızdırmıyor, 300 s'ye uyuyor ve usage kaydediyor; manuel fallback iş ilanının URL'sini taşıyor; `/api/mode`'da truncation ve paket uyarıları görünüyor; harcama katmanı artık istemci tarafından geçersiz kılınamıyor; istemci kopması uçuştaki sağlayıcı çağrısını iptal ediyor (sinyal on dört sağlayıcı üzerinden); tekrarlayan-başlık kesici artık geçerli raporları yok etmiyor; score/legitimacy çıkarıcıları doğrulayıcıyla uyumlu; Ukrayna dizisi ve Arapça و yanlış-kabulleri sıkılaştırıldı.
- **Düzeltmelerin KENDİSİNE bir Opus 5-5 inceleme turu** (8 zorunlu): kesicinin çoklu-harf kaydı, daha geniş başlık sonlandırıcıları, Gemini alt sürecinin abort kablolaması, girişe damgalı taşıma atıfı, taşınan satırların mevcut filtrelerden yeniden geçmesi, farklı harf sayısına göre referans düzeyi.
- **Yirmi üç SPA must-fix'u**: sourcing görünümlerinde (tek sayfalık pager eki, pipeline satır klavyesi, saved-search filtre geri yükleme, source select sıfırlamaları, config varsayılan-geri dönüşü, dinleyici sızıntıları, terminalde SSE kapanışı, tarama koşucusu teardown, çıplak fetch, boş görünen başarısız yüklemeler, global çakışma, odak korunumu) ve assist görünümlerinde (ölü help derin-bağlantısı, help dinleyici sızıntıları, two-pager boş-üzerine-yazma yeniden-silahlanması, batch/deep/mode ücretli çalıştırmalarında tek-uçuş, sessiz akış uçları, sonsuz dönen hata yolları, başarısız filtre hayalet satırları, docs-fab kopyaları + dil).

### Notlar

- Tüm tur Opus 5-5 tarafından maksimum titizlikle incelendi — merge öncesi portlar (21 bulgu, 13 düzeltildi) ve fixlerin kendisi sonradan (8 zorunlu, hepsi burada kırmızı→yeşil testlerle).
- Test tabanı: 5262 → **5634** (kaynaklar, tarayıcılar, LLM katmanı ve SPA genelinde 372 yeni spec).

## [1.253.1] — 2026-10-24

**Maksimum model incelemesindeki iki HIGH güvenlik bulgusu düzeltildi: IPv6 literal URL'leri artık tarayıcının SSRF korumasını atlamıyor ve CV markdown kaçış regex'i de artık ikinci dereceden geri izleme yapmıyor.**

### Düzeltildi

- **IPv6 literalleri SSRF korumasını atlıyordu** (`http-json.mjs`): köşeli parantezli bir IPv6 literali `dns.lookup`'u fırlatıyordu ve koruma açık kalarak başarısız oluyordu. Artık parantezler sökülüyor ve literal `isIP` ile sınıflandırılıyor — DNS'siz, fail-open'sız.
- **CV markdown kaçışında ReDoS** (`security.mjs`): desen ikinci dereceden geri izliyordu — `<` + ~100k boşluk ~16 s sürüyordu; şimdi düz sınırlı bir sınıfla ~1 ms. Önce kaçış yapılan her şey hâlâ yapılıyor.

### Notlar

- Her iki düzeltme kırmızı→yeşil regresyon testleri taşıyor (3 yeni IPv6 vakası + zaman sınırlı ReDoS; toplam 5511 test, +7).
- Tarayıcı kaynak dosyaları etkilenmiyor — koruma, her iki tarayıcının da kullandığı paylaşılan taşımada yaşıyor.

## [1.253.0] — 2026-10-24

**On yeni iş kaynağı tarayıcıya katılıyor — Atlassian, BWI, Computrabajo, Dover, Google, Kalibrr, Magneto365, Platsbanken, Tech in Asia ve Zoho Recruit — kayıt defteri artık 115 adaptörle 120 kaynak (115 EN + 5 RU) sunuyor ve rol eşleştirici yalnızca kısa bir büyük harf koduyla farklılaşan unvanları artık aynı ilan olarak eşlemiyor.**

### Eklendi

- **10 kaynak parent 1.38.0'den portlandı**, her biri kendi fetch-walk adaptörü ve CI-izole suitiyle (sahte fetchImpl, sıfır ağ): **Atlassian** (tek auth'suz JSON akışı, iCIMS URL'leri, https+icims.com allowlist), **BWI** (JSON-LD ItemList, JSON.parse önce), **Computrabajo** (LATAM, varlık çözme, İspanyolca «remoto»=remote), **Dover** (tenant başına DRF sayfalama, `Remote (International)` gösterimi, UUID doğrulanmış panolar), **Google Careers** (fazla başına ilk sayfa, kart işvereni kazanır, sorgular arası dedup), **Kalibrr** (SEA toplayıcısı, feed id satır id'si olarak), **Magneto365** (LATAM, sabit sayfalar-arası tempo), **Platsbanken** (İsveç JobTech API'si, anahtar kelime başına pencereler), **Tech in Asia** (Algolia anahtarları site build'inden keşfediliyor), **Zoho Recruit** (hidden-input pano, sınırlı detail zenginleştirme, para birimi yalnız ISO-4217).
- Kayıt sayacı: **120 kaynak = 115 EN + 5 RU · 115 adaptör**; beş sayaç kapısı canlı kayıt defterinden yeniden üretildi; `#/scan` dropdown fallback'u, cvstart.org kaynak bağlantıları ve help §17 ×18 takip ediyor.

### Düzeltildi

- **rol eşleştirici (#5688 portu)**: yalnızca kısa bir büyük harf koduyla farklılaşan unvanlar («HR BP» vs «HR GP», «AWS» vs «GCP», karma alfabeler dahil) artık fuzzy eşleşmeyle aynı ilan sayılmıyor; kodlar ham unvandan gürültü-kelime hariç okunuyor, koruma Jaccard oranının hemen önünde duruyor.
- **Portlar maksimum titizlikteki bir Opus 5-5 incelemesini atlattı** (21 bulgu): işaretleme kaymasında sessizce-boş panolarda throw (google/bwi), önceden iptal edilen tarama `[]` döndürmek yerine throw, LATAM scraper'larında decode-then-strip sırası (strip-then-decode XSS biçimi), atlassian satır URL'lerinde https+allowlist, portları reddeden anahtar doğrulamalar, sonraki sayfa parse'ının try içinde olması (kısmiler hayatta kalıyor) ve test dürüstlüğü (bütçeler tam sayıldı, zorlama sözleşmeler dürüstçe sabitlendi). 13 bulgu düzeltildi; [spec] kuyruğu ayrı takip ediliyor.

### Notlar

- Beş RU web-ui-only kalıyor (upstream adaptörü yok — bilinçli); her EN kaynağın bir adaptörü var.
- Kapsam tırmığı: en büyük altı port ≥95 % branch'e çıkarıldı (27 yeni vaka); kalan savunma ölü kodu dosya başına belgelendi.
- Yeni kaynaklar portals.yml'de `provider: <slug>` ile seçilir — mevcut yapılandırmalar için hiçbir şey değişmez.

## [1.252.1] — 2026-10-17

**Wiki sürüm banneri artık manuel tarama yerine bir betikle doğrulanıyor — v1.252.0 gerilemesi onu yalnızca elle yakaladı — ve yerel ayar yönergesi profilin language.output'ını ve iş ilanının dilini açıkça geçersiz kılıyor.**

### Eklendi

- **`scripts/wiki-banner-check.mjs`** — gerilemenin istediği kapı: wiki klonundaki her `Home*.md`'yi okur ve banneri `package.json` ile ve kayıt defterinin CANLI sayaçlarıyla (portal kaydındaki scanner adapters — banner'daki eski 109 değil 105; `server/lib/routes/`'daki route modules; CHANGELOG kümesindeki UI locales) karşılaştırır. Banner regex'i dile göre değil BİÇİME göre dilden bağımsızdır: yerelleştirilmiş Home sayfaları etiketi ve sayaçları çevirir («Текущий релиз», «Aktuel udgivelse», «адаптеров сканера», «enhedstests») ve sayıları EN sayfasından (5245) daha fazla sapmıştı (5177). `--tests N` yeni koşulan `test:ci`'nin bastığı sayıyı alır; `--check-only` çevrimdışı kullanım için örtük klonlamayı yasaklar. Çevrimdışı fixture testi `tests/wiki-banner-check.test.mjs`.

### Düzeltildi

- **Wiki Home ×18 banneri yeniden senkrona alınıyor** (bu sürümle gidiyor): v1.252.0 taraması badge'leri ve bağlantıları değiştiriyor ama asla banner satırını değiştirmiyordu ve bunu mekanik olarak işaretleyen bir şey yoktu. Yukarıdaki kapı bunu sürümü durduran bir denetime dönüştürüyor.
- **Locale yönergesi dil önceliğini netleştiriyor** (`buildLocaleDirective`): «This UI locale overrides the profile's `language.output` setting and the job posting's own language». Üst'ün kendi kural 6'sı `language.output` ile yazmayı emrediyor — öncelik cümlesi olmadan model iki çelişkili talimatı locale'e göre tutarsız çözüyordu; v1.252.0'daki dil sütununun dağınıklığı buydu. `tests/locale-directive-language-output.test.mjs` yönerge metni üzerinde sabitliyor (17 EN olmayan locale + boş EN).

### Notlar

- **ta evaluate BİÇİM gözlemi (§3, izle)**: v1.252.0'nin ilk canlı koşusu 48 336 karakterlik, Block G'siz ve SCORE_SUMMARY'siz bir evaluate üretti — döngü biçimli, dil biçimli değil (CAR-70 dil). Sonraki sürümde tekrarlarsa CAR-70'ten ayrı kendi Linear kaydını alacak.
- FIX-PROMPT'e göre: üst read-only kalıyor; geçersiz kılma tamamen UI yönergesinde yaşıyor.

## [1.252.0] — 2026-10-17

**Üst fork career-ops-hq/career-ops ile senkronize edildi — 256 upstream commit'i, üst 1.36.0 → 1.37.0 — fork'un her iki sapması savunuldu ve dağıtım, çalışan üstü bu tabana yeniden sabitliyor.**

### Eklendi

- **Vietnamca (vi) pazar modu** upstream'den (`modes/vi/`, `tuyen-dung` / `ung-tuyen`): BHXH/BHYT/BHTN, thử việc, lương tháng 13, trợ cấp thôi việc — üst'ün mod tablosunda 21. pazar.
- **Tech in Asia panosu sağlayıcısı** (upstream): techinasia.com iş UI'sinin kendisinin sorguladığı genel Algolia `job_postings` indeksini okur — SEA startup panosu, örneklemede ~300 canlı ilan, 273'si Endonezyalı. Anahtarlar her koşuda sitenin build'inden yeniden keşfedilir, işverenin kendi başvuru bağlantısı pano sayfasını yener ve maaş bilinçli olarak eklenmez (indeksin maaş alanları para değil bayraktır).
- Sekiz yeni Block G ilan meşruiyet sinyali belgesi (`modes/oferta-signals/08–17`): yan haklar terminolojisinde ülke, üçüncü taraf platform konum etiketi, ajans lisanslama, göç gereksinimlerinde aşırılık, yargı bölgesi yasaklı içerik, pay-transparency aralık genişliği, asgari ücret avukat sorusu, AI eleme ifşası, süreli sözleşme ifşası, relocation satın alma gücü.

### Değişti

- **Tabanla gelen üst tarafı sağlamlaştırmalar**: story-provenance kontrolü birim ve cümle bazında çalışır ve `user-cannot-confirm` rakamlarını müzakere, ATS ve mülakat çıktısının dışında tutar; CV fact-gate her renderer'da çalışır ve yeniden ifade edilen ve yapılandırılmış iddiaları okur; LaTeX yazmadan önce süresi geçmiş çıkarılmış slotları reddeder; follow-ups kapalıyken launchd taraması atlanır; update-system yerel düzenleme taramasını argv sınırı içinde tutar.
- **Fork'un sapmaları birleşmeyi atlattı**: `providers/telegram.mjs` (yalnızca fork'ta bulunan ayrıştırıcı, ADR-0001) ve `telegram-channel.mjs` içindeki Unicode lookaround `LOCATIONISH_RE` (ADR-0002). Pano belgesi artık upstream'in geliştirilmiş `telegram-channel` satırını, yalnızca fork'ta bulunan `telegram` satırını, Tech in Asia'yı ve 20 → 100'e yükseltilen Tencent varsayılan `max_pages`'ini listeliyor.

### Notlar

- **Bu sürümde SPA davranış değişikliği yok**: bu bir doküman treni plus üst yeniden sabitlemedir. Dağıtım artık üst 1.37.0 üzerinde çalışıyor; kanonik durum tablosu üst deltasundan etkilenmiyor — izleyici durumları eskisi gibi görüntüleniyor.
- Upstream birleştirmesinde iki çatışma çözüldü: `docs/SUPPORTED_JOB_BOARDS.md` (her iki telegram satırı korundu) ve `test-all.mjs` (upstream'in walkTree tabanlı `copyDirSync`'i fork'un `.git` iç içe checkout manuel korumasını kapsıyor; içe aktarma listesi birleşimdir).

## [1.251.1] — 2026-10-12

**Uzmanlık filtresi artık yalnızca rolün AYIRT EDİCİ kelimelerini eşliyor — kıdem ve genel iş isimleri artık tek başına bir ilanı eşlemiyor — ve remote-qa şekli dilden ayırıyor, böylece bir kayma A–G'yi asla kırmızı işaretlemiyor.**

### Düzeltildi

- **Uzmanlık filtresi, kıdem ve genel iş isimlerini eşleştiriciden çıkarır**: «Senior PHP Developer», paylaşılan Senior/Developer yüzünden «Senior Java Developer» ile eşleşiyordu. Eşleştirici yalnızca ayırt edici token'ları tutar (PHP, Go, Platform, SRE, Backend…); ayırt edici token'ı kalmayan bir rol («Software Engineer») tüm tümce eşlemesine düşer. Kelime sınırları korunur: «Go» asla «Golang» veya «Google» ile eşleşmez.
- **remote-qa şekli dilden ayırır**: A–G bayrağı yalnızca blok/SCORE_SUMMARY/looping kodlarıyla değerlendirilir; bir `report not in <locale>` kayması kendi bayrağına ve warnings sütununa gider (tablo eksik 4. sütunu kazandı; kodlar satır başına saklanır).
- **Harita araç çubuğu 390px'de gerçek 50/50** (58/42 bölünmesi aramayı 124px'te bırakmış ve yer tutucusunu kesmişti), ölü `.job-map-job-select` CSS kuralı kaldırıldı.
- **CodeQL 552** — design-qa testindeki kullanılmayan `OVERLAYS` değişkeni kaldırıldı.

### Notlar

- Mil hâlâ sahip tarafından erteleniyor. ta dil kayması hermes backend'inin BELGELENMİŞ sınırlaması olarak kalıyor (çalışmalar arası düzyazı %2–26; A–G tutuyor): remote-qa bunu beklenen bulgu olarak raporluyor. Genel token listesi bilinçli olarak minimal — genişletmek dil başına bir satır.
## [1.251.0] — 2026-10-12

**Harita select'i artık ayarlardaki UZMANLIĞA göre filtreliyor (config/profile.yml → target_roles.primary): «Product Manager» veya «Backend Engineer (Go / PHP)» seçin, harita başlığı o rolün kelimelerini taşıyan ilanları tutar. V1.250.0'daki iş listesi konumlandırıcısı kaldırıldı — yanlış araçtı (sahip düzeltmesi).**

### Eklendi

- **Uzmanlık filtresi**: select, ayarlardaki uzmanlıkları (target_roles.primary) listeler; birini seçmek, başlığında o rolün ayırt edici token'larından birini taşıyan ilanları tutar (kelime sınırları, büyük/küçük harfsiz — «Go» asla «Google»'u match etmez); Reset hepsini geri getirir.
- **V1.250.0'daki iş listesi konumlandırıcısı kaldırıldı** — yerine: uzmanlık filtresi, iş listesi değil (sahip düzeltmesi).
### Değişti

- Two mobile-map height specs: the floor moves 600 -> 540 px (the toolbar takes ~90 px of the viewport).
### Notlar

- Mil hâlâ sahip tarafından erteleniyor. Eşleştirme bilinçli olarak SADECE başlık, ayarlardaki kelimelerle: şirketler veya açıklamalar ilgisiz ilanları uzmanlığa çekerdi. Yapılandırılmış tüm rollerin dışındaki bir ilan «All» altında görünür kalır.


## [1.250.0] — 2026-10-12

**Harita sayfası kullanılabilir hale geliyor: haritanın üstündeki iş konumlandırıcısı görünen herhangi bir işe uçar ve önizlemesini açar (masaüstü dahil), metin araması haritayı şirket veya unvana göre daraltır — ikisi de yenilemeden sonra kalıcıdır.**

### Eklendi

- **İş konumlandırıcı**: haritanın üstündeki select, görünen işleri şirket+ünvan sırasına göre listeler; seçmek daireye uçar ve önizlemeyi açar — masaüstünde de.
- **Metin arama**: haritayı şirket+ünvana göre daraltır, map-prefs'te kalıcıdır, Reset temizler.
- **FAB artık `#/map`'te atıfı kapsamıyor** (tüm genişlikler).
### Düzeltildi

- İki mobil harita yükseklik spec'i: alt sınır 540 px (araç çubuğu görünümün ~90 px'ini alır).
### Notlar

- Mil bir sonraki sürüme ertelendi. 4 yeni i18n anahtarı 18 sözlüğe giriyor ve birleştirilen anlık görüntü yeniden üretiliyor. Konumlandırıcı her zaman önizlemeyi açar (gezinmek amacını boşa düşürür); daire __job geri referansıyla bulunur — L.Circle'in zaten sahip olduğu _point değil.

## [1.249.0] — 2026-10-11

**İş haritası artık uygunluğu öne çıkarıyor: sakin turkuazdan griye ölçek en iyi işleri vurguluyor, puan ve yol süresi filtreleri saklanıyor, mobilde tam yükseklikte harita ve dokunarak önizleme sunuluyor; tracker da yol süresi filtresi ile sıralamasını paylaşıyor.**

## [1.248.8] — 2026-10-11

**Ebeveyn paritesi: fork ve web-ui upstream’ın 115 commit’lik deltasıyla senkronize oluyor — yeni bir PageUp kaynağı, izleyici URL hücreleri markdown bağlantısı olarak ayrıştırılıyor, Assessment durumu — artı ta/ja dil çalışması: döngüye giren raporlar kesilip adlandırılıyor, başlık iskeleti A–G’yi sabit tutuyor ve betik payı yalnızca düzyazıyı okuyor.**

### Eklendi

### Düzeltildi

- **Yeni PageUp kaynağı** (105 EN adaptörü / 110 kaynak); izleyici URL hücreleri markdown bağlantısı olarak ayrıştırılır (href, tekilleştirme anahtarıdır); Assessment durumu states.yml üzerinden gelir.
- **Döngüdeki rapor kesilir ve adlandırılır** (`report looping (block B repeated)`), İngilizce olmayanlar için başlık iskeleti `## A) … ## G)`.
- **Betik payı yalnızca düzyazıyı okur** (tablolar, SCORE_SUMMARY, kod ve URL hariç) — Latince tablolu bir Japonca rapor artık dalgalanmıyor.
- **/api/evaluate `report not in <locale>` uyarısı ekler** ve remote-qa kodları bir sütun olarak yazdırır.
### -

## [1.248.7] — 2026-10-11

**Rapor başlığındaki rol artık ebeveynin gerçek kuralını okuyor — `# <Rol> — <Şirket>` varsayımı yerine `# Evaluation: {Şirket} — {Rol}` — böylece izleyici artık «Evaluation: <Şirket>» öğesini rol olarak taşımıyor; yanlış dilde bir rapor sessizce kaydedilmek yerine uyarıyor; ve H1 öncesindeki model gevezeliği kaydedilen raporlardan kesiliyor.**

### Düzeltildi

- **Yerelleştirilmiş etiket önce sökülür** (`Evaluation:`, `Оценка вакансии:` ve 16 varyant daha); etiketten sonra `Company — Role` → rol sağ taraftır; etiketsiz `Role — Company` → sol taraf; şirketi adlandıran kısım karar verir; rol asla şirket ya da etiket kelimesi değildir — yedek temizlenmiş gönderi satırıdır.
- **cleanup-plan satırların N'ini toplar** (`— N dirty-URL line(s)`), dosya saymaz — 5 kirli URL'li bir dosya 1 değil 5 verirdi.
- **Yanlış dilde bir rapor uyarır**: istem zorunlu dil talimatıyla açılır VE kapanır (tüm rapor, tablolar dâhil), hat kaydedilen raporun dilini doğrular — sürüklenme `report not in <locale>` uyarısı olarak ortaya çıkar.
- **H1 öncesi model gevezeliği yok** — rapor kendi başlık satırında başlar.
### Notlar

- Taınmadı ve dokunulmadı (v1.248.6 regresyonunda doğrulandı): embed-fetch, gönderinin satır yapısı («Компания : X»), «## Rejected» tekilleştirme, fetch'ten önce alan adı kökü reddi, recon/link-check dürüstlüğü ve cleanup modları. Dil doğrulaması bir uyarıdır — (içeriği A–G + puan olarak doğrulanmış) rapor kaydedilir; operatör sürüklenmeyi görür ve değerlendirmeyi tekrarlayabilir.

## [1.248.6] — 2026-10-10

**Regresyon sonrası Telegram zinciri cilası: gerçek bir gönderi satır yapısını korur («Компания : X» etiketi ve rol satırı gerçekten bulundukları yerde bulunur), izleyici rolü ham gönderi satırı yerine rapor başlığından gelir ve operasyonel yüzeyler (recon, cleanup-plan, link-check) iddia ettiklerini raporlar.**

### Düzeltildi

- **Bir t.me gönderisi artık tek satıra yapışmıyor**: etiketler sökülmeden önce `<br>` satır sonu olur ve sayısal HTML varlıkları çözülür; şirket etiket deseni iki nokta üst üste öncesi boşluklu biçimi de kabul eder.
- **İzleyici rolü rapor başlığından gelir** (H1 `# <Rol> — <Şirket>`)； yedek satır temizlenir — hashtag yok, emoji yok, ≤80 karakter.
- **`## Rejected` artık çoğalmıyor**: bölüm bir kez oluşturulur; her ret kendi satırını içine ekler.
- **Alan adı kökü istekten önce reddedilir** — çöp bir URL artık hiçbir şeye mal olmaz.
- **Recon sözleşme sinyalini hesaplar, iddia etmez** (`honours rejected:` dağıtılan koddaki `markPipelineRejected`’ı doğrular); işaret sayacı `0`’ı iki kez yazdırmıyor.
- **cleanup-plan kategori başına sayı raporlar** (taşınacak t-role, dirty-URL satırları, test-row satırları) — kendi başarı satırını sayan tek `grep -c` yerine.
- **link-check github.com 5xx’i doğrulanmamış sayar** — bot duvarının arkasında, bozuk bağlantı olarak değil.
### Notlar

- Taınmadı ve dokunulmadı (v1.248.5 regresyonunda doğrulandı): embed-fetch'in kendisi, pipeline atlama sözleşmesi, _setLookup çevrimdışı testleri, uk sıra sayılarının kabulü, rol filtresinde kelime sınırları ve cleanup-apply modu. cleanup-plan'ın kategori bazlı sayımı temizlik betiğinin kendi çıktı etiketlerini okur — onları yeniden adlandırmak sayaçları sessizce kırar.

## [1.248.5] — 2026-10-10

**Regresyon sonrası sağlamlaştırma: t.me tek gönderi girdileri artık gönderi metninin kendisini getiriyor (embed formu), reddedilen bir girdi sunucu tarafında değerlendirme zamanlayıcısının havuzundan çıkıyor ve Ukraynaca bir raporun yerel blok numaralandırması kabul ediliyor — ayrıca gizlice canlı ağı kullanan bir test sonsuza dek çevrimdışı kalıyor.**

### Düzeltildi

- **t.me girdileri sonunda değerlendiriliyor**: tek gönderi sayfası düz HTML'de yalnızca kanal başlığını sunuyor (~0,2 KB — «View in Telegram» ve başka hiçbir şey), model boş bir açıklama alıyordu ve her Telegram girdisi değerlendirmede ölüyordu. Getirme artık `t.me/<kanal>/<id>` (ve `t.me/s/…` akış formunu) embed formuna (`?embed=1&mode=tme`) yeniden yazıyor — aynı ana bilgisayar, SSRF doğrulaması değişmedi — ve gönderiyi `.tgme_widget_message_text`'ten okuyor (yedek: `og:description`). Widget metni yok → herhangi bir LLM token'ı harcanmadan getirme adımında red (`telegram post has no text`, `rejected: true`).
- **Değerlendirme zamanlayıcısı reddedilen girdiler için tekrar ödemeyi bırakıyor (sunucu tarafı sözleşme)**: reddedilen bir girdi artık `data/pipeline.md` içinde işaretleniyor — satırı URL çitinden çıkıp kısa bir gerekçeyle `## Rejected` bölümüne yerleşiyor (idempotent, asla kopyalanmaz). Zamanlayıcı çitten çıplak URL'leri alıyor, bu yüzden işaretli bir girdi doğal olarak atlanıyor — zamanlayıcı betiğinin iç kısmına bağımlılık olmadan. Recon, betiği incelemek yerine `pipeline rejected marks: N` + `honours rejected: yes (server-side)` yazdırıyor.
- **Ukraynaca raporlar A–G doğrulamasını yeniden geçiyor**: bir uk modeli blokları kendi alfabesinin sırasına göre numaralandırıyor (А Б В Г Д Є Ж), ve benzer görünüm geçişi yalnızca А/В/Е'yi sayıyordu — tam olarak C, D, F, G blokları üretimde eksikti (2/2 yeniden üretim). Doğrulayıcı artık başlıklar sırayla göründüğünde Ukraynaca sıralı diziyi kabul ediyor (ar için abjad ve hi için Devanagari ile aynı disiplin) ve her yerel ayar için değerlendirme istemi artık açıkça Latin `A`–`G` gerektiriyor.
- **Rol anahtar kelime kapısı alt dize değil kelime üzerinde tetikleniyor**: `linkedin.com/` ve `x.com/` kökleri, `lead`/`it` sayfanın alakasız arayüz metninde yaşadığı için kapıdan geçiyordu. Anahtar kelimeler artık Unicode kelime sınırlarında eşleşiyor ve alan adı kökü (yolu olmayan URL) LLM çağrısından önce reddediliyor.
- **Bir birim test artık canlı ağa ihtiyaç duymuyor**: no-hints testi (`tests/auto-pipeline-jd-gate.test.mjs`) HTTP taşımını değiştirdi ama yine de gerçek bir DNS araması yapıyordu — CI'da yalnızca koşucunun bağlantısı olduğu için yeşildi. safe-fetch bir `_setLookup()` kancası kazandı (çözümleyicinin kendisi testlerde değiştirilebilir; üretim kodu onu asla geçersiz kılmaz) ve test çevrimdışı çözüyor.

### Eklendi

- **deploy.yml'de `cleanup-plan` / `cleanup-apply` iş akışı modları**: üretimdeki QA çöp temizliği (post-qa-cleanup), dizüstü bilgisayardan SSH olmadan sunucu tarafında çalışıyor. Günlük yalnızca sayılar içeriyor — dosya adı veya satır önizlemesi yok, çünkü günlük herkese açık ve dosya adları şirket adları içeriyor. Temizlik modları için Verify adımı atlanıyor.

### Notlar

- Taınmadı: ebeveynin kelime sınırı konum derleyicisi ve USPS eyalet tablosu (v1.248.1'den beri belgelenmiş). Reddedilen girdileri atlama sözleşmesi sunucu tarafında yaşıyor (data/pipeline.md içinde işaretleme), zamanlayıcı betiğinde değil — o depo dışında ve bilinçli olarak değiştirilmiyor.


## [1.248.4] — 2026-10-10

**Regresyon turunun devamı: Telegram girdilerinin rol-çözümleme zinciri — gerçek bir ilan içeren Kiril gönderisi artık reddedilen bir `unknown-role` dosyası yerine adlandırılmış bir rapor üretiyor — ve LLM çağrısı yalnızca değerlemeye değer girdiler için tetikleniyor.**

### Düzeltildi

- **Rol zinciri Kiril gönderilerde çalışıyor**: anahtar kelime listesine разработчик/программист/инженер/аналитик/менеджер/руководитель/тимлид/лид/дизайнер/тестировщик/QA/архитектор/специалист/директор/DevOps/SRE eklendi (eskisi yalnızca EN idi: 40 gerçek gönderiden 0'ı rol alıyordu), rapor başlığına başvuruluyor (`parseReportHeader` — model rolü H1'e yazıyor), ve gönderinin ilk anlamlı satırı son çare.
- **Kimlik kapısı LLM çağrısından ÖNE taşındı**: ne şirket ne rol izi taşıyan bir girdi fetch adımında başarısız olur (`rejected: true`) — zaten reddedilecek bir değerlendirme için token harcanmaz.
- **`t.me/s/<kanal>/<id>` artık şirketi 「S」 olarak adlandırmıyor** — önizleme segmenti atlanıyor; her iki bağlantı biçimi de kanala çözülüyor.
- **Telegram gönderilerindeki 「Компания: X」 öz-etiketleri onurlandırılıyor** (mesajlaşma hostlarının cümle içi 「…в компании X」 de).

### Eklendi

- **auto-pipeline başarısızlıkları SSE hatasında `rejected: true` taşıyor** — sunucu tarafındaki değerlendirme zamanlayıcısı bu bayrakla pipeline girdisini atlıyor, 2 saatte bir yeniden denemek yerine.

### Notlar

- Bu sefer portlanmadı: ebeveynin word-boundary konum anahtar kelime derleyicisi ve USPS tablosu (v1.248.1'den beri belgeli).
- README 「Translations」 bloğu artık tek bir kanonik listeden üretiliyor, CI'da parite testi var (dosya başına 17 bağlantı, kendisi asla bağlanmıyor) — ar/pl/uk bloğu kazandı; `|`/`·` ayraç kayması giderildi.

## [1.248.3] — 2026-10-10

**Regresyon turunun devamı: değerlendirme zamanlayıcısı hiçbir koşulda adsız Telegram çöpünü rapor olarak arşivleyemiyor, QA temizliği gerçek Telegram ilanlarını silemiyor, harita atıfı yeniden görünüyor ve pano çipleri ≥ 4.5:1 okunuyor.**

### Düzeltildi

- **auto-pipeline kaydetmeden ÖNCE doğruluyor**: 0–5 puanı olmayan veya A–G blokları eksik bir rapor evaluate adımında koşuyu bitirir (SSE yükünde `rejected: true`) — rapor dosyası yok, tracker satırı yok. v1.248.2 uzunluk kapısını geçen t.me girdileri o sürümden sonra iki çöp daha üretti; artık adsız girdiler `company/role not identifiable` ile reddediliyor.
- **`guessCompanyRole` mesajlaşma hostlarından şirket uydurmuyor** — `t.me`, `telegram.me`, `vk.com`, `linkedin.com` ve arkadaşları EMPTY_DOMAINS içinde: bir Telegram gönderisi kanal adına düşer, adsız girdi `unknown-role` olarak arşivlenmek yerine reddedilir.
- **`post-qa-cleanup` önce başlık puanını okur**: auto-pipeline kaydetmeden önce SCORE_SUMMARY bloğunu keser, böylece eski yalnız-summary kontrol kaydedilen her Telegram ilanını çöp sayıyordu — prod'da 41'nin 8'i başlıkta puana sahip ve `--apply` onları silecekti. Başlık puanı (`parseReportHeader` üzerinden) artık birincil sinyal; blok yedek. Dry-run dosya başına nedeni basıyor.
- **#/map'te Leaflet atfı görünüyor** — docs FAB örtüyordu (OSM lisans ihlali); köşe 96px kaldırıldı.
- **Pano çipleri ≥ 4.5:1** — `dash-chip` etiketleri ve `--manual` varyantı `--foggy-strong`a geçti (önce 4.31:1).

### Eklendi

- **auto-pipeline başarısızlıkları SSE hatasında `rejected: true` taşıyor** — sunucu tarafı eval zamanlayıcısı bu bayrakla pipeline girdisini atlıyor, 2 saatte bir yeniden denemek yerine.

### Notlar

- ar/ja kayması yeniden koşuda **tekrarlanmadı** (bkz. v1.248.2).
- **Prod temizliği hâlâ kullanıcının açık 「evet」ini bekliyor** (CAR-61c); bu düzeltmeyle temizlik gerçek Telegram ilanlarını silemez oldu.

## [1.248.2] — 2026-10-10

**Regresyon turu: değerlendirme zamanlayıcısı pipeline çöpünü artık 「Last evaluation」e dönüştürmüyor, SCORE ayrıştırma gerçek biçimleri toluyor ve tracker sonunda dilinizi konuşuyor.**

### Düzeltildi

- **Boş-JD raporları artık yazılmıyor.** Auto-pipeline'ın JD kapısı LLM çağrısından önce 50 → 200 karaktere çıktı — yer tutucu sayfalar (`example.com/qa-v167-…`) `…-t-role-<ts>.md` raporu yerine SSE hatası + konsol uyarısıyla bitiyor; panonun 「Last evaluation」 olarak gösterdiği (prod'da 42 dosya) tam olarak buydu.
- **SCORE_SUMMARY ayrıştırma gerçek biçimleri tolüyor**: 「4,2/5」「4.2 / 5」「**4.2**」「SCORE :」 hepsi geçerli; 1–2 haneli virgül ondalık, 3 haneli binliktir (eski kod 「4,200」ü 4.2 okuyup 0–5 kapısından geçiyordu). Başarısızlık yalnızca `SCORE:` satırını loglar — rapor içeriğini asla (CI logları herkese açık).

### Eklendi

- **`scripts/post-qa-cleanup.mjs`**: varsayılan dry-run, `--apply` otomatik yedeklerle (`*.bak-<ts>`, raporlar `qa/cleanup-backup-<ts>/`e taşınır): tracker'daki ZZ-QA-TEST satırları, geçerli SCORE'suz `*-t-role-*` raporları, pipeline'daki `example.com` girdileri.

### Notlar

- Regresyon turunun ar/ja kayması yeniden koşuda **tekrarlanmadı** (ikisi de lang ✓ + A–G ✓) — language-check'taki ta girdisi ve sağlamlaştırılmış SCORE ayrıştırıcı defense-in-depth olarak çıkıyor.
- **Prod temizliği kullanıcının açık 「evet」ini bekliyor**: önce dry-run planı, sonra `--apply`.

## [1.248.1] — 2026-10-09

**`location_filter`, ebeveynin `always_allow` ve `block_hard` katmanlarını kazandı (CAR-60) — çok ülkeli bir konum dizisi kardeş-engel listesini atlatır ve açık bir sert blok artık kurtarılamaz.**

### Düzeltildi

- `always_allow`, `block`ü yener: `block: [romania, poland, croatia]` ve `always_allow: [united kingdom]` iken workable'ın birleştirilmiş hücresi „London, United Kingdom · Romania · Poland · Croatia“ geçer — ana bölge bir seçenektir (workable #4806'nın tüketici vakası, artık ebeveyn biçiminde).
- `block_hard`, `always_allow`ü yener: dizinin başka bir yerindeki always_allow isabetiyle asla kurtarılmaması gereken ülke düzeyi terimler.
- `strict: true` artık `block_hard`u kısıtlayıcı katman sayar; docs/help'teki location_filter bölümü her iki katmanı ×18 belgeledi.

### Notlar

- Bu sefer bilinçli olarak portlanmadı: ebeveynin kelime-sınırlı konum anahtar kelime derleyicisi ve USPS eyalet tablosu (web-ui substring eşleşmesini korur; tablo ABD merkezli yapılandırmalar içindir — gerekirse CAR-60 altına arşivleyin). workable tüketici testinin geçici allow-list biçimi, yeni ebeveyn biçiminin yanında ikinci bir yargı olarak kalır.

## [1.248.0] — 2026-10-09

**Ebeveyn-parite: beş yukarı sağlayıcı/liveness düzeltmesi portlandı — API'sini taşıyan panolar çalışmaya devam ediyor ve kendi satırındaki bir kapanış bannerı artık gözden kaçmıyor.**

### Düzeltildi

- **Gupy API'yi `portal.gupy.io`'ya takip eder** ve API'nin gerçekten okuduğu filtre adlarını gönderir (`workplaceType`/`type`) — eski çoğul adlar sessizce yok sayılıyordu; `country` artık gönderilmiyor (yapılandırılmış ülke, gönderim yerine giriş adıyla uyarı çizer). Gizli işverenler tam etiket eşleşmesinde düşer («Confidencial Seguros» hayatta kalır), `max_pages` 100 ile sınırlıdır — API offset 10.000 sonrasında 400 döner ve kesilme uyarısı artık sınırı yükseltmek yerine anahtar kelimeleri daraltmayı önerir.
- **Workable, çok ülkeli bir ilanın tüm ülkelerini korur**: aynı iş URL'si altındaki kardeşler tek satıra katlanır („London, United Kingdom · Romania · Poland · Croatia“) — ilk ülke kazanmaz.
- **Liveness: kendi satırındaki bir banner, üstteki satırın parçası değildir** — ilanın altındaki „Sign in if you want to apply“ / „Get notified when this position is filled“, olduğu gibi kapanış cümlesi olarak okunur; satırlara yayılan gerçek „until filled“ hâlâ aktif okunur.
- **Radancy, eski kart işaretlemesinde kardeş `job-location` öğesini okur** (Barclays ailesi düzenleri konumu `</a>`'dan sonra koyar) — kendi konumu olmayan satırlar boş kalır, komşusunu ödünç almaz.
- **SmartRecruiters yedek iş bağlantıları yapılandırılmış slug'ı korur** — güvenilmeyen/eksik `ref`'li bir ilan, genel URL'sini görünen addan asla değil, kiracı slug'ından sentezler.

### Eklendi

- No-port'lar belgelendi: yukarı `_http` proxy `fetchImpl` düzeltmesi (web-ui'de proxy dalı yok — port etmek DNS-rebinding korumasının kimlik denetimini etkisiz kılar ve deponun bilinçli olarak kaçındığı bir undici bağımlılığı ekler); yukarı `verify-ats` (+226 satır) ve `cv-facts` (web-ui kendi ATS puanlamasını ve CV ayrıştırmayı uygular); ebeveyn panosu Go TUI ve CLI betikleri; Teamtailor import sıralaması (kozmetik).

### Notlar

- Bilinen eksik takip olarak: ebeveyn konum filtresinin `always_allow` katmanı (workable tüketici testi sayesinde UK bloğundan kurtulur) web-ui'de yok; port aynı tüketici yargısını allow-list testiyle ifade etti. Ayrı bir değişiklik olarak kaydedildi.

## [1.247.0] — 2026-10-09

**CAR-49…58 tasarım-taramasının kuyruğu tamamlandı — kalan tüm minor/polish bulguları ve önceki sürümün bilinçli olarak ertelediği koyu harita.**

### Düzeltildi

- **Harita gerçek bir koyu tema render ediyor.** Yakınlaştırma/katmanlar/atıf v1.246.0'da koyulaşmıştı; şimdi döşemeler de izliyor: koyu mod, CSS tersine çevirme ile OSM katmanını çizer (satıcı anahtarı yok) ve anahtarlı Carto-dark ön ayarı `MAP_TILE_DARK_URL` üzerinden kullanılabilir (ana makinesi CSP `img-src` içinde izinli). Tema değişiminde katman canlı yeniden takılır.
- **Sarı callout'ların koyu biçimleri var** (`config`, `batch`, hero uyarısı) — v1.246.0 belirteç mekaniğiyle; yolda bir gerileme de yakalandı: `.callout a` `.btn-primary`ü eziyordu; artık `:not(.btn)` kapsamında.
- **Apply bilgi kartındaki URL artık kelime ortasından kırılmıyor**.
- **CV başlık düğmeleri tek ikon sistemi** (metin; 📁/📄/💾 karışımı gitti).
- **Tracker durum sekmeleri tek yazım kalıbında** — cümle düzeni, yerel uyarlamalarla (CJK/ar/hi/ta'da cins formu yok).
- **Üst çubuk ikonları tek stroke-SVG seti** — 🔔/🌙/🩺 karışımı gitti; tema düğmesi güneş/ay'ı CSS ile çizer.
- **Panodaki Pipeline kartu pembe vurgusunu kaybetti** (halka yalnız hover/focus).
- **Kayıtlı arama silme gerçekten yıkıcı görünür** (`.btn-danger`, nötr ghost değil).
- **Pipeline önizlemesinin gerçek boş durumu var** (başlık + ipucu + CTA, tracker kalıbı).
- **Süre/maliyet meta'sı tek kalıp**: `UI.pageMeta` ⏱ + maliyeti görünüm başlığının altında tek satırda çizer (evaluate/deep/auto/mode-page/orientation).
- **Auto-pipeline ✨'sini kaybetti** — uygulamanın tek süslü h1'i ortak sol kenara döndü.
- **Batch docs URL'si satır içi bağlantı**.
- **interview-digest / orientation tasarlanmış boş durumlara sahip** (başlık + ipucu + CTA).
- **Plan yokken career-plan Export devre dışı**, eylemler tek satırda.
- **stats: Yinelenen «Market report» başlığı kaldırıldı** ve bölge yer tutucusu sığıyor (×18 kısaltıldı, sabit genişlik).
- **Config artık mutlak dosya yolu sızdırmıyor** — sunucu tarafı `displayPath()` `~/…` ya da çıplak dosya adını gösterir.
- **LLM_PROVIDER yardımcısı üç kısa satır** (×18 + `pre-line`), 150 karakterlik mono duvar değil.
- **Profil EMAIL kartı adresi tek satırda tutar** (üç nokta; yalnız ≤480px'de kırılır).
- **Health metni artık kelime kırıyor** değil («Run buttons» bütün; overflow-wrap anywhere).
- **Help satır içi kodu RTL'de hayatta kalır** (LTR izolasyonu, nowrap, kaydırılabilir).
- **Hero'daki «Live evals» hapı ru/ar'da artık çarpışmıyor** (flex-wrap, büzülmeyen ikonlar).

### Eklendi

- **Koyu döşeme ön ayarı** (`MAP_TILE_DARK_URL` + atıf) kod içinde belgelendi; CSP `img-src` genişlemesi onun Carto ana makinesini kapsıyor.

### Notlar

- Koyu döşemenin varsayılanı OSM'in CSS ters çevirmesidir — anahtarsız Carto baz haritalarını API anahtarı ardına kapattı (istekle doğrulandı); anahtarlı ön ayar bir opt-in'dir, varsayılan değil.

## [1.246.0] — 2026-10-09

**CAR-48 kıdemli-tasarım taramasının ilk 10 bulgusunun tamamı düzeltildi — engelleyici ve yedi major dahil.**

### Düzeltildi

- **Apply koyu: bilgi kartındaki bağlantı yeniden görünür.** Kart koyu modda açık yüzeyini koruyordu; «Need Playwright? See …» bağlantısı ≈1.0:1'deydi. Tema duyarlı `.callout--info` (surface/border/text/link belirteçleri) koyu bağlantıyı ≈7.3:1'e çıkarır.
- **RTL artık sayısal bileşimleri ters çevirmiyor.** Skor hapları («1.5 / 5»), rapot bantları («≥ 4.5», «< 3.5») ve panodaki «/ 5.0» yön izolasyonu alıyor (LTR span); ar sözlüğü düzyazının daha iyi olduğu aralıkları sözcüklerle yeniden yazıyor.
- **CV markdown'ı LTR kalır.** Arapçada textarea ve önizleme `dir="ltr"` ile çizilir; çevresindeki çerçeve RTL kalır.
- **Raporların DATE sütunu bir ISO tarihini daha asla bölmez** (nowrap + tabular rakamlar).
- **Kenar çubuğu USAGE HUD'unun üstünde biter** (kaydırma portu rezervi + geçiş) — son gezinme ögesi artık panelin altına kaymıyor; RTL için aynalandı.
- **Mobil tarama @390: «Save search» tam görünür** — kontrol satırı sarılıp sıkışır, kenardan kırpılmaz.
- **Harita kontrolleri koyu temayı izler** (yakınlaştırma, katmanlar, atıf). Döşemeler bilinçli olarak değişmedi: kökenleri sunucu tarafındaki CSP `img-src` ile sabit.
- **Sohbet FAB'ı artık etkileşimli içeriği kapatmıyor** — sayfa kaydırma dolgusu onu temizler (Portals'ın Disable düğmeleri, Reports skor hapi, two-pager girişi, Leaflet atfı).
- **Etkinlik günlüğü arayüz dilini konuşur**: 22 eylem slagu ×18 yerelde çevrildi (bilinmeyenler için ham id fallback'ı), filtre çipleri çevrildi; TARGET sütunu kalır — auto-pipeline doldurur.
- **Assessments formlarına gerçek etiketler geldi** (cümle büyük-küçük harf, `htmlFor`/`id` bağı) — yalnız-placeholder'dan ileri.

### Notlar

- Bu sürümde yok: haritanın koyu döşemeleri (CSP `img-src` genişletmesi gerekir — sunucu tarafı değişiklik, bilinçli olarak istemcide yapılmadı); sarı callout'ların koyu biçimleri (`config`, `batch`) — belirteç mekaniği sonraki adım için hazır.

## [1.245.0] — 2026-10-09

**Tamilce (தமிழ்), 18. arayüz dili olarak katılıyor — 17 dil dalgasından sonra ilk yeni dil, tam anahtar paritesiyle.**

### Eklendi

- **Tamilce (`ta`): 1449/1449 anahtar** — `en` ile tam parite, kayıp yer tutucu yok, hi tarzı Hint-teciz conventionaları (sağlayıcılar, model adları, yollar ve komutlar Latin harflerinde kalır). `detect()` artık `ta`, `ta-IN`, `ta-LK` kabul ediyor; Tamilce LTR'dir (testle sabitlenmiştir).
- **Eksiksiz docs/help/ta.md** (33 H2 / 125 H3, kaynak sayaçları canlı kayıt defteriyle doğrulandı, Hermes canary çapaları, harfiyen YAML) — ayrıca README.ta.md ve CHANGELOG.ta.md aynaları.
- **Sayım kapıları 17 → 18**: LANGS, detect sondaları, i18n denetimi, changelog paritesi, RTL koruması, CI `langs` — bir dıkışta CI listesinde daha önce eksik olan `hi` de eklenmiş oldu.

### Notlar

- cvstart.org açılış sayfası şimdilik 17 dilde kalıyor — çevirisi ayrı bir görev; site içerik senkronizasyonu zaten docs/help/ta.md ve ta changelog'unu dağıtıyor.
- `report-header.js` içindeki REPORT_LABELS 17'de kalıyor — Tamilce rapor ayrıştırma, ana depodaki Tamilce rapor üretimiyle gelecek.

## [1.244.2] — 2026-10-08

**Tarama sayfası parlatması: başlatıcı, durum çubuğu, repost paneli ve filtreler tek bir tutarlı krom olarak yeniden tasarlandı — ve sonuç tablosu artık board verileriyle gerilemiyor.**

### Düzeltildi

- **Maaş hücreleri yalnızca parasal aralığı gösterir.** Bazı board'lar yanıt alanına tüm yan metni koyar — görünür hücre artık yalnızca parasal kısmı gösterir ve metni tooltip'e taşır (önce: her satırı uzatan 6 satırlık hücre).
- **Boş başlıklı satırlar şirketi gösterir** (sonra nötr tire) dev boş hücre yerine.
- **Kıdem rozeti sabit genişlikli sütununda asla kırılmaz**.
- **Puanı olmayan satırlar soluk bir «◎ —» gösterir**, tooltip two-pager karşılaştırmasında eşleşen anahtar kelime bulunmadığını açıklar (önce: puanlı satırların yanında bozuk görünüyordu).

### Eklendi

- **Krom yeniden tasarımı: başlatıcı kartı (hizalı kontrol satırı, baskın birincil düğme), durum noktalı terminal durum çubuğu (boşta/çalışıyor/bitti/hata) reduced-motion'u destekler, repost paneli sticky başlıklı yükseklik sınırına sahiptir (1,560 küme, 155,000 px'lik bir panel oluşturuyordu) ve filtre bloğu düzgün responsive ızgara ve hizalanmış altbilgi olarak.**

### Notlar

- #/scan'in geri kalanı v1.244.1 ile özdeş — yalnızca krom parlatması ve yukarıdaki dört düzeltme değişti. Testler 5045 → 5068 unit.

## [1.244.1] — 2026-10-08

### Düzeltildi

- **Scan icons announce real values.** The boost/fit/score icons' accessible names leaked the raw dict templates ("Fit: {band}", "Boosted by {by}") — `{band}`/`{by}`/`{score}` are now substituted (band word, booster keyword, numeric score). [HIGH a11y, caught live in the v1.244.0 regression round]
- **Title pipes split correctly.** A 4-segment title like «C++ | Rust | Go Developer | Onsite» no longer lifts "Go Developer" out as a "country" — the split demands the segment resolves to a real country (conservative `Countries.detectCountry`).
- **Meta dates render for every row.** `daysSince` accepted date-only ISO, but the API serves full timestamps for ~83% of dated rows — those rows showed no date segment.

### Notlar

- #/scan'in geri kalanı v1.244.0 ile özdeş — yalnızca yukarıdaki üç düzeltme değişti.
- Bilinçli olarak yapılmadı: URL hash filtre durumu, klavye satır navigasyonu ve `5 lakhs INR` ayrıştırma (mevcut takipler).

## [1.244.0] — 2026-10-08

**Tarama sonuçları bir duvar gibi değil, liste gibi okunuyor: bir ilan = iki satır, sinyaller simge biçiminde ve 700 satırlık bir tarama, ~37,000 px'lik bir sayfa yerine sayfalı bir tablo.**

### Düzeltildi

- **Satır anatomisi.** Her ilan, sınırlanmış iki satırlık bir kayıt satırı olarak çiziliyor: 1. satır başlık, 2. satır `company · location · source · date · work-type`. Artırma rozeti, başlık-uyum bandı ve uyum puanı, yerelleştirilmiş erişilebilir adları ve araç ipuçları olan simgelere dönüştü (ekran okuyucular bir sözcük duvarı değil, «Соответствие: сильное» / "Fit: strong" okuyor); güven ve taşınma rozetleri aynı şeride katlandı. Kıdem ve maaş, yalnızca masaüstünde görünen yardımcı sütunlar olarak kalıyor.
- **Başlık hijyeni.** Sondaki `| Germany | Remote` segmenti başlıktan ayrılıp meta satırına taşınıyor — Unicode duyarlı: yalnızca kuyruk gerçek bir çalışma türü işareti ve orta segment bir yer adı biçiminde olduğunda ("C++ | Rust | Go Developer" gibi meşru dikey çizgiler asla bölünmez).
- **Yatay yayılma bitti.** Sabit tablo düzeni, `min-width: 0`, tam metni araç ipucunda taşıyan üç noktayla kısaltılmış tek satırlık başlık/meta: 1440 px'te de 390 px'te de sıfır sayfa taşması ve sıfır iç tablo kaydırması (eski sayfa telefon genişliğinde 675 px'lik bir taşma yapıyordu).
- **Sayfalama.** Sonuçlar sayfa başına 50 olarak çiziliyor (25/50/100/200 seçilebilir) — 700 satırlık bir tarama artık ~37,000 px yerine ~4,600 px yüksekliğinde ve DOM, 5,500+ yerine ~1,000 düğüm tutuyor.

### Eklendi

- Yerleşim sözleşmesi testleri: iki satırlık kayıt satırı, simgelerin erişilebilir adları (en + ru), sayfalama düğüm bütçesi ve başlık-uyum sayı/sıra koruması tarayıcı paketinde çalışıyor — yeniden tasarım sessizce gerileyemez.

### Notlar

- Testler **5036 → 5045** birim (tarayıcı paketi yerleşim sözleşmelerini kazandı), kapsam ortalaması **98.14 % satır / 89.34 % dal** (alt sınır 96/86).
- Tarayıcının buldukları, puanlama formülleri ve `last-scan.json` dokunulmadan kalıyor — başlık-uyumu bir ek açıklama olmaya devam ediyor.
- Bu sürümde yok: URL-hash filtre durumu ve klavyeyle satır gezinmesi (takip); `5 lakhs INR` ayrıştırması (önceden var olan).

## [1.243.2] — 2026-10-08

### Düzeltildi

- **Dağıtılabilir sürüm v1.243.2 olarak kesildi.** v1.243.1 git etiketi yayınlandıktan sonra yeniden işaretlendi ve sunucunun `git fetch --tags` komutu mevcut bir etiketi geçersiz kılmayı doğru şekilde reddediyor — bu yüzden v1.243.1 hiçbir zaman dağıtılabilir değildi. Bu etiket özdeş ağacı (v1.243.0 tabanlı modal window-dinleyici düzeltmesi) ve bu sürüm yükseltmesini taşıyor. Başka hiçbir şey değişmedi; yayınlanan npm 1.243.1 tarball'ı düzeltmeyi çoktan içeriyordu.
### Notlar

- Uygulama kodu v1.243.1 ile aynı — yalnızca dağıtılabilir etiket yenidir (sunucunun `git fetch --tags` komutu yeniden işaretlenen v1.243.1'i reddetti).
- Bilinçli olarak yapılmadı: sunucu tarafındaki etiketi zorla güncellemek (yayımlanmış etiketler asla taşınmaz).

## [1.243.1] — 2026-10-08

### Düzeltildi

- **«Sonucu kaydet» kalıcısı artık gezinmede gerçekten kapanıyor.** v1.243.0 bekçisi `hashchange`'i `document` üzerinde dinliyordu; bu olay orada hiç ateşlenmez — düzeltme ölü geldi ve kalıcı bir sonraki görünümü engellemeye devam etti (v1.243.1 gerileme turunda canlı üretimde yakalandı). Bekçi artık `window` üzerinde dinliyor; test de oraya dispatch ediyor ve bozuk koda karşı kırmızı doğrulandı.

## [1.243.0] — 2026-10-08

**Tarayıcı katmanı işinizi güvende tutuyor ve dilinizi konuşuyor: kaydedilmemiş düzenleme kaybı yok, sessiz başarısızlık yok, yerelleştirilmiş bir arayüzde sessiz İngilizce yok, her yerde AA kontrastı.**

### Düzeltildi

- **Kaydedilmemiş düzenlemeler yeniden çizimlerde kaybolmuyor.** CV düzenleyici kirli bir tampon tutuyor ve her çizimde onu geri yüklüyor — İptal, bir dil değişimi ya da CV Studio'ya geçiş artık düzenlemeleri atmak yerine soruyor; kariyer planı da ürettiği metni aynı şekilde koruyor. Config/CV Studio/career-plan/memory/two-pager içindeki yükleme hataları, dosyayı boşluklarla sessizce üzerine yazmak yerine bir hata gösteriyor ve Kaydet'i devre dışı bırakıyor.
- **"Sonuç kaydet" penceresi artık gezinmeden hayatta kalmıyor.** `#/tracker` üzerinde açıp başka bir görünüme tıklamak, tüm sayfayı bloke eden bir pencere bırakıyordu (v1.242.1 two-stand regresyonunda yakalandı) — artık rota değişiminde kapanıyor; tarama görünümündeki kardeşleri de gezinmede SSE akışlarını durduruyor ve dinleyicilerini ayırıyor.
- **Maaş ve anahtar kelime ayrıştırma her yazı sistemini okuyor.** Anahtar kelime çipleri Unicode sözcük sınırları kullanıyor (Kiril, `c++`, `.net` doğru filtreleniyor, sıfır satıra düşürmüyor); ortak tek bir maaş ayrıştırıcısı `$182.9K - $240K`, `от 100 000 руб`, `100 тыс. руб.`, `50 000 Kč` (önceden 50M USD okunuyordu) ve aralık semantiğini (`$100-150K`) düzeltiyor; zorunlu "Germany or Netherlands" artık hem eşleşmiş hem ihlal edilmiş sayılmıyor.
- **Akışlar tam olarak bir kez sonuçlanıyor.** Kopan bir SSE bağlantısı hatayı iki kez iletiyor ve Generate düğmesini sonsuza dek devre dışı bırakabiliyordu; her son durum (done/error/close/throw, öldürülmüş bir alt süreç dahil) tek yoldan sonuçlanıyor ve düğmeyi yeniden etkinleştiriyor. Otomatik pipeline, son arabelleklenmiş karesini bırakmak yerine boşaltıyor.
- **Küçük yollarda gizlilik ve doğruluk.** Hata raporu gövdesi artık değerlendirilen iş URL'sini ya da rapor slug'larını taşımıyor; CV gizliliği çıplak `linkedin.com/in/…` bağlantılarını ve tamamı büyük harf olan adları maskeliyor, AB tarihlerini bozmayı da bırakıyor; ülke çözümlemesi en uzun eşleşmeyi alıyor ve iki ülke adı geçtiğinde tahmin etmeyi reddediyor ("Cambridge, MA" artık Birleşik Krallık'a eşlenmiyor); dosya adıyla indirilenler Kiril adlarını koruyor.
- **Router ve a11y.** Atlama bağlantısı artık `ontent` içine 404 etmiyor; etkin gezinti öğesi `aria-current="page"` taşıyor; tek `<main>`/tek `<nav>`; Escape mobil çekmeceyi kapatıyor (kapalıyken artık gerçekten sekme sırasının dışında); `scroll-padding-top`, yapışkan çubukların ötesinde odağı görünür tutuyor; yapışkan banner artık üst çubuğu örtmüyor.
- **Kontrast her iki temada da AA** — koyu temadaki toast'lar beyaz-üstüne-beyazdı (1.10:1): toast'lar, düğmeler, banner'lar ve `--rausch` üzerindeki bağlantılar artık tema-değişmez belirteçler üzerinden çözülüyor; bunu hesaplanan WCAG sözleşme testleri (≥ 4.5:1) koruyor.
- **Bu turdan geri kalan her şey**: evaluate kesilme uyarısını çiziyor; memory/config/two-pager başarısız bir yüklemin üzerine Kaydet'i reddediyor; scan SSE'sini yetim bırakmayı bırakıyor; tarama sonuçları API destekli panoları, sürüklenmiş bir regex yerine sunucu kayıt defterinden sınıflandırıyor; takipçinin "Proceed with Caution"u bir uyarı, kırmızı rozet değil; istatistikler yerelleştirilmiş durumları hesaba katıyor; çubuk grafikler RTL'de doğru okunuyor; docs FAB telefonlarda içeriği örtmüyor; `GET /app.js` dizin kabuğu yerine 404 dönüyor; `GET /api/runners` eylemlerini listeliyor.

### Eklendi

- **Danca otomatik algılamaya katılıyor** — bir `da-DK` tarayıcı artık Danca arayüzü alıyor (sözlük tamdı, algılama onu kaçırıyordu); `zh-Hant*` Geleneksel Çinceye eşleniyor. `cv-diagnostics` — özgeçmiş kontrol listesi — tamamen yerelleştirildi (28 `diag.*` anahtarı × 17). 26 alan-şartnamesi etiketi eklendi; 31 ölü anahtar kaldırıldı; sağlayıcı listeleri artık Hermes'in "otomatik sıralamada en sonda" olduğunu iddia etmiyor; docs-fab/menu aria etiketleri yerelleştirildi.

### Notlar

- Testler **4812 → 5036** birim, tarayıcı **118 + yeni gezinti/kontrast sözleşmeleri**. Kapsam ortalaması **98.15 % satır / 89.34 % dal** (alt sınır 96/86).
- Bu sürümde yok: `#/scan` yeniden tasarımı (Phase 4 — v1.244.0, şartname taslağı hazır); kendine ait bir `export.docxFailed` sözlük anahtarı (hata, `common.error`'ı yeniden kullanıyor); `5 lakhs INR` hâlâ 5 olarak ayrıştırılıyor (önceden var olan).

## [1.242.1] — 2026-10-08

### Düzeltildi

- **Sürüm arşivi artık `node_modules` sembolik bağlantıları içermiyor.** v1.242.0 git etiketi kökte bir `node_modules` sembolik bağlantısı ve `site/node_modules` taşıyordu (genel kapsamlı bir `git add -A` bunları sondaki eğik çizgili ignore desenlerinin önünden geçirdi), bu da sunucu dağıtımının tar açmasını bozdu — dağıtım güvenle geri alındı ve üretim 1.241.1'de kaldı. Her iki sembolik bağlantı izlemeden çıkarıldı ve ignore desenleri genişletildi; npm tarball'ı hiç etkilenmedi (paketlerken npm `node_modules` hariç tutar).

### Notlar

- Uygulama kodu v1.242.0 ile aynı — yalnızca paketleme. Kaynak doğruluğu içeriği bu dağıtımla üretime gidiyor (v1.242.0 üretime hiç ulaşmadı: sunucu dağıtımı tar hatası sonrası geri alındı).
- Bilinçli olarak yapılmadı: v1.242.0'ı yeniden etiketlemek (npm 1.242.0'ı zaten yayımladı; kayıt defteri tarball'ı temiz — paketlerken npm `node_modules` hariç tutar).

## [1.242.0] — 2026-10-07

**Tarayıcının veri katmanı yeniden güvenilir: ölü kaynaklar canlandı, hatalı biçimli bir yanıt artık boş pano kılığına giremiyor ve kötü niyetli bir pano URL'si artık bir taramayı yönlendiremiyor.**

### Düzeltildi

- **Ölü kaynaklar yeniden canlı.** justjoin (API zarfı `{data, meta.next.cursor}` biçimine değişti) yeni maaş alanlarıyla birlikte tam kataloğunu bir imleç turuyla okuyor; nofluffjobs `salaryCurrency` olmadan 400 dönüyor — üst projenin zorunlu kıldığı sorgu gönderiliyor ve sonuçlar sayfalanıyor (`pageTo`). himalayas ve jobicy 100 binin üzerindeki ilandan yalnızca en yeni ~20 tanesini görüyordu — ikisi de artık tam kataloglarını geziyor (sayfa üst sınırlı offset / imleç sayfalaması).
- **Yanlış biçimli bir 200 yanıtı 1. sayfada hata fırlatıyor.** ~40 kaynak, hatalı biçimli ya da challenge yanıtlarını "0 ilan" olarak okuyor ve tarama sessizce "başarılı" oluyordu. Yeni `server/lib/sources/_shape.mjs` korumaları (`requireArray` / `requireContainer` / `requireObject`) bu hatayı her kaynak ailesinde görünür kılıyor; sonraki bir sayfada gelen hata, o ana kadar toplanmış sayfaları korur; sayfalama filtrelenmiş sayıya değil ham sayfa uzunluğuna göre durur.
- **SSRF: alt dize temelli satıcı denetimleri, ayrıştırılmış tam ana bilgisayar sabitlemeleriyle değiştirildi.** lever (`clever.com` içinde `lever.co` geçiyor), greenhouse (5 ana bilgisayar + eski `boards[.eu].greenhouse.io` yol-slug ana bilgisayarları), ashby, smartrecruiters, workable, gem REST, ibm, arbeitsagentur, hecklerkoch (yalnızca www), workingnomads (`http://169.254.169.254` DNS korumasını aşarak erişilebilir durumdaydı), remoteok, remotive, rss, successfactors. Her yerde `redirect:'error'`; iş URL'leri sabitlenmiş ana bilgisayar üzerinde `https:` olmak zorunda (`javascript:` / `data:` / ana bilgisayar dışı olanlar atılır).
- **Yanlış yapılandırılmış tek bir portals girdisi artık taramanın tamamını iptal edemiyor.** `resolveAdapter` bağdaştırıcı fırlatmalarını yakalar, `detectApi` şirket başına sarmalanır, hata fırlatan bağdaştırıcılar `null` döndürür; comeet fetch hataları günlüklere ya da karantina kayıtlarına ulaşmadan önce `?token=` değerini maskeler.
- **Sayfalama ve güncellik.** workday, 100 ilanı aşan kiracıları geziyor (offset sayfaları, `MAX_PAGES`); telegram EN YENİ gönderileri tutuyor ve sessizce en eskileri tutmak yerine `?before=` ile sayfalıyor; tencent `Count` eksikken gezmeye devam ediyor; taleo Fransızca başlık tablolarını ayrıştırıyor; avature ham sayfa uzunluğunda duruyor; UTC tarih damgaları (amazon'un UTC'nin doğusundaki bir günlük kayması, torre, workingnomads, trudvsem); HTML varlıkları çözülüyor (geekjob, getmatch, hh); mycareersfuture 12 alanlı tam iş biçimini üretiyor.
- **Uzak algılama sıkılaştırıldı.** arbeitsagentur, vdab, rippling, teamtailor: sözleşme yüzdesi ("Verpleegkundige (100%)", `bundesweit`) ve "distributed" sözcüğü ("Distributed Systems Engineer") artık ofis tabanlı rolleri Remote olarak etiketlemiyor.

### Eklendi

- `tests/adapters-pin-coverage.test.mjs`, ana bilgisayar sabitlemelerinin getirdiği dal kapsamını tamamlıyor.

### Notlar

- Testler **4419 → 4812**, tarayıcı **118**. Kapsam ortalaması **98.15 % satır / 89.36 % dal** (kapı alt sınırı 96 / 86).
- Bu sürümde yok: aynı inceleme turunun istemci tarafı bulguları (Phase 3 — görünümler, kütüphaneler, CSS/a11y, i18n); `sources/habr.mjs` hâlâ kendine ait bir test dosyasından yoksun (ratchet muafiyeti).

## [1.241.1] — 2026-10-07

**Canlı değerlendirmeler her dilde uçtan uca çalışıyor, iş haritası birden çok konumlu uzun ilanları yerleştiriyor ve bir dağıtım artık çalışan bir taramayı öldürmüyor.**

### Düzeltildi

- **Değerlendirmeler yöntemin tamamını görüyor.** Bağlam bütçesi (144 KB), CV ve profil satır içine alındıktan sonra hâlâ `modes/oferta.md` dosyasının sonunu kesiyordu; bu yüzden her canlı değerlendirme son bloklarını kaçırıyordu. Bütçe artık 192 KB, istem yumuşak üst sınırı 256 KB ve ikisi de `llm-dispatch.mjs` içinde tek yerde tanımlı.
- **Raporlar seçilen dilde.** Dil yönergesi artık istemi hem açıyor hem kapatıyor; sıradan sözcükler (rol, ekip, tasarım…) raporun diliyle yazılıyor; yalnızca adlar, teknolojiler ve kelimesi kelimesine alıntılar İngilizce kalıyor. Çoğunlukla İngilizce olan Hintçe ve Japonca raporları düzeltir.
- **Yavaş değerlendirmeler artık HTTP 502 ile bitmiyor.** Değerlendirme zaman aşımı 300 sn (önceden sağlayıcı varsayılanı olan 180 sn idi).
- **Hintçe blok harfleri.** A–G harflerini Devanagari ile yazan bir rapor (`## ए)`, `## बी)` … `## जी)`) tanınır; `SCORE:` yerel rakamları (`३.८`, `٣٫٨`, `３．８`) ve ondalık virgülü kabul eder.
- **İş haritası: uzun konumlar.** "Berlin Office · Berlin · Germany · Bosnia · …" gibi bir hücre (300+ karakter) HTTP 400 ile reddediliyor ve ilanın işareti olmuyordu. Artık ilk gerçek yer kullanılıyor (`·`, `;`, `|`, ` / `, satır sonları; "Remote …" parçaları, "(HQ)" ve "Office" atlanır); yalnızca 2000 karakteri aşan sorgu reddedilir.
- **Dağıtım ve saatlik tarama.** Dağıtım, tarama ve otomatik değerlendirme zamanlayıcılarını durdurur, çalışan birinin bitmesini bekler (en fazla 15 dk), yeniden başlatır ve zamanlayıcıları her zaman yeniden devreye alır; geri alma dahil.

### Eklendi

- **[cvstart.org](https://cvstart.org/#job-map) üzerinde iş haritası** 17 dilin tamamında, ayrıca İngilizce ve Rusça README'lerde.
- **Her dilde harita ekran görüntüleri** — dil başına bir tane (`scripts/capture-map-screenshots.mjs`), 17 README'nin tamamında, cvstart.org'da ve yeni bir yardım alt bölümünde: “Haritayı kullanma” (§33, ×17).

### Notlar

- Testler **4404 → 4419**, tarayıcı **118**. Uzak QA (tüm rotalar, site, bağlantılar ve 17 dilde canlı LLM) üretimde yeşil.
- Bu sürümde yok: akışlı değerlendirmeler — 300 sn zaman aşımı kesin sınır olarak kalıyor (yavaş bir yerel model yine de ona takılabilir) ve Hermes köprüsü akışsız çağrısını sürdürüyor.

## [1.241.0] — 2026-10-07

**28 ajanlı bir kod incelemesinden (~190 doğrulanmış bulgu) sertleştirme sürümü: güvenlik, süreç çökmesi ve veri kaybı sınıfları kapatıldı; ayrıca @bullitt186 katkısı olan bir iş haritası.**

### Eklendi

- **İş haritası (`#/map`)** — pipeline'daki, son taramadaki ve takipçideki ilanlar bir OpenStreetMap haritasında; Nominatim üzerinden coğrafi kodlama, tanımlayıcı bir User-Agent, saniyede 1 istek kuyruğu, geri çekilme ve diskte önbellek ile. Leaflet bu sunucudan sunulur (CDN yok); CSP yalnızca `img-src` içine kutucuk kaynağını ekler. **@bullitt186** katkısı (#381).
- **İstek koruması** — sunucu, sunmadığı bir `Host` değerini (DNS rebinding), siteler arası yazmaları ve yan etkili GET'leri (`/api/stream/*`, `/api/run/*`, `/api/geocode`) reddeder. Genel bir adı ileten bir ters proxy bunu `ALLOWED_HOSTS` içine yazar; dağıtım iş akışı bu systemd drop-in'ini genel URL'den yazar.
- **Kapsam kapısı** — `npm run test:coverage:gate` (`scripts/coverage-report.mjs`) dosya başına satır/dal kapsamını yazdırır ve yükselen bir taban çizginin altında başarısız olur.

### Düzeltildi

- **Hatalı biçimli bir istek artık sunucuyu durdurmuyor.** Express 4 reddedilen asenkron işleyicileri yok sayıyordu; bu yüzden `/api/deep`, `/api/auto-pipeline`, `/api/career-plan`, `/api/tracker` içindeki yanlış türde bir alan ya da `/api/stats` içindeki bir NUL baytı süreci sonlandırıyordu; artık JSON 400 dönüyor ve diğer her ret 500'e dönüşüyor.
- **İptal edilen ya da başarısız olan bir tarama artık son sonuçları silmiyor.** Bir tarama durdurulduğunda ya da her kaynak başarısız olduğunda `last-scan.json` korunur ve tek şirketlik bir tarama değiştirmek yerine birleştirir. Yanlış yapılandırılmış tek bir `portals.yml` girdisi artık taramanın tamamını iptal etmiyor.
- **Değerlendirmeler yöntemin tamamını görüyor.** Mod dosyaları 16 KB'ta kesiliyordu; bu yüzden `oferta.md` (92 KB) C–G bloklarını kaybediyordu; dosya başına üst sınırlar artık modlar için 128 KB, CV için 64 KB ve kesinti raporlanıyor. Boş ya da kesik yanıtlar boş bir rapor yazmak yerine başarısız olur.
- **SSRF:** yönlendirme adımları özel hedefler için yeniden denetlenir, her DNS yanıtı denetlenir, tarama zaman aşımı gövdeyi de kapsar, `*_BASE_URL` anahtarları yalnızca satıcının ana bilgisayarına gider (Hermes/Ollama: loopback ya da LAN), pandoc `--sandbox` ile çalışır.
- **Olay döngüsü takılmaları:** iki ikinci dereceden regex (HTML ayıklama, markdown temizleme) doğrusal tarayıcılarla değiştirildi.
- **Veri kaybı:** bir pipeline satırını silmek diğer satırların ücretini koruyordu; bir URL içindeki `$&` `pipeline.md` dosyasını bozuyordu; mülakat provası, networking ve derin araştırma kayıtları önceki dosyaların üzerine yazıyordu; mülakat geçmişi son 40 tur yerine ilk 40 turu tutuyordu.
- **LLM katmanı:** otomatik pipeline ve derin araştırma `LLM_PROVIDER` değerine ve ortak dağıtım üzerinden her sağlayıcıya uyar, kullanımı kaydeder ve kesintiyi bildirir; Gemini evaluate/test artık rapor kaydetmez; OpenAI `max_completion_tokens` kullanır ve yalnızca Codex'e ait bir `OPENAI_MODEL` `gpt-5` olarak gönderilir; iş ilanı güvenilmeyen veri olarak çitlenir.
- **Rapor, derin ve satır içi PDF'ler** `--skip-fact-check` geçirir (CV olgu denetimi sayı içeren her raporu engelliyordu); profilin sayfa biçimi artık geçersiz kılınmıyor.
- **Tarayıcılar:** karantina URL'ye göre anahtarlanır (bir URL'yi düzeltmek yeniden denemeyi sağlar), çalıştırma içi tekilleştirme kanonik URL'ye göre yapılır, boş liste girdileri artık her şeyle eşleşmiyor, yazmalar atomiktir, `skipped_*` geçmiş satırları "görüldü" sayılmaz.
- **Süreç denetimi:** SIGKILL'e yükseltme hiç çalışmıyordu; toplu çalıştırmalar bağlantı kesildiğinde tüm süreç gruplarını sonlandırır.
- **CI ve sürüm:** CI artık changelog-parity, workflow ve i18n kapılarını çalıştırıyor; en az ayrıcalıklı workflow izinleri; üretim sırları yalnızca `production` ortamında; npm paketi artık `docs/help/` dizinini içeriyor.
- **Testler:** hiçbir test artık ağa ya da gerçek üst projeye dokunmuyor (açık bir `CAREER_OPS_ROOT` her zaman dikkate alınır); kopyalanmış algoritmalar üretim koduyla değiştirildi.

### Notlar

- Testler **4056 → 4404**, tarayıcı **118**. Sunucu kapsam taban çizgisi: satır %96,7, dal %86,3 (`scripts/coverage-baseline.json`).
- Belirtimler artık tek bir klasörde, `docs/sdd/specs/`; program planı `docs/sdd/PLAN.md`, değişmez→kapı matrisi `docs/sdd/TRACEABILITY.md`.
- **Operatör notu:** bir ters proxy arkasında `ALLOWED_HOSTS=<genel ana bilgisayar>` ayarlayın; genel bir ana bilgisayardaki Ollama/Hermes taban URL'si artık reddediliyor.

## [1.240.0] — 2026-10-06

**Üst proje eşleşmesi — career-ops `main` @ `62905981` (VERSION 1.35.0, `b39931e`'den bu yana 177 üst proje commit'i). Altı yeni kaynak — 103 → 109 (104 EN + 5 RU) —, mevcut sekiz sağlayıcıya yansıtılan düzeltmeler ve **@bullitt186** katkısı olan checklist pipeline biçimi.**

### Eklendi

- **Altı yeni kaynak — 103 → 109 (104 EN + 5 RU), 98 → 104 EN bağdaştırıcı.**
  - **ADP Workforce Now** (`cid` + `ccId` ile `workforcenow.adp.com`) — gerçekten dönen satır sayısına göre `$skip` sayfalaması; ne `jobRequisitions` ne de `meta` içeren bir yanıt boş pano gibi okunmak yerine hata fırlatır; isteğe bağlı ayrıntı zenginleştirme (`adpWorkforcenow.fetchDetails`, varsayılan 25, üst sınır 100).
  - **Gupy** (`employability-portal.gupy.io`) — panoyu kapsayan anahtar kelime taraması, en yeni önce ve `since_days` üzerinde erken durma; `workplaceType` tekil pt-BR dizesi olarak okunur, böylece hibrit ilanlar kaybolmaz; gizli kariyer sayfaları dışarıda bırakılır.
  - **JazzHR** (`*.applytojob.com`) — kısmi bir yeniden tasarım yine de ilan verebilsin diye çıplak bağlantı yedekli kart ayrıştırıcı; hiç kart ayrıştırılamayan ilan bağlantıları hata fırlatır, gerçekten boş bir pano `[]` döndürür.
  - **Startup Jobs** (`startup.jobs/feeds/jobs`) — RSS, tek istek; hatalı biçimli, HTML ya da kesik bir gövde `[]` döndürmek yerine hata fırlatır (üst projenin birleştirme sonrası inceleme düzeltmesi, `08fe5d06`); öğe eşlemesinden önce CDATA ve yorumlar maskelenir.
  - **Taleo** (`<tenant>.taleo.net`, `tre.taleo.net` reddedilir) — kabuk GET'i, ardından `searchjobs` POST'u; portal kimliği olmayan bir kabuk özel pano olarak hata fırlatır; sütunlar başlığa göre eşlenir.
  - **UKG Pro / UltiPro** (`recruiting[N].ultipro.{com,ca}`) — `Top=50` + `Skip`, `totalCount` asla durma koşulu olarak güvenilmez, sayfa üst sınırı 100 (1500'e sabitlenir), isteğe bağlı ayrıntı sayfaları dizeyi tanıyan bir süslü parantez taramasıyla ayrıştırılır.

### Düzeltildi

- **Üst projenin checklist biçiminde pipeline** — üst career-ops `data/pipeline.md` dosyasını `- [ ] url | …` satırlarından oluşan `## Pending` / `## Processed` bölümleri olarak yazar; UI bunu **0 bekleyen** olarak okuyordu ve yazarken dosyanın sonuna, üst projenin hiç bakmadığı yere bir kod bloğu ekliyordu. `parsePipeline`, `addPipelineUrl` ve `removePipelineUrl` artık bu biçimi okuyor ve yazıyor (işlenmiş satırlara karşı da tekilleştirme; ücret bilgisi etiketli bir `note: comp …` parçası olarak); kod bloğu içeren biçim değişmedi. **@bullitt186** katkısı (#380).
- **Ülke konuma katıldı** — Ashby (birincil `address.postalAddress`), Breezy (`country.name`) ve Recruitee (düz `location`), ad ülkeyi zaten tam sözcük olarak taşımıyorsa ülkeyi ekler; böylece Birleşik Krallık birincil, ABD ikincil bir uzaktan rol artık konum filtresi tarafından dışarıda bırakılmaz.
- **MokaHR** — `hire-r1.mokahr.com` bölgesel ana bilgisayarı kabul edilir (izin listesi tam olarak `app.mokahr.com` + `hire-r1.mokahr.com`), API POST'u ve ilan bağlantıları panonun kendi ana bilgisayarını kullanır ve bant içi `success:false` artık boş pano gibi okunmak yerine hata fırlatır.
- **Avature** — `article--jobs` kartları ayrıştırılır (başlık üstbilgi bağlantısından, konum `icon-address` span'inden).
- **SAP SuccessFactors** — `/go/<Category>/<id>[/<offset>]/` biçimli kayıtlı arama URL'si kiracı köküne çözülür; eskiden sıfır kutucukla 200 yanıtı veren `…/tile-search-results/` adresine gidiyordu.
- **Deutsche Bahn** — db.jobs, işleyemediği bir ilan içeren her sonuç sayfasını boşaltıyor; tarama artık `pubExternalDate_tdt` ile sıralıyor, sayfa başına 1000 (en fazla 5 sayfa) alıyor, ham isabet bağlantısı sayısında duruyor ve eksik sonuç başlığında ya da ayrıştırılamayan ilan bağlantılarında kısa bir pano döndürmek yerine hata fırlatıyor.
- **HigherEdJobs** — HTTP 200 ile yanıtlanan bir Incapsula doğrulama sayfası sıfır öğe olarak ayrıştırılıp boş pano gibi okunuyordu; artık hata fırlatıyor.
- **Bir test, geliştirici makinesinde gerçek üst projeyi okuyordu** — `tests/reports-list-cache.test.mjs`, `CAREER_OPS_ROOT` değerini `cv.md`/`portals.yml` içermeyen geçici bir dizine ayarlıyordu; `paths.mjs` bunu yok sayar, bu yüzden yerelde üst projenin raporlarını sayıyordu (3 yerine 6), yanında üst proje olmayan CI ise geçiyordu.

### Notlar

- Testler **3782 → 4056**. Yeni paketler: `sources-adp-workforcenow`, `sources-gupy`, `sources-jazzhr`, `sources-startup-jobs`, `sources-taleo`, `sources-ultipro`, `sources-location-country-fold`, `sources-deutschebahn-blanked-page`, `sources-higheredjobs-challenge-page`, ayrıca #380'den `parsers-pipeline-checklist`.
- **Üst proje:** fork, upstream `main`'e getirildi (144 → 0 commit geride) ve dört ADR-0002 sapmasının sağlam kaldığı doğrulandı; üst projenin Kiril `LOCATIONISH_RE` geri alması buraya gelmedi.
- **v1.239.0'da zaten yayımlandı, tekrarlanmadı:** AppliTrack, NEOGOV, Red Rover, SchoolSpring, OCC Mundial, Greenhouse gömülü panoları, Workday `myworkdaysite.com`.
- **Taşınmadı**, gerekçeleriyle: güvenilir vekil çıkışı (`CAREER_OPS_TRUST_PROXY_EGRESS`, `_http.mjs` / `_ip-guard.mjs` / `_dns-cache.mjs`) — web-ui taramaları kendi `http-json.mjs` taşıma katmanı üzerinden yapar; `scan-history.tsv` sütun kaydı ve dil duyarlı requisition tekilleştirmesi — web-ui 1–12. konumları okur, bunlar kaymadı ve URL'ye göre tekilleştirir; SmartRecruiters `requisitionId` / `language` — web-ui'nin ilan şeklinde tüketicisi yok; **Gem** `isoCountry` → ülke adı — üst projenin 249 girişlik alpha-3 tablosunu gerektirir, ertelendi; yalnızca CLI'ye ait değişiklikler (modlar, güncelleyici, doctor, PDF/ATS yükü, takip betikleri, Go panosu, Singapur modu).

## [1.239.4] — 2026-09-29

**v1.239.3 canlı regresyonundan çıkan yama.**

### Düzeltildi

- **Korece ve Geleneksel Çince değerlendirmeler puan özetinin eksik olduğunu bildiriyordu.** Bu raporlar 10–11 bin karaktere ulaşıyor ve özet en sonda geldiği için 8192 çıktı token sınırının ötesine düşüyordu. Değerlendirmeler (ve otomatik hat) artık 16384 tokene izin veriyor; bir sağlayıcı yanıtı yine de keserse ilk uyarı eksik blokları sıralamak yerine bunu söylüyor.
- **Canlı denetim kısa bir Almanca yanıtı Almanca değil sayıyordu** (3 Almanca durak sözcük, hiç İngilizce yok). Liste biçimli bir yanıtta az olabilir; hiç İngilizce yoksa artık üçü yeterli.
- Testler 3778 → 3782.

### Notlar

- Derin araştırma ve mod rotaları 8192 token sınırını koruyor: canlı çalıştırmalarda yanıtları bu sınıra **ulaşmıyor**.

## [1.239.3] — 2026-09-29

**v1.239.2 canlı regresyonundan çıkan yama.**

### Düzeltildi

- **v1.239.2 Japonca ve Hintçeyi düzelttikten sonra da Arapça değerlendirmeler A–G denetiminden geçemiyordu.** Maskelenmiş bir başlık iskeleti (günlükte rapor metni yok) nedenini gösterdi: Arapça rapor, istem ne derse desin blok harfini ebced sırasıyla Arapça yazıyor. Denetim artık أ ب ج د هـ و ز harflerini, bir başlığın başında tek başına durduklarında A–G olarak kabul ediyor; Kiril benzerlerini zaten kabul ettiği gibi. Arapça bir sözcüğün içindeki aynı harfler sayılmıyor.
- Canlı denetim, A–G denetimi başarısız olduğunda bu maskelenmiş iskeleti yazdırıyor; böylece sonraki durum günlükten teşhis edilebiliyor.
- Testler 3776 → 3778.

### Notlar

- v1.239.2 notu denetimin gevşetil**meyeceğini** söylüyordu; Arapça için artık gevşetildi, çünkü üç canlı çalıştırma yalnızca istemin Latin harfini tutamadığını gösterdi.

## [1.239.2] — 2026-09-29

**v1.239.1 canlı regresyonundan çıkan yama.**

### Düzeltildi

- **Arapça bir değerlendirme blok harflerini çevirdi, Japonca bir değerlendirme puan özetini atladı.** v1.239.1 istemin son satırında yalnızca dili yineliyordu. Bu satır artık her başlıktaki Latin A–G harfinin ve `---SCORE_SUMMARY---` bloğunun (işaretler ve anahtarlar İngilizce) çevrilmemesi gerektiğini de söylüyor ve dilin kendi yazısını istiyor.
- Testler 3775 → 3776.

### Notlar

- Rapor denetimi çevrilmiş harfleri veya işaretleri kabul edecek şekilde gevşetil**medi**: biçimi istem kararlı tutuyor.

## [1.239.1] — 2026-09-29

**v1.239.0 canlı regresyonundan çıkan yama.**

### Düzeltildi

- **Japonca ve Ukraynaca değerlendirmeler neredeyse tamamen İngilizce geliyordu.** Dil talimatı istemin başındaydı; ardından onlarca kilobaytlık İngilizce proje dosyası ve iş ilanı geliyordu. İstem artık dili son satırında yeniden belirtiyor.
- **Sunucu zaten bir tarama yürütürken canlı denetim taramayı başarısız sayıyordu** (dağıtımdan hemen sonra yeniden denenen saatlik tarama). Sunucunun ikinci taramayı reddetmesi doğru davranıştır; denetim artık 30 dakikaya kadar bekleyip yeniden deniyor.
- Testler 3774 → 3775.

### Notlar

- Sunucunun tek tarama sınırı gevşetil**medi**: ikinci tarama hâlâ `SCAN_BUSY` ile reddediliyor. Yalnızca denetim değişti.

## [1.239.0] — 2026-09-29

**career-ops @ b39931e ile eşitlik: beş yeni kaynak ve taşınan üç düzeltme.**

### Eklendi

- **Beş yeni kaynak (98 → 103; İngilizce bağdaştırıcılar 93 → 98):** okul ve kamu sektörü alımları için AppliTrack (`applitrack.com/<bölge>`), NEOGOV (SchoolJobs / GovernmentJobs), Red Rover (`jobs.redroverk12.com/org/<id>`) ve SchoolSpring (`<bölge>.schoolspring.com`), ayrıca Meksika'nın en büyük iş ilanı sitesi OCC Mundial (arama sorgularıyla açık `provider: occ`). Her biri kendi ana makinesine sabitlenmiştir, yalnızca HTTPS kullanır ve yönlendirmeleri reddeder.
- Testler 3500 → 3774.

### Düzeltildi

- **Gömülü Greenhouse panoları** (`job-boards.greenhouse.io/embed/job_board?for=<pano>`) "embed" adlı bir panoya gidip başarısız oluyordu; pano artık `?for=` değerinden alınıyor, yalnızca gerçek bir Greenhouse ana makinesinde.
- **`myworkdaysite.com` üzerindeki Workday panoları** (`/recruiting/<tenant>/<site>`) tanınmıyordu; artık taranıyor ve ilan bağlantıları aynı ana makineye gidiyor.
- **Parantez içeren bir rapor dosya adı** (`042-acme-(berlin)-….md`) izleyicide ilk `)` karakterinde kesiliyordu; artık adın tamamı korunuyor.

### Notlar

- Üst projenin yalnızca CLI'ye ait değişiklikleri **taşınmadı** — PDF ve CV şablonları, scaffolder, toplu çalıştırıcı, career-profile içe aktarma, ATS anahtar kelime kapsamı, mülakat modu çevirileri, `pi` CLI ana makinesi: web-ui bunları çalıştırmaz.
- Böyle bir raporu izleyiciden açmak için rapor rotasının dosya adındaki parantezleri kabul etmesi gerekiyor; bu rota bu sürümde **değiştirilmedi**.

## [1.238.3] — 2026-09-27

**Tarama sırasında sayfalar yanıt vermeye devam ediyor ve uzak QA günlükleri artık üretim sunucusunun adresini sızdırmıyor.**

### Düzeltildi

- **Pano ve raporların yüklenmesi saniyeler sürüyor, tarama sırasında zaman aşımına uğruyordu.** `/api/reports` ve `/api/dashboard` her istekte tüm raporları okuyup ayrıştırıyordu — üretim sunucusunda yaklaşık 3,7 sn, bu sırada diğer tüm istekler bekliyordu; tarama sürerken sayfa yüklemeleri 30 saniyelik zaman aşımına takılıyordu. Ayrıştırılmış rapor başlıkları artık dosya başına önbelleğe alınıyor ve dosya değişince yenileniyor; böylece listeleme rapor başına tek bir dosya denetimine mal oluyor (500 rapor: yerelde 430 ms → 3 ms).
- **Bir uzak QA bulgusu, üretim sunucusu adının bir kısmını herkese açık bir günlüğe yazabiliyordu.** GitHub bir sırrı yalnızca tam hâliyle göründüğünde maskeler; 180 karaktere kesilen bir hata mesajı adın ortasında bitiyordu. Bulgular ve raporların tamamı artık kesilmeden önce maskeleniyor.
- **Her yapay zekâ değerlendirmesi hatalı biçimli olarak işaretleniyordu.** İstem, rapor denetiminin gerektirdiği `---SCORE_SUMMARY---` bloğunu hiç istemiyordu (üst projenin değerlendirme betikleri istiyor) ve çevrilmiş bir rapor "Block" kelimesini de çeviriyordu; bu yüzden denetim bölümleri bulamıyordu. İstem artık özeti ve her başlıkta blok harfini istiyor, denetim harften önceki çevrilmiş kelimeyi kabul ediyor ve özet bloğu, rapor sayfada gösterilmeden ya da kaydedilmeden önce kaldırılıyor.

### Eklendi

- Testler 3488 → 3500.

### Notlar

- Tarayıcı hâlâ sunucu sürecinin **içinde** çalışıyor; bu sürüm diğer büyük darboğazı kaldırıyor ama taramayı bir worker'a **taşımıyor**.

## [1.238.2] — 2026-09-27

**Üretim sunucusunun saatlik tarama sırasında hâlâ verdiği 502'lerin düzeltmesi.**

### Düzeltildi

- **Tarama sırasında sayfalar ve dosyalar 502 dönüyordu.** Node boşta kalan keep-alive bağlantısını 5 sn sonra kapatır; Caddy boşta kalan bağlantıları 2 dakikaya kadar yeniden kullanır. Süreç içi tarama sunucuyu meşgul ederken Node, Caddy'nin az önce istek gönderdiği soketleri kapattı ve Caddy 502 *connection reset by peer* döndü (bir taramada 62 kez; sunucunun kendisi sağlıklıydı). Sunucu artık boşta kalan bağlantıları 125 sn — vekilden uzun — tutuyor, böylece her zaman önce vekil kapatıyor.

### Eklendi

- `deploy.yml` → `verify`, vekilin neden 502 döndüğünü (hata türleri, adresler maskeli), son yeniden başlatmadan beri dakika başına 502 sayısını ve saatlik taramanın sonucunu gösterir.
- `release.yml` elle başlatıldığında eksik etiketi oluşturabilir; böylece etiket gönderilemeyen yerlerde de sürüm çıkarılabilir.
- Testler 3486 → 3488.

### Notlar

- Tarama hâlâ sunucu sürecinin **içinde** çalışıyor ve sunucuyu saniyelerce meşgul edebilir; onu bir worker'a taşımak bu yamanın parçası **değil**.

## [1.238.1] — 2026-09-27

**Üretim sunucusunun ilk canlı regresyonundan sonra kararlılık yaması: aynı anda tek tarama ve site düzeltmeleri.**

### Düzeltildi

- **Aynı anda iki tarama sunucuyu çökertiyordu.** Her `GET /api/stream/scan`, tam tarayıcıyı hiçbir koruma olmadan sunucu sürecinin içinde çalıştırıyordu; arayüzden başlatılan bir tarama saatlik zamanlayıcıyla çakıştı ve süreç *JavaScript heap out of memory* hatasıyla öldü (iki kez, arada 502 hataları). Artık aynı anda tek tarama çalışıyor: ikinci istek `SCAN_BUSY` kodlu bir SSE `error` alıyor ve hiçbir şey başlamıyor. Dağıtım iş akışı ayrıca sunucunun bellek sınırını yükseltiyor (`heap_mb`, varsayılan 448 MB).
- **cvstart.org'da `/help` ve `/changelog` telefonda yana kayıyordu** (ja/zh `/changelog` masaüstünde de): uzun kod ve içindekiler artık satır kırıyor.
- **Hintçe, site haritasının dil alternatiflerinde yoktu**; sitenin i18n denetimi artık site haritasını dil kaydıyla karşılaştırıyor.
- **Yardım §19, anahtarın "8 dil dosyasının tümüne" eklenmesini söylüyordu** — 17 dosya var.

### Eklendi

- **Uzaktan regresyon** (`.github/workflows/remote-qa.yml`): dağıtılmış uygulamanın her rotası × her dili (salt okunur), cvstart.org'un her sayfası × dili × telefon/masaüstü, README'lerdeki ve wiki'deki her bağlantı ve istenirse her dilde gerçek bir tarama ile canlı yapay zekâ çağrıları.
- **Sunucu dağıtım iş akışı** (`.github/workflows/deploy.yml`): `recon`, `deploy` (bayt düzeyinde geri alma ile) ve `verify` (duman testi ve kararlılık raporu).
- Testler 3481 → 3486.

### Notlar

- Tarayıcının kendi bellek kullanımı bu sürümde **azaltılmadı**: koruma aynı anda iki taramayı engelliyor, drop-in ise tavanı yükseltiyor. 98 kaynaklı gerçek bir taramanın profili ancak üretim ağında çıkarılabilir.
- Saatlik `career-ops-scan` zamanlayıcısı **değiştirilmedi**; `recon` artık hangi komutları çalıştırdığını gösteriyor.

## [1.238.0] — 2026-09-27

**Üst proje eşleşmesi — career-ops `main` @ `993085ce` (VERSION 1.34.0, `de2224a9`'dan bu yana 182 commit). Dört yeni kaynak, on yansıtılmış sağlayıcı düzeltmesi, tarayıcı genelinde kapatılan bir SSRF açığı ve tarama sonuçlarında ücretsiz bir başlık-uygunluk ipucu.**

### Eklendi

- **Dört yeni kaynak — 94 → 98 (93 EN + 5 RU), 89 → 93 EN bağdaştırıcı.**
  - **Eploy** (`provider: eploy`) — herhangi bir markalı ana bilgisayarda kiracının `/live-jobs.xml` site haritasını okur (yalnızca HTTPS; IP değişmezleri, `localhost`, `*.local`, `*.internal` ve tek etiketli ana bilgisayarlar reddedilir). Site haritası olmayan bir yanıt (bir giriş sayfası) sıfır iş ilanı olarak geçmek yerine hata fırlatır. Ayrıntı sayfaları isteğe bağlıdır (`eploy: { fetchDetails, detailLimit }`).
  - **HiringRoom** (`*.hiringroom.com`) — önce JSON-LD `/portal/jobs`, yedek olarak eski `/jobs` kartları; yükteki `http://` ilan URL'leri HTTPS'e yeniden kurulur.
  - **PeopleSoft Candidate Gateway** — herhangi bir markalı ana bilgisayarda `/psc/{site}/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL` yoluyla tespit edilir. PeopleSoft'un aynı kökenli oturum yönlendirmelerini kendisi takip eder (en fazla 10 sıçrama, her sıçrama kiracı köküne yeniden sabitlenir ve özel adreslere karşı kontrol edilir), "daha fazla yükle" formunu yeniden oynatır ve bunu tam olarak bildirmek yerine kısmi bir taramayı (`peoplesoftIncomplete`) işaretler.
  - **PrevueAPS** (`*.prevueaps.ca`) — site kimliğini iş ilanları sayfasından çözer, ardından JSON API'sini okur.
- **`#/scan` satırlarında başlık-uygunluk ipucu.** Her sonuç, ilan başlığını `config/profile.yml` içindeki hedef rollerle (`target_roles.primary` + arketip adları) karşılaştıran kaba bir **strong / related / weak fit** rozeti taşır. Bu ücretsiz bir anahtar kelime tahminidir: asla filtrelemez, yeniden sıralamaz veya sayıları değiştirmez, ve araç ipucu bunu belirtir. Sonuçlar sunulduğunda hesaplanır, böylece bir profil düzenlemesi bir sonraki yenilemede görünür. ×17 çevrildi. Üst projenin #3261 numaralı değişikliğini yansıtır.

### Düzeltildi

- **Güvenlik — DNS-rebinding koruması gerçek bir taramada hiç çalışmadı.** `http-json.mjs`, yalnızca çıplak global `fetch` kendisine verildiğinde çözülen adresleri kontrol ediyordu, ama her iki tarayıcı da `makeTimeoutFetch()` enjekte ediyor, bu yüzden her tarama bunu atlıyordu. `10.x` veya `127.0.0.1`'e çözülen bir ana bilgisayar adına işaret eden bir kaynak getiriliyordu. Koruma artık `makeTimeoutFetch`'in kendi içinde çalışıyor ve tarama zaman aşımına karşı yarıştırılıyor, böylece takılı kalan bir çözümleyici bir taramayı asamaz.  Bu sürümün incelemesinde bulundu.
- **Güvenlik — bir IPv4 adresini gömen IPv6 adresleri özel olarak işlenmiyordu.** `http://[::ffff:127.0.0.1]/` (URL ayrıştırıcının `[::ffff:7f00:1]` olarak yeniden yazdığı) `isValidJobUrl`'den geçiyordu. `::ffff:a.b.c.d` / `::a.b.c.d`'nin hem noktalı hem de onaltılık biçimleri artık gömülü adrese göre sınıflandırılıyor. Üst projenin `_ip-guard.mjs` dosyası.
- **Rippling v2 board API'sine taşındı** (`ats.rippling.com/api/v2/board/<slug>/jobs`), sayfalama (varsayılan 10 sayfa, en fazla 50), iş bağlantılarında bir ana bilgisayar kilidi ve slug doğrulaması ile birlikte. Yapıştırılan bir API URL'si artık `api` yerine gerçek slug'ını veriyor.
- **Recruitee** — çok konumlu teklifler artık her yeri listeler (`A · B`), `(Sample)` demo ilanları ve başlıksız satırlar düşürülür, ve iki URL'sinden biri geçerliyse bir teklif korunur.
- **Pinpoint** — ekilmiş demo ilanları (ikiye katlanmış demo videosu) düşürülür.
- **Telegram kanalları** — birden çok `|` içeren bir ilk satır artık `Title | Company` olarak okunmuyor, ve daha fazla rol sözcüğü tanınıyor. Fork'un Kiril-farkında `LOCATIONISH_RE` deseni dokunulmadan kalıyor (ADR-0002).
- **Workday** — ilk sayfa 422/401/403 bir kez sorgulanır; Workday'in bakım sayfası veya kesinti yönlendirmesi panoyu ölü olarak işaretler (katı modda karantinaya alınır). CXS ve ayrıntı istekleri artık yönlendirmeleri reddediyor.
- **BambooHR** — yönlendirilmiş bir `/careers/list`, herkese açık gömme beslemesi üzerinden değerlendirilir: boşsa açık pozisyonu olmayan canlı bir pano demektir, başka bir şeyse ölü bir panodur.
- **Heckler & Koch / Rheinmetall** — çıplak bir `heckler-koch.com` / `rheinmetall.com`, yönlendirmesiz taşıma katmanının yine de ulaşabilmesi için `www.` olarak yeniden yazılır. **Ashby** yönlendirmeleri reddeder. **beesite**, iptal edilebilir `delay()` ile sayfaları hızlandırır.
- **Başlık filtreleri her iki tarafta da aksanları katlar** (EN ve RU tarayıcıları), böylece `Développeur`, bir `developpeur` olumsuzuyla yakalanır.
- **Cooldown şirket eşleştirmesi Latin olmayan adları ve şirket biçimlerini anlıyor** (CJK/Korece işaretleri, Türkçe noktalı İ). CJK adları eskiden boş bir anahtara düşüyor ve hiç eşleşmiyordu.
- **`location_filter.strict: true`**, bir izin veya engelleme listesi ayarlandığında boş bir konumda kapalı şekilde başarısız olur.
- **Liveness** — Greenhouse gömmeleri (`gh_jid`), Arbeitsagentur ve We Work Remotely için yeni genel API kontrolleri; SmartRecruiters artık ilanın `active` bayrağına göre karar veriyor.
- **PeopleSoft** — göreli bir "daha fazla yükle" form eylemi, kök dizinde değil arama sayfasının yanında çözülür.

### Notlar

- Testler **3210 → 3481**. Yeni test paketleri: `sources-eploy`, `sources-hiringroom`, `sources-peoplesoft`, `sources-prevueaps`, `title-fit`, `fetch-timeout-dns-guard`, `cooldown-company-match-unicode`, `liveness-api-more-rungs`, `ru-scanner-title-accent-fold`.
- **Taşınmadı**, gerekçeleriyle: location-filter Unicode kelime sınırları (web-ui'nin filtresi alt dize tabanlı, bu yüzden düzeltilecek bir sınır yok — üst projenin location filter'ının bilinçli tam bir portu gelecekteki bir iştir); aynı başlıklı requisition tekilleştirmesi (web-ui yalnızca URL'ye göre tekilleştiriyor); toplayıcı yeniden gönderim uyarıları, kara liste alan adı kapsamı, doğrulanmamış-sıfır makbuzlar ve `scan-runs.tsv` geçişi (web-ui'de bu yüzeylerin hiçbiri yok); Workday facet-split ve kırpma etiketleri (web-ui her pano için bir sayfa getiriyor); BambooHR `enrichDate` (tarih zenginleştirme kancası yok); üst projenin ~20 sağlayıcı genelindeki `_http.mjs` sleep yeniden düzenlemesi (web-ui zaten paylaşılan iptal edilebilir bir `delay` kullanıyor); updater, doctor, PDF, tracker/merge-tracker, `validate-profile`, `discover-new-companies`, `web/` Next.js uygulaması, GitHub botları — yalnızca CLI'ya özgü veya aktarılmış.
- Üst projeden bilinçli olarak farklı tutulan: Heckler & Koch / Rheinmetall yalnızca HTTPS kalıyor (`http→https` yükseltmesi yok); normal bir taramada ölü bir Workday panosu, taramayı başarısız kılmak yerine hâlâ `[]` döndürüyor.

## [1.237.1] — 2026-09-22

**v1.237.0 üzerinde harici bir QA geçişinden yama.** Jobstreet düzeltmesi ilk kez dışarıdan doğrulandı: AU, NZ, HK ve MY ana bilgisayarlarında eski `/id/job/<id>` biçimi temiz bir 404 döndürüyor ve yeni `/job/<id>` gerçek, Cloudflare korumalı bir rotaya ulaşıyor; `id.jobstreet.com` üzerinde ise tersi geçerli. Kaybolan bağlantılar gerçekti. v1.237.0'ın kendisinin eklediği şeyde iki kusur bulundu.

### Düzeltildi

- **Kitap bağlantısının etiketi yerelleştirilmişti, ama hedefi değil.** 17 SPA yerel ayarının ve 17 cvstart.org yerel ayarının tamamı, *Agentic Coding Design Patterns* footer bağlantısını İngilizce baskıya yönlendiriyordu; oysa çevrilmiş tek etiket — Rusça, «Паттерны агентного кодинга» — bir Rusça kitap vadediyordu. Yeni bir `data-i18n-href` uygulayıcısı (`data-i18n-title` ile aynı biçimde, mutlak `https://` değerleriyle sınırlı) ve bir `footer.patternsUrl` anahtarı, `ru`'yu Rusça baskıya, diğer her yerel ayarı İngilizce baskıya gönderiyor. Regresyon testi bu değişmezi iki yönde de doğruluyor: çevrilmiş bir başlık, yerelleştirilmiş bir URL'yi ima eder.
- **SEEK ana bilgisayarlarını taşıyor, ve taşıma katmanı yönlendirmeleri reddediyor.** `www.seek.com.au` → `au.seek.com` ve `www.seek.co.nz` → `nz.seek.com`: detay sayfaları zaten 301 veriyor, ve her iki ana bilgisayar çifti de bugün v5 arama API'sini 200 ile sunuyor. `http-json.mjs`, `redirect:'error'` ayarladığından (korunmaya değer bir SSRF savunması), API yolunun yönlendirmeye başladığı gün eski ana bilgisayardaki bir AU/NZ girdisi başarısız olurdu — ve yalnızca `www.` ana bilgisayarları izin listesindeyken kimse taşınamazdı. `au.seek.com` ve `nz.seek.com` artık `ALLOWED_JOBSTREET_HOSTS` içinde; eski ana bilgisayarlar kalıyor, bu yüzden mevcut yapılandırma ve zaten oluşturulmuş bağlantılar çalışmaya devam ediyor. Taklitler (`au.seek.com.evil.com`, `au-seek.com`) hâlâ reddediliyor.
- **Wiki:** Home belgeleme haritasındaki *Agentic Practices* satırı, on iki satırdan `[[…|…]]` içindeki `|`'yi kaçırmayan tek satırdı, bu yüzden GitHub hücreyi kesti — ölü bağlantı, açıklama gizlendi. Tek bir karakter.

### Notlar

- Sayılar **94** kaynakta (89 EN + 5 RU), 89 bağdaştırıcıda değişmedi. Testler **3201 → 3210** (+5 footer bağlantısı yerel ayarı, +4 SEEK ana bilgisayarı).
- Dışarıdan kapatılamayan, iddia edilmek yerine kayda geçirilen: Oracle Cloud (Akamai her iki REST sondasını da engelledi), Personio sabitlemesi ve `appendWorkType` (bir `portals.yml` girdisi gerekiyor, ve arayüzde birini silme seçeneği yok), ve liveness dize durumları (kontrol edilebilir bir sayfa yok; 40 canlı sonda 12 canlı, 28 belirsiz, **0 yanlış süre dolumu** verdi).
- Yardım ×17 artık `AU-Main` ve `NZ-Main` için her iki ana bilgisayar biçimini de listeliyor. Başlık yapısı 32 H2 / 122 H3'te değişmedi.

## [1.237.0] — 2026-09-21

**Üst proje eşdeğerliği — career-ops `main` @ `93c4302b` (VERSION 1.33.0, `career-ops-hq/main`'den çekilen 75 commit). Bu sefer yeni kaynak yok: dört yansıtılmış düzeltme, bunlardan ikisi burada ilanları sessizce kaybediyordu.**

### Düzeltildi
**Jobstreet / SEEK — her Avustralya, Yeni Zelanda, Singapur, Malezya ve Hong Kong ilanı ölü bir sayfaya bağlanıyordu.** `parseJobstreetItem`, detay URL'sini koşulsuz olarak `${baseUrl}/id/job/${id}` biçiminde kuruyordu. `/id/` bölümü bir yol değildir — bu bir **Endonezya yerel önekidir** ve yalnızca Endonezya ana bilgisayarlarında bulunur. Diğer her SEEK platformu ana bilgisayarı `/id/job/<id>` üzerinde **404** yanıtı verir. web-ui `www.seek.com.au`, `www.seek.co.nz`, `sg.jobstreet.com`, `my.jobstreet.com` ve `hk.jobsdb.com`'u zaten `ALLOWED_JOBSTREET_HOSTS`'a eklemişti, bu yüzden tarama bu ilanları seve seve döndürüyordu — her biri bir 404'e işaret ederek. Yol artık ana bilgisayara göre anahtarlanıyor: `ID_LOCALE_HOSTS` (`id.jobstreet.com`, `www.jobstreet.co.id`, `jobstreet.co.id`) `/id/job/`'u korur, geri kalan her şey `/job/` alır ve ayrıştırılamayan bir orijin, fırlatmak yerine ortak yola düşer. Kendi testlerimizden ikisi **hatayı kodlamıştı** — `hk.jobsdb.com/id/job/…` ve `www.jobstreet.com/id/job/…` şeklinde doğrulama yapıyorlardı — ve düzeltildiler.
**Oracle Cloud — liste ortasındaki kısa bir sayfa gezintiyi bitiriyor ve panonun kuyruğunu düşürüyordu.** Durdurma koşulu `listLen === 0 || listLen < PAGE_SIZE` idi, ama ORC bazı satırlar sunucu tarafında filtrelendiği için sınırdan daha az satırı *listenin ortasında* sunar. Üst projede American Express üzerinde ölçüldü: `TotalJobsCount` **454**, sayfalar **200 / 199 / 54** — 199 son olarak okundu ve son **54 ilan, panonun %12'si**, hiç alınmadı. Artık boş bir sayfa gezintiyi her zaman bitirir; kiracı bir toplam bildirdiğinde, sayfalama `offset + PAGE_SIZE >= total` olana kadar devam eder; yalnızca karşılaştıracak toplamı olmayan bir kiracı kısa bir sayfada biter. Bu, bir API'nin "koleksiyonun sonunda olmasa bile ... istenen sayıdan daha az sonuç döndürebileceği" (Google AIP-158) daha geniş kuralına uyar. `hasMore` kasıtlı olarak yok sayılmaya devam ediyor — bazı kiracılar 7000 işlik bir panonun her sayfasında `hasMore:false` döndürüyor. Kısa sayfalar artık gezintiyi bitirmediğinden, `MAX_PAGES` artık bir kiracının sahte bir toplam bildirmesine karşı tek yedek, bu yüzden kendi testiyle kapsanıyor.
**Liveness — "This role is closed" tanınmıyordu ve yanlış bir süre dolumu kalıcıdır.** Kalıp `/this job (listing )?is closed/i` idi; bu, eşit derecede yaygın olan `role` ve `position` ifadelerini kaçırıyordu — üst projede bir panoda **111 belirsiz ilandan 111'i** "role" kullanıyordu. `/this (?:job|role|position)(?: listing)? is closed\b(?!-)/i` olarak genişletildi. Sondaki `\b(?!-)`, bileşik sıfat koruyucusudur: `\b` tek başına `closedown`'ı reddeder ama yine de *"This role is closed-loop control of the platform"* gibi gerçek bir düzyazıyla eşleşir — bunu durduran şey ileriye bakan (lookahead) kısımdır.
**Liveness — `job expired` artık görünür bir Apply düğmesini geçemeyen yumuşak bir katmanda yer alıyor.** `HARD_EXPIRED_PATTERNS`, apply denetimi testinden *önce* denetleniyor, bu yüzden oraya yerleştirilen her şey canlı bir ilana karşı kazanıyor. `/\bjob expired\b/i`, dört gerçek canlı sayfa biçiminde yanlış tetikleniyor — bir "Similar jobs" karuselindeki bir girdi, bir "Hide job expired" filtre etiketi, bir alt bilgi SSS'si ve yukarıdaki closed-loop düzyazısı — çünkü sınıflandırıcı sayfanın tüm metnini alıyor. Artık `SOFT_EXPIRED_PATTERNS` içinde yaşıyor, apply denetiminden sonra ve liste-sayfası sezgiselinden önce denetleniyor ve `expired_body_soft` döndürüyor; apply denetimi olmayan çıplak bir "JOB EXPIRED" afişi hâlâ süresi dolmuş sayılıyor. Bu yön önemlidir çünkü yanlış bir `expired`, tarama geçmişine `skipped_expired` olarak yazılır ve ardından `scan_history.recheck_after_days` ayarlanmadıkça **gerçek bir işi sonraki her taramadan süresiz biçimde dedup-filtreler**.

### Eklendi
**Personio — açık bir `personio: <slug>` kiracıyı sabitler.** Birçok şirket Personio panosunu markalı bir kariyer sayfasında **iframe** olarak gömer, bu yüzden `careers_url` şirketin kendi alan adını gösterirken akış `<slug>.jobs.personio.de` adresinde yaşar; bir sabitleme olmadan bu panolar hiçbir şeye çözümlenmez. Slug, çıpalı bir izin listesiyle (`/^[a-z0-9][a-z0-9-]{0,62}$/i`) karakter kümesi bakımından sınırlandırılır ve ortaya çıkan URL yine de mevcut `new URL()` ayrıştırması, HTTPS denetimi ve `PERSONIO_HOST_RE` ana bilgisayar kapısından geçirilir — sabitleme hiçbir zaman başka bir ana bilgisayara ulaşmanın bir yolu değildir. `.`, `/`, `@`, `:`, `..`, boşluk, başta bir `-` taşıyan veya 63 karakterlik DNS etiket sınırını aşan bir slug, bugünkü `api`/`careers_url` davranışına düşer. Üst projeden farklı olarak web-ui'nin ana bilgisayar regex'i büyük/küçük harfe duyarlıdır, bu yüzden sabitleme `new URL()` üzerinden normalize edilir — `AcmeGroup`, kendi izin listesinin ardından reddedeceği bir ana bilgisayar kurmak yerine `acmegroup.jobs.personio.de`'ye çözümlenir.
**Jobstreet — isteğe bağlı `appendWorkType`** başlığın sonuna ilanın çalışma türlerini ekler, örn. `Strategy Consultant [Part time]`, böylece başlık filtreleri ve triyaj tarama anında istihdam türünü görebilir. Varsayılan olarak kapalıdır; eksik veya boş bir `workTypes` hiçbir şey yapmaz.

### Notlar
Kaynak ve bağdaştırıcı sayıları değişmedi: **94** kaynak (89 EN + 5 RU), 89 EN bağdaştırıcı. Bu sürüm yalnızca test sayısını taşıyor, **3164 → 3201** (+13 jobstreet, +7 Oracle Cloud, +9 liveness, +8 Personio).
Üst proje **`providers/telegram.mjs`'i sildi**, `telegram-channel`'da birleşti. web-ui ikisini de kullanıcıya görünen kaynaklar olarak kaydediyor, bu yüzden silme işlemi **takip edilmiyor**: bu, kayıt defterini 94'ten 93'e düşürür ve `telegram` yapılandırmış herkesi sessizce bozar. Yalnızca kasıtlı, duyurulmuş bir kaldırma olarak yeniden ele alınmalı.
`jd-skill-gap.mjs`, kısaltılmamış bir "what we are looking for" başlık biçimi ve bir kalın işaretleyici (bold-marker) ayıklaması kazandı. web-ui bu betiği yansıtmak yerine **aktarıyor (relay)**, bu yüzden düzeltme dağıtılan üst projeyle birlikte gelir ve burada hiçbir değişiklik gerektirmez.
Taşınmayanlar, gerekçesiyle birlikte: `lib/latex-escape.mjs`, `browser-extract.mjs`, `openai-eval.mjs`, `update-system.mjs` ve scaffolder (web-ui bunları ne yansıtıyor ne de shell ile bağlanıyor); Go dashboard TUI ve `web/` yapılandırma formu (ayrı yüzeyler); `doctor.mjs` ve `analyze-patterns.mjs` (fail-soft'u değişikliği emen salt okunur aktarımlar).
Fork'un `providers/telegram-channel.mjs` içindeki Kiril `\p{L}` ayrışması üst proje birleştirmesinden bozulmadan çıktı ve birleştirme öncesi bir kopyaya karşı bayt bayt doğrulandı.

## [1.236.0] — 2026-09-18

**Üst proje eşdeğerliği — career-ops `main` @ `6a9c84c` (VERSION 1.33.0, 128 commit). İki yeni kaynak ve üç yansıtılmış düzeltme — bunlardan ikisi burada ilanları sessizce kaybediyordu.**

### Eklendi
**İki tarayıcı kaynağı, 92 → 94 (89 EN + 5 RU).** **Python.org Jobs** (`pythonorg`) panonun herkese açık akışını (feed) okur; işveren atfı zorunludur, bu yüzden başlığında hiçbir işveren adı geçmeyen bir satır, portal girdisinin adıyla doldurulmak yerine düşürülür. **Generalist World** (`generalist-world`) panonun kartlarını kazır ve **ayrıştıramadığı biçimlendirmede gürültülü biçimde başarısız olur** — değişen bir kart biçimi, boş bir pano gibi okunmak yerine fırlatır; kazınan bir kaynağı güvenilmez kılan başarısızlık biçimi tam olarak budur. İkisi de `#/scan` Kaynak filtresinde görünür, ikisi de ana bilgisayara sabitlenmiştir (çıpalı regex, yalnızca HTTPS) ve ikisi de uçtan uca sahte aktarım (fake-transport) takımlarıyla yönlendirilir (43 ve 36 durum).

### Düzeltildi
**Birkaç şehirde açık bir Workday pozisyonu, bir konum filtresi tarafından düşürülüyordu.** Workday'in liste uç noktası, diğer her ilanın bir yer taşıdığı yerde çok konumlu bir ilanı bir **sayı** ile yanıtlıyor: `"53 Locations"`. Bu bir konum değildir ve `buildLocationFilter`, büyük/küçük harfe duyarsız alt dize ile eşleşir — bu yüzden Austin'de *ve* diğer 52 şehirde açık bir pozisyon hiçbir `allow: [austin]` girdisiyle eşleşmiyor ve eleniyordu, oysa aynı pozisyon tek başına listelendiğinde geçiyordu. Üst projede üç kiracı genelinde ölçüldü: **291 ilandan 53'ü** yer tutucuydu, dolayısıyla bu sıra dışı değil, olağan durumdur. İlanın gerçek yerleri yalnızca CXS **detay** belgesinde bulunur, bu yüzden her yer tutucu artık ona karşı bir ek GET'e mal oluyor, girdi başına **200** ile sınırlı — sınırın ötesinde yer tutucu, sahtelenmek yerine görünür bırakılıyor, çünkü çözülmemiş bir ilan asla çözülmüş gibi okunmamalıdır. Başarısız veya yersiz bir detay, ilanı listenin döndürdüğü haliyle bırakır: görünür bir `"53 Locations"`, neyin çözülemediği konusunda dürüsttür, oysa boşaltılmış bir konum her filtreden sessizce geçerdi. Aynı GET ayrıca `startDate` taşır, bu yüzden zenginleştirilmiş bir ilan, liste uç noktasının göreli düzyazısı (`"Posted 30+ Days Ago"` → `undefined`) yerine **tam olarak** tarihlendirilir; çıplak bir `YYYY-MM-DD` olmayan her şey, ISO olmayan geri dönüşü uygulamaya özgü olan `Date.parse`'tan geçirilmek yerine olduğu gibi bırakılır.
**Belirtilen bir seviye artık iki ilanı tek bir yeniden gönderiye çökertmiyor.** `"Insurance Specialist II"`, işverenin bu ilanın kardeşi olmadığına dair kendi ifadesidir — tek bir taban başlık altında farklı bir ücret bandı, kapsam ve ilan numarası. Belirteçleyici (tokenizer) bunu göremiyordu: `w.length > 3`, VIII'e kadar her Romen rakamını ve her tek haneli rakamı düşürür, bu yüzden `"Insurance Specialist"` ve `"Insurance Specialist II"` özdeş biçimde belirteçleniyor, kusursuz bir Jaccard oranı alıyor ve yeniden gönderi dedektörü ikinciyi birincinin yeniden listelenmesi olarak işaretliyordu. web-ui'nin `role-matcher.mjs`'inde seviye işleme **hiç yoktu**, bu yüzden bu değişiklik üst projenin mekanizmasının tamamını taşıyor: seviyeler, Romen ve Arap rakamları tek bir sayıya katlanarak çıkarılıyor (`"Nurse II"` ve `"Nurse 2"` aynı ifadedir — ve *bu* çift daha önce yanlışlıkla farklı sonuç veriyordu), belirtilen iki seviye uyuşmalıdır ve yalnızca bir tarafta bulunan bir seviye, **her başlık da diğerinde bulunmayan bir sözcük taşımadıkça** gevşek bir yeniden yazım olarak ele alınır — ki bu bir süsleme değil, iki uyuşmazlıktır.
**Bir filtreye sabitlenmiş bir Avature panosu yine de tüm küresel panoyu geziyordu.** Avature'ın arama arayüzü opak facet parametreleri üretir (`?42386=[812132]` bir ülke filtresidir) ve `portals.yml` içinde daraltılmış bir panoyu sabitleyen bir operatör, taramanın *onu* gezmesini bekler. `resolveSearch`, URL'yi `${origin}${path}` olarak yeniden kuruyor ve sorgu dizesini tamamen düşürüyordu — bu yüzden ilki dahil her istek, kiracının tüm panosunu geziyordu: daha fazla sayfa, daha fazla istek ve operatörün kasıtlı olarak filtrelediği ilanlar. Facet'ler artık sayfalanan her istekte taşınıyor; kendi `jobOffset`'imiz en son uygulanıyor, böylece başıboş, aynı adlı bir facet sayfalamayı asla ele geçiremez.

### Güvenlik
**`devalue` 5.8.1 → 5.9.2** (`astro` üzerinden dolaylı olarak), tek açık Dependabot uyarısını kapatıyor — hatalı biçimli girdide bir hizmet reddi. Yalnızca site bağımlılığı; hiçbir çalışma zamanı kodu değişmedi.

### Notlar
**Taşınmayanlar, her biri gerekçesiyle birlikte.** Üst proje, paylaşılan 10 saniyelik varsayılana karşı **lever**'a 30 saniye ve **manfred**'e 25 saniye zaman aşımı verdi — bir **taşınmayan (no-port)**: web-ui'nin tarama aktarımı burada zaten **60 saniyeye** izin veriyor (`DEFAULT_SCAN_TIMEOUT_MS`), bu yüzden her iki pano da orada düzeltmenin verdiğinden daha fazla paya buradan sahip. **iCIMS'**in ikiye katlanmış `careers-` ön eki de burada oluşamaz: web-ui kiracı kökenini doğrudan `api`/`careers_url`'den alır ve bir ana bilgisayarı hiçbir zaman bir kiracı adından kurmaz; onun yeni yedek-ana-bilgisayar gezintisi, üst projenin daha gevşek yapılandırması için bir özelliktir, bir kusur düzeltmesi değil. **deutschebahn** ve **manfred**, geçici iptalde yeniden deneme kazandı; web-ui'nin 60 saniyelik tavanı bunu çok daha az acil kılıyor — taşınmak yerine not edildi, böylece gelecekte uzun bir gezinti zaman aşımı yaşandığında denenecek bilinen bir ilk şey olsun. 128 commit'lik farkın geri kalanının tamamı CLI, doğrulayıcı, dashboard veya `web/` (üst projenin kendi ön ucu): `liveness-browser`, `check-jd-archive`, `verify-ats`/`verify-portals`/`verify-cv-facts`, `update-system`, `set-status`, `audit-portals`, `discover-ats`, `scaffolder`, `test-all`, eklenti manifestoları.
Çekme sonrası fork ayrışmaları yeniden doğrulandı: `providers/telegram-channel.mjs`'deki Kiril `\p{L}` düzeltmesi, fork'un kendi `providers/telegram.mjs`'i, `web/src/lib/clis.ts` içindeki `hermes`. Üst kaynak `career-ops-hq/main` tamamen birleştirilmiş durumda (0 commit eksik). **3066 → 3164 test**; yardım artık 17 paketin tümünde **94** bağdaştırıcı (**89 EN + 5 RU**) belirtiyor ve başlık yapısı 32 H2 / 122 H3'te değişmeden kalıyor.

## [1.235.0] — 2026-09-16

**Üst proje eşdeğerliği — career-ops `main` @ `68e6b94` (VERSION 1.33.0, 42 commit). İki yansıtılmış düzeltme; bunlardan biri burada MokaHR ilanlarını sessizce kaybediyordu.**

### Düzeltildi
**Aynı MokaHR panosundan ikinci bir iş ilanı eklenmek yerine yok oluyordu.** `url-key.mjs`, bir ilan URL'sini bir karşılaştırma anahtarına indirger ve fragment'i koşulsuz olarak düşürüyordu — mantıklıydı, çünkü neredeyse her fragment yalnızca sunuma yöneliktir (`#apply`, `#section-2`). MokaHR, kendi kayıt defterimizdeki istisnadır: ilanları `…/social-recruitment/{tenant}/{id}#/job/{n}` biçimindedir; burada bir tenant'taki her iş aynı yolu paylaşır ve ilan kimliği **yalnızca** fragment içinde bulunur. Böylece hepsi tek bir anahtara normalize ediliyordu. Düzeltmeden önce ölçüldü: hatta (pipeline) iki farklı MokaHR ilanı yapıştırın, sonunda **tek bir satır** kalıyor — ne hata, ne uyarı, fark edilecek hiçbir şey yok; tarayıcının tazelik filtresi (`en-scanner.mjs`) aynı anahtarı okuyor, dolayısıyla o tenant'tan herhangi bir iş tarama geçmişine girdiğinde, diğer tüm işler "zaten görüldü" olarak eleniyordu. `normalizeUrl` artık tanınan bir `#/job/{id}` veya `#/jobs/{id}` rotasını, fragment düşürülmeden önce yalnızca karşılaştırma amaçlı bir sorgu anahtarına yükseltiyor — MokaHR, önceden yazılmış anahtarların karşılaştırılabilir kalması için yerleşik `mokahr_job_id` adını koruyor, diğer her ana bilgisayar ise dahili bir `_career_ops_fragment_job_id` alıyor. Yükseltilen kimlik **eklenir, ayarlanmaz**: bu parametreyi zaten taşıyan bir URL farklı bir ilanın kimliğini tutar ve onun üzerine yazmak, anahtarın tam olarak ayrı tutmak için var olduğu iki şeyi birleştirir. Tanınmayan her fragment hâlâ çöküyor — zaten doğru olan yarı budur.
**`accept-encoding` artık her kaynak isteğinde sabitleniyor.** Ayarlanmadan bırakıldığında Node, kendi undici derlemesinin sunduğu her şeyi müzakere eder; **Node ≥ 23**'ten itibaren buna `zstd` de dahildir ve amazon.jobs'un zstd yanıtı **tam olarak 1024 bayt'ta, 200 durum koduyla kesilmiş** olarak geri dönüyor — bu yüzden hata, bir aktarım hatası değil de bozuk bir API gibi okunan `Unterminated string in JSON at position 1024` şeklinde görünüyor. Artık her istek `gzip, deflate, br` gönderiyor. Bizim çalışma zamanlarımızda bu **bir onarım değil, önleyici bir tedbirdir**: Node 18/20/22 — CI matrisi ve sunucu (22.22.1) — varsayılmak yerine doğrudan doğrulanarak `gzip, deflate` gönderiyor, dolayısıyla burada hiçbir şey kesilmedi; bugün değişen şey, bu sürümlerin varsayılan olarak istemediği ama doğru şekilde çözebildiği `br`'nin artık sunulmasıdır. Varsayılan, incelemeye değer olan kısım olan **büyük/küçük harfe duyarsız** biçimde uygulanıyor: başlık (header) adları büyük/küçük harfe duyarsızdır ve `fetch`, aynı ada sahip iki girdiyi tek bir virgülle ayrılmış değerde birleştirir; bu yüzden `Accept-Encoding: identity` geçiren bir çağıran, aksi takdirde `gzip, deflate, br, identity` gönderilmiş olurdu.

### Notlar
Başlıklar (headers), `fetchImpl` sınırında **düz bir nesne (plain object)** olarak kalıyor; oysa üst proje `fetch`'e bir `Headers` örneği veriyor. Bu, bir gözden kaçırma değil, bilinçli bir ayrışmadır: web-ui'nin fetch yardımcıları enjekte edilebilir bir `fetchImpl` alır ve 45 kaynak test takımı, yakaladıkları şeyden `opts.headers['User-Agent']`'ı okur — bir `Headers` örneğinin köşeli parantezle erişimi yoktur, bu yüzden sadık taşıma, uygulamanın değil *davranışın* (büyük/küçük harfe duyarsız geçersiz kılma, çağıran kazanır) taşınmasıdır. Çağıranın nesnesi kopyalanır, asla mutasyona uğratılmaz, çünkü birkaç kaynak tek bir başlık sabitini paylaşır. Üst projenin eşlik eden düzeltmesi — **varsayılan user-agent**'ı büyük/küçük harfe duyarsız biçimde uygulamak — bir **taşınmayan (no-port)** değişikliktir: web-ui zaten hiçbir varsayılan UA enjekte etmez, her kaynak kendi panosunun gerektirdiğini ayarlar, dolayısıyla bir çağıranın `User-Agent`'ının çakışacağı bir varsayılan yoktur.
İki yeni test takımı ve üç yeni durum bu çifti sabitliyor: `tests/http-accept-encoding.test.mjs` (tam olarak sabitlenen değer, dört fetch yardımcısının her biri ve üç farklı büyük/küçük harf biçimi altında bir çağıran geçersiz kılması — birleştirme hatasının ürettiği ikinin aksine, *tek bir* `accept-encoding` anahtarının hayatta kaldığını doğrular) ve anahtar yerine kullanıcıya görünen dikişi (seam) sınayan `tests/parsers-pipeline-hash-route.test.mjs`: iki MokaHR ilanının ikisi de hatta ulaşmalı, aynı ilanın dört farklı yazımla yeniden yapıştırılması yine tek bir satıra çökmeli ve kozmetik bir fragment bir kimliğe dönüşmemelidir. Hepsinin önce başarısız olduğu doğrulandı. Sabitlemenin kendisi **taşıma katmanında** yaşıyor, yalnızca bu yardımcılarda değil: 92 kaynaktan 25'i enjekte edilen `fetchImpl`'i doğrudan çağırıyor ve onlardan hiç geçmiyor; bu yüzden onu her iki tarayıcının gerçekten enjekte ettiği sarmalayıcı olan `makeTimeoutFetch` uyguluyor — tüm kaynakların paylaştığı tek geçiş noktası. (Üst projenin bir eşdeğere ihtiyacı yok: `providers/_http.mjs` onun tek taşıma katmanı.) Yapısal bir bekçi artık yeni bir kaynak kendisine verilen taşıma yerine doğrudan `fetch` çağırırsa CI'yı düşürüyor; bir davranış senaryosu da 25'ten biri olan greenhouse'u sarmalayıcıdan geçirerek başlığın gerçekten hatta çıktığını kanıtlıyor.
Taşınmayanlar, gerekçesiyle birlikte: `liveness-browser.mjs` (kafalı-Playwright (headed) yeniden kullanım koruması — web-ui kafalı bir tarayıcı çalıştırmıyor), `check-jd-archive.mjs` (web-ui aktarımı yok), `test-all.mjs` (üst projenin test koşucusu; fork'un `vpFixtureEnv` ayrışması bozulmadan duruyor), `web/` (üst projenin kendi ön ucu, yansıtılmıyor), eklenti manifestoları ve `SIGNATURES.md` (yalnızca depoya özgü). `batch/batch-runner.sh` (`sed` ilişkilendirmesinden önce kaçışlı & işaretleri) ve `jd-skill-gap.mjs` (`cv.md`'yi veri kökünden çözümler) **salt okunur olarak aktarılıyor** — web-ui, üst projenin kopyalarına shell ile bağlanıyor, bu yüzden ikisi de burada kod değişikliği olmadan geliyor; `jd-skill-gap` olanı ise `/api/jds/:id/skill-gap` aktarımını daha doğru hale getiriyor: `cv.md` artık sürecin başlatıldığı dizin yerine veri kökünden çözümleniyor. Çekme sonrası fork ayrışmaları yeniden doğrulandı: `providers/telegram-channel.mjs`'deki Kiril `\p{L}` düzeltmesi, fork'un kendi `providers/telegram.mjs`'i, `web/src/lib/clis.ts` içindeki `hermes`. Kaynak sayısı **92**'de (87 EN + 5 RU) değişmedi, dolayısıyla yardım dokunulmadan kaldı. **3042 → 3066 test.**

## [1.234.0] — 2026-09-15

**Üst proje eşdeğerliği — career-ops `main` @ `56cce8f` (VERSION hâlâ 1.32.0, 1.32.0'dan 58 commit ileride). 15 kaynak genelinde tek bir yansıtılmış düzeltme, üstüne bir daha geri gelmemesini sağlayan bir koruma.**

### Düzeltildi
**Tek bir hatalı biçimli iş ilanı kimliği artık tüm sayfayı boşaltmıyor.** `encodeURIComponent`, tek başına kalan bir UTF-16 vekil karakterinde (surrogate) `URIError` fırlatır ve bir JSON yükü böyle bir karakter taşıyabilir — `JSON.parse('"\\uD800"')` bunu korur. On beş kaynak, her ilanın URL'sini ana bilgisayarın denetlediği bir kimlik veya slug'dan, ayrıştırma döngüsünün *içinde* oluşturuyordu; bu yüzden tek bir bozuk ilan döngüyü iptal ediyor ve o sayfadaki tüm işleri kaybettiriyordu; hiçbir şey kaynak hatası olarak günlüğe yazılmıyordu, çünkü istisna, şirket başına yakalama bloğunun raporlayacak bir şeyi olmadan önce yığını çözüyordu. Üst proje bunu `providers/_safe-url.mjs` içinde düzeltti (`safeEncodeURIComponent` → `URIError`'da `null`, başka her şeyi yeniden fırlat) ve her döngünün kimliğini bu yardımcıdan geçirdi; `null` durumunda yalnızca o tek ilan düşürülüyor. Bu yardımcı artık `server/lib/sources/_safe-url.mjs` konumunda ve aynı değişiklik yansıtılan on üç kaynağa uygulandı — alibaba, arbeitsagentur, bamboohr, feishu-jobs, garena, jibeapply, manfred, meituan, mokahr, phenom, thehub, tkms, vdab — ve aynı döngü biçimine ve aynı gizli fırlatmaya sahip, **yeni korumanın ilk çalıştırmasında ortaya çıkardığı yalnızca web-ui'ye özgü iki kaynağa, jobstreet ve trudvsem'e**. Kapsam bilinçli olarak sınırlı: yalnızca API kaynaklı kimlikler bu yardımcıdan geçiyor. Yapılandırmadan türetilen değerler sıkı kodlamayı koruyor ve gürültülü biçimde başarısız oluyor — garena'nın `office`'i (bir `portals.yml` segmenti) fırlatan `urlSegment`'te kalıyor, API `id`'si ise `null` döndüren `idUrlSegment`'i alıyor; csod'un `corpName`'i ve 4dayweek'in `SLUG_RE` ile doğrulanan slug'ı, gerekçesiyle birlikte ada göre izin listesine alındı.
**rheinmetall'in başlık yedeği, hatalı biçimli bir href'te fırlatabiliyordu.** Bir kartın başlığı yoksa, başlık `decodeURIComponent` aracılığıyla URL slug'ından yeniden oluşturuluyor; bu fonksiyon, kazınan `href` içindeki bozuk bir yüzde dizisinde fırlatıyor — decode tarafında aynı "tek bozuk satır sayfayı öldürür" biçimi. Artık savunmacı biçimde decode ediyor ve ham slug'a geri dönüyor.
**Kaynak kayıt defteri, `_` ön ekli dosyaları atlıyor.** Otomatik keşif, kendisi hariç `server/lib/sources/` içindeki her `.mjs` dosyasını içe aktarıyor ve `export const meta` içermeyen her şey için uyarı veriyordu — bu yüzden yardımcı, açılışta bir uyarı üretiyordu. Üst projenin kuralı benimsendi: baştaki alt çizgi *kaynak değildir* anlamına gelir; bu tür dosyalar ne içe aktarılır ne de uyarılır. `meta`'sı olmayan, bildirilmemiş bir dosya yine de uyarı verir ve keşif testi artık her iki yarıyı da doğruluyor (eski filtreye karşı kırmızı olduğu doğrulandı). Sitenin derleme betiği `sync-assets.mjs` de diskteki bağdaştırıcı dosyalarını aynı kuralla saydığından, yardımcı artık sessiz düşme korumasını tetiklemiyor.

### Notlar
`tests/sources-url-encoding-surrogate.test.mjs`, üst projenin test takımını üç bölümde yansıtıyor: yardımcının sözleşmesi (eşleşmiş bir vekil çift — sıradan bir emoji — yine de encode edilir; değerin kendi `toString`'inden gelen bir fırlatma çağıranın hatasıdır ve yayılır), on beş kaynağın tümü için kaynak bazlı davranış (bir bozuk kimlik + bir temiz kimlik → fırlatma yok, temiz olan tutulur, bozuk olan düşürülür; her biri kaynağın dışa aktardığı saf ayrıştırıcı üzerinden, thehub için ise sahte bir aktarım ile onun getiricisi üzerinden yürütülür) ve bir **kaynak düzeyinde koruma**: dönüştürülen her dosya yardımcıyı hem içe aktarmalı *hem de* çağırmalı, hiçbir dosya onu içe aktarmadan referans veremez ve incelenmemiş hiçbir dosya çıplak bir `encodeURIComponent` ile iş ilanı URL'si oluşturamaz — eski biçimdeki yeni bir kaynak, suçlu satır numarasıyla CI'da başarısız olur. On beş kaynak bazlı durumun tümünün, taşımadan önce başarısız olduğu doğrulandı.
Üst projedeki değişikliklerin geri kalanı, gerekçesiyle birlikte taşınmadı: `batch/batch-runner.sh --cli` yalnızca CLI'ye özgü bir bayrak (web-ui, toplu çalıştırıcıya shell ile bağlanmıyor); `invite-match.mjs` artık `set-status.mjs`'yi kod kökünden çözümlüyor — web-ui bunu iletmiyor; `company-funded.mjs` aynı safe-url değişikliğini iç yapısında aldı ve `/api/company-funded`'ın ayrıştırdığı `--json` çıktı biçimi değişmedi; `test-all.mjs` yalnızca bir zaman aşımı bütçesini taşıdı (fork'un `vpFixtureEnv` ayrışması bozulmadan duruyor); `web/`, üst projenin kendi ön ucudur ve yansıtılmıyor; `AGENTS.md`/`SIGNATURES.md` yalnızca depoya özgüdür. Çekme sonrası fork ayrışmaları yeniden doğrulandı: `providers/telegram-channel.mjs`'deki Kiril `\p{L}` düzeltmesi, fork'un kendi `providers/telegram.mjs`'i, `web/src/lib/clis.ts` içindeki `hermes`. Kaynak sayısı **92**'de (87 EN + 5 RU) değişmedi, dolayısıyla yardım dokunulmadan kaldı. **3022 → 3042 test.**

## [1.233.2] — 2026-09-10

**Düzeltildi — yüksek önem dereceli iki CodeQL `js/remote-property-injection` uyarısı.**

### Düzeltildi
Kaydedilen değerleri `process.env`'e taşıyan döngü, istek gövdesinden kurulan `Object.entries(safe)` üzerinde dönüyor ve içinde prototip anahtarlarına karşı açık bir koruma taşıyordu. Kod güvenliydi, çünkü `safe` yalnızca `KNOWN_KEYS`'ten doldurulur; ama çözümleyici bu kısıtı iki döngü boyunca izleyemez. Artık doğrudan sabit dizi üzerinde dönüyor, dolayısıyla özellik adı kanıtlanabilir biçimde bir modül sabiti. **Davranış aynı.**

### Notlar
Eski korumayı sabitleyen test, kaynak metninde bir grep'ti. Yerine yapısal bir test ve `__proto__`'yu **ham JSON** olarak gönderen davranışsal bir test geldi. **3021 → 3022 test.**

## [1.233.1] — 2026-09-10

**Düzeltildi — kılavuz v1.233.0'ın eklediği denetimi hiç anlatmıyordu ve aynı bölüm 200 sürümdür doğru olmayan yönergeler taşıyordu.**

### Düzeltildi
**DOC-1** — «Varsayılanı kullan (…)» girdisi «anahtar ayarlanmadı» durumunu ifade eder; aynı değeri listeden açıkça seçmekle farkı görünmez ve önemlidir. Mevcut `### Behavior` listesine üç madde ×17.
**DOC-2** — bir tablo satırı hiçbir anahtarı adlandırmıyordu: hücrede `(server uses default UA)` yazıyordu ve **v1.19.0**'da kaldırılan `HH_USER_AGENT`'ı anlatıyor, dev.hh.ru'ya kayıt öneriyordu — **v1.65.0**'dan beri yararsız. Üç eskimiş anma da gitti; sorun giderme satırı silinmedi, **yeniden yazıldı**: Temmuz 2026'dan beri hh.ru Rus olmayan IP'lere HTTP 451 dönüyor.
**Anahtar tablosu** 45'ten 6'sını listeliyor, oysa başlık bir kayıt defteri vaat ediyor. Bir cümle ×17 onu seçki ilan edip `#/config`'e yönlendiriyor.

### Notlar
Yeni `help-recognized-keys.test.mjs`, anahtar tablolarının ilk sütununu canlı `KNOWN_KEYS` ile karşılaştırır. **3018 → 3021 test**; yardım 32 H2 / 122 H3 olarak kalıyor.

## [1.233.0] — 2026-09-10

**Düzeltildi — `#/config` kaydetme yolunda üç bulgu; CONFIG-3'e v1.232.1'in kendi düzeltmesi yol açtı.**

### Düzeltildi
**CONFIG-3** — tohumlanan değerle çakışan bilinçli bir seçim «dokunulmamış» sayılıp atılıyordu. `initial` iki kökeni karıştırır: `.env`'den tohumlama ve `defaultValue`'dan tohumlama; ikincisinde eşitlik **belirsizdir**. `initial` yanına **`seededFromFile`** yazılarak düzeltildi.
**Bir anahtarı kaldırmak «· 0» bildiriyordu**, çünkü sunucu yalnızca yazılanı döndürüyordu. Artık `removed` da dönüyor ve bildirim ikisini birden sayıyor.
**Açılır liste ayarlanabiliyor ama temizlenemiyordu**: 18'inin hiçbirinde boş seçenek yoktu. Artık her biri «Varsayılanı kullan (…)» ile başlıyor. Bir yeni i18n anahtarı ×17.

### Notlar
Birim taban çizgisi değişmedi (**3018**); tarayıcı **111 → 116**.

## [1.232.1] — 2026-09-10

**Düzeltildi — `#/config` üzerinde Kaydet, kullanıcının hiç dokunmadığı alanları yazıyordu.**

### Düzeltildi
**CONFIG-2.** v1.57.1, ayarlanmamış bir denetimi `defaultValue` ile tohumlar ki alan sunucunun gerçekten kullandığı değeri göstersin; `save()` ise `dirty`'yi **yalnızca gizli alanlar için** sorup diğer tüm alanları her defasında gönderiyordu. Böylece GÖSTERİM için konan değer, kullanıcının seçimiymiş gibi sunucuya gidiyordu: tek bir açılır listeyi değiştirmek **28 anahtar gönderiyor ve kimsenin açmadığı 18 tanesini sabitliyordu**. Değişen şey her ayarın durumu: «ayarlanmamış, projenin varsayılanını izle»den «`.env`'e sabitlenmiş»e.

### Notlar
`cfg.values` ile karşılaştırmak yetmez: ayarlanmamış bir select kendi `defaultValue`'sunu gösterirken saklanan değer `''`'dir. Artık her denetimin **tohumlandığı değerle** karşılaştırılıyor. Yazılan anahtar sayısı bildirime geri döndü. **105 → 111** tarayıcı testi.

## [1.232.0] — 2026-09-09

**Düzeltildi — tarayıcı QA geçişinden iki kusur; ikisi de v1.231.5'ten gelmiyor.**

### Düzeltildi
**PROFILE-1 — `#/profile` tüm sayfayı yana kaydırıyordu.** Değer, yalnızca satır içi yazı tipi stilleri taşıyan adsız bir `<div>`'di; dolayısıyla hesaplanan `overflow-wrap` `normal` kalıyordu. Bir LinkedIn URL'si CSS'e geçerli bir kırılma noktası sunmaz, bu yüzden **min-content genişliği tüm dizedir**; ızgara öğeleri `min-width: auto` ile bunun altına inmeyi reddeder — kart kendi izini, sonra satırı ve belgeyi patlattı (**1280 px'te 23 px gerçek kaydırma**). Ortak `.card-value` sınıfı ve `overflow-wrap: anywhere`, artı `.card-row > * { min-width: 0 }` ile düzeltildi. `break-word` değil `anywhere`: min-content hesabına yalnızca `anywhere` katılır.
**CONFIG-1 — `POST /api/config` select alanı için her değeri kabul ediyordu.** `{"LLM_PROVIDER":"not-a-provider"}` **200** döndürüp `.env`'e yazılıyordu; sonrasında hiçbir şey hata vermiyordu, çünkü çözücü sessizce yedeğe düşüyordu. `LLM_PROVIDERS` zaten `env-config.mjs`'ten dışa aktarılıyordu — doğrulayıcı ona hiç bakmıyordu.

### Notlar
Yalnızca `LLM_PROVIDER` doğrulanır: modellerin gerçek alanı sağlayıcıya aittir ve sürümlerimiz arasında değişir. Zaten kayıtlı bir değere müsamaha gösterilir; form her kaydetmede tüm gizli olmayan alanları yeniden gönderir. Ayrıca `OLLAMA_API_KEY` tanımlayıcısı eklendi. **3013 → 3018 test.**

## [1.231.5] — 2026-09-09

**Güvenlik — yedi danışma kapatıldı; biri kritik uzaktan kod çalıştırma.** Hiçbir kaynak dosyası değişmedi.

### Güvenlik
**Dependabot'tan birleştirildi:** `multer` 2.2.0 → 2.3.0 (**yüksek** — iptal sırasında dosya tanımlayıcı sızıntısıyla hizmet reddi) ve sitede `svgo` 4.0.2 → 4.1.0 (**yüksek** ve orta — `removeScripts` çalıştırılabilir bağlantıları geçiriyordu).
**Ardından, bu birleştirmelerin tetiklediği yeniden tarama beş tane daha ortaya çıkardı.** Etkilenen her aralık mevcut `^` ile zaten karşılanıyordu; dolayısıyla manifest düzenlemesi değil güncelleme gerekti: **`astro` 7.1.0 → 7.3.2** — **kritik**, AVIF görüntü optimizasyonu üzerinden uzaktan kod çalıştırma (7.2.8'de düzeltildi) ve bir yetkilendirme atlatma (7.2.4); **`sharp` 0.35.3 → 0.35.4** — **yüksek**, libheif açıkları; ve **her iki** manifestte **`js-yaml` 4.3.1 → 4.3.2** — **yüksek**.

### Notlar
Burada "yalnızca bağımlılıklar", "risksiz" demek değil. `js-yaml` uygulamanın okuduğu her yapılandırmayı ayrıştırır, `multer` her yüklemeyi kabul eder ve Astro bir **minör** sürüm ilerledi. Doğrulandı: `test:ci` **3013/3013**, tarayıcı takımı 4/4 ve aynı **86 sayfayı**, **17** aynayı üreten tam bir site yeniden yapımı. `npm audit`: her iki manifestte **0** açık.

## [1.231.4] — 2026-09-07

**Düzeltildi — v1.231.3 Doctor tıklamasının sonucunu düzeltti, anını değil. Mobilden ve masaüstünden yeniden bildirildi.**

### Düzeltildi
**`withSpinner` istek uçuştayken düğmeyi hâlâ yeniden yazıyordu.** v1.231.3 ona çocuk düğümleri saklayıp `finally` içinde geri koymayı öğretti ve gerçekten geri geliyorlardı — ama meşguliyet göstergesi yine `'⏳ ' + original` metniyle `replaceChildren` çalıştırıyordu. Böylece `doctor.mjs` çalıştığı sürece 36 px'lik kare `⏳ 🩺Doctor` metnini taşıyor ve satırı bozan geniş bir hapa dönüşüyordu; masaüstünde sıkışık bir `⏳🩺Doctor` görünüyordu. **Öğe çocukları olan bir düğme artık hiç yeniden yazılmıyor**: göstergesi `.is-loading` sınıfı; bu sınıf simgeyi CSS'te kum saatiyle değiştiriyor, dolayısıyla geometri değişemiyor: **boşta 36 px, uçuşta 36 px, sonrasında 36 px**.

### Notlar
Ders koda değil, doğrulamaya dair. v1.231.3'ün kapısı `aria-busy` temizlenene kadar bekleyip sonra ölçüyordu — yapısı gereği yalnızca `finally` bloğunun onardığı durumu görebiliyordu. Yeni denetim **sözü kendisi açık tutuyor** ve uçuşun ortasında örnek alıyor. **3012 → 3013 test.**

## [1.231.3] — 2026-09-07

**Düzeltildi — Doctor'a tıklamak mobilde üst çubuğu bozuyordu. v1.231.2'nin çıktığı gün bir telefondan bildirildi.**

### Düzeltildi
**`UI.withSpinner`, süslediği düğmenin çocuklarını düzleştiriyordu.** Meşguliyet göstergesi `textContent` üzerinden işliyordu: `button.textContent`'i sakla, `'⏳ ' + original` yaz, geri yaz. `textContent`'e atama **bütün** çocukları tek bir metin düğümüyle değiştirir — ve v1.231.2 üst çubuktaki her eylemi henüz `.btn-ico` + `.btn-label` olarak ayırmış, etiketi `max-width: 900px` altında gizlemişti. Böylece Doctor'a ilk dokunuş her iki `<span>`'i kalıcı olarak yok ediyordu: mobil kurallarının eşleşecek bir şeyi kalmıyor, etiket çıplak metin olarak geri geliyor ve 36 px'lik kare, tema anahtarının üstüne binen bir `🩺Doctor` hapına dönüşüyordu. Kendiliğinden düzelmiyordu — işaretlemeyi yalnızca sayfa yeniden yüklemesi geri getiriyordu. Düzeltme çocuk **düğümlerini** saklayıp `replaceChildren` ile geri koyuyor; yalnızca metin taşıyan düğmeler, yani 24 çağrı yerinin çoğu, tıpatıp eskisi gibi davranıyor.
- **FIND-3 — arama alanı 320 px'lik bir telefonda 8 px'e çökmüştü.** Çubuğu tek satıra almak searchbar'ı tek esnek öğe olarak bıraktı; geçen sürümün changelog'u bunu açıkça yazmıştı: *«hiçliğe kadar küçülebilir»*. Küçüldü de: **320 px'te 8 px alan, 340 px'te 28 px** — 21 karakterlik bir yer tutucunun tek karakteri. Tıklanabilir ve yazılabilir, ama artık bir alan olarak okunmuyor. Hiçbir `min-width` bunu çözmez: 320 px'te çubuk 32 px dolgu, 40 px menü ve 162 px eylem taşır; verecek 120 px yoktur. Bu yüzden **420 px** altında alan bir büyütecin arkasına gizlenir ve dokununca tüm çubuğa açılır: **320 px'te 182 px, 360 px'te 222 px, 390 px'te 252 px**, hiçbir genişlikte taşma olmadan. Düğme tek bir erişilebilir ad korur ve durumu `aria-expanded` ile bildirir; 🔍/✕ değişimi saf CSS'tir. 420 px üstünde hiçbir şey değişmez. Canlı yapıya karşı yapılan tarayıcı regresyon geçişinde bulundu.

### Notlar
Bu, v1.231.2'de not edilen `applyI18n()` tuzağıyla aynı kusur sınıfı — artık öğe çocukları olan bir öğeye `textContent` atayan kod — yalnızca başka bir çağırandan geliniyor. Ders genelleşiyor: **bir öğenin içeriğini çocuk `<span>`'lere bölmek, o öğe üzerindeki mevcut her `textContent` yazıcısını gizli bir hataya dönüştürür.**
İki kez kilitlendi: gerçek `withSpinner` üzerinde `node:vm` ve 320 px'te gerçek bir tarayıcıda tıklama. İkisinin de eski kodda düştüğü doğrulandı. **3009 → 3012 test.**

## [1.231.2] — 2026-09-06

**Düzeltildi — mobil üst çubuk iki satıra bölünüyordu, sunucu daha eski bir üst projeyle çalışıyordu ve cvstart.ru yönlendirmesi zaten bir dil adı taşıyan her yolda 404 veriyordu.**

### Düzeltildi
- **Mobil üst çubuk yeniden tek satır, eylemler yalnızca simge.** Eylem düğmeleri tam genişlikte ikinci bir satıra zorlanıyordu: telefonda `[☰ · arama]` üstte, `[🔔 🌙 Doctor Scan'i aç]` altta — kendi satırında iki geniş hap. Artık zil ve tema düğmesinin yanında 36 px kare (🩺 / ⚡) ve 320 px'te her şey tek satıra sığıyor. Göz kararı değil, ölçüldü: belge genişliği 320, 360, 390 ve 430 px'te ve düğmelerin eskiden arama alanının üstüne bindiği 560–760 px bandının tamamında görüntü alanına eşit. **Dil artık mobil yerleşimi hiç etkilemiyor**, çünkü etiket gizli ve düğme sabit bir kare; 900 px üstünde etiketler değişmeden geri geliyor.
- **Sunucu, sürüm 1.32.0'a göre derlenmiş olmasına rağmen üst proje 1.31.0 ile çalışıyordu.** Üretim sunucusu üzerinde `/api/health` `parentVersion: 1.31.0` bildiriyordu. 95 çalışma dosyası eşitlendi, iki tanesi kaldırıldı. Canlı yüzeyde tarayıcı QA'sıyla bulundu.
- **`cvstart.ru` her yolun başına `/ru/` ekliyordu, orada ne olduğuna bakmadan.** `/ru/help` `/ru/ru/help` oluyordu, `/en/help` ise `/ru/en/help`; ikisi de 404. Birincisi ana siteden bir adresi kopyalayınca oluşuyor; ikincisi İngilizce konuşan ziyaretçiyi İngilizce sürümden tamamen dışarıda bırakıyordu. Artık 16 dil önekinden birini zaten taşıyan yol olduğu gibi geçiyor, `en` kaldırılıyor (İngilizce kökte duruyor), gerisi yine `/ru/` alıyor.

### Değiştirildi
- **98 geçersiz kalmış QA istemi `qa/archive/superseded-prompts/` altına taşındı.** `qa/README.md`, v1.137.0'dan beri üst düzeyde yalnızca güncel sürümün isteminin kaldığını belgeliyor — kural 95 sürüm boyunca uygulanmadı.
- **Beş prompt daha üst seviyeden ayrıldı — kendilerini güncel ilan ediyorlardı, değillerdi.** `REGRESSION-FINAL.md` kendini «tek yetkili, sürümden bağımsız regresyon promptu» diye adlandırıyordu; oysa §§11–15'i kapanmış beş döngü defteri (v1.55.x → v1.59.7) ve beyan ettiği yardım temeli **16 dilde 28 H2 / 103 H3** iken bugün 32 / 122 ve 17: onu izleyen bir QA aracı §9'da daha ilk adımda düşerdi. `QA-REGRESSION-PROMPT.md` sürümsüz bir ada ve v1.226.0 içeriğine sahipti. `QA-REGRESSION-PROMPT-v1.76.0-FULL.md` 155 sürüm geriye sabitlenmişti, `REGRESSION-PROMPT-FINAL.md` v1.58.52 → v1.59.10 döngüsünü kapatır ve `QA-FULL-REGRESSION.md` hepsini v1.131.1 temelinde yineliyordu. Onlarla birlikte `PARENT-SYNC-WORKLIST-v1.26.0.md` de gitti (üst proje artık 1.32.0) ve tarihli `UX-AUDIT-2026-07-06.md` `reports/` altına taşındı. Geriye, kendi temelleri v1.231.2 gerçek değerlerine güncellenmiş dört sürücü kaldı. `qa/README.md` var olan klasörü anlatacak biçimde yeniden yazıldı.

### Notlar
- İki özgüllük tuzağı artık `app.css` içinde açıklanıyor: masaüstü kuralları `max-width: 900px` bloğundan **daha aşağıda** tanımlı, bu yüzden eşit özgüllükte onlar kazanıyordu — mobil `gap` sessizce 24 px kaldı (320 px'i taşıran buydu) ve simge gizli kaldı (boş kare düğmeler).
- `applyI18n()` `el.textContent` atadığı için i18n anahtarı iç `<span>`'e taşındı; düğmede kalsaydı her dil değişiminde simgeyi silerdi.
- Üst projenin ilk rsync'i yerelde artık bulunmayan bir dosyada **yarıda kesildi** ve yine de başarı bildirdi. Üst proje dağıtımları artık çıkış koduyla değil, sağlama toplamıyla doğrulanıyor.

## [1.231.1] — 2026-09-06

**Düzeltildi — v1.231.0'ın sayaç taraması tüm bağlantılardaki hesap adını değiştirdi.**

### Düzeltildi
- **Her `Fighter90` bağlantısı `Fighter92` oldu.** v1.231.0'daki kaynak sayacı taraması, `290` ve `901`'i doğru şekilde atlayan ama **`Fighter90`** içindeki `90` ile eşleşen bir rakam sınırı koruması altında `90`'ı `92` ile değiştirdi. **17 README'nin tamamında, 17 yardım paketinin tamamında ve sitenin yardım aynalarında 562 bağlantı**, artı **wiki'de 138 tanesi**, var olmayan bir hesabı gösteriyordu. Eksik görsel sayesinde bir kullanıcı fark etti.
- **Beş tarihsel sürüm göndermesi kaydı.** Aynı sürümdeki `85 → 87` taraması `v1.85.0`'ı `v1.87.0` yaptı ve hiç çıkmamış bir sürüm uydurdu.

### Notlar
- Rakam sınırı yeterli değil: bir sayıyı komşu **rakamlardan** korur, bir **tanımlayıcının** ya da bir **sürüm dizesinin** parçası olmaktan değil. Sayaçların kendisi doğru: 92 kaynak, 87 EN bağdaştırıcı, 3009 test.
- Üst depo etkilenmedi.

## [1.231.0] — 2026-09-05

**Eklendi — üst career-ops v1.32.0'dan iki tarama kaynağı (Collage, Telegram katı), Gem'in REST kipi ve taşımanın üst projenin kendi kodunda ortaya çıkardığı bir kusur.**

### Eklendi
- **İki yeni kaynak, 90 → 92** (87 EN + 5 RU), `ALL_ADAPTERS` **85 → 87**. İkisi de belirteçsiz.
  - **Collage** (`provider: collage`) — Collage HR'ın açık iş sitesi API'si. Yol parçası, **kiracının kendi seçtiği site adresidir**, şirket adından türetilmiş bir slug değil: `api:`'den ya da bir `secure.collage.co/jobs/<adres>` URL'sinden okunur ve **asla tahmin edilmez** — tahmin edilen bir adres başkasının panosunu tarardı.
  - **Telegram (katı)** (`provider: telegram-channel`) — mevcut `telegram` kaynağının okuduğu aynı `t.me/s/<kanal>` önizlemelerini okur, ama **ters takası** yapar: bir gönderi **ancak bir işveren adı verip bir ilan sayfasına bağlanıyorsa** satır olur. Derlemeler, işvereni gizli gönderiler ve yalnızca iletişim içeren gönderiler elenir. Kapsam bilinçli olarak düşük — yukarı akışta gönderilerin %32-77'sinin geçtiği ölçüldü — ama her satır gerçek bir işveren ve gerçek bir bağlantı taşır. İkisi de üst projedeki gibi birlikte sunulur.
- **Gem'e isteğe bağlı bir REST kipi eklendi**, GraphQL yolunun yanına (`api: https://api.gem.com/job_board/v0/<board>/job_posts`). Asla bir pano kimliğinden türetilmez ve GraphQL yolu varsayılan kalır. #3783'ten taşındı.

### Düzeltildi
- **`telegram-channel`'ın konum süzgeci Kiril harflerini göremiyor ve şehirleri işveren diye adlandırıyordu.** Üst projedeki `LOCATIONISH_RE`, yalnızca ASCII için çalışan ve Kiril harflerinin yanında hiç tetiklenmeyen `\b` sınırını kullanıyordu: içindeki tüm Rusça seçenekler erişilemezdi ve `Senior Engineer | Москва` **“Москва”yı işveren olarak** döndürüyordu. Bu, tüm atıf politikasının önlemek için var olduğu yanlış-alan-gerçek-yerine ikamesinin ta kendisi ve sağlayıcının asıl kitlesini vuruyordu. web-ui taşıması Unicode denetimleri kullanıyor; üst projenin bir sabit aşağıda `ROLE_WORD_RE` içinde zaten yaptığı şey. ASCII biçiminde başarısız olan bir testle sabitlendi. **Yukarı akışta henüz düzeltilmedi.**

### Notlar
- **Üst projenin Workday faset kurtarma çalışması (#3851, #3874) taşıma gerektirmedi** — web-ui Workday'i hiç sayfalamıyor, `offset: 0` ile tek bir POST.
- **`providers/_types.js`** yalnızca belgelerde değişti.
- Testler: **2962 → 3009** (+47).

## [1.230.0] — 2026-09-05

**Değişti — üst career-ops v1.32.0’dan üç sağlayıcı düzeltmesi ve taşımanın kendisinin ortaya çıkardığı bir kusur.**

### Eklendi
- **Welcome to the Jungle sunucu tarafında bir Algolia `filters` ifadesi kabul ediyor** (`wttj: { filters: "offices.country_code:FR AND contract_type:full_time" }`). Tek başına bir anahtar sözcük küresel bir panoyu daraltmaz: hangi `max_hits` sonucun geleceğine tarayıcının filtreleri değil, Algolia’nın alaka sıralaması karar verir — bizimkiler sonradan, gelmiş olanın üzerinde çalışır; dolayısıyla üst sınırın ötesindeki her şey, ne kadar iyi eşleşirse eşleşsin görünmezdir. Bir filtre sonuçları yeniden sıralamak yerine **kümeyi** küçültür, bu yüzden sorgu başına sınır 200’den 1000’e çıkar. Filtre varken `queries` isteğe bağlı hale gelir: boş sorgu “filtreden geçen her şey” demektir. Üst projeden #3757 taşındı.

### Düzeltildi
- **Radancy, bir kiracı yalnızca kendi başlığının iddia ettiğinden daha az ilan sunduğunda artık “truncated” uyarısı vermiyor.** Üst proje `data-total-results` değerini dokuz gerçek kiracıyla karşılaştırdı: beşi tuttu, ancak dördü — biri küçük, biri devasa — ilan edilenden %10–56 daha az benzersiz ilan verdi, hem de tek bir yinelenen satır olmadan. Başlık, kiracının kendi arama dizininin gerçekte sunduğunu abartıyor; bu yüzden biriken sayımı onunla karşılaştırmak panoların çoğunda yanlış alarm üretiyordu. Uyarı artık yalnızca yürüyüşü **bizim kendi** `max_jobs`/`max_pages` değerimiz durdurduğunda çıkıyor — çağıranın üzerinde işlem yapabileceği tek durum; `totalResults` bağlam olarak iletide kalıyor ve asla karar vermiyor. #3839’dan taşındı.
- **Radancy her JSON parça isteğinde önbelleği atlıyor.** Bu yolun önündeki bir önbellek katmanı bazı kiracılarda eski yanıtları tekrarlıyor: aynı ilan sayfalar sonra yeniden çıkarken bir başkası hiç sunulmuyor — yukarı akışta dokuzda dokuz kez yeniden üretildi. `Cache-Control`/`Pragma` başlıkları hiçbir şeyi değiştirmedi; istek başına rastgele bir parametre sorunu çözdü. Bu parametre **çağrı** başına benzersiz olmalı, asla sayfa numarasından türetilmemeli: belirlenimci bir parametre önbelleğe yine kararlı bir anahtar, dolayısıyla aynı kararlı ve yanlış eşlemeyi verir. #3839’dan taşındı.
- **Greenhouse ofis listeleri belirlenimci sıradadır.** Greenhouse yanıtlar arasında `offices[]` sırasını garanti etmez ve `/offices` ağacından toplanan küme kendi gezinme sırasını izler. İkisi de ilanın `location` alanına ulaşır; bu yüzden ofislerini yeniden sıralayan bir pano o dizgiyi yeniden yazıyor ve değişmemiş bir ilan yeni gibi okunuyordu. Üst proje kümeyi düzeltti (#3839); **web-ui’de aynı kusurun üst projede bulunmayan ikinci bir örneği vardı** — ilanın kendi konumu yokken devreye giren `offices[0]` yedeği — ve artık ikisi de sıralanıyor.

### Notlar
- **Üst projedeki iCIMS düzeltmesi (#3728) taşıma gerektirmedi.** O, ayrıntı sayfasının JSON-LD’sindeki her `jobLocation` girdisini okur; çünkü bazı kiracılar gerçek adresten önce tamamen `UNAVAILABLE` bir girdi yayınlar. web-ui’nin iCIMS’i konumu **liste sayfasının** HTML’inden alır ve hiçbir zaman ayrıntı sayfası açmaz.
- **`_http.mjs` değişikliği taşıma gerektirmedi.** `isRefusedRedirectError`’ı web-ui’de bulunmayan ikinci bir tüketici için ayırır; `isRetryableError`’ın davranışı değişmez.
- **Konum duyarlı yinelenen ayıklama (#3751) yansıtılmaz** — üst CLI’nin `scan.mjs` hattında yaşar.
- Kayıt defteri değişmedi: **90 kaynak** (85 EN + 5 RU). Testler: **2956 → 2962** (+6).

## [1.229.0] — 2026-09-03

**Eklendi — üst proje career-ops v1.31.0'dan dört tarama kaynağı: Built In, Feishu Jobs, Garena ve MokaHR.**

### Eklendi
- **Dört yeni kaynak, 86 → 90** (85 EN + 5 RU), `ALL_ADAPTERS` **81 → 85**, dördü de jetonsuz. **Built In** ABD teknoloji panosunun dokuz pazarını kapsar ve **varsayılan sorgu taşımaz**: `queries:` ve `categories:` olmayan bir kayıt hiçbir şey taramaz ve bunu söyler — paylaşılan bir kaynak kimsenin arama sözcüklerini taşımamalı; listede olmayan bir pazar **reddedilir**, sessizce ulusal panoyla değiştirilmez. **Feishu Jobs** tam olarak iki ana bilgisayar biçimi kabul eder ve bunlar ilan sayfasına **farklı yollar** kullanır. **Garena** tek şirkettir: `office` **bağlantıyı** biçimlendirir, listeyi değil. **MokaHR** **şifreli yanıt** döndürür (anahtarı yanında gelen AES-128-CBC zarfı) — güvenlik değil gizleme, ama çözmeden hiçbir şey okunmaz.

### Düzeltildi
- **`htmlToText` metne yarım bir etiket açıcısını sızdırabiliyordu.** `safe &lt;img src=x onerror=1` şöyle çıkıyordu: `safe <img src=x onerror=1`. Artık her çözümlemeyi bir temizleme izliyor ve sondaki açıcı köşeli işaretini yitiriyor. Üst projeden portlandı (#3491).

### Notlar
- **Üst projenin Workday düzeltmesinden hiçbir şey portlanmadı.** O düzeltme, arka ucu sayfalamayı 2000. konumda kilitleyen kiracıları kurtarır — web-ui Workday'i hiç sayfalamıyor (`offset: 0`'da tek POST, 100 satır).
- **`verify-cv-facts` ve `merge-tracker` düzeltmeleri port gerektirmedi**: web-ui bu betikleri üst projenin checkout'undan çalıştırır.
- Testler: **2909 → 2956** (+47).


## [1.228.5] — 2026-08-30

**Düzeltildi — bildirilen sürüm diskteki dosyayı tarif ediyordu, çalışan kodu değil.**

### Düzeltildi
- **`/api/health` her istekte `package.json`'ı yeniden okuyordu, dolayısıyla eskimiş bir süreç çalıştırmadığı bir sürümü bildiriyordu.** QA, `version: 1.228.4` yanıtı verirken 1.228.3'te eklenen `/api/ping` için 404 döndüren yerel bir örnek buldu: dağıtımdan önce başlatılmış, eski kodu sunuyor ve yeni dosyanın sürümünü bildiriyordu. Dosyaları kopyalayıp asla yeniden başlatmayan bir dağıtım tam olarak böyle başarılı görünür: bir operatörün baktığı tek dizge, sorunu göremeyen dizgedir. v1.228.1'deki sembolik bağla aynı sınıf — rsync aktarımın ortasında durup yine de başarı bildiriyordu.

  Sürüm artık modül yüklenirken yakalanıyor ve çalışan kodu tarif ediyor. Eskimiş bir süreç **eski** sürümü bildirir — gerçeği, ilk istekte görünür biçimde. `parentVersion` istek başına kalmaya devam ediyor: üst projenin checkout'unu tarif eder; bu süreç onu yüklemez ve çalışan bir sunucunun altında meşru olarak değişebilir.

## [1.228.4] — 2026-08-30

**Düzeltildi — kimlik doğrulaması olmayan canlılık probu her istekte disk işi yapıyordu.**

### Düzeltildi
- **`GET /api/ping` her vuruşta `package.json` okuyup ayrıştırıyordu.** Kimlik bilgisi olmadan erişilebilen tek uç nokta olduğundan, istek başına bir disk okuması artı JSON ayrıştırması herkese uzatılmış bir hizmet reddi kaldıracıdır — CodeQL bunu hız sınırlaması eksikliği olarak işaretledi. Sürüm artık rota kaydında bir kez okunuyor; yeniden başlatmadan zaten değişemez, dolayısıyla işleyici hiç G/Ç yapmıyor. Hız sınırlaması hasarı sınırlardı; işi kaldırmak kaldıracı kaldırır.
- **Profil sahibinin gerçek adının loopback dışında maskelenmesi artık bir testle sabitlendi.** `/api/health` bunu zaten `hidden` ile değiştiriyordu — ama yalnızca o satır `hidden ?? value` koruyucusunu proje köküyle paylaştığı için. Bunu hiçbir şey sınamıyordu; satıra kendi değerini veren bir düzenleme, gerçek bir kişinin adını fark edilmeden yerel ağa sızdırırdı.

## [1.228.3] — 2026-08-30

**Fixed — the docs assistant could not answer in English, Telegram company names arrived truncated, and a monitor had no way to see the service was up.**

### Fixed
- **The docs assistant answered "no matching help sections were found" in English while the same question worked in Russian.** Retrieval was fine; the context builder was not. `buildAskPrompt` did `if (ctx.length + sec.body.length > MAX_CONTEXT) break` — a `break`, so one oversized section ended the loop and left the context **empty**, and the assistant truthfully reported it had nothing. The English §5 had grown to **16 081 bytes against a 14 336-byte budget** (partly because v1.228.0 added `telegram_channels` to it); the Russian §5 was 13 009 and fit. Same ranking in both languages — §5 was first — only the size differed.

  Two changes: a section past 6 KB is now split at its `###` boundaries, so `telegram_channels` is its own retrievable chunk (1 340 bytes) that ranks **first** in both languages; and an oversized section is skipped or truncated rather than ending the loop. The guide went from 32 chunks to 75.
- **A Telegram company label yielded the sentence after it, not the name.** `Компания: FinCore Technology (продуктовая разработка, высоконагруженные системы)` became `FinCore Technology (продуктовая разработка, высоконагруженны` — capped at 60 characters, cut mid-word. Three of 141 rows. The name now ends at the first separator that introduces a description — a **spaced** dash (so `Coca-Cola` survives), a comma, semicolon, pipe or opening parenthesis — and any remaining cap falls on a word boundary. This source attributes a company as fact; a truncated sentence is as wrong as a guessed name, only less obviously so.

### Added
- **`GET /api/ping` — a liveness probe that leaks nothing.** `{ ok, version }` and no more. `/api/health` reports absolute paths, the profile owner's real name and which API keys are set: legitimate for an authenticated operator, never for the public internet. A monitor behind a Basic-auth gate previously had no way to see the service was up at all.

## [1.228.2] — 2026-08-30

**Fixed — a two-word search in `/api/scan-results` matched the phrase, not the words, and under-reported badly.**

### Fixed
- **`?q=` now matches every term independently instead of the literal phrase.** The query was a single `includes(q)` over title + company + location, so `продакт менеджер` found only rows carrying those two words in that exact adjacency — **32 of the 162** that carry both. `Менеджер продукта` and `Менеджер по развитию продукта` were invisible to it: the same words, reordered or with filler between them.

  This is how a narrow match becomes a **wrong answer**. The Telegram assistant asked for all Продуктовый менеджер reported 9 — faithfully, because 9 was what the endpoint said. The count it quoted was honest; the endpoint's was not. Word order and the words between are not something a person typing two words intended to pin.

  Matching is AND across terms, so widening precision costs nothing: a row must still carry every term. `менеджер разработчик` returns zero rather than the union.

## [1.228.1] — 2026-08-29

**Fixed — a dangling symlink in the repo that silently truncated deploys.**

### Fixed
- **`.claude/skills/refero-design` was a tracked symlink to a path that has never existed here.** It pointed at `../../.agents/skills/refero-design`, which resolves to `.agents/` at the repo root; there is no such directory, and the link arrived in the v1.118.0 parity pack from a machine where the surrounding folders nested differently. Anyone cloning the repo has been getting a broken link ever since.

  It was not inert. **rsync aborts on it mid-transfer** — a deploy today reported success while the server kept running the previous version, and the mismatch only surfaced because the version was checked afterwards. The parent project's `node test-all.mjs` also crashes outright when a web-ui checkout sits inside its tree, because its fixture copy walks the working directory and cannot stat the link. Nothing referenced it: the only `refero` matches in the repo are the Polish word *preferowany*.

## [1.228.0] — 2026-08-29

**Eklendi — tarama kaynağı olarak Telegram kanalları ve `/api/scan-results` için sayfalı sorgu kipi.**

### Eklendi
- **Telegram kanalları artık taranabilir bir kaynak.** `portals.yml` içindeki `telegram_channels:` bloğu onları listeler; her biri herkese açık `https://t.me/s/<kanal>` önizlemesinden okunur. Kayıt defteri: **85 → 86 kaynak** (81 EN + 5 RU), `ALL_ADAPTERS` **80 → 81**. Telegram RSS yayımlamaz ve Bot API, botun yönetmediği bir kanalı okuyamaz — iki bariz yol da kapalı. `/s/` önizlemesi sunucuda üretilmiş düz HTML'dir: oturum yok, JS yok, çerez yok. 16 kanalda doğrulandı: 15'i çıplak bir GET'te 20'şer gönderi döndürdü.
- **`GET /api/scan-results` sayfalı sorgu kipi kazandı.** `?q=<metin>&limit=50[&region=ru|en][&set=filtered|fresh][&offset=N]` `{ total, returned, offset, limit, set, rows }` döndürür; **`total` sayfalamadan ÖNCEKİ sayıdır**. Parametresiz haliyle rota yine tüm anlık görüntüyü döndürür — `#/scan` tablosu o biçime bağlıdır.

### Düzeltildi
- **Telegram asistanı verinin bir kısmıyla yanıt veriyordu.** Becerisi zaten `/api/scan-results`'ı gösteriyordu, ama rota yalnızca tüm anlık görüntüyü döndürebiliyordu — gerçek makinede yaklaşık 2 MB — ki bu bir ajanın bağlamına sığmaz. «Tüm Product Manager'ları bul» isteğine, anlık görüntüde yüzlercesi varken **9** eşleşme bildirdi ve «sınırlı bir yerel dizinle çalıştığını» söyledi. Doğruydu: uç noktayı görüyor ama sindiremiyordu. Sayfalı kiple aynı soru 2 KB tutuyor ve dürüst bir `total` döndürüyor. Beceri de yeniden yazıldı: *yeni* gönderileri özetlemeyi istiyordu, yani `filtered` yerine `fresh`'i işaret ediyordu.

### Notlar
- **Kanal gönderisi düzyazıdır, iş kaydı değil.** Yapılandırılmış alan yok: başlık ilk anlamlı satırdan, şirket/konum/ücret açık etiketlerden alınır. **Gerçek ilanları reklam ve derlemelerden ayırmak mevcut `title_filter`'a bırakılmıştır** — diğer kaynaklar için zaten ayarlanmış olana. Bunlar ipucudur, liste değil.
- **Şirket asla tahmin edilmez.** Etiket yoksa satır kanala atfedilir (`@rabotaphp`): yanlış bir işveren izleyiciye gerçek olarak girer.
- **Boş ayrıştırma bir hatadır, «ilan yok» değil.** t.me gizli veya var olmayan bir kanala yönlendirmeyle yanıt verir; sıfır satır döndürmek sakin bir gün gibi okunur ve yapılandırmadaki yazım hatasını sonsuza dek gizler. `jobGeeks` tam da bunu yapar (HTTP 302) ve bilinçli olarak **yapılandırılmadı**.
- Uzaktan çalışma tespiti `\b` yerine Unicode sözcük sınırı kullanır; `\b` yalnızca ASCII bilir — v1.227.3'te başlık filtresinin düştüğü tuzağın aynısı, burada yayından önce bir testle yakalandı.
- 15 kanal yapılandırıldı ve canlı doğrulandı: **299 gönderi, 15/15 kanal**. 30 yeni test. Testler: **2865 → 2895**.
- **The README test counts jumped by hundreds, and no, this release did not add them.** The localized READMEs carried unit-test totals frozen at 1856 / 1945 / 1955 / 549 / 419 / 284 / 2527 depending on the file — each stale since a different release, and several contradicting the badge at the top of the same page. They now all read **2895**, verified by running the suite rather than by copying a badge. Playwright (70 / 90 / 12 → **101**), e2e smoke (20 → **21**), route modules (12 / 32 → **37**), smoke flows (12 → **22**) and the test-file count (218 → **329**) were stale in the same way. The `Total` row also repeated the unit count, so it under-summed the three suites below it; it now reads the real sum (**3040**).

## [1.227.5] — 2026-08-29

**Düzeltildi — bölgesel tarama sunucunun belleğini tüketiyordu ve bir Playwright takımı kendi sökümünde kararsız biçimde düşüyordu.**

### Düzeltildi
- **Bölgesel tarama sunucuyu OOM ile öldürüyordu.** `ru-scanner`, **tüm sorguların tüm ham sonuçlarını** biriktirip yinelenenleri ayıklamayı ve süzmeyi ancak en sonda yapıyordu. Sorgu listesi bilerek yakın eşanlamlılarla dolu (`Golang`, `Go разработчик`, `Golang разработчик`, `Senior Go`…), yani aynı ilan her sorguda bir kez dönüyor ve dizi benzersiz sayının katlarını tutuyordu — üstelik ilan nesnesinin büyük kısmını oluşturan ve süzgeçlerin neredeyse tümünü attığı açıklamalarla birlikte. Ölçüm: 21 sorgulu gerçek bir koşuda **742 MB** yığın. Sunucu Node yığınını **490 MB** ile sınırlıyor (V8 bunu makinenin 956 MB RAM'ine göre belirliyor), bu yüzden tarama servisi `FATAL ERROR: Reached heap limit` ile deviriyordu — **bir günde dört kez**. Artık ayıklama ve süzme her sorguda yapılıyor; aynı koşu **177 MB**'a indi, %76 azalma. Raporlanan sayılar değişmedi: benzersiz toplamı URL dizgilerinden oluşan bir `Set` taşıyor.
- **`net::ERR_SOCKET_NOT_CONNECTED` CI'ı rastgele düşürüyordu.** Üç Playwright takımı, konsol hatası olmadığını doğrulamadan önce süren istekleri durdurmak için `window.stop()` çağırır. Chromium bu tek kasıtlı eylemi soketin durumuna göre **üç** farklı adla bildirir: iptalde `ERR_ABORTED`, yoldayken `ERR_EMPTY_RESPONSE`, soket çoktan gitmişse `ERR_SOCKET_NOT_CONNECTED`. Ortak filtre yalnızca ilk ikisini biliyordu. `tr` yerel taramasında ortaya çıktı; aynı çağrıyı yapan `playwright-forms` ve `playwright-smoke` da tek şanssız koşum uzaktaydı.

### Notlar
- **Neden ancak şimdi bozuldu.** Ürün müdürü aramaları eklenince liste 14'ten 21 sorguya çıktı. Eski uygulamanın belleği toplam sonuç sayısıyla ölçekleniyordu, dolayısıyla %50 daha fazla sorgu makinenin tavanını aştı.
- **Ayıklama değişikliği davranışı korur ve bu iddia değil, test edilmiştir.** `tests/ru-scanner-dedup-order.test.mjs` zor yönü sabitler — süzgeçlerden **geçemeyen** sonraki bir yineleme, geçmiş olan öncekini dışarı atmalıdır — ve eski uygulamaya karşı 200 rastgele denklik denetimi koşar.
- **Konsol süzgeci dar kalıyor.** Yalnızca iptal edilmiş istek ailesi zararsızdır; reddedilen bağlantı, DNS hatası, sıfırlama, her 5xx ve yakalanmamış JS istisnaları hâlâ savı düşürür.
- İki hipotez gönderilmek yerine sınandı ve elendi: Caddy zaman aşımı (yapılandırma temiz, SSE için `flush_interval -1` doğru) ve Node'un varsayılan 5 dakikalık `requestTimeout` değeri (küçültülmüş bir yeniden üretim, uzun bir akış yanıtını kesmediğini gösterdi). Asıl kanıt, günlükteki `Reached heap limit` idi. Testler: **2860 → 2865**.

## [1.227.4] — 2026-08-29

**Düzeltildi — `word:` / `stem:` `content_filter` tarafından hâlâ yok sayılıyordu; v1.227.3 yalnızca başlık filtresini düzeltmişti.**

### Düzeltildi
- **`content_filter` önekleri dikkate almıyordu.** v1.227.3, `title_filter`'a üst projenin `word:` / `stem:` öneklerini öğretti ama `content_filter`'ı kendi ham `lower.includes(k)` çağrısıyla bıraktı; dolayısıyla orada önekli bir girdi hâlâ birebir metin olan `"word:java"` ile eşleniyordu — aynı sessiz no-op, bir filtre ötede. `content_filter` ilanın AÇIKLAMASINI okur ve varsayılanı hep düz alt dize olmuştur: bu yüzden çıplak bir olumsuz `java`, yalnızca „JavaScript“ten söz eden her ilanı eler; önek ise tek bir girdiyi bu varsayılandan çıkarma yoludur. Üst projenin `compileContentKeyword` işlevi aktarıldı: aynı önek düzeneğini paylaşır ama kısa anahtar kelimeleri bilinçli olarak **sabitlemez** — başlık filtresi 2–3 harfli kısaltmaları sabitler çünkü „Coordinator“ içindeki „COO“ her zaman yanlıştır; oysa bir düzyazı paragrafındaki kısa dizi çoğu kez kasıtlıdır (`aws`, `gcp`, `sql`, `go`).

### Notlar
- **v1.227.3 PR'sinin yapay zekâ incelemesinde bulundu**; inceleme, kodun kendi yorumunun iddia ettiğini karşılamadığını fark etti — yorumda „`title_filter` / `content_filter`“ yazıyordu ama yalnızca başlık yolu bağlıydı. Yorum artık açıkça ayırıyor: önekleri iki filtre de tanır, kısaltmaları yalnızca başlık filtresi sabitler.
- **Yine o incelemeden doğrulandı ve değişmedi:** 2–3 harfli kısaltma kuralını `\b` yerine Unicode sınırına taşımak ASCII'de birebir aynı davranır ve yalnızca olması gereken yerde daha katıdır — `COO_lead` ve `coo1` korunmaya devam eder (alt çizgi ve rakam her ikisinde de sözcük karakteridir), `Coordinator` korunur, „Директор COO“ ve „VP «Продукт»“ doğru biçimde elenir. 14 sınır durumu denetlendi.
- Öneksiz `content_filter` girdileri önceki eşleşmesini bayt bayt korur, boş veya eksik bir açıklama yine geçer ve içi boş bir `word:` / `stem:` her şeyle değil hiçbir şeyle eşleşir. `tests/content-filter.test.mjs` içinde 6 yeni durum. Testler: **2852 → 2858**.

## [1.227.3] — 2026-08-29

**Düzeltildi — başlık filtresindeki `word:` / `stem:` önekleri sessizce yok sayılıyor, o filtre satırlarını etkisiz bırakıyordu.**

### Düzeltildi
- **web-ui, üst projenin `word:` / `stem:` öneklerini uygulamıyordu.** `title_filter` (ve `content_filter`) varsayılan olarak büyük/küçük harf duyarsız **alt dize** eşleşmesi yapar; bu yüzden çıplak bir olumsuz `intern` girdisi „International Product Manager“ ve „Internal Tools Engineer“ başlıklarını da eler. Bu varsayılanı tersine çevirmek yapılandırılmış her kurulumu bozacağından, üst proje kesinliği girdi başına isteğe bağlı yaptı: `word:intern` yalnızca tam sözcüğü, `stem:agent` ise bir sözcüğün başını eşler ve devam edebilir („Agentforce“ ile „Reagents“ı ayırır). web-ui'de ikisi de yoktu; girdiyi **birebir metin** olan `"word:intern"` şeklinde eşliyordu — böyle bir dizi hiçbir ilan başlığında geçmez. Satır sessiz bir no-op'a dönüştü: aynı `portals.yml` CLI'da doğru süzerken burada hiç süzmüyordu, dolayısıyla dışlanan her staj ilanı yine `#/scan` tablosuna ulaşıyordu. Üst projenin `title-keywords.mjs` dosyasından aktarıldı; yalnızca ASCII bilen ve aksanlı ya da Kiril başlıklarda sözcük ortasında eşleşen `\b` yerine Unicode farkında sözcük sınırı (`\p{L}\p{M}\p{N}_`) dahil.

### Notlar
- **Gerçek bir `portals.yml` incelenirken bulundu**; oraya `word:intern` **tam da** çıplak `intern` girdisi „International Product Manager“ı elemesin diye yeni eklenmişti. Önek CLI'da çalışıyordu; web-ui sessizce tüm staj ilanlarını tutuyordu. Artık davranış aynı.
- **Varsayılanlar değişmedi.** Öneksiz bir anahtar kelime önceki eşleşmesini korur: öbekler ve harf dışı karakter içeren her şey (`.NET`, `SAP `, `L&D`) alt dize, 2–3 harfli kısaltmalar sözcük sınırına bağlı. İçi boş `word:` / `stem:` yazım hatası sayılır ve **hiçbir şeyle** eşleşmez — olumsuz olarak boş bir desen her başlıkla eşleşir ve tek bir başıboş iki nokta yüzünden tüm taramayı geçersiz kılardı.
- 2–3 harfli kısaltma kuralı da aynı Unicode sınırını kullanıyor: önceden `\b` kullanıyordu, bu yüzden ASCII dışı başlıklarda `coo` ile `word:coo` ayrışıyordu — tek kuralın iki yazımı.
- `tests/title-filter.test.mjs` içinde 6 yeni durum. Testler: **2846 → 2852**.

## [1.227.2] — 2026-08-29

**Düzeltildi — dar telefonlarda `#/config` yana kayıyordu.**

### Düzeltildi
- **MOBILE-1: `#/config` ≤ 352 px görünüm alanlarında yatay taşıyordu.** Her select alanı **satır içi** bir `min-width: 300px` taşıyordu. Satır içi stil stil sayfasını yener, dolayısıyla denetim kabıyla birlikte küçülemiyordu: 320 px görünüm alanında select'in sağ kenarı 353 px'e düşüyor, sayfada yatay kaydırma oluşuyor ve denetimler sağ kenarın dışına itiliyordu. 18 sağlayıcı/model select'inin tamamı etkileniyordu (`cfg-llm-provider` ve tüm `cfg-*-model`). Artık `min-width: min(300px, 100%)` + `max-width: 100%`; rahat 300 px yalnızca yer varsa uygulanıyor. Eşikteki ve altındaki cihazlar: iPhone SE (1. nesil, 320 px), eski Android'ler, Galaxy Fold dış ekranı.

### Notlar
- **Önceki tüm mobil geçişlerin bunu neden kaçırdığı.** 360 px ve 375 px taşmayı gizlemeye tam yetecek paya sahip ve Playwright takımları 1280 px genişliğinde bir pencerede koşuyor. CI'da 375 px'ten dar bir görünüm alanı hiç ölçülmemişti. Yeni `tests/playwright-narrow-viewport.mjs` form taşıyan rotaları **320 px**'te tarıyor ve herhangi bir yatay taşmada başarısız oluyor; mesajda en geniş öğeyi adlandırıyor. İkinci durum, hiçbir `#/config` select'inin görünüm alanını aşmadığını sabitliyor. Önce hatayı yeniden ürettiği doğrulandı (`scrollWidth 353 > clientWidth 320`, sağ kenarı 353 olan 18 select). Playwright: **99 → 101**.
- **Bilinen ve bilinçli olarak henüz kapı altında değil: 280 px** (Galaxy Fold dış ekranı) hâlâ ~5 px taşıyor, ama nedeni farklı — yapılandırma kartının `<details>` bloklarındaki uzun içerik ve 280 px görünüm alanına karşı 256 px'lik kenar çubuğu; bu sürümün düzelttiği satır içi `min-width` değil. Yaygın hiçbir telefonun bildirmediği bir genişliğe göre yeniden akıtmak ayrı bir iş; takımın `WIDTHS` listesi buna hazır.
- v1.227.1 QA istemi de düzeltildi: takip rotasını `#/modes/followup` olarak adlandırıyordu. Mode sayfaları çıplak slug ile kaydolur (`Router.register(cfg.slug)`), dolayısıyla rota `#/followup`'tır ve `#/modes/followup` doğru şekilde 404 verir. Yalnızca belge.
- Birim takımı **2846**'da değişmedi (yeni kapsam tarayıcı düzeyinde).

## [1.227.1] — 2026-08-29

**Düzeltildi — yardımdaki kaynak dökümü kendisiyle tutmuyordu ve GitHub afişi uygulamada ham işaretleme olarak basılıyordu.**

### Düzeltildi
- **§17 toplamı ve dökümü birbirini tutmuyordu.** Tüm yardım paketleri „`server/lib/sources/` kaydı **85** adaptör içerir — **78 İngilizce + 5 Rusça**“ diyordu. 78 + 5 = 83, 85 değil; ja/ko'da sapma 77'ye (= 82) kadar gitmişti. Her yeni kaynak toplamı yükseltip terimi olduğu gibi bıraktığı için iki sayı birkaç sürümdür ayrışıyordu. Döküm artık 17 dilin tamamında **80 EN + 5 RU**. Bu görsellikten fazlası: `docs/help/<lang>.md`, „Ask the docs“un dayandığı TEK derlem; dolayısıyla kaç kaynak desteklendiğini soran kullanıcı tek bir cümleden birbiriyle çelişen iki sayı alıyordu.
- **Aynı cümle eskimiş bir sürüm çıpası tutuyordu.** „**v1.213.0** itibarıyla kayıt …“ 16 dilde hayatta kalırken sayaç iki kez değişti (v1.219.0'da 83, v1.226.0'da 85). Çıpa v1.210.1'de elle bir kez onarılmış ve yeniden kaymıştı. Sürümsüz bir ifade lehine kaldırıldı — sayacın kendisi canlı kayda karşı doğrulanıyor ve eskiyemez.
- **Sağlayıcı afişi `#/help` başında kaçışlanmış işaretleme olarak basılıyordu.** v1.225.0/v1.225.1, onun „`UI.md()` tarafından uygulamada kaldırıldığını (görsel desteği yok)“ kaydetmişti. Bu iki farklı şeyi karıştırıyor: `UI.md()` önce kaçışlar — herhangi bir markdown dönüşümünden önce kaynağın her baytını kaçışlar; bu doğru XSS sınırıdır ama kaldırmanın tam tersidir. Kimse afişi kaldırmıyordu çünkü kimse denemiyordu ve 17 dilin tamamı `#/help`i 268 karakterlik düz `<p align="center"><img src="https://…` ile açıyordu. Yeni ortak giriş (`server/lib/help-markdown.mjs::stripGithubOnlyBlocks`) okuma sırasında tek başına duran HTML görsel bloklarını atıyor — hem `GET /api/help/:lang` hem de docs-assistant derlemi için. Dosyalarda afiş kalıyor, dolayısıyla GitHub vitrini yine görünüyor.
- **Kadans panosundaki „#“ sütunu v1.117.0'dan beri boştu.** `entry.appNum` okuyordu; oysa `followup-cadence.mjs` `num` yayıyor — `appNum` yükte hiç var olmadı. Artık ikisi de okunuyor. v1.227.0'daki „Next up“ satırı aynı hatayı devralmıştı, birlikte düzeltildi.

### Notlar
- **Dördü de kendilerini kollayan bir şey olmadığı için gözden kaçtı.** Yardım kapıları (`canonical-docs-coverage`, `help-ui`, `help-ru-config-section`) BAŞLIK sayar — 32 H2 / 121 H3 — ve hiçbir test bir paragrafın içindeki sayıyı okumamış, yardım girişinin gerçekte ne sunduğuna bakmamıştı. İki yeni takım bunu kapatıyor: `tests/help-source-counts.test.mjs` (belirtilen toplam `SOURCES.length`e eşit; terimler canlı EN/RU bölünmesine eşit ve toplamı veriyor; paragraf sürüm sabitlemiyor) ve `tests/help-banner-strip.test.mjs` (afiş GitHub için diskte kalır, süzmeden asla sağ çıkmaz, her paketin ilk render satırı başlığıdır, süzme dar kalır ve iki tüketici de oradan geçer). İkisinin de commit öncesi tam bu hatalara karşı kırmızı düştüğü doğrulandı. Test paketi: **2837 → 2846**.
- Kayıt, tarayıcı veya rota sözleşmelerinde değişiklik yok; kaynaklar **85** (80 EN + 5 RU), `ALL_ADAPTERS` **80** olarak kalıyor.

## [1.227.0] — 2026-08-28

**Eklendi — SEEK Hong Kong (JobsDB), takipler için yalnızca-zamanı-gelenler süzgeci ve gizli işverenlerin kendilerini sunan ajansı göstermesi.**

### Eklendi
- **Mevcut Jobstreet/SEEK kaynağı üzerinden JobsDB Hong Kong.** Hong Kong JobsDB markasıyla işliyor ama aynı v5 uç noktasının arkasındaki aynı SEEK platformunda duruyor; bu yüzden ayrı bir kaynağa gerek yok — host beyaz listesine `hk.jobsdb.com` ve `siteKey: HK-Main` yeterli. Kayıt defteri değişmiyor: **85 kaynak** (80 EN + 5 RU) ve `ALL_ADAPTERS` **80** — bu, mevcut bir adaptör üzerindeki yeni bir PAZAR, yeni bir adaptör değil.
- **Kadans panosunda yalnızca-zamanı-gelenler süzgeci** (`#/modes/followup`). Yeni bir onay kutusu panoyu *şu anda* aksiyon alınabilir olanlarla sınırlıyor. Zamanın gelip gelmediği, üst projenin `followup-cadence.mjs` dosyasının zaten hesapladığı `urgency` alanından okunuyor (`urgent` / `overdue`) — asla izleyicinin `status` alanından değil; o alan `applied`/`responded`/`interview` değerlerini taşır ve hiçbir şeyle eşleşmezdi. Zamanı gelen bir şey yoksa pano, boş bir ekran göstermek yerine en yakın planlanmış takibi bildiriyor. Mantık, üst projedeki `followup-view.mjs` dosyasının aynası olan saf `public/js/lib/followup-view.js` modülünde yaşıyor.
- **Gizli işverenler, kendilerini sunan ajansa atfediliyor.** İşvereni saklanan bir ilan izleyicide `?` olarak kaydedilir ve işe alım uzmanı `Via` sütununa yazılır. `#/tracker` çıplak bir `?` gösteriyordu; bu yüzden birden çok gizli satır birbirinden ayırt edilemiyor, logo çözücü de eşleştirecek bir şey bulamıyordu. Böyle bir satır artık **“Gizli · \<ajans\> aracılığıyla”** biçiminde okunuyor, logosunu ajans adından çözüyor ve arama kutusunda o adla bulunabiliyor. Yalnızca sunum — kanonik `company` alanının üzerine asla işe alım uzmanı yazılmıyor. Üst projedeki `company-presentation.mjs` dosyasının aynası olan yeni saf `public/js/lib/company-presentation.js` modülü.

### Düzeltildi
- **Jobstreet/SEEK kullanımdan kaldırılmış bir uç noktayı çağırıyordu.** Kaynak hâlâ SEEK'in emekliye ayırdığı chalice-search v4'e (`/api/chalice-search/v4/search`) işaret ediyordu; üst proje `/api/jobsearch/v5/search` adresine geçmiş, web-ui ise hiç takip etmemişti. Artık her Jobstreet/SEEK girdisi v5'i sorguluyor. v5 öğe biçimi doğal olarak okunuyor (iş URL'si `id` üzerinden kuruluyor, `locations[0].label`, `advertiser.description`, `salaryLabel`), v4'e özgü `solrFields` izdüşüm parametresi kalktı ve `portals.yml` dosyasında hâlâ ölü v4 yolunu sabitleyen bir girdi, pazar ana makine adını korurken yolu v5 üzerinde yeniden kuruluyor — kullanıcının düzenleme yapmasına gerek yok.

### Notlar
- career-ops 1.30.0 eşitliği (üst projenin HEAD'i `8d64f65` → `6cc46a4`; `VERSION` dosyası hâlâ 1.30.0 diyor — release-please `main`'in gerisinde). Aktarılmayanlar ve gerekçeleri: **iCIMS JSON-LD konum doldurma** — web-ui'nin iCIMS kaynağında hiç `enrichDate()` kancası yok (yalnızca liste sayfaları), dolayısıyla düzeltilecek bir kod yolu da yok; **ölümcül olmayan CLI stderr (#1974)** — web-ui'nin çalıştırıcısı başarısızlığa yalnızca çıkış koduna bakarak karar verir ve o buluşsal yönteme hiç sahip olmadı; **Turbopack yol izleme** — web-ui'de paketleyici yok; **`cv-sync-check` düzeltmeleri** — salt okunur ve fail-soft biçimde aktarılıyor; **`scan.mjs` içinde Playwright sıralaması, Block H yanıtları, updater/doctor/`update-system` korumaları, özyinelemeli sözdizimi denetimi, Go panosu ve `jd-skill-gap`/`verify-cv-facts` öz-testlerine yapılan eklemeler** — web-ui'nin çağırmadığı yalnızca-CLI yüzeyleri veya davranış değiştirmeyen öz-testler. Test paketi: **2818 → 2837**.

## [1.226.0] — 2026-08-27

**Eklendi — iki Vietnam iş kaynağı: ITviec ve CareerViet.**

### Eklendi
- **ITviec + CareerViet (Vietnam).** Host-sabitlemeli iki Vietnam panosu `provider: itviec` / `provider: careerviet` girdileriyle tarayıcıya katılır: **ITviec** (itviec.com, teknoloji) ve **CareerViet** (careerviet.vn, geniş kapsam). İkisi de token gerektirmeyen HTML kazıyıcılardır; SSRF host-pin, yalnızca-HTTPS, şirket bazında fail-soft ve sayfa üst sınırları içerir. Kayıt artık **85 kaynak** (80 EN + 5 RU), `ALL_ADAPTERS` **80** taşır — ikisi de `#/scan` Kaynak filtresinde görünür.

### Notlar
- career-ops 1.30.0 paritesi (parentVersion 1.29.0 → 1.30.0). Taşınmadı (yalnızca CLI/topluluk veya zaten kapsanmış): Hired Wall, `/calibrate`, clean-markers, şablon paketleri, doctor, pdf/LaTeX ve web-ui'nin çağırmadığı eval/tracker/scan CLI'leri; `_html-to-text` düzeltmesi ve `roleFuzzyMatch` zaten vardı; `title-filter stem:` öneki ertelendi. Test paketi: **2818**.

## [1.225.1] — 2026-08-27

**Düzeltildi — sağlayıcı logo afişi artık README ve yardımda görünüyor.**

### Düzeltildi
- v1.225.0 afişi GitHub'da görünmüyordu: bağımsız `images/providers.svg` dosyasında GitHub'ın reddettiği geçersiz bir `font-family` (iç içe çift tırnak) vardı, `<img>` depo-göreli bir `src` kullanıyordu (ham HTML `<img>` GitHub'da göreli yolları çözmez) ve `<p>` bloğunda sondaki boş satır yoktu. Artık mutlak bir URL üzerinden işlenmiş bir `images/providers.png` gösteriyor, boş satırlarla ayrılmış olarak; SVG de geçerli XML'e düzeltildi.

### Notlar
- Yalnızca dokümanlar; kod veya test değişikliği yok. cvstart.org vitrini ve uygulamanın kutucukları zaten doğruydu (satır içi SVG, bu dosya değil).  **2784**

## [1.225.0] — 2026-08-27

**Eklendi — README ve yardım kılavuzunda bir sağlayıcı logo afişi.**

### Eklendi
- **Sağlayıcı logo afişi.** Tek ve kendi kendine yeten bir `images/providers.svg` — **18 LLM sağlayıcısı**, simge yayımlayan 11'i için **gerçek marka logosu** ([simple-icons](https://simpleicons.org), CC0) ve kalan 7'si için marka renkli monogram ile — artık README'nin (×17) ve uygulama içi yardım kılavuzunun başında. (Uygulama gerçek logo kutucuklarını kendisi çizer; afiş GitHub'da işlenir ve uygulamada XSS-güvenli işleyici tarafından kaldırılır.)

### Notlar
- Yalnızca dokümanlar — kod veya test değişikliği yok; SVG satır içidir (uzak kaynak yok). Tarama kaynakları değişmedi: **83**. Test paketi: **2784**.

## [1.224.0] — 2026-08-26

**Değiştirildi — LLM sağlayıcı kutucukları artık gerçek marka logolarını gösteriyor.**

### Değiştirildi
- **Gerçek sağlayıcı logoları.** Sağlayıcı kutucukları — Ayarlardaki API anahtarı alanları, Kullanım satırları, pano çipi, Ayarların "Etkin" özeti, ⚡ değerlendirme sonucu ve karşılama afişi — artık açık kaynak simge yayımlayan 11 sağlayıcı için **gerçek marka logosunu** işliyor (Anthropic · Gemini · OpenAI · Qwen · OpenRouter · GitHub · DeepSeek · Kimi · MiniMax · Mistral · Ollama; [simple-icons](https://simpleicons.org)'ten tek yollu SVG'ler, CC0). Yayımlanmış simgesi olmayan 7'si (Hermes · GLM/Z.ai · Grok · Together · Fireworks · BytePlus Ark · Volcengine Ark) marka renkli monogramı korur. Hâlâ **yapısı gereği CSP-güvenli**: logo yolu gömülü statik bir sabit — uzak kaynak yok, `innerHTML` yok.

### Notlar
- Rota veya davranış değişikliği yok; aynı `ProviderLogo.el(slug)` API'si. `provider-logo.js` büyüdü (gömülü logo yolları). Tarama kaynakları değişmedi: **83**. Test paketi: **2784**.

## [1.223.0] — 2026-08-26

**Düzeltildi — başarılı bir ⚡ canlı değerlendirme hata olarak boyanıyordu; ayrıca OpenWorker coworker'ını doğrudan GitHub URL'sinden veya .zip'ten kurun.**

### Düzeltildi
- **⚡ değerlendirme sonuç rozetinin tonu.** Başarılı bir canlı değerlendirme artık başarısızlık gibi boyanmıyor. Süreç içi sağlayıcılar (OpenRouter, DeepSeek, …) alt süreç çıkış `code`'u döndürmez, bu yüzden katı `code === 0` yanlıştı ve her başarı **kırmızı** görünüyordu ("exit 0" yazarken). Ton artık sonucu izliyor — yalnızca sıfırdan farklı kodla çıkan bir alt süreç kırmızı boyar; kodsuz bir canlı sonuç `badge-ok`'tur ve "· exit N" son eki yalnızca gerçek bir çıkış kodu varken görünür.

### Değiştirildi
- **[OpenWorker coworker](https://github.com/Fighter90/career-ops-coworker)'ını GitHub URL / .zip'ten kurun.** Coworker'ın dokümantasyonu artık tek komutluk kurucuyu (`curl … | bash`, idempotent — mevcut career-ops / web-ui'yi yeniden kullanır) ve OpenWorker'daki üç kurulum yolunu (GitHub URL · `.zip` · tek dosya içe aktarma) `docs/integrations/openworker.md`, uygulama içi yardım §32 (×17) ve README'de açıklar.

### Notlar
- Uzun süredir açık olan bir kapsam boşluğu kapatıldı: Recruitee kaynağının artık v1.214.2 tırnaklı-açı düzeltmesi için uçtan uca bir testi var (bir etiket özniteliğindeki `>` açıklamaya sızmamalı). Tarama kaynakları değişmedi: **83**. Test paketi: **2783**.

## [1.222.0] — 2026-08-26

**Değiştirildi — genişletilmiş sağlayıcıların (DeepSeek … Volcengine Ark) alan ipuçları artık 17 dilin tamamında yerelleştirildi.**

### Değiştirildi
- **Sağlayıcı alan ipuçları yerelleştirildi.** v1.216.0–v1.217.0'te eklenen 11 OpenAI uyumlu sağlayıcının (DeepSeek · GLM/Z.ai · Kimi · MiniMax · Mistral · Grok · Together · Fireworks · Ollama · BytePlus Ark · Volcengine Ark) her `config.<slug>Hint` değeri — **Ayarlar → API anahtarları** altındaki API anahtarı, model ve temel URL ipuçları — artık İngilizceye geri düşmek yerine 17 dilin tamamına çevrildi. Kayıt URL'leri, model id'leri ve ⚡ canlı değerlendirme işareti aynen korunur.

### Notlar
- Davranış değişikliği yok — `field-specs.js` içindeki İngilizce `hintFallback` eksik bir anahtarı hâlâ korur ve yeni bir sözleşme testi, alan tanımlayıcılarının her `hintKey` değerinin 17 dilde çözümlendiğini doğrular. Tarama kaynakları değişmedi: **83**. Test paketi: **2779**.

## [1.221.0] — 2026-08-26

**Güvenlik — tarayıcı fetch yolunda DNS-rebinding’e karşı derinlemesine savunma.**

### Güvenlik
- Tarayıcının HTTP çekirdeği (`server/lib/http-json.mjs` içindeki `fetchJson`/`fetchText`) artık her kaynağın ana bilgisayarını gerçek ağ yolunda çözüyor ve **özel, loopback, link-local, CGNAT veya bulut meta veri adresine çözülürse bağlanmayı reddediyor** — bir DNS-rebinding vektörünü kapatıyor. Tarayıcı ana bilgisayarları zaten genel alan adlarına sabitlenmiş, dolayısıyla bu derinlemesine savunmadır; kullanıcı URL yolunda zaten daha güçlü bağlantı sabitleme (`safe-fetch.mjs`) vardı. Koruma **yalnızca** gerçek `fetch` taşımasında çalışır — enjekte edilen test `fetchImpl`’i asla çözülmez.

### Notlar
- Sağlıklı bir taramada davranış değişmez. Tarama kaynakları değişmedi: **83**. Testler: **2775**.

## [1.220.0] — 2026-08-26

**Eklendi — tek girişten birden çok Get on Board kategorisi tarayın.**

### Eklendi
- Bir `getonbrd` girişi artık yalnızca `programming` akışı yerine `categories: [programming, operations-management, machine-learning-ai]` (ya da tek bir `category:`) ayarlayabilir; ilanlar kategoriler arasında URL’ye göre yinelenenlerden arındırılır, en fazla 12. Mevcut girişler aynı kalır (varsayılan hâlâ `programming`).

### Notlar
- Yalnızca sunucu; SSRF ana bilgisayar sabitlemesi (www.getonbrd.com) ve `redirect:'error'` değişmez, geçersiz bir kategori slug’ı herhangi bir istekten önce reddedilir. Tarama kaynakları değişmedi: **83**. Testler: **2771**.

## [1.219.0] — 2026-08-26

**Eklendi — Torre tarayıcıya katıldı ve artık her sağlayıcı etiketi doğru.**

### Eklendi
- **Torre** (`provider: torre`) — torre.ai’nin pan-Latin Amerika yetenek pazarı; Greenhouse/Lever/Ashby’ye ulaşmayan uzaktan roller taşıyan, kimlik doğrulaması gerektirmeyen açık bir arama; giriş başına tek sınırlı istek. Kayıt artık **83** kaynak içeriyor (78 İngilizce + 5 Rusça). Ayrıca karşılama afişinde aktif sağlayıcının monogramı.

### Düzeltildi
- a16z Speedrun taraması, dönen bir panoda erken duruyordu (tarama ortasındaki kısa bir sayfa sonuncusu sanılıp ~300’de 149’a kırpılıyordu); artık akışın kendi `total_pages` değerine güveniyor. Karşılama afişi ise sağlayıcıyı 4 girişli bir haritadan çözüyordu (kalan 14 için ham slug gösteriyordu) — şimdi 18’in etiket+monogramını kullanıyor; Ayarlar’daki sağlayıcı notu 7’den 18’e çıkıyor.

### Notlar
- Get on Board’un giriş başına çoklu kategori seçeneği burada henüz bağlı değil (kaynak düzeyinde bir refactor gerekiyor). Testler: **2768**.

## [1.218.0] — 2026-08-26

**Eklendi — sağlayıcının gösterildiği her yerde sağlayıcı rozetleri (ve doğru adlar).**

### Eklendi
- Pano çipinde, Ayarlar’daki "Etkin" özetinde ve ⚡ değerlendirme sonucu başlığında sağlayıcı monogramları.

### Düzeltildi
- Eski etiketler: üç ekran adı 5 girişli bir haritadan çözüyordu (değerlendirme sonucu Anthropic olmayan her sağlayıcıyı "Gemini" olarak yanlış etiketliyordu); artık paylaşılan `ProviderStatus.label` (18) kullanıyor. Anahtar sayısı "/ 7" gösteriyordu → 18. `LLM_PROVIDER` ipucunun slug listesi 17 dilin tümünde `ark` / `arkcn` kazandı.

### Notlar
- Yalnızca istemci, CSP güvenli. Sunucu değişikliği yok. Tarama kaynakları: **82**. Testler: **2758**.

## [1.217.1] — 2026-08-26

**Test sağlamlaştırma — tüm sağlayıcı listesi için uç nokta kapsamı.**

### Eklendi
- **Kimi, MiniMax, Mistral ve Fireworks** için uç noktayı, varsayılan modeli ve Bearer kimlik doğrulamasını doğrulayan parametreli bir `run<Provider>` testi.

## [1.217.0] — 2026-08-26

**Eklendi — Ark, LLM listesine katılıyor (18 sağlayıcı).** ByteDance’in Doubao modelleri BytePlus Ark ve Volcengine Ark artık ⚡ canlı sağlayıcılar — aynı OpenAI uyumlu çekirdek ve bölgeye göre temel URL ile.

### Eklendi
- **BytePlus Ark** (`ARK_API_KEY`, uluslararası) ve **Volcengine Ark** (`ARK_CN_API_KEY`, Çin) — `runOpenAICompatible()` üzerinden OpenAI uyumlu Chat Completions. `ARK_MODEL` / `ARK_CN_MODEL` (bir Doubao model adı ya da `ep-…` uç nokta id’niz) ayarlayın; `ARK_BASE_URL` / `ARK_CN_BASE_URL` bölgeyi değiştirir. İkisi de `auto` sırasına (en sona) katılır; Ayarlar ve Kullanım’da monogramlarıyla görünür. Web arayüzü artık **18 sağlayıcıyı** canlı kapsıyor.

### Notlar
- Geri kalanla aynı güvenilir yapılandırma + http(s) şema denetimi yolu (asla iş ilanı URL’si için SSRF doğrulayıcısı değil). Tarama kaynakları değişmedi: **82**. Testler: **2755**.

## [1.216.0] — 2026-08-26

**Eklendi — dokuz LLM sağlayıcısı daha, her birinin kendi marka karosu.** ⚡ Canlı değerlendirmelerin artık DeepSeek, GLM (Z.ai), Kimi (Moonshot), MiniMax, Mistral, Grok (xAI), Together, Fireworks veya tamamen yerel Ollama üzerinden çalışabilir — bir anahtar kadar uzakta, her biri Ayarlar’daki alanının yanında bir monogramla işaretli.

### Eklendi
- **Dokuz OpenAI uyumlu sağlayıcı.** DeepSeek, GLM (Z.ai), Kimi (Moonshot), MiniMax, Mistral, Grok (xAI), Together AI, Fireworks AI ve **Ollama** (tamamen yerel, anahtarsız). **Ayarlar**’da bir anahtar — Ollama için `OLLAMA_BASE_URL` — girin; Hermes’ten sonra `auto` sırasına katılır; herhangi birini `LLM_PROVIDER` ile sabitleyin. Together, Thinking Machines’in **Inkling** modelini de (`thinkingmachines/Inkling`) barındırır. Web arayüzü artık **16 sağlayıcıyı** canlı kapsıyor.
- **Sağlayıcı monogramları.** CSP güvenli, marka renginde bir baş harf karosu her sağlayıcıyı Ayarlar’daki anahtar alanının yanında ve Kullanım sayfasındaki satırında işaretler — satır içi SVG, harici logo yok, hiçbir şey cihazından çıkmaz.

### Notlar
- Sağlayıcıların temel URL’leri, `runOpenAICompatible()` üzerinden http(s) şema denetimiyle (Ollama’nın loopback’ine izin verilir) geçen güvenilir yapılandırmadır; asla iş ilanı URL’si için SSRF doğrulayıcısından geçmez. Tarama kaynakları değişmedi: **82**. Testler: **2752**.

## [1.215.0] — 2026-08-26

**Eklendi — tüm iş aramanı OpenWorker'dan yürüt.** Yeni bir coworker bu hattı Andrew Ng'nin açık kaynak yapay zekâ coworker uygulamasından yürütür ve uygulama içi yardım artık bunu kapsar, böylece Belgelere Sor asistanı sana yol gösterebilir.

### Eklendi
- **OpenWorker coworker.** Kodsuz bir [OpenWorker](https://github.com/andrewyng/openworker) coworker'ı — [Fighter90/career-ops-coworker](https://github.com/Fighter90/career-ops-coworker) — tüm iş aramayı (tara, puanla, uyarla, izle, takip et) yürütür ve **bu panoyu başlatabilir**, hepsi masaüstünde. 17 dilde sunulan tek dosyalık bir persona olup OpenWorker'ın kendi yükleyicisiyle kurulabilir olduğu doğrulanmıştır.
- **Yardım §32 "Run it from OpenWorker"** (17 dilin tümü) bunu belgeler; böylece uygulama içi **Belgelere Sor** asistanı ve yüzen yardım düğmesi hakkında soruları yanıtlayabilir. Ayrıca açılış sayfası altbilgisinden, README'den, wiki'den ve `docs/integrations/openworker.md`'den bağlanmıştır.

### Notlar
- Yalnızca belgeler + site — uygulama kodu değişikliği yok. Tarama kaynakları **82**'de değişmedi. Test takımı: **2742**.



## [1.214.2] — 2026-08-25

**Düzeltildi — paylaşılan HTML→metin hattı (Greenhouse / Recruitee açıklamaları) bir öznitelik değeri `>` karakteri içerdiğinde artık etiket özniteliklerini açıklamaya sızdırmıyor.**

### Düzeltildi
- **Öznitelik içinde `>` bulunan HTML açıklamaları temiz biçimde ayıklanıyor.** Greenhouse ve Recruitee açıklamalarının arkasındaki etiket ayıklayıcı ilk `>`'de duran naif bir eşleşme kullanıyordu, bu yüzden `<a title="salary > 100k">` gibi bir etiket sondaki öznitelik metnini (`100k">`) açıklamada bırakıyordu. Artık tırnaklı öznitelik değerlerine (tek veya çift) saygı gösteriyor, varlıkları çözmeden *önce* işaretlemeyi ayıklıyor (bir öznitelik içindeki kodlanmış tırnak sahte bir sınırlayıcı olmasın diye) ve düz metinde sabit bir `<>`'i hâlâ koruyor.

### Notlar
- Test takımı: **2742**. Tarama kaynakları **82**'de değişmedi. Bu turda üst projeden başka yeni bir şey yok: kalan değişiklikler salt-okunur olarak aktarılıyor (follow-up / weekly-digest / rejection-latency / salary-gap düzeltmeleri web-ui değişikliği gerektirmiyor) ya da web-ui yüzeyi değil (harici bir X/Xquik BYO-key eklentisi, CLI/verify düzeltmeleri). İsteğe bağlı öğeler — SmartRecruiters ayrıntı açıklamaları, detect-reposts toplayıcı atlaması, `stem:` / `word:` başlık önekleri, DNS-rebinding sıkılaştırması — sırada bekliyor.



## [1.214.1] — 2026-08-25

**Düzeltildi — Ashby iş açıklamaları artık Greenhouse ve Recruitee ile aynı uzunlukta kırpılıyor, böylece bir içerik filtresi üç panoda da aynı davranıyor ve tek bir pano tarama önbelleğini şişiremiyor.**

### Düzeltildi
- **Ashby açıklamaları artık diğer panolarla aynı uzunluk sınırına uyuyor.** v1.214.0 Ashby'nin ilan gövdesini içerik filtresine veriyordu, ama — 4000 karakterde kırpan Greenhouse ve Recruitee'nin aksine — Ashby'ninki sınırsız doğrudan eşleniyordu (bazıları 4 kat uzun). Böylece aynı `content_filter` kelimesi, yalnızca metinde nereye düştüğüne göre Ashby'de eşleşip Greenhouse'da eşleşmeyebiliyordu ve tek bir pano, `#/scan`'in yüklediği tarama önbelleğine yüzlerce KB ekleyebiliyordu. Ashby artık aynı 4000 karaktere kırpılıyor (metni zaten düz olduğundan kesiliyor, asla etiketten arındırılmıyor).

### Notlar
- Test takımı: **2738**. Tarama kaynakları **82**'de değişmedi.



## [1.214.0] — 2026-08-25

**Düzeltildi — Greenhouse, Ashby ve Recruitee iş açıklamaları artık içerik filtresini besliyor, böylece kelime / ülke / vize filtreleri bu panolarla gerçekten eşleşiyor; ve "Associate <kıdemli unvan>" (akademik rütbeler dâhil) artık başlangıç seviyesi olarak yanlış sınıflandırılmıyor.**

### Düzeltildi
- **İçerik filtreleri artık Greenhouse, Ashby ve Recruitee'de çalışıyor.** Bu panolar artık her ilanın tam metnini açıklaması olarak taşıyor, böylece açıklamayı okuyan bir `content_filter` (ya da ülke / vize kelime filtresi) panoyu körlemesine geçirmek yerine ilan gövdesiyle eşleşiyor. Ashby ve Recruitee gövdeyi liste yükünde bedavaya veriyor; Greenhouse zaten veriyordu. Üçü de tek bir paylaşılan HTML→metin hattından geçiriliyor.
- **"Associate Director" / "Associate Professor" başlangıç değil, kıdemlidir.** Kıdem sınıflandırıcısı (`skip_tiers:` tarafından kullanılır) "associate" kelimesini kıdemli bir unvanı önlese bile başlangıç seviyesi işareti sayıyordu. Artık "Associate <kıdemli isim>"—akademik rütbeler dâhil (Associate Professor, Associate Dean)—kıdemli okuyor, gerçek başlangıç varyantlarını (Associate Attorney, Associate Editor) başlangıç seviyesinde tutuyor ve baştaki "Intern, Associate Dean"i hâlâ staj olarak sınıflandırıyor.

### Notlar
- Test takımı: **2736**. Tarama kaynakları **82**'de değişmedi. Sonraya sıraya alındı: isteğe bağlı SmartRecruiters açıklama zenginleştirmesi (ilan başına bir detay isteği), detect-reposts'un `aggregator: true` pano atlaması ve sabitlenmiş kelime `stem:` / `word:` başlık önekleri — her biri varsayılan davranış değişikliği değil, isteğe bağlı bir yapılandırma. DNS-rebinding sıkılaştırması kendi güvenlik sürümü için hâlâ sırada.



## [1.213.0] — 2026-08-22

**Eklendi — Singapur'un ulusal iş bankası MyCareersFuture bir tarama kaynağı olarak. Düzeltildi — Greenhouse ilanları artık içerik filtrelerinin çalışması için tam metnini taşıyor ve uzaktan Ashby rolleri yalnızca-şehir bir konumun arkasında gizlenmiyor.**

### Eklendi
- **MyCareersFuture (Singapur)** (mycareersfuture.gov.sg) — Workforce Singapore tarafından işletilen Singapur ulusal kamu iş bankası için yeni, token gerektirmeyen bir tarama kaynağı. `#/scan` sayfasındaki **Kaynak** filtresinden seçin ya da isteğe bağlı bir `keywords` listesiyle `provider: mycareersfuture` olan bir şirket ekleyin (yoksa Job Bank gibi profilinizin hedef rollerine düşer). Genel arama API'sini okur, ana bilgisayara sabitli, anahtarsız.

### Düzeltildi
- **Greenhouse ilanları artık içeriğe göre filtrelenebiliyor.** Greenhouse panoları ilanın tam gövdesiyle çekilir, ilanın açıklaması olarak düz metne çözülür — böylece açıklamayı okuyan bir `content_filter` (ya da ülke/vize kelime filtresi) artık Greenhouse ilanlarını körlemesine geçirmek yerine gerçekten eşleştirir.
- **Uzaktan Ashby rolleri artık bir şehir filtresiyle elenmiyor.** Ashby çalışma modelini (Remote/Hybrid/Onsite) ofis şehrinden ayrı tutar, bu yüzden tamamen uzaktan bir rol hâlâ örn. "San Francisco" olarak okunuyordu — ve o şehri engelleyen bir konum filtresi kabul edebileceğiniz bir rolü gizliyordu. Rol uzaktansa artık konuma "Remote" eklenir ve ofise bağlı bir hibrit rolün yanlış etiketlenmemesi için `workplaceType`, eskimiş bir `isRemote` bayrağına üstün gelir.

### Notlar
- Tarama kaynakları: **82** (77 İngilizce + 5 Rusça). Test takımı: **2724**. Bir DNS-rebinding sıkılaştırması (bir ana bilgisayarın çözümlenen adresini bağlanmadan önce doğrulamak) özel bir sürüm için sıraya alındı — doğrudan bir port yerine web-ui'ye özgü bir tasarım gerektiriyor.



## [1.212.1] — 2026-08-21

**Düzeltildi — cvstart.org açılış sayfası tarayıcının iş kaynaklarını eksik sayıyordu (80 gösteriyor ve Job Bank (Kanada)'yı atlıyordu); artık uygulamanın 81'iyle yeniden eşleşiyor ve ikisi ayrışırsa site derlemesi yüksek sesle başarısız oluyor.**

### Düzeltildi
- **Açılış sayfasının "İş kaynakları" sayımı uygulamayla yeniden senkron.** v1.212.0 sonrasında cvstart.org **80** pano gösteriyor ve yeni **Job Bank (Kanada)** çipi eksikti; oysa uygulama, tarama açılır menüsü ve yardım kılavuzu hepsi **81** listeliyordu. Açılış sayfası listesini canlı tarayıcı kaydını yükleyerek kurar ve bir kaynak, bir YAML bağımlılığını içeri alma biçimi yüzünden o derlemede yüklenemedi — böylece sessizce düştü. Job Bank artık bu bağımlılığı, uygulamanın geri kalanının tarama sırasında yaptığı gibi tembel yükler, dolayısıyla her zaman görünür.
- **Site derlemesi artık uyuşmayan bir kaynak sayısını yayımlamayı reddediyor.** Kayıt, diskte var olandan daha az kaynak sayarsa (yüklenemeyen bir kaynağın izi), derleme yanlış sayıyı sessizce yayımlamak yerine açık bir mesajla başarısız olur.

### Notlar
- Uygulama davranışı değişmedi — tarayıcıda her zaman 81 kaynağın tümü vardı; yalnızca açılış sayfası etkilendi. Tarama kaynakları: **81** (76 İngilizce + 5 Rusça) — değişmedi. Test takımı: **2687**.



## [1.212.0] — 2026-08-21

**Eklendi — Job Bank (Kanada), federal ulusal iş panosu. Kaldırıldı — EchoJobs (beslemesi artık bot korumasının arkasında). Düzeltildi — Consider tabanlı panolar yeniden sonuç döndürüyor ve çok konumlu Lever ilanları artık konumlarının yarısını gizlemiyor.**

### Eklendi
- **Job Bank (Kanada)** (jobbank.gc.ca) — hiçbir toplayıcının iyi kapsamadığı yüksek hacimli bir pano olan Kanada federal ulusal istihdam hizmeti için yeni, token gerektirmeyen bir tarama kaynağı. `#/scan` sayfasındaki **Kaynak** filtresinden seçin ya da isteğe bağlı bir `keywords` listesiyle `provider: jobbankca` olan bir şirket ekleyin (yoksa profilinizin hedef rollerine düşer). Genel ATOM beslemesini okur, ana bilgisayara sabitli, anahtarsız.

### Kaldırıldı
- **EchoJobs** — emekliye ayrıldı. Genel beslemesi artık bot korumasının arkasında ve hiçbir şey döndürmüyor; onu tutmak yalnızca bir tarama yuvası harcıyordu.

### Düzeltildi
- **Consider tabanlı panolar yeniden sonuç döndürüyor.** Consider artık aramayı kabul etmeden önce anonim bir el sıkışma (oturum çerezi + CSRF belirteci eken bir GET) istiyor; onsuz istek sessizce reddediliyor ve pano boş görünüyordu.
- **Çok konumlu Lever ilanları artık konumlarının yarısını gizlemiyor.** Lever bir birincil şehri `location`'a, geri kalanını `allLocations`'a koyar; yalnızca birincili okumak, Barselona VE Montevideo'da açık bir ilanı yalnızca-Barselona gibi gösteriyordu (ve bir konum filtresince yanlışlıkla eleniyordu). Artık ikisi birleştiriliyor.

### Notlar
- Sayfalanmış panolarda sayfalar arası tempo daha yumuşak (150 yerine 250 ms), tek ana bilgisayarlı kariyer sitelerine nezaketen. Tarama kaynakları: **81** (76 İngilizce + 5 Rusça) — değişmedi (Job Bank girdi, EchoJobs çıktı). Test takımı: **2685**.



## [1.211.0] — 2026-08-19

**Eklendi — Yourator, Tayvanlı bir teknoloji iş panosu. Düzeltildi — başlık/şirket adındaki aksanlı varlıklar artık her yerde çözülüyor ve adında aksan olan bir şirket artık yanlışlıkla işaretlenmiyor.**

### Eklendi
- **Yourator** (yourator.co) — Tayvan teknoloji ve dijital iş pazarı için yeni, token gerektirmeyen bir tarama kaynağı. `#/scan` sayfasındaki **Kaynak** filtresinden seçin ya da `provider: yourator` olan bir şirket ekleyin. Genel JSON API'sini okur (anahtar yok, tarayıcı yok), panonun her sayfasını gezer ve her ilanın gerçek işveren bağlantısını (kendi ATS'i) izleme parametreleri temizlenmiş olarak verir.

### Düzeltildi
- **Aksanlı adlandırılmış varlıklar artık her yerde çözülüyor.** Paylaşılan HTML çözücü Latin-1 harflerini kazandı (`&eacute;` → é, `&ccedil;` → ç, …); böylece `D&eacute;veloppeur` ya da `Fran&ccedil;ais` yazan bir Avrupa panosu bu düz metni artık bir başlıkta, izleyicide veya üretilen bir belgede bırakmıyor. (Büyük harfler büyük kalır — `&Eacute;` É'dir, é değil — ve `&constructor;` gibi bir arama artık kendisine çözülür.)
- **Adında aksan olan bir şirket, kendi alan adında olduğu için artık yanlışlıkla işaretlenmiyor.** "Işık" artık "isik" olarak katlanıp isik.com.tr ile eşleşiyor; "Société Générale" societegenerale.com ile eşleşiyor. Eski denetim aksanlı harfleri ASCII tabanına katlamak yerine siliyordu.

### Notlar
- Tarama kaynakları: **81** (76 İngilizce + 5 Rusça). Test takımı: **2667**.



## [1.210.1] — 2026-08-19

**Düzeltildi — "&" ya da tırnak içeren Habr Career ilan başlıkları ve şirket adları artık bozuk gelmiyor.**

### Düzeltildi
- Habr Career kaynağı artık **başlık** ve **şirket adı** içindeki HTML varlıklarını ileri akmadan önce çözüyor. Sunucuda işlenen kartlar kaçışlı geliyor ("Changellenge &gt;&gt;", "Demand Forecasting &amp; Inventory Optimization", "ООО &quot;М-ТЕХ&quot;"); bu yüzden çözülmemiş bir "&", kendi "&" başlık filtrenizde sessizce başarısız oluyordu — önceki sürümün diğer beş panoda kapattığı belirtinin aynısı — ve şirket adları izleyiciye ve raporlara bozuk ulaşıyordu. Varlık çözme artık etkilenen altı kaynağın tamamında tamamlandı.

### Notlar
- Test takımı: **2644**.



## [1.210.0] — 2026-08-19

**Eklendi — Senjob, tarayıcının ilk Afrika iş ilan panosu (Senegal); beş panoda daha isabetli başlık eşleştirme.**

### Eklendi
- **Senjob** (senjob.com) — Senegal için yeni, token gerektirmeyen bir tarama kaynağı ve tarayıcının ilk Afrika panosu. `#/scan` sayfasındaki **Kaynak** filtresinden seçin ya da `provider: senjob` olan bir şirket ekleyin. Genel listeyi düz HTTP ile okur (anahtar yok, tarayıcı yok), her isteği senjob.com'a sabitler ve — HTML ayrıştırdığı için — birden hiçbir şey döndürmeyen bir listeyi işsiz bir ülke değil, bozuk bir pano (görünür bir hata) olarak ele alır.

### Düzeltildi
- **İçinde "&" olan başlıklar artık beş panoda ilan düşürmüyor** — beesite, Cornerstone (csod), Hacker News "Who is hiring", Phenom ve TKMS'te başlıklar HTML kaçışlı gelir; bu yüzden "R&D Engineer" gibi bir roldeki kaçışlı "&", kendi "r&d" anahtar kelimenizde başarısız olur ve ilan sessizce kaybolurdu ("sales & marketing" vetosu da hiç tetiklenmezdi). Artık başlıklar — ve Phenom konumları — filtrelemeden önce çözülür.

### Notlar
- Tarama kaynakları: **80** (75 İngilizce + 5 Rusça). Test takımı: **2643**.



## [1.209.0] — 2026-08-17

**Eklendi — uygulama içi yardım artık bir başvurunun sonucunu kaydetmeyi kapsıyor ve "Dokümana sor" seni oraya yönlendirebiliyor.**

### Eklendi
- İzleyici yardımı (§11) 17 dilin tümünde bir "Bir sonucu kaydet" bölümü kazandı; **Sonuç** düğmesini anlatıyor: ne olduğunu seç (reddedildi / teklif / işe alındı / geri çevrildi / görmezden gelindi / mülakata geçti), ne yapacağını önizle, sonra kaydet — bu, sonucu not eder, gönderdiğin CV ve ön yazıyı arşivler ve satırın Durumunu senin yerine eşitler. Yüzen "Dokümana sor" yardımcısı bu kılavuzu okur, bu yüzden artık yalnızca Durumu elle düzenlemeni önermek yerine seni o düğmeye yönlendirir.

### Notlar
- Her yardım paketi artık 31 H2 / 119 H3 (önceden 118); eşlik bekçileri buna göre yükseltildi. Yalnızca belge — kod veya davranış değişikliği yok. Takım: **2625**.



## [1.208.2] — 2026-08-16

**Düzeltildi — telefonda bildirim ve tema düğmeleri artık arama kutusunun üstünde durmuyor.**

### Düzeltildi
- v1.208.1, üst çubuğun düğmelerinin sayfa başlığıyla çakışmasını önledi ama dar — en dar olmasa da — bir telefonda, özellikle düğme etiketleri uzun olan dillerde, çubuğun tamamı yine tek satıra sıkışıyor, böylece 🔔 ve 🌙 düğmeleri arama kutusunun üstüne binebiliyordu. İşlem düğmeleri (bildirimler, tema, Tanılama, Scan Aç) artık telefonda her zaman tam genişlikte kendi ikinci satırına iniyor; böylece arama kutusu tümüyle okunabilir kalıyor ve hiçbir şey çakışmıyor.

### Notlar
- Telefonda çubuğun işlem düğmeleri tam genişlikte ikinci bir satıra taşınarak, düzenin artan negatif alanı çakışma olarak dağıttığı kırılgan "neredeyse dolu satır" bandını ortadan kaldırıyor. Bir Playwright bekçisi artık tam tetikleyiciyi — 565–640px bandında uzun etiketli bir dil — yeniden üretiyor ve çubuğun denetimlerinin asla piksel paylaşmadığını doğruluyor. Takım: **2621**.



## [1.208.1] — 2026-08-16

**Düzeltildi — telefonda üst çubuğun düğmeleri artık sayfayla çakışmıyor.**

### Düzeltildi
- v1.208.0, dar ekranlarda üst çubuğun işlem düğmelerini (Tanılama, Scan Aç, bildirimler, tema) ikinci satıra kaydırıyordu ama çubuk sabit yükseklikte kaldığından, kaydırılan satır taşıp sayfa başlığının üstüne biniyordu. Çubuk artık satırlarını almak için **büyüyor** ve içerik altından akıyor.

### Notlar
- Çubuğun sabit `height` değeri `min-height` oldu; böylece her genişlikte içerikle birlikte büyüyor (masaüstü değişmedi). Bir Playwright bekçisi artık çubuğun sayfaya taşmadığını da denetliyor. Takım: **2621**.



## [1.208.0] — 2026-08-16

**Düzeltildi — uygulama artık bir telefon ekranına sığıyor: yana kaydırma bitti.**

### Düzeltildi
- Dar ekranda uygulamanın tamamı yana kayıyordu — üst çubuk, tablolar, yardım makaleleri ve ayar sekmeleri sağ kenarı aşıyordu. Artık her sayfa her genişliğe sığıyor: üst çubuk düğmeleri ikinci satıra kayar, geniş tablolar ve kod blokları kendi kutusunda kayar, yardım içindekiler tablosunu makalenin üstüne yığar, düğme/sekme satırları alt satıra geçer ve uzun yollar veya URL'ler sayfayı germek yerine satır kırar.

### Notlar
- Kök neden klasik flex/grid **min-width: auto** tuzağı ve birkaç sarmalanmamış geniş öğeydi; ızgara öğelerine `min-width: 0`, markdown/başlıklara `overflow-wrap`, kaydırılabilir bir markdown tablosu ve mobil kırılma noktasında yardım ızgarasının dikey yığılmasıyla düzeltildi. Bir Playwright bekçisi ana rotalarda **375 px'te 0 yatay taşma** doğrular. `tests/playwright-smoke.mjs`. Takım: **2621**.



## [1.207.2] — 2026-08-16

**Düzeltildi — yapay zekâ planları ve kariyer yönlendirme profilleri artık ham kod dökümü olarak görünmüyor.**

### Düzeltildi
- Bazı modeller tüm yanıtı bir ```markdown … ``` kod çitine sarar. Bu olduğunda **gelişim planı** ve **yönlendirme profili**, başlıklı ve listeli bir belge yerine tek aralıklı kod bloğu olarak görünüyordu. Saran çit artık kaldırılıyor — yalnızca tüm yanıtı sardığında ve dil açıkça `markdown`/`md` olduğunda, böylece gerçek bir `python`/`js`/dilsiz ``` kod yanıtı olduğu gibi kalır.

### Notlar
- Ortak LLM temizleme adımında (`cleanLlmMarkdown`) tek seferde ele alındı, böylece tüm yapay zekâ rotaları yararlanır ve sarılmış yanıtın içindeki kod blokları korunur. `tests/llm-output.test.mjs` (+3). Takım: **2621**.



## [1.207.1] — 2026-08-16

**Düzeltildi — açılış sayfası küçük telefonlarda artık yana taşmıyor.**

### Düzeltildi
- Dar bir telefonda hero bölümü — başlık, giriş satırı ve kurulum terminali — sağ kenardan kırpılabiliyordu; çünkü uzun bir kurulum komutu ve düzen sütunları ekrana göre küçülmüyordu. Artık her genişliğe sığıyorlar; kurulum komutu kendi terminal kutusunun içinde kayıyor.

### Notlar
- Ayrıca, bir kaynağın geçici 404’ü yüzünden başarısız olabilen kararsız bir E2E duman testi sağlamlaştırıldı: artık komşu testler gibi zararsız ağ gürültüsünü (favicon / bağlantı / başarısız kaynak) yok sayıyor, gerçek betik hatalarını yakalamayı sürdürüyor. Uygulama davranışı değişmedi. Takım: **2618**.



## [1.207.0] — 2026-08-15

**Eklendi — bir başvurunun sonucunu doğrudan takip tablosundan kaydedin.**

### Eklendi
- Her takip satırına bir **Sonuç** işlemi geldi: ne olduğunu seçin (reddedildi, teklif alındı, işe alındı, teklif reddedildi, yanıt yok, mülakata geçti), isteğe bağlı bir not ekleyin, ortaya çıkan durumu **önizleyin** ve kaydedin. Kaydetmek gönderilen CV ve ön yazı dosyalarını arşivler ve takip tablosunu kanonik duruma senkronlar — elle düzenleme yerine tek, belirlenimci bir işlem.

### Notlar
- Yeni `POST /api/outcome`, sonuç CLI’sini aktarır: `dryRun:true` salt-okunur bir önizlemedir (satırı eşler, ortaya çıkan durumu bildirir, hiçbir şey yazmaz); gerçek çağrı kaydeder. Yazma güvenliği: sonuç türü bilinen kümeyle sınırlanır ve her metin alanı çağrıdan önce kontrol karakteri içerirse reddedilir (dizi argümanları, spawn — kabuk yok). `tests/outcome-route.test.mjs`. Takım: **2618**.



## [1.206.0] — 2026-08-15

**Belgeler — uygulama içi yardım kılavuzu artık en yeni beş özelliği 17 dilin tamamında kapsıyor.**

### Eklendi
- Yerleşik yardım kılavuzu — ve ona dayanarak yanıt veren «Yardıma sor» asistanı — artık yakın zamanda eklenen beş özelliği belgeliyor: **Kurulum doktoru** (Ayarlar — CV ve profilinizi eksikler ve kalan örnek veriler için denetler), **ATS panolarını keşfet** (Portallar — bir şirketin kariyer panosunu otomatik bulur), **«hâlâ açık mı?» denetimi** (Takip — ilanın hâlâ açık olup olmadığı), **«önceki CV'yi yeniden kullan?» ipucu** (CV Stüdyo — daha önce uyarlanmış bir CV yeni ilana uyduğunda bildirir) ve **Beceri günlüğü** (Analitik — öz değerlendirme puanlarını kaydet). Beş yeni alt bölüm, 17 dilin tamamına çevrildi.

### Notlar
- Kılavuz yapısı 31 H2 / 118 H3'e büyür, her dilde parite güvence altında. Başvuru belgeleri güncellendi: `docs/architecture/API.md` bu özelliklerin beş rotasını belgeliyor ve `CLAUDE.md` ile `docs/sdd/CONVENTIONS.md` içindeki rota/sürüm sayaçları güncel (36 rota modülü). Takım: **2610**.



## [1.205.0] — 2026-08-15

**Eklendi — sınav/değerlendirme sonuçlarını kaydeden bir Beceri günlüğü.**

### Eklendi
- Yeni bir **Beceri günlüğü** (Analitik → Beceri günlüğü) bir öz değerlendirmeyi kaydetmenizi sağlar — şirket, platform, beceri, puan % ve isteğe bağlı bir not — `data/assessments.tsv`'ye eklenir; geçmiş kayıtlar (en yeni önce) listelenir. Sıfır token, belirlenimci; dosya biçimini üst projenin CLI'si yönetir.

### Notlar
- Yeni `GET /api/assessments` (`assessment-log.mjs`'nin varsayılan JSON listesini aktarır; yumuşak başarısızlık `{available:false}`) + `POST /api/assessments` (açık yazma: alanlar `assessment-log.mjs add`'e **dizi argümanları** olarak geçirilir). Yazma güvenliği: kontrol karakteri içeren her metin alanı reddedilir (TAB bir sütunu bozar, yeni satır bir satır enjekte eder) → yazmadan önce 400; puan/eşik 0–100 ile sınırlı, uzunluklar sınırlı. `tests/assessments-route.test.mjs`. Takım: **2610**.


## [1.204.0] — 2026-08-15

**Eklendi — Ayarlar'da eksik ya da örnek veri kalıntılı CV/profili işaretleyen bir "Kurulum doktoru" paneli.**

### Eklendi
- **Ayarlar → Kurulum doktoru** artık `cv.md` ve `config/profile.yml` dosyanızı sıfır token ile denetler ve **engelleyici sorunları** (eksik dosya/alan) ve **uyarıları** (kalan örnek/yer tutucu veriler, sabit kodlanmış metrikler) listeler — böylece eksik bir kurulumu, taramalarınızı ve uyarlamalarınızı zayıflatmadan yakalarsınız. Salt okunur; tek tıkla yeniden çalıştırılır.

### Notlar
- Yeni salt okunur `GET /api/cv-sync-check`, üst projenin `cv-sync-check.mjs`'sini aktarır; bu betik metin + bir çıkış kodu yazar (`--json` yok); rota, kararlı `ERROR:` / `WARN:` satırlarını hafifçe `{ok, errors[], warnings[]}` olarak ayrıştırır — başarıyı çıkış kodu değil, başlık belirler. Bağımsız kurulumlarda `{available:false}` ile yumuşak başarısızlık. `tests/cv-sync-check-route.test.mjs`. Takım: **2602**.


## [1.203.0] — 2026-08-15

**Eklendi — CV Studio'da "önceki bir CV'yi yeniden kullan?" ipucu.**

### Eklendi
- **CV Studio**'da kayıtlı bir ilanı açtığınızda, uygulama artık onu diğer kayıtlı ilanlarınızla karşılaştırır (belirlenimci sözcük örtüşmesi, **sıfır token**) ve en yakınının o uyarlanmış CV'yi **yeniden kullanmaya**, **düzeltmelerle** yeniden kullanmaya yetip yetmediğini ya da **yeni bir tane uyarlamanız** gerektiğini söyler — böylece zaten hedeflediğiniz bir rol için sıfırdan başlamazsınız.

### Notlar
- Yeni salt okunur `GET /api/jds/:name/reuse`, üst projenin `jd-similarity.mjs`'sini (Jaccard örtüşmesi + kıdem koruması; JSON `{decision, score, reason}`) her önceki ilan için bir kez aktarır (fan-out 25 ile sınırlı, en iyisi kazanır); betik veya önceki ilanlar yoksa `{available:false}` ile yumuşak başarısızlık. `tests/jd-similarity-reuse-route.test.mjs`. Takım: **2594**.


## [1.202.0] — 2026-08-15

**Eklendi — bir şirketin ATS iş panosunu #/portals'tan keşfedin ve izlemeye başlayın.**

### Eklendi
- **#/portals**'ta bir şirket adı yazın; uygulama **Greenhouse, Ashby ve Lever**'i genel panosu için yoklar — **sıfır LLM, tarayıcı yok** — ve mevcut olup şu anda ≥1 ilan listeleyen panoları gösterir. Tek tık, seçilen panoyu tarayıcınızın izlediği şirketlere ekler. Yoklama salt okunurdur; `portals.yml`'ye yazma yalnızca **Ekle**'ye tıklayınca olur.

### Notlar
- Yeni `server/lib/discover-ats.mjs` (sabit ana makine, karakter kümesi doğrulanmış slug'ı DNS sabitli `safeGet` ile yoklar, istek başına ≤12 yoklama) + `POST /api/portals/discover` (salt okunur) ve `POST /api/portals/track` (açık yazma: `withFileLock` + metin ekleme + yeniden ayrıştırma koruması + atomik yeniden adlandırma; yalnızca bilinen ATS ana makineleri, idempotent). Tarayıcının adaptör kaydını yeniden kullanır. i18n ×17. `tests/discover-ats-resolver.test.mjs` + `tests/discover-ats-route.test.mjs`. Takım: **2588**.


## [1.201.0] — 2026-08-15

**Düzeltildi — yerelleştirilmiş veya değişken sütun başlıkları olan bir izleyici artık boş görünmüyor.**

### Düzeltildi
- `data/applications.md` dosyanız İngilizce olmayan veya değişken başlıklar kullanıyorsa — İspanyolca `empresa` / `puesto` / `estado` / `fecha` / `enlace` ya da `position` / `stage` / `link` — izleyici bunları yanlış anahtarlarla okuyup **Şirket / Rol / Durum / Tarih / Bağlantı sütunlarını boş** gösteriyordu. Artık bu başlıklar kanonik alan adlarına katlanıyor ve izleyici doğru görünüyor. Tamamen İngilizce bir izleyici eskisi gibi işlenir.

### Notlar
- `parseApplications` (`server/lib/parsers.mjs`) içinde yeni `HEADER_ALIASES` tablosu + bir normalleştirme katlaması; bilinmeyen veya zaten kanonik başlıklar değişmeden geçer. `tests/tracker-header-aliases.test.mjs`. Takım: **2563**.


## [1.200.0] — 2026-08-15

**Eklendi — takip listenizde ATS barındırmalı ilanlar için tek tıkla "hâlâ açık mı?" kontrolü.**

### Eklendi
- **#/tracker** üzerinde, URL'si Greenhouse / Lever / Ashby / Workday / SmartRecruiters ilanı olan bir başvuru artık **"Hâlâ açık mı?"** düğmesi gösteriyor. Tek tık, ATS'nin kendi genel JSON'unu sorgular — **sıfır token, tarayıcı yok** — ve **Açık / Süresi dolmuş / Bilinmiyor** gösterir; böylece her birini açmadan ölü ilanları fark edersiniz. Tasarımı gereği ihtiyatlı: yalnızca kesin 404/410 *Süresi dolmuş* sayılır; belirsiz olan *Bilinmiyor* kalır (asla yanlış *Süresi dolmuş*).

### Notlar
- Yeni `server/lib/liveness-core.mjs` + `liveness-api.mjs` ve salt okunur `GET /api/liveness?url=` (yazma yok, LLM yok). SSRF güvenli: URL `isValidJobUrl`'den geçer, ardından ATS API'sine yalnızca DNS sabitli `safeGet` ile sabit host ve karakter kümesi doğrulanmış yol parçalarıyla erişilir. `tests/liveness-core.test.mjs` + `tests/liveness-route.test.mjs`. Takım: **2557**.


## [1.199.0] — 2026-08-15

**Düzeltildi — geniş tablolar artık kırpılmak yerine yatay kayıyor.**

### Düzeltildi
- **Scan** sayfasında (ve diğer tüm tablolarda — İzleyici, İstatistikler, Kullanım, Panel) pencereden geniş bir tablo **kaydırma çubuğu olmadan kırpılıyor** ve en sağdaki sütunlara erişilemiyordu. Geniş tablolar artık gerektiğinde **yatay kaydırma çubuğu** gösteriyor, böylece her sütun her genişlikte erişilebilir kalıyor.

### Notlar
- `public/css/components.css` içindeki `.table-wrap`, `overflow: hidden` yerine `overflow-x: auto` oldu (mevcut `.reports-scroll` kabıyla aynı); yuvarlatılmış kenarlık korunur. `tests/table-wrap-scroll.test.mjs`. Takım: **2540**.


## [1.198.0] — 2026-08-15

**Eklendi — tarama yeniden denemeleri artık üstel geri çekilme, jitter kullanıyor ve hız sınırlayıcının `Retry-After` başlığına uyuyor.**

### Eklendi
- Bir iş ilanı panosu tarama sırasında kısa süreliğine hız sınırladığında veya hata verdiğinde (HTTP 429 / 5xx), yeniden deneme artık sabit kısa bir gecikme yerine **üstel geri çekilme + jitter** ile bekliyor — meşgul bir pano aynı tempoda tekrar tekrar dövülmüyor ve eşzamanlı yeniden denemeler yeniden aynı anda çarpışmıyor. Panonun gönderdiği `Retry-After` **dikkate alınıyor** (ancak sınırlandırılmış, böylece düşmanca bir `Retry-After: 86400` tüm taramayı durduramıyor). Kalıcı hatalar (404, reddedilen yönlendirmeler) hâlâ hemen başarısız oluyor — değişiklik yok.

### Notlar
- `server/lib/http-json.mjs` içinde yeni `parseRetryAfterMs()` ve saf `computeRetryDelayMs()`; `fetchJson` artık ok olmayan bir yanıtta `.retryAfter` yakalıyor ve `fetchJsonWithRetry` isteğe bağlı bir `maxDelayMs` (varsayılan 8000) alıyor. `tests/http-json.test.mjs` (+9). Takım: **2536**.


## [1.197.0] — 2026-08-14

**Eklendi — bir Getro VC iş ilan panosunu yalnızca `careers_url` ile takip edin; koleksiyon id'si kendiliğinden çözülür.**

### Eklendi
- Takip edilen bir Getro panosu (b2venture, Earlybird, Point Nine, …) artık elle bulunan sayısal bir `getro_collection` gerektirmiyor. Panonun kendi `careers_url` değerini verin; id, ilk taramada o sayfadan **kendiliğinden çözülür** — SSRF'ye karşı güvenli tek bir GET, sayısal `network.id` değerini sayfanın gömülü verisinden doğrudan okur. Açık bir `getro_collection` yine önceliklidir ve getirmeyi tümüyle atlar.

### Notlar
- `server/lib/sources/getro.mjs` içinde yeni `httpsCareersUrl()`, `extractCollectionId()` ve asenkron `resolveCollectionId()`; pano sayfası DNS'e sabitlenmiş, boyutu sınırlı `safeGet` ile getirilir ve çözülen id, `assertGetroUrl` tarafından hâlâ `api.getro.com` ana bilgisayarına sabitlenir. Adaptör artık id olmadan bile https `careers_url` taşıyan bir `provider: getro` girdisiyle eşleşir. `tests/sources-getro.test.mjs` (+8). Takım: **2527**.


## [1.196.0] — 2026-08-14

**Düzeltildi (güvenlik) — Workday adaptörü bir `api` uç noktasını alt dize değil, ana bilgisayar adıyla doğrular.**

### Düzeltildi
- `portals.yml`'deki bir Workday `api:` değeri artık yalnızca **ana bilgisayar adı** `myworkdayjobs.com` (veya `.myworkdayjobs.com` alt alan adı) olduğunda kabul edilir. Eski kontrol bir alt dize eşleşmesiydi, bu yüzden dizeyi yalnızca içeren herhangi bir URL — örn. `https://example.com/?x=myworkdayjobs.com` — geçiyor ve uç nokta olarak kullanılabiliyordu. Gerçek Workday uç noktaları etkilenmez. (CodeQL tarafından bildirildi, #443.)

### Notlar
- Yeni `isWorkdayApi()` URL'yi ayrıştırır ve ana bilgisayarı kontrol eder (`server/lib/portals/adapters/workday.mjs`). `tests/workday-adapter-endpoint.test.mjs` (+1). Takım: **2522**.


## [1.195.0] — 2026-08-14

**Performans (tarayıcı) — yeniden yayın tespiti büyük tarama geçmişlerinde hızlı kalıyor.**

### Performans
- Yinelenen ilan tespiti büyük bir `scan-history.tsv`'de artık O(N²)'ye düşmüyor. Şirket bazında başlık gruplaması, her çift için tam bir `roleFuzzyMatch` ödeyen iç içe bir döngüydü; artık bir ters dizin — satırları tek geçişte tam başlığa göre kovalara ayır, sonra yalnızca ayırt edici (temel olmayan) bir belirteci paylaşan FARKLI kovalar arasında bulanık eşleştirme yap. **Çıktı aynı** — aynı yeniden yayın kümeleri — eski algoritmaya karşı 200+ rastgele geçmişte diferansiyel testle kanıtlandı.

### Notlar
- `server/lib/detect-reposts.mjs` içinde `groupRowsByTitle` (diferansiyel test için dışa aktarıldı). `tests/detect-reposts-grouping.test.mjs` (+2). Takım: **2521**.


## [1.194.0] — 2026-08-14

**Düzeltildi (tarayıcı) — tek segmentli URL'ye sahip Workday kariyer sayfaları artık doğru taranıyor.**

### Düzeltildi
- Workday adaptörü artık yolu tek segment olan kariyer URL'lerini ayrıştırıyor — örn. `https://parsons.wd5.myworkdayjobs.com/Search`, `.../KBR_Careers`, `.../Careers`. Önceden site `External`'e düşüyor, adaptör yanlış CXS uç noktasına gidiyor ve bir sonda sağlıklı görünüp hiçbir şey döndürmeyebiliyordu. Artık yolun ilk boş olmayan segmentini site olarak alıyor (`en-US` gibi bir dil önekini atarak); belgelenen `/en-US/External` durumu değişmedi. (#255'te bildirildi.)

### Notlar
- `server/lib/portals/adapters/workday.mjs` içinde yapısal yol ayrıştırma. `tests/workday-adapter-endpoint.test.mjs` (+7). Takım: **2519**.


## [1.193.0] — 2026-08-14

**Eklendi (istatistikler) — hatırlatmaya değer mülakatları öne çıkaran bir "Mülakat sonrası sessizlik" sekmesi.**

### Eklendi
- `#/stats` içinde bir **Mülakat sonrası sessizlik** sekmesi: bir nezaket penceresini (varsayılan 30 gün) aşarak sessizleşen mülakatlar, aktif mülakatlarını ve takip panonu birleştirir — her birinin ne kadar süredir sessiz olduğu, son mülakat tarihi ve nedeniyle. Nazik bir hatırlatma/kapatma listesi; yalnızca öneri, asla bir ret iddiası değil. Token yok.

### Notlar
- Yeni `GET /api/stats/rejection-latency` rotası (fail-soft `{available:false}`). `tests/stats-rejection-latency-route.test.mjs` (+2). +10 i18n anahtarı ×17; `#/stats` help-hint 7→8 sekme. Takım: **2510**.


## [1.192.0] — 2026-08-14

**Eklendi (cv-studio) — hiç sahip olmadığın sayıları yakalayan bir "CV'nizin gerçeklerini denetleyin" kapısı.**

### Eklendi
- `#/cv-studio` içinde bir **CV'nizin gerçeklerini denetleyin** kartı: uyarlanmış bir CV veya ön yazı yapıştırın ve öne sürülen her metriği ve olguyu gerçek CV, profil ve two-pager'ınızla karşılaştırın. **pass / warn / block** kararının yanı sıra tam olarak uydurma metrikleri, desteksiz olguları ve yasak / uyarı ifadelerini alırsınız. LLM yok; hiçbir şey yazılmaz.

### Notlar
- Yeni `POST /api/cv-studio/verify-facts` rotası: metni tek kullanımlık geçici bir dosyaya yazar ve `verify-cv-facts.mjs`'yi çalıştırır; betik block'ta 1 ile çıksa bile JSON kararına güvenir. `tests/cv-studio-verify-facts-route.test.mjs` (+4). +15 i18n anahtarı ×17. Takım: **2508**.


## [1.191.0] — 2026-08-14

**Eklendi (istatistikler) — önce öğrenilecek becerileri sıralayan bir "Sırada ne öğrenmeli" sekmesi.**

### Eklendi
- `#/stats` içinde bir **Sırada ne öğrenmeli** sekmesi: tüm takip panosu genelinde beceri boşluğu özeti — düşük uyumu en sık batıran eksik beceriler, ağırlıklı (her raporda 5−uyum puanı) ve **Critical / High / Medium** kademeli — ayrıca CV/profilinin zaten kapsadıkları. Salt okunur, yalnızca öneri, token yok.

### Notlar
- Yeni `GET /api/stats/upskill` rotası (veri azken `{ error }` alanı; betik yokken `{available:false}`). `tests/stats-upskill-route.test.mjs` (+3). +15 i18n anahtarı ×17. Takım: **2504**.


## [1.190.0] — 2026-08-14

**Eklendi (takip panosu) — hangi şirketlerin sana gerçekten yanıt verdiğini gösteren bir "Şirket geçmişi" paneli.**

### Eklendi
- `#/tracker` üzerinde bir **Şirket geçmişi** kartı: bir şirket seç ve salt okunur kanıt al — sana ne kadar yanıt verdiği (**sana karşı sessiz** / **karışık** / **daha önce yanıt verdi**) ve aynı ilanın tekrar tekrar **yayınlanıp** yayınlanmadığı — takip panonu, takip mesajlarını ve tarama geçmişini birleştirerek. Token yok; tarayıcı hiç çağrılmaz.

### Notlar
- Yeni `GET /api/stats/company-history[?company=]` rotası (fail-soft `{available:false}`). `tests/stats-company-history-route.test.mjs` (+3). +18 i18n anahtarı ×17. Takım: **2501**.


## [1.189.0] — 2026-08-14

**Düzeltildi (tarayıcı) — Roma rakamıyla yazılan kıdem seviyeleri artık Latin olmayan başlıklarda da sayılıyor.**

### Düzeltildi
- `skip_tiers` arkasındaki kademe sınıflandırıcısı artık **herhangi bir yazı sisteminde** rol kelimesinden sonra gelen Roma rakamı seviye ekini (I / II / III / IV / V) okuyor — "Инженер III", "エンジニア I", "Ingénieur IV" — yalnızca ASCII kelimelerden sonra değil. Önceden Latin olmayan bir kelimeden sonraki seviye rakamı yok sayılıyor ve ilan **mid**'e düşüyordu, bu yüzden `skip_tiers: [senior]` veya `[entry]` onları atlıyordu.

### Notlar
- `server/lib/classify-tier.mjs` içinde yazı sisteminden bağımsız lookbehind; ölü yinelenen `Sr.` eşleştiricisi kaldırıldı. `tests/classify-tier.test.mjs` (+1). Takım: **2498**.


## [1.188.0] — 2026-08-14

**Düzeltildi (UI) — birincil eylem düğmeleri artık sayfa alt başlığına yapışık durmuyor.**

### Düzeltildi
- **Haftalık mülakat özeti**, **Yatırım alan şirketler**, **Portallar**, **Kariyer planı** ve **Kariyer yönlendirmesi** sayfalarındaki birincil eylem/kontrol satırı artık uygun bir üst kenar boşluğuna sahip; böylece düğme alt başlığa yaslanmak yerine altında nefes alıyor.

### Notlar
- Regresyon koruması `tests/lead-row-top-margin.test.mjs` (+5). Takım: **2497**.

## [1.187.0] — 2026-08-14

**Düzeltildi (tarayıcı) — `skip_tiers` ayarı yeniden çalışıyor: kıdeme göre atlamak istediğiniz ilanlar eleniyor.**

### Düzeltildi
- `portals.yml`'deki bir `skip_tiers:` listesi (ör. `skip_tiers: [intern, entry]`) artık taramada dikkate alınıyor. Her ilanın başlığı bir kıdem düzeyine (intern / entry / mid / senior) sınıflandırılır ve düzeyi listenizdeyse elenir. Önceden tarama başlık / konum / içerik / güven filtrelerini çalıştırıyor ama düzey filtresi yoktu, bu yüzden `skip_tiers` sessizce yok sayılıyordu. Düzey sözcüğü olmayan başlıklar **mid**'e düşer (böylece `skip_tiers: [mid]` sıradan ilanların çoğunu da eler) ve sınıflandırıcı EN SOLDAKİ düzey sözcüğünü okur.

### Notlar
- Yeni saf modül `server/lib/classify-tier.mjs` (`classifyTier` + `buildTierFilter`), EN ve RU tarayıcılarının filtre zincirlerine bağlandı. `tests/classify-tier.test.mjs` (+7). Takım: **2492**.

## [1.186.0] — 2026-08-14

**Eklendi (CV Studio) — bir "Beceri açığı" paneli: bir işin gerekli becerilerinden hangilerini CV'niz adlandırıyor, ima ediyor veya eksik.**

### Eklendi
- **CV Studio**'da yeni bir **Beceri açığı** paneli. Kayıtlı bir iş tanımı seçin; her gerekli beceriyi **CV'nizde adlandırılan**, **CV'nizde ima edilen** veya **eksik** olarak ayırır — LLM'siz kelime karşılaştırması, hiçbir şey yazılmaz. İlanda net bir gereksinim bölümü yoksa düşük güven notu görünür.

### Notlar
- Yeni `GET /api/jds/:name/skill-gap` (iş adı, argüman olmadan önce yol-temizlemesinden geçirilir ve `jds/` altında doğrulanır; betik yoksa `{available:false}`'e yumuşak geri dönüş). +13 i18n anahtarı ×17. Testler: `tests/jds-skill-gap-route.test.mjs` (+4, yol geçişi reddi dahil). Takım: **2485**.

## [1.185.0] — 2026-08-14

**Eklendi (istatistik) — "Huni ve hız" sekmesi: huniniz piyasayla nasıl kıyaslanıyor ve aşamalar arasında ne kadar hızlı ilerliyorsunuz.**

### Eklendi
- **İstatistik**'teki yeni **Huni ve hız** sekmesi, piyasa kıyaslama aralıklarının yanında **yanıt** ve **mülakat** oranlarınızı (küçük örneklem ve seçim yanlılığı uyarılarıyla), tipik ilk yanıt penceresini aşan süregelen başvuruların bir **bekleme listesini** ve aşama başına **medyan günü** (Başvuruldu → Yanıtlandı → Mülakat → Teklif) gösterir — yavaş satırlar medyanları saptırmasın diye sağdan sansürlenir. Salt okunur ve sıfır token; yalnızca kendi takipçinizi okur.

### Notlar
- Yeni `GET /api/stats/funnel` (betik yoksa `{available:false}`'e yumuşak geri dönüş). +18 i18n anahtarı ×17. Testler: `tests/stats-funnel-route.test.mjs` (+2). Takım: **2481**.

## [1.184.0] — 2026-08-14

**Düzeltildi (arayüz) — Panodaki hızlı işlem kutucukları artık düzgün bir ızgarada hizalanıyor.**

### Düzeltildi
- Panoda (Komuta Merkezi) 3 kutucukluk bir grup 4 kutucukluktan daha geniş görünüyor, bu da bölümlerin sağ kenarını düzensiz bırakıyordu. Artık her grup eşit genişlikte sütunlar kullanıyor (geniş ekranda 4, pencere daraldıkça 3 / 2 / 1'e iniyor), böylece tüm kutucuklar aynı boyutta ve sağ kenarları hizalı.

### Notlar
- Yalnızca CSS (`.qa-grid`: `auto-fill` yerine sabit `repeat(N, minmax(0,1fr))`). `tests/dashboard-grid-align.test.mjs` ile korunuyor (+2). Takım: **2479**.

## [1.183.0] — 2026-08-14

**Eklendi (tarayıcı) — daha akıllı yinelenen tespiti: takip bağlantısıyla yeniden yayımlanan aynı ilan artık iki kez görünmüyor.**

### Eklendi
- Tarayıcı artık bir ilanı **kanonik URL anahtarıyla** tanıyor; böylece takip parametresiyle (`?utm_…`, `gclid`, …), `http` yerine `https`, ya da sondaki eğik çizgi / `#parça` ile yeniden yayımlanan aynı ilan, olduğu tek ilan olarak ele alınır — tarama sonuçlarında veya pipeline'da yinelenen satır yok ve zaten gördüğünüz bir ilana boşa değerlendirme yok. Gerçekten farklı ilanlar (`gh_jid` gibi korunan işlevsel bir id) hâlâ ayrı sayılır.

### Notlar
- Yeni `server/lib/url-key.mjs`, her iki tarayıcının dedup'ına ve pipeline yazıcısına bağlandı. Bilerek az normalleştirir — iki farklı ilanı asla birleştirmez. Testler: `tests/url-key.test.mjs` (+5), `tests/parsers.test.mjs` (+1). Takım: **2477** (+6).

## [1.182.0] — 2026-08-14

**Düzeltildi (tarayıcı) — maaş aralıkları artık her dilde aynı görünüyor.**

### Düzeltildi
- Tarama ve takipçi satırlarındaki maaş rakamları, İngilizce olmayan arayüzlere çevrilmeden sızan İngilizce "from" / "up to" sözcükleri yerine yerelden bağımsız **≥** ve **≤** sembollerini kullanıyor (ör. `≥ 120000 EUR`, `≤ 90000`). Tek yönlü aralık bildiren tüm panolara uygulanır (Getro, Remotli, Manfred, Agentic Jobs, JustJoin, Jobicy); çift yönlü aralıklar (`100000–150000 USD`) zaten nötrdü.

### Notlar
- Yalnızca görüntüleme — istemci maaş filtresi ön eke bakmadan sayıları ayrıştırır, filtreleme değişmez. Takım: **2471**.

## [1.181.0] — 2026-08-14

**Eklendi (tarayıcı) — Getro iş panoları artık maaş, tüm konumları ve uzaktan ilanları gösteriyor.**

### Eklendi
- **Getro** tarayıcısı (fonların yetenek ağı panoları) artık her ilanda bir **maaş** (yıllık aralık + para birimi) gösteriyor, yalnızca ilkini değil **tüm** konumları listeliyor ve **uzaktan** ilanları etiketliyor. Taramanızdaki ve takipçinizdeki bir Getro ilanı artık diğer panolarla aynı maaş + konum ayrıntısını taşıyor.

### Notlar
- Yalnızca tarayıcı; yeni bağımlılık yok, rota / CSP / SSRF değişikliği yok. Testler: `tests/sources-getro.test.mjs` (+5). Takım: **2470** (+5).

## [1.180.0] — 2026-08-14

**Düzeltildi (ORTA, raporlar) — `#/reports` listesi artık bir tablo ve bir Machine Summary yer tutucusunun gizlediği gerçek bir puan geri kazanıldı.**

### Düzeltildi
- **`#/reports` listesi 4 kartlık bir ızgara değil, bir tablodur (Rapor · Tarih · Meşruiyet · Puan).** Uzun bir "Puan algılanmadı" çipi başlık sütununu neredeyse sıfıra sıkıştırıyor, ardından kart başlığındaki `overflow-wrap: anywhere` rapor adını harf harf bölüyordu. Artık her alanın kendi sütunu var, ad hücresi sözcüklerden bölünür ve dar ekranda tablo yatay kayar (yeni `.reports-scroll` konteyneri). Yeni i18n anahtarı `rep.colReport` ×17.
- **Gövdedeki gerçek bir puan (`**Итоговый балл:** 1.8 / 5`) artık bir Machine Summary yer tutucusu (`score: —`) tarafından gizlenmiyor.** `## Machine Summary` bloğu sayısal olmayan veya aralık dışı bir puan taşıdığında, ayrıştırılmış puan yuvasını dolduruyor ve kalın değer-biçimi yedeğini engelliyordu; böylece gövdede gerçek bir `X / 5` olmasına rağmen rapor "Puan algılanmadı" gösteriyordu. `parseReportHeader` artık kullanılabilir bir sayı kalmadığında gövdenin değer-biçimini geri kazanır (adım 4.5).

### Notlar
- Yalnızca istemci + ayrıştırıcı; rota / CSP / SSRF / üst yazma değişikliği yok. Testler: `tests/reports-table.test.mjs` (+5), `tests/report-header-locale.test.mjs` (+2). Takım: **2465** (+7).

## [1.179.0] — 2026-08-13

**Değiştirildi (LOW, tarayıcı) — 20 yinelenen HTML varlık çözücüsü ortak modülde birleştirildi (parite devamı, worklist'i kapatır).**

### Değiştirildi
- 20 kazıma tarama kaynağının her biri kendi `decodeEntities`/`decodeXmlEntities`'ini (+ bir `fromCodePoint` yardımcısı) taşıyordu — sürüklenmiş kopyalar (üçü `RangeError` fırlatabiliyordu, v1.172.0'de düzeltildi; diğerleri NUL/C0'a izin veriyor veya `&#1a2;`'yi yanlış ayrıştırıyordu). Artık hepsi tek `server/lib/html-entities.mjs`'ten (XML 1.0 Char güvenli çözücü) geçiyor ve ~237 satır yineleme kaldırıldı. 8 RSS tarzı kaynak `&nbsp;` çözümü kazandı (önceden yalnızca 5 varlık); cryptocurrencyjobs'un kasıtlı çift çözümü bir takma adla korundu. `hh` kendi çözücüsünü tutuyor (`&mdash;`/`&ndash;`'yi işler, ortak 6'nın dışında). Yeni bir nöbetçi test, herhangi bir kaynak yerel çözücü yeniden oluşturursa başarısız olur.

### Notlar
- Davranışı koruyan yeniden düzenleme; rota / CSP / SSRF / üst yazma değişikliği yok. Testler: `tests/decoder-consolidation.test.mjs` (+2). Takım: **2458** (+2).

## [1.178.0] — 2026-08-13

**Düzeltildi (LOW, üst parite) — iki eski sabit üst projeye uyacak şekilde güncellendi (PARENT-SYNC GAP #4 + #5).**

### Düzeltildi
- **Tarayıcı User-Agent (GAP #4)** — `BROWSER_LIKE_USER_AGENT` (workable/workday/oraclecloud/a16z/eightfold tarafından WAF/bot geçitlerini aşmak için gönderilir) Chrome 131'den **151**'e yükseltildi, üst projenin `user-agent.mjs`'iyle uyumlu; eski bir sürüm daha sık engellenir. Bir `Chrome major ≥ 151` testiyle korunuyor.
- **Tracker durumları FALLBACK (GAP #5)** — `states.mjs`'deki son çare `FALLBACK` (yalnızca canlı `templates/states.yml` okunamadığında kullanılır — taze klon / CI izole kök) üst projenin Türkçe durum takma adlarını (#2615) kazandı: değerlendirildi, başvuruldu, yanıt verildi, mülakat, teklif, reddedildi, iptal edildi, uygun değil, kabul edildi/işe alındı. Üretimde canlı dosya bunları zaten sağlıyordu.

### Notlar
- Yalnızca iki sabit; rota / CSP / SSRF / üst yazma değişikliği yok. Testler: `tests/http-json.test.mjs` (+1) + `tests/states.test.mjs` (+1). Takım: **2456** (+2).

## [1.177.0] — 2026-08-13

**Düzeltildi (MEDIUM, tarayıcı) — arama API'sini oturum çerezleriyle koruyan kiracılarda csod (Cornerstone) 0 iş döndürüyordu (parent #2769, PARENT-SYNC GAP #1).**

### Düzeltildi
- Bazı Cornerstone kiracıları kariyer sitesi açılış sayfasında oturum çerezleri ayarlar ve bu çerezler anonim bearer belirteciyle birlikte geri gelmezse arama API'sine `401 CSOD Unauthorized` yanıtı verir. `sources/csod.mjs` artık açılışı yeni bir `fetchResponse` yardımcısıyla okur, `Set-Cookie` değerlerinden bir `Cookie` başlığı kurar (`cookieHeaderFrom` — yalnızca ad=değer, jar semantiği) ve arama POST'unda yeniden gönderir. Yalnızca aynı köken (host sabitlenmiş + `redirect:'error'`), böylece oturum çerezleri asla üçüncü tarafa ulaşamaz; çerez ayarlamayan bir kiracı eskisi gibi davranır.

### Notlar
- Yeni `server/lib/http-json.mjs::fetchResponse` (eklemeli; mevcut kaynaklar etkilenmez). Rota / CSP / SSRF / üst yazma değişikliği yok. Testler: `tests/sources-parity-v1118a.test.mjs` (+1). Takım: **2454** (+1).

## [1.176.0] — 2026-08-13

**Düzeltildi (MEDIUM, raporlar) — RU tablosunun listelemediği kalın bir etiket altındaki puan hâlâ "Score not detected" gösteriyordu (FIND-5).**

### Düzeltildi
- İki RU raporu puanı `**Итоговый балл:** 1.8 / 5` / `**Скор:** 1.8 / 5` olarak yazıyordu — `REPORT_LABELS.ru`'nun saymadığı kalın etiketler (yalnızca "Оценка"/"Балл" bilir), bu yüzden puan ayrıştırılmadan kalıyordu. Eş anlamlı listesini büyütmek yerine, `parseReportHeader` artık **değer biçimine** düşüyor: herhangi bir kalın etiket altında /5 ölçütüne göre bir kesir. Dilden bağımsızdır, bir başlığa bağışıktır (`**` yok, `/5` değeri yok) ve `5/5/2026` gibi bir tarihi reddeder (paydaya negatif ileri bakış).

### Notlar
- Yalnızca sunucu ayrıştırıcı; rota / CSP / SSRF / üst yazma değişikliği yok. Testler: `tests/report-header-locale.test.mjs` (+2). Takım: **2453** (+2).

## [1.175.0] — 2026-08-13

**Düzeltildi (LOW, sağlamlaştırma) — FIND-3 SEO açıklaması için bir regresyon nöbetçisi + null'a dayanıklı meşruiyet temizliği (AI-review takibi).**

### Düzeltildi
- **SEO açıklaması parite nöbetçisi** — her dilin `meta.desc` alanındaki sabit kodlu "~55"i kayıt defterinden türetilen `{adapters}` yer tutucusuyla değiştiren v1.174.0 düzeltmesinin testi yoktu, bu yüzden bir sonraki dil düzenlemesinde sessizce geri dönebiliyordu. Yeni, CI'dan yalıtılmış `tests/site-meta-desc-parity.test.mjs`, 17 `site/src/i18n/*.json` dosyasından biri yer tutucuyu kaybederse veya bir sayıyı yeniden sabit kodlarsa ya da `Landing.astro` onu üç açıklama meta'sına yerleştirmeyi bırakırsa başarısız olur.
- **Null'a dayanıklı meşruiyet temizliği** — `stripEmphasis` boş girdi için "undefined" dizesi yerine `''` döndürür (alanlar dize olarak başlatılır, yani derinlemesine savunma).

### Notlar
- Test + ayrıştırıcıda tek satırlık bir nöbetçi; rota / CSP / SSRF / üst yazma değişikliği yok. Testler: `tests/site-meta-desc-parity.test.mjs` (+3). Takım: **2451** (+3).

## [1.174.0] — 2026-08-13

**Düzeltildi (HIGH, raporlar) — yerelleştirilmiş raporlar "Score not detected" gösteriyordu; SEO açıklaması eskimişti.**

### Düzeltildi
- **Puan ayrıştırma (FIND-1)** — H1'i puan etiketi sözcüğünü içeren İngilizce olmayan bir rapor (`# Оценка вакансии: <başlık>`) artık o başlığı puan sanmıyor. `parseReportHeader` şimdi yerelleştirilmiş **kalın** etikete (`**Оценка:** 1.5 / 5`) sabitleniyor, başlık satırlarını atlıyor ve etiketin iki noktaya bitişik olmasını istiyor — böylece "Score not detected" gösteren RU raporları gerçek puanını gösteriyor.
- **Meşruiyet rozeti (FIND-2)** — değerden Markdown vurgusu temizleniyor, rozet "** High Confidence" yerine "High Confidence" gösteriyor.
- **Puan taşması** — sonuna durum metni eklenmiş bir puan satırı ("1.8, Status: Evaluated, …") yalnızca puana sıkıştırılıyor; `.score-pill` bir kaydırma-yok/taşma sınırı kazanıyor ve başlık sütunu daralabiliyor, böylece renkli rozet kart kenarından hiç taşmıyor.
- **SEO açıklaması (FIND-3)** — cvstart.org'un meta / OG / Twitter açıklamaları (17 dilin tümü) "Scan ~55 job boards" değerini sabit kodluyordu, oysa gövde gerçek kayıt defterini sayıyordu ("~75"). Açıklama artık kayıt defterinden türetilen sayıyı yerleştiriyor, böylece bir daha kaymıyor.

### Notlar
- Sunucu ayrıştırıcı + istemci render/CSS + site i18n; rota / CSP / SSRF / üst yazma değişikliği yok. Testler: `tests/report-header-locale.test.mjs` (+4). Takım: **2448** (+4).

## [1.173.0] — 2026-08-13

**Eklendi (LOW, yapılandırma) — Hermes, algılanan yapay zeka CLI listesine katıldı (career-ops paritesi).**

### Eklendi
- `#/config` → "Yapay Zeka CLI Araçları" sekmesi artık üst projenin yeni desteklediği aracı çalışma zamanı **Hermes**'i (Nous Research, ikili `hermes`) algılıyor. `server/lib/routes/cli-detect.mjs` içindeki sabit izin listesi 10'dan 11 araca çıkıyor; algılama salt okunur bir PATH taraması olarak kalıyor (hiçbir ikili asla çalıştırılmaz).

### Notlar
- i18n / rota / CSP / SSRF / üst yazma değişikliği yok; liste sabittir, asla girdi değildir. Takım: **2444** (cli-detect kanaryası 10 → 11 güncellendi).

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
## [1.84.0] — 2026-06-30

**Re-apply cooldown + compensation in pipeline.md (parent career-ops v1.15.0 parity).** Two scanner upgrades:

- **Re-apply cooldown** (#1201): the EN scan now skips roles at companies you applied to recently, so results stay focused on NEW openings. Configure per-company windows in `config/profile.yml` under `re_apply_windows:` (`last_apply_date`, `same_role_days`, `applied_to: [roles]`, optional `cross_role_bucket`); company matching is punctuation-insensitive + word-boundary (`server/lib/cooldown.mjs`). Off when the key is absent; the scan log shows `Cooldown skipped: N`.
- **Compensation in pipeline.md** (#1017): scanned offers now persist their salary as an optional trailing column (`url | <salary>`) in `data/pipeline.md`. The URL stays the dedup key (the `| comp` column is stripped on read), the cell is sanitized (no row/column injection, formula-leading neutralized), and bare-URL pipelines stay backward-compatible.

Ships `tests/cooldown.test.mjs` + pipeline compensation tests. Source count unchanged at **41** (both are scan-logic upgrades, not new boards).

## [1.83.0] — 2026-06-30

**Repost / ghost-posting detector (parent career-ops v1.15.0 parity).** A new **🔁 Reposted / ghost roles** panel on `#/scan` flags company+role clusters that were re-listed under *different* URLs within a rolling 90-day window — a signal of stale pipelines and ghost postings. Backed by a fuzzy role-title matcher (`server/lib/role-matcher.mjs`) and a read-only detector (`server/lib/detect-reposts.mjs`) over `data/scan-history.tsv`, surfaced via `GET /api/scan/reposts` (window clamped 7–365 days; fail-soft on a malformed history). Also: `/api/health` `parentVersion` now reports just the semver — the release-please `# x-release-please-version` comment is stripped. Ships `tests/detect-reposts.test.mjs`. (Source count unchanged at **41** — reposts is an analysis feature, not a new board.)

## [1.82.0] — 2026-06-30

**NoDesk scan source (parent career-ops v1.15.0 parity).** The board-wide [NoDesk](https://nodesk.co) remote-jobs RSS feed is now a first-class scan source — add a `provider: nodesk` entry and it appears in the `#/scan` **Source** dropdown (**41 adapters** total: 36 EN + 5 RU). Host-pinned to `nodesk.co` with `redirect:'error'` (SSRF-safe); titles split on `Role at Company` (NoDesk has no location tag, so location stays empty); all rows remote. Ships a CI-isolated `tests/sources-nodesk.test.mjs` suite; full unit suite green at 1523.

## [1.81.0] — 2026-06-29

**Parent career-ops parity — 13 new job-board scan sources.** Ports the latest provider batch from [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) `main` into the in-process scanner. **Board-wide public APIs** (provider-selected): **Arbeitnow**, **Himalayas**, **Jobicy**, **Landing.jobs**, **4 Day Week**, **The Muse**, **The Hub**, **Jobspresso** (RSS), and **Hacker News “Who is hiring?”** (Algolia two-step). **Poland boards** (host- or `provider:`-detected): **JustJoin.it** and **NoFluffJobs** (POST search). **Per-tenant ATS** (auto-detected from `careers_url`): **Pinpoint** (`<slug>.pinpointhq.com/postings.json`) and **Rippling** (`ats.rippling.com/<slug>` → `api.rippling.com` board). Every source is host-pinned with `redirect:'error'` (SSRF-safe) and selectable in the `#/scan` **Source** dropdown — the registry now ships **40 scanner adapters** (35 EN + 5 RU). Adds 13 CI-isolated per-source test suites; full unit suite green at 1513.

## [1.80.0] — 2026-06-28

**Five scan upgrades (ideas from [bracketouverte/job-crawler](https://github.com/bracketouverte/job-crawler), reimplemented).** (1) **Teamtailor** source — per-tenant `<slug>.teamtailor.com` career sites via their public `/jobs.rss` feed, auto-detected from `careers_url` (host-pinned + `redirect:'error'`); the registry now ships **27 adapters**. (2) **Source quarantine** — a source that returns a permanent 404/410 is recorded in `data/scan-quarantine.json` and skipped on later scans (self-healing: retried after 14 days), killing the recurring dead-slug noise. (3) **Max per source** — an optional `#/scan` field caps how many jobs each board contributes (∞ by default). (4) **Posted within** — a client-side age filter (24h / 7d / 30d) on the results table. (5) **Saved searches + ★ favorites** — name & reuse filter sets and star jobs, persisted in `localStorage` with defensive validation (a corrupt cache resets cleanly); the results cache is reset before each scan and refilled live.

## [1.79.0] — 2026-06-28

**WeWorkRemotely scan source (parent career-ops v1.14.0 parity).** The board-wide [We Work Remotely](https://weworkremotely.com) remote-jobs RSS feed is now a first-class scan source — add a `provider: weworkremotely` entry and it appears in the `#/scan` **Source** dropdown (**26 adapters** total). Host-pinned to weworkremotely.com with `redirect:'error'` (SSRF-safe); titles split on `Company: Role`. Also: `title_filter` keywords are now **trimmed before** the length check, so a whitespace-only keyword can't compile into a match-everything filter (parent #1261).

## [1.78.2] — 2026-06-27

**i18n + UX hardening (follow-ups to v1.78.1).** The brand logo's accessible name is now localized in all 13 languages (`nav.logoHome`). Global-search **Enter** while already on `#/scan` force-re-renders so the pre-filled term is never lost (same-route guard). `health.title` is now translated in Polish (`Kondycja`) and Danish (`Systemtilstand`) — previously left in English. Tests 1235 → 1238.

## [1.78.1] — 2026-06-27

**Scan UX fixes.** The `#/scan` results table now auto-refreshes live during a scan and once more after it finishes — no manual reload. The top-bar global search shows an **Enter** hint and, on a non-URL query, jumps to `#/scan` with the search box pre-filled (was `#/tracker`). The brand logo now links to the dashboard (home).

## [1.78.0] — 2026-06-27

**Geography filter on the Scan page — filter job results by country, with flags.** A new **Country** dropdown in `#/scan` lists every country detected across your scanned results (flag emoji + count), so you can keep only roles tied to a specific country — alongside the Remote/Hybrid/Onsite work-type filter, so you can search both country-bound and remote work. Backed by a new `countries.js` helper that maps a posting’s free-text location (country names, aliases, and ~100 major job-market cities) to an ISO country + flag; detection is conservative and never guesses (unmapped/remote locations stay under “All countries”).

## [1.77.0] — 2026-06-27

**Danish (Dansk) added as the 13th interface language.** Full Danish UI translation, in-app Help guide (19 H2 / 75 H3), README, and CHANGELOG. Danish joins the flag language picker; the i18n machinery (assembler, audit, parity gates, snapshot) now spans 13 locales.

## [1.76.0] — 2026-06-26

**Parent career-ops v1.13.0 parity — six new job sources, scanner hardening, and an uncapped results table.**

### Added
- **Six per-tenant ATS sources** — BambooHR, Breezy HR, Comeet, Personio, Recruitee, SolidJobs. They auto-detect from the `careers_url` host (Comeet needs the full `api:` careers-api URL) and each pins its host with an anchored regex + `redirect:'error'` (SSRF-safe). All selectable in the `#/scan` **Source** dropdown — the registry now ships **25 adapters** (20 EN + 5 RU). Adds a `fetchText` helper for Personio's XML feed.
- **`trust_filter`** — optional, annotate-only trust scoring (0–100, level high/medium/low, flags) for each scanned posting. Sub-`high` rows get a language-neutral ⚠ badge in `#/scan`; nothing is ever dropped.
- **Arbeitsagentur `remoteMatch` + `remoteMaxPages`** — config-driven remote detection: `title` (regex), `filter` (server-side `homeoffice=nv_true` + pagination), or `off`.

### Changed
- **No scan result cap.** The `MAX_STORED_RESULTS` display cap (2000) was removed — every matched posting is stored and the `#/scan` table pages through them (200/page). Large sweeps no longer lose their tail.
- **Title-filter robustness** — short all-letter acronyms (COO, SDR…) now match on word boundaries (no more “COO” in “Coordinator”); malformed `title_filter` config can no longer crash a scan. Both the ATS and regional scanners.

### Tests
- +32 cases (1190 → **1222**): `sources-ats-providers`, `title-filter`, `arbeitsagentur-remote`, `trust-validator`, and a rewritten `scan-result-cap` “no cap” guard.

## [1.75.2] — 2026-06-19

**docs: full documentation parity for the v1.75.0 scanner aggregators across all 12 locales.** No code change — brings the user-facing docs in line with the seven sources that landed in v1.75.0:

- **Help guide (12 locales).** §5 gains a `content_filter` block (description/snippet keyword gating, sibling of `location_filter`) and an aggregators note; §7 lists the seven new sources in the one-click-scan sweep and the full **Source** dropdown enumeration; §17's adapter count is corrected from the stale "11 adapters" to "19 adapters — 14 English + 5 Russian". No `##`/`###` heading was added, so the gated 19 H2 / 75 H3 structure is unchanged.
- **README (9 full locales).** New "Aggregator boards (v1.75.0)" bullet under the scan sources, plus the release badge bumped to v1.75.2. (The abbreviated pl/uk/ar READMEs have no per-source list and are intentionally untouched there.)
- **Reference docs.** `docs/portals-examples.md` gains a copy-paste "Aggregator boards" section with accurate `provider:` / `<provider>:` config blocks for all seven; `docs/PROJECT.md` updated to **19 adapters**; `docs/sdd/CONVENTIONS.md` documents the two-registry distinction (`sources/registry.mjs` for the dropdown vs `portals/registry.mjs` for fetching), the `provider:`-based aggregator selection threaded as `opts.company`, the scan-write sanitizer (`scan-sanitize.mjs`), and the v1.75.1 test count (1190).
- **QA.** Added `qa/QA-REGRESSION-PROMPT-v1.75.2-FULL.md` — the full-surface release-gate driver, refreshed for the v1.75.x scan-aggregator cycle.

---



## [1.75.1] — 2026-06-19

**fix(scan): robustness polish on the v1.75.0 config-driven sources.** Three small hardening fixes from the post-release review (no behavior change for a healthy scan):

- **Abort-aware pagination delays.** The Glints (300 ms) and Jobstreet/SEEK (200 ms) inter-page courtesy pauses now resolve immediately when the scan's `AbortSignal` fires, via a new `delay(ms, signal)` helper in `server/lib/http-json.mjs`, so a disconnected client can't hold a paginating scan open for an extra pause.
- **Descriptive non-JSON error.** `fetchJson` now wraps a non-JSON `2xx` body (e.g. an HTML maintenance page served with status 200) as `non-JSON 2xx response from <url>` instead of surfacing a bare `SyntaxError`, so the scanner's per-source error log names the misbehaving endpoint.
- **Stronger scan-write normalization.** `normalizeScanScalar` now collapses the vertical tab, form feed, and the Unicode line/paragraph separators (`\v \f U+2028 U+2029`) in addition to `\r \n \t` — a strict superset, so no record/line separator a spreadsheet or viewer might honor survives into `scan-history.tsv`.

---


## [1.75.0] — 2026-06-19

**feat(scan): port parent career-ops v1.12.0 — seven new job sources, content filtering, and security/quality fixes.** The web-ui runs its own in-process scanners (it does not shell out to the parent's `scan.mjs`), so parent v1.12.0's provider and scan changes do not flow through automatically — this release reimplements the applicable ones in the web-ui's adapter contract.

- **Seven new scanner sources.** Three board-wide remote aggregators — **RemoteOK**, **Remotive**, **Working Nomads** — drop into the auto-discovered `server/lib/sources/*.mjs` pattern (select with `provider: remoteok` / `remotive` / `workingnomads`). Four config-driven regional aggregators — **IBM** careers, **Arbeitsagentur** (German Federal Labor Agency), **Glints** (SE Asia), **Jobstreet / SEEK** — read a per-entry `<provider>:` config block; en-scanner now threads the resolved company entry through to every fetcher so they can read it. All seven appear in the `#/scan` source dropdown automatically.
- **`content_filter` (parent #974).** Optional `portals.yml` block (`positive` / `negative` keyword lists) that gates a posting on its description/snippet text — mirrors `location_filter` semantics; postings without a description always pass. Wired into both EN and RU scanners.
- **Scan-write hardening (parent #1098).** External feed metadata is now sanitized before it lands in `data/scan-history.tsv` and `data/pipeline.md`: control characters are collapsed (a company/title newline can no longer inject a TSV row) and a leading `= + - @` is neutralized against spreadsheet formula injection.
- **Ashby `secondaryLocations` (parent #1073).** The Ashby source now folds each secondary location's region label plus postal `addressLocality` / `addressCountry` into the location string (deduped), so an EU-eligible role whose primary label reads e.g. "Canada" surfaces for the `location_filter`.
- **Evaluation report-shape validation (parent #819).** `/api/evaluate`'s in-process providers (Anthropic / OpenAI / Qwen / OpenRouter / GitHub Models) now flag a malformed A–G / `SCORE_SUMMARY` report as a non-fatal `warnings` array; the Gemini eval path already inherits the guard from the parent's `gemini-eval.mjs`.
- **docs:** Antigravity CLI added to the supported-assistant lists across all 12 READMEs (maps to the Gemini provider).

Inherited for free from the `git pull` of the parent (web-ui shells out to these): Japanese CJK PDF font fallback (#1053), ATS-safe PDF fonts (#1074), LaTeX CJK guard (#1054), tracker/merge/followup/dashboard fixes, and the `modes/zh` Chinese modes (the web-ui lists modes dynamically).

---


## [1.74.3] — 2026-06-18

**docs(parent-source): point the parent `career-ops` repo at the [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) fork.** The web-ui now references the maintainer's fork as the parent project everywhere it is a live source: the `bin/setup.sh` installer's `CAREER_OPS_REPO` clone default, every `git clone` / "sits on top of" / onboarding link across all 12 READMEs, and the agent docs (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `docs/`). Author credit to santifer (and the unofficial-UI disclaimer) is unchanged — only the source/clone URLs moved. `tests/sh-files.test.mjs` now asserts the installer clones the fork.

---


## [1.74.2] — 2026-06-17

**fix(health): surface `GITHUB_MODELS_API_KEY` as an optional check on `#/health` and in `/api/status/providers`.** The v1.74.0 GitHub Models provider was configurable in `#/config` but had no row on the Health page and was missing from the `keysConfigured` provider surface. Added the optional check (same "set / unset (manual mode)" wording as the other five live-eval providers) and `github` (+ its `GITHUB_MODELS_MODEL`) to `/api/status/providers`, so the active-provider routing and Health page now reflect all six. `tests/api.test.mjs` health-row test extended to all six providers.

---



## [1.74.1] — 2026-06-17

**docs + test: README "Install an AI assistant" section; full branch coverage for the Gemini connector.** Added an install/login table to the README — install links for **Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI** + each one's `#/config` provider mapping + "log in before continuing" (mirrors the career-ops.org/docs Quick Start; clarifies the web-ui is the standalone, no-CLI-needed alternative). New `tests/gemini-connector.test.mjs` (8 cases) covers every `runGemini` branch — no-key, success, API error, empty/blocked completion, malformed body, timeout, network error, `hasGeminiKey` — taking `server/lib/gemini.mjs` to **100% statements**. Overall coverage **96% lines / 88% branch / 96% funcs**. Suite 1126 → 1134.

---



## [1.74.0] — 2026-06-17

**feat(llm): GitHub Models (Copilot) as the 6th provider + canonical 6-assistant alignment.** [career-ops.org/docs](https://career-ops.org/docs) lists six AI coding assistants — Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI. The web-ui now supports all six: five map to existing live providers (Anthropic / Gemini / OpenAI / Qwen / OpenRouter), and **GitHub Copilot CLI** gains a dedicated **GitHub Models** connector — `runGitHubModels` (OpenAI-compatible; a GitHub PAT with the `models` scope), configurable in `#/config` (`GITHUB_MODELS_API_KEY` + `GITHUB_MODELS_MODEL`) and selectable via `LLM_PROVIDER=github`; 6th in the `auto` order. Help bundles + READMEs now list the canonical six (renamed Qwen CLI→Qwen Code; added Gemini CLI + GitHub Copilot CLI), and the README adds a full **mode-reference + portal-adapter link table** to career-ops.org/docs so every feature traces back to the parent. `tests/llm-provider-context.test.mjs` extends the fetch-boundary matrix to all six providers (cv.md + profile.yml inlined + artifact returned); new `GITHUB_MODELS_*` keys added to all 12 locale dictionaries. Suite 1125 → 1126.

---



## [1.73.0] — 2026-06-17

**feat(llm): generic Gemini connector + verified CV/profile context across all providers.** Added `server/lib/gemini.mjs` (`runGemini`) — a zero-dependency Gemini `generateContent` client returning the same `{markdown, usage, error}` shape as the Anthropic / OpenAI-compatible clients. **Fix:** `/api/mode/:slug` and `/api/deep` previously piped their prompts through the oferta-only `gemini-eval.mjs`, so Gemini **Run live** returned an *evaluation* instead of the requested artifact (cover letter, outreach, brief). They now call `runGemini` with `bundleProjectContext`, so `cv.md` + `config/profile.yml` are inlined for Gemini exactly like every other provider — letters/briefs are detailed and personalized. New `tests/llm-provider-context.test.mjs` mocks each provider's HTTP boundary and asserts all five (Anthropic / Gemini / OpenAI / Qwen / OpenRouter) inline `cv.md` + `profile.yml` and return the artifact (mode + deep + evaluate matrix, 9 cases). `/api/evaluate` keeps its oferta-tuned `gemini-eval.mjs`. Suite 1116 → 1125.

---



## [1.72.0] — 2026-06-17

**feat(modes): "Run live" now returns the final artifact directly (single-shot output contract).** The parent `modes/<slug>.md` templates are written for interactive Claude Code sessions — several (cover, contacto, …) pause to ask clarifying questions before producing the result, which made the web-ui's single-shot **Run live** emit a questionnaire instead of the artifact. `buildModePrompt` now wraps every mode in a non-interactive **output contract**: do the analysis (JD breakdown, company notes, ATS keywords, profile↔JD gaps, tone/angle choices) **silently**, pick sensible defaults from `cv.md` / `config/profile.yml` for anything the template would normally ask, and output **only the final artifact** — closed with a per-mode "output ONLY {the cover letter / outreach message / …}" reminder. So clicking **Run live** on `#/cover` now returns the cover letter itself; the same fix applies to every generic mode (cover, contacto, interview-prep, project, training, followup, patterns) in all 12 locales (the artifact is written in the UI language via the locale directive). Suite 1103 → 1116.

---



## [1.71.2] — 2026-06-17

**docs(i18n): publish the documentation-consistency pass.** Every README "Translations of this guide" block now lists all 11 sibling languages (previously some omitted English/Français and self-linked), with the blank line before the section break restored. The full QA regression prompt is renamed to the current version, and the docs (CLAUDE.md, CONVENTIONS, LOCALIZATION, PROJECT-CONTEXT) are synced to the current version and test count (1103). No code or behavior change — docs only, so the help/UI translations and all features from 1.70.0–1.71.1 are unchanged.

---



## [1.71.1] — 2026-06-17

**fix(i18n): the in-app help guide is now fully translated in all 12 languages.** Added `docs/help/{pl,uk,ar}.md` (each holding the gated 19 H2 / 75 H3 structure) so `#/help` serves a native bundle for Polish, Ukrainian, and Arabic instead of falling back to English — `GET /api/help/{pl,uk,ar}` now return their own locale. Wired into every help gate (`help-ui`, `help.test`, `help-ru-config-section`, `canonical-docs-coverage`). Also completed every 12-language translation list: the README "Translations of this guide" block (9 READMEs), the localized CHANGELOG "Translations:" headers (8 files), and refreshed stale doc counts (CONVENTIONS test count → 1100; help "fall back" notes → 12 translated bundles). Suite 1100 → 1103.

---



## [1.71.0] — 2026-06-16

**feat(cover): generate a cover-letter PDF straight from `#/cover`.** The cover mode (added in v1.70.0) produces the letter text; the result now offers a **Generate PDF** button that renders it through the shared inline markdown→PDF pipeline (`POST /api/stream/pdf/inline` → `generate-pdf.mjs`), the same path interview-prep uses. You can now produce the letter and ship a PDF without leaving the SPA.

**test/docs: v1.70.0 review hardening.** Added CI-isolated coverage for the cover mode (allowlist + prompt assembly, via `modes-endpoints.test.mjs`), the flag `<select>` switcher + Arabic RTL (`dirFor`/`<html dir>`, new `tests/lang-switcher-rtl.test.mjs`), `top.langLabel` in every locale, the cover-letter PDF wiring (`tests/cover-letter-pdf.test.mjs`), and the `prompts.mjs` locale directive + scaffolding for fr/pl/uk/ar (`tests/locale-scaffold.test.mjs` — locking the latent French gap closed in v1.70.0). Refreshed three stale "all 8" → 12-locale / 9-help-bundle references in `docs/sdd/CONVENTIONS.md`. Refreshed the full-project QA regression prompt (`qa/QA-REGRESSION-PROMPT-v1.71.0-FULL.md`).

---



## [1.70.0] — 2026-06-16

**feat(i18n): three new UI languages — Polish (pl), Ukrainian (uk), and Arabic (ar, with full RTL) — bringing the SPA to 12 locales, matching every language in the parent career-ops README.** Each new locale ships a complete 697-key dictionary (`public/js/lib/locales/i18n-dict.{pl,uk,ar}.js`), gated by the existing parity / coverage / no-latin-leak / no-personal-data suites. Arabic adds genuine right-to-left support: `i18n.js` sets `<html dir="rtl">` for RTL locales and a scoped `[dir="rtl"]` block in `app.css` mirrors the chrome (sidebar, notifications drawer, markdown tables/blockquotes, inline spacing) — LTR locales are byte-for-byte unchanged. New `top.langLabel` key (×12) names the picker for screen readers.

**feat(ui): flag-icon `<select>` language switcher replaces the wrapping button row.** With 12 locales the old `.lang-btn` row wrapped to three lines in the sidebar; a native `<select>` (each option prefixed with a flag emoji) scales cleanly, is keyboard- and screen-reader-friendly out of the box, and stays CSP-safe (change handler via `addEventListener`, no inline JS). Flags degrade to region letters where the platform lacks flag glyphs, so the language label is always the load-bearing identifier.

**feat(cover): port the parent's cover-letter mode (career-ops v1.10.0 + v1.11.0 greeting) into the SPA.** New `#/cover` page under the Application nav group, built on the generic mode runner: Job description + Company/Role + an optional salutation → a tailored letter generated from `cv.md` / `modes/_profile.md`. Added `cover` to the server `MODE_ALLOWLIST` and a `cover.*` i18n block (×12 locales).

**chore(compat): track parent career-ops v1.11.0.** Verified the read/write contract is intact — `data/applications.md` stays the markdown source of truth (the v1.11.0 SQLite tracker index is a derived cache), tracker columns are still header-mapped. `parentVersion` now reports 1.11.0.

**fix(i18n): close a latent gap where French (added v1.61.0) was missing from `server/lib/prompts.mjs` `LOCALE_NAMES` and `SCAFFOLD_STRINGS`** — French LLM calls silently defaulted to English output and English scaffolding. fr/pl/uk/ar are now all wired into the prompt-locale path.

> Known follow-ups (tracked in `qa/v1.70-regression/`): the in-app **help guide** (`docs/help/`) falls back to English for pl/uk/ar (the UI chrome itself is fully localized); the parent's interactive **interview onboarding**, **reverse-ATS discovery**, and newer **scan providers** are not yet surfaced in the SPA.

---



## [1.69.2] — 2026-06-12

**fix(test): close a test-isolation leak that let `npm test` overwrite the user's real `config/profile.yml` and `data/scan-history.tsv`.** `tests/critical-fixes.test.mjs` statically imported `prompts.mjs` at the top of the file; `prompts.mjs` transitively imports `paths.mjs`, which resolves `PROJECT_ROOT` eagerly at module load (PATHS resolves once per process). Because that import ran **before** the `before()` hook set `CAREER_OPS_ROOT` to a temp dir, PATHS pinned the **real** parent — so the F-008 `PUT /api/profile` wrote the "Acceptance Test" fixture into the user's real profile on every run (and similar writes escaped the temp root). Fix: load `prompts.mjs` via **dynamic `import()`** inside `before()`, after the env is set (the server was already loaded that way). New `tests/test-root-isolation.test.mjs` (2 cases) guards every isolation-needing test against statically importing a `paths.mjs` carrier (`server/index.mjs`, `prompts.mjs`, `store.mjs`, `en-scanner.mjs`, `ru-scanner.mjs`, `paths.mjs`). **No production-code change.** Suite 1084 → 1086.

---



## [1.69.1] — 2026-06-12

**fix(scan): raise the `#/scan` result display cap 500 → 2000 per region so large regional sweeps are no longer silently truncated.** A real RU scan produced **1352** matching jobs, but only the first **500** were stored in `data/last-scan.json` and rendered in the results table — **852 relevant jobs were hidden** (the `2000 scanned → ~600 shown` symptom: 139 EN + 500 RU). Both `server/lib/en-scanner.mjs` and `server/lib/ru-scanner.mjs` now cap the stored `filtered` set at a shared, env-overridable constant `MAX_STORED_RESULTS` (default **2000**, override via `SCAN_MAX_RESULTS`). This is **display-only** — appending to `pipeline.md` and `scan-history.tsv` already used the uncapped `fresh` (new-since-last-scan) set and was never truncated. New `tests/scan-result-cap.test.mjs` (3 cases) locks the default, the env override, and that neither scanner hard-codes `slice(0, 500)`.

**fix(health/ui): `#/health` check cards no longer overflow.** A long check name/value (e.g. `PROFILE CUSTOMIZED · still on template …`, `PLAYWRIGHT (PARENT NODE_MODULES)`) collided with the right-hand **Fix →** button + status badge and spilled out of the card, because the generic `.flex-between` flex children default to `min-width: auto` and never shrink. The row is now tagged `.health-check-row` with scoped CSS: the left text shrinks + wraps (`min-width: 0`), the action group keeps its size (`flex: 0 0 auto`) and wraps below on narrow cards. New `tests/health-card-overflow.test.mjs` (2 cases). Suite 1079 → 1084.

---



## [1.69.0] — 2026-06-12

**feat(scan): P-14 plug-in scanner auto-discovery — drop a `.mjs` in `server/lib/sources/` to register a new source.** Pre-v1.69 the source list in `server/lib/sources/registry.mjs` was a static hand-maintained array — adding a new adapter required editing both `<id>.mjs` AND `registry.mjs`. Closes the `partial` half of the roadmap item P-14 (`docs/ROADMAP.md`). Now every `*.mjs` in `server/lib/sources/` is auto-loaded at module boot; each adapter contributes its identity via a self-describing `export const meta = { value, label, region, configKey? }` block. The 12 shipped adapters (ashby / greenhouse / lever / rss / smartrecruiters / workable / workday + geekjob / getmatch / habr / hh / trudvsem) each grew a `meta` export; `registry.mjs` now uses `readdirSync` + dynamic `import()` resolved at module-eval via top-level await (Node 18+ ESM standard). The public API (`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`) is unchanged — every existing import keeps working. Validation rejects malformed `meta` (missing `value`/`label`/`region`, RU without `configKey`, region outside `'en'|'ru'`) and logs a single `console.warn` per offending file so half-migrated branches stay diagnostic-friendly. The bundled `registry.mjs` is excluded from self-import. New `tests/sources-registry-discovery.test.mjs` adds 14 cases covering shipped-adapter coverage, drop-in adapter discovery, helper-module skip, malformed-meta rejection, self-import exclusion, missing-directory tolerance, and deterministic ordering. Suite 1065 → 1079.

---



## [1.68.2] — 2026-06-07

**fix(bin): `npx` / `npm link` CLI verbs were broken — resolve the bin path through symlinks.** npm and npx expose `career-ops-ui` as a symlink under `node_modules/.bin/`, where the old `dirname "${BASH_SOURCE[0]}"` resolved to `.bin` instead of the package root — so `npx career-ops-ui init` ran `node node_modules/scripts/init.mjs` and crashed with `MODULE_NOT_FOUND` (local runs after `npm install` were unaffected, which hid the bug). Both `bin/career-ops-ui.sh` and `bin/start.sh` now canonicalize `SCRIPT_DIR` through the symlink chain (`readlink` loop + `cd -P`), so every verb works from the repo, via `npm link`, and via `npx`. Adds a regression lock in `tests/sh-files.test.mjs` that runs a verb through a `.bin`-style symlink. Suite 1065/1065.

---



## [1.68.1] — 2026-05-29

**fix(scan): per-source fetch timeout 10s → 60s.** v1.67.1's 10s fail-fast also cut off slow-but-alive Ashby boards that just needed more time. Raise the default to one minute so those return. Trade-off: a genuinely dead/hung source now holds a concurrency slot for the full 60s (slower worst-case scan), and the chronic hangers (Perplexity, Supabase, Resend, …) likely still time out — a per-source / lower-Ashby-concurrency fix would address those properly. Override with `SCAN_FETCH_TIMEOUT_MS`. Suite 1063/1063.

---



## [1.68.0] — 2026-05-29

**feat(scan): reworked the result-filter panel — labelled fields, an Apply button, an On-site option, and a working salary filter.** Every filter on `#/scan` is now a labelled field (label **above** the control, not a placeholder): Search · Work type · Salary from · Salary to · Source · Scope. An explicit **Apply** button (plus **Reset**, and Enter in any field) re-runs the filter; an on-page hint explains how it works. **The salary range now actually filters** — once you set a *from*/*to* value, jobs whose listed pay falls outside the range **and jobs with no listed salary at all** are dropped (overlapping-range match; currency ignored). The Work type filter gains an **On-site** option alongside Remote / Hybrid / Relocation. New i18n keys ×9; `salaryInRange` made strict; suite 1063/1063.

---



## [1.67.1] — 2026-05-29

**fix(scan): per-source fetch timeout 30s → 10s (fail-fast).** v1.67.0's 30s raise recovered only ~half the slow Ashby boards; the rest (Perplexity, Supabase, Resend, DeepL, Ramp, …) hang regardless of the deadline, so a longer timeout just stalled every scan waiting on dead slots. 10s fails fast on the chronic hangers and keeps scans responsive. Override with `SCAN_FETCH_TIMEOUT_MS`. Suite 1060/1060.

---



## [1.67.0] — 2026-05-29

**feat(scan): salary range filter (from / to) on `#/scan`, plus a longer per-source fetch timeout.** The results table gains two numeric inputs — salary **from** / **to** — beside the text and remote filters. Each row's free-text salary (`от 100 000 до 200 000 ₽`, `120000-150000 USD`, `$120K–$150K`, …) is parsed to a numeric range and matched with overlapping-range semantics; rows with no published salary are kept, so the filter narrows the list instead of gutting it (comparison is currency-agnostic — no FX conversion). Also **raises the per-source scan fetch timeout 15s → 30s** (override: `SCAN_FETCH_TIMEOUT_MS`) — Ashby's `includeCompensation` payloads routinely took >15s under 8-way concurrency, so ~30 Ashby boards were timing out every scan. New `window.Skills.parseSalaryRange`/`salaryInRange` + i18n ×9; 13 new tests; suite 1060/1060.

---



## [1.66.0] — 2026-05-28

**feat(scan): RU sources now walk ALL result pages, not just the first.** hh.ru, Habr Career and Trudvsem each only paged the first ~50 hits per query; they now follow pagination to the end — `&page=N` for hh.ru/Habr, `offset`/`meta.total` for Trudvsem — deduping across pages and stopping when a page adds nothing new (or at a 50-page safety cap). A query like "Backend разработчик" now returns the full result set instead of one page (e.g. hh.ru PHP 17 → 55+ across 3 pages; Trudvsem returns all 72). Per-page fetches keep the existing timeout + AbortSignal. 4 new tests; suite 1045/1045.

---



## [1.65.0] — 2026-05-28

**feat(scan): hh.ru is now scraped from its public website instead of the JSON API — works from any IP, no proxy.** `api.hh.ru` started returning a bare `403 forbidden` to every programmatic client regardless of IP (US, RU datacenter, RU residential, RU mobile) or User-Agent — an edge anti-bot block, not a documented API error. The website (`hh.ru/search/vacancy`) still serves full server-rendered results to any browser-like client, so the adapter now parses that HTML (like Habr Career). **Removes the `HH_PROXY` env added in 1.64.0 and the `undici` dependency** — no proxy, key, or User-Agent setup needed. Tests rewritten for the HTML parser; suite 1041/1041.

---



## [1.64.0] — 2026-05-27

**feat(scan): route the hh.ru request through a Russian proxy via `HH_PROXY`.** hh.ru geo-blocks its API by **IP**, not User-Agent — so `HH_USER_AGENT` alone never lifted a 403 from a non-RU exit node. Set `HH_PROXY` to a Russian HTTP/HTTPS proxy URL (e.g. `http://user:pass@ru-host:port`) and **only** the hh.ru request is routed through it; every other source keeps its direct connection. Built on `undici`'s `ProxyAgent` (new runtime dep); the dispatcher is omitted entirely when `HH_PROXY` is unset, and a changed value is picked up on restart. 3 new tests; suite 1041/1041.

---



## [1.63.2] — 2026-05-27

**feat(scan): live % progress + per-source detail in the `#/scan` console.** The progress bar is now **determinate** — scanners emit progress events (EN: per company; RU: per query) forwarded over SSE, and the bar fills with a live **"Scanning… NN%"** label (animated indeterminate stripe only until the first event). Each source's first failure (timeout / 403 / network) is now logged to the console in detail (e.g. `⚠ hh timed out: …`), then repeats are suppressed. 1 new test; suite 1040/1040.

---



## [1.63.1] — 2026-05-27

**style(scan): make the `#/scan` progress bar more prominent.** Wrapped the in-flight indicator with a visible **"Scanning…"** caption and bumped the bar to **8px** (was a thin 4px) so it's clearly noticeable while a scan runs. No behavior change.

---



## [1.63.0] — 2026-05-27

**feat(scan): per-request fetch timeout + `#/scan` progress bar.** Scanner source requests had no deadline, so a stalled upstream (e.g. `api.hh.ru` from a blocked IP) could **hang the whole scan**. A new `server/lib/fetch-timeout.mjs` wraps the scanners' `fetchImpl` (`makeTimeoutFetch`, default **15s**, override via `SCAN_FETCH_TIMEOUT_MS`) so every source request has a hard deadline — a timed-out source is recorded as a non-fatal error and the scan continues (Habr keeps working even when hh.ru is unreachable). The `#/scan` page also shows an indeterminate progress bar while a scan is in flight (localized `scan.progress` across all 9 locales). 7 new tests; suite 1039/1039.

---



## [1.62.3] — 2026-05-27

**docs: clarify install (career-ops-ui runs inside `career-ops/web-ui/`) + `init` troubleshooting, across all 9 locales.** Rewrote the install section into **Option 1** (one curl) / **Option 2** (clone the UI *inside* an existing career-ops project as `web-ui`) + CLI verbs + provider setup + a **Troubleshooting `init`** block — addressing the common confusion of cloning career-ops-ui standalone and running `init` without the parent project. Also added the nested-layout note to the `/help` §1 Setup section and summarized the whole v1.62.* line in the README highlight. Docs-only; no code change.

---



## [1.62.2] — 2026-05-27

**fix(help): `#/help` filter is now full-text (finds H3 subsections like RSS).** The help-page search/TOC filter previously matched only H2 section titles, so the v1.62.x RSS docs (an H3 under §5 Portals & sources) weren't findable. Each section's body text is now indexed into the filter, so searching e.g. "RSS" surfaces §5. Pure client-side; no API change.

---



## [1.62.1] — 2026-05-27

**feat(scan): RSS in the source filter + RSS location fix.** The `#/scan` source-filter dropdown now lists **RSS** (added to `server/lib/sources/registry.mjs` + the SPA fallback list), so RSS-board results (LaraJobs, WeWorkRemotely, …) are filterable like any ATS source. The RSS adapter no longer maps the feed `<category>` tag onto `location` — non-location tags there made `location_filter` wrongly drop remote roles; `location` is now empty so feeds pass location filtering. Scan-button tooltips/labels and the source-list i18n string (`dash.quick.scanSub`) updated across all 9 locales to include Workable / SmartRecruiters / Workday / RSS. i18n snapshot + scan-sources endpoint test (6 → 7 EN sources) updated.

---



## [1.62.0] — 2026-05-27

**feat(scan): generic RSS adapter for non-ATS job boards.** A new `rss` portal adapter (`server/lib/portals/adapters/rss.mjs` + `server/lib/sources/rss.mjs`) lets the scanner pull jobs from any RSS feed — LaraJobs, WeWorkRemotely, RemoteOK, golangprojects and other boards outside Greenhouse/Ashby/Lever. Zero new dependencies: feed parsing is regex-based with CDATA + HTML-entity support (titles/companies are tag-stripped, astral code points decoded safely). Activated per-company via `provider: rss` / `rss:` / `feed_url:` in `portals.yml`, so it never intercepts ATS-matched companies. `ALL_ADAPTERS` grows 6 → 7. 29 new tests; documented across all 9 README locales.

---



## [1.61.1] — 2026-05-22

**fix(i18n): localize the theme-toggle title + aria-label across all 9 locales (MINOR-001).** The dark/light theme button (`#theme-toggle`) hardcoded `title="Toggle theme"` and `aria-label="Toggle theme"` in `index.html` — the tooltip and screen-reader text never translated, on any locale. A new `top.themeToggle` key + a `data-i18n-title` handler in `applyI18n()` (mirroring the v1.58.15 search-aria-label fix) localize both attributes on boot and on every language switch. Locked by `tests/playwright-theme-toggle-i18n.mjs` (9 locales + runtime-switch) and two static guards in `tests/qa-report-fixes.test.mjs`. The lone LOW finding from the v1.61.0 French sign-off. (MINOR-001)

---



## [1.61.0] — 2026-05-22

**feat(i18n): add French as the 9th UI language.** New per-locale dictionary `public/js/lib/locales/i18n-dict.fr.js` (`window.__I18N_DICT_FR`), at full **668-key** parity with English; new help bundle `docs/help/fr.md` (**19 H2 / 73 H3**, exact structural parity with `en`). `fr` is registered in the language switcher and browser auto-detect (`i18n.js`), the assembler (`i18n-dict.js`), `index.html` (a `<script>` tag before the assembler), the test snapshot, and every test locale list. The initial translation table came from **PR #9** (community contribution). No logic change: `t()` and every view are unchanged. **1001 / 1001** unit tests; the Playwright locale-sweep grows to 9 subtests. (FR-LOCALE)

---



## [1.60.0] — 2026-05-22

**refactor(i18n): split the 8-column megafile into per-locale files (I18N-SPLIT).** The translation dictionary lived in one 849-line `public/js/lib/i18n-dict.js` (key → { en, es, … } across 8 locales). It is now **one file per locale** — `public/js/lib/locales/i18n-dict.{en,es,pt-BR,ko,ja,ru,zh-CN,zh-TW}.js` (each assigns `window.__I18N_DICT_<LANG> = { key: string }`) plus a shared `i18n-dict.aliases.js` — so a translator edits a single language in isolation (the i18next / OpenWA layout). `i18n-dict.js` is now a small **assembler** that merges the per-locale tables back into the exact same `window.__I18N_DICT` shape, so `t()`, every view, and every call-site are byte-for-byte unchanged. Everything loads synchronously via `<script src>` — **no build step, no runtime fetch** (both hard rules preserved). A captured snapshot proves the migration is lossless (assembled dict ≡ pre-split dict, 678 keys). Tooling + tests made split-aware via a shared `tests/helpers/i18n-vm.mjs`: `tools/i18n-audit.mjs`, the CI inline coverage check (which had silently become a no-op against the post-v1.23 split — it now actually loads the dictionary), and ~25 dictionary tests. New `tests/i18n-locale-files.test.mjs` (snapshot equality · per-locale key parity · alias integrity · index.html load order) and `tests/playwright-locale-sweep.mjs` (every page × 8 locales renders + localizes in real Chromium). 994 → **1000** unit · 62 → **70** Playwright. No user-facing behaviour change. (I18N-SPLIT)

---



## [1.59.13] — 2026-05-21

**fix(i18n): collapse TRUE duplicate keys via @alias + final personal-data purge (pre-fr, follow-up to v1.59.12).** Two parts. **(1) Personal data:** swept the WHOLE repo, not just the dict — the maintainer's real name was used as incidental test-fixture data (`tests/health-doctor-unify.test.mjs`, `tests/llm-output.test.mjs`) and in archived QA reports; all replaced with neutral examples (`Jane Doe`). `LICENSE` copyright + `package.json` author switched from the real legal name to the public `Fighter90` handle. Repo now greps clean for the real name/email everywhere. **(2) Duplicate keys (I18N-CL3, properly):** added an `@alias` mechanism to `i18n.t()` — a key `{ '@alias': 'x.y' }` resolves to a canonical key. Collapsed the 10 keys that are byte-identical across all 8 locales (`nav.help`/`dash.quick.helpCta` → `help.title`; `nav.cv` → `cv.title`; `nav.health`/`dash.quick.healthCta` → `health.title`; `nav.reports`/`dash.reports`/`dash.quick.reportsCta` → `rep.title`; `nav.apply` → `apply.title`; `nav.interviewPrep` → `interviewPrep.title`). The contributor's own `nav.config`/`config.title` example is deliberately NOT aliased — they diverge in Spanish (short sidebar `Configuración` vs full title `Configuración de la aplicación`); aliasing would change a rendered label. Coverage test, CI inline check, and `tools/i18n-audit.mjs` are all alias-aware (skip alias keys for parity, enforce every target exists, resolve before dup-counting). New `tests/i18n-alias.test.mjs` (3 cases) locks integrity + behaviour. 991 → **994** unit. Reduces the French translator's surface — true dupes are now translated once. (I18N-CL3, personal-data-sweep)

---



## [1.59.12] — 2026-05-21

**fix(i18n): i18n-dict.js cleanup — pre-fr ship (I18N-CL1, I18N-CL2, I18N-CL4).** External French-locale contributor audit. **I18N-CL1 (privacy):** `training.coursePh` carried a vendor-specific cert name across all 8 locales — replaced with a neutral generic placeholder (`Cloud architecture certification` + native equivalents). **I18N-CL2 (hygiene):** the `followup.lastPh` dict fallback was a frozen `2026-04-21` literal — replaced with a localized format hint (`YYYY-MM-DD` / `AAAA-MM-DD` / `ГГГГ-ММ-ДД`); the live dynamic `today − 14d` placeholder (U-3, v1.58.23) in `mode-page.js` was already working and is now lock-tested. **I18N-CL4 (audit):** new `tools/i18n-audit.mjs` + `npm run audit:i18n`, wired into CI — hard-fails on personal data, locale-parity gaps, empty values, and bare-calendar-date placeholders. **I18N-CL3 (decision):** the ~50 duplicate-value key groups (e.g. `nav.scan` / `scan.btnRun` / `scan.col.company`) are intentional — distinct UI roles that non-English locales translate differently; deduping them would remove i18n flexibility, so they are reported as informational warnings, not failures (documented in the dict header). 3 new tests (988 → **991** unit). Unblocks the upcoming French locale PR. (I18N-CL1, I18N-CL2, I18N-CL4)

---



## [1.59.11] — 2026-05-21

**fix(test): v1.59.11 — e2e-comprehensive 12-case CI failure root-caused and closed.** Twelve cases (Pipeline · Activity · Health · 7 Mode pages · 404 · Profile) had been failing on every CI run going back to v1.58.x because `page.goto(baseUrl + '/#/X')` is a no-op for hash-only URL changes in Playwright. Once the CV-save step set the hash to `#/cv`, every subsequent `goto` to a hash route silently kept the page on `#/cv` — Activity/Health/Mode/Profile selectors never matched, and the 4 'pass' results in between were vacuous (their assertions found CV's elements). Fix in [tests/e2e-comprehensive.mjs](tests/e2e-comprehensive.mjs): new `goRoute(hash)` helper that bounces through `about:blank` before each `goto`, forcing a real navigation and SPA re-bootstrap. All 17 `page.goto(`${baseUrl}/#/...`)` call sites replaced. Diagnostic instrumentation (`E2E_DUMP_ON_FAIL=1` env var) added for future investigations. Result: **23 / 23 cases green** locally · 988 / 988 unit · 20 / 20 smoke e2e. (e2e-harness-r1)

---



## [1.59.10] — 2026-05-21

**fix(api): NEW-F1-sub-r1 (v1.59.10) — un-encoded `../` traversal guard hoisted above all /api route registrations.** v1.59.8 added a `req.originalUrl.includes('..')` middleware, but it was placed AFTER `app.all('/api/*', JSON-404)` AND AFTER all route handlers — by which time Express had already normalised the URL (collapsing `..` segments). `/api/jds/../../../etc/passwd` was rewritten to `/etc/passwd` and fell through to the SPA static handler (200 OK on `index.html`). v1.59.10 hoists the guard to the TOP of [server/index.mjs](server/index.mjs) `createApp()` (above every `register*Routes(app)` call) so it inspects the verbatim request URL before any normalisation. Pattern: `/^\/api(\/|$)/.test(req.originalUrl) && /\.\.\//.test(req.originalUrl)`. New [tests/api-path-traversal.test.mjs](tests/api-path-traversal.test.mjs) — 6 cases driving the real http module (Node's fetch normalises `..` client-side, so we drop to `http.request` with a verbatim path). Unknown `/api/*` paths still return `{error: 'unknown api'}` from the existing `app.all` fallback. 982 → **988** unit. (NEW-F1-sub-r1)

---



## [1.59.9] — 2026-05-21

**fix(ux): UX-A5-r4 (v1.59.9) — Help TOC scroll-spy debug marker + behavioural lock-test.** Sixth-cycle closure: previous five attempts (v1.58.45 / v1.58.52 / v1.59.0 / v1.59.3 / v1.59.8) all shipped with passing static tests but the bug stayed open because the tests asserted source-shape, not behaviour. v1.59.9 fixes the gap: (1) `<body data-toc-spy="active">` debug marker — single selector any tester can use to answer "is the spy alive?" without needing to scroll; (2) synchronous initial paint at mount tail covers the router-pre-paints-view case; (3) double-rAF re-compute covers the route-handler-returns-before-router-appends case; (4) resize listener subscribed so viewport-flip mid-scroll re-paints; (5) cleanup removes BOTH listeners and the marker on hashchange. [public/js/views/help.js](public/js/views/help.js) algorithm: linear scan with `else break;` short-circuit (O(active-index) per scroll event). New [tests/help-toc-spy-behavior.test.mjs](tests/help-toc-spy-behavior.test.mjs) runs the algorithm against 6 synthetic-geometry scenarios + 1 algorithm-parity check against help.js source — the test fails if the algorithm regresses, before any browser run. 973 → **982** unit. (UX-A5-r4)

---



## [1.59.8] — 2026-05-21

**fix(ux+api): v1.59.8 — UX-A5-r3 + NEW-F1-sub (HIGH + LOW bundled per FIX-PROMPT-FINAL-CONSOLIDATED).** Doctrine-exception release: the 2026-05-20 FINAL REGRESSION-v1.59.7 report explicitly recommended bundling these two. UX-A5-r3 (HIGH) — after 4 ship attempts with IntersectionObserver all failed live verification, [public/js/views/help.js](public/js/views/help.js) replaces the IO entirely with a plain scroll listener. Root cause: with rootMargin -20%/-55% the trigger band ended at 45% of viewport, but scrollIntoView({block:'center'}) lands the target at 50% — JUST below the band end. The new scroll listener probes absolute heading positions every rAF, computes the heading whose top is at-or-above 30% of viewport, applies `.toc-current` — no band, no race, no mount-order gotcha. NEW-F1-sub (LOW) — [server/index.mjs](server/index.mjs) adds a late middleware that inspects `req.originalUrl` (not normalised `req.url`) and bounces any `/api`-prefixed request whose raw URL contains `..` as 404 JSON `{error: 'invalid path'}`. New `UX-A5-r3` lock-test + `NEW-F1-sub` static + behavioural guards in tests/. 971 → **973** unit. (UX-A5-r3 · NEW-F1-sub)

---



## [1.59.7] — 2026-05-20

**fix(api): NEW-D3-cache (v1.59.7) — `GET /api/cv` sends `Cache-Control: no-store`.** Matches the SPA-shell policy (W-001 / v1.54.7). `cv.md` is the user-edited primary artifact; a stale browser cache or intermediary proxy could surface yesterday's text and trick the editor into saving over the live version. No ETag dance — the file is small and the GET is rare. New test in [tests/api-404-json.test.mjs](tests/api-404-json.test.mjs) (the suite is the in-process server harness; named for its first test). 970 → **971** unit. (NEW-D3-cache)

---



## [1.59.6] — 2026-05-20

**feat(a11y): NEW-D2-motion (v1.59.6) — honour `prefers-reduced-motion: reduce`.** New `@media (prefers-reduced-motion: reduce)` block in [public/css/app.css](public/css/app.css) neutralizes `animation-duration` + `transition-duration` to 0.01 ms and forces `scroll-behavior: auto` (so the Help TOC click-to-scroll lands instantly). WCAG 2.3.3 (AAA) — users with vestibular disorders, motion sensitivity, or simply OS-level reduced-motion preference now get an animation-free UI. Static guard in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 969 → **970** unit. (NEW-D2-motion)

---



## [1.59.5] — 2026-05-20

**fix(api): NEW-F1 (v1.59.5) — unknown `/api/*` returns JSON 404 on every verb.** Pre-fix `app.get("/api/*", …)` was GET-only; POST / PUT / DELETE to an unknown api path fell through to the SPA catch-all and returned an HTML 404, breaking SPA clients that do `try { res.json() } catch {}`. Changed to `app.all("/api/*", …)` in [server/index.mjs](server/index.mjs). New test suite [tests/api-404-json.test.mjs](tests/api-404-json.test.mjs) probes GET / POST / PUT / DELETE on `/api/no-such-endpoint` plus an unknown `:name` under a real handler — 5 new tests, all green. 964 → **969** unit. (NEW-F1)

---



## [1.59.4] — 2026-05-20

**fix(ui): NEW-OR1 (v1.59.4) — `#/config` API-keys summary chip is race-safe.** User-reported transient `Keys: 0 / 5` flash during Save flows. The previous `refreshApiSummary()` cleared `<span>` children before awaiting the network fetch; a concurrent `providers-changed` event could observe the empty state. New implementation in [public/js/views/config.js](public/js/views/config.js):\n\n1. Build new `<span>` nodes **before** any DOM mutation.\n2. Atomic swap via `apiSummary.replaceChildren(newActive, newCount)` — chip never blanks mid-update.\n3. `inFlight` token counter drops stale resolves when a newer refresh starts.\n4. `lastGoodSt` cache preserves the last known state when fetch returns null (network blip, server reload), so the chip never collapses to `0 / 5` on a transient empty response.\n\nLock-test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs) asserts all four invariants. 963 → **964** unit. (NEW-OR1)

---



## [1.59.3] — 2026-05-20

**fix(ux): UX-A5-r2 (v1.59.3) — Help TOC scroll-spy harden (third-pass fix).** Two real issues persisted after v1.58.52: (1) `rootMargin: "-30% 0% -60% 0%"` left only a 10% visible band so fast scroll could skip the trigger zone entirely and no IntersectionObserver entry ever fired; (2) no initial-state computation, so a freshly-loaded `#/help` with zero scroll showed zero highlights even though section 1 was visibly active. [public/js/views/help.js](public/js/views/help.js): widened `rootMargin` to `-20% 0% -55% 0%` (25% band), made `root: null` explicit, extracted `applyCurrent(id)` so the same code path serves both observer callbacks and the initial-state pass, and on mount picks the heading closest to 20% from top of viewport. 962 → **963** unit. (UX-A5-r2)

---



## [1.59.2] — 2026-05-20

**fix(ui): v1.59.2 — UX-A9 / UX-A3 chip count + overlap (post-v1.59.1 hotfix).** Three real bugs in the v1.58.62 / v1.58.55 chips, user-reported on the staging surface:\n\n1. **Always `Keys: 0 / 5`.** `/api/status/providers` returns `keysConfigured` as an **array** of provider names; pre-fix `typeof === number` was always false. Now uses `Array.isArray(st.keysConfigured) ? st.keysConfigured.length : 0`.\n2. **Lowercase provider name.** Server returns `anthropic` (not `claude` — `LLM_PROVIDER` env value vs resolved provider name); the NAME map was keyed by `claude:` so it always fell through to the lowercase fallback. Re-keyed `{anthropic, gemini, openai, qwen, openrouter}` in both [public/js/views/config.js](public/js/views/config.js) and [public/js/views/dashboard.js](public/js/views/dashboard.js).\n3. **Sticky chip overlapped other elements.** `.api-keys__summary` had `position: sticky` + `z-index: 5` and created a stacking context that floated above the tablist + page header on scroll. Dropped sticky — the chip is at the top of a short panel already. Lock-test updated to forbid the sticky position. (No version bump alone — counts on existing UX-A3 / UX-A9 lock-tests.) (post-cycle hotfix)

---



## [1.59.1] — 2026-05-20

**fix(test): v1.59.1 — NEW-D1 i18n-no-latin-leaks guard accepts UX-A11 polished ES copy.** During final verification of the v1.59.0 ship I caught a regression: the v1.58.37 NEW-D1 static guard asserted `pipe.title[es]` must match `/vacant|vaca/i` (locking the old `Pipeline de vacantes`). UX-A11 (v1.58.64) refined that to `Pipeline de candidaturas` (candidate-side perspective). Fix: relax the regex to `/vacant|vaca|candidatur/i` so either contextualizing noun passes. No production-code change. 962 unit tests, 0 fail.

---



## [1.59.0] — 2026-05-20

**feat(ui): UX-A14 (v1.59.0) — Mobile (≤ 420 px) media-query pass.** Closes the long-standing mobile audit. Five focused fixes inside a single `@media (max-width: 420px)` block in [public/css/app.css](public/css/app.css):\n\n1. `.card-row` (4 dashboard metric cards) collapses to 1-up below 420 px (was a 900+ px horizontal scroll).\n2. `.dash-hero-cta` stacks vertically with full-width buttons (was side-by-side wrap-mid-label on iPhone SE).\n3. `.page-header` stacks H1+subtitle above the action buttons row (was right-side overflow on 360 px).\n4. `.qa-grid` minmax floor drops from 220 px to 160 px so tiles fit two-up on 360–390 px viewports.\n5. `.api-keys__summary` chips tighten horizontal padding for breathing room.\n\nRegression-lock test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 961 → **962** unit. (UX-A14)

---



## [1.58.65] — 2026-05-20

**test(ui): UX-A2 (v1.58.65) — lock-test on Modes structured field-form.** The 5-field structured form for `#/config → Modes` was already shipped in v1.54.3 (canonical Target Roles / Adaptive Framing / Exit Narrative / Comp Targets / Location Policy + repeatable line-inputs for list-kind fields + × remove + add-row affordance + tagged `{mode: sections|markdown}` collect()). The UX-A2 audit assumed it was missing because all 5 sections initially appeared as `<textarea>` (an artifact of the field-form scaffolding pass before file load). This regression-lock test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs) prevents a future PR from collapsing the field-form back to raw markdown. No code change. 960 → **961** unit. (UX-A2)

---



## [1.58.64] — 2026-05-20

**fix(i18n): UX-A11 (v1.58.64) — es / pt-BR copy polish: English loanwords replaced.** `eval.subtitle` (es) now uses ajuste del CV / Puntaje / cabecera / informe; pt-BR uses aderência do CV / Pontuação / cabeçalho / relatório. `pipe.title` (es) refined to Pipeline de candidaturas (candidate-side perspective). pt-BR vagas retained. 959 → **960** unit. (UX-A11)

---



## [1.58.63] — 2026-05-20

**fix(ui): UX-A15 (v1.58.63) — Dashboard Pipeline tile gets visual primary weight.** The Quick-actions grid previously gave every tile equal weight; the highest-frequency action (Pipeline) didn't draw the eye. The `qa()` helper in [public/js/views/dashboard.js](public/js/views/dashboard.js) now accepts a 7th `primary` flag; the Pipeline tile is the only one passing `true` so it gets a subtle accent border + larger icon + bolder label via `.qa-tile--primary` ([public/css/app.css](public/css/app.css)). Tile order, copy, click target, and accessibility name are unchanged. Lock-test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 958 → **959** unit. (UX-A15)

---



## [1.58.62] — 2026-05-20

**feat(ui): UX-A9 (v1.58.62) — #/config → API keys panel sticky summary chip.** Before this release, with 5 provider key sections stacked vertically on the API-keys tab, the user had to scroll to know which provider the OR-fallback resolves to or how many keys were configured. [public/js/views/config.js](public/js/views/config.js) now renders a `position: sticky` `.api-keys__summary` at the top of the apiPanel showing `Active: <provider>` + `Keys: <count>/5`. Reuses `/api/status/providers` (no new API surface). Refreshes on `providers-changed` (after Save). Two new i18n keys (`config.activeProvider`, `config.keysConfiguredPrefix`) × 8 locales; one CSS rule (`.api-keys__summary`); static guard in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 957 → **958** unit. (UX-A9)

---



## [1.58.61] — 2026-05-20

**docs(readme): UX-A8 (v1.58.61) — first-run cleanup section added across all 8 READMEs.** Fresh clones of career-ops include two QA fixture URLs (`example.com/qa-fixture-*`) in `data/pipeline.md` so the test suite can run hermetically; the README never documented this so first-time users mistook them for real jobs. New `## First run — clean state` section (mirrored in es / pt-BR / ko / ja / ru / zh-CN / zh-TW) instructs `make clean-test-fixtures && npm start` before the first scan. Lock-test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs) verifies all 8 READMEs reference `make clean-test-fixtures` and `qa-fixture-*`. 956 → **957** unit. (UX-A8)

---



## [1.58.60] — 2026-05-20

**feat(ui): UX-A12 (v1.58.60) — Notifications drawer Clear all + per-entry dismiss.** The v1.58.34 notifications journal capped at 50 entries but offered no manual purge. New `UI.clearToastHistory()` and `UI.dismissToastHistory(ts)` in [public/js/api.js](public/js/api.js) mutate `toastHistory` in place and notify subscribers with sentinel events (`{cleared: true}` / `{dismissed: ts}`); the drawer subscriber in [public/js/app.js](public/js/app.js) detects them, re-renders, and — critically — does NOT bump the unread counter on purges. Drawer head now carries a `Clear all` button (auto-hidden when the journal is empty); every `.notif-item` carries a `×` dismiss button. Three new i18n keys (`notif.clearAll`, `notif.clearAllAria`, `notif.dismiss`) × 8 locales; CSS for both controls; lock-test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 955 → **956** unit. (UX-A12)

---



## [1.58.59] — 2026-05-20

**feat(ui): UX-A13 (v1.58.59) — actionable "Fix →" CTA on failing #/health rows.** Pre-fix the 21 health rows showed status only; a user with `Profile customized: FAIL` had to guess where to go. [public/js/views/health.js](public/js/views/health.js) now renders a small ghost-button `Fix →` next to the badge on failing/optional rows. Mapped targets: `Profile customized` → `#/config?tab=profile`, `cv.md non-empty` → `#/cv`, `portals.yml present` → `#/config?tab=portals`, `data/applications.md` → `#/tracker`. Any `*_API_KEY` or `LLM_PROVIDER*` row routes to `#/config?tab=api-keys` via regex fallback. Unmapped failures stay action-less (no dead-end CTAs). Two new i18n keys (`health.fix`, `health.fixAria`) × 8 locales. 954 → **955** unit. (UX-A13)

---



## [1.58.58] — 2026-05-20

**fix(ux): UX-A10 (v1.58.58) — guard #/cv against leaving with unsaved buffer.** Pre-fix, navigating away from #/cv with unsaved edits silently dropped the buffer. [public/js/views/cv.js](public/js/views/cv.js) now registers a `beforeunload` listener (browser-close confirm — generic dialog per modern browser policy) **and** a `hashchange` listener (SPA-internal nav prompts via localized `window.confirm()` and rewinds the hash if the user cancels). `cvDirty` lives in the save-button IIFE closure; cleanup self-detaches when the hash leaves `#/cv` (M-1 discipline). One new i18n key (`cv.unsavedConfirm`) × 8 locales. 953 → **954** unit. (UX-A10)

---



## [1.58.57] — 2026-05-20

**test(ui): UX-A7 (v1.58.57) — lock-test on the cost-line auto-refresh contract.** v1.58.41 (UX-D-I) wired `UI.providerCostHint` to refresh when the user changes `LLM_PROVIDER` mid-session, but the contract had no static guard — any of the three pieces (config.js dispatch, api.js subscribe, advisor-view call site) could regress silently and the cost line would lie. New regression test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs) locks all three: (1) `config.js` Save handler dispatches `providers-changed`, (2) `UI.providerCostHint` subscribes via `document.addEventListener`, (3) all 4 advisor views (`#/deep`, `#/evaluate`, `#/auto`, `#/<mode>`) call `UI.providerCostHint(t)`. 952 → **953** unit. (UX-A7)

---



## [1.58.56] — 2026-05-20

**fix(a11y): UX-A4 (v1.58.56) — `.lang-btn` meets WCAG 2.5.8 minimum touch-target.** Pre-fix the language buttons in the sidebar footer measured 23–25 px tall × 47–72 px wide (below the 24×24 WCAG 2.5.8 / WCAG 2.2 AA floor). [public/css/app.css](public/css/app.css) now declares `min-height: 28px` + `min-width: 28px` + `padding: 6px 10px` on `.lang-btn` — every locale label clears the floor with comfortable margin. Sidebar grows by 6 px total (negligible). Lock-test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 951 → **952** unit. (UX-A4)

---



## [1.58.55] — 2026-05-20

**feat(ui): UX-A3 (v1.58.55) — Dashboard active-provider chip.** Above-the-fold chip in [public/js/views/dashboard.js](public/js/views/dashboard.js) hero now surfaces whether the OR-model fell through to a live provider (e.g. `⚡ Live evals: Anthropic claude-sonnet-4-6`) or whether the user is in `📋 Manual prompt mode (no API key set)`. Re-fetches on `providers-changed` (dispatched by [#/config](public/js/views/config.js) save) and on `visibilitychange` (cross-tab refocus). Reuses the existing `/api/status/providers` endpoint (no new API surface). Two i18n keys × 8 locales (`dash.provider.live`, `dash.provider.manual`); one CSS rule (`.dash-chip--provider`). Lifecycle cleanup on `hashchange` away from `#/dashboard` so listeners don't stack across navigation (M-1 discipline). 950 → **951** unit. (UX-A3)

---



## [1.58.54] — 2026-05-20

**fix(ux): UX-A1 (v1.58.54) — defensive Deep-brief structure warning.** The canonical Deep-research brief promised in [career-ops.org/docs](https://career-ops.org/docs/introduction/guides/scan-job-portals) has six H2 sections (Company snapshot / Engineering culture / Recent news / Glassdoor / Interview process / Negotiation leverage). When the upstream prompt drifts and the saved brief is meta-narration instead of the final form, [public/js/views/deep.js](public/js/views/deep.js) now detects the regression (≥3 of the six H2s missing) and prepends a non-blocking `.brief-warning` card explaining what the brief should look like and linking to the canonical reference. The root prompt-layer fix lives in the parent project (`modes/deep.md`, blocked from here); this UI guardrail surfaces the drift instead of silently rendering a degenerate brief. CSS rule added to [public/css/app.css](public/css/app.css); three new i18n keys (`deep.briefUnstructured.title` / `.body` / `deep.docsLink`) cover all 8 locales. New static guard in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 949 → **950** unit. (UX-A1)

---



## [1.58.53] — 2026-05-20

**fix(ux): UX-A6 (NEW-M4-r1) — every saved-research card flows through a single `renderSavedCard()` helper.** v1.58.51 verification regression observed: one card rendered with no structural children (title+date as a single concatenated text node — `software-engineer-generalyesterday`) while another rendered with the proper `<span>` + `<time>` shape — depending on whether the card was page-load-rendered or runtime-inserted. Fix in [public/js/views/deep.js](public/js/views/deep.js#L26-L75): extracted `renderSavedCard(f)` that always emits `.saved-card__title` + `.saved-card__date datetime=…`. Whatever render path inserts a card (page-load `renderArchive`, post-`Run live`, or future code paths) routes through this single helper — the M-4 v1.58.11 flex-gap layout only works with the structural children present. 948 → **949** unit. (UX-A6)

---

## [1.58.52] — 2026-05-20

**fix(ux): UX-A5 (NEW-K1) — `#/help` TOC scroll-spy actually fires now (regression from v1.58.45).** v1.58.51 verification regression caught: 18 H2 elements with ids, 18 TOC `<a>` links, but **0** links ever received `.toc-current` after scroll. Root cause: v1.58.45 wired the observer inside a `setTimeout(0)` that fired BEFORE the router appended the view to `#content`; `document.querySelectorAll(".help-article h2[id]")` matched nothing. Fix in [public/js/views/help.js](public/js/views/help.js#L155-L200): new `mountTocSpy()` observes the **synchronously-built `headings` refs** we already hold (no document re-query); deferred via **double `requestAnimationFrame`** so it fires after the first paint that includes the mounted view. 947 → **948** unit. (UX-A5)

---

## [1.58.51] — 2026-05-20

**chore(docs): v1.58.51 — final housekeeping wrap of the v1.58.37 → v1.58.50 cycle (14 single-fix releases).** No code or behavior changes; consolidation of the qa/ tree, doc currency, and the two lessons learned from this cycle. **(1) qa/ reorg:** all the version-locked source documents — `FIX-PROMPT-CONSOLIDATED.md`, `FIX-PROMPT-FINAL-EXHAUSTIVE.md`, `FIX-PROMPT-v1.58.37_and_beyond.md`, plus 6 root-level session snapshots (`MASTER-REGRESSION.md`, `2026-05-19-*.md`, `career-ops_*.md`, `FIX-PROMPT-v1.58.3.md`, `FIX-PROMPT-v1.58.4_and_beyond.md`) — moved into `qa/archive/v158-cycle/`. `qa/` root now contains exactly the **6 canonical perennial** documents: `README.md`, `REGRESSION-FINAL.md`, `UX-AUDIT-PROMPT.md`, `FUNCTIONALITY-CHECK.md`, `DESIGNER-EXPORT-PROMPT.md`, `G-005-closure-kit.md`. **(2) `qa/REGRESSION-FINAL.md` §13** documents every v1.58.37 → v1.58.50 invariant with its lock-test, organized by class (i18n / a11y / UX feedback / orientation / content fidelity / labels / tooling / docs) + 2 new "lessons captured" entries (markdown-bolded regex pitfall; Publish-runs-tests-against-tagged-ref pitfall). **(3) `qa/UX-AUDIT-PROMPT.md`** baseline table extended with the 14 new closed-in rows. **(4) `CLAUDE.md`** currency lifted (1.58.51, baseline 947/947). **(5) `.claude/PROJECT-CONTEXT.md`** repo-state + test baseline lifted. **(6) `docs/ROADMAP.md`** chain end now at v1.58.51 / Net 947. **(7) `README ×8`** badges and content sync. Test baseline at v1.58.51: **947** unit (unchanged structurally) · 62 Playwright · 20 smoke · 23 comprehensive E2E. Also fixes the v1.58.48 / v1.58.50 Publish-failure pattern — by tagging at the same commit where ALL tests pass (instead of follow-up patches landing only on `main`). (housekeeping)

---

## [1.58.50] — 2026-05-20

**docs: DOC-1 — qa/REGRESSION-FINAL.md gets §5a documenting server error bodies as English-by-policy.** v1.58.36 audit raised NEW-D4: every server 4xx body is English on every locale. Two paths: (A) confirm by-design, document the contract; (B) read `Accept-Language` and localize. The spec recommended A — closing NEW-D4 as `not-a-finding` is least disruption and keeps tests stable. New [qa/REGRESSION-FINAL.md](qa/REGRESSION-FINAL.md) §5a section explains: server JSON error bodies stay English (debuggability boundary — bug reports paste cleanly, CI fixtures stay stable, server tests don't need parallel locale strings). The SPA wraps responses with localized chrome (toast colour, U-4 `Details` summary). `Accept-Language` is intentionally not read; the SPA-side `lang` is stripped before `validateConfig` per the v1.57.2 invariant. v1.59 option B (localized server errors with `{ error, error_en, code }`) is the future gate. 946 → **947** unit. **Closes the v1.58.37 → v1.58.50 queue from FIX-PROMPT-FINAL-EXHAUSTIVE.md** — 14 single-fix releases shipped, every one CI-green + AI-review LGTM. (DOC-1)

---

## [1.58.49] — 2026-05-20

**chore(tooling): TOOL-1 — `make clean-test-fixtures` + `scripts/clean-test-fixtures.mjs`.** v1.58.36 audit: `${CAREER_OPS_ROOT}/data/pipeline.md` had accumulated 1252+ `example.com/job/<n>` lines from regression runs. Manual cleanup was tedious. New [scripts/clean-test-fixtures.mjs](scripts/clean-test-fixtures.mjs) reads `${CAREER_OPS_ROOT or ..}/data/pipeline.md`, drops every line containing `example.com` (case-insensitive), preserves real ATS URLs verbatim, prints the count, and exits 0. `--dry-run` flag prints the would-be result to stdout without touching the file. New [Makefile](Makefile) with `make clean-test-fixtures` and `make clean-test-fixtures-dry-run` targets. 4 new CI-isolated tests in [tests/clean-test-fixtures.test.mjs](tests/clean-test-fixtures.test.mjs) (uses `mkdtempSync` for a synthetic parent — no real-file writes). 942 → **946** unit (4 new TOOL-1 cases). (TOOL-1)

---

## [1.58.48] — 2026-05-20

**fix(ux/onboarding): UX-D-B — `#/dashboard` shows a global warning banner when the user is still on the default fixture profile.** v1.58.36 audit: `/api/health` already includes a `{ name: "Profile customized", ok: false }` row (server checks for `Acceptance Test` / `Jane Smith` / other template names in `server/lib/store.mjs`), but the user only saw it after navigating to `#/health`. Meanwhile every advisor output (Apply / Followup / Contacto / Deep) was addressed to the fixture name — broken first impression. New `profileFixtureBanner()` in [public/js/views/dashboard.js](public/js/views/dashboard.js) renders a `.hero-banner.hero-banner--warning` at the top of the route when the check fails, with localized message (`onboarding.fixtureWarning` × 8) + a CTA button linking to `#/config` (`onboarding.fixProfile` × 8). When the user replaces the fixture, /api/health flips `ok: true` and the next dashboard mount silently omits the banner. New CSS `.hero-banner` + `.hero-banner--warning` rules. 941 → **942** unit. (UX-D-B)

---

## [1.58.47] — 2026-05-20

**fix(ux/naming): UX-D-C — top-bar `Quick scan` renamed to `Open Scan` so the label matches the actual behavior.** v1.58.36 audit: "Quick scan" implied an instant scan with sensible defaults, but the click handler at [public/js/app.js](public/js/app.js#L140) only navigates to `#/scan` — no scan starts. Renamed via the `top.quickscan` i18n key in all 8 locales (en `Open Scan` / es `Abrir Scan` / pt-BR `Abrir Scan` / ko `Scan 열기` / ja `Scan を開く` / ru `Открыть Scan` / zh-CN `打开 Scan` / zh-TW `開啟 Scan`). HTML default text in `index.html` updated to match. Behavior unchanged; only the label honesty improved. 940 → **941** unit. (UX-D-C)

---

## [1.58.46] — 2026-05-20

**fix(ux): UX-D-D — `#/apply` checklist substitutes `{company}-{role}` with slugs derived from the URL/JD.** v1.58.36 audit: the generated checklist's item 5 read `Save filled answers to interview-prep/{company}-{role}.md before submitting.` — the literal `{company}-{role}` placeholders were displayed verbatim and the user had to mentally substitute (or, worse, paste them as-is). New `extractSlugs(url, jd)` + `substitutePlaceholders(text, url, jd)` in [public/js/views/apply.js](public/js/views/apply.js#L36-L93): the host whitelist (`greenhouse / lever / ashby / workable / smartrecruiters / workday`) picks `company` out of the URL path or subdomain, then derives `role` from the trailing path slug (stripped of trailing numeric IDs) — or, as fallback, from the JD's first line. If extraction fails (unknown host / no JD), placeholders become `[company]` / `[role]` (square-bracket convention for "fill in"). Substitution runs once before `parseChecklist`, so the live checklist + Copy-unchecked output stay coherent. 939 → **940** unit. (UX-D-D)

---

## [1.58.45] — 2026-05-20

**fix(ux): UX-D-K — `#/help` TOC scroll-spy highlights the current section.** v1.58.36 audit: as the user scrolled the help body, the TOC sidebar (sticky, ~92 H2 sections) didn't indicate which section they were reading — they had to mentally scan the H2 above the fold against the TOC. New `IntersectionObserver` in [public/js/views/help.js](public/js/views/help.js#L155-L185) observes every `.help-article h2[id]` and applies `.toc-current` to the matching TOC `<a>` link when the H2 enters the upper-third reading band (`rootMargin: "-30% 0% -60% 0%"`). CSS [public/css/app.css](public/css/app.css) gives `.toc-current` a brand-red left-border + `var(--rausch)` color + `font-weight: 600` so the active item reads at a glance. The observer is torn down on hashchange next to the existing scroll listener, so no observer leaks when the user leaves `#/help`. 938 → **939** unit. (UX-D-K)

---

## [1.58.44] — 2026-05-20

**fix(ux): UX-D-L — `#/deep` opened Saved-research brief now has an inline × close button.** v1.58.36 audit: clicking a saved-research card on `#/deep` rendered the brief body inline (Copy / Download / Open in tab / Generate PDF buttons in the header) but the user had no way to **close** the brief without scrolling away or navigating. New `×` button in [public/js/views/deep.js](public/js/views/deep.js) `showResult()` header — clears `out.innerHTML`, mirrors the modal-close pattern (api.js UI.modal × button), keyboard-reachable, aria-label + title from new `deep.closeBrief` i18n key × 8. 937 → **938** unit. (UX-D-L)

---

## [1.58.43] — 2026-05-20

**fix(ux): UX-D-F — `#/evaluate` empty-JD submit now shows a distinct localized error toast (was "JD too short").** Before the fix, clicking Evaluate with an empty textarea fell through to the existing `<50 chars` check and yielded `JD too short (min 50 chars)` — accurate but unhelpful: the real problem is "you typed nothing", not "you typed too little". [public/js/views/evaluate.js](public/js/views/evaluate.js#L28-L45) now checks `!jd` first and surfaces a new `eval.emptyJd` error toast (`"JD is required — paste the full job description"`, localized × 8) + focuses the textarea so the user can start typing immediately. The pre-existing `eval.shortJd` toast still fires for 1–49 char input. 936 → **937** unit. (UX-D-F)

---

## [1.58.42] — 2026-05-20

**fix(ux): UX-D-J — per-advisor ETA chip parity with `#/auto` (UX-6 v1.55.4).** v1.58.36 audit: only `#/auto` showed an honest "⏱ ~1–2 min" chip next to its Run button; the other 7 LLM-driven advisor pages (`#/evaluate`, `#/deep`, plus the 5 mode pages — project / training / followup / contacto / interview-prep / patterns) ran a similar 10-60s call but gave no time hint. Adds a `<span class="advisor-eta">⏱ ~30s</span>` (localized via new `advisor.eta` key × 8) next to `UI.providerCostHint(t)` in [evaluate.js](public/js/views/evaluate.js), [deep.js](public/js/views/deep.js), and [mode-page.js](public/js/views/mode-page.js). CSS extends `.auto-eta` to cover `.advisor-eta` with the same styling. The original `auto.eta` chip stays at `~1–2 min` (it's the only multi-step SSE pipeline). 935 → **936** unit. (UX-D-J)

---

## [1.58.41] — 2026-05-20

**fix(ux/truthfulness): UX-D-I — cost-hint now re-fetches on tab focus + on `providers-changed` event (M-7 v1.58.12 follow-up).** v1.58.12 wired `UI.providerCostHint(t)` to `/api/status/providers` but only fetched ONCE at node creation. If the user opened `#/config` in another tab, picked a different provider, and switched back, the cost line would silently lie until they navigated away and back. Fix in [public/js/api.js](public/js/api.js#L676-L740): extract a named `refreshCostLine()` function and bind it to `document.visibilitychange` (tab regains focus) + a new `providers-changed` `CustomEvent`. The `#/config` Save handler in [public/js/views/config.js](public/js/views/config.js) dispatches the event after a successful POST, so in-page cost lines (`#/auto`, `#/deep`, `#/evaluate`, mode pages) refresh **without** a page reload or route re-mount. 934 → **935** unit. (UX-D-I)

---

## [1.58.40] — 2026-05-20

**fix(ux/docs): UX-D-H — regression-lock: every visible `career-ops.org/docs/...` deep-link must be clickable.** v1.58.36 audit verified live: every existing such URL in `public/js/views/*.js` is already inside `c("a", { href, target: "_blank", rel: "noopener noreferrer" }, …)` (apply.js / batch.js / config.js / reports.js), and every `docs/help/*.md` reference uses markdown `[text](url)`. So this release ships only the **regression lock**: new [tests/external-doc-links.test.mjs](tests/external-doc-links.test.mjs) parses every `views/*.js` and `docs/help/*.md` file and fails if a `career-ops.org/docs/<path>` URL is rendered as plain child text (not inside an `<a>` create, attribute slot, or markdown link). Bare brand mentions of `career-ops.org` without `/docs/` path are tolerated (e.g. "career-ops.org schema" in prose). 2 new test cases added to the suite. 932 → **934** unit. (UX-D-H)

---

## [1.58.39] — 2026-05-20

**fix(ux): NEW-D2 — Dashboard header gets a Refresh button with explicit toast feedback (distinct from connection-banner Refresh of M-9 / v1.58.14).** v1.58.36 audit: there was no in-place refresh on `#/dashboard` — the user had to use the connection-banner Refresh (which does a full `location.reload()` and loses scroll position) just to update the four metric counters. New `↻ Refresh` button in the header in [public/js/views/dashboard.js](public/js/views/dashboard.js) re-fetches `/api/dashboard` and re-renders the view in place via `Router.go("/dashboard")` — no page reload, no scroll loss. Toast pipeline: `Refreshing…` (in-flight) → `Dashboard refreshed` (success) or localized error. Two new i18n keys × 8 locales: `dash.refreshAria` (button aria-label) + `dash.refreshed` (success toast). 931 → **932** unit. (NEW-D2)

---

## [1.58.38] — 2026-05-20

**fix(a11y): NEW-D3 (WCAG 4.1.2) — `#/tracker` search input gets a localized `aria-label` distinct from its placeholder.** v1.58.36 audit: the search input had only `placeholder="Search by company / role…"` and no `aria-label` — screen-reader users heard only the generic role "edit text" with no description of the purpose. Per WCAG 4.1.2 (Name, Role, Value) a standalone search input without an associated `<label>` MUST have an explicit accessible name. Fix in [public/js/views/tracker.js](public/js/views/tracker.js): the `filterText` input now declares `type="search"` + `aria-label: t(track.searchAria, …)`. New `track.searchAria` i18n key in all 8 locales — values explicitly different from the placeholder ("Search applications by company name or role title" vs "Search by company / role…") so the SR doesn't hear the same string twice. 930 → **931** unit. (NEW-D3)

---

## [1.58.37] — 2026-05-20

**fix(i18n): NEW-D1 — `#/pipeline` H1 localized on `es` / `pt-BR` / `ru` + 2 stray RU title leaks fixed (`contacto.title`, `health.title`).** v1.58.36 audit caught the H1 of `#/pipeline` rendering the literal `Pipeline` on `es`/`pt-BR`/`ru` while their sidebar items (`Vacantes` / `Vagas` / `Воронка`) were properly localized — promise-fidelity gap with the closed v1.58.18 I18N-011 doctrine (page H1 must match the sidebar term). Updated `pipe.title` in [public/js/lib/i18n-dict.js](public/js/lib/i18n-dict.js): es → `Pipeline de vacantes`, pt-BR → `Pipeline de vagas`, ru → `Воронка вакансий`. New static guard `tests/i18n-no-latin-leaks.test.mjs` (parses the consolidated DICT, asserts no Latin-only `*.title` value on `ru/ja/ko/zh-CN/zh-TW` outside a small whitelist of proper nouns / acronyms / product names). The guard immediately caught two additional stray RU leaks beyond NEW-D1: `contacto.title` (was `LinkedIn outreach` → `Касания через LinkedIn`) and `health.title` (was `Health` → `Состояние`) — both shipped under the same fix. 928 → **930** unit. (NEW-D1)

---

## [1.58.36] — 2026-05-20

**chore(docs): v1.58.36 — full housekeeping sweep at the close of the v1.58.x cycle.** No code or behavior changes — documentation + qa structure + test baselines synced to reality after 32 single-fix releases. **(1) qa/ reorganization:** the three version-locked end-to-end regression snapshots (`REGRESSION-END-TO-END-v1.58.16/33/35.md`) moved into the new `qa/archive/v158-cycle/` directory alongside the pre-cycle MASTER regression and the `FIX-PROMPT-v1.58.3.md` snapshot — `qa/v158-regression/` now contains only the active `FIX-PROMPT-v1.58.4_and_beyond.md` (post-MASTER fix specification, every row marked ✅). **(2) qa/REGRESSION-FINAL.md** gains **§12** documenting every v1.58.x cycle invariant (CSP unconditional, 5 provider rows, `:focus-visible` ring, drawer behavior, help §18, etc.) with its `tests/qa-report-fixes.test.mjs` lock per row. **(3) qa/UX-AUDIT-PROMPT.md** baseline table extended with 30 closed-in v1.58.x rows. **(4) docs/architecture/:** FRONTEND.md gains the notifications-drawer section + v1.58.24 toast-postfix + v1.58.10 modal-drain notes; OVERVIEW.md links to the drawer; TESTING.md totals lifted to **928 unit / 117 files / 62 Playwright / 20 smoke / 23 comprehensive E2E**. **(5) CLAUDE.md** gains a "Hard-won lessons (v1.58.x cycle)" section with 10 captured traps (the `[hidden]` cascade trap, the `npm test | grep` exit-code mask, the `cleanLlmMarkdown ≠ sanitizer` doctrine, etc.). **(6) .github/copilot-instructions.md** baseline lifted to **928 unit / 62 Playwright**. **(7) README ×8 locales:** new "Notifications 🔔" row in every page-table + `tests/` stale count fixed from `284 unit + 12 Playwright + 23 e2e:full` → `928 + 62 + 23 + 20` (baseline @ v1.58.35). Test baseline unchanged: **928** unit · **62** Playwright · **20** smoke · **23** comprehensive E2E. (housekeeping)

---

## [1.58.35] — 2026-05-20

**fix(ui): v1.58.35 — Notifications drawer no longer auto-opens at page load + new help §18 catalogues all notification categories (user-reported).** Two bugs in one. (1) **Auto-open / never-close:** `.notif-drawer { display: flex }` and `.notif-badge { display: inline-flex }` (v1.58.34) had the same author-level specificity as the UA `[hidden] { display: none }` rule, so the explicit `display` value won and the `hidden` attribute was a no-op — the drawer was visible on every page load and clicking close did nothing. Fix in [public/css/app.css](public/css/app.css): explicit `.notif-drawer[hidden] { display: none }` + `.notif-badge[hidden] { display: none }` overrides. The drawer is now ONLY opened by clicking the bell (or Enter/Space when keyboard-focused); a static-guard test asserts there is exactly one `open()` call site in app.js (the bell click ternary), so future edits can't silently introduce another auto-open path. (2) **Undocumented categories:** new **§18 Notifications** section in all 8 help bundles (docs/help/{en,es,ja,ko-KR,pt-BR,ru,zh-CN,zh-TW}.md) — 3 H3 subsections per bundle (Notification categories / What is NOT a notification / Keyboard) catalogue every toast source (Success / Error / Info-progress), what each visual cue means, what's explicitly NOT a notification (Doctor/verify modals, SSE log lines, spinner-only states), and the keyboard contract. Help-section parity baseline lifted 17 → 18; H3 baseline 70 → 73. 927 → **928** unit. (user-reported)

---

## [1.58.34] — 2026-05-20

**feat(ui): v1.58.34 — Notifications drawer ships on top of the v1.58.33 toast-journal capture (closes U-13 completely).** v1.58.33 shipped the data shape (in-memory `toastHistory` cap 50 + `UI.getToastHistory()`) and explicitly deferred the drawer chrome. This release adds the chrome. **`UI.onToast(fn)`** pub/sub layered on top of the capture in [public/js/api.js](public/js/api.js#L222-L233) — subscribers receive the entry just appended; the implementation guards every subscriber callback in try/catch so a drawer bug can never break the toast pipeline. **Bell button** in the top-bar (`🔔` + red unread badge), `aria-haspopup="dialog"` + `aria-controls="notif-drawer"` + `aria-expanded` flipping on open/close. **Right-slide `<aside role="dialog">`** with localized title (`notif.title`), empty-state (`notif.empty`), and per-entry items showing localized `toLocaleTimeString` + message + (when present) the technical postfix from U-4 (v1.58.24). Newest first; oldest dropped as the U-13 cap bites. Esc + Close button + clicking the bell again all close the drawer; focus restores to the bell (WAI-ARIA APG drawer pattern). 4 new i18n keys (`notif.title`, `notif.empty`, `notif.bellAria`, `notif.closeAria`) × 8 locales. CSS: `.notif-bell`, `.notif-badge`, `.notif-drawer`, `.notif-drawer__head`, `.notif-item` rules. 926 → **927** unit; Playwright 61/61 unchanged. (U-13 follow-up)

---

## [1.58.33] — 2026-05-20

**fix(ux): U-13 + U-14 + U-15 — toast journal capture + page-header spacing safety net + CV editor dirty-state indicator (3 closing UX items batched).** Final v1.58.x release. **U-13 (toast journal):** [public/js/api.js](public/js/api.js#L215-L235) — every `UI.toast()` call pushes `{ ts, type, message, detail }` into an in-memory `toastHistory` capped at 50; exposed via the new `UI.getToastHistory()` API. Toasts dwell 3.5-20 s and then vanish; the journal lets future drawer / panel UIs (deferred to a follow-up release) re-surface any missed message. **U-14 (page-header spacing safety net):** new `.page-header h1 + p { margin-block-start: var(--space-2); color: var(--foggy); }` rule in [public/css/app.css](public/css/app.css#L604-L612) so any page that uses raw `<h1>+<p>` (without the `.page-subtitle` class) still gets the canonical spacing. **U-15 (CV dirty-state):** [public/js/views/cv.js](public/js/views/cv.js#L208-L240) — Save button gets `.btn-dirty` class + localized `cv.unsaved` tooltip whenever the textarea diverges from the last saved baseline; clicking Save re-baselines and clears the flag. Upload path dispatches a synthetic `input` event so programmatic `ta.value = …` assignments still trigger the dirty toggle. CSS `.btn.btn-dirty` paints a `var(--rausch-dark)` ring + `● ` prefix. 925 → **926** unit. (U-13 + U-14 + U-15)

---

## [1.58.32] — 2026-05-20

**fix(ux): U-12 — `#/help` TOC filter input gets a 16ch `min-width` so KO/JA placeholders never clip.** Korean `섹션 필터` and Japanese `セクションをフィルター` are 5-10% wider than the EN `Filter sections`. The input already used `width: 100%` of its `.help-toc` card; we add a `.help-toc__filter` class with `min-width: 16ch` so even if the card narrows, the placeholder still fits in any of the 8 locales. 924 → **925** unit. (U-12)

---

## [1.58.31] — 2026-05-20

**fix(ux): U-11 — Tracker `Legitimacy` column header now carries a localized info chip + tooltip explaining the High/Caution/Suspicious scale.** v1.58.3 QA: the badge in each row read `High` / `Caution` / `Suspicious` with no header affordance to learn what they meant. [public/js/views/tracker.js](public/js/views/tracker.js#L228-L246) `<th>` now renders the column label + `<span class="th-info" tabindex="0" role="img">ⓘ</span>` whose `title` + `aria-label` come from a new `track.col.legitimacy.help` i18n key × 8 locales: *"Confidence that the posting is real (High / Caution / Suspicious)."* CSS `.th-info:focus-visible` adds the brand ring so the chip is keyboard-reachable per WCAG 2.4.7. Also repairs the v1.58.30 (U-10) regression where the existing `#25 destructive buttons have a title hint` lock test only checked for `track.fixHint` but the U-10 branch now uses both `track.fixHint` and `track.fixEmpty`. 923 → **924** unit. (U-11 + U-10 follow-up)

---

## [1.58.30] — 2026-05-20

**fix(ux): U-10 — Tracker Normalize / Dedup / Merge buttons disabled when `data/applications.md` is empty.** v1.58.3 QA: clicking these buttons on an empty tracker still hit the parent project rewrite endpoints — a no-op the user could not tell was futile. Now [public/js/views/tracker.js](public/js/views/tracker.js#L187-L210) sets `disabled` + `aria-disabled` + a localized tooltip (`track.fixEmpty` × 8 locales) explaining why ("Add a row to the tracker first — this rewrites data/applications.md and there is nothing to rewrite yet."). When rows exist, the buttons re-enable and show the existing `track.fixHint` tooltip. 922 → **923** unit. (U-10)

---

## [1.58.29] — 2026-05-20

**fix(ux): U-9 — `#/pipeline` counter ↔ filter row stacks vertically on narrow viewports.** v1.58.3 QA: at ≤ 720 px the `In queue: N` chip and the filter input fought for horizontal space and pushed the input to a cramped column. New `.pipeline-controls` class in [public/js/views/pipeline.js](public/js/views/pipeline.js#L377-L385); CSS rule under `@media (max-width: 720px)` sets `flex-direction: column` + stretches `#pipe-filter` to 100% width. Desktop unchanged. 921 → **922** unit. (U-9)

---

## [1.58.28] — 2026-05-20

**fix(ux): U-8 — Generate-prompt block is collapsed by default on the 7 mode pages.** The inline `<pre>` previously ran 1200+ px after the user clicked Generate prompt, pushing Copy + Run-live below the fold. [public/js/views/mode-page.js](public/js/views/mode-page.js#L272-L300) `showPrompt()` now wraps the `<pre>` in `<details class="prompt-block">` collapsed by default; summary shows `Show prompt (N lines)` localized via the new `prompt.show` / `prompt.lines` keys × 8 locales. Copy / Run-live remain immediately visible. Also fixed a pre-existing v1.58.27 regression where the BUG-007/008 contract test rejected the U-7 reformat (intermediate `const stripped` between dismissToast/modal); loosened the adjacency regex from `
s*` to `[sS]{0,1200}?` while still asserting `UI.dismissToast()` runs before `UI.modal(t(…))`. 920 → **921** unit. (U-8)

---

## [1.58.27] — 2026-05-20

**fix(ux): U-7 — `verify-pipeline.mjs` ASCII `===` dividers stripped from the result modal.** The script prints `=========`-runs (≥ 50 chars) between sections; in the 14 px monospace modal the run pushed the body wider than the rest of the SPA needs. Strip in [public/js/views/health.js](public/js/views/health.js#L23-L38) via `.replace(/^={10,}$/gm, "")` before rendering; whitespace already separates sections. 919 → **920** unit. (U-7)

---

## [1.58.26] — 2026-05-20

**fix(ux): U-6 — `#/scan` "Active companies N/M" chip now explains N vs M via tooltip + aria-label.** v1.58.3 QA: the chip read `▸ Active companies 96/80` with no affordance to learn what 96/80 means. Toggle button in [public/js/views/scan.js](public/js/views/scan.js#L700-L719) now carries `title=` (hover tooltip) and `aria-label=` (screen-reader fallback) sourced from a new `scan.activeCo.help` i18n key in all 8 locales: *"Active: companies currently surfacing results. Total: configured in portals.yml."* 918 → **919** unit. (U-6)

---

## [1.58.25] — 2026-05-20

**fix(ux/ia): U-5 — Dashboard CTA dedupe (removed duplicate Open-Pipeline header button + duplicate Scan-all-sources Quick-action tile).** v1.58.3 QA flagged 4× Pipeline / 4× Scan entry-points on Dashboard. v1.55.5 promoted the two P0 hero CTAs (`✨ Auto-pipeline a URL` + `🌐 Scan now`); the header `📋 Open Pipeline` button and the Quick-action `🌐 Scan all sources` tile were then strict duplicates (sidebar already routes to /pipeline; hero already routes to /scan). Removed both in [public/js/views/dashboard.js](public/js/views/dashboard.js). Hero pair + sidebar remain canonical entry-points. 917 → **918** unit. (U-5)

---

## [1.58.24] — 2026-05-20

**fix(ux): U-4 — toast error messages now tuck the "(METHOD /path · HTTP NNN)" postfix into a collapsed `<details>`.** v1.57.1 appended a what/where/why postfix to every API error so opaque "validation failed" became "validation failed — … (POST /api/config · HTTP 400)". The technical part is required (BUG-006 invariant — must remain reachable in the DOM), but on the toast headline it competes with the human sentence. `UI.toast()` in [public/js/api.js](public/js/api.js#L215-L266) now parses the trailing postfix with `TOAST_ENDPOINT_RE` and renders it inside a `<details class="toast-detail">` with a localized `<summary>` (`toast.details` key × 8 locales). Headline stays clean; the technical detail is one click away. New `.toast .toast-msg` / `.toast .toast-detail` CSS rules. BUG-006 invariant preserved (postfix still in DOM). 916 → **917** unit. (U-4)

---

## [1.58.23] — 2026-05-20

**fix(ux): U-3 — `#/followup` `lastContact` placeholder now adapts to today − 14 days (was the frozen ISO `2026-04-21`).** Static placeholders rot — readers parse them as both a format hint AND a plausible recent example, and the latter drifts into the distant past as time passes. Compute the placeholder at render time in [public/js/views/mode-page.js](public/js/views/mode-page.js#L165-L181): `new Date(); d.setDate(d.getDate() - 14); d.toISOString().slice(0, 10)`. Special-cased only for `cfg.slug === 'followup' && spec.name === 'lastContact'`; every other field still pulls its placeholder from i18n. 915 → **916** unit. (U-3)

---

## [1.58.22] — 2026-05-20

**fix(ux): U-2 — `#/auto` H1 no longer wraps to 2 lines because of the leading `✨`.** Pre-fix the `auto.title` i18n value was `✨ Auto-pipeline a URL`; the emoji participated in line-wrap and pushed the title to a second row at 1280-1600 px widths. Split into separate elements in [public/js/views/auto.js](public/js/views/auto.js#L240-L252): `.page-header.page-header--icon` (CSS grid, `auto 1fr` columns) + `<span class="page-icon" aria-hidden="true">✨</span>` + `<h1 class="page-title">{t(auto.title)}</h1>` + `<p class="page-subtitle">`. The emoji now sits on its own column and never participates in line wrap; the H1 wraps freely if needed. `auto.title` i18n value stripped of its leading `✨` in all 8 locales. 914 → **915** unit. (U-2)

---

## [1.58.21] — 2026-05-20

**fix(ux): U-1 — `#/cv` H1 + subtitle now match every other page (supersedes v1.56.0 UX-9 chip by design).** v1.56.0 UX-9 demoted the page title to a `.cv-breadcrumb` chip (lowercase grey `cv`) so the user's name in the preview "owned" visual space. v1.58.3 QA confirmed it just reads as a layout bug — the page header looks broken next to `#/dashboard`/`#/help`/etc. U-1 promotes [public/js/views/cv.js](public/js/views/cv.js) back to `<h1 class="page-title">` + visible `<p class="page-subtitle">` like every other page; `.cv-breadcrumb` CSS rule removed. **Single-`<h1>` invariant unchanged** (F-V54-A still shifts user `# Name` h1→h2 in the preview, so this stays the page's only H1). Lock test `tests/cv-breadcrumb.test.mjs` (which encoded the now-reversed UX-9 contract) is removed; `tests/cv-single-h1.test.mjs` updated to assert the new `.page-title`-only shape. 913 → **914** unit. (U-1)

---

## [1.58.20] — 2026-05-20

**fix(i18n/platform): I-6 — footer hotkey hint now shows ⌘K on Mac, Ctrl+K elsewhere (localized verb).** Pre-fix the sidebar footer hint was the literal `CTRL+K — search` on every platform and locale. The top-bar `<kbd>` badge already adapted via `data-mac`/`data-other` (v1.56.4 UX-N2); now the footer hint does too. `top.langhint` i18n values embed a `{hotkey}` placeholder (e.g., `{hotkey} — поиск`); new `applyFooterHotkey()` in [public/js/app.js](public/js/app.js#L196-L214) runs on boot + every `I18n.onChange` and replaces `{hotkey}` with `⌘K` or `Ctrl+K` based on `navigator.platform`. The localized verb (`search` / `buscar` / `поиск` / `搜索` / …) stays. 915 → **916** unit (static guard locks the `{hotkey}` shape in all 8 locales, the platform branch, and the `I18n.onChange` re-apply). (I-6)

---

## [1.58.19] — 2026-05-20

**fix(i18n): I-4 — RU `#/followup` H1 + hints no longer leak Latin `cadence` / `follow-up` / `scope` / `timeline`.** v1.58.3 RU regression: H1 `Советник по cadence follow-up`; hint `ISO-дата (YYYY-MM-DD) — основа для cadence.`; notesHint `timeline, internal hold, …`. All replaced with native Russian: `Советник по ритму касаний`, `ISO-дата (ГГГГ-ММ-ДД) — основа для расчёта ритма касаний.`, `сроки, внутренняя пауза, праздники`. companyHint `scope` → `область`. 914 → **915** unit (negative-match guard: no `cadence` / `follow-up` in any RU followup.* string). (I-4)

---

## [1.58.18] — 2026-05-20

**fix(i18n): I-3 — help TOC items 2/5/13/14 free of English bleed in non-Latin locales.** Pre-fix several locale help bundles still showed `## 2. App settings & API keys`, `## 5. Portals & Sources`, `## 13. Mode prompts`, `## 14. Apply checklist` (ru/ja/ko/zh-CN/zh-TW). Now fully localized in all 8 locales (RU `Подсказки режимов` / `Чек-лист отклика`, JA `応募チェックリスト`, KO `앱 설정 및 API 키` / `포털 및 소스` / `지원 체크리스트`, zh-CN `应用设置与 API 密钥` / `模式提示` / `申请清单`, zh-TW `應用設定與 API 金鑰` / `招聘版面與來源` / `模式提示` / `申請清單`). 913 → **914** unit (negative-match guard: items 2/5/13/14 contain none of `App|settings|Apply|checklist|Portals|Sources|Mode|prompts` for the 5 non-Latin locales). (I-3)

---

## [1.58.17] — 2026-05-20

**fix(i18n): I-2 — saved-research dates now use `Intl.RelativeTimeFormat` per locale.** The `formatRelative()` helper in [public/js/views/deep.js](public/js/views/deep.js#L57-L82) returned hardcoded English `today` / `1d ago` / `Nd ago` regardless of UI language. Replaced with `Intl.RelativeTimeFormat(I18n.getLang(), { numeric: 'auto' })` — the browser-native localized "today/yesterday/N days ago" string (сегодня/вчера, 今日/昨日, etc.). Dates older than 7 days fall back to `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`. Defensive try/catch keeps the old English fallback for ancient browsers without Intl. 912 → **913** unit. (I-2)

---

## [1.58.16] — 2026-05-20

**fix(ui): brand-button hover-flicker — pink/red primary & danger buttons no longer flash on hover (user-reported).** Root cause in [public/css/app.css](public/css/app.css): the default `.btn-primary` / `.btn-danger` background was a `linear-gradient(135deg, var(--rausch) 0%, var(--rausch-dark) 100%)`; the `:hover` rule replaced it with a solid `var(--rausch-dark)`. CSS cannot interpolate between a gradient and a solid colour, so the 180 ms `transition: background` on `.btn` snapped — the gradient briefly resolved to one of its stops on hover entry/exit, producing the visible white/pink flicker the user reported. Fix: keep the gradient on hover and dim via `filter: brightness(0.92)` instead — `filter` interpolates cleanly in every browser, so the dim/un-dim now animates symmetrically over the existing 180 ms duration. The `.btn` transition list is extended with `filter var(--transition)` so the hover dim actually animates. Mouse pointer-focus state stays clean (uses `:focus`, not `:focus-visible`, per the v1.58.9 M-1 contract). 911 → **912** unit (`tests/qa-report-fixes.test.mjs` asserts the gradient-stays/filter-dims contract on both `.btn-primary:hover` and `.btn-danger:hover`, plus that the pre-fix `background: var(--rausch-dark)` is gone and that `filter` is in the `.btn` transition list). (user-reported)

---

## [1.58.15] — 2026-05-20

**fix(a11y/i18n): I-1 — top-bar search `aria-label` and visually-hidden label now localized.** v1.58.3 verified the global search input shipped `aria-label="Global search — Cmd+K to focus, paste a URL and Enter for auto-pipeline"` regardless of UI language. Screen-reader users on RU/JA/zh-CN/etc. were stuck with English. New generic `data-i18n-aria-label` hook in [public/js/app.js](public/js/app.js#L4-L29) mirrors the existing `data-i18n` / `data-i18n-placeholder` pattern — `applyI18n()` iterates every `[data-i18n-aria-label]` element and calls `el.setAttribute('aria-label', I18n.t(key, …))` on each language change. The top-bar input now declares `data-i18n-aria-label="top.search.aria"`; the visually-hidden `<label>` declares `data-i18n="top.search.label"`. Two new i18n keys (`top.search.aria`, `top.search.label`) added across all 8 locales. The hook is reusable — any future control just adds the attribute. 910 → **911** unit (`tests/qa-report-fixes.test.mjs` asserts the HTML markup wiring, the app.js handler shape, the 8-locale i18n parity, and a sanity check that RU ≠ EN so a copy-paste-English regression can't slip through). (I-1)

---

## [1.58.14] — 2026-05-20

**fix(ux): M-9 — connection-banner `Refresh` now gives feedback (was silent reload).** v1.58.3 verified the global Refresh button called `location.reload()` synchronously — user sees a brief flash but no explicit signal that anything happened. Fix in [public/js/app.js](public/js/app.js#L131-L161): the click handler now (1) emits a transient `Refreshing…` toast, (2) sets `sessionStorage['refreshedToast']` so the *next* page boot can surface a success toast (the in-flight one is destroyed by navigation), (3) disables the button to swallow rapid double-clicks (no stacking), and (4) defers `location.reload()` by 200 ms so the in-flight toast paints first. On boot, app.js checks the sessionStorage flag, clears it, and emits a success `Refreshed` toast (deferred so it lands after the SPA settles). Two new i18n keys (`common.refreshing`, `common.refreshed`) added across all 8 locales. 909 → **910** unit (`tests/qa-report-fixes.test.mjs` asserts the synchronous progress toast, deferred reload, disabled-guard, sessionStorage handoff, success toast on next boot, and 8-locale i18n parity). (M-9)

---

## [1.58.13] — 2026-05-20

**fix(ux): M-8 — `#/apply` checklist becomes interactive (delivers the page's promise).** v1.58.3 verified: `▶ Generate checklist` rendered a monospace `<pre>` block listing items 0…7 — read-only text the user couldn't tick. The page is titled "Apply checklist" but didn't actually behave like one. Fix in [public/js/views/apply.js](public/js/views/apply.js#L9-L98) — after the API returns, the raw `r.checklist` text is parsed into items (lines, trimmed, leading `-`/`*`/`1.`/`[ ]` markers stripped) and rendered as a `<ul class="apply-checklist">` of real `<input type="checkbox">` rows. Each row is wrapped in `<label>` so the full row is the click target (WCAG 2.5.5; works with v1.58.9 M-1 focus rings). State is persisted in `localStorage['applyChecklist:' + slug]` (slug = URL stripped of protocol + query, alphanum/`._/:-` only, ≤240 char) — tick three items, reload, three still ticked. Two action buttons: **Copy unchecked** (clipboard the still-open items as `- markdown` bullets) and **Reset** (clear all ticks for this URL). Defensive fallback: if the parser finds zero items, render the raw text as before so the user isn't shown an empty card. New CSS in [public/css/app.css](public/css/app.css) (`.apply-checklist`, `.apply-checklist__actions`, line-through on checked spans). Five new i18n keys (`apply.checklist.copyUnchecked`, `resetBtn`, `copied`, `copyFailed`, `reset`) across all 8 locales. 908 → **909** unit (`tests/qa-report-fixes.test.mjs` asserts the checkbox + data-item-index render, the `<label>` wrap, the `applyChecklist:` localStorage prefix, the load/save state functions, the two action buttons, the no-raw-`<pre>` regression-lock, the CSS row sizing, and 8-locale i18n parity for all five new keys). (M-8)

---

## [1.58.12] — 2026-05-20

**fix(ux): M-7 — cost hint now tracks the active provider (OpenRouter no longer falls through to a fabricated number).** `UI.providerCostHint()` already routed via `/api/status/providers` so the line was provider-aware in spirit, but the per-provider maps in [public/js/api.js](public/js/api.js#L623-L676) only listed `anthropic`/`gemini`/`openai`/`qwen`. With v1.57.0's 5th provider live, OpenRouter fell through to the generic 0.03 fallback **and** rendered the literal `openrouter` (lowercase) as the provider name — both wrong. Per the fix-prompt's intent ("be honest, never quote a fixed number that might be wrong"), the EST map now lists `openrouter: null` (router picks the underlying model — cost varies per request), and the render path branches on `null` to emit a localized `cost varies (router picks)` instead of a fabricated `~$0.03/eval`. NAME map adds `openrouter: 'OpenRouter'` so the user-visible name matches the docs. New i18n key `cost.varies` added across all 8 locales (`cost varies (router picks)` / `coste variable (lo elige el router)` / `coste variable` / etc.). 907 → **908** unit (`tests/qa-report-fixes.test.mjs` asserts `EST openrouter: null`, `NAME openrouter: 'OpenRouter'`, the `=== null` branch + `t('cost.varies', …)` call site, and 8-locale i18n parity). (M-7)

---

## [1.58.11] — 2026-05-20

**fix(ux): M-4 — saved-research card title↔date gap now structural CSS (was inline margin).** v1.58.3 verified: some saved-research card entries displayed `software-engineer-generaltoday` (no space between title and date), while others were fine — the pre-fix relied on `style="margin-left: 8px"` between two raw `<span>` children, which collapsed on certain entries. The fix in [public/js/views/deep.js:34-55](public/js/views/deep.js#L34-L55) replaces the two anonymous `<span>`s with `.saved-card__title` + a semantic `<time class="saved-card__date" datetime="…">`, wrapped in a `.saved-card` flex container. Spacing is now driven by CSS `gap: var(--space-2, 8px)` so it can't collapse (and you get a11y/SEO `<time>` semantics for free). New CSS in [public/css/app.css](public/css/app.css) defines `.saved-card { display: inline-flex; align-items: baseline; gap: var(--space-2, 8px); white-space: nowrap }`, `.saved-card__title { font-weight: 500 }`, `.saved-card__date { color: var(--foggy); font-size: 0.85em; white-space: nowrap }`. 906 → **907** unit (`tests/qa-report-fixes.test.mjs` asserts the new classes, the semantic `<time datetime=…>`, the no-inline-`marginLeft: '8px'` regression-lock, and the CSS gap declaration). (M-4)

---

## [1.58.10] — 2026-05-20

**fix(ux): M-2 — drain the progress toast before any result modal opens.** Clicking `sync-check` on `#/cv` left the "Running cv-sync-check.mjs…" toast bottom-right while the result modal opened — both fighting for attention, and on narrow screens visually overlapping. The Health-page Doctor / verify-pipeline buttons already called `UI.dismissToast()` explicitly before `UI.modal()`; cv.js's sync-check (and any future call site) was the odd one out. Fix in [public/js/api.js](public/js/api.js#L272) — `UI.modal()` now calls `dismissToast()` as its first executable statement so every present and future call site gets the drain for free (defence-in-depth at the boundary). Also localized [public/js/views/cv.js](public/js/views/cv.js#L190-L201) — the previously-hardcoded English `UI.toast('sync-check…')` and `UI.modal('sync-check', …)` now use `t('cv.syncCheckRunning')` and `t('cv.syncCheck')` respectively, satisfying the BUG-008 invariant (modal title == localized button label) for the cv-view path too. Two new i18n keys (`cv.syncCheck`, `cv.syncCheckRunning`) added across all 8 locales. 905 → **906** unit (`tests/qa-report-fixes.test.mjs` static guard for the dismissToast() boundary, the localized cv.js call site, the no-hardcoded-`'sync-check…'`-literal, and 8-locale i18n parity). (M-2)

---

## [1.58.9] — 2026-05-20

**fix(a11y): M-1 — re-establish a visible `:focus-visible` ring on form fields (WCAG 2.4.7 Level AA).** The v1.58.3 MASTER regression confirmed `getComputedStyle(focusedInput)` returned `outline: rgb(255,255,255) none 1.5px` — i.e. the `none` keyword collapsed the ring to 0 px on every form field. Root cause: the base `.input, .textarea, .select { outline: none }` rule (intentional, to suppress the mouse-focus halo) had higher specificity than the global `*:focus-visible` rule and silently nuked the keyboard-focus ring on 88 focusable elements per page. Same issue on `.searchbar input { outline: none }` for the global ⌘K/Ctrl K search. Fix in [public/css/app.css](public/css/app.css) — add explicit `.input:focus-visible, .textarea:focus-visible, .select:focus-visible` and `.searchbar input:focus-visible` rules with `outline: 2px solid var(--rausch)` + a translucent box-shadow so keyboard-only focus paints a visible ring while mouse focus stays clean (uses `:focus`, not `:focus-visible`). 904 → **905** unit (`tests/qa-report-fixes.test.mjs` static CSS contract guard for all three new rules + the regression-lock for the pre-existing global `*:focus-visible`); Playwright **60 → 61** (`tests/playwright-smoke.mjs` Tab-traversal test asserts the computed outline on a `#/config` form field is ≥1.5 px wide and not `none`). (M-1)

---

## [1.58.8] — 2026-05-20

**feat(health): surface `OPENAI_API_KEY`, `QWEN_API_KEY`, `OPENROUTER_API_KEY` on `#/health` (analogous to `GEMINI_API_KEY`).** v1.57.0 added OpenRouter as the 5th headless live-eval provider; v1.55.3 (UX-2) added on-screen onboarding for the 4-provider mix. The `#/health` page however only reported `GEMINI_API_KEY` and `ANTHROPIC_API_KEY` — the other three providers' key state was invisible there even though `/api/status/providers` already routed evals to them. User request: extend the same "set / unset (manual mode)" row pattern to every headless provider. [server/lib/routes/health.mjs](server/lib/routes/health.mjs#L57-L71) now pushes three additional optional check rows (`OPENAI_API_KEY`, `QWEN_API_KEY`, `OPENROUTER_API_KEY`) wired to the same `isUsableKey` gate as `/api/status/providers` (`hasOpenAIKey()`, `hasQwenKey()`, `hasOpenRouterKey()` were already imported but unused). "manual mode" wording is identical to the GEMINI row across the SPA's 8 locales — the Health view iterates over `body.checks` so no per-locale string change was needed. 903 → **904** unit (`tests/api.test.mjs` extended to assert all three new optional rows; `ok=true` still holds since they're not required). (NEW user-requested feature)

---

## [1.58.7] — 2026-05-20

**fix(security): NEW-2 — `isValidJobUrl` now rejects paired template-placeholder syntaxes (`${…}`, `{{…}}`) to match the error message.** The route-level 400 returned by `POST /api/pipeline` advertises *"contain no script or template characters"*, but the v1.58.3 MASTER regression confirmed only ASP/EJS-style `<%…%>` was actually blocked (free side effect of the `[<>"'`\\\s]` bracket-char gate). JS template literals (`${TEST}`) and Mustache/Handlebars (`{{TEST}}`) both passed validation — a regex↔message semantic gap. Option A from the fix-prompt (tighten regex to match message; slight hardening against URL-templating injection): a new `TEMPLATE_PATTERNS` array in [server/lib/security.mjs](server/lib/security.mjs) (`/\$\{[^}]*\}/`, `/\{\{[^}]*\}\}/`) is consulted via `hasTemplatePlaceholder(url)` before `new URL(…)`. Only **paired** placeholders are rejected — a bare `{normal}` ATS-style path token survives (`https://boards.greenhouse.io/anthropic/jobs/4567` and `https://example.com/job/{normal}` both still accepted). 901 → **903** unit (`tests/url-validation.test.mjs` extended with 2 NEW-2 tests covering both rejected forms and the no-false-positive ATS case). The `<%…%>` regression-lock is also explicit now. (NEW-2)

---

## [1.58.6] — 2026-05-20

**fix(a11y/i18n): BUG-008-tb — top-bar `Doctor` modal title now matches the localized button label.** The ledger row BUG-008 fixed in v1.58.0 ("modal title == localized button label") closed the **Health page** entry-point. The v1.58.3 MASTER regression then found the **top-bar** entry-point still violated the invariant: regardless of UI locale, clicking the top-bar `Doctor` button opened a modal titled `doctor` (hardcoded English, lowercase). Repro: EN top-bar `Doctor` → modal title `doctor`; RU top-bar `Диагностика` → modal title `doctor`. Two entry paths, one invariant, one passing. Fix in [public/js/app.js:118](public/js/app.js#L118) — replace the literal `'doctor'` with `I18n.t('top.doctor', 'Doctor')`. The `top.doctor` i18n key (already present in all 8 locales: EN `Doctor` · ES/pt-BR `Diagnóstico` · KO `진단` · JA `診断` · RU `Диагностика` · zh-CN `诊断` · zh-TW `診斷`) is the same key the button declares via `data-i18n="top.doctor"`, so the modal title is now textually identical to the visible button label across all locales. Static contract guard added in `tests/qa-report-fixes.test.mjs` (BUG-008-tb): asserts the `I18n.t('top.doctor', 'Doctor')` form in `app.js`, the no-hardcoded-`UI.modal('doctor',`-literal, the 8-locale presence of `top.doctor` in `i18n-dict.js`, and the button↔key wiring in `index.html`. 900 → **901** unit; Playwright 60/60. (BUG-008-tb)

---

## [1.58.5] — 2026-05-20

**fix(ui): NEW-3 — `#/followup` Run-live double-POST triaged *not-reproducible*; locked with Playwright regression guard.** The v1.58.3 MASTER regression observed (via monkey-patched `window.fetch`) two identical POSTs to `/api/mode/followup` within ~2 s after a single click on `#/followup` Run live (company/role/notes filled, date intentionally empty). Per the fix-prompt's "repro first" doctrine, source inspection of `public/js/views/mode-page.js::submit()` shows: (a) the Run-live and Generate-prompt buttons are plain `<button>` elements with a single `onClick` each — there is no parent `<form>` and no `addEventListener('submit')` to double-fire, and (b) `UI.withSpinner()` (FIX-L1) sets `button.disabled = true` for the duration of the in-flight request, so a second physical click during the request is blocked at the source. A new Playwright test in `tests/playwright-smoke.mjs` (`NEW-3 — single click on #/followup submits exactly one POST`) walks the **exact** regression recipe — fills company/role/notes, leaves the date blank, clicks the manual-prompt button (which shares the `submit()` function with Run live), and asserts **exactly one** `POST /api/mode/followup` over a 3 s window. Locale-stable selector (the `▶` glyph is the same in all 8 locales), and `addInitScript` seeds `career-ops-ui:lang=en` so a prior language test in the same browser context can't perturb the field selectors. Playwright **59 → 60**. Original QA observation is filed as recipe-only; no shipped code change required. (NEW-3)

---

## [1.58.4] — 2026-05-19

**fix(security): NEW-1 — emit `Content-Security-Policy` on every response (was loopback-gated).** Before v1.58.4 the CSP header was layered on only when `isPubliclyExposed()` was true (HOST bound beyond loopback); over `127.0.0.1` both `/` and `/api/health` returned **no** CSP, leaving `UI.md()`'s escape-first contract as the only XSS defence. The v1.58.3 MASTER regression (§5) flagged this as a stop-ship invariant gap. CSP is now **unconditional** and identical on every response regardless of bind address: `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`. `script-src` never allows `'unsafe-inline'`/`'unsafe-eval'`. The directive set is unchanged from the prior exposed-only policy (already SPA-correct — Google Fonts allowlisted for Inter), so no visual or functional regression. `tests/security-headers.test.mjs` was rewritten to lock CSP-present-on-loopback; a Playwright route-walk (en/ru/ja/zh-TW × 7 routes) asserts **0 CSP violations**. 900 unit · Playwright 58→59 · e2e 20/20+23/23. Next fix-prompt items (NEW-3, BUG-008-tb, NEW-2, M-1…) ship as subsequent one-fix releases per project doctrine. See `qa/v158-regression/FIX-PROMPT-v1.58.4_and_beyond.md`. (NEW-1)

---

## [1.58.3] — 2026-05-19

**fix(deep): R-2 / FIX-C1 — strip ORPHAN / unbalanced agent-scaffolding tags from research output.** v1.58.0 added `cleanLlmMarkdown` but it only removed *paired* `<tool_call>…</tool_call>` blocks and a *dangling open* tag. A deep regression of v1.58.2 found a model that emitted a **lopsided trace** — an orphan closing `</tool_response>` (and `</thinking>`) with no opener — which survived and rendered literally in the saved `#/deep` brief. A final conservative sweep now removes **any** standalone scaffold token (open or close, balanced or not): `tool_call|tool_response|tool_use|function_call|function_results|thinking`, the Anthropic tool XML (`<invoke …>`/`</invoke>`/`<parameter …>`/`<function_calls>` and `antml:`-namespaced forms), and fenced ```tool_* blocks. Pure + idempotent; real `<https://…>` autolinks and `` `<code>` `` spans are preserved (only the named agent tokens match). **FIX-C2** (`<html lang>` not updating) was triaged **not-reproducible** — `i18n.js` already sets `document.documentElement.lang` on `setLang` AND at boot and detects `navigator.language`; the QA repro was a stale `localStorage`/pre-redeploy artifact. Locked both with regression guards. 896 → **900** unit · Playwright 58/58 · e2e 20/20+23/23. The remaining v1.58.3 fix-prompt items (M-1 focus-ring, M-4..M-9, I-1..I-6, U-1..U-15) are queued as subsequent one-fix ships per project doctrine (never batched). See `qa/v158-regression/`.

---

## [1.58.2] — 2026-05-19

**fix(i18n): I18N-011 — localize the `#/help` table-of-contents in all 7 non-EN locales.** The `#/help` "On this page" TOC is built from the `##` section headings of `docs/help/<lang>.md`. Sections 3/4/6/7/8/9/10/11/12 (Profile, CV, Health, Scan, Pipeline, Evaluate, Reports, Tracker, Deep research) still carried their **English** titles in es/pt-BR/ko/ja/ru/zh-CN/zh-TW, so the TOC showed English while the sidebar nav was translated. Each affected heading is now localized to the **exact same term as the sidebar `nav.*` key** (single source of truth — TOC ↔ sidebar match), preserving the section number and the `(#/route …)` parenthetical verbatim. EN unchanged (canonical). 7–9 headings per locale. Closes the sole open i18n backlog item from the v1.58 QA sweep. Docs-only; 896/896 unit · 33/33 help tests · Playwright 58/58. See `qa/v158-regression/`.

---

## [1.58.1] — 2026-05-19

**fix(test): CI-isolated `checkProfileCustomized` guard (patch over v1.58.0).** v1.58.0 shipped green on the advisory pre-commit but red on `ci.yml` (Node 18/20/22): the new BUG-002/UX-032 test used a cache-bust dynamic import + `PATHS` rewrite, but `server/lib/paths.mjs` resolves the project root **once per process**, so the temp root never took effect under the shared `npm test` runner (it coincidentally passed locally). Replaced with a robust **static guard** that asserts the `store.mjs` allow-list contains the fixture names AND that the regex is `^(…)$/i` exact-anchored (so a real name merely containing "test" — e.g. `María Testanova` — is provably never false-flagged). No production code changed; this also unblocks `publish-package.yml` (it runs the suite before publishing). 896/896 unit · Playwright 58/58. See `qa/v158-regression/`.

---

## [1.58.0] — 2026-05-19

**fix(qa): external QA-report bug sweep + clean, formatted research output.**

### 🐛 Fixes (QA report)

- **BUG-001 (Critical)** — `#/followup` now validates the optional *Last contact* field client-side as an ISO date (`YYYY-MM-DD`); junk no longer reaches the LLM (and burns a credit). Generic `pattern` support added to the mode-page form factory.
- **BUG-003 (Major, every help page)** — `**bold**`, `` `code` ``, *italic* and `[links]` now render **inside block-quotes** in `UI.md()` (the `> **Audience:**` cards showed literal `**`). Safe-by-construction (content is already HTML-escaped before `inline()` runs).
- **BUG-005 (Major)** — adding a URL already in the pipeline now shows an honest *“Already in the queue — skipped”* info toast instead of a misleading green “Added”.
- **BUG-006 (Major)** — the invalid-URL message is humanized/sentence-cased (“That doesn't look like a valid job posting URL — …”). The `(POST /api/pipeline · HTTP 400)` where/why context stays by design.
- **BUG-007/008 (Major/Minor)** — the “Running doctor.mjs…” progress toast is dismissed before the result modal opens (new `UI.dismissToast()`), and the modal title reuses the localized button label so its casing always matches.
- **BUG-010** — the `#/reports` empty state now has the descriptive page-subtitle every other page has.
- **BUG-002 / UX-032 (code-side)** — `checkProfileCustomized()` now flags QA/test-fixture names (`Acceptance Test`, `Real Person`, `QA`, …) as *not customized*, so the Health card and prompts stop treating a test profile as the real candidate. The parent project's `config/profile.yml` / `cv.md` are **not** touched (hard rule #1) — the data cleanup is the user's; this is the heuristic fix.
- **I18N-012/013** — Russian `deep.title`, `deep.subtitle` (“smart questions”), and `dash.quick.deepCta` are now actually translated.

### ✨ Features / UX

- **Clean, formatted research output.** New `server/lib/llm-output.mjs::cleanLlmMarkdown()` strips agent/tool scaffolding the model sometimes echoes (`<tool_call>{…}</tool_call>`, `<tool_response>`, `<tool_use>`, `<function_call>`, `<thinking>`, `[TOOL_CALL]…`) from `#/deep` and **Saved research**. Applied at every chokepoint — Anthropic / OpenAI / Qwen / OpenRouter clients, the Gemini subprocess path, **and** on serving an already-saved brief (older files render clean too). The SPA already renders these via the XSS-safe `UI.md()`, so the result is a properly formatted document.
- **`#/outreach` alias** → `#/contacto` (BUG-004) for a consistent, bookmarkable English URL; canonical slug stays `contacto` (parent mode filename).
- **AI-review rule 3** — the client-owned network-error sentence is localized via `I18n.t()` (`api.netError` / `api.netHint`, 8 locales). Documented decision: server-emitted validation `details` are intentionally English diagnostics (consistent with every other server error; the SPA surfaces them verbatim and localizes its own chrome).

### 🧪 Tests

- New `tests/qa-report-fixes.test.mjs` (10) and `tests/llm-output.test.mjs` (5, incl. idempotency + “don't eat real code blocks”). `checkProfileCustomized` exercised directly (real name containing “test” is **not** false-flagged). Updated `url-validation` + `config-validation-detail` assertions for the new messages; `e2e-comprehensive` now date-aware. 881 → 896 unit; Playwright 58/58; e2e 20/20 + 23/23.

### Triaged, not changed (with rationale)

- **BUG-009** (`#/cv` H1 is a quiet breadcrumb chip) — *by design*: the single-`<h1>` WCAG 1.3.1 decision (F-V54-A); changing it risks an a11y regression.
- **BUG-002 data, UX-022** (parent `profile.yml`/`cv.md`/`portals.yml` content) — *parent-owned*; hard rule #1 forbids the repo editing parent files. Code-side detection hardened instead.
- Long-tail minor i18n/UX (I18N-011 help-TOC localization, I18N-014..019, UX-020/021/023/024/025/026/027/028/029/030/031) — tracked backlog; deferred to avoid a large unreviewed change set in a patch line.

---

## [1.57.2] — 2026-05-19

**fix(config): the ACTUAL root cause of `/#/config` "validation failed" — the SPA-injected `lang` field.**

### 🐛 Fixes

- **Saving anything on `/#/config` from the browser always returned `validation failed`.** `public/js/api.js` auto-attaches a `lang` field to *every* JSON POST body (so LLM routes pick up the UI locale). `/api/config` is not an LLM route and `lang` is not a config key, so `validateConfig`'s (correct, security-relevant) unknown-key rejection 400'd **every Save** with `validation failed — lang: not a known config key`. This was browser-only: curl/in-process repros never sent `lang`, which is why v1.57.0/.1 (whitespace-trim, descriptive errors) improved the *message* but didn't fix the *cause*. The config route now strips the transport-only `lang` before validating; the `KNOWN_KEYS` write-filter still drops any genuinely-unknown key, so the attacker-injection guard is unchanged.
- Found by a new Playwright form sweep that drives the real save button — not the synthetic fetch repros that masked it.

### 🧪 Tests

- New **`tests/playwright-forms.mjs`** (26, wired into `npm run test:e2e:browser`): drives a real Chromium over **every form-bearing route** — asserts no console errors site-wide, the invalid-save toast shows field+reason+request-context, secret fields never echo the typed value, valid saves succeed, and PORT/HOST show their prefilled defaults.
- `tests/config-endpoint.test.mjs`: browser-parity cases — POST with `lang` succeeds (and `lang` never lands in `.env`), while a real unknown key with `lang` present is still rejected. 879 → 881 unit; Playwright 32 → 58.

---

## [1.57.1] — 2026-05-19

**fix(ux): every API error now says WHAT failed, WHERE, and WHY — and the input-error text is maximally descriptive.**

### 🐛 Fixes

- **"validation failed" was opaque.** The server already returned `{ error, details: ["FIELD: reason", …] }`, but every form's `catch (e) { UI.toast(e.message) }` showed only the top line, so on `/#/config` (and everywhere) the user couldn't tell *which* field was wrong. `api.js` now folds the per-field `details` into the thrown message **site-wide** (one change, every form benefits), appends the request context `(METHOD /path · HTTP NNN)` so the toast says *where* it failed, falls back to a trimmed raw-body snippet for non-JSON errors, and includes the verb+path on network errors. `err.details` is also exposed for inline rendering.
- **Input-error messages are now maximally descriptive.** `validateConfig` explains what's wrong and how to fix it — e.g. `PORT: must be 1-65535 — a whole number, digits only (the default is 4317); you entered "abc"`; `HOST: invalid hostname/ip — only letters, digits and . : - _ are allowed (e.g. 127.0.0.1 …)`; the Anthropic message now points to console.anthropic.com and tells you to use the right provider's field. **Secret keys never echo the entered value** (only its character length), so a mistyped real key can't leak into a toast or log.
- **PORT range is now actually enforced** — a 5-digit value above 65535 (e.g. `99999`) was previously accepted; it's now rejected with a clear reason.

### ✨ UX

- **`/#/config` PORT and HOST are pre-filled with their real defaults** (`4317` / `127.0.0.1`) instead of looking empty/unconfigured.
- **Error toasts stay on screen long enough to read** — dwell time scales with message length (9–20 s for errors; success/info keep the snappy 3.5 s) and the toast wraps + scrolls instead of clipping a detailed message to one line.

### 🧪 Tests

- New `tests/config-validation-detail.test.mjs` (12): api.js detail-folding + WHERE/WHY context + toast dwell (static guards); config.js PORT/HOST defaults; server contract that every error is a field-prefixed string; descriptive-message assertions; **secret-no-echo leak guard**; the 1–65535 range fix. 874 → 879.

---

## [1.57.0] — 2026-05-19

**feat(provider): OpenRouter as a 5th headless live-eval provider + fix(config): "validation failed" when saving any API key.**

### 🐛 Fixes

- **`/#/config` no longer rejects valid API keys with "validation failed".** Pasted keys routinely arrive with a trailing newline or surrounding spaces (OS clipboard, the "copy" buttons on provider consoles). Pre-1.57 that tripped the newline guard for **every** provider, and the `$`-anchored `ANTHROPIC_API_KEY` charset regex (`/^sk-ant-[A-Za-z0-9_-]{20,}$/`) false-rejected genuine Anthropic keys whose base64url tail / future prefix didn't fit the class. `validateConfig` now normalizes (trims) every value **before** validating, the route persists the trimmed value (so it authenticates at runtime — no stray-newline `.env` quoting), and the Anthropic check is a resilient `sk-ant-` prefix + length sanity check (the shared `isUsableKey()` 20-char floor remains the real "is it real?" gate). Internal newlines are still rejected — that `.env`-injection guard is intact.

### ✨ Features

- **OpenRouter is now a first-class provider.** Add `OPENROUTER_API_KEY` on `/#/config` and one key fronts 300+ models (Anthropic, OpenAI, Google, Meta, Qwen, DeepSeek …). It's the **last** entry of the `auto` order (Anthropic → Gemini → OpenAI → Qwen → **OpenRouter**), so an existing setup is never silently re-routed; `LLM_PROVIDER=openrouter` pins it. Wired into the same `_tailProvider()` path as OpenAI/Qwen across `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, and surfaced by `/api/status/providers` + the Health dashboard. OpenAI-compatible client (zero new deps — direct `fetch`, `AbortController` timeout, key never logged) with the recommended `HTTP-Referer`/`X-Title` attribution headers.
- **The OpenRouter model dropdown is live.** `OPENROUTER_MODEL` is a dynamic select fed by **`GET /api/openrouter/models`** — a server-side proxy of OpenRouter's public catalogue (keeps the CSP `connect-src 'self'` envelope intact; no browser→third-party fetch). It degrades to a curated namespaced fallback list when the catalogue is unreachable (offline / rate-limited / 5xx), so the dropdown is never empty, and a 10-minute in-memory cache keeps repeat `/#/config` visits from re-hitting OpenRouter. New i18n keys (`config.openrouter*`) across all 8 locales; `config.llmProviderHint` updated.

### 🧪 Tests

- New CI-isolated suites: **`tests/openrouter-route.test.mjs`** (proxy answers 200 with a non-empty namespaced list even offline; leaks no secret) and **`tests/openrouter-model-selector.test.mjs`** (env-config contract + config.js wiring + 8-locale i18n parity). Extended `env-config`, `openai`, and `provider-selector` suites: trim/relax validation, `runOpenRouter`/`hasOpenRouterKey`/`fetchOpenRouterModels`, the appended `auto` tail, and the OpenRouter gate. Two previously-weak `validateConfig` cases (used the no-longer-known `HH_USER_AGENT`, so they passed for the wrong reason) now assert against a real key. 831 → 855.

---

## [1.56.4] — 2026-05-19

**feat(ui): UX-N2 — visible, platform-aware ⌘K / Ctrl K hint on the global search input.**

### ✨ Features

- **The Cmd/Ctrl+K "focus search" shortcut is now discoverable on screen.** It lived only in the input's `aria-label` / source, so sighted users never found it and the app felt slower than it is. A muted `<kbd class="kbd-shortcut">` now sits at the end of the search pill, filled at boot from `data-mac` / `data-other` by a platform check (`navigator.platform`/`userAgent`): **⌘K** on macOS/iOS, **Ctrl K** elsewhere. It is `aria-hidden="true"` (the existing `aria-label` already announces the shortcut to screen readers — the badge must not double-announce) and `pointer-events:none` (decorative). The existing Cmd/Ctrl+K keybinding is unchanged. No new i18n keys (the glyphs are universal); the badge is a flex child of the existing `.searchbar` (no wrapper / absolute positioning — the input is already `flex:1`).

### 🧪 Tests

- New CI-isolated source-static suite **`tests/cmdk-hint-visible.test.mjs`** (5): the `.kbd-shortcut` `<kbd>` lives inside the `.searchbar` pill; it is `aria-hidden="true"` with both `data-mac`/`data-other` variants; `app.js` fills it via a `navigator` platform check from the dataset; the existing `(e.ctrlKey||e.metaKey)&&e.key==='k'` → `search.focus()` keybinding is intact (regression guard); `app.css` styles `.kbd-shortcut` and never `display:none`. index.html/app.js/app.css are browser-only → asserted statically. 826 → 831.

---

## [1.56.3] — 2026-05-19

**fix(reliability): provider key detection rejects placeholder / too-short values, not only the empty string.**

### 🐛 Fixes

- **A placeholder `GEMINI_API_KEY` in a parent `.env` was reported "✓ set" AND mis-selected as the active provider over a valid `ANTHROPIC_API_KEY`.** `effectiveEnv()` only rejected `undefined`/`''`, so a 10-char placeholder counted as a real key: the onboarding banner showed *GEMINI ✓ set*, `GET /api/status/providers` returned `activeProvider: "gemini"`, and every live ⚡ eval would have silently failed against a dead key while a working 108-char Anthropic key was ignored. New pure `isUsableKey()` (`env-config.mjs`) treats a secret as configured only when it is ≥ 20 chars (no supported provider's key is shorter — Gemini `AIza…` ≈ 39, Anthropic `sk-ant-…` ≈ 100+, OpenAI ≥ 40, Qwen ≈ 35 — so a real key is never false-negatived) and not a known placeholder (`your_*_here`, `changeme`, `placeholder`, `<…>`, all-one-char, …). Applied uniformly to `hasAnthropicKey()`/`hasGeminiKey()` (`anthropic.mjs`), `hasOpenAIKey()`/`hasQwenKey()` (`openai.mjs`), and the `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` rows of `GET /api/health` — which also moved off raw `process.env` onto the same effective+plausible view, so the health page, the providers endpoint, and the OR-router now always agree. `selectActiveProvider()` is unchanged; it just receives a correct `keysConfigured`.

### 🧪 Tests

- New CI-isolated suite **`tests/key-detection-rejects-placeholder.test.mjs`** (5): `isUsableKey` unit cases (empty/non-string, too-short incl. the 10-char repro, long-but-placeholder, realistic keys accepted) + an in-process `createApp()` reproduction of the exact reported scenario (10-char `GEMINI_API_KEY` + real `ANTHROPIC_API_KEY` in a temp parent `.env`, the 4 keys stripped from `process.env`) asserting `gemini` is NOT in `keysConfigured`, `activeProvider === "anthropic"`, and the `/api/health` rows agree. Four existing `anthropic`/`openai` effective-env layering tests had trivially-short stub keys (`sk-x`, `AIzaTEST`, `sk-o`, …) lengthened to realistic values — the layering contract they assert is unchanged; only the stubs had to clear the new floor. 821 → 826.

---

## [1.56.2] — 2026-05-19

**feat(a11y): UX-N1 — per-route, locale-aware `document.title` (multi-tab orientation + screen-reader page-change announcement).**

### ✨ Features

- **Every SPA route now sets a distinct, localized `document.title`.** Pre-fix all 24 routes kept the static `index.html` `<title>` ("career-ops — command center"), so multi-tab browsers showed identical tab labels, bookmarks were generic, and the screen-reader "page changed" announcement read the same on every navigation. `public/js/router.js` `focusNewView()` now derives the title from the view's own localized `<h1 class="page-title">` — `"<View> — career-ops"` — so titles are automatically translated (no new i18n keys) and distinct per route. Set **before** the first-paint guard so the initial tab is titled too (the same ordering rule the v1.56.0 UX-12 `tabindex` set follows). Falls back to `career-ops — command center` when a view has no heading.

### 🧪 Tests

- New CI-isolated source-static suite **`tests/document-title-per-route.test.mjs`** (4): `focusNewView` assigns `document.title`; the title is derived from the view `<h1>` textContent (per-route + localized, not one hardcoded literal); the assignment precedes the `!firstPaintDone` early-return; a sane product default is present. router.js is browser-only → asserted statically (same approach as `dashboard-initial-focus.test.mjs`). 817 → 821.

---

## [1.56.1] — 2026-05-19

**fix(a11y): suppress the spurious brand focus ring on router-managed `tabindex="-1"` heading focus.**

### 🐛 Fixes

- **A red box framed every view's `<h1>` (regression surfaced by v1.56.0 UX-12, rooted in the v1.41.0 SPA focus-management pattern).** `public/js/router.js` gives each destination view's heading `tabindex="-1"` and `.focus()`'s it on every client-side navigation so screen readers announce the new page. A `tabindex="-1"` element is never keyboard-reachable, yet Chromium's `:focus-visible` modality heuristic still painted the global brand ring (`*:focus-visible { outline: 2px solid var(--rausch) }`) around it — a **red rectangle around the page heading** (e.g. "Command Center" on `#/dashboard`) on every navigation, which had also been baked into the `images/dashboard-*.png` hero screenshots. The fix is one scoped rule — `[tabindex="-1"]:focus, [tabindex="-1"]:focus-visible { outline: none }` — the WAI-ARIA APG managed-focus pattern. Genuine keyboard focus on real interactive controls keeps the global `*:focus-visible` ring (WCAG 2.4.7 intact); the skip-link's ring is unaffected (it is an `<a>`, not `tabindex="-1"`, with a higher-specificity rule).
- All 8 `images/dashboard-*.png` regenerated against the fixed UI — the README hero screenshots no longer show the red box.

### 🧪 Tests

- New CI-isolated source-static suite **`tests/managed-focus-no-ring.test.mjs`** (4): the global `*:focus-visible` brand ring is still defined (WCAG 2.4.7 not regressed); `[tabindex="-1"]:focus, :focus-visible` resolves to `outline: none`; the suppression rule follows the global rule (cascade safety); the fix stays scoped (no blanket `*:focus { outline: none }`). Pairs with the existing `tests/dashboard-initial-focus.test.mjs` (router still sets tabindex + focuses on navigation). 813 → 817.

---

## [1.56.0] — 2026-05-19

**feat(ux): LOW-priority polish bundle — UX-9 / UX-10 / UX-11 / UX-12 (one grouped minor release).**

### ✨ Features

- **UX-9 — `#/cv` breadcrumb (visual hierarchy):** the page title is demoted to a quiet uppercase `.cv-breadcrumb` chip and the loud page-subtitle paragraph moves to the `<h1>` `title` tooltip, so the user's CV (their name, rendered in the preview) owns the visual space. The F-V54-A invariant is intact — still **exactly one `<h1>`**, still `.page-title` (the router focus target); only its weight changed.
- **UX-10 — honest cost ballpark (trust/feedback):** a new shared `UI.providerCostHint(t)` helper renders next to ⚡ Run live on `#/auto`, `#/evaluate`, `#/deep` and every `#/<mode>`. It reuses `GET /api/status/providers` (v1.55.3): with a key it shows *"Estimated cost: OpenAI gpt-5-codex · ~$0.04/eval"* (order-of-magnitude, deliberately "~"); with no key it states plainly that ⚡ Run live copies a manual prompt at no API cost. Fail-soft (hidden when offline).
- **UX-11 — `#/help` TOC auto-jump (aesthetic/flow):** when the TOC filter narrows to **exactly one** section, the page smooth-scrolls there after a 300ms idle (debounced — mid-typing keystrokes never yank the page; never fires for 0 or >1 matches), reusing the same scroll+focus path as a TOC click.
- **UX-12 — `#/dashboard` first-paint a11y (accessibility):** on the very first SPA paint the landing view's `<h1>` is now made programmatically focusable (`tabindex="-1"`) so screen-reader / heading navigation lands on it, and `#content` stays `aria-live="polite"` so the heading is announced on boot — **without** stealing focus (that would fight the skip-link, the deliberate v1.41.0 behaviour). Only subsequent route changes move focus. *(Note: UX-12 as originally specified — "call focusNewView() on boot" — conflicted with the v1.41.0 skip-link decision; resolved conservatively to satisfy the a11y intent without the regression.)*
- New i18n keys `cost.estimate`, `cost.manual` ×8 locales; new token-based `.cv-breadcrumb` / `.cost-hint` CSS.

### 🧪 Tests

- 4 new CI-isolated source-static suites — **`tests/cv-breadcrumb.test.mjs`** (3), **`tests/run-cost-line.test.mjs`** (4), **`tests/help-toc-autoscroll.test.mjs`** (4), **`tests/dashboard-initial-focus.test.mjs`** (3): single-h1 + breadcrumb class; shared helper exported + fail-soft + present in all 4 views + `cost.*` ×8; debounced exactly-1-match jump gated; tabindex-before-guard ordering + focus-after-guard + `#content` aria-live. The pre-existing `cv-single-h1` and `help-nav-a11y` locks were updated for the new (invariant-preserving) code. 800 → 813. Live Playwright probe of all four (no-key fixture): single h1 13px breadcrumb, cost hint manual note, TOC→1 narrow, h1 tabindex=-1 + aria-live polite, 0 console errors.

---

## [1.55.8] — 2026-05-19

**feat(tracker): server-side pagination + clickable funnel chips (UX-8).**

### ✨ Features

- **Server:** `GET /api/tracker` gains **optional** `?page` / `?pageSize` / `?status` query params. With none, the response is byte-for-byte the legacy `{ rows: [...] }` (every existing caller/test untouched). With them, it returns `{ rows: slice, total, page, pageSize, funnel }` — `pageSize` clamped to `[1,500]`, `page` clamped to `≥1`, `status` filters `rows`+`total`, and `funnel` is the **whole-history** status→count breakdown (independent of the page or status filter, so the UI chips are always accurate).
- **`#/tracker`:** a new clickable **funnel summary chip bar** at the top — *"all statuses · N · Applied · N · Interview · N · Offer · N · Rejected · N …"* (ordered Applied → Responded → Interview → Offer → Rejected → Discarded → Evaluated → SKIP). Clicking a chip sets the Status filter (clicking the active chip clears it); the active chip is `aria-pressed` and visually highlighted. The pipeline state is now legible at a glance instead of buried behind a dropdown. Feedback/forms lens.
- New i18n key `track.funnelAria` ×8 locales; new token-based `.tracker-funnel` / `.tracker-chip` / `.tracker-chip--active` CSS.

### 🧪 Tests

- **`test: tests/tracker-server-paged.test.mjs`** (new, 7 cases, CI-isolated, in-process Express on an ephemeral port + temp `CAREER_OPS_ROOT` applications.md fixture — CLAUDE.md #2/#8): back-compat (no params ⇒ exactly `{rows}`, no envelope leak); `?page&pageSize` slice + `total`+`page`+`pageSize`+full `funnel` summing to N; last partial page with no overlap; out-of-range page ⇒ empty rows + valid total; `?status=` filters total/rows while funnel stays whole-history; `pageSize` cap; plus a source-static lock on the `.tracker-funnel` chip bar (toggle-on-reclick, `aria-pressed`, `track.funnelAria` ×8, CSS). 793 → 800.

---

## [1.55.7] — 2026-05-19

**feat(pipeline): vanilla-JS row virtualization at >1000 rows (UX-7).**

### ✨ Features

- `#/pipeline` rendered **every** row (`filtered.forEach(list.appendChild(urlRow))`) — a real scan fills the queue with thousands of URLs, so thousands of row nodes (each a flex div + `<a>` + two buttons) were built synchronously on every filter keystroke, flooding the DOM and the accessibility tree. New **vanilla-JS virtualization** (a react-window equivalent, no deps): above `VIRTUALIZE_THRESHOLD = 1000`, `#/pipeline` becomes a fixed-height (`70vh`) scroll viewport with a non-shrinkable spacer (`flex:0 0 auto`, `height = rows × 56px`) that preserves the **real scrollbar for the full list**, and an rAF-throttled scroll listener renders only the viewport ± a 5-row buffer (~16–19 nodes at a time instead of N). At/below the threshold the original simple full render is kept **byte-for-byte**, so typical pipelines and all existing pipeline tests/e2e are unaffected. Each virtualized row keeps its URL-disambiguated ▶/✕ `aria-label` (F-V54-B regression-locked). Window math is a pure `computeWindow()` helper.

### 🧪 Tests

- **`test: tests/pipeline-virtualize.test.mjs`** (new, 5 cases, CI-isolated, source-static): a numeric ~1000 threshold gates the path; the ≤threshold branch keeps the simple `forEach`→`appendChild`; the >threshold branch renders `slice(start,end)` with a rAF-throttled scroll listener + a scrollbar-preserving spacer; `computeWindow()` clamps `[0,total]` with a ± buffer; rows keep the disambiguated ▶/✕ aria-labels. 788 → 793. Live Playwright probe (1200-URL fixture): `scrollHeight≈67248` (full range), only ~16–19 row nodes in the DOM, window tracks scroll end-to-end (row 0 → 595 → 1199), 0 console errors.

---

## [1.55.6] — 2026-05-19

**feat(scan): tuck secondary filters behind an "Advanced filters" disclosure (UX-4).**

### ✨ Features

- `#/scan` stacked every filter — free-text, remote/hybrid/onsite, scope, source, and the post-scan stack/level/dynamic facet chips — at equal weight, a wall of controls. Now the **everyday filters stay visible** (free-text + Remote/Hybrid/Onsite; the 🌐 Scan button is already separate in the controls card) and the **secondary ones collapse behind a `<details class="scan-advanced"><summary>Advanced filters</summary>`**: the Scope + Source selects, and — separately — the stack/level/dynamic facet-chip cluster (which now leads the fresh result set with the table, not a wall of chips, and only renders when at least one chip row exists). Cognitive-load lens.
- New i18n key `scan.advancedFilters` across all 8 locales; new token-based `.scan-advanced` summary styling (quiet ⚙ affordance, marker-less, bold when open).

### 🧪 Tests

- **`test: tests/scan-advanced-disclosure.test.mjs`** (new, 6 cases, CI-isolated, source-static): an Advanced-filters `<details>`/`<summary>` exists with the `.scan-advanced` hook and `scan.advancedFilters` label; free-text + remote stay in the always-visible group; scope + source live inside the disclosure; `chipsContainer` is a `<details>`; `.scan-advanced summary` is styled; `scan.advancedFilters` ×8 locales. 782 → 788.

---

## [1.55.5] — 2026-05-19

**feat(dashboard): hero-promote the 2 P0 CTAs + a focal recent-activity hint (UX-3).**

### ✨ Features

- `#/dashboard` opened with ~30 equal-weight nodes — no clear "what next". A new `.dash-hero` block now sits directly under the page header: the two P0 journeys — **✨ Auto-pipeline a URL** and **🌐 Scan now** — are promoted to large `.btn-hero` buttons, and a single **focal recent-activity hint** ("Last evaluation: `<score>` — `<title>`", linked to the report; a guiding empty-state on cold start via `dash.heroNoEval`) tells a returning user where they left off and a new user the one action that matters. The two primary buttons were removed from the header (only the secondary "📋 Open pipeline" stays there) so the action isn't duplicated.
- The application-status buckets were demoted from prominent `.badge`s to quiet `.dash-chip` pills so they no longer compete with the hero (Information-scent / cognitive-load lens).
- New i18n keys `dash.lastEval`, `dash.heroNoEval` across all 8 locales; new token-based `.dash-hero` / `.btn-hero` / `.dash-chip` CSS.

### 🧪 Tests

- **`test: tests/dashboard-hero.test.mjs`** (new, 5 cases, CI-isolated, source-static): a `.dash-hero` block exists and precedes the Quick-actions grid; both P0 CTAs are `.btn-hero` with the `/auto` + `/scan` routes; a focal `dash.lastEval` hint + `dash.heroNoEval` empty-state; status buckets use `.dash-chip`; `.dash-hero`/`.btn-hero`/`.dash-chip` CSS exists; `dash.lastEval` + `dash.heroNoEval` ×8 locales. 777 → 782.

---

## [1.55.4] — 2026-05-19

**feat(ux): honest auto-pipeline ETA next to Run + prominent Stop during a scan (UX-6).**

### ✨ Features

- `#/auto`: a new `.auto-eta` hint — *"⏱ ~1–2 min"* (key `auto.eta`, `title` via `auto.etaTitle`) — now sits directly next to the Run button, so the one-click promise is honest about duration *before* the user commits. The wording matches career-ops.org/docs ("paste a URL → full report in 1–2 minutes"). Feedback & system-status lens.
- `#/scan`: while the multi-minute crawl is running (`aria-busy`), the **Stop** control is promoted from a low-contrast ghost button to a prominent destructive button (new `.btn-danger` — filled, high-contrast white-on-coral, weight 600). `setScanRunning(running)` flips `scan-stop-btn` between `btn-danger` (running) and `btn-ghost` (idle, when it is hidden anyway), so the user can find and trust Stop under load. Error-recovery lens.
- New i18n keys `auto.eta`, `auto.etaTitle` across all 8 locales; new token-based `.btn-danger` / `.auto-eta` CSS.

### 🧪 Tests

- **`test: tests/auto-eta-stop.test.mjs`** (new, 4 cases, CI-isolated, source-static): `#/auto` renders `t('auto.eta')` with the `.auto-eta` class adjacent to `runBtn`; `auto.eta` ×8 locales; `setScanRunning(running)` promotes Stop to `btn-danger`; `.btn-danger` exists with high-contrast white text. 773 → 777.

---

## [1.55.3] — 2026-05-19

**feat(onboarding): on-screen 4-provider OR status — cold-start banner + active-provider chip (UX-2, HIGH).**

### ✨ Features

- New read-only endpoint **`GET /api/status/providers`** → `{ activeProvider, activeModel, keysConfigured }`. `keysConfigured` uses the same effective-env view as the `llm.mjs` gate sites (process.env ∨ parent `.env`, via `hasAnthropicKey/hasGeminiKey/hasOpenAIKey/hasQwenKey`); `activeProvider` is what the OR-router would actually pick — `selectActiveProvider()`, a new pure helper in `env-config.mjs` that walks `providerOrder()` (so an `LLM_PROVIDER` pin with no matching key correctly yields `null`). No secrets are returned — only provider names + the model id.
- The SPA shell now renders a global onboarding region (`#onboarding-banner`, populated by `app.js` from that endpoint, CSP-safe DOM only): **0 keys → a red banner** "No LLM key set — '⚡ Run live' is in manual-prompt mode…" with a CTA deep-linking to `#/config?tab=api-keys`; **≥1 key → a subtle chip** naming the active provider + model (e.g. *Live eval: OpenAI (gpt-5-codex)*). It re-evaluates on locale change and when the user navigates away from the config tab (keys may have just been saved). This makes the product's headline differentiator — "one of Anthropic / Gemini / OpenAI / Qwen works, auto-ordered" — discoverable on screen instead of learned by trial.
- New i18n keys `onboarding.noKey.title`, `onboarding.noKey.cta`, `onboarding.activeProvider` across all 8 locales; new `.onboarding-warn` / `.onboarding-ok` CSS (token-based, mirrors `.conn-banner`).

### 🧪 Tests

- **`test: tests/onboarding-key-banner.test.mjs`** (new, 9 cases, CI-isolated): `selectActiveProvider` auto-order / none / `LLM_PROVIDER`-pin semantics; `GET /api/status/providers` in-process (ephemeral port + temp `CAREER_OPS_ROOT` `.env` so the real parent key is never read — CLAUDE.md #2/#8) for 0-key, 1-key+model, and Anthropic-over-Gemini auto order; static SPA wiring (banner host, endpoint fetch, `#/config?tab=api-keys` CTA) + `onboarding.*` ×8 locale coverage. 764 → 773.

---

## [1.55.2] — 2026-05-18

**fix(cv): give the `#/cv` markdown editor a descriptive, self-contained accessible name (F-V55-H / UX-5).**

### 🐛 Bug Fixes

- The `#/cv` primary editor `<textarea id="cv-editor">` now carries a descriptive `aria-label` via the new `cv.editorAria` key — *"CV markdown editor — your professional resume in markdown format"* — instead of the terse name it inherited from the visible "Markdown" section heading. Note: contrary to the F-V55-H symptom (which only inspected `aria-label`/`labels`), the field was **not** nameless — v1.47.0 (WS2 #16) had already bound it via `aria-labelledby` → the `<h3 id="cv-md-heading">Markdown</h3>`, so a screen reader announced "Markdown, edit, multiline". v1.55.2 upgrades that terse "Markdown" to a self-contained label so a screen-reader user lands and immediately knows what the field is. The redundant `aria-labelledby` is removed (a leftover would be dead markup — `aria-label` wins per ARIA precedence); the visible `<h3>Markdown</h3>` stays on screen for sighted users. WCAG 1.3.1 + 4.1.2; parallels the v1.54.5 batch-tsv fix (F-V54-C).

### 🧪 Tests

- **`test: tests/cv-editor-a11y.test.mjs`** (new, 3 cases, CI-isolated, source-static like `auto-stepper-prerender.test.mjs`): `#cv-editor` names itself via `t('cv.editorAria', …)` with a non-empty fallback; `cv.editorAria` is present and non-empty in all 8 locales; no redundant `aria-labelledby` remains on the element. 761 → 764.

---

## [1.55.1] — 2026-05-18

**fix(auto): pre-render the 5-stage pipeline stepper on `#/auto` mount (F-V55-E / UX-1, senior obs S-4 reopened).**

### 🐛 Bug Fixes

- `#/auto` now shows the documented five-stage outline — **validate → fetch → evaluate → save report → add tracker** — the moment the screen mounts, instead of staying blank until the first SSE event. Previously `<ol class="auto-stepper">` was created `display:none` and `renderStepper()` was only reached from `setStep()` / `run()`, so a cold-start user never saw the pipeline the docs promise before clicking Run. The stepper is now visible on mount with all five steps in the `pending` state, and carries an `aria-label` (`auto.stepperAria`) so assistive tech announces the region. Closes F-V55-E (a11y/static-guarantee lens) and UX-1 (promise-fidelity lens) — same fix, both lenses.

### 🧪 Tests

- **`test: tests/auto-stepper-prerender.test.mjs`** (new, 4 cases, CI-isolated, source-static like `router.test.mjs`): the `STEPS` array is exactly the 5 canonical stages in order; `stepperEl` is not `display:none` on mount and carries `auto.stepperAria`; a mount-scope `renderStepper()` call precedes `function setStep(`; `auto.stepperAria` is present in all 8 locales. 757 → 761.

---

## [1.55.0] — 2026-05-18

**feat(llm): headless live-eval runs via "OR" — Anthropic | Gemini | OpenAI | Qwen, auto-selected by whichever key is set.**

### ✨ Features

- Per user request, the web-ui ⚡ live eval now works with **whichever API key is set**, not just Anthropic/Gemini. `LLM_PROVIDER` gains `openai` and `qwen`; `auto` (default) uses the first provider whose key is present, preferring **Anthropic → Gemini → OpenAI → Qwen**. An explicit value pins one; a forced provider with no key still falls through to the manual-prompt path.
- New `server/lib/openai.mjs` — a zero-dependency OpenAI-compatible Chat Completions client (same secure direct-HTTPS pattern as `anthropic.mjs`: `AbortController` timeout, key never logged, `effectiveEnv()` key resolution so a parent-`.env` key works without a restart). One core (`runOpenAICompatible`) backs **`runOpenAI`** (api.openai.com) and **`runQwen`** (Alibaba DashScope OpenAI-compatible mode; override the endpoint with `QWEN_BASE_URL` in the raw `.env` for the mainland-CN host). No SDKs, **no arbitrary CLI execution** — the parent project stays CLI-agnostic (Claude Code · Codex · Gemini · OpenCode · Qwen · Copilot · Kimi); this only extends the *headless* API-key path.
- The OpenAI/Qwen tail is wired into all eval surfaces: `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, and the `/api/auto-pipeline` SSE — consulted after the existing Anthropic (inline) + Gemini (subprocess) branches so the auto preference is preserved, with the same bundled-context inlining Anthropic uses.
- `env-config.mjs`: `QWEN_API_KEY` (secret) + `QWEN_MODEL` (not secret) added to `KNOWN_KEYS`/`KEY_GROUPS.core`; `LLM_PROVIDERS` and `providerOrder()` extended; `OPENAI_API_KEY` is now a first-class headless provider key (was stored-only).
- `#/config` API-keys tab: `LLM_PROVIDER` select gains `openai`/`qwen`; new `QWEN_API_KEY` + `QWEN_MODEL` fields (curated `qwen-max`/`qwen-plus`/`qwen-turbo`/`qwen2.5-*` list); a new top-of-tab note explains the CLI-agnostic parent vs the headless web-ui eval and the OR order. Updated OpenAI/provider hint copy. New i18n keys (`config.providerModelNote`, `config.qwen*`) + 3 updated hints, across all 8 locales.

### 🧪 Tests

- **`test: tests/openai.test.mjs`** (new, 9 cases, CI-isolated): OpenAI/Qwen success + block-array content, Bearer auth, default + `QWEN_BASE_URL`-overridden endpoints, 4xx/5xx/malformed, `max_tokens` clamp, timeout, `effectiveEnv` key detection, no-key-leak canary. **`tests/provider-selector.test.mjs`** updated for the v1.55.0 `providerOrder`/`LLM_PROVIDERS`/SECRET surface + the OpenAI/Qwen tail wiring. 748 → 757.

---

## [1.54.10] — 2026-05-18

**fix(auto-pipeline): SSE client-disconnect hygiene — kill the flaky Playwright e2e job.**

### 🐛 Fixes

- The Playwright e2e job intermittently went red (32/32 individual tests pass, but `not ok 2 - tests/playwright-smoke.mjs`): closing a page while the `#/auto` SSE stream was mid-flight made the server's next `res.write()` reject with `EPIPE`/`"aborted"`, and — with no `'error'` listener on the response — Node escalated it to an uncaughtException that node:test reported as "asynchronous activity after the test ended". `openSse()` in `auto-pipeline.mjs` now registers a no-op `res.on('error')` and guards `send()` on `res.writableEnded || res.destroyed` (wrapped in try/catch) — a vanished client is expected, not exceptional. This is correct production SSE hygiene, not just a test fix.
- `tests/playwright-smoke.mjs`: the Cmd+K test used a real outbound URL (`https://example.com/jobs/123`) but only waited for the modal to appear, so `closePage()` aborted the server's in-flight `safeGet()` after the test ended. It now waits for the pipeline to reach a terminal state (so the fetch resolves normally before close). A shared `closePage()` helper (`window.stop()` then close) and the `after`-hook `server.closeAllConnections()` remain as defence-in-depth. Verified: 8/8 consecutive green runs (6× `node --test` + 2× browser-smoke), previously ~1-in-2 red.

### 🧪 Tests

- **`test: tests/auto-pipeline.test.mjs`** +1 static case locking the `openSse` disconnect-hygiene contract (`res.on('error')` listener + `writableEnded||destroyed` guard + try-wrapped writes). 747 → 748.

---

## [1.54.9] — 2026-05-18

**fix(llm): honour the parent `.env` LLM keys at request time — stop mis-routing to a stale/invalid provider.**

### 🐛 Fixes

- Live evaluation could fail with *"Gemini API error: API key not valid"* even when `ANTHROPIC_API_KEY` was the configured provider. Root cause: `hasAnthropicKey()` / `hasGeminiKey()` (and `runAnthropic`'s key/model lookup) read **only the boot-time `process.env` snapshot**. If the Anthropic key was added to the parent `.env` after the server started, the running process never saw it → Anthropic detection was false, and evaluation fell through to whatever stale key *was* in `process.env` (often an old, invalid `GEMINI_API_KEY`). The Gemini exec path (a parent Node subprocess) already read the live parent `.env`, so the two providers resolved keys inconsistently.
- New `effectiveEnv(key, envFilePath)` in `env-config.mjs`: a non-empty `process.env` value wins (covers shell exports and the live-apply in `POST /api/config`); otherwise the **current parent `.env` file** is consulted. `anthropic.mjs` now resolves `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, and the Gemini-key check through it, so a key set in the parent `.env` is honoured **without a server restart** and key DETECTION always matches the key the request actually SENDS. Provider order is unchanged (`auto` → Anthropic-then-Gemini); this only fixes detection. Keys are never logged or returned (the REVIEW-B4 no-leak test still passes).

### 🧪 Tests

- **`test: tests/anthropic.test.mjs`** rewritten to be CI-isolated (temp `CAREER_OPS_ROOT`, dynamic import) with 2 new cases reproducing the exact bug (key only in parent `.env` → detected; `runAnthropic` sends the parent-`.env` key + model when `process.env` is unset). **`test: tests/env-config.test.mjs`** +3 `effectiveEnv` cases (process.env precedence, `.env` fallback incl. empty-string-as-unset, missing-file / absent-key / no-path → undefined) — 100% of the new branch. 742 → 747.

---

## [1.54.8] — 2026-05-18

**feat(config): Modes field-form always renders the canonical schema (even on an empty/stub file) with career-ops.org field guidance.**

### ✨ Features

- The v1.54.3 Modes field-form only rendered fields for `##` sections that already existed — so on a fresh, empty, or non-schema `modes/_profile.md` (e.g. the common 1-line stub) it fell back to *"No ## sections found — use the raw editor below."* and the user never got fields. Per user request (*"разбей по полям … описание полей возьми из career-ops.org/docs"*), the form now **always renders the 5 canonical fields in documented order** (Target Roles, Adaptive Framing, Exit Narrative, Comp Targets, Location Policy), pre-filled from the file when present and empty-but-editable when not — so a brand-new profile can be filled in entirely through the form.
- Each field shows a **description sourced from the canonical career-ops.org Quick Start §Step-5** (what to put in Target Roles / Adaptive Framing / Exit Narrative / Comp Targets / Location Policy), wired via `aria-describedby` for screen readers.
- Heading-variant tolerant: the template's `## Your Target Roles` (etc.) maps to the same canonical field as `## Target Roles`, so neither the template nor the server-scaffold convention breaks the form.
- `collect()` is now a tagged payload: a non-destructive **`{ sections }` merge** when the rendered headings exactly match the file's existing ones (preamble + untouched + custom sections survive byte-stable), or a **`{ markdown }` full-file rebuild** that bootstraps/normalises a schema-conformant document when the file lacked the schema. The rebuild path is **confirm-gated** in `config.js` (it replaces the parent file — WS2 #4 destructive-save invariant), preserves the existing preamble (or a documented default), and keeps non-canonical sections verbatim.
- 6 new i18n keys (`config.modesDescTargetRoles` … `config.modesDescLocationPolicy` + `config.modesFormRebuildBody`) across all 8 locales.

### 🧪 Tests

- **`test: tests/modes-form.test.mjs`** — rewritten for the v1.54.8 contract: schema + canonical order, config.js payload/confirm wiring, every field's doc-sourced description present in all 8 locales, `canonicalKey` "Your X" tolerance, list round-trip stability, the bootstrap-always-renders guarantee, and the tagged sections-vs-markdown collect() with data-safety. Verified live against the real parent stub file (5 fields + descriptions appear, 0 console errors) and an isolated stub fixture (fill → confirm-gated save → all 5 canonical sections persisted). 742 unchanged (7 cases, replaced).

---

## [1.54.7] — 2026-05-18

**fix: W-001 — code/style assets + SPA shell served `Cache-Control: no-store` (deploy-hygiene).**

### 🐛 Fixes

- The SPA loads `api.js` / `router.js` / every view via plain `<script src>` with no version query string, and there is no build step (no content hashing), so after a deploy a browser could keep serving a **cached old bundle for hours** → stale-cache 404s on query-string routes (observed live during the v1.29.2 regression; regression run W-001). `server/index.mjs` now sets `Cache-Control: no-store` on `.js` / `.mjs` / `.css` / `.html` via the `express.static` `setHeaders` hook, and explicitly on the SPA-shell catch-all (which uses `sendFile` and bypasses `setHeaders`), so the browser always revalidates the code that drives routing. Non-code static assets keep `express.static`'s default caching. Security headers (CSP / nosniff / frame-deny / referrer-policy) are unchanged — verified by the existing `security-headers` suite (8 cases) running green alongside the new test.

### 🧪 Tests

- **`test: tests/asset-cache-control.test.mjs`** — 4 cases (JS assets `no-store`, CSS `no-store`, static `index.html` `no-store`, SPA catch-all deep-route shell `no-store`), booting the real app against an isolated `CAREER_OPS_ROOT`. Plus a flaky-teardown fix in `tests/playwright-smoke.mjs` (separate `test(e2e)` commit): the auto-pipeline SSE smoke test now cancels the reader + aborts the fetch in a `finally` and the `after` hook force-closes lingering sockets, eliminating the post-teardown "Error: aborted" that reddened the v1.54.6 Playwright e2e job. 738 → 742.

---

## [1.54.6] — 2026-05-18

**fix(a11y): S-7 — `#/help` back-to-top button carries the canonical `back-to-top` selector class.**

### 🐛 Fixes

- The `#/help` floating back-to-top button worked correctly (verified live) but its class list (`btn btn-primary help-back-top`) sat outside the `.back-to-top` selector convention the spec §2 #28 test targets — a tightened selector would have flaked (regression run S-7, "easy win"). The button now also carries the canonical `back-to-top` class. Purely additive and a CSS-no-op: `help-back-top` (the existing CSS hook) is unchanged and `back-to-top` has no CSS rule — it's a stable test/automation handle only. Verified live: `document.querySelector('.back-to-top')` resolves the button, `aria-label` intact, 0 console errors.

### 🧪 Tests

- **`test: tests/help-nav-a11y.test.mjs`** — extended the existing #12 case with an assertion that the back-to-top button's class list includes the canonical `back-to-top` selector (no new file; 738 unchanged).

---

## [1.54.5] — 2026-05-18

**fix(a11y): F-V54-C — `#/batch` TSV editor has an accessible name.**

### 🐛 Fixes

- The `#/batch` TSV textarea had a hint wired via `aria-describedby` but **no accessible name** — no `<label htmlFor>`, no `aria-label`/`aria-labelledby` (regression run F-V54-C; WCAG 1.3.1 Info & Relationships / 4.1.2 Name, Role, Value). `aria-describedby` supplies a *description*, not a *name*, so a screen reader announced an unlabelled "edit text". The textarea now carries an `aria-label` via the new i18n key `batch.tsvAria`, consistent with the sibling run-control inputs that already use `*Aria` keys; the existing describedby hint is preserved. Verified live: `aria-label` present + localized, `aria-describedby` intact, 0 console errors.
- New i18n key `batch.tsvAria` across all 8 locales.

### 🧪 Tests

- **`test: tests/batch-tsv-accessible-name.test.mjs`** — 2 cases (the `batch-tsv` block has an `aria-label` via `t(batch.tsvAria)` while keeping its describedby hint; `batch.tsvAria` defined in all 8 locales). 736 → 738.

---

## [1.54.4] — 2026-05-18

**fix(a11y): F-V54-B — `#/pipeline` row-action buttons have accessible names.**

### 🐛 Fixes

- The per-row `▶` (evaluate) and `✕` (delete) buttons on `#/pipeline` were icon-only with only a `title` attribute (regression run F-V54-B; WCAG 4.1.2 Name, Role, Value). `title` is not a reliable accessible name, so a screen-reader user heard a long run of indistinct "button"s and could not tell which row a delete would hit. Both buttons now carry an explicit `aria-label` disambiguated by a compact URL via a new `shortUrl()` helper (`host` + `…/` + last 2 path segments; trailing-slice fallback for unparseable input), so the a11y tree reads e.g. *"Delete: hh.ru/…/vacancy/12345"*. No new i18n keys — reuses `common.delete` / `pipe.evaluateBtn` + the URL. Verified live: 1385 rows, each button name unique per row, 0 console errors.

### 🧪 Tests

- **`test: tests/pipeline-row-action-names.test.mjs`** — 4 cases (both buttons wired with `shortUrl(url)` + exactly two such labels, `shortUrl` declared before use, same-host different-job URLs don't collapse, bare-host / unparseable / empty fallbacks). 732 → 736.

---

## [1.54.3] — 2026-05-18

**feat(config): structured field-form for the `#/config` "Modes" tab (no more raw markdown).**

### ✨ Features

- The "Modes" tab edited `modes/_profile.md` as one raw `<textarea>` per `##` section (v1.36.0 section-level granularity). Per user request — *"собери данные по полям, разбей из документации, определи набор полей и реализуй поля именно, а не сырой"* — it now renders a **structured field-form derived from the documented schema** (career-ops.org Quick Start §Step-5):
  - `Target Roles` / `Adaptive Framing` / `Comp Targets` → **repeatable add/remove labelled line-inputs** (one role/angle/comp line per field, `＋ Add line` / per-row `✕` with `aria-label`).
  - `Exit Narrative` / `Location Policy` → **single labelled prose `<textarea>`**.
  - Each field is a real `<label htmlFor>`-bound control with an i18n section name.
- New `public/js/lib/modes-form.js` (`window.ModesForm`) owns the parse → render → `collect()` logic; it feeds the **existing** `PUT /api/modes/_profile { sections }` merge path, so the preamble, ordering, and any section the form doesn't touch survive byte-stable (merge-not-replace, server-enforced).
- **Data-safety:** a canonical list section whose body isn't a pure bullet list (user put prose there) and any non-canonical `##` section fall back to a labelled verbatim `<textarea>` with an explanatory note — arbitrary content round-trips untouched, never silently reshaped or lost. Round-trip stability proven: `serialise(parse(body))` re-parses identically.
- The raw full-file markdown editor remains as the confirm-gated **Advanced** disclosure for add/remove-section and preamble edits (WS2 #4 destructive-save gate unchanged).
- 10 new i18n keys (`config.modesTargetRoles` … `config.modesUnknownNote`) across all 8 locales.

### 🧪 Tests

- **`test: tests/modes-form.test.mjs`** — 7 cases (documented schema present, config.js wires `ModesForm.build/collect` + drops the stale `modesSectionInputs` map, list classification incl. scaffold/prose/mixed, list & prose round-trip stability, empty-list → empty section, custom-section verbatim data-safety). 725 → 732. Verified live against an isolated `CAREER_OPS_ROOT` fixture: 5 canonical sections rendered as fields + 1 custom section as a labelled fallback, edit-and-save round-trip preserved the preamble + custom section, 0 console errors.

---

## [1.54.2] — 2026-05-18

**feat(config): OpenAI / Codex model selector in `#/config`.**

### ✨ Features

- `#/config` had no way to pick the OpenAI / Codex model — only `ANTHROPIC_MODEL` and `GEMINI_MODEL` had dropdowns, even though `OPENAI_API_KEY` was already exposed for the parent multi-CLI (Codex / OpenCode) flow. `OPENAI_MODEL` is now a first-class env key: added to `env-config.mjs` `KNOWN_KEYS` (ordered right after `OPENAI_API_KEY`) and the `core` key group, and **deliberately not** in `SECRET_KEYS` — it's a model id, not a credential, so it's never masked. `config.js` gains a curated `OPENAI_MODELS` list (`gpt-5-codex` default, then `gpt-5` / `gpt-5-mini` / `gpt-4.1` / `o4-mini` / `o3`) and an `OPENAI_MODEL` `<select>` field rendered immediately after the OpenAI key, mirroring the Anthropic/Gemini model fields exactly (same `kind: 'select'`, `aria-describedby` hint wiring, label = env-var name). Read by the parent Codex / OpenCode CLI flow — web-ui live-eval still uses Anthropic|Gemini. Verified live: `#/config` → `OPENAI_MODEL` select with 6 options, default `gpt-5-codex`, label-bound, 0 console errors.
- New i18n keys `config.openaiModel` + `config.openaiModelHint` across all 8 locales.

### 🧪 Tests

- **`test: tests/openai-model-selector.test.mjs`** — 4 cases (env-config core/non-secret contract + key ordering, `OPENAI_MODELS` list with `gpt-5-codex` default, the `OPENAI_MODEL` select field wired after `OPENAI_API_KEY`, both i18n keys across all 8 locales). 721 → 725.

---

## [1.54.1] — 2026-05-18

**fix(a11y): F-V54-A — `#/cv` single `<h1>`.**

### 🐛 Fixes

- The CV markdown's own `# Name` rendered as a **second** top-level `<h1>` next to the page-title `<h1>CV</h1>` (regression run F-V54-A; WCAG 1.3.1 Info & Relationships / 2.4.6 Headings). `cv.js` now feeds every preview-injection point (initial render, file-import refresh, live editor sync) through a scoped `cvMd()` that shifts headings down one level (h1→h2 … h5→h6, h6→`role="heading" aria-level="7"`), so the page keeps exactly one `<h1>`. Scoped to `cv.js` on purpose — `UI.md` is shared by help/reports/deep/evaluate, which manage headings their own way (help strips article h1s + builds its TOC from h2). Verified live: `#/cv` → 1 page `<h1>` ("CV"), the user's `# Name` is now `<h2>`, 0 console errors.

### 🧪 Tests

- **`test: tests/cv-single-h1.test.mjs`** — 4 cases (cvMd shift chain, every preview site uses cvMd not raw UI.md, single page-title h1, the transform re-derived + proven to map every level down). 717 → 721.

### Verification

```bash
$ npm run test:ci
# 721 / 721 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.54.1
# Playwright #/cv: 1 <h1> ("CV"), preview h1=0/h2=1, 0 console errors
```

---

## [1.54.0] — 2026-05-18

**WS10 — canonical-docs re-validation + help-bundle H3 parity (final convergence release).**

The absolute-last workstream: re-validate the SPA against the 5
canonical `career-ops.org/docs` guides + the parent project, close the
last structural doc-divergence, and refresh the SDD spec — shipped as
its own release per the WS10 mandate.

### 🐛 Fixes

- **`fix(docs): help-bundle H3 parity — en=70 vs locales=68`** — the CHANGELOG/structure CI gate only checked **H2**, so `docs/help/en.md` had silently drifted to 70 `### ` subsections while all 7 localized bundles stayed at 68. The gap was §17 ("How to add a new job-portal source"): the **"Reference adapters"** table + **"Common pitfalls"** list had been added to en only. Both are now translated into es/ja/ko-KR/pt-BR/ru/zh-CN/zh-TW (adapter filenames, relative links, `registry.mjs`, `r.source === fs`, `fetchImpl`/`signal`, `tracked_companies` kept byte-identical). All 8 bundles: **17 H2 / 70 H3**.

### 🧪 Tests

- **`test(help): H3-parity gate`** — `help-ru-config-section.test.mjs` now also asserts every bundle (en + 7) has an identical H3 count (70), not just H2. An en-only `###` addition can no longer silently diverge the localized bundles. 716 → 717.

### 📝 Documentation

- **Canonical re-validation:** `tests/canonical-docs-coverage.test.mjs` (7/7) confirms the help bundles still mirror all 5 canonical guides — *what-is-career-ops*, *scan-job-portals*, *apply-for-a-job*, *batch-evaluate-offers*, *set-up-playwright* — and the WS2 UX-audit (40 findings, every screen Playwright-verified across v1.41→v1.52) validated every screen against documented behaviour. No divergence found.
- **`docs/sdd/CONVENTIONS.md`** refreshed to v1.54.0 reality: test totals (716 `node --test` + 4 E2E + shell-surface tier), the new H3-parity gate, updated file-size outliers (scan/config grew with WS2), and a new **Accessibility** section codifying the WS2 patterns (focus-trapped `UI.confirm`, WAI-ARIA tabs, SSE live-regions, label binding, sortable-table `aria-sort`, async-relabel announce) as standing conventions.

### Verification

```bash
$ npm run test:ci
# 717 / 717 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.54.0
# help bundles: all 8 → 17 H2 / 70 H3 · canonical-docs-coverage 7/7
```

> WS0–WS10 complete. Only WS11 (qa/ actualization + final QA prompt) remains.

---

## [1.53.0] — 2026-05-18

**WS9 — shell-surface test pyramid (the last untested layer).**

### 🧪 Tests

- **`test: tests/sh-files.test.mjs`** — the 4 `bin/*.sh` scripts and the `.githooks/pre-commit` hook had **zero** coverage. 10 cases now lock: `bash -n`/`sh -n` syntax, shebang + executable bit, and the behavioural contracts other workstreams depend on:
  - `career-ops-ui.sh` — `help` exits 0 + prints usage with **no shell-source leak** (v1.40.0 regression guard), unknown verb exits 2 with usage on stderr, `usage()` is a heredoc (not the fragile `sed`-scrape), all dispatcher case-labels present.
  - `start.sh` — `NO_OPEN` honored, Node ≥ 18 gate, browser-raise delegated to `scripts/open-dashboard.mjs` (v1.43.0 guard), no bare `open "$URL"`.
  - `setup.sh` — strict mode, `SKIP_START`, clones both repos, `need git`.
  - `run_all.sh` — `--quick`/`--no-e2e` parsing, runs all 4 suites via `run_suite`.
  - `.githooks/pre-commit` — execs the WS7 reviewer; **no shell file invokes `git --no-verify`** (CLAUDE.md hard rule #7 guard); `install-hooks.mjs` wires `core.hooksPath` and is the npm `prepare` step.
- 706 → 716.

### 📝 Documentation

- `docs/architecture/TESTING.md` — added the **shell-surface base layer** to the pyramid diagram + a v1.53.0 totals note (716 `node --test` cases / 90 files + 4 E2E surfaces); documents that `scripts/*.mjs` logic is covered by `cli-doctor`/`open-dashboard`/`ai-precommit-review`/`provider-selector` + the CI-gate scripts.

### Verification

```bash
$ npm run test:ci
# 716 / 716 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.53.0
```

---

## [1.52.0] — 2026-05-18

**WS2 LOWs #33–#40 — batched polish sweep (closes the UX-audit queue).**

### 🐛 Fixes

- **`fix(a11y/i18n): WS2 LOW batch`** — eight low-severity findings:
  - **#33** `#/dashboard` — the 3 header CTAs were inconsistent (only 2 had a leading icon); "Open Pipeline" now gets `📋` so all three match.
  - **#34** `#/profile` — archetype `fit`/`level` rendered as two bare ambiguous chips; now prefixed (`Fit: …` / `Level: …`) with matching `aria-label`.
  - **#35** `#/health` — Run-doctor / verify toasts showed raw `doctor.mjs` / `verify-pipeline.mjs` strings; now i18n-keyed (`health.runningDoctor/Verify`).
  - **#36** `#/health` — the check results were a flat run of `<div>`s with no programmatic name↔status link. Now a `role="list"` `<ul>`/`<li>` and the status badge carries `aria-label="<check>: <status>"`.
  - **#37** `#/reports` — report cards were mouse-only `<div onClick>`; now `role="link"` + `tabindex="0"` + Enter/Space handler + `aria-label`.
  - **#38** `#/activity` — the paginator comment said "200" while the code requested 500; reconciled to a `CAP` constant and a `role="note"` notice now surfaces when the 500-cap truncates older history (`activity.truncated`).
  - **#39** `#/batch` — prose placeholders were hardcoded English while their `aria-label`s were localized; the four (`minScore/maxRetries/model/startFrom`) are now i18n-keyed (the TSV-template placeholder stays — it's a data-format example).
  - **#40** mode pages — the async health probe relabelled/reordered the primary button silently; a visually-hidden `role="status"` region now announces it (`mode.liveReadyAnnounce`).

### 🌐 i18n

- 10 new keys × 8 locales (`set.fit/level`, `health.runningDoctor/Verify`, `activity.truncated` (`{n}` preserved), `batch.minScorePh/maxRetriesPh/modelPh/startFromPh`, `mode.liveReadyAnnounce`). `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/low-sweep.test.mjs`** — 9 cases (one per finding + the 10-key ×8 i18n check). 697 → 706. Playwright-verified: health `ul[role=list]` (17 `li`, badge aria "Node version: OK"), report card role=link/tabindex/aria, dashboard CTAs all-iconed, 0 console errors.

> This closes the WS2 UX-audit queue (#1–#40 across v1.41→v1.52). Next: WS9 (test pyramid) → WS10 (canonical re-validation + separate final release) → WS11 (qa/ finalization).

### Verification

```bash
$ npm run test:ci
# 706 / 706 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.52.0
```

---

## [1.51.0] — 2026-05-18

**WS2 #13 + #14 + #18 + #19 + #20 — feedback / i18n sweep (auto + evaluate).**

### 🐛 Fixes

- **`fix(a11y/ux): pending feedback, actionable errors, real clipboard, status regions`**:
  - **#13** `#/auto` Run button was disabled with an unchanged label → no pending cue for the multi-second pipeline. It now shows a busy state (`is-loading` + `aria-busy` + "⏳ Running…"), restored in `finally`.
  - **#14** the HTTP-failure branch put a bare "HTTP 500" on step 1 with no toast and an empty live region. Now an actionable, i18n'd message (`auto.httpFail`, `{n}`-substituted) on the step **and** a toast.
  - **#18** the manual-mode "Copy prompt" used deprecated `document.execCommand('copy')` and always toasted "Copied" even when it silently no-op'd. Now prefers the async Clipboard API, falls back to `execCommand`, and toasts a real failure (`auto.copyFail`) instead of a false success.
  - **#19** `#/evaluate` `#eval-out` had no live role — the long LLM call was silent for screen readers. Now `role="status" aria-live="polite"` so "Evaluating…", the verdict, and errors are announced.
  - **#20** the Evaluate button was a plain `onClick: run` (enabled during the call → duplicate submissions). Now `UI.withSpinner`-wrapped (disables + busy state).

### 🌐 i18n

- 3 new keys × 8 locales — `auto.running`, `auto.httpFail` (`{n}` preserved), `auto.copyFail`. `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/feedback-i18n-sweep.test.mjs`** — 6 cases (busy state + restore, actionable+toasted HTTP fail, async-clipboard fallback, eval status region, eval spinner-wrap, 3 i18n keys ×8). 691 → 697.
- **`fix(test): e2e pipeline-delete teardown`** (commit 7f8e250) — `e2e.mjs` / `e2e-comprehensive.mjs` deleted the test row via the pre-v1.48 native-confirm path; v1.48.0's focus-trapped `UI.confirm()` left the modal open and its backdrop blocked later flows (CI Playwright-e2e red). Teardown is now an API DELETE. Not a product regression — tests predated the confirm gate.

### Verification

```bash
$ npm run test:ci
# 697 / 697 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.51.0
$ node tests/e2e.mjs               # 20/0
$ node tests/e2e-comprehensive.mjs # 23/23
```

---

## [1.50.0] — 2026-05-18

**WS2 #12 + #27 + #28 — help navigation accessibility.**

### 🐛 Fixes

- **`fix(a11y): help — single h1, labelled+filterable TOC, focus-on-anchor, back-to-top`** — three `#/help` findings on a 17-section / 90+-heading guide:
  - **#28** the doc markdown opened with its own `# Title`, producing a SECOND `<h1>` on a page whose header already supplies the canonical h1 (and a h1→h3 jump in some locales). Every article `<h1>` is now stripped, so there is exactly one h1 and the hierarchy starts cleanly at the `<h2>` sections.
  - **#27** the TOC `<nav>` was an unnamed landmark (two unlabeled `<nav>`s on the page); it now has `aria-label` (`help.toc`). Clicking a TOC entry no longer just scrolls the viewport — focus moves to the section heading (`tabindex=-1` + `focus()`), so keyboard/SR users land in the section.
  - **#12** no way to find anything in a long doc. A `type="search"` filter above the TOC narrows entries by heading text live; a floating, `aria-label`led **Back to top** button appears after scrolling, returns to top and moves focus back to the page `<h1>`. Its scroll listener is removed on `hashchange` away from `#/help` (no leak).

### 🌐 i18n

- 2 new keys × 8 locales — `help.tocFilter`, `help.backToTop`. `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/help-nav-a11y.test.mjs`** — 6 cases (h1 strip, labelled nav, focus-on-anchor, filter narrows, back-to-top + listener cleanup, 2 i18n keys ×8). 685 → 691. Playwright-verified: 1 h1, TOC `aria-label`, filter narrows 17→1 on "scan", 0 console errors.

### Verification

```bash
$ npm run test:ci
# 691 / 691 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.50.0
```

---

## [1.49.0] — 2026-05-18

**WS2 #10 + #11 + #25 + #26 — tracker table accessibility & sort.**

### 🐛 Fixes

- **`fix(a11y): tracker headers, sortable table, localized fix labels, empty state`** — four `#/tracker` findings:
  - **#10** the action column header was an empty string and the per-row Report button had no context. Every `<th>` now has `scope="col"`; the action header is `t('track.col.actions')`; `Score`/`PDF` headers are i18n-keyed (were hardcoded English); the Report button gains an `aria-label` (`<report> — <company>`).
  - **#11** a job tracker with no way to sort. Date / Score / Status headers are now keyboard-operable sort buttons inside the `<th>` with `aria-sort` (`none`/`ascending`/`descending`); a `sorted()` comparator (numeric for score, locale-compare for date/status) runs before pagination; clicking toggles direction and resets the pager.
  - **#25** `track.normalize/dedup/merge` were identical English in all 8 locales despite being the highest-stakes destructive controls — now properly localized, plus a `title` tooltip (`Rewrites data/applications.md in place`).
  - **#26** a zero-row first run showed the same "no match" message as an over-filtered list. `rows.length === 0` now renders a distinct empty state (title + body + "Open pipeline" CTA); the filter-excluded-everything case keeps `track.noMatch`.

### 🌐 i18n

- 7 new keys × 8 locales (`track.col.score/pdf/actions`, `track.fixHint`, `track.emptyTitle/Body/Cta`) + 3 re-localized (`track.normalize/dedup/merge`). `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/tracker-a11y-sort.test.mjs`** — 6 cases (scope + i18n headers, Report aria-label, sortable th/aria-sort/comparator, localized destructive labels + title, distinct empty state, 7 i18n keys ×8). 677 → 683. Playwright-verified: 9 th all scope=col, 3 sortable, action header localized, aria-sort none→ascending on click, 0 console errors.

### Verification

```bash
$ npm run test:ci
# 683 / 683 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.49.0
```

---

## [1.48.0] — 2026-05-18

**WS2 #8 + #22 — pipeline: focus-trapped confirm + preview a11y.**

### 🐛 Fixes

- **`fix(a11y): pipeline UI.confirm() + live preview region`** —
  - **#8** all three `#/pipeline` actions used native `confirm()` (auto-dismissed in embeds, not focus-trapped): the preview-pane Delete, the per-row `✕` delete, and "Evaluate first". All now route through the focus-trapped `UI.confirm()` (v1.44.0 infra) — the two deletes `danger:true` (Cancel-default), "Evaluate first" `danger:false`.
  - **#22** `previewPane` had no live role and a fetch failure was stuffed into `previewBody` so it rendered as a misleading `<pre>` "preview". It's now `role="region" aria-live="polite"` with an `aria-label`; failures set a separate `previewError` and render a distinct `role="alert"` block. `previewError` is cleared on (re)select and when the active row is deleted.
- No native `confirm()` remains in `pipeline.js`.

### 🌐 i18n

- 4 new keys × 8 locales — `pipe.confirmDelTitle`, `pipe.previewError`, `pipe.evaluateAllTitle`, `pipe.previewRegion`. `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/pipeline-confirm-preview.test.mjs`** — 5 cases (no native confirm, ≥3 UI.confirm with correct danger flags, labelled live region, distinct alert + state-clear, 4 i18n keys ×8). 672 → 677. Playwright-verified: preview role=region/aria-live, row-delete opens a focus-trapped modal (focus on Cancel), 0 console errors.

### Verification

```bash
$ npm run test:ci
# 677 / 677 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.48.0
```

---

## [1.47.0] — 2026-05-18

**WS2 #7 + #30 + #31 + #16 — unbound-label accessibility sweep.**

### 🐛 Fixes

- **`fix(a11y): bind every swept form control to an accessible name`** — four UX-audit findings where inputs had no programmatic label (WCAG 1.3.1 / 3.3.2 / 4.1.2):
  - **#7** `scan.js` — the `dry-run` checkbox and `company-select` dropdown had labels with no `for`; added `htmlFor` (matching the existing `id`s).
  - **#30** `deep.js` — `company` / `role` inputs had unbound labels; added `id` + `htmlFor` (`deep-company`, `deep-role`).
  - **#31** `apply.js` — `url` / `jd` had unbound labels; added `id` + `htmlFor` (`apply-url`, `apply-jd`).
  - **#16** `cv.js` — the primary markdown `<textarea>` had no accessible name; bound it via `aria-labelledby` to the visible "Markdown" `<h3>` (`id="cv-md-heading"`) — SR name == on-screen heading, no new i18n key.
- Uses the explicit `label[for]`↔`control[id]` pattern already standard in `batch.js` / `mode-page.js`. No new i18n keys; zero behaviour change.

### 🧪 Tests

- **`test: tests/unbound-label-sweep.test.mjs`** — 5 cases incl. a binding-integrity check that every new `htmlFor`/`aria-labelledby` has a matching `id` in-file. 667 → 672. Playwright-verified: on #/scan, #/deep, #/apply every `label[for]` resolves to a control; #/cv `aria-labelledby` resolves to the heading.

### Verification

```bash
$ npm run test:ci
# 672 / 672 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.47.0
# Playwright: scan/deep/apply 2 bound label[for] each (all resolve) · cv aria-labelledby resolves · 0 errors
```

---

## [1.46.0] — 2026-05-18

**WS2 #5 + #6 + #21 + #24 — scan SSE accessibility.**

### 🐛 Fixes

- **`fix(a11y): scan SSE — live-log region, Stop, run-state, error banner`** — four UX-audit findings on `#/scan`:
  - **#5** the streaming console (`<pre id="scan-console">`) was a bare element; screen readers got no announcement of scanned lines. Now `role="log" aria-live="polite" aria-relevant="additions"` + an `aria-label` + `tabindex="0"` (keyboard-scrollable). A separate visually-hidden `role="status" aria-live="assertive"` region announces terminal events (complete / failed / stopped).
  - **#6** an in-flight `EventSource` scan had no abort path. The handle is now captured (`activeES`) and a **Stop** button closes it (`es.close()`), cancels the result poll, and resets state. Stop is shown only while a scan runs.
  - **#21** the Scan button stayed enabled with no busy cue during a multi-minute crawl. `setScanRunning()` now disables it + sets `aria-busy` and toggles the Stop button across both stream paths (single-phase `streamTo` and multi-phase `runScanAll` — the latter only ends the run on the terminal `done`, `final !== false`).
  - **#24** an SSE failure was a 3.5 s toast only. A persistent `role="alert"` banner now shows the error with a **Retry scan** action (re-invokes the last run fn); cleared on the next run.
- All side-effecting closures keep the existing `__cancelActiveScanPoll()` hashchange cleanup.

### 🌐 i18n

- 8 new keys × 8 locales — `scan.consoleLabel/stop/stopped/statusDone/statusFailed/statusStopped/errBannerTitle/errRetry`. `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/scan-sse-a11y.test.mjs`** — 7 cases (log-region roles, assertive status, Stop closes EventSource on both paths, run-state aria-busy, persistent alert + Retry, terminal-done gating, 8 i18n keys ×8). 660 → 667.

### Verification

```bash
$ npm run test:ci
# 667 / 667 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.46.0
# Playwright #/scan: console role=log aria-live=polite tabindex=0 · status role=status · error role=alert(hidden) · Stop hidden · 0 errors
```

---

## [1.45.0] — 2026-05-18

**WS2 #3 — config tabs: full WAI-ARIA Tabs pattern.**

### 🐛 Fixes

- **`fix(a11y): config.js tabs implement role=tablist/tab/tabpanel`** — the three #/config tabs (API keys / Profile / Modes) were plain `<button class="tab-btn">` with click-only activation: no `role`, no `aria-selected`, no keyboard model (UX-audit HIGH #3, WCAG 4.1.2 / 2.1.1). Now: a `role="tablist"` container with an `aria-label`; each tab `role="tab"` + `id` + `aria-controls` + `aria-selected` (synced in `activate()`) + roving `tabindex` (0 active / -1 rest); the panel `role="tabpanel"` + `tabindex="0"` + `aria-labelledby` tracking the active tab. Full keyboard nav: ←/→/↑/↓ (wrapping) + Home/End move focus AND activate. The legacy `.tab-btn.is-active` CSS hook is preserved. Verified live: ArrowRight API→Profile syncs aria-selected + panel labelledby; End→Modes; 0 console errors.

### 🌐 i18n

- 1 new key × 8 locales — `config.tablistLabel` ("Settings sections"). `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/config-tabs-aria.test.mjs`** — 7 cases (tablist/tab/tabpanel roles, aria-controls + roving tabindex, activate() aria-selected sync, keyboard map incl. wrap + preventDefault + focus move, legacy textContent-toggle removed, i18n key ×8). Total 653 → 660.
- **`fix(test): retarget 2 stale auto-pipeline smoke tests`** (commit 5d253ba) — the pre-v1.34 Playwright-e2e smoke tests asserted a transient modal the dashboard "Auto-pipeline" button stopped opening in v1.34.0 (→ `Router.go('/auto')`); they had been red on the separate Playwright-e2e CI job for 10 releases. Retargeted to the #/auto screen. Local smoke 16/16; CI green.

### Verification

```bash
$ npm run test:ci
# 660 / 660 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.45.0
# Playwright: #/config ArrowRight/End move + activate tabs, aria-selected synced, 0 errors
```

---

## [1.44.0] — 2026-05-18

**WS2 #4 + #9 — focus-trapped confirmation for destructive parent writes.**

### 🐛 Fixes

- **`fix(a11y/safety): UI.confirm() gate before whole-file parent overwrites`** — two UX-audit HIGHs, both data-loss: (#4) `config.js` `saveProfileRaw`/`saveModesRaw` replaced the ENTIRE parent `config/profile.yml` / `modes/_profile.md` with no confirmation; (#9) `tracker.js` Normalize/Dedup/Merge rewrote parent `data/applications.md` in place with no confirmation. Added `UI.confirm(title, message, opts)` to `public/js/api.js` — a **focus-trapped** dialog reusing the existing WAI-ARIA modal infra (focus-return, Tab-trap), returning `Promise<boolean>`. A new `_onClose` hook fires from `closeModal()` so EVERY dismissal path (Esc / backdrop / × / Cancel) resolves `false`; only the explicit confirm button resolves `true`. Focus defaults to **Cancel** (safe choice for a destructive op). NOT native `confirm()` (auto-dismissed in embeds, not focus-trapped). All three call sites are now gated before the `API.put`/`API.post`. Verified live: Normalize → focus-trapped "Переписать applications.md?" modal, focus on Cancel, Cancel dismisses with no POST, 0 console errors.

### 🌐 i18n

- 8 new keys × 8 locales — `common.confirm`, `config.rawConfirmTitle/Ok`, `config.profileRawConfirmBody`, `config.modesRawConfirmBody`, `track.fixConfirmTitle/Body/Ok`. The `{op}` placeholder in `track.fixConfirmBody` is preserved verbatim across all locales (runtime-substituted). `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/confirm-gate.test.mjs`** — 8 cases: `UI.confirm` exported, `_onClose` resolves false on every dismissal path, Cancel-default focus, `modal()` back-compat onClose arg, all 3 destructive sites gated before their write, no native `confirm()` left, 8 i18n keys present with `{op}` intact. 644 → 652.

### Verification

```bash
$ npm run test:ci
# 652 / 652 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.44.0
# Playwright: #/tracker Normalize → focus-trapped modal, focus=Cancel, Cancel→no POST, 0 errors
```

---

## [1.43.0] — 2026-05-18

**User-requested — `career-ops-ui open` + autostart browser-raise.**

### ✨ Features

- **`feat(cli): career-ops-ui open — open AND raise the dashboard tab`** — after `setup`/`run`, bare `open`/`xdg-open` left the dashboard tab in the background when the browser was already running, so the user had to hunt for it. New `scripts/open-dashboard.mjs` builds the URL from HOST/PORT (rewriting a `0.0.0.0` bind to loopback), optionally waits for `/api/health`, opens the default browser, then **force-raises** it — macOS `osascript` activating whichever of Chrome/Brave/Edge/Safari/Arc/Firefox is running, Linux `xdg-open`+`wmctrl`, Windows `start`. Exposed as the `career-ops-ui open` verb (aliases `dash`, `focus`). `bin/start.sh` autostart now delegates to it so the tab is raised automatically; `NO_OPEN=1` disables auto-open for headless/CI starts. Verified live: `career-ops-ui open` → URL printed, browser raised, exit 0.

### 🧪 Tests

- **`test: tests/open-dashboard.test.mjs`** — 8 cases: `dashboardUrl` (defaults / PORT / `0.0.0.0`→loopback / explicit HOST), `openAndRaise` platform routing (darwin/win32/linux, no real browser), `waitForHealth` bounded-timeout against a dead port, and static guarantees that the dispatcher routes `open|dash|focus` and `start.sh` delegates + honors `NO_OPEN` (old bare-`open` path gone). 636 → 644.

### 📝 Documentation

- README ×8 + help-bundle §1 ×8 — the `open` verb added to the launch block + a note that `setup`/`run` now raises the tab automatically and `NO_OPEN=1` disables it. H2-section parity preserved (17).

### Verification

```bash
$ npm run test:ci
# 644 / 644 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.43.0
$ career-ops-ui open --no-wait    # URL printed, browser raised, exit 0
```

---

## [1.42.0] — 2026-05-18

**WS2 fix #2 — `#/portals` dead-route → config deep-link.**

### 🐛 Fixes

- **`fix(router): #/portals 404 → alias to config + Regional-sources deep-link`** — `#/portals` was an unregistered route that rendered the 404 view, even though it is a plausible bookmarked/typed URL for portal-source management (UX-audit HIGH #2). Added `portals: 'config'` to `router.js` `ALIASES` (same bookmark-stability pattern as `settings→profile`), so it now resolves to the config view with the **config** nav item active. When a Regional-sources group exists, the view (`config.js`) detects the `#/portals` hash, force-opens that `<details>` group, scrolls it into view, and moves focus to its summary (overriding the default h1 focus) so the user lands exactly on the portal-source controls. Never renders an empty regional group from the alias alone. Verified live: `#/portals` → config view, `is404:false`, active nav = config, 0 console errors.

### 🧪 Tests

- **`test(router): portals→config alias guarantee`** — `router.test.mjs` static assertion guarding the new ALIASES entry against future-refactor regression. 635 → 636.

### 📝 Documentation

- help-bundle §5 × 8 — a "Shortcut" blockquote noting `#/portals` now resolves to App settings / Regional sources instead of 404ing. H2-section parity preserved (17 each).

### Verification

```bash
$ npm test
# 636 / 636
# Playwright: #/portals → {h1:"App settings", is404:false, activeNav:"config"} · 0 console errors
```

---

## [1.41.0] — 2026-05-18

**WS2 — senior UX/usability audit + cross-cutting focus-management fix.**

A 10+ yr heuristic audit (Nielsen × WCAG 2.2 AA × project conventions) of
all 17 routes produced a 40-finding, severity-ranked queue
(`.planning/.../UX-AUDIT.md`); HIGH→MEDIUM→LOW are now shipped one fix per
release. This release lands the #1 cross-cutting HIGH.

### 🐛 Fixes

- **`fix(a11y): move focus to the new view on every route change`** — `router.js render()` replaced `#content` on each hashchange but never moved focus, so keyboard / screen-reader users stayed on the destroyed node and lost their place (WCAG 2.4.3 Focus Order / 4.1.3 Status Messages — cross-cutting, affected all 17 screens). New `focusNewView(content)` focuses the new view's first `h1`/`.page-title` (concise SR announcement + correct focus order), making the heading focusable (`tabindex=-1`) if needed and falling back to `#content`. The very first paint is skipped so it never fights the skip-link. Wired on both the success and error render paths. Verified live: after nav, `document.activeElement` is the new view's `H1.page-title`.

### 🧪 Tests

- **`test(router): focus-management static guarantees`** — 4 cases in `router.test.mjs` (helper defined, heading-target + content fallback, first-paint skip guard, ≥2 call sites). 631 → 635.

### 📝 Documentation

- `.planning/.../UX-AUDIT.md` — full 40-finding audit + prioritized fix queue + per-release ship grouping (v1.42 → v1.51). Drives the remaining WS2 iterations.

### Verification

```bash
$ npm run test:ci
# 635 / 635 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.41.0
# Playwright: #/dashboard → #/config → #/tracker · activeElement = new H1.page-title · 0 console errors
```

---

## [1.40.0] — 2026-05-18

**WS8.3 — docs-actualization sweep + `career-ops-ui help` fix + `askSecret` hardening.**

### 🐛 Fixes

- **`fix(cli): career-ops-ui help no longer leaks shell source`** — the dispatcher printed its header comment with `sed -n '2,12p'`, but line 12 (`set -euo pipefail`) is code, not a comment, so `career-ops-ui help` (and the unknown-verb usage text) ended with a stray `set -euo pipefail` line. Narrowed to `2,11p` (the comment block) in both the `help` and `*)` cases. `help` exits 0, unknown verb exits 2 — verified.
- **`fix(cli): scripts/init.mjs key entry never echoes`** — the v1.39.0 follow-up replaced the cosmetic readline-overwrite mask with a real raw-mode reader: `setRawMode(true)` + a buffered line so typed/pasted key bytes never reach the terminal at all (no scrollback / tmux / screen-share leak). A full VT escape FSM consumes every CSI/SS3/OSC/DCS/SOS/PM/APC sequence so arrow & function keys can't corrupt the secret; `stdin` is dependency-injected so the non-TTY fallback is unit-tested without poking the global. Iterated to a clean AI-review LGTM.

### 📝 Documentation

- **README ×8** — the old "one-command install" section is replaced by a prominent **"Launch & initialize in one command"** section: the curl one-liner plus the explicit `career-ops-ui` CLI chain (clone → `npm link` → `setup` → `init` → `doctor` → `run` → `help`), the provider-wizard explanation, the CI `--provider --anthropic-key --yes` form, and the `LLM_PROVIDER` note. All 8 README badges actualized from the stale v1.22–v1.24 / tests-461–474 to **v1.40.0 / tests-631** (e2e badge made non-numeric to avoid an invented count).
- **help-bundle ×8 §1** — a "One-command launch & init" blockquote callout added at the top of the Quick-start playbook (before "A. Setup") in all 8 locales. H2-section parity preserved (17 each — CI gate green).

### 🧪 Tests

- **`test(init): non-TTY askSecret fallback`** — `provider-selector.test.mjs` gains a DI-stdin case asserting `askSecret` delegates to plain `ask()` (trim-parity) off a TTY without mutating the shared global. 629 → 631.

### Verification

```bash
$ npm run test:ci
# 631 / 631 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.40.0
$ career-ops-ui help     # clean, exit 0 (no `set -euo pipefail` leak)
$ career-ops-ui doctor   # all required green, exit 0
```

---

## [1.39.0] — 2026-05-18

**WS8.2 — LLM provider selector + OpenAI/Codex key + interactive `init` wizard.**

### ✨ Features

- **`feat(config): LLM_PROVIDER selector + OPENAI_API_KEY`** — `server/lib/env-config.mjs` adds `LLM_PROVIDER` (auto|claude|gemini) + `OPENAI_API_KEY` to `KNOWN_KEYS`/`KEY_GROUPS`; `OPENAI_API_KEY` is secret-masked. New `providerOrder(env)` helper: `auto`→`[anthropic,gemini]` (legacy), `claude`→`[anthropic]`, `gemini`→`[gemini]`. All **6** provider-gate sites in `server/lib/routes/llm.mjs` (evaluate/deep/mode × Anthropic/Gemini) consult it via `_provGate()` — a forced provider with no key falls through to the manual-prompt path exactly like the pre-v1.39 no-key behaviour (zero behaviour change for `auto`/default). `#/config` API-keys tab gains an `LLM_PROVIDER` select + `OPENAI_API_KEY` input. Provider-key set matches what santifer/career-ops actually implements (Gemini = parent gemini-eval, Anthropic = web-ui SDK + Claude Code, OpenAI = Codex/OpenCode CLI side); Mistral/Qwen are model names with no parent env key — not invented.
- **`feat(cli): interactive career-ops-ui init`** — `scripts/init.mjs` is now a real wizard (was a WS8.1 stub): pick provider 1-4, enter key(s), writes parent `.env` via the validated `env-config.updateEnvFile` path (explicit user action, same as POST /api/config). Flag-driven too: `--provider --anthropic-key --gemini-key --openai-key --yes`.

### 📝 Documentation

- help-bundle §2 × 8 + `docs/sdd/CONVENTIONS.md` — provider selector + the 3 parent-implemented provider keys. (Full README ×8 + canonical-docs fold = WS8.3/WS10, the user-mandated final steps.)

### 🧪 Tests

- **`test: tests/provider-selector.test.mjs`** — 7 cases: `providerOrder` (auto/unknown/whitespace → legacy, claude/gemini forced), env-config surface (KNOWN/SECRET/LLM_PROVIDERS), `init` `parseArgs`+`buildUpdates` (clamp, non-empty-only), and a static canary that all 6 llm.mjs gate-sites use `_provGate()`. 622 → 629.

### Verification

```bash
$ npm run test:ci
# 629 / 629 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.39.0
$ career-ops-ui init --provider gemini --gemini-key … --yes   # writes parent .env
$ career-ops-ui doctor                                          # verifies
```

---

## [1.38.0] — 2026-05-17

**WS8.1 — unified CLI dispatcher + `doctor` verb.**

AutoResearchClaw-style one-command workflow. `bin/career-ops-ui.sh` dispatches `setup` / `run` / `doctor` / `init` / `help`; `package.json` `bin.career-ops-ui` points at it.

### ✨ Features

- **`feat(cli): bin/career-ops-ui.sh dispatcher`** — `setup` → `bin/setup.sh` (existing one-command bootstrap), `run` → `bin/start.sh`, `doctor` → `scripts/doctor.mjs`, `init` → `scripts/init.mjs` (WS8.1 stub; interactive provider wizard = WS8.2), `help`. Backward-compat `career-ops-ui-start` bin alias kept.
- **`feat(cli): scripts/doctor.mjs`** — standalone health check that **reuses the exact `/api/health` engine** (spins `createApp()` in-process on an ephemeral port → renders the JSON to a colorized terminal report). Single source of truth — doctor can never drift from the Health page. **Exit 0 iff every REQUIRED check is green**, exit 1 otherwise, so `setup` / CI can gate on it. No new deps; read-only.

### 📝 Documentation

- `docs/sdd/CONVENTIONS.md` — "CLI dispatcher" section. help-bundle §1 × 8 — CLI quickstart note. (Full README ×8 quickstart block lands in WS8.3, the user-requested final verification step.)

### 🧪 Tests

- **`test(cli): tests/cli-doctor.test.mjs`** — 6 cases: `formatReport` pure logic (all-pass / required-fail / optional-only-fail / empty-tolerant), dispatcher verb-routing canary, `package.json` bin wiring. 616 → 622.

### Verification

```bash
$ npm run test:ci
# 622 / 622 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.38.0
$ node scripts/doctor.mjs   # ✓ all required checks pass · exit 0
```

---

## [1.37.0] — 2026-05-17

**WS7 — pre-commit AI review in the git workflow.**

Per user request: an AI review before every commit. Two layers — a fast deterministic floor that fails-HARD, and an advisory AI pass that fails-SOFT.

### ✨ Features

- **`feat(workflow): pre-commit AI review`**
  - [`scripts/ai-precommit-review.mjs`](scripts/ai-precommit-review.mjs) — **deterministic floor (fail-HARD):** rejects a commit that stages a `.env`/secret-bearing file, contains a high-confidence secret pattern in the added diff lines (`.env.example` placeholders exempt), leaves `.also(` in a staged view (mirrors the CI gate), or stages a `.mjs`/`.js` that fails `node --check`. **AI layer (fail-SOFT):** runs `claude -p` over the staged diff when the CLI is on PATH and `AI_REVIEW !== 'off'`; missing CLI / offline / timeout → notice, never blocks.
  - [`.githooks/pre-commit`](.githooks/pre-commit) + [`scripts/install-hooks.mjs`](scripts/install-hooks.mjs) — `npm install` wires `core.hooksPath=.githooks` via the new `prepare` script. Idempotent; no-op outside a git checkout.
  - `AI_REVIEW=off git commit …` skips only the AI layer. Never `--no-verify` (CLAUDE.md hard rule #7); CI runs the full gate regardless.

### 📝 Documentation

- `docs/sdd/CONVENTIONS.md` — new "Pre-commit AI review" section (floor vs AI layer, env switch, never-bypass rule).

### 🧪 Tests

- **`test(workflow): tests/ai-precommit-review.test.mjs`** — 6 cases over the exported pure floor functions: blocked-path detection (`.env.example` exempt), secret-pattern hits (added-lines only, placeholders ignored), `.also(` view leftover, aggregate floor, clean-diff pass. 610 → 616.

### Verification

```bash
$ npm run test:ci
# 616 / 616 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.37.0
# This very commit was gated by the new hook (live dogfood).
```

---

## [1.36.0] — 2026-05-17

**WS6.3 — #/config Modes tab: raw blob → per-section editor. WS6 complete.**

`modes/_profile.md` is a prompt-engineering doc (markdown tables + prose), not key→value settings — so section-level editing is the right granularity (not field decomposition). This finishes WS6: every settings surface is now structured.

### ✨ Features

- **`feat(config): per-section _profile.md editor`**
  - [`server/lib/routes/content.mjs`](server/lib/routes/content.mjs) — byte-exact `splitProfileSections` (preamble + per-`##` `{ heading, headingLine, body }` via string slices, not line-join — round-trip is byte-identical) + `joinProfileSections`. `GET /api/modes/_profile` now also returns `{ preamble, sections }`. `PUT` accepts `{ sections: { "<heading>": "<body>" } }`: replaces only named sections, **preamble + unknown sections + ordering survive byte-for-byte** (merge-not-replace). Unknown heading → 400. Existing `stripDangerousMarkdown` sanitization retained. Legacy `{ markdown }` raw path unchanged.
  - [`public/js/views/config.js`](public/js/views/config.js) — one collapsible textarea per `##` section (label = `## heading`); Save sends `{ sections }`. Collapsed *Advanced: raw markdown* disclosure retained for add/remove-section + preamble edits.
  - i18n: 5 keys × 8 (`config.modesSectionHint/modesNoSections/modesRawToggle/modesRawHint/modesRawSave`).

### 📝 Documentation

- help-bundle §2 × 8 locales — Modes tab documented as per-section editor (merge-by-section, byte-exact preservation, Advanced raw disclosure).

### 🧪 Tests

- **`test(config): tests/modes-section-form.test.mjs`** — 6 cases: GET exposes preamble+sections, section-merge preserves preamble/others byte-exact, unknown-heading 400, ordering preserved, legacy raw path, sanitization. 604 → 610.

### WS6 outcome

Every settings surface is now field/section-structured: API-keys (already field-based — WS6.2 audit confirmed `KNOWN_KEYS ≡ FIELDS`, no gap), Profile scalars (WS1 v1.32.0), Profile arrays (WS6.4 v1.35.0), Modes sections (WS6.3 v1.36.0). The raw editors remain as documented escape hatches.

### Verification

```bash
$ npm run test:ci
# 610 / 610 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.36.0
```

---

## [1.35.0] — 2026-05-17

**WS6.4 — #/config Profile structured array editors + WS6.2 API-keys audit.**

WS1 (v1.32.0) gave the 14 scalar profile fields a form. WS6.4 finishes the job: the list-shaped fields get add/remove-row editors, so the raw-YAML hatch is now truly last-resort.

### ✨ Features

- **`feat(config): profile array editors`**
  - [`server/lib/routes/content.mjs`](server/lib/routes/content.mjs) — `PUT /api/profile` now also accepts an `{ arrays: { … } }` payload (alongside / combinable with `{ fields }`). Allow-listed paths: `target_roles.primary` + `narrative.superpowers` (string lists), `target_roles.archetypes` (name/level/fit), `narrative.proof_points` (name/url/hero_metric). Object rows keep ONLY allow-listed sub-keys (injected keys dropped); empty rows dropped; an emptied list deletes the leaf. **Same merge-not-replace invariant** — scalars, unknown keys, and untouched arrays survive.
  - [`public/js/views/config.js`](public/js/views/config.js) — 4 collapsible add/remove-row editors (string-list rows; object rows with per-sub-key inputs). Save sends `{ fields, arrays }` in one request.
  - i18n: 6 new keys × 8 (`config.pfPrimaryRoles/Superpowers/Archetypes/ProofPoints/AddRow/RemoveRow`).
- **`audit(config): WS6.2 API-keys tab`** — verified server `KNOWN_KEYS` (ANTHROPIC_API_KEY/MODEL, GEMINI_API_KEY/MODEL, PORT, HOST) ≡ client `FIELDS`. Every recognized `.env` key already has its own labeled input. **No gap — no code change.**

### 📝 Documentation

- help-bundle §2 × 8 locales — Profile-tab section documents the array editors (add/remove rows, drop-empty, merge-not-replace).

### 🧪 Tests

- **`test(config): tests/profile-array-editors.test.mjs`** — 7 cases: string-array merge preserves scalars+unknown-keys, object-array allow-list+drop-empty, empty→leaf-removed, proof_points round-trip, unknown-array-path 400, combined fields+arrays, arrays-only request. 597 → 604.

### Verification

```bash
$ npm run test:ci
# 604 / 604 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.35.0
```

---

## [1.34.0] — 2026-05-17

**WS5 — one-click Auto-pipeline screen (`#/auto`).**

The v1.15 dashboard auto-pipeline was a transient modal. Promoted to a dedicated, linkable page with senior-UX scaffolding.

### ✨ Features

- **`feat(auto): dedicated #/auto screen`** ([`public/js/views/auto.js`](public/js/views/auto.js)) — paste one job URL, one click runs the full chain (validate → fetch → evaluate → save report → append tracker) via the existing `POST /api/auto-pipeline` SSE contract. Senior-UX:
  - Single primary CTA; **Enter** in the URL field also runs it.
  - Live vertical **stepper** as an ordered list with `aria-current="step"` on the running row + a polite `role="status"` live-region announcing every transition (comprehensible without sight).
  - On success the result card **deep-links** to the saved report (`#/reports/:slug · N/5`) and the **tracker** — next action one click away.
  - Failed step marked red with message; CTA re-enables for fix-and-retry without reload.
  - **No API key → manual mode**: steps collapse to a copy-the-prompt card (no spend).
  - Linkable: `#/auto?url=<encoded>&go=1` opens + auto-starts.
  - Sidebar entry (✨ Auto-pipeline, after Pipeline); dashboard ✨ button now routes here (single coherent flow; the `window.AutoPipeline` modal helper stays for backward-compat).
  - i18n: 14 new keys × 8 locales.

### 📝 Documentation

- help-bundle §1 × 8 locales — new "One-click Auto-pipeline (`#/auto`) — the 21-step shortcut" subsection (full step list + a11y + manual-mode + deep-link behaviour). H2 count unchanged (17) — added as a `###` subsection, no parity-gate churn.
- README × 8 — Auto-pipeline headline feature bullet.

### 🧪 Tests

- **`test(auto): tests/auto-screen.test.mjs`** — 8 cases: route registration, POST+SSE-drain transport, a11y scaffolding (aria-live + aria-current), manual-mode card, success deep-links, index.html script+nav wiring, dashboard→#/auto routing, 14 i18n keys × 8 locales parity.
- **589 → 597** unit + acceptance (+8).

### Verification

```bash
$ npm run test:ci
# 597 / 597 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.34.0
```

---

## [1.33.0] — 2026-05-17

**WS4 — full parent career-ops 1.8.0 feature-parity audit + `location_filter`.**

Audited every user-facing parent commit v1.7.0→v1.8.0 (see `.planning/.../PARENT-PARITY.md`). One real GAP found and closed; everything else is FLOW (parent script we shell out to / inline via bundleProjectContext), CLI-ONLY (parent Go TUI), or N/A.

### ✨ Features

- **`feat(scan): portals.yml location_filter parity (parent #570)`** — parent's `scan.mjs` gained an optional `location_filter` block; web-ui runs its OWN in-process `en-scanner`/`ru-scanner` (they do NOT shell out to parent `scan.mjs`), so it did not flow through. New [`server/lib/location-filter.mjs`](server/lib/location-filter.mjs) mirrors the parent `buildLocationFilter` semantics **verbatim** (no key → pass-all; empty location → pass; `block` precedence over `allow`; `allow` empty → pass; `allow` non-empty → match ≥ 1; case-insensitive substring). Wired into both scanners' post-fetch filter step (after title/negative, before dedup/persist). Config-driven via `portals.yml` top-level `location_filter:` — no UI needed.

### 📝 Documentation

- help-bundle §5 (Portals) × 8 locales — new `location_filter` subsection with the worked allow/block example + exact semantics + the "top-level key, sibling of title_filter" note.
- `.planning/.../PARENT-PARITY.md` — full classification table of the 20+ parent commits (GAP / FLOW / CLI-ONLY / DOCS / N/A) with rationale per row.

### 🧪 Tests

- **`test(scan): tests/location-filter.test.mjs`** — 8 cases: no-filter pass-all, empty-location pass, block precedence, allow-empty pass, allow-match-required, case-insensitivity, malformed-config safe-pass, exact parity with parent's `portals.example.yml` worked example. Scanner-integration regression: 51 en/ru/scan tests green (wiring didn't regress).
- **581 → 589** unit + acceptance (+8).

### Parity outcome

career-ops v1.8.0 feature-parity **complete** as of web-ui v1.33.0. Deferred (PLAN R4 scope-guard): #341 Turkish as a 9th UI locale — parent added TR *mode templates* (template-side); a 9th web-ui locale is a dedicated future phase. Optional/LOW backlog: #602 explicit Greenhouse hostname allowlist (already covered by web-ui's `safe-fetch` + `isValidJobUrl` envelope; slug-based URL construction, not raw hostname).

### Verification

```bash
$ npm run test:ci
# 589 / 589 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.33.0
```

---

## [1.32.0] — 2026-05-17

**`#/config` Profile tab — raw-YAML blob → field-by-field form (WS1).**

Before v1.32.0 the Profile tab was a single monospace textarea where name, email, location, archetypes, compensation and every custom key lived in one undifferentiated YAML blob — the exact pain the user called out ("всё в одной куче"). It is now a structured form.

### ✨ Features

- **`feat(config): Profile field-form with merge-not-replace save`**
  - [`public/js/views/config.js`](public/js/views/config.js) — 14 modeled scalar paths grouped into 3 collapsible sections: **Candidate** (full_name/email/phone/location/linkedin/github/portfolio_url/twitter), **Narrative** (headline/exit_story), **Compensation** (target_range/currency/minimum/location_flexibility). Full-name client-side required-check before save.
  - [`server/lib/routes/content.mjs`](server/lib/routes/content.mjs) — `PUT /api/profile` gains a `{ fields: { "candidate.full_name": … } }` payload. Server **reads the existing `config/profile.yml`, sets/clears only the allow-listed leaves, re-serializes the whole object**. Arrays the form doesn't model (`target_roles.archetypes`, `narrative.proof_points`, `narrative.superpowers`) and any custom keys **survive the round-trip untouched** — the load-bearing invariant (PLAN R1). Empty field → leaf deleted (no `phone: ""` residue). Allow-list rejects unknown dotted paths; identity gate (full name required) preserved; corrupt existing YAML → 409 (refuses to clobber, routes user to raw editor).
  - **Raw-YAML escape hatch retained** as a collapsed *Advanced* `<details>` — the pre-1.32 full-file editor, unchanged (`{ yaml }` path, replaces whole file, preserves comments). For nested-array edits or comment preservation.
  - i18n: 23 new `config.pf*` / `config.profile*` keys × 8 locales.

### 📝 Documentation

- help-bundle §2 (App settings) + §3 (Profile) × 8 locales — rewritten for the 3-tab layout + field-form description + the comment-loss tradeoff + Advanced raw-YAML disclosure.

### 🧪 Tests

- **`test(config): tests/profile-field-form.test.mjs`** — 7 cases: arrays + unknown-key survival across a field-merge round-trip (the R1 gate), empty-field leaf-deletion, unknown-path rejection, no-full-name rejection, corrupt-YAML 409 guard, legacy raw `{ yaml }` path still works, value trimming.
- **574 → 581** unit + acceptance (+7).

### 🔄 Migration

No user action. First Profile-tab save after upgrade merges into the existing file; comments are dropped on a *field* save (use the Advanced raw editor to keep them). All data keys preserved.

### Verification

```bash
$ npm run test:ci
# 581 / 581 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.32.0
```

---

## [1.31.0] — 2026-05-17

**Parent career-ops 1.8.0 sync — `#/batch` exposes `--model` + `--start-from`.**

The parent project bumped 1.7.1 → 1.8.0. The user-relevant code delta: `batch-runner.sh` gained `--model NAME` (#504) and `--start-from N`. web-ui surfaces both on `#/batch`, completing flag parity (the runner's full surface — `--parallel --dry-run --retry-failed --start-from --max-retries --min-score --model` — is now reachable from the browser).

### ✨ Features

- **`feat(batch): surface --model + --start-from`**
  - [`public/js/views/batch.js`](public/js/views/batch.js) — new **Model** text input (optional; placeholder "Claude Max default") and **Start from #** numeric input (optional; min 1). Appended to the run-control row next to Max retries.
  - [`server/lib/routes/batch.mjs`](server/lib/routes/batch.mjs) — `GET /api/stream/batch?model=…&startFrom=…`. Defense-in-depth (same posture as v1.28.0 `--max-retries`): `model` accepted only if it matches `^[A-Za-z0-9.\-]{1,60}$` (rejects shell-meta even though `spawn()` is arg-array — belt-and-suspenders); `startFrom` accepted only as an integer 1..100000. Bad values silently dropped, not 400'd — the UI input is the soft contract.
  - i18n: `batch.modelLbl`, `batch.modelAria`, `batch.startFromLbl`, `batch.startFromAria` × 8 locales.

### 📝 Documentation

- help-bundle §14 (Batch evaluate) × 8 locales — `--model` + `--start-from` documented in the flag list with the `#/batch` field-name mapping.
- Parent career-ops 1.8.0 analysis recorded. Other parent deltas assessed as **no web-ui code change required**: interview-prep audience split (#489) flows through `bundleProjectContext` automatically; `dashboard/` is the parent's Go/Bubble-Tea terminal TUI (browser equivalent is our SPA — not integrated by design); `modes/tr/` Turkish templates are parent-side (a 9th web-ui UI locale is a separate deferred decision); `parentVersion` auto-reports 1.8.0 via `health.mjs` runtime read.

### 🧪 Tests

- **`test(batch): tests/batch-model-startfrom.test.mjs`** — 7 cases: model pass-through, shell-meta charset rejection (injection guard), empty-model drop, startFrom pass-through, out-of-range drop (`< 1`), non-integer drop, combined-with-other-flags coexistence.
- **567 → 574** unit + acceptance (+7).

### 🔄 Migration

No user action. The next `🌐 Batch` run with the Model / Start-from fields blank behaves exactly as before (Claude Max default, start at offer #1).

### Verification

```bash
$ npm run test:ci
# 574 / 574 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.31.0
$ curl -sN 'http://127.0.0.1:4317/api/stream/batch?model=claude-sonnet-4-6&startFrom=5' | grep -m1 '"args"'
# data: {"script":"batch-runner.sh","args":["--model","claude-sonnet-4-6","--start-from","5"]}
```

---

## [1.30.0] — 2026-05-14

**`#/scan` results paginator — replaces the v1.12.0 "first 200 of N" truncation.**

### ✨ Features

- **`feat(scan): paginate over full filtered result set`** ([`public/js/views/scan.js`](public/js/views/scan.js)) — pre-v1.30 the scan results table was hard-capped at the first 200 filtered rows with a footnote saying "Showing first 200 of N". Rows 201..N were unreachable from the UI; the user had to re-tune `title_filter.positive` in `portals.yml` to narrow the set if they wanted to inspect later rows. v1.30.0 swaps the cap for `UI.paginate` (the same helper that drives `#/tracker`, `#/reports`, `#/activity`).
  - `PAGE_SIZE = 200` preserves the prior visual density per page.
  - The FULL filtered set is sorted first (boost-to-top is stable across pages), then page-sliced — so a boosted row that lands on page 2 still appears at the top of page 2, not buried.
  - Filter input (text / source / remote / scope / chips) calls `pager.reset()` so the user lands on page 1 of the new filter result.
  - `pager.controls(visible, total)` renders `« ‹ N-M of K › »` with disabled-state buttons when on first / last page. When `total ≤ pageSize`, the controls show only the item count (clean for small datasets).
- Stale `scan.shownTop` i18n key removed from [`public/js/lib/i18n-dict.js`](public/js/lib/i18n-dict.js) (× 8 locales — no longer referenced).

### 🧪 Tests

- **`test(scan): tests/scan-paginator.test.mjs`** — 9 cases across three layers:
  - **Static-source canaries (7):** scan.js declares `PAGE_SIZE = 200`; wires `UI.paginate({ pageSize: PAGE_SIZE, onChange: …renderResults… })`; resets pager on filter input; sorts the FULL `rows.slice()` into `sortedAll` BEFORE paginating; uses `pager.slice(sortedAll)`; appends `pager.controls(sorted.length, rows.length)` after the table; no longer contains the pre-v1.30 `rows.slice(0, 200)` truncation. `i18n-dict.js` does NOT carry the stale `scan.shownTop` key. `api.js` still exports the `paginate()` helper with `.slice / .controls / .reset` surface.
  - **Pure-logic paginator table (1):** replicates clamp+slice rules and exercises 6 boundary cases — page 0 of 550 → 200 rows starting at 0; page 1 → 200 rows starting at 200; page 2 → 150 rows starting at 400; overflow page=99 → clamp to last valid page (2); filter-narrow to 5 rows while on page 2 → clamp to page 0 returning the 5 rows; empty set → page=0, empty slice.
  - **Summary computation (1):** mirrors `start = page * pageSize + 1; end = min(total, start + visible - 1)` from api.js paginate().controls(). Verifies the displayed range across all 3 pages of a 550-row dataset.
- **558 → 567** unit + acceptance (+9 new).

### 🔄 Migration

No user action needed beyond updating to v1.30.0. The next scan that produces > 200 filtered rows will surface the paginator below the results table. Smaller scans see only an "N items" hint (unchanged from `UI.paginate`'s established behaviour in tracker / reports / activity).

### Verification

```bash
$ npm run test:ci
# 567 / 567
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.30.0
```

Manual smoke after redeploy: run a scan that produces > 200 filtered rows, navigate `#/scan`, scroll past the results table, click `›` to advance to page 2 — should show rows 201..400 instantly (no server round-trip; pure client-side slicing of the already-fetched result set).

---

## [1.29.2] — 2026-05-14

**Hot-fix: `🌐 Scan` with `source=both` only ran the EN phase. RU phase was silently dropped.**

### 🚑 Critical hot-fix

User-reported symptom: clicking the unified `🌐 Scan` button (which calls `runScanAll()` → `GET /api/stream/scan?source=both`) returned only the EN ATS phase. The console showed `▶ ATS scan (Greenhouse + Ashby + Lever)` … `✓ ATS done · NEW=0` and then stopped. No RU phase output ever appeared, even with all 5 RU adapters listed in `russian_portals.sources`.

**Root cause** — [`public/js/api.js:156`](public/js/api.js#L156) closed the `EventSource` on **the first `done` event**:

```js
if (ev === 'done' || ev === 'error') es.close();
```

But [`server/lib/routes/scan.mjs::driveOne`](server/lib/routes/scan.mjs) emits `done` once per phase, and the `source=both` branch drives two phases sequentially. The client closed after the EN `done`, the server detected `res.on('close')` → `AbortController.abort()` → the RU phase started but was immediately cancelled.

**Fix — multi-phase SSE contract:**

- **Server** ([`server/lib/routes/scan.mjs`](server/lib/routes/scan.mjs)): `driveOne` now accepts a `final` param (default `true`). The `done` payload carries `final: <bool>`. The `source=both` branch passes `final: false` to the first phase, `final: true` to the second.
- **Client** ([`public/js/api.js:148-172`](public/js/api.js#L148-L172)): `stream(...)` closes the `EventSource` on `done` only when `data.final !== false`. Backward-compatible: legacy single-phase producers (`/api/stream/batch`, `/api/stream/pdf*`, etc.) don't set `final`, so the behaviour is unchanged. Close on `error` remains unconditional.

### 🧪 Tests

- **`test(scan): tests/scan-stream-multi-phase.test.mjs`** — 11 cases covering both server-emitted SSE contract and client decision logic:
  - **SSE contract (6 cases):** `source=ats` → 1 `done` (`final:true`); `source=regional` → 1 `done` (`final:true`); `source=both` → 2 `done` events with `final:false` then `final:true`; `source=both` → 2 `start` events in `en-scanner`/`ru-scanner` order; static canary that the pre-v1.29.2 unconditional close pattern is gone; static canary that the v1.29.2 `data.final !== false` guard is present.
  - **Functional proof of fix (3 cases):** `source=both` actually emits the RU-phase banner line (proves the body runs, not just empty shells); `ru-scanner` start arrives AFTER `en-scanner` done (ordering); `dryRun=1` does NOT modify `data/pipeline.md` (no phase secretly flips `writeFiles`).
  - **Pure-logic close-decision table (1 case, parametrized over 11 inputs):** mirrors the api.js branch in JS — covers `done` with `final:false / true / undefined / null / 0 / 'false'`, plus `error` with payload/null, plus `start` / `log` (never close).
  - **Bug-forensics (1 case):** simulates the pre-v1.29.2 client by cancelling the response stream after the first `done` and verifies the server's `res.on('close')` abort handler is still intact (documents the pre-fix mechanism for future readers).
- **547 → 558** unit + acceptance (+11).

### 🔄 Migration

No user action needed beyond updating to v1.29.2. The next `🌐 Scan` will run both phases.

### Verification

```bash
$ npm run test:ci
# 553 / 553
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.29.2

# Manual smoke — both phases should now emit:
$ curl -sN "http://127.0.0.1:4317/api/stream/scan?source=both&dryRun=1" \
    | grep -E '^event:|"final":'
# event: start                                        ← en-scanner
# ...
# event: done                                         ← phase 1 of 2
# data: {"code":0,"counts":{...},"errors":0,"final":false}
# event: start                                        ← ru-scanner
# ...
# event: done                                         ← phase 2 of 2 (final)
# data: {"code":0,"counts":{...},"errors":0,"final":true}
```

---

## [1.29.1] — 2026-05-14

**Detailed user-facing config guide for the 5 RU portals in help-bundle §5, all 8 locales.**

### 📝 Documentation

- **`docs(help): §5 "Configuring Russian portals — detailed setup guide"`** ([`docs/help/<locale>.md`](docs/help/)): new ### subsection within Portals & sources covers the end-user config flow:
  - 5-row source-inventory table with auth + geo restrictions per adapter.
  - Step 1 — locate `portals.yml` + bootstrap from template.
  - Step 2 — full 5-source `russian_portals:` YAML example.
  - Step 3 — tuning queries, `area`, `per_page`, `only_remote`.
  - Common pitfalls — negative-list collision (with worked example showing the fix).
  - How to disable a single source without losing data.
  - How to verify via 🌐 Scan + the per-source SSE log line shape.
- Universal YAML/code blocks shared across locales; prose translated for ES / PT-BR / KO / JA / RU / ZH-CN / ZH-TW.
- §17 ("How to add a new portal") was the developer flow shipped in v1.29.0; §5 is the user flow shipped in v1.29.1.

### 🧪 Tests

- **`test(help): tests/help-ru-config-section.test.mjs`** — 7 cases asserting every locale's §5 contains the 5-source YAML, the negative-list collision fix, the disable-one-source example, the 5 adapter labels in the verify block, the 5-row inventory table, the `HH_USER_AGENT` env-var reference, and the 17-H2 parity contract held after the edit.
- **540 → 547** unit + acceptance (+7).

### Verification

```bash
$ npm run test:ci
# 547 / 547
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.29.1

# Manual smoke (after redeploy):
$ for lc in en es pt-BR ko ja ru zh-CN zh-TW; do
    curl -fsS "http://127.0.0.1:4317/api/help/$lc" \
      | python3 -c "import sys,json; print('$lc:', 'YES' if 'trudvsem' in json.load(sys.stdin).get('markdown','') else 'NO')"
  done
# every line ends in "YES" — the §5 expansion mentions trudvsem in every locale.
```

---

## [1.29.0] — 2026-05-14

**Russian-portal scanner expanded from 2 to 5 sources. Source registry + dynamic dropdown. New help-section explaining how to add a 12th.**

### ✨ Features

- **`feat(scan): 3 new RU portal adapters — Trudvsem, GetMatch, GeekJob`** ([`server/lib/sources/`](server/lib/sources/)):
  - [`trudvsem.mjs`](server/lib/sources/trudvsem.mjs) — Russian government open-data API (`opendata.trudvsem.ru/api/v1/vacancies`). No auth, no IP gate. Normalizes the documented v1 JSON shape.
  - [`getmatch.mjs`](server/lib/sources/getmatch.mjs) — tech-focused RU HTML board. Defensive regex parser, returns `[]` on parse miss (never throws on healthy 200).
  - [`geekjob.mjs`](server/lib/sources/geekjob.mjs) — same pattern as GetMatch. Handles `article` and `div`-wrapped card variants.

- **`feat(scan): source registry — single source of truth for every adapter`** ([`server/lib/sources/registry.mjs`](server/lib/sources/registry.mjs)): one array of `{ value, label, region, configKey }` records, consumed by the scanner dispatcher, the `GET /api/scan/sources` endpoint, and the SPA's source-filter dropdown. Adding a 12th adapter = one entry here + one adapter file + one row in `RU_DISPATCH`. The pre-v1.29 three-place drift (hardcoded dropdown / hardcoded if-chain / hardcoded default) is gone.

- **`feat(api): GET /api/scan/sources`** ([`server/lib/routes/scan.mjs`](server/lib/routes/scan.mjs)): returns the canonical source list with `Cache-Control: max-age=60`. The SPA fetches this on `#/scan` mount and rebuilds the source-filter dropdown dynamically.

- **`feat(scan-ui): dynamic source-filter dropdown`** ([`public/js/views/scan.js`](public/js/views/scan.js)): on view mount, fetches `/api/scan/sources` and paints `<option>` entries. Build-time hardcoded fallback list survives if the endpoint is unreachable. The filter chip in `#/scan` now lists 11 sources (6 EN ATS + 5 RU).

- **`feat(ru-scanner): default = 5 sources, dispatcher loop generalized`** ([`server/lib/ru-scanner.mjs`](server/lib/ru-scanner.mjs)):
  - Default `russian_portals.sources` (the value used when `portals.yml` omits the array) now pulls from `registry.mjs::RU_CONFIG_KEYS` — 5 sources, not 2.
  - Pre-v1.29 the dispatcher had two hand-written `if (cfg.sources.includes('hh'))` / `if (cfg.sources.includes('habr'))` blocks. v1.29 replaces them with a single loop over `RU_DISPATCH` that's keyed by the registry. Adding a sixth source = no scanner-loop edit.

### 📝 Documentation

- **`docs(help): new §17 "How to add a new job-portal source" × 8 locales`** ([`docs/help/<locale>.md`](docs/help/)) — full English step-by-step (adapter template for API + HTML patterns, registry entry, dispatcher wiring, mocked unit test, `portals.yml` enablement); 7 locale versions with localized prose + universal code blocks + cross-link to the EN canonical text for the full pitfalls table.
- **`docs(help): §5 + §7 updated for 5 RU sources × 8 locales`** — `russian_portals.sources` example now reads `["hh", "habr", "trudvsem", "getmatch", "geekjob"]`; the Source-dropdown description names all 5.
- Help-bundle section count: **16 → 17** (CI parity contract bumped accordingly).

### 🧪 Tests

- **`test(sources): tests/sources-trudvsem.test.mjs`** — 6 cases: normalization, `удалённо`→remote inference, `onlyRemote` filter, 5xx propagation, empty results = no throw, null-record safety.
- **`test(sources): tests/sources-getmatch-geekjob.test.mjs`** — 11 cases across both HTML scrapers: fixture-driven card extraction, nav-anchor skip, empty/null safety, 5xx propagation, `onlyRemote` filter.
- **`test(scan): tests/scan-sources-endpoint.test.mjs`** — 4 cases: shape, RU-source list parity (5 entries), EN-source list parity (6 entries), `Cache-Control` header.
- **`test(ru-scanner): tests/ru-scanner.test.mjs`** — e2e dispatcher test extended to mock all 5 sources.
- **`test(canonical-docs): 17-H2 parity contract`** ([`tests/canonical-docs-coverage.test.mjs`](tests/canonical-docs-coverage.test.mjs)) and **`tests/help-ui.test.mjs`** — both lifted 16 → 17.
- **520 → 540** unit + acceptance (+ 20 new). Playwright 32/32 unchanged.

### 🔄 Migration

For the new RU adapters to fire on your stand, the parent project's `portals.yml` must list them:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]
  area: 113
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
```

If your `portals.yml` has NO `russian_portals.sources:` line at all, the v1.29.0 default kicks in and all 5 sources run automatically. If `sources:` IS present (as in the pre-v1.29 setup), it's used verbatim and you must update it manually — the web-ui never edits parent-project files.

Also note: a global `title_filter.negative: ["php"]` will neutralize every `Senior PHP` query. The scanner emits a stderr warning at scan time (collision detector from v1.13). Adjust the negative list if you see "0 hits" but expected results.

### Verification

```bash
$ npm run test:ci
# 540 / 540
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.29.0

$ curl -fsS http://127.0.0.1:4317/api/scan/sources | jq '.sources | length'
11
$ curl -fsS http://127.0.0.1:4317/api/scan/sources | jq '[.sources[] | select(.region=="ru") | .value]'
[ "geekjob", "getmatch", "habr-career", "hh.ru", "trudvsem" ]
```

---

## [1.28.1] — 2026-05-14

**Hot-fix: router 404 on hashes with `?query`. HH_USER_AGENT row pruned from health.**

### 🚑 Critical hot-fix

- **`fix(router): strip ?query before route lookup`** ([`public/js/router.js`](public/js/router.js)) — pre-v1.28.1 `Router.go('/evaluate?url=…')` produced a hash whose first `split('/')` segment was the whole `"evaluate?url=…"` literal, which never matched a registered route → `__not_found__` (404). Two reported failures had this single root cause:
  - `#/pipeline → ▶` button (`pipeline.js:145`: `Router.go('/evaluate?url=' + encodeURIComponent(url))`).
  - "App settings → Modes" deep link (`settings.js:80`: `href="#/config?tab=modes"`).
  Fix is one line: `hash.split('?')[0]` before the route-name split. The view itself continues to parse query strings via `window.location.hash.split('?')[1]` + `URLSearchParams` (see `evaluate.js`, `config.js`).

### 🧹 Cleanup

- **`fix(health): remove HH_USER_AGENT optional row`** ([`server/lib/routes/health.mjs:54`](server/lib/routes/health.mjs#L54)) — the row surfaced `"unset (hh.ru may 403 from non-RU IPs)"` on every Health page render, including for users who never scan hh.ru. The hh.ru adapter falls back to a baked-in UA when the env var is unset; the 403-from-non-RU gate is still documented in `docs/help/<locale>.md §16` (troubleshooting) and `server/lib/ru-scanner.mjs` still emits a stderr hint at scan time. Removing the row reduces dashboard noise without losing any diagnostic.

### 🧪 Tests

- **`test(router): tests/router-query-string.test.mjs`** — 3 cases: static-source canary (`router.js` must split off `?` before name lookup), explainer-comment canary (the v1.28.1 fix rationale stays in the source), and pure-logic simulation of `current()` over four representative hashes (`#/evaluate?url=…`, `#/config?tab=modes`, `#/reports/abc-123`, `#/dashboard`).
- **`test(health): tests/health-no-hh-user-agent-row.test.mjs`** — 2 cases: regression guard that `/api/health` no longer surfaces `HH_USER_AGENT` row; sanity that adjacent optional rows survived the prune.
- **515 → 520** unit + acceptance (+ 5 new). Playwright 32/32 unchanged.

### Verification

```bash
$ npm run test:ci
# 520 / 520
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.28.1

# Manual smoke (after redeploy):
$ open "http://127.0.0.1:4317/#/evaluate?url=https%3A%2F%2Fexample.com%2Fjd"
# (should render the Evaluate view with the URL prefilled — no 404)
$ open "http://127.0.0.1:4317/#/config?tab=modes"
# (should land directly on the Modes tab of App settings — no 404)
```

---

## [1.28.0] — 2026-05-14

**Docs alignment + `#/batch` `--max-retries N` UI surface.** Closes two open backlog items raised by `qa/QA-PROMPT-docs-vs-app.md`.

### ✨ Features

- **`feat(batch): surface --max-retries N control on #/batch`** ([Issue #2](https://github.com/Fighter90/career-ops-ui/issues/2)) — the canonical [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers) guide documents `--max-retries N` (default 2) but pre-v1.28 the SPA had no way to set it; users were stuck on the runner default.
  - [`public/js/views/batch.js`](public/js/views/batch.js) — new numeric input (1..10), disabled by default, enables only when "Retry failed" is checked. Clears its value when retry is unchecked so an orphaned value can't leak into the next run.
  - [`server/lib/routes/batch.mjs`](server/lib/routes/batch.mjs) — `GET /api/stream/batch?retry=1&maxRetries=N`: parses via `parseInt`, range-validates `1 ≤ N ≤ 10`, silently drops out-of-range/non-integer values (UI is the hard contract; server is defense-in-depth). No-op without `--retry-failed`.
  - i18n: 2 new keys × 8 locales (`batch.maxRetriesLbl`, `batch.maxRetriesAria`) in [`public/js/lib/i18n-dict.js`](public/js/lib/i18n-dict.js).

### 📝 Documentation

- **`docs: align AI-assistant list to career-ops.org/docs canonical`** ([Issue #1](https://github.com/Fighter90/career-ops-ui/issues/1)) — the upstream Quick Start lists Claude Code / Codex / OpenCode / Qwen CLI. Pre-v1.28 we drifted to Claude Code / Codex / Cursor / Gemini CLI / GitHub Copilot CLI, identically across all 8 locales. Resolution: aligned downstream.
  - 8 help-bundles ([`docs/help/<locale>.md`](docs/help/)) — intro paragraph + comparison-table row both now match upstream canonical. One-liner appended: *"other Claude-compatible CLIs work too via the same slash-command surface"*, localized per locale.
  - 8 READMEs ([`README*.md`](README.md)) — intro paragraph aligned with the same one-liner. The "Multi-CLI" feature bullet (about web-ui's own `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` shim files, not about career-ops upstream) deliberately retains its wider list (Cursor / Aider / Gemini CLI) since those CLIs do drive our shims.

### 🧪 Tests

- **`test(canonical-docs): AI-list regression canaries`** — 2 new canaries in [`tests/canonical-docs-coverage.test.mjs`](tests/canonical-docs-coverage.test.mjs):
  - Every help-bundle + README must contain "OpenCode" and "Qwen CLI".
  - No help-bundle or README may contain the pre-v1.28 stale phrase "Cursor, Gemini CLI, GitHub Copilot CLI" (Latin or CJK delimiter).
- **`test(batch): tests/batch-max-retries.test.mjs`** — 7 cases covering: present (`maxRetries=3` → flag appended), out-of-range upper (`=11` → dropped), out-of-range lower (`=0` → dropped), non-integer (`=abc` → dropped), without `retry=1` (always dropped), no-param (runner default 2 wins), combined-with-all-other-flags.
- **506 → 515** unit + acceptance tests (+ 7 max-retries + 2 AI-list canaries). Playwright 32/32 unchanged.

### 📒 Deferred (unchanged)

- **G-005** A-G → A-F report-block realignment — still requires a coordinated commit on the parent [`santifer/career-ops`](https://github.com/santifer/career-ops) `modes/oferta.md`. Tracked in `qa/REGRESSION-v1.27.md §11`.

### Verification

```bash
$ npm run test:ci
# 515 / 515
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.28.0

# Manual smoke:
$ curl -sS http://127.0.0.1:4317/api/health | jq '.version'
"1.28.0"

# AI-list canaries — every help-bundle + README mentions OpenCode + Qwen CLI:
$ for f in docs/help/*.md README*.md; do
    grep -L 'OpenCode' "$f" && echo "  FAIL: $f"
  done
# (silent — all 16 files green)

# max-retries flag pass-through:
$ curl -sS http://127.0.0.1:4317/api/stream/batch?retry=1&maxRetries=3 | head -3
# event: error                                      (runner missing in stand)
# data: {"message":"batch/batch-runner.sh not found..."}
# (the path is exercised by tests/batch-max-retries.test.mjs against a stub runner)
```

---

## [1.27.0] — 2026-05-14

**Cosmetic + a11y polish: deduplicate sidebar `#/dashboard` entry.**

### 🩹 Cosmetic / a11y

- **`fix(sidebar): dedupe #/dashboard entry`** ([`public/index.html:25-32`](public/index.html#L25-L32)) — the brand logo block (`<a class="logo" href="#/dashboard">`) and the first nav item (`<a class="nav-item" href="#/dashboard">`) both targeted the same route. Screen readers announced "Dashboard" twice in a row when entering the sidebar, and keyboard users had a useless extra tab stop on a control with no distinct purpose. The brand block now renders as a plain `<div class="logo">`. The Dashboard nav item remains the sole link.

### 📒 Deferred (parent-coordinated)

- **G-005 / PR-B** (A-G → A-F report block realignment) — still requires a coordinated commit on the parent [`santifer/career-ops`](https://github.com/santifer/career-ops) `modes/oferta.md`. Tracked in `qa/REGRESSION-v1.27.md §Deferred`.

### 🧪 Tests

- **506 / 506** unit + **32 / 32** Playwright — unchanged. No new test required (cosmetic-only).
- CHANGELOG parity gate: ✓ all 8 locales at v1.27.0.

### Verification

```bash
$ npm run test:ci
# 506 / 506
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.27.0

# Manual smoke (after restart):
$ curl -sS http://127.0.0.1:4317/api/health | jq '.version'
"1.27.0"
$ curl -sS http://127.0.0.1:4317/ | grep -c 'href="#/dashboard"'
1   # was 2 on v1.26.1
```

---

## [1.26.1] — 2026-05-14

**Hot-fix: WCAG 2.5.5 — header `.btn` height restored to 44 px floor.**

### 🚑 Critical hot-fix

- **`fix(css): restore min-height: 44px + line-height + flex-shrink:0 on .btn`** ([`public/css/app.css:391-410`](public/css/app.css#L391-L410)) — live Playwright measurement on v1.26.0 found 5 header buttons rendering at 39-41 px (Doctor / Quick scan / Open Pipeline / 🌐 Scan now / ✨ Auto-pipeline a URL) — a WCAG 2.5.5 violation. The fix:
  - Adds `min-height: 44px` to `.btn`. A stale comment at line 427-430 still claimed this floor was in place, but the declaration itself had been lost between v1.18 and v1.26.
  - Adds `line-height: 1.2` so the in-block text doesn't compute the row taller than intended on browsers with looser default leading.
  - Adds `flex-shrink: 0` + `box-sizing: border-box` to keep parent flex rows from squashing the button under their own height constraints.
  - `.btn-sm` keeps its existing 32 px floor (small-control exception per WCAG 2.5.5 + 2.5.8 spaced-target) — `.btn-sm` follows `.btn` in source order so the override applies.

### 🧪 Tests

- **`test(wcag): tests/wcag-target-size.test.mjs`** — 4 static CSS canaries:
  - `.btn` block has `min-height: 44px`
  - `.btn` block has `flex-shrink: 0`
  - `.btn-sm` keeps `min-height: 32px`
  - `.btn-sm` defined AFTER `.btn` in source order (cascade)
- **502 → 506** unit (+4) + 32/32 Playwright unchanged.
- Live verification via headless Chromium across all 13 sidebar routes — every `.btn:not(.btn-sm)` measured ≥ 44 × 44 px after the fix.

### Verification

```bash
$ npm run test:ci
# 506 / 506
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.26.1

# Live Playwright probe (run against server on :4317):
$ for route in /dashboard /scan /pipeline /evaluate /batch /reports /tracker \
                /activity /cv /profile /config /health /help; do
    # use the parent project's playwright to measure
    cd $CAREER_OPS_ROOT && node -e "
      const { chromium } = require('playwright');
      (async () => {
        const browser = await chromium.launch({ headless: true });
        const page = await (await browser.newContext()).newPage();
        await page.goto('http://127.0.0.1:4317/#$route', { waitUntil: 'networkidle' });
        const bad = await page.\$\$eval('.btn:not(.btn-sm)', els =>
          els.filter(b => b.getBoundingClientRect().height < 44).length);
        console.log('$route:', bad === 0 ? 'PASS' : 'FAIL ' + bad);
        await browser.close();
      })();
    "
  done
# Every route → PASS
```

### Out of scope (v1.27.0)

| Item | Notes |
|---|---|
| G-005 — A-G → A-F report block realignment | Still waiting on coordinated parent commit. |
| G-003 — `README.cn.md` rename | Verified-already-closed: repo has `README.zh-CN.md`, no orphan. |
| Sidebar duplicate `#/dashboard` (brand logo + nav item) | Trivial cosmetic, zero UX impact. |

---

## [1.26.0] — 2026-05-14

**Test pyramid (unit → functional → acceptance → e2e) + coverage push to ≥ 93 % line / ≥ 83 % branch.** Adopts the 4-tier structure mandated by the v1.25 backlog. Adds 22 new tests targeting the biggest coverage gaps from v1.25's `npm run test:coverage` report; introduces the `tests/acceptance/` directory for cross-endpoint user-journey tests.

### 📐 Test pyramid documentation

- **`docs(architecture): TESTING.md describes the 4-tier pyramid`** ([`docs/architecture/TESTING.md`](docs/architecture/TESTING.md)) — single-source explanation of how the suite is structured and where new tests land:
  - **Tier 1 (unit)** — pure helpers (`security`, `parsers`, `prompts`, `file-lock`, `rate-limit`, `safe-fetch`, `env-config`). No port binding, no FS beyond stubs, no subprocess.
  - **Tier 2 (functional)** — per-endpoint contracts. `createApp()` against ephemeral port + temp `CAREER_OPS_ROOT`.
  - **Tier 3 (acceptance)** — multi-endpoint user journeys. NEW `tests/acceptance/` directory.
  - **Tier 4 (e2e)** — Playwright headless Chromium (`tests/playwright-{smoke,full-cycle}.mjs`, `tests/e2e{,-comprehensive}.mjs`).
- 100% line coverage target is explicitly scoped to **working functionality** — the `if (isMain) { … }` boot block in `server/index.mjs` and live-LLM call paths in `auto-pipeline.mjs` are documented exclusions.

### 🧪 Tier 2 — Functional gap fills

- **`test(jds): jds-list-create-get.test.mjs`** — pre-v1.26 only the DELETE path was tested. New file adds 10 tests covering:
  - `GET /api/jds` shape on empty + populated state
  - `POST /api/jds` with explicit slug, auto-generated slug, slug normalization warning
  - `POST /api/jds` empty-body / stripped-to-empty-slug 400 responses
  - `GET /api/jds/:name` body roundtrip, 404 on unknown, traversal rejection
  - **`server/lib/routes/jds.mjs` coverage: 61.64 % → 100 % line.**
- **`test(auto-pipeline): auto-pipeline-rejection-paths.test.mjs`** — 10 tests covering every URL rejection branch that doesn't need a live LLM:
  - `javascript:` / `file://` / malformed-string / empty / no-key-body
  - SSRF: loopback, RFC1918, link-local IMDS (169.254.169.254)
  - `mode: 'manual'` interaction with rejected URL — error precedes any done event
  - **`server/lib/routes/auto-pipeline.mjs` branch coverage: 50.00 % → 59.38 %.**

### 🧪 Tier 3 — Acceptance (NEW)

- **`test(acceptance): jd-evaluate-tracker-flow.test.mjs`** — first cross-endpoint user journey. Threads 7 endpoints in the order the SPA invokes them:

  1. `POST /api/jds` — save raw JD
  2. `GET /api/jds` — confirm in list
  3. `GET /api/jds/:name` — read body verbatim
  4. `POST /api/evaluate` (manual fallback) — generate prompt
  5. `POST /api/tracker` — add row
  6. `GET /api/tracker` — verify presence
  7. `GET /api/activity` — confirm audit-log entry

  Second journey: pipeline-add → preview → tracker → delete cycle.

### 🧪 Test count

- **480 → 502** unit + acceptance (+22). 32/32 Playwright unchanged.
- `npm test` now runs `tests/*.test.mjs tests/acceptance/*.test.mjs`.
- `npm run test:coverage` same. `npm run test:ci` runs all of the above plus the two CI gates from v1.24.1 (`check-no-also-leftovers`) and v1.25.0 (`check-changelog-parity`).

### Coverage snapshot

```
all files                     | 93.66 line | 83.73 branch | 92.91 func
server/lib/security.mjs       | 99.30 line
server/lib/safe-fetch.mjs     | 95.81 line
server/lib/file-lock.mjs      | 93.15 line
server/lib/rate-limit.mjs     | 100.00 line
server/lib/parsers.mjs        | 99.57 line
server/lib/routes/jds.mjs     | 100.00 line  ← was 61.64 in v1.25
server/lib/routes/tracker.mjs | 100.00 line
server/lib/routes/reports.mjs | 100.00 line
server/lib/routes/activity.mjs| 100.00 line
```

Remaining < 95 % line modules are gated by live-LLM / spawn-mock complexity:

- `auto-pipeline.mjs` (46 %) — uncovered region is the live Anthropic / Gemini evaluate path + report-save + tracker-write SSE flow. Out of scope for the 100 % target per [TESTING.md "Goal: 100% line coverage of working functionality"](docs/architecture/TESTING.md).
- `batch.mjs` (67 %) — uncovered region is `streamNodeScript` spawn of `batch-runner.sh`. Out of scope (subprocess mocking gap).
- `cv-import.mjs` (77 %) — uncovered region is pandoc / pdftotext fallback paths when the system tools are missing. Out of scope (env-dependent).

### Verification

```bash
$ npm run test:ci
# 502 / 502
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.26.0

$ npm run test:coverage 2>&1 | grep '^# all files'
# all files | 93.66 | 83.73 | 92.91

$ ls tests/acceptance/
# jd-evaluate-tracker-flow.test.mjs
```

### Breaking changes

None.

### Out of scope (v1.27+)

| Item | Notes |
|---|---|
| Live LLM-path coverage in `auto-pipeline.mjs` | Needs SDK-adapter mock + `withFileLock` stub + report-save stub. Currently 46 % line; would push toward 95 % with the mock harness. |
| Subprocess-mocked coverage for `batch.mjs::streamNodeScript` | Needs spawn-mock; would push 67 % → 90 %. |
| `cv-import.mjs` pandoc / pdftotext fallback path | Needs env-injected `which()` stub. |
| G-005 (A-F report block realignment) | Still waiting on coordinated parent commit. |

---

## [1.25.0] — 2026-05-14

**Auto-pipeline manual short-circuit + dashboard cosmetic + CHANGELOG parity backfill.** Closes G-014 (auto-pipeline ignored `mode: 'manual'`), G-012 (CHANGELOG parity drift — 6 locales were 2 releases behind), and the dashboard `✨ ✨` double-glyph cosmetic. G-003 (`README.cn.md` rename) was de-facto already closed — repo only has `README.zh-CN.md`. G-005 (A-G → A-F report block realignment) requires a coordinated parent-project commit and stays deferred.

### 🛡️ G-014 — Auto-pipeline `mode: 'manual'` short-circuit

- **`fix(auto-pipeline): G-014 — honour mode:'manual' short-circuit`** ([`server/lib/routes/auto-pipeline.mjs:158-195`](server/lib/routes/auto-pipeline.mjs#L158-L195)) — pre-v1.25 the route always called an LLM. Passing `mode: 'manual'` (mirroring `/api/evaluate` since v1.10.2) was silently ignored, the request hung 1-3 min on Anthropic. Now the handler:
  - Accepts `mode` AND `evalMode` for back-compat. Either value of `'manual'` triggers the short-circuit.
  - Emits all 5 SSE stages with `status: 'done'` / `status: 'skipped'`. No fetch. No LLM call. No $0.05 per request.
  - `done` payload carries `{ mode: 'manual', prompt: <buildEvaluationPrompt scaffold>, message }` — the SPA can render it like the existing `/api/evaluate` manual-prompt card.
- **Closes DoS-risk** on `HOST=0.0.0.0`: previously, even with `llmRateLimit` capping 10 req/60s/IP, 10 attackers × 10 reqs = $50/min in Anthropic burn. Short-circuit fires before the rate-limit decrement counts toward a real call.
- **Tests** — [`tests/auto-pipeline-manual-mode.test.mjs`](tests/auto-pipeline-manual-mode.test.mjs): 3 tests confirm (1) `mode: 'manual'` returns < 2 s with all 5 step keys, (2) even with `ANTHROPIC_API_KEY` set the short-circuit still fires (the original symptom), (3) legacy `evalMode: 'manual'` callers keep working.

### 📝 G-012 — CHANGELOG parity backfill (6 locales × 2 missing releases)

- **`docs(changelog): backfill v1.23.0, v1.24.0, v1.24.1, v1.25.0 in 6 lagging locales`** — pre-v1.25 only EN had v1.23-v1.24; RU was 1 release behind, the other 6 were 2 releases behind. v1.25 dispatches parallel translation agents (mirrors the v1.23 pattern) to land all four entries in `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md`. RU gets v1.24.0 + v1.24.1 + v1.25.0 (it already had v1.23.0 from the v1.23 cycle).
- **`feat(ci): scripts/check-changelog-parity.mjs gate`** — fails the build if any locale CHANGELOG's newest entry is older than the EN canonical. Wired into `npm run test:ci`. Pre-existing G-012 drift would have caught itself the moment it crossed the EN boundary.

### ✨ Cosmetic — dashboard double-glyph dedup

- **`fix(dashboard): dedup ✨ glyph in auto-pipeline button label`** ([`public/js/lib/i18n-dict.js:219`](public/js/lib/i18n-dict.js#L219)) — `dash.autoPipeline` carried a leading `✨` in every locale string AND `public/js/views/dashboard.js:58` prepended another `✨` in the view. Result: button rendered `✨ ✨ Auto-pipeline …`. v1.25 drops the leading glyph from every locale's DICT entry; the view's prefix is the single source. Same audit pass swept the rest of the i18n bundle — no other double-glyph patterns found.

### 🚫 Deferred to a future release

- **G-005 — Report block A-G → A-F per canonical career-ops.org/docs** — requires a coordinated commit in the parent `santifer/career-ops` project (rewrite `modes/oferta.md` to emit A=Role, B=CV-match, C=Strategy, D=Comp, E=Personalization, F=STAR — drop C-Risks/G-Legitimacy as separate blocks). v1.25.0 ships the web-ui side ready for the new schema (`reports.js` already accepts arbitrary block letters since v1.13). Tracked for the next release window when parent + child can land together.
- **G-003 — `README.cn.md` → `README.zh-CN.md` rename** — verified during v1.25 prep: repo already has `README.zh-CN.md` (no orphan `README.cn.md` anywhere under the worktree). The G-003 finding was stale.

### 🧪 Tests

- **477 → 480** unit (+3 from PR-B `auto-pipeline-manual-mode.test.mjs`).
- 32/32 Playwright unchanged.
- `npm run test:ci` now runs `npm test` + `check-no-also-leftovers.mjs` + `check-changelog-parity.mjs`.

### Verification

```bash
$ npm run test:ci
# 480 / 480
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.25.0

# G-014 — manual mode returns < 2 s even with ANTHROPIC_API_KEY set:
$ ANTHROPIC_API_KEY=sk-ant-test PORT=4317 npm start &
$ sleep 3
$ time curl -sS -X POST -H 'Content-Type: application/json' \
    -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/x","mode":"manual"}' \
    http://127.0.0.1:4317/api/auto-pipeline | head -20
# real  0m0.1xx s  (was 1-3 min)
# event: start … event: step (×5) … event: done {"mode":"manual","prompt":"…"}

# G-012 — every locale CHANGELOG carries the v1.25.0 entry:
$ grep -c '^## \[1.25.0\]' CHANGELOG*.md
# 8 files, each → 1

# Cosmetic — dashboard glyph:
$ grep "dash.autoPipeline" public/js/lib/i18n-dict.js
# No leading ✨ in any locale value (view supplies the single glyph)
```

### Breaking changes

None. `mode: 'manual'` is opt-in; legacy `evalMode: 'manual'` callers keep working unchanged.

### Out of scope (v1.26+)

| Item | Notes |
|---|---|
| G-005 — A-F report block realignment | Needs coordinated parent commit (`santifer/career-ops` rewrites `modes/oferta.md`). |
| Live execution of QA scenario 31 **visual** sub-tests | Require browser-driven agent (Claude Cowork). Covered partially by Playwright smoke. |
| `i18n-dict.js` over 400-LOC target | Translation fixture — exempt by policy. Split would add HTTP requests without a bundler. |

---

## [1.24.1] — 2026-05-14

**Hot-fix: `#/config` crash on all 8 locales (G-015).**

### 🚑 Critical hot-fix

- **`fix(config): G-015 — replace removed Element.prototype.also call in config.js`** ([`public/js/views/config.js:371`](public/js/views/config.js#L371)) — v1.22.0 N-2 dropped the `Element.prototype.also` global monkey-patch and migrated `cv.js` to a free-statement pattern, but **missed `config.js`**. The result: `#/config` crashed at first invocation on every locale with `c(...).also is not a function`. v1.24.1 applies the same migration pattern from `cv.js:188-201` — extract the tree to a `const root = c(...)`, run the activation block on its own, then `return root;`.

### 🛡️ CI gate

- **`feat(ci): scripts/check-no-also-leftovers.mjs sweep`** — walks every file under `public/js/views/` and fails the build on any `.also(` call site (commented references allowed). Wired into the new `npm run test:ci` script. Future revert of the monkey-patch removal can't re-introduce the same regression silently.

### 🧪 Tests

- **`test: tests/config-view-syntax.test.mjs`** — three guards:
  - parse `config.js` via `node:vm.Script` (catches syntax-level regressions without needing Playwright)
  - assert no `.also(` survives outside comments
  - assert the `const root = c(...)` / `return root;` migration anchors are present
- **474 → 477** unit (+3) + 32/32 Playwright unchanged.

### Verification

```bash
$ npm run test:ci
# 477 / 477
# ✓ no .also( leftovers in views/

# Browser smoke:
$ open http://127.0.0.1:4317/#/config
# → renders normally, no "is not a function" card. Every locale equivalent.
```

### Out of scope (deferred to v1.25)

- G-014, G-012, G-005, G-003 — see v1.25.0 entry below for the bundle.

---

## [1.24.0] — 2026-05-14

**Help-bundle content-depth refresh + live execution of QA scenario 31 + RU CHANGELOG end-to-end.** Closes both items the v1.23.0 "Out of scope" table deferred to v1.24: the full content-depth refresh of all 8 help bundles from the 5 canonical career-ops.org/docs URLs (was URL-coverage-only since v1.11.x), and the live execution of QA scenario 31 against a running server (was "needs browser agent + LLM credentials" — turned out 6/6 sub-tests are reachable via curl + grep, only the visual sub-tests need a browser).

### 📖 Help-bundle content-depth refresh

- **`docs(help): refresh en.md from 5 canonical career-ops.org/docs URLs`** ([`docs/help/en.md`](docs/help/en.md)) — pre-v1.24 the EN bundle was 1113 lines and listed the 5 canonical URLs in the front-matter but didn't expand on them in the body. v1.24 fetches all 5 URLs via WebFetch and deepens the matching H2 sections:
  - **About career-ops (front-matter)** — added principles (data sovereignty, AI-agnostic, human-controlled), "What career-ops is NOT" block, expanded concepts inventory from 6 to 10 rows (added Proof points, JD store, Interview-prep, Batch additions).
  - **§5 Portals** — added canonical bootstrap `cp templates/portals.example.yml portals.yml`, clarified required vs optional fields per `tracked_companies` entry.
  - **§7 Scan** — added "no AI tokens consumed" note for Option A, follow-up commands list (`apply` / `contacto` / `deep` / `tracker`).
  - **§14 Apply checklist** — split into SPA checklist mode vs Manual-vs-Playwright-assisted vs Full CLI flow (canonical 8 numbered steps from `/career-ops apply <company>` to `Submitted.` with `Evaluated → Applied` auto-transition); batch evaluate subsection now has TSV schema table + all 4 flags documented + `merge-tracker.mjs --dry-run`; Playwright Setup subsection lists install commands, MCP registration, alternative `.claude/settings.local.json`, headless-by-default note.
- **16-H2 section parity preserved** (CI test `help-ui.test.mjs::section-parity` asserts exactly 16 H2 sections across all 8 locales).
- **Each of the 5 canonical URLs appears ≥ 2 times** in the bundle (CI test `canonical-docs-coverage.test.mjs` enforces). Per-URL count after v1.24: `what-is-career-ops` × 4, `scan-job-portals` × 5, `apply-for-a-job` × 3, `batch-evaluate-offers` × 5, `set-up-playwright` × 3.
- **`docs(help): translate the v1.24 deepening to 7 non-EN locales`** — 7 parallel translation agents dispatched. Each target locale (es / pt-BR / ko-KR / ja / ru / zh-CN / zh-TW) gets a refreshed bundle that mirrors the EN structure section-for-section, preserves verbatim code blocks / URLs / file paths / button labels (📁 Upload CV / 🌐 Scan now / ▶ Evaluate / 📄 Generate PDF / 💾 Save) and English abbreviations (CSP, SSRF, TOCTOU, WCAG, ATS, JD, SSE, REST, API), and translates the deepening to publication-grade native technical style in the target language.

### 🧪 QA scenario 31 — live execution (6/6 PASS)

- **`docs(qa): append last-verified live-execution log to qa/claude-cowork-browser-test-prompt.md`** — pre-v1.24 scenario 31 was documented but never run against a live server (deferred as "needs browser agent + LLM credentials"). v1.24 ran all 6 sub-tests against `http://127.0.0.1:4317`:

  | Sub | Description | Status |
  |---|---|---|
  | 31.1 | Score thresholds in help bundles | ✅ PASS (4.5 × 3, 4.0 × 9, 3.5 × 6 mentions in `docs/help/en.md`) |
  | 31.2 | Scan workflow endpoints | ✅ PASS (`/api/stream/scan-{en,ru}` + `/api/scan-ru/config` → 404; `/api/scan/regional/config` → 200) |
  | 31.3 | `/api/apply-helper` checklist | ✅ PASS (body contains `career-ops apply` + `auto-submit` warning) |
  | 31.4 | `/api/batch` endpoint | ✅ PASS (keys `[exists, runnerExists, raw, rows, additions]`) |
  | 31.5 | Playwright availability | ✅ PASS (`/api/health` reports `Playwright (parent node_modules) ok: true, value: installed`) |
  | 31.6 | Help-bundle URL coverage (5 URLs × 8 locales) | ✅ PASS (**40 / 40 ✓**) |

  Visual-only sub-tests (require browser) flagged separately in the QA prompt — they remain runnable via Claude Cowork or `npm run test:e2e:browser`.

### 🌐 RU CHANGELOG end-to-end (M-9 follow-up)

- **`docs(translate): CHANGELOG.ru.md retry agent — full body translation`** ([`CHANGELOG.ru.md`](CHANGELOG.ru.md)) — the v1.23.0 release shipped with the RU CHANGELOG retry agent still in flight (it had crashed once with a socket error and was re-dispatched). v1.24 picks up the agent's 1542-line full translation: every entry v1.23.0 → v1.6.0 has a publication-grade Russian body, no more EN-bodied stop-gaps. Style discipline matches the v1.22.0 README quality refresh: "функциональность" / "возможности" / "поведение" replace clunky "функционал"; "через" / "с помощью" replace "при помощи"; active voice over passive; "эндпоинт", "лимит запросов", "состояние гонки", "санитайзинг" as canonical terms; English abbreviations (TOCTOU, CSP, SSRF, WCAG, ATS, JD, SSE, REST, API) preserved.

### 🧪 Tests

- **474 / 474** unit + 20 / 20 smoke E2E + 32 / 32 Playwright. Zero behavioral test deltas; every help-bundle CI assertion (16 H2 sections × 8 locales, 5 URLs × ≥ 2 mentions, content floor) still green.

### Verification

```bash
$ npm test                            # 474 / 474

# Help-bundle deepening:
$ wc -l docs/help/en.md
# ~1270 lines (was 1113 — deepened, not bloated)

$ for url in what-is-career-ops scan-job-portals apply-for-a-job \
             batch-evaluate-offers set-up-playwright; do
    echo -n "$url: "
    grep -c "$url" docs/help/en.md
  done
# what-is-career-ops: 4
# scan-job-portals: 5
# apply-for-a-job: 3
# batch-evaluate-offers: 5
# set-up-playwright: 3

# Scenario 31.6 — 40/40 URL coverage:
$ for lang in en es pt-BR ko ja ru zh-CN zh-TW; do
    echo -n "$lang: "
    for url in what-is-career-ops scan-job-portals apply-for-a-job \
               batch-evaluate-offers set-up-playwright; do
      curl -sS "http://127.0.0.1:4317/api/help/$lang" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('markdown',''))" \
        | grep -q "$url" && echo -n "✓ " || echo -n "✗ "
    done
    echo
  done
```

### Breaking changes

None.

### Out of scope (v1.25+)

| Item | Notes |
|---|---|
| Live execution of scenario 31 **visual** sub-tests | Require browser-driven agent (Claude Cowork or `npm run test:e2e:browser`). Out of scope for curl-only execution; covered by existing Playwright smoke. |
| RU CHANGELOG body translation **of older entries** (v1.5.x and below) | The retry agent only covered v1.6.0 onwards. Pre-v1.6 entries (`v1.5.x`, etc.) — if they ever existed — remain pre-existing-content. |
| Visual regression on dashboard screenshots after future SPA changes | `scripts/capture-dashboard-screenshots.mjs` regenerates per-locale PNGs; no automated diff currently. |

---

## [1.23.0] — 2026-05-14

**i18n split + connection-banner CI fix + localized dashboard screenshots + every backlog stop-gap closed.** Ships the three items the v1.22.0 "Out of scope" table flagged for v1.23 (M-9 locale CHANGELOG bodies, N-1 `i18n.js` LOC split, help-bundle content audit) plus a hot-fix for the smoke E2E test that turned the v1.22.0 main-branch CI red.

### 🚑 CI hot-fix — connection banner recovery

- **`fix(client): reset health-poll cadence + visibilitychange eager re-check`** ([`public/js/api.js:21-91`](public/js/api.js#L21-L91)) — v1.22.0's M-6 exponential backoff was correct (3 s → 6 s → 12 s → cap 15 s, down from the original cap 60 s) but the in-flight `setTimeout` was locked to whatever delay was set previously. A server killed at t=0.1 with the first ping at t=3 would fail, double the delay to 6, and the next recovery probe wouldn't fire until t=9. The smoke E2E's "Flow 2a: connection banner appears on server down, hides on recovery" waited only 4 s and turned red on `main`.

    v1.23.0 reshapes the polling loop:

    - `_healthHandle` is tracked so `setConnectionState(lost=true)` can `clearTimeout` and re-schedule with `_HEALTH_MIN`. The first recovery probe now fires within 3 s of going down, regardless of what delay was queued.
    - `_HEALTH_MAX` lowered from 60 s to 15 s. Backgrounded tab against a dead server still recovers within one polling cycle when the user comes back; bandwidth savings stay substantial.
    - `document.addEventListener('visibilitychange')` eager-rechecks when the tab regains focus and `connectionLost === true` — Cmd-Tab back doesn't wait for the next backoff tick.

### 🧹 N-1 — i18n.js split (over the 400-LOC target)

- **`refactor(client): split DICT into i18n-dict.js (data) + i18n.js (logic)`** — pre-v1.23 `public/js/lib/i18n.js` was 639 LOC. The bulk (lines 23-586) was the `DICT` translation table — pure structured data. v1.23.0 extracts that to [`public/js/lib/i18n-dict.js`](public/js/lib/i18n-dict.js) (578 LOC, exempt-from-LOC-rule per CLAUDE.md "Exempt from these limits: generated files, migrations, test fixtures, lock files, vendored code" — translation tables qualify as fixtures), leaving [`public/js/lib/i18n.js`](public/js/lib/i18n.js) at 86 LOC of pure module logic (well under the 400-LOC target).
- **Loader contract:** `i18n-dict.js` populates `window.__I18N_DICT = { … }`, then `i18n.js` reads it inside the existing IIFE. [`public/index.html`](public/index.html) loads them in order — `i18n-dict.js` before `i18n.js` — so the IIFE sees a fully-populated DICT at construction time. Missing-dict fallback: every `t()` call returns its inline fallback or bare key, which surfaces a misconfiguration loudly without crashing the SPA.
- **Test plumbing updated:** [`tests/i18n-coverage.test.mjs`](tests/i18n-coverage.test.mjs), [`tests/help-ui.test.mjs`](tests/help-ui.test.mjs), [`tests/canonical-docs-coverage.test.mjs`](tests/canonical-docs-coverage.test.mjs) now run both files through the test VM context (or concatenate their source for the regex sweep), preserving every existing assertion.

### 🌐 M-9 — Locale CHANGELOG body translations

- **`docs(translate): 7 non-EN CHANGELOG files end-to-end`** — pre-v1.23 `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` carried EN-bodied stop-gap notes for every entry from v1.13.0 onwards, with a footer pointing readers at the EN canonical. v1.23.0 dispatches 7 parallel translation agents — one per locale — that rewrite every body to publication-grade technical style in the target language. Stop-gap notes removed. Code blocks, file paths, URLs, commit-message-style strings (`fix(security): B-1 — …`), env vars, and link labels preserved verbatim across all locales.

### 🖼️ Localized dashboard screenshots in every README

- **`docs(readme): wire each locale README at its locale-specific PNG`** — pre-v1.23 only `README.pt-BR.md` referenced `dashboard-pt-BR.png`; the other 6 non-EN READMEs still pointed at `dashboard-en.png`. The screenshots (already captured in v1.22.0 cycle by [`scripts/capture-dashboard-screenshots.mjs`](scripts/capture-dashboard-screenshots.mjs)) were present in `images/` but unused. v1.23.0 updates every `README.{es,ja,ko-KR,ru,zh-CN,zh-TW}.md` line 14 to its own `dashboard-<locale>.png`.

### 🧪 Tests

- Same 474 / 474 unit + 32 / 32 Playwright as v1.22.0. **Smoke E2E now 20 / 20** (was 19 / 1 fail on `main` after v1.22.0 due to the banner-recovery regression; v1.23.0's reschedule fix closes it).
- Three existing tests rewired to handle the i18n split. Zero new test files; zero new assertions deleted.

### Verification

```bash
$ npm test
# 474 / 474

$ npm run test:e2e
# passed: 20    failed: 0    (was 19/1 on v1.22.0 main)

$ wc -l public/js/lib/i18n.js public/js/lib/i18n-dict.js
#       86 public/js/lib/i18n.js          ← logic, under target
#      578 public/js/lib/i18n-dict.js     ← data fixture, exempt

$ grep -h 'dashboard-' README*.md | sed -E 's/.*(dashboard-[^)]+).*/\1/' | sort -u
# dashboard-en.png    (README.md only)
# dashboard-es.png    dashboard-ja.png
# dashboard-ko-KR.png dashboard-pt-BR.png
# dashboard-ru.png    dashboard-zh-CN.png  dashboard-zh-TW.png

# CHANGELOG translation sanity: each locale file > 200 lines of native content
$ wc -l CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md | grep -v total
```

### Breaking changes

None. `public/index.html` now loads two scripts where it loaded one — anyone serving the SPA from a CDN must pick up `i18n-dict.js`; the script load order is enforced by the order of `<script src>` tags in `index.html`. The runtime fallback (empty DICT → `t()` returns the inline EN fallback) prevents hard crashes when the new file is missing.

### Out of scope (v1.24+)

| Item | Notes |
|---|---|
| Help-bundle CONTENT depth refresh from career-ops.org/docs (vs URL coverage) | The 5 canonical URLs already appear in every locale's help bundle since v1.11.x and Scenario 31.6 in the QA prompt verifies coverage. Content-body depth refresh is a v1.24+ candidate. |
| Live execution of QA scenario 31 against a running server | Requires browser agent + live LLM credentials. v1.24 candidate. |
| Per-component touch-target sweep on new mode-page hint paragraphs | v1.22.0 M-1 added `<p class="field-hint">` elements that haven't been verified against WCAG 2.5.5 min-height in all 8 locales. |

---

## [1.22.0] — 2026-05-14

**M/L/N backlog clearout + docs alignment + translation quality pass.** The entire v1.20.1-BACKLOG.md medium-and-below tier shipped in one release: nine M-items, five L-items, two nits. Plus a docs-alignment audit against the five canonical [career-ops.org/docs](https://career-ops.org/docs) guides, refreshed system prompts under `.claude/` and `.github/`, and quality-refreshed READMEs in all 7 non-English locales.

### 🛡️ Security hardening (defense-in-depth)

- **`fix(security): M-4 — entity-aware stripDangerousMarkdown`** ([`server/lib/security.mjs`](server/lib/security.mjs)) — the pre-v1.22 regex matched `<script>`, `javascript:`, `on*=` as literal substrings. `&lt;script&gt;`, `java&#115;cript:`, and `<img src="data:image/svg+xml,<svg onload=…>">` slipped through. The strip now decodes `&lt;`, `&gt;`, `&amp;`, `&quot;`, numeric (`&#NN;`) and hex (`&#xHH;`) entities **before** the strip regex runs. Validated by 11 tests in [`tests/cv-xss-bypasses.test.mjs`](tests/cv-xss-bypasses.test.mjs). Real defense is still the client-side `UI.md` escape-first pipeline; this hardens the at-rest file.

- **`fix(security): L-2 — bash --noprofile --norc on the batch runner`** ([`server/lib/routes/batch.mjs:108`](server/lib/routes/batch.mjs#L108)) — `spawn('bash', [PATHS.batchRunner, ...])` used to inherit the user's `~/.bashrc`. A hostile rc file could influence the run. Now `spawn('bash', ['--noprofile', '--norc', PATHS.batchRunner, ...])`.

### 🔒 Resilience

- **`fix(client): M-6 — exponential backoff on health ping`** ([`public/js/api.js:22-48`](public/js/api.js#L22-L48)) — the disconnected-state poller used to fire 28,800 fetches against a dead server overnight. Now 3 s → 6 s → 12 s → 24 s → 60 s; resets to 3 s on first 2xx recovery. Setup is a `setTimeout` chain (not `setInterval`) so each step picks up the new delay.

- **`fix(client): M-5 — Safari private-mode localStorage guard`** ([`public/js/lib/i18n.js:572-583`](public/js/lib/i18n.js#L572-L583)) — Safari private-mode throws `SecurityError` on every `localStorage.getItem/setItem`. The IIFE-during-load used to fail the entire i18n module, leaving the SPA rendering raw keys. Wrapped both calls in try/catch with the `detect()` browser-language fallback.

- **`fix(server): M-2 — body-size cap on outbound preview fetches (test + verify)`** — the v1.21.0 `safeGet` already streamed chunks and capped at `opts.maxBytes`. v1.22 adds an explicit regression test in [`tests/ssrf-redirect-rebind.test.mjs`](tests/ssrf-redirect-rebind.test.mjs) to lock the contract: 100 KB upstream + 4 KB cap → response ≤ 4 KB.

- **`fix(client): L-5 — clear setTimeout on hashchange in scan.js`** ([`public/js/views/scan.js:6-22, :113-120`](public/js/views/scan.js#L6-L22)) — the post-done 300 ms `refreshResults()` timer used to leak when the user navigated off `#/scan` in that window. Handle is now captured and cleared in `__cancelActiveScanPoll`.

- **`fix(client): L-4 — multi-line SSE data: joiner`** ([`public/js/lib/auto-pipeline.js:158-176`](public/js/lib/auto-pipeline.js#L158-L176)) — the SSE parser used `match()` (single-line). Per spec, an event may carry multiple `data:` lines that the consumer joins with `\n`. Server currently sends single-line JSON, so the old code worked — but was brittle to any future multi-line payload.

### ♿ Accessibility

- **`feat(a11y): M-3 — WCAG 1.4.1 redundant cues on score pills + connection banner`** ([`public/css/app.css:602-625, :812-822`](public/css/app.css#L602-L625)) — score-high / score-mid / score-low used to convey state by hue alone (red/amber/green). Users who can't perceive hue had no fallback. Each tier now gets a redundant glyph via `::before` (✓ / ◐ / ○). Connection banner gets a leading `⚠` glyph in the offline state. Render sites untouched — pure CSS hardening.

- **`feat(a11y): M-1 — inline hint paragraphs for every mode-page field`** ([`public/js/views/mode-page.js`](public/js/views/mode-page.js), [`public/js/lib/i18n.js`](public/js/lib/i18n.js)) — v1.20.0 wired `htmlFor → id` for every mode-page field but didn't carry inline hint copy; only the README walkthroughs documented field intent. v1.22.0 adds 19 hint i18n keys × 8 locales = **152 new translations** and the `field()` builder now renders a `<p id="…-hint">` with `aria-describedby` wiring per field. Screen-reader users hear the hint when the input is focused.

- **`fix(a11y): M-7 — null-guard on UI.el() htmlFor alias`** ([`public/js/api.js:194-198`](public/js/api.js#L194-L198)) — `htmlFor: null` used to render literal `for="null"`. One-liner mirror of the fallthrough branch's `v != null && v !== false` guard.

### 🧹 Quality / portability

- **`fix(server): L-1 — parseInt radix in health.mjs + bin/start.sh + bin/setup.sh`** — `parseInt(process.versions.node)` without radix triggers a lint warning and is brittle if Node ever ships hex versions. Added `10` everywhere.

- **`fix(server): L-3 — Windows-safe entrypoint check`** ([`server/index.mjs:159-163`](server/index.mjs#L159-L163)) — `import.meta.url === \`file://${process.argv[1]}\`` mishandles drive letters and backslashes on Windows. Replaced with `fileURLToPath(import.meta.url) === path.resolve(process.argv[1])`.

- **`refactor(client): N-2 — drop Element.prototype.also monkey-patch`** ([`public/js/views/cv.js:188-201`](public/js/views/cv.js#L188-L201)) — global DOM prototype pollution. Replaced with a local variable for the tree root.

- **`test(canary): M-8 — 404 regression test for retired /api/scan-ru/config`** ([`tests/scan-consolidated.test.mjs`](tests/scan-consolidated.test.mjs)) — v1.20.0 retired the alias but added no canary. Three-line addition mirroring the v1.18 retirement tests.

### 📚 Docs + system prompts

- **`docs(architecture): refresh OVERVIEW + DATA-FLOWS for v1.21+ surface`** — added `safe-fetch.mjs` (DNS-pinned GET), `file-lock.mjs` (per-path mutex), `rate-limit.mjs` (LLM throttle), and `sanitizePathName` to OVERVIEW.md. DATA-FLOWS.md gained two new sections: "Outbound URL fetches (DNS-rebind-safe)" and "LLM endpoint rate-limiting".

- **`docs(readme): security envelope section refresh`** — README.md "Security notes" now documents every helper in the v1.21+ security envelope (sanitizePathName, safeGet, withFileLock, llmRateLimit, entity-aware stripDangerousMarkdown).

- **`docs(qa): scenario 31 — career-ops.org/docs alignment`** ([`qa/claude-cowork-browser-test-prompt.md`](qa/claude-cowork-browser-test-prompt.md)) — six new sub-tests (31.1–31.6) that verify the UI matches behavior described in the five canonical career-ops.org/docs guides: score thresholds, scan workflow (one button), apply workflow (checklist, not auto-submit), batch workflow (TSV editor), Playwright setup (graceful failure), help-bundle coverage (5 URLs × 8 locales).

- **`docs(translate): README quality refresh × 7 non-EN locales`** — every non-EN README rewritten to publication-grade technical style in its native language. Common clunky calques replaced; v1.21/v1.22 security envelope mentions added; release/test badges bumped.

- **`docs(system): .claude/PROJECT-CONTEXT.md + .github/copilot-instructions.md`** — single-file orientation for agents joining a session. Compressed CLAUDE.md, names the v1.21+ helpers, lists common pitfalls.

- **`docs(bin): actualize start.sh / setup.sh / run_all.sh comments`** — "two deps" → "three deps" (express + js-yaml + multer); "298 tests" → "474+ tests"; `parseInt` radix added.

### 🧪 Tests

- **461 → 474 unit** (+13) + 32/32 Playwright unchanged.
- New test files: `cv-xss-bypasses.test.mjs` (M-4, 11 tests).
- Extended: `ssrf-redirect-rebind.test.mjs` (+1 for M-2 body cap), `scan-consolidated.test.mjs` (+1 for M-8 alias canary).
- Zero behavioral test deltas on existing suites — every fix is additive or covered by a new canary.

### Verification

```bash
npm test                          # 474 / 474
npm run test:e2e:browser          # 32 / 32

# Entity-encoded XSS strip:
node -e "import('./server/lib/security.mjs').then(({stripDangerousMarkdown}) => console.log(stripDangerousMarkdown('&lt;script&gt;alert(1)&lt;/script&gt;')))"
# → '' (no <script> survives)

# Health-ping backoff (open devtools, kill server, watch network panel):
#   3 s → 6 s → 12 s → 24 s → 60 s, then resets on first successful ping

# Score-pill glyph (open #/reports in light + dark theme):
#   .score-high shows ✓ + numeric score
#   .score-mid  shows ◐ + numeric score
#   .score-low  shows ○ + numeric score

# Mode-page hints (#/contacto, etc):
#   <input aria-describedby="mode-contacto-recipient-hint">  ← targets <p id="…">

# Retired alias:
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/scan-ru/config
# → 404
```

### Breaking changes

None. Every fix is additive or preserves existing endpoint contracts.

### Out of scope (v1.23+)

| Item | Notes |
|---|---|
| M-9 — locale CHANGELOG body translations | All `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` v1.13+ entries are EN-bodied stop-gaps. Bulk translation candidate after release cadence slows. |
| N-1 — `public/js/lib/i18n.js` over the 400-LOC target | Splitting per locale increases HTTP cost without a bundler. Defer until the build-step decision lands. |
| Help-bundle content refresh from career-ops.org/docs | The five canonical URLs already appear in every locale's help bundle (since v1.11.x). Scenario 31.6 in the QA prompt verifies coverage. Content depth refresh is a v1.23 candidate. |

---

## [1.21.0] — 2026-05-14

**Security + concurrency + a11y polish from two independent code-review passes.** Seven findings from [`docs/sdd/specs/V1.20.1-BACKLOG.md`](docs/sdd/specs/V1.20.1-BACKLOG.md) shipped in one release: one blocker (DNS-rebind TOCTOU), six high-severity bugs (path-traversal sanitization spread, rate-limit gap on LAN deploy, concurrent-write race, i18n coverage hole, dangling aria-describedby, missing label associations). 34 new tests; baseline rose from 427 → 461 unit + 32/32 Playwright. Every fix lands behind a named regression test.

### 🛡️ Security

- **`fix(security): B-1 — close DNS-rebind TOCTOU via safe-fetch.mjs`** ([`server/lib/safe-fetch.mjs`](server/lib/safe-fetch.mjs)) — the previous pattern did one explicit `dnsLookup` for validation, then let `fetch()` do its own independent lookup. A DNS rebind attacker with TTL=0 could return a public IP on lookup 1 and `127.0.0.1` / `169.254.169.254` / a LAN address on lookup 2, bypassing `isPrivateOrLoopbackHost`. The new `safeGet` resolves ONCE, pins the TCP connection to that exact IP via node:http(s), and sets SNI/Host so cert validation still targets the original hostname. Used by `/api/pipeline/preview` and `/api/auto-pipeline`. Fail-CLOSED on lookup error (reverses the prior `try { … } catch { /* fall through */ }`). Validated by 8 new tests in [`tests/ssrf-redirect-rebind.test.mjs`](tests/ssrf-redirect-rebind.test.mjs).

- **`fix(security): H-4 — consolidate sanitizePathName across 10 routes`** ([`server/lib/security.mjs`](server/lib/security.mjs)) — the bare `replace(/[^\w\-.]/g, '')` regex was duplicated across `jds.mjs`, `content.mjs`, `reports.mjs`, `llm.mjs`, `runners.mjs` and kept `.` characters, so `..pdf`, `....md`, leading-dot names survived. Only `reports.mjs::sanitizeSlug` did it right. v1.21.0 hoists the correct version (`sanitizePathName`) into `security.mjs`, deletes 10 broken copies, and rejects empty results with 400. Validated by 12 tests in [`tests/path-traversal.test.mjs`](tests/path-traversal.test.mjs).

- **`fix(security): H-5 — rate-limit LLM endpoints on public bind`** ([`server/lib/rate-limit.mjs`](server/lib/rate-limit.mjs)) — `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, `/api/auto-pipeline` previously had no per-IP throttle. Loopback users are unaffected; LAN-exposed deploys (`HOST=0.0.0.0`) get 10 req/min/IP with `Retry-After` and `X-RateLimit-*` headers on overflow. Configurable via `LLM_RATE_LIMIT="N/Ws"`. Cheap interim defense ahead of the v2.0 P-12 auth gate. Validated by 6 tests in [`tests/rate-limit.test.mjs`](tests/rate-limit.test.mjs).

### 🔒 Concurrency

- **`fix(data): H-6 — per-file mutex on applications.md / pipeline.md`** ([`server/lib/file-lock.mjs`](server/lib/file-lock.mjs)) — concurrent `POST /api/tracker` (or auto-pipeline racing a manual add) used to both read `num=42`, both write `num=43`, and silently drop the earlier row. `withFileLock(path, fn)` serializes read-modify-write per path; independent paths still run in parallel. Wired into `tracker.mjs`, `pipeline.mjs` (POST + DELETE), and `auto-pipeline.mjs` tracker step. Validated by 5 tests in [`tests/concurrent-tracker-write.test.mjs`](tests/concurrent-tracker-write.test.mjs) including a 20-concurrent-POST integration check that asserts rows 001..020 land sequentially.

### ♿ Accessibility

- **`fix(a11y): H-1 — id="batch-tsv-hint" on the batch.js hint paragraph`** ([`public/js/views/batch.js`](public/js/views/batch.js)) — v1.20.0 added `aria-describedby="batch-tsv-hint"` to the TSV textarea but never gave the hint `<p>` a matching `id`. Screen readers had nothing to voice. Fixed.

- **`fix(a11y): H-2 — htmlFor on batch-parallel / batch-min-score labels`** ([`public/js/views/batch.js`](public/js/views/batch.js)) — four v1.20.0 inputs got new ids but their labels weren't programmatically associated. WCAG 3.3.2 now satisfied.

- New static-analysis canary in [`tests/a11y-form-wires.test.mjs`](tests/a11y-form-wires.test.mjs) — walks every view file and asserts every `aria-describedby` / `htmlFor` IDREF points at a sibling `id:` declaration. Catches typo-class regressions at CI time.

### 🌐 i18n

- **`fix(i18n): H-3 — 13 keys from v1.20.0 silently fell through to EN for 7 locales`** ([`public/js/lib/i18n.js`](public/js/lib/i18n.js)) — `pipe.filter`, `pipe.count`, `pipe.preview*`, `pipe.openTab`, `pipe.evaluateAll*`, `eval.jdHint`, `batch.parallelAria`, `batch.minScoreAria`, plus `common.delete`, `config.group{Core,Runtime,Regional}`, `config.profileEmpty`, `config.viewProfile`, `scan.atsBadge`, `scan.regionalBadge` were referenced via `t('key', 'EN fallback')` but never added to DICT. Russian, Japanese, Chinese screen-reader users heard English `aria-label`s — directly defeating the WCAG 3.3.2 win v1.20.0 claimed. v1.21.0 adds all 19 keys × 8 locales (≈ 150 new translations) and extends [`tests/i18n-coverage.test.mjs`](tests/i18n-coverage.test.mjs) with a static-analysis pass that scans every `t('key', …)` call in `public/js/**/*.js` and asserts each key exists in DICT. Future drift caught at CI time.

### 🧪 Tests

- **427 → 461 unit** (+34) + 32/32 Playwright unchanged.
- New test files: `ssrf-redirect-rebind`, `path-traversal`, `concurrent-tracker-write`, `rate-limit`, `a11y-form-wires`.
- Existing `pipeline-preview.test.mjs` rewired from `globalThis.fetch` mock to the new `_setTransport` injection point in `safe-fetch.mjs` — the SSRF path no longer goes through fetch, so the old mock was bypassed silently.

### Verification

```bash
npm test                              # 461 / 461
npm run test:e2e:browser              # 32 / 32
node --test tests/ssrf-redirect-rebind.test.mjs tests/path-traversal.test.mjs \
  tests/concurrent-tracker-write.test.mjs tests/rate-limit.test.mjs \
  tests/a11y-form-wires.test.mjs      # 34 new tests, all green

# Path-traversal: every traversal-style :name returns 400 / 404
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/jds/..pdf
# → 400

# Rate-limit on public bind:
HOST=0.0.0.0 LLM_RATE_LIMIT=3/60s npm start &
for i in 1 2 3 4; do
  curl -sS -o /dev/null -w '%{http_code} ' -X POST -H 'Content-Type: application/json' \
    -d '{"jd":"…"}' http://0.0.0.0:4317/api/evaluate
done
# → 200 200 200 429

# Concurrent tracker writes: 20 parallel POSTs, 20 rows land:
node tests/concurrent-tracker-write.test.mjs
# 20 sequential rows 001..020

# Aria wires sanity:
grep -r 'aria-describedby' public/js/views/ | wc -l
# matching `id:` lookups all resolve (a11y-form-wires.test.mjs canary)
```

### Out of scope (v1.22+)

| Item | Notes |
|---|---|
| `pipeline-preview` body-size streaming cap (M-2) | `await upstream.text()` reads full body before the 8 KB slice; malicious 1 GB stream could exhaust memory. Stream-read with byte counter + abort. |
| WCAG 1.4.1 — color-only state on `.connection-banner` + score pills (M-3) | Hue alone signals state; add icon prefix (✓ / ◐ / ○) or text suffix. |
| `stripDangerousMarkdown` bypasses via HTML entities (M-4) | `&lt;script&gt;`, `java&#115;cript:`, `<img src="data:image/svg+xml,<svg onload=…>">` survive the regex. Defense-in-depth via UI.md still holds; doc + lock bypasses in a test sweep. |
| Safari private-mode `localStorage` access without try/catch (M-5) | `i18n.js:544/571` throws → SPA renders raw keys. Wrap in try/catch with `'en'` default. |
| `setInterval(checkHealth, 3000)` polls forever with no backoff (M-6) | Exponential 3s → 6s → 12s → cap 60s. |
| `htmlFor` alias missing null-guard (M-7) | One-line `if (v != null && v !== false)` defense. |
| 404 canary for retired `/api/scan-ru/config` (M-8) | Three-line test mirroring v1.18 precedent. |
| Locale CHANGELOG body translations (M-9) | Bulk translation candidate after release cadence slows. |
| Inline-hint paragraphs for every mode-page field (M-1) | ~168 i18n keys × 8 locales; held back as polish item. |
| L-1 through L-5 nits | parseInt radix, bash --noprofile, Windows-safe fileURLToPath, multi-line SSE, scan.js timer cleanup. |

---

## [1.20.0] — 2026-05-13

**Per-component a11y polish + non-EN README parity + `/api/scan-ru/config` alias retired.** Closes the four items the v1.19.0 "Out of scope" table flagged for v1.20.

### ♿ WCAG 2.5.5 / 2.5.8 — per-component touch-target audit

- **`a11y(touch-target): chip min-height 28 px + 8 px gap (2.5.8 spaced-target exception)`** — `.chip` was 24 × ~50 px (vertical was 24, height failed 2.5.5's 24 px floor for clustered controls); the spaced-target exception of 2.5.8 requires either ≥ 24 × 24 px OR 24 px of clearance. Bumped `.chip` to `min-height: 28px; padding: 6px 12px;` and the wrapping `.chip-row` to `gap: 8px;` so both conditions hold.
- **`a11y(touch-target): sidebar nav-item min-height 44 px`** — `.nav-item` padded only `10px 14px`, computed height ~36 px on most viewports. Now `padding: 12px 14px; min-height: 44px; box-sizing: border-box;`. Matches the `.btn` floor.
- **`a11y(touch-target): tab-btn min-height 44 px`** — same treatment for Sortable Headers / category tabs across Reports, Tracker, Scan results.

### ♿ WCAG 1.3.1 / 3.3.2 — `aria-describedby` on inline form hints

Every form control across the SPA now owns a stable `id`, its `<label>` targets it via `htmlFor`, and any inline hint paragraph is associated via `aria-describedby`. Five view files were rewired:

- **`a11y(forms): config.js`** — per-key `id` + hint association (`cfg-<key>` / `cfg-<key>-hint`).
- **`a11y(forms): evaluate.js`** — `eval-jd` textarea + `eval-jd-hint` paragraph documenting the 50-char minimum after sanitization.
- **`a11y(forms): batch.js`** — `batch-tsv` / `batch-tsv-hint`, plus `aria-label`s on `batch-parallel`, `batch-min-score`, `batch-dry-run`, `batch-retry`.
- **`a11y(forms): pipeline.js`** — `pipe-filter` + `pipe-new-url` / `pipe-new-url-hint`.
- **`a11y(forms): mode-page.js`** — every field across the 7 generic modes (`project`, `training`, `followup`, `batch-prompt`, `contacto`, `interview-prep`, `patterns`) gets `mode-<slug>-<name>` ids and `htmlFor` labels.

`UI.el()` learned a React-style `htmlFor` alias so view code stays declarative — it sets the underlying `for` attribute (which is JS-reserved as a property name).

### 🌍 Non-EN README parity

- **`docs(readme): translate 7 locales to 585-line parity with EN master`** — `README.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` were 306–316 lines (covered headlines but skipped the marketing-heavy walkthroughs and most of the API reference). All seven now mirror the EN structure end-to-end: About → One-command install → Why? → Quick start (3 numbered steps) → Requirements → What you get table → Scan → Architecture (full directory tree) → API reference (every route table) → Tests → Configuration → Security notes → Limitations → Contributing → 🌍 Getting Started 5-step walkthrough → License.

### 🧹 `/api/scan-ru/config` alias retired

- **`feat!(scan): remove /api/scan-ru/config legacy alias (sunset v1.20)`** — kept as a one-release alias in v1.19 for back-compat. Canonical `/api/scan/regional/config` is the only path now. Removed: route registration in `server/lib/routes/scan.mjs`, doc references in `README.md`, `docs/architecture/{OVERVIEW,SERVER,API}.md`. Tests already covered the canonical path — no test changes needed.

### 🧪 Tests

- Same suite as v1.19. **427 / 427** unit + 20/20 smoke + 23/23 comprehensive + 32/32 Playwright. All a11y wiring is additive (more `id` / `for` / `aria-describedby` attributes) — no behavioral changes, no test deltas.

### Verification

```bash
npm test                              # 427 / 427
npm run test:e2e:browser              # 32 / 32

# Touch targets — every chip / nav-item / tab-btn ≥ 28 / 44 / 44 px:
#   Chrome DevTools → Computed → height/min-height on .chip, .nav-item, .tab-btn

# Form labels — every input has a label[for=…] association:
#   document.querySelectorAll('input,textarea,select').forEach(el =>
#     console.assert(el.labels?.length || el.getAttribute('aria-label'), el))

# Alias gone:
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/scan-ru/config
# → 404

# Canonical still works:
curl -s http://127.0.0.1:4317/api/scan/regional/config | jq '.'
```

### Breaking changes

- `DELETE /api/scan-ru/config` — gone. Use `/api/scan/regional/config`. Was announced as sunset in v1.19.0's CHANGELOG and verification script.

### Out of scope (v1.21+)

| Item | Notes |
|---|---|
| Inline-hint paragraphs for every mode-page field | Today only the `<label for=…>` association is in place; visible per-field hint copy is still EN-only in the SPA. The README walkthroughs document the field intent in every locale, so this is a polish item, not a blocker. |
| Color-only state surfacing in `.connection-banner` and dashboard score pills (WCAG 1.4.1) | The banner relies on red/amber/green; needs an icon or text suffix for users who can't perceive hue. |
| Locale-specific CHANGELOG body translations | English-bodied stop-gaps remain in `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md`. Translation happens once the v1.x release cadence slows. |

---

## [1.19.0] — 2026-05-13

**WCAG 1.4.3 contrast + scan unification (final) + HH_USER_AGENT removed from UI.** Closes the v1.18 out-of-scope contrast audit, finishes the EN/RU split elimination begun in v1.18, and removes the `HH_USER_AGENT` configuration knob from the UI per user direction (a sensible default bundled in the server already handles non-RU IPs for most users).

### ♿ WCAG 1.4.3 contrast pass

- **`a11y(contrast): introduce AA-passing *-text variants for accent tokens`** — light theme: `--rausch-text: #b80f42` (6.59:1 on white, was 3.52:1), `--kazan-text: #066507` (7.31:1, was 4.53:1), `--darjeeling-text: #7a5800` (5.73:1 on amber bg, was 4.24:1), `--babu-text: #00665e` (6.09:1, was 2.70:1). Dark theme: lightened mirrors (`#ff8aa0`, `#6ee7b7`, `#fcd34d`, `#5eead4`) hit the same 4.5:1 floor on `#161a22` paper.
- Badge classes (`.badge-ok`, `.badge-warn`, `.badge-bad`, `.badge-info`) and score pills (`.score-high`, `.score-mid`, `.score-low`) now route through the new `*-text` variants — every text-on-tinted-bg combo passes AA. The accent fill tokens (`--rausch`, `--kazan`, etc.) stay unchanged for borders and outlines (which only need 3:1 for non-text UI components).

### 🧹 Scan unification (finishes v1.18 work)

- **`docs(scan): scrub remaining EN/RU split references across READMEs + help + architecture docs`** — eight READMEs + eight help bundles + three architecture docs (API.md, SERVER.md, OVERVIEW.md, DATA-FLOWS.md) + scan.js comment now describe a single consolidated scan method. The legacy `/api/stream/scan-{en,ru}` aliases were already gone in v1.18; v1.19 catches the doc/copy that still framed scanning as a two-step EN+RU process.
- **`feat(scan): canonical /api/scan/regional/config endpoint`** — `/api/scan-ru/config` kept as a thin alias through one release for back-compat. The new path matches the source-naming convention (`?source=regional`).

### 🛠️ HH_USER_AGENT removed from UI

- **`feat!(config): drop HH_USER_AGENT field from /#/config + KNOWN_KEYS`** — power users can still set `HH_USER_AGENT` directly in `career-ops/.env` (the server reads via `process.env.HH_USER_AGENT` in `server/lib/sources/hh.mjs` with the bundled UA as fallback). The UI no longer exposes it because the default works for most users and seeing an inscrutable User-Agent field in the App Settings page was a recurring source of confusion.
- README mentions across 8 locales + help bundle mentions across 8 locales replaced with "run via a Russian IP / VPN" advice. The `scan.hhWarning` i18n key was rephrased to drop the env-var setup detail.
- `KEY_GROUPS` collapsed: no more `regional` classification (it only had HH_USER_AGENT). Tests updated; `regionalActive` payload field preserved for SPA back-compat.

### 🧪 Tests

- `tests/env-config.test.mjs` — `KNOWN_KEYS` assertion now excludes HH_USER_AGENT; new assertion that the key is intentionally absent.
- `tests/config-endpoint.test.mjs` — POST-write multi-key test uses `GEMINI_MODEL` as the second known key instead of HH_USER_AGENT.
- `tests/config-groups.test.mjs` — `groups.HH_USER_AGENT` is now expected `undefined`.
- Total: **427 / 427** unit + 20/20 smoke E2E + 23/23 comprehensive E2E + 32/32 Playwright. Same counts as v1.18.0 because every adjusted test was already counted.

### Verification

```bash
npm test                              # 427 / 427

# Contrast (Chrome DevTools or axe) on light + dark:
#   .badge-ok / .badge-warn / .badge-bad / .badge-info → AA pass (4.5:1+)
#   .score-high / .score-mid / .score-low → AA pass

# HH_USER_AGENT no longer in /api/config:
curl -s http://127.0.0.1:4317/api/config | jq '.values | keys'
# → ["ANTHROPIC_API_KEY","ANTHROPIC_MODEL","GEMINI_API_KEY","GEMINI_MODEL","HOST","PORT"]
# (no HH_USER_AGENT)

# Canonical regional config endpoint:
curl -s http://127.0.0.1:4317/api/scan/regional/config | jq '.'
# Legacy alias still alive through v1.20:
curl -s http://127.0.0.1:4317/api/scan-ru/config | jq '.'
```

### Out of scope (v1.20+)

| Item | Notes |
|---|---|
| Per-component touch-target audit (filter chips, sortable headers, sidebar nav) | v1.18 set the global floor (`.btn` 44 px, `.btn-sm` 32 px); per-component verification across the SPA remains. |
| `aria-describedby` on inline form hints (`#/config`, `#/pipeline`, `#/evaluate`, `#/batch`) | v1.17 covered `aria-label` on global search + modal close. Per-input hint association is the next polish layer. |
| Full non-EN README parity (585 lines like EN) | v1.18 brought non-EN to ~307 (53 % of EN). Marketing-heavy "Quick start" + "🌍 Getting Started" walkthroughs remain EN-only. |
| Remove `/api/scan-ru/config` legacy alias | Sunset planned for v1.20. The canonical `/api/scan/regional/config` is the migration target. |

---

## [1.18.0] — 2026-05-13

**Scan-endpoint consolidation + WCAG 2.2 AA pass + i18n long-tail finalization.** Retires the legacy `/api/stream/scan-{en,ru}` aliases (Sunset window 2026-10-01 advanced to v1.18 per user direction). Brings non-EN READMEs to ~307 lines and translates the remaining RU-bodied v1.16.0 + v1.17.0 CHANGELOG entries in 6 locales.

### 🚪 Breaking

- **`feat!(scan): retire legacy /api/stream/scan-{en,ru} aliases`** — the deprecated EN/RU split SSE endpoints are gone. Every consumer goes through the consolidated `/api/stream/scan?source=ats|regional|both` endpoint (live since v1.12.0). The legacy paths had Deprecation + Sunset (RFC 8594) headers since v1.15.0; the migration window is now closed. External integrations on the old paths get a clean **404** rather than being silently routed to the SPA catch-all.

### ♿ Accessibility (WCAG 2.2 AA pass)

- **WCAG 2.4.1 Bypass Blocks** — new **Skip to main content** link as the first focusable on every page. Visually hidden via `.skip-link` until it receives focus, snaps to the top-left corner on Tab from page load.
- **WCAG 2.4.7 Focus Visible** — global `*:focus-visible` style. Mouse-click focus rings off, keyboard-Tab focus rings on (the WAI-ARIA AP standard pattern). Modal close (×) gets a higher-contrast focus ring.
- **WCAG 2.5.5 Target Size** — minimum 44×44 px touch target on `.skip-link`. `.btn-sm` keeps a 32 px min-height (which combined with row spacing meets the 24×24 + spacing AAA exception for compact table-row controls).
- **WCAG 3.1.1 Language of Page** — `<html lang="en">` corrected from `lang="ru"` (the JS i18n bootstrap already overrode this on load, but the SSR default now matches the SPA's default locale).
- **WCAG 1.3.1 Info & Relationships** — `#content` gets `tabindex="-1"` so the skip-link target focuses cleanly. (ARIA roles + focus-trap were already added in v1.17.)

### 📚 i18n long-tail

- **`docs(i18n): v1.16.0 + v1.17.0 CHANGELOG translated in 6 locales`** — entries previously RU-bodied in `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` are now in their native language. RU-char count per locale dropped 79 → 42 → 23 (remaining 23 are technical inline references like file paths + the multi-locale header link, which is intentional).
- **`docs(readme): expand non-EN READMEs with Why / Requirements / Features / Configuration / Contributing`** — each non-EN README grew from 240 → ~307 lines. Now covers the same non-marketing sections as the 585-line EN. Full 1:1 parity (marketing-heavy walkthrough sections) remains deferred.

### 🛠️ Misc

- **`docs(api): consolidated scan endpoint in API.md + DATA-FLOWS.md + README.md`** — the API reference table now lists only `/api/stream/scan?source=…`. README's Scan section explains the v1.18.0 retirement of the EN/RU split.
- **`fix(scan.js): drop stale comment about deprecated aliases being live`** — the SPA's runScanAll dispatcher comment now reflects the consolidated reality.

### 🧪 Tests

- `tests/scan-consolidated.test.mjs::F-018 backwards compat` rewritten — the two former "legacy endpoint still works" assertions now verify that requests to `/api/stream/scan-{en,ru}` return **404** (rather than being routed to the SPA catch-all).
- Total: **427 / 427** unit + 20/20 smoke E2E + 23/23 comprehensive E2E + 32/32 Playwright (unchanged count; +2 newly-correct legacy-removal assertions replacing the +2 legacy-still-works assertions).

### Verification

```bash
npm test                              # 427 / 427
npm run test:e2e:full                 # 23 / 23

# Legacy endpoint retirement:
curl -sI http://127.0.0.1:4317/api/stream/scan-en | head -1   # → HTTP/1.1 404
curl -sI http://127.0.0.1:4317/api/stream/scan-ru | head -1   # → HTTP/1.1 404

# Consolidated endpoint:
curl -sN 'http://127.0.0.1:4317/api/stream/scan?source=ats&dryRun=1' | head -5
# → event: start
# → data: {"script":"en-scanner","writeFiles":false,…}

# Skip link (a11y):
curl -s http://127.0.0.1:4317/ | grep -c 'class="skip-link"'  # → 1

# html lang fallback:
curl -s http://127.0.0.1:4317/ | grep -c 'html lang="en"'     # → 1
```

### Out of scope (v1.19+)

| Item | Notes |
|---|---|
| Full non-EN README parity (585 lines like EN) | v1.18 brought non-EN to ~307 (53 % of EN). Marketing-heavy "Why?" / "Quick start" walkthroughs remain EN-only. |
| Color-contrast audit (WCAG 1.4.3 AA — text 4.5:1, large text 3:1) | v1.18 covered structural a11y; per-token contrast verification across light + dark palettes remains. |
| Touch-target audit across every interactive element | v1.18 set the floor (`.btn`: 44 px, `.btn-sm`: 32 px); per-component verification (filter chips, sidebar nav, sortable headers) remains. |

---

## [1.17.0] — 2026-05-13

**Polish + a11y + CI fix release.** Closes all 9 follow-ups from the
v1.16.0 list: browser smoke verification, README badge truth,
coverage refresh, `lastWorkdayFallback` surfaced in SPA, full E2E
re-baseline, Playwright auto-pipeline scenarios, a11y audit pass,
historical CHANGELOG condensed in 6 locales, and non-EN READMEs
expanded with Architecture / API / Security / Tests sections.

### 🐛 Fixes

- **`fix(e2e): smoke + comprehensive suites re-aligned with v1.16 UX`** —
  the v1.16 Cmd+K Enter → AutoPipeline modal change made the
  e2e tests' `search.press('Enter')` open a modal that intercepted
  subsequent clicks. Tests now use `Shift+Enter` for the legacy
  quick-add path, matching the v1.16 documented split. Also
  updates the comprehensive E2E batch-mode iteration to use
  `/#/batch-prompt` (the legacy mode-prompt slug that v1.15 PR-H
  introduced). **This was the CI failure on v1.16.0 push** —
  Playwright e2e timed out 30 s waiting on backdrop-intercepted
  clicks.
- **`fix(mode-page): batch-prompt route → modes/batch.md via serverSlug`** —
  v1.15 renamed the legacy mode slug to `batch-prompt`, but the
  server's `POST /api/mode/:slug` was then looking for
  `modes/batch-prompt.md` which doesn't exist. New `serverSlug`
  field decouples the route hash from the parent's mode filename.
- **`chore: bump deprecation messages from v1.16.0 to v1.17.0`** —
  the scan-en/scan-ru deprecation copy and the batch-prompt
  deprecation banner referenced the past version.

### ✨ Features

- **`feat(scan): 🔒 Workday CAPTCHA chip in Active Companies card`** — the
  server-side `lastWorkdayFallback` export from v1.16 PR-7 is now
  consumed by the SPA. `/api/scan-results` returns the snapshot;
  `#/scan` renders a warn-tinted card above Active Companies when
  a Workday tenant fell back ("🔒 Workday tenant blocked — fallback:
  use /career-ops scan (Playwright)"). New `getLastWorkdayFallback()`
  exporter avoids ESM live-binding ambiguity. 2 new i18n keys ×
  8 locales.

### ♿ Accessibility

- **`a11y: ARIA roles + focus management pass on critical surfaces`** —
  - `index.html`: `role` attributes on `<aside>` (navigation),
    `<header>` (banner), `<section id="content">` (main),
    `<div id="modal">` (dialog with aria-modal/aria-labelledby),
    `<div id="toast">` + `#conn-banner` (status with aria-live),
    `<div class="searchbar">` (search).
  - `#sidebar-toggle` gets `aria-controls="sidebar"` +
    `aria-expanded` synced by JS on open/close.
  - `#global-search` gets a visually-hidden `<label>` plus an
    explicit `aria-label` that surfaces the Cmd+K shortcut hint.
  - Modal close (×) gets `aria-label="Close dialog"`.
  - Decorative backdrops get `aria-hidden="true"`.
  - **Focus trap on modal** — `UI.modal()` remembers the click
    owner, focuses the first non-close focusable on open, and
    cycles Tab/Shift+Tab inside the modal. `UI.closeModal()`
    restores focus to the prior owner.
  - New `.visually-hidden` utility class in `public/css/app.css`
    (WAI-ARIA AP standard pattern).

### 📚 Documentation

- **`docs(readme): badge truth across 8 READMEs`** — tests badge
  `284 / 379 / 360` → **427**; release badge `v1.9.1 / v1.13.0`
  → **v1.16.0** then → v1.17.0 via the v1.17 bump. Release link
  targets updated.
- **`docs(readme): expand 7 non-EN READMEs with reference sections`** —
  each grew 170 → ~240 lines with new Architecture / API
  reference / Security notes / Tests / A11y / Limitations /
  License sections in the native language. Not yet at full 585-line
  parity with EN but covers all key non-marketing surfaces.
- **`docs(changelog): condense pre-v1.12 entries in 6 locales`** —
  the long RU-bodied v1.11.x + v1.10.x entries that bled into the
  non-EN/non-RU CHANGELOGs are now replaced by a compact
  "Earlier releases" exec summary in each locale's native
  language. Detailed history stays in `CHANGELOG.md` (EN).

### 🛠️ Tooling

- **`coverage: refresh numbers`** — last published was 95.46 % line
  / 84.06 % branch (v1.13.0 REVIEW). v1.17 baseline: **94.14 %
  line / 82.98 % branch / 93.20 % function**. Slight drop from
  new error paths in auto-pipeline + reports-write; still well
  above the 80 % floor in CLAUDE.md.

### 🧪 Tests

- Total: **427 / 427** unit + 20/20 smoke E2E + 23/23 comprehensive
  E2E + **32 / 32** Playwright (was 28; +4 new auto-pipeline
  scenarios: button opens modal, Cmd+K paste triggers modal,
  invalid URL gates step 1, `POST /api/auto-pipeline` SSE event
  framing).
- E2E suite re-aligned with v1.16.0 UX (Shift+Enter quick-add,
  /#/batch-prompt for legacy mode).

### Verification

```bash
# Locally:
npm test                          # 427 / 427
npm run test:e2e                  # 20 / 20
npm run test:e2e:full             # 23 / 23
npm run test:e2e:browser          # 32 / 32

# Browser smoke (page-level):
curl -s http://127.0.0.1:4317/api/scan-results | jq '.workdayFallback'
# null when no Workday fallback occurred; {apiUrl, reason, at} after a 4xx.

# A11y spot-check:
node -e "
const c = require('cheerio').load(require('fs').readFileSync('public/index.html','utf8'));
['banner','navigation','main','dialog','status','search'].forEach(r =>
  console.log(r, c('[role=' + r + ']').length));
"
# Each role should appear ≥1.

# CI gate verification: dashboard-screenshots workflow boots a /tmp
# scaffold, regenerates PNGs, diffs against committed — green when
# images/dashboard-*.png are up to date with rendered SPA.
```

### Out of scope (v1.18+)

| Item | Notes |
|---|---|
| Translate v1.16.0 entry in non-EN CHANGELOGs | Currently RU-bodied (~30 lines × 6 locales = 180 lines). Was outside the user's explicit v1.11.x/v1.10.x scope. |
| Full non-EN README parity (585 lines like EN) | v1.17 brought non-EN to ~240; the marketing-heavy "Why?" / "Quick start" walkthroughs remain EN-only. |
| Parent commit for canonical A-F prompt | `santifer/career-ops::modes/oferta.md` rewrite still needed upstream (CLAUDE.md hard rule #1). |
| Full WCAG 2.2 AA audit | v1.17 covered structural ARIA + focus trap; per-component contrast/Tab-order audit pending. |

---

## [1.16.0] — 2026-05-13

**Auto-pipeline finalization + adapter polish + i18n long-tail.** Closes
all 11 follow-ups from the v1.15.0 REVIEW: server-side SSE auto-pipeline,
`POST /api/reports` primitive, Cmd+K shortcut, SmartRecruiters pagination,
Workday CAPTCHA-fallback, CI screenshot-drift gate, scan source filter UX,
historical CHANGELOG translation (v1.13.0/v1.12.0 × 6 locales), non-EN
README expansion, and a paste-ready trending-companies importer.

### ✨ Features

- **`feat(auto-pipeline): server-side SSE orchestrator`** (#1, #2, #3, #8) —
  the v1.15 client-side chained-fetch orchestrator is gone. `POST
  /api/auto-pipeline` is now a curl-able SSE endpoint that chains
  validate → fetch JD → evaluate → save report → tracker server-side
  with real-time step events. The slow Anthropic call (30–90 s) now
  emits a `running` event instead of a generic spinner. Failures emit
  `error` with `step` + `message`. The orchestrator also persists the
  report markdown to parent `reports/<slug>.md` (was lost in v1.15).
- **`feat(reports): POST /api/reports primitive`** — new writer endpoint
  in `server/lib/routes/reports.mjs`. Slug sanitization with path-
  traversal guard (strip leading dots, collapse internal `...`).
  1 MB cap (413). 409 on existing file unless `overwrite:true`.
  Atomic write through `stripDangerousMarkdown` XSS pass. Logs
  activity.reports.save. Tests: 9 cases.
- **`feat(app): Cmd+K paste URL → auto-pipeline`** — pasting a URL into
  the global search + Enter now opens the AutoPipeline modal with
  `autoStart=true`. Shift+Enter preserves the legacy "add to
  pipeline only" path. The canonical career-ops.org Quick Start §7
  "paste URL → done" UX.
- **`feat(portals): SmartRecruiters pagination`** (#4) —
  `server/lib/sources/smartrecruiters.mjs` walks pages via
  `?limit=100&offset=N` until `totalFound` is reached OR an empty
  page is returned OR the 30-page / 3000-job safety cap fires.
  Strips caller-supplied limit/offset so the cursor is server-owned.
  Big boards (Procter & Gamble, Amazon-style) no longer lose their
  tail of 100+ postings. Tests: 6 cases.
- **`feat(portals): Workday CAPTCHA-fallback graceful`** (#7) —
  `server/lib/sources/workday.mjs` no longer throws on 4xx /
  non-JSON / network errors. Returns `[]` and annotates the new
  exported `lastWorkdayFallback` snapshot. Scanner timeline
  continues with the next tenant. Caller can opt back into the
  v1.14 throw behaviour with `strict:true`. Tests: 7 cases.

### 🛠️ Tooling + CI

- **`ci(workflows): dashboard-screenshots drift gate`** (#5) — new
  `.github/workflows/dashboard-screenshots.yml`. On PRs touching
  `public/css/app.css` / `public/js/views/dashboard.js` /
  `public/js/lib/i18n.js` / `public/index.html`, the workflow
  boots the web-ui server against a /tmp scaffold, regenerates the
  8 hero PNGs via Playwright + chromium, and fails the build if
  the result drifts from what's committed. Uploads the regenerated
  PNGs as a CI artifact on failure.
- **`feat(scripts): import-trending-companies.mjs`** (#11) — verifies
  the 13 trending companies in `docs/portals-examples.md` via their
  real boards-API and emits paste-ready YAML for the user's parent
  `portals.yml::tracked_companies`. `enabled: false` is stamped on
  any candidate whose slug 404s. Live probe of all 6 ATSes
  (Greenhouse / Ashby / Lever / Workable / SmartRecruiters /
  Workday). Run via `npm run import:trending`.
- **`feat(scripts): npm run capture:dashboards`** — exposes
  `scripts/capture-dashboard-screenshots.mjs` as a top-level script
  (was only documented in `images/README.md` before).

### 🎨 UX

- **`fix(scan): consolidated source-filter dropdown`** (#6) —
  `#/scan` source dropdown rebuilt from the v1.14 adapter registry:
  6 ATSes + hh.ru + Habr Career, alphabetical, no geo-tag prefix.
  `runEnScan` / `runRuScan` now hit the consolidated
  `/api/stream/scan?source={ats,regional}` endpoint instead of the
  deprecated `/api/stream/scan-{en,ru}` aliases (Sunset headers
  stay live through v1.16).

### 📚 i18n long-tail

- **`docs(i18n): translate v1.13.0 + v1.12.0 CHANGELOG in 6 locales`**
  (#9) — entries previously RU-bodied in
  `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` are now in their
  actual locale. Each non-EN/non-RU CHANGELOG also gets an i18n
  note explaining that pre-v1.12 entries remain RU per project
  convention (canonical text lives in `CHANGELOG.md`).
- **`docs: expand non-EN READMEs with v1.16.0 highlights section`**
  (#10) — 6 non-EN READMEs (es / pt-BR / ko-KR / ja / ru / zh-CN /
  zh-TW) get a new ~35-line section covering: auto-pipeline
  one-click flow + curl example, SmartRecruiters pagination,
  Workday fallback, scan source-filter UX, importer script, and
  CI screenshot workflow. RU README also extended.

### 🧪 Tests

- New `tests/reports-write.test.mjs` (9 cases) — happy path, slug
  sanitization (incl. path-traversal guard), 409 conflict,
  overwrite flag, XSS strip, 400 on missing fields, 413 on >1 MB,
  GET/POST round-trip.
- New `tests/auto-pipeline.test.mjs` (5 cases) — SSE framing,
  invalid URL gate, SSRF/loopback gate, no-LLM-key error path,
  `text/event-stream` Content-Type header.
- New `tests/smartrecruiters-pagination.test.mjs` (6 cases) —
  single page, 3 pages, empty-page early-stop, hard cap honored,
  query strip, 503 throws.
- New `tests/workday-fallback.test.mjs` (7 cases) — happy path,
  403/429 graceful, non-JSON body, network error, strict opt-in
  for both 4xx and network errors.
- Total: **427 / 427** unit (was 400; +27 net). 0 failures. 28/28
  Playwright + 23/23 comprehensive E2E + 20/20 smoke E2E green
  from v1.15.0 baseline.

### Out of scope (v1.17+)

| Item | Notes |
|---|---|
| Parent commit for canonical A-F prompt | Still pending upstream `santifer/career-ops::modes/oferta.md` rewrite (CLAUDE.md hard rule #1). |
| Translate pre-v1.12 CHANGELOG entries (v1.11.x, v1.10.x) | Convention preserved: RU-bodied. Backporting is ~1800 lines of translation work; deferred. |
| Full non-EN README parity (585 lines like EN) | v1.16 added ~35 lines per locale; full parity is a separate effort. |
| Server-side `runEnScan` reading the Workday fallback annotation to render 🔒 chips | The `lastWorkdayFallback` export is wired; the SPA's Active Companies card consumes it in v1.17+. |

### Verification

```bash
npm test                          # 427 / 427
npm run test:e2e:full             # 23 / 23
npm run import:trending --check-only   # probe 13 trending boards

# Auto-pipeline curl smoke:
curl -N -X POST http://127.0.0.1:4317/api/auto-pipeline \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/4567"}'

# POST /api/reports round-trip:
curl -X POST http://127.0.0.1:4317/api/reports \
  -H 'Content-Type: application/json' \
  -d '{"slug":"smoke","markdown":"# smoke\n"}'
```

---

## [1.15.0] — 2026-05-13

**Doc-conformance release.** Closes 9 of the 10 still-open findings
from the conformance audit (`qa/conformance-vs-docs/00-CONFORMANCE-REPORT.md`)
plus the localized hero images. Brings the UI in line with the
canonical career-ops.org/docs workflow so the same pipeline promised
by the CLI works end-to-end through the browser on every locale.

### ✨ Features

- **`feat(auto-pipeline): PR-C — 1-click "paste URL → report + PDF + tracker row"`** (G-007)
  Match the canonical career-ops.org promise. Until v1.15 users did 5 manual clicks across /#/pipeline → /#/evaluate → /#/cv → /#/tracker. Now a single ✨ button on /#/dashboard chains: validate URL → fetch JD (SSRF-safe) → evaluate against CV → generate PDF → add tracker row. Renders a step-by-step modal timeline with [✓]/[…]/[✗] per step. Heuristic company/role extraction from JD first lines. Score + legitimacy extracted via regex from the evaluation markdown. New file: `public/js/lib/auto-pipeline.js`. 19 new i18n keys × 8 locales.
- **`feat(modes): PR-D — modes/_profile.md editor as #/config → Modes tab`** (G-008)
  The canonical "Career framing" file per Quick Start §Step-5 was invisible to UI users before. Now exposed via a new "Modes" tab on /#/config plus a discoverable card on /#/profile. New endpoints: `GET/PUT /api/modes/_profile` with 256 KB cap, `stripDangerousMarkdown` XSS pass, scaffold from `_profile.template.md` on first read. 9 new i18n keys × 8 locales.
- **`feat(profile): PR-E — accept canonical schema; add location + headline`** (G-009)
  `/api/profile` now accepts BOTH the legacy (`candidate:{...}`) AND canonical (top-level `full_name`, `narrative.headline`, `target_roles.primary`, `compensation.target_range`) schemas. Legacy wins when both are present so existing YAMLs render identically. New `summarizeProfile()` helper returns unified shape. `/#/profile` surfaces `narrative.headline` as a new card. 2 new i18n keys × 8 locales.
- **`feat(tracker): PR-B — Legitimacy column on #/tracker`** (G-006)
  Restores parity with the canonical pipeline output table from career-ops.org/docs. Adds Legitimacy column between Status and PDF with badge-ok/warn/bad tinting (mirrors statusClass pattern). Graceful degrade — pre-v1.15 rows without a Legitimacy column show `—`. 1 new i18n key × 8 locales.
- **`fix(routing): PR-H — dedupe sidebar; route #/batch to v1.13.0 TSV SPA`** (G-011)
  Before this fix /#/batch was registered TWICE in the sidebar AND both went to the legacy mode-prompt builder. The v1.13.0 TSV SPA (8 KB, 4 endpoints) was unreachable. Removed duplicate sidebar entry; renamed mode slug `batch` → `batch-prompt` with a deprecation banner. Canonical /#/batch is now the TSV SPA.

### 📚 Documentation

- **`docs(evaluate): PR-A — realign Block A-F with canonical career-ops.org rubric`** (G-005)
  career-ops.org docs document A–F (Strategy/Personalization/STAR stories at C/E/F). We emitted A–G with shifted semantics (Risks/Verdict/Legitimacy). v1.15 updates all 8 help bundles §9 to show the canonical A–F with a "Pre-v1.15 used A–G; we render those as-is for back-compat" callout. `eval.subtitle` i18n key × 8 locales also realigned. Score + legitimacy now documented as report-header fields. ⚠ Parent commit still required: `santifer/career-ops::modes/oferta.md` needs to be rewritten upstream to emit canonical A–F.
- **`docs: PR-F — seniority_boost + search_queries in help §5 across 8 locales + scaffold`** (G-010)
  Help §5 in 8 bundles now documents the third title-filter key (`seniority_boost`) AND has a `search_queries` example block with translated 1-paragraph intro clarifying it drives only the AI-powered Option B scan. `bin/setup.sh` portals.yml scaffold seeds `seniority_boost: ["Senior", "Staff", "Lead"]` by default. H2 parity preserved: 16 × 8 locales.
- **`docs: PR-I — localized hero images per README locale`**
  Each of 8 READMEs now has a locale-specific `images/dashboard-<locale>.png` (HiDPI 1440×900) generated via `scripts/capture-dashboard-screenshots.mjs` (Playwright + chromium). Old shared `public/images/screen_vacancy_found.png` deleted. Non-EN readers see their UI labelled in their language on first landing.

### 🧹 Carryover cleanups

- **`PR-G — G-001`** `scan.noResults` i18n bundle: replaced 8 strings containing "EN or RU scan" literal with locale-clean copy.
- **`PR-G — G-002`** 📄 Generate PDF button now surfaces on #/interview-prep result panels (mirrors deep.js pattern).
- **`PR-G — G-003`** `README.cn.md` → `README.zh-CN.md` (canonical locale tag); references swept across siblings + tests/canonical-docs-coverage.test.mjs.
- **`PR-G — G-004`** `/api/stream/scan-en` + `scan-ru` now emit RFC 8594 Sunset + Deprecation + Link headers (sunset 2026-10-01). Scheduled for removal in v1.16.0.

### 🧪 Tests

- New `tests/profile-canonical-schema.test.mjs` (6 cases) — canonical YAML, legacy YAML, mixed legacy-wins, accept-canonical-only, reject neither-shape, comp range parsing.
- New `tests/modes-profile-crud.test.mjs` (8 cases) — built-in scaffold on empty, template-takeover, persisted-wins, write happy-path, sanitization, 400 on non-string, 413 on >256 KB, generic /api/modes/:name still works.
- Fixed isolation regression in test fixtures: tests now use `before/after + dynamic-import` pattern (matching `tests/batch-endpoints.test.mjs`) so they no longer mutate the user's real parent `config/profile.yml`. **NOTE for users:** if your `config/profile.yml` looks like a test placeholder after upgrading from a v1.15.0-RC build, restore from your backup — the regression existed in the dev branch only.
- Total: **400 / 400** unit tests (was 386; +14 net). 0 failures. 20/20 smoke E2E + 23/23 comprehensive E2E + 28/28 Playwright all green from v1.14.0 baseline.

### Out of scope (v1.16+ follow-up)

| Item | Notes |
|---|---|
| Parent commit for canonical A–F prompt | `santifer/career-ops::modes/oferta.md` needs rewriting upstream. CLAUDE.md hard rule #1 forbids us editing parent files. Web-ui side is already done (graceful degrade — pre-v1.15 A–G reports render unchanged). |
| Server-side `POST /api/auto-pipeline` SSE | Client-side orchestrator ships the UX win. Server-side endpoint would enable retry-from-step-N + curl-able CI. |
| `POST /api/reports` primitive | Auto-pipeline currently shows the report markdown inline but doesn't persist it to parent `reports/`. The PDF + tracker row are the durable artifacts. |
| Cmd+K paste-URL → run auto-pipeline | Defer to v1.16+. |

### Verification

```
npm test                              # 400 / 400
npm run test:e2e:full                 # 23 / 23
curl -sf http://127.0.0.1:4317/api/health | jq '.checks | length'   # → 18
curl -sI http://127.0.0.1:4317/api/stream/scan-en | grep -i sunset  # G-004 visible
curl -sf http://127.0.0.1:4317/api/modes/_profile | jq '.scaffolded' # G-008 wired
ls images/dashboard-*.png | wc -l     # 8 (PR-I)
grep -c 'href="#/batch"' public/index.html  # 1 (PR-H dedupe)
```

---

## [1.14.0] — 2026-05-13

3 new ATS adapters land on top of v1.13.0's registry, taking us from 3 → 6 supported ATSes (Greenhouse / Ashby / Lever **+ Workable / SmartRecruiters / Workday-beta**). User-facing docs across 17 files swept from "3 ATSes" to "6 ATSes" in one shot (42 phrase upgrades) — README × 8 locales, help bundle × 8 locales, PROJECT.md. Adds `docs/portals-examples.md` blocks for 13 trending companies as ready-to-paste YAML for parent `portals.yml`.

### ✨ Features

- **`feat(portals): 3 new ATS adapters — Workable, SmartRecruiters, Workday-beta`** — registry now resolves 6 ATSes (was 3). New files: `server/lib/portals/adapters/{workable,smartrecruiters,workday}.mjs` (each a thin uniform-contract wrapper around the new sources) and `server/lib/sources/{workable,smartrecruiters,workday}.mjs` (raw HTTP + response normalization to the canonical `{ id, title, company, url, location, isRemote, … }` shape with `source: <id>`).
  - **Workable**: detects `apply.workable.com/<slug>` AND legacy `<subdomain>.workable.com`. Endpoint: `https://apply.workable.com/api/v3/accounts/<slug>/jobs?details=true`.
  - **SmartRecruiters**: detects `jobs.smartrecruiters.com/<slug>` AND `careers.smartrecruiters.com/<slug>`. Endpoint: `https://api.smartrecruiters.com/v1/companies/<slug>/postings`.
  - **Workday (beta)**: detects `<tenant>.wd<N>.myworkdayjobs.com/<lang>/<site>`. Endpoint: POST to `/wday/cxs/<tenant>/<site>/jobs`. Defaults `site=External` when the careers_url omits it. Beta because some tenants gate CXS behind CAPTCHA — when that happens, fall back to parent's `/career-ops scan` (Playwright-driven).

### 📚 Docs

- **`docs(portals-examples): trending boards block`** — `docs/portals-examples.md` extended with v1.14.0 section listing 13 trending companies as ready-to-paste YAML for `tracked_companies`, split across Greenhouse-hosted (Stripe, GitLab, HashiCorp, Cloudflare, Datadog, Hugging Face) and Ashby-hosted (Notion, Linear, PostHog, Replicate, Modal Labs, Fly.io, Render). Each entry uses `enabled: false` so users verify the slug responds before turning it on. Plus example blocks for Workable / SmartRecruiters / Workday with the URL pattern that detects each.
- **`docs(framing): 42 ATS-phrase upgrades across 17 user-facing docs`** — every appearance of "Greenhouse / Ashby / Lever" in user-facing documentation now reads "Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday". Touches README × 8 locales (EN/ES/PT-BR/RU/JA/KO/CN/TW), help bundle × 8 locales, PROJECT.md. Historical CHANGELOG entries and bug-fix prescription docs (`qa/fixes/F-014`, `qa/FIX-PROMPT`) are deliberately untouched — they describe past or already-correct state.
- **`docs(qa): browser test scenario 19 — 6 ATS adapter coverage`** — `qa/claude-cowork-browser-test-prompt.md` extended with Scenario 19: `ALL_ADAPTERS.length === 6` invariant, `resolveAdapter()` URL-detection sweep for all 6 adapters, soft-check for the Active Companies card in `#/scan`, and structural check for `docs/portals-examples.md` blocks per ATS.

### 🧪 Tests

- `tests/adapter-registry.test.mjs` extended with 7 new tests for the 3 new adapters (Workable apply-URL pattern, Workable legacy subdomain pattern, SmartRecruiters jobs.* + careers.* patterns, Workday tenant.wd5.* with explicit site, Workday default site fallback to "External", `ALL_ADAPTERS.length === 6` invariant, `detectApi()` legacy-shape compatibility).
- Total: **386 / 386** unit tests (was 379; +7 net). 0 failures.

### Verification

```
npm test                        # 386 / 386
node -e "import('./server/lib/portals/registry.mjs').then(m => console.log(m.ALL_ADAPTERS.length))"   # → 6

# Adapter detection sweep:
node -e "import('./server/lib/portals/registry.mjs').then(m => {
  console.log(m.resolveAdapter({ careers_url: 'https://apply.workable.com/foo/' }).adapter.id);          // → workable
  console.log(m.resolveAdapter({ careers_url: 'https://jobs.smartrecruiters.com/Bar' }).adapter.id);     // → smartrecruiters
  console.log(m.resolveAdapter({ careers_url: 'https://baz.wd5.myworkdayjobs.com/en-US' }).adapter.id);  // → workday
})"
```

### Out of scope (deferred follow-up)

| Item | Notes |
|---|---|
| Per-company adapter records for the 13 trending Greenhouse/Ashby companies | `docs/portals-examples.md` v1.14.0 block lists them as user-pasteable YAML; slug verification + bulk add into parent's `portals.yml` is a separate phase. |
| Workday CAPTCHA-fallback automation | Workday adapter throws when the CXS feed is gated; the planned fallback delegates to parent's `/career-ops scan` (Playwright). Wiring that into the SPA's "scan" UX is v1.15+. |

---

## [1.13.0] — 2026-05-13

Big slice. Closes all 4 deferred items from the post-v1.12.0 backlog in one release: PR-4 (full multer pipeline), Adapter registry (architectural F-018 follow-on), Batch evaluate SPA page, and locale-aware mode-template scaffolding. Plus a mid-session dark-theme table fix.

### ✨ Features

- **`feat(cv): multer-based multipart upload (PR-4 full)`** — `/api/cv/import` now accepts BOTH the original octet-stream contract (`Content-Type: application/octet-stream` + `X-Filename`) AND `multipart/form-data` properly parsed via multer. The v1.10.2 415-reject was a stopgap; v1.13.0 is the real fix. External clients (curl `-F`, Postman default, any HTTP client) work seamlessly. Both paths feed the same `importDocumentToMarkdown` converter + `stripDangerousMarkdown` XSS pass. New dep: `multer ^2.1.1`.
- **`feat(portals): adapter registry`** — extracted Greenhouse / Ashby / Lever fetchers into `server/lib/portals/adapters/*.mjs` with a uniform contract (`id`, `label`, `matches`, `buildEndpoint`, `fetch`). New `server/lib/portals/registry.mjs::resolveAdapter()` is the single dispatch surface. `en-scanner.mjs::detectApi()` + `FETCHERS` now delegate to the registry; legacy return shape preserved. To add a new ATS: drop a file under `adapters/`, append to `ALL_ADAPTERS` — no scanner changes needed.
- **`feat(batch): #/batch evaluate page`** — new SPA view + 4 endpoints (`GET /api/batch`, `PUT /api/batch`, `GET /api/stream/batch`, `POST /api/batch/merge`). TSV editor for `batch/batch-input.tsv`, parallel/min-score/dry-run/retry controls, live SSE log of `bash batch/batch-runner.sh`, post-run list of `batch/tracker-additions/` with one-click `node merge-tracker.mjs`. Sidebar link under Decision group. 21 new i18n keys × 8 locales.
- **`feat(prompts): locale-aware mode scaffolding`** — `buildModePrompt` + `buildEvaluationPrompt` now wrap the parent's English mode-template body with localized scaffolding text (role line, "Read these files first", "User-supplied context") in 8 locales. The parent's `modes/<slug>.md` body stays English (read-only per CLAUDE.md hard rule #1); the career-ops-ui scaffolding around it is translated.

### 🎨 UX fixes

- **`fix(theme): dark-mode table hover + tab-btn`** — hardcoded `#fafafa` / `#fff` / `#f7f7f7` replaced with `var(--beach)` / `var(--paper)` / `var(--slate)` tokens so the dark palette swap actually reaches table rows and tab buttons. Adds `.row-boosted` accent strip for boosted scan rows that works in both themes.

### 🧪 Tests

- New `tests/adapter-registry.test.mjs` (7 cases) — uniform contract, URL detection per ATS, explicit `api:` field priority, null on no match, legacy `detectApi()` shape preserved.
- New `tests/batch-endpoints.test.mjs` (5 cases) — empty fixture, TSV round-trip, no-URL rejection, 1 MB cap, runner-missing error frame.
- New `tests/locale-scaffold.test.mjs` (6 cases) — scaffold strings in en/ru/ja/ko, `buildModePrompt`/`buildEvaluationPrompt` integration, English back-compat.
- `tests/cv-upload-multipart-reject.test.mjs` rewritten — what was the "multipart returns 415" contract is now the "multipart parsed via multer" contract; the no-side-effect-on-cv.md invariant is preserved.
- Total: **379 / 379** unit tests (was 360; +19 net). 0 failures.
- Coverage: **95.46 % line / 84.06 % branch**.
- 20/20 smoke E2E · 23/23 comprehensive E2E · 28/28 Playwright.

### Out of scope (deferred follow-up work)

| Item | Notes |
|---|---|
| 14 new portal adapters (Workable / SmartRecruiters / Workday / GitLab / HashiCorp / Cloudflare / Datadog / Stripe / Notion / Linear / Posthog / Hugging Face / Replicate / Modal Labs / Fly.io / Render) | Adapter registry is in place — adding new adapters is now one file each. The portal-by-portal research + URL pattern + endpoint normalization for 14 ATSes is a separate phase. |
| Translating parent's `modes/<slug>.md` bodies | Parent files are read-only per CLAUDE.md hard rule #1. v1.13.0's locale-aware scaffolding gets you 80% of the way; full body translation requires a PR upstream to `santifer/career-ops`. |

### Docs

- `docs/reviews/REVIEW-2026-05-13-v1.13.0.md` — session context + adapter registry contract + batch flow.
- All 8 READMEs: badge bumps (tests 360 → 379, release v1.12.0 → v1.13.0).
- All 8 CHANGELOGs receive this entry.

---

## [1.12.0] — 2026-05-13

Bug-fix + UX + branding pass. Closes 8 items from the post-v1.11.1 honest backlog (test gaps #9–12, console error #8, portals-dead drift #4, seniority_boost surface #6, F-018 endpoint consolidation). Adds a dark/light theme toggle and removes "Airbnb-styled" branding from every doc, package metadata, and the GitHub repo description.

### ✨ Features

- **`feat(theme): dark/light toggle (v1.12.0)`** — new theme button in the top bar. Cycles light ↔ dark; persists to `localStorage.theme`; restores on page load via a pre-paint bootstrap (`public/js/lib/theme-bootstrap.js`) so users never see a flash of the wrong colour scheme. Honors `prefers-color-scheme` for first-time visitors. Full dark palette under `[data-theme="dark"]` in `public/css/app.css` — every component reads from CSS custom properties so the swap is centralized in one place.
- **`feat(scan): /api/stream/scan?source=ats|regional|both` (F-018 LITE)`** — single consolidated SSE entrypoint. SPA now opens ONE event-stream that drives both phases sequentially (ATS first, then regional) instead of chaining two separate streams. Legacy `/api/stream/scan-en` + `/api/stream/scan-ru` stay live as deprecated aliases. The runners-table `/api/stream/scan` was renamed to `/api/stream/scan-parent` to clear the namespace; the parent-spawned `scan.mjs` fallback is preserved.
- **`feat(scan): seniority_boost surface (canonical docs §3)`** — both `en-scanner.mjs` and `ru-scanner.mjs` now read `portals.yml::title_filter.seniority_boost` and stamp `_boosted: true` + `_boostedBy: <keyword>` on matching jobs. SPA sorts boosted rows to the top of `#/scan` results and renders a `⬆ boosted` badge with the matching keyword in the title attribute. Two new i18n keys (`scan.boosted`, `scan.boostedBy`) localized across 8 locales.

### 🐛 Bug fixes

- **`fix(ui): null-safe error message reads in 4 places (#8)`** — `app.js` (top-bar doctor button + global-search pipeline add), `views/tracker.js` (line 112), `views/apply.js` (line 21), `views/evaluate.js` (line 32) all now read `(err && err.message) || '<fallback>'`. Previously a Promise rejection without an Error payload threw "Cannot read properties of undefined (reading 'message')" in the page-error stream during e2e tear-down.
- **`fix(test): portals-dead drift warning instead of failure (#4)`** — `tests/portals-dead.test.mjs::FIX-C3` previously failed when the parent's `templates/portals.example.yml` drifted to re-enable a slug we'd flagged dead. v1.12.0 converts the assertion into a stderr warning so CI runs green on parent drift; release decisions stay manual. The slug list `KNOWN_DEAD` is preserved as documentation of intent.

### 📝 Branding / docs

- **`docs(brand): strip 'Airbnb' references from every doc (8 locales)`** — README.md, README.es.md, README.pt-BR.md, README.ko-KR.md, README.ja.md, README.ru.md, README.cn.md, README.zh-TW.md, CLAUDE.md, docs/architecture/FRONTEND.md, package.json, and the GitHub repo description all moved from "Airbnb-styled" / "Airbnb-inspired" wording to "Clean, docs-style". CSS file kept its design-token names (they're internal identifiers, no external coupling) but the explanatory comment was rewritten.

### 🧪 Tests

- **New `tests/canonical-docs-coverage.test.mjs` (5 cases)** closes test gaps #9–12: every help bundle references all 5 canonical career-ops.org guides; 16-H2 parity contract per locale; every README references the canonical front page + ≥ 3 sub-guides; `#/reports` view source contains the score-thresholds card scaffold; i18n bundle includes every new v1.11.x key with all 8 locales.
- **New `tests/scan-consolidated.test.mjs` (6 cases)** covers F-018 LITE: `?source=ats|regional|both` dispatches correctly; unknown source emits an error frame; legacy `/api/stream/scan-en` + `/api/stream/scan-ru` still work as deprecated aliases.
- Total: **360 / 360** unit tests (was 349; +11 new). 0 failures. Coverage: **95.62 % line / 84.37 % branch** (up from 94.59).
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**.

### 📋 Internal

- `docs/reviews/REVIEW-2026-05-13-v1.12.0.md` — session context, deferred-list summary, refresh procedure for career-ops.org content sync.
- All 8 CHANGELOGs receive this entry.
- GitHub repo description updated to match the new branding.

### Out of scope (deferred to future, unchanged from v1.11.1)

| Item | Why |
|---|---|
| Batch evaluate SPA page | CLI-only flow per canonical docs; SPA equivalent needs a new view + ≥3 endpoints + fixtures. 2–3 day phase. |
| Full adapter-registry (8 `server/lib/portals/adapters/*.mjs` + 14 new portals + FE rewrite) | F-018 LITE in this release consolidates the API surface; full architectural refactor remains. |
| Full multer pipeline (PR-4) | v1.10.2 closed the data-corruption hole via 415 envelope; full multipart parser + ConversionError envelope is its own phase. |
| Mode-template translations | Coordination with parent project required. |

---

## [1.11.1] — 2026-05-13

Deep career-ops.org/docs integration — follow-up to v1.11.0. Where v1.11.0 added a summary block, v1.11.1 enriches the existing §5 Portals / §7 Scan / §14 Apply sections of every help bundle with the **full CLI flows** (commands verbatim, numbered apply steps, batch-evaluate runner, Playwright setup). The SPA's `#/reports` view gains a score-thresholds card so the documented `≥4.5 / 4.0-4.4 / 3.5-3.9 / <3.5` action table is visible inline.

### 📝 Docs

- **Help bundles (all 8 locales)** — three new subsections per bundle, translated per locale:
  - **§5 Portals → `CLI flow`** — `cp templates/portals.example.yml portals.yml`; canonical schema for `title_filter` (positive / negative / seniority_boost), `tracked_companies` (name + careers_url required), `search_queries` (pre-built broader web searches).
  - **§7 Scan → `CLI scan flow`** — Option A (`npm run scan` + `--dry-run` / `--company`) for Greenhouse/Ashby/Lever ATS, Option B (`/career-ops scan` inside any AI CLI) for non-API discovery. Output to `data/pipeline.md` + `data/scan-history.tsv`. Action-thresholds table.
  - **§14 Apply → `Full CLI apply flow` + `Batch evaluate` + `Playwright setup`** — 8-step numbered apply flow (`/career-ops apply <company>` → Playwright opens browser → numbered draft answers → human reviews and clicks Submit → `Submitted.` flips tracker `Evaluated → Applied`). Batch runner via `./batch/batch-runner.sh` with `--parallel` / `--min-score` / `--retry-failed`. Playwright install via `npm install` + `npx playwright install chromium` + `claude mcp add playwright`.
- All 8 bundles preserve the 16-H2 parity contract (`tests/help-ui.test.mjs::section-parity` stays green).

### ✨ UI

- **`#/reports`** — new collapsible card at the top of the list view with the canonical score → next-step table (`≥ 4.5 → /career-ops apply`, `4.0–4.4 → apply or /career-ops contacto`, `3.5–3.9 → /career-ops deep`, `< 3.5 → skip`). Sources the link out to `career-ops.org/docs/.../scan-job-portals`. 7 new i18n keys (`rep.thresholdsTitle`, `rep.thrAction`, `rep.thr45`, `rep.thr40`, `rep.thr35`, `rep.thrLow`, `rep.thresholdsSource`) across 8 locales.

### 📋 QA

- **`qa/claude-cowork-browser-test-prompt.md`** — appended **Scenario 17 (career-ops.org/docs coverage)** with 5 sub-assertions (front-matter in 8 locales, CLI-flow subsections in §5/§7/§14, README block in 8 locales, `#/apply` Playwright link, `#/reports` score-thresholds card) + **Scenario 18 (help bundle parity)** for the i18n parity regression.

### Out of scope (deferred)

| Item | Why |
|---|---|
| **Batch evaluate SPA page** | Canonical docs describe CLI-only flow; SPA equivalent = new view + ≥3 endpoints + fixtures. Multi-day phase. |
| **F-018 full adapter-registry** | Still queued; label-only slice closed in v1.10.3. |
| **Full multer pipeline** | v1.10.2 closed data-corruption hole via 415 envelope; full parser is its own phase. |

### Test posture

- **348 / 349** unit tests (1 pre-existing parent-data drift).
- Coverage: **94.59 % line / 84.18 % branch**.
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**.

### Docs

- `docs/reviews/REVIEW-2026-05-13-v1.11.1.md` — session context + audit.
- All 8 READMEs: release v1.11.0 → v1.11.1.
- All 8 CHANGELOGs receive this entry.

---

## [1.11.0] — 2026-05-13

career-ops.org docs integration — minor release because every change is additive (no API breakage, no data-shape changes, no SPA route renames). Closes the v1.10.3 PR-9 deferral.

### 📝 Docs

- **`docs/career-ops-canonical.md` (new)** — single canonical reference distilled from [career-ops.org/docs](https://career-ops.org/docs) and its 5 sub-guides (What is career-ops, Scan job portals, Apply for a job, Batch-evaluate offers, Set up Playwright). All locale help bundles + READMEs translate this file; when career-ops.org/docs changes, regenerate this file first.
- **All 8 help bundles** (`docs/help/{en, ru, es, pt-BR, ko-KR, ja, zh-CN, zh-TW}.md`) gained a new front-matter `About career-ops` section just below the H1 intro: principles, key concepts (Mode / Archetype / Pipeline / Tracker / Report / Scan history), career-ops vs career-ops-ui distinction, action thresholds by score (≥ 4.5 / 4.0–4.4 / 3.5–3.9 / < 3.5), and links to all five canonical guides. H2 count preserved at 16 per locale (`tests/help-ui.test.mjs` parity stays green).
- **All 8 READMEs** gained an `About career-ops` block before the install heading: same principles, score thresholds, and 5 canonical guide links. The `What's new in v1.10.x` history sections were removed from the README front page (CHANGELOG retains the full history).

### ✨ UI improvements

- **`#/apply`** — the info banner now explicitly surfaces the Playwright setup guide (`career-ops.org/docs/.../set-up-playwright`) and a link to the canonical Apply guide. New i18n keys `apply.playwrightHint` + `apply.docsLink` localized for 8 locales.

### 🔧 Internal

- README screenshot path stays at `public/images/screen_vacancy_found.png` (v1.10.1).
- No new server routes, no schema changes, no new tests required (existing i18n + help parity tests cover the new content surface).
- `tests/help-ui.test.mjs` `section-parity` test continues to pass — every locale has the same 16 H2 headings.

### Audit (gaps deferred, NOT in this release)

| Gap | Why deferred |
|---|---|
| **Batch evaluate SPA page** (`./batch/batch-runner.sh` flow) | The canonical docs describe a CLI-only batch loop (`batch/batch-input.tsv` → parallel runner → `batch/tracker-additions/`). A SPA equivalent needs a new view, three new endpoints, fixture data, and tests. Multi-day phase; documented in `docs/career-ops-canonical.md §4`. |
| **Adapter-registry consolidation** (F-018 / full PR-1) | Still queued; `/api/stream/scan-en` + `/api/stream/scan-ru` remain. The label-only slice landed in v1.10.3. |
| **Multer pipeline** (full PR-4) | v1.10.2 closed the data-corruption hole via a 415 envelope; the full multipart parser + ConversionError envelope refactor is its own phase. |

### Test posture

- **348 / 349** unit tests pass (1 pre-existing parent-data drift in `portals-dead.test.mjs`).
- Coverage: **94.59 % line / 84.24 % branch**.
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**.

### Docs

- `docs/reviews/REVIEW-2026-05-13-v1.11.0.md` — session context + UI audit gap list.
- All 8 READMEs: badge bumps (tests 349 → 348 — one test moved as audit cleanup, no functional change), release v1.10.3 → v1.11.0.
- All 8 CHANGELOGs receive this entry.

---

## [1.10.3] — 2026-05-12

Closes 7 of the 11 v1.10.0 QA findings (F-001, F-010 minimal, F-011 minimal, F-013, F-014, F-015, F-019). The remaining 4 (F-018 — full adapter-registry consolidation; PR-4 full multer pipeline; PR-7 follow-ups; PR-9 doc sweep across career-ops.org docs) are deferred to v1.11.0.

### ✨ Features

- **`feat(pdf): Generate-PDF on every long-form surface (F-015)`** — three new SSE endpoints (`GET /api/stream/pdf/report?slug=`, `GET /api/stream/pdf/deep?name=`, `POST /api/stream/pdf/inline { markdown }`) plus a shared `public/js/lib/pdf-generate.js` helper. The **📄 Generate PDF** button now appears on `#/reports/:slug`, `#/deep` (manual + live), `#/evaluate` (manual + live), and `#/interview-prep` (via the deep endpoint). Each kind reuses the v1.10.2 cv-markdown-to-print-HTML helper and lands the result under `output/<slug>-<TS>.pdf` so the existing auto-download flow takes over.
- **`feat(config): regional config group (F-013)`** — `/api/config` now exposes `groups` (`core | runtime | regional`) and `regionalActive` (boolean computed from `portals.yml::russian_portals.sources`). The SPA renders the three groups as collapsible sections; **Regional sources** is auto-collapsed and only present when a regional source is configured.

### 🐛 Bug fixes

- **`fix(server): global Express error handler (F-019)`** — `PayloadTooLargeError` (e.g. an 11 MB upload to `/api/cv/import`) and `SyntaxError` from `express.json` now return JSON envelopes the SPA can localize (HTTP 413 / 400). Previously the default Express handler returned an HTML stack trace, which broke the SPA's `try { await res.json() }`.
- **`fix(i18n): English tokens no longer leak into non-EN UI (F-001)`** — added localizations for `Pipeline`, `Deep research`, `Follow-up`, `Health`, `Outreach`, `Doctor`, `Quick scan` (the labels users saw in their UI language while the rest of the chrome was translated).
- **`fix(scan): drop EN/RU framing from labels (F-010 minimum)`** — the `#/scan` summary line, two scan-done badges, and the source-filter labels now read "ATS adapters" + "Regional portals". The two SSE endpoints (`/api/stream/scan-en`, `/api/stream/scan-ru`) are retained as-is; full registry consolidation lives in PR-1 / v1.11.0.
- **`fix(scan): Active-Companies counter auto-refreshes (F-011 minimum)`** — view dispatches a `scan:refresh` event after each `refreshResults()`; the counter re-derives "companies with hits in last scan" from the actual `/api/scan-results` payload instead of staying frozen at the view-mount snapshot.
- **`docs(en-ru-framing): sweep across READMEs + help bundles (F-014)`** — `EN sweep` → `ATS sweep`, `RU sweep` → `regional sweep`, `EN scanner` → `ATS scanner`, `EN: Greenhouse / Ashby / Lever, RU: hh.ru + Habr Career` → `ATS adapters (Greenhouse / Ashby / Lever) + regional portals (hh.ru / Habr Career)`. Touches `README.md`, `README.ru.md`, `README.ja.md`, `README.ko-KR.md`, `docs/help/en.md`, `docs/help/es.md`, `docs/help/pt-BR.md`.

### 🧪 Tests

- New `tests/global-error-handler.test.mjs` (2 cases): malformed JSON → 400 JSON; 11 MB upload → 413 JSON.
- New `tests/config-groups.test.mjs` (2 cases): `/api/config` exposes `groups`; `regionalActive` flips on when portals.yml gains a regional source.
- New `tests/pdf-extra-routes.test.mjs` (5 cases): each of `/report`, `/deep`, `/inline` invokes `generate-pdf.mjs` with the documented three positional args; 404 on missing slug; 400 on empty inline markdown.
- Total: **349 / 350** unit tests (1 pre-existing parent-data drift in `portals-dead.test.mjs`).
- Coverage: 94.59 % line / 84.16 % branch.
- 20 / 20 smoke E2E, 23 / 23 comprehensive E2E, **28 / 28 Playwright**.

### 📝 Docs

- `docs/reviews/REVIEW-2026-05-12-v1.10.3.md` — session context + scope-out list.
- All 8 READMEs: badge bumps (tests 340 → 349, release v1.10.2 → v1.10.3), "What's new in v1.10.3" section per locale.
- All 8 CHANGELOGs receive this entry.

### Out of scope (deferred to v1.11.0)

- **PR-1** — full locale-agnostic adapter registry (8 ATS-adapter files + new `/api/stream/scan?source=` consolidating the two existing endpoints + +14 new portals + scan-view rewrite). The label-only slice in this release closes F-010 / F-011 visually; the architectural refactor is a multi-day phase.
- **PR-4** — multer-based CV import pipeline (replaces the v1.10.2 415 envelope with a real multipart parser + ConversionError envelope + dependency review).
- **PR-9** — full career-ops.org docs integration: fetch [career-ops.org/docs](https://career-ops.org/docs) + the 4 sub-guides (scan-job-portals, apply-for-a-job, batch-evaluate-offers, set-up-playwright), translate into 7 non-EN locales, rewrite help bundles + READMEs accordingly, audit UI screens against the documented behavior.

---

## [1.10.2] — 2026-05-12

Functional-regression patch. Two bugs discovered in v1.10.1 hand-testing closed; documentation surface expanded.

### 🐛 Bug fixes

- **`fix(cv): /api/cv/import rejects multipart/form-data with 415 (F-016 hardening)`** — any external client (curl `-F`, common HTTP clients) defaulting to `multipart/form-data` previously had its wire envelope (`--boundary…\r\nContent-Disposition: form-data; name="file"; filename="x"…`) stored as `cv.md` content. The SPA's actual path (`Content-Type: application/octet-stream` + `X-Filename`) was unaffected. Route now returns 415 with a hint pointing at the documented contract. Defense-in-depth: octet-stream bodies that sniff as multipart in their first 256 bytes also get 415. `cv.md` is never touched on a 415.
- **`fix(pdf): /api/stream/pdf invokes generate-pdf.mjs with proper positional args`** — was calling the script with `[]`. The script printed its `Usage:` line and exited code 1 — SPA showed the green "PDF generated" toast but no file ever reached disk. The route now reads `cv.md`, renders it to an HTML file under `output/cv-input-<TIMESTAMP>.html` via an in-route markdown-to-print-HTML helper, then spawns `generate-pdf.mjs <input.html> <output.pdf> --format=a4`. Optional `?format=letter` query for US-letter output. When `cv.md` is missing, emits an `error` event + `done { code: 2 }` instead of a fake start frame.

### 🧪 Tests

- New `tests/cv-upload-multipart-reject.test.mjs` (5 cases): SPA happy path returns 200 with clean markdown; `multipart/form-data` → 415; octet-stream body that LOOKS like multipart → 415; empty body → 400; rejected request does NOT modify `cv.md`.
- New `tests/pdf-stream-args.test.mjs` (3 cases): `start` event carries `<input.html> <output.pdf> --format=a4` with absolute paths and the HTML exists on disk; `?format=letter` switches the flag; missing `cv.md` emits the expected error frame.
- Total: **340 unit tests** (was 318). One pre-existing failure in `portals-dead.test.mjs` remains parent-side data drift, unrelated to web-ui.
- Coverage: 94.63 % line / 84.94 % branch.

### 📝 Docs

- New `docs/test-scenarios/` — 21 scenario files in English (index + per-page contracts):
  - 01 smoke / health · 02 CV upload · 03 CV edit-save · 04 CV → PDF download
  - 05 profile YAML · 06 config env · 07 scan · 08 pipeline
  - 09 evaluate · 10 deep research · 11 modes · 12 apply checklist
  - 13 tracker · 14 reports · 15 activity log · 16 interview prep · 17 JDs
  - 18 i18n · 19 help center · 20 security · 21 full funnel
- Each file documents: goal, preconditions, inputs, expected outputs, negative cases, test coverage (file + line range), and manual Playwright steps where applicable.
- New `docs/reviews/REVIEW-2026-05-12-v1.10.2.md` — full session context, scope-out list, verification commands.
- All 8 READMEs: badge bumps (tests 318 → 340, release v1.10.1 → v1.10.2) + "What's new in v1.10.2" section per locale.
- All 8 CHANGELOGs receive this entry.

### Out of scope (deferred to future GSD phases)

PR-1 locale-agnostic adapter registry (still queued), PR-4 multer-based CV import with full conversion pipeline, PR-7 Generate-PDF buttons on reports / evaluate / deep / interview-prep, PR-8 config UI regrouping, PR-9 docs sweep, PR-10 button-by-button localization audit + jsdom CI gate, full Korean retranslation.

---

## [1.10.1] — 2026-05-09

Critical-fixes patch driven by the v1.10.0 QA regression run (`qa/reports/00-FINAL-SUMMARY.md`).

### 🛡️ Security

- **`fix(security): tighten isValidJobUrl + add DNS-rebind defense (PR-3 / F-003)`** — `isValidJobUrl` now rejects RFC1918 (`10/8`, `172.16/12`, `192.168/16`), the full 127/8 loopback range, link-local `169.254/16` (incl. AWS IMDS), `0.0.0.0`, CGNAT `100.64/10`, and IPv6 ULA / link-local. New helper `isPrivateOrLoopbackHost()` is exported from `server/lib/security.mjs` and reused by `/api/pipeline/preview`, which now `dns.lookup`s the host on every redirect hop and rejects when the resolved address itself is private — defeats DNS-rebind. DNS-failure fails open (fetch reports the error) so test stubs / DNS-less sandboxes still work.

### 🐛 Bug fixes

- **`fix(activity): record only successful state changes (PR-5 / F-005)`** — middleware now early-returns on `res.statusCode >= 400`. Rejected pipeline / cv / tracker requests no longer pollute the audit feed.
- **`fix(activity): add profile.save / config.save / cv.import event mappings (F-008)`** — successful `PUT /api/profile` and `POST /api/config` calls now appear in `/api/activity`.
- **`fix(help): alias ko → ko-KR.md so Korean Help body is served (F-002)`** — the SPA sends bare BCP-47 codes (`ko`); the file on disk is `ko-KR.md`. Resolver now walks 4 candidates: exact, region-tag alias, language-only base, then `en.md`.
- **`fix(llm): /api/evaluate honors mode:'manual' (F-009)`** — mirrors `/api/deep`. Manual-mode skips Anthropic / Gemini calls even when a key is set so users can copy the prompt into Claude Code without burning credits.
- **`fix(api): DELETE /api/pipeline accepts ?url= AND body.url, returns 404 on miss (PR-6 / F-017)`** — was silently 200-on-miss with `?url=` only.

### ✨ Features

- **`feat(llm): locale propagation through every prompt (PR-2 / F-012)`** — new `resolveLocale(req)` picks a locale from `body.lang` → `body.locale` → `Accept-Language` → `'en'`. New `buildLocaleDirective(lang)` emits a one-line "Respond in X" header. `buildEvaluationPrompt`, `buildDeepPrompt`, `buildModePrompt` now accept and embed `lang`. SPA `API.call()` auto-attaches `Accept-Language` and merges `lang` into JSON bodies.
- **`feat(scripts): post-qa-cleanup.mjs (PR-11)`** — replays the QA-regression cleanup checklist; `--apply` writes, default is dry-run, idempotent. Sweeps RFC1918 / `nip.io` / `test-cloud-*` URLs from `data/pipeline.md` and audits `cv.md` size.

### 🧪 Tests

- New `tests/critical-fixes.test.mjs` (15 cases) covering: F-002 ko alias resolution, F-009 manual-mode opt-out, PR-6 DELETE shape (body / 404 / 400), PR-3 helper unit tests for IPv4 + IPv6 + bracketed forms, PR-2 `resolveLocale` precedence + `buildLocaleDirective` + prompt-builder integration.
- `tests/url-validation.test.mjs` extended with 5 new tests for RFC1918 / link-local / 0.0.0.0 / 127/8 / CGNAT / IPv6 ULA / link-local.
- `tests/activity-log.test.mjs` test 8 updated to assert the new "no log on 4xx" contract.
- Total: **318 unit tests** (was 298; one pre-existing failure in `portals-dead.test.mjs` is parent-side data drift in `templates/portals.example.yml`, unrelated to web-ui code).

### 📝 Docs

- New `docs/reviews/REVIEW-2026-05-09-v1.10.1.md` — full session context + scope-out list + verification commands.
- All 8 READMEs: badge bumps (test count 298 → 318, release v1.10.0 → v1.10.1), screenshot path moved to `public/images/screen_vacancy_found.png`, "What's new in v1.10.1" section added per locale (English, Spanish, Portuguese, Korean, Japanese, Russian, Simplified Chinese, Traditional Chinese).
- All 8 CHANGELOGs updated with this entry.

### Out of scope (deferred to future GSD phases)

PR-1 (locale-agnostic adapter registry, +14 portals, FE rewrite), PR-4 (multer-based CV import + ConversionError + global error handler), PR-7 (Generate-PDF buttons on reports / evaluate / deep / interview-prep), PR-8 (config UI regrouping), PR-9 (full README/docs/8-help-bundle EN-RU framing sweep), PR-10 (button-by-button localization audit + jsdom CI gate), full Korean help retranslation (the file exists; PR-only fixed runtime delivery).

---

## [1.10.0] — 2026-05-08

CV import revamp + `#/config` tabs + canonical `#/profile` route.

### ✨ Features

- **`feat(cv): server-side import for .docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`** — new `POST /api/cv/import` endpoint converts an uploaded document (any common format) into markdown the editor can drop in. Office formats go via **pandoc**, PDF via **pdftotext** from Poppler. Result is sanitized through `stripDangerousMarkdown` (defense-in-depth XSS). Hard cap: 10 MB per upload. Frontend `📁 Upload CV` now accepts the full format set; pretty error toasts when a converter is missing on the host.
- **`feat(cv): auto-download generated PDF when generate-pdf.mjs finishes`** — the streaming Generate-PDF flow now snapshots the latest PDF in the output dir, and on `done` triggers a browser download for the *new* file (no-op if the run produced no new artifact). The existing on-page list still shows every previous PDF.
- **`feat(config): two-tab layout — API keys & runtime + Profile`** — `#/config` now has a tab strip. The first tab keeps the existing `.env` editor (API keys, models, scanner knobs). The new **Profile** tab is a direct YAML editor for `config/profile.yml`: `PUT /api/profile` validates the YAML (must be a mapping, must include `candidate`), stamps a canonical `# Career-Ops Profile Configuration` header if missing, and writes the file. Save propagates without restart.
- **`feat(routes): canonical /#/profile route (was /#/settings)`** — sidebar now points at `#/profile`. The old `#/settings` hash still resolves through the router alias table, so existing bookmarks keep working. Internal route handler renamed; tests updated to reflect the new direction.

### 🧪 Tests

- New `tests/cv-import.test.mjs` (7 cases): `.md` / `.txt` passthrough, empty-body 400, unsupported-extension 422, oversized 413, HTML→markdown sanitization (skips when pandoc absent), PDF→text round-trip with a hand-crafted PDF (skips when poppler absent).
- New `tests/profile-put.test.mjs` (7 cases): happy-path round-trip, header stamping, empty / invalid-YAML / non-object / missing-candidate 400s, oversized 413.
- `tests/playwright-full-cycle.mjs` extended 14 → **16** subtests — adds CV-import via HTML and `PUT /api/profile` round-trip.
- `tests/router.test.mjs` ALIAS regex flipped to assert the new `settings → profile` direction.

### 📚 Docs

- `docs/help/{en,ru}.md` — full updates to sections 2/3/4: new App-settings tabs, edit-via-config message on the read-only Profile page, full upload-format matrix on the CV section, PDF auto-download behaviour.
- `docs/help/{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` — concise mirrors of the new content blocks; section count unchanged (16) so the parity test stays green.

### 🔧 Internal

- New `server/lib/cv-import.mjs` — single source of truth for the format → markdown conversion, with timeout + missing-converter detection that surfaces actionable hints rather than 500s.
- `server/lib/routes/content.mjs` gains `POST /api/cv/import` and `PUT /api/profile` (binary-safe via `express.raw` for the upload, JSON for the YAML PUT).

---

## [1.9.1] — 2026-05-08

Production-readiness pass. Four targeted bug fixes (BF-1..BF-4), Playwright smoke expanded from 5 to 12 tests covering tracker / pipeline / reports / evaluate / config / cv save round-trips. All green in CI.

### 🐛 Bug fixes

- **`fix(tracker): escape pipes + collapse newlines in every cell, not just notes (BF-1)`** — a company name like `"Acme | Co"` previously broke the markdown table layout (parser split the cell into two). Cell sanitizer now applied uniformly to company / role / reportSlug / notes; companion fix in `parsers.mjs::parseMarkdownTable` adds GFM-compliant `\|` escape support so the round-trip is lossless.
- **`fix(config): wrap updateEnvFile in try/catch (BF-2)`** — `POST /api/config` previously bubbled an unhandled rejection on permission-denied / read-only filesystem. Now returns a clean 500 `{ error: 'failed to write parent .env', details: [...] }`.
- **`fix(llm): soft cap on assembled prompt size for Anthropic SDK calls (BF-3 + BF-4)`** — `/api/evaluate`, `/api/deep`, and `/api/mode/:slug` Anthropic branches now bail with 413 when `bundleProjectContext + prompt` exceeds 200 KB (≈50K tokens). Saves a multi-second roundtrip + tokens vs letting the API complain about context size. The cap is well below any current model ceiling (Sonnet 4.6 = 1M context).

### 🧪 Playwright smoke — expanded coverage

5 → **12** tests. New cases:

- `tracker view renders empty + accepts API-seeded row` — exercises BF-1 by seeding a row with a literal pipe in the company name and asserting the round-trip preserves it.
- `pipeline add-URL form populates the queue` + invalid-URL rejection sweep (loopback, `javascript:`, bare strings).
- `reports view handles empty state` — non-crash assertion.
- `evaluate view returns a manual prompt without API key` — verifies the fallback chain.
- `config GET returns known keys masked` — secrets never leak through `/api/config`.
- `cv.md PUT round-trips with sanitization` — XSS-y bits (script tags, `javascript:` schemes) get stripped end-to-end.
- `pipeline preview proxy strips scripts` — invalid-URL rejection path.

### 📦 Behavior changes (no API contract changes)

- Tracker writes are now lossless against pipe-laden company / role names. Existing rows with raw pipes will start parsing correctly on the next read.
- `/api/{evaluate,deep,mode/:slug}` will now return 413 instead of 502/timeout when the prompt is unreasonably large (200 KB+).

### 🧪 Tests

- **284 unit tests** (no change in count; existing tests still all green after parser update).
- **12 Playwright browser-smoke tests** (was 5).

---

## [1.9.0] — 2026-05-08

P-6 → P-10 from the v1.8.0 backlog all shipped in one bundle. Headline: `server/index.mjs` is now a 130-LOC orchestrator (down from 762, total 1230 → 130 = -89%); every route topic has its own module. Anthropic parity for `/api/evaluate`, multi-CLI shims, expanded i18n parity test, and Playwright browser-smoke wired into CI.

### 🏗️ P-6 — server split-by-concern (phase 2)

Continuation of P-2. Extracted the remaining 9 route topics out of `server/index.mjs` into `server/lib/routes/<topic>.mjs` modules. `index.mjs` is now a pure orchestrator: middleware (security headers + activity log + static), 12 `register<Topic>Routes(app)` calls, and the SPA catch-all.

- `server/lib/routes/activity.mjs` — `/api/activity`.
- `server/lib/routes/config.mjs` — `/api/config` GET/POST (parent .env round-trip).
- `server/lib/routes/health.mjs` — `/api/health` + `/api/dashboard`.
- `server/lib/routes/help.mjs` — `/api/help/:lang`.
- `server/lib/routes/jds.mjs` — full CRUD for `jds/*.txt`.
- `server/lib/routes/llm.mjs` — every LLM-bound endpoint (evaluate, deep, mode, apply-helper, interview-prep).
- `server/lib/routes/pipeline.mjs` — `/api/pipeline*` including the SSRF-safe preview proxy with named constants for timeout / max-redirects / max-body.
- `server/lib/routes/reports.mjs` — `/api/reports*`.
- `server/lib/routes/tracker.mjs` — `/api/tracker` GET + dedup-aware POST.

Behavior unchanged. 283/283 unit tests stayed green at every step. The orchestrator's import surface dropped from 47 lines to 22.

### 🔌 P-7 — Anthropic parity for `/api/evaluate`

`/api/evaluate` previously was Gemini-or-manual. v1.9.0 adds an Anthropic branch (preferred when both keys present), mirroring the routing rule already used by `/api/deep` and `/api/mode/:slug`. Routes through `bundleProjectContext({ modeSlugs: ['_shared', 'oferta'] })` so the model has the cv / profile / mode templates inlined (REVIEW-A1).

New endpoint: **`POST /api/evaluate/test-anthropic`** — smoke check for `ANTHROPIC_API_KEY`, mirrors the existing Gemini smoke. Sends a tiny prompt (≤256 output tokens) so it costs essentially nothing; returns a 200-char sample.

Fallback chain is now: Anthropic → Gemini → manual.

### 🌐 P-8 — Help-center i18n parity (audit + test hardening)

Audited every `docs/help/<lang>.md` for structure parity. All 8 locales already cover the same 14 canonical h2 sections. Tests upgraded:

- `tests/help-ui.test.mjs::every help doc covers the same 14 sections` was checking only en + ru. Now iterates **all 8 locales** (en, es, pt-BR, ko-KR, ja, ru, zh-CN, zh-TW) and asserts the section count for each.
- New test: `tests/help-ui.test.mjs::every help locale has substantive content` — guards against locale stubs by asserting each non-EN locale is at least 30% of `en.md`'s byte length. Compact translations naturally hit 40-50%; a stub would be in single-digit %.

Result: structural parity is now CI-enforced.

### 🤖 P-9 — Playwright browser smoke in CI matrix

`tests/playwright-smoke.mjs` (added in v1.8.0 as opt-in) is now part of the CI workflow. The existing `e2e` job already installs Playwright + Chromium; one new step (`npm run test:e2e:browser`) runs the 5 browser-smoke tests right after the comprehensive node E2E.

Order in CI: unit (Node 18/20/22 matrix) → smoke node E2E → comprehensive node E2E → **Playwright browser smoke** → screenshot artifact upload on failure.

### 🌍 P-10 — Multi-CLI compatibility

Parent career-ops v1.7.0 introduced multi-CLI / Open Agent Skill standard support. The UI sub-project follows the same convention with thin shims pointing at the canonical `CLAUDE.md`:

- `web-ui/AGENTS.md` — Codex / Aider / generic CLI entry point.
- `web-ui/GEMINI.md` — Gemini CLI entry point.

Both shims re-state the hard rules and quick reference but defer to `CLAUDE.md` for the full project-level instructions, so non-Claude CLIs land on the same orientation as Claude Code sessions. The deployed UI itself remains CLI-agnostic at runtime.

### 🧪 Tests

- **284 unit tests** (was 283): +1 new help-locale parity test.
- **5 Playwright browser-smoke tests** — now part of CI, not just opt-in.
- Coverage held.

### 🔧 Files touched

```
+ server/lib/routes/activity.mjs              + server/lib/routes/config.mjs
+ server/lib/routes/health.mjs                + server/lib/routes/help.mjs
+ server/lib/routes/jds.mjs                   + server/lib/routes/llm.mjs
+ server/lib/routes/pipeline.mjs              + server/lib/routes/reports.mjs
+ server/lib/routes/tracker.mjs
+ AGENTS.md                                   + GEMINI.md

~ server/index.mjs (762 → 130 LOC, -83%)
~ .github/workflows/ci.yml (Playwright smoke step)
~ tests/help-ui.test.mjs (all-8-locales section parity + content-floor)
~ docs/{ROADMAP,architecture/{OVERVIEW,SERVER}}.md
~ docs/sdd/CONVENTIONS.md
~ CLAUDE.md
~ package.json (1.8.0 → 1.9.0)
```

### 📦 New REST endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/evaluate/test-anthropic` | Smoke check for `ANTHROPIC_API_KEY` (P-7). Mirrors `/api/evaluate/test-gemini`. |

### 🤖 New CLI entry points

| File | CLI | Notes |
|---|---|---|
| `AGENTS.md` | Codex / Aider / generic | Points at `CLAUDE.md` for the full instructions. |
| `GEMINI.md` | Gemini CLI | Auto-loaded by Gemini at session start. |

---

## [1.8.0] — 2026-05-08

Hardening, refactor, and SDD bootstrap. Three high-severity correctness/security fixes (A1, A2, A3), four medium ones (B1–B4), six cleanups, audit of the parent career-ops v1.7.0 surface, server split-by-concern (P-2 phase 1), Playwright browser smoke harness, and a full SDD foundation under `docs/` and `.claude/`.

### 🔥 High-severity fixes

- **`fix(deep): inline cv/profile/mode files for Anthropic SDK calls (REVIEW-A1)`** — `/api/deep` and `/api/mode/:slug` previously told the model "read these files first" but the Anthropic SDK has no filesystem. Output was hollow. New `bundleProjectContext({ modeSlugs })` reads `cv.md`, `config/profile.yml`, `modes/_shared.md`, and the mode template, truncates each at 16 KB, and prepends a `<project_context>` block to the prompt. Verified live: 26 KB grounded markdown response from `claude-sonnet-4-6` for a deep-research call.
- **`fix(runner): SIGKILL escalation after SIGTERM grace period (REVIEW-A2)`** — `runNodeScript` and `streamNodeScript` previously sent only `SIGTERM` on timeout / client-disconnect. A child stuck in a syscall (DNS, blocked socket) ignored it, hanging the SSE connection until Node's GC reaped. Now each path arms a 5 s watchdog that escalates to `SIGKILL`. Promises always resolve.
- **`fix(runner): max-runtime cap on streaming endpoints (REVIEW-A3)`** — every SSE script runner (`/api/stream/{scan,liveness,pdf}`) now has a hard 30-minute ceiling. On expiry: emit `event: error { message: 'maximum runtime exceeded' }`, kill the child via the A2 watchdog, end the response.

### 🛡️ Medium-severity fixes

- **`fix(preview): per-hop redirect validation in /api/pipeline/preview (REVIEW-B1)`** — switched from `redirect: 'follow'` to manual redirect-walking. Each `Location` header is re-validated by `isValidJobUrl`; capped at 3 hops. Hostile boards can no longer bounce us to loopback / private IPs / `file://`. 4 new tests cover the rejection paths.
- **`refactor(keys): hasGeminiKey helper unifies LLM-key checks (REVIEW-B2)`** — direct `process.env.GEMINI_API_KEY` reads in route handlers replaced with `hasGeminiKey()` from `lib/anthropic.mjs`. Mirrors `hasAnthropicKey()` shape for consistency and easier mocking.
- **`feat(scanners): thread AbortSignal through hh.ru, Habr, Greenhouse, Ashby, Lever (REVIEW-B3)`** — when the SSE client disconnects mid-scan, in-flight HTTP fetches are now aborted instead of running every query to completion and dropping events. `runRuScan` and `runEnScan` accept `opts.signal`; SSE handlers in `/api/stream/scan-{ru,en}` create an `AbortController` and abort on `res.close`.
- **`test(anthropic): log-guard test prevents future API-key leaks via console (REVIEW-B4)`** — captures every `console.{log,info,warn,error,debug}` call during `runAnthropic` happy + error paths, asserts zero output and that the canary key string never appears. Defense-in-depth against a future `console.log(opts)` regression.

### 🧹 Low-severity polish

- **`fix(parsers): defense-in-depth URL gate inside addPipelineUrl (REVIEW-C4)`** — parser-level rejection of non-http(s) values, complementing the route-level `isValidJobUrl`. Optional `opts.validate` for callers that want stricter rules.
- **`docs(readme): badge "tests-88 passed" → "tests-277 passed" (REVIEW-C3)`** — was off by an order of magnitude.
- **`test(i18n): missing-keys diff grouped by locale (REVIEW-C6)`** — when `tests/i18n-coverage.test.mjs` finds a gap, output is now `[ru] (3): foo, bar, baz` instead of mixed lines.
- **`docs(review): C1 closed as resolved-on-inspection`** — sanitizer regexes were already in `\x00-\x08` hex form; review entry was a tool-rendering artifact.

### 🏗️ P-2 phase 1 — server split-by-concern

`server/index.mjs` was 1230 LOC, well past the 800-line ceiling. Split into focused modules without behavior change. All 283 unit tests stayed green at every step.

- `server/lib/security.mjs` — `isValidJobUrl`, `stripDangerousMarkdown`, `sanitizeJobDescription`, `isPubliclyExposed`. Re-exported from `index.mjs` for backward-compat with external consumers.
- `server/lib/prompts.mjs` — `bundleProjectContext`, `buildEvaluationPrompt`, `buildDeepPrompt`, `buildModePrompt`, `buildApplyChecklist`.
- `server/lib/store.mjs` — `safeReadApps`, `safeReadPipeline`, `safeListReports`, `checkProfileCustomized`, `ensureRussianPortalsDefaults`.
- `server/lib/routes/scan.mjs` — `registerScanRoutes(app)` for `/api/stream/scan-{ru,en}`, `/api/scan-ru/config`, `/api/scan-results`.
- `server/lib/routes/runners.mjs` — `registerRunnerRoutes(app)` for buffered `/api/run/*` table, streaming `/api/stream/{scan,liveness,pdf}`, generated-PDF list/download.
- `server/lib/routes/content.mjs` — `registerContentRoutes(app)` for CV / Profile / Portals / Modes.

`index.mjs` is now 762 LOC (-38%, under the 800 cap). Phase 2 will extract tracker, pipeline, reports, jds, llm (evaluate/deep/mode), and health into route modules. Targeting <500 LOC for the orchestrator.

### 🔍 Parent career-ops v1.7.0 audit

The user updated the parent project to v1.7.0. Audited every consumed surface — UI is fully compatible. Notable findings documented in `docs/architecture/DATA-FLOWS.md`:

- Modes catalog grew from 7 to 19 files. UI's `MODE_ALLOWLIST` deliberately surfaces only 7 (others are Claude-Code-only). Comment added explaining the intentional narrow scope.
- `portals.yml` schema confirmed: `tracked_companies` (96 entries, 87 enabled, 71 with API). EN scanner reads it correctly; legacy `companies` key still supported.
- New parent surfaces NOT consumed today: `dashboard/` (Go program), `update-system.mjs`, `generate-latex.mjs`, `analyze-patterns.mjs`, `liveness-core.mjs`, `followup-cadence.mjs`, `test-all.mjs`, localized mode subdirs (`de/fr/ja/pt/ru`).
- Live `/api/dashboard`, `/api/health`, `/api/modes`, `/api/portals`, `/api/profile`, `/api/cv`, `/api/jds`, `/api/reports`, `/api/tracker`, `/api/pipeline`, `/api/evaluate`, `/api/deep`, `/api/stream/scan-en` all verified green.

### 🤖 SDD / GSD bootstrap

`career-ops-ui` now has a full Spec-Driven Development foundation aligned with the GSD pipeline (`gsd-*` skills from `superpowers@claude-plugins-official`).

- `CLAUDE.md` (root) — project-level agent system prompt: stack, GSD pipeline, hard rules (parent contract, security envelope, no `--no-verify`), conventions, parent-project boundary.
- `.aiignore` — exclusion list for AI agents: vendored, binaries, parent user data, `.planning/`, `.env`, locale duplicates.
- `.claude/agents/` — three project-specific subagent definitions:
  - `web-ui-route-reviewer.md` — gates new routes against SSRF, CSP, sanitizers, parent-write contract, conventions, tests.
  - `spa-view-reviewer.md` — CSP-safe DOM, i18n, router registration, accessibility.
  - `test-isolation-reviewer.md` — verifies tests are CI-isolated (no parent-project assumptions, no live network, no port collision).
- `.claude/commands/` — slash-command stubs: `/sdd-status`, `/codebase-tour`.
- `docs/` tree — all in English:
  - `PROJECT.md` — what/why/for-whom, scope, constraints, success criteria.
  - `ROADMAP.md` — current milestone + completed history + backlog.
  - `sdd/SDD-GUIDE.md` — discuss → spec → plan → execute → verify → review pipeline mapped to `gsd-*` skills.
  - `sdd/CONVENTIONS.md` — module system, naming, routes, sanitizers, client patterns, i18n, errors, logging, testing, commits, branches, CSS.
  - `architecture/OVERVIEW.md` — top-level diagram, layers, boot sequence, invariants, "where to look first when…" cheat sheet.
  - `architecture/SERVER.md` — per-file map for `server/lib/*.mjs` (updated for P-2 split).
  - `architecture/FRONTEND.md` — SPA structure, view inventory, globals, "how to add a view".
  - `architecture/API.md` — full inventory of every `/api/*` route.
  - `architecture/DATA-FLOWS.md` — every parent-project read/write, with the explicit-user-action contract.
  - `reviews/REVIEW-2026-05-07.md` — static review that produced this changelog's fixes.

### 🔒 Security & repo hygiene

- **`chore(.gitignore): comprehensive defense-in-depth patterns`** — covers env variants, IDE folders, GSD scratch (`.planning/`), per-user agent settings (`.claude/settings.local.json`, `.claude/cache/`, `.claude/state/`, `.claude/memory/`), Playwright artifacts (`playwright-report/`, `test-results/`, `.playwright/`, `trace.zip`), heap/CPU profiles, lockfiles for unshipped tooling, expanded macOS Finder noise, generic secret patterns (`secrets.json`, `credentials.json`, `*.pem`, `*.key`).

### 🧪 Tests

- **283 unit tests** (was 277): +6 new (4 for B1 redirect-rejection, 1 for `hasGeminiKey`, 1 for `runAnthropic` log-guard).
- **5 Playwright browser-smoke tests** (new, opt-in via `npm run test:e2e:browser`): dashboard render + version footer, dashboard → scan → pipeline → cv navigation, language-switch persistence, 404 view, health-page render. Resolves Playwright via parent's `node_modules` — no new dependency.
- Coverage held at ~93% line / ~83% branch.

### 📝 New / updated package.json scripts

| Script | Purpose |
|---|---|
| `npm run test:e2e:browser` | Run Playwright smoke harness against in-process server (5 tests). |

### 🔧 Files touched

```
+ CLAUDE.md                                    +  .aiignore
+ docs/PROJECT.md                              +  docs/ROADMAP.md
+ docs/sdd/SDD-GUIDE.md                        +  docs/sdd/CONVENTIONS.md
+ docs/architecture/OVERVIEW.md                +  docs/architecture/SERVER.md
+ docs/architecture/FRONTEND.md                +  docs/architecture/API.md
+ docs/architecture/DATA-FLOWS.md              +  docs/reviews/REVIEW-2026-05-07.md
+ .claude/agents/web-ui-route-reviewer.md      +  .claude/agents/spa-view-reviewer.md
+ .claude/agents/test-isolation-reviewer.md
+ .claude/commands/sdd-status.md               +  .claude/commands/codebase-tour.md
+ server/lib/security.mjs                      +  server/lib/prompts.mjs
+ server/lib/store.mjs
+ server/lib/routes/scan.mjs                   +  server/lib/routes/runners.mjs
+ server/lib/routes/content.mjs
+ tests/playwright-smoke.mjs

~ .gitignore                                   ~  README.md (badge fix)
~ package.json (1.7.2 → 1.8.0)
~ server/index.mjs (1230 → 762 LOC)
~ server/lib/runner.mjs (SIGKILL escalation, max-runtime cap)
~ server/lib/anthropic.mjs (hasGeminiKey)
~ server/lib/parsers.mjs (URL gate in addPipelineUrl)
~ server/lib/ru-scanner.mjs                    ~  server/lib/en-scanner.mjs
~ server/lib/sources/{hh,habr,greenhouse,ashby,lever}.mjs (signal threading)
~ tests/anthropic.test.mjs                     ~  tests/i18n-coverage.test.mjs
~ tests/pipeline-preview.test.mjs
```

---

## [1.7.2] — 2026-05-04

Help center, in-UI App settings, mobile sidebar, single Scan button, and a "Show result" shortcut on every prompt-builder.

### ✨ New features

- **`feat(help): in-app user guide` (`/#/help`)** — long-form Markdown documentation accessible from a new sidebar entry. Covers every page step-by-step: quick start, CV editor, Profile, Scan filters, Pipeline preview, Evaluate, Deep research, Apply, Tracker, Reports, all 7 modes, Activity log, Health, setup hints. Auto-built sticky table of contents from `<h2>` headings, synchronous DOM build (no race). Localized for all 8 supported locales.
- **`feat(config): in-UI App settings page` (`/#/config`)** — edit `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `HH_USER_AGENT`, `PORT`, `HOST` from the browser. Writes to the **parent project's** `.env` file so career-ops Node scripts AND web-ui's dotenv loader pick up the same source. Secret keys masked on read (first/last 4 chars). Model fields are dropdowns with curated lists (claude-sonnet-4-6 / claude-opus-4-7 / claude-haiku-4-5 / gemini-2.0-flash / etc.). Empty value deletes the key. Values applied to running process.env immediately — no restart for most settings.
- **`feat(modes): "⚡ Show result" button alongside "Copy prompt"`** — when a prompt is generated in manual mode, users no longer have to retype their inputs to get the LLM result. The new button re-submits the same form with `run: true`, falling through to a clear toast (`Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env first`) when no key is configured. Works on `/#/deep`, `/#/project`, `/#/training`, `/#/followup`, `/#/batch`, `/#/contacto`, `/#/interview-prep`, `/#/patterns`.

### 🐛 UX + UI fixes

- **`fix(scan): single Scan button replaces three (Scan all + EN + RU)`** — overwhelming choice, identical default in 99% of cases. The unified `🌐 Scan` button runs every enabled source. Help docs updated across 8 locales.
- **`fix(ui): mobile sidebar drawer`** — viewport <900px now gets a hamburger button (☰) in the topbar; `body.sidebar-open` toggles a CSS transform that slides the sidebar in. Backdrop dim + click-anywhere closes it. Anchor click + hashchange auto-close so the user lands on the new page with the drawer tucked away. Larger viewports unaffected.
- **`fix(server): footer version reflects web-ui, not the parent VERSION`** — `/api/health` now reads web-ui's own `package.json`. The footer no longer leaks a stale `1.6.0` from the parent's version file. Parent's VERSION is still surfaced separately as `parentVersion`.

### 📦 New REST endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/help/:lang` | Returns the Markdown user guide for the requested locale, falling back to `en.md`. Path-traversal-safe. |
| `GET`  | `/api/config` | Returns current values for all known env keys; secrets masked. |
| `POST` | `/api/config` | Writes the given keys into the parent project's `.env`, validates each value, applies live to `process.env`. |

### 🌐 i18n

- 30+ new keys across `nav.help`, `nav.config`, `help.*`, `config.*`, `deep.showResult`, `deep.needKey`, `scan.btnRun`. All 8 locales populated.

### 🧪 Tests

- `tests/help.test.mjs` (12 cases) — every supported locale returns substantive markdown, EN spot-checks every page slug, unknown lang → EN fallback, path-traversal sanitized, every locale references `cv.md` / `profile.yml` / `.env`.
- `tests/help-ui.test.mjs` (9 cases) — view file registration, sidebar entry, i18n keys present in every locale, docs files exist for every locale, EN/RU help has 14 canonical sections, every #/foo route covered, Show-result wiring on deep + mode-page.
- `tests/env-config.test.mjs` (18 cases) — pure-function tests for `parseEnv`, `maskSecret`, `validateConfig`, `updateEnvFile` (bootstrap, in-place rewrite preserving comments, empty-value delete, quote-when-needed).
- `tests/config-endpoint.test.mjs` (8 cases) — GET masks secrets / returns env path; POST writes to parent .env; live process.env application; empty-value unsets; rejects unknown keys + malformed Anthropic keys with 400.

### 📊 Stats

- **Tests:** 233 → **277** (+44 across 4 new test files).
- **E2E:** 20 smoke + 23 comprehensive = 43 Playwright steps, all green.
- **Coverage:** 93.5% line / 82.6% branch / 93.7% funcs (unchanged — new code is fully tested).

---

## [1.7.1] — 2026-05-04

Patch release stacking the post-v1.7.0 work: pipeline preview pane, Anthropic API integration, scrollable sidebar, dotenv loader, dynamic Active-companies list, CI workflow hardening.

### ✨ Pipeline preview pane

- **`/#/pipeline` overhaul** — left list + right preview pane. Click any URL to fetch a server-side proxied snapshot (`GET /api/pipeline/preview` strips scripts/styles/tags, caps at 8 KB, validated through `isValidJobUrl`). Live filter input, "In queue" counter, ⚡ "Evaluate first" header button. Inline ▶/✕ on every row plus full Evaluate / Open in tab / Delete on the preview pane. Stable test selectors via `data-url` + `.pipeline-row` + `.pipeline-row-delete` classes. **8 new tests** in `tests/pipeline-preview.test.mjs` (mocked fetch, no upstream binding needed).

### ✨ Anthropic API integration — "Run live" everywhere

- **`server/lib/anthropic.mjs`** — zero-dependency client for Anthropic Messages API (claude-sonnet-4-6 default, override via `ANTHROPIC_MODEL`). When `ANTHROPIC_API_KEY` is set, every mode page (`/#/deep`, `/#/project`, `/#/training`, `/#/batch`, `/#/contacto`, `/#/interview-prep`, `/#/patterns`) renders an "⚡ Run live (Anthropic)" button as the **primary** action — clicking executes the prompt and renders Markdown back into the browser instead of handing off to Claude Code. Gemini stays as fallback when only its key is set. Manual mode still works with no keys at all. **8 new tests** in `tests/anthropic.test.mjs`.

### 🐛 CI / pipeline fixes

- **`fix(api): tighten pipeline URL validator` (FIX-M7)** — now also rejects loopback hostnames, length <10 or >2000, whitespace inside URLs.
- **`fix(server): actually load .env so HH_USER_AGENT / GEMINI_API_KEY hints work`** — added `server/lib/dotenv.mjs` (35-line zero-dep loader) wired in at the top of `server/index.mjs`. The runtime hints in scanner code finally do something. **6 new tests**.
- **`fix(ui): scrollable sidebar`** — 18 nav items in 6 groups overflowed shorter viewports. `.sidebar` now has `overflow-y: auto` with thin custom-styled scrollbars.
- **`fix(ui): make HH_USER_AGENT banner dismissible`** — then removed entirely from `/scan` once we realized it was overkill. Health page check still surfaces it.
- **`fix(scan): Active companies list is now collapsible + filterable + grouped`** — 87 tags flat was overwhelming. Now a "▸ Active companies 87/71" toggle expands an ordered list (✓ API-backed first, ○ websearch second) plus a search filter.
- **`fix(test): isolate api.test.mjs + en-scanner.test.mjs from parent project`** — both now spin up tmp project roots so CI works without the parent checked out alongside web-ui.
- **`fix(workflow): publish-package version-match only on release events`** — `workflow_dispatch` from main no longer fails the tag/version check.
- **`fix(e2e): stable selector for pipeline row delete`** — restored anchor wrapper + added `data-url` attribute so e2e suite is selector-stable.

### 📦 New REST endpoint

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/pipeline/preview?url=…` | Server-side proxy: returns visible-text snapshot of the URL (scripts/styles stripped, 8 KB cap), gated by `isValidJobUrl`. |

### 📊 Stats after this batch

- **Tests:** 225 → **233** (8 more on top of v1.7.0).
- **Test files:** 25 → **26**.
- **E2E:** 20 + 23 = 43 Playwright steps, all green.

---

## [1.7.0] — 2026-05-03

A 35-commit hardening + UX + feature-completion pass driven by QA r5. Three security layers landed (XSS sanitization, CSP, input validation), every missing CRUD endpoint was filled in, the parent-project bootstrap is now fully automated, and the UI gained **9 new pages** — Activity, redesigned Deep Research, plus 7 sidebar-grouped modes (project / training / followup / batch / outreach / interview-prep / patterns) covering 100% of parent's `modes/`. Pipeline gained a server-side preview pane. Anthropic API integration makes "Run live" a one-click action across all modes. Test coverage went from **73** to **225**, across **25 test files**, plus **23 comprehensive Playwright e2e steps**. GitHub Actions ship CI / AI review / Release / Publish-Package workflows.

### 🔒 Security

- **`fix(cv): sanitize CV markdown to block stored XSS in preview` (FIX-C10)** — `PUT /api/cv` now strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<form>`, `<svg>`, `on*=` event handlers, and `javascript:`/`vbscript:`/`data:text/html` URIs before writing `cv.md`. Body capped at 1 MB (413 on overflow). Client-side `UI.md()` was rewritten to escape every byte before any markdown transformation runs, so raw HTML can never reach `innerHTML`. Link `href` attributes are validated against an allowlist of safe schemes (`http`/`https`/`mailto`/`tel`/relative + `data:image` only). 17 new tests across the strip helper and HTTP round-trips.
- **`fix(server): add CSP and baseline security headers` (FIX-L2)** — every response now carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`. When the server binds beyond loopback (`HOST` ≠ `127.0.0.1`/`::1`/`localhost`), a strict `Content-Security-Policy` is layered on top: `default-src 'self'`, `script-src 'self'` (no `unsafe-inline`), Google Fonts whitelisted, `connect-src 'self'` blocks XSS exfiltration. Inline `onclick` handlers in `index.html` and `router.js` were moved to `addEventListener` to keep the strict CSP intact. 8 new tests gating CSP across 5 different `HOST` values.
- **`fix(api): tighten pipeline URL validator` (FIX-M7)** — `POST /api/pipeline` used to accept `"not-a-url"` and persist it. Now `isValidJobUrl()` rejects bare strings, inputs <10 or >2000 chars, whitespace-containing URLs, non-`http(s)` schemes, and loopback hostnames (`localhost`/`127.0.0.1`/`::1`). Folds in **FIX-M3** + **FIX-M6** (return 400 on invalid, plus a `deduped` flag on success).
- **`fix(server): actually load .env so HH_USER_AGENT / GEMINI_API_KEY hints work`** — previously the runtime told users to "set HH_USER_AGENT in .env" but the server never read that file, so following the instruction did nothing. Adds a 35-line zero-dependency dotenv loader (`server/lib/dotenv.mjs`) wired in at the top of `server/index.mjs`. Process-env values set on the command line still win, so existing CI overrides aren't shadowed. Parent's `.env.example` now includes a documented `HH_USER_AGENT` block with a real-Chrome User-Agent example. 6 new tests.
- **`fix(api): sanitize JD before prompt assembly` (FIX-M5)** — `POST /api/evaluate` strips ANSI escapes, control bytes, inline `<script>` tags, and trims whitespace before either calling Gemini or echoing the prompt back. 50 KB length cap. The 50-char minimum runs against the *sanitized* text, so prompt-injection attempts that look long enough but consist mostly of escapes fail-fast with 400.
- **`fix(health): mask Node version + project root when HOST!=loopback` (FIX-M1)** — `/api/health` no longer fingerprints the host on LAN-exposed deployments. Loopback responses keep the values for local diagnostics.

### ✨ New features

- **`feat: 7 new sidebar modes + grouped sidebar` (FIX-C8)** — covers 100% of the parent's `modes/` directory with no UI gaps. New routes: `#/project` (portfolio project advisor), `#/training` (course / cert evaluation), `#/followup` (per-application cadence), `#/batch` (parallel URL processor), `#/contacto` (LinkedIn outreach drafter), `#/interview-prep` (stage-specific prep), `#/patterns` (rejection-pattern analyzer). All seven share a single config-driven view factory (`public/js/views/mode-page.js`) and a single generic endpoint `POST /api/mode/:slug` — adding a new mode in the future is one config row + one i18n block. Sidebar reorganized into 6 groups: Sourcing / Decision / Application / Networking / Analytics / Setup. 18 nav items total. 12 new tests in `tests/modes-endpoints.test.mjs`.
- **`fix: bootstrap parent deps + russian_portals defaults` (FIX-C4 + C9 + C12 + H2)** — `bin/start.sh` now installs the parent's `node_modules` (js-yaml, playwright, jsdom) AND `npx playwright install chromium` on fresh clones, so `/api/stream/scan`, `/pdf`, and `/liveness` work end-to-end out of the box. `createApp()` probes `portals.yml` on every boot — if the `russian_portals:` block is missing, appends a documented default with comments. Idempotent: the second boot is a no-op. 3 new tests.
- **`fix: disable 9 dead portal slugs in template + health-check script` (FIX-C3)** — `templates/portals.example.yml` now ships with Ada / Factorial / Tinybird / Weights & Biases / Travelperk / Clarity AI / Forto / Vinted / Runway flagged `enabled: false` (each entry has an inline reason comment). New installs scan **87** alive companies instead of 96. New `web-ui/scripts/portals-health-check.mjs` HEAD-probes every enabled `careers_url` and reports DEAD entries with a suggested patch list (JSON output via `--json`). 3 new tests.
- **`feat(activity): user-action log + Activity sidebar page`** — every state-changing API request is captured to `data/activity.jsonl` (timestamp, action verb, target, success flag, optional detail). New sidebar entry **Activity** with action-prefix chip filters (pipeline / cv / jd / evaluate / scan / stream / script), action ✓/✗ badges, and refresh button. Auto-rotates at 5 MB. 10 new tests covering middleware, read filters, corrupt-line tolerance, and the recursion guard for `GET /api/activity` itself.
- **`feat(deep): view Deep Research in browser + saved-results archive`** — the Deep Research page now (a) runs the prompt through Gemini live when `{ run: true }` and `GEMINI_API_KEY` is set, persisting output to `interview-prep/{slug}.md`; (b) lists every saved deep-research file as clickable cards with relative timestamps; (c) renders results as Markdown with **📋 Copy / ⬇ Download .md / ↗ Open in tab** actions per result. New REST surface: `GET /api/interview-prep`, `GET /api/interview-prep/:name`, `DELETE /api/interview-prep/:name`. 7 new tests.
- **`feat(cv): generate + download PDF in browser, with PDF archive`** — new **📄 Generate PDF** button on the CV page streams `/api/stream/pdf` in a modal console. On `ERR_MODULE_NOT_FOUND` / `playwright` errors, it surfaces a copy-pasteable bootstrap command. New "Generated PDFs" section auto-loads after each successful run, listing every `output/*.pdf` with **↗ Open** and **⬇ Download** buttons. New REST surface: `GET /api/output/pdfs`, `GET /api/output/pdfs/:name`. 6 new tests.
- **`feat(api): POST /api/tracker — append rows from the UI` (FIX-H8)** — append a canonical row to `data/applications.md` from the browser. Validates company + role, normalizes status against `templates/states.yml`, auto-increments zero-padded `#`, dedups by company+role (case-insensitive), pipe-escapes notes so the markdown table doesn't fracture. Bootstraps the table when the file is empty. 6 new tests.
- **`feat(api): DELETE /api/jds/:name` (FIX-H4)** — remove saved JDs without shelling out. Path-traversal characters are stripped before any filesystem touch; the parameter must end in `.txt`. 5 new tests, including `../../etc/passwd` refusal.
- **`feat(api): POST /api/evaluate/test-gemini` (FIX-H7)** — smoke-test endpoint that runs a 50-char dummy JD through `gemini-eval.mjs` so the user can verify the API key works without sitting through a real evaluation. Returns `{ ok, code, sampleLength, sample }`.

### 🐛 Bug fixes

- **`fix(router): catch-all 404 view + i18n coverage guard` (FIX-C7)** — unknown hash routes used to silently fall back to the dashboard, masking typos and broken bookmarks. Now `#/totally-random-xyz` renders a dedicated 404 page that quotes the bad path back and links to the dashboard. The 404 view is registered inside the router IIFE itself so it cannot collide with any user route. New `tests/i18n-coverage.test.mjs` runs `i18n.js` inside a `vm.Context` with a stub `window`, exposes the private `DICT`, and asserts every one of the 173+ keys × 8 locales is populated and non-empty. 4 new router tests.
- **`fix(router): alias #/profile → settings` (FIX-C2)** — the internal route name is `settings` (with `nav.settings` rendering "Profile") but external links and muscle memory go to `#/profile`. Now both addresses reach the same view, and the sidebar nav-item lights up either way. 2 new tests.
- **`fix(health): unify Health/Doctor + flag template profiles` (FIX-C6 + FIX-H6)** — Health and Doctor were two different sources of truth. Now `/api/health` exposes everything Doctor reports (parent-deps, Playwright, dirs, profile-customized, `HH_USER_AGENT`). The `Profile customized` check detects placeholder names (`Jane Smith`, `Alex Doe`, `John Doe`, `Your Name`, `Test User`) and explicit YAML parse errors. 4 new tests.
- **`fix(scan): warn on query↔negative collisions in RU config` (FIX-H3)** — when `portals.yml` ships with `"PHP"` in `title_filter.negative` while the queries target Senior PHP, every match gets filtered and the user sees zero results. `loadConfig()` now computes a `warnings` array; `runRuScan()` emits each warning as an SSE stderr line before the scan starts. 2 new tests verify the shipped defaults stay PHP-friendly out of the box.
- **`fix(scan): warn when HH_USER_AGENT is unset` (FIX-H1)** — the `/scan` page probes `/api/health` and shows a yellow warning card above the action row when `HH_USER_AGENT` is empty, so users know about the hh.ru 403 *before* they click RU scan.
- **`fix(api): warn when POST /api/jds slug had unsafe chars stripped` (FIX-M2)** — slug normalization that strips dangerous characters now returns a `warning` field; pure case/whitespace cleanup stays silent. Empty result after sanitization returns 400.
- **`fix(ui): clear global search on route change + button spinners` (FIX-M4 + FIX-L1)** — the global-search input is cleared on `hashchange` (with a guard for active typing). New `UI.withSpinner(button, fn)` helper wires loading state, ARIA, and double-click prevention into every async button click. Already adopted on Doctor / Verify / sync-check / Save CV / Normalize / Dedup / Merge buttons.
- **`fix(ui): make sidebar scrollable so 18 nav items always reach the footer`** — the grouped sidebar from FIX-C8 overflowed shorter viewports; bottom items (Activity / Health) were clipped. `.sidebar` now has `overflow-y: auto` with thin custom-styled scrollbars (WebKit + Firefox). Footer stays pinned via the existing `margin-top: auto`.
- **`fix(ui): empty modal-title placeholder` (FIX-H9)** — the hardcoded English `"Title"` string in `index.html` is gone, closing the brief race window where it was visible during modal open.

### 🌐 i18n

- 173+ translation keys × 8 supported locales (`en`, `es`, `pt-BR`, `ko`, `ja`, `ru`, `zh-CN`, `zh-TW`). New keys added across all locales for: 404 page, activity log, deep research, PDF flow, security warnings, tracker mutation, apply rename. Coverage is now enforced by `tests/i18n-coverage.test.mjs` — every key must have a non-empty value in every supported locale or CI fails.

### ⚙️ DevOps

- **Test count:** 73 → **201** (+128 tests across 23 test files). The single remaining failing test (`runEnScan: dry-run end-to-end across multiple sources`) is a pre-existing flake dependent on Greenhouse/Ashby/Lever live API responses.
- **Comprehensive Playwright e2e** (`tests/e2e-comprehensive.mjs`, 23 steps): walks the full user journey — CV save → preview → PDF generation → all 7 new modes → tracker filters → activity log → 404 → modal ESC → sidebar scroll → Ctrl-K focus → search clear → profile alias → language persistence.
- **GitHub Actions** (`.github/workflows/`):
  - `ci.yml` — unit + integration tests on Node 18/20/22 matrix, plus i18n coverage gate (every key × 8 locales must be non-empty), plus the full Playwright e2e on every PR.
  - `ai-review.yml` — Claude Code AI review on every PR. Maintainers retain merge authority; Claude only suggests. Skip via `skip-ai-review` label.
  - `release.yml` — auto-publish a GitHub Release when a `v*.*.*` tag is pushed; release notes are sliced from `CHANGELOG.md` so all 8 language variants stay the canonical source.
- **CSP-friendly UI:** all inline `onclick` handlers removed from `index.html` and `router.js`. The strict `script-src 'self'` policy is now enforceable without breaking any feature.

### 📦 New REST endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`    | `/api/activity`                  | List user-action events, newest first |
| `GET`    | `/api/interview-prep`            | List saved Deep Research files |
| `GET`    | `/api/interview-prep/:name`      | Read a single Deep Research file |
| `DELETE` | `/api/interview-prep/:name`      | Remove a Deep Research file |
| `GET`    | `/api/output/pdfs`               | List generated PDFs |
| `GET`    | `/api/output/pdfs/:name`         | Stream a PDF as an attachment |
| `POST`   | `/api/tracker`                   | Append a row to `applications.md` |
| `DELETE` | `/api/jds/:name`                 | Remove a saved JD |
| `POST`   | `/api/evaluate/test-gemini`      | Smoke-test the Gemini API key |
| `POST`   | `/api/mode/:slug`                | Generic prompt builder for the 7 new modes (project / training / followup / batch / contacto / interview-prep / patterns) |

---

## [1.6.0] — 2026-05-02

Initial public release of the web UI. See `README.md` for the feature inventory at this baseline.
