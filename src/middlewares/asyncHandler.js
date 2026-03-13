/**
 * Async Handler Wrapper
 * Bao bọc async route handlers để tự động catch lỗi
 * Giúp tránh việc phải viết try-catch trong mỗi handler
 * 
 * @param {Function} fn - Async function (request handler)
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
