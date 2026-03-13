const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { createTeacherSchema, updateTeacherSchema } = require('../validators/teacherSchemas');

// Tất cả routes dưới đây yêu cầu xác thực JWT
router.post('/', authenticate, validateRequest(createTeacherSchema), teacherController.create);
router.get('/', authenticate, teacherController.getAll);
router.get('/:id', authenticate, teacherController.getById);
router.put('/:id', authenticate, validateRequest(updateTeacherSchema), teacherController.update);
router.delete('/:id', authenticate, teacherController.delete);

// Routes quản lý lớp học của giáo viên
router.get('/:id/classes', authenticate, teacherController.getClasses);

module.exports = router;
