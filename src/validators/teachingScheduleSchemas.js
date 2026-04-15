const Joi = require('joi');

/**
 * TeachingSchedule Validation Schemas
 * Schemas cho các endpoints: POST /teaching-schedules, PUT /teaching-schedules/:id
 */

const createTeachingScheduleSchema = Joi.object({
  body: Joi.object({
    teacher_id: Joi.number().integer().optional().messages({
      'number.base': 'ID giáo viên phải là số',
    }),

    class_id: Joi.number().integer().required().messages({
      'number.base': 'ID lớp học phải là số',
      'any.required': 'ID lớp học là bắt buộc',
    }),

    day_of_week: Joi.array().items(
      Joi.number().integer().min(0).max(6).messages({
        'number.base': 'Ngày trong tuần phải là số',
        'number.min': 'Ngày trong tuần phải từ 0 đến 6',
        'number.max': 'Ngày trong tuần phải từ 0 đến 6',
      })
    ).min(1).max(7).unique().required().messages({
      'array.min': 'Phải chọn ít nhất 1 ngày trong tuần',
      'array.max': 'Không được chọn quá 7 ngày trong tuần',
      'array.unique': 'Các ngày trong tuần không được trùng nhau',
      'any.required': 'day_of_week là bắt buộc',
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

const createBulkTeachingScheduleSchema = createTeachingScheduleSchema;

const updateTeachingScheduleSchema = Joi.object({
  body: Joi.object({
    class_id: Joi.number().integer().optional().messages({
      'number.base': 'ID lớp học phải là số',
    }),

    day_of_week: Joi.number().integer().min(0).max(6).optional().messages({
      'number.base': 'Ngày trong tuần phải là số',
      'number.min': 'Ngày trong tuần phải từ 0 đến 6',
      'number.max': 'Ngày trong tuần phải từ 0 đến 6',
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
  createBulkTeachingScheduleSchema,
  updateTeachingScheduleSchema,
};
