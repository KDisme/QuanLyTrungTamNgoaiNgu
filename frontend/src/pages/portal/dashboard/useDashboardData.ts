import { useEffect, useState } from 'react';
import { dashboardApi, schedulesApi, mockExamsApi } from '../../../api';

export function useDashboardData(role: string | undefined, user: any) {
  const [stats, setStats] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [mockExams, setMockExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      dashboardApi.getStats(),
      schedulesApi.getUpcoming({ limit: 5 }),
      (role === 'student' || role === 'teacher' || role === 'staff') ? mockExamsApi.getAll({ limit: 5 }) : Promise.resolve({ data: [] }),
    ]).then(([s, sch, exams]) => {
      if (!mounted) return;
      if (s.status === 'fulfilled') setStats(s.value.data);
      if (sch.status === 'fulfilled') setUpcoming(Array.isArray(sch.value.data) ? sch.value.data : sch.value.data?.data || []);
      if (exams.status === 'fulfilled') setMockExams(Array.isArray(exams.value.data) ? exams.value.data : exams.value.data?.data || []);
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [role, user]);

  return { stats, upcoming, mockExams, loading };
}