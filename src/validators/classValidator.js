/**
 * Class Validators
 * Validators cụ thể cho domain Class
 */

const {
  validateId,
  validateRequiredFields,
  validateResourceExists,
  validateDateRange,
  validateEndDateNotInPast,
  validateCapacity,
  validateSessions,
} = require('./commonValidators');

/**
 * Validate dữ liệu tạo lớp học
 * @param {Object} data - Dữ liệu lớp học
 * @throws {ApiError} Nếu dữ liệu không hợp lệ
 */
const validateCreateClassData = (data) => {
  const { name, start_date, end_date, capacity, sessions } = data;

  // Validate required fields
  validateRequiredFields(data, ['name', 'start_date', 'end_date', 'capacity', 'sessions']);

  // Validate dates
  validateDateRange(start_date, end_date);
  validateEndDateNotInPast(end_date);

  // Validate capacity & sessions
  validateCapacity(capacity);
  validateSessions(sessions);

  return true;
};

/**
 * Validate dữ liệu cập nhật lớp học
 * @param {Object} currentClass - Dữ liệu lớp học hiện tại
 * @param {Object} updateData - Dữ liệu cập nhật
 * @throws {ApiError} Nếu dữ liệu không hợp lệ
 */
const validateUpdateClassData = (currentClass, updateData) => {
  const startDate = updateData.start_date || currentClass.start_date;
  const endDate = updateData.end_date || currentClass.end_date;

  // Validate dates nếu có thay đổi
  if (updateData.start_date || updateData.end_date) {
    validateDateRange(startDate, endDate);
  }

  // Validate capacity & sessions nếu có thay đổi
  if (updateData.capacity !== undefined) {
    validateCapacity(updateData.capacity);
  }

  if (updateData.sessions !== undefined) {
    validateSessions(updateData.sessions);
  }

  return true;
};

module.exports = {
  validateCreateClassData,
  validateUpdateClassData,
};
