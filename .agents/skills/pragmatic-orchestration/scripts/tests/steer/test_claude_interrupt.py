"""Claude turn handover: stdin protocol only, no native model or network."""
import io
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from steer.adapters.claude import ClaudeAdapter
from steer.adapters.base import DeliveryClass


class InterruptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.adapter = ClaudeAdapter(binary="unused", model="test", cwd=self.tmp.name,
                                     artifacts_dir=self.tmp.name, agent_id="claude")
        self.adapter._raw_path.parent.mkdir(parents=True, exist_ok=True)
        self.stdin = io.StringIO()
        self.adapter.proc = SimpleNamespace(stdin=self.stdin, poll=lambda: None)

    def frames(self):
        return [json.loads(line) for line in self.stdin.getvalue().splitlines()]

    def init(self):
        self.adapter._handle_obj({"type": "system", "subtype": "init", "session_id": "same-session"})

    def result(self, identity="old", **fields):
        self.adapter._handle_obj({"type": "result", "uuid": identity, **fields})

    def acknowledge(self, subtype="success", request_id=None, **data):
        request_id = request_id or self.frames()[0]["request_id"]
        self.adapter._handle_obj({"type": "control_response", "response": {
            "request_id": request_id, "subtype": subtype, "response": data}})

    def interrupt(self, client="steer-1"):
        outcome = self.adapter.steer("new instruction " + client, "interrupt", client)
        self.assertTrue(outcome.ok)
        self.assertEqual(outcome.delivery_class, DeliveryClass.CANCEL_AND_SEND)

    def test_ack_then_result_waits_for_both_and_clears_old_answer(self):
        self.init()
        self.adapter._final_parts.append("old partial")
        self.interrupt()
        self.acknowledge(still_queued=[])
        self.assertEqual(len(self.frames()), 1)
        self.assertFalse(self.adapter.is_done())
        self.result(is_error=True)
        self.assertEqual(self.frames()[1]["uuid"], "steer-1")
        self.assertEqual(self.adapter.final_text(), "")
        self.assertFalse(self.adapter.is_done())
        self.result("new", result="new answer")
        self.assertTrue(self.adapter.is_done())
        self.assertEqual(self.adapter.exit_code(), 0)
        self.assertEqual(self.adapter.final_text(), "new answer")

    def test_result_before_ack_and_duplicate_old_result(self):
        self.init(); self.interrupt()
        self.result(is_error=True)
        self.assertEqual(len(self.frames()), 1)
        self.acknowledge(still_queued=[])
        self.assertEqual(len(self.frames()), 2)
        self.result(is_error=True)
        self.assertFalse(self.adapter.is_done())

    def test_early_interrupt_waits_for_native_init_not_user_replay(self):
        self.interrupt()
        self.assertEqual(self.frames(), [])
        self.adapter._handle_obj({"type": "user", "uuid": "initial"})
        self.assertEqual(self.frames(), [])
        self.init()
        self.assertEqual(self.frames()[0]["request"]["subtype"], "interrupt")

    def test_ack_only_never_sends_followup(self):
        self.init(); self.interrupt(); self.acknowledge()
        self.assertEqual(len(self.frames()), 1)
        self.assertFalse(self.adapter.is_done())
        self.assertTrue(any(e.kind == "steer_ack" and e.raw["status"] == "queued"
                            for e in self.adapter.poll_events()))

    def test_unrelated_control_response_is_ignored(self):
        self.init(); self.interrupt(); self.result()
        self.acknowledge(request_id="unrelated")
        self.assertEqual(len(self.frames()), 1)
        self.assertFalse(self.adapter.is_done())

    def test_control_error_preserves_original_result_and_no_new_input(self):
        self.init(); self.interrupt(); self.result(result="old answer")
        self.acknowledge(subtype="error")
        self.assertTrue(self.adapter.is_done())
        self.assertEqual(self.adapter.final_text(), "old answer")
        self.assertEqual(len(self.frames()), 1)

    def test_result_before_native_start_rejects_without_sending(self):
        self.interrupt(); self.result(result="already finished")
        self.assertEqual(self.frames(), [])
        self.assertTrue(self.adapter.is_done())

    def test_second_interrupt_waits_for_second_init(self):
        self.init(); self.interrupt(); self.acknowledge(); self.result()
        self.interrupt("steer-2")
        self.assertEqual(len(self.frames()), 2)
        self.init()
        self.assertEqual(len(self.frames()), 3)
        self.acknowledge(request_id=self.frames()[2]["request_id"])
        self.result("second-old", is_error=True)
        self.assertEqual(self.frames()[3]["uuid"], "steer-2")
        self.assertEqual(self.adapter.session_id, "same-session")

    def test_overlapping_handover_and_preexisting_queue_fail_explicitly(self):
        self.init(); self.interrupt()
        self.assertFalse(self.adapter.steer("another", "interrupt", "second").ok)
        self.assertFalse(self.adapter.steer("another", "queue", "second-q").ok)
        self.assertEqual(len(self.frames()), 1)
        self.acknowledge(); self.result()
        self.assertTrue(self.adapter.steer("queued", "queue", "queued").ok)
        self.assertFalse(self.adapter.steer("interrupt", "interrupt", "third").ok)

    def test_unexpected_native_queue_is_not_erased_or_called_done(self):
        self.init(); self.interrupt(); self.acknowledge(still_queued=["other-input"])
        self.result()
        self.assertEqual(len(self.frames()), 1)
        self.assertFalse(self.adapter.is_done())

    def test_process_exit_during_handover_is_not_success(self):
        self.init(); self.interrupt(); self.acknowledge()
        self.adapter.proc.stdout = io.StringIO("")
        self.adapter.proc.wait = lambda: 0
        self.adapter._read_loop()
        self.assertTrue(self.adapter.is_done())
        self.assertEqual(self.adapter.exit_code(), 1)
        self.assertTrue(any(e.kind == "steer_ack" and e.raw["status"] == "failed"
                            for e in self.adapter.poll_events()))


if __name__ == "__main__":
    unittest.main()
