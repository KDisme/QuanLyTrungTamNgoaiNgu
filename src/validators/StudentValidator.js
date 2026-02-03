class StudentValidator {
  /**
   * Kiểm tra dữ liệu tạo sinh viên
   * @param {Object} data - Dữ liệu cần kiểm tra
   * @returns {Object} - Kết quả kiểm tra {valid: boolean, errors: []}
   */
  validateCreateStudent(data) {
    const errors = [];

    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      errors.push('Name is required and must be a non-empty string');
    }

    if (!data.email || typeof data.email !== 'string') {
      errors.push('Email is required');
    } else if (!this.isValidEmail(data.email)) {
      errors.push('Email format is invalid');
    }

    if (!data.phone || typeof data.phone !== 'string' || data.phone.trim() === '') {
      errors.push('Phone is required and must be a non-empty string');
    } else if (!this.isValidPhone(data.phone)) {
      errors.push('Phone format is invalid');
    }

    if (!data.address || typeof data.address !== 'string' || data.address.trim() === '') {
      errors.push('Address is required and must be a non-empty string');
    }

    if (!data.enrollmentDate) {
      errors.push('Enrollment date is required');
    } else if (!this.isValidDate(data.enrollmentDate)) {
      errors.push('Enrollment date format is invalid');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Kiểm tra dữ liệu cập nhật sinh viên
   * @param {Object} data - Dữ liệu cần kiểm tra
   * @returns {Object} - Kết quả kiểm tra {valid: boolean, errors: []}
   */
  validateUpdateStudent(data) {
    const errors = [];

    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push('Name must be a non-empty string');
      }
    }

    if (data.email !== undefined) {
      if (typeof data.email !== 'string') {
        errors.push('Email must be a string');
      } else if (!this.isValidEmail(data.email)) {
        errors.push('Email format is invalid');
      }
    }

    if (data.phone !== undefined) {
      if (typeof data.phone !== 'string' || data.phone.trim() === '') {
        errors.push('Phone must be a non-empty string');
      } else if (!this.isValidPhone(data.phone)) {
        errors.push('Phone format is invalid');
      }
    }

    if (data.address !== undefined) {
      if (typeof data.address !== 'string' || data.address.trim() === '') {
        errors.push('Address must be a non-empty string');
      }
    }

    if (data.enrollmentDate !== undefined) {
      if (!this.isValidDate(data.enrollmentDate)) {
        errors.push('Enrollment date format is invalid');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Kiểm tra định dạng email
   * @param {String} email - Email cần kiểm tra
   * @returns {Boolean} - True nếu hợp lệ
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Kiểm tra định dạng số điện thoại
   * @param {String} phone - Số điện thoại cần kiểm tra
   * @returns {Boolean} - True nếu hợp lệ
   */
  isValidPhone(phone) {
    const phoneRegex = /^(\+?\d{1,3}[-.\s]?)?\d{9,}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Kiểm tra định dạng ngày tháng
   * @param {String|Date} date - Ngày cần kiểm tra
   * @returns {Boolean} - True nếu hợp lệ
   */
  isValidDate(date) {
    if (date instanceof Date) {
      return !isNaN(date);
    }
    return !isNaN(Date.parse(date));
  }
}

module.exports = new StudentValidator();
