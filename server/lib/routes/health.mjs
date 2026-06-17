/**
 * Health + Dashboard routes.
 *
 *   GET /api/health    → { ok, warnings, version, parentVersion, checks[] }
 *   GET /api/dashboard → KPI summary for the home view
 *
 * /api/health gates required (system can't function) vs optional
 * (warnings only) checks. When HOST is non-loopback, absolute paths and
 * exact Node versions are replaced with "hidden" to reduce LAN
 * fingerprinting.
 *
 * /api/dashboard aggregates from the parent's applications + pipeline +
 * reports trees via the defensive store helpers.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PATHS, PROJECT_ROOT, WEB_UI_ROOT, path as projPath } from '../paths.mjs';
import { isPubliclyExposed } from '../security.mjs';
import {
  safeReadApps,
  safeReadPipeline,
  safeListReports,
  checkProfileCustomized,
} from '../store.mjs';
import { effectiveEnv, selectActiveProvider } from '../env-config.mjs';
import { hasAnthropicKey, hasGeminiKey } from '../anthropic.mjs';
import { hasOpenAIKey, hasQwenKey, hasOpenRouterKey, hasGitHubModelsKey } from '../openai.mjs';

export function registerHealthRoutes(app) {
  app.get('/api/health', async (_req, res) => {
    const checks = [];
    const hidden = isPubliclyExposed() ? 'hidden' : null;

    // Required checks — system can't function without these
    checks.push({ name: 'Node version', required: true, ok: parseInt(process.versions.node, 10) >= 18, value: hidden ?? `v${process.versions.node}` });
    checks.push({ name: 'Project root', required: true, ok: existsSync(PROJECT_ROOT), value: hidden ?? PROJECT_ROOT });
    checks.push({ name: 'cv.md', required: true, ok: existsSync(PATHS.cv) });
    checks.push({ name: 'config/profile.yml', required: true, ok: existsSync(PATHS.profile) });
    checks.push({ name: 'portals.yml', required: true, ok: existsSync(PATHS.portals) });
    checks.push({ name: 'data/applications.md', required: true, ok: existsSync(PATHS.applications) });
    checks.push({ name: 'data/pipeline.md', required: true, ok: existsSync(PATHS.pipeline) });
    checks.push({ name: 'modes/oferta.md', required: true, ok: existsSync(projPath('modes', 'oferta.md')) });

    // FIX-H6 — flag fresh installs that still have placeholder profile data.
    const profileCustomized = checkProfileCustomized();
    checks.push({
      name: 'Profile customized',
      required: false,
      ok: profileCustomized.ok,
      value: hidden ?? profileCustomized.value,
    });

    // Optional — UI works fine without these
    // Effective view (process.env ∨ parent .env) AND key-plausibility
    // (isUsableKey) — identical to /api/status/providers, so a parent
    // .env placeholder is never reported "set" here either (v1.56.3).
    const geminiSet = hasGeminiKey();
    const anthropicSet = hasAnthropicKey();
    const openaiSet = hasOpenAIKey();
    const qwenSet = hasQwenKey();
    const openrouterSet = hasOpenRouterKey();
    const githubSet = hasGitHubModelsKey();
    checks.push({ name: 'GEMINI_API_KEY', required: false, ok: geminiSet, value: geminiSet ? 'set' : 'unset (manual mode)' });
    checks.push({ name: 'ANTHROPIC_API_KEY', required: false, ok: anthropicSet, value: anthropicSet ? 'set' : 'unset (set to enable live "Run" buttons)' });
    // v1.58.8 — every headless live-eval provider gets a row on `#/health`,
    // mirroring the GEMINI/ANTHROPIC pattern. Same `isUsableKey` gate as
    // /api/status/providers so a placeholder in the parent `.env` is never
    // reported "set" here. "manual mode" copy matches GEMINI's wording —
    // any provider unset just falls back to the prompt-generation flow.
    checks.push({ name: 'OPENAI_API_KEY',     required: false, ok: openaiSet,     value: openaiSet     ? 'set' : 'unset (manual mode)' });
    checks.push({ name: 'QWEN_API_KEY',       required: false, ok: qwenSet,       value: qwenSet       ? 'set' : 'unset (manual mode)' });
    checks.push({ name: 'OPENROUTER_API_KEY', required: false, ok: openrouterSet, value: openrouterSet ? 'set' : 'unset (manual mode)' });
    // v1.74.2 — GitHub Models (GitHub Copilot CLI's API) joins the optional
    // live-eval provider rows; same isUsableKey gate as the others.
    checks.push({ name: 'GITHUB_MODELS_API_KEY', required: false, ok: githubSet, value: githubSet ? 'set' : 'unset (manual mode)' });
    // v1.28.1 — HH_USER_AGENT health row removed. The hh.ru adapter falls
    // back to a baked-in UA when the env var is unset; the 403-from-non-RU
    // gate is documented in help-bundle §16 troubleshooting and the
    // ru-scanner already emits a stderr hint at scan time. Surfacing it as
    // an optional health-check row was redundant noise on the dashboard.
    // Playwright + parent deps — required for PDF generation and liveness
    // checks; we don't install them but surface the gap.
    const playwrightInstalled = existsSync(projPath('node_modules', 'playwright'));
    checks.push({ name: 'Playwright (parent node_modules)', required: false, ok: playwrightInstalled, value: playwrightInstalled ? 'installed' : 'run: cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium' });
    const parentDepsInstalled = existsSync(projPath('node_modules', 'js-yaml'));
    checks.push({ name: 'Parent project dependencies', required: false, ok: parentDepsInstalled, value: parentDepsInstalled ? 'installed' : 'run: cd $CAREER_OPS_ROOT && npm install' });
    // FIX-C6 — directories the scripts write into (auto-created on
    // first write; surfacing the state mirrors `node doctor.mjs`).
    for (const [label, dir] of [
      ['data/ directory',    PATHS.applications.replace(/\/applications\.md$/, '')],
      ['reports/ directory', PATHS.reportsDir],
      ['output/ directory',  PATHS.outputDir],
      ['jds/ directory',     PATHS.jdsDir],
    ]) {
      checks.push({ name: label, required: false, ok: existsSync(dir), value: hidden ?? (existsSync(dir) ? 'exists' : 'will be auto-created on first write') });
    }

    // The footer shows the WEB-UI version (this repo's package.json);
    // parent's VERSION is reported separately as `parentVersion`.
    let version = '?';
    let parentVersion = null;
    try {
      const pkg = JSON.parse(readFileSync(resolve(WEB_UI_ROOT, 'package.json'), 'utf8'));
      version = pkg.version || '?';
    } catch {}
    try {
      parentVersion = readFileSync(PATHS.version, 'utf8').trim();
    } catch {}

    const ok = checks.filter((c) => c.required).every((c) => c.ok);
    const warnings = checks.filter((c) => !c.required && !c.ok).length;
    res.json({ ok, warnings, version, parentVersion, checks });
  });

  // v1.55.3 (UX-2) — surface the 4-provider OR contract to the SPA so
  // a cold-start user learns the ⚡-live key requirement on screen,
  // not by trial. keysConfigured uses the same effective-env view as
  // the llm.mjs gate sites (process.env ∨ parent .env); activeProvider
  // is what the OR-router would actually pick (honors LLM_PROVIDER).
  // Read-only, no secrets returned — only provider names + model id.
  app.get('/api/status/providers', (_req, res) => {
    const keysConfigured = [
      ['anthropic', hasAnthropicKey()],
      ['gemini', hasGeminiKey()],
      ['openai', hasOpenAIKey()],
      ['qwen', hasQwenKey()],
      ['openrouter', hasOpenRouterKey()],
      ['github', hasGitHubModelsKey()],
    ].filter(([, set]) => set).map(([p]) => p);
    const activeProvider = selectActiveProvider(keysConfigured);
    const MODEL_KEY = {
      anthropic: 'ANTHROPIC_MODEL', gemini: 'GEMINI_MODEL',
      openai: 'OPENAI_MODEL', qwen: 'QWEN_MODEL',
      openrouter: 'OPENROUTER_MODEL', github: 'GITHUB_MODELS_MODEL',
    };
    const activeModel = activeProvider
      ? (effectiveEnv(MODEL_KEY[activeProvider], PATHS.envFile) || null)
      : null;
    res.json({ activeProvider, activeModel, keysConfigured });
  });

  app.get('/api/dashboard', (_req, res) => {
    const apps = safeReadApps();
    const pipeline = safeReadPipeline();
    const reports = safeListReports();

    const byStatus = {};
    let totalScore = 0;
    let scored = 0;
    for (const a of apps) {
      const s = (a.status || 'Unknown').trim();
      byStatus[s] = (byStatus[s] || 0) + 1;
      if (typeof a.scoreNum === 'number') {
        totalScore += a.scoreNum;
        scored += 1;
      }
    }

    const recent = apps.slice(-5).reverse();
    res.json({
      counts: {
        applications: apps.length,
        pipeline: pipeline.length,
        reports: reports.length,
      },
      avgScore: scored ? +(totalScore / scored).toFixed(2) : null,
      byStatus,
      recent,
      pipeline: pipeline.slice(0, 10),
      lastReport: reports[0] || null,
    });
  });
}
