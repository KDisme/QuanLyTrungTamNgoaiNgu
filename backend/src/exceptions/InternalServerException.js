// exceptions/InternalServerException.js
const CustomError = require('./CustomError');

class InternalServerException extends CustomError {
  constructor(message = 'Lỗi hệ thống') {
    super(message, 500);
    this.name = 'InternalServerException';
  }
}

module.exports = InternalServerException;
