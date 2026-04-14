import http from './axios';

export interface ExamQuestionPayload {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
}

export interface ExamSetPayload {
  name: string;
  exam_at: string;
  question_count: number;
  questions: ExamQuestionPayload[];
}

type BackendExamSet = {
  id: number;
  title: string;
  exam_datetime: string;
  question_count: number;
  created_at?: string;
};

type BackendExamQuestion = {
  id: number;
  exam_set_id: number;
  question_order: number;
  content: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
};

const toBackendPayload = (data: ExamSetPayload) => ({
  title: data.name,
  exam_datetime: data.exam_at,
  question_count: data.question_count,
  questions: data.questions.map((q) => ({
    content: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_answer: q.correct_option,
  })),
});

const fromBackendExamSet = (s: BackendExamSet) => ({
  id: s.id,
  name: s.title,
  exam_at: s.exam_datetime,
  question_count: s.question_count,
  created_at: s.created_at || '',
});

const fromBackendQuestion = (q: BackendExamQuestion) => ({
  id: q.id,
  order_no: q.question_order,
  question_text: q.content,
  option_a: q.option_a,
  option_b: q.option_b,
  option_c: q.option_c,
  option_d: q.option_d,
  correct_option: q.correct_answer,
});

export const apiGetAllExamSets = () =>
  http.get('/exam-sets').then((res) => {
    const examSets: BackendExamSet[] = Array.isArray(res.data)
      ? res.data
      : res.data?.examSets || res.data?.data || [];

    return {
      ...res,
      data: examSets.map(fromBackendExamSet),
    };
  });

export const apiGetExamSetById = (id: number | string) =>
  http.get(`/exam-sets/${id}`).then((res) => {
    const examSet: BackendExamSet | undefined = res.data?.examSet;
    const questions: BackendExamQuestion[] = res.data?.questions || [];

    if (!examSet) {
      return res;
    }

    const detail = {
      ...fromBackendExamSet(examSet),
      questions: questions.map(fromBackendQuestion),
    };

    return {
      ...res,
      data: {
        ...res.data,
        exam_set: detail,
        data: detail,
      },
    };
  });

export const apiCreateExamSet = (data: ExamSetPayload) => http.post('/exam-sets', toBackendPayload(data));

export const apiUpdateExamSet = (id: number | string, data: ExamSetPayload) =>
  http.put(`/exam-sets/${id}`, toBackendPayload(data));

export const apiDeleteExamSet = (id: number | string) => http.delete(`/exam-sets/${id}`);
