#!/usr/bin/env python3
"""Fleet acceptance: real SQLite and CLI, fake agent only; no network/models."""
import concurrent.futures
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRIPTS / "lib"))
from fleet.placement import choose
from fleet.store import Store
from fleet.hosts import execute


class PlacementTests(unittest.TestCase):
    def setUp(self):
        self.hosts = [dict(id="vm", capacity=1, agents=["codex"], workspaces={"one": "/one", "two": "/two"}),
                      dict(id="mac", capacity=1, agents=["codex"], workspaces={"one": "/one"}, automatic=False)]
        self.obs = {h["id"]: {"available": True, "runs": {}} for h in self.hosts}
        self.req = dict(agent="codex", workspace="one", units=1)

    def test_no_implicit_mac_on_busy_vm(self):
        self.obs["vm"]["runs"] = {"other": "running"}
        selected, reasons = choose(self.hosts, self.obs, [], self.req)
        self.assertIsNone(selected)
        self.assertEqual(reasons["mac"], "explicit_selection_only")
        self.assertEqual(choose(self.hosts, self.obs, [], dict(self.req, host="mac"))[0], "mac")

    def test_missing_metrics_and_unknown_host_are_not_capacity(self):
        self.obs["vm"] = {"available": False}
        self.assertIsNone(choose(self.hosts, self.obs, [], self.req)[0])
        self.obs["vm"] = {"available": True, "runs": {}}
        self.hosts[0]["min_available_memory_mb"] = 1
        self.assertIsNone(choose(self.hosts, self.obs, [], self.req)[0])

    def test_claim_race_idempotency_and_lost_ack(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "claims.db"
            store = Store(path)
            store.close()
            def claim(identity):
                store = Store(path)
                try:
                    return store.claim(identity, identity, self.hosts, self.obs, self.req)
                except ValueError:
                    return None
                finally:
                    store.close()
            with concurrent.futures.ThreadPoolExecutor(2) as pool:
                outcomes = list(pool.map(claim, ["a", "b"]))
            self.assertEqual(sum(x is not None for x in outcomes), 1)
            winner = next(x[0] for x in outcomes if x)
            store = Store(path)
            replay, created = store.claim(winner["id"], winner["fingerprint"], self.hosts, self.obs, self.req)
            self.assertFalse(created)
            self.assertEqual(replay["state"], "unknown")
            with self.assertRaises(ValueError):
                store.claim(winner["id"], "changed", self.hosts, self.obs, self.req)
            store.launched(winner["id"], "run_a")
            # Disappearing registry / absent run is NOT terminal evidence.
            with self.assertRaises(ValueError):
                store.claim("c", "c", self.hosts, self.obs, self.req)
            self.obs["vm"]["runs"]["run_a"] = "completed"
            self.assertTrue(store.claim("c", "c", self.hosts, self.obs, self.req)[1])
            store.close()

    def test_weighted_claim_does_not_double_count_run(self):
        self.hosts[0]["capacity"] = 3
        self.obs["vm"]["runs"] = {"r": "running"}
        allocations = [dict(host="vm", units=2, run_id="r", state="running", workspace_path="/two")]
        self.assertEqual(choose(self.hosts, self.obs, allocations, self.req)[0], "vm")
        allocations[0]["workspace_path"] = "/one"
        self.assertIsNone(choose(self.hosts, self.obs, allocations, self.req)[0])

    def test_ssh_quotes_without_prompt_in_command(self):
        host = dict(transport="ssh", address="dev", porch="/tools/porch path", request_timeout_seconds=10)
        with patch("fleet.hosts.subprocess.run") as run:
            execute(host, ["delegate", "steer", "run_x"], content="$(secret)", cwd="/work/a'b")
        argv = run.call_args.args[0]
        self.assertEqual(argv[:5], ["ssh", "-o", "BatchMode=yes", "--", "dev"])
        self.assertNotIn("$(secret)", argv[-1])
        self.assertEqual(run.call_args.kwargs["input"], "$(secret)")


class CLITests(unittest.TestCase):
    def test_real_detached_runner_routes_and_replays(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            env = os.environ.copy()
            env.update(PORCH_STEER_DIR=str(root / "registry"), PORCH_RUN_DIR=str(root / "artifacts"),
                       PORCH_OUTPUT_DIR=str(root / "artifacts"), PORCH_SAVE_OUTPUTS="1",
                       PORCH_CONFIG=str(SCRIPTS / "tests/fixtures/test-config.json"),
                       PORCH_BIN_CODEX=str(SCRIPTS / "tests/fakes/steer/fake-codex-steer"),
                       PORCH_FAKE_STEER_SLOW="0.1")
            config = root / "fleet.json"
            config.write_text(json.dumps(dict(version=1, state_path=str(root / "fleet.db"), hosts=[dict(
                id="vm", transport="local", porch=str(SCRIPTS / "porch"), capacity=1,
                request_timeout_seconds=30, agents=["codex"], workspaces={"test": str(root)})])))
            prompt = root / "prompt.txt"
            prompt.write_text("Test harmless fake worker")
            def call(*args):
                result = subprocess.run([str(SCRIPTS / "porch"), "fleet", "--config", str(config), *args],
                                        env=env, text=True, capture_output=True, timeout=40)
                self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
                return json.loads(result.stdout)
            arguments = ("launch", "--agent", "codex", "--workspace", "test", "--request-id", "test-one",
                         "--prompt-file", str(prompt))
            first = call(*arguments)
            run_id = first["request"]["run_id"]
            self.assertTrue(run_id.startswith("run_"))
            replay = call(*arguments)
            self.assertTrue(replay["replayed"])
            self.assertEqual(replay["request"]["run_id"], run_id)
            # Simulate a launch that succeeded but whose receipt never reached SQLite.
            store = Store(root / "fleet.db")
            store.db.execute("UPDATE requests SET run_id = NULL, state = 'unknown'")
            store.close()
            recovered = call("reconcile", "test-one")
            self.assertEqual(recovered["request"]["run_id"], run_id)
            status = call("control", "test-one", "wait", "--timeout", "10", "--json")
            self.assertEqual(status["status"], "completed")
            self.assertEqual(len(list((root / "registry/runs").iterdir())), 1)
            self.assertIn("hosts", call("status"))


if __name__ == "__main__":
    unittest.main()
