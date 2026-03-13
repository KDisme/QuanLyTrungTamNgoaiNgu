// validators/teachingScheduleValidator.js
// Validation logic cho TeachingSchedule

const { ValidationException } = require('../exceptions');

/**
 * Validate dữ liệu tạo lịch giảng dạy mới
 * @throws {ValidationException} Nếu dữ liệu không hợp lệ
 */
function validateCreateTeachingScheduleData(data) {
  const errors = [];

  // Kiểm tra thời gian hợp lệ (end_time > start_time)
  if (data.start_time && data.end_time) {
    const start = new Date(`1970-01-01T${data.start_time}:00`);
    const end = new Date(`1970-01-01T${data.end_time}:00`);
    if (end <= start) {
      errors.push('Thời gian kết thúc phải sau thời gian bắt đầu');
    }
  }

  // Kiểm tra ngày giảng dạy không phải quá khứ (tùy chọn)
  if (data.teaching_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const teachingDate = new Date(data.teaching_date);
    if (teachingDate < today) {
      errors.push('Ngày giảng dạy không được là ngày trong quá khứ');
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

  // Kiểm tra ngày giảng dạy không phải quá khứ nếu có cập nhật
  if (data.teaching_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const teachingDate = new Date(data.teaching_date);
    if (teachingDate < today) {
      errors.push('Ngày giảng dạy không được là ngày trong quá khứ');
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