// services/teachingScheduleService.js
// Logic nghiệp vụ cho TeachingSchedule - Business Logic Layer

const teachingScheduleRepository = require('../repositories/teachingScheduleRepository');
const teacherRepository = require('../repositories/teacherRepository');
const classRepository = require('../repositories/classRepository');
const { ApiError, NotFoundException, ConflictException } = require('../exceptions');
const { validateId, validateResourceExists } = require('../validators/commonValidators');
const { validateCreateTeachingScheduleData, validateUpdateTeachingScheduleData } = require('../validators/teachingScheduleValidator');
const dayjs = require('dayjs');


/**
 * TeachingSchedule Service
 * Xử lý toàn bộ logic nghiệp vụ cho lịch giảng dạy
 * Thực hiện validation, kiểm tra ràng buộc, gọi repository
 */
const teachingScheduleService = {
  /**
   * Tạo lịch giảng dạy mới
   * Kiểm tra giáo viên và lớp tồn tại, kiểm tra xung đột lịch
   * @throws {NotFoundException} Nếu giáo viên hoặc lớp không tồn tại
   * @throws {ConflictException} Nếu có xung đột lịch
   * @throws {ApiError} Nếu dữ liệu không hợp lệ
   */
  async createTeachingSchedule(data) {
    // Validate dữ liệu
    validateCreateTeachingScheduleData(data);

    // Kiểm tra giáo viên tồn tại
    const teacher = await teacherRepository.findById(data.teacher_id);
    validateResourceExists(teacher, 'teacher');

    // Kiểm tra lớp học tồn tại
    const classData = await classRepository.findById(data.class_id);
    validateResourceExists(classData, 'class');

    // Kiểm tra xung đột lịch giáo viên
    const teacherConflict = await teachingScheduleRepository.checkScheduleConflict(
      data.teacher_id, data.teaching_date, data.start_time, data.end_time
    );
    if (teacherConflict) {
      throw new ConflictException('Giáo viên đã có lịch giảng dạy trong thời gian này', 'TEACHER_SCHEDULE_CONFLICT');
    }

    // Kiểm tra xung đột phòng học
    const roomConflict = await teachingScheduleRepository.checkRoomConflict(
      data.room, data.teaching_date, data.start_time, data.end_time
    );
    if (roomConflict) {
      throw new ConflictException('Phòng học đã được sử dụng trong thời gian này', 'ROOM_CONFLICT');
    }

    return await teachingScheduleRepository.create(data);
  },

  /**
   * Lấy thông tin lịch giảng dạy theo ID
   * @throws {NotFoundException} Nếu lịch giảng dạy không tồn tại
   */
  async getTeachingScheduleById(id) {
    validateId(id, 'lịch giảng dạy');

    const schedule = await teachingScheduleRepository.findById(id);
    validateResourceExists(schedule, 'teachingSchedule');

    return schedule;
  },

  /**
   * Lấy toàn bộ danh sách lịch giảng dạy
   */
  async getAllTeachingSchedules() {
    return await teachingScheduleRepository.findAll();
  },

  /**
   * Lấy lịch giảng dạy theo giáo viên
   * @throws {NotFoundException} Nếu giáo viên không tồn tại
   */
  async getTeachingSchedulesByTeacher(teacher_id) {
    validateId(teacher_id, 'giáo viên');

    const teacher = await teacherRepository.findById(teacher_id);
    validateResourceExists(teacher, 'teacher');

    return await teachingScheduleRepository.findByTeacherId(teacher_id);
  },

  /**
   * Lấy lịch giảng dạy theo lớp học
   * @throws {NotFoundException} Nếu lớp học không tồn tại
   */
  async getTeachingSchedulesByClass(class_id) {
    validateId(class_id, 'lớp học');

    const classData = await classRepository.findById(class_id);
    validateResourceExists(classData, 'class');

    return await teachingScheduleRepository.findByClassId(class_id);
  },

  /**
   * Lấy lịch giảng dạy theo ngày
   */
  async getTeachingSchedulesByDate(teaching_date) {
    // Validate date format (assuming YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(teaching_date)) {
      throw new ApiError(400, 'Định dạng ngày không hợp lệ. Sử dụng YYYY-MM-DD', 'INVALID_DATE_FORMAT');
    }

    return await teachingScheduleRepository.findByDate(teaching_date);
  },

  /**
   * Cập nhật thông tin lịch giảng dạy
   * Kiểm tra xung đột lịch nếu thay đổi thời gian hoặc giáo viên/phòng
   * @throws {NotFoundException} Nếu lịch giảng dạy không tồn tại
   * @throws {ConflictException} Nếu có xung đột lịch
   */
  async updateTeachingSchedule(id, data) {
    validateId(id, 'lịch giảng dạy');

    const existing = await teachingScheduleRepository.findById(id);
    validateResourceExists(existing, 'teachingSchedule');

    // Validate dữ liệu cập nhật
    validateUpdateTeachingScheduleData(data);

    // Kiểm tra giáo viên tồn tại nếu có thay đổi
    if (data.teacher_id !== undefined) {
      const teacher = await teacherRepository.findById(data.teacher_id);
      validateResourceExists(teacher, 'teacher');
    }

    // Kiểm tra lớp học tồn tại nếu có thay đổi
    if (data.class_id !== undefined) {
      const classData = await classRepository.findById(data.class_id);
      validateResourceExists(classData, 'class');
    }

    // Nếu có thay đổi thời gian, giáo viên hoặc phòng, kiểm tra xung đột
    const hasTimeChange = data.teaching_date !== undefined || data.start_time !== undefined || data.end_time !== undefined;
    const hasTeacherChange = data.teacher_id !== undefined;
    const hasRoomChange = data.room !== undefined;

    if (hasTimeChange || hasTeacherChange || hasRoomChange) {
      const teacherId = data.teacher_id !== undefined ? data.teacher_id : existing.teacher_id;
      const teachingDate = data.teaching_date !== undefined ? data.teaching_date : existing.teaching_date;
      const startTime = data.start_time !== undefined ? data.start_time : existing.start_time;
      const endTime = data.end_time !== undefined ? data.end_time : existing.end_time;
      const room = data.room !== undefined ? data.room : existing.room;

      // Kiểm tra xung đột lịch giáo viên
      const teacherConflict = await teachingScheduleRepository.checkScheduleConflict(
        teacherId, teachingDate, startTime, endTime, id
      );
      if (teacherConflict) {
        throw new ConflictException('Giáo viên đã có lịch giảng dạy trong thời gian này', 'TEACHER_SCHEDULE_CONFLICT');
      }

      // Kiểm tra xung đột phòng học
      const roomConflict = await teachingScheduleRepository.checkRoomConflict(
        room, teachingDate, startTime, endTime, id
      );
      if (roomConflict) {
        throw new ConflictException('Phòng học đã được sử dụng trong thời gian này', 'ROOM_CONFLICT');
      }
    }

    return await teachingScheduleRepository.update(id, data);
  },

  /**
   * Xóa lịch giảng dạy
   * @throws {NotFoundException} Nếu lịch giảng dạy không tồn tại
   */
  async deleteTeachingSchedule(id) {
    validateId(id, 'lịch giảng dạy');

    const schedule = await teachingScheduleRepository.findById(id);
    validateResourceExists(schedule, 'teachingSchedule');

    return await teachingScheduleRepository.delete(id);
  },
 async createBulkSchedule(data) {
        const { 
            class_id, 
            teacher_id, 
            start_date, 
            end_date, 
            start_time, 
            end_time, 
            room, 
            selectedDays 
        } = data;

        const createdSchedules = [];
        let currentDate = dayjs(start_date);
        const lastDate = dayjs(end_date);

        // Vòng lặp rải lịch
        while (currentDate.isBefore(lastDate) || currentDate.isSame(lastDate)) {
            const dayOfWeek = currentDate.day(); // 0 (CN) -> 6 (T7)
            
            if (selectedDays.includes(dayOfWeek)) {
                await teachingScheduleRepository.create({
                    class_id,
                    teacher_id,
                    teaching_date: currentDate.format('YYYY-MM-DD'),
                    start_time,
                    end_time,
                    room
                });
            }
            currentDate = currentDate.add(1, 'day');
        }
        return { count: "Success" };
    },

    async getAllSchedules() {
        return await teachingScheduleRepository.findAll();
    },

    async deleteSchedule(id) {
        return await teachingScheduleRepository.delete(id);
    }

};

module.exports = teachingScheduleService;
