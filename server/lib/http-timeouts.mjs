/**
 * Keep-alive timeouts for running behind a reverse proxy (Caddy, nginx).
 *
 * Node closes an idle keep-alive socket after 5 s by default (plus a 1 s
 * buffer on Node 22). Caddy keeps idle upstream connections for up to
 * 2 min and reuses them. When the event
 * loop is busy (an in-process scan), Node's close lands on a socket Caddy
 * has just written a request into; the kernel answers RST and Caddy returns
 * 502 "read: connection reset by peer" — 62 of them on 2026-09-27 while the
 * hourly scan ran, with the process itself healthy.
 *
 * The proxy has to be the side that closes an idle connection, so the
 * server's idle timeout must outlast the proxy's.
 */
import { recordBindHost } from './security.mjs';

/** Longer than Caddy's 2-minute idle-connection default. */
export const KEEP_ALIVE_MS = 125_000;

export function applyProxyTimeouts(server, keepAliveMs = KEEP_ALIVE_MS) {
  server.keepAliveTimeout = keepAliveMs;
  // Must exceed keepAliveTimeout, or Node drops a reused socket that is
  // still waiting for its request headers.
  server.headersTimeout = keepAliveMs + 5_000;
  return server;
}

/**
 * `app.listen` with the proxy-safe timeouts; the server boot uses this. The
 * bind host is recorded for isPubliclyExposed(), which must follow the socket,
 * not a later edit of process.env.HOST.
 */
export function listen(app, port, host, onReady) {
  recordBindHost(host);
  return applyProxyTimeouts(app.listen(port, host, onReady));
}
