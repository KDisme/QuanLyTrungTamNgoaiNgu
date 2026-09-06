const scheduleService = require('../services/schedule.service');
const pool = require('../config/database');

class ScheduleController {
  async getList(req, res, next) {
    try {
      const result = await scheduleService.getList(req.tenant.id, req.query, req.user);
      res.json(result);
    } catch (err) { next(err); }
  }

  async getByClass(req, res, next) {
    try {
      const schedules = await scheduleService.getByClass(req.tenant.id, parseInt(req.params.classId), req.query);
      res.json(schedules);
    } catch (err) { next(err); }
  }

  async getUpcoming(req, res, next) {
    try {
      const schedules = await scheduleService.getUpcoming(req.tenant.id, req.query, req.user);
      res.json(schedules);
    } catch (err) { next(err); }
  }

  async preview(req, res, next) {
    try {
      const result = await scheduleService.preview(req.tenant.id, parseInt(req.params.classId), req.body);
      res.json(result);
    } catch (err) {
      if (err.code === 'SCHEDULE_CONFLICT') {
        return res.status(409).json({ message: 'Schedule conflict', details: err.details });
      }
      if (err.code === 'VALIDATION_ERROR') {
        return res.status(422).json({ message: err.message });
      }
      next(err);
    }
  }

  async generate(req, res, next) {
    try {
      const schedules = await scheduleService.generate(req.tenant.id, parseInt(req.params.classId), req.body);
      res.status(201).json(schedules);
    } catch (err) {
      if (err.code === 'SCHEDULE_CONFLICT') {
        return res.status(409).json({ message: 'Schedule conflict', details: err.details });
      }
      if (err.code === 'VALIDATION_ERROR') {
        return res.status(422).json({ message: err.message });
      }
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const schedule = await scheduleService.update(req.tenant.id, parseInt(req.params.id), req.body, req.user.id);
      if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
      res.json(schedule);
    } catch (err) {
      if (err.code === 'SCHEDULE_CONFLICT') {
        return res.status(409).json({ message: 'Schedule conflict', details: err.details });
      }
      if (err.code === 'VALIDATION_ERROR') {
        return res.status(422).json({ message: err.message });
      }
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await pool.query(
        `SELECT s.*, c.name as class_name, c.code as class_code,
                b.name as branch_name,
                r.name as room_name, u.full_name as teacher_name
         FROM schedules s
         JOIN classes c ON c.id = s.class_id
         JOIN branches b ON b.id = c.branch_id
         LEFT JOIN rooms r ON r.id = s.room_id
         LEFT JOIN users u ON u.id = s.teacher_id
         WHERE s.id = $1 AND s.tenant_id = $2`,
        [parseInt(req.params.id), req.tenant.id]
      );
      if (!result.rows.length) return res.status(404).json({ message: 'Schedule not found' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }

  async cancel(req, res, next) {
    try {
      const schedule = await scheduleService.cancel(req.tenant.id, parseInt(req.params.id), req.body.note, req.user.id);
      if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
      res.json(schedule);
    } catch (err) {
      if (err.code === 'CANNOT_CANCEL_COMPLETED') {
        return res.status(422).json({ message: err.message });
      }
      next(err);
    }
  }

  async history(req, res, next) {
    try {
      const result = await scheduleService.getHistory(req.tenant.id, parseInt(req.params.id));
      res.json(result);
    } catch (err) { next(err); }
  }
}

// Attendance Controller inline
class AttendanceController {
  async getBySchedule(req, res, next) {
    try {
      const scheduleId = parseInt(req.params.scheduleId);
      const result = await pool.query(
        `SELECT a.status, a.note, a.recorded_at,
                u.id as student_id, u.full_name, u.phone, u.date_of_birth,
                sp.student_code
         FROM class_students cs
         JOIN users u ON u.id = cs.student_id
         LEFT JOIN student_profiles sp ON sp.user_id = u.id AND sp.tenant_id = u.tenant_id
         LEFT JOIN attendance a ON a.student_id = cs.student_id AND a.schedule_id = $1
         WHERE cs.class_id = (SELECT class_id FROM schedules WHERE id=$1 AND tenant_id=$2)
           AND cs.tenant_id = $2
           AND cs.status = 'active'
         ORDER BY u.full_name`,
        [scheduleId, req.tenant.id]
      );
      res.json(result.rows);
    } catch (err) { next(err); }
  }

  async save(req, res, next) {
    try {
      const scheduleId = parseInt(req.params.scheduleId);
      const { records } = req.body; // [{studentId, status, note}]

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const scheduleResult = await client.query(
          `SELECT id, class_id, status, session_date FROM schedules WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
          [scheduleId, req.tenant.id]
        );
        if (!scheduleResult.rows.length) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: 'Schedule not found' });
        }
        const schedule = scheduleResult.rows[0];
        const classId = schedule.class_id;

        // Không điểm danh buổi đã hủy
        if (schedule.status === 'cancelled') {
          await client.query('ROLLBACK');
          return res.status(422).json({ message: 'Không thể điểm danh buổi học đã bị hủy' });
        }
        // Không điểm danh buổi trong tương lai
        const today = new Date().toISOString().split('T')[0];
        if (String(schedule.session_date).substring(0, 10) > today) {
          await client.query('ROLLBACK');
          return res.status(422).json({ message: 'Không thể điểm danh buổi học trong tương lai' });
        }
        // Danh sách records không được rỗng
        if (!Array.isArray(records) || records.length === 0) {
          await client.query('ROLLBACK');
          return res.status(422).json({ message: 'Vui lòng cung cấp danh sách điểm danh' });
        }

        for (const rec of records) {
          const memberResult = await client.query(
            `SELECT 1 FROM class_students
             WHERE tenant_id=$1 AND class_id=$2 AND student_id=$3 AND status='active'
             LIMIT 1`,
            [req.tenant.id, classId, rec.studentId]
          );
          if (!memberResult.rows.length) {
            const err = new Error('Học viên không thuộc lớp của buổi học này');
            err.code = 'INVALID_ATTENDANCE_STUDENT';
            throw err;
          }
          await client.query(
            `INSERT INTO attendance (tenant_id, schedule_id, student_id, status, note, recorded_by)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (schedule_id, student_id)
             DO UPDATE SET status=$4, note=$5, recorded_by=$6, recorded_at=NOW()`,
            [req.tenant.id, scheduleId, rec.studentId, rec.status, rec.note || null, req.user.id]
          );
        }
        // Mark schedule as completed
        await client.query(
          `UPDATE schedules SET status='completed', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
          [scheduleId, req.tenant.id]
        );
        await client.query('COMMIT');
        res.json({ message: 'Attendance saved' });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      if (err.code === 'INVALID_ATTENDANCE_STUDENT') return res.status(422).json({ message: err.message });
      next(err);
    }
  }

  async getStudentAttendance(req, res, next) {
    try {
      const result = await pool.query(
        `SELECT a.*, s.session_date, s.start_time, c.name as class_name
         FROM attendance a
         JOIN schedules s ON s.id = a.schedule_id
         JOIN classes c ON c.id = s.class_id
         WHERE a.student_id = $1 AND a.tenant_id = $2
         ORDER BY s.session_date DESC`,
        [parseInt(req.params.studentId), req.tenant.id]
      );
      res.json(result.rows);
    } catch (err) { next(err); }
  }
}

module.exports = {
  scheduleController: new ScheduleController(),
  attendanceController: new AttendanceController(),
};
