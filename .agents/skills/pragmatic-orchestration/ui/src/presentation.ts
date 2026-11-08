import type { OutputEvent, Run } from "./api";

export const terminalStatuses = new Set(["completed", "failed", "cancelled"]);
export type RunFilter = "all" | "active" | "errors" | "finished";

export function status(run: Run) {
  return run.unreadable ? "unreadable" : run.effective_status || run.status || "unknown";
}
export function matchesFilter(run: Run, filter: RunFilter) {
  const state = status(run);
  if (filter === "active") return ["starting", "running", "cancelling"].includes(state);
  if (filter === "errors") return ["failed", "stale", "unreadable", "unknown"].includes(state);
  if (filter === "finished") return terminalStatuses.has(state);
  return true;
}
export function launcherName(run: Run) {
  const names: Record<string, string> = {
    codex: "Codex",
    claude: "Claude",
    opencode: "OpenCode",
    grok: "Grok",
    devin: "Devin",
    gemini: "Gemini",
    cursor: "Cursor",
    terminal: "Terminal",
  };
  return names[run.launcher || ""] || "Unknown launcher";
}

export function groupByLauncher(runs: Run[]): [string, Run[]][] {
  const groups = new Map<string, Run[]>();
  for (const run of runs) {
    const name = launcherName(run);
    const group = groups.get(name) || [];
    group.push(run);
    groups.set(name, group);
  }
  return [...groups].sort(([a], [b]) =>
    a === "Unknown launcher" ? 1 : b === "Unknown launcher" ? -1 : a.localeCompare(b),
  );
}

export function statusLabel(run: Run) {
  const state = status(run);
  const labels: Record<string, string> = {
    stale: "Supervisor stopped",
    unreadable: "Unreadable record",
    unknown: "Unknown status",
  };
  return labels[state] || state;
}

export function runProblem(run: Run) {
  const state = status(run);
  if (state === "stale")
    return "The supervisor stopped before recording a result. Review the last output before deciding whether to restart the run.";
  if (state === "unreadable")
    return "The run record cannot be read. Check its registry files; this does not prove that the worker has stopped.";
  if (state === "failed")
    return "The run failed. Review the last output for the cause before retrying.";
  if (state === "unknown")
    return "The run status is unavailable. Check the run record before taking action.";
  return "";
}
export function runTitle(run: Run) {
  const prefix = `run_${run.agent_id}-`;
  return (run.run_id.startsWith(prefix) ? run.run_id.slice(prefix.length) : run.run_id).replaceAll(
    "-",
    " ",
  );
}
export function projectName(path: string | null | undefined) {
  return path?.split(/[\\/]/).filter(Boolean).at(-1) || "Unknown project";
}
export function duration(run: Run) {
  if (!run.started_at) return "—";
  const end = run.finished_at ? Date.parse(run.finished_at) : Date.now();
  const seconds = Math.max(0, Math.floor((end - Date.parse(run.started_at)) / 1000));
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export type Timeline = { events: OutputEvent[]; omitted: boolean };
export const emptyTimeline: Timeline = { events: [], omitted: false };
const MAX_CHARACTERS = 1_000_000;
const MAX_EVENTS = 500;

export function appendEvents(
  previous: Timeline,
  incoming: OutputEvent[],
  reset: boolean,
): Timeline {
  if (!incoming.length && !reset) return previous;
  const events = reset ? [] : previous.events.slice();
  for (const event of incoming) {
    const last = events.at(-1);
    const coalesce =
      last?.type === event.type &&
      ["answer_delta", "thinking_delta"].includes(event.type) &&
      (last.data?.length || 0) + (event.data?.length || 0) < 64_000;
    if (coalesce && last) {
      events[events.length - 1] = { ...last, data: (last.data || "") + (event.data || "") };
    } else events.push(event);
  }
  let characters = events.reduce((sum, event) => sum + (event.data?.length || 0), 0);
  let omitted = reset ? false : previous.omitted;
  while (events.length > MAX_EVENTS || (characters > MAX_CHARACTERS && events.length > 1)) {
    characters -= events.shift()?.data?.length || 0;
    omitted = true;
  }
  // A single valid event may exceed the display budget. Keep its tail explicitly.
  if (events.length === 1 && characters > MAX_CHARACTERS) {
    events[0] = { ...events[0], data: events[0].data?.slice(-MAX_CHARACTERS) };
    omitted = true;
  }
  return { events, omitted };
}
