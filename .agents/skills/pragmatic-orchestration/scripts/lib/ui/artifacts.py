"""Bounded normalized journal reads with stateless, append-safe byte cursors."""
from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path
import tempfile

from events import KNOWN_EVENT_TYPES

PAGE_BYTES = 512 * 1024
TAIL_BYTES = 128 * 1024
MAX_LINE_BYTES = 8 * 1024 * 1024
MAX_FINAL_BYTES = 2 * 1024 * 1024
EVENT_FIELDS = ("ts", "type", "backend", "agent_id", "data", "tool_name", "tool_id",
                "steer_client_id", "steer_status", "delivery_class", "seq")


class ObservationError(Exception):
    pass


def open_artifact(path: Path):
    if path.is_symlink() or path.parent.is_symlink():
        raise ObservationError("Symlink artifacts are not served")
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    return os.fdopen(descriptor, "rb")


def anchor(stream, offset):
    stream.seek(max(0, offset - 64))
    return hashlib.sha256(stream.read(min(64, offset))).hexdigest()[:24]


def encode_cursor(stream, stat, offset):
    body = [stat.st_dev, stat.st_ino, offset, anchor(stream, offset)]
    return base64.urlsafe_b64encode(json.dumps(body).encode()).decode().rstrip("=")


def decode_cursor(cursor):
    try:
        if len(cursor) > 512:
            raise ValueError()
        body = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
        dev, inode, offset, checksum = body
        if any(type(n) is not int or n < 0 for n in (dev, inode, offset)):
            raise ValueError()
        if not isinstance(checksum, str):
            raise ValueError()
        return dev, inode, offset, checksum
    except (ValueError, TypeError) as error:
        raise ObservationError("Invalid output cursor") from error


def initial_offset(stream, size):
    offset = max(0, size - TAIL_BYTES)
    if offset:
        stream.seek(offset - 1)
        if stream.read(1) != b"\n":
            # Find a preceding line boundary, retaining even a large last event.
            start = max(0, offset - MAX_LINE_BYTES)
            stream.seek(start)
            prefix = stream.read(offset - start)
            boundary = prefix.rfind(b"\n")
            if boundary < 0 and start:
                raise ObservationError("Event exceeds the 8 MiB display limit; save the journal")
            offset = start + boundary + 1 if boundary >= 0 else 0
    return offset


def cursor_offset(stream, stat, cursor):
    if cursor == "start":
        return 0, False
    if not cursor:
        return initial_offset(stream, stat.st_size), False
    dev, inode, offset, checksum = decode_cursor(cursor)
    reset = ((dev, inode) != (stat.st_dev, stat.st_ino) or offset > stat.st_size
             or anchor(stream, offset) != checksum)
    return (initial_offset(stream, stat.st_size), True) if reset else (offset, False)


def read_events(path: Path, cursor=""):
    try:
        stream = open_artifact(path)
    except FileNotFoundError:
        return dict(events=[], next_cursor="", reset=bool(cursor and cursor != "start"),
                    earlier_omitted=False, has_more=False, available=False)
    with stream:
        stat = os.fstat(stream.fileno())
        offset, reset = cursor_offset(stream, stat, cursor)
        start = offset
        stream.seek(offset)
        events = []
        while len(events) < 200 and offset - start < PAGE_BYTES:
            line = stream.readline(MAX_LINE_BYTES + 1)
            if len(line) > MAX_LINE_BYTES:
                raise ObservationError("Event exceeds the 8 MiB display limit; save the journal")
            if not line or not line.endswith(b"\n"):
                break  # Do not acknowledge bytes that the writer has not completed.
            try:
                record = json.loads(line)
                if not isinstance(record, dict) or record.get("type") not in KNOWN_EVENT_TYPES:
                    raise ValueError("unknown event type")
            except (ValueError, UnicodeDecodeError) as error:
                raise ObservationError(f"Invalid normalized event at byte {offset}: {error}") from error
            event = project_event(record)
            event["id"] = f"{stat.st_dev}:{stat.st_ino}:{offset}"
            events.append(event)
            offset += len(line)
        return dict(events=events, next_cursor=encode_cursor(stream, stat, offset), reset=reset,
                    earlier_omitted=start > 0 and (not cursor or reset), available=True,
                    has_more=offset < stat.st_size and bool(events))


def project_event(record):
    event = {key: record[key] for key in EVENT_FIELDS if key in record}
    if "data" in event and not isinstance(event["data"], str):
        event["data"] = json.dumps(event["data"], ensure_ascii=False)
    return event


def export_events(path):
    """Snapshot to a private temporary file, excluding raw provider payloads.

    Validate before sending HTTP headers so corrupt journals cannot look like
    successful partial downloads. Memory stays bounded even for long sessions.
    """
    output = tempfile.TemporaryFile()
    try:
        with open_artifact(path) as stream:
            remaining = os.fstat(stream.fileno()).st_size
            while remaining:
                line = stream.readline(min(remaining, MAX_LINE_BYTES + 1))
                remaining -= len(line)
                if len(line) > MAX_LINE_BYTES:
                    raise ObservationError("An event exceeds the 8 MiB export limit")
                if not line or not line.endswith(b"\n"):
                    break
                try:
                    record = json.loads(line)
                    if not isinstance(record, dict) or record.get("type") not in KNOWN_EVENT_TYPES:
                        raise ValueError("unknown event type")
                except (ValueError, UnicodeDecodeError) as error:
                    raise ObservationError(f"Invalid normalized journal: {error}") from error
                output.write((json.dumps(project_event(record), ensure_ascii=False) + "\n").encode())
        output.seek(0)
        return output
    except BaseException:
        output.close()
        raise


def read_final(paths):
    for path in paths:
        try:
            with open_artifact(path) as stream:
                body = stream.read(MAX_FINAL_BYTES + 1)
            return dict(text=body[:MAX_FINAL_BYTES].decode("utf-8", errors="replace"),
                        truncated=len(body) > MAX_FINAL_BYTES, available=True)
        except FileNotFoundError:
            continue
    return dict(text="", truncated=False, available=False)
