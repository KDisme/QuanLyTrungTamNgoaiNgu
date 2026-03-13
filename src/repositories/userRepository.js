// repositories/userRepository.js
// Thao tác với bảng users - Data Access Layer

const { pool } = require('../config/db');
const User = require('../models/user');
const { ApiError } = require('../exceptions');

const userRepository = {

  /**
   * Tạo người dùng mới
   */
  async create({ name, email, password }) {
    try {

      const result = await pool.query(
        'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
        [name, email, password]
      );

      if (!result.rows.length) {
        throw new ApiError(500, 'Không thể tạo người dùng', 'USER_CREATION_FAILED');
      }

      return new User(result.rows[0]);

    } catch (err) {

      console.error('Database error in userRepository.create:', err);

      // email bị trùng
      if (err.code === '23505') {
        throw new ApiError(409, 'Email đã tồn tại', 'EMAIL_ALREADY_EXISTS');
      }

      throw new ApiError(
        500,
        'Lỗi tạo người dùng từ database',
        'USER_CREATION_FAILED'
      );
    }
  },

  /**
   * Tìm người dùng theo email
   */
  async findByEmail(email) {
    try {

      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) return null;

      return new User(result.rows[0]);

    } catch (err) {

      console.error('Database error in userRepository.findByEmail:', err);

      throw new ApiError(
        500,
        'Lỗi lấy thông tin người dùng từ database',
        'DATABASE_ERROR'
      );
    }
  },

  /**
   * Tìm người dùng theo ID
   */
  async findById(id) {
    try {

      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) return null;

      return new User(result.rows[0]);

    } catch (err) {

      console.error('Database error in userRepository.findById:', err);

      throw new ApiError(
        500,
        'Lỗi lấy thông tin người dùng từ database',
        'DATABASE_ERROR'
      );
    }
  },

  /**
   * Cập nhật mật khẩu
   */
  async updatePassword(id, newPassword) {
    try {

      const result = await pool.query(
        'UPDATE users SET password = $1 WHERE id = $2 RETURNING *',
        [newPassword, id]
      );

      if (result.rows.length === 0) return null;

      return new User(result.rows[0]);

    } catch (err) {

      console.error('Database error in userRepository.updatePassword:', err);

      throw new ApiError(
        500,
        'Lỗi cập nhật mật khẩu từ database',
        'UPDATE_FAILED'
      );
    }
  },

};

module.exports = userRepository;
