// services/teachingScheduleService.js
// Logic nghiệp vụ cho TeachingSchedule - Business Logic Layer

const teachingScheduleRepository = require('../repositories/teachingScheduleRepository');
const teacherRepository = require('../repositories/teacherRepository');
const classRepository = require('../repositories/classRepository');
const { ApiError, NotFoundException, ConflictException } = require('../exceptions');
const { validateId, validateResourceExists } = require('../validators/commonValidators');
const { validateCreateTeachingScheduleData, validateUpdateTeachingScheduleData } = require('../validators/teachingScheduleValidator');
const dayjs = require('dayjs');


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
 * TeachingSchedule Service
 * Xử lý toàn bộ logic nghiệp vụ cho lịch giảng dạy
 * Thực hiện validation, kiểm tra ràng buộc, gọi repository
 */
const teachingScheduleService = {
  /**
   * Tạo lịch giảng dạy mới
   * Kiểm tra giáo viên và lớp tồn tại, kiểm tra xung đột lịch
   * @throws {NotFoundException} Nếu giáo viên hoặc lớp không tồn tại
   * @throws {ConflictException} Nếu có xung đột lịch
   * @throws {ApiError} Nếu dữ liệu không hợp lệ
   */
  async createRecurringTeachingSchedules(data) {
    // Validate dữ liệu
    validateCreateTeachingScheduleData(data);

    const classData = await classRepository.findById(data.class_id);
    validateResourceExists(classData, 'class');

    let teacherId = classData.teacher_id;
    if (data.teacher_id !== undefined) {
      const teacher = await teacherRepository.findById(data.teacher_id);
      validateResourceExists(teacher, 'teacher');
      teacherId = data.teacher_id;
    }

    if (!teacherId) {
      throw new ApiError(422, 'Lớp học phải có giáo viên được gán hoặc teacher_id phải được cung cấp', 'CLASS_TEACHER_NOT_ASSIGNED');
    }

    if (!classData.start_date) {
      throw new ApiError(422, 'Lớp học phải có ngày bắt đầu', 'CLASS_START_DATE_REQUIRED');
    }

    if (classData.sessions_per_week === undefined || classData.sessions_per_week === null) {
      throw new ApiError(422, 'Lớp học phải có số buổi trong tuần', 'CLASS_WEEKLY_SESSIONS_REQUIRED');
    }

    if (Number(classData.sessions_per_week) !== data.day_of_week.length) {
      throw new ApiError(
        422,
        'Số buổi trong tuần phải trùng với số ngày trong tuần được chọn trong lịch học',
        'INVALID_WEEKLY_SCHEDULE'
      );
    }

    let classStart = dayjs(classData.start_date);
    if (!classStart.isValid()) {
      throw new ApiError(422, 'Ngày bắt đầu của lớp học không hợp lệ', 'INVALID_CLASS_START_DATE');
    }

    if (classData.sessions !== undefined && Number(classData.sessions) < Number(classData.sessions_per_week)) {
      throw new ApiError(
        422,
        'Tổng số buổi phải lớn hơn hoặc bằng số buổi trong tuần',
        'INVALID_SESSION_COUNTS'
      );
    }

    const createdSchedules = [];
    const teachingDates = getTeachingDates(classStart.format('YYYY-MM-DD'), data.day_of_week, Number(classData.sessions));

    if (classData.sessions !== undefined && Number(classData.sessions) !== teachingDates.length) {
      throw new ApiError(
        422,
        `Số buổi học của lớp (${classData.sessions}) không trùng với tổng số lịch học (${teachingDates.length})`,
        'CLASS_SCHEDULE_MISMATCH'
      );
    }

    const endDate = teachingDates.length > 0 ? teachingDates[teachingDates.length - 1] : null;

    for (const teachingDate of teachingDates) {
      const dayOfWeek = dayjs(teachingDate).day();

      const teacherConflict = await teachingScheduleRepository.checkScheduleConflict(
        teacherId,
        teachingDate,
        data.start_time,
        data.end_time
      );
      if (teacherConflict) {
        throw new ConflictException(
          `Giáo viên đã có lịch giảng dạy vào ngày ${teachingDate}`,
          'TEACHER_SCHEDULE_CONFLICT'
        );
      }

      const roomConflict = await teachingScheduleRepository.checkRoomConflict(
        data.room,
        teachingDate,
        data.start_time,
        data.end_time
      );
      if (roomConflict) {
        throw new ConflictException(
          `Phòng học đã được sử dụng vào ngày ${teachingDate}`,
          'ROOM_CONFLICT'
        );
      }

      const schedule = await teachingScheduleRepository.create({
        class_id: data.class_id,
        teacher_id: teacherId,
        day_of_week: dayOfWeek,
        teaching_date: teachingDate,
        start_time: data.start_time,
        end_time: data.end_time,
        room: data.room,
      });
      createdSchedules.push(schedule);
    }

    if (endDate) {
      await classRepository.update(classData.id, { end_date: endDate });
    }

    return createdSchedules;
  },

  async createTeachingSchedule(data) {
    return await this.createRecurringTeachingSchedules(data);
  },

  /**
   * Lấy thông tin lịch giảng dạy theo ID
   * @throws {NotFoundException} Nếu lịch giảng dạy không tồn tại
   */
  async getTeachingScheduleById(id) {
    validateId(id, 'lịch giảng dạy');

    const schedule = await teachingScheduleRepository.findById(id);
    validateResourceExists(schedule, 'teachingSchedule');

    return schedule;
  },

  /**
   * Lấy toàn bộ danh sách lịch giảng dạy
   */
  async getAllTeachingSchedules() {
    return await teachingScheduleRepository.findAll();
  },

  /**
   * Lấy lịch giảng dạy theo giáo viên
   * @throws {NotFoundException} Nếu giáo viên không tồn tại
   */
  async getTeachingSchedulesByTeacher(teacher_id) {
    validateId(teacher_id, 'giáo viên');

    const teacher = await teacherRepository.findById(teacher_id);
    validateResourceExists(teacher, 'teacher');

    return await teachingScheduleRepository.findByTeacherId(teacher_id);
  },

  /**
   * Lấy lịch giảng dạy theo lớp học
   * @throws {NotFoundException} Nếu lớp học không tồn tại
   */
  async getTeachingSchedulesByClass(class_id) {
    validateId(class_id, 'lớp học');

    const classData = await classRepository.findById(class_id);
    validateResourceExists(classData, 'class');

    return await teachingScheduleRepository.findByClassId(class_id);
  },

  /**
   * Lấy lịch giảng dạy theo ngày
   */
  async getTeachingSchedulesByDate(teaching_date) {
    // Validate date format (assuming YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(teaching_date)) {
      throw new ApiError(400, 'Định dạng ngày không hợp lệ. Sử dụng YYYY-MM-DD', 'INVALID_DATE_FORMAT');
    }

    return await teachingScheduleRepository.findByDate(teaching_date);
  },

  /**
   * Cập nhật thông tin lịch giảng dạy
   * Kiểm tra xung đột lịch nếu thay đổi thời gian hoặc giáo viên/phòng
   * @throws {NotFoundException} Nếu lịch giảng dạy không tồn tại
   * @throws {ConflictException} Nếu có xung đột lịch
   */
  async updateTeachingSchedule(id, data) {
    validateId(id, 'lịch giảng dạy');

    const existing = await teachingScheduleRepository.findById(id);
    validateResourceExists(existing, 'teachingSchedule');

    // Validate dữ liệu cập nhật
    validateUpdateTeachingScheduleData(data);

    // Kiểm tra giáo viên tồn tại nếu có thay đổi
    if (data.teacher_id !== undefined) {
      const teacher = await teacherRepository.findById(data.teacher_id);
      validateResourceExists(teacher, 'teacher');
    }

    // Kiểm tra lớp học tồn tại nếu có thay đổi
    if (data.class_id !== undefined) {
      const classData = await classRepository.findById(data.class_id);
      validateResourceExists(classData, 'class');
    }

    // Nếu có thay đổi thời gian, giáo viên hoặc phòng, kiểm tra xung đột
    const hasTimeChange = data.day_of_week !== undefined || data.start_time !== undefined || data.end_time !== undefined;
    const hasTeacherChange = data.teacher_id !== undefined;
    const hasRoomChange = data.room !== undefined;

    if (hasTimeChange || hasTeacherChange || hasRoomChange) {
      const teacherId = data.teacher_id !== undefined ? data.teacher_id : existing.teacher_id;
      const teachingDate = data.teaching_date !== undefined ? data.teaching_date : existing.teaching_date;
      const startTime = data.start_time !== undefined ? data.start_time : existing.start_time;
      const endTime = data.end_time !== undefined ? data.end_time : existing.end_time;
      const room = data.room !== undefined ? data.room : existing.room;

      const classData = await classRepository.findById(data.class_id !== undefined ? data.class_id : existing.class_id);
      validateResourceExists(classData, 'class');

      // Kiểm tra xung đột lịch giáo viên
      const teacherConflict = await teachingScheduleRepository.checkScheduleConflict(
        teacherId,
        teachingDate,
        startTime,
        endTime,
        id
      );
      if (teacherConflict) {
        throw new ConflictException('Giáo viên đã có lịch giảng dạy trùng lặp', 'TEACHER_SCHEDULE_CONFLICT');
      }

      // Kiểm tra xung đột phòng học
      const roomConflict = await teachingScheduleRepository.checkRoomConflict(
        room,
        teachingDate,
        startTime,
        endTime,
        id
      );
      if (roomConflict) {
        throw new ConflictException('Phòng học đã được sử dụng trùng lặp', 'ROOM_CONFLICT');
      }
    }

    return await teachingScheduleRepository.update(id, data);
  },

  /**
   * Xóa lịch giảng dạy
   * @throws {NotFoundException} Nếu lịch giảng dạy không tồn tại
   */
  async deleteTeachingSchedule(id) {
    validateId(id, 'lịch giảng dạy');

    const schedule = await teachingScheduleRepository.findById(id);
    validateResourceExists(schedule, 'teachingSchedule');

    return await teachingScheduleRepository.delete(id);
  },
  async createBulkSchedule(data) {
    return await this.createRecurringTeachingSchedules(data);
  },

    async getAllSchedules() {
        return await teachingScheduleRepository.findAll();
    },

    async deleteSchedule(id) {
        return await teachingScheduleRepository.delete(id);
    }

};

module.exports = teachingScheduleService;
