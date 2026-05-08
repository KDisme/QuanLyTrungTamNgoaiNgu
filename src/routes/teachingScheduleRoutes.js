const express = require('express');
const router = express.Router();
const teachingScheduleController = require('../controllers/teachingScheduleController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { createTeachingScheduleSchema, createBulkTeachingScheduleSchema, updateTeachingScheduleSchema, cancelTeachingScheduleSchema, createMakeupScheduleSchema } = require('../validators/teachingScheduleSchemas');

// 1. Route tạo hàng loạt (PHẢI ĐẶT TRÊN CÙNG)
router.post('/bulk', authenticate, validateRequest(createBulkTeachingScheduleSchema), teachingScheduleController.createBulk);

// 2. Routes cho lịch học bù (PHẢI ĐẶT TRƯỚC các route có :id)
router.post('/makeup', authenticate, validateRequest(createMakeupScheduleSchema), teachingScheduleController.createMakeup);
router.get('/makeup', authenticate, teachingScheduleController.getMakeup);

// 3. Các route cơ bản
router.post('/', authenticate, validateRequest(createTeachingScheduleSchema), teachingScheduleController.create);
router.get('/', authenticate, teachingScheduleController.getAll);

// Routes lấy lịch theo tiêu chí
router.get('/teacher/:teacher_id', authenticate, teachingScheduleController.getByTeacher);
router.get('/class/:class_id', authenticate, teachingScheduleController.getByClass);
router.get('/date/:date', authenticate, teachingScheduleController.getByDate);

// 4. Các route có tham số :id (ĐẶT DƯỚI CÙNG)
router.patch('/:id/cancel', authenticate, validateRequest(cancelTeachingScheduleSchema), teachingScheduleController.cancel);
router.patch('/:id/undo-makeup', authenticate, teachingScheduleController.undoMakeup);
router.get('/:id/makeup', authenticate, teachingScheduleController.getMakeupByOriginal);
router.get('/:id', authenticate, teachingScheduleController.getById);
router.put('/:id', authenticate, validateRequest(updateTeachingScheduleSchema), teachingScheduleController.update);
router.delete('/:id', authenticate, teachingScheduleController.delete);


module.exports = router;
