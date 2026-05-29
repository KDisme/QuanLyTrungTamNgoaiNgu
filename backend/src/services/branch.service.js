const pool = require('../config/database');

class BranchService {
  async getAll(tenantId, { status, search, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const conditions = ['b.tenant_id = $1'];
    const params = [tenantId];
    let idx = 2;

    if (search) {
      conditions.push(`(b.name ILIKE $${idx} OR b.code ILIKE $${idx} OR b.address ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    if (status) {
      conditions.push(`b.status = $${idx}`);
      params.push(status); idx++;
    }

    const where = conditions.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM branches b WHERE ${where}`, params);

    const result = await pool.query(
      `SELECT b.*,
              COUNT(DISTINCT r.id) as room_count,
              COALESCE(SUM(r.capacity), 0) as total_capacity
       FROM branches b
       LEFT JOIN rooms r ON r.branch_id = b.id
       WHERE ${where}
       GROUP BY b.id
       ORDER BY b.name
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return { total: parseInt(countResult.rows[0].count), page, limit, branches: result.rows };
  }

  async getById(tenantId, branchId) {
    const result = await pool.query(
      `SELECT b.* FROM branches b WHERE b.id = $1 AND b.tenant_id = $2`,
      [branchId, tenantId]
    );
    if (!result.rows.length) return null;

    const rooms = await pool.query(
      'SELECT * FROM rooms WHERE branch_id = $1 ORDER BY name',
      [branchId]
    );

    return { ...result.rows[0], rooms: rooms.rows };
  }

  async create(tenantId, data) {
    const { name, code, address, phone, status = 'active' } = data;
    const result = await pool.query(
      'INSERT INTO branches (tenant_id, name, code, address, phone, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [tenantId, name, code || null, address || null, phone || null, status]
    );
    return result.rows[0];
  }

  async update(tenantId, branchId, data) {
    const { name, code, address, phone, status } = data;
    const result = await pool.query(
      `UPDATE branches SET name=$1, code=$2, address=$3, phone=$4, status=$5, updated_at=NOW()
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [name, code || null, address || null, phone || null, status, branchId, tenantId]
    );
    return result.rows[0];
  }

  async delete(tenantId, branchId) {
    await pool.query('DELETE FROM branches WHERE id=$1 AND tenant_id=$2', [branchId, tenantId]);
  }

  async addRoom(tenantId, branchId, data) {
    const { name, code, capacity, status = 'active' } = data;
    const result = await pool.query(
      'INSERT INTO rooms (tenant_id, branch_id, name, code, capacity, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [tenantId, branchId, name, code || null, capacity || 0, status]
    );
    return result.rows[0];
  }

  async updateRoom(tenantId, roomId, data) {
    const { name, code, capacity, status } = data;
    const result = await pool.query(
      `UPDATE rooms SET name=$1, code=$2, capacity=$3, status=$4, updated_at=NOW()
       WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [name, code || null, capacity || 0, status, roomId, tenantId]
    );
    return result.rows[0];
  }

  async deleteRoom(tenantId, roomId) {
    await pool.query('DELETE FROM rooms WHERE id=$1 AND tenant_id=$2', [roomId, tenantId]);
  }
}

module.exports = new BranchService();
