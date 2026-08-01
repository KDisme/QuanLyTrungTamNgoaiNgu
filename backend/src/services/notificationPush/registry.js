// Lưu các kết nối SSE đang mở, theo key `${tenantId}:${userId}`.
// Một user có thể mở nhiều tab/thiết bị cùng lúc -> dùng Set để chứa nhiều response.
const connections = new Map();

function keyOf(tenantId, userId) {
  return `${tenantId}:${userId}`;
}

function register(tenantId, userId, res) {
  const key = keyOf(tenantId, userId);
  if (!connections.has(key)) connections.set(key, new Set());
  connections.get(key).add(res);

  return function unregister() {
    const set = connections.get(key);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) connections.delete(key);
  };
}

function getConnections(tenantId, userId) {
  return connections.get(keyOf(tenantId, userId)) || new Set();
}

module.exports = { register, getConnections };