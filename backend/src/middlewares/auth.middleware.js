const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const hasAnyRole = (user, roles = []) => {
  const userRoles = user?.roles || [];
  return roles.some((role) => userRoles.includes(role));
};

const isAdminOrStaff = (user) => hasAnyRole(user, ['admin', 'staff']);
const isTeacher = (user) => hasAnyRole(user, ['teacher']);
const isStudent = (user) => hasAnyRole(user, ['student']);

/**
 * Resolve tenant from slug in URL
 * Routes: /:tenantSlug/...
 */
const resolveTenant = async (req, res, next) => {
  const slug = req.params.tenantSlug;
  if (!slug) return res.status(400).json({ message: 'Tenant slug is required' });

  try {
    const result = await pool.query(
      'SELECT id, name, slug, is_active FROM tenants WHERE slug = $1',
      [slug]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Tenant not found' });
    const tenant = result.rows[0];
    if (!tenant.is_active) return res.status(403).json({ message: 'Tenant is inactive' });
    req.tenant = tenant;
    next();
  } catch (err) { next(err); }
};

/**
 * Verify JWT token
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kiểm tra tenant trong JWT phải khớp với tenant trong URL
    // Ngăn admin tenant A đổi URL sang slug tenant B để thao tác dữ liệu
    if (req.tenant && Number(decoded.tenantId) !== Number(req.tenant.id)) {
      return res.status(403).json({ message: 'Tenant mismatch: token không hợp lệ cho tenant này' });
    }

    const result = await pool.query(
      'SELECT id, tenant_id, full_name, email, is_active FROM users WHERE id = $1 AND tenant_id = $2',
      [decoded.userId, decoded.tenantId]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    // Lấy roles từ DB thay vì tin decoded.roles trong JWT
    // Đảm bảo quyền bị thu hồi có hiệu lực ngay, không cần đợi token hết hạn
    const rolesResult = await pool.query(
      'SELECT role_type FROM roles WHERE user_id = $1 AND tenant_id = $2',
      [decoded.userId, decoded.tenantId]
    );
    const roles = rolesResult.rows.map((r) => r.role_type);

    req.user = { ...result.rows[0], roles };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Require specific role(s)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!hasAnyRole(req.user, roles)) return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
  next();
};

const requireSelfOrRole = (paramName, ...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const targetId = Number(req.params[paramName]);
  if (hasAnyRole(req.user, roles) || Number(req.user.id) === targetId) return next();
  return res.status(403).json({ message: 'Forbidden: only own data is allowed' });
};

const requireStudentAccess = (paramName = 'studentId') => async (req, res, next) => {
  try {
    const studentId = Number(req.params[paramName]);
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (isAdminOrStaff(req.user)) return next();
    if (isStudent(req.user) && Number(req.user.id) === studentId) return next();
    if (isTeacher(req.user)) {
      const result = await pool.query(
        `SELECT 1
         FROM class_teachers ct
         JOIN class_students cs ON cs.class_id = ct.class_id AND cs.tenant_id = ct.tenant_id
         WHERE ct.tenant_id=$1 AND ct.teacher_id=$2 AND cs.student_id=$3 AND cs.status='active'
         LIMIT 1`,
        [req.tenant.id, req.user.id, studentId]
      );
      if (result.rows.length) return next();
    }
    return res.status(403).json({ message: 'Forbidden: student data is outside your scope' });
  } catch (err) { next(err); }
};

const requireClassAccess = (paramName = 'id') => async (req, res, next) => {
  try {
    const classId = Number(req.params[paramName]);
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (isAdminOrStaff(req.user)) return next();
    const checks = [];
    const params = [req.tenant.id, classId, req.user.id];
    if (isTeacher(req.user)) checks.push('EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.tenant_id=$1 AND ct.class_id=$2 AND ct.teacher_id=$3)');
    if (isStudent(req.user)) checks.push("EXISTS (SELECT 1 FROM class_students cs WHERE cs.tenant_id=$1 AND cs.class_id=$2 AND cs.student_id=$3 AND cs.status='active')");
    if (!checks.length) return res.status(403).json({ message: 'Forbidden' });
    const result = await pool.query(`SELECT 1 WHERE ${checks.join(' OR ')} LIMIT 1`, params);
    if (result.rows.length) return next();
    return res.status(403).json({ message: 'Forbidden: class is outside your scope' });
  } catch (err) { next(err); }
};

const requireScheduleAccess = (paramName = 'id', { write = false } = {}) => async (req, res, next) => {
  try {
    const scheduleId = Number(req.params[paramName]);
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (isAdminOrStaff(req.user)) return next();

    const result = await pool.query(
      `SELECT s.id, s.teacher_id, s.class_id,
              EXISTS (SELECT 1 FROM class_students cs WHERE cs.tenant_id=s.tenant_id AND cs.class_id=s.class_id AND cs.student_id=$3 AND cs.status='active') AS is_student_in_class
       FROM schedules s
       WHERE s.id=$1 AND s.tenant_id=$2`,
      [scheduleId, req.tenant.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Schedule not found' });
    const schedule = result.rows[0];
    if (isTeacher(req.user) && Number(schedule.teacher_id) === Number(req.user.id)) return next();
    if (!write && isStudent(req.user) && schedule.is_student_in_class) return next();
    return res.status(403).json({ message: 'Forbidden: schedule is outside your scope' });
  } catch (err) { next(err); }
};

const requireFeeItemAccess = (paramName = 'itemId') => async (req, res, next) => {
  try {
    const itemId = Number(req.params[paramName]);
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (isAdminOrStaff(req.user)) return next();
    if (isStudent(req.user)) {
      const result = await pool.query(
        'SELECT 1 FROM fee_collection_items WHERE id=$1 AND tenant_id=$2 AND student_id=$3 LIMIT 1',
        [itemId, req.tenant.id, req.user.id]
      );
      if (result.rows.length) return next();
    }
    return res.status(403).json({ message: 'Forbidden: fee item is outside your scope' });
  } catch (err) { next(err); }
};

const requireMockExamStudentAccess = (paramName = 'mockExamStudentId', { write = false } = {}) => async (req, res, next) => {
  try {
    const id = Number(req.params[paramName]);
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!write && isAdminOrStaff(req.user)) return next();

    const result = await pool.query(
      `SELECT mes.student_id, me.class_id,
              EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.tenant_id=mes.tenant_id AND ct.class_id=me.class_id AND ct.teacher_id=$3) AS is_teacher_of_exam_class
       FROM mock_exam_students mes
       JOIN mock_exams me ON me.id = mes.mock_exam_id
       WHERE mes.id=$1 AND mes.tenant_id=$2`,
      [id, req.tenant.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Mock exam assignment not found' });
    const row = result.rows[0];
    if (isStudent(req.user) && Number(row.student_id) === Number(req.user.id)) return next();
    if (!write && isTeacher(req.user) && row.is_teacher_of_exam_class) return next();
    return res.status(403).json({ message: 'Forbidden: mock exam is outside your scope' });
  } catch (err) { next(err); }
};

module.exports = {
  resolveTenant,
  authenticate,
  requireRole,
  requireSelfOrRole,
  requireStudentAccess,
  requireClassAccess,
  requireScheduleAccess,
  requireFeeItemAccess,
  requireMockExamStudentAccess,
  hasAnyRole,
};
