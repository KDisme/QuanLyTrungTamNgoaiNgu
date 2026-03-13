const Joi = require('joi');

/**
 * TeachingSchedule Validation Schemas
 * Schemas cho các endpoints: POST /teaching-schedules, PUT /teaching-schedules/:id
 */

const createTeachingScheduleSchema = Joi.object({
  body: Joi.object({
    teacher_id: Joi.number().integer().required().messages({
      'number.base': 'ID giáo viên phải là số',
      'any.required': 'ID giáo viên là bắt buộc',
    }),

    class_id: Joi.number().integer().required().messages({
      'number.base': 'ID lớp học phải là số',
      'any.required': 'ID lớp học là bắt buộc',
    }),

    teaching_date: Joi.date().required().iso().messages({
      'date.base': 'Ngày giảng dạy phải là ngày hợp lệ',
      'any.required': 'Ngày giảng dạy là bắt buộc',
    }),

    start_time: Joi.string().required().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).messages({
      'string.pattern.base': 'Thời gian bắt đầu phải có định dạng HH:MM (24h)',
      'any.required': 'Thời gian bắt đầu là bắt buộc',
    }),

    end_time: Joi.string().required().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).messages({
      'string.pattern.base': 'Thời gian kết thúc phải có định dạng HH:MM (24h)',
      'any.required': 'Thời gian kết thúc là bắt buộc',
    }),

    room: Joi.string().required().min(1).max(50).messages({
      'string.empty': 'Phòng học không được để trống',
      'string.min': 'Phòng học phải ít nhất 1 ký tự',
      'string.max': 'Phòng học tối đa 50 ký tự',
      'any.required': 'Phòng học là bắt buộc',
    }),
  }),

  query: Joi.object({}),

  params: Joi.object({}),
});

const updateTeachingScheduleSchema = Joi.object({
  body: Joi.object({
    teacher_id: Joi.number().integer().optional().messages({
      'number.base': 'ID giáo viên phải là số',
    }),

    class_id: Joi.number().integer().optional().messages({
      'number.base': 'ID lớp học phải là số',
    }),

    teaching_date: Joi.date().iso().optional().messages({
      'date.base': 'Ngày giảng dạy phải là ngày hợp lệ',
    }),

    start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
      'string.pattern.base': 'Thời gian bắt đầu phải có định dạng HH:MM (24h)',
    }),

    end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
      'string.pattern.base': 'Thời gian kết thúc phải có định dạng HH:MM (24h)',
    }),

    room: Joi.string().min(1).max(50).optional().messages({
      'string.min': 'Phòng học phải ít nhất 1 ký tự',
      'string.max': 'Phòng học tối đa 50 ký tự',
    }),
  }),

  query: Joi.object({}),

  params: Joi.object({
    id: Joi.number().integer().required().messages({
      'any.required': 'ID lịch giảng dạy là bắt buộc',
      'number.base': 'ID lịch giảng dạy phải là số',
    }),
  }),
});

module.exports = {
  createTeachingScheduleSchema,
  updateTeachingScheduleSchema,
};