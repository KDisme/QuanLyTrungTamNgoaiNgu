/**
 * Class Validators
 * Validators cụ thể cho domain Class
 */

const { ApiError } = require('../exceptions');
const {
  validateRequiredFields,
  validateCapacity,
  validateSessions,
  validateSessionsPerWeek,
} = require('./commonValidators');

/**
 * Validate dữ liệu tạo lớp học
 * @param {Object} data - Dữ liệu lớp học
 * @throws {ApiError} Nếu dữ liệu không hợp lệ
 */
const validateCreateClassData = (data) => {
  const { name, start_date, capacity, sessions, sessions_per_week, day_of_week, start_time, end_time, room } = data;

  // Validate required fields
  validateRequiredFields(data, ['name', 'start_date', 'capacity', 'sessions', 'sessions_per_week']);

  // Validate capacity & sessions
  validateCapacity(capacity);
  validateSessions(sessions);
  validateSessionsPerWeek(sessions_per_week);

  if (sessions_per_week > sessions) {
    throw new ApiError(
      422,
      'Số buổi trong tuần không được lớn hơn tổng số buổi học',
      'INVALID_WEEKLY_SESSIONS'
    );
  }

  if (day_of_week !== undefined) {
    if (!Array.isArray(day_of_week) || day_of_week.length === 0 || day_of_week.length > 7) {
      throw new ApiError(
        422,
        'Phải chọn từ 1 đến 7 ngày trong tuần',
        'INVALID_WEEK_DAYS'
      );
    }

    const invalidDay = day_of_week.find(d => typeof d !== 'number' || d < 0 || d > 6);
    if (invalidDay !== undefined) {
      throw new ApiError(
        422,
        'Các ngày trong tuần phải là số từ 0 đến 6',
        'INVALID_WEEK_DAY_VALUES'
      );
    }

    const uniqueDays = new Set(day_of_week);
    if (uniqueDays.size !== day_of_week.length) {
      throw new ApiError(
        422,
        'Các ngày trong tuần không được trùng nhau',
        'DUPLICATED_WEEK_DAYS'
      );
    }

    if (day_of_week.length !== sessions_per_week) {
      throw new ApiError(
        422,
        'Số ngày trong tuần phải trùng với số buổi trong tuần của lớp học',
        'INVALID_WEEKLY_SCHEDULE'
      );
    }

    if (!start_time || !end_time) {
      throw new ApiError(
        422,
        'Phải cung cấp cả thời gian bắt đầu và kết thúc khi tạo lịch học theo ngày trong tuần',
        'MISSING_SCHEDULE_TIMES'
      );
    }

    const start = new Date(`1970-01-01T${start_time}:00`);
    const end = new Date(`1970-01-01T${end_time}:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      throw new ApiError(
        422,
        'Thời gian kết thúc phải sau thời gian bắt đầu',
        'INVALID_SCHEDULE_TIME'
      );
    }

    if (!room) {
      throw new ApiError(
        422,
        'Phải cung cấp phòng học khi tạo lịch học theo ngày trong tuần',
        'MISSING_SCHEDULE_ROOM'
      );
    }
  }

  return true;
};

/**
 * Validate dữ liệu cập nhật lớp học
 * @param {Object} currentClass - Dữ liệu lớp học hiện tại
 * @param {Object} updateData - Dữ liệu cập nhật
 * @throws {ApiError} Nếu dữ liệu không hợp lệ
 */
const validateUpdateClassData = (currentClass, updateData) => {
  if (updateData.capacity !== undefined) {
    validateCapacity(updateData.capacity);
  }

  if (updateData.sessions !== undefined) {
    validateSessions(updateData.sessions);
  }

  if (updateData.sessions_per_week !== undefined) {
    validateSessionsPerWeek(updateData.sessions_per_week);
  }

  const effectiveSessions = updateData.sessions !== undefined ? updateData.sessions : currentClass.sessions;
  const effectiveWeekly = updateData.sessions_per_week !== undefined ? updateData.sessions_per_week : currentClass.sessions_per_week;

  if (effectiveWeekly > effectiveSessions) {
    throw new ApiError(
      422,
      'Số buổi trong tuần không được lớn hơn tổng số buổi học',
      'INVALID_WEEKLY_SESSIONS'
    );
  }

  return true;
};

module.exports = {
  validateCreateClassData,
  validateUpdateClassData,
};
