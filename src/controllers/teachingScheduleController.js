// controllers/teachingScheduleController.js
// Xử lý HTTP requests cho TeachingSchedule - Presentation Layer

const teachingScheduleService = require('../services/teachingScheduleService');
const asyncHandler = require('../middlewares/asyncHandler');

/**
 * TeachingSchedule Controller
 * Nhận HTTP request, gọi service, trả về HTTP response
 * Sử dụng asyncHandler để tự động catch errors
 */
const teachingScheduleController = {
  createBulk: asyncHandler(async (req, res) => {
        const schedules = await teachingScheduleService.createBulkSchedule(req.body);
        res.status(201).json({
            success: true,
            message: `Đã tạo thành công ${schedules.length} buổi học.`,
            schedules
        });
    }),
  /**
   * POST /api/teaching-schedules
   * Tạo lịch giảng dạy mới
   */
  create: asyncHandler(async (req, res, next) => {
    const schedule = await teachingScheduleService.createTeachingSchedule(req.body);
    res.status(201).json({
      success: true,
      message: 'Tạo lịch giảng dạy thành công',
      schedule,
    });
  }),

  /**
   * GET /api/teaching-schedules
   * Lấy toàn bộ danh sách lịch giảng dạy
   */
  getAll: asyncHandler(async (req, res, next) => {
    const schedules = await teachingScheduleService.getAllTeachingSchedules();
    res.json({
      success: true,
      message: 'Lấy danh sách lịch giảng dạy thành công',
      schedules,
      total: schedules.length,
    });
  }),

  /**
   * GET /api/teaching-schedules/:id
   * Lấy thông tin lịch giảng dạy theo ID
   */
  getById: asyncHandler(async (req, res, next) => {
    const schedule = await teachingScheduleService.getTeachingScheduleById(req.params.id);
    res.json({
      success: true,
      message: 'Lấy thông tin lịch giảng dạy thành công',
      schedule,
    });
  }),

  /**
   * GET /api/teaching-schedules/teacher/:teacher_id
   * Lấy lịch giảng dạy theo giáo viên
   */
  getByTeacher: asyncHandler(async (req, res, next) => {
    const schedules = await teachingScheduleService.getTeachingSchedulesByTeacher(req.params.teacher_id);
    res.json({
      success: true,
      message: 'Lấy lịch giảng dạy theo giáo viên thành công',
      schedules,
      total: schedules.length,
    });
  }),

  /**
   * GET /api/teaching-schedules/class/:class_id
   * Lấy lịch giảng dạy theo lớp học
   */
  getByClass: asyncHandler(async (req, res, next) => {
    const schedules = await teachingScheduleService.getTeachingSchedulesByClass(req.params.class_id);
    res.json({
      success: true,
      message: 'Lấy lịch giảng dạy theo lớp học thành công',
      schedules,
      total: schedules.length,
    });
  }),

  /**
   * GET /api/teaching-schedules/date/:date
   * Lấy lịch giảng dạy theo ngày (YYYY-MM-DD)
   */
  getByDate: asyncHandler(async (req, res, next) => {
    const schedules = await teachingScheduleService.getTeachingSchedulesByDate(req.params.date);
    res.json({
      success: true,
      message: 'Lấy lịch giảng dạy theo ngày thành công',
      schedules,
      total: schedules.length,
    });
  }),

  /**
   * PUT /api/teaching-schedules/:id
   * Cập nhật thông tin lịch giảng dạy
   */
  update: asyncHandler(async (req, res, next) => {
    const schedule = await teachingScheduleService.updateTeachingSchedule(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Cập nhật lịch giảng dạy thành công',
      schedule,
    });
  }),

  /**
   * DELETE /api/teaching-schedules/:id
   * Xóa lịch giảng dạy
   */
  delete: asyncHandler(async (req, res, next) => {
    await teachingScheduleService.deleteTeachingSchedule(req.params.id);
    res.json({
      success: true,
      message: 'Xóa lịch giảng dạy thành công',
    });
  }),
};

module.exports = teachingScheduleController;
