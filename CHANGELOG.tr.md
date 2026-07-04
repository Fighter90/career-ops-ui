# Changelog (Türkçe)

> Bu changelog v1.85.0'dan başlar — Türkçe yerelleştirmenin eklendiği sürüm. Önceki sürümler için bkz. [CHANGELOG.md](CHANGELOG.md).

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
