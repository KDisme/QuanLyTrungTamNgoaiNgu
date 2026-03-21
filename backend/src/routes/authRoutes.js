// routes/authRoutes.js
// Định tuyến đăng ký, đăng nhập

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { registerSchema, loginSchema, changePasswordSchema } = require('../validations/authValidation');

router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/change-password', authenticate, validateRequest(changePasswordSchema), authController.changePassword);

module.exports = router;
