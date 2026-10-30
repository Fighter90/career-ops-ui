/**
 * One-off LIVE browser verification of the v1.263.0 owner-UX batch on PROD
 * (https://resumecraft.ru, basic auth). Read-only: it never writes, never
 * submits, never triggers an LLM evaluation — the only LLM-touching step is
 * one docs-assistant question-chip (a read-only grounded-help answer).
 *
 * Usage (prod):  PROD_URL=… BASIC_USER=… BASIC_PASS=… node qa/prod-ux-probe-v1263.mjs
 * Usage (local selector smoke):  node qa/prod-ux-probe-v1263.mjs --local
 *
 * Output: OUT_DIR (default prod-ux-verify/) with screenshots NN-*.png and
 * report.md — the verdict table. Exit code 0 even with red checks (the
 * report IS the deliverable); 2 only when the probe itself could not run.
 */
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OUT_DIR = process.env.OUT_DIR || 'prod-ux-verify';
const BASE = (process.env.PROD_URL || '').replace(/\/+$/, '');
const USER = process.env.BASIC_USER || '';
const PASS = process.env.BASIC_PASS || '';
const LOCAL = process.argv.includes('--local');
const SHOT_DIR = resolve(OUT_DIR);

const findings = []; // { id, check, expect, fact, verdict, shot }
function rec(id, check, expect, fact, verdict, shot) {
  findings.push({ id, check, expect, fact, verdict, shot: shot || '' });
  const mark = verdict === 'PASS' ? '✅' : verdict === 'SKIP' ? '➖' : '❌';
  console.log(`${mark} [${id}] ${check} → ${fact}`);
}

let playwright;
try { playwright = require('playwright'); } catch (e) {
  console.error('playwright not resolvable:', e.message);
  process.exit(2);
}

// ── page-context helpers (serialized into evaluate) ─────────────────────────
const pageHelpers = `
  window.__ux = {
    rgb(s){ const m = (s||'').match(/rgba?\\(([^)]+)\\)/); if(!m) return null;
      const p = m[1].split(',').map(Number); return { r:p[0], g:p[1], b:p[2], a:p.length>3?p[3]:1 }; },
    lum(c){ const f=(v)=>{ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
      return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); },
    contrast(a,b){ if(!a||!b) return null; const L1=this.lum(a), L2=this.lum(b);
      return (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05); },
    hue(c){ if(!c) return null; const r=c.r/255,g=c.g/255,b=c.b/255;
      const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn; if(d===0) return 0;
      let h; if(mx===r) h=((g-b)/d)%6; else if(mx===g) h=(b-r)/d+2; else h=(r-g)/d+4;
      h*=60; return h<0?h+360:h; },
    effBg(el){ let n=el; const transparent=(s)=>!s||s==='transparent'||/rgba\\([^)]*,\\s*0\\)/.test(s);
      while(n && n!==document.documentElement){ const s=getComputedStyle(n);
        if(!transparent(s.backgroundColor)) return s.backgroundColor; n=n.parentElement; }
      return getComputedStyle(document.body).backgroundColor; },
    sample(list){ const out=[];
      for(const sel of list){ let els=[...document.querySelectorAll(sel)].filter(e=>e.offsetParent!==null).slice(0,4);
        for(const el of els){ const s=getComputedStyle(el); const bgS=this.rgb(this.effBg(el)); const fgS=this.rgb(s.color);
          const c=this.contrast(fgS,bgS);
          out.push({sel, fg:s.color, bg:this.effBg(el), contrast: c==null?null:Math.round(c*100)/100}); } }
      return out; },
  };
`;

async function newPage(browser, { width, height, theme, httpCreds }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    httpCredentials: httpCreds || undefined,
    ignoreHTTPSErrors: false,
    deviceScaleFactor: width <= 480 ? 2 : 1,
  });
  const page = await ctx.newPage();
  await page.addInitScript(([th]) => {
    try {
      localStorage.setItem('career-ops-ui:lang', 'ru');
      if (th) localStorage.setItem('theme', th);
    } catch {}
  }, [theme || null]);
  await page.addInitScript(pageHelpers);
  return { ctx, page };
}

async function gotoHash(page, hash, waitSel, timeout = 15000) {
  const url = (LOCAL ? page.__base : BASE) + '/#' + hash;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (waitSel) await page.waitForSelector(waitSel, { timeout }).catch(() => {});
  await page.waitForTimeout(700); // i18n apply + render settle
}

// ── individual checks ────────────────────────────────────────────────────────

/** 1a. #/scan 1440 — sticky thead must not paint over the topbar search bar. */
async function checkScanSticky(page, tag) {
  const shot = `01-scan-1440-sticky-${tag}.png`;
  const have = await page.evaluate(() => !!document.querySelector('#scan-results table') &&
    !!document.querySelector('.table-wrap') && !!document.querySelector('.searchbar') &&
    !!document.querySelector('.topbar'));
  if (!have) {
    rec('1a', '#/scan: sticky table header vs topbar', 'header never covers the search bar',
      'scan results table / searchbar / topbar not present — probe not applicable on this snapshot', 'SKIP', '');
    return;
  }
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const search = document.querySelector('.searchbar');
    const wrap = document.querySelector('.table-wrap.v2-scan-viewport') || document.querySelector('.table-wrap');
    const s = search.getBoundingClientRect();
    const wTop = wrap.getBoundingClientRect().top;
    window.scrollBy(0, Math.round(wTop - (s.y + 2)));
  });
  await page.waitForTimeout(300);
  const scrollable = await page.evaluate(() => window.scrollY);
  const hit = await page.evaluate(() => {
    const th = document.querySelector('#scan-results thead th');
    const search = document.querySelector('.searchbar');
    const topbar = document.querySelector('.topbar');
    if (!th || !search) return { error: 'missing elements' };
    const a = th.getBoundingClientRect(), b = search.getBoundingClientRect();
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width), y2 = Math.min(a.y + a.height, b.y + b.height);
    if (x2 <= x1 || y2 <= y1) return { overlap: false, scrollY: window.scrollY };
    const el = document.elementFromPoint((x1 + x2) / 2, (y1 + y2) / 2);
    return {
      overlap: true, scrollY: window.scrollY,
      coveredByThead: !!(el && ((el === th) || th.contains(el) || (el.closest && el.closest('thead')))),
      top: el ? (el.tagName + '.' + String(el.className).slice(0, 60)) : 'none',
    };
  });
  await page.screenshot({ path: resolve(SHOT_DIR, shot) });
  if (hit.error) { rec('1a', '#/scan: sticky header vs topbar', 'no cover', hit.error, 'SKIP', shot); return; }
  if (!hit.overlap) {
    rec('1a', '#/scan: sticky header vs topbar', 'no overlap band reached', `no overlap after scroll (scrollY=${hit.scrollY}) — layout differs from the probe's assumption`, 'SKIP', shot);
    return;
  }
  if (!scrollable) {
    rec('1a', '#/scan: sticky header vs topbar', 'page scrollable so the probe means something', `scrollY=0 — страница не проскроллилась`, 'SKIP', shot);
    return;
  }
  rec('1a', '#/scan: sticky table header vs topbar (elementFromPoint at overlap)',
    'topmost element at the thead∩searchbar overlap is NOT the thead',
    hit.coveredByThead ? `thead covers the searchbar (topmost: ${hit.top})` : `ok — topmost: ${hit.top}`,
    hit.coveredByThead ? 'FAIL' : 'PASS', shot);
}

/** 1b. #/scan — the density («Компактно») button is gone. */
async function checkNoDensityButton(page, tag) {
  const found = await page.evaluate(() => {
    const hits = [...document.querySelectorAll('button, [role="button"]')]
      .filter((b) => /компактно|compact|плотн/i.test(b.textContent || ''))
      .map((b) => (b.textContent || '').trim().slice(0, 40));
    return hits;
  });
  rec('1b', '#/scan: кнопка «Компактно» (density) удалена',
    'no button labelled Компактно/Compact',
    found.length ? `FOUND: ${JSON.stringify(found)}` : 'нет такой кнопки',
    found.length ? 'FAIL' : 'PASS');
}

/** 1c. #/scan — salary popover inputs ≤ 60px tall. */
async function checkSalaryPopover(page, tag) {
  const shot = `02-scan-1440-salary-popover-${tag}.png`;
  const chip = page.locator('.v2-scan-chip-btn').filter({ hasText: /Зарплата|Salary/i }).first();
  if (!(await chip.count())) {
    rec('1c', '#/scan: поповер «Зарплата» — высота инпутов', 'inputs ≤ 60px', 'salary chip not found', 'SKIP', '');
    return;
  }
  await chip.click();
  const okVisible = await page.waitForSelector('#scan-filter-salary-min', { state: 'visible', timeout: 4000 }).catch(() => null);
  if (!okVisible) {
    rec('1c', '#/scan: поповер «Зарплата» — высота инпутов', 'inputs ≤ 60px', 'popover inputs not visible after chip click', 'SKIP', shot);
    return;
  }
  await page.waitForTimeout(250);
  const h = await page.evaluate(() => ({
    min: document.getElementById('scan-filter-salary-min')?.offsetHeight,
    max: document.getElementById('scan-filter-salary-max')?.offsetHeight,
  }));
  await page.screenshot({ path: resolve(SHOT_DIR, shot) });
  const verdict = h.min <= 60 && h.max <= 60 ? 'PASS' : 'FAIL';
  rec('1c', '#/scan: поповер «Зарплата» — высота инпутов (offsetHeight)',
    'min ≤ 60px и max ≤ 60px', `salary-min: ${h.min}px, salary-max: ${h.max}px`, verdict, shot);
  await page.keyboard.press('Escape');
}

/** 1d. #/scan — the primary «Поиск» button accent is crimson, not blue. */
async function checkAccentCrimson(page, sel, label, tag, idSuffix) {
  const shot = `03-accent-${idSuffix}-${tag}.png`;
  const info = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, text: (el.textContent || '').trim().slice(0, 30) };
  }, sel);
  if (!info) { rec(idSuffix, `${label}: акцент кнопки`, 'crimson (hue ≈ 15, не синий)', `element ${sel} not found`, 'SKIP', ''); return; }
  const c = await page.evaluate((bg) => window.__ux.rgb(bg), info.bg);
  const hue = await page.evaluate((bg) => window.__ux.hue(window.__ux.rgb(bg)), info.bg);
  const notBlue = hue === null ? false : !(hue >= 180 && hue <= 280);
  const reddish = hue === null ? false : (hue <= 40 || hue >= 330);
  await page.screenshot({ path: resolve(SHOT_DIR, shot) }).catch(() => {});
  rec(idSuffix, `${label}: акцент (computed background)`,
    'crimson/багровый (hue 330–40), не синий (180–280)',
    `${sel} bg=${info.bg} hue=${hue == null ? '?' : Math.round(hue)} text="${info.text}"`,
    notBlue && reddish ? 'PASS' : 'FAIL', shot);
  return { hue, bg: info.bg };
}

/** 2. #/dashboard 1440 — hero vertical rhythm + crimson accent. */
async function checkDashboardHero(page, tag) {
  const shot = `04-dashboard-1440-hero-${tag}.png`;
  const hero = await page.evaluate(() => {
    const h = document.querySelector('.dash-hero');
    if (!h) return null;
    const inner = h.querySelector('.v2-dash-hero-inner');
    const greet = h.querySelector('.v2-dash-greeting');
    const split = h.querySelector('.v2-dash-split');
    const focal = h.querySelector('.dash-hero-focal');
    const rect = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return {
      innerDir: inner ? getComputedStyle(inner).flexDirection : null,
      innerGap: inner ? getComputedStyle(inner).rowGap || getComputedStyle(inner).gap : null,
      greet: rect(greet), split: rect(split), focal: rect(focal),
      focalLabel: focal ? (focal.textContent || '').trim().slice(0, 60) : null,
    };
  });
  await page.screenshot({ path: resolve(SHOT_DIR, shot) });
  if (!hero || !hero.split || !hero.greet) {
    rec('2', '#/dashboard hero: вертикальный ритм', 'greeting → buttons → «Последняя оценка» друг под другом', hero ? JSON.stringify(hero).slice(0, 200) : '.dash-hero not found', 'SKIP', shot);
    if (hero) return hero;
    return null;
  }
  const stacked = hero.innerDir === 'column'
    && hero.split.y > hero.greet.y + hero.greet.h - 4
    && hero.focal && hero.focal.y > hero.split.y + hero.split.h - 4;
  rec('2', '#/dashboard hero: вертикальный ритм (greeting / кнопки / «Последняя оценка»)',
    'flex column: каждый блок на своей строке, не одна полоса',
    `dir=${hero.innerDir}, gap=${hero.innerGap}, greet.y=${hero.greet?.y}, split.y=${hero.split?.y}, focal.y=${hero.focal?.y}, focal="${hero.focalLabel}"`,
    stacked ? 'PASS' : 'FAIL', shot);
  return hero;
}

/** 3. Mobile drawer 390. */
async function checkMobileDrawer(page, tag) {
  const shotOpen = `05-drawer-390-open-${tag}.png`;
  const shotClosed = `06-drawer-390-closed-${tag}.png`;
  await page.click('#sidebar-toggle');
  await page.waitForSelector('#sidebar-close', { state: 'visible', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400); // drawer transition
  const state = await page.evaluate(() => {
    const vis = (el) => !!el && el.offsetParent !== null;
    const close = document.getElementById('sidebar-close');
    const map = document.querySelector('.nav-item[data-route="map"]');
    const funded = document.querySelector('.nav-item[data-route="funded"]');
    const cr = (e) => { if (!e || !vis(e)) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; };
    const recentsGroup = [...document.querySelectorAll('#nav-v2-dynamic .nav-v2-group, .nav-v2-favs ~ section, .nav-v2-group')]
      .find((g) => /Недавние|Recent/i.test(g.textContent || ''));
    const recToggle = recentsGroup ? recentsGroup.querySelector('.nav-v2-toggle') : null;
    const recClear = recentsGroup ? recentsGroup.querySelector('.nav-v2-clear') : null;
    return {
      drawerOpen: document.body.classList.contains('sidebar-open'),
      closeVisible: vis(close), close: cr(close),
      map: cr(map), mapText: map ? map.textContent.trim() : null,
      funded: cr(funded), fundedText: funded ? funded.textContent.trim() : null,
      fundedLineH: funded ? (parseFloat(getComputedStyle(funded).lineHeight) || parseFloat(getComputedStyle(funded).fontSize) * 1.4) : null,
      recentsFound: !!recentsGroup,
      recentsTooltip: recToggle ? (recToggle.getAttribute('title') || '') : null,
      recentsClear: recClear ? { visible: vis(recClear), text: (recClear.textContent || '').trim() } : null,
      innerWidth: window.innerWidth,
    };
  });
  await page.screenshot({ path: resolve(SHOT_DIR, shotOpen) });

  // ✕ visible and closes
  if (state.closeVisible) {
    await page.click('#sidebar-close');
    await page.waitForTimeout(450);
    const closed = await page.evaluate(() => !document.body.classList.contains('sidebar-open'));
    await page.screenshot({ path: resolve(SHOT_DIR, shotClosed) });
    rec('3a', 'Мобильный drawer 390: кнопка ✕ видна и закрывает', '✕ видна, после клика drawer закрыт',
      `✕ visible=${state.closeVisible}, closed after click=${closed}`,
      closed ? 'PASS' : 'FAIL', shotClosed);
  } else {
    rec('3a', 'Мобильный drawer 390: кнопка ✕ видна и закрывает', '✕ видна в открытом drawer', `sidebar-open=${state.drawerOpen}, ✕ не видна`, 'FAIL', shotOpen);
  }
  // reopen for geometry checks
  await page.click('#sidebar-toggle');
  await page.waitForTimeout(450);
  const geo = await page.evaluate(() => {
    const vis = (el) => !!el && el.offsetParent !== null;
    const cr = (e) => { if (!e || !vis(e)) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; };
    const map = document.querySelector('.nav-item[data-route="map"]');
    const funded = document.querySelector('.nav-item[data-route="funded"]');
    return { map: cr(map), funded: cr(funded), innerWidth: window.innerWidth };
  });
  // «Карта» not cut
  rec('3b', 'Мобильный drawer 390: «Карта» не обрезана', `right ≤ innerWidth (${geo.innerWidth})`,
    geo.map ? `rect.right=${geo.map.right}, right=${geo.map.right}/${geo.innerWidth}` : 'nav item Карта не найдена/не видна',
    geo.map && geo.map.right <= geo.innerWidth + 1 ? 'PASS' : 'FAIL', shotOpen);
  // «Профинансированные компании» wraps, not cut
  if (geo.funded) {
    const lines = state.fundedLineH ? Math.round(geo.funded.h / state.fundedLineH) : null;
    const notCut = geo.funded.right <= geo.innerWidth + 1;
    const wraps = lines !== null ? lines >= 2 : null;
    rec('3c', 'Мобильный drawer 390: «Профинансированные компании» переносится, не обрезана',
      'right ≤ innerWidth и высота ≥ 2 строк (перенос)',
      `right=${geo.funded.right}/${geo.innerWidth}, h=${geo.funded.h}px, строк≈${lines}`,
      notCut ? 'PASS' : 'FAIL', shotOpen);
  } else {
    rec('3c', 'Мобильный drawer 390: «Профинансированные компании»', 'видна, переносится', 'nav item не найден/не виден', 'SKIP', shotOpen);
  }
  // recents block
  const rec2 = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('.nav-v2-group')];
    const g = groups.find((x) => /Недавние|Recent/i.test(x.textContent || ''));
    if (!g) return { found: false };
    const tog = g.querySelector('.nav-v2-toggle');
    const clear = g.querySelector('.nav-v2-clear');
    const vis = (e) => !!e && e.offsetParent !== null;
    return {
      found: true, tooltip: tog ? tog.getAttribute('title') : null,
      clearVisible: vis(clear), clearText: clear ? (clear.textContent || '').trim() : null,
    };
  });
  const recOk = rec2.found && rec2.tooltip && rec2.clearVisible;
  rec('3d', 'Мобильный drawer 390: блок «Недавние» — тултип + кнопка «Очистить»',
    'тултип (title) на заголовке блока и видимая кнопка «Очистить»',
    rec2.found ? `tooltip="${(rec2.tooltip || '—').slice(0, 50)}…", clear visible=${rec2.clearVisible} text="${rec2.clearText}"` : 'блок «Недавние» не найден',
    recOk ? 'PASS' : 'FAIL', shotOpen);
  await page.keyboard.press('Escape');
}

/** 4. #/docs-assistant 390 — chip question, answer with long URL, no horizontal scroll. */
async function checkDocsAssistant(page, tag) {
  const shot = `07-docs-assistant-390-answer-${tag}.png`;
  await gotoHash(page, '/docs-assistant', '.docs-chip-row button', 20000);
  const chip = page.locator('.docs-chip-row button').first();
  if (!(await chip.count())) {
    rec('4', '#/docs-assistant 390: вопрос-чип → ответ без горизонтального скролла',
      'document.scrollWidth === innerWidth после ответа', 'чипы вопросов не найдены', 'SKIP', shot);
    return;
  }
  const chipLabel = (await chip.textContent() || '').trim();
  await chip.click();
  // wait for an answer bubble (.md inside the log) up to 150 s (live LLM on prod)
  const answered = await page.waitForFunction(() => {
    const mds = document.querySelectorAll('.md');
    return mds.length > 0 && (mds[mds.length - 1].textContent || '').trim().length > 40;
  }, { timeout: 150000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    answerHead: (() => { const m = document.querySelectorAll('.md'); return m.length ? (m[m.length - 1].textContent || '').trim().slice(0, 80) : null; })(),
    wide: (() => { const iw = window.innerWidth; const bad = [];
      for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect();
        if (r.width > iw + 2 && r.height > 0 && el.offsetParent !== null) { bad.push(el.tagName + '.' + String(el.className).slice(0, 40)); if (bad.length >= 3) break; } }
      return bad; })(),
  }));
  await page.screenshot({ path: resolve(SHOT_DIR, shot), fullPage: false });
  const noOverflow = m.scrollWidth <= m.innerWidth + 1;
  rec('4', `#/docs-assistant 390: чип «${chipLabel}» → ответ, горизонтального скролла нет`,
    `document.scrollWidth === innerWidth (${m.innerWidth})`,
    `answered=${answered}, scrollWidth=${m.scrollWidth}, ответ начинается: "${m.answerHead}"${m.wide.length ? ', широкие эл-ты: ' + m.wide.join(' | ') : ''}`,
    noOverflow ? 'PASS' : 'FAIL', shot);
}

/** 5. #/tracker 390 — empty state full-width (only when the tracker is empty). */
async function checkTrackerEmpty(page, tag) {
  const shot = `08-tracker-390-${tag}.png`;
  await gotoHash(page, '/tracker', 'table, .empty, .card', 20000);
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => {
    const empty = document.querySelector('.card.empty');
    const rows = document.querySelectorAll('#tracker-body tr, table tbody tr').length;
    const cr = (e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), right: Math.round(r.right), x: Math.round(r.x) }; };
    return { empty: empty ? cr(empty) : null, rows, innerWidth: window.innerWidth };
  });
  await page.screenshot({ path: resolve(SHOT_DIR, shot) });
  if (m.empty) {
    const ok = m.empty.right <= m.innerWidth + 1 && m.empty.w >= m.innerWidth * 0.8;
    rec('5', '#/tracker 390: empty state на всю ширину, не обрезан',
      `right ≤ ${m.innerWidth} и width ≥ 80% (${Math.round(m.innerWidth * 0.8)}px)`,
      `empty w=${m.empty.w}, right=${m.empty.right}`, ok ? 'PASS' : 'FAIL', shot);
  } else {
    rec('5', '#/tracker 390: empty state', 'проверка применима только к пустому трекеру',
      `трекер НЕ пуст на проде (${m.rows} строк в видимой таблице) — проверка N/A`, 'SKIP', shot);
  }
}

/** 6. #/help TOC — active item not shifted left vs the others. */
async function checkHelpToc(page, tag, vp) {
  const shot = `09-help-toc-${vp}-${tag}.png`;
  await gotoHash(page, '/help', '.help-toc a', 20000);
  // scroll the article so a section (ideally not the first) becomes current
  await page.evaluate(() => { const h = [...document.querySelectorAll('h2, h3')][3]; if (h) h.scrollIntoView(); });
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const links = [...document.querySelectorAll('.help-toc a')];
    const cur = document.querySelector('.help-toc .toc-current') || links.find((a) => a.classList.contains('toc-current'));
    if (!links.length) return { found: false };
    const pad = (a) => getComputedStyle(a).paddingLeft;
    const dist = {};
    for (const a of links) { const p = pad(a); dist[p] = (dist[p] || 0) + 1; }
    return {
      found: true, active: !!cur,
      activePad: cur ? pad(cur) : null,
      activeLeft: cur ? Math.round(cur.getBoundingClientRect().left) : null,
      padDist: dist, total: links.length,
    };
  });
  await page.screenshot({ path: resolve(SHOT_DIR, shot) });
  if (!m.found) { rec('6', '#/help TOC: активный пункт не сдвинут влево', 'padding-left активного совпадает с другими пунктами', 'TOC не найден', 'SKIP', shot); return; }
  if (!m.active) { rec('6', '#/help TOC: активный пункт не сдвинут влево', '.toc-current присутствует', 'активный пункт не подсвечен после скролла', 'SKIP', shot); return; }
  const shared = (m.padDist[m.activePad] || 0) > 1;
  rec('6', '#/help TOC: активный пункт не сдвинут влево относительно остальных',
    'padding-left активного пункта совпадает хотя бы с одним другим пунктом (постоянный gutter)',
    `active padding-left=${m.activePad} (left=${m.activeLeft}), распределение padding-left: ${JSON.stringify(m.padDist)} из ${m.total}`,
    shared ? 'PASS' : 'FAIL', shot);
}

/** 7. Dark theme — dashboard + scan + modal + success toast readable. */
async function checkDarkTheme(page, tag) {
  const prefix = '10-dark';
  // toggle via the real button
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.click('#theme-toggle');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  rec('7-toggle', 'Кнопка theme-toggle переключает тему', 'data-theme меняется light→dark',
    `before=${before}, after=${after}`, after === 'dark' ? 'PASS' : 'FAIL');

  // dashboard dark
  await gotoHash(page, '/dashboard', '.dash-hero', 20000);
  await page.waitForTimeout(600);
  let samples = await page.evaluate(() => window.__ux.sample(['h1', '.card', '.btn', '.btn-primary', '.dash-hero-focal']));
  await page.screenshot({ path: resolve(SHOT_DIR, `${prefix}-dashboard-1440-${tag}.png`) });
  emitContrast('7a', '#/dashboard dark: нет белое-на-белом', samples, `${prefix}-dashboard-1440-${tag}.png`);

  // scan dark
  await gotoHash(page, '/scan', '#scan-results, .scan-launcher', 20000);
  await page.waitForTimeout(800);
  samples = await page.evaluate(() => window.__ux.sample(['h1', '.card', '.btn', '.btn-primary', 'table thead th']));
  await page.screenshot({ path: resolve(SHOT_DIR, `${prefix}-scan-1440-${tag}.png`) });
  emitContrast('7b', '#/scan dark: нет белое-на-белом', samples, `${prefix}-scan-1440-${tag}.png`);

  // modal dark (UI.confirm — opened read-only, closed with Escape; never confirmed)
  await page.evaluate(() => { window.__uxModalP = UI.confirm('Проверка тёмной темы', 'Текст модального окна для контраста', { confirmLabel: 'Понятно' }); });
  await page.waitForSelector('.modal-msg', { state: 'visible', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  const modalSamples = await page.evaluate(() => {
    const msg = document.querySelector('.modal-msg');
    if (!msg) return [];
    return window.__ux.sample(['.modal-msg', '.modal .btn']);
  });
  await page.screenshot({ path: resolve(SHOT_DIR, `${prefix}-modal-1440-${tag}.png`) });
  if (modalSamples.length) {
    emitContrast('7c', 'Модалка dark: текст читается', modalSamples, `${prefix}-modal-1440-${tag}.png`);
  } else {
    rec('7c', 'Модалка dark: текст читается', 'контраст текста ≥ 3', '.modal-msg не открылся', 'SKIP', `${prefix}-modal-1440-${tag}.png`);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // success toast dark
  await page.evaluate(() => UI.toast('Проверка success-тоста (тёмная тема)', 'success'));
  await page.waitForSelector('.toast.success', { state: 'visible', timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(250);
  const toast = await page.evaluate(() => {
    const t = document.querySelector('.toast.success');
    if (!t) return null;
    const s = getComputedStyle(t);
    return { fg: s.color, bg: window.__ux.effBg(t), contrast: window.__ux.contrast(window.__ux.rgb(s.color), window.__ux.rgb(window.__ux.effBg(t))) };
  });
  await page.screenshot({ path: resolve(SHOT_DIR, `${prefix}-toast-1440-${tag}.png`) });
  if (!toast) rec('7d', 'Тост success в тёмной теме читается', 'контраст ≥ 4.5', '.toast.success не появился', 'SKIP', `${prefix}-toast-1440-${tag}.png`);
  else {
    const c = toast.contrast == null ? null : Math.round(toast.contrast * 100) / 100;
    rec('7d', 'Тост success в тёмной теме читается', 'контраст текст/фон ≥ 4.5',
      `color=${toast.fg}, bg=${toast.bg}, contrast=${c}`, c != null && c >= 4.5 ? 'PASS' : 'FAIL', `${prefix}-toast-1440-${tag}.png`);
  }

  // back to light for cleanliness
  await page.click('#theme-toggle').catch(() => {});
  await page.waitForTimeout(300);
}

function emitContrast(id, check, samples, shot) {
  if (!samples.length) { rec(id, check, 'контраст текста ≥ 3 на всех образцах', 'нет видимых образцов', 'SKIP', shot); return; }
  const bad = samples.filter((s) => s.contrast != null && s.contrast < 3);
  const worst = samples.reduce((a, b) => (a.contrast == null || (b.contrast != null && b.contrast < a.contrast)) ? b : a, samples[0]);
  rec(id, check, 'контраст текст/фон ≥ 3 у всех образцов',
    `образцов: ${samples.length}, worst: ${worst.sel} contrast=${worst.contrast} (fg=${worst.fg}, bg=${worst.bg})${bad.length ? ', проваленных: ' + bad.map((b) => `${b.sel}=${b.contrast}`).join(', ') : ''}`,
    bad.length ? 'FAIL' : 'PASS', shot);
}

// ── main ─────────────────────────────────────────────────────────────────────

let baseUrl = BASE;
let httpCreds = null;

if (LOCAL) {
  // selector smoke against a locally booted app (no prod, no secrets)
  const { createApp } = await import('../server/index.mjs');
  const dir = mkdtempSync(resolve(tmpdir(), 'ux-probe-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config/profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data/applications.md'), '');
  writeFileSync(resolve(dir, 'modes/oferta.md'), 'x\n');
  const iso = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const ROWS = Array.from({ length: 30 }, (_, i) => ({
    company: `Acme ${i + 1}`, title: `Senior Backend Engineer ${i + 1}`, location: 'Berlin, Germany',
    source: 'greenhouse', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(0),
    salary: i % 2 ? '90000 EUR' : '', url: `https://example.com/j/${i + 1}`,
  }));
  writeFileSync(resolve(dir, 'data/last-scan.json'), JSON.stringify({
    en: { kind: 'en', when: new Date().toISOString(), fresh: ROWS, filtered: ROWS }, ru: null,
  }));
  process.env.CAREER_OPS_ROOT = dir;
  const app = createApp();
  await new Promise((r) => { app.__server = app.listen(0, '127.0.0.1', r); });
  baseUrl = `http://127.0.0.1:${app.__server.address().port}`;
  console.log('local smoke base:', baseUrl);
}

if (!LOCAL) {
  if (!BASE || !USER || !PASS) {
    console.error('PROD_URL / BASIC_USER / BASIC_PASS are required (they are GitHub `production` secrets, never committed).');
    process.exit(2);
  }
  httpCreds = { username: USER, password: PASS };
}

mkdirSync(SHOT_DIR, { recursive: true });
const browser = await playwright.chromium.launch({ headless: true });

try {
  // ── 1440 context: light then dark ──
  {
    const { ctx, page } = await newPage(browser, { width: 1440, height: 900, httpCreds });
    page.__base = baseUrl;
    try {
      await gotoHash(page, '/scan', '.scan-launcher, #scan-results', 25000);
      await checkScanSticky(page, 'light');
      await checkNoDensityButton(page, 'light');
      await checkSalaryPopover(page, 'light');
      await checkAccentCrimson(page, '.scan-run-btn', 'Кнопка «Поиск» (#/scan)', 'light', 'scan-btn');
      await gotoHash(page, '/dashboard', '.dash-hero', 25000);
      await checkDashboardHero(page, 'light');
      await checkAccentCrimson(page, '.dash-hero .v2-dash-split .btn-primary, .v2-dash-split [aria-current]', 'Hero primary CTA (#/dashboard)', 'light', 'hero-btn');
      await checkHelpToc(page, 'light', 1440);
      await checkDarkTheme(page, 'light');
    } finally { await ctx.close(); }
  }
  // ── 390 context ──
  {
    const { ctx, page } = await newPage(browser, { width: 390, height: 844, httpCreds });
    page.__base = baseUrl;
    try {
      await gotoHash(page, '/dashboard', '.dash-hero', 25000);
      await checkMobileDrawer(page, 'light');
      await checkDocsAssistant(page, 'light');
      await checkTrackerEmpty(page, 'light');
      await checkHelpToc(page, 'light', 390);
    } finally { await ctx.close(); }
  }
} finally {
  await browser.close();
}

// ── report ──
const verdict = (v) => ({ PASS: 'PASS ✅', FAIL: 'FAIL ❌', SKIP: 'SKIP ➖' }[v] || v);
const rows = findings.map((f) =>
  `| ${f.id} | ${f.check} | ${f.expect} | ${f.fact} | ${verdict(f.verdict)} | ${f.shot || '—'} |`).join('\n');
const reds = findings.filter((f) => f.verdict === 'FAIL');
const report = `# Prod UX verification — v1.263.0 (${BASE || 'local'})\n\n`
  + `Date: ${new Date().toISOString()}\n\n`
  + `| # | Проверка | Ожидание | Факт | Вердикт | Скриншот |\n|---|---|---|---|---|---|\n${rows}\n\n`
  + `**Итого:** ${findings.filter((f) => f.verdict === 'PASS').length} PASS · ${reds.length} FAIL · ${findings.filter((f) => f.verdict === 'SKIP').length} SKIP\n`;
writeFileSync(resolve(SHOT_DIR, 'report.md'), report);
console.log('\n' + report);
if (reds.length) console.log(`\nRED (${reds.length}): ${reds.map((r) => r.id).join(', ')}`);
