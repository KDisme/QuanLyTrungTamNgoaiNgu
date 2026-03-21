// controllers/classController.js
// Xử lý CRUD lớp học

const classService = require('../services/classService');

const classController = {
  async create(req, res, next) {
    try {
      const classData = await classService.createClass(req.body);
      res.status(201).json({ message: 'Tạo lớp học thành công', class: classData });
    } catch (err) {
      next(err);
    }
  },

  async getAll(req, res, next) {
    try {
      const classes = await classService.getAllClasses();
      res.json({ message: 'Lấy danh sách lớp học thành công', classes });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const classData = await classService.getClassById(req.params.id);
      if (!classData) return res.status(404).json({ message: 'Không tìm thấy lớp học' });
      res.json({ message: 'Lấy thông tin lớp học thành công', class: classData });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const classData = await classService.updateClass(req.params.id, req.body);
      if (!classData) return res.status(404).json({ message: 'Không tìm thấy lớp học' });
      res.json({ message: 'Cập nhật lớp học thành công', class: classData });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      await classService.deleteClass(req.params.id);
      res.json({ message: 'Xóa lớp học thành công' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = classController;
