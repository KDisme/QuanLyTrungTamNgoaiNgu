const express = require('express');
const router = express.Router();
const {
  resolveTenant,
  authenticate,
  requireRole,
  requireSelfOrRole,
  requireStudentAccess,
  requireClassAccess,
  requireScheduleAccess,
  requireFeeItemAccess,
  requireMockExamStudentAccess,
} = require('../middlewares/auth.middleware');
const authCtrl = require('../controllers/auth.controller');
const userCtrl = require('../controllers/user.controller');
const branchCtrl = require('../controllers/branch.controller');
const classCtrl = require('../controllers/class.controller');
const { scheduleController: schedCtrl, attendanceController: attendCtrl } = require('../controllers/schedule.controller');
const feeCtrl = require('../controllers/fee.controller');
const dashboardCtrl = require('../controllers/dashboard.controller');
const examCtrl = require('../controllers/exam.controller');
const homeworkCtrl = require('../controllers/homework.controller');
const homeworkBankCtrl = require('../controllers/homeworkQuestionBank.controller');
const notificationCtrl = require('../controllers/notification.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(__dirname, '../../uploads/exams');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname || '')}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^(image|audio)\//.test(file.mimetype) || file.mimetype === 'application/pdf') return cb(null, true);
    cb(Object.assign(new Error('Chỉ cho phép upload hình ảnh, audio hoặc PDF'), { status: 400 }));
  },
});

// ---- PORTAL (no tenant) ----
router.post('/portal/find-tenant', authCtrl.portalFindTenant);

// ---- TENANT-SCOPED ROUTES ----
const tenantRouter = express.Router({ mergeParams: true });
router.use('/:tenantSlug', resolveTenant, tenantRouter);

// Auth
tenantRouter.post('/auth/login', authCtrl.login);
tenantRouter.get('/auth/me', authenticate, authCtrl.me);

// Users
tenantRouter.get('/users', authenticate, requireRole('admin', 'staff'), userCtrl.getAll);
tenantRouter.get('/users/:id', authenticate, requireSelfOrRole('id', 'admin', 'staff'), userCtrl.getById);
tenantRouter.post('/users', authenticate, requireRole('admin', 'staff'), userCtrl.create);
tenantRouter.put('/users/:id', authenticate, requireSelfOrRole('id', 'admin', 'staff'), userCtrl.update);
tenantRouter.patch('/users/:id/toggle-status', authenticate, requireRole('admin'), userCtrl.toggleStatus);
tenantRouter.post('/users/:id/reset-password', authenticate, requireRole('admin'), userCtrl.resetPassword);
tenantRouter.delete('/users/:id', authenticate, requireRole('admin'), userCtrl.delete);

// Branches
tenantRouter.get('/branches', authenticate, requireRole('admin', 'staff', 'teacher'), branchCtrl.getAll);
tenantRouter.get('/branches/:id', authenticate, requireRole('admin', 'staff', 'teacher'), branchCtrl.getById);
// Single-center mode: branch/room management is hidden temporarily.
// tenantRouter.post('/branches', authenticate, requireRole('admin'), branchCtrl.create);
// tenantRouter.put('/branches/:id', authenticate, requireRole('admin'), branchCtrl.update);
// tenantRouter.delete('/branches/:id', authenticate, requireRole('admin'), branchCtrl.delete);
// tenantRouter.post('/branches/:id/rooms', authenticate, requireRole('admin'), branchCtrl.addRoom);
// tenantRouter.put('/branches/:id/rooms/:roomId', authenticate, requireRole('admin'), branchCtrl.updateRoom);
// tenantRouter.delete('/branches/:id/rooms/:roomId', authenticate, requireRole('admin'), branchCtrl.deleteRoom);

// Classes
tenantRouter.get('/classes', authenticate, classCtrl.getAll);
tenantRouter.get('/classes/next-code', authenticate, requireRole('admin', 'staff'), classCtrl.getNextCode);
tenantRouter.get('/classes/:id', authenticate, requireClassAccess('id'), classCtrl.getById);
tenantRouter.post('/classes', authenticate, requireRole('admin', 'staff'), classCtrl.create);
tenantRouter.put('/classes/:id', authenticate, requireRole('admin', 'staff'), classCtrl.update);
tenantRouter.delete('/classes/:id', authenticate, requireRole('admin'), classCtrl.delete);
tenantRouter.post('/classes/:id/students', authenticate, requireRole('admin', 'staff'), classCtrl.addStudent);
tenantRouter.delete('/classes/:id/students/:studentId', authenticate, requireRole('admin', 'staff'), classCtrl.removeStudent);
tenantRouter.get('/students/:studentId/classes', authenticate, requireStudentAccess('studentId'), classCtrl.getByStudent);

// Schedules
tenantRouter.get('/schedules', authenticate, schedCtrl.getList.bind(schedCtrl));
tenantRouter.get('/schedules/upcoming', authenticate, schedCtrl.getUpcoming.bind(schedCtrl));
tenantRouter.get('/classes/:classId/schedules', authenticate, requireClassAccess('classId'), schedCtrl.getByClass.bind(schedCtrl));
tenantRouter.post('/classes/:classId/schedules/preview', authenticate, requireRole('admin', 'staff'), schedCtrl.preview.bind(schedCtrl));
tenantRouter.post('/classes/:classId/schedules/generate', authenticate, requireRole('admin', 'staff'), schedCtrl.generate.bind(schedCtrl));
tenantRouter.get('/schedules/:id', authenticate, requireScheduleAccess('id'), schedCtrl.getById.bind(schedCtrl));
tenantRouter.put('/schedules/:id', authenticate, requireRole('admin', 'staff'), schedCtrl.update.bind(schedCtrl));
tenantRouter.patch('/schedules/:id/cancel', authenticate, requireRole('admin', 'staff'), schedCtrl.cancel.bind(schedCtrl));
tenantRouter.get('/schedules/:id/history', authenticate, requireScheduleAccess('id'), schedCtrl.history.bind(schedCtrl));

// Attendance
tenantRouter.get('/schedules/:scheduleId/attendance', authenticate, requireScheduleAccess('scheduleId'), attendCtrl.getBySchedule.bind(attendCtrl));
tenantRouter.post('/schedules/:scheduleId/attendance', authenticate, requireScheduleAccess('scheduleId', { write: true }), attendCtrl.save.bind(attendCtrl));
tenantRouter.get('/students/:studentId/attendance', authenticate, requireStudentAccess('studentId'), attendCtrl.getStudentAttendance.bind(attendCtrl));

// Fee Templates
tenantRouter.get('/fee-templates', authenticate, requireRole('admin', 'staff'), feeCtrl.getTemplates);
tenantRouter.post('/fee-templates', authenticate, requireRole('admin', 'staff'), feeCtrl.createTemplate);
tenantRouter.put('/fee-templates/:id', authenticate, requireRole('admin'), feeCtrl.updateTemplate);

// Fee Collections
tenantRouter.get('/fee-collections', authenticate, requireRole('admin', 'staff'), feeCtrl.getCollections);
tenantRouter.get('/fee-collections/:id', authenticate, requireRole('admin', 'staff'), feeCtrl.getCollectionById);
tenantRouter.post('/fee-collections', authenticate, requireRole('admin', 'staff'), feeCtrl.createCollection);
tenantRouter.patch('/fee-collections/:id/activate', authenticate, requireRole('admin', 'staff'), feeCtrl.activateCollection);
tenantRouter.patch('/fee-collections/:id/close', authenticate, requireRole('admin', 'staff'), feeCtrl.closeCollection);
tenantRouter.patch('/fee-collections/:id/cancel', authenticate, requireRole('admin'), feeCtrl.cancelCollection);

// Payments & Transactions
tenantRouter.post('/fee-items/:itemId/pay', authenticate, requireRole('admin', 'staff'), feeCtrl.recordPayment);
tenantRouter.get('/fee-items/:itemId/history', authenticate, requireFeeItemAccess('itemId'), feeCtrl.getTransactionHistory);
tenantRouter.patch('/fee-transactions/:id/cancel', authenticate, requireRole('admin'), feeCtrl.cancelTransaction);

// Student fees
tenantRouter.get('/students/:studentId/fee-collections', authenticate, requireStudentAccess('studentId'), feeCtrl.getStudentCollections);

// Expenses
tenantRouter.get('/expenses', authenticate, requireRole('admin', 'staff'), feeCtrl.getExpenses);
tenantRouter.post('/expenses', authenticate, requireRole('admin', 'staff'), feeCtrl.createExpense);
tenantRouter.put('/expenses/:id', authenticate, requireRole('admin', 'staff'), feeCtrl.updateExpense);
tenantRouter.delete('/expenses/:id', authenticate, requireRole('admin'), feeCtrl.deleteExpense);


// Exams / Mock test module
tenantRouter.get('/exam-formats', authenticate, examCtrl.getFormats);
tenantRouter.post('/exam-media', authenticate, requireRole('admin', 'staff', 'teacher'), upload.single('file'), examCtrl.uploadMedia);
tenantRouter.get('/exam-question-groups', authenticate, requireRole('admin', 'staff', 'teacher'), examCtrl.listQuestionGroups);
tenantRouter.get('/exam-questions', authenticate, requireRole('admin', 'staff', 'teacher'), examCtrl.listQuestions);
tenantRouter.get('/exam-questions/:id', authenticate, requireRole('admin', 'staff', 'teacher'), examCtrl.getQuestion);
tenantRouter.post('/exam-questions', authenticate, requireRole('admin', 'staff', 'teacher'), examCtrl.createQuestion);
tenantRouter.put('/exam-questions/:id', authenticate, requireRole('admin', 'staff', 'teacher'), examCtrl.updateQuestion);
tenantRouter.delete('/exam-questions/:id', authenticate, requireRole('admin'), examCtrl.deleteQuestion);
tenantRouter.get('/exam-sets', authenticate, requireRole('admin', 'staff', 'teacher'), examCtrl.listExamSets);
tenantRouter.get('/exam-sets/:id', authenticate, requireRole('admin', 'staff', 'teacher'), examCtrl.getExamSet);
tenantRouter.post('/exam-sets', authenticate, requireRole('admin', 'staff'), examCtrl.createExamSet);
tenantRouter.put('/exam-sets/:id', authenticate, requireRole('admin', 'staff'), examCtrl.updateExamSet);
tenantRouter.post('/exam-sets/generate', authenticate, requireRole('admin', 'staff'), examCtrl.generateExamSet);
tenantRouter.delete('/exam-sets/:id', authenticate, requireRole('admin'), examCtrl.deleteExamSet);
tenantRouter.get('/mock-exams', authenticate, examCtrl.listMockExams);
tenantRouter.get('/mock-exams/:id', authenticate, examCtrl.getMockExam);
tenantRouter.post('/mock-exams', authenticate, requireRole('admin', 'staff'), examCtrl.createMockExam);
tenantRouter.put('/mock-exams/:id', authenticate, requireRole('admin', 'staff'), examCtrl.updateMockExam);
tenantRouter.delete('/mock-exams/:id', authenticate, requireRole('admin'), examCtrl.deleteMockExam);
tenantRouter.post('/mock-exam-students/:mockExamStudentId/start', authenticate, requireMockExamStudentAccess('mockExamStudentId', { write: true }), examCtrl.startAttempt);
tenantRouter.post('/mock-exam-students/:mockExamStudentId/reset-in-progress', authenticate, requireMockExamStudentAccess('mockExamStudentId', { write: true }), examCtrl.resetInProgressAttempt);
tenantRouter.post('/mock-exam-students/:mockExamStudentId/save-answer', authenticate, requireMockExamStudentAccess('mockExamStudentId', { write: true }), examCtrl.saveAnswer);
tenantRouter.post('/mock-exam-students/:mockExamStudentId/recording', authenticate, requireMockExamStudentAccess('mockExamStudentId', { write: true }), upload.single('file'), examCtrl.uploadSubmissionRecording);
tenantRouter.post('/mock-exam-students/:mockExamStudentId/submit', authenticate, requireMockExamStudentAccess('mockExamStudentId', { write: true }), examCtrl.submitAnswers);
tenantRouter.patch('/mock-exam-students/:mockExamStudentId/grade', authenticate, requireRole('admin', 'staff', 'teacher'), requireMockExamStudentAccess('mockExamStudentId'), examCtrl.gradeStudent);

// Dashboard
tenantRouter.get('/dashboard', authenticate, dashboardCtrl.getStats);

// Homework assignments
tenantRouter.get('/homework-assignments', authenticate, homeworkCtrl.list);
tenantRouter.get('/homework-assignments/:id', authenticate, homeworkCtrl.getById);
tenantRouter.post('/homework-assignments', authenticate, requireRole('admin', 'teacher'), homeworkCtrl.create);
tenantRouter.put('/homework-assignments/:id', authenticate, requireRole('admin', 'teacher'), homeworkCtrl.update);
tenantRouter.delete('/homework-assignments/:id', authenticate, requireRole('admin', 'teacher'), homeworkCtrl.delete);
tenantRouter.post('/homework-assignments/:id/submit', authenticate, homeworkCtrl.submit);
tenantRouter.patch('/homework-submissions/:submissionId/grade', authenticate, requireRole('admin', 'teacher'), homeworkCtrl.grade);

tenantRouter.get('/homework-question-bank', authenticate, requireRole('admin', 'teacher'), homeworkBankCtrl.list);
tenantRouter.post('/homework-question-bank', authenticate, requireRole('admin', 'teacher'), homeworkBankCtrl.create);
tenantRouter.post('/homework-question-bank/bulk', authenticate, requireRole('admin', 'teacher'), homeworkBankCtrl.bulkCreate);
tenantRouter.put('/homework-question-bank/:id', authenticate, requireRole('admin', 'teacher'), homeworkBankCtrl.update);
tenantRouter.delete('/homework-question-bank/:id', authenticate, requireRole('admin', 'teacher'), homeworkBankCtrl.delete);

tenantRouter.get('/notifications', authenticate, notificationCtrl.list);
tenantRouter.get('/notifications/unread-count', authenticate, notificationCtrl.unreadCount);
tenantRouter.patch('/notifications/:id/read', authenticate, notificationCtrl.markRead);
tenantRouter.patch('/notifications/read-all', authenticate, notificationCtrl.markAllRead);
tenantRouter.get('/homework-assignments/:id/preview', authenticate, homeworkCtrl.getPreview);

module.exports = router;
