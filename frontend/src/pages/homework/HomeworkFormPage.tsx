import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { homeworkApi } from '../../api';
import { EmptyState, Loading } from '../../components/common';
import HomeworkFormBody from './form/components/HomeworkFormBody';

export default function HomeworkFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [initial, setInitial] = useState<any>(null);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    let mounted = true;
    setLoading(true);
    homeworkApi.getById(Number(id))
      .then((res) => { if (mounted) setInitial(res.data); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id, isEdit]);

  const goBack = () => navigate(-1);

  if (loading) return <Loading />;
  if (isEdit && !initial) return <EmptyState message="Không tìm thấy bài tập" />;

  return <HomeworkFormBody initial={initial} onDone={goBack} />;
}