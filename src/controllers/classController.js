// controllers/classController.js
// Xử lý HTTP requests cho Class - Presentation Layer

const classService = require('../services/classService');
const asyncHandler = require('../middlewares/asyncHandler');

/**
 * Class Controller
 * Nhận HTTP request, gọi service, trả về HTTP response
 * Sử dụng asyncHandler để tự động catch errors
 * Không xử lý lỗi trực tiếp, để lỗi bubble up tới error handler middleware
 */
const classController = {
  /**
   * POST /api/classes
   * Tạo lớp học mới
   */
  create: asyncHandler(async (req, res, next) => {
    const classData = await classService.createClass(req.body);
    res.status(201).json({
      success: true,
      message: 'Tạo lớp học thành công',
      class: classData,
    });
  }),

  /**
   * GET /api/classes
   * Lấy toàn bộ danh sách lớp học
   */
  getAll: asyncHandler(async (req, res, next) => {
    const classes = await classService.getAllClasses();
    res.json({
      success: true,
      message: 'Lấy danh sách lớp học thành công',
      classes,
      total: classes.length,
    });
  }),

  /**
   * GET /api/classes/:id
   * Lấy thông tin lớp học theo ID
   */
  getById: asyncHandler(async (req, res, next) => {
    const classData = await classService.getClassById(req.params.id);
    res.json({
      success: true,
      message: 'Lấy thông tin lớp học thành công',
      class: classData,
    });
  }),

  /**
   * PUT /api/classes/:id
   * Cập nhật thông tin lớp học
   */
  update: asyncHandler(async (req, res, next) => {
    const classData = await classService.updateClass(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Cập nhật lớp học thành công',
      class: classData,
    });
  }),

  /**
   * DELETE /api/classes/:id
   * Xóa lớp học
   */
  delete: asyncHandler(async (req, res, next) => {
    await classService.deleteClass(req.params.id);
    res.json({
      success: true,
      message: 'Xóa lớp học thành công',
    });
  }),

  /**
   * POST /api/classes/:id/assign-teacher
   * Gán giáo viên cho lớp học
   * Body: { teacher_id: number }
   */
  assignTeacher: asyncHandler(async (req, res, next) => {
    const classData = await classService.assignTeacherToClass(req.params.id, req.body.teacher_id);
    res.json({
      success: true,
      message: 'Gán giáo viên cho lớp học thành công',
      class: classData,
    });
  }),

  /**
   * DELETE /api/classes/:id/remove-teacher
   * Xóa giáo viên khỏi lớp học
   */
  removeTeacher: asyncHandler(async (req, res, next) => {
    const classData = await classService.removeTeacherFromClass(req.params.id);
    res.json({
      success: true,
      message: 'Xóa giáo viên khỏi lớp học thành công',
      class: classData,
    });
  }),

  /**
   * GET /api/classes/:id/students
   * Lấy danh sách sinh viên trong lớp học
   */
  getStudents: asyncHandler(async (req, res, next) => {
    const students = await classService.getStudentsByClass(req.params.id);
    res.json({
      success: true,
      message: 'Lấy danh sách sinh viên thành công',
      students,
      total: students.length,
    });
  }),
};

module.exports = classController;
