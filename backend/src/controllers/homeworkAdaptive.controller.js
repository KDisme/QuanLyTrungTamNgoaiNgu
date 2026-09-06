const adaptiveService = require('../services/homeworkAdaptive.service');

class HomeworkAdaptiveController {
  async start(req, res, next) {
    try {
      const result = await adaptiveService.start(req.tenant.id, req.user, parseInt(req.params.id, 10));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async answer(req, res, next) {
    try {
      const result = await adaptiveService.answer(req.tenant.id, req.user, parseInt(req.params.sessionId, 10), req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new HomeworkAdaptiveController();