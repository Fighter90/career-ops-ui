import { useEffect, useRef, useState } from "react";
import { type OutputEvent, type Run, saveOutput } from "./api";
import {
  duration,
  launcherName,
  projectName,
  runProblem,
  runTitle,
  status,
  terminalStatuses,
} from "./presentation";
import { RunStatus } from "./RunStatus";
import { useOutput } from "./use-observer";

function Event({ event }: { event: OutputEvent }) {
  const text = event.data || "";
  if (event.type === "answer_delta") return <article className="answer-text">{text}</article>;
  if (event.type === "result")
    return (
      <details className="event-disclosure result">
        <summary>Complete response</summary>
        <pre>{text}</pre>
      </details>
    );
  if (event.type === "thinking_delta")
    return (
      <details className="event-disclosure reasoning">
        <summary>
          Reasoning<span>{text.length.toLocaleString()} characters</span>
        </summary>
        <pre>{text}</pre>
      </details>
    );
  if (event.type.startsWith("tool_"))
    return (
      <details className="event-disclosure tool">
        <summary>
          <span className="event-icon" aria-hidden="true">
            ⌘
          </span>
          {event.tool_name || "Tool"}
          <span>{event.type === "tool_started" ? "started" : "completed"}</span>
        </summary>
        <pre>{text || "No tool details were recorded."}</pre>
      </details>
    );
  return (
    <div className={`lifecycle-event ${event.type === "run_failed" ? "event-error" : ""}`}>
      <span className="event-icon" aria-hidden="true">
        ·
      </span>
      <div>
        <span>{event.type.replaceAll("_", " ")}</span>
        {text && <pre>{text}</pre>}
      </div>
      {event.ts && <time dateTime={event.ts}>{new Date(event.ts).toLocaleTimeString()}</time>}
    </div>
  );
}

export function RunDetail({ run }: { run: Run }) {
  const [tab, setTab] = useState<"output" | "final">("output");
  const [fromStart, setFromStart] = useState(0);
  const [follow, setFollow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const output = useOutput(run.run_id, fromStart);
  const scroll = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  useEffect(() => {
    if (tab === "final" && scroll.current) scroll.current.scrollTop = 0;
  }, [tab]);
  useEffect(() => {
    if (follow && tab === "output" && output.timeline.events.length && scroll.current) {
      scroll.current.scrollTop = scroll.current.scrollHeight;
      atBottom.current = true;
    }
  }, [output.timeline, follow, tab]);
  async function save() {
    setSaving(true);
    setSaveError("");
    try {
      await saveOutput(run.run_id, tab === "output" ? "events" : "final");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }
  const state = status(run);
  return (
    <main className="detail" aria-label="Run details">
      <header className="detail-heading">
        <div className="breadcrumb">
          {projectName(run.cwd)}
          <span>/</span>
          {run.agent_id || "Unknown agent"}
        </div>
        <div className="detail-title">
          <h2>{runTitle(run)}</h2>
          <RunStatus run={run} />
        </div>
        <div className="run-meta">
          <span>{run.model || "Model unavailable"}</span>
          {run.effort && <span>{run.effort} effort</span>}
          <span>{duration(run)} elapsed</span>
        </div>
        <details className="run-info">
          <summary>Run information</summary>
          <dl>
            <dt>Run ID</dt>
            <dd>{run.run_id}</dd>
            {run.native_session_id && (
              <>
                <dt>Native session ID</dt>
                <dd>{run.native_session_id}</dd>
              </>
            )}
            {run.turn_count != null && (
              <>
                <dt>Porch turns</dt>
                <dd title="Initial request plus follow-up requests sent through Porch">
                  {run.turn_count}
                </dd>
              </>
            )}
            <dt>Directory</dt>
            <dd>{run.cwd || "Unavailable"}</dd>
            <dt>Launched by</dt>
            <dd>{launcherName(run)}</dd>
            <dt>Backend</dt>
            <dd>{run.backend || "Unavailable"}</dd>
            <dt>Started</dt>
            <dd>{run.started_at || "Unavailable"}</dd>
            {run.continued_from && (
              <>
                <dt>Continued from</dt>
                <dd>{run.continued_from}</dd>
              </>
            )}
            {run.exit_code != null && (
              <>
                <dt>Exit code</dt>
                <dd>{run.exit_code}</dd>
              </>
            )}
          </dl>
        </details>
      </header>
      {runProblem(run) && (
        <div className="notice error-notice" role="alert">
          {runProblem(run)}
          {(run.error || run.unreadable) && (
            <details>
              <summary>Error details</summary>
              <pre>{run.error || run.unreadable}</pre>
            </details>
          )}
        </div>
      )}
      <div className="output-toolbar">
        <fieldset className="tabs" aria-label="Output view">
          <button type="button" aria-pressed={tab === "output"} onClick={() => setTab("output")}>
            Live output
          </button>
          <button type="button" aria-pressed={tab === "final"} onClick={() => setTab("final")}>
            Final answer{output.final?.available && <span className="available-dot" />}
          </button>
        </fieldset>
        <button
          type="button"
          className="text-button save-button"
          disabled={saving || (tab === "final" && !output.final?.available)}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save output ↓"}
        </button>
      </div>
      {(output.error || saveError) && (
        <div className="notice error-notice" role="alert">
          {output.error || saveError}
          {output.error && " · Retrying automatically. Last received output is retained."}
        </div>
      )}
      {output.resetNotice && (
        <div className="notice">
          The journal changed or was replaced. The view restarted from the current journal.
        </div>
      )}
      {tab === "output" && (output.earlier || output.timeline.omitted) && (
        <div className="notice history-notice">
          <span>
            {output.timeline.omitted
              ? "Older output is outside the display window. Save output for the complete journal."
              : "Showing recent output."}
          </span>
          {!fromStart && (
            <button type="button" onClick={() => setFromStart((value) => value + 1)}>
              Load from start
            </button>
          )}
        </div>
      )}
      <div
        className="output-scroll"
        ref={scroll}
        onScroll={() => {
          const element = scroll.current;
          if (!element) return;
          const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 60;
          if (atBottom.current && !nearBottom) setFollow(false);
          atBottom.current = nearBottom;
        }}
      >
        {tab === "output" ? (
          <div className="timeline">
            {!output.timeline.events.length && (
              <div className="output-empty">
                <h3>{!output.ready ? "Reading output…" : "No output recorded yet"}</h3>
                <p>
                  {terminalStatuses.has(state)
                    ? "Check Final answer for the saved result."
                    : "New events will appear here as the agent emits them. Silence does not mean the agent is idle."}
                </p>
              </div>
            )}
            {output.timeline.events.map((event) => (
              <Event key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="final-answer">
            {output.final?.truncated && (
              <div className="notice">
                Preview limited to 2 MiB. Save output for the complete answer.
              </div>
            )}
            {output.final?.available ? (
              <>
                <div className="section-label">SAVED FINAL ANSWER</div>
                <pre>{output.final.text || "The saved final answer is empty."}</pre>
              </>
            ) : (
              <div className="output-empty">
                <h3>
                  {terminalStatuses.has(state)
                    ? "No final answer was saved"
                    : "The final answer will appear here"}
                </h3>
                <p>Live output remains available in the other tab.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <footer className="output-footer">
        <span>{output.error ? "Connection interrupted" : "Updates automatically"}</span>
        {tab === "output" && (
          <button
            type="button"
            className={`follow-button ${follow ? "following" : ""}`}
            aria-pressed={follow}
            onClick={() => setFollow((value) => !value)}
          >
            {follow ? "Following output ↓" : "Jump to latest ↓"}
          </button>
        )}
      </footer>
    </main>
  );
}
