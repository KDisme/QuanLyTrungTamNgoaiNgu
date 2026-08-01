function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toJson(value, fallback = []) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function hasAnyRole(user, roles = []) {
  const userRoles = user?.roles || [];
  return roles.some((role) => userRoles.includes(role));
}

function isAdminStaff(user) {
  return hasAnyRole(user, ['admin', 'staff']);
}

function isTeacherOnly(user) {
  return hasAnyRole(user, ['teacher']) && !isAdminStaff(user);
}

function isStudentOnly(user) {
  return hasAnyRole(user, ['student']) && !isAdminStaff(user) && !hasAnyRole(user, ['teacher']);
}

function normalizeAnswerValue(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

module.exports = {
  toInt,
  toJson,
  shuffleArray,
  hasAnyRole,
  isAdminStaff,
  isTeacherOnly,
  isStudentOnly,
  normalizeAnswerValue,
};