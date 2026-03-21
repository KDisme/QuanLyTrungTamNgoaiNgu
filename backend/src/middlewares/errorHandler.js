// middlewares/errorHandler.js
const CustomError = require('../exceptions/CustomError');
const ValidationException = require('../exceptions/ValidationException');

function errorHandler(err, req, res, next) {
  // Log lỗi ra console để debug
  console.error('Error:', err);

  // Xử lý ValidationException (có errors array)
  if (err instanceof ValidationException) {
    return res.status(err.status).json({
      message: err.message,
      errors: err.errors,
    });
  }

  // Xử lý các CustomError khác
  if (err instanceof CustomError) {
    return res.status(err.status).json({
      message: err.message,
    });
  }

  // Xử lý lỗi mặc định
  res.status(500).json({
    message: err.message || 'Lỗi hệ thống',
  });
}

module.exports = errorHandler;
