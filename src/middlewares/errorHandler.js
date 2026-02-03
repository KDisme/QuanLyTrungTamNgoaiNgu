const ApiError = require('../exceptions/ApiError');

/**
 * Centralized Error Handling Middleware
 * @param {Error} error - Error object
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const errorHandler = (error, req, res, next) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors = null;

  // Handle custom ApiError
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    errors = error.errors;
  } else if (error instanceof Error) {
    // Handle standard JavaScript errors
    message = error.message;
  }

  // Log error (có thể sử dụng logging library như winston, bunyan, etc.)
  console.error(`[${statusCode}] ${message}`, error);

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};

module.exports = errorHandler;
