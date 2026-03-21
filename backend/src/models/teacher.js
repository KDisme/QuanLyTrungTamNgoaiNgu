// models/teacher.js
// Định nghĩa cấu trúc Teacher

class Teacher {
  constructor({ id, full_name, phone, email, date_of_birth, created_at }) {
    this.id = id;
    this.full_name = full_name;
    this.phone = phone;
    this.email = email;
    this.date_of_birth = date_of_birth;
    this.created_at = created_at;
  }
}

module.exports = Teacher;
