#!/usr/bin/env python3

import importlib.util
import pathlib
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock


MODULE_PATH = pathlib.Path(__file__).parents[1] / "lib" / "quota.py"
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("porch_quota", MODULE_PATH)
quota = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(quota)


class QuotaTest(unittest.TestCase):
    def call_fake_codex(self, source, *, timeout):
        real_popen = subprocess.Popen
        children = []
        with tempfile.TemporaryDirectory(prefix="porch-quota-") as temp:
            script = pathlib.Path(temp) / "fake_codex.py"
            script.write_text(source, encoding="utf-8")

            def launch(_argv, **kwargs):
                child = real_popen([sys.executable, "-u", str(script)], **kwargs)
                children.append(child)
                return child

            try:
                with mock.patch.object(quota.subprocess, "Popen", side_effect=launch):
                    return quota.read_codex(timeout=timeout)
            finally:
                for child in children:
                    if child.poll() is None:
                        child.kill()
                    child.wait(timeout=3)
                    for stream in (child.stdin, child.stdout, child.stderr):
                        if stream:
                            stream.close()

    def test_codex_quota_partial_line_obeys_timeout(self):
        started = time.monotonic()
        with self.assertRaises((RuntimeError, TimeoutError)):
            self.call_fake_codex('''import sys, time
sys.stdin.readline()
sys.stdout.write('{"id":1')
sys.stdout.flush()
time.sleep(2)
''', timeout=0.3)
        self.assertLess(time.monotonic() - started, 1.5)

    def test_codex_quota_drains_stderr_while_waiting_for_response(self):
        result = self.call_fake_codex('''import json, sys
initialized = False
for line in sys.stdin:
    message = json.loads(line)
    method = message.get("method")
    if method == "initialize":
        sys.stderr.write("diagnostic\\n" * 20000)
        sys.stderr.flush()
        print(json.dumps({"id": message["id"], "result": {}}), flush=True)
    elif method == "initialized":
        initialized = True
    elif method == "account/rateLimits/read":
        assert initialized
        print(json.dumps({"id": message["id"], "result": {"rateLimits": {"planType": "pro"}}}), flush=True)
        break
''', timeout=2)
        self.assertTrue(result["ok"])
        self.assertEqual(result["planType"], "pro")

    def test_normalize_codex_preserves_multiple_limit_buckets(self):
        result = quota.normalize_codex({
            "rateLimits": {"planType": "pro"},
            "rateLimitsByLimitId": {
                "codex": {
                    "limitName": None,
                    "primary": {"usedPercent": 24, "windowDurationMins": 10080, "resetsAt": 1788456265},
                    "secondary": None,
                },
                "spark": {
                    "limitName": "Spark",
                    "primary": {"usedPercent": 10, "windowDurationMins": 300, "resetsAt": 1787957812},
                    "secondary": {"usedPercent": 100, "windowDurationMins": 10080, "resetsAt": 1788161839},
                },
            },
            "rateLimitResetCredits": {"availableCount": 1},
        })
        self.assertEqual(result["limits"]["codex"]["primary"]["remainingPercent"], 76)
        self.assertEqual(result["limits"]["spark"]["secondary"]["remainingPercent"], 0)
        self.assertEqual(result["resetCreditsAvailable"], 1)

    def test_parse_grok_screen(self):
        result = quota.parse_grok_screen("Weekly limit: 52%\nNext reset: August 31, 18:59\n")
        self.assertEqual(result["usedPercent"], 52)
        self.assertEqual(result["remainingPercent"], 48)
        self.assertEqual(result["nextResetDisplay"], "August 31, 18:59")

    def test_parse_grok_screen_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "lacks Weekly limit"):
            quota.parse_grok_screen("blank overlay")

    def test_remote_script_shell_quotes_cwd(self):
        script = quota._grok_remote_script("/mnt/work spaces/example")
        self.assertIn("cd '/mnt/work spaces/example' && grok --no-alt-screen", script)

    def test_grok_retries_one_transient_transport_failure(self):
        success = {"ok": True, "remainingPercent": 48}
        with mock.patch.object(
            quota,
            "_read_grok_once",
            side_effect=[RuntimeError("remote exit 1"), success],
        ) as reader, mock.patch.object(quota.time, "sleep"):
            self.assertEqual(quota.read_grok(), success)
            self.assertEqual(reader.call_count, 2)


if __name__ == "__main__":
    unittest.main()
