// services/studentService.js
// Logic nghiệp vụ cho Student - Business Logic Layer

const studentRepository = require('../repositories/studentRepository');
const { ApiError, NotFoundException, ConflictException } = require('../exceptions');
const { validateId, validateResourceExists, validateNoDuplicateExcludeSelf } = require('../validators/commonValidators');
const { validateCreateStudentData, validateUpdateStudentData } = require('../validators/studentValidator');

/**
 * Student Service
 * Xử lý toàn bộ logic nghiệp vụ cho học viên
 * Thực hiện validation, kiểm tra ràng buộc, gọi repository
 */
const studentService = {
  /**
   * Tạo học viên mới
   * Kiểm tra CMND/CCCD không trùng
   * @throws {ConflictException} Nếu CMND/CCCD đã tồn tại
   * @throws {ApiError} Nếu dữ liệu không hợp lệ
   */
  async createStudent(data) {
    // Validate dữ liệu
    validateCreateStudentData(data);

    // Kiểm tra trùng citizen_id
    const existing = await studentRepository.findByCitizenId(data.citizen_id);
    if (existing) {
      throw new ConflictException('CMND/CCCD đã tồn tại', 'CITIZEN_ID_DUPLICATE');
    }

    return await studentRepository.create(data);
  },

  /**
   * Lấy thông tin học viên theo ID
   * @throws {NotFoundException} Nếu học viên không tồn tại
   */
  async getStudentById(id) {
    validateId(id, 'học viên');

    const student = await studentRepository.findById(id);
    validateResourceExists(student, 'student');
    
    return student;
  },

  /**
   * Lấy toàn bộ danh sách học viên
   */
  async getAllStudents() {
    return await studentRepository.findAll();
  },

  /**
   * Cập nhật thông tin học viên
   * Nếu cập nhật CMND/CCCD, kiểm tra không trùng với học viên khác
   * @throws {NotFoundException} Nếu học viên không tồn tại
   * @throws {ConflictException} Nếu CMND/CCCD mới đã tồn tại
   */
  async updateStudent(id, data) {
    validateId(id, 'học viên');

    const existing = await studentRepository.findById(id);
    validateResourceExists(existing, 'student');

    // Validate dữ liệu cập nhật
    validateUpdateStudentData(data);

    // Nếu có citizen_id mới, kiểm tra trùng (và không phải của chính mình)
    if (data.citizen_id) {
      const duplicated = await studentRepository.findByCitizenId(data.citizen_id);
      validateNoDuplicateExcludeSelf(duplicated, id, 'CMND/CCCD');
    }

    return await studentRepository.update(id, data);
  },

  /**
   * Xóa học viên
   * @throws {NotFoundException} Nếu học viên không tồn tại
   */
  async deleteStudent(id) {
    validateId(id, 'học viên');

    const student = await studentRepository.findById(id);
    validateResourceExists(student, 'student');

    return await studentRepository.delete(id);
  },

  /**
   * Gán sinh viên cho lớp học
   * @param {number} studentId - ID của sinh viên
   * @param {number} classId - ID của lớp
   * @throws {NotFoundException} Nếu sinh viên hoặc lớp không tồn tại
   */
  async assignStudentToClass(studentId, classId) {
    validateId(studentId, 'sinh viên');
    validateId(classId, 'lớp học');

    // Kiểm tra sinh viên tồn tại
    const student = await studentRepository.findById(studentId);
    validateResourceExists(student, 'student');

    // Kiểm tra lớp tồn tại
    const classRepository = require('../repositories/classRepository');
    const classData = await classRepository.findById(classId);
    validateResourceExists(classData, 'class');

    return await studentRepository.assignToClass(studentId, classId);
  },

  /**
   * Xóa sinh viên khỏi lớp học
   * @param {number} studentId - ID của sinh viên
   * @throws {NotFoundException} Nếu sinh viên không tồn tại
   */
  async removeStudentFromClass(studentId) {
    validateId(studentId, 'sinh viên');

    const student = await studentRepository.findById(studentId);
    validateResourceExists(student, 'student');

    return await studentRepository.removeFromClass(studentId);
  },
};

module.exports = studentService;
