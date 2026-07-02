const branchService = require('../services/branch.service');

class BranchController {
  async getAll(req, res, next) {
    try {
      const result = await branchService.getAll(req.tenant.id, req.query);
      res.json(result);
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const branch = await branchService.getById(req.tenant.id, parseInt(req.params.id));
      if (!branch) return res.status(404).json({ message: 'Branch not found' });
      res.json(branch);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const branch = await branchService.create(req.tenant.id, req.body);
      res.status(201).json(branch);
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const branch = await branchService.update(req.tenant.id, parseInt(req.params.id), req.body);
      if (!branch) return res.status(404).json({ message: 'Branch not found' });
      res.json(branch);
    } catch (err) { next(err); }
  }

  async delete(req, res, next) {
    try {
      await branchService.delete(req.tenant.id, parseInt(req.params.id));
      res.json({ message: 'Deleted successfully' });
    } catch (err) { next(err); }
  }

  async addRoom(req, res, next) {
    try {
      const room = await branchService.addRoom(req.tenant.id, parseInt(req.params.id), req.body);
      res.status(201).json(room);
    } catch (err) { next(err); }
  }

  async updateRoom(req, res, next) {
    try {
      const room = await branchService.updateRoom(req.tenant.id, parseInt(req.params.roomId), req.body);
      res.json(room);
    } catch (err) { next(err); }
  }

  async deleteRoom(req, res, next) {
    try {
      await branchService.deleteRoom(req.tenant.id, parseInt(req.params.roomId));
      res.json({ message: 'Room deleted successfully' });
    } catch (err) { next(err); }
  }
}

module.exports = new BranchController();
