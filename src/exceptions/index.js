/**
 * Centralized exception exports
 */
module.exports = {
  ApiError: require('./ApiError'),
  ConflictException: require('./ConflictException'),
  NotFoundException: require('./NotFoundException'),
  UnauthorizedException: require('./UnauthorizedException'),
  ValidationException: require('./ValidationException'),
};
