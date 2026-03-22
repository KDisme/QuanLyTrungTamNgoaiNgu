/**
 * Error Codes for Class Management
 * Định dạng: [MODULE]_[ACTION]_[ERROR_TYPE]
 */
const ERROR_CODES = {
  // Class - Get
  CLASS_NOT_FOUND: 'CLASS_001',
  
  // Class - Create
  CLASS_MISSING_REQUIRED_FIELDS: 'CLASS_002',
  CLASS_INVALID_DATES: 'CLASS_003',
  CLASS_INVALID_CAPACITY: 'CLASS_004',
  CLASS_INVALID_SESSIONS: 'CLASS_005',
  CLASS_END_DATE_IN_PAST: 'CLASS_006',
  CLASS_CREATION_FAILED: 'CLASS_007',
  
  // Class - Update
  CLASS_UPDATE_FAILED: 'CLASS_008',
  CLASS_NO_FIELDS_TO_UPDATE: 'CLASS_009',
  
  // Class - Delete
  CLASS_DELETE_FAILED: 'CLASS_010',
  
  // Teacher Assignment
  TEACHER_NOT_PROVIDED: 'CLASS_011',
  TEACHER_NOT_FOUND: 'CLASS_012',
  TEACHER_ASSIGNMENT_FAILED: 'CLASS_013',
  
  // Students Assignment
  STUDENTS_NOT_PROVIDED: 'CLASS_014',
  STUDENTS_INVALID_FORMAT: 'CLASS_015',
  STUDENTS_NOT_FOUND: 'CLASS_016',
  CLASS_FULL: 'CLASS_017',
  STUDENTS_ASSIGNMENT_FAILED: 'CLASS_018',
  STUDENT_NOT_FOUND: 'CLASS_019',
  STUDENT_EMAIL_DUPLICATE: 'STUDENT_001',
  
  // Unauthorized
  UNAUTHORIZED: 'CLASS_999',
};

const ERROR_MESSAGES = {
  [ERROR_CODES.CLASS_NOT_FOUND]: 'Không tìm thấy lớp học',
  [ERROR_CODES.STUDENT_EMAIL_DUPLICATE]: 'Email đã được sử dụng bởi học viên đang học',
  [ERROR_CODES.CLASS_MISSING_REQUIRED_FIELDS]: 'Thiếu dữ liệu bắt buộc (tên, ngày bắt đầu, ngày kết thúc, sức chứa, số buổi)',
  [ERROR_CODES.CLASS_INVALID_DATES]: 'Ngày bắt đầu phải trước ngày kết thúc',
  [ERROR_CODES.CLASS_INVALID_CAPACITY]: 'Sức chứa phải lớn hơn 0',
  [ERROR_CODES.CLASS_INVALID_SESSIONS]: 'Số buổi học phải lớn hơn 0',
  [ERROR_CODES.CLASS_END_DATE_IN_PAST]: 'Ngày kết thúc phải từ hôm nay trở đi',
  [ERROR_CODES.CLASS_CREATION_FAILED]: 'Tạo lớp học thất bại',
  [ERROR_CODES.CLASS_UPDATE_FAILED]: 'Cập nhật lớp học thất bại',
  [ERROR_CODES.CLASS_NO_FIELDS_TO_UPDATE]: 'Không có dữ liệu cần cập nhật',
  [ERROR_CODES.CLASS_DELETE_FAILED]: 'Xóa lớp học thất bại',
  [ERROR_CODES.TEACHER_NOT_PROVIDED]: 'Vui lòng cung cấp ID giáo viên',
  [ERROR_CODES.TEACHER_NOT_FOUND]: 'Không tìm thấy giáo viên',
  [ERROR_CODES.TEACHER_ASSIGNMENT_FAILED]: 'Gán giáo viên thất bại',
  [ERROR_CODES.STUDENTS_NOT_PROVIDED]: 'Vui lòng cung cấp danh sách học viên',
  [ERROR_CODES.STUDENTS_INVALID_FORMAT]: 'ID học viên phải là mảng không rỗng',
  [ERROR_CODES.STUDENTS_NOT_FOUND]: 'Một hoặc nhiều học viên không tồn tại',
  [ERROR_CODES.CLASS_FULL]: 'Lớp học đã đạt sức chứa tối đa',
  [ERROR_CODES.STUDENTS_ASSIGNMENT_FAILED]: 'Gán học viên thất bại',
  [ERROR_CODES.STUDENT_NOT_FOUND]: 'Không tìm thấy học viên',
  [ERROR_CODES.UNAUTHORIZED]: 'Bạn không có quyền thực hiện hành động này',
};

module.exports = {
  ERROR_CODES,
  ERROR_MESSAGES,
};
