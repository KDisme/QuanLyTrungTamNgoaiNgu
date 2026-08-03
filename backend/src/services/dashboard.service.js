const pool = require('../config/database');

const STATUS_LABELS = {
  active: 'Đang học',
  paused: 'Tạm nghỉ',
  graduated: 'Đã tốt nghiệp',
  dropped: 'Đã nghỉ',
};

function hasRole(user, role) {
  return (user?.roles || []).includes(role);
}

class DashboardService {
  async getStats(tenantId, user) {
    if (hasRole(user, 'admin') || hasRole(user, 'staff')) {
      return this._getAdminStaffStats(tenantId);
    }
    if (hasRole(user, 'teacher')) {
      return this._getTeacherStats(tenantId, user.id);
    }
    return this._getStudentStats(tenantId, user.id);
  }

  async _getAdminStaffStats(tenantId) {
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
      newStudentsByMonth,
      classTypeDist,
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM users u JOIN roles r ON r.user_id=u.id
         WHERE u.tenant_id=$1 AND r.role_type='student' AND u.is_active=TRUE`,
        [tenantId]
      ),
      pool.query(`SELECT COUNT(*) FROM classes WHERE tenant_id=$1 AND status='active'`, [tenantId]),
      pool.query(
        `SELECT COUNT(DISTINCT u.id)
         FROM users u JOIN roles r ON r.user_id = u.id AND r.tenant_id = u.tenant_id
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
      pool.query(
        `SELECT to_char(date_trunc('month', enrollment_date), 'YYYY-MM') AS month, COUNT(*) AS count
         FROM student_profiles
         WHERE tenant_id=$1 AND enrollment_date >= CURRENT_DATE - INTERVAL '6 months'
         GROUP BY 1 ORDER BY 1`,
        [tenantId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT class_type, COUNT(*) AS count FROM classes
         WHERE tenant_id=$1 AND status='active' GROUP BY class_type`,
        [tenantId]
      ).catch(() => ({ rows: [] })),
    ]);

    return {
      role: 'admin',
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
      topClasses: topClasses.rows.map((row) => ({ name: row.name, count: Number(row.student_count) })),
      newStudentsByMonth: newStudentsByMonth.rows.map((row) => ({ month: row.month, count: Number(row.count) })),
      classTypeDistribution: classTypeDist.rows.map((row) => ({ type: row.class_type, count: Number(row.count) })),
    };
  }

  async _getTeacherStats(tenantId, teacherId) {
    const [
      myClasses,
      todaySessions,
      myStudents,
      pendingHomework,
      pendingMockExams,
      weekSchedule,
      recentHomework,
      teacherWeeklyAttendance,
      gradingProgress,
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT ct.class_id) FROM class_teachers ct
         JOIN classes c ON c.id = ct.class_id
         WHERE ct.tenant_id=$1 AND ct.teacher_id=$2 AND c.status='active'`,
        [tenantId, teacherId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM schedules
         WHERE tenant_id=$1 AND teacher_id=$2 AND session_date=CURRENT_DATE AND status='scheduled'`,
        [tenantId, teacherId]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT cs.student_id)
         FROM class_teachers ct
         JOIN class_students cs ON cs.class_id = ct.class_id AND cs.tenant_id = ct.tenant_id AND cs.status='active'
         WHERE ct.tenant_id=$1 AND ct.teacher_id=$2`,
        [tenantId, teacherId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM homework_submissions hs
         JOIN homework_assignment_students has ON has.id = hs.assignment_student_id
         JOIN homework_assignments ha ON ha.id = has.assignment_id
         WHERE ha.tenant_id=$1 AND hs.status='submitted' AND ha.created_by=$2`,
        [tenantId, teacherId]
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT COUNT(*) FROM mock_exam_students mes
         JOIN mock_exams me ON me.id = mes.mock_exam_id
         JOIN class_teachers ct ON ct.class_id = me.class_id AND ct.tenant_id = me.tenant_id
         WHERE me.tenant_id=$1 AND mes.status='submitted' AND ct.teacher_id=$2`,
        [tenantId, teacherId]
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT s.session_date, s.start_time, s.end_time, c.name AS class_name, r.name AS room_name
         FROM schedules s
         JOIN classes c ON c.id = s.class_id
         LEFT JOIN rooms r ON r.id = s.room_id
         WHERE s.tenant_id=$1 AND s.teacher_id=$2 AND s.status='scheduled'
           AND s.session_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'
         ORDER BY s.session_date, s.start_time
         LIMIT 8`,
        [tenantId, teacherId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT ha.id, ha.title,
                (SELECT string_agg(c.name, ', ') FROM homework_assignment_classes hac JOIN classes c ON c.id=hac.class_id WHERE hac.assignment_id=ha.id) AS class_names,
                (SELECT COUNT(*) FROM homework_submissions hs JOIN homework_assignment_students has ON has.id=hs.assignment_student_id WHERE has.assignment_id=ha.id AND hs.status='submitted') AS pending_count
         FROM homework_assignments ha
         WHERE ha.tenant_id=$1 AND ha.created_by=$2 AND ha.status='active'
         ORDER BY ha.created_at DESC
         LIMIT 5`,
        [tenantId, teacherId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT s.session_date,
                COUNT(*) FILTER (WHERE a.status='present') AS present_count,
                COUNT(*) AS total_count
         FROM attendance a
         JOIN schedules s ON s.id = a.schedule_id
         WHERE a.tenant_id=$1 AND s.teacher_id=$2
           AND s.session_date >= CURRENT_DATE - INTERVAL '6 days' AND s.session_date <= CURRENT_DATE
         GROUP BY s.session_date ORDER BY s.session_date`,
        [tenantId, teacherId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE hs.status='graded') AS graded_count,
           COUNT(*) FILTER (WHERE hs.status='submitted') AS pending_count
         FROM homework_submissions hs
         JOIN homework_assignment_students has ON has.id = hs.assignment_student_id
         JOIN homework_assignments ha ON ha.id = has.assignment_id
         WHERE ha.tenant_id=$1 AND ha.created_by=$2`,
        [tenantId, teacherId]
      ).catch(() => ({ rows: [{ graded_count: 0, pending_count: 0 }] })),
    ]);

    return {
      role: 'teacher',
      activeClasses: parseInt(myClasses.rows[0].count, 10),
      todaySessions: parseInt(todaySessions.rows[0].count, 10),
      students: parseInt(myStudents.rows[0].count, 10),
      pendingHomeworkGrading: parseInt(pendingHomework.rows[0]?.count || 0, 10),
      pendingMockExamGrading: parseInt(pendingMockExams.rows[0]?.count || 0, 10),
      weekSchedule: weekSchedule.rows.map((row) => ({
        date: row.session_date,
        startTime: row.start_time,
        endTime: row.end_time,
        className: row.class_name,
        roomName: row.room_name,
      })),
      myHomeworks: recentHomework.rows.map((row) => ({
        id: row.id,
        title: row.title,
        classNames: row.class_names,
        pendingCount: Number(row.pending_count || 0),
      })),
      weeklyAttendance: teacherWeeklyAttendance.rows.map((row) => ({
        date: row.session_date,
        rate: Number(row.total_count) > 0 ? Math.round((Number(row.present_count) / Number(row.total_count)) * 100) : 0,
      })),
      gradingProgress: {
        graded: Number(gradingProgress.rows[0]?.graded_count || 0),
        pending: Number(gradingProgress.rows[0]?.pending_count || 0),
      },
    };
  }

  async _getStudentStats(tenantId, studentId) {
    const [
      myClasses,
      todaySessions,
      pendingHomework,
      upcomingMockExams,
      attendance,
      upcomingHomeworkList,
      recentScores,
      monthlyAttendance,
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM class_students WHERE tenant_id=$1 AND student_id=$2 AND status='active'`,
        [tenantId, studentId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM schedules s
         JOIN class_students cs ON cs.class_id = s.class_id AND cs.tenant_id = s.tenant_id
         WHERE s.tenant_id=$1 AND cs.student_id=$2 AND cs.status='active'
           AND s.session_date=CURRENT_DATE AND s.status='scheduled'`,
        [tenantId, studentId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM homework_assignment_students has
         JOIN homework_assignments ha ON ha.id = has.assignment_id
         WHERE ha.tenant_id=$1 AND has.student_id=$2 AND ha.status='active'
           AND has.status IN ('assigned','in_progress','revision_required')`,
        [tenantId, studentId]
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT COUNT(*) FROM mock_exam_students mes
         JOIN mock_exams me ON me.id = mes.mock_exam_id
         WHERE me.tenant_id=$1 AND mes.student_id=$2 AND mes.status IN ('assigned','in_progress')`,
        [tenantId, studentId]
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status='present') AS present_count, COUNT(*) AS total_count
         FROM attendance WHERE tenant_id=$1 AND student_id=$2`,
        [tenantId, studentId]
      ).catch(() => ({ rows: [{ present_count: 0, total_count: 0 }] })),
      pool.query(
        `SELECT ha.id, ha.title, ha.due_date,
                (SELECT string_agg(c.name, ', ') FROM homework_assignment_classes hac JOIN classes c ON c.id=hac.class_id WHERE hac.assignment_id=ha.id) AS class_names
         FROM homework_assignment_students has
         JOIN homework_assignments ha ON ha.id = has.assignment_id
         WHERE ha.tenant_id=$1 AND has.student_id=$2 AND ha.status='active'
           AND has.status IN ('assigned','in_progress','revision_required')
         ORDER BY ha.due_date ASC NULLS LAST
         LIMIT 5`,
        [tenantId, studentId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT ha.title, has.total_score, ha.total_score AS max_score, hs.graded_at
         FROM homework_submissions hs
         JOIN homework_assignment_students has ON has.id = hs.assignment_student_id
         JOIN homework_assignments ha ON ha.id = has.assignment_id
         WHERE ha.tenant_id=$1 AND has.student_id=$2 AND hs.status='graded'
         ORDER BY hs.graded_at DESC LIMIT 5`,
        [tenantId, studentId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT to_char(date_trunc('month', s.session_date), 'YYYY-MM') AS month,
                COUNT(*) FILTER (WHERE a.status='present') AS present_count,
                COUNT(*) AS total_count
         FROM attendance a
         JOIN schedules s ON s.id = a.schedule_id
         WHERE a.tenant_id=$1 AND a.student_id=$2 AND s.session_date >= CURRENT_DATE - INTERVAL '6 months'
         GROUP BY 1 ORDER BY 1`,
        [tenantId, studentId]
      ).catch(() => ({ rows: [] })),
    ]);

    const presentCount = Number(attendance.rows[0]?.present_count || 0);
    const totalCount = Number(attendance.rows[0]?.total_count || 0);

    return {
      role: 'student',
      activeClasses: parseInt(myClasses.rows[0].count, 10),
      todaySessions: parseInt(todaySessions.rows[0].count, 10),
      pendingHomeworkCount: parseInt(pendingHomework.rows[0]?.count || 0, 10),
      upcomingMockExamCount: parseInt(upcomingMockExams.rows[0]?.count || 0, 10),
      attendanceRate: totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : null,
      attendancePresent: presentCount,
      attendanceTotal: totalCount,
      upcomingHomework: upcomingHomeworkList.rows.map((row) => ({
        id: row.id,
        title: row.title,
        dueDate: row.due_date,
        classNames: row.class_names,
      })),
      recentScores: recentScores.rows.map((row) => ({
        title: row.title,
        score: Number(row.total_score || 0),
        maxScore: Number(row.max_score || 100),
      })),
      monthlyAttendance: monthlyAttendance.rows.map((row) => ({
        month: row.month,
        rate: Number(row.total_count) > 0 ? Math.round((Number(row.present_count) / Number(row.total_count)) * 100) : 0,
      })),
    };
  }
}

module.exports = new DashboardService();