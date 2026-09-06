// services/irt/core.js

/**
 * Mô hình IRT 3 tham số (3PL - Three Parameter Logistic).
 * Tính xác suất học sinh có năng lực theta trả lời ĐÚNG một câu hỏi
 * có độ phân biệt a, độ khó b, hệ số đoán mò c.
 *
 * P(theta) = c + (1 - c) / (1 + e^(-a * (theta - b)))
 */
function probabilityCorrect(theta, a, b, c = 0) {
  const exponent = -a * (theta - b);
  return c + (1 - c) / (1 + Math.exp(exponent));
}

/**
 * Hàm thông tin của câu hỏi (Item Information Function).
 * Câu hỏi "cho nhiều thông tin nhất" tại theta là câu có b gần theta
 * và a càng lớn thì thông tin càng "nhọn" quanh điểm đó.
 * Dùng để chọn câu hỏi kế tiếp trong bài thi thích ứng (adaptive test).
 */
function itemInformation(theta, a, b, c = 0) {
  const p = probabilityCorrect(theta, a, b, c);
  const q = 1 - p;
  if (c === 0) {
    return a * a * p * q; // công thức rút gọn cho 2PL
  }
  const numerator = Math.pow(p - c, 2) * q;
  const denominator = Math.pow(1 - c, 2) * p;
  return a * a * (numerator / denominator);
}

module.exports = { probabilityCorrect, itemInformation };