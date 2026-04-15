const dayjs = require('dayjs');

const normalizeDateField = (value) => {
  if (!value) return value;
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD') : value;
};

class Class {
  constructor({ id, name, start_date, capacity, teacher_id, sessions, sessions_per_week, end_date, created_at }) {
    this.id = id;
    this.name = name;
    this.start_date = normalizeDateField(start_date);
    this.capacity = capacity;
    this.teacher_id = teacher_id;
    this.sessions = sessions;
    this.sessions_per_week = sessions_per_week;
    this.end_date = normalizeDateField(end_date);
    this.created_at = created_at;
  }
}

module.exports = Class;
