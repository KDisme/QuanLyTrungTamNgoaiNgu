const pool = require('../config/database');

const STATUS_LABELS = {
  active: 'Đang học',
  paused: 'Tạm nghỉ',
  graduated: 'Đã tốt nghiệp',
  dropped: 'Đã nghỉ',
};

class DashboardService {
  async getStats(tenantId) {
    const [
      students,
      classes,
      teachers,
      todaySessions,
      pendingHomework,
      pendingMockExams,
      weeklyAttendance,
      studentStatusDist,
      topClasses,
    ] = await Promise.all([
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

    return {
      students: parseInt(students.rows[0].count, 10),
      activeClasses: parseInt(classes.rows[0].count, 10),
      teachers: parseInt(teachers.rows[0].count, 10),
      todaySessions: parseInt(todaySessions.rows[0].count, 10),
      pendingHomeworkGrading: parseInt(pendingHomework.rows[0]?.count || 0, 10),
      pendingMockExamGrading: parseInt(pendingMockExams.rows[0]?.count || 0, 10),
      weeklyAttendance: weeklyAttendance.rows.map((row) => ({
        date: row.session_date,
        rate: Number(row.total_count) > 0 ? Math.round((Number(row.present_count) / Number(row.total_count)) * 100) : 0,
        present: Number(row.present_count),
        total: Number(row.total_count),
      })),
      studentStatusDistribution: studentStatusDist.rows.map((row) => ({
        status: row.study_status,
        label: STATUS_LABELS[row.study_status] || row.study_status,
        count: Number(row.count),
      })),
      topClasses: topClasses.rows.map((row) => ({
        name: row.name,
        count: Number(row.student_count),
      })),
    };
  }
}

module.exports = new DashboardService();