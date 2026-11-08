import { describe, expect, it } from "vitest";
import type { OutputEvent, Run } from "./api";
import { appendEvents, emptyTimeline, matchesFilter, runTitle, status } from "./presentation";

const event = (id: string, data: string, type = "answer_delta"): OutputEvent => ({
  id,
  data,
  type,
});
describe("output projection", () => {
  it("keeps the same display on an empty poll so reading does not trigger scrolling", () => {
    expect(appendEvents(emptyTimeline, [], false)).toBe(emptyTimeline);
  });
  it("preserves delta text across pages and keeps authoritative results separate", () => {
    const first = appendEvents(emptyTimeline, [event("1", "Hello ")], false);
    const next = appendEvents(
      first,
      [event("2", "世界"), event("3", "Hello 世界", "result")],
      false,
    );
    expect(next.events.map((row) => row.data)).toEqual(["Hello 世界", "Hello 世界"]);
    expect(next.events.map((row) => row.type)).toEqual(["answer_delta", "result"]);
    expect(first.events[0].data).toBe("Hello ");
  });
  it("clears old output on journal replacement", () => {
    const first = appendEvents(emptyTimeline, [event("1", "old")], false);
    expect(appendEvents(first, [event("2", "new")], true).events).toEqual([event("2", "new")]);
  });
  it("bounds long sessions and makes omitted output observable", () => {
    const rows = Array.from({ length: 600 }, (_, n) =>
      event(String(n), "x".repeat(4000), "tool_started"),
    );
    const result = appendEvents(emptyTimeline, rows, false);
    expect(result.omitted).toBe(true);
    expect(result.events.at(-1)?.id).toBe("599");
    expect(
      result.events.reduce((sum, row) => sum + (row.data?.length || 0), 0),
    ).toBeLessThanOrEqual(1_000_000);
  });
  it("caps a single giant event with an explicit omission flag", () => {
    const result = appendEvents(emptyTimeline, [event("1", "x".repeat(2_000_000))], false);
    expect(result.events[0].data?.length).toBe(1_000_000);
    expect(result.omitted).toBe(true);
  });
});
describe("run discovery", () => {
  const run: Run = { run_id: "run_codex-check-ui", agent_id: "codex", status: "running" };
  it("does not mistake a stale supervisor for a working agent", () => {
    const stale = { ...run, effective_status: "stale" };
    expect(status(stale)).toBe("stale");
    expect(matchesFilter(stale, "active")).toBe(false);
    expect(matchesFilter(stale, "errors")).toBe(true);
  });
  it("keeps unreadable entries visible under errors", () => {
    expect(matchesFilter({ run_id: "broken", unreadable: "Invalid metadata" }, "errors")).toBe(
      true,
    );
  });
  it("uses the semantic run name without inventing a task or hierarchy", () => {
    expect(runTitle(run)).toBe("check ui");
    expect(runTitle({ run_id: "legacy-id" })).toBe("legacy id");
  });
});
