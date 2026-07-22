import React, { useState } from 'react';
import { ClipboardList, FileCheck2, UsersRound } from 'lucide-react';
import { EmptyState, Modal, StatusBadge } from '../../../components/common';
import { formatDateTime, getLateDurationText } from '../utils/homeworkAssignments.helpers.ts';
import GradeStudentModal from './GradeStudentModal';

export default function HomeworkDetailModal({
  detail,
  onClose,
  onSuccess,
}: {
  detail: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [gradingStudent, setGradingStudent] = useState<any>(null);
  const students = detail?.students || [];

  return (
    <>
      <Modal title={`Chấm bài - ${detail?.title || ''}`} size="xl" onClose={onClose}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="grid-2">
            <div className="stat-card"><div><div className="stat-value">{detail?.className || detail?.class_name || '-'}</div><div className="stat-label">LỚP</div></div><UsersRound color="var(--primary)" /></div>
            <div className="stat-card"><div><div className="stat-value">{students.length}</div><div className="stat-label">HỌC VIÊN ĐƯỢC GÁN</div></div><ClipboardList color="var(--primary)" /></div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Trạng thái</th>
                  <th>Điểm</th>
                  <th>Nộp lúc</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState message="Chưa có học viên nào trong bài tập" /></td></tr>
                ) : students.map((student: any) => (
                  <tr key={student.assignmentStudentId || student.id}>
                    <td>
                      <b>{student.studentName || student.full_name}</b>
                      <div style={{ color: 'var(--gray-500)', fontSize: 12 }}>{student.studentEmail || student.email}</div>
                    </td>
                    <td><StatusBadge status={student.submissionStatus || student.submission_status || student.myStatus || student.status} /></td>
                    <td>{student.submissionTotalScore ?? student.total_score ?? '-'}</td>
                    <td>
                      {student.submissionSubmittedAt || student.submitted_at ? (
                        <>
                          <div>{formatDateTime(student.submissionSubmittedAt || student.submitted_at)}</div>
                          {detail?.dueDate && new Date(student.submissionSubmittedAt || student.submitted_at) > new Date(detail.dueDate) && (
                            <div style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>
                              ({getLateDurationText(student.submissionSubmittedAt || student.submitted_at, detail.dueDate)})
                            </div>
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {student.submissionId ? (
                        (student.submissionStatus || student.submission_status) === 'graded' ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => setGradingStudent(student)}><FileCheck2 size={12} /> Xem bài</button>
                        ) : (
                          <button className="btn btn-primary btn-sm" onClick={() => setGradingStudent(student)}><FileCheck2 size={12} /> Chấm bài</button>
                        )
                      ) : (
                        <span style={{ color: 'var(--gray-500)', fontSize: 13 }}>Chưa nộp</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {gradingStudent && <GradeStudentModal detail={detail} student={gradingStudent} onClose={() => setGradingStudent(null)} onSuccess={onSuccess} />}
    </>
  );
}