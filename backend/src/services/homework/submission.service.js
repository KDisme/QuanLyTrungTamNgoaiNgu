const pool = require('../../config/database');
const bcrypt = require('bcryptjs');
const activityLogService = require('../activityLog.service');
const { toJson, normalizeAnswerValue } = require('./utils');
const { ensureStudentHomeworkAssignments } = require('./db-helpers');
const { decodeMultipleChoiceAnswer } = require('./shuffle');

module.exports = {
  async submitAssignment(tenantId, assignmentId, studentId, payload) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await ensureStudentHomeworkAssignments(tenantId, studentId);
      const assignmentResult = await client.query(
        `SELECT * FROM homework_assignments WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
        [assignmentId, tenantId]
      );
      if (!assignmentResult.rows.length) {
        await client.query('ROLLBACK');
        return null;
      }
      const assignment = assignmentResult.rows[0];
      if (assignment.status !== 'active') throw Object.assign(new Error('Bài tập chưa mở hoặc đã đóng'), { status: 400 });
      if (assignment.due_date && !assignment.allow_late_submission && new Date() > new Date(assignment.due_date)) {
        throw Object.assign(new Error('Đã hết hạn nộp bài'), { status: 400 });
      }

      const assignmentStudentResult = await client.query(
        `SELECT * FROM homework_assignment_students WHERE tenant_id=$1 AND assignment_id=$2 AND student_id=$3 FOR UPDATE`,
        [tenantId, assignmentId, studentId]
      );
      if (!assignmentStudentResult.rows.length) {
        throw Object.assign(new Error('Bạn chưa được giao bài này'), { status: 403 });
      }
      const assignmentStudent = assignmentStudentResult.rows[0];

      if (assignment.require_password && !assignmentStudent.started_at) {
        const provided = payload?.password;
        if (!provided || !(await bcrypt.compare(String(provided), assignment.password_hash || ''))) {
          throw Object.assign(new Error('Sai mật khẩu bài tập'), { status: 423, code: 'INVALID_PASSWORD' });
        }
      }

      const timeLimitMinutes = Number(assignment.time_limit_minutes || 0);
      if (timeLimitMinutes > 0 && assignmentStudent.started_at) {
        const deadlineAt = new Date(new Date(assignmentStudent.started_at).getTime() + timeLimitMinutes * 60000);
        const graceMs = 30000; // network/auto-submit latency buffer
        if (Date.now() > deadlineAt.getTime() + graceMs) {
          throw Object.assign(new Error('Đã hết thời gian làm bài, bài nộp không được chấp nhận'), { status: 423, code: 'TIME_UP' });
        }
      }

      const questionsResult = await client.query(
        `SELECT * FROM homework_assignment_questions WHERE tenant_id=$1 AND assignment_id=$2 ORDER BY order_number`,
        [tenantId, assignmentId]
      );
      const questionMap = new Map(questionsResult.rows.map((row) => [Number(row.id), row]));
      const myOptionOrders = toJson(assignmentStudent.option_order, {}); // mapping riêng của học viên này
      const answerItems = Array.isArray(payload?.answers) ? payload.answers : [];
      const storedAnswers = [];
      let totalScore = 0;
      let hasEssay = false;

      for (const answer of answerItems) {
        const questionId = Number(answer.questionId || answer.question_id);
        const question = questionMap.get(questionId);
        if (!question) continue;

        const questionType = String(question.question_type || '').toLowerCase();
        const answerText = String(answer.answerText ?? answer.answer_text ?? '').trim();
        const selectedAnswer = String(answer.selectedAnswer ?? answer.selected_answer ?? answer.answerValue ?? answer.answer_value ?? '').trim();
        const score = Number(question.score || 1);
        let isCorrect = null;

        if (questionType === 'essay') {
          hasEssay = true;
        } else if (questionType === 'true_false') {
          const expected = normalizeAnswerValue(question.correct_answer);
          const actual = normalizeAnswerValue(selectedAnswer || answerText);
          isCorrect = expected === actual;
          totalScore += isCorrect ? score : 0;
        } else if (questionType === 'multiple_choice_4') {
          // Học viên chọn theo "vị trí hiển thị" (A/B/C/D cố định), cần giải mã về label gốc trước khi so sánh
          const mapping = myOptionOrders ? myOptionOrders[questionId] : null; // ví dụ ['C','A','D','B']
          const options = toJson(question.options, []);
          const positionLabels = options.map((o) => o.label);
          const chosenPosition = selectedAnswer || answerText;

          const decodedAnswer = decodeMultipleChoiceAnswer({ mapping, positionLabels, chosenPosition });

          const expected = normalizeAnswerValue(question.correct_answer);
          const actual = normalizeAnswerValue(decodedAnswer);
          isCorrect = expected === actual;
          totalScore += isCorrect ? score : 0;
        }

        storedAnswers.push({
          questionId,
          questionType,
          answerText: answerText || null,
          selectedAnswer: selectedAnswer || null,
          isCorrect,
          score: isCorrect === true ? score : 0,
          metadata: toJson(answer.metadata, {}),
        });
      }

      const isDraft = !!payload?.isDraft;
      const status = isDraft ? 'draft' : (hasEssay ? 'submitted' : 'graded');
      const gradedAt = status === 'graded' ? new Date() : null;
      const submissionResult = await client.query(
        `INSERT INTO homework_submissions
         (tenant_id, assignment_student_id, answers, status, total_score, feedback, submitted_by, submitted_at, graded_by, graded_at)
         VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,NOW(),$7,$8)
         ON CONFLICT (assignment_student_id)
         DO UPDATE SET answers=EXCLUDED.answers,
           status=EXCLUDED.status,
           total_score=EXCLUDED.total_score,
           feedback=EXCLUDED.feedback,
           submitted_by=EXCLUDED.submitted_by,
           submitted_at=CASE WHEN $9 = TRUE THEN homework_submissions.submitted_at ELSE NOW() END,
           graded_by=COALESCE(EXCLUDED.graded_by, homework_submissions.graded_by),
           graded_at=COALESCE(EXCLUDED.graded_at, homework_submissions.graded_at),
           updated_at=NOW()
         RETURNING *`,
        [tenantId, assignmentStudent.id, JSON.stringify(storedAnswers), status, totalScore, payload?.feedback || null, studentId, gradedAt, isDraft]
      );

      const studentStatus = isDraft ? 'in_progress' : status;
      const updatedStudent = await client.query(
        `UPDATE homework_assignment_students
         SET status=$1,
             submitted_at=CASE WHEN $6 = TRUE THEN submitted_at ELSE NOW() END,
             total_score=CASE WHEN $6 = TRUE THEN total_score ELSE $2 END,
             feedback=CASE WHEN $6 = TRUE THEN feedback ELSE $3 END,
             updated_at=NOW()
         WHERE id=$4 AND tenant_id=$5
         RETURNING *`,
        [studentStatus, totalScore, payload?.feedback || null, assignmentStudent.id, tenantId, isDraft]
      );

      await client.query('COMMIT');
      return { ...updatedStudent.rows[0], submission: submissionResult.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async gradeSubmission(tenantId, submissionId, actor, data) {
    const userId = actor?.id || actor; // hỗ trợ cả trường hợp truyền thẳng id cũ
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const submissionResult = await client.query(
        `SELECT sub.*, s.tenant_id, s.assignment_id, s.student_id
         FROM homework_submissions sub
         JOIN homework_assignment_students s ON s.id = sub.assignment_student_id
         WHERE sub.id=$1 AND sub.tenant_id=$2
         FOR UPDATE`,
        [submissionId, tenantId]
      );
      if (!submissionResult.rows.length) {
        await client.query('ROLLBACK');
        return null;
      }
      const submission = submissionResult.rows[0];
      const feedback = data.feedback ?? submission.feedback ?? null;
      const answers = Array.isArray(data.answers) ? data.answers : [];

      const currentAnswers = toJson(submission.answers, []);
      const answerMap = new Map(currentAnswers.map((answer) => [Number(answer.questionId || answer.question_id), { ...answer }]));

      for (const answer of answers) {
        const questionId = Number(answer.questionId || answer.question_id);
        if (!questionId) continue;
        const existing = answerMap.get(questionId) || {};
        const nextScore = Number(answer.score ?? existing.score ?? 0);
        answerMap.set(questionId, {
          ...existing,
          ...answer,
          questionId,
          score: Number.isFinite(nextScore) ? nextScore : 0,
        });
      }

      const mergedAnswers = Array.from(answerMap.values());
      const score = mergedAnswers.reduce((sum, answer) => sum + Number(answer.score || 0), 0);

      const requestRevision = !!data?.requestRevision;
      const status = requestRevision ? 'draft' : 'graded';
      const studentStatus = requestRevision ? 'revision_required' : 'graded';

      const submissionParams = [score, feedback, userId];
      const submissionUpdates = [
        'total_score=$1',
        'feedback=$2',
        `status='${status}'`,
        'graded_by=$3',
        'graded_at=NOW()',
      ];
      submissionUpdates.push(`answers=$${submissionParams.length + 1}::jsonb`);
      submissionParams.push(JSON.stringify(mergedAnswers));
      submissionParams.push(submissionId, tenantId);
      const updatedSubmission = await client.query(
        `UPDATE homework_submissions
         SET ${submissionUpdates.join(', ')},
             updated_at=NOW()
         WHERE id=$${submissionParams.length - 1} AND tenant_id=$${submissionParams.length}
         RETURNING *`,
        submissionParams
      );

      await client.query(
        `UPDATE homework_assignment_students
         SET status=$1, total_score=$2, feedback=$3, updated_at=NOW()
         WHERE id=$4 AND tenant_id=$5`,
        [studentStatus, score, feedback, submission.assignment_student_id, tenantId]
      );
      const assignmentInfo = await client.query(
        `SELECT ha.title, u.full_name AS student_name
         FROM homework_assignment_students has
         JOIN homework_assignments ha ON ha.id = has.assignment_id
         JOIN users u ON u.id = has.student_id
         WHERE has.id = $1 AND has.tenant_id = $2`,
        [submission.assignment_student_id, tenantId]
      );

      await client.query('COMMIT');
      const info = assignmentInfo.rows[0] || {};
      activityLogService.log(tenantId, actor, {
        actionType: requestRevision ? 'update' : 'grade',
        entityType: 'homework_submission',
        entityId: submissionId,
        entityName: info.title || null,
        description: requestRevision
          ? `đã yêu cầu học viên "${info.student_name || ''}" làm lại bài "${info.title || ''}"`
          : `đã chấm bài "${info.title || ''}" của học viên "${info.student_name || ''}" - ${score} điểm`,
        metadata: {
          previousScore: Number(submission.total_score || 0),
          newScore: score,
          studentName: info.student_name,
          homeworkTitle: info.title,
        },
      }).catch((err) => console.error('Failed to log grade activity:', err));
      return updatedSubmission.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};