// exceptions/UnauthorizedException.js
const CustomError = require('./CustomError');

class UnauthorizedException extends CustomError {
  constructor(message = 'Chưa xác thực') {
    super(message, 401);
    this.name = 'UnauthorizedException';
  }
}

module.exports = UnauthorizedException;
