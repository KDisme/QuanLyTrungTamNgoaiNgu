// routes/authRoutes.js
// Định tuyến Authentication.
// Lưu ý: prefix được mount ở app: `/api/auth`.
// - POST /api/auth/register: validate body, tạo user mới (password được hash).
// - POST /api/auth/login: validate body, trả JWT.
// - POST /api/auth/change-password: yêu cầu JWT + validate body, đổi mật khẩu.

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { registerSchema, loginSchema, changePasswordSchema } = require('../validations/authValidation');

// Registration is temporarily disabled.
// Original route (kept for quick rollback):
// router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/register', (req, res) => {
	res.status(403).json({ message: 'Chuc nang dang ky tam thoi da bi vo hieu hoa' });
});
router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/change-password', authenticate, validateRequest(changePasswordSchema), authController.changePassword);

module.exports = router;
