// routes/studentRoutes.js
// Định tuyến CRUD học viên

const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { createStudentSchema, updateStudentSchema } = require('../validations/studentValidation');

// Tất cả routes dưới đây yêu cầu xác thực JWT
router.post('/', authenticate, validateRequest(createStudentSchema), studentController.create);
router.get('/', authenticate, studentController.getAll);
// Lịch sử hoàn thành khóa học
router.get('/completed-history', authenticate, studentController.getCompletedHistory);
router.get('/:id', authenticate, studentController.getById);
router.put('/:id', authenticate, validateRequest(updateStudentSchema), studentController.update);
// Đánh dấu học viên đã hoàn thành khóa học
router.put('/:id/complete', authenticate, studentController.completeCourse);
router.delete('/:id', authenticate, studentController.delete);

module.exports = router;
