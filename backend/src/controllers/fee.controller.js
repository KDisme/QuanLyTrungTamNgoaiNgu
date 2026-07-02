const feeService = require('../services/fee.service');
const pool = require('../config/database');

class FeeController {
  // Templates
  async getTemplates(req, res, next) {
    try { res.json(await feeService.getTemplates(req.tenant.id)); } catch (err) { next(err); }
  }
  async createTemplate(req, res, next) {
    try { res.status(201).json(await feeService.createTemplate(req.tenant.id, req.body)); } catch (err) { next(err); }
  }
  async updateTemplate(req, res, next) {
    try { res.json(await feeService.updateTemplate(req.tenant.id, parseInt(req.params.id), req.body)); } catch (err) { next(err); }
  }

  // Collections
  async getCollections(req, res, next) {
    try { res.json(await feeService.getCollections(req.tenant.id, req.query)); } catch (err) { next(err); }
  }
  async getCollectionById(req, res, next) {
    try {
      const c = await feeService.getCollectionById(req.tenant.id, parseInt(req.params.id));
      if (!c) return res.status(404).json({ message: 'Not found' });
      res.json(c);
    } catch (err) { next(err); }
  }
  async createCollection(req, res, next) {
    try { res.status(201).json(await feeService.createCollection(req.tenant.id, req.body, req.user.id)); } catch (err) { next(err); }
  }
  async activateCollection(req, res, next) {
    try { res.json(await feeService.activateCollection(req.tenant.id, parseInt(req.params.id))); } catch (err) { next(err); }
  }
  async closeCollection(req, res, next) {
    try { res.json(await feeService.closeCollection(req.tenant.id, parseInt(req.params.id))); } catch (err) { next(err); }
  }
  async cancelCollection(req, res, next) {
    try { res.json(await feeService.cancelCollection(req.tenant.id, parseInt(req.params.id))); } catch (err) { next(err); }
  }

  // Transactions
  async recordPayment(req, res, next) {
    try {
      res.status(201).json(
        await feeService.recordPayment(req.tenant.id, parseInt(req.params.itemId), req.body, req.user.id)
      );
    } catch (err) { next(err); }
  }
  async cancelTransaction(req, res, next) {
    try { res.json(await feeService.cancelTransaction(req.tenant.id, parseInt(req.params.id), req.user.id)); } catch (err) { next(err); }
  }
  async getTransactionHistory(req, res, next) {
    try {
      const h = await feeService.getTransactionHistory(req.tenant.id, parseInt(req.params.itemId));
      if (!h) return res.status(404).json({ message: 'Not found' });
      res.json(h);
    } catch (err) { next(err); }
  }

  async getStudentCollections(req, res, next) {
    try {
      res.json(await feeService.getStudentCollections(req.tenant.id, parseInt(req.params.studentId)));
    } catch (err) { next(err); }
  }

  // Dashboard
  async getDashboard(req, res, next) {
    try {
      const roles = req.user?.roles || [];
      const isAdminStaff = roles.includes('admin') || roles.includes('staff');
      if (isAdminStaff) return res.json(await feeService.getDashboardStats(req.tenant.id, req.query));

      if (roles.includes('teacher')) {
        const [classes, schedules, students] = await Promise.all([
          pool.query(`SELECT COUNT(DISTINCT class_id)::int AS total FROM class_teachers WHERE tenant_id=$1 AND teacher_id=$2`, [req.tenant.id, req.user.id]),
          pool.query(`SELECT COUNT(*)::int AS total FROM schedules WHERE tenant_id=$1 AND teacher_id=$2 AND session_date >= CURRENT_DATE AND status='scheduled'`, [req.tenant.id, req.user.id]),
          pool.query(`SELECT COUNT(DISTINCT cs.student_id)::int AS total
                      FROM class_teachers ct JOIN class_students cs ON cs.class_id=ct.class_id AND cs.tenant_id=ct.tenant_id
                      WHERE ct.tenant_id=$1 AND ct.teacher_id=$2 AND cs.status='active'`, [req.tenant.id, req.user.id]),
        ]);
        return res.json({
          scope: 'teacher',
          myClasses: classes.rows[0].total,
          myUpcomingSessions: schedules.rows[0].total,
          myStudents: students.rows[0].total,
        });
      }

      if (roles.includes('student')) {
        const [classes, schedules, fees, attendance] = await Promise.all([
          pool.query(`SELECT COUNT(*)::int AS total FROM class_students WHERE tenant_id=$1 AND student_id=$2 AND status='active'`, [req.tenant.id, req.user.id]),
          pool.query(`SELECT COUNT(*)::int AS total
                      FROM schedules s JOIN class_students cs ON cs.class_id=s.class_id AND cs.tenant_id=s.tenant_id
                      WHERE s.tenant_id=$1 AND cs.student_id=$2 AND cs.status='active' AND s.session_date >= CURRENT_DATE AND s.status='scheduled'`, [req.tenant.id, req.user.id]),
          pool.query(`SELECT COUNT(*)::int AS pending_count, COALESCE(SUM(amount_due - amount_paid), 0)::numeric AS pending_amount
                      FROM fee_collection_items WHERE tenant_id=$1 AND student_id=$2 AND status IN ('pending','partial')`, [req.tenant.id, req.user.id]),
          pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status IN ('present','late'))::int AS attended
                      FROM attendance WHERE tenant_id=$1 AND student_id=$2`, [req.tenant.id, req.user.id]),
        ]);
        return res.json({
          scope: 'student',
          myClasses: classes.rows[0].total,
          myUpcomingSessions: schedules.rows[0].total,
          myPendingFees: fees.rows[0],
          myAttendance: attendance.rows[0],
        });
      }

      return res.status(403).json({ message: 'Forbidden' });
    } catch (err) { next(err); }
  }

  // Expenses
  async getExpenses(req, res, next) {
    try { res.json(await feeService.getExpenses(req.tenant.id, req.query)); } catch (err) { next(err); }
  }
  async createExpense(req, res, next) {
    try { res.status(201).json(await feeService.createExpense(req.tenant.id, req.body, req.user.id)); } catch (err) { next(err); }
  }
  async updateExpense(req, res, next) {
    try { res.json(await feeService.updateExpense(req.tenant.id, parseInt(req.params.id), req.body)); } catch (err) { next(err); }
  }
  async deleteExpense(req, res, next) {
    try { await feeService.deleteExpense(req.tenant.id, parseInt(req.params.id)); res.json({ ok: true }); } catch (err) { next(err); }
  }
}

module.exports = new FeeController();
