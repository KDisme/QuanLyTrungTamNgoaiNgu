/**
 * Custom API Error Class
 * Để quản lý lỗi một cách có cấu trúc với error codes
 */
class ApiError extends Error {
  constructor(statusCode, message, errorCode = null, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    this.success = false;
  }

  /**
   * Serialize error response
   */
  toJSON() {
    return {
      success: false,
      message: this.message,
      errorCode: this.errorCode,
      ...(this.errors && { errors: this.errors }),
    };
  }
}

module.exports = ApiError;
