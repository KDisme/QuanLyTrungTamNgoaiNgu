// controllers/teacherController.js
// Xử lý HTTP requests cho Teacher - Presentation Layer

const teacherService = require('../services/teacherService');
const asyncHandler = require('../middlewares/asyncHandler');

/**
 * Teacher Controller
 * Nhận HTTP request, gọi service, trả về HTTP response
 * Sử dụng asyncHandler để tự động catch errors
 */
const teacherController = {
  /**
   * POST /api/teachers
   * Tạo giáo viên mới
   */
  create: asyncHandler(async (req, res, next) => {
    const teacher = await teacherService.createTeacher(req.body);
    res.status(201).json({
      success: true,
      message: 'Tạo giáo viên thành công',
      teacher,
    });
  }),

  /**
   * GET /api/teachers
   * Lấy toàn bộ danh sách giáo viên
   */
  getAll: asyncHandler(async (req, res, next) => {
    const teachers = await teacherService.getAllTeachers();
    res.json({
      success: true,
      message: 'Lấy danh sách giáo viên thành công',
      teachers,
      total: teachers.length,
    });
  }),

  /**
   * GET /api/teachers/:id
   * Lấy thông tin giáo viên theo ID
   */
  getById: asyncHandler(async (req, res, next) => {
    const teacher = await teacherService.getTeacherById(req.params.id);
    res.json({
      success: true,
      message: 'Lấy thông tin giáo viên thành công',
      teacher,
    });
  }),

  /**
   * PUT /api/teachers/:id
   * Cập nhật thông tin giáo viên
   */
  update: asyncHandler(async (req, res, next) => {
    const teacher = await teacherService.updateTeacher(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Cập nhật giáo viên thành công',
      teacher,
    });
  }),

  /**
   * DELETE /api/teachers/:id
   * Xóa giáo viên
   */
  delete: asyncHandler(async (req, res, next) => {
    await teacherService.deleteTeacher(req.params.id);
    res.json({
      success: true,
      message: 'Xóa giáo viên thành công',
    });
  }),

  /**
   * GET /api/teachers/:id/classes
   * Lấy danh sách lớp học do giáo viên phụ trách
   */
  getClasses: asyncHandler(async (req, res, next) => {
    const classes = await teacherService.getTeacherClasses(req.params.id);
    res.json({
      success: true,
      message: 'Lấy danh sách lớp học thành công',
      classes,
      total: classes.length,
    });
  }),
};

module.exports = teacherController;
