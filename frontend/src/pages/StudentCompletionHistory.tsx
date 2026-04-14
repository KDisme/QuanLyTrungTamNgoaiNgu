import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import dayjs from "dayjs";
import { apiGetStudentCompletedHistory } from "../api/studentService";

import "../styles/global.css";
import "../styles/table.css";

interface CompletionHistory {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  class_id: number | null;
  class_name: string | null;
  completed_at: string;
  notes: string | null;
}

const StudentCompletionHistory: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [histories, setHistories] = useState<CompletionHistory[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGetStudentCompletedHistory();
      const data: CompletionHistory[] = Array.isArray(res.data)
        ? res.data
        : res.data?.histories || res.data?.data || [];
      setHistories(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return histories;

    return histories.filter((h) => {
      const name = (h.student_name || "").toLowerCase();
      const email = (h.student_email || "").toLowerCase();
      const cls = (h.class_name || "").toLowerCase();
      return name.includes(kw) || email.includes(kw) || cls.includes(kw);
    });
  }, [histories, keyword]);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Lịch sử hoàn thành khóa học</h1>
          <p className="page-subtitle">Danh sách các học viên đã hoàn thành khóa học trước đó</p>
        </div>
      </div>

      <div className="searchbar">
        <Search size={18} color="#94a3b8" />
        <input
          type="text"
          placeholder="Tìm theo tên học viên, email, tên lớp..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Mã HV</th>
                <th>Học viên</th>
                <th>Email</th>
                <th>Lớp đã hoàn thành</th>
                <th style={{ width: 170 }}>Ngày hoàn thành</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="row-empty">
                    {loading ? "Đang tải dữ liệu..." : "Chưa có lịch sử hoàn thành"}
                  </td>
                </tr>
              ) : (
                filtered.map((h) => (
                  <tr key={h.id}>
                    <td className="td-center">HV{String(h.student_id).padStart(3, "0")}</td>
                    <td className="td-strong">{h.student_name}</td>
                    <td>{h.student_email}</td>
                    <td>{h.class_name || "---"}</td>
                    <td>{dayjs(h.completed_at).format("DD/MM/YYYY HH:mm")}</td>
                    <td>{h.notes || "---"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">Hiển thị {filtered.length} / {histories.length} bản ghi</div>
      </div>
    </div>
  );
};

export default StudentCompletionHistory;
