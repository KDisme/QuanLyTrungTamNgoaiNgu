const pool = require('../config/database');

class ScheduleService {
  async getByClass(tenantId, classId, { page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const result = await pool.query(
      `SELECT s.*, r.name as room_name, r.code as room_code, u.full_name as teacher_name,
              COUNT(DISTINCT cs.student_id) FILTER (WHERE cs.status='active') as student_count,
              COUNT(DISTINCT CASE WHEN a.status IN ('present','late') THEN a.student_id END) as attended_count,
              COUNT(DISTINCT CASE WHEN a.status='absent' THEN a.student_id END) as absent_count,
              COUNT(DISTINCT CASE WHEN a.status='late' THEN a.student_id END) as late_count
       FROM schedules s
       LEFT JOIN rooms r ON r.id = s.room_id
       LEFT JOIN users u ON u.id = s.teacher_id
       LEFT JOIN class_students cs ON cs.class_id = s.class_id AND cs.status='active'
       LEFT JOIN attendance a ON a.schedule_id = s.id
       WHERE s.class_id = $1 AND s.tenant_id = $2
       GROUP BY s.id, r.name, r.code, u.full_name
       ORDER BY s.session_date, s.start_time
       LIMIT $3 OFFSET $4`,
      [classId, tenantId, limit, offset]
    );
    return result.rows;
  }

  async getList(tenantId, { classId, branchId, fromDate, toDate, status, page = 1, limit = 200 }, user = null) {
    const offset = (page - 1) * limit;
    const conditions = ['s.tenant_id = $1'];
    const params = [tenantId];
    let idx = 2;

    if (classId) { conditions.push(`s.class_id = $${idx}`); params.push(classId); idx++; }
    if (branchId) { conditions.push(`c.branch_id = $${idx}`); params.push(branchId); idx++; }
    if (status) { conditions.push(`s.status = $${idx}`); params.push(status); idx++; }
    if (fromDate) { conditions.push(`s.session_date >= $${idx}`); params.push(fromDate); idx++; }
    if (toDate) { conditions.push(`s.session_date <= $${idx}`); params.push(toDate); idx++; }

    const roles = user?.roles || [];
    if (roles.includes('teacher') && !roles.includes('admin') && !roles.includes('staff')) {
      conditions.push(`s.teacher_id = $${idx}`);
      params.push(user.id); idx++;
    } else if (roles.includes('student') && !roles.includes('admin') && !roles.includes('staff')) {
      conditions.push(`EXISTS (SELECT 1 FROM class_students cs_scope WHERE cs_scope.class_id=s.class_id AND cs_scope.tenant_id=s.tenant_id AND cs_scope.student_id=$${idx} AND cs_scope.status='active')`);
      params.push(user.id); idx++;
    }

    const where = conditions.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM schedules s JOIN classes c ON c.id=s.class_id WHERE ${where}`, params);

    const result = await pool.query(
      `SELECT s.*, c.name as class_name, c.code as class_code,
              b.name as branch_name,
              r.name as room_name, u.full_name as teacher_name,
              COUNT(DISTINCT cs.student_id) FILTER (WHERE cs.status='active') as student_count,
              COUNT(DISTINCT CASE WHEN a.status IN ('present','late') THEN a.student_id END) as attended_count,
              COUNT(DISTINCT CASE WHEN a.status='absent' THEN a.student_id END) as absent_count,
              COUNT(DISTINCT CASE WHEN a.status='late' THEN a.student_id END) as late_count
       FROM schedules s
       JOIN classes c ON c.id = s.class_id
       JOIN branches b ON b.id = c.branch_id
       LEFT JOIN rooms r ON r.id = s.room_id
       LEFT JOIN users u ON u.id = s.teacher_id
       LEFT JOIN class_students cs ON cs.class_id = c.id AND cs.status='active'
       LEFT JOIN attendance a ON a.schedule_id = s.id
       WHERE ${where}
       GROUP BY s.id, c.name, c.code, b.name, r.name, u.full_name
       ORDER BY s.session_date, s.start_time
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit), schedules: result.rows };
  }

  async getUpcoming(tenantId, { branchId, days = 7 }, user = null) {
    const conditions = ['s.tenant_id = $1', 's.session_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $2::interval'];
    const params = [tenantId, `${days} days`];
    let idx = 3;

    if (branchId) {
      conditions.push(`c.branch_id = $${idx}`);
      params.push(branchId); idx++;
    }

    const roles = user?.roles || [];
    if (roles.includes('teacher') && !roles.includes('admin') && !roles.includes('staff')) {
      conditions.push(`s.teacher_id = $${idx}`);
      params.push(user.id); idx++;
    } else if (roles.includes('student') && !roles.includes('admin') && !roles.includes('staff')) {
      conditions.push(`EXISTS (SELECT 1 FROM class_students cs_scope WHERE cs_scope.class_id=s.class_id AND cs_scope.tenant_id=s.tenant_id AND cs_scope.student_id=$${idx} AND cs_scope.status='active')`);
      params.push(user.id); idx++;
    }

    const result = await pool.query(
      `SELECT s.*, c.name as class_name, c.code as class_code,
              r.name as room_name, u.full_name as teacher_name,
              b.name as branch_name,
              COUNT(cs.student_id) as student_count
       FROM schedules s
       JOIN classes c ON c.id = s.class_id
       JOIN branches b ON b.id = c.branch_id
       LEFT JOIN rooms r ON r.id = s.room_id
       LEFT JOIN users u ON u.id = s.teacher_id
       LEFT JOIN class_students cs ON cs.class_id = c.id AND cs.status='active'
       WHERE ${conditions.join(' AND ')} AND s.status = 'scheduled'
       GROUP BY s.id, c.name, c.code, r.name, u.full_name, b.name
       ORDER BY s.session_date, s.start_time`,
      params
    );
    return result.rows;
  }

  async preview(tenantId, classId, data) {
    const sessions = await this._buildSessions(tenantId, classId, data);
    const items = [];
    let conflictCount = 0;

    for (const session of sessions) {
      const conflicts = await this._findConflicts(tenantId, {
        sessionDate: session.session_date,
        startTime: session.start_time,
        endTime: session.end_time,
        roomId: session.room_id,
        teacherId: session.teacher_id,
        classId,
      });
      if (conflicts.length) conflictCount++;
      items.push({ ...session, conflicts, status: conflicts.length ? 'conflict' : 'ok' });
    }

    return { total: items.length, conflictCount, items };
  }

  /**
   * Generate schedules for a date range
   */
  async generate(tenantId, classId, data) {
    const preview = await this.preview(tenantId, classId, data);
    if (preview.conflictCount > 0) {
      const err = new Error('Schedule conflict');
      err.code = 'SCHEDULE_CONFLICT';
      err.details = preview;
      throw err;
    }

    const sessions = preview.items;
    if (!sessions.length) return [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const created = [];
      for (const session of sessions) {
        const result = await client.query(
          `INSERT INTO schedules (tenant_id, class_id, room_id, teacher_id, session_date, start_time, end_time, session_number)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [tenantId, classId, session.room_id || null, session.teacher_id || null, session.session_date, session.start_time, session.end_time, session.session_number]
        );
        created.push(result.rows[0]);
      }

      // Update class status to active if upcoming
      await client.query(
        `UPDATE classes SET status='active', updated_at=NOW() WHERE id=$1 AND status='upcoming'`,
        [classId]
      );

      // Ensure every teacher used by generated schedules is linked to the class.
      const teacherIds = [...new Set(sessions.map((s) => s.teacher_id).filter(Boolean))];
      for (const teacherId of teacherIds) {
        const existing = await client.query(
          'SELECT id FROM class_teachers WHERE class_id=$1 AND teacher_id=$2',
          [classId, teacherId]
        );
        if (!existing.rows.length) {
          const primaryCheck = await client.query(
            `SELECT id FROM class_teachers WHERE class_id=$1 AND is_primary=true`,
            [classId]
          );
          await client.query(
            'INSERT INTO class_teachers (tenant_id, class_id, teacher_id, is_primary) VALUES ($1,$2,$3,$4)',
            [tenantId, classId, teacherId, primaryCheck.rows.length === 0]
          );
        }
      }

      await client.query('COMMIT');
      return created;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(tenantId, scheduleId, data, userId) {
    const { roomId, teacherId, sessionDate, startTime, endTime, status, note, reason } = data;
    const currentResult = await pool.query(
      'SELECT * FROM schedules WHERE id=$1 AND tenant_id=$2',
      [scheduleId, tenantId]
    );
    if (!currentResult.rows.length) return null;
    const current = currentResult.rows[0];

    const next = {
      room_id: roomId !== undefined ? roomId : current.room_id,
      teacher_id: teacherId !== undefined ? teacherId : current.teacher_id,
      session_date: sessionDate || current.session_date,
      start_time: startTime || current.start_time,
      end_time: endTime || current.end_time,
      status: status || current.status,
      note: note !== undefined ? note : current.note,
    };

    // Skip conflict check when restoring a cancelled schedule
    const isRestoring = current.status === 'cancelled' && next.status === 'scheduled'
      && !sessionDate && !startTime && !endTime && roomId === undefined && teacherId === undefined;

    if (!isRestoring) {
      const conflicts = await this._findConflicts(tenantId, {
        sessionDate: next.session_date,
        startTime: next.start_time,
        endTime: next.end_time,
        roomId: next.room_id,
        teacherId: next.teacher_id,
        classId: current.class_id,
        excludeScheduleId: scheduleId,
      });

      if (conflicts.length) {
        const err = new Error('Schedule conflict');
        err.code = 'SCHEDULE_CONFLICT';
        err.details = { conflicts };
        throw err;
      }
    }

    const result = await pool.query(
      `UPDATE schedules SET room_id=$1, teacher_id=$2, session_date=$3, start_time=$4, end_time=$5, status=$6, note=$7, updated_at=NOW()
       WHERE id=$8 AND tenant_id=$9 RETURNING *`,
      [next.room_id || null, next.teacher_id || null, next.session_date, next.start_time, next.end_time, next.status, next.note || null, scheduleId, tenantId]
    );

    await this._recordChange(tenantId, scheduleId, current, next, userId, reason || note);

    return result.rows[0];
  }

  async cancel(tenantId, scheduleId, note, userId) {
    const currentResult = await pool.query(
      'SELECT * FROM schedules WHERE id=$1 AND tenant_id=$2',
      [scheduleId, tenantId]
    );
    if (!currentResult.rows.length) return null;
    const current = currentResult.rows[0];

    // Cannot cancel a completed schedule (attendance already recorded)
    if (current.status === 'completed') {
      const err = new Error('Không thể hủy buổi học đã hoàn thành và ghi nhận điểm danh');
      err.code = 'CANNOT_CANCEL_COMPLETED';
      throw err;
    }

    const result = await pool.query(
      `UPDATE schedules SET status='cancelled', note=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *`,
      [note || null, scheduleId, tenantId]
    );

    await this._recordChange(tenantId, scheduleId, current, { ...current, status: 'cancelled' }, userId, note);
    return result.rows[0];
  }

  async getHistory(tenantId, scheduleId) {
    const result = await pool.query(
      `SELECT sc.*, u.full_name as changed_by_name,
              r1.name as old_room_name, r2.name as new_room_name,
              t1.full_name as old_teacher_name, t2.full_name as new_teacher_name
       FROM schedule_changes sc
       LEFT JOIN users u ON u.id = sc.changed_by
       LEFT JOIN rooms r1 ON r1.id = sc.old_room_id
       LEFT JOIN rooms r2 ON r2.id = sc.new_room_id
       LEFT JOIN users t1 ON t1.id = sc.old_teacher_id
       LEFT JOIN users t2 ON t2.id = sc.new_teacher_id
       WHERE sc.schedule_id = $1 AND sc.tenant_id = $2
       ORDER BY sc.created_at DESC`,
      [scheduleId, tenantId]
    );
    return result.rows;
  }

  async _buildSessions(tenantId, classId, data) {
    const fromDate = this._toDateOnly(data.fromDate);
    let toDate = this._toDateOnly(data.toDate);
    if (!fromDate || !toDate) {
      const err = new Error('Vui lòng chọn đầy đủ từ ngày và đến ngày');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    if (fromDate > toDate) {
      const err = new Error('Từ ngày phải nhỏ hơn hoặc bằng đến ngày');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const classResult = await pool.query(
      `SELECT c.*, pt.teacher_id as primary_teacher_id
       FROM classes c
       LEFT JOIN class_teachers pt ON pt.class_id = c.id AND pt.tenant_id = c.tenant_id AND pt.is_primary = true
       WHERE c.id=$1 AND c.tenant_id=$2`,
      [classId, tenantId]
    );
    if (!classResult.rows.length) {
      const err = new Error('Không tìm thấy lớp học');
      err.code = 'NOT_FOUND';
      throw err;
    }
    const cls = classResult.rows[0];

    const useWeeklyTemplate = data.useWeeklyTemplate === true || (!data.weekdays?.length && !data.startTime && !data.endTime);
    let templates = [];

    if (useWeeklyTemplate) {
      const weeklyResult = await pool.query(
        `SELECT weekday, start_time, end_time, room_id
         FROM class_weekly_schedules
         WHERE class_id=$1 AND tenant_id=$2
         ORDER BY weekday, start_time`,
        [classId, tenantId]
      );
      templates = weeklyResult.rows.map((w) => ({
        weekday: parseInt(w.weekday, 10),
        start_time: this._timeOnly(w.start_time),
        end_time: this._timeOnly(w.end_time),
        room_id: w.room_id || null,
        teacher_id: data.teacherId || cls.primary_teacher_id || null,
      }));
      if (!templates.length) {
        const err = new Error('Lớp chưa có lịch học tuần mẫu. Vui lòng thiết lập lịch tuần trong lớp trước.');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
    } else {
      const weekdays = (data.weekdays || []).map((d) => parseInt(d, 10)).filter((d) => d >= 0 && d <= 6);
      if (!weekdays.length) {
        const err = new Error('Vui lòng chọn ít nhất một ngày học trong tuần');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      if (!data.startTime || !data.endTime) {
        const err = new Error('Vui lòng nhập giờ bắt đầu và giờ kết thúc');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      if (data.startTime >= data.endTime) {
        const err = new Error('Giờ bắt đầu phải nhỏ hơn giờ kết thúc');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      templates = weekdays.map((weekday) => ({
        weekday,
        start_time: data.startTime,
        end_time: data.endTime,
        room_id: data.roomId || null,
        teacher_id: data.teacherId || cls.primary_teacher_id || null,
      }));
    }

    for (const t of templates) {
      if (!t.start_time || !t.end_time || t.start_time >= t.end_time) {
        const err = new Error('Lịch tuần mẫu có giờ học không hợp lệ');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      if (!t.teacher_id) {
        const err = new Error('Vui lòng chọn giáo viên phụ trách hoặc gán giáo viên chính cho lớp trước khi tạo lịch');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
    }

    const sessions = [];
    const current = this._parseDateUTC(fromDate);
    const end = this._parseDateUTC(toDate);

    const countResult = await pool.query('SELECT COUNT(*) FROM schedules WHERE class_id=$1 AND tenant_id=$2', [classId, tenantId]);
    let startNum = parseInt(countResult.rows[0].count, 10) + 1;

    // Use UTC-only date operations so weekdays and saved dates do not shift by timezone.
    // JS Date.getDay()/toISOString() can be off by one day when the server/browser timezone changes.
    while (current.getTime() <= end.getTime()) {
      const dayOfWeek = current.getUTCDay(); // 0=CN, 1=T2, ..., 6=T7
      const matchedTemplates = templates.filter((t) => t.weekday === dayOfWeek);
      for (const template of matchedTemplates) {
        sessions.push({
          session_date: this._formatDateUTC(current),
          start_time: template.start_time,
          end_time: template.end_time,
          session_number: startNum++,
          room_id: template.room_id || null,
          teacher_id: template.teacher_id || null,
        });
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return sessions;
  }

  async _findConflicts(tenantId, { sessionDate, startTime, endTime, roomId, teacherId, classId, excludeScheduleId }) {
    const conditions = ['s.tenant_id = $1', 's.session_date = $2', "s.status != 'cancelled'", 's.start_time < $3', 's.end_time > $4'];
    const params = [tenantId, sessionDate, endTime, startTime];
    let idx = 5;

    const conflictParts = [];
    if (classId) { conflictParts.push(`s.class_id = $${idx}`); params.push(classId); idx++; }
    if (roomId) { conflictParts.push(`s.room_id = $${idx}`); params.push(roomId); idx++; }
    if (teacherId) { conflictParts.push(`s.teacher_id = $${idx}`); params.push(teacherId); idx++; }
    if (!conflictParts.length) return [];
    conditions.push(`(${conflictParts.join(' OR ')})`);

    if (excludeScheduleId) {
      conditions.push(`s.id != $${idx}`);
      params.push(excludeScheduleId); idx++;
    }

    const result = await pool.query(
      `SELECT s.*, c.name as class_name, r.name as room_name, u.full_name as teacher_name
       FROM schedules s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN rooms r ON r.id = s.room_id
       LEFT JOIN users u ON u.id = s.teacher_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.start_time`,
      params
    );

    return result.rows.map((row) => {
      const classConflict = classId && Number(row.class_id) === Number(classId);
      const roomConflict = roomId && Number(row.room_id) === Number(roomId);
      const teacherConflict = teacherId && Number(row.teacher_id) === Number(teacherId);
      const types = [];
      if (classConflict) types.push('class');
      if (roomConflict) types.push('room');
      if (teacherConflict) types.push('teacher');
      return {
        ...row,
        conflict_type: types.join('_') || 'unknown',
      };
    });
  }

  _toDateOnly(value) {
    if (!value) return '';
    if (value instanceof Date) return this._formatDateUTC(value);
    const raw = String(value).trim();
    const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
    const vnDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (vnDate) return `${vnDate[3]}-${String(vnDate[2]).padStart(2, '0')}-${String(vnDate[1]).padStart(2, '0')}`;
    return raw.slice(0, 10);
  }


  _parseDateUTC(value) {
    const dateOnly = this._toDateOnly(value);
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

  async _recordChange(tenantId, scheduleId, oldData, newData, userId, reason) {
    const dateChanged = String(oldData.session_date) !== String(newData.session_date) ||
      String(oldData.start_time) !== String(newData.start_time) ||
      String(oldData.end_time) !== String(newData.end_time);
    const roomChanged = (oldData.room_id || null) !== (newData.room_id || null);
    const teacherChanged = (oldData.teacher_id || null) !== (newData.teacher_id || null);
    const statusChanged = oldData.status !== newData.status;

    let changeType = null;
    if (dateChanged) changeType = 'reschedule';
    else if (teacherChanged) changeType = 'teacher_change';
    else if (roomChanged) changeType = 'room_change';
    else if (statusChanged) changeType = 'status_change';

    if (!changeType) return;

    await pool.query(
      `INSERT INTO schedule_changes (
         tenant_id, schedule_id, change_type, reason,
         old_session_date, new_session_date,
         old_start_time, new_start_time,
         old_end_time, new_end_time,
         old_room_id, new_room_id,
         old_teacher_id, new_teacher_id,
         changed_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        tenantId,
        scheduleId,
        changeType,
        reason || null,
        oldData.session_date,
        newData.session_date,
        oldData.start_time,
        newData.start_time,
        oldData.end_time,
        newData.end_time,
        oldData.room_id || null,
        newData.room_id || null,
        oldData.teacher_id || null,
        newData.teacher_id || null,
        userId || null,
      ]
    );
  }
}

module.exports = new ScheduleService();
