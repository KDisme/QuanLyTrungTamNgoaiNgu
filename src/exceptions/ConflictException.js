const ApiError = require('./ApiError');

/**
 * ConflictException - Lỗi xung đột dữ liệu (409)
 * Sử dụng khi dữ liệu đã tồn tại hoặc trùng lặp
 */
class ConflictException extends ApiError {
  constructor(message = 'Xung đột dữ liệu', errorCode = null, errors = null) {
    super(409, message, errorCode, errors);
    this.name = 'ConflictException';
  }
}

module.exports = ConflictException;
