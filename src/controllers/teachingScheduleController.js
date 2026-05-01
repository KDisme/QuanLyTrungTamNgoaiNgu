// controllers/teachingScheduleController.js

const teachingScheduleService = require('../services/teachingScheduleService');
const asyncHandler = require('../middlewares/asyncHandler');

const teachingScheduleController = {

  // ================= CREATE =================
  createBulk: asyncHandler(async (req, res) => {
    const schedules = await teachingScheduleService.createSchedules(req.body);

    res.status(201).json({
      success: true,
      message: `Đã tạo thành công ${schedules.length} buổi học.`,
      schedules,
    });
  }),

  create: asyncHandler(async (req, res) => {
    const schedules = await teachingScheduleService.createSchedules(req.body);

    res.status(201).json({
      success: true,
      message: 'Tạo lịch giảng dạy thành công',
      schedules,
      total: schedules.length,
    });
  }),

  // ================= GET =================
  getAll: asyncHandler(async (req, res) => {
    const schedules = await teachingScheduleService.getAll();

    res.json({
      success: true,
      message: 'Lấy danh sách lịch giảng dạy thành công',
      schedules,
      total: schedules.length,
    });
  }),

  getById: asyncHandler(async (req, res) => {
    const schedule = await teachingScheduleService.getById(req.params.id);

    res.json({
      success: true,
      message: 'Lấy thông tin lịch giảng dạy thành công',
      schedule,
    });
  }),

  getByTeacher: asyncHandler(async (req, res) => {
    const schedules = await teachingScheduleService.getByTeacher(req.params.teacher_id);

    res.json({
      success: true,
      message: 'Lấy lịch theo giáo viên thành công',
      schedules,
      total: schedules.length,
    });
  }),

  getByClass: asyncHandler(async (req, res) => {
    const schedules = await teachingScheduleService.getByClass(req.params.class_id);

    res.json({
      success: true,
      message: 'Lấy lịch theo lớp thành công',
      schedules,
      total: schedules.length,
    });
  }),

  getByDate: asyncHandler(async (req, res) => {
    const schedules = await teachingScheduleService.getByDate(req.params.date);

    res.json({
      success: true,
      message: 'Lấy lịch theo ngày thành công',
      schedules,
      total: schedules.length,
    });
  }),

  // ================= UPDATE =================
  update: asyncHandler(async (req, res) => {
    const schedule = await teachingScheduleService.updateSchedule(req.params.id, req.body);

    res.json({
      success: true,
      message: 'Cập nhật lịch giảng dạy thành công',
      schedule,
    });
  }),

  // ================= DELETE =================
  delete: asyncHandler(async (req, res) => {
    await teachingScheduleService.deleteSchedule(req.params.id);

    res.json({
      success: true,
      message: 'Xóa lịch giảng dạy thành công',
    });
  }),

  // ================= CANCEL =================
  cancel: asyncHandler(async (req, res) => {
    const schedule = await teachingScheduleService.cancelSchedule(req.params.id);

    res.json({
      success: true,
      message: 'Hủy lịch giảng dạy thành công',
      schedule,
    });
  }),

  // ================= MAKEUP =================
  createMakeup: asyncHandler(async (req, res) => {
    const schedule = await teachingScheduleService.createMakeup(req.body);

    res.status(201).json({
      success: true,
      message: 'Tạo lịch học bù thành công',
      schedule,
    });
  }),

  getMakeup: asyncHandler(async (req, res) => {
    const filters = {};

    if (req.query.class_id) filters.class_id = parseInt(req.query.class_id);
    if (req.query.teacher_id) filters.teacher_id = parseInt(req.query.teacher_id);
    if (req.query.original_schedule_id) {
      filters.original_schedule_id = parseInt(req.query.original_schedule_id);
    }

    const schedules = await teachingScheduleService.getMakeupSchedules(filters);

    res.json({
      success: true,
      message: 'Lấy danh sách lịch học bù thành công',
      schedules,
      total: schedules.length,
    });
  }),

  getMakeupByOriginal: asyncHandler(async (req, res) => {
    const schedules = await teachingScheduleService.getMakeupSchedulesByOriginal(req.params.id);

    res.json({
      success: true,
      message: 'Lấy lịch học bù theo lịch gốc thành công',
      schedules,
      total: schedules.length,
    });
  }),
};

module.exports = teachingScheduleController;
