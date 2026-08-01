const registry = require('./registry');

function push(tenantId, userId, payload) {
  const clients = registry.getConnections(tenantId, userId);
  if (!clients.size) return; // user không mở tab nào -> bỏ qua, thông báo vẫn nằm sẵn trong DB

  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(data);
    } catch {
      // kết nối đã chết nhưng chưa kịp unregister -> bỏ qua, để lần 'close' tự dọn
    }
  }
}

module.exports = { push };