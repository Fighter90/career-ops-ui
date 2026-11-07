/**
 * Career tasks routes (v1.271.0 — «Career tasks» kanban).
 *
 * A personal task board stored in the user layer at
 * `data/career-tasks.json` (shape `{ tasks: [...] }`). Plain CRUD — no LLM,
 * no relays — backing the Growth-group kanban view (columns = the three
 * canonical statuses, cards drag between them via PUT {status}).
 *
 *   GET    /api/tasks       → 200 { tasks: [...] }  (newest-updated first)
 *   POST   /api/tasks       → 201 { task }
 *   PUT    /api/tasks/:id   → 200 { task } | 404    (partial update; drag = {status})
 *   DELETE /api/tasks/:id   → 200 { ok: true } | 404
 *
 * Every write runs under withFileLock + atomicWrite (temp-then-rename) —
 * the same lost-update/crash-safety envelope as the memory route — and
 * re-reads the file INSIDE the lock, so concurrent POSTs never drop rows.
 * Reads fail safe: a missing or corrupt file yields `{ tasks: [] }` (a
 * corrupt parse warns once per process, until a successful read resets it).
 */
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PATHS } from '../paths.mjs';
import { withFileLock, atomicWrite } from '../file-lock.mjs';
import { writeRateLimit } from '../rate-limit.mjs';

// Canonical, board-ordered workflow states (columns): backlog → in-progress → done.
export const TASK_STATUSES = ['backlog', 'in-progress', 'done'];
const PRIORITIES = ['high', 'normal', 'low'];

const MAX_TITLE = 200;
const MAX_NOTES = 2000;
const MAX_TAGS = 8;
const MAX_TAG = 24;

// Warn at most once per process for a corrupt file; a successful read resets
// the latch so a later corruption warns again instead of staying silent.
let corruptWarned = false;

const makeId = () =>
  `t-${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0')}`;

/**
 * Validate + normalize the mutable task fields. Returns `{ error }` on the
 * first violation, else the normalized values (title/notes/priority/tags,
 * status only when requested). Shared by POST and PUT ("same field
 * validation" per the API contract).
 */
function validateFields(body, { withStatus = false } = {}) {
  const b = body && typeof body === 'object' ? body : {};
  const out = {};

  if (withStatus && b.status !== undefined) {
    if (!TASK_STATUSES.includes(b.status)) {
      return { error: `status must be one of: ${TASK_STATUSES.join(', ')}` };
    }
    out.status = b.status;
  }

  if (b.title !== undefined) {
    if (typeof b.title !== 'string') return { error: 'title must be a string' };
    const title = b.title.trim();
    if (!title) return { error: 'title must be a non-empty string' };
    if (title.length > MAX_TITLE) return { error: `title must be at most ${MAX_TITLE} characters` };
    out.title = title;
  }

  if (b.notes !== undefined) {
    if (typeof b.notes !== 'string') return { error: 'notes must be a string' };
    if (b.notes.length > MAX_NOTES) return { error: `notes must be at most ${MAX_NOTES} characters` };
    out.notes = b.notes;
  }

  if (b.priority !== undefined) {
    if (!PRIORITIES.includes(b.priority)) {
      return { error: `priority must be one of: ${PRIORITIES.join(', ')}` };
    }
    out.priority = b.priority;
  }

  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags)) return { error: 'tags must be an array of strings' };
    if (b.tags.length > MAX_TAGS) return { error: `tags must contain at most ${MAX_TAGS} entries` };
    const tags = [];
    for (const tag of b.tags) {
      if (typeof tag !== 'string') return { error: 'tags must be an array of strings' };
      const t = tag.trim();
      if (!t) return { error: 'tags must not contain empty entries' };
      if (t.length > MAX_TAG) return { error: `each tag must be at most ${MAX_TAG} characters` };
      tags.push(t);
    }
    out.tags = tags;
  }

  return { values: out };
}

/** Fail-safe read: missing/corrupt file → [] (corrupt parse warns once). */
export function readTasks() {
  if (!existsSync(PATHS.careerTasks)) return [];
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(PATHS.careerTasks, 'utf8'));
  } catch {
    if (!corruptWarned) {
      console.warn(`career-tasks: corrupt ${PATHS.careerTasks} — starting from an empty board`);
      corruptWarned = true;
    }
    return [];
  }
  corruptWarned = false;
  const tasks = parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks) ? parsed.tasks : [];
  // Keep only well-shaped rows so a hand-edited file can't poison the board.
  return tasks.filter((t) => t && typeof t === 'object' && typeof t.id === 'string' && typeof t.title === 'string');
}

export function readTasksFile() {
  return { tasks: readTasks() };
}

/**
 * Read-modify-write under the one lock: the re-read INSIDE withFileLock is
 * what keeps concurrent POSTs from clobbering each other (the lost-update
 * race), and atomicWrite keeps a crash mid-save from truncating the file.
 * `fn` returns undefined when nothing changed (unknown id) — the write is
 * skipped, so a 404 never (re)creates the file.
 */
async function mutateTasks(fn) {
  let result;
  await withFileLock(PATHS.careerTasks, () => {
    mkdirSync(dirname(PATHS.careerTasks), { recursive: true });
    const tasks = readTasks();
    result = fn(tasks);
    if (result === undefined) return;
    atomicWrite(PATHS.careerTasks, JSON.stringify({ tasks }, null, 2));
  });
  return result;
}

/** Newest-updated first (stable sort keeps insertion order on full ties). */
function byNewestUpdated(a, b) {
  return String(b.updated).localeCompare(String(a.updated));
}

export function registerTasksRoutes(app) {
  app.get('/api/tasks', (_req, res) => {
    res.json(readTasksFile());
  });

  app.post('/api/tasks', writeRateLimit(), async (req, res) => {
    const v = validateFields(req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    if (v.values.title === undefined) return res.status(400).json({ error: 'title must be a non-empty string' });
    const now = new Date().toISOString();
    const task = {
      id: makeId(),
      title: v.values.title,
      notes: v.values.notes ?? '',
      status: 'backlog',
      priority: v.values.priority ?? 'normal',
      tags: v.values.tags ?? [],
      created: now,
      updated: now,
    };
    try {
      await mutateTasks((tasks) => { tasks.push(task); return true; });
    } catch {
      return res.status(500).json({ error: 'failed to save tasks' });
    }
    return res.status(201).json({ task });
  });

  app.put('/api/tasks/:id', writeRateLimit(), async (req, res) => {
    const v = validateFields(req.body, { withStatus: true });
    if (v.error) return res.status(400).json({ error: v.error });
    const patch = v.values;
    let updated;
    try {
      updated = await mutateTasks((tasks) => {
        const task = tasks.find((t) => t.id === req.params.id);
        if (!task) return undefined;
        // Partial update: only the provided fields move; every write bumps `updated`.
        Object.assign(task, patch, { updated: new Date().toISOString() });
        return task;
      });
    } catch {
      return res.status(500).json({ error: 'failed to save tasks' });
    }
    if (!updated) return res.status(404).json({ error: 'task not found' });
    return res.json({ task: updated });
  });

  app.delete('/api/tasks/:id', writeRateLimit(), async (req, res) => {
    let removed;
    try {
      removed = await mutateTasks((tasks) => {
        const i = tasks.findIndex((t) => t.id === req.params.id);
        if (i === -1) return undefined;
        tasks.splice(i, 1);
        return true;
      });
    } catch {
      return res.status(500).json({ error: 'failed to save tasks' });
    }
    if (!removed) return res.status(404).json({ error: 'task not found' });
    return res.json({ ok: true });
  });
}
