const pool = require('../config/database');

class ClassService {
  async getNextCode(tenantId) {
    const result = await pool.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 3) AS INTEGER)), 0) + 1 AS next_num
       FROM classes
       WHERE tenant_id=$1 AND code ~ '^LH[0-9]+$'`,
      [tenantId]
    );
    const code = `LH${String(parseInt(result.rows[0].next_num, 10)).padStart(3, '0')}`;
    return { code };
  }

  async getAll(tenantId, { search, branchId, type, status, page = 1, limit = 20 }, user = null) {
    const offset = (page - 1) * limit;
    const conditions = ['c.tenant_id = $1'];
    const params = [tenantId];
    let idx = 2;

    if (search) { conditions.push(`(c.name ILIKE $${idx} OR c.code ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
    if (branchId) { conditions.push(`c.branch_id = $${idx}`); params.push(branchId); idx++; }
    if (type) { conditions.push(`c.class_type = $${idx}`); params.push(type); idx++; }
    if (status) { conditions.push(`c.status = $${idx}`); params.push(status); idx++; }

    const roles = user?.roles || [];
    if (roles.includes('teacher') && !roles.includes('admin') && !roles.includes('staff')) {
      conditions.push(`EXISTS (SELECT 1 FROM class_teachers ct_scope WHERE ct_scope.class_id=c.id AND ct_scope.tenant_id=c.tenant_id AND ct_scope.teacher_id=$${idx})`);
      params.push(user.id); idx++;
    } else if (roles.includes('student') && !roles.includes('admin') && !roles.includes('staff')) {
      conditions.push(`EXISTS (SELECT 1 FROM class_students cs_scope WHERE cs_scope.class_id=c.id AND cs_scope.tenant_id=c.tenant_id AND cs_scope.student_id=$${idx} AND cs_scope.status='active')`);
      params.push(user.id); idx++;
    }

    const where = conditions.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM classes c WHERE ${where}`, params);

    const result = await pool.query(
      `SELECT c.*, b.name as branch_name, b.code as branch_code,
              COUNT(DISTINCT cs.student_id) as student_count,
              COUNT(DISTINCT ct.teacher_id) as teacher_count,
              COUNT(DISTINCT s.id) as total_sessions,
              COUNT(DISTINCT CASE WHEN s.status='completed' THEN s.id END) as completed_sessions
       FROM classes c
       JOIN branches b ON b.id = c.branch_id
       LEFT JOIN class_students cs ON cs.class_id = c.id AND cs.status='active'
       LEFT JOIN class_teachers ct ON ct.class_id = c.id
       LEFT JOIN schedules s ON s.class_id = c.id
       WHERE ${where}
       GROUP BY c.id, b.name, b.code
       ORDER BY c.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return { total: parseInt(countResult.rows[0].count), page, limit, classes: result.rows };
  }

  async getById(tenantId, classId, user = null) {
    const result = await pool.query(
      `SELECT c.*, b.name as branch_name FROM classes c
       JOIN branches b ON b.id = c.branch_id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [classId, tenantId]
    );
    if (!result.rows.length) return null;

    const roles = user?.roles || [];
    const isStudentOnly = roles.includes('student') && !roles.includes('admin') && !roles.includes('staff') && !roles.includes('teacher');

    const [teachers, students, schedules, weeklySchedules] = await Promise.all([
      pool.query(
        isStudentOnly
          ? `SELECT u.id, u.full_name, ct.is_primary, tp.teacher_code
             FROM class_teachers ct
             JOIN users u ON u.id = ct.teacher_id
             LEFT JOIN teacher_profiles tp ON tp.user_id = u.id AND tp.tenant_id = u.tenant_id
             WHERE ct.class_id = $1`
          : `SELECT u.id, u.full_name, u.email, u.phone, ct.is_primary, tp.teacher_code
             FROM class_teachers ct
             JOIN users u ON u.id = ct.teacher_id
             LEFT JOIN teacher_profiles tp ON tp.user_id = u.id AND tp.tenant_id = u.tenant_id
             WHERE ct.class_id = $1`,
        [classId]
      ),
      isStudentOnly
        ? Promise.resolve({ rows: [] })
        : pool.query(
            `SELECT u.id, u.full_name, u.email, u.phone, cs.status, cs.joined_at, sp.student_code
             FROM class_students cs
             JOIN users u ON u.id = cs.student_id
             LEFT JOIN student_profiles sp ON sp.user_id = u.id AND sp.tenant_id = u.tenant_id
             WHERE cs.class_id = $1 ORDER BY u.full_name`,
            [classId]
          ),
      pool.query(
        `SELECT s.*, r.name as room_name, u.full_name as teacher_name
         FROM schedules s
         LEFT JOIN rooms r ON r.id = s.room_id
         LEFT JOIN users u ON u.id = s.teacher_id
         WHERE s.class_id = $1 ORDER BY s.session_date, s.start_time`, [classId]
      ),
      pool.query(
        `SELECT cws.*, r.name as room_name
         FROM class_weekly_schedules cws
         LEFT JOIN rooms r ON r.id = cws.room_id
         WHERE cws.class_id = $1 AND cws.tenant_id = $2
         ORDER BY cws.weekday`,
        [classId, tenantId]
      ),
    ]);

    return {
      ...result.rows[0],
      students: students.rows,
      teachers: teachers.rows,
      schedules: schedules.rows,
      weekly_schedules: weeklySchedules.rows,
    };
  }

  async create(tenantId, data) {
    const { name, branchId, classType = 'fixed', maxStudents = 20, expectedFee = 0,
            startDate, expectedSessions, description, teacherIds = [], status = 'upcoming', weeklySchedules = [] } = data;
    const normalizedSeedDate = classType === 'fixed' ? this._normalizeDateOnly(startDate) : null;
    const dateRange = classType === 'fixed'
      ? this._calculateDateRange(normalizedSeedDate, expectedSessions, weeklySchedules)
      : { startDate: null, endDate: null };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      this._validateClassPayload(data);
      const finalBranchId = branchId || await this._getDefaultBranchId(client, tenantId);

      const codeResult = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 3) AS INTEGER)), 0) + 1 AS next_num
         FROM classes
         WHERE tenant_id=$1 AND code ~ '^LH[0-9]+$'`,
        [tenantId]
      );
      const code = `LH${String(parseInt(codeResult.rows[0].next_num, 10)).padStart(3, '0')}`;

      const result = await client.query(
        `INSERT INTO classes (tenant_id, branch_id, name, code, class_type, max_students, expected_fee, start_date, end_date, expected_sessions, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [tenantId, finalBranchId, name, code, classType, maxStudents, expectedFee, dateRange.startDate, dateRange.endDate, expectedSessions || null, description || null]
      );
      const cls = result.rows[0];

      if (status && status !== cls.status) {
        await client.query(
          'UPDATE classes SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3',
          [status, cls.id, tenantId]
        );
        cls.status = status;
      }

      for (let i = 0; i < teacherIds.length; i++) {
        await client.query(
          'INSERT INTO class_teachers (tenant_id, class_id, teacher_id, is_primary) VALUES ($1,$2,$3,$4)',
          [tenantId, cls.id, teacherIds[i], i === 0]
        );
      }

      if (Array.isArray(weeklySchedules) && weeklySchedules.length) {
        await this._replaceWeeklySchedules(client, tenantId, cls.id, weeklySchedules);
      }

      await client.query('COMMIT');
      return cls;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(tenantId, classId, data) {
    const { name, branchId, classType, maxStudents, expectedFee, startDate, expectedSessions, status, description, weeklySchedules, teacherIds } = data;
    this._validateClassPayload(data);

    const normalizedSeedDate = classType === 'fixed' ? this._normalizeDateOnly(startDate) : null;
    const dateRange = classType === 'fixed'
      ? this._calculateDateRange(normalizedSeedDate, expectedSessions, weeklySchedules)
      : { startDate: null, endDate: null };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query(
        'SELECT * FROM classes WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
        [classId, tenantId]
      );
      if (!currentResult.rows.length) {
        await client.query('ROLLBACK');
        return null;
      }

      const finalBranchId = branchId || currentResult.rows[0].branch_id || await this._getDefaultBranchId(client, tenantId);

      const result = await client.query(
        `UPDATE classes SET name=$1, branch_id=$2, class_type=$3, max_students=$4, expected_fee=$5,
         start_date=$6, end_date=$7, expected_sessions=$8, status=$9, description=$10, updated_at=NOW()
         WHERE id=$11 AND tenant_id=$12 RETURNING *`,
        [name, finalBranchId, classType, maxStudents, expectedFee, dateRange.startDate, dateRange.endDate, expectedSessions || null, status, description || null, classId, tenantId]
      );

      if (Array.isArray(teacherIds)) {
        await client.query('DELETE FROM class_teachers WHERE class_id=$1 AND tenant_id=$2', [classId, tenantId]);
        for (let i = 0; i < teacherIds.length; i++) {
          await client.query(
            'INSERT INTO class_teachers (tenant_id, class_id, teacher_id, is_primary) VALUES ($1,$2,$3,$4)',
            [tenantId, classId, teacherIds[i], i === 0]
          );
        }
      }

      if (Array.isArray(weeklySchedules)) {
        await this._replaceWeeklySchedules(client, tenantId, classId, weeklySchedules);
        await this._syncSchedulesAfterClassUpdate(client, tenantId, classId, {
          classType,
          expectedSessions,
          dateRange,
          weeklySchedules,
          teacherIds,
        });
      }

      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async delete(tenantId, classId) {
    await pool.query('DELETE FROM classes WHERE id=$1 AND tenant_id=$2', [classId, tenantId]);
  }

  async addStudent(tenantId, classId, studentId) {
    await pool.query(
      'INSERT INTO class_students (tenant_id, class_id, student_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [tenantId, classId, studentId]
    );
  }

  async removeStudent(tenantId, classId, studentId) {
    await pool.query(
      `UPDATE class_students SET status='dropped' WHERE class_id=$1 AND student_id=$2`,
      [classId, studentId]
    );
  }

  async getByStudent(tenantId, studentId) {
    const result = await pool.query(
      `SELECT c.*, b.name as branch_name, cs.status as student_status
       FROM class_students cs
       JOIN classes c ON c.id = cs.class_id
       JOIN branches b ON b.id = c.branch_id
       WHERE cs.student_id = $1 AND cs.tenant_id = $2
       ORDER BY c.created_at DESC`,
      [studentId, tenantId]
    );
    return result.rows;
  }

  async _replaceWeeklySchedules(client, tenantId, classId, weeklySchedules) {
    await client.query(
      'DELETE FROM class_weekly_schedules WHERE class_id=$1 AND tenant_id=$2',
      [classId, tenantId]
    );
    for (const item of weeklySchedules) {
      const weekday = parseInt(item.weekday, 10);
      if (Number.isNaN(weekday) || !item.startTime || !item.endTime) continue;
      if (item.startTime >= item.endTime) {
        const err = new Error('Giờ bắt đầu phải nhỏ hơn giờ kết thúc trong lịch tuần mẫu');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      await client.query(
        `INSERT INTO class_weekly_schedules (tenant_id, class_id, weekday, start_time, end_time, room_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [tenantId, classId, weekday, item.startTime, item.endTime, item.roomId || null]
      );
    }
  }

  async _getDefaultBranchId(client, tenantId) {
    const result = await client.query(
      `SELECT id
       FROM branches
       WHERE tenant_id = $1 AND status = 'active'
       ORDER BY id ASC
       LIMIT 1`,
      [tenantId]
    );

    if (!result.rows.length) {
      const err = new Error('Chưa có cơ sở mặc định. Vui lòng thêm ít nhất 1 cơ sở active trong database.');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    return result.rows[0].id;
  }

  _validateClassPayload(data) {
    if (!data.name) {
      const err = new Error('Vui lòng nhập tên lớp');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    if (data.classType === 'fixed') {
      if (!data.startDate) {
        const err = new Error('Vui lòng nhập ngày bắt đầu');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      if (!data.expectedSessions || parseInt(data.expectedSessions, 10) <= 0) {
        const err = new Error('Vui lòng nhập số buổi lớn hơn 0');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      if (!Array.isArray(data.weeklySchedules) || data.weeklySchedules.length === 0) {
        const err = new Error('Vui lòng chọn ít nhất một thứ học trong tuần');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
    }
    if (Array.isArray(data.weeklySchedules)) {
      for (const item of data.weeklySchedules) {
        if (item.startTime && item.endTime && item.startTime >= item.endTime) {
          const err = new Error('Giờ bắt đầu phải nhỏ hơn giờ kết thúc trong lịch tuần mẫu');
          err.code = 'VALIDATION_ERROR';
          throw err;
        }
      }
    }
  }


  _normalizeDateOnly(value) {
    if (!value) return null;
    if (value instanceof Date) return this._formatDateUTC(value);
    const raw = String(value).trim();
    if (!raw) return null;
    // Accept normal HTML date input: YYYY-MM-DD.
    const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
    // Accept Vietnamese/browser display value: DD/MM/YYYY.
    const vnDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (vnDate) {
      return `${vnDate[3]}-${String(vnDate[2]).padStart(2, '0')}-${String(vnDate[1]).padStart(2, '0')}`;
    }
    return raw.slice(0, 10);
  }

  _calculateDateRange(seedDate, expectedSessions, weeklySchedules) {
    const sessions = this._buildFixedClassSessions(seedDate, expectedSessions, weeklySchedules, null);
    if (!sessions.length) return { startDate: null, endDate: null };
    return {
      startDate: sessions[0].session_date,
      endDate: sessions[sessions.length - 1].session_date,
    };
  }

  _buildFixedClassSessions(seedDate, expectedSessions, weeklySchedules, primaryTeacherId) {
    if (!seedDate || !expectedSessions || !Array.isArray(weeklySchedules) || weeklySchedules.length === 0) {
      return [];
    }

    const targetSessions = parseInt(expectedSessions, 10);
    if (!Number.isFinite(targetSessions) || targetSessions <= 0) return [];

    const templates = weeklySchedules
      .map((item) => ({
        weekday: parseInt(item.weekday, 10),
        start_time: this._timeOnly(item.startTime || item.start_time),
        end_time: this._timeOnly(item.endTime || item.end_time),
        room_id: item.roomId || item.room_id || null,
        teacher_id: item.teacherId || item.teacher_id || primaryTeacherId || null,
      }))
      .filter((item) => Number.isFinite(item.weekday) && item.weekday >= 0 && item.weekday <= 6 && item.start_time && item.end_time)
      .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));

    if (!templates.length) return [];

    const sessions = [];
    const current = this._parseDateUTC(seedDate);

    for (let guard = 0; guard < 3700 && sessions.length < targetSessions; guard++) {
      const dayOfWeek = current.getUTCDay();
      const matchedTemplates = templates.filter((t) => t.weekday === dayOfWeek);
      for (const template of matchedTemplates) {
        if (sessions.length >= targetSessions) break;
        sessions.push({
          session_date: this._formatDateUTC(current),
          start_time: template.start_time,
          end_time: template.end_time,
          session_number: sessions.length + 1,
          room_id: template.room_id || null,
          teacher_id: template.teacher_id || null,
        });
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return sessions;
  }

  async _syncSchedulesAfterClassUpdate(client, tenantId, classId, { classType, expectedSessions, dateRange, weeklySchedules, teacherIds }) {
    const existingResult = await client.query(
      'SELECT id, status FROM schedules WHERE class_id=$1 AND tenant_id=$2 ORDER BY session_date, start_time FOR UPDATE',
      [classId, tenantId]
    );
    if (!existingResult.rows.length) return;

    if (classType !== 'fixed' || !dateRange.startDate || !dateRange.endDate) {
      await this._assertSchedulesCanBeRegenerated(client, tenantId, classId);
      await this._deleteClassSchedules(client, tenantId, classId);
      return;
    }

    await this._assertSchedulesCanBeRegenerated(client, tenantId, classId);

    const primaryTeacherId = Array.isArray(teacherIds) && teacherIds.length
      ? teacherIds[0]
      : await this._getPrimaryTeacherId(client, tenantId, classId);
    const sessions = this._buildFixedClassSessions(dateRange.startDate, expectedSessions, weeklySchedules, primaryTeacherId);

    await this._assertNoScheduleConflicts(client, tenantId, classId, sessions);
    await this._deleteClassSchedules(client, tenantId, classId);

    for (const session of sessions) {
      await client.query(
        `INSERT INTO schedules (tenant_id, class_id, room_id, teacher_id, session_date, start_time, end_time, session_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [tenantId, classId, session.room_id || null, session.teacher_id || null, session.session_date, session.start_time, session.end_time, session.session_number]
      );
    }
  }

  async _assertSchedulesCanBeRegenerated(client, tenantId, classId) {
    const lockedResult = await client.query(
      `SELECT COUNT(*)::int AS blocked_count
       FROM schedules s
       WHERE s.class_id=$1 AND s.tenant_id=$2
         AND (
           s.status='completed'
           OR EXISTS (SELECT 1 FROM attendance a WHERE a.schedule_id=s.id)
         )`,
      [classId, tenantId]
    );

    if (lockedResult.rows[0].blocked_count > 0) {
      const err = new Error('Lớp đã có buổi học đã điểm danh/hoàn thành nên không thể tự sinh lại toàn bộ lịch. Vui lòng chỉnh từng buổi trong Lịch học.');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
  }

  async _deleteClassSchedules(client, tenantId, classId) {
    await client.query(
      `DELETE FROM schedule_changes
       WHERE tenant_id=$1 AND schedule_id IN (
         SELECT id FROM schedules WHERE class_id=$2 AND tenant_id=$1
       )`,
      [tenantId, classId]
    );
    await client.query('DELETE FROM schedules WHERE class_id=$1 AND tenant_id=$2', [classId, tenantId]);
  }

  async _getPrimaryTeacherId(client, tenantId, classId) {
    const result = await client.query(
      `SELECT teacher_id FROM class_teachers
       WHERE class_id=$1 AND tenant_id=$2
       ORDER BY is_primary DESC, id
       LIMIT 1`,
      [classId, tenantId]
    );
    return result.rows[0]?.teacher_id || null;
  }

  async _assertNoScheduleConflicts(client, tenantId, classId, sessions) {
    for (const session of sessions) {
      const conflictResult = await client.query(
        `SELECT s.id
         FROM schedules s
         WHERE s.tenant_id=$1
           AND s.class_id<>$2
           AND s.session_date=$3
           AND s.status<>'cancelled'
           AND s.start_time < $4
           AND s.end_time > $5
           AND (
             ($6::bigint IS NOT NULL AND s.room_id=$6::bigint)
             OR ($7::bigint IS NOT NULL AND s.teacher_id=$7::bigint)
           )
         LIMIT 1`,
        [tenantId, classId, session.session_date, session.end_time, session.start_time, session.room_id || null, session.teacher_id || null]
      );
      if (conflictResult.rows.length) {
        const err = new Error(`Lịch mới bị trùng phòng hoặc giáo viên vào ngày ${session.session_date} (${session.start_time}-${session.end_time}).`);
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
    }
  }


  _parseDateUTC(value) {
    const dateOnly = this._normalizeDateOnly(value);
    const [year, month, day] = dateOnly.split('-').map((n) => parseInt(n, 10));
    return new Date(Date.UTC(year, month - 1, day));
  }

  _formatDateUTC(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  _timeOnly(value) {
    if (!value) return '';
    return String(value).slice(0, 5);
  }

}

module.exports = new ClassService();
