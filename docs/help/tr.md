# Yardım — career-ops-ui

<p align="center"><img src="https://raw.githubusercontent.com/Fighter90/career-ops-ui/main/images/providers.png" alt="Works with 18 LLM providers — Anthropic, OpenAI, Gemini, Qwen, OpenRouter, GitHub, DeepSeek, Kimi, MiniMax, Mistral, Ollama and more" width="760"></p>

Uygulamayı başlattığınız andan mülakata çağrılana kadar her sayfanın
eksiksiz bir gezintisi. Aşağıdaki her `##` başlığı, kenar çubuğundaki
bir girdiye veya iş akışının bir aşamasına karşılık gelir. İlk
çalıştırmada baştan sona okuyun; daha sonra belirli bir bölüme yardım
kenar çubuğundaki içindekiler tablosu üzerinden geçin.

> **Hedef kitle:** bu arayüzü bir `career-ops`
> kopyasının içine bırakıp `bash bin/start.sh` komutunu çalıştıran
> herkes. Önceden career-ops bilgisine sahip olduğunuz varsayılmaz.

### career-ops hakkında

[career-ops](https://career-ops.org), herhangi bir yapay zeka
kodlama CLI'sinin (Claude Code, Cursor, Codex, OpenCode, Antigravity CLI, Grok Build CLI, Qwen Code, Kimi, GitHub Copilot CLI, Gemini CLI (legacy) — diğer Claude uyumlu CLI'ler de aynı slash-komut yüzeyi üzerinden çalışır) içinde slash komutları olarak çalışan açık kaynaklı bir iş arama sistemidir. Modelden bağımsızdır.
Her ilanı CV'nizle beş boyut ve bütünsel bir genel puan içeren, 0.0–5.0 puanlık bir
rubrik üzerinden değerlendirir, size özel PDF özgeçmişler oluşturur ve
her başvuruyu makinenizde yerel olarak takip eder.

**Kanonik referans (ilk kurulumda bu sırayla okuyun):**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — sistem, ilkeler ve kavram envanteri.
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — açık pozisyonları keşfedin; Pipeline'ı doldurun.
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — Playwright form-okuma ile eksiksiz başvuru akışı.
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — `batch-runner.sh` aracılığıyla tek seferde 10+ iş tanımını puanlayın.
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — Chromium'u kurun + PDF ve form doldurma için MCP'yi kaydedin.
- [career-ops iş ilanlarını nasıl puanlar](https://career-ops.org/methodology)
  — puanlama metodolojisi: beş boyut ve bütünsel bir genel puan, 4.0 başvuru eşiği ve sistemin
  kesinlikle yapmayı reddettiği şeyler. Kendi dilinizde
  [cvstart.org/methodology](https://cvstart.org/methodology/) adresinde de özetlenmiştir.

**Tanımlayıcı ilkeler** (kaynak:
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

- **Cidden açık kaynak** — MIT, ücretli katman yok, bekleme listesi yok,
  telemetri yok, hesap yok. Sistem, ücretli katmanlar,
  hesaplar veya telemetri olmadan çalışır. Kod katkıları, yayımlanmadan
  önce topluluk incelemesinden geçer.
- **Veri egemenliği** — `cv.md`, `config/profile.yml`, `data/`,
  `reports/`, `interview-prep/` siz açıkça göndermediğiniz sürece
  bilgisayarınızdan asla ayrılmaz. Onu makinenizde yerel olarak
  çalıştırırsınız ve tam veri egemenliğini korursunuz.
- **Yapay zekadan bağımsız mimari** — career-ops bir model içermez.
  Mevcut yapay zeka kodlama CLI'lerinin içinde komutlar olarak çalışır.
  Sağlayıcıları değiştirin (Anthropic ↔ Gemini ↔ OpenAI) ve
  değerlendirme geçmişiniz tutarlı kalır.
- **İnsan kontrolündeki başvurular** — career-ops yanıtları taslak
  olarak hazırlar ve formu açar, ama **Gönder'e siz tıklarsınız**. Sistem asla
  otomatik başvuru yapmaz. Sistem yapı ve değerlendirme sağlar; nihai
  gönderim yetkisi insanda kalır.
- **Yapılandırılmış arama** — çok sayıda başvurunun olduğu aktif ve
  bilinçli bir iş avı için tasarlanmıştır; tek gönderimlik bir araç
  değil, bir öneri motoru değil. Kurulum ~15 dakika sürer ve terminal
  rahatlığı gerektirir.

**career-ops NE DEĞİLDİR** (açık hedef dışı noktalar):

- Otomatik başvurucu değildir. Sizin yerinize form göndermez.
- Bir özgeçmiş yeniden oluşturucu değildir. Her iş tanımına göre
  uyarlar; deneyim uydurmaz.
- Bir LinkedIn optimizasyon aracı değildir. Profiliniz sizin işinizdir.
- SaaS arayüzünün arkasına saklanan bir e-tablo yerine geçmez. Veriler,
  dosya sisteminizde düz markdown olarak durur.

**Temel kavramlar** (tam envanter — career-ops'un dokunduğu her yapı):

| Kavram | Nedir |
|---|---|
| **Mode** | `modes/<slug>.md` altındaki bir prompt şablonu. Yerleşik olanlar: `oferta`, `deep`, `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`, `ofertas`, `auto-pipeline`, `pdf`, `latex`, `scan`, `tracker`. |
| **Archetype** | `config/profile.yml` içindeki bir hedef-rol profili. Rubrik, beceri eşleşmelerini aktif archetype'a göre ağırlıklandırır — **en önemli tek alan**. |
| **Pipeline** | `data/pipeline.md` — değerlendirilmeyi bekleyen iş tanımı URL'lerinin gelen kutusu. |
| **Tracker** | `data/applications.md` — her değerlendirmenin + başvuru durumunun geçmişini tutan GFM tablosu. |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — her iş tanımı için tam A–F değerlendirmesi, başlıkta puan + meşruiyet ile birlikte. |
| **Scan history** | `data/scan-history.tsv` — yalnızca-ekleme günlüğü; taramalar arası çiftlenmeyi önler. |
| **Proof points** | `cv.md`'den çıkarılan STAR+R kanıt blokları; değerlendirme, başvuru yanıtları ve mülakat hazırlığında yeniden kullanılır. |
| **JD store** | `jds/jd-<date>-<ts>.txt` — denetim izi için değerlendirme sırasında kaydedilen birebir iş tanımları. |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — derinlemesine araştırma brifingleri ve tur tek-sayfalıkları. |
| **Batch additions** | `batch/tracker-additions/*.tsv` — `batch-runner.sh` tarafından tracker'a birleştirilmek üzere kuyruğa alınan bekleyen satırlar. |

### career-ops vs career-ops-ui (bu uygulama)

| | career-ops (CLI) | career-ops-ui (bu uygulama) |
|---|---|---|
| Nerede çalışır | Claude Code / Cursor / Codex / OpenCode / Antigravity CLI / Grok Build CLI / Qwen Code / Kimi / GitHub Copilot CLI / Gemini CLI (legacy) içinde | tarayıcınızda `http://127.0.0.1:4317` |
| Yüzey | `/career-ops <mode>` slash komutları | her iş akışı için bir sayfa içeren kenar çubuğu |
| Form doldurma | evet, Playwright MCP aracılığıyla | hayır — kontrol listesini oluşturur, siz CLI'de tamamlarsınız |
| PDF | `generate-pdf.mjs` | `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep` üzerinde `📄 Generate PDF` |
| Veri dosyaları | career-ops-ui ile paylaşılır | career-ops ile paylaşılır |

career-ops-ui **tamamen eklemelerden** ibarettir. `career-ops/`
içindeki hiçbir şey değişmez. Her iki yüzey de aynı `cv.md`,
`config/profile.yml`, `portals.yml`, `data/`, `reports/`,
`interview-prep/`, `modes/` dosyalarını paylaşır.

### Puana göre eylem eşikleri

Bir iş tanımının değerlendirmesi hazır olduğunda, puan bir sonraki
adımın ne olacağını belirler (kanonik tablo,
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

| Puan | Sonraki adım |
|---|---|
| **≥ 4.5** | `/career-ops apply` çalıştırın — yüksek uyum, hemen ilerleyin. |
| **4.0 – 4.4** | Başvurun ya da önce sıcak bir tanışma için `/career-ops contacto`. |
| **3.5 – 3.9** | `/career-ops deep` çalıştırın — karar vermeden önce şirketi / rolü araştırın. |
| **< 3.5** | Belirli bir kişisel nedeniniz yoksa atlayın. |

career-ops-ui'nin `#/dashboard` ve `#/tracker` sayfaları, 4.0 ve
üzerindeki her satırı vurgular; böylece hiçbir şeyi yeniden çalıştırmadan
eylem seçebilirsiniz.

### Harici dokümanlar

Altta yatan career-ops motoru için tam referans
(tarama, değerlendirme rubriği, toplu işleme, başvuru akışı,
Playwright kurulumu)
[career-ops.org/docs](https://career-ops.org/docs) adresindedir:

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. Hızlı başlangıç — "CV oluştur"dan "başvuruldu ve mesaj atıldı"ya tam adım adım

Bu, düğme düğme kanonik başvuru kılavuzudur. İlk seferinde sırayla
takip edin. Her adım tam rotayı, tam düğmeyi ve başarıda ne
göreceğinizi belirtir. Aşağıdaki 2–16. bölümler her aşamaya daha
derinlemesine iner.

**Belgelere sor.** Kenar çubuğundaki (Yardım altında) **Belgelere sor 💬**'u açın ve bir soru yazın — yalnızca dilinizde bu kılavuzdan yanıtlar ve özgeçmişinizi asla okumaz. Aynı asistan her sayfadan bir dokunuş uzağında — bir robot sohbet düğmesi sağ alt köşede (sağdan sola dillerde sol altta) yüzer; yaptığın işi bırakmadan sormak için tıkla.

> **Tek komutla başlatma ve init.** Bir terminalden, arayüze hiç
> dokunmadan tüm önyüklemeyi yapabilirsiniz:
>
> ```bash
> career-ops-ui setup      # install deps → doctor → run the server
> career-ops-ui init       # pick LLM provider + paste its key (echo suppressed)
> career-ops-ui doctor     # re-verify any time (exit 0 ⇔ all required green)
> career-ops-ui run        # just launch the server at http://127.0.0.1:4317
> career-ops-ui open       # open + RAISE the dashboard tab in your browser
> ```
>
> `setup`/`run` sonrasında tarayıcı sekmesi otomatik olarak açılır **ve
> öne getirilir** (v1.43.0); `career-ops-ui open` aynı şeyi talep
> üzerine yapar, böylece pano sekmesini aramak zorunda kalmazsınız.
> `NO_OPEN=1`, headless/CI başlatmalarında otomatik açmayı devre dışı
> bırakır.
>
> `setup` tüm zinciri kendisi çalıştırır. `init`, anahtarı
> `#/config` API-anahtarları sekmesinin kullandığı aynı doğrulanmış yol
> üzerinden üst `career-ops/.env` dosyasına yazar ve
> canlı evaluate / deep / mode / auto-pipeline rotalarının uyduğu
> `LLM_PROVIDER` değerini (`auto` | `claude` | `gemini`) ayarlar. CI
> biçimi:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`.
> Arayüzü mü tercih ediyorsunuz? Aşağıdaki adımlarla devam edin.

### A. Kurulum (bunları bir kez yapın, ~5 dakika)

**career-ops-ui `career-ops/web-ui/` konumunda bulunmalıdır** (üst career-ops projesinin içine yerleştirilmiş). `cv.md`, `config/` ve `data/` dosyalarınızı üst klasörden `../` üzerinden okur ve tek başına çalışmaz. Bir pull sonrasında `career-ops-ui init` bulunamıyorsa, `cd career-ops/web-ui && npm install && npx career-ops-ui init` çalıştırın.

**Adım 1 — Uygulamayı `http://127.0.0.1:4317` adresinde açın.** Çalışmıyorsa,
bir terminalde depo kökünden `bash bin/start.sh` çalıştırın.
Pano (`#/dashboard`) yüklenir.

**Adım 2 — Sol kenar çubuğunda `❤ Health`e tıklayın.** Gerekli her
kontrol yeşil olmalıdır:

- `cv.md`, `config/profile.yml`, `portals.yml` mevcut
- API anahtarı ayarlı (`ANTHROPIC_API_KEY` / `GEMINI_API_KEY`'den en az biri)
- Playwright kurulu (yalnızca Generate PDF kullanacaksanız gereklidir)

Kırmızı bir şey varsa, sayfa düzeltilecek tam dosyayı veya ortam
değişkenini söyler. Health yeşil olana kadar devam etmeyin.

**Adım 3 — Kenar çubuğunda `⚒ App settings`e tıklayın.** **API keys &
runtime** sekmesine gelirsiniz.
- `ANTHROPIC_API_KEY` (tercih edilen — uzun metin puanlaması daha iyi)
  ve/veya `GEMINI_API_KEY` yapıştırın. Anahtarları
  <https://console.anthropic.com/settings/keys> veya
  <https://aistudio.google.com/apikey> adresinden alın.
- **💾 Save**'e tıklayın. Ardından **▶ Test Anthropic** (veya Gemini)'ye
  tıklayın — küçük bir gidiş-geliş, anahtarın çalıştığını doğrular.

**Adım 4 — Aynı sayfada `Profile` sekmesine geçin.** Bu, `config/profile.yml`
için doğrudan YAML düzenleyicisidir. En azından şunları düzenleyin:
- `candidate.full_name` — herhangi bir yer tutucuyu ("Jane Smith")
  gerçek adınızla değiştirin
- `candidate.email`, `linkedin`, `github` — ön yazılarda kullanılır
- `target.roles` — başvuracağınız iş unvanları
- `target.comp_total_min_usd` — minimum toplam ücret; bunun altındaki
  teklifler her değerlendirmenin D bölümünde işaretlenir
- `target.archetypes` — kabul ettiğiniz kariyer örüntüleri (en etkili
  tek alan)

**💾 Save**'e tıklayın. Sunucu YAML'yi doğrular ve kanonik
`# Career-Ops Profile Configuration` başlığını basar.

### B. CV (bunu bir kez yapın, ~10 dakika)

**Adım 5 — Kenar çubuğunda `✎ CV`ye tıklayın.** İki sütun: solda
düzenleyici, sağda canlı önizleme.

**Adım 6 — Düzenleyiciyi doldurmak için bir yol seçin:**
- **Mevcut bir özgeçmişi yükleyin** — **📁 Upload CV**'ye tıklayın,
  `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`'den herhangi
  birini seçin. Sunucu, pandoc veya pdftotext aracılığıyla markdown'a
  dönüştürür, XSS'yi temizler ve sonucu düzenleyiciye bırakır.
  **Dönüşümü gözden geçirin** — özellikle PDF'ler düzen doğruluğunu
  kaybedebilir.
- **Markdown'ı doğrudan yapıştırın** — metin alanı bir markdown
  düzenleyicisidir; sağ bölme, LLM'in (ve gelecekteki işe alım
  görevlinizin) göreceği şeydir.
- **Ton ipuçları:** bir madde = bir metrikle bir başarı. 1500 kelimenin
  altında tutun. Bölümler şu sırayla: Summary, Experience,
  Projects, Education, Skills.

**Adım 7 — `💾 Save`ye tıklayın (CV sayfasının sağ üstü).** Sunucu
temizler (`<script>` / `javascript:` / satır içi işleyiciler çıkarılır)
ve `cv.md`'yi yazar. Bildirim: *"Saved"*.

**Adım 8 (opsiyonel) — `📄 Generate PDF`ye tıklayın.** Üst projede
`generate-pdf.mjs`'yi çalıştırır (Playwright gerekir) ve **yeni PDF
işi bitince** tarayıcınıza otomatik olarak indirilir. Sayfanın
altındaki liste, önceden oluşturulmuş her dosyayı saklar.

### C. Açık pozisyon bulma (tarama başına ~2 dakika)

**Adım 9 — Kenar çubuğunda `🌐 Scan`e tıklayın.** `portals.yml`'nin
önem verdiğiniz kartları listelediğini doğrulayın (bu yardımın 5.
bölümü). **🌐 Scan now** düğmesine basın. Tarayıcı Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (İngilizce kartlar) ve hh.ru / Habr
Career (etkinleştirilmişse Rusça kartlar) üzerinde ilerlerken canlı bir SSE günlüğü akar.

**Adım 10 — Tarama bittiğinde sonuçları gözden geçirin.** Filtrelemek
için herhangi bir şirket etiketine tıklayın; şirketin kariyer
sayfasını yeni bir sekmede açmak için ↗ simgesine tıklayın.
Başlık filtresini geçen her açık pozisyon Pipeline'a kuyruklanır.

### D. Teklifleri puanlama (iş tanımı başına ~30 saniye)

**Adım 11 — Kenar çubuğunda `Pipeline`e tıklayın.** Tarayıcının
kuyruğa aldığı her URL'yi görürsünüz. İş tanımını satır içi önizlemek
için bir girdiye tıklayın.

**Adım 12 — Herhangi bir iş tanımının yanındaki `▶ Evaluate`ye
tıklayın.** Bu, `#/evaluate`e atlar. Bir API anahtarı ayarlıysa canlı
çalışır; ayarlı değilse, kendi LLM'inize yapıştırmanız için elle bir
prompt alırsınız. Canlı mod, A–G bölümleri boyunca CV'nize karşı bir
**0–5 puan** üretir (Role / Company / Compensation / Risk / Stretch /
Cultural fit / Verdict). Kayıt `reports/<date>-<slug>.md`'ye düşer.

**Adım 13 — Kenar çubuğunda `Reports`a tıklayın** ve en son
değerlendirmeyi gözden geçirin. `comp_total_min_usd`'nizin altındaki her
şey D bölümünde kırmızı işaretlenir. `Verdict: pursue` olan her şey
kısa listenizdir.

### E. Kısa listeye alınan şirkete karar verin ve derinlemesine araştırın (~3 dakika)

**Adım 14 — İlerlemeye değer bir açık pozisyon seçin. Kenar çubuğunda
`Deep research`e tıklayın.** Şirket adını ve rolü girin. Model,
7 bölümlük bir şirket brifingi üretir (misyon, son haberler, teknoloji
yığını, işe alım sinyalleri, ücret kıyaslamaları, riskler, önerilen
yaklaşım). Kayıt `interview-prep/<company>-<role>.md`'ye düşer.

### F. Başvuru (başvuru başına ~5 dakika)

**Adım 15 — Kenar çubuğunda `Apply checklist`e tıklayın.** Açık
pozisyon URL'sini + iş tanımını yapıştırın. Yardımcı, adım adım bir
başvuru kontrol listesi oluşturur:
- Size özel ön yazı taslağı (`cv.md`'nizi + `profile.yml`'nizi kullanır)
- İş tanımından yansıtılacak belirli anahtar kelimeler
- Eklenecek dosyalar (CV PDF — adım 8'e bakın)
- Nereye başvurulacağı (kanonik kariyer URL'si, toplayıcı
  yönlendirmeleri değil)
- Hatırlatma: **ASLA otomatik göndermeyin** — nihai inceleme ve
  gönderim her zaman elle yapılır.

**Adım 16 — Kariyer sayfasını yeni bir sekmede açın.** Başvuru kontrol
listesini yapılacaklar listeniz olarak kullanın. Şirketin gerçek formu
üzerinden gönderin. Adım 8'de oluşturduğunuz PDF'yi ekleyin.

**Adım 17 — Gerçek bir insana ulaşın.** **Outreach** modunu açın
(kenar çubuğunda `#/contacto`). Model, adım 14'teki şirket brifingine
göre uyarlanmış kısa bir LinkedIn / e-posta mesajı taslağı hazırlar.
Açılış cümlesini kişiselleştirin (derinlemesine araştırma
brifinginizden belirli bir ayrıntı). Gönderin.

### G. Takip ve izleme (sürekli)

**Adım 18 — Kenar çubuğunda `Tracker`a tıklayın** ve başvuru için bir
satır ekleyin: şirket, rol, puan, durum `Applied`, rapora bağlantı,
derinlemesine araştırma brifingine bağlantı. Tarih otomatik doldurulur.

**Adım 19 — Bir hafta sonra: `Follow-up` modunu açın** (`#/followup`).
Orijinal başvuruya atıfta bulunan nazik bir kontrol e-postası taslağı
hazırlar. Gönderin. Tracker durumunu `Followed up` olarak güncelleyin.

**Adım 20 — Bir mülakat daveti aldığınızda `Interview prep` modunu
çalıştırın** (`#/interview-prep`). Belirli şirket + aşama için (sistem
tasarımı / davranışsal / kodlama) hedefli hazırlık üretir.
Derinlemesine araştırma brifinginden otomatik olarak çeker.

**Adım 21 — Teklifi mi aldınız? Tracker durumunu `Offer` olarak
güncelleyin** ve değerlendirme raporunuzun ücret bölümünü yeniden
inceleyin — minimum kabul rakamınız tam orada.

### TL;DR — kenar çubuğu sırası iş akışıyla eşleşir

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

İşte bu kadar. 21 adım, düğme düğme, sıfırdan teklife.

### Tek tıkla Auto-pipeline (`#/auto`) — 21 adımlık kısayol

Yalnızca belirli bir ilanı hızlıca puanlamak istiyorsanız, elle
gezintiyi atlayın. **Kenar çubuğu → ✨ Auto-pipeline** (veya
panodaki ✨ düğmesi) özel bir ekran açar: iş URL'sini yapıştırın,
**Enter**'a basın ya da **▶ Run full pipeline**'a tıklayın, sunucu
tüm zinciri tek bir gözlemlenebilir geçişte çalıştırsın:

1. **URL doğrulanıyor** — SSRF'ye karşı güvenli kontrol
   (`isValidJobUrl`); loopback / `file:` / özel IP'ler / betik
   karakterlerini reddeder.
2. **İş tanımı getiriliyor** — `safeGet` (DNS'e sabitlenmiş,
   yönlendirme yeniden doğrulamalı) iş tanımını çeker + temizler.
3. **CV'nize karşı değerlendiriliyor** — Anthropic (tercih edilen) →
   Gemini yedeği → anahtar yoksa elle-prompt.
4. **Rapor kaydediliyor** — başlıkta puan + meşruiyet ile birlikte
   `reports/<slug>.md` yazar.
5. **Tracker'a ekleniyor** — `data/applications.md`'ye bir satır ekler.

Canlı geri bildirim dikey bir **adım göstergesidir** (her adım
çalışıyor → tamamlandı / başarısız olarak yanar). Aktif adımda
`aria-current` bulunan sıralı bir listedir ve nazik bir ekran-okuyucu
canlı bölgesi her geçişi duyurur. Başarıda sonuç kartı doğrudan
kaydedilen rapora (**View report · N/5**) ve **tracker**'a derin bağlantı
verir. Başarısız bir adım mesajıyla birlikte kırmızı işaretlenir ve
düğme yeniden etkinleşir; böylece URL'yi düzeltip sayfayı yeniden
yüklemeden tekrar deneyebilirsiniz.

**API anahtarı yok mu?** Pipeline **elle modda** çalışır: 3–5.
adımlar daralır ve yapıştırmaya hazır bir prompt kartı alırsınız (Claude
Code / Anthropic / Gemini içine kopyalayın). Canlı LLM çağrısı yok,
harcama yok.

`#/auto` bağlanabilir: `#/auto?url=<encoded>&go=1` ekranı açar ve
otomatik başlatır. Panodaki ✨ düğmesi ve bu kenar çubuğu girdisi de
buraya gelir (tek tutarlı akış — 1.34 öncesi geçici modal bu sayfaya
terfi ettirildi).
> **CLI (v1.38.0).** Tek komut zinciri çalıştırır: `career-ops-ui setup` (bootstrap → install → start). Bağımsız fiiller: `career-ops-ui doctor` (env/anahtar/araç kontrolü — Health sayfasıyla aynı motor; gerekli herhangi bir başarısızlıkta exit 1), `career-ops-ui run`, `career-ops-ui init` (sağlayıcı+anahtar sihirbazı, v1.39.0).
> **Sağlayıcılar (v1.39.0).** API-anahtarları sekmesi bir `LLM_PROVIDER` seçimi (`auto` = Anthropic→Gemini varsayılan · `claude` · `gemini`) ve bir `OPENAI_API_KEY` alanı (Codex/OpenCode CLI tarafı) ekler. `career-ops-ui init` aynısı için etkileşimli bir sihirbazdır.
>
> **Sağlayıcılar (v1.57.0).** Headless canlı değerlendirme artık **Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes → DeepSeek → GLM (Z.ai) → Kimi (Moonshot) → MiniMax → Mistral → Grok (xAI) → Together → Fireworks → Ollama → BytePlus Ark → Volcengine Ark** kapsar (`auto` sırası; `LLM_PROVIDER` birini sabitler). **OpenRouter** — tek bir `OPENROUTER_API_KEY` 300+ modelin önüne geçer; `OPENROUTER_MODEL` açılır menüsü OpenRouter'ın canlı kataloğunu yükler (sunucu tarafı proxy, seçilmiş çevrimdışı yedek). Ayrıca düzeltildi: sonda satır sonu / çevresinde boşluk ile yapıştırılan anahtarlar artık doğrulamadan önce kırpılır, böylece `/#/config` hiçbir sağlayıcı için artık "validation failed" göstermez.



---

## 2. Uygulama ayarları ve API anahtarları (`#/config`)

> **v1.55 → v1.56'da yeni.** Hiçbir LLM anahtarı ayarlı **değilken**, her ekranda kırmızı bir afiş ⚡ Run-live'ın elle-prompt modunda olduğunu açıklar ve buraya bağlanır; bir anahtar ayarlandığında, aktif sağlayıcıyı adlandıran sessiz bir çipe dönüşür. Herhangi bir ⚡ Run-live düğmesinden önce (`#/auto`, `#/evaluate`, `#/deep`, modlar) dürüst bir maliyet tahmini gösterilir (ör. "Estimated cost: OpenAI gpt-5-codex · ~$0.04/eval" veya elle modda API-maliyeti-yok notu). `#/scan` ikincil filtreleri bir **Advanced filters** açılırının arkasına gizler; `#/tracker` tıklanabilir huni çipleri + opsiyonel sunucu tarafı sayfalama ekler; `#/pipeline` 1000 satırın ötesinde sanallaştırır.

**Yapay zeka CLI araçları.** **Yapay zeka CLI araçları** sekmesi, sunucuda hangi ajan CLI'larının (Claude Code, Cursor, Codex, Gemini, OpenCode, Copilot, Qwen, Antigravity, Kimi CLI, Grok Build CLI) kurulu olduğunu gösterir — çalıştırmadan salt okunur bir PATH taraması. **Görünüm → Şirket logolarını göster** (varsayılan kapalı), her şirketin favicon'unu kendi alan adından alıp tarama tablosunda gösterir (asla üçüncü taraf servis değil).

Üç sekme:

1. **API keys & runtime** — üst projenin `.env` dosyası üzerinde
   yapılandırılmış alan formu (career-ops Node betiklerinin başlangıçta
   okuduğu aynı dosya). Gruplanmış: API keys / Runtime / Regional
   sources. Sekme ayrıca sağlayıcı başına model seçicilerini de sunar —
   `OPENAI_MODEL` (OpenAI/Codex), `ANTHROPIC_MODEL` ve `GEMINI_MODEL`
   ile birlikte.
2. **Profile** — `config/profile.yml` üzerinde **alan-alan form**
   (web-ui 1.32.0). Kaydetme, dosyaya **birleştirir** — archetype'larınız,
   proof point'leriniz ve tüm özel anahtarlarınız dokunulmadan korunur.
3. **Modes** — `modes/_profile.md` için **yapılandırılmış alan-formu**
   (web-ui 1.54.3), belgelenmiş şemadan türetilmiştir. Liste türündeki
   bölümler — **Target Roles / Adaptive Framing / Comp Targets** —
   tekrarlanabilir satır-öğesi girişleri olarak (satır ekle/kaldır)
   işlenir; düz metin bölümler — **Exit Narrative / Location Policy** —
   etiketli metin alanları olarak işlenir; bilinmeyen veya liste-olmayan
   herhangi bir bölüm, etiketli birebir bir metin alanına geri döner.
   Kaydetme yine **bölüme göre birleştirir** — önsöz, dokunulmamış
   bölümler ve tüm özel bölümler bayt bayt korunur. Tam-dosya
   düzenlemeleri için — bölüm ekleme/kaldırma veya önsözü düzenleme —
   bir *Advanced: raw markdown* açılırı kalır.

Herhangi bir sekmedeki bir kaydetme anında yayılır — sunucu yeniden başlatması gerekmez.

**LLM sağlayıcınızı ayarlama (adım adım).** Web arayüzünün ⚡ canlı değerlendirmesi *headless* çalışır ve tek bir API anahtarı kullanır. "OR" mantığıyla çalışır — bunlardan **herhangi birini** ayarlayın ve öylece çalışır; birkaçı ayarlıysa, `auto` şu sırayla tercih eder: Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes → DeepSeek → GLM (Z.ai) → Kimi (Moonshot) → MiniMax → Mistral → Grok (xAI) → Together → Fireworks → Ollama → BytePlus Ark → Volcengine Ark. (career-ops'un kendisi CLI'den bağımsızdır — onu Claude Code, Cursor, Codex, Gemini, OpenCode, Antigravity, Grok Build, Qwen, Copilot veya Kimi içinde de çalıştırırsınız; bu, bu headless anahtardan ayrıdır.)

1. `#/config` → **API keys & runtime** sekmesini açın.
2. Sağlayıcınızı **`LLM_PROVIDER`** içinde seçin: `auto` (hangi anahtar ayarlıysa onu kullan) ya da `claude` / `gemini` / `openai` / `qwen` ile birini zorlayın.
3. Seçtiğiniz sağlayıcı için anahtarı + modeli doldurun:
   - **Anthropic** — `ANTHROPIC_API_KEY` ayarlayın (console.anthropic.com), opsiyonel olarak `ANTHROPIC_MODEL` (varsayılan `claude-sonnet-4-6`).
   - **Gemini** — `GEMINI_API_KEY` ayarlayın (aistudio.google.com/apikey), opsiyonel olarak `GEMINI_MODEL` (varsayılan `gemini-3.6-flash`).
   - **OpenAI** — `OPENAI_API_KEY` ayarlayın (platform.openai.com), opsiyonel olarak `OPENAI_MODEL` (varsayılan `gpt-5-codex`).
   - **Qwen** — `QWEN_API_KEY` ayarlayın (Alibaba Model Studio / DashScope, dashscope.console.aliyun.com), opsiyonel olarak `QWEN_MODEL` (varsayılan `qwen-max`). Anakara-CN uç noktası için ham `.env` içinde `QWEN_BASE_URL` ayarlayın.
4. **Save**'e tıklayın. Anahtarlar üst projenin `.env` dosyasına yazılır; değişiklik anında geçerli olur — sunucu yeniden başlatması gerekmez.
5. `#/evaluate` üzerinde doğrulayın: bir iş URL'si/açıklaması yapıştırın ve **⚡ Run live**'a basın. Sonuç başlığı hangi sağlayıcının çalıştığını gösterir (`anthropic` / `gemini` / `openai` / `qwen`). Hiçbir yerde anahtar ayarlı değil → bunun yerine kopyala-yapıştır elle promptu alırsınız.

Sırlar kaydedildikten sonra maskelenir ve asla günlüklenmez. Model-id alanları (`*_MODEL`) sır değildir.

### Profile sekmesi (alan formu — v1.32.0)

v1.32.0'dan önce bu sekme, her ayarın tek bir farksızlaşmış yığında
yaşadığı tek bir ham-YAML metin alanıydı. Artık üç daraltılabilir
bölümde gruplanmış alanlardan oluşan yapılandırılmış bir formdur:

- **Candidate** — Tam ad (zorunlu), E-posta, Telefon, Konum,
  LinkedIn, GitHub, Portföy URL'si, X / Twitter.
- **Narrative** — Başlık, Çıkış hikayesi.
- **Compensation** — Hedef aralık, Para birimi, Çekilme minimumu,
  Konum esnekliği.
- **Yapılandırılmış dizi düzenleyicileri** (web-ui 1.35.0) — liste
  biçimindeki alanlar için satır ekle/kaldır düzenleyicileri, böylece
  bunlar bile artık ham YAML gerektirmez: **Target roles** +
  **Superpowers** (string listeleri); **Archetypes** (name / level / fit
  satırları); **Proof points** (name / url / hero-metric satırları).
  Boş satırlar düşürülür; boşaltılan bir liste anahtarı temizce kaldırır.
  Aynı birleştir-değiştirme garantisi — dokunmadığınız her dizi
  dokunulmadan hayatta kalır.

Kaydetmenin güvenli olma şekli:

- Form yalnızca 14 modellenmiş skaler yolu
  `{ fields: { "candidate.full_name": … } }` olarak gönderir. Sunucu,
  **mevcut `config/profile.yml`'yi okur, yalnızca o yaprakları
  ayarlar/temizler ve tüm nesneyi yeniden serileştirir** — böylece
  formun modellemediği iç içe diziler (`target_roles.archetypes`,
  `narrative.proof_points`, `narrative.superpowers`) ve elle
  eklediğiniz herhangi bir özel anahtar **gidiş-dönüşten dokunulmadan
  çıkar**. Bir alanı temizlemek o anahtarı temizce kaldırır (`phone: ""`
  kalıntısı olmaz).
- Doğrulama yine tam bir ad gerektirir; `# Career-Ops Profile
  Configuration` başlığı otomatik olarak basılır.
- Bir ödünleşme: bir alan-formu kaydetmesi **YAML'yi yeniden
  serileştirir, dolayısıyla satır içi `#` yorumları kaybolur**. Yorumları
  korumak veya iç içe dizileri düzenlemek için, sekmenin altındaki
  **Advanced: edit raw YAML** açılırını kullanın — bu, 1.32 öncesi
  tam-dosya düzenleyicisidir, değişmemiştir (kaydetmede tüm dosyayı
  değiştirir).
- `#/profile`'daki salt-okunur özet, görsel eşdeğeridir.

### Tanınan anahtarlar

| Anahtar | Ne işe yarar | Nereden alınır |
|---|---|---|
| `ANTHROPIC_API_KEY` | Canlı Anthropic SDK çağrılarını etkinleştirir. Hem Anthropic hem Gemini ayarlıyken tercih edilir — iş tanımı puanlaması ve derinlemesine araştırma için daha iyi uzun-metin yapılandırılmış çıktı. | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | Varsayılan `claude-sonnet-4-6`'yı geçersiz kılın. Daha zor akıl yürütme için `claude-opus-4-7`, ucuz-ve-hızlı için `claude-haiku-4-5-20251001` deneyin. | — |
| `GEMINI_API_KEY` | Anthropic anahtarı yokken yedek. `oferta` modu için `gemini-eval.mjs` tarafından kullanılır. Düşük hacim için ücretsiz katman yeterlidir. | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | Varsayılan Gemini modelini geçersiz kılın. | — |
| `(server uses default UA)` | `hh.ru` taramalarını Rusya dışından çalıştırırken gereklidir (API, düz User-Agent'lara 403 döndürür). <https://dev.hh.ru/admin> adresinde bir uygulama kaydedin ve onun UA dizesini kullanın. | dev.hh.ru |
| `PORT` | Express bağlanma portu. Varsayılan 4317. | — |
| `HOST` | Bağlanma adresi. Varsayılan `127.0.0.1`. `0.0.0.0` ayarlamak arayüzü yerel ağa açar — **henüz kimlik doğrulama kapısı yok**, Production-readiness belgesine bakın. | — |

### Davranış

- **Okuma** (`GET /api/config`) tanınan her anahtarı döndürür. Gizli
  anahtarlar (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) **maskelenir** —
  `sk-ant•••••••a1b2` görürsünüz, asla tam değeri değil.
- **Kaydetme** (`POST /api/config`) her değeri doğrular, `<parent>/.env`'e
  yazar ve çalışan sürece anında uygular. Yeniden başlatma gerekmez.
- **Boş değer, anahtarı siler.** Bir Rus IP'sini / VPN'ini kullanmayı
  bırakmak istiyorsanız kullanışlıdır.

### Duman-testi düğmeleri

Kaydettikten sonra **▶ Test Anthropic** veya **▶ Test Gemini**'ye
tıklayın — her ikisi de küçük bir prompt gönderir (≤256 token çıktı),
böylece anahtarın doğru bağlandığını onaylarken neredeyse hiçbir şey
harcamazsınız. Başarıda ~200 karakterlik bir örnek döndürür.

### Kurulum doktoru — eksik bir CV veya profili yakala

`#/config` üzerindeki **Kurulum doktoru** sekmesi, `cv.md` ve `config/profile.yml` dosyalarının gerçekten doldurulmuş olup olmadığını salt okunur olarak denetler ve komut istemi dosyalarınızda (`modes/_shared.md`, `modes/_writing.md`, `batch/batch-prompt.md`) kalan örnek/yer tutucu verileri ya da sabit kodlanmış metrikleri saptayınca uyarır. Sonuçları **hatalar** (işlem hattının ihtiyaç duyduğu bir şey eksik, örneğin `cv.md` yok) ve **uyarılar** (hâlâ örnek veri var, çok kısa görünen bir CV, şüpheli bir metrik) olarak ayırır. Hiçbir şey yazmaz ve hiçbir yere göndermez — yalnızca okur ve raporlar. Bu dosyaları düzenledikten sonra **Yeniden denetle**'ye basın. Üst proje olmadan bağımsız bir kurulumda sekme, bunun yerine soluk bir "kullanılamıyor" satırı gösterir.

---

## 3. Profile (`#/profile` — `#/settings` olarak da erişilebilir)

`config/profile.yml`'nin salt-okunur özet kart görünümü. **Düzenlemek
için**, **App settings → Profile sekmesine** (`#/config` → Profile)
gidin — web-ui 1.32.0'dan bu yana bu, ham-YAML yığını değil, alan-alan
bir formdur (Candidate / Narrative / Compensation). Kaydetmeler aynı
dosyaya birleştirir; bu sayfa yeniden yüklemede yeniden ayrıştırır.

En çok önem taşıyan alanlar:

- `candidate.full_name` — her promptta kullanılır. Gerçek bir şey
  taramadan önce **şablondaki `Jane Smith`'i değiştirin**, aksi halde
  oluşturulan ön yazılarınız yer tutucu adla gönderilir.
- `candidate.email`, `linkedin`, `github` — ön yazı oluşturmada ve
  başvuru kontrol listesinde başvurulur.
- `target.roles` — kabul edilen iş unvanları. Tarayıcının pozitif
  filtresi bunu örtük olarak kullanır (`portals.yml::title_filter`
  aracılığıyla).
- `target.comp_total_min_usd` — minimum toplam ücret. Her
  değerlendirmenin D bölümü, bunun altındaki teklifleri işaretler.
- `target.archetypes` — *en önemli alan*. Bunlar kabul ettiğiniz
  kariyer örüntüleridir (ör. `Tech-Lead-Backend`,
  `Founding-Engineer`, `Data-Platform`). Her iş tanımı bunlara karşı
  eşleştirilir ve en uygun archetype rapor başlığına düşer.

Health sayfası, `full_name` bilinen bir yer tutucu adla eşleştiği
sürece başarısız olan bir **Profile customized** kontrolünü yüzeye
çıkarır.

---

## 4. CV (`#/cv`)

Her değerlendirme, derinlemesine araştırma ve ön yazı için tek doğruluk
kaynağı. Üst proje kökündeki `cv.md`'de bulunur.

### Düzenleme seçenekleri

- **Doğrudan yapıştırın** — soldaki metin alanı bir markdown
  düzenleyicisidir. Sağ bölme, LLM'in (ve gelecekteki işe alım
  görevlinizin) gördüğünü yansıtır.
- **📁 Upload CV** — şu biçimlerden herhangi birinde yerel bir dosya
  seçin, sunucu sizin için markdown'a dönüştürsün:
  - **Metin biçimleri** — `.md`, `.markdown`, `.txt`, `.html`, `.htm`
    olduğu gibi geçirilir (HTML, pandoc → GFM markdown ile gider).
  - **Office biçimleri** — `.docx`, `.doc`, `.odt`, `.rtf` **pandoc**
    aracılığıyla dönüştürülür (macOS'ta `brew install pandoc`,
    Linux'ta `apt install pandoc`).
  - **PDF** — `.pdf`, Poppler'daki **pdftotext** ile çıkarılır
    (`brew install poppler` / `apt install poppler-utils`).
  - Dönüştürülen markdown düzenleyiciye düşer; kalıcı kılmak için
    **💾 Save**'e tıklayın. Sonuç temizlenir (yapıştırmadaki aynı XSS
    temizliği).
  - Sert sınır: yükleme başına **10 MB**. Daha büyük dosyalar → 413.
- **LinkedIn'den** — en kolay yol: üst projede Claude Code'u açın,
  `/career-ops` çalıştırın, LinkedIn URL'nizi yapıştırın ve
  `extract my CV from this and write it to cv.md` isteyin.

### Neler temizlenir

Sunucu tarafında, `/api/cv`'ye yapılan her PUT `stripDangerousMarkdown`'dan geçer:

- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<style>`,
  `<form>` etiketleri — tamamen kaldırılır.
- Satır içi olay işleyicileri (`onclick=`, `onerror=`, vb.) — çıkarılır.
- `javascript:`, `vbscript:`, `data:text/html` URI şemaları — etkisiz hale getirilir.

Yukarıdakilerden herhangi biri kaldırıldığında yanıt `sanitized: true`
içerir, böylece kaynağın kötü niyetli bir şeyi olup olmadığını
bilirsiniz.

Maksimum gövde boyutu: 1 MB. Daha büyük her şey 413 döndürür.

### Diğer düğmeler

- **sync-check** — üst projede `cv-sync-check.mjs`'yi çalıştırır.
  Tutarsızlıkları işaretler: CV'nizde listelenen ama
  `data/applications.md` archetype'larında olmayan bir proje, vb.
- **📄 Generate PDF** — `generate-pdf.mjs`'yi akıtır. Çıktı
  `output/*.pdf`'e düşer. Playwright gerektirir (Health sayfası, üst
  projenin `node_modules`'ında kurulu olup olmadığını gösterir). Üretim
  bittiğinde, **en yeni** PDF varsayılan İndirilenler klasörünüze
  otomatik indirilir; sayfa üzerindeki liste önceden oluşturulmuş her
  dosyayı saklar.

### Ton / biçim ipuçları

- Bir madde = bir metrikle bir başarı.
  *"Reduced p99 latency by 38%"*, her değerlendirme rubriği için
  *"improved performance"*'tan üstündür.
- Bölümler şu sırayla: **Summary** (3–5 satır), **Experience**
  (tersten kronolojik), **Projects** (en fazla 5), **Education**,
  **Skills** (çiftlenmemiş, terim çorbası olmadan).
- 1500 kelimenin altında tutun. Puanlama rubriği yoğun bilgi kullanır;
  dağınık bir CV, gürültü nedeniyle cezalandırılır.

---

## 5. Portallar ve kaynaklar (`portals.yml`)

Tarayıcı yapılandırması, üst kökteki `portals.yml`'de bulunur. Üç
bölüm önemlidir. SPA'nın üç bölümü (aşağıda), kanonik
career-ops.org şemasıyla
([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))
1:1 eşleşir.

> **Kısayol:** `#/portals` URL'si artık doğrudan **App settings**'e
> çözümlenir ve (bir bölgesel kaynak yapılandırıldığında) **Regional
> sources** grubuna atlar — böylece yer imine eklenmiş veya yazılmış bir
> `#/portals` bağlantısı artık 404 vermez (v1.42.0).

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

Taranan bir açık pozisyon, başlığı **en az bir pozitif** anahtar kelime
İÇERDİĞİNDE VE **negatif** anahtar kelimelerin **hiçbirini**
içermediğinde geçer. İkisini de ayarlayın. Anahtar kelimeler büyük/küçük
harfe duyarlı olmayan alt dizelerdir.

`seniority_boost` üçüncü title-filter anahtarıdır. Burada listelenen
anahtar kelimeler hiçbir şeyi filtrelemez — eşleşen işleri sonuçlarda
daha yükseğe iterler, böylece bir "Senior Backend Engineer" bir
"Engineer"'ın üstüne çıkar. Varsayılan: `["Senior", "Staff", "Lead"]`.
Hedef rollerinizin nasıl adlandırıldığıyla eşleşecek şekilde ayarlayın.

Netlik için 3–5 pozitif anahtar kelimeyle başlayın; sonra genişletin.

### `location_filter` (opsiyonel — web-ui 1.33.0, üst #570)

```yaml
location_filter:
  allow:
    - "Remote"
    - "United States"
    - "Atlanta"
  block:
    - "India"
    - "London"
    - "Germany"
```

Taranan açık pozisyonları **konum** dizesine göre filtreler
(büyük/küçük harfe duyarlı olmayan alt dize), hem ATS taraması hem de
bölgesel tarama tarafından uygulanır. Kanonik career-ops `scan.mjs`
ile aynı olan semantik:

- `location_filter` anahtarı yok → her konum geçer (varsayılan).
- **Boş/eksik** konumu olan bir açık pozisyon → geçer (eksik veri
  cezalandırılmaz).
- Bir `block` anahtar kelime eşleşmesi → **reddedilir** (block, allow'a
  göre önceliklidir).
- `allow` boş → geçer (block onu zaten temizledi).
- `allow` boş değil → **en az bir** anahtar kelimeyle eşleşmelidir.

`portals.yml`'de üst düzey anahtar (`title_filter`'ın kardeşi,
`russian_portals` altında iç içe değil). Başlık filtresini geçen ama
alamayacağınız bir bölgede olan işleri düşürmek için kullanın.

Netlik için 3–5 pozitif anahtar kelimeyle başlayın; sonra genişletin.

**`content_filter` (opsiyonel — web-ui 1.75.0, üst #974).** Aynı
`positive` / `negative` anahtar kelime listelerine sahip, ancak konumu
yerine bir ilanın **açıklama / snippet** metnine karşı eşleştirilen bir
`location_filter` üst düzey kardeşi:

```yaml
content_filter:
  positive: ["python", "machine learning"]
  negative: ["security clearance", "on-site only"]
```

`location_filter` ile aynı semantik: anahtar yok → her şey geçer;
**boş/eksik** açıklaması olan bir ilan geçer (eksik veri
cezalandırılmaz); bir `negative` eşleşmesi → reddedilir; `positive` boş
→ geçer; `positive` boş değil → en az bir anahtar kelimeyle eşleşmelidir
(büyük/küçük harfe duyarlı olmayan alt dize). Hem ATS hem bölgesel
taramalar tarafından uygulanır. Yalnızca bir açıklama/snippet gönderen
kaynaklar (ör. RSS) etkilenir — diğer her ilan geçer — böylece
etkinleştirmek, gövde taşımayan kaynaklardan asla sessizce satır
düşürmez. Başlığı geçen ama gövdesi bir engelleyici ortaya koyan bir
ilanı düşürmek için kullanın.

**`trust_filter` (opsiyonel — web-ui 1.76.0, üst career-ops v1.13.0).** Taranan
her ilanı bir güven puanı (0–100), bir seviye (`high` / `medium` /
`low`) ve bayraklarla **açıklayan** (asla düşürmeyen) üst düzey bir blok.
Mevcut ve devre dışı bırakılmadıkça kapalıdır:

```yaml
trust_filter:
  enabled: true
  suspicious_domains: ["bit.ly", "tinyurl.com"]   # optional — overrides the default shortener list
  ats_allowlist: ["greenhouse.io", "ashbyhq.com"] # optional — overrides the default ATS host allowlist
```

Sezgiseller: eksik başvuru URL'si (−40), geçersiz URL (−50), şüpheli
kısaltıcı alan adı (−25), şirket↔alan adı uyuşmazlığı (−15, bilinen ATS
sunucuları için atlanır). `high`'ın altındaki ilanlar, `#/scan`
tablosunda dilden bağımsız bir **⚠ score** rozeti alır (ipucu, bayrak
kodlarını listeler), böylece hiçbir şey filtrelenmeden düşük güvenli
satırları gözden geçirebilirsiniz. 1.76 öncesi davranışı (açıklama yok,
rozet yok) korumak için bloğu tamamen dışarıda bırakın.

### `search_queries`

```yaml
search_queries:
  - name: "Greenhouse — Rails Engineer"
    query: 'site:job-boards.greenhouse.io "Rails Engineer" OR "Ruby on Rails" remote'
    enabled: true
  - name: "Ashby — Senior Backend"
    query: 'site:jobs.ashbyhq.com "Senior Backend" remote'
    enabled: false
```

`search_queries`, yapay zeka destekli B Seçeneği taramasını
(`/career-ops scan`, Claude Code / Cursor / Codex içinde) yönlendirir.
Bunlar süreç-içi `npm run scan` tarafından ÇALIŞTIRILMAZ (o yalnızca
genel kart API'lerine gider). Henüz `tracked_companies`'te olmayan
şirketlerdeki rolleri keşfetmek istediğinizde kullanın. Bir girdiyi
çalıştırmadan tutmak için `enabled: false` ayarlayın.

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

Girdi başına zorunlu alanlar: `name` ve `careers_url`. Opsiyonel:
`api` (açık Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
uç noktası), girdiyi silmeden dahil/hariç tutmak için `enabled: true|false`.
ATS tarayıcısı, ATS'yi URL örüntüsünden tespit eder
(`job-boards.greenhouse.io/<slug>` → Greenhouse, vb.) ve her
şirketin genel boards-api'sini doğrudan getirir. Tanınabilir bir ATS'si
olmayan şirketler atlanır (`/#/scan` üzerindeki **Active Companies**
kartı bunları `○` ile gri gösterir).

**Kiracı başına ATS sağlayıcıları (v1.76.0 — üst career-ops v1.13.0 paritesi).** Altı
ATS daha doğrudan `careers_url`'den (veya açık bir `api:`'den) otomatik
tespit edilir, `provider:` gerekmez:

```yaml
tracked_companies:
  - { name: Acme,    enabled: true, careers_url: https://acme.bamboohr.com }          # BambooHR
  - { name: Foo,     enabled: true, careers_url: https://foo.breezy.hr }              # Breezy HR
  - { name: Bar,     enabled: true, careers_url: https://bar.jobs.personio.de }       # Personio (XML feed)
  - { name: Baz,     enabled: true, careers_url: https://baz.recruitee.com }          # Recruitee
  - { name: SolidCo, enabled: true, careers_url: https://solid.jobs/public-api/offers/it }  # SolidJobs
  # Comeet needs the full careers-api URL (uid + token aren't in the branded page):
  - { name: ComeetCo, enabled: true, api: https://www.comeet.co/careers-api/2.0/company/<uid>/positions?token=<token> }
```

Her biri sunucusunu bir sabitlenmiş regex + `redirect:'error'` ile
sabitler (SSRF'ye karşı güvenli). Daha kapsamlı kopyala-yapıştır
girdileri için `docs/portals-examples.md`'ye bakın.

### `rss` (RSS / Atom kartları)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

Bir RSS/Atom beslemesi yayınlayan herhangi bir iş kartına (LaraJobs, WeWorkRemotely, RemoteOK, golangprojects, …) tarayıcıyı yöneltmek için `provider: rss` artı bir `rss:` (veya `feed_url:`) anahtarı içeren bir girdi ekleyin — **kod değişikliği yok**. RSS adaptörü her `<item>`'ı ayrıştırır (CDATA + HTML varlıkları, başlıklar/şirketler etiket-arındırılmış), onu bir işe normalleştirir ve ATS kaynaklarıyla aynı `title_filter` / `location_filter` + çiftleme-önleme + pipeline'a-ekleme akışını çalıştırır. **RSS** ardından `#/scan` filtre açılır menüsünde seçilebilir bir kaynak olarak görünür. (web-ui v1.62.x)


### `telegram_channels` (herkese açık Telegram iş kanalları)

```yaml
telegram_channels:
  enabled: true
  max_posts: 100          # default cap per channel (hard cap 300)
  channels:
    - { name: "PHP jobs", channel: rabotaphp }
    - { name: "Salary PM", channel: salary_pm, max_posts: 50 }
```

Herhangi bir **herkese açık** Telegram kanalını buraya yazarak tarayın — bot jetonu yok, API anahtarı yok. Her kanal, sunucuda üretilmiş düz HTML olan `https://t.me/s/<kanal>` önizlemesinden okunur. `channel:` her yazımı kabul eder (`rabotaphp`, `@rabotaphp` ya da tam bir `t.me/…` bağlantısı); `max_posts:` kaç yeni gönderinin okunacağını sınırlar (varsayılan 100, katı üst sınır 300). Kanallar `tracked_companies` yerine kendi üst düzey bloğunda durur; çünkü bir kanal işveren değildir ve tespit edilecek bir kariyer adresi yoktur.

**Kanal gönderisi düzyazıdır, iş kaydı değil** — yapılandırılmış alan yoktur. Kaynak başlığı ilk anlamlı satırdan alır, şirket / konum / ücreti yalnızca açık etiketlerden (`Компания:`, `Локация:`) okur ve tüm metni açıklamada bırakır. Gerçek ilanları reklam ve derlemelerden ayırmak `title_filter`'ınızın işidir. Gizli ya da var olmayan bir kanal «ilan yok» olarak değil, **hata** olarak bildirilir. Ardından **Telegram**, `#/scan` filtresinde seçilebilir bir kaynak olarak görünür. (web-ui v1.228.0)


### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # or just one
  area: 113                 # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries`, hh.ru ve Habr Career üzerindeki açık pozisyon başlıklarına
karşı büyük/küçük harfe duyarlı olmayan alt dize eşleşmeleridir.
**Negatif listeyle çakışmaya dikkat edin** — `"Senior PHP"`, `queries`
içindeyse ama `"php"` `title_filter.negative` içinde biterse, tarama
sıfır sonuç döndürür ve konsol sizi çakışma konusunda uyarır.


### Rus portallarını yapılandırma — ayrıntılı kurulum kılavuzu

v1.29.0, 5 Rusça adaptörü gönderir. İkisi varsayılan UA'dan başka bir şey gerektirmez (`habr-career`, HTML kazıma; `trudvsem`, hükümet açık-veri API'si — anahtar yok, IP kapısı yok). İkisi teknik kartların HTML kazımalarıdır (`getmatch`, `geekjob` — yine anahtar yok). Biri, **App settings → API keys & runtime** aracılığıyla bir `HH_USER_AGENT` env değişkeni ayarlamadığınız sürece (veya sunucuyu bir Rus IP'sinden / VPN çıkış düğümünden çalıştırmadığınız sürece) Rusya dışı IP'lerden 403 verebilen kanonik hh.ru API'sidir.

#### Kaynak envanteri

| Kaynak anahtarı | Görünen etiket | Tür | Kimlik doğrulama | Coğrafi kısıtlama |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | opsiyonel `HH_USER_AGENT` | RU olmayan IP'ler 403 verebilir |
| `habr` | Habr Career | HTML | yok | yok |
| `trudvsem` | Trudvsem | JSON API (açık-veri) | yok | yok |
| `getmatch` | GetMatch | HTML | yok | yok |
| `geekjob` | GeekJob | HTML | yok | yok |

#### Adım 1 — `portals.yml`'yi açın

Dosya, üst `career-ops/` kökünde bulunur (`web-ui/` içinde DEĞİL). Henüz yoksa, üst projeyle gönderilen örneği kopyalayın:

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### Adım 2 — 5 kaynağın tümünü etkinleştirin

Taramak istediğiniz her kaynağı listelemek için `russian_portals` bloğunu ekleyin veya güncelleyin. Dizideki sıra önemsizdir; tarayıcı onları kayıt sırasına göre gezer.

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]
  area: 113                  # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50               # how many vacancies per query per source
  only_remote: false         # set true to keep only remote postings
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Backend Senior"
    - "Тимлид PHP"
```

#### Adım 3 — Sorguları ve filtreleri ayarlayın

`queries`, tarayıcının her kaynağı aramak için kullandığı dizelerdir. Her sorgu her kaynakta bir kez çalışır — yani 4 sorgu × 5 kaynak = tarama başına 20 çağrı. Tarama süresini bir dakikanın altında tutmak için listeyi odaklı tutun (3–7 sorgu). `area`, hh.ru bölge kodudur (diğer kaynaklar bunu göz ardı eder). `per_page`, her kaynağın sorgu başına kaç açık pozisyon döndürdüğünü sınırlar. `only_remote: true`, her sonucu adaptör düzeyinde yalnızca-uzaktan olacak şekilde filtreler (sonuç tablosunda hâlâ ayrı bir Remote çipi vardır).

#### Sık karşılaşılan tuzaklar

**Negatif-liste çakışması.** Bir sorgudan bir kelime (`"php"`, `"senior"`) `title_filter.negative`'de de görünüyorsa, her sonuç siz görmeden önce filtrelenir. Tarayıcı, tarama zamanında bir stderr çakışma uyarısı yayar — `⚠ config: query "Senior PHP" contains "php" which is in the negative list` satırını arayın. Çakışan kelimeyi `negative`'den kaldırarak düzeltin:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### Bir kaynağı geçici olarak devre dışı bırakma

Bir kaynağı verisini silmeden devre dışı bırakmak için, anahtarını `sources`'tan çıkarmanız yeterli:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### Kurulumu doğrulama

`portals.yml`'yi kaydettikten sonra:

```bash
# 1. Save portals.yml.
# 2. In the SPA, switch to #/scan.
# 3. Click 🌐 Scan now.
# 4. Watch the SSE log for the per-source line per query:
#       "Senior PHP"
#         hh.ru    18
#         habr     21
#         trudvsem  3
#         getmatch  0
#         geekjob   2
#    A value of 0 is normal for some queries — it just means that
#    source had no matches. A "geo-blocked" or "timeout" line means
#    the adapter reached the site but couldn't read results.
```

### CLI önyükleme akışı ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Kanonik career-ops kurulumu (üst kökten bir kez çalıştırın):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

Bütün önyükleme bundan ibaret. Üç bölümü (`title_filter`,
`tracked_companies`, `search_queries`, opsiyonel `russian_portals`)
düzenleyin, kaydedin ve taramaya hazırsınız.

### SPA önyükleme davranışı

İlk çalıştırmada sunucu, `portals.yml`'ye eksikse belgelenmiş bir
`russian_portals:` bloğu ekler — idempotent (ikinci önyükleme bir
no-op'tur çünkü birebir `russian_portals:` satırı artık oradadır).
İngilizce bölümler otomatik enjekte EDİLMEZ; bunlar yukarıdaki kanonik
önyüklemeye göre kopyaladığınız `templates/portals.example.yml`'den
gelir.

**Yeniden başvuru bekleme süresi (v1.84.0).** Taramanın, zaten
başvurduğunuz rolleri yeniden yüzeye çıkarmasını durdurmak için
`config/profile.yml`'ye bir `re_apply_windows:` bloğu ekleyin. Şirket
başına `last_apply_date` (`YYYY-MM-DD`), `same_role_days` (bekleme
süresi uzunluğu), `applied_to:` (başvurduğunuz rol unvanlarının bir
listesi) ve opsiyonel bir `cross_role_bucket` (alt çizgili anahtar
kelimeler, ör. `backend_em`) ayarlarsınız. `today`, `last_apply_date +
same_role_days`'den önce olduğu sürece, o şirketteki başlığı
`applied_to` ile (alt dize) veya kova anahtar kelimeleriyle eşleşen her
taranan rol **atlanır** — tarama günlüğü `Cooldown skipped: N` gösterir
ve o satırlar asla sonuç tablosuna veya `pipeline.md`'ye ulaşmaz. Şirket
eşleştirme noktalama-duyarsız ve kelime-sınırı farkındadır (`Acme Inc`,
`Acme, Inc.` ile eşleşir). `re_apply_windows:` anahtarı yok → bekleme
süresi yok (varsayılan).

**`pipeline.md`'de ücret (v1.84.0).** Taranan bir teklif bir maaş
taşıdığında, `data/pipeline.md`'ye opsiyonel bir sondaki sütun olarak
eklenir — `url | salary` — URL'nin yanında. URL, çiftleme-önleme
anahtarı olarak kalır (maaş sütunu, pipeline geri okunduğunda çıkarılır),
hücre bir satır veya bir elektronik tablo formülü enjekte edemeyeceği
şekilde temizlenir ve mevcut yalın-URL pipeline'ları değişmeden çalışmaya
devam eder.

### Bir şirketin ATS panosunu keşfet

`#/portals` üstünde bir **ATS panosu keşfet** kutusu var. Bir şirket adı yazın (örneğin "Stripe"), uygulama o ad altında herkese açık bir iş panosu için Greenhouse, Ashby ve Lever'ı yoklar — salt okunur, yapay zeka yok, tarayıcı yok. Panosu olan *ve* şu anda en az bir açık ilan listeleyen her sağlayıcı için; sağlayıcıyı, kariyer URL'sini ve açık ilan sayısını gösteren bir eşleşme alırsınız. **İzlenenlere ekle**'ye basın; o pano `portals.yml` dosyanızdaki `tracked_companies:` listesine eklenir, böylece tarayıcı bir sonraki taramadan itibaren bu şirketi izlemeye başlar. Yinelenenler saptanır ("Zaten izleniyor" görürsünüz) ve yalnızca bilinen ATS ana bilgisayarları eklenebilir — rastgele URL'ler reddedilir. Yalnızca Greenhouse, Ashby ve Lever yoklanır; başka bir portaldaki ya da şu an ilanı olmayan bir şirket eşleşme göstermez.

---

## 6. Health (`#/health`)

Her kurulum kapısı, OK / OPTIONAL / FAIL rozetleriyle. Herhangi bir
"çalışmıyor" sorunu bildirmeden önce bunu okuyun.

**Yapay zeka kullanımı ve maliyeti.** **AI kullanımı** sayfası (💳, Sağlık'ın yanında) canlı AI üretimlerinin jetonlarını sağlayıcı başına 24s/7g/30g/tümü boyunca gösterir; düzenlenebilir bir fiyat tablosundan tahmini USD maliyetiyle (asla faturalanmaz). Kompakt bir **KULLANIM** göstergesi de her sayfada sol kenar çubuğunun altına sabitlenir — aynı 24s/7g/30g jeton toplamları ve tahmini 24 saatlik maliyet, canlı yenilenir; menü her zaman onun üstünde açık kalır ve başlığına tıklamak onu katlar.

### Gerekli kontroller (sistem bunlar olmadan çalışamaz)

- `Node version` ≥ 18 — sunucu yerel `fetch` ve `node:test` kullanır.
- `Project root` — o `CAREER_OPS_ROOT`'un (env veya otomatik-tespit)
  mevcut olması.
- `cv.md`, `config/profile.yml`, `portals.yml`,
  `data/applications.md`, `data/pipeline.md`, `modes/oferta.md`.

### Opsiyonel kontroller (yalnızca uyarı)

- `Profile customized` — `candidate.full_name` şablon yer tutucusu
  değil.
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — `.env`'de ayarlı.
- `(server uses default UA)` — yalnızca hh.ru'yu Rusya dışından
  tararsanız önemlidir.
- `Playwright (parent node_modules)` — PDF üretimi ve
  `check-liveness.mjs` için gerekli.
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`
  ile kurun.
- `Parent project dependencies` — eksikse
  `cd $CAREER_OPS_ROOT && npm install`.
- `data/`, `reports/`, `output/`, `jds/` dizinleri — ilk yazmada
  otomatik oluşturulur.

Sunucu loopback'in ötesine açıldığında (`HOST=0.0.0.0`), meraklı bir
komşu kurulumunuzun parmak izini alamasın diye mutlak yollar ve tam
Node sürümü yanıtta `"hidden"` ile değiştirilir.

### Çalıştırma düğmeleri

- **▶ Doctor**, `node doctor.mjs` çalıştırır ve çıktıyı bir modalda gösterir.
- **▶ Verify pipeline**, `node verify-pipeline.mjs` çalıştırır.

---

## 7. Scan (`#/scan`)

Tarayıcı, etkin her kartı gezer, geçmişinize karşı çiftleme-önlemesi
yapar ve isabetleri `data/last-scan.json` ile `data/pipeline.md`'ye
yazar.

**Ara + Hariç tut.** Ara kutusu virgülleri VEYA olarak ele alır ("bulunacak roller"); yeni Hariç tut alanı virgülle ayrılmış bir kelimeyle eşleşen satırları gizler. İkisi de aramalarınızla kaydedilir.

### Tek tıkla tarama (SPA)

**🌐 Scan**, etkin her kaynağı tek bir taramada çalıştırır:

- `tracked_companies`'teki tanınabilir ATS URL'sine sahip her şirket için
  Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (ATS taraması).
- Birine katılan her `tracked_companies` girdisi için v1.75.0 toplayıcıları: RemoteOK / Remotive / Working Nomads (kart-geneli uzaktan beslemeler, `provider: <slug>`) ve IBM / Arbeitsagentur / Glints / Jobstreet · SEEK (yapılandırma odaklı, girdi başına `<provider>:` bloğu).
- `russian_portals`'taki her sorgu için hh.ru API + Habr Career + Trudvsem + GetMatch + GeekJob.

**İki aşama, tek tık (v1.29.2).** Tek 🌐 Scan düğmesi HEM ATS taramasını HEM DE bölgesel taramayı tek bir SSE akışında yürütür. Günlükte sırayla iki aşama başlığı görürsünüz:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — EN ATS kartları.
2. `▶ Regional scan (hh.ru + Habr Career)` — kayıttan 5 RU kaynağı.

Her aşama bir `✓ done · NEW=N` özetiyle biter. Yalnızca ATS aşamasını görüyorsanız, kurulumunuz v1.29.2 öncesi bir yapıdadır — güncelleyin. v1.29.2 öncesinde SSE istemcisi ilk `done` olayında kapanırdı ve bölgesel aşama sessizce düşürülürdü (`tests/scan-stream-multi-phase.test.mjs` regresyon ağıdır).

Tarama çalışırken canlı SSE günlüğü sağ bölmeye akar. Durdurmak için
**Stop**'a tıklayın (ya da sadece başka yere gidin) — sunucu, uçuştaki
HTTPS isteklerini `AbortController` aracılığıyla iptal eder.

### Sonuçları filtreleme

Günlüğün altında, sonuç tablosu `data/last-scan.json`'dan satırları işler.

> **v1.76.0 — sonuç sınırı yok.** Önceki yapılar bölge başına en fazla 2000
> eşleşen satır (`MAX_STORED_RESULTS`) saklardı ve büyük bir taramanın
> kuyruğunu sessizce gizlerdi. O sınır **kalktı**: eşleşen her ilan saklanır
> ve tablo bunlar arasında sayfalar (sayfa başına 200 — tablonun altındaki
> sayfalayıcı kontrollerini kullanın). Hiçbir şey düşmez; sadece sayfa
> çevirirsiniz.

> **v1.78.1 — canlı otomatik yenileme.** Sonuç tablosu artık bir tarama
> çalışırken ve bittikten hemen sonra bir kez daha otomatik olarak güncellenir
> — elle yeniden yükleme veya sayfa değişimi gerekmez. Önbellek her taramanın
> başında sıfırlanır ve yeniden doldurulur.

> **v1.85.0 — Kaynak başına maks. ve kaynak karantinası.** Scan düğmesinin
> yanındaki **Max per source** alanı, her kartın kaç iş katkısını sınırlar
> (boş/0 = sınırsız, varsayılan) — devasa bir kart aksi halde baskın olacağında
> kullanışlıdır. Ayrıca, kalıcı bir **404 / 410** döndüren herhangi bir kaynak
> `data/scan-quarantine.json`'a yazılır ve sonraki taramalarda atlanır
> (kendi kendini iyileştirir: 14 gün sonra yeniden denenir), böylece ölü
> slug'lar günlüğü doldurmayı bırakır. `portals.yml`'de
> `scan_quarantine: false` ile devre dışı bırakın.

Filtreler:

- **Serbest metin** — başlık / şirkete karşı alt dize eşleşmesi.
- **Source** açılır menüsü — Arbeitsagentur / Ashby / BambooHR / Breezy HR / Comeet / GeekJob / Glints / Greenhouse / GetMatch / Habr Career / hh.ru / IBM / Jobstreet · SEEK / Lever / Personio / Recruitee / RemoteOK / Remotive / RSS / SmartRecruiters / SolidJobs / Teamtailor / Trudvsem / We Work Remotely / Workable / Workday / Working Nomads (`GET /api/scan/sources`'tan otomatik doldurulur).
- **Remote / Hybrid / Onsite** açılır menüsü.
- **Country** açılır menüsü (v1.78.0) — mevcut sonuçlar boyunca tespit edilen ülkelerden doldurulan bir coğrafya filtresi, her biri bayrak emojisi ve bir sayımla gösterilir (ör. `🇩🇪 Germany (12)`). Yalnızca o ülkeye bağlı rolleri tutmak için birini seçin. Tespit, bir ilanın serbest-metin konumunu (ülke adları/takma adları + ~100 büyük iş piyasası şehri) bir ülkeye eşler; muhafazakârdır ve asla tahmin etmez, böylece konumu çözülemeyen bir ilan — ya da saf bir "Remote" ilanı — **All countries** altında kalır. Ülkeye bağlı *ve* uzaktan roller bulmak için çalışma-türü açılır menüsüyle birleştirin.
- **Posted within** açılır menüsü (v1.80.0) — istemci tarafı bir yaş filtresi (Last 24 hours / 7 days / 30 days). `pubDate`'i daha eski olan satırlar gizlenir; **listelenmiş tarihi olmayan satırlar geçer** (eksik veri cezalandırılmaz).
- **★ Favorites** (v1.80.0) — bir işi yıldızlamak için herhangi bir satırdaki ☆'a tıklayın (URL'ye göre `localStorage`'da saklanır); yalnızca yıldızlı satırları göstermek için filtre panelinde **★ Favorites**'ı işaretleyin. Yıldızlar taramalar ve yeniden yüklemeler boyunca korunur.
- **Saved searches** (v1.80.0) — filtrelerin üstündeki çubuk: mevcut filtre kümesini adlandırın ve **💾 Save** yapın, ardından açılır menüden yeniden uygulayın veya **🗑 Delete** ile silin. `localStorage`'da saklanır; bozuk/düzenlenmiş bir değer temizce boşa sıfırlanır.
- **Stack chips** (PHP / Go / Backend / Senior / …) — `Skills.detectTech`
  ve `Skills.detectLevel` tarafından satır başına otomatik-tespit edilir.
  Çoklu-seçim kesişimi — `PHP + Senior` seçmek HER İKİSİNE sahip
  satırları gösterir.
- **Dynamic chips** — statik yığın olanların altında — başlıklardan en
  sık geçen ilk-25 büyük harfli belirteç, böylece arayüz backend
  mühendisi sözcük dağarcığına kilitlenmek yerine gerçekten taradığınız
  rollere (pazarlama, tasarım, finans…) uyum sağlar.

### Active Companies kartı

`portals.yml`'deki her şirketi tarama durumuyla listeleyen
daraltılabilir bir kart:

- ✓ yeşil etiket — doğrudan API desteği (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday).
- ○ gri etiket — web-arama promptuna geri dönüş (API eşleşmesi yok).

**Şirket adına tıklayın** → yukarıdaki sonuç filtresini o adla doldurur.
**↗ simgesine tıklayın** → şirketin `careers_url`'sini yeni bir sekmede açar.

### CLI tarama akışı ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

CLI tarafından taramanın iki yolu (ikisi de URL'leri SPA'nın okuduğu
aynı `data/pipeline.md`'ye bırakır):

**Seçenek A — doğrudan betik (~30 sn, sıfır yapay zeka token'ı):**

```bash
npm run scan                          # all Greenhouse/Ashby/Lever boards
npm run scan -- --dry-run             # preview without persisting
npm run scan -- --company Anthropic   # narrow to one tracked company
```

Yalnızca Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (tanınabilir ATS URL'leri) için çalışır.
Yapay zeka token'ı tüketmez — genel boards API'lerine doğrudan gider.

**Seçenek B — yapay zeka destekli tarayıcı taraması:**

```
/career-ops scan
```

Claude Code / Cursor / Codex / OpenCode / Antigravity CLI / Grok Build CLI / Qwen Code / Kimi / GitHub Copilot CLI (Gemini CLI legacy) içinde. Model token'ları
kullanır. Her `tracked_companies` sayfasını doğrudan ziyaret eder ve
API-olmayan kartları keşfedebilir (kariyer sayfaları, özel ATS,
bölgesel portallar). Daha yavaş ama daha geniş. İşe aldığını bildiğiniz
bir hedef için ATS taraması hiçbir şey döndürmediğinde kullanışlıdır.

**Çıktı (her iki yol)** — yeni iş tanımı URL'leri `data/pipeline.md`'ye
eklenir, ziyaret edilen her URL `data/scan-history.tsv`'ye günlüklenir
(gelecekteki tüm taramalarda çiftleme-önleme), özet yazdırılır: taranan
şirketler · bulunan işler · başlığa göre filtrelenen · atlanan çiftler ·
eklenen yeni teklifler.

**Puana göre eylem eşikleri** (`/career-ops pipeline` yeni URL'leri
toplu puanladıktan sonra uygulayın):

| Puan | Önerilen sonraki adım |
|---|---|
| **≥ 4.5** | `/career-ops apply` — yüksek uyum, hemen ilerleyin |
| **4.0 – 4.4** | başvurun ya da sıcak tanışma için `/career-ops contacto` |
| **3.5 – 3.9** | `/career-ops deep` — önce araştırın |
| **< 3.5** | belirli bir kişisel nedeniniz yoksa atlayın |

SPA'nın `#/dashboard` ve `#/tracker` sayfaları, 4.0 ve üzerindeki her
satırı vurgular, böylece hiçbir şeyi yeniden çalıştırmadan eylem
seçebilirsiniz.

### Takip komutları

Puanladıktan sonra kanonik takipler şunlardır:

- `/career-ops apply` — Başvuruyu size özel yanıtlarla doldurun
- `/career-ops contacto` — LinkedIn / e-posta ulaşımı taslağı hazırlayın
- `/career-ops deep` — Şirketi / rolü derinlemesine araştırın
- `/career-ops tracker` — Pipeline durumunu görüntüleyin

---
### hh.ru — web sitesinden taranır (Temmuz 2026'dan beri Rus IP'si gerekir)

hh.ru, Habr Career gibi halka açık arama sitesi (`hh.ru/search/vacancy`) okunarak taranır — anahtar ve yapılandırma gerekmez. **Ancak Temmuz 2026'dan beri hh.ru, Rusya dışındaki IP'lere HTTP 451 (bölgesel yasal engel) döndürüyor**; tarama yalnızca Rus IP'sinden çalışır — sunucuyu Rusya'dan ya da Rus çıkış düğümlü bir VPN üzerinden çalıştırın. İlk 451'de (veya anti-bot 403'te) tarayıcı hh.ru'yu çalıştırmanın geri kalanı için devre dışı bırakır ve bunu günlüğe yazar; diğer Rus kaynakları normal şekilde tamamlanır. JSON API (`api.hh.ru`) bilerek *kullanılmaz*: IP veya User-Agent fark etmeksizin her programatik istemciye `403 forbidden` döndürür.

Doğru *görünen* bir ağdan bile hh.ru, çıkış IP'sini VPN/proxy olarak işaretleyebilir (her datacenter/hosting IP'si sayılır) ve taramayı, **sıfır** ilanla HTTP 200 dönen `/vpncheeck` ara sayfasına (“VPN мешает работе сайта”) 302 ile yönlendirebilir. Tarayıcı bu yönlendirmeyi algılar, hh.ru'yu çalıştırmanın geri kalanı için devre dışı bırakır ve bunu log'a yazar. Çözüm ağ tarafındadır: trafiğin gerçekten konut tipi bir IP üzerinden çıktığından emin olun — sistem genelindeki bir VPN veya proxy, tarayıcıdaki anahtar kapalıyken bile çoğu zaman etkin kalır (gerçek çıkış IP'nizi ör. api.ipify.org üzerinden kontrol edin).

## 8. Pipeline (`#/pipeline`)

Değerlendirilmeyi bekleyen URL'lerin gelen kutusu. `data/pipeline.md`'de
bulunur.

**Genel bakış şeridi.** Üstteki kompakt bir şerit pipeline'ınızı bir bakışta gösterir — gelen kutusunda kaç URL, kaçı izleniyor ve Applied/Responded/Interview/Offer sayıları, her biri izleyiciye bağlanır.

### URL ekleme

Üç yol:

- Girdiye bir URL yazın / yapıştırın + **+ Add**'e tıklayın.
- **Üst çubuk global aramasını** kullanın (rozeti **Enter** okur):
  herhangi bir `http(s)://…` bağlantısı yapıştırın ve auto-pipeline'ı
  açmak için **Enter**'a basın; başka herhangi bir metin yazın ve
  **Enter**, o terim önceden doldurulmuş olarak `#/scan`'e atlar
  (v1.78.1). Ctrl/Cmd+K, tarayıcının izin verdiği yerde kutuyu hâlâ
  odaklar. Marka **logosu** panoya döner.
- Bir Tarama çalıştırın (yukarıya bakın) — yeni isabetler otomatik
  olarak pipeline'a gider.

Her URL, sunucu tarafında `isValidJobUrl()`'den geçer. Loopback
(`localhost`, `127.0.0.1`), `file://`, `javascript:`, IP değişmezleri ve
şablon karakterleri (`<`, `>`, `"`) içeren dizeler hepsi 400 verir.

### Sunucu tarafı önizleme bölmesi

Sağda bir önizleme yüklemek için herhangi bir pipeline satırına
tıklayın. Çoğu ATS kartı CORS başlıkları göndermez, dolayısıyla tarayıcı
bunları doğrudan getiremez; sunucu isteği proxy'ler, `<script>` /
`<style>` / HTML etiketlerini çıkarır ve en fazla 8 KB düz metin
döndürür.

Önizleme proxy'si, yönlendirmeleri **atlama başına SSRF doğrulaması** ile
elle gezer — her `Location` başlığı yeniden `isValidJobUrl()`'den geçer,
böylece düşman bir kart sizi loopback / özel IP / `file://`'e
sektiremez. 3 atlamada sınırlı, 15 saniyelik zaman aşımı.

### Satır eylemleri

- **▶** — URL önceden doldurulmuş olarak `#/evaluate?url=…`'e atlar.
- **✕** — URL'yi `data/pipeline.md`'den kaldırır.

### Sağ üst düğmeler

- **⚡ Evaluate first** — Evaluate sayfasında kuyruğa alınmış ilk URL'yi
  açar, puanlamaya hazır.
- **Scan** — daha fazla URL isterseniz tarayıcıya geri döner.

---

## 9. Evaluate (`#/evaluate`)

Tek bir iş tanımını `cv.md` ve `config/profile.yml`'ye karşı puanlar.
`modes/oferta.md`'ye göre yapılandırılmış bir A–G değerlendirmesi artı
bir 0–5 puanı döndürür.

### Girdi

İş tanımını metin alanına yapıştırın veya `?url=<href>` ile
`#/pipeline`'dan buraya gelin — sayfa, URL'yi pipeline önizlemeleri için
kullanılan aynı SSRF'ye karşı güvenli proxy üzerinden getirir ve metin
alanını önceden doldurur.

İş tanımını denetim izi için `jds/jd-<date>-<ts>.txt`'ye kalıcı kılmak
için **💾 Save JD**'ye tıklayın (veya API çağrısında `save: true` geçin
— aynı etki).

### Yedek zinciri

1. **Anthropic** — `ANTHROPIC_API_KEY` ayarlıysa tercih edilir. Sunucu,
   prompttan önce `cv.md`, `config/profile.yml`, `modes/_shared.md` ve
   `modes/oferta.md`'yi bir `<project_context>` bloğuna paketler (her
   dosya 16 KB ile sınırlı, tam prompt 200 KB ile yumuşak sınırlı).
   Gerekçelendirilmiş markdown'ı doğrudan sayfaya döndürür.
2. **Gemini** — yalnızca `GEMINI_API_KEY` ayarlıyken. Sunucu, iş
   tanımını geçici bir dosya olarak `gemini-eval.mjs`'yi başlatır.
   Ücretsiz-katman model (`gemini-3.6-flash`) rutin puanlama için
   yeterlidir.
3. **Manual** — anahtar ayarlı değil. Sayfa, Claude Code, ChatGPT veya
   başka herhangi bir LLM'e yapıştırabileceğiniz tamamen biçimlendirilmiş
   bir prompt döndürür.

### Çıktı bölümleri (kanonik career-ops.org A-F)

> **v1.15.0 yeniden hizalaması.** Blok harfleri artık
> [kanonik career-ops.org şemasıyla](https://career-ops.org/docs)
> eşleşir. v1.15 öncesi raporlar A–G kullanırdı (`C=Risks`, `F=Verdict`,
> `G=Legitimacy` ile); bunları geriye dönük uyumluluk için hâlâ olduğu
> gibi işleriz, ancak yeni raporlar aşağıdaki kanonik semantikle A–F
> yayar. Puan ve Legitimacy artık rapor başlığında yaşar
> (`score: 4.2/5`, `legitimacy: High|Medium|Low`).

A. **Role Summary** — 3 maddelik özet (riskler satır içi belirtilir).
B. **CV Match** — vurulan ilk 3 beceri + eksik ilk 3.
C. **Strategy** — öneri: şimdi başvur / önce contacto / önce deep /
atla. v1.15 öncesi `Risks`'ti.
D. **Compensation** — `target.comp_total_min_usd`'nize (eski) veya
`compensation.target_range`'e (kanonik) göre.
E. **Personalization** — öne çıkarılacak açı, archetype başına
çerçeveleme, ön yazı / ulaşımda bahsedilecek kancalar. v1.15 öncesi
`Application Strategy`'ydi.
F. **STAR stories** — role uyarlanmış, yapıştırmaya hazır 1–3 S-T-A-R
bloğu. v1.15 öncesi `Verdict`'ti (ham puan); puan artık `legitimacy` ile
birlikte rapor başlığında görünür.

### Raporu kaydetme

Markdown'ı `reports/<date>-<company>-<role>.md`'ye kalıcı kılmak için
**💾 Save report**'a tıklayın (veya API çağrısındaki save geçişini
kullanın). Raporun ayrıştırılmış başlığı (Score / Legitimacy / URL)
**Reports** sayfasında ve **Dashboard**'da görünür.

### 10+ iş tanımınız olduğunda toplu değerlendirme

Tek bir iş tanımı için bu `#/evaluate` sayfası doğru araçtır.
Pipeline'da kuyruğa alınmış 10+ URL için, iş tanımı başına
tıklama-geçişi pratik değildir — §14'ün **Batch evaluate** alt
bölümüne atlayın (üst projeden `./batch/batch-runner.sh` çalıştırarak),
gece boyunca işlesin, ardından sonuçlar için `#/reports` / `#/tracker`'a
geri gelin. Tam akış:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

---

## 10. Reports (`#/reports`)

Kaydedilen her değerlendirmeye göz atın. Kartlar başlık, tarih,
meşruiyet bayrağı ve puan gösterir (renk kodlu: yeşil ≥ 4.0, sarı ≥ 3.0,
altında kırmızı).

Tam markdown'ı okumak için bir karta tıklayın. Sayfalama: sayfa başına
12; kontroller altta.

Tek rapor görünümünde ayrıca şunlar vardır:

- **← All reports** — ızgaraya geri.
- **🔗 Open JD** — orijinal iş ilanını yeni bir sekmede açar.

### Bir raporu PDF olarak dışa aktarma

Kaydedilmiş bir raporu açın ve **📄 Generate PDF**'e tıklayın. Bu, üst
projede `generate-pdf.mjs` çalıştırır ve dosyayı `output/*.pdf` konumuna
yazar (Playwright gerekir; Sağlık sayfası kurulu olup olmadığını gösterir).
Hiçbir yere gönderilmez: bir başvuruya eklemeden önce PDF'i gözden geçirin.

---

## 11. Tracker (`#/tracker`)

CRM. Başvuru başına bir satır; `data/applications.md`'de bir
GitHub-Flavored Markdown tablosu olarak bulunur.

### Durum akışı

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Hired` / `Rejected` / `Discarded` / `SKIP`.

`Hired` (v1.118.0) mutlu son durumudur — teklif kabul edildi. Takipçi bunu kutlama rozetiyle işaretler ve «iş bulundu» banner'ıyla karşılar.

**Aşama-sekmesi panosu (v1.131.0).** Tablonun üstünde bir **aşama-sekmesi şeridi** huni boyunca gezinmenizi sağlar: bir **Tümü** sekmesi artı her kanonik durum için bir sekme, her biri canlı bir tüm-geçmiş sayısı gösterir — **sıfır sayılı aşamalar dahil**, böylece tüm hat her zaman tek bakışta görünür. Bir aşamaya tıklamak tabloyu ona filtreler; tekrar tıklamak **Tümü**'ne döner. Sekmeler (ve sayıların yerelleştirilmiş/eski durum takma adlarını katlaması) `GET /api/tracker/stages`'ten gelir, bu da sunucunun kullandığı aynı `templates/states.yml`'i okur — böylece sekme kümesi, sayfada sabit kodlanmış bir liste olmadan üst projenin durum sözlüğüyle otomatik olarak senkronize kalır. Search, puan filtresi, sıralanabilir sütunlar ve satır başına rapor/PDF/meşruiyet değişmeden kalır; logolar etkinleştirildiğinde her satırın şirketi bir marka işareti gösterir.

Durum beyaz listesi sunucu tarafında zorlanır; bir `POST /api/tracker`'da
başka herhangi bir şey göndermek `Evaluated`'a varsayılır. Kanonik
`Evaluated → Applied` geçişi, `/career-ops apply`'ın sonunda
`Submitted.` onayladığınızda otomatiktir (§14'e bakın).

### Sütun düzeni

| Sütun | Nedir |
|---|---|
| `#` | Otomatik-numaralı, sıfırla-doldurulmuş (`001`, `002`, …). |
| `Date` | ISO tarih (`YYYY-MM-DD`). Bugüne varsayılır. |
| `Company` | Serbest metin. **Borular (`\|`) ve satır sonları otomatik olarak kaçırılır.** |
| `Role` | Aynı. |
| `Score` | `N/5` biçimi (ör. `4.2/5`). |
| `Status` | Beyaz listeli enum. |
| `PDF` | Bu satır için `generate-pdf.mjs` başarılı olduğunda ✅. |
| `Report` | Eşleşen `reports/*.md`'ye markdown bağlantısı. |
| `Notes` | Serbest metin, 200 karakterle sınırlı. |

### Filtreler

- **Status** açılır menüsü.
- **Score** açılır menüsü — `≥ 4.0` (yüksek), `≥ 3.0` (orta), `< 3.0` (düşük).
- **Search** — şirket + rol boyunca alt dize eşleşmesi.

Her filtre sayfalayıcıyı 1. sayfaya sıfırlar. Sayfa başına 25 satır.

### Bakım düğmeleri

- **▶ Normalize**, `normalize-statuses.mjs` çalıştırır — durum
  yazımlarını yeniden-kanonikleştirir (`applied` → `Applied`,
  `interview` → `Interview`).
- **▶ Dedup**, `dedup-tracker.mjs` çalıştırır — `(company, role)`'ye göre
  büyük/küçük harfe duyarlı olmayan çiftleri kaldırır.
- **▶ Merge**, `merge-tracker.mjs` çalıştırır —
  `batch/tracker-additions/*.tsv`'den bekleyen girdileri çeker (üstün
  toplu akışının Apply yardımcısı aracılığıyla gönderilen başvuruları
  bıraktığı yer). Çiftleme-önlemesi yapar ve işlenen dosyaları
  `batch/tracker-additions/merged/`'a arşivler. Üstteki toplu akış için
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)'a
  bakın.

### Satır ekleme

`POST /api/tracker` — gövde `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`. `(company, role)`'ye göre büyük/küçük
harfe duyarlı olmayan çiftleme-önleme. Arayüzden, Evaluate sayfası
başarılı bir puanlamadan sonra bir "Add to tracker" düğmesi sunar.

### "Hâlâ açık mı?" — bir ATS ilanının hâlâ açık olup olmadığını denetle

Bir ATS'te barındırılan ilana (Greenhouse, Lever, Ashby, Workday veya SmartRecruiters) bağlanan her izlenen satır, küçük bir **Hâlâ açık mı?** düğmesi alır. Tıklayın; uygulama o ATS'in kendi herkese açık JSON uç noktasına ilanın hâlâ ayakta olup olmadığını sorar — tarayıcı yok, yapay zeka jetonu yok, hiçbir şey kaydedilmez. Üç rozetten birini alırsınız:

- **Açık** — ilan hâlâ listede.
- **Süresi dolmuş** — ATS kesin bir "kaldırıldı" (HTTP 404/410) döndürdü, yani pozisyon geri çekildi.
- **Bilinmiyor** — denetim kesin değildi (URL tanınan bir ATS ilanı değil ya da API hız sınırlıydı, zaman aşımına uğradı veya belirsiz yanıt verdi).

Denetim bilinçli olarak temkinlidir: yalnızca net bir 404/410'da **Süresi dolmuş** der, asla tahminle demez; böylece aslında hâlâ açık olan bir pozisyondan sizi asla caydırmaz. Lever'in herkese açık API'si yetkili sayılmaz (bazı gizli ilanları saklar), bu yüzden bu durumlar Süresi dolmuş yerine **Bilinmiyor** olur.

### Bir sonucu kaydet

Bir başvuru sonuna geldiğinde — teklifi aldın, işe başladın, reddedildin ya da hiç yanıt gelmedi — kaydetmek için o izleyici satırındaki **Sonuç** düğmesine tıkla. Önce önizleyip sonra onaylatan küçük bir pencere açılır:

- **Ne olduğunu seç** — Reddedildi, Teklif alındı, İşe alındı / kabul edildi, Teklif geri çevrildi, Yanıt yok / görmezden gelindi, veya Mülakata geçti.
- **Not (isteğe bağlı)** — kendine kısa bir satır.
- **Önizle** — uygulama tam olarak ne yapacağını gösterir (örn. *"#12 Acme → Reddedildi olarak ayarlayacak"*) ve henüz hiçbir şey yazmaz.
- **Sonucu kaydet** — onaylar.

Kaydetmek üç şeyi birden yapar: sonucu yalnızca-ekleme yapılan bir sonuç günlüğüne ekler, gönderdiğin CV ve ön yazıyı o başvurunun sonuç klasörüne arşivler ve satırın kanonik **Durum**unu eşitler — böylece bir **İşe alındı** ya da **Reddedildi**, tabloyu elle düzenlemeden izleyicide ve istatistiklerde belirir. Diğer izleyici araçları gibi, **Sonucu kaydet**'e basana kadar salt-okunur kalır ve uygulamanın yanında üst career-ops projesine ihtiyaç duyar (o proje yoksa düğme gizlenir).

---

## 12. Deep research (`#/deep`)

Yapılandırılmış bir şirket brifingi oluşturur: anlık görüntü, mühendislik
kültürü, son haberler, Glassdoor duyarlılığı, mülakat süreci, müzakere
kaldıraç noktaları, işe alım görevlisine sorulacak üç akıllı soru.

### Girdi

İki alan — şirket adı ve (opsiyonel) rol. Yapıyı şekillendiren mod
şablonudur (`modes/deep.md`).

### Çıktı yolları

Evaluate ile aynı yedek zinciri:

1. **Anthropic canlı** (tercih edilen) — `bundleProjectContext`, cv +
   profile + `_shared.md` + `deep.md`'yi satır içine alır. Çıktı:
   `interview-prep/<company>-<role>.md`'ye kaydedilen 10–30 KB
   gerekçelendirilmiş markdown.
2. **Gemini canlı** — `gemini-eval.mjs` çağrısı. Aynı kayıt hedefi.
3. **Manuel prompt** — sayfa, Claude Code için hazır bir prompt verir
   (WebFetch + WebSearch'e sahiptir ve gerçek araştırma yapabilir).

### İpuçları

- `claude-sonnet-4-6` üzerinde Anthropic, çağrı başına 1–3 dakikada
  tipik olarak ~13 KB yararlı metin döndürür.
- Anthropic SDK'sının yerleşik web araması yoktur. Taze haberler +
  Glassdoor duyarlılığına ihtiyaç duyduğunuz roller için, manuel promptu
  Claude Code'a yapıştırın ve WebFetch aracını kullanmasına izin verin.
- Canlı çalıştırmalar faturalandırılır; bir Sonnet 4.6
  derinlemesine-araştırma çağrısı ≈ $0.30–0.50 tutar.

---

## 13. Mod promptları (yedi `/#/<mode>` sayfası)

**Kadans panosu (v1.117.0).** Takip sayfası artık üst projenin `followup-cadence.mjs`'inden beslenen deterministik bir **kadans panosuyla** açılır: başvuru başına aciliyet (🔴 acil / 🟠 gecikmiş / 🟡 beklemede / 🔵 soğuk) ve sonraki adıma kalan günler, ayrıca her Applied satırına ilk takip tarihini sabitleyen **Takip tarihlerini ekle** düğmesi (`followup-seed.mjs --backfill`). Üst betikler yoksa pano dürüstçe "kullanılamıyor" der.

Yedi prompt oluşturucu: **Project** fikirleri, **Training** planları,
**Follow-up** e-postaları, **Batch** değerlendirmeleri, işe alım
görevlilerine **Outreach**, **Interview prep** tek-sayfalıkları ve
**Patterns** retrospektifleri. Her biri belirli bir `modes/<slug>.md`
şablonunu sarar:

| Sayfa | Slug | Amaç |
|---|---|---|
| `#/project` | `project` | Bir portföy projesini hedef bir role uyarlayın. |
| `#/training` | `training` | Beceri-boşluğu analizi → müfredat. |
| `#/followup` | `followup` | Mülakat sonrası e-posta taslağı. |
| `#/batch` | `batch` | Çoklu iş tanımı toplu değerlendirme promptu. |
| `#/contacto` | `contacto` | Bir işe alım görevlisine / referansa ulaşım mesajı. |
| `#/interview-prep` | `interview-prep` | Belirli bir mülakat turu için tek-sayfalık hazırlık. |
| `#/patterns` | `patterns` | "Beni başarılı kılan örüntüler nelerdi?" yansıtıcı analiz. |

### Ortak yapı

Her sayfada küçük bir form (alanlar moda özeldir), bir **▶ Generate
prompt** düğmesi (manuel) ve — bir Anthropic veya Gemini anahtarı
mevcut olduğunda — birincil hale gelen bir **⚡ Run live** düğmesi
bulunur.

**▶ Generate prompt**'a tıklamak, form değerleriniz bir
`User-supplied context:` bloğuna JSON-dizeleştirilmiş, ardından birebir
`modes/<slug>.md` şablonu izleyen şekilde birleştirilmiş promptu
döndürür. Tercih ettiğiniz LLM'e kopyalayıp yapıştırın.

**⚡ Run live**'a tıklamak aynı promptu Anthropic'e (veya Gemini'ye)
gönderir, `cv.md` + `profile.yml` + `_shared.md`
`bundleProjectContext` aracılığıyla satır içine alınmış olarak. Sonuç
sayfada işlenir, kopyalanabilir ve `.md` olarak indirilebilir.

Yedi sayfa açık bir izin listesidir — özel bir rotası olan modlar
(`oferta` → Evaluate, `deep` → Deep research) ve üst projenin yalnızca
Claude Code içinde desteklediği modlar (`apply`, `scan`, `pipeline`,
`tracker`, `pdf`, `latex`, `ofertas`, `auto-pipeline`) kasıtlı olarak
bu arayüzün dışında kalır.

---

## 14. Apply checklist (`#/apply`)

Başvurmaya karar verdiğinizde, bu Apply yardımcı sayfası, gerçek başvuru
adımı için bir başvuru kontrol listesi oluşturur. Formları otomatik
**DOLDURMAZ** — o akış, üst projede Playwright kullanan Claude Code
içindeki `/career-ops apply`'da kalır.

### SPA kontrol listesi modu (`#/apply`)

SPA'nın kontrol listesi, Playwright'ı çağırmadan formu elle doldurmayı
tercih eden kullanıcılar içindir. Şunları kapsar:

0. Formu Playwright aracılığıyla okumak için Claude Code'da
   `/career-ops apply <url>` çalıştırın (elle dolduruyorsanız bu adımı
   atlayın).
1. İlanın hâlâ canlı olduğunu doğrulayın (`check-liveness.mjs`).
2. CV'nin en güncel olduğunu onaylayın (`cv-sync-check.mjs`, ardından
   puan ≥ 4.0 ise PDF).
3. `cv.md`'den STAR+R proof point'leri kullanarak ön yazıyı / "Why us?"
   yanıtını uyarlayın.
4. EEO / sponsorluk / başlangıç-tarihi sorularını dürüstçe yanıtlayın.
5. Göndermeden önce doldurulmuş yanıtları
   `interview-prep/{company}-{role}.md`'ye kaydedin.
6. **ASLA otomatik göndermeyin** — nihai düğmeye siz (insan)
   tıklarsınız.
7. Gönderdikten sonra: `data/applications.md`'ye satır ekleyin (veya
   `batch/tracker-additions/`'a TSV yazın).

### Elle doldurma vs Playwright destekli

Gerçek gönderim için iki yol:

- **Elle** — kariyer sayfasını normal bir tarayıcı sekmesinde açın,
  yukarıdaki SPA kontrol listesini takip edin, yanıtları kopyalayıp
  yapıştırın. Playwright gerekmez. Form kısa olduğunda veya Chromium
  kurulu olmadığında kullanın.
- **Playwright destekli** — Claude Code'da (üst proje)
  `/career-ops apply <company>` çalıştırın. Playwright kendi tarayıcısını
  açar, her form alanını okur, numaralandırılmış taslak yanıtlar
  döndürür. Yine de Gönder'e siz tıklarsınız. Form uzun, dinamik olduğunda
  veya hangi soruların hangi yanıtlara sahip olduğunun denetim izini
  istediğinizde kullanın.

### Tam CLI başvuru akışı ([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**Ön koşullar:**

1. İş tanımının `reports/` altında bir değerlendirme raporu olması için
   önce `/career-ops pipeline` çalıştırın. Apply komutu mevcut bir
   değerlendirmeye bağlıdır; biri olmadan, önce pipeline'ı çalıştırın.
2. Rapor ve profil yüklü olsun.
3. **Önerilen:** Playwright kurulu
   (`npx playwright install chromium` — aşağıdaki Playwright Kurulumuna
   bakın). Eksik olduğunda WebFetch'e geri döner (yalnızca-metin form
   önizlemesi, tıkla-doldur yok).

**Numaralandırılmış akış** (kanonik 8 adım):

1. **Komutu şirket adıyla çalıştırın:**

   ```
   /career-ops apply <company>
   ```

   Örnek: `/career-ops apply Anthropic`. Argümansız olarak, sonraki
   sırada formun bir ekran görüntüsünü, yapıştırılmış form metnini veya
   başvuru URL'sini verin.

2. **Raporu bulun.** Sistem, `reports/`'ta eşleşen değerlendirmeyi bulur
   (daha önce `/career-ops pipeline` veya `#/evaluate` tarafından
   oluşturulan).

3. **Formu açın.** Playwright **otomatik olarak** bir tarayıcı penceresi
   başlatır — onu siz açmazsınız.

4. **Alanları okuyun.** Sistem, her form alanını okur ve ayrıştırır
   (etiket, tür, zorunlu, seçimler için seçenekler).

5. **Yanıtlar oluşturun.** career-ops, profiliniz, proof point'leriniz
   ve role göre her alan için uyarlanmış yanıtlar oluşturur.

6. **Numaralandırılmış liste döndürün.** Form düzeniyle eşleşecek şekilde
   sıralanmış yanıtlar alırsınız — basit alanlar (ad, e-posta) önce,
   serbest-metin alanları (ön yazı, "Why us?") son. İşaretlenmiş öğeler,
   insan dikkati gerektiren şeyleri gösterir — maaş çıpası, eksik
   özgeçmiş ayrıntıları, opsiyonel sorular.

7. **Elle doldurma.** Her yanıtı ilgili alana kopyalayıp yapıştırırsınız.
   Bu adım manueldir, otomatik değildir. Her yanıtı önce siz gözden
   geçirirsiniz.

8. **Kullanıcı gönderir.** Gönder'e siz tıklarsınız. career-ops
   **asla** Gönder'e tıklamaz. Sohbete yazarak tamamlamayı onaylayın:

   ```
   Submitted.
   ```

**`Submitted.`'da otomatik güncellemeler:**

- Durum `data/applications.md`'de `Evaluated → Applied`'a döner.
- Doldurulmuş yanıtlar, gelecekteki referans için raporun G Bölümünde
  kalıcı olur.

**Tracker'a devir:**

```
/career-ops tracker
```

Rol puanından bağımsız olarak tüm pipeline'ınızın durumunu izleyin.

### Batch evaluate ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

Tek seferde puanlanacak 10+ iş tanımınız olduğunda (SPA'nın
teker-teker `#/evaluate`'i bu hacim için pratik değildir), CLI'den toplu
çalıştırıcıyı kullanın.

**Girdi dosyası — `batch/batch-input.tsv`** (sekmeyle ayrılmış):

| Sütun | Amaç |
|---|---|
| `id` | Benzersiz sıralı numara |
| `url` | Tam iş ilanı bağlantısı |
| `source` | Köken platform (LinkedIn, Greenhouse, vb.) |
| `notes` | Opsiyonel bağlamsal ayrıntı |

Örnek satır:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**`./batch/batch-runner.sh` bayrakları:**

- `--dry-run` — Bekleyen teklifleri değerlendirmeden önizleyin. TSV'yi
  doğrulamak için her zaman önce bunu çalıştırın.
- `--parallel N` — N işçiyi eşzamanlı çalıştırın (1, 2 veya 3 önerilir).
- `--min-score X.X` — Eşiğin altında puan alan teklifleri kalıcı
  kılmayı atlayın. Yalnızca yüksek-uyumlu roller için rapor tutmak
  amacıyla kullanışlıdır.
- `--retry-failed` — Yalnızca önceki çalıştırmada hata veren teklifleri
  yeniden işleyin (ağ hataları, hız sınırları).
- `--max-retries N` — Başarısız teklifleri N kereye kadar deneyin
  (varsayılan: 2).
- `--model NAME` — `claude -p --model`'e geçirilen Claude modeli (üst career-ops 1.8.0, #504). Ayarsız = Claude Max aboneliği varsayılanınız. Büyük partiler için daha ucuz bir model kullanın, ör. `claude-sonnet-4-6`. `#/batch`'te **Model** girdisi olarak yüzeye çıkar (web-ui 1.31.0).
- `--start-from N` — N'nin altındaki teklif ID'lerini atlayın (kısmen işlenmiş bir partiye devam edin). `#/batch`'te **Start from #** girdisi olarak yüzeye çıkar (web-ui 1.31.0).

**Standart sıra:**

1. `batch/batch-input.tsv`'yi **düzenleyin** — iş tanımı başına bir satır.

2. **Dry-run** (önce önerilir):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **Çalıştır** — sıralı veya paralel:

   ```bash
   ./batch/batch-runner.sh                       # one at a time
   ./batch/batch-runner.sh --parallel 2          # two concurrent
   ./batch/batch-runner.sh --parallel 3          # three concurrent
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # only persist high-fit
   ```

4. **Başarısızlıkları yeniden dene** (ağ / hız sınırı):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **Raporlar**, `reports/`'a
   `{id}-{company}-{YYYY-MM-DD}.md` olarak düşer. Özet satırları
   `batch/tracker-additions/`'a eklenir.

6. **Tracker'a birleştir:**

   ```bash
   node merge-tracker.mjs                 # apply the batch additions
   node merge-tracker.mjs --dry-run       # preview the merge
   ```

   Birleştirme komutu girdilerin çiftleme-önlemesini yapar ve işlenen
   dosyaları `batch/tracker-additions/merged/`'a arşivler.

SPA, ortaya çıkan raporları `#/reports` altında (sayfalanmış, puan-pili
renkli) ve tracker satırlarını `#/tracker` altında yüzeye çıkarır —
tıpkı her birini `#/evaluate` üzerinden eklemiş gibi. CLI'ye düşmemeyi
tercih ediyorsanız, `#/tracker` üzerindeki **▶ Merge** bakım düğmesiyle
eşleştirin.

### Playwright kurulumu ([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

İki career-ops özelliği için gereklidir:

- `/career-ops apply`'da **form doldurma** (yukarıdaki adım 3 —
  Playwright tarayıcıyı açar, alan etiketlerini okur, yanıtlar önerir).
- `/career-ops pdf` ve SPA'nın `#/cv` / `#/reports/:slug` /
  `#/evaluate` / `#/deep` / `#/interview-prep` üzerindeki
  **📄 Generate PDF** düğmesi aracılığıyla **PDF üretimi**.

**Playwright eksik olduğunda yedek:** başvuru akışı WebFetch'e geri döner
(yalnızca-metin form önizlemesi, tıkla-doldur yok). PDF üretimi ise
basitçe hata verir.

**Temel kurulum (career-ops üst kökünden çalıştırın):**

```bash
# Install Chromium for Playwright
npm install
npx playwright install chromium

# Register the Playwright MCP so Claude Code can drive forms
claude mcp add playwright npx @playwright/mcp@latest

# Verify all three components (Chromium, Playwright lib, MCP)
npm run doctor
```

**Alternatif MCP kaydı** — `.claude/settings.local.json`'a ekleyin:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

**Davranış notları:**

- **Varsayılan olarak headless.** Playwright sessizce çalışır. Tarayıcıyı
  iş başında izlemek için Claude'a `open up with playwright the browser
  and fill out the entire form.` deyin.
- **Bir pakette üç rol** — Playwright npm kurulumu size tarayıcı-otomasyon
  kütüphanesini, `/career-ops pdf` için PDF işleme motorunu ve (MCP
  aracılığıyla) Claude Code içindeki form-doldurma iş akışını verir.
- **Güvenmeden önce doğrulayın** — `npm run doctor` üçünün de çalışır
  olduğunu onaylar. SPA'nın Health sayfası, eksikse hızlıca başarısız
  olan bir `Playwright (parent node_modules)` kontrolünü yüzeye çıkarır.

---

## 15. Mülakat hazırlığı

Bu, araştırma-sonrası, mülakat-öncesi aşamadır. Bu uygulamada üç yapı
bir araya gelir:

1. `interview-prep/` altındaki **kaydedilmiş derinlemesine-araştırma
   dosyaları**, çalıştırdığınız her şirket-rol çifti için bir tane.
   **Deep research** sayfasından veya doğrudan `/api/interview-prep`
   üzerinden göz atın.
2. **Patterns modu** (`#/patterns`) — yansıtıcı bir prompt oluşturur:
   "son N mülakatım / teklifim / reddim boyunca hangi örüntüler geçerli?"
   5+ tracker satırı biriktirdiğinizde kullanışlıdır.
3. **Interview-prep modu** (`#/interview-prep`) — belirli, yaklaşan bir
   tur için (davranışsal, teknik, sistem tasarımı) bir tek-sayfalık
   önceden doldurur. Çıktı aynı `interview-prep/` klasörüne gider.

### Önerilen iş akışı

Takviminizdeki her mülakat için:

1. Bir gün önce **Deep'i yeniden çalıştırın** (veya kaydedilmiş dosyayı
   açın).
2. **`#/interview-prep`** — belirli tur için bir tek-sayfalık oluşturun.
   Notlarınıza yapıştırın.
3. **Sistem tasarımı / kodlama turları** — `#/training`'i açın ve iş
   tanımının vurguladığı belirli alt sistem üzerine 30 dakikalık hedefli
   bir tazeleme isteyin.
4. **Ücret turları** — derinlemesine-araştırma dosyasını açın,
   "Negotiation leverage points" bölümüne atlayın. 2–3 belirli veri
   noktası getirin (Glassdoor bandı, son fon turu, başka bir şirketteki
   karşılaştırılabilir teklif).
5. **Davranışsal turlar** — orijinal Evaluate raporunun B bölümüne düşen
   STAR+R hikayelerini `cv.md`'nizden çekin.

Mülakattan hemen sonra:

1. Tracker satırını güncelleyin: durum → `Responded` (ardından
   `Interview`, `Offer`, vb.).
2. Teşekkür e-postası taslağı için `#/followup` çalıştırın.
3. Yeni istihbarat aldıysanız (ücret aralığı, ekip yapısı, teknoloji
   yığını sürprizi), kaydedilmiş `interview-prep/<company>-<role>.md`'yi
   `## Post-round notes` ile düzenleyin, böylece gelecekteki-siz ona
   sahip olsun.

---

## 16. Aktivite günlüğü + Sorun giderme

### Aktivite günlüğü (`#/activity`)

Sunucuya ulaşan her durum-değiştiren isteğin denetim izi. Kaydeder:
pipeline eklemeleri, tracker yazmaları, CV kaydetmeleri, iş tanımı
kaydetmeleri, evaluate çalıştırmaları, derinlemesine-araştırma
çalıştırmaları, tarama çalıştırmaları, yapılandırma değişiklikleri, mod
çalıştırmaları.

Sırlar (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) girişte redakte edilir;
`data/activity.jsonl`'de asla gerçek bir anahtar değeri görmezsiniz.

Eylem önekine göre filtreleyin (`pipeline.`, `cv.`, `evaluate`, `scan.`,
vb.). Sayfa başına 25 satır; sunucu en fazla 500 en-son olay döndürür.

### Sorun giderme

| Belirti | Muhtemel neden | Çözüm |
|---|---|---|
| `cv.md`'de Health sayfası kırmızı | İlk çalıştırma, dosya henüz yok | `touch $CAREER_OPS_ROOT/cv.md` ardından yenileyin. |
| `Profile customized`'da Health kırmızı | `candidate.full_name` hâlâ `Jane Smith` diyor | `config/profile.yml`'yi düzenleyin. |
| Tarama günlüğünde `hh.ru: HTTP 403` | Rus olmayan IP, `(server uses default UA)` yok | `dev.hh.ru/admin`'de kaydolun, bir Rus IP'si / VPN ayarlayın. |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | Üst proje bağımlılıkları kurulu değil | `cd $CAREER_OPS_ROOT && npm install`. |
| Generate PDF hata veriyor | Playwright üst projede kurulu değil | `cd $CAREER_OPS_ROOT && npx playwright install chromium`. |
| `/career-ops apply` "no report found" diyor | Pipeline bu iş tanımını hiç puanlamadı | Önce `/career-ops pipeline` (veya `#/evaluate`) çalıştırın; §14 ön koşullarına bakın. |
| `batch-runner.sh: no such file` | Yanlış dizinden çalıştırma | `./batch/batch-runner.sh`'yi çağırmadan önce `cd $CAREER_OPS_ROOT`. |
| Sunucu `EADDRINUSE: 4317` bildiriyor | Eski örnek hâlâ çalışıyor | `pkill -f 'node server/index.mjs'` ardından yeniden başlatın. |
| Canlı LLM çağrısı > 2 dk takılıyor | Prompt devasa veya Anthropic yavaş | `/api/health` Anthropic bayrağını kontrol edin; sunucu promptları 200 KB ile yumuşak sınırlar ve 413 döndürür. |
| Pipeline önizlemesi `(unsafe redirect)` gösteriyor | İlan özel bir IP'ye / loopback'e yönlendirdi | Bu bir güvenlik özelliğidir (REVIEW-B1). Yönlendirme hedefi reddedilir ve orijinal URL değişmeden kalır. |
| Tracker satırı metni tabloyu bozuyor | v1.9.1 öncesi şirket adında boru | v1.9.1+'ya güncelleyin — borular baştan sona kaçırılır (BF-1). |
| Taze klonda `npm test` başarısız | Testler üst proje düzenini varsayıyor | `CAREER_OPS_ROOT=$(mktemp -d)` kullanın ve fikstürleri önyükleyin. |

Daha derin tanılama için: Health sayfasında **▶ Doctor** çalıştırın,
çıktıyı kopyalayın ve
<https://github.com/Fighter90/career-ops-ui/issues> adresindeki sorun
takipçisinde sorunu arayın.


---

## 17. Yeni bir iş-portalı kaynağı nasıl eklenir

career-ops-ui, her iş kartını bir **adaptör** olarak ele alır — [`server/lib/sources/<slug>.mjs`](../../server/lib/sources/) altında, bir kartın sonuçlarını nasıl getirip normalleştireceğini bilen tek bir dosya. Şu anda `server/lib/sources/` kaydı **92** adaptör gönderir — **87 İngilizce + 5 Rusça** kart. İngilizce set, başlıca ATS'leri (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday), açık bir `provider:` ile seçilen kart-geneli toplayıcıları (RemoteOK, Remotive, We Work Remotely, NoDesk, Get on Board, Amazon, …) ve bir `careers_url` sunucusundan veya açık bir `api:` URL'sinden otomatik tespit edilen kiracı-başına ATS'leri (BambooHR, Personio, Recruitee, Teamtailor, Avature, SAP SuccessFactors, …) kapsar. **Tam listenin burada asla elle sayılması gerekmez — `server/lib/sources/`'tan otomatik keşfedilir ve `#/scan`'in Source açılır menüsünde canlı olarak gösterilir.** YAML için §5'e ve kopyala-yapıştır girdileri için `docs/portals-examples.md`'ye bakın.

> **v1.69.0 (P-14) — sürükle-bırak otomatik keşif.** 12. bir kaynak
> eklemek artık **saf bir dosya bırakma**. Kayıt
> ([`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs))
> artık elle bakımı yapılan bir liste tutmaz — önyüklemede bu klasörü
> tarar (`readdirSync` + dinamik `import()`) ve her `*.mjs`'den
> `export const meta` bloğunu toplar. Adaptörü yazın, `meta`'sını
> bildirin ve tarayıcıya, `#/scan` filtre açılır menüsüne ve RU
> dağıtıcısına anında görünür olsun — **`registry.mjs`'de düzenleme
> gerekmez**. (RU kaynakları hâlâ üstün `portals.yml`'sinde bir satıra
> ihtiyaç duyar; Adım 5'e bakın.)

### Adım 1 — Adaptörü yazın

`server/lib/sources/<slug>.mjs`'yi oluşturun. Kaynağın bir JSON API'si
mi yoksa yalnızca HTML mi işlediğine bağlı olarak iki örüntü çalışır:

**API-destekli kaynak** (en temizi — site açık bir veri uç noktasına
sahip olduğunda bunu kullanın):

```js
// server/lib/sources/example.mjs
const ENDPOINT = 'https://example.com/api/v1/vacancies';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...';

// v1.69.0 (P-14) — self-describing metadata. The registry auto-discovers
// this block at boot; THIS is what registers the source (see Step 2).
export const meta = {
  value: 'example',          // ← must equal job.source written below
  label: 'Example.com',      // ← shown in the #/scan filter dropdown
  region: 'ru',              // ← 'en' (ATS sweep) | 'ru' (regional dispatcher)
  configKey: 'example',      // ← RU only; the key used in portals.yml
};

export async function searchExample(query, opts = {}) {
  const { onlyRemote = false, fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${ENDPOINT}?text=${encodeURIComponent(query)}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Example: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return (data.items || []).map(normalizeExample);
}

function normalizeExample(item) {
  return {
    id: `example-${item.id}`,
    title: item.title || '',
    company: item.company?.name || '',
    url: item.url || '',
    salary: item.salary || '',
    location: item.location || '',
    isRemote: !!item.remote,
    workplaceType: item.remote ? 'Remote' : 'Onsite',
    relocates: false,
    date: item.posted_at || '',
    snippet: (item.description || '').slice(0, 240),
    source: 'example',           // ← must match the registry `value` exactly
  };
}
```

**HTML-kazıma kaynağı** (API olmadığında — tam örnekler için
[`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) ve
[`geekjob.mjs`](../../server/lib/sources/geekjob.mjs)'a bakın):

```js
const BASE = 'https://example.com';

export async function searchExample(query, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${BASE}/vacancies?q=${encodeURIComponent(query)}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Example: HTTP ${res.status}`), { status: res.status });
  }
  return parseExampleCards(await res.text());
}

export function parseExampleCards(html) {
  // …regex-based card extraction. Return [] on parse failure (DON'T throw):
  // a healthy 200 with no parseable cards is "no results", not "error",
  // so the multi-source scanner can keep going.
}
```

Her adaptörün UYMASI GEREKEN üç sözleşme:

- **Geçerli bir `meta` bloğu dışa aktarın** (Adım 2'ye bakın). O
  olmadan kayıt dosyayı sessizce atlar (önyüklemede bir `console.warn`)
  ve kaynak asla görünmez.
- **`opts` içinde `{ onlyRemote, fetchImpl, signal }` kabul edin.**
  `fetchImpl`, adaptörleri ağsız test edilebilir kılan şeydir; `signal`,
  istemci-bağlantı-kopması yayılımı için gereklidir (REVIEW-B3).
- **Ortak şekle sahip kayıtlar döndürün** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`, burada `source`, `meta.value` ile
  eşleşir.

### Adım 2 — Adaptörün `meta`'sını bildirin (otomatik kayıt)

Kayıt adımının tamamı budur. **`registry.mjs`'yi düzenlemezsiniz.**
Sadece adaptörün bir `meta` bloğu dışa aktardığından emin olun — kayıt
onu önyüklemede otomatik keşfeder:

```js
// at the top of server/lib/sources/example.mjs
export const meta = {
  value: 'example',          // job.source value AND #/scan option.value
  label: 'Example.com',      // display label in the dropdown
  region: 'ru',              // 'en' | 'ru'
  configKey: 'example',      // RU only — key in portals.yml::russian_portals.sources
};
```

Keşfin onu nasıl doğruladığı (herhangi bir kuralı geçemeyen dosya, bir
`[sources/registry]` uyarısıyla atlanır, böylece yarı-taşınmış bir dal
tanılanabilir kalır):

- `value` — boş-olmayan dize. Adaptörünüzden `job.source` ile
  eşleşMELİdir.
- `label` — boş-olmayan dize.
- `region` — tam olarak `'en'` veya `'ru'`; başka her şey reddedilir.
- `configKey` — `region: 'ru'` için **gerekli**, `'en'` için göz ardı
  edilir.

`region: 'en'`, ATS taramasına katılır (`tracked_companies` URL
örüntülerinden otomatik keşif); `region: 'ru'`, bölgesel dağıtıcıya
katılır. Genel API (`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`,
`getRegionalSources`), keşfedilen her `meta`'dan yeniden inşa edilir,
önce `en` sonra `ru` sıralı, her bölge içinde etikete göre alfabetik —
böylece açılır menü sırası kullanıcılar için sabit kalır.

### Adım 3 — Dağıtıcıya bağlayın (yalnızca RU)

EN ATS kaynakları `tracked_companies` URL örüntülerinden otomatik keşif
yapar — daha fazla bağlama gerekmez. RU kaynakları için,
[`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs)'yi açın,
`RU_DISPATCH` tablosunu bulun ve bir satır ekleyin:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

Dağıtıcı döngüsü, `cfg.sources`'ta mevcut her anahtar için
`entry.search(query, opts)` çağırır. Daha fazla kod değişikliği gerekmez.

### Adım 4 — Test edin (taklit, asla canlı)

`tests/sources-<slug>.test.mjs` altında bir dosya bırakın. Testlerde
gerçek ağ **yasaktır** (CI-yalıtımı sözleşmesi):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchExample } from '../server/lib/sources/example.mjs';

test('searchExample normalizes one record', async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({ items: [{ id: 1, title: 'Backend Engineer' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  const out = await searchExample('q', { fetchImpl });
  assert.equal(out.length, 1);
  assert.equal(out[0].source, 'example');
});
```

### Adım 5 — `portals.yml`'nizde etkinleştirin

Üst projenin `portals.yml`'si kullanıcıya ait yapılandırmadır. Yeni
kaynağın `configKey`'ini diziye ekleyin:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob", "example"]
  area: 113
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
```

Tarayıcıda `#/scan`'i yeniden yükleyin. Kaynak-filtresi açılır menüsü
yeni girdiyi otomatik olarak alır (tek doğruluk kaynağı,
[`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs) aracılığıyla).
🌐 Scan düğmesi artık her bölgesel taramada yeni kaynağı içerir.

### Referans adaptörleri (yeni kaynaklar için bunları örnek alın)

| Adaptör dosyası | Tür | Notlar |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | Kanonik RU API adaptörü; coğrafya-farkındalıklı UA yedeği. |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | Rus hükümeti açık-verisi; IP kapısı yok. |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML kazıma | Rus teknik kartı; regex tabanlı kart ayrıştırıcı. |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML kazıma | Savunmacı ayrıştırıcı, ayrıştırma ıskasında `[]`. |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML kazıma | GetMatch ile aynı savunmacı stil. |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | Kanonik EN ATS adaptörü; `tracked_companies` URL örüntüsü kullanır. |

### Sık karşılaşılan tuzaklar

- **`meta` dışa aktarımını unutmak.** v1.69.0'dan beri `meta` bloğu, bir
  kaynağı kaydeden *tek* şeydir. `meta` yok (veya bozuk) = dosya,
  önyüklemede tek bir
  `[sources/registry] <file> has no valid \`export const meta\` — skipped`
  uyarısıyla sessizce atlanır ve kaynak asla açılır menüye ulaşmaz. Yepyeni
  bir adaptör görünmüyorsa sunucu günlüğünü kontrol edin.
- **`source` alanı uyuşmazlığı.** Adaptörünüzün yazdığı dize, `meta.value`
  ile tam olarak eşleşMELİdir. Kayarlarsa, `#/scan` filtre açılır menüsü
  kaynağı gösterir ama onu seçmek her satırı filtreler (çünkü eşitlik
  kontrolü `r.source === fs`'dir).
- **Ayrıştırma hatasında fırlatma.** HTML kazıyıcılar, ayrıştırılabilir
  kartı olmayan sağlıklı bir 200'de `[]` döndürMELİdir. Fırlatmak,
  çoklu-kaynak dağıtıcı döngüsünü bozar — bir kötü HTML yapısı, aynı sorgu
  için diğer her kaynağı öldürür.
- **`fetchImpl` / `signal`'i unutmak.** Onlar olmadan, adaptörünüz canlı
  ağa gitmeden birim-test edilemez ve istemci bağlantı kopmaları yayılmaz
  (kullanıcı sekmeyi kapattıktan sonra arka plan getirmesi canlı kalır).
- **RU için `tracked_companies`'e güvenmek.** O liste yalnızca EN ATS
  kaynakları içindir. RU adaptörleri kendilerini bunun yerine
  `russian_portals.queries`'ten yönlendirir — şirket-başına girdi yok.

---

## 18. Bildirimler (üst çubukta 🔔)

> v1.58.34 — sağ-alt köşede beliren her bildirim (toast) aynı zamanda bellek-içi
> bir günlüğe yakalanır (sınır 50, en eski düşürülür). Kaçırdığınız her şeyi
> yeniden okumak için üst çubuktaki 🔔 zilini tıklayarak sağdan-kayan
> **Notifications** çekmecesini açın. Günlük sekme-başına, oturum-başınadır —
> sekmeyi kapatmak onu temizler.

Çekmece **yalnızca zile tıkladığınızda açılır** (veya klavye-odaklıyken Enter /
Space ile etkinleştirdiğinizde). Kendi kendine asla belirmez. Zil üzerindeki
kırmızı rozet, son açılıştan bu yana görmediğiniz girdileri sayar; çekmeceyi
açmak rozeti temizler.

### Bildirim kategorileri

| Kategori | Ne zaman tetiklenir | Görsel ipucu |
|---|---|---|
| **Success** | `Saved`, `Copied`, `Refreshed`, tarama tamamlandı, CV içe aktarıldı, apply-checklist eylemleri ("Copied unchecked", "Reset"), profil kaydedildi, pipeline URL'si eklendi | çekmecede yeşil sol kenarlık; yeşil toast arka planı |
| **Error** | URL doğrulama hatası (`http://` / `https://` ile başlamalı, betik/şablon karakteri yok), `(METHOD /path · HTTP NNN)` postfix'li API hataları, ağ hataları (sunucu kapalı), pipeline-400 çiftleri, doctor / verify-pipeline sıfır-olmayan çıkış | kırmızı sol kenarlık; kırmızı toast arka planı; teknik postfix, `Details` `<details>` bloğuna gizlenir (U-4 / v1.58.24) |
| **Info / progress** | `Running doctor.mjs…`, `Running verify-pipeline.mjs…`, `Refreshing…`, `Loading…`, `Generating prompt…`, tarama ilerleme satırları | gri sol kenarlık; varsayılan toast arka planı |

Her çekmece girdisi şunları gösterir:

- **Zaman damgası** (`HH:MM:SS`, aktif SPA diline yerelleştirilmiş).
- **Mesaj** (insan cümlesi, teknik postfix U-4'e göre başlıktan çıkarılmış olarak).
- **Ayrıntılar** (mevcut olduğunda — API çağrısının `(METHOD /path · HTTP NNN)` postfix'i veya başka herhangi bir teknik ek açıklama, tek aralıklı).

### Bildirim OLMAYAN şeyler

- Doctor / verify-pipeline **sonuç modalı** (tam stdout / stderr) — o bir modaldır, toast değil ve günlüklenmez.
- `#/scan` ve `#/auto`'daki SSE günlük satırları — bunlar sayfa gövdesine akar, toast hattına değil.
- Yalnızca-döndürücü yükleme durumları (bunlar toast olmadan `UI.withSpinner` kullanır).

### Klavye

- Zil üzerinde **tıklama** veya odak + **Enter / Space** → çekmeceyi açar.
- **Esc**, **×** kapat düğmesine tıklama veya zile yeniden tıklama → çekmeceyi kapatır; odak zile döner.
- Çekmece açıkken **Tab** → kapat düğmesi ve içindeki odaklanabilir ayrıntılar arasında geçer; çekmece `aria-modal="false"`'dur, dolayısıyla Tab tuzağa düşürmez (sayfanın geri kalanına hâlâ ulaşabilirsiniz).


## 19. Uygulamayı kendi dilinize yerelleştirme

Arayüz 17 dilde gönderilir (English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文, Polski, Українська, Dansk, العربية, Deutsch, Italiano, Türkçe, हिन्दी). Ekrandaki her etiket bir çeviri sözlüğünden gelir ve uygulama mantığına dokunmadan bir dili ekleyebilir veya düzeltebilirsiniz.

**Çevirilerin bulunduğu yer.** v1.60.0'dan beri her dil, `public/js/lib/locales/` altında kendi dosyasıdır — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.ru.js` ve benzeri — basit bir `'key': 'text'` çiftleri listesi. Paylaşılan bir `i18n-dict.aliases.js`, her zaman aynı okunması gereken anahtarların (bir kenar çubuğu etiketi ve onun sayfa başlığı) tek bir çeviriye işaret etmesini sağlar. `i18n-dict.js` bunların hepsini sayfa yüklemede birleştirir; onu asla düzenlemezsiniz.

**Bir ifadeyi düzeltin veya ekleyin.** Diliniz için dosyayı açın, anahtarı bulun (ör. `'nav.scan'`) ve metni düzenleyin. Yepyeni bir etiket eklemek için, aynı anahtarı çevrilmiş değerle **8 dil dosyasının tümüne** ekleyin, ardından sayfada `t('your.key')` aracılığıyla ona başvurun. `npm test` çalıştırın — herhangi bir dil anahtardan yoksunsa başarısız olur, böylece hiçbir şey yarı-çevrilmiş gönderilmez.

**Yepyeni bir dilin tamamını ekleyin.** `i18n-dict.en.js`'yi `i18n-dict.<code>.js`'ye kopyalayın, her değeri çevirin, ardından kodu `i18n.js`'de (dil listesi + tarayıcı otomatik-tespit), `i18n-dict.js` birleştiricisinde kaydedin ve `index.html`'de bir `<script>` satırı ekleyin. Tam kontrol listesi — test anlık görüntüsü ve yardım / README eşlik dosyaları dahil — `docs/LOCALIZATION.md`'dedir.

**Bilmekte fayda var.** Dil değiştirici kenar çubuğu altbilgisindedir; seçiminiz tarayıcı-başına hatırlanır. Sunucu tanılama mesajları kasıtlı olarak İngilizce kalır (böylece günlükler tutarlı okunur) — yalnızca ekrandaki arayüz çevrilir.

Eksiksiz, adım adım yerelleştirme kılavuzu için depodaki **`docs/LOCALIZATION.md`**'ye bakın.

## 20. Hedef rollere göre istatistikler (`#/stats`)

**Analytics → Hedef rol istatistikleri** sayfası, taramalarınızın hâlihazırda topladığı seyrek verileri gerçekten hedeflediğiniz roller için bir pazar resmine dönüştürür: ülkeye göre ilan sayıları ve maaş düzeyleri, ayrıca zaman içinde izleyebileceğiniz bir eğilim. Hiçbir şey uydurulmaz: yalnızca tarayıcıların bulduğunu toplar ve örneklemin ne kadar ince olduğu konusunda dürüsttür.

### Sayılar nereden geliyor

- **Hedef roller** Profilinizden (`config/profile.yml` → target roles) okunur, asla koda gömülü değildir. Önce `#/profile` üzerinde bunları ayarlayın; rol yoksa sayfa, boş grafikler yerine "hedef rollerinizi ayarlayın" uyarısı gösterir.
- **İlanlar** en son taramanızdan gelir (önce `#/scan` üzerinde bir tane çalıştırın). Her ilanın konumu bir ülkeye eşlenir (taramanın ülke filtresiyle aynı algılayıcı) ve maaş dizesi ayrıştırılıp yaklaşık bir döviz kuru tablosu aracılığıyla **USD**'ye normalleştirilir.
- Her şey **tarayıcınızda** toplanır — hiçbir veri makinenizden ayrılmaz ve bu sayfanın yazdığı tek şey, açıkça kaydettiğiniz bir anlık görüntüdür.

### Grafikleri okuma

- **Ülkeye göre ilanlar** — her ülkede kaç eşleşen ilan olduğu. Tek bir hedef role veya tek bir ülkeye daraltmak için üstteki **Rol** ve **Ülke** filtrelerini kullanın.
- **Ülkeye göre medyan maaş (USD)** — her ülke için ayrıştırılmış maaşların ortancası. Yalnızca ayrıştırılabilir maaşı olan ilanlar sayılır; örneklem büyüklüğü grafiğin yanında gösterilir ve tutarlar kaba kurlarla dönüştürülür, bu yüzden bunu kesin değil *gösterge niteliğinde* okuyun. Tek başına bir `¥` (Japon yeni ile Çin yuanı arasında belirsiz) büyük bir FX bozulmasından kaçınmak için tahmin edilmek yerine atılır.
- Mevcut taramada ayrıştırılabilir maaş yoksa, maaş grafiği sayı uydurmak yerine bunu belirtir.

### Anlık görüntüleri kaydetme ve eğilimi izleme

- Geçerli toplamı `data/role-stats.jsonl` dosyasına eklemek için **Anlık görüntüyü kaydet**'e tıklayın. Her anlık görüntü sunucuda zaman damgalanır; anlık görüntüler bu sayfanın yazdığı tek şeydir ve CV'nize veya profilinize asla dokunmaz.
- **Eğilim** grafiği, kaydettiğiniz anlık görüntüler boyunca ilan sayılarını çizer — hedef rollerinizin pazarının zaman içinde nasıl hareket ettiğini görmek için düzenli olarak (örneğin her haftalık taramadan sonra) bir tane kaydedin.

## 21. İki sayfalık özetiniz — adayın pazara uygunluğu (`#/two-pager`)

career-ops-ui'nin çoğu „bu iş ilanı CV'me uyuyor mu?" sorusunu yanıtlar. **İki sayfalık özet** diğer yarısını yanıtlar: „bu iş ilanı *benim gerçekten istediğim* şeye uyuyor mu?". Bu, *Never Search Alone* kitabındaki **„Mnookin iki sayfalık özeti"** örnek alınarak tasarlanmıştır — sizi neyin canlandırdığına, neye ihtiyaç duyduğunuza ve neyi kabul etmeyeceğinize dair birinci tekil şahıs ağzından kısa bir beyandır. Bunu **Setup → Two-pager 🎯** üzerinden açın.

**Yapay zeka otomatik doldurma + dışa aktarma (v1.100).** "✨ AI doldurma yardımcısı" artık tüm alanları özgeçmişinizden canlı doldurur (gözden geçirip kaydedin); **👁 Önizle ve dışa aktar** two-pager'ı işler ve Markdown, PDF veya DOCX olarak dışa aktarır.

### Ne doldurursunuz

- **Ben kimim** — geçmiş performansınız ve hangi rolde en iyi performansı gösterdiğinize dair birkaç birinci tekil şahıs cümlesi.
- **Hedef ortam** — istediğiniz şirket büyüklüğü, aşama ve kültür.
- Beş çip listesi — her öğeyi eklemek için metni yazıp **Enter** (veya virgül) tuşuna basın, kaldırmak için **×** öğesine tıklayın:
  - **Sevdiklerim** — enerji verenler (uzaktan çalışma, sorumluluk, greenfield, mentorluk…).
  - **Olmazsa olmazlar** — katı gereksinimler (ücret alt sınırı, ülke, teknoloji yığını…).
  - **Nefret ettiklerim** — tüketenler (nöbet, bitmeyen toplantılar, yalnızca legacy…).
  - **Deal-breakers** — kesin „hayır"lar (yalnızca ofis, sponsorluk yok, belirli bir tutarın altında…).
  - **Pazarlığa kapalı sınırlar** — sınırlar (konum, uzaktan çalışma, ücret alt sınırı…).

Kaydetmek için **Save two-pager** düğmesine tıklayın. Dosya, **üst career-ops projenizin kullanıcı katmanına** `config/two-pager.yml` yolunda yazılır, bu nedenle — CV'niz ve profiliniz gibi — sistemi güncellediğinizde **asla** üzerine yazılmaz.

### AI doldurma yardımcısı

Nasıl ifade edeceğinizden emin değil misiniz? **✨ AI fill assistant** düğmesine tıklayın. Çalıştırmaya hazır bir istem (CV'niz ve profiliniz gömülü olarak, Mnookin formatında) oluşturur ve bunu bir iletişim kutusunda gösterir. Bu istemi herhangi bir LLM'de çalıştırın, ardından ortaya çıkan YAML alanlarını forma geri yapıştırın. Yardımcı yalnızca **kendi** CV'nizi ve profilinizi kullanır — hakkınızda asla gerçekler uydurmaz ve bu düğmeden hiçbir canlı API çağrısı yapılmaz.

### İstediğinize uygunluk puanı

Bir iki sayfalık özet kaydettikten sonra, **`#/scan`** üzerindeki her ilan küçük bir **`◎ N`** rozeti (0–100) kazanır. Her işin **çalışma türünü** (uzaktan/hibrit/ofis), **ülkesini**, **ücret alt sınırını** ve **taşınma** durumunu iki sayfalık özetinizle karşılaştırır — yeşil rozet güçlü uyum, kırmızı ise bir deal-breaker'ın devreye girdiği anlamına gelir. Ayrıntılar için üzerine gelin (✓ neyin eşleştiği, ✗ bir deal-breaker'ın neyi ihlal ettiği).

Bilinçli olarak dürüsttür: bir ilan **eşleştirilebilir hiçbir sinyal** vermediğinde (örneğin tüm tercihleriniz, bir tarama satırının doğrulayamayacağı serbest metin ise), **hiçbir rozet gösterilmez** — sistem asla bir sayı uydurmaz. Katı bir **deal-breaker** ihlali, aynı şeyden duyulan yumuşak bir **nefretten** daha ağır basar. Rozetin ötesinde, kaydedilmiş iki sayfalık özetiniz her LLM **değerlendirmesine** gömülür, bu nedenle belirttiğiniz tercihler yalnızca „CV'ye karşı iş tanımı" eşleşmesini değil, yazılı kararı da şekillendirir.

## 22. Deneme mülakatı (`#/mock-interview`)

Mülakat hazırlığını okumak bir şeydir; *cevapları yüksek sesle söylemek* ise bambaşka bir şey. **Deneme mülakatı** sayfası (kenar çubuğundan **Interview prep → Mock interview 🎤** ile açın) belirli bir role yönelik, kendi CV'nize, profilinize, iki sayfalık özetinize ve hikâye bankanıza dayanan sıra sıra bir prova yürütür. Bu, hazır bir soru listesi değildir — mülakatçı gerçekten söylediğiniz şeye tepki verir.

### Bir oturuma başlama

- Bir **hedef rol** girin (ve isteğe bağlı olarak bir **şirket**). Elinizde varsa **iş tanımını** da yapıştırın — sorular gözle görülür şekilde keskinleşir.
- **Start interview** düğmesine tıklayın. Mülakatçı, role ve geçmişinize göre uyarlanmış tek bir odaklı soruyla söze başlar.
- Cevabınızı yazın ve **Send answer** düğmesine tıklayın. İstediğiniz kadar tekrarlayın — bu bir konuşmadır, sabit bir sınav değil.

### Her tur size ne verir

Her cevaptan sonra mülakatçı üç bölümle yanıt verir:

- **Geri bildirim** — neyin isabetli olduğu (güçlü yönler) ve neyin eksik kaldığı, **STAR+R** (Situation, Task, Action, Result, Reflection) terimleriyle çerçevelenmiş olarak. Atladığınız belirli boyutu adıyla belirtir.
- **Puan** — bir oturum boyunca ilerlemeyi hissedebilmeniz için tek satırlık bir gerekçeyle hızlı bir `N/5`.
- **Sonraki soru** — son cevabınızın en zayıf kısmını bilinçli olarak yoklayan bir takip sorusu.

Her şey gerçek malzemenize dayanır: `cv.md`, `config/profile.yml`, `config/two-pager.yml` ve STAR+R hikâye bankanız (`interview-prep/story-bank.md`) tümüyle isteme gömülür. Mülakatçı gerçek boşluklara yüklenir ama sahip olmadığınız bir deneyimi asla uydurmaz. Herhangi bir LLM anahtarı ayarlanmamışsa, sayfa size herhangi bir asistana yapıştırabileceğiniz çalıştırmaya hazır bir istem verir — uygulamanın başka yerlerinde kullanılan aynı dürüst yedek çözüm.

### Oturumları kaydetme ve yeniden görüntüleme

Bitmiş bir provayı saklamak için **Save transcript** düğmesine tıklayın. Üst projenizin kullanıcı katmanına `interview-prep/mock-{company}-{role}-{date}.md` yolunda yazılır, böylece diğer mülakat hazırlık notlarınızla birlikte durur ve sistem güncellemeleriyle asla üzerine yazılmaz. Sayfanın altındaki **Saved sessions** listesi, herhangi bir dökümü yeniden açmanıza veya silmenize olanak tanır. Farklı bir rolle sıfırdan başlamak için **New interview** düğmesini kullanın.

## 23. Networking ve derinlemesine şirket araştırması (`#/networking`)

Ön kapıdan başvurmak oyunun yalnızca yarısıdır — diğer yarısı *birini tanımak* ya da en azından kime ulaşacağını ve ne diyeceğini bilmektir. **Networking** sayfası (kenar çubuğundan **Derinlemesine araştırma → Networking 🤝** ile açın) bir şirketi, kendi CV'niz, profiliniz ve two-pager'ınıza dayanan, mülakat almaya yönelik somut bir plana dönüştürür.

### Plan oluşturma

- Bir **şirket** (zorunlu) ve isteğe bağlı olarak bir **pozisyon** ile **iş tanımı** girin. İş tanımı, "neden uygunum" kancalarını keskinleştirir.
- **Plan oluştur**'a tıklayın. Bir LLM anahtarıyla canlı çalışır ve planı sayfada gösterir; anahtar olmadan, herhangi bir asistana yapıştırmak için hazır bir istem verir (uygulama genelinde kullanılan aynı dürüst yedek yöntem — hiçbir şey uydurulmaz).

### Planın içeriği

Plan dört bölüm halinde döner:

- **Şirket dosyası** — şirketin ne yaptığına dair sıkı bir özet, alıntılamaya değer güncel sinyaller ve gerçek geçmişinizden çıkarılmış iki üç "neden uygunum" kancası.
- **Kime ulaşmalı** — üç ila beş hedef persona (ekibin işe alım yöneticisi, kurum içi bir işe alım uzmanı, ekipteki kıdemli bir mühendis, sıcak bir bağlantı ya da mezun bağlantısı) ve her birini bulmak için somut bir **LinkedIn arama dizesi**. Asla gerçek isimler uydurmaz — doğru kişileri nasıl bulacağınızı söyler.
- **En sıcak tanışma yolu** — *sizin* geçmişiniz için en gerçekçi tek sıcak giriş rotası: ortak bir işveren, okul veya topluluk; ikinci derece bir bağlantı; ya da gerçekten en iyi seçenek olduğunda güçlü sinyalli bir soğuk mesaj.
- **İletişim taslakları** — en önemli personalarınız için kısa, özgün mesajlar (üç ila beş cümle, dolgu yok); genel görünmesinler diye gerçek kanıt noktalarınıza dayandırılmış.

### Planları kaydetme ve yeniden görüntüleme

Bir planı saklamak için **Planı kaydet**'e tıklayın. Üst projenizin kullanıcı katmanında `networking/net-{company}-{role}-{date}.md` konumuna yazılır — kendi dosyanız, sistem güncellemeleriyle asla üzerine yazılmaz. Sayfanın altındaki **Kayıtlı planlar** listesi, herhangi bir planı yeniden açmanıza veya silmenize olanak tanır. Taslaklar ve personalar yalnızca gerçek materyallerinize dayandığı için, bunları körü körüne göndereceğiniz bir senaryo olarak değil, kişiselleştirilecek güçlü bir ilk taslak olarak değerlendirin.

## 24. CV Studio (`#/cv-studio`)

**CV'ye ekle (v1.117.0).** Yeni bir kart; bir projeyi, yayını veya portföy sayfasını (URL veya yapıştırılan metin) YALNIZCA o kaynağa dayanan ATS'ye hazır maddelere çevirir — kaynakta olmayan metrikler, işverenler veya tarihler uydurulmaz, atlanır. Önerileri gözden geçirir ve kabul ettiklerini kendin CV düzenleyicisine yapıştırırsın; hiçbir şey otomatik yazılmaz ve URL'ler pipeline ile aynı SSRF-güvenli doğrulayıcıdan geçer.

`#/cv` sayfası, CV'nizi *yazdığınız* yerdir; **CV Studio** (kenar çubuğundaki **Setup → CV Studio 🎨** üzerinden açın) ise onu *keskinleştirdiğiniz* yerdir. `cv.md` dosyanıza, ikisi tarayıcınızdan hiç çıkmayan üç dürüst araç sunar.

**Bir işe göre uyarla (v1.101).** Bir iş ilanı yapıştırın; CV Studio uyarlanmış bir özgeçmiş ve uyumlu bir ön yazı üretir, işe alım uzmanı kontrol listesi kapısından geçirir (hatalar engeller, uyarılar öneri verir), yalnızca kendi materyallerinize dayanır.

### Özgeçmiş tanılaması

Sayfayı açtığınız anda CV'nizi 100 üzerinden puanlar ve her denetim için bulguları, ne değiştireceğinize *sizin* karar vermeniz için kısa bir açıklamayla birlikte listeler (asla sessizce yeniden yazmaz):

- **Uzunluk** — CV bir ila iki sayfalık sağlıklı bir aralıkta mı?
- **Sayısallaştırılmış etki** — madde işaretlerinizin ne kadarı gerçek bir sayı veya metrik içeriyor? İşe alım uzmanları göz gezdirirken bunları arar.
- **Güçlü eylem fiilleri** — "sorumluydu" ya da "yardımcı oldu" gibi zayıf ifadeleri işaretler.
- **Moda sözcükler** — boş klişeleri işaretler ("sonuç odaklı", "takım oyuncusu").
- **Temel bölümler** — Özet, Deneyim, Eğitim ve Beceriler bölümlerinin varlığını denetler.
- **İletişim bilgileri** — bir e-posta bulunduğundan emin olur.

Bunların tümü, hiçbir LLM olmadan tamamen tarayıcınızda çalışır — sayılar belirlenimcidir ve hiçbir şey uydurulmaz.

### Gizlilik maskesi

CV'nizi bir yazı örneği ya da ekran görüntüsü olarak paylaşmadan önce, **Gizlilik maskesi** kişisel tanımlayıcı verileri gizler: e-posta, telefon, bağlantılar/kullanıcı adları ve açık adres; ayrıca etkinleştirip girerseniz **adınız → baş harfleri**. Her kategoriyi aç/kapat, maskelenmiş sürümü kopyala ve güvenle paylaş. Her şey tamamen tarayıcıda gerçekleşir, tam olarak kaç öğenin gizlendiğini bildirir ve orijinali asla saklamaz veya iletmez.

### İnsanlaştır (ses eşleştirme)

Katı bir cümleyi ya da paragrafı yapıştırın — kalıp metin gibi okunan o tür genel yapay zekâ ifadelerini — ve **İnsanlaştır** onu *sizin* sesinizle yeniden yazsın. Yeniden yazma, sunucu tarafında `voice-dna.md` dosyanıza (yazınızın nasıl okunduğu) ve `writing-samples/` (gerçek düzyazınız) dayandırılır. Katı kural: sıralamayı değiştirebilir, sıkılaştırabilir ve sesi yeniden ayarlayabilir, ancak yapıştırdığınız metinde zaten bulunmayan bir olguyu, metriği ya da başarıyı **asla** eklemez. Bir LLM anahtarıyla canlı olarak yeniden yazar; anahtar yoksa, herhangi bir asistana yapıştırmanız için hazır bir istem verir. Ardından CV'nizi her zamanki gibi `#/cv` sayfasında düzenleyin — CV Studio önerir, siz karar verirsiniz.

### "Eski bir CV yeniden kullanılsın mı?" ipucu

CV Studio'da kayıtlı bir iş tanımı seçtiğinizde, soluk tek satırlık bir ipucu benzer bir rol için zaten bir CV uyarlayıp uyarlamadığınızı söyler. Uygulama, seçili tanımı diğer kayıtlı tanımlarınızla karşılaştırır (deterministik bir sözcük örtüşme puanı artı bir kıdem denetimi — yapay zeka yok, hiçbir şey kaydedilmez) ve tek en iyi eşleşmeyi üç karardan biri olarak öne çıkarır:

- **yeniden kullan** — kayıtlı bir tanıma çok benzer; o CV'yi büyük olasılıkla olduğu gibi yeniden kullanabilirsiniz.
- **düzenleyerek yeniden kullan** — benzer; o CV'yi yeniden kullanın ama üzerinde rötuş yapın.
- **yeniden üret** — yakın benzer bir kayıtlı tanım yok, o yüzden taze bir CV uyarlayın.

İpucu, en az iki kayıtlı tanımınız olduğunda otomatik görünür ve seçili tanımı değiştirdiğinizde yenilenir. Yalnızca bir dürtmedir — CV'nizi veya tanımlarınızı asla değiştirmez.

## 25. Bellek (`#/memory`)

Diğer her sayfa her seferinde sıfırdan başlar. **Bellek** (kenar çubuğunda **Kurulum → Bellek 🧠** üzerinden açın), asistana bir şeyi *bir kez* söyleyip kalıcı hale getirdiğiniz tek yerdir. **Her** yapay zekâ isteğine beslenen, kısa ve düzenlenebilir bir "benimle ilgili bunu hatırla" notu tutar.

### Ne işe yarar

Kalıcı tercihler ve çalışma tarzı için kullanın, örneğin:

- Hedeflediğiniz rol ve şirket türleri (ve asla görmek istemedikleriniz).
- Yanıtların nasıl yazılmasını istediğiniz — kısa mı ayrıntılı mı, kıdemli bir ton, dolgu yok.
- Tekrarlamaya değer katı kısıtlamalar — yalnızca uzaktan, bir maaş tabanı, nöbet yok.

Onu tercihler ve yönlendirme ile sınırlı tutun. Deneyiminizle ilgili gerçekler için doğru yer **değildir** — becerileriniz, işverenleriniz ve başarılarınız CV'nizde, profilinizde ve iki sayfalık özetinizde yaşar; bunlar CV'lerinizde ve ön yazılarınızda görünen her şeyin tek kaynağı olmayı sürdürür. Bellek notu, asistanın sizinle *nasıl* çalıştığını biçimlendirir, sizin hakkınızda *ne* iddia ettiğini asla.

### Her yere nasıl ulaşır

**Belleği kaydet**'e tıkladığınızda, not üst projenizin kullanıcı katmanına `config/memory.md` içine yazılır ve paylaşılan proje bağlamına gömülür. Bu, notun **her** yapay zekâ isteğiyle — değerlendirmeler, deneme mülakatları, ağ kurma planları, CV Studio yeniden yazımları — ve yapılandırdığınız **her** sağlayıcı üzerinden otomatik olarak taşındığı anlamına gelir. Bir kez yazın; her sayfada kendinizi tekrarlamak zorunda değilsiniz. Diğer kullanıcı katmanı dosyalarınız gibi, sistemi güncellediğinizde asla üzerine yazılmaz ve makinenizi yalnızca çalıştırmayı seçtiğiniz LLM istemlerinin içinde terk eder.

### Verilerinizden öner

Ne yazacağınızdan emin değil misiniz? **✨ Verilerimden öner**, başvuru izleyicinizi okur ve bir dizi davranışsal madde taslağı çıkarır — peşinden gittiğiniz, kabul ettiğiniz ve reddettiğiniz şeylerdeki kalıplar. Size verdiği istemi herhangi bir LLM'de çalıştırın, önerileri gözden geçirin ve düzenlenmiş bir sürümü nota yapıştırın. Yalnızca kendi izleyicinizden yararlanır ve asla gerçek uydurmaz; herhangi bir şey kaydedilmeden önce her zaman gözden geçirirsiniz.

## 26. İstatistikler (`#/stats`)

**Ret kalıpları sekmesi (v1.117.0).** Dördüncü bir sekme, üst projenin `analyze-patterns.mjs`'ini (salt okunur) çalıştırır ve sonuç dağılımını, eyleme dönük önerileri ve ATS sağlayıcısı başına ilerleme oranını ("algoritmik tekkültür" sinyali — Bommasani et al., FAccT 2026) gösterir. Asgari örneklemin altındaki sağlayıcılar yıldızla işaretlenir; üst proje yoksa sekme bunu dürüstçe söyler.

**İstatistikler** sayfası üç görünümü tek bir bölümde bir araya getirir: yapay zekâ tarafından üretilen bir pazar raporu, kendi pipeline'ınıza dair analizler ve taramalarınızdan elde edilen hedef roller için ilan sayısı eğilimi. Üstteki sekmelerle bunlar arasında geçiş yapın.

### Pazar raporu

**Pazar raporu** sekmesi, modelden *sizin* hedef rolleriniz için bir maaş ve işgücü piyasası analizi ister — hangi rolleri ve hangi kıdem düzeyini kapsayacağını bilmek için CV'nizi ve profilinizi okur. Bir **Bölge / pazar** yazın (örneğin `Russia`, `EU-remote`, `US` veya `Germany`), bir **Para birimi** seçin ve **Pazar raporu oluştur**'a tıklayın. Yönetici özeti, kademeye göre maaş (medyan artı P10/P25/P75/P92), önde gelen işverenler, talep gören beceriler tablosu, yan hakların sıklığı, ofis/hibrit/uzaktan dağılımı, yapay zekâ etkisi dahil 12-24 aylık eğilimler ve müzakere rehberliği içeren yapılandırılmış bir rapor alırsınız. Her rakam, **modelin eğitim bilgisinden çıkan yön gösterici bir tahmindir** — kazınmış veya canlı veri değil — ve rapor bunu belirtir; sayıları alıntı değil, aralık olarak değerlendirin. Ayarlanmış bir API anahtarı yoksa, uydurma bir rapor yerine kopyala-yapıştır bir istem alırsınız. Raporu uygulamadan çıkarmak için **.md indir**, **PDF olarak kaydet** veya **Kopyala**'yı kullanın.

### Pipeline'ım

**Pipeline'ım** sekmesi kendi başvuru izleyicinizi grafiğe döker — dışarıdan hiçbir şey yok. Kaç rolü takip ettiğinizi, puan dağılımınızı, durum hunisini, en çok başvurduğunuz şirket ve rolleri, zaman içindeki başvuruları ve dönüşüm oranlarını (başvuruların ne kadarının Başvuruldu, Yanıtlandı, Mülakat ve Teklif aşamasına ulaştığını) gösterir. Aramanızın dürüst aynasıdır: yalnızca `data/applications.md` içinde zaten olanı yansıtır.

### Hedef rol eğilimi

**Hedef rol eğilimi** sekmesi özgün görünümdür: hedef rolleriniz için ülkeye göre ilan sayıları ve medyan maaş, en son taramanızdan toplanır; bir para birimi seçici ve bir **Hedef role göre ilanlar** genel görünümü ile birlikte. **Anlık görüntüyü kaydet**, mevcut toplamı kaydeder; böylece ilan sayılarının zaman içinde nasıl değiştiğini izleyebilirsiniz ve eğilim çizgisi bu anlık görüntüleri geri okur. Seyrek veri beklenir ve gösterge niteliğinde olarak etiketlenir — asla uydurma sayılarla doldurulmaz.

### Toplam ve ücret

**Toplam** sekmesi (v1.118.0) üst projenin sıfır token maliyetli iki betiğini salt okunur aktarır: `stats.mjs` — toplam takipçi özetiniz, kümülatif huni oranları (yanıt / mülakat / teklif), tarayıcı toplamları ve portal kapsamı — ve `salary-gap.mjs` — başvuru başına istenen vs ilan edilen vs gerçek ücret, raporların Machine Summary bölümlerinden ve `data/salary-observations.tsv` dosyasından birleştirilir. Küçük örneklemler yol gösterici olarak işaretlenir; üst proje yoksa sekme dürüst bir not gösterir.

### Beceri öz değerlendirme günlüğü (`#/assessments`)

`#/assessments`, girdiğiniz beceri değerlendirmeleri için basit bir günlüktür — bir şirketin platformundaki kodlama testi, eve ödev, sertifika sınavı. Bir olay kaydedin — **şirket**, **platform**, **beceri**, isteğe bağlı bir geçme **eşiği %** ve **puanınız %**, artı serbest metin bir not — ve üst projedeki `data/assessments.tsv` dosyasına olay başına bir satır olarak eklenir. Sayfa ayrıca kaydettiğiniz her şeyi listeler ve platforma göre toplar; böylece zaman içinde nasıl gittiğinizi görürsünüz. Bu, sizin tetiklediğiniz açık bir yazma işlemidir; üst proje yoksa sayfa soluk bir "kullanılamıyor" satırı gösterir.

## 27. Kariyer planı (`#/career-plan`)

**Kariyer planı** sayfası, özgeçmişini ve profilini somut, kişiselleştirilmiş bir gelişim planına dönüştürür — bir kariyer koçuyla kuracağın türden bir plan, ama kendi materyallerinden üretilir ve düzenlemesi sana aittir.

### Bir plan oluşturma

Bir **Ufuk** seç (6, 12 veya 24 ay), isteğe bağlı olarak bir **Odak** yaz (örneğin "yöneticiliğe geçmek", "uzaktan çalışmaya geçmek" veya "Go'ya geçmek") ve **Plan oluştur**a tıkla. Model, (paylaşılan proje bağlamı aracılığıyla) özgeçmişini, profilini, iki sayfalık özetini ve bellek notunu okur ve yapılandırılmış bir plan yazar: dürüst bir başlangıç noktası anlık görüntüsü, güçlü yönler ve gelişim alanları için bir SWOT, SMART / OKR / WOOP olarak ifade edilmiş hedefler, ödünleşimleriyle birlikte alternatif kariyer yörüngeleri, bir sert/yumuşak beceri planı, seçtiğin ufuk için ay ay bir yol haritası, ilerlemeyi nasıl izleyeceğin, olası tuzaklar ve destekleyici hamleler. Her öneri, materyallerinin gerçekte gösterdiğine dayanır — ileriye yönelik plan yapar, geçmişin hakkında asla olgu uydurmaz. Bir API anahtarı ayarlanmamışsa, bunun yerine kopyalayıp yapıştırabileceğin bir istem alırsın.

### Düzenleme ve kaydetme

Plan, düzenlenebilir bir metin alanında belirir — istediğin her şeyi değiştir, sonra **Planı kaydet**e tıkla. Üst projenin kullanıcı katmanına, `config/career-plan.md` içine yazılır; böylece sistem güncellemelerinden sonra korunur ve yalnızca çalıştırmayı seçtiğin LLM istemlerinin içinde gönderilir. **Önizleme**, kaydetmeden önce biçimlendirilmiş olarak okuyabilmen için Markdown'ını işler.

### Dışa aktarma

Planı uygulamanın dışına almak için **.md indir**, **PDF olarak kaydet** veya **Kopyala**yı kullan — uygulamanın yapay zeka raporlarının genelinde kullanılan aynı dışa aktarma denetimleridir. PDF, mevcut satır içi PDF oluşturucudan geçer; Markdown ise doğrudan bir indirmedir.

## 28. Kariyer yönelimi (`#/orientation`)

**Kariyer yönelimi** sayfası "hangi yönler bana gerçekten uygun?" sorusunu yanıtlar — bir meslek testinden alacağın türden bir okuma, ama bir anketten değil, kendi özgeçmişin ve profilinden çıkarılır.

### Neler üretir

**Profil oluştur**a tıkla; model özgeçmişini, profilini, two-pager'ını ve bellek notunu okur ve bir kariyer-yönelimi profili yazar: **en uygun kariyer vektörlerin** (sekiz arketipten — İşlevselci, İdareci, İletişimci, Uzman, Analist, Yenilikçi, Yönetici, Girişimci — hangileri en iyi oturuyor, özgeçmişinden kanıtlarla), bir **kariyer-tipi eğilimi**, bir dizi **önerilen rol**, özgeçmişinin gösterdiğine bağlı **mesleki güçlü yönlerin**, **çalışma-stili eğilimlerin** (birkaç eksende "özgeçmişinin nasıl okunduğu") ve uyumunu genişletmek için **gelişim önerileri**.

### Nasıl oluşturulur

Bu, **özgeçmişinin nasıl okunduğuna dair bir yapay zeka yansımasıdır — psikometrik bir test değil.** İstem tamamen kendi materyallerine dayanır: başarı uydurmaz ve sayısal test puanlarını asla ölçülmüş gibi bildirmez. Ayarlanmış bir API anahtarı yoksa, canlı bir profil yerine herhangi bir LLM'de çalıştırabileceğin kopyala-yapıştır bir istem alırsın. Diske hiçbir şey yazılmaz — profil her seferinde yeniden oluşturulur.

### Dışa aktarma

Profili saklamak için **.md indir**, **PDF olarak kaydet** veya **Kopyala**yı kullan — uygulamanın yapay zeka raporlarının genelinde kullanılan aynı dışa aktarma denetimleridir. PDF, mevcut satır içi PDF oluşturucudan geçer; Markdown ise doğrudan bir indirmedir.

## 29. CareerOps Manifestosu

career-ops — bu uygulamanın önyüzünü oluşturduğu üst proje — [CareerOps Manifestosu](https://career-ops.org/manifesto)'nun (üst proje v1.20.0) ilk referans uygulamasıdır. Manifesto, bu araç zincirinin varlık nedeni olan pratiği adlandırır: bir iş aramasını mühendislerin üretimi yönettiği gibi yönetmek — kanıtla, disiplinle ve masanın aday tarafında yer alan araçlarla.

### Ne diyor

Altı ilke — "daha az yere daha iyi başvur", "hacim yerine sinyal", "anahtar kelime yerine kanıt", "kararı insan verir", "önce yerel", "masanın her iki tarafında da onur" — artı yapay zekâ aracılı işe alım çağı için bir aday hakları bildirgesi: varsayılan olarak görünmezsin, hiç kimse senin evetin olmadan seni önermez, evetin insani bir eylemdir ve bir ajana devredilemez, asla ödeme yapmazsın, verilerin sana aittir. Uygulama bu kuralları tasarım gereği izler: hiçbir şey otomatik gönderilmez, her şey yerel olarak çalışır ve üretilen bir CV'deki her iddia kendi materyallerine dayanır.

### Okuma ve imzalama

Kenar çubuğu altbilgisindeki bağlantı manifesto sayfasını açar. `MANIFESTO.md` dosyasını üst projede de okuyabilir veya imza sayfasını açmak için orada `npm run manifesto` çalıştırabilirsin. İmzalamak isteğe bağlıdır ve on saniye sürer — imzan üst depodaki `SIGNATURES.md` defterinde herkese açık bir commit'e dönüşür. Uygulamadaki hiçbir şey imzalayıp imzalamadığına bağlı değildir.

## 30. Hermes & Telegram

**Nous Research’ün Hermes’i** açık, otonom bir ajandır — araç çağırma, skill’ler ve Telegram dahil 20’den fazla mesajlaşma kanalı. **v1.151.0’dan itibaren Hermes bağlı bir LLM sağlayıcısıdır:** OpenAI uyumlu API Server’ını (`hermes gateway`) çalıştırın, **Uygulama ayarları**’nda `HERMES_API_KEY` değerini ayarlayın ve career-ops-ui canlı değerlendirmelerini yerel Hermes’iniz üzerinden çalıştırsın. Bu bölüm ayrıca uygulamayı bir bulut sunucusunda çalıştırmayı ve olaylarını Hermes üzerinden Telegram’a köprülemeyi de anlatır — bu iki kısım operatörlere yönelik kılavuzdur, uygulama özelliği değildir. Tam kılavuz `docs/integrations/HERMES.md`’dedir ve `hermes-bridge` skill’i adımları izletir.

### Hermes nedir

Hermes, kendi LLM sağlayıcılarınıza bağlanan bir ajan çalışma zamanıdır — ve ayrıca bir **OpenAI uyumlu API Server** sunar: `hermes gateway`, `http://127.0.0.1:8642/v1` üzerinde bir Bearer anahtarıyla (kendi `API_SERVER_KEY`’i) `POST /v1/chat/completions` sunar. Bu yüzden career-ops-ui onu başka bir sağlayıcı gibi ele alır (kılavuzdaki «Shape A» yolu): uygulama, OpenAI veya Qwen için yaptığı gibi o yerel uç noktaya POST atar ve Hermes isteği içinde yapılandırdığınız modele yönlendirir. auto sırasında **en sonda** yer alır, dolayısıyla mevcut bir Anthropic/Gemini/OpenAI/Qwen kurulumunu asla geçersiz kılmaz.

### Bir bulut sunucusunda çalıştırma

career-ops-ui varsayılan olarak `127.0.0.1`'e bağlanır. Bir sunucuda yaşayan bir Hermes ajanına ulaşmak için loopback'ten dikkatle çıkarsınız. Uygulamayı loopback'e bağlı tutun ve önüne HTTPS'i sonlandıran bir reverse proxy (nginx veya Caddy) koyun; systemd veya pm2 altında root olmayan bir kullanıcı olarak çalıştırın; ve headless makinede üst proje career-ops ile salt-okunur sözleşmeyi bozulmadan koruyun. Güvenlik zarfı taşınmadan sonra da ayakta kalmalı: satır içi script içermeyen bir Content-Security-Policy, kullanıcının sağladığı her URL getirmede SSRF koruması, markdown/XSS sınırı ve loglarda hiçbir sır bulunmaması. Kılavuzda tam kontrol listesi var — `0.0.0.0`'ı asla doğrudan genel internete açmayın.

### Hermes üzerinden Telegram

Köprü, uygulama olaylarını — tamamlanmış bir tarama, yeni bir rapor, az önce aciliyet kazanmış bir takip — Hermes üzerinden bir Telegram sohbetine ulaştırır. Telegram bot jetonu career-ops-ui'de değil, Hermes'in kendi yapılandırmasında yaşar. Yalnızca yararlı asgariyi gönderin: "Tarama tamamlandı — 12 yeni eşleşme" ve kendinizin açtığı bir bağlantı. Kanala CV metnini, maaş rakamlarını, rapor gövdelerini, API anahtarlarını veya iç URL'leri **asla göndermeyin** — kılavuzun tehdit modeli "NELERİN açığa çıkarılmaması gerektiği" listesi kuraldır. Bu sayfaya `#/help` üzerinden erişilebilir ve uygulama içi belge asistanı sorulara buna dayanarak yanıt verir.

## 31. Tüm yığını bulutta çalıştırma

Çoğu kişi career-ops'u kendi laptopunda çalıştırır. Ama bu hat, **her zaman açık** olduğunda en iyi haline ulaşır — siz uyurken ilan panolarını tarar, izleyiciyi güncel tutar, herhangi bir cihazın tarayıcısında hazır bekler. Bu bölüm, **tüm yığını** küçük bir bulut sunucusuna kurmanın baştan sona tarifidir: üst **career-ops** hattı, bu **career-ops-ui** görüntüleyicisi ve yapay zekayı gerçekten çalıştıran **motor** — ister **Claude aboneliğiniz** (Claude Code CLI üzerinden), ister yerel bir **Hermes** ağ geçidi olsun. Bu bölüm §30'daki Hermes bulut notlarının üzerine inşa edilir; eksiksiz operatör kontrol listesi `docs/integrations/HERMES.md`'dedir.

### Üç hareketli parça

Yığın, birlikte çalışan üç parçadan oluşur ve bunları birbirinden ayrı tutmak faydalıdır. **career-ops** (üst proje) yapay zeka destekli iş arama hattıdır — `cv.md`, `config/`, `reports/` ve `portals.yml` dosyalarınıza sahiptir ve bir **ajan CLI** tarafından yönetilir. **career-ops-ui** (bu uygulama), career-ops'un *içinde* `web-ui/` olarak bulunan, büyük ölçüde salt-okunur bir web görüntüleyicisidir ve aynı dosyaları bir tarayıcıda gösterir; yalnızca açık eylemlerle geri yazar. **Motor**, yapay zeka istemlerine gerçekten yanıt veren şeydir. Üç parçadan ikisi bir sunucuda da laptopunuzda olduğu gibidir — sadece motor seçimi ve ağa açılma şekli değişir.

### Kaynak ayır ve kur

Küçük bir VPS kiralayın (görüntüleyici için 1 vCPU / 1 GB RAM fazlasıyla yeterlidir), güncel bir Linux çalıştırın ve **Node ≥ 18** kurun (22.5 ve üzeri önerilir — üst projenin SQLite izleyici indeksini etkinleştirir). `git` kurun. Ardından yerel bir kurulumun yaptığı şeyin aynısını yapın: üst proje `career-ops`'u klonlayın ve bu depoyu içine `career-ops/web-ui/` olarak klonlayın. Sağlayıcı anahtarlarını üst projenin `.env`'ine koyun (asla commit etmeyin — `.env` / `.env.*` gitignore'dadır; `.env.example`'dan başlayın). Görüntüleyiciyi `npm start` ile çalıştırın — ama `127.0.0.1`'e bağlı tutun; onu doğrudan değil, bir proxy üzerinden açığa çıkaracaksınız (aşağıya bakın).

### Motorunuzu seçin

career-ops CLI'dan bağımsızdır, yani yapay zeka için üç dürüst seçeneğiniz vardır. **Claude aboneliğiniz** — makineye **Claude Code** CLI'sini kurun ve Pro/Max planınızla `claude login` yapın; üst projenin ajanı ardından abonenliğinizi kullanır, token bazlı API faturası olmadan. **Hermes** — aynı makinede `hermes gateway` çalıştırın (`http://127.0.0.1:8642/v1` adresinde OpenAI uyumlu bir API açığa çıkarır) ve **Uygulama ayarları**'nda `HERMES_API_KEY` belirleyin; career-ops-ui'nin canlı değerlendirmeleri bunun üzerinden geçer (otomatik sağlayıcı sıralamasında en son). **API anahtarları** — üst projenin `.env`'inde `ANTHROPIC_API_KEY`'i (veya yedi sağlayıcıdan herhangi birini: Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes → DeepSeek → GLM (Z.ai) → Kimi (Moonshot) → MiniMax → Mistral → Grok (xAI) → Together → Fireworks → Ollama → BytePlus Ark → Volcengine Ark) belirleyin ve ⚡ canlı eylemler gözetimsiz çalışır. Bunları birleştirebilirsiniz: üst projenin ağır ajan işi için bir Claude aboneliği, görüntüleyicinin hızlı değerlendirmeleri için ucuz veya yerel bir sağlayıcı.

### Güvenle açığa çıkarın

`127.0.0.1`'den çıkmak, loopback'in ücretsiz sağladığı güvenliğin şimdi açıkça inşa edilmesi gerektiği anlamına gelir — **kod aynıdır; değişen sadece açığa çıkma şeklidir.** Uygulamayı loopback'e bağlı tutun ve önüne **HTTPS**'i sonlandıran (Let's Encrypt / otomatik TLS) ve `127.0.0.1:4317`'ye yönlendiren bir reverse proxy (**nginx** veya **Caddy**) koyun; bunu **systemd** veya `pm2` altında, `Restart=on-failure` ile özel bir **root olmayan** kullanıcı olarak çalıştırın. Önüne **kimlik doğrulamayı** da koyun — uygulamanın kendi girişi yoktur, yabancıları dışarıda tutan şey proxy'dir (basic-auth, bir SSO forward-auth veya özel bir ağ / VPN). Proxy'nin ona erişebilmesi için `HOST=0.0.0.0` ayarladığınızda, loopback'te bir no-op olan yerleşik güçlendirme devreye girer ve gerçekten işlevsel hale gelir: LLM hız sınırı, `safeGet`'in DNS-rebinding savunması ve yol adı temizleme. Taşınmadan sonra hayatta kalması gereken ve gevşetmemeniz gereken dört değişmez vardır: **CSP** (satır içi script yok, `frame-ancestors 'none'` — proxy bu başlıkları kaldırmamalıdır), kullanıcının sağladığı her URL getirmesinde **SSRF koruması**, **markdown/XSS sınırı** (sunucu tarafında `stripDangerousMarkdown()` + istemci tarafında önce kaçışlı `UI.md()`), ve **loglarda hiçbir sır bulunmaması**. Üst projenin salt-okunur sözleşmesi headless makinede de geçerliliğini sürdürür — sunucu yalnızca `cv.md` / `config/` / `reports/` dosyalarınızı okur ve açık eylemlerle yazar.

## 32. OpenWorker'dan çalıştırma (yapay zeka iş arkadaşı)

Tarayıcı yerine bir masaüstü yapay zeka iş arkadaşını mı tercih edersiniz? **[career-ops-coworker](https://github.com/Fighter90/career-ops-coworker)**, tüm bu hattı sizin için yürüten bir **[OpenWorker](https://github.com/andrewyng/openworker)** iş arkadaşıdır (Andrew Ng'nin açık kaynaklı, yerel öncelikli yapay zeka iş arkadaşı uygulaması) — panoları tarar, CV'nize karşı uygunlukları puanlar, temellendirilmiş bir CV + ön yazı uyarlar, başvuruları izler, takip mesajı taslakları hazırlar — ve istek üzerine **bu paneli açabilir**. Tek, kod içermeyen bir Markdown "persona"dır; OpenWorker bunun hiçbirini bir program olarak çalıştırmaz, talimatlar yalnızca ajanı yönlendirir. Kılavuzu 17 dilin tamamında sunulur.

### İş arkadaşı ne yapar

`career-ops` proje klasörünüzün içinde çalışan iş arkadaşı, hattın yaptığı adımların aynısını yürütür: `portals.yml` dosyanızdaki panoları tarar (token harcamadan), her ilanı `cv.md` + `config/profile.yml` dosyanıza karşı 0–5 arasında puanlar ve — istek üzerine — **yalnızca** CV'nizde zaten var olan gerçeklere dayandırılmış, role özgü bir CV + ön yazı uyarlar (asla bir işveren, tarih ya da metrik uydurmaz). `data/applications.md` dosyasını günceller, takip e-postaları taslaklar ve mülakat slotları yerleştirebilir — her gönderim ya da yazma işlemi **onaya bağlı**, tıpkı career-ops'un kendi doktrini gibi. Bu görüntüleyiciyi açmak için `bash web-ui/bin/start.sh` (veya `npm start`) çalıştırır ve size `http://127.0.0.1:4317` adresini verir.

### Kurulum ve başlatma

OpenWorker'ı kurun ve bir model anahtarı ekleyin (Anthropic / OpenAI / Google veya yerel Ollama). En hızlısı **tek komut** — coworker'ın sürdüğü `career-ops` hattını hazırlar ve idempotenttir: mevcut `career-ops` / `web-ui`'yi verilerinizin üzerine yazmadan yeniden kullanır:

```bash
curl -fsSL https://raw.githubusercontent.com/Fighter90/career-ops-coworker/main/install.sh | bash
```

Ardından coworker'ı OpenWorker'ın **Install a coworker** panelinden ekleyin — **GitHub URL** (`https://github.com/Fighter90/career-ops-coworker`), **.zip** ([Releases](https://github.com/Fighter90/career-ops-coworker/releases)'ten) veya `career-ops.md`'yi **içe aktararak**. Bir **Job-Search Coworker** oturumu açın, `career-ops` klasörünüzü seçin ve gerçek bir şey isteyin — *"panolarımı tara ve bu haftanın en iyi 5 eşleşmesini ver"* ya da *"panoyu aç."* Bağlayıcılar (Gmail, Google Calendar, GitHub) ve tam kılavuz deponun [yardım kılavuzunda](https://github.com/Fighter90/career-ops-coworker/tree/main/help). OpenWorker'ın yükleyicisine ve depo yükleyicisine karşı kurulabilirliği doğrulandı.
