// validations/studentValidation.js
// Schema validation cho student

const Joi = require('joi');

// Schema tạo mới student
const createStudentSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Tên học viên không được để trống',
    'string.min': 'Tên học viên phải có ít nhất 2 ký tự',
    'string.max': 'Tên học viên không được vượt quá 100 ký tự',
    'any.required': 'Tên học viên là bắt buộc',
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email không được để trống',
    'string.email': 'Email không đúng định dạng',
    'any.required': 'Email là bắt buộc',
  }),
  birth_date: Joi.date().iso().required().messages({
    'date.base': 'Ngày sinh không đúng định dạng',
    'date.format': 'Ngày sinh phải có định dạng YYYY-MM-DD',
    'any.required': 'Ngày sinh là bắt buộc',
  }),
  citizen_id: Joi.string().min(9).max(12).required().messages({
    'string.empty': 'CMND/CCCD không được để trống',
    'string.min': 'CMND/CCCD phải có ít nhất 9 ký tự',
    'string.max': 'CMND/CCCD không được vượt quá 12 ký tự',
    'any.required': 'CMND/CCCD là bắt buộc',
  }),
  target_score: Joi.number().min(0).max(9).allow(null).messages({
    'number.base': 'Điểm mục tiêu phải là số',
    'number.min': 'Điểm mục tiêu phải từ 0 đến 9',
    'number.max': 'Điểm mục tiêu phải từ 0 đến 9',
  }),
  class_id: Joi.number().integer().allow(null).messages({
    'number.base': 'ID lớp học phải là số',
    'number.integer': 'ID lớp học phải là số nguyên',
  }),
  enrollment_date: Joi.date().iso().allow(null).messages({
    'date.base': 'Ngày ghi danh không đúng định dạng',
    'date.format': 'Ngày ghi danh phải có định dạng YYYY-MM-DD',
  }),
});

// Schema cập nhật student (các field đều optional)
const updateStudentSchema = Joi.object({
  name: Joi.string().min(2).max(100).messages({
    'string.min': 'Tên học viên phải có ít nhất 2 ký tự',
    'string.max': 'Tên học viên không được vượt quá 100 ký tự',
  }),
  email: Joi.string().email().messages({
    'string.email': 'Email không đúng định dạng',
  }),
  birth_date: Joi.date().iso().messages({
    'date.base': 'Ngày sinh không đúng định dạng',
    'date.format': 'Ngày sinh phải có định dạng YYYY-MM-DD',
  }),
  citizen_id: Joi.string().min(9).max(12).messages({
    'string.min': 'CMND/CCCD phải có ít nhất 9 ký tự',
    'string.max': 'CMND/CCCD không được vượt quá 12 ký tự',
  }),
  target_score: Joi.number().min(0).max(9).allow(null).messages({
    'number.base': 'Điểm mục tiêu phải là số',
    'number.min': 'Điểm mục tiêu phải từ 0 đến 9',
    'number.max': 'Điểm mục tiêu phải từ 0 đến 9',
  }),
  class_id: Joi.number().integer().allow(null).messages({
    'number.base': 'ID lớp học phải là số',
    'number.integer': 'ID lớp học phải là số nguyên',
  }),
  enrollment_date: Joi.date().iso().allow(null).messages({
    'date.base': 'Ngày ghi danh không đúng định dạng',
    'date.format': 'Ngày ghi danh phải có định dạng YYYY-MM-DD',
  }),
}).min(1).messages({
  'object.min': 'Phải có ít nhất một trường để cập nhật',
});

module.exports = {
  createStudentSchema,
  updateStudentSchema,
};
