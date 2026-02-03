const Student = require('../models/Student');
const { pool } = require('../config/database');

class StudentRepository {
  /**
   * Tạo sinh viên mới
   * @param {Object} data - Dữ liệu sinh viên
   * @returns {Student} - Sinh viên vừa tạo
   */
  async create(data) {
    const query = `
      INSERT INTO students (name, email, phone, address, enrollment_date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, phone, address, enrollment_date, created_at, updated_at
    `;
    
    try {
      const result = await pool.query(query, [
        data.name,
        data.email,
        data.phone,
        data.address,
        data.enrollmentDate
      ]);
      
      const row = result.rows[0];
      const student = new Student(
        row.id,
        row.name,
        row.email,
        row.phone,
        row.address,
        row.enrollment_date
      );
      student.createdAt = row.created_at;
      student.updatedAt = row.updated_at;
      return student;
    } catch (error) {
      throw new Error(`Failed to create student: ${error.message}`);
    }
  }

  /**
   * Lấy tất cả sinh viên
   * @returns {Array} - Danh sách sinh viên
   */
  async getAll() {
    const query = `SELECT * FROM students ORDER BY id DESC`;
    
    try {
      const result = await pool.query(query);
      return result.rows.map(row => {
        const student = new Student(
          row.id,
          row.name,
          row.email,
          row.phone,
          row.address,
          row.enrollment_date
        );
        student.createdAt = row.created_at;
        student.updatedAt = row.updated_at;
        return student;
      });
    } catch (error) {
      throw new Error(`Failed to fetch students: ${error.message}`);
    }
  }

  /**
   * Lấy sinh viên theo ID
   * @param {Number} id - ID sinh viên
   * @returns {Student|null} - Sinh viên hoặc null
   */
  async getById(id) {
    const query = `SELECT * FROM students WHERE id = $1`;
    
    try {
      const result = await pool.query(query, [id]);
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      const student = new Student(
        row.id,
        row.name,
        row.email,
        row.phone,
        row.address,
        row.enrollment_date
      );
      student.createdAt = row.created_at;
      student.updatedAt = row.updated_at;
      return student;
    } catch (error) {
      throw new Error(`Failed to fetch student: ${error.message}`);
    }
  }

  /**
   * Cập nhật thông tin sinh viên
   * @param {Number} id - ID sinh viên
   * @param {Object} data - Dữ liệu cập nhật
   * @returns {Student|null} - Sinh viên đã cập nhật hoặc null
   */
  async update(id, data) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(data.email);
    }
    if (data.phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(data.phone);
    }
    if (data.address !== undefined) {
      updates.push(`address = $${paramCount++}`);
      values.push(data.address);
    }
    if (data.enrollmentDate !== undefined) {
      updates.push(`enrollment_date = $${paramCount++}`);
      values.push(data.enrollmentDate);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE students 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, email, phone, address, enrollment_date, created_at, updated_at
    `;

    try {
      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      const student = new Student(
        row.id,
        row.name,
        row.email,
        row.phone,
        row.address,
        row.enrollment_date
      );
      student.createdAt = row.created_at;
      student.updatedAt = row.updated_at;
      return student;
    } catch (error) {
      throw new Error(`Failed to update student: ${error.message}`);
    }
  }

  /**
   * Xóa sinh viên
   * @param {Number} id - ID sinh viên
   * @returns {Boolean} - True nếu xóa thành công, false nếu không tìm thấy
   */
  async delete(id) {
    const query = `DELETE FROM students WHERE id = $1 RETURNING id`;
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Failed to delete student: ${error.message}`);
    }
  }

  /**
   * Tìm sinh viên theo email
   * @param {String} email - Email sinh viên
   * @returns {Student|null} - Sinh viên hoặc null
   */
  async findByEmail(email) {
    const query = `SELECT * FROM students WHERE email = $1`;
    
    try {
      const result = await pool.query(query, [email]);
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      const student = new Student(
        row.id,
        row.name,
        row.email,
        row.phone,
        row.address,
        row.enrollment_date
      );
      student.createdAt = row.created_at;
      student.updatedAt = row.updated_at;
      return student;
    } catch (error) {
      throw new Error(`Failed to fetch student by email: ${error.message}`);
    }
  }
}

module.exports = new StudentRepository();
