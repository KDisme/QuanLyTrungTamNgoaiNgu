const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { createClassSchema, updateClassSchema } = require('../validators/classSchemas');

// Tất cả routes dưới đây yêu cầu xác thực JWT
router.post('/', authenticate, validateRequest(createClassSchema), classController.create);
router.get('/', authenticate, classController.getAll);
router.get('/:id', authenticate, classController.getById);
router.put('/:id', authenticate, validateRequest(updateClassSchema), classController.update);
router.delete('/:id', authenticate, classController.delete);

// Routes quản lý giáo viên và sinh viên cho lớp
router.post('/:id/assign-teacher', authenticate, classController.assignTeacher);
router.delete('/:id/remove-teacher', authenticate, classController.removeTeacher);
router.get('/:id/students', authenticate, classController.getStudents);

module.exports = router;