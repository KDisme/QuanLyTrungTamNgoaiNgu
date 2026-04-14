// services/classService.js
// Logic nghiệp vụ cho Class

const classRepository = require('../repositories/classRepository');

const classService = {
  async createClass(data) {
    return await classRepository.create(data);
  },
  async getClassById(id) {
    return await classRepository.findById(id);
  },
  async getAllClasses() {
    return await classRepository.findAll();
  },
  async updateClass(id, data) {
    return await classRepository.update(id, data);
  },
  async deleteClass(id) {
    return await classRepository.delete(id);
  },
};

module.exports = classService;
