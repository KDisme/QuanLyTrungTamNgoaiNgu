// services/authService.js
// Xử lý logic xác thực, hash password, sinh JWT - Business Logic Layer

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const { ConflictException, NotFoundException, UnauthorizedException, ApiError } = require('../exceptions');
const { validateId, validateResourceExists, validateNoDuplicate } = require('../validators/commonValidators');
const { validateRegisterData, validateLoginData, validateChangePasswordData } = require('../validators/authValidator');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '1d';

/**
 * Auth Service
 * Xử lý registration, login, change password
 * Validate dữ liệu và throw exception khi thất bại
 */
const authService = {
  /**
   * Đăng ký người dùng mới
   * @throws {ConflictException} Nếu email đã tồn tại
   * @throws {ApiError} Nếu hash password thất bại
   */
  async register({ name, email, password }) {
    // Validate dữ liệu
    validateRegisterData({ name, email, password });

    // Kiểm tra email đã tồn tại
    const existingUser = await userRepository.findByEmail(email);
    validateNoDuplicate(existingUser, 'Email');

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await userRepository.create({ name, email, password: hashedPassword });
      return {
        id: user.id,
        name: user.name,
        email: user.email,
      };
    } catch (err) {
      console.error('Error hashing password:', err);
      throw new ApiError(500, 'Lỗi tạo người dùng', 'REGISTRATION_FAILED');
    }
  },

  /**
   * Đăng nhập
   * @throws {NotFoundException} Nếu người dùng không tồn tại
   * @throws {UnauthorizedException} Nếu mật khẩu sai
   */
  async login({ email, password }) {
    // Validate dữ liệu
    validateLoginData({ email, password });

    const user = await userRepository.findByEmail(email);
    validateResourceExists(user, 'user');

    try {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new UnauthorizedException('Mật khẩu không đúng', 'INVALID_PASSWORD');
      }

      // Sinh JWT
      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRE }
      );

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        token,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      console.error('Error during login:', err);
      throw new ApiError(500, 'Lỗi đăng nhập', 'LOGIN_FAILED');
    }
  },

  /**
   * Thay đổi mật khẩu
   * @throws {NotFoundException} Nếu người dùng không tồn tại
   * @throws {UnauthorizedException} Nếu mật khẩu cũ sai
   */
  async changePassword({ userId, oldPassword, newPassword }) {
    // Validate dữ liệu
    validateId(userId, 'người dùng');
    validateChangePasswordData({ oldPassword, newPassword });

    const user = await userRepository.findById(userId);
    validateResourceExists(user, 'user');

    try {
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        throw new UnauthorizedException('Mật khẩu cũ không đúng', 'INVALID_OLD_PASSWORD');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const updatedUser = await userRepository.updatePassword(userId, hashedPassword);

      return {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      console.error('Error changing password:', err);
      throw new ApiError(500, 'Lỗi thay đổi mật khẩu', 'CHANGE_PASSWORD_FAILED');
    }
  },
};

module.exports = authService;
