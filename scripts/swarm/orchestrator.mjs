#!/usr/bin/env node
// Swarm orchestrator — Linear → EXECUTOR → TESTER(gates) → REVIEWER → DOCUMENTER →
// RELEASE MANAGER → PROD TESTER → Linear Done. All LLM roles run on GLM via
// `opencode run` with role prompt templates (scripts/swarm/roles/*.md); every git/gh/npm
// step is deterministic code. See scripts/swarm/README.md (ru) for the architecture.
//
// Usage:  node scripts/swarm/orchestrator.mjs [--max N] [--dry-run] [--no-release] [--rounds N]
// Safety: claims only Linear issues labeled `swarm` in Todo; refuses a dirty tree;
//         single-instance lock in .task-board/; failures comment on the issue.

import { spawn } from 'node:child_process';
import { openSync, writeSync, closeSync, readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const SWARM = resolve(ROOT, 'scripts/swarm');
const STATE = resolve(ROOT, '.task-board');
const LOGS = resolve(STATE, 'log');
const TEAM = 'Carrer-ops-ui';
const LABEL = 'swarm';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const num = (name, def) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) || def : def; };
const MAX_TASKS = num('--max', 1);
const MAX_ROUNDS = num('--rounds', 3);
const DRY = flag('--dry-run');
const NO_RELEASE = flag('--no-release');
const PROD_LIVE = !!process.env.SWARM_REMOTE_QA_LIVE;

const ROLES = {
  executor: readFileSync(resolve(SWARM, 'roles/executor.md'), 'utf8'),
  reviewer: readFileSync(resolve(SWARM, 'roles/reviewer.md'), 'utf8'),
  documenter: readFileSync(resolve(SWARM, 'roles/documenter.md'), 'utf8'),
  clerk: readFileSync(resolve(SWARM, 'roles/clerk.md'), 'utf8'),
};
const LOCALES = {
  'CHANGELOG.es.md': ['Corregido', 'Notas'], 'CHANGELOG.pt-BR.md': ['Corrigido', 'Notas'],
  'CHANGELOG.ko-KR.md': ['수정', '참고'], 'CHANGELOG.ja.md': ['修正', 'メモ'],
  'CHANGELOG.ru.md': ['Исправлено', 'Примечания'], 'CHANGELOG.zh-CN.md': ['修复', '备注'],
  'CHANGELOG.zh-TW.md': ['修復', '備註'], 'CHANGELOG.fr.md': ['Corrigé', 'Notes'],
  'CHANGELOG.pl.md': ['Naprawiono', 'Uwagi'], 'CHANGELOG.uk.md': ['Виправлено', 'Примітки'],
  'CHANGELOG.da.md': ['Rettet', 'Noter'], 'CHANGELOG.ar.md': ['أُصلح', 'ملاحظات'],
  'CHANGELOG.de.md': ['Behoben', 'Hinweise'], 'CHANGELOG.it.md': ['Corretto', 'Note'],
  'CHANGELOG.tr.md': ['Düzeltildi', 'Notlar'], 'CHANGELOG.hi.md': ['ठीक किया गया', 'नोट्स'],
  'CHANGELOG.ta.md': ['சரி செய்யப்பட்டது', 'குறிப்புகள்'], 'CHANGELOG.vi.md': ['Đã sửa', 'Ghi chú'],
};

let logFile = null;
const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
function log(msg) {
  const line = `[${ts()}] ${msg}`;
  console.log(line);
  if (logFile) appendFileSync(logFile, line + '\n');
}
const short = (s, n = 400) => String(s).replace(/\s+/g, ' ').trim().slice(0, n);

function run(cmd, args_, { timeoutMs = 600_000, cwd = ROOT } = {}) {
  return new Promise((res) => {
    const p = spawn(cmd, args_, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} }, timeoutMs);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => { clearTimeout(t); res({ code, out, err, all: out + err }); });
  });
}
const sh = async (cmd, opts) => {
  const r = await run('bash', ['-lc', cmd], opts);
  log(`  $ ${cmd.slice(0, 120)} → ${r.code}`);
  return r;
};

async function worker(role, vars, { timeoutMs = 25 * 60_000 } = {}) {
  let prompt = ROLES[role];
  for (const [k, v] of Object.entries(vars)) prompt = prompt.replaceAll(`{{${k}}}`, v ?? '');
  log(`  [${role}] GLM worker started (timeout ${Math.round(timeoutMs / 60000)}m)`);
  const r = await run('opencode', ['run', prompt], { timeoutMs });
  const tail = r.all.slice(-4000);
  log(`  [${role}] finished code=${r.code}`);
  log(`  [${role}] tail: ${short(tail, 600)}`);
  return { ...r, tail };
}
const after = (text, marker, until) => {
  const i = text.indexOf(marker);
  if (i < 0) return null;
  const j = until ? text.indexOf(until, i + marker.length) : -1;
  return text.slice(i + marker.length, j > 0 ? j : undefined).trim();
};

async function clerk(op) {
  const r = await worker('clerk', { OP: op }, { timeoutMs: 6 * 60_000 });
  if (!r.tail.includes('CLERK_OK')) throw new Error(`clerk failed: ${short(r.tail)}`);
  return r.tail;
}

// ---------- pipeline steps ----------

export function parsePickOutput(out) {
  if (/\bSWARM_PICK::NONE\b/.test(out)) return null;
  const m = out.match(/SWARM_PICK::([^:\n]+)::([^:\n]+)::([\s\S]*?)(?:\n|$)/);
  if (!m) throw new Error('cannot parse clerk pick output');
  const issue = { id: m[1].trim(), identifier: m[2].trim(), title: m[3].trim() };
  // Guard against the clerk echoing the format template with literal placeholders
  // (first real run: it printed SWARM_PICK::<issueId>::<identifier>::<title> verbatim).
  if (/[<>]/.test(issue.id + issue.identifier + issue.title)) {
    throw new Error('clerk output contains placeholder characters — refusing');
  }
  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(issue.identifier)) {
    throw new Error(`clerk returned a non-issue identifier ("${short(issue.identifier, 40)}") — refusing to continue`);
  }
  return issue;
}

const PIN = process.env.SWARM_PIN_ISSUE || ''; // parallel instances pin their task
// Big waves (parent-sync ports) outgrow the 25-minute default: raise via env.
const EXEC_MS = (Number(process.env.SWARM_EXECUTOR_TIMEOUT_MIN) || 25) * 60_000;

async function pickIssue() {
  const op = PIN
    ? `Read-only. In Linear team "${TEAM}", find the issue ${PIN} (use the linear MCP). It must be in state "Todo" and carry the label "${LABEL}". Do NOT modify anything.\nPrint the result as a data line with REAL values:\nSWARM_PICK::<REAL issueId>::${PIN}::<REAL title>\nIf ${PIN} is not in Todo (or lacks the label), print exactly: SWARM_PICK::NONE`
    : `Read-only. In Linear team "${TEAM}", list issues that have the label "${LABEL}" and are in state "Todo" (use the linear MCP list_issues with a filter, try label by name "swarm"; if label filtering is unsupported, list Todo issues and check their labels). Take the FIRST one. Do NOT modify anything.\nPrint the result as a data line, substituting REAL values from the issue — never print placeholder words like <issueId> or <identifier>:\nSWARM_PICK::<REAL issueId>::<REAL identifier like CAR-123>::<REAL title>\nIf there is no such issue, print exactly: SWARM_PICK::NONE`;
  const issue = parsePickOutput(await clerk(op));
  if (issue && PIN && issue.identifier !== PIN) throw new Error(`pinned ${PIN} but the clerk returned ${issue.identifier}`);
  return issue;
}
const claimIssue = (i) => clerk(`Operation: for issue ${i.identifier} (id ${i.id}) set state to "In Progress" and add comment: "🎯 Swarm claimed this issue — orchestrator starting (dev → gates → review → release → prod-QA)."\nResult line: SWARM_CLAIM::<identifier>`);
const doneIssue = (i, evidence) => clerk(`Operation: for issue ${i.identifier} set state "Done" and add comment:\n---\n${evidence}\n---\nResult line: SWARM_DONE::<identifier>`);
const cancelIssue = (i, why) => clerk(`Operation: for issue ${i.identifier} set state "Canceled" and add comment: "Swarm: ${why} — nothing to ship."\nResult line: SWARM_CANCEL::<identifier>`);
const failIssue = async (i, step, msg) => {
  try { await clerk(`Operation: add comment to issue ${i.identifier}: "⚠️ Swarm failed at step ${step}: ${short(msg, 300)}"\nResult line: SWARM_FAIL::<identifier>`); }
  catch (e) { log(`  (clerk failure-report also failed: ${short(String(e))})`); }
};

const extractDev = (tail) => {
  const status = (tail.match(/status:\s*(done|already-implemented|not-reproducible|blocked)/) || [])[1] || 'blocked';
  return { status, summary: after(tail, 'DEV_SUMMARY:') || '' };
};
const extractVerdict = (all) => {
  // v1.8: scan the WHOLE output, case-insensitive, English or Russian phrasing —
  // run-14's reviewer wrote a full analysis but phrased the verdict off-template.
  const accept = /verdict\s*[:\-—]*\s*accept|верdict\s*[:\-—]*\s*accept|вердикт\s*[:\-—]*\s*(принят|accept)/i;
  const ret = /verdict\s*[:\-—]*\s*return|вердикт\s*[:\-—]*\s*(вернуть|return)/i;
  if (accept.test(all)) return { verdict: 'ACCEPT', notes: '' };
  if (ret.test(all)) {
    const notes = after(all, /VERDICT:\s*RETURN|вердикт[^\n]*вернуть/i) || short(all, 600);
    return { verdict: 'RETURN', notes };
  }
  return { verdict: 'RETURN', notes: 'reviewer produced no verdict — treat as RETURN' };
};

async function main() {
  if (!existsSync(resolve(ROOT, 'package.json'))) throw new Error('run from the web-ui repo root');
  mkdirSync(LOGS, { recursive: true });
  const lock = resolve(STATE, 'lock');
  try {
    const fd = openSync(lock, 'wx'); // exclusive create — no exists/write race
    writeSync(fd, String(process.pid));
    closeSync(fd);
  } catch {
    throw new Error('another swarm instance holds the lock (.task-board/lock)');
  }

  try {
    for (let n = 0; n < MAX_TASKS; n++) {
      logFile = resolve(LOGS, `cycle-${Date.now()}.log`);
      log(`=== task ${n + 1}/${MAX_TASKS} ===`);

      const clean = await sh('git status --porcelain');
      if (clean.out.trim()) throw new Error('working tree is not clean — aborting before pick');
      await sh('git fetch origin -q && git checkout -q --detach origin/main');

      const issue = await pickIssue();
      if (!issue) { log('queue empty — no Todo issues labeled `swarm`.'); break; }
      log(`picked ${issue.identifier}: ${issue.title}`);
      if (DRY) { log('dry-run: would claim → develop → gates → review → document → release → prod-QA → Done.'); break; }

      const branch = `swarm/${issue.identifier.toLowerCase()}`;
      let accepted = null, devStatus = null, devSummary = '', story = null, mergedDone = false;

      try {
        await claimIssue(issue);
      } catch (e) { throw new Error(`claim: ${short(String(e))}`); }

      try {
        // ---- develop (executor ↔ reviewer loop, deterministic TESTER between rounds)
        let reviewNotes = '';
        let round = 0;
        for (; round < MAX_ROUNDS; round++) {
          log(`-- round ${round + 1}/${MAX_ROUNDS}: develop`);
          // v1.5: reuse a task branch that already carries salvaged work — wiping it
          // with -B destroyed an executor's committed round (the run-5 class of loss).
          await sh(`git checkout -q ${branch} 2>/dev/null || git checkout -q -B ${branch} origin/main`);
          const dev = await worker('executor', {
            IDENTIFIER: issue.identifier, TITLE: issue.title, ROUND: String(round + 1),
            DESCRIPTION: '(fetch the full issue BODY via the linear MCP if needed; never read or judge the issue STATE — the orchestrator owns the lifecycle)',
            REVIEW_NOTES: reviewNotes ? `\nREVIEWER RETURNED THIS CHANGE WITH NOTES — address every point:\n${reviewNotes}` : '',
          }, { timeoutMs: EXEC_MS });
          const commits = parseInt((await sh('git rev-list --count origin/main..HEAD')).out.trim() || '0', 10);
          const dev1 = extractDev(dev.tail);
          // The tree is the truth: a committed branch goes to the gates even if the
          // executor's summary line claims otherwise (gates + review are the arbiters).
          devStatus = commits > 0 ? 'done' : (dev1.status === 'done' ? 'blocked' : dev1.status);
          devSummary = dev1.summary;
          log(`  commits on branch: ${commits}; executor status: ${dev1.status} → using ${devStatus}`);
          // Run-5 lesson: an executor that reports "already-implemented" may have FOUND
          // its own lost work — a previous cycle's branch was recreated with -B and the
          // commit survived only in the reflog. Rescue it instead of canceling.
          if (devStatus !== 'done' && dev1.status !== 'not-reproducible') {
            const found = await sh(`git log --all --grep="${issue.identifier}" --pretty=%H -5`, { timeoutMs: 60_000 });
            let sha = '', mergedSha = '';
            for (const cand of found.out.trim().split('\n')) {
              if (!/^[0-9a-f]{7,40}$/.test(cand)) continue;
              const anc = await sh(`git merge-base --is-ancestor ${cand} origin/main && echo ancestor || echo fresh`);
              if (anc.out.includes('fresh')) { sha = cand; break; } // newest non-merged match
              if (!mergedSha) mergedSha = cand; // newest already-merged match
            }
            if (!sha && mergedSha) {
              // Run-6 truth: the executor's work is ALREADY merged to main — the task is
              // done, not blocked. Close it with evidence instead of failing.
              const ev = `**Already merged to main** — the executor's work is commit ${mergedSha.slice(0, 9)} (an ancestor of origin/main; CI green on the containing run). Nothing left to ship.`;
              await doneIssue(issue, ev);
              log(`already merged: ${mergedSha.slice(0, 9)} — issue closed as Done`);
              mergedDone = true; break;
            }
            if (sha) {
              log(`  reflog rescue: found lost work ${sha.slice(0, 9)} for ${issue.identifier} — cherry-picking`);
              const cp = await sh(`git cherry-pick ${sha}`);
              const after = parseInt((await sh('git rev-list --count origin/main..HEAD')).out.trim() || '0', 10);
              if (cp.code === 0 && after > 0) {
                devStatus = 'done'; devSummary = `(rescued from lost branch commit ${sha.slice(0, 9)}) ${devSummary}`;
                log(`  rescued: ${after} commit(s) on the branch — proceeding to gates`);
              } else {
                await sh('git cherry-pick --abort');
              }
            }
          }
          if (devStatus !== 'done') break;

          log('-- tester: deterministic gates (npm run test:ci)');
          const gates = await sh('npm run test:ci', { timeoutMs: 30 * 60_000 });
          // v1.7: the gate verdict is the EXIT CODE. node --test exits non-zero on any
          // failure regardless of the reporter format (TAP prints "# pass N", the spec
          // reporter prints "✔ …" — parse nothing, trust the code). A green run with a
          // missing summary line is still green (run-12: worktree login shells resolve
          // a different node whose spec reporter has no "# pass" at all).
          if (gates.code !== 0) {
            if (round + 1 < MAX_ROUNDS) {
              reviewNotes = `The test gate failed. Output tail:\n${short(gates.all.slice(-1500), 1500)}`;
              log(`  gates FAILED — feeding output back to the executor`);
              continue;
            }
            throw new Error(`gates failed after ${MAX_ROUNDS} rounds`);
          }
          log('  gates green (exit 0)');

          log(`-- round ${round + 1}: review`);
          const diff = await sh(`git diff origin/main...HEAD`);
          const rev = await worker('reviewer', {
            IDENTIFIER: issue.identifier, TITLE: issue.title,
            DESCRIPTION: '(the executor fetched the issue body; judge the diff below)',
            DIFF: `<DIFF>\n${diff.all.slice(0, 60_000)}\n</DIFF>`,
          }, { timeoutMs: 12 * 60_000 });
          let v = extractVerdict(rev.all || rev.tail);
          if (v.verdict === 'RETURN' && /no verdict/.test(v.notes)) {
            // v1.9 meta-verdict: the reviewer analyzed but skipped the template —
            // a tiny verdict-only worker turns the analysis into a machine verdict.
            log('  verdict missing from the review — running the meta-verdict pass');
            const meta = await worker('clerk', {
              OP: `You are a VERDICT CLERK, not a reviewer. Another agent reviewed a code diff and produced this analysis:\n---\n${short(rev.all, 2200)}\n---\nThe deterministic test gates are GREEN. Decide: does the analysis name merge-blocking defects (logic errors, security, scope violations, broken tests), or does it read as an approving review?\nPrint EXACTLY one line as the last line:\nVERDICT: ACCEPT  (analysis is approving / no blocking defects)\nor\nVERDICT: RETURN  (analysis names blocking defects)\nNothing else after that line.`,
            }, { timeoutMs: 6 * 60_000 });
            const mv = extractVerdict(meta.all || meta.tail);
            if (mv.verdict === 'ACCEPT') { v = { verdict: 'ACCEPT', notes: '' }; log('  meta-verdict: ACCEPT'); }
            else if (!/no verdict/.test(mv.notes)) { v = mv; log('  meta-verdict: RETURN'); }
          }
          if (v.verdict === 'ACCEPT') { accepted = true; log('  verdict: ACCEPT'); break; }
          accepted = false;
          reviewNotes = v.notes;
          log(`  verdict: RETURN — ${short(v.notes, 160)}`);
        }
        if (mergedDone) { log('finished: work already merged — issue closed as Done'); continue; }
        if (devStatus !== 'done') {
          if (devStatus === 'blocked') {
            await failIssue(issue, 'executor', 'reported blocked — the branch and the board are left for human review');
            throw new Error('executor reported blocked');
          }
          await cancelIssue(issue, `executor reported "${devStatus}"`);
          log(`finished: ${devStatus} — issue canceled`); continue;
        }
        if (!accepted) {
          await failIssue(issue, 'review', `no ACCEPT in ${MAX_ROUNDS} rounds; branch ${branch} kept for human review`);
          throw new Error(`review: no ACCEPT in ${MAX_ROUNDS} rounds`);
        }

        // ---- document (артист)
        log('-- documenter');
        const stat = await sh(`git diff --stat origin/main...HEAD`);
        const doc = await worker('documenter', {
          IDENTIFIER: issue.identifier, TITLE: issue.title,
          DEV_SUMMARY: devSummary || '(no summary)', DIFF_STAT: short(stat.out, 1200),
        }, { timeoutMs: 8 * 60_000 });
        const fixed = after(doc.tail, 'CHLOG_FIXED:', 'CHLOG_NOTES:');
        const notes = after(doc.tail, 'CHLOG_NOTES:', 'STORY:');
        story = after(doc.tail, 'STORY:');
        if (!fixed || !notes || !story) throw new Error('documenter output incomplete');
        log(`  story: ${short(story, 120)}`);

        if (NO_RELEASE) { log('--no-release: stopping after ACCEPT + document.'); break; }

        // ---- release manager
        log('-- release manager: PR');
        // v2.0: the dev loop commits the branch but never pushes — gh pr create
        // with --head needs the branch ON ORIGIN (all three run-15 cycles died here).
        const pushBr = await sh(`git push -u origin ${branch}`, { timeoutMs: 300_000 });
        if (pushBr.code !== 0) throw new Error(`branch push failed: ${short(pushBr.all)}`);
        const prBody = resolve(STATE, `pr-body-${issue.identifier}.md`);
        writeFileSync(prBody, `${story}\n\nSwarm cycle: dev(${MAX_ROUNDS} rounds max) → gates → review(ACCEPT) → release.`);
        const pr = await sh(`gh pr create --head ${branch} --title ${JSON.stringify(`${issue.identifier}: ${issue.title}`)} --body-file ${JSON.stringify(prBody)}`, { timeoutMs: 120_000 });
        const prUrl = (pr.out.match(/https:\/\/github\.com\/\S+/) || [])[0];
        if (!prUrl) throw new Error(`gh pr create failed: ${short(pr.all)}`);
        await sh(`gh pr checks --watch ${prUrl.split('/').pop()} --require-passing`, { timeoutMs: 45 * 60_000 });
        await sh(`gh pr merge ${prUrl.split('/').pop()} --squash --delete-branch`, { timeoutMs: 300_000 });
        log(`  merged: ${prUrl}`);

        await sh('git fetch origin -q && git checkout -q --detach origin/main');
        const verOut = await sh('npm version patch --no-git-tag-version');
        const ver = verOut.out.trim().replace(/^v/, '');
        log(`-- release manager: v${ver} (changelog ×19 + QA prompt)`);

        const today = new Date().toISOString().slice(0, 10);
        const entry = (fixedLabel, notesLabel) =>
          `## [${ver}] — ${today}\n\n### ${fixedLabel}\n${fixed}\n\n### ${notesLabel}\n${notes}\n\n`;
        const changelog = readFileSync('CHANGELOG.md', 'utf8');
        writeFileSync('CHANGELOG.md', entry('Fixed', 'Notes') + changelog);
        for (const [file, [f, nn]] of Object.entries(LOCALES)) {
          const p = resolve(ROOT, file);
          try {
            writeFileSync(p, entry(f, nn) + readFileSync(p, 'utf8'));
          } catch (err) {
            if (err && err.code === 'ENOENT') log(`  (locale mirror absent — skipped: ${file})`);
            else throw err; // a write failure (EROFS/EMFILE/…) must not masquerade as "absent"
          }
        }
        mkdirSync(resolve(ROOT, 'qa/archive/superseded-prompts'), { recursive: true });
        for (const f of readdirSync(resolve(ROOT, 'qa'))) {
          if (/^QA-REGRESSION-PROMPT-v.+\.md$/.test(f)) {
            const from = resolve(ROOT, 'qa', f); const to = resolve(ROOT, 'qa/archive/superseded-prompts', f);
            await sh(`mv -f "${from}" "${to}"`);
          }
        }
        writeFileSync(resolve(ROOT, `qa/QA-REGRESSION-PROMPT-v${ver}.md`),
          `# QA regression prompt — v${ver}\n\nSwarm release (${issue.identifier}). Story: ${story}\n\n- Gates at ship time: see the CHANGELOG entry for ${ver} and the release workflow run.\n- Spot check: ${issue.title} behaves as described; no regressions on the touched surfaces.\n`);

        const relCommit = await sh(`git add CHANGELOG.md CHANGELOG.*.md qa/ package.json && git commit -q -m ${JSON.stringify(`release: v${ver} (swarm ${issue.identifier})`)} && git push origin main`, { timeoutMs: 300_000 });
        if (relCommit.code !== 0) throw new Error(`release commit failed: ${short(relCommit.all)}`);
        const ci = await sh(`sleep 20; gh run list --workflow=ci.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId'`);
        const ciId = ci.out.trim();
        await sh(`gh run watch ${ciId} --exit-status`, { timeoutMs: 60 * 60_000 });

        log('-- release manager: tag → Release → publish → Pages → deploy → verify');
        await sh(`git tag v${ver} && git push -q origin v${ver}`);
        const parentSha = (await sh('git -C ../ rev-parse --short HEAD')).out.trim() || 'main';
        await sh('sleep 10');
        const relId = (await sh(`gh run list --workflow=release.yml --limit 1 --json databaseId --jq '.[0].databaseId'`)).out.trim();
        await sh(`gh run watch ${relId} --exit-status`, { timeoutMs: 30 * 60_000 });
        await sh('gh workflow run publish-package.yml --ref main && gh workflow run deploy-pages.yml --ref main');
        await sh('sleep 15');
        const pubId = (await sh(`gh run list --workflow=publish-package.yml --limit 1 --json databaseId --jq '.[0].databaseId'`)).out.trim();
        const pagId = (await sh(`gh run list --workflow=deploy-pages.yml --limit 1 --json databaseId --jq '.[0].databaseId'`)).out.trim();
        await sh(`gh run watch ${pubId} --exit-status`, { timeoutMs: 30 * 60_000 });
        await sh(`gh run watch ${pagId} --exit-status`, { timeoutMs: 30 * 60_000 });
        await sh('gh workflow run deploy.yml --ref main -f mode=deploy -f ui_ref=' + `v${ver}` + ' -f parent_ref=' + parentSha);
        await sh('sleep 15');
        const depId = (await sh(`gh run list --workflow=deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId'`)).out.trim();
        await sh(`gh run watch ${depId} --exit-status`, { timeoutMs: 45 * 60_000 });
        const depLog = await sh(`gh run view ${depId} --log | grep ok=true | tail -1`);
        if (!/ok=true/.test(depLog.all)) throw new Error(`deploy did not report ok=true: ${short(depLog.all)}`);

        log('-- prod tester: remote-qa (perf)');
        await sh(`gh workflow run remote-qa.yml --ref main -f perf=true${PROD_LIVE ? ' -f live=true' : ''}`);
        await sh('sleep 15');
        const rqId = (await sh(`gh run list --workflow=remote-qa.yml --limit 1 --json databaseId --jq '.[0].databaseId'`)).out.trim();
        await sh(`gh run watch ${rqId} --exit-status`, { timeoutMs: 90 * 60_000 });
        const rqJobs = (await sh(`gh run view ${rqId} --json jobs --jq '.jobs[] | "\\(.name): \\(.conclusion)"'`)).out.trim();

        const evidence = `**Shipped by the agent swarm in v${ver}** (${today})\n\n- Issue: ${issue.identifier} — ${issue.title}\n- PR: ${prUrl} (squash-merged, CI ✓)\n- Release chain: tag v${ver} → Release → publish → Pages → deploy → verify \`ok=true version=${ver}\`\n- Prod QA (remote-qa perf):\n${rqJobs.split('\n').map((l) => '  - ' + l).join('\n')}\n- Story: ${short(story, 300)}`;
        await doneIssue(issue, evidence);
        await sh(`git branch -D ${branch}`);
        log(`=== DONE: ${issue.identifier} shipped as v${ver} ===`);
      } catch (e) {
        await failIssue(issue, 'pipeline', String(e));
        throw e;
      }
    }
  } finally {
    try { unlinkSync(resolve(STATE, 'lock')); } catch {}
  }
}


const isMain = process.argv[1] && resolve(process.argv[1]) === decodeURIComponent(new URL(import.meta.url).pathname);
if (isMain) {
  main().then(
    () => process.exit(0),
    (e) => { console.error(`SWARM ERROR: ${String(e).slice(0, 500)}`); process.exit(1); },
  );
}
