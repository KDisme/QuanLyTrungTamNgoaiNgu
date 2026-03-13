// services/classService.js
// Logic nghiệp vụ cho Class - Business Logic Layer

const classRepository = require('../repositories/classRepository');
const teacherRepository = require('../repositories/teacherRepository');
const { ApiError, NotFoundException } = require('../exceptions');
const { ERROR_CODES, ERROR_MESSAGES } = require('../constants/errorCodes');
const { validateId, validateResourceExists } = require('../validators/commonValidators');
const { validateCreateClassData, validateUpdateClassData } = require('../validators/classValidator');

/**
 * Class Service
 * Xử lý toàn bộ logic nghiệp vụ cho lớp học
 * Thực hiện validation, kiểm tra ràng buộc, gọi repository
 * Throw ApiError khi logic validation thất bại
 */
const classService = {
  /**
   * Tạo lớp học mới
   * @throws {NotFoundException} Nếu giáo viên không tồn tại
   * @throws {ApiError} Nếu dữ liệu không hợp lệ
   */
  async createClass(data) {
    // Validate dữ liệu
    validateCreateClassData(data);

    // If teacher_id provided, verify teacher exists
    if (data.teacher_id) {
      const teacher = await teacherRepository.findById(data.teacher_id);
      validateResourceExists(teacher, 'teacher');
    }

    return await classRepository.create(data);
  },

  /**
   * Lấy thông tin lớp học theo ID
   * @throws {NotFoundException} Nếu lớp không tồn tại
   */
  async getClassById(id) {
    validateId(id, 'lớp học');
    
    const classData = await classRepository.findById(id);
    validateResourceExists(classData, 'class');
    
    return classData;
  },

  /**
   * Lấy toàn bộ danh sách lớp học
   */
  async getAllClasses() {
    return await classRepository.findAll();
  },

  /**
   * Cập nhật lớp học
   * @throws {NotFoundException} Nếu lớp không tồn tại
   * @throws {ApiError} Nếu dữ liệu không hợp lệ
   */
  async updateClass(id, data) {
    validateId(id, 'lớp học');

    // Check if class exists
    const existing = await classRepository.findById(id);
    validateResourceExists(existing, 'class');

    // Validate dữ liệu cập nhật
    validateUpdateClassData(existing, data);

    // If teacher_id provided, verify teacher exists
    if (data.teacher_id) {
      const teacher = await teacherRepository.findById(data.teacher_id);
      validateResourceExists(teacher, 'teacher');
    }

    return await classRepository.update(id, data);
  },

  /**
   * Xóa lớp học
   * @throws {NotFoundException} Nếu lớp không tồn tại
   */
  async deleteClass(id) {
    validateId(id, 'lớp học');

    const classData = await classRepository.findById(id);
    validateResourceExists(classData, 'class');

    return await classRepository.delete(id);
  },

  /**
   * Gán giáo viên cho lớp học
   * @param {number} classId - ID của lớp
   * @param {number} teacherId - ID của giáo viên
   * @throws {NotFoundException} Nếu lớp hoặc giáo viên không tồn tại
   */
  async assignTeacherToClass(classId, teacherId) {
    validateId(classId, 'lớp học');
    validateId(teacherId, 'giáo viên');

    // Kiểm tra lớp tồn tại
    const classData = await classRepository.findById(classId);
    validateResourceExists(classData, 'class');

    // Kiểm tra giáo viên tồn tại
    const teacher = await teacherRepository.findById(teacherId);
    validateResourceExists(teacher, 'teacher');

    return await classRepository.assignTeacher(classId, teacherId);
  },

  /**
   * Xóa giáo viên khỏi lớp học
   * @param {number} classId - ID của lớp
   * @throws {NotFoundException} Nếu lớp không tồn tại
   */
  async removeTeacherFromClass(classId) {
    validateId(classId, 'lớp học');

    const classData = await classRepository.findById(classId);
    validateResourceExists(classData, 'class');

    return await classRepository.removeTeacher(classId);
  },

  /**
   * Lấy danh sách sinh viên trong lớp học
   * @param {number} classId - ID của lớp
   * @throws {NotFoundException} Nếu lớp không tồn tại
   */
  async getStudentsByClass(classId) {
    validateId(classId, 'lớp học');

    const classData = await classRepository.findById(classId);
    validateResourceExists(classData, 'class');

    return await classRepository.getStudentsByClass(classId);
  },
};

module.exports = classService;
