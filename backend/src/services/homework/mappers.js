const { toInt, toJson } = require('./utils');

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
    classIds: row.classes ? row.classes.map((c) => c.id) : (row.class_id ? [row.class_id] : []),
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
    shuffleQuestions: row.shuffle_questions,
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
        bankQuestionId: question.bankQuestionId || question.bank_question_id || null,
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

module.exports = {
  camelQuestion,
  camelAssignment,
  camelStudent,
  normalizeQuestions,
};