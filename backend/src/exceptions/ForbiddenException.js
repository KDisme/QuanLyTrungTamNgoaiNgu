// exceptions/ForbiddenException.js
const CustomError = require('./CustomError');

class ForbiddenException extends CustomError {
  constructor(message = 'Không có quyền truy cập') {
    super(message, 403);
    this.name = 'ForbiddenException';
  }
}

module.exports = ForbiddenException;
