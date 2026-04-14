// exceptions/index.js
// Export tất cả exceptions để dễ import

const CustomError = require('./CustomError');
const BadRequestException = require('./BadRequestException');
const UnauthorizedException = require('./UnauthorizedException');
const ForbiddenException = require('./ForbiddenException');
const NotFoundException = require('./NotFoundException');
const ConflictException = require('./ConflictException');
const ValidationException = require('./ValidationException');
const InternalServerException = require('./InternalServerException');

module.exports = {
  CustomError,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  ValidationException,
  InternalServerException,
};
