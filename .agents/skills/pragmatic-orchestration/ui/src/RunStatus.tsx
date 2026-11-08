import type { Run } from "./api";
import { status, statusLabel } from "./presentation";

export function RunStatus({ run }: { run: Run }) {
  const state = status(run);
  return (
    <span className={`status ${state}`}>
      <span className="status-dot" />
      {statusLabel(run)}
    </span>
  );
}
