const jwt = require('jsonwebtoken');
const { UnauthorizedException } = require('../exceptions');

/**
 * Authentication Middleware
 * Kiểm tra JWT token trong Authorization header
 * Throw UnauthorizedException nếu token không hợp lệ
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Thiếu hoặc header xác thực không hợp lệ',
        'MISSING_TOKEN'
      );
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
      req.user = decoded;
      next();
    } catch (err) {
      if (err instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Token không hợp lệ', 'INVALID_TOKEN');
      } else if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token đã hết hạn', 'TOKEN_EXPIRED');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

module.exports = authMiddleware;
