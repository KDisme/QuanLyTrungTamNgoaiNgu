import { useEffect, useState } from 'react';

// Nguồn dữ liệu dùng chung cho toàn app — Sidebar và NotificationsPage (và sau này
// bất kỳ nơi nào khác cần hiện số thông báo chưa đọc) đều đọc/ghi cùng 1 giá trị này,
// thay vì mỗi component tự giữ state riêng rồi bị lệch nhau.
let unreadCount = 0;
const listeners = new Set<(count: number) => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener(unreadCount));
}

export function setSharedUnreadCount(updater: number | ((prev: number) => number)) {
  unreadCount = typeof updater === 'function' ? (updater as (prev: number) => number)(unreadCount) : updater;
  if (unreadCount < 0) unreadCount = 0;
  notifyListeners();
}

export function useUnreadNotificationCount(): [number, typeof setSharedUnreadCount] {
  const [count, setCount] = useState(unreadCount);

  useEffect(() => {
    listeners.add(setCount);
    return () => { listeners.delete(setCount); };
  }, []);

  return [count, setSharedUnreadCount];
}