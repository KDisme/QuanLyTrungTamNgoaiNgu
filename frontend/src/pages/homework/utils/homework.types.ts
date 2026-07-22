export type HomeworkQuestionOption = {
  label: string;
  text: string;
};

export type HomeworkQuestion = {
  orderNumber: number;
  questionType: string;
  questionText: string;
  helpText: string;
  isRequired: boolean;
  score: number;
  correctAnswer: string;
  options: HomeworkQuestionOption[];
};