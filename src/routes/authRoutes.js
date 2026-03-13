const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { registerSchema, loginSchema, changePasswordSchema } = require('../validators/authSchemas');

router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/change-password', authenticate, validateRequest(changePasswordSchema), authController.changePassword);

module.exports = router;
