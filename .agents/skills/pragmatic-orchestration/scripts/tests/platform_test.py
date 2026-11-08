"""Offline platform regressions, runnable with native Python on Windows/POSIX."""
from __future__ import annotations

import importlib
import json
import os
import pkgutil
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

LIB = Path(__file__).resolve().parents[1] / "lib"
sys.path.insert(0, str(LIB))
import steer
from steer import util
from steer.registry import Registry, RegistryError
from steer.session import SessionLease
from steer.waiter import wait_for_any


class PlatformTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="porch platform ü ")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.env = dict(os.environ, PYTHONPATH=str(LIB), PYTHONIOENCODING="utf-8",
                        PYTHONDONTWRITEBYTECODE="1")

    def python(self, code, *args, **kwargs):
        return subprocess.run([sys.executable, "-c", code, *map(str, args)],
                              env=self.env, capture_output=True, text=True,
                              encoding="utf-8", timeout=15, **kwargs)

    def record(self, reg, status="running", **extra):
        rid = reg.create_run(agent_id="codex", backend="codex-cli", model="test",
                             cwd=str(self.root), artifacts_dir="", extra=extra)
        reg.update_meta(rid, status=status, exit_code=0 if status == "completed" else None)
        return rid

    def test_all_modules_import(self):
        for module in pkgutil.walk_packages(steer.__path__, steer.__name__ + "."):
            importlib.import_module(module.name)

    def test_backend_shell_assignments_are_lf_only_and_preserve_values(self):
        bash = shutil.which("bash")
        if bash is None:
            self.skipTest("backend shell assignments require Bash")
        # Exercise the runner's actual emitter with native Windows-style
        # stdout on every platform; text=True would hide the CRLF regression.
        source = (LIB / "backend_run.sh").read_text(encoding="utf-8")
        marker = 'RESOLVED_JSON="$RESOLVED_JSON" python3 - <<\'PY\'\n'
        self.assertEqual(source.count(marker), 1)
        emitter = source.split(marker, 1)[1].split("\nPY\n", 1)[0]
        resolved = {
            "backend": "codex-cli",
            "model": "model 'quoted' $HOME ü",
            "effort": "high",
            "label": "Windows test",
            "role": "analyst",
            "binary": r"C:\Users\Test User ü\npm\codex.CMD",
            "review_instructions": "Use 'quotes' and $HOME literally.\nSecond line.",
            "access_class": "readonly",
        }
        result = subprocess.run(
            [sys.executable, "-c",
             "import sys\nsys.stdout.reconfigure(newline='\\r\\n')\n" + emitter],
            env=dict(self.env, RESOLVED_JSON=json.dumps(resolved)),
            capture_output=True, timeout=15,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(b"\r", result.stdout)
        shell = subprocess.run(
            [bash, "--noprofile", "--norc", "-c",
             'set -eu; eval "$(cat)"; printf "%s\\0" '
             '"$BACKEND" "$MODEL" "$EFFORT" "$LABEL" "$ROLE_ID" '
             '"$BIN" "$REVIEW_INSTRUCTIONS" "$ACCESS_POLICY"'],
            input=result.stdout, env=self.env, capture_output=True, timeout=15,
        )
        self.assertEqual(shell.returncode, 0, shell.stderr)
        self.assertEqual(shell.stdout.decode("utf-8").split("\0"),
                         [*resolved.values(), ""])

    def test_backend_cmd_shim_uses_only_its_extensionless_sibling(self):
        bash = shutil.which("bash")
        if bash is None:
            self.skipTest("backend shim resolution requires Bash")
        source = (LIB / "backend_run.sh").read_text(encoding="utf-8")
        marker = "bin_usable() {\n"
        self.assertEqual(source.count(marker), 1)
        resolver = marker + source.split(marker, 1)[1].split(
            "\n# Codex model alias", 1)[0]
        launcher = self.root / "shimcodex"
        launcher.write_bytes(b"#!/bin/sh\nprintf '%s\\n' 'CMD_SHIM_OK'\n")
        launcher.chmod(0o755)
        shim = launcher.with_suffix(".CMD")
        shim.write_bytes(b"@echo off\r\n")
        shim.chmod(0o644)
        missing = self.root / "missing" / shim.name
        missing.parent.mkdir()
        missing.write_bytes(b"@echo off\r\n")
        missing.chmod(0o644)
        script = 'set -eu\nEXIT_CONFIG_ERROR=4\nBACKEND=codex-cli\n' + resolver + '\n"$BIN"\n'
        # A same-named working launcher on PATH must not replace an explicitly
        # selected installation whose extensionless sibling is missing.
        env = dict(self.env, PATH=str(self.root) + os.pathsep + self.env["PATH"])
        for name, binary, expected_rc in (
            ("cmd sibling", shim, 0),
            ("missing sibling", missing, 4),
            ("non-cmd extension", launcher.with_suffix(".exe"), 4),
        ):
            with self.subTest(name=name):
                if os.name == "nt" and binary.suffix == ".CMD":
                    # Keep native Python's drive/backslash spelling so the
                    # production resolver exercises cygpath under Git Bash.
                    binary_path = shutil.which(str(binary))
                    self.assertIsNotNone(binary_path)
                else:
                    binary_path = str(binary).replace("/", "\\")
                result = subprocess.run(
                    [bash, "--noprofile", "--norc", "-c", script],
                    env=dict(env, BIN=binary_path), capture_output=True, timeout=15,
                )
                self.assertEqual(result.returncode, expected_rc, result.stderr)
                if expected_rc == 0:
                    self.assertEqual(result.stdout, b"CMD_SHIM_OK\n")
                else:
                    self.assertIn(b"backend CLI not found", result.stderr)
                    self.assertNotIn(b"CMD_SHIM_OK", result.stdout)

    def test_steer_guidance_after_flags_and_root_option(self):
        from steer import control
        for tail in (["guidance text", "--mode", "queue"],
                     ["--mode", "queue", "guidance text"],
                     ["--mode", "queue", "--", "--literal guidance"]):
            captured = []
            with patch.object(control, "cmd_steer", side_effect=lambda args: captured.append(args) or 0):
                result = control.main(["--registry-root", str(self.root), "steer", "run_test", *tail])
            self.assertEqual(result, 0)
            self.assertEqual(captured[0].guidance, "--literal guidance" if "--" in tail else "guidance text")
            self.assertEqual(captured[0].mode, "queue")
            self.assertEqual(captured[0].registry_root, str(self.root))
            self.assertEqual(captured[0].run_id, "run_test")

    def test_liveness_does_not_kill(self):
        child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
        try:
            self.assertTrue(util.pid_alive(child.pid))
            time.sleep(0.1)
            self.assertIsNone(child.poll())
            self.assertFalse(util.pid_alive(9999999))
        finally:
            child.kill()
            child.wait()
        self.assertFalse(util.pid_alive(child.pid))

    def test_lock_contention_is_immediate_and_release_allows_another_process(self):
        lock = self.root / "run.lock"
        lock.write_text("non-empty lock\n", encoding="utf-8")
        code = """
import sys
from pathlib import Path
from steer.util import flock_exclusive
try:
    with flock_exclusive(Path(sys.argv[1]), blocking=False):
        print('acquired')
except BlockingIOError:
    print('busy')
"""
        for _ in range(2):
            with util.flock_exclusive(lock):
                started = time.monotonic()
                result = self.python(code, lock)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.strip(), "busy")
                self.assertLess(time.monotonic() - started, 5)
            result = self.python(code, lock)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.strip(), "acquired")

    def test_busy_run_lock_does_not_overrun_wait_deadline(self):
        reg = Registry(self.root / "registry")
        rid = self.record(reg, pid=9999999)
        with reg.with_run_lock(rid):
            started = time.monotonic()
            snaps, timed_out = wait_for_any(reg, [rid], timeout=1, poll_interval=0.05)
            self.assertTrue(timed_out)
            self.assertEqual(snaps[rid].status, "running")
            self.assertLess(time.monotonic() - started, 3)

    def test_session_continuation_is_exclusive_and_never_replayed(self):
        reg = Registry(self.root / "registry")
        source = self.record(reg, "completed")
        handle = {"backend": "codex-cli", "thread_id": "test", "anchor_run_id": source}
        reg.update_meta(source, session_handle=handle)
        util.atomic_write_json(reg.run_path(source) / "session.json", {"latest_run_id": source})
        current = self.record(reg)
        lease = SessionLease(reg, current, source)
        lease.acquire()
        try:
            result = self.python("""
import sys
from pathlib import Path
from steer.registry import Registry, RegistryError
from steer.session import SessionLease
lease = SessionLease(Registry(Path(sys.argv[1])), sys.argv[2], sys.argv[3])
try:
    lease.acquire()
except RegistryError as exc:
    print(exc)
else:
    lease.close()
    raise AssertionError('concurrent continuation accepted')
""", reg.root, current, source)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("already in use", result.stdout)
        finally:
            lease.close()
        with self.assertRaisesRegex(RegistryError, "not the latest"):
            SessionLease(reg, current, source).acquire()

    def test_lock_refuses_symlink(self):
        target = self.root / "target"
        target.write_text("unchanged", encoding="utf-8")
        link = self.root / "link"
        try:
            link.symlink_to(target)
        except OSError as exc:
            self.skipTest(f"symlink creation unavailable: {exc}")
        with self.assertRaises(OSError):
            fd = util.open_lock_fd(link)
            os.close(fd)
        self.assertEqual(target.read_text(encoding="utf-8"), "unchanged")

    def test_process_tree_cancellation(self):
        marker = self.root / "child.pid"
        code = "import subprocess,sys,time; from pathlib import Path; p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)']); Path(sys.argv[1]).write_text(str(p.pid)); time.sleep(60)"
        proc = subprocess.Popen([sys.executable, "-c", code, str(marker)], **util.detached_popen_kwargs())
        try:
            deadline = time.monotonic() + 10
            while not marker.exists() and time.monotonic() < deadline:
                time.sleep(0.05)
            self.assertTrue(marker.exists())
            child_pid = int(marker.read_text())
            util.kill_process_group(proc.pid)
            proc.wait(timeout=10)
            # Windows has no zombie state; assert both members are gone. POSIX
            # descendants can remain zombies until the system reaper runs.
            if os.name == "nt":
                self.assertFalse(util.pid_alive(child_pid), "descendant survived cancellation")
        finally:
            if proc.poll() is None:
                util.kill_process_group(proc.pid)
                proc.wait(timeout=10)

    def test_taskkill_failure_is_observable(self):
        with patch.object(util, "system_executable", return_value="system-taskkill"), \
             patch.object(util.subprocess, "run", return_value=subprocess.CompletedProcess([], 5)), \
             patch.object(util, "pid_alive", return_value=False):
            with self.assertRaisesRegex(RuntimeError, "exit 5"):
                util.taskkill_tree(123)

    def test_taskkill_timeout_is_observable(self):
        with patch.object(util, "system_executable", return_value="system-taskkill"), \
             patch.object(util.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)), \
             patch.object(util, "pid_alive", return_value=True):
            with self.assertRaises(TimeoutError):
                util.taskkill_tree(123, timeout=0)

    def test_missing_system_tool_never_searches_path(self):
        with patch.dict(os.environ, {"SystemRoot": str(self.root)}):
            with self.assertRaises(FileNotFoundError):
                util.system_executable("taskkill.exe")

    @unittest.skipIf(os.name == "nt", "POSIX E2E harness cleanup")
    def test_e2e_timeout_does_not_kill_harness(self):
        launcher = self.root / "fake-porch"
        launcher.write_text("#!/bin/sh\nprintf 'run_id=run_test\\n' >&2\nsleep 60\n", encoding="utf-8")
        launcher.chmod(0o755)
        # Isolate the driver from this test runner: the old harness killed
        # its own process group on timeout, including the driver itself.
        result = self.python("""
import os,sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import test_steer_e2e as harness
harness.PORCH = Path(sys.argv[2])
proc, _, _ = harness.start_steerable('fake', 'task', os.environ.copy(), Path(sys.argv[3]))
code, _, _ = harness.wait_proc(proc, timeout=0.1)
assert code == 99
print('harness survived timeout')
""", Path(__file__).resolve().parent / "steer", launcher, self.root, start_new_session=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("harness survived timeout", result.stdout)

    def test_fake_opencode_startup_does_not_depend_on_dns(self):
        import contextlib
        import io
        import runpy
        fake = Path(__file__).resolve().parent / "fakes/steer/fake-opencode-steer"
        namespace = runpy.run_path(str(fake))
        output = io.StringIO()
        with patch("socket.getfqdn", side_effect=AssertionError("offline fake attempted DNS")), \
             patch.object(namespace["LoopbackHTTPServer"], "serve_forever"), \
             patch.object(sys, "argv", [str(fake), "serve", "--hostname", "127.0.0.1", "--port", "0"]), \
             contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            self.assertEqual(namespace["main"](), 0)
        self.assertIn("listening on http://127.0.0.1:", output.getvalue())

    @unittest.skipUnless(os.name == "posix", "POSIX process-group cancellation")
    def test_opencode_one_shot_cancellation_reaps_server_and_client(self):
        fake = Path(__file__).resolve().parent / "fakes/fake-opencode"
        server_file = self.root / "server.pid"
        client_file = self.root / "client.pid"
        env = dict(self.env, XDG_DATA_HOME=str(self.root / "data"),
                   PORCH_FAKE_OPENCODE_SERVER_PID_FILE=str(server_file),
                   PORCH_FAKE_OPENCODE_CLIENT_PID_FILE=str(client_file), PORCH_SAVE_OUTPUTS="0")
        for key in ("OPENCODE_DB", "OPENCODE_PASSWORD", "OPENCODE_SERVER_PASSWORD"):
            env.pop(key, None)
        proc = subprocess.Popen([sys.executable, str(LIB / "opencode_run.py"), str(self.root), "test",
                                 str(fake), "run", "--standalone", "--format", "json"],
                                env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            deadline = time.monotonic() + 20
            while not (server_file.is_file() and client_file.is_file()) and time.monotonic() < deadline:
                if proc.poll() is not None:
                    self.fail(f"wrapper exited early: {proc.stderr.read().decode()}")
                time.sleep(.05)
            self.assertTrue(server_file.is_file() and client_file.is_file())
            pids = [int(server_file.read_text()), int(client_file.read_text())]
            proc.terminate()
            proc.communicate(timeout=15)
            self.assertEqual(proc.returncode, 143)
            self.assertTrue(all(not util.pid_alive(pid) for pid in pids), pids)
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.wait()

    @unittest.skipUnless(os.name == "nt", "native Windows launcher contract")
    def test_python_shebang_preserves_argv(self):
        script = self.root / "python-launcher"
        script.write_text("#!/usr/bin/env python3\nimport json,sys; print(json.dumps(sys.argv[1:], ensure_ascii=False))\n", encoding="utf-8")
        args = ["a b", 'quote"', "$(no-command)", "x&y", "ü"]
        result = subprocess.run(util.resolve_argv([str(script), *args]),
                                capture_output=True, text=True, encoding="utf-8", timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), args)

    @unittest.skipUnless(os.name == "nt", "native Windows launcher contract")
    def test_shell_shebang_preserves_argv(self):
        script = self.root / "shell-launcher"
        script.write_text('#!/bin/sh\nprintf "%s\\n" "$@"\n', encoding="utf-8")
        args = ["a b", "$(no-command)", "x&y", "ü"]
        result = subprocess.run(util.resolve_argv([str(script), *args]),
                                capture_output=True, text=True, encoding="utf-8", timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines(), args)

    @unittest.skipUnless(os.name == "nt", "native Windows launcher contract")
    def test_batch_launcher_and_rejection_of_shell_syntax(self):
        script = self.root / "batch.cmd"
        script.write_text('@echo off\necho %~1\n', encoding="utf-8")
        result = subprocess.run(util.resolve_argv([str(script), "two words"]),
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "two words")
        with self.assertRaises(ValueError):
            util.resolve_argv([str(script), "x&echo INJECTED"])

    @unittest.skipUnless(os.name == "nt", "native Windows launcher contract")
    def test_unknown_shebang_is_rejected(self):
        script = self.root / "unknown"
        script.write_text("#!/usr/bin/ruby\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "unsupported shebang"):
            util.resolve_argv([str(script)])

    def test_native_supervisor_durable_codex_followup(self):
        tests = Path(__file__).resolve().parent
        env = dict(self.env, PORCH_CONFIG=str(tests / "fixtures/test-config.json"),
                   PORCH_BIN_CODEX=str(tests / "fakes/steer/fake-codex-steer"),
                   PORCH_FAKE_STEER_SLOW="0.01",
                   PORCH_FAKE_RPC_LOG=str(self.root / "rpc.jsonl"))
        root = self.root / "registry"
        previous = None
        for index, prompt in enumerate(("INITIAL_ONLY", "FOLLOWUP_ONLY")):
            task = self.root / "task.txt"
            task.write_text(prompt, encoding="utf-8")
            rid_file = self.root / f"run-{index}.txt"
            args = [sys.executable, "-m", "steer.supervisor", "--agent-id", "codex",
                    "--task-file", str(task), "--cwd", str(self.root),
                    "--registry-root", str(root), "--run-id-file", str(rid_file),
                    "--persist-session", "--detach-setsid"]
            if previous:
                args += ["--continue-run", previous]
            result = subprocess.run(args, env=env, capture_output=True, text=True,
                                    encoding="utf-8", timeout=25)
            self.assertEqual(result.returncode, 0, result.stderr)
            rid = rid_file.read_text(encoding="utf-8").strip()
            meta = Registry(root).load_meta(rid)
            self.assertEqual(meta["status"], "completed")
            if previous:
                self.assertEqual(meta["continued_from"], previous)
                self.assertEqual(meta["session_handle"]["thread_id"], old_thread)
            old_thread = meta["session_handle"]["thread_id"]
            previous = rid
        calls = [json.loads(line) for line in (self.root / "rpc.jsonl").read_text(encoding="utf-8").splitlines()]
        turns = [call for call in calls if call.get("method") == "turn/start"]
        self.assertEqual(len(turns), 2)
        self.assertNotIn("INITIAL_ONLY", json.dumps(turns[1]))
        self.assertIn("FOLLOWUP_ONLY", json.dumps(turns[1]))


if __name__ == "__main__":
    unittest.main()
