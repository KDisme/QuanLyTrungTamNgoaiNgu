const { Pool, types } = require('pg');

// Keep PostgreSQL DATE columns as raw YYYY-MM-DD strings.
// This prevents off-by-one-day bugs when a DATE is converted to a JS Date
// and serialized through UTC/local time zones.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'quanly_trungtam',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    return;
  }
  console.log('✅ Database connected successfully');
  release();
});

module.exports = pool;
