/**
 * cvstart.org — the only client-side JS on the site (< 15KB gzip budget).
 * Everything here is progressive enhancement: the page is fully readable
 * and navigable without it (html.js gates all hiding CSS).
 */

/* ---------------------------------------------------------------- header */
const header = document.querySelector('.site-header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ----------------------------------------------------------- mobile menu */
const menuBtn = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
if (menuBtn && mobileMenu) {
  const setOpen = (open) => {
    mobileMenu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  menuBtn.addEventListener('click', () => setOpen(mobileMenu.hidden));
  mobileMenu.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target.closest('[data-close-menu]')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !mobileMenu.hidden) setOpen(false);
  });
}

/* ------------------------------------------------------ language switcher */
for (const details of document.querySelectorAll('details.lang-switcher')) {
  const summary = details.querySelector('summary');
  const options = [...details.querySelectorAll('[role="option"]')];
  const sync = () => summary.setAttribute('aria-expanded', String(details.open));
  details.addEventListener('toggle', sync);
  sync();
  document.addEventListener('click', (e) => {
    if (details.open && !details.contains(e.target)) details.open = false;
  });
  details.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      details.open = false;
      summary.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = options.indexOf(document.activeElement);
    const next =
      e.key === 'ArrowDown'
        ? options[Math.min(i + 1, options.length - 1)] || options[0]
        : options[Math.max(i - 1, 0)] || options[0];
    next.focus();
  });
  // Remember an explicit language choice.
  details.addEventListener('click', (e) => {
    const opt = e.target.closest('[role="option"]');
    if (opt && opt.dataset.code) {
      try {
        localStorage.setItem('cvstart-lang', opt.dataset.code);
      } catch {
        /* private mode */
      }
    }
  });
}

/* ------------------------------------------------------------ install tabs */
for (const widget of document.querySelectorAll('[data-install]')) {
  const tabs = [...widget.querySelectorAll('.install-tab')];
  const panels = [...widget.querySelectorAll('.install-panel')];
  const select = (name) => {
    for (const t of tabs) t.setAttribute('aria-selected', String(t.dataset.tab === name));
    for (const p of panels) p.hidden = p.dataset.panel !== name;
  };
  for (const t of tabs) t.addEventListener('click', () => select(t.dataset.tab));
  tabs
    .filter((t) => t.getAttribute('role') === 'tab')
    .forEach((t, idx, arr) => {
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = arr[(idx + dir + arr.length) % arr.length];
        next.focus();
        select(next.dataset.tab);
      });
    });
  select(tabs[0] && tabs[0].dataset.tab);
}

/* ------------------------------------------------------------ copy buttons */
const live = document.getElementById('copy-live');
for (const btn of document.querySelectorAll('[data-copy]')) {
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
    } catch {
      return;
    }
    btn.classList.add('copied'); // icon swap is class-driven in global.css
    if (live) live.textContent = btn.dataset.copiedLabel || 'Copied';
    setTimeout(() => {
      btn.classList.remove('copied');
      if (live) live.textContent = '';
    }, 1500);
  });
}

/* ------------------------------------------------- scroll reveal (one-shot) */
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if ('IntersectionObserver' in window && !reduced) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        if (en.target.classList.contains('terminal')) en.target.classList.add('played');
        else en.target.classList.add('in');
        io.unobserve(en.target);
      }
    },
    { threshold: 0.15 }
  );
  for (const el of document.querySelectorAll('.reveal, .terminal')) io.observe(el);
} else {
  for (const el of document.querySelectorAll('.reveal')) el.classList.add('in');
  for (const el of document.querySelectorAll('.terminal')) el.classList.add('played');
}

/* --------------------------------------------------------- language banner */
(() => {
  const banner = document.getElementById('lang-banner');
  if (!banner) return;
  let stored = null;
  try {
    stored = localStorage.getItem('cvstart-lang');
  } catch {
    return;
  }
  if (stored) return; // choice already made (switch or dismiss) — never nag again
  const current = document.documentElement.dataset.locale;
  const locales = JSON.parse(banner.dataset.locales || '[]');
  const norm = (s) => s.toLowerCase();
  const findLocale = (tag) => {
    const lower = norm(tag);
    let hit = locales.find((l) => norm(l.code) === lower);
    if (hit) return hit;
    const primary = lower.split('-')[0];
    if (primary === 'zh') {
      return locales.find((l) => norm(l.code) === (/tw|hant|hk|mo/.test(lower) ? 'zh-tw' : 'zh-cn'));
    }
    hit = locales.find((l) => norm(l.code).split('-')[0] === primary);
    return hit;
  };
  let target = null;
  for (const tag of navigator.languages || [navigator.language]) {
    const found = findLocale(tag);
    if (found) {
      target = found;
      break;
    }
  }
  if (!target || target.code === current) return;
  const text = (banner.dataset.text || '').replace('{lang}', target.endonym);
  banner.querySelector('#lang-banner-text').textContent = text;
  const link = banner.querySelector('#lang-banner-link');
  link.href = target.path;
  link.addEventListener('click', () => {
    try {
      localStorage.setItem('cvstart-lang', target.code);
    } catch {
      /* ignore */
    }
  });
  banner.querySelector('#lang-banner-dismiss').addEventListener('click', () => {
    try {
      localStorage.setItem('cvstart-lang', current);
    } catch {
      /* ignore */
    }
    banner.hidden = true;
  });
  banner.hidden = false;
})();

/* ------------------------------------------------------- live GitHub stars */
/* The build snapshots the star count into the page (sync-assets.mjs). This
 * refreshes it from the GitHub API on every visit so the number never goes
 * stale between deploys. Progressive enhancement: on any failure the
 * build-time value (or a hidden badge) stays as-is. */
(() => {
  const counters = document.querySelectorAll('[data-gh-stars]');
  if (!counters.length) return;
  fetch('https://api.github.com/repos/Fighter90/career-ops-ui', {
    headers: { accept: 'application/vnd.github+json' },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const stars = data && typeof data.stargazers_count === 'number' ? data.stargazers_count : null;
      if (stars === null) return;
      const text = stars.toLocaleString('en-US');
      for (const el of counters) {
        el.textContent = text;
        const badge = el.closest('[data-gh-stars-badge]');
        if (badge) badge.hidden = false;
      }
    })
    .catch(() => {
      /* offline / rate-limited — keep the build-time snapshot */
    });
})();
