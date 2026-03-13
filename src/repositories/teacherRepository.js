// repositories/teacherRepository.js
// Thao tác với bảng teachers - Data Access Layer

const { pool } = require('../config/db');
const Teacher = require('../models/teacher');
const { ApiError } = require('../exceptions');

/**
 * Teacher Repository
 * Xử lý tất cả các thao tác với database cho bảng teachers
 * Chỉ thực hiện queries và throw ApiError khi database error
 */
const teacherRepository = {
  /**
   * Tạo giáo viên mới
   * @throws {ApiError} Nếu database error
   */
  async create({ full_name, phone, email, date_of_birth }) {
    try {
      const result = await pool.query(
        'INSERT INTO teachers (full_name, phone, email, date_of_birth, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *',
        [full_name, phone, email, date_of_birth]
      );
      return new Teacher(result.rows[0]);
    } catch (err) {
      console.error('Database error in teacherRepository.create:', err);
      throw new ApiError(500, 'Lỗi tạo giáo viên từ database', 'TEACHER_CREATION_FAILED');
    }
  },

  /**
   * Tìm giáo viên theo ID
   * @returns {Teacher|null}
   * @throws {ApiError} Nếu database error
   */
  async findById(id) {
    try {
      const result = await pool.query('SELECT * FROM teachers WHERE id = $1', [id]);
      if (result.rows[0]) return new Teacher(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in teacherRepository.findById:', err);
      throw new ApiError(500, 'Lỗi lấy thông tin giáo viên từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Lấy toàn bộ danh sách giáo viên
   * @returns {Teacher[]}
   * @throws {ApiError} Nếu database error
   */
  async findAll() {
    try {
      const result = await pool.query('SELECT * FROM teachers ORDER BY created_at DESC');
      return result.rows.map(row => new Teacher(row));
    } catch (err) {
      console.error('Database error in teacherRepository.findAll:', err);
      throw new ApiError(500, 'Lỗi lấy danh sách giáo viên từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Cập nhật giáo viên
   * @returns {Teacher|null}
   * @throws {ApiError} Nếu database error
   */
  async update(id, { full_name, phone, email, date_of_birth }) {
    try {
      // Lấy dữ liệu hiện tại
      const current = await this.findById(id);
      if (!current) return null;

      // Chỉ cập nhật các trường được gửi
      const updated = {
        full_name: full_name !== undefined ? full_name : current.full_name,
        phone: phone !== undefined ? phone : current.phone,
        email: email !== undefined ? email : current.email,
        date_of_birth: date_of_birth !== undefined ? date_of_birth : current.date_of_birth,
      };

      const result = await pool.query(
        'UPDATE teachers SET full_name = $1, phone = $2, email = $3, date_of_birth = $4 WHERE id = $5 RETURNING *',
        [updated.full_name, updated.phone, updated.email, updated.date_of_birth, id]
      );

      if (result.rows[0]) return new Teacher(result.rows[0]);
      return null;

    } catch (err) {
      console.error('Database error in teacherRepository.update:', err);
      throw new ApiError(500, 'Lỗi cập nhật giáo viên từ database', 'UPDATE_FAILED');
    }
  },

  /**
   * Xóa giáo viên
   * @throws {ApiError} Nếu database error
   */
  async delete(id) {
    try {
      await pool.query('DELETE FROM teachers WHERE id = $1', [id]);
      return true;
    } catch (err) {
      console.error('Database error in teacherRepository.delete:', err);
      throw new ApiError(500, 'Lỗi xóa giáo viên từ database', 'DELETE_FAILED');
    }
  },

  /**
   * Lấy danh sách lớp học do giáo viên phụ trách
   * @param {number} teacherId - ID của giáo viên
   * @returns {Class[]}
   * @throws {ApiError} Nếu database error
   */
  async getClasses(teacherId) {
    try {
      const result = await pool.query(
        'SELECT * FROM classes WHERE teacher_id = $1 ORDER BY created_at DESC',
        [teacherId]
      );
      const Class = require('../models/class');
      return result.rows.map(row => new Class(row));
    } catch (err) {
      console.error('Database error in teacherRepository.getClasses:', err);
      throw new ApiError(500, 'Lỗi lấy danh sách lớp học từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Lấy thông tin giáo viên theo email
   * @param {string} email - Email của giáo viên
   * @returns {Teacher|null}
   * @throws {ApiError} Nếu database error
   */
  async findByEmail(email) {
    try {
      const result = await pool.query('SELECT * FROM teachers WHERE email = $1', [email]);
      if (result.rows[0]) return new Teacher(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in teacherRepository.findByEmail:', err);
      throw new ApiError(500, 'Lỗi lấy giáo viên theo email từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Đếm số lớp học do giáo viên phụ trách
   * @param {number} teacherId - ID của giáo viên
   * @returns {number} Số lượng lớp
   * @throws {ApiError} Nếu database error
   */
  async countClasses(teacherId) {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) as count FROM classes WHERE teacher_id = $1',
        [teacherId]
      );
      return parseInt(result.rows[0].count, 10);
    } catch (err) {
      console.error('Database error in teacherRepository.countClasses:', err);
      throw new ApiError(500, 'Lỗi đếm lớp học từ database', 'DATABASE_ERROR');
    }
  },
};

module.exports = teacherRepository;
