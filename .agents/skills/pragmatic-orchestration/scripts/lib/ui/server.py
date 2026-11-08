"""Loopback HTTP boundary for the optional UI; all routes are read-only."""
from __future__ import annotations

import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import secrets
from urllib.parse import parse_qs, unquote, urlsplit

from steer.registry import RegistryError
from .artifacts import ObservationError, export_events, open_artifact
from .observer import Observer

CSP = ("default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; "
       "img-src 'self' data:; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; "
       "form-action 'none'")


class ObserverServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, registry, assets, port, token):
        self.observer = Observer(registry)
        self.assets = assets.resolve()
        self.token = token or secrets.token_urlsafe(32)
        super().__init__(("127.0.0.1", port), Handler)
        self.origin = f"http://127.0.0.1:{self.server_port}"


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, *_):
        pass  # Do not log output or authentication material.

    def headers_for(self, status, content_type, length=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        if length is not None:
            self.send_header("Content-Length", str(length))

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.headers_for(status, "application/json; charset=utf-8", len(body))
        self.end_headers()
        self.wfile.write(body)

    def permitted(self, api):
        origin = self.server.origin
        if self.headers.get("Host") != urlsplit(origin).netloc:
            return False
        if self.headers.get("Origin", origin) != origin:
            return False
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            return False
        return not api or hmac.compare_digest(
            self.headers.get("Authorization", "").encode(), ("Bearer " + self.server.token).encode())

    def do_GET(self):
        url = urlsplit(self.path)
        api = url.path.startswith("/api/")
        try:
            if not self.permitted(api):
                self.send_json(403, {"error": "This local observer requires its launch URL"})
            elif api:
                self.api(url)
            else:
                self.static(url.path)
        except (RegistryError, ObservationError, ValueError) as error:
            self.send_json(400, {"error": str(error)})
        except FileNotFoundError:
            self.send_json(404, {"error": "Artifact is not available"})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except OSError as error:
            self.send_json(500, {"error": f"Observation failed: {error}"})

    def do_POST(self):
        self.send_json(405, {"error": "The observer is read-only"})

    def api(self, url):
        if url.path == "/api/runs":
            self.send_json(200, self.server.observer.runs())
            return
        parts = url.path.split("/")
        if len(parts) != 5 or parts[1:3] != ["api", "runs"]:
            self.send_json(404, {"error": "Unknown observer route"})
            return
        run_id, action = unquote(parts[3]), parts[4]
        query = parse_qs(url.query)
        observer = self.server.observer
        if action == "events":
            self.send_json(200, observer.events(run_id, query.get("cursor", [""])[0]))
        elif action == "final":
            self.send_json(200, observer.final(run_id))
        elif action == "download":
            kind = query.get("kind", ["events"])[0]
            if kind not in ("events", "final"):
                raise ObservationError("Unknown artifact kind")
            for path in observer.artifact_paths(run_id, kind):
                if path.exists():
                    if kind == "events":
                        with export_events(path) as stream:
                            self.send_stream(stream, "text/plain; charset=utf-8")
                    else:
                        self.send_file(path, "text/plain; charset=utf-8")
                    return
            raise FileNotFoundError()
        else:
            self.send_json(404, {"error": "Unknown observer route"})

    def send_file(self, path, content_type):
        with open_artifact(path) as stream:
            self.send_stream(stream, content_type)

    def send_stream(self, stream, content_type):
        remaining = os.fstat(stream.fileno()).st_size
        self.headers_for(200, content_type, remaining)
        self.end_headers()
        while remaining:
            chunk = stream.read(min(remaining, 64 * 1024))
            if not chunk:
                break
            self.wfile.write(chunk)
            remaining -= len(chunk)

    def static(self, route):
        path = (self.server.assets / ("index.html" if route == "/" else unquote(route).lstrip("/"))).resolve()
        if not path.is_relative_to(self.server.assets) or not path.is_file():
            self.send_json(404, {"error": "Page not found"})
            return
        content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
        self.send_file(path, content_type)


def create_server(registry, assets: Path, *, port=0, token=None):
    return ObserverServer(registry, assets, port, token)
