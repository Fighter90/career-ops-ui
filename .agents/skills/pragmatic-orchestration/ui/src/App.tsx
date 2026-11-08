import { useEffect, useMemo, useState } from "react";
import { FilterSelect } from "./FilterSelect";
import { readFocus } from "./focus";
import {
  duration,
  groupByLauncher,
  launcherName,
  matchesFilter,
  projectName,
  type RunFilter,
  runTitle,
} from "./presentation";
import { RunDetail } from "./RunDetail";
import { RunStatus } from "./RunStatus";
import { readTheme, saveTheme, type Theme } from "./theme";
import { useRuns } from "./use-observer";

const filters: [RunFilter, string][] = [
  ["all", "All"],
  ["active", "Active"],
  ["errors", "Errors"],
  ["finished", "Finished"],
];

export function App() {
  const { snapshot, error, updatedAt } = useRuns();
  const [launch] = useState(() => readFocus(location.hash));
  const [filter, setFilter] = useState<RunFilter>(launch.mine && !launch.run ? "active" : "all");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("");
  const [launcher, setLauncher] = useState(
    launch.mine ? launcherName({ run_id: "", launcher: launch.launcher }) : "",
  );
  const [instance, setInstance] = useState(launch.instance);
  const [scope, setScope] = useState(launch.mine ? (launch.instance ? "session" : "launcher") : "");
  const [executor, setExecutor] = useState("");
  const [selected, setSelected] = useState(launch.run);
  const [pendingRun, setPendingRun] = useState(launch.run);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const runs = snapshot?.runs || [];
  const facets = useMemo(() => {
    const all = snapshot?.runs || [];
    return {
      launchers: [...new Set(all.map(launcherName))].sort(),
      executors: [...new Set(all.map((run) => run.agent_id || "Unknown executor"))].sort(),
      projects: [...new Set(all.map((run) => run.cwd || "Unknown project"))].sort(),
    };
  }, [snapshot]);
  const hasFilters = !!(launcher || instance || executor || project || query || filter !== "all");
  function resetFilters() {
    setLauncher("");
    setInstance("");
    setScope("");
    setExecutor("");
    setProject("");
    setQuery("");
    setFilter("all");
    setPendingRun("");
  }
  const scopedRuns = useMemo(
    () =>
      (snapshot?.runs || []).filter(
        (run) =>
          (!project || (run.cwd || "Unknown project") === project) &&
          (!launcher || launcherName(run) === launcher) &&
          (!instance || run.launcher_instance === instance) &&
          (!executor || (run.agent_id || "Unknown executor") === executor) &&
          `${run.run_id} ${run.native_session_id || ""} ${run.agent_id} ${run.model} ${run.cwd}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [snapshot, project, launcher, instance, executor, query],
  );
  const visible = useMemo(
    () => scopedRuns.filter((run) => matchesFilter(run, filter)),
    [scopedRuns, filter],
  );
  useEffect(() => {
    if (!snapshot) return;
    if (pendingRun) {
      if (visible.some((run) => run.run_id === pendingRun)) {
        setSelected(pendingRun);
        setPendingRun("");
      }
      return;
    }
    if (!visible.some((run) => run.run_id === selected)) setSelected(visible[0]?.run_id || "");
  }, [snapshot, visible, selected, pendingRun]);
  const run = pendingRun ? undefined : visible.find((run) => run.run_id === selected);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src="/brand/porch-mark.png" width="32" height="32" alt="" />
          <span className="brand-word">
            p<strong>orch</strong>
          </span>
          <span className="workspace-label">/ Runs</span>
        </div>
        <div className="topbar-controls">
          <label className="sr-only" htmlFor="theme">
            Theme
          </label>
          <select
            id="theme"
            className="theme-picker"
            value={theme}
            onChange={(event) => {
              const next = event.target.value as Theme;
              setTheme(next);
              saveTheme(next);
            }}
          >
            <option value="system">System theme</option>
            <option value="light">Light theme</option>
            <option value="dark">Dark theme</option>
          </select>
          <div className="connection" role="status">
            <span className={`connection-dot ${error ? "offline" : ""}`} />
            {error ? "Reconnecting" : snapshot ? "Connected" : "Connecting"}
            <span className="readonly" title="Closing this observer leaves agents running.">
              Read only
            </span>
          </div>
        </div>
      </header>
      {error && (
        <div className="connection-error" role="alert">
          {error} {updatedAt && `Last connected at ${updatedAt}.`} Retrying automatically.
        </div>
      )}
      <div className="workspace">
        <aside className="sidebar" aria-label="Runs">
          <div className="sidebar-heading">
            <h1>Runs</h1>
            <span className="count">{snapshot?.total ?? "—"}</span>
          </div>
          <fieldset className="filters" aria-label="Filter runs">
            {filters.map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                <span>{label}</span>
                <span>{scopedRuns.filter((run) => matchesFilter(run, value)).length}</span>
              </button>
            ))}
          </fieldset>
          <div className="search-controls">
            <label className="sr-only" htmlFor="search">
              Search runs
            </label>
            <input
              id="search"
              type="search"
              placeholder="Search runs, IDs, agents, models…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <FilterSelect
              label="Launched by"
              options={facets.launchers}
              value={launcher}
              onChange={(value) => {
                setLauncher(value);
                setInstance("");
                setScope("");
                setPendingRun("");
              }}
            />
            <FilterSelect
              label="Executor"
              options={facets.executors}
              value={executor}
              onChange={setExecutor}
            />
            <FilterSelect
              label="Project"
              options={facets.projects}
              value={project}
              onChange={setProject}
            />
          </div>
          {scope && (
            <p className="scope-note">
              {scope === "session"
                ? "Showing runs from this agent session."
                : `Session identity is unavailable; showing runs launched by ${launcher}.`}
              {scope === "session" && (
                <button
                  type="button"
                  onClick={() => {
                    setInstance("");
                    setScope("");
                    setPendingRun("");
                  }}
                >
                  Show all {launcher} runs
                </button>
              )}
            </p>
          )}
          {pendingRun && snapshot && !visible.some((item) => item.run_id === pendingRun) && (
            <p className="scope-note" role="status">
              Run {pendingRun} is not available in this view.
              <button type="button" onClick={() => setPendingRun("")}>
                Show available runs
              </button>
            </p>
          )}
          {filter === "errors" && (
            <p className="filter-explanation">
              Failed runs, stopped supervisors, or unreadable status. No approval is being
              requested.
            </p>
          )}
          <div className="list-heading">
            <span>Launched by · {visible.length}</span>
            {hasFilters && (
              <button type="button" onClick={resetFilters}>
                Clear filters
              </button>
            )}
          </div>
          <nav className="run-list" aria-label="Select a run">
            {groupByLauncher(visible).map(([launcher, group]) => (
              <details className="run-group" key={launcher} open>
                <summary>
                  {launcher}
                  <span>{group.length}</span>
                </summary>
                {launcher === "Unknown launcher" && (
                  <p className="group-note">
                    Launcher was not recorded or could not be identified.
                  </p>
                )}
                {group.map((run) => (
                  <button
                    type="button"
                    key={run.run_id}
                    className={`run-row ${selected === run.run_id ? "selected" : ""}`}
                    aria-current={selected === run.run_id ? "true" : undefined}
                    onClick={() => {
                      setPendingRun("");
                      setSelected(run.run_id);
                    }}
                  >
                    <div className="row-top">
                      <span className="run-title">{runTitle(run)}</span>
                      <span className="elapsed">{duration(run)}</span>
                    </div>
                    <div className="row-agent">
                      {run.agent_id || "Unknown agent"}
                      <span>·</span>
                      {projectName(run.cwd)}
                      {run.turn_count != null && (
                        <span
                          className="turn-count"
                          title="Initial request plus follow-up requests sent through Porch"
                        >
                          · {run.turn_count} {run.turn_count === 1 ? "turn" : "turns"}
                        </span>
                      )}
                    </div>
                    <RunStatus run={run} />
                  </button>
                ))}
              </details>
            ))}
            {!visible.length && (
              <div className="list-empty">
                {!snapshot
                  ? "Connecting to Porch…"
                  : runs.length
                    ? "No matching runs."
                    : "No registered runs yet."}
              </div>
            )}
          </nav>
          <footer className="sidebar-footer">
            <details>
              <summary>Registry</summary>
              <p>{snapshot?.registry || "Waiting for connection"}</p>
            </details>
            {snapshot && snapshot.total > runs.length && (
              <p>
                Showing the first {runs.length} of {snapshot.total} runs.
              </p>
            )}
          </footer>
        </aside>
        {run ? (
          <RunDetail key={run.run_id} run={run} />
        ) : (
          <main className="empty-main">
            <span className="empty-glyph" aria-hidden="true">
              ↳
            </span>
            <h2>{runs.length ? "No runs in this view" : "Ready when your agents are"}</h2>
            <p>
              {runs.length
                ? "Try another filter or search."
                : "Start a named delegate from your terminal. It will appear here automatically."}
            </p>
            {!runs.length && (
              <code>porch delegate -a &lt;profile&gt; --name &lt;task&gt; --detach "…"</code>
            )}
            <p className="muted">
              This window observes registered delegate runs. Closing it leaves them running.
            </p>
          </main>
        )}
      </div>
    </div>
  );
}
