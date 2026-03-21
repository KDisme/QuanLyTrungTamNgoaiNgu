// services/teachingScheduleService.js
// Logic nghiệp vụ cho Teaching Schedule

const teachingScheduleRepository = require('../repositories/teachingScheduleRepository');

const teachingScheduleService = {
  async createSchedule(data) {
    return await teachingScheduleRepository.create(data);
  },
  async getScheduleById(id) {
    return await teachingScheduleRepository.findById(id);
  },
  async getAllSchedules() {
    return await teachingScheduleRepository.findAll();
  },
  async getSchedulesByTeacherId(teacher_id) {
    return await teachingScheduleRepository.findByTeacherId(teacher_id);
  },
  async getSchedulesByClassId(class_id) {
    return await teachingScheduleRepository.findByClassId(class_id);
  },
  async updateSchedule(id, data) {
    return await teachingScheduleRepository.update(id, data);
  },
  async deleteSchedule(id) {
    return await teachingScheduleRepository.delete(id);
  },
};

module.exports = teachingScheduleService;
