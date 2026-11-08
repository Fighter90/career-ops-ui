"""Offline regressions for Porch prompt and stdin transport."""
from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


TESTS = Path(__file__).resolve().parent
PORCH = TESTS.parent / "porch"
LIB = TESTS.parent / "lib"
sys.path.insert(0, str(LIB))
from steer.registry import Registry


class InputTestCase(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="porch-review-input-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.log = self.root / "argv.jsonl"
        self.prompt_file = self.root / "question.md"
        self.prompt_file.write_text("QUESTION_FROM_FILE", encoding="utf-8")
        self.env = {key: value for key, value in os.environ.items()
                    if not key.startswith(("PORCH_", "CODEX_"))}
        self.env.update(
            PORCH_CONFIG=str(TESTS / "fixtures" / "test-config.json"),
            PORCH_BIN_CODEX=str(TESTS / "fakes" / "fake-codex"),
            PORCH_BIN_GROK=str(TESTS / "fakes" / "fake-grok"),
            PORCH_FAKE_ARGV_LOG=str(self.log),
            PORCH_RUN_DIR=str(self.root / "run"),
            PORCH_OUTPUT_DIR=str(self.root / "archive"),
            PORCH_SUPPRESS_SHELL_WARN="1",
            PORCH_STEER_DIR=str(self.root / "registry"),
        )

    def command(self, argv, *, input=None, expected=0):
        with (self.root / "stdout").open("w+") as out, \
                (self.root / "stderr").open("w+") as err:
            process = subprocess.Popen(
                list(map(str, argv)),
                stdin=subprocess.PIPE, stdout=out, stderr=err,
                text=True, encoding="utf-8", env=self.env,
                start_new_session=True, cwd=self.root,
            )
            try:
                if input is None:
                    # Keep the write end open: communicate() would send EOF
                    # and conceal the inherited-stdin deadlock.
                    process.wait(timeout=10)
                else:
                    process.communicate(input, timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
                self.fail("command waited for EOF on unused stdin: " + str(argv))
            finally:
                process.stdin.close()
            out.seek(0)
            err.seek(0)
            stdout, stderr = out.read(), err.read()
        self.assertEqual(process.returncode, expected, stderr)
        return stdout, stderr


class ReviewInputTests(InputTestCase):
    def ask(self, *args, input=None, expected=0):
        stdout, stderr = self.command(
            [PORCH, "review", "ask", "--progress", "none", "-a", "codex", *args],
            input=input, expected=expected,
        )
        if expected == 0:
            self.assertIn("FAKE_CODEX_OK", stdout)
            rows = [json.loads(line) for line in self.log.read_text().splitlines()]
            self.assertEqual(len(rows), 1)
            return rows[0]["stdin"]
        self.assertFalse(self.log.exists(), "invalid input launched a backend")
        return stderr

    def test_positional_prompt_does_not_wait_for_stdin_eof(self):
        self.assertIn("POSITIONAL_QUESTION", self.ask("POSITIONAL_QUESTION"))

    def test_prompt_file_does_not_wait_for_stdin_eof(self):
        self.assertIn("QUESTION_FROM_FILE", self.ask("--prompt-file", str(self.prompt_file)))

    def test_explicit_blank_prompt_does_not_read_stdin(self):
        self.assertIn("No prompt provided", self.ask(" \t", expected=5))

    def test_blank_prompt_file_does_not_read_stdin(self):
        self.prompt_file.write_text(" \n\t", encoding="utf-8")
        self.assertIn("No prompt provided", self.ask("--prompt-file", str(self.prompt_file), expected=5))

    def test_stdin_supplies_prompt_when_no_explicit_prompt(self):
        prompt = self.ask(input="STDIN_QUESTION\nSECOND_LINE\n")
        self.assertIn("STDIN_QUESTION\nSECOND_LINE", prompt)
        self.assertNotIn("--- Input ---", prompt)

    def test_context_stdin_appends_to_positional_prompt(self):
        prompt = self.ask("--context-stdin", "QUESTION", input="CONTEXT\nSECOND_LINE\n")
        self.assertIn("QUESTION\n\n--- Input ---\nCONTEXT\nSECOND_LINE", prompt)

    def test_context_stdin_appends_to_prompt_file(self):
        prompt = self.ask("--context-stdin", "--prompt-file", str(self.prompt_file), input="CONTEXT")
        self.assertIn("QUESTION_FROM_FILE\n\n--- Input ---\nCONTEXT", prompt)

    def test_context_stdin_requires_explicit_prompt_before_reading(self):
        self.assertIn("--context-stdin requires", self.ask("--context-stdin", expected=5))

    def test_context_stdin_rejects_empty_input(self):
        self.assertIn("--context-stdin requires", self.ask("--context-stdin", "QUESTION", input=" \n", expected=5))

    def test_unused_stdin_is_not_added_to_explicit_prompt(self):
        prompt = self.ask("QUESTION", input="UNREQUESTED_CONTEXT")
        self.assertIn("QUESTION", prompt)
        self.assertNotIn("UNREQUESTED_CONTEXT", prompt)


class PromptBoundaryTests(InputTestCase):
    def backend(self, *args, **kwargs):
        return self.command(
            [LIB / "backend_run.sh", "--mode", "review", "--agent-id", "codex", *args],
            **kwargs,
        )

    def delegate(self, *args, **kwargs):
        return self.command([PORCH, "delegate", "--one-shot", "-a", "codex", *args], **kwargs)

    def steer(self, *args, run_id="run_missing", **kwargs):
        return self.command([PORCH, "delegate", "steer", run_id, *args], **kwargs)

    def pipeline(self, *args, **kwargs):
        return self.command([sys.executable, LIB / "prompt_pipeline.py", "--mode", "raw", "--raw", *args], **kwargs)

    def test_backend_empty_argument_does_not_read_stdin(self):
        _, err = self.backend("", expected=5)
        self.assertIn("no prompt provided", err)

    def test_backend_empty_file_does_not_read_stdin(self):
        self.prompt_file.write_text("")
        _, err = self.backend("--prompt-file", self.prompt_file, expected=5)
        self.assertIn("no prompt provided", err)

    def test_backend_whitespace_file_is_rejected(self):
        self.prompt_file.write_text(" \n\t")
        self.backend("--prompt-file", self.prompt_file, expected=5)
        self.assertFalse(self.log.exists())

    def test_backend_nonempty_argument_ignores_stdin(self):
        out, _ = self.backend("QUESTION")
        self.assertIn("FAKE_CODEX_OK", out)

    def test_backend_stdin_still_supplies_prompt(self):
        out, _ = self.backend(input="QUESTION_FROM_STDIN")
        self.assertIn("FAKE_CODEX_OK", out)

    def test_backend_literal_dash_filename_does_not_read_stdin(self):
        (self.root / "-").write_text("LITERAL_DASH_FILE")
        self.backend("--prompt-file", "-")
        row = json.loads(self.log.read_text().splitlines()[0])
        self.assertIn("LITERAL_DASH_FILE", row["stdin"])

    def test_prompt_entrypoints_accept_literal_dash_filename(self):
        (self.root / "-").write_text("LITERAL_DASH_FILE")
        for argv in ([PORCH, "review", "ask", "-a", "codex", "--prompt-file", "-"],
                     [PORCH, "delegate", "--one-shot", "-a", "codex", "--prompt-file", "-"]):
            with self.subTest(argv=argv):
                self.command(argv)
                row = json.loads(self.log.read_text().splitlines()[-1])
                self.assertIn("LITERAL_DASH_FILE", row["stdin"])

    def test_code_review_file_modes_do_not_treat_dash_filename_as_stdin(self):
        (self.root / "-").write_text("print('literal input')\n")
        for depth in ("basic", "specialists", "super", "ultra"):
            argv = [PORCH, "review", "code", "--depth", depth]
            if depth in ("super", "ultra"):
                self.env["PORCH_CONFIG"] = str(TESTS.parents[1] / "config.example.json")
            argv += ["--dry-run"] if depth in ("super", "ultra") else ["-a", "codex"]
            with self.subTest(depth=depth):
                self.command([*argv, "--", "-"])

    def test_large_file_prompts_do_not_stall_during_validation(self):
        body = "BEGIN_LARGE_PROMPT\n" + " " * 131072 + "\nEND_LARGE_PROMPT"
        self.prompt_file.write_text(body)
        for argv in ([PORCH, "review", "ask", "-a", "codex", "--prompt-file", self.prompt_file],
                     [LIB / "backend_run.sh", "--mode", "review", "--agent-id", "codex", "--prompt-file", self.prompt_file]):
            with self.subTest(argv=argv):
                self.command(argv)
                row = json.loads(self.log.read_text().splitlines()[-1])
                self.assertIn(body, row["stdin"])

    def test_delegate_empty_argument_does_not_read_stdin(self):
        _, err = self.delegate("", expected=5)
        self.assertIn("no task prompt provided", err)

    def test_delegate_whitespace_argument_is_rejected(self):
        self.delegate(" \n\t", expected=5)
        self.assertFalse(self.log.exists())

    def test_delegate_file_ignores_stdin(self):
        body = "TASK\nUnicode: привет"
        self.prompt_file.write_text(body, encoding="utf-8")
        self.delegate("--prompt-file", self.prompt_file)
        row = json.loads(self.log.read_text().splitlines()[0])
        self.assertEqual(row["stdin"], body)

    def test_delegate_whitespace_file_is_rejected(self):
        self.prompt_file.write_text(" \n\t")
        self.delegate("--prompt-file", self.prompt_file, expected=5)
        self.assertFalse(self.log.exists())

    def test_delegate_stdin_still_supplies_task(self):
        out, _ = self.delegate(input="TASK_FROM_STDIN")
        self.assertIn("FAKE_CODEX_OK", out)

    def test_steer_empty_argument_does_not_read_stdin(self):
        _, err = self.steer("", expected=5)
        self.assertIn("no guidance provided", err)

    def test_steer_empty_file_does_not_read_stdin(self):
        self.prompt_file.write_text("")
        _, err = self.steer("--prompt-file", self.prompt_file, expected=5)
        self.assertIn("no guidance provided", err)

    def test_steer_whitespace_file_is_rejected_before_registry_access(self):
        self.prompt_file.write_text(" \n\t")
        _, err = self.steer("--prompt-file", self.prompt_file, expected=5)
        self.assertIn("no guidance provided", err)
        self.assertFalse((self.root / "registry").exists())

    def test_steer_stdin_still_supplies_guidance(self):
        reg = Registry(self.root / "registry")
        run_id = reg.create_run(agent_id="codex", backend="codex-cli", model="test",
                                cwd=str(self.root), artifacts_dir="")
        for args, input in [(("GUIDANCE",), None),
                            (("--prompt-file", self.prompt_file), None),
                            ((), "GUIDANCE_FROM_STDIN")]:
            with self.subTest(args=args, input=input):
                out, _ = self.steer(*args, run_id=run_id, input=input)
                self.assertIn("accepted client_id=", out)

    def test_empty_file_option_values_do_not_fall_back_to_stdin(self):
        commands = [
            [PORCH, "review", "ask", "--prompt-file", ""],
            [PORCH, "delegate", "-a", "codex", "--prompt-file", ""],
            [PORCH, "delegate", "steer", "run_missing", "--prompt-file", ""],
            [LIB / "backend_run.sh", "--mode", "review", "--agent-id", "codex", "--prompt-file", ""],
            [sys.executable, LIB / "prompt_pipeline.py", "--mode", "raw", "--user-file", ""],
        ]
        for argv in commands:
            with self.subTest(argv=argv):
                self.command(argv, expected=5)

    def test_conflicting_explicit_sources_fail_without_reading_stdin(self):
        commands = [
            [PORCH, "review", "ask", "--prompt-file", self.prompt_file, ""],
            [PORCH, "delegate", "-a", "codex", "--prompt-file", self.prompt_file, ""],
            [PORCH, "delegate", "steer", "run_missing", "--prompt-file", self.prompt_file, ""],
            [LIB / "backend_run.sh", "--mode", "review", "--agent-id", "codex", "--prompt-file", self.prompt_file, ""],
        ]
        for argv in commands:
            with self.subTest(argv=argv):
                _, err = self.command(argv, expected=5)
                self.assertIn("cannot combine", err)
        self.pipeline("--user-file", self.prompt_file, "--user-text", "", expected=2)

    def test_shell_builder_does_not_read_ambient_stdin(self):
        for raw in ("", "1"):
            with self.subTest(raw=raw):
                self.env["PORCH_RAW_PROMPT"] = raw
                out, _ = self.command([
                    "bash", "-c", 'source "$1"; build_prompt ROLE QUESTION "$2"',
                    "porch-input-test", LIB / "common.sh", self.prompt_file,
                ])
                self.assertIn("QUESTION", out)
                self.assertIn("QUESTION_FROM_FILE", out)
                self.assertNotIn("--- Input ---", out)

    def test_pipeline_empty_file_does_not_read_stdin(self):
        self.prompt_file.write_text("")
        self.pipeline("--user-file", self.prompt_file, expected=5)

    def test_pipeline_empty_text_does_not_read_stdin(self):
        self.pipeline("--user-text", "", expected=5)

    def test_pipeline_explicit_text_ignores_stdin(self):
        out, _ = self.pipeline("--user-text", "QUESTION")
        self.assertEqual(out, "QUESTION")

    def test_pipeline_stdin_still_supplies_prompt(self):
        out, _ = self.pipeline(input="QUESTION_FROM_STDIN")
        self.assertEqual(out, "QUESTION_FROM_STDIN")

    def test_file_based_backend_receives_eof_on_unused_stdin(self):
        self.env["PORCH_FAKE_GROK_MODE"] = "read-stdin"
        out, _ = self.command([
            LIB / "backend_run.sh", "--mode", "review", "--agent-id", "grok", "--raw", "QUESTION",
        ])
        self.assertIn("FAKE_GROK_OK", out)


if __name__ == "__main__":
    unittest.main()
