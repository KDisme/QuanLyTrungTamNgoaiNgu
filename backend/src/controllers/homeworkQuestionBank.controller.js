const bankService = require('../services/homeworkQuestionBank.service');

class HomeworkQuestionBankController {
  async list(req, res, next) {
    try {
      res.json(await bankService.list(req.tenant.id, req.query));
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      res.status(201).json(await bankService.create(req.tenant.id, req.user, req.body));
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const item = await bankService.update(req.tenant.id, parseInt(req.params.id, 10), req.body);
      if (!item) return res.status(404).json({ message: 'Question bank item not found' });
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      await bankService.delete(req.tenant.id, parseInt(req.params.id, 10));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  async bulkCreate(req, res, next) {
    try {
      const items = await bankService.bulkCreate(req.tenant.id, req.user, req.body.questions || [], req.body.category || null);
      res.status(201).json({ items });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new HomeworkQuestionBankController();