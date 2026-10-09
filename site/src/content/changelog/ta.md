# மாற்றப் பதிவு (தமிழ்)

> இந்த மாற்றப் பதிவு v1.245.0-இல் தொடங்குகிறது — தமிழ் மொழியாக்கம் சேர்க்கப்பட்ட பதிப்பு. முந்தைய பதிப்புகளுக்கு [🇬🇧 CHANGELOG.md](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md) பார்க்கவும்.

மொழிபெயர்ப்புகள்: [🇬🇧 English](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md) · [🇪🇸 Español](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.es.md) · [🇧🇷 Português](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.pt-BR.md) · [🇰🇷 한국어](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ko-KR.md) · [🇯🇵 日本語](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ja.md) · [🇷🇺 Русский](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ru.md) · [🇨🇳 简体中文](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.zh-CN.md) · [🇹🇼 繁體中文](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.zh-TW.md) · [🇫🇷 Français](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.fr.md) · [🇵🇱 Polski](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.pl.md) · [🇺🇦 Українська](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.uk.md) · [🇩🇰 Dansk](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.da.md) · [🇸🇦 العربية](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.ar.md) · [🇩🇪 Deutsch](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.de.md) · [🇮🇹 Italiano](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.it.md) · [🇹🇷 Türkçe](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.tr.md) · [🇮🇳 हिन्दी](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.hi.md)

---

## [1.245.0] — 2026-10-09

**தமிழ் (Tamil) 18வது UI மொழியாக இணைகிறது — 17-மொழி அலைக்குப் பிறகு முதல் புதிய மொழி, முழு விசை இணக்கத்துடன்.**

### சேர்க்கப்பட்டது

- **தமிழ் (`ta`): 1449/1449 விசைகள்** — `en`-உடன் முழு இணக்கம், எந்த பிளேஸ்ஹோல்டரும் இழக்கப்படவில்லை, hi-பாணி இந்திக்-டெக் மரபுகள் (வழங்குநர்கள், மாடல் பெயர்கள், பாதைகள், கட்டளைகள் இலத்தீன் எழுத்திலேயே). `detect()` `ta`, `ta-IN`, `ta-LK` ஏற்கிறது; தமிழ் LTR (சோதனையால் பூட்டப்பட்டது).
- **முழு docs/help/ta.md** (33 H2 / 125 H3, மூல எண்ணிக்கைகள் நேரடி பதிவேட்டுடன் சரிபார்க்கப்பட்டன, Hermes கேனரி நங்கூரங்கள், சொல்லுக்குச் சொல் YAML), மேலும் README.ta.md, CHANGELOG.ta.md கண்ணாடிகள்.
- **கணக்கீட்டு வாயில்கள் 17 → 18**: LANGS, detect புரோப்கள், i18n தணிக்கை, மாற்றப் பதிவு இணக்கம், RTL காவலர், CI `langs` — அத்துடன் CI பட்டியலில் இதுவரை இல்லாத `hi`-யும்.

### குறிப்புகள்

- cvstart.org தரையிறக்க பக்கம் தற்போது 17 மொழிகளிலேயே உள்ளது — அதன் மொழிபெயர்ப்பு தனி பணி; தள உள்ளடக்க ஒத்திசைவு ஏற்கனவே docs/help/ta.md மற்றும் ta மாற்றப் பதிவை வழங்குகிறது.
- `report-header.js`-இன் REPORT_LABELS 17-இலேயே — தமிழ் அறிக்கை பிரிப்பான் பெற்றோர் ரெப்போவில் தமிழ் அறிக்கை உருவாக்கத்துடன் வரும்.

