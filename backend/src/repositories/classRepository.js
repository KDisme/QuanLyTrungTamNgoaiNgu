// repositories/classRepository.js
// Thao tác với bảng classes

const pool = require('../config/db');
const Class = require('../models/class');

const classRepository = {
  async create({ name, start_date, end_date, capacity, teacher_id, sessions }) {
    const result = await pool.query(
      'INSERT INTO classes (name, start_date, end_date, capacity, teacher_id, sessions, created_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *',
      [name, start_date, end_date, capacity, teacher_id, sessions]
    );
    return new Class(result.rows[0]);
  },

  async findById(id) {
    const result = await pool.query('SELECT * FROM classes WHERE id = $1', [id]);
    if (result.rows[0]) return new Class(result.rows[0]);
    return null;
  },

  async findAll() {
    const result = await pool.query('SELECT * FROM classes');
    return result.rows.map(row => new Class(row));
  },

  async update(id, { name, start_date, end_date, capacity, teacher_id, sessions }) {
    // Lấy dữ liệu hiện tại
    const current = await this.findById(id);
    if (!current) return null;

    // Chỉ cập nhật các trường được gửi
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
      [updated.name, updated.start_date, updated.end_date, updated.capacity, updated.teacher_id, updated.sessions, id]
    );
    if (result.rows[0]) return new Class(result.rows[0]);
    return null;
  },

  async delete(id) {
    await pool.query('DELETE FROM classes WHERE id = $1', [id]);
    return true;
  },
};

module.exports = classRepository;
