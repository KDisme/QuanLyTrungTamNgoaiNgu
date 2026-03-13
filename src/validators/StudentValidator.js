/**
 * Student Validators
 * Validators cụ thể cho domain Student
 */

const {
  validateRequiredFields,
  validateResourceExists,
  validateStringLength,
  validateEmail,
  validateCitizenId,
  validateNoDuplicate,
  validateNoDuplicateExcludeSelf,
} = require('./commonValidators');

/**
 * Validate dữ liệu tạo học viên
 * @param {Object} data - Dữ liệu học viên
 * @throws {ApiError} Nếu dữ liệu không hợp lệ
 */
const validateCreateStudentData = (data) => {
  // Validate required fields
  validateRequiredFields(data, ['name', 'email', 'birth_date', 'citizen_id']);

  // Validate string lengths
  validateStringLength(data.name, 2, 100, 'Tên học viên');

  // Validate email & citizen_id
  validateEmail(data.email);
  validateCitizenId(data.citizen_id);

  return true;
};

/**
 * Validate dữ liệu cập nhật học viên
 * @param {Object} updateData - Dữ liệu cập nhật
 * @throws {ApiError} Nếu dữ liệu không hợp lệ
 */
const validateUpdateStudentData = (updateData) => {
  // Validate string lengths nếu có thay đổi
  if (updateData.name) {
    validateStringLength(updateData.name, 2, 100, 'Tên học viên');
  }

  // Validate email nếu có thay đổi
  if (updateData.email) {
    validateEmail(updateData.email);
  }

  // Validate citizen_id nếu có thay đổi
  if (updateData.citizen_id) {
    validateCitizenId(updateData.citizen_id);
  }

  return true;
};

module.exports = {
  validateCreateStudentData,
  validateUpdateStudentData,
};
