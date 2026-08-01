const pool = require('../../config/database');

function isTeacherOfClass(client, tenantId, classId, teacherId) {
  return client.query(
    `SELECT 1 FROM class_teachers WHERE tenant_id=$1 AND class_id=$2 AND teacher_id=$3 LIMIT 1`,
    [tenantId, classId, teacherId]
  );
}

async function ensureStudentHomeworkAssignments(tenantId, studentId) {
  const assignments = await pool.query(
    `SELECT DISTINCT a.id
     FROM homework_assignments a
     JOIN class_students cs ON cs.tenant_id = a.tenant_id AND cs.class_id = a.class_id
     WHERE a.tenant_id = $1
       AND cs.student_id = $2
       AND cs.status = 'active'`,
    [tenantId, studentId]
  );
  if (!assignments.rows.length) return;
  for (const row of assignments.rows) {
    await pool.query(
      `INSERT INTO homework_assignment_students (tenant_id, assignment_id, student_id, status)
       VALUES ($1,$2,$3,'assigned')
       ON CONFLICT (assignment_id, student_id)
       DO NOTHING`,
      [tenantId, row.id, studentId]
    );
  }
}

module.exports = {
  isTeacherOfClass,
  ensureStudentHomeworkAssignments,
};