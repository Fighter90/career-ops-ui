"""OpenCode 2 private-server adapter with durable prompt and history checks."""
from __future__ import annotations

import base64
from contextlib import ExitStack, contextmanager
import json
import os
import queue
import re
import secrets
import string
import subprocess
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional
from urllib.parse import quote, urlparse

from ..util import detached_popen_kwargs, flock_exclusive, is_loopback_url, kill_process_group, resolve_argv
from .base import AdapterEvent, BackendAdapter, DeliveryClass, SteerResult


class _LoopbackRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not is_loopback_url(newurl):
            raise urllib.error.HTTPError(newurl, code, "refusing non-loopback redirect target", headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _build_loopback_opener():
    return urllib.request.build_opener(_LoopbackRedirectHandler)


def _startup_lock_path(binary: str, cwd: str, env: Dict[str, str]) -> Optional[Path]:
    """All Porch processes targeting one OpenCode database share this lock."""
    # Channel builds can select a different default database. Ask the same
    # binary that will serve, instead of guessing its build-time channel.
    try:
        result = subprocess.run(resolve_argv([binary, "debug", "paths", "db"], cwd=cwd),
                                cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                text=True, encoding="utf-8", timeout=30, check=True)
    except (OSError, subprocess.SubprocessError) as exc:
        raise RuntimeError("could not determine the OpenCode 2 database path") from exc
    path = result.stdout.strip()
    if path == ":memory:":
        return None
    elif not path or "\n" in path or not Path(path).is_absolute():
        raise RuntimeError("OpenCode 2 returned an invalid database path")
    else:
        db = Path(path).resolve()
    if db.is_dir():
        raise RuntimeError("OpenCode 2 database path is a directory, not a database file")
    db.parent.mkdir(parents=True, exist_ok=True)
    # A directory-wide lock also covers case-insensitive filename aliases.
    return db.parent / ".porch-opencode-locks" / "startup.lock"


@contextmanager
def _startup_lock(path: Optional[Path], timeout: float = 120.0) -> Iterator[None]:
    """Bound lock contention without changing the shared lock helper's semantics."""
    if path is None:
        yield
        return
    deadline = time.monotonic() + timeout
    with ExitStack() as stack:
        while True:
            try:
                stack.enter_context(flock_exclusive(path, blocking=False))
                break
            except BlockingIOError:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError("timed out waiting for OpenCode database startup lock")
                time.sleep(min(.05, remaining))
        yield


class OpenCodeAdapter(BackendAdapter):
    backend_name = "opencode"
    auto_delivery = DeliveryClass.STEP_INJECT

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.proc: Optional[subprocess.Popen] = None
        self.base_url: Optional[str] = None
        self._events: queue.Queue[AdapterEvent] = queue.Queue()
        self._raw_path = Path(self.artifacts_dir) / "raw" / f"{self.agent_id or 'opencode'}.jsonl"
        self._server_username = "opencode"
        self._server_password = secrets.token_urlsafe(32)
        self._opener = _build_loopback_opener()
        self._lock = threading.RLock()
        self._ready = threading.Event()
        self._stdio_threads: List[threading.Thread] = []
        self._sse_thread: Optional[threading.Thread] = None
        self._reconciler_thread: Optional[threading.Thread] = None
        self._busy = False
        self._cancelled = False
        self._replacement_pending = False
        self._ignore_interrupt_once = False
        self._pending: set[str] = set()
        self._generation = 0
        self._first_prompt: Optional[str] = None
        self._last_prompt: Optional[str] = None
        self._started_at: Optional[int] = None
        self._parts: Dict[str, str] = {}
        self._part_order: List[str] = []
        self._tools: Dict[str, Dict[str, Any]] = {}
        self._reconciler_running = False
        self._child_sessions: set[str] = set()
        self._id_millis = 0
        self._id_counter = 0

    def _auth_header_value(self) -> str:
        token = base64.b64encode(f"opencode:{self._server_password}".encode()).decode("ascii")
        return f"Basic {token}"

    def _auth_headers(self, extra=None):
        return {**(extra or {}), "Authorization": self._auth_header_value()}

    def _argv(self) -> List[str]:
        return [self.binary, "serve", "--hostname", "127.0.0.1", "--port", "0"]

    def _child_env(self) -> Dict[str, str]:
        env = os.environ.copy()
        env.pop("OPENCODE_SERVER_PASSWORD", None)
        env["OPENCODE_PASSWORD"] = self._server_password
        return env

    def _model_ref(self) -> Dict[str, str]:
        provider, sep, model = self.model.partition("/")
        if not sep or not provider or not model or "#" in self.model:
            raise ValueError("OpenCode 2 model must be provider/model; configure effort separately")
        result = {"providerID": provider, "id": model}
        if self.effort:
            result["variant"] = self.effort
        return result

    def _start_server(self) -> None:
        self._raw_path.parent.mkdir(parents=True, exist_ok=True)
        # OpenCode 2's schema bootstrap lock is process-local. Keep independent
        # servers from migrating the same SQLite database at the same time.
        lock_path = _startup_lock_path(self.binary, self.cwd, self._child_env())
        with _startup_lock(lock_path):
            try:
                self.proc = subprocess.Popen(resolve_argv(self._argv(), cwd=self.cwd), stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=self.cwd, env=self._child_env(),
                    text=True, encoding="utf-8", bufsize=1, **detached_popen_kwargs())
                for name in ("stdout", "stderr"):
                    thread = threading.Thread(target=self._read_stdio_for_url, args=(name,), daemon=True)
                    self._stdio_threads.append(thread)
                    thread.start()
                deadline = time.monotonic() + 30
                while not self.base_url and time.monotonic() < deadline:
                    if self.proc.poll() is not None:
                        raise RuntimeError("OpenCode 2 server exited before publishing its URL; check its configuration and database")
                    time.sleep(.05)
                if not self.base_url:
                    raise RuntimeError("OpenCode 2 server did not publish its URL")
                info = self._http_json("GET", "/api/info", timeout=10)
                version = info.get("version") if isinstance(info, dict) else None
                match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)(?:\+[0-9A-Za-z.-]+)?", version) if isinstance(version, str) else None
                if not match or int(match.group(1)) != 2 or tuple(map(int, match.groups())) < (2, 2, 6):
                    raise RuntimeError(f"OpenCode 2.2.6 or newer in the 2.x series is required (server reported {version!r})")
            except BaseException as startup_error:
                # Do not let another process migrate while this child is alive.
                try:
                    self.cancel()
                except Exception as cleanup_error:
                    raise RuntimeError(
                        f"OpenCode startup failed ({startup_error}); server cleanup also failed "
                        f"({cleanup_error}), so it may still be running"
                    ) from cleanup_error
                raise

    def start(self, task: str) -> None:
        self._start_server()
        result = self._http_json("POST", "/api/session", body={
            "location": {"directory": self.cwd}, "agent": "build", "model": self._model_ref(),
        }, timeout=30)
        session = result.get("data") if isinstance(result, dict) else None
        self.session_id = session.get("id") if isinstance(session, dict) else None
        if not self.session_id:
            raise RuntimeError("OpenCode 2 returned an invalid session")
        self._child_sessions.add(self.session_id)
        self._sse_thread = threading.Thread(target=self._sse_loop, daemon=True)
        self._sse_thread.start()
        if not self._ready.wait(30) or self._error:
            raise RuntimeError(self._error or "OpenCode 2 event subscription timed out")
        self._send_prompt(task, "initial", "steer")

    def _read_stdio_for_url(self, name: str) -> None:
        assert self.proc
        stream = self.proc.stdout if name == "stdout" else self.proc.stderr
        assert stream
        for line in stream:
            line = line.rstrip("\n")
            # Server diagnostics may contain provider credentials. Drain them
            # without persisting them; the listening URL is emitted on stdout.
            if name == "stdout":
                self._maybe_set_url(line)

    def _maybe_set_url(self, line: str) -> None:
        if self.base_url:
            return
        match = re.search(r"listening on (https?://[^\s]+)", line, re.I)
        if not match:
            return
        url = match.group(1).rstrip("/")
        if not is_loopback_url(url):
            self._fail("refusing non-loopback OpenCode server URL")
            return
        parsed = urlparse(url)
        self.base_url = f"{parsed.scheme}://{parsed.netloc}"

    def _log_raw(self, obj: Any) -> None:
        if isinstance(obj, dict):
            obj = {k: v for k, v in obj.items() if k not in
                   ("password", "OPENCODE_PASSWORD", "OPENCODE_SERVER_PASSWORD", "Authorization", "authorization")}
        encoded = json.dumps(obj, ensure_ascii=False).replace(self._server_password, "<redacted>")
        with open(self._raw_path, "a", encoding="utf-8") as f:
            f.write(encoded + "\n")

    def _assert_loopback_url(self, url: str) -> None:
        if not is_loopback_url(url):
            raise RuntimeError(f"refusing non-loopback OpenCode URL: {url}")

    def _http_json(self, method: str, path: str, body=None, timeout: float = 60.0, expect_empty=False):
        assert self.base_url
        url = self.base_url + path
        self._assert_loopback_url(url)
        headers = self._auth_headers({"Accept": "application/json"})
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        self._log_raw({"http": method, "url": url, "body": body})
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with self._opener.open(req, timeout=timeout) as resp:
                raw = resp.read()
                if expect_empty or not raw:
                    return {"status": resp.status}
                try:
                    return json.loads(raw.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    raise RuntimeError(f"invalid OpenCode 2 JSON response to {method} {path}") from exc
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code} {method} {path}: {detail}") from exc

    def _message_id(self) -> str:
        alphabet = string.ascii_letters + string.digits
        with self._lock:
            millis = int(time.time() * 1000)
            self._id_counter = self._id_counter + 1 if millis == self._id_millis else 1
            self._id_millis = millis
            timestamp = (millis * 4096 + self._id_counter) & ((1 << 48) - 1)
        return "msg_" + f"{timestamp:012x}" + "".join(secrets.choice(alphabet) for _ in range(14))

    def _send_prompt(self, text: str, client_id: str, delivery: str) -> None:
        assert self.session_id
        mid = self._message_id()
        with self._lock:
            self._generation += 1
            self._pending.add(mid)
            self._busy = True
            self._last_prompt = mid
            if self._first_prompt is None:
                self._first_prompt = mid
        payload = {"id": mid, "text": text, "delivery": delivery, "metadata": {"clientId": client_id}}
        result = self._http_json("POST", f"/api/session/{quote(self.session_id, safe='')}/prompt", body=payload, timeout=30)
        item = result.get("data") if isinstance(result, dict) else None
        if not isinstance(item, dict) or item.get("id") != mid:
            raise RuntimeError("OpenCode 2 prompt admission returned an invalid message ID")
        with self._lock:
            if self._started_at is None:
                created = item.get("time", {}).get("created")
                if not isinstance(created, (int, float)):
                    raise RuntimeError("OpenCode 2 prompt admission omitted creation time")
                self._started_at = int(created)
            self._replacement_pending = False

    def _abort(self) -> None:
        if not self.session_id:
            return
        try:
            result = self._http_json("POST", f"/api/session/{quote(self.session_id, safe='')}/interrupt", timeout=15)
            if not isinstance(result, dict) or not isinstance(result.get("interrupted"), bool):
                raise RuntimeError("invalid interrupt response")
            if not result["interrupted"]:
                with self._lock:
                    self._ignore_interrupt_once = False
        except Exception as exc:
            raise RuntimeError(f"OpenCode interrupt outcome unknown: {exc}") from exc

    def _runner_is_idle(self, timeout: float = 5.0) -> bool:
        result = self._http_json("GET", "/api/session/active", timeout=timeout)
        active = result.get("data") if isinstance(result, dict) else None
        if not isinstance(active, dict):
            raise RuntimeError("invalid OpenCode 2 active session map")
        return self.session_id not in active

    def _wait_for_abort_idle(self, timeout: float = 15.0) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self._runner_is_idle(timeout=min(5, max(.1, deadline - time.monotonic()))):
                return
            time.sleep(.1)
        raise RuntimeError("OpenCode interrupt outcome unknown: session did not become idle")

    def _fail(self, message: str, raw=None) -> None:
        with self._lock:
            if self._done:
                return
            self._error, self._exit_code, self._done = message, 1, True
        self._events.put(AdapterEvent(kind="error", data=message, raw=raw))
        self._events.put(AdapterEvent(kind="done", data="error", raw=raw))
        self._ready.set()

    def _sse_loop(self) -> None:
        assert self.base_url
        url = self.base_url + "/api/event"
        self._assert_loopback_url(url)
        try:
            req = urllib.request.Request(url, headers=self._auth_headers({"Accept": "text/event-stream"}))
            resp = self._opener.open(req, timeout=30)
            try:
                # A healthy inference can exceed the connection timeout.
                resp.fp.raw._sock.settimeout(None)
            except AttributeError:
                pass
            lines: List[str] = []
            try:
                while not self._done:
                    line = resp.readline()
                    if not line:
                        break
                    if isinstance(line, bytes):
                        line = line.decode("utf-8", errors="replace")
                    line = line.rstrip("\r\n")
                    if not line:
                        if lines:
                            self._handle_sse_block("\n".join(lines))
                            lines = []
                    elif line.startswith("data:"):
                        lines.append(line[5:].lstrip(" "))
            finally:
                resp.close()
            if not self._done:
                self._fail("OpenCode 2 event stream disconnected before completion")
        except Exception as exc:
            if not self._done:
                self._fail(f"OpenCode 2 event stream failed: {exc}")

    def _handle_sse_block(self, block: str) -> None:
        self._log_raw({"sse": block})
        try:
            obj = json.loads(block)
            if not isinstance(obj, dict):
                raise ValueError("event is not an object")
            self._handle_event(obj)
        except (json.JSONDecodeError, ValueError) as exc:
            self._fail(f"invalid OpenCode 2 event: {exc}")

    def _handle_event(self, obj: Dict[str, Any]) -> None:
        typ, data = obj.get("type"), obj.get("data")
        if typ == "server.connected":
            self._ready.set()
            return
        if not isinstance(data, dict):
            return
        if typ == "session.created":
            with self._lock:
                if data.get("parentID") in self._child_sessions and data.get("sessionID"):
                    self._child_sessions.add(str(data["sessionID"]))
            return
        if typ == "form.created" and isinstance(data.get("form"), dict):
            form_session = data["form"].get("sessionID")
            location = obj.get("location") if isinstance(obj.get("location"), dict) else {}
            if form_session == self.session_id or form_session in self._child_sessions or (form_session == "global" and location.get("directory") == self.cwd):
                self._fail("input_required: " + json.dumps(data, ensure_ascii=False), obj)
            return
        if data.get("sessionID") != self.session_id and data.get("sessionID") not in self._child_sessions:
            return
        if typ == "session.inbox.delivered" and data.get("sessionID") == self.session_id:
            with self._lock:
                self._pending.discard(str(data.get("inboxID")))
            return
        if typ == "permission.asked":
            detail = {"request_id": data.get("id"), "permission": data.get("action"),
                      "patterns": data.get("resources"), "command": (data.get("metadata") or {}).get("command")}
            self._fail("permission_required: " + json.dumps(detail, ensure_ascii=False), obj)
            return
        if data.get("sessionID") != self.session_id:
            return
        if typ in ("session.text.delta", "session.text.ended"):
            key = f"{data.get('assistantMessageID')}:{data.get('ordinal')}"
            value = data.get("delta") if typ.endswith("delta") else data.get("text")
            if not isinstance(value, str):
                return
            with self._lock:
                if key not in self._parts:
                    self._part_order.append(key)
                    self._parts[key] = ""
                previous = self._parts[key]
                self._parts[key] = previous + value if typ.endswith("delta") else value
            delta = value if typ.endswith("delta") else (value[len(previous):] if value.startswith(previous) else "")
            if delta:
                self._events.put(AdapterEvent(kind="text", data=delta, raw=obj))
            return
        if typ in ("session.tool.input.started", "session.tool.called", "session.tool.success", "session.tool.failed"):
            call_id = str(data.get("id") or "")
            detail = self._tools.setdefault(call_id, {"call_id": call_id})
            if typ == "session.tool.input.started":
                detail["tool"] = data.get("name")
                return
            if typ == "session.tool.called":
                detail.update({"status": "running", "input": data.get("input")})
                kind = "tool_started"
            else:
                detail["status"] = "completed" if typ.endswith("success") else "error"
                kind = "tool_completed"
            self._events.put(AdapterEvent(kind=kind, data=json.dumps(detail, ensure_ascii=False), raw=obj))
            return
        if typ in ("session.execution.failed", "session.execution.interrupted"):
            with self._lock:
                replacing = typ == "session.execution.interrupted" and self._ignore_interrupt_once
                if replacing:
                    self._ignore_interrupt_once = False
            if not replacing:
                self._fail("OpenCode execution failed: " + json.dumps(data, ensure_ascii=False), obj)
            return
        if typ == "session.execution.succeeded":
            self._events.put(AdapterEvent(kind="turn_completed", data=typ, raw=obj))
            with self._lock:
                if self._reconciler_running:
                    return
                self._reconciler_running = True
                self._reconciler_thread = threading.Thread(target=self._reconcile, daemon=True)
                self._reconciler_thread.start()
            return
        self._events.put(AdapterEvent(kind="progress", data=str(typ or "event"), raw=obj))

    def _history(self) -> List[Dict[str, Any]]:
        assert self.session_id
        path = f"/api/session/{quote(self.session_id, safe='')}/message?limit=200&order=asc"
        messages: List[Dict[str, Any]] = []
        seen_cursors: set[str] = set()
        while True:
            page = self._http_json("GET", path, timeout=30)
            if not isinstance(page, dict) or not isinstance(page.get("data"), list) or not isinstance(page.get("cursor"), dict):
                raise RuntimeError("invalid OpenCode 2 message page")
            messages.extend(page["data"])
            cursor = page["cursor"].get("next")
            if not cursor:
                return messages
            if not isinstance(cursor, str) or cursor in seen_cursors:
                raise RuntimeError("invalid or repeated OpenCode 2 history cursor")
            seen_cursors.add(cursor)
            path = f"/api/session/{quote(self.session_id, safe='')}/message?limit=200&cursor={quote(cursor, safe='')}"

    def _reconcile(self) -> None:
        try:
            while not self._done:
                with self._lock:
                    generation = self._generation
                    first_prompt, last_prompt = self._first_prompt, self._last_prompt
                    if self._replacement_pending or self._pending or self._started_at is None:
                        waiting = True
                    else:
                        waiting = False
                if waiting:
                    time.sleep(.1)
                    continue
                assert self.session_id
                sid = quote(self.session_id, safe="")
                jobs_result = self._http_json("GET", f"/api/experimental/job?sessionID={sid}&descendants=true", timeout=10)
                jobs = jobs_result.get("data") if isinstance(jobs_result, dict) else None
                if not isinstance(jobs, list):
                    raise RuntimeError("invalid OpenCode 2 background job list")
                running = [job for job in jobs if isinstance(job, dict) and
                           (job.get("time") or {}).get("started", 0) >= self._started_at]
                for job in running:
                    with self._lock:
                        self._child_sessions.add(str(job.get("sessionID") or self.session_id))
                        if job.get("childSessionID"):
                            self._child_sessions.add(str(job["childSessionID"]))
                if running:
                    time.sleep(.25)
                    continue
                pending = False
                with self._lock:
                    children = list(self._child_sessions)
                for child in children:
                    inbox = self._http_json("GET", f"/api/session/{quote(child, safe='')}/inbox", timeout=10)
                    if not isinstance(inbox, dict) or not isinstance(inbox.get("data"), list):
                        raise RuntimeError("invalid OpenCode 2 inbox")
                    pending = pending or bool(inbox["data"])
                active = self._http_json("GET", "/api/session/active", timeout=10)
                if not isinstance(active, dict) or not isinstance(active.get("data"), dict):
                    raise RuntimeError("invalid OpenCode 2 active sessions")
                if pending or any(child in active["data"] for child in children):
                    time.sleep(.25)
                    continue
                messages = self._history()
                first = next((i for i, msg in enumerate(messages) if msg.get("id") == first_prompt), None)
                last = next((i for i, msg in enumerate(messages) if msg.get("id") == last_prompt), None)
                if first is None or last is None:
                    raise RuntimeError("OpenCode 2 history does not contain the admitted prompt")
                relevant = messages[first + 1:]
                idle = next((msg for msg in reversed(messages[last + 1:]) if msg.get("type") == "idle"), None)
                if not idle:
                    time.sleep(.1)
                    continue
                if idle.get("outcome") != "succeeded":
                    raise RuntimeError("OpenCode 2 recorded unsuccessful completion: " + json.dumps(idle))
                final = []
                for message in relevant:
                    if message.get("type") == "assistant":
                        for part in message.get("content") or []:
                            if isinstance(part, dict) and part.get("type") == "text" and isinstance(part.get("text"), str):
                                final.append(part["text"])
                with self._lock:
                    if generation != self._generation or self._pending or self._replacement_pending:
                        continue
                    self._parts = {"history": "".join(final)}
                    self._part_order = ["history"]
                    self._busy, self._done, self._exit_code = False, True, 0
                self._events.put(AdapterEvent(kind="done", data="completed"))
                return
        except Exception as exc:
            self._fail(f"cannot confirm OpenCode 2 completion: {exc}")
        finally:
            with self._lock:
                self._reconciler_running = False

    def poll_events(self) -> Iterator[AdapterEvent]:
        if self.proc and self.proc.poll() is not None and not self._done:
            self._fail(f"OpenCode 2 server exited unexpectedly: {self.proc.returncode}")
        while True:
            try:
                yield self._events.get_nowait()
            except queue.Empty:
                break

    def is_busy(self) -> bool:
        with self._lock:
            return self._busy and not self._done

    def _queue_class(self) -> DeliveryClass:
        return DeliveryClass.QUEUE_NEXT_TURN

    def _interrupt_class(self) -> DeliveryClass:
        return DeliveryClass.ABORT_AND_PROMPT

    def steer(self, content: str, mode: str, client_id: str) -> SteerResult:
        if self._done or not self.session_id:
            return SteerResult(ok=False, delivery_class=self.auto_delivery, status="rejected", error="backend not ready or completed")
        dclass = self.map_mode(mode)
        try:
            if mode == "interrupt":
                with self._lock:
                    self._replacement_pending = True
                    self._ignore_interrupt_once = True
                self._abort()
                self._wait_for_abort_idle()
                with self._lock:
                    pending = list(self._pending)
                for mid in pending:
                    self._http_json("DELETE", f"/api/session/{quote(self.session_id, safe='')}/inbox/{quote(mid, safe='')}", timeout=15)
                    with self._lock:
                        self._pending.discard(mid)
                with self._lock:
                    self._first_prompt = None
                    self._parts.clear()
                    self._part_order.clear()
                self._send_prompt(content, client_id, "steer")
            else:
                self._send_prompt(content, client_id, "queue" if mode == "queue" else "steer")
        except Exception as exc:
            self._fail(str(exc))
            return SteerResult(ok=False, delivery_class=dclass, status="failed", error=str(exc))
        return SteerResult(ok=True, delivery_class=dclass, status="request_sent", evidence="prompt_admitted")

    def child_pid(self) -> Optional[int]:
        return self.proc.pid if self.proc else None

    def cancel(self) -> None:
        self._cancelled = True
        if not self._done:
            try:
                self._abort()
            except Exception:
                pass
        self._done = True
        if self.proc and self.proc.poll() is None:
            kill_process_group(self.proc.pid, timeout=3.0, process=self.proc)
        if self.proc:
            self.proc.wait(timeout=3.0)
            for thread in self._stdio_threads:
                thread.join(timeout=1.0)
            for stream in (self.proc.stdout, self.proc.stderr):
                if stream:
                    stream.close()
        if self._sse_thread:
            self._sse_thread.join(timeout=5.0)
            if self._sse_thread.is_alive():
                raise RuntimeError("OpenCode event reader did not stop during cleanup")
        with self._lock:
            reconciler = self._reconciler_thread
        if reconciler:
            reconciler.join(timeout=35.0)
            if reconciler.is_alive():
                raise RuntimeError("OpenCode completion reader did not stop during cleanup")

    def final_text(self) -> str:
        with self._lock:
            return "".join(self._parts[k] for k in self._part_order)

    def close(self) -> None:
        self.cancel()
