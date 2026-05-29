const userService = require('../services/user.service');

class UserController {
  async getAll(req, res, next) {
    try {
      const { role, status, search, page, limit, branchId } = req.query;
      const result = await userService.getAll(req.tenant.id, { role, status, search, page, limit, branchId });
      res.json(result);
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const user = await userService.getById(req.tenant.id, parseInt(req.params.id));
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const user = await userService.create(req.tenant.id, req.body);
      res.status(201).json(user);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ message: 'Email hoặc số điện thoại đã tồn tại' });
      }
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const user = await userService.update(req.tenant.id, parseInt(req.params.id), req.body);
      res.json(user);
    } catch (err) { next(err); }
  }

  async toggleStatus(req, res, next) {
    try {
      const user = await userService.getById(req.tenant.id, parseInt(req.params.id));
      if (!user) return res.status(404).json({ message: 'User not found' });
      const updated = await userService.update(req.tenant.id, parseInt(req.params.id), {
        ...user, isActive: !user.is_active
      });
      res.json(updated);
    } catch (err) { next(err); }
  }
}

module.exports = new UserController();
