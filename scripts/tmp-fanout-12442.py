# -*- coding: utf-8 -*-
# v1.244.2 locale fan-out: insert the translated 1.244.2 entry into every
# CHANGELOG.<locale>.md (the EN entry already exists in CHANGELOG.md).
import glob

F = {
'es': [
  "- **Las celdas de salario muestran solo el rango monetario.** Algunos boards ponen toda la descripción de beneficios en el campo del salario — la celda visible ahora muestra solo el tramo económico y mueve el texto al tooltip (antes: una celda de 6 líneas que estiraba cada fila).",
  "- **Las filas con título vacío muestran la empresa** (y luego un guion neutro) en lugar de una celda gigante en blanco.",
  "- **El badge de seniority nunca se parte** en su columna de ancho fijo.",
  "- **Las filas sin puntuación muestran un «◎ —» atenuado** con tooltip explicando que la comparación con el dos-páginas no encontró coincidencias (antes: nada, lo que parecía roto junto a filas con puntuación)."],
'pt-BR': [
  "- **As células de salário mostram apenas a faixa monetária.** Alguns boards colocam toda a descrição de benefícios no campo do salário — a célula visível agora mostra só o trecho econômico e move o texto para o tooltip (antes: uma célula de 6 linhas esticando cada linha).",
  "- **Linhas com título vazio mostram a empresa** (e depois um travessão neutro) em vez de uma célula gigante em branco.",
  "- **O badge de seniority nunca quebra** em sua coluna de largura fixa.",
  "- **Linhas sem pontuação mostram um «◎ —» esmaecido** com tooltip explicando que a comparação com o two-pager não encontrou correspondências (antes: nada, o que parecia quebrado perto de linhas com pontuação)."],
'de': [
  "- **Die Gehaltszellen zeigen nur den Geldbereich.** Manche Boards packen den ganzen Benefits-Text ins Gehaltsfeld — die sichtbare Zelle zeigt jetzt nur den Geldteil und verschiebt den Text in den Tooltip (vorher: eine 6-zeilige Zelle, die jede Reihe streckte).",
  "- **Reihen mit leerem Titel zeigen die Firma** (danach einen neutralen Strich) statt einer riesigen leeren Zelle.",
  "- **Das Seniority-Badge bricht nie um** in seiner festen Spaltenbreite.",
  "- **Nicht bewertete Reihen zeigen ein gedämpftes «◎ —»** mit Tooltip, warum der Two-Pager-Vergleich keine Treffer fand (vorher: nichts, was neben bewerteten Reihen kaputt wirkte)."],
'fr': [
  "- **Les cellules de salaire ne gardent que la fourchette monétaire.** Certains boards mettent toute la description des avantages dans le champ du salaire — la cellule visible ne montre plus que le segment économique et déplace le texte dans l'infobulle (avant : une cellule de 6 lignes qui étirait chaque rangée).",
  "- **Les rangées sans titre affichent l'entreprise** (puis un tiret neutre) au lieu d'une cellule géante vide.",
  "- **Le badge de séniorité ne se coupe jamais** dans sa colonne à largeur fixe.",
  "- **Les rangées sans score affichent un «◎ —» atténué** avec une infobulle expliquant que la comparaison two-pager n'a trouvé aucune correspondance (avant : rien, ce qui paraissait cassé à côté des rangées notées)."],
'ja': [
  "- **給与セルは金額レンジだけを表示。** 一部のボードは給与フィールドに福利厚生の説明全文を入れており、6行のセルが各行を引き伸ばしていました — 表示セルは金額部分のみとし、全文はツールチップへ移動。",
  "- **タイトルが空の行は会社名を表示**（なければ中立的なダッシュ）— 巨大な空白セルの代わりに。",
  "- **シニアリティバッジは固定幅コラムで折り返しません**。",
  "- **スコアなしの行は薄い「◎ —」を表示** — two-pager 比較で一致するキーワードがなかったことをツールチップで説明(以前は何もなく、スコア付きの行の隣で壊れて見えました)。"],
'zh-CN': [
  "- **薪资单元格只显示金额区间。** 有些看板把整个福利说明塞进薪资字段——可见单元格现在只显示金额部分，说明文字移入提示框（此前：6 行高的单元格撑开每一行）。",
  "- **空标题的行显示公司名**（再退化为中性的破折号），而不是巨大的空白单元格。",
  "- **资历徽章在固定宽度列中不再换行**。",
  "- **无评分的行显示淡化的「◎ —」**，提示框说明两页纸对比未找到匹配关键词（此前：空白，在有评分的行旁边显得像坏了）。"],
'zh-TW': [
  "- **薪資儲存格只顯示金額區間。** 有些看板把整段福利說明塞進薪資欄位——可見儲存格現在只顯示金額部分，說明文字移入提示框（此前：6 行高的儲存格撐開每一列）。",
  "- **空標題的列顯示公司名**（再退化為中性破折號），而不是巨大的空白儲存格。",
  "- **資歷徽章在固定寬度欄中不再換行**。",
  "- **無評分的列顯示淡化的「◎ —」**，提示框說明兩頁紙比對未找到匹配關鍵字（此前：空白，在有評分的列旁邊顯得像壞掉）。"],
'ko': [
  "- **급여 셀은 금액 범위만 표시합니다.** 일부 보드는 복리 혜택 설명 전체를 급여 필드에 넣습니다 — 표시 셀은 이제 금액 부분만 보여주고 전체 텍스트는 툴팁으로 이동했습니다(이전: 6줄 셀이 모든 행을 늘렸습니다).",
  "- **제목이 빈 행은 회사명을 표시**하고(그다음 중립 대시) 거대한 빈 셀 대신 표시합니다.",
  "- **시니어리티 배지는 고정 폭 열에서 절대 줄바꿈하지 않습니다**.",
  "- **점수 없는 행은 흐린 «◎ —»를 표시**하며 툴팁에 two-pager 비교에서 일치하는 키워드가 없었다고 설명합니다(이전: 점수 있는 행 옆에서 깨진 것처럼 보였습니다)."],
'pl': [
  "- **Komórki wynagrodzenia pokazują tylko zakres kwot.** Niektóre boardy wkładają cały opis benefitów do pola wynagrodzenia — widoczna komórka pokazuje teraz tylko część kwotową, a tekst trafia do tooltipa (wcześniej: 6-wierszowa komórka rozciągająca każdy wiersz).",
  "- **Wiersze z pustym tytułem pokazują firmę** (potem neutralny myślnik) zamiast gigantycznej pustej komórki.",
  "- **Badge seniority nigdy nie łamie się** w swojej kolumnie o stałej szerokości.",
  "- **Wiersze bez oceny pokazują przygaszone «◎ —»** z tooltipem wyjaśniającym, że porównanie z two-pagerem nie znalazło dopasowań (wcześniej: nic, co wyglądało jak błąd obok wierszy z oceną)."],
'uk': [
  "- **Клітинки зарплати показують лише грошовий діапазон.** Деякі борди кладуть увесь текст пільг у поле зарплати — видима клітинка тепер показує лише грошову частину, а текст переміщує в підказку (раніше: 6-рядкова клітинка, що розтягувала кожен рядок).",
  "- **Рядки з порожнім заголовком показують компанію** (потім нейтральне тире) замість гігантської порожньої клітинки.",
  "- **Бейдж seniority ніколи не переноситься** у своїй колонці фіксованої ширини.",
  "- **Рядки без оцінки показують притлумлене «◎ —»** із підказкою, що порівняння з two-pager не знайшло збігів (раніше: нічого, що виглядало зламаним поруч з оціненими рядками)."],
'da': [
  "- **Lønceller viser kun beløbsintervallet.** Nogle boards putter hele benefit-teksten i lønefeltet — den synlige celle viser nu kun beløbsdelen og flytter teksten til tooltippen (før: en 6-linjers celle, der strakte hver række).",
  "- **Rækker med tom titel viser virksomheden** (og derefter en neutral bindestreg) i stedet for en kæmpe tom celle.",
  "- **Seniority-badget bryder aldrig** i sin kolonne med fast bredde.",
  "- **Rækker uden score viser en dæmpet «◎ —»** med en tooltip, der forklarer, at two-pager-sammenligningen ikke fandt matchende nøgleord (før: intet, hvilket så ødelagt ud ved siden af scorede rækker)."],
'ar': [
  "- **خلايا الراتب تعرض نطاق المبلغ فقط.** بعض اللوحات تضع وصف المزايا كله في حقل الراتب — الخلية المرئية تعرض الآن جزء المبلغ فقط وتنقل النص إلى التلميح (سابقًا: خلية من 6 أسطر تمتد كل صف).",
  "- **الصفوف ذات العنوان الفارغ تعرض اسم الشركة** (ثم شرطة محايدة) بدل خلية فارغة ضخمة.",
  "- **شارة الأقدمية لا تلتف أبدًا** في عمودها ذي العرض الثابت.",
  "- **الصفوف بلا درجة تعرض «◎ —» باهتة** مع تلميح يوضح أن مقارنة الصفحتين لم تجد كلمات مطابقة (سابقًا: لا شيء، بدت مكسورة بجانب الصفوف المصنفة)."],
'it': [
  "- **Le celle dello stipendio mostrano solo la forbice monetaria.** Alcuni board mettono tutta la descrizione dei benefit nel campo stipendio — la cella visibile ora mostra solo la parte economica e sposta il testo nel tooltip (prima: una cella di 6 righe che stirava ogni riga).",
  "- **Le righe con titolo vuoto mostrano l'azienda** (poi un trattino neutro) invece di una cella gigante vuota.",
  "- **Il badge di seniority non va mai a capo** nella sua colonna a larghezza fissa.",
  "- **Le righe senza punteggio mostrano un «◎ —» attenuato** con tooltip che spiega che il confronto two-pager non ha trovato corrispondenze (prima: nulla, sembrava rotto accanto alle righe con punteggio)."],
'tr': [
  "- **Maaş hücreleri yalnızca parasal aralığı gösterir.** Bazı board'lar yanıt alanına tüm yan metni koyar — görünür hücre artık yalnızca parasal kısmı gösterir ve metni tooltip'e taşır (önce: her satırı uzatan 6 satırlık hücre).",
  "- **Boş başlıklı satırlar şirketi gösterir** (sonra nötr tire) dev boş hücre yerine.",
  "- **Kıdem rozeti sabit genişlikli sütununda asla kırılmaz**.",
  "- **Puanı olmayan satırlar soluk bir «◎ —» gösterir**, tooltip two-pager karşılaştırmasında eşleşen anahtar kelime bulunmadığını açıklar (önce: puanlı satırların yanında bozuk görünüyordu)."],
'hi': [
  "- **वेतन कक्षें केवल राशि-सीमा दिखाती हैं।** कुछ बोर्ड पूरे बेनिफिट-विवरण वेतन फ़ील्ड में डाल देते हैं — दृश्य कक्ष अब केवल धनराशि दिखाती है और पूरा पाठ टूलटिप में जाता है (पहले: 6-पंक्ति की कक्ष हर पंक्ति को खींच रही थी)।",
  "- **खाली शीर्षक वाली पंक्तियाँ कंपनी दिखाती हैं** (फिर तटस्थ डैश), विशाल खाली कक्ष के बजाय।",
  "- **सीनियरिटी बैज अपने निश्चित-चौड़ाई कॉलम में कभी नहीं लपेटता**।",
  "- **बिना स्कोर वाली पंक्तियाँ हल्का «◎ —» दिखाती हैं**, टूलटिप बताता है कि two-pager तुलना में कोई मेल खाता कीवर्ड नहीं मिला (पहले: कुछ नहीं, स्कोर वाली पंक्तियों के बगल में टूटा हुआ दिखता था)।"],
}


NOTES = {
'en': "- Everything else in #/scan is identical to v1.244.1 — only the chrome polish and the three regression fixes above changed. Tests 5045 → 5060 unit.",
'es': "- Todo lo demás en #/scan es idéntico a v1.244.1 — solo cambiaron el pulido del chrome y las tres correcciones anteriores. Tests 5045 → 5060 unit.",
'pt-BR': "- Todo o resto do #/scan é idêntico ao v1.244.1 — apenas o polimento do chrome e as três correções acima mudaram. Testes 5045 → 5060 unit.",
'de': "- Alles andere in #/scan ist identisch mit v1.244.1 — nur der Chrome-Polish und die drei Korrekturen oben haben sich geändert. Tests 5045 → 5060 unit.",
'fr': "- Tout le reste de #/scan est identique à v1.244.1 — seuls le polissage du chrome et les trois corrections ci-dessus ont changé. Tests 5045 → 5060 unit.",
'ja': "- #/scan のその他の部分は v1.244.1 と同一です — 変更されたのはクロームのポリッシュと上記の3つの修正のみです。テスト 5045 → 5060 unit。",
'zh-CN': "- #/scan の其余部分与 v1.244.1 完全相同——仅变更了外观打磨与上述三个修复。测试 5045 → 5060 unit。",
'zh-TW': "- #/scan 的其餘部分與 v1.244.1 完全相同——僅變更了外觀拋光與上述三個修復。測試 5045 → 5060 unit。",
'ko': "- #/scan의 나머지는 v1.244.1과 동일합니다 — 크롬 폴리시와 위의 세 수정만 변경되었습니다. 테스트 5045 → 5060 unit.",
'pl': "- Reszta #/scan jest identyczna z v1.244.1 — zmienił się tylko polerowanie chromu i trzy poprawki powyżej. Testy 5045 → 5060 unit.",
'uk': "- Решта #/scan ідентична v1.244.1 — змінилися лише полірування хрому та три виправлення вище. Тести 5045 → 5060 unit.",
'da': "- Alt andet i #/scan er identisk med v1.244.1 — kun chrome-poleringen og de tre rettelser ovenfor er ændret. Tests 5045 → 5060 unit.",
'ar': "- كل ما عدا ذلك في #/scan مطابق لـ v1.244.1 — التغيير هو تلميع الواجهة والإصلاحات الثلاثة أعلاه فقط. الاختبارات 5045 → 5060 unit.",
'it': "- Tutto il resto di #/scan è identico a v1.244.1 — sono cambiati solo la rifinitura del chrome e i tre fix sopra. Test 5045 → 5060 unit.",
'tr': "- #/scan'in geri kalanı v1.244.1 ile özdeş — yalnızca krom parlatması ve yukarıdaki üç düzeltme değişti. Testler 5045 → 5060 unit.",
'hi': "- #/scan का बाकी सब v1.244.1 के समान है — केवल क्रोम पॉलिश और ऊपर के तीन सुधार बदले गए हैं। टेस्ट 5045 → 5060 unit।",
}

META = {
'es': ('### Corregido', '### Añadido', '### Notas',
"**El pulido de la página de escaneo: el lanzador, la barra de estado, el panel de reposts y los filtros se rediseñan como un chrome consistente — y la tabla de resultados ya no puede ser estirada por datos del board.**",
"- **Rediseño del chrome: tarjeta lanzadora (fila de controles alineada, botón primario dominante), barra de estado del terminal con punto de estado (reposo/ejecutando/listo/error) safe para reduced-motion, panel de reposts con tope de altura y cabecera sticky (un dataset de 1,560 clústeres renderizaba un panel de 155,000 px), y el bloque de filtros como cuadrícula responsiva uniforme con pie alineado.**"),
'pt-BR': ('### Corrigido', '### Adicionado', '### Notas',
"**O polimento da página de escaneio: o lançador, a barra de status, o painel de reposts e os filtros são redesenhados como um chrome consistente — e a tabela de resultados não pode mais ser esticada por dados de boards.**",
"- **Redesign do chrome: cartão lançador (linha de controles alinhada, botão primário dominante), barra de status do terminal com ponto de estado (ocioso/executando/concluído/erro) safe para reduced-motion, painel de reposts com teto de altura e cabeçalho fixo (um dataset de 1,560 clusters renderizava um painel de 155,000 px), e o bloco de filtros como grade responsiva uniforme com rodapé alinhado.**"),
'de': ('### Behoben', '### Hinzugefügt', '### Anmerkungen',
"**Der Scan-Seiten-Polish: Launcher, Statusleiste, Reposts-Panel und Filter sind als konsistenter Chrome neu gestaltet — und die Ergebnistabelle kann nicht mehr durch Board-Daten gestreckt werden.**",
"- **Chrome-Redesign: Launcher-Karte (ausgerichtete Steuerungsreihe, dominanter Primary-Button), Terminal-Statusleiste mit Statuspunkt (idle/running/done/error) reduced-motion-sicher, Reposts-Panel mit Höhenbegrenzung und Sticky-Header (ein 1,560-Cluster-Datensatz renderierte ein 155,000-px-Panel), und der Filterblock als gleichmäßiges responsives Raster mit ausgerichtetem Footer.**"),
'fr': ('### Corrigé', '### Ajouté', '### Notes',
"**Le polissage de la page de scan : le lanceur, la barre d'état, le panneau de reposts et les filtres sont redessinés comme un chrome cohérent — et le tableau de résultats ne peut plus être étiré par les données des boards.**",
"- **Refonte du chrome : carte lanceur (rangée de contrôles alignée, bouton primaire dominant), barre d'état du terminal avec point d'état (repos/en cours/terminé/erreur) respectant reduced-motion, panneau de reposts plafonné en hauteur avec en-tête collante (un jeu de 1,560 clusters rendait un panneau de 155,000 px), et le bloc de filtres en grille responsive uniforme avec pied aligné.**"),
'ja': ('### 修正', '### 追加', '### 備考',
"**スキャンページのポリッシュ: ランチャー、ステータスバー、リポストパネル、フィルターが一貫したクロームとして再設計され — 結果テーブルはボード側データで引き伸ばされなくなりました。**",
"- **クローム再設計: ランチャーカード(整列したコントロール行、支配的なプライマリボタン)、ステータスドット(アイドル/実行中/完了/エラー)付きのターミナルステータスバーは reduced-motion セーフ、リポストパネルは高さ上限とスティッキーヘッダー付き(1,560 クラスタで 155,000px のパネルを描画していました)、フィルターブロックは均一なレスポンシブグリッドと整列したフッター。**"),
'zh-CN': ('### 修复', '### 新增', '### 备注',
"**扫描页面打磨：启动器、状态栏、转发面板和过滤器重构为一致的外观——结果表格不再会被看板数据撑开。**",
"- **外观重构：启动卡片（对齐的控件行、主导按钮）、带状态点的终端状态栏（空闲/运行/完成/错误）支持 reduced-motion、转发面板有高度上限和粘性表头（1,560 个集群曾渲染出 155,000 px 的面板）、过滤器块为均匀响应式网格并对齐页脚。**"),
'zh-TW': ('### 修復', '### 新增', '### 說明',
"**掃描頁面打磨：啟動器、狀態列、轉發面板與篩選器重構為一致的外觀——結果表格不再會被看板資料撐開。**",
"- **外觀重構：啟動卡片（對齊的控件列、主導按鈕）、帶狀態點的終端機狀態列（閒置/執行中/完成/錯誤）支援 reduced-motion、轉發面板有高度上限與固定表頭（1,560 個集群曾渲染出 155,000 px 的面板）、篩選器塊為均勻響應式網格並對齊頁腳。**"),
'ko': ('### 수정', '### 추가', '### 참고',
"**스캔 페이지 폴리시: 런처, 상태 바, 리포스트 패널, 필터가 일관된 크롬으로 재설계되었습니다 — 그리고 결과 테이블은 보드 데이터로 더 이상 늘어나지 않습니다.**",
"- **크롬 재설계: 런처 카드(정렬된 컨트롤 행, 지배적인 프라이머리 버튼), 상태 점(대기/실행/완료/오류)이 있는 터미널 상태 표시줄은 reduced-motion을 지원합니다, 리포스트 패널은 높이 상한과 스티키 헤더가 있습니다(1,560 클러스터가 155,000px 패널을 렌더링했습니다), 필터 블록은 균일한 반응형 그리드와 정렬된 푸터입니다.**"),
'pl': ('### Naprawiono', '### Dodano', '### Uwagi',
"**Polerowanie strony skanowania: launcher, pasek statusu, panel repostów i filtry zaprojektowane jako spójny chrome — a tabela wyników nie może już być rozciągana przez dane boardów.**",
"- **Przeprojektowanie chromu: karta launchera (wyrównany rząd kontrolek, dominujący przycisk podstawowy), pasek stanu terminalu z kropką stanu (bezczynny/uruchomiono/gotowe/błąd) respektujący reduced-motion, panel repostów z limitem wysokości i przyklejonym nagłówkiem (zbiór 1,560 klastrów renderował panel 155,000 px), oraz blok filtrów jako równomierna responsywna siatka z wyrównaną stopką.**"),
'uk': ('### Виправлено', '### Додано', '### Примітки', "**Полірування сторінки сканування: лаунчер, рядок стану, панель репостів і фільтри перероблені в один консистентний хром — і таблицю результатів більше не можна розтягнути даними бордів.**",
[ "- **Клітинки зарплати показують лише грошовий діапазон.** Деякі борди кладуть увесь текст пільг у поле зарплати — видима клітинка тепер показує лише грошову частину, а текст переміщує в підказку (раніше: 6-рядкова клітинка, що розтягувала кожен рядок).",
  "- **Рядки з порожнім заголовком показують компанію** (потім нейтральне тире) замість гігантської порожньої клітинки.",
  "- **Бейдж seniority ніколи не переноситься** у своїй колонці фіксованої ширини.",
  "- **Рядки без оцінки показують притлумлене «◎ —»** із підказкою, що порівняння з two-pager не знайшло збігів (раніше: нічого, що виглядало зламаним поруч з оціненими рядками)."],
"- **Редизайн хрому: картка-лаунчер (вирівняний ряд контролів, домінантна primary-кнопка), рядок стану терміналу з крапкою стану (бездія/виконання/готово/помилка) підтримує reduced-motion, панель репостів має стелю висоти зі sticky-заголовком (датасет із 1,560 кластерів рендерив панель 155,000 px), і блок фільтрів як рівномірна адаптивна сітка з вирівняним футером.**"),
'da': ('### Rettet', '### Tilføjet', '### Noter', "**Scan-sidens polering: launcher, statuslinje, reposts-panel og filtre er redesignet som en konsistent chrome — og resultattabellen kan ikke længere strækkes af board-data.**",
[ "- **Lønceller viser kun beløbsintervallet.** Nogle boards putter hele benefit-teksten i lønefeltet — den synlige celle viser nu kun beløbsdelen og flytter teksten til tooltippen (før: en 6-linjers celle, der strakte hver række).",
  "- **Rækker med tom titel viser virksomheden** (og derefter en neutral bindestreg) i stedet for en kæmpe tom celle.",
  "- **Seniority-badget bryder aldrig** i sin kolonne med fast bredde.",
  "- **Rækker uden score viser en dæmpet «◎ —»** med en tooltip, der forklarer, at two-pager-sammenligningen ikke fandt matchende nøgleord (før: intet, hvilket så ødelagt ud ved siden af scorede rækker)."],
"- **Chrome-redesign: launcher-kort (justeret kontrolrække, dominerende primærknap), terminal-statuslinje med statuspunkt (inaktiv/kører/færdig/fejl) respekterer reduced-motion, reposts-panelet har en højdetag med sticky-header (et datasæt på 1,560 klynger renderede et 155,000 px-panel), og filterblokken som ensartet responsivt grid med justeret footer.**"),
'ar': ('### تم الإصلاح', '### أُضيف', '### ملاحظات', "**تلميع صفحة المسح: المشغّل وشريط الحالة ولوحة إعادة النشر والمرشحات أُعيد تصميمها كواجهة متسقة — وجدول النتائج لم يعد يمكن تمديده ببيانات اللوحة.**",
[ "- **خلايا الراتب تعرض نطاق المبلغ فقط.** بعض اللوحات تضع وصف المزايا كله في حقل الراتب — الخلية المرئية تعرض الآن جزء المبلغ فقط وتنقل النص إلى التلميح (سابقًا: خلية من 6 أسطر تمتد كل صف).",
  "- **الصفوف ذات العنوان الفارغ تعرض اسم الشركة** (ثم شرطة محايدة) بدل خلية فارغة ضخمة.",
  "- **شارة الأقدمية لا تلتف أبدًا** في عمودها ذي العرض الثابت.",
  "- **الصفوف بلا درجة تعرض «◎ —» باهتة** مع تلميح يوضح أن مقارنة الصفحتين لم تجد كلمات مطابقة (سابقًا: لا شيء، بدت مكسورة بجانب الصفوف المصنفة)."],
"- **إعادة تصميم الواجهة: بطاقة المشغل (صف عناصر تحكم محاذى، زر أساسي مهيمن)، شريط حالة الطرفية مع نقطة الحالة (خامل/قيد التشغيل/تم/خطأ) يدعم reduced-motion، لوحة إعادة النشر لها سقف ارتفاع مع رأس ثابت (مجموعة من 1,560 عنصرًا كانت ترسم لوحة بـ 155,000 بكسل)، وكتلة المرشحات كشبكة متجاوبة موحدة مع تذييل محاذى.**"),
'it': ('### Corretto', '### Aggiunto', '### Note', "**La rifinitura della pagina di scansione: launcher, barra di stato, pannello repost e filtri ridisegnati come un chrome coerente — e la tabella dei risultati non può più essere allungata dai dati dei board.**",
[ "- **Le celle dello stipendio mostrano solo la forbice monetaria.** Alcuni board mettono tutta la descrizione dei benefit nel campo stipendio — la cella visibile ora mostra solo la parte economica e sposta il testo nel tooltip (prima: una cella di 6 righe che stirava ogni riga).",
  "- **Le righe con titolo vuoto mostrano l'azienda** (poi un trattino neutro) invece di una cella gigante vuota.",
  "- **Il badge di seniority non va mai a capo** nella sua colonna a larghezza fissa.",
  "- **Le righe senza punteggio mostrano un «◎ —» attenuato** con tooltip che spiega che il confronto two-pager non ha trovato corrispondenze (prima: nulla, sembrava rotto accanto alle righe con punteggio)."],
"- **Refonte du chrome: card launcher (riga di controlli allineata, pulsante primario dominante), barra di stato del terminale con punto di stato (idle/running/done/errore) rispetta reduced-motion, pannello dei repost con tetto di altezza e header sticky (un dataset di 1,560 cluster renderizzava un pannello da 155,000 px), e il blocco filtri come griglia responsiva uniforme con footer allineato.**"),
'tr': ('### Düzeltildi', '### Eklendi', '### Notlar', "**Tarama sayfası parlatması: başlatıcı, durum çubuğu, repost paneli ve filtreler tek bir tutarlı krom olarak yeniden tasarlandı — ve sonuç tablosu artık board verileriyle gerilemiyor.**",
[ "- **Maaş hücreleri yalnızca parasal aralığı gösterir.** Bazı board'lar yanıt alanına tüm yan metni koyar — görünür hücre artık yalnızca parasal kısmı gösterir ve metni tooltip'e taşır (önce: her satırı uzatan 6 satırlık hücre).",
  "- **Boş başlıklı satırlar şirketi gösterir** (sonra nötr tire) dev boş hücre yerine.",
  "- **Kıdem rozeti sabit genişlikli sütununda asla kırılmaz**.",
  "- **Puanı olmayan satırlar soluk bir «◎ —» gösterir**, tooltip two-pager karşılaştırmasında eşleşen anahtar kelime bulunmadığını açıklar (önce: puanlı satırların yanında bozuk görünüyordu)."],
"- **Krom yeniden tasarımı: başlatıcı kartı (hizalı kontrol satırı, baskın birincil düğme), durum noktalı terminal durum çubuğu (boşta/çalışıyor/bitti/hata) reduced-motion'u destekler, repost paneli sticky başlıklı yükseklik sınırına sahiptir (1,560 küme, 155,000 px'lik bir panel oluşturuyordu) ve filtre bloğu düzgün responsive ızgara ve hizalanmış altbilgi olarak.**"),
'hi': ('### ठीक किया गया', '### जोड़ा गया', '### टिप्पणियाँ', "**स्कैन पेज पॉलिश: लॉन्चर, स्टेटस बार, रीपोस्ट पैनल और फ़िल्टर एक सुसंगत क्रोम के रूप में पुनःडिज़ाइन — और परिणाम तालिका अब बोर्ड-डेटा से नहीं फैलती।**",
[ "- **वेतन कक्षें केवल राशि-सीमा दिखाती हैं।** कुछ बोर्ड पूरे बेनिफिट-विवरण वेतन फ़ील्ड में डाल देते हैं — दृश्य कक्ष अब केवल धनराशि दिखाती है और पूरा पाठ टूलटिप में जाता है (पहले: 6-पंक्ति की कक्ष हर पंक्ति को खींच रही थी)।",
  "- **खाली शीर्षक वाली पंक्तियाँ कंपनी दिखाती हैं** (फिर तटस्थ डैश), विशाल खाली कक्ष के बजाय।",
  "- **सीनियरिटी बैज अपने निश्चित-चौड़ाई कॉलम में कभी नहीं लपेटता**।",
  "- **बिना स्कोर वाली पंक्तियाँ हल्का «◎ —» दिखाती हैं**, टूलटिप बताता है कि two-pager तुलना में कोई मेल खाता कीवर्ड नहीं मिला (पहले: कुछ नहीं, स्कोर वाली पंक्तियों के बगल में टूटा हुआ दिखता था)।"],
"- **क्रोम रीडिज़ाइन: लॉन्चर कार्ड (संरेखित नियंत्रण पंक्ति, प्रमुख प्राथमिक बटन), स्टेटस डॉट (आइडल/रनिंग/डन/एरर) वाला टर्मिनल स्टेटस बार reduced-motion का सम्मान करता है, रीपोस्ट पैनल की ऊँचाई की सीमा है और स्टिकी हेडर है (1,560 क्लस्टर का डेटासेट 155,000 px का पैनल रेंडर कर रहा था), और फ़िल्टर ब्लॉक समान रिस्पॉन्सिव ग्रिड और संरेखित फ़ुटर के रूप में।**"),
}

n = 0
for path in glob.glob('CHANGELOG.*.md'):
    loc = path[len('CHANGELOG.'):-len('.md')]
    if loc not in META: continue
    if '## [1.244.2]' in open(path).read(): continue
    fixed_l, added_l, notes_l = META[loc][0], META[loc][1], META[loc][2]
    lead, added = META[loc][3], META[loc][4]
    fixed = F[loc]
    entry = (f"## [1.244.2] — 2026-10-08\n\n{lead}\n\n{fixed_l}\n\n" + "\n".join(fixed) +
             f"\n\n{added_l}\n\n" + added + f"\n\n{notes_l}\n\n" + NOTES[loc] + "\n\n")
    s = open(path).read()
    i = s.index('## [1.244.1]')
    open(path, 'w').write(s[:i] + entry + s[i:])
    n += 1
print('locales done:', n)
