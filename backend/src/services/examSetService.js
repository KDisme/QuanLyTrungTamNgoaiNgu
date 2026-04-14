// services/examSetService.js
// Logic nghiệp vụ cho exam set

const examSetRepository = require('../repositories/examSetRepository');
const { BadRequestException, NotFoundException } = require('../exceptions');

const examSetService = {
	async createExamSet(payload) {
		// validateRequest đã check schema; service check thêm edge-case nếu muốn
		if (payload.questions.length !== payload.question_count) {
			throw new BadRequestException('Số câu hỏi không khớp question_count');
		}

		return await examSetRepository.createWithQuestions(payload);
	},

	async getAllExamSets() {
		return await examSetRepository.findAll();
	},

	async getExamSetDetail(id) {
		const examSet = await examSetRepository.findById(id);
		if (!examSet) throw new NotFoundException('Không tìm thấy bộ đề thi');
		const questions = await examSetRepository.findQuestionsByExamSetId(id);
		return { examSet, questions };
	},

	async deleteExamSet(id) {
		const ok = await examSetRepository.deleteById(id);
		if (!ok) throw new NotFoundException('Không tìm thấy bộ đề thi');
		return true;
	},

	async updateExamSet(id, payload) {
		if (payload.questions.length !== payload.question_count) {
			throw new BadRequestException('Số câu hỏi không khớp question_count');
		}
		const updated = await examSetRepository.updateWithQuestions(id, payload);
		if (!updated) throw new NotFoundException('Không tìm thấy bộ đề thi');
		return updated;
	},
};

module.exports = examSetService;

