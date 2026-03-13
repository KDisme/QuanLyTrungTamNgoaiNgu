const ApiError = require('./ApiError');

/**
 * UnauthorizedException - Lỗi xác thực thất bại (401)
 * Sử dụng khi mật khẩu sai, quyền không đủ, hoặc token không hợp lệ
 */
class UnauthorizedException extends ApiError {
  constructor(message = 'Xác thực thất bại', errorCode = null, errors = null) {
    super(401, message, errorCode, errors);
    this.name = 'UnauthorizedException';
  }
}

module.exports = UnauthorizedException;
