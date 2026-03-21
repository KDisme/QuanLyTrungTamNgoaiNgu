// models/examSet.js
// Metadata bộ đề thi

class ExamSet {
	constructor({ id, title, exam_datetime, question_count, created_at }) {
		this.id = id;
		this.title = title;
		this.exam_datetime = exam_datetime;
		this.question_count = question_count;
		this.created_at = created_at;
	}
}

module.exports = ExamSet;

