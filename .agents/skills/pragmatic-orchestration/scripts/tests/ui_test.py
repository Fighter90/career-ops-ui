"""Read-only observer boundary tests; no providers or user registry."""
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from steer.registry import Registry
from steer.launcher import launcher_metadata
from ui.focus import launch_focus
from ui.server import create_server


class ObserverTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.registry = Registry(self.root / "registry")
        self.artifacts = self.root / "artifacts"
        (self.artifacts / "normalized").mkdir(parents=True)
        self.run_id = self.registry.create_run(
            agent_id="codex", backend="codex-cli", model="test-model",
            cwd=str(self.root), artifacts_dir=str(self.artifacts), run_name="check-ui",
        )
        self.journal = self.artifacts / "normalized" / "codex.jsonl"
        self.server = create_server(self.registry, self.root, port=0, token="test-token")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop)
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, path, headers=None):
        try:
            with urlopen(Request(self.base + path, headers=headers or {
                "Authorization": "Bearer test-token",
            }), timeout=3) as response:
                return json.load(response)
        except HTTPError as error:
            self.addCleanup(error.close)
            raise

    def events(self, cursor=""):
        return self.request(f"/api/runs/{self.run_id}/events?cursor={cursor}")

    def write_event(self, text, mode="a"):
        with self.journal.open(mode, encoding="utf-8") as stream:
            stream.write(json.dumps({"type": "answer_delta", "data": text,
                                     "raw": {"private": "must-not-export"}}) + "\n")

    def test_attach_to_existing_run_and_follow_complete_unicode_output(self):
        self.write_event("Начало " + "x" * 6000)
        before = (self.registry.run_path(self.run_id) / "meta.json").read_bytes()
        runs = self.request("/api/runs")["runs"]
        self.assertEqual(runs[0]["run_id"], self.run_id)
        first = self.events()
        self.assertEqual(first["events"][0]["data"], "Начало " + "x" * 6000)
        self.assertNotIn("raw", first["events"][0])
        self.write_event("Продолжение")
        following = self.events(first["next_cursor"])
        self.assertEqual([e["data"] for e in following["events"]], ["Продолжение"])
        self.assertEqual(self.events(following["next_cursor"])["events"], [])
        self.assertEqual((self.registry.run_path(self.run_id) / "meta.json").read_bytes(), before)

    def test_session_metrics_are_projected_only_when_known(self):
        self.registry.update_meta(self.run_id, turn_count=3, native_session_id="thread-abc")
        run = self.request("/api/runs")["runs"][0]
        self.assertEqual(run["turn_count"], 3)
        self.assertEqual(run["native_session_id"], "thread-abc")
        self.assertNotIn("owner_uid", run)

    def test_partial_line_is_not_acknowledged(self):
        self.write_event("first")
        first = self.events()
        with self.journal.open("ab") as stream:
            stream.write(b'{"type":"answer_delta","data":"sec')
        partial = self.events(first["next_cursor"])
        self.assertEqual(partial["events"], [])
        self.assertEqual(partial["next_cursor"], first["next_cursor"])
        with self.journal.open("ab") as stream:
            stream.write(b'ond"}\n')
        self.assertEqual(self.events(partial["next_cursor"])["events"][0]["data"], "second")

    def test_replacement_and_truncation_reset_cursor(self):
        self.write_event("old" * 100)
        cursor = self.events()["next_cursor"]
        self.write_event("new", "w")
        page = self.events(cursor)
        self.assertTrue(page["reset"])
        self.assertEqual(page["events"][0]["data"], "new")
        self.journal.rename(self.journal.with_suffix(".old"))
        self.write_event("replacement")
        self.assertTrue(self.events(page["next_cursor"])["reset"])

    def test_tail_then_from_start_and_bounded_pages(self):
        for n in range(350):
            self.write_event(f"{n}:" + "x" * 1000)
        tail = self.events()
        self.assertTrue(tail["earlier_omitted"])
        page = self.events("start")
        self.assertEqual(len(page["events"]), 200)
        self.assertTrue(page["has_more"])
        self.assertTrue(page["events"][0]["data"].startswith("0:"))
        rest = self.events(page["next_cursor"])
        self.assertEqual(len(rest["events"]), 150)
        self.assertFalse(rest["has_more"])

    def test_malformed_event_is_visible_error_not_skipped(self):
        self.journal.write_text('{"type":"invented"}\n')
        with self.assertRaises(HTTPError) as error:
            self.events()
        self.assertEqual(error.exception.code, 400)
        self.assertIn("Invalid normalized event", error.exception.read().decode())

    def test_stale_is_observed_without_reaping_and_final_is_separate(self):
        self.registry.update_meta(self.run_id, status="running", pid=0)
        runs = self.request("/api/runs")["runs"]
        self.assertEqual(runs[0]["effective_status"], "stale")
        self.assertEqual(self.registry.load_meta(self.run_id)["status"], "running")
        self.assertFalse(self.request(f"/api/runs/{self.run_id}/final")["available"])
        (self.artifacts / "final.txt").write_text("authoritative result", encoding="utf-8")
        answer = self.request(f"/api/runs/{self.run_id}/final")
        self.assertEqual(answer["text"], "authoritative result")
        self.assertFalse(answer["truncated"])

    def test_empty_missing_registry_is_not_created(self):
        self.server.observer.registry = Registry(self.root / "not-created")
        self.assertEqual(self.request("/api/runs")["runs"], [])
        with self.assertRaises(HTTPError):
            self.events()
        self.assertFalse((self.root / "not-created").exists())

    def test_auth_origin_host_and_read_only_boundaries(self):
        for headers in ({"X-Test": "no-token"},
                        {"Authorization": "Bearer wrong"},
                        {"Authorization": "Bearer test-token", "Origin": "https://hostile.invalid"},
                        {"Authorization": "Bearer test-token", "Host": "hostile.invalid"},
                        {"Authorization": "Bearer test-token", "Sec-Fetch-Site": "cross-site"}):
            with self.subTest(headers=headers), self.assertRaises(HTTPError) as error:
                self.request("/api/runs", headers)
            self.assertEqual(error.exception.code, 403)
        with self.assertRaises(HTTPError) as error:
            urlopen(Request(self.base + "/api/runs", method="POST"), timeout=3)
        self.assertEqual(error.exception.code, 405)
        error.exception.close()
        for path in ("/api/runs/%2e%2e/events", "/api/runs/id%2fescape/events", "/../outside"):
            with self.subTest(path=path), self.assertRaises(HTTPError):
                self.request(path)

    def test_download_excludes_raw_and_symlink_artifacts_are_rejected(self):
        self.write_event("visible")
        path = f"/api/runs/{self.run_id}/download?kind=events"
        exported = self.request(path)
        self.assertEqual(exported["data"], "visible")
        self.assertNotIn("raw", exported)
        self.journal.unlink()
        target = self.root / "unrelated.txt"
        target.write_text("not output")
        try:
            self.journal.symlink_to(target)
        except OSError:
            self.skipTest("Symlinks unavailable")
        with self.assertRaises(HTTPError) as error:
            self.events()
        self.assertEqual(error.exception.code, 400)

    def test_no_artifact_and_bad_cursor_have_explicit_outcomes(self):
        self.assertFalse(self.events()["available"])
        self.write_event("exists")
        with self.assertRaises(HTTPError) as error:
            self.events("not-a-cursor")
        self.assertEqual(error.exception.code, 400)


class FocusTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.registry = Registry(Path(self.tmp.name) / "registry")

    def test_current_session_is_opaque_and_distinct(self):
        env = {"CODEX_THREAD_ID": "private-current-session"}
        current = launcher_metadata(env)
        another = launcher_metadata({"CODEX_THREAD_ID": "another-session"})
        self.assertNotEqual(current["launcher_instance"], another["launcher_instance"])
        self.assertNotIn("private-current-session", str(current))
        rid = self.registry.create_run(agent_id="codex", backend="codex-cli", model="test",
                                       cwd=self.tmp.name, artifacts_dir=self.tmp.name,
                                       extra=current)
        self.assertEqual(launch_focus(self.registry, env, mine=True, run_id=rid),
                         {"scope": "mine", "launcher": "codex",
                          "instance": current["launcher_instance"], "run": rid})
        with self.assertRaisesRegex(ValueError, "another launcher or session"):
            launch_focus(self.registry, {"CODEX_THREAD_ID": "another-session"}, mine=True, run_id=rid)
        self.assertEqual(launch_focus(self.registry, {}, run_id=rid), {"run": rid})

    def test_unidentified_caller_fails_instead_of_claiming_unrelated_runs(self):
        with self.assertRaisesRegex(ValueError, "Cannot identify"):
            launch_focus(self.registry, {}, mine=True)


if __name__ == "__main__":
    unittest.main()
