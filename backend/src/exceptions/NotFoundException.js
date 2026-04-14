// exceptions/NotFoundException.js
const CustomError = require('./CustomError');

class NotFoundException extends CustomError {
  constructor(message = 'Không tìm thấy tài nguyên') {
    super(message, 404);
    this.name = 'NotFoundException';
  }
}

module.exports = NotFoundException;
