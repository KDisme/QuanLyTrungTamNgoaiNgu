// controllers/teacherController.js
// Xử lý CRUD giáo viên

const teacherService = require('../services/teacherService');

const teacherController = {
  async create(req, res, next) {
    try {
      const teacher = await teacherService.createTeacher(req.body);
      res.status(201).json({ message: 'Tạo giáo viên thành công', teacher });
    } catch (err) {
      next(err);
    }
  },

  async getAll(req, res, next) {
    try {
      const teachers = await teacherService.getAllTeachers();
      res.json({ message: 'Lấy danh sách giáo viên thành công', teachers });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const teacher = await teacherService.getTeacherById(req.params.id);
      if (!teacher) return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
      res.json({ message: 'Lấy thông tin giáo viên thành công', teacher });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const teacher = await teacherService.updateTeacher(req.params.id, req.body);
      if (!teacher) return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
      res.json({ message: 'Cập nhật giáo viên thành công', teacher });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      await teacherService.deleteTeacher(req.params.id);
      res.json({ message: 'Xóa giáo viên thành công' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = teacherController;
