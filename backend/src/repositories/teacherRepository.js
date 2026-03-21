// repositories/teacherRepository.js
// Thao tác với bảng teachers

const pool = require('../config/db');
const Teacher = require('../models/teacher');

const teacherRepository = {
  async create({ full_name, phone, email, date_of_birth }) {
    const result = await pool.query(
      'INSERT INTO teachers (full_name, phone, email, date_of_birth, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *',
      [full_name, phone, email, date_of_birth]
    );
    return new Teacher(result.rows[0]);
  },

  async findById(id) {
    const result = await pool.query('SELECT * FROM teachers WHERE id = $1', [id]);
    if (result.rows[0]) return new Teacher(result.rows[0]);
    return null;
  },

  async findAll() {
    const result = await pool.query('SELECT * FROM teachers');
    return result.rows.map(row => new Teacher(row));
  },

  async update(id, { full_name, phone, email, date_of_birth }) {
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
  },

  async delete(id) {
    await pool.query('DELETE FROM teachers WHERE id = $1', [id]);
    return true;
  },
};

module.exports = teacherRepository;
