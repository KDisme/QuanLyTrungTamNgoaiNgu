const pool = require('../config/database');

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

function camelItem(row) {
  return row ? {
    ...row,
    questionType: row.question_type,
    questionText: row.question_text,
    helpText: row.help_text,
    correctAnswer: row.correct_answer,
    options: toJson(row.options, []),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usageCount: toInt(row.usage_count, 0),
  } : row;
}

function normalizeOptions(options) {
  return Array.isArray(options)
    ? options.map((option) => ({
        label: String(option.label || option.optionLabel || '').trim().toUpperCase(),
        text: String(option.text || option.optionText || '').trim(),
      })).filter((option) => option.label)
    : [];
}

class HomeworkQuestionBankService {
  async list(tenantId, { search, questionType, category, page = 1, limit = 50 } = {}) {
    const offset = (toInt(page, 1) - 1) * toInt(limit, 50);
    const conditions = ['b.tenant_id = $1'];
    const params = [tenantId];
    let idx = 2;

    if (search) {
      conditions.push(`(b.question_text ILIKE $${idx} OR b.category ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (questionType) {
      conditions.push(`b.question_type = $${idx}`);
      params.push(questionType);
      idx++;
    }
    if (category) {
      conditions.push(`b.category = $${idx}`);
      params.push(category);
      idx++;
    }

    const where = conditions.join(' AND ');
    const [countResult, rowsResult, categoriesResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM homework_question_bank b WHERE ${where}`, params),
      pool.query(
        `SELECT b.*,
                (SELECT COUNT(*) FROM homework_assignment_questions q WHERE q.bank_question_id = b.id) AS usage_count
         FROM homework_question_bank b
         WHERE ${where}
         ORDER BY b.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, toInt(limit, 50), offset]
      ),
      pool.query(
        `SELECT DISTINCT category FROM homework_question_bank WHERE tenant_id = $1 AND category IS NOT NULL AND category <> '' ORDER BY category`,
        [tenantId]
      ),
    ]);

    return {
      total: parseInt(countResult.rows[0]?.count || '0', 10),
      page: toInt(page, 1),
      limit: toInt(limit, 50),
      items: rowsResult.rows.map(camelItem),
      categories: categoriesResult.rows.map((row) => row.category),
    };
  }

  async create(tenantId, user, data) {
    const questionType = String(data.questionType || 'multiple_choice_4');
    const options = normalizeOptions(data.options);
    const questionText = String(data.questionText || '').trim();
    if (!questionText) {
      throw Object.assign(new Error('Vui lòng nhập nội dung câu hỏi'), { status: 400 });
    }
    const result = await pool.query(
      `INSERT INTO homework_question_bank
       (tenant_id, question_type, question_text, help_text, score, correct_answer, options, category, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        tenantId,
        questionType,
        questionText,
        data.helpText || null,
        Number(data.score || 1),
        data.correctAnswer || null,
        JSON.stringify(options),
        data.category || null,
        user?.id || null,
      ]
    );
    return camelItem(result.rows[0]);
  }

  async update(tenantId, id, data) {
    const questionType = String(data.questionType || 'multiple_choice_4');
    const options = normalizeOptions(data.options);
    const questionText = String(data.questionText || '').trim();
    if (!questionText) {
      throw Object.assign(new Error('Vui lòng nhập nội dung câu hỏi'), { status: 400 });
    }
    const result = await pool.query(
      `UPDATE homework_question_bank
       SET question_type=$1, question_text=$2, help_text=$3, score=$4, correct_answer=$5, options=$6, category=$7, updated_at=NOW()
       WHERE id=$8 AND tenant_id=$9
       RETURNING *`,
      [
        questionType,
        questionText,
        data.helpText || null,
        Number(data.score || 1),
        data.correctAnswer || null,
        JSON.stringify(options),
        data.category || null,
        id,
        tenantId,
      ]
    );
    if (!result.rows.length) return null;
    return camelItem(result.rows[0]);
  }

  async delete(tenantId, id) {
    await pool.query('DELETE FROM homework_question_bank WHERE id=$1 AND tenant_id=$2', [id, tenantId]);
  }

  // Save every question of a homework assignment (as typed in the form) into the bank in one go.
  async bulkCreate(tenantId, user, questions = [], category = null) {
    const inserted = [];
    for (const question of questions) {
      const questionText = String(question.questionText || question.question_text || '').trim();
      if (!questionText) continue;
      const item = await this.create(tenantId, user, {
        questionType: question.questionType || question.question_type,
        questionText,
        helpText: question.helpText || question.help_text,
        score: question.score,
        correctAnswer: question.correctAnswer || question.correct_answer,
        options: question.options,
        category,
      });
      inserted.push(item);
    }
    return inserted;
  }
}

module.exports = new HomeworkQuestionBankService();