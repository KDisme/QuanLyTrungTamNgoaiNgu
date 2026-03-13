const Joi = require('joi');

/**
 * Auth Validation Schemas
 * Schemas cho các endpoints: register, login, change-password
 */

const registerSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().required().min(2).max(100).messages({
      'string.empty': 'Tên không được để trống',
      'string.min': 'Tên phải ít nhất 2 ký tự',
      'string.max': 'Tên tối đa 100 ký tự',
      'any.required': 'Tên là bắt buộc',
    }),
    email: Joi.string().required().email().messages({
      'string.email': 'Email không hợp lệ',
      'any.required': 'Email là bắt buộc',
    }),
    password: Joi.string().required().min(6).messages({
      'string.min': 'Mật khẩu phải ít nhất 6 ký tự',
      'any.required': 'Mật khẩu là bắt buộc',
    }),
  }),
  query: Joi.object({}),
  params: Joi.object({}),
});

const loginSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().required().email().messages({
      'string.email': 'Email không hợp lệ',
      'any.required': 'Email là bắt buộc',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Mật khẩu là bắt buộc',
    }),
  }),
  query: Joi.object({}),
  params: Joi.object({}),
});

const changePasswordSchema = Joi.object({
  body: Joi.object({
    oldPassword: Joi.string().required().messages({
      'any.required': 'Mật khẩu cũ là bắt buộc',
    }),
    newPassword: Joi.string().required().min(6).messages({
      'string.min': 'Mật khẩu mới phải ít nhất 6 ký tự',
      'any.required': 'Mật khẩu mới là bắt buộc',
    }),
  }),
  query: Joi.object({}),
  params: Joi.object({}),
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
};
