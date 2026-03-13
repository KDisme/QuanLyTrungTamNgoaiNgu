/**
 * Database entry point
 * Exports pool and utility functions from database.js
 */
const { pool, checkConnection, closeDatabase } = require('./database');

module.exports = {
  pool,
  checkConnection,
  closeDatabase,
};
