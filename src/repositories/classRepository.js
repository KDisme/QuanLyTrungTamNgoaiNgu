// repositories/classRepository.js
// Thao tác với bảng classes - Data Access Layer

const { pool } = require('../config/db');
const Class = require('../models/class');
const { ApiError } = require('../exceptions');

/**
 * Class Repository
 * Xử lý tất cả các thao tác với database cho bảng classes
 * Chỉ thực hiện queries và throw ApiError khi database error
 */
const classRepository = {
  /**
   * Tạo lớp học mới
   * @throws {ApiError} Nếu database error
   */
  async create({ name, start_date, end_date, capacity, teacher_id, sessions }) {
    try {
      const result = await pool.query(
        'INSERT INTO classes (name, start_date, end_date, capacity, teacher_id, sessions, created_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *',
        [name, start_date, end_date, capacity, teacher_id, sessions]
      );
      return new Class(result.rows[0]);
    } catch (err) {
      console.error('Database error in classRepository.create:', err);
      throw new ApiError(500, 'Lỗi tạo lớp học từ database', 'CLASS_CREATION_FAILED');
    }
  },

  /**
   * Tìm lớp học theo ID
   * @returns {Class|null}
   * @throws {ApiError} Nếu database error
   */
  async findById(id) {
    try {
      const result = await pool.query('SELECT * FROM classes WHERE id = $1', [id]);
      if (result.rows[0]) return new Class(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in classRepository.findById:', err);
      throw new ApiError(500, 'Lỗi lấy thông tin lớp học từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Lấy toàn bộ danh sách lớp học
   * @returns {Class[]}
   * @throws {ApiError} Nếu database error
   */
  async findAll() {
    try {
      const result = await pool.query('SELECT * FROM classes ORDER BY created_at DESC');
      return result.rows.map(row => new Class(row));
    } catch (err) {
      console.error('Database error in classRepository.findAll:', err);
      throw new ApiError(500, 'Lỗi lấy danh sách lớp học từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Cập nhật lớp học
   * @returns {Class|null}
   * @throws {ApiError} Nếu database error
   */
  async update(id, { name, start_date, end_date, capacity, teacher_id, sessions }) {
    try {

      const current = await this.findById(id);
      if (!current) return null;

      const updated = {
        name: name !== undefined ? name : current.name,
        start_date: start_date !== undefined ? start_date : current.start_date,
        end_date: end_date !== undefined ? end_date : current.end_date,
        capacity: capacity !== undefined ? capacity : current.capacity,
        teacher_id: teacher_id !== undefined ? teacher_id : current.teacher_id,
        sessions: sessions !== undefined ? sessions : current.sessions,
      };

      const result = await pool.query(
        'UPDATE classes SET name = $1, start_date = $2, end_date = $3, capacity = $4, teacher_id = $5, sessions = $6 WHERE id = $7 RETURNING *',
        [
          updated.name,
          updated.start_date,
          updated.end_date,
          updated.capacity,
          updated.teacher_id,
          updated.sessions,
          id
        ]
      );

      if (result.rows[0]) return new Class(result.rows[0]);
      return null;

    } catch (err) {
      console.error('Database error in classRepository.update:', err);
      throw new ApiError(500, 'Lỗi cập nhật lớp học từ database', 'UPDATE_FAILED');
    }
  },

  /**
   * Xóa lớp học
   * @throws {ApiError} Nếu database error
   */
  async delete(id) {
    try {
      await pool.query('DELETE FROM classes WHERE id = $1', [id]);
      return true;
    } catch (err) {
      console.error('Database error in classRepository.delete:', err);
      throw new ApiError(500, 'Lỗi xóa lớp học từ database', 'DELETE_FAILED');
    }
  },

  /**
   * Gán giáo viên cho lớp (cập nhật teacher_id)
   * @param {number} classId - ID của lớp
   * @param {number} teacherId - ID của giáo viên
   * @returns {Class|null}
   * @throws {ApiError} Nếu database error
   */
  async assignTeacher(classId, teacherId) {
    try {
      const result = await pool.query(
        'UPDATE classes SET teacher_id = $1 WHERE id = $2 RETURNING *',
        [teacherId, classId]
      );
      if (result.rows[0]) return new Class(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in classRepository.assignTeacher:', err);
      throw new ApiError(500, 'Lỗi gán giáo viên cho lớp từ database', 'ASSIGN_TEACHER_FAILED');
    }
  },

  /**
   * Xóa giáo viên khỏi lớp (set teacher_id = null)
   * @param {number} classId - ID của lớp
   * @returns {Class|null}
   * @throws {ApiError} Nếu database error
   */
  async removeTeacher(classId) {
    try {
      const result = await pool.query(
        'UPDATE classes SET teacher_id = NULL WHERE id = $1 RETURNING *',
        [classId]
      );
      if (result.rows[0]) return new Class(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in classRepository.removeTeacher:', err);
      throw new ApiError(500, 'Lỗi xóa giáo viên khỏi lớp từ database', 'REMOVE_TEACHER_FAILED');
    }
  },

  /**
   * Lấy danh sách sinh viên theo lớp ID
   * @param {number} classId - ID của lớp
   * @returns {Student[]}
   * @throws {ApiError} Nếu database error
   */
  async getStudentsByClass(classId) {
    try {
      const result = await pool.query(
        'SELECT * FROM students WHERE class_id = $1 ORDER BY created_at DESC',
        [classId]
      );
      const Student = require('../models/student');
      return result.rows.map(row => new Student(row));
    } catch (err) {
      console.error('Database error in classRepository.getStudentsByClass:', err);
      throw new ApiError(500, 'Lỗi lấy danh sách sinh viên từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Đếm số lượng sinh viên trong lớp
   * @param {number} classId - ID của lớp
   * @returns {number} Số lượng sinh viên
   * @throws {ApiError} Nếu database error
   */
  async countStudents(classId) {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) as count FROM students WHERE class_id = $1',
        [classId]
      );
      return parseInt(result.rows[0].count, 10);
    } catch (err) {
      console.error('Database error in classRepository.countStudents:', err);
      throw new ApiError(500, 'Lỗi đếm sinh viên từ database', 'DATABASE_ERROR');
    }
  },
};

module.exports = classRepository;
