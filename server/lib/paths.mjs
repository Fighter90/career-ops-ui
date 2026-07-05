import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// __dirname is .../server/lib  →  go up twice to repo root
export const WEB_UI_ROOT = resolve(__dirname, '..', '..');
export const PUBLIC_DIR = resolve(WEB_UI_ROOT, 'public');

/**
 * Resolve where the parent career-ops project lives:
 *   1. CAREER_OPS_ROOT env var (absolute or relative to cwd)
 *   2. ../  (when this repo is dropped in as career-ops/web-ui)
 *   3. cwd  (when launched from inside career-ops itself)
 *
 * The first option that contains a recognizable career-ops file (cv.md or
 * portals.yml) wins. If none match, default to ../ and let the user notice
 * via the Health page.
 */
function resolveProjectRoot() {
  const candidates = [];
  if (process.env.CAREER_OPS_ROOT) {
    candidates.push(resolve(process.cwd(), process.env.CAREER_OPS_ROOT));
  }
  candidates.push(resolve(WEB_UI_ROOT, '..'));     // career-ops/web-ui case
  candidates.push(process.cwd());                  // launched from inside career-ops

  for (const c of candidates) {
    if (existsSync(resolve(c, 'cv.md')) || existsSync(resolve(c, 'portals.yml'))) {
      return c;
    }
  }
  return candidates[0] ?? candidates[1];
}

export const PROJECT_ROOT = resolveProjectRoot();

export const path = (...segments) => resolve(PROJECT_ROOT, ...segments);

export const PATHS = {
  root: PROJECT_ROOT,
  applications: path('data', 'applications.md'),
  pipeline: path('data', 'pipeline.md'),
  scanHistory: path('data', 'scan-history.tsv'),
  followUps: path('data', 'follow-ups.md'),
  activityLog: path('data', 'activity.jsonl'),
  roleStats: path('data', 'role-stats.jsonl'),
  llmUsage: path('data', 'llm-usage.jsonl'),
  reportsDir: path('reports'),
  jdsDir: path('jds'),
  outputDir: path('output'),
  modesDir: path('modes'),
  // G-008 (v1.15.0) — `modes/_profile.md` is the canonical "Career framing"
  // file per career-ops.org/docs/.../what-is-career-ops §Step-5. It holds
  // target roles, framing, exit narrative, comp targets, location policy.
  // Never committed (.gitignore in parent). Surfaced via the new
  // #/config → Modes tab and a read-only card on #/profile.
  modesProfile: path('modes', '_profile.md'),
  modesProfileTemplate: path('modes', '_profile.template.md'),
  interviewPrepDir: path('interview-prep'),
  // v1.90.0 (Epic 15) — the candidate's own STAR+R story bank, inlined into
  // the mock-interview prompt (same trust level as cv.md per DATA_CONTRACT).
  storyBank: path('interview-prep', 'story-bank.md'),
  // v1.91.0 (Epic 16) — saved networking plans (who-to-contact + outreach
  // drafts + company dossier), written only on explicit user Save.
  networkingDir: path('networking'),
  // v1.13.0 — batch evaluate flow (canonical career-ops.org guide §4).
  batchDir: path('batch'),
  batchInput: path('batch', 'batch-input.tsv'),
  batchRunner: path('batch', 'batch-runner.sh'),
  batchAdditionsDir: path('batch', 'tracker-additions'),
  cv: path('cv.md'),
  // v1.92.0 (Epic 21 — CV Studio) — voice/style source of truth for the
  // "make it human / match my voice" rewrite. Both are in-scope per the
  // DATA_CONTRACT (voice-dna governs HOW text reads; writing-samples are the
  // user's own prose). Never introduce new factual claims from them.
  voiceDna: path('voice-dna.md'),
  writingSamplesDir: path('writing-samples'),
  profile: path('config', 'profile.yml'),
  twoPager: path('config', 'two-pager.yml'),
  // v1.93.0 (Epic 24 — memory layer) — a short, USER-EDITABLE "remember this
  // about me" note (behavioural steering + preferences, never fabricated
  // content). Inlined into bundleProjectContext so it reaches every AI request
  // across all providers. User layer; never overwritten by system updates.
  memory: path('config', 'memory.md'),
  // v1.95.0 (Epic 26 — career plan) — a personalized AI-generated career
  // development plan (roadmap, SMART/OKR goals, skill plan). Saved to the user
  // layer on explicit Save; never overwritten by system updates.
  careerPlan: path('config', 'career-plan.md'),
  portals: path('portals.yml'),
  packageJson: path('package.json'),
  version: path('VERSION'),
  envFile: path('.env'),
};
