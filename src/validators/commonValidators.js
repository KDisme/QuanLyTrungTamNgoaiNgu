/**
 * Common Validators
 * Các helper functions để validate các trường dữ liệu phổ biến
 * Tái sử dụng trong services để giảm code duplication
 */

const { ApiError, NotFoundException, ConflictException } = require('../exceptions');

/**
 * Validate ID có hợp lệ
 * @throws {ApiError} Nếu ID không hợp lệ
 */
const validateId = (id, resourceName = 'tài nguyên') => {
  if (!id || isNaN(id)) {
    throw new ApiError(422, `ID ${resourceName} là bắt buộc và phải là số`, 'INVALID_ID');
  }
  return true;
};

/**
 * Validate required fields
 * @param {Object} data - Dữ liệu cần validate
 * @param {Array} fields - Danh sách fields bắt buộc
 * @throws {ApiError} Nếu thiếu required fields
 */
const validateRequiredFields = (data, fields) => {
  const missingFields = fields.filter(field => !data[field]);
  if (missingFields.length > 0) {
    throw new ApiError(
      422,
      `Thiếu dữ liệu bắt buộc: ${missingFields.join(', ')}`,
      'MISSING_REQUIRED_FIELDS'
    );
  }
  return true;
};

/**
 * Validate resource tồn tại
 * @param {Object} resource - Resource cần check
 * @param {string} resourceType - Loại resource (class, student, teacher, user)
 * @throws {NotFoundException} Nếu resource không tồn tại
 */
const validateResourceExists = (resource, resourceType) => {
  if (!resource) {
    const messages = {
      class: 'Không tìm thấy lớp học',
      student: 'Không tìm thấy học viên',
      teacher: 'Không tìm thấy giáo viên',
      user: 'Không tìm thấy người dùng',
    };

    const errorCodes = {
      class: 'CLASS_NOT_FOUND',
      student: 'STUDENT_NOT_FOUND',
      teacher: 'TEACHER_NOT_FOUND',
      user: 'USER_NOT_FOUND',
    };

    const message = messages[resourceType] || `Không tìm thấy ${resourceType}`;
    const errorCode = errorCodes[resourceType] || 'RESOURCE_NOT_FOUND';

    throw new NotFoundException(message, errorCode);
  }
  return true;
};

/**
 * Validate dates hợp lệ
 * @param {Date|string} startDate - Ngày bắt đầu
 * @param {Date|string} endDate - Ngày kết thúc
 * @throws {ApiError} Nếu dates không hợp lệ
 */
const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    throw new ApiError(
      422,
      'Ngày bắt đầu phải trước ngày kết thúc',
      'INVALID_DATE_RANGE'
    );
  }

  return true;
};

/**
 * Validate end date không ở quá khứ
 * @param {Date|string} endDate - Ngày kết thúc
 * @throws {ApiError} Nếu end date ở quá khứ
 */
const validateEndDateNotInPast = (endDate) => {
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (end < today) {
    throw new ApiError(
      422,
      'Ngày kết thúc phải từ hôm nay trở đi',
      'END_DATE_IN_PAST'
    );
  }

  return true;
};

/**
 * Validate capacity > 0
 * @param {number} capacity - Sức chứa
 * @throws {ApiError} Nếu capacity không hợp lệ
 */
const validateCapacity = (capacity) => {
  if (capacity === undefined || capacity === null) {
    return true; // Optional field
  }

  if (capacity <= 0 || isNaN(capacity)) {
    throw new ApiError(
      422,
      'Sức chứa phải lớn hơn 0',
      'INVALID_CAPACITY'
    );
  }

  return true;
};

/**
 * Validate sessions > 0
 * @param {number} sessions - Số buổi học
 * @throws {ApiError} Nếu sessions không hợp lệ
 */
const validateSessions = (sessions) => {
  if (sessions === undefined || sessions === null) {
    return true; // Optional field
  }

  if (sessions <= 0 || isNaN(sessions)) {
    throw new ApiError(
      422,
      'Số buổi học phải lớn hơn 0',
      'INVALID_SESSIONS'
    );
  }

  return true;
};

/**
 * Validate string length
 * @param {string} value - Giá trị cần validate
 * @param {number} minLength - Độ dài tối thiểu
 * @param {number} maxLength - Độ dài tối đa
 * @param {string} fieldName - Tên field
 * @throws {ApiError} Nếu string không hợp lệ
 */
const validateStringLength = (value, minLength, maxLength, fieldName) => {
  if (!value) return true; // Optional field

  const length = value.trim().length;
  if (length < minLength || length > maxLength) {
    throw new ApiError(
      422,
      `${fieldName} phải từ ${minLength} đến ${maxLength} ký tự`,
      'INVALID_STRING_LENGTH'
    );
  }

  return true;
};

/**
 * Validate email format
 * @param {string} email - Email cần validate
 * @throws {ApiError} Nếu email không hợp lệ
 */
const validateEmail = (email) => {
  if (!email) return true; // Optional field

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(
      422,
      'Email không hợp lệ',
      'INVALID_EMAIL'
    );
  }

  return true;
};

/**
 * Validate phone number
 * @param {string} phone - Số điện thoại cần validate
 * @throws {ApiError} Nếu phone không hợp lệ
 */
const validatePhone = (phone) => {
  if (!phone) return true; // Optional field

  const phoneRegex = /^[0-9]{10,11}$/;
  if (!phoneRegex.test(phone.replace(/\s|-/g, ''))) {
    throw new ApiError(
      422,
      'Số điện thoại phải 10-11 chữ số',
      'INVALID_PHONE'
    );
  }

  return true;
};

/**
 * Validate citizen ID (CMND/CCCD)
 * @param {string} citizenId - CMND/CCCD cần validate
 * @throws {ApiError} Nếu citizen ID không hợp lệ
 */
const validateCitizenId = (citizenId) => {
  if (!citizenId) return true; // Optional field

  // CMND/CCCD phải 9 hoặc 12 số
  const citizenIdRegex = /^[0-9]{9}(?:[0-9]{3})?$/;
  if (!citizenIdRegex.test(citizenId.replace(/\s/g, ''))) {
    throw new ApiError(
      422,
      'CMND/CCCD phải 9 hoặc 12 chữ số',
      'INVALID_CITIZEN_ID'
    );
  }

  return true;
};

/**
 * Validate duplicate value
 * @param {any} existingValue - Giá trị đã tồn tại
 * @param {string} fieldName - Tên field
 * @throws {ConflictException} Nếu value bị trùng
 */
const validateNoDuplicate = (existingValue, fieldName) => {
  if (existingValue) {
    throw new ConflictException(
      `${fieldName} đã tồn tại`,
      `DUPLICATE_${fieldName.toUpperCase().replace(/\s/g, '_')}`
    );
  }

  return true;
};

/**
 * Validate duplicate value (excluding self)
 * @param {any} existingValue - Giá trị đã tồn tại
 * @param {number} currentId - ID hiện tại
 * @param {string} fieldName - Tên field
 * @throws {ConflictException} Nếu value bị trùng (và không phải của chính mình)
 */
const validateNoDuplicateExcludeSelf = (existingValue, currentId, fieldName) => {
  if (existingValue && existingValue.id != currentId) {
    throw new ConflictException(
      `${fieldName} đã tồn tại`,
      `DUPLICATE_${fieldName.toUpperCase().replace(/\s/g, '_')}`
    );
  }

  return true;
};

module.exports = {
  validateId,
  validateRequiredFields,
  validateResourceExists,
  validateDateRange,
  validateEndDateNotInPast,
  validateCapacity,
  validateSessions,
  validateStringLength,
  validateEmail,
  validatePhone,
  validateCitizenId,
  validateNoDuplicate,
  validateNoDuplicateExcludeSelf,
};
