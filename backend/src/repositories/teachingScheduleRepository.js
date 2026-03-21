// repositories/teachingScheduleRepository.js
// Thao tác với bảng teaching_schedules

const pool = require('../config/db');
const TeachingSchedule = require('../models/teachingSchedule');

const teachingScheduleRepository = {
  async create({ teacher_id, class_id, teaching_date, start_time, end_time, room }) {
    const result = await pool.query(
      'INSERT INTO teaching_schedules (teacher_id, class_id, teaching_date, start_time, end_time, room, created_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *',
      [teacher_id, class_id, teaching_date, start_time, end_time, room]
    );
    return new TeachingSchedule(result.rows[0]);
  },

  async findById(id) {
    const result = await pool.query('SELECT * FROM teaching_schedules WHERE id = $1', [id]);
    if (result.rows[0]) return new TeachingSchedule(result.rows[0]);
    return null;
  },

  async findAll() {
    const result = await pool.query('SELECT * FROM teaching_schedules');
    return result.rows.map(row => new TeachingSchedule(row));
  },

  async findByTeacherId(teacher_id) {
    const result = await pool.query('SELECT * FROM teaching_schedules WHERE teacher_id = $1', [teacher_id]);
    return result.rows.map(row => new TeachingSchedule(row));
  },

  async findByClassId(class_id) {
    const result = await pool.query('SELECT * FROM teaching_schedules WHERE class_id = $1', [class_id]);
    return result.rows.map(row => new TeachingSchedule(row));
  },

  async update(id, { teacher_id, class_id, teaching_date, start_time, end_time, room }) {
    // Lấy dữ liệu hiện tại
    const current = await this.findById(id);
    if (!current) return null;

    // Chỉ cập nhật các trường được gửi
    const updated = {
      teacher_id: teacher_id !== undefined ? teacher_id : current.teacher_id,
      class_id: class_id !== undefined ? class_id : current.class_id,
      teaching_date: teaching_date !== undefined ? teaching_date : current.teaching_date,
      start_time: start_time !== undefined ? start_time : current.start_time,
      end_time: end_time !== undefined ? end_time : current.end_time,
      room: room !== undefined ? room : current.room,
    };

    const result = await pool.query(
      'UPDATE teaching_schedules SET teacher_id = $1, class_id = $2, teaching_date = $3, start_time = $4, end_time = $5, room = $6 WHERE id = $7 RETURNING *',
      [updated.teacher_id, updated.class_id, updated.teaching_date, updated.start_time, updated.end_time, updated.room, id]
    );
    if (result.rows[0]) return new TeachingSchedule(result.rows[0]);
    return null;
  },

  async delete(id) {
    await pool.query('DELETE FROM teaching_schedules WHERE id = $1', [id]);
    return true;
  },
};

module.exports = teachingScheduleRepository;
