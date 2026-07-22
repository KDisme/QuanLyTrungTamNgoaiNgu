export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function getLateDurationText(submittedAt: any, dueDate: any) {
  if (!submittedAt || !dueDate) return '';
  const diffMs = new Date(submittedAt).getTime() - new Date(dueDate).getTime();
  if (diffMs <= 0) return '';

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `muộn ${diffMinutes} phút`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  if (diffHours < 24) {
    return `muộn ${diffHours} giờ ${remainingMinutes > 0 ? `${remainingMinutes} phút` : ''}`;
  }

  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  return `muộn ${diffDays} ngày ${remainingHours > 0 ? `${remainingHours} giờ` : ''}`;
}

export function getDisplayStatus(row: any, isStudentView: boolean) {
  if (row.status === 'active') {
    const dueDate = row.dueDate || row.due_date;
    const allowLate = row.allowLateSubmission || row.allow_late_submission;
    if (dueDate && new Date() > new Date(dueDate) && !allowLate) {
      return 'closed';
    }
  }
  return row.status;
}

export function getStudentHomeworkStatus(row: any) {
  const myStatus = row.myStatus || row.my_status;
  const mySubmittedAt = row.mySubmittedAt || row.my_submitted_at;
  const myStartedAt = row.myStartedAt || row.my_started_at;
  const dueDate = row.dueDate || row.due_date;
  const allowLate = row.allowLateSubmission || row.allow_late_submission;

  if (mySubmittedAt || ['submitted', 'graded'].includes(String(myStatus || '').toLowerCase())) {
    if (myStatus === 'graded') {
      return 'graded'; // Đã chấm
    }
    if (dueDate && new Date(mySubmittedAt || Date.now()) > new Date(dueDate)) {
      return 'submitted_late'; // Nộp muộn
    }
    return 'submitted'; // Đang chờ chấm
  }

  // Chưa nộp
  const now = new Date();
  if (dueDate && now > new Date(dueDate)) {
    if (allowLate) {
      return myStartedAt || myStatus === 'in_progress' ? 'in_progress' : 'assigned';
    }
    return 'missed'; // Quá hạn
  }

  if (myStatus === 'revision_required') {
    return 'revision_required'; // Cần làm lại
  }

  return myStartedAt || myStatus === 'in_progress' ? 'in_progress' : 'assigned';
}

export function getStudentHomeworkTab(row: any): 'todo' | 'submitted' | 'history' {
  const status = getStudentHomeworkStatus(row);
  if (['assigned', 'in_progress', 'revision_required'].includes(status)) {
    return 'todo';
  }
  if (['submitted', 'submitted_late'].includes(status)) {
    return 'submitted';
  }
  return 'history'; // 'graded', 'missed'
}