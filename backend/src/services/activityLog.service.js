const pool = require('../config/database');

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

class ActivityLogService {
  /**
   * Ghi 1 dòng log. Gọi hàm này ở các service khác, không nên throw lỗi
   * làm hỏng hành động chính nếu ghi log thất bại.
   */
  async log(tenantId, actor, { actionType, entityType, entityId, entityName, description, metadata = {} }) {
    try {
      const actorId = actor?.id || actor?.userId || null;
      let actorName = actor?.fullName || null;
      let actorRole = (actor?.roles && actor.roles[0]) || null;

      // req.user (giải mã từ JWT) thường chỉ có { userId, tenantId, roles } chứ không có fullName.
      // Nếu thiếu tên, tự tra cứu từ DB để log luôn hiển thị đúng người thực hiện.
      if (actorId && !actorName) {
        try {
          const userResult = await pool.query(
            'SELECT full_name FROM users WHERE id=$1 AND tenant_id=$2',
            [actorId, tenantId]
          );
          if (userResult.rows.length) actorName = userResult.rows[0].full_name;
        } catch {
          // ignore, giữ actorName = null nếu tra cứu lỗi
        }
      }

      await pool.query(
        `INSERT INTO activity_logs
         (tenant_id, actor_id, actor_name, actor_role, action_type, entity_type, entity_id, entity_name, description, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [
          tenantId,
          actorId,
          actorName,
          actorRole,
          actionType,
          entityType,
          entityId || null,
          entityName || null,
          description,
          JSON.stringify(metadata || {}),
        ]
      );
    } catch (err) {
      console.error('Failed to write activity log:', err);
    }
  }

  async list(tenantId, { actorId, actionType, entityType, startDate, endDate, search, page = 1, limit = 30 } = {}) {
    const offset = (toInt(page, 1) - 1) * toInt(limit, 30);
    const conditions = ['tenant_id = $1'];
    const params = [tenantId];
    let idx = 2;

    if (actorId) {
      conditions.push(`actor_id = $${idx}`); params.push(actorId); idx++;
    }
    if (actionType) {
      conditions.push(`action_type = $${idx}`); params.push(actionType); idx++;
    }
    if (entityType) {
      conditions.push(`entity_type = $${idx}`); params.push(entityType); idx++;
    }
    if (startDate) {
      conditions.push(`created_at >= $${idx}`); params.push(startDate); idx++;
    }
    if (endDate) {
      conditions.push(`created_at <= $${idx}`); params.push(endDate); idx++;
    }
    if (search) {
      conditions.push(`(description ILIKE $${idx} OR actor_name ILIKE $${idx} OR entity_name ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }

    const where = conditions.join(' AND ');

    const [countResult, rowsResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM activity_logs WHERE ${where}`, params),
      pool.query(
        `SELECT * FROM activity_logs WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, toInt(limit, 30), offset]
      ),
    ]);

    return {
      total: parseInt(countResult.rows[0]?.count || '0', 10),
      page: toInt(page, 1),
      limit: toInt(limit, 30),
      logs: rowsResult.rows.map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        actorName: row.actor_name,
        actorRole: row.actor_role,
        actionType: row.action_type,
        entityType: row.entity_type,
        entityId: row.entity_id,
        entityName: row.entity_name,
        description: row.description,
        metadata: row.metadata,
        createdAt: row.created_at,
      })),
    };
  }

  /** Danh sách distinct actor để đổ vào dropdown filter */
  async getDistinctActors(tenantId) {
    const result = await pool.query(
      `SELECT DISTINCT actor_id, actor_name FROM activity_logs
       WHERE tenant_id=$1 AND actor_id IS NOT NULL
       ORDER BY actor_name`,
      [tenantId]
    );
    return result.rows.map((r) => ({ id: r.actor_id, name: r.actor_name }));
  }
}

module.exports = new ActivityLogService();