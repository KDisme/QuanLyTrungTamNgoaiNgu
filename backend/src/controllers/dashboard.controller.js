const dashboardService = require('../services/dashboard.service');

class DashboardController {
  async getStats(req, res, next) {
    try {
      const stats = await dashboardService.getStats(req.tenant.id);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DashboardController();