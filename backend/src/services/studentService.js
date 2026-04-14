// services/studentService.js
// Logic nghiệp vụ cho Student

const studentRepository = require('../repositories/studentRepository');

const studentService = {
  async createStudent(data) {
    // Kiểm tra trùng citizen_id
    const existing = await studentRepository.findByCitizenId(data.citizen_id);
    if (existing) {
      const { ConflictException } = require('../exceptions');
      throw new ConflictException('CMND/CCCD đã tồn tại');
    }
    return await studentRepository.create(data);
  },
  async getStudentById(id) {
    return await studentRepository.findById(id);
  },
  async getAllStudents() {
    return await studentRepository.findAll();
  },
  async updateStudent(id, data) {
    // Nếu có citizen_id mới, kiểm tra trùng (và không phải của chính mình)
    if (data.citizen_id) {
      const existed = await studentRepository.findByCitizenId(data.citizen_id);
      if (existed && existed.id != id) {
        const { ConflictException } = require('../exceptions');
        throw new ConflictException('CMND/CCCD đã tồn tại');
      }
    }
    return await studentRepository.update(id, data);
  },
  async deleteStudent(id) {
    return await studentRepository.delete(id);
  },

  async completeStudentCourse(id, { notes } = {}) {
    const { BadRequestException, NotFoundException } = require('../exceptions');

    const student = await studentRepository.findById(id);
    if (!student) throw new NotFoundException('Không tìm thấy học viên');

    // Nếu DB chưa có cột status/completed_at thì repository sẽ tự xử lý fallback.
    // Nhưng nếu phía business đã có trạng thái "completed" thì chặn gọi lại.
    if (student.status === 'completed') {
      throw new BadRequestException('Học viên này đã ở trạng thái hoàn thành');
    }

    return await studentRepository.completeCourse(id, { notes });
  },

  async getCompletedHistory() {
    return await studentRepository.getCompletedHistory();
  },
};

module.exports = studentService;
