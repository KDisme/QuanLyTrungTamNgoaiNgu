// repositories/userRepository.js
// Thao tác với bảng users

const pool = require('../config/db');
const User = require('../models/user');

const userRepository = {
  async create({ name, email, password }) {
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
      [name, email, password]
    );
    return new User(result.rows[0]);
  },

  async findByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows[0]) return new User(result.rows[0]);
    return null;
  },

  async findById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows[0]) return new User(result.rows[0]);
    return null;
  },

  async updatePassword(id, newPassword) {
    const result = await pool.query(
      'UPDATE users SET password = $1, password_changed_at = NOW() WHERE id = $2 RETURNING *',
      [newPassword, id]
    );
    if (result.rows[0]) return new User(result.rows[0]);
    return null;
  },
};

module.exports = userRepository;
