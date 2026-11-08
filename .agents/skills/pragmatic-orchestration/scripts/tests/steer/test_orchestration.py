"""Regression coverage for bounded observation and durable follow-up turns."""
import contextlib
import io
import json
import os
import signal
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from test_steer_e2e import PORCH, env_base, extract_run_id
from steer.adapters.opencode import OpenCodeAdapter, _startup_lock, _startup_lock_path
from steer.adapters.codex import CodexAdapter
from steer.adapters.claude import ClaudeAdapter
from steer.config_loader import agent_settings
from steer.control import _duration_seconds
from steer.registry import Registry, RegistryError
from steer.launcher import launcher_metadata
from steer.session import SessionLease
from steer.supervisor import Supervisor
from steer.util import atomic_write_json, atomic_write_text
from steer.waiter import wait_for_any, wait_for_terminal


class OrchestrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="porch-orchestration-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "raw").mkdir()
        self.reg = Registry(self.root / "registry")
        self.env = env_base(self.reg.root, self.root / "artifacts")
        self.env["PORCH_FAKE_STEER_SLOW"] = "0.02"
        self.env["PORCH_SAVE_OUTPUTS"] = "0"
        self.env["PORCH_FAKE_RPC_LOG"] = str(self.root / "rpc.jsonl")

    def run_record(self, status="running", **extra):
        rid = self.reg.create_run(agent_id="codex", backend="codex-cli", model="test",
                                  cwd=str(self.root), artifacts_dir=str(self.root / "artifacts"),
                                  extra={"effort": "high", "backend_binary": "codex", **extra})
        self.reg.update_meta(rid, status=status, exit_code=0 if status == "completed" else None)
        return rid

    def cli(self, *args, **kwargs):
        return subprocess.run([str(PORCH), "delegate", *args], cwd=kwargs.pop("cwd", self.root),
                              env=kwargs.pop("env", self.env), text=True, input="", capture_output=True,
                              timeout=30, **kwargs)

    def start_durable(self):
        p = self.cli("-a", "codex", "--persist-session", "INITIAL_ONLY")
        self.assertEqual(p.returncode, 0, p.stderr)
        rid = extract_run_id(p.stderr)
        self.assertTrue(rid)
        return rid

    def rpc_calls(self):
        p = self.root / "rpc.jsonl"
        return [json.loads(x) for x in p.read_text().splitlines()] if p.exists() else []

    def test_named_run_ids_carry_agent_and_slug(self):
        rid = self.reg.create_run(agent_id="grok", backend="grok-build", model="test",
                                  cwd=str(self.root), artifacts_dir=str(self.root / "artifacts"),
                                  run_name="Fix Auth Race!")
        self.assertEqual(rid, "run_grok-fix-auth-race")

    def test_named_run_id_collision_takes_counter_suffix(self):
        kwargs = dict(agent_id="grok", backend="grok-build", model="test",
                      cwd=str(self.root), artifacts_dir=str(self.root / "artifacts"))
        first = self.reg.create_run(run_name="fix-auth-race", **kwargs)
        second = self.reg.create_run(run_name="fix auth race", **kwargs)
        third = self.reg.create_run(run_name="FIX_AUTH_RACE", **kwargs)
        self.assertEqual(first, "run_grok-fix-auth-race")
        self.assertEqual(second, "run_grok-fix-auth-race-2")
        self.assertEqual(third, "run_grok-fix-auth-race-3")

    def test_unnamed_run_id_keeps_agent_prefix_and_word_pair(self):
        rid = self.reg.create_run(agent_id="codex", backend="codex-cli", model="test",
                                  cwd=str(self.root), artifacts_dir=str(self.root / "artifacts"))
        self.assertRegex(rid, r"^run_codex-[a-z]+-[a-z]+-[0-9a-f]{4}$")

    def test_name_only_punctuation_falls_back_to_word_pair(self):
        rid = self.reg.create_run(agent_id="codex", backend="codex-cli", model="test",
                                  cwd=str(self.root), artifacts_dir=str(self.root / "artifacts"),
                                  run_name="!!!")
        self.assertRegex(rid, r"^run_codex-[a-z]+-[a-z]+-[0-9a-f]{4}$")

    def test_delegate_name_flag_reaches_run_id(self):
        p = self.cli("-a", "codex", "--detach", "--name", "E2E Named Run", "NAMED_TASK")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(p.stdout.strip(), "run_codex-e2e-named-run")
        self.cli("cancel", "run_codex-e2e-named-run")

    def test_name_rejected_with_one_shot(self):
        p = self.cli("-a", "codex", "--one-shot", "--name", "x", "TASK")
        self.assertNotEqual(p.returncode, 0)
        self.assertIn("--name", p.stderr)

    def test_argon_go_profile_defaults_to_high_in_steerable_payload(self):
        for config in (PORCH.parents[1] / "config.example.json", Path(self.env["PORCH_CONFIG"])):
            with self.subTest(config=config), patch.dict(os.environ, self.env):
                os.environ["PORCH_CONFIG"] = str(config)
                os.environ.pop("OPENCODE_MODEL", None)
                os.environ.pop("OPENCODE_EFFORT", None)
                agent, backend, model, binary = agent_settings("opencode-go-gemini-4-argon-contributor")
                self.assertEqual(backend, "opencode")
                self.assertEqual(model, "opencode-go/gemini-4-argon-contributor")
                self.assertEqual(agent["effort"], "high")
                self.assertFalse(agent["enabled"])
                adapter = OpenCodeAdapter(binary=binary, model=model, effort=agent["effort"],
                                          cwd=str(self.root), artifacts_dir=str(self.root))
                self.assertEqual(adapter._model_ref(), {"providerID": "opencode-go",
                    "id": "gemini-4-argon-contributor", "variant": "high"})
                os.environ["OPENCODE_EFFORT"] = "low"
                self.assertEqual(agent_settings("opencode-go-gemini-4-argon-contributor")[0]["effort"], "low")

    def test_native_argon_and_terra_profiles_reach_steerable_backends(self):
        configs = (PORCH.parents[1] / "config.example.json", Path(self.env["PORCH_CONFIG"]))
        profiles = (("devin-gemini-4-argon", "devin-cli", "gemini-4-argon-high", ""),
                    ("codex-gpt-6.1-terra", "codex-cli", "gpt-6.1-terra", "xhigh"))
        for index, config in enumerate(configs):
            for profile, backend, model, effort in profiles:
                with self.subTest(config=config, profile=profile):
                    argv_log = self.root / f"{index}-{profile}-argv.jsonl"
                    rpc_log = self.root / f"{index}-{profile}-rpc.jsonl"
                    env = dict(self.env, PORCH_CONFIG=str(config),
                               PORCH_FAKE_ARGV_LOG=str(argv_log), PORCH_FAKE_RPC_LOG=str(rpc_log))
                    for key in ("CODEX_MODEL", "CODEX_EFFORT", "DEVIN_MODEL"):
                        env.pop(key, None)
                    p = self.cli("-a", profile, "PROFILE_TASK", env=env)
                    self.assertEqual(p.returncode, 0, p.stderr)
                    meta = self.reg.load_meta(extract_run_id(p.stderr))
                    self.assertEqual((meta["backend"], meta["model"], meta["effort"]),
                                     (backend, model, effort))
                    self.assertIn("FAKE_", p.stdout)
                    if backend == "devin-cli":
                        launch = json.loads(argv_log.read_text().splitlines()[0])
                        self.assertEqual(launch["argv"], ["acp", "--model", model])
                    else:
                        calls = [json.loads(line) for line in rpc_log.read_text().splitlines()]
                        thread = next(c["params"] for c in calls if c["method"] == "thread/start")
                        turn = next(c["params"] for c in calls if c["method"] == "turn/start")
                        self.assertEqual(thread["model"], model)
                        self.assertEqual((turn["model"], turn["effort"]), (model, effort))

    def test_abort_failure_never_sends_replacement(self):
        a = OpenCodeAdapter(binary="fake", model="test", cwd=str(self.root), artifacts_dir=str(self.root))
        a.session_id = "test"
        with patch.object(a, "_http_json", side_effect=TimeoutError("unresolved")), patch.object(a, "_send_prompt") as send:
            result = a.steer("replacement", "interrupt", "id")
        self.assertFalse(result.ok)
        self.assertEqual(result.status, "failed")
        self.assertIn("outcome unknown", result.error)
        send.assert_not_called()
        self.assertTrue(a.is_done())
        self.assertNotEqual(a.exit_code(), 0)

    def test_opencode_permission_wakes_parent_with_cause_and_command(self):
        p = self.cli("-a", "opencode", "--detach", "PERMISSION_TEST",
                     env=dict(self.env, PORCH_FAKE_OC_PERMISSION="1", PORCH_FAKE_OC_PERMISSION_DELAY="2"))
        self.assertEqual(p.returncode, 0, p.stderr)
        rid = p.stdout.strip()
        try:
            observed = self.cli("wait-any", rid, "--timeout", "0.4")
            self.assertEqual(observed.returncode, 124, observed.stderr)
            active = json.loads(observed.stdout)["runs"][0]["active_tools"]
            self.assertIn("mkdir /tmp/example", active["call-permission"]["input_preview"])
            status = json.loads(self.cli("status", rid, "--json").stdout)
            self.assertEqual(status["state"]["active_tools"], active)
            result = self.cli("wait-any", rid, "--timeout", "5")
            self.assertEqual(result.returncode, 0, result.stderr)
            data = json.loads(result.stdout)
            self.assertEqual(data["ready"], [rid])
            run = data["runs"][0]
            self.assertEqual(run["status"], "failed")
            self.assertEqual(run["active_tools"], {})
            self.assertIn("permission_required", run["error"])
            self.assertIn("external_directory", run["error"])
            self.assertIn("mkdir /tmp/example", run["error"])
            result = self.cli("wait", rid, "--json")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("permission_required", json.loads(result.stdout)["error"])
            events = json.loads(self.cli("events", rid, "--cursor", "0", "--max-events", "100").stdout)
            tools = [e for e in events["events"] if e["type"] == "tool_started"]
            self.assertTrue(tools)
            self.assertIn("mkdir /tmp/example", tools[0]["data"])
        finally:
            if self.reg.load_meta(rid)["status"] not in ("completed", "failed", "cancelled"):
                self.cli("cancel", rid)

    def test_opencode_ignores_foreign_nested_tool_and_permission(self):
        a = OpenCodeAdapter(binary="fake", model="test", cwd=str(self.root), artifacts_dir=str(self.root))
        a.session_id = "ours"
        a._handle_event({"type": "session.tool.called", "data": {
            "sessionID": "other", "id": "tool", "input": {"command": "foreign"}}})
        a._handle_event({"type": "permission.asked", "data": {"sessionID": "other"}})
        self.assertEqual(list(a.poll_events()), [])
        self.assertFalse(a.is_done())

    def test_opencode_child_permission_is_not_silently_ignored(self):
        a = OpenCodeAdapter(binary="fake", model="test/model", cwd=str(self.root), artifacts_dir=str(self.root))
        a.session_id = "ours"
        a._child_sessions.add("ours")
        a._handle_event({"type": "session.created", "data": {"sessionID": "child", "parentID": "ours"}})
        a._handle_event({"type": "permission.asked", "data": {"sessionID": "child", "action": "shell", "resources": ["*"]}})
        self.assertTrue(a.is_done())
        self.assertIn("permission_required", a._error)

    def test_opencode_ids_match_upstream_time_ordered_shape(self):
        a = OpenCodeAdapter(binary="fake", model="test/model", cwd=str(self.root), artifacts_dir=str(self.root))
        with patch("steer.adapters.opencode.time.time", return_value=1794063170.0):
            first, second = a._message_id(), a._message_id()
        self.assertEqual(len(first), 30)
        self.assertLess(first, second)
        self.assertEqual(first[4:16], f"{(1794063170000 * 4096 + 1) & ((1 << 48) - 1):012x}")

    def test_opencode_startup_lock_tracks_database_identity(self):
        binary = str(Path(__file__).resolve().parents[1] / "fakes/steer/fake-opencode-steer")
        with patch.dict(os.environ, {"XDG_DATA_HOME": str(self.root / "data"),
                                     "OPENCODE_DB": "custom.db"}, clear=True):
            relative = _startup_lock_path(binary, str(self.root), dict(os.environ))
        with patch.dict(os.environ, {"XDG_DATA_HOME": str(self.root / "other"),
                                     "OPENCODE_DB": str(self.root / "data/opencode/custom.db")}, clear=True):
            absolute = _startup_lock_path(binary, str(self.root), dict(os.environ))
        with patch.dict(os.environ, {"XDG_DATA_HOME": str(self.root / "data"),
                                     "OPENCODE_DB": "other.db"}, clear=True):
            other = _startup_lock_path(binary, str(self.root), dict(os.environ))
        with patch.dict(os.environ, {"XDG_DATA_HOME": str(self.root / "data"),
                                     "PORCH_FAKE_OPENCODE_CHANNEL_DB": "channel.db"}, clear=True):
            channel = _startup_lock_path(binary, str(self.root), dict(os.environ))
        with patch.dict(os.environ, {"OPENCODE_DB": ":memory:"}, clear=True):
            memory = _startup_lock_path(binary, str(self.root), dict(os.environ))
        with patch.dict(os.environ, {"OPENCODE_DB": str(self.root)}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "database path is a directory"):
                _startup_lock_path(binary, str(self.root), dict(os.environ))
        self.assertEqual(relative, absolute)
        self.assertEqual(relative, other)
        self.assertEqual(relative, channel)
        self.assertIsNone(memory)

    def test_opencode_failed_start_stops_server_before_unlock(self):
        binary = str(Path(__file__).resolve().parents[1] / "fakes/steer/fake-opencode-steer")
        adapter = OpenCodeAdapter(binary=binary, model="test/model", cwd=str(self.root), artifacts_dir=str(self.root))
        unlocked = []
        @contextlib.contextmanager
        def checked_lock(_path, *, blocking=True):
            try:
                yield
            finally:
                unlocked.append(adapter.proc is not None and adapter.proc.poll() is not None)
        with patch.dict(os.environ, {"XDG_DATA_HOME": str(self.root / "data")}, clear=True), \
             patch("steer.adapters.opencode.flock_exclusive", checked_lock), \
             patch.object(adapter, "_http_json", side_effect=RuntimeError("readiness failed")):
            with self.assertRaisesRegex(RuntimeError, "readiness failed"):
                adapter._start_server()
        self.assertEqual(unlocked, [True])

    @unittest.skipIf(os.name == "nt", "POSIX lock-owner termination")
    def test_opencode_startup_lock_timeout_and_owner_death(self):
        lock = self.root / "startup.lock"
        script = ("import fcntl,sys,time; "
                  "f=open(sys.argv[1], 'a+'); fcntl.flock(f, fcntl.LOCK_EX); "
                  "print('locked', flush=True); time.sleep(60)")
        owner = subprocess.Popen([sys.executable, "-c", script, str(lock)],
                                 stdout=subprocess.PIPE, text=True)
        try:
            self.assertEqual(owner.stdout.readline().strip(), "locked")
            with self.assertRaisesRegex(TimeoutError, "OpenCode database startup lock"):
                with _startup_lock(lock, timeout=.15):
                    self.fail("a held lock was acquired")
            owner.kill()
            owner.wait(timeout=5)
            with _startup_lock(lock, timeout=2):
                pass
        finally:
            if owner.poll() is None:
                owner.kill()
                owner.wait(timeout=5)
            owner.stdout.close()

    def test_opencode_failed_start_reports_cleanup_failure(self):
        binary = str(Path(__file__).resolve().parents[1] / "fakes/steer/fake-opencode-steer")
        adapter = OpenCodeAdapter(binary=binary, model="test/model", cwd=str(self.root), artifacts_dir=str(self.root))
        try:
            with patch.dict(os.environ, {"XDG_DATA_HOME": str(self.root / "data")}, clear=True), \
                 patch.object(adapter, "_http_json", side_effect=RuntimeError("readiness failed")), \
                 patch.object(adapter, "cancel", side_effect=RuntimeError("stop failed")):
                with self.assertRaisesRegex(RuntimeError, "readiness failed.*stop failed.*still be running"):
                    adapter._start_server()
        finally:
            adapter.cancel()

    def test_cleanup_completion_follows_adapter_and_session_lease(self):
        supervisor = Supervisor(agent_id="test", task="test", cwd=str(self.root),
                                artifacts_dir=str(self.root), registry=self.reg)
        actions = []
        supervisor.adapter = Mock()
        supervisor.adapter.child_pid.return_value = None
        supervisor.adapter.close.side_effect = lambda: actions.append("adapter")
        supervisor._session_lease = Mock()
        supervisor._session_lease.close.side_effect = lambda: actions.append("lease")
        supervisor._update_registry_meta = lambda **fields: actions.append(fields["cleanup_status"])
        with patch("debug_tape.close_global_tape", side_effect=lambda: actions.append("tape")):
            supervisor._finish_cleanup()
        self.assertEqual(actions, ["adapter", "lease", "tape", "completed"])

    def test_opencode_long_sse_line_preserves_tool_completion(self):
        a = OpenCodeAdapter(binary="fake", model="test", cwd=str(self.root), artifacts_dir=str(self.root))
        a.session_id = "ours"
        a.base_url = "http://127.0.0.1:1234"
        base = {"sessionID": "ours", "id": "call-1", "assistantMessageID": "msg_1"}
        frames = [{"type": "session.tool.input.started", "data": {**base, "name": "shell"}},
                  {"type": "session.tool.called", "data": {**base, "input": {"command": "dotnet test"}}},
                  {"type": "session.tool.success", "data": {**base, "content": "Ж" * 70000}}]
        raw = ''.join('data: '+json.dumps(f, ensure_ascii=False)+'\n\n' for f in frames).encode()
        with patch.object(a._opener, "open", return_value=io.BytesIO(raw)):
            a._sse_loop()
        events = list(a.poll_events())
        self.assertEqual([e.kind for e in events if e.kind.startswith("tool")], ["tool_started", "tool_completed"])
        self.assertTrue(all('dotnet test' in e.data for e in events if e.kind.startswith("tool")))
        self.assertFalse(any(e.kind == "raw" for e in events))
        self.assertNotEqual(a.exit_code(), 0)  # EOF without terminal confirmation fails closed.

    def test_codex_progress_does_not_repeat_streamed_completion(self):
        a = CodexAdapter(binary="fake", model="test", cwd=str(self.root), artifacts_dir=str(self.root))
        def delta(item_id, text):
            a._on_notification({"method": "item/agentMessage/delta", "params": {"itemId": item_id, "delta": text}})
        def complete(item_id, text):
            a._on_notification({"method": "item/completed", "params": {"item": {"id": item_id, "type": "agentMessage", "text": text}}})
        delta("a", "Hello")
        complete("a", "Hello")
        complete("a", "Hello")  # Duplicate completion notification.
        delta("b", "Hello")  # Same words in a distinct message are legitimate.
        complete("b", "Hello world")  # Missing suffix must remain visible.
        complete("c", "No deltas")
        delta("d", "Draft")
        complete("d", "Correction")  # Do not discard a non-prefix correction.
        texts = [ev.data for ev in a.poll_events() if ev.kind == "text"]
        self.assertEqual(texts, ["Hello", "Hello", " world", "No deltas", "Draft", "Correction"])
        a._reset_turn_text_buffers()
        complete("a", "Hello")
        self.assertEqual([ev.data for ev in a.poll_events() if ev.kind == "text"], ["Hello"])

    def test_claude_native_session_id_comes_from_stream(self):
        a = ClaudeAdapter(binary="fake", model="test", cwd=str(self.root), artifacts_dir=str(self.root))
        a._handle_obj({"type": "system", "subtype": "init", "session_id": "claude-native-1"})
        self.assertEqual(a.session_id, "claude-native-1")
        a._handle_obj({"type": "result", "session_id": "claude-native-2", "result": "done"})
        self.assertEqual(a.session_id, "claude-native-1")

    def test_abort_idle_then_failure_does_not_leave_wait_hanging(self):
        a = OpenCodeAdapter(binary="fake", model="test", cwd=str(self.root), artifacts_dir=str(self.root))
        a.session_id = "test"
        def abort():
            a._busy = False  # idle arrived while replacement was pending
            raise RuntimeError("abort failed after idle")
        with patch.object(a, "_abort", side_effect=abort), patch.object(a, "_send_prompt") as send:
            result = a.steer("replacement", "interrupt", "id")
        self.assertFalse(result.ok)
        self.assertTrue(a.is_done())
        send.assert_not_called()

    def test_abort_rejection_never_sends_replacement(self):
        a = OpenCodeAdapter(binary="fake", model="test", cwd=str(self.root), artifacts_dir=str(self.root))
        a.session_id = "test"
        with patch.object(a, "_http_json", return_value=False), patch.object(a, "_send_prompt") as send:
            result = a.steer("replacement", "interrupt", "id")
        self.assertFalse(result.ok)
        self.assertIn("invalid interrupt response", result.error)
        send.assert_not_called()

    def test_unresolved_stop_never_sends_replacement(self):
        a = OpenCodeAdapter(binary="fake", model="test", cwd=str(self.root), artifacts_dir=str(self.root))
        a.session_id = "test"
        with patch.object(a, "_abort"), patch.object(a, "_runner_is_idle", return_value=False), patch.object(a, "_send_prompt") as send:
            wait = a._wait_for_abort_idle
            with patch.object(a, "_wait_for_abort_idle", side_effect=lambda: wait(timeout=.02)):
                result = a.steer("replacement", "interrupt", "id")
        self.assertFalse(result.ok)
        self.assertIn("outcome unknown", result.error)
        send.assert_not_called()

    def test_status_idle_without_abort_event_allows_replacement(self):
        a = OpenCodeAdapter(binary="fake", model="test", cwd=str(self.root), artifacts_dir=str(self.root))
        a.session_id = "test"
        calls = []
        with patch.object(a, "_abort", side_effect=lambda: calls.append("abort")), patch.object(a, "_runner_is_idle", side_effect=lambda **kw: calls.append("status") or True), patch.object(a, "_send_prompt", side_effect=lambda *args, **kw: calls.append("prompt")):
            result = a.steer("replacement", "interrupt", "id")
        self.assertTrue(result.ok)
        self.assertEqual(calls, ["abort", "status", "prompt"])

    def test_late_interrupt_does_not_fail_replacement(self):
        a = OpenCodeAdapter(binary="fake", model="test", cwd=str(self.root), artifacts_dir=str(self.root))
        a.session_id = "test"
        a._busy = True
        a._ignore_interrupt_once = True
        a._handle_event({"type": "session.execution.interrupted", "data": {"sessionID": "test", "reason": "user"}})
        self.assertFalse(a.is_done())
        self.assertTrue(a.is_busy())
        a._handle_event({"type": "session.execution.interrupted", "data": {"sessionID": "test", "reason": "user"}})
        self.assertTrue(a.is_done())
        self.assertNotEqual(a.exit_code(), 0)

    def test_malformed_runner_status_is_not_idle(self):
        a = OpenCodeAdapter(binary="fake", model="test", cwd=str(self.root), artifacts_dir=str(self.root))
        a.session_id = "test"
        for data in (None, False, {"test": {"type": "unexpected"}}, {"raw": "not json"}):
            with patch.object(a, "_http_json", return_value=data), self.assertRaises(RuntimeError):
                a._runner_is_idle()

    def test_wait_timeout_leaves_worker_untouched(self):
        rid = self.run_record()
        before = self.reg.load_meta(rid)
        started = time.monotonic()
        snaps, timeout = wait_for_any(self.reg, [rid], timeout=.03, poll_interval=10)
        self.assertTrue(timeout)
        self.assertLess(time.monotonic() - started, .5)
        self.assertFalse(snaps[rid].terminal)
        self.assertEqual(self.reg.load_meta(rid), before)

    def test_zero_snapshot_and_ready_wins_over_deadline(self):
        active, complete = self.run_record(), self.run_record("completed")
        snaps, timeout = wait_for_any(self.reg, [active, complete], timeout=0)
        self.assertFalse(timeout)
        self.assertTrue(snaps[complete].terminal)
        self.assertFalse(snaps[active].terminal)

    def test_wait_any_later_worker_completes(self):
        slow, fast = self.run_record(), self.run_record()
        timer = threading.Timer(.03, lambda: self.reg.update_meta(fast, status="completed", exit_code=0))
        timer.start()
        self.addCleanup(timer.join)
        snaps, timed_out = wait_for_any(self.reg, [slow, fast], timeout=2, poll_interval=.01)
        self.assertFalse(timed_out)
        self.assertTrue(snaps[fast].terminal)
        self.assertFalse(snaps[slow].terminal)

    def test_failure_wakes_wait_any(self):
        slow, failed = self.run_record(), self.run_record("failed")
        p = self.cli("wait-any", slow, failed, "--timeout", "0")
        self.assertEqual(p.returncode, 0, p.stderr)
        data = json.loads(p.stdout)
        self.assertEqual(data["ready"], [failed])
        self.assertEqual(data["runs"][1]["exit_code"], 1)

    def test_unknown_target_is_not_hidden_by_ready_target(self):
        rid = self.run_record("completed")
        with self.assertRaises(RegistryError):
            wait_for_any(self.reg, [rid, "missing"], timeout=0)

    def test_dead_first_worker_cannot_delay_later_result(self):
        dead, ready = self.run_record(pid=99999999), self.run_record("completed")
        start = time.monotonic()
        snapshots, _ = wait_for_any(self.reg, [dead, ready])
        self.assertLess(time.monotonic() - start, .3)
        self.assertTrue(snapshots[ready].terminal)

    def test_dead_worker_is_reaped_after_grace(self):
        rid = self.run_record(pid=99999999)
        with patch("steer.waiter.DEAD_PID_GRACE_SECONDS", .01):
            snap = wait_for_terminal(self.reg, rid, timeout=1, poll_interval=.01)
        self.assertTrue(snap.terminal)
        self.assertEqual(snap.meta["error"], "supervisor_dead")

    def test_busy_dead_run_lock_does_not_hide_another_completion(self):
        dead, healthy = self.run_record(pid=99999999), self.run_record(pid=os.getpid())
        locked, release = threading.Event(), threading.Event()
        def holder():
            with self.reg.with_run_lock(dead):
                locked.set()
                release.wait(3)
        thread = threading.Thread(target=holder)
        thread.start()
        self.assertTrue(locked.wait(2))
        timer = threading.Timer(.9, lambda: self.reg.update_meta(healthy, status="completed", exit_code=0))
        timer.start()
        try:
            start = time.monotonic()
            p = self.cli("wait-any", dead, healthy, "--timeout", "1.3")
            self.assertLess(time.monotonic() - start, 2)
            self.assertEqual(p.returncode, 0, p.stderr)
            self.assertEqual(json.loads(p.stdout)["ready"], [healthy])
            self.assertEqual(self.reg.load_meta(dead)["status"], "running")
        finally:
            release.set()
            thread.join(4)
            timer.join()

    def test_busy_dead_run_lock_does_not_overrun_deadline(self):
        dead = self.run_record(pid=99999999)
        locked, release = threading.Event(), threading.Event()
        def holder():
            with self.reg.with_run_lock(dead):
                locked.set()
                release.wait(3)
        thread = threading.Thread(target=holder)
        thread.start()
        self.assertTrue(locked.wait(2))
        try:
            start = time.monotonic()
            p = self.cli("wait-any", dead, "--timeout", "1")
            self.assertLess(time.monotonic() - start, 2)
            self.assertEqual(p.returncode, 124, p.stderr)
            self.assertEqual(json.loads(p.stdout)["ready"], [])
        finally:
            release.set()
            thread.join(4)
        # Lock release permits the next observation to diagnose the dead run.
        p = self.cli("wait-any", dead, "--timeout", "2")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(json.loads(p.stdout)["runs"][0]["error"], "supervisor_dead")

    def test_simultaneous_terminal_results_are_all_reported(self):
        done, failed, cancelled = (self.run_record(s) for s in ("completed", "failed", "cancelled"))
        p = self.cli("wait-any", done, failed, cancelled, done, "--timeout", "0")
        self.assertEqual(p.returncode, 0, p.stderr)
        data = json.loads(p.stdout)
        self.assertEqual(data["ready"], [done, failed, cancelled])
        self.assertEqual([r["exit_code"] for r in data["runs"]], [0, 1, 130])

    def test_missing_final_still_returns_structured_terminal_result(self):
        for status, error, expected in (("failed", "supervisor_dead", 70), ("completed", None, 74)):
            rid = self.run_record(status, error=error)
            p = self.cli("wait", rid, "--json")
            self.assertEqual(p.returncode, expected, p.stderr)
            data = json.loads(p.stdout)
            self.assertEqual(data["run_id"], rid)
            self.assertEqual(data["status"], status)
            self.assertEqual(data["exit_code"], expected)
            self.assertEqual(data["error"], error)
            self.assertFalse(data["final_available"])
            self.assertIsNone(data["final_text"])
            self.assertIsNone(data["final_path"])

    def test_backend_startup_failure_does_not_discard_healthy_peer(self):
        pending = []
        try:
            for binary, delay in (("/bin/false", "0.02"), (self.env["PORCH_BIN_CODEX"], "1")):
                p = self.cli("-a", "codex", "--detach", "STARTUP_TEST", env=dict(
                    self.env, PORCH_BIN_CODEX=binary, PORCH_FAKE_STEER_SLOW=delay))
                self.assertEqual(p.returncode, 0, p.stderr)
                pending.append(p.stdout.strip())
            failed, healthy = pending
            p = self.cli("wait-any", *pending, "--timeout", "5")
            self.assertEqual(p.returncode, 0, p.stderr)
            data = json.loads(p.stdout)
            self.assertIn(failed, data["ready"])
            self.assertEqual(data["runs"][0]["status"], "failed")
            self.assertNotEqual(self.cli("wait", failed, "--json").returncode, 0)
            p = self.cli("wait-any", *pending, "--acknowledged", failed, "--timeout", "10")
            self.assertEqual(p.returncode, 0, p.stderr)
            self.assertEqual(json.loads(p.stdout)["ready"], [healthy])
            self.assertEqual(self.cli("wait", healthy, "--json").returncode, 0)
            pending.clear()
        finally:
            for rid in pending:
                if self.reg.load_meta(rid)["status"] not in ("completed", "failed", "cancelled"):
                    self.cli("cancel", rid)

    def test_codex_status_reports_active_turn_and_clears_it_on_completion(self):
        p = self.cli("-a", "codex", "--detach", "STATUS_TEST",
                     env=dict(self.env, PORCH_FAKE_STEER_SLOW="1"))
        self.assertEqual(p.returncode, 0, p.stderr)
        rid = p.stdout.strip()
        try:
            deadline = time.monotonic() + 1.5
            active = None
            while time.monotonic() < deadline:
                state = json.loads(self.cli("status", rid, "--json").stdout)["state"]
                active = state.get("active_turn")
                if active:
                    break
                time.sleep(.05)
            self.assertTrue(active)
            self.assertEqual(self.cli("wait", rid, "--timeout", "5", "--json").returncode, 0)
            state = json.loads(self.cli("status", rid, "--json").stdout)["state"]
            self.assertIsNone(state["active_turn"])
        finally:
            if self.reg.load_meta(rid)["status"] not in ("completed", "failed", "cancelled"):
                self.cli("cancel", rid)

    def test_wait_timeout_json_has_bounded_progress_and_cursor(self):
        rid = self.run_record()
        log = self.root / "artifacts" / "normalized" / "codex.jsonl"
        log.parent.mkdir(parents=True)
        log.write_text(''.join(json.dumps({"type": "tool_call", "name": f"tool-{n}"})+'\n' for n in range(12)))
        p = self.cli("wait", rid, "--timeout", "0", "--json")
        self.assertEqual(p.returncode, 124, p.stderr)
        data = json.loads(p.stdout)
        self.assertTrue(data["timed_out"])
        self.assertFalse(data["terminal"])
        self.assertLessEqual(len(data["events"]), 5)
        self.assertEqual(data["next_cursor"], 12)
        self.assertEqual(self.reg.load_meta(rid)["status"], "running")

    def test_progress_failure_does_not_hide_readiness_or_timeout(self):
        rid = self.run_record()
        self.reg.update_meta(rid, artifacts_dir="invalid\0path")
        result = self.cli("wait", rid, "--timeout", "0", "--json")
        self.assertEqual(result.returncode, 124, result.stderr)
        self.assertIn("events_error", json.loads(result.stdout))
        self.reg.update_meta(rid, status="completed", exit_code=0)
        result = self.cli("wait-any", rid, "--timeout", "0")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["ready"], [rid])
        self.assertIn("events_error", json.loads(result.stdout)["runs"][0])

    def test_wait_any_timeout_and_remove_consumed_result(self):
        ready, active = self.run_record("completed"), self.run_record()
        first = self.cli("wait-any", ready, active, "--timeout", "0")
        self.assertEqual(json.loads(first.stdout)["ready"], [ready])
        next_page = self.cli("wait-any", active, "--timeout", "0")
        self.assertEqual(next_page.returncode, 124)
        self.assertEqual(json.loads(next_page.stdout)["ready"], [])

    def test_invalid_timeouts(self):
        for value in ("nan", "inf", "-1"):
            p = self.cli("wait-any", "missing", "--timeout", value)
            self.assertEqual(p.returncode, 2, p.stderr)

    def test_group_retains_acknowledged_runs_without_repeated_wakeup(self):
        done = self.run_record("completed", started_at="2026-01-01T00:00:00Z",
                               finished_at="2026-01-01T00:01:30Z")
        active = self.run_record(pid=os.getpid())
        self.run_record("completed")  # Unrelated registry entry must be excluded.
        p = self.cli("wait-any", done, active, "--acknowledged", done, "--timeout", "0.01")
        self.assertEqual(p.returncode, 124, p.stderr)
        data = json.loads(p.stdout)
        self.assertEqual(data["ready"], [])
        self.assertEqual([r["run_id"] for r in data["runs"]], [done, active])
        self.assertEqual(data["runs"][0]["elapsed_seconds"], 90)
        self.assertGreaterEqual(data["runs"][1]["elapsed_seconds"], 0)
        self.assertEqual(data["runs"][1]["model"], "test")
        self.reg.update_meta(active, status="failed", exit_code=7,
                             finished_at="2026-09-13T12:00:00Z")
        p = self.cli("wait-any", done, active, "--acknowledged", done, "--timeout", "900")
        self.assertEqual(p.returncode, 0, p.stderr)
        data = json.loads(p.stdout)
        self.assertEqual(data["ready"], [active])
        self.assertEqual(len(data["runs"]), 2)
        self.assertEqual(data["runs"][1]["exit_code"], 7)

    def test_invalid_acknowledgement_fails_explicitly(self):
        active, done = self.run_record(), self.run_record("completed")
        for group, acknowledged in (([active], active), ([done], "missing"), ([done], done)):
            p = self.cli("wait-any", *group, "--acknowledged", acknowledged, "--timeout", "0")
            self.assertEqual(p.returncode, 5, p.stderr)

    def test_duration_uses_timezone_and_preserves_unknown_terminal_time(self):
        meta = {"started_at": "2026-01-01T01:00:00+01:00",
                "finished_at": "2026-01-01T00:00:30Z", "status": "completed"}
        self.assertEqual(_duration_seconds(meta, include_running=True), 30)
        for invalid in (None, "bad", 123):
            self.assertIsNone(_duration_seconds(dict(meta, started_at=invalid), include_running=True))
        self.assertIsNone(_duration_seconds(dict(meta, finished_at=None), include_running=True))

    def test_backend_does_not_inherit_parent_artifact_destination(self):
        log = self.root / "backend-env.json"
        p = self.cli("-a", "codex", "ENV_CHECK", env=dict(self.env,
                     PORCH_SAVE_OUTPUTS="1", PORCH_ARTIFACT_KEY="parent",
                     PORCH_FAKE_ARTIFACT_ENV_LOG=str(log)))
        self.assertEqual(p.returncode, 0, p.stderr)
        observed = json.loads(log.read_text())
        self.assertIsNone(observed["PORCH_RUN_DIR"])
        self.assertIsNone(observed["PORCH_ARTIFACT_KEY"])
        self.assertEqual(observed["PORCH_OUTPUT_DIR"], self.env["PORCH_OUTPUT_DIR"])
        self.assertEqual(observed["PORCH_STEER_DIR"], self.env["PORCH_STEER_DIR"])
        self.assertEqual(observed["PORCH_LAUNCHER"], "codex")
        rid = extract_run_id(p.stderr)
        self.assertEqual(observed["PORCH_LAUNCHER_RUN_ID"], rid)
        self.assertEqual(self.reg.load_meta(rid)["artifacts_dir"], self.env["PORCH_RUN_DIR"])

    def test_launcher_is_caller_not_executor(self):
        env = dict(self.env, PORCH_LAUNCHER="claude", CLAUDE_CODE_SESSION_ID="caller-session")
        p = self.cli("-a", "codex", "CALLER_CHECK", env=env)
        self.assertEqual(p.returncode, 0, p.stderr)
        meta = self.reg.load_meta(extract_run_id(p.stderr))
        self.assertEqual((meta["launcher"], meta["launcher_source"], meta["agent_id"]),
                         ("claude", "explicit", "codex"))
        self.assertTrue(meta["created_at_ns"].isdigit())
        self.assertEqual(meta["launcher_instance"], launcher_metadata(env)["launcher_instance"])
        self.assertEqual(meta["turn_count"], 1)
        self.assertTrue(meta["native_session_id"])
        self.assertNotIn("caller-session", str(meta))

    def test_launcher_inference_rejects_ambiguity(self):
        self.assertEqual(launcher_metadata({"CODEX_THREAD_ID": "t"})["launcher"], "codex")
        self.assertEqual(launcher_metadata({"CLAUDECODE": "1"}),
                         {"launcher": "claude", "launcher_source": "environment"})
        self.assertEqual(launcher_metadata({"PORCH_LAUNCHER": "codex", "PORCH_LAUNCHER_RUN_ID": "run_parent"})["launcher_instance"], "run:run_parent")
        self.assertEqual(launcher_metadata({"CODEX_THREAD_ID": "t", "CLAUDECODE": "1"}),
                         {"launcher": "unknown", "launcher_source": "ambiguous"})
        self.assertEqual(launcher_metadata({}),
                         {"launcher": "unknown", "launcher_source": "unavailable"})
        with self.assertRaises(ValueError):
            launcher_metadata({"PORCH_LAUNCHER": "other"})

    def test_detached_wait_loop_timeout_then_collects_every_result(self):
        pending = []
        try:
            for delay in (2, .5):
                started = self.cli("-a", "codex", "--detach", "WAIT_LOOP",
                                   env=dict(self.env, PORCH_FAKE_STEER_SLOW=str(delay)))
                self.assertEqual(started.returncode, 0, started.stderr)
                pending.append(started.stdout.strip())
            expected = set(pending)
            group = list(pending)
            # A short observation deadline must leave both detached runs alive.
            observed = self.cli("wait-any", *pending, "--timeout", "0.01")
            self.assertEqual(observed.returncode, 124, observed.stderr)
            self.assertEqual(json.loads(observed.stdout)["ready"], [])
            collected = set()
            while pending:
                acknowledged = [arg for rid in collected for arg in ("--acknowledged", rid)]
                observed = self.cli("wait-any", *group, *acknowledged, "--timeout", "900")
                self.assertEqual(observed.returncode, 0, observed.stderr)
                data = json.loads(observed.stdout)
                self.assertEqual({r["run_id"] for r in data["runs"]}, expected)
                self.assertTrue(all(r["elapsed_seconds"] is not None for r in data["runs"]))
                ready = data["ready"]
                self.assertTrue(ready)
                for rid in ready:
                    result = self.cli("wait", rid, "--timeout", "5", "--json")
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertIn("FAKE_CODEX", result.stdout)
                    collected.add(rid)
                    pending.remove(rid)
            self.assertEqual(collected, expected)
        finally:
            for rid in pending:
                self.cli("cancel", rid)

    def test_completion_between_observations_is_not_lost(self):
        rid = self.run_record(pid=os.getpid())
        first = self.cli("wait-any", rid, "--timeout", "0")
        self.assertEqual(first.returncode, 124, first.stderr)
        self.reg.update_meta(rid, status="completed", exit_code=0)
        resumed = self.cli("wait-any", rid, "--timeout", "900")
        self.assertEqual(resumed.returncode, 0, resumed.stderr)
        self.assertEqual(json.loads(resumed.stdout)["ready"], [rid])

    def test_observer_interrupt_does_not_cancel_worker(self):
        rid = self.run_record()
        p = subprocess.Popen([str(PORCH), "delegate", "wait-any", rid], cwd=self.root,
                             env=self.env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            time.sleep(.4)
            p.send_signal(signal.SIGINT)
            out, err = p.communicate(timeout=5)
            self.assertEqual(p.returncode, 130, err)
            self.assertEqual(self.reg.load_meta(rid)["status"], "running")
        finally:
            if p.poll() is None:
                p.kill()
                p.wait()

    def test_continue_reuses_thread_and_only_sends_new_instruction(self):
        rid = self.start_durable()
        old_meta = self.reg.load_meta(rid)
        p = self.cli("-a", "codex", "--continue-run", rid, "FOLLOWUP_ONLY")
        self.assertEqual(p.returncode, 0, p.stderr)
        successor = extract_run_id(p.stderr)
        new_meta = self.reg.load_meta(successor)
        self.assertEqual(new_meta["continued_from"], rid)
        self.assertEqual(old_meta, self.reg.load_meta(rid))
        self.assertEqual(new_meta["session_handle"], old_meta["session_handle"])
        calls = self.rpc_calls()
        self.assertEqual(len([c for c in calls if c["method"] == "thread/start"]), 1)
        resumes = [c for c in calls if c["method"] == "thread/resume"]
        self.assertEqual(len(resumes), 1)
        self.assertEqual(resumes[0]["params"]["threadId"], old_meta["session_handle"]["thread_id"])
        texts = [c["params"]["input"][0]["text"] for c in calls if c["method"] == "turn/start"]
        self.assertEqual(texts, ["INITIAL_ONLY", "FOLLOWUP_ONLY"])
        third = self.cli("-a", "codex", "--continue-run", successor, "THIRD")
        self.assertEqual(third.returncode, 0, third.stderr)

    def test_default_stays_ephemeral_and_cannot_continue(self):
        p = self.cli("-a", "codex", "ordinary")
        rid = extract_run_id(p.stderr)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertTrue(next(c for c in self.rpc_calls() if c["method"] == "thread/start")["params"]["ephemeral"])
        followup = self.cli("-a", "codex", "--continue-run", rid, "new")
        self.assertNotEqual(followup.returncode, 0)
        self.assertIn("no durable", followup.stderr)

    def test_resume_failure_never_falls_back_or_retries_old_source(self):
        rid = self.start_durable()
        broken = dict(self.env, PORCH_FAKE_CODEX_STEER_MODE="resume-error")
        p = self.cli("-a", "codex", "--continue-run", rid, "DO_NOT_SEND", env=broken)
        self.assertNotEqual(p.returncode, 0)
        successor = extract_run_id(p.stderr)
        self.assertEqual(self.reg.load_meta(successor)["status"], "failed")
        retry = self.cli("-a", "codex", "--continue-run", rid, "RETRY")
        self.assertNotEqual(retry.returncode, 0)
        self.assertIn("not the latest", retry.stderr)
        calls = self.rpc_calls()
        self.assertEqual(len([c for c in calls if c["method"] == "thread/start"]), 1)
        self.assertEqual(len([c for c in calls if c["method"] == "turn/start"]), 1)

    def test_failed_source_rejected(self):
        rid = self.start_durable()
        self.reg.update_meta(rid, status="failed", exit_code=1)
        p = self.cli("-a", "codex", "--continue-run", rid, "new")
        self.assertNotEqual(p.returncode, 0)
        self.assertIn("outcome may be unknown", p.stderr)

    def test_recover_unsuccessful_session_sends_only_new_instruction(self):
        for status, code in (("failed", 1), ("cancelled", 130), ("completed", 74)):
            with self.subTest(status=status):
                rid = self.start_durable()
                self.reg.update_meta(rid, status=status, exit_code=code)
                before = self.reg.load_meta(rid)
                calls_before = len(self.rpc_calls())
                p = self.cli("-a", "codex", "--continue-run", rid,
                             "--recover-session", "INSPECT_AND_FINISH_REMAINING")
                self.assertEqual(p.returncode, 0, p.stderr)
                successor = self.reg.load_meta(extract_run_id(p.stderr))
                self.assertTrue(successor["recover_session"])
                self.assertEqual(successor["continued_from"], rid)
                self.assertEqual(successor["session_handle"], before["session_handle"])
                self.assertEqual(self.reg.load_meta(rid), before)
                calls = self.rpc_calls()[calls_before:]
                self.assertEqual(len([c for c in calls if c["method"] == "thread/resume"]), 1)
                self.assertFalse(any(c["method"] == "thread/start" for c in calls))
                self.assertEqual([c["params"]["input"][0]["text"] for c in calls
                                  if c["method"] == "turn/start"], ["INSPECT_AND_FINISH_REMAINING"])

    def test_recover_cancelled_detached_run(self):
        started = self.cli("-a", "codex", "--persist-session", "--detach", "ORIGINAL",
                           env=dict(self.env, PORCH_FAKE_STEER_SLOW="10"))
        self.assertEqual(started.returncode, 0, started.stderr)
        rid = started.stdout.strip()
        try:
            deadline = time.monotonic() + 10
            while not self.reg.load_meta(rid).get("session_handle") and time.monotonic() < deadline:
                time.sleep(.02)
            self.assertTrue(self.reg.load_meta(rid).get("session_handle"))
            self.assertEqual(self.cli("cancel", rid).returncode, 0)
            deadline = time.monotonic() + 10
            while self.reg.load_meta(rid).get("cleanup_status") != "completed" and time.monotonic() < deadline:
                time.sleep(.02)
            previous = self.reg.load_meta(rid)
            self.assertEqual(previous["status"], "cancelled")
            p = self.cli("-a", "codex", "--continue-run", rid, "--recover-session", "--detach", "REMAINING")
            self.assertEqual(p.returncode, 0, p.stderr)
            next_id = p.stdout.strip()
            result = self.cli("wait", next_id, "--timeout", "10", "--json")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(self.reg.load_meta(next_id)["session_handle"], previous["session_handle"])
            # A terminal answer precedes detached supervisor cleanup. Keep the
            # temporary registry until that supervisor has finished writing it.
            deadline = time.monotonic() + 10
            while self.reg.load_meta(next_id).get("cleanup_status") == "pending" and time.monotonic() < deadline:
                time.sleep(.02)
            self.assertEqual(self.reg.load_meta(next_id).get("cleanup_status"), "completed")
        finally:
            if self.reg.load_meta(rid)["status"] not in ("completed", "failed", "cancelled"):
                self.cli("cancel", rid)

    def test_recovery_rejects_active_or_unclean_source_without_provider_call(self):
        rid = self.start_durable()
        for status, cleanup in (("running", "completed"), ("starting", "completed"),
                                ("failed", "pending"), ("cancelled", "failed"), ("failed", None)):
            with self.subTest(status=status, cleanup=cleanup):
                self.reg.update_meta(rid, status=status, exit_code=1, cleanup_status=cleanup)
                count = len(self.rpc_calls())
                p = self.cli("-a", "codex", "--continue-run", rid, "--recover-session", "new")
                self.assertNotEqual(p.returncode, 0)
                self.assertIn("terminal" if status in ("starting", "running") else "cleanup", p.stderr)
                self.assertEqual(len(self.rpc_calls()), count)

    def test_recover_session_requires_continue_run(self):
        p = self.cli("-a", "codex", "--recover-session", "task")
        self.assertNotEqual(p.returncode, 0)
        self.assertIn("--recover-session requires --continue-run", p.stderr)
        self.assertFalse(self.rpc_calls())

    def test_failed_native_resume_can_recover_latest_claim(self):
        rid = self.start_durable()
        broken = dict(self.env, PORCH_FAKE_CODEX_STEER_MODE="resume-error")
        p = self.cli("-a", "codex", "--continue-run", rid, "NOT_DELIVERED", env=broken)
        self.assertNotEqual(p.returncode, 0)
        failed_id = extract_run_id(p.stderr)
        failed = self.reg.load_meta(failed_id)
        self.assertEqual(failed["session_handle"], self.reg.load_meta(rid)["session_handle"])
        p = self.cli("-a", "codex", "--continue-run", failed_id, "--recover-session", "NEW_RECOVERY")
        self.assertEqual(p.returncode, 0, p.stderr)
        calls = self.rpc_calls()
        self.assertEqual(len([c for c in calls if c["method"] == "thread/start"]), 1)
        self.assertEqual([c["params"]["input"][0]["text"] for c in calls
                          if c["method"] == "turn/start"], ["INITIAL_ONLY", "NEW_RECOVERY"])

    def test_recovery_keeps_session_coordination_and_identity_checks(self):
        rid = self.start_durable()
        self.reg.update_meta(rid, status="failed", exit_code=1)
        before = self.reg.load_meta(rid)
        for field in ("agent_id", "backend", "model", "effort", "backend_binary", "cwd"):
            with self.subTest(field=field):
                self.reg.update_meta(rid, **{field: "changed"})
                count = len(self.rpc_calls())
                p = self.cli("-a", "codex", "--continue-run", rid, "--recover-session", "new")
                self.assertNotEqual(p.returncode, 0)
                self.assertEqual(len(self.rpc_calls()), count)
                self.reg.update_meta(rid, **{field: before[field]})
        (self.reg.run_path(rid) / "session.json").unlink()
        p = self.cli("-a", "codex", "--continue-run", rid, "--recover-session", "new")
        self.assertNotEqual(p.returncode, 0)
        self.assertIn("cannot safely continue after registry loss", p.stderr)

    def test_lost_session_coordination_fails_without_replaying(self):
        rid = self.start_durable()
        (self.reg.run_path(rid) / "session.json").unlink()
        count = len(self.rpc_calls())
        p = self.cli("-a", "codex", "--continue-run", rid, "new")
        self.assertNotEqual(p.returncode, 0)
        self.assertIn("cannot safely continue after registry loss", p.stderr)
        self.assertEqual(len(self.rpc_calls()), count)

    def test_changed_root_rejected_without_provider_call(self):
        rid = self.start_durable()
        elsewhere = self.root / "elsewhere"
        elsewhere.mkdir()
        count = len(self.rpc_calls())
        p = self.cli("-a", "codex", "--continue-run", rid, "new", cwd=elsewhere)
        self.assertNotEqual(p.returncode, 0)
        self.assertIn("original working directory", p.stderr)
        self.assertEqual(len(self.rpc_calls()), count)

    def test_changed_model_rejected(self):
        rid = self.start_durable()
        self.reg.update_meta(rid, model="different")
        p = self.cli("-a", "codex", "--continue-run", rid, "new")
        self.assertNotEqual(p.returncode, 0)
        self.assertIn("unchanged model", p.stderr)

    def test_concurrent_continuation_and_stale_source_rejected(self):
        source = self.start_durable()
        old = self.reg.load_meta(source)
        current = self.reg.create_run(agent_id=old["agent_id"], backend=old["backend"], model=old["model"],
                                     cwd=old["cwd"], artifacts_dir="", extra={"effort":old["effort"], "backend_binary":old["backend_binary"]})
        lease = SessionLease(self.reg, current, source)
        lease.acquire()
        try:
            other = SessionLease(self.reg, current, source)
            with self.assertRaisesRegex(RegistryError, "already in use"):
                other.acquire()
        finally:
            lease.close()
        with self.assertRaisesRegex(RegistryError, "not the latest"):
            SessionLease(self.reg, current, source).acquire()

    def test_unsupported_session_combinations_rejected(self):
        for args in (("-a", "claude-code", "--persist-session", "task"),
                     ("-a", "codex", "--one-shot", "--persist-session", "task")):
            p = self.cli(*args)
            self.assertNotEqual(p.returncode, 0)
            self.assertIn("require steerable Codex", p.stderr)
        self.assertFalse(self.rpc_calls())

    def test_detached_continue(self):
        source = self.start_durable()
        p = self.cli("-a", "codex", "--continue-run", source, "--detach", "followup")
        self.assertEqual(p.returncode, 0, p.stderr)
        rid = p.stdout.strip()
        result = self.cli("wait", rid, "--timeout", "10", "--json")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "completed")
        self.assertEqual(self.reg.load_meta(rid)["continued_from"], source)


if __name__ == "__main__":
    unittest.main()
