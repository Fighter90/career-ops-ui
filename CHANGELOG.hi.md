# परिवर्तन-सूची (हिन्दी)

> यह परिवर्तन-सूची v1.122.0 से शुरू होती है — वह संस्करण जिसमें हिन्दी स्थानीयकरण जोड़ा गया। पिछले संस्करणों के लिए [CHANGELOG.md](CHANGELOG.md) देखें।

## [1.124.0] — 2026-07-21

### जोड़ा गया
- **पाँच स्कैन स्रोत** (पैरेंट v1.22.0 समता, #1808/#1572/#2024/#2055) — **Welcome to the Jungle** (बोर्ड-वाइड JSON API), **Agentic Engineering Jobs** (agentic/AI-इंजीनियरिंग बोर्ड), **Jobvite** (ज़ीरो-ऑथ per-tenant ATS), **Gem** (per-tenant ATS), और **Alibaba Group** (careers JSON API, Meituan/Tencent पैटर्न)। हर एक होस्ट-पिन किया गया, CI-आइसोलेटेड स्रोत + adapter जोड़ा है; रजिस्ट्री अब **67 अडैप्टर (62 EN + 5 RU)** शिप करती है; `#/scan` Source-dropdown फ़ॉलबैक और उसका ड्रिफ़्ट-गेट अपडेट किए गए; पाँच नए सुइट `tests/sources-{wttj,agenticjobs,jobvite,gem,alibaba}.test.mjs`।

### सुधारा गया
- **Arbeitsagentur: nationwide-remote केवल तब जब `homeofficetyp` `VOLLSTAENDIG` हो** (पैरेंट #1981) — `homeoffice=nv_true` क्वेरी हाइब्रिड भूमिकाएँ भी लौटाती है, इसलिए रिमोट पास अब हर हिट को job-details endpoint के ख़िलाफ़ छोटे बैचों में पुष्टि करता है और fail-closed रहता है (लुकअप एरर होने पर जॉब का असली शहर बना रहता है ताकि लोकेशन फ़िल्टर लागू रहें)।
- **SmartRecruiters: पब्लिक जॉब URL `/postings/` के बिना बनते थे** (पैरेंट #2047) — लिंक अब उन टेनेंट्स के लिए भी सही पब्लिक पोस्टिंग पेज पर पहुँचते हैं जिनकी पब्लिक साइट यह सेगमेंट ड्रॉप करती है, न कि 404 पर।

### टिप्पणियाँ
- पैरेंट v1.22.0 ने CLI-साइड बदलाव भी शिप किए जिनमें वेब UI शेल-आउट नहीं करता या जिन्हें यह पहले से कवर करता है: zh-CN CV टेम्पलेट + PDF टाइपोग्राफ़ी, `/expand` मोड, प्रोवाइडर prompt-cache ट्वीक्स (Gemini/OpenAI/Ollama), प्रति-स्टेप टोकन ब्रेकडाउन (वेब UI का अपना usage मीटर है), tracker writer-lock सीरियलाइज़ेशन (वेब UI v1.21 से `withFileLock` के ज़रिए राइट्स रूट करता है), scan `visa_filter` + absolute posted-date CLI फ़्लैग्स (वेब UI का अपना "Posted within" एज फ़िल्टर है), और seen-sources डीड्यूप सीडिंग (वेब UI स्कैनर अपना ख़ुद का scan-history डीड्यूप रखता है)।

## [1.123.0] — 2026-07-17

### जोड़ा गया
- **Oracle Recruiting Cloud स्कैन स्रोत** (पैरेंट v1.21.0 समता, #1929) — Oracle Fusion/ORC करियर साइट्स (JPMorgan Chase, Oracle, BNY Mellon, American Express, Honeywell, …) का ज़ीरो-ऑथ `recruitingCEJobRequisitions` REST API: `*.fa[.<region>][.ocs].oraclecloud.com` पर होस्ट-पिन किया गया, साइट नंबर हर ट्रैक की गई कंपनी के `careers_url` से निकाला जाता है, हार्ड पेज-कैप वाला ऑफ़सेट पैजिनेशन, और WAF-जागरूक ब्राउज़र-जैसे हेडर। रजिस्ट्री अब **62 अडैप्टर (57 EN + 5 RU)** शिप करती है; `#/scan` Source-dropdown फ़ॉलबैक और उसका ड्रिफ़्ट-गेट अपडेट किए गए; नया CI-आइसोलेटेड सुइट `tests/sources-oraclecloud.test.mjs`।

### सुधारा गया
- **Repost डिटेक्टर: बेस टाइटल विशेष-सफ़िक्स वाले सिबलिंग्स से अलग बने रहते हैं** (पैरेंट #1922) — "Senior Analytics Engineer" अब "Senior Analytics Engineer, People Analytics" के साथ क्लस्टर नहीं होता: जब एक टाइटल के टोकन दूसरे टाइटल के टोकन का एक सख़्त सबसेट होते हैं और अतिरिक्त टोकन एक वास्तविक विशेषज्ञता (बेसलाइन शब्द नहीं) होता है, तो दोनों को अलग-अलग पोस्ट होने योग्य ओपनिंग माना जाता है। Reposting एनोटेशन्स ("(Repost)", "relisted") अब मेटा-नॉइज़ के रूप में स्टॉपवर्ड किए जाते हैं। `tests/detect-reposts.test.mjs` में +2 assertions।

### टिप्पणियाँ
- पैरेंट v1.21.0 ने CLI-साइड बदलाव भी शिप किए जिनमें वेब UI शेल-आउट नहीं करता या जिन्हें यह पहले से कवर करता है: रिपीट-कंपनी रीअप्लाई चेतावनी (वेब UI में v1.84.0 से री-अप्लाई कूलडाउन पहले से मौजूद है), cover-letter के `--format`/`--report` फ़्लैग्स, इंटरव्यू red-flag / panel-intel / no-show ईमेल प्रॉम्प्ट मोड्स, scan trust-signal व portal-health पर्सिस्टेंस (वेब UI अपना ख़ुद का इन-प्रोसेस स्कैनर `trust-validator` और Portals health पेज के साथ चलाता है), और stats/salary-gap एक्सटेंशन (रीड-ओनली और fail-soft तरीक़े से रिले किए गए)।

## [1.122.0] — 2026-07-16

### जोड़ा गया
- **हिन्दी (हिन्दी) — 17वीं भाषा** — पूरा UI शब्दकोश (~1,110 कुंजियाँ), सम्पूर्ण इन-ऐप सहायता गाइड (29 H2 / 105 H3 समता), `README.hi.md`, नई `CHANGELOG.hi.md` (v1.122.0 से शुरू, de/it/tr की मिसाल पर), cvstart.org लैंडिंग + Methodology/License/Changelog/Help पेज, भाषा स्विचर (🇮🇳), ब्राउज़र-भाषा की स्वतः पहचान, और स्थानीयकृत डैशबोर्ड स्क्रीनशॉट। हर ×16 समता-गेट अब ×17 चलता है: i18n शब्दकोश समता + स्नैपशॉट, सहायता H2/H3 गेट, CHANGELOG समता, साइट `check-i18n`, और Playwright लोकेल स्वीप।
