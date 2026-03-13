const { ValidationException } = require('../exceptions');

/**
 * Request Validation Middleware
 * Xác thực request body, query, params dựa trên Joi schema
 * Nếu validation thất bại, sẽ throw ValidationException
 * 
 * @param {Object} schema - Joi schema object
 * @returns {Function} Middleware function
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(
        {
          body: req.body,
          query: req.query,
          params: req.params,
        },
        {
          abortEarly: false, // Collect all validation errors
          allowUnknown: false, // Không cho phép fields không được định nghĩa
        }
      );

      if (error) {
        // Format validation errors
        const errors = error.details.reduce((acc, detail) => {
          acc[detail.path.join('.')] = detail.message;
          return acc;
        }, {});

        throw new ValidationException(
          'Dữ liệu không hợp lệ',
          'VALIDATION_ERROR',
          errors
        );
      }

      // Ghi đè request data với validated data
      req.body = value.body;
      req.query = value.query;
      req.params = value.params;

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = validateRequest;
