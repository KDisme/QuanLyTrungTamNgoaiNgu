// controllers/studentController.js
// Xử lý HTTP requests cho Student - Presentation Layer

const studentService = require('../services/studentService');
const asyncHandler = require('../middlewares/asyncHandler');

/**
 * Student Controller
 * Nhận HTTP request, gọi service, trả về HTTP response
 * Sử dụng asyncHandler để tự động catch errors
 */
const studentController = {
  /**
   * POST /api/students
   * Tạo học viên mới
   */
  create: asyncHandler(async (req, res, next) => {
    const student = await studentService.createStudent(req.body);
    res.status(201).json({
      success: true,
      message: 'Tạo học viên thành công',
      student,
    });
  }),

  /**
   * GET /api/students
   * Lấy toàn bộ danh sách học viên
   */
  getAll: asyncHandler(async (req, res, next) => {
    const students = await studentService.getAllStudents();
    res.json({
      success: true,
      message: 'Lấy danh sách học viên thành công',
      students,
      total: students.length,
    });
  }),

  /**
   * GET /api/students/:id
   * Lấy thông tin học viên theo ID
   */
  getById: asyncHandler(async (req, res, next) => {
    const student = await studentService.getStudentById(req.params.id);
    res.json({
      success: true,
      message: 'Lấy thông tin học viên thành công',
      student,
    });
  }),

  /**
   * PUT /api/students/:id
   * Cập nhật thông tin học viên
   */
  update: asyncHandler(async (req, res, next) => {
    const student = await studentService.updateStudent(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Cập nhật học viên thành công',
      student,
    });
  }),

  /**
   * DELETE /api/students/:id
   * Xóa học viên
   */
  delete: asyncHandler(async (req, res, next) => {
    await studentService.deleteStudent(req.params.id);
    res.json({
      success: true,
      message: 'Xóa học viên thành công',
    });
  }),

  /**
   * POST /api/students/:id/assign-class
   * Gán lớp học cho sinh viên
   * Body: { class_id: number }
   */
  assignToClass: asyncHandler(async (req, res, next) => {
    const student = await studentService.assignStudentToClass(req.params.id, req.body.class_id);
    res.json({
      success: true,
      message: 'Gán lớp học cho sinh viên thành công',
      student,
    });
  }),

  /**
   * DELETE /api/students/:id/remove-class
   * Xóa sinh viên khỏi lớp học
   */
  removeFromClass: asyncHandler(async (req, res, next) => {
    const student = await studentService.removeStudentFromClass(req.params.id);
    res.json({
      success: true,
      message: 'Xóa sinh viên khỏi lớp học thành công',
      student,
    });
  }),
};

module.exports = studentController;
