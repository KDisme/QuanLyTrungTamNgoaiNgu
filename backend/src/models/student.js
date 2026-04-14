// models/student.js
// Định nghĩa cấu trúc Student

class Student {
  constructor({
    id,
    name,
    email,
    birth_date,
    citizen_id,
    target_score,
    class_id,
    enrollment_date,
    created_at,
    status,
    completed_at,
    class_name,
  }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.birth_date = birth_date;
    this.citizen_id = citizen_id;
    this.target_score = target_score;
    this.class_id = class_id;
    this.enrollment_date = enrollment_date;
    this.created_at = created_at;
    this.status = status;
    this.completed_at = completed_at;
    this.class_name = class_name;
  }
}

module.exports = Student;
