const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  STAFF: 'staff',
};

const CLASS_TYPES = {
  FIXED: 'fixed',
  OPEN: 'open',
};

const CLASS_STATUS = {
  UPCOMING: 'upcoming',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const SCHEDULE_STATUS = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  POSTPONED: 'postponed',
};

const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  EXCUSED: 'excused',
};

const PAYMENT_METHOD = {
  CASH: 'cash',
  TRANSFER: 'transfer',
  OTHER: 'other',
};

const FEE_COLLECTION_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  CLOSED: 'closed',
};

const FEE_ITEM_STATUS = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid',
  CANCELLED: 'cancelled',
};

module.exports = {
  ROLES,
  CLASS_TYPES,
  CLASS_STATUS,
  SCHEDULE_STATUS,
  ATTENDANCE_STATUS,
  PAYMENT_METHOD,
  FEE_COLLECTION_STATUS,
  FEE_ITEM_STATUS,
};
