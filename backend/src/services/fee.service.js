const pool = require('../config/database');
const activityLogService = require('./activityLog.service');

class FeeService {
  // ---- FEE TEMPLATES ----
  async getTemplates(tenantId) {
    const result = await pool.query(
      'SELECT * FROM fee_templates WHERE tenant_id=$1 AND is_active=TRUE ORDER BY name',
      [tenantId]
    );
    return result.rows;
  }

  async createTemplate(tenantId, data) {
    const { name, amount, description } = data;
    const result = await pool.query(
      'INSERT INTO fee_templates (tenant_id, name, amount, description) VALUES ($1,$2,$3,$4) RETURNING *',
      [tenantId, name, amount, description || null]
    );
    return result.rows[0];
  }

  async updateTemplate(tenantId, id, data) {
    const { name, amount, description, isActive } = data;
    const result = await pool.query(
      'UPDATE fee_templates SET name=$1, amount=$2, description=$3, is_active=$4, updated_at=NOW() WHERE id=$5 AND tenant_id=$6 RETURNING *',
      [name, amount, description || null, isActive !== undefined ? isActive : true, id, tenantId]
    );
    return result.rows[0];
  }

  // ---- FEE COLLECTIONS ----
  async getCollections(tenantId, { classId, status, page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;
    const conditions = ['fc.tenant_id = $1'];
    const params = [tenantId];
    let idx = 2;

    if (classId) {
      conditions.push(`EXISTS (SELECT 1 FROM fee_collection_classes fcc2 WHERE fcc2.collection_id=fc.id AND fcc2.class_id=$${idx})`);
      params.push(classId); idx++;
    }
    if (status && status !== 'cancelled') {
      conditions.push(`fc.status = $${idx}`); params.push(status); idx++;
    } else if (status === 'cancelled') {
      conditions.push(`fc.status = 'cancelled'`);
    } else {
      conditions.push(`fc.status != 'cancelled'`);
    }

    const where = conditions.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM fee_collections fc WHERE ${where}`, params);

    const result = await pool.query(
      `SELECT fc.*,
              ft.name as template_name, ft.amount as template_amount,
              COUNT(DISTINCT fci.id) as total_items,
              COUNT(DISTINCT CASE WHEN fci.status='paid' THEN fci.id END) as paid_count,
              COALESCE(SUM(fci.amount_paid), 0) as collected_amount,
              COALESCE(SUM(fci.amount_due), 0) as total_due,
              (SELECT string_agg(c.name, ', ' ORDER BY c.name)
               FROM fee_collection_classes fcc JOIN classes c ON c.id=fcc.class_id
               WHERE fcc.collection_id=fc.id) as class_names
       FROM fee_collections fc
       LEFT JOIN fee_templates ft ON ft.id = fc.fee_template_id
       LEFT JOIN fee_collection_items fci ON fci.collection_id = fc.id
       WHERE ${where}
       GROUP BY fc.id, ft.name, ft.amount
       ORDER BY fc.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return { total: parseInt(countResult.rows[0].count), page, limit, collections: result.rows };
  }

  async getCollectionById(tenantId, collectionId) {
    const result = await pool.query(
      `SELECT fc.*,
              ft.name as template_name, ft.amount as template_amount,
              u.full_name as created_by_name
       FROM fee_collections fc
       LEFT JOIN fee_templates ft ON ft.id = fc.fee_template_id
       LEFT JOIN users u ON u.id = fc.created_by
       WHERE fc.id=$1 AND fc.tenant_id=$2`,
      [collectionId, tenantId]
    );
    if (!result.rows.length) return null;
    const collection = result.rows[0];

    const classesResult = await pool.query(
      `SELECT c.id, c.name, c.code FROM fee_collection_classes fcc
       JOIN classes c ON c.id = fcc.class_id
       WHERE fcc.collection_id=$1`,
      [collectionId]
    );

    const items = await pool.query(
      `SELECT fci.*, u.full_name, u.phone, sp.student_code,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', ftx.id,
                    'amount', ftx.amount,
                    'payment_method', ftx.payment_method,
                    'bill_number', ftx.bill_number,
                    'paid_at', ftx.paid_at,
                    'paid_date', ftx.paid_date,
                    'note', ftx.note,
                    'is_cancelled', ftx.is_cancelled,
                    'cancelled_at', ftx.cancelled_at,
                    'collected_by_name', ucol.full_name
                  ) ORDER BY ftx.paid_at DESC
                ) FILTER (WHERE ftx.id IS NOT NULL),
                '[]'
              ) as transactions
       FROM fee_collection_items fci
       JOIN users u ON u.id = fci.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id AND sp.tenant_id = u.tenant_id
       LEFT JOIN fee_transactions ftx ON ftx.item_id = fci.id
       LEFT JOIN users ucol ON ucol.id = ftx.collected_by
       WHERE fci.collection_id = $1
       GROUP BY fci.id, u.full_name, u.phone, sp.student_code
       ORDER BY u.full_name`,
      [collectionId]
    );

    return { ...collection, classes: classesResult.rows, items: items.rows };
  }

  async createCollection(tenantId, data, userId, user) {
    const {
      name, feeTemplateId, cycleType = 'monthly', description,
      startDate, endDate, graceDays = 7, dueDate,
      scopeType = 'class', classIds = [], studentIds = [],
      totalAmount
    } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Khóa advisory cấp transaction theo tenant để ngăn race-condition khi sinh mã đợt thu đồng thời
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [tenantId, 1002]);

      let collectionCode;
      try {
        const codeRes = await client.query('SELECT generate_collection_code($1) as code', [tenantId]);
        collectionCode = codeRes.rows[0].code;
      } catch {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const prefix = `HP-${yearMonth}`;
        const maxRes = await client.query(
          `SELECT COALESCE(MAX(CAST(SUBSTRING(collection_code FROM 10) AS INTEGER)), 0) + 1 AS next_n
           FROM fee_collections
           WHERE tenant_id = $1 AND collection_code ~ $2`,
          [tenantId, `^${prefix}[0-9]+$`]
        );
        const nextN = parseInt(maxRes.rows[0].next_n, 10) || 1;
        collectionCode = `${prefix}${String(nextN).padStart(4, '0')}`;
      }

      let amount = parseFloat(totalAmount) || 0;
      if (feeTemplateId && !amount) {
        // Thêm tenant_id để ngăn dùng template của tenant khác
        const tmpl = await client.query('SELECT amount FROM fee_templates WHERE id=$1 AND tenant_id=$2', [feeTemplateId, tenantId]);
        if (tmpl.rows.length) amount = parseFloat(tmpl.rows[0].amount);
      }

      const result = await client.query(
        `INSERT INTO fee_collections
          (tenant_id, name, collection_code, fee_template_id, cycle_type, description,
           start_date, end_date, due_date, grace_days, scope_type, total_amount, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [tenantId, name, collectionCode, feeTemplateId || null, cycleType, description || null,
         startDate || null, endDate || null, dueDate || null, graceDays || 7, scopeType,
         amount, userId]
      );
      const collection = result.rows[0];

      for (const classId of (classIds || [])) {
        await client.query(
          'INSERT INTO fee_collection_classes (tenant_id, collection_id, class_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [tenantId, collection.id, classId]
        );
      }

      // Nếu scope theo từng học viên (scopeType='student'), tạo sẵn item cho các studentIds
      if (scopeType === 'student') {
        for (const studentId of (studentIds || [])) {
          await client.query(
            `INSERT INTO fee_collection_items (tenant_id, collection_id, student_id, amount_due)
             VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
            [tenantId, collection.id, studentId, amount]
          );
        }
      }

      await client.query('COMMIT');

      activityLogService.log(tenantId, user, {
        actionType: 'create',
        entityType: 'fee_collection',
        entityId: collection.id,
        entityName: collection.name,
        description: `đã tạo đợt thu học phí "${collection.name}" (${collection.collection_code})`,
        metadata: { totalAmount: amount, scopeType, classIds },
      }).catch((err) => console.error('Failed to log fee collection creation:', err));

      return collection;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async activateCollection(tenantId, collectionId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const colRes = await client.query(
        'SELECT * FROM fee_collections WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
        [collectionId, tenantId]
      );
      if (!colRes.rows.length) throw new Error('Không tìm thấy đợt thu');
      const col = colRes.rows[0];
      if (col.status !== 'draft') throw new Error('Chỉ có thể kích hoạt đợt thu ở trạng thái Nháp');

      // Get all students from linked classes
      const classStudents = await client.query(
        `SELECT DISTINCT cs.student_id
         FROM fee_collection_classes fcc
         JOIN class_students cs ON cs.class_id = fcc.class_id AND cs.status = 'active'
         WHERE fcc.collection_id = $1`,
        [collectionId]
      );

      const existingItems = await client.query(
        'SELECT student_id FROM fee_collection_items WHERE collection_id=$1',
        [collectionId]
      );
      const existingIds = new Set(existingItems.rows.map(r => r.student_id));

      for (const row of classStudents.rows) {
        if (!existingIds.has(row.student_id)) {
          await client.query(
            `INSERT INTO fee_collection_items (tenant_id, collection_id, student_id, amount_due)
             VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
            [tenantId, collectionId, row.student_id, col.total_amount]
          );
        }
      }

      const updated = await client.query(
        `UPDATE fee_collections SET status='active', activated_at=NOW(), updated_at=NOW()
         WHERE id=$1 AND tenant_id=$2 RETURNING *`,
        [collectionId, tenantId]
      );

      await client.query('COMMIT');
      return updated.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async closeCollection(tenantId, collectionId) {
    const result = await pool.query(
      `UPDATE fee_collections SET status='closed', closed_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND tenant_id=$2 AND status='active' RETURNING *`,
      [collectionId, tenantId]
    );
    if (!result.rows.length) throw new Error('Không thể đóng đợt thu này');
    return result.rows[0];
  }

  async cancelCollection(tenantId, collectionId) {
    const result = await pool.query(
      `UPDATE fee_collections SET status='cancelled', cancelled_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND tenant_id=$2 AND status='draft' RETURNING *`,
      [collectionId, tenantId]
    );
    if (!result.rows.length) throw new Error('Chỉ có thể hủy đợt thu ở trạng thái Nháp');
    return result.rows[0];
  }

  // ---- TRANSACTIONS ----
  async recordPayment(tenantId, itemId, data, userId, user) {
    const { amount, paymentMethod = 'cash', note, paidDate } = data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const itemCheck = await client.query(
        `SELECT fci.*, fc.status as collection_status
         FROM fee_collection_items fci
         JOIN fee_collections fc ON fc.id=fci.collection_id
         WHERE fci.id=$1 AND fci.tenant_id=$2 FOR UPDATE`,
        [itemId, tenantId]
      );
      if (!itemCheck.rows.length) throw new Error('Không tìm thấy khoản thu');
      const item = itemCheck.rows[0];
      if (item.collection_status !== 'active') throw new Error('Đợt thu chưa được kích hoạt');
      if (parseFloat(amount) <= 0) throw new Error('Số tiền không hợp lệ');
      // Chặn thu vượt khoản phải nộp
      const remaining = parseFloat(item.amount_due) - parseFloat(item.amount_paid);
      if (parseFloat(amount) > remaining + 0.01) { // 0.01 để bù sai số float
        throw new Error(`Số tiền thu (${Number(amount).toLocaleString('vi-VN')}đ) vượt quá số còn nợ (${remaining.toLocaleString('vi-VN')}đ)`);
      }

      const txResult = await client.query(
        `INSERT INTO fee_transactions (tenant_id, item_id, amount, payment_method, collected_by, note, paid_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [tenantId, itemId, amount, paymentMethod, userId, note || null, paidDate || null]
      );

      const itemResult = await client.query(
        `UPDATE fee_collection_items
         SET amount_paid = amount_paid + $1,
             status = CASE
               WHEN amount_paid + $1 >= amount_due THEN 'paid'
               WHEN amount_paid + $1 > 0 THEN 'partial'
               ELSE 'pending'
             END,
             updated_at = NOW()
         WHERE id=$2 RETURNING *`,
        [amount, itemId]
      );

      await client.query('COMMIT');

      const studentInfo = await pool.query(
        `SELECT u.full_name, fc.name AS collection_name
         FROM fee_collection_items fci
         JOIN users u ON u.id = fci.student_id
         JOIN fee_collections fc ON fc.id = fci.collection_id
         WHERE fci.id = $1`,
        [itemId]
      );
      const info = studentInfo.rows[0] || {};

      activityLogService.log(tenantId, user, {
        actionType: 'payment',
        entityType: 'fee_transaction',
        entityId: txResult.rows[0].id,
        entityName: info.collection_name || null,
        description: `đã ghi nhận thanh toán ${Number(amount).toLocaleString('vi-VN')}đ cho học viên "${info.full_name || ''}" - đợt thu "${info.collection_name || ''}"`,
        metadata: { amount, paymentMethod, itemId },
      }).catch((err) => console.error('Failed to log fee payment:', err));

      return { transaction: txResult.rows[0], item: itemResult.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async cancelTransaction(tenantId, transactionId, userId, user) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const txCheck = await client.query(
        `SELECT ft.* FROM fee_transactions ft
         WHERE ft.id=$1 AND ft.tenant_id=$2 AND ft.is_cancelled=FALSE FOR UPDATE`,
        [transactionId, tenantId]
      );
      if (!txCheck.rows.length) throw new Error('Không tìm thấy giao dịch hoặc đã bị hủy');
      const tx = txCheck.rows[0];

      const txResult = await client.query(
        `UPDATE fee_transactions SET is_cancelled=TRUE, cancelled_at=NOW(), cancelled_by=$1
         WHERE id=$2 RETURNING *`,
        [userId, transactionId]
      );

      await client.query(
        `UPDATE fee_collection_items
         SET amount_paid = GREATEST(0, amount_paid - $1),
             status = CASE
               WHEN GREATEST(0, amount_paid - $1) <= 0 THEN 'pending'
               WHEN GREATEST(0, amount_paid - $1) < amount_due THEN 'partial'
               ELSE 'paid'
             END,
             updated_at = NOW()
         WHERE id=$2`,
        [tx.amount, tx.item_id]
      );

      await client.query('COMMIT');

      activityLogService.log(tenantId, user, {
        actionType: 'delete',
        entityType: 'fee_transaction',
        entityId: transactionId,
        entityName: null,
        description: `đã huỷ giao dịch thanh toán ${Number(tx.amount).toLocaleString('vi-VN')}đ`,
        metadata: { amount: tx.amount, itemId: tx.item_id },
      }).catch((err) => console.error('Failed to log transaction cancellation:', err));

      return txResult.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getTransactionHistory(tenantId, itemId) {
    const itemCheck = await pool.query(
      `SELECT fci.*, u.full_name, sp.student_code,
              fc.name as collection_name, fc.total_amount
       FROM fee_collection_items fci
       JOIN fee_collections fc ON fc.id = fci.collection_id
       JOIN users u ON u.id = fci.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE fci.id=$1 AND fci.tenant_id=$2`,
      [itemId, tenantId]
    );
    if (!itemCheck.rows.length) return null;

    const txs = await pool.query(
      `SELECT ft.*, ucol.full_name as collector_name, ucan.full_name as canceller_name
       FROM fee_transactions ft
       LEFT JOIN users ucol ON ucol.id = ft.collected_by
       LEFT JOIN users ucan ON ucan.id = ft.cancelled_by
       WHERE ft.item_id=$1
       ORDER BY ft.paid_at DESC`,
      [itemId]
    );

    return { ...itemCheck.rows[0], transactions: txs.rows };
  }

  async getStudentCollections(tenantId, studentId) {
    const result = await pool.query(
      `SELECT fci.*, fc.name as collection_name, fc.due_date, fc.status as collection_status,
              fc.collection_code, fc.start_date, fc.end_date
       FROM fee_collection_items fci
       JOIN fee_collections fc ON fc.id = fci.collection_id
       WHERE fci.tenant_id = $1 AND fci.student_id = $2
       ORDER BY fc.due_date DESC NULLS LAST, fc.created_at DESC`,
      [tenantId, studentId]
    );
    return result.rows;
  }

  // ---- DASHBOARD ----
  async getDashboardStats(tenantId, { month, year } = {}) {
    const now = new Date();
    const m = parseInt(month) || (now.getMonth() + 1);
    const y = parseInt(year) || now.getFullYear();

    const [students, classes, teachers, todaySessions, revenue, revenueByDay, debtAging, debtTopList, branchStats, 
      expensesRes, pendingHomework, pendingMockExams, weeklyAttendance, studentStatusDist, topClasses] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM users u JOIN roles r ON r.user_id=u.id
         WHERE u.tenant_id=$1 AND r.role_type='student' AND u.is_active=TRUE`,
        [tenantId]
      ),
      pool.query(`SELECT COUNT(*) FROM classes WHERE tenant_id=$1 AND status='active'`, [tenantId]),
      pool.query(
        `SELECT COUNT(DISTINCT u.id)
         FROM users u
         JOIN roles r ON r.user_id = u.id AND r.tenant_id = u.tenant_id
         WHERE u.tenant_id=$1 AND r.role_type='teacher' AND u.is_active=TRUE`,
        [tenantId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM schedules WHERE tenant_id=$1 AND session_date=CURRENT_DATE AND status='scheduled'`,
        [tenantId]
      ),
      pool.query(
        `SELECT payment_method, COALESCE(SUM(amount),0) as total, COUNT(*) as count
         FROM fee_transactions
         WHERE tenant_id=$1 AND is_cancelled=FALSE
           AND EXTRACT(MONTH FROM COALESCE(paid_date, paid_at))=$2 AND EXTRACT(YEAR FROM COALESCE(paid_date, paid_at))=$3
         GROUP BY payment_method`,
        [tenantId, m, y]
      ),
      pool.query(
        `SELECT DATE(COALESCE(paid_date, paid_at)) as day, SUM(amount) as amount
         FROM fee_transactions
         WHERE tenant_id=$1 AND is_cancelled=FALSE
           AND EXTRACT(MONTH FROM COALESCE(paid_date, paid_at))=$2 AND EXTRACT(YEAR FROM COALESCE(paid_date, paid_at))=$3
         GROUP BY DATE(COALESCE(paid_date, paid_at)) ORDER BY day`,
        [tenantId, m, y]
      ),
      pool.query(
        `SELECT
           COUNT(DISTINCT CASE WHEN CURRENT_DATE - fc.due_date BETWEEN 1 AND 30 THEN fci.student_id END) as days_1_30,
           COUNT(DISTINCT CASE WHEN CURRENT_DATE - fc.due_date BETWEEN 31 AND 60 THEN fci.student_id END) as days_31_60,
           COUNT(DISTINCT CASE WHEN CURRENT_DATE - fc.due_date BETWEEN 61 AND 90 THEN fci.student_id END) as days_61_90,
           COUNT(DISTINCT CASE WHEN CURRENT_DATE - fc.due_date > 90 THEN fci.student_id END) as days_90_plus,
           COALESCE(SUM(CASE WHEN CURRENT_DATE - fc.due_date BETWEEN 1 AND 30 THEN fci.amount_due - fci.amount_paid ELSE 0 END),0) as amt_1_30,
           COALESCE(SUM(CASE WHEN CURRENT_DATE - fc.due_date BETWEEN 31 AND 60 THEN fci.amount_due - fci.amount_paid ELSE 0 END),0) as amt_31_60,
           COALESCE(SUM(CASE WHEN CURRENT_DATE - fc.due_date BETWEEN 61 AND 90 THEN fci.amount_due - fci.amount_paid ELSE 0 END),0) as amt_61_90,
           COALESCE(SUM(CASE WHEN CURRENT_DATE - fc.due_date > 90 THEN fci.amount_due - fci.amount_paid ELSE 0 END),0) as amt_90_plus,
           COUNT(DISTINCT fci.student_id) as total_students_in_debt,
           COALESCE(SUM(fci.amount_due - fci.amount_paid),0) as total_debt,
           COUNT(DISTINCT fci.id) as total_overdue_items
         FROM fee_collection_items fci
         JOIN fee_collections fc ON fc.id = fci.collection_id
         WHERE fci.tenant_id=$1 AND fci.status IN ('pending','partial')
           AND fc.status='active' AND fc.due_date < CURRENT_DATE`,
        [tenantId]
      ),
      pool.query(
        `SELECT u.full_name, sp.student_code,
                SUM(fci.amount_due - fci.amount_paid) as debt_amount,
                COUNT(*) as overdue_collections,
                MAX(CURRENT_DATE - fc.due_date) as max_overdue_days
         FROM fee_collection_items fci
         JOIN fee_collections fc ON fc.id = fci.collection_id
         JOIN users u ON u.id = fci.student_id
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE fci.tenant_id=$1 AND fci.status IN ('pending','partial')
           AND fc.status='active' AND fc.due_date < CURRENT_DATE
         GROUP BY u.full_name, sp.student_code
         ORDER BY debt_amount DESC LIMIT 10`,
        [tenantId]
      ),
      pool.query(
        `SELECT b.name as branch_name, COUNT(DISTINCT cs.student_id) as student_count
         FROM branches b
         JOIN classes c ON c.branch_id=b.id AND c.status='active'
         JOIN class_students cs ON cs.class_id=c.id AND cs.status='active'
         WHERE b.tenant_id=$1
         GROUP BY b.id, b.name ORDER BY student_count DESC`,
        [tenantId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount),0) as total FROM expenses
         WHERE tenant_id=$1 AND is_active=TRUE
           AND EXTRACT(MONTH FROM expense_date)=$2 AND EXTRACT(YEAR FROM expense_date)=$3`,
        [tenantId, m, y]
      ).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(
        `SELECT COUNT(*) FROM homework_submissions hs
         JOIN homework_assignment_students has ON has.id = hs.assignment_student_id
         JOIN homework_assignments ha ON ha.id = has.assignment_id
         WHERE ha.tenant_id=$1 AND hs.status='submitted'`,
        [tenantId]
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT COUNT(*) FROM mock_exam_students mes
         JOIN mock_exams me ON me.id = mes.mock_exam_id
         WHERE me.tenant_id=$1 AND mes.status='submitted'`,
        [tenantId]
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT s.session_date,
                COUNT(*) FILTER (WHERE a.status = 'present') as present_count,
                COUNT(*) as total_count
         FROM attendance a
         JOIN schedules s ON s.id = a.schedule_id
         WHERE a.tenant_id=$1 AND s.session_date >= CURRENT_DATE - INTERVAL '6 days' AND s.session_date <= CURRENT_DATE
         GROUP BY s.session_date
         ORDER BY s.session_date`,
        [tenantId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT sp.study_status, COUNT(*) as count
         FROM student_profiles sp
         WHERE sp.tenant_id=$1
         GROUP BY sp.study_status`,
        [tenantId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT c.name, COUNT(cs.student_id) as student_count
         FROM classes c
         JOIN class_students cs ON cs.class_id=c.id AND cs.status='active'
         WHERE c.tenant_id=$1 AND c.status='active'
         GROUP BY c.id, c.name
         ORDER BY student_count DESC
         LIMIT 5`,
        [tenantId]
      ).catch(() => ({ rows: [] })),
    ]);

    const totalRevenue = revenue.rows.reduce((s, r) => s + parseFloat(r.total), 0);
    const totalExpenses = parseFloat(expensesRes.rows[0]?.total || 0);
    const totalTransactions = revenue.rows.reduce((s, r) => s + parseInt(r.count), 0);

    const pendingRes = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount_due - amount_paid),0) as total
       FROM fee_collection_items fci
       JOIN fee_collections fc ON fc.id=fci.collection_id
       WHERE fci.tenant_id=$1 AND fci.status IN ('pending','partial') AND fc.status='active'`,
      [tenantId]
    );

    return {
      students: parseInt(students.rows[0].count),
      activeClasses: parseInt(classes.rows[0].count),
      teachers: parseInt(teachers.rows[0].count),
      todaySessions: parseInt(todaySessions.rows[0].count),
      pendingHomeworkGrading: parseInt(pendingHomework.rows[0]?.count || 0),
      pendingMockExamGrading: parseInt(pendingMockExams.rows[0]?.count || 0),
      weeklyAttendance: weeklyAttendance.rows.map((row) => ({
        date: row.session_date,
        rate: Number(row.total_count) > 0 ? Math.round((Number(row.present_count) / Number(row.total_count)) * 100) : 0,
        present: Number(row.present_count),
        total: Number(row.total_count),
      })),
      studentStatusDistribution: studentStatusDist.rows.map((row) => ({
        status: row.study_status,
        count: Number(row.count),
      })),
      topClasses: topClasses.rows.map((row) => ({
        name: row.name,
        count: Number(row.student_count),
      })),
      revenue: {
        byMethod: revenue.rows,
        byDay: revenueByDay.rows,
        total: totalRevenue,
        month: m,
        year: y,
      },
      expenses: { total: totalExpenses },
      netProfit: totalRevenue - totalExpenses,
      transactions: totalTransactions,
      debtAging: {
        ...debtAging.rows[0],
        topDebtors: debtTopList.rows,
      },
      pendingInvoices: {
        count: parseInt(pendingRes.rows[0].count),
        total: parseFloat(pendingRes.rows[0].total),
      },
      branchStats: branchStats.rows,
    };
  }

  // ---- EXPENSES ----
  async getExpenses(tenantId, { page = 1, limit = 20, category, startDate, endDate } = {}) {
    const offset = (page - 1) * limit;
    const conditions = ['e.tenant_id=$1', 'e.is_active=TRUE'];
    const params = [tenantId];
    let idx = 2;
    if (category) { conditions.push(`e.category=$${idx}`); params.push(category); idx++; }
    if (startDate) { conditions.push(`e.expense_date>=$${idx}`); params.push(startDate); idx++; }
    if (endDate) { conditions.push(`e.expense_date<=$${idx}`); params.push(endDate); idx++; }
    const where = conditions.join(' AND ');
    const count = await pool.query(`SELECT COUNT(*) FROM expenses e WHERE ${where}`, params);
    const result = await pool.query(
      `SELECT e.*, u.full_name as created_by_name
       FROM expenses e LEFT JOIN users u ON u.id=e.created_by
       WHERE ${where} ORDER BY e.expense_date DESC LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset]
    );
    return { total: parseInt(count.rows[0].count), expenses: result.rows };
  }

  async createExpense(tenantId, data, userId) {
    const { amount, category, description, paymentMethod = 'cash', expenseDate } = data;
    const result = await pool.query(
      `INSERT INTO expenses (tenant_id, amount, category, description, payment_method, expense_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, amount, category || 'other', description, paymentMethod, expenseDate || null, userId]
    );
    return result.rows[0];
  }

  async updateExpense(tenantId, id, data) {
    const { amount, category, description, paymentMethod, expenseDate } = data;
    const result = await pool.query(
      `UPDATE expenses SET amount=$1, category=$2, description=$3, payment_method=$4,
       expense_date=$5, updated_at=NOW()
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [amount, category, description, paymentMethod, expenseDate, id, tenantId]
    );
    return result.rows[0];
  }

  async deleteExpense(tenantId, id) {
    await pool.query('UPDATE expenses SET is_active=FALSE WHERE id=$1 AND tenant_id=$2', [id, tenantId]);
  }
}

module.exports = new FeeService();
