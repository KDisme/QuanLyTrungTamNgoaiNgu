// repositories/teachingScheduleRepository.js
// Thao tác với bảng teaching_schedules - Data Access Layer

const { pool } = require('../config/db');
const TeachingSchedule = require('../models/teachingSchedule');
const { ApiError } = require('../exceptions');

/**
 * TeachingSchedule Repository
 * Xử lý tất cả các thao tác với database cho bảng teaching_schedules
 * Chỉ thực hiện queries và throw ApiError khi database error
 */
const teachingScheduleRepository = {
  /**
   * Tạo lịch giảng dạy mới
   * @throws {ApiError} Nếu database error
   */
  async create({ teacher_id, class_id, day_of_week, start_time, end_time, room }) {
    try {
      const result = await pool.query(
        'INSERT INTO teaching_schedules (teacher_id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *',
        [teacher_id, class_id, day_of_week, start_time, end_time, room]
      );
      return new TeachingSchedule(result.rows[0]);
    } catch (err) {
      console.error('Database error in teachingScheduleRepository.create:', err);
      throw new ApiError(500, 'Lỗi tạo lịch giảng dạy từ database', 'TEACHING_SCHEDULE_CREATION_FAILED');
    }
  },

  /**
   * Tìm lịch giảng dạy theo ID
   * @returns {TeachingSchedule|null}
   * @throws {ApiError} Nếu database error
   */
  async findById(id) {
    try {
      const result = await pool.query(`
        SELECT ts.*, t.full_name as teacher_name, c.name as class_name
        FROM teaching_schedules ts
        JOIN teachers t ON ts.teacher_id = t.id
        JOIN classes c ON ts.class_id = c.id
        WHERE ts.id = $1
      `, [id]);
      if (result.rows[0]) {
        return {
          ...new TeachingSchedule(result.rows[0]),
          teacher_name: result.rows[0].teacher_name,
          class_name: result.rows[0].class_name
        };
      }
      return null;
    } catch (err) {
      console.error('Database error in teachingScheduleRepository.findById:', err);
      throw new ApiError(500, 'Lỗi lấy thông tin lịch giảng dạy từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Lấy toàn bộ danh sách lịch giảng dạy
   * @returns {TeachingSchedule[]}
   * @throws {ApiError} Nếu database error
   */
  async findAll() {
    try {
      const result = await pool.query(`
        SELECT ts.*, t.full_name as teacher_name, c.name as class_name
        FROM teaching_schedules ts
        JOIN teachers t ON ts.teacher_id = t.id
        JOIN classes c ON ts.class_id = c.id
        ORDER BY ts.day_of_week ASC, ts.start_time ASC
      `);
      return result.rows.map(row => ({
        ...new TeachingSchedule(row),
        teacher_name: row.teacher_name,
        class_name: row.class_name
      }));
    } catch (err) {
      console.error('Database error in teachingScheduleRepository.findAll:', err);
      throw new ApiError(500, 'Lỗi lấy danh sách lịch giảng dạy từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Lấy lịch giảng dạy theo teacher_id
   * @returns {TeachingSchedule[]}
   * @throws {ApiError} Nếu database error
   */
  async findByTeacherId(teacher_id) {
    try {
      const result = await pool.query(`
        SELECT ts.*, t.full_name as teacher_name, c.name as class_name
        FROM teaching_schedules ts
        JOIN teachers t ON ts.teacher_id = t.id
        JOIN classes c ON ts.class_id = c.id
        WHERE ts.teacher_id = $1
        ORDER BY ts.day_of_week ASC, ts.start_time ASC
      `, [teacher_id]);
      return result.rows.map(row => ({
        ...new TeachingSchedule(row),
        teacher_name: row.teacher_name,
        class_name: row.class_name
      }));
    } catch (err) {
      console.error('Database error in teachingScheduleRepository.findByTeacherId:', err);
      throw new ApiError(500, 'Lỗi lấy lịch giảng dạy theo giáo viên từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Lấy lịch giảng dạy theo class_id
   * @returns {TeachingSchedule[]}
   * @throws {ApiError} Nếu database error
   */
  async findByClassId(class_id) {
    try {
      const result = await pool.query(`
        SELECT ts.*, t.full_name as teacher_name, c.name as class_name
        FROM teaching_schedules ts
        JOIN teachers t ON ts.teacher_id = t.id
        JOIN classes c ON ts.class_id = c.id
        WHERE ts.class_id = $1
        ORDER BY ts.day_of_week ASC, ts.start_time ASC
      `, [class_id]);
      return result.rows.map(row => ({
        ...new TeachingSchedule(row),
        teacher_name: row.teacher_name,
        class_name: row.class_name
      }));
    } catch (err) {
      console.error('Database error in teachingScheduleRepository.findByClassId:', err);
      throw new ApiError(500, 'Lỗi lấy lịch giảng dạy theo lớp học từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Lấy lịch giảng dạy theo ngày
   * @returns {TeachingSchedule[]}
   * @throws {ApiError} Nếu database error
   */
  async findByDate(date) {
    try {
      const result = await pool.query(`
        SELECT ts.*, t.full_name as teacher_name, c.name as class_name
        FROM teaching_schedules ts
        JOIN teachers t ON ts.teacher_id = t.id
        JOIN classes c ON ts.class_id = c.id
        WHERE ts.day_of_week = EXTRACT(DOW FROM $1::date)
          AND c.start_date <= $1::date
          AND c.end_date >= $1::date
        ORDER BY ts.start_time ASC
      `, [date]);
      return result.rows.map(row => ({
        ...new TeachingSchedule(row),
        teacher_name: row.teacher_name,
        class_name: row.class_name,
        teaching_date: date,
      }));
    } catch (err) {
      console.error('Database error in teachingScheduleRepository.findByDate:', err);
      throw new ApiError(500, 'Lỗi lấy lịch giảng dạy theo ngày từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Cập nhật lịch giảng dạy
   * @returns {TeachingSchedule|null}
   * @throws {ApiError} Nếu database error
   */
  async update(id, { teacher_id, class_id, day_of_week, start_time, end_time, room }) {
    try {
      const current = await this.findById(id);
      if (!current) return null;

      const updated = {
        teacher_id: teacher_id !== undefined ? teacher_id : current.teacher_id,
        class_id: class_id !== undefined ? class_id : current.class_id,
        day_of_week: day_of_week !== undefined ? day_of_week : current.day_of_week,
        start_time: start_time !== undefined ? start_time : current.start_time,
        end_time: end_time !== undefined ? end_time : current.end_time,
        room: room !== undefined ? room : current.room,
      };

      const result = await pool.query(
        'UPDATE teaching_schedules SET teacher_id = $1, class_id = $2, day_of_week = $3, start_time = $4, end_time = $5, room = $6 WHERE id = $7 RETURNING *',
        [updated.teacher_id, updated.class_id, updated.day_of_week, updated.start_time, updated.end_time, updated.room, id]
      );

      if (result.rows[0]) {
        // Sau khi update, lấy lại với join để có tên
        return await this.findById(id);
      }
      return null;
    } catch (err) {
      console.error('Database error in teachingScheduleRepository.update:', err);
      throw new ApiError(500, 'Lỗi cập nhật lịch giảng dạy từ database', 'UPDATE_FAILED');
    }
  },

  /**
   * Xóa lịch giảng dạy
   * @throws {ApiError} Nếu database error
   */
  async delete(id) {
    try {
      await pool.query('DELETE FROM teaching_schedules WHERE id = $1', [id]);
      return true;
    } catch (err) {
      console.error('Database error in teachingScheduleRepository.delete:', err);
      throw new ApiError(500, 'Lỗi xóa lịch giảng dạy từ database', 'DELETE_FAILED');
    }
  },

  /**
   * Kiểm tra xung đột lịch giảng dạy (cùng giáo viên, cùng thời gian)
   * @returns {TeachingSchedule|null}
   * @throws {ApiError} Nếu database error
   */
  async checkScheduleConflict(teacher_id, day_of_week, start_time, end_time, class_start_date, class_end_date, excludeId = null) {
    try {
      let query = `
        SELECT ts.* FROM teaching_schedules ts
        JOIN classes c ON ts.class_id = c.id
        WHERE ts.teacher_id = $1
          AND ts.day_of_week = $2
          AND ((ts.start_time <= $3 AND ts.end_time > $3) OR (ts.start_time < $4 AND ts.end_time >= $4) OR (ts.start_time >= $3 AND ts.end_time <= $4))
          AND c.start_date <= $5
          AND c.end_date >= $6
      `;
      const params = [teacher_id, day_of_week, start_time, end_time, class_end_date, class_start_date];

      if (excludeId) {
        query += ' AND ts.id != $7';
        params.push(excludeId);
      }

      const result = await pool.query(query, params);
      if (result.rows[0]) return new TeachingSchedule(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in teachingScheduleRepository.checkScheduleConflict:', err);
      throw new ApiError(500, 'Lỗi kiểm tra xung đột lịch giảng dạy từ database', 'DATABASE_ERROR');
    }
  },

  /**
   * Kiểm tra xung đột phòng học (cùng phòng, cùng thời gian)
   * @returns {TeachingSchedule|null}
   * @throws {ApiError} Nếu database error
   */
  async checkRoomConflict(room, day_of_week, start_time, end_time, class_start_date, class_end_date, excludeId = null) {
    try {
      let query = `
        SELECT ts.* FROM teaching_schedules ts
        JOIN classes c ON ts.class_id = c.id
        WHERE ts.room = $1
          AND ts.day_of_week = $2
          AND ((ts.start_time <= $3 AND ts.end_time > $3) OR (ts.start_time < $4 AND ts.end_time >= $4) OR (ts.start_time >= $3 AND ts.end_time <= $4))
          AND c.start_date <= $5
          AND c.end_date >= $6
      `;
      const params = [room, day_of_week, start_time, end_time, class_end_date, class_start_date];

      if (excludeId) {
        query += ' AND ts.id != $7';
        params.push(excludeId);
      }

      const result = await pool.query(query, params);
      if (result.rows[0]) return new TeachingSchedule(result.rows[0]);
      return null;
    } catch (err) {
      console.error('Database error in teachingScheduleRepository.checkRoomConflict:', err);
      throw new ApiError(500, 'Lỗi kiểm tra xung đột phòng học từ database', 'DATABASE_ERROR');
    }
  },
};

module.exports = teachingScheduleRepository;
