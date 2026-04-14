// controllers/teachingScheduleController.js
// Xử lý CRUD lịch giảng dạy

const teachingScheduleService = require('../services/teachingScheduleService');

const teachingScheduleController = {
  async create(req, res, next) {
    try {
      const schedule = await teachingScheduleService.createSchedule(req.body);
      res.status(201).json({ message: 'Tạo lịch giảng dạy thành công', schedule });
    } catch (err) {
      next(err);
    }
  },

  async getAll(req, res, next) {
    try {
      const schedules = await teachingScheduleService.getAllSchedules();
      res.json({ message: 'Lấy danh sách lịch giảng dạy thành công', schedules });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const schedule = await teachingScheduleService.getScheduleById(req.params.id);
      if (!schedule) return res.status(404).json({ message: 'Không tìm thấy lịch giảng dạy' });
      res.json({ message: 'Lấy thông tin lịch giảng dạy thành công', schedule });
    } catch (err) {
      next(err);
    }
  },

  async getByTeacherId(req, res, next) {
    try {
      const schedules = await teachingScheduleService.getSchedulesByTeacherId(req.params.teacher_id);
      res.json({ message: 'Lấy danh sách lịch giảng dạy theo giáo viên thành công', schedules });
    } catch (err) {
      next(err);
    }
  },

  async getByClassId(req, res, next) {
    try {
      const schedules = await teachingScheduleService.getSchedulesByClassId(req.params.class_id);
      res.json({ message: 'Lấy danh sách lịch giảng dạy theo lớp thành công', schedules });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const schedule = await teachingScheduleService.updateSchedule(req.params.id, req.body);
      if (!schedule) return res.status(404).json({ message: 'Không tìm thấy lịch giảng dạy' });
      res.json({ message: 'Cập nhật lịch giảng dạy thành công', schedule });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      await teachingScheduleService.deleteSchedule(req.params.id);
      res.json({ message: 'Xóa lịch giảng dạy thành công' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = teachingScheduleController;
