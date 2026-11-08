import { useEffect, useState } from "react";
import { type FinalAnswer, finalSchema, get, pageSchema, runPath, runsSchema } from "./api";
import { appendEvents, emptyTimeline } from "./presentation";

const message = (error: unknown) => (error instanceof Error ? error.message : "Observation failed");

export function useRuns() {
  const [snapshot, setSnapshot] = useState<ReturnType<typeof runsSchema.parse> | null>(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await get(
          "/api/runs",
          runsSchema,
          AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        );
        if (controller.signal.aborted) return;
        setSnapshot(result);
        setError("");
        setUpdatedAt(new Date().toLocaleTimeString());
      } catch (error) {
        if (!controller.signal.aborted) setError(message(error));
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, document.hidden ? 5000 : 2000);
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  return { snapshot, error, updatedAt };
}

export function useOutput(runId: string, fromStart: number) {
  const [timeline, setTimeline] = useState(emptyTimeline);
  const [final, setFinal] = useState<FinalAnswer | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [earlier, setEarlier] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let cursor = fromStart ? "start" : "";
    setTimeline(emptyTimeline);
    setFinal(null);
    setReady(false);
    setEarlier(false);
    setResetNotice(false);
    async function poll() {
      let hasMore = false;
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]);
        const page = await get(
          `${runPath(runId, "events")}?cursor=${encodeURIComponent(cursor)}`,
          pageSchema,
          signal,
        );
        if (controller.signal.aborted) return;
        cursor = page.next_cursor;
        setTimeline((previous) => appendEvents(previous, page.events, page.reset));
        if (page.reset) setEarlier(page.earlier_omitted);
        else if (page.earlier_omitted) setEarlier(true);
        if (page.reset) setResetNotice(true);
        setReady(true);
        hasMore = page.has_more;
        const answer = await get(runPath(runId, "final"), finalSchema, signal);
        if (controller.signal.aborted) return;
        setFinal((previous) =>
          previous?.text === answer.text &&
          previous.available === answer.available &&
          previous.truncated === answer.truncated
            ? previous
            : answer,
        );
        setError("");
      } catch (error) {
        if (!controller.signal.aborted) setError(message(error));
      }
      if (!controller.signal.aborted)
        timer = setTimeout(poll, hasMore ? 50 : document.hidden ? 5000 : 1000);
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [runId, fromStart]);
  return { timeline, final, error, ready, earlier, resetNotice };
}
