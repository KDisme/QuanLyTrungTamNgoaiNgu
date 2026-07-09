const notificationService = require('../services/notification.service');

class NotificationController {
  async list(req, res, next) {
    try {
      res.json(await notificationService.list(req.tenant.id, req.user.id, req.query));
    } catch (err) {
      next(err);
    }
  }

  async unreadCount(req, res, next) {
    try {
      res.json({ unreadCount: await notificationService.unreadCount(req.tenant.id, req.user.id) });
    } catch (err) {
      next(err);
    }
  }

  async markRead(req, res, next) {
    try {
      const item = await notificationService.markRead(req.tenant.id, req.user.id, parseInt(req.params.id, 10));
      if (!item) return res.status(404).json({ message: 'Notification not found' });
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  async markAllRead(req, res, next) {
    try {
      await notificationService.markAllRead(req.tenant.id, req.user.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();