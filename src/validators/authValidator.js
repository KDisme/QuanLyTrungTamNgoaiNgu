/**
 * Auth Validators
 * Validators cụ thể cho domain Authentication
 */

const {
  validateRequiredFields,
  validateStringLength,
  validateEmail,
} = require('./commonValidators');

/**
 * Validate dữ liệu đăng ký
 * @param {Object} data - Dữ liệu đăng ký { name, email, password }
 * @throws {ApiError} Nếu dữ liệu không hợp lệ
 */
const validateRegisterData = (data) => {
  // Validate required fields
  validateRequiredFields(data, ['name', 'email', 'password']);

  // Validate string lengths
  validateStringLength(data.name, 2, 100, 'Tên người dùng');
  validateStringLength(data.password, 6, 100, 'Mật khẩu');

  // Validate email
  validateEmail(data.email);

  return true;
};

/**
 * Validate dữ liệu đăng nhập
 * @param {Object} data - Dữ liệu đăng nhập { email, password }
 * @throws {ApiError} Nếu dữ liệu không hợp lệ
 */
const validateLoginData = (data) => {
  // Validate required fields
  validateRequiredFields(data, ['email', 'password']);

  // Validate email
  validateEmail(data.email);

  return true;
};

/**
 * Validate dữ liệu thay đổi mật khẩu
 * @param {Object} data - Dữ liệu { oldPassword, newPassword }
 * @throws {ApiError} Nếu dữ liệu không hợp lệ
 */
const validateChangePasswordData = (data) => {
  // Validate required fields
  validateRequiredFields(data, ['oldPassword', 'newPassword']);

  // Validate password lengths
  validateStringLength(data.oldPassword, 6, 100, 'Mật khẩu cũ');
  validateStringLength(data.newPassword, 6, 100, 'Mật khẩu mới');

  return true;
};

module.exports = {
  validateRegisterData,
  validateLoginData,
  validateChangePasswordData,
};
