const ssePusher = require('./sse.pusher');
// const fcmPusher = require('./fcm.pusher'); // ← bật dòng này khi chuyển sang FCM

/**
 * Đẩy 1 thông báo tới user, nếu họ đang có kết nối mở.
 * notification.service.js chỉ biết tới hàm này — không biết bên dưới là SSE hay FCM.
 */
function pushToUser(tenantId, userId, payload) {
  ssePusher.push(tenantId, userId, payload);
  // fcmPusher.push(tenantId, userId, payload); // ← đổi/thêm dòng này khi chuyển sang FCM
}

module.exports = { pushToUser };