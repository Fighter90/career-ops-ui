/**
 * Express 4 does not await a route handler. An `async` handler that throws (or a
 * handler that returns a rejecting promise) therefore never reaches the error
 * middleware: it becomes an unhandled rejection, and on Node >= 15 that exits the
 * whole server — one malformed request body ends every scan in flight.
 *
 * `installAsyncRouteSafety()` patches Layer.prototype.handle_request once so a
 * returned promise that rejects is forwarded to `next(err)`, which lands in the
 * global JSON error handler. Idempotent; handlers that return nothing are
 * untouched.
 */
import Layer from 'express/lib/router/layer.js';

const MARK = Symbol.for('career-ops-ui.asyncRouteSafety');

export function installAsyncRouteSafety() {
  const proto = Layer.prototype;
  if (proto[MARK]) return false;
  const original = proto.handle_request;
  proto.handle_request = function handleRequest(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next(); // error-handling middleware: not ours to call here
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === 'function') out.then(undefined, next);
    } catch (err) {
      next(err);
    }
  };
  proto[MARK] = original;
  return true;
}
