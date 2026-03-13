const Joi = require('joi');

/**
 * Student Validation Schemas
 * Schemas cho các endpoints: POST /students, PUT /students/:id
 */

const createStudentSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().required().min(2).max(100).messages({
      'string.empty': 'Tên học viên không được để trống',
      'string.min': 'Tên phải ít nhất 2 ký tự',
      'string.max': 'Tên tối đa 100 ký tự',
      'any.required': 'Tên là bắt buộc',
    }),

    email: Joi.string().required().email().messages({
      'string.email': 'Email không hợp lệ',
      'any.required': 'Email là bắt buộc',
    }),

    birth_date: Joi.date().required().iso().messages({
      'date.base': 'Ngày sinh phải là ngày hợp lệ',
      'any.required': 'Ngày sinh là bắt buộc',
    }),

    citizen_id: Joi.string().required().length(12).pattern(/^[0-9]+$/).messages({
      'string.length': 'CMND/CCCD phải 12 số',
      'string.pattern.base': 'CMND/CCCD chỉ chứa số',
      'any.required': 'CMND/CCCD là bắt buộc',
    }),

    target_score: Joi.number().optional().min(0).max(990).messages({
      'number.base': 'Điểm mục tiêu phải là số',
      'number.min': 'Điểm mục tiêu tối thiểu 0',
      'number.max': 'Điểm mục tiêu tối đa 990',
    }),

    class_id: Joi.number().integer().optional().messages({
      'number.base': 'ID lớp phải là số',
    }),

    // ✅ Thêm field để fix lỗi
    enrollment_date: Joi.date().iso().optional().messages({
      'date.base': 'Ngày nhập học phải là ngày hợp lệ',
    }),

  }),

  query: Joi.object({}),

  params: Joi.object({}),
});



const updateStudentSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional().messages({
      'string.min': 'Tên phải ít nhất 2 ký tự',
      'string.max': 'Tên tối đa 100 ký tự',
    }),

    email: Joi.string().email().optional().messages({
      'string.email': 'Email không hợp lệ',
    }),

    birth_date: Joi.date().iso().optional().messages({
      'date.base': 'Ngày sinh phải là ngày hợp lệ',
    }),

    citizen_id: Joi.string().length(12).pattern(/^[0-9]+$/).optional().messages({
      'string.length': 'CMND/CCCD phải 12 số',
      'string.pattern.base': 'CMND/CCCD chỉ chứa số',
    }),

    target_score: Joi.number().min(0).max(990).optional().messages({
      'number.base': 'Điểm mục tiêu phải là số',
      'number.min': 'Điểm mục tiêu tối thiểu 0',
      'number.max': 'Điểm mục tiêu tối đa 990',
    }),

    class_id: Joi.number().integer().allow(null).optional().messages({
      'number.base': 'ID lớp phải là số',
    }),

    // ✅ Thêm field để tránh lỗi khi update
    enrollment_date: Joi.date().iso().optional().messages({
      'date.base': 'Ngày nhập học phải là ngày hợp lệ',
    }),

  }),

  query: Joi.object({}),

  params: Joi.object({
    id: Joi.number().integer().required().messages({
      'any.required': 'ID học viên là bắt buộc',
      'number.base': 'ID học viên phải là số',
    }),
  }),
});


module.exports = {
  createStudentSchema,
  updateStudentSchema,
};
