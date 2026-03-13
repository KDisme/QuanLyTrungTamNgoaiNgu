const Joi = require('joi');

/**
 * Teacher Validation Schemas
 * Schemas cho các endpoints: POST /teachers, PUT /teachers/:id
 */

const createTeacherSchema = Joi.object({
  body: Joi.object({
    full_name: Joi.string().required().min(2).max(100).messages({
      'string.empty': 'Tên giáo viên không được để trống',
      'string.min': 'Tên phải ít nhất 2 ký tự',
      'string.max': 'Tên tối đa 100 ký tự',
      'any.required': 'Tên là bắt buộc',
    }),
    email: Joi.string().required().email().messages({
      'string.email': 'Email không hợp lệ',
      'any.required': 'Email là bắt buộc',
    }),
    phone: Joi.string().required().pattern(/^[0-9]{10,11}$/).messages({
      'string.pattern.base': 'Số điện thoại phải 10-11 chữ số',
      'any.required': 'Số điện thoại là bắt buộc',
    }),
    date_of_birth: Joi.date().required().iso().messages({
      'date.base': 'Ngày sinh phải là ngày hợp lệ',
      'any.required': 'Ngày sinh là bắt buộc',
    }),
  }),
  query: Joi.object({}),
  params: Joi.object({}),
});

const updateTeacherSchema = Joi.object({
  body: Joi.object({
    full_name: Joi.string().min(2).max(100).optional().messages({
      'string.min': 'Tên phải ít nhất 2 ký tự',
      'string.max': 'Tên tối đa 100 ký tự',
    }),
    email: Joi.string().email().optional().messages({
      'string.email': 'Email không hợp lệ',
    }),
    phone: Joi.string().pattern(/^[0-9]{10,11}$/).optional().messages({
      'string.pattern.base': 'Số điện thoại phải 10-11 chữ số',
    }),
    date_of_birth: Joi.date().iso().optional().messages({
      'date.base': 'Ngày sinh phải là ngày hợp lệ',
    }),
  }),
  query: Joi.object({}),
  params: Joi.object({
    id: Joi.number().integer().required().messages({
      'any.required': 'ID giáo viên là bắt buộc',
      'number.base': 'ID giáo viên phải là số',
    }),
  }),
});

module.exports = {
  createTeacherSchema,
  updateTeacherSchema,
};
