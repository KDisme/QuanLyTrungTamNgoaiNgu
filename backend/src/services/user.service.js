const pool = require('../config/database');
const authService = require('./auth.service');

class UserService {
  async getAll(tenantId, { role, status, search, branchId, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const conditions = ['u.tenant_id = $1'];
    const params = [tenantId];
    let idx = 2;

    if (search) {
      conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.phone ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (status) {
      conditions.push(`u.is_active = $${idx}`);
      params.push(status === 'active');
      idx++;
    }

    let roleJoin = '';
    if (role) {
      roleJoin = `JOIN roles r2 ON r2.user_id = u.id AND r2.tenant_id = u.tenant_id AND r2.role_type = $${idx}`;
      params.push(role);
      idx++;
    }

    let branchJoin = '';
    if (branchId && role === 'staff') {
      branchJoin = 'LEFT JOIN staff_profiles stf2 ON stf2.user_id = u.id AND stf2.tenant_id = u.tenant_id';
      conditions.push(`stf2.branch_id = $${idx}`);
      params.push(branchId); idx++;
    }
    if (branchId && role === 'teacher') {
      branchJoin = 'LEFT JOIN class_teachers ct2 ON ct2.teacher_id = u.id AND ct2.tenant_id = u.tenant_id LEFT JOIN classes c2 ON c2.id = ct2.class_id';
      conditions.push(`c2.branch_id = $${idx}`);
      params.push(branchId); idx++;
    }
    if (branchId && role === 'student') {
      branchJoin = 'LEFT JOIN class_students cs2 ON cs2.student_id = u.id AND cs2.tenant_id = u.tenant_id LEFT JOIN classes c2 ON c2.id = cs2.class_id';
      conditions.push(`c2.branch_id = $${idx}`);
      params.push(branchId); idx++;
    }

    const where = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT u.id) FROM users u ${roleJoin} ${branchJoin} WHERE ${where}`,
      params
    );

    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.gender, u.is_active, u.created_at,
              (u.password_hash IS NOT NULL) as has_password,
              array_agg(DISTINCT r.role_type) FILTER (WHERE r.role_type IS NOT NULL) as roles,
              sp.student_code, sp.enrollment_date, sp.study_status,
              tp.teacher_code, tp.specialization, tp.start_date as teacher_start_date,
              stf.staff_code, stf.position, stf.start_date as staff_start_date
       FROM users u
       ${roleJoin}
       ${branchJoin}
       LEFT JOIN roles r ON r.user_id = u.id AND r.tenant_id = u.tenant_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id AND sp.tenant_id = u.tenant_id
       LEFT JOIN teacher_profiles tp ON tp.user_id = u.id AND tp.tenant_id = u.tenant_id
       LEFT JOIN staff_profiles stf ON stf.user_id = u.id AND stf.tenant_id = u.tenant_id
       WHERE ${where}
       GROUP BY u.id, sp.student_code, sp.enrollment_date, sp.study_status,
                tp.teacher_code, tp.specialization, tp.start_date,
                stf.staff_code, stf.position, stf.start_date
       ORDER BY u.full_name
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return {
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      users: result.rows,
    };
  }

  async getById(tenantId, userId) {
    const result = await pool.query(
      `SELECT u.*, array_agg(DISTINCT r.role_type) FILTER (WHERE r.role_type IS NOT NULL) as roles
       FROM users u
       LEFT JOIN roles r ON r.user_id = u.id AND r.tenant_id = u.tenant_id
       WHERE u.id = $1 AND u.tenant_id = $2
       GROUP BY u.id`,
      [userId, tenantId]
    );

    if (!result.rows.length) return null;
    // const user = result.rows[0];
    const { password_hash, ...user } = result.rows[0];

    const [teacherProfile, studentProfile, staffProfile] = await Promise.all([
      pool.query('SELECT * FROM teacher_profiles WHERE user_id=$1 AND tenant_id=$2', [userId, tenantId]),
      pool.query('SELECT * FROM student_profiles WHERE user_id=$1 AND tenant_id=$2', [userId, tenantId]),
      pool.query(
        `SELECT sp.*, b.name as branch_name
         FROM staff_profiles sp
         LEFT JOIN branches b ON b.id = sp.branch_id
         WHERE sp.user_id=$1 AND sp.tenant_id=$2`,
        [userId, tenantId]
      ),
    ]);

    const stats = await this._getStats(tenantId, userId, user.roles || []);

    return {
      ...user,
      has_password: password_hash !== null,
      teacherProfile: teacherProfile.rows[0] || null,
      studentProfile: studentProfile.rows[0] || null,
      staffProfile: staffProfile.rows[0] || null,
      stats,
    };
  }

  async create(tenantId, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { fullName, email, phone, gender, dateOfBirth, address, password, roles = [], teacherInfo, studentInfo, staffInfo } = data;

      // const passwordHash = password ? await authService.hashPassword(password) : null;

      // Never leave password_hash NULL — a NULL hash makes the account permanently unable to log in
      // with no way for admin to notice until the user tries and fails. Always default it server-side
      // too, instead of relying solely on the frontend to supply a fallback password.
      const effectivePassword = (password && String(password).trim()) ? String(password).trim() : 'Default@123';
      const passwordHash = await authService.hashPassword(effectivePassword);

      const userResult = await client.query(
        `INSERT INTO users (tenant_id, full_name, email, phone, gender, date_of_birth, address, password_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [tenantId, fullName, email || null, phone || null, gender || null, dateOfBirth || null, address || null, passwordHash]
      );
      const user = userResult.rows[0];

      for (const role of roles) {
        await client.query(
          'INSERT INTO roles (tenant_id, user_id, role_type) VALUES ($1,$2,$3)',
          [tenantId, user.id, role]
        );

        if (role === 'teacher' && teacherInfo) {
          const code = teacherInfo.teacherCode || await this._genCode(client, tenantId, 'GV', 'teacher_profiles', 'teacher_code');
          await client.query(
            `INSERT INTO teacher_profiles (tenant_id, user_id, teacher_code, specialization, qualifications, start_date, bank_account, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [tenantId, user.id, code, teacherInfo.specialization, teacherInfo.qualifications, teacherInfo.startDate || null, teacherInfo.bankAccount, teacherInfo.notes]
          );
        }

        if (role === 'student' && studentInfo) {
          const code = studentInfo.studentCode || await this._genCode(client, tenantId, 'HV', 'student_profiles', 'student_code');
          await client.query(
            `INSERT INTO student_profiles (tenant_id, user_id, student_code, enrollment_date, study_status, notes)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [tenantId, user.id, code, studentInfo.enrollmentDate || null, 'active', studentInfo.notes]
          );
        }

        if (role === 'staff' && staffInfo) {
          const code = staffInfo.staffCode || await this._genCode(client, tenantId, 'NV', 'staff_profiles', 'staff_code');
          await client.query(
            `INSERT INTO staff_profiles (tenant_id, user_id, staff_code, position, branch_id, start_date, bank_account, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [tenantId, user.id, code, staffInfo.position, staffInfo.branchId || null, staffInfo.startDate || null, staffInfo.bankAccount, staffInfo.notes]
          );
        }
      }

      await client.query('COMMIT');
      return this.getById(tenantId, user.id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(tenantId, userId, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query(
        'SELECT * FROM users WHERE id=$1 AND tenant_id=$2',
        [userId, tenantId]
      );
      if (!currentResult.rows.length) {
        await client.query('ROLLBACK');
        return null;
      }
      const current = currentResult.rows[0];

      const fullName = data.fullName ?? data.full_name ?? current.full_name;
      const email = data.email !== undefined ? (data.email || null) : current.email;
      const phone = data.phone !== undefined ? (data.phone || null) : current.phone;
      const gender = data.gender !== undefined ? (data.gender || null) : current.gender;
      const dateOfBirth = data.dateOfBirth ?? data.date_of_birth ?? current.date_of_birth;
      const address = data.address !== undefined ? (data.address || null) : current.address;
      const isActive = data.isActive ?? data.is_active ?? current.is_active;

      await client.query(
        `UPDATE users SET full_name=$1, email=$2, phone=$3, gender=$4, date_of_birth=$5, address=$6, is_active=$7, updated_at=NOW()
         WHERE id=$8 AND tenant_id=$9`,
        [fullName, email, phone, gender, dateOfBirth || null, address, isActive, userId, tenantId]
      );

      if (Array.isArray(data.roles)) {
        const roles = [...new Set(data.roles)].filter((role) => ['admin', 'teacher', 'student', 'staff'].includes(role));
        await client.query('DELETE FROM roles WHERE tenant_id=$1 AND user_id=$2', [tenantId, userId]);
        for (const role of roles) {
          await client.query(
            'INSERT INTO roles (tenant_id, user_id, role_type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
            [tenantId, userId, role]
          );
        }

        if (roles.includes('teacher')) {
          const teacherInfo = data.teacherInfo || data.teacherProfile || {};
          const existed = await client.query('SELECT * FROM teacher_profiles WHERE tenant_id=$1 AND user_id=$2 LIMIT 1', [tenantId, userId]);
          if (existed.rows.length) {
            await client.query(
              `UPDATE teacher_profiles SET specialization=$1, qualifications=$2, start_date=$3, bank_account=$4, notes=$5, updated_at=NOW()
               WHERE tenant_id=$6 AND user_id=$7`,
              [
                teacherInfo.specialization ?? existed.rows[0].specialization,
                teacherInfo.qualifications ?? existed.rows[0].qualifications,
                teacherInfo.startDate ?? teacherInfo.start_date ?? existed.rows[0].start_date,
                teacherInfo.bankAccount ?? teacherInfo.bank_account ?? existed.rows[0].bank_account,
                teacherInfo.notes ?? existed.rows[0].notes,
                tenantId,
                userId,
              ]
            );
          } else {
            const code = teacherInfo.teacherCode || await this._genCode(client, tenantId, 'GV', 'teacher_profiles', 'teacher_code');
            await client.query(
              `INSERT INTO teacher_profiles (tenant_id, user_id, teacher_code, specialization, qualifications, start_date, bank_account, notes)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [tenantId, userId, code, teacherInfo.specialization || null, teacherInfo.qualifications || null, teacherInfo.startDate || null, teacherInfo.bankAccount || null, teacherInfo.notes || null]
            );
          }
        } else {
          await client.query('DELETE FROM teacher_profiles WHERE tenant_id=$1 AND user_id=$2', [tenantId, userId]);
        }

        if (roles.includes('student')) {
          const studentInfo = data.studentInfo || data.studentProfile || {};
          const existed = await client.query('SELECT * FROM student_profiles WHERE tenant_id=$1 AND user_id=$2 LIMIT 1', [tenantId, userId]);
          if (existed.rows.length) {
            await client.query(
              `UPDATE student_profiles SET enrollment_date=$1, study_status=$2, notes=$3, updated_at=NOW()
               WHERE tenant_id=$4 AND user_id=$5`,
              [
                studentInfo.enrollmentDate ?? studentInfo.enrollment_date ?? existed.rows[0].enrollment_date,
                studentInfo.studyStatus ?? studentInfo.study_status ?? existed.rows[0].study_status,
                studentInfo.notes ?? existed.rows[0].notes,
                tenantId,
                userId,
              ]
            );
          } else {
            const code = studentInfo.studentCode || await this._genCode(client, tenantId, 'HV', 'student_profiles', 'student_code');
            await client.query(
              `INSERT INTO student_profiles (tenant_id, user_id, student_code, enrollment_date, study_status, notes)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [tenantId, userId, code, studentInfo.enrollmentDate || null, studentInfo.studyStatus || 'active', studentInfo.notes || null]
            );
          }
        } else {
          await client.query('DELETE FROM student_profiles WHERE tenant_id=$1 AND user_id=$2', [tenantId, userId]);
        }

        if (roles.includes('staff')) {
          const staffInfo = data.staffInfo || data.staffProfile || {};
          const existed = await client.query('SELECT * FROM staff_profiles WHERE tenant_id=$1 AND user_id=$2 LIMIT 1', [tenantId, userId]);
          if (existed.rows.length) {
            await client.query(
              `UPDATE staff_profiles SET position=$1, branch_id=$2, start_date=$3, bank_account=$4, notes=$5, updated_at=NOW()
               WHERE tenant_id=$6 AND user_id=$7`,
              [
                staffInfo.position ?? existed.rows[0].position,
                staffInfo.branchId ?? staffInfo.branch_id ?? existed.rows[0].branch_id,
                staffInfo.startDate ?? staffInfo.start_date ?? existed.rows[0].start_date,
                staffInfo.bankAccount ?? staffInfo.bank_account ?? existed.rows[0].bank_account,
                staffInfo.notes ?? existed.rows[0].notes,
                tenantId,
                userId,
              ]
            );
          } else {
            const code = staffInfo.staffCode || await this._genCode(client, tenantId, 'NV', 'staff_profiles', 'staff_code');
            await client.query(
              `INSERT INTO staff_profiles (tenant_id, user_id, staff_code, position, branch_id, start_date, bank_account, notes)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [tenantId, userId, code, staffInfo.position || null, staffInfo.branchId || null, staffInfo.startDate || null, staffInfo.bankAccount || null, staffInfo.notes || null]
            );
          }
        } else {
          await client.query('DELETE FROM staff_profiles WHERE tenant_id=$1 AND user_id=$2', [tenantId, userId]);
        }
      }

      await client.query('COMMIT');
      return this.getById(tenantId, userId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async delete(tenantId, userId) {
    const result = await pool.query(
      'DELETE FROM users WHERE id=$1 AND tenant_id=$2 RETURNING id',
      [userId, tenantId]
    );
    return result.rowCount > 0;
  }

  async _genCode(client, tenantId, prefix, table, column) {
    const result = await client.query(
      `SELECT COUNT(*) FROM ${table} WHERE tenant_id=$1`, [tenantId]
    );
    const num = parseInt(result.rows[0].count) + 1;
    return `${prefix}${String(num).padStart(4, '0')}`;
  }

  async _getStats(tenantId, userId, roles) {
    const stats = {};

    if (roles.includes('teacher')) {
      const [classes, sessions] = await Promise.all([
        pool.query(
          `SELECT COUNT(DISTINCT ct.class_id) as class_count,
                  COUNT(DISTINCT CASE WHEN c.status='active' THEN c.id END) as active_class_count,
                  COUNT(DISTINCT cs.student_id) as student_count
           FROM class_teachers ct
           JOIN classes c ON c.id = ct.class_id
           LEFT JOIN class_students cs ON cs.class_id = ct.class_id AND cs.status='active'
           WHERE ct.teacher_id=$1 AND ct.tenant_id=$2`,
          [userId, tenantId]
        ),
        pool.query(
          `SELECT COUNT(*) FILTER (WHERE status='completed') as completed_sessions,
                  COUNT(*) FILTER (WHERE status='scheduled') as upcoming_sessions
           FROM schedules
           WHERE teacher_id=$1 AND tenant_id=$2`,
          [userId, tenantId]
        ),
      ]);

      stats.teacher = {
        classCount: parseInt(classes.rows[0].class_count) || 0,
        activeClassCount: parseInt(classes.rows[0].active_class_count) || 0,
        studentCount: parseInt(classes.rows[0].student_count) || 0,
        completedSessions: parseInt(sessions.rows[0].completed_sessions) || 0,
        upcomingSessions: parseInt(sessions.rows[0].upcoming_sessions) || 0,
      };
    }

    if (roles.includes('student')) {
      const [classes, attendance] = await Promise.all([
        pool.query(
          `SELECT COUNT(DISTINCT cs.class_id) FILTER (WHERE cs.status='active') as class_count
           FROM class_students cs
           WHERE cs.student_id=$1 AND cs.tenant_id=$2`,
          [userId, tenantId]
        ),
        pool.query(
          `SELECT COUNT(*) FILTER (WHERE status='present') as present_count,
                  COUNT(*) FILTER (WHERE status='absent') as absent_count,
                  COUNT(*) FILTER (WHERE status='late') as late_count,
                  COUNT(*) as total_count
           FROM attendance
           WHERE student_id=$1 AND tenant_id=$2`,
          [userId, tenantId]
        ),
      ]);

      stats.student = {
        classCount: parseInt(classes.rows[0].class_count) || 0,
        presentCount: parseInt(attendance.rows[0].present_count) || 0,
        absentCount: parseInt(attendance.rows[0].absent_count) || 0,
        lateCount: parseInt(attendance.rows[0].late_count) || 0,
        totalSessions: parseInt(attendance.rows[0].total_count) || 0,
      };
    }

    return stats;
  }

  async resetPassword(tenantId, userId, newPassword) {
    const password = (newPassword && String(newPassword).trim()) ? String(newPassword).trim() : 'Default@123';
    const passwordHash = await authService.hashPassword(password);
    const result = await pool.query(
      `UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING id`,
      [passwordHash, userId, tenantId]
    );
    if (!result.rows.length) return null;
    return { id: userId, temporaryPassword: password };
  }
}

module.exports = new UserService();
