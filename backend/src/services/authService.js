// services/authService.js
// Xử lý logic xác thực, hash password, sinh JWT

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const { ConflictException, NotFoundException, UnauthorizedException } = require('../exceptions');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const authService = {
  async register({ name, email, password }) {
    // Kiểm tra email đã tồn tại
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email đã tồn tại');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userRepository.create({ name, email, password: hashedPassword });
    return user;
  },

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Mật khẩu không đúng');
    // Sinh JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
    return { user, token };
  },

  async changePassword({ userId, oldPassword, newPassword }) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) throw new UnauthorizedException('Mật khẩu cũ không đúng');
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedUser = await userRepository.updatePassword(userId, hashedPassword);
    return updatedUser;
  },
};

module.exports = authService;
