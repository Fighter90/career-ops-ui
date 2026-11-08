"""Read-only initial view of this caller's existing runs."""
from steer.launcher import launcher_metadata


def launch_focus(registry, env, *, mine=False, run_id=""):
    focus = {}
    caller = None
    if mine:
        caller = launcher_metadata(env)
        if caller["launcher"] == "unknown":
            raise ValueError("Cannot identify this launcher. Set PORCH_LAUNCHER explicitly or open the unfiltered UI.")
        focus = {"scope": "mine", "launcher": caller["launcher"]}
        if caller.get("launcher_instance"):
            focus["instance"] = caller["launcher_instance"]
    if run_id:
        meta = registry.load_meta(run_id)
        if caller and (meta.get("launcher") != caller["launcher"] or
                       (caller.get("launcher_instance") and
                        meta.get("launcher_instance") != caller["launcher_instance"])):
            raise ValueError("That run belongs to another launcher or session. Use --focus-run without --mine to open it directly.")
        focus["run"] = run_id
    return focus
