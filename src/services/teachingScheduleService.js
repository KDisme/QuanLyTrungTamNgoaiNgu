// services/teachingScheduleService.js
// Logic nghiệp vụ cho TeachingSchedule - Business Logic Layer

const teachingScheduleRepository = require('../repositories/teachingScheduleRepository');
const teacherRepository = require('../repositories/teacherRepository');
const classRepository = require('../repositories/classRepository');
const { ApiError, NotFoundException, ConflictException } = require('../exceptions');
const { validateId, validateResourceExists } = require('../validators/commonValidators');
const { validateCreateTeachingScheduleData, validateUpdateTeachingScheduleData } = require('../validators/teachingScheduleValidator');
const dayjs = require('dayjs');

const computeScheduleEndDate = (startDate, dayOfWeekArray, sessions) => {
  if (!startDate || !Array.isArray(dayOfWeekArray) || dayOfWeekArray.length === 0 || !sessions) {
    return startDate;
  }

  const sortedDays = [...new Set(dayOfWeekArray)].sort((a, b) => a - b);
  const classStart = dayjs(startDate);
  if (!classStart.isValid()) {
    return startDate;
  }

  const startDow = classStart.day();
  let firstDow = sortedDays.find((dow) => dow >= startDow);
  let current = classStart;

  if (firstDow === undefined) {
    firstDow = sortedDays[0];
    current = classStart.add(7 - startDow + firstDow, 'day');
  } else {
    current = classStart.add(firstDow - startDow, 'day');
  }

  let index = sortedDays.indexOf(firstDow);
  let lastSessionDate = current;

  for (let i = 1; i < sessions; i += 1) {
    if (index + 1 < sortedDays.length) {
      const delta = sortedDays[index + 1] - sortedDays[index];
      lastSessionDate = lastSessionDate.add(delta, 'day');
      index += 1;
    } else {
      const delta = 7 - sortedDays[index] + sortedDays[0];
      lastSessionDate = lastSessionDate.add(delta, 'day');
      index = 0;
    }
  }

  return lastSessionDate.format('YYYY-MM-DD');
};

const expandSchedulesToOccurrences = (schedules, classStartDate, classEndDate) => {
  const occurrences = [];
  const classStart = dayjs(classStartDate);
  const classEnd = dayjs(classEndDate);

  if (!classStart.isValid() || !classEnd.isValid() || classStart.isAfter(classEnd)) {
    return occurrences;
  }

  let current = classStart.startOf('day');
  while (!current.isAfter(classEnd, 'day')) {
    const currentDow = current.day();
    schedules.forEach((schedule) => {
      if (schedule.day_of_week === currentDow) {
        occurrences.push({
          ...schedule,
          teaching_date: current.format('YYYY-MM-DD'),
        });
      }
    });
    current = current.add(1, 'day');
  }

  return occurrences.sort((a, b) => {
    if (a.teaching_date !== b.teaching_date) {
      return a.teaching_date.localeCompare(b.teaching_date);
    }
    return a.start_time.localeCompare(b.start_time);
  });
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

    if (!classData.teacher_id) {
      throw new ApiError(422, 'Lớp học chưa có giáo viên được gán', 'CLASS_TEACHER_NOT_ASSIGNED');
    }

    if (!classData.start_date || !classData.end_date) {
      throw new ApiError(422, 'Lớp học phải có ngày bắt đầu và ngày kết thúc', 'CLASS_DATE_RANGE_REQUIRED');
    }

    let classStart = dayjs(classData.start_date);
    let classEnd = dayjs(classData.end_date);

    if (!classStart.isValid() || !classEnd.isValid() || classStart.isAfter(classEnd)) {
      throw new ApiError(422, 'Ngày bắt đầu của lớp học phải trước ngày kết thúc', 'INVALID_CLASS_DATE_RANGE');
    }

    const computedEndDate = computeScheduleEndDate(classData.start_date, data.day_of_week, classData.sessions);
    if (dayjs(computedEndDate).isAfter(classEnd)) {
      await classRepository.update(classData.id, { end_date: computedEndDate });
      classEnd = dayjs(computedEndDate);
    }

    const teacherId = classData.teacher_id;
    const createdSchedules = [];

    for (const dayOfWeek of data.day_of_week) {
      const teacherConflict = await teachingScheduleRepository.checkScheduleConflict(
        teacherId,
        dayOfWeek,
        data.start_time,
        data.end_time,
        classStart.format('YYYY-MM-DD'),
        classEnd.format('YYYY-MM-DD')
      );
      if (teacherConflict) {
        throw new ConflictException(
          `Giáo viên đã có lịch giảng dạy vào thứ ${dayOfWeek}`,
          'TEACHER_SCHEDULE_CONFLICT'
        );
      }

      const roomConflict = await teachingScheduleRepository.checkRoomConflict(
        data.room,
        dayOfWeek,
        data.start_time,
        data.end_time,
        classStart.format('YYYY-MM-DD'),
        classEnd.format('YYYY-MM-DD')
      );
      if (roomConflict) {
        throw new ConflictException(
          `Phòng học đã được sử dụng vào thứ ${dayOfWeek}`,
          'ROOM_CONFLICT'
        );
      }

      const schedule = await teachingScheduleRepository.create({
        class_id: data.class_id,
        teacher_id: teacherId,
        day_of_week: dayOfWeek,
        start_time: data.start_time,
        end_time: data.end_time,
        room: data.room,
      });
      createdSchedules.push(schedule);
    }

    return expandSchedulesToOccurrences(createdSchedules, classStart.format('YYYY-MM-DD'), classEnd.format('YYYY-MM-DD'));
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

    const classSchedules = await teachingScheduleRepository.findByClassId(class_id);
    return expandSchedulesToOccurrences(classSchedules, classData.start_date, classData.end_date);
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
      const dayOfWeek = data.day_of_week !== undefined ? data.day_of_week : existing.day_of_week;
      const startTime = data.start_time !== undefined ? data.start_time : existing.start_time;
      const endTime = data.end_time !== undefined ? data.end_time : existing.end_time;
      const room = data.room !== undefined ? data.room : existing.room;

      const classData = await classRepository.findById(data.class_id !== undefined ? data.class_id : existing.class_id);
      validateResourceExists(classData, 'class');

      const classStart = dayjs(classData.start_date);
      const classEnd = dayjs(classData.end_date);

      // Kiểm tra xung đột lịch giáo viên
      const teacherConflict = await teachingScheduleRepository.checkScheduleConflict(
        teacherId,
        dayOfWeek,
        startTime,
        endTime,
        classStart.format('YYYY-MM-DD'),
        classEnd.format('YYYY-MM-DD'),
        id
      );
      if (teacherConflict) {
        throw new ConflictException('Giáo viên đã có lịch giảng dạy trùng lặp', 'TEACHER_SCHEDULE_CONFLICT');
      }

      // Kiểm tra xung đột phòng học
      const roomConflict = await teachingScheduleRepository.checkRoomConflict(
        room,
        dayOfWeek,
        startTime,
        endTime,
        classStart.format('YYYY-MM-DD'),
        classEnd.format('YYYY-MM-DD'),
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
