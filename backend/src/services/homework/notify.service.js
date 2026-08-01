const pool = require('../../config/database');
const notificationService = require('../notification.service');
const notificationPush = require('../notificationPush');

module.exports = {
  async _notifyStudentsAssigned(tenantId, assignment, studentIds) {
    const dueText = assignment.due_date
      ? `Hạn nộp: ${new Date(assignment.due_date).toLocaleString('vi-VN')}`
      : 'Bài tập này không có hạn nộp cố định';
    await notificationService.createForUsers(tenantId, studentIds, {
      type: 'homework_assigned',
      title: `Bài tập mới: ${assignment.title}`,
      message: dueText,
      link: `/student/homework/${assignment.id}/preview`,
    });
  },

  async _getAdminAndTeacherIds(tenantId, classIds = []) {
    const [adminsResult, teachersResult] = await Promise.all([
      pool.query(`SELECT user_id FROM roles WHERE tenant_id=$1 AND role_type='admin'`, [tenantId]),
      classIds.length
        ? pool.query(
            `SELECT DISTINCT teacher_id FROM class_teachers WHERE tenant_id=$1 AND class_id = ANY($2::int[])`,
            [tenantId, classIds]
          )
        : Promise.resolve({ rows: [] }),
    ]);
    const ids = new Set();
    adminsResult.rows.forEach((row) => ids.add(Number(row.user_id)));
    teachersResult.rows.forEach((row) => ids.add(Number(row.teacher_id)));
    return Array.from(ids);
  },

  _broadcastAssignmentChange(tenantId, recipientIds, payload) {
    for (const userId of recipientIds) {
      notificationPush.pushToUser(tenantId, userId, payload);
    }
  },
};