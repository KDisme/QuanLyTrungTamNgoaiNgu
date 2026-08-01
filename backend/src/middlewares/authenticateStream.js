const jwt = require('jsonwebtoken');
const pool = require('../config/database');

module.exports = async function authenticateStream(req, res, next) {
  try {
    const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).end();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT id FROM users WHERE id=$1 AND tenant_id=$2 AND is_active=TRUE',
      [decoded.userId, decoded.tenantId]
    );
    if (!result.rows.length) return res.status(401).end();

    req.user = { id: decoded.userId, tenantId: decoded.tenantId, roles: decoded.roles || [] };
    next();
  } catch {
    res.status(401).end();
  }
};