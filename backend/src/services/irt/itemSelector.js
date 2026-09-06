// services/irt/itemSelector.js
const { itemInformation } = require('./core');

/**
 * Chọn câu hỏi kế tiếp trong bài thi thích ứng.
 * Nguyên tắc Maximum Information: chọn câu cho nhiều "thông tin" nhất
 * tại mức năng lực theta hiện tại của học sinh (thường là câu có b ≈ theta).
 *
 * theta: năng lực hiện tại của học sinh
 * availableItems: mảng các câu hỏi chưa dùng, mỗi câu có { id, a, b, c }
 * Trả về: câu hỏi được chọn (object), hoặc null nếu hết câu
 */
function selectNextItem(theta, availableItems) {
  if (!availableItems.length) return null;

  let bestItem = null;
  let bestInfo = -Infinity;

  for (const item of availableItems) {
    const info = itemInformation(theta, item.a, item.b, item.c || 0);
    if (info > bestInfo) {
      bestInfo = info;
      bestItem = item;
    }
  }

  return bestItem;
}

module.exports = { selectNextItem };