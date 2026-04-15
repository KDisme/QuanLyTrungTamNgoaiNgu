// validators/teachingScheduleValidator.js
// Validation logic cho TeachingSchedule

const { ValidationException } = require('../exceptions');

/**
 * Validate dữ liệu tạo lịch giảng dạy mới
 * @throws {ValidationException} Nếu dữ liệu không hợp lệ
 */
function validateCreateTeachingScheduleData(data) {
  const errors = [];

  // class_id là bắt buộc
  if (!data.class_id || typeof data.class_id !== 'number') {
    errors.push('class_id là bắt buộc và phải là số');
  }

  // day_of_week là bắt buộc - phải chọn từ 1 đến 7 ngày trong tuần
  if (!Array.isArray(data.day_of_week) || data.day_of_week.length === 0 || data.day_of_week.length > 7) {
    errors.push('Phải chọn từ 1 đến 7 ngày trong tuần (0=Chủ nhật, 1=Thứ 2, ..., 6=Thứ 7)');
  } else {
    const invalidDay = data.day_of_week.find(d => typeof d !== 'number' || d < 0 || d > 6);
    if (invalidDay !== undefined) {
      errors.push('Các ngày trong tuần phải là số từ 0 đến 6');
    }
    // Kiểm tra không có trùng lặp
    const uniqueDays = new Set(data.day_of_week);
    if (uniqueDays.size !== data.day_of_week.length) {
      errors.push('Các ngày trong tuần không được trùng nhau');
    }
  }

  // Kiểm tra thời gian hợp lệ (end_time > start_time)
  if (data.start_time && data.end_time) {
    const start = new Date(`1970-01-01T${data.start_time}:00`);
    const end = new Date(`1970-01-01T${data.end_time}:00`);
    if (end <= start) {
      errors.push('Thời gian kết thúc phải sau thời gian bắt đầu');
    }
  }

  if (errors.length > 0) {
    throw new ValidationException('Dữ liệu không hợp lệ: ' + errors.join(', '));
  }
}

/**
 * Validate dữ liệu cập nhật lịch giảng dạy
 * @throws {ValidationException} Nếu dữ liệu không hợp lệ
 */
function validateUpdateTeachingScheduleData(data) {
  const errors = [];

  // Kiểm tra thời gian hợp lệ nếu có cập nhật
  if ((data.start_time || data.end_time) && data.start_time !== undefined && data.end_time !== undefined) {
    const start = new Date(`1970-01-01T${data.start_time}:00`);
    const end = new Date(`1970-01-01T${data.end_time}:00`);
    if (end <= start) {
      errors.push('Thời gian kết thúc phải sau thời gian bắt đầu');
    }
  }

  // Kiểm tra day_of_week nếu có cập nhật
  if (data.day_of_week !== undefined) {
    if (typeof data.day_of_week !== 'number' || data.day_of_week < 0 || data.day_of_week > 6) {
      errors.push('day_of_week khi cập nhật phải là số từ 0 đến 6');
    }
  }

  if (errors.length > 0) {
    throw new ValidationException('Dữ liệu không hợp lệ: ' + errors.join(', '));
  }
}

module.exports = {
  validateCreateTeachingScheduleData,
  validateUpdateTeachingScheduleData,
};