// services/irt/ability.js
const { probabilityCorrect } = require('./core');

/**
 * Ước lượng theta bằng phương pháp Newton-Raphson trên
 * log-likelihood của chuỗi câu trả lời đã có.
 *
 * responses: mảng [{ a, b, c, correct: true/false }, ...]
 * Trả về theta ước lượng (thường nằm trong khoảng -4 đến 4).
 */
function estimateTheta(responses, { maxIter = 50, tolerance = 0.0001 } = {}) {
  if (!responses.length) return 0; // chưa có dữ liệu -> giả định năng lực trung bình

  let theta = 0; // điểm khởi tạo: giả định năng lực trung bình

  for (let iter = 0; iter < maxIter; iter++) {
    let firstDerivative = 0;  // đạo hàm bậc 1 của log-likelihood
    let secondDerivative = 0; // đạo hàm bậc 2 (dùng để cập nhật theta)

    for (const { a, b, c = 0, correct } of responses) {
      const p = probabilityCorrect(theta, a, b, c);
      const q = 1 - p;
      const u = correct ? 1 : 0;

      // Đạo hàm bậc 1: mức độ "đúng/sai thực tế" lệch khỏi "dự đoán"
      firstDerivative += a * (u - p) * (p - c) / (p * (1 - c) || 1e-9);

      // Đạo hàm bậc 2: dùng để biết nên bước theta bao xa
      secondDerivative -= (a * a) * (p * q) / ((1 - c) * (1 - c) || 1e-9);
    }

    if (secondDerivative === 0) break;

    const delta = firstDerivative / secondDerivative;
    theta -= delta;

    if (Math.abs(delta) < tolerance) break; // đã hội tụ, dừng sớm
  }

  // Giới hạn theta trong khoảng hợp lý, tránh giá trị bất thường
  // khi học sinh trả lời toàn đúng hoặc toàn sai (likelihood không hội tụ)
  return Math.max(-4, Math.min(4, theta));
}

// Hàm mật độ xác suất của phân phối chuẩn — dùng làm "prior"
function normalPdf(x, mean = 0, sd = 1) {
  const coeff = 1 / (sd * Math.sqrt(2 * Math.PI));
  const expo = -0.5 * Math.pow((x - mean) / sd, 2);
  return coeff * Math.exp(expo);
}

/**
 * Ước lượng theta bằng EAP: tích phân số (numerical integration)
 * trên một lưới giá trị theta từ min đến max, lấy trung bình có trọng số
 * bởi likelihood * prior. Ổn định hơn MLE khi dữ liệu ít hoặc cực đoan
 * (toàn đúng/toàn sai).
 */
function estimateThetaEAP(responses, { priorMean = 0, priorSD = 1, min = -4, max = 4, step = 0.05 } = {}) {
  if (!responses.length) return priorMean;

  let numerator = 0;
  let denominator = 0;

  for (let theta = min; theta <= max; theta += step) {
    let likelihood = 1;
    for (const { a, b, c = 0, correct } of responses) {
      const p = probabilityCorrect(theta, a, b, c);
      likelihood *= correct ? p : (1 - p);
    }
    const weight = likelihood * normalPdf(theta, priorMean, priorSD);
    numerator += theta * weight * step;
    denominator += weight * step;
  }

  return denominator === 0 ? priorMean : numerator / denominator;
}

module.exports = { estimateTheta, estimateThetaEAP, normalPdf };