const homeworkService = require('../services/homework.service');

class HomeworkController {
  async list(req, res, next) {
    try {
      res.json(await homeworkService.listAssignments(req.tenant.id, req.user, req.query));
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const item = await homeworkService.getAssignment(req.tenant.id, parseInt(req.params.id, 10), req.user, req.query.password || null);
      if (!item) return res.status(404).json({ message: 'Homework assignment not found' });
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      res.status(201).json(await homeworkService.createAssignment(req.tenant.id, req.user, req.body));
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const item = await homeworkService.updateAssignment(req.tenant.id, parseInt(req.params.id, 10), req.user, req.body);
      if (!item) return res.status(404).json({ message: 'Homework assignment not found' });
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      await homeworkService.deleteAssignment(req.tenant.id, parseInt(req.params.id, 10), req.user);
      res.json({ message: 'Deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  async submit(req, res, next) {
    try {
      const item = await homeworkService.submitAssignment(req.tenant.id, parseInt(req.params.id, 10), req.user.id, req.body);
      if (!item) return res.status(404).json({ message: 'Homework assignment not found' });
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  async grade(req, res, next) {
    try {
      const item = await homeworkService.gradeSubmission(req.tenant.id, parseInt(req.params.submissionId, 10), req.user.id, req.body);
      if (!item) return res.status(404).json({ message: 'Homework submission not found' });
      res.json(item);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new HomeworkController();