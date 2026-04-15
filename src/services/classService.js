// services/classService.js
// Logic nghiệp vụ cho Class - Business Logic Layer

const classRepository = require('../repositories/classRepository');
const teacherRepository = require('../repositories/teacherRepository');
const teachingScheduleService = require('./teachingScheduleService');
const { ApiError, NotFoundException } = require('../exceptions');
const { ERROR_CODES, ERROR_MESSAGES } = require('../constants/errorCodes');
const { validateId, validateResourceExists } = require('../validators/commonValidators');
const { validateCreateClassData, validateUpdateClassData } = require('../validators/classValidator');

const dayjs = require('dayjs');

const normalizeDate = (dateInput) => {
  const date = dayjs(dateInput);
  if (!date.isValid()) return null;
  return date.format('YYYY-MM-DD');
};

const getTeachingDates = (startDate, dayOfWeekArray, totalSessions) => {
  const result = [];
  if (!startDate || !Array.isArray(dayOfWeekArray) || dayOfWeekArray.length === 0 || !totalSessions || totalSessions <= 0) {
    return result;
  }

  const sortedDays = [...new Set(dayOfWeekArray)].sort((a, b) => a - b);
  const classStart = dayjs(startDate);
  if (!classStart.isValid()) {
    return result;
  }

  let current = classStart;
  const startDow = classStart.day();
  let index = sortedDays.findIndex((dow) => dow >= startDow);

  if (index === -1) {
    index = 0;
    current = classStart.add(7 - startDow + sortedDays[0], 'day');
  } else {
    current = classStart.add(sortedDays[index] - startDow, 'day');
  }

  for (let i = 0; i < totalSessions; i += 1) {
    result.push(current.format('YYYY-MM-DD'));

    if (i === totalSessions - 1) break;

    if (index + 1 < sortedDays.length) {
      const delta = sortedDays[index + 1] - sortedDays[index];
      current = current.add(delta, 'day');
      index += 1;
    } else {
      const delta = 7 - sortedDays[index] + sortedDays[0];
      current = current.add(delta, 'day');
      index = 0;
    }
  }

  return result;
};

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

    const normalizedStartDate = normalizeDate(data.start_date);
    const payload = {
      ...data,
      start_date: normalizedStartDate,
      sessions_per_week: data.sessions_per_week,
    };

    const createdClass = await classRepository.create(payload);

    if (Array.isArray(data.day_of_week) && data.day_of_week.length > 0) {
      const schedules = await teachingScheduleService.createRecurringTeachingSchedules({
        class_id: createdClass.id,
        teacher_id: data.teacher_id,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        end_time: data.end_time,
        room: data.room,
      });

      const lastScheduleDate = schedules.length > 0 ? schedules[schedules.length - 1].teaching_date : null;
      if (lastScheduleDate) {
        await classRepository.update(createdClass.id, { end_date: lastScheduleDate });
      }
    }

    return createdClass;
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

    const payload = {
      ...data,
      start_date: data.start_date !== undefined ? normalizeDate(data.start_date) : existing.start_date,
      sessions_per_week: data.sessions_per_week !== undefined ? data.sessions_per_week : existing.sessions_per_week,
    };

    return await classRepository.update(id, payload);
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
