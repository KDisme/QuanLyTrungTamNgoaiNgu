import { useState } from 'react';
import toast from 'react-hot-toast';
import { homeworkApi, homeworkQuestionBankApi } from '../../../../api';
import { createQuestion, toLocalISOString, isDueDateValid } from '../../form/utils/homework.helpers';
import { HomeworkQuestion } from '../../form/utils/homework.types';

export function useHomeworkForm(initial: any, onDone: () => void) {
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'info' | 'config' | 'security'>('info');
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<any[]>(
    Array.isArray(initial?.classes) && initial.classes.length
      ? initial.classes
      : (initial?.class_id || initial?.classId)
        ? [{ id: initial?.class_id || initial?.classId, name: initial?.className || initial?.class_name || 'Lớp đã gán' }]
        : []
  );
  const [form, setForm] = useState<any>({
    title: initial?.title || '',
    description: initial?.description || '',
    instructions: initial?.instructions || '',
    dueDate: toLocalISOString(initial?.due_date || initial?.dueDate),
    allowLateSubmission: initial?.allow_late_submission ?? initial?.allowLateSubmission ?? false,
    totalScore: initial?.total_score || initial?.totalScore || 10,
    status: initial?.status || 'draft',
    showAnswersAfterSubmit: initial?.show_answers_after_submit ?? initial?.showAnswersAfterSubmit ?? false,
    showScoreAfterSubmit: initial?.show_score_after_submit ?? initial?.showScoreAfterSubmit ?? true,
    requirePassword: initial?.require_password ?? initial?.requirePassword ?? false,
    hasTimeLimit: !!(initial?.time_limit_minutes ?? initial?.timeLimitMinutes),
    timeLimitMinutes: initial?.time_limit_minutes ?? initial?.timeLimitMinutes ?? 30,
    shuffleQuestions: initial?.shuffle_questions ?? initial?.shuffleQuestions ?? false,
    password: '',
    questions: initial?.questions?.length
      ? initial.questions.map((question: any, index: number) => ({
          orderNumber: question.order_number || question.orderNumber || index + 1,
          questionType: question.question_type || question.questionType || 'multiple_choice_4',
          questionText: question.question_text || question.questionText || '',
          helpText: question.help_text || question.helpText || '',
          isRequired: question.is_required ?? question.isRequired ?? true,
          score: question.score || 1,
          correctAnswer: question.correct_answer || question.correctAnswer || '',
          options: Array.isArray(question.options)
            ? question.options.map((option: any) => ({
                label: option.label || option.optionLabel,
                text: option.text || option.optionText || '',
              }))
            : [],
        }))
      : [createQuestion('multiple_choice_4', 1)],
  });

  const setQuestion = (index: number, patch: Partial<HomeworkQuestion>) => {
    setForm((prev: any) => ({
      ...prev,
      questions: prev.questions.map((question: HomeworkQuestion, questionIndex: number) => {
        if (questionIndex !== index) return question;
        return { ...question, ...patch };
      }),
    }));
  };

  const changeQuestionType = (index: number, type: string) => {
    setForm((prev: any) => ({
      ...prev,
      questions: prev.questions.map((question: HomeworkQuestion, questionIndex: number) => {
        if (questionIndex !== index) return question;
        return createQuestion(type, question.orderNumber);
      }),
    }));
  };

  const updateOption = (questionIndex: number, optionIndex: number, patch: Partial<{ label: string; text: string }>) => {
    setForm((prev: any) => ({
      ...prev,
      questions: prev.questions.map((question: HomeworkQuestion, index: number) => {
        if (index !== questionIndex) return question;
        return {
          ...question,
          options: question.options.map((option, currentIndex) => currentIndex === optionIndex ? { ...option, ...patch } : option),
        };
      }),
    }));
  };

  const addQuestion = () => {
    setForm((prev: any) => ({
      ...prev,
      questions: [...prev.questions, createQuestion('multiple_choice_4', prev.questions.length + 1)],
    }));
  };

  const removeQuestion = (index: number) => {
    setForm((prev: any) => ({
      ...prev,
      questions: prev.questions.filter((_: HomeworkQuestion, questionIndex: number) => questionIndex !== index),
    }));
  };

  const insertFromBank = (items: any[]) => {
    setForm((prev: any) => {
      const startOrder = prev.questions.length + 1;
      const converted: HomeworkQuestion[] = items.map((item, index) => ({
        orderNumber: startOrder + index,
        questionType: item.questionType,
        questionText: item.questionText,
        helpText: item.helpText || '',
        isRequired: true,
        score: item.score || 1,
        correctAnswer: item.correctAnswer || '',
        options: Array.isArray(item.options) ? item.options.map((o: any) => ({ label: o.label, text: o.text })) : [],
        bankQuestionId: item.id,
      }));
      return { ...prev, questions: [...prev.questions, ...converted] };
    });
    toast.success(`Đã thêm ${items.length} câu từ ngân hàng vào bài`);
    setShowBankPicker(false);
  };

  const saveQuestionToBank = async (question: HomeworkQuestion) => {
    if (!question.questionText.trim()) return toast.error('Câu hỏi chưa có nội dung để lưu');
    try {
      await homeworkQuestionBankApi.create({
        questionType: question.questionType,
        questionText: question.questionText,
        helpText: question.helpText,
        score: question.score,
        correctAnswer: question.correctAnswer,
        options: question.options,
      });
      toast.success('Đã lưu câu hỏi vào ngân hàng để dùng lại sau');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không lưu được vào ngân hàng');
    }
  };

  const goNext = () => {
    if (tab === 'info') {
      if (!form.title.trim()) return toast.error('Vui lòng nhập tiêu đề bài tập');
      if (!form.questions.length) return toast.error('Vui lòng thêm ít nhất 1 câu hỏi');
      const emptyQuestion = form.questions.find((q: HomeworkQuestion) => !q.questionText.trim());
      if (emptyQuestion) return toast.error('Vui lòng nhập nội dung cho tất cả câu hỏi');
      if (!isDueDateValid(form.dueDate)) return toast.error('Hạn nộp phải lớn hơn hoặc bằng thời điểm hiện tại');
      setTab('config');
      return;
    }
    if (tab === 'config') {
      setTab('security');
    }
  };

  const goPrev = () => {
    setTab(tab === 'security' ? 'config' : 'info');
  };

  const submit = async () => {
    if (!form.title.trim()) return toast.error('Vui lòng nhập tiêu đề bài tập');
    if (!form.questions.length) return toast.error('Vui lòng thêm ít nhất 1 câu hỏi');
    if (!isDueDateValid(form.dueDate)) {
      setTab('info');
      return toast.error('Hạn nộp phải lớn hơn hoặc bằng thời điểm hiện tại');
    }
    if (form.requirePassword && !form.password.trim() && !(initial?.require_password || initial?.requirePassword)) {
      setTab('security');
      return toast.error('Vui lòng nhập mật khẩu cho bài tập');
    }

    const questions = form.questions.map((question: HomeworkQuestion, index: number) => ({
      orderNumber: index + 1,
      questionType: question.questionType,
      questionText: question.questionText,
      helpText: question.helpText,
      isRequired: question.isRequired,
      score: Number(question.score || 1),
      correctAnswer: question.correctAnswer,
      options: question.options,
      bankQuestionId: question.bankQuestionId || null,
    }));

    setSaving(true);
    try {
      const payload = {
        ...form,
        classIds: selectedClasses.map((c) => c.id),
        totalScore: Number(form.totalScore || 100),
        timeLimitMinutes: form.hasTimeLimit ? Number(form.timeLimitMinutes || 30) : null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        questions,
      };
      if (initial) await homeworkApi.update(initial.id, payload);
      else await homeworkApi.create(payload);
      toast.success('Đã lưu bài tập về nhà');
      onDone();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không lưu được bài tập');
    } finally {
      setSaving(false);
    }
  };

  const removeSelectedClass = (id: number) => {
    setSelectedClasses((prev) => prev.filter((c) => c.id !== id));
  };

  const confirmClassSelection = (result: { ids: number[]; items?: any[] }) => {
    const idSet = new Set<number>(result.ids || []);
    const itemMap = new Map((result.items || []).map((item: any) => [item.id, item]));
    setSelectedClasses((prev) => {
      const prevMap = new Map(prev.map((c) => [c.id, c]));
      return Array.from(idSet).map((id) => itemMap.get(id) || prevMap.get(id) || { id, name: `Lớp #${id}` });
    });
    setShowClassPicker(false);
  };

  return {
    // state
    saving,
    tab,
    setTab,
    showBankPicker,
    setShowBankPicker,
    showClassPicker,
    setShowClassPicker,
    selectedClasses,
    form,
    setForm,
    // question handlers
    setQuestion,
    changeQuestionType,
    updateOption,
    addQuestion,
    removeQuestion,
    insertFromBank,
    saveQuestionToBank,
    // class handlers
    removeSelectedClass,
    confirmClassSelection,
    // navigation / submit
    goNext,
    goPrev,
    submit,
  };
}