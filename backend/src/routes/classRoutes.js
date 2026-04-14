// routes/classRoutes.js
// Định tuyến CRUD lớp học

const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { createClassSchema, updateClassSchema } = require('../validations/classValidation');

// Tất cả routes dưới đây yêu cầu xác thực JWT
router.post('/', authenticate, validateRequest(createClassSchema), classController.create);
router.get('/', authenticate, classController.getAll);
router.get('/:id', authenticate, classController.getById);
router.put('/:id', authenticate, validateRequest(updateClassSchema), classController.update);
router.delete('/:id', authenticate, classController.delete);

module.exports = router;
