// services/teacherService.js
// Logic nghiệp vụ cho Teacher - Business Logic Layer

const teacherRepository = require('../repositories/teacherRepository');
const { ApiError, NotFoundException } = require('../exceptions');
const { validateId, validateResourceExists } = require('../validators/commonValidators');
const { validateCreateTeacherData, validateUpdateTeacherData } = require('../validators/teacherValidator');

/**
 * Teacher Service
 * Xử lý toàn bộ logic nghiệp vụ cho giáo viên
 * Thực hiện validation, kiểm tra ràng buộc, gọi repository
 */
const teacherService = {
  /**
   * Tạo giáo viên mớiP
   * @throws {ApiError} Nếu dữ liệu không hợp lệ
   */
  async createTeacher(data) {
    // Validate dữ liệu
    validateCreateTeacherData(data);
    return await teacherRepository.create(data);
  },

  /**
   * Lấy thông tin giáo viên theo ID
   * @throws {NotFoundException} Nếu giáo viên không tồn tại
   */
  async getTeacherById(id) {
    validateId(id, 'giáo viên');

    const teacher = await teacherRepository.findById(id);
    validateResourceExists(teacher, 'teacher');
    
    return teacher;
  },

  /**
   * Lấy toàn bộ danh sách giáo viên
   */
  async getAllTeachers() {
    return await teacherRepository.findAll();
  },

  /**
   * Cập nhật thông tin giáo viên
   * @throws {NotFoundException} Nếu giáo viên không tồn tại
   */
  async updateTeacher(id, data) {
    validateId(id, 'giáo viên');

    const existing = await teacherRepository.findById(id);
    validateResourceExists(existing, 'teacher');

    // Validate dữ liệu cập nhật
    validateUpdateTeacherData(data);

    return await teacherRepository.update(id, data);
  },

  /**
   * Xóa giáo viên
   * @throws {NotFoundException} Nếu giáo viên không tồn tại
   */
  async deleteTeacher(id) {
    validateId(id, 'giáo viên');

    const teacher = await teacherRepository.findById(id);
    validateResourceExists(teacher, 'teacher');

    return await teacherRepository.delete(id);
  },

  /**
   * Lấy danh sách lớp học do giáo viên phụ trách
   * @param {number} teacherId - ID của giáo viên
   * @throws {NotFoundException} Nếu giáo viên không tồn tại
   */
  async getTeacherClasses(teacherId) {
    validateId(teacherId, 'giáo viên');

    const teacher = await teacherRepository.findById(teacherId);
    validateResourceExists(teacher, 'teacher');

    return await teacherRepository.getClasses(teacherId);
  },
};

module.exports = teacherService;
