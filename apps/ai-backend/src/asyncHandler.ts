import type { NextFunction, Request, RequestHandler, Response } from 'express'

// Express 4 does not catch a rejected promise thrown from an async route
// handler — it becomes an unhandled rejection and the request just hangs
// instead of returning an error response. Wrapping every async handler in
// this forwards the rejection to next(err), which Express's own error
// handling (or a custom error middleware) can actually respond to.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next)
  }
}
