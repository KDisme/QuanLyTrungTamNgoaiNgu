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

export function getMinDueDate() {
  const now = new Date();
  now.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function isDueDateValid(dueDate: string) {
  if (!dueDate) return true; // cho phép để trống nếu hạn nộp không bắt buộc
  return new Date(dueDate).getTime() >= Date.now();
}

export function getSessionLabel(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Sáng';
  if (hour >= 12 && hour < 14) return 'Trưa';
  if (hour >= 14 && hour < 18) return 'Chiều';
  return 'Tối';
}

// item.time_ranges có thể là "08:00-10:00" hoặc nhiều khung giờ gộp "08:00-10:00, 14:00-16:00"
export function formatTimeRangesWithSession(timeRanges: string | null | undefined) {
  if (!timeRanges) return '—';
  return timeRanges
    .split(',')
    .map((range) => {
      const trimmed = range.trim();
      const startHourStr = trimmed.split('-')[0]?.split(':')[0];
      const startHour = parseInt(startHourStr, 10);
      if (Number.isNaN(startHour)) return trimmed;
      const session = getSessionLabel(startHour);
      return `${trimmed} (${session})`;
    })
    .join(', ');
}