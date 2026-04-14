// controllers/examSetController.js
// Xử lý API bộ đề thi

const examSetService = require('../services/examSetService');

const examSetController = {
	async create(req, res, next) {
		try {
			const { examSet, questions } = await examSetService.createExamSet(req.body);
			res.status(201).json({ message: 'Tạo bộ đề thi thành công', examSet, questions });
		} catch (err) {
			next(err);
		}
	},

	async getAll(req, res, next) {
		try {
			const examSets = await examSetService.getAllExamSets();
			res.json({ message: 'Lấy danh sách bộ đề thi thành công', examSets });
		} catch (err) {
			next(err);
		}
	},

	async getById(req, res, next) {
		try {
			const data = await examSetService.getExamSetDetail(req.params.id);
			res.json({ message: 'Lấy chi tiết bộ đề thi thành công', ...data });
		} catch (err) {
			next(err);
		}
	},

	async delete(req, res, next) {
		try {
			await examSetService.deleteExamSet(req.params.id);
			res.json({ message: 'Xóa bộ đề thi thành công' });
		} catch (err) {
			next(err);
		}
	},

	async update(req, res, next) {
		try {
			const { examSet, questions } = await examSetService.updateExamSet(req.params.id, req.body);
			res.json({ message: 'Cập nhật bộ đề thi thành công', examSet, questions });
		} catch (err) {
			next(err);
		}
	},
};

module.exports = examSetController;

