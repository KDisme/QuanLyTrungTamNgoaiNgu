// exceptions/ConflictException.js
const CustomError = require('./CustomError');

class ConflictException extends CustomError {
  constructor(message = 'Dữ liệu đã tồn tại') {
    super(message, 409);
    this.name = 'ConflictException';
  }
}

module.exports = ConflictException;
