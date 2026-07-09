const pool = require('../config/database');

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function camelItem(row) {
  return row ? {
    ...row,
    userId: row.user_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  } : row;
}

class NotificationService {
  // Create the same notification for many recipients at once (e.g. every student in a class).
  async createForUsers(tenantId, userIds = [], { type = 'system', title, message = null, link = null }) {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ids.length || !title) return [];

    const values = [];
    const params = [];
    let idx = 1;
    for (const userId of ids) {
      values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      params.push(tenantId, userId, type, title, message, link);
    }

    const result = await pool.query(
      `INSERT INTO notifications (tenant_id, user_id, type, title, message, link)
       VALUES ${values.join(',')}
       RETURNING *`,
      params
    );
    return result.rows.map(camelItem);
  }

  async create(tenantId, userId, payload) {
    const [item] = await this.createForUsers(tenantId, [userId], payload);
    return item || null;
  }

  async list(tenantId, userId, { unreadOnly, page = 1, limit = 30 } = {}) {
    const offset = (toInt(page, 1) - 1) * toInt(limit, 30);
    const conditions = ['tenant_id = $1', 'user_id = $2'];
    const params = [tenantId, userId];
    if (String(unreadOnly) === 'true') conditions.push('is_read = FALSE');
    const where = conditions.join(' AND ');

    const [countResult, rowsResult, unreadResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM notifications WHERE ${where}`, params),
      pool.query(
        `SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, toInt(limit, 30), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM notifications WHERE tenant_id=$1 AND user_id=$2 AND is_read = FALSE`, [tenantId, userId]),
    ]);

    return {
      total: parseInt(countResult.rows[0]?.count || '0', 10),
      unreadCount: parseInt(unreadResult.rows[0]?.count || '0', 10),
      page: toInt(page, 1),
      limit: toInt(limit, 30),
      items: rowsResult.rows.map(camelItem),
    };
  }

  async unreadCount(tenantId, userId) {
    const result = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE tenant_id=$1 AND user_id=$2 AND is_read = FALSE`,
      [tenantId, userId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  async markRead(tenantId, userId, id) {
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE id=$1 AND tenant_id=$2 AND user_id=$3 RETURNING *`,
      [id, tenantId, userId]
    );
    return camelItem(result.rows[0]);
  }

  async markAllRead(tenantId, userId) {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE tenant_id=$1 AND user_id=$2 AND is_read = FALSE`,
      [tenantId, userId]
    );
  }
}

module.exports = new NotificationService();