import { z } from "zod";

const optionalText = z.string().nullish();
export const runSchema = z.object({
  run_id: z.string(),
  agent_id: optionalText,
  backend: optionalText,
  model: optionalText,
  effort: optionalText,
  cwd: optionalText,
  status: optionalText,
  effective_status: optionalText,
  started_at: optionalText,
  updated_at: optionalText,
  finished_at: optionalText,
  exit_code: z.number().nullish(),
  error: optionalText,
  unreadable: optionalText,
  continued_from: optionalText,
  launcher: optionalText,
  launcher_source: optionalText,
  launcher_instance: optionalText,
  turn_count: z.number().int().nonnegative().nullish(),
  native_session_id: optionalText,
});
export const runsSchema = z.object({
  runs: z.array(runSchema),
  total: z.number(),
  registry: z.string(),
});
export const eventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.string().optional(),
  ts: z.string().optional(),
  tool_name: z.string().optional(),
  tool_id: z.string().optional(),
  steer_status: z.string().optional(),
  delivery_class: z.string().optional(),
});
export const pageSchema = z.object({
  events: z.array(eventSchema),
  next_cursor: z.string(),
  reset: z.boolean(),
  earlier_omitted: z.boolean(),
  has_more: z.boolean(),
  available: z.boolean(),
});
export const finalSchema = z.object({
  text: z.string(),
  available: z.boolean(),
  truncated: z.boolean(),
});
export type Run = z.infer<typeof runSchema>;
export type OutputEvent = z.infer<typeof eventSchema>;
export type EventPage = z.infer<typeof pageSchema>;
export type FinalAnswer = z.infer<typeof finalSchema>;

function headers() {
  const token = new URLSearchParams(location.hash.slice(1)).get("token");
  if (!token) throw new Error("Open the full local URL printed by porch ui.");
  return { Authorization: `Bearer ${token}` };
}

export async function get<T>(path: string, schema: z.ZodType<T>, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    headers: headers(),
    signal,
    cache: "no-store",
    redirect: "error",
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(body);
    throw new Error(error.success ? error.data.error : `Observer returned HTTP ${response.status}`);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error("Observer response is incompatible with this UI.");
  return parsed.data;
}

export function runPath(runId: string, action: string) {
  return `/api/runs/${encodeURIComponent(runId)}/${action}`;
}

export async function saveOutput(runId: string, kind: "events" | "final") {
  const response = await fetch(`${runPath(runId, "download")}?kind=${kind}`, {
    headers: headers(),
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Could not save output (HTTP ${response.status}).`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `${runId}.${kind === "events" ? "jsonl" : "txt"}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
