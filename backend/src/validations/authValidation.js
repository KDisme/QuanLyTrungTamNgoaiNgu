// validations/authValidation.js
// Schema validation cho authentication

const Joi = require('joi');

// Schema đăng ký
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Tên không được để trống',
    'string.min': 'Tên phải có ít nhất 2 ký tự',
    'string.max': 'Tên không được vượt quá 100 ký tự',
    'any.required': 'Tên là bắt buộc',
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email không được để trống',
    'string.email': 'Email không đúng định dạng',
    'any.required': 'Email là bắt buộc',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là bắt buộc',
  }),
});

// Schema đăng nhập
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email không được để trống',
    'string.email': 'Email không đúng định dạng',
    'any.required': 'Email là bắt buộc',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là bắt buộc',
  }),
});

// Schema đổi mật khẩu
const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required().messages({
    'string.empty': 'Mật khẩu cũ không được để trống',
    'any.required': 'Mật khẩu cũ là bắt buộc',
  }),
  newPassword: Joi.string().required().messages({
    'string.empty': 'Mật khẩu mới không được để trống',
    'any.required': 'Mật khẩu mới là bắt buộc',
  }),
});

module.exports = { 
  registerSchema, 
  loginSchema, 
  changePasswordSchema 
};
