// controllers/authController.js
// Xử lý HTTP requests cho Auth - Presentation Layer

const authService = require('../services/authService');
const asyncHandler = require('../middlewares/asyncHandler');

/**
 * Auth Controller
 * Nhận HTTP request, gọi service, trả về HTTP response
 * Sử dụng asyncHandler để tự động catch errors
 */
const authController = {
  /**
   * POST /api/auth/register
   * Đăng ký người dùng mới
   */
  register: asyncHandler(async (req, res, next) => {
    const { name, email, password } = req.body;
    const user = await authService.register({ name, email, password });
    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      user,
    });
  }),

  /**
   * POST /api/auth/login
   * Đăng nhập
   */
  login: asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;
    const { user, token } = await authService.login({ email, password });
    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      user,
      token,
    });
  }),

  /**
   * POST /api/auth/change-password
   * Thay đổi mật khẩu (require authentication)
   */
  changePassword: asyncHandler(async (req, res, next) => {
    const userId = req.user.id; // Lấy từ JWT middleware
    const { oldPassword, newPassword } = req.body;
    const user = await authService.changePassword({ userId, oldPassword, newPassword });
    res.json({
      success: true,
      message: 'Thay đổi mật khẩu thành công',
      user,
    });
  }),
};

module.exports = authController;
