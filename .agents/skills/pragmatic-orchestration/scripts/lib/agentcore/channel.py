"""Typed guest channel. Cloud signing/lifecycle are supplied at the outer boundary."""
from __future__ import annotations


class UnknownRunnerOutcome(RuntimeError):
    """Request may have executed. Reconcile its identity; never retry as new work."""


class RunnerChannel:
    def __init__(self, session_id, invoke):
        self.session_id = session_id
        self.invoke = invoke
        self.boot_id = None

    def ready(self):
        response = self.invoke({"protocol": 1, "session_id": self.session_id, "operation": "ready"})
        self._validate(response)
        if not isinstance(response.get("boot_id"), str) or not response["boot_id"]:
            raise UnknownRunnerOutcome("guest did not identify its boot")
        if self.boot_id is not None and response["boot_id"] != self.boot_id:
            raise UnknownRunnerOutcome("guest boot changed; reconcile the existing task")
        self.boot_id = response["boot_id"]
        return response

    def request(self, operation, body):
        if self.boot_id is None:
            raise ValueError("establish the claimed environment with ready before sending work")
        if operation not in {"launch", "control", "reconcile"}:
            raise ValueError("unsupported runner operation")
        response = self.invoke({"protocol": 1, "session_id": self.session_id,
                                "boot_id": self.boot_id, "operation": operation, "body": body})
        self._validate(response)
        if response.get("boot_id") != self.boot_id:
            raise UnknownRunnerOutcome("guest response belongs to another boot")
        if "exit_code" not in response:
            raise UnknownRunnerOutcome("guest did not confirm a command outcome")
        return response

    def _validate(self, response):
        if not isinstance(response, dict) or response.get("protocol") != 1 or response.get("session_id") != self.session_id:
            raise UnknownRunnerOutcome("guest response identity is unavailable or mismatched")
