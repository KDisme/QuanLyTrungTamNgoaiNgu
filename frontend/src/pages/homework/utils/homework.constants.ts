export const QUESTION_TYPES = [
  { value: 'true_false', label: 'Đúng / Sai' },
  { value: 'multiple_choice_4', label: 'Trắc nghiệm 4 đáp án' },
  { value: 'essay', label: 'Tự luận' },
];

// Trước đây có 1 biến BANK_QUESTION_TYPES riêng nhưng nội dung giống hệt
// QUESTION_TYPES nên gộp lại dùng chung, tránh phải sửa 2 nơi khi thêm dạng câu hỏi mới.
export const BANK_QUESTION_TYPES = QUESTION_TYPES;