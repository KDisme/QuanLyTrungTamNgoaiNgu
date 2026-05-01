const { pool } = require('../config/db');
const teachingScheduleRepository = require('../repositories/teachingScheduleRepository');
const teacherRepository = require('../repositories/teacherRepository');
const classRepository = require('../repositories/classRepository');

const {
  ApiError,
  NotFoundException,
  ConflictException,
} = require('../exceptions');

const {
  validateId,
  validateResourceExists,
} = require('../validators/commonValidators');

const {
  validateCreateTeachingScheduleData,
  validateUpdateTeachingScheduleData,
  validateCreateMakeupScheduleData,
} = require('../validators/teachingScheduleValidator');

const dayjs = require('dayjs');


// ================= HELPER =================
const getTeachingDates = (startDate, dayOfWeekArray, totalSessions) => {
  const result = [];
  if (!startDate || !Array.isArray(dayOfWeekArray) || dayOfWeekArray.length === 0 || !totalSessions || totalSessions <= 0) {
    return result;
  }

  const sortedDays = [...new Set(dayOfWeekArray)].sort((a, b) => a - b);
  const classStart = dayjs(startDate);
  if (!classStart.isValid()) {
    return result;
  }

  let current = classStart;
  const startDow = classStart.day();
  let index = sortedDays.findIndex((dow) => dow >= startDow);

  if (index === -1) {
    index = 0;
    current = classStart.add(7 - startDow + sortedDays[0], 'day');
  } else {
    current = classStart.add(sortedDays[index] - startDow, 'day');
  }

  for (let i = 0; i < totalSessions; i += 1) {
    result.push(current.format('YYYY-MM-DD'));

    if (i === totalSessions - 1) break;

    if (index + 1 < sortedDays.length) {
      const delta = sortedDays[index + 1] - sortedDays[index];
      current = current.add(delta, 'day');
      index += 1;
    } else {
      const delta = 7 - sortedDays[index] + sortedDays[0];
      current = current.add(delta, 'day');
      index = 0;
    }
  }

  return result;
};

const validateTime = (start, end) => {
  if (start >= end) {
    throw new ApiError(422, 'start_time phải nhỏ hơn end_time', 'INVALID_TIME');
  }
};


// ================= SERVICE =================
const teachingScheduleService = {

  // ================= CREATE (RECURRING) =================
  async createSchedules(data) {
    validateCreateTeachingScheduleData(data);
    validateTime(data.start_time, data.end_time);

    const classData = await classRepository.findById(data.class_id);
    validateResourceExists(classData, 'class');

    const teacherId = data.teacher_id || classData.teacher_id;
    if (!teacherId) {
      throw new ApiError(422, 'Lớp chưa có giáo viên', 'MISSING_TEACHER');
    }

    const teacher = await teacherRepository.findById(teacherId);
    validateResourceExists(teacher, 'teacher');

    if (!classData.start_date || !classData.sessions) {
      throw new ApiError(422, 'Lớp thiếu ngày bắt đầu hoặc tổng số buổi', 'INVALID_CLASS');
    }

    if (classData.sessions_per_week === undefined || classData.sessions_per_week === null) {
      throw new ApiError(422, 'Lớp thiếu số buổi trong tuần', 'INVALID_CLASS');
    }

    if (Number(classData.sessions_per_week) !== data.day_of_week.length) {
      throw new ApiError(
        422,
        'Số buổi trong tuần phải trùng với số ngày trong tuần được chọn',
        'INVALID_WEEKLY_SCHEDULE'
      );
    }

    if (classData.sessions !== undefined && Number(classData.sessions) < Number(classData.sessions_per_week)) {
      throw new ApiError(
        422,
        'Tổng số buổi phải lớn hơn hoặc bằng số buổi trong tuần',
        'INVALID_SESSION_COUNTS'
      );
    }

    // 👉 Tạo danh sách ngày học
    const teachingDates = getTeachingDates(
      classData.start_date,
      data.day_of_week,
      Number(classData.sessions)
    );

    if (classData.sessions !== undefined && Number(classData.sessions) !== teachingDates.length) {
      throw new ApiError(
        422,
        `Số buổi học của class (${classData.sessions}) không trùng với tổng số lịch học (${teachingDates.length})`,
        'CLASS_SCHEDULE_MISMATCH'
      );
    }

    // ================= CHECK CONFLICT TRƯỚC =================
    for (const date of teachingDates) {
      const teacherConflict = await teachingScheduleRepository.checkScheduleConflict(
        teacherId,
        date,
        data.start_time,
        data.end_time
      );

      if (teacherConflict) {
        throw new ConflictException(
          `Giáo viên bị trùng lịch ngày ${date}`,
          'TEACHER_CONFLICT'
        );
      }

      const roomConflict = await teachingScheduleRepository.checkRoomConflict(
        data.room,
        date,
        data.start_time,
        data.end_time
      );

      if (roomConflict) {
        throw new ConflictException(
          `Phòng học bị trùng lịch ngày ${date}`,
          'ROOM_CONFLICT'
        );
      }
    }

    // ================= TRANSACTION =================
    const client = await pool.connect();
    const created = [];

    try {
      await client.query('BEGIN');

      for (const date of teachingDates) {
        const schedule = await client.query(
          `INSERT INTO teaching_schedules 
          (teacher_id, class_id, day_of_week, teaching_date, start_time, end_time, room, status, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
          RETURNING *`,
          [
            teacherId,
            data.class_id,
            dayjs(date).day(),
            date,
            data.start_time,
            data.end_time,
            data.room,
            'SCHEDULED',
          ]
        );

        created.push(schedule.rows[0]);
      }

      // update end_date
      const endDate = teachingDates[teachingDates.length - 1];

      await client.query(
        `UPDATE classes SET end_date = $1 WHERE id = $2`,
        [endDate, data.class_id]
      );

      await client.query('COMMIT');
      return created;

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },


  // ================= UPDATE =================
  async updateSchedule(id, data) {
    validateId(id, 'schedule');
    validateUpdateTeachingScheduleData(data);

    const existing = await teachingScheduleRepository.findById(id);
    validateResourceExists(existing, 'schedule');

    const teacherId = data.teacher_id ?? existing.teacher_id;
    const teachingDate = data.teaching_date ?? existing.teaching_date;
    const startTime = data.start_time ?? existing.start_time;
    const endTime = data.end_time ?? existing.end_time;
    const room = data.room ?? existing.room;

    validateTime(startTime, endTime);

    // update day_of_week nếu đổi ngày
    const dayOfWeek = dayjs(teachingDate).day();

    // check conflict
    const teacherConflict = await teachingScheduleRepository.checkScheduleConflict(
      teacherId,
      teachingDate,
      startTime,
      endTime,
      id
    );

    if (teacherConflict) {
      throw new ConflictException('Giáo viên trùng lịch', 'TEACHER_CONFLICT');
    }

    const roomConflict = await teachingScheduleRepository.checkRoomConflict(
      room,
      teachingDate,
      startTime,
      endTime,
      id
    );

    if (roomConflict) {
      throw new ConflictException('Phòng học trùng lịch', 'ROOM_CONFLICT');
    }

    // update
    const result = await pool.query(
      `UPDATE teaching_schedules
       SET teacher_id=$1,
           class_id=$2,
           day_of_week=$3,
           teaching_date=$4,
           start_time=$5,
           end_time=$6,
           room=$7,
           status=$8
       WHERE id=$9
       RETURNING *`,
      [
        teacherId,
        data.class_id ?? existing.class_id,
        dayOfWeek,
        teachingDate,
        startTime,
        endTime,
        room,
        data.status ?? existing.status,
        id,
      ]
    );

    return result.rows[0];
  },


  // ================= DELETE =================
  async deleteSchedule(id) {
    validateId(id, 'schedule');

    const existing = await teachingScheduleRepository.findById(id);
    validateResourceExists(existing, 'schedule');

    await teachingScheduleRepository.delete(id);
    return true;
  },


  // ================= CANCEL =================
  async cancelSchedule(id) {
    validateId(id, 'schedule');

    const schedule = await teachingScheduleRepository.findById(id);
    validateResourceExists(schedule, 'schedule');

    if (schedule.status === 'CANCELLED') {
      throw new ApiError(422, 'Lịch học đã được hủy', 'ALREADY_CANCELLED');
    }

    if (schedule.status === 'MAKEUP') {
      throw new ApiError(422, 'Không thể hủy lịch học bù', 'INVALID_ACTION');
    }

    return await this.updateSchedule(id, { status: 'CANCELLED' });
  },


  // ================= MAKEUP =================
  async createMakeup(data) {
    validateCreateMakeupScheduleData(data);
    validateTime(data.start_time, data.end_time);

    const original = await teachingScheduleRepository.findById(data.original_schedule_id);
    validateResourceExists(original, 'original_schedule');

    const teacherId = original.teacher_id;

    // conflict
    const teacherConflict = await teachingScheduleRepository.checkScheduleConflict(
      teacherId,
      data.teaching_date,
      data.start_time,
      data.end_time
    );

    if (teacherConflict) {
      throw new ConflictException('Giáo viên trùng lịch', 'TEACHER_CONFLICT');
    }

    const roomConflict = await teachingScheduleRepository.checkRoomConflict(
      data.room,
      data.teaching_date,
      data.start_time,
      data.end_time
    );

    if (roomConflict) {
      throw new ConflictException('Phòng học trùng lịch', 'ROOM_CONFLICT');
    }

    const duplicateMakeup = await teachingScheduleRepository.findExistingMakeupSchedule(
      data.original_schedule_id,
      data.teaching_date,
      data.start_time,
      data.end_time
    );

    if (duplicateMakeup) {
      throw new ConflictException('Lịch học bù đã tồn tại cho lịch gốc và thời gian này', 'DUPLICATE_MAKEUP');
    }

    if (original.status === 'MAKEUP') {
      throw new ApiError(422, 'Không thể tạo lịch bù cho một lịch học bù', 'INVALID_ORIGINAL_SCHEDULE');
    }

    return await teachingScheduleRepository.createMakeupSchedule({
      teacher_id: teacherId,
      class_id: original.class_id,
      original_schedule_id: data.original_schedule_id,
      teaching_date: data.teaching_date,
      start_time: data.start_time,
      end_time: data.end_time,
      room: data.room,
      notes: data.notes,
    });
  },


  // ================= GET =================
  async getAll() {
    return await teachingScheduleRepository.findAll();
  },

  async getById(id) {
    validateId(id);
    return await teachingScheduleRepository.findById(id);
  },

  async getByTeacher(id) {
    return await teachingScheduleRepository.findByTeacherId(id);
  },

  async getByClass(id) {
    return await teachingScheduleRepository.findByClassId(id);
  },

  async getByDate(date) {
    return await teachingScheduleRepository.findByDate(date);
  },

};

module.exports = teachingScheduleService;
