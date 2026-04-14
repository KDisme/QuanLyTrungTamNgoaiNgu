// middlewares/auth.js
// Middleware kiểm tra JWT

const jwt = require('jsonwebtoken');
const { UnauthorizedException } = require('../exceptions');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

function authenticate(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    throw new UnauthorizedException('Vui lòng đăng nhập');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
  }
}

module.exports = authenticate;
