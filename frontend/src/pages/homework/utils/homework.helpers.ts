import { HomeworkQuestion } from './homework.types';

export function createQuestion(type = 'multiple_choice_4', orderNumber = 1): HomeworkQuestion {
  return {
    orderNumber,
    questionType: type,
    questionText: '',
    helpText: '',
    isRequired: true,
    score: 1,
    correctAnswer: type === 'essay' ? '' : type === 'true_false' ? 'true' : 'A',
    options: type === 'multiple_choice_4'
      ? [
          { label: 'A', text: '' },
          { label: 'B', text: '' },
          { label: 'C', text: '' },
          { label: 'D', text: '' },
        ]
      : [],
  };
}

export function toLocalISOString(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}