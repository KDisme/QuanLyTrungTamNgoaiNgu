// validations/examSetValidation.js
// Schema validation cho exam set + questions

const Joi = require('joi');

const questionSchema = Joi.object({
	content: Joi.string().min(1).required().messages({
		'string.empty': 'Nội dung câu hỏi không được để trống',
		'any.required': 'Nội dung câu hỏi là bắt buộc',
	}),
	option_a: Joi.string().min(1).required().messages({
		'string.empty': 'Đáp án A không được để trống',
		'any.required': 'Đáp án A là bắt buộc',
	}),
	option_b: Joi.string().min(1).required().messages({
		'string.empty': 'Đáp án B không được để trống',
		'any.required': 'Đáp án B là bắt buộc',
	}),
	option_c: Joi.string().min(1).required().messages({
		'string.empty': 'Đáp án C không được để trống',
		'any.required': 'Đáp án C là bắt buộc',
	}),
	option_d: Joi.string().min(1).required().messages({
		'string.empty': 'Đáp án D không được để trống',
		'any.required': 'Đáp án D là bắt buộc',
	}),
	correct_answer: Joi.string().valid('A', 'B', 'C', 'D').required().messages({
		'any.only': 'Đáp án đúng phải là A, B, C hoặc D',
		'any.required': 'Đáp án đúng là bắt buộc',
	}),
});

const createExamSetSchema = Joi.object({
	title: Joi.string().max(255).required().messages({
		'string.empty': 'Tên đề thi không được để trống',
		'string.max': 'Tên đề thi không được vượt quá 255 ký tự',
		'any.required': 'Tên đề thi là bắt buộc',
	}),
	exam_datetime: Joi.date().iso().required().messages({
		'date.base': 'Thời gian thi không đúng định dạng',
		'any.required': 'Thời gian thi là bắt buộc',
	}),
	question_count: Joi.number().integer().min(1).required().messages({
		'number.base': 'Số lượng câu hỏi phải là số',
		'number.integer': 'Số lượng câu hỏi phải là số nguyên',
		'number.min': 'Số lượng câu hỏi phải >= 1',
		'any.required': 'Số lượng câu hỏi là bắt buộc',
	}),
	questions: Joi.array().items(questionSchema).required().messages({
		'array.base': 'Danh sách câu hỏi phải là mảng',
		'any.required': 'Danh sách câu hỏi là bắt buộc',
	}),
}).custom((value, helpers) => {
	if (Array.isArray(value.questions) && value.questions.length !== value.question_count) {
		return helpers.error('any.custom', {
			message: 'Số câu hỏi không khớp question_count',
		});
	}
	return value;
}, 'Question count match').messages({
	'any.custom': '{{#message}}',
});

module.exports = {
	createExamSetSchema,
	// Update dùng cùng shape như create (frontend cũng gửi full payload)
	updateExamSetSchema: createExamSetSchema,
};

