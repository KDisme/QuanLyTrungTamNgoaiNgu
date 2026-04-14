// exceptions/ValidationException.js
const CustomError = require('./CustomError');

class ValidationException extends CustomError {
  constructor(message = 'Dữ liệu không hợp lệ', errors = []) {
    super(message, 422);
    this.name = 'ValidationException';
    this.errors = errors;
  }
}

module.exports = ValidationException;
