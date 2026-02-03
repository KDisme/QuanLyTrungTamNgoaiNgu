const express = require('express');
const StudentController = require('../controllers/StudentController');

const router = express.Router();

router.post('/', (req, res, next) => StudentController.create(req, res, next));
router.get('/', (req, res, next) => StudentController.getAll(req, res, next));
router.get('/:id', (req, res, next) => StudentController.getById(req, res, next));
router.put('/:id', (req, res, next) => StudentController.update(req, res, next));
router.delete('/:id', (req, res, next) => StudentController.delete(req, res, next));

module.exports = router;
