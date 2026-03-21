// validations/classValidation.js
// Schema validation cho class

const Joi = require('joi');

// Schema tạo mới class
const createClassSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Tên lớp học không được để trống',
    'string.min': 'Tên lớp học phải có ít nhất 2 ký tự',
    'string.max': 'Tên lớp học không được vượt quá 100 ký tự',
    'any.required': 'Tên lớp học là bắt buộc',
  }),
  start_date: Joi.date().iso().required().messages({
    'date.base': 'Ngày bắt đầu không đúng định dạng',
    'date.format': 'Ngày bắt đầu phải có định dạng YYYY-MM-DD',
    'any.required': 'Ngày bắt đầu là bắt buộc',
  }),
  end_date: Joi.date().iso().greater(Joi.ref('start_date')).required().messages({
    'date.base': 'Ngày kết thúc không đúng định dạng',
    'date.format': 'Ngày kết thúc phải có định dạng YYYY-MM-DD',
    'date.greater': 'Ngày kết thúc phải sau ngày bắt đầu',
    'any.required': 'Ngày kết thúc là bắt buộc',
  }),
  capacity: Joi.number().integer().min(1).max(100).required().messages({
    'number.base': 'Sức chứa phải là số',
    'number.integer': 'Sức chứa phải là số nguyên',
    'number.min': 'Sức chứa phải ít nhất là 1',
    'number.max': 'Sức chứa không được vượt quá 100',
    'any.required': 'Sức chứa là bắt buộc',
  }),
  teacher_id: Joi.number().integer().required().messages({
    'number.base': 'ID giáo viên phải là số',
    'number.integer': 'ID giáo viên phải là số nguyên',
    'any.required': 'ID giáo viên là bắt buộc',
  }),
  sessions: Joi.number().integer().min(1).allow(null).messages({
    'number.base': 'Số buổi học phải là số',
    'number.integer': 'Số buổi học phải là số nguyên',
    'number.min': 'Số buổi học phải ít nhất là 1',
  }),
});

// Schema cập nhật class (các field đều optional)
const updateClassSchema = Joi.object({
  name: Joi.string().min(2).max(100).messages({
    'string.min': 'Tên lớp học phải có ít nhất 2 ký tự',
    'string.max': 'Tên lớp học không được vượt quá 100 ký tự',
  }),
  start_date: Joi.date().iso().messages({
    'date.base': 'Ngày bắt đầu không đúng định dạng',
    'date.format': 'Ngày bắt đầu phải có định dạng YYYY-MM-DD',
  }),
  end_date: Joi.date().iso().messages({
    'date.base': 'Ngày kết thúc không đúng định dạng',
    'date.format': 'Ngày kết thúc phải có định dạng YYYY-MM-DD',
  }),
  capacity: Joi.number().integer().min(1).max(100).messages({
    'number.base': 'Sức chứa phải là số',
    'number.integer': 'Sức chứa phải là số nguyên',
    'number.min': 'Sức chứa phải ít nhất là 1',
    'number.max': 'Sức chứa không được vượt quá 100',
  }),
  teacher_id: Joi.number().integer().messages({
    'number.base': 'ID giáo viên phải là số',
    'number.integer': 'ID giáo viên phải là số nguyên',
  }),
  sessions: Joi.number().integer().min(1).allow(null).messages({
    'number.base': 'Số buổi học phải là số',
    'number.integer': 'Số buổi học phải là số nguyên',
    'number.min': 'Số buổi học phải ít nhất là 1',
  }),
}).min(1).messages({
  'object.min': 'Phải có ít nhất một trường để cập nhật',
});

module.exports = {
  createClassSchema,
  updateClassSchema,
};
