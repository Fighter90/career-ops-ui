"""Claude Code steerable adapter: stream-json stdin + replay-user-messages."""
from __future__ import annotations

import json
import queue
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

from ..util import detached_popen_kwargs, kill_process_group, resolve_argv
from .base import AdapterEvent, BackendAdapter, DeliveryClass, SteerResult


class ClaudeAdapter(BackendAdapter):
    backend_name = "claude-code"
    auto_delivery = DeliveryClass.QUEUE_NEXT_TURN

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.proc: Optional[subprocess.Popen] = None
        self._events: "queue.Queue[AdapterEvent]" = queue.Queue()
        self._stdin_lock = threading.Lock()
        self._reader: Optional[threading.Thread] = None
        self._stderr_reader: Optional[threading.Thread] = None
        self._pending_steers: Dict[str, Dict[str, Any]] = {}
        self._raw_path = Path(self.artifacts_dir) / "raw" / f"{self.agent_id or 'claude'}.jsonl"
        self._norm_path = Path(self.artifacts_dir) / "normalized" / f"{self.agent_id or 'claude'}.jsonl"
        self._result_text: Optional[str] = None
        self._final_parts: List[str] = []
        self._cancelled = False
        self._result_seen = False
        self._lock = threading.RLock()
        self._turn_ready = False
        self._interrupt: Optional[Dict[str, Any]] = None
        self._seen_results: set[str] = set()
        self._queued_user_sent = False
        # Track open tool_use content blocks by index so stop maps only tools.
        self._open_tool_blocks: Dict[str, str] = {}

    def _argv(self) -> List[str]:
        cmd = [
            self.binary,
            "--dangerously-skip-permissions",
            "--model",
            self.model,
        ]
        if self.effort:
            cmd += ["--effort", self.effort]
        cmd += [
            "--output-format",
            "stream-json",
            "--input-format",
            "stream-json",
            "--replay-user-messages",
            "--verbose",
            "-p",
        ]
        return cmd

    def start(self, task: str) -> None:
        self._raw_path.parent.mkdir(parents=True, exist_ok=True)
        self._norm_path.parent.mkdir(parents=True, exist_ok=True)
        self.proc = subprocess.Popen(
            resolve_argv(self._argv(), cwd=self.cwd),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=self.cwd,
            text=True,
            encoding="utf-8",
            bufsize=1,
            **detached_popen_kwargs(),
        )
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()
        # Always drain stderr so a chatty process cannot block on a full pipe.
        self._stderr_reader = threading.Thread(target=self._read_stderr, daemon=True)
        self._stderr_reader.start()
        self._write_user(task, client_id="initial")

    def _write_user(self, text: str, client_id: str) -> None:
        msg = {
            "type": "user",
            "message": {
                "role": "user",
                "content": [{"type": "text", "text": text}],
            },
            "uuid": client_id,
            "parent_tool_use_id": None,
        }
        self._write_json(msg)

    def _write_json(self, msg: Dict[str, Any]) -> None:
        line = json.dumps(msg, ensure_ascii=False) + "\n"
        assert self.proc and self.proc.stdin
        with self._stdin_lock:
            self.proc.stdin.write(line)
            self.proc.stdin.flush()
        with open(self._raw_path, "a", encoding="utf-8") as f:
            f.write(">> " + line)

    def _read_stderr(self) -> None:
        assert self.proc and self.proc.stderr
        try:
            for line in self.proc.stderr:
                with open(self._raw_path, "a", encoding="utf-8") as f:
                    f.write("stderr: " + line)
        except Exception:
            pass

    def _read_loop(self) -> None:
        assert self.proc and self.proc.stdout
        for line in self.proc.stdout:
            line = line.rstrip("\n")
            if not line:
                continue
            with open(self._raw_path, "a", encoding="utf-8") as f:
                f.write(line + "\n")
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                self._events.put(AdapterEvent(kind="raw", data=line))
                continue
            if isinstance(obj, dict):
                try:
                    self._handle_obj(obj)
                except Exception as error:
                    with self._lock:
                        self._error = f"Claude stream handling failed: {error}"
                        self._exit_code = 1
                        self._done = True
                        if self._interrupt:
                            self._ack_interrupt("failed", "stream_handover_failed")
                        self._events.put(AdapterEvent(kind="error", data=self._error))
                        self._events.put(AdapterEvent(kind="done", data="stream_error"))
                    return
        # stdout closed — wait for process, but result may already have marked done
        rc = self.proc.wait()
        with self._lock:
            if self._interrupt:
                self._ack_interrupt("failed", "process_exited_before_handover")
                self._error = "Claude process exited before the interrupt handover completed"
                self._exit_code = 1
                self._events.put(AdapterEvent(kind="error", data=self._error))
            if self._exit_code is None:
                self._exit_code = rc
            if not self._done:
                self._done = True
                self._events.put(AdapterEvent(kind="done", data=str(rc)))

    def _handle_obj(self, obj: Dict[str, Any]) -> None:
        # Reader events and mailbox delivery share one transition lock. Follow-up
        # input is never sent between an unrecorded result and its state change.
        with self._lock:
            self._handle_locked(obj)

    def _handle_locked(self, obj: Dict[str, Any]) -> None:
        native_id = obj.get("session_id")
        if isinstance(native_id, str) and native_id and not self.session_id:
            self.session_id = native_id
        typ = obj.get("type")
        if typ == "control_response":
            self._handle_control_response(obj)
            return
        if typ == "system" and obj.get("subtype") == "init":
            self._turn_ready = True
            self._send_interrupt_if_ready()
        if typ == "stream_event" and isinstance(obj.get("event"), dict):
            self._handle_locked(obj["event"])
            return
        if typ == "user" or typ == "user_message" or obj.get("role") == "user":
            uuid = obj.get("uuid") or ""
            content_preview = ""
            msg = obj.get("message") or obj
            content = msg.get("content") if isinstance(msg, dict) else None
            if isinstance(content, list):
                parts = []
                for c in content:
                    if isinstance(c, dict) and c.get("type") == "text":
                        parts.append(c.get("text") or "")
                    elif isinstance(c, str):
                        parts.append(c)
                content_preview = "".join(parts)
            elif isinstance(content, str):
                content_preview = content
            self._events.put(
                AdapterEvent(
                    kind="user_replay",
                    data=content_preview,
                    raw={"uuid": uuid, "obj": obj},
                )
            )
            # Correlate by client UUID only — never substring match on content
            # (avoids false applied when guidance text appears inside model output).
            if uuid and uuid in self._pending_steers:
                pending = self._pending_steers[uuid]
                pending["replayed"] = True
                if not pending.get("ack_emitted"):
                    pending["ack_emitted"] = True
                    self._events.put(
                        AdapterEvent(
                            kind="steer_ack",
                            data=uuid,
                            raw={
                                "promptId": uuid,
                                "status": "applied",
                                "evidence": "user_message_replay",
                            },
                        )
                    )
            return
        if typ == "content_block_start":
            block = obj.get("content_block") or {}
            if isinstance(block, dict) and block.get("type") == "tool_use":
                name = block.get("name") or "tool"
                tid = block.get("id") or ""
                self._open_tool_blocks[str(obj.get("index", tid or name))] = name
                self._events.put(
                    AdapterEvent(kind="tool", data=str(name), raw=obj)
                )
            else:
                self._events.put(
                    AdapterEvent(kind="progress", data=typ or "block_start", raw=obj)
                )
            return
        if typ == "content_block_stop":
            # Only tool blocks map to tool_completed; text/thinking stops are progress.
            # Arbitrary-pop only when index is actually missing. A present unknown
            # or text index is structural progress — never a false tool_completed.
            if "index" in obj and obj.get("index") is not None:
                idx = str(obj.get("index"))
                tool_name = self._open_tool_blocks.pop(idx, None)
            else:
                tool_name = None
                if self._open_tool_blocks:
                    _, tool_name = self._open_tool_blocks.popitem()
            if tool_name is not None:
                self._events.put(
                    AdapterEvent(kind="tool", data=f"completed:{tool_name}", raw=obj)
                )
            else:
                self._events.put(
                    AdapterEvent(kind="progress", data="block_stop", raw=obj)
                )
            return
        if typ == "content_block_delta":
            d = obj.get("delta") or {}
            if d.get("type") == "text_delta":
                t = d.get("text") or ""
                if t:
                    self._final_parts.append(t)
                    self._events.put(AdapterEvent(kind="text", data=t, raw=obj))
            return
        if typ in ("result", "result_success"):
            result_id = obj.get("uuid")
            if isinstance(result_id, str):
                if result_id in self._seen_results:
                    return
                self._seen_results.add(result_id)
            self._turn_ready = False
            if self._interrupt:
                if self._interrupt["sent"]:
                    # A result can precede its interrupt acknowledgement. Retain
                    # both barriers; neither alone authorizes the new instruction.
                    self._interrupt["result"] = obj
                    self._resume_after_interrupt()
                    return
                self._ack_interrupt("failed", "turn_ended_before_interrupt_sent")
                self._interrupt = None
            self._complete_result(obj)
            return
        self._handle_content(obj, typ)

    def _complete_result(self, obj: Dict[str, Any]) -> None:
        # Authoritative result completes the adapter even if stdin stays open.
        result = obj.get("result")
        is_error = bool(obj.get("is_error") or obj.get("error"))
        if isinstance(result, str) and result.strip() and not is_error:
            self._result_text = result
            self._final_parts = [result]
        self._result_seen = True
        self._done = True
        if is_error:
            self._exit_code = 1
            self._error = str(obj.get("error") or result or "result_error")
            self._events.put(AdapterEvent(kind="error", data=self._error, raw=obj))
        else:
            self._exit_code = 0
        self._events.put(AdapterEvent(kind="done", data="result", raw=obj))

    def _handle_content(self, obj: Dict[str, Any], typ: str) -> None:
        if typ == "assistant":
            msg = obj.get("message") or obj
            content = msg.get("content") if isinstance(msg, dict) else None
            if isinstance(content, list):
                for c in content:
                    if isinstance(c, dict) and c.get("type") == "text" and c.get("text"):
                        self._final_parts.append(c["text"])
                        self._events.put(AdapterEvent(kind="text", data=c["text"], raw=obj))
            return
        if typ == "error" or obj.get("error"):
            self._error = str(obj.get("error") or obj)
            self._events.put(AdapterEvent(kind="error", data=self._error, raw=obj))
            return
        self._events.put(AdapterEvent(kind="progress", data=typ or "event", raw=obj))

    def poll_events(self) -> Iterator[AdapterEvent]:
        while True:
            try:
                yield self._events.get_nowait()
            except queue.Empty:
                break
        # The reader owns EOF/result transitions. Observing process exit here
        # can race buffered stdout and incorrectly complete an unfinished handover.

    def _queue_class(self) -> DeliveryClass:
        # Claude Code queues stream-json messages sent while work is in flight
        # as their own later turn; replay only proves the backend accepted it.
        return DeliveryClass.QUEUE_NEXT_TURN

    def _interrupt_class(self) -> DeliveryClass:
        return DeliveryClass.CANCEL_AND_SEND

    def _ack_interrupt(self, status: str, evidence: str) -> None:
        assert self._interrupt
        self._events.put(AdapterEvent(kind="steer_ack", data=self._interrupt["client_id"], raw={
            "promptId": self._interrupt["client_id"], "status": status, "evidence": evidence}))

    def _send_interrupt_if_ready(self) -> None:
        pending = self._interrupt
        if pending and self._turn_ready and not pending["sent"]:
            pending["sent"] = True
            self._write_json({"type": "control_request", "request_id": pending["request_id"],
                              "request": {"subtype": "interrupt"}})

    def _handle_control_response(self, obj: Dict[str, Any]) -> None:
        response = obj.get("response")
        pending = self._interrupt
        if not isinstance(response, dict) or not pending or response.get("request_id") != pending["request_id"]:
            return
        if response.get("subtype") != "success":
            self._ack_interrupt("rejected", "interrupt_rejected")
            previous_result = pending["result"]
            self._interrupt = None
            if previous_result is not None:
                self._complete_result(previous_result)
            return
        receipt = response.get("response") or {}
        if not isinstance(receipt, dict) or receipt.get("still_queued"):
            # Native queue ownership is outside this single-turn handover. Never
            # erase accepted instructions or mistake a queued result for ours.
            self._ack_interrupt("failed", "interrupt_queue_unresolved")
            self._error = "Claude interrupt left queued work; cancel or inspect the native session"
            self._events.put(AdapterEvent(kind="error", data=self._error, raw=obj))
            # Keep the session and its already-accepted native queue alive. No
            # follow-up is sent; caller can inspect or explicitly cancel it.
            return
        pending["acknowledged"] = True
        self._ack_interrupt("queued", "interrupt_acknowledged_waiting_turn_end")
        self._resume_after_interrupt()

    def _resume_after_interrupt(self) -> None:
        pending = self._interrupt
        if not pending or not pending["acknowledged"] or pending["result"] is None:
            return
        self._events.put(AdapterEvent(kind="turn_completed", data="interrupted_turn_ended", raw=pending["result"]))
        self._final_parts = []
        self._result_text = None
        self._open_tool_blocks.clear()
        self._interrupt = None
        self._write_user(pending["content"], client_id=pending["client_id"])

    def steer(self, content: str, mode: str, client_id: str) -> SteerResult:
        with self._lock:
            return self._steer_locked(content, mode, client_id)

    def _steer_locked(self, content: str, mode: str, client_id: str) -> SteerResult:
        if self._done:
            return SteerResult(
                ok=False,
                delivery_class=self.auto_delivery,
                status="rejected",
                error="backend already completed",
            )
        try:
            dclass = self.map_mode(mode)
        except NotImplementedError as e:
            return SteerResult(
                ok=False,
                delivery_class=self.auto_delivery,
                status="rejected",
                error=str(e),
            )
        self._pending_steers[client_id] = {"content": content, "replayed": False}
        if self._interrupt or (mode == "interrupt" and self._queued_user_sent):
            return SteerResult(ok=False, delivery_class=dclass, status="rejected",
                               error="Claude handover or queued input is unresolved; no instruction sent")
        try:
            if mode == "interrupt":
                self._interrupt = {"client_id": client_id, "content": content, "sent": False,
                                   "request_id": "interrupt_" + uuid.uuid4().hex,
                                   "acknowledged": False, "result": None}
                self._send_interrupt_if_ready()
            else:
                self._queued_user_sent = True
                self._write_user(content, client_id=client_id)
        except Exception as e:
            return SteerResult(
                ok=False,
                delivery_class=dclass,
                status="failed",
                error=str(e),
                meta={"promptId": client_id},
            )
        # Non-blocking: return request_sent immediately so the supervisor can
        # accept more mailbox work. Replay correlation (by client UUID) emits
        # an async steer_ack → applied when the user message is re-emitted.
        if self._pending_steers.get(client_id, {}).get("replayed"):
            return SteerResult(
                ok=True,
                delivery_class=dclass,
                status="applied",
                evidence="user_message_replay",
                meta={"promptId": client_id},
            )
        return SteerResult(
            ok=True,
            delivery_class=dclass,
            status="request_sent",
            evidence=("interrupt_request_sent" if self._interrupt and self._interrupt["sent"]
                      else "waiting_native_turn_start" if self._interrupt else "stdin_write"),
            meta={"promptId": client_id},
        )

    def child_pid(self) -> Optional[int]:
        return self.proc.pid if self.proc else None

    def cancel(self) -> None:
        self._cancelled = True
        if self.proc and self.proc.poll() is None:
            try:
                if self.proc.stdin:
                    self.proc.stdin.close()
            except Exception:
                pass
            kill_process_group(self.proc.pid, timeout=3.0)
        self._done = True

    def final_text(self) -> str:
        if self._result_text is not None:
            return self._result_text
        return "".join(self._final_parts)

    def close(self) -> None:
        self.cancel()
