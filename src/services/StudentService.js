// services/studentService.js
// Logic nghiệp vụ cho Student - Business Logic Layer

const studentRepository = require('../repositories/studentRepository');
const { ApiError, NotFoundException, ConflictException } = require('../exceptions');
const { ERROR_CODES } = require('../constants/errorCodes');
const { validateId, validateResourceExists, validateNoDuplicateExcludeSelf } = require('../validators/commonValidators');
const { validateCreateStudentData, validateUpdateStudentData } = require('../validators/studentValidator');
const { STUDENT_STATUS } = require('../constants/studentStatus');

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

    // Kiểm tra trùng citizen_id (chỉ cho phép trùng khi học viên cũ đã hoàn thành)
    const existingCitizen = await studentRepository.findByCitizenId(data.citizen_id);
    if (existingCitizen && existingCitizen.status !== STUDENT_STATUS.COMPLETED) {
      throw new ConflictException('CMND/CCCD đã tồn tại', 'CITIZEN_ID_DUPLICATE');
    }

    // Cập nhật trạng thái học viên nếu lớp đã kết thúc (tránh cảnh báo trùng email với học viên đã hoàn thành)
    await studentRepository.completeStudentsForEndedClasses();

    // Kiểm tra trùng email với học viên chưa hoàn thành
    const existingActiveEmail = await studentRepository.findActiveByEmail(data.email);
    if (existingActiveEmail) {
      throw new ConflictException('Email đã được sử dụng bởi học viên đang học', ERROR_CODES.STUDENT_EMAIL_DUPLICATE);
    }

    // Mặc định trạng thái khi tạo là đang học
    return await studentRepository.create({ ...data, status: STUDENT_STATUS.ENROLLED });
  },

  /**
   * Lấy thông tin học viên theo ID
   * @throws {NotFoundException} Nếu học viên không tồn tại
   */
  async getStudentById(id) {
    validateId(id, 'học viên');

    // Auto-update trạng thái khi lớp học đã kết thúc
    await studentRepository.completeStudentsForEndedClasses();

    const student = await studentRepository.findById(id);
    validateResourceExists(student, 'student');
    
    return student;
  },

  /**
   * Lấy toàn bộ danh sách học viên
   */
  async getAllStudents() {
    // Auto-update trạng thái khi lớp học đã kết thúc
    await studentRepository.completeStudentsForEndedClasses();

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

    // Nếu có citizen_id mới, kiểm tra trùng với học viên khác (chỉ cho phép trùng khi đã hoàn thành)
    if (data.citizen_id) {
      const duplicated = await studentRepository.findByCitizenId(data.citizen_id);
      if (duplicated && duplicated.id !== Number(id) && duplicated.status !== STUDENT_STATUS.COMPLETED) {
        throw new ConflictException('CMND/CCCD đã tồn tại', 'CITIZEN_ID_DUPLICATE');
      }
    }

    // Nếu có email mới, cập nhật trạng thái học viên đã hoàn thành trước khi kiểm tra trùng email
    // (một học viên cũ có thể vẫn còn status ENROLLED nếu chưa có yêu cầu gọi lại thuật toán cập nhật status).
    if (data.email) {
      await studentRepository.completeStudentsForEndedClasses();
      const existingActiveEmail = await studentRepository.findActiveByEmail(data.email);
      if (existingActiveEmail && existingActiveEmail.id !== Number(id)) {
        throw new ConflictException('Email đã được sử dụng bởi học viên đang học', ERROR_CODES.STUDENT_EMAIL_DUPLICATE);
      }
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
