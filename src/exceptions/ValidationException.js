const ApiError = require('./ApiError');

/**
 * ValidationException - Lỗi xác nhận dữ liệu (422)
 * Sử dụng khi dữ liệu đầu vào không hợp lệ
 */
class ValidationException extends ApiError {
  constructor(message = 'Dữ liệu không hợp lệ', errorCode = null, errors = null) {
    super(422, message, errorCode, errors);
    this.name = 'ValidationException';
  }
}

module.exports = ValidationException;
