const ApiError = require('./ApiError');

/**
 * NotFoundException - Lỗi không tìm thấy tài nguyên (404)
 * Sử dụng khi tài nguyên được yêu cầu không tồn tại
 */
class NotFoundException extends ApiError {
  constructor(message = 'Không tìm thấy tài nguyên', errorCode = null, errors = null) {
    super(404, message, errorCode, errors);
    this.name = 'NotFoundException';
  }
}

module.exports = NotFoundException;
