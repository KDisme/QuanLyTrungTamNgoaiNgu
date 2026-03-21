// routes/teachingScheduleRoutes.js
// Định tuyến CRUD lịch giảng dạy

const express = require('express');
const router = express.Router();
const teachingScheduleController = require('../controllers/teachingScheduleController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { createTeachingScheduleSchema, updateTeachingScheduleSchema } = require('../validations/teachingScheduleValidation');

// Tất cả routes dưới đây yêu cầu xác thực JWT
router.post('/', authenticate, validateRequest(createTeachingScheduleSchema), teachingScheduleController.create);
router.get('/', authenticate, teachingScheduleController.getAll);
router.get('/:id', authenticate, teachingScheduleController.getById);
router.get('/teacher/:teacher_id', authenticate, teachingScheduleController.getByTeacherId);
router.get('/class/:class_id', authenticate, teachingScheduleController.getByClassId);
router.put('/:id', authenticate, validateRequest(updateTeachingScheduleSchema), teachingScheduleController.update);
router.delete('/:id', authenticate, teachingScheduleController.delete);

module.exports = router;
