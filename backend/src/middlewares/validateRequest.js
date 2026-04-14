// middlewares/validateRequest.js
// Middleware kiểm tra dữ liệu đầu vào với Joi schema

const { ValidationException } = require('../exceptions');

/**
 * Middleware validate request data với Joi schema
 * @param {Object} schema - Joi schema để validate
 * @returns {Function} Express middleware function
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Trả về tất cả lỗi, không dừng ở lỗi đầu tiên
      stripUnknown: true, // Loại bỏ các field không có trong schema
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      throw new ValidationException('Dữ liệu không hợp lệ', errors);
    }

    // Gán value đã được validate (và stripped) vào req.body
    req.body = value;
    next();
  };
};

module.exports = validateRequest;
