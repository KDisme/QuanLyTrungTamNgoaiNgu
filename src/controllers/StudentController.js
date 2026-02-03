const StudentService = require('../services/StudentService');
const StudentValidator = require('../validators/StudentValidator');
const ApiError = require('../exceptions/ApiError');

class StudentController {
  /**
   * Tạo sinh viên mới
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async create(req, res, next) {
    try {
      const { body } = req;

      // Kiểm tra dữ liệu
      const validation = StudentValidator.validateCreateStudent(body);
      if (!validation.valid) {
        throw new ApiError(400, 'Validation error', validation.errors);
      }

      // Tạo sinh viên
      const result = await StudentService.createStudent(body);
      return res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy tất cả sinh viên
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getAll(req, res, next) {
    try {
      const result = await StudentService.getAllStudents();
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy sinh viên theo ID
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        throw new ApiError(400, 'Invalid student ID');
      }

      const result = await StudentService.getStudentById(id);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cập nhật thông tin sinh viên
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { body } = req;

      if (!id || isNaN(id)) {
        throw new ApiError(400, 'Invalid student ID');
      }

      // Kiểm tra dữ liệu
      const validation = StudentValidator.validateUpdateStudent(body);
      if (!validation.valid) {
        throw new ApiError(400, 'Validation error', validation.errors);
      }

      // Cập nhật sinh viên
      const result = await StudentService.updateStudent(id, body);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Xóa sinh viên
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        throw new ApiError(400, 'Invalid student ID');
      }

      const result = await StudentService.deleteStudent(id);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StudentController();
