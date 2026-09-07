const pool = require('../config/database');
const { getFormat, getBlueprintRule, EXAM_FORMATS } = require('../config/exam.config');
const activityLogService = require('./activityLog.service');
const aiGradingService = require('./aiGrading.service');
const notificationService = require('./notification.service');
const { calculateWritingScore, calculateSpeakingScore, calculateVstepOverall } = require('./examScoring');

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}
function toJson(value, fallback = {}) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}
function roundToHalf(value) {
  const n = Number(value || 0);
  return Math.round(n * 2) / 2;
}

function slug(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
function pad2(value) {
  return String(Math.max(1, Number(value) || 1)).padStart(2, '0');
}
function buildAutoGroupKey(data, rule = {}) {
  const base = `${slug(data.formatCode || data.format_code)}_${slug(data.skill)}_${slug(data.part)}`;
  const seq = toInt(data.sequenceNo ?? data.sequence_no, 1);
  const perGroup = rule.questionsPerGroup || rule.qPerGroup || 0;
  const groupNo = perGroup > 0 ? Math.ceil(seq / perGroup) : 1;

  // VSTEP gom dữ liệu chung theo từng Part: Listening 1 audio/Part, Reading 1 bài đọc/Part, Speaking 1 đề/Part.
  if ((data.formatCode || data.format_code) === 'VSTEP_4_SKILLS') return base;

  // TOEIC Part 3/4/6/7 cần nhiều nhóm; hệ thống tự tính nhóm theo số thứ tự câu.
  if (perGroup > 0) return `${base}_GROUP_${pad2(groupNo)}`;
  return base;
}
function ruleUsesGroup(rule = {}, data = {}) {
  return !!(data.groupKey || data.group_key || data.group || rule.audioScope === 'part' || rule.readingScope === 'part' || rule.richTextGroup || rule.splitScreen || rule.questionsPerGroup || rule.qPerGroup || rule.inputMode === 'situation_solutions' || rule.inputMode === 'mindmap_followup' || rule.responseMode === 'continuous_recording');
}
function isGroupLevelAudio(rule = {}) {
  return rule.audioScope === 'part' || rule.partAudio || rule.questionsPerGroup || rule.qPerGroup || rule.inputMode === 'group_audio';
}
function getGroupTextFromPayload(group = {}, fallback = null) {
  if (group.content) return group.content;
  if (Array.isArray(group.passages) && group.passages.length) {
    const first = group.passages[0];
    if (typeof first === 'string') return first;
    if (first?.content) return first.content;
    if (first?.text) return first.text;
  }
  return fallback || null;
}
function camelQuestion(row) {
  return row ? {
    ...row,
    formatCode: row.format_code,
    questionType: row.question_type,
    groupKey: row.group_key,
    sequenceNo: row.sequence_no,
    questionText: row.question_text,
    questionGroup: row.question_group,
    imageUrl: row.image_url,
    audioUrl: row.audio_url,
    displayConfig: row.display_config || {},
    prepSeconds: row.prep_seconds,
    responseSeconds: row.response_seconds,
    sectionSeconds: row.section_seconds,
    minWords: row.min_words,
    maxWords: row.max_words,
  } : row;
}

class ExamService {
  getFormats() {
    return Object.values(EXAM_FORMATS);
  }

  async listQuestionGroups(tenantId, { formatCode, skill, part, search, page = 1, limit = 50 }) {
    const offset = (toInt(page, 1) - 1) * toInt(limit, 50);
    const conditions = ['tenant_id=$1'];
    const params = [tenantId];
    let idx = 2;
    if (formatCode) { conditions.push(`format_code=$${idx++}`); params.push(formatCode); }
    if (skill) { conditions.push(`skill=$${idx++}`); params.push(skill); }
    if (part) { conditions.push(`part=$${idx++}`); params.push(part); }
    if (search) { conditions.push(`(title ILIKE $${idx} OR content ILIKE $${idx} OR group_key ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
    const where = conditions.join(' AND ');
    const result = await pool.query(`SELECT * FROM exam_question_groups WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, toInt(limit, 50), offset]);
    return { groups: result.rows };
  }

  async upsertQuestionGroup(client, tenantId, userId, data) {
    const group = data.group || {};
    const fmt = getFormat(data.formatCode || group.formatCode || 'TOEIC_LR');
    const rule = getBlueprintRule(fmt.code, data.skill || group.skill, data.part || group.part) || {};
    if (!ruleUsesGroup(rule, data)) return null;
    const groupKey = data.groupKey || data.group_key || group.groupKey || group.group_key || buildAutoGroupKey({ ...data, formatCode: fmt.code }, rule);
    const content = getGroupTextFromPayload(group, data.questionGroup);
    const result = await client.query(
      `INSERT INTO exam_question_groups
       (tenant_id,format_code,exam_type,skill,part,title,group_key,content,passages,media,display_config,metadata,order_number,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14)
       ON CONFLICT (tenant_id, group_key)
       DO UPDATE SET
         title=COALESCE(NULLIF(EXCLUDED.title,''), exam_question_groups.title),
         content=COALESCE(NULLIF(EXCLUDED.content,''), exam_question_groups.content),
         passages=CASE WHEN EXCLUDED.passages <> '[]'::jsonb THEN EXCLUDED.passages ELSE exam_question_groups.passages END,
         media=CASE WHEN EXCLUDED.media <> '{}'::jsonb THEN exam_question_groups.media || EXCLUDED.media ELSE exam_question_groups.media END,
         display_config=CASE WHEN EXCLUDED.display_config <> '{}'::jsonb THEN exam_question_groups.display_config || EXCLUDED.display_config ELSE exam_question_groups.display_config END,
         metadata=CASE WHEN EXCLUDED.metadata <> '{}'::jsonb THEN exam_question_groups.metadata || EXCLUDED.metadata ELSE exam_question_groups.metadata END,
         updated_at=NOW()
       RETURNING *`,
      [tenantId, fmt.code, data.examType || fmt.examType, data.skill || group.skill,
        data.part || group.part, group.title || data.topic || null, groupKey, content,
        JSON.stringify(group.passages || []), JSON.stringify(group.media || {}), JSON.stringify(group.displayConfig || {}),
        JSON.stringify(group.metadata || {}), group.orderNumber || null, userId]
    );
    return result.rows[0];
  }

  _normalizeQuestionPayload(data) {
    const formatCode = data.formatCode || data.format_code || 'TOEIC_LR';
    const fmt = getFormat(formatCode);
    const skill = data.skill || 'Reading';
    const part = data.part || 'Part 5';
    const rule = getBlueprintRule(formatCode, skill, part) || {};
    const media = { ...(toJson(data.media, {})) };
    if (data.imageUrl) media.imageUrl = data.imageUrl;
    if (data.audioUrl) media.audioUrl = data.audioUrl;
    const displayConfig = {
      showQuestionText: rule.showQuestionText ?? true,
      showOptionText: rule.showOptionText ?? true,
      splitScreen: !!rule.splitScreen,
      transitionSeconds: rule.transitionSeconds || 0,
      ...(toJson(data.displayConfig, {})),
    };
    const labels = rule.options || (skill === 'Listening' && part === 'Part 2' ? ['A','B','C'] : ['A','B','C','D']);
    const options = Array.isArray(data.options) ? data.options.filter(o => labels.includes(o.optionLabel || o.option_label)) : [];
    return {
      ...data,
      examType: data.examType || data.exam_type || fmt.examType || 'TOEIC',
      formatCode: fmt.code,
      skill,
      part,
      questionType: data.questionType || data.question_type || rule.questionType || 'single_choice',
      groupKey: data.groupKey || data.group_key || null,
      sequenceNo: toInt(data.sequenceNo ?? data.sequence_no, null),
      questionText: data.questionText ?? data.question_text ?? '',
      questionGroup: data.questionGroup ?? data.question_group ?? null,
      imageUrl: data.imageUrl || media.imageUrl || null,
      audioUrl: data.audioUrl || media.audioUrl || null,
      media,
      displayConfig,
      metadata: toJson(data.metadata, {}),
      prepSeconds: toInt(data.prepSeconds ?? data.prep_seconds, rule.prepSeconds ?? null),
      responseSeconds: toInt(data.responseSeconds ?? data.response_seconds, rule.responseSeconds ?? null),
      sectionSeconds: toInt(data.sectionSeconds ?? data.section_seconds, rule.sectionSeconds ?? null),
      minWords: toInt(data.minWords ?? data.min_words, rule.minWords ?? null),
      maxWords: toInt(data.maxWords ?? data.max_words, rule.maxWords ?? null),
      difficulty: data.difficulty || 'medium',
      score: Number(data.score || rule.score || 1),
      status: data.status || 'active',
      options,
    };
  }

  _validateQuestion(data) {
    const rule = getBlueprintRule(data.formatCode, data.skill, data.part);
    if (!data.skill || !data.part) throw Object.assign(new Error('Thiếu kỹ năng hoặc Part/Question'), { status: 400 });
    const groupMedia = data.group?.media || {};
    if (rule?.requiresAudio && !isGroupLevelAudio(rule) && !data.audioUrl && !data.media?.audioUrl && !groupMedia.audioUrl && !groupMedia.audio) throw Object.assign(new Error(`${data.part} bắt buộc có audio`), { status: 400 });
    if (rule?.requiresImage && !data.imageUrl && !data.media?.imageUrl) throw Object.assign(new Error(`${data.part} bắt buộc có hình ảnh`), { status: 400 });
    const correctCount = (data.options || []).filter(o => !!o.isCorrect).length;
    if (['single_choice', 'audio_choice', 'group_choice'].includes(data.questionType) && correctCount !== 1) {
      throw Object.assign(new Error('Câu trắc nghiệm phải có đúng 1 đáp án đúng'), { status: 400 });
    }
    const maxOptions = rule?.options?.length;
    if (maxOptions && (data.options || []).length > maxOptions) throw Object.assign(new Error(`${data.part} chỉ cho phép ${rule.options.join(', ')}`), { status: 400 });
  }

  async listQuestions(tenantId, { search, examType, formatCode, questionType, skill, part, difficulty, status, groupKey, page = 1, limit = 20 }) {
    const offset = (toInt(page, 1) - 1) * toInt(limit, 20);
    const conditions = ['q.tenant_id = $1'];
    const params = [tenantId];
    let idx = 2;
    if (search) { conditions.push(`(q.question_text ILIKE $${idx} OR q.topic ILIKE $${idx} OR q.part ILIKE $${idx} OR q.group_key ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
    if (examType) { conditions.push(`q.exam_type = $${idx}`); params.push(examType); idx++; }
    if (formatCode) { conditions.push(`q.format_code = $${idx}`); params.push(formatCode); idx++; }
    if (questionType) { conditions.push(`q.question_type = $${idx}`); params.push(questionType); idx++; }
    if (skill) { conditions.push(`q.skill = $${idx}`); params.push(skill); idx++; }
    if (part) { conditions.push(`q.part = $${idx}`); params.push(part); idx++; }
    if (difficulty) { conditions.push(`q.difficulty = $${idx}`); params.push(difficulty); idx++; }
    if (status) { conditions.push(`q.status = $${idx}`); params.push(status); idx++; }
    if (groupKey) { conditions.push(`q.group_key = $${idx}`); params.push(groupKey); idx++; }
    const where = conditions.join(' AND ');
    const [count, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM exam_questions q WHERE ${where}`, params),
      pool.query(
        `SELECT q.*, COUNT(o.id) AS option_count
         FROM exam_questions q
         LEFT JOIN exam_question_options o ON o.question_id = q.id
         WHERE ${where}
         GROUP BY q.id
         ORDER BY q.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, toInt(limit, 20), offset]
      )
    ]);
    return { total: parseInt(count.rows[0].count, 10), page: toInt(page, 1), limit: toInt(limit, 20), questions: result.rows };
  }

  async getQuestion(tenantId, id) {
    const q = await pool.query('SELECT * FROM exam_questions WHERE id=$1 AND tenant_id=$2', [id, tenantId]);
    if (!q.rows.length) return null;
    const options = await pool.query('SELECT * FROM exam_question_options WHERE question_id=$1 ORDER BY option_label', [id]);
    const group = q.rows[0].group_key ? await pool.query('SELECT * FROM exam_question_groups WHERE tenant_id=$1 AND group_key=$2', [tenantId, q.rows[0].group_key]) : { rows: [] };
    return { ...camelQuestion(q.rows[0]), options: options.rows, group: group.rows[0] || null };
  }

  async createQuestion(tenantId, userId, raw) {
    const data = this._normalizeQuestionPayload(raw);
    this._validateQuestion(data);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const group = await this.upsertQuestionGroup(client, tenantId, userId, data);
      if (group?.group_key) data.groupKey = group.group_key;
      const result = await client.query(
        `INSERT INTO exam_questions
        (tenant_id, exam_type, format_code, skill, part, question_type, group_key, sequence_no, question_group, question_text,
         image_url, audio_url, media, display_config, metadata, prep_seconds, response_seconds, section_seconds, min_words, max_words,
         difficulty, topic, explanation, score, status, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
        RETURNING *`,
        [tenantId, data.examType, data.formatCode, data.skill, data.part, data.questionType, data.groupKey, data.sequenceNo,
          data.questionGroup, data.questionText, data.imageUrl, data.audioUrl, JSON.stringify(data.media), JSON.stringify(data.displayConfig), JSON.stringify(data.metadata),
          data.prepSeconds, data.responseSeconds, data.sectionSeconds, data.minWords, data.maxWords,
          data.difficulty, data.topic || null, data.explanation || null, data.score, data.status, userId]
      );
      const question = result.rows[0];
      await this._replaceOptions(client, question.id, data.options);
      await client.query('COMMIT');
      return this.getQuestion(tenantId, question.id);
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); }
  }

  async updateQuestion(tenantId, id, raw) {
    const data = this._normalizeQuestionPayload(raw);
    this._validateQuestion(data);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const group = await this.upsertQuestionGroup(client, tenantId, raw.updatedBy, data);
      if (group?.group_key) data.groupKey = group.group_key;
      const result = await client.query(
        `UPDATE exam_questions SET exam_type=$1, format_code=$2, skill=$3, part=$4, question_type=$5, group_key=$6, sequence_no=$7,
         question_group=$8, question_text=$9, image_url=$10, audio_url=$11, media=$12::jsonb, display_config=$13::jsonb, metadata=$14::jsonb,
         prep_seconds=$15, response_seconds=$16, section_seconds=$17, min_words=$18, max_words=$19, difficulty=$20, topic=$21,
         explanation=$22, score=$23, status=$24, updated_at=NOW()
         WHERE id=$25 AND tenant_id=$26 RETURNING *`,
        [data.examType, data.formatCode, data.skill, data.part, data.questionType, data.groupKey, data.sequenceNo,
          data.questionGroup, data.questionText, data.imageUrl, data.audioUrl, JSON.stringify(data.media), JSON.stringify(data.displayConfig), JSON.stringify(data.metadata),
          data.prepSeconds, data.responseSeconds, data.sectionSeconds, data.minWords, data.maxWords, data.difficulty, data.topic || null,
          data.explanation || null, data.score, data.status, id, tenantId]
      );
      if (!result.rows.length) { await client.query('ROLLBACK'); return null; }
      await this._replaceOptions(client, id, data.options);
      await client.query('COMMIT');
      return this.getQuestion(tenantId, id);
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); }
  }

  async _replaceOptions(client, questionId, options = []) {
    await client.query('DELETE FROM exam_question_options WHERE question_id=$1', [questionId]);
    for (const opt of options) {
      const label = opt.optionLabel || opt.option_label;
      if (!label) continue;
      const text = opt.optionText ?? opt.option_text ?? String(label);
      await client.query(
        'INSERT INTO exam_question_options (question_id, option_label, option_text, is_correct) VALUES ($1,$2,$3,$4)',
        [questionId, label, text || String(label), !!opt.isCorrect]
      );
    }
  }

  async deleteQuestion(tenantId, id) { await pool.query('DELETE FROM exam_questions WHERE id=$1 AND tenant_id=$2', [id, tenantId]); }

  async listExamSets(tenantId, { search, examType, formatCode, status, page = 1, limit = 20 }) {
    const offset = (toInt(page, 1) - 1) * toInt(limit, 20);
    const conditions = ['e.tenant_id=$1'];
    const params = [tenantId]; let idx = 2;
    if (search) { conditions.push(`(e.title ILIKE $${idx} OR e.description ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
    if (examType) { conditions.push(`e.exam_type=$${idx}`); params.push(examType); idx++; }
    if (formatCode) { conditions.push(`e.format_code=$${idx}`); params.push(formatCode); idx++; }
    if (status) { conditions.push(`e.status=$${idx}`); params.push(status); idx++; }
    const where = conditions.join(' AND ');
    const [count, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM exam_sets e WHERE ${where}`, params),
      pool.query(`SELECT e.*, COUNT(esq.id) AS question_count FROM exam_sets e LEFT JOIN exam_set_questions esq ON esq.exam_set_id=e.id WHERE ${where} GROUP BY e.id ORDER BY e.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, toInt(limit, 20), offset])
    ]);
    return { total: parseInt(count.rows[0].count, 10), page: toInt(page, 1), limit: toInt(limit, 20), examSets: result.rows };
  }

  async getExamSet(tenantId, id) {
    const e = await pool.query('SELECT * FROM exam_sets WHERE id=$1 AND tenant_id=$2', [id, tenantId]);
    if (!e.rows.length) return null;
    const qs = await pool.query(
      `SELECT esq.order_number, esq.score AS set_score, esq.section, esq.part AS set_part, esq.group_key AS set_group_key, q.*,
        COALESCE(json_agg(json_build_object('id', o.id, 'optionLabel', o.option_label, 'optionText', o.option_text, 'isCorrect', o.is_correct) ORDER BY o.option_label) FILTER (WHERE o.id IS NOT NULL), '[]') AS options
       FROM exam_set_questions esq
       JOIN exam_questions q ON q.id=esq.question_id
       LEFT JOIN exam_question_options o ON o.question_id=q.id
       WHERE esq.exam_set_id=$1 AND esq.tenant_id=$2
       GROUP BY esq.id, q.id
       ORDER BY esq.order_number`, [id, tenantId]);
    return { ...e.rows[0], questions: qs.rows };
  }

  async createExamSet(tenantId, userId, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const fmt = getFormat(data.formatCode || data.format_code || 'TOEIC_LR');
      const settings = { ...(fmt.settings || {}), ...(data.settings || {}) };
      const result = await client.query(
        `INSERT INTO exam_sets (tenant_id,title,exam_type,format_code,description,duration_minutes,total_score,status,blueprint,settings,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11) RETURNING *`,
        [tenantId, data.title, fmt.examType, fmt.code, data.description || null, data.durationMinutes || fmt.durationMinutes, data.totalScore || 100,
          data.status || 'draft', JSON.stringify(fmt.blueprint), JSON.stringify(settings), userId]
      );
      const examSet = result.rows[0];
      if (Array.isArray(data.questionIds) && data.questionIds.length) await this._replaceExamSetQuestions(client, tenantId, examSet.id, data.questionIds);
      await client.query('COMMIT');
      return this.getExamSet(tenantId, examSet.id);
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); }
  }

  async updateExamSet(tenantId, id, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // #10: Block editing if the exam set already has active student attempts
      const hasAttempts = await client.query(
        `SELECT 1 FROM student_exam_attempts sea
         JOIN mock_exam_students mes ON mes.id=sea.mock_exam_student_id
         JOIN mock_exams m ON m.id=mes.mock_exam_id
         WHERE m.exam_set_id=$1 AND sea.tenant_id=$2 LIMIT 1`,
        [id, tenantId]
      );
      if (hasAttempts.rows.length) {
        await client.query('ROLLBACK');
        throw Object.assign(new Error('Bộ đề đang có học viên làm bài hoặc đã hoàn thành, không thể chỉnh sửa để đảm bảo tính toàn vẹn dữ liệu'), { status: 400 });
      }
      const fmt = getFormat(data.formatCode || data.format_code || 'TOEIC_LR');
      const settings = { ...(fmt.settings || {}), ...(data.settings || {}) };
      const result = await client.query(
        `UPDATE exam_sets SET title=$1, exam_type=$2, format_code=$3, description=$4, duration_minutes=$5, total_score=$6, status=$7, blueprint=$8::jsonb, settings=$9::jsonb, updated_at=NOW()
         WHERE id=$10 AND tenant_id=$11 RETURNING *`,
        [data.title, fmt.examType, fmt.code, data.description || null, data.durationMinutes || fmt.durationMinutes, data.totalScore || 100,
          data.status || 'draft', JSON.stringify(data.blueprint || fmt.blueprint), JSON.stringify(settings), id, tenantId]
      );
      if (!result.rows.length) { await client.query('ROLLBACK'); return null; }
      if (Array.isArray(data.questionIds)) await this._replaceExamSetQuestions(client, tenantId, id, data.questionIds);
      await client.query('COMMIT');
      return this.getExamSet(tenantId, id);
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); }
  }

  async generateExamSet(tenantId, userId, data) {
    const fmt = getFormat(data.formatCode || data.format_code || 'TOEIC_LR');
    const settings = { ...(fmt.settings || {}), ...(data.settings || {}) };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO exam_sets (tenant_id,title,exam_type,format_code,description,duration_minutes,total_score,status,blueprint,settings,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11) RETURNING *`,
        [tenantId, data.title, fmt.examType, fmt.code, data.description || fmt.label, data.durationMinutes || fmt.durationMinutes, data.totalScore || 100,
          data.status || 'draft', JSON.stringify(fmt.blueprint), JSON.stringify(settings), userId]
      );
      const examSet = result.rows[0];
      const orderedIds = [];
      const shortages = [];
      // #9: Pick whole question groups to preserve audio/passage coherence
      for (const rule of fmt.blueprint) {
        const questionsPerGroup = rule.questionsPerGroup || rule.questionsPerPart || rule.qPerGroup || 0;
        if (questionsPerGroup > 1) {
          // Group-based selection: pick N complete groups
          const groupCount = Math.ceil(Number(rule.count || 0) / questionsPerGroup);
          const groups = await client.query(
            `SELECT group_key FROM (
               SELECT DISTINCT group_key FROM exam_questions
               WHERE tenant_id=$1 AND format_code=$2 AND skill=$3 AND part=$4
                 AND status='active' AND group_key IS NOT NULL
             ) g
             ORDER BY RANDOM() LIMIT $5`,
            [tenantId, fmt.code, rule.skill, rule.part, groupCount]
          );
          const groupKeys = groups.rows.map(r => r.group_key);
          const pickedCount = groupKeys.length * questionsPerGroup;
          if (pickedCount < Number(rule.count || 0)) {
            shortages.push(`${rule.skill} - ${rule.part}: cần ${groupCount} nhóm (${rule.count} câu), hiện có ${groups.rows.length} nhóm`);
          }
          if (groupKeys.length) {
            const qs = await client.query(
              `SELECT id FROM exam_questions
               WHERE tenant_id=$1 AND group_key = ANY($2::text[]) AND status='active'
               ORDER BY sequence_no ASC NULLS LAST, id ASC`,
              [tenantId, groupKeys]
            );
            orderedIds.push(...qs.rows.map(r => r.id));
          }
        } else {
          // Single-question selection (Part 5, Part 2, etc.)
          const qs = await client.query(
            `SELECT id FROM exam_questions
             WHERE tenant_id=$1 AND format_code=$2 AND skill=$3 AND part=$4 AND status='active'
             ORDER BY RANDOM() LIMIT $5`,
            [tenantId, fmt.code, rule.skill, rule.part, rule.count]
          );
          if (qs.rows.length < Number(rule.count || 0)) {
            shortages.push(`${rule.skill} - ${rule.part}: cần ${rule.count}, hiện có ${qs.rows.length}`);
          }
          orderedIds.push(...qs.rows.map(r => r.id));
        }
      }
      if (shortages.length && data.allowPartial !== true) {
        throw Object.assign(new Error(`Ngân hàng câu hỏi chưa đủ để tạo bộ đề. ${shortages.join('; ')}`), { status: 400, shortages });
      }
      if (orderedIds.length) await this._replaceExamSetQuestions(client, tenantId, examSet.id, orderedIds);
      await client.query('COMMIT');
      return this.getExamSet(tenantId, examSet.id);
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); }
  }

  async _replaceExamSetQuestions(client, tenantId, examSetId, questionIds) {
    await client.query('DELETE FROM exam_set_questions WHERE exam_set_id=$1 AND tenant_id=$2', [examSetId, tenantId]);
    let order = 1;
    for (const questionId of questionIds.map(Number).filter(Boolean)) {
      const q = await client.query('SELECT skill, part, group_key, score FROM exam_questions WHERE id=$1 AND tenant_id=$2', [questionId, tenantId]);
      if (!q.rows.length) continue;
      await client.query(
        `INSERT INTO exam_set_questions (tenant_id, exam_set_id, question_id, order_number, score, section, part, group_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [tenantId, examSetId, questionId, order++, q.rows[0].score || 1, q.rows[0].skill, q.rows[0].part, q.rows[0].group_key]
      );
    }
  }

  async deleteExamSet(tenantId, id) {
    // Kiểm tra bộ đề có đang được dùng trong kỳ thi không trước khi xóa
    const inUse = await pool.query(
      `SELECT COUNT(*) FROM mock_exams WHERE exam_set_id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    if (Number(inUse.rows[0]?.count || 0) > 0) {
      throw Object.assign(
        new Error('Bộ đề đang được sử dụng trong kỳ thi. Vui lòng xoá kỳ thi liên quan trước.'),
        { status: 400 }
      );
    }
    await pool.query('DELETE FROM exam_sets WHERE id=$1 AND tenant_id=$2', [id, tenantId]);
  }

  async listMockExams(tenantId, { search, status, page = 1, limit = 20 }, user = null) {
    const offset = (toInt(page, 1) - 1) * toInt(limit, 20);
    const conditions = ['m.tenant_id=$1']; const params = [tenantId]; let idx = 2;
    if (search) { conditions.push(`m.title ILIKE $${idx}`); params.push(`%${search}%`); idx++; }
    if (status) { conditions.push(`m.status=$${idx}`); params.push(status); idx++; }
    const roles = user?.roles || [];
    let studentParamRef = null;
    if (roles.includes('student') && !roles.includes('admin') && !roles.includes('staff')) {
      studentParamRef = `$${idx}`;
      conditions.push(`EXISTS (SELECT 1 FROM mock_exam_students mes_scope WHERE mes_scope.mock_exam_id=m.id AND mes_scope.tenant_id=m.tenant_id AND mes_scope.student_id=${studentParamRef})`);
      params.push(user.id); idx++;
    } else if (roles.includes('teacher') && !roles.includes('admin') && !roles.includes('staff')) {
      conditions.push(`EXISTS (SELECT 1 FROM class_teachers ct_scope WHERE ct_scope.class_id=m.class_id AND ct_scope.tenant_id=m.tenant_id AND ct_scope.teacher_id=$${idx})`);
      params.push(user.id); idx++;
    }
    const where = conditions.join(' AND ');
    const studentFields = studentParamRef
      ? `, my_ms.id AS mock_exam_student_id, my_ms.status AS my_status, my_ms.submitted_at AS my_submitted_at,
           my_ms.grading_status AS my_grading_status, my_ms.published_at AS my_published_at,
           CASE WHEN (my_ms.published_at IS NOT NULL OR my_ms.grading_status='not_required') AND m.show_result=TRUE THEN my_ms.objective_score ELSE NULL END AS my_objective_score,
           CASE WHEN (my_ms.published_at IS NOT NULL OR my_ms.grading_status='not_required') AND m.show_result=TRUE THEN my_ms.total_score ELSE NULL END AS my_total_score,
           CASE WHEN (my_ms.published_at IS NOT NULL OR my_ms.grading_status='not_required') AND m.show_result=TRUE THEN my_ms.feedback ELSE NULL END AS my_feedback`
      : '';
    const studentJoin = studentParamRef
      ? `LEFT JOIN mock_exam_students my_ms ON my_ms.mock_exam_id=m.id AND my_ms.tenant_id=m.tenant_id AND my_ms.student_id=${studentParamRef}`
      : '';
    const studentGroupBy = studentParamRef ? ',my_ms.id' : '';
    const [count, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM mock_exams m WHERE ${where}`, params),
      pool.query(`SELECT m.*, e.title AS exam_set_title, e.exam_type, e.format_code, c.name AS class_name,
       COUNT(ms.id) AS student_count, COUNT(ms.id) FILTER (WHERE ms.status IN ('submitted','graded')) AS submitted_count, ROUND(AVG(ms.total_score),2) AS avg_score
       ${studentFields}
       FROM mock_exams m JOIN exam_sets e ON e.id=m.exam_set_id LEFT JOIN classes c ON c.id=m.class_id LEFT JOIN mock_exam_students ms ON ms.mock_exam_id=m.id
       ${studentJoin}
       WHERE ${where} GROUP BY m.id,e.id,c.id${studentGroupBy} ORDER BY m.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, toInt(limit, 20), offset])
    ]);
    return { total: parseInt(count.rows[0].count, 10), page: toInt(page, 1), limit: toInt(limit, 20), mockExams: result.rows };
  }

  async getMockExam(tenantId, id, user = null) {
    const m = await pool.query(`SELECT m.*, e.title AS exam_set_title, e.exam_type, e.format_code, e.settings AS exam_set_settings, c.name AS class_name
      FROM mock_exams m
      JOIN exam_sets e ON e.id=m.exam_set_id
      LEFT JOIN classes c ON c.id=m.class_id
      WHERE m.id=$1 AND m.tenant_id=$2`, [id, tenantId]);
    if (!m.rows.length) return null;

    const roles = user?.roles || [];
    const isAdminStaff = roles.includes('admin') || roles.includes('staff');
    const isTeacherOnly = !isAdminStaff && roles.includes('teacher');
    const isStudentOnly = !isAdminStaff && roles.includes('student');
    const canReviewGrades = roles.includes('admin') || roles.includes('teacher');

    if (isTeacherOnly) {
      const allowed = await pool.query(
        `SELECT 1 FROM class_teachers WHERE tenant_id=$1 AND class_id=$2 AND teacher_id=$3 LIMIT 1`,
        [tenantId, m.rows[0].class_id, user.id]
      );
      if (!allowed.rows.length) return null;
    }
    if (isStudentOnly) {
      const allowed = await pool.query(
        `SELECT 1 FROM mock_exam_students WHERE tenant_id=$1 AND mock_exam_id=$2 AND student_id=$3 LIMIT 1`,
        [tenantId, id, user.id]
      );
      if (!allowed.rows.length) return null;
    }

    const studentWhere = isAdminStaff || roles.includes('teacher')
      ? 'ms.mock_exam_id=$1 AND ms.tenant_id=$2'
      : 'ms.mock_exam_id=$1 AND ms.tenant_id=$2 AND ms.student_id=$3';
    const studentParams = isAdminStaff || roles.includes('teacher') ? [id, tenantId] : [id, tenantId, user?.id];
    const studentsResult = await pool.query(
      `SELECT ms.*, u.full_name, u.email,
        la.id AS latest_attempt_id, la.attempt_no AS latest_attempt_no, la.status AS latest_attempt_status,
        la.submitted_at AS latest_attempt_submitted_at, la.feedback AS latest_attempt_feedback
       FROM mock_exam_students ms
       JOIN users u ON u.id=ms.student_id
       LEFT JOIN LATERAL (
         SELECT * FROM student_exam_attempts sea
         WHERE sea.mock_exam_student_id=ms.id AND sea.tenant_id=ms.tenant_id
         ORDER BY sea.attempt_no DESC, sea.id DESC
         LIMIT 1
       ) la ON TRUE
       WHERE ${studentWhere}
       ORDER BY u.full_name`,
      studentParams
    );
    const students = studentsResult.rows;
    const showResultFlag = m.rows[0].show_result === true;

    const attemptIds = students.map(s => s.latest_attempt_id).filter(Boolean);
    if (attemptIds.length) {
      const answersResult = await pool.query(
        `SELECT a.*, q.skill, q.part, q.question_type, q.question_text, q.score AS max_score,
          q.sequence_no, q.image_url, q.audio_url,
          opt.option_label AS selected_option_label, opt.option_text AS selected_option_text
         FROM student_exam_answers a
         JOIN exam_questions q ON q.id=a.question_id
         LEFT JOIN exam_question_options opt ON opt.id=a.selected_option_id
         WHERE a.tenant_id=$1 AND a.attempt_id = ANY($2::int[])
         ORDER BY q.skill, q.part, q.sequence_no NULLS LAST, q.id`,
        [tenantId, attemptIds]
      );
      const byStudent = new Map();
      for (const ans of answersResult.rows) {
        const key = Number(ans.mock_exam_student_id);
        if (!byStudent.has(key)) byStudent.set(key, []);
        byStudent.get(key).push(ans);
      }
      for (const student of students) {
        student.answers = byStudent.get(Number(student.id)) || [];
      }

      const runsResult = await pool.query(
        `SELECT DISTINCT ON (r.attempt_id) r.*
         FROM exam_grading_runs r
         WHERE r.tenant_id=$1 AND r.attempt_id = ANY($2::int[])
         ORDER BY r.attempt_id, r.id DESC`,
        [tenantId, attemptIds]
      );
      const runsByAttempt = new Map(runsResult.rows.map((run) => [Number(run.attempt_id), run]));
      const runIds = runsResult.rows.map((run) => Number(run.id));
      const gradingRows = runIds.length ? await pool.query(
        `SELECT * FROM exam_answer_gradings WHERE tenant_id=$1 AND grading_run_id = ANY($2::bigint[]) ORDER BY id`,
        [tenantId, runIds]
      ) : { rows: [] };
      const gradingsByRun = new Map();
      gradingRows.rows.forEach((grading) => {
        const key = Number(grading.grading_run_id);
        if (!gradingsByRun.has(key)) gradingsByRun.set(key, []);
        gradingsByRun.get(key).push(grading);
      });
      for (const student of students) {
        const run = runsByAttempt.get(Number(student.latest_attempt_id));
        const canSeeRun = canReviewGrades || (isStudentOnly && showResultFlag && (student.published_at || student.grading_status === 'not_required'));
        student.ai_grading_run = canSeeRun ? (run || null) : null;
        student.ai_gradings = canSeeRun && run ? (gradingsByRun.get(Number(run.id)) || []) : [];
      }
    } else {
      for (const student of students) student.answers = [];
    }

    // #3: Strip is_correct/score from answers for students who cannot see results yet
    for (const student of students) {
      const attemptStatus = student.latest_attempt_status;
      const canShowGrading = canReviewGrades ||
        (isStudentOnly && showResultFlag && attemptStatus === 'graded' && (!!student.published_at || student.grading_status === 'not_required'));
      if (!canShowGrading) {
        student.answers = (student.answers || []).map(({ is_correct, score, graded_by, graded_at, ...rest }) => rest);
        if (isStudentOnly) {
          student.objective_score = null;
          student.manual_score = null;
          student.total_score = null;
          student.overall_score = null;
          student.skill_score_breakdown = {};
          student.feedback = null;
          student.latest_attempt_feedback = null;
        }
      }
    }

    const includeCorrect = canReviewGrades || (isStudentOnly && showResultFlag && students[0]?.latest_attempt_status === 'graded' && (!!students[0]?.published_at || students[0]?.grading_status === 'not_required'));
    const questions = await pool.query(
      `SELECT esq.order_number, esq.section, esq.part AS set_part, q.*, g.content AS group_content, g.media AS group_media, g.display_config AS group_display_config,
        COALESCE(json_agg(json_build_object('id', o.id, 'optionLabel', o.option_label, 'optionText', o.option_text, 'isCorrect', o.is_correct) ORDER BY o.option_label) FILTER (WHERE o.id IS NOT NULL), '[]') AS options
       FROM exam_set_questions esq
       JOIN exam_questions q ON q.id=esq.question_id
       LEFT JOIN exam_question_groups g ON g.tenant_id=q.tenant_id AND g.group_key=q.group_key
       LEFT JOIN exam_question_options o ON o.question_id=q.id
       WHERE esq.exam_set_id=$1 AND esq.tenant_id=$2
       GROUP BY esq.id, q.id, g.id
       ORDER BY esq.order_number`, [m.rows[0].exam_set_id, tenantId]
    );
    const normalizedQuestions = questions.rows.map(q => ({
      ...q,
      options: includeCorrect ? q.options.map(o => o) : q.options.map(({ isCorrect, is_correct, ...rest }) => rest),
    }));

    return { ...m.rows[0], students, questions: normalizedQuestions };
  }

  async createMockExam(tenantId, userId, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let durationMinutes = data.durationMinutes;
      if ((!durationMinutes || Number(durationMinutes) <= 0) && data.examSetId) {
        const es = await client.query('SELECT duration_minutes FROM exam_sets WHERE id=$1 AND tenant_id=$2', [data.examSetId, tenantId]);
        if (es.rows.length && es.rows[0].duration_minutes) durationMinutes = es.rows[0].duration_minutes;
      }
      durationMinutes = Number(durationMinutes || 120);
      // attemptLimit = 0 means unlimited
      const attemptLimit = Number(data.attemptLimit ?? 1);
      const result = await client.query(
        `INSERT INTO mock_exams (tenant_id,exam_set_id,class_id,title,start_time,end_time,duration_minutes,attempt_limit,show_result,status,note,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [tenantId, data.examSetId, data.classId || null, data.title, data.startTime || null, data.endTime || null, durationMinutes, attemptLimit, data.showResult ?? true, data.status || 'upcoming', data.note || null, userId]
      );
      await this._assignStudents(client, tenantId, result.rows[0].id, data.classId, data.studentIds || []);
      await client.query('COMMIT'); return this.getMockExam(tenantId, result.rows[0].id);
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  }

  async updateMockExam(tenantId, id, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let durationMinutes = data.durationMinutes;
      if ((!durationMinutes || Number(durationMinutes) <= 0) && data.examSetId) {
        const es = await client.query('SELECT duration_minutes FROM exam_sets WHERE id=$1 AND tenant_id=$2', [data.examSetId, tenantId]);
        if (es.rows.length && es.rows[0].duration_minutes) durationMinutes = es.rows[0].duration_minutes;
      }
      durationMinutes = Number(durationMinutes || 120);
      // attemptLimit = 0 means unlimited (no minimum of 1)
      const attemptLimit = Number(data.attemptLimit ?? 1);
      const result = await client.query(`UPDATE mock_exams SET exam_set_id=$1,class_id=$2,title=$3,start_time=$4,end_time=$5,duration_minutes=$6,attempt_limit=$7,show_result=$8,status=$9,note=$10,updated_at=NOW() WHERE id=$11 AND tenant_id=$12 RETURNING *`,
        [data.examSetId, data.classId || null, data.title, data.startTime || null, data.endTime || null, durationMinutes, attemptLimit, data.showResult ?? true, data.status || 'upcoming', data.note || null, id, tenantId]);
      if (!result.rows.length) { await client.query('ROLLBACK'); return null; }
      if (data.reassign) {
        // #11: Safe reassign — only remove students who haven't started yet
        await client.query(`DELETE FROM mock_exam_students WHERE mock_exam_id=$1 AND status='assigned'`, [id]);
        await this._assignStudents(client, tenantId, id, data.classId, data.studentIds || []);
      }
      await client.query('COMMIT'); return this.getMockExam(tenantId, id);
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  }

  async deleteMockExam(tenantId, id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const examRes = await client.query(
        'SELECT id, status, title FROM mock_exams WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
        [id, tenantId]
      );
      if (!examRes.rows.length) {
        const err = new Error('Kỳ thi không tồn tại');
        err.status = 404;
        throw err;
      }
      const exam = examRes.rows[0];

      const checkAttempts = await client.query(
        `SELECT COUNT(*)::int AS count FROM student_exam_attempts a
         JOIN mock_exam_students s ON s.id = a.mock_exam_student_id
         WHERE s.mock_exam_id = $1 AND s.tenant_id = $2`,
        [id, tenantId]
      );
      const hasAttempts = (checkAttempts.rows[0]?.count || 0) > 0;

      // Nếu đã có học viên làm bài nhưng kỳ thi CHƯA ở trạng thái 'cancelled':
      // Yêu cầu chuyển trạng thái sang "Đã huỷ" trước để xác nhận việc dừng kỳ thi
      if (hasAttempts && exam.status !== 'cancelled') {
        const err = new Error('Kỳ thi đã có học viên làm bài. Để đảm bảo an toàn, vui lòng chuyển trạng thái kỳ thi sang "Đã huỷ" trước khi xoá.');
        err.status = 400;
        throw err;
      }

      // Xoá câu trả lời bài thi của học viên trong kỳ thi này
      await client.query(
        `DELETE FROM student_exam_answers
         WHERE mock_exam_student_id IN (
           SELECT id FROM mock_exam_students WHERE mock_exam_id = $1 AND tenant_id = $2
         ) AND tenant_id = $2`,
        [id, tenantId]
      );

      // Xoá các lượt làm bài (attempts)
      await client.query(
        `DELETE FROM student_exam_attempts
         WHERE mock_exam_student_id IN (
           SELECT id FROM mock_exam_students WHERE mock_exam_id = $1 AND tenant_id = $2
         ) AND tenant_id = $2`,
        [id, tenantId]
      );

      // Xoá danh sách học viên được gán vào kỳ thi
      await client.query(
        'DELETE FROM mock_exam_students WHERE mock_exam_id = $1 AND tenant_id = $2',
        [id, tenantId]
      );

      // Xoá chính kỳ thi
      await client.query(
        'DELETE FROM mock_exams WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async _assignStudents(client, tenantId, mockExamId, classId, studentIds) {
    const ids = new Set((studentIds || []).map(Number).filter(Boolean));
    if (classId) {
      const classStudents = await client.query(`SELECT student_id FROM class_students WHERE class_id=$1 AND tenant_id=$2 AND status='active'`, [classId, tenantId]);
      classStudents.rows.forEach(r => ids.add(Number(r.student_id)));
    }
    for (const studentId of ids) await client.query(`INSERT INTO mock_exam_students (tenant_id,mock_exam_id,student_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [tenantId, mockExamId, studentId]);
  }

  async _getMockExamStudentForAttempt(client, tenantId, mockExamStudentId) {
    const ms = await client.query(
      `SELECT ms.*, m.status AS exam_status, m.start_time, m.end_time, m.duration_minutes, m.attempt_limit, m.exam_set_id, e.format_code, e.duration_minutes AS exam_set_duration_minutes
       FROM mock_exam_students ms
       JOIN mock_exams m ON m.id=ms.mock_exam_id
       JOIN exam_sets e ON e.id=m.exam_set_id
       WHERE ms.id=$1 AND ms.tenant_id=$2`,
      [mockExamStudentId, tenantId]
    );
    if (!ms.rows.length) return null;
    const row = ms.rows[0];
    const now = new Date();
    if (row.exam_status !== 'active') throw Object.assign(new Error('Kỳ thi chưa mở hoặc đã đóng'), { status: 400 });
    if (row.start_time && now < new Date(row.start_time)) throw Object.assign(new Error('Chưa đến thời gian làm bài'), { status: 400 });
    if (row.end_time && now > new Date(row.end_time)) throw Object.assign(new Error('Đã hết thời gian làm bài'), { status: 400 });
    if (row.status === 'graded') throw Object.assign(new Error('Bài thi đã được chấm, không thể làm lại'), { status: 400 });
    return row;
  }

  async _ensureInProgressAttempt(client, tenantId, mockExamStudentId) {
    const row = await this._getMockExamStudentForAttempt(client, tenantId, mockExamStudentId);
    if (!row) return null;
    const existing = await client.query(
      `SELECT * FROM student_exam_attempts
       WHERE tenant_id=$1 AND mock_exam_student_id=$2 AND status='in_progress'
       ORDER BY attempt_no DESC, id DESC LIMIT 1`,
      [tenantId, mockExamStudentId]
    );
    if (existing.rows.length) {
      await client.query(`UPDATE mock_exam_students SET status='in_progress', started_at=COALESCE(started_at, $1), updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, [existing.rows[0].started_at || new Date(), mockExamStudentId, tenantId]);
      return { row, attempt: existing.rows[0] };
    }
    // attemptLimit = 0 means unlimited
    const attemptLimit = Number(row.attempt_limit ?? 1);
    const attemptCount = await client.query('SELECT COUNT(*) FROM student_exam_attempts WHERE mock_exam_student_id=$1 AND tenant_id=$2', [mockExamStudentId, tenantId]);
    const usedAttempts = Number(attemptCount.rows[0]?.count || 0);
    if (attemptLimit > 0 && usedAttempts >= attemptLimit) throw Object.assign(new Error(`Bạn đã dùng hết ${attemptLimit} lần làm bài`), { status: 400 });
    const attemptNo = usedAttempts + 1;
    const attempt = await client.query(
      `INSERT INTO student_exam_attempts (tenant_id, mock_exam_student_id, attempt_no, status, started_at)
       VALUES ($1,$2,$3,'in_progress',NOW()) RETURNING *`,
      [tenantId, mockExamStudentId, attemptNo]
    );
    await client.query(`UPDATE mock_exam_students SET status='in_progress', started_at=COALESCE(started_at, NOW()), updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, [mockExamStudentId, tenantId]);
    return { row, attempt: attempt.rows[0] };
  }

  async startAttempt(tenantId, mockExamStudentId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ensured = await this._ensureInProgressAttempt(client, tenantId, mockExamStudentId);
      await client.query('COMMIT');
      if (!ensured) return null;
      // #2: Calculate remaining_seconds server-side so frontend cannot be bypassed
      const row = ensured.row;
      const durationMinutes = Number(row.duration_minutes || row.exam_set_duration_minutes || 120);
      const durationMs = durationMinutes * 60 * 1000;
      const startedAt = new Date(ensured.attempt.started_at).getTime();
      const endTime = row.end_time ? new Date(row.end_time).getTime() : Infinity;
      const deadline = Math.min(startedAt + durationMs, endTime);
      const remainingSeconds = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      return { attempt: ensured.attempt, started_at: ensured.attempt.started_at, remaining_seconds: remainingSeconds };
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  }


  /**
   * Kiểm tra xem thời gian làm bài đã hết chưa.
   * Tiêu chí: started_at + duration_minutes <= NOW() hoặc end_time của kỳ thi đã qua.
   */
  _checkAttemptDeadline(row, attempt) {
    const now = Date.now();
    const durationMinutes = Number(row.duration_minutes || row.exam_set_duration_minutes || 120);
    const durationMs = durationMinutes * 60 * 1000;
    const startedAt = new Date(attempt.started_at).getTime();
    const endTime = row.end_time ? new Date(row.end_time).getTime() : Infinity;
    const deadline = Math.min(startedAt + durationMs, endTime);
    if (now > deadline + 10000) { // 10 giây grace period cho network latency
      throw Object.assign(new Error('Đã hết thời gian làm bài, không thể lưu đáp án'), { status: 400 });
    }
  }

  async resetInProgressAttempt(tenantId, mockExamStudentId) {
    // #1: Soft-pause only — do NOT delete the attempt or reset status.
    // The student can resume from where they left off when they return.
    // Only admin can truly cancel/invalidate an attempt via a separate admin action.
    const result = await pool.query(
      `UPDATE mock_exam_students SET paused_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND tenant_id=$2 AND status='in_progress' RETURNING *`,
      [mockExamStudentId, tenantId]
    );
    return result.rows[0] || null;
  }

  async _saveAnswerOnAttempt(client, tenantId, mockExamStudentId, attemptId, ans) {
    const questionId = Number(ans.questionId || ans.question_id);
    if (!questionId) return null;
    const q = await client.query(
      `SELECT q.id, q.skill, q.score FROM exam_questions q
       JOIN exam_set_questions esq ON esq.question_id=q.id
       JOIN mock_exams m ON m.exam_set_id=esq.exam_set_id
       JOIN mock_exam_students ms ON ms.mock_exam_id=m.id
       WHERE q.id=$1 AND q.tenant_id=$2 AND ms.id=$3 LIMIT 1`,
      [questionId, tenantId, mockExamStudentId]
    );
    if (!q.rows.length) return null;
    let isCorrect = null; let score = 0;
    const selectedOptionId = ans.selectedOptionId || ans.selected_option_id || null;
    if (selectedOptionId) {
      const opt = await client.query('SELECT is_correct FROM exam_question_options WHERE id=$1 AND question_id=$2', [selectedOptionId, questionId]);
      isCorrect = !!opt.rows[0]?.is_correct;
      score = isCorrect ? Number(q.rows[0].score || 1) : 0;
    }
    const result = await client.query(
      `INSERT INTO student_exam_answers (tenant_id,attempt_id,mock_exam_student_id,question_id,selected_option_id,answer_text,is_correct,score,recording_url,duration_seconds,word_count,char_count,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
       ON CONFLICT (attempt_id, question_id)
       DO UPDATE SET selected_option_id=EXCLUDED.selected_option_id, answer_text=EXCLUDED.answer_text, is_correct=EXCLUDED.is_correct, score=EXCLUDED.score,
         recording_url=COALESCE(EXCLUDED.recording_url, student_exam_answers.recording_url), duration_seconds=COALESCE(EXCLUDED.duration_seconds, student_exam_answers.duration_seconds),
         word_count=EXCLUDED.word_count, char_count=EXCLUDED.char_count,
         metadata=COALESCE(student_exam_answers.metadata, '{}'::jsonb) || EXCLUDED.metadata, updated_at=NOW()
       RETURNING *`,
      [tenantId, attemptId, mockExamStudentId, questionId, selectedOptionId, ans.answerText || ans.answer_text || null, isCorrect, score,
        ans.recordingUrl || ans.recording_url || null, ans.durationSeconds || ans.duration_seconds || null, ans.wordCount || ans.word_count || null, ans.charCount || ans.char_count || null, JSON.stringify(ans.metadata || {})]
    );
    return result.rows[0];
  }

  async saveAnswer(tenantId, mockExamStudentId, answer) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ensured = await this._ensureInProgressAttempt(client, tenantId, mockExamStudentId);
      if (!ensured) { await client.query('ROLLBACK'); return null; }
      // Kiểm tra thời gian làm bài chưa hết
      this._checkAttemptDeadline(ensured.row, ensured.attempt);
      const saved = await this._saveAnswerOnAttempt(client, tenantId, mockExamStudentId, ensured.attempt.id, answer || {});
      await client.query('COMMIT');
      return saved;
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  }

  async submitAnswers(tenantId, mockExamStudentId, answers) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ensured = await this._ensureInProgressAttempt(client, tenantId, mockExamStudentId);
      if (!ensured) { await client.query('ROLLBACK'); return null; }
      const row = ensured.row;
      const attemptId = ensured.attempt.id;
      const attemptNo = ensured.attempt.attempt_no;
      if (ensured.attempt.status !== 'in_progress') throw Object.assign(new Error('Lần làm bài này không còn ở trạng thái đang làm'), { status: 400 });
      // Kiểm tra thời gian làm bài chưa hết khi nộp bài
      this._checkAttemptDeadline(row, ensured.attempt);

      for (const ans of answers || []) {
        await this._saveAnswerOnAttempt(client, tenantId, mockExamStudentId, attemptId, ans);
      }

      const fmt = getFormat(row.format_code || 'TOEIC_LR');
      let totalScore = 0;
      let objectiveScore = 0;
      let skillBreakdown = {};

      if (fmt.examType === 'VSTEP') {
        const skillRows = await client.query(
          `SELECT q.skill, COUNT(*) AS total, COUNT(*) FILTER (WHERE a.is_correct = TRUE) AS correct, COALESCE(SUM(a.score),0) AS raw_score
           FROM exam_set_questions esq
           JOIN mock_exams m ON m.exam_set_id=esq.exam_set_id
           JOIN mock_exam_students ms ON ms.mock_exam_id=m.id
           JOIN exam_questions q ON q.id=esq.question_id
           LEFT JOIN student_exam_answers a ON a.question_id=q.id AND a.attempt_id=$1
           WHERE ms.id=$2 AND esq.tenant_id=$3 AND q.skill IN ('Listening','Reading')
           GROUP BY q.skill`,
          [attemptId, mockExamStudentId, tenantId]
        );
        skillRows.rows.forEach(r => {
          const total = Number(r.total || 0);
          const correct = Number(r.correct || 0);
          objectiveScore += Number(r.raw_score || 0);
          skillBreakdown[r.skill] = { correct, total, score10: total ? roundToHalf((correct / total) * 10) : 0 };
        });
        const scores = ['Listening','Reading'].map(k => skillBreakdown[k]?.score10).filter(v => typeof v === 'number');
        totalScore = scores.length ? roundToHalf(scores.reduce((a,b)=>a+b,0) / scores.length) : 0;
      } else {
        const obj = await client.query(`SELECT COALESCE(SUM(score),0) AS score FROM student_exam_answers WHERE tenant_id=$1 AND attempt_id=$2 AND is_correct IS NOT NULL`, [tenantId, attemptId]);
        objectiveScore = Number(obj.rows[0]?.score || 0);
        totalScore = objectiveScore;
      }

      const manualQuestionCount = await client.query(
        `SELECT COUNT(*) FROM (
           SELECT DISTINCT CASE
             WHEN q.format_code='VSTEP_4_SKILLS' AND q.skill='Speaking' THEN q.skill || ':' || q.part
             ELSE q.id::text
           END AS manual_item
           FROM exam_set_questions esq
           JOIN mock_exams m ON m.exam_set_id=esq.exam_set_id
           JOIN exam_questions q ON q.id=esq.question_id
           WHERE m.id=$1 AND esq.tenant_id=$2 AND (q.skill IN ('Writing','Speaking') OR q.question_type LIKE 'writing_%' OR q.question_type LIKE 'speaking_%')
         ) x`,
        [row.mock_exam_id, tenantId]
      );
      const finalStatus = Number(manualQuestionCount.rows[0]?.count || 0) > 0 ? 'submitted' : 'graded';
      const gradingStatus = finalStatus === 'submitted'
        ? (fmt.examType === 'VSTEP' ? 'pending_ai' : 'pending_manual')
        : 'not_required';
      await client.query(`UPDATE student_exam_attempts SET status=$1, grading_status=$2, submitted_at=NOW(), objective_score=$3, total_score=$4, skill_score_breakdown=$5::jsonb WHERE id=$6 AND tenant_id=$7`, [finalStatus, gradingStatus, objectiveScore, totalScore, JSON.stringify(skillBreakdown), attemptId, tenantId]);
      const updated = await client.query(`UPDATE mock_exam_students SET status=$1, grading_status=$2, published_at=NULL, published_by=NULL, started_at=COALESCE(started_at, $3), submitted_at=NOW(), objective_score=$4, total_score=$5, skill_score_breakdown=$6::jsonb, updated_at=NOW() WHERE id=$7 AND tenant_id=$8 RETURNING *`, [finalStatus, gradingStatus, ensured.attempt.started_at, objectiveScore, totalScore, JSON.stringify(skillBreakdown), mockExamStudentId, tenantId]);
      await client.query('COMMIT');
      if (finalStatus === 'submitted' && fmt.examType === 'VSTEP') {
        setImmediate(() => {
          aiGradingService.queueAndProcess(tenantId, mockExamStudentId, null, 'automatic')
            .catch((err) => console.error('Automatic AI grading failed:', err.message));
        });
      }
      return { ...updated.rows[0], attempt_id: attemptId, attempt_no: attemptNo };
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  }

  async gradeStudent(tenantId, mockExamStudentId, data, graderId, actor) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const examInfo = await client.query(
        // #4: Added la.status AS latest_attempt_status (was missing, causing grading to always fail)
        `SELECT ms.*, e.format_code, e.exam_type,
          la.id AS latest_attempt_id, la.attempt_no AS latest_attempt_no,
          la.status AS latest_attempt_status
         FROM mock_exam_students ms
         JOIN mock_exams m ON m.id=ms.mock_exam_id
         JOIN exam_sets e ON e.id=m.exam_set_id
         LEFT JOIN LATERAL (
           SELECT * FROM student_exam_attempts sea
           WHERE sea.mock_exam_student_id=ms.id AND sea.tenant_id=ms.tenant_id
           ORDER BY sea.attempt_no DESC, sea.id DESC
           LIMIT 1
         ) la ON TRUE
         WHERE ms.id=$1 AND ms.tenant_id=$2`,
        [mockExamStudentId, tenantId]
      );
      if (!examInfo.rows.length) { await client.query('ROLLBACK'); return null; }
      const row = examInfo.rows[0];
      if (!row.latest_attempt_id) throw Object.assign(new Error('Học viên chưa nộp bài nên chưa thể chấm'), { status: 400 });
      if (['pending_ai', 'ai_processing'].includes(row.grading_status)) {
        throw Object.assign(new Error('AI đang xếp hàng hoặc đang chấm bài này. Vui lòng đợi hoàn tất trước khi duyệt.'), { status: 409 });
      }
      // Chỉ cho phép chấm khi bài đã được nộp hoặc đang ở trạng thái graded (chấm lại)
      if (!['submitted', 'graded'].includes(row.latest_attempt_status)) {
        throw Object.assign(
          new Error('Học viên chưa nộp bài hoặc bài đang được xử lý, không thể chấm'),
          { status: 400 }
        );
      }
      const attemptId = row.latest_attempt_id;

      // #15: Validate score range before saving — lấy maxScore từ DB, không tin client
      const answerScores = Array.isArray(data.answerScores) ? data.answerScores : [];
      for (const item of answerScores) {
        const questionId = Number(item.questionId || item.question_id);
        if (!questionId) continue;
        // Xác minh questionId thuộc bộ đề của kỳ thi này và lấy maxScore từ DB
        const qCheck = await client.query(
          `SELECT q.score AS max_score, q.skill, q.format_code FROM exam_questions q
           JOIN exam_set_questions esq ON esq.question_id = q.id
           JOIN mock_exams m ON m.exam_set_id = esq.exam_set_id
           WHERE q.id=$1 AND q.tenant_id=$2 AND m.id=(
             SELECT mock_exam_id FROM mock_exam_students WHERE id=$3 AND tenant_id=$2
           ) LIMIT 1`,
          [questionId, tenantId, mockExamStudentId]
        );
        if (!qCheck.rows.length) {
          throw Object.assign(new Error(`Câu hỏi ${questionId} không thuộc bộ đề của kỳ thi này`), { status: 400 });
        }
        const rawScore = Number(item.score ?? 0);
        const maxScore = qCheck.rows[0].format_code === 'VSTEP_4_SKILLS' && ['Writing', 'Speaking'].includes(qCheck.rows[0].skill)
          ? 10
          : Number(qCheck.rows[0].max_score || 1);
        if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > maxScore) {
          throw Object.assign(new Error(`Điểm không hợp lệ cho câu ${questionId}: ${item.score} (tối đa ${maxScore})`), { status: 400 });
        }
        const score = qCheck.rows[0].format_code === 'VSTEP_4_SKILLS' ? roundToHalf(rawScore) : rawScore;
        const feedback = item.feedback || item.comment || '';
        const criteria = Array.isArray(item.criteria) ? item.criteria.map((criterion) => ({
          code: String(criterion.code || ''),
          label: String(criterion.label || criterion.code || ''),
          score: Math.max(0, Math.min(10, Number(criterion.score || 0))),
          feedback: String(criterion.feedback || ''),
        })) : [];
        const meta = { gradingFeedback: feedback, gradingCriteria: criteria };
        await client.query(
          `INSERT INTO student_exam_answers
           (tenant_id, attempt_id, mock_exam_student_id, question_id, score, metadata, graded_by, graded_at)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,NOW())
           ON CONFLICT (attempt_id, question_id)
           DO UPDATE SET score=EXCLUDED.score,
             metadata=COALESCE(student_exam_answers.metadata, '{}'::jsonb) || EXCLUDED.metadata,
             graded_by=EXCLUDED.graded_by,
             graded_at=NOW(),
             updated_at=NOW()`,
          [tenantId, attemptId, mockExamStudentId, questionId, score, JSON.stringify(meta), graderId]
        );
      }

      const fmt = getFormat(row.format_code || 'TOEIC_LR');
      const manualRows = await client.query(
        `SELECT q.skill, q.question_type, COALESCE(SUM(a.score),0) AS score_sum, COALESCE(AVG(NULLIF(a.score, NULL)),0) AS score_avg, COUNT(*) AS answer_count
         FROM student_exam_answers a
         JOIN exam_questions q ON q.id=a.question_id
         WHERE a.tenant_id=$1 AND a.attempt_id=$2 AND (q.skill IN ('Writing','Speaking') OR q.question_type LIKE 'writing_%' OR q.question_type LIKE 'speaking_%')
         GROUP BY q.skill, q.question_type`,
        [tenantId, attemptId]
      );
      const manualScore = manualRows.rows.reduce((sum, r) => sum + Number(r.score_sum || 0), 0);

      let totalScore = Number(row.objective_score || 0) + manualScore;
      let overallScore = null;
      let skillScores = toJson(row.skill_score_breakdown, {});
      let reviewedItems = [];

      if (fmt.examType === 'VSTEP') {
        const bySkill = { Writing: [], Speaking: [] };
        const manualDetail = await client.query(
          // #6: Also fetch part to distinguish Writing Task 1 vs Task 2
          `SELECT q.skill, q.part, q.id AS question_id, a.id AS answer_id, a.score, a.metadata
           FROM student_exam_answers a JOIN exam_questions q ON q.id=a.question_id
           WHERE a.tenant_id=$1 AND a.attempt_id=$2 AND q.skill IN ('Writing','Speaking')
           ORDER BY q.skill, q.part ASC`,
          [tenantId, attemptId]
        );
        reviewedItems = manualDetail.rows.map((item) => ({
          questionId: Number(item.question_id),
          answerId: Number(item.answer_id),
          skill: item.skill,
          part: item.part,
          score: Number(item.score || 0),
          feedback: toJson(item.metadata, {}).gradingFeedback || '',
          criteria: toJson(item.metadata, {}).gradingCriteria || [],
        }));
        manualDetail.rows.forEach(r => { if (bySkill[r.skill]) bySkill[r.skill].push({
          score: Number(r.score || 0), part: r.part, questionId: Number(r.question_id), answerId: Number(r.answer_id), metadata: toJson(r.metadata, {})
        }); });

        // VSTEP Speaking: average of all three parts, rounded to 0.5.
        if (bySkill['Speaking'].length) skillScores['Speaking'] = calculateSpeakingScore(bySkill['Speaking']);
        if (typeof skillScores['Speaking'] === 'number') skillScores['Speaking'] = { score10: Number(skillScores['Speaking']) };

        // VSTEP Writing: Task 1 × 1/3 + Task 2 × 2/3, rounded to 0.5.
        if (bySkill['Writing'].length) skillScores['Writing'] = calculateWritingScore(bySkill['Writing']);
        if (typeof skillScores['Writing'] === 'number') skillScores['Writing'] = { score10: Number(skillScores['Writing']) };

        ['Listening','Reading'].forEach(skill => {
          if (typeof skillScores[skill] === 'number') skillScores[skill] = { score10: Number(skillScores[skill]) };
        });
        // VSTEP overall chỉ tính khi đủ cả 4 kỹ năng. Nếu thiếu kỹ năng nào, overall = null (chưa hoàn chỉnh)
        overallScore = calculateVstepOverall(skillScores);
        totalScore = overallScore || 0;
      } else if (data.skillScores) {
        // Preserve the existing non-VSTEP grading flow. VSTEP scores are always
        // recalculated on the server and never accepted from this client field.
        skillScores = { ...skillScores, ...data.skillScores };
      }

      if (!reviewedItems.length) {
        reviewedItems = answerScores.map((item) => ({
          questionId: Number(item.questionId || item.question_id),
          score: Number(item.score || 0),
          feedback: item.feedback || item.comment || '',
          criteria: Array.isArray(item.criteria) ? item.criteria : [],
        }));
      }

      const reviewerSource = actor?.roles?.includes('admin') ? 'admin' : 'teacher';
      const reviewedResult = {
        answers: reviewedItems,
        skillScores,
        overallScore,
        feedback: data.feedback || '',
      };
      let gradingRun = await client.query(
        `SELECT * FROM exam_grading_runs WHERE tenant_id=$1 AND attempt_id=$2 ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [tenantId, attemptId]
      );
      if (!gradingRun.rows.length || ['reviewed', 'published'].includes(gradingRun.rows[0].status)) {
        const cfg = aiGradingService.getConfig();
        const supersedesRunId = gradingRun.rows[0]?.id || null;
        gradingRun = await client.query(
          `INSERT INTO exam_grading_runs
           (tenant_id,mock_exam_student_id,attempt_id,supersedes_run_id,trigger_type,status,provider,grading_model,transcription_model,prompt_version,rubric_snapshot,reviewed_result,requested_by,reviewed_by,reviewed_at,completed_at)
           VALUES ($1,$2,$3,$4,'manual','reviewed',$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$11,NOW(),NOW()) RETURNING *`,
          [tenantId, mockExamStudentId, attemptId, supersedesRunId, cfg.provider, cfg.gradingModel, cfg.transcriptionModel, cfg.promptVersion,
            JSON.stringify(cfg.rubric), JSON.stringify(reviewedResult), graderId]
        );
      } else {
        gradingRun = await client.query(
          `UPDATE exam_grading_runs SET status='reviewed', reviewed_result=$1::jsonb, reviewed_by=$2,
             reviewed_at=NOW(), published_at=NULL, published_by=NULL, updated_at=NOW()
           WHERE id=$3 AND tenant_id=$4 RETURNING *`,
          [JSON.stringify(reviewedResult), graderId, gradingRun.rows[0].id, tenantId]
        );
      }

      for (const item of reviewedItems) {
        if (!item.answerId) continue;
        await client.query(
          `INSERT INTO exam_answer_gradings
           (tenant_id,grading_run_id,answer_id,question_id,skill,part,source,score,criteria_scores,feedback)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
           ON CONFLICT (grading_run_id, answer_id) DO UPDATE SET
             source=EXCLUDED.source, score=EXCLUDED.score, criteria_scores=EXCLUDED.criteria_scores, feedback=EXCLUDED.feedback`,
          [tenantId, gradingRun.rows[0].id, item.answerId, item.questionId, item.skill, item.part,
            reviewerSource, Number(item.score || 0), JSON.stringify(item.criteria || []), item.feedback || '']
        );
      }

      await client.query(
        `UPDATE student_exam_attempts
         SET status='graded', grading_status='reviewed', published_at=NULL, published_by=NULL,
             manual_score=$1, total_score=$2, overall_score=$3, skill_score_breakdown=$4::jsonb, feedback=$5, updated_at=NOW()
         WHERE id=$6 AND tenant_id=$7`,
        [manualScore, totalScore, overallScore, JSON.stringify(skillScores), data.feedback || null, attemptId, tenantId]
      );
      const result = await client.query(
        `UPDATE mock_exam_students
         SET manual_score=$1, total_score=$2, overall_score=$3, skill_score_breakdown=$4::jsonb, feedback=$5,
             status='graded', grading_status='reviewed', published_at=NULL, published_by=NULL, updated_at=NOW()
         WHERE id=$6 AND tenant_id=$7 RETURNING *`,
        [manualScore, totalScore, overallScore, JSON.stringify(skillScores), data.feedback || null, mockExamStudentId, tenantId]
      );
      await client.query('COMMIT');

      const info = await pool.query(
        `SELECT u.full_name AS student_name, m.title
         FROM mock_exam_students ms
         JOIN users u ON u.id = ms.student_id
         JOIN mock_exams m ON m.id = ms.mock_exam_id
         WHERE ms.id = $1 AND ms.tenant_id = $2`,
        [mockExamStudentId, tenantId]
      );
      const meta = info.rows[0] || {};

      activityLogService.log(tenantId, actor, {
        actionType: 'grade',
        entityType: 'mock_exam_student',
        entityId: mockExamStudentId,
        entityName: meta.title || null,
        description: `đã chấm bài thi "${meta.title || ''}" của học viên "${meta.student_name || ''}" - ${result.rows[0]?.total_score ?? ''} điểm`,
        metadata: { totalScore: result.rows[0]?.total_score, feedback: data.feedback || null },
      }).catch((err) => console.error('Failed to log exam grading:', err));

      return result.rows[0] || null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async publishStudentGrade(tenantId, mockExamStudentId, publisherId, actor) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query(
        `SELECT ms.id, ms.student_id, ms.status, ms.grading_status, ms.total_score, u.full_name AS student_name, m.title,
          la.id AS attempt_id
         FROM mock_exam_students ms
         JOIN users u ON u.id=ms.student_id
         JOIN mock_exams m ON m.id=ms.mock_exam_id
         LEFT JOIN LATERAL (
           SELECT id FROM student_exam_attempts
           WHERE tenant_id=ms.tenant_id AND mock_exam_student_id=ms.id
           ORDER BY attempt_no DESC, id DESC LIMIT 1
         ) la ON TRUE
         WHERE ms.id=$1 AND ms.tenant_id=$2 FOR UPDATE OF ms`,
        [mockExamStudentId, tenantId]
      );
      if (!found.rows.length) throw Object.assign(new Error('Không tìm thấy bài thi của học viên'), { status: 404 });
      const row = found.rows[0];
      if (row.status !== 'graded' || row.grading_status !== 'reviewed') {
        throw Object.assign(new Error('Bài phải được Teacher/Admin duyệt trước khi công bố'), { status: 400 });
      }
      await client.query(
        `UPDATE student_exam_attempts SET grading_status='published', published_at=NOW(), published_by=$1, updated_at=NOW()
         WHERE id=$2 AND tenant_id=$3`,
        [publisherId, row.attempt_id, tenantId]
      );
      const result = await client.query(
        `UPDATE mock_exam_students SET grading_status='published', published_at=NOW(), published_by=$1, updated_at=NOW()
         WHERE id=$2 AND tenant_id=$3 RETURNING *`,
        [publisherId, mockExamStudentId, tenantId]
      );
      await client.query(
        `UPDATE exam_grading_runs SET status='published', published_at=NOW(), published_by=$1, updated_at=NOW()
         WHERE id=(SELECT id FROM exam_grading_runs WHERE tenant_id=$2 AND attempt_id=$3 ORDER BY id DESC LIMIT 1) AND tenant_id=$2`,
        [publisherId, tenantId, row.attempt_id]
      );
      await client.query('COMMIT');

      activityLogService.log(tenantId, actor, {
        actionType: 'update',
        entityType: 'mock_exam_student',
        entityId: mockExamStudentId,
        entityName: row.title || null,
        description: `đã công bố điểm bài thi "${row.title || ''}" của học viên "${row.student_name || ''}"`,
        metadata: { totalScore: row.total_score },
      }).catch((err) => console.error('Failed to log grade publication:', err));
      notificationService.create(tenantId, row.student_id, {
        type: 'exam_grade_published',
        title: 'Điểm thi thử đã được công bố',
        message: `Kết quả bài thi "${row.title || ''}" đã sẵn sàng.`,
        link: '/student/mock-exams',
      }).catch((err) => console.error('Failed to notify grade publication:', err));
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

}

module.exports = new ExamService();
