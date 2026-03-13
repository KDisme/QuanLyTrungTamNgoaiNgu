/**
 * Teacher Validators
 * Validators cụ thể cho domain Teacher
 */

const {
  validateRequiredFields,
  validateStringLength,
  validateEmail,
  validatePhone,
} = require('./commonValidators');

/**
 * Validate dữ liệu tạo giáo viên
 * @param {Object} data - Dữ liệu giáo viên
 * @throws {ApiError} Nếu dữ liệu không hợp lệ
 */
const validateCreateTeacherData = (data) => {
  // Validate required fields
  validateRequiredFields(data, ['full_name', 'phone', 'email', 'date_of_birth']);

  // Validate string lengths
  validateStringLength(data.full_name, 2, 100, 'Tên giáo viên');

  // Validate email & phone
  validateEmail(data.email);
  validatePhone(data.phone);

  return true;
};

/**
 * Validate dữ liệu cập nhật giáo viên
 * @param {Object} updateData - Dữ liệu cập nhật
 * @throws {ApiError} Nếu dữ liệu không hợp lệ
 */
const validateUpdateTeacherData = (updateData) => {
  // Validate string lengths nếu có thay đổi
  if (updateData.full_name) {
    validateStringLength(updateData.full_name, 2, 100, 'Tên giáo viên');
  }

  // Validate email nếu có thay đổi
  if (updateData.email) {
    validateEmail(updateData.email);
  }

  // Validate phone nếu có thay đổi
  if (updateData.phone) {
    validatePhone(updateData.phone);
  }

  return true;
};

module.exports = {
  validateCreateTeacherData,
  validateUpdateTeacherData,
};
