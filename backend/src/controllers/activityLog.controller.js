const activityLogService = require('../services/activityLog.service');

class ActivityLogController {
  async list(req, res, next) {
    try {
      const result = await activityLogService.list(req.tenant.id, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getActors(req, res, next) {
    try {
      const actors = await activityLogService.getDistinctActors(req.tenant.id);
      res.json({ actors });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ActivityLogController();