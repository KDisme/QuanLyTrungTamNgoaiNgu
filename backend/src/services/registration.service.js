const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

/**
 * Chuyển tên trung tâm thành slug URL-safe
 * VD: "ABC English Center!" -> "abc-english-center"
 */
function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')    // Bỏ dấu tiếng Việt
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')       // Giữ lại a-z, 0-9, khoảng trắng, gạch ngang
    .trim()
    .replace(/[\s_]+/g, '-')             // Thay khoảng trắng bằng gạch ngang
    .replace(/-+/g, '-')                 // Loại bỏ gạch ngang liên tiếp
    .replace(/^-|-$/g, '');              // Cắt gạch ngang đầu/cuối
}

class RegistrationService {
  /**
   * Tạo slug duy nhất từ tên trung tâm
   * Nếu "abc-english" đã tồn tại, thử "abc-english-2", "abc-english-3", ...
   */
  async generateUniqueSlug(name) {
    const base = slugify(name) || 'trungtam';
    let slug = base;
    let suffix = 2;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await pool.query('SELECT 1 FROM tenants WHERE slug = $1', [slug]);
      if (!existing.rows.length) return slug;
      slug = `${base}-${suffix}`;
      suffix++;
    }
  }

  /**
   * Đăng ký tenant mới
   * - Tạo tenant (is_active = true)
   * - Tạo user admin với email/password
   * - Gán role 'admin'
   * - Trả về JWT token để đăng nhập luôn
   */
  async register({ name, slug, email, password, fullName }) {
    // Validate độ dài mật khẩu
    if (!password || password.length < 6) {
      throw Object.assign(new Error('Mật khẩu phải có ít nhất 6 ký tự'), { status: 400 });
    }

    // Validate tên trung tâm
    if (!name || name.trim().length < 2) {
      throw Object.assign(new Error('Tên trung tâm phải có ít nhất 2 ký tự'), { status: 400 });
    }

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw Object.assign(new Error('Email không hợp lệ'), { status: 400 });
    }

    // Xử lý slug: ưu tiên slug từ client gửi lên, nếu không có mới tự sinh
    let finalSlug = slug ? slugify(slug) : await this.generateUniqueSlug(name.trim());
    if (!finalSlug) {
      throw Object.assign(new Error('Đường dẫn (slug) không hợp lệ'), { status: 400 });
    }

    // Kiểm tra slug đã tồn tại chưa
    const existingSlug = await pool.query('SELECT 1 FROM tenants WHERE slug = $1', [finalSlug]);
    if (existingSlug.rows.length) {
      throw Object.assign(new Error('Đường dẫn (slug) này đã được sử dụng, vui lòng chọn đường dẫn khác'), { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const adminFullName = (fullName || name).trim();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Tạo tenant
      const tenantResult = await client.query(
        `INSERT INTO tenants (name, slug, email, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, name, slug`,
        [name.trim(), finalSlug, email.toLowerCase()]
      );
      const tenant = tenantResult.rows[0];

      // 2. Kiểm tra email đã tồn tại trong tenant này chưa (trường hợp cực kỳ hiếm)
      const emailCheck = await client.query(
        'SELECT 1 FROM users WHERE tenant_id = $1 AND email = $2',
        [tenant.id, email.toLowerCase()]
      );
      if (emailCheck.rows.length) {
        throw Object.assign(new Error('Email này đã được sử dụng'), { status: 409 });
      }

      // 3. Tạo user admin
      const userResult = await client.query(
        `INSERT INTO users (tenant_id, full_name, email, password_hash, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id, tenant_id, full_name, email`,
        [tenant.id, adminFullName, email.toLowerCase(), passwordHash]
      );
      const user = userResult.rows[0];

      // 4. Gán role admin
      await client.query(
        `INSERT INTO roles (tenant_id, user_id, role_type)
         VALUES ($1, $2, 'admin')`,
        [tenant.id, user.id]
      );

      await client.query('COMMIT');

      // 5. Tạo JWT token để đăng nhập ngay
      const token = jwt.sign(
        {
          userId: user.id,
          tenantId: tenant.id,
          roles: ['admin'],
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return {
        token,
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          roles: ['admin'],
          tenantId: tenant.id,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Kiểm tra tên trung tâm để preview slug (không tạo DB)
   */
  async previewSlug(name) {
    if (!name || !name.trim()) return '';
    const slug = await this.generateUniqueSlug(name.trim());
    return slug;
  }
}

module.exports = new RegistrationService();
