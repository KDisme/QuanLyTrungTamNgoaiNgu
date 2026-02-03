const StudentRepository = require('../repositories/StudentRepository');

class StudentService {
  /**
   * Tạo sinh viên mới
   * @param {Object} studentData - Dữ liệu sinh viên
   * @returns {Object} - Kết quả tạo sinh viên
   */
  async createStudent(studentData) {
    // Kiểm tra email không trùng lặp
    const existingStudent = await StudentRepository.findByEmail(studentData.email);
    if (existingStudent) {
      throw new Error('Email already exists');
    }

    const student = await StudentRepository.create(studentData);
    return {
      success: true,
      message: 'Student created successfully',
      data: student.toJSON(),
    };
  }

  /**
   * Lấy tất cả sinh viên
   * @returns {Object} - Danh sách sinh viên
   */
  async getAllStudents() {
    const students = await StudentRepository.getAll();
    return {
      success: true,
      message: 'Students retrieved successfully',
      data: students.map((s) => s.toJSON()),
      total: students.length,
    };
  }

  /**
   * Lấy sinh viên theo ID
   * @param {Number} id - ID sinh viên
   * @returns {Object} - Thông tin sinh viên
   */
  async getStudentById(id) {
    const student = await StudentRepository.getById(id);
    if (!student) {
      throw new Error('Student not found');
    }

    return {
      success: true,
      message: 'Student retrieved successfully',
      data: student.toJSON(),
    };
  }

  /**
   * Cập nhật thông tin sinh viên
   * @param {Number} id - ID sinh viên
   * @param {Object} studentData - Dữ liệu cập nhật
   * @returns {Object} - Kết quả cập nhật
   */
  async updateStudent(id, studentData) {
    const student = await StudentRepository.getById(id);
    if (!student) {
      throw new Error('Student not found');
    }

    // Kiểm tra email không trùng lặp (nếu email được thay đổi)
    if (studentData.email && studentData.email !== student.email) {
      const existingStudent = await StudentRepository.findByEmail(studentData.email);
      if (existingStudent) {
        throw new Error('Email already exists');
      }
    }

    const updatedStudent = await StudentRepository.update(id, studentData);
    return {
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent.toJSON(),
    };
  }

  /**
   * Xóa sinh viên
   * @param {Number} id - ID sinh viên
   * @returns {Object} - Kết quả xóa
   */
  async deleteStudent(id) {
    const student = await StudentRepository.getById(id);
    if (!student) {
      throw new Error('Student not found');
    }

    await StudentRepository.delete(id);
    return {
      success: true,
      message: 'Student deleted successfully',
      data: null,
    };
  }
}

module.exports = new StudentService();
