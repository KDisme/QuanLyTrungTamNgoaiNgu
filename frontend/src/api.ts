import axios from 'axios';

export const DEFAULT_TENANT_SLUG = 'demo';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const tenant = localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (tenant && config.url) {
    config.url = config.url.replace(':tenantSlug', tenant);
    if (!config.url.startsWith('/:tenantSlug') && !config.url.includes(tenant) && !config.url.startsWith('/portal')) {
      config.url = `/${tenant}${config.url}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const tenant = localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('tenantSlug');
      localStorage.removeItem('tenantName');
      window.location.href = `/${tenant}/login`;
    }
    return Promise.reject(err);
  }
);

export default api;

export const authApi = {
  findTenant: (email: string) => api.post('/portal/find-tenant', { email }),
  login: (tenantSlug: string, identifier: string, password: string) =>
    api.post(`/${tenantSlug}/auth/login`, { identifier, password }),
  me: () => api.get('/auth/me'),
};

export const usersApi = {
  getAll: (params?: object) => api.get('/users', { params }),
  getById: (id: number) => api.get(`/users/${id}`),
  create: (data: object) => api.post('/users', data),
  update: (id: number, data: object) => api.put(`/users/${id}`, data),
  toggleStatus: (id: number) => api.patch(`/users/${id}/toggle-status`),
};

export const branchesApi = {
  getAll: (params?: object) => api.get('/branches', { params }),
  getById: (id: number) => api.get(`/branches/${id}`),
  create: (data: object) => api.post('/branches', data),
  update: (id: number, data: object) => api.put(`/branches/${id}`, data),
  delete: (id: number) => api.delete(`/branches/${id}`),
  addRoom: (branchId: number, data: object) => api.post(`/branches/${branchId}/rooms`, data),
  updateRoom: (branchId: number, roomId: number, data: object) => api.put(`/branches/${branchId}/rooms/${roomId}`, data),
  deleteRoom: (branchId: number, roomId: number) => api.delete(`/branches/${branchId}/rooms/${roomId}`),
};

export const classesApi = {
  getAll: (params?: object) => api.get('/classes', { params }),
  getNextCode: () => api.get('/classes/next-code'),
  getById: (id: number) => api.get(`/classes/${id}`),
  create: (data: object) => api.post('/classes', data),
  update: (id: number, data: object) => api.put(`/classes/${id}`, data),
  delete: (id: number) => api.delete(`/classes/${id}`),
  addStudent: (classId: number, studentId: number) => api.post(`/classes/${classId}/students`, { studentId }),
  removeStudent: (classId: number, studentId: number) => api.delete(`/classes/${classId}/students/${studentId}`),
  getByStudent: (studentId: number) => api.get(`/students/${studentId}/classes`),
};

export const schedulesApi = {
  getList: (params?: object) => api.get('/schedules', { params }),
  getByClass: (classId: number, params?: object) => api.get(`/classes/${classId}/schedules`, { params }),
  getById: (id: number) => api.get(`/schedules/${id}`),
  getUpcoming: (params?: object) => api.get('/schedules/upcoming', { params }),
  preview: (classId: number, data: object) => api.post(`/classes/${classId}/schedules/preview`, data),
  generate: (classId: number, data: object) => api.post(`/classes/${classId}/schedules/generate`, data),
  update: (id: number, data: object) => api.put(`/schedules/${id}`, data),
  cancel: (id: number, note?: string) => api.patch(`/schedules/${id}/cancel`, { note }),
  history: (id: number) => api.get(`/schedules/${id}/history`),
};

export const attendanceApi = {
  getBySchedule: (scheduleId: number) => api.get(`/schedules/${scheduleId}/attendance`),
  save: (scheduleId: number, records: object[]) => api.post(`/schedules/${scheduleId}/attendance`, { records }),
  getStudentAttendance: (studentId: number) => api.get(`/students/${studentId}/attendance`),
};

export const feesApi = {
  // Templates
  getTemplates: () => api.get('/fee-templates'),
  createTemplate: (data: object) => api.post('/fee-templates', data),
  updateTemplate: (id: number, data: object) => api.put(`/fee-templates/${id}`, data),

  // Collections
  getCollections: (params?: object) => api.get('/fee-collections', { params }),
  getCollectionById: (id: number) => api.get(`/fee-collections/${id}`),
  createCollection: (data: object) => api.post('/fee-collections', data),
  activateCollection: (id: number) => api.patch(`/fee-collections/${id}/activate`),
  closeCollection: (id: number) => api.patch(`/fee-collections/${id}/close`),
  cancelCollection: (id: number) => api.patch(`/fee-collections/${id}/cancel`),

  // Payments
  recordPayment: (itemId: number, data: object) => api.post(`/fee-items/${itemId}/pay`, data),
  getItemHistory: (itemId: number) => api.get(`/fee-items/${itemId}/history`),
  cancelTransaction: (id: number) => api.patch(`/fee-transactions/${id}/cancel`),

  // Student
  getStudentCollections: (studentId: number) => api.get(`/students/${studentId}/fee-collections`),

  // Expenses
  getExpenses: (params?: object) => api.get('/expenses', { params }),
  createExpense: (data: object) => api.post('/expenses', data),
  updateExpense: (id: number, data: object) => api.put(`/expenses/${id}`, data),
  deleteExpense: (id: number) => api.delete(`/expenses/${id}`),
};

export const dashboardApi = {
  getStats: (params?: object) => api.get('/dashboard', { params }),
};

// Exam module
export const examFormatsApi = {
  getAll: () => api.get('/exam-formats'),
};

export const examMediaApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/exam-media', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const examQuestionGroupsApi = {
  getAll: (params?: object) => api.get('/exam-question-groups', { params }),
};

export const examQuestionsApi = {
  getAll: (params?: object) => api.get('/exam-questions', { params }),
  getById: (id: number) => api.get(`/exam-questions/${id}`),
  create: (data: object) => api.post('/exam-questions', data),
  update: (id: number, data: object) => api.put(`/exam-questions/${id}`, data),
  delete: (id: number) => api.delete(`/exam-questions/${id}`),
};

export const examSetsApi = {
  getAll: (params?: object) => api.get('/exam-sets', { params }),
  getById: (id: number) => api.get(`/exam-sets/${id}`),
  create: (data: object) => api.post('/exam-sets', data),
  update: (id: number, data: object) => api.put(`/exam-sets/${id}`, data),
  generate: (data: object) => api.post('/exam-sets/generate', data),
  delete: (id: number) => api.delete(`/exam-sets/${id}`),
};

export const mockExamsApi = {
  getAll: (params?: object) => api.get('/mock-exams', { params }),
  getById: (id: number) => api.get(`/mock-exams/${id}`),
  create: (data: object) => api.post('/mock-exams', data),
  update: (id: number, data: object) => api.put(`/mock-exams/${id}`, data),
  delete: (id: number) => api.delete(`/mock-exams/${id}`),
  uploadRecording: (mockExamStudentId: number, file: Blob | File) => {
    const form = new FormData();
    const name = file instanceof File ? file.name : `speaking-${Date.now()}.webm`;
    form.append('file', file, name);
    return api.post(`/mock-exam-students/${mockExamStudentId}/recording`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
  },
  submit: (mockExamStudentId: number, answers: object[]) => api.post(`/mock-exam-students/${mockExamStudentId}/submit`, { answers }),
  grade: (mockExamStudentId: number, data: object) => api.patch(`/mock-exam-students/${mockExamStudentId}/grade`, data),
};
