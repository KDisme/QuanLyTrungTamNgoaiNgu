// repositories/studentRepository.js
// Thao tác với bảng students - Data Access Layer

const { pool } = require('../config/db');
const Student = require('../models/student');
const { ApiError } = require('../exceptions');
const { STUDENT_STATUS } = require('../constants/studentStatus');

/**
 * Student Repository
 * Xử lý tất cả các thao tác với database cho bảng students
 * Chỉ thực hiện queries và throw ApiError khi database error
 */
const studentRepository = {
  /**
   * Tạo học viên mới
   * @throws {ApiError} Nếu database error
   */
  async create({ name, email, birth_date, citizen_id, target_score, class_id, status }) {
    try {
      const defaultStatus = status || STUDENT_STATUS.ENROLLED;
      const result = await pool.query(
        'INSERT INTO students (name, email, birth_date, citizen_id, target_score, class_id, enrollment_date, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, CURRENT_TIMESTAMP) RETURNING *',
        [name, email, birth_date, citizen_id, target_score, class_id, defaultStatus]
      );
      return new Student(result.rows[0]);
    } catch (err) {
      console.error('Database error in studentRepository.create:', err);
      throw new ApiError(500, 'Lỗi tạo học viên từ database', 'STUDENT_CREATION_FAILED');
    }
  },

  /**
   * Tìm học viên theo CMND/CCCD
   * @returns {Student|null}
   * @throws {ApiError} Nếu database error
   */
  async findByCitizenId(citizen_id) {
    try {
      const result = await pool.query('SELECT * FROM students WHERE citizen_id = $1', [citizen_id]);
      if (result.rows[0]) return new Student(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in studentRepository.findByCitizenId:', err);
      throw new ApiError(500, 'Lỗi lấy học viên từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Tìm học viên theo ID
   * @returns {Student|null}
   * @throws {ApiError} Nếu database error
   */
  async findById(id) {
    try {
      const result = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
      if (result.rows[0]) return new Student(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in studentRepository.findById:', err);
      throw new ApiError(500, 'Lỗi lấy thông tin học viên từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Lấy toàn bộ danh sách học viên
   * @returns {Student[]}
   * @throws {ApiError} Nếu database error
   */
  async findAll() {
    try {
      const result = await pool.query('SELECT * FROM students ORDER BY created_at DESC');
      return result.rows.map(row => new Student(row));
    } catch (err) {
      console.error('Database error in studentRepository.findAll:', err);
      throw new ApiError(500, 'Lỗi lấy danh sách học viên từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Cập nhật học viên
   * @returns {Student|null}
   * @throws {ApiError} Nếu database error
   */
  async update(id, { name, email, birth_date, citizen_id, target_score, class_id }) {
    try {
      const current = await this.findById(id);
      if (!current) return null;

      const updated = {
        name: name !== undefined ? name : current.name,
        email: email !== undefined ? email : current.email,
        birth_date: birth_date !== undefined ? birth_date : current.birth_date,
        citizen_id: citizen_id !== undefined ? citizen_id : current.citizen_id,
        target_score: target_score !== undefined ? target_score : current.target_score,
        class_id: class_id !== undefined ? class_id : current.class_id,
      };

      const result = await pool.query(
        'UPDATE students SET name = $1, email = $2, birth_date = $3, citizen_id = $4, target_score = $5, class_id = $6 WHERE id = $7 RETURNING *',
        [updated.name, updated.email, updated.birth_date, updated.citizen_id, updated.target_score, updated.class_id, id]
      );

      if (result.rows[0]) return new Student(result.rows[0]);
      return null;

    } catch (err) {
      console.error('Database error in studentRepository.update:', err);
      throw new ApiError(500, 'Lỗi cập nhật học viên từ database', 'UPDATE_FAILED');
    }
  },

  /**
   * Xóa học viên
   * @throws {ApiError} Nếu database error
   */
  async delete(id) {
    try {
      await pool.query('DELETE FROM students WHERE id = $1', [id]);
      return true;
    } catch (err) {
      console.error('Database error in studentRepository.delete:', err);
      throw new ApiError(500, 'Lỗi xóa học viên từ database', 'DELETE_FAILED');
    }
  },

  /**
   * Gán sinh viên cho lớp (cập nhật class_id)
   * @param {number} studentId - ID của sinh viên
   * @param {number} classId - ID của lớp
   * @returns {Student|null}
   * @throws {ApiError} Nếu database error
   */
  async assignToClass(studentId, classId) {
    try {
      const result = await pool.query(
        'UPDATE students SET class_id = $1 WHERE id = $2 RETURNING *',
        [classId, studentId]
      );
      if (result.rows[0]) return new Student(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in studentRepository.assignToClass:', err);
      throw new ApiError(500, 'Lỗi gán sinh viên cho lớp từ database', 'ASSIGN_CLASS_FAILED');
    }
  },

  /**
   * Xóa sinh viên khỏi lớp (set class_id = null)
   * @param {number} studentId - ID của sinh viên
   * @returns {Student|null}
   * @throws {ApiError} Nếu database error
   */
  async removeFromClass(studentId) {
    try {
      const result = await pool.query(
        'UPDATE students SET class_id = NULL WHERE id = $1 RETURNING *',
        [studentId]
      );
      if (result.rows[0]) return new Student(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in studentRepository.removeFromClass:', err);
      throw new ApiError(500, 'Lỗi xóa sinh viên khỏi lớp từ database', 'REMOVE_CLASS_FAILED');
    }
  },

  /**
   * Lấy danh sách sinh viên theo email (tìm kiếm)
   * @param {string} email - Email của sinh viên
   * @returns {Student|null}
   * @throws {ApiError} Nếu database error
   */
  async findByEmail(email) {
    try {
      const result = await pool.query('SELECT * FROM students WHERE email = $1', [email]);
      if (result.rows[0]) return new Student(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in studentRepository.findByEmail:', err);
      throw new ApiError(500, 'Lỗi lấy sinh viên theo email từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Tìm học viên theo email và đang học (chưa hoàn thành)
   * @returns {Student|null}
   */
  async findActiveByEmail(email) {
    try {
      const result = await pool.query(
        'SELECT * FROM students WHERE email = $1 AND status != $2 LIMIT 1',
        [email, STUDENT_STATUS.COMPLETED]
      );
      if (result.rows[0]) return new Student(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in studentRepository.findActiveByEmail:', err);
      throw new ApiError(500, 'Lỗi lấy sinh viên theo email từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Cập nhật trạng thái của học viên thành hoàn thành
   * khi lớp học của họ đã kết thúc
   */
  async completeStudentsForEndedClasses() {
    try {
      await pool.query(
        'UPDATE students SET status = $1 WHERE status = $2 AND class_id IN (SELECT id FROM classes WHERE end_date < CURRENT_DATE)',
        [STUDENT_STATUS.COMPLETED, STUDENT_STATUS.ENROLLED]
      );
    } catch (err) {
      console.error('Database error in studentRepository.completeStudentsForEndedClasses:', err);
      throw new ApiError(500, 'Lỗi cập nhật trạng thái học viên', 'DATABASE_ERROR');
    }
  },
};

module.exports = studentRepository;
