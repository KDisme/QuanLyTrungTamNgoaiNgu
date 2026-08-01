const pool = require('../../config/database');
const bcrypt = require('bcryptjs');
const activityLogService = require('../activityLog.service');
const { isTeacherOnly, normalizeAnswerValue } = require('./utils');
const { normalizeQuestions } = require('./mappers');
const { isTeacherOfClass } = require('./db-helpers');

module.exports = {
  async createAssignment(tenantId, user, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const classIds = Array.isArray(data.classIds) ? data.classIds.filter(Boolean).map(Number) : (data.classId ? [Number(data.classId)] : []);
      if (isTeacherOnly(user) && classIds.length) {
        for (const cid of classIds) {
          const allowed = await isTeacherOfClass(client, tenantId, cid, user.id);
          if (!allowed.rows.length) throw Object.assign(new Error('Bạn chỉ có thể giao bài cho lớp mình phụ trách'), { status: 403 });
        }
      }

      const requirePassword = !!data.requirePassword;
      if (requirePassword && !String(data.password || '').trim()) {
        throw Object.assign(new Error('Vui lòng nhập mật khẩu cho bài tập'), { status: 400 });
      }
      const passwordHash = requirePassword ? await bcrypt.hash(String(data.password).trim(), 10) : null;
      const timeLimitMinutes = data.timeLimitMinutes ? Math.max(1, parseInt(data.timeLimitMinutes, 10)) : null;

      const assignmentResult = await client.query(
        `INSERT INTO homework_assignments
         (tenant_id, class_id, title, description, instructions, due_date, allow_late_submission, total_score, status, show_answers_after_submit, show_score_after_submit, require_password, password_hash, time_limit_minutes, shuffle_questions, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
         RETURNING *`,
        [
          tenantId,
          classIds[0] || null,
          data.title,
          data.description || null,
          data.instructions || null,
          data.dueDate || null,
          !!data.allowLateSubmission,
          data.totalScore || 100,
          data.status || 'draft',
          !!data.showAnswersAfterSubmit,
          data.showScoreAfterSubmit !== undefined ? !!data.showScoreAfterSubmit : true,
          requirePassword,
          passwordHash,
          timeLimitMinutes,
          !!data.shuffleQuestions,
          user?.id || null,
        ]
      );
      const assignment = assignmentResult.rows[0];

      await this._replaceQuestions(client, tenantId, assignment.id, data.questions || []);
      await this._replaceClasses(client, tenantId, assignment.id, classIds);
      const { allStudentIds } = await this._syncStudents(client, tenantId, assignment.id, classIds, data.studentIds || []);

      await client.query('COMMIT');

      if (assignment.status === 'active' && allStudentIds.length) {
        this._notifyStudentsAssigned(tenantId, assignment, allStudentIds).catch((err) => {
          console.error('Failed to send homework-assigned notifications:', err);
        });
      }

      let className = null;
      if (data.classId) {
        const classInfo = await pool.query('SELECT name FROM classes WHERE id=$1 AND tenant_id=$2', [data.classId, tenantId]);
        className = classInfo.rows[0]?.name || null;
      }

      activityLogService.log(tenantId, user, {
        actionType: 'create',
        entityType: 'homework',
        entityId: assignment.id,
        entityName: assignment.title,
        description: className
          ? `đã tạo bài tập "${assignment.title}" cho lớp "${className}"`
          : `đã tạo bài tập "${assignment.title}" (chưa gán lớp)`,
        metadata: { classId: data.classId || null, className, status: assignment.status },
      }).catch((err) => console.error('Failed to log homework creation:', err));

      this._getAdminAndTeacherIds(tenantId, classIds)
        .then((recipientIds) => this._broadcastAssignmentChange(tenantId, recipientIds, {
          type: 'homework_assignment_created',
          assignmentId: assignment.id,
          title: assignment.title,
        }))
        .catch((err) => console.error('Failed to broadcast homework creation:', err));

      return this.getAssignment(tenantId, assignment.id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateAssignment(tenantId, id, user, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT * FROM homework_assignments WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
        [id, tenantId]
      );
      if (!current.rows.length) {
        await client.query('ROLLBACK');
        return null;
      }
      if (isTeacherOnly(user)) {
        const allowed = await isTeacherOfClass(client, tenantId, current.rows[0].class_id, user.id);
        if (!allowed.rows.length) throw Object.assign(new Error('Bạn chỉ có thể sửa bài tập của lớp mình phụ trách'), { status: 403 });
      }
      const newClassIds = Array.isArray(data.classIds) ? data.classIds.filter(Boolean).map(Number) : (data.classId !== undefined ? [Number(data.classId)].filter(Boolean) : null);
      if (isTeacherOnly(user) && newClassIds?.length) {
        for (const cid of newClassIds) {
          const allowed = await isTeacherOfClass(client, tenantId, cid, user.id);
          if (!allowed.rows.length) throw Object.assign(new Error('Bạn chỉ có thể giao bài cho lớp mình phụ trách'), { status: 403 });
        }
      }

      const requirePassword = data.requirePassword !== undefined ? !!data.requirePassword : current.rows[0].require_password;
      let passwordHash = current.rows[0].password_hash;
      if (requirePassword) {
        const newPassword = String(data.password || '').trim();
        if (newPassword) {
          passwordHash = await bcrypt.hash(newPassword, 10);
        } else if (!passwordHash) {
          throw Object.assign(new Error('Vui lòng nhập mật khẩu cho bài tập'), { status: 400 });
        }
      } else {
        passwordHash = null;
      }

      const timeLimitMinutes = data.timeLimitMinutes !== undefined
        ? (data.timeLimitMinutes ? Math.max(1, parseInt(data.timeLimitMinutes, 10)) : null)
        : current.rows[0].time_limit_minutes;

      const shuffleQuestions = data.shuffleQuestions !== undefined ? !!data.shuffleQuestions : current.rows[0].shuffle_questions;

      const assignmentResult = await client.query(
        `UPDATE homework_assignments
         SET class_id=$1,
             title=$2,
             description=$3,
             instructions=$4,
             due_date=$5,
             allow_late_submission=$6,
             total_score=$7,
             status=$8,
             show_answers_after_submit=$9,
             show_score_after_submit=$10,
             require_password=$11,
             password_hash=$12,
             time_limit_minutes=$13,
             shuffle_questions=$14,
             updated_by=$15, updated_at=NOW()
         WHERE id=$16 AND tenant_id=$17
         RETURNING *`,
        [
          (newClassIds && newClassIds[0]) || current.rows[0].class_id,
          data.title,
          data.description || null,
          data.instructions || null,
          data.dueDate || null,
          !!data.allowLateSubmission,
          data.totalScore || 100,
          data.status || current.rows[0].status,
          data.showAnswersAfterSubmit !== undefined ? !!data.showAnswersAfterSubmit : current.rows[0].show_answers_after_submit,
          data.showScoreAfterSubmit !== undefined ? !!data.showScoreAfterSubmit : current.rows[0].show_score_after_submit,
          requirePassword,
          passwordHash,
          timeLimitMinutes,
          shuffleQuestions,
          user?.id || null,
          id,
          tenantId,
        ]
      );
      if (!assignmentResult.rows.length) {
        await client.query('ROLLBACK');
        return null;
      }

      if (Array.isArray(data.questions)) {
        await this._replaceQuestions(client, tenantId, id, data.questions);
      }
      let syncResult = null;
      if (data.reassign || Array.isArray(data.studentIds) || newClassIds !== null) {
        const effectiveClassIds = newClassIds !== null ? newClassIds : [assignmentResult.rows[0].class_id].filter(Boolean);
        await this._replaceClasses(client, tenantId, id, effectiveClassIds);
        syncResult = await this._syncStudents(client, tenantId, id, effectiveClassIds, data.studentIds || []);
      }

      await client.query('COMMIT');

      const updatedAssignment = assignmentResult.rows[0];
      const wasActive = current.rows[0].status === 'active';
      const becameActive = !wasActive && updatedAssignment.status === 'active';

      if (updatedAssignment.status === 'active') {
        if (becameActive) {
          // Just published: notify everyone currently assigned, even if class/students weren't touched this save.
          const recipientIds = syncResult
            ? syncResult.allStudentIds
            : (await pool.query(
                `SELECT student_id FROM homework_assignment_students WHERE tenant_id=$1 AND assignment_id=$2`,
                [tenantId, id]
              )).rows.map((row) => Number(row.student_id));
          if (recipientIds.length) {
            this._notifyStudentsAssigned(tenantId, updatedAssignment, recipientIds).catch((err) => {
              console.error('Failed to send homework-assigned notifications:', err);
            });
          }
        } else if (syncResult && syncResult.newlyAddedStudentIds.length) {
          // Already published, but new students were just added to it (e.g. added to the class).
          this._notifyStudentsAssigned(tenantId, updatedAssignment, syncResult.newlyAddedStudentIds).catch((err) => {
            console.error('Failed to send homework-assigned notifications:', err);
          });
        }
      }
      activityLogService.log(tenantId, user, {
        actionType: 'update',
        entityType: 'homework',
        entityId: id,
        entityName: updatedAssignment.title,
        description: `đã cập nhật bài tập "${updatedAssignment.title}"`,
      }).catch((err) => console.error('Failed to log homework update:', err));

      pool.query(
        `SELECT class_id FROM homework_assignment_classes WHERE tenant_id=$1 AND assignment_id=$2`,
        [tenantId, id]
      ).then((linkedClasses) => {
        const currentClassIds = linkedClasses.rows.map((row) => Number(row.class_id));
        return this._getAdminAndTeacherIds(tenantId, currentClassIds);
      }).then((recipientIds) => this._broadcastAssignmentChange(tenantId, recipientIds, {
        type: 'homework_assignment_updated',
        assignmentId: id,
        title: updatedAssignment.title,
      })).catch((err) => console.error('Failed to broadcast homework update:', err));

      return this.getAssignment(tenantId, id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async deleteAssignment(tenantId, id, user = null) {
    const assignment = await pool.query('SELECT class_id, title FROM homework_assignments WHERE id=$1 AND tenant_id=$2', [id, tenantId]);
    if (!assignment.rows.length) return;
    if (isTeacherOnly(user)) {
      const allowed = await pool.query('SELECT 1 FROM class_teachers WHERE tenant_id=$1 AND class_id=$2 AND teacher_id=$3 LIMIT 1', [tenantId, assignment.rows[0].class_id, user.id]);
      if (!allowed.rows.length) throw Object.assign(new Error('Bạn chỉ có thể xoá bài tập của lớp mình phụ trách'), { status: 403 });
    }

    const linkedClasses = await pool.query(
      `SELECT class_id FROM homework_assignment_classes WHERE tenant_id=$1 AND assignment_id=$2`,
      [tenantId, id]
    );
    const affectedClassIds = linkedClasses.rows.map((row) => Number(row.class_id));

    await pool.query('DELETE FROM homework_assignments WHERE id=$1 AND tenant_id=$2', [id, tenantId]);

    activityLogService.log(tenantId, user, {
      actionType: 'delete',
      entityType: 'homework',
      entityId: id,
      entityName: assignment.rows[0].title,
      description: `đã xoá bài tập "${assignment.rows[0].title}"`,
    }).catch((err) => console.error('Failed to log homework deletion:', err));

    this._getAdminAndTeacherIds(tenantId, affectedClassIds)
      .then((recipientIds) => this._broadcastAssignmentChange(tenantId, recipientIds, {
        type: 'homework_assignment_deleted',
        assignmentId: id,
        title: assignment.rows[0].title,
      }))
      .catch((err) => console.error('Failed to broadcast homework deletion:', err));
  },

  async _replaceQuestions(client, tenantId, assignmentId, questions) {
    const normalizedQuestions = normalizeQuestions(questions);
    await client.query('DELETE FROM homework_assignment_questions WHERE tenant_id=$1 AND assignment_id=$2', [tenantId, assignmentId]);
    for (const question of normalizedQuestions) {
      if (question.questionType === 'multiple_choice_4') {
        if (question.options.length !== 4) {
          throw Object.assign(new Error('Câu trắc nghiệm 4 đáp án phải có đúng 4 lựa chọn'), { status: 400 });
        }
        if (!question.correctAnswer || !['A', 'B', 'C', 'D'].includes(String(question.correctAnswer).toUpperCase())) {
          throw Object.assign(new Error('Câu trắc nghiệm 4 đáp án phải chọn 1 đáp án đúng A/B/C/D'), { status: 400 });
        }
      }
      if (question.questionType === 'true_false' && !['true', 'false', 'đúng', 'sai'].includes(normalizeAnswerValue(question.correctAnswer))) {
        throw Object.assign(new Error('Câu True/False phải chọn đáp án đúng hoặc sai'), { status: 400 });
      }
      if (question.questionType === 'essay') {
        question.correctAnswer = null;
      }

      await client.query(
        `INSERT INTO homework_assignment_questions
         (tenant_id, assignment_id, order_number, question_type, question_text, help_text, is_required, score, correct_answer, options, metadata, bank_question_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12)`,
        [
          tenantId,
          assignmentId,
          question.orderNumber,
          question.questionType,
          question.questionText,
          question.helpText,
          !!question.isRequired,
          question.score || 1,
          question.correctAnswer,
          JSON.stringify(question.options || []),
          JSON.stringify(question.metadata || {}),
          question.bankQuestionId || null,
        ]
      );
    }
  },

  async _syncStudents(client, tenantId, assignmentId, classIds = [], studentIds = []) {
    const ids = new Set((studentIds || []).map(Number).filter(Boolean));

    const normalizedClassIds = (Array.isArray(classIds) ? classIds : [classIds]).filter(Boolean).map(Number);
    if (normalizedClassIds.length) {
      const classStudents = await client.query(
        `SELECT DISTINCT student_id FROM class_students WHERE tenant_id=$1 AND class_id = ANY($2::int[]) AND status='active'`,
        [tenantId, normalizedClassIds]
      );
      classStudents.rows.forEach((row) => ids.add(Number(row.student_id)));
    }

    const idsArray = Array.from(ids);

    // Only remove students who are no longer supposed to have this assignment. Previously this
    // deleted ALL assignment_student rows on every save (even a trivial title edit), which cascades
    // to delete their homework_submissions too — silently wiping out already-graded work. Now we
    // only touch the students who actually left the assignment.
    if (idsArray.length) {
      await client.query(
        `DELETE FROM homework_assignment_students WHERE tenant_id=$1 AND assignment_id=$2 AND student_id <> ALL($3::int[])`,
        [tenantId, assignmentId, idsArray]
      );
    } else {
      await client.query('DELETE FROM homework_assignment_students WHERE tenant_id=$1 AND assignment_id=$2', [tenantId, assignmentId]);
    }

    const newlyAddedStudentIds = [];
    for (const studentId of idsArray) {
      const result = await client.query(
        `INSERT INTO homework_assignment_students (tenant_id, assignment_id, student_id, status)
         VALUES ($1,$2,$3,'assigned')
         ON CONFLICT (assignment_id, student_id) DO NOTHING
         RETURNING id`,
        [tenantId, assignmentId, studentId]
      );
      if (result.rows.length) newlyAddedStudentIds.push(studentId);
    }
    return { allStudentIds: idsArray, newlyAddedStudentIds };
  },

  async _replaceClasses(client, tenantId, assignmentId, classIds = []) {
    const normalizedIds = [...new Set((classIds || []).filter(Boolean).map(Number))];
    await client.query('DELETE FROM homework_assignment_classes WHERE tenant_id=$1 AND assignment_id=$2', [tenantId, assignmentId]);
    for (const classId of normalizedIds) {
      await client.query(
        `INSERT INTO homework_assignment_classes (tenant_id, assignment_id, class_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [tenantId, assignmentId, classId]
      );
    }
    return normalizedIds;
  },
};