// validations/teacherValidation.js
// Schema validation cho teacher

const Joi = require('joi');

// Schema tạo mới teacher
const createTeacherSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Tên giáo viên không được để trống',
    'string.min': 'Tên giáo viên phải có ít nhất 2 ký tự',
    'string.max': 'Tên giáo viên không được vượt quá 100 ký tự',
    'any.required': 'Tên giáo viên là bắt buộc',
  }),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
    'string.empty': 'Số điện thoại không được để trống',
    'string.pattern.base': 'Số điện thoại phải có 10 chữ số',
    'any.required': 'Số điện thoại là bắt buộc',
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email không được để trống',
    'string.email': 'Email không đúng định dạng',
    'any.required': 'Email là bắt buộc',
  }),
  date_of_birth: Joi.date().iso().required().messages({
    'date.base': 'Ngày sinh không đúng định dạng',
    'date.format': 'Ngày sinh phải có định dạng YYYY-MM-DD',
    'any.required': 'Ngày sinh là bắt buộc',
  }),
});

// Schema cập nhật teacher (các field đều optional)
const updateTeacherSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).messages({
    'string.min': 'Tên giáo viên phải có ít nhất 2 ký tự',
    'string.max': 'Tên giáo viên không được vượt quá 100 ký tự',
  }),
  phone: Joi.string().pattern(/^[0-9]{10}$/).messages({
    'string.pattern.base': 'Số điện thoại phải có 10-11 chữ số',
  }),
  email: Joi.string().email().messages({
    'string.email': 'Email không đúng định dạng',
  }),
  date_of_birth: Joi.date().iso().messages({
    'date.base': 'Ngày sinh không đúng định dạng',
    'date.format': 'Ngày sinh phải có định dạng YYYY-MM-DD',
  }),
}).min(1).messages({
  'object.min': 'Phải có ít nhất một trường để cập nhật',
});

module.exports = {
  createTeacherSchema,
  updateTeacherSchema,
};
