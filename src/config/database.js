const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'sapassword',
  database: process.env.DB_NAME || 'quan_ly_trung_tam_ngoai_ngu',
});

// Xử lý kết nối lỗi
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Đóng kết nối pool
 */
async function closeDatabase() {
  await pool.end();
  console.log('Database connection closed');
}

module.exports = {
  pool,
  closeDatabase,
};
