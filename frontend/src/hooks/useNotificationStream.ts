import { useEffect, useRef } from 'react';
import { DEFAULT_TENANT_SLUG } from '../api';

export function useNotificationStream(onEvent: (payload: any) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const token = localStorage.getItem('token');
    const tenant = localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG;
    if (!token) return;

    const url = `/api/${tenant}/notifications/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        onEventRef.current(payload);
      } catch {
        // ignore malformed payload
      }
    };

    // EventSource tự động reconnect khi mất kết nối, không cần code thêm

    return () => source.close();
  }, []);
}