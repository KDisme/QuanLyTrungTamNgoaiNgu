const { shuffleArray, toJson } = require('./utils');

/**
 * Xáo trộn thứ tự câu hỏi + nội dung đáp án, cố định riêng cho từng học viên.
 * Chỉ gọi khi giáo viên/admin đã bật "Xáo trộn câu hỏi" cho bài tập này
 * VÀ học viên đã có bản ghi mySubmission (homework_assignment_students).
 *
 * Thứ tự (question_order / option_order) được lưu lại trong DB để học viên
 * luôn thấy đúng 1 thứ tự cố định mỗi lần vào lại bài.
 */
async function applyQuestionShuffle({ pool, tenantId, questions, mySubmission }) {
  let questionOrder = toJson(mySubmission.question_order, null);
  let optionOrders = toJson(mySubmission.option_order, null);

  const validOrder = Array.isArray(questionOrder)
    && questionOrder.length === questions.length
    && questions.every((q) => questionOrder.includes(q.id));

  if (!validOrder) {
    questionOrder = shuffleArray(questions.map((q) => q.id));
    optionOrders = {};
    questions.forEach((q) => {
      if (q.questionType === 'multiple_choice_4' && Array.isArray(q.options) && q.options.length) {
        // Vị trí A/B/C/D giữ nguyên. Ta chỉ xáo trộn xem NỘI DUNG của label gốc nào
        // sẽ được đặt vào từng vị trí đó.
        const originalLabels = q.options.map((o) => o.label);
        optionOrders[q.id] = shuffleArray(originalLabels);
      }
    });
    await pool.query(
      `UPDATE homework_assignment_students SET question_order=$1::jsonb, option_order=$2::jsonb, updated_at=NOW() WHERE id=$3 AND tenant_id=$4`,
      [JSON.stringify(questionOrder), JSON.stringify(optionOrders), mySubmission.assignmentStudentId, tenantId]
    );
  }

  const questionMap = new Map(questions.map((q) => [Number(q.id), q]));
  let orderedQuestions = questionOrder.map((qid) => questionMap.get(Number(qid))).filter(Boolean);

  orderedQuestions = orderedQuestions.map((q) => {
    const mapping = optionOrders ? optionOrders[q.id] : null; // ví dụ ['C','A','D','B']
    if (Array.isArray(mapping) && Array.isArray(q.options) && mapping.length === q.options.length) {
      const positionLabels = q.options.map((o) => o.label); // ['A','B','C','D'] — vị trí cố định
      const originalByLabel = new Map(q.options.map((o) => [o.label, o]));
      // Vị trí A hiển thị nội dung của label mapping[0], vị trí B hiển thị nội dung của mapping[1], ...
      const reorderedOptions = positionLabels.map((posLabel, idx) => {
        const origOption = originalByLabel.get(mapping[idx]);
        return { label: posLabel, text: origOption ? origOption.text : '' };
      });

      // Nếu được phép xem đáp án, phải đổi đáp án đúng từ "label gốc" sang "vị trí hiện tại"
      let remappedCorrectAnswer = q.correctAnswer;
      if (q.correctAnswer) {
        const posIndex = mapping.indexOf(q.correctAnswer);
        remappedCorrectAnswer = posIndex >= 0 ? positionLabels[posIndex] : q.correctAnswer;
      }

      return { ...q, options: reorderedOptions, correctAnswer: remappedCorrectAnswer };
    }
    return q;
  });

  return orderedQuestions;
}

/**
 * Giải mã đáp án học viên chọn (theo vị trí hiển thị A/B/C/D cố định) về label gốc
 * của câu hỏi, dùng khi chấm điểm multiple_choice_4 lúc bài có bật xáo trộn.
 */
function decodeMultipleChoiceAnswer({ mapping, positionLabels, chosenPosition }) {
  let decodedAnswer = chosenPosition;
  if (Array.isArray(mapping) && mapping.length === positionLabels.length) {
    const posIndex = positionLabels.indexOf(String(chosenPosition).toUpperCase());
    if (posIndex >= 0) decodedAnswer = mapping[posIndex];
  }
  return decodedAnswer;
}

module.exports = {
  applyQuestionShuffle,
  decodeMultipleChoiceAnswer,
};