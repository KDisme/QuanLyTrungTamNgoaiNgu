const path = require('path');
const fs = require('fs');
const examService = require('../services/exam.service');

class ExamController {
  async getFormats(req, res, next) { try { res.json({ formats: examService.getFormats() }); } catch (err) { next(err); } }
  async listQuestionGroups(req, res, next) { try { res.json(await examService.listQuestionGroups(req.tenant.id, req.query)); } catch (err) { next(err); } }
  async listQuestions(req, res, next) { try { res.json(await examService.listQuestions(req.tenant.id, req.query)); } catch (err) { next(err); } }
  async getQuestion(req, res, next) { try { const item = await examService.getQuestion(req.tenant.id, parseInt(req.params.id)); if (!item) return res.status(404).json({ message: 'Question not found' }); res.json(item); } catch (err) { next(err); } }
  async createQuestion(req, res, next) { try { res.status(201).json(await examService.createQuestion(req.tenant.id, req.user?.id, req.body)); } catch (err) { next(err); } }
  async updateQuestion(req, res, next) { try { const item = await examService.updateQuestion(req.tenant.id, parseInt(req.params.id), { ...req.body, updatedBy: req.user?.id }); if (!item) return res.status(404).json({ message: 'Question not found' }); res.json(item); } catch (err) { next(err); } }
  async deleteQuestion(req, res, next) { try { await examService.deleteQuestion(req.tenant.id, parseInt(req.params.id)); res.json({ message: 'Deleted successfully' }); } catch (err) { next(err); } }

  async listExamSets(req, res, next) { try { res.json(await examService.listExamSets(req.tenant.id, req.query)); } catch (err) { next(err); } }
  async getExamSet(req, res, next) { try { const item = await examService.getExamSet(req.tenant.id, parseInt(req.params.id)); if (!item) return res.status(404).json({ message: 'Exam set not found' }); res.json(item); } catch (err) { next(err); } }
  async createExamSet(req, res, next) { try { res.status(201).json(await examService.createExamSet(req.tenant.id, req.user?.id, req.body)); } catch (err) { next(err); } }
  async updateExamSet(req, res, next) { try { const item = await examService.updateExamSet(req.tenant.id, parseInt(req.params.id), req.body); if (!item) return res.status(404).json({ message: 'Exam set not found' }); res.json(item); } catch (err) { next(err); } }
  async generateExamSet(req, res, next) { try { res.status(201).json(await examService.generateExamSet(req.tenant.id, req.user?.id, req.body)); } catch (err) { next(err); } }
  async deleteExamSet(req, res, next) { try { await examService.deleteExamSet(req.tenant.id, parseInt(req.params.id)); res.json({ message: 'Deleted successfully' }); } catch (err) { next(err); } }

  async listMockExams(req, res, next) { try { res.json(await examService.listMockExams(req.tenant.id, req.query, req.user)); } catch (err) { next(err); } }
  async getMockExam(req, res, next) { try { const item = await examService.getMockExam(req.tenant.id, parseInt(req.params.id), req.user); if (!item) return res.status(404).json({ message: 'Mock exam not found' }); res.json(item); } catch (err) { next(err); } }
  async createMockExam(req, res, next) { try { res.status(201).json(await examService.createMockExam(req.tenant.id, req.user?.id, req.body)); } catch (err) { next(err); } }
  async updateMockExam(req, res, next) { try { const item = await examService.updateMockExam(req.tenant.id, parseInt(req.params.id), req.body); if (!item) return res.status(404).json({ message: 'Mock exam not found' }); res.json(item); } catch (err) { next(err); } }
  async deleteMockExam(req, res, next) { try { await examService.deleteMockExam(req.tenant.id, parseInt(req.params.id)); res.json({ message: 'Deleted successfully' }); } catch (err) { next(err); } }
  async startAttempt(req, res, next) { try { res.json(await examService.startAttempt(req.tenant.id, parseInt(req.params.mockExamStudentId))); } catch (err) { next(err); } }
  async resetInProgressAttempt(req, res, next) { try { res.json(await examService.resetInProgressAttempt(req.tenant.id, parseInt(req.params.mockExamStudentId))); } catch (err) { next(err); } }
  async saveAnswer(req, res, next) { try { res.json(await examService.saveAnswer(req.tenant.id, parseInt(req.params.mockExamStudentId), req.body.answer || req.body)); } catch (err) { next(err); } }
  async saveAnswersBatch(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const mockExamStudentId = parseInt(req.params.mockExamStudentId);
      const answers = Array.isArray(req.body.answers) ? req.body.answers : [req.body.answer || req.body];
      const results = [];
      for (const answer of answers) {
        const saved = await examService.saveAnswer(tenantId, mockExamStudentId, answer);
        if (saved) results.push(saved);
      }
      res.json({ saved: results.length, results });
    } catch (err) { next(err); }
  }
  async submitAnswers(req, res, next) { try { res.json(await examService.submitAnswers(req.tenant.id, parseInt(req.params.mockExamStudentId), req.body.answers)); } catch (err) { next(err); } }
  async gradeStudent(req, res, next) { try { res.json(await examService.gradeStudent(req.tenant.id, parseInt(req.params.mockExamStudentId), req.body, req.user?.id, req.user)); } catch (err) { next(err); } }

  async uploadSubmissionRecording(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      if (!/^audio\//.test(req.file.mimetype)) return res.status(400).json({ message: 'Chỉ cho phép upload file audio cho phần Speaking' });
      const publicUrl = `/uploads/exams/${req.file.filename}`;
      res.status(201).json({
        url: publicUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });
    } catch (err) { next(err); }
  }

  async uploadMedia(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const publicUrl = `/uploads/exams/${req.file.filename}`;
      res.status(201).json({ url: publicUrl, filename: req.file.filename, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size });
    } catch (err) { next(err); }
  }
}

module.exports = new ExamController();
