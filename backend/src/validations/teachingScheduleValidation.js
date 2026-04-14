// validations/teachingScheduleValidation.js
// Schema validation cho teaching schedule

const Joi = require('joi');

// Schema tạo mới teaching schedule
const createTeachingScheduleSchema = Joi.object({
  teacher_id: Joi.number().integer().required().messages({
    'number.base': 'ID giáo viên phải là số',
    'number.integer': 'ID giáo viên phải là số nguyên',
    'any.required': 'ID giáo viên là bắt buộc',
  }),
  class_id: Joi.number().integer().required().messages({
    'number.base': 'ID lớp học phải là số',
    'number.integer': 'ID lớp học phải là số nguyên',
    'any.required': 'ID lớp học là bắt buộc',
  }),
  teaching_date: Joi.date().iso().required().messages({
    'date.base': 'Ngày dạy không đúng định dạng',
    'date.format': 'Ngày dạy phải có định dạng YYYY-MM-DD',
    'any.required': 'Ngày dạy là bắt buộc',
  }),
  start_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required().messages({
    'string.empty': 'Giờ bắt đầu không được để trống',
    'string.pattern.base': 'Giờ bắt đầu phải có định dạng HH:MM:SS',
    'any.required': 'Giờ bắt đầu là bắt buộc',
  }),
  end_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required().messages({
    'string.empty': 'Giờ kết thúc không được để trống',
    'string.pattern.base': 'Giờ kết thúc phải có định dạng HH:MM:SS',
    'any.required': 'Giờ kết thúc là bắt buộc',
  }),
  room: Joi.string().max(50).allow(null, '').messages({
    'string.max': 'Tên phòng không được vượt quá 50 ký tự',
  }),
});

// Schema cập nhật teaching schedule (các field đều optional)
const updateTeachingScheduleSchema = Joi.object({
  teacher_id: Joi.number().integer().messages({
    'number.base': 'ID giáo viên phải là số',
    'number.integer': 'ID giáo viên phải là số nguyên',
  }),
  class_id: Joi.number().integer().messages({
    'number.base': 'ID lớp học phải là số',
    'number.integer': 'ID lớp học phải là số nguyên',
  }),
  teaching_date: Joi.date().iso().messages({
    'date.base': 'Ngày dạy không đúng định dạng',
    'date.format': 'Ngày dạy phải có định dạng YYYY-MM-DD',
  }),
  start_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).messages({
    'string.pattern.base': 'Giờ bắt đầu phải có định dạng HH:MM:SS',
  }),
  end_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).messages({
    'string.pattern.base': 'Giờ kết thúc phải có định dạng HH:MM:SS',
  }),
  room: Joi.string().max(50).allow(null, '').messages({
    'string.max': 'Tên phòng không được vượt quá 50 ký tự',
  }),
}).min(1).messages({
  'object.min': 'Phải có ít nhất một trường để cập nhật',
});

module.exports = {
  createTeachingScheduleSchema,
  updateTeachingScheduleSchema,
};
