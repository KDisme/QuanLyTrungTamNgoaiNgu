const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

class AuthService {
  /**
   * Portal login: find tenant by owner email
   */
  async portalFindTenant(email) {
    const result = await pool.query(
      `SELECT t.id, t.name, t.slug FROM tenants t
       JOIN users u ON u.tenant_id = t.id
       JOIN roles r ON r.user_id = u.id AND r.tenant_id = t.id
       WHERE u.email = $1 AND r.role_type = 'admin' AND t.is_active = TRUE`,
      [email]
    );
    return result.rows;
  }

  /**
   * Login with email/phone + password within a tenant
   */
  async login(tenantId, identifier, password) {
    const result = await pool.query(
      `SELECT u.*, array_agg(r.role_type) as roles
       FROM users u
       LEFT JOIN roles r ON r.user_id = u.id AND r.tenant_id = u.tenant_id
       WHERE u.tenant_id = $1 AND (u.email = $2 OR u.phone = $2) AND u.is_active = TRUE
       GROUP BY u.id`,
      [tenantId, identifier]
    );

    if (!result.rows.length) throw new Error('Invalid credentials');

    const user = result.rows[0];
    if (!user.password_hash) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error('Invalid credentials');

    const token = this.generateToken(user);

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    return {
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        roles: user.roles.filter(Boolean),
        tenantId: user.tenant_id,
      },
    };
  }

  generateToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        roles: (user.roles || []).filter(Boolean),
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }
}

module.exports = new AuthService();
