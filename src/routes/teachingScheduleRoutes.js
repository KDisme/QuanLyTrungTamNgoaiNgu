const express = require('express');
const router = express.Router();
const teachingScheduleController = require('../controllers/teachingScheduleController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { createTeachingScheduleSchema, createBulkTeachingScheduleSchema, updateTeachingScheduleSchema } = require('../validators/teachingScheduleSchemas');

// 1. Route tạo hàng loạt (PHẢI ĐẶT TRÊN CÙNG)
router.post('/bulk', authenticate, validateRequest(createBulkTeachingScheduleSchema), teachingScheduleController.createBulk);

// 2. Các route cơ bản
router.post('/', authenticate, validateRequest(createTeachingScheduleSchema), teachingScheduleController.create);
router.get('/', authenticate, teachingScheduleController.getAll);

// Routes lấy lịch theo tiêu chí
router.get('/teacher/:teacher_id', authenticate, teachingScheduleController.getByTeacher);
router.get('/class/:class_id', authenticate, teachingScheduleController.getByClass);
router.get('/date/:date', authenticate, teachingScheduleController.getByDate);

// 3. Các route có tham số :id (ĐẶT DƯỚI CÙNG)
router.get('/:id', authenticate, teachingScheduleController.getById);
router.put('/:id', authenticate, validateRequest(updateTeachingScheduleSchema), teachingScheduleController.update);
router.delete('/:id', authenticate, teachingScheduleController.delete);


module.exports = router;
