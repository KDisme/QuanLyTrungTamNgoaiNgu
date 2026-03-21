// repositories/studentRepository.js
// Thao tác với bảng students

const pool = require('../config/db');
const Student = require('../models/student');

const studentRepository = {
  async create({ name, email, birth_date, citizen_id, target_score, class_id }) {
    const result = await pool.query(
      'INSERT INTO students (name, email, birth_date, citizen_id, target_score, class_id, enrollment_date, created_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, CURRENT_TIMESTAMP) RETURNING *',
      [name, email, birth_date, citizen_id, target_score, class_id]
    );
    return new Student(result.rows[0]);
  },

  async findByCitizenId(citizen_id) {
    const result = await pool.query('SELECT * FROM students WHERE citizen_id = $1', [citizen_id]);
    if (result.rows[0]) return new Student(result.rows[0]);
    return null;
  },

  async findById(id) {
    const result = await pool.query(
      `SELECT s.*, c.name AS class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1`,
      [id]
    );
    if (result.rows[0]) return new Student(result.rows[0]);
    return null;
  },

  async findAll() {
    const result = await pool.query(
      `SELECT s.*, c.name AS class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       ORDER BY s.id ASC`
    );
    return result.rows.map(row => new Student(row));
  },

  async update(id, { name, email, birth_date, citizen_id, target_score, class_id }) {
    // Lấy dữ liệu hiện tại
    const current = await this.findById(id);
    if (!current) return null;

    // Chỉ cập nhật các trường được gửi
    const updated = {
      name: name !== undefined ? name : current.name,
      email: email !== undefined ? email : current.email,
      birth_date: birth_date !== undefined ? birth_date : current.birth_date,
      citizen_id: citizen_id !== undefined ? citizen_id : current.citizen_id,
      target_score: target_score !== undefined ? target_score : current.target_score,
      class_id: class_id !== undefined ? class_id : current.class_id,
    };

    const result = await pool.query(
      'UPDATE students SET name = $1, email = $2, birth_date = $3, citizen_id = $4, target_score = $5, class_id = $6 WHERE id = $7 RETURNING *',
      [updated.name, updated.email, updated.birth_date, updated.citizen_id, updated.target_score, updated.class_id, id]
    );
    if (result.rows[0]) return new Student(result.rows[0]);
    return null;
  },

  async delete(id) {
    await pool.query('DELETE FROM students WHERE id = $1', [id]);
    return true;
  },

  async completeCourse(id, { notes } = {}) {
    const { InternalServerException, BadRequestException } = require('../exceptions');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock row để tránh race conditions khi bấm nhiều lần
      const sRes = await client.query(
        `SELECT s.*, c.name AS class_name
         FROM students s
         LEFT JOIN classes c ON c.id = s.class_id
         WHERE s.id = $1
         FOR UPDATE OF s`,
        [id]
      );
      const student = sRes.rows[0];
      if (!student) throw new BadRequestException('Không tìm thấy học viên');

      // Yêu cầu phổ biến: học viên phải có class_id để “hoàn thành khóa học hiện tại”
      if (!student.class_id) {
        throw new BadRequestException('Học viên chưa được xếp lớp nên không thể đánh dấu hoàn thành');
      }

      // 1) Ghi lịch sử hoàn thành
      await client.query(
        `INSERT INTO student_completion_histories
          (student_id, class_id, class_name, completed_at, notes, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP)`,
        [student.id, student.class_id, student.class_name || null, notes || null]
      );

      // 2) Cập nhật trạng thái trong bảng students (nếu có cột)
      // Một số DB có cột status/completed_at, một số không. Ta thử update, nếu lỗi cột không tồn tại thì bỏ qua.
      let updatedStudent = null;
      try {
        const uRes = await client.query(
          `UPDATE students
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING *`,
          [id]
        );
        updatedStudent = uRes.rows[0] ? new Student(uRes.rows[0]) : null;
      } catch (e) {
        // Nếu thiếu cột status/completed_at, giao dịch vẫn hợp lệ vì lịch sử đã được ghi.
        updatedStudent = new Student(student);
      }

      await client.query('COMMIT');
      return { student: updatedStudent };
    } catch (err) {
      await client.query('ROLLBACK');
      if (err?.statusCode) throw err;
      throw new InternalServerException(err.message || 'Lỗi cập nhật trạng thái hoàn thành');
    } finally {
      client.release();
    }
  },

  async getCompletedHistory() {
    const res = await pool.query(
      `SELECT
         h.id,
         h.student_id,
         s.name  AS student_name,
         s.email AS student_email,
         h.class_id,
         h.class_name,
         h.completed_at,
         h.notes,
         h.created_at
       FROM student_completion_histories h
       JOIN students s ON s.id = h.student_id
       ORDER BY h.completed_at DESC, h.id DESC`
    );
    return res.rows;
  },
};

module.exports = studentRepository;
