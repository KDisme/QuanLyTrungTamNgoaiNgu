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
    irtA: row.irt_a != null ? Number(row.irt_a) : null,
    irtB: row.irt_b != null ? Number(row.irt_b) : null,
    irtC: row.irt_c != null ? Number(row.irt_c) : null,
    irtCalibratedAt: row.irt_calibrated_at,
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
    // IRT: nếu không truyền thì giữ giá trị "trung tính" đúng như default trong DB —
    // tránh trường hợp form cũ (chưa có field IRT) gửi undefined làm mất giá trị mặc định.
    const irtA = data.irtA != null ? Number(data.irtA) : 1.0;
    const irtB = data.irtB != null ? Number(data.irtB) : 0.0;
    const irtC = data.irtC != null ? Number(data.irtC) : 0.25;

    const result = await pool.query(
      `INSERT INTO homework_question_bank
       (tenant_id, question_type, question_text, help_text, score, correct_answer, options, category, created_by, irt_a, irt_b, irt_c)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
        irtA,
        irtB,
        irtC,
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

    // Chỉ cập nhật irt_calibrated_at khi có ít nhất 1 tham số IRT được gửi lên —
    // đây là cách đánh dấu "câu này vừa được hiệu chỉnh", phân biệt với việc
    // sửa các trường khác (question_text, category...) không liên quan đến IRT.
    const hasIrtUpdate = data.irtA != null || data.irtB != null || data.irtC != null;
    const irtA = data.irtA != null ? Number(data.irtA) : 1.0;
    const irtB = data.irtB != null ? Number(data.irtB) : 0.0;
    const irtC = data.irtC != null ? Number(data.irtC) : 0.25;

    const result = await pool.query(
      `UPDATE homework_question_bank
       SET question_type=$1, question_text=$2, help_text=$3, score=$4, correct_answer=$5, options=$6, category=$7,
           irt_a=$8, irt_b=$9, irt_c=$10,
           irt_calibrated_at = CASE WHEN $11 THEN NOW() ELSE irt_calibrated_at END,
           updated_at=NOW()
       WHERE id=$12 AND tenant_id=$13
       RETURNING *`,
      [
        questionType,
        questionText,
        data.helpText || null,
        Number(data.score || 1),
        data.correctAnswer || null,
        JSON.stringify(options),
        data.category || null,
        irtA,
        irtB,
        irtC,
        hasIrtUpdate,
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

  async getUsageDetails(tenantId, bankQuestionId) {
    const result = await pool.query(
      `SELECT ha.id AS assignment_id, ha.title AS assignment_title, ha.status AS assignment_status,
              ha.created_at AS assignment_created_at,
              u.full_name AS creator_name,
              (SELECT string_agg(c.name, ', ' ORDER BY c.name)
               FROM homework_assignment_classes hac
               JOIN classes c ON c.id = hac.class_id
               WHERE hac.assignment_id = ha.id AND hac.tenant_id = ha.tenant_id) AS class_names
       FROM homework_assignment_questions haq
       JOIN homework_assignments ha ON ha.id = haq.assignment_id AND ha.tenant_id = haq.tenant_id
       LEFT JOIN users u ON u.id = ha.created_by
       WHERE haq.bank_question_id = $1 AND haq.tenant_id = $2
       ORDER BY ha.created_at DESC`,
      [bankQuestionId, tenantId]
    );
    return result.rows.map((row) => ({
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignment_title,
      assignmentStatus: row.assignment_status,
      createdAt: row.assignment_created_at,
      creatorName: row.creator_name,
      classNames: row.class_names,
    }));
  }
}

module.exports = new HomeworkQuestionBankService();