// models/class.js
// Định nghĩa cấu trúc Class

class Class {
  constructor({ id, name, start_date, end_date, capacity, teacher_id, sessions, created_at }) {
    this.id = id;
    this.name = name;
    this.start_date = start_date;
    this.end_date = end_date;
    this.capacity = capacity;
    this.teacher_id = teacher_id;
    this.sessions = sessions;
    this.created_at = created_at;
  }
}

module.exports = Class;
