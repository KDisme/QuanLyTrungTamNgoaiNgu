const classService = require('../services/class.service');

class ClassController {
  async getAll(req, res, next) {
    try {
      const result = await classService.getAll(req.tenant.id, req.query, req.user);
      res.json(result);
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR') return res.status(422).json({ message: err.message });
      next(err);
    }
  }

  async getNextCode(req, res, next) {
    try {
      const result = await classService.getNextCode(req.tenant.id);
      res.json(result);
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR') return res.status(422).json({ message: err.message });
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const cls = await classService.getById(req.tenant.id, parseInt(req.params.id), req.user);
      if (!cls) return res.status(404).json({ message: 'Class not found' });
      res.json(cls);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const cls = await classService.create(req.tenant.id, req.body);
      res.status(201).json(cls);
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR') return res.status(422).json({ message: err.message });
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const cls = await classService.update(req.tenant.id, parseInt(req.params.id), req.body);
      if (!cls) return res.status(404).json({ message: 'Class not found' });
      res.json(cls);
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR') return res.status(422).json({ message: err.message });
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      await classService.delete(req.tenant.id, parseInt(req.params.id));
      res.json({ message: 'Deleted successfully' });
    } catch (err) { next(err); }
  }

  async addStudent(req, res, next) {
    try {
      await classService.addStudent(req.tenant.id, parseInt(req.params.id), req.body.studentId);
      res.json({ message: 'Student added' });
    } catch (err) { next(err); }
  }

  async removeStudent(req, res, next) {
    try {
      await classService.removeStudent(req.tenant.id, parseInt(req.params.id), parseInt(req.params.studentId));
      res.json({ message: 'Student removed' });
    } catch (err) { next(err); }
  }

  async getByStudent(req, res, next) {
    try {
      const classes = await classService.getByStudent(req.tenant.id, parseInt(req.params.studentId));
      res.json(classes);
    } catch (err) { next(err); }
  }
}

module.exports = new ClassController();
