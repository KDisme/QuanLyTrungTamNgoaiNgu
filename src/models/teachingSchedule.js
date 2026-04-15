class TeachingSchedule {
  constructor({ id, teacher_id, class_id, day_of_week, teaching_date, start_time, end_time, room, created_at }) {
    this.id = id;
    this.teacher_id = teacher_id;
    this.class_id = class_id;
    this.day_of_week = day_of_week;
    this.teaching_date = teaching_date;
    this.start_time = start_time;
    this.end_time = end_time;
    this.room = room;
    this.created_at = created_at;
  }
}

module.exports = TeachingSchedule;