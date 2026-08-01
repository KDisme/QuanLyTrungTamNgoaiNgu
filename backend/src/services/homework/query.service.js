const pool = require('../../config/database');
const bcrypt = require('bcryptjs');
const { toInt, isTeacherOnly, isStudentOnly } = require('./utils');
const { camelQuestion, camelAssignment, camelStudent } = require('./mappers');
const { ensureStudentHomeworkAssignments } = require('./db-helpers');
const { applyQuestionShuffle } = require('./shuffle');

module.exports = {
  async listAssignments(tenantId, user, { search, status, page = 1, limit = 20 }) {
    if (isStudentOnly(user)) await ensureStudentHomeworkAssignments(tenantId, user.id);
    const offset = (toInt(page, 1) - 1) * toInt(limit, 20);
    const conditions = ['a.tenant_id = $1'];
    const params = [tenantId];
    let idx = 2;

    if (search) {
      conditions.push(`(a.title ILIKE $${idx} OR a.description ILIKE $${idx} OR a.instructions ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (status) {
      conditions.push(`a.status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (isTeacherOnly(user)) {
      conditions.push(`EXISTS (
        SELECT 1 FROM homework_assignment_classes hac
        JOIN class_teachers ct ON ct.tenant_id = hac.tenant_id AND ct.class_id = hac.class_id
        WHERE hac.tenant_id = a.tenant_id AND hac.assignment_id = a.id AND ct.teacher_id = $${idx}
      )`);
      params.push(user.id);
      idx++;
    }
    if (isStudentOnly(user)) {
      conditions.push(`EXISTS (
        SELECT 1 FROM homework_assignment_students s_scope
        WHERE s_scope.tenant_id = a.tenant_id AND s_scope.assignment_id = a.id AND s_scope.student_id = $${idx}
      )`);
      params.push(user.id);
      idx++;
      conditions.push(`a.status <> 'draft'`);
    }

    const where = conditions.join(' AND ');
    const studentJoin = isStudentOnly(user)
      ? `LEFT JOIN homework_assignment_students my_asg ON my_asg.assignment_id = a.id AND my_asg.tenant_id = a.tenant_id AND my_asg.student_id = ${'$'}${idx - 1}`
      : '';
    const studentSelect = isStudentOnly(user)
      ? `, my_asg.id AS my_assignment_student_id, my_asg.status AS my_status, my_asg.total_score AS my_total_score, my_asg.submitted_at AS my_submitted_at, my_asg.feedback AS my_feedback, my_asg.started_at AS my_started_at, my_asg.assigned_at AS my_assigned_at`
      : '';
    const studentParams = params;

    const [countResult, rowsResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM homework_assignments a WHERE ${where}`, params),
      pool.query(
        `SELECT a.*,
          (SELECT string_agg(cc.name, ', ' ORDER BY cc.name)
            FROM homework_assignment_classes hac
            JOIN classes cc ON cc.id = hac.class_id
            WHERE hac.assignment_id = a.id AND hac.tenant_id = a.tenant_id) AS class_name,
          (SELECT COUNT(*) FROM homework_assignment_questions q WHERE q.assignment_id = a.id AND q.tenant_id = a.tenant_id) AS question_count,
          (SELECT COUNT(*) FROM homework_assignment_students s WHERE s.assignment_id = a.id AND s.tenant_id = a.tenant_id) AS student_count,
          (SELECT COUNT(*) FROM homework_assignment_students s JOIN homework_submissions sub ON sub.assignment_student_id = s.id WHERE s.assignment_id = a.id AND s.tenant_id = a.tenant_id AND sub.status IN ('submitted', 'graded')) AS submitted_count
          ${studentSelect}
          FROM homework_assignments a
          ${studentJoin}
         WHERE ${where}
         ORDER BY a.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...studentParams, toInt(limit, 20), offset]
      ),
    ]);

    return {
      total: parseInt(countResult.rows[0]?.count || '0', 10),
      page: toInt(page, 1),
      limit: toInt(limit, 20),
      homeworkAssignments: rowsResult.rows.map((row) => {
        const item = camelAssignment(row);
        if (isStudentOnly(user) && !row.show_score_after_submit) {
          item.myTotalScore = null;
          item.my_total_score = null;
        }
        return item;
      }),
    };
  },

  async getAssignment(tenantId, id, user = null, password = null) {
    if (isStudentOnly(user)) await ensureStudentHomeworkAssignments(tenantId, user.id);
    const assignmentResult = await pool.query(
      `SELECT a.*,
        (SELECT string_agg(cc.name, ', ' ORDER BY cc.name)
         FROM homework_assignment_classes hac
         JOIN classes cc ON cc.id = hac.class_id
         WHERE hac.assignment_id = a.id AND hac.tenant_id = a.tenant_id) AS class_name,
        (SELECT COALESCE(json_agg(json_build_object('id', cc.id, 'name', cc.name)), '[]')
         FROM homework_assignment_classes hac
         JOIN classes cc ON cc.id = hac.class_id
         WHERE hac.assignment_id = a.id AND hac.tenant_id = a.tenant_id) AS classes
       FROM homework_assignments a
       WHERE a.id = $1 AND a.tenant_id = $2`,
      [id, tenantId]
    );
    if (!assignmentResult.rows.length) return null;
    const assignment = assignmentResult.rows[0];

    if (isTeacherOnly(user)) {
      const allowed = await pool.query(
        `SELECT 1 FROM homework_assignment_classes hac
         JOIN class_teachers ct ON ct.tenant_id=hac.tenant_id AND ct.class_id=hac.class_id
         WHERE hac.tenant_id=$1 AND hac.assignment_id=$2 AND ct.teacher_id=$3 LIMIT 1`,
        [tenantId, id, user.id]
      );
      if (!allowed.rows.length) return null;
    }

    if (isStudentOnly(user)) {
      const allowed = await pool.query(
        `SELECT 1 FROM homework_assignment_students WHERE tenant_id=$1 AND assignment_id=$2 AND student_id=$3 LIMIT 1`,
        [tenantId, id, user.id]
      );
      if (!allowed.rows.length) return null;
      if (assignment.status === 'draft') return null;

      if (assignment.require_password) {
        if (!password) {
          const err = new Error('Bài tập này yêu cầu mật khẩu để làm bài');
          err.status = 423;
          err.code = 'PASSWORD_REQUIRED';
          throw err;
        }
        const match = await bcrypt.compare(String(password), assignment.password_hash || '');
        if (!match) {
          const err = new Error('Sai mật khẩu bài tập');
          err.status = 423;
          err.code = 'INVALID_PASSWORD';
          throw err;
        }
      }
    }

    const questionsResult = await pool.query(
      `SELECT * FROM homework_assignment_questions WHERE tenant_id=$1 AND assignment_id=$2 ORDER BY order_number`,
      [tenantId, id]
    );

    const studentCondition = isStudentOnly(user)
      ? 's.assignment_id = $1 AND s.tenant_id = $2 AND s.student_id = $3'
      : 's.assignment_id = $1 AND s.tenant_id = $2';
    const studentParams = isStudentOnly(user) ? [id, tenantId, user.id] : [id, tenantId];
    const studentsResult = await pool.query(
      `SELECT s.*, u.full_name, u.email,
        sub.id AS submission_id,
        sub.status AS submission_status,
        sub.submitted_at AS submission_submitted_at,
        sub.total_score AS submission_total_score,
        sub.feedback AS submission_feedback,
        sub.answers AS submission_answers,
        sub.graded_by,
        sub.graded_at
       FROM homework_assignment_students s
       JOIN users u ON u.id = s.student_id
       LEFT JOIN homework_submissions sub ON sub.assignment_student_id = s.id
       WHERE ${studentCondition}
       ORDER BY u.full_name`,
      studentParams
    );

    const students = studentsResult.rows.map(camelStudent);
    const mySubmission = isStudentOnly(user) ? students[0] || null : null;

    let questions = questionsResult.rows.map(camelQuestion);
    let canRevealAnswers;
    let canRevealScore;
    let remainingSeconds;
    if (isStudentOnly(user)) {
      const hasSubmitted = ['submitted', 'graded'].includes(String(mySubmission?.submissionStatus || '').toLowerCase());
      canRevealAnswers = !!assignment.show_answers_after_submit && hasSubmitted;
      canRevealScore = !!assignment.show_score_after_submit && hasSubmitted;

      const timeLimitMinutes = Number(assignment.time_limit_minutes || 0);
      if (timeLimitMinutes > 0 && mySubmission && !hasSubmitted) {
        let startedAt = mySubmission.startedAt;
        if (!startedAt) {
          const started = await pool.query(
            `UPDATE homework_assignment_students SET started_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND tenant_id = $2 AND started_at IS NULL
             RETURNING started_at`,
            [mySubmission.assignmentStudentId, tenantId]
          );
          startedAt = started.rows[0]?.started_at || new Date();
          mySubmission.startedAt = startedAt;
        }
        const deadlineAt = new Date(new Date(startedAt).getTime() + timeLimitMinutes * 60000);
        remainingSeconds = Math.floor((deadlineAt.getTime() - Date.now()) / 1000);
        if (remainingSeconds <= 0) {
          const err = new Error('Đã hết thời gian làm bài, bạn không thể vào làm nữa.');
          err.status = 423;
          err.code = 'TIME_UP';
          throw err;
        }
      }

      if (!canRevealAnswers) {
        questions = questions.map((question) => ({ ...question, correctAnswer: null }));
      }

      if (mySubmission && assignment.shuffle_questions) {
        questions = await applyQuestionShuffle({ pool, tenantId, questions, mySubmission });
      }

      if (mySubmission) {
        const stripAnswer = (answer) => {
          const rest = { ...(answer || {}) };
          if (!canRevealAnswers) delete rest.isCorrect;
          if (!canRevealScore) delete rest.score;
          return rest;
        };
        mySubmission.answers = (mySubmission.answers || []).map(stripAnswer);
        mySubmission.submissionAnswers = (mySubmission.submissionAnswers || []).map(stripAnswer);
        if (!canRevealScore) {
          mySubmission.submissionTotalScore = null;
          mySubmission.total_score = null;
          mySubmission.myTotalScore = null;
        }
      }
    }

    return {
      ...camelAssignment(assignment),
      classes: assignment.classes || [],
      questions,
      students,
      mySubmission,
      canRevealAnswers: isStudentOnly(user) ? canRevealAnswers : undefined,
      canRevealScore: isStudentOnly(user) ? canRevealScore : undefined,
      remainingSeconds: isStudentOnly(user) ? remainingSeconds : undefined,
    };
  },

  async getAssignmentPreview(tenantId, id, user) {
    const result = await pool.query(
      `SELECT a.*, c.name AS class_name, creator.full_name AS creator_name,
        (SELECT array_agg(r.role_type) FROM roles r WHERE r.user_id = a.created_by AND r.tenant_id = a.tenant_id) AS creator_roles,
        (SELECT COUNT(*) FROM homework_assignment_questions q WHERE q.assignment_id = a.id AND q.tenant_id = a.tenant_id) AS question_count
      FROM homework_assignments a
      LEFT JOIN classes c ON c.id = a.class_id
      LEFT JOIN users creator ON creator.id = a.created_by
      WHERE a.id = $1 AND a.tenant_id = $2`,
      [id, tenantId]
    );
    if (!result.rows.length) return null;
    const assignment = result.rows[0];

    if (isStudentOnly(user)) {
      const scopeResult = await pool.query(
        `SELECT status, total_score, submitted_at, feedback
        FROM homework_assignment_students
        WHERE tenant_id=$1 AND assignment_id=$2 AND student_id=$3 LIMIT 1`,
        [tenantId, id, user.id]
      );
      if (!scopeResult.rows.length) return null;
      if (assignment.status === 'draft') return null;
      const my = scopeResult.rows[0];
      return {
        ...camelAssignment(assignment),
        myStatus: my.status,
        myTotalScore: assignment.show_score_after_submit ? my.total_score : null,
        mySubmittedAt: my.submitted_at,
        myFeedback: assignment.show_score_after_submit ? my.feedback : null,
      };
    }

    return camelAssignment(assignment);
  },
};