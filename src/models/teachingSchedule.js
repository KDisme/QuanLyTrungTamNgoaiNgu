class TeachingSchedule {
  constructor({ id, teacher_id, class_id, day_of_week, start_time, end_time, room, created_at }) {
    this.id = id;
    this.teacher_id = teacher_id; // thêm dòng này
    this.class_id = class_id;
    this.day_of_week = day_of_week;
    this.start_time = start_time;
    this.end_time = end_time;
    this.room = room;
    this.created_at = created_at;
  }
}

module.exports = TeachingSchedule;