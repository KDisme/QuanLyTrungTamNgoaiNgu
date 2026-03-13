const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Xử lý kết nối lỗi
 * Log lỗi xảy ra trên idle client
 */
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Xử lý kết nối thành công
 */
pool.on('connect', () => {
  console.log('Database connected successfully');
});

/**
 * Kiểm tra kết nối database
 */
async function checkConnection() {
  try {
    const client = await pool.connect();
    console.log('Database connection verified');
    client.release();
    return true;
  } catch (err) {
    console.error('Database connection failed:', err.message);
    return false;
  }
}

/**
 * Đóng kết nối pool
 */
async function closeDatabase() {
  try {
    await pool.end();
    console.log('Database connection closed');
  } catch (err) {
    console.error('Error closing database connection:', err.message);
  }
}

module.exports = {
  pool,
  checkConnection,
  closeDatabase,
};
