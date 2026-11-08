# Task-relative review and acceptance

The caller owns acceptance of delegated work and self/external review findings,
including LLM judge verdicts. Give workers and reviewers the same intended use,
acceptance criteria, required checks, constraints, and non-goals. Keep that
contract stable: neither optional improvements nor pressure to finish authorizes
changing the user's requirements.

## Decide by evidence and task impact

Judge each distinct finding by its evidence, realistic consequences in intended
use, and effect on the agreed outcome. Severity labels, reviewer confidence, and
model agreement are inputs to judgment, not proof or automatic priorities.

- **Fix** verified violations of requirements or material risks in intended use.
- **Verify** plausible concerns that could change acceptance but lack sufficient
  evidence. Use a targeted check rather than a speculative rewrite.
- **Accept or defer** real limitations tolerable within the task's requirements;
  weigh the consequence of deferring against the cost and regression risk of fixing.
- **Dismiss** disproven or duplicate claims, unsupported speculation after
  proportionate investigation, and preferences without meaningful task impact.

An expensive fix does not make a blocker acceptable. MVP scope does not excuse
material security/privacy exposure, data loss, or broken required behavior.
A concrete code-path trace can establish a defect without a reproduction; lack
of a reproduction alone does not justify dismissal. If credible material risk
cannot be resolved, report the blocker instead of claiming acceptance. Request
user input when resolution requires changing the agreed scope or a material
decision the available evidence cannot settle.

For example, an optimization for hypothetical large-scale use can be deferred
when a prototype meets its actual workload requirements. The same performance
issue needs fixing when it violates the task's latency target. A demonstrated
cross-user data leak remains a blocker in an internet-facing MVP.

## Verify and finish

Review the actual result and relevant surrounding behavior against the contract.
Send the worker necessary corrections with focused checks, preserving accepted
tradeoffs. After correction, verify the fixes and plausible regressions; broaden
or repeat review only for a concrete unresolved risk, new evidence, or a required
check. Optional suggestions alone do not justify another round.

Keep brief reasons for dispositions in existing task notes or a required journal,
and carry them into follow-ups. Reopen a decision when changed evidence, code,
requirements, or a demonstrated mistake invalidates its rationale. New material
defects still require handling, even late in review. If correction repeats without
progress, change the approach or report the specific blocker; a round limit does
not authorize accepting unresolved defects.

Finish when the criteria and required checks are satisfied and no material
blockers or acceptance-critical uncertainties remain. Zero suggestions and
unanimous reviewer approval are not prerequisites. In the final response, disclose
real limitations consciously accepted or deferred: why they are acceptable for
this task, their practical consequences, and when to revisit them. Omit dismissed
nits and distinguish unresolved uncertainty from a confirmed limitation.
