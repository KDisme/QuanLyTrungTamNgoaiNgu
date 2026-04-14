// routes/examSetRoutes.js
// Định tuyến bộ đề thi

const express = require('express');
const router = express.Router();
const examSetController = require('../controllers/examSetController');
const authenticate = require('../middlewares/auth');
const validateRequest = require('../middlewares/validateRequest');
const { createExamSetSchema, updateExamSetSchema } = require('../validations/examSetValidation');

router.post('/', authenticate, validateRequest(createExamSetSchema), examSetController.create);
router.get('/', authenticate, examSetController.getAll);
router.get('/:id', authenticate, examSetController.getById);
router.put('/:id', authenticate, validateRequest(updateExamSetSchema), examSetController.update);
router.delete('/:id', authenticate, examSetController.delete);

module.exports = router;

