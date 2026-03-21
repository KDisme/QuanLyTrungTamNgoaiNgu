// models/examQuestion.js
// Câu hỏi trắc nghiệm trong bộ đề

class ExamQuestion {
	constructor({
		id,
		exam_set_id,
		question_order,
		content,
		option_a,
		option_b,
		option_c,
		option_d,
		correct_answer,
	}) {
		this.id = id;
		this.exam_set_id = exam_set_id;
		this.question_order = question_order;
		this.content = content;
		this.option_a = option_a;
		this.option_b = option_b;
		this.option_c = option_c;
		this.option_d = option_d;
		this.correct_answer = correct_answer;
	}
}

module.exports = ExamQuestion;

