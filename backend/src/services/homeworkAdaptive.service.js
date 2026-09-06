const pool = require('../config/database');
const { estimateThetaEAP } = require('./irt/ability');
const { selectNextItem } = require('./irt/itemSelector');
const { normalizeAnswerValue } = require('./homework/utils');

function mapSession(row) {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    currentTheta: Number(row.current_theta),
    usedQuestionIds: row.used_question_ids,
    status: row.status,
  };
}

class HomeworkAdaptiveService {
  // Đọc số câu mục tiêu từ chính bài tập — không hard-code, vì mỗi bài tập có thể cấu hình khác nhau.
  async _getTargetCount(tenantId, assignmentId) {
    const { rows } = await pool.query(
      `SELECT adaptive_question_count FROM homework_assignments WHERE id=$1 AND tenant_id=$2`,
      [assignmentId, tenantId]
    );
    return rows[0] ? Number(rows[0].adaptive_question_count) : 10;
  }

  async _pickNext(tenantId, session) {
    const usedIds = Array.isArray(session.used_question_ids) ? session.used_question_ids : [];

    // Đã làm đủ số câu giáo viên cấu hình -> dừng, không chọn thêm dù ngân hàng còn câu.
    const targetCount = await this._getTargetCount(tenantId, session.assignment_id);
    if (usedIds.length >= targetCount) {
      if (session.status !== 'completed') {
        await pool.query(`UPDATE homework_adaptive_sessions SET status='completed', updated_at=NOW() WHERE id=$1`, [session.id]);
      }
      return null;
    }

    const params = [tenantId];
    let where = `tenant_id = $1 AND question_type != 'essay'`;
    if (usedIds.length) {
      where += ` AND id NOT IN (${usedIds.map((_, i) => `$${i + 2}`).join(',')})`;
      params.push(...usedIds);
    }
    const { rows } = await pool.query(
      `SELECT id, question_text, question_type, options, irt_a, irt_b, irt_c
       FROM homework_question_bank WHERE ${where}`,
      params
    );
    const candidates = rows.map((r) => ({
      id: r.id,
      questionText: r.question_text,
      questionType: r.question_type,
      options: r.options,
      a: Number(r.irt_a),
      b: Number(r.irt_b),
      c: Number(r.irt_c),
    }));
    return selectNextItem(Number(session.current_theta) || 0, candidates);
  }

  async start(tenantId, user, assignmentId) {
    const existing = await pool.query(
      `SELECT * FROM homework_adaptive_sessions WHERE tenant_id=$1 AND assignment_id=$2 AND student_id=$3`,
      [tenantId, assignmentId, user.id]
    );
    let session = existing.rows[0];
    if (!session) {
      const inserted = await pool.query(
        `INSERT INTO homework_adaptive_sessions (tenant_id, assignment_id, student_id)
         VALUES ($1,$2,$3) RETURNING *`,
        [tenantId, assignmentId, user.id]
      );
      session = inserted.rows[0];
    }
    const targetCount = await this._getTargetCount(tenantId, assignmentId);
    const nextQuestion = await this._pickNext(tenantId, session);
    const usedIds = Array.isArray(session.used_question_ids) ? session.used_question_ids : [];
    return { session: mapSession(session), nextQuestion, answeredCount: usedIds.length, targetCount };
  }

  async answer(tenantId, user, sessionId, { questionId, studentAnswer }) {
    const found = await pool.query(
      `SELECT * FROM homework_adaptive_sessions WHERE id=$1 AND tenant_id=$2 AND student_id=$3`,
      [sessionId, tenantId, user.id]
    );
    const session = found.rows[0];
    if (!session) throw Object.assign(new Error('Không tìm thấy phiên thi'), { status: 404 });

    const q = await pool.query(
      `SELECT id, irt_a, irt_b, irt_c, correct_answer, question_type FROM homework_question_bank WHERE id=$1 AND tenant_id=$2`,
      [questionId, tenantId]
    );
    const item = q.rows[0];
    if (!item) throw Object.assign(new Error('Không tìm thấy câu hỏi'), { status: 404 });

    const correct = normalizeAnswerValue(studentAnswer) === normalizeAnswerValue(item.correct_answer);

    const history = Array.isArray(session.history) ? session.history : [];
    history.push({ questionId: item.id, a: Number(item.irt_a), b: Number(item.irt_b), c: Number(item.irt_c), correct: !!correct });

    const newTheta = estimateThetaEAP(history);

    const usedIds = Array.isArray(session.used_question_ids) ? session.used_question_ids : [];
    if (!usedIds.includes(item.id)) usedIds.push(item.id);

    const updated = await pool.query(
      `UPDATE homework_adaptive_sessions
       SET current_theta=$1, used_question_ids=$2, history=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [newTheta, JSON.stringify(usedIds), JSON.stringify(history), sessionId]
    );
    const updatedSession = updated.rows[0];
    const targetCount = await this._getTargetCount(tenantId, updatedSession.assignment_id);
    const nextQuestion = await this._pickNext(tenantId, updatedSession);
    return { session: mapSession(updatedSession), nextQuestion, wasCorrect: correct, answeredCount: usedIds.length, targetCount };
  }
}

module.exports = new HomeworkAdaptiveService();