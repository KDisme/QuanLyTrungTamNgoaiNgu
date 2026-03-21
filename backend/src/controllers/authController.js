// controllers/authController.js
// Xử lý đăng ký, đăng nhập

const authService = require('../services/authService');

const authController = {
  async register(req, res, next) {
    try {
      const { name, email, password } = req.body;
      const user = await authService.register({ name, email, password });
      res.status(201).json({ message: 'User created', user });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const { user, token } = await authService.login({ email, password });
      res.json({ user, token });
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req, res, next) {
    try {
      const userId = req.user.id; // Lấy từ JWT middleware
      const { oldPassword, newPassword } = req.body;
      const user = await authService.changePassword({ userId, oldPassword, newPassword });
      res.json({ message: 'Thay đổi mật khẩu thành công', user });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
