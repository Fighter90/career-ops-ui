/* global window, document */
/**
 * provider-logo.js (v1.216.0) — small brand-colored monogram tiles for every
 * LLM provider, shown beside the provider fields in Settings and the per-provider
 * rows on the Usage page.
 *
 * CSP-safe by construction: each tile is built with `createElementNS` +
 * `setAttribute` + `textContent` — NO innerHTML, NO external images (the CSP
 * `img-src`/`default-src` envelope blocks remote logo hosts, so a real vendor
 * logo would never load). A monogram needs no network and can't leak which
 * providers a user has configured to any third party.
 *
 * Loaded via <script src> AFTER provider-status.js (it reuses its labels) and
 * BEFORE the views that render tiles (config.js, usage.js).
 */
window.ProviderLogo = (function () {
  var NS = 'http://www.w3.org/2000/svg';

  // slug → { bg, fg?, tx }. `bg` is the vendor's recognizable brand hue, `tx`
  // is the 1–3 char monogram. `slug` is the dispatch `mode` used app-wide.
  var MARKS = {
    anthropic:  { bg: '#d97757', tx: 'A' },   // Anthropic clay
    claude:     { bg: '#d97757', tx: 'A' },   // alias of anthropic
    gemini:     { bg: '#1a73e8', tx: 'G' },   // Google blue
    openai:     { bg: '#10a37f', tx: 'AI' },  // OpenAI teal
    qwen:       { bg: '#615ced', tx: 'Q' },   // Qwen indigo
    openrouter: { bg: '#6467f2', tx: 'OR' },  // OpenRouter
    github:     { bg: '#24292f', tx: 'GH' },  // GitHub ink
    hermes:     { bg: '#7c3aed', tx: 'H' },   // Nous Research violet
    deepseek:   { bg: '#4d6bfe', tx: 'DS' },  // DeepSeek blue
    zai:        { bg: '#2f6df6', tx: 'GLM' }, // GLM / Z.ai
    kimi:       { bg: '#111827', tx: 'K' },   // Kimi / Moonshot dark
    minimax:    { bg: '#ee2b3b', tx: 'MM' },  // MiniMax red
    mistral:    { bg: '#fa520f', tx: 'M' },   // Mistral orange
    grok:       { bg: '#111827', tx: 'X' },   // xAI black
    together:   { bg: '#0f6fff', tx: 'T' },   // Together blue
    fireworks:  { bg: '#7c3aed', tx: 'FW' },  // Fireworks violet
    ollama:     { bg: '#0b0b0b', tx: 'OL' },  // Ollama black (local)
    ark:        { bg: '#1664ff', tx: 'ARK' }, // BytePlus Ark (Volcano blue)
    arkcn:      { bg: '#0d5bd1', tx: 'ARK' }, // Volcengine Ark (China)
  };
  var DEFAULT_BG = '#64748b';

  // env-var key → provider slug, so a Settings field can find its own tile.
  var KEY_SLUG = {
    ANTHROPIC_API_KEY: 'anthropic', GEMINI_API_KEY: 'gemini', OPENAI_API_KEY: 'openai',
    QWEN_API_KEY: 'qwen', OPENROUTER_API_KEY: 'openrouter', GITHUB_MODELS_API_KEY: 'github',
    HERMES_API_KEY: 'hermes', DEEPSEEK_API_KEY: 'deepseek', ZAI_API_KEY: 'zai',
    MOONSHOT_API_KEY: 'kimi', MINIMAX_API_KEY: 'minimax', MISTRAL_API_KEY: 'mistral',
    XAI_API_KEY: 'grok', TOGETHER_API_KEY: 'together', FIREWORKS_API_KEY: 'fireworks',
    OLLAMA_BASE_URL: 'ollama', ARK_API_KEY: 'ark', ARK_CN_API_KEY: 'arkcn',
  };

  function mark(slug) {
    if (MARKS[slug]) return MARKS[slug];
    var ch = (String(slug || '?').replace(/[^a-z0-9]/gi, '')[0] || '?').toUpperCase();
    return { bg: DEFAULT_BG, tx: ch };
  }

  /** env-var key → slug ('DEEPSEEK_API_KEY' → 'deepseek'), or null. */
  function slugForKey(key) { return KEY_SLUG[key] || null; }

  /** Provider label, reusing ProviderStatus when present ('grok' → 'Grok (xAI)'). */
  function label(slug) {
    if (window.ProviderStatus && typeof window.ProviderStatus.label === 'function') {
      return window.ProviderStatus.label(slug);
    }
    return slug || '';
  }

  /** An <svg> monogram tile for `slug`. `size` px (default 18). CSP-safe DOM. */
  function el(slug, size) {
    var s = Number(size) > 0 ? Number(size) : 18;
    var m = mark(slug);
    var tx = String(m.tx || '?');
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('width', String(s));
    svg.setAttribute('height', String(s));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'provider-logo');
    var rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('width', '32');
    rect.setAttribute('height', '32');
    rect.setAttribute('rx', '7');
    rect.setAttribute('fill', m.bg || DEFAULT_BG);
    var text = document.createElementNS(NS, 'text');
    text.setAttribute('x', '16');
    text.setAttribute('y', '17');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('fill', m.fg || '#ffffff');
    text.setAttribute('font-family', 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif');
    text.setAttribute('font-weight', '700');
    text.setAttribute('font-size', tx.length >= 3 ? '10' : (tx.length === 2 ? '13' : '16'));
    text.textContent = tx;
    svg.appendChild(rect);
    svg.appendChild(text);
    return svg;
  }

  /** Convenience: the tile for a field's env-var key, or null if not a provider. */
  function forKey(key, size) {
    var slug = slugForKey(key);
    return slug ? el(slug, size) : null;
  }

  return {
    MARKS: MARKS, KEY_SLUG: KEY_SLUG,
    mark: mark, slugForKey: slugForKey, label: label, el: el, forKey: forKey,
  };
})();
