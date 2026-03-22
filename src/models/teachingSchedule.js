class TeachingSchedule {
  constructor({ id, class_id, teaching_date, start_time, end_time, room, created_at }) {
    this.id = id;
    this.class_id = class_id;
    this.teaching_date = teaching_date;
    this.start_time = start_time;
    this.end_time = end_time;
    this.room = room;
    this.created_at = created_at;
  }
}

module.exports = TeachingSchedule;