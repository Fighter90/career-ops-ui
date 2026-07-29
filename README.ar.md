# career-ops-ui

> واجهة ويب أنيقة بأسلوب التوثيق التقني لخط أنابيب البحث عن عمل بالذكاء الاصطناعي — [career-ops](https://github.com/Fighter90/career-ops).
> ابحث عن الوظائف وقيّمها واستكشفها وقدّم طلباتك وتتبّع كل عرض من تبويب واحد في المتصفح — بدلاً من التنقل بين Claude Code والطرفية وملفات markdown.

[🇬🇧 English](README.md) | [🇪🇸 Español](README.es.md) | [🇧🇷 Português (Brasil)](README.pt-BR.md) | [🇰🇷 한국어](README.ko-KR.md) | [🇯🇵 日本語](README.ja.md) | [🇷🇺 Русский](README.ru.md) | [🇨🇳 简体中文](README.zh-CN.md) | [🇹🇼 繁體中文](README.zh-TW.md) | [🇫🇷 Français](README.fr.md) | [🇵🇱 Polski](README.pl.md) | [🇺🇦 Українська](README.uk.md) | [🇩🇰 Dansk](README.da.md) | **🇸🇦 العربية** | [🇩🇪 Deutsch](README.de.md) | [🇮🇹 Italiano](README.it.md) | [🇹🇷 Türkçe](README.tr.md) | [🇮🇳 हिन्दी](README.hi.md)

_واجهة غير رسمية — لا علاقة لها بـ career-ops / santifer ولا تحظى بموافقتهما._

[![tests](https://img.shields.io/badge/tests-2066%20passed-brightgreen)](#الاختبارات)
[![e2e](https://img.shields.io/badge/e2e-23%2F23%20%2B%2020%2F20-brightgreen)](#الاختبارات)
[![playwright](https://img.shields.io/badge/playwright-CI%20green-brightgreen)](#الاختبارات)
[![node](https://img.shields.io/badge/node-%E2%89%A518-blue)](#المتطلبات)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![release](https://img.shields.io/badge/release-v1.128.0-blue)](https://github.com/Fighter90/career-ops-ui/releases/tag/v1.128.0)

> **🆕 أحدث إصدار — v1.128.0**
>
> **أربعة نقلات من تطبيق ويب المشروع الأب.** يعيد v1.128.0 تنفيذ أربعة حلول من تطبيق Next.js الخاص بـ career-ops بجافاسكريبت خام: يقرأ المتتبِّع الحالات القياسية مباشرةً من `templates/states.yml` (بلا قائمة بيضاء مبرمَجة)، وشعارات العلامات الآن في الصفوف المستضافة على ATS عبر خريطة اسم→نطاق، ودرجة لون رباعية أدق، ومكتبة أوجه بلا رموز. **2066 اختبارًا**. **تكافؤ الأب v1.23.0.** ينقل v1.127.0 ثلاثة مصادر مسح جديدة — **Flowxtra** و**VDAB** و**iCIMS** (السجل الآن **70 محوّلاً**، 65 EN + 5 RU) —، ويعكس انتقال agenticjobs إلى REST واستعادة المدينة في Greenhouse وإصلاحات role-matcher، ويعيد **Cursor** إلى قائمة الـCLI (parent #2115 — يُبلّغ `cli-detect` عن 10 أدوات). **ترقيع انحراف قائمة CLI.** يُصلح v1.126.1 نقطتين فوّتهما مسح v1.126.0: مقدّمة تبويب API keys في `#/config` (i18n ×17) تسرد الآن Antigravity + Grok Build، وصفّ قديم `Cursor / Gemini CLI` في دليل المساعدة ×17 (وhelp الموقع) صار يحمل قائمة الـ8 واجهات كاملةً. **إعادة مزامنة التوثيق وقائمة CLI.** يُطابق v1.126.0 كل واجهة توثيق (help ×17، README ×17، wiki) مع career-ops.org/docs الحيّة (قُرئت الـ31 صفحة) ويُعلّم مسح أدوات AI CLI في `#/config` اكتشاف كل الواجهات الثماني من الدرجة الأولى — تنضمّ **Grok Build CLI** و**Kimi CLI** إلى Claude Code وCursor وCodex وOpenCode وAntigravity وQwen وCopilot (الآن **9 أدوات**، وما زالت لا تُشغَّل أبداً). **مزامنة صيانة.** يجمع v1.125.4 تحديثات dependabot في site (`sharp` 0.35.3 و`svgo` 4.0.2 و`fast-uri` 3.1.4) ويسجّل مسح تكافؤ مع المشروع الأب (بعد v1.22.0، #2108–#2168): حارس الصف الخاطئ في set-status وRisk Summary للأوضاع المترجمة والتحقق من manifest المحدِّث كلها في جانب CLI — لا شيء يُنقل (**1969 اختبارًا** دون تغيير). **إصلاح لغة المطالبات.** يجعل v1.125.3 الدنماركية والهندية مدعومتين بالكامل في كل مطالبة ذكاء اصطناعي — البحث المعمّق (المباشر واليدوي)، الأوضاع، التقييم، المقابلة، التواصل وCV Studio تُصدر الآن توجيه `# Output language` في هاتين اللغتين (كانت الإجابات تأتي بالإنجليزية)، وبوابة اللغات تفحص الآن كل اللغات الـ17 (**1969 اختبارًا**). **حزمة المساهمين الخارجيين.** يدمج v1.125.2 أولى مساهمات المجتمع من [@Alien10140](https://github.com/Alien10140) — إصلاح HTTP 502 في البحث المعمّق المباشر (موجّهات بلا أدوات لمزوّدي API) ورفع نماذج Gemini الافتراضية من `gemini-2.0-flash` الموقوف إلى `gemini-3.6-flash`، مثبّتة ببوابة انحراف جديدة من 5 اختبارات (**1957 اختبارًا**). ويحافظ v1.125.1 على مسار العلامة لمستأجري SuccessFactors RMK متعددي العلامات (الأصل ‎#2099). **مصادر الوظائف على الصفحة الرئيسية.** يضيف الإصدار v1.125.0 قسمًا على cvstart.org يسرد **جميع مصادر المسح الـ67** كشرائح قابلة للنقر، تُزامَن مع السجل عند البناء وتُحمى من الانحراف. وقبل ذلك، **تكافؤ مع الأصل v1.22.0.** يضيف الإصدار v1.124.0 **خمسة مصادر مسح** — Welcome to the Jungle وAgentic Engineering Jobs وJobvite وGem وAlibaba Group (**70 محوّلاً** الآن) — إضافةً إلى التحقّق من العمل عن بُعد بالكامل في Arbeitsagentur (`homeofficetyp=VOLLSTAENDIG`) وإصلاح رابط الوظيفة العام في SmartRecruiters.
>
> _4 نقلات web/ · states.yml مباشرة · شعارات اسم→نطاق · درجة اللون · أوجه · تكافؤ الأب v1.23 · +3 مصادر · 70 محوّلاً · Cursor · ترقيع انحراف قائمة CLI · إعادة مزامنة التوثيق وقائمة CLI · مزامنة صيانة · إصلاح لغة المطالبات da/hi · حزمة المساهمين الخارجيين · إصلاح 502 للبحث المعمّق · افتراضيات Gemini 3.6 · إصلاح مسار علامة SF · قسم مصادر الوظائف على الصفحة · 5 مصادر · 67 محوّلاً · تكافؤ مع الأب v1.22 · Oracle Cloud · 62 محوّلاً · تكافؤ مع الأب v1.21 · الهندية · 17 لغة · بيان CareerOps · صفحات منهجية/رخصة/سجل تغييرات cvstart.org · تكافؤ مع الأب v1.19 · 61 محوّلاً · نجوم مباشرة + مساهمون على الصفحة · تكافؤ الأب v1.18 · 54 محوّلًا · حالة Hired · إحصاءات إجمالية · حزمة التكافؤ · 50 محوّلاً · إعادة تصميم مقياس الاستخدام · صقل التصميم · مقياس الاستخدام · مساعد مساعدة عائم · دمج التوثيق وضمان الجودة · إغلاق متأخّرات الأمان · الوثائق وضمان الجودة ×16 · استبعاد Scan · نظرة عامة على المسار · تعزيز الأمان 2 · تعزيز أداة التعقيم · تعزيز الأمان · استخدام الذكاء الاصطناعي وتكلفته · شعارات الشركات · أدوات CLI للذكاء الاصطناعي · اسأل الدليل · تكييف السيرة + خطاب · تعبئة تلقائية للوثيقة · تصدير DOCX · صحة البوابات · مُبلّغ الأخطاء المدمج · الإحصاءات، مُعاد تصميمها · 16 locales · 6 مزوّدات LLM · 46 محوّل ماسح · التوجيه المهني · خطة المسار المهني · طبقة الذاكرة · CV Studio · مخطّط تواصل مهني · مقابلة تجريبية · ملاءمة السوق عبر two-pager · تكافؤ مع المشروع الأصلي career-ops v1.16.0._

![career-ops-ui](./images/dashboard-ar.png)

<div dir="rtl">

## نبذة عن career-ops

[career-ops](https://career-ops.org) نظام مفتوح المصدر للبحث عن عمل يعمل على شكل أوامر slash داخل أي واجهة سطر أوامر للذكاء الاصطناعي (Claude Code وCursor وCodex وOpenCode وAntigravity CLI وGrok Build CLI وQwen Code وKimi وGitHub Copilot CLI وGemini CLI (legacy) — وتعمل واجهات CLI الأخرى المتوافقة مع Claude أيضاً). يقيّم كل وظيفة مقارنةً بسيرتك الذاتية وفق مقياس سداسي الأبعاد من 0,0 إلى 5,0، ويُنشئ ملفات PDF لسيرة ذاتية مخصّصة، ويتتبّع كل طلب محلياً — دون حسابات سحابية أو إرسال تلقائي أو جمع بيانات.

**هذا المستودع (career-ops-ui)** واجهة ويب متكاملة فوق career-ops. تظل واجهة CLI مسؤولة عن ملء النماذج (عبر Playwright MCP) وأوامر slash؛ أما تطبيق الصفحة الواحدة (SPA) فيمنحك سطحاً يشبه نظام CRM في المتصفح فوق نفس الملفات `cv.md` و`data/applications.md` و`reports/`. كلاهما يشتركان في البيانات ذاتها.

**عتبات الإجراء حسب النتيجة** (من [career-ops.org/docs](https://career-ops.org/docs)):

| النتيجة | الخطوة التالية |
|---|---|
| **≥ 4.5** | `/career-ops apply` — تطابق عالٍ، قدّم طلبك فوراً |
| **4.0 – 4.4** | تقديم الطلب أو `/career-ops contacto` للحصول على تزكية |
| **3.5 – 3.9** | `/career-ops deep` — ابحث أولاً عن الشركة |
| **< 3.5** | تجاهل ما لم يكن ثمة سبب محدد |

**الأدلة الرسمية** على [career-ops.org/docs](https://career-ops.org/docs):

- [ما هو career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [مسح بوابات الوظائف](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [التقديم على وظيفة](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [التقييم الجماعي للعروض](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [إعداد Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
- [كيف يقيّم career-ops الوظائف المُدرجة — المنهجية](https://career-ops.org/methodology)

## بيان CareerOps

career-ops هو أول تطبيق مرجعي [لبيان CareerOps](https://career-ops.org/manifesto) — ممارسة إدارة البحث عن عمل بالأدلة والانضباط وبأدوات في صف المرشّح على طاولة المفاوضات. اقرأه. وإن كان يعبّر عمّا تؤمن به، وقّعه — يصبح توقيعك التزاماً (commit). يربط التطبيق إليه من تذييل الشريط الجانبي.

## الميزات الرئيسية

| الصفحة | الوصف |
|---|---|
| **لوحة التحكم** | عدادات إجمالية، متوسط النتائج، آخر الطلبات والتقارير |
| **المسح** | زر 🌐 Scan يُشغّل جميع المصادر المُهيّأة (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday + hh.ru / Habr Career) في مرور واحد؛ نتائج فورية عبر SSE |
| **خط الأنابيب (Pipeline)** | إدارة `data/pipeline.md`؛ معاينة آمنة للروابط (حماية SSRF) |
| **التقييم** | الصق وصف الوظيفة ← نتيجة 0–5 عبر Anthropic أو Gemini؛ أو نموذج جاهز للنسخ |
| **البحث المعمّق** | استكشاف الشركة عبر Anthropic SDK؛ تُحفَظ النتائج في `interview-prep/` |
| **المتتبّع** | جدول مصفّى للطلبات فوق `data/applications.md` |
| **السيرة الذاتية (CV)** | محرر markdown مباشر مع معاينة جانبية وحماية XSS من جهة الخادم |
| **صحة النظام** | شارات حالة الإعداد؛ تشغيل `doctor.mjs` بنقرة واحدة |
| **المساعدة** | توثيق مدمج بـ 12 لغة (بما فيها العربية) |

## البداية السريعة

> **مهم — career-ops-ui لوحة تحكم *فوق* [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops).** يعمل **داخل** مشروع career-ops بوصفه `career-ops/web-ui/` ويقرأ ملفات `cv.md` و`config/` و`data/` من المجلد الأصلي عبر `../`. **لا يعمل بشكل مستقل** — تحتاج أيضاً إلى مستودع career-ops الأصلي.

### الخيار 1 — أمر curl واحد (موصى به)

</div>

```bash
curl -fsSL https://raw.githubusercontent.com/Fighter90/career-ops-ui/main/bin/setup.sh | bash
```

<div dir="rtl">

يستنسخ **كلا** المستودعين، يُرتّب بنية `career-ops/web-ui/`، يثبّت التبعيات، يُشغّل التشخيص، ويبدأ الخادم على http://127.0.0.1:4317.

### الخيار 2 — إضافة الواجهة إلى مشروع career-ops موجود

</div>

```bash
cd career-ops
git clone https://github.com/Fighter90/career-ops-ui.git web-ui
cd web-ui
npm install
npm start
```

<div dir="rtl">

افتح http://127.0.0.1:4317 في متصفحك.

### أوامر CLI

</div>

```bash
career-ops-ui setup    # bootstrap: تثبيت التبعيات ← تشخيص ← تشغيل
career-ops-ui init     # اختيار مزوّد LLM ولصق مفتاح API (تفاعلي)
career-ops-ui doctor   # التحقق من Node / المشروع / المفاتيح / Playwright
career-ops-ui run      # تشغيل الخادم على http://127.0.0.1:4317
career-ops-ui open     # فتح تبويب لوحة التحكم وإحضاره للأمام
career-ops-ui help     # عرض قائمة جميع الأوامر
```

<div dir="rtl">

### اختيار مزوّد LLM

`init` معالج اختيار المزوّد — اختر **Claude / Claude Code** (`ANTHROPIC_API_KEY`)، أو **Codex / OpenCode** (`OPENAI_API_KEY`)، أو **Qwen Code** (`QWEN_API_KEY`)، أو **Auto** (Anthropic ← Gemini احتياطياً). يمكن ضبط المفاتيح يدوياً:

</div>

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." >> career-ops/.env
```

<div dir="rtl">

أو من تبويب **إعدادات التطبيق** (`#/config`) في الواجهة — دون إعادة تشغيل الخادم.

## المتطلبات

| | |
|---|---|
| **Node.js** | ≥ 18 (نظام `fetch` الأصلي و`node:test`) |
| **career-ops** | مستنسَخ ومُهيَّأ (انظر أعلاه) |
| **اختياري** | `ANTHROPIC_API_KEY` أو `GEMINI_API_KEY` في `.env` للمشروع الأصلي، لتقييم الوظائف بنقرة واحدة |

## البنية المعمارية باختصار

</div>

```
career-ops/
├─ cv.md
├─ portals.yml
├─ config/
├─ data/
└─ web-ui/          ← هذا المستودع
   ├─ server/       # Express + 15 وحدة مسارات
   ├─ public/       # vanilla JS SPA — بدون bundler
   └─ tests/        # 1945 unit + 90 Playwright + 43 e2e
```

<div dir="rtl">

للخادم تبعيتان إنتاجيتان فقط: `express` و`js-yaml`. لا transpile، لا bundler — حجم الواجهة بالكامل أقل من 30 كيلوبايت.

## التوثيق الكامل

التوثيق الشامل متاح باللغة الإنجليزية فقط: **[🇬🇧 README.md](README.md)**

يتضمن توصيفات تفصيلية لـ:
- REST API الكامل (جميع نقاط النهاية `/api/*`)
- إعداد ماسح بوابات الوظائف (Greenhouse وAshby وLever وWorkable وhh.ru وHabr Career وRSS)
- جميع متغيرات البيئة
- مبادئ الأمان (SSRF وXSS وتحديد معدل الطلبات)
- دليل البنية المعمارية (SDD والاتفاقيات)

الموقع الرسمي: [career-ops.org](https://career-ops.org) · التوثيق: [career-ops.org/docs](https://career-ops.org/docs)

## الاختبارات

</div>

```bash
npm test                    # 1856 اختبار وحدة وتكامل
npm run test:e2e            # 20 اختبار e2e دخاني
npm run test:e2e:full       # 23 اختبار e2e شامل
npm run test:e2e:browser    # 70 اختبار Playwright
npm run test:coverage       # مثل npm test + تغطية V8
```

<div dir="rtl">

## الرخصة

MIT. التفاصيل: [LICENSE](LICENSE).

مبني على [career-ops](https://github.com/Fighter90/career-ops) بقلم [santifer](https://santifer.io).

<p>
  <a href="https://github.com/Fighter90" title="Fighter90"><img src="https://wsrv.nl/?url=avatars.githubusercontent.com/u/6834634%3Fv%3D4&w=160&h=160&fit=cover&mask=circle&output=png" width="80" height="80" alt="Fighter90"/></a>
  <a href="https://github.com/Alien10140" title="Alien10140"><img src="https://wsrv.nl/?url=avatars.githubusercontent.com/u/4649783%3Fv%3D4&w=160&h=160&fit=cover&mask=circle&output=png" width="80" height="80" alt="Alien10140"/></a>
  <a href="https://github.com/vignyl" title="vignyl"><img src="https://wsrv.nl/?url=avatars.githubusercontent.com/u/26774609%3Fv%3D4&w=160&h=160&fit=cover&mask=circle&output=png" width="80" height="80" alt="vignyl"/></a>
  <a href="https://github.com/bracketouverte" title="bracketouverte"><img src="https://wsrv.nl/?url=avatars.githubusercontent.com/u/5484265%3Fv%3D4&w=160&h=160&fit=cover&mask=circle&output=png" width="80" height="80" alt="bracketouverte"/></a>
</p>

**[كل المساهمين ←](https://github.com/Fighter90/career-ops-ui/graphs/contributors)**

</div>
