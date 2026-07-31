/**
 * Wraps an async Express route handler and forwards any rejected promise
 * to the global error middleware, removing the need for repetitive
 * try/catch blocks in every controller.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
