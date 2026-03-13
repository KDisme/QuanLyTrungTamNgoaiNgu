const ApiError = require('../exceptions/ApiError');

/**
 * Centralized Error Handling Middleware
 * Xử lý tất cả loại lỗi: ApiError, ValidationError, DatabaseError, etc.
 * Trả về response có cấu trúc thống nhất với error codes
 * 
 * @param {Error} error - Error object
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const errorHandler = (error, req, res, next) => {
  let statusCode = 500;
  let message = 'Lỗi máy chủ nội bộ';
  let errorCode = null;
  let errors = null;

  // Handle custom ApiError
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    errorCode = error.errorCode;
    errors = error.errors;
  } else if (error instanceof Error) {
    // Handle standard JavaScript errors
    message = error.message || 'Lỗi không xác định';
  }

  // Log error for debugging
  console.error(`[${statusCode}] ${errorCode || 'UNKNOWN_ERROR'}: ${message}`, error);

  // Send error response
  const responseData = {
    success: false,
    message,
    ...(errorCode && { errorCode }),
    ...(errors && { errors }),
  };

  res.status(statusCode).json(responseData);
};

module.exports = errorHandler;
