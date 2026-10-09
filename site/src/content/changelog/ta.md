# மாற்றப் பதிவு (தமிழ்)

> இந்த மாற்றப் பதிவு v1.245.0-இல் தொடங்குகிறது — தமிழ் மொழியாக்கம் சேர்க்கப்பட்ட பதிப்பு. முந்தைய பதிப்புகளுக்கு [🇬🇧 CHANGELOG.md](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md) பார்க்கவும்.

மொழிபெயர்ப்புகள்: [🇬🇧 English](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md) · [🇪🇸 Español](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.es.md) · [🇧🇷 Português](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.pt-BR.md) · [🇰🇷 한국어](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ko-KR.md) · [🇯🇵 日本語](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ja.md) · [🇷🇺 Русский](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ru.md) · [🇨🇳 简体中文](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.zh-CN.md) · [🇹🇼 繁體中文](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.zh-TW.md) · [🇫🇷 Français](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.fr.md) · [🇵🇱 Polski](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.pl.md) · [🇺🇦 Українська](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.uk.md) · [🇩🇰 Dansk](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.da.md) · [🇸🇦 العربية](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ar.md) · [🇩🇪 Deutsch](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.de.md) · [🇮🇹 Italiano](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.it.md) · [🇹🇷 Türkçe](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.tr.md) · [🇮🇳 हिन्दी](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.hi.md)

---

## [1.246.0] — 2026-10-09

**CAR-48 சீனியர்-டிசைன் ஆய்வின் முதன்மை பத்து கண்டறிதல்களும் சரி செய்யப்பட்டன — தடையில்லாத (blocker) ஒன்றும் ஏழு major-களும் உட்பட.**

### சரி செய்யப்பட்டது

- **Apply இருள் முறை: தகவல் அட்டையின் இணைப்பு மீண்டும் தெரிகிறது.** அட்டை இருள் முறையிலும் வெளிர் மேற்பரப்பையே வைத்திருந்தது; «Need Playwright? See …» இணைப்பு ≈1.0:1-இல் இருந்தது. தீம்-விழிப்புணர்வு `.callout--info` (surface/border/text/link டோக்கன்கள்) இருளில் இணைப்பை ≈7.3:1 ஆக உயர்த்துகிறது.
- **RTL இனி எண் இயைபுகளைப் புரட்டுவதில்லை.** மதிப்பெண் மாத்திரைகள் («1.5 / 5»), அறிக்கை வரிசைகள் («≥ 4.5», «< 3.5»), டாஷ்போர்டின் «/ 5.0» ஆகியவை திசை ஒதுக்கீடு (LTR span) பெறுகின்றன; ar அகராதி வாக்கியத்தில் இயல்பான இடங்களில் எண் வரம்புகளைச் சொற்களாக மாற்றியுள்ளது.
- **CV மார்க்டவுன் LTR-இலேயே.** அரபியில் textarea மற்றும் முன்தோற்றம் `dir="ltr"`-உடன் வரையப்படுகின்றன; சுற்றியுள்ள சட்டகம் RTL-இலேயே.
- **அறிக்கைகளின் DATE நெடுவரிசை ISO தேதியை இனி உடைக்காது** (nowrap + அட்டவணை இலக்கங்கள்).
- **பக்கப்பட்டி USAGE HUD-க்கு மேலே முடிகிறது** (ஸ்க்ரோல்போர்ட் ஒதுக்கீடு + மங்கல்) — கடைசி வழிசெலுத்தல் உருப்படி பலகத்தின் கீழே செல்வதில்லை; RTL-க்கும் கண்ணாடி முறை.
- **கைபேசி scan @390: «Save search» முழுமையாகத் தெரிகிறது** — கட்டுப்பாட்டு வரிசை மடிந்து சுருங்குகிறது, விளிம்பில் வெட்டாது.
- **வரைபடக் கட்டுப்பாடுகள் இருள் தீமையைப் பின்பற்றுகின்றன** (zoom, அடுக்குகள், பண்புக்குறிப்பு). டைல்கள் வேண்டுமென்றே மாறவில்லை: அவற்றின் மூலம் சர்வர்-பக்க CSP `img-src`-ஆல் பூட்டப்பட்டுள்ளது.
- **அரட்டை FAB இனி ஊடாடும் உள்ளடக்கத்தை மறைப்பதில்லை** — பக்க ஸ்க்ரோல்-பேடிங் இடம் விடுகிறது (Portals-இன் Disable பொத்தான்கள், Reports-இன் மதிப்பெண் மாத்திரை, two-pager உள்ளீடு, Leaflet பண்புக்குறிப்பு).
- **செயல்பாட்டு பதிவு UI மொழியில் பேசுகிறது**: 22 செயல் slugs ×18 மொழிகளில் மொழிபெயர்ப்பு (தெரியாதவற்றுக்கு மூல id fallback), வடிகட்டி சிப்கள் மொழிபெயர்ப்பு; TARGET நெடுவரிசை இருக்கிறது — auto-pipeline அதை நிரப்புகிறது.
- **Assessments படிவங்களுக்கு உண்மையான லேபிள்கள்** (வாக்கிய வரிசை பெரிய எழுத்து, `htmlFor`/`id` இணைப்பு) — placeholder மட்டும் நிலையிலிருந்து முன்னேற்றம்.

### குறிப்புகள்

- இந்த வெளியீட்டில் இல்லை: வரைபடத்தின் இருள் டைல்கள் (CSP `img-src` விரிவாக்கம் தேவை — சர்வர்-பக்க மாற்றம், கிளையண்ட்-பக்கம் வேண்டுமென்றே செய்யவில்லை); மஞ்சள் callout-களின் இருள் வடிவங்கள் (`config`, `batch`) — டோக்கன் இயக்கம் தொடர்வேலைக்குத் தயார்.

## [1.245.0] — 2026-10-09

**தமிழ் (Tamil) 18வது UI மொழியாக இணைகிறது — 17-மொழி அலைக்குப் பிறகு முதல் புதிய மொழி, முழு விசை இணக்கத்துடன்.**

### சேர்க்கப்பட்டது

- **தமிழ் (`ta`): 1449/1449 விசைகள்** — `en`-உடன் முழு இணக்கம், எந்த பிளேஸ்ஹோல்டரும் இழக்கப்படவில்லை, hi-பாணி இந்திக்-டெக் மரபுகள் (வழங்குநர்கள், மாடல் பெயர்கள், பாதைகள், கட்டளைகள் இலத்தீன் எழுத்திலேயே). `detect()` `ta`, `ta-IN`, `ta-LK` ஏற்கிறது; தமிழ் LTR (சோதனையால் பூட்டப்பட்டது).
- **முழு docs/help/ta.md** (33 H2 / 125 H3, மூல எண்ணிக்கைகள் நேரடி பதிவேட்டுடன் சரிபார்க்கப்பட்டன, Hermes கேனரி நங்கூரங்கள், சொல்லுக்குச் சொல் YAML), மேலும் README.ta.md, CHANGELOG.ta.md கண்ணாடிகள்.
- **கணக்கீட்டு வாயில்கள் 17 → 18**: LANGS, detect புரோப்கள், i18n தணிக்கை, மாற்றப் பதிவு இணக்கம், RTL காவலர், CI `langs` — அத்துடன் CI பட்டியலில் இதுவரை இல்லாத `hi`-யும்.

### குறிப்புகள்

- cvstart.org தரையிறக்க பக்கம் தற்போது 17 மொழிகளிலேயே உள்ளது — அதன் மொழிபெயர்ப்பு தனி பணி; தள உள்ளடக்க ஒத்திசைவு ஏற்கனவே docs/help/ta.md மற்றும் ta மாற்றப் பதிவை வழங்குகிறது.
- `report-header.js`-இன் REPORT_LABELS 17-இலேயே — தமிழ் அறிக்கை பிரிப்பான் பெற்றோர் ரெப்போவில் தமிழ் அறிக்கை உருவாக்கத்துடன் வரும்.

