export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

export function asyncHandler(handler) {
  return function handleAsync(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof SyntaxError && error.status === 400 && Object.hasOwn(error, "body")) {
    res.status(400).json({ error: "Invalid request." });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error(error.message);
  res.status(500).json({ error: "Internal server error" });
}
