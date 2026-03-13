const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { createStudentSchema, updateStudentSchema } = require('../validators/studentSchemas');

// Tất cả routes dưới đây yêu cầu xác thực JWT
router.post('/', authenticate, validateRequest(createStudentSchema), studentController.create);
router.get('/', authenticate, studentController.getAll);
router.get('/:id', authenticate, studentController.getById);
router.put('/:id', authenticate, validateRequest(updateStudentSchema), studentController.update);
router.delete('/:id', authenticate, studentController.delete);

// Routes quản lý lớp học cho sinh viên
router.post('/:id/assign-class', authenticate, studentController.assignToClass);
router.delete('/:id/remove-class', authenticate, studentController.removeFromClass);

module.exports = router;
