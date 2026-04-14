// exceptions/BadRequestException.js
const CustomError = require('./CustomError');

class BadRequestException extends CustomError {
  constructor(message = 'Yêu cầu không hợp lệ') {
    super(message, 400);
    this.name = 'BadRequestException';
  }
}

module.exports = BadRequestException;
