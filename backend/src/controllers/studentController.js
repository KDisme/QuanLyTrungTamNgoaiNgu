// controllers/studentController.js
// Xử lý CRUD học viên

const studentService = require('../services/studentService');

const studentController = {
  async create(req, res, next) {
    try {
      const student = await studentService.createStudent(req.body);
      res.status(201).json({ message: 'Tạo học viên thành công', student });
    } catch (err) {
      next(err);
    }
  },

  async getAll(req, res, next) {
    try {
      const students = await studentService.getAllStudents();
      res.json({ message: 'Lấy danh sách học viên thành công', students });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const student = await studentService.getStudentById(req.params.id);
      if (!student) return res.status(404).json({ message: 'Không tìm thấy học viên' });
      res.json({ message: 'Lấy thông tin học viên thành công', student });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const student = await studentService.updateStudent(req.params.id, req.body);
      if (!student) return res.status(404).json({ message: 'Không tìm thấy học viên' });
      res.json({ message: 'Cập nhật học viên thành công', student });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      await studentService.deleteStudent(req.params.id);
      res.json({ message: 'Xóa học viên thành công' });
    } catch (err) {
      next(err);
    }
  },

  async completeCourse(req, res, next) {
    try {
      const { notes } = req.body || {};
      const result = await studentService.completeStudentCourse(req.params.id, { notes });
      res.json({ message: 'Cập nhật trạng thái hoàn thành thành công', ...result });
    } catch (err) {
      next(err);
    }
  },

  async getCompletedHistory(req, res, next) {
    try {
      const histories = await studentService.getCompletedHistory();
      res.json({ message: 'Lấy lịch sử hoàn thành thành công', histories });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = studentController;
