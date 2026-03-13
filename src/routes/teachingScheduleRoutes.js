const express = require('express');
const router = express.Router();
const teachingScheduleController = require('../controllers/teachingScheduleController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { createTeachingScheduleSchema, updateTeachingScheduleSchema } = require('../validators/teachingScheduleSchemas');

// Tất cả routes dưới đây yêu cầu xác thực JWT
router.post('/', authenticate, validateRequest(createTeachingScheduleSchema), teachingScheduleController.create);
router.get('/', authenticate, teachingScheduleController.getAll);
router.get('/:id', authenticate, teachingScheduleController.getById);
router.put('/:id', authenticate, validateRequest(updateTeachingScheduleSchema), teachingScheduleController.update);
router.delete('/:id', authenticate, teachingScheduleController.delete);

// Routes lấy lịch theo tiêu chí
router.get('/teacher/:teacher_id', authenticate, teachingScheduleController.getByTeacher);
router.get('/class/:class_id', authenticate, teachingScheduleController.getByClass);
router.get('/date/:date', authenticate, teachingScheduleController.getByDate);

module.exports = router;
