// repositories/examSetRepository.js
// CRUD exam_sets + exam_questions

const pool = require('../config/db');
const ExamSet = require('../models/examSet');
const ExamQuestion = require('../models/examQuestion');

const examSetRepository = {
	async createWithQuestions({ title, exam_datetime, question_count, questions }) {
		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			const examSetResult = await client.query(
				'INSERT INTO exam_sets (title, exam_datetime, question_count, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *',
				[title, exam_datetime, question_count]
			);

			const examSetRow = examSetResult.rows[0];
			const examSet = new ExamSet(examSetRow);

			const insertedQuestions = [];
			for (let i = 0; i < questions.length; i++) {
				const q = questions[i];
				const questionOrder = i + 1;
				const qResult = await client.query(
					'INSERT INTO exam_questions (exam_set_id, question_order, content, option_a, option_b, option_c, option_d, correct_answer) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
					[
						examSet.id,
						questionOrder,
						q.content,
						q.option_a,
						q.option_b,
						q.option_c,
						q.option_d,
						q.correct_answer,
					]
				);
				insertedQuestions.push(new ExamQuestion(qResult.rows[0]));
			}

			await client.query('COMMIT');
			return { examSet, questions: insertedQuestions };
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		} finally {
			client.release();
		}
	},

	async findAll() {
		const result = await pool.query('SELECT * FROM exam_sets ORDER BY created_at DESC');
		return result.rows.map(r => new ExamSet(r));
	},

	async findById(id) {
		const result = await pool.query('SELECT * FROM exam_sets WHERE id = $1', [id]);
		if (!result.rows[0]) return null;
		return new ExamSet(result.rows[0]);
	},

	async findQuestionsByExamSetId(examSetId) {
		const result = await pool.query(
			'SELECT * FROM exam_questions WHERE exam_set_id = $1 ORDER BY question_order ASC',
			[examSetId]
		);
		return result.rows.map(r => new ExamQuestion(r));
	},

	async deleteById(id) {
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			await client.query('DELETE FROM exam_questions WHERE exam_set_id = $1', [id]);
			const delSet = await client.query('DELETE FROM exam_sets WHERE id = $1', [id]);
			await client.query('COMMIT');
			return delSet.rowCount > 0;
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		} finally {
			client.release();
		}
	},

	async updateWithQuestions(id, { title, exam_datetime, question_count, questions }) {
		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			// Ensure exam set exists
			const existing = await client.query('SELECT * FROM exam_sets WHERE id = $1', [id]);
			if (!existing.rows[0]) {
				await client.query('ROLLBACK');
				return null;
			}

			const updatedSetResult = await client.query(
				'UPDATE exam_sets SET title = $1, exam_datetime = $2, question_count = $3 WHERE id = $4 RETURNING *',
				[title, exam_datetime, question_count, id]
			);
			const examSet = new ExamSet(updatedSetResult.rows[0]);

			// Replace questions
			await client.query('DELETE FROM exam_questions WHERE exam_set_id = $1', [id]);

			const insertedQuestions = [];
			for (let i = 0; i < questions.length; i++) {
				const q = questions[i];
				const questionOrder = i + 1;
				const qResult = await client.query(
					'INSERT INTO exam_questions (exam_set_id, question_order, content, option_a, option_b, option_c, option_d, correct_answer) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
					[
						examSet.id,
						questionOrder,
						q.content,
						q.option_a,
						q.option_b,
						q.option_c,
						q.option_d,
						q.correct_answer,
					]
				);
				insertedQuestions.push(new ExamQuestion(qResult.rows[0]));
			}

			await client.query('COMMIT');
			return { examSet, questions: insertedQuestions };
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		} finally {
			client.release();
		}
	},
};

module.exports = examSetRepository;

