// services/teacherService.js
// Logic nghiệp vụ cho Teacher

const teacherRepository = require('../repositories/teacherRepository');

const teacherService = {
  async createTeacher(data) {
    return await teacherRepository.create(data);
  },
  async getTeacherById(id) {
    return await teacherRepository.findById(id);
  },
  async getAllTeachers() {
    return await teacherRepository.findAll();
  },
  async updateTeacher(id, data) {
    return await teacherRepository.update(id, data);
  },
  async deleteTeacher(id) {
    return await teacherRepository.delete(id);
  },
};

module.exports = teacherService;
