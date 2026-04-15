const Joi = require('joi');

/**
 * Class Validation Schemas
 * Schemas cho các endpoints: POST /classes, PUT /classes/:id
 */

const createClassSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().required().min(2).max(100).messages({
      'string.empty': 'Tên lớp không được để trống',
      'string.min': 'Tên lớp phải ít nhất 2 ký tự',
      'string.max': 'Tên lớp tối đa 100 ký tự',
      'any.required': 'Tên lớp là bắt buộc',
    }),
    start_date: Joi.date().required().iso().messages({
      'date.base': 'Ngày bắt đầu phải là ngày hợp lệ',
      'any.required': 'Ngày bắt đầu là bắt buộc',
    }),
    sessions_per_week: Joi.number().integer().min(1).max(7).required().messages({
      'number.base': 'Số buổi trong tuần phải là số',
      'number.min': 'Số buổi trong tuần phải ít nhất 1',
      'number.max': 'Số buổi trong tuần tối đa 7',
      'any.required': 'Số buổi trong tuần là bắt buộc',
    }),
    capacity: Joi.number().required().integer().min(1).max(100).messages({
      'number.base': 'Sức chứa phải là số',
      'number.min': 'Sức chứa phải ít nhất 1',
      'number.max': 'Sức chứa tối đa 100',
      'any.required': 'Sức chứa là bắt buộc',
    }),
    sessions: Joi.number().required().integer().min(1).max(100).messages({
      'number.base': 'Số buổi phải là số',
      'number.min': 'Số buổi phải ít nhất 1',
      'number.max': 'Số buổi tối đa 100',
      'any.required': 'Số buổi là bắt buộc',
    }),
    teacher_id: Joi.number().integer().allow(null).messages({
      'number.base': 'ID giáo viên phải là số',
    }),
    day_of_week: Joi.array().items(
      Joi.number().integer().min(0).max(6).messages({
        'number.base': 'Mỗi ngày trong tuần phải là số',
        'number.min': 'Ngày trong tuần phải từ 0 đến 6',
        'number.max': 'Ngày trong tuần phải từ 0 đến 6',
      })
    ).unique().min(1).max(7).optional().messages({
      'array.base': 'Danh sách ngày trong tuần phải là mảng',
      'array.min': 'Phải chọn ít nhất 1 ngày trong tuần',
      'array.max': 'Không được chọn quá 7 ngày trong tuần',
    }),
    start_time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().messages({
      'string.pattern.base': 'Thời gian bắt đầu phải có định dạng HH:mm',
    }),
    end_time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().messages({
      'string.pattern.base': 'Thời gian kết thúc phải có định dạng HH:mm',
    }),
    room: Joi.string().max(100).optional().messages({
      'string.max': 'Tên phòng học tối đa 100 ký tự',
    }),
  }),
  query: Joi.object({}),
  params: Joi.object({}),
});

const updateClassSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional().messages({
      'string.min': 'Tên lớp phải ít nhất 2 ký tự',
      'string.max': 'Tên lớp tối đa 100 ký tự',
    }),
    start_date: Joi.date().iso().optional().messages({
      'date.base': 'Ngày bắt đầu phải là ngày hợp lệ',
    }),
    sessions_per_week: Joi.number().integer().min(1).max(7).optional().messages({
      'number.base': 'Số buổi trong tuần phải là số',
      'number.min': 'Số buổi trong tuần phải ít nhất 1',
      'number.max': 'Số buổi trong tuần tối đa 7',
    }),
    day_of_week: Joi.array().items(
      Joi.number().integer().min(0).max(6).messages({
        'number.base': 'Mỗi ngày trong tuần phải là số',
        'number.min': 'Ngày trong tuần phải từ 0 đến 6',
        'number.max': 'Ngày trong tuần phải từ 0 đến 6',
      })
    ).unique().min(1).max(7).optional().messages({
      'array.base': 'Danh sách ngày trong tuần phải là mảng',
      'array.min': 'Phải chọn ít nhất 1 ngày trong tuần',
      'array.max': 'Không được chọn quá 7 ngày trong tuần',
    }),
    start_time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().messages({
      'string.pattern.base': 'Thời gian bắt đầu phải có định dạng HH:mm',
    }),
    end_time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().messages({
      'string.pattern.base': 'Thời gian kết thúc phải có định dạng HH:mm',
    }),
    room: Joi.string().max(100).optional().messages({
      'string.max': 'Tên phòng học tối đa 100 ký tự',
    }),
    capacity: Joi.number().integer().min(1).max(100).optional().messages({
      'number.base': 'Sức chứa phải là số',
      'number.min': 'Sức chứa phải ít nhất 1',
      'number.max': 'Sức chứa tối đa 100',
    }),
    sessions: Joi.number().integer().min(1).max(100).optional().messages({
      'number.base': 'Số buổi phải là số',
      'number.min': 'Số buổi phải ít nhất 1',
      'number.max': 'Số buổi tối đa 100',
    }),
    teacher_id: Joi.number().integer().allow(null).optional().messages({
      'number.base': 'ID giáo viên phải là số',
    }),
  }),
  query: Joi.object({}),
  params: Joi.object({
    id: Joi.number().integer().required().messages({
      'any.required': 'ID lớp là bắt buộc',
      'number.base': 'ID lớp phải là số',
    }),
  }),
});

module.exports = {
  createClassSchema,
  updateClassSchema,
};
