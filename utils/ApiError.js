/**
 * Standardized application error. Thrown from controllers/middleware and
 * caught by the global error handler, which uses `statusCode` to shape
 * the HTTP response.
 */
class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.success = false;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
