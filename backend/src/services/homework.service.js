const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const notificationService = require('./notification.service');
const activityLogService = require('./activityLog.service');

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toJson(value, fallback = []) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function hasAnyRole(user, roles = []) {
  const userRoles = user?.roles || [];
  return roles.some((role) => userRoles.includes(role));
}

function isAdminStaff(user) {
  return hasAnyRole(user, ['admin', 'staff']);
}

function isTeacherOnly(user) {
  return hasAnyRole(user, ['teacher']) && !isAdminStaff(user);
}

function isStudentOnly(user) {
  return hasAnyRole(user, ['student']) && !isAdminStaff(user) && !hasAnyRole(user, ['teacher']);
}

function camelQuestion(row) {
  return row ? {
    ...row,
    questionType: row.question_type,
    questionText: row.question_text,
    helpText: row.help_text,
    isRequired: row.is_required,
    orderNumber: row.order_number,
    correctAnswer: row.correct_answer,
    assignmentId: row.assignment_id,
    questionCount: row.question_count,
    options: toJson(row.options, []),
    metadata: toJson(row.metadata, {}),
  } : row;
}

function camelAssignment(row) {
  if (!row) return row;
  const { password_hash, ...safeRow } = row;
  const creatorRoles = (row.creator_roles || []).filter(Boolean);
  const creatorIsAdmin = creatorRoles.includes('admin');
  return {
    ...safeRow,
    classId: row.class_id,
    className: row.class_name,
    creatorName: row.creator_name,
    creatorRoles,
    creatorLabel: row.creator_name
      ? (creatorIsAdmin ? 'Người tạo bài (Admin)' : 'Giáo viên tạo bài')
      : null,
    dueDate: row.due_date,
    allowLateSubmission: row.allow_late_submission,
    totalScore: row.total_score,
    showAnswersAfterSubmit: row.show_answers_after_submit,
    showScoreAfterSubmit: row.show_score_after_submit,
    requirePassword: row.require_password,
    timeLimitMinutes: row.time_limit_minutes,
    questionCount: Number(row.question_count || 0),
    studentCount: Number(row.student_count || 0),
    submittedCount: Number(row.submitted_count || 0),
    myAssignmentStudentId: row.my_assignment_student_id,
    myStatus: row.my_status,
    myTotalScore: row.my_total_score,
    mySubmittedAt: row.my_submitted_at,
    myFeedback: row.my_feedback,
    myStartedAt: row.my_started_at,
    myAssignedAt: row.my_assigned_at,
  };
}

function camelStudent(row) {
  return row ? {
    ...row,
    studentId: row.student_id,
    studentName: row.full_name,
    studentEmail: row.email,
    assignmentStudentId: row.id,
    startedAt: row.started_at,
    submissionId: row.submission_id,
    submissionStatus: row.submission_status,
    submissionSubmittedAt: row.submission_submitted_at,
    submissionTotalScore: row.submission_total_score,
    submissionFeedback: row.submission_feedback,
    submissionAnswers: toJson(row.submission_answers, []),
    answers: toJson(row.submission_answers, []),
  } : row;
}

function normalizeQuestions(questions = []) {
  return questions
    .map((question, index) => {
      const questionType = String(question.questionType || question.question_type || 'multiple_choice_4');
      const options = Array.isArray(question.options)
        ? question.options.map((option) => ({
            label: String(option.label || option.optionLabel || '').trim().toUpperCase(),
            text: String(option.text || option.optionText || '').trim(),
          })).filter((option) => option.label)
        : [];
      const rawCorrect = question.correctAnswer ?? question.correct_answer ?? '';
      const correctAnswer = String(rawCorrect || '').trim();
      return {
        orderNumber: toInt(question.orderNumber ?? question.order_number, index + 1),
        questionType,
        questionText: String(question.questionText ?? question.question_text ?? '').trim(),
        helpText: String(question.helpText ?? question.help_text ?? '').trim() || null,
        isRequired: question.isRequired ?? question.is_required ?? true,
        score: Number(question.score || 1),
        correctAnswer: correctAnswer || null,
        options,
        metadata: toJson(question.metadata, {}),
      };
    })
    .filter((question) => question.questionText);
}

function normalizeAnswerValue(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

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

class HomeworkService {
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
        SELECT 1 FROM class_teachers ct
        WHERE ct.tenant_id = a.tenant_id AND ct.class_id = a.class_id AND ct.teacher_id = $${idx}
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
        `SELECT a.*, c.name AS class_name,
          (SELECT COUNT(*) FROM homework_assignment_questions q WHERE q.assignment_id = a.id AND q.tenant_id = a.tenant_id) AS question_count,
          (SELECT COUNT(*) FROM homework_assignment_students s WHERE s.assignment_id = a.id AND s.tenant_id = a.tenant_id) AS student_count,
          (SELECT COUNT(*) FROM homework_assignment_students s JOIN homework_submissions sub ON sub.assignment_student_id = s.id WHERE s.assignment_id = a.id AND s.tenant_id = a.tenant_id AND sub.status IN ('submitted', 'graded')) AS submitted_count
          ${studentSelect}
         FROM homework_assignments a
         LEFT JOIN classes c ON c.id = a.class_id
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
  }

  async getAssignment(tenantId, id, user = null, password = null) {
    if (isStudentOnly(user)) await ensureStudentHomeworkAssignments(tenantId, user.id);
    const assignmentResult = await pool.query(
      `SELECT a.*, c.name AS class_name
       FROM homework_assignments a
       LEFT JOIN classes c ON c.id = a.class_id
       WHERE a.id = $1 AND a.tenant_id = $2`,
      [id, tenantId]
    );
    if (!assignmentResult.rows.length) return null;
    const assignment = assignmentResult.rows[0];
    const roles = user?.roles || [];

    if (isTeacherOnly(user)) {
      const allowed = await pool.query(
        `SELECT 1 FROM class_teachers WHERE tenant_id=$1 AND class_id=$2 AND teacher_id=$3 LIMIT 1`,
        [tenantId, assignment.class_id, user.id]
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

      // --- Xáo trộn thứ tự câu hỏi + nội dung đáp án, cố định riêng cho từng học viên ---
      if (mySubmission) {
        let questionOrder = toJson(mySubmission.question_order, null);
        let optionOrders = toJson(mySubmission.option_order, null);

        const validOrder = Array.isArray(questionOrder)
          && questionOrder.length === questions.length
          && questions.every((q) => questionOrder.includes(q.id));

        if (!validOrder) {
          questionOrder = shuffleArray(questions.map((q) => q.id));
          optionOrders = {};
          questions.forEach((q) => {
            if (q.questionType === 'multiple_choice_4' && Array.isArray(q.options) && q.options.length) {
              // Vị trí A/B/C/D giữ nguyên. Ta chỉ xáo trộn xem NỘI DUNG của label gốc nào
              // sẽ được đặt vào từng vị trí đó.
              const originalLabels = q.options.map((o) => o.label);
              optionOrders[q.id] = shuffleArray(originalLabels);
            }
          });
          await pool.query(
            `UPDATE homework_assignment_students SET question_order=$1::jsonb, option_order=$2::jsonb, updated_at=NOW() WHERE id=$3 AND tenant_id=$4`,
            [JSON.stringify(questionOrder), JSON.stringify(optionOrders), mySubmission.assignmentStudentId, tenantId]
          );
        }

        const questionMap = new Map(questions.map((q) => [Number(q.id), q]));
        questions = questionOrder.map((qid) => questionMap.get(Number(qid))).filter(Boolean);

        questions = questions.map((q) => {
          const mapping = optionOrders ? optionOrders[q.id] : null; // ví dụ ['C','A','D','B']
          if (Array.isArray(mapping) && Array.isArray(q.options) && mapping.length === q.options.length) {
            const positionLabels = q.options.map((o) => o.label); // ['A','B','C','D'] — vị trí cố định
            const originalByLabel = new Map(q.options.map((o) => [o.label, o]));
            // Vị trí A hiển thị nội dung của label mapping[0], vị trí B hiển thị nội dung của mapping[1], ...
            const reorderedOptions = positionLabels.map((posLabel, idx) => {
              const origOption = originalByLabel.get(mapping[idx]);
              return { label: posLabel, text: origOption ? origOption.text : '' };
            });

            // Nếu được phép xem đáp án, phải đổi đáp án đúng từ "label gốc" sang "vị trí hiện tại"
            let remappedCorrectAnswer = q.correctAnswer;
            if (q.correctAnswer) {
              const posIndex = mapping.indexOf(q.correctAnswer);
              remappedCorrectAnswer = posIndex >= 0 ? positionLabels[posIndex] : q.correctAnswer;
            }

            return { ...q, options: reorderedOptions, correctAnswer: remappedCorrectAnswer };
          }
          return q;
        });
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
      questions,
      students,
      mySubmission,
      canRevealAnswers: isStudentOnly(user) ? canRevealAnswers : undefined,
      canRevealScore: isStudentOnly(user) ? canRevealScore : undefined,
      remainingSeconds: isStudentOnly(user) ? remainingSeconds : undefined,
    };
  }

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
  }

  async createAssignment(tenantId, user, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (isTeacherOnly(user) && data.classId) {
        const allowed = await isTeacherOfClass(client, tenantId, data.classId, user.id);
        if (!allowed.rows.length) throw Object.assign(new Error('Bạn chỉ có thể giao bài cho lớp mình phụ trách'), { status: 403 });
      }

      const requirePassword = !!data.requirePassword;
      if (requirePassword && !String(data.password || '').trim()) {
        throw Object.assign(new Error('Vui lòng nhập mật khẩu cho bài tập'), { status: 400 });
      }
      const passwordHash = requirePassword ? await bcrypt.hash(String(data.password).trim(), 10) : null;
      const timeLimitMinutes = data.timeLimitMinutes ? Math.max(1, parseInt(data.timeLimitMinutes, 10)) : null;

      const assignmentResult = await client.query(
        `INSERT INTO homework_assignments
         (tenant_id, class_id, title, description, instructions, due_date, allow_late_submission, total_score, status, show_answers_after_submit, show_score_after_submit, require_password, password_hash, time_limit_minutes, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
         RETURNING *`,
        [
          tenantId,
          data.classId || null,
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
          user?.id || null,
        ]
      );
      const assignment = assignmentResult.rows[0];

      await this._replaceQuestions(client, tenantId, assignment.id, data.questions || []);
      const { allStudentIds } = await this._syncStudents(client, tenantId, assignment.id, data.classId || null, data.studentIds || []);

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

      return this.getAssignment(tenantId, assignment.id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

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
      if (isTeacherOnly(user) && data.classId) {
        const allowed = await isTeacherOfClass(client, tenantId, data.classId, user.id);
        if (!allowed.rows.length) throw Object.assign(new Error('Bạn chỉ có thể giao bài cho lớp mình phụ trách'), { status: 403 });
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
             updated_by=$14, updated_at=NOW()
         WHERE id=$15 AND tenant_id=$16
         RETURNING *`,
        [
          data.classId || current.rows[0].class_id,
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
      if (data.reassign || Array.isArray(data.studentIds) || data.classId !== undefined) {
        syncResult = await this._syncStudents(client, tenantId, id, data.classId || assignmentResult.rows[0].class_id || null, data.studentIds || []);
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

      return this.getAssignment(tenantId, id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteAssignment(tenantId, id, user = null) {
    const assignment = await pool.query('SELECT class_id, title FROM homework_assignments WHERE id=$1 AND tenant_id=$2', [id, tenantId]);
    if (!assignment.rows.length) return;
    if (isTeacherOnly(user)) {
      const allowed = await pool.query('SELECT 1 FROM class_teachers WHERE tenant_id=$1 AND class_id=$2 AND teacher_id=$3 LIMIT 1', [tenantId, assignment.rows[0].class_id, user.id]);
      if (!allowed.rows.length) throw Object.assign(new Error('Bạn chỉ có thể xoá bài tập của lớp mình phụ trách'), { status: 403 });
    }
    await pool.query('DELETE FROM homework_assignments WHERE id=$1 AND tenant_id=$2', [id, tenantId]);

    activityLogService.log(tenantId, user, {
      actionType: 'delete',
      entityType: 'homework',
      entityId: id,
      entityName: assignment.rows[0].title,
      description: `đã xoá bài tập "${assignment.rows[0].title}"`,
    }).catch((err) => console.error('Failed to log homework deletion:', err));
  }

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

          let decodedAnswer = chosenPosition;
          if (Array.isArray(mapping) && mapping.length === positionLabels.length) {
            const posIndex = positionLabels.indexOf(String(chosenPosition).toUpperCase());
            if (posIndex >= 0) decodedAnswer = mapping[posIndex];
          }

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
  }

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
  }

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
         (tenant_id, assignment_id, order_number, question_type, question_text, help_text, is_required, score, correct_answer, options, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)`,
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
        ]
      );
    }
  }

  async _syncStudents(client, tenantId, assignmentId, classId, studentIds = []) {
    const ids = new Set((studentIds || []).map(Number).filter(Boolean));

    if (classId) {
      const classStudents = await client.query(
        `SELECT student_id FROM class_students WHERE tenant_id=$1 AND class_id=$2 AND status='active'`,
        [tenantId, classId]
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
  }

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
  }
}

module.exports = new HomeworkService();